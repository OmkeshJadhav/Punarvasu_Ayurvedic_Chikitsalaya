import "server-only";

import { assertPermission } from "@/lib/authorization/guards";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TreatmentPlan,
  TreatmentPlanCategory,
  TreatmentPlanItem,
  TreatmentPlanListResult,
  TreatmentPlanResult,
  TreatmentPlanStatus,
  TreatmentPlanSubject,
  TreatmentPlanSummary,
  TreatmentPlanWorkspaceResult,
} from "./types";

/**
 * Server-side treatment plan reads.
 *
 * The same contract as every query layer since Phase 07: a permission check
 * on every exported read, a named column list rather than `select *`, and no
 * patient id on anything the patient calls — `listPatientTreatmentPlans()`
 * and `getPatientTreatmentPlan()` are scoped by the session, and row-level
 * security scopes them again.
 *
 * `status <> 'draft'` lives in `treatment_plans_select_patient`, so no query
 * here can forget it. The explicit `.neq` on the patient reads is defence in
 * depth, not the control.
 */

const PLAN_COLUMNS = [
  "id",
  "clinical_record_id",
  "appointment_id",
  "patient_id",
  "practitioner_id",
  "status",
  "title",
  "summary",
  "start_date",
  "follow_up_on",
  "version",
  "activated_at",
  "completed_at",
  "cancelled_at",
  "created_at",
  "updated_at",
].join(", ");

/** A title and a status. No instruction text reaches a list. */
const SUMMARY_COLUMNS = [
  "id",
  "appointment_id",
  "practitioner_id",
  "status",
  "title",
  "follow_up_on",
  "activated_at",
  "created_at",
].join(", ");

const ITEM_COLUMNS = [
  "id",
  "treatment_plan_id",
  "sort_order",
  "category",
  "title",
  "instructions",
  "frequency",
  "duration",
].join(", ");

export const TREATMENT_PLAN_LIST_LIMIT = 20;

