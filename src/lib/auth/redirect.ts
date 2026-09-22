/**
 * Safe redirect handling.
 *
 * ## The vulnerability this exists to prevent
 *
 * An authentication flow that redirects to a destination supplied in the URL
 * is an open redirect unless the destination is validated
 * (`docs/implementation-plan/phase_06.md` section 16). The attack is cheap and
 * effective against exactly this kind of product: a link to
 * `https://punarvasu.example/auth/login?next=https://punarvasu-example.evil/`
 * carries the real clinic's domain, so a patient checks the domain, signs in,
 * and is handed to a page asking them to "confirm" their password.
 *
 * So `redirect(searchParams.get("next"))` is never written anywhere in this
 * codebase. Every externally supplied destination passes through
 * {@link safeRedirectPath} first, and that function returns a *path*, never a
 * URL - there is no input to it that can produce a different origin.
 *
 * ## The rule
 *
 * A destination is accepted only if it parses as an absolute path on this
 * origin, and it is re-serialised from its parsed parts rather than passed
 * through. Both halves matter: parsing rejects the hostile shapes, and
 * re-serialising means anything the parser normalised away cannot survive into
 * the response.
 *
 * This module is intentionally pure and dependency-free, so the proxy, server
 * actions, server components and the test suite all validate identically.
 */

import { AUTHENTICATED_LANDING_PATH, LOGIN_PATH } from "./paths";

/** The query parameter carrying an intended destination. */
export const NEXT_PARAM = "next";

/**
 * Upper bound on an accepted destination.
 *
 * A legitimate internal path is far shorter. The bound exists so a
 * multi-kilobyte `next` cannot be pushed through a log, a cookie or a
 * `Location` header.
 */
export const MAX_REDIRECT_LENGTH = 512;

/**
 * A base used only so the WHATWG parser accepts a relative reference. Nothing
 * derived from it is ever returned; it is a parsing fixture, not an origin.
 */
const PARSE_BASE = "http://redirect.invalid";

/**
 * Prefixes a destination may not target.
 *
 * `/auth` because returning a freshly signed-in user to the sign-in flow is a
 * loop, and `/api` because an API response is not a page to navigate a
 * browser to.
 */
const REJECTED_PREFIXES: readonly string[] = ["/auth", "/api"];

/**
 * Auth paths that *are* valid destinations, despite the rule above.
 *
 * There is exactly one, and it is not an exception for convenience: the
 * password recovery flow has to end on the page that sets a new password.
 * Supabase sends the user to `/auth/callback`, the callback exchanges the
 * emailed token for a session, and the only useful place to put them next is
 * `/auth/reset-password`.
 *
 * Without this, the blanket `/auth` rejection silently rewrote that
 * destination to the authenticated landing page — so a user who clicked
 * "reset my password" was signed in and dropped on their account, with no way
 * to actually change the password. The flow looked like it worked and did not.
 * Caught by driving the real recovery link against the live Auth server.
 *
 * Allowing it costs nothing. A crafted `?next=/auth/reset-password` sends a
 * signed-in user to a page where they may change their own password, on our
 * own origin, having typed a new one twice. That is not an attack; an open
 * redirect is, and this list cannot express one because every entry is a
 * literal internal path compared for equality.
 */
const ALLOWED_AUTH_DESTINATIONS: readonly string[] = ["/auth/reset-password"];

/**
 * True when `value` contains a character that must never reach a URL parser or
 * a `Location` header.
 *
 * Two ranges: C0 controls and space (U+0000 to U+0020), then DEL and the C1
 * controls (U+007F to U+009F). A tab, newline or NUL smuggled into a redirect
 * target is how header injection and parser-confusion attacks begin, so they
 * are rejected before anything else looks at the value.
 *
 * Written as an explicit code-point scan rather than the equivalent regular
 * expression because the formatter in this toolchain rewrites unicode escapes
 * inside a character class into the literal bytes they denote. That put an
 * invisible NUL into this file, which makes the rule impossible to grep for
 * and one encoding mishap away from silently matching nothing. A security
 * check has to stay readable in a diff.
 */
function hasUnsafeCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

/**
 * As {@link hasUnsafeCharacter}, but space is allowed.
 *
 * Used on the *decoded* value only. A raw space has no business in a
 * `Location` header, but `%20` inside a path segment is ordinary data, and
 * rejecting it would refuse legitimate destinations.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

/**
 * Validates an externally supplied destination.
 *
 * Returns `value` normalised to a path with its query and fragment when it is
 * a safe internal destination, and `fallback` in every other case. It never
 * throws, and never returns anything carrying a scheme or an authority.
 *
 * Rejected, with the reason each one matters:
 *
 * - `https://evil.example` - absolute URL, different origin
 * - `//evil.example` - protocol-relative; browsers follow it
 * - `/\evil.example` - the backslash form of the same attack
 * - `javascript:alert(1)` - not a path; script execution
 * - `/a/../../b` - traversal above the root
 * - a value containing a newline - header injection
 * - `/%2f%2fevil.example` - the encoded protocol-relative form
 * - `/auth/login` - sends the user back into the auth flow
 * - a 5,000-character path - unbounded input into headers and logs
 *
 * @param value    Whatever arrived from a URL, a form field or a cookie.
 * @param fallback Used whenever `value` is not acceptable. Must itself be a
 *                 trusted internal path: it is application-authored, never
 *                 user input.
 */
