import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  FileUp,
  Mail,
  ShieldCheck,
  Sprout,
  Trophy,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import {
  AnalyticsTable,
  ProportionCell,
} from "@/components/analytics/analytics-table";
import {
  CardIcon,
  DashboardCard,
  DashboardCardLink,
} from "@/components/analytics/dashboard/dashboard-card";
import {
  StackedBarChart,
  type ChartSeries,
} from "@/components/analytics/dashboard/stacked-bar-chart";
import { AppointmentReportExport } from "@/components/analytics/export-form";
import { Badge } from "@/components/ui/badge";
import type { TrendGranularity } from "@/config/analytics";
import {
  ANALYTICS_STATE_COPY,
  APPOINTMENT_PANEL_COPY,
  CLINICAL_ACTIVITY_PANEL_COPY,
  DASHBOARD_COPY,
  EXPORT_COPY,
  NOTIFICATION_PANEL_COPY,
  PATIENT_PANEL_COPY,
  WORKLOAD_PANEL_COPY,
} from "@/features/analytics/content";
import {
  CHANNEL_LABELS,
  DOCUMENT_TYPE_LABELS,
  NOTIFICATION_CATEGORY_LABELS,
  formatBucketLabel,
  labelFor,
} from "@/features/analytics/format";
import {
  appointmentRates,
  formatCount,
  formatRate,
} from "@/features/analytics/metrics";
import type {
  AnalyticsRange,
  AnalyticsResult,
  AppointmentCounts,
  ClinicalActivity,
  DocumentTypeVolume,
  NotificationDelivery,
  NotificationVolume,
  PatientGrowth,
  PatientGrowthPoint,
  PractitionerWorkload,
  TrendPoint,
} from "@/features/analytics/types";
import { cn } from "@/lib/utils/cn";

/**
 * The clinic dashboard's panels, in the redesign's card language.
 *
 * ## Same data, same states, new surface
 *
 * Every panel still renders through `AnalyticsPanel`, so "we could not load
 * this" and "nothing happened" stay two different screens (`phase_16.md`
 * section 96), and every figure still comes from the shared metric layer, so
 * a number here and the same number in the export cannot disagree (section
 * 94). What changed is the arrangement: progressive density, from the
 * headline cards through the charts to the tables.
 *
 * ## Aggregates here, names elsewhere
 *
 * Every panel in this file is built from the analytics domain, which carries
 * no patient identity by construction (`features/analytics/types.ts`). The
 * dashboard's patient-level detail — the appointment register, the patient
 * register and recent activity — lives in `registers.tsx`, reads from
 * `features/clinic-registers`, and sits behind its own audited,
 * administrator-only permission (`phase_16.md` section 35A).
 */

/* ------------------------------------------------------------------ */
/* Shared pieces                                                        */
/* ------------------------------------------------------------------ */

