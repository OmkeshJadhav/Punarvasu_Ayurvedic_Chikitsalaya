"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CLINICAL_AI_COPY } from "@/features/clinical-ai/content";
import type { ClinicalAIResult } from "@/features/clinical-ai/types";

import { ClinicalAIResultLabels } from "./ai-disclaimer";

/**
 * A generated result.
 *
 * ## Everything here is a text node
 *
 * Section 39. No `dangerouslySetInnerHTML`, no markdown renderer, no link
 * parsing. Model output arrives having been sanitized by the response schema —
 * control characters, zero-width characters and bidirectional overrides
 * removed — and is then rendered as React children, which escape. A model
 * returning `<script>` produces the visible characters of a script tag and no
 * element, which a test asserts.
 *
 * ## Sections, not a wall of prose
 *
 * Sections 133 and 134: structured headings a practitioner can scan, and a
 * "Review required" block that uses that phrase rather than alarming language.
 * A section with nothing in it is not rendered, so a task that produces no
 * considerations does not display an empty heading that reads like a failure.
 *
 * ## Source data, distinguished from generated text
 *
 * Sections 41 and 132. "Based on" lists the *kinds* of context that were used
 * and their counts — never their content — and says explicitly that no
 * external source was consulted, because a model's prose can imply one was.
 *
 * ## Staleness
 *
 * Sections 84, 85 and 140. The page recomputes the consultation's fingerprint
 * on every render; when it no longer matches the one this result was generated
 * from, the banner appears above the result rather than replacing it. Above,
 * because a practitioner mid-read should be told the ground has moved, not
 * have their place taken away.
 */
export function ClinicalAIResultView({
  result,
  stale,
}: {
  readonly result: ClinicalAIResult;
  readonly stale: boolean;
}) {
  return (
    <section
      aria-labelledby="clinical-ai-result"
      className="border-border bg-card flex flex-col gap-6 rounded-lg border p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3
            id="clinical-ai-result"
            className="text-h4 text-heading font-normal"
          >
            {CLINICAL_AI_COPY.resultHeading}
          </h3>
          <CopyButton result={result} />
        </div>
        <ClinicalAIResultLabels />
      </div>

      {stale ? (
        <Alert tone="warning" title={CLINICAL_AI_COPY.staleNotice.title}>
          {CLINICAL_AI_COPY.staleNotice.body}
        </Alert>
      ) : null}

      {/*
        Warnings first. If the model flagged a contradiction or something that
        warrants prompt assessment (sections 47, 130, 134), it is the thing a
        practitioner most needs to see and it must not sit below four
        paragraphs of summary.
      */}
      {result.warnings.length > 0 ? (
        <Alert tone="warning" title={CLINICAL_AI_COPY.sectionHeadings.warnings}>
          <ItemList items={result.warnings} />
        </Alert>
      ) : null}

      {result.summary ? (
        <ResultSection heading={CLINICAL_AI_COPY.sectionHeadings.summary}>
          {/*
            `whitespace-pre-line` renders the model's paragraph breaks and
            nothing else. It is not a markdown renderer and cannot become one.
          */}
          <p className="text-body text-foreground measure whitespace-pre-line">
            {result.summary}
          </p>
        </ResultSection>
      ) : null}

      {result.considerations.length > 0 ? (
        <ResultSection
          heading={CLINICAL_AI_COPY.sectionHeadings.considerations}
        >
          <ItemList items={result.considerations} />
        </ResultSection>
      ) : null}

      {result.missingInformation.length > 0 ? (
        <ResultSection
          heading={CLINICAL_AI_COPY.sectionHeadings.missingInformation}
        >
          <ItemList items={result.missingInformation} />
        </ResultSection>
      ) : null}

      <div className="border-border flex flex-col gap-2 border-t pt-4">
        <h4 className="text-label text-muted-foreground font-sans">
          {CLINICAL_AI_COPY.sourcesHeading}
        </h4>
        <ul className="text-body-sm text-muted-foreground flex flex-col gap-1">
          {result.contextSources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
        <p className="text-body-sm text-muted-foreground measure">
          {CLINICAL_AI_COPY.sourcesNote}
        </p>
        {/*
          Section 124. Which model said this, so a later behaviour change is
          attributable. Not a claim of authority — it sits in the small print
          beneath the sources, where provenance belongs.
        */}
        <p className="text-caption text-muted-foreground">
          {result.model} · {result.promptVersion}
        </p>
      </div>

      <Alert tone="info">{CLINICAL_AI_COPY.ephemeralNotice}</Alert>
    </section>
  );
}

function ResultSection({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-label text-heading font-sans">{heading}</h4>
      {children}
    </div>
  );
}

function ItemList({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="text-body text-foreground measure flex list-disc flex-col gap-2 pl-5">
      {items.map((item, index) => (
        // The index is part of the key because two identical entries are
        // possible and are not the same entry.
        <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Copies the result to the clipboard (sections 87, 109).
 *
 * ## Why a copy button is the strongest affordance offered
 *
 * Section 72 rules out "Apply AI Recommendation" for a final clinical action,
 * and this project goes one step further than section 72's own "Copy to
 * Draft": there is no draft to copy to. The clipboard is the boundary — what
 * happens next is a practitioner deliberately pasting into a form and editing
 * it, which is an act they perform and own.
 *
 * ## The copied text carries its own label
 *
 * A clipboard payload outlives the screen that explains it. So the text that
 * leaves carries the same two labels the panel shows, and the sentence saying
 * it has not been checked — otherwise a paste into a note two hours later
 * looks exactly like something a clinician wrote.
 */
function CopyButton({ result }: { readonly result: ClinicalAIResult }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(toPlainText(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // A denied clipboard permission is not worth an error state on a
      // clinical screen: the text is on the page and can be selected.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Copy aria-hidden className="size-4" />
        )}
        {copied ? CLINICAL_AI_COPY.copiedLabel : CLINICAL_AI_COPY.copyLabel}
      </Button>
      <p role="status" className="sr-only">
        {copied ? CLINICAL_AI_COPY.copiedLabel : ""}
      </p>
    </div>
  );
}

/** The clipboard payload. Labelled, so a paste is never mistaken for a note. */
function toPlainText(result: ClinicalAIResult): string {
  const lines: string[] = [
    `${CLINICAL_AI_COPY.generatedBadge} — ${CLINICAL_AI_COPY.unverifiedBadge}`,
    CLINICAL_AI_COPY.copyNotice,
    "",
  ];

  if (result.summary) {
    lines.push(CLINICAL_AI_COPY.sectionHeadings.summary, result.summary, "");
  }

  for (const [heading, items] of [
    [CLINICAL_AI_COPY.sectionHeadings.considerations, result.considerations],
    [
      CLINICAL_AI_COPY.sectionHeadings.missingInformation,
      result.missingInformation,
    ],
    [CLINICAL_AI_COPY.sectionHeadings.warnings, result.warnings],
  ] as const) {
    if (items.length === 0) continue;
    lines.push(heading);
    for (const item of items) lines.push(`- ${item}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}
