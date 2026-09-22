import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_ROLES } from "@/config/permissions";

/**
 * The analytics read layer.
 *
 * These assert the properties every Phase 16 read rests on:
 *
 *   * **every role is refused every read it does not hold the permission
 *     for** — `phase_16.md` section 100's authorization list and section
 *     121's mandatory verification;
 *   * the RPC argument lists are exactly what the database declares, so
 *     sections 101's `practitionerId`, `clinicId`, `reportId` and `exportId`
 *     have nowhere to arrive;
 *   * **a practitioner's own analytics send no practitioner id at all**
 *     (sections 8, 54, example 3);
 *   * a failed read becomes a state the page renders rather than a thrown
 *     PostgREST error (sections 63 and 65);
 *   * counts that cannot be true are refused rather than drawn (section 97);
 *   * **no log line carries a figure, a name or a clinical field**
 *     (sections 104 and 119);
 *   * the export is audited, and the audit records no data (section 48).
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary: it proves the application never
 * *asks* for anything the database would have to refuse, and never passes on
 * something a request supplied.
 *
 * The other half — that the database refuses independently — is a property of
 * `supabase/migrations/20260927120000_analytics_reporting.sql`, asserted
 * structurally in `analytics-security.test.ts`. Both halves are needed;
 * neither substitutes for the other, and Phase 15's grant defect is the
 * reminder of why.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PRACTITIONER_ID = "22222222-2222-4222-8222-222222222222";

const RANGE = {
  from: "2026-09-01",
  to: "2026-09-30",
  spanDays: 30,
  granularity: "day" as const,
  preset: "this_month",
};

interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

let rpcCalls: RpcCall[] = [];
let rpcResults: Record<string, { data: unknown; error: unknown }> = {};

const getCurrentUser = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
  requireUser: () => getCurrentUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return rpcResults[name] ?? { data: [], error: null };
    },
  }),
}));

const logLines: string[] = [];

function pgError(code: string, message = "internal database detail") {
  return { code, message, details: null, hint: null };
}

function signedInAs(role: string) {
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "staff@punarvasu.test",
    emailVerified: true,
    role,
    displayName: "Staff",
  });
}

function countsRow(overrides: Record<string, number> = {}) {
  return [
    {
      total: 10,
      requested: 1,
      confirmed: 0,
      checked_in: 0,
      in_consultation: 0,
      completed: 6,
      cancelled: 2,
      no_show: 1,
      eligible: 9,
      ...overrides,
    },
  ];
}

beforeEach(() => {
  rpcCalls = [];
  rpcResults = {};
  logLines.length = 0;
  getCurrentUser.mockReset();

  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
  vi.spyOn(console, "error").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function queries() {
  return import("@/features/analytics/queries");
}

/**
 * The calls that actually asked the database an analytics question.
 *
 * Phase 19 records every authorization denial to the audit trail, so a refused
 * read *does* now reach the database — to record that it was refused. Filtering
 * that one call out is what keeps these assertions about analytics rather than
 * about auditing.
 */
function analyticsCalls() {
  return rpcCalls.filter((call) => call.name !== "record_security_audit_event");
}

/**
 * Asserts a refusal asked the database no analytics question, and was recorded.
 *
 * Stronger than the "no RPC at all" assertion it replaces: it proves both that
 * nothing was read and that the refusal is now attributable.
 */
function expectRefusedAndAudited(): void {
  expect(analyticsCalls()).toHaveLength(0);
  expect(rpcCalls.map((call) => call.name)).toEqual(
    expect.arrayContaining(["record_security_audit_event"]),
  );
  for (const call of rpcCalls) {
    expect(call.args).toMatchObject({ p_outcome: "denied" });
  }
}

