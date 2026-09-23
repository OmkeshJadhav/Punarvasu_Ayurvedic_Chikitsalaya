"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A popover: a small non-modal panel anchored to a trigger.
 *
 * Unlike a tooltip it may hold interactive content — links, buttons, forms —
 * because Radix manages it as a dialog: the trigger carries `aria-expanded`,
 * focus moves into the panel when it opens from the keyboard, Escape and an
 * outside click close it, and focus returns to the trigger afterwards.
 *
 * ```tsx
 * <Popover>
 *   <PopoverTrigger asChild>
 *     <Button variant="ghost">Details</Button>
 *   </PopoverTrigger>
 *   <PopoverContent>...</PopoverContent>
 * </Popover>
 * ```
 */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  sideOffset = 8,
  collisionPadding = 16,
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "bg-popover text-popover-foreground border-border shadow-md",
          "z-(--z-dropdown) rounded-lg border outline-none",
          "motion-safe:data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
