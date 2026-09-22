import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { AnalyticsFreshness } from "@/components/analytics/analytics-freshness";
import {
  AppointmentSummaryPanel,
  AppointmentTrendPanel,
  PractitionerWorkloadPanel,
} from "@/components/analytics/appointment-panels";
import { PatientGrowthPanel } from "@/components/analytics/clinic-panels";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { MetricDefinitions } from "@/components/analytics/metric-definitions";
import {
  ANALYTICS_AREA,
  APPOINTMENT_PANEL_COPY,
  PATIENT_PANEL_COPY,
  WORKLOAD_PANEL_COPY,
} from "@/features/analytics/content";
import { analyticsHref, readParam } from "@/features/analytics/href";
import { getClinicAnalytics } from "@/features/analytics/queries";
import { resolveRangeRequest } from "@/features/analytics/ranges";
import { analyticsFilterSchema } from "@/features/analytics/validation";
import { listSchedulablePractitioners } from "@/features/appointments/queries";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: ANALYTICS_AREA.reception.title,
  robots: { index: false, follow: false },
};

const BASE_PATH = "/receptionist/analytics";

/**
 * The front desk's own numbers.
 *
 * ## Deliberately narrower than the administrator's
 *
 * Four panels, not seven. There is no notification delivery panel, no
 * clinical activity panel and no export, and none of them is hidden — the
 * page never reads them, `getClinicSystemAnalytics` is never called, and the
 * receptionist holds neither `analytics.read.clinic` nor `reports.export`, so
 * the database would refuse both anyway.
 *
 * `phase_16.md` section 6 gives the front desk "operational scheduling
 * analytics appropriate to their role", and `docs/SECURITY.md` section 6's
 * "operational, never clinical" is the line this page is drawn along: every
 * figure here is a count of appointments or of patient registrations, both of
 * which the receptionist already handles one at a time all day.
 *
 * ## The same panels, not a second implementation
 *
 * Every component on this page is the one the administrator's dashboard
 * uses, reading through the same metric layer. Section 94: the number a
 * receptionist quotes and the number an administrator quotes for the same
 * period must be the same number, and the surest way to get that is for there
 * to be one piece of code that produces it.
 */
export default async function ReceptionAnalyticsPage({
  searchParams,
}: PageProps<"/receptionist/analytics">) {
  await requirePermission("analytics.read.operational", BASE_PATH);

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

  const [analytics, practitioners] = await Promise.all([
    getClinicAnalytics(range, practitionerId),
    listSchedulablePractitioners({ onlineBookableOnly: false }),
  ]);

  const selfHref = analyticsHref(BASE_PATH, range, practitionerId);

  return (
    <Section aria-labelledby="reception-analytics-heading">
      <Container width="wide">
        <SectionHeader
          as="h1"
          titleId="reception-analytics-heading"
          title={ANALYTICS_AREA.reception.heading}
          description={ANALYTICS_AREA.reception.description}
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
          <section aria-labelledby="reception-analytics-appointments">
            <h2
              id="reception-analytics-appointments"
              className="text-h3 text-heading"
            >
              {APPOINTMENT_PANEL_COPY.heading}
            </h2>
            <div className="mt-6">
              <AppointmentSummaryPanel
                result={analytics.appointments}
                headingId="reception-analytics-appointments"
                retryHref={selfHref}
              />
            </div>
          </section>

          <section aria-labelledby="reception-analytics-trend">
            <h2 id="reception-analytics-trend" className="text-h3 text-heading">
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

          <section aria-labelledby="reception-analytics-workload">
            <h2
              id="reception-analytics-workload"
              className="text-h3 text-heading"
            >
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

          <section aria-labelledby="reception-analytics-patients">
            <h2
              id="reception-analytics-patients"
              className="text-h3 text-heading"
            >
              {PATIENT_PANEL_COPY.heading}
            </h2>
            <div className="mt-6">
              <PatientGrowthPanel
                summary={analytics.patients}
                growth={analytics.growth}
                granularity={range.granularity}
                headingId="reception-analytics-patients"
                retryHref={selfHref}
              />
            </div>
          </section>

          <MetricDefinitions
            keys={[
              "appointments",
              "completed",
              "cancelled",
              "noShow",
              "eligible",
              "completionRate",
              "cancellationRate",
              "noShowRate",
              "utilization",
              "newPatients",
              "returningPatients",
              "activePatients",
              "totalPatients",
            ]}
          />
        </div>
      </Container>
    </Section>
  );
}
