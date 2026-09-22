/**
 * The structural security guarantees of the clinical AI feature.
 *
 * ## Why these are source assertions
 *
 * The guarantees this phase rests on are mostly *absences*: there is no write
 * path, no patient parameter, no model parameter, no prompt in a request, no
 * clinical content in a log. An absence cannot be exercised by calling
 * something — it is proved by there being nothing to call.
 *
 * So these read the feature's own source and assert what is not in it, the
 * same technique Phases 13-16 used for the equivalent claims. They are the
 * tests that fail when somebody adds the convenient thing.
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FEATURE_DIR = "src/features/clinical-ai";
const LIB_DIR = "src/lib/ai";
const COMPONENT_DIR = "src/components/clinical-ai";

/** Source with comments removed, so a file cannot fail for documenting itself. */
function sourceOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\r\n/g, "\n");
}

function filesIn(dir: string): readonly string[] {
  return readdirSync(dir)
    .filter(
      (name) =>
        /\.tsx?$/.test(name) &&
        !name.endsWith(".test.ts") &&
        !name.endsWith(".test.tsx"),
    )
    .map((name) => `${dir}/${name}`);
}

const FEATURE_FILES = filesIn(FEATURE_DIR);
const LIB_FILES = filesIn(LIB_DIR);
const COMPONENT_FILES = filesIn(COMPONENT_DIR);
const ALL_FILES = [...FEATURE_FILES, ...LIB_FILES, ...COMPONENT_FILES];

