import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Reveal } from "@/components/shared/reveal";
import { CLINIC_IDENTITY } from "@/config/clinic";
import { ABOUT_PAGE, ABOUT_SECTIONS } from "@/features/about/content";

/**
 * "What Punarvasu means".
 *
 * ## Why this section exists at all
 *
 * It is the one thing on the About page that is both specific to this clinic
 * and verifiable without the clinic's help: the meaning of a Sanskrit word.
 * `docs/implementation-plan/phase_05.md` section 10 allows the name to be
 * explained provided the explanation is accurate and is not dressed up as
 * mythology - so this states what the word means and stops there. It does not
 * say why the clinic chose it, because nobody has told us
 * (`features/about/content.ts`).
 *
 * ## Composition
 *
 * The Devanagari form is set large, on the inverted brand band, as the
 * section's only ornament. It is the clinic's own name in its own script -
 * the opposite of a generic botanical motif, and the reason this page does
 * not need one.
 *
 * `lang="sa"` on the Devanagari, so a screen reader does not read it with
 * English pronunciation rules. The large glyphs are not `aria-hidden`: they
 * are the clinic's name, and a visitor using a screen reader should hear it.
 *
 * This is the About page's single inverted band
 * (`docs/DESIGN_SYSTEM.md` section 64).
 *
 * A server component apart from the shared reveal.
 */
export function BrandNameSection() {
  const { name } = ABOUT_PAGE;

  return (
    <Section
      id={ABOUT_SECTIONS.name}
      aria-labelledby="about-name-title"
      // See `[data-surface="inverted"]` in `globals.css`: it re-points the
      // focus ring, which is the primary green and invisible here.
      data-surface="inverted"
      className="anchor-offset bg-brand-surface text-brand-surface-foreground"
    >
      <Container width="wide">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <p
              lang="sa"
              className="text-display-xl text-brand-surface-foreground font-serif leading-none font-normal"
            >
              {CLINIC_IDENTITY.devanagariName}
            </p>
            <p className="text-caption text-brand-surface-accent mt-6 font-sans font-medium tracking-[0.18em] uppercase">
              {name.devanagariLabel}
            </p>
          </Reveal>

          <Reveal className="lg:col-span-7" delay={80}>
            <p className="text-caption text-brand-surface-accent font-sans font-medium tracking-[0.18em] uppercase">
              {name.eyebrow}
            </p>

            <h2
              id="about-name-title"
              className="text-h2 text-brand-surface-foreground mt-4 font-normal"
            >
              {name.title}
            </h2>

            <div className="measure mt-6 flex flex-col gap-5">
              {name.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-body-lg text-brand-surface-muted"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
