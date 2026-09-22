/**
 * The deterministic mock provider.
 *
 * ## Why this exists
 *
 * `phase_17.md` sections 65 and 121: tests must not depend on live model
 * responses, and synthetic test data must not be sent to a production model.
 * Section 127 adds the rule that makes a mock the *right* answer rather than a
 * convenience — do not assert exact model wording, test structural and safety
 * properties instead. Those properties are the application's, not the model's:
 * that a malformed response is refused, that an oversized one is refused, that
 * a prescribing instruction is rejected by the safety layer, that a failure
 * degrades to the manual workflow. Every one of them is testable against a
 * provider that returns exactly what the test asked for, and none of them is
 * reliably testable against a provider that does not.
 *
 * ## It is also a real, selectable provider
 *
 * `AI_PROVIDER=mock` needs no key and reaches no network, so local development
 * can exercise the whole workflow — the panel, the loading state, the result,
 * the staleness banner, the disclaimers — without a clinic's synthetic
 * patients being sent anywhere (section 121).
 *
 * ## What it does not do
 *
 * It does not reason, and it is not a fallback. When the real provider fails,
 * the application says AI is unavailable; it does **not** quietly substitute
 * this one. A mock answer presented as a clinical summary would be the worst
 * possible failure mode — text that looks generated, in a clinical screen,
 * derived from nothing.
 */

import "server-only";

import type {
  ClinicalAIProvider,
  ClinicalAIProviderResult,
  ClinicalAIRequest,
} from "./provider";

/**
 * A scripted response, for a test that needs a specific provider behaviour.
 *
 * Set by {@link setMockClinicalAIScript} and consumed once. A test that wants
 * to see how the safety layer handles a prescribing instruction scripts one;
 * a test that wants a timeout scripts a failure.
 */
type MockScript =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "failure";
      readonly result: Extract<ClinicalAIProviderResult, { status: "failed" }>;
    };

let script: MockScript | null = null;

/** Scripts the next mock call. Test seam; no production caller. */
export function setMockClinicalAIScript(next: MockScript | null): void {
  script = next;
}

export function createMockProvider(model: string): ClinicalAIProvider {
  return {
    name: "mock",
    model,

    async generate(
      request: ClinicalAIRequest,
    ): Promise<ClinicalAIProviderResult> {
      if (request.signal?.aborted) {
        return {
          status: "failed",
          failureCode: "provider_timeout",
          retryable: true,
        };
      }

      const scripted = script;
      script = null;

      if (scripted?.kind === "failure") return scripted.result;

      const text = scripted?.kind === "text" ? scripted.text : synthesize();

      return {
        status: "ok",
        text,
        // Deterministic and obviously synthetic. A mock that invented
        // plausible token counts would put fiction into the cost metrics.
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}

/**
 * The default answer.
 *
 * Deliberately says nothing clinical. It does not name a condition, a
 * medicine, a finding or a value, because a mock response is copied into
 * screenshots and fixtures and `docs/HEALTHCARE_AND_AI_SAFETY.md` section 2 is
 * explicit that realistic-looking fake clinical content does not become
 * harmless for being sample data.
 *
 * It states what it is, which is the one thing a developer looking at it needs
 * to know.
 */
function synthesize(): string {
  return JSON.stringify({
    summary:
      "This is a placeholder response from the mock AI provider. No model was called and no clinical information was analysed. Configure a provider to use clinical AI support.",
    considerations: [],
    missingInformation: [
      "The mock provider does not read the clinical context, so it cannot identify what is missing.",
    ],
    warnings: [],
  });
}
