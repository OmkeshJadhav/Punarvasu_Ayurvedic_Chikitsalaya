import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { MapEmbed } from "@/components/marketing/map-embed";
import { Button } from "@/components/ui/button";
import { addressLines, type ClinicContact } from "@/config/clinic";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";

/**
 * "Where the clinic is".
 *
 * The heading block carries the two actions that work without loading
 * anything from a third party - directions, and the clinic's listing in
 * Google Maps - and `MapEmbed` handles the frame, which renders with the page
 * and carries the address in text beneath it
 * (`docs/implementation-plan/phase_05.md` section 34).
 *
 * Renders nothing when there is no address: a "finding us" section with no
 * location in it is a heading over a blank.
 *
 * A server component, and so is everything it renders: the contact page now
 * ships no page-specific JavaScript beyond the FAQ disclosure.
 */
export interface ClinicLocationProps {
  readonly contact: ClinicContact;
}

export function ClinicLocation({ contact }: ClinicLocationProps) {
  const lines = addressLines(contact.address);

  if (lines.length === 0) {
    return null;
  }

  return (
    <Section
      id={CONTACT_SECTIONS.location}
      aria-labelledby="clinic-location-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="clinic-location-title"
              eyebrow={CONTACT_PAGE.location.eyebrow}
              title={CONTACT_PAGE.location.title}
              description={CONTACT_PAGE.location.description}
            />

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              {contact.directionsUrl ? (
                <Button asChild block className="sm:w-auto">
                  <Link
                    href={contact.directionsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {CONTACT_PAGE.labels.directions}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                </Button>
              ) : null}

              {contact.mapUrl ? (
                <Button asChild variant="outline" block className="sm:w-auto">
                  <Link
                    href={contact.mapUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {CONTACT_PAGE.labels.openInMaps}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-7">
            <MapEmbed embedUrl={contact.mapEmbedUrl} addressLines={lines} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
