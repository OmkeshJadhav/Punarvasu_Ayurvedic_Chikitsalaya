import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DOCTOR_DOCUMENT_COPY,
  DOCUMENT_AREA,
} from "@/features/documents/content";
import { listCarePatientDocuments } from "@/features/documents/queries";
import type { PatientDocument } from "@/features/documents/types";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * Every document on one patient's record, for a practitioner treating them.
 *
 * ## The id in the URL is a filter, not a key to the door
 *
 * Exactly the case `phase_11.md` section 24 named for patients and
 * `phase_14.md` example 3 names again for documents:
 * `GET /doctor/patients/123/documents` must not return patient 123's files
 * to any authenticated doctor. It does not.
 * `patient_documents_select_doctor_care` requires an appointment between
 * that patient and the caller's **own** practitioner record, so a patient
 * they are not booked to see yields an empty list — indistinguishable from a
 * patient with no documents, and from a patient who does not exist.
 *
 * ## There is no upload here
 *
 * A practitioner uploads from the appointment they are working in, so that
 * the patient, the appointment and the consultation are inherited rather
 * than chosen (section 47). This page reads; the consultation page writes.
 */
export const metadata: Metadata = {
  title: DOCUMENT_AREA.doctorList.title,
  robots: { index: false, follow: false },
};

export default async function DoctorPatientDocumentsPage({
  params,
}: PageProps<"/doctor/patients/[id]/documents">) {
  await requirePermission("documents.read.care", "/doctor/patients");

  const { id } = await params;
  const result = await listCarePatientDocuments(id);

  return (
    <PatientDocumentsShell patientId={id}>
      <div className="flex flex-col gap-4">
        {result.status === "unavailable" ? (
          <ErrorState
            title={DOCTOR_DOCUMENT_COPY.errorTitle}
            description={DOCTOR_DOCUMENT_COPY.errorDescription}
            action={
              <Button asChild variant="secondary">
                <Link href={`/doctor/patients/${id}/documents`}>
                  {DOCTOR_DOCUMENT_COPY.errorTitle}
                </Link>
              </Button>
            }
          />
        ) : result.documents.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title={DOCTOR_DOCUMENT_COPY.emptyTitle}
            description={DOCTOR_DOCUMENT_COPY.emptyDescription}
          />
        ) : (
          <>
            <DocumentList
              documents={result.documents}
              hrefFor={(document: PatientDocument) =>
                `/doctor/patients/${id}/documents/${document.id}`
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
      </div>
    </PatientDocumentsShell>
  );
}

function PatientDocumentsShell({
  patientId,
  children,
}: {
  readonly patientId: string;
  readonly children: ReactNode;
}) {
  return (
    <Section aria-labelledby="doctor-patient-documents-heading">
      <Container width="content">
        <Link
          href={`/doctor/patients/${patientId}`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {DOCTOR_DOCUMENT_COPY.backToPatientLabel}
        </Link>

        <h1
          id="doctor-patient-documents-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {DOCTOR_DOCUMENT_COPY.heading}
        </h1>
        <p className="text-body text-muted-foreground measure mt-2">
          {DOCTOR_DOCUMENT_COPY.description}
        </p>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
