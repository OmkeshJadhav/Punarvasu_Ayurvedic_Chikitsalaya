import Link from "next/link";

import { MediaFrame } from "@/components/marketing/media-frame";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { CLINIC_IDENTITY } from "@/config/clinic";
import { HOME_IMAGES } from "@/config/images";
import {
  HERO_CONTENT,
  HOME_SECTIONS,
  TRUST_POINTS,
} from "@/config/marketing-content";
import { homeSectionHref, PRIMARY_CTA } from "@/config/navigation";

/**
 * The hero.
 *
 * A server component, and the only section that matters within the first
 * second, so it is built to be fast rather than clever: no client JavaScript,
 * no scroll effects, one priority image.
 *
 * ## Composition
 *
 * A full-bleed photograph with the copy laid over it, rather than a
 * text-column-beside-an-image split. The split reads as a template: two equal
 * halves, a stock photo in a rounded box, and a headline that has to compete
 * with it for attention. Giving the photograph the whole band and putting the
 * words on top of it is what makes the page open like a clinic's front door
 * instead of a product landing page, and it is the treatment the brand
 * reference uses throughout.
 *
 * The copy sits at the *bottom* of the band on every screen. That keeps the
 * headline, the sentence under it and both actions together as one block
 * whatever the viewport height, and it leaves the top of the photograph - the
 * part with the subject in it - uncovered.
 *
 * ## Legibility
 *
 * White text on a photograph is only safe if the photograph is dark, and this
 * one can be replaced at any time. `MediaFrame`'s `strong` scrim is the
 * contract: its opacity is verified in `lib/design/contrast.test.ts` against a
 * pure-white image, so the worst photograph anyone could swap in still carries
 * this copy at AA. Nothing here relies on the current file being dark.
 *
 * ## Performance
 *
 * The photograph is the LCP element, so it carries `priority` - the one image
 * on the page that does. It is full-bleed at every breakpoint, hence
 * `sizes="100vw"`.
 *
 * ## Motion
 *
 * There is none here beyond the design system's own hover and focus
 * transitions. A hero that animates in delays the LCP paint and the first
 * thing a new visitor sees should not be a page assembling itself
 * (`docs/DESIGN_SYSTEM.md` section 41).
 *
 * ## Headings
 *
 * This section owns the page's single `<h1>`.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-background">
      {/* `isolate` keeps the scrim's stacking context inside the band, so the
          sticky header still paints above it. */}
      <div className="relative isolate overflow-hidden">
        <MediaFrame
          image={HOME_IMAGES.hero}
          aspect="fill"
          radius="none"
          scrim="soft"
          priority
          sizes="100vw"
        />

        <Container
          width="wide"
          // See `[data-surface="inverted"]` in `globals.css`: the focus ring is
          // the primary green and would vanish against the photograph.
          data-surface="inverted"
          className="hero-band relative flex flex-col justify-end pt-20 pb-12 sm:pb-14 lg:pt-28 lg:pb-20"
        >
          <p className="text-caption text-brand-surface-accent font-sans font-medium tracking-[0.18em] uppercase">
            {HERO_CONTENT.eyebrow}
            <span className="ml-2 font-serif text-base tracking-normal normal-case">
              {CLINIC_IDENTITY.devanagariName}
            </span>
          </p>

          <h1
            id="hero-title"
            className="text-display-xl text-scrim-foreground mt-4 font-normal"
          >
            {HERO_CONTENT.headline[0]}
            <br />
            {HERO_CONTENT.headline[1]}
          </h1>

          <p className="text-body-lg text-scrim-foreground measure mt-5">
            {HERO_CONTENT.description}
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button asChild size="lg" block className="sm:w-auto">
              <Link href={PRIMARY_CTA.href}>
                {HERO_CONTENT.primaryAction.label}
              </Link>
            </Button>
            {/*
              `outline` would draw a dim border against an unknown photograph.
              `secondary` is the sand chip - an opaque surface with its own
              verified foreground, so the second action stays readable over any
              image the clinic swaps in.
            */}
            <Button
              asChild
              size="lg"
              variant="secondary"
              block
              className="sm:w-auto"
            >
              <Link href={homeSectionHref(HOME_SECTIONS.approach)}>
                {HERO_CONTENT.secondaryAction.label}
              </Link>
            </Button>
          </div>
        </Container>
      </div>

      <TrustStrip />
    </section>
  );
}

/**
 * Trust indicators.
 *
 * Three qualitative statements, sitting on the seam between the hero and the
 * page proper. Deliberately not a statistics bar: no patient count, rating or
 * success figure has been verified, and a fabricated one on a healthcare site
 * is the worst thing this page could contain
 * (`docs/implementation-plan/phase_03.md` sections 13-14).
 *
 * Rendered as a `<ul>` so it is a list to a screen reader too, and each item
 * leads with a bold line - these are labels, not sections, so they stay out of
 * the document outline. The rules between them replace the card borders that
 * would otherwise turn three sentences into three boxes.
 */
function TrustStrip() {
  return (
    <div className="border-border bg-background border-b">
      <Container width="wide">
        <ul className="grid gap-x-10 gap-y-6 py-8 sm:grid-cols-3 md:py-10">
          {TRUST_POINTS.map((point) => (
            <li
              key={point.title}
              className="border-border flex flex-col gap-1.5 sm:border-l sm:pl-6 sm:first:border-l-0 sm:first:pl-0"
            >
              <span className="text-label text-eyebrow font-semibold">
                {point.title}
              </span>
              <span className="text-body-sm text-prose">
                {point.description}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
