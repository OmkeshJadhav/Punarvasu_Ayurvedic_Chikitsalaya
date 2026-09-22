"use server";

/**
 * Receptionist server actions.
 *
 * ## The sequence every write follows
 *
 *   1. Resolve the authenticated user and check the permission. Server-side,
 *      session verified upstream, role read from the database.
 *   2. Read the form through a **fixed field list**, so a field the form does
 *      not define is never read at all.
 *   3. Parse it through the same `strict()` schema the browser ran. A request
 *      carrying an unexpected key is rejected, not stripped.
 *   4. Call the database function, which re-checks the role, validates the
 *      patient id against the patients table, derives the duration from the
 *      appointment type, sets the status itself and re-runs every booking
 *      rule through the one shared validator.
 *   5. Map any failure to safe copy. Log a category and an opaque user id.
 *
 * That is `phase_10.md` sections 17-18 and 38, and it is the same sequence
 * `features/appointments/actions.ts` follows — with one difference worth being
 * explicit about: **this layer is not where the security lives.** If every
 * check here were deleted, the database functions would still refuse a caller
 * who is not a receptionist, still refuse an unknown patient id, still set the
 * status themselves, and the exclusion constraint would still decide a race
 * (`docs/SECURITY.md` section 2.2).
 *
 * ## What no action here sends
 *
 * A role, a permission, a status the receptionist may not set, a duration, an
 * end time, a timestamp, an internal note, or an owner for a patient record.
 * The RPC signatures do not accept them. The one identifier that *is* sent —
 * a patient id, on booking — says which patient, never whether the caller may
 * act on one, and the database validates it before writing anything.
 *
 * ## Why these use `can()` rather than `assertPermission()`
 *
 * They report failure as form state. An action that throws inside a form
 * submission produces a generic error boundary instead of a message beside the
 * control, which is worse for the receptionist and no safer — the database
 * refuses regardless. The same reasoning as the patient actions.
 *
 * ## What is never logged
 *
 * A patient's name, phone number, address, date of birth, appointment time or
 * note, and never a search term. The structured logger redacts by key name as
 * a safety net, but these actions do not hand it those values. What is logged
 * is the operation, the actor's opaque id, and — where an investigation would
 * need it — the opaque id of the record acted on.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { describeAppointmentFailure } from "@/features/appointments/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import type { Permission } from "@/config/permissions";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scheduleNotificationDispatch } from "@/features/notifications/dispatch";

import {
  APPOINTMENT_ACTIONS_COPY,
  NEW_PATIENT_COPY,
  RECEPTION_ERRORS,
  STAFF_BOOKING_COPY,
} from "./content";
import { findPossibleDuplicates, searchPatients } from "./queries";
import {
  receptionFormError,
  receptionFormSuccess,
  type PatientSearchFormState,
  type ReceptionFormState,
} from "./types";
import {
  createPatientSchema,
  patientSearchSchema,
  staffBookingSchema,
  staffRescheduleSchema,
  staffStatusSchema,
} from "./validation";

const RECEPTION_HOME = "/receptionist";
const RECEPTION_SCHEDULE = "/receptionist/schedule";
const RECEPTION_PATIENTS = "/receptionist/patients";

/*
 * Note for callers: `IDLE_RECEPTION_FORM_STATE` lives in `./types`, not here.
 * A `"use server"` module may only export async functions, and the constant is
 * needed by client components that must not pull this module's server imports
 * with them.
 */

/** Reads only the fields a form is allowed to carry. The first allowlist gate. */
function readForm(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const name of fields) {
    const value = formData.get(name);
    // `FormData` can hold files. A file where a value belongs is not something
    // to coerce; it is a request that does not match the form.
    values[name] = typeof value === "string" ? value : "";
  }

  return values;
}

/**
 * The authorized receptionist, or the form state explaining why not.
 *
 * Shared by every action so the two refusals that precede every write are
 * written once and cannot diverge.
 */
