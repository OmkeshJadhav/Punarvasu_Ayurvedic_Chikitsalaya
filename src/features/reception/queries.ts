/**
 * Receptionist workspace data access.
 *
 * ## Why this feature depends on `features/appointments`
 *
 * `docs/ARCHITECTURE.md` section 4 says a feature must not import another
 * feature's internals. `docs/PRODUCT_SPEC.md` section 5A says something more
 * specific about this pair: *"Appointments sit beneath both staff workspaces.
 * Appointment logic belongs in one shared domain layer, not duplicated per
 * workspace."*
 *
 * So `features/appointments` is the domain layer this workspace is built on,
 * and the timezone conversions, the availability engine, the status matrix,
 * the validation primitives and the error mapper are **imported, not copied**.
 * `phase_10.md` sections 16-17 and 60 make that mandatory. The prohibition the
 * architecture document is making is against coupling between peer features;
 * it is not an instruction to reimplement scheduling for the front desk, which
 * is the one thing this phase must not do.
 *
 * ## Every read is authorized before it is made
 *
 * Each exported function starts with `assertPermission(...)`, and the database
 * refuses independently: the receptionist policies added in Phase 10 require
 * `public.has_app_role('receptionist')`, and the two functions that read
 * across patients are `security definer` with their own role check. Delete the
 * checks here and an unauthorized caller still gets nothing
 * (`phase_10.md` section 38).
 *
 * ## Why an appointment id is safe to accept
 *
 * It is a *filter*, never an authorization input — the same argument Phase 09
 * made. A receptionist is authorized for the whole clinic diary, so unlike the
 * patient case there is no row the id could reach that the policy would not
 * have allowed anyway.
 *
 * ## Columns, not `select *`
 *
 * `phase_10.md` section 37. Every query below names its columns, so a column
 * added to a table later does not silently start reaching a screen — which
 * matters most for `patients`, where the columns a later phase might add are
 * the sensitive ones.
 */

import "server-only";

import {
  formatAddressLines,
  formatDateOfBirth,
  formatPhone,
} from "@/features/patients/format";
import { logger } from "@/lib/logging/logger";
import { recordSecurityAuditEvent } from "@/lib/security/audit";
import { allowOperation } from "@/lib/security/rate-limit";
import { assertPermission } from "@/lib/authorization/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  currentAndNext,
  partitionByTime,
} from "@/features/appointments/schedule";
import {
  addDaysToIsoDate,
  clinicWallClockToInstant,
} from "@/features/appointments/time";
import type { AppointmentStatus } from "@/features/appointments/types";

import type {
  DayOverview,
  DuplicateCandidate,
  OperationalPatient,
  OperationalPatientResult,
  PatientSearchOutcome,
  PatientSearchResult,
  ScheduleResult,
  ScheduledAppointment,
  ScheduledAppointmentResult,
} from "./types";
import { PATIENT_SEARCH_LIMIT, PATIENT_SEARCH_MIN_LENGTH } from "./validation";

/**
 * The appointment columns the front desk needs.
 *
 * `internal_note` is not here, and could not be: no client role holds a column
 * grant on it, so naming it would make the query fail. `blocked_until`,
 * `created_by` and `cancelled_by` are likewise ungranted internal metadata.
 */
const APPOINTMENT_COLUMNS = [
  "id",
  "patient_id",
  "practitioner_id",
  "appointment_type_id",
  "starts_at",
  "ends_at",
  "status",
  "patient_note",
  "cancelled_at",
  "cancellation_reason",
  "created_at",
].join(", ");

/**
 * The patient columns an operational screen needs.
 *
 * Every one is demographic or administrative. There is no clinical column in
 * this table to leave out — Phase 07's migration has none and says none may be
 * added — so this list is data minimisation rather than a filter standing
 * between the front desk and a medical record.
 */
const PATIENT_COLUMNS = [
  "id",
  "full_name",
  "preferred_name",
  "phone",
  "date_of_birth",
  "gender",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "postal_code",
  "emergency_contact_name",
  "emergency_contact_relationship",
  "emergency_contact_phone",
  "preferred_language",
  "profile_id",
  "created_at",
].join(", ");

