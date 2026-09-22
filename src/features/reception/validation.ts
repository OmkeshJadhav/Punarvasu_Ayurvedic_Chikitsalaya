/**
 * Receptionist input validation.
 *
 * One set of schemas, run by the browser for feedback and by the server for
 * authority. Client validation is never the security control
 * (`docs/SECURITY.md` section 9).
 *
 * ## What these schemas have no field for
 *
 * `status` on a booking, `duration`, `endsAt`, `blockedUntil`, `createdBy`,
 * `role`, `profileId`, `userId`, `internalNote`, and every clinical field
 * name. Every one of those is a value `phase_10.md` sections 18, 29, 34 and 62
 * say a client must not control. They are not stripped — they are absent, the
 * objects are `strict()`, and a request carrying one is **rejected**.
 *
 * A rejected request shows up in a log. A quietly dropped field is how a
 * trusted value starts being read from the request two phases later.
 *
 * Even if one slipped through, it would have nowhere to go: the database
 * functions that perform every write take none of them as arguments — with the
 * single, deliberate exception of `patientId`, which the receptionist genuinely
 * chooses and which the database validates against the patients table before
 * writing anything (`phase_10.md` section 18).
 *
 * ## Why `patientId` being a real input is safe
 *
 * It says *which* patient, never *whether the caller may act on one*. The
 * caller's identity is `auth.uid()`, the caller's role is read from
 * `public.user_roles`, and the id must resolve to an existing patient record
 * or the write is refused with `PV014`. Three things decide authority and none
 * of them is in the request body. This is the same argument Phase 08 made for
 * `targetUserId` on role assignment.
 */

import { z } from "zod";

import {
  CANCELLATION_REASON_MAX_LENGTH,
  PATIENT_NOTE_MAX_LENGTH,
} from "@/config/appointments";
import {
  instantSchema,
  clinicDateSchema,
} from "@/features/appointments/validation";
import { PATIENT_GENDERS } from "@/features/patients/types";
import { uuidSchema } from "@/lib/validation/schemas";

import { STAFF_ASSIGNABLE_STATUSES } from "./status";

/**
 * How long a search term may be.
 *
 * Bounded because it becomes a `like` pattern. The database clamps its own
 * result count as well, so neither the length of the term nor the size of the
 * answer is the caller's to decide.
 */
export const PATIENT_SEARCH_MIN_LENGTH = 2;
export const PATIENT_SEARCH_MAX_LENGTH = 80;
export const PATIENT_SEARCH_LIMIT = 20;

/**
 * The search term.
 *
 * A term shorter than the minimum is valid input that finds nothing, rather
 * than an error: somebody halfway through typing "Priya" has not made a
 * mistake. The empty-box case is handled the same way, and the database
 * refuses to search for it independently — an empty query must never be a
 * "list every patient" button (`phase_10.md` section 13).
 */
export const patientSearchSchema = z
  .object({
    query: z
      .string()
      .trim()
      .max(PATIENT_SEARCH_MAX_LENGTH, {
        message: `Search terms are limited to ${PATIENT_SEARCH_MAX_LENGTH} characters.`,
      })
      .default(""),
  })
  .strict();

export type PatientSearchInput = z.infer<typeof patientSearchSchema>;

const optionalText = (maxLength: number, label: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    },
    z
      .string()
      .max(maxLength, {
        message: `${label} must be ${maxLength} characters or fewer.`,
      })
      .optional(),
  );

/**
 * A phone number as the front desk types it.
 *
 * Deliberately more tolerant than `lib/validation/schemas.ts`'s `phoneSchema`,
 * which enforces an Indian mobile. A receptionist is copying a number off a
 * form somebody filled in by hand, and it may be a landline, it may carry an
 * STD code, and refusing to register a patient because their number does not
 * look like a mobile is the product getting in the way of care.
 *
 * So: bounded, required to contain enough digits to be a phone number, and
 * otherwise stored as given. The patient's own profile form keeps the stricter
 * rule, because a patient typing their own mobile knows what it is.
 */
