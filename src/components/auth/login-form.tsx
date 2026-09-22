"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/features/auth/actions";
import { AUTH_FIELDS, AUTH_PAGES } from "@/features/auth/content";
import { IDLE_AUTH_FORM_STATE } from "@/features/auth/types";
import { FORGOT_PASSWORD_PATH, REGISTER_PATH } from "@/lib/auth/paths";
import { NEXT_PARAM } from "@/lib/auth/redirect";

/**
 * The sign-in form.
 *
 * `useActionState` drives it: the browser posts the form to a server action,
 * so the password never enters client JavaScript and there is no `fetch` here
 * to get wrong. `pending` comes from the same hook, which is why the loading
 * state cannot fall out of step with the request
 * (`phase_06.md` sections 43 and 59).
 *
 * Duplicate submission is prevented by `Button`'s `loading`, which disables
 * the control and sets `aria-busy` for the whole submission. That matters here
 * beyond tidiness: repeated sign-in attempts consume Supabase's rate-limit
 * allowance, and an impatient double-click should not cost the user their next
 * attempt (`phase_06.md` section 49).
 *
 * `next` rides along in a hidden field. It is validated in the action, not
 * trusted because this component rendered it - a hidden field is browser data
 * like any other (`docs/SECURITY.md` section 2.3).
 */
export function LoginForm({ next }: { readonly next?: string }) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    IDLE_AUTH_FORM_STATE,
  );

  const copy = AUTH_PAGES.login;

  return (
    <form action={formAction} noValidate>
      <AuthFormMessage state={state} title="We couldn't sign you in" />

      {next ? <input type="hidden" name={NEXT_PARAM} value={next} /> : null}

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

        <div className="flex flex-col gap-2">
          <PasswordField
            name="password"
            label={AUTH_FIELDS.currentPassword.label}
            autoComplete={AUTH_FIELDS.currentPassword.autoComplete}
            error={state.fieldErrors?.["password"]}
            disabled={pending}
          />
          <p className="text-body-sm">
            <Link
              href={FORGOT_PASSWORD_PATH}
              className="text-primary hover:text-primary-hover focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {copy.forgotPasswordLabel}
            </Link>
          </p>
        </div>

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

      {/*
        The cross-flow link, and the reason it is `min-h-11` rather than a bare
        inline link: measured at 390px it was 17px tall. WCAG 2.2 SC 2.5.8
        exempts a link inside a sentence, so this was technically conformant
        and still a poor target for the single most likely next action on the
        page. The prompt sits on its own line so the enlarged target does not
        stretch a line of running text.
      */}
      <p className="text-body-sm text-muted-foreground mt-8 flex flex-col items-center gap-1 text-center">
        <span>{copy.registerPrompt}</span>
        <Link
          href={REGISTER_PATH}
          className="text-primary hover:text-primary-hover focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm px-2 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {copy.registerLabel}
        </Link>
      </p>
    </form>
  );
}
