"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * A submit button that knows whether its own form is submitting.
 *
 * `useFormStatus` reads the state of the enclosing `<form>`, so a server
 * component can render a plain form with an action and still get a real
 * loading state without becoming a client component itself. Used where there
 * is no `useActionState` result to read `pending` from - sign-out being the
 * case, since it has nothing to return.
 *
 * The button is disabled and `aria-busy` for the whole submission, so the
 * action cannot be dispatched twice.
 */
export function SubmitButton({
  children,
  loadingLabel,
  ...props
}: Omit<ButtonProps, "type" | "loading">) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...(props as ButtonProps)}
      type="submit"
      loading={pending}
      loadingLabel={loadingLabel}
    >
      {children}
    </Button>
  );
}
