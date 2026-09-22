import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A placeholder shaped like the content that is loading.
 *
 * Skeletons exist to prevent layout shift, so they should match the real
 * content's size - a three-line paragraph gets three lines, not one grey box.
 *
 * Individually decorative: the surrounding region carries the announcement
 * (see `SectionLoading`), so a screen reader hears "Loading appointments" once
 * instead of a dozen anonymous busy nodes.
 *
 * The shimmer stops under `prefers-reduced-motion`; the block stays visible.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-muted rounded-sm",
        "motion-safe:animate-shimmer motion-safe:bg-[linear-gradient(90deg,var(--muted)_25%,var(--color-secondary)_37%,var(--muted)_63%)] motion-safe:bg-[length:400%_100%]",
        className,
      )}
      {...props}
    />
  );
}

/** A block of text lines. The last line is short, as real text is. */
export function SkeletonText({
  lines = 3,
  className,
  ...props
}: ComponentProps<"div"> & { readonly lines?: number }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-4", index === lines - 1 && "w-3/5")}
        />
      ))}
    </div>
  );
}
