import "server-only";

import { assertPermission } from "@/lib/authorization/guards";
import { logger } from "@/lib/logging/logger";
import { recordSecurityAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  MedicineSuggestion,
  Prescription,
  PrescriptionItem,
  PrescriptionListResult,
  PrescriptionResult,
  PrescriptionStatus,
  PrescriptionSubject,
  PrescriptionSummary,
  PrescriptionWorkspaceResult,
} from "./types";

/**
 * Server-side prescription reads.
 *
 * ## Every function starts with a permission and ends behind a policy
 *
 * `assertPermission` decides whether this caller may reach the surface at
 * all; `prescriptions_select_author` and `prescriptions_select_patient`
 * decide which rows exist as far as the query is concerned. Neither is
 * sufficient alone and neither is skipped.
 *
 * ## The patient's reads take no patient id
 *
 * `listPatientPrescriptions()` and `getPatientPrescription()` are scoped by
 * the session, so there is no identifier to substitute — the same structural
 * choice Phase 07 made for the patient profile. Row-level security scopes
 * them again, and `status <> 'draft'` lives in the policy rather than in
 * these queries, so no query here can forget it. The explicit `.neq` below is
 * defence in depth, not the control.
 *
 * ## Column lists, never `select *`
 *
 * Each list names its columns. A list view fetches **no clinical content at
 * all** — not a medicine name, not a dose — because a list is read at a
 * glance, often with somebody else in the room, and a count is enough to
 * decide whether to open it.
 */

const PRESCRIPTION_COLUMNS = [
  "id",
  "clinical_record_id",
  "appointment_id",
  "patient_id",
  "practitioner_id",
  "status",
  "general_instructions",
  "version",
  "issued_at",
  "cancelled_at",
  "cancellation_reason",
  "created_at",
  "updated_at",
].join(", ");

/** No clinical content. See the note above. */
const SUMMARY_COLUMNS = [
  "id",
  "appointment_id",
  "practitioner_id",
  "status",
  "issued_at",
  "cancelled_at",
  "created_at",
  "updated_at",
].join(", ");

const ITEM_COLUMNS = [
  "id",
  "prescription_id",
  "sort_order",
  "medicine_name",
  "form",
  "strength",
  "dose_amount",
  "dose_unit",
  "frequency",
  "timing",
  "duration",
  "quantity",
  "quantity_unit",
  "instructions",
].join(", ");

export const PRESCRIPTION_LIST_LIMIT = 20;

/**
 * The prescription workspace for one of the caller's own appointments.
 *
 * Resolves in three steps, each of which can only see what the caller is
 * allowed to: the appointment (Phase 09's doctor policy), the consultation
 * (Phase 12's authoring policy), then the live prescription for it.
 */
