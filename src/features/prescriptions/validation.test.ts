import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createPrescriptionSchema,
  dropBlankPrescriptionItems,
  isBlankPrescriptionItem,
  medicineSuggestionSchema,
  PRESCRIPTION_FIELD_LIMITS,
  prescriptionCancelSchema,
  prescriptionIssueSchema,
  prescriptionItemSchema,
  prescriptionSaveSchema,
} from "./validation";
import { EMPTY_PRESCRIPTION_ITEM, PRESCRIPTION_ITEM_FIELDS } from "./types";

/**
 * The prescription trust boundary.
 *
 * ## The shape of these tests
 *
 * One hostile field at a time, and the assertion is **rejected, not
 * stripped**: a rejected request is visible in a log, and a silently dropped
 * field is how a `patientId` or a `status` arrives by accident and nobody
 * notices for a year.
 *
 * The limits are asserted against the migration rather than restated, because
 * a client bound looser than the database's is a save that fails for a reason
 * the doctor was never shown.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

const SQL = MIGRATION.replace(/--[^\n]*/g, "");

/**
 * The module's own text, with comments stripped — so the scan below tests the
 * schemas rather than the prose explaining why a field is absent.
 */
const SOURCE = readFileSync(new URL("./validation.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

const VALID_ITEM = {
  ...EMPTY_PRESCRIPTION_ITEM,
  medicineName: "Ashwagandha churna",
  form: "Churna",
  doseAmount: "1",
  doseUnit: "teaspoon",
  frequency: "Twice daily",
  timing: "After meals",
  duration: "2 weeks",
};

const PRESCRIPTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RECORD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function save(overrides: Record<string, unknown> = {}) {
  return {
    prescriptionId: PRESCRIPTION_ID,
    expectedVersion: 3,
    generalInstructions: "Take with warm water.",
    items: JSON.stringify([VALID_ITEM]),
    ...overrides,
  };
}

/**
 * The fields a request must never be able to set (sections 33, 58 and 59,
 * and example 2).
 *
 * Each is planted on its own so a failure names exactly which one got
 * through.
 */
const HOSTILE_FIELDS = [
  "patientId",
  "practitionerId",
  "doctorId",
  "userId",
  "profileId",
  "appointmentId",
  "clinicalRecordId",
  "status",
  "issuedAt",
  "issuedBy",
  "cancelledAt",
  "createdBy",
  "role",
  "permission",
  "isAdmin",
  "version",
] as const;

describe("the save schema", () => {
  it("accepts a well-formed prescription", () => {
    const parsed = prescriptionSaveSchema.safeParse(save());

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.items).toHaveLength(1);
    expect(parsed.success && parsed.data.items[0]?.medicineName).toBe(
      "Ashwagandha churna",
    );
  });

  for (const field of HOSTILE_FIELDS) {
    it(`rejects a request carrying ${field} rather than dropping it`, () => {
      const parsed = prescriptionSaveSchema.safeParse(
        save({ [field]: "anything" }),
      );

      // `expectedVersion` is a legitimate field, so `version` is the one that
      // must not be mistaken for it.
      expect(parsed.success).toBe(false);
    });
  }

  it("rejects a hostile key inside an item, rather than dropping it", () => {
    const parsed = prescriptionSaveSchema.safeParse(
      save({
        items: JSON.stringify([{ ...VALID_ITEM, patientId: "somebody-else" }]),
      }),
    );

    expect(parsed.success).toBe(false);
  });

  it("requires a medicine name on every item", () => {
    const parsed = prescriptionSaveSchema.safeParse(
      save({
        items: JSON.stringify([
          VALID_ITEM,
          { ...EMPTY_PRESCRIPTION_ITEM, doseAmount: "1" },
        ]),
      }),
    );

    expect(parsed.success).toBe(false);
  });

  it("refuses a payload that is not an array at all", () => {
    expect(prescriptionSaveSchema.safeParse(save({ items: "{" })).success).toBe(
      false,
    );
    expect(
      prescriptionSaveSchema.safeParse(save({ items: '"not an array"' }))
        .success,
    ).toBe(false);
  });

  it("treats an absent item payload as an empty prescription, not an error", () => {
    // A doctor who deletes every line and saves is saying "not this" — which
    // is a legitimate draft state. It is issuing an empty prescription that is
    // refused, and that is refused by the database.
    const parsed = prescriptionSaveSchema.safeParse(save({ items: "" }));

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.items).toEqual([]);
  });

  it("refuses more items than the database will store", () => {
    const parsed = prescriptionSaveSchema.safeParse(
      save({
        items: JSON.stringify(Array.from({ length: 51 }, () => VALID_ITEM)),
      }),
    );

    expect(parsed.success).toBe(false);
  });

  it("refuses a malformed prescription id", () => {
    for (const id of [
      "not-a-uuid",
      "' or 1=1 --",
      "../../etc/passwd",
      "<script>alert(1)</script>",
    ]) {
      expect(
        prescriptionSaveSchema.safeParse(save({ prescriptionId: id })).success,
      ).toBe(false);
    }
  });

  it("refuses a revision that is not a positive whole number", () => {
    for (const version of ["0", "-1", "1.5", "abc", ""]) {
      expect(
        prescriptionSaveSchema.safeParse(save({ expectedVersion: version }))
          .success,
      ).toBe(false);
    }
  });
});

