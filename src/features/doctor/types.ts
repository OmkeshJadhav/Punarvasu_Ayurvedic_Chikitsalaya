/**
 * The doctor workspace's domain model.
 *
 * ## The boundary this file holds
 *
 * Everything here is **operational and demographic**. An appointment in the
 * practitioner's own diary, the person it is for, and enough about them to
 * begin a consultation knowing who is in the room.
 *
 * There is no field for a diagnosis, a symptom, a medication, an allergy, a
 * history, an assessment, a vital sign, a treatment plan or a prescription —
 * and there must not be. `phase_11.md` sections 18, 53 and 54 put every one
 * of those in a later phase, and the way the boundary is held is the way
 * Phases 07 and 10 held theirs: the types have nowhere to put one, the
 * queries name their columns, and the tables these screens read have no such
 * column at all.
 *
 * The distinction `phase_11.md` section 33 draws is the one this file is
 * organised around:
 *
 * ```text
 * Appointment history   date, type, status          -> Phase 11, here
 * Clinical history      diagnosis, notes, plan      -> Phase 12, not here
 * ```
 *
 * `internalNote` is absent for the reason Phase 10 recorded: column
 * privileges in PostgreSQL are granted to a *database* role, and a patient, a
 * receptionist and a doctor are all `authenticated`. Granting it to one would
 * grant it to all three, so it stays unreadable by anybody.
 *
 * ## Why these are not the receptionist's types
 *
 * `ScheduledAppointment` in `features/reception/types.ts` carries a
 * practitioner name, because the front desk is looking at everybody's diary.
 * A practitioner looking at their own does not need to be told whose it is,
 * and `phase_11.md` section 25 says plainly not to copy the receptionist
 * interface into this workspace.
 *
 * What *is* reused, and must stay reused, is everything underneath:
 * `AppointmentStatus`, the transition matrix in
 * `features/appointments/status.ts`, the timezone layer, the schedule
 * helpers and the error mapper.
 */

import type { AppointmentStatus } from "@/features/appointments/types";

/**
 * Who the signed-in doctor is, as the scheduling system knows them.
 *
 * Resolved from `auth.uid()` through `public.current_practitioner_id()`.
 * **Never supplied by a request** — `phase_11.md` sections 4, 47 and example
 * 2 — and there is no shape in this feature that carries a practitioner id
 * inwards.
 */
export interface DoctorIdentity {
  readonly practitionerId: string;
  readonly displayName: string;
}

/**
 * Holding the doctor role is not the same as being on the scheduling roster.
 *
 * A doctor account with no `practitioners` row has no diary and no patients.
 * That is a real and recoverable state — an administrator has not finished
 * setting the account up — and it needs its own screen rather than an empty
 * schedule, which would read as "no patients today".
 */
export type DoctorIdentityResult =
  | { readonly status: "found"; readonly identity: DoctorIdentity }
  | { readonly status: "not_a_practitioner" }
  | { readonly status: "unavailable" };

/**
 * An appointment in the practitioner's own diary.
 *
 * Flat and small: a day's schedule renders dozens at a time and every field
 * is one the doctor reads at a glance (`phase_11.md` section 9).
 */
export interface DoctorAppointment {
  readonly id: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly status: AppointmentStatus;
  readonly durationMinutes: number;

  readonly patientId: string;
  /** The preferred name where there is one, else the name on the record. */
  readonly patientName: string;
  /** ISO `YYYY-MM-DD`, or null. Age is derived at the edge, never stored. */
  readonly patientDateOfBirth: string | null;

  readonly appointmentTypeId: string;
  readonly typeName: string;

  /**
   * The patient's own scheduling note.
   *
   * Never clinical: `phase_09.md` section 24 defines it as practical
   * scheduling information, every form that writes it says so, and it is
   * bounded at 500 characters by a database constraint. It is shown here
   * because a note saying "coming with an interpreter" is exactly what a
   * practitioner needs before the patient walks in.
   */
  readonly patientNote: string | null;

  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
}

/**
 * A patient in the doctor's care scope, as a search result.
 *
 * The minimum needed to pick the right person out of a list. No address, no
 * emergency contact, no account identifier and nothing clinical —
 * `search_care_patients` does not return them, so this is the shape of what
 * the database gives rather than a filter applied to something wider.
 */
