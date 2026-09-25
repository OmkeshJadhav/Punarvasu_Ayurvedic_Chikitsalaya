import type { Metadata } from "next";

import { AboutHero } from "@/components/about/about-hero";
import { NameSection } from "@/components/about/name-section";
import {
  CommitmentsSection,
  FiguresSection,
  PlaceAndPeopleSection,
  TestimonialsSection,
} from "@/components/about/people-sections";
import {
  ApproachJourneySection,
  BeliefsSection,
  PurposeSection,
} from "@/components/about/story-sections";
import { FinalCtaSection } from "@/components/marketing/final-cta";
import { TextLink } from "@/components/marketing/text-link";
import { getSiteConfig } from "@/config/env.public";
import { HOME_IMAGES } from "@/config/images";
import { ABOUT_PATH, SERVICES_PATH } from "@/config/navigation";
import { ABOUT_PAGE, ABOUT_TESTIMONIALS } from "@/features/about/content";
import { getPractitionerPreviews } from "@/features/practitioners/directory";
import {
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/seo/structured-data";

/**
 * The About page.
 *
 * ## What it is for
 *
 * A visitor arrives here having already seen what the clinic offers. The
 * question they now have is whether to trust it, and trust on a healthcare
 * site is built by being specific and by admitting what you do not know -
 * not by a Mission / Vision / Values triptych
 * (`docs/implementation-plan/phase_05.md` section 64).
 *
 * So the page is a story told in chapters: what the name means, why the
 * clinic exists, what it believes, what a practitioner does with the time,
 * three figures it can stand behind, where it is and who works there, the
 * four things it will refuse to do, patients' own words once there are any,
 * and an invitation.
 *
 * ## Design
 *
 * Set like a wellness retreat's printed prospectus rather than a clinic
 * website: a cinematic opening photograph, few but large images, display
 * serif headings with one italic phrase each, and wide margins. The
 * surfaces alternate linen, sage, deep green and sand so no two chapters sit
 * on the same colour, and the page closes on a photograph under the verified
 * scrim. The sections live in `components/about/`.
 *
 * ## Content status
 *
 * The clinic's story (chapter 02), founding year and practitioners were
 * supplied by Punarvasu. The explanation of the name and the consultation
 * method were written for the clinic; `features/about/content.ts` records
 * which is which.
 *
 * ## Rendering
 *
 * Fully static. All copy is typed configuration in
 * `features/about/content.ts`, so there is no request-time fetch and nothing
 * that can fail here; hence no `loading.tsx` and no route-level error
 * boundary beyond the segment's. Every section is a server component - the
 * page ships only the shell's JavaScript.
 *
 * ## Sections and duplication
 *
 * "Our approach to care" is the practitioner's method inside the room. The
 * home page's "What happens after you book" is the visitor's itinerary. They
 * are different sequences and each links to the other rather than repeating
 * it (`phase_05.md` section 13).
 */
export const metadata: Metadata = {
  title: "About Punarvasu",
  description:
    "Punarvasu is an Ayurvedic clinic in Satara. What the name means, how a consultation is conducted, and the four things the clinic will not do.",
  alternates: { canonical: ABOUT_PATH },
  openGraph: {
    type: "website",
    siteName: "Punarvasu",
    title: "About Punarvasu",
    description:
      "What the name means, how a consultation is conducted, and the four things the clinic will not do.",
    url: ABOUT_PATH,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Punarvasu",
    description:
      "What the name means, how a consultation is conducted, and the four things the clinic will not do.",
  },
};

export default function AboutPage() {
  const practitioners = getPractitionerPreviews();

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(getSiteConfig().siteUrl, [
    { name: "Home", path: "/" },
    { name: "About", path: ABOUT_PATH },
  ]);

  return (
    <>
      {/*
        Breadcrumbs only. The page makes no medical claim and asserts nothing
        about a practitioner, so there is nothing else here that a search
        engine could responsibly republish under the clinic's name - see
        `buildBreadcrumbJsonLd`. The payload is developer-authored
        configuration and `serializeJsonLd` escapes `<`.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <AboutHero />
      <NameSection />
      <PurposeSection />
      <BeliefsSection />
      <ApproachJourneySection />
      <FiguresSection />
      <PlaceAndPeopleSection practitioners={practitioners} />
      <CommitmentsSection />
      <TestimonialsSection testimonials={ABOUT_TESTIMONIALS} />

      <FinalCtaSection
        tone="brand"
        image={HOME_IMAGES.philosophy}
        titleId="about-cta-title"
        title={ABOUT_PAGE.cta.title}
        titleEmphasis={ABOUT_PAGE.cta.titleEmphasis}
        description={ABOUT_PAGE.cta.description}
        secondaryAction={
          <TextLink href={SERVICES_PATH} tone="inverted" className="sm:ml-5">
            {ABOUT_PAGE.cta.secondaryLabel}
          </TextLink>
        }
      />
    </>
  );
}
