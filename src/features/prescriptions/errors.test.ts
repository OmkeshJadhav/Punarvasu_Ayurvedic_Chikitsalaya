import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  describePrescriptionFailure,
  PRESCRIPTION_ERROR_CODES,
} from "./errors";

/**
 * Database failure to safe copy.
 *
 * Three properties, and each has produced a real defect in some codebase:
 *
 *   * every SQLSTATE the migration raises is recognised, and none is declared
 *     that it does not raise — a code the mapper does not know produces the
 *     generic message, which is safe but unhelpful, and a code the migration
 *     stopped raising is dead copy nobody notices;
 *   * a conflict is its own outcome, so the form asks for a reload rather
 *     than offering to save again;
 *   * **nothing internal crosses the boundary** — no constraint name, no
 *     table name, no SQL, no connection string, in a message or in a log
 *     event (`phase_13.md` section 84).
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

const SQL = MIGRATION.replace(/--[^\n]*/g, "");

/** Every `PV0xx` the migration raises, deduplicated. */
const RAISED = new Set(
  [...SQL.matchAll(/errcode = '(PV\d{3})'/g)].map((match) => match[1]),
);

/** The prescription half. The treatment plan half is PV030-PV035. */
const PRESCRIPTION_RANGE = [
  "PV020",
  "PV021",
  "PV022",
  "PV023",
  "PV024",
  "PV025",
];

describe("SQLSTATE coverage", () => {
  it("recognises every prescription code the migration raises", () => {
    for (const code of PRESCRIPTION_RANGE) {
      expect(RAISED, `${code} is declared but never raised`).toContain(code);

      const failure = describePrescriptionFailure({ code });
      expect(failure.logEvent).not.toBe("prescription.operation_failed");
    }
  });

  it("declares no prescription code the migration does not raise", () => {
    for (const code of Object.values(PRESCRIPTION_ERROR_CODES)) {
      expect(RAISED).toContain(code);
    }
  });

  it("uses a code range disjoint from the treatment plan's", () => {
    // Two self-contained features, neither importing the other's internals
    // (`docs/ARCHITECTURE.md` section 4).
    for (const code of Object.values(PRESCRIPTION_ERROR_CODES)) {
      expect(code).toMatch(/^PV02\d$/);
    }
  });
});

describe("conflicts", () => {
  it("treats a stale write as a conflict, not a retryable error", () => {
    const failure = describePrescriptionFailure({
      code: PRESCRIPTION_ERROR_CODES.staleWrite,
    });

    expect(failure.conflict).toBe(true);
  });

  it("treats an issued prescription as a conflict", () => {
    // Saving again would be attempting exactly the overwrite the refusal
    // prevented, so the form must stop offering it.
    expect(
      describePrescriptionFailure({
        code: PRESCRIPTION_ERROR_CODES.notEditable,
      }).conflict,
    ).toBe(true);
  });

  it("does not treat a missing prescription as a conflict", () => {
    // Reloading will not conjure one, so the copy must not suggest it.
    expect(
      describePrescriptionFailure({ code: PRESCRIPTION_ERROR_CODES.notFound })
        .conflict,
    ).toBe(false);
  });
});

describe("what the practitioner is told", () => {
  const codes = [
    ...PRESCRIPTION_RANGE,
    "23505",
    "23514",
    "23502",
    "23503",
    "42501",
    "unknown-code",
  ];

  it("always says what happened to the work", () => {
    // A doctor who presses save and sees a red box needs to know whether the
    // prescription was saved. Every message says so, except the two that are
    // about finding something rather than changing it.
    const aboutFinding = new Set([
      PRESCRIPTION_ERROR_CODES.notFound,
      PRESCRIPTION_ERROR_CODES.consultationNotFound,
      "23503",
      "42501",
    ]);

    for (const code of codes) {
      if (aboutFinding.has(code)) continue;
      const { message } = describePrescriptionFailure({ code });
      expect(
        message.toLowerCase(),
        `${code} does not say what happened to the changes`,
      ).toMatch(
        /not been saved|nothing has been (changed|saved)|already exists/,
      );
    }
  });

  it("never leaks a constraint, a table, a column or SQL", () => {
    const forbidden = [
      "prescription_items",
      "prescriptions_",
      "fkey",
      "constraint",
      "violates",
      "relation",
      "postgres",
      "pgrst",
      "select ",
      "insert ",
      "update ",
      "null value",
      "sqlstate",
      "pv02",
    ];

    for (const code of codes) {
      const { message, logEvent } = describePrescriptionFailure({
        code,
        message: "duplicate key value violates unique constraint",
        details: "Key (clinical_record_id)=(...) already exists.",
      });

      for (const needle of forbidden) {
        expect(message.toLowerCase()).not.toContain(needle);
        expect(logEvent.toLowerCase()).not.toContain(needle);
      }
    }
  });

  it("discards the provider's own text entirely", () => {
    const failure = describePrescriptionFailure({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });

    expect(failure.message).not.toContain("duplicate key");
  });

  it("falls back safely for anything it does not recognise", () => {
    for (const error of [
      null,
      undefined,
      "a string",
      42,
      {},
      { code: 500 },
      new Error("relation prescriptions does not exist"),
    ]) {
      const failure = describePrescriptionFailure(error);

      expect(failure.logEvent).toBe("prescription.operation_failed");
      expect(failure.message.toLowerCase()).not.toContain("relation");
      expect(failure.conflict).toBe(false);
    }
  });
});
