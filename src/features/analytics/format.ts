/**
 * Display formatting for analytics.
 *
 * ## Dates are formatted as clinic dates, without becoming instants
 *
 * A trend bucket is a **calendar date** — "the week beginning 7 September" —
 * and it never was an instant. Passing it through `new Date("2026-09-07")`
 * to format it would make it midnight UTC, which in the clinic's timezone is
 * half past five on the morning of the 7th; harmless here, and the habit that
 * produces an off-by-one day the moment somebody formats a date in a zone
 * behind UTC.
 *
 * So every function below parses the ISO parts and formats from a fixed
 * month table. There is no `Date` in this module at all, which makes the
 * output independent of the machine, the locale and the hour it runs at —
 * the same reasoning `features/patients/format.ts` records for a date of
 * birth.
 *
 * ## Weeks are named by their Monday
 *
 * Matching PostgreSQL's `date_trunc('week', ...)`, which is what produced the
 * bucket. A label that named a different day from the one the data was
 * grouped on would put the same appointments under two headings.
 */

import type { TrendGranularity } from "@/config/analytics";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parts(isoDate: string): DateParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;

  return {
    year: Number(isoDate.slice(0, 4)),
    month: Number(isoDate.slice(5, 7)),
    day: Number(isoDate.slice(8, 10)),
  };
}

/** "7 September 2026". The long form, for a heading or a range. */
export function formatClinicDay(isoDate: string): string {
  const value = parts(isoDate);
  if (!value) return isoDate;
  return `${value.day} ${MONTHS[value.month - 1]} ${value.year}`;
}

/** "7 Sep". The dense form, for an axis. */
export function formatClinicDayShort(isoDate: string): string {
  const value = parts(isoDate);
  if (!value) return isoDate;
  return `${value.day} ${MONTHS_SHORT[value.month - 1]}`;
}

/** "September 2026". */
export function formatClinicMonth(isoDate: string): string {
  const value = parts(isoDate);
  if (!value) return isoDate;
  return `${MONTHS[value.month - 1]} ${value.year}`;
}

/**
 * The label for one trend bucket.
 *
 * Short enough for an axis, and unambiguous: a week says which day it starts
 * on, because "w/c 7 Sep" read next to "14 Sep" would otherwise look like two
 * different kinds of thing.
 */
export function formatBucketLabel(
  isoDate: string,
  granularity: TrendGranularity,
): string {
  switch (granularity) {
    case "day":
      return formatClinicDayShort(isoDate);
    case "week":
      return `w/c ${formatClinicDayShort(isoDate)}`;
    case "month": {
      const value = parts(isoDate);
      if (!value) return isoDate;
      return `${MONTHS_SHORT[value.month - 1]} ${value.year}`;
    }
  }
}

/** "1 September to 30 September 2026", for a period heading. */
export function formatRangeLabel(from: string, to: string): string {
  const start = parts(from);
  const end = parts(to);
  if (!start || !end) return `${from} to ${to}`;

  if (from === to) return formatClinicDay(from);

  // The year is printed once when both ends share it, which is how a person
  // writes a date range.
  if (start.year === end.year) {
    return `${start.day} ${MONTHS[start.month - 1]} to ${end.day} ${
      MONTHS[end.month - 1]
    } ${end.year}`;
  }

  return `${formatClinicDay(from)} to ${formatClinicDay(to)}`;
}

/** The product's own word for an appointment status, as shown in analytics. */
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  requested: "Requested",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  in_consultation: "In consultation",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** Notification categories, in the words the preferences page uses. */
export const NOTIFICATION_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  appointment_updates: "Appointment updates",
  appointment_reminders: "Appointment reminders",
  clinical_updates: "Prescriptions and treatment plans",
};

/** Notification channels. */
export const CHANNEL_LABELS: Readonly<Record<string, string>> = {
  in_app: "In app",
  email: "Email",
};

/** Document kinds, in the words the upload form uses. */
export const DOCUMENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  lab_report: "Lab report",
  diagnostic_report: "Diagnostic report",
  medical_image: "Medical image",
  previous_prescription: "Previous prescription",
  referral: "Referral",
  previous_record: "Previous record",
  other: "Other",
};

/**
 * A label for a database enum value, falling back to the value itself.
 *
 * The fallback matters: a value added to an enum by a later migration renders
 * as its own name rather than as an empty cell, so a report never silently
 * loses a row.
 */
export function labelFor(
  table: Readonly<Record<string, string>>,
  value: string,
): string {
  return table[value] ?? value;
}
