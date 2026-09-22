/**
 * Where a notification points.
 *
 * ## A link is not an authorization mechanism
 *
 * `phase_15.md` sections 18, 84 and 85, and example 8. A notification link
 * identifies a resource. It grants nothing, expires never because it confers
 * nothing, and the destination re-authenticates and re-authorizes on every
 * request — which is not a promise this module makes, it is what
 * `/patient/appointments/[id]` and its siblings already do, behind
 * `requireUser()` and row-level security.
 *
 * Patient A following patient B's link reaches the same not-found state as
 * patient A guessing an id, because there is nothing else the page *can* say:
 * row-level security means the row is simply absent.
 *
 * ## The path is derived, never accepted
 *
 * Section 19. There is no notification payload field that carries a URL. The
 * database builds the path in `public.notification_link_path()` from the
 * resource type and id, a check constraint refuses anything that is not an
 * application-relative path under a known area, and this module is the same
 * function in TypeScript so the application can predict what the database
 * will store. `links.test.ts` reads the migration and asserts the two agree.
 *
 * ## Why these three routes
 *
 * Every recipient today is a patient, so every path is under `/patient`. Staff
 * notifications are deferred (section 56 asks for useful workflows rather than
 * every database event), and the day they arrive they bring their own routes
 * and their own branch here — and in the SQL, together, or the test fails.
 */

import type { NotificationSubjectType } from "./types";

/**
 * The application route a notification about this resource points at.
 *
 * Mirrors `public.notification_link_path()`. The id is interpolated without
 * escaping because it is a `uuid` column on both sides of the boundary — the
 * database's parameter type is `uuid`, so a value that is not one never
 * reaches the string.
 */
export function notificationLinkPath(
  resourceType: NotificationSubjectType,
  resourceId: string,
): string {
  switch (resourceType) {
    case "appointment":
      return `/patient/appointments/${resourceId}`;
    case "prescription":
      return `/patient/prescriptions/${resourceId}`;
    case "treatment_plan":
      return `/patient/treatment-plans/${resourceId}`;
  }
}

/**
 * The absolute URL an email's action button points at.
 *
 * Built from configuration — `NEXT_PUBLIC_SITE_URL` — and never from a
 * request's `Host` header. Reading the origin off the request is the obvious
 * way to make links work across localhost, previews and production, and it is
 * host header injection: it would let somebody make the clinic's own mail
 * reach a patient carrying a link to another host. Phase 06 recorded the same
 * reasoning for authentication email and this follows it.
 */
export function notificationActionUrl(
  siteUrl: string,
  linkPath: string,
): string {
  return `${siteUrl.replace(/\/+$/, "")}${linkPath}`;
}
