/**
 * The clinical record domain model.
 *
 * ## The boundary this file establishes
 *
 * `phase_12.md` section 2 and example 1 draw the line this whole phase exists
 * to hold:
 *
 * ```text
 * Appointment       when care is scheduled   -> features/appointments
 * Clinical record   what happened in the room -> here
 * ```
 *
 * So these types carry clinical content and the appointment types carry none,
 * and neither absorbs the other. `DoctorAppointment` still has no field for a
 * diagnosis, and `ClinicalRecord` still has no field for a start time, a
 * practitioner name or a slot.
 *
 * ## What is deliberately not here
 *
 * A medication, a dose, a prescription, a treatment plan, a document, a file
 * reference, a lab result, an AI suggestion, a confidence score. Sections 48,
 * 49, 50 and 100 put each in a later phase. They are absent rather than
 * filtered: the types have nowhere to put one, the schemas have no field for
 * one, and the table has no column for one.
 *
 * ## No denormalised identity
 *
 * Sections 8 and 9: the record references `patientId` and `practitionerId`
 * and holds no copy of a name, a phone number or a date of birth. A copy is a
 * second source of truth that goes stale the day somebody corrects a
 * spelling, and on a clinical record it would go stale silently.
 *
 * The patient's identity a practitioner reads on the consultation screen is
 * `ConsultationPatient` below, resolved through the relationship at render
 * time.
 */

import type { AppointmentStatus } from "@/features/appointments/types";

/**
 * The record's lifecycle (section 14).
 *
 * `amended` is declared in the database enum and is unreachable in Phase 12 —
 * the transition trigger permits `completed -> amended` and no function sets
 * it. It is in this union so that a row carrying it renders rather than
 * crashing the day the amendment workflow arrives, and so that every
 * exhaustive `switch` over a status is already written to handle it.
 */
export type ClinicalRecordStatus = "draft" | "completed" | "amended";

/**
 * The eight clinical fields (section 13).
 *
 * Named as one type because they travel together everywhere — the form posts
 * them, the schema validates them, the RPC takes them, the record holds them —
 * and a ninth field added in one place and forgotten in another is exactly the
 * defect that produces a section a practitioner types into and never sees
 * again.
 *
 * Every one is optional. Section 37: a clinical record defines explicit
 * required fields based on actual workflow, and making all eight mandatory
 * would be inventing a template the clinic has not asked for. What is
 * required is required *at completion*, and that lives in `status.ts`.
 */
export interface ClinicalContent {
  readonly chiefComplaint: string;
  readonly historyOfPresentingConcern: string;
  readonly symptoms: string;
  readonly clinicalObservations: string;
  readonly assessment: string;
  readonly diagnosisOrClinicalImpression: string;
  readonly doctorNotes: string;
  readonly followUpNotes: string;
}

/**
 * The names of the eight fields, in the order they are documented in.
 *
 * Exported because three places need to iterate them and must not drift: the
 * form's field list, the server action's allowlisted `FormData` read, and the
 * RPC argument mapping. A field present in one and missing from another is a
 * field that silently discards what a practitioner typed.
 */
export const CLINICAL_FIELDS = [
  "chiefComplaint",
  "historyOfPresentingConcern",
  "symptoms",
  "clinicalObservations",
  "assessment",
  "diagnosisOrClinicalImpression",
  "doctorNotes",
  "followUpNotes",
] as const satisfies readonly (keyof ClinicalContent)[];

export type ClinicalFieldName = (typeof CLINICAL_FIELDS)[number];

/** An empty record's content. Every field present, every field blank. */
export const EMPTY_CLINICAL_CONTENT: ClinicalContent = {
  chiefComplaint: "",
  historyOfPresentingConcern: "",
  symptoms: "",
  clinicalObservations: "",
  assessment: "",
  diagnosisOrClinicalImpression: "",
  doctorNotes: "",
  followUpNotes: "",
};

/**
 * One clinical record, as the authoring practitioner reads it.
 *
 * There is no other shape of it. Section 21 and example 8: a patient-facing
 * representation is not this type with some fields removed at render time —
 * it would be a deliberately authorized projection with its own query, its
 * own policy and its own type, and Phase 12 does not build one.
 */
