"use server";

import { revalidatePath } from "next/cache";
import type { Permission } from "@/config/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scheduleNotificationDispatch } from "@/features/notifications/dispatch";
import { TREATMENT_PLAN_ERRORS } from "./content";
import { describeTreatmentPlanFailure } from "./errors";
import { treatmentPlanFormError, type TreatmentPlanFormState } from "./types";
import {
  createTreatmentPlanSchema,
  TREATMENT_PLAN_SAVE_FIELDS,
  TREATMENT_PLAN_TRANSITION_FIELDS,
  treatmentPlanSaveSchema,
  treatmentPlanTransitionSchema,
} from "./validation";

/**
 * The five treatment plan writes.
 *
 * Same sequence as every other write in this project — authenticate,
 * authorize, validate, call a `security definer` function that re-checks the
 * role and resolves the row by id *and* by the caller's own practitioner
 * record, then row-level security.
 *
 * **No patient id, no practitioner id, no appointment id and no status
 * reaches any RPC below.** The first three are derived from the clinical
 * record inside the database; the fourth does not exist because activating,
 * completing and withdrawing are three functions rather than one status
 * parameter.
 *
 * **Nothing clinical is ever logged** (section 83): no title, no instruction,
 * no summary, no follow-up date, no patient name. A log line carries the
 * operation, the actor's opaque id and the plan's opaque id.
 *
 * **No appointment is ever created here** (section 47). A follow-up date is a
 * note to the patient; booking stays with the appointment engine and the
 * front desk, where somebody can tell the patient.
 */

const DOCTOR_APPOINTMENTS = "/doctor/appointments";
const DOCTOR_PATIENTS = "/doctor/patients";
const PATIENT_TREATMENT_PLANS = "/patient/treatment-plans";

function readForm(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of fields) {
    const value = formData.get(name);
    values[name] = typeof value === "string" ? value : "";
  }
  return values;
}

async function requirePlanner(
  permission: Permission,
): Promise<
  { readonly userId: string } | { readonly failure: TreatmentPlanFormState }
> {
  const user = await getCurrentUser();

  if (!user) {
    logger.warn("treatment_plan.write_unauthenticated");
    return {
      failure: treatmentPlanFormError(TREATMENT_PLAN_ERRORS.sessionEnded),
    };
  }

  if (!can(user.role, permission)) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission,
    });
    return { failure: treatmentPlanFormError(TREATMENT_PLAN_ERRORS.forbidden) };
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

function revalidateWorkspaces(): void {
  revalidatePath(DOCTOR_APPOINTMENTS, "layout");
  revalidatePath(DOCTOR_PATIENTS, "layout");
  revalidatePath(PATIENT_TREATMENT_PLANS, "layout");
}

const CREATE_FIELDS = ["clinicalRecordId"] as const;

export async function createTreatmentPlanAction(
  _previousState: TreatmentPlanFormState,
  formData: FormData,
): Promise<TreatmentPlanFormState> {
  const actor = await requirePlanner("treatment_plans.write");
  if ("failure" in actor) return actor.failure;

  const parsed = createTreatmentPlanSchema.safeParse(
    readForm(formData, CREATE_FIELDS),
  );

  if (!parsed.success) {
    return treatmentPlanFormError(
      TREATMENT_PLAN_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("create_treatment_plan", {
      p_clinical_record_id: parsed.data.clinicalRecordId,
    });

    if (error) {
      const failure = describeTreatmentPlanFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return treatmentPlanFormError(failure.message);
    }
  } catch (error) {
    logger.error("treatment_plan.create_error", error, {
      userId: actor.userId,
    });
    return treatmentPlanFormError(TREATMENT_PLAN_ERRORS.generic);
  }

  logger.info("treatment_plan.created", { userId: actor.userId });
  revalidatePath(DOCTOR_APPOINTMENTS, "layout");

  return { status: "saved" };
}

export async function saveTreatmentPlanDraftAction(
  _previousState: TreatmentPlanFormState,
  formData: FormData,
): Promise<TreatmentPlanFormState> {
  const actor = await requirePlanner("treatment_plans.write");
  if ("failure" in actor) return actor.failure;

  const parsed = treatmentPlanSaveSchema.safeParse(
    readForm(formData, TREATMENT_PLAN_SAVE_FIELDS),
  );

  if (!parsed.success) {
    const fieldErrors = toFieldErrors(parsed.error.issues);
    return treatmentPlanFormError(
      fieldErrors.items ?? TREATMENT_PLAN_ERRORS.generic,
      fieldErrors,
    );
  }

  let version: number;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("save_treatment_plan_draft", {
      p_treatment_plan_id: parsed.data.treatmentPlanId,
      p_expected_version: parsed.data.expectedVersion,
      p_title: parsed.data.title,
      p_summary: parsed.data.summary,
      // An empty date field is an absent date, not the epoch.
      p_start_date: parsed.data.startDate === "" ? null : parsed.data.startDate,
      p_follow_up_on:
        parsed.data.followUpOn === "" ? null : parsed.data.followUpOn,
      p_items: parsed.data.items,
    });

    if (error) {
      const failure = describeTreatmentPlanFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return failure.conflict
        ? { status: "conflict", message: failure.message }
        : treatmentPlanFormError(failure.message);
    }

    version = typeof data === "number" ? data : parsed.data.expectedVersion + 1;
  } catch (error) {
    logger.error("treatment_plan.save_error", error, { userId: actor.userId });
    return treatmentPlanFormError(TREATMENT_PLAN_ERRORS.generic);
  }

  logger.info("treatment_plan.draft_saved", {
    userId: actor.userId,
    treatmentPlanId: parsed.data.treatmentPlanId,
  });

  return { status: "saved", version, savedAt: Date.now() };
}

