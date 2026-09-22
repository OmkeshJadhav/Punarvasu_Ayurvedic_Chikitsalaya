import { describe, expect, it } from "vitest";

import { AUTHENTICATED_LANDING_PATH, LOGIN_PATH } from "./paths";
import {
  MAX_REDIRECT_LENGTH,
  loginPathWithNext,
  readNextParam,
  safeRedirectPath,
} from "./redirect";

/**
 * Open-redirect tests.
 *
 * `phase_06.md` section 83 asks specifically for this, and it is the one piece
 * of Phase 06 where a single missed case is a shipped vulnerability rather
 * than a bug. The hostile inputs below are the standard corpus - absolute
 * URLs, protocol-relative forms, backslash variants, encodings, control
 * characters, traversal - and every one of them asserts the *same* property:
 * the return value is the fallback, which is an application-authored path.
 */
describe("safeRedirectPath", () => {
  const FALLBACK = AUTHENTICATED_LANDING_PATH;

  describe("accepts internal paths", () => {
    it.each([
      ["/account", "/account"],
      ["/patient/profile", "/patient/profile"],
      ["/dashboard/appointments", "/dashboard/appointments"],
      ["/services/panchakarma", "/services/panchakarma"],
      ["/", "/"],
      ["/account?tab=details", "/account?tab=details"],
      ["/account#section", "/account#section"],
      ["/account?tab=details#top", "/account?tab=details#top"],
      // A percent-encoded space inside a segment is ordinary path data.
      ["/patient/my%20records", "/patient/my%20records"],
      // Trimmed, not rejected: a trailing space is a copy-paste artefact.
      ["  /account  ", "/account"],
    ])("keeps %s", (input, expected) => {
      expect(safeRedirectPath(input, FALLBACK)).toBe(expected);
    });
  });

  describe("rejects external destinations", () => {
    it.each([
      "https://evil.example",
      "https://evil.example/account",
      "http://evil.example",
      // The classic: a lookalike host with the real brand as a prefix.
      "https://punarvasu-example.evil/auth/login",
      "//evil.example",
      "//evil.example/account",
      "///evil.example",
      "/\\evil.example",
      "/\\\\evil.example",
      "\\\\evil.example",
      "https:evil.example",
      "//user:password@evil.example",
    ])("rejects %s", (input) => {
      expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
    });

    it("rejects the exact vector named in the phase specification", () => {
      expect(safeRedirectPath("https://example.com", FALLBACK)).toBe(FALLBACK);
    });
  });

  describe("rejects non-path schemes", () => {
    it.each([
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "mailto:someone@example.test",
      "tel:+911234567890",
    ])("rejects %s", (input) => {
      expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
    });
  });

  describe("rejects encoded attacks", () => {
    it.each([
      "/%2f%2fevil.example",
      "/%2F%2Fevil.example",
      "/%5cevil.example",
      "/%09//evil.example",
      "/%0d%0aLocation:%20https://evil.example",
      // A malformed escape is rejected rather than repaired.
      "/account%",
      "/%zz",
    ])("rejects %s", (input) => {
      expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
    });
  });

  describe("rejects control characters", () => {
    /**
     * Built with `String.fromCharCode` rather than written as escapes.
     *
     * The formatter in this toolchain rewrites a unicode escape inside a
     * string literal into the literal byte it denotes, which silently puts a
     * raw NUL into this file - invisible in review and indistinguishable from
     * a typo later. Constructing the character keeps the intent legible and
     * the file plain ASCII. Same reasoning as `hasUnsafeCharacter` in
     * `redirect.ts`.
     */
    const control = (code: number) => String.fromCharCode(code);

    it.each([
      ["newline", `/account${control(0x0a)}Location: https://evil.example`],
      ["carriage return", `/account${control(0x0d)}Set-Cookie: a=b`],
      ["tab", `/${control(0x09)}evil.example`],
      ["null byte", `/account${control(0x00)}`],
      ["vertical tab", `/account${control(0x0b)}`],
      ["form feed", `/account${control(0x0c)}`],
      ["DEL", `/account${control(0x7f)}`],
      ["C1 control", `/account${control(0x9f)}`],
    ])("rejects a path containing a %s", (_name, input) => {
      expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
    });
  });

  describe("rejects traversal", () => {
    it.each([
      "/../etc/passwd",
      "/a/../../b",
      "/account/../../..",
      "/%2e%2e/%2e%2e/etc",
      "/account/%2e%2e/%2e%2e/secret",
      "/..%2fetc",
      "/patient\\..\\..\\admin",
      // Rejected even though it resolves to a perfectly ordinary path. See
      // the note on `hasTraversalSegment`: the destination is refused rather
      // than silently rewritten into something the caller did not ask for.
      "/patient/records/../profile",
    ])("rejects %s", (input) => {
      expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
    });

    it("allows a path segment that merely contains dots", () => {
      expect(safeRedirectPath("/services/panchakarma.v2", FALLBACK)).toBe(
        "/services/panchakarma.v2",
      );
    });

    it("allows dots in a query value, which change no destination", () => {
      expect(safeRedirectPath("/account?note=..", FALLBACK)).toBe(
        "/account?note=..",
      );
    });
  });

  describe("rejects destinations that are not pages to land on", () => {
    it.each([
      // Bouncing a freshly signed-in user back into the auth flow is a loop.
      "/auth",
      "/auth/login",
      "/auth/register",
      "/auth/verify",
      "/auth/forgot-password",
      "/auth/callback?code=stolen",
      // An API response is not a page to navigate a browser to.
      "/api",
      "/api/health",
      "/api/auth/session-status",
    ])("rejects %s", (input) => {
      expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
    });

    it("does not reject a path that merely starts with the same letters", () => {
      expect(safeRedirectPath("/authors", FALLBACK)).toBe("/authors");
      expect(safeRedirectPath("/apiary", FALLBACK)).toBe("/apiary");
    });

    describe("the one allowed auth destination", () => {
      // Regression: the blanket `/auth` rejection silently rewrote the
      // recovery destination to the account page, so a user who clicked
      // "reset my password" was signed in and left with no way to set one.
      // Caught by driving a real recovery link against the live Auth server.
      it("accepts /auth/reset-password, which the recovery flow needs", () => {
        expect(safeRedirectPath("/auth/reset-password", FALLBACK)).toBe(
          "/auth/reset-password",
        );
      });

      it("accepts it with a query string", () => {
        expect(
          safeRedirectPath(
            "/auth/reset-password?status=link-invalid",
            FALLBACK,
          ),
        ).toBe("/auth/reset-password?status=link-invalid");
      });

      it("matches by exact path, not by prefix", () => {
        // A prefix match here would re-open the whole of /auth.
        expect(safeRedirectPath("/auth/reset-passwordX", FALLBACK)).toBe(
          FALLBACK,
        );
        expect(safeRedirectPath("/auth/reset-password/login", FALLBACK)).toBe(
          FALLBACK,
        );
      });

      it("cannot be reached by traversing out of it", () => {
        expect(
          safeRedirectPath("/auth/reset-password/../login", FALLBACK),
        ).toBe(FALLBACK);
      });

      it("does not re-open any other auth path", () => {
        for (const path of [
          "/auth/login",
          "/auth/register",
          "/auth/callback",
          "/auth/verify",
        ]) {
          expect(safeRedirectPath(path, FALLBACK)).toBe(FALLBACK);
        }
      });
    });
  });

  describe("rejects malformed input", () => {
    it.each([
      ["undefined", undefined],
      ["null", null],
      ["a number", 42],
      ["an object", { toString: () => "/account" }],
      ["an array", ["/account"]],
      ["a boolean", true],
      ["an empty string", ""],
      ["whitespace only", "   "],
      ["a relative path", "account"],
      ["a relative path with a dot", "./account"],
      ["a bare fragment", "#section"],
      ["a bare query", "?tab=details"],
    ])("rejects %s", (_name, input) => {
      expect(safeRedirectPath(input, FALLBACK)).toBe(FALLBACK);
    });

    it("rejects a path longer than the bound", () => {
      const tooLong = `/${"a".repeat(MAX_REDIRECT_LENGTH)}`;
      expect(tooLong.length).toBeGreaterThan(MAX_REDIRECT_LENGTH);
      expect(safeRedirectPath(tooLong, FALLBACK)).toBe(FALLBACK);
    });

    it("accepts a path at exactly the bound", () => {
      const atLimit = `/${"a".repeat(MAX_REDIRECT_LENGTH - 1)}`;
      expect(atLimit.length).toBe(MAX_REDIRECT_LENGTH);
      expect(safeRedirectPath(atLimit, FALLBACK)).toBe(atLimit);
    });
  });

  describe("the fallback", () => {
    it("defaults to the authenticated landing page", () => {
      expect(safeRedirectPath("https://evil.example")).toBe(
        AUTHENTICATED_LANDING_PATH,
      );
    });

    it("can be an empty string, so a caller can detect rejection", () => {
      expect(safeRedirectPath("https://evil.example", "")).toBe("");
    });
  });

  it("never returns a value carrying a scheme or an authority", () => {
    const hostileInputs = [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/%2f%2fevil.example",
      "/account\nLocation: https://evil.example",
      "/../../etc/passwd",
    ];

    for (const input of hostileInputs) {
      const result = safeRedirectPath(input, FALLBACK);
      expect(result.startsWith("/")).toBe(true);
      expect(result.startsWith("//")).toBe(false);
      expect(result).not.toContain("evil.example");
      expect(result).not.toContain(":");
    }
  });
});

