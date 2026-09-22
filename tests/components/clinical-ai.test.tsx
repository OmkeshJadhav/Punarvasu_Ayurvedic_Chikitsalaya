/**
 * The clinical AI surface's component tests.
 *
 * ## What these assert
 *
 * The things a practitioner must always be able to see (sections 40, 82,
 * 109, 132, 134), the things they must never be offered (sections 72, 111),
 * and the things that must never reach a browser (sections 25, 28).
 *
 * Plus the properties every surface in this project is held to: a real label
 * on every control, one form carrying exactly its action's fields, markup
 * rendered as text, and axe clean.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ClinicalAIResultView } from "@/components/clinical-ai/ai-result";
import {
  ClinicalAIBoundaryNotice,
  ClinicalAIDisclaimer,
  ClinicalAIResultLabels,
} from "@/components/clinical-ai/ai-disclaimer";
import { CLINICAL_AI_COPY } from "@/features/clinical-ai/content";
import type { ClinicalAIResult } from "@/features/clinical-ai/types";

import { expectNoAxeViolations } from "../support/axe";

const RESULT: ClinicalAIResult = {
  task: "clinical_summary",
  summary: "A synthetic summary of the supplied information.",
  considerations: [
    "It may be worth considering whether the symptom duration has been recorded.",
  ],
  missingInformation: ["No medication history is recorded."],
  warnings: [],
  contextSources: [
    "This consultation's notes",
    "2 previous consultations you recorded",
  ],
  contextFingerprint: "a".repeat(32),
  model: "mock-model",
  promptVersion: "clinical_summary_v1",
  generatedAt: Date.UTC(2026, 8, 20, 9, 30),
};

describe("disclosure is visible and plain", () => {
  it("shows the standing disclaimer", () => {
    // Sections 3, 40. `docs/HEALTHCARE_AND_AI_SAFETY.md` section 7: visible and
    // plain, not a tooltip and not a footnote.
    render(<ClinicalAIDisclaimer />);

    expect(
      screen.getByText(CLINICAL_AI_COPY.disclaimer.title),
    ).toBeInTheDocument();
    expect(screen.getByText(/may be incomplete or wrong/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not diagnose, does not prescribe/i),
    ).toBeInTheDocument();
  });

  it("labels the output as AI-generated and unverified", () => {
    // Section 82, section 24. Attached to the output, not to the page.
    render(<ClinicalAIResultLabels />);

    expect(
      screen.getByText(CLINICAL_AI_COPY.generatedBadge),
    ).toBeInTheDocument();
    expect(
      screen.getByText(CLINICAL_AI_COPY.unverifiedBadge),
    ).toBeInTheDocument();
  });

  it("carries both labels on the result itself", () => {
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    expect(
      screen.getByText(CLINICAL_AI_COPY.generatedBadge),
    ).toBeInTheDocument();
    expect(
      screen.getByText(CLINICAL_AI_COPY.unverifiedBadge),
    ).toBeInTheDocument();
  });

  it("says the result is not saved and not part of the record", () => {
    // Sections 25, 28. A practitioner who assumes it is saved will navigate
    // away and lose it, and "is this in the patient's record?" must have an
    // unambiguous answer.
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    expect(
      screen.getByText(/not saved.*not part of the patient's record/i),
    ).toBeInTheDocument();
  });

  it("states what the tool will not do", () => {
    // Sections 72, 109. Said where somebody would look for the control.
    render(<ClinicalAIBoundaryNotice />);

    expect(
      screen.getByText(CLINICAL_AI_COPY.boundaryNotice.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing here writes anything/i),
    ).toBeInTheDocument();
  });
});

describe("source attribution", () => {
  it("distinguishes source data from generated interpretation", () => {
    // Sections 41, 132.
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    expect(
      screen.getByText(CLINICAL_AI_COPY.sourcesHeading),
    ).toBeInTheDocument();
    for (const source of RESULT.contextSources) {
      expect(screen.getByText(source)).toBeInTheDocument();
    }
  });

  it("says no external source was consulted", () => {
    // Sections 42, 43. A model's prose can imply a guideline was consulted;
    // the page says plainly that none was.
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    expect(
      screen.getByText(/No external guideline, study or medical database/i),
    ).toBeInTheDocument();
  });

  it("records which model produced it", () => {
    // Section 124.
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    expect(
      screen.getByText(/mock-model · clinical_summary_v1/),
    ).toBeInTheDocument();
  });
});

describe("staleness", () => {
  it("shows nothing when the result is current", () => {
    // Sections 84, 85, 140.
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    expect(
      screen.queryByText(CLINICAL_AI_COPY.staleNotice.title),
    ).not.toBeInTheDocument();
  });

  it("warns when the clinical information has changed", () => {
    render(<ClinicalAIResultView result={RESULT} stale />);

    expect(
      screen.getByText(CLINICAL_AI_COPY.staleNotice.title),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Regenerate it before relying/i),
    ).toBeInTheDocument();
  });

  it("keeps the result visible beside the warning", () => {
    // Above rather than instead of: a practitioner mid-read should be told the
    // ground has moved, not have their place taken away.
    render(<ClinicalAIResultView result={RESULT} stale />);

    expect(screen.getByText(RESULT.summary!)).toBeInTheDocument();
  });
});

describe("sections", () => {
  it("renders only the sections that hold something", () => {
    // An empty heading reads as a broken feature.
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    expect(
      screen.getByText(CLINICAL_AI_COPY.sectionHeadings.summary),
    ).toBeInTheDocument();
    expect(
      screen.getByText(CLINICAL_AI_COPY.sectionHeadings.considerations),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(CLINICAL_AI_COPY.sectionHeadings.warnings),
    ).not.toBeInTheDocument();
  });

  it("puts warnings above everything else", () => {
    // Sections 47, 130, 134. A flagged contradiction is what a practitioner
    // most needs to see and must not sit below four paragraphs of summary.
    render(
      <ClinicalAIResultView
        result={{
          ...RESULT,
          warnings: ["The record contradicts itself about the duration."],
        }}
        stale={false}
      />,
    );

    const warning = screen.getByText(
      "The record contradicts itself about the duration.",
    );
    const summary = screen.getByText(RESULT.summary!);

    expect(
      warning.compareDocumentPosition(summary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses 'Review required' rather than alarming language", () => {
    // Section 134.
    render(
      <ClinicalAIResultView
        result={{ ...RESULT, warnings: ["Something to review."] }}
        stale={false}
      />,
    );

    expect(screen.getByText("Review required")).toBeInTheDocument();
  });
});

describe("no clinical mutation is offered", () => {
  it("offers no apply, accept, save or issue control", () => {
    // Sections 72, 111, example 9. The strongest affordance is a copy button.
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    for (const forbidden of [
      /apply/i,
      /accept/i,
      /^save/i,
      /issue/i,
      /add to (?:the )?(?:record|prescription|plan)/i,
      /use as/i,
    ]) {
      expect(
        screen.queryByRole("button", { name: forbidden }),
      ).not.toBeInTheDocument();
    }
  });

  it("offers exactly one action, and it is Copy", () => {
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(CLINICAL_AI_COPY.copyLabel);
  });

  it("contains no form and no submit control", () => {
    // Nothing in a result can post anywhere.
    const { container } = render(
      <ClinicalAIResultView result={RESULT} stale={false} />,
    );

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('[type="submit"]')).toBeNull();
  });
});

describe("the copied text carries its own label", () => {
  it("labels the clipboard payload", async () => {
    // Section 87. A clipboard payload outlives the screen that explains it, so
    // a paste two hours later must not look like something a clinician wrote.
    const written: string[] = [];
    Object.assign(navigator, {
      clipboard: {
        writeText: (text: string) => {
          written.push(text);
          return Promise.resolve();
        },
      },
    });

    render(<ClinicalAIResultView result={RESULT} stale={false} />);
    await userEvent.click(
      screen.getByRole("button", { name: CLINICAL_AI_COPY.copyLabel }),
    );

    expect(written).toHaveLength(1);
    expect(written[0]).toContain(CLINICAL_AI_COPY.generatedBadge);
    expect(written[0]).toContain(CLINICAL_AI_COPY.unverifiedBadge);
    expect(written[0]).toMatch(/has not been clinically verified|unverified/i);
    expect(written[0]).toContain(RESULT.summary!);
  });
});

describe("model output is rendered as text", () => {
  it("never creates an element from a response", () => {
    // Section 39. The defence is that every string is a React text node.
    const { container } = render(
      <ClinicalAIResultView
        result={{
          ...RESULT,
          summary: "<script>alert(1)</script><img src=x onerror=alert(1)>",
        }}
        stale={false}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByText(/<script>alert\(1\)<\/script>/),
    ).toBeInTheDocument();
  });

  it("renders markdown as literal characters", () => {
    render(
      <ClinicalAIResultView
        result={{ ...RESULT, summary: "**bold** [link](http://evil.test)" }}
        stale={false}
      />,
    );

    expect(
      screen.getByText("**bold** [link](http://evil.test)"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("nothing reaches browser storage", () => {
  it("writes no localStorage or sessionStorage", () => {
    // Sections 25, 28, and `docs/SECURITY.md` section 14.
    localStorage.clear();
    sessionStorage.clear();

    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <main>
        <ClinicalAIDisclaimer />
        <ClinicalAIResultView
          result={{ ...RESULT, warnings: ["Something to review."] }}
          stale
        />
        <ClinicalAIBoundaryNotice />
      </main>,
    );

    await expectNoAxeViolations(container);
  });

  it("names the result region with a heading", () => {
    render(<ClinicalAIResultView result={RESULT} stale={false} />);

    const region = screen.getByRole("region", {
      name: CLINICAL_AI_COPY.resultHeading,
    });
    expect(
      within(region).getByRole("heading", {
        name: CLINICAL_AI_COPY.resultHeading,
      }),
    ).toBeInTheDocument();
  });

  it("announces a copy without moving focus", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: () => Promise.resolve() },
    });

    render(<ClinicalAIResultView result={RESULT} stale={false} />);
    const button = screen.getByRole("button", {
      name: CLINICAL_AI_COPY.copyLabel,
    });

    await userEvent.click(button);

    expect(
      screen.getByRole("button", { name: CLINICAL_AI_COPY.copiedLabel }),
    ).toHaveFocus();
  });
});