async function requireReceptionist(
  permission: Permission,
): Promise<
  { readonly userId: string } | { readonly failure: ReceptionFormState }
> {
  const user = await getCurrentUser();

  if (!user) {
    // The pages above are behind `requireUser()`, so reaching here means the
    // session ended between render and submit. Saying so beats a generic
    // failure the receptionist would retry forever.
    logger.warn("reception.write_unauthenticated");
    return { failure: receptionFormError(RECEPTION_ERRORS.sessionEnded) };
  }

  if (!can(user.role, permission)) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission,
    });
    // Generic. It names no role and no required permission
    // (`phase_08.md` section 12).
    return { failure: receptionFormError(RECEPTION_ERRORS.forbidden) };
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

const SEARCH_FIELDS = ["query"] as const;

/**
 * Searches for a patient.
 *
 * ## Why a server action rather than a `GET` with the term in the URL
 *
 * A search term at a front desk is somebody's name. `?q=Priya+Sharma` reaches
 * browser history on a shared machine, every proxy's access log and the
 * `Referer` header of the next request — which is exactly what
 * `phase_10.md` section 36 and `docs/SECURITY.md` section 14 rule out. A POST
 * keeps it out of all three.
 *
 * It is still a server-side, authorized, bounded query
 * (`phase_10.md` example 2): nothing is filtered in the browser, and the whole
 * patient list is never sent to it. `search_patients` clamps the result count
 * itself and refuses a term shorter than two characters, so neither is the
 * caller's to decide.
 *
 * ## The term is never logged
 *
 * Not on success, not on failure, not in a warning. The log records that a
 * search happened and who made it.
 */
