import Link from "next/link";
import { ArrowUpRight, Leaf } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TextLink } from "@/components/marketing/text-link";
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
 * step for all three. The full treatment catalogue added in Phase 04 is a
 * text link beside the heading, where it does not compete with the cards' own
 * action.
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
        {/* The heading on the left and the catalogue link on the right, on
            one baseline: the link is where the eye lands after the heading,
            and it no longer competes with the cards' own action by sitting
            beneath them. */}
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            titleId="services-title"
            eyebrow={SERVICES_CONTENT.eyebrow}
            title={SERVICES_CONTENT.title}
            description={SERVICES_CONTENT.description}
          />
          {services.length > 0 ? (
            <TextLink href={SERVICES_PATH} className="shrink-0 md:mb-1">
              Explore all treatments
            </TextLink>
          ) : null}
        </Reveal>

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
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-8">
            {services.map((service, index) => (
              <Reveal key={service.slug} asChild delay={index * 90}>
                <li className="flex">
                  <ServiceCard service={service} />
                </li>
              </Reveal>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}

/**
 * One consultation area.
 *
 * Photograph first and large, then a restrained body: a hairline border, no
 * resting shadow. Elevation arrives only on hover, together with a slow
 * zoom of the photograph and the arrow filling in, so the card answers the
 * pointer without shouting at rest.
 *
 * The lift is `translate`, the zoom is `scale` - both compositor-only, so
 * neither triggers layout. `motion-safe` keeps both off for anyone who asked
 * for less movement; the border and arrow changes remain as the hover state.
 */
function ServiceCard({ service }: { readonly service: ServicePreview }) {
  return (
    <Card
      variant="interactive"
      padding="none"
      className="group hover:border-border-strong w-full overflow-hidden rounded-xl duration-(--duration-normal) hover:shadow-lg motion-safe:hover:-translate-y-1"
    >
      <div className="relative">
        <MediaFrame
          image={service.image}
          aspect="landscape"
          radius="none"
          // 25rem: three cards inside the capped 1280px container with 2rem
          // gutters render at ~373px, and a `sizes` that undershoots the real
          // width makes the browser pick a file it then upscales.
          sizes="(min-width: 1024px) 25rem, (min-width: 640px) 45vw, 100vw"
          imageClassName="motion-safe:ease-natural motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-105"
        />
        <span
          aria-hidden="true"
          className="border-border bg-card text-gold absolute -bottom-5 left-6 flex size-10 items-center justify-center rounded-full border"
        >
          <Leaf className="size-4.5" strokeWidth={1.5} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-6 pt-9 pb-6">
        <CardTitle className="text-h4 font-serif font-normal">
          <CardLink asChild>
            <Link href={PRIMARY_CTA.href}>{service.name}</Link>
          </CardLink>
        </CardTitle>

        <CardDescription className="text-body-sm text-prose flex-1">
          {service.description}
        </CardDescription>

        <span
          aria-hidden="true"
          className="border-border text-label text-primary mt-3 flex items-center justify-between border-t pt-5 font-medium"
        >
          Book a consultation
          <span className="border-border-strong ease-natural group-hover:bg-primary group-hover:text-primary-foreground flex size-10 items-center justify-center rounded-full border transition-colors duration-(--duration-normal) group-hover:border-transparent">
            <ArrowUpRight className="size-4" />
          </span>
        </span>
      </div>
    </Card>
  );
}
