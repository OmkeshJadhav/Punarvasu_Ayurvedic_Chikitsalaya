import Link from "next/link";
import { ExternalLink, Navigation } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MapEmbed } from "@/components/marketing/map-embed";
import { LeafSprig } from "@/components/marketing/leaf-sprig";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { addressLines, type ClinicContact } from "@/config/clinic";
import { CONTACT_PAGE_IMAGES } from "@/config/images";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";

/**
 * "Where the clinic is": place and calm.
 *
 * ## Composition
 *
 * The heading, a sentence and the two actions on the left, with a branch
 * beside the heading; the map in a rounded frame on the right with the address
 * in a quiet panel beneath it. A misted landscape rises from the lower edge
 * under the copy, faded into the page - it is atmosphere, decorative and
 * uncaptioned, and deliberately not presented as the view from the clinic
 * (`CONTACT_PAGE_IMAGES`).
 *
 * ## The map is an enhancement
 *
 * The directions and "Open in Google Maps" actions work without loading
 * anything from a third party, and the address is text beneath the frame, in
 * the details above and in the footer. Nobody has to interpret a map image to
 * find the clinic (`docs/implementation-plan/phase_05.md` section 34).
 * `MapEmbed` renders the frame, the address beneath it and the third-party
 * disclosure.
 *
 * Renders nothing when there is no address: a "finding us" section with no
 * location in it is a heading over a blank.
 *
 * A server component.
 */
export interface ContactLocationProps {
  readonly contact: ClinicContact;
}

export function ContactLocation({ contact }: ContactLocationProps) {
  const { location, labels } = CONTACT_PAGE;
  const lines = addressLines(contact.address);

  if (lines.length === 0) {
    return null;
  }

  return (
    <Section
      id={CONTACT_SECTIONS.location}
      aria-labelledby="clinic-location-title"
      className="anchor-offset bg-background relative isolate overflow-hidden pb-44 md:pb-52 lg:pb-28"
    >
      {/* The landscape: a band along the foot of the section on small
          screens, the lower-left corner from `lg`. The blend and the mask sit
          on the frame itself so the photograph dissolves into the linen
          rather than ending on an edge. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-52 mask-[linear-gradient(to_top,black_35%,transparent)] opacity-80 mix-blend-multiply md:h-64 lg:right-auto lg:h-72 lg:w-[55%] lg:mask-[linear-gradient(to_top,black_25%,transparent_85%),linear-gradient(to_right,black_55%,transparent)] lg:mask-intersect"
      >
        <MediaFrame
          image={CONTACT_PAGE_IMAGES.landscape}
          aspect="fill"
          radius="none"
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="bg-transparent"
        />
      </div>

      <Container width="wide">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="relative lg:col-span-5">
            <LeafSprig
              sizes="10rem"
              className="absolute -top-6 right-0 hidden w-40 rotate-[18deg] opacity-80 sm:block"
            />

            <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {location.eyebrow}
            </p>
            <h2
              id="clinic-location-title"
              className="text-display text-heading mt-5 max-w-[11ch] font-normal"
            >
              {location.title}
            </h2>
            <p className="text-body-lg text-prose mt-6 max-w-md">
              {location.description}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {contact.directionsUrl ? (
                <Button asChild block className="sm:w-auto">
                  <Link
                    href={contact.directionsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <Navigation aria-hidden="true" strokeWidth={1.5} />
                    {labels.directions}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                </Button>
              ) : null}
              {contact.mapUrl ? (
                <Button
                  asChild
                  variant="outline"
                  block
                  className="bg-background/60 sm:w-auto"
                >
                  <Link
                    href={contact.mapUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <ExternalLink aria-hidden="true" strokeWidth={1.5} />
                    {labels.openInMaps}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7">
            <MapEmbed embedUrl={contact.mapEmbedUrl} addressLines={lines} />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
