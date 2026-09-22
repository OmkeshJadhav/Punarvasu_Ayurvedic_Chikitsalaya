"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A tooltip.
 *
 * Supplementary information only. A tooltip is invisible until hover or focus,
 * is unreachable by touch, and is skipped by some assistive technology - so
 * anything a user *needs* belongs in visible text or in a field description.
 *
 * Radix opens it on keyboard focus as well as hover and closes it on Escape,
 * which is what makes it usable at all.
 *
 * ```tsx
 * <TooltipProvider>
 *   <Tooltip>
 *     <TooltipTrigger asChild>
 *       <Button variant="ghost" size="icon" aria-label="About this treatment">
 *         <Info />
 *       </Button>
 *     </TooltipTrigger>
 *     <TooltipContent>Usually scheduled over seven days.</TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 * ```
 *
 * The trigger must be a focusable element. A tooltip on a `<div>` cannot be
 * reached with a keyboard.
 */

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "bg-foreground text-background shadow-md",
          "text-caption z-(--z-dropdown) max-w-64 rounded-sm px-2.5 py-1.5",
          "motion-safe:data-[state=delayed-open]:animate-fade-in",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
