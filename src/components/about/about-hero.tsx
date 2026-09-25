import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TextLink } from "@/components/marketing/text-link";
import { Button } from "@/components/ui/button";
import { ABOUT_IMAGES } from "@/config/images";
import { PRIMARY_CTA } from "@/config/navigation";
import { ABOUT_PAGE, ABOUT_SECTIONS } from "@/features/about/content";

/**
 * The About page's opening: a cinematic photograph and the page's `<h1>`.
 *
 * ## Composition
 *
 * From `lg`, the photograph fills the right ~58% of the band edge to edge
 * and melts into the linen page through a gradient, so the headline sits on
 * paper and the image reads as a view beyond it - a window rather than a
 * framed picture. The copy column never extends past the point where the
 * gradient is still near-opaque linen, so the text is dark-on-linen, not
 * text-on-photograph, and needs no scrim.
 *
 * Below `lg` there is no room for that overlap, so the photograph becomes a
 * full-bleed band under the copy instead.
 *
 * The photograph carries `priority` and a scale-only settle, so it paints on
 * the first frame (`hero.tsx` explains why opacity is never animated).
 */
export function AboutHero() {
  const { hero } = ABOUT_PAGE;

  return (
    <section
      aria-labelledby="about-title"
      className="bg-background relative isolate overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 -z-10 hidden w-[58%] lg:block"
      >
        <MediaFrame
          image={{ ...ABOUT_IMAGES.hero, alt: "" }}
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

      <Container width="wide" className="pt-10 pb-14 lg:pt-14 lg:pb-24">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "About" }]}
        />

        <div className="max-w-xl pt-14 lg:pt-24 lg:pb-10">
          <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-current" />
            {hero.eyebrow}
          </p>

          <h1
            id="about-title"
            className="text-display-2xl text-heading mt-6 font-normal"
          >
            <Emphasis
              text={hero.title}
              phrase={hero.titleEmphasis}
              className="text-primary"
            />
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
            <TextLink href={`#${ABOUT_SECTIONS.approach}`}>
              How we practise
            </TextLink>
          </div>
        </div>
      </Container>

      {/* The same photograph, full-bleed, where the split has no room. */}
      <MediaFrame
        image={ABOUT_IMAGES.hero}
        aspect="landscape"
        radius="none"
        sizes="100vw"
        className="lg:hidden"
      />
    </section>
  );
}