export interface ScheduleFilters {
  /** A clinic calendar date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly practitionerId?: string | undefined;
  readonly status?: AppointmentStatus | undefined;
}

export interface DaySchedule {
  readonly result: ScheduleResult;
  /**
   * Counts for the whole day, **before** the practitioner and status filters.
   *
   * Deliberately: "three waiting to be confirmed" must not become "none"
   * because somebody filtered the list to one practitioner. The counts answer
   * "what does today hold", the list answers "what am I looking at".
   */
  readonly overview: DayOverview;
}

/**
 * The clinic's diary for one day.
 *
 * One query for the day, then the filters applied in memory over what it
 * returned. That is not laziness: the day is bounded by definition — a clinic
 * day is tens of rows, not thousands — and reading it once means the counts
 * and the list can never disagree, which is the failure mode that actually
 * bites at a front desk. `phase_10.md` section 51's bound is the day itself.
 *
 * `null` for a failed read rather than an empty day: a front desk told the
 * diary is empty when the database was unreachable will turn people away.
 */
export async function getDaySchedule(
  filters: ScheduleFilters,
): Promise<DaySchedule> {
  const user = await assertPermission("appointments.manage.any");

  const from = clinicWallClockToInstant(filters.date, 0);
  const to = clinicWallClockToInstant(addDaysToIsoDate(filters.date, 1), 0);

  if (!from || !to) {
    return { result: { status: "unavailable" }, overview: emptyOverview() };
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
      // The acting receptionist's id is opaque and is what makes this
      // diagnosable. No patient name, phone number or appointment time is
      // logged.
      logger.error("reception.schedule_read_failed", error, {
        userId: user.id,
      });
      return { result: { status: "unavailable" }, overview: emptyOverview() };
    }

    const rows = data ?? [];
    const appointments = await resolveAppointments(rows);

    const filtered = appointments.filter((appointment) => {
      if (
        filters.practitionerId &&
        appointment.practitionerId !== filters.practitionerId
      ) {
        return false;
      }
      if (filters.status && appointment.status !== filters.status) return false;
      return true;
    });

    return {
      result: { status: "found", appointments: filtered },
      overview: summarise(appointments),
    };
  } catch (error) {
    logger.error("reception.schedule_read_error", error, { userId: user.id });
    return { result: { status: "unavailable" }, overview: emptyOverview() };
  }
}

/** One appointment, for the detail screen. */
export async function getScheduledAppointment(
  appointmentId: string,
): Promise<ScheduledAppointmentResult> {
  const user = await assertPermission("appointments.manage.any");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (error) {
      logger.error("reception.appointment_read_failed", error, {
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
    logger.error("reception.appointment_read_error", error, {
      userId: user.id,
    });
    return { status: "unavailable" };
  }
}

/**
 * One patient's appointments, newest first.
 *
 * Bounded, because a long-standing patient's history is not something a front
 * desk reads in one sitting — and an unbounded query on a screen that renders
 * every row is how a page becomes slow years after it was written.
 */
export async function getPatientAppointments(
  patientId: string,
  limit = 20,
): Promise<readonly ScheduledAppointment[]> {
  await assertPermission("appointments.manage.any");

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
      if (error) logger.error("reception.patient_appointments_failed", error);
      return [];
    }

    return resolveAppointments(data);
  } catch (error) {
    logger.error("reception.patient_appointments_error", error);
    return [];
  }
}

/**
 * Operational patient search.
 *
 * Goes through `public.search_patients`, which is `security definer` and does
 * four things this layer could not do as well on its own
 * (`phase_10.md` sections 12-13):
 *
 *   * checks the caller's role in the database;
 *   * refuses a query shorter than two characters, so an empty box is never a
 *     "list every patient" button;
 *   * clamps the result count itself, so the caller does not choose it;
 *   * treats the typed text as a parameter rather than as part of a filter
 *     expression, which is what a multi-column PostgREST `or=(...)` would have
 *     made it.
 *
 * A short query returns `tooShort` rather than an error, because somebody
 * halfway through typing a name has not made a mistake.
 */
