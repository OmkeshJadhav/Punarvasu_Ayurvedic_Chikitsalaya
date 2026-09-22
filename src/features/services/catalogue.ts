/**
 * Reading the treatment catalogue.
 *
 * Every page goes through this module rather than importing `TREATMENTS` and
 * indexing into it. That is the seam a later phase replaces with database or
 * CMS reads: the function signatures stay, the bodies become queries, and no
 * component changes (`docs/implementation-plan/phase_04.md` sections 40 and
 * 64).
 *
 * ## Slug handling is a security boundary
 *
 * `/services/[slug]` takes a value straight from the URL, so it is untrusted
 * (`docs/SECURITY.md` section 9). This module never interpolates that value
 * into anything. It normalises it, checks it against a fixed pattern, and then
 * looks it up in a `Map` built from the catalogue - so the only way to get a
 * `Treatment` back is to name one that exists. There is no query to inject
 * into and no record outside the public catalogue to reach.
 *
 * When the catalogue becomes database-backed, that guarantee has to be
 * rebuilt deliberately: the query must filter to published, public treatments
 * server-side, under row-level security, rather than selecting by slug alone
 * (`phase_04.md` section 62).
 *
 * ## Why there is no search or filter API here
 *
 * Seven treatments in three groups all fit on one screen-and-a-bit, so
 * narrowing them costs the visitor more than it saves. Add `searchTreatments`
 * - and the client island to drive it - when the catalogue passes roughly a
 * dozen entries, or when a category grows past what one eyeful can scan.
 */

import { TREATMENT_CATEGORIES, TREATMENTS } from "./content";
import type {
  Treatment,
  TreatmentCategory,
  TreatmentCategoryId,
} from "./types";

/**
 * The shape a slug must have before it is worth looking up: lowercase
 * alphanumerics in hyphen-separated groups, no leading, trailing or doubled
 * hyphens.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Bounds the work done on a hostile URL before the pattern check runs. */
const MAX_SLUG_LENGTH = 64;

const TREATMENTS_BY_SLUG: ReadonlyMap<string, Treatment> = new Map(
  TREATMENTS.map((treatment) => [treatment.slug, treatment]),
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
 *
 * Measured routing behaviour against a production build, for the record:
 * `/services/SHIRODHARA` resolves to the prerendered lowercase page and its
 * canonical link points at `/services/shirodhara`, so a case variant is not a
 * duplicate document; `/services/does-not-exist` is a 404. The tolerance here
 * is a data-boundary guard rather than the thing that makes either true, and
 * it is what keeps this function correct for the callers a database-backed
 * catalogue will add.
 */
export function normalizeTreatmentSlug(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  return isValidSlugFormat(normalized) ? normalized : undefined;
}

export function getAllTreatments(): readonly Treatment[] {
  return TREATMENTS;
}

/** `undefined` for anything that is not a published treatment. Callers 404. */
export function getTreatmentBySlug(slug: string): Treatment | undefined {
  const normalized = normalizeTreatmentSlug(slug);
  return normalized ? TREATMENTS_BY_SLUG.get(normalized) : undefined;
}

export function getTreatmentSlugs(): readonly string[] {
  return TREATMENTS.map((treatment) => treatment.slug);
}

export function getCategories(): readonly TreatmentCategory[] {
  return TREATMENT_CATEGORIES;
}

export function getCategory(
  id: TreatmentCategoryId,
): TreatmentCategory | undefined {
  return TREATMENT_CATEGORIES.find((category) => category.id === id);
}

export interface TreatmentGroup {
  readonly category: TreatmentCategory;
  readonly treatments: readonly Treatment[];
}

/**
 * The catalogue grouped for display, in category order.
 *
 * A category with nothing in it is dropped rather than rendered as a heading
 * over an empty grid (`phase_04.md` section 60).
 */
export function getTreatmentsByCategory(): readonly TreatmentGroup[] {
  return TREATMENT_CATEGORIES.map((category) => ({
    category,
    treatments: TREATMENTS.filter(
      (treatment) => treatment.categoryId === category.id,
    ),
  })).filter((group) => group.treatments.length > 0);
}

export function getFeaturedTreatments(): readonly Treatment[] {
  return TREATMENTS.filter((treatment) => treatment.featured === true);
}

/**
 * Related treatments — **content navigation, never a medical recommendation**
 * (`phase_04.md` sections 33-34).
 *
 * The relationship is editorial and static: the curated `relatedSlugs` first,
 * then others from the same category to fill the row. Nothing about the
 * visitor is considered, because nothing about the visitor is known, and a
 * "because you viewed X" relationship on a healthcare site reads as clinical
 * advice whatever the heading above it says.
 *
 * A slug that does not resolve is skipped here and fails the catalogue test,
 * so a typo cannot ship as a missing card.
 */
export function getRelatedTreatments(
  treatment: Treatment,
  limit = 3,
): readonly Treatment[] {
  const related: Treatment[] = [];
  const seen = new Set<string>([treatment.slug]);

  const consider = (candidate: Treatment | undefined): void => {
    if (!candidate || seen.has(candidate.slug) || related.length >= limit) {
      return;
    }
    seen.add(candidate.slug);
    related.push(candidate);
  };

  for (const slug of treatment.relatedSlugs ?? []) {
    consider(TREATMENTS_BY_SLUG.get(slug));
  }

  for (const candidate of TREATMENTS) {
    if (candidate.categoryId === treatment.categoryId) {
      consider(candidate);
    }
  }

  return related;
}

/** Whether any catalogue content is still awaiting a practitioner's sign-off. */
export function hasUnreviewedContent(
  treatments: readonly Treatment[] = TREATMENTS,
): boolean {
  return treatments.some((treatment) => treatment.reviewStatus !== "verified");
}

/**
 * The anchor id for a category's section on `/services`.
 *
 * Lives here rather than in a component so the jump rail and the section it
 * targets are generated from one function and cannot drift apart. A test
 * asserts that every rail target exists in the rendered page.
 */
export function categoryAnchorId(categoryId: TreatmentCategoryId): string {
  return `category-${categoryId}`;
}