describe("authorization", () => {
  it.each(["patient", "receptionist", "doctor"])(
    "refuses %s the administrator's system analytics",
    async (role) => {
      signedInAs(role);
      const { getClinicSystemAnalytics } = await queries();

      await expect(getClinicSystemAnalytics(RANGE)).rejects.toThrow();
      expectRefusedAndAudited();
    },
  );

  it.each(["patient", "doctor"])(
    "refuses %s the clinic's operational analytics",
    async (role) => {
      signedInAs(role);
      const { getClinicAnalytics } = await queries();

      await expect(getClinicAnalytics(RANGE)).rejects.toThrow();
      expectRefusedAndAudited();
    },
  );

  it.each(["patient", "receptionist", "admin"])(
    "refuses %s a practitioner's own analytics",
    async (role) => {
      // Including the administrator. `analytics.read.own_practice` resolves
      // to whoever the caller's practitioner record is, and an admin has
      // none — so this is not a narrower version of the clinic dashboard.
      signedInAs(role);
      const { getPracticeAnalytics } = await queries();

      await expect(getPracticeAnalytics(RANGE)).rejects.toThrow();
      expectRefusedAndAudited();
    },
  );

  it.each(["patient", "receptionist", "doctor"])(
    "refuses %s the export",
    async (role) => {
      signedInAs(role);
      const { getAppointmentReport } = await queries();

      await expect(getAppointmentReport(RANGE)).rejects.toThrow();
      expectRefusedAndAudited();
    },
  );

  it("refuses an unauthenticated caller every read", async () => {
    getCurrentUser.mockResolvedValue(null);
    const {
      getClinicAnalytics,
      getClinicSystemAnalytics,
      getPracticeAnalytics,
      getAppointmentReport,
    } = await queries();

    for (const read of [
      () => getClinicAnalytics(RANGE),
      () => getClinicSystemAnalytics(RANGE),
      () => getPracticeAnalytics(RANGE),
      () => getAppointmentReport(RANGE),
    ]) {
      await expect(read()).rejects.toThrow();
    }

    // No session means no actor, so there is nothing to attribute an audit
    // entry to and none is written. Still: no analytics question was asked.
    expect(rpcCalls).toHaveLength(0);
  });

  it("refuses a caller whose role could not be resolved", async () => {
    // Phase 06's `null` role means "identity known, role not resolvable".
    // It must fail closed rather than default to anything.
    signedInAs(null as unknown as string);
    const { getClinicAnalytics } = await queries();

    await expect(getClinicAnalytics(RANGE)).rejects.toThrow();
    expectRefusedAndAudited();
  });

  it("admits the roles that hold each permission", async () => {
    for (const [role, read] of [
      ["receptionist", "getClinicAnalytics"],
      ["admin", "getClinicAnalytics"],
      ["admin", "getClinicSystemAnalytics"],
      ["doctor", "getPracticeAnalytics"],
      ["admin", "getAppointmentReport"],
    ] as const) {
      rpcCalls = [];
      signedInAs(role);
      const reads = await queries();
      await (reads[read] as (r: typeof RANGE) => Promise<unknown>)(RANGE);
      expect(rpcCalls.length, `${role} → ${read}`).toBeGreaterThan(0);
    }
  });

  it("names every role the matrix declares", () => {
    // The cases above are written out; this catches a fifth role being added
    // without the list being revisited.
    expect([...APP_ROLES].sort()).toEqual([
      "admin",
      "doctor",
      "patient",
      "receptionist",
    ]);
  });
});