export async function searchPatients(
  query: string,
): Promise<PatientSearchOutcome> {
  const user = await assertPermission("patients.read.operational");

  const term = query.trim();
  if (term.length === 0) {
    return { status: "idle", results: [], tooShort: false };
  }
  if (term.length < PATIENT_SEARCH_MIN_LENGTH) {
    return { status: "idle", results: [], tooShort: true };
  }

  // Phase 19. The search is already bounded in rows — a term under two
  // characters finds nothing and the database clamps the result count — but it
  // was unbounded in *rate*, and repeating a bounded search is the cheapest way
  // to walk a patient list. Checked after the length guard, so a receptionist
  // mid-word does not spend allowance on a query that runs nothing.
  if (!allowOperation("patient_search", user.id)) {
    logger.warn("reception.patient_search_rate_limited", { userId: user.id });
    return { status: "unavailable", results: [], tooShort: false };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_patients", {
      p_query: term,
      p_limit: PATIENT_SEARCH_LIMIT,
    });

    if (error) {
      // The search *term* is not logged. It is somebody's name.
      logger.error("reception.patient_search_failed", error, {
        userId: user.id,
      });
      return { status: "unavailable", results: [], tooShort: false };
    }

    return {
      status: "found",
      results: (data ?? []).map(toSearchResult),
      tooShort: false,
    };
  } catch (error) {
    logger.error("reception.patient_search_error", error, { userId: user.id });
    return { status: "unavailable", results: [], tooShort: false };
  }
}

/**
 * Existing records that might be the same person.
 *
 * Advisory. It merges nothing, blocks nothing and chooses nothing — the
 * receptionist decides (`phase_10.md` section 33). A failed check returns an
 * empty list rather than blocking registration: a duplicate is a nuisance,
 * whereas being unable to register somebody standing at the desk is not.
 */
export async function findPossibleDuplicates(input: {
  readonly fullName: string;
  readonly phone?: string | undefined;
  readonly dateOfBirth?: string | undefined;
}): Promise<readonly DuplicateCandidate[]> {
  await assertPermission("patients.write.operational");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "find_possible_duplicate_patients",
      {
        p_full_name: input.fullName,
        p_phone: input.phone ?? null,
        p_date_of_birth: input.dateOfBirth ?? null,
      },
    );

    if (error) {
      logger.error("reception.duplicate_check_failed", error);
      return [];
    }

    return (data ?? []).map((row) => ({
      ...toSearchResult(row),
      matchReason:
        row.match_reason === "phone" ? "phone" : "name_and_date_of_birth",
    }));
  } catch (error) {
    logger.error("reception.duplicate_check_error", error);
    return [];
  }
}

