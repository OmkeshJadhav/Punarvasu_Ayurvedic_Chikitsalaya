import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Reveal } from "@/components/shared/reveal";
import { treatmentPath } from "@/config/navigation";
import { SERVICES_PAGE } from "@/features/services/content";
import type { Treatment } from "@/features/services/types";
import { cn } from "@/lib/utils/cn";

/**
 * The three starting points, on the page's one deep-green band.
 *
 * ## The organic edge
 *
 * The band's top and bottom are drawn curves rather than straight rules: it
 * is the moment the page changes key, and a soft edge makes that read as a
 * landscape rather than as a coloured stripe. The curves are decorative SVG
 * in `currentColor`, so they are exactly `--brand-surface` and need no colour
 * of their own.
 *
 * ## Why "most asked about" and not "most recommended"
 *
 * A featured row on a healthcare site is one step away from reading as
 * clinical advice, so the standfirst says plainly that these are the most
 * asked about and that Punarvasu recommends nothing before meeting someone
 * (`docs/implementation-plan/phase_04.md` sections 16-17). Which treatments
 * appear is the editorial `featured` flag, not a ranking.
 *
 * ## Panels
 *
 * Each is a single link (a stretched pseudo-element on the title), so there is
 * one tab stop and one accessible name per panel. A treatment with no honest
 * photograph gets a drawn composition instead of a borrowed image
 * (`config/images.ts`).
 *
 * Renders nothing when nothing is featured. A server component.
 */
export interface StartingPointsProps {
  readonly treatments: readonly Treatment[];
}

export function StartingPoints({ treatments }: StartingPointsProps) {
  if (treatments.length === 0) {
    return null;
  }

  const { featured } = SERVICES_PAGE;

  return (
    <section
      aria-labelledby="featured-title"
      className="bg-background text-brand-surface relative isolate"
    >
      <WaveEdge position="top" />

      <div
        data-surface="inverted"
        className="bg-brand-surface text-brand-surface-foreground relative isolate overflow-hidden"
      >
        <BotanicalMotif className="text-brand-surface-border/50 pointer-events-none absolute top-0 -left-6 -z-10 hidden h-96 w-36 -rotate-12 md:block" />
        <BotanicalMotif className="text-brand-surface-border/50 pointer-events-none absolute -right-4 bottom-0 -z-10 hidden h-96 w-36 scale-x-[-1] rotate-12 md:block" />

        <Container width="wide" className="py-10 lg:py-14">
          <Reveal className="max-w-2xl">
            <p className="text-caption text-brand-surface-accent inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {featured.eyebrow}
            </p>
            <h2
              id="featured-title"
              className="text-display text-brand-surface-foreground mt-5 font-normal"
            >
              {featured.title}
            </h2>
            <p className="text-body-lg text-brand-surface-muted mt-5">
              {featured.description}
            </p>
          </Reveal>

          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-8">
            {treatments.map((treatment, index) => (
              <Reveal key={treatment.slug} asChild delay={index * 90}>
                <li className="flex">
                  <StartingPointPanel treatment={treatment} />
                </li>
              </Reveal>
            ))}
          </ul>
        </Container>
      </div>

      <WaveEdge position="bottom" />
    </section>
  );
}

function StartingPointPanel({ treatment }: { readonly treatment: Treatment }) {
  return (
    <article
      className={cn(
        "group bg-background text-foreground relative flex w-full flex-col overflow-hidden rounded-lg shadow-lg",
        // The focus ring for the stretched link, drawn around the whole panel.
        // An outline, because the panel clips its own overflow and a ring
        // drawn by a child would be cut off at the rounded corners.
        "has-focus-visible:outline-brand-surface-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-4",
      )}
    >
      {treatment.image ? (
        <MediaFrame
          image={treatment.image}
          aspect="landscape"
          radius="none"
          sizes="(min-width: 1280px) 25rem, (min-width: 640px) 45vw, 100vw"
          imageClassName="motion-safe:ease-natural motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:group-hover:scale-105"
        />
      ) : (
        // No photograph honestly depicts a consultation here, so the frame
        // holds the drawn sprig instead, at the same aspect as its siblings.
        <div
          aria-hidden="true"
          className="bg-sage relative flex aspect-3/2 items-center justify-center overflow-hidden"
        >
          <BotanicalMotif className="text-primary/35 h-[140%] w-auto rotate-12" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <h3 className="text-h4 text-heading font-serif font-normal">
          <Link
            href={treatmentPath(treatment.slug)}
            className={cn(
              "rounded-sm focus-visible:outline-none",
              // One link per panel: the pseudo-element stretches it across the
              // whole card, and the ring is drawn on the card via
              // `has-focus-visible` instead of around the title.
              "after:absolute after:inset-0 after:content-['']",
            )}
          >
            {treatment.name}
          </Link>
        </h3>
        <p className="text-body-sm text-prose mt-3 flex-1">
          {treatment.summary}
        </p>
        <span
          aria-hidden="true"
          className="text-label text-primary mt-6 inline-flex items-center gap-2 font-medium"
        >
          Explore {treatment.name}
          <ArrowRight className="ease-natural size-4 transition-transform duration-(--duration-normal) group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}

/**
 * A soft curve where the ivory page meets the green band. Decorative.
 *
 * `preserveAspectRatio="none"` lets the curve stretch to any width without
 * distorting its height, which is set in CSS per breakpoint.
 */
function WaveEdge({ position }: { readonly position: "top" | "bottom" }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      fill="currentColor"
      className={cn(
        "block h-10 w-full sm:h-16 lg:h-24",
        // Overlap by a pixel so no hairline of the page shows through at
        // fractional zoom levels.
        position === "top" ? "-mb-px" : "-mt-px",
      )}
    >
      {position === "top" ? (
        <path d="M0 120V78C180 40 360 22 600 34s460 58 660 40c80-7 140-22 180-40v86Z" />
      ) : (
        <path d="M0 0h1440v52c-200 52-420 70-640 48S380 44 180 62C110 68 50 78 0 90Z" />
      )}
    </svg>
  );
}
