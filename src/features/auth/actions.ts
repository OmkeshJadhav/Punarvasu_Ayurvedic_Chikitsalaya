"use server";

/**
 * Authentication server actions.
 *
 * ## Why server actions rather than API routes
 *
 * Next.js validates a server action's `Origin` against the `Host` and rejects
 * a mismatch, which is the CSRF protection `phase_06.md` section 56 asks for -
 * built in, rather than a token scheme written here and got subtly wrong.
 * Action ids are encrypted at build time and unused actions are stripped from
 * client bundles, so these are not addressable endpoints. Credentials also
 * never enter client JavaScript: the browser posts the form and the password
 * exists only in the request body and in this process.
 *
 * ## The shape every action follows
 *
 *   1. Parse the form through the schema in `./validation`. Never trust the
 *      browser's copy of the same check.
 *   2. Call Supabase.
 *   3. On failure, map through `describeAuthFailure` and return safe copy.
 *      Log the category, never the provider text and never the address.
 *   4. On success, redirect or return a success state.
 *
 * `redirect()` throws a control-flow signal that Next.js catches, so every
 * redirect is called *outside* a `try`. A `catch` around one would swallow the
 * navigation and leave the user on the form after a successful sign-in.
 *
 * ## What is never logged
 *
 * Passwords, the contents of a reset or verification link, access tokens and
 * refresh tokens (`phase_06.md` section 76). The structured logger redacts by
 * key name as a safety net, but these actions do not hand it those values in
 * the first place. Email addresses are not logged either: an authentication
 * log that records who tried to sign in is a list of the clinic's patients.
 */

import { redirect } from "next/navigation";

import { describeAuthFailure } from "@/features/auth/errors";
import {
  clearPendingVerificationEmail,
  setPendingVerificationEmail,
} from "@/features/auth/pending-email";
import {
  authFormError,
  authFormSuccess,
  firstFieldMessages,
  type AuthFormState,
} from "@/features/auth/types";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from "@/features/auth/validation";
import { buildAuthCallbackUrl } from "@/lib/auth/callback-url";
import {
  AUTHENTICATED_LANDING_PATH,
  RESET_PASSWORD_PATH,
  SIGN_OUT_LANDING_PATH,
  VERIFY_PATH,
} from "@/lib/auth/paths";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AUTH_PAGES } from "@/features/auth/content";

/** Reads a form field as a string. `FormData` can also hold files. */
function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Parses form values, returning either the parsed data or a form state.
 *
 * A small discriminated result rather than exceptions for control flow, so
 * each action reads top to bottom.
 */
function parseForm<TOutput>(
  schema: {
    safeParse: (input: unknown) => {
      success: boolean;
      data?: TOutput;
      error?: unknown;
    };
  },
  input: unknown,
  values: Readonly<Record<string, string>>,
):
  | { readonly ok: true; readonly data: TOutput }
  | { readonly ok: false; readonly state: AuthFormState } {
  const result = schema.safeParse(input);
  if (result.success && result.data !== undefined) {
    return { ok: true, data: result.data };
  }

  const fieldErrors: Record<string, string> = {};
  const issues = (
    result.error as {
      issues?: readonly { path: readonly unknown[]; message: string }[];
    }
  )?.issues;

  for (const issue of issues ?? []) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return {
    ok: false,
    state: authFormError("Please check the details below and try again.", {
      fieldErrors,
      values,
    }),
  };
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

/**
 * Signs a user in and returns them to their intended destination.
 *
 * The destination arrives in a hidden form field, which is browser-supplied
 * and therefore untrusted; {@link safeRedirectPath} is what makes it safe, and
 * it is applied here rather than relying on the field having been rendered by
 * our own page (`phase_06.md` sections 16 and 40).
 */
export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email");
  // The password is read but never put into `values`, so it cannot be echoed
  // back into the response, the DOM or an error report.
  const values = { email } as const;

  const parsed = parseForm(
    loginSchema,
    {
      email,
      password: field(formData, "password"),
    },
    values,
  );
  if (!parsed.ok) return parsed.state;

  const destination = safeRedirectPath(
    field(formData, "next"),
    AUTHENTICATED_LANDING_PATH,
  );

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      const failure = describeAuthFailure("sign-in", error);
      logger.warn(failure.logEvent, { operation: "sign-in" });
      return authFormError(failure.message, { values });
    }
  } catch (error) {
    const failure = describeAuthFailure("sign-in", error);
    logger.error(failure.logEvent, error, { operation: "sign-in" });
    return authFormError(failure.message, { values });
  }

  // A successful sign-in is worth recording as a security event
  // (`docs/SECURITY.md` section 15). No identifier is attached yet - the
  // audit trail that would make one meaningful arrives with Phase 19, and an
  // email address in a log file is a patient list.
  logger.info("auth.sign_in_succeeded");

  redirect(destination);
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

