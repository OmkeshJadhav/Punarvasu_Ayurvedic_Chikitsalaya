import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The doctor server actions and query layer.
 *
 * These assert the properties the whole clinical workspace rests on:
 *
 *   * an unauthenticated or unauthorized caller reads and writes nothing,
 *     whatever role they hold;
 *   * no practitioner id, patient id, status the role may not set, duration,
 *     end time or reason is ever read from the request and passed on;
 *   * the doctor's identity is never in the request — the only two things
 *     that cross the boundary on a write are an appointment id and a status;
 *   * a database failure reaches the practitioner as a sentence, not as a
 *     PostgREST error, and reaches the log without a patient in it;
 *   * a successful write revalidates the pages that show it.
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary. It proves the application never
 * *asks* for anything the database would have to refuse.
 *
 * The other half — that the database refuses independently — is a property
 * of `supabase/migrations/20260922120000_doctor_workspace.sql`, and is
 * asserted structurally in `doctor-security.test.ts` and against a live
 * project in `docs/progress/progress_phase_11.md`. Both halves are needed.
 * This is the same split Phases 07 to 10 recorded.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const APPOINTMENT_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_APPOINTMENT_ID = "66666666-6666-4666-8666-666666666666";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const PRACTITIONER_ID = "33333333-3333-4333-8333-333333333333";

/** Every RPC the stubbed client was asked to make, in order. */
interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

let rpcCalls: RpcCall[] = [];
let rpcResults: Record<string, { data: unknown; error: unknown }> = {};

const getCurrentUser = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
  requireUser: () => getCurrentUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return rpcResults[name] ?? { data: null, error: null };
    },
    from: () => {
      throw new Error("No table read is expected in this test.");
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

const logLines: string[] = [];

function statusForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("appointmentId", APPOINTMENT_ID);
  data.set("status", "confirmed");
  for (const [name, value] of Object.entries(overrides)) {
    data.set(name, value);
  }
  return data;
}

function searchForm(
  query: string,
  extra: Record<string, string> = {},
): FormData {
  const data = new FormData();
  data.set("query", query);
  for (const [name, value] of Object.entries(extra)) {
    data.set(name, value);
  }
  return data;
}

async function loadActions() {
  return import("@/features/doctor/actions");
}

async function loadQueries() {
  return import("@/features/doctor/queries");
}

function asDoctor() {
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "doctor@example.test",
    emailVerified: true,
    role: "doctor",
    displayName: "Test Doctor",
  });
}

