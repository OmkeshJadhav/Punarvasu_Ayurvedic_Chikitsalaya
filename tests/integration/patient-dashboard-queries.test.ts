/**
 * The two queries Phase 18 added, exercised rather than read.
 *
 * `tests/integration/patient-experience.test.ts` asserts their *shape* against
 * the source — that the bound is in the statement, that the filter excludes
 * cancelled appointments. These assert their *behaviour*: what they ask the
 * database for, what they hand back, and what they do when the read fails.
 *
 * Both matter. A structural test catches the bound being deleted; a
 * behavioural test catches it being present and wrong.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Every filter the stubbed query builder was asked to apply, in order. */
interface QueryCall {
  readonly table: string;
  readonly columns: string;
  readonly filters: string[];
  readonly limit: number | null;
}

let calls: QueryCall[] = [];
let queryResult: { data: unknown; error: unknown } = { data: [], error: null };

const getCurrentUser = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/authorization/guards", () => ({
  assertPermission: async () => ({ id: "user-1", role: "patient" }),
}));

/**
 * A minimal PostgREST-shaped builder.
 *
 * It records what was asked for and is thenable, so `await query` and
 * `await query.returns<T>()` both resolve — the two shapes the query layer
 * uses.
 */
function makeBuilder(table: string) {
  const call: {
    table: string;
    columns: string;
    filters: string[];
    limit: number | null;
  } = { table, columns: "", filters: [], limit: null };
  calls.push(call as QueryCall);

  const builder = {
    select(columns: string) {
      call.columns = columns;
      return builder;
    },
    eq(column: string, value: unknown) {
      call.filters.push(`eq:${column}=${String(value)}`);
      return builder;
    },
    neq(column: string, value: unknown) {
      call.filters.push(`neq:${column}=${String(value)}`);
      return builder;
    },
    gte(column: string, value: unknown) {
      call.filters.push(`gte:${column}=${String(value)}`);
      return builder;
    },
    is(column: string, value: unknown) {
      call.filters.push(`is:${column}=${String(value)}`);
      return builder;
    },
    in(column: string, values: readonly unknown[]) {
      call.filters.push(`in:${column}=${values.join(",")}`);
      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      call.filters.push(
        `order:${column}:${options?.ascending ? "asc" : "desc"}`,
      );
      return builder;
    },
    limit(value: number) {
      call.limit = value;
      return builder;
    },
    returns() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(queryResult);
    },
    then(
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(queryResult).then(resolve, reject);
    },
  };

  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => makeBuilder(table),
  }),
}));

const { getNextAppointment } = await import("@/features/appointments/queries");
const { listRecentNotifications } =
  await import("@/features/notifications/queries");

beforeEach(() => {
  calls = [];
  queryResult = { data: [], error: null };
  getCurrentUser.mockResolvedValue({ id: "user-1", role: "patient" });
});

afterEach(() => {
  vi.clearAllMocks();
});

function callFor(table: string): QueryCall | undefined {
  return calls.find((call) => call.table === table);
}

describe("getNextAppointment", () => {
  const NOW = new Date("2026-10-01T09:00:00.000Z");

  it("asks for exactly one row", () => {
    // Sections 81 and 94: a dashboard that shows one appointment must not read
    // every appointment the patient has ever had.
    return getNextAppointment(NOW).then(() => {
      expect(callFor("appointments")?.limit).toBe(1);
    });
  });

  it("asks the database for the soonest, rather than sorting in JavaScript", async () => {
    await getNextAppointment(NOW);
    expect(callFor("appointments")?.filters).toContain("order:starts_at:asc");
  });

  it("excludes cancelled appointments in the statement", async () => {
    await getNextAppointment(NOW);
    expect(callFor("appointments")?.filters).toContain("neq:status=cancelled");
  });

  it("includes an appointment already under way", async () => {
    // It filters on `ends_at`, matching `groupAppointments` exactly — a
    // consultation in progress is still the patient's next appointment, and
    // dropping it while they sit in the room would be strange.
    await getNextAppointment(NOW);
    const filters = callFor("appointments")?.filters ?? [];
    expect(filters.some((f) => f.startsWith("gte:ends_at="))).toBe(true);
    expect(filters.some((f) => f.startsWith("gte:starts_at="))).toBe(false);
  });

  it("names its columns rather than selecting everything", async () => {
    // `internal_note` has no column grant, so `select *` would fail outright —
    // but naming them makes that explicit rather than incidental.
    await getNextAppointment(NOW);
    const columns = callFor("appointments")?.columns ?? "";
    expect(columns).not.toBe("*");
    expect(columns).not.toMatch(/internal_note/);
  });

  it("reports not_found when there is nothing upcoming", async () => {
    queryResult = { data: [], error: null };
    await expect(getNextAppointment(NOW)).resolves.toEqual({
      status: "not_found",
    });
  });

  it("reports unavailable when the read fails, never not_found", async () => {
    // The distinction the whole dashboard rests on.
    queryResult = { data: null, error: { message: "boom" } };
    const result = await getNextAppointment(NOW);
    expect(result.status).toBe("unavailable");
  });

  it("reports unavailable when there is no session", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(getNextAppointment(NOW)).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("passes no patient identifier of any kind", async () => {
    await getNextAppointment(NOW);
    const filters = callFor("appointments")?.filters ?? [];

    // Row-level security scopes the table. Nothing here narrows it by an id,
    // so there is no id for a caller to substitute.
    for (const filter of filters) {
      expect(filter).not.toMatch(/patient_id|profile_id|user_id/);
    }
  });
});

describe("listRecentNotifications", () => {
  it("asks for the number it was given", async () => {
    await listRecentNotifications(3);
    expect(callFor("notifications")?.limit).toBe(3);
  });

  it("clamps a caller asking for far too many", async () => {
    // The bound is in the query, not only at the call site, so a computed
    // argument cannot turn a summary panel into an unbounded read.
    await listRecentNotifications(10_000);
    expect(callFor("notifications")?.limit).toBe(5);
  });

  it("clamps a caller asking for none", async () => {
    await listRecentNotifications(0);
    expect(callFor("notifications")?.limit).toBe(1);
  });

  it("clamps a negative request", async () => {
    await listRecentNotifications(-5);
    expect(callFor("notifications")?.limit).toBe(1);
  });

  it("orders newest first", async () => {
    await listRecentNotifications(3);
    expect(callFor("notifications")?.filters).toContain(
      "order:created_at:desc",
    );
  });

  it("does not filter by read state — a glance shows both", async () => {
    await listRecentNotifications(3);
    const filters = callFor("notifications")?.filters ?? [];
    expect(filters.some((f) => f.startsWith("is:read_at"))).toBe(false);
  });

  it("returns an empty list rather than failing when there is nothing", async () => {
    queryResult = { data: [], error: null };
    await expect(listRecentNotifications(3)).resolves.toEqual({
      status: "ok",
      notifications: [],
    });
  });

  it("reports unavailable when the read fails", async () => {
    queryResult = { data: null, error: { message: "boom" } };
    const result = await listRecentNotifications(3);
    expect(result.status).toBe("unavailable");
  });

  it("passes no user identifier", async () => {
    await listRecentNotifications(3);
    for (const filter of callFor("notifications")?.filters ?? []) {
      expect(filter).not.toMatch(/recipient_user_id|user_id/);
    }
  });
});
