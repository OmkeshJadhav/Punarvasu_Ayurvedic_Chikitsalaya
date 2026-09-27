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
import { ClinicHeadlineFigures } from "@/components/analytics/dashboard/headline-figures";
import {
  AppointmentRegisterCard,
  PatientRegisterCard,
  RecentActivityCard,
} from "@/components/analytics/dashboard/registers";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { MetricDefinitions } from "@/components/analytics/metric-definitions";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Button } from "@/components/ui/button";
import { SERVICES_PAGE_IMAGES } from "@/config/images";
import { ANALYTICS_AREA, DASHBOARD_COPY } from "@/features/analytics/content";
import {
  CLINIC_DASHBOARD_IDS as IDS,
  CLINIC_DASHBOARD_PATH as BASE_PATH,
} from "@/features/analytics/dashboard-sections";
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

/** The header photograph: a light still life that leaves room for the quote. */
const HERO_IMAGE = SERVICES_PAGE_IMAGES.herbBowlWide;

/**
 * The clinic dashboard.
 *
 * ## Progressive density
 *
 * The page reads top to bottom from the broadest question to the narrowest:
 * overview (the four headline figures), performance (the appointments chart
 * beside the busiest practitioners), appointments (the register beside the
 * workload and recent activity), patients (growth, the patient register and
 * clinical activity side by side), and finally notifications, the export and
 * the definitions. `phase_16.md` section 124's questions are all still
 * answered; they are arranged so the state of the clinic is clear before the
 * detail is.
 *
 * ## The grid
 *
 * Twelve columns from `lg`. The overview and the busiest practitioners pair
 * up from `xl`; below `2xl` the rest pair in halves, and the register and the
 * workload table take the full width, because beside a 288px sidebar a
 * five-column table in seven twelfths of the page clips its last column —
 * so both tables always take the full width. From `2xl` there is room for
 * patients, the patient register and clinical activity three across. Charts
 * and stat rows inside the cards follow their own width (container queries),
 * so a panel reads correctly at whichever span it lands on.
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

  return (
    <div className="py-8 lg:py-10">
      <Container width="wide" className="flex flex-col gap-6 lg:gap-8">
        <header className="grid items-center gap-6 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-3 lg:col-span-7">
            <Breadcrumbs
              items={[
                { label: DASHBOARD_COPY.breadcrumbAdmin },
                { label: DASHBOARD_COPY.breadcrumbCurrent },
              ]}
            />
            <h1 id={IDS.heading} className="text-h1 text-heading font-serif">
              {ANALYTICS_AREA.clinic.heading}
            </h1>
            <p className="text-body-lg text-muted-foreground measure font-sans">
              {ANALYTICS_AREA.clinic.description}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-3">
              <AnalyticsFreshness
                generatedAt={analytics.generatedAt}
                refreshHref={selfHref}
              />
              {/*
                A link to the export card rather than the download itself:
                `phase_16.md` section 92 wants the file's columns stated before
                it is created, and the card is where they are.
              */}
              <Button asChild size="sm">
                <a href={`#${IDS.export}`}>
                  <Download aria-hidden="true" />
                  {DASHBOARD_COPY.exportLink}
                </a>
              </Button>
            </div>
          </div>

          {/*
            Atmosphere, not information: the photograph and the line over it
            are hidden from assistive technology and dropped on a phone,
            where the figures should start as high on the screen as they can.
          */}
          <div
            aria-hidden="true"
            className="relative hidden h-48 overflow-hidden rounded-lg shadow-sm md:block lg:col-span-5 lg:h-52"
          >
            <MediaFrame
              image={HERO_IMAGE}
              aspect="fill"
              radius="none"
              sizes="(min-width: 1024px) 40vw, 100vw"
              imageClassName="object-right"
            />
            <div className="from-background/70 absolute inset-0 bg-linear-to-r to-transparent to-60%" />
            <p className="border-border/60 bg-card/75 text-heading absolute top-1/2 left-5 max-w-44 -translate-y-1/2 rounded-lg border p-4 font-serif text-lg leading-snug italic shadow-sm backdrop-blur-sm">
              &ldquo;{DASHBOARD_COPY.heroQuote}&rdquo;
            </p>
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
          {/* Performance */}
          <AppointmentsOverviewCard
            className="lg:col-span-12 xl:col-span-8"
            titleId={IDS.overview}
            counts={analytics.appointments}
            trend={analytics.trend}
            granularity={range.granularity}
            retryHref={selfHref}
          />

          <BusiestPractitionersCard
            className="lg:col-span-12 xl:col-span-4"
            titleId={IDS.busiest}
            workload={analytics.workload}
            tableAnchor={IDS.workload}
            retryHref={selfHref}
          />

          {/* Appointments and practitioner workload */}
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
            className="lg:col-span-12"
            titleId={IDS.workload}
            workload={analytics.workload}
            retryHref={selfHref}
          />

          {/* Patients and clinical records */}
          <PatientsCard
            className="lg:col-span-6 2xl:col-span-4"
            titleId={IDS.patients}
            summary={analytics.patients}
            growth={analytics.growth}
            granularity={range.granularity}
            retryHref={selfHref}
          />

          {registers ? (
            <PatientRegisterCard
              className="lg:col-span-6 2xl:col-span-4"
              titleId={IDS.patientRegister}
              register={registers.patients}
              hrefFor={registerHref("patients", IDS.patientRegister)}
              retryHref={selfHref}
            />
          ) : null}

          <ClinicalActivityCard
            className={
              registers
                ? "lg:col-span-6 2xl:col-span-4"
                : "lg:col-span-6 2xl:col-span-8"
            }
            titleId={IDS.clinical}
            activity={system.clinicalActivity}
            documentTypes={system.documentTypes}
            retryHref={selfHref}
          />

          {/* Notifications and recent activity */}
          <NotificationsCard
            className="lg:col-span-6 2xl:col-span-7"
            titleId={IDS.notifications}
            deliveries={system.deliveries}
            volume={system.notifications}
            retryHref={selfHref}
          />

          {registers ? (
            <RecentActivityCard
              className="lg:col-span-6 2xl:col-span-5"
              titleId={IDS.activity}
              activity={registers.activity}
              retryHref={selfHref}
            />
          ) : null}

          {/* Export */}
          <ExportCard
            className={
              registers
                ? "lg:col-span-6 2xl:col-span-12"
                : "lg:col-span-6 2xl:col-span-5"
            }
            titleId={IDS.export}
            range={range}
            practitionerId={practitionerId}
          />
        </div>

        <div id={IDS.definitions} className="scroll-mt-6">
          <MetricDefinitions />
        </div>
      </Container>
    </div>
  );
}
