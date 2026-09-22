import { describe, expect, it } from "vitest";

import { CLINIC_TIMEZONE } from "@/config/appointments";

import {
  addDaysToIsoDate,
  clinicWallClockToInstant,
  daysBetweenIsoDates,
  formatClinicDate,
  formatClinicDateShort,
  formatClinicDateTime,
  formatClinicTime,
  formatClinicTimeRange,
  formatDuration,
  isIsoDate,
  sqlTimeToMinutes,
  toClinicIsoDate,
  toClinicWallClock,
  weekdayOfIsoDate,
} from "./time";

/**
 * Timezone-safe scheduling time.
 *
 * These are the assertions the whole engine rests on. If a clinic date and a
 * wall-clock minute do not turn into the right instant, every other rule —
 * working hours, minimum notice, conflict detection — is being applied to the
 * wrong moment, and the failure is invisible to anybody developing in the
 * clinic's own timezone.
 *
 * So the conversions are checked against a **second timezone** as well as the
 * clinic's, including one that observes daylight saving. The clinic is in
 * India and India does not, which is exactly why a test that only used
 * `Asia/Kolkata` would prove nothing about the two-pass offset resolution.
 */

/** 2026-09-22 is a Tuesday. Asserted below rather than assumed. */
const TUESDAY = "2026-09-22";

