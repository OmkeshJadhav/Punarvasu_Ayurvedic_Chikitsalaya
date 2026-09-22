import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { FinalCtaSection } from "@/components/marketing/final-cta";
import { PageHero } from "@/components/marketing/page-hero";
import { PractitionerGrid } from "@/components/marketing/practitioner-grid";
import { ProseSection } from "@/components/marketing/prose-section";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSiteConfig } from "@/config/env.public";
import {
  ABOUT_PATH,
  CONTACT_PATH,
  PRACTITIONERS_PATH,
  PRIMARY_CTA,
} from "@/config/navigation";
import {
  PRACTITIONERS_PAGE,
  PRACTITIONERS_SECTIONS,
} from "@/features/practitioners/content";
import {
  getAllPractitioners,
  hasUnverifiedPractitioners,
} from "@/features/practitioners/directory";
import {
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/seo/structured-data";

/**
 * The practitioners page.
 *
 * ## Content status - the important part
 *
 * **Punarvasu has not confirmed any practitioner's name, qualification or
 * registration for publication.** This page therefore names nobody. It shows
 * the roster's placeholder cards, marked as placeholders, above a notice that
 * says in plain language why they are blank and what to do instead
 * (`docs/implementation-plan/phase_05.md` sections 17-18, 21 and 77).
 *
 * That is a deliberate product decision, not an unfinished one. A page of
 * stock portraits captioned with invented credentials is the single most
 * damaging thing an Ayurvedic clinic's website could publish, and a visitor
 * who is told the truth can act on it - the clinic's phone number is one
 * click away.
 *
 * Publishing a practitioner is a data change in
 * `features/practitioners/content.ts`: the card fills in, the profile page
 * starts existing, `generateStaticParams` picks it up and the sitemap follows.
 * No component changes.
 *
 * ## No search, no filter
 *
 * `phase_05.md` section 22 is explicit that a small roster is better served
 * by a curated presentation. Nothing here is hidden behind a control.
 *
 * ## Rendering
 *
 * Fully static, every section a server component.
 */
export const metadata: Metadata = {
  title: "Our Practitioners",
  description:
    "The practitioners who carry out Ayurvedic consultations at Punarvasu, and the method every one of them follows.",
  alternates: { canonical: PRACTITIONERS_PATH },
  openGraph: {
    type: "website",
    siteName: "Punarvasu",
    title: "Our Practitioners | Punarvasu",
    description:
      "The practitioners who carry out Ayurvedic consultations at Punarvasu, and the method every one of them follows.",
    url: PRACTITIONERS_PATH,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Practitioners | Punarvasu",
    description:
      "The practitioners who carry out Ayurvedic consultations at Punarvasu.",
  },
};

export default function PractitionersPage() {
  const practitioners = getAllPractitioners();
  const unverified = hasUnverifiedPractitioners();

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(getSiteConfig().siteUrl, [
    { name: "Home", path: "/" },
    { name: "Practitioners", path: PRACTITIONERS_PATH },
  ]);

  return (
    <>
      {/*
        Breadcrumbs only. `Person` structured data is deliberately not emitted:
        it exists to carry a name, a job title and credentials, which is
        exactly what has not been verified here. A search engine republishes
        what it finds with the clinic's name attached, so it gets nothing
        until a practitioner is confirmed (`phase_05.md` section 53).
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <PageHero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Practitioners" }]}
        eyebrow={PRACTITIONERS_PAGE.hero.eyebrow}
        title={PRACTITIONERS_PAGE.hero.title}
        titleId="practitioners-title"
        description={PRACTITIONERS_PAGE.hero.description}
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
              <Link href={CONTACT_PATH}>Contact the clinic</Link>
            </Button>
          </>
        }
      />

      <Section
        id={PRACTITIONERS_SECTIONS.roster}
        aria-labelledby="practitioners-roster-title"
        className="anchor-offset bg-background"
      >
        <Container width="wide">
          <SectionHeader
            titleId="practitioners-roster-title"
            eyebrow={PRACTITIONERS_PAGE.roster.eyebrow}
            title={PRACTITIONERS_PAGE.roster.title}
            description={PRACTITIONERS_PAGE.roster.description}
          />

          {unverified ? (
            <Alert
              tone="info"
              title={PRACTITIONERS_PAGE.unpublishedNotice.title}
              className="mt-8"
            >
              {PRACTITIONERS_PAGE.unpublishedNotice.body}
            </Alert>
          ) : null}

          <PractitionerGrid
            practitioners={practitioners}
            className="mt-10 lg:mt-12"
            emptyAction={
              <Button asChild>
                <Link href={CONTACT_PATH}>Contact the clinic</Link>
              </Button>
            }
          />
        </Container>
      </Section>

      <ProseSection
        id={PRACTITIONERS_SECTIONS.working}
        titleId="practitioners-working-title"
        eyebrow={PRACTITIONERS_PAGE.working.eyebrow}
        title={PRACTITIONERS_PAGE.working.title}
        paragraphs={PRACTITIONERS_PAGE.working.paragraphs}
        surface="muted"
        link={{
          href: `${ABOUT_PATH}#approach`,
          label: PRACTITIONERS_PAGE.working.approachLinkLabel,
        }}
      />

      <FinalCtaSection
        titleId="practitioners-cta-title"
        title={PRACTITIONERS_PAGE.cta.title}
        description={PRACTITIONERS_PAGE.cta.description}
        secondaryAction={
          <Button asChild size="lg" variant="outline">
            <Link href={CONTACT_PATH}>
              {PRACTITIONERS_PAGE.cta.secondaryLabel}
            </Link>
          </Button>
        }
      />
    </>
  );
}