describe("what is sent to the database", () => {
  it("sends the clinic reads exactly a period and an optional filter", async () => {
    signedInAs("admin");
    const { getClinicAnalytics } = await queries();
    await getClinicAnalytics(RANGE);

    const summary = rpcCalls.find(
      (call) => call.name === "analytics_clinic_appointment_summary",
    );
    expect(summary?.args).toEqual({
      p_from: "2026-09-01",
      p_to: "2026-09-30",
      p_practitioner_id: null,
    });

    const patients = rpcCalls.find(
      (call) => call.name === "analytics_clinic_patient_summary",
    );
    expect(patients?.args).toEqual({
      p_from: "2026-09-01",
      p_to: "2026-09-30",
    });
  });

  it("passes a practitioner filter through as a filter", async () => {
    signedInAs("receptionist");
    const { getClinicAnalytics } = await queries();
    await getClinicAnalytics(RANGE, PRACTITIONER_ID);

    const summary = rpcCalls.find(
      (call) => call.name === "analytics_clinic_appointment_summary",
    );
    expect(summary?.args["p_practitioner_id"]).toBe(PRACTITIONER_ID);

    // But never onto a read where it would be meaningless. The workload
    // report is clinic-wide by definition, and the patient reads are about
    // registrations rather than about a practitioner.
    for (const name of [
      "analytics_clinic_practitioner_workload",
      "analytics_clinic_patient_summary",
      "analytics_clinic_patient_growth",
    ]) {
      const call = rpcCalls.find((candidate) => candidate.name === name);
      expect(call?.args, name).not.toHaveProperty("p_practitioner_id");
    }
  });

  it("sends a practitioner's own reads NO practitioner id", async () => {
    // Section 54 and example 3, asserted on the wire. The scope is resolved
    // inside the database from `auth.uid()`, so there is nothing here that a
    // manipulated request could have influenced.
    signedInAs("doctor");
    const { getPracticeAnalytics } = await queries();
    await getPracticeAnalytics(RANGE);

    expect(rpcCalls).toHaveLength(3);
    for (const call of rpcCalls) {
      expect(call.args, call.name).toEqual({
        p_from: "2026-09-01",
        p_to: "2026-09-30",
      });
    }
  });

  it("calls only the practice functions for a practitioner", async () => {
    signedInAs("doctor");
    const { getPracticeAnalytics } = await queries();
    await getPracticeAnalytics(RANGE);

    for (const call of rpcCalls) {
      expect(call.name).toMatch(/^analytics_practice_/);
    }
  });

  it("calls only the clinic functions for the front desk", async () => {
    signedInAs("receptionist");
    const { getClinicAnalytics } = await queries();
    await getClinicAnalytics(RANGE);

    for (const call of rpcCalls) {
      expect(call.name).toMatch(/^analytics_clinic_/);
    }
  });

  it("sends no patient, clinic, report or role identifier, ever", async () => {
    signedInAs("admin");
    const reads = await queries();
    await reads.getClinicAnalytics(RANGE, PRACTITIONER_ID);
    await reads.getClinicSystemAnalytics(RANGE);
    await reads.getAppointmentReport(RANGE, PRACTITIONER_ID);

    const calls = analyticsCalls();
    expect(calls.length).toBeGreaterThan(8);
    for (const call of calls) {
      for (const key of Object.keys(call.args)) {
        expect(
          ["p_from", "p_to", "p_practitioner_id"],
          `${call.name} sent ${key}`,
        ).toContain(key);
      }
    }
  });

  it("makes one round trip per question, never one per practitioner", async () => {
    // Section 81. The N+1 this report invites is "list practitioners, then
    // query appointments for each"; five calls for six panels is the shape
    // that proves it is not happening.
    signedInAs("admin");
    const { getClinicAnalytics } = await queries();
    await getClinicAnalytics(RANGE);

    expect(rpcCalls).toHaveLength(5);
    expect(new Set(rpcCalls.map((call) => call.name)).size).toBe(5);
  });
});

