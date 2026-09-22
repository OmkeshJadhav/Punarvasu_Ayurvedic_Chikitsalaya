/**
 * Per-account rate limits for the three expensive authenticated surfaces.
 *
 * ## Why the limiters live here rather than at each call site
 *
 * A `createFixedWindowRateLimiter` call inside a module body creates one
 * limiter per module instance, which is what you want — but scattering them
 * means three files each holding a counter with no shared vocabulary, and the
 * fourth surface that needs one starts a fourth convention. One module, three
 * named limiters, and a call site that reads as a sentence.
 *
 * `src/config/security.ts` carries the numbers and the argument for them.
 * `lib/rate-limit/fixed-window.ts` carries the honest description of what an
 * in-memory limiter is and is not. Neither is repeated here.
 *
 * ## The key is the account, and that matters
 *
 * Every surface behind these limits requires a session, so there is an account
 * to attribute abuse to. Keying on an IP would be worse in both directions: a
 * clinic behind one NAT shares an address, and an attacker rotates one.
 *
 * The limiter bounds how many distinct keys it tracks, so a key an attacker
 * controls cannot become a memory leak an attacker controls — which is why a
 * user id is safe to key on and a request header would not be.
 */
import "server-only";

import {
  DOCUMENT_UPLOAD_RATE_LIMIT,
  PATIENT_SEARCH_RATE_LIMIT,
  REPORT_EXPORT_RATE_LIMIT,
} from "@/config/security";
import { createFixedWindowRateLimiter } from "@/lib/rate-limit/fixed-window";

/** The three surfaces Phase 19 found unbounded. */
export type LimitedOperation =
  "document_upload" | "report_export" | "patient_search";

const CONFIGURATION = {
  document_upload: DOCUMENT_UPLOAD_RATE_LIMIT,
  report_export: REPORT_EXPORT_RATE_LIMIT,
  patient_search: PATIENT_SEARCH_RATE_LIMIT,
} as const;

function createLimiters() {
  return {
    document_upload: createFixedWindowRateLimiter(
      CONFIGURATION.document_upload,
    ),
    report_export: createFixedWindowRateLimiter(CONFIGURATION.report_export),
    patient_search: createFixedWindowRateLimiter(CONFIGURATION.patient_search),
  };
}

let limiters = createLimiters();

/**
 * Consumes one unit of the account's allowance.
 *
 * Returns `true` when the request may proceed. Call it **after** authenticating
 * and authorizing, never before: a limiter consulted before authorization is a
 * limiter an unauthenticated caller can exhaust on a real user's behalf, and
 * the key would have to come from somewhere less trustworthy than a session.
 *
 * @param operation Which allowance to draw from.
 * @param userId    The authenticated account. Never a header, never a form
 *                  field, never an IP.
 */
export function allowOperation(
  operation: LimitedOperation,
  userId: string,
): boolean {
  return limiters[operation].check(`${operation}:${userId}`).allowed;
}

/**
 * Test seam: discards every counter.
 *
 * The limiters are module singletons, which is correct in production — one
 * process, one set of counters — and is exactly wrong in a test file, where
 * twenty upload tests in a row would otherwise exhaust a real allowance and
 * the twenty-first would fail for a reason that has nothing to do with what it
 * is testing.
 *
 * Named and exported rather than reached for through module internals, in the
 * same shape as `resetServerEnvCache()`, so that a test resetting state is
 * doing something the module offers rather than something it gets away with.
 */
export function resetRateLimits(): void {
  limiters = createLimiters();
}
