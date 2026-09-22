/**
 * Appointment data access.
 *
 * ## Every query is scoped to the authenticated session
 *
 * None of these functions takes a user id or a patient id, and none has an
 * overload that does — the same shape Phase 07 established and for the same
 * reason: an identifier that cannot be passed cannot be substituted, so the
 * class of bug where a caller forwards `searchParams.patientId` into a query
 * does not exist here (`phase_09.md` sections 23 and 35).
 *
 * `getAppointment` does take an appointment id, because a detail page is
 * addressed by one. That is exactly the case `lib/authorization/ownership.ts`
 * warns about, and it is handled the way that module prescribes: the id is a
 * *filter*, never an authorization input. Row-level security restricts the
 * table to the caller's own appointments, so a well-formed id belonging to
 * somebody else returns no row and is indistinguishable from one that does not
 * exist.
 *
 * ## Why the reads are separate queries rather than embedded joins
 *
 * An appointment's practitioner name and type name come from two small lookup
 * tables, fetched by id after the appointments are read. PostgREST could embed
 * them in one round trip; it is done this way because the result is
 * predictably typed against the hand-maintained database types, and because
 * three bounded queries on a patient's own appointment list is not a
 * performance problem worth trading clarity for. If a staff screen ever reads
 * hundreds of rows at once, that is the point to revisit it — with a
 * measurement.
 *
 * ## What is never read
 *
 * `internal_note`. Not because it is filtered here, but because
 * `authenticated` holds no column grant on it, so it is absent from the
 * generated row type and a query naming it fails. `phase_09.md` section 24
 * asks that a patient not be able to read it through a generic appointment
 * query; this is that, enforced one layer below the query.
 */

import "server-only";

import {
  BOOKING_RULES,
  MAX_AVAILABILITY_WINDOW_DAYS,
} from "@/config/appointments";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { generateSlots } from "./availability";
import {
  addDaysToIsoDate,
  clinicWallClockToInstant,
  sqlTimeToMinutes,
} from "./time";
import type {
  AppointmentEvent,
  AppointmentResult,
  AppointmentType,
  AppointmentsResult,
  AvailabilityResult,
  BusyInterval,
  GroupedAppointments,
  PatientAppointment,
  SchedulingPractitioner,
  WorkingInterval,
} from "./types";

/**
 * The columns an appointment screen needs.
 *
 * Listed rather than `select("*")`, so a column added to the table later does
 * not silently start reaching a page — which matters here because the columns
 * a later phase adds to an appointment are the operational and clinical ones
 * (`docs/ARCHITECTURE.md` section 36).
 */
const APPOINTMENT_COLUMNS = [
  "id",
  "starts_at",
  "ends_at",
  "status",
  "patient_note",
  "cancelled_at",
  "cancellation_reason",
  "created_at",
  "practitioner_id",
  "appointment_type_id",
].join(", ");

/** What the booking flow needs before a patient can choose anything. */
export interface BookingOptions {
  readonly appointmentTypes: readonly AppointmentType[];
  readonly practitioners: readonly SchedulingPractitioner[];
}

/**
 * The consultation types the clinic currently offers.
 *
 * Exported because the receptionist workspace needs the same list, and a
 * second copy of this query in another feature is the duplication
 * `phase_10.md` section 60 forbids. The list is identical for both: an
 * appointment type is a length of time in the diary, and there is no
 * staff-only one.
 */
export async function getActiveAppointmentTypes(): Promise<
  readonly AppointmentType[]
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointment_types")
      .select("id, slug, name, description, duration_minutes, buffer_minutes")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      logger.error("appointment.types_read_failed", error);
      return [];
    }

    return (data ?? []).map(toAppointmentType);
  } catch (error) {
    logger.error("appointment.types_read_error", error);
    return [];
  }
}

/**
 * Practitioners who can be scheduled.
 *
 * `onlineBookableOnly` is the difference between the two callers and is
 * decided by the *server*, never by a request:
 *
 *   * a patient booking themselves sees only practitioners who accept online
 *     booking, because that flag means "a patient may book me directly";
 *   * the front desk sees everyone currently working, because booking somebody
 *     in with a practitioner who does not take online bookings is exactly what
 *     the front desk is for.
 *
 * Neither list authorizes anything. `assert_bookable_slot` re-checks the
 * practitioner in the database on every write, with the same distinction.
 */
