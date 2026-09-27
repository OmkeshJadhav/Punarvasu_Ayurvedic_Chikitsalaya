import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppointmentHistory } from "@/components/appointments/appointment-history";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { appointmentReference } from "@/components/appointments/appointment-summary";
import { PatientClinicalHeader } from "@/components/clinical/patient-clinical-header";
import { DoctorAppointmentActions } from "@/components/doctor/appointment-status-actions";
import { ClinicalAISection } from "@/components/doctor/workspace/clinical-ai-section";
import { ConsultationNotesSection } from "@/components/doctor/workspace/consultation-notes-section";
import { DocumentsSection } from "@/components/doctor/workspace/documents-section";
import { PrescriptionSection } from "@/components/doctor/workspace/prescription-section";
import { TreatmentPlanSection } from "@/components/doctor/workspace/treatment-plan-section";
import { WorkspaceNav } from "@/components/doctor/workspace/workspace-nav";
import { WorkspaceSectionFallback } from "@/components/doctor/workspace/workspace-section";
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
import { getConsultationSubject } from "@/features/clinical/queries";
import {
  CONSULTATION_COPY,
  DOCTOR_ACTIONS_COPY,
  DOCTOR_APPOINTMENT_COPY,
  DOCTOR_AREA,
  DOCTOR_WORKSPACE_COPY,
} from "@/features/doctor/content";
import { getDoctorAppointment } from "@/features/doctor/queries";
import { isConsultationInProgress } from "@/features/doctor/status";
import type { DoctorAppointment } from "@/features/doctor/types";
import {
  WORKSPACE_SECTIONS,
  type WorkspaceSection,
} from "@/features/doctor/workspace";
import { calculateAge } from "@/features/patients/format";
import { currentUserCan, requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the date, the type or the patient's name. A page title reaches
  // browser history, the tab strip and a screen share.
  title: DOCTOR_AREA.appointment.title,
  robots: { index: false, follow: false },
};