const operationalPhone = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z
    .string()
    .max(20, { message: "That phone number is too long." })
    /*
     * Composition rather than shape. An earlier version required the first
     * character to be `+` or a digit, which refused `(022) 2555-1234` — an
     * ordinary way to write an Indian landline with its STD code, and exactly
     * the kind of number a receptionist copies off a handwritten form. Caught
     * by its own test.
     *
     * So: only characters that appear in written phone numbers, and enough
     * digits to be one. That still rejects a name, a script tag and a SQL
     * fragment, which is what this check is for.
     */
    .refine((value) => /^[+\d\s()-]+$/.test(value), {
      message: "Use digits, spaces, brackets, + or - only.",
    })
    .refine((value) => value.replace(/\D/g, "").length >= 8, {
      message: "Enter a complete phone number.",
    })
    .optional(),
);

/**
 * A date of birth, as a calendar date.
 *
 * Compared as ISO strings rather than `Date` objects, for the reason
 * `features/patients/validation.ts` records at length: `new Date("1990-04-07")`
 * is midnight **UTC**, so comparing it against a local `new Date()` puts the
 * boundary hours away from local midnight. ISO dates sort lexicographically,
 * so a string comparison is both simpler and correct.
 */
const EARLIEST_DATE_OF_BIRTH = "1900-01-01";

const dateOfBirth = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "Use the date picker, or YYYY-MM-DD.",
    })
    .refine((value) => isRealCalendarDate(value), {
      message: "That date doesn't exist.",
    })
    .refine((value) => value >= EARLIEST_DATE_OF_BIRTH, {
      message: "Please check the year.",
    })
    .refine((value) => value <= todayIsoDate(), {
      message: "A date of birth can't be in the future.",
    })
    .optional(),
);

/**
 * Creating a patient record at the front desk.
 *
 * ## What is required
 *
 * A name, and nothing else. Phase 07 made the same choice for a patient's own
 * profile and the reasoning is stronger here: a receptionist registering
 * somebody who has just walked in should not be blocked from booking them
 * because they have not been asked for a postcode yet.
 *
 * ## What is absent
 *
 * `profileId`, `userId`, `role`, `email`, `password`, and every clinical field
 * name. `phase_10.md` sections 34-35: a receptionist must not be able to
 * assign an owner, create an account, invent a credential or grant a role. The
 * schema has no field for any of them, the database function has no parameter
 * for any of them, and `strict()` rejects a request that sends one rather than
 * dropping it.
 */
export const createPatientSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, { message: "A name is required." })
      .max(120, { message: "That name is too long." }),
    preferredName: optionalText(60, "Preferred name"),
    phone: operationalPhone,
    dateOfBirth,
    gender: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.enum(PATIENT_GENDERS).optional(),
    ),
    addressLine1: optionalText(120, "Address"),
    addressLine2: optionalText(120, "Address"),
    city: optionalText(80, "Town or city"),
    state: optionalText(80, "State"),
    postalCode: optionalText(12, "Postal code"),
    emergencyContactName: optionalText(120, "Emergency contact name"),
    emergencyContactRelationship: optionalText(60, "Relationship"),
    emergencyContactPhone: operationalPhone,
    preferredLanguage: optionalText(60, "Preferred language"),
    /**
     * "I have looked at the possible duplicates and this is somebody else."
     *
     * A UI control flag, not a trusted value. All it decides is whether an
     * *advisory* warning stops the submission a second time; it confers no
     * authority, changes nothing about what is written, and cannot make a
     * record belong to anyone. It is in the schema rather than stripped
     * because the schema is `strict()`, and a field the form genuinely sends
     * has to be declared or the whole submission is rejected.
     *
     * `phase_10.md` section 33 asks for the receptionist to verify explicitly.
     * This is that verification, and the reason it can be a form field is that
     * getting it wrong creates a duplicate record — a nuisance — rather than
     * exposing anything.
     */
    duplicateAcknowledged: z
      .preprocess((value) => value === "1" || value === "true", z.boolean())
      .default(false),
  })
  .strict()
  /*
   * An emergency contact is a name **and** a way to reach them. Half of one is
   * not a contact, and the message is attached to whichever half is missing so
   * the receptionist is told what to fix rather than that something is wrong.
   */
  .superRefine((value, ctx) => {
    const hasName = Boolean(value.emergencyContactName);
    const hasPhone = Boolean(value.emergencyContactPhone);

    if (hasName && !hasPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["emergencyContactPhone"],
        message: "Add a number for this contact, or leave the name blank.",
      });
    }

    if (hasPhone && !hasName) {
      ctx.addIssue({
        code: "custom",
        path: ["emergencyContactName"],
        message: "Add a name for this contact, or leave the number blank.",
      });
    }
  });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