export async function listSchedulablePractitioners(options: {
  readonly onlineBookableOnly: boolean;
}): Promise<
  readonly (SchedulingPractitioner & {
    readonly acceptsOnlineBooking: boolean;
  })[]
> {
  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("practitioners")
      .select("id, display_name, accepts_online_booking")
      .eq("is_active", true);

    if (options.onlineBookableOnly) {
      query = query.eq("accepts_online_booking", true);
    }

    const { data, error } = await query.order("display_name", {
      ascending: true,
    });

    if (error) {
      logger.error("appointment.practitioners_read_failed", error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      acceptsOnlineBooking: row.accepts_online_booking,
    }));
  } catch (error) {
    logger.error("appointment.practitioners_read_error", error);
    return [];
  }
}

/**
 * The consultation types and practitioners a patient may book.
 *
 * Filtered to what is bookable *in the query* as well as by
 * `assert_bookable_slot` in the database, so a practitioner who does not
 * accept online booking is never offered and could not be booked if they were.
 *
 * An empty practitioner list is a real, expected state — no practitioner has
 * been set up for online booking, and the booking page says so plainly rather
 * than rendering an empty select (`BOOKING_COPY.noPractitionersTitle`).
 */
export async function getBookingOptions(): Promise<BookingOptions> {
  const [appointmentTypes, practitioners] = await Promise.all([
    getActiveAppointmentTypes(),
    listSchedulablePractitioners({ onlineBookableOnly: true }),
  ]);

  return {
    appointmentTypes,
    practitioners: practitioners.map((practitioner) => ({
      id: practitioner.id,
      displayName: practitioner.displayName,
    })),
  };
}

/** One appointment type by id, or `null`. The trusted source of duration. */
export async function getAppointmentType(
  appointmentTypeId: string,
): Promise<AppointmentType | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointment_types")
      .select("id, slug, name, description, duration_minutes, buffer_minutes")
      .eq("id", appointmentTypeId)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) return null;
    return toAppointmentType(data);
  } catch (error) {
    logger.error("appointment.type_lookup_error", error);
    return null;
  }
}

/** A practitioner's recurring working intervals, in clinic wall-clock minutes. */
export async function getWorkingIntervals(
  practitionerId: string,
): Promise<readonly WorkingInterval[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("practitioner_availability")
      .select("weekday, starts_at, ends_at")
      .eq("practitioner_id", practitionerId)
      .eq("is_active", true);

    if (error || !data) {
      if (error) {
        logger.error("appointment.working_intervals_failed", error);
      }
      return [];
    }

    return data.flatMap((row) => {
      const startMinute = sqlTimeToMinutes(row.starts_at);
      const endMinute = sqlTimeToMinutes(row.ends_at);

      // A row the database's own check constraint should have prevented.
      // Dropping it beats generating slots from a nonsensical interval.
      if (startMinute === null || endMinute === null) return [];
      if (endMinute <= startMinute) return [];

      return [{ weekday: row.weekday, startMinute, endMinute }];
    });
  } catch (error) {
    logger.error("appointment.working_intervals_error", error);
    return [];
  }
}

export interface AvailabilityRequest {
  readonly practitionerId: string;
  readonly appointmentTypeId: string;
  /** Clinic calendar date, `YYYY-MM-DD`. */
  readonly date: string;
  /** How many days from `date` to include. Bounded. */
  readonly days?: number;
}

/**
 * Bookable times for a practitioner, on one or more clinic days.
 *
 * **This result is a snapshot and authorizes nothing.** `phase_09.md` section
 * 42 and `docs/DATABASE.md` section 11 both say so: by the time the patient
 * clicks, another patient may have taken the slot. The booking path re-derives
 * every rule in the database, and the exclusion constraint decides the race.
 *
 * Returns `unavailable` rather than an empty list when the read fails, so the
 * UI can distinguish "no times on this day" from "we could not look" — the
 * first invites choosing another date, the second invites retrying.
 */
