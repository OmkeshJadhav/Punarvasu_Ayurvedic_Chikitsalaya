import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FinalCtaSection } from "@/components/marketing/final-cta";
import { RelatedTreatments } from "@/components/marketing/related-treatments";
import { TreatmentArticle } from "@/components/marketing/treatment-article";
import { TreatmentHero } from "@/components/marketing/treatment-hero";
import { Button } from "@/components/ui/button";
import { getSiteConfig } from "@/config/env.public";
import { SERVICES_PATH, treatmentPath } from "@/config/navigation";
import {
  getCategory,
  getRelatedTreatments,
  getTreatmentBySlug,
  getTreatmentSlugs,
} from "@/features/services/catalogue";
import {
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/seo/structured-data";

/**
 * A treatment page.
 *
 * ## Slug handling
 *
 * `getTreatmentBySlug` normalises the URL segment, checks it against a fixed
 * pattern and then looks it up in a map built from the catalogue. Nothing
 * from the URL is interpolated into anything, there is no query to inject
 * into, and the only reachable records are public treatments
 * (`docs/SECURITY.md` section 9,
 * `docs/implementation-plan/phase_04.md` sections 61-62). An unknown slug
 * gets `notFound()`, which is a 404 status and the treatment-specific
 * not-found page beside this file.
 *
 * ## Why `dynamicParams = false`
 *
 * Both configurations were built and measured against a production server,
 * because the choice is not obvious:
 *
 *   `dynamicParams = false` — `/services/nope` returns **404** with the
 *   application-wide not-found page, served statically.
 *
 *   default (`true`) — the request reaches this component, `notFound()`
 *   throws after the streaming shell has already been flushed, and the
 *   response is **HTTP 200** with an essentially empty document whose content
 *   arrives only in the flight payload. A treatment-specific not-found page
 *   rendered, but no crawler would ever see it and the status told every one
 *   of them the page exists.
 *
 * A soft 404 on a healthcare site's catalogue is worse than a plain one, so
 * the status wins and the richer page is not built. The cost is real and is
 * recorded as a known issue: the application-wide 404 sits above the
 * `(public)` route group, so it carries no header, navigation or footer.
 * Giving the public group its own chrome-bearing not-found boundary is the
 * fix, and it belongs to whichever phase revisits the 404 for the whole site.
 *
 * `notFound()` below therefore never fires today. It stays because it is the
 * lock that still holds when the catalogue becomes database-backed and
 * `generateStaticParams` can no longer enumerate every valid slug.
 *
 * ## Rendering
 *
 * Fully static: seven pages prerendered at build time, no data fetching, and
 * therefore nothing that can fail at request time. Only the FAQ disclosures
 * are client components.
 */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getTreatmentSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const treatment = getTreatmentBySlug(slug);

  if (!treatment) {
    // A slug with no treatment renders the not-found boundary; giving it a
    // real title here would be describing a page that does not exist.
    return { title: "Treatment not found", robots: { index: false } };
  }

  const url = treatmentPath(treatment.slug);
  // The summary is written to read correctly out of context precisely so it
  // can serve as the description without a second, drifting copy of it.
  const description = treatment.summary;

  return {
    title: treatment.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: "Punarvasu",
      title: `${treatment.name} | Punarvasu`,
      description,
      url,
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: `${treatment.name} | Punarvasu`,
      description,
    },
  };
}

export default async function TreatmentPage({
  params,
}: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const treatment = getTreatmentBySlug(slug);

  if (!treatment) {
    notFound();
  }

  const category = getCategory(treatment.categoryId);
  const related = getRelatedTreatments(treatment);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(getSiteConfig().siteUrl, [
    { name: "Home", path: "/" },
    { name: "Services", path: SERVICES_PATH },
    { name: treatment.name, path: treatmentPath(treatment.slug) },
  ]);

  return (
    <>
      {/*
        Breadcrumbs only. A treatment page emits no medical structured data
        while its copy is unreviewed - see `buildBreadcrumbJsonLd`. The
        payload is developer-authored configuration and `serializeJsonLd`
        escapes `<`, so no value can close this tag.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(breadcrumbJsonLd),
        }}
      />

      <TreatmentHero
        treatment={treatment}
        category={category}
        titleId="treatment-title"
      />

      <TreatmentArticle treatment={treatment} />

      <RelatedTreatments treatments={related} />

      <FinalCtaSection
        titleId="treatment-cta-title"
        title="Find out whether this is right for you"
        description="This page can tell you what the therapy is. Only a consultation can tell you whether it suits you — and that conversation is where every plan at Punarvasu starts."
        secondaryAction={
          <Button asChild size="lg" variant="outline">
            <Link href={SERVICES_PATH}>View all services</Link>
          </Button>
        }
      />
    </>
  );
}