export async function getPrescriptionWorkspace(
  appointmentId: string,
): Promise<PrescriptionWorkspaceResult> {
  const user = await assertPermission("prescriptions.read");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: appointmentRow, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, patient_id, practitioner_id, appointment_type_id, starts_at")
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (appointmentError) {
      logger.error("prescription.appointment_read_failed", appointmentError, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    if (!appointmentRow) return { status: "not_found" };

    const subject = await readSubject(appointmentRow);

    const { data: recordRow, error: recordError } = await supabase
      .from("clinical_records")
      .select("id")
      .eq("appointment_id", appointmentId)
      .maybeSingle<{ id: string }>();

    if (recordError) {
      logger.error("prescription.record_read_failed", recordError, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    // A prescription hangs off a consultation (section 29), so there is
    // nothing to attach one to until the consultation has been opened.
    if (!recordRow) return { status: "no_consultation", subject };

    const { data: rows, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select(PRESCRIPTION_COLUMNS)
      .eq("clinical_record_id", recordRow.id)
      .neq("status", "cancelled")
      .limit(1)
      .returns<PrescriptionRow[]>();

    if (prescriptionError) {
      logger.error("prescription.read_failed", prescriptionError, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    const row = rows?.[0];
    if (!row) {
      return {
        status: "not_started",
        subject,
        clinicalRecordId: recordRow.id,
      };
    }

    const items = await readItems(row.id, user.id);
    if (items === null) return { status: "unavailable" };

    return {
      status: "found",
      prescription: toPrescription(row, items),
      subject,
      clinicalRecordId: recordRow.id,
    };
  } catch (error) {
    logger.error("prescription.workspace_read_error", error, {
      userId: user.id,
    });
    return { status: "unavailable" };
  }
}

/** One prescription, in full, for the practitioner who wrote it. */
export async function getPrescriptionForDoctor(
  prescriptionId: string,
): Promise<PrescriptionResult> {
  const user = await assertPermission("prescriptions.read");
  const result = await readPrescription(prescriptionId, user.id, {
    patientFacing: false,
  });

  // Phase 19. A practitioner opening a prescription is privileged access to
  // somebody else's clinical instruction, and `phase_19.md` section 89 asks
  // for it to be capturable. Deferred to this phase by Phase 13, which
  // recorded that prescription *reads* were not recorded anywhere.
  //
  // Only on a successful read, and carrying no medicine, dose or instruction —
  // the audit table has no column that could hold one. The patient's own read
  // of their own prescription is not audited: it is not privileged access.
  if (result.status === "found") {
    await recordSecurityAuditEvent({
      action: "prescription.read",
      resourceType: "prescription",
      outcome: "allowed",
      resourceId: result.prescription.id,
      subjectPatientId: result.prescription.patientId,
    });
  }

  return result;
}

/**
 * One prescription, in full, for the patient it was written for.
 *
 * `patientFacing` adds `status <> 'draft'` to the query. The policy already
 * says it; this says it again so that a change to either one alone still
 * leaves a draft invisible.
 */
export async function getPatientPrescription(
  prescriptionId: string,
): Promise<PrescriptionResult> {
  const user = await assertPermission("prescriptions.read.self");
  return readPrescription(prescriptionId, user.id, { patientFacing: true });
}

/** The prescriptions this practitioner has written for one patient. */
export async function listPatientPrescriptionsForDoctor(
  patientId: string,
  limit = PRESCRIPTION_LIST_LIMIT,
): Promise<PrescriptionListResult> {
  const user = await assertPermission("prescriptions.read");

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("prescriptions")
      .select(SUMMARY_COLUMNS)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), PRESCRIPTION_LIST_LIMIT))
      .returns<PrescriptionSummaryRow[]>();

    if (error) {
      logger.error("prescription.history_read_failed", error, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    const rows = data ?? [];
    const counts = await readItemCounts(rows.map((row) => row.id));

    return {
      status: "found",
      prescriptions: rows.map((row) =>
        toSummary(row, counts.get(row.id) ?? 0, null),
      ),
    };
  } catch (error) {
    logger.error("prescription.history_read_error", error, {
      userId: user.id,
    });
    return { status: "unavailable" };
  }
}

/**
 * The signed-in patient's own prescriptions.
 *
 * **Takes no patient id**, so there is none to substitute. Row-level security
 * restricts it to their own, and to the ones a doctor has issued.
 */
export async function listPatientPrescriptions(
  limit = PRESCRIPTION_LIST_LIMIT,
): Promise<PrescriptionListResult> {
  const user = await assertPermission("prescriptions.read.self");

  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("prescriptions")
      .select(SUMMARY_COLUMNS)
      .neq("status", "draft")
      .order("issued_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), PRESCRIPTION_LIST_LIMIT))
      .returns<PrescriptionSummaryRow[]>();

    if (error) {
      logger.error("prescription.patient_list_failed", error, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    const rows = data ?? [];
    const [counts, practitioners] = await Promise.all([
      readItemCounts(rows.map((row) => row.id)),
      readPractitionerNames(rows.map((row) => row.practitioner_id)),
    ]);

    return {
      status: "found",
      prescriptions: rows.map((row) =>
        toSummary(
          row,
          counts.get(row.id) ?? 0,
          practitioners.get(row.practitioner_id) ?? null,
        ),
      ),
    };
  } catch (error) {
    logger.error("prescription.patient_list_error", error, {
      userId: user.id,
    });
    return { status: "unavailable" };
  }
}

/** The display name of the practitioner who issued a prescription. */
export async function getPractitionerDisplayName(
  practitionerId: string,
): Promise<string | null> {
  const names = await readPractitionerNames([practitionerId]);
  return names.get(practitionerId) ?? null;
}

/**
 * Suggestions from the practitioner's own prescribing history (section 65).
 *
 * The bounds that matter are in the database: it refuses an empty term,
 * clamps its own limit, escapes wildcards and matches a prefix only. This
 * wrapper adds the permission check and **never logs the term** — what a
 * doctor is typing into a medicine field is clinical content.
 */
export async function suggestMedicines(
  query: string,
): Promise<readonly MedicineSuggestion[]> {
  const user = await assertPermission("prescriptions.read");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_prescribed_medicines", {
      p_query: query,
    });

    if (error) {
      logger.warn("prescription.suggestions_failed", { userId: user.id });
      return [];
    }

    return (data ?? []).map((row) => ({
      medicineName: row.medicine_name,
      form: row.form ?? "",
    }));
  } catch (error) {
    logger.error("prescription.suggestions_error", error, { userId: user.id });
    return [];
  }
}

/* -------------------------------------------------------------------------
 * Internals
 * ---------------------------------------------------------------------- */

async function readPrescription(
  prescriptionId: string,
  userId: string,
  { patientFacing }: { patientFacing: boolean },
): Promise<PrescriptionResult> {
  try {
    const supabase = await createSupabaseServerClient();

    let request = supabase
      .from("prescriptions")
      .select(PRESCRIPTION_COLUMNS)
      .eq("id", prescriptionId);

    if (patientFacing) request = request.neq("status", "draft");

    const { data, error } = await request.maybeSingle<PrescriptionRow>();

    if (error) {
      logger.error("prescription.read_failed", error, { userId });
      return { status: "unavailable" };
    }

    if (!data) return { status: "not_found" };

    const items = await readItems(data.id, userId);
    if (items === null) return { status: "unavailable" };

    return { status: "found", prescription: toPrescription(data, items) };
  } catch (error) {
    logger.error("prescription.read_error", error, { userId });
    return { status: "unavailable" };
  }
}

/** `null` means the read failed, which is not the same as an empty list. */
async function readItems(
  prescriptionId: string,
  userId: string,
): Promise<PrescriptionItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("prescription_items")
      .select(ITEM_COLUMNS)
      .eq("prescription_id", prescriptionId)
      .order("sort_order", { ascending: true })
      .returns<PrescriptionItemRow[]>();

    if (error) {
      logger.error("prescription.items_read_failed", error, { userId });
      return null;
    }

    return (data ?? []).map(toItem);
  } catch (error) {
    logger.error("prescription.items_read_error", error, { userId });
    return null;
  }
}

/**
 * How many items each prescription carries.
 *
 * Deliberately selects the foreign key alone: a list must not fetch a
 * medicine name it is not going to render.
 */
async function readItemCounts(
  prescriptionIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (prescriptionIds.length === 0) return counts;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("prescription_items")
      .select("prescription_id")
      .in("prescription_id", [...prescriptionIds])
      .returns<{ prescription_id: string }[]>();

    for (const row of data ?? []) {
      counts.set(
        row.prescription_id,
        (counts.get(row.prescription_id) ?? 0) + 1,
      );
    }
  } catch {
    // A missing count renders as zero items rather than taking the list away.
  }

  return counts;
}

