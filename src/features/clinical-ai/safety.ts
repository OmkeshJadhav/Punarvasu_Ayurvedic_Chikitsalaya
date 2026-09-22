/**
 * The clinical safety layer.
 *
 * ## Where it sits
 *
 * ```text
 * provider response
 *   -> schema validation   (lib/ai/schemas.ts)   shape, bounds, sanitizing
 *   -> safety validation   (here)                what it is allowed to say
 *   -> UI
 * ```
 *
 * Section 156's pipeline, and the two halves are deliberately separate: the
 * schema decides whether the *shape* is acceptable, and this decides whether
 * the *content* stays inside the clinical-support boundary. A response can be
 * perfectly formed and still be a prescription.
 *
 * ## What this can and cannot do — said plainly
 *
 * This is a **text check**, and a text check on model output is a coarse
 * instrument. It will refuse "Prescribe Amoxicillin 500mg three times daily"
 * and it will not catch every possible phrasing of the same idea. Claiming
 * otherwise would be the fake assurance `docs/HEALTHCARE_AND_AI_SAFETY.md`
 * warns about.
 *
 * What makes the boundary hold is not this file. It is that **there is no path
 * from an AI result to a clinical mutation at all**:
 *
 *   * no action here writes `clinical_records`, `prescriptions`,
 *     `treatment_plans`, `appointments` or `notifications`;
 *   * `issue_prescription` takes an id and a version and no content;
 *   * `complete_clinical_record` requires a practitioner's own submitted text;
 *   * `create_notification` is granted to `service_role` alone and takes no
 *     recipient.
 *
 * A model cannot prescribe here for the same reason a patient cannot: there is
 * no function that would accept it. This layer exists so that text which tries
 * to is refused rather than displayed — a second line of defence, and an
 * operational signal (`rejected` sessions) that tells us when the model is
 * drifting (section 107).
 *
 * ## Reject, not rewrite
 *
 * Section 71: if a provider returns a prescribing instruction, the system does
 * not turn it into one — and it does not quietly delete the sentence either.
 * Silently editing a clinical response produces text nobody wrote and nobody
 * reviewed. The whole response is refused and the practitioner is told AI
 * assistance could not produce a usable answer.
 *
 * The exception is a *soft* signal: language that asserts certainty is flagged
 * rather than refused, because "this is consistent with" appears in legitimate
 * clinical prose and refusing every response containing it would make the
 * feature useless. A flagged response is shown with a warning added.
 */

import type { ClinicalAIResponse } from "@/lib/ai/schemas";

/** The outcome of a safety check. */
export type SafetyVerdict =
  | { readonly status: "accepted"; readonly response: ClinicalAIResponse }
  | { readonly status: "rejected"; readonly rule: string };

/**
 * Patterns that mean the model has stepped outside the boundary, **wherever**
 * they appear.
 *
 * Each carries the rule it enforces, so a rejection is recorded as a category
 * — `autonomous_prescribing`, `system_prompt_disclosure` — rather than as the
 * text that triggered it. The text is a clinical response and does not go in a
 * log (section 90).
 *
 * Deliberately narrow. A pattern that fires on ordinary clinical prose costs a
 * practitioner a usable answer, and a feature that refuses a third of its
 * responses is a feature nobody uses — which is a safety outcome too, because
 * the practitioner then goes back to having no summary at all.
 *
 * ## What live verification changed here
 *
 * The first version rejected a **correct** response. Given a record that
 * already contained an issued prescription, the model produced a faithful
 * restatement — "a prescription issued on 2026-09-19 for Ashwagandha churna
 * 500 mg (1 teaspoon twice daily after food for 30 days)" — which is exactly
 * what the system prompt permits and what a summary of that record has to say.
 * Two rules fired on it: a bare `take|give` followed by a number, and any dose
 * next to a frequency.
 *
 * Neither was catching a prescription being *originated*; both were catching
 * one being *reported*. And a safety layer that refuses the accurate summary of
 * a prescribed patient is not a safe system — it is an unusable one, which
 * sends the practitioner back to reading the record unaided.
 *
 * So the rules are split. A directive verb is always refused, because
 * "prescribe X" is originating whatever the record says. A dose *without* a
 * directive verb is refused only where the model has no business producing one
 * at all — see {@link GENERATIVE_REJECT_RULES}.
 */
