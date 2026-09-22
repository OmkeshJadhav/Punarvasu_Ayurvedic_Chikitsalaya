import { TODAY_COPY } from "@/features/reception/content";
import type { DayOverview } from "@/features/reception/types";

/**
 * How much work the day holds.
 *
 * ## Four numbers, not a wall of tiles
 *
 * `phase_10.md` sections 2 and 56 are unusually direct about this: no KPI
 * cards, no charts, no gradients, no decorative widgets. So this is a row of
 * four counts in plain type on the page's own surface — no card, no border per
 * figure, no icon. It reads as a sentence about today rather than as a
 * dashboard.
 *
 * ## Every number is a count of rows on the page beneath it
 *
 * Section 6: do not invent numbers. These are derived from the same query that
 * produced the schedule below, so the two can never disagree — which is the
 * failure mode that actually bites, because a front desk that stops trusting
 * the count stops reading it.
 *
 * They are deliberately the *unfiltered* day. Filtering the list to one
 * practitioner must not make "three waiting to be confirmed" read as none.
 *
 * ## Nothing clinical, nothing financial
 *
 * Section 42 rules out revenue, outcomes and health statistics, and there is
 * nowhere here for one: the type this takes has seven integers on it and no
 * other field.
 *
 * ## Accessibility
 *
 * A description list, because that is what it is — a term and its value, four
 * times. The number is announced with its label rather than as a bare figure,
 * and nothing depends on colour.
 */
export function DayOverviewSummary({
  overview,
  headingId,
}: {
  readonly overview: DayOverview;
  readonly headingId?: string;
}) {
  const figures = [
    { label: TODAY_COPY.totalLabel, value: overview.total },
    {
      label: TODAY_COPY.awaitingLabel,
      value: overview.awaitingConfirmation,
      // The one figure that is a queue rather than a fact. It is emphasised
      // when there is something in it and plain when there is not, so "nothing
      // to do" does not look like an alert.
      emphasise: overview.awaitingConfirmation > 0,
    },
    { label: TODAY_COPY.checkedInLabel, value: overview.checkedIn },
    { label: TODAY_COPY.cancelledLabel, value: overview.cancelled },
  ];

  return (
    <dl
      aria-labelledby={headingId}
      className="border-border grid grid-cols-2 gap-x-6 gap-y-5 border-y py-5 sm:grid-cols-4"
    >
      {figures.map((figure) => (
        <div key={figure.label} className="min-w-0">
          <dt className="text-caption text-muted-foreground font-sans tracking-wide uppercase">
            {figure.label}
          </dt>
          <dd
            className={
              figure.emphasise
                ? "text-h3 text-primary font-sans font-semibold"
                : "text-h3 text-heading font-sans font-normal"
            }
          >
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
