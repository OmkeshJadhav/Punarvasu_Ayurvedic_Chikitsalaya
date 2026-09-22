"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/auth/submit-button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { assignRoleAction } from "@/features/admin/actions";
import { ADMIN_USERS_PAGE } from "@/features/admin/content";
import {
  IDLE_ROLE_ASSIGNMENT_STATE,
  type RoleAssignmentFormState,
} from "@/features/admin/types";
import { APP_ROLES, ROLE_LABELS } from "@/config/permissions";
import type { AppRole } from "@/types/database";

/**
 * The role control on one row of the access table.
 *
 * ## The hidden field is not a security hole, and it is worth saying why
 *
 * `targetUserId` is rendered as a hidden input, so anybody can change it with
 * developer tools before submitting — which is exactly the shape
 * `phase_08.md` section 25 calls out. It is safe because the server treats it
 * as *what to do*, never as *whether it may be done*:
 *
 *   * the acting user is `auth.uid()`, verified with the Auth server;
 *   * that user's role is read from `public.user_roles`;
 *   * the action refuses a target equal to the actor;
 *   * `public.assign_user_role()` repeats all three inside the database.
 *
 * Substituting another user's id gets a patient exactly the same refusal it
 * got before they edited anything. Substituting the *admin's own* id gets
 * "You cannot change your own role."
 *
 * ## Why a client component
 *
 * `useActionState`, for the pending state and the per-row result. It is a leaf:
 * the page, the table and every row around it stay server components.
 *
 * ## Accessibility
 *
 * The `<select>` carries a real label, hidden visually because the row's own
 * person cell already names whose role this is and a visible "Role" label on
 * every row would be repeated noise for a sighted user. It remains in the
 * accessibility tree, and `aria-label` on the form names the row, so a screen
 * reader user hears which person the control belongs to.
 *
 * A native `<select>` rather than the Radix one, for the same reason
 * `phase_07.md` section 70 gives for date inputs: it posts without JavaScript,
 * and on a phone it opens the platform picker.
 */
export function RoleAssignmentForm({
  userId,
  currentRole,
  personLabel,
}: {
  readonly userId: string;
  readonly currentRole: AppRole | null;
  /** Who this row is about. Used only to name the control for assistive tech. */
  readonly personLabel: string;
}) {
  const [state, formAction] = useActionState<RoleAssignmentFormState, FormData>(
    assignRoleAction,
    IDLE_ROLE_ASSIGNMENT_STATE,
  );

  return (
    <form
      action={formAction}
      aria-label={`${ADMIN_USERS_PAGE.formLegend} for ${personLabel}`}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="targetUserId" value={userId} />

      <Field
        name="role"
        label={`${ADMIN_USERS_PAGE.roleFieldLabel} for ${personLabel}`}
        hideLabel
        error={state.fieldErrors?.["role"]}
        className="min-w-44"
      >
        {(control) => (
          <NativeSelect {...control} defaultValue={currentRole ?? ""}>
            {currentRole === null ? (
              <option value="">{ADMIN_USERS_PAGE.noRoleLabel}</option>
            ) : null}
            {APP_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <SubmitButton
        variant="secondary"
        size="sm"
        loadingLabel={ADMIN_USERS_PAGE.savingLabel}
        className="shrink-0"
      >
        {ADMIN_USERS_PAGE.submitLabel}
      </SubmitButton>

      {/*
        The row's own result, announced where the change was made rather than
        at the top of a long table. `role="alert"` for a failure so it
        interrupts; `role="status"` for a confirmation so it waits for a pause.
        Never database text — every message comes from `content.ts`.
      */}
      {state.status !== "idle" && state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-body-sm text-destructive sm:mb-2.5"
              : "text-body-sm text-success sm:mb-2.5"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
