/**
 * The appointment domain model.
 *
 * ## The boundary this file holds
 *
 * An appointment is an **operational** record: who, with whom, when, and what
 * state it is in. It is not a clinical record. There is no field here for a
 * diagnosis, a symptom, a medication, an assessment or a treatment plan, and
 * there must not be — those are `clinical_visits` and its children, arriving
 * in later phases with their own append-only semantics
 * (`docs/DATABASE.md` sections 4.7-4.10, `phase_09.md` sections 24 and 52).
 *
 * `patientNote` is the one free-text field a patient can write, and the
 * booking form says in words that it is for scheduling rather than symptoms.
 *
 * ## What is absent, and why
 *
 * `internalNote` is not on this type. It is staff-only, and it is protected by
 * not being in the column-level select grant rather than by being filtered in
 * TypeScript — a patient cannot read it through any query at all
 * (section 24). Modelling it here would invite a component to expect it.
 *
 * `blockedUntil`, `createdBy` and `cancelledBy` are likewise absent: internal
 * scheduling metadata, and two of them are identifiers a patient has no use
 * for (`phase_09.md` section 55).
 *
 * There is no `durationMinutes` on an appointment. The duration is
 * `endsAt - startsAt`, and a stored copy is one more thing that can disagree
 * with the times it describes.
 */

import type { Database } from "@/types/database";

/**
 * The appointment lifecycle.
 *
 * The seven states `docs/DATABASE.md` section 11 documents. Only three are
 * reachable in this phase — an appointment is created `requested` and a
 * patient may take it to `cancelled` — because confirming, checking in and
 * completing are staff actions and the staff workspaces are Phase 10 and 11.
 */
export type AppointmentStatus =
  Database["public"]["Enums"]["appointment_status"];

export type AppointmentEventType =
  Database["public"]["Enums"]["appointment_event_type"];

/**
 * An appointment type: what kind of visit, and how long the diary holds.
 *
 * The **trusted** source of duration. A client sends an id and the server
 * reads the length from the database (`phase_09.md` section 38, example 4).
 *
 * There is no price. Payments are out of scope and the clinic has verified no
 * fee, so there is nowhere for an invented one to go.
 */
export interface AppointmentType {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  /**
   * Separation the diary keeps after this appointment.
   *
   * Zero for every configured type: the clinic has specified no buffer. It is
   * modelled because `phase_09.md` sections 4 and 18 require it, and where it
   * is non-zero the database enforces it as an invariant rather than as a
   * hint.
   */
  readonly bufferMinutes: number;
}

/**
 * A practitioner, as the scheduler sees them.
 *
 * Deliberately just a name and whether they can be booked. Qualifications,
 * registration numbers and biographies are clinical credentials, the clinic
 * has confirmed none of them, and the public directory says so to visitors —
 * so there is no second place here for an unverified one to appear
 * (`docs/HEALTHCARE_AND_AI_SAFETY.md`).
 */
export interface SchedulingPractitioner {
  readonly id: string;
  readonly displayName: string;
}

/** One contiguous working interval on one weekday, in clinic wall-clock time. */
export interface WorkingInterval {
  /** 0 = Sunday, matching PostgreSQL `extract(dow)`. */
  readonly weekday: number;
  /** Minutes since local midnight. */
  readonly startMinute: number;
  readonly endMinute: number;
}

/**
 * A period nobody may be booked into.
 *
 * An existing appointment and a blocked period are the same thing to the slot
 * generator, which is why they arrive as one list and carry no reason: a
 * blocked period's reason is internal and never reaches a patient
 * (`phase_09.md` section 15).
 */
export interface BusyInterval {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/** A bookable start time, and the end it implies for the chosen type. */
export interface AvailabilitySlot {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/**
 * An appointment as a patient's screens see it.
 *
 * `practitionerName` and `typeName` are resolved in the query layer rather
 * than held as ids, because every screen that shows an appointment shows them
 * and a component should not be making its own lookups
 * (`docs/ARCHITECTURE.md` section 33).
 */
export interface PatientAppointment {
  readonly id: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly status: AppointmentStatus;
  readonly practitionerId: string;
  readonly practitionerName: string;
  readonly appointmentTypeId: string;
  readonly typeName: string;
  readonly durationMinutes: number;
  readonly patientNote: string | null;
  readonly cancelledAt: Date | null;
  readonly cancellationReason: string | null;
  readonly createdAt: Date;
}

/** One entry in an appointment's own history. Carries no clinical content. */
export interface AppointmentEvent {
  readonly id: string;
  readonly eventType: AppointmentEventType;
  readonly previousStatus: AppointmentStatus | null;
  readonly newStatus: AppointmentStatus | null;
  readonly previousStartsAt: Date | null;
  readonly newStartsAt: Date | null;
  readonly createdAt: Date;
}

/**
 * How a patient's appointments are grouped on the list screen.
 *
 * `phase_09.md` sections 25 and 49. Cancelled appointments are their own group
 * rather than being folded into "past", because a patient looking for "did I
 * cancel that?" is asking a different question from "when did I last come in".
 */
export type AppointmentGroup = "upcoming" | "past" | "cancelled";

export interface GroupedAppointments {
  readonly upcoming: readonly PatientAppointment[];
  readonly past: readonly PatientAppointment[];
  readonly cancelled: readonly PatientAppointment[];
}

/**
 * The result of asking for something that may not be readable.
 *
 * The same discriminated shape Phase 07 established, and for the same reason:
 * "you have none" and "we could not read them" need different screens. A
 * database outage must not tell a patient their appointment does not exist.
 */
export type AppointmentsResult =
  | {
      readonly status: "found";
      readonly appointments: readonly PatientAppointment[];
      /**
       * True when the patient has more history than the list reads.
       *
       * Phase 20 bounded the query at `MY_APPOINTMENTS_LIMIT`. This is what
       * lets the page say so: a list that quietly stops at a hundred is a list
       * that tells a long-standing patient their oldest appointments no longer
       * exist. Every *upcoming* appointment is always included, because the
       * bound falls on the oldest rows.
       */
      readonly truncated: boolean;
    }
  | { readonly status: "unavailable" };

export type AppointmentResult =
  | { readonly status: "found"; readonly appointment: PatientAppointment }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type AvailabilityResult =
  | { readonly status: "found"; readonly slots: readonly AvailabilitySlot[] }
  | { readonly status: "unavailable" };

/**
 * What the booking, cancellation and reschedule actions hand back.
 *
 * Mirrors `features/patients/types.ts` deliberately: one convention for form
 * results across the application, so a form added later cannot invent a
 * second. `message` is always safe to render — never database or provider
 * text.
 */
export interface AppointmentFormState {
  readonly status: "idle" | "error" | "success";
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /** Set on a successful booking, so the caller can route to the confirmation. */
  readonly appointmentId?: string;
}

export const IDLE_APPOINTMENT_FORM_STATE: AppointmentFormState = {
  status: "idle",
};

export function appointmentFormError(
  message: string,
  fieldErrors?: Readonly<Record<string, string>>,
): AppointmentFormState {
  return {
    status: "error",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

export function appointmentFormSuccess(
  message: string,
  appointmentId?: string,
): AppointmentFormState {
  return {
    status: "success",
    message,
    ...(appointmentId ? { appointmentId } : {}),
  };
}
