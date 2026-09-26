import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { LeafSprig } from "@/components/marketing/leaf-sprig";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import {
  addressLines,
  formatPhone,
  openingHoursLines,
  type ClinicContact,
} from "@/config/clinic";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";
import { cn } from "@/lib/utils/cn";

/**
 * How to reach the clinic: the heading and two actions on the left, the four
 * details in an editorial grid on the right.
 *
 * ## Verified facts only, and absence stated rather than hidden
 *
 * Every value comes from `config/clinic.ts`. Where the clinic has confirmed a
 * detail it is shown and made actionable; where it has not, the cell says so
 * in a plain sentence rather than disappearing
 * (`docs/implementation-plan/phase_05.md` sections 29, 35 and 77). "What time
 * do they open?" is a question the visitor arrived with - silence leaves them
 * hunting, "we have not published that, please call" answers it.
 *
 * ## The grid
 *
 * One quiet panel divided by hairlines rather than four cards with shadows:
 * the details are one set of facts about one place, and boxing them
 * separately makes them look like four things to choose between. It is a
 * `<dl>`, so each label is announced with its value. Labels and values are
 * set exactly as in the home page's location details (`LocationSection`):
 * tracked caption labels over one body size for every value.
 *
 * ## Actions
 *
 * The phone is a `tel:` link on the stored E.164 value, both as the primary
 * button and as the number itself, which gets its own 44px target: on a phone
 * it is the most tapped thing on this page (`phase_05.md` section 56).
 *
 * A server component.
 */
export interface ContactDetailsProps {
  readonly contact: ClinicContact;
}

export function ContactDetails({ contact }: ContactDetailsProps) {
  const { channels, labels, unavailable } = CONTACT_PAGE;
  const lines = addressLines(contact.address);
  const hours = openingHoursLines(contact.openingHours);
  const phoneDisplay = formatPhone(contact.phone);

  return (
    <Section
      id={CONTACT_SECTIONS.channels}
      aria-labelledby="contact-channels-title"
      className="anchor-offset bg-muted border-border relative isolate overflow-hidden border-y"
    >
      {/* A faded branch entering from the lower-left corner. */}
      <LeafSprig
        sizes="26rem"
        className="absolute -bottom-20 -left-24 -z-10 hidden w-104 scale-x-[-1] rotate-[64deg] opacity-20 saturate-50 md:block"
      />

      <Container width="wide">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <Reveal className="lg:col-span-5">
            <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {channels.eyebrow}
            </p>
            <h2
              id="contact-channels-title"
              className="text-display text-heading mt-5 font-normal"
            >
              {channels.title}
            </h2>
            <p className="text-body-lg text-prose mt-6 max-w-md">
              {channels.description}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {contact.phone ? (
                <Button asChild size="lg" block className="sm:w-auto">
                  <a href={`tel:${contact.phone}`}>
                    <Phone aria-hidden="true" strokeWidth={1.5} />
                    {labels.phoneAction}
                    {phoneDisplay ? (
                      <span className="sr-only">: {phoneDisplay}</span>
                    ) : null}
                  </a>
                </Button>
              ) : null}
              {contact.directionsUrl ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  block
                  className="bg-background/60 sm:w-auto"
                >
                  <Link
                    href={contact.directionsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <MapPin aria-hidden="true" strokeWidth={1.5} />
                    {labels.directions}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-7">
            <dl className="border-border bg-background/70 divide-border grid divide-y rounded-xl border sm:grid-cols-2 sm:divide-y-0">
              <ContactDetail
                icon={<Phone />}
                label={labels.phone}
                className="sm:border-border sm:border-r sm:border-b"
              >
                {contact.phone && phoneDisplay ? (
                  <>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-body text-heading hover:text-primary focus-visible:outline-ring -my-1.5 flex min-h-11 w-fit items-center rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {phoneDisplay}
                    </a>
                    <span className="text-body-sm text-muted-foreground mt-1 block">
                      {labels.phoneHelp}
                    </span>
                  </>
                ) : (
                  <Unconfirmed>{unavailable.phone}</Unconfirmed>
                )}
              </ContactDetail>

              <ContactDetail
                icon={<Mail />}
                label={labels.email}
                className="sm:border-border sm:border-b"
              >
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-body text-heading hover:text-primary focus-visible:outline-ring -my-1.5 flex min-h-11 w-fit items-center rounded-sm break-all focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {contact.email}
                  </a>
                ) : (
                  <Unconfirmed>{unavailable.email}</Unconfirmed>
                )}
              </ContactDetail>

              <ContactDetail
                icon={<Clock />}
                label={labels.hours}
                className="sm:border-border sm:border-r"
              >
                {hours.length > 0 ? (
                  <span className="text-body text-heading">
                    {hours.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                ) : (
                  <Unconfirmed>{unavailable.hours}</Unconfirmed>
                )}
              </ContactDetail>

              <ContactDetail icon={<MapPin />} label={labels.address}>
                {lines.length > 0 ? (
                  // An address is read, copied and typed into a maps app, so
                  // it is set over lines rather than wrapped wherever the
                  // column ends.
                  <address className="text-body text-heading not-italic">
                    {lines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                ) : (
                  <Unconfirmed>{unavailable.address}</Unconfirmed>
                )}
              </ContactDetail>
            </dl>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/**
 * A detail the clinic has not confirmed.
 *
 * Muted rather than warning-coloured: an unpublished opening time is a gap,
 * not a hazard. The text carries the meaning, so nothing depends on colour.
 */
function Unconfirmed({ children }: { readonly children: ReactNode }) {
  return <span className="text-body-sm text-muted-foreground">{children}</span>;
}

/**
 * One cell of the grid. The icon is decorative - the `<dt>` already names the
 * detail. `<dt>`/`<dd>` are direct children of the wrapping `<div>`, which is
 * what keeps the definition list valid.
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
    <div
      className={cn(
        "grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 p-6 sm:p-8",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="text-terracotta row-span-2 mt-px shrink-0 [&_svg]:size-5 [&_svg]:stroke-[1.25]"
      >
        {icon}
      </span>
      <dt className="text-caption text-muted-foreground font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
