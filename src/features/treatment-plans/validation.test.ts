import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createTreatmentPlanSchema,
  dropBlankTreatmentPlanItems,
  isBlankTreatmentPlanItem,
  TREATMENT_PLAN_FIELD_LIMITS,
  treatmentPlanItemSchema,
  treatmentPlanSaveSchema,
  treatmentPlanTransitionSchema,
} from "./validation";
import { EMPTY_TREATMENT_PLAN_ITEM } from "./types";

/**
 * The treatment plan trust boundary.
 *
 * One hostile field at a time, and **rejected rather than stripped** — the
 * same contract every schema in this project holds to since Phase 07.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

const SQL = MIGRATION.replace(/--[^\n]*/g, "");

const SOURCE = readFileSync(new URL("./validation.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RECORD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const VALID_ITEM = {
  category: "diet" as const,
  title: "Warm, freshly cooked food",
  instructions: "Avoid cold and leftover food.",
  frequency: "Every meal",
  duration: "1 month",
};

function save(overrides: Record<string, unknown> = {}) {
  return {
    treatmentPlanId: PLAN_ID,
    expectedVersion: 2,
    title: "Digestive care over the next month",
    summary: "A short, plain-language summary.",
    startDate: "2026-10-02",
    followUpOn: "2026-11-02",
    items: JSON.stringify([VALID_ITEM]),
    ...overrides,
  };
}

const HOSTILE_FIELDS = [
  "patientId",
  "practitionerId",
  "doctorId",
  "userId",
  "appointmentId",
  "clinicalRecordId",
  "status",
  "activatedAt",
  "activatedBy",
  "completedAt",
  "createdBy",
  "role",
  "permission",
  "isAdmin",
  "version",
] as const;

describe("the save schema", () => {
  it("accepts a well-formed plan", () => {
    const parsed = treatmentPlanSaveSchema.safeParse(save());

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.items[0]?.category).toBe("diet");
  });

  for (const field of HOSTILE_FIELDS) {
    it(`rejects a request carrying ${field} rather than dropping it`, () => {
      expect(
        treatmentPlanSaveSchema.safeParse(save({ [field]: "x" })).success,
      ).toBe(false);
    });
  }

  it("rejects a hostile key inside an instruction", () => {
    expect(
      treatmentPlanSaveSchema.safeParse(
        save({ items: JSON.stringify([{ ...VALID_ITEM, patientId: "x" }]) }),
      ).success,
    ).toBe(false);
  });

  it("requires a heading on every instruction", () => {
    expect(
      treatmentPlanSaveSchema.safeParse(
        save({ items: JSON.stringify([{ ...VALID_ITEM, title: "  " }]) }),
      ).success,
    ).toBe(false);
  });

  it("refuses a category the database does not have", () => {
    for (const category of ["medication", "exercise", "anything", ""]) {
      expect(
        treatmentPlanSaveSchema.safeParse(
          save({ items: JSON.stringify([{ ...VALID_ITEM, category }]) }),
        ).success,
      ).toBe(false);
    }
  });

  it("refuses more instructions than the database will store", () => {
    expect(
      treatmentPlanSaveSchema.safeParse(
        save({
          items: JSON.stringify(Array.from({ length: 51 }, () => VALID_ITEM)),
        }),
      ).success,
    ).toBe(false);
  });

  it("accepts an empty date as an absent date", () => {
    const parsed = treatmentPlanSaveSchema.safeParse(
      save({ startDate: "", followUpOn: "" }),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.startDate).toBe("");
  });

  it("refuses a date that is not a real calendar day", () => {
    for (const date of [
      "2026-02-30",
      "not-a-date",
      "02/10/2026",
      "2026-13-01",
    ]) {
      expect(
        treatmentPlanSaveSchema.safeParse(save({ followUpOn: date })).success,
      ).toBe(false);
    }
  });
});

