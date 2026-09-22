import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentHistory } from "@/components/appointments/appointment-history";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { appointmentReference } from "@/components/appointments/appointment-summary";
import { DoctorAppointmentActions } from "@/components/doctor/appointment-status-actions";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
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
import {
  DOCTOR_ACTIONS_COPY,
  DOCTOR_APPOINTMENT_COPY,
  DOCTOR_AREA,
  CONSULTATION_COPY,
} from "@/features/doctor/content";
import { getDoctorAppointment } from "@/features/doctor/queries";
import {
  canStartConsultation,
  isConsultationInProgress,
} from "@/features/doctor/status";
import { calculateAge } from "@/features/patients/format";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the date, the type or the patient's name. A page title reaches
  // browser history, the tab strip and a screen share.
  title: DOCTOR_AREA.appointment.title,
  robots: { index: false, follow: false },
};

/**
 * One of the practitioner's own appointments, and what they can do about it.
 *
 * ## The id in the URL is a filter, not a key to the door
 *
 * `getDoctorAppointment` checks the permission and runs under
 * `appointments_select_own_practitioner`, which restricts the table to the
 * caller's own diary. Another practitioner's appointment returns
 * `not_found` — the same answer as an id that never existed, so an
 * appointment id is not an oracle for whether somebody else's appointment
 * exists (`phase_11.md` sections 23-24).
 *
 * ## Which actions appear, and what actually decides
 *
 * `DoctorAppointmentActions` composes the transition matrix with the
 * practitioner's status allowlist, so `cancelled` is never offered and a
 * terminal appointment offers nothing. Hiding a control is a usability
 * decision and never a security one (`phase_11.md` sections 43 and 45): the
 * action re-checks the permission,
 * `update_appointment_status_as_doctor` re-checks the role, the ownership
 * and the allowlist, and the Phase 09 transition trigger refuses an illegal
 * move whatever either of them decided.
 *
 * ## What is not on this page
 *
 * Any clinical information, the internal note, and the desk's cancellation
 * reason. None is filtered here — `DoctorAppointment` has no field for the
 * first two, `authenticated` holds no column grant on `internal_note`, and
 * the query does not ask for the third.
 */
export default async function DoctorAppointmentPage({
  params,
}: PageProps<"/doctor/appointments/[id]">) {
  await requirePermission(
    "appointments.read.own_schedule",
    "/doctor/appointments",
  );

  const { id } = await params;
  const result = await getDoctorAppointment(id);

  if (result.status === "unavailable") {
    return (
      <DetailShell>
        <ErrorState
          title={DOCTOR_APPOINTMENT_COPY.loadErrorTitle}
          description={DOCTOR_APPOINTMENT_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/doctor/appointments/${id}`}>
                {DOCTOR_APPOINTMENT_COPY.loadErrorRetryLabel}
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
          title={DOCTOR_APPOINTMENT_COPY.notFoundTitle}
          description={DOCTOR_APPOINTMENT_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/appointments">
                {DOCTOR_APPOINTMENT_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  const { appointment } = result;
  const events = await getAppointmentHistory(appointment.id);
  const age = appointment.patientDateOfBirth
    ? calculateAge(appointment.patientDateOfBirth)
    : null;

  const inConsultation = isConsultationInProgress(appointment.status);
  const consultationHref = `/doctor/appointments/${appointment.id}/consultation`;

  return (
    <DetailShell>
      <div className="flex flex-col gap-8">
        {inConsultation ? (
          <Alert tone="info" title={CONSULTATION_COPY.startedHeading}>
            {CONSULTATION_COPY.startedDescription}
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
          id="doctor-appointment-patient"
          title={DOCTOR_APPOINTMENT_COPY.patientHeading}
        >
          <ProfileFieldList>
            <ProfileField label="Name" value={appointment.patientName} />
            <ProfileField
              label="Age"
              // Derived, never stored — a stored age is wrong within a year.
              value={age === null ? null : `${age}`}
            />
          </ProfileFieldList>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href={`/doctor/patients/${appointment.patientId}`}>
                {DOCTOR_APPOINTMENT_COPY.openPatientLabel}
              </Link>
            </Button>
          </div>
        </ProfileSection>

        <ProfileSection
          id="doctor-appointment-details"
          title={DOCTOR_APPOINTMENT_COPY.detailsHeading}
        >
          <ProfileFieldList>
            <ProfileField
              label={DOCTOR_APPOINTMENT_COPY.whenLabel}
              value={`${formatClinicDate(appointment.startsAt)}, ${formatClinicTimeRange(
                appointment.startsAt,
                appointment.endsAt,
              )}`}
            />
            <ProfileField
              label={DOCTOR_APPOINTMENT_COPY.durationLabel}
              value={formatDuration(appointment.durationMinutes)}
            />
            <ProfileField
              label={DOCTOR_APPOINTMENT_COPY.typeLabel}
              value={appointment.typeName}
            />
            <ProfileField
              label={DOCTOR_APPOINTMENT_COPY.referenceLabel}
              // A short reference somebody can quote. Not a secret and not an
              // access token — every read of an appointment is restricted by
              // row-level security regardless.
              value={appointmentReference(appointment.id)}
            />
            <ProfileField
              label={DOCTOR_APPOINTMENT_COPY.bookedOnLabel}
              value={formatClinicDateTime(appointment.createdAt)}
            />
            {appointment.patientNote ? (
              <ProfileField
                label={DOCTOR_APPOINTMENT_COPY.noteLabel}
                value={appointment.patientNote}
              />
            ) : null}
            {appointment.cancelledAt ? (
              <ProfileField
                label={DOCTOR_APPOINTMENT_COPY.cancelledOnLabel}
                value={formatClinicDateTime(appointment.cancelledAt)}
              />
            ) : null}
          </ProfileFieldList>
        </ProfileSection>

        <section
          aria-labelledby="doctor-appointment-actions"
          className="flex flex-col gap-4"
        >
          <h2
            id="doctor-appointment-actions"
            className="text-h5 text-heading font-sans font-medium"
          >
            {DOCTOR_ACTIONS_COPY.heading}
          </h2>

          <DoctorAppointmentActions
            appointmentId={appointment.id}
            status={appointment.status}
          />

          {/*
            The consultation entry point. It is a link rather than a second
            copy of the "Start consultation" button: starting the consultation
            is the status change above, and this opens the workspace for one
            that is already under way. Offering both as buttons would make it
            unclear which one did what.
          */}
          {inConsultation ? (
            <div>
              <Button asChild>
                <Link href={consultationHref}>{CONSULTATION_COPY.heading}</Link>
              </Button>
            </div>
          ) : null}

          {canStartConsultation(appointment.status) ? (
            <p className="text-body-sm text-muted-foreground measure">
              {CONSULTATION_COPY.notStartedDescription}
            </p>
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
 * generic — never the patient's name — for the same reason the metadata
 * title is.
 */
function DetailShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <Section aria-labelledby="doctor-appointment-heading">
      <Container width="content">
        <Link
          href="/doctor/appointments"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {DOCTOR_APPOINTMENT_COPY.backLabel}
        </Link>

        <h1
          id="doctor-appointment-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {DOCTOR_APPOINTMENT_COPY.heading}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
