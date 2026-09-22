import "server-only";

import { getServerEnv } from "@/config/env.server";

/**
 * Whether this deployment may be indexed by search engines.
 *
 * ## The problem this solves
 *
 * `phase_20.md` sections 180 and 182 require that a preview or staging
 * deployment must not compete with production in search results. Until Phase
 * 20 nothing stopped it: `app/robots.ts` returned `allow: "/"` unconditionally
 * and the root layout declared `robots: { index: true }`, so any deployment
 * that got a public URL - a Vercel preview, a staging host - was as indexable
 * as production and served the same content. Duplicate content on a second
 * origin is the outcome, and the clinic's own pages compete with themselves.
 *
 * ## Why `APP_ENV` and not `NODE_ENV`
 *
 * `NODE_ENV` cannot answer this question. Next.js sets it to `production` for
 * anything built with `next build`, which is exactly what a preview deployment
 * is. `lib/security/cookies.ts` reads `NODE_ENV` for a different question -
 * "is this the dev server, where `Secure` cookies and HSTS would break
 * things?" - and that is the right signal there and the wrong one here.
 *
 * `APP_ENV` is the deployment's own declaration of what it is.
 * `APP_ENVIRONMENTS` has carried `preview` since Phase 01 for this purpose.
 *
 * ## The failure mode, stated rather than hidden
 *
 * `appEnv` defaults to `development`, so **a production deployment that does
 * not set `APP_ENV=production` will tell search engines not to index it.**
 * That is a real and quiet way to lose a clinic its search presence, and it is
 * the deliberate direction to fail in: a preview that is wrongly indexed
 * pollutes results for everyone and is discovered late, while a production
 * site that is wrongly excluded is caught by the very first check of
 * `/robots.txt`.
 *
 * The mitigation is a deployment step, not a code change: `APP_ENV` must be
 * set on the production environment. It already has to be, for reasons that
 * predate this module - `scripts/seed-dev-accounts.mjs` refuses to create the
 * shared test accounts when it is `production`. This is recorded in
 * `docs/SECURITY.md` section 36's deployment checklist.
 */
export function isIndexableDeployment(): boolean {
  return getServerEnv().appEnv === "production";
}
