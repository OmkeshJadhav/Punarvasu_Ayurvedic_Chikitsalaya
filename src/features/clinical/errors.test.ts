import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CLINICAL_ERROR_CODES, describeClinicalFailure } from "./errors";

/**
 * Database failure to something a practitioner can read.
 *
 * Three properties, and the third is the one `phase_12.md` section 44 is
 * about:
 *
 *   1. every code the migration raises is recognised, so a real failure never
 *      falls through to a message that tells the practitioner nothing;
 *   2. no code is declared that the migration never raises, so the table does
 *      not accumulate dead entries whose messages nobody reviews;
 *   3. **no Postgres policy error, RLS failure, SQL statement, constraint
 *      name, table name or provider text can reach a screen or a log.**
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260923120000_clinical_records.sql",
    import.meta.url,
  ),
  "utf8",
);

/** A PostgREST error, in the shape `supabase-js` hands back. */
function pgError(code: string, message = "internal database detail") {
  return { code, message, details: null, hint: null };
}

describe("the error vocabulary", () => {
  it("covers every code the migration raises", () => {
    const raised = new Set(
      [...MIGRATION.matchAll(/errcode = '(PV\d{3})'/g)].map(
        (match) => match[1] as string,
      ),
    );

    expect(raised.size).toBeGreaterThan(0);

    // `PV008` and `PV009` are Phase 09's and are recognised here too, because
    // `start_consultation` raises both.
    const known = new Set<string>([
      ...Object.values(CLINICAL_ERROR_CODES),
      "PV008",
      "PV009",
    ]);

    for (const code of raised) {
      expect(known, code).toContain(code);
    }
  });

  it("declares no code the migration never raises", () => {
    for (const code of Object.values(CLINICAL_ERROR_CODES)) {
      expect(MIGRATION, code).toContain(`errcode = '${code}'`);
    }
  });
});

describe("a stale write is its own outcome", () => {
  it("is reported as a conflict, not as an ordinary failure", () => {
    // Section 34. A conflict means somebody else's newer documentation is in
    // the database and the practitioner must reload before saving — a
    // different sentence, a different tone and a different next action from
    // "that didn't work, try again". The form reads `conflict` to stop
    // offering to save at all.
    const failure = describeClinicalFailure(pgError("PV015"));

    expect(failure.conflict).toBe(true);
    expect(failure.message).toMatch(/updated somewhere else/i);
    expect(failure.message).toMatch(/reload/i);
  });

  it("says explicitly that the changes were not saved", () => {
    // Section 33: never leave the practitioner guessing whether their notes
    // are safe. The worst outcome here is somebody believing they are.
    for (const code of ["PV015", "PV016"]) {
      expect(describeClinicalFailure(pgError(code)).message, code).toMatch(
        /have not been saved/i,
      );
    }

    expect(describeClinicalFailure(pgError("something-else")).message).toMatch(
      /have not been saved/i,
    );
  });

  it("distinguishes a completed record from a missing one", () => {
    // They send the practitioner to different places: one means "this is
    // finished, nothing to do", the other means "this link is wrong".
    const completed = describeClinicalFailure(pgError("PV016"));
    const missing = describeClinicalFailure(pgError("PV018"));

    expect(completed.message).not.toBe(missing.message);
    expect(completed.message).toMatch(/completed/i);
    expect(missing.message).toMatch(/couldn't find/i);
  });

  it("names the two fields completion needs", () => {
    const failure = describeClinicalFailure(pgError("PV017"));

    expect(failure.message).toMatch(/chief complaint/i);
    expect(failure.message).toMatch(/assessment/i);
    expect(failure.conflict).toBe(false);
  });

  it("tells a practitioner what to do about outstanding draft notes", () => {
    const failure = describeClinicalFailure(pgError("PV019"));

    expect(failure.message).toMatch(/draft/i);
    expect(failure.message).toMatch(/complete/i);
  });
});

describe("nothing internal crosses the boundary", () => {
  it("never forwards the database's own words", () => {
    const hostile = [
      'duplicate key value violates unique constraint "clinical_records_one_per_appointment"',
      'new row violates row-level security policy for table "clinical_records"',
      "permission denied for table clinical_records",
      'relation "public.clinical_records" does not exist',
      "SELECT chief_complaint FROM public.clinical_records WHERE id = $1",
      "postgres://user:secret@db.internal:5432/punarvasu",
    ];

    for (const message of hostile) {
      for (const code of [
        ...Object.values(CLINICAL_ERROR_CODES),
        "23505",
        "23514",
        "42501",
        "42P01",
        undefined,
      ]) {
        const failure = describeClinicalFailure(
          code ? pgError(code, message) : new Error(message),
        );

        expect(failure.message, `${code}: ${message}`).not.toContain(message);
      }
    }
  });

  it("leaks no schema vocabulary in any message", () => {
    const forbidden = [
      "clinical_records",
      "practitioner_id",
      "chief_complaint",
      "row-level security",
      "constraint",
      "select",
      "postgres",
      "PV0",
    ];

    const messages = [
      ...Object.values(CLINICAL_ERROR_CODES),
      "23505",
      "23514",
      "23503",
      "42501",
      "unknown",
    ].map((code) => describeClinicalFailure(pgError(code)).message);

    for (const message of messages) {
      for (const word of forbidden) {
        expect(message.toLowerCase(), `${message} / ${word}`).not.toContain(
          word.toLowerCase(),
        );
      }
    }
  });

  it("carries no clinical content or identifier in a log event", () => {
    // Section 43 and example 7: the log event is a stable, low-cardinality
    // category. `clinical.stale_write` occurring often is an operational
    // signal worth having; what somebody typed is not.
    const events = [
      ...Object.values(CLINICAL_ERROR_CODES),
      "23505",
      "42501",
      "unknown",
    ].map((code) => describeClinicalFailure(pgError(code)).logEvent);

    for (const event of events) {
      expect(event).toMatch(/^clinical\.[a-z_]+$/);
      expect(event).not.toMatch(/\d/);
    }
  });

  it("falls back to a safe generic message for anything unrecognised", () => {
    // A new database error class must not become a user-facing message by
    // default.
    for (const error of [
      undefined,
      null,
      "a string",
      42,
      new Error("boom"),
      { code: 500 },
      { code: "XX000", message: "internal error" },
    ]) {
      const failure = describeClinicalFailure(error);

      expect(failure.logEvent).toBe("clinical.operation_failed");
      expect(failure.conflict).toBe(false);
      expect(failure.message).toMatch(/couldn't save the clinical record/i);
    }
  });

  it("names no role and no permission when it refuses", () => {
    // `phase_08.md` section 12: a refusal must not tell the user which role
    // they would have needed.
    const failure = describeClinicalFailure(pgError("42501"));

    expect(failure.message).not.toMatch(/doctor|practitioner|role|permission/i);
  });
});
