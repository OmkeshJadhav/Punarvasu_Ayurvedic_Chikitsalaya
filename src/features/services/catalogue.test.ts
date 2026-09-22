import { describe, expect, it } from "vitest";

import { treatmentPath } from "@/config/navigation";

import {
  categoryAnchorId,
  getAllTreatments,
  getCategories,
  getCategory,
  getFeaturedTreatments,
  getRelatedTreatments,
  getTreatmentBySlug,
  getTreatmentSlugs,
  getTreatmentsByCategory,
  hasUnreviewedContent,
  isValidSlugFormat,
  normalizeTreatmentSlug,
} from "./catalogue";

/**
 * Catalogue integrity and slug safety.
 *
 * Two jobs. The first is to make a broken catalogue fail here rather than as
 * a dead card on a treatment page: a duplicate slug, an unresolvable related
 * treatment, a category nothing belongs to. The second is to hold the slug
 * boundary, which is where an untrusted URL segment meets the data layer.
 */

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("treatment catalogue", () => {
  const treatments = getAllTreatments();

  it("publishes at least one treatment", () => {
    expect(treatments.length).toBeGreaterThan(0);
  });

  it("gives every treatment a URL-safe, unique slug", () => {
    const slugs = treatments.map((treatment) => treatment.slug);

    for (const slug of slugs) {
      expect(slug, `"${slug}" is not a well-formed slug`).toMatch(SLUG_SHAPE);
    }
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every treatment a name, a summary and an overview", () => {
    for (const treatment of treatments) {
      expect(treatment.name.length, treatment.slug).toBeGreaterThan(2);
      // The summary doubles as the page's meta description, so it has to be
      // a sentence rather than a label.
      expect(treatment.summary.length, treatment.slug).toBeGreaterThan(40);
      expect(treatment.content.overview.length, treatment.slug).toBeGreaterThan(
        0,
      );
    }
  });

  it("assigns every treatment to a category that exists", () => {
    const categoryIds = new Set(getCategories().map((category) => category.id));

    for (const treatment of treatments) {
      expect(categoryIds.has(treatment.categoryId), treatment.slug).toBe(true);
      expect(getCategory(treatment.categoryId)).toBeDefined();
    }
  });

  it("describes every photograph it uses", () => {
    for (const treatment of treatments) {
      if (!treatment.image) {
        continue;
      }
      // A treatment photograph is informative, never decorative: it shows
      // what the therapy looks like, which is the whole reason it is there.
      expect(
        treatment.image.alt.length,
        `${treatment.slug} has an image with no alt text`,
      ).toBeGreaterThan(20);
      expect(treatment.image.width).toBeGreaterThan(0);
      expect(treatment.image.height).toBeGreaterThan(0);
    }
  });

  it("resolves every curated related slug", () => {
    for (const treatment of treatments) {
      for (const slug of treatment.relatedSlugs ?? []) {
        expect(
          getTreatmentBySlug(slug),
          `${treatment.slug} relates to "${slug}", which does not exist`,
        ).toBeDefined();
        expect(
          slug,
          `${treatment.slug} lists itself as a related treatment`,
        ).not.toBe(treatment.slug);
      }
    }
  });

  it("marks unreviewed content as unreviewed", () => {
    // Every treatment is development content until a practitioner signs it
    // off. If this ever fails, the UI's review notice has stopped showing for
    // copy nobody has approved — check the content, not the test.
    expect(hasUnreviewedContent()).toBe(true);
  });
});

