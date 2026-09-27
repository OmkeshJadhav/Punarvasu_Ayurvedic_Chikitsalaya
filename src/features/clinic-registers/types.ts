/**
 * The clinic registers — the one place on the dashboard a patient is named.
 *
 * ## Why this is not in `features/analytics`
 *
 * The analytics domain promises, and its tests assert, that no type in it
 * carries a patient identifier (`features/analytics/types.ts`). That promise
 * is what lets aggregates be cached, exported and screenshotted without a
 * second thought. These types break it on purpose, so they live beside it
 * rather than inside it: `phase_16.md` sections 35 and 90 ask for a patient
 * list to be a *separately authorized operational report*, and a separate
 * module with a separate permission (`registers.read.patients`) is what
 * "separately" means in code.
 *
 * ## What a row may hold
 *
 * A patient's name and operational facts about their appointments. No phone,
 * email, date of birth, gender or address; no note, no cancellation reason;
 * nothing clinical. The database functions return nothing more, so there is
 * nothing here to leave out.
 *
 * `patientId` is carried for list keys and never rendered or put in a URL.
 */

import type { AppointmentStatus } from "@/features/appointments/types";

/** A read that can fail without failing the page, as analytics reads do. */
export type RegisterResult<T> =
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "unavailable" }
  | { readonly status: "forbidden" };

/** One page of a paged register. */
export interface RegisterPage<Row> {
  readonly rows: readonly Row[];
  /** Rows in the whole period, not on this page. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface AppointmentRegisterRow {
  readonly appointmentId: string;
  readonly startsAt: string;
  readonly status: AppointmentStatus;
  readonly patientId: string;
  readonly patientName: string;
  readonly practitionerName: string;
  readonly appointmentTypeName: string;
}

export interface PatientRegisterRow {
  readonly patientId: string;
  readonly patientName: string;
  readonly registeredAt: string;
  /** Record created during the period. */
  readonly isNew: boolean;
  /** Appointments in the period that were not cancelled. */
  readonly appointmentsInPeriod: number;
  readonly completedInPeriod: number;
  /** Latest completed appointment up to the period's end, if any. */
  readonly lastVisitAt: string | null;
}

export const ACTIVITY_KINDS = [
  "booked",
  "status_changed",
  "rescheduled",
  "patient_registered",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityEntry {
  readonly occurredAt: string;
  readonly kind: ActivityKind;
  /** The status the appointment moved to. Null for a registration. */
  readonly status: AppointmentStatus | null;
  readonly patientId: string;
  readonly patientName: string;
  /** Null for a registration, which has no practitioner. */
  readonly practitionerName: string | null;
}

export interface ClinicRegisters {
  readonly appointments: RegisterResult<RegisterPage<AppointmentRegisterRow>>;
  readonly patients: RegisterResult<RegisterPage<PatientRegisterRow>>;
  readonly activity: RegisterResult<readonly ActivityEntry[]>;
}
