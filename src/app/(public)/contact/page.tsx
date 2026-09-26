import type { Metadata } from "next";
import Link from "next/link";

import { ContactDetails } from "@/components/contact/contact-details";
import { ContactEnquiryNotice } from "@/components/contact/contact-enquiry-notice";
import { ContactFaq } from "@/components/contact/contact-faq";
import { ContactHero } from "@/components/contact/contact-hero";
import { ContactLocation } from "@/components/contact/contact-location";
import { FinalCtaSection } from "@/components/marketing/final-cta";
import { Button } from "@/components/ui/button";
import { CLINIC_CONTACT, CLINIC_SOCIAL_LINKS } from "@/config/clinic";
import { getSiteConfig } from "@/config/env.public";
import { ABOUT_PATH, CONTACT_PATH } from "@/config/navigation";
import { CONTACT_PAGE } from "@/features/contact/content";
import {
  buildBreadcrumbJsonLd,
  buildClinicJsonLd,
  serializeJsonLd,
} from "@/lib/seo/structured-data";

/**
 * The contact page.
 *
 * ## What is verified and what is not
 *
 * Every clinic fact on this page - address, phone, email, opening hours and
 * the map embed - comes from `config/clinic.ts`; nothing is typed into a
 * component. Each section renders the facts that exist and, where one does
 * not, says so in plain words rather than leaving a visitor hunting for it
 * (`docs/implementation-plan/phase_05.md` sections 29 and 35).
 *
 * ## Narrative and rhythm
 *
 * A still life and the `<h1>` (ivory) → the contact details (sand) → where
 * the clinic is, with a landscape rising from the foot of the band (ivory) →
 * a short notice about online messages (a sand panel on ivory) → practical
 * questions beside stacked stones (ivory) → the deep-green invitation → the
 * footer. Light, warm, light, warm, dark: no two neighbouring bands are built
 * the same way.
 *
 * ## The map
 *
 * Lazily fetched, and never the only route to the location: the address is
 * text beneath it, in the details above it and in the footer, and the
 * directions link opens the visitor's own maps app (`phase_05.md` section
 * 34).
 *
 * ## The enquiry form
 *
 * Not rendered. See `ContactEnquiryNotice`: there is no delivery channel, and
 * a form that goes nowhere is worse than no form. The validated form
 * foundation exists in `features/contact/schema.ts` and
 * `components/marketing/contact-form.tsx`.
 *
 * ## Structured data
 *
 * `MedicalClinic`, built by `buildClinicJsonLd`, which emits a property only
 * where a real value exists, so what it carries is exactly what this page
 * renders (`phase_05.md` section 52). No rating, review or price is
 * constructed at all.
 *
 * ## Rendering
 *
 * Static. The client islands are the FAQ disclosure and the scroll-triggered
 * entrances (`Reveal`), neither of which gates any content.
 */
export const metadata: Metadata = {
  title: "Contact & Visit",
  description:
    "Punarvasu Ayurvedic Chikitsalaya is in Godoli, Satara. Phone number, full address, directions and answers to practical questions about visiting.",
  alternates: { canonical: CONTACT_PATH },
  openGraph: {
    type: "website",
    siteName: "Punarvasu",
    title: "Contact & Visit | Punarvasu",
    description:
      "Phone number, full address and directions for Punarvasu Ayurvedic Chikitsalaya in Godoli, Satara.",
    url: CONTACT_PATH,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact & Visit | Punarvasu",
    description:
      "Phone number, full address and directions for Punarvasu in Godoli, Satara.",
  },
};

export default function ContactPage() {
  const siteUrl = getSiteConfig().siteUrl;

  const clinicJsonLd = buildClinicJsonLd({
    siteUrl,
    description: metadata.description ?? "",
    contact: CLINIC_CONTACT,
    socialLinks: CLINIC_SOCIAL_LINKS,
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(siteUrl, [
    { name: "Home", path: "/" },
    { name: "Contact", path: CONTACT_PATH },
  ]);

  return (
    <>
      {/*
        Both payloads are developer-authored configuration and
        `serializeJsonLd` escapes `<`, so no value can close either tag. The
        clinic fields become editable settings in a later phase, which is why
        the escape is already here.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(clinicJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <ContactHero contact={CLINIC_CONTACT} />
      <ContactDetails contact={CLINIC_CONTACT} />
      <ContactLocation contact={CLINIC_CONTACT} />
      <ContactEnquiryNotice contact={CLINIC_CONTACT} />
      <ContactFaq />

      <FinalCtaSection
        tone="brand"
        titleId="contact-cta-title"
        eyebrow={CONTACT_PAGE.cta.eyebrow}
        title={CONTACT_PAGE.cta.title}
        titleEmphasis={CONTACT_PAGE.cta.titleEmphasis}
        description={CONTACT_PAGE.cta.description}
        secondaryAction={
          <Button asChild size="lg" variant="outline-inverse">
            <Link href={ABOUT_PATH}>{CONTACT_PAGE.cta.secondaryLabel}</Link>
          </Button>
        }
      />
    </>
  );
}
