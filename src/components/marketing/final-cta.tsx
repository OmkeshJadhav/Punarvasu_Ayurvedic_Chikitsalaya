import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { FINAL_CTA_CONTENT } from "@/config/marketing-content";
import { PRIMARY_CTA } from "@/config/navigation";

/**
 * The closing call to action.
 *
 * Calm rather than insistent: an invitation, one primary button, and no
 * countdown, scarcity line or competing action of equal weight. A visitor who
 * has read this far needs permission to begin, not pressure
 * (`docs/implementation-plan/phase_03.md` section 30).
 *
 * Sits on the sand band rather than the herbal accent tint. `--accent` is the
 * hover and selected colour; using it for a whole section makes every hovered
 * control on the page look like part of this one. Sand also sets the closing
 * invitation apart from the deep green footer directly beneath it.
 *
 * The heading is an `<h2>`, keeping the outline flat beneath a page's single
 * `<h1>`.
 *
 * ## Props
 *
 * The copy defaults to the home page's, and every public page that ends in an
 * invitation passes its own. Phase 04 made it configurable rather than
 * copying the section three times: the services page and each treatment page
 * close with the same composition and different words.
 */
export interface FinalCtaSectionProps {
  readonly title?: string;
  readonly description?: string;
  readonly primaryLabel?: string;
  /** A quieter alternative beside the primary action. */
  readonly secondaryAction?: ReactNode;
  /** Distinct per page only when two of these could ever share a document. */
  readonly titleId?: string;
}

export function FinalCtaSection({
  title = FINAL_CTA_CONTENT.title,
  description = FINAL_CTA_CONTENT.description,
  primaryLabel = FINAL_CTA_CONTENT.primaryAction.label,
  secondaryAction,
  titleId = "final-cta-title",
}: FinalCtaSectionProps) {
  return (
    <Section
      aria-labelledby={titleId}
      className="bg-secondary border-border border-t"
    >
      <Container width="prose" className="text-center">
        <h2 id={titleId} className="text-h2 text-heading font-normal">
          {title}
        </h2>

        {/* The `prose` container already caps the measure at 720px, so this
            needs no width of its own. */}
        <p className="text-body-lg text-prose mt-5">{description}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={PRIMARY_CTA.href}>{primaryLabel}</Link>
          </Button>
          {secondaryAction}
        </div>
      </Container>
    </Section>
  );
}
