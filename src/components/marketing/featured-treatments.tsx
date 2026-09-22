import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { TreatmentCard } from "@/components/marketing/treatment-card";
import { Reveal } from "@/components/shared/reveal";
import { SERVICES_PAGE } from "@/features/services/content";
import type { Treatment } from "@/features/services/types";

/**
 * The three starting points.
 *
 * ## Why "most asked about" and not "most recommended"
 *
 * A featured row on a healthcare site is one step away from reading as
 * clinical advice. The heading and the standfirst say explicitly that these
 * are the treatments people ask about most often, and that Punarvasu does not
 * recommend a therapy before meeting someone
 * (`docs/implementation-plan/phase_04.md` sections 16-17).
 *
 * Which treatments appear is an editorial decision recorded as `featured` in
 * the catalogue, not a ranking derived from anything.
 *
 * Renders nothing when nothing is featured, so a catalogue that has not
 * chosen any does not produce an empty band.
 *
 * A server component.
 */
export interface FeaturedTreatmentsProps {
  readonly treatments: readonly Treatment[];
}

export function FeaturedTreatments({ treatments }: FeaturedTreatmentsProps) {
  if (treatments.length === 0) {
    return null;
  }

  return (
    <Section aria-labelledby="featured-title" className="bg-background">
      <Container width="wide">
        <SectionHeader
          titleId="featured-title"
          eyebrow={SERVICES_PAGE.featured.eyebrow}
          title={SERVICES_PAGE.featured.title}
          description={SERVICES_PAGE.featured.description}
        />

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-8">
          {treatments.map((treatment, index) => (
            <Reveal key={treatment.slug} asChild delay={index * 80}>
              <li className="flex">
                <TreatmentCard
                  treatment={treatment}
                  featured
                  imageSizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 100vw"
                />
              </li>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
