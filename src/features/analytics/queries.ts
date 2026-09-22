/**
 * Analytics data access.
 *
 * ## Every read is a purpose-built aggregate
 *
 * `phase_16.md` sections 60 and 61. There is no generic query endpoint here
 * and there is no table read: every function below calls one RPC that answers
 * one question and returns counts. A caller cannot ask this module for rows,
 * because no function in it returns any.
 *
 * ## Aggregation happens in PostgreSQL, always
 *
 * Section 28 and example 1. Nothing here fetches appointments and counts
 * them; the largest payload any of these reads receives is one row per
 * practitioner or one row per trend bucket, both bounded by construction. The
 * one thing this module computes is a *rate over already-aggregated counts*,
 * and it does that through `metrics.ts` so the dashboard and the export
 * cannot disagree (section 94).
 *
 * ## Authorized twice, and the second time is the real one
 *
 * Each exported function starts with `assertPermission(...)`, and every RPC
 * it calls starts with its own role gate inside the database. Delete every
 * check in this file and an unauthorized caller still gets `42501`
 * (section 55). The application check exists so a page can render a refusal
 * instead of an error, and so the refusal is recorded against a permission
 * name rather than a function name.
 *
 * ## No shared cache
 *
 * Sections 33 and 34 permit short-lived caching and then spend two sections
 * on how to key it safely — scope, date range, filters — because the failure
 * mode is one user's figures reaching another's screen. This feature caches
 * **nothing** across requests: there is no `unstable_cache`, no `revalidate`
 * and no module-level memo anywhere in it.
 *
 * That is a deliberate choice rather than an omission, on three grounds.
 * Punarvasu is one clinic, so the aggregates below run against a bounded
 * range over an indexed column and are cheap. Freshness is then absolute —
 * section 77's "analytics should reflect authoritative data" costs nothing,
 * and section 76's freshness label can state a real query time rather than a
 * refresh schedule. And a cache that does not exist cannot leak a scope,
 * which under `AGENTS.md` section 38's ordering settles it.
 *
 * If a future Punarvasu measures one of these as slow, the place to cache is
 * behind these function signatures, keyed on the authorized scope plus the
 * range plus the practitioner filter — never on a constant.
 *
 * ## What is logged
 *
 * A failure logs the operation, an opaque user id and the failure category.
 * It does not log the figures, a practitioner id, a date range's contents or
 * the provider's message. A successful read logs nothing at all: analytics is
 * read constantly and a log line per panel would be noise that buries the
 * failures.
 */

import "server-only";

import { APPOINTMENT_REPORT } from "@/config/analytics";
import { assertPermission } from "@/lib/authorization/guards";
import { can } from "@/lib/authorization/policy";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/logging/logger";
import { allowOperation } from "@/lib/security/rate-limit";
import { recordSecurityAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { describeAnalyticsFailure } from "./errors";
import {
  acceptanceRate,
  appointmentRates,
  countsArePlausible,
  notificationReadRate,
  utilization,
} from "./metrics";
import type {
  AnalyticsRange,
  AnalyticsResult,
  AppointmentCounts,
  AppointmentReportRow,
  ClinicAnalytics,
  ClinicSystemAnalytics,
  ClinicalActivity,
  DocumentTypeVolume,
  NotificationDelivery,
  NotificationVolume,
  PatientGrowth,
  PatientGrowthPoint,
  PracticeAnalytics,
  PractitionerWorkload,
  TrendPoint,
  Utilization,
} from "./types";
import type { AppointmentStatus } from "@/features/appointments/types";

/** A PostgREST numeric arrives as a string; a bigint may too. */
function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

const UNAVAILABLE = { status: "unavailable" } as const;

/**
 * Runs one aggregate read and turns any failure into a state the page can
 * render.
 *
 * Nothing in this feature throws on a failed read. A dashboard is several
 * independent panels, and section 63 asks that one of them failing not block
 * the rest — so a failure becomes `unavailable` for that panel and the other
 * five still render.
 */
async function read<T>(
  operation: string,
  userId: string,
  run: () => PromiseLike<{ data: unknown; error: unknown }>,
  map: (data: unknown) => T,
): Promise<AnalyticsResult<T>> {
  try {
    const { data, error } = await run();

    if (error) {
      const failure = describeAnalyticsFailure(error);
      logger.warn(failure.logEvent, { userId, operation });
      return failure.forbidden ? { status: "forbidden" } : UNAVAILABLE;
    }

    return { status: "ready", data: map(data) };
  } catch (cause) {
    // A transport failure rather than a database one. Logged as the same
    // category so "how often does a report fail" is one query.
    logger.error("analytics.read_failed", cause, { userId, operation });
    return UNAVAILABLE;
  }
}

/** PostgREST returns a `returns table` function as an array of rows. */
function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const row = data[0];
    return typeof row === "object" && row !== null
      ? (row as Record<string, unknown>)
      : null;
  }
  return typeof data === "object" && data !== null
    ? (data as Record<string, unknown>)
    : null;
}

