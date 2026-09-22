import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Reveal } from "@/components/shared/reveal";
import { APPROACH_CONTENT, HOME_SECTIONS } from "@/config/marketing-content";

/**
 * "Our approach" — Understand → Personalize → Care.
 *
 * Three steps, and deliberately *not* three cards. The section before it is an
 * image split and the section after it is a grid of image cards; putting
 * boxes here too would flatten the whole page into one texture. So this is
 * typography and a rule: a numeral, a heading, a paragraph, separated by a top
 * border that reads as a progression on desktop and as a stacked list on a
 * phone.
 *
 * The arrow between steps is decorative and hidden from assistive technology —
 * the order is already carried by the numerals and by source order.
 *
 * A server component; no JavaScript beyond the shared entrance reveal.
 */
export function ApproachSection() {
  return (
    <Section
      id={HOME_SECTIONS.approach}
      aria-labelledby="approach-title"
      className="anchor-offset bg-muted border-border border-y"
    >
      <Container width="wide">
        <SectionHeader
          titleId="approach-title"
          eyebrow={APPROACH_CONTENT.eyebrow}
          title={APPROACH_CONTENT.title}
          description={APPROACH_CONTENT.description}
        />

        <ol className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3 lg:mt-16">
          {APPROACH_CONTENT.steps.map((step, index) => (
            <Reveal key={step.title} asChild delay={index * 80}>
              <li className="border-primary/25 flex flex-col border-t pt-6">
                {/*
                  Small, tracked and at full primary rather than large and
                  pale. A faded numeral measured 2.05:1 against the muted
                  surface - decorative to the designer, unreadable to everyone
                  else. This also matches the patient journey's numbering, so
                  the page numbers things one way.
                */}
                <span className="text-caption text-eyebrow font-sans font-medium tracking-[0.18em] tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-h4 text-heading mt-2 font-normal">
                  {step.title}
                </h3>
                <p className="text-body text-prose mt-3">{step.description}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
