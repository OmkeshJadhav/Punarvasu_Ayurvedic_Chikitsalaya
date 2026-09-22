import { describe, expect, it } from "vitest";

import {
  bookableDates,
  generateSlots,
  overlapsAny,
  worksOnWeekday,
  type AvailabilityInput,
} from "./availability";
import { clinicWallClockToInstant, formatClinicTime } from "./time";
import type { WorkingInterval } from "./types";

/**
 * The availability engine.
 *
 * `phase_09.md` section 66 lists the rules that must be covered, and each has
 * its own test below: working hours, existing appointments, blocked periods,
 * past times, minimum notice and booking horizon.
 *
 * Every test injects `now`, so none of them depends on when it is run. A
 * scheduling test that passes in the morning and fails at midnight is not a
 * test (`docs/QA_STRATEGY.md` section 34).
 */

/** Tuesday. Clinic timezone is UTC+05:30, so 09:00 local is 03:30Z. */
const TUESDAY = "2026-09-22";
const WEDNESDAY = "2026-09-23";
/** Sunday — the practitioner below does not work. */
const SUNDAY = "2026-09-20";

/** Tuesday and Wednesday, 09:00-13:00 and 14:00-17:00. A split day. */
const WORKING_WEEK: readonly WorkingInterval[] = [
  { weekday: 2, startMinute: 9 * 60, endMinute: 13 * 60 },
  { weekday: 2, startMinute: 14 * 60, endMinute: 17 * 60 },
  { weekday: 3, startMinute: 9 * 60, endMinute: 13 * 60 },
];

/** Long before any slot on the test days, so notice never bites by accident. */
const WELL_BEFORE = new Date("2026-09-20T00:00:00.000Z");

function at(date: string, minuteOfDay: number): Date {
  const instant = clinicWallClockToInstant(date, minuteOfDay);
  if (!instant) throw new Error(`Unrepresentable time: ${date} ${minuteOfDay}`);
  return instant;
}

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: TUESDAY,
    workingIntervals: WORKING_WEEK,
    busy: [],
    durationMinutes: 30,
    bufferMinutes: 0,
    slotIntervalMinutes: 15,
    minNoticeMinutes: 0,
    maxHorizonDays: 90,
    now: WELL_BEFORE,
    ...overrides,
  };
}

/** The offered times, as a patient would read them. */
function times(result: readonly { startsAt: Date }[]): string[] {
  return result.map((slot) => formatClinicTime(slot.startsAt));
}

describe("working hours", () => {
  it("offers slots across both intervals of a split day", () => {
    const slots = generateSlots(input());

    expect(times(slots)[0]).toBe("9:00 am");
    // The last slot of the morning starts 30 minutes before it ends, so the
    // appointment finishes exactly at 13:00.
    expect(slots.map((slot) => formatClinicTime(slot.endsAt))).toContain(
      "1:00 pm",
    );
    expect(times(slots)).toContain("2:00 pm");
    expect(times(slots).at(-1)).toBe("4:30 pm");
  });

  it("never offers an appointment that would run past the end of an interval", () => {
    // 12:45 + 30 minutes is 13:15, which is outside the morning interval.
    expect(times(generateSlots(input()))).not.toContain("12:45 pm");
  });

  it("offers nothing on a day the practitioner does not work", () => {
    expect(generateSlots(input({ date: SUNDAY }))).toEqual([]);
  });

  it("uses the weekday of the clinic's calendar date", () => {
    const wednesday = generateSlots(input({ date: WEDNESDAY }));
    expect(times(wednesday).at(-1)).toBe("12:30 pm");
    // Wednesday has no afternoon interval, so nothing after lunch.
    expect(times(wednesday)).not.toContain("2:00 pm");
  });

  it("shortens the day when the appointment is longer", () => {
    // Three hours fits the 09:00-13:00 morning five times on the grid, and
    // the 14:00-17:00 afternoon exactly once.
    const long = generateSlots(input({ durationMinutes: 180 }));
    expect(times(long)).toEqual([
      "9:00 am",
      "9:15 am",
      "9:30 am",
      "9:45 am",
      "10:00 am",
      "2:00 pm",
    ]);
  });

  it("anchors the grid to midnight, not to the interval's start", () => {
    // A working day starting at 09:10 offers 09:15, because that is what the
    // database's grid check will accept. Offering 09:10 would show a patient a
    // time that would then be refused.
    const slots = generateSlots(
      input({
        workingIntervals: [
          { weekday: 2, startMinute: 9 * 60 + 10, endMinute: 11 * 60 },
        ],
      }),
    );

    expect(times(slots)[0]).toBe("9:15 am");
  });

  it("deduplicates when two working intervals overlap", () => {
    // Overlapping intervals are a data-entry mistake the schema allows. The
    // result must not offer the same minute twice.
    const slots = generateSlots(
      input({
        workingIntervals: [
          { weekday: 2, startMinute: 9 * 60, endMinute: 11 * 60 },
          { weekday: 2, startMinute: 10 * 60, endMinute: 12 * 60 },
        ],
      }),
    );

    expect(new Set(times(slots)).size).toBe(slots.length);
    // And it stays in order.
    expect(times(slots)).toEqual([...times(slots)].sort(byClockOrder));
  });
});

