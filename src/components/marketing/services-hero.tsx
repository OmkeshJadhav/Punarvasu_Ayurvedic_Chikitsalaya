import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { SERVICES_PAGE } from "@/features/services/content";
import {
  categoryAnchorId,
  type TreatmentGroup,
} from "@/features/services/catalogue";
import { PRIMARY_CTA } from "@/config/navigation";

/**
 * The services page hero.
 *
 * ## Why this one is typographic, not photographic
 *
 * The home page opens on a full-bleed photograph, and repeating that
 * treatment here would make the two pages read as the same page twice. More
 * practically: no photograph in this repository depicts "the range of care a
 * clinic offers", and stretching an unrelated therapy image across the top
 * of the catalogue would imply that therapy is the page's subject.
 *
 * So the band is the deep-green brand surface with the words on it. It is
 * this page's single inversion — the design system allows one per page, and
 * spending it here means the sections below stay on the warm surfaces where
 * the photographs live (`docs/DESIGN_SYSTEM.md` section 64).
 *
 * Colours come from the `--brand-surface` family, every pair of which is
 * asserted against WCAG AA in `src/lib/design/contrast.test.ts`. Nothing is
 * hardcoded, and `data-surface="inverted"` re-points the focus ring so a
 * keyboard user does not lose their place on the dark band.
 *
 * ## The category rail
 *
 * The bottom of the band lists the catalogue's groups as in-page anchors.
 * With seven treatments in three groups there is nothing to filter — every
 * entry is on the page — but there is something to skip to, and a jump link
 * does that with no client JavaScript and no hidden state
 * (`docs/implementation-plan/phase_04.md` sections 13 and 37).
 *
 * A server component. The page's single `<h1>` lives here.
 */
export interface ServicesHeroProps {
  /** Groups to list in the jump rail, in catalogue order. */
  readonly groups: readonly TreatmentGroup[];
}

export function ServicesHero({ groups }: ServicesHeroProps) {
  const { hero } = SERVICES_PAGE;

  return (
    <section
      aria-labelledby="services-hero-title"
      data-surface="inverted"
      className="bg-brand-surface text-brand-surface-foreground"
    >
      <Container
        width="wide"
        className="pt-14 pb-12 md:pt-20 md:pb-16 lg:pt-28 lg:pb-20"
      >
        <p className="text-caption text-brand-surface-accent font-sans font-medium tracking-[0.18em] uppercase">
          {hero.eyebrow}
        </p>

        <h1
          id="services-hero-title"
          className="text-display text-brand-surface-foreground measure mt-4 font-normal"
        >
          {hero.title}
        </h1>

        <p className="text-body-lg text-brand-surface-muted measure mt-6">
          {hero.description}
        </p>

        <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild size="lg" block className="sm:w-auto">
            <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
          </Button>
          {/*
            `secondary` rather than `outline`: the sand chip is an opaque
            surface with its own verified foreground, where an outline button
            would draw a dim border against the deep green.
          */}
          <Button
            asChild
            size="lg"
            variant="secondary"
            block
            className="sm:w-auto"
          >
            <Link href={`#${hero.secondaryAction.targetId}`}>
              {hero.secondaryAction.label}
            </Link>
          </Button>
        </div>

        {groups.length > 0 ? (
          <nav
            aria-label="Service categories"
            className="border-brand-surface-border mt-12 border-t pt-6 lg:mt-16"
          >
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <li className="text-caption text-brand-surface-muted font-sans tracking-[0.14em] uppercase">
                Jump to
              </li>
              {groups.map((group) => (
                <li key={group.category.id}>
                  <Link
                    href={`#${categoryAnchorId(group.category.id)}`}
                    className="text-label text-brand-surface-foreground ease-natural inline-flex min-h-11 items-center rounded-sm font-medium underline-offset-4 transition-colors duration-(--duration-fast) hover:underline"
                  >
                    {group.category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </Container>
    </section>
  );
}
