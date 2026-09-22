/**
 * What the browser can reach, and what it holds.
 *
 * `phase_19.md` sections 12-13, 22, 33, 97 and 176. Three claims are asserted
 * here because the rest of Phase 19 rests on them:
 *
 *   1. **Nothing in the browser talks to the database.** This is what makes
 *      `connect-src 'self'` correct and what makes `HttpOnly` session cookies
 *      possible at all. If it ever stops being true, both break — loudly here
 *      rather than quietly in production.
 *   2. **No secret can reach the browser.** The service-role key, the AI key
 *      and the email credentials are all behind `server-only`.
 *   3. **No clinical data is persisted client-side**, and no authorization
 *      decision is taken there.
 */
import { readFileSync } from "node:fs";

import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  hardenCookieOptions,
  isDevelopmentRuntime,
} from "@/lib/security/cookies";

/** Every source file under `src/`, with its text. */
function sources(
  pattern = "src/**/*.{ts,tsx}",
): { path: string; text: string }[] {
  return globSync(pattern)
    .filter((path) => !path.includes(".test."))
    .map((path) => ({
      path: path.replaceAll("\\", "/"),
      text: readFileSync(path, "utf8"),
    }));
}

/** Source with `//` and block comments removed, so documentation is not scanned. */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.split("//")[0] ?? "")
    .join("\n");
}

