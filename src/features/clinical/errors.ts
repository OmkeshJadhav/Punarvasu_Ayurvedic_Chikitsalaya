/**
 * Database failure to something a practitioner can read.
 *
 * ## Why this is a separate mapper from the appointment one
 *
 * `features/appointments/errors.ts` translates failures a *patient* gets
 * while booking. The reader here is a practitioner mid-consultation, the
 * failures are different, and the two most important ones have no appointment
 * equivalent at all: a stale write (section 34) and a completed record that
 * may not be edited (section 16).
 *
 * The codes overlap deliberately where the meaning does — `PV008`, `PV009`
 * and `insufficient_privilege` already mean what this feature needs them to
 * mean — so the migration raises those rather than inventing near-synonyms.
 *
 * ## What never crosses this boundary
 *
 * Section 44: no Postgres policy error, no RLS failure, no SQL, no stack
 * trace, no constraint name, no table name, no column name, and no provider
 * text. The message is written here; the underlying failure stays in the
 * server log.
 *
 * ## And what never goes into the log
 *
 * Section 43 and example 7: the log event is a stable, low-cardinality
 * category. It carries no clinical content, no patient name and no record
 * text. `clinical.stale_write` occurring often is an operational signal worth
 * having; what somebody typed is not.
 */

import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";

/**
 * Application-defined SQLSTATEs raised by the Phase 12 functions and triggers.
 *
 * Mirrors `supabase/migrations/20260923120000_clinical_records.sql`. A code
 * raised there and missing here falls through to the generic message, which
 * is safe but unhelpful, so `errors.test.ts` asserts the two agree.
 */
export const CLINICAL_ERROR_CODES = {
  /**
   * The record has moved on since it was loaded.
   *
   * The one failure this phase exists to produce rather than avoid. Section
   * 34: do not silently overwrite newer clinical information.
   */
  staleWrite: "PV015",
  /**
   * The record is not editable, or the transition is not allowed.
   *
   * Raised by `clinical_records_guard_update()` and by the two save
   * functions. One code for "completed records cannot be edited", "a record
   * cannot be moved to another patient" and "that status change is not
   * allowed", because from the practitioner's side they are one thing: this
   * record is finished.
   */
  notEditable: "PV016",
  /** Completion attempted without the fields the clinic requires. */
  incomplete: "PV017",
  /** No such clinical record, or not this practitioner's. On purpose. */
  recordNotFound: "PV018",
  /** The appointment cannot be completed while its notes are a draft. */
  draftNotesOutstanding: "PV019",
} as const;

/** Codes raised by Phase 09 and Phase 11 that reach a practitioner here. */
const APPOINTMENT_NOT_FOUND = "PV009";
const INVALID_TRANSITION = "PV008";

/** PostgreSQL's own codes that can reach this feature. */
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const INSUFFICIENT_PRIVILEGE = "42501";

export interface ClinicalFailure {
  /** Always safe to render. Never provider or database text. */
  readonly message: string;
  /** Stable category for the server log. No identifier, no clinical text. */
  readonly logEvent: string;
  /**
   * Whether the practitioner's copy is now older than the database's.
   *
   * The form reacts to this rather than only reporting it: it stops offering
   * to save, because saving again would be the overwrite the conflict just
   * prevented, and it asks for a reload instead (section 34).
   */
  readonly conflict: boolean;
}

const FAILURES: Readonly<Record<string, ClinicalFailure>> = {
  [CLINICAL_ERROR_CODES.staleWrite]: {
    // Section 34's own wording, near enough: say what happened and what to do.
    message:
      "This consultation was updated somewhere else. Reload the page to see the latest notes before saving — your changes have not been saved.",
    logEvent: "clinical.stale_write",
    conflict: true,
  },
  [CLINICAL_ERROR_CODES.notEditable]: {
    message:
      "This consultation has been completed and can no longer be edited. Your changes have not been saved.",
    logEvent: "clinical.not_editable",
    conflict: true,
  },
  [CLINICAL_ERROR_CODES.incomplete]: {
    message:
      "A completed consultation needs a chief complaint and an assessment. Add both, then complete it.",
    logEvent: "clinical.incomplete",
    conflict: false,
  },
  [CLINICAL_ERROR_CODES.recordNotFound]: {
    // Deliberately the same answer for "no such record" and "not yours"
    // (section 57). A record id must not be an oracle.
    message: "We couldn't find that consultation.",
    logEvent: "clinical.record_not_found",
    conflict: false,
  },
  [CLINICAL_ERROR_CODES.draftNotesOutstanding]: {
    message:
      "The consultation notes for this appointment are still a draft. Open the consultation and complete it first.",
    logEvent: "clinical.draft_notes_outstanding",
    conflict: false,
  },
  [APPOINTMENT_NOT_FOUND]: {
    message: "We couldn't find that appointment.",
    logEvent: "clinical.appointment_not_found",
    conflict: false,
  },
  [INVALID_TRANSITION]: {
    message:
      "This appointment isn't ready for a consultation. The patient needs to be checked in at the front desk first.",
    logEvent: "clinical.appointment_not_ready",
    conflict: false,
  },
  [UNIQUE_VIOLATION]: {
    // `start_consultation` resolves this itself with `on conflict do nothing`,
    // so reaching here means something unexpected. Still mapped, because a
    // raw constraint name must never reach a screen.
    message:
      "A consultation for this appointment already exists. Reload the page to open it.",
    logEvent: "clinical.duplicate_record",
    conflict: true,
  },
  [CHECK_VIOLATION]: {
    message:
      "Some of those notes couldn't be saved as written. Please shorten any very long section and try again.",
    logEvent: "clinical.check_violation",
    conflict: false,
  },
  [FOREIGN_KEY_VIOLATION]: {
    message: "We couldn't find that appointment.",
    logEvent: "clinical.missing_reference",
    conflict: false,
  },
  [INSUFFICIENT_PRIVILEGE]: {
    // Generic, and it names no role and no permission
    // (`phase_08.md` section 12).
    message: DEFAULT_USER_MESSAGE.forbidden,
    logEvent: "clinical.forbidden",
    conflict: false,
  },
};

const GENERIC: ClinicalFailure = {
  // Section 44's wording. It says plainly that nothing was saved, because the
  // worst outcome here is a practitioner believing their notes are safe.
  message:
    "We couldn't save the clinical record. Your changes have not been saved — please try again.",
  logEvent: "clinical.operation_failed",
  conflict: false,
};

/**
 * Describes a database failure in terms it is safe to show.
 *
 * Takes the whole error object rather than a code string, so a caller cannot
 * accidentally pass `error.message` and have it echoed back. Anything
 * unrecognised — a driver error, a network failure, `undefined` — becomes the
 * generic message, so a new database error class cannot become a user-facing
 * message by default.
 */
export function describeClinicalFailure(error: unknown): ClinicalFailure {
  const code = readCode(error);
  if (!code) return GENERIC;

  return FAILURES[code] ?? GENERIC;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
