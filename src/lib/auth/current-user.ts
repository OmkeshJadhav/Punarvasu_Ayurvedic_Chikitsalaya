/**
 * The authenticated user, resolved on the server.
 *
 * ## The one place identity comes from
 *
 * `docs/implementation-plan/phase_06.md` sections 25 and 28 ask for a single
 * reliable way to obtain the current user rather than authentication logic
 * scattered across server components. This is it. Nothing else in the
 * application calls `supabase.auth` to find out who is signed in.
 *
 * ## Why `getUser()` and never `getSession()`
 *
 * `getSession()` reads and decodes the session cookie. On the server that
 * cookie is attacker-supplied data like any other request header - a forged or
 * replayed one produces a confident, wrong answer. `getUser()` sends the
 * access token to the Supabase Auth server, which verifies its signature and
 * returns the authoritative user. Everything downstream - row-level security,
 * ownership checks, the role lookup below - rests on that call, so the extra
 * round trip is the price of the guarantee, not an inefficiency to optimise
 * away.
 *
 * ## Why the role is read from the database
 *
 * The role is never taken from user metadata, a JWT claim the client can
 * influence, a request header or client state (`docs/SECURITY.md` section 6,
 * "Critical rules"). It is selected from `public.user_roles`, keyed on the
 * verified user id, under row-level security.
 *
 * Phase 06 exposed the role and authorized nothing on the basis of it. Phase
 * 08 is what consumes it: `lib/authorization/` turns the role into
 * permissions, guards and route rules. Identity did not have to be re-plumbed
 * to get there, which was the point of exposing it early.
 *
 * Phase 08 also moved the role from `public.profiles` to `public.user_roles`,
 * so that a second role becomes possible without a schema redesign. This
 * function is the only place in the application that reads it, so that move
 * was a one-query change.
 *
 * ## What callers receive
 *
 * A deliberately narrow view of the user, not the Supabase user object. The
 * provider's object carries app metadata, identity provider records, raw user
 * metadata and token-adjacent fields, none of which a page needs and some of
 * which should never reach a client component through props.
 */
import { redirect } from "next/navigation";
import { cache } from "react";
import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logging/logger";
import type { AppRole } from "@/types/database";

import { loginPathWithNext } from "./redirect";

/**
 * The identity a server component, server action or route handler may rely on.
 *
 * Every field here is derived from a server-verified session. None of it comes
 * from the request body, the query string or client state.
 */
export interface CurrentUser {
  /** The Supabase auth user id. The only trustworthy user identifier. */
  readonly id: string;
  /** Present for every email/password account. */
  readonly email: string | null;
  /**
   * Whether the address has been confirmed.
   *
   * Surfaced rather than enforced here. A phase that gates a capability on a
   * verified address checks this at that capability, so the rule lives with
   * the thing it protects.
   */
  readonly emailVerified: boolean;
  /**
   * The role from `public.user_roles`, or `null` when no assignment row could
   * be read.
   *
   * `null` means "identity known, role not resolvable" - a missing assignment
   * row, or a database that has not had the migration applied. It is
   * deliberately not defaulted to `patient`: an authorization decision made
   * against a guessed role is a guessed authorization decision. Every check in
   * `lib/authorization/` treats `null` as holding no permissions, which fails
   * closed.
   */
  readonly role: AppRole | null;
  /**
   * A name for greeting the user inside an authenticated experience. Never
   * rendered in public chrome (`phase_06.md` section 39).
   */
  readonly displayName: string | null;
}

