/**
 * Patient profile input validation.
 *
 * One schema, used on both sides of the trust boundary: the browser runs it
 * for immediate feedback and the server action runs the same schema before
 * anything reaches Supabase. Client validation is never the security control
 * (`docs/SECURITY.md` section 9) — it is here so the two cannot disagree about
 * what a valid date of birth is.
 *
 * ## The two rules that matter most
 *
 * **Nothing clinical.** There is no field for symptoms, diagnosis,
 * medications, allergies, medical history, previous treatments, lab reports or
 * prescriptions (`phase_07.md` sections 8 and 77). The schema is `strict`, so
 * a request carrying one is rejected outright rather than having it silently
 * dropped — a rejected request is visible in a log; a silently dropped field
 * is how a clinical column arrives by accident later.
 *
 * **Nothing protected.** `id`, `profileId`, `userId`, `role`, `createdAt` and
 * `updatedAt` are not in the schema, so `strict` rejects them too. The server
 * never reads an identifier from the form; it uses the authenticated session
 * (sections 11, 49-51).
 */

import { z } from "zod";

import { phoneSchema, requiredText } from "@/lib/validation/schemas";

import { PATIENT_GENDERS } from "./types";

export const FULL_NAME_MAX_LENGTH = 120;
export const PREFERRED_NAME_MAX_LENGTH = 60;
export const ADDRESS_LINE_MAX_LENGTH = 120;
export const CITY_MAX_LENGTH = 80;
export const STATE_MAX_LENGTH = 80;
export const POSTAL_CODE_MIN_LENGTH = 3;
export const POSTAL_CODE_MAX_LENGTH = 12;
export const RELATIONSHIP_MAX_LENGTH = 60;
export const LANGUAGE_MAX_LENGTH = 60;

/**
 * The earliest date of birth the form will accept.
 *
 * A lower bound rather than a maximum age: refusing to register a 112-year-old
 * would be a worse failure than accepting an implausible one, and the oldest
 * verified human lifespan is comfortably inside this.
 */
export const EARLIEST_DATE_OF_BIRTH = "1900-01-01";

/**
 * Turns an untouched field into an absent one.
 *
 * An HTML form posts every control it contains, so an optional field arrives
 * as `""` rather than not arriving. Without this, "optional" would mean
 * "optional until you click into it", and clearing a field would store an
 * empty string where a null belongs.
 *
 * `preprocess` rather than a `transform`-then-`pipe` chain, so the wrapped
 * schema keeps its own input type instead of being handed `unknown`.
 */
function optionalText<TSchema extends z.ZodType<string, string>>(
  schema: TSchema,
) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, schema.optional());
}

function boundedText(maxLength: number, label: string) {
  return z.string().max(maxLength, {
    message: `${label} must be ${maxLength} characters or fewer.`,
  });
}

/**
 * A calendar date of birth.
 *
 * Three separate checks, each with its own message, because "please enter a
 * valid date" tells somebody who typed next year's date nothing they can act
 * on.
 *
 * The comparison is made on the ISO string, not on `Date` objects. Parsing
 * `"2026-09-18"` with `new Date()` yields midnight **UTC**, so comparing it
 * against a local `new Date()` puts the boundary hours away from local
 * midnight — the timezone mistake `phase_07.md` section 27 warns about. ISO
 * calendar dates sort lexicographically, so a string comparison is both
 * simpler and correct.
 */
export const dateOfBirthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Enter a date of birth as a day, month and year.",
  })
  .refine((value) => isRealCalendarDate(value), {
    message: "That date doesn't exist. Please check the day and month.",
  })
  .refine((value) => value >= EARLIEST_DATE_OF_BIRTH, {
    message: "Please enter a date of birth after 1900.",
  })
  .refine((value) => value <= todayIsoDate(), {
    message: "A date of birth can't be in the future.",
  });

/**
 * Today, as an ISO calendar date in the viewer's own timezone.
 *
 * Exported because the form needs the same value for the date input's `max`
 * attribute, and two definitions of "today" would disagree for the hours
 * between UTC midnight and local midnight.
 *
 * On the server this is the server's timezone. The consequence is bounded and
 * benign: for a few hours a day a patient in a timezone ahead of the server
 * could be told their newborn's date of birth is in the future. Accepting that
 * is better than the alternatives — asking the browser for a timezone and
 * trusting it, or silently widening the bound by a day.
 */
