import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { MapFrame } from "@/components/marketing/map-embed";
import { Button } from "@/components/ui/button";
import {
  addressLines,
  formatPhone,
  hasPublishableContact,
  type ClinicContact,
} from "@/config/clinic";
import { HOME_SECTIONS } from "@/config/marketing-content";
import { CONTACT_PAGE } from "@/features/contact/content";

/**
 * "Visit the clinic" - the home page's location card.
 *
 * Sits beside the questions in `FaqSection`, because the two answer the same
 * thing - what a first visit involves - and a visitor who has read the one
 * usually wants the other next. It is still its own `<section>` and its own
 * anchor (`#book`), so the footer's deep link and a screen reader's region list
 * both reach it directly.
 *
 * ## What renders
 *
 * Only what `config/clinic.ts` actually holds. An address is the one piece of
 * content on a clinic website that a visitor physically acts on, and a
 * plausible invented one sends someone to the wrong building, so every detail
 * is conditional and the card renders `null` when none is known
 * (`docs/implementation-plan/phase_03.md` section 48). Opening hours appear
 * the moment the clinic supplies them; until then there is no row.
 *
 * ## Composition
 *
 * The clinic's real map on top, then a deep green panel holding the details
 * as label/value rows and two pill actions. The map is `MapFrame` - lazily
 * loaded, so it costs nothing until it scrolls into view - and the privacy
 * note `MapEmbed` would print under it is printed at the foot of the panel
 * instead. The phone number is grouped for reading (`formatPhone`) while the
 * `tel:` target stays the stored E.164 value.
 *
 * "Get directions" is the linen pill: on this panel it is the primary action,
 * and "Book a Consultation" is not in the card to compete with it.
 */
export interface LocationSectionProps {
  readonly contact: ClinicContact;
}

export function LocationSection({ contact }: LocationSectionProps) {
  if (!hasPublishableContact(contact)) {
    return null;
  }

  const lines = addressLines(contact.address);
  const phone = formatPhone(contact.phone);

  return (
    <section
      id={HOME_SECTIONS.contact}
      aria-labelledby="location-title"
      className="anchor-offset border-border overflow-hidden rounded-xl border shadow-md"
    >
      {contact.mapEmbedUrl ? (
        <MapFrame embedUrl={contact.mapEmbedUrl} className="bg-muted h-60" />
      ) : null}

      <div
        // See `[data-surface="inverted"]` in `globals.css`.
        data-surface="inverted"
        className="bg-brand-surface text-brand-surface-foreground px-6 py-8 sm:px-8"
      >
        <h2
          id="location-title"
          className="text-caption text-brand-surface-accent inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase before:h-px before:w-8 before:bg-current before:content-['']"
        >
          Visit the clinic
        </h2>

        <dl className="mt-5">
          {lines.length > 0 ? (
            <ContactDetail label="Address">
              {lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </ContactDetail>
          ) : null}

          {contact.openingHours ? (
            <ContactDetail label="Hours">{contact.openingHours}</ContactDetail>
          ) : null}

          {contact.phone ? (
            <ContactDetail label="Phone">
              <a
                href={`tel:${contact.phone}`}
                className="link-underline hover:link-underline-active rounded-sm"
              >
                {phone}
              </a>
            </ContactDetail>
          ) : null}

          {contact.email ? (
            <ContactDetail label="Email">
              <a
                href={`mailto:${contact.email}`}
                className="link-underline hover:link-underline-active rounded-sm"
              >
                {contact.email}
              </a>
            </ContactDetail>
          ) : null}
        </dl>

        <div className="mt-7 flex flex-wrap gap-3">
          {contact.directionsUrl ? (
            <Button asChild variant="inverse" className="rounded-full px-6">
              <Link
                href={contact.directionsUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <MapPin aria-hidden="true" />
                Get directions
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            </Button>
          ) : null}

          {contact.phone ? (
            <Button
              asChild
              variant="outline"
              className="border-brand-surface-border text-brand-surface-foreground hover:text-brand-surface-foreground rounded-full px-6 hover:border-current hover:bg-transparent"
            >
              <a href={`tel:${contact.phone}`}>
                <Phone aria-hidden="true" />
                Call the clinic
              </a>
            </Button>
          ) : null}
        </div>

        {contact.mapEmbedUrl ? (
          <p className="text-caption text-brand-surface-muted mt-7">
            {CONTACT_PAGE.location.mapPrivacyNote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** One label/value row, divided from the next by a hairline. */
function ContactDetail({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="border-brand-surface-border/60 grid gap-1 border-b py-4 first:border-t sm:grid-cols-[6rem_1fr] sm:gap-5">
      <dt className="text-caption text-brand-surface-muted pt-0.5 font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd className="text-body-sm text-brand-surface-foreground">{children}</dd>
    </div>
  );
}
