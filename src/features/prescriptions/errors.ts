/**
 * Database failure to safe copy, for prescriptions.
 *
 * ## What may not cross this boundary
 *
 * `phase_13.md` section 84 and `docs/SECURITY.md` section 16. A message like
 * *"insert violates foreign key prescription_items_prescription_id_fkey"*
 * names a table, a column and a constraint, and it tells a caller the shape
 * of the schema. Nothing of the sort reaches a screen or a log: every message
 * below is written here, in full, and the provider's own text is discarded.
 *
 * ## Every message says what happened to the work
 *
 * A doctor who presses "Save draft" and sees a red box needs to know whether
 * the prescription was saved. Every message says so explicitly, because
 * "something went wrong" leaves somebody wondering whether to type it again.
 *
 * ## A conflict is not an error
 *
 * `conflict: true` means the write was refused because the prescription had
 * moved on, and the answer is to reload rather than to try again. Saving
 * again would perform exactly the overwrite the refusal prevented, so the
 * form stops offering it.
 */

import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";

/**
 * The application-defined SQLSTATEs the Phase 13 migration raises for
 * prescriptions.
 *
 * Disjoint from the treatment plan codes (PV030-PV035) on purpose: two
 * self-contained features, neither importing the other's internals.
 */
export const PRESCRIPTION_ERROR_CODES = {
  notFound: "PV020",
  notEditable: "PV021",
  staleWrite: "PV022",
  incomplete: "PV023",
  invalidTransition: "PV024",
  consultationNotFound: "PV025",
} as const;

const INSUFFICIENT_PRIVILEGE = "42501";
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const NOT_NULL_VIOLATION = "23502";
const FOREIGN_KEY_VIOLATION = "23503";

export interface PrescriptionFailure {
  readonly message: string;
  readonly logEvent: string;
  readonly conflict: boolean;
}

const FAILURES: Readonly<Record<string, PrescriptionFailure>> = {
  [PRESCRIPTION_ERROR_CODES.notFound]: {
    message: "We couldn't find that prescription.",
    logEvent: "prescription.not_found",
    conflict: false,
  },
  [PRESCRIPTION_ERROR_CODES.notEditable]: {
    message:
      "This prescription has been issued and can no longer be changed. Your changes have not been saved. To correct it, withdraw it and write a new one.",
    logEvent: "prescription.not_editable",
    conflict: true,
  },
  [PRESCRIPTION_ERROR_CODES.staleWrite]: {
    message:
      "This prescription was updated somewhere else. Reload the page to see the latest version before saving — your changes have not been saved.",
    logEvent: "prescription.stale_write",
    conflict: true,
  },
  [PRESCRIPTION_ERROR_CODES.incomplete]: {
    message:
      "A prescription needs at least one medicine or remedy, and every line needs a name. Nothing has been changed.",
    logEvent: "prescription.incomplete",
    conflict: false,
  },
  [PRESCRIPTION_ERROR_CODES.invalidTransition]: {
    message:
      "This prescription has already been withdrawn. Nothing has been changed.",
    logEvent: "prescription.invalid_transition",
    conflict: true,
  },
  [PRESCRIPTION_ERROR_CODES.consultationNotFound]: {
    message: "We couldn't find that consultation.",
    logEvent: "prescription.consultation_not_found",
    conflict: false,
  },
  [UNIQUE_VIOLATION]: {
    message:
      "A prescription for this consultation already exists. Reload the page to open it.",
    logEvent: "prescription.duplicate",
    conflict: true,
  },
  [CHECK_VIOLATION]: {
    message:
      "Some of that couldn't be saved as written. Please shorten any very long entry and try again — nothing has been saved.",
    logEvent: "prescription.check_violation",
    conflict: false,
  },
  [NOT_NULL_VIOLATION]: {
    message: "Every line needs a medicine or remedy. Nothing has been saved.",
    logEvent: "prescription.missing_value",
    conflict: false,
  },
  [FOREIGN_KEY_VIOLATION]: {
    message: "We couldn't find that consultation.",
    logEvent: "prescription.missing_reference",
    conflict: false,
  },
  [INSUFFICIENT_PRIVILEGE]: {
    message: DEFAULT_USER_MESSAGE.forbidden,
    logEvent: "prescription.forbidden",
    conflict: false,
  },
};

const GENERIC: PrescriptionFailure = {
  message:
    "We couldn't save the prescription. Your changes have not been saved — please review the information and try again.",
  logEvent: "prescription.operation_failed",
  conflict: false,
};

export function describePrescriptionFailure(
  error: unknown,
): PrescriptionFailure {
  const code = readCode(error);
  if (!code) return GENERIC;
  return FAILURES[code] ?? GENERIC;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
