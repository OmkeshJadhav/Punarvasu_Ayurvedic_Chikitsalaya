import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArchiveDocumentDialog } from "@/components/documents/document-archive-dialog";
import { DocumentDetails } from "@/components/documents/document-details";
import { DocumentViewer } from "@/components/documents/document-viewer";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import {
  DOCTOR_DOCUMENT_COPY,
  DOCUMENT_AREA,
  DOCUMENT_DETAIL_COPY,
} from "@/features/documents/content";
import { getCarePatientDocument } from "@/features/documents/queries";
import {
  canArchiveDocument,
  canPreviewDocument,
} from "@/features/documents/status";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * One document on a patient's record, for a practitioner treating them.
 *
 * ## Both ids in the URL are filters
 *
 * Attack 1, from the practitioner's side. The document is resolved by its
 * own id under `patient_documents_select_doctor_care`, which requires a care
 * relationship with **its** patient — so changing either id in the address
 * bar reaches nothing. The patient id in the path decides only where "back"
 * goes.
 *
 * ## Archiving is offered only to the uploader
 *
 * Section 34: a clinician cannot quietly remove a report the patient
 * supplied. The control is hidden for a document somebody else uploaded, and
 * `archive_patient_document` refuses it regardless — hiding it is the
 * courtesy, the database is the control.
 */
export const metadata: Metadata = {
  // Never the patient's name and never the document's title.
  title: DOCUMENT_AREA.doctorDetail.title,
  robots: { index: false, follow: false },
};

export default async function DoctorPatientDocumentPage({
  params,
}: PageProps<"/doctor/patients/[id]/documents/[documentId]">) {
  await requirePermission("documents.read.care", "/doctor/patients");

  const { id, documentId } = await params;
  const result = await getCarePatientDocument(documentId);

  if (result.status === "unavailable") {
    return (
      <DocumentShell patientId={id}>
        <ErrorState
          title={DOCUMENT_DETAIL_COPY.loadErrorTitle}
          description={DOCUMENT_DETAIL_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/doctor/patients/${id}/documents/${documentId}`}>
                {DOCUMENT_DETAIL_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </DocumentShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <DocumentShell patientId={id}>
        <EmptyState
          title={DOCUMENT_DETAIL_COPY.notFoundTitle}
          description={DOCUMENT_DETAIL_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href={`/doctor/patients/${id}/documents`}>
                {DOCUMENT_DETAIL_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </DocumentShell>
    );
  }

  const { document } = result;

  return (
    <DocumentShell patientId={id}>
      <div className="flex flex-col gap-8">
        <h2 className="text-h3 text-heading font-normal wrap-break-word">
          {document.title}
        </h2>

        <DocumentViewer
          documentId={document.id}
          previewable={canPreviewDocument(document)}
          archived={document.status === "archived"}
        />

        <DocumentDetails document={document} audience="doctor" />

        {canArchiveDocument(document) ? (
          <div>
            <ArchiveDocumentDialog documentId={document.id} />
          </div>
        ) : null}
      </div>
    </DocumentShell>
  );
}

function DocumentShell({
  patientId,
  children,
}: {
  readonly patientId: string;
  readonly children: ReactNode;
}) {
  return (
    <Section aria-labelledby="doctor-document-heading">
      <Container width="content">
        <Link
          href={`/doctor/patients/${patientId}/documents`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {DOCUMENT_DETAIL_COPY.backToListLabel}
        </Link>

        <h1
          id="doctor-document-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {DOCTOR_DOCUMENT_COPY.heading}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
