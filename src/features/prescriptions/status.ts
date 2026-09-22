/**
 * The prescription lifecycle, in TypeScript.
 *
 * ## Why this exists twice
 *
 * The same rules live in `prescriptions_guard_update()` inside the database,
 * and that copy is the one that actually holds. This one exists so the UI can
 * decide what to render: whether to show a form or prose, whether to offer
 * "Issue prescription", whether to offer "Withdraw".
 *
 * Two copies of a rule is a divergence waiting to happen, and the failure it
 * produces here is specific and user-visible: a button the workspace offers
 * and the database then refuses. So `status.test.ts` **parses the migration**
 * and asserts that every statement below agrees with it. A test that restated
 * the SQL would agree with a wrong migration; this one reads it.
 */

import type { PrescriptionItemContent, PrescriptionStatus } from "./types";

export const PRESCRIPTION_STATUSES = [
  "draft",
  "issued",
  "cancelled",
  "amended",
] as const satisfies readonly PrescriptionStatus[];

/**
 * Which transitions the database permits.
 *
 * `draft -> cancelled` is here because deciding not to prescribe after all is
 * a legitimate clinical outcome, and section 99 prefers a status change to a
 * delete even for a draft.
 *
 * `issued -> amended` is permitted by the trigger and reachable by nothing:
 * no function sets `amended`, and a test asserts that. Until the formal
 * amendment workflow exists, correcting an issued prescription means
 * cancelling it — which preserves it — and writing a fresh one.
 */
export const PRESCRIPTION_TRANSITIONS: Readonly<
  Record<PrescriptionStatus, readonly PrescriptionStatus[]>
> = {
  draft: ["issued", "cancelled"],
  issued: ["cancelled", "amended"],
  cancelled: [],
  amended: [],
};

export function canTransitionPrescription(
  from: PrescriptionStatus,
  to: PrescriptionStatus,
): boolean {
  return PRESCRIPTION_TRANSITIONS[from].includes(to);
}

/**
 * A prescription is editable only while it is a draft (sections 42 and 74).
 *
 * Hiding the form once it is issued is a usability decision. What makes
 * "issued prescriptions are not silently overwritten" true is
 * `prescriptions_guard_update()` refusing a content change and
 * `prescription_items_guard_write()` refusing any item write beneath it.
 */
export function isPrescriptionEditable(status: PrescriptionStatus): boolean {
  return status === "draft";
}

/** Whether the doctor may still withdraw it. */
export function isPrescriptionCancellable(status: PrescriptionStatus): boolean {
  return status === "draft" || status === "issued";
}

/**
 * Whether the patient may see it — the application's copy of
 * `prescriptions_select_patient`'s `status <> 'draft'`.
 *
 * Nothing authorizes on this: the query is scoped by the session and the
 * policy scopes it again. It exists so a page can say "this is not visible to
 * the patient yet" while the doctor is still writing.
 */
export function isPrescriptionPatientVisible(
  status: PrescriptionStatus,
): boolean {
  return status !== "draft";
}

/**
 * An item is usable when it names something.
 *
 * Section 49 is explicit that the application must not try to be medically
 * authoritative through arbitrary validation: no rule here says a dose must
 * be a number, or that a frequency must come from a list, or that a duration
 * must be under a month. The one requirement is that a line of a prescription
 * says *what* is being prescribed, because a line that does not is not an
 * instruction at all.
 */
export function isUsablePrescriptionItem(
  item: Partial<PrescriptionItemContent>,
): boolean {
  return (item.medicineName ?? "").trim().length > 0;
}

/** The most items one prescription may carry. Mirrored by the database. */
export const MAX_PRESCRIPTION_ITEMS = 50;

/**
 * Why this prescription cannot be issued yet, or `null` if it can.
 *
 * Returns a reason rather than a boolean so the workspace can say what is
 * missing instead of disabling a control that explains nothing.
 */
export function prescriptionIssueBlocker(
  status: PrescriptionStatus,
  items: readonly Partial<PrescriptionItemContent>[],
  dirty: boolean,
): "not_draft" | "no_items" | "unsaved" | null {
  if (!isPrescriptionEditable(status)) return "not_draft";
  if (!items.some(isUsablePrescriptionItem)) return "no_items";
  // Section 16 and example 3: the review must show what will actually be
  // issued. `issue_prescription` takes no content, so issuing sends only an
  // id and a revision — which means anything unsaved would be silently left
  // out. Refusing until the draft is saved is what keeps the review honest.
  if (dirty) return "unsaved";
  return null;
}