/**
 * The current user, or `null` when nobody is signed in.
 *
 * Memoised per render pass with React's `cache`, so a layout and the page
 * inside it share one verification round trip instead of making two. The cache
 * is per request; it never carries a user across requests.
 *
 * Returns `null` rather than throwing when Supabase is unreachable or
 * unconfigured. That is the fail-closed direction: an unresolvable session is
 * treated as no session, so a protected route denies access instead of
 * rendering. The failure is logged.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  let userId: string;
  let email: string | null;
  let emailVerified: boolean;
  let metadataName: string | null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    // An absent session is the ordinary case for a signed-out visitor, not an
    // error worth logging on every public request.
    if (error || !data.user) return null;

    userId = data.user.id;
    email = data.user.email ?? null;
    emailVerified = Boolean(data.user.email_confirmed_at);
    metadataName = readFullName(data.user.user_metadata);
  } catch (error) {
    // Some of what reaches here is not a failure at all - see below.
    rethrowFrameworkSignal(error);

    // Configuration or network failure. Never the user's problem to read, and
    // never a reason to treat the request as authenticated.
    logger.error("auth.current_user_unavailable", error);
    return null;
  }

  return {
    id: userId,
    email,
    emailVerified,
    role: await resolveRole(userId),
    displayName: metadataName,
  };
});

/**
 * Re-throws a Next.js control-flow signal instead of treating it as an error.
 *
 * Next.js communicates three things by throwing: `redirect()`, `notFound()`,
 * and - the one that matters here - the dynamic-usage signal raised when
 * `cookies()` is read while the framework is attempting to prerender a route.
 * That signal is how a route gets marked dynamic. A blanket `catch` around a
 * session read swallows it, and the route can then be prerendered as though
 * nobody were signed in, which is a cached page of one visitor's state served
 * to the next (`phase_06.md` section 74).
 *
 * This was not theoretical: the first build of this phase logged
 * `auth.current_user_unavailable` while prerendering `/auth/reset-password`,
 * which was this exact signal being caught and reported as an outage.
 *
 * Signals are identified by their `digest`, which is the contract Next.js
 * documents for distinguishing them from application errors.
 */
function rethrowFrameworkSignal(error: unknown): void {
  if (typeof error !== "object" || error === null) return;

  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return;

  if (
    digest === "NEXT_NOT_FOUND" ||
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("DYNAMIC_SERVER_USAGE") ||
    digest.startsWith("BAILOUT_TO_CLIENT_SIDE_RENDERING") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  ) {
    throw error;
  }
}

/**
 * The signed-in user, or a redirect to sign in.
 *
 * The protected-route primitive (`phase_06.md` section 29). It redirects
 * *before* returning, so a protected page never renders its content and then
 * navigates away - the data is never put into a response at all.
 *
 * ```tsx
 * export default async function AccountPage() {
 *   const user = await requireUser("/account");
 *   return <AccountSummary user={user} />;
 * }
 * ```
 *
 * @param intendedPath Where to return the user after signing in. Validated by
 *                     {@link safeRedirectPath} before it reaches a URL, so a
 *                     caller cannot create an open redirect by passing
 *                     something it read off the request.
 */
export async function requireUser(intendedPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;

  // `redirect` is typed `never`: it throws a control-flow signal that Next.js
  // catches, so nothing after this line runs and no protected content is
  // rendered first.
  redirect(loginPathWithNext(intendedPath));
}

/**
 * Reads the caller's role from `public.user_roles`.
 *
 * The query is made with the user-scoped client, so row-level security
 * applies: the `user_roles_select_own` policy means the only row a
 * non-administrator can return is their own. The `.eq()` filter is the belt to
 * that policy's braces - a policy mistake would then produce no row rather
 * than somebody else's.
 *
 * `maybeSingle()` rather than `single()` because "no assignment row" is a
 * state, not an exception: it is what a user has between account creation and
 * the trigger committing, and what they have if the migration has not been
 * applied. A failure of any kind - missing row, unapplied migration, policy
 * denial, outage - yields `null`, which denies rather than grants.
 *
 * `limit(1)` is redundant today, because `user_roles_single_role_per_user`
 * makes more than one row impossible. It is here because the day that index is
 * dropped to allow a second role, `maybeSingle()` would start erroring on
 * exactly the users who hold two - and an authorization lookup that fails for
 * the most privileged accounts first is the worst possible failure mode. The
 * shape of this function is what changes then; the rest of the application is
 * already written against `AppRole | null`.
 */
async function resolveRole(userId: string): Promise<AppRole | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      // The user id is an opaque identifier, not patient content, and it is
      // what makes this diagnosable. No profile field is logged.
      logger.warn("auth.role_lookup_failed", { userId });
      return null;
    }

    return data?.role ?? null;
  } catch (error) {
    rethrowFrameworkSignal(error);
    logger.error("auth.role_lookup_error", error, { userId });
    return null;
  }
}

/**
 * The name the user gave at registration.
 *
 * It lives in Supabase user metadata, which is client-writable, so it is
 * treated as display text and nothing else: it is never an identifier, never
 * an authorization input, and is length-bounded before being rendered.
 */
function readFullName(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const value = metadata?.["full_name"];
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}