export interface ClinicalRecord extends ClinicalContent {
  readonly id: string;
  readonly appointmentId: string;
  readonly patientId: string;
  readonly practitionerId: string;
  readonly status: ClinicalRecordStatus;
  /**
   * The optimistic concurrency token (section 34).
   *
   * Sent back with every write so a save against a revision that has since
   * moved on is refused rather than overwriting newer clinical documentation.
   * It is a concurrency control and never an authorization input: a correct
   * version for somebody else's record still reaches no row.
   */
  readonly version: number;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A record in a clinical history list (section 39).
 *
 * Summary only: when, what kind of appointment, and whether the
 * documentation is finished. **No clinical content**, because section 26
 * asks for explicit field selection rather than `select *`, and because a
 * history list is read at a glance and often over a shoulder — a chief
 * complaint does not belong in a table somebody scrolls past.
 *
 * The clinical content is one click away, on the record's own page, where
 * the practitioner has chosen to read it.
 */
export interface ClinicalHistoryEntry {
  readonly id: string;
  readonly appointmentId: string;
  readonly status: ClinicalRecordStatus;
  /** The appointment's date, which is when the care happened. */
  readonly occurredAt: Date;
  readonly appointmentTypeName: string;
  readonly completedAt: Date | null;
  readonly updatedAt: Date;
}

/**
 * The patient's identity, as the consultation screen shows it.
 *
 * Sections 28-29: the practitioner must be able to satisfy themselves that
 * this is the right person, and a tiny name label is not enough. So the
 * header carries a name, a date of birth, a derived age and a phone number —
 * four things that between them distinguish two people with the same name.
 *
 * Age is **derived** here, never stored (section 28): a stored age is wrong
 * within a year of being written.
 */
export interface ConsultationPatient {
  readonly id: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
  readonly phone: string | null;
}

/**
 * The appointment context a consultation is documented against (section 30).
 *
 * Deliberately five fields rather than the whole appointment object —
 * section 30 says not to duplicate the appointment into the clinical record,
 * and section 76 says not to return an entire object from a clinical
 * operation.
 */
export interface ConsultationAppointment {
  readonly id: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly status: AppointmentStatus;
  readonly typeName: string;
}

/** Everything the consultation workspace renders, resolved in one place. */
export interface ConsultationContext {
  readonly record: ClinicalRecord;
  readonly patient: ConsultationPatient | null;
  readonly appointment: ConsultationAppointment;
}

/**
 * Results that may not be readable.
 *
 * The discriminated shape Phases 07 and 09–11 established, for the same
 * reason: "this consultation has not been started", "you cannot see this" and
 * "we could not read it" need three different screens, and collapsing them
 * into `null` produces the one that says the wrong thing.
 *
 * `not_found` deliberately covers both "no such record" and "not yours"
 * (section 57). A record id must not be an oracle for whether somebody else's
 * consultation exists.
 */
export type ClinicalRecordResult =
  | { readonly status: "found"; readonly record: ClinicalRecord }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type ConsultationContextResult =
  | { readonly status: "found"; readonly context: ConsultationContext }
  | { readonly status: "not_started" }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type ClinicalHistoryResult =
  | {
      readonly status: "found";
      readonly entries: readonly ClinicalHistoryEntry[];
    }
  | { readonly status: "unavailable" };

/**
 * How a save went, as the form renders it.
 *
 * ## Why this is not the shared `DoctorFormState`
 *
 * Two things a clinical save has that no other form in this application does:
 * a **version** to carry forward, and a `conflict` outcome that is neither
 * success nor an ordinary error (section 34). A conflict means somebody
 * else's newer documentation is in the database and the practitioner must
 * reload before saving — which is a different sentence, a different tone and
 * a different next action from "that didn't work, try again".
 *
 * `savedAt` exists because section 69 asks for a save state a practitioner
 * can actually read, and "Saved" with no time is indistinguishable from
 * "Saved half an hour ago".
 */
export type ClinicalSaveStatus =
  "idle" | "saved" | "completed" | "error" | "conflict" | "forbidden";

export interface ClinicalFormState {
  readonly status: ClinicalSaveStatus;
  /** Always safe to render. Never database or provider text. */
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /**
   * The version the server now holds.
   *
   * Returned on success so the practitioner can keep editing without
   * reloading, and **not** returned on a conflict — after a conflict the
   * content in the browser is not a revision of anything the database has,
   * and handing back a version would let the next save overwrite the very
   * documentation the conflict protected.
   */
  readonly version?: number;
  /** Epoch milliseconds, for "Saved at 14:32". */
  readonly savedAt?: number;
}

export const IDLE_CLINICAL_FORM_STATE: ClinicalFormState = { status: "idle" };

export function clinicalFormError(
  message: string,
  fieldErrors?: Readonly<Record<string, string>>,
): ClinicalFormState {
  return {
    status: "error",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}
