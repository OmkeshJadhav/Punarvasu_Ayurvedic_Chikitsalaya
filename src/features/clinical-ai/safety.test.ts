/**
 * The clinical safety layer's tests.
 *
 * ## What these prove, and what they do not
 *
 * They prove that **this application** refuses a response that steps outside
 * the clinical-support boundary. They do not prove that a model will never
 * produce one — nothing can — and they are not written as though they did.
 *
 * Section 127: do not assert exact model wording, test structural and safety
 * properties. So every case below is a *response we construct*, fed to the
 * layer, with an asserted verdict. That makes them deterministic, fast, and
 * about the code under test rather than about a provider's mood.
 *
 * The cases are drawn from sections 142, 170 and the few-shot safety matrix in
 * section 173.
 */

import { describe, expect, it } from "vitest";

import { applyClinicalSafetyRules, CLINICAL_AI_SAFETY_RULES } from "./safety";

function response(overrides: {
  summary?: string;
  considerations?: string[];
  missingInformation?: string[];
  warnings?: string[];
}) {
  return {
    summary: overrides.summary,
    considerations: overrides.considerations ?? [],
    missingInformation: overrides.missingInformation ?? [],
    warnings: overrides.warnings ?? [],
  };
}

describe("autonomous prescribing is refused", () => {
  // Sections 21, 70, 113, 142, 170, and examples 2 and 9.
  const cases = [
    "Prescribe Ashwagandha churna 500mg twice daily for 14 days.",
    "Start the patient on 250 mg of the formulation each morning.",
    "Give the patient 10 ml twice daily before food.",
    "Triphala 5 gm at bedtime, continue for one month.",
    "Recommended: 1000mg daily after food.",
  ];

  for (const text of cases) {
    it(`refuses: ${text.slice(0, 40)}…`, () => {
      const verdict = applyClinicalSafetyRules(
        response({ considerations: [text] }),
      );
      expect(verdict.status).toBe("rejected");
    });
  }

  it("refuses a prescribing instruction buried in a summary", () => {
    // The rules run over every string, not only the list sections — a
    // prescription in the last sentence of a summary is still a prescription.
    const verdict = applyClinicalSafetyRules(
      response({
        summary:
          "The patient reports fatigue over three weeks. Prescribe 500mg twice daily.",
      }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses rather than editing the sentence out", () => {
    // Section 71. Silently deleting a sentence produces clinical text nobody
    // wrote and nobody reviewed.
    const verdict = applyClinicalSafetyRules(
      response({
        summary: "A useful and entirely safe summary of the consultation.",
        considerations: ["Prescribe 500 mg twice daily."],
      }),
    );

    expect(verdict.status).toBe("rejected");
    if (verdict.status === "rejected") {
      expect(verdict.rule).toBe("autonomous_prescribing");
    }
  });

  it("still allows restating a prescription the record already holds", () => {
    // The record legitimately contains what was prescribed, and a summary of
    // the record has to be able to say so. Reported in the past tense, with no
    // instruction, it is a restatement rather than a prescription.
    const verdict = applyClinicalSafetyRules(
      response({
        summary:
          "A prescription was issued at the previous consultation and is recorded in the patient's history.",
      }),
    );
    expect(verdict.status).toBe("accepted");
  });
});

describe("a recorded prescription may be restated, and only restated", () => {
  /*
   * The distinction live verification forced.
   *
   * Given a record containing an issued prescription, the configured model
   * produced this summary — a faithful, correct restatement, and exactly what
   * the system prompt permits. The first version of this layer refused it,
   * which would have made the feature useless for any prescribed patient.
   *
   * The text is the model's own, kept verbatim, because a regression here
   * would be invisible against a paraphrase.
   */
  const LIVE_RESTATEMENT =
    "A 41-year-old female presented on 2026-09-20 reporting a chief complaint of tiredness for approximately three weeks. The patient record documents a prescription issued on 2026-09-19 for Ashwagandha churna 500 mg (1 teaspoon twice daily after food for 30 days) and Triphala powder 5 gm (at bedtime for 30 days).";

  it("accepts the live restatement when a prescription was in the context", () => {
    const verdict = applyClinicalSafetyRules(
      response({ summary: LIVE_RESTATEMENT }),
      { contextHasPrescriptions: true },
    );
    expect(verdict.status).toBe("accepted");
  });

  it("refuses the same text when no prescription was supplied", () => {
    // With nothing to restate, a dose is necessarily invented — section 128's
    // hallucination and section 21's prescribing at once.
    const verdict = applyClinicalSafetyRules(
      response({ summary: LIVE_RESTATEMENT }),
      { contextHasPrescriptions: false },
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses a dose in considerations even when a prescription was supplied", () => {
    // That section is the model's own suggestions and its prompt forbids
    // naming a dose at all, so there is nothing there for one to be a
    // restatement of.
    const verdict = applyClinicalSafetyRules(
      response({ considerations: ["Ashwagandha churna 500 mg twice daily."] }),
      { contextHasPrescriptions: true },
    );
    expect(verdict.status).toBe("rejected");
  });

  it("still refuses a directive verb when a prescription was supplied", () => {
    // "Prescribe X" originates whatever the record contains, so the directive
    // rules are never relaxed by context.
    const verdict = applyClinicalSafetyRules(
      response({ summary: "Prescribe a further course of the same remedy." }),
      { contextHasPrescriptions: true },
    );
    expect(verdict.status).toBe("rejected");
  });

  it("accepts an ordinary report of what the patient was advised to take", () => {
    // `take` was a rejection verb and is not one any more: this is how every
    // faithful summary reports a recorded prescription.
    const verdict = applyClinicalSafetyRules(
      response({
        summary:
          "The patient was advised to take 1 teaspoon twice daily after food.",
      }),
      { contextHasPrescriptions: true },
    );
    expect(verdict.status).toBe("accepted");
  });

  it("defaults to the strict reading when no context is given", () => {
    // A caller that forgets to say gets the safe answer.
    const verdict = applyClinicalSafetyRules(
      response({ summary: "Take 500 mg twice daily." }),
    );
    expect(verdict.status).toBe("rejected");
  });
});

describe("autonomous diagnosis is refused", () => {
  // Sections 20, 142, 170, example 1.
  it("refuses an asserted diagnosis line", () => {
    const verdict = applyClinicalSafetyRules(
      response({ summary: "Diagnosis: iron deficiency anaemia." }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses 'the patient has'", () => {
    const verdict = applyClinicalSafetyRules(
      response({ considerations: ["The patient has a thyroid disorder."] }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("accepts the same idea phrased as a consideration", () => {
    // This is the phrasing the whole feature exists to produce, so it must
    // survive — a safety layer that refused it would make the feature useless
    // and push the practitioner back to having nothing.
    const verdict = applyClinicalSafetyRules(
      response({
        considerations: [
          "It may be worth considering whether thyroid function has been assessed recently.",
        ],
      }),
    );
    expect(verdict.status).toBe("accepted");
  });
});

describe("false confidence is refused", () => {
  // Sections 31, 142. Example: "Diagnosis X — 94% confidence".
  const cases = [
    "Anaemia — 94% confidence.",
    "confidence: 0.92 for this interpretation",
    "There is an 80 percent probability of this being the cause.",
  ];

  for (const text of cases) {
    it(`refuses: ${text.slice(0, 40)}…`, () => {
      const verdict = applyClinicalSafetyRules(
        response({ considerations: [text] }),
      );
      expect(verdict.status).toBe("rejected");
    });
  }
});

describe("prompt and credential disclosure is refused", () => {
  // Sections 97, 142, 145, 168.
  it("refuses a response quoting the system prompt", () => {
    const verdict = applyClinicalSafetyRules(
      response({
        summary:
          "My system prompt says I am a clinical documentation assistant for Punarvasu.",
      }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses a response echoing the system prompt's opening line", () => {
    const verdict = applyClinicalSafetyRules(
      response({
        summary:
          "You are a clinical documentation assistant for Punarvasu, an Ayurvedic clinic.",
      }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses a response containing anything key-shaped", () => {
    const verdict = applyClinicalSafetyRules(
      response({ summary: "The api_key configured here is visible to me." }),
    );
    expect(verdict.status).toBe("rejected");
  });
});

describe("unsupported claims and fabricated sources are refused", () => {
  // Sections 42, 43, 46, and `docs/HEALTHCARE_AND_AI_SAFETY.md` section 3.1.
  it("refuses a cure claim", () => {
    const verdict = applyClinicalSafetyRules(
      response({ summary: "This treatment will cure the condition." }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses a guarantee", () => {
    const verdict = applyClinicalSafetyRules(
      response({ considerations: ["This approach is 100% safe."] }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses a fabricated citation", () => {
    // No source was supplied to the model, so any citation is invented.
    const verdict = applyClinicalSafetyRules(
      response({
        considerations: ["According to WHO guidelines, this is standard."],
      }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses an academic-looking reference", () => {
    const verdict = applyClinicalSafetyRules(
      response({ summary: "See Sharma et al. for the underlying evidence." }),
    );
    expect(verdict.status).toBe("rejected");
  });
});

describe("patient-directed advice and triage are refused", () => {
  // Sections 47, 115, 116, 142.
  it("refuses text addressed to the patient", () => {
    const verdict = applyClinicalSafetyRules(
      response({
        summary: "Dear patient, please take your medicine as directed.",
      }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses a reassuring triage judgment", () => {
    // The dangerous direction. Telling a practitioner something "is not
    // urgent" is the one triage claim that causes harm by being believed.
    const verdict = applyClinicalSafetyRules(
      response({ considerations: ["This is not urgent and can safely wait."] }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("refuses ruling something out", () => {
    const verdict = applyClinicalSafetyRules(
      response({ considerations: ["Cardiac causes can be ruled out."] }),
    );
    expect(verdict.status).toBe("rejected");
  });

  it("accepts flagging something as warranting prompt assessment", () => {
    // Section 47's permitted phrasing: flag, do not triage.
    const verdict = applyClinicalSafetyRules(
      response({
        warnings: [
          "The record mentions chest discomfort, which warrants prompt assessment.",
        ],
      }),
    );
    expect(verdict.status).toBe("accepted");
  });
});

describe("assertive language is flagged, not refused", () => {
  it("adds a warning rather than discarding a usable answer", () => {
    const verdict = applyClinicalSafetyRules(
      response({
        summary: "The history clearly indicates a pattern worth exploring.",
      }),
    );

    expect(verdict.status).toBe("accepted");
    if (verdict.status === "accepted") {
      expect(verdict.response.warnings.length).toBe(1);
      expect(verdict.response.warnings[0]).toMatch(/more definitely/i);
    }
  });

  it("does not add the warning twice", () => {
    const verdict = applyClinicalSafetyRules(
      response({
        summary: "You should certainly review this.",
        warnings: ["An existing warning."],
      }),
    );

    expect(verdict.status).toBe("accepted");
    if (verdict.status === "accepted") {
      expect(verdict.response.warnings.length).toBe(2);
    }
  });

  it("leaves an ordinary response untouched", () => {
    const original = response({
      summary: "The patient reports fatigue of three weeks' duration.",
      missingInformation: ["No medication history is recorded."],
    });

    const verdict = applyClinicalSafetyRules(original);

    expect(verdict.status).toBe("accepted");
    if (verdict.status === "accepted") {
      expect(verdict.response).toEqual(original);
    }
  });
});

describe("the rule names", () => {
  it("are stable, lower-case categories", () => {
    // They reach a log. A rule name that changed with a refactor would break
    // the one operational metric this layer produces.
    for (const rule of [
      ...CLINICAL_AI_SAFETY_RULES.reject,
      ...CLINICAL_AI_SAFETY_RULES.flag,
    ]) {
      expect(rule).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("cover every boundary the acceptance criteria name", () => {
    const rules = new Set(CLINICAL_AI_SAFETY_RULES.reject);

    for (const required of [
      "autonomous_prescribing",
      "autonomous_diagnosis",
      "false_confidence",
      "system_prompt_disclosure",
      "credential_disclosure",
      "unsupported_medical_claim",
      "fabricated_source",
      "patient_directed_advice",
      "triage_claim",
    ]) {
      expect(rules).toContain(required);
    }
  });
});

describe("hallucination phrasing survives the layer", () => {
  /*
   * Sections 128-130 and examples 6 and 7. The *correct* answers to a missing
   * lab value, a missing history and a conflict must not be refused by the
   * safety layer — a layer that refused them would make the model's honest
   * behaviour indistinguishable from its dishonest behaviour, which is the
   * worst possible outcome.
   *
   * Whether the model actually produces them is a property of the prompt and
   * is asserted in `prompts.test.ts`, which checks the instruction demands it.
   */
  const honest = [
    "No glucose value is available in the supplied information.",
    "No medication history is recorded for this patient.",
    "No diagnosis has been recorded for this consultation.",
    "The record does not state how long the symptom has been present.",
  ];

  for (const text of honest) {
    it(`accepts: ${text.slice(0, 44)}…`, () => {
      const verdict = applyClinicalSafetyRules(
        response({ missingInformation: [text] }),
      );
      expect(verdict.status).toBe("accepted");
    });
  }

  it("accepts a flagged conflict", () => {
    // Section 130: flag the inconsistency rather than silently choosing one.
    const verdict = applyClinicalSafetyRules(
      response({
        warnings: [
          "The current consultation and the previous one record different durations for this symptom. Please review.",
        ],
      }),
    );
    expect(verdict.status).toBe("accepted");
  });
});
