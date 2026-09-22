import type { ReactNode } from "react";

import {
  Breadcrumbs,
  type BreadcrumbItem,
} from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { MediaFrame } from "@/components/marketing/media-frame";
import type { ImageAsset } from "@/config/images";
import { cn } from "@/lib/utils/cn";

/**
 * The opening band of a secondary public page.
 *
 * ## Why one component for three pages
 *
 * `/about`, `/practitioners` and `/contact` all begin the same way: where you
 * are, what this page is, one sentence of orientation, and the actions. Three
 * hand-written heroes would drift apart within a phase, and cross-page
 * consistency is a stated requirement rather than a nicety
 * (`docs/implementation-plan/phase_05.md` section 49).
 *
 * ## Why it is not the services hero
 *
 * `/services` opens on the deep-green brand band. The design system allows
 * one inversion per page and spending it on a hero is right for a catalogue,
 * but doing it on every page would turn the accent into wallpaper
 * (`docs/DESIGN_SYSTEM.md` section 64). These pages open on the warm page
 * surface, and keep their inversion - where they have one - for a section
 * that earns it.
 *
 * ## Order on a small screen
 *
 * Breadcrumb, eyebrow, heading, description, actions, photograph. Copy and
 * the primary action come before the image, so a visitor on a phone reaches
 * the action without scrolling past a picture. From `lg` the photograph moves
 * alongside and the reading order is unchanged.
 *
 * A server component. The page's single `<h1>` lives here.
 */
export interface PageHeroProps {
  readonly breadcrumbs?: readonly BreadcrumbItem[];
  readonly eyebrow: string;
  readonly title: ReactNode;
  readonly titleId: string;
  readonly description: string;
  /** Buttons or links. Laid out full-width on mobile, inline from `sm`. */
  readonly actions?: ReactNode;
  /**
   * Optional supporting photograph. Omitted rather than substituted when no
   * image honestly belongs to the page - see `config/images.ts`.
   */
  readonly image?: ImageAsset;
  readonly className?: string;
}

export function PageHero({
  breadcrumbs,
  eyebrow,
  title,
  titleId,
  description,
  actions,
  image,
  className,
}: PageHeroProps) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn("bg-background border-border border-b", className)}
    >
      <Container width="wide" className="pt-6 pb-14 md:pb-20 lg:pb-24">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumbs className="mb-8 lg:mb-10" items={breadcrumbs} />
        ) : null}

        <div
          className={
            image
              ? "grid items-center gap-10 lg:grid-cols-12 lg:gap-16"
              : "measure"
          }
        >
          <div className={image ? "lg:col-span-7" : undefined}>
            <p className="text-caption text-eyebrow font-sans font-medium tracking-[0.18em] uppercase">
              {eyebrow}
            </p>

            <h1
              id={titleId}
              className="text-display text-heading mt-4 font-normal text-balance"
            >
              {title}
            </h1>

            <p className="text-body-lg text-prose measure mt-6">
              {description}
            </p>

            {actions ? (
              <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                {actions}
              </div>
            ) : null}
          </div>

          {image ? (
            <MediaFrame
              image={image}
              aspect="wide"
              radius="xl"
              priority
              sizes="(min-width: 1280px) 30rem, (min-width: 1024px) 40vw, 100vw"
              className="lg:col-span-5"
            />
          ) : null}
        </div>
      </Container>
    </section>
  );
}
