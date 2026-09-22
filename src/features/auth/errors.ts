/**
 * Authentication error mapping.
 *
 * ## One mapper, not a string per form
 *
 * `phase_06.md` section 45 asks for a centralized mapping from provider error
 * to safe user-facing message, so error copy is not duplicated across five
 * forms and cannot drift into leaking provider text at the one form nobody
 * reviewed. Every authentication failure in the application comes through
 * {@link describeAuthFailure}.
 *
 * ## The rule about what a message may say
 *
 * A provider message is never shown. `AuthApiError: Invalid login credentials`
 * is the provider's words; `The email or password is incorrect.` is ours. The
 * provider error still travels in `AppError.cause`, which the logger records
 * and the response never serialises (`docs/ARCHITECTURE.md` section 12).
 *
 * ## Account enumeration
 *
 * Several distinct provider outcomes are folded into one message on purpose
 * (`docs/SECURITY.md` section 13). Sign-in answers "the email or password is
 * incorrect" whether the account is missing or the password is wrong, because
 * distinguishing them turns the sign-in form into a free account-existence
 * oracle. The same reasoning governs password reset and resend, which is why
 * those flows report success regardless of outcome - see the actions module.
 *
 * Registration is the deliberate exception, discussed at `email_exists` below.
 */

import { AppError, type AppErrorCode } from "@/lib/errors/app-error";

/**
 * The operation that failed.
 *
 * The same provider code means different things in different flows - an
 * expired one-time token is "your sign-in link has expired" during
 * verification and "your reset link has expired" during recovery - so the
 * mapper is told which flow it is in rather than guessing from the code.
 */
export type AuthOperation =
  | "sign-in"
  | "sign-up"
  | "password-reset-request"
  | "password-update"
  | "resend-verification"
  | "callback"
  | "sign-out";

/**
 * A provider error reduced to the fields that are safe to branch on.
 *
 * Read structurally rather than with `instanceof`, so a shape change in the
 * provider SDK degrades to the generic message instead of throwing inside the
 * error handler.
 */
interface ProviderErrorShape {
  readonly code: string | undefined;
  readonly status: number | undefined;
  readonly name: string | undefined;
}

function readProviderError(error: unknown): ProviderErrorShape {
  if (typeof error !== "object" || error === null) {
    return { code: undefined, status: undefined, name: undefined };
  }

  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate["code"] === "string" ? candidate["code"] : undefined,
    status:
      typeof candidate["status"] === "number" ? candidate["status"] : undefined,
    name: typeof candidate["name"] === "string" ? candidate["name"] : undefined,
  };
}

/** Safe copy for a failure the mapper does not recognise. */
const GENERIC_MESSAGE =
  "We couldn't complete that just now. Please try again in a moment.";

/**
 * Copy for a failure to reach the authentication service at all
 * (`phase_06.md` section 60). Names the user's connection as a thing they can
 * check, and nothing about our infrastructure.
 */
const NETWORK_MESSAGE =
  "We couldn't reach the sign-in service. Please check your connection and try again.";

const RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a few minutes before trying again.";

const EMAIL_RATE_LIMIT_MESSAGE =
  "We've already sent an email recently. Please check your inbox and spam folder, then try again in a few minutes.";

const CREDENTIALS_MESSAGE =
  "The email or password is incorrect. Please check your details and try again.";

const EXPIRED_LINK_MESSAGE =
  "This link has expired or has already been used. Please request a new one.";

/**
 * Maps a provider failure onto a safe {@link AppError}.
 *
 * The returned error's `message` is always fit to render. The original is
 * preserved as `cause` so the server log keeps the diagnosis.
 *
 * `logEvent` is a stable, low-cardinality label for the structured log - the
 * *category* of failure, never the provider's text and never the user's email
 * (`phase_06.md` section 76).
 */
export function describeAuthFailure(
  operation: AuthOperation,
  error: unknown,
): AppError & { readonly logEvent: string } {
  const { code, status, name } = readProviderError(error);
  const mapped = mapFailure(operation, code, status, name);

  const appError = new AppError(mapped.errorCode, {
    message: mapped.message,
    cause: error,
    ...(mapped.fieldErrors ? { fieldErrors: mapped.fieldErrors } : {}),
  });

  return Object.assign(appError, { logEvent: mapped.logEvent });
}

interface MappedFailure {
  readonly errorCode: AppErrorCode;
  readonly message: string;
  readonly logEvent: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
}

