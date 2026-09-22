import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canTransitionTreatmentPlan,
  isTreatmentPlanActivatable,
  isTreatmentPlanCancellable,
  isTreatmentPlanCompletable,
  isTreatmentPlanEditable,
  isTreatmentPlanPatientVisible,
  isUsableTreatmentPlanItem,
  MAX_TREATMENT_PLAN_ITEMS,
  TREATMENT_PLAN_STATUSES,
  TREATMENT_PLAN_TRANSITIONS,
  treatmentPlanActivationBlocker,
} from "./status";
import { EMPTY_TREATMENT_PLAN_ITEM, TREATMENT_PLAN_CATEGORIES } from "./types";

/**
 * The treatment plan lifecycle, mirrored against the migration.
 *
 * The same reasoning as the prescription's: the rule lives in two places on
 * purpose — in TypeScript so the workspace can decide what to render, and in
 * `treatment_plans_guard_update()` so the database refuses independently —
 * and the failure a divergence produces is a control the product offers and
 * the database refuses.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql",
    import.meta.url,
  ),
  "utf8",
);

const SQL = MIGRATION.replace(/--[^\n]*/g, "");

describe("the status vocabulary", () => {
  it("is exactly the database enum", () => {
    const enumBody =
      /create type public\.treatment_plan_status as enum \(([\s\S]*?)\);/.exec(
        SQL,
      )?.[1];

    const values = [...(enumBody ?? "").matchAll(/'(\w+)'/g)].map(
      (match) => match[1],
    );

    expect(values).toEqual([...TREATMENT_PLAN_STATUSES]);
  });

  it("reaches all four, unlike the prescription's", () => {
    // Section 45: only the states actually required. All four are used, so
    // there is no declared-and-unreachable value here to explain.
    expect(SQL).toMatch(/set status = 'active'/);
    expect(SQL).toMatch(/set status = 'completed'/);
    expect(SQL).toMatch(/set status = 'cancelled'/);
  });
});

describe("the category vocabulary", () => {
  it("is exactly the database enum", () => {
    const enumBody =
      /create type public\.treatment_plan_category as enum \(([\s\S]*?)\);/.exec(
        SQL,
      )?.[1];

    const values = [...(enumBody ?? "").matchAll(/'(\w+)'/g)].map(
      (match) => match[1],
    );

    expect(values).toEqual([...TREATMENT_PLAN_CATEGORIES]);
  });

  it("has no medication category", () => {
    // Section 28: a plan may reference a prescription and must not duplicate
    // it. Medicines have their own table, their own immutability rules and
    // their own patient visibility, and a `medication` section here would be
    // an invitation to write them twice.
    expect(TREATMENT_PLAN_CATEGORIES as readonly string[]).not.toContain(
      "medication",
    );
    expect(SQL).not.toMatch(
      /create type public\.treatment_plan_category[\s\S]*?'medication'/,
    );
  });
});