describe("the transition schema", () => {
  it("carries an id and a revision, and no status", () => {
    // Section 59: the server controls status transitions. Activating,
    // completing and withdrawing are three actions calling three database
    // functions, so there is no status parameter in this feature at all.
    const parsed = treatmentPlanTransitionSchema.safeParse({
      treatmentPlanId: PLAN_ID,
      expectedVersion: 2,
    });

    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.success ? parsed.data : {})).toEqual([
      "treatmentPlanId",
      "expectedVersion",
    ]);
  });

  for (const field of ["status", "title", "items", "patientId"]) {
    it(`refuses a transition request carrying ${field}`, () => {
      expect(
        treatmentPlanTransitionSchema.safeParse({
          treatmentPlanId: PLAN_ID,
          expectedVersion: 2,
          [field]: "x",
        }).success,
      ).toBe(false);
    });
  }
});

describe("the create schema", () => {
  it("takes the one identifier the doctor genuinely chooses", () => {
    expect(
      createTreatmentPlanSchema.safeParse({ clinicalRecordId: RECORD_ID })
        .success,
    ).toBe(true);
  });

  for (const field of ["patientId", "practitionerId", "status"]) {
    it(`refuses a create request carrying ${field}`, () => {
      expect(
        createTreatmentPlanSchema.safeParse({
          clinicalRecordId: RECORD_ID,
          [field]: "x",
        }).success,
      ).toBe(false);
    });
  }
});

describe("the module's own source", () => {
  it("never names a patient, practitioner or status field", () => {
    for (const forbidden of [
      "patientId",
      "practitionerId",
      "doctorId",
      "appointmentId",
      "activatedAt",
      "activatedBy",
      "createdBy",
    ]) {
      expect(SOURCE).not.toContain(forbidden);
    }
  });
});

describe("the field limits", () => {
  it("are exactly the database's check constraints", () => {
    const bounds: Array<[keyof typeof TREATMENT_PLAN_FIELD_LIMITS, string]> = [
      ["title", "treatment_plans_title_length"],
      ["summary", "treatment_plans_summary_length"],
      ["itemTitle", "treatment_plan_items_title_length"],
      ["itemInstructions", "treatment_plan_items_instructions_length"],
      ["itemFrequency", "treatment_plan_items_frequency_length"],
      ["itemDuration", "treatment_plan_items_duration_length"],
    ];

    for (const [field, constraint] of bounds) {
      const bound = new RegExp(
        `${constraint} check \\([\\s\\S]*?between 1 and (\\d+)`,
      ).exec(SQL)?.[1];

      expect(
        bound,
        `no length constraint found for ${constraint}`,
      ).toBeDefined();
      expect(Number(bound)).toBe(TREATMENT_PLAN_FIELD_LIMITS[field]);
    }
  });

  it("refuse a value one character over the bound", () => {
    expect(
      treatmentPlanItemSchema.safeParse({
        ...VALID_ITEM,
        title: "a".repeat(TREATMENT_PLAN_FIELD_LIMITS.itemTitle + 1),
      }).success,
    ).toBe(false);
  });
});

describe("blank instructions", () => {
  it("recognises a card holding nothing but its default section", () => {
    // The builder keeps an empty card at the end so "add another" is one
    // click; it must not become an error the practitioner has to clear.
    expect(isBlankTreatmentPlanItem(EMPTY_TREATMENT_PLAN_ITEM)).toBe(true);
  });

  it("does not treat a half-filled card as blank", () => {
    expect(
      isBlankTreatmentPlanItem({
        ...EMPTY_TREATMENT_PLAN_ITEM,
        instructions: "Avoid cold food.",
      }),
    ).toBe(false);
  });

  it("drops only the entirely blank ones", () => {
    const kept = dropBlankTreatmentPlanItems([
      VALID_ITEM,
      EMPTY_TREATMENT_PLAN_ITEM,
    ]);

    expect(kept).toEqual([VALID_ITEM]);
  });
});