beforeEach(() => {
  vi.resetModules();
  rpcCalls = [];
  rpcResults = {
    update_appointment_status_as_doctor: { data: null, error: null },
    search_care_patients: { data: [], error: null },
    current_practitioner_id: { data: PRACTITIONER_ID, error: null },
  };
  logLines.length = 0;
  revalidatePath.mockClear();

  asDoctor();

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

describe("authorization", () => {
  it.each([
    ["patient", "patient"],
    ["receptionist", "receptionist"],
    ["admin", "admin"],
    ["no role", null],
  ])("writes nothing for a %s", async (_label, role) => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "someone@example.test",
      emailVerified: true,
      role,
      displayName: "Someone",
    });

    const { updateDoctorAppointmentStatusAction } = await loadActions();
    const state = await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm(),
    );

    expect(state.status).toBe("error");
    expect(rpcCalls).toHaveLength(0);
  });

  it("writes nothing when the session has ended", async () => {
    getCurrentUser.mockResolvedValue(null);

    const { updateDoctorAppointmentStatusAction } = await loadActions();
    const state = await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm(),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("sign in");
    expect(rpcCalls).toHaveLength(0);
  });

  it("refuses without naming a role, a permission or a policy", async () => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "someone@example.test",
      emailVerified: true,
      role: "receptionist",
      displayName: "Someone",
    });

    const { updateDoctorAppointmentStatusAction } = await loadActions();
    const state = await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm(),
    );

    const message = state.message ?? "";
    expect(message).not.toMatch(/doctor|receptionist|practitioner|role/i);
    expect(message).not.toMatch(/appointments\.|patients\./);
    expect(message).not.toMatch(/polic|row.level|rls/i);
  });

  it.each([
    ["patient", "patient"],
    ["receptionist", "receptionist"],
    ["admin", "admin"],
    ["no role", null],
  ])("refuses a patient search for a %s", async (_label, role) => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "someone@example.test",
      emailVerified: true,
      role,
      displayName: "Someone",
    });

    const { searchCarePatientsAction } = await loadActions();
    const state = await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      searchForm("Priya"),
    );

    expect(state.status).toBe("forbidden");
    expect(state.results).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it("does not echo the term back on a refusal", async () => {
    // There is no form to return it to, and a refused request should not
    // keep somebody's name in a response.
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "someone@example.test",
      emailVerified: true,
      role: "patient",
      displayName: "Someone",
    });

    const { searchCarePatientsAction } = await loadActions();
    const state = await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      searchForm("Priya Sharma"),
    );

    expect(state.query).toBe("");
  });

  it.each([
    ["patient", "patient"],
    ["receptionist", "receptionist"],
    ["admin", "admin"],
    ["no role", null],
  ])("refuses every read for a %s", async (_label, role) => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "someone@example.test",
      emailVerified: true,
      role,
      displayName: "Someone",
    });

    const queries = await loadQueries();

    await expect(queries.getDoctorIdentity()).rejects.toThrow();
    await expect(queries.getDoctorDaySchedule("2026-09-22")).rejects.toThrow();
    await expect(
      queries.getDoctorAppointment(APPOINTMENT_ID),
    ).rejects.toThrow();
    await expect(queries.getCarePatient(PATIENT_ID)).rejects.toThrow();
    await expect(queries.searchCarePatients("Priya")).rejects.toThrow();

    // Phase 19 records every authorization denial, so a refused read does now
    // reach the database — to record that it was refused. The assertion is
    // therefore the stronger one: no doctor question was asked, and every call
    // that did happen was a denial being written down.
    const domainCalls = rpcCalls.filter(
      (call) => call.name !== "record_security_audit_event",
    );
    expect(domainCalls).toHaveLength(0);
    for (const call of rpcCalls) {
      expect(call.args).toMatchObject({
        p_action: "authorization.denied",
        p_outcome: "denied",
      });
    }
  });
});

