"use server";

import { revalidatePath } from "next/cache";
import type { Permission } from "@/config/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scheduleNotificationDispatch } from "@/features/notifications/dispatch";
import { PRESCRIPTION_ERRORS } from "./content";
import { describePrescriptionFailure } from "./errors";
import { suggestMedicines } from "./queries";
import {
  prescriptionFormError,
  type MedicineSuggestion,
  type PrescriptionFormState,
} from "./types";
import {
  createPrescriptionSchema,
  medicineSuggestionSchema,
  PRESCRIPTION_CANCEL_FIELDS,
  PRESCRIPTION_ISSUE_FIELDS,
  PRESCRIPTION_SAVE_FIELDS,
  prescriptionCancelSchema,
  prescriptionIssueSchema,
  prescriptionSaveSchema,
} from "./validation";

/**
 * The four prescription writes, and the one prescription read a browser makes.
 *
 * ## The sequence every one of them follows
 *
 * ```text
 * authenticate            getCurrentUser(), verified against the Auth server
 * authorize               can(role, "prescriptions.write")
 * validate                a strict schema; an unexpected key is refused
 * call the function       security definer, which re-checks the role, resolves
 *                         the caller's own practitioner record from auth.uid(),
 *                         resolves the row by id AND by that practitioner,
 *                         applies the state rules and writes
 * row-level security      the last word
 * ```
 *
 * Deleting any one of the first three still leaves an unauthorized caller
 * with nothing.
 *
 * ## What is never sent
 *
 * No patient id, no practitioner id, no doctor id, no appointment id and no
 * status reaches any RPC below. The first four are derived from the clinical
 * record inside the database; the fifth does not exist because each
 * transition has its own function. A form carrying any of them is rejected by
 * `strict()` before it gets here, and would have nothing to act on if it were
 * not.
 *
 * ## What is never logged
 *
 * `phase_13.md` section 83. No medicine name, no dose, no frequency, no
 * instruction, no patient name, no search term. A log line carries the
 * operation, the actor's opaque id and the prescription's opaque id — which
 * is exactly section 83's "good" example, and nothing more.
 */

const DOCTOR_APPOINTMENTS = "/doctor/appointments";
const DOCTOR_PATIENTS = "/doctor/patients";
const PATIENT_PRESCRIPTIONS = "/patient/prescriptions";

function readForm(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  // Read by name from a fixed list, so a field the form did not declare is
  // never read at all. `strict()` then refuses anything unexpected that was
  // assembled in code rather than posted.
  const values: Record<string, string> = {};
  for (const name of fields) {
    const value = formData.get(name);
    values[name] = typeof value === "string" ? value : "";
  }
  return values;
}

async function requirePrescriber(
  permission: Permission,
): Promise<
  { readonly userId: string } | { readonly failure: PrescriptionFormState }
> {
  const user = await getCurrentUser();

  if (!user) {
    logger.warn("prescription.write_unauthenticated");
    return { failure: prescriptionFormError(PRESCRIPTION_ERRORS.sessionEnded) };
  }

  if (!can(user.role, permission)) {
    // Names neither the role held nor the role required (Phase 08's rule).
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission,
    });
    return { failure: prescriptionFormError(PRESCRIPTION_ERRORS.forbidden) };
  }

  return { userId: user.id };
}

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

const CREATE_FIELDS = ["clinicalRecordId"] as const;

/**
 * Opens a draft prescription against one of the caller's own consultations.
 *
 * Idempotent at the database level, so a double-click, a retry and two
 * genuinely concurrent requests all resolve to one prescription (section 73).
 * The button is also disabled for the duration of the request, which is a
 * courtesy rather than the control.
 */
export async function createPrescriptionAction(
  _previousState: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  const actor = await requirePrescriber("prescriptions.write");
  if ("failure" in actor) return actor.failure;

  const parsed = createPrescriptionSchema.safeParse(
    readForm(formData, CREATE_FIELDS),
  );

  if (!parsed.success) {
    return prescriptionFormError(
      PRESCRIPTION_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("create_prescription", {
      p_clinical_record_id: parsed.data.clinicalRecordId,
    });

    if (error) {
      const failure = describePrescriptionFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return prescriptionFormError(failure.message);
    }
  } catch (error) {
    logger.error("prescription.create_error", error, { userId: actor.userId });
    return prescriptionFormError(PRESCRIPTION_ERRORS.generic);
  }

  logger.info("prescription.created", { userId: actor.userId });
  revalidatePath(DOCTOR_APPOINTMENTS, "layout");

  return { status: "saved" };
}

/**
 * Saves the draft: the general instructions and the full ordered item list.
 *
 * The items are replaced rather than diffed, so add, edit, remove and reorder
 * are one atomic operation against one revision — and the replacement happens
 * inside the database function, after the optimistic lock, so a stale caller
 * replaces nothing.
 */
export async function savePrescriptionDraftAction(
  _previousState: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  const actor = await requirePrescriber("prescriptions.write");
  if ("failure" in actor) return actor.failure;

  const parsed = prescriptionSaveSchema.safeParse(
    readForm(formData, PRESCRIPTION_SAVE_FIELDS),
  );

  if (!parsed.success) {
    const fieldErrors = toFieldErrors(parsed.error.issues);
    return prescriptionFormError(
      fieldErrors.items ?? PRESCRIPTION_ERRORS.generic,
      fieldErrors,
    );
  }

  let version: number;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("save_prescription_draft", {
      p_prescription_id: parsed.data.prescriptionId,
      p_expected_version: parsed.data.expectedVersion,
      p_general_instructions: parsed.data.generalInstructions,
      p_items: parsed.data.items,
    });

    if (error) {
      const failure = describePrescriptionFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return failure.conflict
        ? { status: "conflict", message: failure.message }
        : prescriptionFormError(failure.message);
    }

    version = typeof data === "number" ? data : parsed.data.expectedVersion + 1;
  } catch (error) {
    logger.error("prescription.save_error", error, { userId: actor.userId });
    return prescriptionFormError(PRESCRIPTION_ERRORS.generic);
  }

  logger.info("prescription.draft_saved", {
    userId: actor.userId,
    prescriptionId: parsed.data.prescriptionId,
  });

  return { status: "saved", version, savedAt: Date.now() };
}

