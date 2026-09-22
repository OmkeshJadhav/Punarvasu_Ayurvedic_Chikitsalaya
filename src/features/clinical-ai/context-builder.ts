/**
 * The clinical context builder.
 *
 * ## This is the module that decides what leaves the building
 *
 * `phase_17.md` sections 11, 12 and 152. Everything sent to an external model
 * is assembled here, from data read under row-level security, on the server,
 * from identifiers the caller could not choose. Section 12's bad case — a
 * browser assembling a patient JSON and posting it — has no equivalent here:
 * the request carries a task, an appointment id and a set of booleans, and
 * every clinical value is fetched server-side.
 *
 * ## Authorization, before minimization
 *
 * Nothing is minimized that was not authorized first. Every read below goes
 * through the same policies the consultation screen does:
 *
 *   * `appointments_select_own_practitioner` — the appointment, and therefore
 *     the patient;
 *   * `clinical_records_select_author` — the consultation and the history;
 *   * `prescriptions_select_author`, `treatment_plans_select_author`;
 *   * `patient_documents_select_doctor_care` — the documents.
 *
 * So a doctor requesting another practitioner's appointment gets `not_found`
 * before a single clinical field is read, and cross-doctor leakage is not
 * prevented by this file — it is prevented by the database, and this file
 * simply cannot see what the database will not return (sections 98, 99, 172).
 *
 * ## Minimization, then
 *
 * Section 10 and example 3. What is sent is a bounded selection of clinical
 * prose:
 *
 *   * **no identifier of any kind** — no patient id, practitioner id, record
 *     id, appointment id, document id, account id or user id;
 *   * **no direct identifier** — no name, phone number, address, email or date
 *     of birth. Age in years and gender remain, because they change what is
 *     clinically relevant and removing them would degrade the task rather than
 *     protect the patient (section 61);
 *   * **no storage path, no signed URL, no file name, no MIME type**
 *     (section 60);
 *   * **no credential, ever**;
 *   * bounded history rather than the whole record (sections 55, 56);
 *   * documents only when the practitioner selected them, and as metadata only
 *     (sections 57, 58).
 *
 * `ClinicalAIContext` in `./types.ts` is the complete list of fields any of
 * this can be sent as. That is deliberate: the minimization claim should be
 * checkable by reading one interface.
 *
 * ## The fingerprint
 *
 * Sections 84-85. A short hash over the things that would make a result stale
 * — the record's version, which sections are present, the selected document
 * ids, the counts of history included. It carries no clinical text and cannot
 * be reversed into any; it exists so a result generated against revision 1
 * cannot silently look authoritative against revision 2.
 */

import "server-only";

import { createHash } from "node:crypto";

import {
  CLINICAL_AI_CONTEXT_LIMITS,
  CLINICAL_AI_RUNTIME,
} from "@/config/clinical-ai";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ClinicalAIContext,
  ClinicalAIContextResult,
  ClinicalAIConsultationContext,
  ClinicalAIDocumentContext,
  ClinicalAIHistoryEntry,
  ClinicalAIPrescriptionContext,
  ClinicalAITreatmentPlanContext,
} from "./types";

/**
 * What the practitioner chose to include (section 57).
 *
 * Booleans and a list of document ids — never a patient id, never a
 * practitioner id, never a record id. The current consultation is not
 * selectable: it is the thing being worked on, and a request about it with it
 * excluded would be a request about nothing.
 *
 * The server enforces authorization regardless of what is selected: a document
 * id for another patient's file simply does not come back from the query, and
 * `includeHistory` reaches only records this practitioner authored.
 */
export interface ClinicalAIContextSelection {
  readonly includeHistory: boolean;
  readonly includePrescriptions: boolean;
  readonly includeTreatmentPlans: boolean;
  readonly documentIds: readonly string[];
}

export const DEFAULT_CONTEXT_SELECTION: ClinicalAIContextSelection = {
  includeHistory: true,
  includePrescriptions: true,
  includeTreatmentPlans: false,
  documentIds: [],
};

