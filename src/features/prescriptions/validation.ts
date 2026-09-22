/**
 * The prescription trust boundary.
 *
 * ## What these schemas refuse
 *
 * Every one is `strict()`, so an unexpected key is **rejected rather than
 * dropped**. A rejected request is visible in a log; a dropped field is how a
 * `patientId` or a `status` arrives by accident and nobody notices.
 *
 * There is no field anywhere in this module for `patientId`,
 * `practitionerId`, `doctorId`, `appointmentId`, `clinicalRecordId` (except
 * on creation, where it is the one thing the doctor genuinely chooses),
 * `status`, `issuedAt`, `role` or `permission`. `validation.test.ts` asserts
 * that one hostile field at a time, and also asserts that this module's own
 * source never names most of them at all.
 *
 * ## What these schemas deliberately do not refuse
 *
 * Section 49: the application must not try to be medically authoritative
 * through arbitrary validation. There is no rule here that a dose must be
 * numeric, that a frequency must come from a list, that a duration must be
 * under some number of weeks, or that two medicines may not appear together.
 * The clinic has supplied no verified catalog and no dosing conventions, and
 * inventing one would be the application pretending to replace a clinician's
 * judgement.
 *
 * What is validated is data integrity: shape, length, required relationships
 * and the one field without which a line is not an instruction at all.
 *
 * ## Why the limits are duplicated
 *
 * `PRESCRIPTION_FIELD_LIMITS` mirrors the check constraints in the migration
 * so the form can bound a textarea and name the limit before a round trip.
 * `validation.test.ts` reads the migration and asserts the two agree — a
 * client bound looser than the database's is a save that fails for a reason
 * the doctor was never shown.
 */

import { z } from "zod";
import { uuidSchema } from "@/lib/validation/schemas";
import { MAX_PRESCRIPTION_ITEMS } from "./status";
import type { PrescriptionItemContent } from "./types";

export const PRESCRIPTION_FIELD_LIMITS = {
  medicineName: 160,
  form: 80,
  strength: 80,
  doseAmount: 60,
  doseUnit: 60,
  frequency: 120,
  timing: 120,
  duration: 120,
  quantity: 60,
  quantityUnit: 60,
  instructions: 1000,
} as const satisfies Record<keyof PrescriptionItemContent, number>;

export const GENERAL_INSTRUCTIONS_LIMIT = 2000;
export const CANCELLATION_REASON_LIMIT = 300;

function boundedText(limit: number, label: string) {
  return z
    .string()
    .trim()
    .max(limit, {
      message: `${label} is limited to ${limit.toLocaleString("en-IN")} characters.`,
    })
    .default("");
}

function requiredText(limit: number, label: string, missing: string) {
  return z
    .string()
    .trim()
    .min(1, { message: missing })
    .max(limit, {
      message: `${label} is limited to ${limit.toLocaleString("en-IN")} characters.`,
    });
}

/**
 * The revision the caller was editing.
 *
 * A concurrency token, never an authorization input — sending a different one
 * loses the write, and sending the right one for somebody else's prescription
 * still reaches no row.
 */
const versionSchema = z.coerce
  .number()
  .int({ message: "Not a valid revision." })
  .min(1, { message: "Not a valid revision." })
  .max(Number.MAX_SAFE_INTEGER);

export const prescriptionItemSchema = z
  .object({
    medicineName: requiredText(
      PRESCRIPTION_FIELD_LIMITS.medicineName,
      "The medicine or remedy",
      "Every line needs a medicine or remedy.",
    ),
    form: boundedText(PRESCRIPTION_FIELD_LIMITS.form, "The form"),
    strength: boundedText(PRESCRIPTION_FIELD_LIMITS.strength, "The strength"),
    doseAmount: boundedText(PRESCRIPTION_FIELD_LIMITS.doseAmount, "The dose"),
    doseUnit: boundedText(PRESCRIPTION_FIELD_LIMITS.doseUnit, "The dose unit"),
    frequency: boundedText(
      PRESCRIPTION_FIELD_LIMITS.frequency,
      "The frequency",
    ),
    timing: boundedText(PRESCRIPTION_FIELD_LIMITS.timing, "The timing"),
    duration: boundedText(PRESCRIPTION_FIELD_LIMITS.duration, "The duration"),
    quantity: boundedText(PRESCRIPTION_FIELD_LIMITS.quantity, "The quantity"),
    quantityUnit: boundedText(
      PRESCRIPTION_FIELD_LIMITS.quantityUnit,
      "The quantity unit",
    ),
    instructions: boundedText(
      PRESCRIPTION_FIELD_LIMITS.instructions,
      "The instructions",
    ),
  })
  .strict();

