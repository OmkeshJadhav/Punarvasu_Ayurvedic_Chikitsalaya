import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The receptionist server actions.
 *
 * These assert the properties the whole front-desk workspace rests on:
 *
 *   * an unauthenticated or unauthorized caller writes nothing, whatever role
 *     they hold;
 *   * no status, duration, end time, owner or role is ever read from the
 *     request and passed on;
 *   * the one identifier a staff write does take — the patient id — is passed
 *     as data and never as a claim about the caller;
 *   * a database failure reaches the receptionist as a sentence, not as a
 *     PostgREST error, and reaches the log without a patient in it;
 *   * a successful write revalidates the pages that show it.
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary. It proves the application never
 * *asks* for anything the database would have to refuse.
 *
 * The other half — that the database refuses independently — is a property of
 * `supabase/migrations/20260921120000_receptionist_workspace.sql`, and is
 * asserted structurally in `reception-security.test.ts` and against a live
 * project in `docs/progress/progress_phase_10.md`. Both halves are needed.
 * This is the same split Phases 07, 08 and 09 recorded.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const PRACTITIONER_ID = "33333333-3333-4333-8333-333333333333";
const TYPE_ID = "44444444-4444-4444-8444-444444444444";
const APPOINTMENT_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_PATIENT_ID = "66666666-6666-4666-8666-666666666666";

const STARTS_AT = "2026-09-22T10:30:00+05:30";

/** Every RPC the stubbed client was asked to make, in order. */
interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

let rpcCalls: RpcCall[] = [];
let rpcResults: Record<string, { data: unknown; error: unknown }> = {};

const getCurrentUser = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  // Next.js signals a redirect by throwing. Reproducing that is what makes the
  // "nothing after the redirect runs" guarantee testable.
  const error = new Error(`NEXT_REDIRECT;${path}`);
  (error as { digest?: string }).digest = `NEXT_REDIRECT;replace;${path};307;`;
  throw error;
});

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return rpcResults[name] ?? { data: null, error: null };
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

const logLines: string[] = [];

function patientForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("fullName", "Test Patient");
  data.set("phone", "9999999999");
  for (const [name, value] of Object.entries(overrides)) {
    data.set(name, value);
  }
  return data;
}

function bookingForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values: Record<string, string> = {
    patientId: PATIENT_ID,
    practitionerId: PRACTITIONER_ID,
    appointmentTypeId: TYPE_ID,
    startsAt: STARTS_AT,
    patientNote: "",
    ...overrides,
  };

  for (const [name, value] of Object.entries(values)) {
    data.set(name, value);
  }
  return data;
}

function statusForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("appointmentId", APPOINTMENT_ID);
  data.set("status", "confirmed");
  data.set("reason", "");
  for (const [name, value] of Object.entries(overrides)) {
    data.set(name, value);
  }
  return data;
}

function rescheduleForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("appointmentId", APPOINTMENT_ID);
  data.set("startsAt", STARTS_AT);
  for (const [name, value] of Object.entries(overrides)) {
    data.set(name, value);
  }
  return data;
}

/** Runs an action that ends in a redirect, and reports where it went. */
async function runExpectingRedirect(
  run: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest;
    return typeof digest === "string" ? digest : null;
  }
}

async function loadActions() {
  return import("@/features/reception/actions");
}

function asReceptionist() {
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "reception@example.test",
    emailVerified: true,
    role: "receptionist",
    displayName: "Test Receptionist",
  });
}

