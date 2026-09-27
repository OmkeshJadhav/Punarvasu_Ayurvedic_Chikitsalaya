import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * A single-line text input.
 *
 * A server component with no behaviour of its own. Pair it with `Field`, which
 * supplies the id, label association, `aria-describedby` and `aria-invalid`:
 *
 * ```tsx
 * <Field name="phone" label="Mobile number" error={errors.phone}>
 *   {(control) => <Input type="tel" autoComplete="tel" {...control} />}
 * </Field>
 * ```
 *
 * The 44px minimum height meets the WCAG 2.2 target size and, at 16px text,
 * stops iOS Safari zooming the page on focus.
 *
 * The invalid state changes the border *and* is announced through the
 * `aria-invalid` that `Field` sets, so it is never colour alone.
 */
export const inputClassName = cn(
  "flex w-full min-h-11 rounded-md border border-input bg-card px-3.5 py-2.5",
  "text-body text-foreground placeholder:text-muted-foreground/70",
  MOTION_MICRO,
  "hover:border-border-strong",
  "focus-visible:border-primary focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-1",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  "aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive",
  "file:border-0 file:bg-transparent file:text-label file:font-medium",
);

export function Input({
  className,
  type = "text",
  ...props
}: ComponentProps<"input">) {
  return (
    <input type={type} className={cn(inputClassName, className)} {...props} />
  );
}

/**
 * A leading icon inside an input - the envelope on an email field, the lock
 * on a password field.
 *
 * Purely a visual cue: the `Field` label names the control, so the icon is
 * hidden from assistive technology. Place it and the input inside a
 * `group/input relative` wrapper, and give the input `inputWithIconClassName`
 * so typed text never runs underneath the icon. The icon takes the focus
 * colour with its input.
 */
export function InputIcon({ icon: Icon }: { readonly icon: LucideIcon }) {
  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.5}
      className={cn(
        "text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2",
        MOTION_MICRO,
        "group-focus-within/input:text-primary",
      )}
    />
  );
}

/** The padding an input needs to clear an `InputIcon`. */
export const inputWithIconClassName = "pl-11";
