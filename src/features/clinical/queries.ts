/**
 * Clinical record data access.
 *
 * ## Every read is authorized three times before it returns
 *
 *   1. `assertPermission("clinical_records.read")` here, on a trusted server
 *      path;
 *   2. the database's own role check — `has_app_role('doctor')` inside the
 *      `clinical_records_select_author` policy;
 *   3. the relationship — `practitioner_id = current_practitioner_id()` in
 *      the same policy, which is what actually decides.
 *
 * Delete the first and an unauthorized caller still gets nothing. That is the
 * point of having it in three places (section 54: no single layer is
 * sufficient).
 *
 * ## The practitioner's identity is never an argument
 *
 * No function here takes a practitioner id, and none has an overload that
 * does. The scope comes from `auth.uid()` inside the database. An identifier
 * that cannot be passed cannot be substituted — example 3.
 *
 * ## Why a record id, a patient id and an appointment id *are* accepted
 *
 * All three are filters, never authorization inputs. A record belonging to
 * another practitioner returns no row; a patient the caller is not booked to
 * see returns no row; an appointment outside their diary returns no row. A
 * well-formed identifier for somebody else's data is indistinguishable from
 * one that never existed (sections 56-57).
 *
 * ## Columns, not `select *`
 *
 * Section 26 says so explicitly for clinical records. Every query below names
 * its columns, and the two column lists are deliberately different sizes:
 * the **history list** names six summary columns and no clinical content at
 * all, and the **record view** names the eight clinical fields. A history
 * table is read at a glance and often over a shoulder; a chief complaint does
 * not belong in it.
 *
 * ## Nothing here is cached
 *
 * Section 77. Every caller is a dynamic route inside the authenticated shell,
 * which is `force-dynamic` and served `private, no-store`, and no query below
 * opts into Next.js's data cache. A clinical record must never be served from
 * a cache keyed on anything but the session.
 */

import "server-only";

import { assertPermission } from "@/lib/authorization/guards";
import { logger } from "@/lib/logging/logger";
import { recordSecurityAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ClinicalHistoryEntry,
  ClinicalHistoryResult,
  ClinicalRecord,
  ClinicalRecordResult,
  ClinicalRecordStatus,
  ConsultationAppointment,
  ConsultationContextResult,
  ConsultationPatient,
} from "./types";

/**
 * The full record, for the one screen that reads a consultation.
 *
 * Every clinical field, because the authoring practitioner is the only person
 * who can reach this row at all and they wrote all of it.
 */
const RECORD_COLUMNS = [
  "id",
  "appointment_id",
  "patient_id",
  "practitioner_id",
  "status",
  "version",
  "chief_complaint",
  "history_of_presenting_concern",
  "symptoms",
  "clinical_observations",
  "assessment",
  "diagnosis_or_clinical_impression",
  "doctor_notes",
  "follow_up_notes",
  "completed_at",
  "created_at",
  "updated_at",
].join(", ");

/**
 * The summary columns a history list needs.
 *
 * **No clinical content.** Section 26's "separate the doctor clinical view
 * from the patient-safe view" applies within the doctor's own screens too: a
 * list does not need the notes, so it does not fetch them.
 */
const HISTORY_COLUMNS = [
  "id",
  "appointment_id",
  "status",
  "completed_at",
  "created_at",
  "updated_at",
].join(", ");

/**
 * How many records a patient's clinical history lists.
 *
 * Section 84: paginate history where appropriate, and do not load every
 * historical record initially. Bounded rather than paged, for the reason
 * Phase 11 gave about patient search — a practitioner's own history with one
 * patient is tens of consultations, and a page-two control on a list nobody
 * reads to the end is a control that exists to be unused. The bound is
 * visible on the page.
 */
export const CLINICAL_HISTORY_LIMIT = 20;

/**
 * The consultation workspace's whole context, in one place.
 *
 * Returns `not_started` when the appointment exists and has no clinical
 * record: a real state with its own screen, distinct from "we could not read
 * it" and from "that is not yours". Section 19's flow is
 * `appointment -> start consultation -> record`, and the page before the
 * start is a page about an appointment, not a broken one.
 *
 * The appointment is read first, and it is read under
 * `appointments_select_own_practitioner` — so a consultation on somebody
 * else's appointment is `not_found` before any clinical query runs.
 */