describe("isIsoDate", () => {
  it("accepts a real calendar date", () => {
    expect(isIsoDate("2026-09-22")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    // `new Date(Date.UTC(2026, 1, 30))` silently rolls over to 2 March rather
    // than failing, which is what this guards.
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2025-02-29")).toBe(false);
  });

  it("rejects anything that is not a bare ISO date", () => {
    for (const value of [
      "",
      "2026-9-22",
      "22-09-2026",
      "2026/09/22",
      "2026-09-22T10:30:00Z",
      "2026-09-22 ",
      "not a date",
    ]) {
      expect(isIsoDate(value)).toBe(false);
    }
  });
});

describe("clinicWallClockToInstant", () => {
  it("converts a clinic wall clock to the right absolute instant", () => {
    // India is UTC+05:30 all year, so 09:00 local is 03:30Z.
    const instant = clinicWallClockToInstant(TUESDAY, 9 * 60);
    expect(instant?.toISOString()).toBe("2026-09-22T03:30:00.000Z");
  });

  it("round-trips through the clinic wall clock", () => {
    for (const minute of [0, 1, 330, 540, 750, 1439]) {
      const instant = clinicWallClockToInstant(TUESDAY, minute);
      expect(instant).not.toBeNull();

      const wallClock = toClinicWallClock(instant as Date);
      expect(wallClock.minuteOfDay).toBe(minute);
      expect(toClinicIsoDate(instant as Date)).toBe(TUESDAY);
    }
  });

  it("keeps the clinic's calendar day for a late-evening appointment", () => {
    // 23:30 IST is 18:00Z the *same* day, but a naive implementation that
    // built the date in UTC and formatted it locally could report either the
    // day before or the day after.
    const instant = clinicWallClockToInstant(TUESDAY, 23 * 60 + 30);
    expect(instant?.toISOString()).toBe("2026-09-22T18:00:00.000Z");
    expect(toClinicIsoDate(instant as Date)).toBe(TUESDAY);
  });

  it("resolves the offset for the instant, not for the zone", () => {
    // New York in September is UTC-4 (daylight saving); in January it is
    // UTC-5. A single stored offset would get one of these wrong, which is
    // the bug the two-pass resolution exists to prevent.
    const summer = clinicWallClockToInstant(
      "2026-07-01",
      9 * 60,
      "America/New_York",
    );
    const winter = clinicWallClockToInstant(
      "2026-01-15",
      9 * 60,
      "America/New_York",
    );

    expect(summer?.toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(winter?.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("round-trips across a daylight-saving boundary", () => {
    // 8 March 2026, the US spring-forward day. 09:00 local exists and is
    // EDT; the conversion must not land an hour out.
    const instant = clinicWallClockToInstant(
      "2026-03-08",
      9 * 60,
      "America/New_York",
    );
    expect(instant).not.toBeNull();

    const wallClock = toClinicWallClock(instant as Date, "America/New_York");
    expect(wallClock.minuteOfDay).toBe(9 * 60);
    expect(toClinicIsoDate(instant as Date, "America/New_York")).toBe(
      "2026-03-08",
    );
  });

  it("refuses a date that does not exist rather than rolling it over", () => {
    expect(clinicWallClockToInstant("2026-02-30", 600)).toBeNull();
    expect(clinicWallClockToInstant("not-a-date", 600)).toBeNull();
  });

  it("refuses a nonsensical minute", () => {
    expect(clinicWallClockToInstant(TUESDAY, -1)).toBeNull();
    expect(clinicWallClockToInstant(TUESDAY, 10.5)).toBeNull();
    expect(clinicWallClockToInstant(TUESDAY, Number.NaN)).toBeNull();
  });
});

describe("toClinicWallClock", () => {
  it("reports the weekday of the clinic's calendar day", () => {
    const instant = clinicWallClockToInstant(TUESDAY, 10 * 60) as Date;
    expect(toClinicWallClock(instant).weekday).toBe(2);
  });

  it("uses the clinic day, not the UTC day, for the weekday", () => {
    // 2026-09-21 is a Monday. 00:30 IST on that Monday is 19:00Z on Sunday —
    // so a weekday derived from the UTC instant would say Sunday and the
    // appointment would be checked against the wrong working hours.
    const instant = clinicWallClockToInstant("2026-09-21", 30) as Date;
    expect(instant.toISOString()).toBe("2026-09-20T19:00:00.000Z");
    expect(instant.getUTCDay()).toBe(0);
    expect(toClinicWallClock(instant).weekday).toBe(1);
  });
});

describe("weekdayOfIsoDate", () => {
  it("is Sunday-based, matching PostgreSQL extract(dow)", () => {
    expect(weekdayOfIsoDate("2026-09-20")).toBe(0);
    expect(weekdayOfIsoDate("2026-09-21")).toBe(1);
    expect(weekdayOfIsoDate(TUESDAY)).toBe(2);
    expect(weekdayOfIsoDate("2026-09-26")).toBe(6);
  });
});

describe("addDaysToIsoDate", () => {
  it("does calendar arithmetic, including across months and years", () => {
    expect(addDaysToIsoDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToIsoDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToIsoDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDaysToIsoDate(TUESDAY, 0)).toBe(TUESDAY);
  });
});

describe("daysBetweenIsoDates", () => {
  it("counts whole calendar days in both directions", () => {
    expect(daysBetweenIsoDates("2026-09-22", "2026-09-22")).toBe(0);
    expect(daysBetweenIsoDates("2026-09-22", "2026-09-29")).toBe(7);
    expect(daysBetweenIsoDates("2026-09-29", "2026-09-22")).toBe(-7);
    expect(daysBetweenIsoDates("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("sqlTimeToMinutes", () => {
  it("reads a PostgreSQL time value", () => {
    expect(sqlTimeToMinutes("09:00:00")).toBe(540);
    expect(sqlTimeToMinutes("13:30:00")).toBe(810);
    expect(sqlTimeToMinutes("00:00:00")).toBe(0);
    expect(sqlTimeToMinutes("18:00")).toBe(1080);
  });

  it("rejects a value it cannot read rather than guessing", () => {
    for (const value of ["", "9:00", "noon", "25:00:00", "10:61:00"]) {
      expect(sqlTimeToMinutes(value)).toBeNull();
    }
  });
});

describe("display formatting", () => {
  const instant = clinicWallClockToInstant(TUESDAY, 10 * 60 + 30) as Date;
  const end = clinicWallClockToInstant(TUESDAY, 11 * 60 + 15) as Date;

  it("formats in the clinic's timezone, not the viewer's", () => {
    expect(formatClinicDate(instant)).toBe("Tuesday, 22 September 2026");
    expect(formatClinicTime(instant)).toBe("10:30 am");
    expect(formatClinicDateShort(instant)).toBe("Tue 22 Sept");
    expect(formatClinicDateTime(instant)).toBe(
      "Tuesday, 22 September 2026, 10:30 am",
    );
    expect(formatClinicTimeRange(instant, end)).toBe("10:30 am to 11:15 am");
  });

  it("shows a patient the time they must be in the room", () => {
    // The same instant, expressed in UTC, is 05:00 — five and a half hours
    // earlier. A patient who was shown that would arrive on the wrong day's
    // worth of confusion. This is the assertion that says the product tells
    // them clinic time.
    expect(instant.toISOString()).toBe("2026-09-22T05:00:00.000Z");
    expect(formatClinicTime(instant)).not.toContain("5:00");
  });

  it("handles midnight and noon without a 24 o'clock", () => {
    const midnight = clinicWallClockToInstant(TUESDAY, 0) as Date;
    const noon = clinicWallClockToInstant(TUESDAY, 12 * 60) as Date;

    expect(formatClinicTime(midnight)).toBe("12:00 am");
    expect(formatClinicTime(noon)).toBe("12:00 pm");
    expect(toClinicWallClock(midnight).minuteOfDay).toBe(0);
  });
});

describe("formatDuration", () => {
  it("reads as a person would say it", () => {
    expect(formatDuration(30)).toBe("30 minutes");
    expect(formatDuration(45)).toBe("45 minutes");
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(90)).toBe("1 hour 30 minutes");
    expect(formatDuration(120)).toBe("2 hours");
    expect(formatDuration(135)).toBe("2 hours 15 minutes");
  });
});

describe("the clinic timezone", () => {
  it("is a real IANA zone", () => {
    expect(
      () => new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE }),
    ).not.toThrow();
  });

  it("is the zone of the clinic's verified address", () => {
    // The clinic's address is in Satara, Maharashtra (`config/clinic.ts`).
    // This is derived from a verified fact rather than assumed from a server
    // locale, and it is asserted so that changing one without the other is a
    // failing test rather than a silently wrong schedule.
    expect(CLINIC_TIMEZONE).toBe("Asia/Kolkata");
  });
});
