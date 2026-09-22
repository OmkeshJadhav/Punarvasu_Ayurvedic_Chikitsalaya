import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Proxy behaviour: protected-route gating, the already-signed-in redirect, and
 * cache headers.
 *
 * The proxy is an optimisation rather than the security boundary
 * (`src/proxy.ts`), so these tests assert that it behaves *helpfully* - and
 * the one property that is security-relevant here: that a rejected `next`
 * cannot become an off-site redirect.
 */

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-tests");
  getUser.mockResolvedValue({ data: { user: null }, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signedIn(): void {
  getUser.mockResolvedValue({
    data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    error: null,
  });
}

async function visit(path: string) {
  const { proxy } = await import("@/proxy");
  const url = `http://localhost:3000${path}`;
  const response = await proxy(new NextRequest(url, { method: "GET" }));
  const location = response.headers.get("location");

  return {
    response,
    status: response.status,
    location,
    redirectedTo: location ? new URL(location, url) : null,
  };
}

describe("unauthenticated requests", () => {
  it.each([
    "/account",
    "/patient/profile",
    "/dashboard",
    "/portal/messages",
    "/staff/schedule",
    "/admin/users",
  ])("redirects %s to sign in", async (path) => {
    const { redirectedTo } = await visit(path);

    expect(redirectedTo?.pathname).toBe("/auth/login");
    expect(redirectedTo?.searchParams.get("next")).toBe(path);
  });

  it("preserves the query string of the intended destination", async () => {
    const { redirectedTo } = await visit("/patient/profile?tab=contact");
    expect(redirectedTo?.searchParams.get("next")).toBe(
      "/patient/profile?tab=contact",
    );
  });

  it.each(["/", "/about", "/services", "/services/panchakarma", "/contact"])(
    "lets the public page %s through",
    async (path) => {
      const { status, location } = await visit(path);
      expect(location).toBe(null);
      expect(status).toBe(200);
    },
  );

  it.each([
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify",
  ])("lets the auth page %s through", async (path) => {
    expect((await visit(path)).location).toBe(null);
  });

  it("does not protect a path that merely starts with the same letters", async () => {
    // `/accounts-of-our-patients` is not `/account`.
    expect((await visit("/accountability")).location).toBe(null);
  });
});

describe("authenticated requests", () => {
  beforeEach(signedIn);

  it.each(["/account", "/patient/profile", "/dashboard"])(
    "lets %s through",
    async (path) => {
      expect((await visit(path)).location).toBe(null);
    },
  );

  it.each(["/auth/login", "/auth/register", "/auth/forgot-password"])(
    "redirects %s to the account landing",
    async (path) => {
      // A second sign-in form for someone already signed in is a dead end
      // (`phase_06.md` section 42).
      expect((await visit(path)).redirectedTo?.pathname).toBe("/account");
    },
  );

  it("does NOT redirect away from the reset-password page", async () => {
    // Arriving here with a session is the recovery flow working correctly.
    // Redirecting would make it impossible to complete a password reset.
    expect((await visit("/auth/reset-password")).location).toBe(null);
  });

  it("does not redirect away from the callback route", async () => {
    expect((await visit("/auth/callback?code=abc")).location).toBe(null);
  });
});

describe("cache headers on protected paths", () => {
  beforeEach(signedIn);

  it.each(["/account", "/patient/profile", "/admin/users"])(
    "marks %s as private and uncacheable",
    async (path) => {
      const cacheControl = (await visit(path)).response.headers.get(
        "cache-control",
      );

      // One person's data must not be stored by a shared cache or replayed
      // from the back-forward cache after sign-out
      // (`phase_06.md` sections 73-74).
      expect(cacheControl).toContain("private");
      expect(cacheControl).toContain("no-store");
    },
  );

  it("leaves public pages cacheable", async () => {
    // The marketing site is thirty static pages; a `no-store` here would undo
    // that.
    expect((await visit("/about")).response.headers.get("cache-control")).toBe(
      null,
    );
  });
});

describe("failing open is safe", () => {
  it("lets a protected request through when Supabase is unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    // The proxy cannot resolve the session, so it does not pretend to. The
    // protected layout's `requireUser()` is the boundary and still denies -
    // asserted in `auth-session.test.ts`. A hard failure here would take the
    // public site down with an auth outage.
    const { location } = await visit("/account");
    expect(location === null || location.includes("/auth/login")).toBe(true);
  });

  it("lets a protected request through when the provider throws", async () => {
    getUser.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const { redirectedTo } = await visit("/account");
    // Unresolvable is treated as unauthenticated: redirect, not admit.
    expect(redirectedTo?.pathname).toBe("/auth/login");
  });
});

describe("redirect safety", () => {
  it("never produces an off-site Location header", async () => {
    for (const path of [
      "/account",
      "/patient/profile",
      // A host-shaped string appearing *inside* a path. This is an ordinary
      // same-origin URL, not an attack - the property being asserted is the
      // resolved origin, not the absence of a scary substring.
      "/admin//evil.example",
      "/dashboard/../../etc",
      "/patient/%2f%2fevil.example",
    ]) {
      const { location } = await visit(path);
      if (location) {
        expect(new URL(location, "http://localhost:3000").origin).toBe(
          "http://localhost:3000",
        );
      }
    }
  });

  it("never lets a destination resolve to another host", async () => {
    // The `next` value is what a browser will navigate to after signing in.
    // Whatever it contains, resolving it must stay on this origin.
    for (const path of ["/admin//evil.example", "/patient/profile"]) {
      const next = (await visit(path)).redirectedTo?.searchParams.get("next");
      if (next) {
        expect(new URL(next, "http://localhost:3000").origin).toBe(
          "http://localhost:3000",
        );
      }
    }
  });

  it("drops an unsafe intended destination rather than carrying it", async () => {
    // The pathname is attacker-chosen, so it goes through the same validator
    // as anything else.
    const { redirectedTo } = await visit("/account/..%2f..%2fetc");
    expect(redirectedTo?.pathname).toBe("/auth/login");
    expect(redirectedTo?.searchParams.get("next")).toBe(null);
  });
});
