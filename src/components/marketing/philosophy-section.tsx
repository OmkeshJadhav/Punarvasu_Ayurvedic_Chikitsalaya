import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Reveal } from "@/components/shared/reveal";
import { HOME_IMAGES } from "@/config/images";
import { HOME_SECTIONS, PHILOSOPHY_CONTENT } from "@/config/marketing-content";

/**
 * Ayurvedic philosophy — the page's one inverted section.
 *
 * ## Why a dark band here
 *
 * Eight light sections in a row read as one very long page. The inversion
 * gives the eye a rest point and marks the shift from "what we do" to "what we
 * believe", which is the natural place for it in the narrative. It is the only
 * one on the page; two would make it a pattern rather than an accent.
 *
 * Colours come from the `--brand-surface` token family added for exactly this
 * purpose, so no green is hardcoded here and every foreground pair is asserted
 * against WCAG AA in `src/lib/design/contrast.test.ts` (white text: 9.9:1,
 * body text: 7.3:1, the gold eyebrow: 8.7:1).
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
  return (
    <Section
      id={HOME_SECTIONS.philosophy}
      aria-labelledby="philosophy-title"
      // See `[data-surface="inverted"]` in `globals.css`.
      data-surface="inverted"
      className="anchor-offset bg-brand-surface text-brand-surface-foreground"
    >
      <Container width="wide">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <MediaFrame
              image={HOME_IMAGES.philosophy}
              aspect="wide"
              radius="xl"
              sizes="(min-width: 1280px) 37rem, (min-width: 1024px) 45vw, 100vw"
            />
          </Reveal>

          <Reveal>
            <p className="text-caption text-brand-surface-accent font-sans font-medium tracking-[0.18em] uppercase">
              {PHILOSOPHY_CONTENT.eyebrow}
            </p>

            <h2
              id="philosophy-title"
              className="text-h2 text-brand-surface-foreground mt-4 font-normal"
            >
              {PHILOSOPHY_CONTENT.title}
            </h2>

            <div className="measure mt-6 flex flex-col gap-4">
              {PHILOSOPHY_CONTENT.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-body-lg text-brand-surface-muted"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <ul className="border-brand-surface-border mt-8 grid gap-x-8 gap-y-5 border-t pt-8 sm:grid-cols-2">
              {PHILOSOPHY_CONTENT.principles.map((principle) => (
                <li key={principle.title} className="flex flex-col gap-1">
                  <span className="text-label text-brand-surface-foreground font-semibold">
                    {principle.title}
                  </span>
                  <span className="text-body-sm text-brand-surface-muted">
                    {principle.description}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <p className="text-body-sm text-brand-surface-muted border-brand-surface-border measure mt-12 border-t pt-6 lg:mt-16">
          {PHILOSOPHY_CONTENT.disclaimer}
        </p>
      </Container>
    </Section>
  );
}