export async function getConsultationContext(
  appointmentId: string,
): Promise<ConsultationContextResult> {
  const user = await assertPermission("clinical_records.read");

  try {
    const supabase = await createSupabaseServerClient();

    const { data: appointmentRow, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_type_id, starts_at, ends_at, status")
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (appointmentError) {
      logger.error("clinical.appointment_read_failed", appointmentError, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    if (!appointmentRow) return { status: "not_found" };

    const { data: recordRow, error: recordError } = await supabase
      .from("clinical_records")
      .select(RECORD_COLUMNS)
      .eq("appointment_id", appointmentId)
      .maybeSingle<ClinicalRecordRow>();

    if (recordError) {
      logger.error("clinical.record_read_failed", recordError, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    if (!recordRow) return { status: "not_started" };

    const [patient, typeName] = await Promise.all([
      readConsultationPatient(appointmentRow.patient_id),
      readAppointmentTypeName(appointmentRow.appointment_type_id),
    ]);

    return {
      status: "found",
      context: {
        record: toClinicalRecord(recordRow),
        patient,
        appointment: toConsultationAppointment(appointmentRow, typeName),
      },
    };
  } catch (error) {
    logger.error("clinical.consultation_read_error", error, {
      userId: user.id,
    });
    return { status: "unavailable" };
  }
}

/**
 * The appointment a consultation would be documented against, before one is
 * started.
 *
 * Kept separate from the context above because the two screens need different
 * things: this one renders the patient and the appointment with a "start"
 * action, and does not need a record that does not exist.
 */
export async function getConsultationSubject(appointmentId: string): Promise<
  | {
      readonly status: "found";
      readonly appointment: ConsultationAppointment;
      readonly patient: ConsultationPatient | null;
    }
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" }
> {
  const user = await assertPermission("clinical_records.read");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("id, patient_id, appointment_type_id, starts_at, ends_at, status")
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (error) {
      logger.error("clinical.appointment_read_failed", error, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    if (!data) return { status: "not_found" };

    const [patient, typeName] = await Promise.all([
      readConsultationPatient(data.patient_id),
      readAppointmentTypeName(data.appointment_type_id),
    ]);

    return {
      status: "found",
      appointment: toConsultationAppointment(data, typeName),
      patient,
    };
  } catch (error) {
    logger.error("clinical.subject_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * One clinical record, by its own id.
 *
 * The id filters; it does not authorize. `clinical_records_select_author`
 * restricts the table to records this practitioner wrote, so somebody else's
 * returns `not_found` — the same answer as an id that never existed
 * (section 57).
 */
export async function getClinicalRecord(
  recordId: string,
): Promise<ClinicalRecordResult> {
  const user = await assertPermission("clinical_records.read");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("clinical_records")
      .select(RECORD_COLUMNS)
      .eq("id", recordId)
      .maybeSingle<ClinicalRecordRow>();

    if (error) {
      logger.error("clinical.record_read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    if (!data) return { status: "not_found" };

    // Phase 19. A practitioner opening a clinical record is privileged access
    // to somebody else's data, and `phase_19.md` section 89 asks for it to be
    // capturable. Recorded only on a successful read: a `not_found` is either
    // a mistyped id or row-level security refusing, and neither is an access.
    //
    // Nothing about the record's contents is recorded, because the audit table
    // has no column that could hold any.
    await recordSecurityAuditEvent({
      action: "clinical_record.read",
      resourceType: "clinical_record",
      outcome: "allowed",
      resourceId: data.id,
      subjectPatientId: data.patient_id,
    });

    return { status: "found", record: toClinicalRecord(data) };
  } catch (error) {
    logger.error("clinical.record_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * A patient's clinical history, as this practitioner can see it.
 *
 * Sections 39, 64 and 65. Scoped three times over and bounded once:
 *
 *   * the permission, here;
 *   * `clinical_records_select_author`, which restricts the rows to records
 *     this practitioner authored;
 *   * the patient id in the query, which narrows those to one patient;
 *   * `CLINICAL_HISTORY_LIMIT`, so the query is bounded whatever the
 *     patient's history looks like in five years.
 *
 * Section 64: "do not query all clinical records and filter in JavaScript."
 * The filter, the ordering and the bound are all in the statement, served by
 * `clinical_records_patient_idx`.
 *
 * The appointment date is what a practitioner means by "when" — the record's
 * `created_at` is when it was typed up, which can be the following morning.
 * So the occurrence date comes from the appointment, joined in one bounded
 * second query rather than per row.
 */
export async function getPatientClinicalHistory(
  patientId: string,
  limit = CLINICAL_HISTORY_LIMIT,
): Promise<ClinicalHistoryResult> {
  const user = await assertPermission("clinical_records.read");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("clinical_records")
      .select(HISTORY_COLUMNS)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), CLINICAL_HISTORY_LIMIT))
      .returns<ClinicalHistorySummaryRow[]>();

    if (error) {
      logger.error("clinical.history_read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    const rows = data ?? [];
    if (rows.length === 0) return { status: "found", entries: [] };

    // One bounded lookup for the appointments the records reference, rather
    // than N+1 or an embedded join. The rows come back under
    // `appointments_select_own_practitioner`, and every id in the list came
    // from a record this practitioner authored — which is an appointment of
    // theirs by the composite foreign key.
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
    const appointmentInfo = new Map(
      (appointments ?? []).map((row) => [
        row.id,
        {
          startsAt: new Date(row.starts_at),
          typeName: typeNames.get(row.appointment_type_id) ?? "Consultation",
        },
      ]),
    );

    return {
      status: "found",
      entries: rows.map((row) => {
        const appointment = appointmentInfo.get(row.appointment_id);

        return {
          id: row.id,
          appointmentId: row.appointment_id,
          status: row.status,
          // Falls back to when the record was written if the appointment
          // could not be read. A date that is slightly off beats a blank that
          // looks like a rendering failure.
          occurredAt: appointment?.startsAt ?? new Date(row.created_at),
          appointmentTypeName: appointment?.typeName ?? "Consultation",
          completedAt: row.completed_at ? new Date(row.completed_at) : null,
          updatedAt: new Date(row.updated_at),
        } satisfies ClinicalHistoryEntry;
      }),
    };
  } catch (error) {
    logger.error("clinical.history_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/*
 * ---------------------------------------------------------------------------
 * Shared reads
 * ---------------------------------------------------------------------------
 */

/**
 * The patient's identity, for the consultation header (sections 28-29).
 *
 * Six columns. No address, no emergency contact, no account identifier — the
 * header exists so the practitioner can confirm they have the right person,
 * and none of those helps with that. It runs under
 * `patients_select_doctor_care`, so it returns nothing for a patient outside
 * the caller's care scope; the header then renders a neutral fallback rather
 * than failing the page, because the clinical record itself is still correct.
 */
async function readConsultationPatient(
  patientId: string,
): Promise<ConsultationPatient | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("patients")
      .select("id, full_name, preferred_name, date_of_birth, gender, phone")
      .eq("id", patientId)
      .maybeSingle<PatientRow>();

    if (error || !data) {
      // No patient name, no identifier beyond the opaque one, no clinical
      // content — and deliberately not the patient id either, because a
      // clinical log line should not become a way to enumerate who was seen.
      if (error) logger.error("clinical.patient_read_failed", error);
      return null;
    }

    return {
      id: data.id,
      fullName: data.full_name,
      preferredName: data.preferred_name,
      dateOfBirth: data.date_of_birth,
      gender: data.gender,
      phone: data.phone,
    };
  } catch (error) {
    logger.error("clinical.patient_read_error", error);
    return null;
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

/*
 * ---------------------------------------------------------------------------
 * Mapping
 * ---------------------------------------------------------------------------
 */

interface ClinicalRecordRow {
  id: string;
  appointment_id: string;
  patient_id: string;
  practitioner_id: string;
  status: ClinicalRecordStatus;
  version: number;
  chief_complaint: string | null;
  history_of_presenting_concern: string | null;
  symptoms: string | null;
  clinical_observations: string | null;
  assessment: string | null;
  diagnosis_or_clinical_impression: string | null;
  doctor_notes: string | null;
  follow_up_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ClinicalHistorySummaryRow {
  id: string;
  appointment_id: string;
  status: ClinicalRecordStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  appointment_type_id: string;
  starts_at: string;
  ends_at: string;
  status: ConsultationAppointment["status"];
}

interface PatientRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
}

/**
 * A stored null becomes an empty string.
 *
 * The database stores "this section was not written" as null; a textarea
 * needs a string. Doing it here rather than in the component keeps the
 * distinction out of the UI entirely — and the reverse conversion happens in
 * the database function, which normalises blank back to null. Neither side
 * ever sees the other's representation.
 */
function toClinicalRecord(row: ClinicalRecordRow): ClinicalRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    practitionerId: row.practitioner_id,
    status: row.status,
    version: row.version,
    chiefComplaint: row.chief_complaint ?? "",
    historyOfPresentingConcern: row.history_of_presenting_concern ?? "",
    symptoms: row.symptoms ?? "",
    clinicalObservations: row.clinical_observations ?? "",
    assessment: row.assessment ?? "",
    diagnosisOrClinicalImpression: row.diagnosis_or_clinical_impression ?? "",
    doctorNotes: row.doctor_notes ?? "",
    followUpNotes: row.follow_up_notes ?? "",
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toConsultationAppointment(
  row: AppointmentRow,
  typeName: string,
): ConsultationAppointment {
  return {
    id: row.id,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    status: row.status,
    typeName,
  };
}
