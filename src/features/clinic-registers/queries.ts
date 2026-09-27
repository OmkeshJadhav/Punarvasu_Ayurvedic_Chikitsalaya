/**
 * Clinic register data access.
 *
 * ## Authorized three times, audited once — in the database
 *
 * The page checks `analytics.read.clinic`; each function here asserts
 * `registers.read.patients`; and each RPC starts with
 * `assert_patient_register_reader()` in its body. The audit entry — one per
 * patient returned — is written *inside* the RPC, so this module cannot
 * forget it and a caller that bypassed this module still leaves it
 * (`supabase/migrations/20261001120000_clinic_registers.sql`).
 *
 * ## Same failure model as analytics
 *
 * A failed read becomes `unavailable` for its panel and the rest of the
 * dashboard renders. Until the migration above is applied, that is what all
 * three panels show — the RPCs do not exist yet — which is the correct
 * behaviour rather than a broken page.
 *
 * ## What is logged
 *
 * An operation name, an opaque user id and the failure category. Never a
 * name, a patient id or a page's contents.
 */

import "server-only";

import { describeAnalyticsFailure } from "@/features/analytics/errors";
import type { AnalyticsRange } from "@/features/analytics/types";
import type { AppointmentStatus } from "@/features/appointments/types";
import { assertPermission } from "@/lib/authorization/guards";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  ACTIVITY_KINDS,
  type ActivityEntry,
  type ActivityKind,
  type AppointmentRegisterRow,
  type ClinicRegisters,
  type PatientRegisterRow,
  type RegisterPage,
  type RegisterResult,
} from "./types";

/**
 * Rows per page. **Mirrors** the constants in the migration's function
 * bodies, which are the authority: the database decides how many rows a page
 * holds, and this is only used to number the pages.
 */
export const REGISTER_PAGE_SIZE = {
  appointments: 8,
  patients: 6,
} as const;

const UNAVAILABLE = { status: "unavailable" } as const;

const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "requested",
  "confirmed",
  "checked_in",
  "in_consultation",
  "completed",
  "cancelled",
  "no_show",
];

function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function toStatus(value: unknown): AppointmentStatus | null {
  return APPOINTMENT_STATUSES.find((status) => status === value) ?? null;
}

function toKind(value: unknown): ActivityKind | null {
  return ACTIVITY_KINDS.find((kind) => kind === value) ?? null;
}

async function read<T>(
  operation: string,
  userId: string,
  run: () => PromiseLike<{ data: unknown; error: unknown }>,
  map: (data: readonly Record<string, unknown>[]) => T,
): Promise<RegisterResult<T>> {
  try {
    const { data, error } = await run();

    if (error) {
      const failure = describeAnalyticsFailure(error);
      logger.warn(failure.logEvent, { userId, operation });
      return failure.forbidden ? { status: "forbidden" } : UNAVAILABLE;
    }

    const rows = Array.isArray(data)
      ? data.filter(
          (row): row is Record<string, unknown> =>
            typeof row === "object" && row !== null,
        )
      : [];

    return { status: "ready", data: map(rows) };
  } catch (cause) {
    logger.error("registers.read_failed", cause, { userId, operation });
    return UNAVAILABLE;
  }
}

function toPage<Row>(
  rows: readonly Record<string, unknown>[],
  mapped: readonly Row[],
  page: number,
  pageSize: number,
): RegisterPage<Row> {
  return {
    rows: mapped,
    // Every row carries the window total; an empty page carries none, and a
    // page past the end is reported as such by the renderer.
    total: toNumber(rows[0]?.["total_count"]),
    page,
    pageSize,
  };
}

function mapAppointments(
  rows: readonly Record<string, unknown>[],
): readonly AppointmentRegisterRow[] {
  return rows.flatMap((row) => {
    const status = toStatus(row["status"]);
    if (!status) return [];
    return [
      {
        appointmentId: String(row["appointment_id"] ?? ""),
        startsAt: String(row["starts_at"] ?? ""),
        status,
        patientId: String(row["patient_id"] ?? ""),
        patientName: String(row["patient_name"] ?? ""),
        practitionerName: String(row["practitioner_name"] ?? ""),
        appointmentTypeName: String(row["appointment_type_name"] ?? ""),
      },
    ];
  });
}

function mapPatients(
  rows: readonly Record<string, unknown>[],
): readonly PatientRegisterRow[] {
  return rows.map((row) => ({
    patientId: String(row["patient_id"] ?? ""),
    patientName: String(row["patient_name"] ?? ""),
    registeredAt: String(row["registered_at"] ?? ""),
    isNew: row["is_new"] === true,
    appointmentsInPeriod: toNumber(row["appointments_in_period"]),
    completedInPeriod: toNumber(row["completed_in_period"]),
    lastVisitAt:
      typeof row["last_visit_at"] === "string" ? row["last_visit_at"] : null,
  }));
}

function mapActivity(
  rows: readonly Record<string, unknown>[],
): readonly ActivityEntry[] {
  return rows.flatMap((row) => {
    const kind = toKind(row["activity"]);
    // An activity kind a later migration adds is dropped rather than shown
    // under the wrong words.
    if (!kind) return [];
    return [
      {
        occurredAt: String(row["occurred_at"] ?? ""),
        kind,
        status: toStatus(row["status"]),
        patientId: String(row["patient_id"] ?? ""),
        patientName: String(row["patient_name"] ?? ""),
        practitionerName:
          typeof row["practitioner_name"] === "string"
            ? row["practitioner_name"]
            : null,
      },
    ];
  });
}

/**
 * The three registers for the dashboard, read in parallel.
 *
 * One permission check, three gated and audited RPCs.
 */
export async function getClinicRegisters(
  range: AnalyticsRange,
  {
    practitionerId,
    appointmentsPage,
    patientsPage,
  }: {
    readonly practitionerId?: string | undefined;
    readonly appointmentsPage: number;
    readonly patientsPage: number;
  },
): Promise<ClinicRegisters> {
  const user = await assertPermission("registers.read.patients");
  const supabase = await createSupabaseServerClient();
  const filter = practitionerId ?? null;

  const [appointments, patients, activity] = await Promise.all([
    read(
      "registers.appointments",
      user.id,
      () =>
        supabase.rpc("clinic_appointment_register", {
          p_from: range.from,
          p_to: range.to,
          p_practitioner_id: filter,
          p_page: appointmentsPage,
        }),
      (rows) =>
        toPage(
          rows,
          mapAppointments(rows),
          appointmentsPage,
          REGISTER_PAGE_SIZE.appointments,
        ),
    ),
    read(
      "registers.patients",
      user.id,
      () =>
        supabase.rpc("clinic_patient_register", {
          p_from: range.from,
          p_to: range.to,
          p_page: patientsPage,
        }),
      (rows) =>
        toPage(
          rows,
          mapPatients(rows),
          patientsPage,
          REGISTER_PAGE_SIZE.patients,
        ),
    ),
    read(
      "registers.activity",
      user.id,
      () =>
        supabase.rpc("clinic_recent_activity", {
          p_from: range.from,
          p_to: range.to,
          p_practitioner_id: filter,
        }),
      mapActivity,
    ),
  ]);

  return { appointments, patients, activity };
}
