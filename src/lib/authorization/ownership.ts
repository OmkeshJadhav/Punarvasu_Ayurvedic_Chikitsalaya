/**
 * Resource-level authorization.
 *
 * ## The gap role checks cannot close
 *
 * Patient A and Patient B both hold `role = "patient"`, so both pass every
 * role and permission check a patient can pass. Nothing in
 * `config/permissions.ts` distinguishes them. What must still be true is that
 * A cannot read, change or delete B's record (`phase_08.md` sections 16-17).
 *
 * That is a question about a *resource*, not about a role, and it needs its
 * own vocabulary. This module is it.
 *
 * ## Three rules for using these
 *
 * 1. **The owner id must come from the record, never from the request.** The
 *    correct shape is: read the row through a query already scoped to the
 *    session, then compare the row's owner to the verified user. A caller that
 *    passes `formData.get("ownerId")` as `ownerId` has authorized nothing - it
 *    has asked the request whether the request is allowed.
 *
 * 2. **This is never the only layer.** Row-level security is what actually
 *    denies the read, and `docs/SECURITY.md` section 2.2 asks for both. These
 *    helpers turn a database that returned nothing into a clear, safe failure
 *    and catch the case where a query was written wrongly.
 *
 * 3. **Prefer making the question unaskable.** The strongest version of this
 *    rule is not a check at all: `features/patients/queries.ts` takes no user
 *    id and has no overload that does, so there is no argument to substitute.
 *    Where that shape is available, use it; these helpers are for the cases -
 *    a record addressed by its own id, which arrives with appointments and
 *    documents - where it is not.
 */

import { forbiddenError } from "@/lib/errors/app-error";

/** The minimum an ownership check needs: a server-verified user id. */
export interface AuthorizedActor {
  readonly id: string;
}

/**
 * Whether the actor owns the resource.
 *
 * A null or empty owner id is **not** ownership. An unowned row - a walk-in
 * patient record that no login has claimed yet, in Phase 07's model - belongs
 * to nobody, and "belongs to nobody" must never read as "belongs to whoever is
 * asking".
 */
export function isResourceOwner(
  actor: AuthorizedActor | null,
  ownerId: string | null | undefined,
): boolean {
  if (!actor || !ownerId) return false;
  return actor.id === ownerId;
}

/**
 * Asserts that the actor owns the resource.
 *
 * Throws a `forbidden` {@link AppError}, whose message is the generic
 * "You don't have access to this." - it never says whether the resource
 * exists, who owns it, or what would have been required
 * (`phase_08.md` sections 12 and 26).
 *
 * Throwing rather than redirecting, because this is the shape a server action
 * or route handler needs; a route guard that should show the forbidden page
 * uses `requireAreaAccess` in `./guards.ts` instead.
 */
export function assertResourceOwner(
  actor: AuthorizedActor | null,
  ownerId: string | null | undefined,
): void {
  if (!isResourceOwner(actor, ownerId)) {
    throw forbiddenError({
      cause: new Error("Resource ownership check failed."),
    });
  }
}

/**
 * Asserts that the actor is **not** acting on their own account.
 *
 * The inverse of an ownership check, and the rule that makes privileged
 * operations safe to hold: `docs/SECURITY.md` section 6 requires that no user
 * can change their own role, *including an admin acting on their own account*.
 *
 * It closes two things at once. An administrator cannot quietly widen their
 * own access, so every privilege increase has a second person's name against
 * it in the audit trail; and an administrator cannot demote themselves and
 * lock the clinic out of its own administration.
 *
 * The database enforces the same rule inside `public.assign_user_role()`. This
 * exists so the refusal reaches the user as a sentence they can act on rather
 * than as a generic failure.
 */
export function assertNotSelf(
  actor: AuthorizedActor | null,
  targetUserId: string,
): void {
  if (actor && actor.id === targetUserId) {
    throw forbiddenError({
      message: "You cannot change your own role.",
      cause: new Error("Self-targeted privileged operation refused."),
    });
  }
}
