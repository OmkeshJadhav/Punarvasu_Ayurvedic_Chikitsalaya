import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MediaFrame } from "@/components/marketing/media-frame";
import {
  Card,
  CardDescription,
  CardLink,
  CardTitle,
} from "@/components/ui/card";
import { treatmentPath } from "@/config/navigation";
import type { Treatment } from "@/features/services/types";
import { cn } from "@/lib/utils/cn";

/**
 * A treatment in a grid.
 *
 * ## Interaction
 *
 * The whole card is one link, via `CardLink`'s stretched pseudo-element: a
 * single focusable element with a real accessible name, working middle-click,
 * and a focus ring around the card. There is no `onClick` on a `<div>`
 * anywhere (`docs/implementation-plan/phase_04.md` sections 47-48).
 *
 * The action reads "Explore treatment", not "Book now". A visitor who has not
 * read the page yet is not ready to book it, and a booking CTA on a therapy
 * they have not had assessed is exactly the pressure this site avoids
 * (`phase_04.md` sections 15 and 53).
 *
 * ## Cards without a photograph
 *
 * Not every treatment has a photograph that honestly depicts it, and none is
 * borrowed to fill a frame. A treatment with no image renders as a
 * typographic tile on the sand surface instead: same height in the grid, same
 * information, deliberately different texture. That reads as an editorial
 * choice rather than a missing asset, and it keeps the catalogue honest about
 * what the clinic has actually photographed (`config/images.ts`).
 *
 * `featured` gives the card a taller frame and the summary at body size, for
 * the three-card row at the top of the services page.
 */
export interface TreatmentCardProps {
  readonly treatment: Treatment;
  /** Matches the rendered card width at each breakpoint. See `MediaFrame`. */
  readonly imageSizes: string;
  readonly featured?: boolean;
  /** The outline level this card's title occupies. */
  readonly headingLevel?: "h3" | "h4";
  readonly className?: string;
}

export function TreatmentCard({
  treatment,
  imageSizes,
  featured = false,
  headingLevel = "h3",
  className,
}: TreatmentCardProps) {
  const hasImage = treatment.image !== undefined;

  return (
    <Card
      variant="interactive"
      padding="none"
      className={cn(
        "group w-full overflow-hidden",
        // Without a photograph the card needs its own presence, so it takes
        // the sand surface rather than sitting as white space in the row.
        !hasImage && "bg-muted",
        className,
      )}
    >
      {treatment.image ? (
        <MediaFrame
          image={treatment.image}
          aspect={featured ? "wide" : "landscape"}
          radius="none"
          sizes={imageSizes}
          // A restrained hover: the photograph settles fractionally closer.
          // `motion-safe` keeps it off entirely for anyone who asked for less.
          imageClassName="motion-safe:ease-natural motion-safe:transition-transform motion-safe:duration-(--duration-normal) motion-safe:group-hover:scale-105"
        />
      ) : null}

      <div
        className={cn(
          "flex flex-1 flex-col gap-3 p-5 sm:p-6",
          // The type-only card centres its block vertically so it reads as a
          // composed tile rather than as content that lost its image.
          !hasImage && "justify-center gap-4 py-8 sm:py-10",
        )}
      >
        <TreatmentCardEyebrow treatment={treatment} />

        <CardTitle
          as={headingLevel}
          className={cn(
            "font-serif",
            featured || !hasImage ? "text-h4" : "text-h5",
          )}
        >
          <CardLink asChild>
            <Link href={treatmentPath(treatment.slug)}>{treatment.name}</Link>
          </CardLink>
        </CardTitle>

        <CardDescription
          className={cn(
            "text-prose flex-1",
            featured || !hasImage ? "text-body" : "text-body-sm",
          )}
        >
          {treatment.summary}
        </CardDescription>

        {/*
          Decorative: the card's accessible name already comes from the title
          link, and announcing "Explore treatment" a second time would make
          every card read twice.
        */}
        <span
          aria-hidden="true"
          className="text-label text-primary ease-natural mt-1 inline-flex items-center gap-2 font-medium transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
        >
          Explore treatment
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Card>
  );
}

/**
 * The line above the title: the Sanskrit term where the treatment has one and
 * it differs from the displayed name, otherwise nothing.
 *
 * The category is deliberately not repeated here — cards are shown beneath
 * their category heading, and repeating it on every card is the kind of
 * label noise that turns a catalogue into a form.
 */
function TreatmentCardEyebrow({
  treatment,
}: {
  readonly treatment: Treatment;
}) {
  if (!treatment.sanskritName || treatment.sanskritName === treatment.name) {
    return null;
  }

  return (
    <p
      // `lang` so a screen reader does not read transliterated Sanskrit with
      // English pronunciation rules.
      lang="sa-Latn"
      // The serif, not the sans — corrected in Phase 20 for two reasons that
      // point the same way.
      //
      // Consistency: `marketing/treatment-hero.tsx` already sets this exact
      // datum in the serif. The same Sanskrit name was rendering in two
      // different families depending on which surface you met it on, and
      // `docs/DESIGN_SYSTEM.md` section 8 assigns brand and editorial content
      // to the serif and reserves the sans for functional UI - navigation,
      // forms, labels, tables. A treatment's Sanskrit name is the former.
      //
      // Cost: it was also the single most expensive character set on the
      // public site. `Abhyaṅga`, `Śirodhārā`, `Auṣadha` and `Dinacaryā` are
      // the only strings in the product that reach outside Basic Latin, and
      // the four characters they need - ā, Ś, ṅ, ṣ - sit in the `latin-ext`
      // unicode-range. Rendering them in the sans obliged the browser to
      // download **Inter's latin-ext face, 83.3 KB**, on `/services` and on
      // every treatment page. Rendering them in the serif needs Playfair's
      // latin-ext, which the treatment hero already loads and which is 20.5 KB.
      //
      // `subsets` in the root layout cannot fix this: it governs which faces
      // are *preloaded*, not which are emitted, and the browser decides what
      // to download from `unicode-range` and the text it actually meets.
      className="text-caption text-eyebrow font-serif font-medium tracking-[0.14em] uppercase"
    >
      {treatment.sanskritName}
    </p>
  );
}