export async function searchPatientsAction(
  _previousState: PatientSearchFormState,
  formData: FormData,
): Promise<PatientSearchFormState> {
  const raw = readForm(formData, SEARCH_FIELDS);
  const parsedQuery = patientSearchSchema.safeParse(raw);
  const query = parsedQuery.success ? parsedQuery.data.query : "";

  const user = await getCurrentUser();

  if (!user || !can(user.role, "patients.read.operational")) {
    if (user) {
      logger.warn("authz.denied", {
        userId: user.id,
        reason: "permission",
        permission: "patients.read.operational",
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
    const outcome = await searchPatients(query);

    // That a search happened, and who made it. Never what was searched for.
    logger.info("reception.patient_search", { userId: user.id });

    return {
      status: outcome.status,
      results: outcome.results,
      tooShort: outcome.tooShort,
      query,
    };
  } catch (error) {
    // `searchPatients` re-checks the permission and throws if it has gone —
    // a session that ended between the check above and the query. Reported as
    // an outage rather than as a refusal, because from the receptionist's side
    // it is one.
    logger.error("reception.patient_search_error", error, { userId: user.id });
    return { status: "unavailable", results: [], tooShort: false, query };
  }
}

const PATIENT_FIELDS = [
  "fullName",
  "preferredName",
  "phone",
  "dateOfBirth",
  "gender",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
  "emergencyContactName",
  "emergencyContactRelationship",
  "emergencyContactPhone",
  "preferredLanguage",
  "duplicateAcknowledged",
] as const;

/**
 * Registers a patient the clinic has not seen before.
 *
 * ## What it cannot do, structurally
 *
 * Create an authentication account, set a password, assign a role, or attach
 * the record to somebody's login. `create_patient_record` has no parameter for
 * an owner, so the record is always unlinked — the walk-in case
 * `docs/DATABASE.md` section 4.2 describes and Phase 07's partial unique index
 * was built for (`phase_10.md` sections 34-35).
 *
 * ## Duplicates: shown once, never enforced
 *
 * The first submission runs a duplicate check. If it finds anything, nothing
 * is written and the candidates come back for the receptionist to look at.
 * They then either open an existing record or say this is somebody else, and
 * the second submission goes through.
 *
 * That is `phase_10.md` section 33's flow exactly, and the shape matters: it
 * **warns once and never blocks**. Refusing outright to register somebody
 * standing at the desk because a stranger shares their phone number would be
 * worse than the duplicate it prevents, and automatically merging two records
 * because a name matched would be worse than both — it would attach one
 * person's appointments to another person's record.
 *
 * A failed duplicate check does not block either. It is advisory, and being
 * unable to register a patient because an advisory query timed out is not a
 * trade worth making.
 */
export async function createPatientAction(
  _previousState: ReceptionFormState,
  formData: FormData,
): Promise<ReceptionFormState> {
  const actor = await requireReceptionist("patients.write.operational");
  if ("failure" in actor) return actor.failure;

  const submitted = readForm(formData, PATIENT_FIELDS);
  const parsed = createPatientSchema.safeParse(submitted);

  if (!parsed.success) {
    return receptionFormError(NEW_PATIENT_COPY.validationErrorMessage, {
      fieldErrors: toFieldErrors(parsed.error.issues),
      // Returned so a validation error does not make the receptionist retype a
      // walk-in's address. These are the values they just typed, echoed into
      // their own form over an authenticated connection. Never logged.
      values: submitted,
    });
  }

  // The warning step. Skipped once the receptionist has said this is somebody
  // else, and skipped silently if the advisory check itself fails.
  if (!parsed.data.duplicateAcknowledged) {
    const duplicates = await findPossibleDuplicates({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      dateOfBirth: parsed.data.dateOfBirth,
    });

    if (duplicates.length > 0) {
      logger.info("reception.possible_duplicate_shown", {
        userId: actor.userId,
        candidateCount: duplicates.length,
      });
      return receptionFormError(NEW_PATIENT_COPY.duplicateTitle, {
        values: submitted,
        duplicates,
      });
    }
  }

  let patientId: string;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_patient_record", {
      p_full_name: parsed.data.fullName,
      p_preferred_name: parsed.data.preferredName ?? null,
      p_phone: parsed.data.phone ?? null,
      p_date_of_birth: parsed.data.dateOfBirth ?? null,
      p_gender: parsed.data.gender ?? null,
      p_address_line1: parsed.data.addressLine1 ?? null,
      p_address_line2: parsed.data.addressLine2 ?? null,
      p_city: parsed.data.city ?? null,
      p_state: parsed.data.state ?? null,
      p_postal_code: parsed.data.postalCode ?? null,
      p_emergency_contact_name: parsed.data.emergencyContactName ?? null,
      p_emergency_contact_relationship:
        parsed.data.emergencyContactRelationship ?? null,
      p_emergency_contact_phone: parsed.data.emergencyContactPhone ?? null,
      p_preferred_language: parsed.data.preferredLanguage ?? null,
    });

    if (error) {
      logger.error("reception.patient_create_failed", error, {
        userId: actor.userId,
      });
      return receptionFormError(NEW_PATIENT_COPY.saveErrorMessage, {
        values: submitted,
      });
    }

    if (typeof data !== "string") {
      logger.error("reception.patient_create_no_id", null, {
        userId: actor.userId,
      });
      return receptionFormError(NEW_PATIENT_COPY.saveErrorMessage, {
        values: submitted,
      });
    }

    patientId = data;
  } catch (error) {
    logger.error("reception.patient_create_error", error, {
      userId: actor.userId,
    });
    return receptionFormError(NEW_PATIENT_COPY.saveErrorMessage, {
      values: submitted,
    });
  }

  // The operation and the two opaque ids an investigation would need. No name,
  // no phone number, no address, no date of birth.
  logger.info("reception.patient_created", {
    userId: actor.userId,
    patientId,
  });

  revalidatePath(RECEPTION_PATIENTS);

  // Outside the try, deliberately: `redirect()` signals by throwing, and a
  // `catch` around it would swallow the navigation and report an outage
  // instead. The same trap Phase 06 recorded.
  redirect(`${RECEPTION_PATIENTS}/${patientId}?created=1`);
}

