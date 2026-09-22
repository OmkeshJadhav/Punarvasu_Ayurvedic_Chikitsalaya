/**
 * Reporting periods, in the clinic's timezone.
 *
 * ## The one date rule in this feature
 *
 * A period is a pair of **clinic calendar dates**, both inclusive, and it
 * denotes the half-open instant range
 *
 *     [ from 00:00 clinic-local , (to + 1 day) 00:00 clinic-local )
 *
 * Start inclusive, end inclusive *as a day*, and no instant in two buckets or
 * in none. The database says the same thing in `analytics_range_start()` and
 * `analytics_range_end()`, and that is where it is enforced; this module
 * exists so the application can resolve "this month" into a pair of dates and
 * label the result.
 *
 * ## Why `toClinicIsoDate` and not `toISOString().slice(0, 10)`
 *
 * Section 25 names that exact expression as the thing not to do, and it is
 * worth being precise about why. At 00:30 on 1 October in Satara it is still
 * 19:00 on 30 September in UTC, so a server computing "today" that way would
 * report yesterday for the first five and a half hours of every clinic day —
 * every day, silently, and only visibly wrong to somebody looking at the
 * clinic's own diary at the same moment.
 *
 * Everything below goes through Phase 09's `features/appointments/time.ts`,
 * which is the only place in this product that converts between an instant
 * and a clinic wall clock. This module adds no timezone arithmetic of its
 * own.
 *
 * ## Weeks start on Monday
 *
 * Matching PostgreSQL's `date_trunc('week', ...)`, which is what buckets the
 * trend. A week that started on Sunday in the label and on Monday in the data
 * would put the same appointments under two different headings.
 */

import {
  ANALYTICS_RANGE_RULES,
  DEFAULT_ANALYTICS_PRESET,
  trendGranularityForSpan,
  type AnalyticsRangePreset,
} from "@/config/analytics";
import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  isIsoDate,
  toClinicIsoDate,
  weekdayOfIsoDate,
  type IsoDate,
} from "@/features/appointments/time";

import type { AnalyticsRange } from "./types";

/** The clinic's today. Not the server's, and not the viewer's. */
export function clinicToday(now: Date = new Date()): IsoDate {
  return toClinicIsoDate(now);
}

/** The Monday of the clinic week an ISO date falls in. */
export function startOfClinicWeek(date: IsoDate): IsoDate {
  // `weekdayOfIsoDate` is 0 = Sunday, so Sunday is six days after its Monday.
  const weekday = weekdayOfIsoDate(date);
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return addDaysToIsoDate(date, -daysSinceMonday);
}

/** The first day of the month an ISO date falls in. */
export function startOfClinicMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/** The last day of the month an ISO date falls in. */
export function endOfClinicMonth(date: IsoDate): IsoDate {
  const first = startOfClinicMonth(date);
  // The day before the first of next month, which needs no table of lengths
  // and is right in February of a leap year.
  return addDaysToIsoDate(addMonthsToIsoDate(first, 1), -1);
}

/**
 * `n` months after the first of an ISO date's month.
 *
 * Only ever called on a first-of-month, so the "31 March plus one month"
 * question does not arise and no clamping rule has to be invented.
 */
function addMonthsToIsoDate(isoDate: IsoDate, months: number): IsoDate {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const total = year * 12 + (month - 1) + months;

  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;

  return `${`${nextYear}`.padStart(4, "0")}-${`${nextMonth}`.padStart(2, "0")}-01`;
}

interface DatePair {
  readonly from: IsoDate;
  readonly to: IsoDate;
}

/**
 * The dates a preset denotes, as at a moment.
 *
 * `now` is injected rather than read, which is what makes every boundary in
 * `ranges.test.ts` a deterministic assertion rather than a test that behaves
 * differently in a different month.
 */
