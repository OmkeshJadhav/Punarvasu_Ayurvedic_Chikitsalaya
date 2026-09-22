"use server";

/**
 * Appointment server actions.
 *
 * ## The sequence every write follows
 *
 *   1. Resolve the authenticated user and check the permission. Server-side,
 *      session verified upstream, role read from the database.
 *   2. Read the form through a **fixed field list**, so a field the form does
 *      not define is never read at all.
 *   3. Parse it through the same `strict()` schema the browser ran. A request
 *      carrying an unexpected key is rejected, not stripped.
 *   4. Call the database function, which derives the patient from
 *      `auth.uid()`, the duration from the appointment type and the status
 *      from the transition rules — none of which this action passes.
 *   5. Map any failure to safe copy. Log a category and an opaque user id.
 *
 * That is `phase_09.md` section 22's order, with one difference worth being
 * explicit about: **this layer is not where the security lives.** It is the
 * first of three. If every check here were deleted, the database functions
 * would still refuse an unauthenticated caller, still refuse a non-patient,
 * still derive the patient from the session, and the exclusion constraint
 * would still be the thing that decides a race
 * (`docs/SECURITY.md` section 2.2).
 *
 * ## What no action here sends
 *
 * A patient id, a practitioner permission, a status, a duration, an end time,
 * a timestamp, an internal note, or an approval state. The RPC signatures do
 * not accept them. `phase_09.md` sections 22 and 70 ask for those to be
 * impossible to influence from the browser, and they are impossible because
 * the parameter does not exist rather than because something filtered it.
 *
 * ## Why the permission check uses `can()` rather than `assertPermission()`
 *
 * These actions report failure as form state. An action that throws inside a
 * form submission produces a generic error boundary instead of a message
 * beside the control, which is worse for the patient and no safer — the
 * database refuses regardless. The same reasoning as
 * `features/patients/actions.ts`.
 *
 * ## What is never logged
 *
 * An appointment time, a practitioner, a note, or a cancellation reason. The
 * structured logger redacts by key name as a safety net, but these actions do
 * not hand it those values. What is logged is the operation and the user id.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scheduleNotificationDispatch } from "@/features/notifications/dispatch";

import { CANCEL_COPY } from "./content";
import { describeAppointmentFailure } from "./errors";
import {
  appointmentFormError,
  appointmentFormSuccess,
  type AppointmentFormState,
} from "./types";
import {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
} from "./validation";

const APPOINTMENTS_PATH = "/patient/appointments";
const PATIENT_AREA_PATH = "/patient";

/*
 * Note for callers: `IDLE_APPOINTMENT_FORM_STATE` lives in `./types`, not
 * here. A `"use server"` module may only export async functions, and the
 * constant is needed by client components that must not pull this module's
 * server imports with them.
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
 * The authenticated patient, or the form state explaining why not.
 *
 * Shared by all three actions so the two refusals that precede every write are
 * written once and cannot diverge.
 */
async function requireBookingPatient(): Promise<
  { readonly userId: string } | { readonly failure: AppointmentFormState }
> {
  const user = await getCurrentUser();

  if (!user) {
    // The pages above are behind `requireUser()`, so reaching here means the
    // session ended between render and submit. Saying so beats a generic
    // failure the patient would retry forever.
    logger.warn("appointment.write_unauthenticated");
    return {
      failure: appointmentFormError(
        "Your session has ended. Please sign in again to continue.",
      ),
    };
  }

  if (!can(user.role, "appointments.write.self")) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission: "appointments.write.self",
    });
    // Generic. It names no role and no required permission
    // (`phase_08.md` section 12).
    return { failure: appointmentFormError(DEFAULT_USER_MESSAGE.forbidden) };
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

const BOOKING_FIELDS = [
  "practitionerId",
  "appointmentTypeId",
  "startsAt",
  "patientNote",
] as const;

/**
 * Requests an appointment for the signed-in patient.
 *
 * On success it redirects to the appointment's own page, which is where the
 * confirmation lives: `phase_09.md` section 48 wants the date, time,
 * practitioner, type and **actual status** shown, and the appointment page
 * already renders exactly that from the database rather than from what the
 * form thought it was doing.
 *
 * The status it reports is `requested`, not `confirmed`, because that is what
 * the row says. Sections 21 and 48 forbid claiming otherwise.
 */