/**
 * One helper for the three transitions.
 *
 * They differ only in which database function they call and which word the
 * form shows afterwards. Sharing the shape is what keeps the authorization,
 * the validation, the conflict handling and the logging identical across all
 * three — and none of them sends a status.
 */
async function transition(
  formData: FormData,
  rpc:
    | "activate_treatment_plan"
    | "complete_treatment_plan"
    | "cancel_treatment_plan",
  outcome: "activated" | "completed" | "cancelled",
  logEvent: string,
): Promise<TreatmentPlanFormState> {
  const actor = await requirePlanner("treatment_plans.write");
  if ("failure" in actor) return actor.failure;

  const parsed = treatmentPlanTransitionSchema.safeParse(
    readForm(formData, TREATMENT_PLAN_TRANSITION_FIELDS),
  );

  if (!parsed.success) {
    return treatmentPlanFormError(
      TREATMENT_PLAN_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  let version: number;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(rpc, {
      p_treatment_plan_id: parsed.data.treatmentPlanId,
      p_expected_version: parsed.data.expectedVersion,
    });

    if (error) {
      const failure = describeTreatmentPlanFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return failure.conflict
        ? { status: "conflict", message: failure.message }
        : treatmentPlanFormError(failure.message);
    }

    version = typeof data === "number" ? data : parsed.data.expectedVersion + 1;
  } catch (error) {
    logger.error("treatment_plan.transition_error", error, {
      userId: actor.userId,
    });
    return treatmentPlanFormError(TREATMENT_PLAN_ERRORS.generic);
  }

  logger.info(logEvent, {
    userId: actor.userId,
    treatmentPlanId: parsed.data.treatmentPlanId,
  });

  // Phase 15. Drains the notification outbox once this response has been
  // sent. The event itself was already written, by a trigger, inside the
  // transaction above; this only decides how soon somebody sees it, and it
  // cannot delay or fail the operation that has just succeeded.
  scheduleNotificationDispatch();

  revalidateWorkspaces();

  return { status: outcome, version, savedAt: Date.now() };
}

/** The only path to `active`, and therefore the only path to patient visibility. */
export async function activateTreatmentPlanAction(
  _previousState: TreatmentPlanFormState,
  formData: FormData,
): Promise<TreatmentPlanFormState> {
  return transition(
    formData,
    "activate_treatment_plan",
    "activated",
    "treatment_plan.activated",
  );
}

export async function completeTreatmentPlanAction(
  _previousState: TreatmentPlanFormState,
  formData: FormData,
): Promise<TreatmentPlanFormState> {
  return transition(
    formData,
    "complete_treatment_plan",
    "completed",
    "treatment_plan.completed",
  );
}

export async function cancelTreatmentPlanAction(
  _previousState: TreatmentPlanFormState,
  formData: FormData,
): Promise<TreatmentPlanFormState> {
  return transition(
    formData,
    "cancel_treatment_plan",
    "cancelled",
    "treatment_plan.cancelled",
  );
}
