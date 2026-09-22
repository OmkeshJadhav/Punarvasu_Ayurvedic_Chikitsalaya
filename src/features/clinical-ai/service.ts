/**
 * The clinical AI service — the one place a provider is actually called.
 *
 * ## The sequence, and why it is in this order
 *
 * ```text
 *  1  authorize            permission, on a trusted server path
 *  2  resolve the provider absent -> not_configured, and we stop
 *  3  build the context    under RLS; unauthorized -> not_found
 *  4  serialize + bound    what leaves the building, fenced as data
 *  5  claim quota + audit  in the database, BEFORE the data leaves
 *  6  call the provider    with a timeout and at most one retry
 *  7  parse                schema; malformed -> refused, not repaired
 *  8  safety               content rules; outside the boundary -> refused
 *  9  record the outcome   metrics only
 * ```
 *
 * Step 5 sits where it does deliberately. `docs/HEALTHCARE_AND_AI_SAFETY.md`
 * section 8 requires an entry recording that AI processed a patient's record,
 * and an audit written *after* a successful call would miss precisely the
 * cases worth auditing — the one that timed out halfway, the one that was
 * refused, the one that crashed the process. Writing it first means the
 * database's record is "this was attempted", which is the true statement.
 *
 * It also means the quota is consumed before the provider is reached, so a
 * flood of concurrent requests is bounded by the database rather than by
 * whichever instance happens to serve them (section 104).
 *
 * ## Nothing here writes anything clinical
 *
 * No function in this module — or anywhere in this feature — writes
 * `clinical_records`, `prescriptions`, `prescription_items`,
 * `treatment_plans`, `appointments`, `patient_documents` or `notifications`.
 * Sections 76, 111-115. It is asserted structurally by test rather than left
 * as an intention.
 *
 * ## Failure never reaches the consultation
 *
 * Sections 49, 50, 101 and example 10. Every path below returns an outcome
 * object; none throws past its caller, and none of them touches the
 * consultation's own state. A provider outage produces a sentence in a panel
 * and nothing else changes.
 */

import "server-only";

import {
  CLINICAL_AI_RUNTIME,
  CLINICAL_AI_TASK_COPY,
  type ClinicalAITask,
} from "@/config/clinical-ai";
import { assertPermission } from "@/lib/authorization/guards";
import { logger } from "@/lib/logging/logger";
import {
  resolveClinicalAIProvider,
  type ClinicalAIFailureCode,
  type ClinicalAIProvider,
} from "@/lib/ai/provider";
import {
  parseClinicalAIResponse,
  type ClinicalAIResponse,
} from "@/lib/ai/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  buildClinicalAIContext,
  serializeClinicalAIContext,
  type ClinicalAIContextSelection,
} from "./context-builder";
import {
  describeClinicalAIDatabaseFailure,
  describeClinicalAIFailure,
} from "./errors";
import { CLINICAL_AI_SYSTEM_PROMPT, getPromptTemplate } from "./prompts";
import { applyClinicalSafetyRules, type SafetyContext } from "./safety";
import type { ClinicalAIOutcome, ClinicalAIResult } from "./types";

/**
 * Generates clinical AI support for one appointment.
 *
 * Takes an appointment id, a task and a selection. It does **not** take a
 * patient id, a practitioner id, a model, a prompt, a temperature or a token
 * limit, and there is no overload that does (sections 6-8, 93).
 */
