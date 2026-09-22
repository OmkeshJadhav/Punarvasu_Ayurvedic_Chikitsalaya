import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import { AnalyticsTable } from "@/components/analytics/analytics-table";
import { MetricList, MetricNote } from "@/components/analytics/metric-card";
import { TrendChart } from "@/components/analytics/trend-chart";
import {
  ANALYTICS_STATE_COPY,
  CLINICAL_ACTIVITY_PANEL_COPY,
  NOTIFICATION_PANEL_COPY,
  PATIENT_PANEL_COPY,
} from "@/features/analytics/content";
import {
  CHANNEL_LABELS,
  DOCUMENT_TYPE_LABELS,
  NOTIFICATION_CATEGORY_LABELS,
  formatBucketLabel,
  labelFor,
} from "@/features/analytics/format";
import { formatCount, formatRate } from "@/features/analytics/metrics";
import type {
  AnalyticsResult,
  ClinicalActivity,
  DocumentTypeVolume,
  NotificationDelivery,
  NotificationVolume,
  PatientGrowth,
  PatientGrowthPoint,
} from "@/features/analytics/types";
import type { TrendGranularity } from "@/config/analytics";

/**
 * The clinic-wide panels: patients, notifications, clinical activity.
 *
 * Each carries the sentence that keeps its figures from being misread. That
 * is not decoration — `phase_16.md` section 38 warns that a treatment plan
 * count invites an efficacy reading, section 41 warns that an accepted send
 * invites a delivery reading, and section 22 warns that a new-patient count
 * invites an account-creation reading. Each of those is a sentence on the
 * page rather than a comment in this file.
 */

export function PatientGrowthPanel({
  summary,
  growth,
  granularity,
  headingId,
  retryHref,
}: {
  readonly summary: AnalyticsResult<PatientGrowth>;
  readonly growth: AnalyticsResult<readonly PatientGrowthPoint[]>;
  readonly granularity: TrendGranularity;
  readonly headingId: string;
  readonly retryHref: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <AnalyticsPanel result={summary} retryHref={retryHref}>
        {(patients) => (
          <div>
            <MetricList
              headingId={headingId}
              figures={[
                {
                  label: PATIENT_PANEL_COPY.newLabel,
                  value: formatCount(patients.newPatients),
                  definitionKey: "newPatients",
                  emphasise: true,
                },
                {
                  label: PATIENT_PANEL_COPY.returningLabel,
                  value: formatCount(patients.returningPatients),
                  definitionKey: "returningPatients",
                },
                {
                  label: PATIENT_PANEL_COPY.activeLabel,
                  value: formatCount(patients.activePatients),
                  definitionKey: "activePatients",
                },
                {
                  label: PATIENT_PANEL_COPY.totalLabel,
                  value: formatCount(patients.totalPatients),
                  definitionKey: "totalPatients",
                },
              ]}
            />
            <MetricNote>{PATIENT_PANEL_COPY.note}</MetricNote>
          </div>
        )}
      </AnalyticsPanel>

      <AnalyticsPanel
        result={growth}
        retryHref={retryHref}
        isEmpty={(points) => points.length === 0}
      >
        {(points) => (
          <TrendChart
            points={points.map((point) => ({
              bucketStart: point.bucketStart,
              value: point.newPatients,
            }))}
            granularity={granularity}
            labelFor={formatBucketLabel}
            valueHeader={PATIENT_PANEL_COPY.newLabel}
            summaryLabel="new patients"
            caption={PATIENT_PANEL_COPY.growthHeading}
          />
        )}
      </AnalyticsPanel>
    </div>
  );
}

/**
 * Notification sending.
 *
 * Two tables, because Phase 15 has two genuinely different things to report:
 * an external **send attempt**, which can fail, and an **in-app
 * notification**, which is delivered by existing. Folding them together would
 * make in-app look like a channel that never sends anything.
 */
