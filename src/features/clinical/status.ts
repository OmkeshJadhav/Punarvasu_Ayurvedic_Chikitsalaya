/**
 * The clinical record lifecycle, and what may be done at each point in it.
 *
 * ## Two rules, kept apart
 *
 *   1. **The lifecycle** — which status may follow which. `draft ->
 *      completed`, `completed -> amended`, and nothing else. Mirrors
 *      `clinical_records_guard_update()` in the migration, and
 *      `status.test.ts` asserts the two agree by reading the SQL.
 *
 *   2. **Completion requirements** — which fields a record must carry before
 *      it may leave `draft`. Section 38: a draft may be incomplete, and
 *      completion validates. Mirrors the
 *      `clinical_records_completion_requirements` check constraint, and the
 *      same test asserts that too.
 *
 * Two copies of a rule is a divergence waiting to happen, and the failure it
 * produces here is concrete and user-visible: a "Complete consultation"
 * button the workspace offers and the database then refuses. Phase 10's
 * equivalent mirror test found exactly that class of defect before it
 * shipped, which is why this file is written to be checked against the SQL
 * rather than trusted.
 *
 * ## None of this is the security boundary
 *
 * Section 24 and example 2. Deciding which button to render is a usability
 * decision. What actually refuses is `complete_clinical_record`, which
 * re-validates the required fields, and the check constraint beneath it,
 * which holds against any writer including one that skipped the function.
 */

import type { ClinicalContent, ClinicalRecordStatus } from "./types";

/** Every status the enum declares, including the one Phase 12 cannot reach. */
export const CLINICAL_RECORD_STATUSES = [
  "draft",
  "completed",
  "amended",
] as const satisfies readonly ClinicalRecordStatus[];

/**
 * The lifecycle, as a map from a status to the statuses that may follow it.
 *
 * `amended` is terminal, and so is `completed` for every workflow that exists
 * today — the only edge leaving it is the amendment path, which has no
 * surface in Phase 12.
 *
 * Nothing reopens a completed record. Section 16 and example 5: a mistake in
 * a completed medical record is corrected by an amendment that preserves what
 * was there, never by editing it back into a draft.
 */
export const CLINICAL_TRANSITIONS: Readonly<
  Record<ClinicalRecordStatus, readonly ClinicalRecordStatus[]>
> = {
  draft: ["completed"],
  completed: ["amended"],
  amended: [],
};

export function canTransitionClinicalRecord(
  from: ClinicalRecordStatus,
  to: ClinicalRecordStatus,
): boolean {
  return CLINICAL_TRANSITIONS[from].includes(to);
}

/**
 * Whether the record's clinical content may still be edited.
 *
 * Only a draft. Section 16: once completed, normal editing is restricted, and
 * a completed record must not be silently overwritten.
 *
 * This is what the form reads to decide between an editable workspace and a
 * read-only record. The database decides the same thing independently, in
 * `clinical_records_guard_update()`, which refuses an update that changes any
 * clinical field on a non-draft row.
 */
export function isClinicalRecordEditable(
  status: ClinicalRecordStatus,
): boolean {
  return status === "draft";
}

/**
 * The appointment statuses a consultation may be documented from.
 *
 * Mirrors the eligibility check in `start_consultation`, and
 * `status.test.ts` asserts the two agree by reading the SQL.
 *
 * ## Why both, and not just `checked_in`
 *
 * Because two paths reach the same place, and neither may dead-end.
 *
 * Phase 11 gave a practitioner a "Start consultation" *status action* that
 * moves `checked_in -> in_consultation` and creates nothing — which was
 * correct when there was nothing to create. It still exists, because seeing a
 * patient and writing the consultation up are genuinely separable and a
 * practitioner who moves the status from their appointment list has not done
 * anything wrong.
 *
 * So an appointment can arrive at this page already `in_consultation` with no
 * clinical record. If eligibility were `checked_in` alone, that practitioner
 * would find a page saying the consultation has not been started and no way
 * to start it. `start_consultation` accepts both statuses and creates the
 * record either way, moving the appointment only when it is actually a
 * change; this list says the same thing so the button is offered exactly when
 * the database would accept it.
 *
 * Everything else is refused: a request nobody has confirmed, a cancelled
 * appointment, a completed one and a no-show are not consultations happening
 * now (section 18).
 */
export const CONSULTATION_ELIGIBLE_APPOINTMENT_STATUSES = [
  "checked_in",
  "in_consultation",
] as const;

export function isConsultationEligible(status: string): boolean {
  return (
    CONSULTATION_ELIGIBLE_APPOINTMENT_STATUSES as readonly string[]
  ).includes(status);
}

/**
 * The fields a consultation must carry before it can be completed.
 *
 * ## Why these two, and not more
 *
 * Section 37 gives the shape of the answer — chief complaint potentially
 * required, assessment potentially required before completion, doctor notes
 * potentially optional — and then says the final requirements must come from
 * clinic workflow. The clinic has not specified any, so this takes the
 * narrowest defensible reading of section 37's own example rather than
 * inventing a mandatory template:
 *
 *   * **Chief complaint** — a consultation record that does not say what the
 *     patient came in about is not a record of anything.
 *   * **Assessment** — a consultation that reaches no clinical impression has
 *     not been concluded, and section 38's example names exactly this pair.
 *
 * The other six stay optional, including the diagnosis: not every
 * consultation produces one, and a system that demands a diagnosis is a
 * system that gets a diagnosis typed in to clear a form.
 *
 * Mirrors `clinical_records_completion_requirements` in the migration.
 */
export const CLINICAL_COMPLETION_REQUIRED_FIELDS = [
  "chiefComplaint",
  "assessment",
] as const satisfies readonly (keyof ClinicalContent)[];

export type ClinicalRequiredField =
  (typeof CLINICAL_COMPLETION_REQUIRED_FIELDS)[number];

export function isClinicalRequiredField(
  field: keyof ClinicalContent,
): field is ClinicalRequiredField {
  return (CLINICAL_COMPLETION_REQUIRED_FIELDS as readonly string[]).includes(
    field,
  );
}

/**
 * Which required fields are still blank.
 *
 * Returns the list rather than a boolean, so the form can point at the
 * specific field rather than saying "something is missing" — which is
 * section 33 and section 69's standard applied to completion: the
 * practitioner must be able to tell what happened and what to do next.
 *
 * Whitespace is not content. A field holding three spaces is blank here, is
 * blank to the database function (which normalises it to null), and is blank
 * to the check constraint (which compares `btrim(...) <> ''`). All three
 * agree, which is why a practitioner cannot complete a consultation by
 * pressing the space bar.
 */
export function missingClinicalRequirements(
  content: Partial<ClinicalContent>,
): readonly ClinicalRequiredField[] {
  return CLINICAL_COMPLETION_REQUIRED_FIELDS.filter(
    (field) => (content[field] ?? "").trim().length === 0,
  );
}

/** Whether the content satisfies everything completion needs. */
export function canCompleteClinicalRecord(
  status: ClinicalRecordStatus,
  content: Partial<ClinicalContent>,
): boolean {
  return (
    isClinicalRecordEditable(status) &&
    missingClinicalRequirements(content).length === 0
  );
}
