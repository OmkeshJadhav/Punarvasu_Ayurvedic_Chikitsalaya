/**
 * Database failure to safe copy, for analytics.
 *
 * ## What may not cross this boundary
 *
 * `phase_16.md` sections 65 and 119, and `docs/SECURITY.md` section 16. A
 * message such as *"permission denied for function
 * analytics_clinic_patient_summary"* names a function and tells the caller
 * the shape of the reporting interface; *"relation notification_deliveries
 * does not exist"* names a table. Neither reaches a screen: every message
 * below is written here, in full, and the provider's own text is discarded.
 *
 * The provider error still travels in the structured log, where it is
 * diagnosable and not disclosable — the same arrangement every phase since 09
 * has used.
 *
 * ## Why a refusal is not an error state
 *
 * A caller who is not authorized for a panel gets `forbidden`, and the page
 * renders nothing for that panel rather than an alarming red box. On the
 * clinic dashboard that case should be unreachable — the page checked the
 * permission before it read anything — so it is also logged: reaching it
 * means the application's policy and the database's gate disagree, which is
 * worth knowing about.
 */

import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";

/**
 * The application-defined SQLSTATEs the Phase 16 migration raises.
 *
 * Disjoint from every earlier phase's: appointments hold PV001-PV019,
 * prescriptions PV020-PV025, treatment plans PV030-PV035, documents
 * PV040-PV047, notifications PV050-PV059.
 */
export const ANALYTICS_ERROR_CODES = {
  invalidRange: "PV060",
  rangeTooLong: "PV061",
  rangeBeforeRecords: "PV062",
} as const;

const INSUFFICIENT_PRIVILEGE = "42501";
const UNDEFINED_FUNCTION = "42883";

export interface AnalyticsFailure {
  readonly message: string;
  readonly logEvent: string;
  /** True when the caller is not permitted, rather than something failing. */
  readonly forbidden: boolean;
}

const FAILURES: Readonly<Record<string, AnalyticsFailure>> = {
  [ANALYTICS_ERROR_CODES.invalidRange]: {
    message:
      "That reporting period isn't valid. Check the start and end dates and try again.",
    logEvent: "analytics.invalid_range",
    forbidden: false,
  },
  [ANALYTICS_ERROR_CODES.rangeTooLong]: {
    message:
      "That reporting period is longer than this report covers. Choose a period of up to one year.",
    logEvent: "analytics.range_too_long",
    forbidden: false,
  },
  [ANALYTICS_ERROR_CODES.rangeBeforeRecords]: {
    message:
      "That reporting period starts before the clinic's records begin. Choose a later start date.",
    logEvent: "analytics.range_before_records",
    forbidden: false,
  },
  [INSUFFICIENT_PRIVILEGE]: {
    message: DEFAULT_USER_MESSAGE.forbidden,
    logEvent: "analytics.forbidden",
    forbidden: true,
  },
  [UNDEFINED_FUNCTION]: {
    // Reachable only when the migration has not been applied. The operator
    // needs this to be distinguishable in the log; the reader does not need
    // to know a function is missing.
    message: "We couldn't load this report. Please try again.",
    logEvent: "analytics.interface_missing",
    forbidden: false,
  },
};

const GENERIC: AnalyticsFailure = {
  // Section 65's own wording. Deliberately the same sentence everywhere, so a
  // reader learns that a report failing looks like this and not like a number.
  message: "We couldn't load this report. Please try again.",
  logEvent: "analytics.read_failed",
  forbidden: false,
};

/**
 * A safe description of a failed analytics read.
 *
 * Accepts `unknown`, because a PostgREST error, a thrown `Error` and a
 * rejected promise all arrive here and none of them may be trusted to have a
 * `code`.
 */
export function describeAnalyticsFailure(error: unknown): AnalyticsFailure {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;

  if (code && code in FAILURES) {
    return FAILURES[code] ?? GENERIC;
  }

  return GENERIC;
}
