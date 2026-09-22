/**
 * Phase 19 security limits.
 *
 * ## The gap these close
 *
 * `phase_19.md` section 69 asks for rate limiting to be audited across eleven
 * surfaces. The audit found the coverage uneven rather than absent:
 *
 * ```text
 *   login, registration, reset, OTP   Supabase Auth's own limits
 *   clinical AI                       a database-backed quota, per practitioner
 *                                     and per patient (Phase 17)
 *   appointment creation              a per-patient cap on live appointments
 *                                     (Phase 09) — an abuse bound, not a rule
 *   the notification worker           a fixed window, behind a shared secret
 *   contact form                      not rendered; no endpoint exists
 *
 *   document upload                   NOTHING
 *   report export                     NOTHING
 *   patient search                    bounded results, but nothing on the rate
 * ```
 *
 * The three at the bottom are the ones this file bounds. Each is expensive on
 * a different axis, which is why each gets a different number rather than one
 * shared limit:
 *
 *   * an **upload** costs 10 MB of memory and a storage object per request;
 *   * an **export** runs a year-wide aggregate and produces a file of clinic
 *     operations;
 *   * a **search** reads patient records, so repeating it is the cheapest way
 *     to enumerate them one page at a time.
 *
 * ## What these limits are, and what they are not
 *
 * They are guard rails on one server instance. `lib/rate-limit/fixed-window.ts`
 * is explicit about the difference and it bears repeating here, because a
 * limit described as more than it is becomes the reason nobody adds the real
 * one: **two instances keep two counters and a restart clears them.**
 *
 * They are keyed on the authenticated user id rather than on an IP address.
 * For these three surfaces that is the right key — every one of them requires
 * a session, so there is an account to attribute abuse to, and an IP is both
 * shared (a clinic behind one NAT) and trivially rotated. An IP-keyed limit
 * belongs on an unauthenticated surface, and this application has none that
 * touches the database.
 *
 * ## Why the numbers are what they are
 *
 * Generous enough that no real clinic day touches them, low enough that a
 * script notices. Nobody has given this project operational figures, so these
 * are bounds on *abuse* rather than clinical rules, and they are recorded as
 * provisional in exactly the way Phase 09's booking rules are.
 */

/**
 * Patient document uploads, per account.
 *
 * Twenty an hour. A patient bringing a year of scans to their first
 * consultation uploads perhaps a dozen; a practitioner attaching a batch
 * during a clinic, fewer. Sustained beyond this is a script, not a person.
 */
export const DOCUMENT_UPLOAD_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 60 * 1000,
} as const;

/**
 * Report exports, per account.
 *
 * Ten an hour. An administrator comparing periods might build four or five in
 * a sitting. Each one is a year-wide aggregate and a file of clinic operations
 * leaving the building, so the ceiling is deliberately lower than the others.
 */
export const REPORT_EXPORT_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000,
} as const;

/**
 * Patient searches, per account.
 *
 * A hundred and twenty in five minutes — deliberately high, because a
 * receptionist at a busy front desk types, corrects and retypes a name, and a
 * limit that interrupts that is a limit somebody will remove.
 *
 * It is not there to stop a person searching. It is there so that a session
 * turned into an enumeration script hits a ceiling: the search already refuses
 * a term under two characters and returns at most fifty rows, so the only way
 * to walk the patient list is to issue a great many queries, and this is what
 * makes that slow and visible.
 */
export const PATIENT_SEARCH_RATE_LIMIT = {
  maxRequests: 120,
  windowMs: 5 * 60 * 1000,
} as const;
