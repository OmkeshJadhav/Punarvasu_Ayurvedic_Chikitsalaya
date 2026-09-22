import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { ClinicLocation } from "@/components/marketing/clinic-location";
import { ContactChannels } from "@/components/marketing/contact-channels";
import { ContactEnquirySection } from "@/components/marketing/contact-enquiry";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FinalCtaSection } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";
import {
  CLINIC_CONTACT,
  CLINIC_SOCIAL_LINKS,
  formatPhone,
} from "@/config/clinic";
import { getSiteConfig } from "@/config/env.public";
import { ABOUT_PATH, CONTACT_PATH, PRIMARY_CTA } from "@/config/navigation";
import { CONTACT_PAGE, CONTACT_SECTIONS } from "@/features/contact/content";
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
 * The clinic has supplied its **address**, its **phone number** and the map
 * embed for its own listing, and all three are published here. It has not
 * supplied an **email address** or **opening hours**, so neither appears -
 * and the page says which details are missing rather than leaving a visitor
 * hunting for them (`docs/implementation-plan/phase_05.md` sections 29 and
 * 35). Every one of those values comes from `config/clinic.ts`; nothing is
 * typed into a component.
 *
 * ## The map
 *
 * Rendered with the page and lazily fetched. The address is text beneath it,
 * again in the contact details above it and again in the footer; the
 * directions link opens the visitor's own maps app. All of that works if the
 * frame never loads, which is the accessible alternative section 34
 * requires - the map is an enhancement, never the only route to the
 * location.
 *
 * ## The enquiry form
 *
 * Not rendered. See `ContactEnquirySection` for the reasoning: there is no
 * delivery channel, and a form that goes nowhere is worse than no form. The
 * validated form foundation exists in `features/contact/schema.ts` and
 * `components/marketing/contact-form.tsx`.
 *
 * ## Structured data
 *
 * `MedicalClinic`, built by `buildClinicJsonLd`, which emits a property only
 * where a real value exists. The address and telephone it now carries are
 * exactly the address and telephone rendered on this page, which is what
 * `phase_05.md` section 52 requires. No `openingHours`, no rating, no review
 * and no price is constructed at all.
 *
 * ## Rendering
 *
 * Static, and the only client component on the page is the FAQ disclosure.
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
  const phoneDisplay = formatPhone(CLINIC_CONTACT.phone);

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

      <PageHero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
        eyebrow={CONTACT_PAGE.hero.eyebrow}
        title={CONTACT_PAGE.hero.title}
        titleId="contact-title"
        description={CONTACT_PAGE.hero.description}
        actions={
          <>
            {CLINIC_CONTACT.phone ? (
              <Button asChild size="lg" block className="sm:w-auto">
                <a href={`tel:${CLINIC_CONTACT.phone}`}>
                  {CONTACT_PAGE.labels.phoneAction}
                  {phoneDisplay ? (
                    <span className="sr-only">: {phoneDisplay}</span>
                  ) : null}
                </a>
              </Button>
            ) : null}
            <Button
              asChild
              size="lg"
              variant="outline"
              block
              className="sm:w-auto"
            >
              <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
            </Button>
          </>
        }
      />

      <ContactChannels contact={CLINIC_CONTACT} />

      <ClinicLocation contact={CLINIC_CONTACT} />

      <ContactEnquirySection contact={CLINIC_CONTACT} />

      <ContactFaqSection />

      <FinalCtaSection
        titleId="contact-cta-title"
        title={CONTACT_PAGE.cta.title}
        description={CONTACT_PAGE.cta.description}
        secondaryAction={
          <Button asChild size="lg" variant="outline">
            <Link href={ABOUT_PATH}>{CONTACT_PAGE.cta.secondaryLabel}</Link>
          </Button>
        }
      />
    </>
  );
}

/**
 * Practical questions about visiting.
 *
 * The questions here are the ones the rest of the page cannot answer in a
 * line - and two of them are answered with "the clinic has not confirmed
 * that, please call", which is the honest answer rather than a plausible one
 * (`phase_05.md` section 46).
 */
function ContactFaqSection() {
  return (
    <Section
      id={CONTACT_SECTIONS.faq}
      aria-labelledby="contact-faq-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="contact-faq-title"
              eyebrow={CONTACT_PAGE.faq.eyebrow}
              title={CONTACT_PAGE.faq.title}
              description={CONTACT_PAGE.faq.description}
            />
          </div>

          <div className="lg:col-span-7">
            <FaqAccordion items={CONTACT_PAGE.faqItems} headingLevel="h3" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
