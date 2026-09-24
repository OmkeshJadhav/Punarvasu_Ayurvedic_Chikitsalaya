import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A quiet editorial link: label, drawn-in underline, arrow.
 *
 * The secondary action everywhere on the marketing pages. It exists so that
 * "Book a Consultation" can be the only filled button in a section - a hero
 * with two equally weighted buttons asks the visitor to choose, and a page
 * where every action is a button has no primary action at all.
 *
 * The underline draws in on hover and focus (`link-underline` in
 * `globals.css`) and the arrow moves a few pixels; both are transitions, so
 * reduced motion turns them into instant state changes rather than removing
 * the state. The 44px minimum height keeps it a real touch target even though
 * it looks like text.
 *
 * `tone="inverted"` is for dark bands, where the primary green would vanish.
 */
export interface TextLinkProps extends Omit<
  ComponentProps<typeof Link>,
  "children"
> {
  readonly children: string;
  readonly tone?: "default" | "inverted";
}

export function TextLink({
  children,
  tone = "default",
  className,
  ...props
}: TextLinkProps) {
  return (
    <Link
      className={cn(
        "group/link text-label inline-flex min-h-11 items-center gap-2 rounded-sm font-medium",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        tone === "default"
          ? "text-primary hover:text-primary-hover focus-visible:outline-ring"
          : "text-brand-surface-foreground",
        className,
      )}
      {...props}
    >
      <span className="link-underline group-hover/link:link-underline-active group-focus-visible/link:link-underline-active pb-0.5">
        {children}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="ease-natural size-4 transition-transform duration-(--duration-normal) group-hover/link:translate-x-1"
      />
    </Link>
  );
}
