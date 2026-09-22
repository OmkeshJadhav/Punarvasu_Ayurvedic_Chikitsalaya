import type { AnalyticsRange } from "@/features/analytics/types";

/**
 * Small shared helpers for the analytics routes.
 *
 * Both live here rather than being retyped on three pages, because both are
 * the sort of thing that is written slightly differently the third time.
 */

/**
 * A link back to this page with the current period preserved.
 *
 * Used for "refresh" and for the retry on a failed panel. It carries the
 * **resolved** period rather than the requested one, so a retry after a
 * rejected range asks for the period the page actually showed instead of
 * repeating the mistake.
 */
export function analyticsHref(
  basePath: string,
  range: AnalyticsRange,
  practitionerId?: string,
): string {
  const params = new URLSearchParams({
    preset: "custom",
    from: range.from,
    to: range.to,
  });

  if (practitionerId) params.set("practitionerId", practitionerId);

  return `${basePath}?${params.toString()}`;
}

/**
 * One value from a search parameter.
 *
 * Next.js gives `string | string[] | undefined`. A repeated parameter is
 * discarded entirely rather than having its first value taken: two copies is
 * a smuggling attempt rather than something a person does, and it is the same
 * rule `lib/auth/redirect.ts` applies to `next` and the front desk applies to
 * its schedule filters.
 */
export function readParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
