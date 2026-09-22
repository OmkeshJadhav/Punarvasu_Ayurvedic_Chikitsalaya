import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { TreatmentCard } from "@/components/marketing/treatment-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { PRIMARY_CTA } from "@/config/navigation";
import {
  categoryAnchorId,
  type TreatmentGroup,
} from "@/features/services/catalogue";
import { SERVICES_PAGE } from "@/features/services/content";

/**
 * The full catalogue, grouped by category.
 *
 * ## Why grouped sections rather than a filter
 *
 * Seven treatments in three groups fit on one page. A filter would hide six
 * of them behind a control, add a client island and a hidden piece of state,
 * and give the visitor a decision to make before they have read anything —
 * all to save a scroll they were going to do anyway. Grouped sections put
 * every treatment in front of them, under a heading that explains what the
 * group is for, and the hero's jump rail handles skipping
 * (`docs/implementation-plan/phase_04.md` sections 13, 35 and 37).
 *
 * This is a server component and ships no JavaScript. When the catalogue
 * grows past roughly a dozen entries that trade reverses, and the note in
 * `features/services/catalogue.ts` records where to add the search API.
 *
 * ## Semantics
 *
 * Each category is a real `<section>` with `aria-labelledby`, so it is a
 * navigable landmark and the hero's jump links land somewhere named. The
 * cards are `<li>`s inside a `<ul>`, so a screen reader announces how many
 * there are before reading them.
 */
export interface TreatmentCatalogueProps {
  readonly groups: readonly TreatmentGroup[];
  /** Anchor id for the catalogue as a whole. */
  readonly id: string;
}

export function TreatmentCatalogue({ groups, id }: TreatmentCatalogueProps) {
  const { catalogue } = SERVICES_PAGE;

  return (
    <Section
      id={id}
      aria-labelledby="catalogue-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <SectionHeader
          titleId="catalogue-title"
          eyebrow={catalogue.eyebrow}
          title={catalogue.title}
          description={catalogue.description}
        />

        {groups.length === 0 ? (
          /*
           * The catalogue is static configuration today, so this cannot
           * happen at runtime — but it becomes a real state the moment the
           * data moves to a database, and a page that renders an empty grid
           * then is a page nobody will notice is broken
           * (`phase_04.md` section 39).
           */
          <EmptyState
            className="mt-10"
            title="Our services are being prepared"
            description="The treatment pages are not published yet. You can still request a consultation and tell us what brought you here."
            action={
              <Button asChild>
                <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-12 flex flex-col gap-14 lg:mt-16 lg:gap-20">
            {groups.map((group) => (
              <CategoryGroup key={group.category.id} group={group} />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}

function CategoryGroup({ group }: { readonly group: TreatmentGroup }) {
  const anchorId = categoryAnchorId(group.category.id);
  const titleId = `${anchorId}-title`;

  return (
    <section id={anchorId} aria-labelledby={titleId} className="anchor-offset">
      {/* A rule above the group rather than a card around it: the categories
          are divisions of one list, not three separate panels. */}
      <div className="border-border flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
        <h3 id={titleId} className="text-h3 text-heading font-normal">
          {group.category.name}
        </h3>
        <p className="text-body-sm text-prose measure sm:text-right">
          {group.category.description}
        </p>
      </div>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {group.treatments.map((treatment, index) => (
          <Reveal key={treatment.slug} asChild delay={index * 70}>
            <li className="flex">
              <TreatmentCard
                treatment={treatment}
                headingLevel="h4"
                // Three cards inside the capped 1280px container with 2rem
                // gutters render at ~373px; a `sizes` that undershoots the
                // real width makes the browser pick a file it then upscales.
                imageSizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 100vw"
              />
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
