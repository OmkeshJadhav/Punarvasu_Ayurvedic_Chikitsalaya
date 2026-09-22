import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

import { inputClassName } from "./input";

/**
 * A multi-line text input.
 *
 * Shares `Input`'s styling so the two never drift apart. Use for symptoms,
 * notes and messages; pair with `Field` for labelling, exactly as `Input`.
 *
 * `field-sizing-content` lets the box grow with what is typed, up to the
 * `max-h`, instead of forcing the user to scroll a four-row window. Browsers
 * without support fall back to the `min-h` and the native resize handle.
 */
export function Textarea({
  className,
  rows = 4,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cn(
        inputClassName,
        "field-sizing-content max-h-80 min-h-28 resize-y leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}
