/**
 * The authorization decision, as a pure function.
 *
 * Every question of the form "may a user with this role do this?" is answered
 * here and nowhere else. Separating the decision from the enforcement means
 * the decision can be exhaustively tested without a session, a database or a
 * request - and that the enforcement layers in `./guards.ts` are thin enough
 * to read in one sitting.
 *
 * ## The one rule that matters
 *
 * These functions take a **role**, and the only legitimate source of that role
 * is `getCurrentUser()`, which reads it from the database keyed on a
 * server-verified user id. Passing a role that came from a request body, a
 * header, a query parameter, a cookie the application wrote, or anything in
 * browser storage defeats the entire model (`docs/SECURITY.md` section 6,
 * "Critical rules"). Nothing here can detect that, so nothing here should be
 * treated as a defence against it - the defence is that there is exactly one
 * function in the codebase that produces a role, and it queries Postgres.
 *
 * ## `null` is a role state, not an error
 *
 * `getCurrentUser().role` is `AppRole | null`, where `null` means "identity
 * known, role not resolvable" - a missing assignment row, or a database that
 * could not be reached. Every function here treats `null` as holding no
 * permissions, so an unresolvable role denies rather than grants
 * (`docs/SECURITY.md` section 2.5, fail securely). It is never defaulted to
 * `patient`: an authorization decision taken against a guessed role is a
 * guessed authorization decision.
 */

import { PERMISSIONS_BY_ROLE, type Permission } from "@/config/permissions";
import type { AppRole } from "@/types/database";

/**
 * The permissions a role holds. Empty for an unresolvable role.
 *
 * The lookup falls back to an empty list rather than trusting the index, so a
 * role value that is not in the model holds nothing. TypeScript says that
 * cannot happen and the database enum agrees, but the value has travelled
 * through a network client and a hand-maintained generated type to get here -
 * and the failure mode of the optimistic version is an exception inside an
 * authorization check, which is a worse outcome than a denial.
 */
export function permissionsForRole(
  role: AppRole | null,
): readonly Permission[] {
  if (!role) return [];
  return PERMISSIONS_BY_ROLE[role] ?? [];
}

/**
 * Whether a role may perform a capability.
 *
 * The predicate the whole application is built on. Prefer it to comparing
 * roles: a capability that moves between roles then moves in
 * `config/permissions.ts` alone.
 */
export function can(role: AppRole | null, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

/** Whether a role may perform every one of these capabilities. */
export function canAll(
  role: AppRole | null,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => can(role, permission));
}

/** Whether a role may perform at least one of these capabilities. */
export function canAny(
  role: AppRole | null,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => can(role, permission));
}

/**
 * Whether the user holds exactly this role.
 *
 * Deliberately the less-used sibling of {@link can}. Reach for it only when
 * the capability genuinely *is* "being that kind of person" - navigation that
 * belongs to a workspace, say - rather than when a permission would say the
 * same thing more durably.
 */
export function hasRole(role: AppRole | null, expected: AppRole): boolean {
  return role === expected;
}

/** Whether the user holds any of these roles. */
export function hasAnyRole(
  role: AppRole | null,
  expected: readonly AppRole[],
): boolean {
  return role !== null && expected.includes(role);
}