/**
 * Booking on a patient's behalf.
 *
 * Four ids and an instant. Compare it with the patient's own booking schema:
 * the only additional field is `patientId`, which is the whole difference
 * between self-service and front-desk booking, and it is validated as a UUID
 * here and as an existing patient record in the database.
 *
 * There is still no field for a status, a duration, an end time or a
 * practitioner's permission.
 */
export const staffBookingSchema = z
  .object({
    patientId: uuidSchema,
    practitionerId: uuidSchema,
    appointmentTypeId: uuidSchema,
    startsAt: instantSchema,
    patientNote: optionalText(PATIENT_NOTE_MAX_LENGTH, "The note"),
  })
  .strict();

export type StaffBookingInput = z.infer<typeof staffBookingSchema>;

/**
 * An operational status change.
 *
 * `status` is constrained to the four the front desk may set, so a request
 * carrying `completed` is refused at the boundary as well as by the database's
 * own allowlist and by the transition trigger beneath it.
 */
export const staffStatusSchema = z
  .object({
    appointmentId: uuidSchema,
    status: z.enum(STAFF_ASSIGNABLE_STATUSES, {
      message: "That isn't a status you can set.",
    }),
    reason: optionalText(CANCELLATION_REASON_MAX_LENGTH, "The reason"),
  })
  .strict();

export type StaffStatusInput = z.infer<typeof staffStatusSchema>;

/** Moving an appointment on a patient's behalf. */
export const staffRescheduleSchema = z
  .object({
    appointmentId: uuidSchema,
    startsAt: instantSchema,
  })
  .strict();

export type StaffRescheduleInput = z.infer<typeof staffRescheduleSchema>;

/**
 * The schedule view's filters.
 *
 * All optional, all bounded, and none of them widens access: the receptionist
 * can already see the whole diary, so a filter narrows what is shown rather
 * than unlocking anything. `date` is a clinic calendar date, which is what
 * makes "today" mean the clinic's today rather than the browser's.
 */
export const scheduleFilterSchema = z
  .object({
    date: clinicDateSchema.optional(),
    practitionerId: z.preprocess(
      (value) => (value === "" || value === "all" ? undefined : value),
      uuidSchema.optional(),
    ),
    status: z.preprocess(
      (value) => (value === "" || value === "all" ? undefined : value),
      z
        .enum([
          "requested",
          "confirmed",
          "checked_in",
          "in_consultation",
          "completed",
          "cancelled",
          "no_show",
        ])
        .optional(),
    ),
  })
  .strict();

export type ScheduleFilterInput = z.infer<typeof scheduleFilterSchema>;

/** Whether an ISO date string names a day that exists. */
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  // `Date.UTC` rolls 30 February over into March rather than failing, so the
  // parts are read back to confirm the day actually exists.
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Today, as an ISO calendar date.
 *
 * Built from local parts rather than `toISOString()`, which reports UTC and
 * would call it tomorrow for several hours each evening in India.
 */
function todayIsoDate(): string {
  const now = new Date();
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
