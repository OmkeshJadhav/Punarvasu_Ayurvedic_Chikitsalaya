import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig } from "@/config/env.public";
import {
  AUTHENTICATED_LANDING_PATH,
  isAuthEntryPath,
  isProtectedPath,
  isStrictCspPath,
} from "@/lib/auth/paths";
import { loginPathWithNext } from "@/lib/auth/redirect";
import {
  hardenCookieOptions,
  isDevelopmentRuntime,
} from "@/lib/security/cookies";
import {
  buildBaselineCsp,
  buildStrictCsp,
  createCspNonce,
  supabaseOriginFor,
} from "@/lib/security/csp";

/**
 * Proxy — session refresh and optimistic route gating.
 *
 * In Next.js 16 this file is `proxy.ts`, not `middleware.ts`: the convention
 * was renamed in that release and the old name is deprecated
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 * The behaviour is unchanged.
 *
 * ## The job it actually has to do
 *
 * Supabase access tokens are short-lived. A server component cannot write
 * cookies, so nothing else in the App Router is able to persist a refreshed
 * token - which means that without this file a signed-in patient is quietly
 * signed out an hour into using the site. Refreshing here, where the response
 * is still writable, is what makes sessions survive
 * (`phase_06.md` section 24). This was recorded as a known gap in Phase 01 and
 * is closed by this phase.
 *
 * The refresh happens as a side effect of `getUser()`: it validates the access
 * token with the Auth server and, when it has expired, the SSR client uses the
 * refresh token to obtain a new one and writes it through `setAll`.
 *
 * ## What it is NOT
 *
 * It is not the security boundary. `docs/SECURITY.md` section 2.2 asks for
 * layers, and this is the outermost and weakest of them: it redirects early so
 * a signed-out visitor sees a sign-in page instead of a flash of an empty
 * dashboard. The boundary is `requireUser()` running inside the protected
 * layout, plus row-level security in the database. Next.js's own guidance says
 * the same - proxy checks are optimistic, real checks belong next to the data.
 *
 * That is why this file contains no role check and no database query. It runs
 * on prefetches too, so a query here would be a query per hovered link; and an
 * authorization decision taken this far from the data is one taken without it.
 * Roles are Phase 08's, and they will be resolved server-side, not here.
 *
 * ## Failing open, safely
 *
 * If Supabase is unconfigured or unreachable this function lets the request
 * through rather than locking the site. That is safe *because* it is not the
 * boundary: the protected layout still calls `requireUser()`, which treats an
 * unresolvable session as no session and redirects. The failure mode is a
 * signed-out user reaching a page that immediately sends them to sign in -
 * never a signed-out user reaching protected content.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const protectedPath = isProtectedPath(pathname);
  const isDevelopment = isDevelopmentRuntime();

  // Phase 19. The policy is decided before anything else, because the nonce
  // has to reach Next.js through the *request* headers: Next extracts it from
  // the CSP header it sees during server rendering and stamps it onto every
  // script tag it emits. A nonce decided after the response exists is a nonce
  // no script carries.
  //
  // Only dynamically rendered routes get a nonce, and only they can:
  // everything else is statically prerendered, and a prerendered page has no
  // render pass in which to receive one. That set is the protected paths plus
  // the three auth pages that handle a credential — between them, every page
  // where an injected script would have something worth taking.
  // `lib/security/csp.ts` carries the full reasoning.
  const supabaseOrigin = supabaseOriginFor(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const nonce = isStrictCspPath(pathname) ? createCspNonce() : null;
  const contentSecurityPolicy = nonce
    ? buildStrictCsp(nonce, { supabaseOrigin, isDevelopment })
    : buildBaselineCsp({ supabaseOrigin, isDevelopment });

  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set("content-security-policy", contentSecurityPolicy);
    requestHeaders.set("x-nonce", nonce);
  }

  const nextOptions = { request: { headers: requestHeaders } };

  // The response the Supabase client writes refreshed cookies onto. It has to
  // be created before the client, and any redirect issued later has to copy
  // those cookies across, or the refreshed session is dropped.
  let response = NextResponse.next(nextOptions);

  let isAuthenticated = false;

  try {
    const env = getSupabasePublicConfig();

    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next(nextOptions);
          for (const { name, value, options } of cookiesToSet) {
            // Phase 19. `HttpOnly` and `Secure` are applied over whatever the
            // library asked for, because nothing in this application reads the
            // session from JavaScript. See `lib/security/cookies.ts`.
            response.cookies.set(
              name,
              value,
              hardenCookieOptions(options, isDevelopment),
            );
          }
        },
      },
    });

    // `getUser()` and never `getSession()`. The latter decodes the cookie
    // without verifying it, which on the server means trusting whatever the
    // browser sent.
    const { data } = await supabase.auth.getUser();
    isAuthenticated = data.user !== null;
  } catch {
    // Configuration or network failure. Deliberately silent: this runs on
    // every request including prefetches, so logging here would flood the log
    // with one line per hovered link during an outage. The server layer logs
    // the same failure once, where it matters.
    isAuthenticated = false;
  }

  if (protectedPath && !isAuthenticated) {
    // The intended destination is preserved so signing in returns the user to
    // the page they asked for, rather than dropping them on a landing page and
    // making them navigate again (`phase_06.md` section 41). It is validated
    // by `loginPathWithNext`, even though it came from our own routing table,
    // because `pathname` is ultimately attacker-chosen.
    return withSecurityHeaders(
      withSessionCookies(
        NextResponse.redirect(
          new URL(
            loginPathWithNext(pathname + request.nextUrl.search),
            request.url,
          ),
        ),
        response,
      ),
      contentSecurityPolicy,
      isDevelopment,
    );
  }

  if (isAuthenticated && isAuthEntryPath(pathname)) {
    // Already signed in; a second sign-in form is a confusing dead end
    // (`phase_06.md` section 42). `/auth/reset-password` is deliberately not
    // in this list - arriving there with a session is the recovery flow
    // working correctly.
    return withSecurityHeaders(
      withSessionCookies(
        NextResponse.redirect(new URL(AUTHENTICATED_LANDING_PATH, request.url)),
        response,
      ),
      contentSecurityPolicy,
      isDevelopment,
    );
  }

  if (protectedPath) {
    // Authenticated pages hold one person's data and must not be stored by a
    // shared cache or restored from the back-forward cache after sign-out
    // (`phase_06.md` sections 73-74). The protected layout is dynamic anyway;
    // this is the belt to that layout's braces, and it covers the whole
    // subtree without each page having to remember.
    response.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
  }

  return withSecurityHeaders(response, contentSecurityPolicy, isDevelopment);
}

/**
 * Applies the headers that have to be decided per request.
 *
 * The fixed headers - `nosniff`, `X-Frame-Options`, `Referrer-Policy`,
 * `Permissions-Policy` - stay in `next.config.ts`, where they cover every
 * response including the API routes this proxy's matcher excludes. These two
 * cannot live there: the CSP because it carries a per-request nonce, and HSTS
 * because it must never be sent over plain HTTP.
 *
 * `set` rather than `append`: two `Content-Security-Policy` headers are
 * enforced as the *intersection* of both policies, which is a reliable way to
 * produce a page that works in testing and breaks in production.
 */