function rows(data: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(data)
    ? (data.filter((row) => typeof row === "object" && row !== null) as Record<
        string,
        unknown
      >[])
    : [];
}

function mapCounts(data: unknown): AppointmentCounts {
  const row = firstRow(data);

  return {
    total: toNumber(row?.["total"]),
    requested: toNumber(row?.["requested"]),
    confirmed: toNumber(row?.["confirmed"]),
    checkedIn: toNumber(row?.["checked_in"]),
    inConsultation: toNumber(row?.["in_consultation"]),
    completed: toNumber(row?.["completed"]),
    cancelled: toNumber(row?.["cancelled"]),
    noShow: toNumber(row?.["no_show"]),
    eligible: toNumber(row?.["eligible"]),
  };
}

function mapTrend(data: unknown): readonly TrendPoint[] {
  return rows(data).map((row) => ({
    bucketStart: String(row["bucket_start"] ?? ""),
    total: toNumber(row["total"]),
    completed: toNumber(row["completed"]),
    cancelled: toNumber(row["cancelled"]),
    noShow: toNumber(row["no_show"]),
  }));
}

/**
 * Counts that fail the consistency check become unavailable.
 *
 * Section 97. `completed > total` or an `eligible` that is not the sum of its
 * parts means the query or the data is wrong, and a dashboard that draws it
 * anyway teaches its reader to trust a wrong number. The gap is logged so
 * somebody can find out why.
 */
function guardCounts(
  result: AnalyticsResult<AppointmentCounts>,
  userId: string,
  operation: string,
): AnalyticsResult<AppointmentCounts> {
  if (result.status !== "ready") return result;
  if (countsArePlausible(result.data)) return result;

  logger.error(
    "analytics.data_quality",
    new Error("appointment counts are internally inconsistent"),
    { userId, operation },
  );
  return UNAVAILABLE;
}

/**
 * Everything the clinic dashboard shows, read in parallel.
 *
 * Five RPCs, not five-plus-one-per-practitioner. Section 81's N+1 is the
 * shape the practitioner table invites, and the workload RPC is written as a
 * single grouped scan precisely so this function never has to loop.
 */
export async function getClinicAnalytics(
  range: AnalyticsRange,
  practitionerId?: string,
): Promise<ClinicAnalytics> {
  const user = await assertPermission("analytics.read.operational");
  const supabase = await createSupabaseServerClient();
  const filter = practitionerId ?? null;

  const [appointments, trend, workload, patients, growth] = await Promise.all([
    read(
      "clinic.appointments",
      user.id,
      () =>
        supabase.rpc("analytics_clinic_appointment_summary", {
          p_from: range.from,
          p_to: range.to,
          p_practitioner_id: filter,
        }),
      mapCounts,
    ),
    read(
      "clinic.trend",
      user.id,
      () =>
        supabase.rpc("analytics_clinic_appointment_trend", {
          p_from: range.from,
          p_to: range.to,
          p_practitioner_id: filter,
        }),
      mapTrend,
    ),
    read(
      "clinic.workload",
      user.id,
      () =>
        supabase.rpc("analytics_clinic_practitioner_workload", {
          p_from: range.from,
          p_to: range.to,
        }),
      mapWorkload,
    ),
    read(
      "clinic.patients",
      user.id,
      () =>
        supabase.rpc("analytics_clinic_patient_summary", {
          p_from: range.from,
          p_to: range.to,
        }),
      mapPatientGrowth,
    ),
    read(
      "clinic.growth",
      user.id,
      () =>
        supabase.rpc("analytics_clinic_patient_growth", {
          p_from: range.from,
          p_to: range.to,
        }),
      mapGrowthPoints,
    ),
  ]);

  return {
    range,
    generatedAt: new Date().toISOString(),
    appointments: guardCounts(appointments, user.id, "clinic.appointments"),
    trend,
    workload,
    patients,
    growth,
  };
}

