import type { Metadata } from "next";
import Link from "next/link";

import { RescheduleForm } from "@/components/appointments/reschedule-form";
import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { BOOKING_RULES } from "@/config/appointments";
import { bookableDates } from "@/features/appointments/availability";
import {
  APPOINTMENT_COPY,
  APPOINTMENTS_AREA,
} from "@/features/appointments/content";
import {
  getAppointment,
  getWorkingIntervals,
} from "@/features/appointments/queries";
import { canPatientReschedule } from "@/features/appointments/status";
import { toClinicIsoDate } from "@/features/appointments/time";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: APPOINTMENTS_AREA.reschedule.title,
  robots: { index: false, follow: false },
};

/**
 * Choosing a new time for an existing appointment.
 *
 * ## Why it is a page rather than a dialog
 *
 * Rescheduling means choosing a date and then a time, each with a loading
 * state and an empty state of its own. That is more than a dialog should hold,
 * and `docs/DESIGN_SYSTEM.md` section 31 asks for modals only where the user's
 * attention is genuinely required. Cancelling — one decision, destructive — is
 * the dialog; this is a page.
 *
 * ## The guards, in order
 *
 *   1. The booking permission, server-side.
 *   2. The appointment must be readable, which row-level security restricts to
 *      the caller's own. Somebody else's id renders "we couldn't find that",
 *      the same as an id that never existed.
 *   3. It must still be in a status and a time that allow a move.
 *
 * None of those is the guarantee. `reschedule_appointment` re-derives all
 * three inside the database, re-reads the duration from the appointment type
 * so a patient cannot lengthen their own appointment, and relies on the same
 * exclusion constraint as a booking — which is what makes a reschedule safe
 * under concurrency rather than merely validated (`phase_09.md` section 30).
 */
export default async function RescheduleAppointmentPage({
  params,
}: PageProps<"/patient/appointments/[id]/reschedule">) {
  await requirePermission("appointments.write.self", "/patient/appointments");

  const { id } = await params;
  const result = await getAppointment(id);

  if (result.status === "unavailable") {
    return (
      <RescheduleShell>
        <ErrorState
          title={APPOINTMENT_COPY.loadErrorTitle}
          description={APPOINTMENT_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/patient/appointments/${id}/reschedule`}>
                {APPOINTMENT_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </RescheduleShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <RescheduleShell>
        <EmptyState
          title={APPOINTMENT_COPY.notFoundTitle}
          description={APPOINTMENT_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/patient/appointments">
                {APPOINTMENT_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </RescheduleShell>
    );
  }

  const { appointment } = result;

  const movable = canPatientReschedule({
    status: appointment.status,
    startsAt: appointment.startsAt,
    now: new Date(),
  });

  if (!movable) {
    return (
      <RescheduleShell>
        <EmptyState
          title="This appointment can no longer be changed"
          description="Appointments can be moved while they are still upcoming and have not been cancelled or completed. Please contact the clinic if you need to change it."
          action={
            <Button asChild>
              <Link href={`/patient/appointments/${appointment.id}`}>
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
    <RescheduleShell>
      <RescheduleForm
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

/** The page frame, so every outcome has exactly one `<h1>`. */
function RescheduleShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <Section aria-labelledby="reschedule-heading">
      <Container width="content">
        <SectionHeader
          as="h1"
          titleId="reschedule-heading"
          title={APPOINTMENTS_AREA.reschedule.heading}
          description={APPOINTMENTS_AREA.reschedule.description}
        />
        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
