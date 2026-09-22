/**
 * Authentication input validation.
 *
 * One definition per form, used on both sides of the trust boundary: the
 * browser runs these schemas for immediate feedback, and the server action
 * runs the same schema through `parseInput` before touching Supabase. Client
 * validation is never the security control (`docs/SECURITY.md` section 9) - it
 * is here so the two cannot disagree about what a valid password is.
 *
 * ## What registration does not collect
 *
 * There is no symptoms field, no medical history, no medications, no diagnosis
 * and no date of birth (`phase_06.md` sections 7-8). Account creation is
 * identity, not care. The surest way to keep clinical data out of the
 * authentication tables is to give it nowhere to go, so these schemas are
 * `strict` about their shape and the profile table has no column for it.
 */

import { z } from "zod";

import {
  emailSchema,
  phoneSchema,
  requiredText,
} from "@/lib/validation/schemas";

import {
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENT_TEXT,
} from "./limits";

/**
 * The limits live in `./limits`, which imports nothing.
 *
 * They are re-exported here so that this module remains the one place a
 * server, a test or a schema needs to look for the rules of an auth field -
 * the split is a bundling concern, not a change of ownership. A client
 * component must import them from `./limits` directly: reaching them through
 * this module pulls Zod into the browser, which is the 391 KB regression the
 * split exists to prevent. `./limits` carries the full account.
 */
export {
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENT_TEXT,
};

/**
 * Passwords rejected regardless of length.
 *
 * Modern guidance (`phase_06.md` section 9) is to require length and screen
 * against common choices rather than impose composition rules that push people
 * towards `Password1!`. This list is deliberately tiny: it catches the
 * passwords a person types when they are not really choosing one. A serious
 * breached-password check belongs with a provider integration, not with a word
 * list maintained by hand - recorded as deferred work.
 */
const OBVIOUSLY_WEAK_PASSWORDS: readonly string[] = [
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "iloveyou1",
  "punarvasu",
  "punarvasu1",
  "ayurveda123",
];

/**
 * A new password.
 *
 * Not trimmed: leading and trailing spaces are legitimate characters in a
 * password, and silently removing them would mean the password a manager
 * stored is not the password the account has.
 */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Please use at least ${PASSWORD_MIN_LENGTH} characters.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    message: `Please use ${PASSWORD_MAX_LENGTH} characters or fewer.`,
  })
  .refine((value) => !OBVIOUSLY_WEAK_PASSWORDS.includes(value.toLowerCase()), {
    message: "That password is too easy to guess. Please choose another.",
  })
  /**
   * Degenerate input: a single character repeated, or two alternating.
   *
   * This is not a composition rule - nothing here demands a symbol, a digit or
   * a capital, and `phase_06.md` section 9 is right that such rules mostly
   * produce `Password1!`. It rejects the specific case of someone holding a
   * key down until the counter is satisfied, which the length bound alone
   * lets through.
   */
  .refine((value) => new Set(value).size > 2, {
    message: "Please use a more varied password.",
  });

/**
 * An existing password, at sign-in.
 *
 * Bounded but not held to the strength rules: an account created before a
 * policy change still has to be able to sign in, and telling someone their
 * *existing* password is too weak at the sign-in prompt helps nobody. The
 * bound is only so an unbounded string never reaches the provider.
 */
const existingPasswordSchema = z
  .string()
  .min(1, { message: "Please enter your password." })
  .max(PASSWORD_MAX_LENGTH, {
    message: "The email or password is incorrect.",
  });

export const fullNameSchema = requiredText(FULL_NAME_MAX_LENGTH, "Your name");

/**
 * An optional phone number.
 *
 * Empty is normalised away before validation, so the field is genuinely
 * optional rather than "optional unless you touch it". The clinic can reach a
 * patient by email; requiring a second identifier at registration would
 * collect data the feature does not need (`docs/SECURITY.md` section 33).
 */
const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(phoneSchema.optional());

export const loginSchema = z.object({
  email: emailSchema,
  password: existingPasswordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: optionalPhoneSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  // Attached to `confirmPassword` so the message appears under the field the
  // user has to change, rather than at the top of the form.
  .refine((value) => value.password === value.confirmPassword, {
    message: "The two passwords don't match.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "The two passwords don't match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const resendVerificationSchema = z.object({ email: emailSchema });

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
