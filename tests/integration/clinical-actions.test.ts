import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The clinical server actions.
 *
 * These assert the properties every clinical write rests on:
 *
 *   * an unauthenticated or unauthorized caller writes nothing, whatever role
 *     they hold — `phase_12.md` section 85's authorization list;
 *   * **no practitioner id, doctor id, patient id, appointment id, status,
 *     completion timestamp or author is ever read from the request and passed
 *     on**, because none of them is a parameter of anything (examples 3 and
 *     4);
 *   * a stale write is reported as a conflict rather than retried, and the
 *     version is not handed back — so the next save cannot perform the
 *     overwrite the conflict prevented (section 34);
 *   * completion validates before it calls, and a database failure reaches
 *     the practitioner as a sentence rather than as a PostgREST error;
 *   * **no log line carries clinical content**, a patient's name or a record's
 *     text (section 43, example 7).
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary. It proves the application never
 * *asks* for anything the database would have to refuse.
 *
 * The other half — that the database refuses independently — is a property of
 * `supabase/migrations/20260923120000_clinical_records.sql`, asserted
 * structurally in `clinical-security.test.ts` and against a live project in
 * `docs/progress/progress_phase_12.md`. Both halves are needed; neither
 * substitutes for the other. The same split Phases 07 to 11 recorded.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPOINTMENT_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_PATIENT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PRACTITIONER_ID = "33333333-3333-4333-8333-333333333333";

/** Every RPC the stubbed client was asked to make, in order. */
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
      // The clinical feature writes through functions only. A table write
      // reaching here is the defect this throw exists to surface.
      throw new Error("No table access is expected from a clinical action.");
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

const logLines: string[] = [];

/** A PostgREST error, in the shape `supabase-js` hands back. */
function pgError(code: string, message = "internal database detail") {
  return { code, message, details: null, hint: null };
}

function saveForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("recordId", RECORD_ID);
  data.set("expectedVersion", "4");
  data.set("chiefComplaint", "Recorded.");
  data.set("historyOfPresentingConcern", "Recorded.");
  data.set("symptoms", "Recorded.");
  data.set("clinicalObservations", "Recorded.");
  data.set("assessment", "Recorded.");
  data.set("diagnosisOrClinicalImpression", "Recorded.");
  data.set("doctorNotes", "Recorded.");
  data.set("followUpNotes", "Recorded.");
  for (const [name, value] of Object.entries(overrides)) {
    data.set(name, value);
  }
  return data;
}

function startForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("appointmentId", APPOINTMENT_ID);
  for (const [name, value] of Object.entries(overrides)) {
    data.set(name, value);
  }
  return data;
}

async function loadActions() {
  return import("@/features/clinical/actions");
}

function asDoctor() {
  getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "doctor@example.test",
    emailVerified: true,
    role: "doctor",
    displayName: "Test Doctor",
  });
}

beforeEach(() => {
  vi.resetModules();
  rpcCalls = [];
  rpcResults = {
    start_consultation: { data: RECORD_ID, error: null },
    save_clinical_draft: { data: 5, error: null },
    complete_clinical_record: { data: 5, error: null },
  };
  logLines.length = 0;
  revalidatePath.mockClear();

  asDoctor();

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
  it.each([
    ["patient", "patient"],
    ["receptionist", "receptionist"],
    ["admin", "admin"],
    ["no role", null],
  ])("writes nothing for a %s", async (_label, role) => {
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "someone@example.test",
      emailVerified: true,
      role,
      displayName: "Someone",
    });

    const {
      startConsultationAction,
      saveClinicalDraftAction,
      completeClinicalRecordAction,
    } = await loadActions();

    for (const [action, form] of [
      [startConsultationAction, startForm()],
      [saveClinicalDraftAction, saveForm()],
      [completeClinicalRecordAction, saveForm()],
    ] as const) {
      const state = await action({ status: "idle" }, form);
      expect(state.status).toBe("error");
    }

    expect(rpcCalls).toHaveLength(0);
  });

  it("refuses without naming a role or a permission", async () => {
    // `phase_08.md` section 12 and `phase_12.md` section 44.
    getCurrentUser.mockResolvedValue({
      id: USER_ID,
      email: "someone@example.test",
      emailVerified: true,
      role: "receptionist",
      displayName: "Someone",
    });

    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction({ status: "idle" }, saveForm());

    // "You don't have permission to do that" is fine — it is the *which*
    // that must not be disclosed: no role name, and no permission name.
    expect(state.message).not.toMatch(
      /doctor|receptionist|practitioner|admin|clinical_records\.|patients\.read/i,
    );
  });

  it("writes nothing when the session has ended, and says so", async () => {
    // A page of typing is at stake, so the message must not be the generic
    // "try again" a practitioner would retry forever.
    getCurrentUser.mockResolvedValue(null);

    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction({ status: "idle" }, saveForm());

    expect(rpcCalls).toHaveLength(0);
    expect(state.status).toBe("error");
    expect(state.message).toMatch(/sign in/i);
    expect(state.message).toMatch(/have not been saved/i);
  });
});

