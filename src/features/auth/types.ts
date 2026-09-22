/**
 * Shared shapes for the authentication forms.
 *
 * Every auth server action returns an {@link AuthFormState}, so the four forms
 * read their result the same way and a new form cannot invent a fifth
 * convention.
 */

/** Field name to the single message shown beneath that field. */
export type AuthFieldErrors = Readonly<Record<string, string>>;

/**
 * What a server action hands back to `useActionState`.
 *
 * `status` drives the UI rather than the presence or absence of a message, so
 * a successful action with nothing to say is still unambiguously a success.
 */
export interface AuthFormState {
  readonly status: "idle" | "error" | "success";
  /** Form-level message. Always safe to render (see `features/auth/errors.ts`). */
  readonly message?: string;
  readonly fieldErrors?: AuthFieldErrors;
  /**
   * Non-secret values to put back into the form after a failure, so a
   * validation error does not make someone retype their name and email
   * (`docs/PRODUCT_SPEC.md` section 12.1).
   *
   * **Passwords are never included.** Echoing a password into the response
   * would put it in the flight payload, in the DOM and in any error report
   * that captures form values.
   */
  readonly values?: Readonly<Record<string, string>>;
}

export const IDLE_AUTH_FORM_STATE: AuthFormState = { status: "idle" };

/** A failure with a form-level message and, optionally, per-field messages. */
export function authFormError(
  message: string,
  options: {
    readonly fieldErrors?: AuthFieldErrors;
    readonly values?: Readonly<Record<string, string>>;
  } = {},
): AuthFormState {
  return {
    status: "error",
    message,
    ...(options.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
    ...(options.values ? { values: options.values } : {}),
  };
}

/** A success, with copy the form renders in place of its fields. */
export function authFormSuccess(message: string): AuthFormState {
  return { status: "success", message };
}

/**
 * Reduces `parseInput`'s field errors to one message per field.
 *
 * A field shows a single error at a time; three stacked messages under one
 * input is noise, and the first is the one the user acts on.
 */
export function firstFieldMessages(
  fieldErrors: Readonly<Record<string, readonly string[]>> | undefined,
): AuthFieldErrors | undefined {
  if (!fieldErrors) return undefined;

  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const first = messages[0];
    if (typeof first === "string") result[field] = first;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
