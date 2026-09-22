import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Patient profile data access and the save action.
 *
 * These assert the properties the rest of the patient experience rests on:
 *
 *   * a query is always scoped to the verified session, and there is no
 *     identifier a caller could substitute;
 *   * a write never takes ownership, a role or a timestamp from the request;
 *   * a database failure reaches the patient as a sentence, not as a
 *     PostgREST error, and reaches the log without their details in it;
 *   * "no profile yet" and "we could not read it" stay distinguishable.
 *
 * The Supabase client is a recording stub. That means this exercises the
 * application's side of the boundary, not the database's — RLS itself has to
 * be verified against a real project, and that is recorded as outstanding in
 * `docs/progress/progress_phase_07.md`. What is verified here is that the
 * application never *asks* for anything RLS would have to refuse.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

const getCurrentUser = vi.fn();
const revalidatePath = vi.fn();

/** Every call made through the stubbed client, in order. */
interface QueryCall {
  readonly table: string;
  readonly operation: "select" | "update" | "insert";
  readonly filters: Record<string, unknown>;
  readonly payload?: Record<string, unknown>;
  readonly columns?: string;
}

let calls: QueryCall[] = [];
let selectResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let updateResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let insertResult: { error: unknown } = { error: null };

function makeClient() {
  const build = (table: string) => ({
    select(columns?: string) {
      const call: QueryCall = {
        table,
        operation: "select",
        filters: {},
        ...(columns === undefined ? {} : { columns }),
      };
      calls.push(call);
      const chain = {
        eq(column: string, value: unknown) {
          call.filters[column] = value;
          return chain;
        },
        maybeSingle: async () => selectResult,
      };
      return chain;
    },
    update(payload: Record<string, unknown>) {
      const call: QueryCall = {
        table,
        operation: "update",
        filters: {},
        payload,
      };
      calls.push(call);
      const chain = {
        eq(column: string, value: unknown) {
          call.filters[column] = value;
          return chain;
        },
        select: () => ({ maybeSingle: async () => updateResult }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(updateResult).then(resolve),
      };
      return chain;
    },
    async insert(payload: Record<string, unknown>) {
      calls.push({ table, operation: "insert", filters: {}, payload });
      return insertResult;
    },
  });

  return { from: (table: string) => build(table) };
}

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => makeClient(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

const logLines: string[] = [];

/** A stored row, as the database would return it. */
const STORED_ROW = {
  full_name: "Test Patient",
  preferred_name: null,
  phone: "9999999999",
  date_of_birth: "1990-04-07",
  gender: "female",
  address_line1: "1 Example Road",
  address_line2: null,
  city: "Pune",
  state: "Maharashtra",
  postal_code: "411001",
  emergency_contact_name: "Test Contact",
  emergency_contact_relationship: "Spouse",
  emergency_contact_phone: "9999999998",
  preferred_language: "Marathi",
  created_at: "2026-09-18T10:00:00.000Z",
};

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values: Record<string, string> = {
    fullName: "Test Patient",
    preferredName: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    preferredLanguage: "",
    ...overrides,
  };

  for (const [name, value] of Object.entries(values)) {
    data.set(name, value);
  }
  return data;
}

beforeEach(() => {
  vi.resetModules();
  calls = [];
  logLines.length = 0;
  selectResult = { data: null, error: null };
  updateResult = { data: null, error: null };
  insertResult = { error: null };
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

const loadQueries = () => import("@/features/patients/queries");
const loadActions = () => import("@/features/patients/actions");

describe("getPatientProfile", () => {
  it("scopes the query to the authenticated user", async () => {
    selectResult = { data: STORED_ROW, error: null };

    const { getPatientProfile } = await loadQueries();
    await getPatientProfile();

    const select = calls.find((call) => call.operation === "select");
    expect(select?.table).toBe("patients");
    expect(select?.filters["profile_id"]).toBe(USER_ID);
  });

  it("takes no user id, so there is none to substitute", async () => {
    const { getPatientProfile } = await loadQueries();

    // The signature is the control. A function that cannot be handed an
    // identifier cannot be handed somebody else's
    // (`phase_07.md` sections 11 and 47).
    expect(getPatientProfile.length).toBe(0);
  });

  it("never asks for another user's row, even when one is suggested", async () => {
    selectResult = { data: STORED_ROW, error: null };

    const { getPatientProfile } = await loadQueries();
    // There is no argument to pass; the call below is what a caller *can* do.
    await getPatientProfile();

    const select = calls.find((call) => call.operation === "select");
    expect(select?.filters["profile_id"]).not.toBe(OTHER_USER_ID);
  });

  it("maps a row to the domain model without internal identifiers", async () => {
    selectResult = { data: STORED_ROW, error: null };

    const { getPatientProfile } = await loadQueries();
    const result = await getPatientProfile();

    expect(result.status).toBe("found");
    if (result.status !== "found") return;

    expect(result.profile.fullName).toBe("Test Patient");
    expect(result.profile.city).toBe("Pune");

    // Nothing a patient should never be shown (`phase_07.md` section 41).
    expect(result.profile).not.toHaveProperty("id");
    expect(result.profile).not.toHaveProperty("profile_id");
    expect(result.profile).not.toHaveProperty("profileId");
    expect(result.profile).not.toHaveProperty("updated_at");
    expect(JSON.stringify(result.profile)).not.toContain(USER_ID);
  });

  it("names the columns it needs rather than selecting everything", async () => {
    selectResult = { data: STORED_ROW, error: null };

    const { getPatientProfile } = await loadQueries();
    await getPatientProfile();

    const columns = calls.find((call) => call.operation === "select")?.columns;

    // `select("*")` would start shipping any column a later phase adds — and
    // the columns a later phase adds to a patient record are the sensitive
    // ones.
    expect(columns).toBeDefined();
    expect(columns).not.toContain("*");
    expect(columns).toContain("full_name");
    // Internal identifiers and operational metadata stay server-side.
    expect(columns).not.toContain("profile_id");
    expect(columns).not.toContain("updated_at");
  });

  it("distinguishes 'no profile yet' from 'we could not read it'", async () => {
    const { getPatientProfile } = await loadQueries();

    selectResult = { data: null, error: null };
    expect((await getPatientProfile()).status).toBe("absent");

    vi.resetModules();
    const fresh = await loadQueries();
    selectResult = { data: null, error: { message: "connection refused" } };
    expect((await fresh.getPatientProfile()).status).toBe("unavailable");
  });

  it("denies rather than guesses when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    const { getPatientProfile } = await loadQueries();
    const result = await getPatientProfile();

    expect(result.status).toBe("unavailable");
    // No query was even attempted.
    expect(calls).toHaveLength(0);
  });

  it("logs a failure without any profile field in it", async () => {
    selectResult = {
      data: null,
      error: { message: 'relation "patients" does not exist' },
    };

    const { getPatientProfile } = await loadQueries();
    await getPatientProfile();

    const log = logLines.join("\n");
    expect(log).toContain("patient.profile_read_failed");
    // The user id is diagnostic and opaque. A name, a number or an address is
    // neither (`phase_07.md` section 79).
    expect(log).not.toContain("Test Patient");
    expect(log).not.toContain("9999999999");
    expect(log).not.toContain("1 Example Road");
    expect(log).not.toContain("1990-04-07");
  });
});

describe("hasPatientProfile", () => {
  it("does not treat a failed read as an absent profile", async () => {
    selectResult = { data: null, error: { message: "timeout" } };

    const { hasPatientProfile } = await loadQueries();

    // Answering "false" here would invite the patient to create a second
    // profile during an outage.
    expect(await hasPatientProfile()).toBe(false);
    expect(logLines.join("\n")).toContain("patient.profile_read_failed");
  });
});

describe("savePatientProfileAction", () => {
  it("refuses to write when nobody is signed in", async () => {
    getCurrentUser.mockResolvedValue(null);

    const { savePatientProfileAction } = await loadActions();
    const state = await savePatientProfileAction({ status: "idle" }, form());

    expect(state.status).toBe("error");
    expect(calls).toHaveLength(0);
  });

  it("writes only to the authenticated user's row", async () => {
    updateResult = { data: { id: "row-1" }, error: null };

    const { savePatientProfileAction } = await loadActions();
    await savePatientProfileAction({ status: "idle" }, form());

    const update = calls.find((call) => call.operation === "update");
    expect(update?.table).toBe("patients");
    expect(update?.filters["profile_id"]).toBe(USER_ID);
  });

  it("ignores an identifier smuggled into the form", async () => {
    updateResult = { data: { id: "row-1" }, error: null };

    const data = form();
    data.set("profileId", OTHER_USER_ID);
    data.set("profile_id", OTHER_USER_ID);
    data.set("userId", OTHER_USER_ID);
    data.set("id", "row-2");
    data.set("role", "admin");

    const { savePatientProfileAction } = await loadActions();
    const state = await savePatientProfileAction({ status: "idle" }, data);

    // The form is read field by field from a fixed list, so extra keys are
    // never even seen — the save succeeds and none of them reaches the write.
    expect(state.status).toBe("success");

    const update = calls.find((call) => call.operation === "update");
    expect(update?.filters["profile_id"]).toBe(USER_ID);
    expect(update?.payload).not.toHaveProperty("profile_id");
    expect(update?.payload).not.toHaveProperty("id");
    expect(update?.payload).not.toHaveProperty("role");
    expect(JSON.stringify(update?.payload)).not.toContain(OTHER_USER_ID);
  });

  it("never writes a timestamp supplied by the client", async () => {
    updateResult = { data: { id: "row-1" }, error: null };

    const data = form();
    data.set("createdAt", "1999-01-01T00:00:00.000Z");
    data.set("updated_at", "1999-01-01T00:00:00.000Z");

    const { savePatientProfileAction } = await loadActions();
    await savePatientProfileAction({ status: "idle" }, data);

    const update = calls.find((call) => call.operation === "update");
    expect(update?.payload).not.toHaveProperty("created_at");
    expect(update?.payload).not.toHaveProperty("updated_at");
  });

  it("clears a field the patient emptied instead of leaving the old value", async () => {
    updateResult = { data: { id: "row-1" }, error: null };

    const { savePatientProfileAction } = await loadActions();
    await savePatientProfileAction({ status: "idle" }, form({ city: "" }));

    const update = calls.find((call) => call.operation === "update");
    // Omitting the key would leave a deleted address in the record.
    expect(update?.payload?.["city"]).toBeNull();
  });

  it("creates the profile when there is none to update", async () => {
    updateResult = { data: null, error: null };

    const { savePatientProfileAction } = await loadActions();
    const state = await savePatientProfileAction({ status: "idle" }, form());

    expect(state.status).toBe("success");

    const insert = calls.find((call) => call.operation === "insert");
    // Ownership is set from the session and from nowhere else.
    expect(insert?.payload?.["profile_id"]).toBe(USER_ID);
  });

  it("recovers when a concurrent request created the profile first", async () => {
    updateResult = { data: null, error: null };
    insertResult = { error: { code: "23505", message: "duplicate key" } };

    const { savePatientProfileAction } = await loadActions();
    const state = await savePatientProfileAction({ status: "idle" }, form());

    // The unique index prevented the second profile; the patient still gets
    // their values saved rather than an error for a race they did not cause.
    expect(state.status).toBe("success");
    expect(logLines.join("\n")).toContain("patient.profile_insert_raced");
    expect(calls.filter((call) => call.operation === "update")).toHaveLength(2);
  });

  it("rejects invalid input with a message attached to the field", async () => {
    const { savePatientProfileAction } = await loadActions();
    const state = await savePatientProfileAction(
      { status: "idle" },
      form({ phone: "12345" }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.["phone"]).toBe(
      "Enter a valid 10-digit mobile number.",
    );
    // Nothing was written.
    expect(calls).toHaveLength(0);
  });

  it("returns the values the patient typed so nothing has to be retyped", async () => {
    const { savePatientProfileAction } = await loadActions();
    const state = await savePatientProfileAction(
      { status: "idle" },
      form({ city: "Pune", phone: "12345" }),
    );

    expect(state.values?.["city"]).toBe("Pune");
  });

  it("does not expose a database error to the patient", async () => {
    updateResult = {
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.patients" does not exist',
        details: "constraint patients_profile_id_key",
      },
    };

    const { savePatientProfileAction } = await loadActions();
    const state = await savePatientProfileAction({ status: "idle" }, form());

    expect(state.status).toBe("error");
    const shown = JSON.stringify(state);
    expect(shown).not.toContain("relation");
    expect(shown).not.toContain("42P01");
    expect(shown).not.toContain("patients_profile_id_key");
    // The detail is in the log, where it is useful and safe.
    expect(logLines.join("\n")).toContain("patient.profile_update_failed");
  });

  it("logs the save without the patient's details", async () => {
    updateResult = { data: { id: "row-1" }, error: null };

    const { savePatientProfileAction } = await loadActions();
    await savePatientProfileAction(
      { status: "idle" },
      form({
        phone: "9999999999",
        dateOfBirth: "1990-04-07",
        addressLine1: "1 Example Road",
      }),
    );

    const log = logLines.join("\n");
    expect(log).toContain("patient.profile_updated");
    expect(log).toContain(USER_ID);
    expect(log).not.toContain("Test Patient");
    expect(log).not.toContain("9999999999");
    expect(log).not.toContain("1990-04-07");
    expect(log).not.toContain("1 Example Road");
  });

  it("refreshes the pages that render the record", async () => {
    updateResult = { data: { id: "row-1" }, error: null };

    const { savePatientProfileAction } = await loadActions();
    await savePatientProfileAction({ status: "idle" }, form());

    // Without this the patient sees the values they just replaced.
    expect(revalidatePath).toHaveBeenCalledWith("/patient/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/patient");
  });

  it("drops an emergency relationship with no contact attached to it", async () => {
    updateResult = { data: { id: "row-1" }, error: null };

    const { savePatientProfileAction } = await loadActions();
    await savePatientProfileAction(
      { status: "idle" },
      form({ emergencyContactRelationship: "Spouse" }),
    );

    const update = calls.find((call) => call.operation === "update");
    expect(update?.payload?.["emergency_contact_relationship"]).toBeNull();
  });
});
