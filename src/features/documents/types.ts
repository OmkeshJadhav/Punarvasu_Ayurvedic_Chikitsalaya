/**
 * The patient document domain model.
 *
 * ## The boundary this file establishes
 *
 * ```text
 * Appointment       when care is scheduled       -> features/appointments
 * Clinical record   what happened in the room    -> features/clinical
 * Prescription      what the patient must take   -> features/prescriptions
 * Treatment plan    how the patient must live    -> features/treatment-plans
 * Document          a file somebody brought in   -> here
 * ```
 *
 * A document is **evidence**, not a conclusion. It may reference a
 * consultation; it never contains one, and nothing in this feature reads what
 * a file says (`phase_14.md` sections 90-92).
 *
 * ## What is deliberately not here
 *
 * No extracted text, no OCR result, no detected value, no classification
 * confidence, no summary, no AI suggestion, no thumbnail, no version chain
 * and no signed URL. Sections 89-92, 116 and 125 put each somewhere else or
 * nowhere at all, and they are absent rather than filtered: the types have
 * nowhere to put one and the table has no column for one.
 *
 * A **signed URL is never part of a document**. It is minted per request,
 * after authorization, and lives only as long as the response that carries
 * it — sections 33 and 67.
 */

/** Section 22. Chosen by the uploader; never inferred from the file. */
export type DocumentType =
  | "lab_report"
  | "diagnostic_report"
  | "medical_image"
  | "previous_prescription"
  | "referral"
  | "previous_record"
  | "other";

/** Section 88. Two states, because two are what the workflow needs. */
export type DocumentStatus = "active" | "archived";

/** Which side of the consultation supplied it. */
export type DocumentUploader = "patient" | "practitioner";

/**
 * A document, as any authorized reader sees it.
 *
 * There is one shape rather than a patient one and a doctor one, because the
 * two audiences are entitled to the same facts about a file: what it is, what
 * it was called, how big it is and who put it there. What differs is *which
 * documents each can reach*, and that is decided by row-level security rather
 * than by a projection somebody has to remember to apply.
 *
 * `storagePath` is present because the server needs it to mint a signed URL,
 * and it is **never rendered**: a test asserts no component prints it. It
 * carries no clinical information in any case — two uuids and a generated
 * filename (section 44).
 */
export interface PatientDocument {
  readonly id: string;
  readonly patientId: string;
  readonly documentType: DocumentType;
  readonly title: string;
  readonly description: string | null;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly status: DocumentStatus;
  readonly uploadedByRole: DocumentUploader;
  readonly appointmentId: string | null;
  readonly clinicalRecordId: string | null;
  readonly archivedAt: Date | null;
  readonly archiveReason: string | null;
  readonly createdAt: Date;
  /**
   * Server-side only in practice. Present on the type because the access
   * route needs it; no page passes it to a client component.
   */
  readonly storagePath: string;
  /**
   * Whether the signed-in user uploaded it, and may therefore archive it.
   *
   * Resolved in the query layer from `uploaded_by`, which is **not** in the
   * select grant — so it is answered by a separate, deliberately narrow
   * question rather than by handing the caller an account id. Presentation
   * only: `archive_patient_document` re-decides it inside the database.
   */
  readonly uploadedByCurrentUser: boolean;
}

/**
 * The four honest answers to "show me this document".
 *
 * `not_found` covers both "no such document" and "not yours", deliberately
 * (sections 76 and example 6): distinguishing them would turn a document id
 * into an oracle for whether a document exists.
 */
export type DocumentResult =
  | { readonly status: "found"; readonly document: PatientDocument }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

export type DocumentListResult =
  | { readonly status: "found"; readonly documents: readonly PatientDocument[] }
  | { readonly status: "unavailable" };

/**
 * The upload context a practitioner works in.
 *
 * Section 47: the patient and the consultation are **inherited** from the
 * appointment rather than typed. This is what the page resolves in order to
 * render, and the ids on it are never sent back as authorization — the
 * database re-resolves the appointment by the caller's own practitioner
 * record.
 */
export interface DocumentCareContext {
  readonly appointmentId: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientPreferredName: string | null;
  readonly patientDateOfBirth: string | null;
  readonly appointmentStartsAt: Date;
  readonly appointmentTypeName: string;
  readonly hasConsultation: boolean;
}

export type DocumentCareContextResult =
  | { readonly status: "found"; readonly context: DocumentCareContext }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

/** What the access endpoint returns. A URL and how long it is good for. */
export interface DocumentAccess {
  readonly url: string;
  readonly expiresInSeconds: number;
  readonly mimeType: string;
  readonly previewable: boolean;
  readonly downloadFileName: string;
}

/** The outcome of an archive, as the dialog sees it. */
export type DocumentActionStatus = "idle" | "archived" | "error";

export interface DocumentFormState {
  readonly status: DocumentActionStatus;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export const IDLE_DOCUMENT_FORM_STATE: DocumentFormState = { status: "idle" };

export function documentFormError(
  message: string,
  fieldErrors?: Readonly<Record<string, string>>,
): DocumentFormState {
  return {
    status: "error",
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

/**
 * The upload endpoint's reply, as the browser sees it.
 *
 * A document id and nothing else. The page reloads to render the new row
 * under the same authorization as every other read, rather than trusting a
 * payload the upload handed back.
 */
export interface DocumentUploadResult {
  readonly documentId: string;
}
