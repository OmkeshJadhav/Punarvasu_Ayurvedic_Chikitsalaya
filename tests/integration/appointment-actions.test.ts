import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The appointment server actions.
 *
 * These assert the properties the whole patient booking experience rests on:
 *
 *   * an unauthenticated or unauthorized caller writes nothing;
 *   * no identifier, duration, status or timestamp is ever read from the
 *     request and passed on;
 *   * a database failure reaches the patient as a sentence, not as a
 *     PostgREST error, and reaches the log without their appointment in it;
 *   * a successful write revalidates the pages that show it.
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary. It proves the application never
 * *asks* for anything the database would have to refuse.
 *
 * The other half — that the database refuses independently — is a property of
 * `supabase/migrations/20260920120000_appointment_engine.sql`, and is asserted
 * structurally in `appointment-security.test.ts` and against a live project in
 * `docs/progress/progress_phase_09.md`. Both halves are needed. This is the
 * same split Phase 07 and Phase 08 recorded.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PRACTITIONER_ID = "22222222-2222-4222-8222-222222222222";
const TYPE_ID = "33333333-3333-4333-8333-333333333333";
const APPOINTMENT_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_PATIENT_ID = "55555555-5555-4555-8555-555555555555";

const STARTS_AT = "2026-09-22T10:30:00+05:30";

/** Every RPC the stubbed client was asked to make, in order. */
interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

let rpcCalls: RpcCall[] = [];
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };

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
      return rpcResult;
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

function bookingForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values: Record<string, string> = {
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

function cancelForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("appointmentId", APPOINTMENT_ID);
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

beforeEach(() => {
  vi.resetModules();
  rpcCalls = [];
  rpcResult = { data: APPOINTMENT_ID, error: null };
  logLines.length = 0;
  revalidatePath.mockClear();
  redirect.mockClear();

  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "patient@example.test",
    emailVerified: true,
    role: "patient",
    displayName: "Test Patient",
  });

  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logLines.push(String(line));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

const loadActions = () => import("@/features/appointments/actions");
const IDLE = { status: "idle" } as const;

describe("bookAppointmentAction", () => {
  it("books through the database function, deriving everything it can", async () => {
    const { bookAppointmentAction } = await loadActions();

    const digest = await runExpectingRedirect(() =>
      bookAppointmentAction(IDLE, bookingForm()),
    );

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe("book_appointment");
    expect(digest).toContain(`/patient/appointments/${APPOINTMENT_ID}`);
    expect(digest).toContain("requested=1");
  });

  it("passes no patient identity, duration, end time or status", async () => {
    // The central guarantee of `phase_09.md` sections 22-23 and 37-38. The
    // argument list is the whole allowlist, and it is asserted exactly rather
    // than checked for the absence of a few known-bad keys.
    const { bookAppointmentAction } = await loadActions();

    await runExpectingRedirect(() =>
      bookAppointmentAction(IDLE, bookingForm()),
    );

    expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_appointment_type_id",
      "p_patient_note",
      "p_practitioner_id",
      "p_starts_at",
    ]);
  });

  it("ignores a manipulated patient id, status, duration or end time", async () => {
    const { bookAppointmentAction } = await loadActions();

    await runExpectingRedirect(() =>
      bookAppointmentAction(
        IDLE,
        bookingForm({
          patientId: OTHER_PATIENT_ID,
          patient_id: OTHER_PATIENT_ID,
          userId: OTHER_PATIENT_ID,
          status: "confirmed",
          duration: "5",
          durationMinutes: "480",
          endsAt: "2026-09-22T23:59:00+05:30",
          internalNote: "escalate this",
          createdBy: OTHER_PATIENT_ID,
          role: "admin",
        }),
      ),
    );

    // The booking still succeeds — the extra fields are never *read*, because
    // the form is read through a fixed field list, so they cannot even reach
    // the schema.
    expect(rpcCalls).toHaveLength(1);

    const serialised = JSON.stringify(rpcCalls[0]?.args);
    for (const smuggled of [
      OTHER_PATIENT_ID,
      "confirmed",
      "480",
      "escalate this",
      "admin",
    ]) {
      expect(serialised).not.toContain(smuggled);
    }
  });

  it("normalises the start to an absolute instant", async () => {
    const { bookAppointmentAction } = await loadActions();

    await runExpectingRedirect(() =>
      bookAppointmentAction(IDLE, bookingForm()),
    );

    // The same moment, in UTC. The database decides which clinic day that is.
    expect(rpcCalls[0]?.args["p_starts_at"]).toBe("2026-09-22T05:00:00.000Z");
  });

  it("rejects a naive local time with no timezone", async () => {
    const { bookAppointmentAction } = await loadActions();

    const state = await bookAppointmentAction(
      IDLE,
      bookingForm({ startsAt: "2026-09-22 10:30" }),
    );

    expect(state.status).toBe("error");
    expect(rpcCalls).toHaveLength(0);
  });

  it("writes nothing for an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { bookAppointmentAction } = await loadActions();

    const state = await bookAppointmentAction(IDLE, bookingForm());

    expect(state.status).toBe("error");
    expect(state.message).toContain("sign in again");
    expect(rpcCalls).toHaveLength(0);
  });

  it.each(["receptionist", "doctor", "admin", null])(
    "writes nothing for a %s",
    async (role) => {
      getCurrentUser.mockResolvedValue({
        id: USER_ID,
        email: "staff@example.test",
        emailVerified: true,
        role,
        displayName: "Staff",
      });

      const { bookAppointmentAction } = await loadActions();
      const state = await bookAppointmentAction(IDLE, bookingForm());

      expect(state.status).toBe("error");
      expect(rpcCalls).toHaveLength(0);
      // The refusal names no role and no required permission
      // (`phase_08.md` section 12).
      expect(state.message).toBe("You don't have access to this.");
    },
  );

  it("turns a slot conflict into an answer the patient can act on", async () => {
    rpcResult = {
      data: null,
      error: {
        code: "23P01",
        message:
          'conflicting key value violates exclusion constraint "appointments_practitioner_no_overlap"',
      },
    };

    const { bookAppointmentAction } = await loadActions();
    const state = await bookAppointmentAction(IDLE, bookingForm());

    expect(state.status).toBe("error");
    expect(state.message).toContain("just been taken");
    expect(state.message).not.toContain("constraint");
    expect(state.message).not.toContain("appointments_practitioner_no_overlap");
  });

  it("never lets database text reach the patient or the log", async () => {
    rpcResult = {
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.appointments" does not exist',
      },
    };

    const { bookAppointmentAction } = await loadActions();
    const state = await bookAppointmentAction(IDLE, bookingForm());

    expect(state.status).toBe("error");
    expect(state.message).not.toContain("relation");
    expect(state.message).not.toContain("appointments");
    expect(logLines.join("\n")).not.toContain("does not exist");
  });

  it("logs the operation and an opaque user id, and nothing else", async () => {
    const { bookAppointmentAction } = await loadActions();

    await runExpectingRedirect(() =>
      bookAppointmentAction(
        IDLE,
        bookingForm({ patientNote: "Coming with my daughter Asha" }),
      ),
    );

    const log = logLines.join("\n");
    expect(log).toContain("appointment.requested");
    expect(log).toContain(USER_ID);

    // Not the note, not the time, not the practitioner
    // (`docs/SECURITY.md` section 15).
    expect(log).not.toContain("Asha");
    expect(log).not.toContain(STARTS_AT);
    expect(log).not.toContain(PRACTITIONER_ID);
    expect(log).not.toContain("patient@example.test");
  });

  it("refreshes the pages that show appointments", async () => {
    const { bookAppointmentAction } = await loadActions();

    await runExpectingRedirect(() =>
      bookAppointmentAction(IDLE, bookingForm()),
    );

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toContain("/patient/appointments");
    expect(paths).toContain("/patient");
  });

  it("does not redirect when the write failed", async () => {
    rpcResult = { data: null, error: { code: "PV002", message: "blocked" } };

    const { bookAppointmentAction } = await loadActions();
    const state = await bookAppointmentAction(IDLE, bookingForm());

    expect(state.status).toBe("error");
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("cancelAppointmentAction", () => {
  beforeEach(() => {
    rpcResult = { data: null, error: null };
  });

  it("cancels through the database function", async () => {
    const { cancelAppointmentAction } = await loadActions();
    const state = await cancelAppointmentAction(IDLE, cancelForm());

    expect(state.status).toBe("success");
    expect(rpcCalls[0]?.name).toBe("cancel_appointment");
    expect(rpcCalls[0]?.args).toEqual({
      p_appointment_id: APPOINTMENT_ID,
      p_reason: null,
    });
  });

  it("never deletes anything", async () => {
    // `phase_09.md` example 6. There is no delete path at all: the only call
    // made is the cancellation function.
    const { cancelAppointmentAction } = await loadActions();
    await cancelAppointmentAction(IDLE, cancelForm());

    expect(rpcCalls.map((call) => call.name)).toEqual(["cancel_appointment"]);
  });

  it("passes no status, patient or timestamp", async () => {
    const { cancelAppointmentAction } = await loadActions();

    await cancelAppointmentAction(
      IDLE,
      cancelForm({
        status: "completed",
        patientId: OTHER_PATIENT_ID,
        cancelledBy: OTHER_PATIENT_ID,
        cancelledAt: "2020-01-01T00:00:00Z",
      }),
    );

    expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_appointment_id",
      "p_reason",
    ]);
    expect(JSON.stringify(rpcCalls[0]?.args)).not.toContain(OTHER_PATIENT_ID);
  });

  it("answers the same way for a missing appointment and somebody else's", async () => {
    rpcResult = {
      data: null,
      error: { code: "PV009", message: "Appointment not found." },
    };

    const { cancelAppointmentAction } = await loadActions();
    const state = await cancelAppointmentAction(
      IDLE,
      cancelForm({ appointmentId: OTHER_PATIENT_ID }),
    );

    expect(state.message).toBe("We couldn't find that appointment.");
    expect(state.message).not.toMatch(/another|belongs|permission/i);
  });

  it.each(["receptionist", "doctor", "admin", null])(
    "writes nothing for a %s",
    async (role) => {
      getCurrentUser.mockResolvedValue({
        id: USER_ID,
        email: "staff@example.test",
        emailVerified: true,
        role,
        displayName: "Staff",
      });

      const { cancelAppointmentAction } = await loadActions();
      const state = await cancelAppointmentAction(IDLE, cancelForm());

      expect(state.status).toBe("error");
      expect(rpcCalls).toHaveLength(0);
    },
  );

  it("rejects an appointment id that is not an identifier", async () => {
    const { cancelAppointmentAction } = await loadActions();

    for (const hostile of ["", "1 or 1=1", "../../etc/passwd"]) {
      rpcCalls = [];
      const state = await cancelAppointmentAction(
        IDLE,
        cancelForm({ appointmentId: hostile }),
      );

      expect(state.status).toBe("error");
      expect(rpcCalls).toHaveLength(0);
    }
  });

  it("does not log the reason a patient gave", async () => {
    const { cancelAppointmentAction } = await loadActions();

    await cancelAppointmentAction(
      IDLE,
      cancelForm({ reason: "I am going into hospital that week" }),
    );

    expect(logLines.join("\n")).not.toContain("hospital");
    expect(logLines.join("\n")).toContain("appointment.cancelled");
  });
});