/** One patient's operational record. */
export async function getOperationalPatient(
  patientId: string,
): Promise<OperationalPatientResult> {
  const user = await assertPermission("patients.read.operational");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("patients")
      .select(PATIENT_COLUMNS)
      .eq("id", patientId)
      .maybeSingle<PatientRow>();

    if (error) {
      logger.error("reception.patient_read_failed", error, {
        userId: user.id,
      });
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

    return { status: "found", patient: toOperationalPatient(data) };
  } catch (error) {
    logger.error("reception.patient_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/** The address as the lines it would be written on. Re-exported for screens. */
export { formatAddressLines, formatDateOfBirth, formatPhone };

/*
 * ---------------------------------------------------------------------------
 * Mapping
 * ---------------------------------------------------------------------------
 */

interface AppointmentRow {
  id: string;
  patient_id: string;
  practitioner_id: string;
  appointment_type_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  patient_note: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

interface PatientRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  preferred_language: string | null;
  profile_id: string | null;
  created_at: string;
}

/**
 * Attaches the patient, practitioner and type each appointment references.
 *
 * Three bounded lookups keyed by the ids actually present, rather than N+1 or
 * an embedded join: the result is predictably typed against the hand-
 * maintained database types, and a clinic day is tens of rows. If a screen
 * ever reads hundreds at once, that is the point to revisit it — with a
 * measurement.
 *
 * A name that cannot be resolved falls back to a neutral label rather than
 * rendering an identifier or a blank. A blank looks like a rendering failure;
 * a UUID on a front-desk screen is noise somebody has to read past.
 */
async function resolveAppointments(
  rows: readonly AppointmentRow[],
): Promise<readonly ScheduledAppointment[]> {
  if (rows.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const patientIds = [...new Set(rows.map((row) => row.patient_id))];
  const practitionerIds = [...new Set(rows.map((row) => row.practitioner_id))];
  const typeIds = [...new Set(rows.map((row) => row.appointment_type_id))];

  const [patients, practitioners, types] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, preferred_name, phone")
      .in("id", patientIds),
    supabase
      .from("practitioners")
      .select("id, display_name")
      .in("id", practitionerIds),
    supabase.from("appointment_types").select("id, name").in("id", typeIds),
  ]);

  const patientRows = new Map(
    (patients.data ?? []).map((row) => [
      row.id,
      {
        // The preferred name is what the front desk says out loud, so it wins
        // where there is one. The legal name is still on the record.
        name: row.preferred_name?.trim() || row.full_name,
        phone: row.phone,
      },
    ]),
  );
  const practitionerNames = new Map(
    (practitioners.data ?? []).map((row) => [row.id, row.display_name]),
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
      patientPhone: patient?.phone ?? null,
      practitionerId: row.practitioner_id,
      practitionerName:
        practitionerNames.get(row.practitioner_id) ?? "Practitioner",
      appointmentTypeId: row.appointment_type_id,
      typeName: typeNames.get(row.appointment_type_id) ?? "Consultation",
      patientNote: row.patient_note,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
      cancellationReason: row.cancellation_reason,
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
  city: string | null;
  has_account: boolean;
}): PatientSearchResult {
  return {
    id: row.id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    city: row.city,
    hasAccount: row.has_account,
  };
}

function toOperationalPatient(row: PatientRow): OperationalPatient {
  return {
    id: row.id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactRelationship: row.emergency_contact_relationship,
    emergencyContactPhone: row.emergency_contact_phone,
    preferredLanguage: row.preferred_language,
    // Whether they can sign in — never *which* account. The front desk needs
    // the first to know whether to tell somebody to check their email; the
    // second is an identifier it has no use for.
    hasAccount: row.profile_id !== null,
    createdAt: row.created_at,
  };
}

function emptyOverview(): DayOverview {
  return {
    total: 0,
    awaitingConfirmation: 0,
    confirmed: 0,
    checkedIn: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };
}

/**
 * The day's counts.
 *
 * Derived from the rows the day's own query returned, so every number on the
 * page is a count of something visible on it. `phase_10.md` section 6: do not
 * invent numbers.
 */
export function summarise(
  appointments: readonly ScheduledAppointment[],
): DayOverview {
  const overview = {
    total: appointments.length,
    awaitingConfirmation: 0,
    confirmed: 0,
    checkedIn: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };

  for (const appointment of appointments) {
    switch (appointment.status) {
      case "requested":
        overview.awaitingConfirmation += 1;
        break;
      case "confirmed":
        overview.confirmed += 1;
        break;
      case "checked_in":
      case "in_consultation":
        overview.checkedIn += 1;
        break;
      case "completed":
        overview.completed += 1;
        break;
      case "cancelled":
        overview.cancelled += 1;
        break;
      case "no_show":
        overview.noShow += 1;
        break;
    }
  }

  return overview;
}

/**
 * A patient's appointments, split into what is still to come and what is not.
 *
 * Delegates to the shared helper in `features/appointments/schedule.ts`,
 * which two workspaces now use. It was written here in Phase 10 and moved
 * down in Phase 11 rather than copied, because a second implementation of
 * "which of these has not happened yet" is exactly the duplicated scheduling
 * logic `docs/PRODUCT_SPEC.md` section 5A forbids.
 */
export function splitPatientAppointments(
  appointments: readonly ScheduledAppointment[],
  now: Date = new Date(),
): {
  readonly upcoming: readonly ScheduledAppointment[];
  readonly past: readonly ScheduledAppointment[];
} {
  return partitionByTime(appointments, now);
}

/**
 * The appointment happening now, and the one after it.
 *
 * Re-exported from the shared schedule helpers for the same reason as above.
 * The workspace home page shows both (`phase_10.md` section 9).
 */
export { currentAndNext };
