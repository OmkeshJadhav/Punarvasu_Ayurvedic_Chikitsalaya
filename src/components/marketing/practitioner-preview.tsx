import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { PractitionerGrid } from "@/components/marketing/practitioner-grid";
import { Button } from "@/components/ui/button";
import { HOME_SECTIONS } from "@/config/marketing-content";
import { PRACTITIONERS_PATH } from "@/config/navigation";
import { PRACTITIONERS_PAGE } from "@/features/practitioners/content";
import type { Practitioner } from "@/features/practitioners/types";

/**
 * The home page's practitioner preview.
 *
 * ## Why this reads from the practitioners feature
 *
 * Phase 03 gave the home page its own `PractitionerPreview` shape in
 * `config/marketing-content.ts`, because there was nowhere else for it to
 * live. Phase 05 builds `/practitioners`, and two models of the same domain
 * concept is exactly the duplication `AGENTS.md` section 32 forbids - so the
 * home page now reads the same roster, through the same directory, and
 * renders the same cards. Publishing a practitioner updates both pages at
 * once, which is the point.
 *
 * ## What it can and cannot show
 *
 * Whatever the roster holds, and nothing more. No practitioner has been
 * confirmed for publication, so the cards render their explicit "profile to
 * be published" state rather than naming anyone
 * (`features/practitioners/types.ts`).
 *
 * The section hides itself when the roster is empty: the home page decides
 * what to pass, and an empty band with a heading over it is worse than one
 * fewer section.
 *
 * A server component apart from the grid's shared reveal.
 */
export interface PractitionerPreviewSectionProps {
  readonly practitioners: readonly Practitioner[];
}

export function PractitionerPreviewSection({
  practitioners,
}: PractitionerPreviewSectionProps) {
  if (practitioners.length === 0) {
    return null;
  }

  return (
    <Section
      id={HOME_SECTIONS.practitioners}
      aria-labelledby="practitioners-title"
      className="anchor-offset bg-muted border-border border-y"
    >
      <Container width="wide">
        <SectionHeader
          titleId="practitioners-title"
          align="center"
          eyebrow={PRACTITIONERS_PAGE.roster.eyebrow}
          title={PRACTITIONERS_PAGE.hero.title}
          description={PRACTITIONERS_PAGE.hero.description}
        />

        <PractitionerGrid
          practitioners={practitioners}
          className="mt-10 lg:mt-14"
        />

        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link href={PRACTITIONERS_PATH}>Meet our practitioners</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
