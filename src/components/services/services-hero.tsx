import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TextLink } from "@/components/marketing/text-link";
import { TrustPoints } from "@/components/marketing/trust-points";
import { Button } from "@/components/ui/button";
import { SERVICES_PAGE_IMAGES } from "@/config/images";
import { PRIMARY_CTA } from "@/config/navigation";
import { SERVICES_PAGE } from "@/features/services/content";

/**
 * The services page's opening: the page's `<h1>`, two actions and three
 * commitments about how care is organised, beside a photograph.
 *
 * ## One family of openings
 *
 * Built on the same composition as the About hero (`about/about-hero.tsx`):
 * from `lg` the photograph fills the right ~58% of the band edge to edge and
 * melts into the linen page through a gradient, so the headline sits on paper
 * and the image reads as a view beyond it. The copy column never extends past
 * the point where the gradient is still near-opaque linen, so the text is
 * dark-on-linen and needs no scrim. Below `lg` the photograph becomes a
 * full-bleed band under the copy.
 *
 * The actions and the trust row are the home hero's (`marketing/hero.tsx`):
 * a filled primary button beside a quiet text link, and `TrustPoints` under a
 * hairline. Three heroes, one grammar.
 *
 * ## Motion
 *
 * The photograph is the LCP element, so it carries `priority` and a
 * scale-only settle - opacity is never animated (`marketing/hero.tsx`).
 *
 * A server component.
 */
export function ServicesHero() {
  const { hero } = SERVICES_PAGE;
  const [firstLine, secondLine] = hero.title;

  return (
    <section
      aria-labelledby="services-hero-title"
      className="bg-background relative isolate overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 -z-10 hidden w-[58%] lg:block"
      >
        <MediaFrame
          image={{ ...SERVICES_PAGE_IMAGES.hero, alt: "" }}
          aspect="fill"
          radius="none"
          priority
          sizes="58vw"
          imageClassName="motion-safe:animate-settle"
        />
        <div className="from-background via-background/70 absolute inset-y-0 left-0 w-3/5 bg-linear-to-r to-transparent" />
        <div className="from-background absolute inset-x-0 bottom-0 h-24 bg-linear-to-t to-transparent" />
      </div>

      <BotanicalMotif className="text-gold/30 pointer-events-none absolute top-24 -left-8 -z-10 hidden h-96 w-36 rotate-12 xl:block" />

      <Container width="wide" className="pt-10 pb-14 lg:pt-14 lg:pb-20">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Treatments" }]}
        />

        <div className="max-w-xl pt-14 lg:pt-20">
          <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-current" />
            {hero.eyebrow}
          </p>

          {/* Wider than the copy column so the italic line holds together;
              it ends while the photograph's gradient is still near-opaque
              linen. */}
          <h1
            id="services-hero-title"
            className="text-display-2xl text-heading mt-6 font-normal lg:w-[44rem]"
          >
            {firstLine}
            <br />
            <em className="text-primary font-serif italic">{secondLine}</em>
          </h1>

          <p className="text-body-lg text-prose mt-7">{hero.description}</p>

          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
            <Button asChild size="lg" className="group w-full sm:w-auto">
              <Link href={PRIMARY_CTA.href}>
                {PRIMARY_CTA.label}
                <ArrowRight
                  aria-hidden="true"
                  className="ease-natural transition-transform duration-(--duration-normal) group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            <TextLink href={`#${hero.secondaryAction.targetId}`}>
              {hero.secondaryAction.label}
            </TextLink>
          </div>

          <TrustPoints points={hero.commitments} />
        </div>
      </Container>

      {/* The same photograph, full-bleed, where the split has no room. */}
      <MediaFrame
        image={SERVICES_PAGE_IMAGES.hero}
        aspect="landscape"
        radius="none"
        sizes="100vw"
        className="lg:hidden"
      />
    </section>
  );
}

/**
 * A single line of care guidance directly under the hero, where it is read
 * before anything on the page could be mistaken for a replacement for medical
 * care. The full disclaimer and emergency note are rendered in the open
 * further down, beside the FAQ.
 */
export function GentleReminder() {
  const { reminder } = SERVICES_PAGE;

  return (
    <div className="bg-background">
      <Container width="wide" className="py-6 lg:py-8">
        <p className="border-border bg-card/60 text-body-sm text-muted-foreground flex flex-col gap-2 rounded-xl border px-6 py-3.5 sm:flex-row sm:items-center sm:gap-4 lg:rounded-full">
          <span className="text-heading inline-flex shrink-0 items-center gap-2 font-medium">
            <Leaf
              aria-hidden="true"
              className="text-gold size-4"
              strokeWidth={1.5}
            />
            {reminder.label}
          </span>
          <span
            aria-hidden="true"
            className="bg-border-strong hidden h-4 w-px sm:block"
          />
          <span>{reminder.text}</span>
        </p>
      </Container>
    </div>
  );
}