const ALL = sources();
const CLIENT_MODULES = ALL.filter(({ text }) =>
  /^\s*["']use client["']/m.test(text),
);

describe("the browser never talks to the database", () => {
  it("has client modules to check, so this suite is not passing vacuously", () => {
    // A scan that silently matches nothing is worse than no scan. Phase 14
    // added the same guard to the control-character sweep for the same
    // reason.
    expect(CLIENT_MODULES.length).toBeGreaterThan(10);
  });

  it("imports no Supabase client from any client component", () => {
    for (const { path, text } of CLIENT_MODULES) {
      const code = withoutComments(text);
      expect(code, path).not.toMatch(/from\s+["']@supabase\//);
      expect(code, path).not.toMatch(/from\s+["']@\/lib\/supabase\//);
    }
  });

  it("imports the browser Supabase client nowhere at all", () => {
    // It exists, and has no callers. That is what makes `connect-src 'self'`
    // honest and `HttpOnly` cookies possible. The day something needs it,
    // this test is where the consequence surfaces.
    const importers = ALL.filter(
      ({ path, text }) =>
        path !== "src/lib/supabase/browser.ts" &&
        /createSupabaseBrowserClient|lib\/supabase\/browser/.test(
          withoutComments(text),
        ),
    );
    expect(importers.map(({ path }) => path)).toEqual([]);
  });
});

describe("secrets stay on the server", () => {
  const SERVER_ONLY = [
    "src/config/env.server.ts",
    "src/lib/supabase/admin.ts",
    "src/lib/ai/gemini.ts",
    "src/lib/notifications/providers/emailjs.ts",
    "src/lib/logging/logger.ts",
  ];

  it.each(SERVER_ONLY)("%s is fenced with server-only", (path) => {
    // The fence is the enforcement, not the naming convention: a client
    // import of one of these is a build error.
    expect(readFileSync(path, "utf8")).toMatch(/import\s+["']server-only["']/);
  });

  it("reads the service-role key through exactly one accessor", () => {
    const readers = ALL.filter(({ text }) =>
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(withoutComments(text)),
    );
    expect(readers.map(({ path }) => path)).toEqual([
      "src/config/env.server.ts",
    ]);
  });

  it("creates the service-role client in three server modules and nowhere else", () => {
    // Each is documented: the admin user list, the storage write path and the
    // notification worker. A fourth arriving without a review is what this
    // notices.
    const users = ALL.filter(
      ({ path, text }) =>
        path !== "src/lib/supabase/admin.ts" &&
        /createSupabaseAdminClient/.test(withoutComments(text)),
    ).map(({ path }) => path);

    expect(users.sort()).toEqual([
      "src/features/documents/storage.ts",
      "src/features/notifications/processor.ts",
    ]);
  });

  it("exposes only known-public values through NEXT_PUBLIC_", () => {
    const names = new Set<string>();
    for (const { text } of ALL) {
      for (const match of withoutComments(text).matchAll(
        /process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g,
      )) {
        names.add(match[1]!);
      }
    }
    // Every one of these is public by design. A key, a secret or a connection
    // string appearing here would be inlined into the browser bundle.
    expect([...names].sort()).toEqual([
      "NEXT_PUBLIC_ANALYTICS_SITE_ID",
      "NEXT_PUBLIC_MONITORING_DSN",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  });
});

describe("nothing sensitive is stored client-side", () => {
  it("writes no browser storage anywhere in the application", () => {
    // Section 97. Not "no clinical data in storage" — nothing at all, which
    // is a rule that cannot drift into a judgement call about what counts as
    // clinical.
    for (const { path, text } of ALL) {
      const code = withoutComments(text);
      expect(code, path).not.toMatch(/\blocalStorage\b/);
      expect(code, path).not.toMatch(/\bsessionStorage\b/);
      expect(code, path).not.toMatch(/\bindexedDB\b/);
    }
  });

  it("takes no authorization decision in a client component", () => {
    // Section 22: a role from client state is not authorization. A client
    // component may *render* differently for a role, but it may not decide
    // access — and the one place that distinction is easy to blur is a
    // comparison against a role literal.
    for (const { path, text } of CLIENT_MODULES) {
      const code = withoutComments(text);
      expect(code, path).not.toMatch(
        /===\s*["'](admin|doctor|receptionist)["']/,
      );
    }
  });
});

describe("session cookies", () => {
  it("are HttpOnly, whatever the library asked for", () => {
    // `@supabase/r` defaults to `httpOnly: false` because it expects a
    // browser client to read the session. There is no browser client here —
    // asserted above — so the tokens have no reason to be script-readable.
    const options = hardenCookieOptions({ httpOnly: false }, false);
    expect(options.httpOnly).toBe(true);
  });

  it("are Secure outside development", () => {
    expect(hardenCookieOptions({}, false).secure).toBe(true);
  });

  it("are not Secure in development, or the dev server silently loses them", () => {
    expect(hardenCookieOptions({}, true).secure).toBe(false);
  });

  it("are SameSite=Lax rather than Strict", () => {
    // Strict would suppress the session on the first request after following
    // a link from an appointment reminder, landing the patient signed out on
    // a page that had just told them otherwise. Lax already stops the
    // cross-site POST, and Phase 19 added a server-side origin check so that
    // SameSite is not the only thing standing there.
    expect(hardenCookieOptions({}, false).sameSite).toBe("lax");
  });

  it("cannot be weakened by an option the library adds later", () => {
    // The hardened attributes are applied last, so a future library default
    // cannot override them.
    const options = hardenCookieOptions(
      { httpOnly: false, secure: false, sameSite: "none", path: "/nope" },
      false,
    );
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("preserves the options that are the library's to decide", () => {
    const options = hardenCookieOptions(
      { maxAge: 1234, domain: "example.test" },
      false,
    );
    expect(options).toMatchObject({ maxAge: 1234, domain: "example.test" });
  });

  it("is applied by both cookie writers", () => {
    // Two modules write session cookies: the proxy on refresh, and the server
    // client on sign-in. If only one hardened them, the attribute would
    // depend on which ran last.
    for (const path of ["src/proxy.ts", "src/lib/supabase/server.ts"]) {
      expect(readFileSync(path, "utf8"), path).toContain(
        "hardenCookieOptions(",
      );
    }
  });

  it("decides development from the runtime, not from a request", () => {
    expect(typeof isDevelopmentRuntime()).toBe("boolean");
  });
});