/**
 * Issues the prescription.
 *
 * Sends **an id and a revision, and nothing else**, so the act of issuing
 * cannot change what is issued (sections 15-16 and example 3). What the
 * doctor reviewed on screen was read back from the database, and this issues
 * exactly that.
 *
 * A second, concurrent request finds the row no longer a draft and matches no
 * row, so exactly one of two simultaneous issues succeeds and the other is
 * reported as a conflict. There is no path by which two prescriptions exist
 * (section 92).
 */
export async function issuePrescriptionAction(
  _previousState: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  const actor = await requirePrescriber("prescriptions.write");
  if ("failure" in actor) return actor.failure;

  const parsed = prescriptionIssueSchema.safeParse(
    readForm(formData, PRESCRIPTION_ISSUE_FIELDS),
  );

  if (!parsed.success) {
    return prescriptionFormError(
      PRESCRIPTION_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  let version: number;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("issue_prescription", {
      p_prescription_id: parsed.data.prescriptionId,
      p_expected_version: parsed.data.expectedVersion,
    });

    if (error) {
      const failure = describePrescriptionFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return failure.conflict
        ? { status: "conflict", message: failure.message }
        : prescriptionFormError(failure.message);
    }

    version = typeof data === "number" ? data : parsed.data.expectedVersion + 1;
  } catch (error) {
    logger.error("prescription.issue_error", error, { userId: actor.userId });
    return prescriptionFormError(PRESCRIPTION_ERRORS.generic);
  }

  logger.info("prescription.issued", {
    userId: actor.userId,
    prescriptionId: parsed.data.prescriptionId,
  });

  // Phase 15. Drains the notification outbox once this response has been
  // sent. The event itself was already written, by a trigger, inside the
  // transaction above; this only decides how soon somebody sees it, and it
  // cannot delay or fail the operation that has just succeeded.
  scheduleNotificationDispatch();

  revalidatePath(DOCTOR_APPOINTMENTS, "layout");
  revalidatePath(DOCTOR_PATIENTS, "layout");
  // The patient's own list changes the moment this succeeds, and not before.
  revalidatePath(PATIENT_PRESCRIPTIONS, "layout");

  return { status: "issued", version, savedAt: Date.now() };
}

/**
 * Withdraws a prescription (section 43).
 *
 * A status change, never a delete: the row, its items and its issue time are
 * preserved, and the consultation becomes free for a corrected prescription.
 */
export async function cancelPrescriptionAction(
  _previousState: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  const actor = await requirePrescriber("prescriptions.write");
  if ("failure" in actor) return actor.failure;

  const parsed = prescriptionCancelSchema.safeParse(
    readForm(formData, PRESCRIPTION_CANCEL_FIELDS),
  );

  if (!parsed.success) {
    return prescriptionFormError(
      PRESCRIPTION_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("cancel_prescription", {
      p_prescription_id: parsed.data.prescriptionId,
      p_expected_version: parsed.data.expectedVersion,
      p_reason: parsed.data.reason,
    });

    if (error) {
      const failure = describePrescriptionFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return failure.conflict
        ? { status: "conflict", message: failure.message }
        : prescriptionFormError(failure.message);
    }
  } catch (error) {
    logger.error("prescription.cancel_error", error, { userId: actor.userId });
    return prescriptionFormError(PRESCRIPTION_ERRORS.generic);
  }

  // The reason itself is never logged: it is clinical content.
  logger.info("prescription.cancelled", {
    userId: actor.userId,
    prescriptionId: parsed.data.prescriptionId,
  });

  revalidatePath(DOCTOR_APPOINTMENTS, "layout");
  revalidatePath(DOCTOR_PATIENTS, "layout");
  revalidatePath(PATIENT_PRESCRIPTIONS, "layout");

  return { status: "cancelled" };
}

/**
 * Medicine suggestions, as the doctor types (section 65).
 *
 * A server action rather than a `GET` endpoint, deliberately: what a doctor
 * is typing into a medicine field is clinical content, and a URL reaches
 * browser history on a shared consulting-room machine, proxy logs and the
 * next `Referer`. The same reasoning Phase 10 and Phase 11 applied to patient
 * search.
 *
 * Returns an empty list on any failure. An autocomplete that cannot reach the
 * server must never stop a doctor typing a medicine name.
 */
export async function suggestMedicinesAction(
  query: string,
): Promise<readonly MedicineSuggestion[]> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "prescriptions.read")) return [];

  const parsed = medicineSuggestionSchema.safeParse({ query });
  if (!parsed.success) return [];

  return suggestMedicines(parsed.data.query);
}
