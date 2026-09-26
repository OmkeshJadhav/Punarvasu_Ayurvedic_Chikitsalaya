import type { Metadata } from "next";

import { AssessmentSection } from "@/components/services/assessment-section";
import { OngoingSupport } from "@/components/services/ongoing-support";
import { ServiceCollection } from "@/components/services/service-collection";
import { ServicesCta } from "@/components/services/services-cta";
import { ServicesFaq } from "@/components/services/services-faq";
import {
  GentleReminder,
  ServicesHero,
} from "@/components/services/services-hero";
import { StartingPoints } from "@/components/services/starting-points";
import { TestimonialSection } from "@/components/services/testimonial-section";
import {
  getFeaturedTreatments,
  getTreatmentsByCategory,
  hasUnreviewedContent,
} from "@/features/services/catalogue";
import { getDisplayTestimonials } from "@/features/testimonials/content";

/**
 * The services and treatments page.
 *
 * ## Composition
 *
 * A server component that reads the catalogue through
 * `features/services/catalogue` and hands each section its data. The only
 * client islands are the testimonial carousel and the FAQ disclosure, so the
 * page prerenders to static HTML.
 *
 * There is no `loading.tsx` for this route: the content is typed
 * configuration and is already in the HTML, so a skeleton would be a flash of
 * nothing for no reason. `error.tsx` exists for the segment so that a failure
 * here degrades inside the public shell rather than replacing the whole page
 * (`docs/implementation-plan/phase_04.md` sections 39 and 63).
 *
 * ## Narrative and rhythm
 *
 * Cinematic photograph → a line of care guidance → assessment comes first
 * (ivory) → where most people begin (the deep-green band) → everything we
 * offer (ivory) → a patient's own words (photograph and sand) → what
 * continues afterwards (ivory) → the questions (ivory) → a compact
 * photographic invitation → the footer.
 *
 * The bands alternate in texture as well as colour - photograph, paper,
 * green, paper, photograph - so no two neighbouring sections are built the
 * same way.
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
  const testimonials = getDisplayTestimonials();

  return (
    <>
      <ServicesHero />
      <GentleReminder />
      <AssessmentSection />
      <StartingPoints treatments={featured} />
      <ServiceCollection
        groups={groups}
        showReviewNotice={hasUnreviewedContent()}
      />
      <TestimonialSection testimonials={testimonials} />
      <OngoingSupport />
      <ServicesFaq />

      <ServicesCta />
    </>
  );
}
