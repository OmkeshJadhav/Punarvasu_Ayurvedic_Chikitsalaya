/**
 * Doctor workspace data access.
 *
 * ## Why this feature depends on `features/appointments`
 *
 * `docs/ARCHITECTURE.md` section 4 says a feature must not import another
 * feature's internals. `docs/PRODUCT_SPEC.md` section 5A says something more
 * specific about this pair: *"Appointments sit beneath both staff
 * workspaces. Appointment logic belongs in one shared domain layer, not
 * duplicated per workspace."* `phase_11.md` section 10 repeats it.
 *
 * So `features/appointments` is the domain layer this workspace is built on,
 * and the timezone conversions, the status matrix, the schedule helpers and
 * the error mapper are **imported, not copied**. It does not import
 * `features/reception`, which is a peer.
 *
 * ## Every read is authorized three times before it returns
 *
 *   1. `assertPermission(...)` here, on a trusted server path;
 *   2. the database's own role check, inside every `security definer`
 *      function this layer calls;
 *   3. row-level security, which decides what any query can see at all.
 *
 * Delete the first and an unauthorized caller still gets nothing. That is the
 * point of having it in three places (`phase_11.md` sections 45-46).
 *
 * ## The doctor's identity is never an argument
 *
 * No function here takes a practitioner id, and none has an overload that
 * does. The scope comes from `auth.uid()` inside the database —
 * `appointments_select_own_practitioner` for the diary,
 * `patients_select_doctor_care` for the patients. An identifier that cannot
 * be passed cannot be substituted (`phase_11.md` sections 47-48 and example
 * 2).
 *
 * ## Why an appointment id or a patient id *is* accepted
 *
 * Both are filters, never authorization inputs. An appointment belonging to
 * another practitioner returns no row, and a patient the caller is not booked
 * to see returns no row — so a well-formed identifier for somebody else's
 * record is indistinguishable from one that never existed
 * (`phase_11.md` section 24).
 *
 * ## Columns, not `select *`
 *
 * `phase_11.md` section 44. Every query below names its columns, so a column
 * added to a table later does not silently start reaching a screen.
 */

import "server-only";

import {
  currentAndNext,
  partitionByTime,
} from "@/features/appointments/schedule";
import {
  addDaysToIsoDate,
  clinicWallClockToInstant,
  toClinicIsoDate,
} from "@/features/appointments/time";
import type { AppointmentStatus } from "@/features/appointments/types";
import { assertPermission } from "@/lib/authorization/guards";
import { logger } from "@/lib/logging/logger";
import { recordSecurityAuditEvent } from "@/lib/security/audit";
import { allowOperation } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  CarePatient,
  CarePatientResult,
  CarePatientSearchOutcome,
  CarePatientSearchResult,
  DoctorAppointment,
  DoctorAppointmentResult,
  DoctorDaySummary,
  DoctorIdentityResult,
  DoctorScheduleResult,
} from "./types";
import type { DoctorAppointmentRange } from "./validation";
import { CARE_SEARCH_LIMIT, CARE_SEARCH_MIN_LENGTH } from "./validation";

export { currentAndNext, partitionByTime };

/**
 * The appointment columns this workspace needs.
 *
 * `internal_note` is not here, and could not be: no client role holds a
 * column grant on it, so naming it would make the query fail.
 * `blocked_until`, `created_by` and `cancelled_by` are likewise ungranted
 * internal metadata. `cancellation_reason` is granted but deliberately not
 * read — a practitioner does not need the desk's note about why a slot was
 * released, and the appointment's own history already records that it was.
 */
const APPOINTMENT_COLUMNS = [
  "id",
  "patient_id",
  "appointment_type_id",
  "starts_at",
  "ends_at",
  "status",
  "patient_note",
  "cancelled_at",
  "created_at",
].join(", ");

/**
 * The patient columns a consultation needs.
 *
 * Narrower than the front desk's, deliberately. There is no
 * `address_line1`, `address_line2` or `postal_code`: `phase_11.md` section 44
 * asks for only the fields the workflow needs, and no Phase 11 workflow needs
 * a doorstep. The town and state stay, because where somebody has travelled
 * from is context a practitioner uses.
 *
 * There is nothing clinical to leave out — `public.patients` has no such
 * column, and Phase 07's migration says none may be added.
 */