/**
 * Creates an account and sends the user to the verification instructions.
 *
 * The role is not passed to Supabase. `full_name` and `phone` go into user
 * metadata, which the `handle_new_user` trigger copies into `profiles` - and
 * that trigger hard-codes the role to `patient` precisely because metadata is
 * client-supplied. A registration form cannot ask to be an administrator.
 */
export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = {
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
  } as const;

  const parsed = parseForm(
    registerSchema,
    {
      ...values,
      password: field(formData, "password"),
      confirmPassword: field(formData, "confirmPassword"),
    },
    values,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(AUTHENTICATED_LANDING_PATH),
        data: {
          full_name: parsed.data.fullName,
          ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
        },
      },
    });

    if (error) {
      const failure = describeAuthFailure("sign-up", error);
      logger.warn(failure.logEvent, { operation: "sign-up" });
      return authFormError(failure.message, {
        ...(firstFieldMessages(failure.fieldErrors)
          ? { fieldErrors: firstFieldMessages(failure.fieldErrors)! }
          : {}),
        values,
      });
    }

    await setPendingVerificationEmail(parsed.data.email);
  } catch (error) {
    const failure = describeAuthFailure("sign-up", error);
    logger.error(failure.logEvent, error, { operation: "sign-up" });
    return authFormError(failure.message, { values });
  }

  logger.info("auth.sign_up_succeeded");

  // Always to the verification page, never straight into the account. Whether
  // Supabase created a session depends on the project's email-confirmation
  // setting, and a registration flow that sometimes lands on a dashboard and
  // sometimes on "check your email" is one nobody can support
  // (`phase_06.md` section 68).
  redirect(VERIFY_PATH);
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------

/**
 * Requests a password reset email.
 *
 * **Always answers the same way.** Success, "no such account", and a provider
 * outage all produce the neutral confirmation, because any difference - in the
 * message, the status, or whether the form clears - tells an anonymous caller
 * whether an address belongs to a patient of this clinic
 * (`docs/SECURITY.md` section 13).
 *
 * The one thing that is not hidden is malformed input: "that isn't an email
 * address" reveals nothing about who is registered.
 */
export async function requestPasswordResetAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: field(formData, "email") } as const;

  const parsed = parseForm(forgotPasswordSchema, values, values);
  if (!parsed.ok) return parsed.state;

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: buildAuthCallbackUrl(RESET_PASSWORD_PATH) },
    );

    if (error) {
      // Logged, not surfaced. The operator needs to know the mail provider is
      // failing; the caller must not be able to tell.
      const failure = describeAuthFailure("password-reset-request", error);
      logger.warn(failure.logEvent, { operation: "password-reset-request" });
    } else {
      logger.info("auth.password_reset_requested");
    }
  } catch (error) {
    const failure = describeAuthFailure("password-reset-request", error);
    logger.error(failure.logEvent, error, {
      operation: "password-reset-request",
    });
  }

  return authFormSuccess(AUTH_PAGES.forgotPassword.neutralConfirmation);
}

// ---------------------------------------------------------------------------
// Set a new password
// ---------------------------------------------------------------------------

/**
 * Sets a new password for the session created by a recovery link.
 *
 * The authorization here is the session itself: `updateUser` acts on the user
 * the access token identifies, and the only way to hold a recovery session is
 * to have opened the emailed link. No user id is read from the form, so there
 * is nothing for a caller to substitute (`phase_06.md` sections 35-36).
 *
 * The session is re-verified with `getUser()` before the update, rather than
 * assumed from the presence of a cookie, so an expired or forged recovery
 * session is refused rather than acted on.
 */