export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;

/**
 * An item with nothing in it at all.
 *
 * The builder keeps an empty card at the end so "add another" is one click,
 * and that card must not become a validation error the doctor has to clear
 * before saving. A card with *something* in it is a different matter: it is
 * dropped by nothing and must name a medicine, so a half-filled line produces
 * an error rather than silently disappearing.
 */
export function isBlankPrescriptionItem(
  item: Partial<PrescriptionItemContent>,
): boolean {
  return Object.values(item).every(
    (value) => typeof value !== "string" || value.trim() === "",
  );
}

export function dropBlankPrescriptionItems<
  T extends Partial<PrescriptionItemContent>,
>(items: readonly T[]): T[] {
  return items.filter((item) => !isBlankPrescriptionItem(item));
}

/**
 * The items travel as one JSON array in a hidden field.
 *
 * The alternative — eleven parallel indexed form fields per row — is the same
 * data with more ways to get out of step. What matters is that the payload is
 * parsed into an allowlist on both sides: `prescriptionItemSchema` is
 * `strict()` here, and `save_prescription_draft` extracts the eleven keys
 * explicitly in SQL rather than populating a record, so an unexpected key
 * reaches no column either way.
 */
function parseJsonArray(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    // Not an array, so the array schema refuses it and the action maps that
    // to safe copy. Returning the raw string rather than throwing keeps the
    // failure inside Zod's reporting.
    return trimmed;
  }
}

const itemsSchema = z.preprocess(
  parseJsonArray,
  z
    .array(prescriptionItemSchema)
    .max(MAX_PRESCRIPTION_ITEMS, {
      message: `A prescription can hold at most ${MAX_PRESCRIPTION_ITEMS} medicines or remedies.`,
    })
    .default([]),
);

/**
 * Creating a prescription.
 *
 * One field, and it is the one identifier the doctor genuinely chooses: which
 * of their own consultations this prescription belongs to. It is *data*,
 * validated against `public.clinical_records` inside the database and
 * resolved by the caller's own practitioner record in the same statement —
 * the same argument Phase 10 made for a receptionist's `patientId`. It says
 * *which*; `auth.uid()` and the role say *whether*.
 */
export const createPrescriptionSchema = z
  .object({ clinicalRecordId: uuidSchema })
  .strict();

export const prescriptionSaveSchema = z
  .object({
    prescriptionId: uuidSchema,
    expectedVersion: versionSchema,
    generalInstructions: boundedText(
      GENERAL_INSTRUCTIONS_LIMIT,
      "The instructions",
    ),
    items: itemsSchema,
  })
  .strict();

export type PrescriptionSaveInput = z.infer<typeof prescriptionSaveSchema>;

export const PRESCRIPTION_SAVE_FIELDS = [
  "prescriptionId",
  "expectedVersion",
  "generalInstructions",
  "items",
] as const;

/**
 * Issuing.
 *
 * **No content.** The doctor reviews what is saved and issues exactly that,
 * so there is nothing here for the act of issuing to change (sections 15, 16
 * and example 3).
 */
export const prescriptionIssueSchema = z
  .object({
    prescriptionId: uuidSchema,
    expectedVersion: versionSchema,
  })
  .strict();

export const PRESCRIPTION_ISSUE_FIELDS = [
  "prescriptionId",
  "expectedVersion",
] as const;

export const prescriptionCancelSchema = z
  .object({
    prescriptionId: uuidSchema,
    expectedVersion: versionSchema,
    reason: boundedText(CANCELLATION_REASON_LIMIT, "The reason"),
  })
  .strict();

export const PRESCRIPTION_CANCEL_FIELDS = [
  "prescriptionId",
  "expectedVersion",
  "reason",
] as const;

/**
 * The medicine suggestion query (section 65).
 *
 * It carries a term and nothing else — no result count, no scope, no patient.
 * The database clamps its own limit and restricts the search to the calling
 * practitioner's own prescribing history, so there is no parameter here that
 * could widen either.
 */
export const medicineSuggestionSchema = z
  .object({
    query: z.string().trim().max(PRESCRIPTION_FIELD_LIMITS.medicineName),
  })
  .strict();

export type MedicineSuggestionQuery = z.infer<typeof medicineSuggestionSchema>;
