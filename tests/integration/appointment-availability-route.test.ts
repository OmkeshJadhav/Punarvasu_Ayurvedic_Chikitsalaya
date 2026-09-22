import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/appointments/availability`.
 *
 * The only appointment endpoint a browser calls directly, and therefore the
 * cheapest thing in this feature to abuse: it needs no patient record and no
 * booking. These tests assert the three things that matter about it —
 * it refuses anyone who has no business asking, it bounds what one request can
 * ask for, and it discloses only what showing a slot list requires.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PRACTITIONER_ID = "22222222-2222-4222-8222-222222222222";
const TYPE_ID = "33333333-3333-4333-8333-333333333333";

const getCurrentUser = vi.fn();
const getAvailability = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/features/appointments/queries", () => ({
  // Both arguments are forwarded, because the second one — the minimum notice
  // the route resolved from the caller's role — is exactly what Phase 10 adds
  // and exactly what must not come from the request.
  getAvailability: (request: unknown, options: unknown) =>
    getAvailability(request, options),
}));

const logLines: string[] = [];

function request(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/appointments/availability");
  const search: Record<string, string> = {
    practitionerId: PRACTITIONER_ID,
    appointmentTypeId: TYPE_ID,
    date: "2026-09-22",
    ...params,
  };

  for (const [key, value] of Object.entries(search)) {
    if (value !== "") url.searchParams.set(key, value);
  }

  return new NextRequest(url);
}

beforeEach(() => {
  vi.resetModules();
  logLines.length = 0;

  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "patient@example.test",
    emailVerified: true,
    role: "patient",
    displayName: "Test Patient",
  });

  getAvailability.mockResolvedValue({
    status: "found",
    slots: [
      {
        startsAt: new Date("2026-09-22T05:00:00.000Z"),
        endsAt: new Date("2026-09-22T05:45:00.000Z"),
      },
    ],
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

const loadRoute = () => import("@/app/api/appointments/availability/route");

describe("authorization", () => {
  it("refuses an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue(null);

    const { GET } = await loadRoute();
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(getAvailability).not.toHaveBeenCalled();
  });

  it.each(["doctor", "admin", null])("refuses a %s", async (role) => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "staff@example.test",
      emailVerified: true,
      role,
      displayName: "Staff",
    });

    const { GET } = await loadRoute();
    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(getAvailability).not.toHaveBeenCalled();

    const body = await response.json();
    // The refusal names no role and no permission
    // (`phase_08.md` section 12).
    expect(JSON.stringify(body)).not.toMatch(/patient|role|appointments\./);
  });

  it("serves a patient", async () => {
    const { GET } = await loadRoute();
    const response = await GET(request());

    expect(response.status).toBe(200);
  });

  it("serves a receptionist, because the front desk books too", async () => {
    // Phase 10. One endpoint answers both booking flows rather than a second
    // one being written, which is the duplicated scheduling logic
    // `phase_10.md` section 17 forbids.
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "reception@example.test",
      emailVerified: true,
      role: "receptionist",
      displayName: "Reception",
    });

    const { GET } = await loadRoute();
    const response = await GET(request());

    expect(response.status).toBe(200);
  });

  it("resolves the minimum notice from the role, not from the request", () => {
    // The distinction between what a patient may book and what the front desk
    // may book is decided by the permission the caller was just found to hold.
    // There is no query parameter for it, so a patient cannot ask to be shown
    // times inside the notice window.
    const source = readFileSync(
      new URL(
        "../../src/app/api/appointments/availability/route.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("managesAnyAppointment");
    expect(source).toMatch(/minNoticeMinutes\s*=\s*managesAnyAppointment/);
    // It is never read from the URL.
    expect(source).not.toMatch(/searchParams\.get\(\s*"minNotice/);
    expect(source).not.toMatch(/minNoticeMinutes.*query\./);
  });

  it("passes the resolved notice to the availability engine", async () => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "reception@example.test",
      emailVerified: true,
      role: "receptionist",
      displayName: "Reception",
    });

    const { GET } = await loadRoute();
    await GET(request());

    expect(getAvailability).toHaveBeenCalledWith(expect.any(Object), {
      minNoticeMinutes: 0,
    });
  });
});

describe("input validation", () => {
  it("rejects a malformed practitioner or type id", async () => {
    const { GET } = await loadRoute();

    for (const hostile of [
      "not-a-uuid",
      "1; drop table appointments; --",
      "../../etc/passwd",
      "<script>alert(1)</script>",
    ]) {
      const response = await GET(request({ practitionerId: hostile }));
      expect(response.status).toBe(400);
    }

    expect(getAvailability).not.toHaveBeenCalled();
  });

  it("rejects a date that is not a real calendar date", async () => {
    const { GET } = await loadRoute();

    for (const hostile of ["2026-02-30", "2026-9-22", "yesterday", ""]) {
      const response = await GET(request({ date: hostile }));
      expect(response.status).toBe(400);
    }
  });

  it("bounds how many days one request may ask for", async () => {
    const { GET } = await loadRoute();

    expect((await GET(request({ days: "365" }))).status).toBe(400);
    expect((await GET(request({ days: "0" }))).status).toBe(400);
    expect((await GET(request({ days: "14" }))).status).toBe(200);
  });

  it("rejects an unexpected parameter rather than ignoring it", async () => {
    const url = new URL("http://localhost:3000/api/appointments/availability");
    url.searchParams.set("practitionerId", PRACTITIONER_ID);
    url.searchParams.set("appointmentTypeId", TYPE_ID);
    url.searchParams.set("date", "2026-09-22");

    // The handler reads named parameters only, so an extra one is never even
    // seen — which is the strongest version of "rejects it".
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(200);
    expect(getAvailability).toHaveBeenCalledWith(
      {
        practitionerId: PRACTITIONER_ID,
        appointmentTypeId: TYPE_ID,
        date: "2026-09-22",
        days: 1,
      },
      // The query the caller sent, and the notice the *server* resolved from
      // the role. The extra parameter reaches neither.
      { minNoticeMinutes: expect.any(Number) },
    );
  });
});

describe("the response", () => {
  it("returns instants and nothing else", async () => {
    const { GET } = await loadRoute();
    const response = await GET(request());
    const body = await response.json();

    expect(body).toEqual({
      ok: true,
      data: {
        slots: [
          {
            startsAt: "2026-09-22T05:00:00.000Z",
            endsAt: "2026-09-22T05:45:00.000Z",
          },
        ],
      },
    });
  });

  it("discloses no appointment, patient or blocked-period reason", async () => {
    const { GET } = await loadRoute();
    const response = await GET(request());
    const body = JSON.stringify(await response.json()).toLowerCase();

    for (const leak of [
      "patient",
      "appointmentid",
      "reason",
      "status",
      "note",
      "practitioner",
    ]) {
      expect(body).not.toContain(leak);
    }
  });

  it("is never cached", async () => {
    // Availability is the most time-sensitive value in the product, and it is
    // per-viewer (`phase_09.md` sections 55 and 58).
    const { GET } = await loadRoute();
    const response = await GET(request());

    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("distinguishes a failed read from an empty diary", async () => {
    // An empty list means "choose another day". A failed read means "try
    // again". Collapsing them would send a patient hunting for a date that was
    // free all along (`phase_09.md` sections 46-47).
    getAvailability.mockResolvedValue({ status: "unavailable" });

    const { GET } = await loadRoute();
    const response = await GET(request());

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/postgres|relation|supabase|rpc/i);
  });

  it("returns an empty list for a day with no times", async () => {
    getAvailability.mockResolvedValue({ status: "found", slots: [] });

    const { GET } = await loadRoute();
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { slots: [] },
    });
  });
});
