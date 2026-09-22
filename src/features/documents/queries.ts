import "server-only";

import { DOCUMENT_LIST_LIMIT } from "@/config/documents";
import { assertPermission } from "@/lib/authorization/guards";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DocumentCareContext,
  DocumentCareContextResult,
  DocumentListResult,
  DocumentResult,
  DocumentStatus,
  DocumentType,
  DocumentUploader,
  PatientDocument,
} from "./types";

/**
 * Server-side document reads.
 *
 * ## Every function starts with a permission and ends behind a policy
 *
 * `assertPermission` decides whether this caller may reach the surface at
 * all; `patient_documents_select_own` and
 * `patient_documents_select_doctor_care` decide which rows exist as far as
 * the query is concerned. Neither is sufficient alone and neither is skipped.
 *
 * ## The patient's reads take no patient id
 *
 * `listPatientDocuments()` and `getPatientDocument()` are scoped by the
 * session, so there is no identifier to substitute — the same structural
 * choice Phase 07 made for the patient profile and Phase 13 for
 * prescriptions.
 *
 * ## A missing document and somebody else's are the same answer
 *
 * Sections 76 and example 6. Both return `not_found`, because
 * distinguishing them would turn a document id into an oracle for whether a
 * document exists. That is not a decision these functions make carefully — it
 * is the only thing they *can* say, because row-level security means the row
 * is simply absent.
 *
 * ## Column lists, never `select *`
 *
 * `uploaded_by` and `archived_by` are not in the select grant at all, so a
 * `select *` would fail outright; naming the columns makes that explicit
 * rather than incidental.
 */

const DOCUMENT_COLUMNS = [
  "id",
  "patient_id",
  "uploaded_by_role",
  "uploaded_by_practitioner_id",
  "document_type",
  "title",
  "description",
  "storage_path",
  "file_name",
  "mime_type",
  "file_size",
  "status",
  "appointment_id",
  "clinical_record_id",
  "archived_at",
  "archive_reason",
  "created_at",
].join(", ");

/**
 * The signed-in patient's own documents.
 *
 * **Takes no patient id**, so there is none to substitute. Row-level
 * security restricts it to their own, at any status: an archived document
 * stays visible, marked archived, because somebody following a paper copy of
 * a withdrawn report needs to be able to find out that it was withdrawn.
 */