describe("failure is a state, not an exception", () => {
  it("reports a failed panel as unavailable and leaves the others readable", async () => {
    signedInAs("admin");
    rpcResults["analytics_clinic_patient_summary"] = {
      data: null,
      error: pgError("57014", "canceling statement due to statement timeout"),
    };
    rpcResults["analytics_clinic_appointment_summary"] = {
      data: countsRow(),
      error: null,
    };

    const { getClinicAnalytics } = await queries();
    const result = await getClinicAnalytics(RANGE);

    expect(result.patients.status).toBe("unavailable");
    // Section 63: one panel failing does not block the rest.
    expect(result.appointments.status).toBe("ready");
  });

  it("reports a database refusal as forbidden rather than as a failure", async () => {
    signedInAs("admin");
    rpcResults["analytics_notification_delivery_summary"] = {
      data: null,
      error: pgError("42501", "permission denied for function"),
    };

    const { getClinicSystemAnalytics } = await queries();
    const result = await getClinicSystemAnalytics(RANGE);

    expect(result.deliveries.status).toBe("forbidden");
  });

  it("never throws a database error out of a read", async () => {
    signedInAs("admin");
    for (const name of [
      "analytics_clinic_appointment_summary",
      "analytics_clinic_appointment_trend",
      "analytics_clinic_practitioner_workload",
      "analytics_clinic_patient_summary",
      "analytics_clinic_patient_growth",
    ]) {
      rpcResults[name] = { data: null, error: pgError("08006") };
    }

    const { getClinicAnalytics } = await queries();
    const result = await getClinicAnalytics(RANGE);

    expect(result.appointments.status).toBe("unavailable");
    expect(result.trend.status).toBe("unavailable");
    expect(result.workload.status).toBe("unavailable");
  });

  it("refuses counts that cannot be true", async () => {
    // Section 97. More completed than total means the query is wrong, and a
    // dashboard that draws it teaches its reader to trust a wrong number.
    signedInAs("admin");
    rpcResults["analytics_clinic_appointment_summary"] = {
      data: countsRow({ total: 3, completed: 6 }),
      error: null,
    };

    const { getClinicAnalytics } = await queries();
    const result = await getClinicAnalytics(RANGE);

    expect(result.appointments.status).toBe("unavailable");
    expect(logLines.join("\n")).toContain("analytics.data_quality");
  });

  it("accepts counts that are internally consistent", async () => {
    signedInAs("admin");
    rpcResults["analytics_clinic_appointment_summary"] = {
      data: countsRow(),
      error: null,
    };

    const { getClinicAnalytics } = await queries();
    const result = await getClinicAnalytics(RANGE);

    expect(result.appointments.status).toBe("ready");
    if (result.appointments.status === "ready") {
      expect(result.appointments.data.eligible).toBe(9);
    }
  });

  it("reads an empty period as zeroes rather than as a failure", async () => {
    // Section 96 and example 7. No rows means the clinic had a quiet month,
    // and that must not read as "data unavailable".
    signedInAs("admin");
    rpcResults["analytics_clinic_appointment_summary"] = {
      data: [],
      error: null,
    };

    const { getClinicAnalytics } = await queries();
    const result = await getClinicAnalytics(RANGE);

    expect(result.appointments.status).toBe("ready");
    if (result.appointments.status === "ready") {
      expect(result.appointments.data.total).toBe(0);
    }
  });
});

describe("what comes back", () => {
  it("derives the rates from the server's counts", async () => {
    signedInAs("receptionist");
    rpcResults["analytics_clinic_practitioner_workload"] = {
      data: [
        {
          practitioner_id: PRACTITIONER_ID,
          display_name: "Dr Example",
          is_active: true,
          total: 10,
          completed: 6,
          cancelled: 2,
          no_show: 1,
          eligible: 9,
          booked_minutes: "180",
          available_minutes: "480",
        },
      ],
      error: null,
    };

    const { getClinicAnalytics } = await queries();
    const result = await getClinicAnalytics(RANGE);

    expect(result.workload.status).toBe("ready");
    if (result.workload.status === "ready") {
      const row = result.workload.data[0];
      expect(row?.rates.completionRate).toBeCloseTo(6 / 9, 10);
      // PostgREST returns numeric as a string; it must not become NaN.
      expect(row?.utilizationRate).toBeCloseTo(0.375, 10);
      expect(row?.bookedMinutes).toBe(180);
    }
  });

  it("reports an acceptance rate and never a delivery rate", async () => {
    signedInAs("admin");
    rpcResults["analytics_notification_delivery_summary"] = {
      data: [
        {
          channel: "email",
          provider: "emailjs",
          pending: 4,
          sent: 301,
          failed: 19,
          skipped: 0,
        },
      ],
      error: null,
    };

    const { getClinicSystemAnalytics } = await queries();
    const result = await getClinicSystemAnalytics(RANGE);

    if (result.deliveries.status === "ready") {
      const row = result.deliveries.data[0];
      expect(row?.acceptanceRate).toBeCloseTo(301 / 320, 10);
      expect(row).not.toHaveProperty("delivered");
      expect(row).not.toHaveProperty("deliveryRate");
    }
  });

  it("returns nothing a patient could be identified by", async () => {
    // Section 104 and section 122's mandatory privacy verification, applied
    // to the shape the application actually hands its components.
    signedInAs("admin");
    rpcResults["analytics_clinic_appointment_summary"] = {
      data: countsRow(),
      error: null,
    };
    rpcResults["analytics_clinical_activity_summary"] = {
      data: [
        {
          prescriptions_issued: 12,
          treatment_plans_activated: 3,
          consultations_documented: 9,
          documents_uploaded: 5,
        },
      ],
      error: null,
    };

    const reads = await queries();
    const clinic = await reads.getClinicAnalytics(RANGE);
    const system = await reads.getClinicSystemAnalytics(RANGE);

    const serialised = JSON.stringify({ clinic, system }).toLowerCase();

    for (const term of [
      "patient_id",
      "patientid",
      "full_name",
      "email",
      "phone",
      "date_of_birth",
      "diagnosis",
      "symptom",
      "doctor_notes",
      "medicine",
      "storage_path",
      "signed",
      "token",
    ]) {
      expect(serialised, `a response carries "${term}"`).not.toContain(term);
    }
  });
});

