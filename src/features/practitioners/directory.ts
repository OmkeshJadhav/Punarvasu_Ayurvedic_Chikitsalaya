/**
 * Reading the practitioner directory.
 *
 * Every page goes through this module rather than importing `PRACTITIONERS`
 * and indexing into it — the same seam `features/services/catalogue.ts`
 * establishes, for the same reason: when practitioners become database-backed
 * the signatures stay and no component changes
 * (`docs/implementation-plan/phase_05.md` section 62).
 *
 * ## Slug handling is a security boundary
 *
 * `/practitioners/[slug]` takes a value straight from the URL, so it is
 * untrusted (`docs/SECURITY.md` section 9). This module never interpolates
 * that value into anything. It normalises it, checks it against a fixed
 * pattern, and looks it up in a `Map` built from the **published** subset of
 * the roster — so the only way to get a practitioner back is to name one the
 * clinic has confirmed. There is no query to inject into and no unpublished
 * record to reach by guessing.
 *
 * When this becomes database-backed, that guarantee has to be rebuilt
 * deliberately: the query must filter to published practitioners server-side,
 * under row-level security, rather than selecting by slug alone.
 *
 * ## Why there is no search or filter
 *
 * `phase_05.md` section 22 is explicit: for a clinic with a handful of
 * practitioners, a curated presentation beats a filter. Add one when the
 * roster is large enough that a visitor cannot see it in one eyeful.
 */

import { PRACTITIONERS } from "./content";
import type { Practitioner, PublishedPractitioner } from "./types";
import { isPublished } from "./types";

/** Same shape the services catalogue requires, for the same reasons. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Bounds the work done on a hostile URL before the pattern check runs. */
const MAX_SLUG_LENGTH = 64;

const PUBLISHED: readonly PublishedPractitioner[] =
  PRACTITIONERS.filter(isPublished);

const PUBLISHED_BY_SLUG: ReadonlyMap<string, PublishedPractitioner> = new Map(
  PUBLISHED.map((practitioner) => [practitioner.slug, practitioner]),
);

export function isValidSlugFormat(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value);
}

/**
 * Normalises a slug before it is looked up.
 *
 * Case and surrounding whitespace are forgiven; nothing else is. A value that
 * is not already a well-formed slug is rejected rather than repaired, so
 * `../../etc` and `a%20b` both fail here instead of reaching a lookup.
 */
export function normalizePractitionerSlug(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  return isValidSlugFormat(normalized) ? normalized : undefined;
}

/** The whole roster, including unpublished placeholders, in display order. */
export function getAllPractitioners(): readonly Practitioner[] {
  return PRACTITIONERS;
}

/** Only practitioners the clinic has confirmed. */
export function getPublishedPractitioners(): readonly PublishedPractitioner[] {
  return PUBLISHED;
}

/**
 * `undefined` for anything that is not a published practitioner — including a
 * placeholder's slug. Callers 404.
 */
export function getPractitionerBySlug(
  slug: string,
): PublishedPractitioner | undefined {
  const normalized = normalizePractitionerSlug(slug);
  return normalized ? PUBLISHED_BY_SLUG.get(normalized) : undefined;
}

/**
 * The slugs that have a profile page.
 *
 * Published only, so `generateStaticParams` never prerenders a page for a
 * person whose details are unconfirmed. With no published practitioners this
 * is empty, and every `/practitioners/[slug]` URL is a 404 — which is the
 * correct answer while no profile exists.
 */
export function getPractitionerSlugs(): readonly string[] {
  return PUBLISHED.map((practitioner) => practitioner.slug);
}

/** Whether any roster entry is still awaiting the clinic's confirmation. */
export function hasUnverifiedPractitioners(
  practitioners: readonly Practitioner[] = PRACTITIONERS,
): boolean {
  return practitioners.some((entry) => entry.status !== "published");
}

/**
 * The first few practitioners, for the preview on the About page.
 *
 * Published entries lead, so a confirmed profile is never pushed below a
 * placeholder once the clinic starts publishing them.
 */
export function getPractitionerPreviews(limit = 2): readonly Practitioner[] {
  return [...PUBLISHED, ...PRACTITIONERS.filter((p) => !isPublished(p))].slice(
    0,
    limit,
  );
}

/** A practitioner's display name, or the placeholder heading. */
export function practitionerDisplayName(practitioner: Practitioner): string {
  return isPublished(practitioner) ? practitioner.name : "Practitioner profile";
}
