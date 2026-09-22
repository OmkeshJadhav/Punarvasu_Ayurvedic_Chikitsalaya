import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import {
  AnalyticsTable,
  ProportionCell,
} from "@/components/analytics/analytics-table";
import { MetricList, MetricNote } from "@/components/analytics/metric-card";
import { TrendChart } from "@/components/analytics/trend-chart";
import {
  APPOINTMENT_PANEL_COPY,
  ANALYTICS_STATE_COPY,
  WORKLOAD_PANEL_COPY,
} from "@/features/analytics/content";
import { formatBucketLabel } from "@/features/analytics/format";
import {
  appointmentRates,
  formatCount,
  formatMinutes,
  formatRate,
} from "@/features/analytics/metrics";
import type {
  AnalyticsResult,
  AppointmentCounts,
  PractitionerWorkload,
  TrendPoint,
} from "@/features/analytics/types";
import type { TrendGranularity } from "@/config/analytics";

/**
 * The appointment panels, shared by three dashboards.
 *
 * The clinic dashboard, the front desk's and the practitioner's own all
 * answer the same questions about appointments, and the only difference is
 * the scope the figures were read at. Writing them once means the number an
 * administrator sees and the number a practitioner sees are computed and
 * rendered by the same code, which is the other half of section 94's
 * consistency requirement — the first half being the shared metric layer.
 */

/**
 * The headline figures and the three rates.
 *
 * Nine figures rather than a wall: volume and its three outcomes, then the
 * three rates over the concluded denominator. Section 11's "small set of
 * high-value metrics followed by meaningful trends", and the denominator is
 * stated beneath them rather than left to be guessed.
 */
export function AppointmentSummaryPanel({
  result,
  headingId,
  retryHref,
}: {
  readonly result: AnalyticsResult<AppointmentCounts>;
  readonly headingId: string;
  readonly retryHref: string;
}) {
  return (
    <AnalyticsPanel
      result={result}
      retryHref={retryHref}
      isEmpty={(counts) => counts.total === 0}
      emptyTitle={ANALYTICS_STATE_COPY.emptyTitle}
      emptyDescription="No appointments were scheduled in the period you chose."
    >
      {(counts) => {
        const rates = appointmentRates(counts);
        const upcoming = counts.total - counts.eligible;

        return (
          <div>
            <MetricList
              headingId={headingId}
              figures={[
                {
                  label: APPOINTMENT_PANEL_COPY.totalLabel,
                  value: formatCount(counts.total),
                  definitionKey: "appointments",
                  emphasise: true,
                },
                {
                  label: APPOINTMENT_PANEL_COPY.completedLabel,
                  value: formatCount(counts.completed),
                  definitionKey: "completed",
                },
                {
                  label: APPOINTMENT_PANEL_COPY.cancelledLabel,
                  value: formatCount(counts.cancelled),
                  definitionKey: "cancelled",
                },
                {
                  label: APPOINTMENT_PANEL_COPY.noShowLabel,
                  value: formatCount(counts.noShow),
                  definitionKey: "noShow",
                },
              ]}
            />

            <MetricList
              figures={[
                {
                  label: APPOINTMENT_PANEL_COPY.concludedLabel,
                  value: formatCount(counts.eligible),
                  definitionKey: "eligible",
                },
                {
                  label: APPOINTMENT_PANEL_COPY.completionRateLabel,
                  value: formatRate(rates.completionRate),
                  definitionKey: "completionRate",
                  ...(rates.completionRate === null
                    ? { note: ANALYTICS_STATE_COPY.noRateBasis }
                    : {}),
                },
                {
                  label: APPOINTMENT_PANEL_COPY.cancellationRateLabel,
                  value: formatRate(rates.cancellationRate),
                  definitionKey: "cancellationRate",
                  ...(rates.cancellationRate === null
                    ? { note: ANALYTICS_STATE_COPY.noRateBasis }
                    : {}),
                },
                {
                  label: APPOINTMENT_PANEL_COPY.noShowRateLabel,
                  value: formatRate(rates.noShowRate),
                  definitionKey: "noShowRate",
                  ...(rates.noShowRate === null
                    ? { note: ANALYTICS_STATE_COPY.noRateBasis }
                    : {}),
                },
              ]}
            />

            <MetricNote>
              {APPOINTMENT_PANEL_COPY.denominatorNote}
              {upcoming > 0
                ? ` ${formatCount(upcoming)} in this period ${
                    upcoming === 1 ? "is" : "are"
                  } still ahead of the clinic.`
                : ""}
            </MetricNote>
          </div>
        );
      }}
    </AnalyticsPanel>
  );
}

