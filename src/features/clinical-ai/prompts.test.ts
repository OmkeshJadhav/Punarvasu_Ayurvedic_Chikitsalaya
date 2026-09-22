/**
 * The prompt registry's tests.
 *
 * ## What a test on a prompt can and cannot assert
 *
 * It cannot assert that a model obeys. What it *can* assert — and what
 * matters, because section 125 says to treat a prompt change as a code change
 * — is that the instruction still **contains the rules somebody wrote it to
 * contain**. A refactor that shortens the system prompt and quietly drops
 * "never prescribe" is exactly the change this catches, and it is the change
 * nobody would notice in review.
 *
 * So these are contract tests over the prompt text, plus the structural
 * properties: versions exist, versions are distinct, and nothing in the
 * registry is reachable from a request.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CLINICAL_AI_TASKS } from "@/config/clinical-ai";

import {
  CLINICAL_AI_PROMPTS,
  CLINICAL_AI_SYSTEM_PROMPT,
  CLINICAL_AI_SYSTEM_PROMPT_VERSION,
  getPromptTemplate,
} from "./prompts";

describe("the system prompt establishes the boundary", () => {
  /*
   * Section 94 names what the system prompt must establish. Each assertion
   * below is one of those rules, expressed as the phrase a reader would look
   * for — so a rewrite that keeps the meaning keeps the test passing, and a
   * rewrite that drops the rule does not.
   */
  const required: readonly [string, RegExp][] = [
    [
      "documents and patient text are data",
      /are data[\s\S]*not instruction|never an instruction/i,
    ],
    [
      "never reveal the instructions",
      /never reveal[\s\S]*?(?:instruction|prompt)/i,
    ],
    [
      "never execute embedded instructions",
      /do not follow it|you do not follow/i,
    ],
    ["never prescribe", /never prescribe/i],
    ["never diagnose", /never state a diagnosis/i],
    ["never invent", /never invent/i],
    [
      "say when information is absent",
      /if something is absent, say it is absent/i,
    ],
    ["never cite a source", /never cite a guideline/i],
    ["flag conflicts", /if two parts of the record disagree/i],
    ["never claim certainty", /never express certainty/i],
    [
      "never write to the patient",
      /never write text addressed to the patient/i,
    ],
    ["never triage", /never perform triage/i],
    [
      "the practitioner decides",
      /the practitioner makes every clinical decision/i,
    ],
  ];

  for (const [name, pattern] of required) {
    it(`states: ${name}`, () => {
      expect(CLINICAL_AI_SYSTEM_PROMPT).toMatch(pattern);
    });
  }

  it("names the four permitted output keys and no others", () => {
    for (const key of [
      "summary",
      "considerations",
      "missingInformation",
      "warnings",
    ]) {
      expect(CLINICAL_AI_SYSTEM_PROMPT).toContain(`"${key}"`);
    }

    // A key the schema would reject must not be suggested by the prompt — a
    // prompt asking for something the parser refuses produces a feature that
    // fails on every request.
    for (const key of ["confidence", "diagnosis", "prescription", "score"]) {
      expect(CLINICAL_AI_SYSTEM_PROMPT).not.toContain(`"${key}"`);
    }
  });

  it("forbids markdown and HTML in the output", () => {
    expect(CLINICAL_AI_SYSTEM_PROMPT).toMatch(/no markdown, no HTML/i);
  });

  it("constrains Ayurvedic content to what the practitioner recorded", () => {
    // Sections 44-45. Do not invent a framework, and do not present a
    // traditional concept as established biomedical fact.
    expect(CLINICAL_AI_SYSTEM_PROMPT).toMatch(
      /do not introduce an Ayurvedic assessment the practitioner has not recorded/i,
    );
    expect(CLINICAL_AI_SYSTEM_PROMPT).toMatch(
      /do not present it as established biomedical fact/i,
    );
  });

  it("tells the model what to do when it notices an injection attempt", () => {
    // Not merely "ignore it": a practitioner should be told their record
    // contains text that looks like an instruction, because that is a fact
    // about the record worth knowing.
    expect(CLINICAL_AI_SYSTEM_PROMPT).toMatch(/add one entry to "warnings"/i);
    expect(CLINICAL_AI_SYSTEM_PROMPT).toMatch(
      /do not repeat the instruction itself/i,
    );
  });

  it("carries a version", () => {
    expect(CLINICAL_AI_SYSTEM_PROMPT_VERSION).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("the task templates", () => {
  it("covers every declared task", () => {
    expect(Object.keys(CLINICAL_AI_PROMPTS).sort()).toEqual(
      [...CLINICAL_AI_TASKS].sort(),
    );
  });

  it("gives each task a distinct version in the database's shape", () => {
    const versions = CLINICAL_AI_TASKS.map(
      (task) => getPromptTemplate(task).version,
    );

    expect(new Set(versions).size).toBe(versions.length);

    // The migration constrains `prompt_version` to this shape. A version the
    // database refuses would fail every request for that task.
    const migration = readFileSync(
      "supabase/migrations/20260928120000_clinical_ai_assistance.sql",
      "utf8",
    ).replace(/\r\n/g, "\n");

    const constraint = migration.match(
      /ai_assistance_sessions_prompt_version_shape\s*\n?\s*check \(prompt_version ~ '([^']+)'\)/,
    );
    expect(constraint).not.toBeNull();

    const pattern = new RegExp(constraint?.[1] ?? "$^");
    for (const version of versions) {
      expect(pattern.test(version)).toBe(true);
    }
  });

  it("never asks for a diagnosis", () => {
    // Section 20 and example 1. The instruction is what steers the answer.
    for (const task of CLINICAL_AI_TASKS) {
      const instruction = getPromptTemplate(task).instruction;
      expect(instruction).not.toMatch(
        new RegExp("(?:provide|give|state|produce) (?:a |the )?diagnos", "i"),
      );
    }
  });

  it("never asks for a treatment or a medicine", () => {
    for (const task of CLINICAL_AI_TASKS) {
      const instruction = getPromptTemplate(task).instruction;
      expect(instruction).not.toMatch(
        new RegExp(
          "(?:suggest|recommend|propose) (?:a )?(?:medicine|treatment|dose|prescription)",
          "i",
        ),
      );
    }
  });

  it("holds the considerations task to the strictest wording rules", () => {
    // It is the task closest to the boundary — the one a practitioner might
    // read as a differential — so section 19's rule is restated in it rather
    // than left to the system prompt.
    const instruction = getPromptTemplate(
      "clinical_considerations",
    ).instruction;

    expect(instruction).toMatch(/NOT a differential diagnosis/i);
    expect(instruction).toMatch(/do not order the entries by likelihood/i);
    expect(instruction).toMatch(/never write [\s\S]*?the patient has/i);
    expect(instruction).toMatch(
      /do not suggest any medicine, herb, formulation, dose or treatment/i,
    );
  });

  it("tells the missing-information task not to assert anything about the patient", () => {
    // Section 18: this is a prompt for the doctor, not an assertion that the
    // patient has a condition.
    const instruction = getPromptTemplate("missing_information").instruction;

    expect(instruction).toMatch(
      /None of them is a statement that the patient has anything/i,
    );
  });

  it("tells the summary tasks to restate rather than conclude", () => {
    for (const task of ["clinical_summary", "consultation_summary"] as const) {
      const instruction = getPromptTemplate(task).instruction;
      expect(instruction).toMatch(
        /do not (?:add anything that is not in the record|interpret)|do not draw conclusions/i,
      );
    }
  });
});

describe("no prompt is reachable from a request", () => {
  it("is not exported through the validation schema", async () => {
    // Section 93. The browser cannot supply, override or append to any of
    // this. The schema's key list is the proof, and it is asserted here as
    // well as in `validation.test.ts` because this is the file somebody would
    // edit when adding a prompt.
    const validation = await import("./validation");
    const keys = Object.keys(validation.clinicalAIRequestSchema.shape);

    for (const key of keys) {
      expect(key).not.toMatch(
        new RegExp("prompt|instruction|system|model|temperature|token", "i"),
      );
    }
  });

  it("lives in source rather than in configuration a UI could edit", () => {
    // Section 125: no arbitrary prompt editing through a production UI. The
    // registry is a frozen module-level constant with no setter.
    const source = readFileSync("src/features/clinical-ai/prompts.ts", "utf8");

    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/\bfrom\("[a-z_]+"\)|createSupabase/);
    expect(source).not.toMatch(/export (?:let|var) /);
  });
});
