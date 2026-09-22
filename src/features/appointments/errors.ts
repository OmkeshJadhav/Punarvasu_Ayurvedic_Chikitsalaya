/**
 * Database failure to something a patient can read.
 *
 * ## Why one mapper
 *
 * `phase_09.md` section 41 gives the rule and the example: a patient must
 * never see
 *
 *   > duplicate key value violates exclusion constraint
 *
 * and must see
 *
 *   > That time slot is no longer available. Please choose another time.
 *
 * Every appointment failure goes through this function, so there is one place
 * that decides what is disclosable, and one place to check when asking
 * "could this leak a constraint name?". The provider's text is never
 * forwarded; it travels in `cause`, which is logged and never serialized —
 * the same arrangement `features/auth/errors.ts` established.
 *
 * ## Why the database raises distinct codes rather than one
 *
 * "That time is no longer available", "that is too soon to book" and "this
 * appointment can no longer be cancelled" are three different things for a
 * patient to do something about. A single generic failure would be safe and
 * useless. The codes are application-defined SQLSTATEs in a private class, so
 * the *meaning* crosses the boundary without any of the *text* doing so.
 *
 * ## The log event
 *
 * A stable, low-cardinality category, never the provider's message and never
 * an appointment or patient identifier beyond the opaque ids the caller
 * already holds. `appointment.slot_taken` occurring often is an operational
 * signal worth having; the underlying PostgREST string is not.
 */

import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";

/**
 * Application-defined SQLSTATEs raised by the Phase 09 functions.
 *
 * Mirrors `supabase/migrations/20260920120000_appointment_engine.sql`. A code
 * that appears there and not here falls through to the generic message, which
 * is safe but unhelpful, so `errors.test.ts` asserts the two agree.
 */
export const APPOINTMENT_ERROR_CODES = {
  /** The time is not offered: outside working hours, off-grid, or blocked. */
  notAvailable: "PV002",
  tooSoon: "PV003",
  tooFarAhead: "PV004",
  inThePast: "PV005",
  /** The practitioner or appointment type is not bookable. */
  notBookable: "PV006",
  noPatientRecord: "PV007",
  /** The appointment is in a status this operation does not allow. */
  invalidTransition: "PV008",
  /** No such appointment, or not this patient's. Indistinguishable on purpose. */
  notFound: "PV009",
  /** Too late to change it. */
  tooLate: "PV010",
  windowTooLarge: "PV011",
  tooManyActive: "PV012",
  textTooLong: "PV013",
  /**
   * No such patient record.
   *
   * Raised only by the staff write path, where a patient id is a real input
   * (`phase_10.md` section 18). It is distinct from `notFound`, which is about
   * an appointment, because the two send the receptionist to different places:
   * one means "search again", the other means "this booking has gone".
   */
  unknownPatient: "PV014",
  /**
   * The appointment cannot be completed while its consultation notes are a
   * draft.
   *
   * Raised by `appointments_guard_clinical_documentation()`, the Phase 12
   * trigger. It is declared here as well as in
   * `features/clinical/errors.ts` because it can reach a practitioner through
   * **this** mapper: Phase 11's "Complete consultation" status action is still
   * on the appointment page, and it is the path the trigger exists to refuse.
   *
   * Without this entry the refusal would fall through to the generic message,
   * which is safe and useless — the practitioner would be told something went
   * wrong rather than that their notes need finishing first
   * (`phase_12.md` section 73).
   */
  draftNotesOutstanding: "PV019",
} as const;

/** PostgreSQL's own codes that reach a patient through this feature. */
const EXCLUSION_VIOLATION = "23P01";
const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

export interface AppointmentFailure {
  /** Always safe to render. Never provider or database text. */
  readonly message: string;
  /** Stable category for the server log. Carries no identifier and no text. */
  readonly logEvent: string;
  /**
   * Whether this is a slot conflict.
   *
   * The booking flow reacts to it rather than only reporting it: the slot list
   * is stale by definition, so it is refreshed (`phase_09.md` section 42).
   */
  readonly slotConflict: boolean;
}

const FAILURES: Readonly<
  Record<string, Omit<AppointmentFailure, "message"> & { message: string }>
