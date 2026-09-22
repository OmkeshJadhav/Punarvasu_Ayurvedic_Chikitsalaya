/**
 * Same-origin enforcement for state-changing route handlers.
 *
 * ## The gap this closes
 *
 * Next.js protects **Server Actions** against cross-site invocation itself: it
 * compares the `Origin` header with the host and refuses a mismatch. Every
 * mutation in this product that goes through a server action is therefore
 * already covered, which is most of them.
 *
 * **Route handlers get no such protection.** Three exist that accept `POST`,
 * and two of them take `multipart/form-data` — which is one of the three
 * content types a cross-site HTML form can send with *no CORS preflight at
 * all*. A page on another origin can therefore make a signed-in patient's
 * browser post to `/api/patient-documents`, and the browser will attach the
 * session cookies.
 *
 * The only thing standing in the way today is `SameSite=Lax` on the Supabase
 * session cookies, which suppresses them on a cross-site POST.
 * `phase_19.md` section 14 is explicit that this is not enough on its own:
 * SameSite is a browser default that has changed before, is applied
 * inconsistently across engines, and is a property of the *client* rather than
 * a control this application holds. A server-side origin check is a control we
 * hold.
 *
 * ## What is checked, and in what order
 *
 * ```text
 *   Sec-Fetch-Site: same-origin | none   -> accept    (the browser's own verdict)
 *   Sec-Fetch-Site: cross-site | same-site -> reject
 *   no Sec-Fetch-Site, Origin present    -> compare Origin with the host
 *   no Sec-Fetch-Site, no Origin         -> accept
 * ```
 *
 * `Sec-Fetch-Site` is preferred because the browser computes it and a page
 * cannot set it — it is a forbidden header name. `Origin` is the fallback for
 * anything that does not send fetch metadata.
 *
 * `same-site` is rejected alongside `cross-site`: a compromised sibling
 * subdomain is exactly the position from which a cookie-carrying forgery is
 * launched, and nothing in this product legitimately posts across subdomains.
 *
 * ## Why a missing `Origin` is accepted
 *
 * Because rejecting it would break every non-browser caller while stopping no
 * browser attack. A browser **always** sends `Origin` on a cross-origin
 * request and on any `POST` — including a cross-site form post, which is the
 * attack. So "no `Origin` and no fetch metadata" is not a browser in the
 * situation we are defending against; it is `curl`, a scheduler, or a health
 * probe. Those callers authenticate with a bearer secret or a session cookie
 * they had to obtain some other way, and CSRF is not the control that stops
 * them.
 *
 * ## The host comes from the request, and that is safe here
 *
 * Elsewhere in this codebase an origin is read from configuration and never
 * from the request, because a poisoned `Host` header can aim an emailed link
 * at an attacker's domain (`lib/auth/callback-url.ts`). This check is the
 * opposite shape: it compares two values *from the same request* and asks
 * whether they agree. An attacker who could forge the `Host` header to match
 * their own `Origin` would have to be able to set `Origin` to something other
 * than their real origin, which a browser does not permit — and if they are
 * not using a browser, they are not doing CSRF.
 *
 * Using `NEXT_PUBLIC_SITE_URL` instead would be worse in practice: it would
 * refuse every preview deployment and every request through an alternate
 * hostname, and the first person to hit that would relax the check.
 */

/**
 * True when a state-changing request did not come from this origin.
 *
 * Returns `false` — meaning "allow" — whenever the evidence is absent rather
 * than contradictory. See the header for why that is the right default.
 */
export function isCrossOriginRequest(request: {
  readonly headers: Headers;
  readonly url: string;
}): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite) {
    // `none` is a user-initiated navigation — typing the URL, a bookmark.
    // `same-origin` is our own page. Everything else is somebody else's.
    return fetchSite !== "same-origin" && fetchSite !== "none";
  }

  const origin = request.headers.get("origin");
  // A browser omits `Origin` only on a same-origin GET/HEAD, which is not a
  // request this function is asked about.
  if (!origin) return false;

  const expected = requestOrigin(request);
  if (!expected) return false;

  return origin !== expected;
}

/**
 * The origin the request was addressed to.
 *
 * Prefers `X-Forwarded-Host` plus `X-Forwarded-Proto`, because behind a proxy
 * the `Host` on `request.url` is the internal one and would never match the
 * `Origin` the browser sent. Falls back to the URL as received.
 */
function requestOrigin(request: {
  readonly headers: Headers;
  readonly url: string;
}): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (host) {
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      safeProtocol(request.url) ??
      "https";
    return `${protocol}://${host}`;
  }

  return safeOrigin(request.url);
}

function safeProtocol(url: string): string | null {
  try {
    return new URL(url).protocol.replace(":", "");
  } catch {
    return null;
  }
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * HTTP methods that may change state and therefore need the check.
 *
 * `GET` and `HEAD` are absent because this application has no `GET` that
 * mutates — `phase_19.md` section 75 — and adding one would be the defect,
 * not a reason to widen this list.
 */
export const UNSAFE_METHODS: ReadonlySet<string> = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