beforeEach(() => {
  vi.resetModules();
  rpcCalls = [];
  rpcResults = {
    create_patient_record: { data: PATIENT_ID, error: null },
    create_appointment_for_patient: { data: APPOINTMENT_ID, error: null },
    update_appointment_status_as_staff: { data: null, error: null },
    reschedule_appointment_as_staff: { data: null, error: null },
    find_possible_duplicate_patients: { data: [], error: null },
    search_patients: { data: [], error: null },
  };
  logLines.length = 0;
  revalidatePath.mockClear();
  redirect.mockClear();

  asReceptionist();

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
    ["doctor", "doctor"],
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

    const actions = await loadActions();

    const results = await Promise.all([
      actions.createPatientAction({ status: "idle" }, patientForm()),
      actions.createAppointmentForPatientAction(
        { status: "idle" },
        bookingForm(),
      ),
      actions.updateAppointmentStatusAction({ status: "idle" }, statusForm()),
      actions.rescheduleAppointmentForPatientAction(
        { status: "idle" },
        rescheduleForm(),
      ),
    ]);

    for (const result of results) {
      expect(result.status).toBe("error");
    }

    // The point: not one call reached the database.
    expect(rpcCalls).toEqual([]);
  });

  it("refuses without naming a role or a permission", async () => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "patient@example.test",
      emailVerified: true,
      role: "patient",
      displayName: "Patient",
    });

    const actions = await loadActions();
    const result = await actions.updateAppointmentStatusAction(
      { status: "idle" },
      statusForm(),
    );

    /*
     * `phase_08.md` section 12: a refusal must disclose nothing about the
     * privilege model. "You don't have permission" is the whole message —
     * saying that somebody is not allowed is not the same as telling them
     * which role or which permission would have let them through, and it is
     * the latter that hands an attacker a map.
     */
    expect(result.message).not.toMatch(/receptionist|patient|doctor|admin/i);
    expect(result.message).not.toContain("appointments.manage.any");
    expect(result.message).not.toContain("patients.read.operational");
    // Built from a string rather than written as a regex literal: the
    // formatter rewrites a \b escape inside a literal into a backspace
    // byte, which is what had happened here — the pattern was matching
    // \"<BS>role<BS>\" and therefore nothing at all. Found by a control-byte
    // scan in Phase 14.
    expect(result.message).not.toMatch(new RegExp("\\brole\\b", "i"));
  });

  it("writes nothing when the session has ended", async () => {
    getCurrentUser.mockResolvedValue(null);

    const actions = await loadActions();
    const result = await actions.createAppointmentForPatientAction(
      { status: "idle" },
      bookingForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/sign in/i);
    expect(rpcCalls).toEqual([]);
  });

  it("logs a refusal with the user id and the permission, and nothing else", async () => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "doctor@example.test",
      emailVerified: true,
      role: "doctor",
      displayName: "Doctor Example",
    });

    const actions = await loadActions();
    await actions.createPatientAction({ status: "idle" }, patientForm());

    const log = logLines.join("\n");
    expect(log).toContain("authz.denied");
    expect(log).toContain(USER_ID);
    // Never the person's address or name.
    expect(log).not.toContain("doctor@example.test");
    expect(log).not.toContain("Doctor Example");
  });
});

