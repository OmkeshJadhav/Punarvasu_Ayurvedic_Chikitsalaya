import Link from "next/link";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FRESHNESS_COPY } from "@/features/analytics/content";
import { formatClinicTime } from "@/features/appointments/time";

/**
 * When these figures were read, and how to read them again.
 *
 * ## The claim is exact
 *
 * `phase_16.md` sections 75 and 76 ask for freshness to be communicated and
 * section 75 warns specifically against claiming realtime accuracy for data
 * that is cached or aggregated. This dashboard caches nothing between
 * requests (`features/analytics/queries.ts` explains why), so the honest
 * claim is the strongest available one: these figures were read from the
 * clinic's records at this time, and the note says so in words.
 *
 * If a later phase adds a materialized view, this component is where the
 * label changes — and section 78 says it must, because presenting a stale
 * aggregate as live is the failure that makes a dashboard untrustworthy.
 *
 * ## Refresh is a link
 *
 * The read happens while the page renders, so re-requesting the page *is* the
 * refresh. A link rather than a button: it needs no JavaScript, it is
 * middle-clickable, and it behaves the way a browser control should. Section
 * 32 does not require realtime, and nothing here polls.
 *
 * The time is rendered in the clinic's timezone through Phase 09's formatter,
 * for the same reason every other time in this product is: staff reading a
 * clinic dashboard mean the clinic's clock.
 */
export function AnalyticsFreshness({
  generatedAt,
  refreshHref,
}: {
  readonly generatedAt: string;
  readonly refreshHref: string;
}) {
  const readAt = new Date(generatedAt);
  const time = Number.isNaN(readAt.getTime()) ? null : formatClinicTime(readAt);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-body-sm text-muted-foreground font-sans">
        {time ? `${FRESHNESS_COPY.prefix} at ${time}` : FRESHNESS_COPY.prefix}
        {". "}
        <span className="sr-only">{FRESHNESS_COPY.note}</span>
      </p>

      <Button asChild variant="secondary" size="sm">
        <Link href={refreshHref}>
          <RotateCw aria-hidden="true" className="size-4" />
          {FRESHNESS_COPY.refreshLabel}
        </Link>
      </Button>
    </div>
  );
}