export async function listPatientDocuments(
  limit = DOCUMENT_LIST_LIMIT,
): Promise<DocumentListResult> {
  const user = await assertPermission("documents.read.self");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("patient_documents")
      .select(DOCUMENT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(bounded(limit))
      .returns<DocumentRow[]>();

    if (error) {
      logger.error("document.patient_list_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    return {
      status: "found",
      documents: (data ?? []).map((row) => toDocument(row, "patient", null)),
    };
  } catch (error) {
    logger.error("document.patient_list_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/** One of the signed-in patient's own documents. */
export async function getPatientDocument(
  documentId: string,
): Promise<DocumentResult> {
  const user = await assertPermission("documents.read.self");
  return readDocument(documentId, user.id, "patient", null);
}

/**
 * The documents on one patient's record, for a practitioner treating them.
 *
 * The patient id is a **filter**, not a key to the door:
 * `patient_documents_select_doctor_care` requires an appointment between that
 * patient and the caller's own practitioner record, so a patient the caller
 * is not booked to see yields an empty list — the same answer as a patient
 * who does not exist.
 *
 * Unlike the clinical history, this is **not** scoped to what this
 * practitioner uploaded. A document is evidence the patient brought for
 * whoever is treating them; the reasoning is in the migration's header.
 */
export async function listCarePatientDocuments(
  patientId: string,
  limit = DOCUMENT_LIST_LIMIT,
): Promise<DocumentListResult> {
  const user = await assertPermission("documents.read.care");
  const practitionerId = await readCurrentPractitionerId();

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("patient_documents")
      .select(DOCUMENT_COLUMNS)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(bounded(limit))
      .returns<DocumentRow[]>();

    if (error) {
      logger.error("document.care_list_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    return {
      status: "found",
      documents: (data ?? []).map((row) =>
        toDocument(row, "doctor", practitionerId),
      ),
    };
  } catch (error) {
    logger.error("document.care_list_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/** One document, for a practitioner treating the patient it belongs to. */
export async function getCarePatientDocument(
  documentId: string,
): Promise<DocumentResult> {
  const user = await assertPermission("documents.read.care");
  const practitionerId = await readCurrentPractitionerId();
  return readDocument(documentId, user.id, "doctor", practitionerId);
}

/**
 * The upload context for a practitioner working in one of their own
 * appointments (section 47).
 *
 * Resolves the appointment first, under Phase 09's own-practitioner policy,
 * so an appointment in somebody else's diary is `not_found`. Everything the
 * upload needs — the patient, the consultation — is read out of it here for
 * *display*, and read out of it again inside the database for the *write*.
 * Nothing on the returned object is trusted on the way back.
 */
export async function getDocumentCareContext(
  appointmentId: string,
): Promise<DocumentCareContextResult> {
  const user = await assertPermission("documents.write.care");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_type_id, starts_at")
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (error) {
      logger.error("document.context_read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    if (!appointment) return { status: "not_found" };

    const [patientResult, typeResult, recordResult] = await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name, preferred_name, date_of_birth")
        .eq("id", appointment.patient_id)
        .maybeSingle<PatientRow>(),
      supabase
        .from("appointment_types")
        .select("name")
        .eq("id", appointment.appointment_type_id)
        .maybeSingle<{ name: string }>(),
      supabase
        .from("clinical_records")
        .select("id")
        .eq("appointment_id", appointmentId)
        .maybeSingle<{ id: string }>(),
    ]);

    const context: DocumentCareContext = {
      appointmentId: appointment.id,
      patientId: appointment.patient_id,
      patientName: patientResult.data?.full_name ?? "",
      patientPreferredName: patientResult.data?.preferred_name ?? null,
      patientDateOfBirth: patientResult.data?.date_of_birth ?? null,
      appointmentStartsAt: new Date(appointment.starts_at),
      appointmentTypeName: typeResult.data?.name ?? "Consultation",
      hasConsultation: recordResult.data !== null,
    };

    return { status: "found", context };
  } catch (error) {
    logger.error("document.context_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * One document, for whichever of the two audiences the caller belongs to.
 *
 * Used by the access endpoint, which serves both. It does **not** widen
 * anything: it asks for the permission the caller actually holds and then
 * runs the ordinary read, so the policy decides exactly as it would on a
 * page. A caller holding neither permission is refused by
 * `assertPermission`, which throws.
 */
export async function getAuthorizedDocument(
  documentId: string,
  audience: DocumentAudience,
): Promise<DocumentResult> {
  return audience === "patient"
    ? getPatientDocument(documentId)
    : getCarePatientDocument(documentId);
}

export type DocumentAudience = "patient" | "doctor";

/* -------------------------------------------------------------------------
 * Internals
 * ---------------------------------------------------------------------- */

function bounded(limit: number): number {
  return Math.min(Math.max(limit, 1), DOCUMENT_LIST_LIMIT);
}

async function readDocument(
  documentId: string,
  userId: string,
  audience: DocumentAudience,
  practitionerId: string | null,
): Promise<DocumentResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("patient_documents")
      .select(DOCUMENT_COLUMNS)
      .eq("id", documentId)
      .maybeSingle<DocumentRow>();

    if (error) {
      logger.error("document.read_failed", error, { userId });
      return { status: "unavailable" };
    }

    if (!data) return { status: "not_found" };

    return {
      status: "found",
      document: toDocument(data, audience, practitionerId),
    };
  } catch (error) {
    logger.error("document.read_error", error, { userId });
    return { status: "unavailable" };
  }
}

/**
 * The caller's own practitioner record, or `null`.
 *
 * Phase 09's `current_practitioner_id()`, which takes no argument and can
 * therefore only ever answer about the caller.
 */
async function readCurrentPractitionerId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.rpc("current_practitioner_id");
    return typeof data === "string" ? data : null;
  } catch {
    // Only affects whether an archive control is offered. The database
    // re-decides that anyway, so failing quietly is the right shape.
    return null;
  }
}

/**
 * Whether this reader uploaded this document.
 *
 * Derived rather than read, because `uploaded_by` is **not in the select
 * grant** — a column privilege belongs to a database role, and a patient and
 * a doctor are both `authenticated`, so granting it to one would disclose
 * account ids to the other.
 *
 * The derivation is exact for every state the system can reach:
 *
 *   * a patient reads only their own record (row-level security), and the
 *     only way a row on it carries `uploaded_by_role = 'patient'` is
 *     `create_patient_document_as_patient`, which sets the patient from the
 *     session. One account per patient record is enforced by Phase 07's
 *     partial unique index on `profile_id`;
 *   * a practitioner's own uploads are the ones naming their practitioner
 *     record, and one account per practitioner record is enforced by the
 *     unique constraint on `practitioners.profile_id`.
 *
 * Presentation only. `archive_patient_document` resolves the document by id
 * **and** by `uploaded_by = auth.uid()` in one statement, so this being
 * generous would show a control, not grant anything.
 */
function isOwnUpload(
  row: DocumentRow,
  audience: DocumentAudience,
  practitionerId: string | null,
): boolean {
  if (audience === "patient") return row.uploaded_by_role === "patient";
  return (
    practitionerId !== null &&
    row.uploaded_by_practitioner_id === practitionerId
  );
}

interface DocumentRow {
  id: string;
  patient_id: string;
  uploaded_by_role: DocumentUploader;
  uploaded_by_practitioner_id: string | null;
  document_type: DocumentType;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status: DocumentStatus;
  appointment_id: string | null;
  clinical_record_id: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  created_at: string;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  appointment_type_id: string;
  starts_at: string;
}

interface PatientRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
}

function toDocument(
  row: DocumentRow,
  audience: DocumentAudience,
  practitionerId: string | null,
): PatientDocument {
  return {
    id: row.id,
    patientId: row.patient_id,
    documentType: row.document_type,
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    status: row.status,
    uploadedByRole: row.uploaded_by_role,
    appointmentId: row.appointment_id,
    clinicalRecordId: row.clinical_record_id,
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    archiveReason: row.archive_reason,
    createdAt: new Date(row.created_at),
    storagePath: row.storage_path,
    uploadedByCurrentUser: isOwnUpload(row, audience, practitionerId),
  };
}
