/**
 * The object key for a patient document, and the safe display name for a
 * download.
 *
 * ## The rule this module exists to make unbreakable
 *
 * `phase_14.md` sections 8, 9, 43 and example 4:
 *
 * ```text
 * bad   uploads/${file.name}
 * good  patients/{patientId}/documents/{documentId}/document.{ext}
 * ```
 *
 * **The original filename never reaches a path.** Not sanitized into one, not
 * appended to one — it is not an input to this function at all, so a file
 * called `../../another-patient.pdf` has nothing to influence. The extension
 * comes from the MIME type the *server* determined by reading the file's
 * signature, not from anything the uploader typed.
 *
 * ## Why this is duplicated in SQL
 *
 * `public.patient_document_storage_path()` builds the identical string. It
 * has to exist in both places: the server must know the path before the row
 * exists in order to upload the object, and the database must be able to
 * recompute it in order to *refuse* a path it would not have generated
 * (section 58 — "do not blindly parse user-controlled paths"). The create
 * functions compare the two and raise if they differ.
 *
 * Two copies of a rule is a divergence waiting to happen, so
 * `storage-path.test.ts` parses the migration and asserts they agree,
 * character for character.
 *
 * ## The path carries no clinical information
 *
 * Section 44. Two opaque uuids and a generated filename. No name, no date of
 * birth, no diagnosis, no document type, no date. Somebody who saw a path in
 * a log — and nothing logs one — would learn nothing from it.
 */

import {
  DOCUMENT_BUCKET,
  documentExtensionFor,
  isAllowedMimeType,
  type AllowedMimeType,
} from "@/config/documents";

export { DOCUMENT_BUCKET };

/**
 * The canonical object key.
 *
 * Both ids are uuids by the time they reach here — the patient's is resolved
 * server-side and the document's is generated — so the result cannot contain
 * a separator, a traversal segment or anything else that would change its
 * shape. The type signature is what says so; `assertUuid` below is what makes
 * it true at runtime for a value that crossed a boundary.
 */
export function buildDocumentStoragePath(
  patientId: string,
  documentId: string,
  mimeType: AllowedMimeType,
): string {
  assertUuid(patientId, "patient id");
  assertUuid(documentId, "document id");

  return [
    "patients",
    patientId,
    "documents",
    documentId,
    `document.${documentExtensionFor(mimeType)}`,
  ].join("/");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Refuses anything that is not a uuid before it can become part of a path.
 *
 * Belt and braces: every caller already resolved these server-side. It throws
 * rather than returning a flag because there is no sensible way to continue —
 * a path built from a non-uuid is a path nobody intended, and producing one
 * quietly is how a traversal gets written to disk.
 */
export function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Refusing to build a storage path from a bad ${label}.`);
  }
}

/**
 * Whether a string is a path this application would have generated.
 *
 * Used by the tests and available to any caller that wants to check a value
 * it did not build. It is a **recomputation**, not a parse: the ids are
 * extracted only to rebuild the string and compare, so there is no branch in
 * which a malformed path is partially accepted.
 */
export function isCanonicalDocumentPath(
  path: string,
  patientId: string,
  documentId: string,
  mimeType: string,
): boolean {
  if (!isAllowedMimeType(mimeType)) return false;
  if (!UUID_PATTERN.test(patientId) || !UUID_PATTERN.test(documentId)) {
    return false;
  }

  return path === buildDocumentStoragePath(patientId, documentId, mimeType);
}

/**
 * The filename a download is offered under (section 83).
 *
 * Built from the document's **title**, which is what the patient or the
 * practitioner wrote, with everything that is not a letter, a digit, a space
 * or a hyphen removed and the extension appended from the stored type. So:
 *
 *   * no diagnosis, no date of birth and no patient identifier is added by
 *     the application — section 83's list exactly;
 *   * a title containing `../`, a null byte, a quote or a semicolon cannot
 *     produce a filename that means something to a shell, a header parser or
 *     a filesystem;
 *   * the extension always matches the stored bytes, so a file cannot be
 *     saved as `.pdf` and turn out to be something else.
 *
 * A title that sanitizes to nothing falls back to a neutral name rather than
 * to an empty one.
 */
export function buildDownloadFileName(title: string, mimeType: string): string {
  const extension = isAllowedMimeType(mimeType)
    ? documentExtensionFor(mimeType)
    : "bin";

  const safe = title
    .normalize("NFKD")
    // Anything outside this set is replaced rather than dropped, so two
    // different titles do not collapse into one name.
    .replace(/[^a-zA-Z0-9 \-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/ /g, "-")
    // A leading dot would make a hidden file; a trailing one confuses
    // Windows.
    .replace(/^[.-]+|[.-]+$/g, "");

  return `${safe === "" ? "punarvasu-document" : safe}.${extension}`;
}
