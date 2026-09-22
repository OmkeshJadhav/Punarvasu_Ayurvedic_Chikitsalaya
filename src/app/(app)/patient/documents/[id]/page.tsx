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
  DOCUMENT_AREA,
  DOCUMENT_DETAIL_COPY,
  PATIENT_DOCUMENT_COPY,
} from "@/features/documents/content";
import { getPatientDocument } from "@/features/documents/queries";
import {
  canArchiveDocument,
  canPreviewDocument,
} from "@/features/documents/status";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * One of the patient's own documents: its details, a preview, a download.
 *
 * ## The id in the URL is a filter, not a key to the door
 *
 * Attack 1. `getPatientDocument` checks the permission and runs under
 * `patient_documents_select_own`, which requires the document's patient to
 * be the caller's own patient record. Another patient's document resolves to
 * `not_found` — **the same answer as a document that does not exist**, so
 * the id is not an oracle either (sections 76 and example 6).
 *
 * ## The title is never in the page title
 *
 * A document title is something the patient wrote about their own health,
 * and a page title reaches browser history, the tab strip and a screen
 * share. The metadata says "Document" and nothing more — the same rule the
 * doctor workspace has followed since Phase 11.
 */
export const metadata: Metadata = {
  title: DOCUMENT_AREA.patientDetail.title,
  robots: { index: false, follow: false },
};

export default async function PatientDocumentPage({
  params,
}: PageProps<"/patient/documents/[id]">) {
  await requirePermission("documents.read.self", "/patient/documents");

  const { id } = await params;
  const result = await getPatientDocument(id);

  if (result.status === "unavailable") {
    return (
      <DocumentShell>
        <ErrorState
          title={DOCUMENT_DETAIL_COPY.loadErrorTitle}
          description={DOCUMENT_DETAIL_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/patient/documents/${id}`}>
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
      <DocumentShell>
        <EmptyState
          title={DOCUMENT_DETAIL_COPY.notFoundTitle}
          description={DOCUMENT_DETAIL_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/patient/documents">
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
    <DocumentShell>
      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-h3 text-heading font-normal wrap-break-word">
            {document.title}
          </h2>
        </div>

        <DocumentViewer
          documentId={document.id}
          previewable={canPreviewDocument(document)}
          archived={document.status === "archived"}
        />

        <DocumentDetails document={document} audience="patient" />

        {canArchiveDocument(document) ? (
          <div>
            <ArchiveDocumentDialog documentId={document.id} />
          </div>
        ) : null}
      </div>
    </DocumentShell>
  );
}

function DocumentShell({ children }: { readonly children: ReactNode }) {
  return (
    <Section aria-labelledby="patient-document-heading">
      <Container width="content">
        <Link
          href="/patient/documents"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {DOCUMENT_DETAIL_COPY.backToListLabel}
        </Link>

        <h1
          id="patient-document-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {PATIENT_DOCUMENT_COPY.heading}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