/**
 * Builds the context for one appointment.
 *
 * Takes an appointment id and a selection. It does **not** take a patient id,
 * a practitioner id or a clinical record id, and there is no overload that
 * does — the pattern Phases 07 and 11-14 established, for the reason Phase 07
 * gave: an identifier that cannot be passed cannot be substituted.
 */
export async function buildClinicalAIContext(
  appointmentId: string,
  selection: ClinicalAIContextSelection,
): Promise<ClinicalAIContextResult> {
  try {
    const supabase = await createSupabaseServerClient();

    // Under `appointments_select_own_practitioner`. Another practitioner's
    // appointment is simply absent, which is the same answer as one that never
    // existed (sections 8, 141).
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_type_id, starts_at, status")
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (appointmentError) {
      logger.error("clinical_ai.appointment_read_failed", appointmentError);
      return { status: "unavailable" };
    }

    if (!appointment) return { status: "not_found" };

    const patientId = appointment.patient_id;

    const [
      patient,
      typeName,
      record,
      history,
      prescriptions,
      treatmentPlans,
      documents,
    ] = await Promise.all([
      readPatient(patientId),
      readAppointmentTypeName(appointment.appointment_type_id),
      readConsultation(appointmentId),
      selection.includeHistory ? readHistory(patientId, appointmentId) : [],
      selection.includePrescriptions ? readPrescriptions(patientId) : [],
      selection.includeTreatmentPlans ? readTreatmentPlans(patientId) : [],
      selection.documentIds.length > 0
        ? readDocuments(patientId, selection.documentIds)
        : [],
    ]);

    const consultation: ClinicalAIConsultationContext | null = record
      ? {
          recordedOn: isoDate(appointment.starts_at),
          appointmentType: typeName,
          status: record.status,
          chiefComplaint: clip(record.chief_complaint),
          historyOfPresentingConcern: clip(
            record.history_of_presenting_concern,
          ),
          symptoms: clip(record.symptoms),
          clinicalObservations: clip(record.clinical_observations),
          assessment: clip(record.assessment),
          diagnosisOrClinicalImpression: clip(
            record.diagnosis_or_clinical_impression,
          ),
          doctorNotes: clip(record.doctor_notes),
          followUpNotes: clip(record.follow_up_notes),
        }
      : null;

    const sources = describeSources({
      consultation,
      history,
      prescriptions,
      treatmentPlans,
      documents,
    });

    const context: ClinicalAIContext = {
      patient,
      consultation,
      previousConsultations: history,
      prescriptions,
      treatmentPlans,
      documents,
      sources,
      fingerprint: fingerprint({
        recordId: record?.id ?? null,
        version: record?.version ?? null,
        status: record?.status ?? null,
        historyCount: history.length,
        prescriptionCount: prescriptions.length,
        planCount: treatmentPlans.length,
        documentIds: documents.map((document) => document.title).sort(),
        appointmentStatus: appointment.status,
      }),
      truncated: false,
    };

    return { status: "ok", context };
  } catch (error) {
    logger.error("clinical_ai.context_build_failed", error);
    return { status: "unavailable" };
  }
}

/*
 * ---------------------------------------------------------------------------
 * Reads — every one under row-level security, every one column-scoped
 * ---------------------------------------------------------------------------
 */

/**
 * Age and gender. **Not** name, phone, date of birth or address.
 *
 * The date of birth is read in order to compute an age and is then discarded;
 * it never reaches the context type, so it cannot reach the provider. Age is
 * derived rather than stored, for the reason Phase 07 gave — a stored age is
 * wrong within a year.
 */
async function readPatient(patientId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("patients")
      .select("date_of_birth, gender")
      .eq("id", patientId)
      .maybeSingle<{ date_of_birth: string | null; gender: string | null }>();

    return {
      ageYears: data?.date_of_birth ? ageInYears(data.date_of_birth) : null,
      gender: data?.gender ?? null,
    };
  } catch {
    return { ageYears: null, gender: null };
  }
}

