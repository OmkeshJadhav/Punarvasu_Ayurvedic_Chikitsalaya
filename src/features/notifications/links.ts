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
 * ## Two audiences, four routes
 *
 * A patient's notification points into `/patient`; a practitioner's points at
 * `/doctor/appointments/<id>`, their own diary entry. Both destinations existed
 * before notifications did and both authorize independently, which is the whole
 * reason a link may name a resource at all.
 *
 * A practitioner has no prescription or treatment-plan route here, and returns
 * `null` for both. That is not an omission: those are documents the
 * practitioner wrote, and telling somebody they have issued the prescription
 * they just issued is the noise section 56 exists to prevent. `null` means
 * "this audience is not told about this resource", and the database raises
 * rather than storing an empty path.
 */

import type { NotificationAudience, NotificationSubjectType } from "./types";

/**
 * The application route a notification about this resource points at.
 *
 * Mirrors `public.notification_link_path()`, including its nulls. The id is
 * interpolated without escaping because it is a `uuid` column on both sides of
 * the boundary — the database's parameter type is `uuid`, so a value that is
 * not one never reaches the string.
 */
export function notificationLinkPath(
  audience: NotificationAudience,
  resourceType: NotificationSubjectType,
  resourceId: string,
): string | null {
  if (audience === "practitioner") {
    return resourceType === "appointment"
      ? `/doctor/appointments/${resourceId}`
      : null;
  }

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
