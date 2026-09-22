import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentHistory } from "@/components/appointments/appointment-history";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { appointmentReference } from "@/components/appointments/appointment-summary";
import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { AppointmentStatusActions } from "@/components/reception/appointment-status-actions";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getAppointmentHistory } from "@/features/appointments/queries";
import {
  formatClinicDate,
  formatClinicDateTime,
  formatClinicTimeRange,
  formatDuration,
} from "@/features/appointments/time";
import { formatPhone } from "@/features/patients/format";
import {
  APPOINTMENT_ACTIONS_COPY,
  APPOINTMENT_DETAIL_COPY,
  RECEPTION_AREA,
  STAFF_BOOKING_COPY,
} from "@/features/reception/content";
import { getScheduledAppointment } from "@/features/reception/queries";
import { canStaffReschedule } from "@/features/reception/status";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the date, the practitioner or the patient's name. A page title
  // reaches browser history, the tab strip and a screen share.
  title: RECEPTION_AREA.appointment.title,
  robots: { index: false, follow: false },
};

/**
 * One appointment, and what the front desk can do about it.
 *
 * ## Which actions appear, and what actually decides
 *
 * `AppointmentStatusActions` composes the transition matrix with the
 * receptionist's status allowlist, so a terminal appointment offers nothing
 * and `completed` is never offered at all. Hiding a control is a usability
 * decision and never a security one (`phase_10.md` example 5): the action
 * re-checks the permission, `update_appointment_status_as_staff` re-checks the
 * role and the allowlist, and the Phase 09 transition trigger refuses an
 * illegal move whatever either of them decided.
 *
 * The same goes for rescheduling: this page decides whether to show a link,
 * and `reschedule_appointment_as_staff` decides whether it happens.
 *
 * ## What is not on this page
 *
 * Any clinical information, and the internal note. Neither is filtered here —
 * `ScheduledAppointment` has no field for either, `authenticated` holds no
 * column grant on `internal_note`, and the tables these queries read have no
 * clinical column at all.
 *
 * ## This page is also the booking confirmation
 *
 * The booking action redirects here with `?booked=1` and the page renders the
 * row. What is confirmed is therefore whatever the database says, always —
 * rather than what the form thought it had done.
 */
