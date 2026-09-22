import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A major page section with the standard vertical rhythm.
 *
 * `section-y` is responsive by definition (56px / 80px / 112px), so a page
 * never repeats `py-14 md:py-20 lg:py-28`. Pair with `Container` for the
 * horizontal side.
 *
 * Renders a real `<section>`. Give it an `aria-labelledby` pointing at its
 * heading, or an `aria-label`, so it becomes a navigable landmark rather than
 * an anonymous region.
 */
export function Section({
  className,
  asChild = false,
  ...props
}: ComponentProps<"section"> & { readonly asChild?: boolean }) {
  const Component = asChild ? Slot.Root : "section";
  return <Component className={cn("section-y", className)} {...props} />;
}

/**
 * The heading block that opens a section: optional eyebrow, heading, optional
 * supporting sentence.
 *
 * The eyebrow is presentational text, not a heading - making it an `<h*>`
 * would put a meaningless entry in the document outline.
 */
export interface SectionHeaderProps extends Omit<
  ComponentProps<"div">,
  "title"
> {
  readonly eyebrow?: string;
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  /** Heading level. Choose by document outline, not by size. */
  readonly as?: "h1" | "h2" | "h3";
  /** Required when a `<Section>` references this heading with `aria-labelledby`. */
  readonly titleId?: string;
  readonly align?: "start" | "center";
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  as: Heading = "h2",
  titleId,
  align = "start",
  className,
  children,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
      {...props}
    >
      {eyebrow ? (
        <p className="text-caption text-eyebrow font-sans font-medium tracking-[0.12em] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <Heading
        id={titleId}
        className={cn(
          Heading === "h1"
            ? "text-h1"
            : Heading === "h2"
              ? "text-h2"
              : "text-h3",
          "text-heading font-normal",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            "text-body-lg text-prose measure",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}
