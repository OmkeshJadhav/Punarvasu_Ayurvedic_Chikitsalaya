import { DOCTOR_TODAY_COPY } from "@/features/doctor/content";
import type { DoctorDaySummary } from "@/features/doctor/types";

/**
 * How much of the day is left.
 *
 * ## Four numbers, not a wall of tiles
 *
 * `phase_11.md` sections 3 and 7 are direct about this: avoid excessive KPI
 * cards, and do not let the workspace feel like a generic SaaS analytics
 * dashboard. So this is a row of four counts in plain type on the page's own
 * surface — no card, no border per figure, no icon, no chart. It reads as a
 * sentence about today rather than as a dashboard.
 *
 * It is the same shape the front desk's `DayOverviewSummary` uses, and it is
 * a separate component rather than a shared one because the *figures* differ:
 * a receptionist counts check-ins and cancellations, a practitioner counts
 * how many people are still to be seen. Sharing it would mean one component
 * with a figure list passed in, which is a table of contents with extra
 * steps.
 *
 * ## Every number is a count of rows on the page beneath it
 *
 * Section 7 and example 6: only display values derived from actual data, and
 * never fabricate a patient count, a success rate or a clinical outcome.
 * These are derived from the same query that produced the schedule below, so
 * the two can never disagree — which is the failure that actually bites,
 * because a practitioner who stops trusting the count stops reading it.
 *
 * There is nowhere here for a clinical or financial figure: the type this
 * takes has four integers on it and no other field.
 *
 * ## Accessibility
 *
 * A description list, because that is what it is — a term and its value, four
 * times. The number is announced with its label rather than as a bare figure,
 * and nothing depends on colour.
 */
export function DoctorDaySummaryPanel({
  summary,
  headingId,
}: {
  readonly summary: DoctorDaySummary;
  readonly headingId?: string;
}) {
  const figures = [
    { label: DOCTOR_TODAY_COPY.totalLabel, value: summary.total },
    {
      label: DOCTOR_TODAY_COPY.remainingLabel,
      value: summary.remaining,
      // The one figure that is a queue rather than a fact. Emphasised when
      // there is something in it and plain when there is not, so "nothing
      // left to do" does not look like an alert.
      emphasise: summary.remaining > 0,
    },
    { label: DOCTOR_TODAY_COPY.completedLabel, value: summary.completed },
    {
      label: DOCTOR_TODAY_COPY.awaitingLabel,
      value: summary.awaitingConfirmation,
    },
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