describe("existing appointments", () => {
  it("excludes a slot an appointment already occupies", () => {
    const slots = generateSlots(
      input({
        busy: [
          { startsAt: at(TUESDAY, 10 * 60), endsAt: at(TUESDAY, 10 * 60 + 30) },
        ],
      }),
    );

    expect(times(slots)).not.toContain("10:00 am");
    // And every slot that would overlap it.
    expect(times(slots)).not.toContain("9:45 am");
    expect(times(slots)).not.toContain("10:15 am");
  });

  it("still offers the slot that starts exactly when one ends", () => {
    // Back-to-back is legal unless a buffer separates them
    // (`phase_09.md` section 18). The comparison is half-open on both sides,
    // matching the database's `tstzrange(..., '[)')`.
    const slots = generateSlots(
      input({
        busy: [
          { startsAt: at(TUESDAY, 10 * 60), endsAt: at(TUESDAY, 10 * 60 + 30) },
        ],
      }),
    );

    expect(times(slots)).toContain("10:30 am");
    expect(times(slots)).toContain("9:30 am");
  });

  it("separates appointments by the configured buffer", () => {
    // A busy interval is the *held* range, not the consultation: the database
    // returns `blocked_until`, which is `ends_at` plus the buffer that was
    // configured when that appointment was booked. So a 10:00-10:30
    // consultation with a 15-minute buffer arrives here as 10:00-10:45, and
    // the separation is enforced by the interval rather than by a rule the
    // generator applies afterwards.
    const slots = generateSlots(
      input({
        bufferMinutes: 15,
        busy: [
          { startsAt: at(TUESDAY, 10 * 60), endsAt: at(TUESDAY, 10 * 60 + 45) },
        ],
      }),
    );

    expect(times(slots)).not.toContain("10:30 am");
    expect(times(slots)).toContain("10:45 am");
  });

  it("holds the buffer after the new appointment too", () => {
    // The new booking's own buffer extends the range it needs free, so a slot
    // whose buffer would run into an existing appointment is not offered.
    // 9:30 + 30 minutes + 15 buffer = 10:15, which collides with a 10:00
    // appointment; 9:15 + 30 + 15 = 10:00 exactly, which does not.
    const slots = generateSlots(
      input({
        bufferMinutes: 15,
        busy: [
          { startsAt: at(TUESDAY, 10 * 60), endsAt: at(TUESDAY, 10 * 60 + 30) },
        ],
      }),
    );

    expect(times(slots)).not.toContain("9:30 am");
    expect(times(slots)).not.toContain("9:45 am");
    expect(times(slots)).toContain("9:15 am");
  });
});

describe("blocked periods", () => {
  it("excludes a blocked morning", () => {
    const slots = generateSlots(
      input({
        busy: [{ startsAt: at(TUESDAY, 9 * 60), endsAt: at(TUESDAY, 13 * 60) }],
      }),
    );

    expect(times(slots)).toEqual([
      "2:00 pm",
      "2:15 pm",
      "2:30 pm",
      "2:45 pm",
      "3:00 pm",
      "3:15 pm",
      "3:30 pm",
      "3:45 pm",
      "4:00 pm",
      "4:15 pm",
      "4:30 pm",
    ]);
  });

  it("excludes the whole day when the clinic is closed", () => {
    const slots = generateSlots(
      input({
        busy: [{ startsAt: at(TUESDAY, 0), endsAt: at(WEDNESDAY, 0) }],
      }),
    );

    expect(slots).toEqual([]);
  });
});

describe("past times and minimum notice", () => {
  it("offers nothing in the past", () => {
    // `now` is midday on the day itself: the morning is gone.
    const slots = generateSlots(input({ now: at(TUESDAY, 12 * 60) }));

    expect(times(slots)).not.toContain("9:00 am");
    expect(times(slots)).not.toContain("11:45 am");
    expect(times(slots)).toContain("2:00 pm");
  });

  it("respects the minimum booking notice", () => {
    // 09:00 with two hours' notice: the first bookable time is 11:00.
    const slots = generateSlots(
      input({ now: at(TUESDAY, 9 * 60), minNoticeMinutes: 120 }),
    );

    expect(times(slots)).not.toContain("10:45 am");
    expect(times(slots)[0]).toBe("11:00 am");
  });

  it("offers a slot that falls exactly on the notice boundary", () => {
    // Strictly-less-than, so a rounding difference between this and the
    // database's own check cannot silently lose the boundary slot.
    const slots = generateSlots(
      input({ now: at(TUESDAY, 9 * 60), minNoticeMinutes: 60 }),
    );

    expect(times(slots)[0]).toBe("10:00 am");
  });

  it("offers nothing at all once the working day has passed", () => {
    expect(generateSlots(input({ now: at(TUESDAY, 23 * 60) }))).toEqual([]);
  });
});

