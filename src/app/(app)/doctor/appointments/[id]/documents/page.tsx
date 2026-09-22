import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ClinicalContextHeader } from "@/components/shared/clinical-context-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DOCTOR_DOCUMENT_COPY,
  DOCUMENT_AREA,
} from "@/features/documents/content";
import {
  getDocumentCareContext,
  listCarePatientDocuments,
} from "@/features/documents/queries";
import type {
  DocumentCareContext,
  PatientDocument,
} from "@/features/documents/types";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * Documents, from inside a consultation (sections 47 and 81).
 *
 * ## The context is inherited, never typed
 *
 * The practitioner arrives here from the appointment they are working in,
 * and the patient, the appointment and the consultation come with them. The
 * upload form has **no patient field and no practitioner field**, and the
 * one identifier it posts — the appointment — is re-resolved inside the
 * database by the caller's own practitioner record before a patient is read
 * out of it. Section 47's "do not require the doctor to manually type these
 * identifiers", and example 3's care-relationship requirement, in the same
 * move.
 *
 * ## An appointment in somebody else's diary is `not_found`
 *
 * `getDocumentCareContext` reads under Phase 09's own-practitioner policy,
 * so a well-formed id for a colleague's appointment is indistinguishable
 * from one that does not exist.
 *
 * ## The list is the patient's whole record, not this appointment's
 *
 * A practitioner looking at a report during a consultation wants the
 * report — not only the ones filed against today's visit. The scope is the
 * care relationship, and the notice beneath says so.
 */
export const metadata: Metadata = {
  // Never the patient's name: a consulting-room screen is read over
  // shoulders, and a page title reaches the tab strip and browser history.
  title: DOCUMENT_AREA.doctorList.title,
  robots: { index: false, follow: false },
};

export default async function ConsultationDocumentsPage({
  params,
}: PageProps<"/doctor/appointments/[id]/documents">) {
  await requirePermission("documents.read.care", "/doctor/appointments");

  const { id } = await params;
  const contextResult = await getDocumentCareContext(id);

  if (contextResult.status === "unavailable") {
    return (
      <ConsultationDocumentsShell appointmentId={id}>
        <ErrorState
          title={DOCTOR_DOCUMENT_COPY.errorTitle}
          description={DOCTOR_DOCUMENT_COPY.errorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/doctor/appointments/${id}/documents`}>
                {DOCTOR_DOCUMENT_COPY.errorTitle}
              </Link>
            </Button>
          }
        />
      </ConsultationDocumentsShell>
    );
  }

  if (contextResult.status === "not_found") {
    return (
      <ConsultationDocumentsShell appointmentId={id}>
        <EmptyState
          title={DOCTOR_DOCUMENT_COPY.notFoundTitle}
          description={DOCTOR_DOCUMENT_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/appointments">
                {DOCTOR_DOCUMENT_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </ConsultationDocumentsShell>
    );
  }

  const { context } = contextResult;
  const documents = await listCarePatientDocuments(context.patientId);

  return (
    <ConsultationDocumentsShell appointmentId={id}>
      <div className="flex flex-col gap-10">
        <ConsultationContext context={context} />

        <section
          aria-labelledby="consultation-documents-list"
          className="flex flex-col gap-4"
        >
          <div>
            <h2
              id="consultation-documents-list"
              className="text-h3 text-heading font-normal"
            >
              {DOCTOR_DOCUMENT_COPY.consultationHeading}
            </h2>
            <p className="text-body-sm text-muted-foreground measure mt-1">
              {DOCTOR_DOCUMENT_COPY.consultationDescription}
            </p>
          </div>

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
                  `/doctor/patients/${context.patientId}/documents/${document.id}`
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
              <Link href={`/doctor/patients/${context.patientId}/documents`}>
                {DOCTOR_DOCUMENT_COPY.patientLinkLabel}
              </Link>
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="consultation-documents-upload"
          className="border-border flex flex-col gap-6 border-t pt-10"
        >
          <h2
            id="consultation-documents-upload"
            className="text-h3 text-heading font-normal"
          >
            {DOCTOR_DOCUMENT_COPY.uploadHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure">
            {DOCTOR_DOCUMENT_COPY.uploadDescription}
          </p>

          <DocumentUploadForm
            appointmentId={context.appointmentId}
            guidance={DOCTOR_DOCUMENT_COPY.uploadGuidance}
          />
        </section>
      </div>
    </ConsultationDocumentsShell>
  );
}

function ConsultationContext({
  context,
}: {
  readonly context: DocumentCareContext;
}) {
  return (
    <ClinicalContextHeader
      heading={DOCTOR_DOCUMENT_COPY.patientHeading}
      fullName={context.patientName}
      preferredName={context.patientPreferredName}
      dateOfBirth={context.patientDateOfBirth}
      appointmentHeading={DOCTOR_DOCUMENT_COPY.appointmentHeading}
      appointmentStartsAt={context.appointmentStartsAt}
      appointmentTypeName={context.appointmentTypeName}
      hint={DOCTOR_DOCUMENT_COPY.identityHint}
      labels={{
        dateOfBirth: DOCTOR_DOCUMENT_COPY.dateOfBirthLabel,
        age: DOCTOR_DOCUMENT_COPY.ageLabel,
        // No phone number is passed, so this never renders: attaching a
        // report needs no contact detail. Phase 11's data-minimisation rule
        // for the doctor's patient reads, applied again.
        phone: DOCTOR_DOCUMENT_COPY.phoneLabel,
        when: DOCTOR_DOCUMENT_COPY.whenLabel,
        type: DOCTOR_DOCUMENT_COPY.typeLabel,
      }}
    />
  );
}

function ConsultationDocumentsShell({
  appointmentId,
  children,
}: {
  readonly appointmentId: string;
  readonly children: ReactNode;
}) {
  return (
    <Section aria-labelledby="consultation-documents-heading">
      <Container width="content">
        <Link
          href={`/doctor/appointments/${appointmentId}/consultation`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {DOCTOR_DOCUMENT_COPY.backToConsultationLabel}
        </Link>

        <h1
          id="consultation-documents-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {DOCTOR_DOCUMENT_COPY.heading}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