const CARE_PATIENT_COLUMNS = [
  "id",
  "full_name",
  "preferred_name",
  "phone",
  "date_of_birth",
  "gender",
  "city",
  "state",
  "preferred_language",
  "emergency_contact_name",
  "emergency_contact_relationship",
  "emergency_contact_phone",
  "created_at",
].join(", ");

/**
 * How many past appointments a patient's page lists.
 *
 * Bounded, because a long-standing patient's history is not something anybody
 * reads in one sitting — and an unbounded query on a screen that renders
 * every row is how a page becomes slow years after it was written
 * (`phase_11.md` section 61).
 */
export const PATIENT_HISTORY_LIMIT = 20;

/** How far ahead "upcoming" reaches, and how far back "past" does. */
const UPCOMING_LIMIT = 50;
const PAST_LIMIT = 50;

/**
 * Who the signed-in doctor is, as the scheduling system knows them.
 *
 * Takes no argument and there is no overload that does. The practitioner id
 * comes from `public.current_practitioner_id()`, which reads `auth.uid()` and
 * cannot be asked about anybody else.
 *
 * `not_a_practitioner` is a real, expected state and is distinguished from a
 * failed read: a doctor account that an administrator has not yet added to
 * the scheduling roster has no diary, and telling them that beats showing
 * them an empty day.
 */
