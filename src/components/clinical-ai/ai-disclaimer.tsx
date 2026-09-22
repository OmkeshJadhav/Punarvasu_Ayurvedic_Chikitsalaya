/**
 * The standing AI disclaimer, and the labels attached to a result.
 *
 * ## Why these are separate components
 *
 * `phase_17.md` sections 82 and 40 ask for two different things, and folding
 * them into one header would lose the more important one. The **disclaimer**
 * is about the tool and is read once; the **labels** are attached to the
 * output and travel with it down the page, so a practitioner scrolled past the
 * header still has "AI-generated — not clinician verified" in view beside the
 * text they are reading.
 *
 * `docs/HEALTHCARE_AND_AI_SAFETY.md` section 7: labelling is visible and
 * plain, not a tooltip and not a footnote. Neither of these is a tooltip.
 */

import { Sparkles, TriangleAlert } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { CLINICAL_AI_COPY } from "@/features/clinical-ai/content";

/**
 * The standing disclaimer.
 *
 * A `warning` tone rather than `info`. It is not neutral background
 * information — it is the sentence that says the text below may be wrong, and
 * the tone should match that without shouting (section 134: do not use
 * alarming language unnecessarily).
 */
export function ClinicalAIDisclaimer() {
  return (
    <Alert tone="warning" title={CLINICAL_AI_COPY.disclaimer.title}>
      {CLINICAL_AI_COPY.disclaimer.body}
    </Alert>
  );
}

/**
 * The two labels that sit on the result itself (sections 24, 82).
 *
 * Not `Badge`, deliberately: a badge reads as a status somebody set, and these
 * are a permanent property of anything in this panel. They are plain text with
 * an icon, always both, and never colour alone.
 */
export function ClinicalAIResultLabels() {
  return (
    <p className="text-body-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 font-sans">
      <span className="inline-flex items-center gap-1.5">
        <Sparkles aria-hidden className="size-4 shrink-0" />
        {CLINICAL_AI_COPY.generatedBadge}
      </span>
      <span className="text-warning inline-flex items-center gap-1.5">
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        {CLINICAL_AI_COPY.unverifiedBadge}
      </span>
    </p>
  );
}

/**
 * What this tool will not do (sections 72, 109).
 *
 * The convention every phase of this project has followed: state the absent
 * capability in the place somebody would look for it. Here it does double
 * duty — it tells a practitioner there is no "apply" button to hunt for, and
 * it tells them plainly where the responsibility sits.
 */
export function ClinicalAIBoundaryNotice() {
  return (
    <Alert tone="info" title={CLINICAL_AI_COPY.boundaryNotice.title}>
      {CLINICAL_AI_COPY.boundaryNotice.body}
    </Alert>
  );
}
