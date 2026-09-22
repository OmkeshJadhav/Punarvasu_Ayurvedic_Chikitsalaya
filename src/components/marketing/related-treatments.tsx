import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { TreatmentCard } from "@/components/marketing/treatment-card";
import { Reveal } from "@/components/shared/reveal";
import { SERVICES_PATH } from "@/config/navigation";
import type { Treatment } from "@/features/services/types";

/**
 * Related treatments.
 *
 * ## The heading is the point
 *
 * "Explore related Ayurvedic therapies" — not "Recommended for you", not
 * "Because you viewed Shirodhara". This block is **content navigation, and
 * must never read as a medical recommendation**
 * (`docs/implementation-plan/phase_04.md` sections 33-34).
 *
 * The relationship behind it is editorial and static: a curated list on each
 * treatment, topped up from the same category. Nothing about the visitor is
 * involved, because nothing about the visitor is known — see
 * `getRelatedTreatments`.
 *
 * Renders nothing at all when there is nothing related, rather than a heading
 * over an empty row (`phase_04.md` section 60).
 *
 * A server component.
 */
export interface RelatedTreatmentsProps {
  readonly treatments: readonly Treatment[];
}

export function RelatedTreatments({ treatments }: RelatedTreatmentsProps) {
  if (treatments.length === 0) {
    return null;
  }

  return (
    <Section
      aria-labelledby="related-treatments-title"
      className="bg-muted border-border border-t"
    >
      <Container width="wide">
        <SectionHeader
          titleId="related-treatments-title"
          eyebrow="Continue exploring"
          title="Explore related Ayurvedic therapies"
          description="Listed because they sit near this one in the catalogue, not because they have been suggested for you. What is appropriate for you is decided at consultation."
        />

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {treatments.map((treatment, index) => (
            <Reveal key={treatment.slug} asChild delay={index * 70}>
              <li className="flex">
                <TreatmentCard
                  treatment={treatment}
                  imageSizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 100vw"
                />
              </li>
            </Reveal>
          ))}
        </ul>

        <p className="mt-10">
          <Link
            href={SERVICES_PATH}
            className="text-label text-primary ease-natural hover:text-primary-hover focus-visible:outline-ring inline-flex min-h-11 items-center gap-2 rounded-sm font-medium transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            View all services
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </Container>
    </Section>
  );
}
