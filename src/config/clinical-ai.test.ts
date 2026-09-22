/**
 * The mirror test: the configuration must agree with the migration.
 *
 * Two copies of a rule is a divergence waiting to happen, and every divergence
 * here is user-visible:
 *
 *   * a task the panel offers and the database's enum refuses;
 *   * a quota the panel displays and the database does not enforce.
 *
 * Phase 10's equivalent found exactly that class of defect before it shipped,
 * which is why every phase since has written one. This reads the SQL rather
 * than trusting it.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  AI_ASSISTANCE_LIMITS,
  CLINICAL_AI_CONTEXT_LIMITS,
  CLINICAL_AI_RESPONSE_LIMITS,
  CLINICAL_AI_RUNTIME,
  CLINICAL_AI_SECTIONS,
  CLINICAL_AI_TASKS,
  CLINICAL_AI_TASK_COPY,
  isClinicalAITask,
} from "./clinical-ai";

const MIGRATION = readFileSync(
  "supabase/migrations/20260928120000_clinical_ai_assistance.sql",
  "utf8",
  // Normalised, because a tool that rewrites line endings must not be able to
  // make a mirror assertion pass vacuously — the failure Phase 16 recorded.
).replace(/\r\n/g, "\n");

describe("the task list mirrors the database enum", () => {
  it("declares exactly the values the enum declares", () => {
    const match = MIGRATION.match(
      /create type public\.ai_assistance_task as enum \(([\s\S]*?)\);/,
    );
    expect(match).not.toBeNull();

    const values = [...(match?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map(
      (entry) => entry[1],
    );

    expect(values.sort()).toEqual([...CLINICAL_AI_TASKS].sort());
  });

  it("has no free-text or open-ended task", () => {
    // Section 16 and 92: no "ask AI anything". A task named for an open prompt
    // would be that, whatever its implementation did.
    for (const task of CLINICAL_AI_TASKS) {
      expect(task).not.toMatch(
        new RegExp("(?:free_?text|custom|prompt|ask|chat|query)", "i"),
      );
    }
  });

  it("names a task only if it has copy and declared outputs", () => {
    for (const task of CLINICAL_AI_TASKS) {
      const copy = CLINICAL_AI_TASK_COPY[task];
      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.description.length).toBeGreaterThan(0);
      expect(copy.outputs.length).toBeGreaterThan(0);

      for (const section of copy.outputs) {
        expect(CLINICAL_AI_SECTIONS).toContain(section);
      }
    }
  });

  it("does not offer a diagnosis task", () => {
    // Section 20. A task called "diagnose" would be one whatever its prompt
    // said, and the label is what a practitioner reads.
    for (const task of CLINICAL_AI_TASKS) {
      const copy = CLINICAL_AI_TASK_COPY[task];
      expect(`${task} ${copy.label}`).not.toMatch(
        new RegExp("diagnos|prescri|treat(?:ment)? plan", "i"),
      );
    }
  });

  it("rejects anything that is not a declared task", () => {
    expect(isClinicalAITask("clinical_summary")).toBe(true);
    expect(isClinicalAITask("free_text")).toBe(false);
    expect(isClinicalAITask("")).toBe(false);
    expect(isClinicalAITask(null)).toBe(false);
    expect(isClinicalAITask(42)).toBe(false);
    expect(isClinicalAITask({ task: "clinical_summary" })).toBe(false);
  });
});

describe("the quota mirrors the database", () => {
  it("matches ai_assistance_limits()", () => {
    const match = MIGRATION.match(
      /create function public\.ai_assistance_limits\(\)[\s\S]*?select\s+(\d+),\s*(\d+),\s*(\d+);/,
    );
    expect(match).not.toBeNull();

    expect(Number(match?.[1])).toBe(AI_ASSISTANCE_LIMITS.windowMinutes);
    expect(Number(match?.[2])).toBe(AI_ASSISTANCE_LIMITS.maxPerPractitioner);
    expect(Number(match?.[3])).toBe(AI_ASSISTANCE_LIMITS.maxPerPatient);
  });

  it("bounds a patient more tightly than a practitioner", () => {
    // The per-patient bound exists to stop a loop pointed at one record, so it
    // must actually bite before the practitioner-wide one.
    expect(AI_ASSISTANCE_LIMITS.maxPerPatient).toBeLessThan(
      AI_ASSISTANCE_LIMITS.maxPerPractitioner,
    );
  });
});

describe("runtime bounds", () => {
  it("times out well inside a consultation's patience", () => {
    // Section 51. Long enough for a flash model, short enough that a
    // practitioner gets an answer rather than a spinner.
    expect(CLINICAL_AI_RUNTIME.timeoutMs).toBeGreaterThan(5_000);
    expect(CLINICAL_AI_RUNTIME.timeoutMs).toBeLessThanOrEqual(30_000);
  });

  it("retries at most once", () => {
    // Section 52. Every retry is the patient's context crossing the wire
    // again, so the bound is small and deliberate.
    expect(CLINICAL_AI_RUNTIME.maxAttempts).toBe(2);
  });

  it("keeps the temperature low", () => {
    // A model asked to be interesting invents, and this task's value is that
    // it restates.
    expect(CLINICAL_AI_RUNTIME.temperature).toBeLessThanOrEqual(0.4);
  });

  it("bounds what leaves and what comes back", () => {
    expect(CLINICAL_AI_RUNTIME.maxContextChars).toBeGreaterThan(0);
    expect(CLINICAL_AI_RUNTIME.maxOutputTokens).toBeGreaterThan(0);
    expect(CLINICAL_AI_RUNTIME.maxResponseChars).toBeGreaterThan(
      CLINICAL_AI_RUNTIME.maxOutputTokens,
    );
  });
});

describe("context bounds", () => {
  it("bounds every kind of history", () => {
    // Sections 55-56: bounded history, never the whole record.
    for (const value of Object.values(CLINICAL_AI_CONTEXT_LIMITS)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("keeps history small enough to be a summary", () => {
    expect(
      CLINICAL_AI_CONTEXT_LIMITS.maxPreviousConsultations,
    ).toBeLessThanOrEqual(5);
    expect(CLINICAL_AI_CONTEXT_LIMITS.maxDocuments).toBeLessThanOrEqual(10);
  });
});

describe("response bounds", () => {
  it("caps items and their length", () => {
    expect(CLINICAL_AI_RESPONSE_LIMITS.maxItems).toBeGreaterThan(0);
    expect(CLINICAL_AI_RESPONSE_LIMITS.maxItems).toBeLessThanOrEqual(12);
    expect(CLINICAL_AI_RESPONSE_LIMITS.maxItemChars).toBeGreaterThan(0);
    expect(CLINICAL_AI_RESPONSE_LIMITS.maxSummaryChars).toBeGreaterThan(
      CLINICAL_AI_RESPONSE_LIMITS.maxItemChars,
    );
  });
});

describe("the sections a result can carry", () => {
  it("has no confidence, score or probability section", () => {
    // Sections 30-31. A section for it would be a place to render one.
    for (const section of CLINICAL_AI_SECTIONS) {
      expect(section).not.toMatch(
        new RegExp("confidence|probab|likelihood|score|severity|certain", "i"),
      );
    }
  });

  it("has no section that would be a diagnosis or a prescription", () => {
    for (const section of CLINICAL_AI_SECTIONS) {
      expect(section).not.toMatch(
        new RegExp("diagnos|prescri|medicat|dose|treatment", "i"),
      );
    }
  });
});

describe("the migration itself", () => {
  it("stores no prompt and no response", () => {
    // Sections 27-28, and the acceptance criterion that AI responses are not
    // unnecessarily persisted. The table is checked for a column, not for the
    // word — the header comment legitimately discusses both.
    const table = MIGRATION.slice(
      MIGRATION.indexOf("create table public.ai_assistance_sessions"),
      MIGRATION.indexOf("comment on table public.ai_assistance_sessions"),
    );

    expect(table.length).toBeGreaterThan(200);

    for (const forbidden of [
      "prompt_text",
      "response",
      "completion",
      "summary",
      "consideration",
      "warning",
      "missing_information",
      "confidence",
      "diagnosis",
      "content",
      "output_text",
    ]) {
      expect(table).not.toMatch(new RegExp(`^\\s*${forbidden}\\s`, "im"));
    }
  });

  it("enables row-level security and adds no policy", () => {
    expect(MIGRATION).toContain(
      "alter table public.ai_assistance_sessions enable row level security",
    );
    // No select, insert, update or delete policy for anybody.
    expect(MIGRATION).not.toMatch(/create policy/i);
  });

  it("grants no client role any write on the table", () => {
    expect(MIGRATION).toContain(
      "revoke all on public.ai_assistance_sessions from anon, authenticated",
    );
    expect(MIGRATION).not.toMatch(
      /grant\s+(?:insert|update|delete|all)[\s\S]{0,60}on public\.ai_assistance_sessions/i,
    );
  });

  it("revokes every function from anon by name", () => {
    // The Phase 15 lesson: `revoke ... from public` alone does not remove
    // Supabase's default named grants.
    const revokes = [
      ...MIGRATION.matchAll(
        /revoke all on function ([\s\S]*?)\n\s*from ([^;]+);/g,
      ),
    ];

    expect(revokes.length).toBeGreaterThanOrEqual(5);

    for (const [, , roles] of revokes) {
      expect(roles).toContain("anon");
      expect(roles).toContain("public");
    }
  });

  it("gates every reachable function in its body", () => {
    // Not by its grant. Phase 15 shipped a hole by relying on the grant alone.
    for (const fn of [
      "start_ai_assistance_session",
      "complete_ai_assistance_session",
      "ai_assistance_usage",
    ]) {
      const body = MIGRATION.slice(
        MIGRATION.indexOf(`create function public.${fn}(`),
      ).split("$fn$;")[0];

      expect(body).toContain("public.assert_care_practitioner()");
    }

    const analytics = MIGRATION.slice(
      MIGRATION.indexOf(
        "create function public.analytics_ai_assistance_summary(",
      ),
    ).split("$fn$;")[0];

    expect(analytics).toContain("public.assert_clinic_analytics_reader()");
  });

  it("pins search_path on every function", () => {
    const definitions = [
      ...MIGRATION.matchAll(/create function public\.(\w+)\(/g),
    ].map((entry) => entry[1]);

    expect(definitions.length).toBeGreaterThanOrEqual(6);

    for (const name of definitions) {
      const body = MIGRATION.slice(
        MIGRATION.indexOf(`create function public.${name}(`),
      ).split(/\$fn\$\s*(?:as|;)/)[0];

      expect(body).toContain("set search_path = ''");
    }
  });

  it("takes no patient, practitioner or model override from the caller", () => {
    // Sections 8, 93, and the adversarial checklist. The parameter lists are
    // the allowlist, so the assertion is on them.
    const start =
      MIGRATION.slice(
        MIGRATION.indexOf(
          "create function public.start_ai_assistance_session(",
        ),
      ).split(")")[0] ?? "";

    /*
     * Parameter *names*, extracted, rather than a substring scan over the
     * text. A substring scan flags `p_prompt_version` for containing
     * `p_prompt` — which is the harness bug Phases 11, 12 and 16 each
     * recorded, arriving again. `p_prompt_version` is a version identifier
     * from a frozen registry, not prompt text, and it is exactly what
     * section 33 asks to be recorded.
     */
    const parameters = [...start.matchAll(/^\s*(p_\w+)\s/gm)].map(
      (entry) => entry[1],
    );

    expect(parameters).toEqual([
      "p_appointment_id",
      "p_task",
      "p_prompt_version",
      "p_provider",
      "p_model",
      "p_context_fingerprint",
    ]);

    for (const forbidden of [
      "p_patient_id",
      "p_practitioner_id",
      "p_doctor_id",
      "p_user_id",
      "p_role",
      "p_system_prompt",
      "p_prompt",
      "p_instructions",
      "p_temperature",
      "p_max_tokens",
    ]) {
      expect(parameters).not.toContain(forbidden);
    }
  });

  it("gives the analytics aggregate no practitioner dimension", () => {
    // Section 108. A per-doctor acceptance rate must not be computable.
    const returns = MIGRATION.slice(
      MIGRATION.indexOf(
        "create function public.analytics_ai_assistance_summary(",
      ),
    ).split("language plpgsql")[0];

    for (const forbidden of [
      "practitioner",
      "patient",
      "doctor",
      "created_by",
      "prompt",
    ]) {
      expect(returns).not.toContain(forbidden);
    }
  });

  it("creates no table, column or trigger on an existing clinical table", () => {
    // Analytics-style structural assertion: Phase 17 must not touch the
    // Phase 12-15 schema. The only `create table` is its own.
    const creates = [...MIGRATION.matchAll(/create table public\.(\w+)/g)].map(
      (entry) => entry[1],
    );
    expect(creates).toEqual(["ai_assistance_sessions"]);

    expect(MIGRATION).not.toMatch(/alter table public\.(?!ai_assistance)/);
    expect(MIGRATION).not.toMatch(/drop (?:table|policy|function|trigger)/i);
    expect(MIGRATION).not.toMatch(/create or replace function/i);
  });
});