export function safeRedirectPath(
  value: unknown,
  fallback: string = AUTHENTICATED_LANDING_PATH,
): string {
  if (typeof value !== "string") return fallback;

  const raw = value.trim();
  if (raw.length === 0 || raw.length > MAX_REDIRECT_LENGTH) return fallback;
  if (hasUnsafeCharacter(raw)) return fallback;

  // Must be an absolute path. This single check removes every absolute URL,
  // every scheme-bearing value and every relative path at once.
  if (!raw.startsWith("/")) return fallback;

  // Protocol-relative forms. Browsers read both as an authority, so neither
  // reaches the parser.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;

  // One decoding pass, because `/%2f%2fevil.example` is the same attack
  // wearing an encoding. A value that fails to decode is malformed and is
  // rejected rather than repaired.
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (
    // Only true control characters here, not space: the raw value has already
    // been screened, and a percent-encoded space is ordinary path data - a
    // destination like `/patient/my%20records` is perfectly legitimate.
    hasControlCharacter(decoded) ||
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.startsWith("/\\")
  ) {
    return fallback;
  }

  // Traversal is rejected outright rather than left to the parser.
  //
  // This is stricter than it strictly has to be, deliberately. `new URL()`
  // resolves `/../etc/passwd` to `/etc/passwd`, which is still same-origin and
  // therefore not an open redirect - but it is a *different destination from
  // the one requested*, arrived at silently, and no legitimate link this
  // application produces contains a `..` segment. Somewhere a step behind a
  // path-normalisation surprise there is usually an access-control surprise,
  // so the input is refused instead of rewritten.
  //
  // The check runs on the decoded value, because the parser treats `%2e%2e` as
  // a dot segment too.
  if (hasTraversalSegment(decoded)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, PARSE_BASE);
  } catch {
    return fallback;
  }

  // The parser resolves traversal, backslashes and stray authorities. If the
  // result left the fixture origin, the input was never a same-origin path.
  if (url.origin !== PARSE_BASE) return fallback;

  const { pathname } = url;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return fallback;

  // The allow-list is checked on the *parsed* pathname, by exact equality, so
  // `/auth/reset-password/../login` and `/auth/reset-passwordX` are not it.
  if (
    !ALLOWED_AUTH_DESTINATIONS.includes(pathname) &&
    isRejectedPrefix(pathname)
  ) {
    return fallback;
  }

  // Re-serialised from the parsed parts: whatever the parser normalised away
  // is gone, and the return value cannot carry a scheme or an authority.
  return `${pathname}${url.search}${url.hash}`;
}

/**
 * True when the path portion of `value` contains a `..` segment.
 *
 * Only the path is examined: `..` inside a query value or a fragment is
 * ordinary data and changes no destination. Both separators are treated as
 * separators, because a browser reads a backslash as one.
 */
function hasTraversalSegment(value: string): boolean {
  const pathPortion = value.split("?")[0]?.split("#")[0] ?? "";
  return pathPortion.split(/[/\\]/).includes("..");
}

function isRejectedPrefix(pathname: string): boolean {
  return REJECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The sign-in URL, carrying the destination to return to afterwards.
 *
 * The destination is validated here rather than trusted, because callers pass
 * a pathname taken from an incoming request. A rejected destination drops out,
 * leaving a plain sign-in link: a user who has to find their own way back is a
 * far better outcome than one who is redirected off-site.
 */
export function loginPathWithNext(intendedPath: unknown): string {
  const next = safeRedirectPath(intendedPath, "");
  if (next === "") return LOGIN_PATH;

  const params = new URLSearchParams({ [NEXT_PARAM]: next });
  return `${LOGIN_PATH}?${params.toString()}`;
}

/**
 * Reads the `next` parameter out of a search-parameter bag of either shape.
 *
 * Next.js hands page components `string | string[] | undefined` per key. A
 * repeated parameter is a smuggling attempt rather than something a person
 * does, so it is discarded rather than having its first value taken.
 */
export function readNextParam(
  searchParams:
    Record<string, string | string[] | undefined> | URLSearchParams | undefined,
): string | undefined {
  if (!searchParams) return undefined;

  if (searchParams instanceof URLSearchParams) {
    const all = searchParams.getAll(NEXT_PARAM);
    return all.length === 1 ? all[0] : undefined;
  }

  const value = searchParams[NEXT_PARAM];
  return typeof value === "string" ? value : undefined;
}
