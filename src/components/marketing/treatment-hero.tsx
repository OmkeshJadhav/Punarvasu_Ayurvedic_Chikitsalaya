import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Button } from "@/components/ui/button";
import { PRIMARY_CTA, SERVICES_PATH } from "@/config/navigation";
import type { Treatment, TreatmentCategory } from "@/features/services/types";

/**
 * The opening band of a treatment page.
 *
 * ## Order on a small screen
 *
 * Breadcrumb, category, name, summary, actions, photograph — copy and the
 * primary action come before the image, so a visitor on a phone reaches
 * "Book a Consultation" without scrolling past a picture
 * (`docs/implementation-plan/phase_04.md` section 52). From `lg` the
 * photograph moves alongside, and the reading order is unchanged.
 *
 * ## The actions
 *
 * One primary action, one quiet alternative back to the catalogue. The
 * primary is a consultation, never "Book this treatment": whether this
 * therapy is appropriate is a clinical judgement, and a button that books it
 * directly would make that judgement on the visitor's behalf
 * (`phase_04.md` section 53).
 *
 * ## The photograph
 *
 * This is the page's LCP element where one exists, so it carries `priority`
 * — the one image on the page that does. A treatment with no photograph
 * renders a single-column composition rather than an empty frame; no
 * unrelated stock image is borrowed to fill the space.
 *
 * A server component. The page's single `<h1>` lives here.
 */
export interface TreatmentHeroProps {
  readonly treatment: Treatment;
  readonly category: TreatmentCategory | undefined;
  readonly titleId: string;
}

export function TreatmentHero({
  treatment,
  category,
  titleId,
}: TreatmentHeroProps) {
  const hasImage = treatment.image !== undefined;

  return (
    <section
      aria-labelledby={titleId}
      className="bg-background border-border border-b"
    >
      <Container width="wide" className="pt-6 pb-14 md:pb-20 lg:pb-24">
        <Breadcrumbs
          className="mb-8 lg:mb-10"
          items={[
            { label: "Home", href: "/" },
            { label: "Services", href: SERVICES_PATH },
            { label: treatment.name },
          ]}
        />

        <div
          className={
            hasImage
              ? "grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
              : "measure"
          }
        >
          <div>
            {category ? (
              <p className="text-caption text-eyebrow font-sans font-medium tracking-[0.18em] uppercase">
                {category.name}
              </p>
            ) : null}

            <h1
              id={titleId}
              className="text-h1 text-heading mt-4 font-normal text-balance"
            >
              {treatment.name}
            </h1>

            {treatment.sanskritName &&
            treatment.sanskritName !== treatment.name ? (
              <p
                lang="sa-Latn"
                className="text-body-lg text-muted-foreground mt-2 font-serif italic"
              >
                {treatment.sanskritName}
              </p>
            ) : null}

            <p className="text-body-lg text-prose measure mt-6">
              {treatment.summary}
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button asChild size="lg" block className="sm:w-auto">
                <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                block
                className="sm:w-auto"
              >
                <Link href={SERVICES_PATH}>Explore other treatments</Link>
              </Button>
            </div>
          </div>

          {treatment.image ? (
            <MediaFrame
              image={treatment.image}
              aspect="wide"
              radius="xl"
              priority
              sizes="(min-width: 1280px) 37rem, (min-width: 1024px) 45vw, 100vw"
            />
          ) : null}
        </div>
      </Container>
    </section>
  );
}
