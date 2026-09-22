import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CLINICAL_COMPLETION_REQUIRED_FIELDS,
  CLINICAL_RECORD_STATUSES,
  CLINICAL_TRANSITIONS,
  CONSULTATION_ELIGIBLE_APPOINTMENT_STATUSES,
  canCompleteClinicalRecord,
  canTransitionClinicalRecord,
  isClinicalRecordEditable,
  isClinicalRequiredField,
  isConsultationEligible,
  missingClinicalRequirements,
} from "./status";
import { CLINICAL_FIELDS, EMPTY_CLINICAL_CONTENT } from "./types";

/**
 * The clinical record lifecycle and its completion rules.
 *
 * Three rules compose across this feature, and the tests keep them apart:
 *
 *   * the **lifecycle** — `draft -> completed -> amended`, and nothing else;
 *   * **editability** — only a draft;
 *   * **completion requirements** — which fields must be written first.
 *
 * The last block reads the migration, because each of the three exists in two
 * places: here for the UI, and in PL/pgSQL or a check constraint for the
 * database. Two copies of a rule is a divergence waiting to happen, and the
 * failures it produces here are concrete and user-visible — a "Complete
 * consultation" button the workspace offers and the database then refuses,
 * or a "Start consultation" button on a page that cannot start one.
 *
 * Phase 10's equivalent mirror test found exactly that class of defect before
 * it shipped, which is why this file is written to be checked against the SQL
 * rather than trusted.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260923120000_clinical_records.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("the lifecycle", () => {
  it("declares the three statuses the enum declares", () => {
    expect([...CLINICAL_RECORD_STATUSES].sort()).toEqual([
      "amended",
      "completed",
      "draft",
    ]);
  });

  it("allows a draft to be completed and nothing else", () => {
    expect(canTransitionClinicalRecord("draft", "completed")).toBe(true);
    expect(canTransitionClinicalRecord("draft", "amended")).toBe(false);
    expect(canTransitionClinicalRecord("draft", "draft")).toBe(false);
  });

  it("never reopens a completed record", () => {
    // `phase_12.md` section 16 and example 5: once completed, normal editing
    // is restricted, and a completed medical record must not be silently
    // overwritten. A mistake is corrected by an amendment that preserves what
    // was there, never by editing it back into a draft.
    expect(canTransitionClinicalRecord("completed", "draft")).toBe(false);
    expect(canTransitionClinicalRecord("amended", "draft")).toBe(false);
    expect(canTransitionClinicalRecord("amended", "completed")).toBe(false);
  });

  it("leaves the amendment path open and unreachable", () => {
    // Section 17: Phase 12 must not architect the system so that a future
    // amendment history is impossible. The edge exists; nothing in this phase
    // traverses it.
    expect(canTransitionClinicalRecord("completed", "amended")).toBe(true);
    expect(CLINICAL_TRANSITIONS.amended).toEqual([]);

    // And no function in the migration can produce it. The guard *mentions*
    // `amended` — that is the open edge — so the assertion is on the three
    // functions that write, which must not name it at all.
    for (const name of [
      "start_consultation",
      "save_clinical_draft",
      "complete_clinical_record",
    ]) {
      const body = new RegExp(
        `create function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
      ).exec(MIGRATION)?.[0];

      expect(body, `${name} is no longer in the migration`).toBeTruthy();
      expect(body, name).not.toContain("amended");
    }
  });

  it("makes only a draft editable", () => {
    expect(isClinicalRecordEditable("draft")).toBe(true);
    expect(isClinicalRecordEditable("completed")).toBe(false);
    expect(isClinicalRecordEditable("amended")).toBe(false);
  });
});

describe("completion requirements", () => {
  it("requires a chief complaint and an assessment, and nothing else", () => {
    // Written out rather than compared by length, so requiring a third field
    // is a deliberate edit to this list. Section 37 warns against making
    // every field mandatory, and a system that demands a diagnosis is a
    // system that gets a diagnosis typed in to clear a form.
    expect([...CLINICAL_COMPLETION_REQUIRED_FIELDS].sort()).toEqual([
      "assessment",
      "chiefComplaint",
    ]);
  });

  it("leaves the other six optional", () => {
    for (const field of CLINICAL_FIELDS) {
      if (field === "chiefComplaint" || field === "assessment") continue;
      expect(isClinicalRequiredField(field), field).toBe(false);
    }
  });

  it("names every missing field rather than reporting one failure", () => {
    // Section 33 and section 69's standard applied to completion: the
    // practitioner must be able to tell what is wrong and what to do next.
    expect(missingClinicalRequirements(EMPTY_CLINICAL_CONTENT)).toEqual([
      "chiefComplaint",
      "assessment",
    ]);
  });

  it("treats whitespace as blank", () => {
    // The database function normalises a whitespace-only value to null and
    // the check constraint compares `btrim(...) <> ''`, so all three agree —
    // which is why a practitioner cannot complete a consultation by pressing
    // the space bar.
    const content = {
      ...EMPTY_CLINICAL_CONTENT,
      chiefComplaint: "   \n\t ",
      assessment: "Assessment recorded.",
    };

    expect(missingClinicalRequirements(content)).toEqual(["chiefComplaint"]);
    expect(canCompleteClinicalRecord("draft", content)).toBe(false);
  });

  it("permits completion once both are written", () => {
    const content = {
      ...EMPTY_CLINICAL_CONTENT,
      chiefComplaint: "Recorded.",
      assessment: "Recorded.",
    };

    expect(missingClinicalRequirements(content)).toEqual([]);
    expect(canCompleteClinicalRecord("draft", content)).toBe(true);
  });

  it("refuses to complete a record that is already completed", () => {
    const content = {
      ...EMPTY_CLINICAL_CONTENT,
      chiefComplaint: "Recorded.",
      assessment: "Recorded.",
    };

    expect(canCompleteClinicalRecord("completed", content)).toBe(false);
    expect(canCompleteClinicalRecord("amended", content)).toBe(false);
  });

  it("allows a draft to hold any subset", () => {
    // Section 15 and example 6: a draft may be incomplete, and requiring
    // every field before a save would make "save what I have so far"
    // impossible — which is the whole point of a draft.
    //
    // There is nothing to assert about *saving* a partial draft here beyond
    // the fact that nothing in this module forbids it: `isClinicalRecordEditable`
    // is the only gate on a save, and it looks at the status alone.
    expect(isClinicalRecordEditable("draft")).toBe(true);
    expect(
      missingClinicalRequirements({ chiefComplaint: "Something" }),
    ).toEqual(["assessment"]);
  });
});

describe("consultation eligibility", () => {
  it("accepts a checked-in patient and one already in consultation", () => {
    expect(isConsultationEligible("checked_in")).toBe(true);
    expect(isConsultationEligible("in_consultation")).toBe(true);
  });

  it("refuses every other appointment status", () => {
    // Section 18: a consultation is documented for a patient who is with the
    // practitioner. A request nobody has confirmed, a cancelled appointment,
    // a completed one and a no-show are not that.
    for (const status of [
      "requested",
      "confirmed",
      "completed",
      "cancelled",
      "no_show",
    ]) {
      expect(isConsultationEligible(status), status).toBe(false);
    }
  });
});

/*
 * ---------------------------------------------------------------------------
 * The mirror
 *
 * Each of these parses the migration rather than restating it. A test that
 * restated the SQL would agree with a wrong migration.
 * ---------------------------------------------------------------------------
 */

