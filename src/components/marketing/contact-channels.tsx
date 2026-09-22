import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { addressLines, formatPhone, type ClinicContact } from "@/config/clinic";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";
import { cn } from "@/lib/utils/cn";

/**
 * How to reach the clinic.
 *
 * ## Verified facts only, and absence stated rather than hidden
 *
 * Every value comes from `config/clinic.ts`. Where the clinic has confirmed a
 * detail it is shown and made actionable; where it has not, the block renders
 * a plain sentence saying it has not been confirmed
 * (`docs/implementation-plan/phase_05.md` sections 29, 35 and 77).
 *
 * Saying so beats omitting it here. "What time do they open?" is a question
 * the visitor arrived with - silence leaves them hunting, whereas "we have
 * not published that, please call" answers it and offers the way forward.
 *
 * ## Actions
 *
 * The phone is a `tel:` link using the stored E.164 value, so a dialler never
 * has to parse the display spacing, and it is also a full-width primary
 * button on mobile. `phase_05.md` section 56 is blunt about this: do not make
 * someone hunt for the phone number on a phone.
 *
 * A server component. Nothing here needs JavaScript.
 */
export interface ContactChannelsProps {
  readonly contact: ClinicContact;
}

export function ContactChannels({ contact }: ContactChannelsProps) {
  const { labels, unavailable } = CONTACT_PAGE;
  const lines = addressLines(contact.address);
  const phoneDisplay = formatPhone(contact.phone);

  return (
    <Section
      id={CONTACT_SECTIONS.channels}
      aria-labelledby="contact-channels-title"
      className="anchor-offset bg-muted border-border border-y"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="contact-channels-title"
              eyebrow={CONTACT_PAGE.channels.eyebrow}
              title={CONTACT_PAGE.channels.title}
              description={CONTACT_PAGE.channels.description}
            />

            {contact.phone ? (
              <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Button asChild size="lg" block className="sm:w-auto">
                  <a href={`tel:${contact.phone}`}>{labels.phoneAction}</a>
                </Button>
                {contact.directionsUrl ? (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    block
                    className="sm:w-auto"
                  >
                    <Link
                      href={contact.directionsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {labels.directions}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-7">
            {contact.phone && phoneDisplay ? (
              <ContactDetail icon={<Phone />} label={labels.phone}>
                <a
                  href={`tel:${contact.phone}`}
                  // A phone number on a phone is the most tapped thing on
                  // this page, so it gets a full 44px target of its own
                  // rather than relying on the button beside it.
                  className="text-body-lg hover:text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {phoneDisplay}
                </a>
                <span className="text-body-sm text-muted-foreground mt-1 block">
                  {labels.phoneHelp}
                </span>
              </ContactDetail>
            ) : null}

            {lines.length > 0 ? (
              <ContactDetail icon={<MapPin />} label={labels.address}>
                {/*
                  An address is read, copied and typed into a maps app, so it
                  is set over several lines rather than as one long sentence
                  that wraps wherever the column happens to end.
                */}
                <address className="not-italic">
                  {lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </ContactDetail>
            ) : null}

            <ContactDetail icon={<Clock />} label={labels.hours}>
              {contact.openingHours ? (
                contact.openingHours
              ) : (
                <Unconfirmed>{unavailable.hours}</Unconfirmed>
              )}
            </ContactDetail>

            <ContactDetail icon={<Mail />} label={labels.email}>
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="hover:text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {contact.email}
                </a>
              ) : (
                <Unconfirmed>{unavailable.email}</Unconfirmed>
              )}
            </ContactDetail>
          </dl>
        </div>
      </Container>
    </Section>
  );
}

/**
 * A detail the clinic has not confirmed.
 *
 * Muted rather than warning-coloured: an unpublished opening time is a gap,
 * not a hazard, and a page of amber notices trains a reader to ignore the one
 * that matters. The text carries the meaning, so nothing here depends on the
 * colour.
 */
function Unconfirmed({ children }: { readonly children: ReactNode }) {
  return <span className="text-body-sm text-muted-foreground">{children}</span>;
}

/**
 * One labelled detail. The icon is decorative - the `<dt>` already names the
 * detail, so repeating it to a screen reader adds nothing.
 */
function ContactDetail({
  icon,
  label,
  children,
  className,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    // `<dt>`/`<dd>` must be *direct* children of the wrapping `<div>` for the
    // definition list to stay valid, so the icon is placed by the grid rather
    // than by an extra nesting level.
    <div className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-1", className)}>
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
