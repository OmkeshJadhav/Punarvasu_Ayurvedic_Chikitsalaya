import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { DocumentStatusBadge } from "@/components/documents/document-status";
import { formatFileSize } from "@/config/documents";
import { formatClinicDate } from "@/features/appointments/time";
import {
  DOCUMENT_ARCHIVE_COPY,
  DOCUMENT_DETAIL_COPY,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_UPLOADER_LABELS,
  DOCUMENT_UPLOADER_LABELS_FOR_PATIENT,
} from "@/features/documents/content";
import type { PatientDocument } from "@/features/documents/types";

/**
 * A document's metadata, as prose (section 28).
 *
 * ## What is shown
 *
 * The title, the type, when it was added, who added it, the original
 * filename, the size and the status. Section 28's list, minus anything that
 * would be an identifier rather than a fact.
 *
 * ## What is never shown
 *
 * The storage path, the bucket, the checksum, the patient id, the uploader's
 * account id, the clinical record id or a signed URL. A component test
 * asserts the first of those, because a path rendered into a page is a path
 * in a screenshot and in a screen share.
 *
 * The checksum in particular is deliberately withheld from the patient
 * (section 39): it is an integrity aid for the clinic, and a hex string on a
 * patient's screen is noise they cannot act on.
 *
 * ## "Who uploaded it" is said differently to each reader
 *
 * "You uploaded this" to the patient, "Uploaded by the patient" to the
 * practitioner. The same fact, phrased for whoever is reading — and not a
 * name or an account, because neither audience needs one.
 */
export function DocumentDetails({
  document,
  audience,
}: {
  readonly document: PatientDocument;
  readonly audience: "patient" | "doctor";
}) {
  const uploaderLabel =
    audience === "patient"
      ? DOCUMENT_UPLOADER_LABELS_FOR_PATIENT[document.uploadedByRole]
      : DOCUMENT_UPLOADER_LABELS[document.uploadedByRole];

  return (
    <div className="flex flex-col gap-6">
      <ProfileSection
        id="document-details"
        title={DOCUMENT_DETAIL_COPY.detailsHeading}
        headingLevel="h3"
      >
        <ProfileFieldList>
          <ProfileField
            label={DOCUMENT_DETAIL_COPY.typeLabel}
            value={DOCUMENT_TYPE_LABELS[document.documentType]}
          />
          <ProfileField
            label={DOCUMENT_DETAIL_COPY.addedLabel}
            value={formatClinicDate(document.createdAt)}
          />
          <ProfileField
            label={DOCUMENT_DETAIL_COPY.uploadedByLabel}
            value={uploaderLabel}
          />
          <ProfileField
            label={DOCUMENT_DETAIL_COPY.fileLabel}
            value={document.fileName}
          />
          <ProfileField
            label={DOCUMENT_DETAIL_COPY.sizeLabel}
            value={formatFileSize(document.fileSize)}
          />
          {document.description ? (
            <ProfileField
              label={DOCUMENT_DETAIL_COPY.noteLabel}
              value={document.description}
            />
          ) : null}
          {document.clinicalRecordId ? (
            <ProfileField
              label={DOCUMENT_DETAIL_COPY.consultationLabel}
              value={DOCUMENT_DETAIL_COPY.consultationValue}
            />
          ) : null}
        </ProfileFieldList>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-label text-foreground font-medium">
            {DOCUMENT_DETAIL_COPY.statusLabel}
          </span>
          <DocumentStatusBadge status={document.status} />
        </div>
      </ProfileSection>

      {document.status === "archived" ? (
        <div className="border-border bg-muted rounded-lg border p-5 sm:p-6">
          <p className="text-h5 text-heading font-sans font-medium">
            {DOCUMENT_ARCHIVE_COPY.archivedNoticeTitle}
          </p>
          <p className="text-body-sm text-muted-foreground measure mt-2">
            {DOCUMENT_ARCHIVE_COPY.archivedNoticeBody}
          </p>
          {document.archiveReason ? (
            <p className="text-body-sm text-foreground mt-3 wrap-break-word">
              <span className="font-medium">
                {DOCUMENT_ARCHIVE_COPY.reasonGivenLabel}:{" "}
              </span>
              {document.archiveReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
