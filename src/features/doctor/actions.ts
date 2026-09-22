"use server";

/**
 * Doctor server actions.
 *
 * ## The sequence every write follows
 *
 *   1. Resolve the authenticated user and check the permission. Server-side,
 *      session verified upstream, role read from the database.
 *   2. Read the form through a **fixed field list**, so a field the form does
 *      not define is never read at all.
 *   3. Parse it through the same `strict()` schema the browser ran. A request
 *      carrying an unexpected key is rejected, not stripped.
 *   4. Call the database function, which re-checks the role, resolves the
 *      caller's *own* practitioner record, resolves the appointment by id and
 *      by that practitioner in one statement, re-checks the status allowlist
 *      and the transition, and writes the history row.
 *   5. Map any failure to safe copy. Log a category and an opaque user id.
 *
 * **This layer is not where the security lives.** If every check here were
 * deleted, `update_appointment_status_as_doctor` would still refuse a caller
 * who is not a doctor, still refuse a doctor with no practitioner record,
 * still refuse another practitioner's appointment, still refuse `cancelled`,
 * and the Phase 09 transition trigger would still refuse an illegal move
 * (`docs/SECURITY.md` section 2.2).
 *
 * ## What no action here sends
 *
 * A practitioner id, a doctor id, a patient id, a role, a permission, a
 * status the doctor may not set, a duration, an end time, a timestamp, an
 * internal note, or any clinical field. The RPC signature accepts an
 * appointment id and a status, and nothing else.
 *
 * ## Why these use `can()` rather than `assertPermission()`
 *
 * They report failure as form state. An action that throws inside a form
 * submission produces a generic error boundary instead of a message beside
 * the control, which is worse for the practitioner and no safer — the
 * database refuses regardless. The same reasoning as the patient and
 * reception actions.
 *
 * ## What is never logged
 *
 * A patient's name, phone number, date of birth, appointment time or note,
 * and never a search term. The structured logger redacts by key name as a
 * safety net, but these actions do not hand it those values. What is logged
 * is the operation, the actor's opaque id, and the opaque id of the
 * appointment acted on.
 */

import { revalidatePath } from "next/cache";

import { describeAppointmentFailure } from "@/features/appointments/errors";
import type { Permission } from "@/config/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scheduleNotificationDispatch } from "@/features/notifications/dispatch";

import { DOCTOR_ACTIONS_COPY, DOCTOR_ERRORS } from "./content";
import { searchCarePatients } from "./queries";
import {
  doctorFormError,
  doctorFormSuccess,
  type CarePatientSearchFormState,
  type DoctorFormState,
} from "./types";
import { carePatientSearchSchema, doctorStatusSchema } from "./validation";

const DOCTOR_HOME = "/doctor";
const DOCTOR_APPOINTMENTS = "/doctor/appointments";

/*
 * Note for callers: `IDLE_DOCTOR_FORM_STATE` and
 * `IDLE_CARE_PATIENT_SEARCH_STATE` live in `./types`, not here. A
 * `"use server"` module may only export async functions, and the constants
 * are needed by client components that must not pull this module's server
 * imports with them.
 */

/** Reads only the fields a form is allowed to carry. The first allowlist gate. */
function readForm(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const name of fields) {
    const value = formData.get(name);
    // `FormData` can hold files. A file where a value belongs is not
    // something to coerce; it is a request that does not match the form.
    values[name] = typeof value === "string" ? value : "";
  }

  return values;
}

/**
 * The authorized practitioner, or the form state explaining why not.
 *
 * Shared by every action so the two refusals that precede every write are
 * written once and cannot diverge. It resolves the *user*, never a
 * practitioner id — that is the database's to resolve, from `auth.uid()`.
 */
async function requireDoctor(
  permission: Permission,
): Promise<
  { readonly userId: string } | { readonly failure: DoctorFormState }
> {
  const user = await getCurrentUser();

  if (!user) {
    // The pages above are behind `requireUser()`, so reaching here means the
    // session ended between render and submit. Saying so beats a generic
    // failure the practitioner would retry forever.
    logger.warn("doctor.write_unauthenticated");
    return { failure: doctorFormError(DOCTOR_ERRORS.sessionEnded) };
  }

  if (!can(user.role, permission)) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission,
    });
    // Generic. It names no role and no required permission
    // (`phase_08.md` section 12, `phase_11.md` section 42).
    return { failure: doctorFormError(DOCTOR_ERRORS.forbidden) };
  }

  return { userId: user.id };
}

/** One message per field. Three stacked errors under one control is noise. */
function toFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

const STATUS_FIELDS = ["appointmentId", "status"] as const;

