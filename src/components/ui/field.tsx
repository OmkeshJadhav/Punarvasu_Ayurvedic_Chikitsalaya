"use client";

import { Label } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A labelled form field.
 *
 * `Field` owns the ids and injects the accessibility wiring into whatever
 * control it renders, so a field built with it cannot be missing a label or an
 * error association:
 *
 * ```tsx
 * <Field
 *   name="email"
 *   label="Email address"
 *   description="We'll use this email for appointment communication."
 *   error={errors.email}
 *   required
 * >
 *   {(control) => (
 *     <Input type="email" autoComplete="email" placeholder="you@example.com" {...control} />
 *   )}
 * </Field>
 * ```
 *
 * What it guarantees:
 *   - A real `<label>` bound to the control. The label stays visible; a
 *     placeholder is never the only label.
 *   - `aria-describedby` references the description, and the error as well
 *     while one is present - and references nothing that is not rendered.
 *   - `aria-invalid` follows the error, so an invalid control is not signalled
 *     by a red border alone.
 *   - The error is `role="alert"`, so a validation failure arriving after
 *     submission is announced rather than appearing in silence.
 *   - `required` renders a marker with a text alternative, and sets
 *     `aria-required`.
 *
 * The description and error are props rather than child slots specifically so
 * that `aria-describedby` can be computed correctly during server rendering,
 * instead of pointing at an element that may never exist.
 *
 * This is a client component: it needs `useId`, and it takes a render prop.
 * That is not a real constraint, because a form also needs client-side
 * validation feedback (`AGENTS.md` section 12).
 */

/** The props a `Field` injects into its control. Spread them onto the input. */
export interface FieldControlProps {
  readonly id: string;
  readonly name: string;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly "aria-invalid": boolean | undefined;
  readonly "aria-describedby": string | undefined;
  readonly "aria-required": boolean | undefined;
}

export interface FieldProps extends Omit<
  ComponentProps<"div">,
  "children" | "onChange"
> {
  /** The control's `name`. Also seeds the generated ids. */
  readonly name: string;
  /** Always visible. Describes the value, not the format. */
  readonly label: ReactNode;
  /** What the value is used for, or the format expected. Optional. */
  readonly description?: ReactNode;
  /** Presence of a message is what puts the field into its error state. */
  readonly error?: string | undefined;
  readonly required?: boolean;
  readonly disabled?: boolean;
  /**
   * Visually hides the label while keeping it in the accessibility tree. Use
   * only where an adjacent heading already names the control - a search box in
   * a toolbar, for example. Never on a form a patient fills in.
   */
  readonly hideLabel?: boolean;
  readonly children: (control: FieldControlProps) => ReactNode;
}

export function Field({
  name,
  label,
  description,
  error,
  required = false,
  disabled = false,
  hideLabel = false,
  className,
  children,
  ...props
}: FieldProps) {
  const reactId = useId();
  const controlId = `${name}${reactId}`;
  const descriptionId = `${controlId}-description`;
  const errorId = `${controlId}-error`;

  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter((value): value is string => value !== null)
      .join(" ") || undefined;

  return (
    <div
      data-invalid={error ? "" : undefined}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      <Label.Root
        htmlFor={controlId}
        data-disabled={disabled ? "" : undefined}
        className={cn(
          "text-label text-foreground font-medium data-disabled:opacity-60",
          hideLabel && "sr-only",
        )}
      >
        {label}
        {required ? (
          <>
            {" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </Label.Root>

      {children({
        id: controlId,
        name,
        required,
        disabled,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })}

      {description ? (
        <p id={descriptionId} className="text-body-sm text-muted-foreground">
          {description}
        </p>
      ) : null}

      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

/**
 * A validation message.
 *
 * Exported separately for form-level errors that belong to no single control.
 * Messages should be specific and non-judgemental - "Please enter a valid
 * mobile number", not "Invalid input".
 */
export function FieldError({
  className,
  children,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      role="alert"
      className={cn(
        "text-body-sm text-destructive flex items-start gap-1.5 font-medium",
        className,
      )}
      {...props}
    >
      {/* Paired with the text so an error is never signalled by colour alone. */}
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
      >
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 4.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
      </svg>
      {children}
    </p>
  );
}
