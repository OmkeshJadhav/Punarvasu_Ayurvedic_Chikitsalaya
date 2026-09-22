import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { DayOverviewSummary } from "@/components/reception/day-overview";
import { ScheduleList } from "@/components/reception/schedule-list";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  formatClinicDate,
  formatClinicTimeRange,
  toClinicIsoDate,
} from "@/features/appointments/time";
import {
  RECEPTION_AREA,
  RECEPTION_REVIEW_NOTICE,
  SCHEDULE_COPY,
  TODAY_COPY,
} from "@/features/reception/content";
import { currentAndNext, getDaySchedule } from "@/features/reception/queries";
import type { ScheduledAppointment } from "@/features/reception/types";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: RECEPTION_AREA.home.title,
  robots: { index: false, follow: false },
};

/**
 * The front desk's home page: what needs attention today.
 *
 * ## The order of the page is the order of the work
 *
 * `phase_10.md` section 6 asks it to answer "what needs my attention today?".
 * So: the day's counts, what is happening right now and what is next, the
 * requests waiting to be confirmed, then the whole day. Nothing above the fold
 * is decorative, and there is no chart.
 *
 * ## "Now" is a real comparison, not a live indicator
 *
 * Section 9 is explicit that a fake real-time indicator must not be invented
 * where the logic is not there. This is a server render comparing stored
 * instants against the moment it rendered, and it is exactly as current as the
 * page is — there is no ticking clock claiming otherwise, and no polling.
 *
 * ## Why a failed read gets its own screen
 *
 * `getDaySchedule` distinguishes "nothing today" from "could not read today",
 * and so does this page. A front desk told the diary is empty when the
 * database was briefly unreachable will turn people away.
 *
 * ## Three layers of protection, none of them this page's markup
 *
 *   1. `src/proxy.ts` redirects a request with no session at all.
 *   2. `(app)/layout.tsx` calls `requireUser()`, and
 *      `(app)/receptionist/layout.tsx` calls `requireAreaAccess`.
 *   3. `requirePermission("appointments.manage.any")` here, because reading
 *      the clinic diary is a capability of its own and the area guard is about
 *      the area.
 *
 * And beneath all three, row-level security decides what the query returns.
 */
export default async function ReceptionistHomePage() {
  await requirePermission("appointments.manage.any", "/receptionist");

  const today = toClinicIsoDate(new Date());
  const { result, overview } = await getDaySchedule({ date: today });

  return (
    <Section aria-labelledby="reception-today-heading">
      <Container width="wide">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            as="h1"
            titleId="reception-today-heading"
            title={RECEPTION_AREA.home.heading}
            description={formatClinicDate(new Date())}
          />
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button asChild>
              <Link href="/receptionist/schedule/new">
                {TODAY_COPY.quickBookLabel}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/receptionist/patients">
                {TODAY_COPY.quickFindLabel}
              </Link>
            </Button>
          </div>
        </div>

        {result.status === "unavailable" ? (
          <div className="mt-10">
            <ErrorState
              title={SCHEDULE_COPY.loadErrorTitle}
              description={SCHEDULE_COPY.loadErrorDescription}
              action={
                <Button asChild variant="secondary">
                  {/*
                    The read happens during server rendering, so re-requesting
                    the page *is* the retry. A link needs no client component
                    and no state.
                  */}
                  <Link href="/receptionist">
                    {SCHEDULE_COPY.loadErrorRetryLabel}
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <TodayContent
            appointments={result.appointments}
            overview={overview}
          />
        )}

        <div className="mt-12">
          <Alert tone="info" title={RECEPTION_REVIEW_NOTICE.title}>
            {RECEPTION_REVIEW_NOTICE.body}
          </Alert>
        </div>
      </Container>
    </Section>
  );
}

function TodayContent({
  appointments,
  overview,
}: {
  readonly appointments: readonly ScheduledAppointment[];
  readonly overview: Parameters<typeof DayOverviewSummary>[0]["overview"];
}) {
  const { current, next } = currentAndNext(appointments);
  const awaiting = appointments.filter(
    (appointment) => appointment.status === "requested",
  );

  return (
    <div className="mt-8 flex flex-col gap-10">
      <DayOverviewSummary
        overview={overview}
        headingId="reception-today-heading"
      />

      <section aria-labelledby="reception-now-heading">
        <h2
          id="reception-now-heading"
          className="text-h4 text-heading font-sans font-medium"
        >
          {TODAY_COPY.nowHeading}
        </h2>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <NowPanel
            label={TODAY_COPY.nowHeading}
            appointment={current}
            emptyText={TODAY_COPY.nowEmpty}
          />
          <NowPanel
            label={TODAY_COPY.nextHeading}
            appointment={next}
            emptyText="Nothing else is booked today."
          />
        </div>
      </section>

      {awaiting.length > 0 ? (
        <section aria-labelledby="reception-awaiting-heading">
          <h2
            id="reception-awaiting-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {TODAY_COPY.awaitingHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure mt-1">
            {TODAY_COPY.awaitingDescription}
          </p>
          <div className="mt-4">
            <ScheduleList
              appointments={awaiting}
              caption={TODAY_COPY.awaitingCaption}
            />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="reception-schedule-heading">
        <h2
          id="reception-schedule-heading"
          className="text-h4 text-heading font-sans font-medium"
        >
          {TODAY_COPY.scheduleHeading}
        </h2>

        <div className="mt-4">
          {appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title={TODAY_COPY.emptyTitle}
              description={TODAY_COPY.emptyDescription}
              action={
                <Button asChild>
                  <Link href="/receptionist/schedule/new">
                    {TODAY_COPY.quickBookLabel}
                  </Link>
                </Button>
              }
              secondaryAction={
                <Button asChild variant="secondary">
                  <Link href="/receptionist/schedule">
                    {TODAY_COPY.quickScheduleLabel}
                  </Link>
                </Button>
              }
            />
          ) : (
            <ScheduleList appointments={appointments} />
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * "Happening now" and "next in".
 *
 * A panel rather than a card, because two cards side by side on a page that
 * already has a table is the clutter `phase_10.md` section 2 warns against.
 * The empty state is a sentence, not an illustration.
 */
function NowPanel({
  label,
  appointment,
  emptyText,
}: {
  readonly label: string;
  readonly appointment: ScheduledAppointment | null;
  readonly emptyText: string;
}) {
  return (
    <div className="border-border bg-muted/40 rounded-lg border p-5">
      <p className="text-caption text-muted-foreground font-sans tracking-wide uppercase">
        {label}
      </p>

      {appointment ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-h5 text-heading font-sans font-medium">
            <time dateTime={appointment.startsAt.toISOString()}>
              {formatClinicTimeRange(appointment.startsAt, appointment.endsAt)}
            </time>
          </p>
          <p className="text-body text-foreground wrap-break-word">
            {appointment.patientName}
          </p>
          <p className="text-body-sm text-muted-foreground wrap-break-word">
            {appointment.typeName} · {appointment.practitionerName}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <AppointmentStatusBadge status={appointment.status} />
            <Link
              href={`/receptionist/schedule/${appointment.id}`}
              aria-label={`${SCHEDULE_COPY.viewLabel} ${appointment.patientName}`}
              className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {SCHEDULE_COPY.viewLabel}
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-muted-foreground mt-2">{emptyText}</p>
      )}
    </div>
  );
}