/**
 * One of the practitioner's own appointments, and everything recorded for it,
 * on one page.
 *
 * ```text
 * Appointment          patient identity, details, status actions
 * Consultation notes   the clinical record                  (Phase 12)
 * Prescription         the live prescription                (Phase 13)
 * Treatment plan       the live plan                        (Phase 13)
 * Documents            the patient's documents, and upload  (Phase 14)
 * AI support           an aid that saves nothing            (Phase 17)
 * History              what has happened to the appointment
 * ```
 *
 * These were five separate pages linked from each other, and a practitioner
 * mid-consultation lost their place moving between them. The old routes now
 * redirect to the matching section here (`appointmentWorkspaceHref`).
 *
 * ## The id in the URL is a filter, not a key to the door
 *
 * `getDoctorAppointment` runs under `appointments_select_own_practitioner`, so
 * another practitioner's appointment is `not_found` — the same answer as an id
 * that never existed (`phase_11.md` sections 23-24) — and no section below is
 * rendered at all.
 *
 * ## Each section is gated on its own permission, and checks it again
 *
 * The route needs only `appointments.read.own_schedule`. Every section's query
 * *asserts* its own permission and throws without it, so a section is rendered
 * only when `currentUserCan` says the caller holds that permission — a role
 * without prescribing rights sees the notes and not a crash. That is
 * presentation, not the boundary: the queries, the actions, row-level security
 * and the database functions each re-check independently.
 *
 * ## Streaming
 *
 * Each section is its own async server component behind `<Suspense>`, so the
 * appointment and the notes are usable while the AI quota or the document
 * list is still being read. The fallback carries the section's id and heading,
 * so a jump link followed early still lands in the right place.
 *
 * ## Several forms, one page
 *
 * The notes, prescription and plan each keep their own `<form>`, their own
 * explicit save and their own unsaved-changes guard. The guards ignore
 * fragment links, so the jump bar never prompts. Leaving the page with more
 * than one form unsaved prompts for the first (the guards share one click
 * listener chain and the first to intercept wins), and the browser's own
 * `beforeunload` prompt covers the rest — nothing is discarded silently.
 *
 * ## What is not on this page
 *
 * The internal note and the desk's cancellation reason. `DoctorAppointment`
 * has no field for the first, `authenticated` holds no column grant on
 * `internal_note`, and the query does not ask for the second.
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

  const [
    events,
    canReadNotes,
    canReadPrescription,
    canReadPlan,
    canReadDocuments,
    canUploadDocuments,
    canUseAI,
  ] = await Promise.all([
    getAppointmentHistory(appointment.id),
    currentUserCan("clinical_records.read"),
    currentUserCan("prescriptions.read"),
    currentUserCan("treatment_plans.read"),
    currentUserCan("documents.read.care"),
    currentUserCan("documents.write.care"),
    currentUserCan("clinical_ai.use"),
  ]);

  // The clinical identity header — date of birth, gender and phone as well as
  // the name — is what lets a practitioner confirm the person in front of
  // them before writing (`phase_12.md` section 29). It is read under the
  // clinical permission, so without it the page falls back to name and age.
  const subject = canReadNotes
    ? await getConsultationSubject(appointment.id)
    : null;

  const showHistory = events.length >= 2;
  const sections: WorkspaceSection[] = [
    "overview",
    ...(canReadNotes ? (["consultation"] as const) : []),
    ...(canReadPrescription ? (["prescription"] as const) : []),
    ...(canReadPlan ? (["treatmentPlan"] as const) : []),
    ...(canReadDocuments ? (["documents"] as const) : []),
    ...(canUseAI ? (["ai"] as const) : []),
    ...(showHistory ? (["history"] as const) : []),
  ];

  return (
    <DetailShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <AppointmentStatusBadge status={appointment.status} />
          <p className="text-h4 text-heading font-sans font-medium">
            <time dateTime={appointment.startsAt.toISOString()}>
              {formatClinicDate(appointment.startsAt)},{" "}
              {formatClinicTimeRange(appointment.startsAt, appointment.endsAt)}
            </time>
          </p>
        </div>

        {isConsultationInProgress(appointment.status) ? (
          <Alert tone="info" title={CONSULTATION_COPY.startedHeading}>
            {CONSULTATION_COPY.startedDescription}
          </Alert>
        ) : null}

        <WorkspaceNav sections={sections} />

        <div
          id={WORKSPACE_SECTIONS.overview}
          className="flex scroll-mt-36 flex-col gap-8 lg:scroll-mt-40"
        >
          {subject?.status === "found" ? (
            <PatientClinicalHeader
              patient={subject.patient}
              appointment={subject.appointment}
              showAppointment={false}
            />
          ) : (
            <PatientBasics appointment={appointment} />
          )}

          <div>
            <Button asChild variant="secondary">
              <Link href={`/doctor/patients/${appointment.patientId}`}>
                {DOCTOR_APPOINTMENT_COPY.openPatientLabel}
              </Link>
            </Button>
          </div>

          <AppointmentDetails appointment={appointment} />

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
              // The notes section's own "Start consultation" also opens the
              // clinical record; offering the status-only one beside it would
              // be two buttons with one label and different effects.
              omit={canReadNotes ? ["in_consultation"] : []}
            />
          </section>
        </div>

        {canReadNotes ? (
          <Suspense
            fallback={
              <WorkspaceSectionFallback
                id={WORKSPACE_SECTIONS.consultation}
                title={DOCTOR_WORKSPACE_COPY.sections.consultation}
              />
            }
          >
            <ConsultationNotesSection
              appointmentId={appointment.id}
              appointmentStatus={appointment.status}
            />
          </Suspense>
        ) : null}

        {canReadPrescription ? (
          <Suspense
            fallback={
              <WorkspaceSectionFallback
                id={WORKSPACE_SECTIONS.prescription}
                title={DOCTOR_WORKSPACE_COPY.sections.prescription}
              />
            }
          >
            <PrescriptionSection appointmentId={appointment.id} />
          </Suspense>
        ) : null}

        {canReadPlan ? (
          <Suspense
            fallback={
              <WorkspaceSectionFallback
                id={WORKSPACE_SECTIONS.treatmentPlan}
                title={DOCTOR_WORKSPACE_COPY.sections.treatmentPlan}
              />
            }
          >
            <TreatmentPlanSection appointmentId={appointment.id} />
          </Suspense>
        ) : null}

        {canReadDocuments ? (
          <Suspense
            fallback={
              <WorkspaceSectionFallback
                id={WORKSPACE_SECTIONS.documents}
                title={DOCTOR_WORKSPACE_COPY.sections.documents}
              />
            }
          >
            <DocumentsSection
              appointmentId={appointment.id}
              patientId={appointment.patientId}
              canUpload={canUploadDocuments}
            />
          </Suspense>
        ) : null}

        {canUseAI ? (
          <Suspense
            fallback={
              <WorkspaceSectionFallback
                id={WORKSPACE_SECTIONS.ai}
                title={DOCTOR_WORKSPACE_COPY.sections.ai}
              />
            }
          >
            <ClinicalAISection appointmentId={appointment.id} />
          </Suspense>
        ) : null}

        {showHistory ? (
          <div
            id={WORKSPACE_SECTIONS.history}
            className="scroll-mt-36 lg:scroll-mt-40"
          >
            <AppointmentHistory events={events} />
          </div>
        ) : null}
      </div>
    </DetailShell>
  );
}

/** Name and age, for a caller who cannot read the clinical identity header. */
function PatientBasics({
  appointment,
}: {
  readonly appointment: DoctorAppointment;
}) {
  const age = appointment.patientDateOfBirth
    ? calculateAge(appointment.patientDateOfBirth)
    : null;

  return (
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
    </ProfileSection>
  );
}

function AppointmentDetails({
  appointment,
}: {
  readonly appointment: DoctorAppointment;
}) {
  return (
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
