import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { AnalyticsFreshness } from "@/components/analytics/analytics-freshness";
import {
  AppointmentSummaryPanel,
  AppointmentTrendPanel,
  PractitionerWorkloadPanel,
} from "@/components/analytics/appointment-panels";
import {
  ClinicalActivityPanel,
  NotificationPanel,
  PatientGrowthPanel,
} from "@/components/analytics/clinic-panels";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { AppointmentReportExport } from "@/components/analytics/export-form";
import { MetricDefinitions } from "@/components/analytics/metric-definitions";
import {
  ANALYTICS_AREA,
  APPOINTMENT_PANEL_COPY,
  CLINICAL_ACTIVITY_PANEL_COPY,
  EXPORT_COPY,
  NOTIFICATION_PANEL_COPY,
  PATIENT_PANEL_COPY,
  WORKLOAD_PANEL_COPY,
} from "@/features/analytics/content";
import {
  getClinicAnalytics,
  getClinicSystemAnalytics,
} from "@/features/analytics/queries";
import { resolveRangeRequest } from "@/features/analytics/ranges";
import { analyticsFilterSchema } from "@/features/analytics/validation";
import { listSchedulablePractitioners } from "@/features/appointments/queries";
import { requirePermission } from "@/lib/authorization/guards";

import { analyticsHref, readParam } from "@/features/analytics/href";

export const metadata: Metadata = {
  title: ANALYTICS_AREA.clinic.title,
  robots: { index: false, follow: false },
};

const BASE_PATH = "/admin/analytics";