describe("the database says the same things", () => {
  it("declares the same three statuses in the enum", () => {
    const match =
      /create type public\.clinical_record_status as enum \(([\s\S]*?)\);/.exec(
        MIGRATION,
      );
    expect(match, "the status enum is no longer in the migration").toBeTruthy();

    const declared = [...(match?.[1] ?? "").matchAll(/'(\w+)'/g)]
      .map((m) => m[1] as string)
      .sort();

    expect(declared).toEqual([...CLINICAL_RECORD_STATUSES].sort());
  });

  it("agrees on the lifecycle", () => {
    // `clinical_records_guard_update()` holds the transitions. Parsed out of
    // the guard rather than searched for loosely, so a permitted edge added
    // anywhere else in the file would not satisfy this.
    const guard =
      /create function public\.clinical_records_guard_update\(\)[\s\S]*?\$\$;/.exec(
        MIGRATION,
      )?.[0];
    expect(guard, "the guard function has been renamed").toBeTruthy();

    const edges = [
      ...(guard ?? "").matchAll(
        /old\.status = '(\w+)' and new\.status = '(\w+)'/g,
      ),
    ].map(([, from, to]) => `${from}->${to}`);

    const expected = Object.entries(CLINICAL_TRANSITIONS).flatMap(
      ([from, targets]) => targets.map((to) => `${from}->${to}`),
    );

    expect([...new Set(edges)].sort()).toEqual([...expected].sort());
  });

  it("agrees on which fields completion requires", () => {
    // The check constraint is the authority, and it holds against any writer
    // — including one that skipped `complete_clinical_record` entirely.
    const constraint =
      /constraint clinical_records_completion_requirements check \(([\s\S]*?)\n  \),/.exec(
        MIGRATION,
      )?.[1];
    expect(
      constraint,
      "the completion-requirements constraint has been renamed or reshaped",
    ).toBeTruthy();

    // snake_case, as the column is named.
    const required = new Set(
      [...(constraint ?? "").matchAll(/(\w+) is not null/g)].map(
        (m) => m[1] as string,
      ),
    );

    expect([...required].sort()).toEqual(["assessment", "chief_complaint"]);
  });

  it("agrees on which appointment statuses a consultation may start from", () => {
    const match = /appt\.status not in \(([^)]*)\)/.exec(MIGRATION);
    expect(
      match,
      "start_consultation no longer gates on the appointment status",
    ).toBeTruthy();

    const eligible = [...(match?.[1] ?? "").matchAll(/'(\w+)'/g)]
      .map((m) => m[1] as string)
      .sort();

    expect(eligible).toEqual(
      [...CONSULTATION_ELIGIBLE_APPOINTMENT_STATUSES].sort(),
    );
  });

  it("agrees that a completed record's content cannot change", () => {
    // The guard refuses an update that changes any clinical field while the
    // record is not a draft. This asserts it names **every** field — a field
    // missing from that list would be one a completed record could still be
    // edited through.
    const guard =
      /create function public\.clinical_records_guard_update\(\)[\s\S]*?\$\$;/.exec(
        MIGRATION,
      )?.[0];

    const immutabilityCheck = /old\.status <> 'draft'[\s\S]*?then/.exec(
      guard ?? "",
    )?.[0];
    expect(immutabilityCheck).toBeTruthy();

    for (const field of CLINICAL_FIELDS) {
      const column = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      expect(immutabilityCheck, column).toContain(column);
    }
  });
});
