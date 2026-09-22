/**
 * The document trust boundary.
 *
 * ## What these schemas refuse
 *
 * Every one is `strict()`, so an unexpected key is **rejected rather than
 * dropped**. A rejected request is visible in a log; a dropped field is how a
 * `patientId` or a `storagePath` arrives by accident and nobody notices.
 *
 * There is no field anywhere in this module for `patientId`,
 * `practitionerId`, `doctorId`, `uploadedBy`, `storagePath`, `documentId`
 * (on an upload — the server generates it), `mimeType`, `fileSize`,
 * `checksum`, `status` or `clinicalRecordId`. `validation.test.ts` asserts
 * that one hostile field at a time, and also asserts that this module's own
 * source never names most of them at all.
 *
 * The one identifier a caller supplies is `appointmentId`, on a
 * practitioner's upload, and it is *data*: it says **which** of the
 * practitioner's own appointments they are working in, and the database
 * resolves it by that id **and** by the caller's own practitioner record
 * before reading a patient out of it. The same argument Phase 10 made for a
 * receptionist's `patientId` and Phase 13 for a doctor's `clinicalRecordId`:
 * it says *which*; `auth.uid()` and the role say *whether*.
 *
 * ## What these schemas deliberately do not refuse
 *
 * The file's type, size and identity are not validated here at all. They are
 * properties of the **bytes**, decided by `lib/documents/file-signature.ts`
 * after reading them, because a declared type is a claim and a signature is
 * a fact (section 11). Validating `mimeType` as a string here would look like
 * a check and be nothing of the kind.
 */

import { z } from "zod";
import { DOCUMENT_FIELD_LIMITS } from "@/config/documents";
import { uuidSchema } from "@/lib/validation/schemas";
import { DOCUMENT_TYPES } from "./status";

function boundedText(limit: number, label: string) {
  return z
    .string()
    .trim()
    .max(limit, {
      message: `${label} is limited to ${limit.toLocaleString("en-IN")} characters.`,
    })
    .default("");
}

const documentTypeSchema = z.enum(DOCUMENT_TYPES, {
  message: "Choose what kind of document this is.",
});

const titleSchema = z
  .string()
  .trim()
  .min(1, { message: "Give the document a short title." })
  .max(DOCUMENT_FIELD_LIMITS.title, {
    message: `The title is limited to ${DOCUMENT_FIELD_LIMITS.title} characters.`,
  });

/**
 * The metadata a patient sends with their own upload (section 77).
 *
 * Three fields, because three are what the workflow needs. There is no
 * patient field: `create_patient_document_as_patient` derives the patient
 * from the session and has no parameter for one, so there would be nowhere
 * for a value here to go even if somebody added it.
 */
export const patientDocumentUploadSchema = z
  .object({
    documentType: documentTypeSchema,
    title: titleSchema,
    description: boundedText(
      DOCUMENT_FIELD_LIMITS.description,
      "The description",
    ),
  })
  .strict();

export type PatientDocumentUploadInput = z.infer<
  typeof patientDocumentUploadSchema
>;

export const PATIENT_UPLOAD_FIELDS = [
  "documentType",
  "title",
  "description",
] as const;

/**
 * The metadata a practitioner sends, uploading from an appointment.
 *
 * One more field than the patient's, and it is the appointment — see the note
 * at the top of this file for why that is an input and not a claim. There is
 * still no patient field, no practitioner field and no clinical record field:
 * all three are read out of the appointment inside the database (section 47).
 */
export const practitionerDocumentUploadSchema = z
  .object({
    appointmentId: uuidSchema,
    documentType: documentTypeSchema,
    title: titleSchema,
    description: boundedText(
      DOCUMENT_FIELD_LIMITS.description,
      "The description",
    ),
  })
  .strict();

export type PractitionerDocumentUploadInput = z.infer<
  typeof practitionerDocumentUploadSchema
>;

export const PRACTITIONER_UPLOAD_FIELDS = [
  "appointmentId",
  "documentType",
  "title",
  "description",
] as const;

/**
 * Archiving (section 34).
 *
 * A document id and an optional reason. No status parameter — there is one
 * transition and it has its own function, so there is nothing for a request
 * to choose.
 */
export const archiveDocumentSchema = z
  .object({
    documentId: uuidSchema,
    reason: boundedText(DOCUMENT_FIELD_LIMITS.archiveReason, "The reason"),
  })
  .strict();

export type ArchiveDocumentInput = z.infer<typeof archiveDocumentSchema>;

export const ARCHIVE_DOCUMENT_FIELDS = ["documentId", "reason"] as const;

/**
 * The access request (section 60).
 *
 * A document id and nothing else. **There is deliberately no `storagePath`
 * field**, because a signed URL must never be minted for a path a caller
 * supplied — section 60's "never accept arbitrary storagePath from the client
 * and sign it blindly". The server looks the path up from a row row-level
 * security let it read.
 */
export const documentAccessSchema = z
  .object({ documentId: uuidSchema })
  .strict();
