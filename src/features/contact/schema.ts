/**
 * Contact enquiry validation.
 *
 * ## Why this schema exists before the endpoint does
 *
 * `docs/implementation-plan/phase_05.md` section 40 is explicit: where
 * contact-submission infrastructure does not exist yet, build the UI and
 * validation foundation and document the backend required later. This module
 * is that foundation's authoritative half.
 *
 * It is written so it can be used unchanged on both sides of the trust
 * boundary. The client uses it for immediate feedback; the server route that
 * a later phase adds parses the request body through `parseInput` and this
 * same schema, so there is one definition of what a valid enquiry is and no
 * chance of the two drifting apart. Client-side validation is never the
 * security control (`docs/SECURITY.md` section 9).
 *
 * ## What it deliberately does not collect
 *
 * There is no symptoms field, no medical-history field, no date of birth and
 * no file upload. A public contact form must not become an accidental
 * medical-record system (`phase_05.md` sections 36-37, 43 and 71), and the
 * surest way to prevent that is to have nowhere for such data to go.
 *
 * Every field is length-bounded, so a submission cannot be used to push an
 * oversized payload through whatever handles it.
 */

import { z } from "zod";

import {
  emailSchema,
  phoneSchema,
  requiredText,
} from "@/lib/validation/schemas";

/** Bounds, exported so the UI can show the same limits it enforces. */
export const CONTACT_LIMITS = {
  nameMax: 80,
  messageMin: 10,
  messageMax: 1500,
} as const;

/**
 * The honeypot field.
 *
 * A control that is hidden from humans and left empty by them. A bot that
 * fills every input it finds fills this one too, and the submission is
 * rejected. It costs a visitor nothing, unlike a CAPTCHA, which
 * `phase_05.md` section 42 warns against adding by reflex.
 *
 * The name is deliberately plausible rather than "honeypot".
 */
export const CONTACT_HONEYPOT_FIELD = "company";

export const contactEnquirySchema = z.object({
  name: requiredText(CONTACT_LIMITS.nameMax, "Your name"),
  email: emailSchema,
  /**
   * Optional: a visitor who prefers to be emailed should not be forced to
   * give a phone number (`docs/SECURITY.md` section 33 - collect only what is
   * required). An empty string is normalised away before validation so the
   * field is genuinely optional rather than "optional unless you touch it".
   */
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(phoneSchema.optional()),
  message: z
    .string()
    .trim()
    .min(CONTACT_LIMITS.messageMin, {
      message: "Please write a little more so we can help.",
    })
    .max(CONTACT_LIMITS.messageMax, {
      message: `Please keep your message to ${CONTACT_LIMITS.messageMax} characters or fewer.`,
    }),
  /** Must be empty. See `CONTACT_HONEYPOT_FIELD`. */
  [CONTACT_HONEYPOT_FIELD]: z
    .string()
    .max(0, { message: "This field must be left empty." })
    .optional(),
});

export type ContactEnquiry = z.infer<typeof contactEnquirySchema>;

/** The raw shape the form holds while it is being typed into. */
export interface ContactFormValues {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly message: string;
  readonly [CONTACT_HONEYPOT_FIELD]: string;
}

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  email: "",
  phone: "",
  message: "",
  [CONTACT_HONEYPOT_FIELD]: "",
};

/** Per-field messages, keyed the way `Field` consumes them. */
export type ContactFieldErrors = Partial<
  Record<keyof ContactFormValues, string>
>;

/**
 * Validates form values for immediate feedback.
 *
 * Returns the first message per field, because a field shows one error at a
 * time. It never throws: a display-time validation failure is an expected
 * outcome, not an exception.
 */
export function validateContactForm(
  values: ContactFormValues,
): ContactFieldErrors {
  const result = contactEnquirySchema.safeParse(values);
  if (result.success) {
    return {};
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors as ContactFieldErrors;
}
