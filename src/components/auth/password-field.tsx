"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Field } from "@/components/ui/field";
import { Input, inputClassName } from "@/components/ui/input";
import { PASSWORD_VISIBILITY } from "@/features/auth/content";
import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * A password input with a visibility toggle.
 *
 * Built on `Field`, so it inherits the label association, `aria-describedby`,
 * `aria-invalid` and `role="alert"` error wiring rather than re-implementing
 * them (`phase_06.md` sections 11, 61 and 62).
 *
 * ## The toggle
 *
 *   - A real `<button type="button">`. Without the explicit type it would
 *     default to `submit` inside a form, and revealing your password would
 *     attempt to sign you in.
 *   - Its accessible name is the *action* - "Show password" / "Hide password"
 *     - because the icon alone names nothing. The name changes with the state,
 *     so a screen-reader user who re-reads the control knows where they are.
 *   - `aria-pressed` states it as a toggle as well, for assistive technology
 *     that reports pressed state.
 *   - 44x44px, which is both the WCAG 2.2 target size and what stops a thumb
 *     hitting it by accident while typing.
 *   - Reachable by Tab and operated by Enter or Space, because it is a button
 *     and not a div with a click handler.
 *
 * ## What it does not do
 *
 * It does not block paste, and it sets no `onCopy`/`onPaste` handler.
 * `docs/SECURITY.md` section 5 is explicit: password managers must work and
 * paste must never be blocked. Blocking it pushes people towards passwords
 * they can type twice from memory, which are worse.
 *
 * The visible state resets to hidden on every render of a fresh form, and is
 * never persisted anywhere - a "show password" preference remembered across
 * sessions is a shoulder-surfing hazard on a clinic computer.
 */
export interface PasswordFieldProps {
  readonly name: string;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly error?: string | undefined;
  readonly autoComplete: "new-password" | "current-password";
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly maxLength?: number;
  readonly autoFocus?: boolean;
}

export function PasswordField({
  name,
  label,
  description,
  error,
  autoComplete,
  required = true,
  disabled = false,
  maxLength,
  autoFocus,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  return (
    <Field
      name={name}
      label={label}
      description={description}
      error={error}
      required={required}
      disabled={disabled}
    >
      {(control) => (
        <div className="relative">
          <Input
            {...control}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            maxLength={maxLength}
            autoFocus={autoFocus}
            // Room for the toggle, so a long password never runs underneath it.
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            disabled={disabled}
            aria-label={
              visible ? PASSWORD_VISIBILITY.hide : PASSWORD_VISIBILITY.show
            }
            aria-pressed={visible}
            aria-controls={control.id}
            className={cn(
              "absolute inset-y-0 right-0 flex size-11 items-center justify-center rounded-md",
              "text-muted-foreground hover:text-foreground cursor-pointer",
              MOTION_MICRO,
              "focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-55",
            )}
          >
            <ToggleIcon aria-hidden="true" className="size-4.5" />
          </button>
        </div>
      )}
    </Field>
  );
}

/** Exported for tests that assert the toggle does not restyle the control. */
export const passwordInputClassName = inputClassName;
