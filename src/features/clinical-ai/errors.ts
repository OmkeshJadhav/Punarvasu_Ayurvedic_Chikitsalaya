/**
 * Clinical AI failure to something a practitioner can read.
 *
 * ## The rule every message here follows
 *
 * Section 83 and example 10: say that AI is unavailable, and say that the
 * consultation is unaffected. The second half is not padding — a practitioner
 * who sees an error mid-consultation needs to know immediately whether their
 * notes are at risk, and the answer is always no, because nothing in this
 * feature writes anything clinical.
 *
 * ## What never crosses this boundary
 *
 * Sections 90, 101. No provider text, no HTTP body, no stack trace, no model
 * name in an error, no key, no prompt, no fragment of a response. A provider's
 * error body can quote the request back, and the request is a clinical prompt
 * about an identifiable person — which is why `lib/ai/gemini.ts` discards the
 * body rather than passing it here to be filtered.
 *
 * ## And what goes into the log
 *
 * The failure code and nothing else. `clinical_ai.safety_rejected` occurring
 * often is a signal worth watching (section 107); what the model said is not.
 */

import type { ClinicalAIFailureCode } from "@/lib/ai/provider";

/**
 * Messages, by failure code.
 *
 * Distinct where the practitioner's next action differs, and identical where
 * it does not. There is no message that distinguishes "your key is wrong" from
 * "the model name is wrong" — both are `provider_rejected`, both mean the same
 * thing to the person reading it, and telling a clinical user which one would
 * be disclosing configuration to somebody who cannot act on it.
 */
const MESSAGES: Readonly<Record<ClinicalAIFailureCode, string>> = {
  provider_timeout:
    "AI assistance took too long to respond. Your consultation is unaffected — you can try again, or carry on without it.",
  provider_unavailable:
    "AI assistance is temporarily unavailable. Your consultation is unaffected and can be continued normally.",
  provider_rate_limited:
    "AI assistance is temporarily busy. Please try again in a few minutes. Your consultation is unaffected.",
  provider_rejected:
    "AI assistance is temporarily unavailable. Your consultation is unaffected and can be continued normally.",
  provider_auth_failed:
    "AI assistance is not available right now. Your consultation is unaffected — please let the clinic's administrator know.",
  network_failure:
    "AI assistance could not be reached. Please check your connection and try again. Your consultation is unaffected.",
  empty_response:
    "AI assistance could not produce a usable answer for this request. Your consultation is unaffected.",
  oversized_response:
    "AI assistance returned an answer that could not be displayed safely. Your consultation is unaffected.",
  invalid_response:
    "AI assistance returned an answer that could not be displayed safely. Your consultation is unaffected.",
  // Section 71. Deliberately does not repeat or characterise what was refused:
  // quoting a rejected clinical instruction back to a practitioner would put
  // the thing on screen that the rejection existed to keep off it.
  safety_rejected:
    "AI assistance produced an answer that fell outside what this tool is allowed to show, so it was discarded. Your consultation is unaffected — you can try again, or carry on without it.",
  context_unavailable:
    "We couldn't read the clinical information for this consultation. Your consultation is unaffected — please reload and try again.",
  quota_exceeded:
    "AI assistance has been used several times recently. Please wait a few minutes before trying again. Your consultation is unaffected.",
  not_configured:
    "AI assistance is not switched on for this clinic. Your consultation is unaffected and works normally without it.",
};

/** The message for a failure code. Always safe to render. */
export function describeClinicalAIFailure(code: ClinicalAIFailureCode): string {
  return MESSAGES[code];
}

/**
 * The application-defined SQLSTATEs raised by the Phase 17 migration.
 *
 * Mirrors `supabase/migrations/20260928120000_clinical_ai_assistance.sql`.
 * `errors.test.ts` asserts the two agree by reading the SQL.
 */
export const CLINICAL_AI_ERROR_CODES = {
  /** No such appointment, or not this practitioner's. Deliberately one code. */
  appointmentNotFound: "PV070",
  /** The practitioner's quota for the window. */
  practitionerQuotaExceeded: "PV071",
  /** The per-patient quota, which bounds a loop pointed at one record. */
  patientQuotaExceeded: "PV072",
  /** An audit row cannot be rewritten. */
  sessionNotWritable: "PV073",
} as const;

const INSUFFICIENT_PRIVILEGE = "42501";

/**
 * Maps a database failure raised while claiming quota to a failure code.
 *
 * `null` means "not one of ours" — the caller then treats it as a context
 * failure, which is the safe direction: an unrecognised database error must
 * not become a user-facing message by default.
 */
export function describeClinicalAIDatabaseFailure(
  error: unknown,
): ClinicalAIFailureCode {
  const code = readCode(error);

  switch (code) {
    case CLINICAL_AI_ERROR_CODES.practitionerQuotaExceeded:
    case CLINICAL_AI_ERROR_CODES.patientQuotaExceeded:
      return "quota_exceeded";
    case CLINICAL_AI_ERROR_CODES.appointmentNotFound:
      return "context_unavailable";
    case INSUFFICIENT_PRIVILEGE:
      // A doctor with no practitioner record, or a role the gate refuses.
      // Named as "not configured for you" rather than as a permission error,
      // because the practitioner cannot act on a permission message and
      // `phase_08.md` section 12 says not to name the permission anyway.
      return "not_configured";
    default:
      return "context_unavailable";
  }
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
