import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Emphasis } from "@/components/marketing/emphasis";
import { Reveal } from "@/components/shared/reveal";
import { APPROACH_CONTENT, HOME_SECTIONS } from "@/config/marketing-content";

/**
 * "Our approach" — Understand → Personalize → Care.
 *
 * Three steps, and deliberately *not* three cards. The section before it is an
 * image split and the section after it is a grid of image cards; putting
 * boxes here too would flatten the whole page into one texture. So this is
 * typography and a rule.
 *
 * The heading is set large across two-thirds of the width with the supporting
 * sentence tucked against its baseline on the right - the asymmetry is what
 * makes it read as a statement rather than as one more centred section title.
 *
 * ## Numerals
 *
 * Large serif italics in the brand gold. They were once small tracked caps,
 * because a *pale* large numeral measured 2.05:1 on this surface. Gold is not
 * pale: it clears 4.5:1 on the muted band, so the numerals can be display
 * size and still readable rather than decorative.
 *
 * A server component; no JavaScript beyond the shared entrance reveal.
 */
export function ApproachSection() {
  return (
    <Section
      id={HOME_SECTIONS.approach}
      aria-labelledby="approach-title"
      className="anchor-offset bg-muted"
    >
      <Container width="wide">
        <Reveal className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-8">
            <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {APPROACH_CONTENT.eyebrow}
            </p>
            <h2
              id="approach-title"
              className="text-display text-heading mt-5 max-w-3xl font-normal"
            >
              <Emphasis
                text={APPROACH_CONTENT.title}
                phrase={APPROACH_CONTENT.titleEmphasis}
                className="text-primary"
              />
            </h2>
          </div>
          <p className="text-body-lg text-prose measure lg:col-span-4 lg:pb-2">
            {APPROACH_CONTENT.description}
          </p>
        </Reveal>

        <ol className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-3 lg:mt-20">
          {APPROACH_CONTENT.steps.map((step, index) => (
            <Reveal key={step.title} asChild delay={index * 90}>
              <li className="border-border-strong flex flex-col border-t pt-8">
                <span className="text-h1 text-gold font-serif leading-none italic tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-h4 text-heading mt-6 font-normal">
                  {step.title}
                </h3>
                <p className="text-body text-prose measure mt-3">
                  {step.description}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