/**
 * Confirms an appointment, starts a consultation, completes it, or records
 * that the patient did not attend.
 *
 * One action for the four, because they are one operation with four values —
 * and four near-identical actions is four places for one of them to skip the
 * permission check.
 *
 * ## Starting a consultation is a status change and nothing more
 *
 * `phase_11.md` sections 19, 22 and 51, and example 8: the entry point must
 * not pretend to save clinical records, and no fake persistence may be
 * invented to make the button look functional. So "Start consultation" moves
 * an appointment the database already knows about from `checked_in` to
 * `in_consultation` — a value Phase 09 declared and deliberately left
 * unreachable until a practitioner had a workspace — and writes one
 * `appointment_events` row saying so. Nothing clinical is created, because
 * there is nothing clinical to create.
 *
 * ## Four things refuse an unauthorized status, not one
 *
 *   1. `doctorStatusSchema` constrains the value to the four this role may
 *      set, so `cancelled` and `checked_in` are rejected at the boundary;
 *   2. `update_appointment_status_as_doctor` has the same allowlist, so a
 *      caller that skipped the schema is refused in the database;
 *   3. that function resolves the appointment by the caller's own
 *      practitioner id, so another doctor's appointment is refused as
 *      not-found;
 *   4. `appointments_guard_transition()` refuses an illegal transition
 *      whatever the value, so `completed -> confirmed` is impossible even for
 *      a status this role may set.
 */
export async function updateDoctorAppointmentStatusAction(
  _previousState: DoctorFormState,
  formData: FormData,
): Promise<DoctorFormState> {
  const actor = await requireDoctor("appointments.manage.own_schedule");
  if ("failure" in actor) return actor.failure;

  const parsed = doctorStatusSchema.safeParse(
    readForm(formData, STATUS_FIELDS),
  );

  if (!parsed.success) {
    return doctorFormError(
      DOCTOR_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc(
      "update_appointment_status_as_doctor",
      {
        p_appointment_id: parsed.data.appointmentId,
        p_status: parsed.data.status,
      },
    );

    if (error) {
      const failure = describeAppointmentFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return doctorFormError(failure.message);
    }
  } catch (error) {
    logger.error("doctor.status_error", error, { userId: actor.userId });
    return doctorFormError(DOCTOR_ERRORS.generic);
  }

  // The status is an application constant, not patient information, and it is
  // what makes "who completed this?" answerable from the log. The
  // authoritative trail is the `appointment_events` row the database wrote.
  logger.info("doctor.appointment_status_changed", {
    userId: actor.userId,
    appointmentId: parsed.data.appointmentId,
    status: parsed.data.status,
  });

  // Phase 15. Drains the notification outbox once this response has been
  // sent. The event itself was already written, by a trigger, inside the
  // transaction above; this only decides how soon somebody sees it, and it
  // cannot delay or fail the operation that has just succeeded.
  scheduleNotificationDispatch();

  revalidatePath(DOCTOR_HOME);
  revalidatePath(DOCTOR_APPOINTMENTS);
  revalidatePath(`${DOCTOR_APPOINTMENTS}/${parsed.data.appointmentId}`);
  revalidatePath(
    `${DOCTOR_APPOINTMENTS}/${parsed.data.appointmentId}/consultation`,
  );

  return doctorFormSuccess(
    DOCTOR_ACTIONS_COPY.statusSuccess[parsed.data.status],
  );
}

const SEARCH_FIELDS = ["query"] as const;

/**
 * Searches the patients this practitioner is booked to see.
 *
 * ## Why a server action rather than a `GET` with the term in the URL
 *
 * A search term is somebody's name. `?q=Priya+Sharma` reaches browser history
 * on a shared consulting-room machine, every proxy's access log and the
 * `Referer` header of the next request — which is what `phase_11.md` section
 * 43 and `docs/SECURITY.md` section 14 rule out. A POST keeps it out of all
 * three. It is the same call Phase 10 made for the front desk, for the same
 * reason.
 *
 * It is still a server-side, authorized, bounded query
 * (`phase_11.md` example 5): nothing is filtered in the browser, and the
 * patient list is never sent to it. `search_care_patients` restricts the rows
 * to this practitioner's own care scope, clamps the result count itself and
 * refuses a term shorter than two characters, so none of the three is the
 * caller's to decide.
 *
 * ## The term is never logged
 *
 * Not on success, not on failure, not in a warning. The log records that a
 * search happened and who made it.
 */
export async function searchCarePatientsAction(
  _previousState: CarePatientSearchFormState,
  formData: FormData,
): Promise<CarePatientSearchFormState> {
  const raw = readForm(formData, SEARCH_FIELDS);
  const parsedQuery = carePatientSearchSchema.safeParse(raw);
  const query = parsedQuery.success ? parsedQuery.data.query : "";

  const user = await getCurrentUser();

  if (!user || !can(user.role, "patients.read.care")) {
    if (user) {
      logger.warn("authz.denied", {
        userId: user.id,
        reason: "permission",
        permission: "patients.read.care",
      });
    }
    return {
      status: "forbidden",
      results: [],
      tooShort: false,
      // Not echoed back on a refusal. There is no form to return it to.
      query: "",
    };
  }

  if (!parsedQuery.success) {
    return { status: "idle", results: [], tooShort: true, query: "" };
  }

  try {
    const outcome = await searchCarePatients(query);

    // That a search happened, and who made it. Never what was searched for.
    logger.info("doctor.patient_search", { userId: user.id });

    return {
      status: outcome.status,
      results: outcome.results,
      tooShort: outcome.tooShort,
      query,
    };
  } catch (error) {
    // `searchCarePatients` re-checks the permission and throws if it has gone
    // — a session that ended between the check above and the query. Reported
    // as an outage rather than as a refusal, because from the practitioner's
    // side it is one.
    logger.error("doctor.patient_search_error", error, { userId: user.id });
    return { status: "unavailable", results: [], tooShort: false, query };
  }
}
