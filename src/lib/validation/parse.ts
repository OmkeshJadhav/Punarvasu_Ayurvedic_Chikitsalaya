/**
 * Validation at trust boundaries.
 *
 * Every value arriving from outside the server - form submission, route
 * handler body, query string, webhook payload - is parsed through a schema
 * before any business logic sees it. Browser-side validation exists for
 * feedback only and is never a security control.
 */
import { z } from "zod";

import { validationError, type FieldErrors } from "@/lib/errors/app-error";

/**
 * Parses `input` against `schema`, or throws an `AppError` of code
 * `validation` carrying per-field messages.
 *
 * Messages come from the schema, so they are authored for users; raw parser
 * output is never forwarded verbatim.
 */
export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw validationError(toFieldErrors(result.error));
}

/** Flattens parser issues into `field -> messages`, keyed by dotted path. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    const messages = fieldErrors[key] ?? [];
    messages.push(issue.message);
    fieldErrors[key] = messages;
  }

  return fieldErrors;
}
