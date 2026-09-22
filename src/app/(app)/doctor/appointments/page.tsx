import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { DoctorAppointmentFilters } from "@/components/doctor/appointment-filters";
import { DoctorSchedule } from "@/components/doctor/doctor-schedule";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { getActiveAppointmentTypes } from "@/features/appointments/queries";
import { DOCTOR_AREA, DOCTOR_SCHEDULE_COPY } from "@/features/doctor/content";
import { getDoctorAppointments } from "@/features/doctor/queries";
import { doctorAppointmentFilterSchema } from "@/features/doctor/validation";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: DOCTOR_AREA.appointments.title,
  robots: { index: false, follow: false },
};

const APPOINTMENTS_PATH = "/doctor/appointments";

/**
 * Everything booked with this practitioner, filtered.
 *
 * ## The filters are validated, not trusted
 *
 * They arrive in the URL, so they are parsed through
 * `doctorAppointmentFilterSchema` before anything is read. A malformed value
 * falls back to the default rather than being interpreted — but note what
 * that protects against: a broken page, not an escalation. Row-level security
 * has already restricted the table to this practitioner's own diary, so no
 * value of these can reach a row that was not already readable.
 *
 * ## There is no practitioner filter
 *
 * `phase_11.md` section 12 says so: practitioner filtering is unnecessary
 * when a doctor can only see their own appointments, and a control offering a
 * choice with one option is worse than no control.
 *
 * ## Bounded
 *
 * Each range is a bounded query rather than everything filtered in memory, so
 * "past" on a practitioner with years of history is still one bounded read
 * (`phase_11.md` section 61).
 */
export default async function DoctorAppointmentsPage({
  searchParams,
}: PageProps<"/doctor/appointments">) {
  await requirePermission("appointments.read.own_schedule", APPOINTMENTS_PATH);

  const query = await searchParams;
  const parsed = doctorAppointmentFilterSchema.safeParse({
    range: readParam(query["range"]),
    status: readParam(query["status"]),
    appointmentTypeId: readParam(query["appointmentTypeId"]),
  });

  const filters = parsed.success
    ? parsed.data
    : {
        range: "upcoming" as const,
        status: undefined,
        appointmentTypeId: undefined,
      };

  const [result, appointmentTypes] = await Promise.all([
    getDoctorAppointments(filters),
    getActiveAppointmentTypes(),
  ]);

  const isFiltered = Boolean(filters.status || filters.appointmentTypeId);

  return (
    <Section aria-labelledby="doctor-appointments-heading">
      <Container width="wide">
        <SectionHeader
          as="h1"
          titleId="doctor-appointments-heading"
          title={DOCTOR_AREA.appointments.heading}
          description={DOCTOR_AREA.appointments.description}
        />

        <div className="mt-8">
          <DoctorAppointmentFilters
            range={filters.range}
            status={filters.status}
            appointmentTypeId={filters.appointmentTypeId}
            appointmentTypes={appointmentTypes}
            basePath={APPOINTMENTS_PATH}
          />
        </div>

        <div className="mt-8">
          {result.status === "unavailable" ? (
            <ErrorState
              title={DOCTOR_SCHEDULE_COPY.loadErrorTitle}
              description={DOCTOR_SCHEDULE_COPY.loadErrorDescription}
              action={
                <Button asChild variant="secondary">
                  <Link href={`${APPOINTMENTS_PATH}?range=${filters.range}`}>
                    {DOCTOR_SCHEDULE_COPY.loadErrorRetryLabel}
                  </Link>
                </Button>
              }
            />
          ) : result.appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title={
                isFiltered
                  ? DOCTOR_SCHEDULE_COPY.emptyTitle
                  : DOCTOR_SCHEDULE_COPY.emptyRangeTitle
              }
              description={
                isFiltered
                  ? DOCTOR_SCHEDULE_COPY.emptyDescription
                  : DOCTOR_SCHEDULE_COPY.emptyRangeDescription
              }
              action={
                isFiltered ? (
                  <Button asChild variant="secondary">
                    <Link href={`${APPOINTMENTS_PATH}?range=${filters.range}`}>
                      {DOCTOR_SCHEDULE_COPY.resetLabel}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DoctorSchedule
              appointments={result.appointments}
              showDate={filters.range !== "today"}
            />
          )}
        </div>
      </Container>
    </Section>
  );
}

/** One value from a search parameter. A repeated one is discarded entirely. */
function readParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
