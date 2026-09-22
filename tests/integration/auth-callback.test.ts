import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Auth callback integration tests.
 *
 * The route is exercised directly with a real `NextRequest`, the way
 * `tests/integration/health-route.test.ts` does, so these assert the actual
 * redirect and the actual headers rather than a mock of them. Supabase is
 * stubbed, because this phase has no live project to point at and because the
 * behaviour under test is ours: which destination is chosen, what is put in
 * the response, and what is kept out of it.
 */

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession, verifyOtp },
  }),
}));

const logLines: string[] = [];

beforeEach(() => {
  logLines.length = 0;
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((line: unknown) => {
      logLines.push(String(line));
    });
  }
  exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  verifyOtp.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function callCallback(query: string) {
  const { GET } = await import("@/app/auth/callback/route");
  const url = `http://localhost:3000/auth/callback${query}`;
  const response = await GET(new NextRequest(url, { method: "GET" }));
  return {
    response,
    location: new URL(response.headers.get("location") ?? "", url),
  };
}

const SUPABASE_ERROR = Object.assign(new Error("Token has expired"), {
  name: "AuthApiError",
  code: "otp_expired",
  status: 401,
});

describe("GET /auth/callback", () => {
  describe("the two link shapes", () => {
    it("exchanges a PKCE code for a session", async () => {
      const { location } = await callCallback("?code=pkce-code-value");

      expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code-value");
      expect(location.pathname).toBe("/account");
    });

    it("verifies a one-time token from the default email templates", async () => {
      const { location } = await callCallback(
        "?token_hash=hash-value&type=signup",
      );

      expect(verifyOtp).toHaveBeenCalledWith({
        type: "signup",
        token_hash: "hash-value",
      });
      expect(location.pathname).toBe("/account");
    });

    it("narrows an unrecognised token type rather than passing it through", async () => {
      await callCallback("?token_hash=hash-value&type=magic_admin_login");

      // A request must not be able to choose which verification flow runs.
      expect(verifyOtp).toHaveBeenCalledWith({
        type: "email",
        token_hash: "hash-value",
      });
    });
  });

  describe("redirect safety", () => {
    it("honours a safe internal destination", async () => {
      const { location } = await callCallback(
        "?code=pkce-code-value&next=%2Fpatient%2Fprofile",
      );
      expect(location.pathname).toBe("/patient/profile");
    });

    it.each([
      ["an absolute URL", "https%3A%2F%2Fevil.example"],
      ["a protocol-relative URL", "%2F%2Fevil.example"],
      ["a backslash form", "%2F%5Cevil.example"],
      ["a javascript scheme", "javascript%3Aalert(1)"],
      ["traversal", "%2F..%2F..%2Fetc"],
    ])("refuses %s and lands on the default", async (_name, encoded) => {
      const { response, location } = await callCallback(
        `?code=pkce-code-value&next=${encoded}`,
      );

      expect(location.origin).toBe("http://localhost:3000");
      expect(location.pathname).toBe("/account");
      expect(response.headers.get("location")).not.toContain("evil.example");
    });
  });

  describe("failures", () => {
    it("redirects a failed signup link to the verification page", async () => {
      exchangeCodeForSession.mockResolvedValue({
        data: {},
        error: SUPABASE_ERROR,
      });

      const { location } = await callCallback("?code=expired");

      expect(location.pathname).toBe("/auth/verify");
      expect(location.searchParams.get("status")).toBe("link-invalid");
    });

    it("redirects a failed recovery link to the reset page", async () => {
      exchangeCodeForSession.mockResolvedValue({
        data: {},
        error: SUPABASE_ERROR,
      });

      const { location } = await callCallback(
        "?code=expired&next=%2Fauth%2Freset-password",
      );

      // `/auth/reset-password` is the one allowed auth destination, so the
      // failure lands on the page that can explain an expired reset link and
      // offer a new one.
      expect(location.pathname).toBe("/auth/reset-password");
      expect(location.searchParams.get("status")).toBe("link-invalid");
    });

    it("carries a successful recovery through to the reset page", async () => {
      // The regression this file now guards: a successful recovery exchange
      // must land on the page that sets a new password. Landing on /account
      // signs the user in and strands them.
      const { location } = await callCallback(
        "?code=valid&next=%2Fauth%2Freset-password",
      );

      expect(location.pathname).toBe("/auth/reset-password");
    });

    it("routes a recovery failure by type when there is no next", async () => {
      verifyOtp.mockResolvedValue({ data: {}, error: SUPABASE_ERROR });

      const { location } = await callCallback(
        "?token_hash=hash-value&type=recovery",
      );

      expect(location.pathname).toBe("/auth/reset-password");
      expect(location.searchParams.get("status")).toBe("link-invalid");
    });

    it("handles a provider error delivered in the URL", async () => {
      const { location } = await callCallback(
        "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      );

      expect(exchangeCodeForSession).not.toHaveBeenCalled();
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(location.pathname).toBe("/auth/verify");
    });

    it("rejects a link carrying no credential at all", async () => {
      const { location } = await callCallback("");

      expect(exchangeCodeForSession).not.toHaveBeenCalled();
      expect(location.pathname).toBe("/auth/verify");
      expect(location.searchParams.get("status")).toBe("link-invalid");
    });

    it("handles a thrown failure without exposing it", async () => {
      exchangeCodeForSession.mockRejectedValue(
        new Error("connect ECONNREFUSED 10.0.0.4:5432"),
      );

      const { response, location } = await callCallback("?code=any");

      expect(location.pathname).toBe("/auth/verify");
      expect(await response.text()).not.toContain("ECONNREFUSED");
    });
  });

  describe("what never reaches the response", () => {
    it("does not put the code or token into the redirect", async () => {
      const { response } = await callCallback(
        "?code=super-secret-pkce-code&next=%2Faccount",
      );
      const location = response.headers.get("location") ?? "";

      expect(location).not.toContain("super-secret-pkce-code");
      expect(location).not.toContain("code=");
    });

    it("does not put the token hash into the redirect", async () => {
      const { response } = await callCallback(
        "?token_hash=super-secret-hash&type=recovery",
      );
      const location = response.headers.get("location") ?? "";

      expect(location).not.toContain("super-secret-hash");
      expect(location).not.toContain("token_hash");
    });

    it("does not echo the provider's error description", async () => {
      const { response } = await callCallback(
        "?error=access_denied&error_description=Signature+verification+failed+for+user+42",
      );

      expect(response.headers.get("location")).not.toContain("Signature");
      expect(await response.text()).not.toContain("Signature");
    });

    it("marks the response uncacheable", async () => {
      const { response } = await callCallback("?code=pkce-code-value");

      // It carries Set-Cookie for the new session; a shared cache must not
      // keep it (`phase_06.md` section 74).
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("cache-control")).toContain("private");
    });
  });

  describe("logging", () => {
    it("logs no code, token or provider text", async () => {
      exchangeCodeForSession.mockResolvedValue({
        data: {},
        error: Object.assign(new Error("Token 'abc123' has expired"), {
          name: "AuthApiError",
          code: "otp_expired",
          status: 401,
        }),
      });

      await callCallback("?code=super-secret-pkce-code");

      const combined = logLines.join("\n");
      expect(combined.length).toBeGreaterThan(0);
      expect(combined).not.toContain("super-secret-pkce-code");
      expect(combined).not.toContain("abc123");
      expect(combined).toContain("auth.link_invalid_or_expired");
    });
  });
});
