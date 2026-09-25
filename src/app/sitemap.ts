import type { MetadataRoute } from "next";

import { getSiteConfig } from "@/config/env.public";
import {
  ABOUT_PATH,
  CONTACT_PATH,
  SERVICES_PATH,
  treatmentPath,
} from "@/config/navigation";
import { getTreatmentSlugs } from "@/features/services/catalogue";

/**
 * The sitemap.
 *
 * Lists only routes that exist and are meant to be indexed: the home page,
 * the services, about and contact pages, and every treatment page. The
 * practitioners have no pages of their own - their profiles open in a modal
 * on the About page. `/appointments/new` is a
 * temporary "not open yet" interstitial marked `noindex`, `/design-system` is
 * an internal gallery that does not render in production, and `/api/*` is not
 * content.
 *
 * Treatment entries are generated from the catalogue rather than listed by
 * hand, so adding one cannot leave the sitemap behind. Listing a
 * route here that 404s, or one robots has been asked not to index, is a
 * contradiction search engines report as an error.
 *
 * Priorities are relative within this site. The home page leads, the services
 * index is the main entry point for search traffic, and individual treatments
 * sit below both.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteConfig().siteUrl.replace(/\/+$/, "");

  return [
    {
      // `origin`, not `${origin}/`. Phase 20: the home page declares
      // `alternates: { canonical: "/" }`, which Next resolves against
      // `metadataBase` to the bare origin with no trailing slash. Listing the
      // slashed form here meant the sitemap advertised one URL and the page it
      // points at named a different one as canonical - the duplicate-URL
      // disagreement `phase_20.md` sections 178 and 223 ask to be checked for.
      // The two forms serve identical content; what matters is that they agree.
      url: origin,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${origin}${SERVICES_PATH}`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...getTreatmentSlugs().map((slug) => ({
      url: `${origin}${treatmentPath(slug)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${origin}${ABOUT_PATH}`,
      changeFrequency: "yearly" as const,
      priority: 0.8,
    },
    {
      url: `${origin}${CONTACT_PATH}`,
      changeFrequency: "yearly" as const,
      priority: 0.9,
    },
  ];
}
