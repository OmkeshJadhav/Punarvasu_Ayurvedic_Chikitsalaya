import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * The card system.
 *
 * Cards group related information: a treatment, a practitioner, an appointment
 * summary. Not every piece of content belongs in one - a card around a single
 * paragraph is noise.
 *
 * Variants
 *   default      Border and white surface. The workhorse; no shadow.
 *   interactive  The whole card leads somewhere. Lifts on hover, and the
 *                *link inside it* stays the focusable element - see below.
 *   highlighted  Carries the herbal accent tint. For a recommended or
 *                selected item. One per group at most.
 *   elevated     Genuinely floating content. Shadow earned, used sparingly.
 *   muted        Sits back: summaries, side notes, secondary panels.
 *
 * Padding
 *   `compact` for dense lists and dashboards, `default` elsewhere, `none` when
 *   the card contains a full-bleed image and sets its own padding inside.
 *
 * Accessibility for an interactive card: do not put `onClick` on the card.
 * Render a real link in the title and let the card stretch its hit area:
 *
 * ```tsx
 * <Card variant="interactive">
 *   <CardTitle>
 *     <CardLink href="/treatments/panchakarma">Panchakarma</CardLink>
 *   </CardTitle>
 *   <CardDescription>Traditional Ayurvedic detoxification.</CardDescription>
 * </Card>
 * ```
 *
 * That keeps one focusable element with a real accessible name, keyboard
 * activation, a working middle-click, and a visible focus ring around the card.
 */
const cardVariants = cva("relative flex flex-col rounded-lg", {
  variants: {
    variant: {
      default: "border-border bg-card border",
      interactive: cn(
        "border-border bg-card border",
        MOTION_MICRO,
        "hover:border-primary/30 hover:shadow-md",
        // The focus ring belongs to the card, not the hidden stretched link.
        "focus-within:outline-ring focus-within:outline-2 focus-within:outline-offset-2",
      ),
      highlighted: "border-primary/25 bg-accent border",
      elevated: "border-border bg-card border shadow-md",
      muted: "border-border bg-muted border",
    },
    padding: {
      none: "",
      compact: "gap-2 p-4",
      default: "gap-3 p-5 sm:p-6",
      spacious: "gap-4 p-6 sm:p-8",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "default",
  },
});

export interface CardProps
  extends ComponentProps<"div">, VariantProps<typeof cardVariants> {
  /** Render as a different element - `<article>` or `<li>` where semantics call for it. */
  readonly asChild?: boolean;
}

export function Card({
  className,
  variant,
  padding,
  asChild = false,
  ...props
}: CardProps) {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

/**
 * The card's heading. Defaults to `<h3>`; pass `as` when the surrounding
 * document outline needs a different level. Heading order matters more than
 * the visual size, which comes from the class either way.
 */
export interface CardTitleProps extends ComponentProps<"h3"> {
  readonly as?: "h2" | "h3" | "h4" | "h5";
}

export function CardTitle({
  className,
  as: Component = "h3",
  ...props
}: CardTitleProps) {
  return (
    <Component
      className={cn("text-h5 text-heading font-medium", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-body-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-body flex-1", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 pt-1", className)}
      {...props}
    />
  );
}

/**
 * A link that expands its hit area to the whole card.
 *
 * The pseudo-element covers the card, so a click anywhere follows the link
 * while the accessible name stays the link's own text. Anything that must stay
 * clickable inside the card (a secondary action) needs `relative z-1`.
 *
 * Use with `<Card variant="interactive">` and `asChild` for `next/link`.
 */
export function CardLink({
  className,
  asChild = false,
  ...props
}: ComponentProps<"a"> & { readonly asChild?: boolean }) {
  const Component = asChild ? Slot.Root : "a";
  return (
    <Component
      className={cn(
        "after:absolute after:inset-0 after:content-['']",
        // The card owns the focus ring via `focus-within`, so the link does
        // not draw a second one around its text.
        "focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
