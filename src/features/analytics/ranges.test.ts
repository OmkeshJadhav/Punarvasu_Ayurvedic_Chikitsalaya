import { describe, expect, it } from "vitest";

import { ANALYTICS_RANGE_RULES } from "@/config/analytics";

import {
  clinicToday,
  datesForPreset,
  defaultRange,
  endOfClinicMonth,
  resolveRange,
  resolveRangeRequest,
  startOfClinicMonth,
  startOfClinicWeek,
} from "./ranges";

/**
 * Date boundaries.
 *
 * `phase_16.md` section 99 asks for midnight, timezone conversion, start
 * inclusive, end inclusive-or-exclusive, month boundary, year boundary and
 * DST where applicable. Every one is below.
 *
 * `now` is injected into every function that needs it, which is what makes
 * these deterministic assertions rather than tests that behave differently in
 * a different month. Nothing here depends on when it runs.
 *
 * ## The clinic's midnight, not UTC's
 *
 * The clinic is in Asia/Kolkata, +05:30. So `2026-09-30T19:00:00Z` is already
 * half past midnight on 1 October *at the clinic*, and an implementation that
 * sliced an ISO string would report 30 September — every night, for the first
 * five and a half hours of every clinic day. Several assertions below are
 * exactly that instant, because it is the one that catches it.
 */

/** 00:30 on 1 October 2026 at the clinic. 19:00 on 30 September in UTC. */
const JUST_AFTER_CLINIC_MIDNIGHT = new Date("2026-09-30T19:00:00.000Z");

/** 23:30 on 30 September 2026 at the clinic. 18:00 the same day in UTC. */
const JUST_BEFORE_CLINIC_MIDNIGHT = new Date("2026-09-30T18:00:00.000Z");

/**
 * The reason a period was refused, or `"accepted"`.
 *
 * `RangeResolution` is a discriminated union, so `.problem` exists only on
 * the invalid branch. Reading it through here keeps each assertion to one
 * line and makes an unexpectedly *accepted* period fail with that word
 * rather than with `undefined`.
 */
function refusalFor(from: string, to: string): string {
  const resolved = resolveRange(from, to);
  return resolved.status === "ok" ? "accepted" : resolved.problem;
}

describe("the clinic's today", () => {
  it("is the clinic's day, not UTC's, just after local midnight", () => {
    // The assertion this whole module exists for. `toISOString().slice(0,10)`
    // would return "2026-09-30" here, which is yesterday at the clinic.
    expect(clinicToday(JUST_AFTER_CLINIC_MIDNIGHT)).toBe("2026-10-01");
    expect(JUST_AFTER_CLINIC_MIDNIGHT.toISOString().slice(0, 10)).toBe(
      "2026-09-30",
    );
  });

  it("is still the previous day just before local midnight", () => {
    expect(clinicToday(JUST_BEFORE_CLINIC_MIDNIGHT)).toBe("2026-09-30");
  });

  it("crosses a month boundary at the clinic's midnight", () => {
    expect(clinicToday(new Date("2026-09-30T18:29:59.000Z"))).toBe(
      "2026-09-30",
    );
    expect(clinicToday(new Date("2026-09-30T18:30:00.000Z"))).toBe(
      "2026-10-01",
    );
  });

  it("crosses a year boundary at the clinic's midnight", () => {
    expect(clinicToday(new Date("2026-12-31T18:29:59.000Z"))).toBe(
      "2026-12-31",
    );
    expect(clinicToday(new Date("2026-12-31T18:30:00.000Z"))).toBe(
      "2027-01-01",
    );
  });
});

describe("week boundaries", () => {
  it("starts a week on Monday, matching date_trunc('week')", () => {
    // 2026-09-30 is a Wednesday.
    expect(startOfClinicWeek("2026-09-30")).toBe("2026-09-28");
  });

  it("treats a Monday as its own week start", () => {
    expect(startOfClinicWeek("2026-09-28")).toBe("2026-09-28");
  });

  it("puts a Sunday in the week that began six days earlier", () => {
    // The off-by-one that a 0-is-Sunday weekday index invites.
    expect(startOfClinicWeek("2026-10-04")).toBe("2026-09-28");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-11-01 is a Sunday; its week began in October.
    expect(startOfClinicWeek("2026-11-01")).toBe("2026-10-26");
  });
});

describe("month boundaries", () => {
  it("finds the first and last day of a 30-day month", () => {
    expect(startOfClinicMonth("2026-09-17")).toBe("2026-09-01");
    expect(endOfClinicMonth("2026-09-17")).toBe("2026-09-30");
  });

  it("finds the last day of a 31-day month", () => {
    expect(endOfClinicMonth("2026-10-05")).toBe("2026-10-31");
  });

  it("finds the last day of February in a common year", () => {
    expect(endOfClinicMonth("2026-02-10")).toBe("2026-02-28");
  });

  it("finds the last day of February in a leap year", () => {
    // The case a hard-coded table of month lengths gets wrong.
    expect(endOfClinicMonth("2028-02-10")).toBe("2028-02-29");
  });

  it("finds the last day of December", () => {
    expect(endOfClinicMonth("2026-12-05")).toBe("2026-12-31");
  });
});

