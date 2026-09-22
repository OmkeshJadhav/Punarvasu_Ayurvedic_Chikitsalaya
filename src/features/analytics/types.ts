/**
 * The analytics domain model.
 *
 * ## Every type here is a count, a rate or a label
 *
 * There is no patient id, no patient name, no appointment id, no clinical
 * field and no free text from a domain record in any shape below. That is the
 * privacy boundary of `phase_16.md` sections 3, 35, 88 and 90 expressed where
 * the compiler can see it: a leak would have to start by adding a field here,
 * and `content-safety` style tests assert none exists.
 *
 * The one name that does appear is a practitioner's professional display
 * name, which is on the clinic's own diary and is what makes a workload table
 * readable.
 *
 * ## Why a discriminated result and not `T | null`
 *
 * Section 96 and example 7. "No appointments in this period" and "we could not
 * load this" are different facts and must reach the screen as different
 * states, because rendering the second as a zero is how a dashboard starts
 * lying. Every read in this feature returns one of these three.
 */

import type { TrendGranularity } from "@/config/analytics";
import type { AppointmentStatus } from "@/features/appointments/types";

/**
 * A resolved, validated reporting period.
 *
 * `from` and `to` are **clinic calendar dates**, both inclusive, and the
 * instant range they denote is half-open — see `ranges.ts`. They are never
 * instants, because "March" is not an instant.
 */
export interface AnalyticsRange {
  readonly from: string;
  readonly to: string;
  /** Days covered, counting both ends. Drives the trend granularity. */
  readonly spanDays: number;
  readonly granularity: TrendGranularity;
  /** How the period was chosen, so the filter can show what is selected. */
  readonly preset: string;
}

/** Appointment counts over a period. The shape every rate is derived from. */
export interface AppointmentCounts {
  readonly total: number;
  readonly requested: number;
  readonly confirmed: number;
  readonly checkedIn: number;
  readonly inConsultation: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly noShow: number;
  /**
   * Appointments whose outcome is known: completed + cancelled + no-show.
   *
   * The denominator of every rate in this product, defined once in the
   * database and named the same thing here. See `metrics.ts`.
   */
  readonly eligible: number;
}

/**
 * A rate, or the honest absence of one.
 *
 * `null` means the denominator was zero — there is nothing to take a
 * percentage of. It is deliberately not `0`, because "no concluded
 * appointments" and "none of them were cancelled" are different answers and
 * section 64 forbids showing the second when the first is true.
 */
export type Rate = number | null;

export interface AppointmentRates {
  readonly completionRate: Rate;
  readonly cancellationRate: Rate;
  readonly noShowRate: Rate;
}

/** One point on a trend. Every bucket in the range is present, zeroes included. */
export interface TrendPoint {
  /** The first clinic date of the bucket. */
  readonly bucketStart: string;
  readonly total: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly noShow: number;
}

/** Time booked against time available, from Phase 09's scheduling model. */
export interface Utilization {
  readonly bookedMinutes: number;
  readonly availableMinutes: number;
  /** `booked / available`, or null when the practitioner had no roster. */
  readonly utilizationRate: Rate;
}

/** One practitioner's operational workload. No clinical figure exists here. */
export interface PractitionerWorkload extends AppointmentCounts, Utilization {
  readonly practitionerId: string;
  readonly displayName: string;
  readonly isActive: boolean;
  readonly rates: AppointmentRates;
}

export interface PatientGrowth {
  readonly newPatients: number;
  readonly returningPatients: number;
  readonly activePatients: number;
  /** Registered patients as at the end of the period, not as at now. */
  readonly totalPatients: number;
}

export interface PatientGrowthPoint {
  readonly bucketStart: string;
  readonly newPatients: number;
}

/**
 * External delivery attempts, per channel and provider.
 *
 * There is no `delivered` field, deliberately. Phase 15 records `sent` to
 * mean the provider accepted the request, and section 41 forbids calling that
 * delivery. `acceptanceRate` is named for what it measures.
 */
export interface NotificationDelivery {
  readonly channel: string;
  readonly provider: string;
  readonly pending: number;
  readonly sent: number;
  readonly failed: number;
  readonly skipped: number;
  /** `sent / (sent + failed)`, or null when nothing was attempted. */
  readonly acceptanceRate: Rate;
}

/** In-app notifications by category. The row is the delivery, so no attempts. */
export interface NotificationVolume {
  readonly category: string;
  readonly scheduled: number;
  readonly active: number;
  readonly cancelled: number;
  readonly readCount: number;
  /** `read / active`, or null when nothing was shown. */
  readonly readRate: Rate;
}

/**
 * Counts of clinical acts. Not of clinical content.
 *
 * Section 36 rules out diagnosis frequency, prevalence, medicine
 * effectiveness and outcome rankings, and there is no field here for one.
 * Section 38 warns against reading a plan count as efficacy, which is why the
 * copy beside these figures says what they are.
 */
export interface ClinicalActivity {
  readonly prescriptionsIssued: number;
  readonly treatmentPlansActivated: number;
  readonly consultationsDocumented: number;
  readonly documentsUploaded: number;
}

export interface DocumentTypeVolume {
  readonly documentType: string;
  readonly uploaded: number;
}

/** One aggregated row of the exportable appointment report. */
export interface AppointmentReportRow {
  readonly clinicDate: string;
  readonly practitionerName: string;
  readonly appointmentTypeName: string;
  readonly status: AppointmentStatus;
  readonly appointmentCount: number;
}

/**
 * The outcome of an analytics read.
 *
 * `empty` is not a separate state: a period with no activity is `ready` with
 * zeroes, and the renderer decides what to say about them. `unavailable` is
 * the only state that means "we do not know", and it is what stops a failed
 * query being drawn as a flat line at zero.
 */
export type AnalyticsResult<T> =
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "unavailable" }
  | { readonly status: "forbidden" };

/** Everything the clinic dashboard renders, read in one pass. */
export interface ClinicAnalytics {
  readonly range: AnalyticsRange;
  /** When the figures were read. Section 75-76: freshness is stated, not implied. */
  readonly generatedAt: string;
  readonly appointments: AnalyticsResult<AppointmentCounts>;
  readonly trend: AnalyticsResult<readonly TrendPoint[]>;
  readonly workload: AnalyticsResult<readonly PractitionerWorkload[]>;
  readonly patients: AnalyticsResult<PatientGrowth>;
  readonly growth: AnalyticsResult<readonly PatientGrowthPoint[]>;
}

/** The administrator's additional panels. */
export interface ClinicSystemAnalytics {
  readonly deliveries: AnalyticsResult<readonly NotificationDelivery[]>;
  readonly notifications: AnalyticsResult<readonly NotificationVolume[]>;
  readonly clinicalActivity: AnalyticsResult<ClinicalActivity>;
  readonly documentTypes: AnalyticsResult<readonly DocumentTypeVolume[]>;
}

/** A practitioner's own practice. No clinic total, no colleague. */
export interface PracticeAnalytics {
  readonly range: AnalyticsRange;
  readonly generatedAt: string;
  readonly appointments: AnalyticsResult<AppointmentCounts>;
  readonly trend: AnalyticsResult<readonly TrendPoint[]>;
  readonly utilization: AnalyticsResult<Utilization>;
}