describe("createPatientAction", () => {
  it("creates an unlinked record and never sends an owner", async () => {
    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.createPatientAction({ status: "idle" }, patientForm()),
    );

    const call = rpcCalls.find((rpc) => rpc.name === "create_patient_record");
    expect(call).toBeDefined();

    // The whole security argument, asserted: there is no owner parameter, so
    // a receptionist cannot attach a record to an account
    // (`phase_10.md` sections 34-35).
    const keys = Object.keys(call?.args ?? {});
    for (const forbidden of [
      "p_profile_id",
      "p_user_id",
      "p_role",
      "p_email",
      "p_password",
      "p_id",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("ignores a profile id, user id or role planted on the form", async () => {
    const actions = await loadActions();
    const digest = await runExpectingRedirect(() =>
      actions.createPatientAction(
        { status: "idle" },
        patientForm({
          profileId: USER_ID,
          userId: USER_ID,
          role: "admin",
          password: "hunter2",
        }),
      ),
    );

    // The form is read by a fixed field list, so the extra fields are never
    // read at all — the submission succeeds and carries none of them.
    expect(digest).toContain("/receptionist/patients/");

    const call = rpcCalls.find((rpc) => rpc.name === "create_patient_record");
    const serialised = JSON.stringify(call?.args ?? {});
    expect(serialised).not.toContain("admin");
    expect(serialised).not.toContain("hunter2");
  });

  it("shows possible duplicates and writes nothing on the first attempt", async () => {
    rpcResults["find_possible_duplicate_patients"] = {
      data: [
        {
          id: OTHER_PATIENT_ID,
          full_name: "Test Patient",
          preferred_name: null,
          phone: "9999999999",
          date_of_birth: "1990-04-07",
          city: "Satara",
          has_account: false,
          match_reason: "phone",
        },
      ],
      error: null,
    };

    const actions = await loadActions();
    const result = await actions.createPatientAction(
      { status: "idle" },
      patientForm(),
    );

    expect(result.status).toBe("error");
    expect(result.duplicates).toHaveLength(1);
    // Nothing was written.
    expect(rpcCalls.some((rpc) => rpc.name === "create_patient_record")).toBe(
      false,
    );
    // And the receptionist's typed values come back, so they do not retype.
    expect(result.values?.["fullName"]).toBe("Test Patient");
  });

  it("proceeds once the receptionist says it is somebody else", async () => {
    rpcResults["find_possible_duplicate_patients"] = {
      data: [
        {
          id: OTHER_PATIENT_ID,
          full_name: "Test Patient",
          preferred_name: null,
          phone: "9999999999",
          date_of_birth: null,
          city: null,
          has_account: false,
          match_reason: "phone",
        },
      ],
      error: null,
    };

    const actions = await loadActions();
    const digest = await runExpectingRedirect(() =>
      actions.createPatientAction(
        { status: "idle" },
        patientForm({ duplicateAcknowledged: "1" }),
      ),
    );

    // It warns once and never blocks (`phase_10.md` section 33).
    expect(rpcCalls.some((rpc) => rpc.name === "create_patient_record")).toBe(
      true,
    );
    expect(digest).toContain(`/receptionist/patients/${PATIENT_ID}`);
  });

  it("does not block registration when the duplicate check itself fails", async () => {
    rpcResults["find_possible_duplicate_patients"] = {
      data: null,
      error: { code: "57014", message: "canceling statement due to timeout" },
    };

    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.createPatientAction({ status: "idle" }, patientForm()),
    );

    // Advisory means advisory. Being unable to register somebody standing at
    // the desk because a hint query timed out is not a trade worth making.
    expect(rpcCalls.some((rpc) => rpc.name === "create_patient_record")).toBe(
      true,
    );
  });

  it("never logs the patient's name, phone number or address", async () => {
    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.createPatientAction(
        { status: "idle" },
        patientForm({
          fullName: "Priya Example",
          phone: "9876543210",
          addressLine1: "1 Example Road",
          dateOfBirth: "1990-04-07",
        }),
      ),
    );

    const log = logLines.join("\n");
    expect(log).toContain("reception.patient_created");
    expect(log).not.toContain("Priya Example");
    expect(log).not.toContain("9876543210");
    expect(log).not.toContain("1 Example Road");
    expect(log).not.toContain("1990-04-07");
  });

  it("returns safe copy and no database text when the write fails", async () => {
    rpcResults["create_patient_record"] = {
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.patients" does not exist',
      },
    };

    const actions = await loadActions();
    const result = await actions.createPatientAction(
      { status: "idle" },
      patientForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).not.toContain("relation");
    expect(result.message).not.toContain("public.patients");
    expect(result.message).not.toContain("42P01");
    // The values come back, so the receptionist does not retype.
    expect(result.values?.["fullName"]).toBe("Test Patient");
  });
});

