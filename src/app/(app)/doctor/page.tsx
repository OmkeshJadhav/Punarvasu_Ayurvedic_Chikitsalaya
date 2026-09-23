import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { DoctorDaySummaryPanel } from "@/components/doctor/day-summary";
import { DoctorSchedule } from "@/components/doctor/doctor-schedule";
import { NextPatientPanel } from "@/components/doctor/next-patient";
import { RecentNotifications } from "@/components/notifications/recent-notifications";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DASHBOARD_NOTIFICATION_COUNT } from "@/config/notifications";
import {
  addDaysToIsoDate,
  clinicWallClockToInstant,
  formatClinicDate,
  toClinicIsoDate,
} from "@/features/appointments/time";
import {
  DOCTOR_AREA,
  DOCTOR_NOTIFICATIONS_COPY,
  DOCTOR_SCHEDULE_COPY,
  DOCTOR_SCOPE_NOTICE,
  DOCTOR_TODAY_COPY,
  NO_PRACTITIONER_RECORD,
} from "@/features/doctor/content";
import {
  currentAndNext,
  getDoctorDaySchedule,
  getDoctorIdentity,
} from "@/features/doctor/queries";
import type {
  DoctorAppointment,
  DoctorDaySummary,
} from "@/features/doctor/types";
import { doctorDaySchema } from "@/features/doctor/validation";
import { NOTIFICATIONS_PATH } from "@/features/notifications/content";
import { listRecentNotifications } from "@/features/notifications/queries";
import type { NotificationListResult } from "@/features/notifications/types";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: DOCTOR_AREA.home.title,
  robots: { index: false, follow: false },
};

const DOCTOR_HOME = "/doctor";

/**
 * The practitioner's home page: what today holds, and who is next.
 *
 * ## The order of the page is the order of the work
 *
 * `phase_11.md` sections 3, 7 and 28: open on today rather than on a generic
 * analytics overview, and put the most important work first. So: the day's
 * counts, who is with the practitioner now and who is next, then the whole
 * day. Nothing above the fold is decorative, and there is no chart.
 *
 * ## "Now" is a real comparison, not a live indicator
 *
 * This is a server render comparing stored instants against the moment it
 * rendered, and it is exactly as current as the page is — there is no ticking
 * clock claiming otherwise, and no polling. Section 35 permits realtime and
 * then says to use server revalidation where it is unnecessary; every status
 * action revalidates this page, which is when it actually changes.
 *
 * ## What has changed underneath them
 *
 * `phase_15.md` section 57. The front desk books, moves and cancels, and
 * without a notification a practitioner finds that out by noticing. The panel
 * near the foot is the last few of those changes — the same component the
 * patient dashboard uses, with the practitioner's words — and it sits below
 * the day rather than above it because the day is what they came for.
 *
 * It is read with its own bounded query, concurrently with the diary, and it
 * fails on its own: a notification outage renders a sentence inside the panel
 * while the schedule above it still shows.
 *
 * ## Three states, not one
 *
 * A failed read gets its own screen: a practitioner told their morning is
 * clear when the database was unreachable will go and do something else. And
 * an account that holds the doctor role but is not on the scheduling roster
 * gets a third — an empty diary would be true and useless, and the fix is an
 * administrator's rather than theirs.
 *
 * ## Four layers of protection, none of them this page's markup
 *
 *   1. `src/proxy.ts` redirects a request with no session at all.
 *   2. `(app)/layout.tsx` calls `requireUser()`, and
 *      `(app)/doctor/layout.tsx` calls `requireAreaAccess`.
 *   3. `requirePermission("appointments.read.own_schedule")` here.
 *   4. Row-level security restricts the diary to this practitioner's own.
 */
