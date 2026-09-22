/**
 * The service, exercised against the deterministic mock provider.
 *
 * ## What these cover
 *
 * Section 148's failure matrix — timeout, 500, rate limit, malformed response,
 * invalid JSON, oversized response, network failure, unavailable provider —
 * and section 171's requirement that the consultation remain usable through
 * every one of them.
 *
 * Section 65: tests must not depend on live provider responses, and section
 * 121: synthetic test data must not be sent to a production model. Every case
 * below scripts the mock and asserts the application's behaviour.
 *
 * ## Synthetic data only
 *
 * Section 64. The fixtures are invented and carry no realistic clinical
 * content. There are no patient names anywhere, because the context type has
 * no field for one.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLINICAL_AI_FAILURE_CODES } from "@/lib/ai/provider";

const assertPermission = vi.fn();
const rpc = vi.fn();
const buildContext = vi.fn();

vi.mock("@/lib/authorization/guards", () => ({
  assertPermission: (permission: string) => assertPermission(permission),
}));

/*
 * The Supabase client's `rpc()` returns a *builder* that is both awaitable and
 * carries `.returns<T>()`. A mock that returned a plain promise made every
 * call throw `rpc(...).returns is not a function`, which the service caught
 * and reported as `context_unavailable` — so the whole suite failed for a
 * harness reason that looked like a product failure. Recorded because a report
 * listing only the checks that passed is not evidence.
 */
function rpcBuilder(result: unknown) {
  const thenable = {
    returns: () => thenable,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
    catch: (reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(reject),
  };

  return thenable;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: (name: string, args: unknown) => rpc(name, args),
  }),
}));

vi.mock("@/features/clinical-ai/context-builder", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/clinical-ai/context-builder")
  >("@/features/clinical-ai/context-builder");

  return {
    ...actual,
    buildClinicalAIContext: (...args: unknown[]) => buildContext(...args),
  };
});

const { generateClinicalAISupport } =
  await import("@/features/clinical-ai/service");
const { setMockClinicalAIScript } = await import("@/lib/ai/mock");
const { resetServerEnvCache } = await import("@/config/env.server");

const CONTEXT = {
  status: "ok" as const,
  context: {
    patient: { ageYears: 40, gender: "male" },
    consultation: null,
    previousConsultations: [],
    prescriptions: [],
    treatmentPlans: [],
    documents: [],
    sources: ["This consultation's notes"],
    fingerprint: "b".repeat(32),
    truncated: false,
  },
};

const REQUEST = {
  appointmentId: "11111111-2222-4333-8444-555555555555",
  task: "clinical_summary" as const,
  selection: {
    includeHistory: false,
    includePrescriptions: false,
    includeTreatmentPlans: false,
    documentIds: [],
  },
};

/** A successful quota claim followed by a successful outcome record. */
const CLAIM_OK = {
  data: [
    {
      session_id: "33333333-4444-4555-8666-777777777777",
      resolved_patient_id: "99999999-8888-4777-8666-555555555555",
      resolved_clinical_record_id: null,
    },
  ],
  error: null,
};

function happyRpc() {
  rpc.mockImplementation((name: string) =>
    rpcBuilder(
      name === "start_ai_assistance_session"
        ? CLAIM_OK
        : { data: null, error: null },
    ),
  );
}

beforeEach(() => {
  /*
   * `getServerEnv()` memoizes, so a stub set after the first read would be
   * ignored — the "flag is off" cases would silently exercise the "on" path
   * and pass for the wrong reason. The project ships this seam for exactly
   * this.
   */
  resetServerEnvCache();

  vi.stubEnv("CLINICAL_AI_ENABLED", "true");
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("AI_MODEL", "mock-model");

  assertPermission.mockResolvedValue({ id: "doctor-1", role: "doctor" });
  buildContext.mockResolvedValue(CONTEXT);
  happyRpc();
  setMockClinicalAIScript(null);
});