describe("the transition matrix", () => {
  it("agrees with the guard trigger, cell by cell", () => {
    const guard =
      /create function public\.treatment_plans_guard_update\(\)[\s\S]*?\$\$;/.exec(
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

    for (const status of TREATMENT_PLAN_STATUSES) {
      expect([...TREATMENT_PLAN_TRANSITIONS[status]].sort()).toEqual(
        (fromSql[status] ?? []).sort(),
      );
    }
  });

  it("never lets an active plan go back to a draft", () => {
    // Section 44: an active plan is what the patient was told to do, and
    // rewriting it would rewrite what they were told.
    expect(canTransitionTreatmentPlan("active", "draft")).toBe(false);
    expect(canTransitionTreatmentPlan("completed", "draft")).toBe(false);
    expect(canTransitionTreatmentPlan("completed", "active")).toBe(false);
  });

  it("makes completed and withdrawn terminal", () => {
    for (const status of TREATMENT_PLAN_STATUSES) {
      expect(canTransitionTreatmentPlan("completed", status)).toBe(false);
      expect(canTransitionTreatmentPlan("cancelled", status)).toBe(false);
    }
  });
});

describe("what each status allows", () => {
  it("permits editing only while it is a draft", () => {
    expect(isTreatmentPlanEditable("draft")).toBe(true);
    for (const status of ["active", "completed", "cancelled"] as const) {
      expect(isTreatmentPlanEditable(status)).toBe(false);
    }
  });

  it("is backed by a trigger that freezes an activated plan's content", () => {
    expect(SQL).toMatch(
      /old\.status <> 'draft'[\s\S]*?new\.title is distinct from old\.title/,
    );
    expect(SQL).toMatch(
      /create trigger treatment_plan_items_guard_write[\s\S]*?before insert or update or delete/,
    );
  });

  it("permits activating only a draft, and completing only an active plan", () => {
    expect(isTreatmentPlanActivatable("draft")).toBe(true);
    expect(isTreatmentPlanActivatable("active")).toBe(false);
    expect(isTreatmentPlanCompletable("active")).toBe(true);
    expect(isTreatmentPlanCompletable("draft")).toBe(false);
  });

  it("permits withdrawing a draft or an active plan, and nothing closed", () => {
    expect(isTreatmentPlanCancellable("draft")).toBe(true);
    expect(isTreatmentPlanCancellable("active")).toBe(true);
    expect(isTreatmentPlanCancellable("completed")).toBe(false);
    expect(isTreatmentPlanCancellable("cancelled")).toBe(false);
  });
});

describe("patient visibility", () => {
  it("excludes a draft and includes everything else", () => {
    expect(isTreatmentPlanPatientVisible("draft")).toBe(false);
    expect(isTreatmentPlanPatientVisible("active")).toBe(true);
    expect(isTreatmentPlanPatientVisible("completed")).toBe(true);
    expect(isTreatmentPlanPatientVisible("cancelled")).toBe(true);
  });

  it("agrees with the policy, which is what actually decides", () => {
    expect(SQL).toMatch(
      /create policy treatment_plans_select_patient[\s\S]*?status <> 'draft'/,
    );
  });
});

describe("the item cap", () => {
  it("matches the database's", () => {
    expect(SQL).toMatch(
      new RegExp(`jsonb_array_length\\(items\\) > ${MAX_TREATMENT_PLAN_ITEMS}`),
    );
    expect(SQL).toMatch(
      new RegExp(
        `treatment_plan_items_order_range check \\(sort_order between 1 and ${MAX_TREATMENT_PLAN_ITEMS}\\)`,
      ),
    );
  });
});

describe("a usable instruction", () => {
  it("needs a heading", () => {
    expect(
      isUsableTreatmentPlanItem({
        ...EMPTY_TREATMENT_PLAN_ITEM,
        title: "Warm, freshly cooked food",
      }),
    ).toBe(true);
    expect(isUsableTreatmentPlanItem(EMPTY_TREATMENT_PLAN_ITEM)).toBe(false);
    expect(
      isUsableTreatmentPlanItem({
        ...EMPTY_TREATMENT_PLAN_ITEM,
        title: "   ",
      }),
    ).toBe(false);
  });
});

describe("the activation blocker", () => {
  const item = {
    ...EMPTY_TREATMENT_PLAN_ITEM,
    title: "Warm, freshly cooked food",
  };

  it("refuses a plan that is not a draft", () => {
    expect(
      treatmentPlanActivationBlocker("active", "A plan", [item], false),
    ).toBe("not_draft");
  });

  it("refuses a plan with no title", () => {
    // A plan the patient is given must be recognisable to them. Mirrored by
    // `treatment_plans_activation_requirements`, which holds against any
    // writer.
    expect(treatmentPlanActivationBlocker("draft", "  ", [item], false)).toBe(
      "no_title",
    );
    expect(SQL).toMatch(
      /treatment_plans_activation_requirements check \([\s\S]*?title is not null/,
    );
  });

  it("refuses a plan with no instructions", () => {
    expect(treatmentPlanActivationBlocker("draft", "A plan", [], false)).toBe(
      "no_items",
    );
  });

  it("refuses while there are unsaved changes", () => {
    expect(
      treatmentPlanActivationBlocker("draft", "A plan", [item], true),
    ).toBe("unsaved");
  });

  it("allows a saved, titled draft with at least one instruction", () => {
    expect(
      treatmentPlanActivationBlocker("draft", "A plan", [item], false),
    ).toBeNull();
  });
});

describe("the follow-up date", () => {
  it("books no appointment anywhere in the migration", () => {
    // Section 47, asserted structurally because it is the kind of convenience
    // somebody adds later meaning well. Nothing in this migration writes to
    // `public.appointments` at all.
    expect(SQL).not.toMatch(/insert into public\.appointments/);
    expect(SQL).not.toMatch(/update public\.appointments/);
  });
});