describe("what crosses the boundary", () => {
  it("sends exactly an appointment id when starting a consultation", async () => {
    const { startConsultationAction } = await loadActions();
    await startConsultationAction({ status: "idle" }, startForm());

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe("start_consultation");
    expect(Object.keys(rpcCalls[0]?.args ?? {})).toEqual(["p_appointment_id"]);
    expect(rpcCalls[0]?.args.p_appointment_id).toBe(APPOINTMENT_ID);
  });

  it("sends exactly a record id, a version and the eight fields on a save", async () => {
    const { saveClinicalDraftAction } = await loadActions();
    await saveClinicalDraftAction({ status: "idle" }, saveForm());

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]?.name).toBe("save_clinical_draft");
    expect([...Object.keys(rpcCalls[0]?.args ?? {})].sort()).toEqual([
      "p_assessment",
      "p_chief_complaint",
      "p_clinical_observations",
      "p_diagnosis_or_clinical_impression",
      "p_doctor_notes",
      "p_expected_version",
      "p_follow_up_notes",
      "p_history_of_presenting_concern",
      "p_record_id",
      "p_symptoms",
    ]);
  });

  it("sends the same argument list when completing", async () => {
    const { completeClinicalRecordAction } = await loadActions();
    await completeClinicalRecordAction({ status: "idle" }, saveForm());

    expect(rpcCalls[0]?.name).toBe("complete_clinical_record");
    expect([...Object.keys(rpcCalls[0]?.args ?? {})].sort()).toEqual([
      "p_assessment",
      "p_chief_complaint",
      "p_clinical_observations",
      "p_diagnosis_or_clinical_impression",
      "p_doctor_notes",
      "p_expected_version",
      "p_follow_up_notes",
      "p_history_of_presenting_concern",
      "p_record_id",
      "p_symptoms",
    ]);
  });

  it.each([
    ["doctorId", OTHER_PRACTITIONER_ID],
    ["practitionerId", OTHER_PRACTITIONER_ID],
    ["patientId", OTHER_PATIENT_ID],
    ["appointmentId", APPOINTMENT_ID],
    ["status", "completed"],
    ["completedAt", "2026-01-01T00:00:00Z"],
    ["completedBy", USER_ID],
    ["createdBy", USER_ID],
    ["role", "admin"],
    ["permission", "roles.manage"],
    ["isAdmin", "true"],
    ["version", "999"],
    ["prescription", "anything"],
    ["treatmentPlan", "anything"],
    ["documentId", "anything"],
  ])("a planted %s changes nothing", async (field, value) => {
    // Two things are asserted at once, and the second matters more.
    //
    // The action reads the form through a fixed field list, so an extra field
    // is never read. And the RPC argument list is unchanged, so even a field
    // that somehow got through would have nowhere to go: the patient and the
    // practitioner are read out of the appointment inside the database, and
    // the status is set by the function.
    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction(
      { status: "idle" },
      saveForm({ [field]: value }),
    );

    expect(state.status).toBe("saved");
    expect(rpcCalls).toHaveLength(1);

    const args = rpcCalls[0]?.args ?? {};
    expect(JSON.stringify(args)).not.toContain(value);
    expect(args.p_record_id).toBe(RECORD_ID);
    expect(args.p_expected_version).toBe(4);
  });

  it("passes a well-formed record id straight through, so the database decides", async () => {
    // A record id for another practitioner's consultation is well-formed and
    // is *not* rejected here — `clinical_records_select_author` and the
    // function's own `practitioner_id = practitioner` clause are what refuse
    // it, and they answer "not found", which is indistinguishable from an id
    // that never existed (section 57).
    //
    // Refusing it in the application would be pretending to be the boundary.
    const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    rpcResults.save_clinical_draft = {
      data: null,
      error: pgError("PV018", "Clinical record not found."),
    };

    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction(
      { status: "idle" },
      saveForm({ recordId: other }),
    );

    expect(rpcCalls[0]?.args.p_record_id).toBe(other);
    expect(state.status).toBe("error");
    expect(state.message).toMatch(/couldn't find that consultation/i);
  });
});