async function readAppointmentTypeName(typeId: string): Promise<string> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("appointment_types")
      .select("name")
      .eq("id", typeId)
      .maybeSingle<{ name: string }>();

    return data?.name ?? "Consultation";
  } catch {
    return "Consultation";
  }
}

async function readConsultation(
  appointmentId: string,
): Promise<ConsultationRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clinical_records")
    .select(
      "id, version, status, chief_complaint, history_of_presenting_concern, symptoms, clinical_observations, assessment, diagnosis_or_clinical_impression, doctor_notes, follow_up_notes",
    )
    .eq("appointment_id", appointmentId)
    .maybeSingle<ConsultationRow>();

  return data ?? null;
}

/**
 * Previous consultations, bounded and summarised.
 *
 * Three fields per entry rather than eight: a summary of what the patient came
 * in with, what the practitioner concluded, and any impression recorded. The
 * full notes of three earlier consultations would be most of a medical history
 * sent to a third party for a marginal gain in context (sections 55, 56).
 *
 * `clinical_records_select_author` scopes this to what *this* practitioner
 * wrote, so a colleague's consultation is not in the context — the same
 * boundary the clinical history list has, for the same reason.
 */
async function readHistory(
  patientId: string,
  excludeAppointmentId: string,
): Promise<readonly ClinicalAIHistoryEntry[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("clinical_records")
      .select(
        "appointment_id, created_at, chief_complaint, assessment, diagnosis_or_clinical_impression",
      )
      .eq("patient_id", patientId)
      .neq("appointment_id", excludeAppointmentId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(CLINICAL_AI_CONTEXT_LIMITS.maxPreviousConsultations)
      .returns<HistoryRow[]>();

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const appointmentIds = [...new Set(rows.map((row) => row.appointment_id))];
    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, starts_at, appointment_type_id")
      .in("id", appointmentIds);

    const typeIds = [
      ...new Set((appointments ?? []).map((row) => row.appointment_type_id)),
    ];
    const { data: types } = typeIds.length
      ? await supabase
          .from("appointment_types")
          .select("id, name")
          .in("id", typeIds)
      : { data: [] };

    const typeNames = new Map((types ?? []).map((row) => [row.id, row.name]));
    const info = new Map(
      (appointments ?? []).map((row) => [
        row.id,
        {
          startsAt: row.starts_at,
          typeName: typeNames.get(row.appointment_type_id) ?? "Consultation",
        },
      ]),
    );

    return rows.map((row) => {
      const appointment = info.get(row.appointment_id);
      return {
        occurredOn: isoDate(appointment?.startsAt ?? row.created_at),
        appointmentType: appointment?.typeName ?? "Consultation",
        chiefComplaint: clip(row.chief_complaint),
        assessment: clip(row.assessment),
        diagnosisOrClinicalImpression: clip(
          row.diagnosis_or_clinical_impression,
        ),
      };
    });
  } catch {
    // A history that could not be read yields no history rather than failing
    // the request. The context then genuinely lacks it, and the model is told
    // as much by its absence from the sources list — which is better than a
    // practitioner losing the whole feature to one slow query.
    return [];
  }
}

/**
 * Issued prescriptions, bounded, as flattened text.
 *
 * Items are rendered here rather than passed as objects, because what the model
 * needs is "Ashwagandha churna 1 teaspoon twice daily after food" and what an
 * object would additionally carry is an id and a sort order (section 60).
 *
 * Only `issued`: a draft is not a thing the patient was told to do, and Phase
 * 13 made "a draft is not visible" a property of the data rather than a filter.
 */