describe("rescheduleAppointmentAction", () => {
  beforeEach(() => {
    rpcResult = { data: null, error: null };
  });

  it("moves the appointment in place rather than cancelling and recreating", async () => {
    const { rescheduleAppointmentAction } = await loadActions();

    const digest = await runExpectingRedirect(() =>
      rescheduleAppointmentAction(IDLE, rescheduleForm()),
    );

    // One call, and it is the reschedule function — not a cancel followed by a
    // book (`phase_09.md` section 29).
    expect(rpcCalls.map((call) => call.name)).toEqual([
      "reschedule_appointment",
    ]);
    expect(digest).toContain(`/patient/appointments/${APPOINTMENT_ID}`);
    expect(digest).toContain("moved=1");
  });

  it("passes no duration, end time or status", async () => {
    const { rescheduleAppointmentAction } = await loadActions();

    await runExpectingRedirect(() =>
      rescheduleAppointmentAction(
        IDLE,
        rescheduleForm({
          endsAt: "2026-09-22T23:59:00+05:30",
          durationMinutes: "480",
          status: "confirmed",
        }),
      ),
    );

    expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_appointment_id",
      "p_starts_at",
    ]);
  });

  it("turns a conflict on the new time into a recoverable message", async () => {
    rpcResult = {
      data: null,
      error: { code: "23P01", message: "exclusion constraint" },
    };

    const { rescheduleAppointmentAction } = await loadActions();
    const state = await rescheduleAppointmentAction(IDLE, rescheduleForm());

    expect(state.status).toBe("error");
    expect(state.message).toContain("just been taken");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("reports an appointment that can no longer be moved", async () => {
    rpcResult = {
      data: null,
      error: { code: "PV008", message: "internal detail" },
    };

    const { rescheduleAppointmentAction } = await loadActions();
    const state = await rescheduleAppointmentAction(IDLE, rescheduleForm());

    expect(state.message).toBe("This appointment can no longer be changed.");
  });

  it.each(["receptionist", "doctor", "admin", null])(
    "writes nothing for a %s",
    async (role) => {
      getCurrentUser.mockResolvedValue({
        id: USER_ID,
        email: "staff@example.test",
        emailVerified: true,
        role,
        displayName: "Staff",
      });

      const { rescheduleAppointmentAction } = await loadActions();
      const state = await rescheduleAppointmentAction(IDLE, rescheduleForm());

      expect(state.status).toBe("error");
      expect(rpcCalls).toHaveLength(0);
    },
  );
});