export async function generateClinicalAISupport(input: {
  readonly appointmentId: string;
  readonly task: ClinicalAITask;
  readonly selection: ClinicalAIContextSelection;
  readonly signal?: AbortSignal;
}): Promise<ClinicalAIOutcome> {
  // 1. Authorization on a trusted server path. The database re-checks the role
  //    and the practitioner scope in `start_ai_assistance_session`, and
  //    row-level security decides what the context builder can read at all —
  //    so deleting this check would change nothing about who gets an answer.
  const user = await assertPermission("clinical_ai.use");

  // 2. An unconfigured deployment has no AI, and that is an ordinary state.
  const provider = resolveClinicalAIProvider();
  if (!provider) return fail("not_configured");

  const template = getPromptTemplate(input.task);

  // 3. Authorized, minimized context. `not_found` here means the appointment
  //    is not this practitioner's — indistinguishable from one that does not
  //    exist (sections 8, 141).
  const contextResult = await buildClinicalAIContext(
    input.appointmentId,
    input.selection,
  );

  if (contextResult.status === "not_found") {
    logger.warn("clinical_ai.context_not_found", { userId: user.id });
    return fail("context_unavailable");
  }

  if (contextResult.status === "unavailable") {
    return fail("context_unavailable");
  }

  const context = contextResult.context;
  const serialized = serializeClinicalAIContext(context);

  // 5. Quota and audit, before anything leaves. A refusal here means nothing
  //    was sent.
  const claim = await claimSession({
    appointmentId: input.appointmentId,
    task: input.task,
    promptVersion: template.version,
    provider: provider.name,
    model: provider.model,
    fingerprint: context.fingerprint,
  });

  if (!claim.ok) return fail(claim.failureCode);

  const startedAt = Date.now();

  // 6-8.
  const outcome = await invoke(provider, {
    systemPrompt: CLINICAL_AI_SYSTEM_PROMPT,
    taskPrompt: template.instruction,
    context: serialized.text,
    signal: input.signal,
    // What the safety layer needs in order to tell a restatement from an
    // invention. A dose in a summary is the summary doing its job when a
    // prescription was supplied, and a fabrication when none was.
    safety: { contextHasPrescriptions: context.prescriptions.length > 0 },
  });

  const latencyMs = Date.now() - startedAt;

  // 9. Metrics only. Never blocks the practitioner's result.
  await recordOutcome({
    sessionId: claim.sessionId,
    status:
      outcome.kind === "ok"
        ? "succeeded"
        : outcome.failureCode === "safety_rejected"
          ? "rejected"
          : "failed",
    failureCode: outcome.kind === "ok" ? null : outcome.failureCode,
    latencyMs,
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
  });

  if (outcome.kind !== "ok") {
    // The code and nothing else. Not the model's words, not the provider's,
    // not the patient, not the task's content (section 90).
    logger.warn("clinical_ai.generation_failed", {
      userId: user.id,
      failureCode: outcome.failureCode,
      task: input.task,
    });

    return fail(outcome.failureCode);
  }

  logger.info("clinical_ai.generated", {
    userId: user.id,
    task: input.task,
    promptVersion: template.version,
    latencyMs,
  });

  const allowed = CLINICAL_AI_TASK_COPY[input.task].outputs;

  const result: ClinicalAIResult = {
    task: input.task,
    // A task renders only the sections it declares. A model volunteering a
    // section the task did not ask for has it ignored rather than displayed —
    // which keeps `missing_information` from quietly becoming a place
    // considerations appear without the wording rules that go with them.
    summary: allowed.includes("summary")
      ? (outcome.response.summary ?? null)
      : null,
    considerations: allowed.includes("considerations")
      ? outcome.response.considerations
      : [],
    missingInformation: allowed.includes("missingInformation")
      ? outcome.response.missingInformation
      : [],
    warnings: outcome.response.warnings,
    contextSources: context.sources,
    contextFingerprint: context.fingerprint,
    model: provider.model,
    promptVersion: template.version,
    generatedAt: Date.now(),
  };

  return { status: "ok", result };
}

/*
 * ---------------------------------------------------------------------------
 * Provider invocation, with timeout, bounded retry, parsing and safety
 * ---------------------------------------------------------------------------
 */

type InvokeOutcome =
  | {
      readonly kind: "ok";
      readonly response: ClinicalAIResponse;
      readonly inputTokens: number | null;
      readonly outputTokens: number | null;
    }
  | {
      readonly kind: "failed";
      readonly failureCode: ClinicalAIFailureCode;
      readonly inputTokens: number | null;
      readonly outputTokens: number | null;
    };

/**
 * Calls the provider, at most twice.
 *
 * ## The retry rule
 *
 * Section 52: transient failures only. A timeout, a 5xx or a transport failure
 * is retried once; everything else is not, because every retry is this
 * patient's clinical context crossing the wire again and a request the
 * provider refused will be refused identically.
 *
 * A malformed or unsafe response is **not** retried either, which is worth
 * stating: it is tempting, because a second attempt might parse. But it would
 * double the cost and the exposure for a model that has already demonstrated
 * it is not following the contract, and "AI could not produce a usable answer"
 * is an acceptable outcome in a feature that must never block care.
 */
