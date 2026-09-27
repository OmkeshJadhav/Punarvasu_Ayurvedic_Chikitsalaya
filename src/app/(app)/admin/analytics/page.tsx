import type { Metadata } from "next";
import { Download } from "lucide-react";

import { AnalyticsFreshness } from "@/components/analytics/analytics-freshness";
import {
  AppointmentsOverviewCard,
  BusiestPractitionersCard,
  ClinicalActivityCard,
  ExportCard,
  NotificationsCard,
  PatientsCard,
  WorkloadTableCard,
} from "@/components/analytics/dashboard/clinic-dashboard";
import {
  ClinicHeadlineFigures,
  comparisonBasis,
} from "@/components/analytics/dashboard/headline-figures";
import {
  AppointmentRegisterCard,
  PatientRegisterCard,
  RecentActivityCard,
} from "@/components/analytics/dashboard/registers";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { MetricDefinitions } from "@/components/analytics/metric-definitions";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { compareCounts, readyPair } from "@/features/analytics/comparison";
import { ANALYTICS_AREA, DASHBOARD_COPY } from "@/features/analytics/content";
import {
  getClinicAnalytics,
  getClinicComparison,
  getClinicSystemAnalytics,
} from "@/features/analytics/queries";
import {
  previousRange,
  resolveRangeRequest,
} from "@/features/analytics/ranges";
import { analyticsFilterSchema } from "@/features/analytics/validation";
import { listSchedulablePractitioners } from "@/features/appointments/queries";
import {
  REGISTER_PAGE_PARAMS,
  parseRegisterPage,
} from "@/features/clinic-registers/pagination";
import { getClinicRegisters } from "@/features/clinic-registers/queries";
import { requirePermission } from "@/lib/authorization/guards";
import { can } from "@/lib/authorization/policy";

import { analyticsHref, readParam } from "@/features/analytics/href";

export const metadata: Metadata = {
  title: ANALYTICS_AREA.clinic.title,
  robots: { index: false, follow: false },
};

const BASE_PATH = "/admin/analytics";

const IDS = {
  heading: "admin-analytics-heading",
  headline: "admin-analytics-headline",
  overview: "admin-analytics-overview",
  busiest: "admin-analytics-busiest",
  workload: "admin-analytics-workload",
  appointmentRegister: "admin-analytics-appointment-register",
  patients: "admin-analytics-patients",
  patientRegister: "admin-analytics-patient-register",
  activity: "admin-analytics-activity",
  notifications: "admin-analytics-notifications",
  clinical: "admin-analytics-clinical",
  export: "admin-analytics-export",
} as const;