describe("the status write", () => {
  it("sends exactly the appointment id and the status", async () => {
    const { updateDoctorAppointmentStatusAction } = await loadActions();
    await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm({ status: "in_consultation" }),
    );

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe("update_appointment_status_as_doctor");
    expect(rpcCalls[0]?.args).toEqual({
      p_appointment_id: APPOINTMENT_ID,
      p_status: "in_consultation",
    });
  });

  it.each(["confirmed", "in_consultation", "completed", "no_show"])(
    "accepts %s",
    async (status) => {
      const { updateDoctorAppointmentStatusAction } = await loadActions();
      const state = await updateDoctorAppointmentStatusAction(
        { status: "idle" },
        statusForm({ status }),
      );

      expect(state.status).toBe("success");
      expect(rpcCalls[0]?.args["p_status"]).toBe(status);
    },
  );

  it.each(["cancelled", "checked_in", "requested"])(
    "refuses %s without calling the database",
    async (status) => {
      const { updateDoctorAppointmentStatusAction } = await loadActions();
      const state = await updateDoctorAppointmentStatusAction(
        { status: "idle" },
        statusForm({ status }),
      );

      expect(state.status).toBe("error");
      expect(rpcCalls).toHaveLength(0);
    },
  );

  it.each([
    "",
    "not-a-uuid",
    "'; drop table appointments; --",
    "<script>alert(1)</script>",
    "../../etc/passwd",
  ])("refuses a manipulated appointment id (%s)", async (id) => {
    const { updateDoctorAppointmentStatusAction } = await loadActions();
    const state = await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm({ appointmentId: id }),
    );

    expect(state.status).toBe("error");
    expect(rpcCalls).toHaveLength(0);
  });

  it("passes a well-formed id for somebody else's appointment straight to the database", async () => {
    // The application cannot tell whose it is and must not try: the
    // database resolves it by the caller's own practitioner id, which is
    // where the isolation lives. What matters here is that nothing else is
    // sent with it.
    rpcResults["update_appointment_status_as_doctor"] = {
      data: null,
      error: { code: "PV009", message: "Appointment not found." },
    };

    const { updateDoctorAppointmentStatusAction } = await loadActions();
    const state = await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm({ appointmentId: OTHER_APPOINTMENT_ID }),
    );

    expect(rpcCalls[0]?.args).toEqual({
      p_appointment_id: OTHER_APPOINTMENT_ID,
      p_status: "confirmed",
    });
    expect(state.status).toBe("error");
    expect(state.message).toBe("We couldn't find that appointment.");
  });

  it.each([
    ["a practitioner id", { practitionerId: PRACTITIONER_ID }],
    ["a doctor id", { doctorId: PRACTITIONER_ID }],
    ["a patient id", { patientId: PATIENT_ID }],
    ["a role", { role: "admin" }],
    ["a permission", { permission: "roles.manage" }],
    ["a duration", { duration: "480" }],
    ["an end time", { endsAt: "2026-09-22T23:00:00+05:30" }],
    ["a reason", { reason: "clinical note" }],
    ["an internal note", { internalNote: "anything" }],
  ])("ignores %s planted on the form", async (_label, extra) => {
    const { updateDoctorAppointmentStatusAction } = await loadActions();
    const state = await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm(extra),
    );

    // The named-field read runs first, so an extra field on the form is
    // never read at all — it cannot reach the schema and it cannot reach
    // the RPC. The write still succeeds, unchanged.
    expect(state.status).toBe("success");
    expect(rpcCalls).toHaveLength(1);
    expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_appointment_id",
      "p_status",
    ]);
  });

  it("revalidates the pages that show the appointment", async () => {
    const { updateDoctorAppointmentStatusAction } = await loadActions();
    await updateDoctorAppointmentStatusAction({ status: "idle" }, statusForm());

    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toContain("/doctor");
    expect(paths).toContain("/doctor/appointments");
    expect(paths).toContain(`/doctor/appointments/${APPOINTMENT_ID}`);
    expect(paths).toContain(
      `/doctor/appointments/${APPOINTMENT_ID}/consultation`,
    );
  });

  it("does not redirect, so a status change keeps the practitioner where they were", async () => {
    // Deliberately unlike the reception booking flow: a practitioner
    // confirming or starting is still reading the same appointment, and a
    // navigation would lose their place.
    const { updateDoctorAppointmentStatusAction } = await loadActions();
    const state = await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm(),
    );

    expect(state.status).toBe("success");
    expect(state.message).toBe("Appointment confirmed.");
  });
});

describe("safe failure", () => {
  it.each([
    ["42501", "permission denied for function"],
    ["PV008", "That status change is not allowed."],
    ["PV009", "Appointment not found."],
    [
      "23505",
      "duplicate key value violates unique constraint appointments_pkey",
    ],
  ])("turns %s into copy carrying no database text", async (code, message) => {
    rpcResults["update_appointment_status_as_doctor"] = {
      data: null,
      error: { code, message, details: null, hint: null },
    };

    const { updateDoctorAppointmentStatusAction } = await loadActions();
    const state = await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm(),
    );

    expect(state.status).toBe("error");
    expect(state.message).toBeTruthy();
    expect(state.message).not.toContain(message);
    expect(state.message).not.toMatch(/appointments|constraint|function|pg/i);
  });

  it("reports a failed search as an outage rather than as an empty result", async () => {
    rpcResults["search_care_patients"] = {
      data: null,
      error: { code: "57014", message: "canceling statement due to timeout" },
    };

    const { searchCarePatientsAction } = await loadActions();
    const state = await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      searchForm("Priya"),
    );

    expect(state.status).toBe("unavailable");
    expect(state.results).toEqual([]);
  });
});

