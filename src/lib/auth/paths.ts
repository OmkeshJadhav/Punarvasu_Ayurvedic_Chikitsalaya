/**
 * Authentication route constants.
 *
 * Every auth path in the application is named once, here, so that a redirect
 * target, a proxy matcher, a robots rule and a link in a form can never drift
 * apart. Nothing outside this module writes an auth URL as a string literal.
 *
 * This module is deliberately free of `server-only`: the proxy, server
 * components, client components and tests all need the same constants, and a
 * path is not a secret.
 */

/** The sign-in page. Every unauthenticated protected request lands here. */
export const LOGIN_PATH = "/auth/login";
export const REGISTER_PATH = "/auth/register";
/** "Check your email" - shown after registration and after a resend. */
export const VERIFY_PATH = "/auth/verify";
export const FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const RESET_PASSWORD_PATH = "/auth/reset-password";
/** The single entry point for every link Supabase puts in an email. */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Where a signed-in user goes when no safe destination was requested.
 *
 * `/account` rather than a dashboard: Phase 06 establishes identity, not a
 * patient experience. The patient portal, the doctor workspace and the
 * receptionist workspace get their own routes in later phases, and each will
 * choose its own landing.
 */
export const AUTHENTICATED_LANDING_PATH = "/account";

/** Where signing out leaves you. The public home page, not a login screen. */
export const SIGN_OUT_LANDING_PATH = "/";

/**
 * Auth pages an already-signed-in user has no business seeing.
 *
 * Visiting one redirects to the authenticated landing (`phase_06.md` §42).
 * `/auth/reset-password` is deliberately absent: a signed-in user reaching it
 * through a recovery link is exactly the supported flow, and `/auth/callback`
 * is absent because it is the mechanism that creates the session.
 */
export const AUTH_ENTRY_PATHS: readonly string[] = [
  LOGIN_PATH,
  REGISTER_PATH,
  FORGOT_PASSWORD_PATH,
];

/**
 * Path prefixes that require an authenticated user.
 *
 * Listed as prefixes, and listed *ahead of the features that will live under
 * them*, so that a later phase adding `/patient/appointments` inherits
 * protection instead of having to remember it. Deny-by-default is cheaper to
 * maintain than a checklist (`docs/SECURITY.md` §2.4).
 *
 * This list drives the proxy's optimistic redirect and the `no-store` response
 * header. It is **not** the security boundary - `requireUser()` on the server
 * is. A path missing from here renders without a session and fails there.
 */
export const PROTECTED_PATH_PREFIXES: readonly string[] = [
  AUTHENTICATED_LANDING_PATH,
  "/patient",
  "/dashboard",
  "/portal",
  "/staff",
  // Phase 10. The front desk. Listed here as well as guarded by
  // `(app)/receptionist/layout.tsx`, so an unauthenticated request is turned
  // round before the route renders rather than after.
  "/receptionist",
  // Phase 11. The practitioner's own workspace. Listed here as well as
  // guarded by `(app)/doctor/layout.tsx`, so an unauthenticated request is
  // turned round before the route renders rather than after.
  "/doctor",
  "/admin",
  // Phase 15. The notification centre. Available to every authenticated user
  // rather than to one role — a notification is addressed to an account — so
  // it is guarded by `(app)/notifications/layout.tsx` with a permission
  // rather than by an entry in `PROTECTED_AREAS`, and listed here so an
  // unauthenticated request is turned round before the route renders.
  "/notifications",
  // Phase 08. The forbidden page is a page a *signed-in* person reads; an
  // unauthenticated visitor should be asked to sign in rather than told they
  // are not allowed something they have not yet identified themselves for.
  "/forbidden",
];

/**
 * Auth routes that are rendered per request rather than prerendered.
 *
 * Phase 19. This list exists for one reason: a nonce-based Content-Security-
 * Policy can only be applied to a route Next.js renders on demand, because the
 * nonce is injected during that render. A statically prerendered page given a
 * nonce policy has scripts that carry no nonce, and is therefore broken.
 *
 * `/auth/register` and `/auth/forgot-password` are deliberately absent: both
 * are static, and both must stay that way unless somebody moves them here in
 * the same change.
 *
 * Every entry declares `export const dynamic = "force-dynamic"` in its own
 * file, so its dynamism is a stated property rather than a side effect of
 * happening to read `searchParams` — which a refactor could remove without
 * anyone noticing that a security header stopped working.
 */
export const DYNAMIC_AUTH_PATHS: readonly string[] = [
  LOGIN_PATH,
  VERIFY_PATH,
  RESET_PASSWORD_PATH,
  AUTH_CALLBACK_PATH,
];

/** True when `pathname` is at or below a protected prefix. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * True when `pathname` may be given a nonce-based policy.
 *
 * The union of "holds patient data" and "handles a credential", which between
 * them are every page where an injected script would have something worth
 * taking. Both halves are dynamically rendered, which is what makes the strict
 * policy possible at all.
 */
export function isStrictCspPath(pathname: string): boolean {
  return isProtectedPath(pathname) || DYNAMIC_AUTH_PATHS.includes(pathname);
}

/** True when `pathname` is an auth page a signed-in user should skip. */
export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.includes(pathname);
}
