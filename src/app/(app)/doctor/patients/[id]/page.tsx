import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  FileText,
  NotebookPen,
  Pill,
} from "lucide-react";

import { ClinicalHistory } from "@/components/clinical/clinical-history";
import { DocumentList } from "@/components/documents/document-list";
import { PrescriptionHistory } from "@/components/prescriptions/prescription-history";
import { TreatmentPlanHistory } from "@/components/treatment-plans/treatment-plan-history";
import { DoctorSchedule } from "@/components/doctor/doctor-schedule";
import { CarePatientSummary } from "@/components/doctor/patient-summary";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CLINICAL_HISTORY_COPY } from "@/features/clinical/content";
import { getPatientClinicalHistory } from "@/features/clinical/queries";
import { DOCTOR_DOCUMENT_COPY } from "@/features/documents/content";
import { listCarePatientDocuments } from "@/features/documents/queries";
import type { PatientDocument } from "@/features/documents/types";
import { DOCTOR_AREA, DOCTOR_PATIENT_COPY } from "@/features/doctor/content";
import {
  getCarePatient,
  getCarePatientAppointments,
  partitionByTime,
} from "@/features/doctor/queries";
import { PRESCRIPTION_HISTORY_COPY } from "@/features/prescriptions/content";
import { listPatientPrescriptionsForDoctor } from "@/features/prescriptions/queries";
import { TREATMENT_PLAN_HISTORY_COPY } from "@/features/treatment-plans/content";
import { listPatientTreatmentPlansForDoctor } from "@/features/treatment-plans/queries";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the patient's name. A page title reaches browser history, the tab
  // strip and a screen share, and a consulting-room screen is read over
  // shoulders.
  title: DOCTOR_AREA.patient.title,
  robots: { index: false, follow: false },
};

/**
 * One patient's context, and this practitioner's appointment history with
 * them.
 *
 * ## The id in the URL is a filter, not a key to the door
 *
 * This is the case `phase_11.md` section 24 names exactly:
 * `GET /doctor/patients/123` must not return patient 123 to any authenticated
 * doctor. It does not. `getCarePatient` checks the permission and runs under
 * `patients_select_doctor_care`, which requires an appointment between that
 * patient and the caller's *own* practitioner record. A patient the caller is
 * not booked to see returns `not_found` — the same answer as a patient who
 * does not exist, so the id is not an oracle either.
 *
 * Two doctors at the same clinic are therefore isolated from each other's
 * patients, which is `phase_11.md` section 60's requirement and
 * `docs/SECURITY.md` section 6's treatment-relationship scoping.
 *
 * ## Appointment history, never clinical history
 *
 * `phase_11.md` sections 32-33. The rows carry a date, a type and a status,
 * and nothing else — `DoctorAppointment` has no field for a note, an
 * assessment or a prescription, and the tables beneath it have no column for
 * one.
 *
 * The history is also **this practitioner's own**: row-level security
 * restricts the appointments table to their diary, so a doctor sees when they
 * saw this patient, not when a colleague did. That is the scoping the
 * security model asks for rather than a limitation of the query.
 *
 * ## Bounded
 *
 * The twenty most recent. A long-standing patient's whole history is not
 * something anybody reads in one sitting, and an unbounded query on a page
 * that renders every row is how a screen becomes slow years after it was
 * written (`phase_11.md` section 61).
 */