/**
 * The clinic dashboard.
 *
 * ## Progressive density
 *
 * The page reads top to bottom from the broadest question to the narrowest:
 * the four headline figures, then the operational charts (appointments and
 * the busiest practitioners), then the exact tables (workload, patients),
 * then the system panels an administrator consults least (notifications,
 * clinical activity), and finally the export and the definitions. `phase_16.md`
 * section 124's questions are all still answered; they are arranged so the
 * state of the clinic is clear before the detail is.
 *
 * ## Three permissions' worth of reads
 *
 * The page checks `analytics.read.clinic`, and then makes separate authorized
 * reads: `getClinicAnalytics` and `getClinicComparison` need
 * `analytics.read.operational` and `getClinicSystemAnalytics` needs
 * `analytics.read.clinic`. Keeping them apart is what lets the front desk
 * reuse the first without being one boolean away from the second.
 *
 * The clinic registers — the appointment register, the patient register and
 * recent activity — are the page's only patient-level panels. They are read
 * through `getClinicRegisters`, which needs `registers.read.patients`, a
 * permission separate from every analytics one (`phase_16.md` section 35A),
 * and each RPC behind it writes an audit entry per patient it returns. A role
 * without that permission is not shown the panels at all.
 *
 * The comparison is the same two aggregates over the period immediately
 * before, of the same length (`previousRange`). When that period is outside
 * the reporting window there is no comparison, and the cards say so rather
 * than comparing against nothing.
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
  const user = await requirePermission("analytics.read.clinic", BASE_PATH);

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
  const earlier = previousRange(range);
  const appointmentsPage = parseRegisterPage(
    readParam(query[REGISTER_PAGE_PARAMS.appointments]),
  );
  const patientsPage = parseRegisterPage(
    readParam(query[REGISTER_PAGE_PARAMS.patients]),
  );
  const mayReadRegisters = can(user.role, "registers.read.patients");

  const [analytics, system, practitioners, comparison, registers] =
    await Promise.all([
      getClinicAnalytics(range, practitionerId),
      getClinicSystemAnalytics(range),
      listSchedulablePractitioners({ onlineBookableOnly: false }),
      earlier ? getClinicComparison(earlier, practitionerId) : null,
      mayReadRegisters
        ? getClinicRegisters(range, {
            practitionerId,
            appointmentsPage,
            patientsPage,
          })
        : null,
    ]);

  const selfHref = analyticsHref(BASE_PATH, range, practitionerId);

  /**
   * A link to one register's page, keeping the period, the practitioner and
   * the *other* register's page, and landing back on the register itself.
   */
  const registerHref =
    (register: keyof typeof REGISTER_PAGE_PARAMS, anchor: string) =>
    (page: number): string => {
      const params = new URLSearchParams(selfHref.split("?")[1] ?? "");
      const pages = { appointments: appointmentsPage, patients: patientsPage };
      pages[register] = page;
      for (const key of Object.keys(
        REGISTER_PAGE_PARAMS,
      ) as (keyof typeof REGISTER_PAGE_PARAMS)[]) {
        if (pages[key] > 1)
          params.set(REGISTER_PAGE_PARAMS[key], `${pages[key]}`);
      }
      return `${BASE_PATH}?${params.toString()}#${anchor}`;
    };
  const basis = comparisonBasis(range.spanDays);
  const appointmentPair = readyPair(
    analytics.appointments,
    comparison?.appointments ?? null,
  );

  return (
    <div className="py-8 lg:py-10">
      <Container width="wide" className="flex flex-col gap-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <Breadcrumbs
              items={[
                // No link: `/admin` redirects back to this page.
                { label: DASHBOARD_COPY.breadcrumbAdmin },
                { label: DASHBOARD_COPY.breadcrumbCurrent },
              ]}
            />
            <h1 id={IDS.heading} className="text-h1 text-heading font-serif">
              {ANALYTICS_AREA.clinic.heading}
            </h1>
            <p className="text-body text-muted-foreground measure font-sans">
              {ANALYTICS_AREA.clinic.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 lg:justify-end">
            <AnalyticsFreshness
              generatedAt={analytics.generatedAt}
              refreshHref={selfHref}
            />
            {/*
              A link to the export card rather than the download itself:
              `phase_16.md` section 92 wants the file's columns stated before
              it is created, and the card is where they are.
            */}
            <Button asChild>
              <a href={`#${IDS.export}`}>
                <Download aria-hidden="true" />
                {DASHBOARD_COPY.exportLink}
              </a>
            </Button>
          </div>
        </header>

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

        <ClinicHeadlineFigures
          headingId={IDS.headline}
          analytics={analytics}
          comparison={comparison}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <AppointmentsOverviewCard
            className="lg:col-span-8"
            titleId={IDS.overview}
            counts={analytics.appointments}
            trend={analytics.trend}
            granularity={range.granularity}
            comparison={
              appointmentPair
                ? compareCounts(
                    appointmentPair[0].total,
                    appointmentPair[1].total,
                  )
                : null
            }
            comparisonBasis={basis}
            retryHref={selfHref}
          />

          <BusiestPractitionersCard
            className="lg:col-span-4"
            titleId={IDS.busiest}
            workload={analytics.workload}
            tableAnchor={IDS.workload}
            retryHref={selfHref}
          />

          {registers ? (
            <AppointmentRegisterCard
              className="lg:col-span-12"
              titleId={IDS.appointmentRegister}
              register={registers.appointments}
              hrefFor={registerHref("appointments", IDS.appointmentRegister)}
              retryHref={selfHref}
            />
          ) : null}

          <WorkloadTableCard
            className="scroll-mt-6 lg:col-span-12"
            titleId={IDS.workload}
            workload={analytics.workload}
            retryHref={selfHref}
          />

          <PatientsCard
            className={registers ? "lg:col-span-5" : "lg:col-span-12"}
            titleId={IDS.patients}
            summary={analytics.patients}
            growth={analytics.growth}
            granularity={range.granularity}
            retryHref={selfHref}
          />

          {registers ? (
            <PatientRegisterCard
              className="lg:col-span-7"
              titleId={IDS.patientRegister}
              register={registers.patients}
              hrefFor={registerHref("patients", IDS.patientRegister)}
              retryHref={selfHref}
            />
          ) : null}

          <NotificationsCard
            className="lg:col-span-7"
            titleId={IDS.notifications}
            deliveries={system.deliveries}
            volume={system.notifications}
            retryHref={selfHref}
          />

          {registers ? (
            <RecentActivityCard
              className="lg:col-span-5"
              titleId={IDS.activity}
              activity={registers.activity}
              retryHref={selfHref}
            />
          ) : null}

          <ClinicalActivityCard
            className={registers ? "lg:col-span-7" : "lg:col-span-5"}
            titleId={IDS.clinical}
            activity={system.clinicalActivity}
            documentTypes={system.documentTypes}
            retryHref={selfHref}
          />

          <ExportCard
            className="lg:col-span-5 lg:self-start"
            titleId={IDS.export}
            range={range}
            practitionerId={practitionerId}
          />
        </div>

        <MetricDefinitions />
      </Container>
    </div>
  );
}
