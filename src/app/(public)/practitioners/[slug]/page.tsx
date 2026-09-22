import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FinalCtaSection } from "@/components/marketing/final-cta";
import { PractitionerProfile } from "@/components/marketing/practitioner-profile";
import { Button } from "@/components/ui/button";
import { getSiteConfig } from "@/config/env.public";
import {
  PRACTITIONERS_PATH,
  practitionerPath,
  CONTACT_PATH,
} from "@/config/navigation";
import {
  getPractitionerBySlug,
  getPractitionerSlugs,
} from "@/features/practitioners/directory";
import {
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/seo/structured-data";

/**
 * A practitioner's profile page.
 *
 * ## What this route does today
 *
 * Nothing renders from it, and that is the correct behaviour. No practitioner
 * has been confirmed for publication, so `getPractitionerSlugs()` is empty,
 * `generateStaticParams` returns no paths, and with `dynamicParams = false`
 * **every** `/practitioners/<anything>` URL is a 404 served by the
 * application's not-found page.
 *
 * A page for a person whose name and qualifications nobody has verified would
 * have nothing true on it. The alternative - a profile reading "name to be
 * confirmed" - is a thin page that adds a URL, a sitemap entry and an
 * indexable document without adding a fact
 * (`docs/implementation-plan/phase_05.md` sections 18-19 and 77).
 *
 * The route, its metadata and `PractitionerProfile` are nonetheless complete
 * and covered by tests against a fixture, so publishing a practitioner is a
 * data change in `features/practitioners/content.ts` and nothing else.
 *
 * ## Why `dynamicParams = false`
 *
 * Phase 04 measured both configurations against a production build and
 * recorded the result in `app/(public)/services/[slug]/page.tsx`: with
 * `dynamicParams` at its default, `notFound()` throws after the streaming
 * shell has flushed and the response is **HTTP 200** with an empty document.
 * A soft 404 on a clinic's practitioner directory tells every crawler the
 * person exists. `false` gives a real 404, served statically.
 *
 * `notFound()` below therefore never fires today. It stays because it is the
 * lock that still holds when the roster becomes database-backed and
 * `generateStaticParams` can no longer enumerate every valid slug.
 *
 * ## Slug handling
 *
 * `getPractitionerBySlug` normalises the URL segment, checks it against a
 * fixed pattern and looks it up in a map built from the **published** subset
 * of the roster. Nothing from the URL is interpolated into anything, and an
 * unpublished person's slug resolves to `undefined` like any other unknown
 * value - so a placeholder cannot be reached by guessing its slug from the
 * listing page's markup (`docs/SECURITY.md` section 9).
 */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getPractitionerSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/practitioners/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const practitioner = getPractitionerBySlug(slug);

  if (!practitioner) {
    return { title: "Practitioner not found", robots: { index: false } };
  }

  const url = practitionerPath(practitioner.slug);
  // Built only from confirmed fields. Where the clinic has supplied no short
  // biography, the description falls back to a statement about the clinic
  // rather than inventing one about the person (`phase_05.md` section 51).
  const description =
    practitioner.shortBio ??
    `${practitioner.name} carries out Ayurvedic consultations at Punarvasu.`;
  const title = practitioner.designation
    ? `${practitioner.name} — ${practitioner.designation}`
    : practitioner.name;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      siteName: "Punarvasu",
      title: `${title} | Punarvasu`,
      description,
      url,
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Punarvasu`,
      description,
    },
  };
}

export default async function PractitionerPage({
  params,
}: PageProps<"/practitioners/[slug]">) {
  const { slug } = await params;
  const practitioner = getPractitionerBySlug(slug);

  if (!practitioner) {
    notFound();
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(getSiteConfig().siteUrl, [
    { name: "Home", path: "/" },
    { name: "Practitioners", path: PRACTITIONERS_PATH },
    { name: practitioner.name, path: practitionerPath(practitioner.slug) },
  ]);

  return (
    <>
      {/*
        Breadcrumbs only, for now. `Person` structured data becomes
        appropriate in the same change that publishes a practitioner, because
        only then is there a verified name, title and credential to put in it
        (`phase_05.md` section 53).
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <PractitionerProfile
        practitioner={practitioner}
        titleId="practitioner-title"
      />

      <FinalCtaSection
        titleId="practitioner-cta-title"
        title={`Consult with ${practitioner.name}`}
        description="A first consultation is a conversation. Tell us what brought you here, and we will arrange a time."
        secondaryAction={
          <Button asChild size="lg" variant="outline">
            <Link href={CONTACT_PATH}>Contact the clinic</Link>
          </Button>
        }
      />
    </>
  );
}
