/**
 * The access-management domain model.
 *
 * ## Scope
 *
 * Staff *access*, not staff *management*. `phase_08.md` sections 22 and 39
 * rule out building a staff-management product in this phase; what exists here
 * is the minimal authorized mechanism for assigning a role, which is the thing
 * the authorization infrastructure needs in order to be usable and testable at
 * all.
 *
 * ## What a managed user is, and is not
 *
 * Exactly enough to identify a person and see what access they hold. There is
 * deliberately no phone number, no address, no date of birth and no link to a
 * patient record: an administrator managing who may sign in to what is not
 * thereby browsing patient data (`docs/SECURITY.md` section 6, "Admins", and
 * section 42's data minimisation).
 */

import type { AppRole } from "@/types/database";

export interface ManagedUser {
  /** The Supabase auth user id. The only identifier the clinic acts on. */
  readonly id: string;
  /**
   * How the clinic recognises the account. Null only if the account has no
   * address at all, which email/password sign-up cannot produce.
   */
  readonly email: string | null;
  /** The display name given at registration, if any. */
  readonly fullName: string | null;
  /**
   * `null` means no assignment row - a user in the moment between account
   * creation and the trigger committing, or a database missing the migration.
   * It is shown as "No role" rather than silently rendered as "Patient",
   * because a guess about somebody's access is the wrong thing to show on the
   * screen where access is granted.
   */
  readonly role: AppRole | null;
  readonly emailConfirmed: boolean;
  /** ISO 8601. Used only to order and date the list. */
  readonly createdAt: string;
}

/** The result of asking for the managed-user list. */
export type ManagedUserListResult =
  | { readonly status: "ready"; readonly users: readonly ManagedUser[] }
  | { readonly status: "unavailable" };

/**
 * What the role-assignment action hands back to `useActionState`.
 *
 * The same convention as `features/auth/types.ts` and
 * `features/patients/types.ts`, so a third form cannot invent a third shape.
 */
export interface RoleAssignmentFormState {
  readonly status: "idle" | "error" | "success";
  /** Always safe to render. Never database or provider text. */
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export const IDLE_ROLE_ASSIGNMENT_STATE: RoleAssignmentFormState = {
  status: "idle",
};

export function roleAssignmentError(
  message: string,
  fieldErrors?: Readonly<Record<string, string>>,
): RoleAssignmentFormState {
  return {
    status: "error",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

export function roleAssignmentSuccess(
  message: string,
): RoleAssignmentFormState {
  return { status: "success", message };
}
