import "server-only";

import {
  DOCUMENT_FIELD_LIMITS,
  MAX_DOCUMENT_BYTES,
  type AllowedMimeType,
} from "@/config/documents";
import {
  inspectUploadedFile,
  SIGNATURE_SAMPLE_BYTES,
} from "@/lib/documents/file-signature";
import { buildDocumentStoragePath } from "@/lib/documents/storage-path";
import type { CurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { logger } from "@/lib/logging/logger";
import { allowOperation } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DOCUMENT_ERRORS, DOCUMENT_UPLOAD_COPY } from "./content";
import {
  describeDocumentFailure,
  FILE_REJECTION_LOG_EVENTS,
  FILE_REJECTION_MESSAGES,
} from "./errors";
import { putDocumentObject, removeOrphanedObject } from "./storage";
import type { DocumentType } from "./types";
import {
  PATIENT_UPLOAD_FIELDS,
  PRACTITIONER_UPLOAD_FIELDS,
  patientDocumentUploadSchema,
  practitionerDocumentUploadSchema,
} from "./validation";

/**
 * The upload workflow, end to end.
 *
 * ## The order, and why it is this order
 *
 * ```text
 * 1  authenticate          already done by the route
 * 2  authorize             which of the two upload permissions the caller has
 * 3  validate metadata     a strict schema; an unexpected key is refused
 * 4  bound the size        from file.size, before a byte is read
 * 5  read the bytes        bounded by step 4
 * 6  validate the file     signature, extension and declared type must agree
 * 7  resolve the patient   from the session, or from the appointment
 * 8  generate the id       server-side, and the path with it
 * 9  checksum              over the bytes as they will be stored
 * 10 upload                service role, upsert: false
 * 11 write the metadata    security definer, which recomputes the path
 * 12 compensate            remove the object if step 11 failed
 * ```
 *
 * Step 4 comes before step 5 so a 200 MB request is refused without being
 * buffered. Step 6 comes before step 7 so a bad file costs no database work.
 * Step 7 comes before step 8 because the patient id is *part of the path*,
 * and it is resolved server-side precisely so that it cannot be chosen
 * (section 86, example 2).
 *
 * ## Why the object is written before the row
 *
 * Section 14 names both orphan risks. Writing the row first and the object
 * second leaves a document in a patient's list that cannot be opened — a
 * silent, permanent defect visible to the patient. Writing the object first
 * leaves, in the failure case, an unreferenced object in a private bucket
 * that no policy can reach, because the storage predicate resolves an object
 * key to a row that does not exist. Step 12 then removes it.
 *
 * So the worse of the two failure modes is the one that is avoided, and the
 * better one is compensated.
 *
 * ## Retries
 *
 * Section 51. A fresh document id per request means a retry after a
 * *network* failure creates a second document rather than a duplicate of the
 * first — which is the honest outcome, because the client cannot know
 * whether the first attempt landed. A retry of a request that reached the
 * database is idempotent: the create functions are `on conflict (id) do
 * nothing` and read back the existing row.
 *
 * ## Large files
 *
 * Section 52 prefers streaming. This buffers, deliberately, because the
 * signature check of section 85 and attack 9 requires the server to see the
 * bytes — and a 10 MB bound makes buffering safe. Recorded as a trade-off in
 * `docs/progress/progress_phase_14.md` rather than glossed over.
 */

export type UploadFailureReason =
  | "forbidden"
  | "rate_limited"
  | "no_file"
  | "invalid_metadata"
  | "file_rejected"
  | "no_patient_record"
  | "care_context_not_found"
  | "storage_failed"
  | "metadata_failed";

