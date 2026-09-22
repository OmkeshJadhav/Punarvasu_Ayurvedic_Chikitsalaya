import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canTransitionPrescription,
  isPrescriptionCancellable,
  isPrescriptionEditable,
  isPrescriptionPatientVisible,
  isUsablePrescriptionItem,
  MAX_PRESCRIPTION_ITEMS,
  PRESCRIPTION_STATUSES,
  PRESCRIPTION_TRANSITIONS,
  prescriptionIssueBlocker,
} from "./status";
import { EMPTY_PRESCRIPTION_ITEM } from "./types";

/**
 * The prescription lifecycle, and the guarantee that the TypeScript copy and
 * the SQL copy say the same thing.
 *
 * Two copies of a rule is a divergence waiting to happen, and the failure it
 * produces here is specific and user-visible: a button the workspace offers
 * and the database then refuses. So the mirror tests **parse the migration**
 * rather than restating it — a test that restated the SQL would agree with a
 * wrong migration.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

/** Comments stripped, so a scan tests the schema and not the prose about it. */
const SQL = MIGRATION.replace(/--[^\n]*/g, "");

describe("the status vocabulary", () => {
  it("is exactly the database enum", () => {
    const enumBody =
      /create type public\.prescription_status as enum \(([\s\S]*?)\);/.exec(
        SQL,
      )?.[1];

    expect(enumBody).toBeDefined();

    const values = [...(enumBody ?? "").matchAll(/'(\w+)'/g)].map(
      (match) => match[1],
    );

    expect(values).toEqual([...PRESCRIPTION_STATUSES]);
  });

  it("declares `amended` and reaches it from nothing", () => {
    // `phase_13.md` section 11 lists it as a *potential future* status, and
    // the enum declares it now for the reason Phase 09 and Phase 12 declared
    // theirs: PostgreSQL will not let a value added by
    // `alter type ... add value` be used in the same transaction.
    //
    // Nothing sets it, and this is the assertion that keeps that true. When
    // the formal amendment workflow arrives it will fail, which is exactly
    // when somebody should be reading this comment.
    expect(PRESCRIPTION_STATUSES).toContain("amended");
    expect(SQL).not.toMatch(/set[\s\S]{0,200}status = 'amended'/);
  });
});

describe("the transition matrix", () => {
  it("agrees with the guard trigger, cell by cell", () => {
    // Parsed out of `prescriptions_guard_update()`'s permitted branches,
    // which is the only place the database allows a status to change.
    const guard =
      /create function public\.prescriptions_guard_update\(\)[\s\S]*?\$\$;/.exec(
        SQL,
      )?.[0];

    expect(guard).toBeDefined();

    const branches = [
      ...(guard ?? "").matchAll(
        /old\.status = '(\w+)' and new\.status in \(([^)]*)\)/g,
      ),
    ];

    const fromSql: Record<string, string[]> = {};
    for (const [, from, targets] of branches) {
      if (!from) continue;
      fromSql[from] = [...(targets ?? "").matchAll(/'(\w+)'/g)]
        .map((match) => match[1])
        .filter((value): value is string => value !== undefined);
    }

    for (const status of PRESCRIPTION_STATUSES) {
      expect([...PRESCRIPTION_TRANSITIONS[status]].sort()).toEqual(
        (fromSql[status] ?? []).sort(),
      );
    }
  });

  it("permits a draft to be issued or withdrawn, and nothing else", () => {
    expect(canTransitionPrescription("draft", "issued")).toBe(true);
    expect(canTransitionPrescription("draft", "cancelled")).toBe(true);
    expect(canTransitionPrescription("draft", "amended")).toBe(false);
    expect(canTransitionPrescription("draft", "draft")).toBe(false);
  });

  it("never lets an issued prescription go back to a draft", () => {
    // The whole point of section 74: history does not become editable again.
    expect(canTransitionPrescription("issued", "draft")).toBe(false);
    expect(canTransitionPrescription("cancelled", "draft")).toBe(false);
    expect(canTransitionPrescription("amended", "draft")).toBe(false);
  });

  it("makes a withdrawn prescription terminal", () => {
    for (const status of PRESCRIPTION_STATUSES) {
      expect(canTransitionPrescription("cancelled", status)).toBe(false);
    }
  });
});

