/**
 * The document lifecycle, in TypeScript.
 *
 * ## Why this exists twice
 *
 * The same rules live in `patient_documents_guard_update()` inside the
 * database, and that copy is the one that actually holds. This one exists so
 * the UI can decide what to render: whether to offer "Archive", whether to
 * show a document as withdrawn, whether a preview is even possible.
 *
 * Two copies of a rule is a divergence waiting to happen, and the failure it
 * produces here is specific and user-visible: a control the page offers and
 * the database then refuses. So `status.test.ts` **parses the migration** and
 * asserts that every statement below agrees with it. A test that restated the
 * SQL would agree with a wrong migration; this one reads it.
 */

import { isPreviewableMimeType } from "@/config/documents";
import type { DocumentStatus, DocumentType, PatientDocument } from "./types";

export const DOCUMENT_STATUSES = [
  "active",
  "archived",
] as const satisfies readonly DocumentStatus[];

/**
 * Section 22's categories, in the order a form offers them.
 *
 * `other` is last because it is the fallback, and it exists at all because
 * the alternative — making somebody pick a wrong category — produces worse
 * data than an honest "other".
 */
export const DOCUMENT_TYPES = [
  "lab_report",
  "diagnostic_report",
  "medical_image",
  "previous_prescription",
  "referral",
  "previous_record",
  "other",
] as const satisfies readonly DocumentType[];

/**
 * The only transition there is.
 *
 * One way, and never back: un-archiving would mean a document silently
 * reappearing on a record somebody had been told to disregard. If the clinic
 * ever needs it, it is a deliberate, audited action and not a toggle.
 */
export const DOCUMENT_TRANSITIONS: Readonly<
  Record<DocumentStatus, readonly DocumentStatus[]>
> = {
  active: ["archived"],
  archived: [],
};

export function canTransitionDocument(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  return DOCUMENT_TRANSITIONS[from].includes(to);
}

/**
 * Whether this reader may archive this document (section 34).
 *
 * Only the uploader, and only while it is active. A patient cannot withdraw a
 * report their clinician put on their record, and a clinician cannot quietly
 * remove one the patient supplied.
 *
 * Presentation only. `archive_patient_document` resolves the document by id
 * **and** by the caller being the uploader in one statement, so hiding the
 * control is a courtesy and the database is what refuses.
 */
export function canArchiveDocument(document: PatientDocument): boolean {
  return document.status === "active" && document.uploadedByCurrentUser;
}

/**
 * Whether a browser can be trusted to render this document inline.
 *
 * A **safety** judgement before a capability one (section 29). PDFs and the
 * three web image formats render in a sandboxed frame or an `<img>`; nothing
 * else is offered a preview, and an archived document is not previewed at all
 * — it is still downloadable, because withdrawing a report from the working
 * record is not the same as destroying the evidence.
 */
export function canPreviewDocument(document: PatientDocument): boolean {
  return (
    document.status === "active" && isPreviewableMimeType(document.mimeType)
  );
}

/**
 * **A document is downloadable at any status, so there is no
 * `canDownloadDocument`.**
 *
 * Deliberately not a function: a predicate that always returns true is a
 * question somebody will later answer differently by accident. Section 34
 * and the archive semantics settle it — archiving withdraws a report from
 * the working record, it does not destroy the evidence, and somebody
 * following a paper copy of a withdrawn report needs to be able to read what
 * it said as well as see that it was withdrawn.
 *
 * The download control is therefore rendered unconditionally, and
 * `requestDocumentAccessAction` signs a download for an archived document as
 * readily as for an active one.
 */
