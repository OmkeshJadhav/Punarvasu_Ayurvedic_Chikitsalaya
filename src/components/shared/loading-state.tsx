import type { ComponentProps, ReactNode } from "react";

import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";

/**
 * Loading states.
 *
 * Three shapes, in order of preference:
 *
 *   `SectionLoading`  wraps skeletons that mirror the eventual layout. The
 *                     default. Prevents layout shift and tells the user what is
 *                     coming.
 *   `CardListLoading` a ready-made skeleton for the card list that most
 *                     Punarvasu screens show.
 *   `PageLoading`     a centred spinner. Only where the shape of the incoming
 *                     content is genuinely unknown.
 *
 * All three announce themselves once, politely. The skeletons inside are
 * `aria-hidden`, so assistive technology hears "Loading appointments" rather
 * than a list of empty boxes.
 *
 * Never render the bare word "Loading..." on its own - it says nothing about
 * what is loading and leaves a blank page behind it.
 */

export interface LoadingRegionProps extends ComponentProps<"div"> {
  /**
   * What is being loaded, as a sentence a person would say:
   * "Loading your appointments". Announced, not displayed.
   */
  readonly label: string;
  readonly children?: ReactNode;
}

export function SectionLoading({
  label,
  className,
  children,
  ...props
}: LoadingRegionProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("w-full", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Skeletons in the shape of a card list: heading, two lines, a footer chip. */
export function CardListLoading({
  label,
  count = 3,
  className,
  ...props
}: Omit<LoadingRegionProps, "children"> & { readonly count?: number }) {
  return (
    <SectionLoading label={label} className={className} {...props}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="border-border flex flex-col gap-3 rounded-lg border p-5 sm:p-6"
          >
            <Skeleton className="h-5 w-2/5" />
            <SkeletonText lines={2} />
            <Skeleton className="mt-1 h-6 w-24 rounded-sm" />
          </div>
        ))}
      </div>
    </SectionLoading>
  );
}

/**
 * A centred spinner for a whole page or a route-level `loading.tsx`.
 *
 * `min-h` rather than a fixed height so it fills the space it is given without
 * forcing the page taller than the viewport.
 */
export function PageLoading({
  label,
  className,
  ...props
}: Omit<LoadingRegionProps, "children">) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex min-h-64 flex-1 flex-col items-center justify-center gap-3 px-5 py-24",
        className,
      )}
      {...props}
    >
      <Spinner className="text-primary size-8" />
      <p className="text-body-sm text-muted-foreground">{label}</p>
    </div>
  );
}