describe("editability", () => {
  it("is true for a draft and false for everything else", () => {
    expect(isPrescriptionEditable("draft")).toBe(true);
    expect(isPrescriptionEditable("issued")).toBe(false);
    expect(isPrescriptionEditable("cancelled")).toBe(false);
    expect(isPrescriptionEditable("amended")).toBe(false);
  });

  it("is backed by a trigger that names the content column", () => {
    // Hiding the form is a usability decision. This is what makes "issued
    // prescriptions are not silently overwritten" true — and the item half
    // is a second trigger, asserted here as well because an issued
    // prescription whose *items* could change would be just as rewritten.
    expect(SQL).toMatch(
      /old\.status <> 'draft'[\s\S]*?new\.general_instructions is distinct from old\.general_instructions/,
    );
    expect(SQL).toMatch(
      /create trigger prescription_items_guard_write[\s\S]*?before insert or update or delete/,
    );
  });
});

describe("withdrawal", () => {
  it("is offered for a draft and for an issued prescription", () => {
    expect(isPrescriptionCancellable("draft")).toBe(true);
    expect(isPrescriptionCancellable("issued")).toBe(true);
  });

  it("is not offered twice", () => {
    expect(isPrescriptionCancellable("cancelled")).toBe(false);
  });
});

describe("patient visibility", () => {
  it("excludes a draft and includes everything else", () => {
    // The application's copy of `prescriptions_select_patient`'s
    // `status <> 'draft'`. Nothing authorizes on this function; it exists so
    // a page can tell the practitioner the patient cannot see a draft yet.
    expect(isPrescriptionPatientVisible("draft")).toBe(false);
    expect(isPrescriptionPatientVisible("issued")).toBe(true);
    expect(isPrescriptionPatientVisible("cancelled")).toBe(true);
    expect(isPrescriptionPatientVisible("amended")).toBe(true);
  });

  it("agrees with the policy, which is what actually decides", () => {
    expect(SQL).toMatch(
      /create policy prescriptions_select_patient[\s\S]*?status <> 'draft'/,
    );
  });
});

describe("a usable item", () => {
  it("needs a medicine or remedy and nothing else", () => {
    // Section 49: no rule here pretends to be medically authoritative. A dose
    // is not required, a frequency is not required, a duration is not
    // required — because a remedy taken "as directed" has none of them.
    expect(
      isUsablePrescriptionItem({
        ...EMPTY_PRESCRIPTION_ITEM,
        medicineName: "Ashwagandha",
      }),
    ).toBe(true);
    expect(isUsablePrescriptionItem(EMPTY_PRESCRIPTION_ITEM)).toBe(false);
    expect(
      isUsablePrescriptionItem({ ...EMPTY_PRESCRIPTION_ITEM, doseAmount: "1" }),
    ).toBe(false);
  });

  it("does not count whitespace as a name", () => {
    expect(
      isUsablePrescriptionItem({
        ...EMPTY_PRESCRIPTION_ITEM,
        medicineName: "   ",
      }),
    ).toBe(false);
  });
});

describe("the item cap", () => {
  it("matches the database's", () => {
    expect(SQL).toMatch(
      new RegExp(`jsonb_array_length\\(items\\) > ${MAX_PRESCRIPTION_ITEMS}`),
    );
    expect(SQL).toMatch(
      new RegExp(
        `prescription_items_order_range check \\(sort_order between 1 and ${MAX_PRESCRIPTION_ITEMS}\\)`,
      ),
    );
  });
});

describe("the issue blocker", () => {
  const item = { ...EMPTY_PRESCRIPTION_ITEM, medicineName: "Ashwagandha" };

  it("refuses a prescription that is not a draft", () => {
    expect(prescriptionIssueBlocker("issued", [item], false)).toBe("not_draft");
    expect(prescriptionIssueBlocker("cancelled", [item], false)).toBe(
      "not_draft",
    );
  });

  it("refuses a prescription with nothing in it", () => {
    expect(prescriptionIssueBlocker("draft", [], false)).toBe("no_items");
    expect(
      prescriptionIssueBlocker("draft", [EMPTY_PRESCRIPTION_ITEM], false),
    ).toBe("no_items");
  });

  it("refuses while there are unsaved changes", () => {
    // `issue_prescription` sends an id and a revision and no content, so
    // anything unsaved would be silently left out of what is issued. Refusing
    // until the draft is saved is what keeps the review honest (sections 15
    // and 16, example 3).
    expect(prescriptionIssueBlocker("draft", [item], true)).toBe("unsaved");
  });

  it("allows a saved draft with at least one named item", () => {
    expect(prescriptionIssueBlocker("draft", [item], false)).toBeNull();
  });

  it("is mirrored by the database refusing an empty prescription", () => {
    // The blocker is a courtesy: it says what is missing rather than
    // disabling a control that explains nothing. This is what holds.
    expect(SQL).toMatch(
      /new\.status = 'issued'[\s\S]*?not exists \([\s\S]*?public\.prescription_items[\s\S]*?raise exception/,
    );
  });
});