export type DocumentUploadOutcome =
  | { readonly ok: true; readonly documentId: string }
  | {
      readonly ok: false;
      readonly reason: UploadFailureReason;
      readonly message: string;
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

function failure(
  reason: UploadFailureReason,
  message: string,
  fieldErrors?: Readonly<Record<string, string>>,
): DocumentUploadOutcome {
  return {
    ok: false,
    reason,
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

function readForm(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of fields) {
    const value = formData.get(name);
    values[name] = typeof value === "string" ? value : "";
  }
  return values;
}

function toFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * The original filename, reduced to something safe to *store and render*.
 *
 * It never becomes a path — `buildDocumentStoragePath` does not take it — so
 * this is not a path defence. It strips any directory component (some
 * browsers send one), removes control characters, and bounds the length, so
 * that what is displayed is a filename rather than something shaped like a
 * path or a terminal escape.
 */
function safeDisplayFileName(rawName: string): string {
  const base = rawName.split(/[\\/]/).pop() ?? "";
  let cleaned = "";
  for (const character of base) {
    const code = character.codePointAt(0) ?? 0;
    // Control characters, written as a scan rather than as escapes: the
    // formatter rewrites a unicode escape inside a character class into the
    // literal byte, which is how an invisible NUL gets into a source file
    // (recorded in Phase 06).
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue;
    cleaned += character;
  }
  const trimmed = cleaned.trim().slice(0, DOCUMENT_FIELD_LIMITS.fileName);
  return trimmed === "" ? "document" : trimmed;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The caller's own patient record id, resolved inside the database. */
async function readCurrentPatientId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("current_patient_id");
  return typeof data === "string" ? data : null;
}

/**
 * The patient on one of the caller's own appointments.
 *
 * Read under Phase 09's own-practitioner policy, so an appointment in
 * somebody else's diary resolves to nothing — and the database resolves it
 * again, the same way, when the metadata is written. This read exists only
 * to build the path.
 */
async function readAppointmentPatientId(
  appointmentId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .maybeSingle<{ patient_id: string }>();

  return data?.patient_id ?? null;
}

export async function uploadPatientDocument(
  user: CurrentUser,
  formData: FormData,
): Promise<DocumentUploadOutcome> {
  const uploadsOwn = can(user.role, "documents.write.self");
  const uploadsForCare = can(user.role, "documents.write.care");

  if (!uploadsOwn && !uploadsForCare) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission: "documents.write",
    });
    return failure("forbidden", DOCUMENT_ERRORS.forbidden);
  }

  // Phase 19. `phase_19.md` section 69 names document uploads explicitly, and
  // the audit found them unbounded: nothing stopped one account storing 10 MB
  // objects until the bucket filled.
  //
  // Checked **after** authorization and before the body is read, so a refused
  // caller costs a header parse rather than ten megabytes of memory. Keyed on
  // the account rather than an IP, because the surface is authenticated and an
  // account is both attributable and un-rotatable.
  if (!allowOperation("document_upload", user.id)) {
    logger.warn("document.upload_rate_limited", { userId: user.id });
    return failure("rate_limited", DOCUMENT_ERRORS.tooManyUploads);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return failure("no_file", FILE_REJECTION_MESSAGES.empty);
  }

  // Before a byte is read. A request larger than the limit is refused on the
  // declared size, and the check is made again against the bytes below in
  // case the declared size lied.
  if (file.size > MAX_DOCUMENT_BYTES) {
    logger.warn(FILE_REJECTION_LOG_EVENTS.too_large, { userId: user.id });
    return failure("file_rejected", FILE_REJECTION_MESSAGES.too_large);
  }

  // Parsed through whichever schema the caller's permission selects — and
  // the practitioner's is the only one with an appointment field, so a
  // patient posting one is rejected by `strict()` rather than having it
  // quietly ignored.
  let documentType: DocumentType;
  let title: string;
  let description: string | null;
  let appointmentId: string | null = null;

  if (uploadsOwn) {
    const parsed = patientDocumentUploadSchema.safeParse(
      readForm(formData, PATIENT_UPLOAD_FIELDS),
    );
    if (!parsed.success) {
      return failure(
        "invalid_metadata",
        DOCUMENT_UPLOAD_COPY.failureBody,
        toFieldErrors(parsed.error.issues),
      );
    }
    documentType = parsed.data.documentType;
    title = parsed.data.title;
    description =
      parsed.data.description === "" ? null : parsed.data.description;
  } else {
    const parsed = practitionerDocumentUploadSchema.safeParse(
      readForm(formData, PRACTITIONER_UPLOAD_FIELDS),
    );
    if (!parsed.success) {
      return failure(
        "invalid_metadata",
        DOCUMENT_UPLOAD_COPY.failureBody,
        toFieldErrors(parsed.error.issues),
      );
    }
    documentType = parsed.data.documentType;
    title = parsed.data.title;
    description =
      parsed.data.description === "" ? null : parsed.data.description;
    appointmentId = parsed.data.appointmentId;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const inspection = inspectUploadedFile({
    // Only the head is needed to identify the container, and passing a slice
    // makes that explicit — nothing downstream can accidentally depend on the
    // signature check having seen the whole file.
    bytes: bytes.subarray(0, SIGNATURE_SAMPLE_BYTES),
    fileName: file.name,
    declaredType: file.type,
    size: bytes.length,
    maxBytes: MAX_DOCUMENT_BYTES,
  });

  if (!inspection.ok) {
    // The reason, never the filename or the declared type — a filename is
    // something the patient chose and may contain their name.
    logger.warn(FILE_REJECTION_LOG_EVENTS[inspection.reason], {
      userId: user.id,
    });
    return failure("file_rejected", FILE_REJECTION_MESSAGES[inspection.reason]);
  }

  const mimeType: AllowedMimeType = inspection.mimeType;

  let patientId: string | null;

  if (appointmentId === null) {
    patientId = await readCurrentPatientId();
    if (!patientId) {
      return failure(
        "no_patient_record",
        describeDocumentFailure({ code: "PV046" }).message,
      );
    }
  } else {
    patientId = await readAppointmentPatientId(appointmentId);
    if (!patientId) {
      logger.warn("document.care_context_not_found", { userId: user.id });
      return failure(
        "care_context_not_found",
        describeDocumentFailure({ code: "PV045" }).message,
      );
    }
  }

  const documentId = crypto.randomUUID();
  const storagePath = buildDocumentStoragePath(patientId, documentId, mimeType);
  const checksum = await sha256Hex(bytes);
  const fileName = safeDisplayFileName(file.name);

  const stored = await putDocumentObject({
    path: storagePath,
    bytes,
    mimeType,
    actorId: user.id,
  });

  if (!stored) {
    return failure("storage_failed", DOCUMENT_UPLOAD_COPY.failureBody);
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { error } =
      appointmentId === null
        ? await supabase.rpc("create_patient_document_as_patient", {
            p_document_id: documentId,
            p_document_type: documentType,
            p_title: title,
            p_description: description,
            p_storage_path: storagePath,
            p_file_name: fileName,
            p_mime_type: mimeType,
            p_file_size: bytes.length,
            p_checksum: checksum,
          })
        : await supabase.rpc("create_patient_document_as_practitioner", {
            p_appointment_id: appointmentId,
            p_document_id: documentId,
            p_document_type: documentType,
            p_title: title,
            p_description: description,
            p_storage_path: storagePath,
            p_file_name: fileName,
            p_mime_type: mimeType,
            p_file_size: bytes.length,
            p_checksum: checksum,
          });

    if (error) {
      const described = describeDocumentFailure(error);
      logger.warn(described.logEvent, { userId: user.id });
      await removeOrphanedObject(storagePath, user.id);
      return failure("metadata_failed", described.message);
    }
  } catch (error) {
    logger.error("document.metadata_error", error, { userId: user.id });
    await removeOrphanedObject(storagePath, user.id);
    return failure("metadata_failed", DOCUMENT_UPLOAD_COPY.failureBody);
  }

  // The operation, the actor and the document. Not the title, not the
  // filename, not the description, not the path, not the patient
  // (section 63).
  logger.info("document.uploaded", {
    userId: user.id,
    documentId,
    uploadedByRole: appointmentId === null ? "patient" : "practitioner",
  });

  return { ok: true, documentId };
}
