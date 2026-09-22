import { Alert } from "@/components/ui/alert";
import type { AuthFormState } from "@/features/auth/types";

/**
 * The form-level result of an authentication action.
 *
 * One component for all four forms, so a failure looks and is announced the
 * same way everywhere. `Alert` already gives `danger` a `role="alert"` and
 * `success` a `role="status"`, which is the distinction that matters here: a
 * failure interrupts, a confirmation waits for a pause.
 *
 * The message always comes from `features/auth/errors.ts` or
 * `features/auth/content.ts`. Nothing renders a provider's own text.
 */
export function AuthFormMessage({
  state,
  title,
}: {
  readonly state: AuthFormState;
  readonly title?: string;
}) {
  if (state.status === "idle" || !state.message) return null;

  const isError = state.status === "error";

  return (
    <Alert
      tone={isError ? "danger" : "success"}
      title={title ?? (isError ? "We couldn't continue" : "Done")}
      className="mb-6"
    >
      {state.message}
    </Alert>
  );
}
