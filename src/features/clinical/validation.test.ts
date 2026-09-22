import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CLINICAL_FIELD_LIMITS,
  CLINICAL_SAVE_FIELDS,
  clinicalRecordSaveSchema,
  startConsultationSchema,
} from "./validation";
import { CLINICAL_FIELDS } from "./types";

/**
 * The clinical trust boundary.
 *
 * Three things are asserted here, and the second is the one that matters:
 *
 *   1. valid clinical documentation is accepted, including an incomplete
 *      draft;
 *   2. **every identity, authority and status field is rejected rather than
 *      stripped** — `phase_12.md` section 85's payload-manipulation list, one
 *      item at a time;
 *   3. the bounds agree with the database's, read out of the migration.
 *
 * A rejected request shows up in a log. A quietly dropped field is how a
 * trusted value starts being read from the request two phases later, which is
 * the failure `docs/SECURITY.md` section 2.3 exists to prevent.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260923120000_clinical_records.sql",
    import.meta.url,
  ),
  "utf8",
);

const RECORD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function saveInput(overrides: Record<string, unknown> = {}) {
  return {
    recordId: RECORD_ID,
    expectedVersion: 1,
    chiefComplaint: "Recorded.",
    assessment: "Recorded.",
    ...overrides,
  };
}

describe("a clinical save", () => {
  it("accepts a record id, a version and the eight fields", () => {
    const parsed = clinicalRecordSaveSchema.safeParse(
      saveInput({
        historyOfPresentingConcern: "Recorded.",
        symptoms: "Recorded.",
        clinicalObservations: "Recorded.",
        diagnosisOrClinicalImpression: "Recorded.",
        doctorNotes: "Recorded.",
        followUpNotes: "Recorded.",
      }),
    );

    expect(parsed.success).toBe(true);
  });

  it("accepts an incomplete draft", () => {
    // Section 15 and example 6. Requiring every field at the boundary would
    // make "save what I have so far" impossible, which is the whole point of
    // a draft. What is required is required at *completion*, and that lives
    // in `status.ts` and in a check constraint.
    const parsed = clinicalRecordSaveSchema.safeParse({
      recordId: RECORD_ID,
      expectedVersion: 3,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      for (const field of CLINICAL_FIELDS) {
        expect(parsed.data[field], field).toBe("");
      }
    }
  });

  it("trims each field, so whitespace is never content", () => {
    const parsed = clinicalRecordSaveSchema.safeParse(
      saveInput({ chiefComplaint: "   Recorded.  \n" }),
    );

    expect(parsed.success && parsed.data.chiefComplaint).toBe("Recorded.");
  });

  it("refuses a record id that is not an identifier", () => {
    for (const recordId of [
      "not-a-uuid",
      "1 OR 1=1",
      "../../etc/passwd",
      "<script>alert(1)</script>",
      "",
    ]) {
      expect(
        clinicalRecordSaveSchema.safeParse(saveInput({ recordId })).success,
        recordId,
      ).toBe(false);
    }
  });

  it("refuses a version that is not a positive whole number", () => {
    for (const expectedVersion of [0, -1, 1.5, "abc", "", null]) {
      expect(
        clinicalRecordSaveSchema.safeParse(saveInput({ expectedVersion }))
          .success,
        String(expectedVersion),
      ).toBe(false);
    }
  });
});

describe("no schema accepts an identity, an authority or a status", () => {
  /**
   * Section 85, section 56 and examples 3 and 4, enumerated.
   *
   * Each is **rejected**, not stripped, because `strict()` is what the
   * schemas use — and each is checked on its own so a failure names the field
   * that got through.
   */
  it.each([
    // Example 3: trusting a doctor id.
    "doctorId",
    "practitionerId",
    // Example 4: trusting a patient id alongside a record id.
    "patientId",
    "appointmentId",
    // The status a completion would set. There is no status parameter
    // anywhere in this feature.
    "status",
    "completedAt",
    "completedBy",
    "createdBy",
    // Authority.
    "role",
    "permission",
    "isAdmin",
    "userId",
    "profileId",
    // The concurrency token is an input; the stored version is not.
    "version",
    // Phase 13 and 14, which must not arrive early through a form field.
    "prescription",
    "medications",
    "treatmentPlan",
    "documentId",
    "attachmentUrl",
  ])("rejects a save carrying %s", (field) => {
    const parsed = clinicalRecordSaveSchema.safeParse(
      saveInput({ [field]: "anything" }),
    );

    expect(parsed.success).toBe(false);
  });

  it.each([
    "doctorId",
    "practitionerId",
    "patientId",
    "status",
    "role",
    "recordId",
  ])("rejects a consultation start carrying %s", (field) => {
    const parsed = startConsultationSchema.safeParse({
      appointmentId: RECORD_ID,
      [field]: "anything",
    });

    expect(parsed.success).toBe(false);
  });

  it("has no field named after an identity in any schema's own shape", () => {
    // The stronger form: not "it is rejected", but "there is nowhere for it
    // to go". Reads the module's source, so a field added later fails here
    // even if somebody also updates the list above.
    const source = readFileSync(
      new URL("./validation.ts", import.meta.url),
      "utf8",
    )
      // Comments explain why these names are absent, so they must not count
      // as the names being present.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

    for (const forbidden of [
      "doctorId",
      "practitionerId",
      "patientId",
      "role:",
      "permission",
      "isAdmin",
      "completedAt",
      "createdBy",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("has no field for a prescription, a medication or a document", () => {
    for (const field of CLINICAL_SAVE_FIELDS) {
      expect(field).not.toMatch(
        /prescri|medicat|dose|dosage|document|attachment|file|upload/i,
      );
    }
  });
});

describe("the save form's field list", () => {
  it("is exactly the schema's keys", () => {
    // The action reads the form through this list and never iterates what was
    // posted, so a field here and not in the schema would be read and then
    // rejected, and a field in the schema and not here would silently always
    // be empty — which on a clinical form means a section the practitioner
    // types into and never sees again.
    expect([...CLINICAL_SAVE_FIELDS].sort()).toEqual(
      [...Object.keys(clinicalRecordSaveSchema.shape)].sort(),
    );
  });

  it("carries all eight clinical fields", () => {
    for (const field of CLINICAL_FIELDS) {
      expect(CLINICAL_SAVE_FIELDS as readonly string[], field).toContain(field);
    }
  });
});

describe("the bounds agree with the database", () => {
  it("rejects text longer than the column allows", () => {
    for (const [field, limit] of Object.entries(CLINICAL_FIELD_LIMITS)) {
      const parsed = clinicalRecordSaveSchema.safeParse(
        saveInput({ [field]: "x".repeat(limit + 1) }),
      );
      expect(parsed.success, field).toBe(false);

      const atLimit = clinicalRecordSaveSchema.safeParse(
        saveInput({ [field]: "x".repeat(limit) }),
      );
      expect(atLimit.success, `${field} at the limit`).toBe(true);
    }
  });

  it("uses the same numbers the check constraints use", () => {
    // Two copies of a bound is a divergence waiting to happen, and the
    // failure it produces is a submission the practitioner loses to a
    // constraint violation after the form said it was fine.
    for (const [field, limit] of Object.entries(CLINICAL_FIELD_LIMITS)) {
      const column = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      const constraint = new RegExp(
        `${column} is null\\s*\\n?\\s*or char_length\\(btrim\\(${column}\\)\\) between 1 and (\\d+)`,
      ).exec(MIGRATION);

      expect(constraint, `no length constraint for ${column}`).toBeTruthy();
      expect(Number(constraint?.[1]), column).toBe(limit);
    }
  });
});

describe("clinical prose is not mangled", () => {
  it("accepts the characters real clinical text contains", () => {
    // Angle brackets in a measurement, a slash in dosing shorthand, a percent
    // sign, an apostrophe, an accented name. Rejecting any of these would
    // make the field unusable for its purpose — and what protects against
    // injection is that nothing here reaches SQL as text (it is an RPC
    // parameter) or the DOM as HTML (React escapes it).
    const parsed = clinicalRecordSaveSchema.safeParse(
      saveInput({
        clinicalObservations:
          "Temp <37.5. BP 120/80. O2 98%. Patient's own words. Café.",
      }),
    );

    expect(parsed.success).toBe(true);
  });

  it("keeps a script-shaped string as text rather than rejecting it", () => {
    // A note legitimately quoting a patient is not an attack, and rejecting
    // it would train practitioners to work around the field. It is stored as
    // typed and rendered as text.
    const parsed = clinicalRecordSaveSchema.safeParse(
      saveInput({ doctorNotes: "<script>alert(1)</script>" }),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.doctorNotes).toBe(
      "<script>alert(1)</script>",
    );
  });
});
