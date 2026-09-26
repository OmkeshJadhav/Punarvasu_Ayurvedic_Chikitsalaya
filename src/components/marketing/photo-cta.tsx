import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Button } from "@/components/ui/button";
import type { ImageAsset } from "@/config/images";
import { PRIMARY_CTA } from "@/config/navigation";

/**
 * A compact photographic closing band: the copy on the left, a still life
 * visible on the right. The home and services pages close on it.
 *
 * ## Why not `FinalCtaSection`
 *
 * The shared closing band centres its copy over a full-bleed scrim and takes
 * the section rhythm's full padding - right for a single line of invitation,
 * too tall and too uniform for a panoramic photograph whose subject sits at
 * one end. This band is left-aligned and deliberately short: its own padding,
 * an `h2`-sized heading, and nothing below the actions but an optional row.
 *
 * ## Legibility
 *
 * Only the side the copy occupies is darkened, and it is darkened with the
 * brand green rather than the warm `--scrim`: over green foliage or water a
 * brown wash reads as mud. The strength is what carries the guarantee.
 * Composited over a pure-white image - the worst case - 75% `--brand-surface`
 * gives #56685f, on which white type measures 6.0:1, above AA's 4.5:1.
 *
 * Below `lg` the copy spans the band, so the whole photograph takes a flat
 * 75% wash. From `lg` the wash runs left to right and holds at least 75% up
 * to 60% of the band's width; the copy column (`max-w-lg` inside the wide
 * container) ends before that point at every width from 1024px up.
 *
 * The photograph is decorative (`alt=""` in its registry entry).
 *
 * A server component.
 */
export interface PhotoCtaProps {
  readonly titleId: string;
  readonly image: ImageAsset;
  readonly eyebrow?: string;
  readonly title: string;
  /** A phrase inside `title` to set in italic. See `Emphasis`. */
  readonly titleEmphasis?: string;
  readonly description: string;
  readonly primaryLabel?: string;
  /** A quieter action beside the primary one, drawn for a dark band. */
  readonly secondaryAction?: ReactNode;
  /** An optional row under a hairline, beneath the actions. */
  readonly footer?: ReactNode;
}

export function PhotoCta({
  titleId,
  image,
  eyebrow,
  title,
  titleEmphasis,
  description,
  primaryLabel = PRIMARY_CTA.label,
  secondaryAction,
  footer,
}: PhotoCtaProps) {
  return (
    <section
      aria-labelledby={titleId}
      // See `[data-surface="inverted"]` in `globals.css`.
      data-surface="inverted"
      className="bg-brand-surface text-brand-surface-foreground relative isolate overflow-hidden"
    >
      <MediaFrame
        image={image}
        aspect="fill"
        radius="none"
        sizes="100vw"
        className="-z-10"
      />
      <div
        aria-hidden="true"
        className="bg-brand-surface/75 lg:from-brand-surface/90 lg:via-brand-surface/75 absolute inset-0 -z-10 lg:bg-transparent lg:bg-linear-to-r lg:via-60% lg:to-transparent"
      />

      <Container width="wide" className="py-12 lg:py-14">
        <div className="max-w-lg">
          {eyebrow ? (
            <p className="text-caption mb-4 inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {eyebrow}
            </p>
          ) : null}

          <h2
            id={titleId}
            className="text-h2 text-brand-surface-foreground font-normal"
          >
            <Emphasis text={title} phrase={titleEmphasis} />
          </h2>

          <p className="text-body-lg mt-4">{description}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="inverse" className="group">
              <Link href={PRIMARY_CTA.href}>
                {primaryLabel}
                <ArrowRight
                  aria-hidden="true"
                  className="ease-natural transition-transform duration-(--duration-normal) group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            {secondaryAction}
          </div>

          {footer ? (
            <div className="border-brand-surface-foreground/25 mt-7 border-t pt-5">
              {footer}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
