/**
 * Client bundle secret scan.
 *
 * Verifies that no server-only variable name or value reached the JavaScript
 * that ships to the browser. Run it after `npm run build`; it is intended to
 * run in CI as a required gate.
 *
 * Two checks, because either alone is weak:
 *   1. Names - the presence of `SUPABASE_SERVICE_ROLE_KEY` in client code means
 *      a server module was pulled into a client bundle.
 *   2. Values - each configured server secret's actual value is searched for,
 *      which catches a secret that was inlined under a different name.
 *
 * Nothing sensitive is printed. A failure reports the variable name and the
 * file, never the value.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

/**
 * What the browser can actually download: everything under `.next/static`, and
 * the prerendered HTML and flight payloads served from `.next/server/app`.
 * Server chunks are deliberately excluded - server code is *supposed* to read
 * server-only variables, so scanning it would only produce noise.
 */
const CLIENT_TARGETS = [
  {
    directory: ".next/static",
    extensions: [".js", ".mjs", ".map", ".json", ".txt", ".css"],
  },
  {
    directory: ".next/server/app",
    extensions: [".html", ".rsc", ".body"],
  },
];

/** Variables that must never appear in anything the browser can download. */
const SERVER_ONLY_VARIABLES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "EMAIL_PROVIDER_API_KEY",
  "AI_PROVIDER_API_KEY",
  "MESSAGING_PROVIDER_API_KEY",
  "PAYMENT_PROVIDER_KEY_SECRET",
  "WEBHOOK_SIGNING_SECRET",
];

/** Short values would produce false positives; they are reported as skipped. */
const MINIMUM_SCANNABLE_VALUE_LENGTH = 12;

async function* walk(directory, extensions) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return; // Directory absent: nothing built for this runtime.
  }

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path, extensions);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      yield path;
    }
  }
}

async function main() {
  const findings = [];
  const skippedValues = [];
  let scannedFiles = 0;

  const values = SERVER_ONLY_VARIABLES.map((name) => ({
    name,
    value: process.env[name],
  })).filter(({ name, value }) => {
    if (!value) return false;
    if (value.length < MINIMUM_SCANNABLE_VALUE_LENGTH) {
      skippedValues.push(name);
      return false;
    }
    return true;
  });

  for (const { directory, extensions } of CLIENT_TARGETS) {
    for await (const file of walk(directory, extensions)) {
      scannedFiles += 1;
      const contents = await readFile(file, "utf8");

      for (const name of SERVER_ONLY_VARIABLES) {
        if (contents.includes(name)) {
          findings.push(`${name} (name) in ${relative(process.cwd(), file)}`);
        }
      }
      for (const { name, value } of values) {
        if (contents.includes(value)) {
          findings.push(`${name} (value) in ${relative(process.cwd(), file)}`);
        }
      }
    }
  }

  if (scannedFiles === 0) {
    console.error(
      "No build output found. Run `npm run build` before scanning.",
    );
    process.exit(1);
  }

  if (skippedValues.length > 0) {
    console.warn(
      `Value scan skipped for ${skippedValues.join(", ")}: configured value is too short to match safely.`,
    );
  }

  if (findings.length > 0) {
    console.error(
      `Server-only configuration found in client output (${findings.length}):`,
    );
    for (const finding of findings) console.error(`  - ${finding}`);
    process.exit(1);
  }

  console.log(
    `No server-only configuration found in client output (${scannedFiles} files scanned).`,
  );
}

await main();
