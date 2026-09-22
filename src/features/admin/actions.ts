"use server";

/**
 * Role assignment — the one privileged write this phase introduces.
 *
 * ## The sequence
 *
 *   1. Authorize the **actor** from the verified session and the database.
 *   2. Parse the form. Reject anything that is not a UUID and one of four
 *      roles.
 *   3. Refuse a self-targeted change, whoever is asking.
 *   4. Call `public.assign_user_role()`, which performs 1, 3 and 4 again in
 *      the database and writes the audit row.
 *
 * Steps 1 and 3 are repeated on purpose. The database copy is the one that
 * actually holds - it is enforced whatever calls it, including a future route
 * handler that forgets, a `psql` session, or anything holding the anon key.
 * The copy here exists so that a refusal reaches the person as a sentence
 * about what they tried to do, rather than as a generic failure they cannot
 * act on.
 *
 * ## Why the request body is safe to read
 *
 * `targetUserId` and `role` both come from the browser, which is exactly the
 * payload `phase_08.md` section 25 warns about:
 * `{ "userId": "victim", "role": "admin" }`. They are safe to accept because
 * **neither is consulted for authority**. The actor is `auth.uid()`; the
 * actor's role is read from `public.user_roles`; `role` is constrained by a
 * database enum; and a target that is not an account is refused. The body says
 * what to do. Three independent layers decide whether.
 *
 * A patient submitting this form gets a `forbidden` at step 1, and - had that
 * check been deleted - a `42501` from the database at step 4.
 *
 * ## What is logged
 *
 * The actor id, the target id and the new role. All three are needed to
 * investigate a real privilege escalation, and none of them is patient
 * information: they are opaque identifiers and an application constant. No
 * email address and no name is logged, from either account.
 */

import { revalidatePath } from "next/cache";

import { ADMIN_USERS_PAGE } from "./content";
import {
  roleAssignmentError,
  roleAssignmentSuccess,
  type RoleAssignmentFormState,
} from "./types";
import { roleAssignmentSchema } from "./validation";

import { assertPermission } from "@/lib/authorization/guards";
import { assertNotSelf } from "@/lib/authorization/ownership";
import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_USERS_PATH = "/admin/users";

/**
 * SQLSTATEs the database function raises, mapped to copy the user can act on.
 *
 * Mapped by code rather than by message text: a message is provider output and
 * could change, and matching on it would eventually put database text in front
 * of a user. The message itself is discarded.
 */
const FORBIDDEN_SQLSTATE = "42501"; // insufficient_privilege
const NO_DATA_SQLSTATE = "P0002"; // no_data_found

/**
 * The fields this form defines.
 *
 * Read by name rather than by iterating `FormData`, so a field the form does
 * not define is never read at all. That is the first and, for a form
 * submission, the decisive gate of the allowlist; `roleAssignmentSchema`'s
 * `strict()` is the second, and covers objects assembled in code rather than
 * posted from this form.
 */
const ROLE_FORM_FIELDS = ["targetUserId", "role"] as const;

function readRoleForm(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const name of ROLE_FORM_FIELDS) {
    const value = formData.get(name);
    values[name] = typeof value === "string" ? value : "";
  }

  return values;
}

/**
 * Assigns an application role to another user.
 *
 * @returns a form state. It never throws at the caller: an authorization
 *          failure becomes an error state with safe copy, because a server
 *          action that throws in a form submission produces a generic error
 *          boundary rather than a message beside the control.
 */
export async function assignRoleAction(
  _previousState: RoleAssignmentFormState,
  formData: FormData,
): Promise<RoleAssignmentFormState> {
  let actorId: string;

  try {
    // Step 1. Reads the caller's role from the database, keyed on the
    // server-verified user id. Nothing from the form participates.
    const actor = await assertPermission("roles.manage");
    actorId = actor.id;

    // Step 2.
    const parsed = roleAssignmentSchema.safeParse(readRoleForm(formData));
    if (!parsed.success) {
      logger.warn("admin.role_assignment_invalid", { userId: actorId });
      return roleAssignmentError(ADMIN_USERS_PAGE.validationErrorMessage);
    }

    // Step 3. `docs/SECURITY.md` section 6: no user changes their own role,
    // including an admin acting on their own account.
    assertNotSelf(actor, parsed.data.targetUserId);

    // Step 4.
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("assign_user_role", {
      target_user_id: parsed.data.targetUserId,
      new_role: parsed.data.role,
    });

    if (error) {
      return describeAssignmentFailure(
        error,
        actorId,
        parsed.data.targetUserId,
      );
    }

    // The actor, the target and the new role — the record an investigation
    // needs. The authoritative trail is the `role_assignment_events` row the
    // database function wrote; this line is its operational echo.
    logger.info("admin.role_assigned", {
      userId: actorId,
      targetUserId: parsed.data.targetUserId,
      role: parsed.data.role,
    });
  } catch (error) {
    return describeThrownFailure(error);
  }

  // The list is read on the server and shows the role that just changed.
  revalidatePath(ADMIN_USERS_PATH);

  return roleAssignmentSuccess(ADMIN_USERS_PAGE.successMessage);
}

/**
 * Turns a database refusal into copy, by SQLSTATE.
 *
 * The provider's message never reaches the user. It travels into the log,
 * where the structured logger's redaction is the safety net and the code is
 * what an operator actually reads.
 */
function describeAssignmentFailure(
  error: { code?: string; message?: string },
  actorId: string,
  targetUserId: string,
): RoleAssignmentFormState {
  if (error.code === FORBIDDEN_SQLSTATE) {
    // Reaching here means the application check above passed and the database
    // check did not — a genuine disagreement between the two layers, or a
    // self-targeted change that slipped past step 3. Either is worth an error
    // rather than a warning.
    logger.error("admin.role_assignment_denied_by_database", error, {
      userId: actorId,
      targetUserId,
    });
    return roleAssignmentError(ADMIN_USERS_PAGE.permissionErrorMessage);
  }

  if (error.code === NO_DATA_SQLSTATE) {
    logger.warn("admin.role_assignment_unknown_target", { userId: actorId });
    return roleAssignmentError(ADMIN_USERS_PAGE.unknownUserMessage);
  }

  logger.error("admin.role_assignment_failed", error, {
    userId: actorId,
    targetUserId,
  });
  return roleAssignmentError(ADMIN_USERS_PAGE.saveErrorMessage);
}

/**
 * Turns a thrown failure into copy.
 *
 * `AppError` messages are written to be shown; anything else is an unexpected
 * throw whose text must not be, so it is replaced wholesale.
 */
function describeThrownFailure(error: unknown): RoleAssignmentFormState {
  if (AppError.isAppError(error)) {
    return roleAssignmentError(error.message);
  }

  logger.error("admin.role_assignment_error", error);
  return roleAssignmentError(ADMIN_USERS_PAGE.saveErrorMessage);
}
