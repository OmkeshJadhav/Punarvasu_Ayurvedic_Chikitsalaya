import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

/**
 * The page container.
 *
 * Centres content, caps its width and applies the standard responsive gutter,
 * so no page hand-rolls `mx-auto max-w-... px-5 sm:px-8`.
 *
 * Widths
 *   prose    720px  long-form copy and articles
 *   content  1120px standard pages and dashboards
 *   wide     1280px marketing sections and gallery layouts
 *   full     no cap, gutter only - for a full-bleed band whose *inner* content
 *            uses its own container
 *
 * Marketing pages breathe wider than workspaces. That is deliberate: a
 * dashboard at 1280px wastes the eye's travel, and a hero at 1120px feels
 * cramped on a large display.
 */
const containerVariants = cva("mx-auto w-full gutter-x", {
  variants: {
    width: {
      prose: "max-w-prose",
      content: "max-w-content",
      wide: "max-w-wide",
      full: "max-w-none",
    },
  },
  defaultVariants: { width: "content" },
});

export interface ContainerProps
  extends ComponentProps<"div">, VariantProps<typeof containerVariants> {
  /** Render as the child element - `<main>`, `<section>`, `<header>`. */
  readonly asChild?: boolean;
}

export function Container({
  className,
  width,
  asChild = false,
  ...props
}: ContainerProps) {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={cn(containerVariants({ width }), className)}
      {...props}
    />
  );
}

export { containerVariants };
