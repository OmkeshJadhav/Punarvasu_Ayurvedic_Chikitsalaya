import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { DayOverviewSummary } from "@/components/reception/day-overview";
import { ScheduleFilters } from "@/components/reception/schedule-filters";
import { ScheduleList } from "@/components/reception/schedule-list";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { listSchedulablePractitioners } from "@/features/appointments/queries";
import {
  clinicWallClockToInstant,
  formatClinicDate,
  toClinicIsoDate,
} from "@/features/appointments/time";
import {
  RECEPTION_AREA,
  SCHEDULE_COPY,
  TODAY_COPY,
} from "@/features/reception/content";
import { getDaySchedule } from "@/features/reception/queries";
import { scheduleFilterSchema } from "@/features/reception/validation";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: RECEPTION_AREA.schedule.title,
  robots: { index: false, follow: false },
};

const SCHEDULE_PATH = "/receptionist/schedule";

/**
 * The clinic diary, one day at a time.
 *
 * ## Why a day and not a week
 *
 * `phase_10.md` sections 25-26 permit both and warn against building a complex
 * calendar that is not needed. A front desk works today and occasionally
 * tomorrow; a week grid is seven columns of the same information, unreadable
 * on the tablet this is used on, and it answers a question — "how busy is
 * Thursday?" — that stepping one day at a time already answers. The day view
 * is the default section 26 asks for, and a week view is the deliberate
 * addition of a phase that finds it is needed.
 *
 * ## The filters are validated, not trusted
 *
 * They arrive in the URL, so they are parsed through `scheduleFilterSchema`
 * before anything is read. A malformed date or an unrecognised status falls
 * back to today and to no filter rather than being interpreted — but note what
 * that is protecting against: a broken page, not an escalation. A receptionist
 * may already see the whole diary, so no value of these can widen access.
 *
 * ## Why the counts ignore the filters
 *
 * They describe the day, not the view. Filtering to one practitioner must not
 * make "three waiting to be confirmed" read as none — the receptionist would
 * stop trusting the number, which is worse than not showing it.
 */
export default async function ReceptionSchedulePage({
  searchParams,
}: PageProps<"/receptionist/schedule">) {
  await requirePermission("appointments.manage.any", SCHEDULE_PATH);

  const query = await searchParams;
  const parsed = scheduleFilterSchema.safeParse({
    date: readParam(query["date"]),
    practitionerId: readParam(query["practitionerId"]),
    status: readParam(query["status"]),
  });

  const filters = parsed.success ? parsed.data : {};
  const date = filters.date ?? toClinicIsoDate(new Date());

  const [{ result, overview }, practitioners] = await Promise.all([
    getDaySchedule({
      date,
      practitionerId: filters.practitionerId,
      status: filters.status,
    }),
    listSchedulablePractitioners({ onlineBookableOnly: false }),
  ]);

  const isFiltered = Boolean(filters.practitionerId || filters.status);

  return (
    <Section aria-labelledby="reception-schedule-heading">
      <Container width="wide">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            as="h1"
            titleId="reception-schedule-heading"
            title={RECEPTION_AREA.schedule.heading}
            description={formatClinicDate(
              // Midday rather than midnight: the heading only needs the
              // calendar day, and midday is the furthest a date can be from a
              // timezone boundary, so no display rounding can shift it.
              clinicWallClockToInstant(date, 12 * 60) ?? new Date(),
            )}
          />
          <div className="shrink-0">
            <Button asChild>
              <Link href="/receptionist/schedule/new">
                {TODAY_COPY.quickBookLabel}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8">
          <ScheduleFilters
            date={date}
            practitionerId={filters.practitionerId}
            status={filters.status}
            practitioners={practitioners}
            basePath={SCHEDULE_PATH}
          />
        </div>

        <div className="mt-8">
          <DayOverviewSummary overview={overview} />
        </div>

        <div className="mt-8">
          {result.status === "unavailable" ? (
            <ErrorState
              title={SCHEDULE_COPY.loadErrorTitle}
              description={SCHEDULE_COPY.loadErrorDescription}
              action={
                <Button asChild variant="secondary">
                  <Link href={`${SCHEDULE_PATH}?date=${date}`}>
                    {SCHEDULE_COPY.loadErrorRetryLabel}
                  </Link>
                </Button>
              }
            />
          ) : result.appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title={
                isFiltered
                  ? SCHEDULE_COPY.emptyTitle
                  : SCHEDULE_COPY.emptyDayTitle
              }
              description={
                isFiltered
                  ? SCHEDULE_COPY.emptyDescription
                  : SCHEDULE_COPY.emptyDayDescription
              }
              action={
                isFiltered ? (
                  <Button asChild variant="secondary">
                    <Link href={`${SCHEDULE_PATH}?date=${date}`}>
                      {SCHEDULE_COPY.resetLabel}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/receptionist/schedule/new">
                      {TODAY_COPY.quickBookLabel}
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <ScheduleList appointments={result.appointments} />
          )}
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
 * a smuggling attempt rather than something a person does, and the same rule
 * `lib/auth/redirect.ts` applies to `next`.
 */
function readParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