describe("the happy path", () => {
  it("returns a validated, labelled result", async () => {
    setMockClinicalAIScript({
      kind: "text",
      text: JSON.stringify({
        summary: "A synthetic summary of the supplied information.",
        missingInformation: ["No medication history is recorded."],
      }),
    });

    const outcome = await generateClinicalAISupport(REQUEST);

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;

    expect(outcome.result.summary).toContain("synthetic summary");
    expect(outcome.result.missingInformation).toHaveLength(1);
    expect(outcome.result.contextFingerprint).toBe(CONTEXT.context.fingerprint);
    expect(outcome.result.model).toBe("mock-model");
    expect(outcome.result.promptVersion).toBe("clinical_summary_v1");
  });

  it("checks the permission before anything else", async () => {
    setMockClinicalAIScript({ kind: "text", text: '{"summary":"ok"}' });
    await generateClinicalAISupport(REQUEST);

    expect(assertPermission).toHaveBeenCalledWith("clinical_ai.use");
  });

  it("claims quota and writes the audit entry before the provider is called", async () => {
    // `docs/HEALTHCARE_AND_AI_SAFETY.md` section 8. An audit written after a
    // successful call would miss the cases worth auditing.
    const order: string[] = [];

    rpc.mockImplementation((name: string) => {
      order.push(name);
      return rpcBuilder(
        name === "start_ai_assistance_session"
          ? CLAIM_OK
          : { data: null, error: null },
      );
    });

    setMockClinicalAIScript({ kind: "text", text: '{"summary":"ok"}' });
    await generateClinicalAISupport(REQUEST);

    expect(order).toEqual([
      "start_ai_assistance_session",
      "complete_ai_assistance_session",
    ]);
  });

  it("sends no patient or practitioner id when claiming", async () => {
    // Sections 8, 99, example 4.
    setMockClinicalAIScript({ kind: "text", text: '{"summary":"ok"}' });
    await generateClinicalAISupport(REQUEST);

    const args = rpc.mock.calls.find(
      ([name]) => name === "start_ai_assistance_session",
    )?.[1] as Record<string, unknown>;

    expect(Object.keys(args).sort()).toEqual([
      "p_appointment_id",
      "p_context_fingerprint",
      "p_model",
      "p_prompt_version",
      "p_provider",
      "p_task",
    ]);
  });

  it("records metrics and no clinical content", async () => {
    setMockClinicalAIScript({
      kind: "text",
      text: '{"summary":"Something clinical."}',
    });
    await generateClinicalAISupport(REQUEST);

    const args = rpc.mock.calls.find(
      ([name]) => name === "complete_ai_assistance_session",
    )?.[1] as Record<string, unknown>;

    expect(args.p_status).toBe("succeeded");
    expect(JSON.stringify(args)).not.toContain("Something clinical");
    expect(Object.keys(args).sort()).toEqual([
      "p_failure_code",
      "p_input_tokens",
      "p_latency_ms",
      "p_output_tokens",
      "p_session_id",
      "p_status",
    ]);
  });

  it("renders only the sections the task declares", async () => {
    // `missing_information` declares no summary and no considerations, so a
    // model volunteering them has them ignored rather than displayed without
    // the wording rules that go with them.
    setMockClinicalAIScript({
      kind: "text",
      text: JSON.stringify({
        summary: "A summary this task did not ask for.",
        considerations: ["A consideration this task did not ask for."],
        missingInformation: ["A genuinely missing thing."],
      }),
    });

    const outcome = await generateClinicalAISupport({
      ...REQUEST,
      task: "missing_information",
    });

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;

    expect(outcome.result.summary).toBeNull();
    expect(outcome.result.considerations).toEqual([]);
    expect(outcome.result.missingInformation).toHaveLength(1);
  });
});