export async function getTreatmentPlanWorkspace(
  appointmentId: string,
): Promise<TreatmentPlanWorkspaceResult> {
  const user = await assertPermission("treatment_plans.read");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: appointmentRow, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_type_id, starts_at")
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (appointmentError) {
      logger.error("treatment_plan.appointment_read_failed", appointmentError, {
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
      logger.error("treatment_plan.record_read_failed", recordError, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    if (!recordRow) return { status: "no_consultation", subject };

    const { data: rows, error: planError } = await supabase
      .from("treatment_plans")
      .select(PLAN_COLUMNS)
      .eq("clinical_record_id", recordRow.id)
      .in("status", ["draft", "active"])
      .limit(1)
      .returns<TreatmentPlanRow[]>();

    if (planError) {
      logger.error("treatment_plan.read_failed", planError, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    const row = rows?.[0];
    if (!row) {
      return { status: "not_started", subject, clinicalRecordId: recordRow.id };
    }

    const items = await readItems(row.id, user.id);
    if (items === null) return { status: "unavailable" };

    return {
      status: "found",
      plan: toPlan(row, items),
      subject,
      clinicalRecordId: recordRow.id,
    };
  } catch (error) {
    logger.error("treatment_plan.workspace_read_error", error, {
      userId: user.id,
    });
    return { status: "unavailable" };
  }
}

export async function getTreatmentPlanForDoctor(
  planId: string,
): Promise<TreatmentPlanResult> {
  const user = await assertPermission("treatment_plans.read");
  return readPlan(planId, user.id, { patientFacing: false });
}

export async function getPatientTreatmentPlan(
  planId: string,
): Promise<TreatmentPlanResult> {
  const user = await assertPermission("treatment_plans.read.self");
  return readPlan(planId, user.id, { patientFacing: true });
}

export async function listPatientTreatmentPlansForDoctor(
  patientId: string,
  limit = TREATMENT_PLAN_LIST_LIMIT,
): Promise<TreatmentPlanListResult> {
  const user = await assertPermission("treatment_plans.read");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("treatment_plans")
      .select(SUMMARY_COLUMNS)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), TREATMENT_PLAN_LIST_LIMIT))
      .returns<TreatmentPlanSummaryRow[]>();

    if (error) {
      logger.error("treatment_plan.history_read_failed", error, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    const rows = data ?? [];
    const counts = await readItemCounts(rows.map((row) => row.id));

    return {
      status: "found",
      plans: rows.map((row) => toSummary(row, counts.get(row.id) ?? 0, null)),
    };
  } catch (error) {
    logger.error("treatment_plan.history_read_error", error, {
      userId: user.id,
    });
    return { status: "unavailable" };
  }
}

/** The signed-in patient's own plans. **Takes no patient id.** */
export async function listPatientTreatmentPlans(
  limit = TREATMENT_PLAN_LIST_LIMIT,
): Promise<TreatmentPlanListResult> {
  const user = await assertPermission("treatment_plans.read.self");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("treatment_plans")
      .select(SUMMARY_COLUMNS)
      .neq("status", "draft")
      .order("activated_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), TREATMENT_PLAN_LIST_LIMIT))
      .returns<TreatmentPlanSummaryRow[]>();

    if (error) {
      logger.error("treatment_plan.patient_list_failed", error, {
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
      plans: rows.map((row) =>
        toSummary(
          row,
          counts.get(row.id) ?? 0,
          practitioners.get(row.practitioner_id) ?? null,
        ),
      ),
    };
  } catch (error) {
    logger.error("treatment_plan.patient_list_error", error, {
      userId: user.id,
    });
    return { status: "unavailable" };
  }
}

/**
 * The display name of the practitioner who wrote a plan.
 *
 * Its own export rather than a reach into `features/prescriptions`:
 * `docs/ARCHITECTURE.md` section 4 forbids a feature importing another
 * feature's internals, and `public.practitioners` is readable by every
 * authenticated caller (a name and two booleans), so resolving it here costs
 * four lines and keeps the two features independent.
 */
export async function getPlanPractitionerDisplayName(
  practitionerId: string,
): Promise<string | null> {
  const names = await readPractitionerNames([practitionerId]);
  return names.get(practitionerId) ?? null;
}

/* -------------------------------------------------------------------------
 * Internals
 * ---------------------------------------------------------------------- */

async function readPlan(
  planId: string,
  userId: string,
  { patientFacing }: { patientFacing: boolean },
): Promise<TreatmentPlanResult> {
  try {
    const supabase = await createSupabaseServerClient();

    let request = supabase
      .from("treatment_plans")
      .select(PLAN_COLUMNS)
      .eq("id", planId);

    if (patientFacing) request = request.neq("status", "draft");

    const { data, error } = await request.maybeSingle<TreatmentPlanRow>();

    if (error) {
      logger.error("treatment_plan.read_failed", error, { userId });
      return { status: "unavailable" };
    }

    if (!data) return { status: "not_found" };

    const items = await readItems(data.id, userId);
    if (items === null) return { status: "unavailable" };

    return { status: "found", plan: toPlan(data, items) };
  } catch (error) {
    logger.error("treatment_plan.read_error", error, { userId });
    return { status: "unavailable" };
  }
}

async function readItems(
  planId: string,
  userId: string,
): Promise<TreatmentPlanItem[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("treatment_plan_items")
      .select(ITEM_COLUMNS)
      .eq("treatment_plan_id", planId)
      .order("sort_order", { ascending: true })
      .returns<TreatmentPlanItemRow[]>();

    if (error) {
      logger.error("treatment_plan.items_read_failed", error, { userId });
      return null;
    }

    return (data ?? []).map(toItem);
  } catch (error) {
    logger.error("treatment_plan.items_read_error", error, { userId });
    return null;
  }
}

async function readItemCounts(
  planIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (planIds.length === 0) return counts;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("treatment_plan_items")
      .select("treatment_plan_id")
      .in("treatment_plan_id", [...planIds])
      .returns<{ treatment_plan_id: string }[]>();

    for (const row of data ?? []) {
      counts.set(
        row.treatment_plan_id,
        (counts.get(row.treatment_plan_id) ?? 0) + 1,
      );
    }
  } catch {
    // A missing count renders as zero rather than taking the list away.
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
): Promise<TreatmentPlanSubject> {
  const supabase = await createSupabaseServerClient();

  const [patientResult, typeResult] = await Promise.all([
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
  ]);

  const patient = patientResult.data;

  return {
    patientId: appointment.patient_id,
    fullName: patient?.full_name ?? "",
    preferredName: patient?.preferred_name ?? null,
    dateOfBirth: patient?.date_of_birth ?? null,
    appointmentId: appointment.id,
    appointmentStartsAt: new Date(appointment.starts_at),
    appointmentTypeName: typeResult.data?.name ?? "Consultation",
  };
}

interface TreatmentPlanRow {
  id: string;
  clinical_record_id: string;
  appointment_id: string;
  patient_id: string;
  practitioner_id: string;
  status: TreatmentPlanStatus;
  title: string | null;
  summary: string | null;
  start_date: string | null;
  follow_up_on: string | null;
  version: number;
  activated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TreatmentPlanSummaryRow {
  id: string;
  appointment_id: string;
  practitioner_id: string;
  status: TreatmentPlanStatus;
  title: string | null;
  follow_up_on: string | null;
  activated_at: string | null;
  created_at: string;
}

interface TreatmentPlanItemRow {
  id: string;
  treatment_plan_id: string;
  sort_order: number;
  category: TreatmentPlanCategory;
  title: string;
  instructions: string | null;
  frequency: string | null;
  duration: string | null;
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

function toItem(row: TreatmentPlanItemRow): TreatmentPlanItem {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    category: row.category,
    title: row.title,
    instructions: row.instructions ?? "",
    frequency: row.frequency ?? "",
    duration: row.duration ?? "",
  };
}

function toPlan(
  row: TreatmentPlanRow,
  items: readonly TreatmentPlanItem[],
): TreatmentPlan {
  return {
    id: row.id,
    clinicalRecordId: row.clinical_record_id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    practitionerId: row.practitioner_id,
    status: row.status,
    title: row.title ?? "",
    summary: row.summary ?? "",
    startDate: row.start_date,
    followUpOn: row.follow_up_on,
    version: row.version,
    activatedAt: row.activated_at ? new Date(row.activated_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    items,
  };
}

function toSummary(
  row: TreatmentPlanSummaryRow,
  itemCount: number,
  practitionerName: string | null,
): TreatmentPlanSummary {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    status: row.status,
    title: row.title ?? "",
    itemCount,
    followUpOn: row.follow_up_on,
    activatedAt: row.activated_at ? new Date(row.activated_at) : null,
    createdAt: new Date(row.created_at),
    practitionerName,
  };
}
