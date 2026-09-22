/**
 * Appointment input validation.
 *
 * One set of schemas, run by the browser for feedback and by the server for
 * authority. Client validation is never the security control
 * (`docs/SECURITY.md` section 9); it is here so the two cannot disagree about
 * what a well-formed request looks like.
 *
 * ## What these schemas deliberately have no field for
 *
 * `patientId`, `practitionerName`, `status`, `duration`, `endsAt`,
 * `internalNote`, `createdAt`, `createdBy`, `cancelledBy`.
 *
 * Every one of those is a value `phase_09.md` sections 22-23, 37-38 and 70 say
 * a client must not control. They are not filtered out — they are absent, the
 * objects are `strict()`, and a request carrying one is **rejected** rather
 * than silently stripped. A rejected request shows up in a log; a quietly
 * dropped field is how a trusted value starts being read from the request two
 * phases later.
 *
 * Even if one slipped through, it would have nowhere to go: the database
 * functions that perform every write take none of them as arguments.
 *
 * ## Why the start time is an absolute instant
 *
 * `startsAt` is an ISO 8601 string that **must** carry a timezone designator.
 * `"2026-09-22T10:30:00+05:30"` and `"2026-09-22T05:00:00Z"` are the same
 * moment and both are accepted; `"2026-09-22 10:30"` is not a moment at all
 * and is refused. That is exactly the naive parse `phase_09.md` section 12
 * warns about, and refusing it at the boundary means no downstream code has to
 * guess which timezone somebody meant.
 *
 * The clinic timezone still matters — it is what decides which working day
 * 05:00Z falls on — but that question is answered once, in the database's
 * `assert_bookable_slot`, against an instant that is already unambiguous.
 */

import { z } from "zod";

import {
  CANCELLATION_REASON_MAX_LENGTH,
  MAX_AVAILABILITY_WINDOW_DAYS,
  PATIENT_NOTE_MAX_LENGTH,
} from "@/config/appointments";
import { uuidSchema } from "@/lib/validation/schemas";

import { isIsoDate } from "./time";

/**
 * An instant, with its offset stated.
 *
 * The regex is the point: `Date.parse` accepts a naive `"2026-09-22T10:30"`
 * and resolves it against the *server's* timezone, which would make the same
 * request mean different moments on different machines.
 */
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export const instantSchema = z
  .string()
  .trim()
  .max(40, { message: "That is not a valid appointment time." })
  .refine((value) => INSTANT_PATTERN.test(value), {
    message: "That is not a valid appointment time.",
  })
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: "That is not a valid appointment time.",
  });

/** A clinic calendar date, `YYYY-MM-DD`. Used for asking about a day. */
export const clinicDateSchema = z
  .string()
  .trim()
  .refine((value) => isIsoDate(value), {
    message: "Please choose a valid date.",
  });

/**
 * A short operational note.
 *
 * The form's label and helper text say plainly that it is for scheduling and
 * not for symptoms (`phase_09.md` sections 24 and 52). There is no way to
 * enforce that on free text, which is precisely why the field is bounded,
 * optional, singular, and why nothing in the product treats it as clinical
 * content — it is not a medical-history field wearing a different label.
 */
const optionalNote = (maxLength: number, label: string) =>
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

export const bookAppointmentSchema = z
  .object({
    practitionerId: uuidSchema,
    appointmentTypeId: uuidSchema,
    startsAt: instantSchema,
    patientNote: optionalNote(PATIENT_NOTE_MAX_LENGTH, "Your note"),
  })
  .strict();

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

export const cancelAppointmentSchema = z
  .object({
    appointmentId: uuidSchema,
    reason: optionalNote(CANCELLATION_REASON_MAX_LENGTH, "Your reason"),
  })
  .strict();

export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const rescheduleAppointmentSchema = z
  .object({
    appointmentId: uuidSchema,
    startsAt: instantSchema,
  })
  .strict();

export type RescheduleAppointmentInput = z.infer<
  typeof rescheduleAppointmentSchema
>;

/**
 * The availability query.
 *
 * Bounded on purpose: `days` caps how much work one authenticated request can
 * ask the database to do, and the database independently refuses a wider
 * window. An availability endpoint is the cheapest thing in this feature to
 * abuse, because it needs no patient record and no booking.
 */
export const availabilityQuerySchema = z
  .object({
    practitionerId: uuidSchema,
    appointmentTypeId: uuidSchema,
    date: clinicDateSchema,
    days: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_AVAILABILITY_WINDOW_DAYS)
      .default(1),
  })
  .strict();

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