describe("booking horizon", () => {
  it("offers nothing beyond the horizon", () => {
    const slots = generateSlots(input({ now: WELL_BEFORE, maxHorizonDays: 1 }));

    // TUESDAY is two days after `now`, so with a one-day horizon it is out.
    expect(slots).toEqual([]);
  });

  it("offers the day that sits on the horizon", () => {
    const slots = generateSlots(input({ now: WELL_BEFORE, maxHorizonDays: 3 }));

    expect(slots.length).toBeGreaterThan(0);
  });
});

describe("defensive behaviour", () => {
  it("returns an empty list rather than throwing on nonsense", () => {
    // An empty result renders the honest "no times available" state
    // (`phase_09.md` section 46); an exception would render an error screen
    // for something that is not an error.
    expect(generateSlots(input({ date: "not-a-date" }))).toEqual([]);
    expect(generateSlots(input({ date: "2026-02-30" }))).toEqual([]);
    expect(generateSlots(input({ durationMinutes: 0 }))).toEqual([]);
    expect(generateSlots(input({ durationMinutes: -30 }))).toEqual([]);
    expect(generateSlots(input({ slotIntervalMinutes: 0 }))).toEqual([]);
    expect(generateSlots(input({ bufferMinutes: -15 }))).toEqual([]);
    expect(generateSlots(input({ workingIntervals: [] }))).toEqual([]);
  });

  it("ignores a working interval that ends before it starts", () => {
    expect(
      generateSlots(
        input({
          workingIntervals: [
            { weekday: 2, startMinute: 17 * 60, endMinute: 9 * 60 },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("never offers an appointment that would run past midnight", () => {
    const slots = generateSlots(
      input({
        durationMinutes: 60,
        workingIntervals: [
          { weekday: 2, startMinute: 23 * 60, endMinute: 24 * 60 },
        ],
      }),
    );

    expect(times(slots)).toEqual(["11:00 pm"]);
  });
});

describe("overlapsAny", () => {
  const busy = [{ startsAt: at(TUESDAY, 600), endsAt: at(TUESDAY, 630) }];

  it("is half-open at both ends", () => {
    expect(overlapsAny(at(TUESDAY, 570), at(TUESDAY, 600), busy)).toBe(false);
    expect(overlapsAny(at(TUESDAY, 630), at(TUESDAY, 660), busy)).toBe(false);
    expect(overlapsAny(at(TUESDAY, 599), at(TUESDAY, 601), busy)).toBe(true);
    expect(overlapsAny(at(TUESDAY, 610), at(TUESDAY, 620), busy)).toBe(true);
    expect(overlapsAny(at(TUESDAY, 540), at(TUESDAY, 720), busy)).toBe(true);
  });

  it("is false against an empty diary", () => {
    expect(overlapsAny(at(TUESDAY, 600), at(TUESDAY, 630), [])).toBe(false);
  });
});

describe("bookableDates", () => {
  it("returns only working days, in order", () => {
    const dates = bookableDates({
      workingIntervals: WORKING_WEEK,
      from: SUNDAY,
      days: 14,
      maxHorizonDays: 90,
    });

    expect(dates).toEqual([
      "2026-09-22",
      "2026-09-23",
      "2026-09-29",
      "2026-09-30",
    ]);
  });

  it("never runs past the booking horizon", () => {
    const dates = bookableDates({
      workingIntervals: WORKING_WEEK,
      from: SUNDAY,
      days: 365,
      maxHorizonDays: 3,
    });

    expect(dates).toEqual(["2026-09-22", "2026-09-23"]);
  });

  it("is empty for a practitioner with no working week", () => {
    expect(
      bookableDates({
        workingIntervals: [],
        from: SUNDAY,
        days: 30,
        maxHorizonDays: 90,
      }),
    ).toEqual([]);
  });
});

describe("worksOnWeekday", () => {
  it("answers for the weekday, not the date", () => {
    expect(worksOnWeekday(WORKING_WEEK, 2)).toBe(true);
    expect(worksOnWeekday(WORKING_WEEK, 3)).toBe(true);
    expect(worksOnWeekday(WORKING_WEEK, 0)).toBe(false);
    expect(worksOnWeekday(WORKING_WEEK, 6)).toBe(false);
  });
});

/** Orders "9:00 am" before "10:00 am" before "2:00 pm". */
function byClockOrder(a: string, b: string): number {
  return toMinutes(a) - toMinutes(b);
}

function toMinutes(label: string): number {
  const match = /^(\d{1,2}):(\d{2}) (am|pm)$/.exec(label);
  if (!match) return 0;

  const hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  return (match[3] === "pm" ? hour + 12 : hour) * 60 + minute;
}
