import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FAQ_CONTENT, HOME_SECTIONS } from "@/config/marketing-content";
import type { FaqItem } from "@/config/marketing-content";

/**
 * The home page's frequently asked questions.
 *
 * A server component since Phase 04: the disclosure state moved into
 * `FaqAccordion`, the one client component all three FAQ surfaces share, so
 * the section around it no longer needs to be a client component at all.
 *
 * `headingLevel="h3"` sits correctly under this section's `<h2>`.
 *
 * Nothing medical or legal is hidden in here. The medical disclaimer is
 * rendered in the open in the philosophy section and in the footer
 * (`docs/implementation-plan/phase_03.md` section 28).
 */
export interface FaqSectionProps {
  readonly items: readonly FaqItem[];
}

export function FaqSection({ items }: FaqSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section
      id={HOME_SECTIONS.faq}
      aria-labelledby="faq-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="faq-title"
              eyebrow={FAQ_CONTENT.eyebrow}
              title={FAQ_CONTENT.title}
              description={FAQ_CONTENT.description}
            />
          </div>

          <div className="lg:col-span-7">
            <FaqAccordion items={items} headingLevel="h3" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
