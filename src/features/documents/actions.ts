"use server";

import { revalidatePath } from "next/cache";
import {
  isPreviewableMimeType,
  SIGNED_URL_TTL_SECONDS,
} from "@/config/documents";
import type { Permission } from "@/config/permissions";
import { buildDownloadFileName } from "@/lib/documents/storage-path";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { logger } from "@/lib/logging/logger";
import { recordSecurityAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DOCUMENT_DETAIL_COPY, DOCUMENT_ERRORS } from "./content";
import { describeDocumentFailure } from "./errors";
import { getAuthorizedDocument } from "./queries";
import { createDocumentSignedUrl } from "./storage";
import {
  documentFormError,
  type DocumentAccess,
  type DocumentFormState,
} from "./types";
import {
  ARCHIVE_DOCUMENT_FIELDS,
  archiveDocumentSchema,
  documentAccessSchema,
} from "./validation";

/**
 * The one document write a browser performs through a server action.
 *
 * Uploading is a route handler rather than an action, because an upload needs
 * byte-level progress and a server action cannot report any — see
 * `src/app/api/patient-documents/route.ts`. Archiving carries no file, so it
 * is an ordinary action.
 *
 * ## The sequence it follows
 *
 * ```text
 * authenticate            getCurrentUser(), verified against the Auth server
 * authorize               can(role, "documents.write.*")
 * validate                a strict schema; an unexpected key is refused
 * call the function       security definer, which re-checks the role and
 *                         resolves the document by id AND by the caller
 *                         being the uploader, in one statement
 * row-level security      the last word
 * ```
 *
 * Deleting any one of the first three still leaves an unauthorized caller
 * with nothing.
 *
 * ## What is never sent
 *
 * No patient id, no practitioner id, no uploader id, no storage path and no
 * status. A form carrying any of them is rejected by `strict()` before it
 * gets here, and would have nothing to act on if it were not: none is a
 * parameter of anything in this feature.
 *
 * ## What is never logged
 *
 * Section 63. No title, no filename, no description, no archive reason, no
 * storage path and no patient name. A log line carries the operation, the
 * actor's opaque id and the document's opaque id.
 */

const PATIENT_DOCUMENTS = "/patient/documents";
const DOCTOR_PATIENTS = "/doctor/patients";
const DOCTOR_APPOINTMENTS = "/doctor/appointments";

function readForm(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  // Read by name from a fixed list, so a field the form did not declare is
  // never read at all. `strict()` then refuses anything unexpected that was
  // assembled in code rather than posted.
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
 * Archiving is available to either audience, so the check is "holds one of
 * the two write permissions" rather than a role test.
 *
 * Which of the two the caller holds decides nothing: the database refuses
 * anybody who is not the document's uploader, whatever permission brought
 * them here.
 */
const ARCHIVE_PERMISSIONS: readonly Permission[] = [
  "documents.write.self",
  "documents.write.care",
];

/**
 * Withdraws a document from the working record (section 34).
 *
 * A status change, never a delete: the row, the file, the reason and the
 * whole history survive, and the object is untouched.
 */
export async function archiveDocumentAction(
  _previousState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await getCurrentUser();

  if (!user) {
    logger.warn("document.archive_unauthenticated");
    return documentFormError(DOCUMENT_ERRORS.sessionEnded);
  }

  if (!ARCHIVE_PERMISSIONS.some((permission) => can(user.role, permission))) {
    // Names neither the role held nor the role required (Phase 08's rule).
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission: "documents.write",
    });
    return documentFormError(DOCUMENT_ERRORS.forbidden);
  }

  const parsed = archiveDocumentSchema.safeParse(
    readForm(formData, ARCHIVE_DOCUMENT_FIELDS),
  );

  if (!parsed.success) {
    return documentFormError(
      DOCUMENT_ERRORS.generic,
      toFieldErrors(parsed.error.issues),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("archive_patient_document", {
      p_document_id: parsed.data.documentId,
      p_reason: parsed.data.reason === "" ? null : parsed.data.reason,
    });

    if (error) {
      const failure = describeDocumentFailure(error);
      logger.warn(failure.logEvent, { userId: user.id });
      return documentFormError(failure.message);
    }
  } catch (error) {
    logger.error("document.archive_error", error, { userId: user.id });
    return documentFormError(DOCUMENT_ERRORS.generic);
  }

  // The reason itself is never logged: it is the practitioner's or the
  // patient's words about a clinical document.
  logger.info("document.archived", {
    userId: user.id,
    documentId: parsed.data.documentId,
  });

  revalidatePath(PATIENT_DOCUMENTS, "layout");
  revalidatePath(DOCTOR_PATIENTS, "layout");
  revalidatePath(DOCTOR_APPOINTMENTS, "layout");

  return { status: "archived" };
}

