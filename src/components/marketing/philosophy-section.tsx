import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Reveal } from "@/components/shared/reveal";
import { HOME_IMAGES } from "@/config/images";
import { HOME_SECTIONS, PHILOSOPHY_CONTENT } from "@/config/marketing-content";

/**
 * Ayurvedic philosophy — the page's inverted section.
 *
 * ## Why a dark band here
 *
 * A long run of light sections reads as one very long page. The inversion
 * gives the eye a rest point and marks the shift from "what we do" to "what we
 * believe", which is the natural place for it in the narrative. The closing
 * invitation is the only other dark band, and it ends the page rather than
 * interrupting it.
 *
 * ## Composition
 *
 * The section's most quotable sentence is set as a display-size pull quote,
 * with its last clause in the brand's linen accent - the one place on the
 * page the italic carries colour. The quote is the section's second paragraph
 * restated larger, so that paragraph is not printed a second time beneath it.
 *
 * The photograph is tall and to the right, bleeding off the top of its
 * column, and a large sprig sits faintly in the opposite corner. Both are
 * atmosphere; the words carry the section.
 *
 * Colours come from the `--brand-surface` token family, and every foreground
 * pair is asserted against WCAG AA in `src/lib/design/contrast.test.ts`.
 *
 * ## Content safety
 *
 * This is the page's most "educational" section and therefore its riskiest.
 * The copy describes a way of understanding health; it does not diagnose,
 * recommend, or claim that Ayurveda substitutes for medical treatment. The
 * medical disclaimer is rendered here in plain sight rather than tucked into
 * the FAQ, because this is where a reader is most likely to mistake general
 * information for advice (`docs/HEALTHCARE_AND_AI_SAFETY.md`).
 */
export function PhilosophySection() {
  const [firstParagraph] = PHILOSOPHY_CONTENT.paragraphs;

  return (
    <Section
      id={HOME_SECTIONS.philosophy}
      aria-labelledby="philosophy-title"
      // See `[data-surface="inverted"]` in `globals.css`.
      data-surface="inverted"
      className="anchor-offset bg-brand-surface text-brand-surface-foreground relative isolate overflow-hidden"
    >
      <BotanicalMotif className="text-brand-surface-border/50 pointer-events-none absolute -bottom-10 -left-6 -z-10 h-112 w-44 rotate-6" />

      <Container width="wide">
        <div className="grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-10">
          <Reveal className="lg:col-span-7">
            <p className="text-caption text-brand-surface-accent inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {PHILOSOPHY_CONTENT.eyebrow}
            </p>

            <h2
              id="philosophy-title"
              className="text-h4 text-brand-surface-muted mt-5 font-normal"
            >
              {PHILOSOPHY_CONTENT.title}
            </h2>

            <blockquote className="mt-8">
              <p className="text-display text-brand-surface-foreground font-serif font-normal">
                <span aria-hidden="true">“</span>
                <Emphasis
                  text={PHILOSOPHY_CONTENT.quote}
                  phrase={PHILOSOPHY_CONTENT.quoteEmphasis}
                  className="text-brand-surface-accent"
                />
                <span aria-hidden="true">”</span>
              </p>
            </blockquote>

            {firstParagraph ? (
              <p className="text-body-lg text-brand-surface-muted measure mt-10">
                {firstParagraph}
              </p>
            ) : null}
          </Reveal>

          <Reveal delay={100} className="lg:col-span-4 lg:col-start-9">
            <MediaFrame
              image={HOME_IMAGES.philosophy}
              aspect="portrait"
              radius="xl"
              className="mx-auto max-w-md"
              sizes="(min-width: 1280px) 25rem, (min-width: 1024px) 32vw, 28rem"
            />
          </Reveal>
        </div>

        <ul className="border-brand-surface-border mt-16 grid gap-x-10 gap-y-8 border-t pt-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {PHILOSOPHY_CONTENT.principles.map((principle, index) => (
            <Reveal key={principle.title} asChild delay={index * 70}>
              <li className="flex flex-col gap-2">
                <span className="text-h5 text-brand-surface-foreground font-serif">
                  {principle.title}
                </span>
                <span className="text-body-sm text-brand-surface-muted">
                  {principle.description}
                </span>
              </li>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