describe("the patient search", () => {
  it("sends the term and a bounded limit", async () => {
    const { searchCarePatientsAction } = await loadActions();
    await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      searchForm("Priya"),
    );

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe("search_care_patients");
    expect(rpcCalls[0]?.args).toEqual({ p_query: "Priya", p_limit: 20 });
  });

  it("does not search for a term shorter than two characters", async () => {
    const { searchCarePatientsAction } = await loadActions();
    const state = await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      searchForm("P"),
    );

    expect(state.tooShort).toBe(true);
    expect(rpcCalls).toHaveLength(0);
  });

  it("does not treat an empty box as a request for everybody", async () => {
    const { searchCarePatientsAction } = await loadActions();
    const state = await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      searchForm(""),
    );

    expect(state.status).toBe("idle");
    expect(state.results).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it("ignores a planted limit", async () => {
    const { searchCarePatientsAction } = await loadActions();
    await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "Priya" },
      searchForm("Priya", { limit: "100000", p_limit: "100000" }),
    );

    expect(rpcCalls[0]?.args["p_limit"]).toBe(20);
  });

  it("maps a result to the minimum the workspace renders", async () => {
    rpcResults["search_care_patients"] = {
      data: [
        {
          id: PATIENT_ID,
          full_name: "Test Patient",
          preferred_name: null,
          phone: "9999999999",
          date_of_birth: "1990-04-07",
          last_appointment_at: "2026-09-01T05:00:00.000Z",
        },
      ],
      error: null,
    };

    const { searchCarePatientsAction } = await loadActions();
    const state = await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      searchForm("Test"),
    );

    expect(state.status).toBe("found");
    expect(state.results).toHaveLength(1);

    const [patient] = state.results;
    expect(Object.keys(patient ?? {}).sort()).toEqual([
      "dateOfBirth",
      "fullName",
      "id",
      "lastAppointmentAt",
      "phone",
      "preferredName",
    ]);
  });
});

describe("what reaches the log", () => {
  it("records the operation, the actor and the appointment, and nothing else", async () => {
    const { updateDoctorAppointmentStatusAction } = await loadActions();
    await updateDoctorAppointmentStatusAction(
      { status: "idle" },
      statusForm({ status: "completed" }),
    );

    const joined = logLines.join("\n");
    expect(joined).toContain("doctor.appointment_status_changed");
    expect(joined).toContain(USER_ID);
    expect(joined).toContain(APPOINTMENT_ID);
  });

  it("never records a search term", async () => {
    // A search term at a clinic is somebody's name.
    const { searchCarePatientsAction } = await loadActions();
    await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      searchForm("Priyanka Deshmukh"),
    );

    const joined = logLines.join("\n");
    expect(joined).toContain("doctor.patient_search");
    expect(joined).not.toContain("Priyanka");
    expect(joined).not.toContain("Deshmukh");
  });

  it("never records a patient name, phone number or date of birth", async () => {
    rpcResults["search_care_patients"] = {
      data: [
        {
          id: PATIENT_ID,
          full_name: "Priyanka Deshmukh",
          preferred_name: "Priya",
          phone: "9999999999",
          date_of_birth: "1990-04-07",
          last_appointment_at: null,
        },
      ],
      error: null,
    };

    const { searchCarePatientsAction } = await loadActions();
    await searchCarePatientsAction(
      { status: "idle", results: [], tooShort: false, query: "Priya" },
      searchForm("Priya"),
    );

    const joined = logLines.join("\n");
    expect(joined).not.toContain("Deshmukh");
    expect(joined).not.toContain("9999999999");
    expect(joined).not.toContain("1990-04-07");
  });

  it("records a refusal against the actor without naming them", async () => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "someone@example.test",
      emailVerified: true,
      role: "receptionist",
      displayName: "Someone Else",
    });

    const { updateDoctorAppointmentStatusAction } = await loadActions();
    await updateDoctorAppointmentStatusAction({ status: "idle" }, statusForm());

    const joined = logLines.join("\n");
    expect(joined).toContain("authz.denied");
    expect(joined).toContain(USER_ID);
    expect(joined).not.toContain("someone@example.test");
    expect(joined).not.toContain("Someone Else");
  });
});