describe("the feature writes nothing clinical", () => {
  /*
   * Sections 76, 111-115, and the acceptance criteria's whole "Clinical
   * Safety" block. This is the guarantee that actually holds — not the safety
   * layer, which is a text check, but the fact that there is nowhere for AI
   * output to go.
   */
  const forbiddenTables = [
    "clinical_records",
    "prescriptions",
    "prescription_items",
    "treatment_plans",
    "treatment_plan_items",
    "appointments",
    "patient_documents",
    "notifications",
    "patients",
  ];

  for (const table of forbiddenTables) {
    it(`never writes public.${table}`, () => {
      for (const path of ALL_FILES) {
        const source = sourceOf(path);
        expect(source, `${path} writes ${table}`).not.toMatch(
          new RegExp(
            `\\.from\\(\\s*["']${table}["']\\s*\\)[\\s\\S]{0,120}?\\.(?:insert|update|upsert|delete)\\(`,
          ),
        );
      }
    });
  }

  it("calls no clinical mutation RPC", () => {
    // The functions that change authoritative clinical state. Section 111-114:
    // AI must not complete a record, issue a prescription or activate a plan.
    const forbiddenRpcs = [
      "save_clinical_draft",
      "complete_clinical_record",
      "start_consultation",
      "issue_prescription",
      "save_prescription_draft",
      "cancel_prescription",
      "create_prescription",
      "activate_treatment_plan",
      "save_treatment_plan_draft",
      "complete_treatment_plan",
      "create_patient_document_as_practitioner",
      "create_notification",
      "update_appointment_status_as_doctor",
      "update_appointment_status_as_staff",
    ];

    for (const path of ALL_FILES) {
      const source = sourceOf(path);
      for (const rpc of forbiddenRpcs) {
        expect(source, `${path} calls ${rpc}`).not.toContain(rpc);
      }
    }
  });

  it("calls only the four Phase 17 RPCs", () => {
    const calls = new Set<string>();

    for (const path of ALL_FILES) {
      for (const match of sourceOf(path).matchAll(
        /\.rpc\(\s*["']([a-z_]+)["']/g,
      )) {
        calls.add(match[1]!);
      }
    }

    expect([...calls].sort()).toEqual([
      "ai_assistance_usage",
      "complete_ai_assistance_session",
      "start_ai_assistance_session",
    ]);
  });

  it("exports no action that could apply a result", () => {
    // Sections 72, 109 and example 9. There is one action, it generates, and
    // it returns text. "Accept" must not mean "automatically execute".
    const actions = sourceOf(`${FEATURE_DIR}/actions.ts`);
    const exported = [...actions.matchAll(/export async function (\w+)/g)].map(
      (entry) => entry[1],
    );

    expect(exported).toEqual(["generateClinicalAIAction"]);

    for (const forbidden of ["apply", "accept", "save", "issue", "complete"]) {
      expect(actions.toLowerCase()).not.toContain(`function ${forbidden}`);
    }
  });

  it("revalidates no clinical path", () => {
    // Nothing was written, so there is nothing to revalidate — and
    // revalidating the consultation would discard a practitioner's unsaved
    // notes in order to display a suggestion about them.
    for (const path of ALL_FILES) {
      expect(sourceOf(path)).not.toContain("revalidatePath");
    }
  });
});

describe("the provider key never reaches the browser", () => {
  it("is read only through the server-only config module", () => {
    // Sections 14, 145, 159.
    for (const path of ALL_FILES) {
      const source = sourceOf(path);
      expect(source, path).not.toContain("AI_PROVIDER_API_KEY");
      expect(source, path).not.toMatch(/process\.env/);
    }
  });

  it("keeps the provider modules server-only", () => {
    // `server-only` makes a client import a build error rather than a leak.
    for (const path of [
      `${LIB_DIR}/provider.ts`,
      `${LIB_DIR}/gemini.ts`,
      `${LIB_DIR}/mock.ts`,
      `${FEATURE_DIR}/service.ts`,
      `${FEATURE_DIR}/context-builder.ts`,
      `${FEATURE_DIR}/queries.ts`,
    ]) {
      expect(sourceOf(path), path).toContain('import "server-only"');
    }
  });

  it("imports no provider module into a component", () => {
    // Section 158: no AI SDK in a React component. There is no SDK, and the
    // adapter is not importable from one either.
    for (const path of COMPONENT_FILES) {
      const source = sourceOf(path);
      expect(source, path).not.toMatch(/@\/lib\/ai\//);
      expect(source, path).not.toMatch(
        /clinical-ai\/(?:service|prompts|context-builder|queries)/,
      );
    }
  });

  it("puts the key in a header, never a URL", () => {
    // A key in a query string reaches every proxy's access log.
    const gemini = sourceOf(`${LIB_DIR}/gemini.ts`);

    expect(gemini).toContain('"x-goog-api-key": apiKey');
    expect(gemini).not.toMatch(/\?key=|&key=|apiKey=\$\{/);
  });
});

describe("no clinical content is logged", () => {
  /*
   * Sections 90, 162, and `docs/HEALTHCARE_AND_AI_SAFETY.md` section 4.
   *
   * An allowlist over every identifier passed to a `logger.*` call, matched by
   * walking brackets rather than with a regex — a regex stopping at the first
   * `)` captures a fragment and one stopping at the last captures the rest of
   * the file. The Phase 16 lesson.
   */
  const ALLOWED_LOG_KEYS = new Set([
    "userId",
    "task",
    "promptVersion",
    "failureCode",
    "rule",
    "latencyMs",
    "reason",
    "permission",
  ]);

  function logCalls(source: string): readonly string[] {
    const calls: string[] = [];
    const pattern = /logger\.(?:debug|info|warn|error)\(/g;

    for (const match of source.matchAll(pattern)) {
      let depth = 0;
      let index = match.index + match[0].length - 1;

      for (; index < source.length; index += 1) {
        const character = source[index];
        if (character === "(") depth += 1;
        else if (character === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }

      calls.push(source.slice(match.index, index + 1));
    }

    return calls;
  }

  it("passes only operational keys to the logger", () => {
    let checked = 0;

    for (const path of ALL_FILES) {
      for (const call of logCalls(sourceOf(path))) {
        checked += 1;

        // The object literal, if there is one.
        const object = call.slice(call.indexOf("{"), call.lastIndexOf("}") + 1);
        if (!object.startsWith("{")) continue;

        for (const key of object.matchAll(/^\s*(\w+)\s*:/gm)) {
          expect(
            ALLOWED_LOG_KEYS.has(key[1]!),
            `${path} logs "${key[1]}"`,
          ).toBe(true);
        }
      }
    }

    // A scan that silently matches nothing is worse than no scan.
    expect(checked).toBeGreaterThan(5);
  });

  it("never logs a prompt, a response or a context", () => {
    for (const path of ALL_FILES) {
      for (const call of logCalls(sourceOf(path))) {
        for (const forbidden of [
          "prompt",
          "context",
          "response",
          "summary",
          "considerations",
          "text",
          "body",
          "message",
          "patientId",
          "appointmentId",
        ]) {
          expect(call, `${path}: ${call.slice(0, 60)}`).not.toMatch(
            new RegExp(`\\b${forbidden}\\s*[,:}]`),
          );
        }
      }
    }
  });

  it("discards the provider's error text rather than filtering it", () => {
    // A provider error body can echo the request back, and the request is a
    // clinical prompt. Phase 15 learned this with EmailJS.
    const gemini = sourceOf(`${LIB_DIR}/gemini.ts`);

    expect(gemini).not.toMatch(/logger\./);
    expect(gemini).not.toMatch(/error\.message|response\.statusText/);
  });
});

describe("nothing reaches browser storage or a URL", () => {
  it("writes no localStorage or sessionStorage", () => {
    // Sections 25, 28. The result lives in React state and is lost on
    // navigation, which the panel says out loud.
    for (const path of ALL_FILES) {
      const source = sourceOf(path);
      expect(source, path).not.toContain("localStorage");
      expect(source, path).not.toContain("sessionStorage");
      expect(source, path).not.toContain("document.cookie");
    }
  });

  it("puts no clinical value in a query string", () => {
    for (const path of COMPONENT_FILES) {
      const source = sourceOf(path);
      expect(source, path).not.toMatch(/searchParams|URLSearchParams/);
    }
  });
});

describe("the feature is doctor-only", () => {
  it("checks the clinical AI permission on every entry point", () => {
    const service = sourceOf(`${FEATURE_DIR}/service.ts`);
    const queries = sourceOf(`${FEATURE_DIR}/queries.ts`);
    const actions = sourceOf(`${FEATURE_DIR}/actions.ts`);

    expect(service).toContain('assertPermission("clinical_ai.use")');
    expect(actions).toContain('can(user.role, "clinical_ai.use")');

    // Every exported read authorizes.
    const exported = [...queries.matchAll(/export async function (\w+)/g)].map(
      (entry) => entry[1],
    );

    expect(exported.length).toBeGreaterThan(0);
    expect(
      queries.split('assertPermission("clinical_ai.use")').length - 1,
    ).toBe(exported.length);
  });

  it("grants the permission to the doctor role alone", async () => {
    const { PERMISSIONS_BY_ROLE } = await import("@/config/permissions");

    expect(PERMISSIONS_BY_ROLE.doctor).toContain("clinical_ai.use");
    expect(PERMISSIONS_BY_ROLE.patient).not.toContain("clinical_ai.use");
    expect(PERMISSIONS_BY_ROLE.receptionist).not.toContain("clinical_ai.use");
    expect(PERMISSIONS_BY_ROLE.admin).not.toContain("clinical_ai.use");
  });

  it("never resolves a practitioner or patient in application code", () => {
    // Sections 7, 8, 99. Both come from the database, from `auth.uid()` and
    // from the appointment. There is no application-side resolution to get
    // wrong.
    const service = sourceOf(`${FEATURE_DIR}/service.ts`);

    expect(service).not.toMatch(/practitionerId|patientId/);
    expect(service).not.toContain("current_practitioner_id");
  });
});

describe("the feature flag defaults to off", () => {
  it('requires the exact string "true"', async () => {
    // `docs/HEALTHCARE_AND_AI_SAFETY.md` section 9 is binding: AI features are
    // disabled by default, so a misconfigured or partially deployed
    // environment never silently enables AI in a clinical setting.
    const env = sourceOf("src/config/env.server.ts");

    expect(env).toMatch(
      /clinicalAiEnabled\?\.trim\(\)\.toLowerCase\(\) !== "true"/,
    );
  });

  it("returns no configuration when a credential is missing", () => {
    const env = sourceOf("src/config/env.server.ts");
    const fn = env.slice(
      env.indexOf("export function getClinicalAIConfig("),
      env.indexOf("export function isClinicalAIConfigured("),
    );

    expect(fn).toMatch(
      /if \(!env\.aiProviderApiKey \|\| !env\.aiModel\) return null;/,
    );
  });
});
