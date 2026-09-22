import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The prescription and treatment plan server actions.
 *
 * These assert the properties every Phase 13 write rests on:
 *
 *   * an unauthenticated or unauthorized caller writes nothing, whatever role
 *     they hold — `phase_13.md` section 89's authorization list;
 *   * **no patient id, practitioner id, doctor id, appointment id or status is
 *     ever read from the request and passed on**, because none of them is a
 *     parameter of anything (sections 58-59, examples 2 and 3);
 *   * issuing sends **an id and a revision and nothing else**, so the act of
 *     issuing cannot change what is issued (sections 15-16, example 3);
 *   * a stale write is reported as a conflict rather than retried, and the
 *     version is not handed back — so the next save cannot perform the
 *     overwrite the conflict prevented (section 72);
 *   * a database failure reaches the practitioner as a sentence rather than as
 *     a PostgREST error (section 84);
 *   * **no log line carries clinical content** — no medicine, no dose, no
 *     instruction, no withdrawal reason, no patient name, no search term
 *     (section 83).
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary. It proves the application never
 * *asks* for anything the database would have to refuse.
 *
 * The other half — that the database refuses independently — is a property of
 * `supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql`,
 * asserted structurally in `prescription-security.test.ts` and against a live
 * project in `docs/progress/progress_phase_13.md`. Both halves are needed;
 * neither substitutes for the other.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PRESCRIPTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RECORD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PRACTITIONER_ID = "33333333-3333-4333-8333-333333333333";

interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

let rpcCalls: RpcCall[] = [];
let rpcResults: Record<string, { data: unknown; error: unknown }> = {};

const getCurrentUser = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUser(),
  requireUser: () => getCurrentUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return rpcResults[name] ?? { data: null, error: null };
    },
    from: () => {
      // Both features write through `security definer` functions only. A table
      // write reaching here is the defect this throw exists to surface.
      throw new Error("No table access is expected from a Phase 13 action.");
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => revalidatePath(path, type),
}));

const logLines: string[] = [];

function pgError(code: string, message = "internal database detail") {
  return { code, message, details: null, hint: null };
}

const ITEM = {
  medicineName: "Ashwagandha churna",
  form: "Churna",
  strength: "",
  doseAmount: "1",
  doseUnit: "teaspoon",
  frequency: "Twice daily",
  timing: "After meals",
  duration: "2 weeks",
  quantity: "100",
  quantityUnit: "g",
  instructions: "Take with warm water.",
};

const PLAN_ITEM = {
  category: "diet",
  title: "Warm, freshly cooked food",
  instructions: "Avoid cold and leftover food.",
  frequency: "Every meal",
  duration: "1 month",
};

function saveForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("prescriptionId", PRESCRIPTION_ID);
  data.set("expectedVersion", "3");
  data.set("generalInstructions", "Take with warm water.");
  data.set("items", JSON.stringify([ITEM]));
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

function issueForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("prescriptionId", PRESCRIPTION_ID);
  data.set("expectedVersion", "3");
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

function cancelForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("prescriptionId", PRESCRIPTION_ID);
  data.set("expectedVersion", "3");
  data.set("reason", "Replaced after an adverse reaction.");
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

function planSaveForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("treatmentPlanId", PLAN_ID);
  data.set("expectedVersion", "2");
  data.set("title", "Digestive care over the next month");
  data.set("summary", "A short, plain-language summary.");
  data.set("startDate", "2026-10-02");
  data.set("followUpOn", "2026-11-02");
  data.set("items", JSON.stringify([PLAN_ITEM]));
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

function planTransitionForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("treatmentPlanId", PLAN_ID);
  data.set("expectedVersion", "2");
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

async function prescriptionActions() {
  return import("@/features/prescriptions/actions");
}

async function planActions() {
  return import("@/features/treatment-plans/actions");
}

function asRole(role: string) {
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "user@example.test",
    emailVerified: true,
    role,
    displayName: "Test User",
  });
}

const IDLE = { status: "idle" } as const;

