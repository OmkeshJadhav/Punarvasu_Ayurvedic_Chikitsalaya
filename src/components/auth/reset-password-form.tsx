"use client";

import Link from "next/link";
import { useActionState } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { updatePasswordAction } from "@/features/auth/actions";
import { AUTH_FIELDS, AUTH_PAGES } from "@/features/auth/content";
import { IDLE_AUTH_FORM_STATE } from "@/features/auth/types";
import { PASSWORD_MAX_LENGTH } from "@/features/auth/limits";
import { AUTHENTICATED_LANDING_PATH } from "@/lib/auth/paths";

/**
 * The "choose a new password" form.
 *
 * It is rendered only when the page has already confirmed, server-side, that a
 * recovery session exists. There is no user id, email or token in this form:
 * the action changes the password of whoever the verified session identifies,
 * so there is nothing here for a caller to substitute
 * (`phase_06.md` sections 35-36).
 *
 * On success the form is replaced by a confirmation that says other devices
 * have been signed out, because that is a consequence the user should know
 * about rather than discover later on their phone.
 */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    IDLE_AUTH_FORM_STATE,
  );

  const copy = AUTH_PAGES.resetPassword;

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-6">
        <Alert tone="success" title={copy.successHeading}>
          {state.message}
        </Alert>
        <Button asChild size="lg" block>
          <Link href={AUTHENTICATED_LANDING_PATH}>{copy.continueLabel}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate>
      {state.status === "error" && state.message ? (
        <Alert
          tone="danger"
          title="We couldn't change your password"
          className="mb-6"
        >
          {state.message}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-5">
        <PasswordField
          name="password"
          label="New password"
          description={AUTH_FIELDS.password.description}
          autoComplete="new-password"
          error={state.fieldErrors?.["password"]}
          maxLength={PASSWORD_MAX_LENGTH}
          disabled={pending}
          autoFocus
        />

        <PasswordField
          name="confirmPassword"
          label={AUTH_FIELDS.confirmPassword.label}
          autoComplete="new-password"
          error={state.fieldErrors?.["confirmPassword"]}
          maxLength={PASSWORD_MAX_LENGTH}
          disabled={pending}
        />

        <Button
          type="submit"
          size="lg"
          block
          loading={pending}
          loadingLabel={copy.submittingLabel}
        >
          {copy.submitLabel}
        </Button>
      </div>
    </form>
  );
}
