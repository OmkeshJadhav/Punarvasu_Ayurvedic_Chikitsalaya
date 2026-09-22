/**
 * **The metric definitions.** One place, consumed by the dashboard, the API
 * and the export alike.
 *
 * `phase_16.md` sections 93, 94 and example 10 ask for exactly this and warn
 * against the failure it prevents: a completion rate calculated one way on a
 * dashboard and another way in an export, so that two people reading the same
 * clinic disagree about it. Nothing in `components/analytics/`,
 * `app/(app)/**` or `features/analytics/export.ts` divides one number by
 * another; they all call this module.
 *
 * ## Where each metric is actually computed
 *
 * The **counts** are computed in PostgreSQL, by
 * `analytics_appointment_counts()`. Section 28 and example 1: the database
 * aggregates, and the application receives a summary. Nothing here counts
 * rows, because nothing here ever receives rows.
 *
 * What this module does is turn those counts into the **derived** figures —
 * the three rates and utilization — which is arithmetic on numbers that have
 * already been aggregated, not a second aggregation. Section 113 permits the
 * frontend to *format* `67.4%` and forbids it to be where the metric comes
 * from; a rate over server-computed counts is the same division wherever it
 * runs, and doing it once here is what makes the dashboard and the export
 * agree by construction.
 *
 * ## The denominator, stated plainly
 *
 * Section 14 asks for the denominator to be explicit and warns against
 * casually mixing statuses. Every rate in this product divides by
 *
 *     eligible = completed + cancelled + no_show
 *
 * an appointment **whose outcome is known**. An appointment still `requested`,
 * `confirmed`, `checked_in` or `in_consultation` has not happened yet.
 * Counting those would mean March's cancellation rate fell every time somebody
 * booked an appointment in April, which is not a number anybody can act on.
 *
 * A consequence worth naming: the three rates sum to exactly 1 whenever
 * `eligible > 0`, and `metrics.test.ts` asserts it.
 *
 * ## Zero is not missing
 *
 * Section 96 and example 7. Every rate function returns `null` when its
 * denominator is zero, and the renderer says so in words. Returning `0` would
 * mean "none of the concluded appointments were cancelled", which is a claim
 * about a period that concluded nothing.
 *
 * ## Data quality
 *
 * Section 97 asks analytics to notice impossible states rather than render
 * them. `assertPlausible` below is where that happens: a rate outside `[0, 1]`
 * or a component count exceeding the total means the query or the data is
 * wrong, and a wrong number that looks right is worse than an honest gap. Such
 * a figure is reported as unavailable and logged, never drawn.
 */

import { RATE_DECIMAL_PLACES } from "@/config/analytics";

import type {
  AppointmentCounts,
  AppointmentRates,
  NotificationDelivery,
  NotificationVolume,
  Rate,
  Utilization,
} from "./types";

/**
 * A documented metric. The table a reader consults when they want to know
 * what a number on a screen actually means.
 *
 * Kept as data rather than as prose in a comment because the dashboard
 * renders `definition` beside the figure — section 92's "this prevents
 * ambiguous reporting" is only true if the definition reaches the person
 * reading the number.
 */
export interface MetricDefinition {
  readonly key: string;
  readonly label: string;
  /** The formula, in the clinic's words rather than in SQL. */
  readonly formula: string;
  /** Which timestamp places a record in the period, and on what boundary. */
  readonly dateSemantics: string;
}

export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    key: "appointments",
    label: "Appointments",
    formula: "Every appointment scheduled in the period, whatever its status.",
    dateSemantics:
      "By the clinic day the appointment starts on, in the clinic's timezone.",
  },
  {
    key: "completed",
    label: "Completed",
    formula: "Appointments the practitioner marked completed.",
    dateSemantics:
      "By the clinic day the appointment starts on, in the clinic's timezone.",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    formula:
      "Appointments cancelled by the patient or by the clinic. Cancelled appointments are never deleted, so this figure is stable.",
    dateSemantics:
      "By the clinic day the appointment was scheduled for, not the day it was cancelled.",
  },
  {
    key: "noShow",
    label: "No-shows",
    formula: "Appointments where the patient did not attend.",
    dateSemantics:
      "By the clinic day the appointment starts on, in the clinic's timezone.",
  },
  {
    key: "eligible",
    label: "Concluded",
    formula:
      "Completed + cancelled + no-show. The denominator of every rate below: appointments that have reached a final state. Appointments still upcoming are excluded.",
    dateSemantics:
      "By the clinic day the appointment starts on, in the clinic's timezone.",
  },
  {
    key: "completionRate",
    label: "Completion rate",
    formula: "Completed ÷ concluded.",
    dateSemantics: "Over the concluded appointments in the period.",
  },
  {
    key: "cancellationRate",
    label: "Cancellation rate",
    formula: "Cancelled ÷ concluded.",
    dateSemantics: "Over the concluded appointments in the period.",
  },
  {
    key: "noShowRate",
    label: "No-show rate",
    formula: "No-shows ÷ concluded.",
    dateSemantics: "Over the concluded appointments in the period.",
  },
  {
    key: "utilization",
    label: "Utilisation",
    formula:
      "Booked minutes ÷ available minutes. Available is the practitioner's working hours in the period minus blocked periods and closures; booked is the part of that covered by an appointment holding a slot. Booked time is limited to available time, so this cannot exceed 100%.",
    dateSemantics:
      "Working hours are taken per clinic day in the period, in the clinic's timezone.",
  },
  {
    key: "newPatients",
    label: "New patients",
    formula:
      "Patient records created in the period — whether the patient registered themselves or the front desk registered them. This counts patient records, not user accounts.",
    dateSemantics: "By the clinic day the record was created on.",
  },
  {
    key: "returningPatients",
    label: "Returning patients",
    formula:
      "Patients with a completed appointment in the period who also had a completed appointment before it started.",
    dateSemantics:
      "By the clinic day the appointments start on, in the clinic's timezone.",
  },
  {
    key: "activePatients",
    label: "Active patients",
    formula:
      "Patients with at least one appointment in the period that was not cancelled.",
    dateSemantics:
      "By the clinic day the appointment starts on, in the clinic's timezone.",
  },
  {
    key: "totalPatients",
    label: "Registered patients",
    formula:
      "Patient records that existed at the end of the period. A point in time, so a report about March reads the same in April.",
    dateSemantics: "As at the end of the last clinic day in the period.",
  },
  {
    key: "acceptanceRate",
    label: "Acceptance rate",
    formula:
      "Accepted ÷ (accepted + failed) notification sends. This is not a delivery rate: it means the provider accepted the message for sending. No configured provider confirms delivery to the recipient.",
    dateSemantics: "By when the send was attempted.",
  },
] as const;