/**
 * A short-lived signed URL for a document the caller is entitled to.
 *
 * ## Why a server action and not `GET /api/documents/:id/access`
 *
 * Section 60 describes an endpoint and lists what it must do; every one of
 * those steps happens below. What a server action adds is that **the
 * document id never reaches a URL**, and therefore never reaches browser
 * history on a shared machine, a proxy access log or the next `Referer`.
 * That is the same reasoning Phases 10, 11 and 13 applied to patient search
 * and medicine suggestions, and section 98's "document data not in URL"
 * argues for it here too.
 *
 * ## The order is the requirement
 *
 * ```text
 * authenticate      getCurrentUser(), verified against the Auth server
 * authorize         the read permission the caller actually holds
 * resolve           under row-level security, so a document that is not
 *                   theirs is simply absent
 * verify state      a preview is refused for a type a browser must not
 *                   render, and for an archived document
 * sign              only now, and only the path that came off that row
 * ```
 *
 * Section 31's "never generate a signed URL before authorization" is
 * structural here rather than remembered: the path is not an input. It is
 * read off a row the policy admitted, so there is nothing for a caller to
 * supply and nothing to sign blindly.
 *
 * ## What it returns
 *
 * A URL, its lifetime, the type and the safe download name. Never the
 * storage path, never the bucket, never the patient id.
 */
export async function requestDocumentAccessAction(
  documentId: string,
  intent: "preview" | "download",
): Promise<
  | { readonly ok: true; readonly access: DocumentAccess }
  | { readonly ok: false; readonly message: string }
> {
  const user = await getCurrentUser();

  if (!user) {
    logger.warn("document.access_unauthenticated");
    return { ok: false, message: DOCUMENT_ERRORS.sessionEnded };
  }

  const audience = can(user.role, "documents.read.self")
    ? "patient"
    : can(user.role, "documents.read.care")
      ? "doctor"
      : null;

  if (!audience) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission: "documents.read",
    });
    return { ok: false, message: DOCUMENT_ERRORS.forbidden };
  }

  const parsed = documentAccessSchema.safeParse({ documentId });
  if (!parsed.success) {
    // A malformed id is indistinguishable from one that is not theirs, for
    // the same reason a missing document is (sections 76 and example 6).
    return { ok: false, message: DOCUMENT_DETAIL_COPY.notFoundDescription };
  }

  const result = await getAuthorizedDocument(parsed.data.documentId, audience);

  if (result.status !== "found") {
    logger.warn("document.access_denied", {
      userId: user.id,
      documentId: parsed.data.documentId,
      outcome: result.status,
    });
    return { ok: false, message: DOCUMENT_DETAIL_COPY.notFoundDescription };
  }

  const { document } = result;

  // Section 29 and 69. A preview hands the bytes to a renderer, so it is
  // offered only for the formats a browser handles safely and only while the
  // document is part of the working record. A download is always allowed —
  // archiving withdraws a report, it does not destroy the evidence.
  const previewable =
    document.status === "active" && isPreviewableMimeType(document.mimeType);

  if (intent === "preview" && !previewable) {
    return {
      ok: false,
      message: DOCUMENT_DETAIL_COPY.previewUnavailableBody,
    };
  }

  const downloadFileName = buildDownloadFileName(
    document.title,
    document.mimeType,
  );

  const url = await createDocumentSignedUrl({
    path: document.storagePath,
    actorId: user.id,
    // Only a download forces a filename. A preview must render inline, and
    // `Content-Disposition: attachment` would make the frame download
    // instead.
    ...(intent === "download" ? { downloadFileName } : {}),
  });

  if (!url) {
    return { ok: false, message: DOCUMENT_DETAIL_COPY.accessErrorBody };
  }

  // The operation, the actor and the document. Never the URL — a signed URL
  // is a bearer credential, and a credential in a log is a credential
  // (section 63).
  logger.info("document.access_granted", {
    userId: user.id,
    documentId: document.id,
    intent,
  });

  // Phase 19. This is the moment a patient's file becomes reachable, so it is
  // the moment `phase_19.md` section 89 asks to be recorded. The audit entry
  // carries the document's id and whose it is — never the title, the filename,
  // the storage path or the URL, none of which the audit table has a column
  // for.
  //
  // Deferred to this phase by Phase 14, which recorded that a signed URL being
  // minted was logged but not queryable.
  await recordSecurityAuditEvent({
    action: "document.access_granted",
    resourceType: "document",
    outcome: "allowed",
    resourceId: document.id,
    subjectPatientId: document.patientId,
  });

  return {
    ok: true,
    access: {
      url,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      mimeType: document.mimeType,
      previewable,
      downloadFileName,
    },
  };
}
