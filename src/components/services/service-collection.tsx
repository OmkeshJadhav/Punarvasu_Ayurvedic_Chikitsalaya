import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { ContentReviewNotice } from "@/components/marketing/content-review-notice";
import { MediaFrame } from "@/components/marketing/media-frame";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { PRIMARY_CTA, treatmentPath } from "@/config/navigation";
import type { TreatmentGroup } from "@/features/services/catalogue";
import { SERVICES_PAGE, SERVICES_SECTIONS } from "@/features/services/content";
import type { Treatment, TreatmentCategory } from "@/features/services/types";
import { cn } from "@/lib/utils/cn";

/**
 * Every service, as one editorial collection.
 *
 * ## Why one grid with labels rather than grouped sections
 *
 * Seven entries fit on one screen of tiles. Three headed sub-sections turned a
 * short list into a long page with three small grids, one of them holding a
 * single tile. A small category label on each tile keeps the grouping visible
 * without the scaffolding, and the tiles still arrive in catalogue order, so
 * consultation leads and ongoing support closes.
 *
 * ## The tiles
 *
 * Photograph, label, name, one line, arrow - no box. The only interaction is
 * the one a visitor needs: the whole tile is a single link (a stretched
 * pseudo-element on the name), the photograph settles closer on hover and the
 * arrow fills. A treatment with no honest photograph gets a drawn tile at the
 * same aspect (`config/images.ts`).
 *
 * The review notice sits under the grid as a footnote: it has to be read, but
 * it should not be the loudest object on the page.
 *
 * A server component.
 */
export interface ServiceCollectionProps {
  readonly groups: readonly TreatmentGroup[];
  readonly showReviewNotice: boolean;
}

export function ServiceCollection({
  groups,
  showReviewNotice,
}: ServiceCollectionProps) {
  const { catalogue } = SERVICES_PAGE;
  const entries = groups.flatMap((group) =>
    group.treatments.map((treatment) => ({
      treatment,
      category: group.category,
    })),
  );

  return (
    <Section
      id={SERVICES_SECTIONS.catalogue}
      aria-labelledby="catalogue-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-2xl">
            <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {catalogue.eyebrow}
            </p>
            <h2
              id="catalogue-title"
              className="text-display text-heading mt-5 font-normal"
            >
              {catalogue.title}
            </h2>
          </div>
          <p className="text-body-lg text-prose max-w-md">
            {catalogue.description}
          </p>
        </Reveal>

        {entries.length === 0 ? (
          /*
           * The catalogue is static configuration today, so this cannot
           * happen at runtime - but it becomes a real state the moment the
           * data moves to a database (`phase_04.md` section 39).
           */
          <EmptyState
            className="mt-12"
            title="Our services are being prepared"
            description="The treatment pages are not published yet. You can still request a consultation and tell us what brought you here."
            action={
              <Button asChild>
                <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 xl:grid-cols-4">
            {entries.map(({ treatment, category }, index) => (
              <Reveal key={treatment.slug} asChild delay={(index % 4) * 70}>
                <li className="flex">
                  <ServiceTile treatment={treatment} category={category} />
                </li>
              </Reveal>
            ))}
          </ul>
        )}

        {showReviewNotice ? (
          <ContentReviewNotice
            context="listing"
            appearance="quiet"
            className="mt-16"
          />
        ) : null}
      </Container>
    </Section>
  );
}

function ServiceTile({
  treatment,
  category,
}: {
  readonly treatment: Treatment;
  readonly category: TreatmentCategory;
}) {
  return (
    <article
      className={cn(
        "group relative flex w-full flex-col rounded-lg",
        "has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-4",
      )}
    >
      <div className="relative overflow-hidden rounded-lg">
        {treatment.image ? (
          <MediaFrame
            image={treatment.image}
            // Landscape, not portrait: two source files have a caption burned
            // into their top quarter, and only a landscape crop anchored to
            // the bottom keeps it out of frame (`config/images.ts`).
            aspect="landscape"
            radius="none"
            // Four across the capped 1280px container from `xl`, three from
            // `lg`, two from `sm`. Slightly overstated so a 2x screen never
            // upscales.
            sizes="(min-width: 1280px) 19rem, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            imageClassName="motion-safe:ease-natural motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className="bg-sage flex aspect-3/2 items-center justify-center overflow-hidden"
          >
            <BotanicalMotif className="text-primary/35 h-[140%] w-auto rotate-12" />
          </div>
        )}
      </div>

      <div className="flex flex-1 items-start justify-between gap-4 pt-5">
        <div className="flex flex-col gap-1.5">
          <p className="text-caption text-eyebrow font-sans font-medium tracking-[0.18em] uppercase">
            {category.name}
          </p>
          <h3 className="text-h5 text-heading font-serif font-normal">
            <Link
              href={treatmentPath(treatment.slug)}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {treatment.name}
            </Link>
          </h3>
          <p className="text-body-sm text-prose">{treatment.teaser}</p>
        </div>

        <span
          aria-hidden="true"
          className={cn(
            "border-border-strong text-primary mt-6 flex size-10 shrink-0 items-center justify-center rounded-full border",
            "ease-natural transition-colors duration-(--duration-normal)",
            "group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary",
          )}
        >
          <ArrowRight className="ease-natural size-4 transition-transform duration-(--duration-normal) group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
