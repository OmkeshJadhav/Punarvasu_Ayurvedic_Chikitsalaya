/**
 * The Gemini adapter.
 *
 * ## `fetch`, not an SDK
 *
 * One HTTP call with a JSON body. An SDK would add a dependency, a bundling
 * surface and a second place the API key can end up, to save about forty
 * lines — and this project's other external provider (`lib/notifications/
 * providers/emailjs.ts`) is already written this way. `AGENTS.md` section 40:
 * do not add a dependency to save a few lines.
 *
 * ## The key
 *
 * Arrives as an argument from `getClinicalAIConfig()`, is put in a request
 * header, and goes nowhere else. It is never logged, never returned, never
 * placed in a URL — a key in a query string reaches every proxy's access log —
 * and `server-only` makes a client import of this module a build error
 * (sections 14, 145, 159).
 *
 * ## Nothing here interprets the response
 *
 * The adapter's whole job is: send, time out, classify the failure, return the
 * text. It does not parse JSON, apply a safety rule or decide whether the
 * answer is acceptable — those belong to the safety layer, which applies them
 * identically whatever provider produced the text (section 156).
 *
 * ## Why the provider's error text is discarded
 *
 * Section 90, and Phase 15's experience with EmailJS: a provider's error body
 * can quote the request back, and this request is a clinical prompt about an
 * identifiable person. So a failure yields a category and an HTTP status and
 * nothing else. The cost is real — it is harder to tell a wrong model id from
 * a disabled key — and the status code plus the category is the compromise
 * Phase 15 arrived at for the same trade.
 */

import "server-only";

import type {
  ClinicalAIFailureCode,
  ClinicalAIProvider,
  ClinicalAIProviderResult,
  ClinicalAIRequest,
} from "./provider";

import { CLINICAL_AI_RUNTIME } from "@/config/clinical-ai";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function createGeminiProvider(
  apiKey: string,
  model: string,
): ClinicalAIProvider {
  return {
    name: "gemini",
    model,

    async generate(
      request: ClinicalAIRequest,
    ): Promise<ClinicalAIProviderResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeoutMs);

      // The doctor's own cancellation (section 139) and the timeout both abort
      // the same request, so the provider call stops either way rather than
      // continuing to bill for a result nobody will read.
      const onExternalAbort = () => controller.abort();
      request.signal?.addEventListener("abort", onExternalAbort);

      try {
        const response = await fetch(
          `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              // In a header, never the query string.
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(buildBody(request)),
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return { status: "failed", ...classifyStatus(response.status) };
        }

        const text = await response.text();

        // Bounded before parsing, so an oversized body is refused rather than
        // held in memory and walked (section 144).
        if (text.length > CLINICAL_AI_RUNTIME.maxResponseChars) {
          return {
            status: "failed",
            failureCode: "oversized_response",
            retryable: false,
          };
        }

        return readPayload(text);
      } catch (error) {
        // An abort is a timeout or a cancellation; anything else reaching here
        // is a transport failure. Neither carries the provider's words.
        const aborted =
          error instanceof Error &&
          (error.name === "AbortError" || error.name === "TimeoutError");

        return {
          status: "failed",
          failureCode: aborted ? "provider_timeout" : "network_failure",
          retryable: true,
        };
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", onExternalAbort);
      }
    },
  };
}

/**
 * The request body.
 *
 * Three things worth naming:
 *
 *   * `systemInstruction` carries the safety boundary separately from the
 *     conversation, which is the strongest separation the API offers between
 *     "these are your instructions" and "this is data somebody else wrote"
 *     (sections 34, 94).
 *   * `responseMimeType: "application/json"` asks for structured output
 *     (section 37). It is a request, not a guarantee — the schema in
 *     `schemas.ts` is what actually decides.
 *   * safety settings are left at the provider's defaults deliberately.
 *     Loosening them for clinical text would be a decision about what a model
 *     may say about a patient, and nobody has made it.
 */
function buildBody(request: ClinicalAIRequest) {
  return {
    systemInstruction: {
      parts: [{ text: request.systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: `${request.taskPrompt}\n\n${request.context}` }],
      },
    ],
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      responseMimeType: "application/json",
    },
  };
}

/** HTTP status to a category, and whether a retry is worth the clinical data. */
function classifyStatus(status: number): {
  readonly failureCode: ClinicalAIFailureCode;
  readonly retryable: boolean;
} {
  if (status === 401 || status === 403) {
    return { failureCode: "provider_auth_failed", retryable: false };
  }
  if (status === 429) {
    return { failureCode: "provider_rate_limited", retryable: false };
  }
  if (status >= 500) {
    return { failureCode: "provider_unavailable", retryable: true };
  }
  // Every other 4xx, including a wrong model id and a body the provider will
  // not accept. Not retryable: the same request will be refused again, and a
  // retry is the patient's context crossing the wire a second time
  // (section 52).
  return { failureCode: "provider_rejected", retryable: false };
}

/** Pulls the generated text and the token counts out of the envelope. */
function readPayload(body: string): ClinicalAIProviderResult {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return {
      status: "failed",
      failureCode: "invalid_response",
      retryable: false,
    };
  }

  if (typeof payload !== "object" || payload === null) {
    return {
      status: "failed",
      failureCode: "invalid_response",
      retryable: false,
    };
  }

  const candidates = (payload as { candidates?: unknown }).candidates;
  const first = Array.isArray(candidates) ? candidates[0] : undefined;

  const text = readCandidateText(first);

  // A blocked or truncated generation arrives as a candidate with no text.
  // That is not a malformed response and it is not a provider outage: the
  // model declined, and a retry of the same clinical context would be refused
  // the same way.
  if (!text) {
    return {
      status: "failed",
      failureCode: "empty_response",
      retryable: false,
    };
  }

  const usage = (payload as { usageMetadata?: unknown }).usageMetadata;

  return {
    status: "ok",
    text,
    inputTokens: readTokenCount(usage, "promptTokenCount"),
    outputTokens: readTokenCount(usage, "candidatesTokenCount"),
  };
}

function readCandidateText(candidate: unknown): string | null {
  if (typeof candidate !== "object" || candidate === null) return null;

  const content = (candidate as { content?: unknown }).content;
  if (typeof content !== "object" || content === null) return null;

  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return null;

  const text = parts
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : "",
    )
    .join("");

  return text.trim().length > 0 ? text : null;
}

function readTokenCount(usage: unknown, key: string): number | null {
  if (typeof usage !== "object" || usage === null) return null;

  const value = (usage as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}
