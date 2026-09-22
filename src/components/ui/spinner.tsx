import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * An indeterminate progress indicator.
 *
 * Decorative by default: a spinner beside the word "Booking..." would
 * otherwise be announced twice. When the spinner is the *only* indication that
 * work is happening, pass a `label` - it is rendered for screen readers and
 * the element becomes a live status.
 *
 * Under `prefers-reduced-motion` the global rule in `globals.css` stops the
 * rotation. The ring stays visible, so the control still reads as busy.
 */
export interface SpinnerProps extends Omit<ComponentProps<"span">, "children"> {
  /** Announced to assistive technology. Omit when nearby text already says it. */
  readonly label?: string;
}

export function Spinner({ className, label, ...props }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="size-full animate-spin"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.5"
          className="opacity-25"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