export interface AvailabilityOptions {
  /**
   * How far ahead of a slot it may still be offered.
   *
   * Defaults to the clinic's self-service rule. The receptionist path passes
   * zero, because the front desk books people in for today — the same
   * distinction `assert_bookable_slot` takes as a parameter in the database.
   *
   * **Decided by the server from the caller's resolved role, never from a
   * request.** The availability endpoint reads it from the permission it just
   * checked; there is no query parameter for it, so a patient cannot ask to
   * see times they may not book.
   */
  readonly minNoticeMinutes?: number;
}

export async function getAvailability(
  request: AvailabilityRequest,
  options: AvailabilityOptions = {},
): Promise<AvailabilityResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "unavailable" };

  const minNoticeMinutes = Math.max(
    options.minNoticeMinutes ?? BOOKING_RULES.minNoticeMinutes,
    0,
  );

  const days = Math.min(
    Math.max(request.days ?? 1, 1),
    MAX_AVAILABILITY_WINDOW_DAYS,
  );

  const appointmentType = await getAppointmentType(request.appointmentTypeId);
  if (!appointmentType) return { status: "found", slots: [] };

  const windowStart = clinicWallClockToInstant(request.date, 0);
  const windowEnd = clinicWallClockToInstant(
    addDaysToIsoDate(request.date, days),
    0,
  );
  if (!windowStart || !windowEnd) return { status: "found", slots: [] };

  const [workingIntervals, busy] = await Promise.all([
    getWorkingIntervals(request.practitionerId),
    getBusyIntervals(request.practitionerId, windowStart, windowEnd),
  ]);

  if (busy === null) return { status: "unavailable" };

  const now = new Date();
  const slots = [];

  for (let offset = 0; offset < days; offset += 1) {
    slots.push(
      ...generateSlots({
        date: addDaysToIsoDate(request.date, offset),
        workingIntervals,
        busy,
        durationMinutes: appointmentType.durationMinutes,
        bufferMinutes: appointmentType.bufferMinutes,
        slotIntervalMinutes: BOOKING_RULES.slotIntervalMinutes,
        minNoticeMinutes,
        maxHorizonDays: BOOKING_RULES.maxHorizonDays,
        now,
      }),
    );
  }

  return { status: "found", slots };
}

/**
 * When the practitioner is unavailable, as bare interval boundaries.
 *
 * Goes through the `security definer` function rather than reading the tables,
 * because a patient holds no policy on either: they may not read another
 * patient's appointment, and `schedule_exceptions` has no select policy at all
 * because a blocked period's reason may be personal.
 *
 * `null` distinguishes a failed read from a free diary.
 */
async function getBusyIntervals(
  practitionerId: string,
  from: Date,
  to: Date,
): Promise<readonly BusyInterval[] | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "get_practitioner_busy_intervals",
      {
        p_practitioner_id: practitionerId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      },
    );

    if (error) {
      logger.error("appointment.busy_intervals_failed", error);
      return null;
    }

    return (data ?? []).map((row) => ({
      startsAt: new Date(row.busy_start),
      endsAt: new Date(row.busy_end),
    }));
  } catch (error) {
    logger.error("appointment.busy_intervals_error", error);
    return null;
  }
}

/**
 * How many of a patient's appointments the list page reads.
 *
 * **Phase 20.** This query had no bound at all, so it read a patient's entire
 * appointment history to render one page - the unbounded read
 * `phase_20.md` sections 50 and 51 forbid, and the same shape Phase 18 removed
 * from the dashboard when it replaced `getMyAppointments().upcoming[0]` with
 * `getNextAppointment`. The cost grows with every visit, so it degrades
 * fastest for exactly the long-standing patients the portal most needs to
 * serve well, and it is invisible in development where the seeded patient has
 * a handful of rows.
 *
 * 100 rather than a page size, because this list is **grouped**, not paged:
 * the page splits the result into upcoming, past and cancelled, and a
 * page-two control would have to page three groups at once. Ordering is
 * `starts_at` descending, so the bound falls on the oldest history and every
 * upcoming appointment is always present - which is the half a patient acts
 * on. When it bites, the page says so rather than silently showing less.
 *
 * This follows the pattern Phases 11 and 12 established for the practitioner's
 * patient search and clinical history: bounded in the query, with a visible
 * notice, rather than a pagination control on a list nobody reads to the end.
 */
