"use client";

import { useActionState } from "react";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { AUTH_FIELDS, AUTH_PAGES } from "@/features/auth/content";
import { IDLE_AUTH_FORM_STATE } from "@/features/auth/types";

/**
 * The "forgot your password" form.
 *
 * On success the form is replaced by the confirmation rather than sitting
 * beneath it, for the same reason the contact form does it: a form still on
 * screen after a confirmation invites a second send, and each send spends the
 * account's email rate-limit allowance.
 *
 * The confirmation is deliberately neutral - "if an account exists" - and the
 * action returns it whatever actually happened, including when the mail
 * provider fails. That is the point: a caller must not be able to learn
 * whether an address belongs to a patient of this clinic by watching the
 * response (`docs/SECURITY.md` section 13, `phase_06.md` section 18).
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    IDLE_AUTH_FORM_STATE,
  );

  const copy = AUTH_PAGES.forgotPassword;

  if (state.status === "success") {
    return <AuthFormMessage state={state} title="Check your email" />;
  }

  return (
    <form action={formAction} noValidate>
      <AuthFormMessage state={state} title="We couldn't continue" />

      <div className="flex flex-col gap-5">
        <Field
          name="email"
          label={AUTH_FIELDS.email.label}
          error={state.fieldErrors?.["email"]}
          required
          disabled={pending}
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              inputMode="email"
              autoComplete={AUTH_FIELDS.email.autoComplete}
              defaultValue={state.values?.["email"] ?? ""}
            />
          )}
        </Field>

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
