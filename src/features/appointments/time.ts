/**
 * Timezone-safe scheduling time.
 *
 * ## The two representations, and the one place they meet
 *
 * An appointment has exactly one authoritative form: an **instant**, stored as
 * `timestamptz` and carried in JavaScript as a `Date`. It is not a formatted
 * string, and it is not a naive local date and time
 * (`phase_09.md` sections 11-12).
 *
 * Everything a human touches is the other form: a **clinic day** and a
 * **wall-clock minute** — "Tuesday 22 September, 10:30" at the clinic. That is
 * not an instant until you say where, and the where is `CLINIC_TIMEZONE`.
 *
 * This module is the only place the two are converted, in both directions. No
 * other file may call `new Date("2026-09-22 10:30")`, which is the
 * implementation-defined parse `phase_09.md` section 12 warns about — in some
 * engines it is local, in others UTC, and either way the answer changes with
 * the machine the server happens to be running on.
 *
 * ## How the conversion is done without a date library
 *
 * `Intl.DateTimeFormat` knows the timezone database. Formatting an instant in
 * a zone and reading the parts back gives that zone's offset *at that
 * instant*, which is the only correct way to ask — an offset is a property of
 * a moment, not of a zone.
 *
 * Going the other way needs two passes, because you cannot know the offset
 * until you know the instant and you cannot know the instant until you know
 * the offset. Guess with the first offset, then re-resolve; a second
 * disagreement only happens within a daylight-saving transition, and the
 * second answer is the right one.
 *
 * India observes no daylight saving, so in practice the first pass always
 * wins. The second pass is written anyway, because "the clinic will always be
 * in one non-DST zone" is the kind of assumption that survives right up until
 * the day it does not, and a scheduling bug that only appears twice a year is
 * the worst kind to find.
 *
 * ## Why no dependency was added
 *
 * `date-fns-tz`, `luxon` and `Temporal` polyfills all solve this. None was
 * added: `Intl` is built in, the two conversions below are the whole
 * requirement, and `AGENTS.md` section 40 asks whether existing capability can
 * do the job first. This file is under a hundred lines of logic and is
 * exhaustively tested.
 */

import { CLINIC_TIMEZONE } from "@/config/appointments";

/** Minutes in a day. A working interval may end here but not pass it. */
export const MINUTES_PER_DAY = 24 * 60;

/** An ISO calendar date, `YYYY-MM-DD`. Not an instant. */
export type IsoDate = string;

export interface ClinicWallClock {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  /** 1-31. */
  readonly day: number;
  /** 0 = Sunday, matching PostgreSQL `extract(dow)` and `Date#getDay()`. */
  readonly weekday: number;
  /** Minutes since local midnight. */
  readonly minuteOfDay: number;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A formatter that reports an instant's parts in a given zone.
 *
 * Cached per zone: constructing `Intl.DateTimeFormat` is comparatively
 * expensive and the slot generator calls this once per candidate.
 */
const partFormatters = new Map<string, Intl.DateTimeFormat>();

function partFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    // `h23` rather than `hour12: false`: the latter reports midnight as hour
    // 24 in some implementations, which silently shifts a day.
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  partFormatters.set(timeZone, formatter);
  return formatter;
}

function readParts(
  instant: Date,
  timeZone: string,
): Record<Intl.DateTimeFormatPartTypes, number> {
  const parts = partFormatter(timeZone).formatToParts(instant);
  const values = {} as Record<Intl.DateTimeFormatPartTypes, number>;

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return values;
}

/**
 * The zone's offset from UTC at this instant, in milliseconds.
 *
 * Positive east of Greenwich. Asked per instant rather than per zone, because
 * that is what an offset is.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = readParts(instant, timeZone);

  const asIfUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );

  // `instant` carries milliseconds the formatter does not report; drop them
  // from both sides so the difference is the offset and nothing else.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Whether a string is a well-formed ISO calendar date that exists. */
export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE_PATTERN.test(value)) return false;

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

/** How an instant reads on the clinic's wall clock. */
export function toClinicWallClock(
  instant: Date,
  timeZone: string = CLINIC_TIMEZONE,
): ClinicWallClock {
  const parts = readParts(instant, timeZone);
  const year = parts.year ?? 1970;
  const month = parts.month ?? 1;
  const day = parts.day ?? 1;

  return {
    year,
    month,
    day,
    // Derived from the *local* calendar date rather than from the instant, so
    // an appointment late on a Tuesday evening in a zone ahead of UTC is still
    // a Tuesday.
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    minuteOfDay: (parts.hour ?? 0) * 60 + (parts.minute ?? 0),
  };
}

