import type { Metadata } from "next";

import { ApproachSection } from "@/components/marketing/approach-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { IntroSection } from "@/components/marketing/intro-section";
import { LocationSection } from "@/components/marketing/location-section";
import { PatientJourneySection } from "@/components/marketing/patient-journey";
import { PhilosophySection } from "@/components/marketing/philosophy-section";
import { PractitionerPreviewSection } from "@/components/marketing/practitioner-preview";
import { ServicePreviewSection } from "@/components/marketing/service-preview";
import { WhyPunarvasuSection } from "@/components/marketing/why-punarvasu";
import { CLINIC_CONTACT, CLINIC_SOCIAL_LINKS } from "@/config/clinic";
import { getSiteConfig } from "@/config/env.public";
import { FAQ_ITEMS, FEATURED_SERVICES } from "@/config/marketing-content";
import { getPractitionerPreviews } from "@/features/practitioners/directory";
import { buildClinicJsonLd, serializeJsonLd } from "@/lib/seo/structured-data";

/**
 * The Punarvasu home page.
 *
 * ## Composition
 *
 * A server component that assembles section components and hands each one its
 * data. Every section is also a server component except `FaqSection`, which
 * needs state for the disclosure. The page ships no data fetching: all content
 * is typed configuration in `config/marketing-content.ts`, so it prerenders to
 * static HTML and there is nothing that can fail at request time.
 *
 * That is also why there is no `loading.tsx` for this route and no error
 * boundary beyond the app-level one: a skeleton for content that is already in
 * the HTML would be a flash of nothing for no reason. When a section becomes
 * database-backed, it gains its own boundary so a failure there degrades that
 * section rather than the page (`docs/implementation-plan/phase_03.md`
 * sections 46-48).
 *
 * ## Narrative order
 *
 * Introduce → build trust → explain the approach → show where people start →
 * differentiate → remove uncertainty → state the philosophy → introduce the
 * people → answer the questions → invite.
 *
 * Testimonials are absent by decision, not omission: no verified patient
 * testimonial exists, and inventing one is out of the question, so the section
 * is not built (`phase_03.md` section 25, option B).
 *
 * `LocationSection` and `PractitionerPreviewSection` decide for themselves
 * whether they have enough real content to render. Since Phase 05 the
 * practitioner preview reads the same roster as `/practitioners`, and
 * `LocationSection` renders for the first time because the clinic's address
 * and phone number are now verified (`config/clinic.ts`).
 */
export const metadata: Metadata = {
  // `absolute` bypasses the root layout's "%s | Punarvasu" template, which
  // would otherwise render "Punarvasu — Ayurvedic Clinic | Punarvasu".
  title: { absolute: "Punarvasu — Ayurvedic Clinic" },
  description:
    "Punarvasu is an Ayurvedic clinic offering unhurried consultations and personalized care, guided by qualified practitioners and classical Ayurvedic principles.",
  // The home page is the canonical root. `metadataBase` in the root layout
  // resolves this against the configured site URL.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Punarvasu",
    title: "Punarvasu — Ayurvedic Clinic",
    description:
      "Ancient wisdom, personalized care. An Ayurvedic approach designed around your individual journey.",
    url: "/",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Punarvasu — Ayurvedic Clinic",
    description:
      "Ancient wisdom, personalized care. An Ayurvedic approach designed around your individual journey.",
  },
};

export default function HomePage() {
  const practitioners = getPractitionerPreviews();

  const jsonLd = buildClinicJsonLd({
    siteUrl: getSiteConfig().siteUrl,
    description: metadata.description ?? "",
    contact: CLINIC_CONTACT,
    socialLinks: CLINIC_SOCIAL_LINKS,
  });

  return (
    <>
      {/*
        Structured data. Built from verified facts only - the builder omits an
        address, phone number or rating rather than inventing one, because a
        search engine republishes whatever it finds here.
      */}
      <script
        type="application/ld+json"
        // The payload is developer-authored configuration, and `serializeJsonLd`
        // escapes `<` so no value can close this tag. It is not user input.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Hero />
      <IntroSection />
      <ApproachSection />
      <ServicePreviewSection services={FEATURED_SERVICES} />
      <WhyPunarvasuSection />
      <PatientJourneySection />
      <PhilosophySection />
      <PractitionerPreviewSection practitioners={practitioners} />
      <FaqSection items={FAQ_ITEMS} />
      <LocationSection contact={CLINIC_CONTACT} />
      <FinalCtaSection />
    </>
  );
}