async function invoke(
  provider: ClinicalAIProvider,
  request: {
    systemPrompt: string;
    taskPrompt: string;
    context: string;
    signal?: AbortSignal;
    safety: SafetyContext;
  },
): Promise<InvokeOutcome> {
  let lastFailure: ClinicalAIFailureCode = "provider_unavailable";

  for (
    let attempt = 1;
    attempt <= CLINICAL_AI_RUNTIME.maxAttempts;
    attempt += 1
  ) {
    if (request.signal?.aborted) {
      return {
        kind: "failed",
        failureCode: "provider_timeout",
        inputTokens: null,
        outputTokens: null,
      };
    }

    const providerResult = await provider.generate({
      systemPrompt: request.systemPrompt,
      taskPrompt: request.taskPrompt,
      context: request.context,
      temperature: CLINICAL_AI_RUNTIME.temperature,
      maxOutputTokens: CLINICAL_AI_RUNTIME.maxOutputTokens,
      timeoutMs: CLINICAL_AI_RUNTIME.timeoutMs,
      ...(request.signal ? { signal: request.signal } : {}),
    });

    if (providerResult.status === "failed") {
      lastFailure = providerResult.failureCode;

      if (
        providerResult.retryable &&
        attempt < CLINICAL_AI_RUNTIME.maxAttempts
      ) {
        await delay(CLINICAL_AI_RUNTIME.retryDelayMs);
        continue;
      }

      return {
        kind: "failed",
        failureCode: lastFailure,
        inputTokens: null,
        outputTokens: null,
      };
    }

    const tokens = {
      inputTokens: providerResult.inputTokens,
      outputTokens: providerResult.outputTokens,
    };

    // 7. Schema first: shape, bounds, sanitizing. Refused, never repaired.
    const parsed = parseClinicalAIResponse(providerResult.text);
    if (!parsed.ok) {
      return { kind: "failed", failureCode: "invalid_response", ...tokens };
    }

    // 8. Then content. A well-formed prescription is still a prescription.
    const verdict = applyClinicalSafetyRules(parsed.response, request.safety);
    if (verdict.status === "rejected") {
      // The rule, never the text it fired on. The text is a clinical response.
      logger.warn("clinical_ai.safety_rejected", { rule: verdict.rule });
      return { kind: "failed", failureCode: "safety_rejected", ...tokens };
    }

    return { kind: "ok", response: verdict.response, ...tokens };
  }

  return {
    kind: "failed",
    failureCode: lastFailure,
    inputTokens: null,
    outputTokens: null,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 * ---------------------------------------------------------------------------
 * Quota and audit
 * ---------------------------------------------------------------------------
 */

/**
 * Consumes quota and writes the audit entry.
 *
 * Sends an appointment id, a task, a prompt version, a provider, a model and a
 * fingerprint. **No patient id and no practitioner id** — the database derives
 * both, so example 4's substituted patient has nowhere to arrive.
 */
async function claimSession(input: {
  appointmentId: string;
  task: ClinicalAITask;
  promptVersion: string;
  provider: string;
  model: string;
  fingerprint: string;
}): Promise<
  | { readonly ok: true; readonly sessionId: string }
  | { readonly ok: false; readonly failureCode: ClinicalAIFailureCode }
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .rpc("start_ai_assistance_session", {
        p_appointment_id: input.appointmentId,
        p_task: input.task,
        p_prompt_version: input.promptVersion,
        p_provider: input.provider,
        p_model: input.model,
        p_context_fingerprint: input.fingerprint,
      })
      .returns<
        {
          session_id: string;
          resolved_patient_id: string;
          resolved_clinical_record_id: string | null;
        }[]
      >();

    if (error) {
      return {
        ok: false,
        failureCode: describeClinicalAIDatabaseFailure(error),
      };
    }

    const row = data?.[0];
    if (!row) return { ok: false, failureCode: "context_unavailable" };

    return { ok: true, sessionId: row.session_id };
  } catch (error) {
    logger.error("clinical_ai.session_claim_failed", error);
    return { ok: false, failureCode: "context_unavailable" };
  }
}

/**
 * Records how it went. Failing to record does **not** fail the request.
 *
 * Section 50: an AI failure must not block clinical work, and by the same
 * reasoning an *audit* failure must not either — the provider call has already
 * happened and the practitioner is waiting. The row stays `pending`, which is
 * itself the operational signal that something went wrong at this step.
 */
async function recordOutcome(input: {
  sessionId: string;
  status: "succeeded" | "failed" | "rejected";
  failureCode: string | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
}): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("complete_ai_assistance_session", {
      p_session_id: input.sessionId,
      p_status: input.status,
      p_failure_code: input.failureCode,
      p_latency_ms: input.latencyMs,
      p_input_tokens: input.inputTokens,
      p_output_tokens: input.outputTokens,
    });
  } catch (error) {
    logger.error("clinical_ai.session_record_failed", error);
  }
}

function fail(failureCode: ClinicalAIFailureCode): ClinicalAIOutcome {
  return {
    status: "failed",
    failureCode,
    message: describeClinicalAIFailure(failureCode),
  };
}