/** The clinic calendar date an instant falls on, as `YYYY-MM-DD`. */
export function toClinicIsoDate(
  instant: Date,
  timeZone: string = CLINIC_TIMEZONE,
): IsoDate {
  const { year, month, day } = toClinicWallClock(instant, timeZone);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * The instant at which a clinic date and wall-clock minute occur.
 *
 * The inverse of {@link toClinicWallClock}, and the function every booking
 * goes through: a patient picks "22 September, 10:30" and this is what turns
 * that into the moment that is stored.
 *
 * Returns `null` for a date that does not exist, rather than a plausible wrong
 * answer.
 */
export function clinicWallClockToInstant(
  isoDate: string,
  minuteOfDay: number,
  timeZone: string = CLINIC_TIMEZONE,
): Date | null {
  if (!isIsoDate(isoDate)) return null;
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0) return null;

  const [year, month, day] = isoDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }

  const wallClockAsUtc = Date.UTC(year, month - 1, day, 0, minuteOfDay);

  // Pass one: what is the offset near this moment?
  const firstOffset = zoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  const firstGuess = wallClockAsUtc - firstOffset;

  // Pass two: at the instant we just computed, is the offset still that? It
  // differs only across a daylight-saving boundary, and then the second answer
  // is the correct one.
  const secondOffset = zoneOffsetMs(new Date(firstGuess), timeZone);

  return new Date(
    secondOffset === firstOffset ? firstGuess : wallClockAsUtc - secondOffset,
  );
}

/** `n` days after an ISO date, as an ISO date. Calendar arithmetic, not clock. */
export function addDaysToIsoDate(isoDate: IsoDate, days: number): IsoDate {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days),
  );

  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(
    shifted.getUTCMonth() + 1,
    2,
  )}-${pad(shifted.getUTCDate(), 2)}`;
}

/** Whole days between two ISO dates. Negative when `to` precedes `from`. */
export function daysBetweenIsoDates(from: IsoDate, to: IsoDate): number {
  return Math.round(
    (isoDateToUtcMidnight(to) - isoDateToUtcMidnight(from)) / 86_400_000,
  );
}

function isoDateToUtcMidnight(isoDate: IsoDate): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** 0 = Sunday, for an ISO calendar date. Independent of any timezone. */
export function weekdayOfIsoDate(isoDate: IsoDate): number {
  return new Date(isoDateToUtcMidnight(isoDate)).getUTCDay();
}

/**
 * A PostgreSQL `time` value as minutes since midnight.
 *
 * PostgREST returns `time` as `"09:00:00"`. Seconds are read so a schedule
 * entered with them is not silently truncated to a different minute; the
 * database's own check keeps intervals sane.
 */
export function sqlTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");

  if (hours > 24 || minutes > 59 || seconds > 59) return null;

  const total = hours * 60 + minutes + (seconds > 0 ? 1 : 0);
  return total > MINUTES_PER_DAY ? null : total;
}

function pad(value: number, width: number): string {
  return `${value}`.padStart(width, "0");
}

/*
 * ---------------------------------------------------------------------------
 * Display
 *
 * Every one of these formats *in the clinic's timezone*, not the viewer's.
 * A patient in another country checking their appointment must be told the
 * time they have to be in the room, not that time translated into wherever
 * they are sitting — which would be a correct instant and the wrong answer.
 *
 * `en-GB` rather than `en-IN`: `en-IN` renders dates as `22/9/2026`, which is
 * ambiguous to read back, and the product writes months out.
 * ---------------------------------------------------------------------------
 */

const displayFormatters = new Map<string, Intl.DateTimeFormat>();

function displayFormatter(
  key: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cached = displayFormatters.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIMEZONE,
    ...options,
  });
  displayFormatters.set(key, formatter);
  return formatter;
}

/** "Tuesday 22 September 2026". */
export function formatClinicDate(instant: Date): string {
  return displayFormatter("date", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(instant);
}

/** "Tue 22 Sep". For dense contexts such as a date strip. */
export function formatClinicDateShort(instant: Date): string {
  return displayFormatter("dateShort", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(instant);
}

/** "10:30 am". Lower case, because a clinic page is not a train timetable. */
export function formatClinicTime(instant: Date): string {
  return displayFormatter("time", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(instant)
    .toLowerCase();
}

/** "10:30 am to 11:15 am". Spelt out rather than an en dash, so it is read aloud. */
export function formatClinicTimeRange(startsAt: Date, endsAt: Date): string {
  return `${formatClinicTime(startsAt)} to ${formatClinicTime(endsAt)}`;
}

/** "Tuesday 22 September 2026, 10:30 am". */
export function formatClinicDateTime(instant: Date): string {
  return `${formatClinicDate(instant)}, ${formatClinicTime(instant)}`;
}

/** "45 minutes" / "1 hour" / "1 hour 30 minutes". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;

  return rest === 0 ? hourLabel : `${hourLabel} ${rest} minutes`;
}
