/**
 * Secrets, and the places one leaks from.
 *
 * `phase_19.md` sections 110-114, 174-176. A repository scan cannot prove a
 * key was never committed — `git log` answers that, and the answer is recorded
 * in `docs/progress/progress_phase_19.md`. What it can do is fail the moment
 * somebody pastes one in, which is how the Phase 17 incident happened: a live
 * Google API key sat in `.env.example`, a file tracked on purpose, one commit
 * away from being published.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Shapes that are credentials rather than placeholders.
 *
 * Each is anchored on a real provider's prefix rather than on entropy, because
 * an entropy heuristic flags every hash in a lockfile and is then switched off.
 */
const SECRET_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  {
    name: "JWT / Supabase key",
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  },
  { name: "Google API key", pattern: /\bAIza[A-Za-z0-9_-]{30,}/ },
  { name: "Google OAuth token", pattern: /\bAQ\.[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI key", pattern: /\bsk-[A-Za-z0-9]{20,}/ },
  {
    name: "Supabase publishable/secret key",
    pattern: /\bsb_(secret|publishable)_[A-Za-z0-9_-]{10,}/,
  },
  { name: "webhook signing secret", pattern: /whsec_[A-Za-z0-9+/=]{20,}/ },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "private key block",
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "out",
  "build",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".js",
  ".json",
  ".sql",
  ".md",
  ".css",
  ".toml",
  ".yml",
  ".yaml",
  ".example",
]);

function walk(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      walk(path, found);
      continue;
    }
    const extension = entry.slice(entry.lastIndexOf("."));
    if (TEXT_EXTENSIONS.has(extension) || entry === ".env.example") {
      found.push(path.replaceAll("\\", "/"));
    }
  }
  return found;
}

const FILES = walk(".").filter(
  // The lockfile is thousands of `sha512-` integrity hashes, which is not a
  // credential shape but is close enough to one to make a scan useless.
  (path) => !path.endsWith("package-lock.json"),
);

describe("the scan is scanning", () => {
  it("found a realistic number of files", () => {
    // Phase 14's source-hygiene sweep added this guard after a scan that
    // silently matched nothing passed for four phases.
    expect(FILES.length).toBeGreaterThan(150);
  });

  it("would notice a planted credential", () => {
    // A scanner without a self-test is a scanner that has quietly stopped.
    const planted = "AIzaSyB0000000000000000000000000000000000";
    expect(SECRET_PATTERNS.some(({ pattern }) => pattern.test(planted))).toBe(
      true,
    );
  });
});

/**
 * Words that make a credential-shaped string self-evidently not one.
 *
 * A test fixture sometimes has to carry a value of the right *shape* — the AI
 * schema test proves that an `apiKey` field is rejected, and a fixture that
 * did not look like a key would not prove it. The exemption is deliberately
 * narrow: the value has to say what it is, in itself, on the same line. A real
 * key pasted in never will.
 *
 * This is the one place a scan is allowed to look away, and it is written as a
 * rule somebody can review rather than as a list of blessed file paths, which
 * is how an exemption grows until it covers the thing it was meant to catch.
 */
const DECLARED_FAKE =
  /dummy|placeholder|example|fake|sample|redacted|your-|xxxxx|testing|not-?a-?real/i;

describe("no credential is in the repository", () => {
  it.each(SECRET_PATTERNS.map((p) => [p.name, p.pattern] as const))(
    "no %s",
    (name, pattern) => {
      const hits: string[] = [];
      for (const path of FILES) {
        // This file has to contain a planted value in order to self-test.
        if (path.endsWith("tests/security/secrets.test.ts")) continue;

        const text = readFileSync(path, "utf8");
        for (const [index, line] of text.split("\n").entries()) {
          if (!pattern.test(line)) continue;
          if (DECLARED_FAKE.test(line)) continue;
          hits.push(`${path}:${index + 1}`);
        }
      }
      expect(hits, `${name} found`).toEqual([]);
    },
  );

  it("does not exempt a value that merely sits in a test file", () => {
    // The exemption is about the value, not about where it lives. A real key
    // pasted into a test is still a real key.
    expect(
      DECLARED_FAKE.test('const key = "AIzaSyRealLookingValue123456789012"'),
    ).toBe(false);
    expect(
      DECLARED_FAKE.test('apiKey: "AIzaSyDummyValueForTesting123456789"'),
    ).toBe(true);
  });

  it("has no database connection string carrying a password", () => {
    const hits: string[] = [];
    for (const path of FILES) {
      if (path.includes(".test.")) continue; // fixtures use obvious placeholders
      const text = readFileSync(path, "utf8");
      for (const [index, line] of text.split("\n").entries()) {
        const match = /postgres(?:ql)?:\/\/[^\s"']*:([^\s"'@]{6,})@/.exec(line);
        if (!match) continue;
        const password = match[1]!;
        const placeholder =
          /password|your|example|xxx|placeholder|secret/i.test(password);
        if (!placeholder) hits.push(`${path}:${index + 1}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe(".env.example", () => {
  const PATH = ".env.example";
  const text = readFileSync(PATH, "utf8");

  it("exists and is tracked on purpose", () => {
    // `.gitignore` excludes `.env*` and then negates this one, so it is the
    // documented configuration boundary — and therefore the file a real key
    // must never reach.
    expect(existsSync(PATH)).toBe(true);
    expect(readFileSync(".gitignore", "utf8")).toContain("!.env.example");
  });

  it("carries a placeholder for every value, not a credential", () => {
    for (const [index, line] of text.split("\n").entries()) {
      const assignment = /^([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
      if (!assignment) continue;
      const value = assignment[2]!.trim();
      if (value === "") continue;

      for (const { name, pattern } of SECRET_PATTERNS) {
        expect(
          pattern.test(value),
          `${PATH}:${index + 1} looks like a ${name}`,
        ).toBe(false);
      }
    }
  });

  it("documents which variables are server-only", () => {
    expect(text).toContain("SERVER-ONLY");
    expect(text).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("keeps clinical AI off by default", () => {
    // `docs/HEALTHCARE_AND_AI_SAFETY.md` section 9 is binding: a misconfigured
    // or partially deployed environment must never silently enable AI in a
    // clinical setting.
    expect(text).toMatch(/CLINICAL_AI_ENABLED\s*=\s*"false"/);
  });
});

describe("real environment files are never committed", () => {
  it("ignores every .env except the example", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toMatch(/^\.env\*$/m);
  });

  it("has no .env file in a scanned directory", () => {
    // The local `.env` is gitignored and holds real values; it must never
    // appear anywhere the scan above would treat as source.
    expect(FILES.filter((path) => /(^|\/)\.env$/.test(path))).toEqual([]);
  });
});
