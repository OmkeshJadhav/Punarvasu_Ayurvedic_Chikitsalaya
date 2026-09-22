"use server";

/**
 * Clinical record server actions.
 *
 * ## The sequence every write follows (sections 19, 54 and 55)
 *
 *   1. Resolve the authenticated user and check the permission. Server-side,
 *      session verified upstream, role read from the database.
 *   2. Read the form through a **fixed field list**, so a field the form does
 *      not declare is never read at all.
 *   3. Parse it through the same `strict()` schema the browser ran. A request
 *      carrying an unexpected key is rejected, not stripped.
 *   4. Call the database function, which re-checks the role, resolves the
 *      caller's *own* practitioner record, resolves the record by id and by
 *      that practitioner in one statement, refuses a completed record,
 *      refuses a stale version, validates the completion requirements and
 *      writes.
 *   5. Map any failure to safe copy. Log a category and an opaque user id.
 *
 * **This layer is not where the security lives.** If every check here were
 * deleted, `save_clinical_draft` would still refuse a caller who is not a
 * doctor, still refuse a doctor with no practitioner record, still refuse
 * another practitioner's record, still refuse a completed one and still
 * refuse a stale write — and `clinical_records_select_author` would still
 * return nothing to anybody else (`docs/SECURITY.md` section 2.2).
 *
 * ## What no action here sends
 *
 * A practitioner id, a doctor id, a patient id, an appointment id on a save,
 * a role, a permission, a status, a completion timestamp, an author. The RPC
 * signatures accept a record id, a version and eight text fields, and
 * `start_consultation` accepts one appointment id. Example 3's `doctorId` and
 * example 4's `patientId` have nowhere to arrive and nothing to do.
 *
 * ## What is never logged (section 43, example 7)
 *
 * **No clinical content, ever.** Not a chief complaint, not an assessment,
 * not a note, not a length, not a field name that was filled in. Not a
 * patient's name, phone number or date of birth either.
 *
 * What is logged is the operation, the actor's opaque id, and the opaque id
 * of the record acted on — which is what makes "did that save?" answerable
 * without the log becoming a second copy of the medical record. The
 * structured logger redacts by key name as a safety net; these actions do not
 * hand it the values in the first place.
 *
 * ## Why these use `can()` rather than `assertPermission()`
 *
 * They report failure as form state. An action that throws inside a form
 * submission produces a generic error boundary instead of a message beside
 * the control — and here that would mean a practitioner losing a page of
 * typing to find out. The same reasoning as the patient, reception and doctor
 * actions; the database refuses regardless.
 */

import { revalidatePath } from "next/cache";

import type { Permission } from "@/config/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CLINICAL_ERRORS } from "./content";
import { describeClinicalFailure } from "./errors";
import { missingClinicalRequirements } from "./status";
import {
  clinicalFormError,
  type ClinicalFormState,
  type ClinicalContent,
} from "./types";
import {
  CLINICAL_SAVE_FIELDS,
  clinicalRecordSaveSchema,
  startConsultationSchema,
  type ClinicalRecordSaveInput,
} from "./validation";

const DOCTOR_HOME = "/doctor";
const DOCTOR_APPOINTMENTS = "/doctor/appointments";

/*
 * Note for callers: `IDLE_CLINICAL_FORM_STATE` lives in `./types`, not here. A
 * `"use server"` module may only export async functions, and the constant is
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
    // `FormData` can hold files. A file where clinical text belongs is not
    // something to coerce; it is a request that does not match the form —
    // and section 49 puts files in Phase 14 regardless.
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
async function requireClinician(
  permission: Permission,
): Promise<
  { readonly userId: string } | { readonly failure: ClinicalFormState }
> {
  const user = await getCurrentUser();

  if (!user) {
    // The pages above are behind `requireUser()`, so reaching here means the
    // session ended between render and submit — which for a consultation form
    // means a page of typing is at stake. The message says explicitly that
    // nothing was saved and how to recover without losing it.
    logger.warn("clinical.write_unauthenticated");
    return { failure: clinicalFormError(CLINICAL_ERRORS.sessionEnded) };
  }

  if (!can(user.role, permission)) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission,
    });
    // Generic. It names no role and no required permission
    // (`phase_08.md` section 12, `phase_12.md` section 44).
    return { failure: clinicalFormError(CLINICAL_ERRORS.forbidden) };
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

/** The eight fields, as the RPC's parameter names. Written once. */
function toClinicalRpcArgs(input: ClinicalRecordSaveInput) {
  return {
    p_record_id: input.recordId,
    p_expected_version: input.expectedVersion,
    p_chief_complaint: input.chiefComplaint,
    p_history_of_presenting_concern: input.historyOfPresentingConcern,
    p_symptoms: input.symptoms,
    p_clinical_observations: input.clinicalObservations,
    p_assessment: input.assessment,
    p_diagnosis_or_clinical_impression: input.diagnosisOrClinicalImpression,
    p_doctor_notes: input.doctorNotes,
    p_follow_up_notes: input.followUpNotes,
  };
}

