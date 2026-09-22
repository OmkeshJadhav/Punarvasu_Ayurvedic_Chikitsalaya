import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server-side identity resolution.
 *
 * These assert the properties the rest of the platform is going to rely on:
 * that identity comes from a verified call rather than a cookie, that the role
 * comes from the database, that an unresolvable session denies rather than
 * grants, and that a protected route redirects before it renders.
 */

const getUser = vi.fn();
const maybeSingle = vi.fn();
/**
 * Records the table the role was read from.
 *
 * Phase 08 moved the role out of `profiles` and into `user_roles`. The test
 * asserts the table by name rather than trusting the mock to be wired to the
 * right one — a role read from the wrong table would otherwise pass every
 * assertion below while authorizing nobody.
 */
const from = vi.fn();
const redirect = vi.fn((path: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;${path}`,
  });
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      from(table);
      return {
        select: () => ({
          eq: () => ({ limit: () => ({ maybeSingle }) }),
        }),
      };
    },
  }),
}));

const logLines: string[] = [];

const VERIFIED_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "patient@example.test",
  email_confirmed_at: "2026-09-01T10:00:00.000Z",
  user_metadata: { full_name: "Test Patient" },
  // Fields a page has no business receiving. Asserted absent from the DTO.
  app_metadata: { provider: "email", internal_flag: true },
  role: "authenticated",
  aud: "authenticated",
};

beforeEach(() => {
  vi.resetModules();
  logLines.length = 0;
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logLines.push(String(line));
    });
  }
  getUser.mockResolvedValue({ data: { user: VERIFIED_USER }, error: null });
  maybeSingle.mockResolvedValue({ data: { role: "patient" }, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadModule() {
  return import("@/lib/auth/current-user");
}

describe("getCurrentUser", () => {
  it("verifies the session with the auth server, not the cookie", async () => {
    const { getCurrentUser } = await loadModule();
    await getCurrentUser();

    // `getUser()` validates the access token upstream. `getSession()` only
    // decodes the cookie, which on the server is attacker-supplied data.
    expect(getUser).toHaveBeenCalled();
  });

  it("returns a narrow identity for a signed-in user", async () => {
    const { getCurrentUser } = await loadModule();
    const user = await getCurrentUser();

    expect(user).toEqual({
      id: VERIFIED_USER.id,
      email: "patient@example.test",
      emailVerified: true,
      role: "patient",
      displayName: "Test Patient",
    });
  });

  it("does not pass provider internals through to callers", async () => {
    const { getCurrentUser } = await loadModule();
    const user = await getCurrentUser();

    // A server component may hand this to a client component as a prop, so it
    // must carry nothing a browser should not see.
    expect(user).not.toHaveProperty("app_metadata");
    expect(user).not.toHaveProperty("user_metadata");
    expect(user).not.toHaveProperty("aud");
    expect(JSON.stringify(user)).not.toContain("internal_flag");
  });

  it("returns null when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { getCurrentUser } = await loadModule();
    expect(await getCurrentUser()).toBe(null);
  });

  it("reports an unconfirmed address rather than hiding it", async () => {
    getUser.mockResolvedValue({
      data: { user: { ...VERIFIED_USER, email_confirmed_at: null } },
      error: null,
    });

    const { getCurrentUser } = await loadModule();
    expect((await getCurrentUser())?.emailVerified).toBe(false);
  });

  describe("the role", () => {
    it("comes from the user_roles table, not from the session", async () => {
      maybeSingle.mockResolvedValue({ data: { role: "doctor" }, error: null });

      const { getCurrentUser } = await loadModule();
      expect((await getCurrentUser())?.role).toBe("doctor");
      // The authoritative store, named explicitly. `profiles` no longer has a
      // role column, and reading one from anywhere else would be reading it
      // from something the client can influence.
      expect(from).toHaveBeenCalledWith("user_roles");
      expect(from).not.toHaveBeenCalledWith("profiles");
    });

    it("is never taken from user metadata", async () => {
      // The classic privilege escalation: metadata is client-supplied at
      // sign-up, so a registration form that could set it would be able to
      // ask for the admin role.
      getUser.mockResolvedValue({
        data: {
          user: {
            ...VERIFIED_USER,
            user_metadata: { full_name: "Test Patient", role: "admin" },
            app_metadata: { role: "admin" },
          },
        },
        error: null,
      });
      maybeSingle.mockResolvedValue({ data: { role: "patient" }, error: null });

      const { getCurrentUser } = await loadModule();
      expect((await getCurrentUser())?.role).toBe("patient");
    });

    it("is null, not defaulted, when the lookup fails", async () => {
      maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "permission denied for table user_roles" },
      });

      const { getCurrentUser } = await loadModule();
      const user = await getCurrentUser();

      // Defaulting to `patient` would be an authorization decision taken on a
      // guess. `null` is what `lib/authorization/` reads as "no permissions".
      expect(user?.role).toBe(null);
      expect(user?.id).toBe(VERIFIED_USER.id);
    });

    it("is null when no role assignment row exists", async () => {
      maybeSingle.mockResolvedValue({ data: null, error: null });

      const { getCurrentUser } = await loadModule();
      expect((await getCurrentUser())?.role).toBe(null);
    });
  });

  describe("failing closed", () => {
    it("treats an unreachable provider as no session", async () => {
      getUser.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.4"));

      const { getCurrentUser } = await loadModule();
      expect(await getCurrentUser()).toBe(null);
    });

    it("treats unconfigured Supabase as no session", async () => {
      getUser.mockRejectedValue(
        new Error("NEXT_PUBLIC_SUPABASE_URL: is required"),
      );

      const { getCurrentUser } = await loadModule();
      expect(await getCurrentUser()).toBe(null);
      expect(logLines.join("\n")).toContain("auth.current_user_unavailable");
    });
  });

  describe("Next.js control-flow signals", () => {
    it.each([
      ["a dynamic-usage signal", "DYNAMIC_SERVER_USAGE"],
      ["a redirect", "NEXT_REDIRECT;/somewhere"],
      ["a not-found", "NEXT_NOT_FOUND"],
    ])(
      "re-throws %s rather than reporting an outage",
      async (_name, digest) => {
        // These are how Next.js communicates, not failures. Swallowing the
        // dynamic-usage one lets a protected route be prerendered as though
        // nobody were signed in - a cached page of one visitor's state.
        getUser.mockRejectedValue(
          Object.assign(new Error("signal"), { digest }),
        );

        const { getCurrentUser } = await loadModule();
        await expect(getCurrentUser()).rejects.toThrow("signal");
        expect(logLines.join(" ")).not.toContain(
          "auth.current_user_unavailable",
        );
      },
    );

    it("still treats a genuine failure as no session", async () => {
      getUser.mockRejectedValue(new Error("connect ECONNREFUSED"));

      const { getCurrentUser } = await loadModule();
      expect(await getCurrentUser()).toBe(null);
    });
  });

  describe("logging", () => {
    it("records no email address when a role lookup fails", async () => {
      maybeSingle.mockResolvedValue({
        data: null,
        error: { message: "permission denied" },
      });

      const { getCurrentUser } = await loadModule();
      await getCurrentUser();

      const combined = logLines.join("\n");
      expect(combined).toContain("auth.role_lookup_failed");
      // An authentication log that records addresses is a patient list.
      expect(combined).not.toContain("patient@example.test");
    });
  });
});

describe("requireUser", () => {
  it("returns the user when one is signed in", async () => {
    const { requireUser } = await loadModule();
    const user = await requireUser("/account");

    expect(user.id).toBe(VERIFIED_USER.id);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to sign in when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { requireUser } = await loadModule();
    await expect(requireUser("/patient/profile")).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith(
      "/auth/login?next=%2Fpatient%2Fprofile",
    );
  });

  it("throws rather than returning, so no protected content is rendered", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { requireUser } = await loadModule();
    // If this resolved instead of throwing, a page could render with an
    // undefined user and only navigate away afterwards.
    await expect(requireUser("/account")).rejects.toThrow();
  });

  it("refuses to carry an unsafe destination into the sign-in URL", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { requireUser } = await loadModule();
    await expect(requireUser("https://evil.example/steal")).rejects.toThrow();

    expect(redirect).toHaveBeenCalledWith("/auth/login");
    expect(redirect).not.toHaveBeenCalledWith(
      expect.stringContaining("evil.example"),
    );
  });

  it("redirects when the session cannot be resolved at all", async () => {
    getUser.mockRejectedValue(new Error("provider down"));

    const { requireUser } = await loadModule();
    await expect(requireUser("/account")).rejects.toThrow("NEXT_REDIRECT");
  });
});
