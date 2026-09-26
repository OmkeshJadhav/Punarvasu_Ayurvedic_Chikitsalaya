import Link from "next/link";
import { CalendarDays, Phone } from "lucide-react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TrustPoints } from "@/components/marketing/trust-points";
import { Button } from "@/components/ui/button";
import { formatPhone, type ClinicContact } from "@/config/clinic";
import { CONTACT_PAGE_IMAGES } from "@/config/images";
import { PRIMARY_CTA } from "@/config/navigation";
import { CONTACT_PAGE } from "@/features/contact/content";

/**
 * The contact page's opening: the `<h1>`, the two ways to begin, and a still
 * life of the dispensary bench.
 *
 * ## Composition
 *
 * Unlike the About and Services heroes, the photograph does not melt into the
 * page. From `lg` it is a framed window on the right - full height, flush to
 * the viewport edge, with one softly arched corner facing the copy - so the
 * contact page opens on something quieter and more object-like than a
 * panorama. The copy column never reaches it, so the text is dark-on-linen
 * and needs no scrim. Below `lg` the photograph becomes a band under the copy.
 *
 * ## Actions
 *
 * Two, of different weight: calling (the channel that reaches someone today)
 * is the filled button, and booking is the outline beside it. The call is a
 * `tel:` link on the stored E.164 value, and its accessible name carries the
 * number so a screen reader user knows what will be dialled.
 *
 * ## Typography
 *
 * The same grammar as the About and Services heroes: a rule-led eyebrow, the
 * `display-2xl` serif headline with one phrase in green italic, `body-lg`
 * prose, and `TrustPoints` under a hairline.
 *
 * The photograph is the LCP element: `priority`, and a scale-only settle.
 *
 * A server component.
 */
export interface ContactHeroProps {
  readonly contact: ClinicContact;
}

export function ContactHero({ contact }: ContactHeroProps) {
  const { hero, labels } = CONTACT_PAGE;
  const phoneDisplay = formatPhone(contact.phone);

  return (
    <section
      aria-labelledby="contact-title"
      className="bg-background relative isolate overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 -z-10 hidden w-[42%] overflow-hidden rounded-tl-[9rem] lg:block"
      >
        <MediaFrame
          image={{ ...CONTACT_PAGE_IMAGES.hero, alt: "" }}
          aspect="fill"
          radius="none"
          priority
          sizes="42vw"
          imageClassName="motion-safe:animate-settle"
        />
      </div>

      <Container width="wide" className="pt-10 pb-14 lg:pt-14 lg:pb-24">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Contact" }]}
        />

        <div className="relative max-w-xl pt-14 lg:max-w-[52%] lg:pt-20 lg:pb-6">
          <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-current" />
            {hero.eyebrow}
          </p>

          <h1
            id="contact-title"
            className="text-display-2xl text-heading mt-6 font-normal"
          >
            <Emphasis
              text={hero.title}
              phrase={hero.titleEmphasis}
              className="text-primary"
            />
          </h1>

          <p className="text-body-lg text-prose mt-7 max-w-lg">
            {hero.description}
          </p>

          <div className="relative mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
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
            <Button
              asChild
              size="lg"
              variant="outline"
              block
              className="bg-background/60 sm:w-auto"
            >
              <Link href={PRIMARY_CTA.href}>
                <CalendarDays aria-hidden="true" strokeWidth={1.5} />
                {PRIMARY_CTA.label}
              </Link>
            </Button>

            {/* A line of voice set where the page meets the photograph, level
                with the actions, whose row ends well short of it. Set like
                the About page's italic serif lines. Wide screens only: on a
                phone it would be one more sentence between the visitor and
                the phone number. */}
            <p className="text-h5 text-heading absolute top-1/2 -right-12 hidden w-44 -translate-y-1/2 -rotate-[10deg] font-serif italic xl:block">
              {hero.aside}
            </p>
          </div>

          <TrustPoints points={hero.commitments} />
        </div>
      </Container>

      {/* The same photograph where the split has no room. */}
      <MediaFrame
        image={CONTACT_PAGE_IMAGES.hero}
        aspect="landscape"
        radius="none"
        sizes="100vw"
        className="lg:hidden"
      />
    </section>
  );
}
