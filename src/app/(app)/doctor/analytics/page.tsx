import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { AnalyticsFreshness } from "@/components/analytics/analytics-freshness";
import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import {
  AppointmentSummaryPanel,
  AppointmentTrendPanel,
  UtilizationSummary,
} from "@/components/analytics/appointment-panels";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { MetricDefinitions } from "@/components/analytics/metric-definitions";
import {
  ANALYTICS_AREA,
  APPOINTMENT_PANEL_COPY,
  WORKLOAD_PANEL_COPY,
} from "@/features/analytics/content";
import { analyticsHref, readParam } from "@/features/analytics/href";
import { getPracticeAnalytics } from "@/features/analytics/queries";
import { resolveRangeRequest } from "@/features/analytics/ranges";
import { practiceAnalyticsFilterSchema } from "@/features/analytics/validation";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: ANALYTICS_AREA.practice.title,
  robots: { index: false, follow: false },
};

const BASE_PATH = "/doctor/analytics";

/**
 * A practitioner's own practice.
 *
 * ## There is no practitioner filter, and that is the point
 *
 * `practiceAnalyticsFilterSchema` has no practitioner field, the three RPCs
 * this page calls have no practitioner argument, and `DateRangeFilter` is
 * rendered without a practitioner list. The scope is resolved from
 * `auth.uid()` inside `assert_care_practitioner()` — Phase 11's gate, which
 * also refuses a doctor account that is not on the scheduling roster.
 *
 * So `phase_16.md` section 101's "change the practitionerId" has nothing to
 * change and section 102's "Doctor A → Doctor B metrics" has no request that
 * expresses it. That is a stronger guarantee than a check, and it is the same
 * shape Phases 11 to 14 used for every practitioner-scoped read.
 *
 * ## What is absent, and why
 *
 * No clinic total, no colleague's figures, no practitioner comparison table,
 * no notification delivery, no clinical activity and no export. Section 54:
 * a doctor sees their own permitted scope, not everybody's, unless explicitly
 * authorized — and nobody has authorized it.
 *
 * There is also nothing clinical here about the practitioner's own work
 * either: volume, outcomes and time. Section 19 permits exactly those and
 * warns against clinical performance metrics that have not been defined, and
 * section 20 rules out ranking by prescribing or by outcome. There is no
 * field in any of these types for one.
 */
export default async function DoctorAnalyticsPage({
  searchParams,
}: PageProps<"/doctor/analytics">) {
  await requirePermission("analytics.read.own_practice", BASE_PATH);

  const query = await searchParams;
  const parsed = practiceAnalyticsFilterSchema.safeParse({
    ...(readParam(query["preset"]) !== undefined
      ? { preset: readParam(query["preset"]) }
      : {}),
    ...(readParam(query["from"]) !== undefined
      ? { from: readParam(query["from"]) }
      : {}),
    ...(readParam(query["to"]) !== undefined
      ? { to: readParam(query["to"]) }
      : {}),
  });

  const filters = parsed.success ? parsed.data : {};
  const { range, fellBack, problem } = resolveRangeRequest(filters);

  const analytics = await getPracticeAnalytics(range);
  const selfHref = analyticsHref(BASE_PATH, range);

  return (
    <Section aria-labelledby="doctor-analytics-heading">
      <Container width="wide">
        <SectionHeader
          as="h1"
          titleId="doctor-analytics-heading"
          title={ANALYTICS_AREA.practice.heading}
          description={ANALYTICS_AREA.practice.description}
        />

        <div className="mt-8 flex flex-col gap-4">
          <DateRangeFilter
            range={range}
            practitionerId={undefined}
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
          <section aria-labelledby="doctor-analytics-appointments">
            <h2
              id="doctor-analytics-appointments"
              className="text-h3 text-heading"
            >
              {APPOINTMENT_PANEL_COPY.heading}
            </h2>
            <div className="mt-6">
              <AppointmentSummaryPanel
                result={analytics.appointments}
                headingId="doctor-analytics-appointments"
                retryHref={selfHref}
              />
            </div>
          </section>

          <section aria-labelledby="doctor-analytics-trend">
            <h2 id="doctor-analytics-trend" className="text-h3 text-heading">
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

          <section aria-labelledby="doctor-analytics-utilization">
            <h2
              id="doctor-analytics-utilization"
              className="text-h3 text-heading"
            >
              {WORKLOAD_PANEL_COPY.utilizationHeader}
            </h2>
            <div className="mt-6">
              <AnalyticsPanel
                result={analytics.utilization}
                retryHref={selfHref}
              >
                {(time) => (
                  <UtilizationSummary
                    bookedMinutes={time.bookedMinutes}
                    availableMinutes={time.availableMinutes}
                    utilizationRate={time.utilizationRate}
                  />
                )}
              </AnalyticsPanel>
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
            ]}
          />
        </div>
      </Container>
    </Section>
  );
}