describe("saving a draft", () => {
  it("returns the new version so editing can continue", async () => {
    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction({ status: "idle" }, saveForm());

    expect(state.status).toBe("saved");
    expect(state.version).toBe(5);
    expect(state.savedAt).toBeTypeOf("number");
  });

  it("accepts an incomplete draft", async () => {
    // Section 15: a draft may be incomplete. The completion requirements are
    // checked only when completing.
    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction(
      { status: "idle" },
      saveForm({ chiefComplaint: "", assessment: "" }),
    );

    expect(state.status).toBe("saved");
    expect(rpcCalls).toHaveLength(1);
  });

  it("reports a stale write as a conflict and hands back no version", async () => {
    // Section 34. Handing back a version after a conflict would let the next
    // save overwrite the very documentation the conflict protected.
    rpcResults.save_clinical_draft = {
      data: null,
      error: pgError("PV015", "This clinical record was updated elsewhere."),
    };

    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction({ status: "idle" }, saveForm());

    expect(state.status).toBe("conflict");
    expect(state.version).toBeUndefined();
    expect(state.message).toMatch(/reload/i);
    expect(state.message).not.toContain(
      "This clinical record was updated elsewhere.",
    );
  });

  it("reports a completed record as a conflict rather than a retryable error", async () => {
    rpcResults.save_clinical_draft = {
      data: null,
      error: pgError("PV016"),
    };

    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction({ status: "idle" }, saveForm());

    expect(state.status).toBe("conflict");
    expect(state.message).toMatch(/completed/i);
  });

  it("turns a database failure into a sentence carrying no database text", async () => {
    rpcResults.save_clinical_draft = {
      data: null,
      error: pgError(
        "42501",
        'new row violates row-level security policy for table "clinical_records"',
      ),
    };

    const { saveClinicalDraftAction } = await loadActions();
    const state = await saveClinicalDraftAction({ status: "idle" }, saveForm());

    expect(state.status).toBe("error");
    expect(state.message).not.toMatch(/row-level|policy|clinical_records/i);
  });
});

describe("completing a consultation", () => {
  it("validates the required fields before it calls", async () => {
    // Section 38. Checked here so the practitioner is told *which* field is
    // missing while they can still see it — and checked twice more in the
    // database, which is what actually holds.
    const { completeClinicalRecordAction } = await loadActions();
    const state = await completeClinicalRecordAction(
      { status: "idle" },
      saveForm({ chiefComplaint: "", assessment: "   " }),
    );

    expect(rpcCalls).toHaveLength(0);
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.chiefComplaint).toBeTruthy();
    expect(state.fieldErrors?.assessment).toBeTruthy();
  });

  it("reports completion only after the database has confirmed it", async () => {
    // Example 9's anti-pattern is the UI changing status while the database
    // update happens later. The status returned here is produced *after* the
    // RPC has returned without error.
    const { completeClinicalRecordAction } = await loadActions();
    const state = await completeClinicalRecordAction(
      { status: "idle" },
      saveForm(),
    );

    expect(rpcCalls).toHaveLength(1);
    expect(state.status).toBe("completed");
    expect(state.version).toBe(5);
  });

  it("does not report completion when the database refused", async () => {
    rpcResults.complete_clinical_record = {
      data: null,
      error: pgError("PV017"),
    };

    const { completeClinicalRecordAction } = await loadActions();
    const state = await completeClinicalRecordAction(
      { status: "idle" },
      saveForm(),
    );

    expect(state.status).not.toBe("completed");
    expect(state.message).toMatch(/chief complaint/i);
  });

  it("revalidates the pages a completion changes", async () => {
    const { completeClinicalRecordAction } = await loadActions();
    await completeClinicalRecordAction({ status: "idle" }, saveForm());

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toContain("/doctor");
    expect(paths).toContain("/doctor/appointments");
  });
});

