/**
 * The analytics trust boundary.
 *
 * ## What arrives here
 *
 * A preset name, two dates, and sometimes a practitioner id — from a query
 * string or from a form post. Nothing else, ever: there is no column name, no
 * sort expression, no table name, no aggregate name and no SQL fragment in
 * any schema below, because `phase_16.md` sections 57, 58 and 61 rule out
 * accepting any of them. Every filter is a value, and every value is a
 * parameter of an RPC call.
 *
 * ## `strict()` rather than `strip()`
 *
 * An unexpected key is **rejected**, not quietly dropped. A rejected request
 * is visible in a log and tells us somebody tried; a dropped field is how
 * `patientId` arrives one day in a query that was refactored to spread its
 * input. The same choice Phases 10, 12, 13 and 14 made, for the same reason.
 *
 * ## Why there is no `patientId` and no `practitionerId` on the practice
 * schema
 *
 * Section 59 and example 3. A practitioner's own analytics resolve their
 * scope from the session inside the database, so there is no field to send;
 * and no analytics surface anywhere in this feature takes a patient
 * identifier, which is what stops an analytics endpoint becoming an
 * enumeration API. `validation.test.ts` asserts that no schema in this module
 * has a field whose name suggests a patient, a clinic, an organization, a
 * report id, an export id, a role or a permission.
 *
 * ## A practitioner filter narrows and never widens
 *
 * The clinic schema accepts an optional practitioner id. That is a *filter*
 * on data the caller is already authorized for — a receptionist and an
 * administrator see the whole diary — so no value of it can reach a row they
 * could not have seen. It is validated as a uuid so a malformed value is
 * refused rather than interpreted, and the database resolves it against the
 * practitioners table.
 */

import { z } from "zod";

import {
  ANALYTICS_RANGE_PRESETS,
  ANALYTICS_RANGE_RULES,
} from "@/config/analytics";
import { uuidSchema } from "@/lib/validation/schemas";

/** An ISO calendar date, and a date that exists. */
const clinicDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (year === undefined || month === undefined || day === undefined) {
      return false;
    }
    // `Date.UTC` rolls 30 February into March rather than failing, so the
    // parts are read back — the same check Phase 07 makes on a date of birth.
    const probe = new Date(Date.UTC(year, month - 1, day));
    return (
      probe.getUTCFullYear() === year &&
      probe.getUTCMonth() === month - 1 &&
      probe.getUTCDate() === day
    );
  }, "That date does not exist.")
  .refine(
    (value) => value >= ANALYTICS_RANGE_RULES.earliestDate,
    "The clinic has no records that far back.",
  );

const presetSchema = z.enum(ANALYTICS_RANGE_PRESETS);

/**
 * The dashboard filter, as it arrives in a URL.
 *
 * Every field is optional because a bare `/admin/analytics` is a legitimate
 * request; the page falls back to the default period. The *shape* is still
 * strict, so `?patientId=…` is a rejection rather than an ignored parameter.
 */
export const analyticsFilterSchema = z
  .object({
    preset: presetSchema.optional(),
    from: clinicDateSchema.optional(),
    to: clinicDateSchema.optional(),
    practitionerId: uuidSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.preset !== "custom" ||
      (value.from !== undefined && value.to !== undefined),
    {
      message: "Choose both a start and an end date.",
      path: ["from"],
    },
  );

export type AnalyticsFilterInput = z.infer<typeof analyticsFilterSchema>;

/**
 * A practitioner's own dashboard filter.
 *
 * **No practitioner field.** Not optional, not ignored — absent, so there is
 * nothing for example 3's `if (role === "doctor") return clinicAnalytics` to
 * be written against and nothing for a request to carry.
 */
export const practiceAnalyticsFilterSchema = z
  .object({
    preset: presetSchema.optional(),
    from: clinicDateSchema.optional(),
    to: clinicDateSchema.optional(),
  })
  .strict();

export type PracticeAnalyticsFilterInput = z.infer<
  typeof practiceAnalyticsFilterSchema
>;

/**
 * The export request.
 *
 * A period and an optional practitioner, and that is the whole of it. There is
 * no column list, no format parameter and no report identifier: the report is
 * defined in `config/analytics.ts` and there is exactly one, so section 101's
 * "change the reportId" has nothing to change and section 45's "dump every
 * joined table" has no parameter to ask for.
 *
 * A period is **required** here, unlike on a dashboard. An export with no
 * period would have to mean "everything", which is precisely the unbounded
 * query section 82 rules out.
 */
export const appointmentReportRequestSchema = z
  .object({
    from: clinicDateSchema,
    to: clinicDateSchema,
    practitionerId: uuidSchema.optional(),
  })
  .strict();

export type AppointmentReportRequest = z.infer<
  typeof appointmentReportRequestSchema
>;

/**
 * The fields a dashboard filter form posts, named once.
 *
 * Read field by field rather than spread, so a hidden input somebody adds to
 * the DOM is never read at all — the first of the three layers Phase 12
 * established, before the schema's `strict()` and before the RPC's fixed
 * argument list.
 */
export const ANALYTICS_FILTER_FIELDS = [
  "preset",
  "from",
  "to",
  "practitionerId",
] as const;

export const REPORT_REQUEST_FIELDS = ["from", "to", "practitionerId"] as const;