async function readPractitionerNames(
  practitionerIds: readonly string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(practitionerIds)];
  if (unique.length === 0) return names;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("practitioners")
      .select("id, display_name")
      .in("id", unique)
      .returns<{ id: string; display_name: string }[]>();

    for (const row of data ?? []) names.set(row.id, row.display_name);
  } catch {
    // Rendered as "your practitioner" rather than failing the page.
  }

  return names;
}

async function readSubject(
  appointment: AppointmentRow,
): Promise<PrescriptionSubject> {
  const supabase = await createSupabaseServerClient();

  const [patientResult, typeResult, practitionerNames] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, preferred_name, date_of_birth, phone")
      .eq("id", appointment.patient_id)
      .maybeSingle<PatientRow>(),
    supabase
      .from("appointment_types")
      .select("name")
      .eq("id", appointment.appointment_type_id)
      .maybeSingle<{ name: string }>(),
    readPractitionerNames([appointment.practitioner_id]),
  ]);

  const patient = patientResult.data;

  return {
    patientId: appointment.patient_id,
    fullName: patient?.full_name ?? "",
    preferredName: patient?.preferred_name ?? null,
    dateOfBirth: patient?.date_of_birth ?? null,
    phone: patient?.phone ?? null,
    appointmentId: appointment.id,
    appointmentStartsAt: new Date(appointment.starts_at),
    appointmentTypeName: typeResult.data?.name ?? "Consultation",
    practitionerName:
      practitionerNames.get(appointment.practitioner_id) ?? null,
  };
}

interface PrescriptionRow {
  id: string;
  clinical_record_id: string;
  appointment_id: string;
  patient_id: string;
  practitioner_id: string;
  status: PrescriptionStatus;
  general_instructions: string | null;
  version: number;
  issued_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface PrescriptionSummaryRow {
  id: string;
  appointment_id: string;
  practitioner_id: string;
  status: PrescriptionStatus;
  issued_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PrescriptionItemRow {
  id: string;
  prescription_id: string;
  sort_order: number;
  medicine_name: string;
  form: string | null;
  strength: string | null;
  dose_amount: string | null;
  dose_unit: string | null;
  frequency: string | null;
  timing: string | null;
  duration: string | null;
  quantity: string | null;
  quantity_unit: string | null;
  instructions: string | null;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  practitioner_id: string;
  appointment_type_id: string;
  starts_at: string;
}

interface PatientRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
}

function toItem(row: PrescriptionItemRow): PrescriptionItem {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    medicineName: row.medicine_name,
    form: row.form ?? "",
    strength: row.strength ?? "",
    doseAmount: row.dose_amount ?? "",
    doseUnit: row.dose_unit ?? "",
    frequency: row.frequency ?? "",
    timing: row.timing ?? "",
    duration: row.duration ?? "",
    quantity: row.quantity ?? "",
    quantityUnit: row.quantity_unit ?? "",
    instructions: row.instructions ?? "",
  };
}

function toPrescription(
  row: PrescriptionRow,
  items: readonly PrescriptionItem[],
): Prescription {
  return {
    id: row.id,
    clinicalRecordId: row.clinical_record_id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    practitionerId: row.practitioner_id,
    status: row.status,
    generalInstructions: row.general_instructions ?? "",
    version: row.version,
    issuedAt: row.issued_at ? new Date(row.issued_at) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    cancellationReason: row.cancellation_reason ?? "",
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    items,
  };
}

function toSummary(
  row: PrescriptionSummaryRow,
  itemCount: number,
  practitionerName: string | null,
): PrescriptionSummary {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    status: row.status,
    itemCount,
    issuedAt: row.issued_at ? new Date(row.issued_at) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    practitionerName,
  };
}