export default async function ReceptionAppointmentPage({
  params,
  searchParams,
}: PageProps<"/receptionist/schedule/[id]">) {
  await requirePermission("appointments.manage.any", "/receptionist/schedule");

  const { id } = await params;
  const query = await searchParams;
  const result = await getScheduledAppointment(id);

  if (result.status === "unavailable") {
    return (
      <DetailShell>
        <ErrorState
          title={APPOINTMENT_DETAIL_COPY.loadErrorTitle}
          description={APPOINTMENT_DETAIL_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/receptionist/schedule/${id}`}>
                {APPOINTMENT_DETAIL_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <DetailShell>
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
      </DetailShell>
    );
  }

  const { appointment } = result;
  const events = await getAppointmentHistory(appointment.id);

  const justBooked = query["booked"] === "1";
  const justMoved = query["moved"] === "1";
  const showReschedule = canStaffReschedule(appointment.status);

  return (
    <DetailShell>
      <div className="flex flex-col gap-8">
        {justBooked ? (
          <Alert tone="success" title={STAFF_BOOKING_COPY.successTitle}>
            {STAFF_BOOKING_COPY.successBody}
          </Alert>
        ) : null}

        {justMoved ? (
          <Alert
            tone="success"
            title={APPOINTMENT_ACTIONS_COPY.rescheduleSuccessTitle}
          >
            {APPOINTMENT_ACTIONS_COPY.rescheduleSuccessBody}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <AppointmentStatusBadge status={appointment.status} />
          <p className="text-h4 text-heading font-sans font-medium">
            <time dateTime={appointment.startsAt.toISOString()}>
              {formatClinicDate(appointment.startsAt)},{" "}
              {formatClinicTimeRange(appointment.startsAt, appointment.endsAt)}
            </time>
          </p>
        </div>

        <ProfileSection
          id="reception-appointment-patient"
          title={APPOINTMENT_DETAIL_COPY.patientHeading}
        >
          <ProfileFieldList>
            <ProfileField
              label={APPOINTMENT_DETAIL_COPY.patientNameLabel}
              value={appointment.patientName}
            />
            <ProfileField
              label={APPOINTMENT_DETAIL_COPY.patientPhoneLabel}
              value={formatPhone(appointment.patientPhone)}
            />
          </ProfileFieldList>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href={`/receptionist/patients/${appointment.patientId}`}>
                {APPOINTMENT_DETAIL_COPY.openPatientLabel}
              </Link>
            </Button>
          </div>
        </ProfileSection>

        <ProfileSection
          id="reception-appointment-details"
          title={APPOINTMENT_DETAIL_COPY.summaryHeading}
        >
          <ProfileFieldList>
            <ProfileField
              label={APPOINTMENT_DETAIL_COPY.whenLabel}
              value={`${formatClinicDate(appointment.startsAt)}, ${formatClinicTimeRange(
                appointment.startsAt,
                appointment.endsAt,
              )}`}
            />
            <ProfileField
              label={APPOINTMENT_DETAIL_COPY.durationLabel}
              value={formatDuration(appointment.durationMinutes)}
            />
            <ProfileField
              label={APPOINTMENT_DETAIL_COPY.typeLabel}
              value={appointment.typeName}
            />
            <ProfileField
              label={APPOINTMENT_DETAIL_COPY.practitionerLabel}
              value={appointment.practitionerName}
            />
            <ProfileField
              label={APPOINTMENT_DETAIL_COPY.referenceLabel}
              // A short reference somebody can quote on the phone. Not a
              // secret and not an access token — every read of an appointment
              // is restricted by row-level security regardless.
              value={appointmentReference(appointment.id)}
            />
            <ProfileField
              label={APPOINTMENT_DETAIL_COPY.bookedOnLabel}
              value={formatClinicDateTime(appointment.createdAt)}
            />
            {appointment.patientNote ? (
              <ProfileField
                label={APPOINTMENT_DETAIL_COPY.noteLabel}
                value={appointment.patientNote}
              />
            ) : null}
            {appointment.cancelledAt ? (
              <ProfileField
                label={APPOINTMENT_DETAIL_COPY.cancelledOnLabel}
                value={formatClinicDateTime(appointment.cancelledAt)}
              />
            ) : null}
            {appointment.cancellationReason ? (
              <ProfileField
                label={APPOINTMENT_DETAIL_COPY.cancellationReasonLabel}
                value={appointment.cancellationReason}
              />
            ) : null}
          </ProfileFieldList>
        </ProfileSection>

        <section
          aria-labelledby="reception-appointment-actions"
          className="flex flex-col gap-4"
        >
          <h2
            id="reception-appointment-actions"
            className="text-h5 text-heading font-sans font-medium"
          >
            {APPOINTMENT_ACTIONS_COPY.heading}
          </h2>

          <AppointmentStatusActions
            appointmentId={appointment.id}
            status={appointment.status}
          />

          {showReschedule ? (
            <div>
              <Button asChild variant="secondary">
                <Link
                  href={`/receptionist/schedule/${appointment.id}/reschedule`}
                >
                  {APPOINTMENT_ACTIONS_COPY.rescheduleLabel}
                </Link>
              </Button>
            </div>
          ) : null}
        </section>

        <AppointmentHistory events={events} />
      </div>
    </DetailShell>
  );
}

/**
 * The page frame, shared by all three outcomes.
 *
 * It owns the `<h1>` so every state has exactly one, including the two that
 * render an error rather than an appointment. The heading is deliberately
 * generic — never the patient's name — for the same reason the metadata title
 * is: a heading is read over a shoulder at a front desk.
 */
function DetailShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <Section aria-labelledby="reception-appointment-heading">
      <Container width="content">
        <Link
          href="/receptionist/schedule"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {APPOINTMENT_DETAIL_COPY.backLabel}
        </Link>

        <h1
          id="reception-appointment-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {APPOINTMENT_DETAIL_COPY.heading}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
