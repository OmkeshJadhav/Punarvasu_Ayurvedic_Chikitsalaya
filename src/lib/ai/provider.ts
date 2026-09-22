/**
 * The clinical AI provider abstraction.
 *
 * ## One interface, so the provider is replaceable
 *
 * `phase_17.md` sections 13, 66 and 153, and `docs/ARCHITECTURE.md` section
 * 32's rule that an external service sits behind an application-level adapter.
 * The service depends on {@link ClinicalAIProvider} and knows nothing about
 * Gemini, an HTTP shape or a response envelope. Section 157: the UI must not
 * know Gemini-specific details, and section 158 forbids the SDK in a React
 * component — neither could happen here, because this module and both adapters
 * are `server-only` and a client import of any of them is a build error.
 *
 * ## The request the provider receives is already finished
 *
 * `systemPrompt` and `taskPrompt` come from the versioned registry in
 * `features/clinical-ai/prompts.ts`; `context` is the serialized output of the
 * context builder. A provider composes them and sends them. It does not build
 * a prompt, it does not choose a model, and it does not decide what context to
 * include — so there is one place each of those decisions is made and one
 * place to review when it changes (sections 125, 155).
 *
 * ## An unconfigured provider does not exist
 *
 * {@link resolveClinicalAIProvider} returns `null` when the feature is off or
 * a credential is missing. A provider that cannot answer is absent rather than
 * present and failing, so the panel can say honestly that AI is not switched
 * on and the consultation carries on untouched (sections 49, 122).
 */

import "server-only";

import { getClinicalAIConfig } from "@/config/env.server";

import { createGeminiProvider } from "./gemini";
import { createMockProvider } from "./mock";

/**
 * What a provider is asked for.
 *
 * Note what is **not** on it: a patient id, a practitioner id, a record id, a
 * user id, a storage path, a token, a URL. The provider is given clinical
 * prose and nothing that identifies a row in this database (section 60). It
 * receives no identifier it could use to ask for anything else, because it has
 * nothing to ask.
 */
export interface ClinicalAIRequest {
  /** The safety boundary. Fixed, versioned, never client-supplied. */
  readonly systemPrompt: string;
  /** What this specific task asks for. Also fixed and versioned. */
  readonly taskPrompt: string;
  /**
   * The clinical context, already minimized, already bounded, and already
   * fenced as untrusted data by the context serializer.
   */
  readonly context: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  /** Aborts an in-flight call — section 139's cancellation. */
  readonly signal?: AbortSignal;
}

/**
 * What a provider returns: **raw text and metrics**, never a parsed result.
 *
 * Parsing and validating is the safety layer's job, not the adapter's
 * (section 156). An adapter that parsed would be an adapter that could be
 * written to trust its provider, and there would then be two places a
 * malformed response is handled — one of which nobody remembers to test.
 */
export type ClinicalAIProviderResult =
  | {
      readonly status: "ok";
      readonly text: string;
      readonly inputTokens: number | null;
      readonly outputTokens: number | null;
    }
  | {
      readonly status: "failed";
      /**
       * A stable, low-cardinality category. **Never provider text**: a
       * provider's error body can echo the request back, and the request is a
       * clinical prompt (sections 90, 101).
       */
      readonly failureCode: ClinicalAIFailureCode;
      /** Whether trying again could plausibly work (section 52). */
      readonly retryable: boolean;
    };

/**
 * Every way a provider call can fail, as a closed set.
 *
 * Closed so that a new failure mode is a deliberate addition with copy written
 * for it, rather than an unrecognised string that reaches a screen.
 */
export const CLINICAL_AI_FAILURE_CODES = [
  "provider_timeout",
  "provider_unavailable",
  "provider_rate_limited",
  "provider_rejected",
  "provider_auth_failed",
  "network_failure",
  "empty_response",
  "oversized_response",
  "invalid_response",
  "safety_rejected",
  "context_unavailable",
  "quota_exceeded",
  "not_configured",
] as const;

export type ClinicalAIFailureCode = (typeof CLINICAL_AI_FAILURE_CODES)[number];

export interface ClinicalAIProvider {
  /** Short, stable, lower-case. Recorded against every invocation. */
  readonly name: string;
  readonly model: string;
  generate(request: ClinicalAIRequest): Promise<ClinicalAIProviderResult>;
}

/**
 * The provider this deployment can actually call, or `null`.
 *
 * `null` is not an error state to be handled once and forgotten: it is the
 * ordinary state of a deployment that has not been given AI, and every caller
 * treats it as "the feature is not available" rather than "something broke".
 */
export function resolveClinicalAIProvider(): ClinicalAIProvider | null {
  const config = getClinicalAIConfig();
  if (!config) return null;

  if (config.provider === "mock") {
    return createMockProvider(config.model);
  }

  // `getClinicalAIConfig` has already refused a Gemini configuration with no
  // key, so this is narrowing for the type system rather than a real branch.
  if (!config.apiKey) return null;

  return createGeminiProvider(config.apiKey, config.model);
}
