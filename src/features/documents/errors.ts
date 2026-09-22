/**
 * Database and storage failure to safe copy, for patient documents.
 *
 * ## What may not cross this boundary
 *
 * `phase_14.md` sections 50, 75 and 110, example 9, and `docs/SECURITY.md`
 * section 16. A message like *"new row violates row-level security policy for
 * table patient_documents"* names a table and a policy; *"Bucket not found:
 * patient-documents"* names a bucket. Neither reaches a screen or a log:
 * every message below is written here, in full, and the provider's own text
 * is discarded.
 *
 * That list is worth being literal about. Nothing that leaves this module
 * contains a storage path, a bucket name, a table name, a policy name, a
 * constraint name, SQL, or a signed URL.
 *
 * ## Every message says what happened to the file
 *
 * Somebody who watched a 6 MB scan upload and then saw a red box needs to
 * know whether it is stored. Every message says so, because "something went
 * wrong" leaves them uploading it again — which, with an idempotent create
 * and a fresh document id each time, would quietly cost them a duplicate.
 */

import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";
import { MAX_DOCUMENT_SIZE_LABEL } from "@/config/documents";
import type { FileRejectionReason } from "@/lib/documents/file-signature";

/**
 * The application-defined SQLSTATEs the Phase 14 migration raises.
 *
 * Disjoint from Phase 12's (PV015-PV019) and Phase 13's (PV020-PV025,
 * PV030-PV035) on purpose: self-contained features, none importing another's
 * internals.
 */
export const DOCUMENT_ERROR_CODES = {
  notFound: "PV040",
  invalidStoragePath: "PV041",
  immutable: "PV042",
  notArchivable: "PV044",
  careContextNotFound: "PV045",
  noPatientRecord: "PV046",
  duplicate: "PV047",
} as const;

const INSUFFICIENT_PRIVILEGE = "42501";
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const NOT_NULL_VIOLATION = "23502";
const FOREIGN_KEY_VIOLATION = "23503";

export interface DocumentFailure {
  readonly message: string;
  readonly logEvent: string;
}

const FAILURES: Readonly<Record<string, DocumentFailure>> = {
  [DOCUMENT_ERROR_CODES.notFound]: {
    message:
      "We couldn't find that document, or it can no longer be changed. Nothing has been altered.",
    logEvent: "document.not_found",
  },
  [DOCUMENT_ERROR_CODES.invalidStoragePath]: {
    // Deliberately says nothing about paths. A caller who reached this either
    // sent a file type we do not accept or tampered with the request, and
    // neither deserves a description of how the check works.
    message:
      "We couldn't store this document. The file was not saved — please check the file type and try again.",
    logEvent: "document.invalid_path",
  },
  [DOCUMENT_ERROR_CODES.immutable]: {
    message:
      "A document that has been uploaded cannot be changed. Upload a corrected version as a new document instead.",
    logEvent: "document.immutable",
  },
  [DOCUMENT_ERROR_CODES.notArchivable]: {
    message:
      "This document has already been archived. Nothing has been changed.",
    logEvent: "document.not_archivable",
  },
  [DOCUMENT_ERROR_CODES.careContextNotFound]: {
    message: "We couldn't find that appointment. The file was not saved.",
    logEvent: "document.care_context_not_found",
  },
  [DOCUMENT_ERROR_CODES.noPatientRecord]: {
    message:
      "Complete your profile before uploading a document, so the clinic knows whose record it belongs to. The file was not saved.",
    logEvent: "document.no_patient_record",
  },
  [DOCUMENT_ERROR_CODES.duplicate]: {
    message:
      "We couldn't store this document. The file was not saved — please try again.",
    logEvent: "document.duplicate",
  },
  [UNIQUE_VIOLATION]: {
    message:
      "This document has already been uploaded. The file was not saved again.",
    logEvent: "document.duplicate",
  },
  [CHECK_VIOLATION]: {
    message:
      "Some of that couldn't be saved as written. The file was not saved — please shorten the title or description and try again.",
    logEvent: "document.check_violation",
  },
  [NOT_NULL_VIOLATION]: {
    message: "The document needs a title and a type. The file was not saved.",
    logEvent: "document.missing_value",
  },
  [FOREIGN_KEY_VIOLATION]: {
    message: "We couldn't find that appointment. The file was not saved.",
    logEvent: "document.missing_reference",
  },
  [INSUFFICIENT_PRIVILEGE]: {
    message: DEFAULT_USER_MESSAGE.forbidden,
    logEvent: "document.forbidden",
  },
};

const GENERIC: DocumentFailure = {
  message:
    "We couldn't upload this document. The file was not saved — please try again.",
  logEvent: "document.operation_failed",
};

export function describeDocumentFailure(error: unknown): DocumentFailure {
  const code = readCode(error);
  if (!code) return GENERIC;
  return FAILURES[code] ?? GENERIC;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Why a file was refused before it was ever stored.
 *
 * Separate from the database failures above because these are *the person's*
 * problem and they can fix them — so unlike a policy refusal, saying exactly
 * what is wrong is the right thing to do. Naming the limit and the accepted
 * formats is not a disclosure; it is on the upload form already.
 *
 * `extension_mismatch` and `declared_type_mismatch` deliberately share one
 * message with `unsupported_signature`. Telling somebody "the contents do not
 * match the extension" is an invitation to try again with a matching one, and
 * the honest summary for all three is the same: this is not a file the clinic
 * accepts.
 */
export const FILE_REJECTION_MESSAGES: Readonly<
  Record<FileRejectionReason, string>
> = {
  empty: "That file is empty. Please choose a different file.",
  too_large: `That file is larger than ${MAX_DOCUMENT_SIZE_LABEL}. Please upload a smaller file, or a clearer photograph rather than a scan.`,
  unsupported_signature:
    "That file type isn't accepted. Please upload a PDF or a photograph (JPEG, PNG, WebP or HEIC).",
  extension_mismatch:
    "That file type isn't accepted. Please upload a PDF or a photograph (JPEG, PNG, WebP or HEIC).",
  declared_type_mismatch:
    "That file type isn't accepted. Please upload a PDF or a photograph (JPEG, PNG, WebP or HEIC).",
};

/** The log event for a refused file. Carries the reason, never the filename. */
export const FILE_REJECTION_LOG_EVENTS: Readonly<
  Record<FileRejectionReason, string>
> = {
  empty: "document.rejected_empty",
  too_large: "document.rejected_too_large",
  unsupported_signature: "document.rejected_signature",
  extension_mismatch: "document.rejected_extension",
  declared_type_mismatch: "document.rejected_declared_type",
};
