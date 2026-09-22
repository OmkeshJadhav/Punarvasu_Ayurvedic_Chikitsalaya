import type { MetadataRoute } from "next";

import { getSiteConfig } from "@/config/env.public";
import { isIndexableDeployment } from "@/lib/seo/indexing";

/**
 * Robots policy.
 *
 * Public marketing pages are indexable. Everything that will hold or act on
 * patient data is disallowed up front rather than after the fact: `/api`,
 * the patient portal and the staff workspaces are excluded here before those
 * routes exist, so no future phase has to remember to exclude them.
 *
 * The authentication routes are excluded too. A sign-in form is not a useful
 * search result, and a reset link pasted somewhere public should not be
 * crawled. Every auth page also carries `robots: noindex` in its metadata,
 * because a crawler that ignores this file still reads that.
 *
 * This is a crawler instruction, not an access control. The routes themselves
 * are protected by authentication and row-level security — `docs/SECURITY.md`
 * and `phase_06.md` section 96.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = getSiteConfig().siteUrl.replace(/\/+$/, "");

  // Phase 20. A preview or staging deployment serves the same pages on a
  // different origin, and an indexed one competes with production for the
  // clinic's own search results (`phase_20.md` sections 180 and 182). It is
  // excluded whole rather than route by route, and no sitemap is advertised -
  // pointing a crawler at a list of URLs it has just been told not to fetch is
  // a contradiction search engines report as an error.
  //
  // `lib/seo/indexing.ts` carries the reasoning, including the failure mode
  // when `APP_ENV` is not set on a production deployment.
  if (!isIndexableDeployment()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/account",
        "/appointments/",
        "/patient/",
        "/portal/",
        "/dashboard/",
        "/staff/",
        "/receptionist",
        "/receptionist/",
        "/doctor",
        "/doctor/",
        "/admin",
        "/admin/",
        "/notifications",
        "/notifications/",
        "/forbidden",
        "/design-system",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
