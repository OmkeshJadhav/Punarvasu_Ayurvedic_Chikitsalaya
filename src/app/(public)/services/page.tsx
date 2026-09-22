import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { ContentReviewNotice } from "@/components/marketing/content-review-notice";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FeaturedTreatments } from "@/components/marketing/featured-treatments";
import { FinalCtaSection } from "@/components/marketing/final-cta";
import { PersonalizationNote } from "@/components/marketing/personalization-note";
import { ProcessSteps } from "@/components/marketing/process-steps";
import { ServicesHero } from "@/components/marketing/services-hero";
import { TreatmentCatalogue } from "@/components/marketing/treatment-catalogue";
import { Button } from "@/components/ui/button";
import { HOME_SECTIONS } from "@/config/marketing-content";
import { homeSectionHref } from "@/config/navigation";
import {
  getFeaturedTreatments,
  getTreatmentsByCategory,
  hasUnreviewedContent,
} from "@/features/services/catalogue";
import {
  SERVICES_FAQ_ITEMS,
  SERVICES_PAGE,
  SERVICES_SECTIONS,
} from "@/features/services/content";

/**
 * The services and treatments page.
 *
 * ## Composition
 *
 * A server component that reads the catalogue through
 * `features/services/catalogue` and hands each section its data. Every
 * section is a server component except the FAQ disclosure, so the page
 * prerenders to static HTML and ships a few hundred bytes of JavaScript
 * rather than a filtered catalogue's worth.
 *
 * There is no `loading.tsx` for this route: the content is typed
 * configuration and is already in the HTML, so a skeleton would be a flash of
 * nothing for no reason. `error.tsx` exists for the segment so that a failure
 * here degrades inside the public shell rather than replacing the whole page
 * (`docs/implementation-plan/phase_04.md` sections 39 and 63).
 *
 * ## Narrative order
 *
 * State what the page is → explain that assessment comes before any therapy →
 * show where most people begin → list everything, grouped → say plainly why
 * the page will not choose for you → answer the questions that raises →
 * invite.
 *
 * The personalization section sits *after* the catalogue on purpose. A
 * visitor who has just read seven treatment summaries is at their most likely
 * to have picked one in their head, and that is the moment to say that the
 * choice is not theirs to make alone.
 */
export const metadata: Metadata = {
  title: "Services & Treatments",
  description:
    "Ayurvedic consultation, classical therapies and ongoing guidance at Punarvasu. Each page explains what a therapy is and what happens during it; suitability is assessed individually at consultation.",
  alternates: { canonical: "/services" },
  openGraph: {
    type: "website",
    siteName: "Punarvasu",
    title: "Services & Treatments | Punarvasu",
    description:
      "Ayurvedic consultation, classical therapies and ongoing guidance. Suitability is assessed individually at consultation.",
    url: "/services",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Services & Treatments | Punarvasu",
    description:
      "Ayurvedic consultation, classical therapies and ongoing guidance at Punarvasu.",
  },
};

export default function ServicesPage() {
  const groups = getTreatmentsByCategory();
  const featured = getFeaturedTreatments();

  return (
    <>
      <ServicesHero groups={groups} />

      {hasUnreviewedContent() ? (
        <div className="bg-background border-border border-b">
          <Container width="wide" className="py-6">
            <ContentReviewNotice context="listing" />
          </Container>
        </div>
      ) : null}

      <SelectionSection />

      <FeaturedTreatments treatments={featured} />

      <TreatmentCatalogue groups={groups} id={SERVICES_SECTIONS.catalogue} />

      <PersonalizationNote id={SERVICES_SECTIONS.personalization} />

      <ServicesFaqSection />

      <FinalCtaSection
        title={SERVICES_PAGE.cta.title}
        description={SERVICES_PAGE.cta.description}
        secondaryAction={
          <Button asChild size="lg" variant="outline">
            <Link href={homeSectionHref(HOME_SECTIONS.approach)}>
              {SERVICES_PAGE.cta.secondaryLabel}
            </Link>
          </Button>
        }
      />
    </>
  );
}

/**
 * How a treatment is chosen.
 *
 * The `grid` step layout rather than the home page's timeline: these are four
 * commitments about how the clinic decides, not four things that happen to
 * you in sequence at an appointment, and using the same timeline for both
 * would blur that difference.
 */
function SelectionSection() {
  return (
    <Section
      id={SERVICES_SECTIONS.selection}
      aria-labelledby="selection-title"
      className="anchor-offset bg-muted border-border border-b"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="selection-title"
              eyebrow={SERVICES_PAGE.selection.eyebrow}
              title={SERVICES_PAGE.selection.title}
              description={SERVICES_PAGE.selection.description}
            />
          </div>

          <div className="lg:col-span-7">
            <ProcessSteps
              steps={SERVICES_PAGE.selection.steps}
              layout="grid"
              headingLevel="h3"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}

function ServicesFaqSection() {
  return (
    <Section
      id={SERVICES_SECTIONS.faq}
      aria-labelledby="services-faq-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="services-faq-title"
              eyebrow={SERVICES_PAGE.faq.eyebrow}
              title={SERVICES_PAGE.faq.title}
              description={SERVICES_PAGE.faq.description}
            />
          </div>

          <div className="lg:col-span-7">
            <FaqAccordion items={SERVICES_FAQ_ITEMS} headingLevel="h3" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
