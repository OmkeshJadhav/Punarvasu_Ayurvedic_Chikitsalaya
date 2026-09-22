"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * Tabs.
 *
 * Radix provides roving focus (arrow keys, Home/End), the `tablist`/`tab`/
 * `tabpanel` relationships and correct `aria-selected`.
 *
 * Use tabs to switch between genuinely related views of one subject - a
 * patient's overview, appointments and documents. Not to break an unrelated
 * page into pieces, and not for a sequence: a booking flow is steps, not tabs.
 *
 * The list scrolls horizontally rather than wrapping, so a narrow screen keeps
 * one row of tabs instead of a shifting two-row block.
 */

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "border-border flex w-full items-stretch gap-1 overflow-x-auto border-b",
        // Hides the scrollbar without hiding the ability to scroll.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "text-label text-muted-foreground relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-4 font-medium whitespace-nowrap",
        MOTION_MICRO,
        "hover:text-foreground",
        // The active tab gets weight and an underline, not just a colour.
        "data-[state=active]:text-primary data-[state=active]:after:bg-primary",
        "data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5",
        "disabled:pointer-events-none disabled:opacity-55",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "focus-visible:outline-ring pt-5 focus-visible:outline-2 focus-visible:outline-offset-2",
        "motion-safe:data-[state=active]:animate-fade-in",
        className,
      )}
      {...props}
    />
  );
}