function withSecurityHeaders(
  response: NextResponse,
  contentSecurityPolicy: string,
  isDevelopment: boolean,
): NextResponse {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  if (!isDevelopment) {
    // Two years, subdomains included, and no `preload` directive.
    //
    // `preload` is deliberately absent: submitting a domain to the browsers'
    // preload list is effectively irreversible for months, and it commits
    // every present and future subdomain of the clinic's domain to HTTPS -
    // including ones nobody has thought about yet. `phase_19.md` section 82
    // asks for HSTS to be enabled "after verifying deployment compatibility",
    // and the honest position is that this header is safe to send now and the
    // preload commitment is a decision for whoever owns the domain.
    //
    // Sent by the application as well as by the host: a platform-level header
    // is configuration somebody can change without touching the repository,
    // and a health platform should not lose transport security that way.
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains",
    );
  }

  return response;
}

/**
 * Copies refreshed session cookies onto a redirect.
 *
 * Without this, a request that both refreshes its token and redirects would
 * discard the new token, and the user would be refreshed again on the next
 * request — or, once the refresh token rotated, signed out.
 */
function withSessionCookies(
  redirectResponse: NextResponse,
  source: NextResponse,
): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export const config = {
  /**
   * Everything except static assets and image optimization.
   *
   * Auth deliberately runs on all pages rather than only the protected ones:
   * a session that is only refreshed while browsing the portal expires while
   * someone reads the treatments page, and they are signed out on their way
   * back. `/api` is excluded because route handlers authenticate themselves
   * and do not need a cookie refresh performed for them.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml|webmanifest)$).*)",
  ],
};