export interface CarePatientSearchResult {
  readonly id: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly phone: string | null;
  readonly dateOfBirth: string | null;
  /**
   * When this practitioner last had an appointment with them.
   *
   * The discriminator a doctor actually uses to tell two similarly named
   * people apart, and it is derived from their own diary rather than from the
   * clinic's.
   */
  readonly lastAppointmentAt: Date | null;
}

/**
 * A patient's context, as the doctor reads it before a consultation.
 *
 * `phase_11.md` sections 14, 17 and 31 list what belongs here and then list
 * what must not appear beside it. The second list is not filtered out — it
 * has no source.
 *
 * ## The street address is deliberately absent
 *
 * Section 17 offers it as an example of permitted information and section 44
 * says to return only what the workflow needs. No Phase 11 workflow needs a
 * doorstep: the doctor needs to know who the patient is and how to reach
 * them, and the front desk already holds the postal address for the one thing
 * it is for. The town and state stay, because where somebody has travelled
 * from is context a practitioner uses.
 */
export interface CarePatient {
  readonly id: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly phone: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly preferredLanguage: string | null;
  readonly emergencyContactName: string | null;
  readonly emergencyContactRelationship: string | null;
  readonly emergencyContactPhone: string | null;
  /** When the clinic first registered them. Month and year at the edge. */
  readonly createdAt: string;
}

/**
 * The counts on the workspace home page.
 *
 * `phase_11.md` section 7 asks for today's appointments, completed, pending
 * and next — and warns against excessive KPI cards and against fabricating a
 * figure. Every number here is a count of rows the day's own query returned,
 * so none can drift from the list underneath it.
 *
 * There is no patient count, no success rate, no clinical outcome and no
 * revenue, and there is nowhere in this type to put one.
 */
export interface DoctorDaySummary {
  readonly total: number;
  /** Requested, and waiting for somebody to agree the time. */
  readonly awaitingConfirmation: number;
  /** Still to be seen today: anything not finished, missed or cancelled. */
  readonly remaining: number;
  readonly completed: number;
}

/**
 * Results that may not be readable.
 *
 * The discriminated shape Phases 07, 09 and 10 established, for the same
 * reason: "there is nothing today" and "we could not read today" need
 * different screens.
 */
export type DoctorScheduleResult =
  | {
      readonly status: "found";
      readonly appointments: readonly DoctorAppointment[];
    }
  | { readonly status: "unavailable" };

export type DoctorAppointmentResult =
  | { readonly status: "found"; readonly appointment: DoctorAppointment }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type CarePatientResult =
  | { readonly status: "found"; readonly patient: CarePatient }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type CarePatientSearchStatus = "idle" | "found" | "unavailable";

export interface CarePatientSearchOutcome {
  readonly status: CarePatientSearchStatus;
  readonly results: readonly CarePatientSearchResult[];
  /** True when the query was too short to search for. */
  readonly tooShort: boolean;
}

/**
 * What the patient search form hands back.
 *
 * The results travel in the form state rather than in the URL, and that is a
 * privacy decision rather than a technical one — the same one Phase 10 made
 * and for the same reason. A search term is somebody's name;
 * `?q=Priya+Sharma` reaches browser history on a shared consulting-room
 * machine, every proxy's access log and the `Referer` header of the next
 * request (`phase_11.md` section 43, `docs/SECURITY.md` section 14).
 */
export interface CarePatientSearchFormState {
  readonly status: "idle" | "found" | "unavailable" | "forbidden";
  readonly results: readonly CarePatientSearchResult[];
  readonly tooShort: boolean;
  /** Echoed back so the input keeps what was typed after a submission. */
  readonly query: string;
}

export const IDLE_CARE_PATIENT_SEARCH_STATE: CarePatientSearchFormState = {
  status: "idle",
  results: [],
  tooShort: false,
  query: "",
};

/**
 * What a doctor action hands back.
 *
 * Mirrors the patient, appointment and reception form states deliberately:
 * one convention across the application, so a form added later cannot invent
 * a second. `message` is always safe to render — never database or provider
 * text.
 */
export interface DoctorFormState {
  readonly status: "idle" | "error" | "success";
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export const IDLE_DOCTOR_FORM_STATE: DoctorFormState = { status: "idle" };

export function doctorFormError(
  message: string,
  fieldErrors?: Readonly<Record<string, string>>,
): DoctorFormState {
  return {
    status: "error",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

export function doctorFormSuccess(message: string): DoctorFormState {
  return { status: "success", message };
}