function mapWorkload(data: unknown): readonly PractitionerWorkload[] {
  return rows(data).map((row) => {
    const counts: AppointmentCounts = {
      total: toNumber(row["total"]),
      // The workload RPC reports the four figures a workload table shows. The
      // in-flight statuses are not broken out, so they are folded into the
      // difference rather than invented — `requested` here means "not yet
      // concluded", which the table's own column heading says.
      requested: toNumber(row["total"]) - toNumber(row["eligible"]),
      confirmed: 0,
      checkedIn: 0,
      inConsultation: 0,
      completed: toNumber(row["completed"]),
      cancelled: toNumber(row["cancelled"]),
      noShow: toNumber(row["no_show"]),
      eligible: toNumber(row["eligible"]),
    };

    const time = utilization(
      toNumber(row["booked_minutes"]),
      toNumber(row["available_minutes"]),
    );

    return {
      practitionerId: String(row["practitioner_id"] ?? ""),
      displayName: String(row["display_name"] ?? ""),
      isActive: row["is_active"] === true,
      ...counts,
      ...time,
      rates: appointmentRates(counts),
    };
  });
}

function mapPatientGrowth(data: unknown): PatientGrowth {
  const row = firstRow(data);
  return {
    newPatients: toNumber(row?.["new_patients"]),
    returningPatients: toNumber(row?.["returning_patients"]),
    activePatients: toNumber(row?.["active_patients"]),
    totalPatients: toNumber(row?.["total_patients"]),
  };
}

function mapGrowthPoints(data: unknown): readonly PatientGrowthPoint[] {
  return rows(data).map((row) => ({
    bucketStart: String(row["bucket_start"] ?? ""),
    newPatients: toNumber(row["new_patients"]),
  }));
}

/**
 * The administrator's additional panels.
 *
 * A separate function rather than more fields on `getClinicAnalytics`,
 * because it is a separate permission: a receptionist calling the first must
 * not be one flag away from the second.
 */
export async function getClinicSystemAnalytics(
  range: AnalyticsRange,
): Promise<ClinicSystemAnalytics> {
  const user = await assertPermission("analytics.read.clinic");
  const supabase = await createSupabaseServerClient();

  const [deliveries, notifications, clinicalActivity, documentTypes] =
    await Promise.all([
      read(
        "clinic.deliveries",
        user.id,
        () =>
          supabase.rpc("analytics_notification_delivery_summary", {
            p_from: range.from,
            p_to: range.to,
          }),
        mapDeliveries,
      ),
      read(
        "clinic.notifications",
        user.id,
        () =>
          supabase.rpc("analytics_notification_summary", {
            p_from: range.from,
            p_to: range.to,
          }),
        mapNotificationVolume,
      ),
      read(
        "clinic.clinical_activity",
        user.id,
        () =>
          supabase.rpc("analytics_clinical_activity_summary", {
            p_from: range.from,
            p_to: range.to,
          }),
        mapClinicalActivity,
      ),
      read(
        "clinic.document_types",
        user.id,
        () =>
          supabase.rpc("analytics_document_type_summary", {
            p_from: range.from,
            p_to: range.to,
          }),
        mapDocumentTypes,
      ),
    ]);

  return { deliveries, notifications, clinicalActivity, documentTypes };
}

function mapDeliveries(data: unknown): readonly NotificationDelivery[] {
  return rows(data).map((row) => {
    const counts = {
      sent: toNumber(row["sent"]),
      failed: toNumber(row["failed"]),
    };

    return {
      channel: String(row["channel"] ?? ""),
      provider: String(row["provider"] ?? ""),
      pending: toNumber(row["pending"]),
      sent: counts.sent,
      failed: counts.failed,
      skipped: toNumber(row["skipped"]),
      acceptanceRate: acceptanceRate(counts),
    };
  });
}

function mapNotificationVolume(data: unknown): readonly NotificationVolume[] {
  return rows(data).map((row) => {
    const volume = {
      active: toNumber(row["active"]),
      readCount: toNumber(row["read_count"]),
    };

    return {
      category: String(row["category"] ?? ""),
      scheduled: toNumber(row["scheduled"]),
      active: volume.active,
      cancelled: toNumber(row["cancelled"]),
      readCount: volume.readCount,
      readRate: notificationReadRate(volume),
    };
  });
}

function mapClinicalActivity(data: unknown): ClinicalActivity {
  const row = firstRow(data);
  return {
    prescriptionsIssued: toNumber(row?.["prescriptions_issued"]),
    treatmentPlansActivated: toNumber(row?.["treatment_plans_activated"]),
    consultationsDocumented: toNumber(row?.["consultations_documented"]),
    documentsUploaded: toNumber(row?.["documents_uploaded"]),
  };
}

function mapDocumentTypes(data: unknown): readonly DocumentTypeVolume[] {
  return rows(data).map((row) => ({
    documentType: String(row["document_type"] ?? ""),
    uploaded: toNumber(row["uploaded"]),
  }));
}