export async function updatePasswordAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseForm(
    resetPasswordSchema,
    {
      password: field(formData, "password"),
      confirmPassword: field(formData, "confirmPassword"),
    },
    {},
  );
  if (!parsed.ok) return parsed.state;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      const failure = describeAuthFailure("password-update", userError);
      logger.warn(failure.logEvent, { operation: "password-update" });
      return authFormError(AUTH_PAGES.resetPassword.invalidBody);
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      const failure = describeAuthFailure("password-update", error);
      logger.warn(failure.logEvent, { operation: "password-update" });
      return authFormError(failure.message, {
        ...(firstFieldMessages(failure.fieldErrors)
          ? { fieldErrors: firstFieldMessages(failure.fieldErrors)! }
          : {}),
      });
    }

    // A password change ends every other session. If the reset happened
    // because someone else had the old password, leaving their session alive
    // would make the reset pointless (`docs/SECURITY.md` section 28).
    const { error: signOutError } = await supabase.auth.signOut({
      scope: "others",
    });
    if (signOutError) {
      logger.warn("auth.other_sessions_not_revoked", {
        operation: "password-update",
      });
    }
  } catch (error) {
    const failure = describeAuthFailure("password-update", error);
    logger.error(failure.logEvent, error, { operation: "password-update" });
    return authFormError(failure.message);
  }

  logger.info("auth.password_updated");

  return authFormSuccess(AUTH_PAGES.resetPassword.successBody);
}

// ---------------------------------------------------------------------------
// Resend verification
// ---------------------------------------------------------------------------

/**
 * Resends the verification email.
 *
 * Neutral for the same reason as password reset: an address that is already
 * verified, an address that was never registered and a successful resend are
 * indistinguishable in the response.
 *
 * Repeat requests are limited by Supabase, which is the right layer for it -
 * `phase_06.md` sections 48-49 warn against building a parallel mechanism that
 * weakens the provider's own protection. A rate-limited response still
 * produces the neutral confirmation, so the limit itself reveals nothing; the
 * submit button is disabled for the duration of the request so an impatient
 * user does not spend their allowance by double-clicking.
 */
export async function resendVerificationAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = { email: field(formData, "email") } as const;

  const parsed = parseForm(resendVerificationSchema, values, values);
  if (!parsed.ok) return parsed.state;

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(AUTHENTICATED_LANDING_PATH),
      },
    });

    if (error) {
      const failure = describeAuthFailure("resend-verification", error);
      logger.warn(failure.logEvent, { operation: "resend-verification" });
    } else {
      logger.info("auth.verification_resent");
    }
  } catch (error) {
    const failure = describeAuthFailure("resend-verification", error);
    logger.error(failure.logEvent, error, { operation: "resend-verification" });
  }

  return authFormSuccess(
    "If that email address needs verifying, we've sent the link again. Please check your inbox, including your spam folder.",
  );
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

/**
 * Signs the user out and returns them to the public site.
 *
 * Scope is Supabase's default, `global`: every refresh token for the account
 * is revoked, not just this browser's. That is the security-favouring choice
 * (`AGENTS.md` section 38 ranks security above convenience) and it is what
 * makes the guarantee in `phase_06.md` section 73 unconditional - after
 * signing out, no stored session anywhere can be refreshed back into access,
 * whatever a cached page or a back button shows.
 *
 * A failure still clears cookies and still redirects. Leaving someone on a
 * page that says "we couldn't sign you out" while their session cookie is
 * gone would be worse than useless.
 */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      const failure = describeAuthFailure("sign-out", error);
      logger.warn(failure.logEvent, { operation: "sign-out" });
    } else {
      logger.info("auth.sign_out_succeeded");
    }

    await clearPendingVerificationEmail();
  } catch (error) {
    logger.error("auth.sign_out_failed", error);
  }

  redirect(SIGN_OUT_LANDING_PATH);
}