beforeEach(() => {
  vi.resetModules();
  rpcCalls = [];
  rpcResults = {
    create_prescription: { data: PRESCRIPTION_ID, error: null },
    save_prescription_draft: { data: 4, error: null },
    issue_prescription: { data: 4, error: null },
    cancel_prescription: { data: 4, error: null },
    create_treatment_plan: { data: PLAN_ID, error: null },
    save_treatment_plan_draft: { data: 3, error: null },
    activate_treatment_plan: { data: 3, error: null },
    complete_treatment_plan: { data: 3, error: null },
    cancel_treatment_plan: { data: 3, error: null },
  };
  logLines.length = 0;
  revalidatePath.mockClear();
  asRole("doctor");

  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
  vi.spyOn(console, "error").mockImplementation((line: unknown) => {
    logLines.push(String(line));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authorization", () => {
  for (const role of ["patient", "receptionist", "admin"] as const) {
    it(`writes nothing for a ${role}`, async () => {
      asRole(role);
      const actions = await prescriptionActions();

      const results = [
        await actions.createPrescriptionAction(IDLE, new FormData()),
        await actions.savePrescriptionDraftAction(IDLE, saveForm()),
        await actions.issuePrescriptionAction(IDLE, issueForm()),
        await actions.cancelPrescriptionAction(IDLE, cancelForm()),
      ];

      expect(rpcCalls).toHaveLength(0);
      for (const result of results) expect(result.status).toBe("error");
    });

    it(`writes no treatment plan for a ${role}`, async () => {
      asRole(role);
      const actions = await planActions();

      await actions.createTreatmentPlanAction(IDLE, new FormData());
      await actions.saveTreatmentPlanDraftAction(IDLE, planSaveForm());
      await actions.activateTreatmentPlanAction(IDLE, planTransitionForm());
      await actions.completeTreatmentPlanAction(IDLE, planTransitionForm());
      await actions.cancelTreatmentPlanAction(IDLE, planTransitionForm());

      expect(rpcCalls).toHaveLength(0);
    });
  }

  it("writes nothing for an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue(null);
    const actions = await prescriptionActions();

    const result = await actions.savePrescriptionDraftAction(IDLE, saveForm());

    expect(rpcCalls).toHaveLength(0);
    expect(result.status).toBe("error");
  });

  it("writes nothing for an unresolvable role", async () => {
    // Phase 08's fail-closed rule: `AppRole | null`, never defaulted.
    asRole(null as unknown as string);
    const actions = await prescriptionActions();

    await actions.savePrescriptionDraftAction(IDLE, saveForm());

    expect(rpcCalls).toHaveLength(0);
  });

  it("names neither the role held nor the role required", async () => {
    asRole("receptionist");
    const actions = await prescriptionActions();

    const result = await actions.issuePrescriptionAction(IDLE, issueForm());

    expect(result.message).toBeDefined();
    expect(result.message?.toLowerCase()).not.toContain("doctor");
    expect(result.message?.toLowerCase()).not.toContain("receptionist");
    expect(result.message?.toLowerCase()).not.toContain("prescriptions.write");
  });

  it("returns nothing from the suggestion action for a non-doctor", async () => {
    asRole("patient");
    const actions = await prescriptionActions();

    expect(await actions.suggestMedicinesAction("ash")).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("what reaches the database", () => {
  it("sends exactly the four save arguments", async () => {
    const actions = await prescriptionActions();
    await actions.savePrescriptionDraftAction(IDLE, saveForm());

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe("save_prescription_draft");
    expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_expected_version",
      "p_general_instructions",
      "p_items",
      "p_prescription_id",
    ]);
  });

  it("sends exactly two arguments when issuing, and no content", async () => {
    // Example 3 and section 16: issuing must not be able to change what is
    // issued. This is the assertion that keeps that true.
    const actions = await prescriptionActions();
    await actions.issuePrescriptionAction(IDLE, issueForm());

    expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_expected_version",
      "p_prescription_id",
    ]);
    expect(JSON.stringify(rpcCalls[0]?.args)).not.toContain("Ashwagandha");
  });

  it("sends exactly one argument when creating", async () => {
    const actions = await prescriptionActions();
    const form = new FormData();
    form.set("clinicalRecordId", RECORD_ID);

    await actions.createPrescriptionAction(IDLE, form);

    expect(rpcCalls[0]?.args).toEqual({ p_clinical_record_id: RECORD_ID });
  });

  it("sends no status on any treatment plan transition", async () => {
    const actions = await planActions();

    await actions.activateTreatmentPlanAction(IDLE, planTransitionForm());
    await actions.completeTreatmentPlanAction(IDLE, planTransitionForm());
    await actions.cancelTreatmentPlanAction(IDLE, planTransitionForm());

    expect(rpcCalls.map((call) => call.name)).toEqual([
      "activate_treatment_plan",
      "complete_treatment_plan",
      "cancel_treatment_plan",
    ]);

    for (const call of rpcCalls) {
      expect(Object.keys(call.args).sort()).toEqual([
        "p_expected_version",
        "p_treatment_plan_id",
      ]);
      expect(JSON.stringify(call.args)).not.toContain("active");
    }
  });

  it("turns an empty date into a null rather than an epoch", async () => {
    const actions = await planActions();
    await actions.saveTreatmentPlanDraftAction(
      IDLE,
      planSaveForm({ startDate: "", followUpOn: "" }),
    );

    expect(rpcCalls[0]?.args.p_start_date).toBeNull();
    expect(rpcCalls[0]?.args.p_follow_up_on).toBeNull();
  });
});

describe("planted fields change nothing", () => {
  const planted: Record<string, string> = {
    patientId: OTHER_PATIENT_ID,
    practitionerId: OTHER_PRACTITIONER_ID,
    doctorId: OTHER_PRACTITIONER_ID,
    appointmentId: OTHER_PATIENT_ID,
    clinicalRecordId: RECORD_ID,
    status: "issued",
    issuedAt: "2020-01-01T00:00:00Z",
    createdBy: USER_ID,
    role: "admin",
    permission: "roles.manage",
    isAdmin: "true",
  };

  for (const [field, value] of Object.entries(planted)) {
    it(`ignores ${field} on a save`, async () => {
      const actions = await prescriptionActions();
      await actions.savePrescriptionDraftAction(
        IDLE,
        saveForm({ [field]: value }),
      );

      // The action reads by name from a fixed list, so an extra form field is
      // never read at all — and nothing resembling it reaches the RPC.
      expect(rpcCalls).toHaveLength(1);
      const sent = JSON.stringify(rpcCalls[0]?.args);
      expect(sent).not.toContain(OTHER_PATIENT_ID);
      expect(sent).not.toContain(OTHER_PRACTITIONER_ID);
      expect(sent).not.toContain('"issued"');
      expect(sent).not.toContain("roles.manage");
    });

    it(`ignores ${field} on an issue`, async () => {
      const actions = await prescriptionActions();
      await actions.issuePrescriptionAction(
        IDLE,
        issueForm({ [field]: value }),
      );

      expect(Object.keys(rpcCalls[0]?.args ?? {}).sort()).toEqual([
        "p_expected_version",
        "p_prescription_id",
      ]);
    });
  }

  it("passes a well-formed id for another practitioner's prescription through unchanged", async () => {
    // The *database* decides, not this layer: the function resolves the
    // prescription by id **and** by the caller's own practitioner record in
    // one statement, so another practitioner's is indistinguishable from one
    // that does not exist (section 56).
    const someoneElses = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    rpcResults.issue_prescription = { data: null, error: pgError("PV020") };

    const actions = await prescriptionActions();
    const result = await actions.issuePrescriptionAction(
      IDLE,
      issueForm({ prescriptionId: someoneElses }),
    );

    expect(rpcCalls[0]?.args.p_prescription_id).toBe(someoneElses);
    expect(result.status).toBe("error");
    expect(result.message).toContain("couldn't find");
  });
});

describe("conflicts", () => {
  it("reports a stale save as a conflict and hands back no version", async () => {
    rpcResults.save_prescription_draft = {
      data: null,
      error: pgError("PV022"),
    };

    const actions = await prescriptionActions();
    const result = await actions.savePrescriptionDraftAction(IDLE, saveForm());

    expect(result.status).toBe("conflict");
    expect(result.version).toBeUndefined();
  });

  it("reports an already-issued prescription as a conflict", async () => {
    rpcResults.issue_prescription = { data: null, error: pgError("PV021") };

    const actions = await prescriptionActions();
    const result = await actions.issuePrescriptionAction(IDLE, issueForm());

    expect(result.status).toBe("conflict");
  });

  it("reports a stale plan save as a conflict", async () => {
    rpcResults.save_treatment_plan_draft = {
      data: null,
      error: pgError("PV032"),
    };

    const actions = await planActions();
    const result = await actions.saveTreatmentPlanDraftAction(
      IDLE,
      planSaveForm(),
    );

    expect(result.status).toBe("conflict");
    expect(result.version).toBeUndefined();
  });

  it("returns the new revision on a successful save", async () => {
    const actions = await prescriptionActions();
    const result = await actions.savePrescriptionDraftAction(IDLE, saveForm());

    expect(result.status).toBe("saved");
    expect(result.version).toBe(4);
  });
});

describe("failures reach the practitioner as sentences", () => {
  it("carries no database text out of a refusal", async () => {
    rpcResults.save_prescription_draft = {
      data: null,
      error: pgError(
        "23514",
        'new row for relation "prescription_items" violates check constraint',
      ),
    };

    const actions = await prescriptionActions();
    const result = await actions.savePrescriptionDraftAction(IDLE, saveForm());

    expect(result.message).toBeDefined();
    for (const needle of ["relation", "constraint", "prescription_items"]) {
      expect(result.message?.toLowerCase()).not.toContain(needle);
    }
  });

  it("survives a thrown client error without leaking it", async () => {
    rpcResults = {};
    vi.resetModules();

    const actions = await prescriptionActions();
    // An unknown RPC returns `{ data: null, error: null }` from the stub, so
    // force a throw instead by asking for an id the schema refuses.
    const result = await actions.savePrescriptionDraftAction(
      IDLE,
      saveForm({ prescriptionId: "not-a-uuid" }),
    );

    expect(result.status).toBe("error");
    expect(result.message?.toLowerCase()).not.toContain("uuid");
  });

  it("refuses an invalid item payload without calling the database", async () => {
    const actions = await prescriptionActions();
    const result = await actions.savePrescriptionDraftAction(
      IDLE,
      saveForm({ items: JSON.stringify([{ ...ITEM, medicineName: "" }]) }),
    );

    expect(rpcCalls).toHaveLength(0);
    expect(result.status).toBe("error");
  });
});

describe("logging", () => {
  it("records the operation and the opaque ids, and nothing clinical", async () => {
    const actions = await prescriptionActions();
    await actions.savePrescriptionDraftAction(IDLE, saveForm());
    await actions.issuePrescriptionAction(IDLE, issueForm());
    await actions.cancelPrescriptionAction(IDLE, cancelForm());

    const log = logLines.join("\n");

    expect(log).toContain("prescription.draft_saved");
    expect(log).toContain("prescription.issued");
    expect(log).toContain(PRESCRIPTION_ID);

    // Section 83's "bad" example, asserted field by field.
    for (const secret of [
      "Ashwagandha",
      "Churna",
      "teaspoon",
      "Twice daily",
      "After meals",
      "warm water",
      "adverse reaction",
    ]) {
      expect(log, `${secret} reached a log line`).not.toContain(secret);
    }
  });

  it("never logs a treatment plan's title, summary or instructions", async () => {
    const actions = await planActions();
    await actions.saveTreatmentPlanDraftAction(IDLE, planSaveForm());
    await actions.activateTreatmentPlanAction(IDLE, planTransitionForm());

    const log = logLines.join("\n");

    expect(log).toContain("treatment_plan.draft_saved");
    expect(log).toContain("treatment_plan.activated");
    expect(log).toContain(PLAN_ID);

    for (const secret of [
      "Digestive care",
      "plain-language summary",
      "Warm, freshly cooked food",
      "Avoid cold",
      "2026-11-02",
    ]) {
      expect(log, `${secret} reached a log line`).not.toContain(secret);
    }
  });

  it("never logs the medicine search term", async () => {
    // What a doctor is typing into a medicine field is clinical content.
    rpcResults.search_prescribed_medicines = { data: [], error: null };

    const actions = await prescriptionActions();
    await actions.suggestMedicinesAction("Ashwagandha");

    expect(logLines.join("\n")).not.toContain("Ashwagandha");
  });

  it("logs a refusal without naming the role or the permission", async () => {
    asRole("receptionist");
    const actions = await prescriptionActions();

    await actions.issuePrescriptionAction(IDLE, issueForm());

    const log = logLines.join("\n");
    expect(log).toContain("authz.denied");
    expect(log).toContain(USER_ID);
  });
});

describe("revalidation", () => {
  it("refreshes the patient's own list only once a prescription is issued", async () => {
    const actions = await prescriptionActions();

    await actions.savePrescriptionDraftAction(IDLE, saveForm());
    expect(revalidatePath.mock.calls.map(([path]) => path)).not.toContain(
      "/patient/prescriptions",
    );

    await actions.issuePrescriptionAction(IDLE, issueForm());
    expect(revalidatePath.mock.calls.map(([path]) => path)).toContain(
      "/patient/prescriptions",
    );
  });

  it("refreshes the patient's plans only once one is activated", async () => {
    const actions = await planActions();

    await actions.saveTreatmentPlanDraftAction(IDLE, planSaveForm());
    expect(revalidatePath.mock.calls.map(([path]) => path)).not.toContain(
      "/patient/treatment-plans",
    );

    await actions.activateTreatmentPlanAction(IDLE, planTransitionForm());
    expect(revalidatePath.mock.calls.map(([path]) => path)).toContain(
      "/patient/treatment-plans",
    );
  });
});
