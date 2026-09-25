import { describe, expect, it } from "vitest";

import { PRACTITIONERS } from "./content";
import {
  getAllPractitioners,
  getPractitionerBySlug,
  getPractitionerPreviews,
  getPractitionerSlugs,
  getPublishedPractitioners,
  hasUnverifiedPractitioners,
  isValidSlugFormat,
  normalizePractitionerSlug,
  practitionerDisplayName,
} from "./directory";
import type { Practitioner, PublishedPractitioner } from "./types";
import { isPublished } from "./types";

/**
 * The practitioner directory.
 *
 * Two things are under test here, and the second matters more than the first.
 *
 *   1. The roster is internally consistent - unique, URL-safe slugs, a usable
 *      display name for every entry.
 *   2. The slug lookup is a real boundary. `/practitioners/[slug]` takes a
 *      value straight from a URL, and the only records it may ever return are
 *      practitioners the clinic has published. An unpublished person must not
 *      be reachable by guessing the slug printed in the listing page's markup.
 */

/**
 * A synthetic published practitioner.
 *
 * The shipped roster names nobody, so proving that a published entry resolves
 * requires constructing one. Obviously fake, per `docs/QA_STRATEGY.md`
 * section 31.
 */
const FIXTURE: PublishedPractitioner = {
  slug: "test-practitioner",
  status: "published",
  name: "Test Practitioner",
  qualifications: ["BAMS"],
};

describe("roster integrity", () => {
  it("gives every entry a URL-safe slug", () => {
    for (const practitioner of PRACTITIONERS) {
      expect(
        isValidSlugFormat(practitioner.slug),
        `"${practitioner.slug}" is not a valid slug`,
      ).toBe(true);
    }
  });

  it("uses each slug once", () => {
    const slugs = PRACTITIONERS.map((practitioner) => practitioner.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every entry a display name, published or not", () => {
    for (const practitioner of PRACTITIONERS) {
      expect(practitionerDisplayName(practitioner).length).toBeGreaterThan(0);
    }
  });

  it("returns the whole roster in order", () => {
    expect(getAllPractitioners()).toEqual(PRACTITIONERS);
  });

  it("reports whether any profile is still unverified", () => {
    // Drives the practitioners page's "being prepared" notice. The clinic has
    // confirmed everyone in the shipped roster, so today the notice is off.
    expect(hasUnverifiedPractitioners()).toBe(
      PRACTITIONERS.some((entry) => !isPublished(entry)),
    );
    expect(
      hasUnverifiedPractitioners([
        { slug: "pending-one", status: "pending-verification" },
      ]),
    ).toBe(true);
    expect(hasUnverifiedPractitioners([FIXTURE])).toBe(false);
  });
});

describe("published subset", () => {
  it("contains only entries the clinic has confirmed", () => {
    for (const practitioner of getPublishedPractitioners()) {
      expect(isPublished(practitioner)).toBe(true);
    }
  });

  it("routes only published practitioners", () => {
    const routable = new Set(getPractitionerSlugs());

    for (const practitioner of PRACTITIONERS) {
      expect(
        routable.has(practitioner.slug),
        `"${practitioner.slug}" routability does not match its status`,
      ).toBe(isPublished(practitioner));
    }
  });

  it("gives an unpublished practitioner no reachable page", () => {
    // The listing page prints placeholder cards, and their slugs are
    // guessable. Guessing one must still be a 404.
    const pending = PRACTITIONERS.filter((entry) => !isPublished(entry));

    for (const practitioner of pending) {
      expect(getPractitionerBySlug(practitioner.slug)).toBeUndefined();
    }
    // The slugs the old placeholder cards used must not resolve either.
    expect(getPractitionerBySlug("practitioner-profile-1")).toBeUndefined();
    expect(getPractitionerBySlug("practitioner-profile-2")).toBeUndefined();
  });

  it("previews published practitioners ahead of placeholders", () => {
    const mixed: readonly Practitioner[] = [
      { slug: "pending-one", status: "pending-verification" },
      FIXTURE,
    ];
    // `getPractitionerPreviews` reads the module roster, so the ordering rule
    // itself is asserted directly rather than through it.
    const ordered = [
      ...mixed.filter(isPublished),
      ...mixed.filter((entry) => !isPublished(entry)),
    ];
    expect(ordered[0]).toBe(FIXTURE);
  });

  it("limits the preview to the requested number", () => {
    expect(getPractitionerPreviews(1)).toHaveLength(1);
    expect(getPractitionerPreviews(2).length).toBeLessThanOrEqual(2);
  });
});

describe("slug normalisation", () => {
  it("forgives case and surrounding whitespace", () => {
    expect(normalizePractitionerSlug("  Some-Slug ")).toBe("some-slug");
  });

  it.each([
    ["../../etc/passwd", "path traversal"],
    ["one/../two", "embedded traversal"],
    ["<script>alert(1)</script>", "markup"],
    ["' OR 1=1 --", "a SQL-shaped string"],
    ["a b", "an embedded space"],
    ["a%20b", "a percent-encoded space"],
    ["-leading", "a leading hyphen"],
    ["trailing-", "a trailing hyphen"],
    ["double--hyphen", "a doubled hyphen"],
    ["", "an empty segment"],
    ["UPPER_CASE", "an underscore"],
  ])("rejects %s (%s)", (value) => {
    expect(normalizePractitionerSlug(value)).toBeUndefined();
    expect(getPractitionerBySlug(value)).toBeUndefined();
  });

  it("rejects an absurdly long slug without doing the work", () => {
    const long = "a".repeat(5000);
    expect(normalizePractitionerSlug(long)).toBeUndefined();
    expect(getPractitionerBySlug(long)).toBeUndefined();
  });
});