export default async function DoctorPatientPage({
  params,
}: PageProps<"/doctor/patients/[id]">) {
  await requirePermission("patients.read.care", "/doctor/patients");

  const { id } = await params;
  const result = await getCarePatient(id);

  if (result.status === "unavailable") {
    return (
      <PatientShell>
        <ErrorState
          title={DOCTOR_PATIENT_COPY.loadErrorTitle}
          description={DOCTOR_PATIENT_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/doctor/patients/${id}`}>
                {DOCTOR_PATIENT_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </PatientShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <PatientShell>
        <EmptyState
          title={DOCTOR_PATIENT_COPY.notFoundTitle}
          description={DOCTOR_PATIENT_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/patients">
                {DOCTOR_PATIENT_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </PatientShell>
    );
  }

  const { patient } = result;
  // Every read is independent and every one is bounded, so they run together
  // rather than one after the other (section 84: avoid repeated queries and
  // do not load more than the page renders). None of the three history reads
  // fetches any clinical content — a count, a status and a date each.
  const [
    appointments,
    clinicalHistory,
    prescriptions,
    treatmentPlans,
    documents,
  ] = await Promise.all([
    getCarePatientAppointments(patient.id),
    getPatientClinicalHistory(patient.id),
    listPatientPrescriptionsForDoctor(patient.id),
    listPatientTreatmentPlansForDoctor(patient.id),
    listCarePatientDocuments(patient.id),
  ]);
  // Split in the feature layer rather than here, so the impure "what time is
  // it" call lives outside the component — which React's purity rule requires
  // and which also makes the split testable without a clock.
  const { upcoming, past } = partitionByTime(appointments);

  return (
    <PatientShell>
      <div className="flex flex-col gap-8">
        <h2 className="text-h3 text-heading font-normal wrap-break-word">
          {patient.preferredName?.trim() || patient.fullName}
        </h2>

        <CarePatientSummary patient={patient} />

        {/*
          The clinical history, above the appointment history deliberately.

          `phase_12.md` section 39: a practitioner about to see somebody reads
          what happened last time before they read when it happened. Phase 11
          could only offer the appointment list, and said so in a notice; the
          notice is gone because the thing it named now exists.

          Every entry is a consultation **this practitioner documented** —
          `clinical_records_select_author` decides that, not this page — and
          the notice beneath says so, because an empty list has two possible
          explanations and the practitioner needs to know which.
        */}
        <section aria-labelledby="doctor-patient-clinical">
          <h2
            id="doctor-patient-clinical"
            className="text-h4 text-heading font-sans font-medium"
          >
            {CLINICAL_HISTORY_COPY.heading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure mt-1">
            {CLINICAL_HISTORY_COPY.description}
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {clinicalHistory.status === "unavailable" ? (
              <ErrorState
                title={CLINICAL_HISTORY_COPY.errorTitle}
                description={CLINICAL_HISTORY_COPY.errorDescription}
              />
            ) : clinicalHistory.entries.length === 0 ? (
              <EmptyState
                icon={<NotebookPen />}
                title={CLINICAL_HISTORY_COPY.emptyTitle}
                description={CLINICAL_HISTORY_COPY.emptyDescription}
              />
            ) : (
              <>
                <ClinicalHistory
                  entries={clinicalHistory.entries}
                  patientId={patient.id}
                />
                <p className="text-body-sm text-muted-foreground measure">
                  {CLINICAL_HISTORY_COPY.boundedNotice}
                </p>
              </>
            )}

            <Alert tone="info" title={CLINICAL_HISTORY_COPY.scopeNotice.title}>
              {CLINICAL_HISTORY_COPY.scopeNotice.body}
            </Alert>
          </div>
        </section>

        {/*
          Phase 13. Prescriptions and treatment plans, each its own section
          and each scoped to what *this* practitioner wrote — the
          authoring-practitioner model the clinical history already follows.
          Neither list carries a medicine name or an instruction: a list is
          read at a glance, often with somebody else in the room.
        */}
        <section aria-labelledby="doctor-patient-prescriptions">
          <h2
            id="doctor-patient-prescriptions"
            className="text-h4 text-heading font-sans font-medium"
          >
            {PRESCRIPTION_HISTORY_COPY.heading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure mt-1">
            {PRESCRIPTION_HISTORY_COPY.description}
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {prescriptions.status === "unavailable" ? (
              <ErrorState
                title={PRESCRIPTION_HISTORY_COPY.errorTitle}
                description={PRESCRIPTION_HISTORY_COPY.errorDescription}
              />
            ) : prescriptions.prescriptions.length === 0 ? (
              <EmptyState
                icon={<Pill />}
                title={PRESCRIPTION_HISTORY_COPY.emptyTitle}
                description={PRESCRIPTION_HISTORY_COPY.emptyDescription}
              />
            ) : (
              <>
                <PrescriptionHistory
                  prescriptions={prescriptions.prescriptions}
                  patientId={patient.id}
                />
                <p className="text-body-sm text-muted-foreground measure">
                  {PRESCRIPTION_HISTORY_COPY.boundedNotice}
                </p>
              </>
            )}
            <Alert
              tone="info"
              title={PRESCRIPTION_HISTORY_COPY.scopeNotice.title}
            >
              {PRESCRIPTION_HISTORY_COPY.scopeNotice.body}
            </Alert>
          </div>
        </section>

        <section aria-labelledby="doctor-patient-plans">
          <h2
            id="doctor-patient-plans"
            className="text-h4 text-heading font-sans font-medium"
          >
            {TREATMENT_PLAN_HISTORY_COPY.heading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure mt-1">
            {TREATMENT_PLAN_HISTORY_COPY.description}
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {treatmentPlans.status === "unavailable" ? (
              <ErrorState
                title={TREATMENT_PLAN_HISTORY_COPY.errorTitle}
                description={TREATMENT_PLAN_HISTORY_COPY.errorDescription}
              />
            ) : treatmentPlans.plans.length === 0 ? (
              <EmptyState
                icon={<ClipboardList />}
                title={TREATMENT_PLAN_HISTORY_COPY.emptyTitle}
                description={TREATMENT_PLAN_HISTORY_COPY.emptyDescription}
              />
            ) : (
              <>
                <TreatmentPlanHistory
                  plans={treatmentPlans.plans}
                  patientId={patient.id}
                />
                <p className="text-body-sm text-muted-foreground measure">
                  {TREATMENT_PLAN_HISTORY_COPY.boundedNotice}
                </p>
              </>
            )}
            <Alert
              tone="info"
              title={TREATMENT_PLAN_HISTORY_COPY.scopeNotice.title}
            >
              {TREATMENT_PLAN_HISTORY_COPY.scopeNotice.body}
            </Alert>
          </div>
        </section>

        {/*
          Phase 14. Documents are scoped by the **care relationship** rather
          than by authorship, unlike the three histories above: a lab report
          is evidence the patient brought for whoever is treating them, not a
          colleague's conclusion about them. The reasoning is in the Phase 14
          migration's header, and the notice beneath says which scope this is.

          The list carries nothing about a file's contents, because nothing
          in Punarvasu reads one.
        */}
        <section aria-labelledby="doctor-patient-documents">
          <h2
            id="doctor-patient-documents"
            className="text-h4 text-heading font-sans font-medium"
          >
            {DOCTOR_DOCUMENT_COPY.heading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure mt-1">
            {DOCTOR_DOCUMENT_COPY.description}
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {documents.status === "unavailable" ? (
              <ErrorState
                title={DOCTOR_DOCUMENT_COPY.errorTitle}
                description={DOCTOR_DOCUMENT_COPY.errorDescription}
              />
            ) : documents.documents.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title={DOCTOR_DOCUMENT_COPY.emptyTitle}
                description={DOCTOR_DOCUMENT_COPY.emptyDescription}
              />
            ) : (
              <>
                <DocumentList
                  documents={documents.documents}
                  hrefFor={(document: PatientDocument) =>
                    `/doctor/patients/${patient.id}/documents/${document.id}`
                  }
                  caption={`${DOCTOR_DOCUMENT_COPY.listCaption} — table`}
                />
                <p className="text-body-sm text-muted-foreground measure">
                  {DOCTOR_DOCUMENT_COPY.boundedNotice}
                </p>
              </>
            )}
            <Alert tone="info" title={DOCTOR_DOCUMENT_COPY.scopeNotice.title}>
              {DOCTOR_DOCUMENT_COPY.scopeNotice.body}
            </Alert>
            <div>
              <Button asChild variant="secondary">
                <Link href={`/doctor/patients/${patient.id}/documents`}>
                  {DOCTOR_DOCUMENT_COPY.patientLinkLabel}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="doctor-patient-upcoming">
          <h2
            id="doctor-patient-upcoming"
            className="text-h4 text-heading font-sans font-medium"
          >
            {DOCTOR_PATIENT_COPY.upcomingHeading}
          </h2>
          <div className="mt-4">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarClock />}
                title={DOCTOR_PATIENT_COPY.upcomingHeading}
                description={DOCTOR_PATIENT_COPY.upcomingEmpty}
              />
            ) : (
              <DoctorSchedule
                appointments={upcoming}
                caption={DOCTOR_PATIENT_COPY.upcomingCaption}
                showDate
              />
            )}
          </div>
        </section>

        <section aria-labelledby="doctor-patient-history">
          <h2
            id="doctor-patient-history"
            className="text-h4 text-heading font-sans font-medium"
          >
            {DOCTOR_PATIENT_COPY.historyHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure mt-1">
            {DOCTOR_PATIENT_COPY.historyBoundedNotice}
          </p>
          <div className="mt-4">
            {past.length === 0 ? (
              <EmptyState
                icon={<CalendarClock />}
                title={DOCTOR_PATIENT_COPY.historyHeading}
                description={DOCTOR_PATIENT_COPY.historyEmpty}
              />
            ) : (
              <DoctorSchedule
                appointments={past}
                caption={DOCTOR_PATIENT_COPY.historyCaption}
                showDate
              />
            )}
          </div>
        </section>
      </div>
    </PatientShell>
  );
}

/**
 * The page frame, shared by all three outcomes.
 *
 * It owns the `<h1>` so every state has exactly one, including the two that
 * render an error rather than a patient. The `<h1>` is generic — "Patient" —
 * and the person's name is an `<h2>` below it, so the document outline does
 * not put somebody's name in the place a screen reader announces first and a
 * tab title mirrors.
 */
function PatientShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <Section aria-labelledby="doctor-patient-heading">
      <Container width="content">
        <Link
          href="/doctor/patients"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {DOCTOR_AREA.patients.title}
        </Link>

        <h1
          id="doctor-patient-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {DOCTOR_AREA.patient.title}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
