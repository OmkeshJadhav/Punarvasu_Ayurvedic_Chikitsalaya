"use client";

import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { inputClassName } from "./input";
import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * A single-choice select.
 *
 * Built on Radix Select, which gives keyboard support (arrows, Home/End,
 * type-ahead, Escape), focus management and correct `listbox` semantics that a
 * styled `<div>` cannot provide.
 *
 * ```tsx
 * <Field name="treatment" label="Treatment" error={errors.treatment}>
 *   {(control) => (
 *     <Select name={control.name} required={control.required}>
 *       <SelectTrigger id={control.id} aria-describedby={control["aria-describedby"]}>
 *         <SelectValue placeholder="Choose a treatment" />
 *       </SelectTrigger>
 *       <SelectContent>
 *         <SelectItem value="consultation">Initial consultation</SelectItem>
 *       </SelectContent>
 *     </Select>
 *   )}
 * </Field>
 * ```
 *
 * Radix renders a hidden native `<select>` when `name` is set, so the value
 * posts with a plain form submission and is still validated on the server.
 *
 * Use it for a handful of options. Long or searchable lists want a different
 * control, which the phase that needs one should add deliberately.
 */

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        inputClassName,
        "items-center justify-between gap-2 text-left",
        "data-placeholder:text-muted-foreground/70",
        "[&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={6}
        className={cn(
          "bg-popover text-popover-foreground border-border shadow-md",
          "relative z-(--z-dropdown) max-h-(--radix-select-content-available-height)",
          "min-w-(--radix-select-trigger-width) overflow-y-auto rounded-md border p-1",
          "motion-safe:data-[state=open]:animate-fade-in origin-(--radix-select-content-transform-origin)",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-0">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn(
        "text-caption text-muted-foreground px-2.5 py-1.5 font-medium tracking-wide uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "text-body relative flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm py-2 pr-2.5 pl-8 outline-none select-none",
        MOTION_MICRO,
        // Radix moves `data-highlighted` with both pointer and keyboard, so
        // one style covers hover and arrow-key navigation.
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-55",
        className,
      )}
      {...props}
    >
      {/* A tick as well as the highlight: selection is not colour alone. */}
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check aria-hidden="true" className="text-primary size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}
