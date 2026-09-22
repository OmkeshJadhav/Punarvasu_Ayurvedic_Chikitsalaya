import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import {
  formatAddress,
  hasPublishableContact,
  type ClinicContact,
} from "@/config/clinic";
import { HOME_SECTIONS } from "@/config/marketing-content";

/**
 * "Visit us".
 *
 * ## Why this renders nothing today
 *
 * No clinic address, phone number, email or opening hours has been supplied to
 * this repository. An address is the one piece of content on a clinic website
 * that a visitor physically acts on, and a plausible invented one sends
 * someone to the wrong building. So the section renders `null` unless
 * `config/clinic.ts` actually holds a detail — the documented "hide the
 * optional section" path from `docs/implementation-plan/phase_03.md` section
 * 48, rather than a card grid full of "Address: TBC".
 *
 * Filling in `CLINIC_CONTACT` is the entire change needed to publish it: this
 * component, the footer's contact block and the JSON-LD all read from that one
 * module.
 *
 * ## Map
 *
 * There is deliberately no embedded map. A third-party map iframe is a
 * third-party script, a set of cookies and a chunk of render-blocking weight
 * on a page whose whole point is loading fast — and there is no address to
 * centre it on anyway. `directionsUrl` gives a plain link out to a map
 * provider instead, which costs nothing.
 */
export interface LocationSectionProps {
  readonly contact: ClinicContact;
}

export function LocationSection({ contact }: LocationSectionProps) {
  if (!hasPublishableContact(contact)) {
    return null;
  }

  const address = formatAddress(contact.address);

  return (
    <Section
      id={HOME_SECTIONS.contact}
      aria-labelledby="location-title"
      className="anchor-offset bg-muted border-border border-y"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="location-title"
              eyebrow="Visit us"
              title="Finding the clinic"
              description="Everything you need to plan a visit."
            />

            {contact.directionsUrl ? (
              <Button asChild variant="outline" className="mt-7">
                <Link
                  href={contact.directionsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Get directions
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>
              </Button>
            ) : null}
          </div>

          <dl className="grid gap-6 sm:grid-cols-2 lg:col-span-7">
            {address ? (
              <ContactDetail icon={<MapPin />} label="Address">
                {address}
              </ContactDetail>
            ) : null}

            {contact.openingHours ? (
              <ContactDetail icon={<Clock />} label="Opening hours">
                {contact.openingHours}
              </ContactDetail>
            ) : null}

            {contact.phone ? (
              <ContactDetail icon={<Phone />} label="Phone">
                <a
                  href={`tel:${contact.phone}`}
                  className="hover:text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {contact.phone}
                </a>
              </ContactDetail>
            ) : null}

            {contact.email ? (
              <ContactDetail icon={<Mail />} label="Email">
                <a
                  href={`mailto:${contact.email}`}
                  className="hover:text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {contact.email}
                </a>
              </ContactDetail>
            ) : null}
          </dl>
        </div>
      </Container>
    </Section>
  );
}

/**
 * One labelled detail. The icon is decorative — the `<dt>` already names the
 * detail, so repeating it to a screen reader adds nothing.
 */
function ContactDetail({
  icon,
  label,
  children,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    // `<dt>`/`<dd>` must be *direct* children of the wrapping `<div>` for the
    // definition list to stay valid, so the icon is placed by the grid rather
    // than by an extra nesting level.
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      <span
        aria-hidden="true"
        className="text-primary row-span-2 mt-0.5 shrink-0 [&_svg]:size-5"
      >
        {icon}
      </span>
      <dt className="text-caption text-muted-foreground font-medium tracking-[0.12em] uppercase">
        {label}
      </dt>
      <dd className="text-body text-foreground">{children}</dd>
    </div>
  );
}