export function NotificationPanel({
  deliveries,
  volume,
  retryHref,
}: {
  readonly deliveries: AnalyticsResult<readonly NotificationDelivery[]>;
  readonly volume: AnalyticsResult<readonly NotificationVolume[]>;
  readonly retryHref: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h3 className="text-h4 text-heading font-sans">
          {NOTIFICATION_PANEL_COPY.deliveryHeading}
        </h3>

        <AnalyticsPanel
          result={deliveries}
          retryHref={retryHref}
          isEmpty={(rows) => rows.length === 0}
          emptyTitle="No messages were sent in this period"
          emptyDescription="Punarvasu sends by email only when an email provider is configured. In-app notifications are counted below."
        >
          {(rows) => (
            <AnalyticsTable<NotificationDelivery>
              caption={NOTIFICATION_PANEL_COPY.deliveryCaption}
              rows={rows}
              rowKey={(row) => `${row.channel}:${row.provider}`}
              footnote={NOTIFICATION_PANEL_COPY.acceptanceNote}
              columns={[
                {
                  header: NOTIFICATION_PANEL_COPY.channelHeader,
                  cell: (row) => labelFor(CHANNEL_LABELS, row.channel),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.providerHeader,
                  cell: (row) => row.provider,
                },
                {
                  header: NOTIFICATION_PANEL_COPY.pendingHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.pending),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.sentHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.sent),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.failedHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.failed),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.skippedHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.skipped),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.acceptanceHeader,
                  numeric: true,
                  cell: (row) =>
                    formatRate(
                      row.acceptanceRate,
                      ANALYTICS_STATE_COPY.unavailableInline,
                    ),
                },
              ]}
            />
          )}
        </AnalyticsPanel>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-h4 text-heading font-sans">
          {NOTIFICATION_PANEL_COPY.volumeHeading}
        </h3>

        <AnalyticsPanel
          result={volume}
          retryHref={retryHref}
          isEmpty={(rows) => rows.length === 0}
          emptyTitle={NOTIFICATION_PANEL_COPY.emptyTitle}
          emptyDescription={NOTIFICATION_PANEL_COPY.emptyDescription}
        >
          {(rows) => (
            <AnalyticsTable<NotificationVolume>
              caption={NOTIFICATION_PANEL_COPY.volumeCaption}
              rows={rows}
              rowKey={(row) => row.category}
              footnote={NOTIFICATION_PANEL_COPY.volumeNote}
              columns={[
                {
                  header: NOTIFICATION_PANEL_COPY.categoryHeader,
                  cell: (row) =>
                    labelFor(NOTIFICATION_CATEGORY_LABELS, row.category),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.scheduledHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.scheduled),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.activeHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.active),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.cancelledHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.cancelled),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.readHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.readCount),
                },
                {
                  header: NOTIFICATION_PANEL_COPY.readRateHeader,
                  numeric: true,
                  cell: (row) =>
                    formatRate(
                      row.readRate,
                      ANALYTICS_STATE_COPY.unavailableInline,
                    ),
                },
              ]}
            />
          )}
        </AnalyticsPanel>
      </div>
    </div>
  );
}

/**
 * Clinical activity — counts of records created, and nothing about them.
 *
 * The privacy note is rendered, not implied. Section 36 rules out diagnosis,
 * prevalence, effectiveness and outcome dashboards, and saying so on the page
 * is what stops somebody asking for one next quarter on the assumption that
 * it was simply not got round to.
 */
export function ClinicalActivityPanel({
  activity,
  documentTypes,
  headingId,
  retryHref,
}: {
  readonly activity: AnalyticsResult<ClinicalActivity>;
  readonly documentTypes: AnalyticsResult<readonly DocumentTypeVolume[]>;
  readonly headingId: string;
  readonly retryHref: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <AnalyticsPanel result={activity} retryHref={retryHref}>
        {(counts) => (
          <div>
            <MetricList
              headingId={headingId}
              figures={[
                {
                  label: CLINICAL_ACTIVITY_PANEL_COPY.prescriptionsLabel,
                  value: formatCount(counts.prescriptionsIssued),
                },
                {
                  label: CLINICAL_ACTIVITY_PANEL_COPY.plansLabel,
                  value: formatCount(counts.treatmentPlansActivated),
                },
                {
                  label: CLINICAL_ACTIVITY_PANEL_COPY.consultationsLabel,
                  value: formatCount(counts.consultationsDocumented),
                },
                {
                  label: CLINICAL_ACTIVITY_PANEL_COPY.documentsLabel,
                  value: formatCount(counts.documentsUploaded),
                },
              ]}
            />
            <MetricNote>{CLINICAL_ACTIVITY_PANEL_COPY.privacyNote}</MetricNote>
          </div>
        )}
      </AnalyticsPanel>

      <AnalyticsPanel
        result={documentTypes}
        retryHref={retryHref}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No documents uploaded in this period"
        emptyDescription="Nobody added a document to a patient's record during the period you chose."
      >
        {(rows) => (
          <div className="flex flex-col gap-4">
            <h3 className="text-h4 text-heading font-sans">
              {CLINICAL_ACTIVITY_PANEL_COPY.documentsHeading}
            </h3>
            <AnalyticsTable<DocumentTypeVolume>
              caption={CLINICAL_ACTIVITY_PANEL_COPY.documentsCaption}
              rows={rows}
              rowKey={(row) => row.documentType}
              columns={[
                {
                  header: CLINICAL_ACTIVITY_PANEL_COPY.documentTypeHeader,
                  cell: (row) =>
                    labelFor(DOCUMENT_TYPE_LABELS, row.documentType),
                },
                {
                  header: CLINICAL_ACTIVITY_PANEL_COPY.documentCountHeader,
                  numeric: true,
                  cell: (row) => formatCount(row.uploaded),
                },
              ]}
            />
          </div>
        )}
      </AnalyticsPanel>
    </div>
  );
}