/**
 * The clinic dashboard.
 *
 * ## Six panels, in the order somebody asks the questions
 *
 * `phase_16.md` section 124's list is the page's outline: how many
 * appointments, how many completed, cancelled, no-show; how is volume
 * trending; how is practitioner workload trending; how many new patients; how
 * are notifications being delivered. Clinical activity is last, because it is
 * the one an administrator consults least and the one the spec is most
 * cautious about.
 *
 * ## Two permissions, two reads
 *
 * The page checks `analytics.read.clinic`, and then makes two separate
 * authorized reads: `getClinicAnalytics` needs
 * `analytics.read.operational` and `getClinicSystemAnalytics` needs
 * `analytics.read.clinic`. Keeping them apart is what lets the front desk
 * reuse the first without being one boolean away from the second.
 *
 * ## The filters are validated, not trusted
 *
 * They arrive in the URL, so they go through `analyticsFilterSchema` before
 * anything is read, and then through `resolveRangeRequest`, and then the
 * database bounds the range a third time. Note what that is protecting
 * against: a broken page and an unbounded query, not an escalation — an
 * administrator may already see all of this, so no value of these can widen
 * anything.
 *
 * A rejected period is **reported**, not silently replaced. Showing this
 * month's numbers under last year's heading is the kind of quiet wrongness
 * that makes somebody act on the wrong figure.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: PageProps<"/admin/analytics">) {
  await requirePermission("analytics.read.clinic", BASE_PATH);

  const query = await searchParams;
  const parsed = analyticsFilterSchema.safeParse({
    ...(readParam(query["preset"]) !== undefined
      ? { preset: readParam(query["preset"]) }
      : {}),
    ...(readParam(query["from"]) !== undefined
      ? { from: readParam(query["from"]) }
      : {}),
    ...(readParam(query["to"]) !== undefined
      ? { to: readParam(query["to"]) }
      : {}),
    ...(readParam(query["practitionerId"]) !== undefined
      ? { practitionerId: readParam(query["practitionerId"]) }
      : {}),
  });

  const filters = parsed.success ? parsed.data : {};
  const { range, fellBack, problem } = resolveRangeRequest(filters);
  const practitionerId = filters.practitionerId;

  const [analytics, system, practitioners] = await Promise.all([
    getClinicAnalytics(range, practitionerId),
    getClinicSystemAnalytics(range),
    listSchedulablePractitioners({ onlineBookableOnly: false }),
  ]);

  const selfHref = analyticsHref(BASE_PATH, range, practitionerId);

  return (
    <Section aria-labelledby="admin-analytics-heading">
      <Container width="wide">
        <SectionHeader
          as="h1"
          titleId="admin-analytics-heading"
          title={ANALYTICS_AREA.clinic.heading}
          description={ANALYTICS_AREA.clinic.description}
        />

        <div className="mt-8 flex flex-col gap-4">
          <DateRangeFilter
            range={range}
            practitionerId={practitionerId}
            practitioners={practitioners.map((practitioner) => ({
              id: practitioner.id,
              displayName: practitioner.displayName,
            }))}
            basePath={BASE_PATH}
            fellBack={fellBack}
            problem={problem}
          />
          <AnalyticsFreshness
            generatedAt={analytics.generatedAt}
            refreshHref={selfHref}
          />
        </div>

        <div className="mt-12 flex flex-col gap-14">
          <section aria-labelledby="admin-analytics-appointments">
            <h2
              id="admin-analytics-appointments"
              className="text-h3 text-heading"
            >
              {APPOINTMENT_PANEL_COPY.heading}
            </h2>
            <div className="mt-6">
              <AppointmentSummaryPanel
                result={analytics.appointments}
                headingId="admin-analytics-appointments"
                retryHref={selfHref}
              />
            </div>
          </section>

          <section aria-labelledby="admin-analytics-trend">
            <h2 id="admin-analytics-trend" className="text-h3 text-heading">
              {APPOINTMENT_PANEL_COPY.trendHeading}
            </h2>
            <p className="text-body-sm text-muted-foreground measure mt-2 font-sans">
              {APPOINTMENT_PANEL_COPY.trendDescription}
            </p>
            <div className="mt-6">
              <AppointmentTrendPanel
                result={analytics.trend}
                granularity={range.granularity}
                retryHref={selfHref}
              />
            </div>
          </section>

          <section aria-labelledby="admin-analytics-workload">
            <h2 id="admin-analytics-workload" className="text-h3 text-heading">
              {WORKLOAD_PANEL_COPY.heading}
            </h2>
            <p className="text-body-sm text-muted-foreground measure mt-2 font-sans">
              {WORKLOAD_PANEL_COPY.description}
            </p>
            <div className="mt-6">
              <PractitionerWorkloadPanel
                result={analytics.workload}
                retryHref={selfHref}
              />
            </div>
          </section>

          <section aria-labelledby="admin-analytics-patients">
            <h2 id="admin-analytics-patients" className="text-h3 text-heading">
              {PATIENT_PANEL_COPY.heading}
            </h2>
            <div className="mt-6">
              <PatientGrowthPanel
                summary={analytics.patients}
                growth={analytics.growth}
                granularity={range.granularity}
                headingId="admin-analytics-patients"
                retryHref={selfHref}
              />
            </div>
          </section>

          <section aria-labelledby="admin-analytics-notifications">
            <h2
              id="admin-analytics-notifications"
              className="text-h3 text-heading"
            >
              {NOTIFICATION_PANEL_COPY.heading}
            </h2>
            <div className="mt-6">
              <NotificationPanel
                deliveries={system.deliveries}
                volume={system.notifications}
                retryHref={selfHref}
              />
            </div>
          </section>

          <section aria-labelledby="admin-analytics-clinical">
            <h2 id="admin-analytics-clinical" className="text-h3 text-heading">
              {CLINICAL_ACTIVITY_PANEL_COPY.heading}
            </h2>
            <p className="text-body-sm text-muted-foreground measure mt-2 font-sans">
              {CLINICAL_ACTIVITY_PANEL_COPY.description}
            </p>
            <div className="mt-6">
              <ClinicalActivityPanel
                activity={system.clinicalActivity}
                documentTypes={system.documentTypes}
                headingId="admin-analytics-clinical"
                retryHref={selfHref}
              />
            </div>
          </section>

          <section aria-labelledby="admin-analytics-export">
            <h2 id="admin-analytics-export" className="text-h3 text-heading">
              {EXPORT_COPY.heading}
            </h2>
            <div className="mt-6">
              <AppointmentReportExport
                range={range}
                practitionerId={practitionerId}
              />
            </div>
          </section>

          <MetricDefinitions />
        </div>
      </Container>
    </Section>
  );
}