export const MY_APPOINTMENTS_LIMIT = 100;

/**
 * The signed-in patient's own appointments, newest first.
 *
 * Takes no identifier. Row-level security restricts the table to the caller's
 * own patient record, so this returns their appointments or none — never
 * somebody else's, whatever the application does.
 */
export async function getMyAppointments(): Promise<AppointmentsResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "unavailable" };

  try {
    const supabase = await createSupabaseServerClient();
    // One row over the bound, so "is there more?" is answered by the query
    // rather than guessed from a full page.
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .order("starts_at", { ascending: false })
      .limit(MY_APPOINTMENTS_LIMIT + 1)
      .returns<AppointmentRow[]>();

    if (error) {
      // The user id is opaque and is what makes this diagnosable. No
      // appointment time, practitioner or note is logged.
      logger.error("appointment.list_read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    const rows = data ?? [];
    const truncated = rows.length > MY_APPOINTMENTS_LIMIT;

    return {
      status: "found",
      appointments: await resolveAppointments(
        truncated ? rows.slice(0, MY_APPOINTMENTS_LIMIT) : rows,
      ),
      truncated,
    };
  } catch (error) {
    logger.error("appointment.list_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * The signed-in patient's **next** appointment, or none.
 *
 * ## Why this exists rather than `getMyAppointments().upcoming[0]`
 *
 * Phase 18's dashboard shows one appointment. Reading the whole history to
 * display the soonest of it is exactly what `phase_18.md` sections 81, 94 and
 * 128 forbid — the cost grows with every visit a patient ever makes, and it
 * grows fastest for the long-standing patients the clinic most wants the
 * portal to serve well. This asks the database the question the page is
 * actually asking: one row, decided by an index.
 *
 * `getMyAppointments` is unchanged and still serves the appointments list,
 * which genuinely does need the whole set to group it.
 *
 * ## The filter
 *
 * `ends_at >= now` rather than `starts_at >= now`, matching `groupAppointments`
 * exactly: a consultation already under way is still the patient's next
 * appointment, and dropping it from the dashboard while they are sitting in
 * the room would be a strange thing for it to do.
 *
 * `status <> 'cancelled'` for the same reason the exclusion constraint uses
 * that predicate rather than a list of live statuses — a status added later
 * cannot accidentally start counting as cancelled.
 *
 * Takes no identifier, like everything else here. Row-level security restricts
 * the table to the caller's own patient record.
 */
export async function getNextAppointment(
  now: Date = new Date(),
): Promise<AppointmentResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "unavailable" };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .neq("status", "cancelled")
      .gte("ends_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .returns<AppointmentRow[]>();

    if (error) {
      logger.error("appointment.next_read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    const row = (data ?? [])[0];
    if (!row) return { status: "not_found" };

    const [appointment] = await resolveAppointments([row]);
    return appointment
      ? { status: "found", appointment }
      : { status: "not_found" };
  } catch (error) {
    logger.error("appointment.next_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * One of the signed-in patient's appointments.
 *
 * The id filters; it does not authorize. An id belonging to another patient
 * returns `not_found`, which is the same answer as an id that never existed —
 * an appointment id must not reveal whether somebody else's appointment exists
 * (`phase_09.md` section 35).
 */
export async function getAppointment(
  appointmentId: string,
): Promise<AppointmentResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "unavailable" };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_COLUMNS)
      .eq("id", appointmentId)
      .maybeSingle<AppointmentRow>();

    if (error) {
      logger.error("appointment.read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    if (!data) return { status: "not_found" };

    const [appointment] = await resolveAppointments([data]);
    return appointment
      ? { status: "found", appointment }
      : { status: "not_found" };
  } catch (error) {
    logger.error("appointment.read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * An appointment's own history.
 *
 * Read through the same RLS boundary as the appointment itself, so it is
 * reachable only for the patient's own appointments. It carries no clinical
 * content and no free text — only which values changed and when
 * (`phase_09.md` section 31).
 */
export async function getAppointmentHistory(
  appointmentId: string,
): Promise<readonly AppointmentEvent[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("appointment_events")
      .select(
        "id, event_type, previous_status, new_status, previous_starts_at, new_starts_at, created_at",
      )
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      previousStartsAt: row.previous_starts_at
        ? new Date(row.previous_starts_at)
        : null,
      newStartsAt: row.new_starts_at ? new Date(row.new_starts_at) : null,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    logger.error("appointment.history_read_error", error);
    return [];
  }
}

/**
 * Splits a patient's appointments into the three groups the list screen shows.
 *
 * Pure, and exported so it can be tested without a database. "Past" is decided
 * by the appointment's *end*, so a consultation that is under way still reads
 * as upcoming rather than dropping out of view while the patient is in the
 * room.
 */
export function groupAppointments(
  appointments: readonly PatientAppointment[],
  now: Date = new Date(),
): GroupedAppointments {
  const upcoming: PatientAppointment[] = [];
  const past: PatientAppointment[] = [];
  const cancelled: PatientAppointment[] = [];

  for (const appointment of appointments) {
    if (appointment.status === "cancelled") {
      cancelled.push(appointment);
    } else if (appointment.endsAt.getTime() > now.getTime()) {
      upcoming.push(appointment);
    } else {
      past.push(appointment);
    }
  }

  // Soonest first for what is still to come; most recent first for what is
  // over. Both are the order somebody scans them in.
  upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  past.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  cancelled.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  return { upcoming, past, cancelled };
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: PatientAppointment["status"];
  patient_note: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  practitioner_id: string;
  appointment_type_id: string;
}

/**
 * Attaches the practitioner and type names an appointment row references.
 *
 * Two bounded lookups, keyed by the ids actually present. A name that cannot
 * be resolved falls back to a neutral label rather than rendering an id or a
 * blank — the second looks like a rendering failure, and the first shows a
 * patient a UUID.
 */
async function resolveAppointments(
  rows: readonly AppointmentRow[],
): Promise<readonly PatientAppointment[]> {
  if (rows.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const practitionerIds = [...new Set(rows.map((row) => row.practitioner_id))];
  const typeIds = [...new Set(rows.map((row) => row.appointment_type_id))];

  const [practitioners, types] = await Promise.all([
    supabase
      .from("practitioners")
      .select("id, display_name")
      .in("id", practitionerIds),
    supabase
      .from("appointment_types")
      .select("id, name, duration_minutes")
      .in("id", typeIds),
  ]);

  const practitionerNames = new Map(
    (practitioners.data ?? []).map((row) => [row.id, row.display_name]),
  );
  const typeRows = new Map(
    (types.data ?? []).map((row) => [
      row.id,
      { name: row.name, durationMinutes: row.duration_minutes },
    ]),
  );

  return rows.map((row) => {
    const startsAt = new Date(row.starts_at);
    const endsAt = new Date(row.ends_at);
    const type = typeRows.get(row.appointment_type_id);

    return {
      id: row.id,
      startsAt,
      endsAt,
      status: row.status,
      practitionerId: row.practitioner_id,
      practitionerName:
        practitionerNames.get(row.practitioner_id) ?? "Punarvasu practitioner",
      appointmentTypeId: row.appointment_type_id,
      typeName: type?.name ?? "Consultation",
      // Derived from the stored instants rather than from the type, so it
      // stays true for an appointment booked before a duration was changed.
      durationMinutes: Math.round(
        (endsAt.getTime() - startsAt.getTime()) / 60_000,
      ),
      patientNote: row.patient_note,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
      cancellationReason: row.cancellation_reason,
      createdAt: new Date(row.created_at),
    };
  });
}

function toAppointmentType(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
}): AppointmentType {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
  };
}