export async function getDoctorIdentity(): Promise<DoctorIdentityResult> {
  const user = await assertPermission("appointments.read.own_schedule");

  try {
    const supabase = await createSupabaseServerClient();
    const { data: practitionerId, error } = await supabase.rpc(
      "current_practitioner_id",
    );

    if (error) {
      logger.error("doctor.identity_read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    if (typeof practitionerId !== "string") {
      return { status: "not_a_practitioner" };
    }

    // The display name is the practitioner's own scheduling name. It is read
    // separately because `current_practitioner_id()` deliberately returns an
    // id and nothing else, and because this read goes through the ordinary
    // column grant rather than through a definer function.
    const { data, error: nameError } = await supabase
      .from("practitioners")
      .select("id, display_name")
      .eq("id", practitionerId)
      .maybeSingle();

    if (nameError) {
      logger.error("doctor.identity_name_failed", nameError, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    return {
      status: "found",
      identity: {
        practitionerId,
        // A practitioner whose row cannot be read still has a usable
        // workspace; only the greeting is poorer for it.
        displayName: data?.display_name ?? "Practitioner",
      },
    };
  } catch (error) {
    logger.error("doctor.identity_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

export interface DoctorDaySchedule {
  readonly result: DoctorScheduleResult;
  readonly summary: DoctorDaySummary;
}

/**
 * The practitioner's own diary for one clinic day.
 *
 * One bounded query for the day. The scope is **not** applied here: there is
 * no `.eq("practitioner_id", …)` in this function, because there is no
 * practitioner id in this function. `appointments_select_own_practitioner`
 * restricts the table to the caller's own diary, so the query returns their
 * day or nothing, whatever the application does.
 *
 * `unavailable` rather than an empty day for a failed read: a practitioner
 * told their morning is clear when the database was unreachable will go and
 * do something else.
 */
export async function getDoctorDaySchedule(
  date: string,
): Promise<DoctorDaySchedule> {
  const user = await assertPermission("appointments.read.own_schedule");

  const from = clinicWallClockToInstant(date, 0);
  const to = clinicWallClockToInstant(addDaysToIsoDate(date, 1), 0);

  if (!from || !to) {
    return { result: { status: "unavailable" }, summary: emptySummary() };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at", { ascending: true })
      .returns<AppointmentRow[]>();

    if (error) {
      // The acting practitioner's id is opaque and is what makes this
      // diagnosable. No patient name, phone number or appointment time is
      // logged.
      logger.error("doctor.schedule_read_failed", error, { userId: user.id });
      return { result: { status: "unavailable" }, summary: emptySummary() };
    }

    const appointments = await resolveAppointments(data ?? []);

    return {
      result: { status: "found", appointments },
      summary: summariseDay(appointments),
    };
  } catch (error) {
    logger.error("doctor.schedule_read_error", error, { userId: user.id });
    return { result: { status: "unavailable" }, summary: emptySummary() };
  }
}

export interface DoctorAppointmentFilters {
  readonly range: DoctorAppointmentRange;
  readonly status?: AppointmentStatus | undefined;
  readonly appointmentTypeId?: string | undefined;
}

/**
 * The practitioner's appointments, filtered.
 *
 * The range is turned into a bounded time window in the query rather than
 * being applied in memory over everything, so "past" on a practitioner with
 * years of history is still one bounded read (`phase_11.md` section 61).
 * Status and type are narrow equality filters on top.
 */
export async function getDoctorAppointments(
  filters: DoctorAppointmentFilters,
  now: Date = new Date(),
): Promise<DoctorScheduleResult> {
  const user = await assertPermission("appointments.read.own_schedule");

  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase.from("appointments").select(APPOINTMENT_COLUMNS);

    if (filters.range === "today") {
      const day = toClinicIsoDate(now);
      const today = clinicWallClockToInstant(day, 0);
      const tomorrow = clinicWallClockToInstant(addDaysToIsoDate(day, 1), 0);
      if (!today || !tomorrow) return { status: "unavailable" };

      query = query
        .gte("starts_at", today.toISOString())
        .lt("starts_at", tomorrow.toISOString())
        .order("starts_at", { ascending: true })
        .limit(UPCOMING_LIMIT);
    } else if (filters.range === "upcoming") {
      // By the appointment's end, so a consultation under way is still
      // upcoming rather than dropping out of view while the patient is in
      // the room.
      query = query
        .gte("ends_at", now.toISOString())
        .order("starts_at", { ascending: true })
        .limit(UPCOMING_LIMIT);
    } else {
      query = query
        .lt("ends_at", now.toISOString())
        .order("starts_at", { ascending: false })
        .limit(PAST_LIMIT);
    }

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.appointmentTypeId) {
      query = query.eq("appointment_type_id", filters.appointmentTypeId);
    }

    const { data, error } = await query.returns<AppointmentRow[]>();

    if (error) {
      logger.error("doctor.appointments_read_failed", error, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    return {
      status: "found",
      appointments: await resolveAppointments(data ?? []),
    };
  } catch (error) {
    logger.error("doctor.appointments_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * One of the practitioner's own appointments.
 *
 * The id filters; it does not authorize. An appointment belonging to another
 * practitioner returns `not_found`, which is the same answer as an id that
 * never existed — an appointment id must not be an oracle for whether
 * somebody else's appointment exists (`phase_11.md` section 24).
 */
export async function getDoctorAppointment(
  appointmentId: string,
): Promise<DoctorAppointmentResult> {
  const user = await assertPermission("appointments.read.own_schedule");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (error) {
      logger.error("doctor.appointment_read_failed", error, {
        userId: user.id,
      });
      return { status: "unavailable" };
    }

    if (!data) return { status: "not_found" };

    const [appointment] = await resolveAppointments([data]);
    return appointment
      ? { status: "found", appointment }
      : { status: "not_found" };
  } catch (error) {
    logger.error("doctor.appointment_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * A patient in the practitioner's care scope.
 *
 * Two independent things scope this, and neither is in the query:
 * `patients_select_doctor_care` restricts the table to patients this
 * practitioner has an appointment with, and the column list keeps the
 * disclosure to what a consultation needs. A patient the caller is not
 * booked to see returns `not_found` — the same answer as a patient who does
 * not exist.
 */
export async function getCarePatient(
  patientId: string,
): Promise<CarePatientResult> {
  const user = await assertPermission("patients.read.care");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("patients")
      .select(CARE_PATIENT_COLUMNS)
      .eq("id", patientId)
      .maybeSingle<CarePatientRow>();

    if (error) {
      logger.error("doctor.patient_read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    if (!data) return { status: "not_found" };

    // Phase 19. Staff reaching a patient's record is privileged access, and
    // `phase_19.md` section 89 asks for it to be capturable. Recorded on a
    // successful read only: a `not_found` is a mistyped id or row-level
    // security refusing, and neither is an access.
    //
    // The patient's own read of their own record is deliberately not audited
    // anywhere — it is not privileged, it happens constantly, and recording it
    // would bury the entries that matter.
    await recordSecurityAuditEvent({
      action: "patient_record.read",
      resourceType: "patient",
      outcome: "allowed",
      resourceId: data.id,
      subjectPatientId: data.id,
    });

    return { status: "found", patient: toCarePatient(data) };
  } catch (error) {
    logger.error("doctor.patient_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * This practitioner's own appointments with one patient.
 *
 * `phase_11.md` sections 32-33: appointment history, never clinical history.
 * The rows carry a date, a type and a status, and the type they are mapped
 * into has no field for anything else.
 *
 * It is scoped twice over: by the patient id in the query, and by
 * `appointments_select_own_practitioner` — so this is the history of *this
 * practitioner's* care, not the clinic's. That is the treatment-relationship
 * scoping `docs/SECURITY.md` section 6 requires, and it means a doctor cannot
 * read what a colleague did.
 */
export async function getCarePatientAppointments(
  patientId: string,
  limit = PATIENT_HISTORY_LIMIT,
): Promise<readonly DoctorAppointment[]> {
  await assertPermission("appointments.read.own_schedule");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("patient_id", patientId)
      .order("starts_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50))
      .returns<AppointmentRow[]>();

    if (error || !data) {
      if (error) logger.error("doctor.patient_appointments_failed", error);
      return [];
    }

    return resolveAppointments(data);
  } catch (error) {
    logger.error("doctor.patient_appointments_error", error);
    return [];
  }
}

/**
 * Patient search, within the practitioner's own care scope.
 *
 * Goes through `public.search_care_patients`, which is `security definer` and
 * does five things this layer could not do as well on its own:
 *
 *   * checks the caller's role **and** resolves their practitioner identity
 *     in the database;
 *   * restricts the rows to patients with an appointment with that
 *     practitioner, in the `from` clause rather than in a predicate a later
 *     edit could drop;
 *   * refuses a query shorter than two characters, so an empty box is never a
 *     "list every patient" button;
 *   * clamps the result count itself, so the caller does not choose it;
 *   * treats the typed text as a parameter rather than as part of a filter
 *     expression, which is what a multi-column PostgREST `or=(...)` would
 *     have made it.
 *
 * A short query returns `tooShort` rather than an error, because somebody
 * halfway through typing a name has not made a mistake.
 */
export async function searchCarePatients(
  query: string,
): Promise<CarePatientSearchOutcome> {
  const user = await assertPermission("patients.read.care");

  const term = query.trim();
  if (term.length === 0) {
    return { status: "idle", results: [], tooShort: false };
  }
  if (term.length < CARE_SEARCH_MIN_LENGTH) {
    return { status: "idle", results: [], tooShort: true };
  }

  // Phase 19. The search is already bounded in rows — a term under two
  // characters finds nothing and the database clamps the result count — but it
  // was unbounded in *rate*, and repeating a bounded search is the cheapest way
  // to walk a patient list. Checked after the length guard, so a receptionist
  // mid-word does not spend allowance on a query that runs nothing.
  if (!allowOperation("patient_search", user.id)) {
    logger.warn("doctor.patient_search_rate_limited", { userId: user.id });
    return { status: "unavailable", results: [], tooShort: false };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_care_patients", {
      p_query: term,
      p_limit: CARE_SEARCH_LIMIT,
    });

    if (error) {
      // The search *term* is not logged. It is somebody's name.
      logger.error("doctor.patient_search_failed", error, { userId: user.id });
      return { status: "unavailable", results: [], tooShort: false };
    }

    return {
      status: "found",
      results: (data ?? []).map(toSearchResult),
      tooShort: false,
    };
  } catch (error) {
    logger.error("doctor.patient_search_error", error, { userId: user.id });
    return { status: "unavailable", results: [], tooShort: false };
  }
}

/*
 * ---------------------------------------------------------------------------
 * Mapping
 * ---------------------------------------------------------------------------
 */

interface AppointmentRow {
  id: string;
  patient_id: string;
  appointment_type_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  patient_note: string | null;
  cancelled_at: string | null;
  created_at: string;
}

interface CarePatientRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  preferred_language: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
}

/**
 * Attaches the patient and type each appointment references.
 *
 * Two bounded lookups keyed by the ids actually present, rather than N+1 or
 * an embedded join: the result is predictably typed against the
 * hand-maintained database types, and a clinic day is tens of rows.
 *
 * The patient lookup goes through `patients_select_doctor_care`, and it
 * cannot return a patient this practitioner has no appointment with —
 * because every id in the list came from an appointment of theirs, which is
 * the relationship. A name that cannot be resolved falls back to a neutral
 * label rather than rendering an identifier or a blank: a blank looks like a
 * rendering failure, and a UUID on a clinical screen is noise somebody has to
 * read past.
 */
async function resolveAppointments(
  rows: readonly AppointmentRow[],
): Promise<readonly DoctorAppointment[]> {
  if (rows.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const patientIds = [...new Set(rows.map((row) => row.patient_id))];
  const typeIds = [...new Set(rows.map((row) => row.appointment_type_id))];

  const [patients, types] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, preferred_name, date_of_birth")
      .in("id", patientIds),
    supabase.from("appointment_types").select("id, name").in("id", typeIds),
  ]);

  const patientRows = new Map(
    (patients.data ?? []).map((row) => [
      row.id,
      {
        // The preferred name is what a practitioner says out loud, so it wins
        // where there is one. The name on the record is still on the patient
        // page.
        name: row.preferred_name?.trim() || row.full_name,
        dateOfBirth: row.date_of_birth,
      },
    ]),
  );
  const typeNames = new Map(
    (types.data ?? []).map((row) => [row.id, row.name]),
  );

  return rows.map((row) => {
    const startsAt = new Date(row.starts_at);
    const endsAt = new Date(row.ends_at);
    const patient = patientRows.get(row.patient_id);

    return {
      id: row.id,
      startsAt,
      endsAt,
      status: row.status,
      durationMinutes: Math.round(
        (endsAt.getTime() - startsAt.getTime()) / 60_000,
      ),
      patientId: row.patient_id,
      patientName: patient?.name ?? "Patient record unavailable",
      patientDateOfBirth: patient?.dateOfBirth ?? null,
      appointmentTypeId: row.appointment_type_id,
      typeName: typeNames.get(row.appointment_type_id) ?? "Consultation",
      patientNote: row.patient_note,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
      createdAt: new Date(row.created_at),
    };
  });
}

function toSearchResult(row: {
  id: string;
  full_name: string;
  preferred_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  last_appointment_at: string | null;
}): CarePatientSearchResult {
  return {
    id: row.id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    lastAppointmentAt: row.last_appointment_at
      ? new Date(row.last_appointment_at)
      : null,
  };
}

function toCarePatient(row: CarePatientRow): CarePatient {
  return {
    id: row.id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    city: row.city,
    state: row.state,
    preferredLanguage: row.preferred_language,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactRelationship: row.emergency_contact_relationship,
    emergencyContactPhone: row.emergency_contact_phone,
    createdAt: row.created_at,
  };
}

function emptySummary(): DoctorDaySummary {
  return { total: 0, awaitingConfirmation: 0, remaining: 0, completed: 0 };
}

/**
 * The day's counts.
 *
 * Pure, and exported so it can be tested without a database. Derived from the
 * rows the day's own query returned, so every number on the page is a count
 * of something visible on it (`phase_11.md` section 7: only display values
 * derived from actual data).
 *
 * "Still to see" is everything not finished, not missed and not cancelled —
 * which is what a practitioner means by it, and which deliberately includes
 * the patient currently in the room.
 */
export function summariseDay(
  appointments: readonly DoctorAppointment[],
): DoctorDaySummary {
  let awaitingConfirmation = 0;
  let remaining = 0;
  let completed = 0;

  for (const appointment of appointments) {
    if (appointment.status === "requested") awaitingConfirmation += 1;
    if (appointment.status === "completed") completed += 1;
    if (
      appointment.status !== "completed" &&
      appointment.status !== "cancelled" &&
      appointment.status !== "no_show"
    ) {
      remaining += 1;
    }
  }

  return {
    total: appointments.length,
    awaitingConfirmation,
    remaining,
    completed,
  };
}
