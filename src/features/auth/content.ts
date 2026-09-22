/**
 * Authentication copy.
 *
 * All of it, in one file, for the same reason the marketing copy is: so that
 * the words a patient reads can be reviewed without reading React, and so that
 * two pages cannot describe the same thing differently.
 *
 * The voice is the rest of Punarvasu's - calm, plain, never breezy. These
 * pages are the first authenticated surface a patient meets, and several of
 * them are read by someone who is unwell, locked out, or both.
 */

import { PASSWORD_REQUIREMENT_TEXT } from "./limits";

export const AUTH_PAGES = {
  login: {
    title: "Sign in",
    heading: "Welcome back",
    description: "Sign in to continue to your Punarvasu account.",
    submitLabel: "Sign in",
    submittingLabel: "Signing in…",
    forgotPasswordLabel: "Forgot your password?",
    registerPrompt: "New to Punarvasu?",
    registerLabel: "Create an account",
  },

  register: {
    title: "Create an account",
    heading: "Create your account",
    description:
      "An account lets you keep your appointments and clinic communication in one place.",
    submitLabel: "Create account",
    submittingLabel: "Creating your account…",
    loginPrompt: "Already have an account?",
    loginLabel: "Sign in",
    /**
     * Shown in place of a terms checkbox.
     *
     * `phase_06.md` section 67 says to link to a privacy policy and terms *if
     * these routes exist*, and not to make users agree to policies that do
     * not. Neither page exists yet (`config/navigation.ts`,
     * `LEGAL_NAV_ITEMS`), so there is no checkbox and no link - a tick box
     * consenting to an unpublished document is worse than none.
     *
     * What replaces it is a plain statement of what is collected and what it
     * is for, which is the substance a consent notice is meant to carry. The
     * checkbox arrives in the same change as the pages.
     */
    privacyNotice:
      "We collect your name, email address and — if you give it — your phone number, so the clinic can identify you and contact you about your care. Our full privacy policy and terms are still being prepared and will be published before the clinic begins handling records through this website.",
    healthNotice:
      "Please don't include any health information here. Creating an account asks for contact details only; anything about your health is discussed with your practitioner.",
  },

  verify: {
    title: "Verify your email",
    heading: "Check your email",
    description:
      "We've sent you a link to verify your email address. Open it on this device to finish setting up your account.",
    /** Shown when the address is unknown, e.g. on a direct visit to the page. */
    descriptionWithoutEmail:
      "Open the verification link we sent you to finish setting up your account.",
    spamHint:
      "If it hasn't arrived within a few minutes, please check your spam or promotions folder.",
    resendHeading: "Didn't get the email?",
    resendDescription:
      "Enter your email address and we'll send the verification link again.",
    resendLabel: "Resend verification email",
    resendingLabel: "Sending…",
    backToLoginLabel: "Back to sign in",
  },

  forgotPassword: {
    title: "Reset your password",
    heading: "Forgot your password?",
    description:
      "Enter your email address and we'll send you instructions for choosing a new password.",
    submitLabel: "Send reset instructions",
    submittingLabel: "Sending…",
    backToLoginLabel: "Back to sign in",
    /**
     * The neutral response required by `docs/SECURITY.md` section 13 and
     * `phase_06.md` section 18.
     *
     * It is returned whether or not an account exists, and — importantly — it
     * is also returned when the provider itself fails, so a failure cannot be
     * distinguished from a success by watching the response. The real outcome
     * is in the server log.
     */
    neutralConfirmation:
      "If an account exists for that email address, we've sent instructions for resetting the password. Please check your inbox, including your spam folder.",
  },

  resetPassword: {
    title: "Choose a new password",
    heading: "Choose a new password",
    description: "Pick something you haven't used on this account before.",
    submitLabel: "Save new password",
    submittingLabel: "Saving…",
    successHeading: "Your password has been changed",
    successBody:
      "You're signed in on this device. For your security, other devices have been signed out.",
    continueLabel: "Continue to your account",
    invalidHeading: "This link is no longer valid",
    invalidBody:
      "Password reset links expire after a short time and can only be used once. Request a new one and we'll send it straight away.",
    requestNewLinkLabel: "Request a new link",
  },

  account: {
    title: "Your account",
    heading: "Your account",
    description:
      "This is the start of your Punarvasu account. Clinic documents will appear here as that part of the website is built.",
    signOutLabel: "Sign out",
    signingOutLabel: "Signing out…",
    unverifiedTitle: "Your email address isn't verified yet",
    unverifiedBody:
      "Please open the verification link we sent you. Until then, some parts of your account will stay unavailable.",
    verifyLinkLabel: "Resend the verification email",
  },
} as const;

/** Field labels, hints and autocomplete tokens, shared across the forms. */
export const AUTH_FIELDS = {
  fullName: {
    label: "Full name",
    autoComplete: "name",
    description: "As you'd like the clinic to address you.",
  },
  email: {
    label: "Email address",
    autoComplete: "email",
  },
  phone: {
    label: "Mobile number",
    autoComplete: "tel",
    description: "Optional. The clinic may use it for appointment reminders.",
  },
  password: {
    label: "Password",
    /** Tells a password manager to offer a *new* password, not an existing one. */
    autoComplete: "new-password",
    description: PASSWORD_REQUIREMENT_TEXT,
  },
  currentPassword: {
    label: "Password",
    autoComplete: "current-password",
  },
  confirmPassword: {
    label: "Confirm password",
    autoComplete: "new-password",
  },
} as const;

/** Accessible names for the password visibility control. */
export const PASSWORD_VISIBILITY = {
  show: "Show password",
  hide: "Hide password",
} as const;

/**
 * The line beneath every auth card.
 *
 * Present because these pages are the boundary between the public site and a
 * healthcare record, and someone arriving here from a link should be able to
 * tell what they are signing in to.
 */
export const AUTH_FOOTNOTE =
  "Punarvasu is an Ayurvedic clinic. This website is not a substitute for professional diagnosis, treatment or emergency care.";

export const BACK_TO_SITE_LABEL = "Back to the Punarvasu website";