describe("presets", () => {
  it("today is a single clinic day", () => {
    expect(datesForPreset("today", JUST_AFTER_CLINIC_MIDNIGHT)).toEqual({
      from: "2026-10-01",
      to: "2026-10-01",
    });
  });

  it("this week runs from Monday to today, not to Sunday", () => {
    // Padding a week-to-date with days that have not happened makes every
    // Monday look like a collapse in volume.
    expect(datesForPreset("this_week", JUST_BEFORE_CLINIC_MIDNIGHT)).toEqual({
      from: "2026-09-28",
      to: "2026-09-30",
    });
  });

  it("this month runs from the first to today", () => {
    expect(datesForPreset("this_month", JUST_BEFORE_CLINIC_MIDNIGHT)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("last month is a whole calendar month", () => {
    expect(datesForPreset("last_month", JUST_BEFORE_CLINIC_MIDNIGHT)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("last month crosses a year boundary correctly", () => {
    expect(
      datesForPreset("last_month", new Date("2027-01-15T06:00:00.000Z")),
    ).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("last 3 months is three whole months ending before this one", () => {
    // Complete months, deliberately. Two full months compared against a
    // part-month is a figure somebody makes a decision on and should not.
    expect(
      datesForPreset("last_3_months", JUST_BEFORE_CLINIC_MIDNIGHT),
    ).toEqual({ from: "2026-06-01", to: "2026-08-31" });
  });

  it("last 12 months is twelve whole months and fits inside the bound", () => {
    const dates = datesForPreset("last_12_months", JUST_BEFORE_CLINIC_MIDNIGHT);
    expect(dates).toEqual({ from: "2025-09-01", to: "2026-08-31" });

    // And the database will accept it — the reason the bound is 366 rather
    // than 365.
    const resolved = resolveRange(dates?.from ?? "", dates?.to ?? "");
    expect(resolved.status).toBe("ok");
  });

  it("a custom period has no dates of its own", () => {
    expect(datesForPreset("custom", JUST_BEFORE_CLINIC_MIDNIGHT)).toBeNull();
  });

  it("every preset resolves to a period the database would accept", () => {
    for (const preset of [
      "today",
      "this_week",
      "this_month",
      "last_month",
      "last_3_months",
      "last_12_months",
    ] as const) {
      const dates = datesForPreset(preset, JUST_BEFORE_CLINIC_MIDNIGHT);
      expect(dates, preset).not.toBeNull();
      expect(
        resolveRange(dates?.from ?? "", dates?.to ?? "").status,
        preset,
      ).toBe("ok");
    }
  });
});

describe("resolveRange", () => {
  it("counts both end dates, so a single day spans one", () => {
    const resolved = resolveRange("2026-09-17", "2026-09-17");
    expect(resolved.status).toBe("ok");
    if (resolved.status === "ok") {
      expect(resolved.range.spanDays).toBe(1);
      expect(resolved.range.granularity).toBe("day");
    }
  });

  it("counts a whole September as 30 days", () => {
    const resolved = resolveRange("2026-09-01", "2026-09-30");
    if (resolved.status === "ok") expect(resolved.range.spanDays).toBe(30);
  });

  it("picks the granularity the span calls for", () => {
    const { dailyGranularityMaxDays, weeklyGranularityMaxDays } =
      ANALYTICS_RANGE_RULES;

    const daily = resolveRange("2026-01-01", "2026-01-31");
    const weekly = resolveRange("2026-01-01", "2026-04-01");
    const monthly = resolveRange("2026-01-01", "2026-12-31");

    if (daily.status === "ok") expect(daily.range.granularity).toBe("day");
    if (weekly.status === "ok") expect(weekly.range.granularity).toBe("week");
    if (monthly.status === "ok")
      expect(monthly.range.granularity).toBe("month");

    // And the boundaries themselves.
    expect(dailyGranularityMaxDays).toBe(31);
    expect(weeklyGranularityMaxDays).toBe(122);
  });

  it("rejects a reversed period", () => {
    const resolved = resolveRange("2026-09-30", "2026-09-01");
    expect(resolved).toEqual({ status: "invalid", problem: "reversed" });
  });

  it("rejects a period longer than the bound", () => {
    // 2026-01-01 to 2027-01-02 is 367 days.
    const resolved = resolveRange("2026-01-01", "2027-01-02");
    expect(resolved).toEqual({ status: "invalid", problem: "too_long" });
  });

  it("accepts a period exactly at the bound", () => {
    // 366 days, inclusive of both ends.
    const resolved = resolveRange("2026-01-01", "2027-01-01");
    expect(resolved.status).toBe("ok");
    if (resolved.status === "ok") {
      expect(resolved.range.spanDays).toBe(ANALYTICS_RANGE_RULES.maxRangeDays);
    }
  });

  it("rejects a period starting before the clinic has records", () => {
    // Example 6's "user enters 2010-01-01".
    const resolved = resolveRange("2010-01-01", "2010-12-31");
    expect(resolved).toEqual({ status: "invalid", problem: "before_records" });
  });

  it("rejects a malformed date", () => {
    for (const bad of ["", "not-a-date", "2026-9-1", "20260901", "2026-09"]) {
      expect(refusalFor(bad, "2026-09-30"), bad).toBe("malformed");
    }
  });

  it("rejects a date that does not exist", () => {
    // 30 February parses as a plausible string and is not a day.
    expect(refusalFor("2026-02-30", "2026-03-01")).toBe("malformed");
    expect(refusalFor("2026-13-01", "2026-13-02")).toBe("malformed");
  });

  it("accepts 29 February in a leap year and refuses it otherwise", () => {
    expect(resolveRange("2028-02-29", "2028-03-01").status).toBe("ok");
    expect(refusalFor("2026-02-29", "2026-03-01")).toBe("malformed");
  });
});

describe("resolveRangeRequest", () => {
  it("uses the default period when nothing was asked for", () => {
    const result = resolveRangeRequest({}, JUST_BEFORE_CLINIC_MIDNIGHT);
    expect(result.range.from).toBe("2026-09-01");
    expect(result.range.to).toBe("2026-09-30");
  });

  it("uses a named preset", () => {
    const result = resolveRangeRequest(
      { preset: "last_month" },
      JUST_BEFORE_CLINIC_MIDNIGHT,
    );
    expect(result.fellBack).toBe(false);
    expect(result.range).toMatchObject({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("uses a valid custom period", () => {
    const result = resolveRangeRequest(
      { preset: "custom", from: "2026-07-01", to: "2026-07-31" },
      JUST_BEFORE_CLINIC_MIDNIGHT,
    );
    expect(result.fellBack).toBe(false);
    expect(result.range.from).toBe("2026-07-01");
    expect(result.range.preset).toBe("custom");
  });

  it("falls back and says why when a custom period is rejected", () => {
    // The part that matters: a rejected period is *reported*, not silently
    // replaced. Showing this month's numbers under last year's heading is the
    // kind of quiet wrongness somebody acts on.
    const result = resolveRangeRequest(
      { preset: "custom", from: "2026-01-01", to: "2027-06-01" },
      JUST_BEFORE_CLINIC_MIDNIGHT,
    );
    expect(result.fellBack).toBe(true);
    expect(result.problem).toBe("too_long");
    expect(result.range.from).toBe("2026-09-01");
  });

  it("falls back when a custom period is missing a date", () => {
    const result = resolveRangeRequest(
      { preset: "custom", from: "2026-07-01" },
      JUST_BEFORE_CLINIC_MIDNIGHT,
    );
    expect(result.fellBack).toBe(true);
  });

  it("falls back to a period the database will accept, whatever was asked", () => {
    // The fallback is narrower than the maximum, so a hostile request cannot
    // use it to widen anything.
    for (const input of [
      { preset: "custom", from: "1900-01-01", to: "2030-01-01" },
      { preset: "custom", from: "x", to: "y" },
      { preset: "nonsense" },
      {},
    ]) {
      const result = resolveRangeRequest(input, JUST_BEFORE_CLINIC_MIDNIGHT);
      expect(
        resolveRange(result.range.from, result.range.to).status,
        JSON.stringify(input),
      ).toBe("ok");
      expect(result.range.spanDays).toBeLessThanOrEqual(31);
    }
  });

  it("the default period is always inside the bounds, on any day of any month", () => {
    // Month-to-date on the 31st of a 31-day month is the longest it gets.
    for (const day of [
      "2026-01-01",
      "2026-01-31",
      "2026-02-28",
      "2028-02-29",
      "2026-12-31",
    ]) {
      const now = new Date(`${day}T06:00:00.000Z`);
      const range = defaultRange(now);
      expect(resolveRange(range.from, range.to).status, day).toBe("ok");
      expect(range.granularity, day).toBe("day");
    }
  });
});

describe("no daylight saving in the clinic's zone", () => {
  it("resolves the same clinic day across what would be a DST boundary elsewhere", () => {
    // India observes no daylight saving, so there is no transition to test in
    // the clinic's own zone. What is asserted instead is that the boundary is
    // always +05:30 — nothing here assumes a fixed offset in *code*, because
    // `toClinicIsoDate` resolves it per instant through `Intl`, but a clinic
    // in a DST zone would still get correct days from the same function.
    expect(clinicToday(new Date("2026-03-29T00:00:00.000Z"))).toBe(
      "2026-03-29",
    );
    expect(clinicToday(new Date("2026-10-25T00:00:00.000Z"))).toBe(
      "2026-10-25",
    );
    // 18:30Z is midnight at the clinic on both dates, DST elsewhere or not.
    expect(clinicToday(new Date("2026-03-28T18:30:00.000Z"))).toBe(
      "2026-03-29",
    );
    expect(clinicToday(new Date("2026-10-24T18:30:00.000Z"))).toBe(
      "2026-10-25",
    );
  });
});
