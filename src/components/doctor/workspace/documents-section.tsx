import Link from "next/link";
import { FileText } from "lucide-react";

import { WorkspaceSection } from "@/components/doctor/workspace/workspace-section";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DOCTOR_WORKSPACE_COPY } from "@/features/doctor/content";
import { WORKSPACE_SECTIONS } from "@/features/doctor/workspace";
import { DOCTOR_DOCUMENT_COPY } from "@/features/documents/content";
import { listCarePatientDocuments } from "@/features/documents/queries";
import type { PatientDocument } from "@/features/documents/types";

/**
 * The patient's documents, and attaching one to this appointment — formerly
 * its own page at `/documents`.
 *
 * ## Why the patient id is taken from the appointment
 *
 * The page has already read the appointment under
 * `appointments_select_own_practitioner`, so its patient is one this
 * practitioner is booked to see. `listCarePatientDocuments` is scoped by
 * `documents.read.care` and row-level security regardless; the id filters,
 * it does not authorize.
 *
 * Upload is rendered only when the caller also holds `documents.write.care`,
 * which the upload action re-checks along with the appointment's ownership.
 */
export async function DocumentsSection({
  appointmentId,
  patientId,
  canUpload,
}: {
  readonly appointmentId: string;
  readonly patientId: string;
  readonly canUpload: boolean;
}) {
  const documents = await listCarePatientDocuments(patientId);

  return (
    <WorkspaceSection
      id={WORKSPACE_SECTIONS.documents}
      title={DOCTOR_WORKSPACE_COPY.sections.documents}
      description={DOCTOR_DOCUMENT_COPY.consultationDescription}
    >
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
              `/doctor/patients/${patientId}/documents/${document.id}`
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
          <Link href={`/doctor/patients/${patientId}/documents`}>
            {DOCTOR_DOCUMENT_COPY.patientLinkLabel}
          </Link>
        </Button>
      </div>

      {canUpload ? (
        <div className="border-border border-t pt-6">
          <DocumentUploadForm
            appointmentId={appointmentId}
            heading={DOCTOR_DOCUMENT_COPY.uploadHeading}
            description={DOCTOR_DOCUMENT_COPY.uploadDescription}
            guidance={DOCTOR_DOCUMENT_COPY.uploadGuidance}
          />
        </div>
      ) : null}
    </WorkspaceSection>
  );
}
