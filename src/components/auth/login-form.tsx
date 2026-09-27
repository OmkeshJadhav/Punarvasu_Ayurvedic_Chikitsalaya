"use client";

import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  Input,
  InputIcon,
  inputWithIconClassName,
} from "@/components/ui/input";
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
 *
 * The Google button and the registration link sit *outside* the `<form>`:
 * neither submits it, and keeping them out means a stray Enter can never be
 * routed to anything but "Sign in".
 */
export function LoginForm({ next }: { readonly next?: string }) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    IDLE_AUTH_FORM_STATE,
  );

  const copy = AUTH_PAGES.login;

  return (
    <>
      <form action={formAction} noValidate>
        <AuthFormMessage state={state} title="We couldn't sign you in" />

        {next ? <input type="hidden" name={NEXT_PARAM} value={next} /> : null}

        <div className="flex flex-col gap-4">
          <Field
            name="email"
            label={AUTH_FIELDS.email.label}
            error={state.fieldErrors?.["email"]}
            required
            disabled={pending}
          >
            {(control) => (
              <div className="group/input relative">
                <InputIcon icon={Mail} />
                <Input
                  {...control}
                  type="email"
                  inputMode="email"
                  autoComplete={AUTH_FIELDS.email.autoComplete}
                  placeholder={AUTH_FIELDS.email.placeholder}
                  defaultValue={state.values?.["email"] ?? ""}
                  className={inputWithIconClassName}
                />
              </div>
            )}
          </Field>

          {/*
            "Forgot your password?" sits on the label's line, which is where
            someone looks when they are unsure of their password - and it
            keeps the page inside the viewport. It follows the field in the
            DOM, so the Tab order is still password, show/hide, then this.
            The link keeps its 44px target; it is centred on the label line
            and simply extends above it.
          */}
          <div className="relative">
            <PasswordField
              name="password"
              label={AUTH_FIELDS.currentPassword.label}
              autoComplete={AUTH_FIELDS.currentPassword.autoComplete}
              placeholder={AUTH_FIELDS.currentPassword.placeholder}
              icon={LockKeyhole}
              error={state.fieldErrors?.["password"]}
              disabled={pending}
            />
            <Link
              href={FORGOT_PASSWORD_PATH}
              className="text-body-sm text-eyebrow hover:text-foreground focus-visible:outline-ring absolute -top-3 right-0 inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {copy.forgotPasswordLabel}
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            block
            loading={pending}
            loadingLabel={copy.submittingLabel}
            className="group mt-2"
          >
            {copy.submitLabel}
            <ArrowRight
              aria-hidden="true"
              className="motion-safe:transition-transform motion-safe:duration-(--duration-fast) motion-safe:group-hover:translate-x-1"
            />
          </Button>
        </div>
      </form>

      <div className="my-5 flex items-center gap-4">
        <span aria-hidden="true" className="bg-border h-px flex-1" />
        <p className="text-caption text-muted-foreground">
          {copy.alternativeDivider}
        </p>
        <span aria-hidden="true" className="bg-border h-px flex-1" />
      </div>

      <GoogleSignInButton disabled={pending} />

      {/*
        The cross-flow link, and the reason it is `min-h-11` rather than a bare
        inline link: measured at 390px it was 17px tall. WCAG 2.2 SC 2.5.8
        exempts a link inside a sentence, so this was technically conformant
        and still a poor target for the single most likely next action on the
        page. The prompt and the link are flex items rather than a sentence, so
        the enlarged target does not stretch a line of running text.
      */}
      <p className="text-body-sm text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-1 text-center">
        <span>{copy.registerPrompt}</span>
        <Link
          href={REGISTER_PATH}
          className="group text-primary hover:text-primary-hover focus-visible:outline-ring inline-flex min-h-11 items-center gap-2 rounded-sm px-2 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {copy.registerLabel}
          <ArrowRight
            aria-hidden="true"
            className="size-4 motion-safe:transition-transform motion-safe:duration-(--duration-fast) motion-safe:group-hover:translate-x-1"
          />
        </Link>
      </p>
    </>
  );
}
