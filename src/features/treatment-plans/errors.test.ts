import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  describeTreatmentPlanFailure,
  TREATMENT_PLAN_ERROR_CODES,
} from "./errors";

/**
 * Database failure to safe copy, for treatment plans.
 *
 * The same three properties the prescription mapper holds to: every code the
 * migration raises is recognised and no code is declared that it does not
 * raise; a conflict is its own outcome; and nothing internal crosses the
 * boundary.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

const SQL = MIGRATION.replace(/--[^\n]*/g, "");

const RAISED = new Set(
  [...SQL.matchAll(/errcode = '(PV\d{3})'/g)].map((match) => match[1]),
);

const PLAN_RANGE = ["PV030", "PV031", "PV032", "PV033", "PV034", "PV035"];

describe("SQLSTATE coverage", () => {
  it("recognises every treatment plan code the migration raises", () => {
    for (const code of PLAN_RANGE) {
      expect(RAISED, `${code} is declared but never raised`).toContain(code);
      expect(describeTreatmentPlanFailure({ code }).logEvent).not.toBe(
        "treatment_plan.operation_failed",
      );
    }
  });

  it("declares no code the migration does not raise", () => {
    for (const code of Object.values(TREATMENT_PLAN_ERROR_CODES)) {
      expect(RAISED).toContain(code);
    }
  });

  it("uses a code range disjoint from the prescription's", () => {
    for (const code of Object.values(TREATMENT_PLAN_ERROR_CODES)) {
      expect(code).toMatch(/^PV03\d$/);
    }
  });
});

describe("conflicts", () => {
  it("treats a stale write and an activated plan as conflicts", () => {
    expect(
      describeTreatmentPlanFailure({
        code: TREATMENT_PLAN_ERROR_CODES.staleWrite,
      }).conflict,
    ).toBe(true);
    expect(
      describeTreatmentPlanFailure({
        code: TREATMENT_PLAN_ERROR_CODES.notEditable,
      }).conflict,
    ).toBe(true);
  });

  it("does not treat a missing plan as a conflict", () => {
    expect(
      describeTreatmentPlanFailure({
        code: TREATMENT_PLAN_ERROR_CODES.notFound,
      }).conflict,
    ).toBe(false);
  });
});

describe("what the practitioner is told", () => {
  const codes = [
    ...PLAN_RANGE,
    "23505",
    "23514",
    "23502",
    "23503",
    "42501",
    "unknown",
  ];

  it("says what happened to the work, except when it is about finding something", () => {
    const aboutFinding = new Set([
      TREATMENT_PLAN_ERROR_CODES.notFound,
      TREATMENT_PLAN_ERROR_CODES.consultationNotFound,
      "23503",
      "42501",
    ]);

    for (const code of codes) {
      if (aboutFinding.has(code)) continue;
      expect(
        describeTreatmentPlanFailure({ code }).message.toLowerCase(),
        `${code} does not say what happened to the changes`,
      ).toMatch(
        /not been saved|nothing has been (changed|saved)|already exists/,
      );
    }
  });

  it("never leaks a constraint, a table, a column or SQL", () => {
    const forbidden = [
      "treatment_plan_items",
      "treatment_plans_",
      "fkey",
      "constraint",
      "violates",
      "relation",
      "postgres",
      "pgrst",
      "select ",
      "insert ",
      "sqlstate",
      "pv03",
    ];

    for (const code of codes) {
      const { message, logEvent } = describeTreatmentPlanFailure({
        code,
        message:
          "new row for relation treatment_plans violates check constraint",
      });

      for (const needle of forbidden) {
        expect(message.toLowerCase()).not.toContain(needle);
        expect(logEvent.toLowerCase()).not.toContain(needle);
      }
    }
  });

  it("falls back safely for anything it does not recognise", () => {
    for (const error of [
      null,
      undefined,
      "x",
      1,
      {},
      new Error("relation x"),
    ]) {
      const failure = describeTreatmentPlanFailure(error);

      expect(failure.logEvent).toBe("treatment_plan.operation_failed");
      expect(failure.message.toLowerCase()).not.toContain("relation");
    }
  });
});