describe("the export", () => {
  it("is audited, and the audit carries no data", async () => {
    // Section 48: record who, what report, when and what scope — and do not
    // log the exported dataset.
    signedInAs("admin");
    rpcResults["analytics_appointment_report"] = {
      data: [
        {
          clinic_date: "2026-09-17",
          practitioner_name: "Dr Example",
          appointment_type_name: "Initial consultation",
          status: "completed",
          appointment_count: 4,
        },
      ],
      error: null,
    };

    const { getAppointmentReport } = await queries();
    const result = await getAppointmentReport(RANGE);

    expect(result.status).toBe("ready");

    const log = logLines.join("\n");
    expect(log).toContain("analytics.export_requested");
    expect(log).toContain(USER_ID);
    expect(log).toContain("appointments");
    // The rows themselves are not in it.
    expect(log).not.toContain("Dr Example");
    expect(log).not.toContain("Initial consultation");
  });

  it("records that the export was narrowed, not to whom", async () => {
    signedInAs("admin");
    const { getAppointmentReport } = await queries();
    await getAppointmentReport(RANGE, PRACTITIONER_ID);

    const log = logLines.join("\n");
    expect(log).toContain("practitioner");
    // A practitioner id in an audit line is an identifier this record does
    // not need to do its job.
    expect(log).not.toContain(PRACTITIONER_ID);
  });

  it("sends the report the same period the dashboard read", async () => {
    signedInAs("admin");
    const { getAppointmentReport } = await queries();
    await getAppointmentReport(RANGE, PRACTITIONER_ID);

    const call = rpcCalls.find(
      (candidate) => candidate.name === "analytics_appointment_report",
    );
    expect(call?.args).toEqual({
      p_from: "2026-09-01",
      p_to: "2026-09-30",
      p_practitioner_id: PRACTITIONER_ID,
    });
  });
});

describe("logging", () => {
  it("carries no figure, name or period contents on a failure", async () => {
    signedInAs("admin");
    rpcResults["analytics_clinic_practitioner_workload"] = {
      data: null,
      error: pgError("42P01", 'relation "public.appointments" does not exist'),
    };

    const { getClinicAnalytics } = await queries();
    await getClinicAnalytics(RANGE);

    const log = logLines.join("\n");
    expect(log).toContain("analytics.read_failed");
    expect(log).toContain(USER_ID);

    // And not the provider's text.
    expect(log).not.toContain("does not exist");
    expect(log).not.toContain("public.appointments");
  });

  it("logs nothing at all on a successful dashboard read", async () => {
    // Analytics is read constantly; a log line per panel would be noise that
    // buries the failures.
    signedInAs("admin");
    rpcResults["analytics_clinic_appointment_summary"] = {
      data: countsRow(),
      error: null,
    };

    const { getClinicAnalytics } = await queries();
    await getClinicAnalytics(RANGE);

    expect(logLines).toHaveLength(0);
  });
});

describe("currentUserMayExport", () => {
  it("is true only for a role that holds the permission", async () => {
    const { currentUserMayExport } = await queries();

    for (const role of APP_ROLES) {
      signedInAs(role);
      expect(await currentUserMayExport(), role).toBe(role === "admin");
    }
  });

  it("is false with no session", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { currentUserMayExport } = await queries();
    expect(await currentUserMayExport()).toBe(false);
  });
});