export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Whether an ISO date string denotes a day that exists.
 *
 * `new Date("2026-02-30")` does not throw; it rolls over to 2 March. Building
 * the date in UTC and reading the parts back is what catches that, and UTC is
 * used precisely because no local-time interpretation is involved in the
 * question "does 30 February exist".
 */
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * A postal code.
 *
 * India's PIN code is six digits, and that is what nearly every patient will
 * type — but hard-coding it would reject a patient who lives abroad and is
 * visiting the clinic, which `phase_07.md` section 26 explicitly warns
 * against. So: bounded length, letters, digits, one space or hyphen between
 * groups, and no format assumption beyond that.
 */
export const postalCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z
      .string()
      .min(POSTAL_CODE_MIN_LENGTH, {
        message: "That postal code looks too short.",
      })
      .max(POSTAL_CODE_MAX_LENGTH, {
        message: "That postal code looks too long.",
      })
      .regex(/^[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/, {
        message: "Use letters and numbers only, for example 411001.",
      }),
  );

/**
 * An optional mobile number.
 *
 * Empty is normalised away before validation, so the field is genuinely
 * optional rather than "optional unless you touch it". `phoneSchema` does the
 * rest: it tolerates spaces and a `+91` prefix as typed and stores ten digits,
 * so the same number entered three ways is one value in the record.
 */
const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(phoneSchema.optional());

/**
 * The profile form.
 *
 * `strict()` is doing real work here: it rejects any key the form does not
 * define, which covers both the clinical fields this table must never carry
 * and the protected fields a caller might try to smuggle in (`id`,
 * `profileId`, `role`). Without it, an unexpected key would be quietly ignored
 * and the request would look like it succeeded.
 */
export const patientProfileSchema = z
  .object({
    fullName: requiredText(FULL_NAME_MAX_LENGTH, "Your full name"),

    preferredName: optionalText(
      boundedText(PREFERRED_NAME_MAX_LENGTH, "Preferred name"),
    ),

    phone: optionalPhone,

    dateOfBirth: optionalText(dateOfBirthSchema),

    gender: optionalText(
      z.enum(PATIENT_GENDERS, {
        message: "Please choose one of the listed options.",
      }),
    ),

    addressLine1: optionalText(
      boundedText(ADDRESS_LINE_MAX_LENGTH, "Address line 1"),
    ),
    addressLine2: optionalText(
      boundedText(ADDRESS_LINE_MAX_LENGTH, "Address line 2"),
    ),
    city: optionalText(boundedText(CITY_MAX_LENGTH, "City")),
    state: optionalText(boundedText(STATE_MAX_LENGTH, "State")),
    postalCode: optionalText(postalCodeSchema),

    emergencyContactName: optionalText(
      boundedText(FULL_NAME_MAX_LENGTH, "Emergency contact name"),
    ),
    emergencyContactRelationship: optionalText(
      boundedText(RELATIONSHIP_MAX_LENGTH, "Relationship"),
    ),
    emergencyContactPhone: optionalPhone,

    preferredLanguage: optionalText(
      boundedText(LANGUAGE_MAX_LENGTH, "Preferred language"),
    ),
  })
  .strict()
  /**
   * An emergency contact is a person *and* a way to reach them. A name with no
   * number is not a contact, and a number with no name is one nobody will dare
   * ring in the situation it exists for.
   *
   * The message is attached to whichever half is missing, so it appears under
   * the field the patient has to fill in.
   */
  .superRefine((value, ctx) => {
    if (value.emergencyContactName && !value.emergencyContactPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["emergencyContactPhone"],
        message:
          "Please add a number for your emergency contact, or clear the name.",
      });
    }

    if (value.emergencyContactPhone && !value.emergencyContactName) {
      ctx.addIssue({
        code: "custom",
        path: ["emergencyContactName"],
        message:
          "Please add a name for your emergency contact, or clear the number.",
      });
    }

    // A relationship with nobody to relate to is a stray value, not an error
    // worth a message of its own — but it should not be stored either. It is
    // dropped when the contact is absent; see `toPatientRecord` in
    // `./queries.ts`.
  });

export type PatientProfileInput = z.infer<typeof patientProfileSchema>;
