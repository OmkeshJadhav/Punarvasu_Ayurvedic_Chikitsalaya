import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { MediaFrame } from "@/components/marketing/media-frame";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardLink,
  CardTitle,
} from "@/components/ui/card";
import {
  HOME_SECTIONS,
  SERVICES_CONTENT,
  type ServicePreview,
} from "@/config/marketing-content";
import { PRIMARY_CTA, SERVICES_PATH } from "@/config/navigation";

/**
 * Featured consultation areas.
 *
 * Data-driven: the section renders whatever list it is handed, which is the
 * seam a later phase replaces with treatment records from the database. It
 * takes the list as a prop rather than importing it so that the page decides
 * what to show and this component stays testable with fixtures.
 *
 * ## Graceful degradation
 *
 * An empty list renders a short empty state that still points at the primary
 * action, rather than an awkward grid of nothing
 * (`docs/implementation-plan/phase_03.md` section 48). The rest of the page is
 * unaffected either way — no section on this page can take another one down,
 * because none of them fetches anything.
 *
 * ## Card interaction
 *
 * Each card's whole surface is the link, via `CardLink`'s stretched
 * pseudo-element: one focusable element, a real accessible name, working
 * middle-click and a focus ring around the card. There is no `onClick` on a
 * `<div>` anywhere here.
 *
 * Each card leads to the consultation request rather than to a treatment
 * page, and that is deliberate: these are *areas people consult us about*,
 * not therapies the clinic offers, so a consultation genuinely is the next
 * step for all three. The full treatment catalogue added in Phase 04 is one
 * link below the grid, where it does not compete with the cards' own action.
 */
export interface ServicePreviewSectionProps {
  readonly services: readonly ServicePreview[];
}

export function ServicePreviewSection({
  services,
}: ServicePreviewSectionProps) {
  return (
    <Section
      id={HOME_SECTIONS.services}
      aria-labelledby="services-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        {/* Centred, unlike the asymmetric two-column sections: a heading that
            introduces an evenly-weighted grid should sit over the middle of
            it, not off to one side of it. */}
        <SectionHeader
          titleId="services-title"
          align="center"
          eyebrow={SERVICES_CONTENT.eyebrow}
          title={SERVICES_CONTENT.title}
          description={SERVICES_CONTENT.description}
        />

        {services.length === 0 ? (
          <EmptyState
            className="mt-10"
            title="Consultation areas are being prepared"
            description="You can still request a consultation and tell us what brought you here."
            action={
              <Button asChild>
                <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-8">
              {services.map((service, index) => (
                <Reveal key={service.slug} asChild delay={index * 80}>
                  <li className="flex">
                    <ServiceCard service={service} />
                  </li>
                </Reveal>
              ))}
            </ul>

            <p className="mt-10 flex justify-center">
              <Link
                href={SERVICES_PATH}
                className="text-label text-primary ease-natural hover:text-primary-hover focus-visible:outline-ring inline-flex min-h-11 items-center gap-2 rounded-sm font-medium transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Explore all treatments
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </p>
          </>
        )}
      </Container>
    </Section>
  );
}

function ServiceCard({ service }: { readonly service: ServicePreview }) {
  return (
    <Card
      variant="interactive"
      padding="none"
      className="group w-full overflow-hidden"
    >
      <MediaFrame
        image={service.image}
        aspect="landscape"
        radius="none"
        // 24rem, not 22rem: three cards inside the capped 1280px container
        // with 2rem gutters render at ~373px, and a `sizes` that undershoots
        // the real width makes the browser pick a file it then upscales.
        sizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 100vw"
        // A restrained hover: the photograph settles fractionally closer.
        // `motion-safe` keeps it off entirely for anyone who asked for less.
        imageClassName="motion-safe:ease-natural motion-safe:transition-transform motion-safe:duration-(--duration-normal) motion-safe:group-hover:scale-105"
      />

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <CardTitle className="text-h5 font-serif">
          <CardLink asChild>
            <Link href={PRIMARY_CTA.href}>{service.name}</Link>
          </CardLink>
        </CardTitle>

        <CardDescription className="text-body-sm text-prose flex-1">
          {service.description}
        </CardDescription>

        <span
          aria-hidden="true"
          className="text-label text-primary ease-natural mt-1 inline-flex items-center gap-2 font-medium transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
        >
          Book a consultation
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Card>
  );
}
