/**
 * The treatment plan trust boundary.
 *
 * Every schema is `strict()`, so an unexpected key is **rejected rather than
 * dropped**. There is no field anywhere in this module for `patientId`,
 * `practitionerId`, `doctorId`, `appointmentId`, `status`, `activatedAt`,
 * `role` or `permission`, and `validation.test.ts` asserts that one hostile
 * field at a time.
 *
 * `clinicalRecordId` appears in exactly one schema — creation — because it is
 * the one identifier the doctor genuinely chooses: which of their own
 * consultations this plan belongs to. It is validated against
 * `public.clinical_records` inside the database and resolved by the caller's
 * own practitioner record in the same statement.
 *
 * The limits mirror the migration's check constraints, and the test reads the
 * SQL to prove it: a client bound looser than the database's is a save that
 * fails for a reason the practitioner was never shown.
 */

import { z } from "zod";
import { clinicDateSchema } from "@/features/appointments/validation";
import { uuidSchema } from "@/lib/validation/schemas";
import { MAX_TREATMENT_PLAN_ITEMS } from "./status";
import { TREATMENT_PLAN_CATEGORIES } from "./types";

export const TREATMENT_PLAN_FIELD_LIMITS = {
  title: 160,
  summary: 2000,
  itemTitle: 160,
  itemInstructions: 2000,
  itemFrequency: 120,
  itemDuration: 120,
} as const;

function boundedText(limit: number, label: string) {
  return z
    .string()
    .trim()
    .max(limit, {
      message: `${label} is limited to ${limit.toLocaleString("en-IN")} characters.`,
    })
    .default("");
}

const versionSchema = z.coerce
  .number()
  .int({ message: "Not a valid revision." })
  .min(1, { message: "Not a valid revision." })
  .max(Number.MAX_SAFE_INTEGER);

/**
 * An optional calendar day.
 *
 * A date, not an instant: "start on 2 October" means the same thing wherever
 * the practitioner and the patient happen to be, and storing it as a
 * timestamp would make it drift across a timezone boundary.
 */
const optionalDateSchema = z
  .union([z.literal(""), clinicDateSchema])
  .default("");

export const treatmentPlanItemSchema = z
  .object({
    category: z.enum(TREATMENT_PLAN_CATEGORIES, {
      message: "Choose a section for this instruction.",
    }),
    title: z
      .string()
      .trim()
      .min(1, { message: "Every instruction needs a heading." })
      .max(TREATMENT_PLAN_FIELD_LIMITS.itemTitle, {
        message: `The heading is limited to ${TREATMENT_PLAN_FIELD_LIMITS.itemTitle} characters.`,
      }),
    instructions: boundedText(
      TREATMENT_PLAN_FIELD_LIMITS.itemInstructions,
      "The instructions",
    ),
    frequency: boundedText(
      TREATMENT_PLAN_FIELD_LIMITS.itemFrequency,
      "The frequency",
    ),
    duration: boundedText(
      TREATMENT_PLAN_FIELD_LIMITS.itemDuration,
      "The duration",
    ),
  })
  .strict();

export type TreatmentPlanItemInput = z.infer<typeof treatmentPlanItemSchema>;

/**
 * An instruction with nothing in it but its default category.
 *
 * The builder keeps an empty card at the end so "add another" is one click,
 * and that card must not become an error the practitioner has to clear. A
 * card with a heading missing but something else filled in is a different
 * matter: it errors rather than silently disappearing.
 */
export function isBlankTreatmentPlanItem(item: {
  readonly title?: string;
  readonly instructions?: string;
  readonly frequency?: string;
  readonly duration?: string;
}): boolean {
  return [item.title, item.instructions, item.frequency, item.duration].every(
    (value) => typeof value !== "string" || value.trim() === "",
  );
}

export function dropBlankTreatmentPlanItems<
  T extends {
    readonly title?: string;
    readonly instructions?: string;
    readonly frequency?: string;
    readonly duration?: string;
  },
>(items: readonly T[]): T[] {
  return items.filter((item) => !isBlankTreatmentPlanItem(item));
}

function parseJsonArray(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

const itemsSchema = z.preprocess(
  parseJsonArray,
  z
    .array(treatmentPlanItemSchema)
    .max(MAX_TREATMENT_PLAN_ITEMS, {
      message: `A treatment plan can hold at most ${MAX_TREATMENT_PLAN_ITEMS} instructions.`,
    })
    .default([]),
);

export const createTreatmentPlanSchema = z
  .object({ clinicalRecordId: uuidSchema })
  .strict();

export const treatmentPlanSaveSchema = z
  .object({
    treatmentPlanId: uuidSchema,
    expectedVersion: versionSchema,
    title: boundedText(TREATMENT_PLAN_FIELD_LIMITS.title, "The title"),
    summary: boundedText(TREATMENT_PLAN_FIELD_LIMITS.summary, "The summary"),
    startDate: optionalDateSchema,
    followUpOn: optionalDateSchema,
    items: itemsSchema,
  })
  .strict();

export type TreatmentPlanSaveInput = z.infer<typeof treatmentPlanSaveSchema>;

export const TREATMENT_PLAN_SAVE_FIELDS = [
  "treatmentPlanId",
  "expectedVersion",
  "title",
  "summary",
  "startDate",
  "followUpOn",
  "items",
] as const;

/**
 * Activating, completing and withdrawing.
 *
 * One schema for all three, because all three say exactly the same thing: an
 * id and the revision the practitioner was looking at. **No status**, because
 * each transition is its own server action calling its own database function
 * — so there is no status parameter in this feature to manipulate.
 */
export const treatmentPlanTransitionSchema = z
  .object({
    treatmentPlanId: uuidSchema,
    expectedVersion: versionSchema,
  })
  .strict();

export const TREATMENT_PLAN_TRANSITION_FIELDS = [
  "treatmentPlanId",
  "expectedVersion",
] as const;