export function datesForPreset(
  preset: AnalyticsRangePreset,
  now: Date = new Date(),
): DatePair | null {
  const today = clinicToday(now);

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "this_week":
      // Up to today rather than to Sunday: a week-to-date figure is about work
      // done, and padding it with days that have not happened makes every
      // Monday look like a collapse in volume.
      return { from: startOfClinicWeek(today), to: today };
    case "this_month":
      return { from: startOfClinicMonth(today), to: today };
    case "last_month": {
      const firstOfThisMonth = startOfClinicMonth(today);
      const lastMonthEnd = addDaysToIsoDate(firstOfThisMonth, -1);
      return { from: startOfClinicMonth(lastMonthEnd), to: lastMonthEnd };
    }
    case "last_3_months": {
      // Complete calendar months, ending with the one before this: "the last
      // three months" comparing two full months against a part-month is the
      // kind of figure somebody makes a decision on and should not.
      const firstOfThisMonth = startOfClinicMonth(today);
      const end = addDaysToIsoDate(firstOfThisMonth, -1);
      return { from: addMonthsToIsoDate(firstOfThisMonth, -3), to: end };
    }
    case "last_12_months": {
      const firstOfThisMonth = startOfClinicMonth(today);
      const end = addDaysToIsoDate(firstOfThisMonth, -1);
      return { from: addMonthsToIsoDate(firstOfThisMonth, -12), to: end };
    }
    case "custom":
      // A custom period has no dates of its own; the caller supplies them.
      return null;
  }
}

/** Why a requested period could not be used. */
export type RangeProblem =
  "malformed" | "reversed" | "too_long" | "before_records";

export type RangeResolution =
  | { readonly status: "ok"; readonly range: AnalyticsRange }
  | { readonly status: "invalid"; readonly problem: RangeProblem };

/**
 * Validates a pair of dates and completes it into a range.
 *
 * The same four rules the database enforces, in the same order, so that a
 * form can say what is wrong before a request is made — and note what this is
 * *not*: the database revalidates every one of them, because a request that
 * never went through a form still reaches the RPC (section 26).
 */
export function resolveRange(
  from: string,
  to: string,
  preset: string = "custom",
): RangeResolution {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return { status: "invalid", problem: "malformed" };
  }

  if (daysBetweenIsoDates(from, to) < 0) {
    return { status: "invalid", problem: "reversed" };
  }

  if (from < ANALYTICS_RANGE_RULES.earliestDate) {
    return { status: "invalid", problem: "before_records" };
  }

  const spanDays = daysBetweenIsoDates(from, to) + 1;

  if (spanDays > ANALYTICS_RANGE_RULES.maxRangeDays) {
    return { status: "invalid", problem: "too_long" };
  }

  return {
    status: "ok",
    range: {
      from,
      to,
      spanDays,
      granularity: trendGranularityForSpan(spanDays),
      preset,
    },
  };
}

/**
 * The range a request asked for, or the default when it asked for nothing
 * usable.
 *
 * Falling back rather than failing is the right behaviour for a *filter*: a
 * mistyped date in a URL should show this month, not an error page. Nothing
 * widens as a result — the fallback is narrower than the maximum, and the
 * caller is told through `fellBack` so the page can say the period was not
 * the one requested rather than silently showing different numbers.
 */
export interface ResolvedRangeRequest {
  readonly range: AnalyticsRange;
  readonly fellBack: boolean;
  readonly problem: RangeProblem | null;
}

export function resolveRangeRequest(
  input: {
    readonly preset?: string | undefined;
    readonly from?: string | undefined;
    readonly to?: string | undefined;
  },
  now: Date = new Date(),
): ResolvedRangeRequest {
  const preset = input.preset ?? DEFAULT_ANALYTICS_PRESET;

  if (preset !== "custom") {
    const dates = datesForPreset(preset as AnalyticsRangePreset, now);
    if (dates) {
      const resolved = resolveRange(dates.from, dates.to, preset);
      if (resolved.status === "ok") {
        return { range: resolved.range, fellBack: false, problem: null };
      }
    }
  } else if (input.from && input.to) {
    const resolved = resolveRange(input.from, input.to, "custom");
    if (resolved.status === "ok") {
      return { range: resolved.range, fellBack: false, problem: null };
    }
    return {
      range: defaultRange(now),
      fellBack: true,
      problem: resolved.problem,
    };
  }

  return { range: defaultRange(now), fellBack: true, problem: "malformed" };
}

/** The period a dashboard opens on. */
export function defaultRange(now: Date = new Date()): AnalyticsRange {
  const dates = datesForPreset(DEFAULT_ANALYTICS_PRESET, now);
  const from = dates?.from ?? clinicToday(now);
  const to = dates?.to ?? clinicToday(now);
  const resolved = resolveRange(from, to, DEFAULT_ANALYTICS_PRESET);

  if (resolved.status === "ok") return resolved.range;

  // Unreachable while the default preset is a month-to-date, which is always
  // between one and 31 days. A same-day range is the narrowest honest answer
  // rather than a throw on a page that is only trying to show a filter.
  const today = clinicToday(now);
  return {
    from: today,
    to: today,
    spanDays: 1,
    granularity: "day",
    preset: DEFAULT_ANALYTICS_PRESET,
  };
}