async function readPrescriptions(
  patientId: string,
): Promise<readonly ClinicalAIPrescriptionContext[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("prescriptions")
      .select("id, status, issued_at, general_instructions")
      .eq("patient_id", patientId)
      .eq("status", "issued")
      .order("issued_at", { ascending: false })
      .limit(CLINICAL_AI_CONTEXT_LIMITS.maxPreviousPrescriptions)
      .returns<PrescriptionRow[]>();

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const { data: items } = await supabase
      .from("prescription_items")
      .select(
        "prescription_id, sort_order, medicine_name, form, strength, dose_amount, dose_unit, frequency, timing, duration, instructions",
      )
      .in(
        "prescription_id",
        rows.map((row) => row.id),
      )
      .order("sort_order", { ascending: true })
      .returns<PrescriptionItemRow[]>();

    const byPrescription = new Map<string, string[]>();
    for (const item of items ?? []) {
      const list = byPrescription.get(item.prescription_id) ?? [];
      if (list.length >= CLINICAL_AI_CONTEXT_LIMITS.maxPrescriptionItems) {
        continue;
      }
      list.push(describePrescriptionItem(item));
      byPrescription.set(item.prescription_id, list);
    }

    return rows.map((row) => ({
      issuedOn: row.issued_at ? isoDate(row.issued_at) : "unknown",
      status: row.status,
      items: byPrescription.get(row.id) ?? [],
      generalInstructions: clip(row.general_instructions),
    }));
  } catch {
    return [];
  }
}

async function readTreatmentPlans(
  patientId: string,
): Promise<readonly ClinicalAITreatmentPlanContext[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("treatment_plans")
      .select("id, status, title, summary, activated_at")
      .eq("patient_id", patientId)
      .in("status", ["active", "completed"])
      .order("activated_at", { ascending: false })
      .limit(CLINICAL_AI_CONTEXT_LIMITS.maxTreatmentPlans)
      .returns<TreatmentPlanRow[]>();

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const { data: items } = await supabase
      .from("treatment_plan_items")
      .select(
        "treatment_plan_id, sort_order, category, title, instructions, frequency, duration",
      )
      .in(
        "treatment_plan_id",
        rows.map((row) => row.id),
      )
      .order("sort_order", { ascending: true })
      .returns<TreatmentPlanItemRow[]>();

    const byPlan = new Map<string, string[]>();
    for (const item of items ?? []) {
      const list = byPlan.get(item.treatment_plan_id) ?? [];
      if (list.length >= CLINICAL_AI_CONTEXT_LIMITS.maxTreatmentPlanItems) {
        continue;
      }
      list.push(describePlanItem(item));
      byPlan.set(item.treatment_plan_id, list);
    }

    return rows.map((row) => ({
      status: row.status,
      title: clip(row.title),
      summary: clip(row.summary),
      items: byPlan.get(row.id) ?? [],
    }));
  } catch {
    return [];
  }
}

/**
 * The documents the practitioner explicitly selected — **metadata only**.
 *
 * Section 58: authorized, controlled, never "every patient document
 * automatically". The ids come from the request and are filtered by the
 * patient *and* by `patient_documents_select_doctor_care`, so an id for
 * somebody else's file returns no row — a selection is not an authorization.
 *
 * Section 59: no OCR. Phase 14 stores no text from a file, so the model is
 * told a document exists and is not told what it says. The serializer says so
 * explicitly, so the model does not assume it has the contents.
 *
 * No storage path, no file name, no MIME type, no size, no id (section 60).
 */
async function readDocuments(
  patientId: string,
  documentIds: readonly string[],
): Promise<readonly ClinicalAIDocumentContext[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("patient_documents")
      .select("document_type, title, description, created_at, uploaded_by_role")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .in("id", documentIds.slice(0, CLINICAL_AI_CONTEXT_LIMITS.maxDocuments))
      .limit(CLINICAL_AI_CONTEXT_LIMITS.maxDocuments)
      .returns<DocumentRow[]>();

    return (data ?? []).map((row) => ({
      kind: row.document_type,
      title: clipRequired(row.title),
      description: clip(row.description),
      addedOn: isoDate(row.created_at),
      addedBy: row.uploaded_by_role,
    }));
  } catch {
    return [];
  }
}

/*
 * ---------------------------------------------------------------------------
 * Serialization
 * ---------------------------------------------------------------------------
 */