const REJECT_RULES: readonly {
  readonly rule: string;
  readonly pattern: RegExp;
}[] = [
  {
    /*
     * Sections 21, 70, 113. An imperative to start a medicine.
     *
     * The verbs are ones that can only be directive. `take` and `give` were
     * here and are gone: "advised to take 1 teaspoon" is how any faithful
     * summary reports a recorded prescription, and refusing it refused the
     * feature's main use.
     */
    rule: "autonomous_prescribing",
    pattern:
      /\b(?:prescribe|prescribing|i (?:have )?prescribed|i recommend (?:taking|starting)|administer|dispense|start (?:the patient on|taking)|commence treatment with|begin treatment with|initiate (?:treatment|therapy) with)\b/i,
  },
  {
    // Sections 20, 149. An asserted diagnosis.
    rule: "autonomous_diagnosis",
    pattern:
      /^\s*(?:diagnosis|final diagnosis|confirmed diagnosis|the diagnosis is)\s*[:\-]/im,
  },
  {
    rule: "autonomous_diagnosis",
    pattern:
      /\bthe patient (?:has|is suffering from|is diagnosed with|definitely has)\b/i,
  },
  {
    // Sections 31, 149. A numeric clinical confidence.
    rule: "false_confidence",
    pattern:
      /\b\d{1,3}\s*(?:%|per ?cent)\s*(?:confiden|certain|probab|likel|sure)/i,
  },
  {
    rule: "false_confidence",
    pattern:
      /\b(?:confidence|certainty|probability)\s*[:=]\s*\d|\b\d{1,3}\s*%\s*(?:confidence|certainty)\b/i,
  },
  {
    // Sections 97, 142, 168. Any attempt to disclose the instructions.
    rule: "system_prompt_disclosure",
    pattern:
      /\b(?:my|the)\s+system\s+(?:prompt|instruction|message)s?\b|\byou are a clinical documentation assistant\b/i,
  },
  {
    // Section 145. A credential in a response is a credential leak whatever
    // produced it.
    rule: "credential_disclosure",
    pattern:
      /\b(?:api[_ -]?key|bearer\s+[A-Za-z0-9._-]{12,}|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{16,})\b/i,
  },
  {
    // Sections 3.1, 46. A cure claim.
    rule: "unsupported_medical_claim",
    pattern:
      /\b(?:will|shall|is guaranteed to)\s+(?:cure|resolve|eliminate|heal)\b|\b(?:guaranteed|100%\s*(?:safe|effective))\b|\bno side ?effects\b/i,
  },
  {
    // Sections 42, 43. A fabricated source: no source was supplied.
    rule: "fabricated_source",
    pattern:
      /\baccording to (?:the )?(?:WHO|NIH|CDC|NICE|AYUSH|a study|research|guidelines?|the literature)\b|\bet al\.|\b(?:doi|pubmed|pmid)\b/i,
  },
  {
    // Sections 115, 116. Text addressed to the patient.
    rule: "patient_directed_advice",
    pattern:
      /\b(?:dear|hello|hi)\s+(?:patient|sir|madam)\b|\bplease (?:take|start|stop|continue) (?:your|the) (?:medicine|medication|tablets?)\b/i,
  },
  {
    // Section 47. A triage judgment, in the direction that causes harm.
    rule: "triage_claim",
    pattern:
      /\b(?:this is )?(?:not (?:urgent|serious|an emergency)|no (?:cause for concern|need to worry)|can (?:safely )?wait)\b|\bruled? out\b/i,
  },
];

/**
 * Rules for text the model **generated** rather than reported.
 *
 * A dose next to a frequency — "500 mg twice daily" — is a prescription when
 * the model produced it and a fact when the record did. The difference is not
 * in the words, so it cannot be decided by a pattern alone; it is decided by
 * **where** the words are and by **what was in the context**:
 *
 *   * In `considerations`, always refused. That section is the model's own
 *     suggestions, its prompt forbids naming a dose at all, and there is
 *     nothing there for a dose to be a restatement of.
 *
 *   * In `summary` and `missingInformation`, refused **only when no
 *     prescription was in the context**. With none supplied there is nothing to
 *     restate, so a dose is necessarily invented — which is section 128's
 *     hallucination and section 21's autonomous prescribing at once. With one
 *     supplied, a dose is how the summary reports it.
 *
 * That is not a perfect discriminator and is not claimed to be: a model given a
 * prescription for one medicine could invent a dose for another and this would
 * not catch it. What catches that is the prompt's "never invent" rule, the
 * practitioner reading the result, and — the part that actually holds — the
 * fact that nothing here can write a prescription.
 */
