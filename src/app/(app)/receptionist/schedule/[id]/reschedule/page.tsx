import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { StaffRescheduleForm } from "@/components/reception/staff-reschedule-form";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { BOOKING_RULES } from "@/config/appointments";
import { bookableDates } from "@/features/appointments/availability";
import { getWorkingIntervals } from "@/features/appointments/queries";
import { toClinicIsoDate } from "@/features/appointments/time";
import {
  APPOINTMENT_ACTIONS_COPY,
  APPOINTMENT_DETAIL_COPY,
  RECEPTION_AREA,
} from "@/features/reception/content";
import { getScheduledAppointment } from "@/features/reception/queries";
import { canStaffReschedule } from "@/features/reception/status";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: APPOINTMENT_ACTIONS_COPY.rescheduleHeading,
  robots: { index: false, follow: false },
};

/**
 * Moving an appointment to a new time.
 *
 * ## Its own page rather than a dialog
 *
 * Choosing a day and then a time is two decisions and a list that can be long,
 * which is more than a dialog holds comfortably on the tablet this workspace
 * is used on. The patient flow made the same call in Phase 09.
 *
 * ## What is checked here, and what actually decides
 *
 * This page refuses to render the form for an appointment whose status cannot
 * be rescheduled, so the receptionist is told rather than shown a form that
 * will fail. `reschedule_appointment_as_staff` re-derives the same rule, the
 * duration from the stored appointment type, and every booking rule through
 * the one shared validator — and the exclusion constraint settles a race with
 * a patient booking the same slot from home.
 *
 * Unlike the patient path, an appointment whose start time has already passed
 * may still be moved. A patient who arrives late and is fitted in an hour
 * later is an ordinary afternoon at a clinic; the *new* time still has to be
 * in the future.
 */
export default async function ReceptionReschedulePage({
  params,
}: PageProps<"/receptionist/schedule/[id]/reschedule">) {
  await requirePermission("appointments.manage.any", "/receptionist/schedule");

  const { id } = await params;
  const result = await getScheduledAppointment(id);

  if (result.status === "unavailable") {
    return (
      <RescheduleShell appointmentId={id}>
        <ErrorState
          title={APPOINTMENT_DETAIL_COPY.loadErrorTitle}
          description={APPOINTMENT_DETAIL_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/receptionist/schedule/${id}/reschedule`}>
                {APPOINTMENT_DETAIL_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </RescheduleShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <RescheduleShell appointmentId={id}>
        <EmptyState
          title={APPOINTMENT_DETAIL_COPY.notFoundTitle}
          description={APPOINTMENT_DETAIL_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/receptionist/schedule">
                {APPOINTMENT_DETAIL_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </RescheduleShell>
    );
  }

  const { appointment } = result;

  if (!canStaffReschedule(appointment.status)) {
    return (
      <RescheduleShell appointmentId={appointment.id}>
        <EmptyState
          title="This appointment can't be moved"
          description={APPOINTMENT_ACTIONS_COPY.noneAvailable}
          action={
            <Button asChild>
              <Link href={`/receptionist/schedule/${appointment.id}`}>
                Back to the appointment
              </Link>
            </Button>
          }
        />
      </RescheduleShell>
    );
  }

  const intervals = await getWorkingIntervals(appointment.practitionerId);
  const dates = bookableDates({
    workingIntervals: intervals,
    from: toClinicIsoDate(new Date()),
    days: BOOKING_RULES.maxHorizonDays + 1,
    maxHorizonDays: BOOKING_RULES.maxHorizonDays,
  });

  return (
    <RescheduleShell appointmentId={appointment.id}>
      <StaffRescheduleForm
        appointmentId={appointment.id}
        practitionerId={appointment.practitionerId}
        appointmentTypeId={appointment.appointmentTypeId}
        currentStartsAt={appointment.startsAt.toISOString()}
        currentEndsAt={appointment.endsAt.toISOString()}
        dates={dates}
      />
    </RescheduleShell>
  );
}

/** The page frame, shared by all four outcomes, owning the single `<h1>`. */
function RescheduleShell({
  appointmentId,
  children,
}: {
  readonly appointmentId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Section aria-labelledby="reception-reschedule-heading">
      <Container width="content">
        <Link
          href={`/receptionist/schedule/${appointmentId}`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {RECEPTION_AREA.appointment.title}
        </Link>

        <div className="mt-2">
          <SectionHeader
            as="h1"
            titleId="reception-reschedule-heading"
            title={APPOINTMENT_ACTIONS_COPY.rescheduleHeading}
            description={APPOINTMENT_ACTIONS_COPY.rescheduleDescription}
          />
        </div>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
