import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Button } from "@/components/ui/button";
import type { ImageAsset } from "@/config/images";
import { FINAL_CTA_CONTENT } from "@/config/marketing-content";
import { PRIMARY_CTA } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * The closing call to action.
 *
 * Calm rather than insistent: an invitation, one primary button, and no
 * countdown, scarcity line or competing action of equal weight. A visitor who
 * has read this far needs permission to begin, not pressure
 * (`docs/implementation-plan/phase_03.md` section 30).
 *
 * ## Tones
 *
 * `light` is the sand band every inner page closes on. It is set apart from
 * the deep green footer beneath it by contrast.
 *
 * `brand` is the home page's: the deep green band, a pair of faint drawn
 * sprigs, and a linen button (`variant="inverse"`) because a green fill
 * vanishes on green. It flows into the footer as one closing block, the way a
 * printed brochure ends on its back cover. It is opt-in rather than the
 * default because the inner pages pass `outline` buttons as their secondary
 * action, which are drawn for a light surface.
 *
 * The heading is an `<h2>`, keeping the outline flat beneath a page's single
 * `<h1>`.
 *
 * ## Props
 *
 * The copy defaults to the home page's, and every public page that ends in an
 * invitation passes its own.
 */
export interface FinalCtaSectionProps {
  readonly title?: string;
  /** A phrase inside `title` to set in italic. See `Emphasis`. */
  readonly titleEmphasis?: string;
  readonly description?: string;
  readonly primaryLabel?: string;
  /** A quieter alternative beside the primary action. */
  readonly secondaryAction?: ReactNode;
  /** Distinct per page only when two of these could ever share a document. */
  readonly titleId?: string;
  readonly tone?: "light" | "brand";
  /**
   * A photograph behind a `brand` band - the About page's cinematic close.
   * It sits under `MediaFrame`'s `strong` scrim, whose opacity is verified
   * against a pure-white image, so the white copy clears AA over any file.
   */
  readonly image?: ImageAsset;
}

export function FinalCtaSection({
  title = FINAL_CTA_CONTENT.title,
  titleEmphasis,
  description = FINAL_CTA_CONTENT.description,
  primaryLabel = FINAL_CTA_CONTENT.primaryAction.label,
  secondaryAction,
  titleId = "final-cta-title",
  tone = "light",
  image,
}: FinalCtaSectionProps) {
  const brand = tone === "brand";
  const photographic = brand && image !== undefined;

  return (
    <Section
      aria-labelledby={titleId}
      // See `[data-surface="inverted"]` in `globals.css`.
      data-surface={brand ? "inverted" : undefined}
      className={cn(
        "relative isolate overflow-hidden",
        brand
          ? "bg-brand-surface text-brand-surface-foreground"
          : "bg-secondary border-border border-t",
      )}
    >
      {photographic ? (
        <MediaFrame
          image={image}
          aspect="fill"
          radius="none"
          scrim="strong"
          className="-z-10"
          sizes="100vw"
        />
      ) : brand ? (
        <>
          <BotanicalMotif className="text-brand-surface-border/60 pointer-events-none absolute top-8 -left-4 -z-10 hidden h-96 w-36 -rotate-12 md:block" />
          <BotanicalMotif className="text-brand-surface-border/60 pointer-events-none absolute -right-4 -bottom-16 -z-10 hidden h-96 w-36 scale-x-[-1] rotate-12 md:block" />
        </>
      ) : null}

      <Container
        width="prose"
        className={cn("text-center", photographic && "py-10 lg:py-16")}
      >
        {brand ? (
          <BotanicalMotif
            variant="ornament"
            className="text-brand-surface-accent mx-auto mb-6"
          />
        ) : null}

        <h2
          id={titleId}
          className={cn(
            "font-normal",
            brand
              ? "text-display text-brand-surface-foreground"
              : "text-h2 text-heading",
          )}
        >
          <Emphasis
            text={title}
            phrase={titleEmphasis}
            className={brand ? "text-brand-surface-accent" : "text-primary"}
          />
        </h2>

        {/* The `prose` container already caps the measure at 720px, so this
            needs no width of its own. */}
        <p
          className={cn(
            "text-body-lg mt-5",
            // Over a photograph only white is verified against the scrim's
            // worst case; the muted green-white is verified on flat green.
            photographic
              ? "text-scrim-foreground"
              : brand
                ? "text-brand-surface-muted"
                : "text-prose",
          )}
        >
          {description}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            variant={brand ? "inverse" : "primary"}
            className="group"
          >
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
      </Container>
    </Section>
  );
}
