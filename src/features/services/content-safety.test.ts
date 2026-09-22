import { describe, expect, it } from "vitest";

import {
  GENERAL_PRECAUTION_NOTE,
  REVIEW_NOTICE,
  SERVICES_FAQ_ITEMS,
  SERVICES_PAGE,
  TREATMENTS,
} from "./content";
import type { Treatment } from "./types";

/**
 * Medical content safety.
 *
 * This is the test that has to fail loudly. Everything else in this phase is
 * a layout that can be fixed next week; a therapeutic claim on a healthcare
 * site is read by someone deciding whether to delay care
 * (`docs/HEALTHCARE_AND_AI_SAFETY.md` sections 1-3,
 * `docs/implementation-plan/phase_04.md` sections 16-17 and 30-32).
 *
 * It scans every string a visitor can read on the services experience —
 * treatment copy, page copy, FAQ answers, notices — against three families
 * of prohibited content:
 *
 *   1. Outcome and efficacy claims.
 *   2. Named conditions, which turn a description into an indication.
 *   3. Fabricated specifics: prices, durations, counts, ratings, clinicians.
 *
 * A pattern here is a rule, not a preference. If a genuine sentence trips one
 * of them, the sentence is almost certainly making a claim it should not, and
 * rewriting the sentence is the fix. Loosening a pattern needs a practitioner
 * in the loop, not a developer with a deadline.
 */

interface Passage {
  readonly where: string;
  readonly text: string;
}

function treatmentPassages(treatment: Treatment): Passage[] {
  const { content } = treatment;
  const at = (field: string) => `${treatment.slug}.${field}`;

  return [
    { where: at("name"), text: treatment.name },
    { where: at("summary"), text: treatment.summary },
    ...content.overview.map((text, i) => ({
      where: at(`overview[${i}]`),
      text,
    })),
    ...(content.traditionalContext ?? []).map((text, i) => ({
      where: at(`traditionalContext[${i}]`),
      text,
    })),
    ...(content.whatToExpect ?? []).flatMap((step, i) => [
      { where: at(`whatToExpect[${i}].title`), text: step.title },
      { where: at(`whatToExpect[${i}].description`), text: step.description },
    ]),
    ...(content.preparation ?? []).map((text, i) => ({
      where: at(`preparation[${i}]`),
      text,
    })),
    ...(content.aftercare ?? []).map((text, i) => ({
      where: at(`aftercare[${i}]`),
      text,
    })),
    ...(content.precautions ?? []).map((text, i) => ({
      where: at(`precautions[${i}]`),
      text,
    })),
    ...(content.faqs ?? []).flatMap((faq, i) => [
      { where: at(`faqs[${i}].question`), text: faq.question },
      { where: at(`faqs[${i}].answer`), text: faq.answer },
    ]),
  ];
}

function pagePassages(): Passage[] {
  const { hero, selection, catalogue, featured, personalization, faq, cta } =
    SERVICES_PAGE;

  return [
    { where: "hero.title", text: hero.title },
    { where: "hero.description", text: hero.description },
    { where: "selection.title", text: selection.title },
    { where: "selection.description", text: selection.description },
    ...selection.steps.flatMap((step, i) => [
      { where: `selection.steps[${i}].title`, text: step.title },
      { where: `selection.steps[${i}].description`, text: step.description },
    ]),
    { where: "catalogue.description", text: catalogue.description },
    { where: "featured.title", text: featured.title },
    { where: "featured.description", text: featured.description },
    { where: "personalization.title", text: personalization.title },
    ...personalization.paragraphs.map((text, i) => ({
      where: `personalization.paragraphs[${i}]`,
      text,
    })),
    { where: "faq.description", text: faq.description },
    { where: "cta.title", text: cta.title },
    { where: "cta.description", text: cta.description },
    ...SERVICES_FAQ_ITEMS.flatMap((item) => [
      { where: `faq.${item.id}.question`, text: item.question },
      { where: `faq.${item.id}.answer`, text: item.answer },
    ]),
    { where: "reviewNotice.listing", text: REVIEW_NOTICE.listing.body },
    { where: "reviewNotice.detail", text: REVIEW_NOTICE.detail.body },
    { where: "generalPrecautionNote", text: GENERAL_PRECAUTION_NOTE },
  ];
}

const ALL_PASSAGES: readonly Passage[] = [
  ...TREATMENTS.flatMap(treatmentPassages),
  ...pagePassages(),
];

