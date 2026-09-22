/**
 * Reads for the clinical AI panel.
 *
 * Two questions only: *can this practitioner use AI right now*, and *what does
 * the current consultation look like* — the second being what the panel
 * compares a displayed result's fingerprint against.
 *
 * Neither reads `ai_assistance_sessions` directly, and neither could: the
 * table has no select policy for any role and no grant. The quota comes back
 * through `ai_assistance_usage()`, which is about the caller and carries no
 * patient dimension.
 */

import "server-only";

import { assertPermission } from "@/lib/authorization/guards";
import { isClinicalAIConfigured } from "@/config/env.server";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { currentContextFingerprint } from "./context-builder";
import type { ClinicalAIAvailability } from "./types";

/**
 * Whether clinical AI can be used, and the caller's quota.
 *
 * ## Four states, four sentences
 *
 * `not_configured` is a fact about the deployment; `no_practitioner_record` is
 * a fact about this account; `unavailable` is a fact about right now. Each
 * sends somebody to check a different thing, and collapsing them would send
 * them to the wrong one.
 *
 * ## The flag is checked here and enforced nowhere
 *
 * Section 161: the flag controls availability, never authorization. A
 * deployment with the flag on gives nobody AI — the permission, the
 * practitioner record, the appointment scope and the patient scope all still
 * apply, and the database re-decides every one of them. This read is what the
 * panel uses to decide *what to render*, and rendering is not a security
 * boundary.
 */
export async function getClinicalAIAvailability(): Promise<ClinicalAIAvailability> {
  await assertPermission("clinical_ai.use");

  if (!isClinicalAIConfigured()) return { status: "not_configured" };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .rpc("ai_assistance_usage")
      .returns<{ used: number; allowed: number; window_minutes: number }[]>();

    if (error) {
      // `assert_care_practitioner()` raises `42501` for a doctor who is not on
      // the scheduling roster. That is not an outage and it is not a
      // permission problem the practitioner can act on by trying again — it
      // is a fact about their account, and it gets its own state.
      if (readCode(error) === "42501") {
        return { status: "no_practitioner_record" };
      }

      logger.error("clinical_ai.usage_read_failed", error);
      return { status: "unavailable" };
    }

    const row = data?.[0];
    if (!row) return { status: "unavailable" };

    return {
      status: "ready",
      usage: {
        used: row.used,
        allowed: row.allowed,
        windowMinutes: row.window_minutes,
      },
    };
  } catch (error) {
    logger.error("clinical_ai.usage_read_error", error);
    return { status: "unavailable" };
  }
}

/**
 * The consultation's fingerprint as it stands now (sections 84-85).
 *
 * Recomputed on every render of the page and handed to the panel, which
 * compares it against the one carried by a displayed result. They differ the
 * moment the practitioner saves a change, so a result generated before the
 * edit is marked stale rather than continuing to look current.
 *
 * It reads counts and versions, never clinical text — the same inputs the
 * context builder hashes, through the same function, so the two cannot
 * disagree about what "unchanged" means.
 */
export async function getConsultationContextFingerprint(
  appointmentId: string,
): Promise<string | null> {
  await assertPermission("clinical_ai.use");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, patient_id, status")
      .eq("id", appointmentId)
      .maybeSingle<{ id: string; patient_id: string; status: string }>();

    if (!appointment) return null;

    const { data: record } = await supabase
      .from("clinical_records")
      .select("id, version, status")
      .eq("appointment_id", appointmentId)
      .maybeSingle<{ id: string; version: number; status: string }>();

    const [history, prescriptions, plans, documents] = await Promise.all([
      countRows(supabase, "clinical_records", appointment.patient_id),
      countRows(supabase, "prescriptions", appointment.patient_id),
      countRows(supabase, "treatment_plans", appointment.patient_id),
      readDocumentTitles(appointment.patient_id),
    ]);

    return currentContextFingerprint({
      recordId: record?.id ?? null,
      version: record?.version ?? null,
      status: record?.status ?? null,
      historyCount: history,
      prescriptionCount: prescriptions,
      planCount: plans,
      documentTitles: documents,
      appointmentStatus: appointment.status,
    });
  } catch (error) {
    logger.error("clinical_ai.fingerprint_failed", error);
    return null;
  }
}

/**
 * The documents a practitioner may attach (sections 57, 58).
 *
 * Under `patient_documents_select_doctor_care`, so it lists only the documents
 * of a patient this practitioner is booked to see. Titles and kinds — the same
 * metadata the context would carry, because a selector that showed more than
 * what gets sent would be misleading about what is being sent.
 */
export async function listSelectableDocuments(
  appointmentId: string,
): Promise<
  readonly { id: string; title: string; kind: string; addedOn: string }[]
> {
  await assertPermission("clinical_ai.use");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: appointment } = await supabase
      .from("appointments")
      .select("patient_id")
      .eq("id", appointmentId)
      .maybeSingle<{ patient_id: string }>();

    if (!appointment) return [];

    const { data } = await supabase
      .from("patient_documents")
      .select("id, title, document_type, created_at")
      .eq("patient_id", appointment.patient_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<
        {
          id: string;
          title: string;
          document_type: string;
          created_at: string;
        }[]
      >();

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.document_type,
      addedOn: new Date(row.created_at).toISOString().slice(0, 10),
    }));
  } catch (error) {
    logger.error("clinical_ai.document_list_failed", error);
    return [];
  }
}

/* ------------------------------------------------------------------------- */

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * A count, for the fingerprint.
 *
 * `head: true` so no row is fetched: the fingerprint needs how many, never
 * what. Reading the rows in order to count them would pull clinical content
 * into a function that has no business holding any.
 */
async function countRows(
  supabase: ServerClient,
  table: "clinical_records" | "prescriptions" | "treatment_plans",
  patientId: string,
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  return count ?? 0;
}

async function readDocumentTitles(
  patientId: string,
): Promise<readonly string[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("patient_documents")
    .select("title")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .limit(20)
    .returns<{ title: string }[]>();

  return (data ?? []).map((row) => row.title);
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
