"use client";

import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { useActionState } from "react";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  Input,
  InputIcon,
  inputWithIconClassName,
} from "@/components/ui/input";
import { signUpAction } from "@/features/auth/actions";
import { AUTH_FIELDS, AUTH_PAGES } from "@/features/auth/content";
import { IDLE_AUTH_FORM_STATE } from "@/features/auth/types";
import {
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/features/auth/limits";
import { LOGIN_PATH } from "@/lib/auth/paths";

/**
 * The registration form.
 *
 * ## What it asks for, and what it refuses to
 *
 * Name, email, an optional mobile number, and a password. Nothing else
 * (`phase_06.md` sections 7-8). There is no field for symptoms, medications,
 * history or date of birth, and the profile table has no column for any of it,
 * so this form cannot become the front door to a medical record by accident.
 * The page's opening line says so in words, because a patient creating an
 * account for a clinic reasonably expects to be asked.
 *
 * ## Layout
 *
 * From `sm`, name and mobile number share a row, as do the two password
 * fields, so the whole form fits one laptop viewport. Each pair is a pair in
 * meaning as well as in position, so reading order is unaffected. On a phone
 * everything stacks in the same order.
 *
 * ## No terms checkbox
 *
 * `phase_06.md` section 67 says to link to a privacy policy and terms *if
 * these routes exist*. They do not (`config/navigation.ts`,
 * `LEGAL_NAV_ITEMS`), and a tick box consenting to an unpublished document is
 * a worse artefact than none: it manufactures a record of agreement to
 * something nobody could read. What replaces it is a plain statement of what
 * is collected and why - the substance a consent notice carries - and a
 * commitment that the policies will be published before records are handled
 * here. The checkbox arrives in the same change as the pages.
 */
export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    IDLE_AUTH_FORM_STATE,
  );

  const copy = AUTH_PAGES.register;

  return (
    <form action={formAction} noValidate>
      <AuthFormMessage state={state} title="We couldn't create your account" />

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="fullName"
            label={AUTH_FIELDS.fullName.label}
            error={state.fieldErrors?.["fullName"]}
            required
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete={AUTH_FIELDS.fullName.autoComplete}
                maxLength={FULL_NAME_MAX_LENGTH}
                defaultValue={state.values?.["fullName"] ?? ""}
              />
            )}
          </Field>

          <Field
            name="phone"
            label={AUTH_FIELDS.phone.label}
            error={state.fieldErrors?.["phone"]}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                type="tel"
                inputMode="tel"
                autoComplete={AUTH_FIELDS.phone.autoComplete}
                defaultValue={state.values?.["phone"] ?? ""}
              />
            )}
          </Field>
        </div>

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

        {/* `items-start`: the requirement text under the first password must
            not stretch the second field's row. */}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <PasswordField
            name="password"
            label={AUTH_FIELDS.password.label}
            description={AUTH_FIELDS.password.description}
            autoComplete={AUTH_FIELDS.password.autoComplete}
            error={state.fieldErrors?.["password"]}
            maxLength={PASSWORD_MAX_LENGTH}
            disabled={pending}
          />

          <PasswordField
            name="confirmPassword"
            label={AUTH_FIELDS.confirmPassword.label}
            autoComplete={AUTH_FIELDS.confirmPassword.autoComplete}
            error={state.fieldErrors?.["confirmPassword"]}
            maxLength={PASSWORD_MAX_LENGTH}
            disabled={pending}
          />
        </div>

        <p className="text-caption text-muted-foreground">
          {copy.privacyNotice}
        </p>

        <Button
          type="submit"
          size="lg"
          block
          loading={pending}
          loadingLabel={copy.submittingLabel}
          className="group"
        >
          {copy.submitLabel}
          <ArrowRight
            aria-hidden="true"
            className="motion-safe:transition-transform motion-safe:duration-(--duration-fast) motion-safe:group-hover:translate-x-1"
          />
        </Button>
      </div>

      {/* See the note in `login-form.tsx` on why this target is enlarged. */}
      <p className="text-body-sm text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-1 text-center">
        <span>{copy.loginPrompt}</span>
        <Link
          href={LOGIN_PATH}
          className="text-primary hover:text-primary-hover focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm px-2 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {copy.loginLabel}
        </Link>
      </p>
    </form>
  );
}