/**
 * The context as the model receives it.
 *
 * ## The fence
 *
 * Everything is wrapped in an explicit delimited block that the system prompt
 * names as data. Sections 34-36 and 94, and this is the structural half of
 * prompt-injection defence: the model is not merely told "treat documents as
 * data", it is shown a boundary and told that everything inside it is data.
 *
 * Any occurrence of the delimiter inside the clinical text is neutralised, so
 * a patient note containing the fence marker cannot close the block early and
 * write outside it. That is the injection that would otherwise work regardless
 * of how firmly the system prompt is worded.
 *
 * ## Truncation is announced
 *
 * If the serialized context exceeds the bound it is cut, and the block says so
 * in words. A model working from a shortened history that has not been told it
 * is shortened will describe the absence of the missing part as a fact about
 * the patient — which is section 128's hallucination, caused by us.
 */
const FENCE_OPEN = "<<<CLINICAL_CONTEXT_BEGIN>>>";
const FENCE_CLOSE = "<<<CLINICAL_CONTEXT_END>>>";

export function serializeClinicalAIContext(context: ClinicalAIContext): {
  readonly text: string;
  readonly truncated: boolean;
} {
  const lines: string[] = [];

  lines.push("PATIENT");
  lines.push(
    `- Age: ${context.patient.ageYears === null ? "not recorded" : `${context.patient.ageYears} years`}`,
  );
  lines.push(`- Gender: ${context.patient.gender ?? "not recorded"}`);
  lines.push(
    "- The patient's name and contact details are deliberately not included.",
  );
  lines.push("");

  if (context.consultation) {
    const consultation = context.consultation;
    lines.push("CURRENT CONSULTATION");
    lines.push(`- Date: ${consultation.recordedOn}`);
    lines.push(`- Type: ${consultation.appointmentType}`);
    lines.push(`- Documentation status: ${consultation.status}`);
    pushField(lines, "Chief complaint", consultation.chiefComplaint);
    pushField(
      lines,
      "History of presenting concern",
      consultation.historyOfPresentingConcern,
    );
    pushField(lines, "Reported symptoms", consultation.symptoms);
    pushField(
      lines,
      "Clinical observations",
      consultation.clinicalObservations,
    );
    pushField(lines, "Assessment", consultation.assessment);
    pushField(
      lines,
      "Clinical impression",
      consultation.diagnosisOrClinicalImpression,
    );
    pushField(lines, "Practitioner notes", consultation.doctorNotes);
    pushField(lines, "Follow-up notes", consultation.followUpNotes);
    lines.push("");
  } else {
    lines.push("CURRENT CONSULTATION");
    lines.push("- No consultation notes have been recorded yet.");
    lines.push("");
  }

  if (context.previousConsultations.length > 0) {
    lines.push(
      `PREVIOUS CONSULTATIONS (the ${context.previousConsultations.length} most recent recorded by this practitioner; there may be others)`,
    );
    for (const entry of context.previousConsultations) {
      lines.push(`- ${entry.occurredOn} (${entry.appointmentType})`);
      pushField(lines, "  Chief complaint", entry.chiefComplaint);
      pushField(lines, "  Assessment", entry.assessment);
      pushField(
        lines,
        "  Clinical impression",
        entry.diagnosisOrClinicalImpression,
      );
    }
    lines.push("");
  }

  if (context.prescriptions.length > 0) {
    lines.push("PREVIOUSLY ISSUED PRESCRIPTIONS (most recent first)");
    for (const prescription of context.prescriptions) {
      lines.push(`- Issued ${prescription.issuedOn}`);
      for (const item of prescription.items) lines.push(`  - ${item}`);
      pushField(
        lines,
        "  General instructions",
        prescription.generalInstructions,
      );
    }
    lines.push("");
  }

  if (context.treatmentPlans.length > 0) {
    lines.push("TREATMENT PLANS");
    for (const plan of context.treatmentPlans) {
      lines.push(`- ${plan.title ?? "Untitled plan"} (${plan.status})`);
      pushField(lines, "  Summary", plan.summary);
      for (const item of plan.items) lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  if (context.documents.length > 0) {
    lines.push(
      "ATTACHED DOCUMENTS — TITLES ONLY. The contents of these files have NOT been provided to you and you cannot read them. Do not state or infer anything about what any of them contains.",
    );
    for (const document of context.documents) {
      lines.push(
        `- ${document.kind}: "${document.title}" (added ${document.addedOn} by the ${document.addedBy})`,
      );
      pushField(lines, "  Note added with it", document.description);
    }
    lines.push("");
  }

  const body = neutralizeFence(lines.join("\n").trim());

  const limit = CLINICAL_AI_RUNTIME.maxContextChars;
  const truncated = body.length > limit;
  const clipped = truncated ? body.slice(0, limit) : body;

  const notice = truncated
    ? "\n\nNOTE: this record was too long to include in full and has been shortened. Do not treat what you can see as the complete record."
    : "";

  return {
    text: `${FENCE_OPEN}\n${clipped}${notice}\n${FENCE_CLOSE}`,
    truncated,
  };
}

/**
 * Stops clinical text closing the fence.
 *
 * A patient note containing the closing marker would otherwise end the data
 * block, and everything after it would be read as instructions — the one
 * injection that works whatever the system prompt says. Replacing the marker
 * loses nothing: no legitimate clinical note contains it.
 */
function neutralizeFence(text: string): string {
  return text
    .split(FENCE_OPEN)
    .join("[removed]")
    .split(FENCE_CLOSE)
    .join("[removed]");
}

function pushField(lines: string[], label: string, value: string | null): void {
  if (!value) return;
  lines.push(`- ${label}: ${value}`);
}

/*
 * ---------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------
 */

/** Trims, bounds and normalises a clinical free-text field. */
function clip(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const bounded =
    trimmed.length > CLINICAL_AI_CONTEXT_LIMITS.maxFieldChars
      ? `${trimmed.slice(0, CLINICAL_AI_CONTEXT_LIMITS.maxFieldChars)}…`
      : trimmed;

  // Newlines become spaces so one field stays one line: the serialized format
  // is line-oriented, and a note with its own line breaks would otherwise look
  // like several fields.
  return bounded.replace(/\s*\n\s*/g, " ");
}

function clipRequired(value: string): string {
  return clip(value) ?? "untitled";
}

function isoDate(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Age in whole years, from an ISO calendar date.
 *
 * String comparison rather than `Date` arithmetic, for the reason Phase 07
 * recorded: `new Date("1990-04-07")` is midnight UTC, and comparing it against
 * a local `now` puts the birthday boundary hours away from local midnight.
 */
function ageInYears(dateOfBirth: string): number | null {
  const parts = dateOfBirth.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() + 1 < month ||
    (now.getMonth() + 1 === month && now.getDate() < day);

  if (beforeBirthday) age -= 1;

  return age >= 0 && age < 130 ? age : null;
}

function describePrescriptionItem(item: PrescriptionItemRow): string {
  const parts = [
    item.medicine_name,
    item.strength,
    item.form,
    [item.dose_amount, item.dose_unit].filter(Boolean).join(" "),
    item.frequency,
    item.timing,
    item.duration,
    item.instructions,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  return clipRequired(parts.join(", "));
}

function describePlanItem(item: TreatmentPlanItemRow): string {
  const parts = [
    `${item.category}: ${item.title}`,
    item.instructions,
    item.frequency,
    item.duration,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  return clipRequired(parts.join(" — "));
}

/**
 * What the practitioner is told was considered (sections 41, 132).
 *
 * Kinds and counts, never content. It is what lets the panel say "Based on:
 * this consultation, 2 previous consultations, 1 document" honestly — and it
 * is deliberately built from what was actually *read*, not from what was
 * *requested*, so a selection that returned nothing is not claimed.
 */
function describeSources(parts: {
  consultation: ClinicalAIConsultationContext | null;
  history: readonly ClinicalAIHistoryEntry[];
  prescriptions: readonly ClinicalAIPrescriptionContext[];
  treatmentPlans: readonly ClinicalAITreatmentPlanContext[];
  documents: readonly ClinicalAIDocumentContext[];
}): readonly string[] {
  const sources: string[] = [];

  sources.push(
    parts.consultation
      ? "This consultation's notes"
      : "This appointment (no notes recorded yet)",
  );

  if (parts.history.length > 0) {
    sources.push(
      `${parts.history.length} previous consultation${parts.history.length === 1 ? "" : "s"} you recorded`,
    );
  }
  if (parts.prescriptions.length > 0) {
    sources.push(
      `${parts.prescriptions.length} issued prescription${parts.prescriptions.length === 1 ? "" : "s"}`,
    );
  }
  if (parts.treatmentPlans.length > 0) {
    sources.push(
      `${parts.treatmentPlans.length} treatment plan${parts.treatmentPlans.length === 1 ? "" : "s"}`,
    );
  }
  if (parts.documents.length > 0) {
    sources.push(
      `${parts.documents.length} document title${parts.documents.length === 1 ? "" : "s"} (titles only — file contents are not read)`,
    );
  }

  return sources;
}

/**
 * A short hash of what would make a result stale.
 *
 * SHA-256 truncated to 32 hex characters — enough that two genuinely different
 * contexts do not collide, short enough to be a readable column value. The
 * inputs are versions, statuses and counts: no clinical text goes in, so
 * nothing clinical can come out, and the value is not reversible into anything
 * about the patient.
 */
function fingerprint(input: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 32);
}

/**
 * The fingerprint for a consultation as it stands *now*.
 *
 * Called on every render of the AI panel and compared against the one carried
 * by a displayed result. It must agree exactly with what
 * {@link buildClinicalAIContext} computes for the same state, so both go
 * through the same function with the same shape of input.
 */
export function currentContextFingerprint(input: {
  readonly recordId: string | null;
  readonly version: number | null;
  readonly status: string | null;
  readonly historyCount: number;
  readonly prescriptionCount: number;
  readonly planCount: number;
  readonly documentTitles: readonly string[];
  readonly appointmentStatus: string;
}): string {
  return fingerprint({
    recordId: input.recordId,
    version: input.version,
    status: input.status,
    historyCount: input.historyCount,
    prescriptionCount: input.prescriptionCount,
    planCount: input.planCount,
    documentIds: [...input.documentTitles].sort(),
    appointmentStatus: input.appointmentStatus,
  });
}

/*
 * ---------------------------------------------------------------------------
 * Row shapes
 * ---------------------------------------------------------------------------
 */

interface AppointmentRow {
  id: string;
  patient_id: string;
  appointment_type_id: string;
  starts_at: string;
  status: string;
}

interface ConsultationRow {
  id: string;
  version: number;
  status: string;
  chief_complaint: string | null;
  history_of_presenting_concern: string | null;
  symptoms: string | null;
  clinical_observations: string | null;
  assessment: string | null;
  diagnosis_or_clinical_impression: string | null;
  doctor_notes: string | null;
  follow_up_notes: string | null;
}

interface HistoryRow {
  appointment_id: string;
  created_at: string;
  chief_complaint: string | null;
  assessment: string | null;
  diagnosis_or_clinical_impression: string | null;
}

interface PrescriptionRow {
  id: string;
  status: string;
  issued_at: string | null;
  general_instructions: string | null;
}

interface PrescriptionItemRow {
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
  instructions: string | null;
}

interface TreatmentPlanRow {
  id: string;
  status: string;
  title: string | null;
  summary: string | null;
  activated_at: string | null;
}

interface TreatmentPlanItemRow {
  treatment_plan_id: string;
  sort_order: number;
  category: string;
  title: string;
  instructions: string | null;
  frequency: string | null;
  duration: string | null;
}

interface DocumentRow {
  document_type: string;
  title: string;
  description: string | null;
  created_at: string;
  uploaded_by_role: "patient" | "practitioner";
}
