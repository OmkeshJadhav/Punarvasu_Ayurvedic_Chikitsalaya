/**
 * Carrying the just-registered address to the "check your email" page.
 *
 * ## Why not a query parameter
 *
 * The obvious implementation is `redirect("/auth/verify?email=" + email)`, and
 * it is the wrong one. An email address is confidential data
 * (`docs/SECURITY.md` section 4), and section 14 says not to put it in a URL:
 * a URL is written to the access log of every proxy in front of the
 * application, kept in browser history on what may be a shared computer, and
 * sent as a `Referer` to anything the page links to. `phase_06.md` section 75
 * repeats the rule for authentication data specifically.
 *
 * ## What this does instead
 *
 * A short-lived, `httpOnly` cookie written by the server action and read by the
 * verify page's server component. It never reaches client JavaScript, never
 * appears in a URL, and expires on its own if the page is never opened.
 *
 * It is a display convenience and nothing more. Nothing decides anything on
 * the strength of it: the resend action re-validates whatever address it is
 * given and, like every other resend, answers the same way regardless.
 */
import { cookies } from "next/headers";
import "server-only";

import { getServerEnv } from "@/config/env.server";
import { emailSchema } from "@/lib/validation/schemas";

const COOKIE_NAME = "pv_pending_email";

/**
 * Long enough to survive reading an email on a phone and coming back, short
 * enough that an address does not linger on a shared machine.
 */
const COOKIE_MAX_AGE_SECONDS = 15 * 60;

/** Scoped to the auth routes: no other part of the site has any use for it. */
const COOKIE_PATH = "/auth";

export async function setPendingVerificationEmail(
  email: string,
): Promise<void> {
  const store = await cookies();

  store.set(COOKIE_NAME, email, {
    httpOnly: true,
    sameSite: "lax",
    // Secure everywhere but local development, where there is no HTTPS and a
    // secure cookie would simply never be stored.
    secure: getServerEnv().appEnv !== "development",
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * The pending address, if one was set and is still valid.
 *
 * Re-validated on read rather than trusted. The cookie is `httpOnly`, but it
 * still arrives from the browser, and a value read from a request is parsed
 * before it is used - including one this application wrote
 * (`docs/SECURITY.md` section 2.3).
 */
export async function readPendingVerificationEmail(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;

  const parsed = emailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Clears the cookie once it has served its purpose. */
export async function clearPendingVerificationEmail(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_NAME, path: COOKIE_PATH });
}
