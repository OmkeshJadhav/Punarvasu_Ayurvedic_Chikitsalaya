/**
 * Server-side authorization guards.
 *
 * ## Where these sit
 *
 * ```text
 *   src/proxy.ts            optimistic: is there a session at all?
 *        v
 *   (app)/layout.tsx        requireUser()      - authentication boundary
 *        v
 *   area layout / action    this module        - authorization boundary
 *        v
 *   Postgres RLS            the last word
 * ```
 *
 * The proxy performs no role check and no database query, deliberately: it
 * runs on prefetches, so a lookup there would be a lookup per hovered link,
 * and an authorization decision taken that far from the data is one taken
 * without it (`phase_08.md` sections 24 and 31). Everything in this file runs
 * on a trusted server path with the session already verified.
 *
 * None of it replaces row-level security. If every function here were deleted,
 * the database would still refuse a patient another patient's record and still
 * refuse anyone a role assignment (`phase_08.md` section 15).
 *
 * ## Two shapes, because there are two call sites
 *
 * | Guard | Use in | On failure |
 * | --- | --- | --- |
 * | `requireArea*`, `requireRole`, `requirePermission` | a page or layout | redirects to `/forbidden` |
 * | `assertPermission`, `assertRole` | a server action or route handler | throws a `forbidden` `AppError` |
 *
 * A page should navigate, because a person is looking at it and needs
 * somewhere to go. An action should throw, because its caller is code that
 * needs to turn the failure into a safe response. Using the wrong one is not a
 * security problem, but it does produce a redirect in the middle of a form
 * submission, which is a confusing one.
 *
 * ## What a denied user is told
 *
 * Nothing. Not the role they hold, not the role they would have needed, not
 * the permission, not the policy (`phase_08.md` section 12 and example 6). The
 * page says they do not have permission and offers a way back. The specifics
 * go to the server log, where they are diagnosable and not disclosable.
 */

import { redirect } from "next/navigation";
import "server-only";

import type { Permission } from "@/config/permissions";
import { getCurrentUser, requireUser } from "@/lib/auth/current-user";
import type { CurrentUser } from "@/lib/auth/current-user";
import { forbiddenError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import type { AppRole } from "@/types/database";

import { recordAuthorizationDenied } from "@/lib/security/audit";

import { can, hasAnyRole, hasRole } from "./policy";
import { FORBIDDEN_PATH, type ProtectedArea } from "./routes";

/**
 * Records a refusal.
 *
 * The user id is opaque and is what makes a real attack investigable; the
 * permission is an application constant, not user input. No email address, no
 * name and no patient field is logged (`phase_08.md` section 26).
 *
 * `authz.denied` is deliberately one event name with a `reason`, so that
 * "how often is anyone refused anything?" is one query rather than a guess at
 * which event names exist.
 */
async function logDenial(
  userId: string,
  reason: string,
  detail: Readonly<Record<string, string>> = {},
): Promise<void> {
  logger.warn("authz.denied", { userId, reason, ...detail });

  // Phase 19. Also to the queryable audit trail. The structured log is where
  // an operator reads one refusal; the trail is what makes "has this account
  // been refused forty times in a minute?" a query rather than a grep, which
  // is the abuse indicator `phase_19.md` sections 156-157 ask to be watchable
  // without building behavioural profiling.
  //
  // `route` rather than a resource type, and no resource id: a guard refuses
  // before a resource is resolved, so there is genuinely nothing to name. The
  // reason and the permission stay out of the trail as well — they are in the
  // log, and `phase_19.md` section 193 says not to spread authorization
  // internals around.
  //
  // Awaited before the caller redirects or throws, because `redirect()` throws
  // and anything left dangling after it would be abandoned.
  await recordAuthorizationDenied();
}

/**
 * The signed-in user, if they hold the permission; otherwise a redirect to the
 * forbidden page.
 *
 * Redirects to sign in first when there is no session, so an expired session
 * on a protected page reads as "sign in again" rather than as "you are not
 * allowed here".
 */
export async function requirePermission(
  permission: Permission,
  intendedPath?: string,
): Promise<CurrentUser> {
  const user = await requireUser(intendedPath);

  if (!can(user.role, permission)) {
    await logDenial(user.id, "permission", { permission });
    redirect(FORBIDDEN_PATH);
  }

  return user;
}

/**
 * The signed-in user, if they hold the role; otherwise a redirect.
 *
 * Prefer {@link requirePermission}. A role check answers "are you this kind of
 * person", which is the right question only when the capability genuinely is
 * membership; everything else is more durable expressed as a permission, so
 * that moving a capability between roles is an edit to
 * `config/permissions.ts`.
 */
export async function requireRole(
  role: AppRole,
  intendedPath?: string,
): Promise<CurrentUser> {
  const user = await requireUser(intendedPath);

  if (!hasRole(user.role, role)) {
    await logDenial(user.id, "role");
    redirect(FORBIDDEN_PATH);
  }

  return user;
}

/** The signed-in user, if they hold any of these roles; otherwise a redirect. */
export async function requireAnyRole(
  roles: readonly AppRole[],
  intendedPath?: string,
): Promise<CurrentUser> {
  const user = await requireUser(intendedPath);

  if (!hasAnyRole(user.role, roles)) {
    await logDenial(user.id, "role");
    redirect(FORBIDDEN_PATH);
  }

  return user;
}

/**
 * The guard an area's layout uses.
 *
 * Takes the area rather than a bare permission, so the requirement enforced
 * here is literally the entry in `./routes.ts` that navigation reads. A link
 * cannot be offered to a role the guard will turn away, and - the failure that
 * actually matters - an area cannot be given a navigation entry while nobody
 * remembers to guard it.
 */
export async function requireAreaAccess(
  area: ProtectedArea,
): Promise<CurrentUser> {
  return requirePermission(area.permission, area.path);
}

/**
 * Asserts the caller holds the permission, for a server action or route
 * handler.
 *
 * Throws `unauthorized` with no session and `forbidden` without the
 * permission. Both carry the generic user-facing copy from
 * `lib/errors/app-error.ts`; the reason travels in `cause`, which is logged
 * and never serialized.
 */
export async function assertPermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    // Not a `forbidden`: the correct remedy is to sign in again, and saying so
    // beats a refusal the user would retry forever.
    throw forbiddenError({
      message: "Please sign in again to continue.",
      cause: new Error("No session for a privileged operation."),
    });
  }

  if (!can(user.role, permission)) {
    await logDenial(user.id, "permission", { permission });
    throw forbiddenError({
      cause: new Error(`Missing permission: ${permission}`),
    });
  }

  return user;
}

/**
 * Asserts the caller holds the role, for a server action or route handler.
 *
 * As with {@link requireRole}, prefer the permission form.
 */
export async function assertRole(role: AppRole): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw forbiddenError({
      message: "Please sign in again to continue.",
      cause: new Error("No session for a privileged operation."),
    });
  }

  if (!hasRole(user.role, role)) {
    await logDenial(user.id, "role");
    throw forbiddenError({ cause: new Error("Role check failed.") });
  }

  return user;
}

/**
 * Whether the signed-in user holds a permission, without denying anything.
 *
 * For *presentation only* - deciding whether to render a link or a button.
 * Every action behind such a control performs its own check, because hiding a
 * control is a usability decision and hiding it is not what stops anybody
 * (`phase_08.md` section 10, layer 1).
 */
export async function currentUserCan(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return can(user?.role ?? null, permission);
}
