import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DOCUMENT_AREA,
  DOCUMENT_UPLOAD_COPY,
  PATIENT_DOCUMENT_COPY,
} from "@/features/documents/content";
import { listPatientDocuments } from "@/features/documents/queries";
import type { PatientDocument } from "@/features/documents/types";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * The patient's own documents, and the form that adds one (section 82).
 *
 * ## No patient id anywhere
 *
 * `listPatientDocuments()` takes none, so there is none to substitute — the
 * same structural choice Phase 07 made for the patient profile and Phase 13
 * for prescriptions. The upload form has no patient field either, because
 * `create_patient_document_as_patient` has no patient parameter.
 *
 * ## The list carries no file and no link to one
 *
 * Section 115. A title, a type, a date, a size and a status. No preview, no
 * thumbnail and no signed URL: access is minted per document, when somebody
 * opens one, after the server has re-authorized them.
 *
 * ## Caching
 *
 * Inherited: the `(app)` layout is `force-dynamic` and the proxy serves
 * `private, no-store`, and this page is `noindex` on top of `robots.txt`
 * already disallowing `/patient/`. Section 68's "avoid public/static
 * caching" is therefore a property of where this page lives rather than
 * something it has to remember.
 */
export const metadata: Metadata = {
  title: DOCUMENT_AREA.patientList.title,
  robots: { index: false, follow: false },
};

export default async function PatientDocumentsPage() {
  await requirePermission("documents.read.self", "/patient");

  const result = await listPatientDocuments();

  return (
    <Section aria-labelledby="patient-documents-heading">
      <Container width="content">
        <h1
          id="patient-documents-heading"
          className="text-h2 text-heading font-normal"
        >
          {PATIENT_DOCUMENT_COPY.heading}
        </h1>
        <p className="text-body text-muted-foreground measure mt-2">
          {PATIENT_DOCUMENT_COPY.description}
        </p>

        <div className="mt-8 flex flex-col gap-10">
          <section
            aria-labelledby="patient-documents-list-heading"
            className="flex flex-col gap-6"
          >
            <h2
              id="patient-documents-list-heading"
              className="text-h4 text-heading font-sans font-medium"
            >
              {PATIENT_DOCUMENT_COPY.listCaption}
            </h2>

            {result.status === "unavailable" ? (
              <ErrorState
                title={PATIENT_DOCUMENT_COPY.errorTitle}
                description={PATIENT_DOCUMENT_COPY.errorDescription}
                action={
                  <Button asChild variant="secondary">
                    <Link href="/patient/documents">
                      {PATIENT_DOCUMENT_COPY.errorRetryLabel}
                    </Link>
                  </Button>
                }
              />
            ) : result.documents.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title={PATIENT_DOCUMENT_COPY.emptyTitle}
                description={PATIENT_DOCUMENT_COPY.emptyDescription}
              />
            ) : (
              <>
                <DocumentList
                  documents={result.documents}
                  hrefFor={patientDocumentHref}
                  // A caption that differs from the heading above it: two
                  // landmarks sharing one accessible name is the
                  // `landmark-unique` violation Phase 11 found in a browser
                  // and nothing else could see.
                  caption={`${PATIENT_DOCUMENT_COPY.listCaption} — table`}
                />
                <p className="text-body-sm text-muted-foreground measure">
                  {PATIENT_DOCUMENT_COPY.boundedNotice}
                </p>
              </>
            )}

            <Alert
              tone="info"
              title={PATIENT_DOCUMENT_COPY.privacyNotice.title}
            >
              {PATIENT_DOCUMENT_COPY.privacyNotice.body}
            </Alert>
          </section>

          <section
            aria-labelledby="patient-documents-upload-heading"
            className="border-border flex flex-col gap-6 border-t pt-10"
          >
            <div>
              <h2
                id="patient-documents-upload-heading"
                className="text-h4 text-heading font-sans font-medium"
              >
                {DOCUMENT_UPLOAD_COPY.heading}
              </h2>
              <p className="text-body-sm text-muted-foreground measure mt-1">
                {DOCUMENT_UPLOAD_COPY.description}
              </p>
            </div>

            <DocumentUploadForm guidance={DOCUMENT_UPLOAD_COPY.guidance} />
          </section>
        </div>
      </Container>
    </Section>
  );
}

function patientDocumentHref(document: PatientDocument): string {
  return `/patient/documents/${document.id}`;
}