describe("loginPathWithNext", () => {
  it("attaches a safe internal destination", () => {
    expect(loginPathWithNext("/patient/profile")).toBe(
      `${LOGIN_PATH}?next=%2Fpatient%2Fprofile`,
    );
  });

  it("preserves a query string on the destination", () => {
    expect(loginPathWithNext("/account?tab=details")).toBe(
      `${LOGIN_PATH}?next=%2Faccount%3Ftab%3Ddetails`,
    );
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "/auth/login",
    undefined,
    "",
  ])("drops the parameter entirely for %s", (input) => {
    // Not "falls back to the default destination" - no parameter at all, so
    // the URL does not suggest a rejected request was honoured.
    expect(loginPathWithNext(input)).toBe(LOGIN_PATH);
  });

  it("never produces a login URL pointing at another origin", () => {
    const result = loginPathWithNext("https://evil.example/account");
    expect(result).toBe(LOGIN_PATH);
    expect(result).not.toContain("evil.example");
  });
});

describe("readNextParam", () => {
  it("reads a single value from a plain object", () => {
    expect(readNextParam({ next: "/account" })).toBe("/account");
  });

  it("reads a single value from URLSearchParams", () => {
    expect(readNextParam(new URLSearchParams("next=/account"))).toBe(
      "/account",
    );
  });

  it("ignores a repeated parameter rather than taking the first", () => {
    // Parameter smuggling: a validator that reads one copy and a consumer that
    // reads another is a classic bypass. Neither copy is used.
    expect(readNextParam({ next: ["/account", "https://evil.example"] })).toBe(
      undefined,
    );
    expect(
      readNextParam(new URLSearchParams("next=/account&next=/patient")),
    ).toBe(undefined);
  });

  it("returns undefined when absent", () => {
    expect(readNextParam({})).toBe(undefined);
    expect(readNextParam(undefined)).toBe(undefined);
    expect(readNextParam(new URLSearchParams())).toBe(undefined);
  });
});