/** One definition by key, for a tooltip or a definitions table. */
export function metricDefinition(key: string): MetricDefinition | undefined {
  return METRIC_DEFINITIONS.find((definition) => definition.key === key);
}

/**
 * Whether a set of counts is internally consistent (section 97).
 *
 * A component count larger than the total, a negative figure, or an
 * `eligible` that is not the sum of the three concluded statuses all mean the
 * query is wrong rather than the clinic having had a strange month.
 */
export function countsArePlausible(counts: AppointmentCounts): boolean {
  const values = [
    counts.total,
    counts.requested,
    counts.confirmed,
    counts.checkedIn,
    counts.inConsultation,
    counts.completed,
    counts.cancelled,
    counts.noShow,
    counts.eligible,
  ];

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return false;
  }

  if (counts.eligible !== counts.completed + counts.cancelled + counts.noShow) {
    return false;
  }

  const parts =
    counts.requested +
    counts.confirmed +
    counts.checkedIn +
    counts.inConsultation +
    counts.eligible;

  return parts === counts.total;
}

/**
 * `numerator / denominator`, or `null` when there is nothing to divide by.
 *
 * The one place a rate is produced in this feature. It clamps nothing and
 * hides nothing: an impossible ratio returns `null` rather than a plausible
 * wrong answer, so a caller cannot draw a bar at 140%.
 */
export function rate(numerator: number, denominator: number): Rate {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  if (numerator < 0) return null;

  const value = numerator / denominator;
  return value > 1 ? null : value;
}

/** The three appointment rates, over the concluded denominator. */
export function appointmentRates(counts: AppointmentCounts): AppointmentRates {
  return {
    completionRate: rate(counts.completed, counts.eligible),
    cancellationRate: rate(counts.cancelled, counts.eligible),
    noShowRate: rate(counts.noShow, counts.eligible),
  };
}

/**
 * Utilization from booked and available minutes.
 *
 * The clamping that makes this safe happens in SQL, where booked time is
 * intersected with available time. This adds the honest-null rule: a
 * practitioner with no roster in the period has no utilization, which is not
 * the same as being 0% utilised.
 */
export function utilization(
  bookedMinutes: number,
  availableMinutes: number,
): Utilization {
  return {
    bookedMinutes,
    availableMinutes,
    utilizationRate: rate(bookedMinutes, availableMinutes),
  };
}

/**
 * The share of attempted sends a provider accepted.
 *
 * **Not a delivery rate.** Section 41 is explicit, and Phase 15's own schema
 * agrees: there is no `delivered` status because no configured provider
 * reports one. `pending` is excluded from the denominator because it has not
 * been attempted yet; including it would make the figure drop every time the
 * worker queued something.
 */
export function acceptanceRate(
  delivery: Pick<NotificationDelivery, "sent" | "failed">,
): Rate {
  return rate(delivery.sent, delivery.sent + delivery.failed);
}

/** The share of shown notifications a patient has opened. */
export function notificationReadRate(
  volume: Pick<NotificationVolume, "active" | "readCount">,
): Rate {
  return rate(volume.readCount, volume.active);
}

/**
 * A rate as a percentage string, or the caller's words for "there is nothing
 * to measure".
 *
 * Section 95: one decimal place, consistently, everywhere. Formatting is the
 * one thing section 113 does allow the presentation layer to do, and it is
 * done here so that it is done the same way on a card, in a table and in the
 * chart's data alternative.
 */
export function formatRate(value: Rate, fallback = "—"): string {
  if (value === null) return fallback;
  return `${(value * 100).toFixed(RATE_DECIMAL_PLACES)}%`;
}

/** "6 hours 30 minutes" from a minute count, for the utilization figures. */
export function formatMinutes(minutes: number): string {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} minutes`;

  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;

  return rest === 0 ? hourLabel : `${hourLabel} ${rest} minutes`;
}

/** A whole number with thousands separators. `en-GB`, as everywhere else. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

/** Counts with every field zero. The shape an empty period produces. */
export const EMPTY_APPOINTMENT_COUNTS: AppointmentCounts = {
  total: 0,
  requested: 0,
  confirmed: 0,
  checkedIn: 0,
  inConsultation: 0,
  completed: 0,
  cancelled: 0,
  noShow: 0,
  eligible: 0,
};