describe("getTreatmentBySlug", () => {
  it("returns the treatment for a known slug", () => {
    const slug = getTreatmentSlugs()[0];
    expect(slug).toBeDefined();
    expect(getTreatmentBySlug(slug as string)?.slug).toBe(slug);
  });

  // A data-boundary guard. Routing also tolerates a case variant - it
  // resolves to the prerendered lowercase page, whose canonical link points
  // back at the lowercase URL - but that is Next's matching, not this
  // function. See the note on `normalizeTreatmentSlug`.
  it("forgives case and surrounding whitespace at the data boundary", () => {
    expect(getTreatmentBySlug("  Shirodhara ")?.slug).toBe("shirodhara");
  });

  it.each([
    ["unknown-treatment", "a slug nobody published"],
    ["../../etc/passwd", "path traversal"],
    ["shirodhara/../panchakarma", "traversal inside a known slug"],
    ["shiro dhara", "a space"],
    ["<script>", "markup"],
    ["shirodhara'; drop table treatments;--", "SQL-shaped input"],
    ["", "an empty segment"],
    ["-shirodhara", "a leading hyphen"],
    ["shirodhara-", "a trailing hyphen"],
    ["shiro--dhara", "a doubled hyphen"],
  ])("returns undefined for %s (%s)", (input) => {
    expect(getTreatmentBySlug(input)).toBeUndefined();
  });

  it("rejects an absurdly long slug without scanning all of it", () => {
    expect(getTreatmentBySlug("a".repeat(5000))).toBeUndefined();
  });
});

describe("slug validation", () => {
  it("accepts every published slug", () => {
    for (const slug of getTreatmentSlugs()) {
      expect(isValidSlugFormat(slug)).toBe(true);
    }
  });

  it("normalises only case and whitespace, never structure", () => {
    expect(normalizeTreatmentSlug(" ABHYANGA ")).toBe("abhyanga");
    // Not repaired into something valid — rejected.
    expect(normalizeTreatmentSlug("abhyanga!")).toBeUndefined();
  });

  it("builds a path only from a validated slug", () => {
    for (const slug of getTreatmentSlugs()) {
      expect(treatmentPath(slug)).toBe(`/services/${slug}`);
    }
  });
});

describe("getTreatmentsByCategory", () => {
  it("returns groups in category order, with no empty group", () => {
    const groups = getTreatmentsByCategory();
    const order = getCategories().map((category) => category.id);
    const returned = groups.map((group) => group.category.id);

    expect(returned).toEqual(order.filter((id) => returned.includes(id)));
    for (const group of groups) {
      expect(group.treatments.length).toBeGreaterThan(0);
    }
  });

  it("places every treatment in exactly one group", () => {
    const grouped = getTreatmentsByCategory().flatMap(
      (group) => group.treatments,
    );

    expect(grouped).toHaveLength(getAllTreatments().length);
    expect(new Set(grouped.map((treatment) => treatment.slug)).size).toBe(
      grouped.length,
    );
  });

  it("derives a stable anchor id per category", () => {
    for (const category of getCategories()) {
      expect(categoryAnchorId(category.id)).toBe(`category-${category.id}`);
    }
  });
});

describe("getRelatedTreatments", () => {
  const treatments = getAllTreatments();

  it("never returns the treatment itself", () => {
    for (const treatment of treatments) {
      const related = getRelatedTreatments(treatment);
      expect(related.map((item) => item.slug)).not.toContain(treatment.slug);
    }
  });

  it("returns no duplicates and respects the limit", () => {
    for (const treatment of treatments) {
      const related = getRelatedTreatments(treatment, 3);
      expect(related.length).toBeLessThanOrEqual(3);
      expect(new Set(related.map((item) => item.slug)).size).toBe(
        related.length,
      );
    }
  });

  it("puts the curated relations first", () => {
    for (const treatment of treatments) {
      const curated = treatment.relatedSlugs ?? [];
      if (curated.length === 0) {
        continue;
      }
      const related = getRelatedTreatments(treatment);
      expect(related.slice(0, curated.length).map((item) => item.slug)).toEqual(
        [...curated],
      );
    }
  });

  it("gives every treatment something to explore next", () => {
    // A treatment page that ends in a dead end is a page a visitor leaves.
    for (const treatment of treatments) {
      expect(
        getRelatedTreatments(treatment).length,
        `${treatment.slug} has no related treatments`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("getFeaturedTreatments", () => {
  it("features a small, real subset", () => {
    const featured = getFeaturedTreatments();

    expect(featured.length).toBeGreaterThan(0);
    // More than a handful is not a selection, it is the catalogue again.
    expect(featured.length).toBeLessThanOrEqual(3);
    for (const treatment of featured) {
      expect(getTreatmentBySlug(treatment.slug)).toBeDefined();
    }
  });
});
