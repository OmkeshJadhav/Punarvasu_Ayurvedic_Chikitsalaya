/**
 * Request correlation.
 *
 * One identifier follows a request through route handler, service and database
 * work, so a production failure can be traced without recording who the user
 * was or what they were looking at.
 */

export const REQUEST_ID_HEADER = "x-request-id";

/** Accepts only opaque, bounded ids, so a header cannot poison the log. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Reuses an upstream correlation id when the proxy supplied a well-formed one,
 * and generates a fresh id otherwise.
 */
export function resolveRequestId(headers: Headers): string {
  const incoming = headers.get(REQUEST_ID_HEADER);
  if (incoming && SAFE_REQUEST_ID.test(incoming)) return incoming;
  return crypto.randomUUID();
}
