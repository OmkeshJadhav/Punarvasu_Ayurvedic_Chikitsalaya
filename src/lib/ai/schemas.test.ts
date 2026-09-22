/**
 * Output validation.
 *
 * Section 144: feed malformed provider responses — invalid JSON, unexpected
 * fields, oversized responses, HTML and script — and verify the application
 * handles them safely. "Safely" here means **refused**, never repaired: a
 * response that does not satisfy the contract is discarded, because a repaired
 * clinical response is text nobody wrote and nobody reviewed.
 */

import { describe, expect, it } from "vitest";

import { CLINICAL_AI_RESPONSE_LIMITS } from "@/config/clinical-ai";

import { parseClinicalAIResponse } from "./schemas";

describe("well-formed responses", () => {
  it("accepts the documented shape", () => {
    const result = parseClinicalAIResponse(
      JSON.stringify({
        summary: "A summary.",
        considerations: ["One."],
        missingInformation: ["Two."],
        warnings: [],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.summary).toBe("A summary.");
      expect(result.response.considerations).toEqual(["One."]);
    }
  });

  it("accepts a partial response and fills the absent lists", () => {
    // A task that produces no considerations should omit the key rather than
    // padding it, so the parser must not require every section.
    const result = parseClinicalAIResponse(
      JSON.stringify({ summary: "Only a summary." }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.considerations).toEqual([]);
      expect(result.response.warnings).toEqual([]);
    }
  });

  it("extracts JSON from a code fence", () => {
    // Models wrap JSON however firmly they are asked not to. Refusing a
    // correct answer over a fence would make the feature unreliable for no
    // security gain — what makes it safe is that the contents still have to
    // satisfy the schema.
    const result = parseClinicalAIResponse(
      '```json\n{"summary":"Fenced."}\n```',
    );

    expect(result.ok).toBe(true);
  });

  it("extracts JSON from surrounding prose", () => {
    const result = parseClinicalAIResponse(
      'Here is the result:\n{"summary":"Wrapped."}\nHope that helps.',
    );

    expect(result.ok).toBe(true);
  });

  it("handles a brace inside a clinical note", () => {
    // Brace counting tracks quoted strings, so a brace in the text does not
    // close the object early.
    const result = parseClinicalAIResponse(
      JSON.stringify({ summary: "Note reads {see previous} in the record." }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.summary).toContain("{see previous}");
    }
  });
});

describe("malformed responses are refused", () => {
  it("refuses invalid JSON", () => {
    expect(parseClinicalAIResponse("{not json").ok).toBe(false);
  });

  it("refuses an empty response", () => {
    expect(parseClinicalAIResponse("").ok).toBe(false);
  });

  it("refuses prose with no JSON at all", () => {
    expect(parseClinicalAIResponse("I cannot help with that request.").ok).toBe(
      false,
    );
  });

  it("refuses a JSON array", () => {
    expect(parseClinicalAIResponse('["a","b"]').ok).toBe(false);
  });

  it("refuses a response whose every section is empty", () => {
    // Four blank headings read as a broken feature. A task with nothing to say
    // should say so in its summary.
    expect(
      parseClinicalAIResponse(
        JSON.stringify({ considerations: [], warnings: [] }),
      ).ok,
    ).toBe(false);
  });
});

describe("unexpected fields are rejected, not stripped", () => {
  /*
   * `strict()`. A model returning an extra key is trying to do something the
   * system does not permit, and stripping it would let that fail quietly and
   * repeatedly. Rejecting makes it visible as a `rejected` session — the
   * number section 107 asks to be watchable.
   */
  const forbidden = [
    { summary: "x", diagnosis: "anaemia" },
    { summary: "x", confidence: 0.94 },
    { summary: "x", prescription: "500mg" },
    { summary: "x", treatmentPlan: "panchakarma" },
    { summary: "x", probability: 0.8 },
    { summary: "x", severity: "high" },
    { summary: "x", sources: ["WHO"] },
    { summary: "x", patientId: "abc" },
    { summary: "x", apply: true },
  ];

  for (const payload of forbidden) {
    const key = Object.keys(payload).filter((name) => name !== "summary")[0];
    it(`refuses an extra "${key}"`, () => {
      expect(parseClinicalAIResponse(JSON.stringify(payload)).ok).toBe(false);
    });
  }

  it("has no confidence field to populate", () => {
    // Sections 30-31. The absence is the control: a model that returns one is
    // refused rather than having it silently dropped.
    const result = parseClinicalAIResponse(
      JSON.stringify({ summary: "x", considerations: ["y"] }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.response).sort()).toEqual([
        "considerations",
        "missingInformation",
        "summary",
        "warnings",
      ]);
    }
  });
});

describe("oversized responses are refused", () => {
  it("refuses a summary beyond the bound", () => {
    const result = parseClinicalAIResponse(
      JSON.stringify({
        summary: "a".repeat(CLINICAL_AI_RESPONSE_LIMITS.maxSummaryChars + 1),
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses too many items", () => {
    const result = parseClinicalAIResponse(
      JSON.stringify({
        considerations: Array.from(
          { length: CLINICAL_AI_RESPONSE_LIMITS.maxItems + 1 },
          (_, index) => `Item ${index}.`,
        ),
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses an item beyond the bound", () => {
    const result = parseClinicalAIResponse(
      JSON.stringify({
        considerations: [
          "a".repeat(CLINICAL_AI_RESPONSE_LIMITS.maxItemChars + 1),
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("hostile text is sanitized or refused", () => {
  it("keeps HTML as literal characters rather than removing it", () => {
    /*
     * Section 39. The defence is that nothing renders HTML — every string is a
     * React text node, which escapes. Stripping tags here would imply the
     * output is sometimes rendered as markup, which is the assumption that
     * makes an XSS possible later.
     */
    const result = parseClinicalAIResponse(
      JSON.stringify({ summary: "<script>alert(1)</script>" }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.summary).toBe("<script>alert(1)</script>");
    }
  });

  it("strips control characters", () => {
    const result = parseClinicalAIResponse(
      JSON.stringify({
        summary: `Before${String.fromCharCode(0)}${String.fromCharCode(7)}after`,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.summary).toBe("Beforeafter");
      expect(result.response.summary).not.toMatch(
        new RegExp("[\\u0000-\\u0008]"),
      );
    }
  });

  it("strips bidirectional overrides", () => {
    // A bidi override makes text display differently from what it says. A
    // model echoing one out of a maliciously titled document must not be able
    // to make a warning read as its opposite.
    const result = parseClinicalAIResponse(
      JSON.stringify({
        summary: `Safe${String.fromCharCode(0x202e)}reversed`,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.summary).toBe("Safereversed");
    }
  });

  it("strips zero-width characters", () => {
    const result = parseClinicalAIResponse(
      JSON.stringify({
        summary: `Hid${String.fromCharCode(0x200b)}den`,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.summary).toBe("Hidden");
    }
  });

  it("keeps paragraph breaks", () => {
    // Newlines survive because a summary legitimately has paragraphs, and the
    // renderer displays them with `whitespace-pre-line`.
    const result = parseClinicalAIResponse(
      JSON.stringify({ summary: "First.\n\nSecond." }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.summary).toBe("First.\n\nSecond.");
    }
  });

  it("refuses an entry that sanitizes down to nothing", () => {
    const result = parseClinicalAIResponse(
      JSON.stringify({
        considerations: [String.fromCharCode(0x200b)],
      }),
    );
    expect(result.ok).toBe(false);
  });
});
