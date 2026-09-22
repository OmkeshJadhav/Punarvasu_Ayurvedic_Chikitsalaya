import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { BrandNameSection } from "@/components/marketing/brand-name-section";
import { FinalCtaSection } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PractitionerGrid } from "@/components/marketing/practitioner-grid";
import { ProcessSteps } from "@/components/marketing/process-steps";
import { ProseSection } from "@/components/marketing/prose-section";
import { StatementList } from "@/components/marketing/statement-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSiteConfig } from "@/config/env.public";
import { HOME_SECTIONS } from "@/config/marketing-content";
import {
  ABOUT_PATH,
  CONTACT_PATH,
  PRACTITIONERS_PATH,
  PRIMARY_CTA,
  SERVICES_PATH,
  homeSectionHref,
} from "@/config/navigation";
import {
  ABOUT_PAGE,
  ABOUT_REVIEW_NOTICE,
  ABOUT_SECTIONS,
} from "@/features/about/content";
import { ABOUT_IMAGES } from "@/config/images";
import { getPractitionerPreviews } from "@/features/practitioners/directory";
import type { Practitioner } from "@/features/practitioners/types";
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
 * So the page is: what the name means, why the clinic exists, what it
 * believes, how a consultation is actually conducted, four things it will
 * refuse to do, where it is, and who works there.
 *
 * ## Content status
 *
 * Punarvasu has not supplied its founding story, so the page contains none
 * and `ABOUT_REVIEW_NOTICE` says so in the open rather than in a source
 * comment - the pattern Phase 04 established for unreviewed content.
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

      <PageHero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        eyebrow={ABOUT_PAGE.hero.eyebrow}
        title={ABOUT_PAGE.hero.title}
        titleId="about-title"
        description={ABOUT_PAGE.hero.description}
        image={ABOUT_IMAGES.hero}
        actions={
          <>
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
              <Link href={`#${ABOUT_SECTIONS.approach}`}>How we practise</Link>
            </Button>
          </>
        }
      />

      <div className="bg-background border-border border-b">
        <Container width="wide" className="py-6">
          <Alert tone="info" title={ABOUT_REVIEW_NOTICE.title}>
            {ABOUT_REVIEW_NOTICE.body}
          </Alert>
        </Container>
      </div>

      <BrandNameSection />

      <ProseSection
        id={ABOUT_SECTIONS.purpose}
        titleId="about-purpose-title"
        eyebrow={ABOUT_PAGE.purpose.eyebrow}
        title={ABOUT_PAGE.purpose.title}
        paragraphs={ABOUT_PAGE.purpose.paragraphs}
      />

      <ProseSection
        id={ABOUT_SECTIONS.beliefs}
        titleId="about-beliefs-title"
        eyebrow={ABOUT_PAGE.beliefs.eyebrow}
        title={ABOUT_PAGE.beliefs.title}
        paragraphs={ABOUT_PAGE.beliefs.paragraphs}
        surface="muted"
      >
        <StatementList statements={ABOUT_PAGE.beliefs.principles} />
      </ProseSection>

      <ApproachSection />

      <CommitmentsSection />

      <ProseSection
        id={ABOUT_SECTIONS.clinic}
        titleId="about-clinic-title"
        eyebrow={ABOUT_PAGE.clinic.eyebrow}
        title={ABOUT_PAGE.clinic.title}
        paragraphs={ABOUT_PAGE.clinic.paragraphs}
        surface="muted"
        link={{ href: CONTACT_PATH, label: ABOUT_PAGE.clinic.linkLabel }}
      />

      <PractitionersSection practitioners={practitioners} />

      <FinalCtaSection
        titleId="about-cta-title"
        title={ABOUT_PAGE.cta.title}
        description={ABOUT_PAGE.cta.description}
        secondaryAction={
          <Button asChild size="lg" variant="outline">
            <Link href={SERVICES_PATH}>{ABOUT_PAGE.cta.secondaryLabel}</Link>
          </Button>
        }
      />
    </>
  );
}

/**
 * How a consultation is conducted.
 *
 * `timeline` rather than the home page's `row`: six steps across a row give
 * each one a four-word column, and this is a sequence to be read rather than
 * a progress bar to be glanced at.
 */
function ApproachSection() {
  return (
    <Section
      id={ABOUT_SECTIONS.approach}
      aria-labelledby="about-approach-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              titleId="about-approach-title"
              eyebrow={ABOUT_PAGE.approach.eyebrow}
              title={ABOUT_PAGE.approach.title}
              description={ABOUT_PAGE.approach.description}
            />

            <Button asChild variant="outline" className="mt-7">
              <Link href={homeSectionHref(HOME_SECTIONS.journey)}>
                {ABOUT_PAGE.approach.journeyLinkLabel}
              </Link>
            </Button>
          </div>

          <div className="lg:col-span-7">
            <ProcessSteps
              steps={ABOUT_PAGE.approach.steps}
              layout="timeline"
              headingLevel="h3"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}

/**
 * The differentiators, stated as refusals.
 *
 * Centred heading and a two-column list, so the section reads as a statement
 * rather than as another two-column editorial block; three consecutive
 * heading-left layouts would make the page a rhythm rather than an argument.
 */
function CommitmentsSection() {
  return (
    <Section
      id={ABOUT_SECTIONS.commitments}
      aria-labelledby="about-commitments-title"
      className="anchor-offset bg-secondary border-border border-y"
    >
      <Container width="wide">
        <SectionHeader
          titleId="about-commitments-title"
          align="center"
          eyebrow={ABOUT_PAGE.commitments.eyebrow}
          title={ABOUT_PAGE.commitments.title}
          description={ABOUT_PAGE.commitments.description}
        />

        <StatementList
          statements={ABOUT_PAGE.commitments.items}
          className="mt-10 lg:mt-14"
        />
      </Container>
    </Section>
  );
}

function PractitionersSection({
  practitioners,
}: {
  readonly practitioners: readonly Practitioner[];
}) {
  return (
    <Section
      id={ABOUT_SECTIONS.practitioners}
      aria-labelledby="about-practitioners-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <SectionHeader
          titleId="about-practitioners-title"
          align="center"
          eyebrow={ABOUT_PAGE.practitioners.eyebrow}
          title={ABOUT_PAGE.practitioners.title}
          description={ABOUT_PAGE.practitioners.description}
        />

        <PractitionerGrid
          practitioners={practitioners}
          className="mt-10 lg:mt-14"
        />

        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link href={PRACTITIONERS_PATH}>
              {ABOUT_PAGE.practitioners.linkLabel}
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
