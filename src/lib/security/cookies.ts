/**
 * Session cookie hardening.
 *
 * ## What `@supabase/ssr` does by default, and why it is not enough here
 *
 * `@supabase/ssr` writes its session cookies with `httpOnly: false`
 * (`node_modules/@supabase/ssr/dist/main/utils/constants.js`). That default is
 * correct *for its own design*: the library expects a browser client to read
 * the session out of the cookie and talk to PostgREST directly, and a cookie
 * JavaScript cannot read is useless for that.
 *
 * **Punarvasu has no browser client.** Verified in Phase 19, and asserted by
 * `tests/security/browser-surface.test.ts`: no client component imports
 * `lib/supabase/browser.ts`, nothing outside the three server modules imports
 * `@supabase/ssr` or `@supabase/supabase-js`, and every database read in the
 * product happens in a server component, a server action or a route handler.
 * The entire application is server-rendered.
 *
 * So the access token and the refresh token are readable by page JavaScript
 * for no reason at all — and "for no reason at all" is the whole of the
 * argument. `docs/SECURITY.md` section 22 and `phase_19.md` sections 12-13 ask
 * for `HttpOnly` where applicable; it is applicable, because nothing needs it
 * off.
 *
 * ## What this buys
 *
 * It removes token theft from the consequences of an XSS. With `HttpOnly`, a
 * script injected into a page can still act *as* the user for as long as it
 * runs, which is bad — but it cannot read the refresh token, copy it out and
 * keep the session alive somewhere else after the tab closes. That is the
 * difference between an incident bounded by a page view and one bounded by the
 * refresh token's 400-day lifetime.
 *
 * It is defence in depth behind the Content-Security-Policy rather than
 * instead of it. Neither is the reason to stop worrying about the other.
 *
 * ## `Secure`
 *
 * Set on every cookie except in development, where the dev server is plain
 * HTTP and `Secure` would mean the browser silently discards the session and
 * sign-in appears to do nothing.
 *
 * ## `SameSite`
 *
 * Left at the library's `Lax` rather than raised to `Strict`. `Strict` would
 * suppress the session cookie on the *first* request after following a link
 * from an email — which is precisely how a patient arrives from an
 * appointment reminder — and they would land signed out on a page that had
 * just told them they were signed in. `Lax` already suppresses the cookie on
 * the cross-site POST that CSRF needs, and Phase 19 added a server-side origin
 * check so that SameSite is not the only thing standing there
 * (`lib/security/same-origin.ts`).
 */

/** The subset of cookie options this module overrides. */
export interface HardenedCookieOptions {
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "lax" | "strict" | "none";
  readonly path: string;
}

/**
 * Applies the hardened attributes over whatever the Supabase client asked for.
 *
 * Deliberately *last* in the spread, so these four attributes cannot be
 * weakened by a library default or by a future option the library adds. Every
 * other option the caller supplied — `maxAge`, `expires`, `domain` — is
 * preserved, because those are the library's to decide and getting them wrong
 * breaks session length rather than session security.
 *
 * @param options Whatever `@supabase/ssr` passed for this cookie.
 * @param isDevelopment `Secure` is dropped only here. See the header.
 */
export function hardenCookieOptions<T extends object>(
  options: T | undefined,
  isDevelopment: boolean,
): T & HardenedCookieOptions {
  return {
    ...(options ?? ({} as T)),
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: "lax",
    // Scoped to the whole site because the session has to be readable by the
    // public pages (for the header's account control) as well as the portal.
    path: "/",
  };
}

/** True when this process is a `next dev` server. */
export function isDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV === "development";
}
