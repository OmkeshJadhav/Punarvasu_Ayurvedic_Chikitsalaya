"use client";

import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * An accordion.
 *
 * For FAQs and genuinely optional detail. Do not hide information a patient
 * needs - treatment guidance, preparation instructions, fees - behind a
 * collapsed panel.
 *
 * Radix renders each trigger inside a heading element and wires
 * `aria-expanded` and `aria-controls`. `headingLevel` sets the level so the
 * accordion slots into the surrounding document outline rather than always
 * claiming `<h3>`.
 *
 * The open/close height animation uses the `--radix-accordion-content-height`
 * variable Radix exposes, so it is pure CSS; `prefers-reduced-motion` collapses
 * it to an instant change via the global rule.
 */

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-border border-b", className)}
      {...props}
    />
  );
}

export interface AccordionTriggerProps extends ComponentProps<
  typeof AccordionPrimitive.Trigger
> {
  /** The heading level this item occupies in the page outline. */
  readonly headingLevel?: "h2" | "h3" | "h4";
  /**
   * `chevron` turns over when open. `plus` is two hairlines whose upright
   * collapses, leaving a minus - the quieter marker an editorial list uses
   * (the home page's "Before you visit").
   */
  readonly indicator?: "chevron" | "plus";
}

export function AccordionTrigger({
  className,
  children,
  headingLevel = "h3",
  indicator = "chevron",
  ...props
}: AccordionTriggerProps) {
  const Heading = headingLevel;
  return (
    <AccordionPrimitive.Header asChild>
      <Heading className="flex">
        <AccordionPrimitive.Trigger
          className={cn(
            // `font-sans` is explicit because the trigger lives inside a real
            // heading element, and the base layer gives every heading the
            // brand serif. A disclosure control is functional UI, not brand
            // voice, so it opts back into Inter (`docs/DESIGN_SYSTEM.md`).
            "group text-body text-heading flex flex-1 cursor-pointer items-center justify-between gap-4 py-4 text-left font-sans font-medium",
            "ease-natural transition-colors duration-(--duration-fast)",
            "hover:text-primary",
            "focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
            "[&[data-state=open]>svg]:rotate-180",
            className,
          )}
          {...props}
        >
          {children}
          {indicator === "plus" ? (
            <span
              aria-hidden="true"
              className={cn(
                "text-muted-foreground relative size-3.5 shrink-0",
                "before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-current",
                "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-current",
                "after:ease-natural after:transition-transform after:duration-(--duration-normal) group-data-[state=open]:after:scale-y-0",
              )}
            />
          ) : (
            <ChevronDown
              aria-hidden="true"
              className="text-muted-foreground ease-natural size-5 shrink-0 transition-transform duration-(--duration-normal)"
            />
          )}
        </AccordionPrimitive.Trigger>
      </Heading>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        "overflow-hidden",
        "data-[state=open]:motion-safe:animate-[accordion-open_var(--duration-normal)_var(--ease-natural)]",
        "data-[state=closed]:motion-safe:animate-[accordion-close_var(--duration-fast)_var(--ease-natural)]",
      )}
      {...props}
    >
      <div className={cn("text-body text-prose measure pb-4", className)}>
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}