const START_FIELDS = ["appointmentId"] as const;

/**
 * Starts a consultation from an eligible appointment.
 *
 * Section 18's checklist, and every item of it happens in the database rather
 * than here: the appointment must exist, must belong to this practitioner,
 * must be eligible, and must not already have a consultation record. The
 * patient and the practitioner written onto the record are read **out of the
 * appointment**, so no identity travels in the request.
 *
 * ## Duplicate creation, four ways (section 87)
 *
 * A double-click, a retry, a browser refresh and two genuinely concurrent
 * requests all resolve to one record, because `start_consultation` inserts
 * `on conflict (appointment_id) do nothing` and reads back whatever is there.
 * The unique index decides, under the database's own concurrency control —
 * an application-level "does one exist?" check would be passed by both of two
 * concurrent requests.
 *
 * So this action is **idempotent** and reports success either way. From the
 * practitioner's side, "open the consultation" asked for a state, and they
 * are in it.
 */
export async function startConsultationAction(
  _previousState: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const actor = await requireClinician("clinical_records.write");
  if ("failure" in actor) return actor.failure;

  const parsed = startConsultationSchema.safeParse(
    readForm(formData, START_FIELDS),
  );

  if (!parsed.success) {
    return clinicalFormError(
      CLINICAL_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("start_consultation", {
      p_appointment_id: parsed.data.appointmentId,
    });

    if (error) {
      const failure = describeClinicalFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return clinicalFormError(failure.message);
    }
  } catch (error) {
    logger.error("clinical.start_error", error, { userId: actor.userId });
    return clinicalFormError(CLINICAL_ERRORS.generic);
  }

  // The appointment id is an opaque identifier and is what makes "who opened
  // this consultation?" answerable. No patient id, and nothing clinical —
  // there is nothing clinical yet.
  logger.info("clinical.consultation_started", {
    userId: actor.userId,
    appointmentId: parsed.data.appointmentId,
  });

  revalidatePath(DOCTOR_HOME);
  revalidatePath(DOCTOR_APPOINTMENTS);
  revalidatePath(`${DOCTOR_APPOINTMENTS}/${parsed.data.appointmentId}`);
  revalidatePath(
    `${DOCTOR_APPOINTMENTS}/${parsed.data.appointmentId}/consultation`,
  );

  return { status: "saved" };
}

/**
 * Saves a draft (sections 15, 32 and 33).
 *
 * ## Why this is an explicit save and not autosave
 *
 * Section 32 lists what autosave has to get right — debouncing, race
 * conditions, offline failure, never silently overwriting newer content,
 * never claiming a save that did not happen — and then says plainly that a
 * reliable explicit `Save draft` is preferable to a fragile autosave system.
 *
 * This is the explicit one. Every save is one request the practitioner asked
 * for, its outcome is reported before anything on screen claims to be saved,
 * and the version it carries makes a stale write impossible to perform
 * accidentally.
 *
 * ## The version travels both ways
 *
 * In, as the revision being edited; out, as the revision the database now
 * holds, so the practitioner can keep typing and save again without
 * reloading. On a **conflict** no version comes back: what is in the browser
 * is then not a revision of anything the database has, and handing back a
 * version would let the next save perform the overwrite this one prevented.
 */
export async function saveClinicalDraftAction(
  _previousState: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const actor = await requireClinician("clinical_records.write");
  if ("failure" in actor) return actor.failure;

  const parsed = clinicalRecordSaveSchema.safeParse(
    readForm(formData, CLINICAL_SAVE_FIELDS),
  );

  if (!parsed.success) {
    return clinicalFormError(
      CLINICAL_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  let version: number;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "save_clinical_draft",
      toClinicalRpcArgs(parsed.data),
    );

    if (error) {
      const failure = describeClinicalFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return failure.conflict
        ? { status: "conflict", message: failure.message }
        : clinicalFormError(failure.message);
    }

    version = typeof data === "number" ? data : parsed.data.expectedVersion + 1;
  } catch (error) {
    logger.error("clinical.save_error", error, { userId: actor.userId });
    return clinicalFormError(CLINICAL_ERRORS.generic);
  }

  // That a record was saved, and by whom. Never what is in it, never how long
  // it is, never which sections were filled in.
  logger.info("clinical.draft_saved", {
    userId: actor.userId,
    recordId: parsed.data.recordId,
  });

  return { status: "saved", version, savedAt: Date.now() };
}

/**
 * Completes the consultation (sections 35, 38, 70 and example 9).
 *
 * ## Completion is server state, not a UI state
 *
 * Example 9's anti-pattern is "user clicks Complete, UI changes status,
 * database update happens later". So this action saves the final content and
 * transitions the record in **one** database call, returns only after the
 * database has said it worked, and the page it revalidates re-reads the row.
 * The UI cannot say completed while the database says draft.
 *
 * ## Required fields are checked three times
 *
 *   1. here, so the practitioner is told which fields are missing while they
 *      can still see them;
 *   2. in `complete_clinical_record`, so a caller that skipped this layer is
 *      refused with a sentence;
 *   3. by `clinical_records_completion_requirements`, the check constraint,
 *      which holds against any writer at all.
 *
 * The first is the only one that can point at a field. The third is the only
 * one that cannot be bypassed. Both are worth having.
 *
 * ## It also completes the appointment
 *
 * Section 73: the clinical record's completion and the appointment's must not
 * be able to disagree. `complete_clinical_record` does both in one
 * transaction, through the ordinary appointment update — so Phase 09's
 * transition trigger still decides legality and the appointment history still
 * records the change. No second appointment status system is created here
 * (section 72).
 */
export async function completeClinicalRecordAction(
  _previousState: ClinicalFormState,
  formData: FormData,
): Promise<ClinicalFormState> {
  const actor = await requireClinician("clinical_records.write");
  if ("failure" in actor) return actor.failure;

  const parsed = clinicalRecordSaveSchema.safeParse(
    readForm(formData, CLINICAL_SAVE_FIELDS),
  );

  if (!parsed.success) {
    return clinicalFormError(
      CLINICAL_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  // Section 38's completion validation, as a message beside the field rather
  // than a generic refusal. The database checks it again and the check
  // constraint checks it a third time.
  const missing = missingClinicalRequirements(
    parsed.data as unknown as ClinicalContent,
  );

  if (missing.length > 0) {
    const fieldErrors: Record<string, string> = {};
    for (const field of missing) {
      fieldErrors[field] =
        "This is needed before the consultation can be completed.";
    }

    return {
      status: "error",
      message: describeClinicalFailure({ code: "PV017" }).message,
      fieldErrors,
    };
  }

  let version: number;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "complete_clinical_record",
      toClinicalRpcArgs(parsed.data),
    );

    if (error) {
      const failure = describeClinicalFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return failure.conflict
        ? { status: "conflict", message: failure.message }
        : clinicalFormError(failure.message);
    }

    version = typeof data === "number" ? data : parsed.data.expectedVersion + 1;
  } catch (error) {
    logger.error("clinical.complete_error", error, { userId: actor.userId });
    return clinicalFormError(CLINICAL_ERRORS.generic);
  }

  logger.info("clinical.record_completed", {
    userId: actor.userId,
    recordId: parsed.data.recordId,
  });

  revalidatePath(DOCTOR_HOME);
  revalidatePath(DOCTOR_APPOINTMENTS);

  return { status: "completed", version, savedAt: Date.now() };
}
