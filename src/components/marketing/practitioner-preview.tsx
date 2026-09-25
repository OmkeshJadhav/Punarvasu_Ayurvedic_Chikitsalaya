import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Emphasis } from "@/components/marketing/emphasis";
import { PractitionerPortrait } from "@/components/marketing/practitioner-portrait";
import { TextLink } from "@/components/marketing/text-link";
import { Reveal } from "@/components/shared/reveal";
import { HOME_SECTIONS } from "@/config/marketing-content";
import { PRACTITIONERS_HREF } from "@/config/navigation";
import { PRACTITIONERS_PAGE } from "@/features/practitioners/content";
import type { Practitioner } from "@/features/practitioners/types";
import { cn } from "@/lib/utils/cn";

/**
 * The home page's practitioner preview.
 *
 * ## Why this reads from the practitioners feature
 *
 * The home page reads the same roster as `/practitioners`, through the same
 * directory, so publishing a practitioner updates both pages at once and
 * there is one model of the domain concept (`AGENTS.md` section 32).
 *
 * ## Composition
 *
 * An editorial spread rather than a card grid: the heading, a sentence and a
 * link on the left, and the portraits on the right as tall photographs with
 * the name set beneath each - the way a printed prospectus introduces its
 * faculty. The second portrait sits lower than the first, so the pair reads
 * as two people rather than as two tiles. The `/practitioners` page keeps the
 * denser `PractitionerGrid`, which carries biographies this preview omits.
 *
 * ## What it can and cannot show
 *
 * Whatever the roster holds, and nothing more. No practitioner has been
 * confirmed for publication, so each portrait carries the explicit "Profile
 * to be published" state and the neutral heading "Practitioner profile"
 * rather than a name - never a `Dr. [name]` template, which a visitor reads as
 * a real, oddly formatted person. A placeholder photograph is labelled as one
 * on the image itself, not only in its alt text
 * (`features/practitioners/types.ts`).
 *
 * The section hides itself when the roster is empty: an empty band with a
 * heading over it is worse than one fewer section.
 */
export interface PractitionerPreviewSectionProps {
  readonly practitioners: readonly Practitioner[];
}

export function PractitionerPreviewSection({
  practitioners,
}: PractitionerPreviewSectionProps) {
  if (practitioners.length === 0) {
    return null;
  }

  return (
    <Section
      id={HOME_SECTIONS.practitioners}
      aria-labelledby="practitioners-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-4 lg:pt-4">
            <SectionHeader
              titleId="practitioners-title"
              eyebrow={PRACTITIONERS_PAGE.hero.eyebrow}
              title={
                <Emphasis
                  text={PRACTITIONERS_PAGE.hero.title}
                  phrase="sit with"
                  className="text-primary"
                />
              }
              description={PRACTITIONERS_PAGE.hero.description}
            />
            <TextLink href={PRACTITIONERS_HREF} className="mt-6">
              Meet our practitioners
            </TextLink>
          </Reveal>

          <ul className="grid gap-12 sm:grid-cols-2 sm:gap-8 lg:col-span-7 lg:col-start-6">
            {practitioners.map((practitioner, index) => (
              <Reveal key={practitioner.slug} asChild delay={index * 100}>
                <li className={cn(index % 2 === 1 && "sm:mt-20")}>
                  <PractitionerPortrait practitioner={practitioner} />
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
