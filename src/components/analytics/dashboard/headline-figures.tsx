import {
  CalendarCheck2,
  CircleCheckBig,
  Percent,
  UserPlus,
} from "lucide-react";

import { KpiCard, KpiGrid } from "@/components/analytics/dashboard/kpi-card";
import {
  compareCounts,
  compareRates,
  readyPair,
} from "@/features/analytics/comparison";
import {
  ANALYTICS_STATE_COPY,
  DASHBOARD_COPY,
} from "@/features/analytics/content";
import {
  appointmentRates,
  formatCount,
  formatRate,
  rate,
} from "@/features/analytics/metrics";
import type {
  ClinicAnalytics,
  ClinicComparison,
} from "@/features/analytics/types";

/**
 * The dashboard's four headline cards, assembled from the reads the page
 * already made.
 *
 * Nothing here queries. The current figures come from `getClinicAnalytics`,
 * the earlier ones from `getClinicComparison`, and the sparklines from the
 * same trend the appointments chart draws — so a card cannot show a number
 * the panels below would contradict.
 */
export function ClinicHeadlineFigures({
  headingId,
  analytics,
  comparison,
}: {
  readonly headingId: string;
  readonly analytics: ClinicAnalytics;
  /** `null` when the earlier period is outside the reporting window. */
  readonly comparison: ClinicComparison | null;
}) {
  const { appointments, patients, trend, growth } = analytics;
  const basis = comparisonBasis(analytics.range.spanDays);
  const unavailable = ANALYTICS_STATE_COPY.unavailableInline;

  const appointmentPair = readyPair(
    appointments,
    comparison?.appointments ?? null,
  );
  const patientPair = readyPair(patients, comparison?.patients ?? null);

  const points = trend.status === "ready" ? trend.data : null;
  const counts = appointments.status === "ready" ? appointments.data : null;
  const cancellationRate = counts
    ? appointmentRates(counts).cancellationRate
    : null;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {DASHBOARD_COPY.kpiHeading}
      </h2>
      <KpiGrid labelledBy={headingId}>
        <KpiCard
          tone="forest"
          label={DASHBOARD_COPY.kpi.appointments}
          icon={<CalendarCheck2 />}
          value={counts ? formatCount(counts.total) : "—"}
          {...(counts ? {} : { note: unavailable })}
          comparison={
            appointmentPair
              ? compareCounts(
                  appointmentPair[0].total,
                  appointmentPair[1].total,
                )
              : null
          }
          comparisonBasis={basis}
          {...(points ? { trend: points.map((point) => point.total) } : {})}
        />

        <KpiCard
          tone="sky"
          label={DASHBOARD_COPY.kpi.newPatients}
          icon={<UserPlus />}
          value={
            patients.status === "ready"
              ? formatCount(patients.data.newPatients)
              : "—"
          }
          {...(patients.status === "ready" ? {} : { note: unavailable })}
          comparison={
            patientPair
              ? compareCounts(
                  patientPair[0].newPatients,
                  patientPair[1].newPatients,
                )
              : null
          }
          comparisonBasis={basis}
          {...(growth.status === "ready"
            ? { trend: growth.data.map((point) => point.newPatients) }
            : {})}
        />

        <KpiCard
          tone="clay"
          label={DASHBOARD_COPY.kpi.cancellationRate}
          icon={<Percent />}
          value={formatRate(cancellationRate)}
          {...(!counts
            ? { note: unavailable }
            : cancellationRate === null
              ? { note: ANALYTICS_STATE_COPY.noRateBasis }
              : {})}
          comparison={
            appointmentPair
              ? compareRates(
                  appointmentRates(appointmentPair[0]).cancellationRate,
                  appointmentRates(appointmentPair[1]).cancellationRate,
                  { lowerIsBetter: true },
                )
              : null
          }
          comparisonBasis={basis}
          {...(points
            ? {
                // Buckets that concluded nothing have no rate, so they are
                // left out of the line rather than drawn as 0%.
                trend: points.flatMap((point) => {
                  const bucketRate = rate(
                    point.cancelled,
                    point.completed + point.cancelled + point.noShow,
                  );
                  return bucketRate === null ? [] : [bucketRate];
                }),
              }
            : {})}
        />

        <KpiCard
          tone="gold"
          label={DASHBOARD_COPY.kpi.completed}
          icon={<CircleCheckBig />}
          value={counts ? formatCount(counts.completed) : "—"}
          {...(counts ? {} : { note: unavailable })}
          comparison={
            appointmentPair
              ? compareCounts(
                  appointmentPair[0].completed,
                  appointmentPair[1].completed,
                )
              : null
          }
          comparisonBasis={basis}
          {...(points ? { trend: points.map((point) => point.completed) } : {})}
        />
      </KpiGrid>
    </section>
  );
}

/** "vs. previous 30 days" — or "vs. previous day" for a single day. */
export function comparisonBasis(spanDays: number): string {
  const span = spanDays === 1 ? "day" : `${formatCount(spanDays)} days`;
  return `${DASHBOARD_COPY.comparisonPrefix} ${span}`;
}