const BOOKING_FIELDS = [
  "patientId",
  "practitionerId",
  "appointmentTypeId",
  "startsAt",
  "patientNote",
] as const;

/**
 * Books an appointment on a patient's behalf.
 *
 * Note what is passed and what is not. There is a patient id, because the
 * receptionist chooses the patient and `phase_10.md` section 18 requires
 * exactly that — validated server-side, against the patients table, before
 * anything is written. There is no duration, no end time, no status and no
 * timestamp: the database derives all four.
 *
 * The appointment is created `confirmed`, because the clinic itself entered it
 * (see `create_appointment_for_patient`). The status is still set by the
 * function rather than sent, and is still subject to the transition trigger.
 */
export async function createAppointmentForPatientAction(
  _previousState: ReceptionFormState,
  formData: FormData,
): Promise<ReceptionFormState> {
  const actor = await requireReceptionist("appointments.manage.any");
  if ("failure" in actor) return actor.failure;

  const parsed = staffBookingSchema.safeParse(
    readForm(formData, BOOKING_FIELDS),
  );

  if (!parsed.success) {
    return receptionFormError(STAFF_BOOKING_COPY.validationErrorMessage, {
      fieldErrors: toFieldErrors(parsed.error.issues),
    });
  }

  let appointmentId: string;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "create_appointment_for_patient",
      {
        p_patient_id: parsed.data.patientId,
        p_practitioner_id: parsed.data.practitionerId,
        p_appointment_type_id: parsed.data.appointmentTypeId,
        p_starts_at: new Date(parsed.data.startsAt).toISOString(),
        p_patient_note: parsed.data.patientNote ?? null,
      },
    );

    if (error) {
      const failure = describeAppointmentFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return receptionFormError(failure.message);
    }

    if (typeof data !== "string") {
      logger.error("reception.booking_no_id", null, { userId: actor.userId });
      return receptionFormError(RECEPTION_ERRORS.generic);
    }

    appointmentId = data;
  } catch (error) {
    logger.error("reception.booking_error", error, { userId: actor.userId });
    return receptionFormError(RECEPTION_ERRORS.generic);
  }

  logger.info("reception.appointment_created", {
    userId: actor.userId,
    appointmentId,
  });

  // Phase 15. Drains the notification outbox once this response has been
  // sent. The event itself was already written, by a trigger, inside the
  // transaction above; this only decides how soon somebody sees it, and it
  // cannot delay or fail the operation that has just succeeded.
  scheduleNotificationDispatch();

  revalidatePath(RECEPTION_HOME);
  revalidatePath(RECEPTION_SCHEDULE);
  revalidatePath(`${RECEPTION_PATIENTS}/${parsed.data.patientId}`);

  redirect(`${RECEPTION_SCHEDULE}/${appointmentId}?booked=1`);
}

const STATUS_FIELDS = ["appointmentId", "status", "reason"] as const;

/**
 * Confirms, checks in, marks a no-show, or cancels.
 *
 * One action for the four, because they are one operation with four values —
 * and four near-identical actions is four places for one of them to skip the
 * permission check.
 *
 * ## Three things refuse an unauthorized status, not one
 *
 *   1. `staffStatusSchema` constrains the value to the four this role may set,
 *      so `completed` is rejected at the trust boundary;
 *   2. `update_appointment_status_as_staff` has the same allowlist, so a
 *      caller that skipped the schema is refused in the database;
 *   3. `appointments_guard_transition()` refuses an illegal transition
 *      whatever the value, so `cancelled -> confirmed` is impossible even for
 *      a status this role may set.
 *
 * Cancelling is never a delete. The row, its note and its history all survive;
 * the database records who cancelled it and when.
 */