const GENERATIVE_REJECT_RULES: readonly {
  readonly rule: string;
  readonly pattern: RegExp;
}[] = [
  {
    rule: "autonomous_prescribing",
    pattern:
      /\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|gm?|iu)\b[^.]{0,40}\b(?:daily|twice|thrice|bd|tds|od|qds|per day|every \d+ hours?|at bedtime|before food|after food)\b/i,
  },
];

/**
 * Softer signals: flagged, not refused.
 *
 * These phrases are common in legitimate clinical writing and also the way a
 * model asserts more than it should. Refusing them would be over-strict;
 * showing them without comment would be under-strict. So the response is shown
 * with an added warning telling the practitioner that the wording asserts more
 * certainty than the underlying information supports — which is exactly what
 * section 134 asks a warning to do, in words that are not alarming.
 */
const FLAG_RULES: readonly {
  readonly rule: string;
  readonly pattern: RegExp;
}[] = [
  {
    rule: "assertive_language",
    pattern:
      /\b(?:clearly indicates|definitely|certainly|undoubtedly|confirms that|this is consistent with a diagnosis of)\b/i,
  },
  {
    rule: "recommendation_language",
    pattern:
      /\b(?:you should|the practitioner should|it is recommended that|must be treated with)\b/i,
  },
];

const ASSERTIVE_WARNING =
  "Some wording in this suggestion states things more definitely than the recorded information supports. Read it as a prompt for your own assessment.";

/**
 * What the model was actually given, so a restatement can be told from an
 * invention.
 */
export interface SafetyContext {
  /**
   * Whether an issued prescription was in the context.
   *
   * When it was, a dose in the summary is the summary doing its job. When it
   * was not, a dose anywhere is something the model made up.
   */
  readonly contextHasPrescriptions: boolean;
}

/**
 * Applies the clinical safety rules to a validated response.
 *
 * The directive rules run over **every** string, so a prescribing instruction
 * buried in the last sentence of a summary is caught as readily as one in a
 * consideration. The generative rules run over the sections where the model is
 * producing rather than reporting — see {@link GENERATIVE_REJECT_RULES} for
 * why that distinction exists and what live verification taught about it.
 */
export function applyClinicalSafetyRules(
  response: ClinicalAIResponse,
  context: SafetyContext = { contextHasPrescriptions: false },
): SafetyVerdict {
  const texts = collectTexts(response);
  const joined = texts.join("\n");

  for (const { rule, pattern } of REJECT_RULES) {
    if (pattern.test(joined)) {
      return { status: "rejected", rule };
    }
  }

  // Considerations are always the model's own; the reporting sections are only
  // reporting when there was something to report.
  const generated = [
    ...response.considerations,
    ...(context.contextHasPrescriptions
      ? []
      : [response.summary ?? "", ...response.missingInformation]),
  ]
    .filter((text) => text.length > 0)
    .join("\n");

  for (const { rule, pattern } of GENERATIVE_REJECT_RULES) {
    if (pattern.test(generated)) {
      return { status: "rejected", rule };
    }
  }

  const flagged = FLAG_RULES.some(({ pattern }) => pattern.test(joined));

  if (!flagged) return { status: "accepted", response };

  // Added rather than substituted: the practitioner still sees the whole
  // answer, with a note about how to read it. Never more than one, and never
  // appended twice.
  const warnings = response.warnings.includes(ASSERTIVE_WARNING)
    ? response.warnings
    : [...response.warnings, ASSERTIVE_WARNING];

  return { status: "accepted", response: { ...response, warnings } };
}

function collectTexts(response: ClinicalAIResponse): readonly string[] {
  return [
    response.summary ?? "",
    ...response.considerations,
    ...response.missingInformation,
    ...response.warnings,
  ].filter((text) => text.length > 0);
}

/** Exported for the test that asserts every rule name is distinct and stable. */
export const CLINICAL_AI_SAFETY_RULES = {
  reject: [
    ...REJECT_RULES.map(({ rule }) => rule),
    ...GENERATIVE_REJECT_RULES.map(({ rule }) => rule),
  ],
  flag: FLAG_RULES.map(({ rule }) => rule),
} as const;