export default async function DoctorHomePage({
  searchParams,
}: PageProps<"/doctor">) {
  await requirePermission("appointments.read.own_schedule", DOCTOR_HOME);

  const query = await searchParams;
  const parsed = doctorDaySchema.safeParse({ date: readParam(query["date"]) });
  const date =
    (parsed.success ? parsed.data.date : undefined) ??
    toClinicIsoDate(new Date());

  // Concurrent, and independent: the notification panel is about this
  // account, not about the day being looked at, so it is read once whichever
  // date the diary is showing.
  const [identity, recentNotifications] = await Promise.all([
    getDoctorIdentity(),
    listRecentNotifications(DASHBOARD_NOTIFICATION_COUNT),
  ]);

  if (identity.status === "not_a_practitioner") {
    return (
      <HomeShell
        heading={DOCTOR_AREA.home.heading}
        date={date}
        notifications={recentNotifications}
      >
        <Alert tone="warning" title={NO_PRACTITIONER_RECORD.title}>
          {NO_PRACTITIONER_RECORD.body}
        </Alert>
      </HomeShell>
    );
  }

  const { result, summary } = await getDoctorDaySchedule(date);

  return (
    <HomeShell
      heading={
        identity.status === "found"
          ? identity.identity.displayName
          : DOCTOR_AREA.home.heading
      }
      date={date}
      notifications={recentNotifications}
    >
      {result.status === "unavailable" ? (
        <ErrorState
          title={DOCTOR_SCHEDULE_COPY.loadErrorTitle}
          description={DOCTOR_SCHEDULE_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              {/*
                The read happens during server rendering, so re-requesting the
                page *is* the retry. A link needs no client component and no
                state.
              */}
              <Link href={`${DOCTOR_HOME}?date=${date}`}>
                {DOCTOR_SCHEDULE_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      ) : (
        <TodayContent appointments={result.appointments} summary={summary} />
      )}
    </HomeShell>
  );
}

function TodayContent({
  appointments,
  summary,
}: {
  readonly appointments: readonly DoctorAppointment[];
  readonly summary: DoctorDaySummary;
}) {
  const { current, next } = currentAndNext(appointments);

  return (
    <div className="flex flex-col gap-10">
      <DoctorDaySummaryPanel
        summary={summary}
        headingId="doctor-today-heading"
      />

      <section aria-labelledby="doctor-now-heading">
        <h2
          id="doctor-now-heading"
          className="text-h4 text-heading font-sans font-medium"
        >
          {DOCTOR_TODAY_COPY.nowHeading}
        </h2>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <NextPatientPanel
            label={DOCTOR_TODAY_COPY.nowHeading}
            appointment={current}
            emptyText={DOCTOR_TODAY_COPY.nowEmpty}
          />
          <NextPatientPanel
            label={DOCTOR_TODAY_COPY.nextHeading}
            appointment={next}
            emptyText={DOCTOR_TODAY_COPY.nextEmpty}
          />
        </div>
      </section>

      <section aria-labelledby="doctor-schedule-heading">
        <h2
          id="doctor-schedule-heading"
          className="text-h4 text-heading font-sans font-medium"
        >
          {DOCTOR_TODAY_COPY.scheduleHeading}
        </h2>

        <div className="mt-4">
          {appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title={DOCTOR_TODAY_COPY.emptyTitle}
              description={DOCTOR_TODAY_COPY.emptyDescription}
              action={
                <Button asChild variant="secondary">
                  <Link href="/doctor/appointments">
                    {DOCTOR_TODAY_COPY.viewAllLabel}
                  </Link>
                </Button>
              }
            />
          ) : (
            <DoctorSchedule appointments={appointments} />
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * The page frame, shared by all three outcomes.
 *
 * It owns the single `<h1>`, so every state has exactly one — including the
 * two that render a notice rather than a day.
 *
 * The heading is the practitioner's own scheduling name, which is not
 * sensitive: it is on the clinic's roster and, once the clinic publishes a
 * practitioner directory, on the public site. No patient name appears in a
 * heading or a page title anywhere in this workspace.
 */
function HomeShell({
  heading,
  date,
  notifications,
  children,
}: {
  readonly heading: string;
  readonly date: string;
  readonly notifications: NotificationListResult;
  readonly children: React.ReactNode;
}) {
  const previousDay = addDaysToIsoDate(date, -1);
  const nextDay = addDaysToIsoDate(date, 1);
  // Midday rather than midnight: the heading needs only the calendar day, and
  // midday is the furthest a date can be from a timezone boundary, so no
  // display rounding can shift it.
  const shown = clinicWallClockToInstant(date, 12 * 60) ?? new Date();

  return (
    <Section aria-labelledby="doctor-today-heading">
      <Container width="wide">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            as="h1"
            titleId="doctor-today-heading"
            title={heading}
            description={formatClinicDate(shown)}
          />
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button asChild>
              <Link href="/doctor/appointments">
                {DOCTOR_TODAY_COPY.viewAllLabel}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/doctor/patients">
                {DOCTOR_TODAY_COPY.findPatientLabel}
              </Link>
            </Button>
          </div>
        </div>

        {/*
          Day stepping is links rather than form buttons, because moving to
          tomorrow is a navigation and should behave like one: middle-clickable,
          in history, and working without JavaScript.
        */}
        <nav
          aria-label="Change day"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          <Button asChild variant="secondary">
            <Link href={`${DOCTOR_HOME}?date=${previousDay}`}>
              ← {DOCTOR_TODAY_COPY.previousDayLabel}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={DOCTOR_HOME}>{DOCTOR_TODAY_COPY.todayLabel}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`${DOCTOR_HOME}?date=${nextDay}`}>
              {DOCTOR_TODAY_COPY.nextDayLabel} →
            </Link>
          </Button>
        </nav>

        <div className="mt-8">{children}</div>

        {/*
          Below the day, deliberately. A practitioner opens this page to see
          who they are seeing; what the front desk changed an hour ago matters
          and is not what they came for. The notification centre is one link
          away for the rest.
        */}
        <section
          aria-labelledby="doctor-updates-heading"
          className="border-border mt-12 border-t pt-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2
              id="doctor-updates-heading"
              className="text-h4 text-heading font-sans font-medium"
            >
              {DOCTOR_NOTIFICATIONS_COPY.heading}
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={NOTIFICATIONS_PATH}>
                {DOCTOR_NOTIFICATIONS_COPY.viewAllLabel}
              </Link>
            </Button>
          </div>

          <div className="mt-4">
            <RecentNotifications
              result={notifications}
              copy={DOCTOR_NOTIFICATIONS_COPY}
            />
          </div>
        </section>

        <div className="mt-12">
          <Alert tone="info" title={DOCTOR_SCOPE_NOTICE.title}>
            {DOCTOR_SCOPE_NOTICE.body}
          </Alert>
        </div>
      </Container>
    </Section>
  );
}

/**
 * One value from a search parameter.
 *
 * Next.js gives `string | string[] | undefined`. A repeated parameter is
 * discarded entirely rather than having its first value taken: two copies is
 * a smuggling attempt rather than something a person does, and it is the same
 * rule `lib/auth/redirect.ts` applies to `next`.
 */
function readParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