export async function updateAppointmentStatusAction(
  _previousState: ReceptionFormState,
  formData: FormData,
): Promise<ReceptionFormState> {
  const actor = await requireReceptionist("appointments.manage.any");
  if ("failure" in actor) return actor.failure;

  const parsed = staffStatusSchema.safeParse(readForm(formData, STATUS_FIELDS));

  if (!parsed.success) {
    return receptionFormError(RECEPTION_ERRORS.generic, {
      fieldErrors: toFieldErrors(parsed.error.issues),
    });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("update_appointment_status_as_staff", {
      p_appointment_id: parsed.data.appointmentId,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason ?? null,
    });

    if (error) {
      const failure = describeAppointmentFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return receptionFormError(failure.message);
    }
  } catch (error) {
    logger.error("reception.status_error", error, { userId: actor.userId });
    return receptionFormError(RECEPTION_ERRORS.generic);
  }

  // The status is an application constant, not patient information, and it is
  // what makes "who confirmed this?" answerable from the log. The
  // authoritative trail is the `appointment_events` row the database wrote.
  logger.info("reception.appointment_status_changed", {
    userId: actor.userId,
    appointmentId: parsed.data.appointmentId,
    status: parsed.data.status,
  });

  // Phase 15. Drains the notification outbox once this response has been
  // sent. The event itself was already written, by a trigger, inside the
  // transaction above; this only decides how soon somebody sees it, and it
  // cannot delay or fail the operation that has just succeeded.
  scheduleNotificationDispatch();

  revalidatePath(RECEPTION_HOME);
  revalidatePath(RECEPTION_SCHEDULE);
  revalidatePath(`${RECEPTION_SCHEDULE}/${parsed.data.appointmentId}`);

  return receptionFormSuccess(
    APPOINTMENT_ACTIONS_COPY.statusSuccess[parsed.data.status],
  );
}

const RESCHEDULE_FIELDS = ["appointmentId", "startsAt"] as const;

/**
 * Moves an appointment to a new time.
 *
 * In place, not cancel-and-recreate: the appointment keeps its identity and
 * the previous time is preserved as a history event. The same validator and
 * the same exclusion constraint apply as to a booking, so a reschedule is
 * exactly as safe under concurrency (`phase_10.md` section 21).
 *
 * Unlike the patient path, the status is preserved rather than reset to
 * `requested` — a receptionist moving an appointment *is* the clinic, and
 * sending the clinic's own change back to the clinic for confirmation would
 * make a confirmed patient's appointment look unconfirmed to them.
 */
export async function rescheduleAppointmentForPatientAction(
  _previousState: ReceptionFormState,
  formData: FormData,
): Promise<ReceptionFormState> {
  const actor = await requireReceptionist("appointments.manage.any");
  if ("failure" in actor) return actor.failure;

  const parsed = staffRescheduleSchema.safeParse(
    readForm(formData, RESCHEDULE_FIELDS),
  );

  if (!parsed.success) {
    return receptionFormError(
      "Please choose one of the times shown and try again.",
      { fieldErrors: toFieldErrors(parsed.error.issues) },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("reschedule_appointment_as_staff", {
      p_appointment_id: parsed.data.appointmentId,
      p_starts_at: new Date(parsed.data.startsAt).toISOString(),
    });

    if (error) {
      const failure = describeAppointmentFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return receptionFormError(failure.message);
    }
  } catch (error) {
    logger.error("reception.reschedule_error", error, {
      userId: actor.userId,
    });
    return receptionFormError(RECEPTION_ERRORS.generic);
  }

  logger.info("reception.appointment_rescheduled", {
    userId: actor.userId,
    appointmentId: parsed.data.appointmentId,
  });

  // Phase 15. Drains the notification outbox once this response has been
  // sent. The event itself was already written, by a trigger, inside the
  // transaction above; this only decides how soon somebody sees it, and it
  // cannot delay or fail the operation that has just succeeded.
  scheduleNotificationDispatch();

  revalidatePath(RECEPTION_HOME);
  revalidatePath(RECEPTION_SCHEDULE);
  revalidatePath(`${RECEPTION_SCHEDULE}/${parsed.data.appointmentId}`);

  redirect(`${RECEPTION_SCHEDULE}/${parsed.data.appointmentId}?moved=1`);
}
