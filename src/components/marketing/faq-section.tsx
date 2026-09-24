import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { Reveal } from "@/components/shared/reveal";
import { FAQ_CONTENT, HOME_SECTIONS } from "@/config/marketing-content";
import type { FaqItem } from "@/config/marketing-content";

/**
 * "Before you visit" - the home page's questions, and where the clinic is.
 *
 * The questions and the location used to be two sections. They answer one
 * need - what a first visit involves and how to get there - so they now share
 * a band: the questions on the left as an editorial list (serif questions,
 * plus/minus markers), and whatever the page passes as `aside` on the right.
 * The home page passes `LocationSection`'s card, which keeps its own
 * `<section>`, heading and anchor, so nothing that linked to it breaks.
 *
 * Without an `aside` the list takes the right-hand columns beside the heading,
 * as before.
 *
 * A server component: the disclosure state lives in `FaqAccordion`, the one
 * client component all three FAQ surfaces share. `headingLevel="h3"` sits
 * correctly under this section's `<h2>`.
 *
 * Nothing medical or legal is hidden in here. The medical disclaimer is
 * rendered in the open in the philosophy section and in the footer
 * (`docs/implementation-plan/phase_03.md` section 28).
 */
export interface FaqSectionProps {
  readonly items: readonly FaqItem[];
  /** Rendered in the right-hand column, beside the questions. */
  readonly aside?: ReactNode;
}

export function FaqSection({ items, aside }: FaqSectionProps) {
  if (items.length === 0) {
    return null;
  }

  const header = (
    <SectionHeader
      titleId="faq-title"
      eyebrow={FAQ_CONTENT.eyebrow}
      title={FAQ_CONTENT.title}
      description={aside ? undefined : FAQ_CONTENT.description}
    />
  );

  return (
    <Section
      id={HOME_SECTIONS.faq}
      aria-labelledby="faq-title"
      className="anchor-offset bg-muted"
    >
      <Container width="wide">
        {aside ? (
          <div className="grid items-start gap-14 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:col-span-6">
              {header}
              <FaqAccordion
                items={items}
                headingLevel="h3"
                appearance="editorial"
                className="mt-10"
              />
              <p className="text-body-sm text-muted-foreground measure mt-8">
                {FAQ_CONTENT.description}
              </p>
            </Reveal>

            <Reveal delay={100} className="lg:col-span-5 lg:col-start-8">
              {aside}
            </Reveal>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">{header}</div>
            <div className="lg:col-span-7">
              <FaqAccordion
                items={items}
                headingLevel="h3"
                appearance="editorial"
              />
            </div>
          </div>
        )}
      </Container>
    </Section>
  );
}
