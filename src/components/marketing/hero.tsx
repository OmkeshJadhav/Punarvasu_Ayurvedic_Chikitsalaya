import Link from "next/link";
import { ArrowRight, Flower2, Leaf, Sprout } from "lucide-react";

import { Container } from "@/components/layout/container";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TextLink } from "@/components/marketing/text-link";
import { Button } from "@/components/ui/button";
import { CLINIC_CONTACT, CLINIC_IDENTITY } from "@/config/clinic";
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
 * one priority image.
 *
 * ## Composition
 *
 * An editorial split: the words on linen at the left, the photograph in an
 * arched frame at the right. It replaced a full-bleed photograph with the copy
 * laid over it, which needed a 55% scrim to stay legible and turned a warm
 * image into a brown one - the headline ended up sitting on a patient's face.
 * Here the photograph is shown at full colour and nothing covers it.
 *
 * The arch is the clinic's architecture rather than a UI shape: the doorways
 * and temple niches the brand's imagery keeps returning to. A hairline arch
 * offset behind it and a single drawn sprig are the only decoration, both in
 * token colours at low contrast.
 *
 * ## Hierarchy
 *
 * One filled button. "Book a Consultation" is the reason the site exists, so
 * it is the only solid shape in the band; "Explore our approach" is a text
 * link. Two equal buttons ask a visitor to choose between them.
 *
 * ## Performance
 *
 * The photograph carries `priority` - the one image on the page that does.
 * Its settle-in is a scale transform only, never opacity, so it paints on the
 * first frame and the animation cannot delay LCP. `motion-safe` removes it for
 * anyone who asked for less movement.
 *
 * ## Headings
 *
 * This section owns the page's single `<h1>`.
 */
export function Hero() {
  const [firstLine, secondLine] = HERO_CONTENT.headline;

  return (
    <section
      aria-labelledby="hero-title"
      className="bg-background relative isolate overflow-hidden"
    >
      <Container
        width="wide"
        className="grid items-center gap-14 pt-12 pb-16 sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pt-20 lg:pb-24"
      >
        <div className="lg:col-span-7">
          <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-current" />
            {HERO_CONTENT.eyebrow}
            {CLINIC_CONTACT.address ? (
              <> · {CLINIC_CONTACT.address.locality}</>
            ) : null}
          </p>

          <h1
            id="hero-title"
            className="text-display-2xl text-heading mt-6 font-normal"
          >
            {firstLine}
            <br />
            <Emphasis
              text={secondLine}
              phrase={HERO_CONTENT.headlineEmphasis}
              className="text-primary"
            />
          </h1>

          <p className="text-body-lg text-prose mt-7 max-w-136">
            {HERO_CONTENT.description}
          </p>

          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
            <Button asChild size="lg" className="group w-full sm:w-auto">
              <Link href={PRIMARY_CTA.href}>
                {HERO_CONTENT.primaryAction.label}
                <ArrowRight
                  aria-hidden="true"
                  className="ease-natural transition-transform duration-(--duration-normal) group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            <TextLink href={homeSectionHref(HOME_SECTIONS.approach)}>
              {HERO_CONTENT.secondaryAction.label}
            </TextLink>
          </div>

          <TrustPoints />
        </div>

        <HeroPortrait />
      </Container>
    </section>
  );
}

/**
 * The arched photograph and its caption.
 *
 * Decorative layers are absolutely positioned *outside* the frame's overflow
 * clip, so the offset arch and the sprig can break its edge. `MediaFrame`
 * supplies the image, the fixed crop and the placeholder surface; the arch is
 * a wrapper's `rounded-t-full`, which keeps `MediaFrame`'s own radius options
 * unchanged for every other caller.
 */
function HeroPortrait() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:col-span-5 lg:mr-0 lg:max-w-120">
      {/* The offset hairline arch. */}
      <div
        aria-hidden="true"
        className="border-gold/35 absolute inset-0 translate-x-4 -translate-y-4 rounded-t-full border sm:translate-x-6 sm:-translate-y-6"
      />

      <BotanicalMotif className="text-gold/45 absolute -bottom-6 -left-10 hidden h-72 w-28 -rotate-12 sm:block lg:-left-16" />

      <div className="relative aspect-4/5 overflow-hidden rounded-t-full shadow-lg">
        <MediaFrame
          image={HOME_IMAGES.hero}
          aspect="fill"
          radius="none"
          priority
          sizes="(min-width: 1280px) 30rem, (min-width: 1024px) 40vw, 28rem"
          imageClassName="motion-safe:animate-settle"
        />
      </div>

      <figure className="border-border bg-card/95 absolute -bottom-8 left-4 max-w-68 rounded-lg border p-5 shadow-md backdrop-blur-sm sm:-right-4 sm:left-auto lg:-right-8 lg:bottom-12">
        <figcaption className="text-caption text-eyebrow font-sans font-medium tracking-[0.18em] uppercase">
          {HERO_CONTENT.nameNote.label}
          <span lang="sa" className="ml-2 font-serif text-sm tracking-normal">
            {CLINIC_IDENTITY.devanagariName}
          </span>
        </figcaption>
        <p className="text-body text-heading mt-2 font-serif italic">
          {HERO_CONTENT.nameNote.text}
        </p>
      </figure>
    </div>
  );
}

/**
 * Trust indicators.
 *
 * Three qualitative statements, directly under the actions. Deliberately not
 * a statistics bar: no patient count, rating or success figure has been
 * verified, and a fabricated one on a healthcare site is the worst thing this
 * page could contain (`docs/implementation-plan/phase_03.md` sections 13-14).
 *
 * The icons are botanical and decorative - the bold line beside each already
 * says what it is - so they are hidden from assistive technology. They are
 * matched by position because the three statements are a fixed set, and a
 * missing one falls back to the leaf rather than to nothing.
 */
const TRUST_ICONS = [Sprout, Leaf, Flower2] as const;

function TrustPoints() {
  return (
    <ul className="border-border mt-14 grid gap-6 border-t pt-8 sm:grid-cols-3 sm:gap-5">
      {TRUST_POINTS.map((point, index) => {
        const Icon = TRUST_ICONS[index] ?? Leaf;
        return (
          <li key={point.title} className="flex items-start gap-3 sm:flex-col">
            <span
              aria-hidden="true"
              className="border-gold/30 bg-gold-surface text-gold flex size-10 shrink-0 items-center justify-center rounded-full border"
            >
              <Icon className="size-4.5" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-label text-heading font-semibold">
                {point.title}
              </span>
              <span className="text-body-sm text-muted-foreground">
                {point.description}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