describe("starting a consultation", () => {
  it("is idempotent from the caller's side", async () => {
    // A double-click, a retry and a refresh all report success, because
    // `start_consultation` reads back the record that exists rather than
    // failing. The unique index is what makes two genuinely concurrent
    // requests resolve to one row (section 87).
    const { startConsultationAction } = await loadActions();

    const first = await startConsultationAction(
      { status: "idle" },
      startForm(),
    );
    const second = await startConsultationAction(
      { status: "idle" },
      startForm(),
    );

    expect(first.status).toBe("saved");
    expect(second.status).toBe("saved");
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[1]?.args.p_appointment_id).toBe(APPOINTMENT_ID);
  });

  it("explains an ineligible appointment rather than failing generically", async () => {
    rpcResults.start_consultation = {
      data: null,
      error: pgError("PV008", "This appointment is not ready."),
    };

    const { startConsultationAction } = await loadActions();
    const state = await startConsultationAction(
      { status: "idle" },
      startForm(),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/checked in/i);
  });

  it("answers not-found for another practitioner's appointment", async () => {
    rpcResults.start_consultation = {
      data: null,
      error: pgError("PV009", "Appointment not found."),
    };

    const { startConsultationAction } = await loadActions();
    const state = await startConsultationAction(
      { status: "idle" },
      startForm(),
    );

    expect(state.message).toMatch(/couldn't find that appointment/i);
  });
});

describe("logging", () => {
  /** Every clinical word the fixture writes, plus the identifiers. */
  const SENSITIVE = [
    "Recorded.",
    "chief_complaint",
    "chiefComplaint",
    "assessment",
    "symptoms",
    "diagnosis",
    "Priya",
    "9999999999",
  ];

  it("carries no clinical content on a successful save", async () => {
    // Section 43 and example 7. The log says a record was saved and by whom;
    // it never becomes a second copy of the medical record.
    const { saveClinicalDraftAction } = await loadActions();
    await saveClinicalDraftAction(
      { status: "idle" },
      saveForm({
        chiefComplaint: "Priya reports a headache",
        doctorNotes: "9999999999",
      }),
    );

    const log = logLines.join("\n");
    expect(log).toContain("clinical.draft_saved");
    for (const word of SENSITIVE) {
      expect(log, word).not.toContain(word);
    }
  });

  it("carries no clinical content on a failure", async () => {
    rpcResults.save_clinical_draft = {
      data: null,
      error: pgError("PV015"),
    };

    const { saveClinicalDraftAction } = await loadActions();
    await saveClinicalDraftAction(
      { status: "idle" },
      saveForm({ assessment: "Priya reports a headache" }),
    );

    const log = logLines.join("\n");
    expect(log).toContain("clinical.stale_write");
    expect(log).not.toContain("Priya");
    expect(log).not.toContain("headache");
  });

  it("logs the actor and the record, and no patient", async () => {
    const { completeClinicalRecordAction } = await loadActions();
    await completeClinicalRecordAction({ status: "idle" }, saveForm());

    const log = logLines.join("\n");
    expect(log).toContain("clinical.record_completed");
    expect(log).toContain(RECORD_ID);
    expect(log).not.toContain(OTHER_PATIENT_ID);
  });
});
