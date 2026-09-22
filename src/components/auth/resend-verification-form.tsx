"use client";

import { useActionState } from "react";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resendVerificationAction } from "@/features/auth/actions";
import { AUTH_FIELDS, AUTH_PAGES } from "@/features/auth/content";
import { IDLE_AUTH_FORM_STATE } from "@/features/auth/types";

/**
 * Resend the verification email.
 *
 * `defaultEmail` comes from the server, read out of the short-lived
 * `httpOnly` cookie the registration action wrote - never from a query
 * parameter, because an email address in a URL ends up in access logs, browser
 * history and `Referer` headers (`features/auth/pending-email.ts`).
 *
 * The field stays editable even when it is prefilled: someone who mistyped
 * their address at registration arrives here needing to correct it, and a
 * read-only field would leave them stuck with no way forward but to register
 * again.
 *
 * Repeat requests are limited by Supabase (`phase_06.md` sections 48-49); this
 * form's contribution is to disable the button for the duration of a request
 * so a double-click does not spend two of the allowance. The response is
 * neutral either way, so a rate-limited attempt looks the same as a sent one.
 */
export function ResendVerificationForm({
  defaultEmail,
}: {
  readonly defaultEmail?: string;
}) {
  const [state, formAction, pending] = useActionState(
    resendVerificationAction,
    IDLE_AUTH_FORM_STATE,
  );

  const copy = AUTH_PAGES.verify;

  if (state.status === "success") {
    return <AuthFormMessage state={state} title="Verification email sent" />;
  }

  return (
    <form action={formAction} noValidate>
      <AuthFormMessage state={state} title="We couldn't send that" />

      <div className="flex flex-col gap-4">
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
              defaultValue={state.values?.["email"] ?? defaultEmail ?? ""}
            />
          )}
        </Field>

        <Button
          type="submit"
          variant="secondary"
          block
          loading={pending}
          loadingLabel={copy.resendingLabel}
        >
          {copy.resendLabel}
        </Button>
      </div>
    </form>
  );
}
