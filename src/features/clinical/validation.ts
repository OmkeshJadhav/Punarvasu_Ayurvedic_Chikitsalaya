/**
 * Clinical record input validation.
 *
 * One set of schemas, run by the browser for feedback and by the server for
 * authority. Client validation is never the security control
 * (`docs/SECURITY.md` section 9, `phase_12.md` section 36).
 *
 * ## What these schemas have no field for
 *
 * `patientId`, `practitionerId`, `doctorId`, `appointmentId` on a save,
 * `status`, `role`, `permission`, `completedAt`, `createdBy`, and every
 * prescription, medication and document field name. Section 85's
 * payload-manipulation list, one item at a time.
 *
 * They are not stripped — they are **absent**, every object is `strict()`,
 * and a request carrying one is *rejected*. A rejected request shows up in a
 * log; a quietly dropped field is how a trusted value starts being read from
 * the request two phases later.
 *
 * Even if one slipped through it would have nowhere to go. The RPCs take a
 * record id, a version and eight text fields; the patient and the
 * practitioner are read out of the appointment inside the database, and the
 * status is set by the function.
 *
 * ## Why a record id and a version *are* accepted
 *
 * The record id says *which* record; it never says whether the caller may
 * touch one. Every function resolves it by id **and** by the caller's own
 * practitioner record, so a well-formed id for somebody else's consultation
 * is indistinguishable from one that never existed (section 57).
 *
 * The version says *which revision I edited*. It is a concurrency control
 * (section 34): a stale one loses the write, and a correct one for a record
 * the caller may not touch still reaches no row. Neither can widen access.
 *
 * ## Why the bounds are here as well as in the database
 *
 * Section 36 asks for length limits and a bounded payload, and the check
 * constraints enforce them. These exist so the practitioner is told which
 * field is too long while they can still see it, rather than losing a
 * submission to a constraint violation. The numbers are the same in both
 * places, and `validation.test.ts` asserts that by reading the migration.
 */

import { z } from "zod";

import { uuidSchema } from "@/lib/validation/schemas";

import type { ClinicalContent } from "./types";

/**
 * How long each clinical field may be.
 *
 * Mirrors the `clinical_records_*_length` check constraints. Generous, because
 * a practitioner writing a history should never be counting characters — and
 * bounded, because an unbounded text column reachable from a form is a way to
 * fill a database.
 */
export const CLINICAL_FIELD_LIMITS = {
  chiefComplaint: 500,
  historyOfPresentingConcern: 4000,
  symptoms: 4000,
  clinicalObservations: 4000,
  assessment: 4000,
  diagnosisOrClinicalImpression: 2000,
  doctorNotes: 8000,
  followUpNotes: 2000,
} as const satisfies Record<keyof ClinicalContent, number>;

/**
 * One clinical field.
 *
 * Optional and defaulted to the empty string, because a draft may be
 * incomplete (section 15) and because a textarea that was never touched posts
 * an empty string rather than nothing. Trimmed, so trailing whitespace never
 * becomes the difference between a field that counts as filled and one that
 * does not — the database normalises the same way.
 *
 * There is no character-class restriction and no sanitisation. Clinical text
 * is prose: it legitimately contains apostrophes, angle brackets in
 * measurements, slashes in dosing shorthand and percent signs. Rejecting them
 * would make the field unusable for its purpose. What protects against
 * injection is that nothing here is ever interpolated into SQL (it is an RPC
 * parameter) or rendered as HTML (React escapes it, and this feature uses no
 * `dangerouslySetInnerHTML` — asserted by test).
 */
function clinicalField(limit: number, label: string) {
  return z
    .string()
    .trim()
    .max(limit, {
      message: `${label} is limited to ${limit.toLocaleString("en-IN")} characters.`,
    })
    .default("");
}

/** The eight fields, as a reusable shape. */
const CLINICAL_CONTENT_SHAPE = {
  chiefComplaint: clinicalField(
    CLINICAL_FIELD_LIMITS.chiefComplaint,
    "The chief complaint",
  ),
  historyOfPresentingConcern: clinicalField(
    CLINICAL_FIELD_LIMITS.historyOfPresentingConcern,
    "The history",
  ),
  symptoms: clinicalField(CLINICAL_FIELD_LIMITS.symptoms, "Symptoms"),
  clinicalObservations: clinicalField(
    CLINICAL_FIELD_LIMITS.clinicalObservations,
    "Observations",
  ),
  assessment: clinicalField(CLINICAL_FIELD_LIMITS.assessment, "The assessment"),
  diagnosisOrClinicalImpression: clinicalField(
    CLINICAL_FIELD_LIMITS.diagnosisOrClinicalImpression,
    "The clinical impression",
  ),
  doctorNotes: clinicalField(CLINICAL_FIELD_LIMITS.doctorNotes, "Notes"),
  followUpNotes: clinicalField(
    CLINICAL_FIELD_LIMITS.followUpNotes,
    "The follow-up plan",
  ),
} as const;

/**
 * The version the caller believes it is editing.
 *
 * A positive integer, matching `clinical_records_version_positive`. It
 * arrives from a hidden field, which is safe for the reason given in the
 * header: it selects a revision, never a permission.
 */
const versionSchema = z.coerce
  .number()
  .int({ message: "Not a valid revision." })
  .min(1, { message: "Not a valid revision." })
  .max(Number.MAX_SAFE_INTEGER);

/**
 * Starting a consultation.
 *
 * One field. The patient and the practitioner are **not** parameters — they
 * are derived from the appointment inside `start_consultation`, which
 * resolved that appointment by the caller's own practitioner record. Example
 * 3's `doctorId` and example 4's `patientId` have nowhere to arrive.
 */
export const startConsultationSchema = z
  .object({ appointmentId: uuidSchema })
  .strict();

export type StartConsultationInput = z.infer<typeof startConsultationSchema>;

/**
 * Saving a draft (section 33), and completing a consultation (section 35).
 *
 * The **same** schema for both, deliberately. The two operations carry
 * identical content and differ only in what the server does with it, and a
 * separate "completion schema" with required fields would put the completion
 * rule in a second place — where it could disagree with `status.ts`, with
 * `complete_clinical_record` and with the check constraint.
 *
 * So completion requirements are checked once, by
 * `missingClinicalRequirements`, and enforced twice more in the database.
 * Section 38's draft/completion distinction is a *workflow* distinction, not
 * a schema one.
 */
export const clinicalRecordSaveSchema = z
  .object({
    recordId: uuidSchema,
    expectedVersion: versionSchema,
    ...CLINICAL_CONTENT_SHAPE,
  })
  .strict();

export type ClinicalRecordSaveInput = z.infer<typeof clinicalRecordSaveSchema>;

/**
 * The fields the save form is allowed to carry, as a fixed list.
 *
 * The first allowlist gate, before the schema: the action reads exactly these
 * names out of the `FormData` and never iterates what was posted. A form
 * field nobody declared is not read at all, and then `strict()` rejects the
 * object if one arrives through some other path.
 */
export const CLINICAL_SAVE_FIELDS = [
  "recordId",
  "expectedVersion",
  "chiefComplaint",
  "historyOfPresentingConcern",
  "symptoms",
  "clinicalObservations",
  "assessment",
  "diagnosisOrClinicalImpression",
  "doctorNotes",
  "followUpNotes",
] as const;

/** Looking at one clinical record. */
export const clinicalRecordIdSchema = z
  .object({ recordId: uuidSchema })
  .strict();