describe("the issue schema", () => {
  it("carries an id and a revision, and nothing else", () => {
    // Sections 15-16 and example 3: issuing must not be able to change what is
    // issued. The proof is that there is nowhere to put content.
    const parsed = prescriptionIssueSchema.safeParse({
      prescriptionId: PRESCRIPTION_ID,
      expectedVersion: 2,
    });

    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.success ? parsed.data : {})).toEqual([
      "prescriptionId",
      "expectedVersion",
    ]);
  });

  for (const field of [...HOSTILE_FIELDS, "items", "generalInstructions"]) {
    it(`refuses an issue request carrying ${field}`, () => {
      expect(
        prescriptionIssueSchema.safeParse({
          prescriptionId: PRESCRIPTION_ID,
          expectedVersion: 2,
          [field]: "anything",
        }).success,
      ).toBe(false);
    });
  }
});

describe("the create schema", () => {
  it("takes the one identifier the doctor genuinely chooses", () => {
    const parsed = createPrescriptionSchema.safeParse({
      clinicalRecordId: RECORD_ID,
    });

    expect(parsed.success).toBe(true);
  });

  for (const field of [
    "patientId",
    "practitionerId",
    "appointmentId",
    "status",
  ]) {
    it(`refuses a create request carrying ${field}`, () => {
      expect(
        createPrescriptionSchema.safeParse({
          clinicalRecordId: RECORD_ID,
          [field]: "anything",
        }).success,
      ).toBe(false);
    });
  }
});

describe("the cancel schema", () => {
  it("accepts an optional reason", () => {
    expect(
      prescriptionCancelSchema.safeParse({
        prescriptionId: PRESCRIPTION_ID,
        expectedVersion: 2,
        reason: "",
      }).success,
    ).toBe(true);
  });

  it("bounds the reason", () => {
    expect(
      prescriptionCancelSchema.safeParse({
        prescriptionId: PRESCRIPTION_ID,
        expectedVersion: 2,
        reason: "x".repeat(301),
      }).success,
    ).toBe(false);
  });
});

describe("the suggestion schema", () => {
  it("carries a term and nothing else", () => {
    // No result count, no scope, no patient. The database clamps its own
    // limit and restricts the search to the caller's own prescribing history,
    // so there is no parameter here that could widen either.
    const parsed = medicineSuggestionSchema.safeParse({ query: "ash" });

    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.success ? parsed.data : {})).toEqual(["query"]);
  });

  for (const field of ["limit", "count", "patientId", "practitionerId"]) {
    it(`refuses a suggestion request carrying ${field}`, () => {
      expect(
        medicineSuggestionSchema.safeParse({ query: "ash", [field]: "10" })
          .success,
      ).toBe(false);
    });
  }
});

