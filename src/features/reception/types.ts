/**
 * The receptionist workspace's domain model.
 *
 * ## The boundary this file holds
 *
 * Everything here is **operational**. A scheduled appointment, the person it
 * is for, how to reach them, and what the front desk can do about it next.
 *
 * There is no field for a diagnosis, a symptom, a medication, an allergy, a
 * history, an assessment, a treatment plan or a prescription — and there must
 * not be. `phase_10.md` sections 4 and 14 and `docs/SECURITY.md` section 6
 * make the receptionist's exclusion from clinical information a hard boundary
 * rather than a UI preference, and the way it is held is the same way Phase 07
 * held the patient profile's: the types have nowhere to put one, the queries
 * name their columns, and the database has no such column in the tables these
 * screens read.
 *
 * `internalNote` is likewise absent, and for a reason worth stating because it
 * is not the obvious one: a staff note would be reasonable for a receptionist
 * to read, but column privileges in PostgreSQL are granted to a *database*
 * role, and a patient and a receptionist are both `authenticated`. Granting
 * the column to one grants it to the other. So it stays unreadable by anybody,
 * and a staff note waits for the definer accessor that would make it safe.
 *
 * ## Why these are not the patient's types
 *
 * `PatientAppointment` in `features/appointments/types.ts` is what a patient
 * sees about their own appointment. A receptionist sees a different thing: the
 * patient's name and phone number are the important part, and the clinic
 * location is not, because they are standing in it. Reusing that type would
 * mean one screen carrying fields the other must never render, which is how a
 * field ends up rendered.
 *
 * What *is* reused, and must stay reused, is everything underneath:
 * `AppointmentStatus`, the transition matrix in
 * `features/appointments/status.ts`, the availability engine, the timezone
 * layer and the error mapper.
 */

import type { AppointmentStatus } from "@/features/appointments/types";

/**
 * An appointment as the front desk sees it.
 *
 * Deliberately flat and small. The schedule renders dozens of these at a time
 * and every field here is one the receptionist reads at a glance
 * (`phase_10.md` section 7).
 */
export interface ScheduledAppointment {
  readonly id: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly status: AppointmentStatus;
  readonly durationMinutes: number;

  readonly patientId: string;
  readonly patientName: string;
  /** Ten digits as stored, or null. Formatted for display at the edge. */
  readonly patientPhone: string | null;

  readonly practitionerId: string;
  readonly practitionerName: string;

  readonly appointmentTypeId: string;
  readonly typeName: string;

  /** The patient's own scheduling note. Never clinical (`phase_09.md` §24). */
  readonly patientNote: string | null;

  readonly cancelledAt: Date | null;
  readonly cancellationReason: string | null;
  readonly createdAt: Date;
}

/**
 * A patient as a search result.
 *
 * The minimum needed to pick the right person out of a list, and nothing more
 * (`phase_10.md` example 6). The address, the emergency contact and anything
 * else are read one patient at a time, after the receptionist has chosen who
 * they are dealing with.
 */
export interface PatientSearchResult {
  readonly id: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly phone: string | null;
  /** ISO `YYYY-MM-DD`, or null. */
  readonly dateOfBirth: string | null;
  readonly city: string | null;
  /**
   * Whether this person can sign in.
   *
   * Derived from whether the record is linked to an account. It deliberately
   * does not disclose *which* account: the onboarding workflow needs to know
   * that a walk-in has no login, not who they are in the auth system.
   */
  readonly hasAccount: boolean;
}

/** A search result, plus why the duplicate check flagged it. */
export interface DuplicateCandidate extends PatientSearchResult {
  readonly matchReason: "phone" | "name_and_date_of_birth";
}

/**
 * A patient's operational record, as the front desk reads it.
 *
 * Every field is demographic or administrative. `phase_10.md` section 14 lists
 * exactly this set and then lists what must not appear beside it; the second
 * list is not filtered out here, it has no source.
 */
export interface OperationalPatient {
  readonly id: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly phone: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly emergencyContactName: string | null;
  readonly emergencyContactRelationship: string | null;
  readonly emergencyContactPhone: string | null;
  readonly preferredLanguage: string | null;
  readonly hasAccount: boolean;
  readonly createdAt: string;
}

/** A practitioner the front desk can schedule for. */
export interface SchedulablePractitioner {
  readonly id: string;
  readonly displayName: string;
  /** Whether patients may also book them directly. Shown, never enforced here. */
  readonly acceptsOnlineBooking: boolean;
}

