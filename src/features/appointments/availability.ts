/**
 * The availability engine.
 *
 * ## What it is, and what it is not
 *
 * Given a practitioner's working week, the periods they are unavailable, and
 * the length of the appointment, this computes the times a patient may be
 * offered. It is a pure function of its inputs: no session, no database, no
 * clock of its own. That is what makes the rules in `phase_09.md` section 13
 * testable one at a time rather than only observable through a booking.
 *
 * **It is a snapshot and nothing more.** `phase_09.md` section 42 and
 * `docs/DATABASE.md` section 11 are both explicit: availability shown to a
 * patient is a hint, and by the time they click it may be stale. The result of
 * this function never authorizes a booking. The booking path re-derives every
 * rule below inside the database, and the exclusion constraint settles the one
 * question no amount of re-deriving can — whether somebody else got there
 * first.
 *
 * ## The rules, in the order they are applied
 *
 *   1. The practitioner's working intervals for that weekday.
 *   2. Slots start on the configured grid, and the whole appointment — plus
 *      its buffer — must fit inside one interval.
 *   3. Minimum booking notice.
 *   4. Booking horizon.
 *   5. Existing appointments and blocked periods.
 *
 * Past times need no rule of their own: anything in the past is also inside
 * the minimum-notice window, and with a notice of zero the comparison is still
 * strictly against `now`.
 *
 * ## Why the buffer is included in the overlap test but not in the slot end
 *
 * A patient is told "10:30 to 11:15" — the appointment. The diary holds
 * `11:15` plus the buffer. Testing the held range against busy periods is what
 * stops two appointments being offered closer together than the buffer allows;
 * showing the held range to a patient would tell them to be there longer than
 * they need to be.
 */

import type { AvailabilitySlot, BusyInterval, WorkingInterval } from "./types";
import {
  MINUTES_PER_DAY,
  clinicWallClockToInstant,
  isIsoDate,
  weekdayOfIsoDate,
  type IsoDate,
} from "./time";

export interface AvailabilityInput {
  /** The clinic calendar date to generate slots for. */
  readonly date: string;
  /** The practitioner's recurring working intervals, all weekdays. */
  readonly workingIntervals: readonly WorkingInterval[];
  /** Existing appointments and blocked periods, in any order. */
  readonly busy: readonly BusyInterval[];
  /** From the appointment type. Never from the request. */
  readonly durationMinutes: number;
  /** From the appointment type. Never from the request. */
  readonly bufferMinutes: number;
  readonly slotIntervalMinutes: number;
  readonly minNoticeMinutes: number;
  readonly maxHorizonDays: number;
  /** Injected so the engine stays pure and the tests stay deterministic. */
  readonly now: Date;
  readonly timeZone?: string;
}

/**
 * The bookable start times on one clinic day.
 *
 * Returns an empty list — never throws — for a day the practitioner does not
 * work, a date outside the booking horizon, or a malformed date. "No slots" is
 * a state the UI already has to render honestly (`phase_09.md` section 46),
 * and an exception would turn it into an error screen.
 */
export function generateSlots(
  input: AvailabilityInput,
): readonly AvailabilitySlot[] {
  if (!isIsoDate(input.date)) return [];
  if (!isPositiveInteger(input.durationMinutes)) return [];
  if (!isPositiveInteger(input.slotIntervalMinutes)) return [];
  if (input.bufferMinutes < 0) return [];

  const weekday = weekdayOfIsoDate(input.date);
  const intervals = input.workingIntervals.filter(
    (interval) =>
      interval.weekday === weekday &&
      interval.endMinute > interval.startMinute &&
      interval.endMinute <= MINUTES_PER_DAY,
  );

  if (intervals.length === 0) return [];

  const earliest = input.now.getTime() + input.minNoticeMinutes * 60_000;
  const latest = input.now.getTime() + input.maxHorizonDays * 86_400_000;

  // A `Map` rather than an array, because two overlapping working intervals —
  // a data-entry mistake the schema deliberately allows — would otherwise
  // offer the same minute twice. Keyed by the instant, so the deduplication is
  // on what the slot actually is.
  const slots = new Map<number, AvailabilitySlot>();

  for (const interval of intervals) {
    // The grid is anchored to midnight, not to the interval's start, so a
    // working day beginning at 09:10 still offers 09:15 rather than 09:10 —
    // and so the times a patient is offered are the same ones the database's
    // grid check will accept.
    const firstSlot =
      Math.ceil(interval.startMinute / input.slotIntervalMinutes) *
      input.slotIntervalMinutes;

    for (
      let minute = firstSlot;
      minute + input.durationMinutes <= interval.endMinute;
      minute += input.slotIntervalMinutes
    ) {
      const startsAt = clinicWallClockToInstant(
        input.date,
        minute,
        input.timeZone,
      );
      if (!startsAt) continue;

      const startMs = startsAt.getTime();

      // Minimum notice, which also excludes every past time. Strictly greater,
      // so a slot exactly on the boundary is offered rather than being lost to
      // a rounding difference between this and the database's own check.
      if (startMs < earliest) continue;
      if (startMs > latest) continue;

      const endsAt = new Date(startMs + input.durationMinutes * 60_000);
      const blockedUntil = new Date(
        endsAt.getTime() + input.bufferMinutes * 60_000,
      );

      if (overlapsAny(startsAt, blockedUntil, input.busy)) continue;

      slots.set(startMs, { startsAt, endsAt });
    }
  }

  return [...slots.values()].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}

/**
 * Whether a held range collides with anything already in the diary.
 *
 * Half-open on both sides, which is what makes back-to-back appointments legal
 * (`phase_09.md` section 18): `[10:00, 10:30)` and `[10:30, 11:00)` do not
 * overlap. It is the same comparison the database's `tstzrange(..., '[)')`
 * makes, deliberately.
 */
export function overlapsAny(
  startsAt: Date,
  endsAt: Date,
  busy: readonly BusyInterval[],
): boolean {
  const start = startsAt.getTime();
  const end = endsAt.getTime();

  return busy.some(
    (interval) =>
      start < interval.endsAt.getTime() && end > interval.startsAt.getTime(),
  );
}

/** Whether the practitioner works at all on this weekday. */
export function worksOnWeekday(
  workingIntervals: readonly WorkingInterval[],
  weekday: number,
): boolean {
  return workingIntervals.some((interval) => interval.weekday === weekday);
}

/**
 * The clinic dates a patient may choose between.
 *
 * Working days only, and only inside the booking horizon — so the date strip
 * never offers a day that can hold no appointment. It deliberately does *not*
 * consult busy periods: that would mean loading the whole horizon's
 * appointments to draw a date picker, and a day whose slots are all taken
 * renders the empty state, which says what happened
 * (`phase_09.md` section 46).
 */
export function bookableDates(options: {
  readonly workingIntervals: readonly WorkingInterval[];
  readonly from: IsoDate;
  readonly days: number;
  readonly maxHorizonDays: number;
}): readonly IsoDate[] {
  const dates: IsoDate[] = [];
  const limit = Math.min(options.days, options.maxHorizonDays + 1);

  for (let offset = 0; offset < limit; offset += 1) {
    const date = addDays(options.from, offset);
    if (worksOnWeekday(options.workingIntervals, weekdayOfIsoDate(date))) {
      dates.push(date);
    }
  }

  return dates;
}

function addDays(isoDate: IsoDate, days: number): IsoDate {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days),
  );
  const pad = (value: number, width: number) => `${value}`.padStart(width, "0");

  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(
    shifted.getUTCMonth() + 1,
    2,
  )}-${pad(shifted.getUTCDate(), 2)}`;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