function mapFailure(
  operation: AuthOperation,
  code: string | undefined,
  status: number | undefined,
  name: string | undefined,
): MappedFailure {
  // A fetch that never reached the auth server. Checked first, because it can
  // arrive with no code at all and is the one failure where telling the user
  // to retry is genuinely useful advice.
  if (name === "AuthRetryableFetchError" || name === "TypeError") {
    return {
      errorCode: "internal",
      message: NETWORK_MESSAGE,
      logEvent: "auth.provider_unreachable",
    };
  }

  switch (code) {
    // --- Credentials -----------------------------------------------------
    //
    // `invalid_credentials` and `user_not_found` are folded together. Keeping
    // them apart would let anyone test an email address against the clinic's
    // patient list, one request at a time.
    case "invalid_credentials":
    case "user_not_found":
      return {
        errorCode: "unauthorized",
        message: CREDENTIALS_MESSAGE,
        logEvent: "auth.invalid_credentials",
      };

    case "email_not_confirmed":
      return {
        errorCode: "forbidden",
        message:
          "Please verify your email address before signing in. Check your inbox for the verification link, or request a new one.",
        logEvent: "auth.email_not_confirmed",
      };

    case "user_banned":
      return {
        errorCode: "forbidden",
        message:
          "This account isn't available. Please contact the clinic if you think this is a mistake.",
        logEvent: "auth.user_banned",
      };

    // --- Registration ----------------------------------------------------
    //
    // A deliberate, narrow enumeration exception.
    //
    // Supabase can be configured to return this rather than a decoy success.
    // When it does, hiding it makes the product worse in a way that matters
    // for a clinic: someone who already has an account and does not remember
    // is left staring at "check your email" for a message that will never
    // arrive, and telephones the front desk. The information is also already
    // obtainable through the password-reset timing channel, so suppressing it
    // here buys very little.
    //
    // The message therefore confirms nothing beyond "try signing in", and it
    // points at recovery rather than at the account.
    case "user_already_exists":
    case "email_exists":
      return {
        errorCode: "conflict",
        message:
          "An account with this email address already exists. Try signing in, or reset your password if you've forgotten it.",
        logEvent: "auth.email_exists",
        fieldErrors: {
          email: ["An account with this email address already exists."],
        },
      };

    case "signup_disabled":
      return {
        errorCode: "forbidden",
        message:
          "New accounts can't be created at the moment. Please contact the clinic.",
        logEvent: "auth.signup_disabled",
      };

    case "email_address_invalid":
    case "email_address_not_authorized":
      return {
        errorCode: "validation",
        message: "Please check the email address and try again.",
        logEvent: "auth.email_rejected",
        fieldErrors: { email: ["Please check this email address."] },
      };

    // --- Passwords -------------------------------------------------------
    //
    // Reached when the provider's policy is stricter than ours. The message
    // stays generic rather than echoing the provider's reason list, which can
    // name rules our own UI never showed.
    case "weak_password":
      return {
        errorCode: "validation",
        message:
          "That password doesn't meet the minimum requirements. Please choose a longer one.",
        logEvent: "auth.weak_password",
        fieldErrors: { password: ["Please choose a longer password."] },
      };

    case "same_password":
      return {
        errorCode: "validation",
        message:
          "That's the same as your current password. Please choose a different one.",
        logEvent: "auth.same_password",
        fieldErrors: { password: ["Please choose a different password."] },
      };

    // --- Links and one-time tokens ---------------------------------------
    //
    // Every "this link no longer works" outcome gets one message. Whether the
    // token expired, was already used, or belongs to an abandoned flow is
    // operationally identical for the user - request a new one - and telling
    // them which is a small oracle about a token they may not hold.
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
    case "validation_failed":
      return {
        errorCode: "unauthorized",
        message: EXPIRED_LINK_MESSAGE,
        logEvent: "auth.link_invalid_or_expired",
      };

    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
    case "bad_jwt":
      return {
        errorCode: "unauthorized",
        message: "Your session has expired. Please sign in again.",
        logEvent: "auth.session_expired",
      };

    case "reauthentication_needed":
      return {
        errorCode: "unauthorized",
        message: "Please sign in again to make this change.",
        logEvent: "auth.reauthentication_needed",
      };

    // --- Rate limiting ---------------------------------------------------
    case "over_email_send_rate_limit":
      return {
        errorCode: "rate_limited",
        message: EMAIL_RATE_LIMIT_MESSAGE,
        logEvent: "auth.email_rate_limited",
      };

    case "over_request_rate_limit":
      return {
        errorCode: "rate_limited",
        message: RATE_LIMIT_MESSAGE,
        logEvent: "auth.rate_limited",
      };

    default:
      break;
  }

  // No recognised code. Fall back to the HTTP status, which is coarse but
  // still better than a generic message for the two cases that have obvious,
  // actionable copy.
  if (status === 429) {
    return {
      errorCode: "rate_limited",
      message: RATE_LIMIT_MESSAGE,
      logEvent: "auth.rate_limited",
    };
  }

  if (status === 401 || status === 403) {
    return {
      errorCode: "unauthorized",
      message:
        operation === "sign-in" ? CREDENTIALS_MESSAGE : EXPIRED_LINK_MESSAGE,
      logEvent: "auth.unauthorized",
    };
  }

  return {
    errorCode: "internal",
    message: GENERIC_MESSAGE,
    logEvent: `auth.unexpected_failure.${operation}`,
  };
}

/**
 * Exported for tests and for copy review. Nothing in the application should
 * render one of these directly - go through {@link describeAuthFailure}, so
 * the choice of message stays with the mapping.
 */
export const AUTH_SAFE_MESSAGES = {
  generic: GENERIC_MESSAGE,
  network: NETWORK_MESSAGE,
  rateLimited: RATE_LIMIT_MESSAGE,
  emailRateLimited: EMAIL_RATE_LIMIT_MESSAGE,
  credentials: CREDENTIALS_MESSAGE,
  expiredLink: EXPIRED_LINK_MESSAGE,
} as const;
