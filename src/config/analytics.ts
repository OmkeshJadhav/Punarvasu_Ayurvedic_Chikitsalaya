/**
 * Analytics configuration.
 *
 * ## This is a mirror, and the mirror is checked
 *
 * The authority for every value below is
 * `supabase/migrations/20260927120000_analytics_reporting.sql`, because the
 * database is what actually refuses a two-year report and what actually
 * decides whether a trend is drawn daily or monthly. These constants exist so
 * the application can offer a date preset the database will accept, label a
 * chart's buckets correctly, and say "up to one year" in a form hint rather
 * than letting somebody pick eighteen months and be told no.
 *
 * Two copies of a rule is a divergence waiting to happen, so
 * `src/config/analytics.test.ts` reads the migration and fails if they
 * disagree — the same arrangement `config/appointments.ts`,
 * `config/documents.ts` and `config/notifications.ts` have with theirs.
 *
 * ## No value here is a security boundary
 *
 * A bound that exists only in this file protects nothing: the RPC validates
 * its own range, and a request that skipped the form still hits
 * `analytics_assert_range()`. What this file prevents is a *bad experience* —
 * a form that offers a range the system will refuse.
 */

/** The preset ranges the date filter offers (`phase_16.md` section 24). */
export const ANALYTICS_RANGE_PRESETS = [
  "today",
  "this_week",
  "this_month",
  "last_month",
  "last_3_months",
  "last_12_months",
  "custom",
] as const;

export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number];

/** The preset a dashboard opens on when nothing was asked for. */
export const DEFAULT_ANALYTICS_PRESET: AnalyticsRangePreset = "this_month";

export interface AnalyticsRangeRules {
  /**
   * The longest reportable period, counting both end dates.
   *
   * A year plus a leap day, so "the last twelve months" always fits however
   * the range falls (`phase_16.md` sections 26 and 82).
   */
  readonly maxRangeDays: number;
  /**
   * The earliest date a report may start at.
   *
   * A **sanity floor**, not a "the clinic's records begin here" line, and the
   * distinction matters: `maxRangeDays` is what actually bounds the scan, so
   * this only has to refuse an obviously wrong year. Setting it level with
   * the first migration would make "the last twelve months" refuse itself for
   * a year after launch, which is how a bound chosen for tidiness becomes a
   * preset nobody can use.
   */
  readonly earliestDate: string;
  /** Up to and including this many days, a trend is drawn day by day. */
  readonly dailyGranularityMaxDays: number;
  /** Up to and including this many days, week by week. Beyond it, monthly. */
  readonly weeklyGranularityMaxDays: number;
}

export const ANALYTICS_RANGE_RULES: AnalyticsRangeRules = {
  maxRangeDays: 366,
  earliestDate: "2020-01-01",
  dailyGranularityMaxDays: 31,
  weeklyGranularityMaxDays: 122,
};

/** How a trend's points are bucketed. Derived from the range, never chosen. */
export const TREND_GRANULARITIES = ["day", "week", "month"] as const;

export type TrendGranularity = (typeof TREND_GRANULARITIES)[number];

/**
 * The bucket size for a range, by the same thresholds the database uses.
 *
 * Section 27. Derived rather than requested, which bounds the number of
 * points a chart can be asked to draw by construction: at most 31 daily, at
 * most 18 weekly, at most 13 monthly. There is no granularity parameter
 * anywhere in this feature, so there is one fewer input to validate.
 *
 * `spanDays` counts both end dates, matching how the range is interpreted.
 */
export function trendGranularityForSpan(spanDays: number): TrendGranularity {
  if (spanDays <= ANALYTICS_RANGE_RULES.dailyGranularityMaxDays) return "day";
  if (spanDays <= ANALYTICS_RANGE_RULES.weeklyGranularityMaxDays) return "week";
  return "month";
}

/**
 * How many rows a report table shows before it says there are more.
 *
 * Not pagination: every table in this feature is already an aggregate, and
 * the widest of them has one row per practitioner. This is the guard against
 * a clinic that one day has ninety of them.
 */
export const ANALYTICS_TABLE_LIMIT = 50;

/**
 * Decimal places for a percentage (`phase_16.md` section 95).
 *
 * One. `67.4%` is a number somebody can act on; `67.437291%` implies a
 * precision the underlying counts do not have, and two reports rounded
 * differently look like two different numbers.
 */
export const RATE_DECIMAL_PLACES = 1;

/** The report the export produces. One report, named once. */
export const APPOINTMENT_REPORT = {
  /** Used in the filename and in the export audit log event. */
  slug: "appointments",
  name: "Appointment operations",
  /**
   * The approved columns, in order (`phase_16.md` sections 45 and 92).
   *
   * This array **is** the export contract: the CSV writer reads each row
   * through these keys and cannot emit a field that is not here, so a column
   * added to the RPC later does not silently start leaving the building.
   */
  columns: [
    { key: "clinicDate", header: "Date" },
    { key: "practitionerName", header: "Practitioner" },
    { key: "appointmentTypeName", header: "Appointment type" },
    { key: "status", header: "Status" },
    { key: "appointmentCount", header: "Appointments" },
  ],
} as const;