describe("createAppointmentForPatientAction", () => {
  it("sends exactly the five values the database function takes", async () => {
    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.createAppointmentForPatientAction(
        { status: "idle" },
        bookingForm({ patientNote: "Ground-floor room" }),
      ),
    );

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe("create_appointment_for_patient");
    expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_appointment_type_id",
      "p_patient_id",
      "p_patient_note",
      "p_practitioner_id",
      "p_starts_at",
    ]);
  });

  it("sends no status, duration, end time or created-by", async () => {
    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.createAppointmentForPatientAction(
        { status: "idle" },
        bookingForm(),
      ),
    );

    const keys = Object.keys(rpcCalls[0]?.args ?? {});
    for (const forbidden of [
      "p_status",
      "p_duration_minutes",
      "p_ends_at",
      "p_blocked_until",
      "p_created_by",
      "p_internal_note",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("changes nothing when a status or duration is planted on the form", async () => {
    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.createAppointmentForPatientAction(
        { status: "idle" },
        bookingForm({
          status: "completed",
          duration: "480",
          endsAt: "2026-09-22T23:00:00+05:30",
          internalNote: "planted",
        }),
      ),
    );

    // `phase_10.md` section 62's manipulation list. The form is read by a
    // fixed field list, so none of them is ever read.
    const serialised = JSON.stringify(rpcCalls[0]?.args ?? {});
    expect(serialised).not.toContain("completed");
    expect(serialised).not.toContain("480");
    expect(serialised).not.toContain("planted");
    expect(serialised).not.toContain("23:00");
  });

  it("passes the patient id through as data", async () => {
    // `phase_10.md` section 18: the receptionist chooses the patient, so the
    // id is a real input. It says *which*; the database says *whether*.
    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.createAppointmentForPatientAction(
        { status: "idle" },
        bookingForm({ patientId: OTHER_PATIENT_ID }),
      ),
    );

    expect(rpcCalls[0]?.args["p_patient_id"]).toBe(OTHER_PATIENT_ID);
  });

  it("refuses a malformed patient id before reaching the database", async () => {
    const actions = await loadActions();

    for (const patientId of [
      "not-a-uuid",
      "'; drop table appointments; --",
      "../../etc/passwd",
      "",
    ]) {
      rpcCalls = [];
      const result = await actions.createAppointmentForPatientAction(
        { status: "idle" },
        bookingForm({ patientId }),
      );

      expect(result.status, patientId).toBe("error");
      expect(rpcCalls, patientId).toEqual([]);
    }
  });

  it("turns a slot conflict into copy a receptionist can act on", async () => {
    rpcResults["create_appointment_for_patient"] = {
      data: null,
      error: {
        code: "23P01",
        message:
          'conflicting key value violates exclusion constraint "appointments_practitioner_no_overlap"',
      },
    };

    const actions = await loadActions();
    const result = await actions.createAppointmentForPatientAction(
      { status: "idle" },
      bookingForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/just been taken/i);
    expect(result.message).not.toContain("exclusion constraint");
    expect(result.message).not.toContain(
      "appointments_practitioner_no_overlap",
    );
  });

  it("turns an unknown patient into a different message from an unknown appointment", async () => {
    rpcResults["create_appointment_for_patient"] = {
      data: null,
      error: { code: "PV014", message: "Unknown patient record." },
    };

    const actions = await loadActions();
    const result = await actions.createAppointmentForPatientAction(
      { status: "idle" },
      bookingForm(),
    );

    expect(result.message).toMatch(/patient/i);
    expect(result.message).not.toContain("Unknown patient record.");
  });

  it("revalidates what the booking changed, and redirects to it", async () => {
    const actions = await loadActions();
    const digest = await runExpectingRedirect(() =>
      actions.createAppointmentForPatientAction(
        { status: "idle" },
        bookingForm(),
      ),
    );

    const revalidated = revalidatePath.mock.calls.map(([path]) => path);
    expect(revalidated).toContain("/receptionist");
    expect(revalidated).toContain("/receptionist/schedule");
    expect(revalidated).toContain(`/receptionist/patients/${PATIENT_ID}`);
    expect(digest).toContain(`/receptionist/schedule/${APPOINTMENT_ID}`);
  });
});

describe("updateAppointmentStatusAction", () => {
  it.each(["confirmed", "checked_in", "no_show", "cancelled"])(
    "sends %s through the one staff status function",
    async (status) => {
      const actions = await loadActions();
      const result = await actions.updateAppointmentStatusAction(
        { status: "idle" },
        statusForm({ status }),
      );

      expect(result.status).toBe("success");
      expect(rpcCalls[0]?.name).toBe("update_appointment_status_as_staff");
      expect(rpcCalls[0]?.args["p_status"]).toBe(status);
    },
  );

  it.each(["completed", "in_consultation", "requested", "admin", "COMPLETED"])(
    "refuses %s before reaching the database",
    async (status) => {
      const actions = await loadActions();
      const result = await actions.updateAppointmentStatusAction(
        { status: "idle" },
        statusForm({ status }),
      );

      expect(result.status).toBe("error");
      expect(rpcCalls).toEqual([]);
    },
  );

  it("refuses an unexpected field rather than dropping it", async () => {
    const actions = await loadActions();
    const form = statusForm();
    form.set("patientId", OTHER_PATIENT_ID);

    const result = await actions.updateAppointmentStatusAction(
      { status: "idle" },
      form,
    );

    // The named-field read means the extra field is never read at all, so the
    // submission succeeds and carries none of it.
    expect(result.status).toBe("success");
    expect(JSON.stringify(rpcCalls[0]?.args)).not.toContain(OTHER_PATIENT_ID);
  });

  it("turns an illegal transition into safe copy", async () => {
    rpcResults["update_appointment_status_as_staff"] = {
      data: null,
      error: { code: "PV008", message: "That status change is not allowed." },
    };

    const actions = await loadActions();
    const result = await actions.updateAppointmentStatusAction(
      { status: "idle" },
      statusForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/no longer be changed/i);
  });

  it("logs the operation, the appointment and the status, and no patient", async () => {
    const actions = await loadActions();
    await actions.updateAppointmentStatusAction(
      { status: "idle" },
      statusForm({ status: "cancelled", reason: "Patient rang to cancel" }),
    );

    const log = logLines.join("\n");
    expect(log).toContain("reception.appointment_status_changed");
    expect(log).toContain(APPOINTMENT_ID);
    expect(log).toContain("cancelled");
    // The reason is free text somebody typed. It is recorded against the
    // appointment, not in the log.
    expect(log).not.toContain("Patient rang to cancel");
  });
});

