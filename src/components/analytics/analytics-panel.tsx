import type { ReactNode } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { ANALYTICS_STATE_COPY } from "@/features/analytics/content";
import type { AnalyticsResult } from "@/features/analytics/types";

/**
 * One panel of a dashboard, and the four states it can be in.
 *
 * ## Why every panel goes through this
 *
 * `phase_16.md` section 63 asks that a dashboard not block entirely while one
 * report loads or fails, and section 96 asks that zero and missing be told
 * apart. Both are properties of *every* panel, so they are decided once here
 * rather than six times across three pages — which is also what stops the
 * fifth panel somebody adds rendering a failed read as a flat line at zero.
 *
 * ## The four states
 *
 * | State | What it means | What is shown |
 * | --- | --- | --- |
 * | `ready`, with data | The figures are these | The children |
 * | `ready`, but empty | Nothing happened in the period | The empty message |
 * | `unavailable` | We do not know | An error, and a way to retry |
 * | `forbidden` | Not for this reader | Nothing at all |
 *
 * `forbidden` renders nothing rather than a refusal notice, deliberately.
 * On every page in this product the panel's permission was already checked
 * before the read was made, so reaching it means the application's policy and
 * the database's gate disagree — which is logged where an operator will see
 * it. Telling the reader "you are not allowed this report" about a panel they
 * were never offered would be noise, and it would disclose that the report
 * exists (`phase_08.md` section 12).
 *
 * ## `isEmpty` is the caller's judgement
 *
 * Whether a period is empty is a question about the data's shape — zero
 * appointments, no practitioners with a roster — and only the caller knows
 * which field to look at. Passing it in keeps this component from guessing,
 * and keeps "0 appointments" from ever being rendered as "no data" or the
 * reverse.
 */
export function AnalyticsPanel<T>({
  result,
  isEmpty,
  emptyTitle,
  emptyDescription,
  retryHref,
  children,
}: {
  readonly result: AnalyticsResult<T>;
  readonly isEmpty?: (data: T) => boolean;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  /** Re-requesting the page is the retry: the read happens while it renders. */
  readonly retryHref: string;
  readonly children: (data: T) => ReactNode;
}) {
  if (result.status === "forbidden") return null;

  if (result.status === "unavailable") {
    return (
      <ErrorState
        title={ANALYTICS_STATE_COPY.errorTitle}
        description={ANALYTICS_STATE_COPY.errorDescription}
        action={
          <a
            href={retryHref}
            className="text-primary focus-visible:outline-ring inline-flex min-h-11 items-center font-sans font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {ANALYTICS_STATE_COPY.retryLabel}
          </a>
        }
      />
    );
  }

  if (isEmpty?.(result.data)) {
    return (
      <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-8 text-center font-sans">
        <span className="text-foreground block font-medium">
          {emptyTitle ?? ANALYTICS_STATE_COPY.emptyTitle}
        </span>
        <span className="text-body-sm mt-1 block">
          {emptyDescription ?? ANALYTICS_STATE_COPY.emptyDescription}
        </span>
      </p>
    );
  }

  return <>{children(result.data)}</>;
}
