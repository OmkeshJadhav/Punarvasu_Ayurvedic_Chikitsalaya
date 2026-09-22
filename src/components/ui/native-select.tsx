import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { inputClassName } from "./input";
import { cn } from "@/lib/utils/cn";

/**
 * A native `<select>`, styled to match the other form controls.
 *
 * The design system deliberately carries two selects, and the choice between
 * them is not a matter of taste:
 *
 *   `Select`        a rich popover list. Use where the options need
 *                   description, grouping or an icon, and where the control is
 *                   part of an interactive surface.
 *   `NativeSelect`  a plain `<select>`. Use inside a form a patient fills in.
 *
 * Native wins in a form for three concrete reasons. It can carry an empty
 * option, so "not specified" is expressible — Radix reserves the empty string
 * and a value chosen there cannot be unchosen. It posts with the form whether
 * or not JavaScript has loaded. And on a phone it opens the platform's own
 * picker, which is the control every patient already knows how to use.
 * `phase_07.md` section 70 makes the same point about date inputs: prefer the
 * native control where it is genuinely better.
 *
 * Pair it with `Field`, which supplies the id, label association,
 * `aria-describedby` and `aria-invalid`:
 *
 * ```tsx
 * <Field name="gender" label="Gender" error={errors.gender}>
 *   {(control) => (
 *     <NativeSelect {...control} defaultValue={profile.gender ?? ""}>
 *       <option value="">Not specified</option>
 *       <option value="female">Female</option>
 *     </NativeSelect>
 *   )}
 * </Field>
 * ```
 */
export function NativeSelect({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          inputClassName,
          // Room for the chevron, and `appearance-none` so the browser's own
          // arrow does not sit beside ours.
          "cursor-pointer appearance-none pr-10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
      />
    </div>
  );
}
