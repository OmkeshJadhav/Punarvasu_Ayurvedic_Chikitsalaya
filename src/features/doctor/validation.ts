/**
 * Doctor workspace input validation.
 *
 * One set of schemas, run by the browser for feedback and by the server for
 * authority. Client validation is never the security control
 * (`docs/SECURITY.md` section 9).
 *
 * ## What these schemas have no field for
 *
 * `doctorId`, `practitionerId`, `patientId` on a status change, `role`,
 * `permission`, `status` on anything but the one action that changes a
 * status, `duration`, `endsAt`, `startsAt`, `internalNote`, and every
 * clinical field name. `phase_11.md` sections 43, 47 and 59 name most of
 * those explicitly. They are not stripped — they are absent, the objects are
 * `strict()`, and a request carrying one is **rejected**.
 *
 * A rejected request shows up in a log. A quietly dropped field is how a
 * trusted value starts being read from the request two phases later.
 *
 * Even if one slipped through it would have nowhere to go:
 * `update_appointment_status_as_doctor` takes an appointment id and a status
 * and nothing else, and it resolves the appointment by the caller's own
 * practitioner id.
 *
 * ## Why an appointment id is safe to accept, and a practitioner id is not
 *
 * The appointment id says *which* appointment; it never says whether the
 * caller may act on one. The practitioner is `auth.uid()`'s own record,
 * resolved inside the database by `assert_care_practitioner()`, and the
 * appointment is then resolved by id **and** by that practitioner in one
 * statement — so another doctor's appointment is indistinguishable from one
 * that does not exist.
 *
 * A `practitionerId` in a request body, by contrast, would be a claim about
 * identity, which is exactly what `phase_11.md` example 2 forbids. There is
 * no schema here with a field for one.
 */

import { z } from "zod";

import { clinicDateSchema } from "@/features/appointments/validation";
import { uuidSchema } from "@/lib/validation/schemas";

import { DOCTOR_ASSIGNABLE_STATUSES } from "./status";

/**
 * How long a search term may be, and how many people it may return.
 *
 * Bounded here because it becomes a `like` pattern, and bounded again in the
 * database, which clamps its own result count — so neither the length of the
 * term nor the size of the answer is the caller's to decide
 * (`phase_11.md` section 15).
 */
export const CARE_SEARCH_MIN_LENGTH = 2;
export const CARE_SEARCH_MAX_LENGTH = 80;
export const CARE_SEARCH_LIMIT = 20;

/**
 * The search term.
 *
 * A term shorter than the minimum is valid input that finds nothing, rather
 * than an error: somebody halfway through typing a name has not made a
 * mistake. The empty-box case is handled the same way, and
 * `search_care_patients` refuses to search for it independently — an empty
 * query must never be a "list every patient" button.
 */
export const carePatientSearchSchema = z
  .object({
    query: z
      .string()
      .trim()
      .max(CARE_SEARCH_MAX_LENGTH, {
        message: `Search terms are limited to ${CARE_SEARCH_MAX_LENGTH} characters.`,
      })
      .default(""),
  })
  .strict();

export type CarePatientSearchInput = z.infer<typeof carePatientSearchSchema>;

/**
 * A status change on one of the practitioner's own appointments.
 *
 * Two fields. `status` is constrained to the four this role may set, so a
 * request carrying `cancelled` or `checked_in` is refused at the boundary as
 * well as by the database's own allowlist and by the transition trigger
 * beneath it.
 *
 * There is no `reason` field, because none of the four transitions writes
 * one — which also means there is no free-text field anywhere on this path
 * for a clinical note to be typed into.
 */
export const doctorStatusSchema = z
  .object({
    appointmentId: uuidSchema,
    status: z.enum(DOCTOR_ASSIGNABLE_STATUSES, {
      message: "That isn't a status you can set.",
    }),
  })
  .strict();

export type DoctorStatusInput = z.infer<typeof doctorStatusSchema>;

/**
 * How a practitioner narrows their own diary.
 *
 * `phase_11.md` section 12 asks for today, upcoming, past, status and type,
 * and warns against filters with no operational purpose. There is
 * deliberately **no practitioner filter**: a doctor can only ever see their
 * own diary, so a control offering to narrow it to one practitioner would
 * offer a choice with one option.
 *
 * None of these widens access. The rows a doctor can read are decided by
 * row-level security before any of this is applied; a filter narrows what is
 * shown and can reach nothing that was not already readable. They are
 * validated all the same — an unrecognised value is rejected rather than
 * interpreted.
 */
export const DOCTOR_APPOINTMENT_RANGES = ["today", "upcoming", "past"] as const;

export type DoctorAppointmentRange = (typeof DOCTOR_APPOINTMENT_RANGES)[number];

export const doctorAppointmentFilterSchema = z
  .object({
    range: z.preprocess(
      (value) => (value === "" || value === undefined ? "upcoming" : value),
      z.enum(DOCTOR_APPOINTMENT_RANGES).default("upcoming"),
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
    appointmentTypeId: z.preprocess(
      (value) => (value === "" || value === "all" ? undefined : value),
      uuidSchema.optional(),
    ),
  })
  .strict();

export type DoctorAppointmentFilterInput = z.infer<
  typeof doctorAppointmentFilterSchema
>;

/**
 * The day a practitioner is looking at on their dashboard.
 *
 * A clinic calendar date, which is what makes "today" mean the clinic's today
 * rather than the browser's.
 */
export const doctorDaySchema = z
  .object({ date: clinicDateSchema.optional() })
  .strict();

export type DoctorDayInput = z.infer<typeof doctorDaySchema>;