describe("the module's own source", () => {
  it("never names a patient, practitioner or status field", () => {
    // Stronger than the parse assertions: a field that is not written cannot
    // be forgotten about. `clinicalRecordId` is the deliberate exception and
    // is asserted separately above.
    for (const forbidden of [
      "patientId",
      "practitionerId",
      "doctorId",
      "appointmentId",
      "issuedAt",
      "issuedBy",
      "cancelledBy",
      "createdBy",
    ]) {
      expect(SOURCE).not.toContain(forbidden);
    }
  });

  it("has no field whose name suggests authority", () => {
    for (const forbidden of ["role", "permission", "isAdmin", "isDoctor"]) {
      expect(SOURCE.toLowerCase()).not.toContain(`${forbidden.toLowerCase()}:`);
    }
  });
});

describe("the field limits", () => {
  it("are exactly the database's check constraints", () => {
    const columns: Record<keyof typeof PRESCRIPTION_FIELD_LIMITS, string> = {
      medicineName: "medicine_name",
      form: "form",
      strength: "strength",
      doseAmount: "dose_amount",
      doseUnit: "dose_unit",
      frequency: "frequency",
      timing: "timing",
      duration: "duration",
      quantity: "quantity",
      quantityUnit: "quantity_unit",
      instructions: "instructions",
    };

    for (const [field, column] of Object.entries(columns)) {
      const pattern = new RegExp(
        `prescription_items_${column}_length check \\([\\s\\S]*?between 1 and (\\d+)`,
      );
      const bound = pattern.exec(SQL)?.[1];

      expect(bound, `no length constraint found for ${column}`).toBeDefined();
      expect(Number(bound)).toBe(
        PRESCRIPTION_FIELD_LIMITS[
          field as keyof typeof PRESCRIPTION_FIELD_LIMITS
        ],
      );
    }
  });

  it("cover every item field, with none missing and none extra", () => {
    expect(Object.keys(PRESCRIPTION_FIELD_LIMITS).sort()).toEqual(
      [...PRESCRIPTION_ITEM_FIELDS].sort(),
    );
  });

  it("refuse a value one character over the bound", () => {
    const parsed = prescriptionItemSchema.safeParse({
      ...VALID_ITEM,
      medicineName: "a".repeat(PRESCRIPTION_FIELD_LIMITS.medicineName + 1),
    });

    expect(parsed.success).toBe(false);
  });
});

describe("clinical prose is accepted, not mangled", () => {
  it("keeps the shorthand a practitioner actually writes", () => {
    // Section 49 again, from the other direction: over-strict validation is a
    // way of being wrong too. A dose written "1/2", a strength written "5%",
    // a range written "1-2" and an instruction with an apostrophe are all
    // ordinary and must survive.
    const parsed = prescriptionItemSchema.safeParse({
      ...VALID_ITEM,
      doseAmount: "1/2",
      strength: "5%",
      frequency: "1-2 times daily",
      instructions: "Take with the patient's usual evening meal (<30 min).",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.doseAmount).toBe("1/2");
    expect(parsed.success && parsed.data.strength).toBe("5%");
    expect(parsed.success && parsed.data.instructions).toContain("<30 min");
  });

  it("trims but does not otherwise rewrite", () => {
    const parsed = prescriptionItemSchema.safeParse({
      ...VALID_ITEM,
      medicineName: "  Triphala churna  ",
    });

    expect(parsed.success && parsed.data.medicineName).toBe("Triphala churna");
  });
});

describe("blank items", () => {
  it("recognises a card with nothing in it", () => {
    expect(isBlankPrescriptionItem(EMPTY_PRESCRIPTION_ITEM)).toBe(true);
    expect(
      isBlankPrescriptionItem({ ...EMPTY_PRESCRIPTION_ITEM, form: "  " }),
    ).toBe(true);
  });

  it("does not treat a half-filled card as blank", () => {
    // This is the distinction that matters: a trailing empty card must not
    // become an error the doctor has to clear, and a row with a dose but no
    // name must not silently disappear.
    expect(
      isBlankPrescriptionItem({ ...EMPTY_PRESCRIPTION_ITEM, doseAmount: "1" }),
    ).toBe(false);
  });

  it("drops only the entirely blank ones", () => {
    const kept = dropBlankPrescriptionItems([
      VALID_ITEM,
      EMPTY_PRESCRIPTION_ITEM,
      { ...EMPTY_PRESCRIPTION_ITEM, doseAmount: "1" },
    ]);

    expect(kept).toHaveLength(2);
    expect(kept[0]).toBe(VALID_ITEM);
  });
});
