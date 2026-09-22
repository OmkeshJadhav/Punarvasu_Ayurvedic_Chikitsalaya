/**
 * Building the URLs Supabase puts into authentication emails.
 *
 * ## Why the request's Host header is never used
 *
 * The obvious way to make verification links work across localhost, preview
 * deployments and production is to read the origin off the incoming request.
 * It is also a known vulnerability: `Host` and `X-Forwarded-Host` are supplied
 * by the client, so an attacker who sends
 *
 *     POST /auth/forgot-password    Host: attacker.example
 *
 * for someone else's address causes the clinic's own mail server to send that
 * person a genuine-looking reset email pointing at the attacker's domain. If
 * they click it, the recovery token goes with them. This is host header
 * injection, and password reset is its classic target.
 *
 * So the origin comes from configuration - `NEXT_PUBLIC_SITE_URL`, validated
 * in `config/env.public.ts` - and from nowhere else. That variable is set per
 * deployment, which is what makes preview environments work
 * (`phase_06.md` section 91) without trusting anything a caller sends.
 *
 * Supabase enforces the same boundary from its side: a redirect target must
 * match the project's Site URL or one of its configured redirect URLs, so a
 * misconfiguration here fails closed rather than delivering a link somewhere
 * unexpected.
 */
import "server-only";

import { getSiteConfig } from "@/config/env.public";

import { AUTH_CALLBACK_PATH } from "./paths";
import { NEXT_PARAM, safeRedirectPath } from "./redirect";

/** The configured origin, with any trailing slash removed. */
export function getSiteOrigin(): string {
  return getSiteConfig().siteUrl.replace(/\/+$/, "");
}

/**
 * The absolute callback URL to hand to Supabase.
 *
 * `next` is validated by {@link safeRedirectPath} before it is attached, so a
 * hostile destination cannot ride into the email on the one parameter the
 * callback later reads back out. Validating at both ends is deliberate: the
 * callback cannot assume a link was built by this function.
 *
 * @param next Where to send the user once the link has been exchanged for a
 *             session. Omit for the default authenticated landing.
 */
export function buildAuthCallbackUrl(next?: string): string {
  const url = new URL(`${getSiteOrigin()}${AUTH_CALLBACK_PATH}`);

  if (next !== undefined) {
    const safe = safeRedirectPath(next, "");
    if (safe !== "") url.searchParams.set(NEXT_PARAM, safe);
  }

  return url.toString();
}