/** Outcome, efficacy and superiority claims. */
const CLAIM_PATTERNS: readonly [RegExp, string][] = [
  [/\bcure[sd]?\b|\bcuring\b/i, "claims a cure"],
  [/\bguarantee[sd]?\b/i, "guarantees something"],
  [/\bpermanent(ly)?\b/i, "claims permanence"],
  [/\b100\s*%|\bfully effective\b|\balways works\b/i, "claims total efficacy"],
  [/\bworks for everyone\b|\bsuitable for everyone\b/i, "claims universality"],
  [
    /\bno side[- ]effects?\b|\brisk[- ]free\b|\bcompletely safe\b/i,
    "claims absolute safety",
  ],
  [
    /\bclinically proven\b|\bscientifically proven\b|\bproven to\b/i,
    "claims proof",
  ],
  [/\bmiracle\b|\bmiraculous\b/i, "sensational claim"],
  [
    /\bthe best\b|\bmost powerful\b|\bnumber one\b|\b#1\b/i,
    "claims superiority",
  ],
  [
    /\btreats\b|\bheals\b|\bcorrects\b|\breverses\b/i,
    "asserts a therapeutic action",
  ],
  [/\bwill relieve\b|\bwill reduce\b|\byou will feel\b/i, "promises an effect"],
  [/\binstant(ly)?\b|\bimmediate relief\b/i, "promises speed"],
];

/**
 * Named conditions.
 *
 * Naming a condition next to a therapy turns a description into an
 * indication, which is the boundary `phase_04.md` section 25 draws. This list
 * is not exhaustive and is not meant to be — it catches the conditions a
 * developer reaches for first.
 */
const CONDITION_PATTERN =
  /\b(insomnia|arthritis|diabetes|hypertension|depression|anxiety|migraines?|psoriasis|eczema|infertility|obesity|asthma)\b/i;

/** Specifics nobody has supplied: money, clock time, counts, ratings, people. */
const FABRICATION_PATTERNS: readonly [RegExp, string][] = [
  [/[₹$]\s*\d|\bRs\.?\s*\d|\bINR\s*\d/i, "states a price"],
  [
    /\b\d+\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|sessions?|sittings?)\b/i,
    "states a duration or session count",
  ],
  [/\b\d[\d,]*\s*\+|\b\d+\s*%/, "states a statistic"],
  [/★|\b\d(\.\d)?\s*(stars?|\/\s*5)\b/i, "states a rating"],
  [/\bDr\.?\s+[A-Z]/, "names a clinician"],
  [/\bslots? (left|available)\b|\bavailable today\b/i, "claims availability"],
];

describe("treatment content makes no medical claim", () => {
  it.each(CLAIM_PATTERNS)("contains nothing that %s", (pattern) => {
    const offenders = ALL_PASSAGES.filter((passage) =>
      pattern.test(passage.text),
    ).map((passage) => `${passage.where}: ${passage.text}`);

    expect(offenders.join("\n"), offenders.join("\n") || undefined).toBe("");
  });

  it("names no medical condition", () => {
    const offenders = ALL_PASSAGES.filter((passage) =>
      CONDITION_PATTERN.test(passage.text),
    ).map((passage) => `${passage.where}: ${passage.text}`);

    expect(offenders.join("\n"), offenders.join("\n") || undefined).toBe("");
  });
});

describe("treatment content fabricates nothing", () => {
  it.each(FABRICATION_PATTERNS)("contains nothing that %s", (pattern) => {
    const offenders = ALL_PASSAGES.filter((passage) =>
      pattern.test(passage.text),
    ).map((passage) => `${passage.where}: ${passage.text}`);

    expect(offenders.join("\n"), offenders.join("\n") || undefined).toBe("");
  });

  it("carries no price, duration, rating or availability field", () => {
    // The type has no such field. This asserts the runtime objects agree, so
    // a widened type or a spread from a future data source cannot smuggle one
    // in without failing here (`phase_04.md` sections 30-32).
    const banned = [
      "price",
      "cost",
      "fee",
      "duration",
      "length",
      "rating",
      "reviews",
      "availability",
      "slots",
      "discount",
      "package",
    ];

    for (const treatment of TREATMENTS) {
      const keys = [
        ...Object.keys(treatment),
        ...Object.keys(treatment.content),
      ].map((key) => key.toLowerCase());

      for (const field of banned) {
        expect(
          keys,
          `${treatment.slug} exposes a "${field}" field`,
        ).not.toContain(field);
      }
    }
  });
});

describe("treatment content is marked as unverified", () => {
  it("has every treatment awaiting clinical review", () => {
    for (const treatment of TREATMENTS) {
      expect(treatment.reviewStatus, treatment.slug).toBe(
        "pending-clinical-review",
      );
    }
  });

  it("says so in the notices the pages render", () => {
    for (const notice of Object.values(REVIEW_NOTICE)) {
      expect(notice.body).toMatch(/review|awaiting|confirmed|prepared/i);
      expect(notice.title.length).toBeGreaterThan(10);
    }
  });

  it("falls back to guidance rather than an invented precaution list", () => {
    expect(GENERAL_PRECAUTION_NOTE).toMatch(/practitioner/i);
    expect(GENERAL_PRECAUTION_NOTE).toMatch(/not published|will not invent/i);
  });
});