/**
 * The counts on the workspace home page.
 *
 * `phase_10.md` section 42 keeps these operational: how much work today holds
 * and how much of it needs attention. There is no revenue figure, no clinical
 * outcome and no patient-health statistic, and section 6 is explicit that
 * every number must come from real data — each of these is a count of rows the
 * same query returned, not an estimate.
 */
export interface DayOverview {
  readonly total: number;
  /** Requested but not yet confirmed — the queue the front desk works. */
  readonly awaitingConfirmation: number;
  readonly confirmed: number;
  readonly checkedIn: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly noShow: number;
}

/**
 * Results that may not be readable.
 *
 * The same discriminated shape Phases 07 and 09 established, and for the same
 * reason: "there is nothing today" and "we could not read today" need
 * different screens. A front desk told the diary is empty when the database
 * was briefly unreachable will turn people away.
 */
export type ScheduleResult =
  | {
      readonly status: "found";
      readonly appointments: readonly ScheduledAppointment[];
    }
  | { readonly status: "unavailable" };

export type ScheduledAppointmentResult =
  | { readonly status: "found"; readonly appointment: ScheduledAppointment }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type PatientSearchStatus = "idle" | "found" | "unavailable";

export interface PatientSearchOutcome {
  readonly status: PatientSearchStatus;
  readonly results: readonly PatientSearchResult[];
  /** True when the query was too short to search for. */
  readonly tooShort: boolean;
}

/**
 * What the patient search form hands back.
 *
 * The results travel in the form state rather than in the URL, and that is a
 * privacy decision rather than a technical one. A search term is somebody's
 * name; `?q=Priya+Sharma` reaches browser history on a shared front-desk
 * machine, every proxy's access log and the `Referer` header of the next
 * request (`phase_10.md` section 36, `docs/SECURITY.md` section 14).
 *
 * So the search is a POST to a server action. It is still server-side, still
 * authorized, still bounded, and the term is still never written anywhere it
 * can be read back.
 */
export interface PatientSearchFormState {
  readonly status: "idle" | "found" | "unavailable" | "forbidden";
  readonly results: readonly PatientSearchResult[];
  /** True when the term was too short to search for. */
  readonly tooShort: boolean;
  /** Echoed back so the input keeps what was typed after a submission. */
  readonly query: string;
}

export const IDLE_PATIENT_SEARCH_STATE: PatientSearchFormState = {
  status: "idle",
  results: [],
  tooShort: false,
  query: "",
};

export type OperationalPatientResult =
  | { readonly status: "found"; readonly patient: OperationalPatient }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

/**
 * What a reception form hands back.
 *
 * Mirrors `features/appointments/types.ts` and `features/patients/types.ts`
 * deliberately: one convention for form results across the application, so a
 * form added later cannot invent a second. `message` is always safe to
 * render — never database or provider text.
 */
export interface ReceptionFormState {
  readonly status: "idle" | "error" | "success";
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /** Set after a successful create, so the caller can route to what it made. */
  readonly createdId?: string;
  /**
   * Existing records that might be the same person.
   *
   * Present only on the registration form, and only when the check found
   * something. It is **advisory**: nothing is merged, and the receptionist
   * either opens one of these or says this is somebody else
   * (`phase_10.md` section 33).
   */
  readonly duplicates?: readonly DuplicateCandidate[];
  /**
   * The values the receptionist typed, returned after a failure so a
   * validation error does not make them retype a walk-in's address with the
   * patient standing in front of them.
   */
  readonly values?: Readonly<Record<string, string>>;
}

export const IDLE_RECEPTION_FORM_STATE: ReceptionFormState = { status: "idle" };

export function receptionFormError(
  message: string,
  options: {
    readonly fieldErrors?: Readonly<Record<string, string>>;
    readonly values?: Readonly<Record<string, string>>;
    readonly duplicates?: readonly DuplicateCandidate[];
  } = {},
): ReceptionFormState {
  return {
    status: "error",
    message,
    ...(options.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
    ...(options.values ? { values: options.values } : {}),
    ...(options.duplicates?.length ? { duplicates: options.duplicates } : {}),
  };
}

export function receptionFormSuccess(
  message: string,
  createdId?: string,
): ReceptionFormState {
  return {
    status: "success",
    message,
    ...(createdId ? { createdId } : {}),
  };
}