> = {
  [EXCLUSION_VIOLATION]: {
    message:
      "That time has just been taken. Please choose another time — the list below has been refreshed.",
    logEvent: "appointment.slot_taken",
    slotConflict: true,
  },
  [APPOINTMENT_ERROR_CODES.notAvailable]: {
    message: "That time isn't available. Please choose one of the times shown.",
    logEvent: "appointment.slot_unavailable",
    slotConflict: true,
  },
  [APPOINTMENT_ERROR_CODES.tooSoon]: {
    message:
      "That time is too soon to request online. Please choose a later time, or call the clinic.",
    logEvent: "appointment.too_soon",
    slotConflict: true,
  },
  [APPOINTMENT_ERROR_CODES.tooFarAhead]: {
    message: "That date is further ahead than the clinic is booking for.",
    logEvent: "appointment.beyond_horizon",
    slotConflict: true,
  },
  [APPOINTMENT_ERROR_CODES.inThePast]: {
    message: "That time has already passed. Please choose another time.",
    logEvent: "appointment.in_the_past",
    slotConflict: true,
  },
  [APPOINTMENT_ERROR_CODES.notBookable]: {
    message:
      "That practitioner or consultation type isn't available for booking. Please choose another.",
    logEvent: "appointment.not_bookable",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.noPatientRecord]: {
    message:
      "Please complete your profile before requesting an appointment, so the clinic knows who it is for.",
    logEvent: "appointment.no_patient_record",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.invalidTransition]: {
    message: "This appointment can no longer be changed.",
    logEvent: "appointment.invalid_transition",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.notFound]: {
    // Deliberately the same answer for "no such appointment" and "not
    // yours". An appointment id must not be an oracle for whether somebody
    // else's appointment exists (`phase_09.md` section 35).
    message: "We couldn't find that appointment.",
    logEvent: "appointment.not_found",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.tooLate]: {
    message:
      "This appointment can no longer be changed online. Please call the clinic.",
    logEvent: "appointment.too_late",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.windowTooLarge]: {
    message: "Please choose a date and try again.",
    logEvent: "appointment.window_too_large",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.tooManyActive]: {
    message:
      "You already have several appointments booked. Please attend or cancel one before requesting another.",
    logEvent: "appointment.too_many_active",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.textTooLong]: {
    message: "That note is too long. Please shorten it and try again.",
    logEvent: "appointment.text_too_long",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.unknownPatient]: {
    message:
      "We couldn't find that patient record. Please search for the patient again.",
    logEvent: "appointment.unknown_patient",
    slotConflict: false,
  },
  [APPOINTMENT_ERROR_CODES.draftNotesOutstanding]: {
    message:
      "The consultation notes for this appointment are still a draft. Open the consultation and complete it there — that completes the appointment too.",
    logEvent: "appointment.draft_notes_outstanding",
    slotConflict: false,
  },
  [INSUFFICIENT_PRIVILEGE]: {
    // Generic, and it names no role and no permission
    // (`phase_08.md` section 12).
    message: DEFAULT_USER_MESSAGE.forbidden,
    logEvent: "appointment.forbidden",
    slotConflict: false,
  },
  [CHECK_VIOLATION]: {
    message: "Some of those details aren't valid. Please check and try again.",
    logEvent: "appointment.check_violation",
    slotConflict: false,
  },
  [FOREIGN_KEY_VIOLATION]: {
    message:
      "That practitioner or consultation type isn't available for booking. Please choose another.",
    logEvent: "appointment.missing_reference",
    slotConflict: false,
  },
};

const GENERIC: AppointmentFailure = {
  message: "We couldn't complete that just now. Please try again.",
  logEvent: "appointment.operation_failed",
  slotConflict: false,
};

/**
 * Describes a database failure in terms it is safe to show.
 *
 * Takes the whole error object rather than a code string so that a caller
 * cannot accidentally pass `error.message` and have it echoed back. Anything
 * unrecognised — including a driver error, a network failure or `undefined` —
 * becomes the generic message, so a new database error class cannot become a
 * user-facing message by default.
 */
export function describeAppointmentFailure(error: unknown): AppointmentFailure {
  const code = readCode(error);
  if (!code) return GENERIC;

  return FAILURES[code] ?? GENERIC;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