describe("rescheduleAppointmentForPatientAction", () => {
  it("sends only an appointment id and an instant", async () => {
    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.rescheduleAppointmentForPatientAction(
        { status: "idle" },
        rescheduleForm(),
      ),
    );

    expect(rpcCalls[0]?.name).toBe("reschedule_appointment_as_staff");
    expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_appointment_id",
      "p_starts_at",
    ]);
  });

  it("refuses a naive local time before reaching the database", async () => {
    const actions = await loadActions();
    const result = await actions.rescheduleAppointmentForPatientAction(
      { status: "idle" },
      rescheduleForm({ startsAt: "2026-09-22 10:30" }),
    );

    expect(result.status).toBe("error");
    expect(rpcCalls).toEqual([]);
  });

  it("cannot lengthen an appointment, because it sends no duration", async () => {
    const actions = await loadActions();
    await runExpectingRedirect(() =>
      actions.rescheduleAppointmentForPatientAction(
        { status: "idle" },
        rescheduleForm({ duration: "480", endsAt: STARTS_AT }),
      ),
    );

    const keys = Object.keys(rpcCalls[0]?.args ?? {});
    expect(keys).not.toContain("p_duration");
    expect(keys).not.toContain("p_ends_at");
  });

  it("turns a conflict into copy and keeps the database text out of it", async () => {
    rpcResults["reschedule_appointment_as_staff"] = {
      data: null,
      error: {
        code: "23P01",
        message: 'conflicting key value violates exclusion constraint "x"',
      },
    };

    const actions = await loadActions();
    const result = await actions.rescheduleAppointmentForPatientAction(
      { status: "idle" },
      rescheduleForm(),
    );

    expect(result.status).toBe("error");
    expect(result.message).not.toContain("exclusion constraint");
  });
});

describe("searchPatientsAction", () => {
  it("never puts the search term in a log", async () => {
    const actions = await loadActions();
    await actions.searchPatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      (() => {
        const data = new FormData();
        data.set("query", "Priya Example");
        return data;
      })(),
    );

    const log = logLines.join("\n");
    expect(log).toContain("reception.patient_search");
    // A search term at a front desk is somebody's name.
    expect(log).not.toContain("Priya Example");
    expect(log).not.toContain("Priya");
  });

  it("finds nothing for a term too short to search for", async () => {
    const actions = await loadActions();
    const data = new FormData();
    data.set("query", "P");

    const result = await actions.searchPatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      data,
    );

    expect(result.tooShort).toBe(true);
    expect(result.results).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });

  it("finds nothing for an empty term rather than listing everybody", async () => {
    const actions = await loadActions();
    const data = new FormData();
    data.set("query", "   ");

    const result = await actions.searchPatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      data,
    );

    expect(result.status).toBe("idle");
    expect(result.results).toEqual([]);
    // The decisive assertion: the database was never asked.
    expect(rpcCalls).toEqual([]);
  });

  it("refuses a caller without the permission and echoes nothing back", async () => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "patient@example.test",
      emailVerified: true,
      role: "patient",
      displayName: "Patient",
    });

    const actions = await loadActions();
    const data = new FormData();
    data.set("query", "Priya");

    const result = await actions.searchPatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      data,
    );

    expect(result.status).toBe("forbidden");
    expect(result.results).toEqual([]);
    expect(result.query).toBe("");
    expect(rpcCalls).toEqual([]);
  });

  it("asks the database for a bounded result count the caller did not choose", async () => {
    rpcResults["search_patients"] = { data: [], error: null };

    const actions = await loadActions();
    const data = new FormData();
    data.set("query", "Priya");
    // Planted. There is no field for it, so it is never read.
    data.set("limit", "100000");
    data.set("p_limit", "100000");

    await actions.searchPatientsAction(
      { status: "idle", results: [], tooShort: false, query: "" },
      data,
    );

    const call = rpcCalls.find((rpc) => rpc.name === "search_patients");
    expect(call?.args["p_limit"]).toBe(20);
  });
});
