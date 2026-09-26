import Link from "next/link";
import { ArrowRight, Compass, MessageCircle, Sprout } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Button } from "@/components/ui/button";
import { SERVICES_PAGE_IMAGES } from "@/config/images";
import { CONTACT_PATH, PRIMARY_CTA } from "@/config/navigation";
import { CONTACT_SECTIONS } from "@/features/contact/content";
import { SERVICES_PAGE } from "@/features/services/content";

/**
 * The services page's closing invitation: a compact photographic band with
 * the copy on its left and the still life visible on its right.
 *
 * ## Why not `FinalCtaSection`
 *
 * The shared closing band centres its copy over a full-bleed scrim and takes
 * the section rhythm's full padding - right for a single line of invitation,
 * too tall and too uniform for a panoramic photograph whose subject sits at
 * one end. This band is left-aligned and uses its own, shorter padding.
 *
 * ## Legibility
 *
 * Only the side the copy occupies is darkened, and it is darkened with the
 * brand green rather than the warm `--scrim`: over this photograph's green
 * water a brown wash reads as mud. The strength is what carries the
 * guarantee. Composited over a pure-white image - the worst case - 75%
 * `--brand-surface` gives #56685f, on which white type measures 6.0:1, above
 * AA's 4.5:1.
 *
 * Below `lg` the copy spans the band, so the whole photograph takes a flat
 * 75% wash. From `lg` the wash runs left to right and holds at least 75% up
 * to 60% of the band's width; the copy column (`max-w-lg` inside the wide
 * container) ends before that point at every width from 1024px up.
 *
 * A server component.
 */
const REASSURANCE_ICONS = [Sprout, MessageCircle, Compass] as const;

export function ServicesCta() {
  const { cta } = SERVICES_PAGE;

  return (
    <section
      aria-labelledby="services-cta-title"
      // See `[data-surface="inverted"]` in `globals.css`.
      data-surface="inverted"
      className="bg-brand-surface text-brand-surface-foreground relative isolate overflow-hidden"
    >
      <MediaFrame
        image={SERVICES_PAGE_IMAGES.cta}
        aspect="fill"
        radius="none"
        sizes="100vw"
        className="-z-10"
      />
      <div
        aria-hidden="true"
        className="bg-brand-surface/75 lg:from-brand-surface/90 lg:via-brand-surface/75 absolute inset-0 -z-10 lg:bg-transparent lg:bg-linear-to-r lg:via-60% lg:to-transparent"
      />

      <Container width="wide" className="py-16 lg:py-20">
        <div className="max-w-lg">
          <p className="text-caption inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-current" />
            {cta.eyebrow}
          </p>

          <h2
            id="services-cta-title"
            className="text-h1 text-brand-surface-foreground mt-5 font-normal"
          >
            <Emphasis text={cta.title} phrase={cta.titleEmphasis} />
          </h2>

          <p className="text-body-lg mt-5">{cta.description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="inverse" className="group">
              <Link href={PRIMARY_CTA.href}>
                {PRIMARY_CTA.label}
                <ArrowRight
                  aria-hidden="true"
                  className="ease-natural transition-transform duration-(--duration-normal) group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline-inverse">
              <Link href={`${CONTACT_PATH}#${CONTACT_SECTIONS.enquiry}`}>
                {cta.secondaryLabel}
              </Link>
            </Button>
          </div>

          <ul className="border-brand-surface-foreground/25 mt-10 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:flex-wrap sm:gap-x-8">
            {cta.reassurances.map((item, index) => {
              const Icon = REASSURANCE_ICONS[index] ?? Sprout;
              return (
                <li
                  key={item}
                  className="text-body-sm inline-flex items-center gap-3"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-4.5 shrink-0"
                    strokeWidth={1.25}
                  />
                  {item}
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