export async function bookAppointmentAction(
  _previousState: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const actor = await requireBookingPatient();
  if ("failure" in actor) return actor.failure;

  const parsed = bookAppointmentSchema.safeParse(
    readForm(formData, BOOKING_FIELDS),
  );

  if (!parsed.success) {
    return appointmentFormError(
      "Please check the details below and try again.",
      toFieldErrors(parsed.error.issues),
    );
  }

  let appointmentId: string;

  try {
    const supabase = await createSupabaseServerClient();

    // Note what is passed and what is not. There is no patient id, no
    // duration, no end time and no status: the function derives all four.
    const { data, error } = await supabase.rpc("book_appointment", {
      p_practitioner_id: parsed.data.practitionerId,
      p_appointment_type_id: parsed.data.appointmentTypeId,
      p_starts_at: new Date(parsed.data.startsAt).toISOString(),
      p_patient_note: parsed.data.patientNote ?? null,
    });

    if (error) {
      const failure = describeAppointmentFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return appointmentFormError(failure.message);
    }

    if (typeof data !== "string") {
      logger.error("appointment.book_no_id", null, { userId: actor.userId });
      return appointmentFormError(DEFAULT_USER_MESSAGE.internal);
    }

    appointmentId = data;
  } catch (error) {
    logger.error("appointment.book_error", error, { userId: actor.userId });
    return appointmentFormError(DEFAULT_USER_MESSAGE.internal);
  }

  logger.info("appointment.requested", { userId: actor.userId });

  revalidatePath(APPOINTMENTS_PATH);
  revalidatePath(PATIENT_AREA_PATH);

  // Outside the try, deliberately: `redirect()` signals by throwing, and a
  // `catch` around it would swallow the navigation and report an outage
  // instead. The same trap Phase 06 recorded.
  redirect(`${APPOINTMENTS_PATH}/${appointmentId}?requested=1`);
}

const CANCEL_FIELDS = ["appointmentId", "reason"] as const;

/**
 * Cancels one of the signed-in patient's appointments.
 *
 * Never a delete (`phase_09.md` example 6). The database sets the status,
 * records who cancelled it and when, and writes a history event. The row and
 * everything about it survive.
 *
 * Ownership is not checked here, and that is not an omission: it is checked
 * inside `cancel_appointment`, where the appointment is looked up by id *and*
 * by the caller's own patient record in one statement. Doing it here as well
 * would mean reading the appointment first, which is a second round trip to
 * reach a weaker version of the same answer.
 */
export async function cancelAppointmentAction(
  _previousState: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const actor = await requireBookingPatient();
  if ("failure" in actor) return actor.failure;

  const parsed = cancelAppointmentSchema.safeParse(
    readForm(formData, CANCEL_FIELDS),
  );

  if (!parsed.success) {
    return appointmentFormError(
      "We couldn't cancel that appointment. Please try again.",
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("cancel_appointment", {
      p_appointment_id: parsed.data.appointmentId,
      p_reason: parsed.data.reason ?? null,
    });

    if (error) {
      const failure = describeAppointmentFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return appointmentFormError(failure.message);
    }
  } catch (error) {
    logger.error("appointment.cancel_error", error, { userId: actor.userId });
    return appointmentFormError(DEFAULT_USER_MESSAGE.internal);
  }

  logger.info("appointment.cancelled", { userId: actor.userId });

  // Phase 15. Drains the notification outbox once this response has been
  // sent. The event itself was already written, by a trigger, inside the
  // transaction above; this only decides how soon somebody sees it, and it
  // cannot delay or fail the operation that has just succeeded.
  scheduleNotificationDispatch();

  revalidatePath(APPOINTMENTS_PATH);
  revalidatePath(`${APPOINTMENTS_PATH}/${parsed.data.appointmentId}`);
  revalidatePath(PATIENT_AREA_PATH);

  return appointmentFormSuccess(CANCEL_COPY.successBody);
}

const RESCHEDULE_FIELDS = ["appointmentId", "startsAt"] as const;

/**
 * Moves one of the signed-in patient's appointments to a new time.
 *
 * In place, not cancel-and-recreate (`phase_09.md` section 29): the
 * appointment keeps its identity and the previous time is preserved as a
 * history event rather than lost.
 *
 * The same validation and the same exclusion constraint apply as to a
 * booking, so a reschedule is exactly as safe under concurrency
 * (section 30) — and a confirmed appointment returns to `requested`, because
 * the clinic agreed to a time and that time has changed.
 */
export async function rescheduleAppointmentAction(
  _previousState: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const actor = await requireBookingPatient();
  if ("failure" in actor) return actor.failure;

  const parsed = rescheduleAppointmentSchema.safeParse(
    readForm(formData, RESCHEDULE_FIELDS),
  );

  if (!parsed.success) {
    return appointmentFormError(
      "Please choose one of the times shown and try again.",
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("reschedule_appointment", {
      p_appointment_id: parsed.data.appointmentId,
      p_starts_at: new Date(parsed.data.startsAt).toISOString(),
    });

    if (error) {
      const failure = describeAppointmentFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return appointmentFormError(failure.message);
    }
  } catch (error) {
    logger.error("appointment.reschedule_error", error, {
      userId: actor.userId,
    });
    return appointmentFormError(DEFAULT_USER_MESSAGE.internal);
  }

  logger.info("appointment.rescheduled", { userId: actor.userId });

  // Phase 15. Drains the notification outbox once this response has been
  // sent. The event itself was already written, by a trigger, inside the
  // transaction above; this only decides how soon somebody sees it, and it
  // cannot delay or fail the operation that has just succeeded.
  scheduleNotificationDispatch();

  revalidatePath(APPOINTMENTS_PATH);
  revalidatePath(`${APPOINTMENTS_PATH}/${parsed.data.appointmentId}`);
  revalidatePath(PATIENT_AREA_PATH);

  redirect(`${APPOINTMENTS_PATH}/${parsed.data.appointmentId}?moved=1`);
}