/**
 * A practitioner's own practice.
 *
 * Note what is not passed: there is no practitioner argument on any of these
 * three RPCs, because the scope is resolved from `auth.uid()` inside
 * `assert_care_practitioner()`. A doctor cannot ask this function about
 * anybody, including by changing a value in a request, because there is no
 * value to change (section 54, example 3).
 */
export async function getPracticeAnalytics(
  range: AnalyticsRange,
): Promise<PracticeAnalytics> {
  const user = await assertPermission("analytics.read.own_practice");
  const supabase = await createSupabaseServerClient();

  const [appointments, trend, practiceUtilization] = await Promise.all([
    read(
      "practice.appointments",
      user.id,
      () =>
        supabase.rpc("analytics_practice_appointment_summary", {
          p_from: range.from,
          p_to: range.to,
        }),
      mapCounts,
    ),
    read(
      "practice.trend",
      user.id,
      () =>
        supabase.rpc("analytics_practice_appointment_trend", {
          p_from: range.from,
          p_to: range.to,
        }),
      mapTrend,
    ),
    read(
      "practice.utilization",
      user.id,
      () =>
        supabase.rpc("analytics_practice_utilization", {
          p_from: range.from,
          p_to: range.to,
        }),
      mapUtilization,
    ),
  ]);

  return {
    range,
    generatedAt: new Date().toISOString(),
    appointments: guardCounts(appointments, user.id, "practice.appointments"),
    trend,
    utilization: practiceUtilization,
  };
}

function mapUtilization(data: unknown): Utilization {
  const row = firstRow(data);
  return utilization(
    toNumber(row?.["booked_minutes"]),
    toNumber(row?.["available_minutes"]),
  );
}

/**
 * The export's rows.
 *
 * Kept here rather than in the route handler so that the export reads the
 * same authorized interface the dashboard does, and so the permission it
 * requires is named beside every other analytics permission.
 *
 * Section 48: the export **is** audited, at the point it is authorized. The
 * log records who, which report, when and what scope — and nothing of what
 * was in it, which is the second half of that section.
 */
export async function getAppointmentReport(
  range: AnalyticsRange,
  practitionerId?: string,
): Promise<AnalyticsResult<readonly AppointmentReportRow[]>> {
  const user = await assertPermission("reports.export");

  // Phase 19. `phase_19.md` section 69 names exports. Each one runs a
  // year-wide aggregate and produces a file of clinic operations, so it is the
  // most expensive thing an authorized account can ask for in a loop. Checked
  // after the permission, so the limiter cannot be exhausted by somebody who
  // was never going to be allowed the export anyway.
  if (!allowOperation("report_export", user.id)) {
    logger.warn("analytics.export_rate_limited", { userId: user.id });
    return { status: "unavailable" };
  }

  const supabase = await createSupabaseServerClient();

  logger.info("analytics.export_requested", {
    userId: user.id,
    report: APPOINTMENT_REPORT.slug,
    from: range.from,
    to: range.to,
    // Whether the export was narrowed, not to whom. A practitioner id in an
    // audit line is an identifier this record does not need.
    scoped: practitionerId ? "practitioner" : "clinic",
  });

  // Phase 19. Also to the queryable audit trail, not only the structured log.
  // An export is a copy of clinic operations leaving on somebody's laptop, and
  // `phase_19.md` sections 89 and 141 ask for it to be attributable.
  //
  // No resource id: there is exactly one report, named by `resource_type`, so
  // an id would be a constant. No practitioner id either — whether the export
  // was narrowed is operational, to whom is an identifier the record does not
  // need, and the structured log above already carries the distinction.
  await recordSecurityAuditEvent({
    action: "report.exported",
    resourceType: "report",
    outcome: "allowed",
  });

  return read(
    "report.appointments",
    user.id,
    () =>
      supabase.rpc("analytics_appointment_report", {
        p_from: range.from,
        p_to: range.to,
        p_practitioner_id: practitionerId ?? null,
      }),
    (data) =>
      rows(data).map((row) => ({
        clinicDate: String(row["clinic_date"] ?? ""),
        practitionerName: String(row["practitioner_name"] ?? ""),
        appointmentTypeName: String(row["appointment_type_name"] ?? ""),
        status: String(row["status"] ?? "") as AppointmentStatus,
        appointmentCount: toNumber(row["appointment_count"]),
      })),
  );
}

/**
 * Whether the signed-in user may export.
 *
 * Used to decide whether to render the export control. A *usability*
 * decision: hiding it changes nothing about who may call the route, which
 * checks the permission itself and is refused again by the database.
 */
export async function currentUserMayExport(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  return can(user.role, "reports.export");
}