/** The trend, with the outcome split available exactly in its table. */
export function AppointmentTrendPanel({
  result,
  granularity,
  retryHref,
}: {
  readonly result: AnalyticsResult<readonly TrendPoint[]>;
  readonly granularity: TrendGranularity;
  readonly retryHref: string;
}) {
  return (
    <AnalyticsPanel
      result={result}
      retryHref={retryHref}
      isEmpty={(points) => points.length === 0}
    >
      {(points) => (
        <TrendChart
          points={points.map((point) => ({
            bucketStart: point.bucketStart,
            value: point.total,
          }))}
          granularity={granularity}
          labelFor={formatBucketLabel}
          valueHeader={APPOINTMENT_PANEL_COPY.totalLabel}
          summaryLabel="appointments"
          caption={`${APPOINTMENT_PANEL_COPY.trendHeading} by ${granularity}`}
          extraColumns={[
            {
              header: APPOINTMENT_PANEL_COPY.completedLabel,
              values: points.map((point) => point.completed),
            },
            {
              header: APPOINTMENT_PANEL_COPY.cancelledLabel,
              values: points.map((point) => point.cancelled),
            },
            {
              header: APPOINTMENT_PANEL_COPY.noShowLabel,
              values: points.map((point) => point.noShow),
            },
          ]}
        />
      )}
    </AnalyticsPanel>
  );
}

/**
 * Practitioner workload — a table, not a chart.
 *
 * Section 69: for exact values, a table is often more useful than a chart
 * alone, and a comparison across a handful of practitioners is exactly that
 * case. Section 20 permits comparing **operational** metrics and forbids
 * ranking by anything clinical; every column here is a scheduling figure, and
 * there is no clinical column in the type to add one from.
 *
 * Utilisation is a proportion with its number printed beside it, so the bar
 * is decoration that can be removed without losing the value.
 */
export function PractitionerWorkloadPanel({
  result,
  retryHref,
}: {
  readonly result: AnalyticsResult<readonly PractitionerWorkload[]>;
  readonly retryHref: string;
}) {
  return (
    <AnalyticsPanel
      result={result}
      retryHref={retryHref}
      isEmpty={(workload) => workload.length === 0}
      emptyTitle={WORKLOAD_PANEL_COPY.emptyTitle}
      emptyDescription={WORKLOAD_PANEL_COPY.emptyDescription}
    >
      {(workload) => (
        <AnalyticsTable<PractitionerWorkload>
          caption={WORKLOAD_PANEL_COPY.caption}
          rows={workload}
          rowKey={(row) => row.practitionerId}
          footnote={WORKLOAD_PANEL_COPY.utilizationNote}
          columns={[
            {
              header: WORKLOAD_PANEL_COPY.practitionerHeader,
              cell: (row) => row.displayName,
            },
            {
              header: WORKLOAD_PANEL_COPY.totalHeader,
              numeric: true,
              cell: (row) => formatCount(row.total),
            },
            {
              header: WORKLOAD_PANEL_COPY.completedHeader,
              numeric: true,
              cell: (row) => formatCount(row.completed),
            },
            {
              header: WORKLOAD_PANEL_COPY.cancelledHeader,
              numeric: true,
              cell: (row) => formatCount(row.cancelled),
            },
            {
              header: WORKLOAD_PANEL_COPY.noShowHeader,
              numeric: true,
              cell: (row) => formatCount(row.noShow),
            },
            {
              header: WORKLOAD_PANEL_COPY.utilizationHeader,
              numeric: true,
              cell: (row) => (
                <ProportionCell
                  value={row.utilizationRate}
                  label={formatRate(row.utilizationRate)}
                  fallback={
                    row.availableMinutes === 0
                      ? "No working hours"
                      : ANALYTICS_STATE_COPY.unavailableInline
                  }
                />
              ),
            },
          ]}
        />
      )}
    </AnalyticsPanel>
  );
}

/** A practitioner's own booked-against-available time. */
export function UtilizationSummary({
  bookedMinutes,
  availableMinutes,
  utilizationRate,
}: {
  readonly bookedMinutes: number;
  readonly availableMinutes: number;
  readonly utilizationRate: number | null;
}) {
  return (
    <div>
      <MetricList
        columns={3}
        figures={[
          {
            label: "Booked time",
            value: formatMinutes(bookedMinutes),
          },
          {
            label: "Working time",
            value: formatMinutes(availableMinutes),
          },
          {
            label: WORKLOAD_PANEL_COPY.utilizationHeader,
            value: formatRate(utilizationRate),
            definitionKey: "utilization",
            emphasise: utilizationRate !== null,
            ...(utilizationRate === null
              ? { note: "No working hours in this period" }
              : {}),
          },
        ]}
      />
      <MetricNote>{WORKLOAD_PANEL_COPY.utilizationNote}</MetricNote>
    </div>
  );
}