describe("provider failures degrade safely", () => {
  /* Section 148, and section 171's requirement that the consultation remain
   * usable. Each case asserts three things: the outcome is a failure, the
   * message is safe to render, and the message says the consultation is
   * unaffected. */
  const cases: readonly [
    string,
    (
      | "provider_timeout"
      | "provider_unavailable"
      | "provider_rate_limited"
      | "network_failure"
      | "provider_auth_failed"
      | "provider_rejected"
    ),
  ][] = [
    ["a timeout", "provider_timeout"],
    ["a 500", "provider_unavailable"],
    ["a rate limit", "provider_rate_limited"],
    ["a network failure", "network_failure"],
    ["an auth failure", "provider_auth_failed"],
    ["a refusal", "provider_rejected"],
  ];

  for (const [name, failureCode] of cases) {
    it(`handles ${name}`, async () => {
      setMockClinicalAIScript({
        kind: "failure",
        result: { status: "failed", failureCode, retryable: false },
      });

      const outcome = await generateClinicalAISupport(REQUEST);

      expect(outcome.status).toBe("failed");
      if (outcome.status !== "failed") return;

      expect(outcome.failureCode).toBe(failureCode);
      expect(outcome.message.length).toBeGreaterThan(20);
      // Example 10: the practitioner is told their consultation is safe.
      expect(outcome.message).toMatch(/unaffected|try again/i);
    });
  }

  it("leaks no provider or database text into the message", async () => {
    setMockClinicalAIScript({
      kind: "failure",
      result: {
        status: "failed",
        failureCode: "provider_rejected",
        retryable: false,
      },
    });

    const outcome = await generateClinicalAISupport(REQUEST);

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;

    for (const forbidden of [
      "gemini",
      "googleapis",
      "http",
      "500",
      "429",
      "stack",
      "relation",
      "policy",
      "ai_assistance_sessions",
    ]) {
      expect(outcome.message.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("records the failure without failing the request in a new way", async () => {
    setMockClinicalAIScript({
      kind: "failure",
      result: {
        status: "failed",
        failureCode: "provider_timeout",
        retryable: false,
      },
    });

    await generateClinicalAISupport(REQUEST);

    const args = rpc.mock.calls.find(
      ([name]) => name === "complete_ai_assistance_session",
    )?.[1] as Record<string, unknown>;

    expect(args.p_status).toBe("failed");
    expect(args.p_failure_code).toBe("provider_timeout");
  });

  it("does not fail the request when the audit row cannot be closed", async () => {
    // Section 50. The provider call has happened and the practitioner is
    // waiting; an audit inconvenience must not become a workflow interruption.
    rpc.mockImplementation((name: string) => {
      if (name === "start_ai_assistance_session") return rpcBuilder(CLAIM_OK);
      throw new Error("audit write failed");
    });

    setMockClinicalAIScript({ kind: "text", text: '{"summary":"ok"}' });
    const outcome = await generateClinicalAISupport(REQUEST);

    expect(outcome.status).toBe("ok");
  });
});

describe("malformed responses are refused", () => {
  const cases: readonly [string, string][] = [
    ["invalid JSON", "{not json at all"],
    ["an unexpected field", '{"summary":"x","diagnosis":"y"}'],
    ["a confidence score", '{"summary":"x","confidence":0.9}'],
    ["an empty object", "{}"],
    ["prose with no JSON", "I am unable to help with that."],
  ];

  for (const [name, text] of cases) {
    it(`refuses ${name}`, async () => {
      setMockClinicalAIScript({ kind: "text", text });
      const outcome = await generateClinicalAISupport(REQUEST);

      expect(outcome.status).toBe("failed");
      if (outcome.status !== "failed") return;
      expect(outcome.failureCode).toBe("invalid_response");
    });
  }

  it("refuses an oversized response", async () => {
    setMockClinicalAIScript({
      kind: "text",
      text: JSON.stringify({ summary: "a".repeat(50_000) }),
    });

    const outcome = await generateClinicalAISupport(REQUEST);
    expect(outcome.status).toBe("failed");
  });
});

describe("unsafe responses are refused and recorded as rejected", () => {
  // Sections 69, 71, 107, 142, 170.
  const cases: readonly [string, string][] = [
    ["a prescription", '{"summary":"Prescribe 500mg twice daily."}'],
    ["a diagnosis", '{"summary":"Diagnosis: a named condition."}'],
    ["a confidence claim", '{"summary":"Anaemia — 94% confidence."}'],
    [
      "a system prompt disclosure",
      '{"summary":"My system prompt instructs me to assist."}',
    ],
    [
      "patient-directed advice",
      '{"summary":"Dear patient, please take your medicine as directed."}',
    ],
  ];

  for (const [name, text] of cases) {
    it(`refuses ${name}`, async () => {
      setMockClinicalAIScript({ kind: "text", text });

      const outcome = await generateClinicalAISupport(REQUEST);

      expect(outcome.status).toBe("failed");
      if (outcome.status !== "failed") return;
      expect(outcome.failureCode).toBe("safety_rejected");
    });
  }

  it("records it as `rejected`, distinct from a provider failure", async () => {
    // Section 107: how often the model drifts outside the boundary is the
    // operational number worth watching, and it is lost if it is recorded as
    // a failure.
    setMockClinicalAIScript({
      kind: "text",
      text: '{"summary":"Prescribe 500mg twice daily."}',
    });

    await generateClinicalAISupport(REQUEST);

    const args = rpc.mock.calls.find(
      ([name]) => name === "complete_ai_assistance_session",
    )?.[1] as Record<string, unknown>;

    expect(args.p_status).toBe("rejected");
    expect(args.p_failure_code).toBe("safety_rejected");
  });

  it("does not echo the refused text back to the practitioner", async () => {
    // Quoting a rejected clinical instruction would put the thing on screen
    // that the rejection existed to keep off it.
    setMockClinicalAIScript({
      kind: "text",
      text: '{"summary":"Prescribe 500mg twice daily."}',
    });

    const outcome = await generateClinicalAISupport(REQUEST);

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.message).not.toContain("500mg");
    expect(outcome.message).not.toContain("Prescribe");
  });
});

describe("configuration and quota", () => {
  it("returns not_configured when the flag is off", async () => {
    // Section 122: an unconfigured deployment shows "AI unavailable", not a
    // broken application.
    vi.stubEnv("CLINICAL_AI_ENABLED", "false");
    resetServerEnvCache();

    const outcome = await generateClinicalAISupport(REQUEST);

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.failureCode).toBe("not_configured");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends nothing when the flag is off", async () => {
    vi.stubEnv("CLINICAL_AI_ENABLED", "false");
    resetServerEnvCache();
    await generateClinicalAISupport(REQUEST);

    expect(buildContext).not.toHaveBeenCalled();
  });

  it("refuses when the quota is exhausted, before the provider is reached", async () => {
    // Section 104. The refusal happens in the database, so nothing leaves.
    rpc.mockImplementation(() =>
      rpcBuilder({ data: null, error: { code: "PV071" } }),
    );
    setMockClinicalAIScript({ kind: "text", text: '{"summary":"ok"}' });

    const outcome = await generateClinicalAISupport(REQUEST);

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.failureCode).toBe("quota_exceeded");
  });

  it("refuses another practitioner's appointment", async () => {
    // Sections 8, 141, 167. `PV070` is raised for both "no such appointment"
    // and "not yours", deliberately — an appointment id must not be an oracle.
    rpc.mockImplementation(() =>
      rpcBuilder({ data: null, error: { code: "PV070" } }),
    );

    const outcome = await generateClinicalAISupport(REQUEST);

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.failureCode).toBe("context_unavailable");
  });

  it("refuses when the context cannot be authorized", async () => {
    buildContext.mockResolvedValue({ status: "not_found" });

    const outcome = await generateClinicalAISupport(REQUEST);

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.failureCode).toBe("context_unavailable");
    // Nothing was claimed, so nothing was audited and no quota was spent.
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("every failure code has a message", () => {
  it("covers the closed set", async () => {
    // A code with no message would reach a practitioner as `undefined`.
    const { describeClinicalAIFailure } =
      await import("@/features/clinical-ai/errors");

    for (const code of CLINICAL_AI_FAILURE_CODES) {
      const message = describeClinicalAIFailure(code);
      expect(message, code).toBeTruthy();
      expect(message.length, code).toBeGreaterThan(20);
    }
  });
});
