/**
 * Shared validation primitives.
 *
 * Domain schemas live with their feature; these are the building blocks used
 * across features, defined once so that "what counts as a valid phone number"
 * has a single answer. Messages are written to be shown to a user.
 */
import { z } from "zod";

/** Database identifiers. Rejects anything that is not a UUID. */
export const uuidSchema = z.uuid({ message: "Not a valid identifier." });

/** Trimmed and lower-cased before validation, so "  A@B.test " is accepted. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ message: "Enter a valid email address." })
      .max(254, { message: "That email address is too long." }),
  );

/**
 * Indian mobile number, with or without the +91 country code, tolerant of
 * spaces and dashes as typed. Stored form is normalized to ten digits.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(?:\+91)?[6-9]\d{9}$/, {
        message: "Enter a valid 10-digit mobile number.",
      })
      .transform((value) => value.replace(/^\+91/, "")),
  );

/** Required free text with an explicit upper bound, so input stays bounded. */
export function requiredText(maxLength: number, label = "This field") {
  return z
    .string()
    .trim()
    .min(1, { message: `${label} is required.` })
    .max(maxLength, {
      message: `${label} must be ${maxLength} characters or fewer.`,
    });
}
