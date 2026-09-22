/**
 * Privacy: what leaves, and where it could leak from.
 *
 * `phase_19.md` sections 86-88, 92-105 and 212. The inspection section 212
 * asks for — HTML, network, storage, URLs, logs, analytics — is partly a
 * browser exercise and partly a source one. This is the source half; the
 * browser half is recorded in `docs/progress/progress_phase_19.md`.
 */
import { readFileSync, globSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { REDACTED, redact } from "@/lib/logging/redact";

function sources(pattern: string): { path: string; text: string }[] {
  return globSync(pattern)
    .filter((path) => !path.includes(".test."))
    .map((path) => ({
      path: path.replaceAll("\\", "/"),
      text: readFileSync(path, "utf8"),
    }));
}

/**
 * Source with its comments removed.
 *
 * The `//` handling is deliberately not naive. `line.split("//")[0]` truncates
 * every URL in the file at `https:`, which silently emptied the third-party
 * origin scan below and made it pass while checking nothing — the same class
 * of failure Phase 14 found in two security assertions and Phase 15 found in a
 * privacy scanner. A `//` preceded by a colon is a scheme separator.
 */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

const ALL = sources("src/**/*.{ts,tsx}");

describe("log redaction", () => {
  it("replaces a credential wherever it appears", () => {
    const output = redact({
      accessToken: "secret",
      nested: { apiKey: "secret", refresh_token: "secret" },
    });
    expect(JSON.stringify(output)).not.toContain("secret");
    expect(output["accessToken"]).toBe(REDACTED);
  });

  it("replaces contact details and clinical fields", () => {
    const output = redact({
      email: "patient@example.test",
      phone: "9999999999",
      diagnosis: "something",
      doctorNotes: "something",
      medicineName: "something",
      chiefComplaint: "something",
    });
    for (const value of Object.values(output)) {
      expect(value).toBe(REDACTED);
    }
  });

  it("keeps an opaque correlation id readable", () => {
    // A log of a clinical operation genuinely needs one: it is what lets
    // somebody investigate a failure without learning what was prescribed.
    const output = redact({ prescriptionId: "b7f3-uuid", userId: "u-1" });
    expect(output["prescriptionId"]).toBe("b7f3-uuid");
    expect(output["userId"]).toBe("u-1");
  });

  it("does not exempt an id-shaped name that is not one", () => {
    // The allow-list is exact matches, not a pattern, precisely so that a rule
    // like "anything ending in Id is safe" cannot exempt `emailId`.
    expect(redact({ emailId: "patient@example.test" })["emailId"]).toBe(
      REDACTED,
    );
  });

  it("bounds depth, length and array size", () => {
    const deep = { a: { b: { c: { d: { e: { f: "too far" } } } } } };
    expect(JSON.stringify(redact(deep))).toContain("depth-limit");

    const long = redact({ text: "x".repeat(2000) })["text"] as string;
    expect(long.length).toBeLessThan(600);

    const many = redact({ items: Array.from({ length: 100 }, (_, i) => i) })[
      "items"
    ] as unknown[];
    expect(many.length).toBeLessThan(30);
  });
});

describe("nothing sensitive reaches a log call", () => {
  /**
   * A parenthesis-matching scan, not a regex.
   *
   * A pattern stopping at the first `)` captures a fragment and one stopping
   * at the last captures the rest of the file — Phase 16 recorded both
   * failures. This walks brackets instead.
   */
  function logCalls(text: string): string[] {
    const code = withoutComments(text);
    const calls: string[] = [];
    const pattern = /\blog(?:ger)?\.(debug|info|warn|error)\s*\(/g;

    for (const match of code.matchAll(pattern)) {
      let depth = 0;
      let index = match.index + match[0].length - 1;
      const start = index;
      for (; index < code.length; index += 1) {
        if (code[index] === "(") depth += 1;
        else if (code[index] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      calls.push(code.slice(start, index + 1));
    }
    return calls;
  }

  const CLINICAL_IDENTIFIERS = [
    "chiefComplaint",
    "diagnosis",
    "symptoms",
    "assessment",
    "doctorNotes",
    "followUpNotes",
    "clinicalObservations",
    "medicineName",
    "instructions",
    "patientNote",
    "internalNote",
    "cancellationReason",
    "archiveReason",
    "storagePath",
    "signedUrl",
    "fileName",
    "title",
    "fullName",
    "phone",
    "email",
    "dateOfBirth",
    "searchTerm",
    "query",
    "prompt",
    "response",
  ];

  it("has log calls to check", () => {
    const total = ALL.reduce((sum, { text }) => sum + logCalls(text).length, 0);
    expect(total).toBeGreaterThan(100);
  });

  it("names no clinical or identifying field in any log call", () => {
    for (const { path, text } of ALL) {
      for (const call of logCalls(text)) {
        for (const identifier of CLINICAL_IDENTIFIERS) {
          expect(
            new RegExp(String.raw`\b${identifier}\b`).test(call),
            `${path} logs ${identifier}: ${call.slice(0, 120)}`,
          ).toBe(false);
        }
      }
    }
  });

  it("never stringifies a whole object into a log", () => {
    // `JSON.stringify(record)` in a log call is how a whole clinical record
    // ends up in an operations tool (`phase_19.md` section 87).
    for (const { path, text } of ALL) {
      for (const call of logCalls(text)) {
        expect(call, `${path}: ${call.slice(0, 120)}`).not.toContain(
          "JSON.stringify",
        );
      }
    }
  });

  it("logs no raw error message from a provider or the database", () => {
    // The logger takes the thrown value and records its name and message
    // through `describeErrorForLog`; passing `error.message` as a *field*
    // would bypass redaction for a string that can contain SQL or a token.
    for (const { path, text } of ALL) {
      for (const call of logCalls(text)) {
        expect(call, `${path}: ${call.slice(0, 120)}`).not.toMatch(
          /\b\w+:\s*\w+\.message\b/,
        );
      }
    }
  });
});

describe("console logging outside the logger", () => {
  it("uses console in exactly the places that must", () => {
    // The structured logger writes through `console`; the three error
    // boundaries are client components, which cannot reach a server logger and
    // which render at the moment when nothing else works. Every other
    // `console.log` is an accidental disclosure channel in a healthcare
    // product (`phase_19.md` section 87).
    const users = ALL.filter(({ text }) =>
      /\bconsole\.(log|info|warn|error|debug)\s*\(/.test(withoutComments(text)),
    ).map(({ path }) => path);

    expect(users.sort()).toEqual([
      "src/app/(app)/patient/error.tsx",
      "src/app/(public)/services/error.tsx",
      "src/app/error.tsx",
      "src/lib/logging/logger.ts",
    ]);
  });

  it("writes only a digest to the browser console, never a message", () => {
    // `error.message` on a Next.js error boundary can carry internal detail,
    // and the browser console is one screenshot away from a support ticket.
    // The digest is an opaque correlation id; the real failure is in the
    // server log.
    for (const path of [
      "src/app/error.tsx",
      "src/app/(app)/patient/error.tsx",
      "src/app/(public)/services/error.tsx",
    ]) {
      const code = withoutComments(readFileSync(path, "utf8"));
      const calls = [...code.matchAll(/console\.\w+\(([^)]*)\)/g)];
      expect(calls.length, path).toBeGreaterThan(0);
      for (const [, argument] of calls) {
        expect(argument, path).toContain("digest");
        expect(argument, path).not.toContain("message");
        expect(argument, path).not.toContain("stack");
      }
    }
  });
});

describe("no patient data in a URL", () => {
  it("routes every patient-facing page by an opaque id, never a name", () => {
    // Section 212. A URL reaches browser history on a shared machine, every
    // proxy's access log, and the next request's `Referer`.
    const segments = new Set<string>();
    for (const path of globSync("src/app/**/*.tsx")) {
      for (const match of path
        .replaceAll("\\", "/")
        .matchAll(/\[([^\]]+)\]/g)) {
        segments.add(match[1]!);
      }
    }

    expect(segments.size).toBeGreaterThan(3);
    for (const segment of segments) {
      // Every one is an opaque uuid or a published catalogue slug. A segment
      // carrying a name, an email or a date of birth would put it in browser
      // history on a shared machine and in every proxy's access log.
      expect(segment).toMatch(
        /^(id|slug|recordId|documentId|prescriptionId|planId)$/,
      );
    }
  });

  it("searches by POST rather than by a query string", () => {
    // A search term at a front desk is somebody's name. Phases 10, 11 and 13
    // all made it a server action for this reason; this is what keeps it one.
    const search = readFileSync(
      "src/components/reception/patient-search.tsx",
      "utf8",
    );
    expect(withoutComments(search)).not.toMatch(/router\.(push|replace)\(/);
  });
});

describe("third-party data flow", () => {
  it("reaches exactly three external origins, all from the server", () => {
    const origins = new Set<string>();
    for (const { text } of ALL) {
      for (const match of withoutComments(text).matchAll(
        /https:\/\/([a-z0-9.-]+)/g,
      )) {
        const host = match[1]!;
        if (
          /punarvasu|schema\.org|example|localhost|invalid|w3\.org/.test(host)
        ) {
          continue;
        }
        origins.add(host);
      }
    }

    // The map (browser, on the public contact page), the AI provider and the
    // email provider (both server-side only). A fourth appearing here is a new
    // third-party data flow and needs an entry in the inventory in
    // `docs/SECURITY.md` section 42.
    expect([...origins].sort()).toEqual([
      "api.emailjs.com",
      "generativelanguage.googleapis.com",
      "www.google.com",
    ]);
  });

  it("calls the AI and email providers only from server-only modules", () => {
    for (const path of [
      "src/lib/ai/gemini.ts",
      "src/lib/notifications/providers/emailjs.ts",
    ]) {
      expect(readFileSync(path, "utf8"), path).toMatch(
        /import\s+["']server-only["']/,
      );
    }
  });

  it("sends no patient address to the map provider", () => {
    // Section 104. The clinic's location is public; a patient's is not. The
    // map's `src` comes from `config/clinic.ts`, which holds one address —
    // the clinic's.
    const map = readFileSync("src/components/marketing/map-embed.tsx", "utf8");
    expect(withoutComments(map)).not.toMatch(/patient/i);
  });
});

describe("authenticated pages are not indexable", () => {
  it("declares noindex on every authenticated area", () => {
    for (const layout of [
      "src/app/(app)/layout.tsx",
      "src/app/auth/layout.tsx",
    ]) {
      expect(readFileSync(layout, "utf8"), layout).toMatch(/index:\s*false/);
    }
  });

  it("disallows every authenticated prefix in robots", () => {
    const robots = readFileSync("src/app/robots.ts", "utf8");
    for (const prefix of [
      "/api/",
      "/auth/",
      "/account",
      "/patient/",
      "/receptionist",
      "/doctor",
      "/admin",
      "/notifications",
      "/forbidden",
    ]) {
      expect(robots, prefix).toContain(`"${prefix}"`);
    }
  });

  it("puts nothing about the reader in an authenticated page title", () => {
    // Section 96. A title reaches the browser tab, the history entry and the
    // share sheet — all of which are read over a shoulder or synced to another
    // device.
    //
    // Scoped to the authenticated area deliberately. A public catalogue page
    // legitimately interpolates the treatment or practitioner it is about:
    // that is published content, and being indexed is its whole purpose. An
    // authenticated page's subject is a person, so its title is a constant —
    // "Your profile", never "<name>'s profile".
    const authenticated = sources("src/app/**/page.tsx").filter(({ path }) =>
      path.includes("/(app)/"),
    );

    expect(authenticated.length).toBeGreaterThan(15);

    for (const { path, text } of authenticated) {
      for (const [, title] of withoutComments(text).matchAll(
        /title:\s*(`[^`]*`|"[^"]*")/g,
      )) {
        expect(title, `${path} interpolates into its title`).not.toMatch(
          /\$\{/,
        );
        expect(title!.toLowerCase(), path).not.toMatch(
          /diagnos|prescription for|patient name/,
        );
      }
    }
  });
});
