import { TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * An inline error state for a region that failed to load.
 *
 * Three parts, always: a meaningful heading, an explanation in plain language,
 * and a way to recover.
 *
 *   Something went wrong
 *   We couldn't load your appointments.
 *   [Try Again]
 *
 * Never put a raw failure here. Stack traces, database messages, internal ids
 * and HTTP status codes are for the server log; the user gets a sentence and a
 * button (`AGENTS.md` section 18). `reference` is the one exception: the
 * correlation id is opaque, carries no patient data, and is what support needs
 * to find the matching log entry.
 *
 * For a whole page that failed, use `StatusMessage` instead - it owns the
 * `<main>` landmark and the page heading.
 */
export interface ErrorStateProps extends Omit<ComponentProps<"div">, "title"> {
  /** Defaults to "Something went wrong". */
  readonly title?: string;
  /** What failed, from the user's point of view. Never the technical cause. */
  readonly description: string;
  /** A retry button, or a link to somewhere that works. */
  readonly action?: ReactNode;
  /** An opaque correlation id the user can quote to the clinic. */
  readonly reference?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  reference,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive-border bg-destructive-surface flex flex-col items-center gap-3 rounded-lg border px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      <TriangleAlert
        aria-hidden="true"
        className="text-destructive size-6 shrink-0"
      />
      <p className="text-h5 text-heading font-medium">{title}</p>
      <p className="text-body-sm text-muted-foreground measure">
        {description}
      </p>
      {action ? <div className="mt-1">{action}</div> : null}
      {reference ? (
        <p className="text-caption text-muted-foreground mt-1">
          Reference: <span className="font-mono">{reference}</span>
        </p>
      ) : null}
    </div>
  );
}
