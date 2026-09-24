import { MapPin, Phone } from "lucide-react";

import {
  CLINIC_CONTACT,
  CLINIC_IDENTITY,
  formatPhone,
  type ClinicContact,
} from "@/config/clinic";

import { Container } from "./container";

/**
 * The thin band above the header: where the clinic is and how to call it.
 *
 * The two facts a returning patient looks for most, taken out of the footer
 * and put where they are seen without scrolling. It scrolls away with the
 * page - only the header beneath it is sticky - so it costs no viewport once
 * the visitor is reading.
 *
 * Built only from verified contact details: each item renders when
 * `config/clinic.ts` holds it and not otherwise, and the whole band renders
 * nothing when neither is known. Opening hours are deliberately absent until
 * the clinic confirms them.
 *
 * Hidden below `md`. On a phone the header's menu is one tap away and a second
 * bar would push the hero below the fold.
 */
export interface SiteUtilityBarProps {
  readonly contact?: ClinicContact;
}

export function SiteUtilityBar({
  contact = CLINIC_CONTACT,
}: SiteUtilityBarProps) {
  const locality = contact.address
    ? `${contact.address.locality}, ${contact.address.region}`
    : undefined;
  const phone = formatPhone(contact.phone);

  if (!locality && !phone) {
    return null;
  }

  return (
    <div
      data-print="hide"
      // See `[data-surface="inverted"]` in `globals.css`.
      data-surface="inverted"
      className="bg-brand-surface text-brand-surface-muted hidden md:block"
    >
      <Container
        width="wide"
        className="text-caption flex h-9 items-center justify-between gap-6 tracking-[0.04em]"
      >
        <p className="inline-flex items-center gap-2">
          {locality ? (
            <>
              <MapPin aria-hidden="true" className="size-3.5" />
              <span>
                {CLINIC_IDENTITY.legalName} · {locality}
              </span>
            </>
          ) : null}
        </p>

        {phone && contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className="hover:text-brand-surface-foreground ease-natural inline-flex items-center gap-2 rounded-sm transition-colors duration-(--duration-fast)"
          >
            <Phone aria-hidden="true" className="size-3.5" />
            <span className="sr-only">Call the clinic: </span>
            {phone}
          </a>
        ) : null}
      </Container>
    </div>
  );
}