export interface StatFigure {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

/** A quiet row of secondary figures under a chart. */
export function StatRow({
  figures,
  className,
}: {
  readonly figures: readonly StatFigure[];
  readonly className?: string;
}) {
  return (
    // Four across only when the card itself is wide enough — a panel a
    // third of the dashboard wide gets two rows of two, whatever the screen.
    <div className={cn("@container", className)}>
      <dl className="bg-muted/60 grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg px-5 py-4 @lg:grid-cols-4">
        {figures.map((figure) => (
          <div
            key={figure.label}
            className="border-border-strong/60 min-w-0 @lg:[&:not(:first-child)]:border-l @lg:[&:not(:first-child)]:pl-5"
          >
            <dt className="text-body-sm text-muted-foreground font-sans">
              {figure.label}
            </dt>
            <dd className="mt-1">
              <span className="text-h4 text-heading block font-serif font-medium tabular-nums">
                {figure.value}
              </span>
              {figure.note ? (
                <span className="text-caption text-muted-foreground mt-0.5 block font-sans">
                  {figure.note}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The short explanatory sentence a panel ends with. */
function PanelNote({
  children,
  icon,
}: {
  readonly children: ReactNode;
  readonly icon?: ReactNode;
}) {
  return (
    <p className="text-caption text-muted-foreground measure mt-4 flex gap-2 font-sans">
      {icon ? (
        <span aria-hidden="true" className="mt-px shrink-0 [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}

/** A sub-heading inside a card: small, sans, spaced — not a second title. */
function PanelSubheading({
  id,
  children,
}: {
  readonly id?: string;
  readonly children: ReactNode;
}) {
  return (
    <h3
      id={id}
      className="text-caption text-muted-foreground font-sans font-semibold tracking-wide uppercase"
    >
      {children}
    </h3>
  );
}

/* ------------------------------------------------------------------ */
/* Appointments overview                                                */
/* ------------------------------------------------------------------ */

const OUTCOME_SERIES: readonly ChartSeries[] = [
  {
    key: "completed",
    label: DASHBOARD_COPY.series.completed,
    swatchClass: "bg-chart-1",
  },
  { key: "open", label: DASHBOARD_COPY.series.open, swatchClass: "bg-chart-2" },
  {
    key: "cancelled",
    label: DASHBOARD_COPY.series.cancelled,
    swatchClass: "bg-chart-4",
  },
  {
    key: "noShow",
    label: DASHBOARD_COPY.series.noShow,
    swatchClass: "bg-chart-3",
  },
];

/**
 * Appointments not yet concluded, per bucket.
 *
 * The trend RPC reports the total and the three outcomes; the remainder is
 * everything still in flight. Clamped at zero only as a guard — the counts
 * are checked for consistency before they reach a page.
 */
function openCount(point: TrendPoint): number {
  return Math.max(
    point.total - point.completed - point.cancelled - point.noShow,
    0,
  );
}

export function AppointmentsOverviewCard({
  titleId,
  counts,
  trend,
  granularity,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly counts: AnalyticsResult<AppointmentCounts>;
  readonly trend: AnalyticsResult<readonly TrendPoint[]>;
  readonly granularity: TrendGranularity;
  readonly retryHref: string;
  readonly className?: string;
}) {
  return (
    <DashboardCard
      titleId={titleId}
      title={DASHBOARD_COPY.overviewHeading}
      description={DASHBOARD_COPY.overviewDescription}
      icon={<CalendarDays />}
      className={className}
    >
      <AnalyticsPanel
        result={trend}
        retryHref={retryHref}
        isEmpty={(points) => points.every((point) => point.total === 0)}
        emptyDescription="No appointments were scheduled in the period you chose."
      >
        {(points) => (
          <StackedBarChart
            series={OUTCOME_SERIES}
            buckets={points.map((point) => ({
              key: point.bucketStart,
              label: formatBucketLabel(point.bucketStart, granularity),
              values: [
                point.completed,
                openCount(point),
                point.cancelled,
                point.noShow,
              ],
            }))}
            caption={`${APPOINTMENT_PANEL_COPY.trendHeading} by ${granularity}`}
            summaryNoun="appointments"
            legendNote={DASHBOARD_COPY.openSeriesNote}
          />
        )}
      </AnalyticsPanel>

      <div className="mt-2">
        <AnalyticsPanel
          result={counts}
          retryHref={retryHref}
          isEmpty={(data) => data.total === 0}
        >
          {(data) => {
            const rates = appointmentRates(data);
            const upcoming = data.total - data.eligible;
            const noBasis = ANALYTICS_STATE_COPY.noRateBasis;

            return (
              <div>
                <h3 className="sr-only">{DASHBOARD_COPY.outcomesHeading}</h3>
                <StatRow
                  figures={[
                    {
                      label: APPOINTMENT_PANEL_COPY.concludedLabel,
                      value: formatCount(data.eligible),
                    },
                    {
                      label: APPOINTMENT_PANEL_COPY.completionRateLabel,
                      value: formatRate(rates.completionRate),
                      ...(rates.completionRate === null
                        ? { note: noBasis }
                        : {}),
                    },
                    {
                      label: APPOINTMENT_PANEL_COPY.noShowRateLabel,
                      value: formatRate(rates.noShowRate),
                      ...(rates.noShowRate === null ? { note: noBasis } : {}),
                    },
                    {
                      label: APPOINTMENT_PANEL_COPY.upcomingLabel,
                      value: formatCount(upcoming),
                    },
                  ]}
                />
                <PanelNote>{APPOINTMENT_PANEL_COPY.denominatorNote}</PanelNote>
              </div>
            );
          }}
        </AnalyticsPanel>
      </div>
    </DashboardCard>
  );
}

/* ------------------------------------------------------------------ */
/* Practitioner workload                                                */
/* ------------------------------------------------------------------ */

const TOP_PRACTITIONERS = 5;

/**
 * The busiest practitioners, as a ranked list of bars.
 *
 * Ranked by appointment **volume**, which section 20 permits — an operational
 * figure — and nothing else. The bar is `aria-hidden`; the count beside it is
 * the value.
 */
export function BusiestPractitionersCard({
  titleId,
  workload,
  tableAnchor,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly workload: AnalyticsResult<readonly PractitionerWorkload[]>;
  /** The full table further down the page. */
  readonly tableAnchor: string;
  readonly retryHref: string;
  readonly className?: string;
}) {
  return (
    <DashboardCard
      titleId={titleId}
      title={DASHBOARD_COPY.workloadTopHeading}
      description={DASHBOARD_COPY.workloadTopDescription}
      icon={<Trophy />}
      className={className}
    >
      <AnalyticsPanel
        result={workload}
        retryHref={retryHref}
        isEmpty={(rows) => rows.every((row) => row.total === 0)}
        emptyTitle={WORKLOAD_PANEL_COPY.emptyTitle}
        emptyDescription={WORKLOAD_PANEL_COPY.emptyDescription}
      >
        {(rows) => {
          const ranked = [...rows]
            .filter((row) => row.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, TOP_PRACTITIONERS);
          const max = Math.max(...ranked.map((row) => row.total), 1);

          return (
            <div className="flex flex-1 flex-col justify-between gap-5">
              <ol className="flex flex-col gap-5">
                {ranked.map((row, index) => (
                  <li
                    key={row.practitionerId}
                    className="flex items-center gap-3.5"
                  >
                    {/* The rank. The list is ordered, so it is also announced. */}
                    <span
                      aria-hidden="true"
                      className="border-primary/15 bg-accent text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-full border font-sans text-sm font-semibold tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-body-sm text-foreground truncate font-sans font-medium">
                          {row.displayName}
                        </span>
                        <span className="text-body-sm text-heading shrink-0 font-sans font-semibold tabular-nums">
                          {formatCount(row.total)}
                        </span>
                      </div>
                      <span
                        aria-hidden="true"
                        className="bg-chart-track mt-2 block h-2 overflow-hidden rounded-full"
                      >
                        <span
                          className="bg-chart-1 block h-full rounded-full"
                          style={{ width: `${(row.total / max) * 100}%` }}
                        />
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <DashboardCardLink block href={`#${tableAnchor}`}>
                {DASHBOARD_COPY.seeAllWorkload}
              </DashboardCardLink>
            </div>
          );
        }}
      </AnalyticsPanel>
    </DashboardCard>
  );
}

/**
 * The full workload table. Section 69: exact values, in a table, for a
 * comparison across practitioners. Every column is a scheduling figure.
 */
export function WorkloadTableCard({
  titleId,
  workload,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly workload: AnalyticsResult<readonly PractitionerWorkload[]>;
  readonly retryHref: string;
  readonly className?: string;
}) {
  return (
    <DashboardCard
      titleId={titleId}
      title={DASHBOARD_COPY.workloadTableHeading}
      description={WORKLOAD_PANEL_COPY.description}
      icon={<ClipboardList />}
      className={className}
    >
      <AnalyticsPanel
        result={workload}
        retryHref={retryHref}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle={WORKLOAD_PANEL_COPY.emptyTitle}
        emptyDescription={WORKLOAD_PANEL_COPY.emptyDescription}
      >
        {(rows) => (
          <AnalyticsTable<PractitionerWorkload>
            embedded
            caption={WORKLOAD_PANEL_COPY.caption}
            rows={rows}
            rowKey={(row) => row.practitionerId}
            footnote={
              <span className="text-caption">
                {WORKLOAD_PANEL_COPY.utilizationNote}
              </span>
            }
            columns={[
              {
                header: WORKLOAD_PANEL_COPY.practitionerHeader,
                cell: (row) => (
                  <span className="flex items-center gap-2">
                    <span className="text-foreground font-medium whitespace-nowrap">
                      {row.displayName}
                    </span>
                    {row.isActive ? null : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </span>
                ),
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
    </DashboardCard>
  );
}

/* ------------------------------------------------------------------ */
/* Patients                                                             */
/* ------------------------------------------------------------------ */

const NEW_PATIENT_SERIES: readonly ChartSeries[] = [
  {
    key: "newPatients",
    label: PATIENT_PANEL_COPY.newLabel,
    swatchClass: "bg-chart-series",
  },
];

export function PatientsCard({
  titleId,
  summary,
  growth,
  granularity,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly summary: AnalyticsResult<PatientGrowth>;
  readonly growth: AnalyticsResult<readonly PatientGrowthPoint[]>;
  readonly granularity: TrendGranularity;
  readonly retryHref: string;
  readonly className?: string;
}) {
  return (
    <DashboardCard
      titleId={titleId}
      title={PATIENT_PANEL_COPY.heading}
      description={DASHBOARD_COPY.patientTrendHeading}
      icon={<UsersRound />}
      className={className}
    >
      <AnalyticsPanel
        result={growth}
        retryHref={retryHref}
        isEmpty={(points) => points.length === 0}
      >
        {(points) => (
          <StackedBarChart
            series={NEW_PATIENT_SERIES}
            buckets={points.map((point) => ({
              key: point.bucketStart,
              label: formatBucketLabel(point.bucketStart, granularity),
              values: [point.newPatients],
            }))}
            caption={PATIENT_PANEL_COPY.growthHeading}
            summaryNoun="new patients"
          />
        )}
      </AnalyticsPanel>

      <div className="mt-2">
        <AnalyticsPanel result={summary} retryHref={retryHref}>
          {(patients) => (
            <div>
              <StatRow
                figures={[
                  {
                    label: PATIENT_PANEL_COPY.newLabel,
                    value: formatCount(patients.newPatients),
                  },
                  {
                    label: PATIENT_PANEL_COPY.returningLabel,
                    value: formatCount(patients.returningPatients),
                  },
                  {
                    label: PATIENT_PANEL_COPY.activeLabel,
                    value: formatCount(patients.activePatients),
                  },
                  {
                    label: PATIENT_PANEL_COPY.totalLabel,
                    value: formatCount(patients.totalPatients),
                  },
                ]}
              />
              <PanelNote>{PATIENT_PANEL_COPY.note}</PanelNote>
            </div>
          )}
        </AnalyticsPanel>
      </div>
    </DashboardCard>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                        */
/* ------------------------------------------------------------------ */

function countPhrase(count: number, header: string): string {
  return `${formatCount(count)} ${header.toLowerCase()}`;
}

/**
 * One notification row: what, the counts in words, and the rate on the
 * right. A list rather than a seven-column table, because at this width the
 * table would scroll and the counts read as naturally as a sentence.
 */
function NotificationRow({
  icon,
  title,
  meta,
  counts,
  rate,
  rateLabel,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly meta?: string;
  readonly counts: ReactNode;
  readonly rate: string;
  readonly rateLabel: string;
}) {
  return (
    <li className="flex items-center gap-4 py-3.5">
      <span
        aria-hidden="true"
        className="bg-accent text-primary flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm text-foreground font-sans font-medium">
          {title}
          {meta ? (
            <span className="text-muted-foreground font-normal"> · {meta}</span>
          ) : null}
        </p>
        <p className="text-caption text-muted-foreground mt-0.5 font-sans">
          {counts}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-body-sm text-heading font-sans font-semibold tabular-nums">
          {rate}
        </p>
        <p className="text-caption text-muted-foreground font-sans">
          {rateLabel}
        </p>
      </div>
    </li>
  );
}

export function NotificationsCard({
  titleId,
  deliveries,
  volume,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly deliveries: AnalyticsResult<readonly NotificationDelivery[]>;
  readonly volume: AnalyticsResult<readonly NotificationVolume[]>;
  readonly retryHref: string;
  readonly className?: string;
}) {
  const copy = NOTIFICATION_PANEL_COPY;

  return (
    <DashboardCard
      titleId={titleId}
      title={copy.heading}
      icon={<Bell />}
      className={className}
    >
      <div className="flex flex-col gap-7">
        <section aria-labelledby={`${titleId}-sending`}>
          <PanelSubheading id={`${titleId}-sending`}>
            {DASHBOARD_COPY.notificationsSendingHeading}
          </PanelSubheading>
          <div className="mt-2">
            <AnalyticsPanel
              result={deliveries}
              retryHref={retryHref}
              isEmpty={(rows) => rows.length === 0}
              emptyTitle="No messages were sent in this period"
              emptyDescription="Punarvasu sends by email only when an email provider is configured. In-app notifications are counted below."
            >
              {(rows) => (
                <>
                  <ul className="divide-border divide-y">
                    {rows.map((row) => (
                      <NotificationRow
                        key={`${row.channel}:${row.provider}`}
                        icon={row.channel === "email" ? <Mail /> : <Bell />}
                        title={labelFor(CHANNEL_LABELS, row.channel)}
                        meta={row.provider}
                        counts={
                          <>
                            {countPhrase(row.sent, copy.sentHeader)}
                            {" · "}
                            <span
                              className={cn(
                                row.failed > 0 &&
                                  "text-destructive font-medium",
                              )}
                            >
                              {countPhrase(row.failed, copy.failedHeader)}
                            </span>
                            {" · "}
                            {countPhrase(row.pending, copy.pendingHeader)}
                            {" · "}
                            {countPhrase(row.skipped, copy.skippedHeader)}
                          </>
                        }
                        rate={formatRate(
                          row.acceptanceRate,
                          ANALYTICS_STATE_COPY.unavailableInline,
                        )}
                        rateLabel={copy.acceptanceHeader}
                      />
                    ))}
                  </ul>
                  <PanelNote>{copy.acceptanceNote}</PanelNote>
                </>
              )}
            </AnalyticsPanel>
          </div>
        </section>

        <section aria-labelledby={`${titleId}-in-app`}>
          <PanelSubheading id={`${titleId}-in-app`}>
            {DASHBOARD_COPY.notificationsInAppHeading}
          </PanelSubheading>
          <div className="mt-2">
            <AnalyticsPanel
              result={volume}
              retryHref={retryHref}
              isEmpty={(rows) => rows.length === 0}
              emptyTitle={copy.emptyTitle}
              emptyDescription={copy.emptyDescription}
            >
              {(rows) => (
                <>
                  <ul className="divide-border divide-y">
                    {rows.map((row) => (
                      <NotificationRow
                        key={row.category}
                        icon={<Bell />}
                        title={labelFor(
                          NOTIFICATION_CATEGORY_LABELS,
                          row.category,
                        )}
                        counts={
                          <>
                            {countPhrase(row.active, copy.activeHeader)}
                            {" · "}
                            {countPhrase(row.readCount, copy.readHeader)}
                            {" · "}
                            {countPhrase(row.scheduled, copy.scheduledHeader)}
                            {" · "}
                            {countPhrase(row.cancelled, copy.cancelledHeader)}
                          </>
                        }
                        rate={formatRate(
                          row.readRate,
                          ANALYTICS_STATE_COPY.unavailableInline,
                        )}
                        rateLabel={copy.readRateHeader}
                      />
                    ))}
                  </ul>
                  <PanelNote>{copy.volumeNote}</PanelNote>
                </>
              )}
            </AnalyticsPanel>
          </div>
        </section>
      </div>
    </DashboardCard>
  );
}

/* ------------------------------------------------------------------ */
/* Clinical activity                                                    */
/* ------------------------------------------------------------------ */

export function ClinicalActivityCard({
  titleId,
  activity,
  documentTypes,
  retryHref,
  className,
}: {
  readonly titleId: string;
  readonly activity: AnalyticsResult<ClinicalActivity>;
  readonly documentTypes: AnalyticsResult<readonly DocumentTypeVolume[]>;
  readonly retryHref: string;
  readonly className?: string;
}) {
  const copy = CLINICAL_ACTIVITY_PANEL_COPY;

  return (
    <DashboardCard
      titleId={titleId}
      title={copy.heading}
      description={copy.description}
      icon={<Activity />}
      className={className}
    >
      <AnalyticsPanel result={activity} retryHref={retryHref}>
        {(counts) => (
          <dl className="grid grid-cols-2 gap-3">
            {[
              {
                label: copy.prescriptionsLabel,
                value: counts.prescriptionsIssued,
                icon: <FileText />,
              },
              {
                label: copy.plansLabel,
                value: counts.treatmentPlansActivated,
                icon: <Sprout />,
              },
              {
                label: copy.consultationsLabel,
                value: counts.consultationsDocumented,
                icon: <ClipboardList />,
              },
              {
                label: copy.documentsLabel,
                value: counts.documentsUploaded,
                icon: <FileUp />,
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="bg-muted/60 flex min-w-0 flex-col gap-3 rounded-lg p-4"
              >
                <dt className="text-body-sm text-muted-foreground flex flex-col items-start gap-3 font-sans leading-snug">
                  <CardIcon className="bg-card size-9 [&_svg]:size-4">
                    {tile.icon}
                  </CardIcon>
                  {tile.label}
                </dt>
                <dd className="text-h3 text-heading font-serif leading-none tabular-nums">
                  {formatCount(tile.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </AnalyticsPanel>

      <section aria-labelledby={`${titleId}-documents`} className="mt-7">
        <PanelSubheading id={`${titleId}-documents`}>
          {DASHBOARD_COPY.documentsHeading}
        </PanelSubheading>
        <div className="mt-3">
          <AnalyticsPanel
            result={documentTypes}
            retryHref={retryHref}
            isEmpty={(rows) => rows.length === 0}
            emptyTitle="No documents uploaded in this period"
            emptyDescription="Nobody added a document to a patient's record during the period you chose."
          >
            {(rows) => {
              const max = Math.max(...rows.map((row) => row.uploaded), 1);
              return (
                <ul className="flex flex-col gap-3">
                  {rows.map((row) => (
                    <li key={row.documentType}>
                      <div className="text-body-sm flex items-baseline justify-between gap-3 font-sans">
                        <span className="text-foreground">
                          {labelFor(DOCUMENT_TYPE_LABELS, row.documentType)}
                        </span>
                        <span className="text-heading font-semibold tabular-nums">
                          {formatCount(row.uploaded)}
                        </span>
                      </div>
                      <span
                        aria-hidden="true"
                        className="bg-chart-track mt-1.5 block h-1.5 overflow-hidden rounded-full"
                      >
                        <span
                          className="bg-chart-2 block h-full rounded-full"
                          style={{ width: `${(row.uploaded / max) * 100}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              );
            }}
          </AnalyticsPanel>
        </div>
      </section>

      <PanelNote icon={<ShieldCheck />}>{copy.privacyNote}</PanelNote>
    </DashboardCard>
  );
}

/* ------------------------------------------------------------------ */
/* Export                                                               */
/* ------------------------------------------------------------------ */

export function ExportCard({
  titleId,
  range,
  practitionerId,
  className,
}: {
  readonly titleId: string;
  readonly range: AnalyticsRange;
  readonly practitionerId: string | undefined;
  readonly className?: string;
}) {
  return (
    <DashboardCard
      titleId={titleId}
      title={EXPORT_COPY.heading}
      icon={<Download />}
      className={className}
    >
      <AppointmentReportExport
        embedded
        range={range}
        practitionerId={practitionerId}
      />
    </DashboardCard>
  );
}
