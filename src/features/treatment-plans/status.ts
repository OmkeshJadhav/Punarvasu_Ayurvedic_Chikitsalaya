/**
 * The treatment plan lifecycle, in TypeScript.
 *
 * The same rules live in `treatment_plans_guard_update()` inside the
 * database, and that copy is the one that holds. This one exists so the
 * workspace can decide what to render, and `status.test.ts` parses the
 * migration and asserts the two agree — because the failure a divergence
 * produces is a button the product offers and the database refuses.
 */

import type { TreatmentPlanItemContent, TreatmentPlanStatus } from "./types";

export const TREATMENT_PLAN_STATUSES = [
  "draft",
  "active",
  "completed",
  "cancelled",
] as const satisfies readonly TreatmentPlanStatus[];

export const TREATMENT_PLAN_TRANSITIONS: Readonly<
  Record<TreatmentPlanStatus, readonly TreatmentPlanStatus[]>
> = {
  draft: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionTreatmentPlan(
  from: TreatmentPlanStatus,
  to: TreatmentPlanStatus,
): boolean {
  return TREATMENT_PLAN_TRANSITIONS[from].includes(to);
}

/**
 * Editable while a draft, and never again (section 44).
 *
 * An active plan is what the patient was told to do, and rewriting it would
 * rewrite what they were told. Revising means completing or withdrawing it
 * and writing a new one, which preserves the original.
 */
export function isTreatmentPlanEditable(status: TreatmentPlanStatus): boolean {
  return status === "draft";
}

export function isTreatmentPlanActivatable(
  status: TreatmentPlanStatus,
): boolean {
  return status === "draft";
}

export function isTreatmentPlanCompletable(
  status: TreatmentPlanStatus,
): boolean {
  return status === "active";
}

export function isTreatmentPlanCancellable(
  status: TreatmentPlanStatus,
): boolean {
  return status === "draft" || status === "active";
}

/**
 * The application's copy of `treatment_plans_select_patient`'s
 * `status <> 'draft'`. Nothing authorizes on it.
 */
export function isTreatmentPlanPatientVisible(
  status: TreatmentPlanStatus,
): boolean {
  return status !== "draft";
}

/** An instruction is usable when it says what it is. */
export function isUsableTreatmentPlanItem(
  item: Partial<TreatmentPlanItemContent>,
): boolean {
  return (item.title ?? "").trim().length > 0;
}

export const MAX_TREATMENT_PLAN_ITEMS = 50;

/**
 * Why this plan cannot be given to the patient yet, or `null` if it can.
 *
 * A reason rather than a boolean, so the workspace can say what is missing
 * instead of disabling a control that explains nothing.
 */
export function treatmentPlanActivationBlocker(
  status: TreatmentPlanStatus,
  title: string,
  items: readonly Partial<TreatmentPlanItemContent>[],
  dirty: boolean,
): "not_draft" | "no_title" | "no_items" | "unsaved" | null {
  if (!isTreatmentPlanActivatable(status)) return "not_draft";
  if (title.trim().length === 0) return "no_title";
  if (!items.some(isUsableTreatmentPlanItem)) return "no_items";
  // `activate_treatment_plan` carries no content, so anything unsaved would
  // be silently left out of the plan the patient is given.
  if (dirty) return "unsaved";
  return null;
}
