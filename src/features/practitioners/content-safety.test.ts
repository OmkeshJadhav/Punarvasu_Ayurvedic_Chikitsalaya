import { describe, expect, it } from "vitest";

import { ABOUT_PAGE } from "@/features/about/content";
import { CONTACT_PAGE } from "@/features/contact/content";

import {
  PRACTITIONERS,
  PRACTITIONERS_PAGE,
  PROFILE_CONSULTATION_NOTE,
} from "./content";
import { isPublished } from "./types";

/**
 * Content safety for the About, Practitioners and Contact pages.
 *
 * The services experience has its own scanner
 * (`features/services/content-safety.test.ts`); this is the same idea applied
 * to the three pages Phase 05 adds, plus the rules that only matter here:
 * **no practitioner may be named, credentialled or described until the clinic
 * has confirmed them** (`docs/implementation-plan/phase_05.md` sections 17-18
 * and 21), and a practitioner the clinic *has* confirmed is described without
 * a medical claim.
 *
 * A pattern here is a rule, not a preference. If a genuine sentence trips
 * one, the sentence is almost certainly making a claim it should not, and
 * rewriting it is the fix. Loosening a pattern needs the clinic in the loop,
 * not a developer with a deadline.
 */

interface Passage {
  readonly where: string;
  readonly text: string;
}

function aboutPassages(): Passage[] {
  const p = ABOUT_PAGE;
  return [
    { where: "about.hero.title", text: p.hero.title },
    { where: "about.hero.description", text: p.hero.description },
    { where: "about.name.title", text: p.name.title },
    ...p.name.paragraphs.map((text, i) => ({
      where: `about.name.paragraphs[${i}]`,
      text,
    })),
    { where: "about.purpose.title", text: p.purpose.title },
    ...p.purpose.paragraphs.map((text, i) => ({
      where: `about.purpose.paragraphs[${i}]`,
      text,
    })),
    { where: "about.beliefs.title", text: p.beliefs.title },
    ...p.beliefs.paragraphs.map((text, i) => ({
      where: `about.beliefs.paragraphs[${i}]`,
      text,
    })),
    ...p.beliefs.principles.flatMap((item, i) => [
      { where: `about.beliefs.principles[${i}].title`, text: item.title },
      {
        where: `about.beliefs.principles[${i}].description`,
        text: item.description,
      },
    ]),
    { where: "about.approach.title", text: p.approach.title },
    { where: "about.approach.description", text: p.approach.description },
    ...p.approach.steps.flatMap((step, i) => [
      { where: `about.approach.steps[${i}].title`, text: step.title },
      {
        where: `about.approach.steps[${i}].description`,
        text: step.description,
      },
    ]),
    { where: "about.commitments.title", text: p.commitments.title },
    { where: "about.commitments.description", text: p.commitments.description },
    ...p.commitments.items.flatMap((item, i) => [
      { where: `about.commitments.items[${i}].title`, text: item.title },
      {
        where: `about.commitments.items[${i}].description`,
        text: item.description,
      },
    ]),
    { where: "about.clinic.title", text: p.clinic.title },
    ...p.clinic.paragraphs.map((text, i) => ({
      where: `about.clinic.paragraphs[${i}]`,
      text,
    })),
    {
      where: "about.practitioners.description",
      text: p.practitioners.description,
    },
    { where: "about.cta.title", text: p.cta.title },
    { where: "about.cta.description", text: p.cta.description },
  ];
}

function practitionerPagePassages(): Passage[] {
  const p = PRACTITIONERS_PAGE;
  return [
    { where: "practitioners.hero.title", text: p.hero.title },
    { where: "practitioners.hero.description", text: p.hero.description },
    { where: "practitioners.profileNote", text: PROFILE_CONSULTATION_NOTE },
  ];
}

function contactPassages(): Passage[] {
  const p = CONTACT_PAGE;
  return [
    { where: "contact.hero.title", text: p.hero.title },
    { where: "contact.hero.description", text: p.hero.description },
    { where: "contact.channels.description", text: p.channels.description },
    { where: "contact.unavailable.email", text: p.unavailable.email },
    { where: "contact.unavailable.hours", text: p.unavailable.hours },
    { where: "contact.location.description", text: p.location.description },
    { where: "contact.location.privacy", text: p.location.mapPrivacyNote },
    { where: "contact.enquiry.privacyWarning", text: p.enquiry.privacyWarning },
    { where: "contact.enquiry.errorBody", text: p.enquiry.errorBody },
    { where: "contact.enquiryUnavailable", text: p.enquiryUnavailable.body },
    ...p.faqItems.flatMap((item) => [
      { where: `contact.faq.${item.id}.question`, text: item.question },
      { where: `contact.faq.${item.id}.answer`, text: item.answer },
    ]),
    { where: "contact.cta.title", text: p.cta.title },
    { where: "contact.cta.description", text: p.cta.description },
  ];
}

/**
 * What the published profiles say about each practitioner.
 *
 * Scanned for claims and conditions like any other copy, but not by the
 * fabrication patterns: a published profile is *supposed* to name its
 * clinician and state their experience, because the clinic supplied both.
 */
function publishedProfilePassages(): Passage[] {
  return PRACTITIONERS.filter(isPublished).flatMap((practitioner) => {
    const where = `practitioners.${practitioner.slug}`;
    return [
      ...(practitioner.shortBio
        ? [{ where: `${where}.shortBio`, text: practitioner.shortBio }]
        : []),
      ...(practitioner.biography ?? []).map((text, i) => ({
        where: `${where}.biography[${i}]`,
        text,
      })),
      ...(practitioner.approach ?? []).map((text, i) => ({
        where: `${where}.approach[${i}]`,
        text,
      })),
      ...(practitioner.specialties ?? []).map((text, i) => ({
        where: `${where}.specialties[${i}]`,
        text,
      })),
    ];
  });
}

const PROFILE_PASSAGES: readonly Passage[] = publishedProfilePassages();

const ALL_PASSAGES: readonly Passage[] = [
  ...aboutPassages(),
  ...practitionerPagePassages(),
  ...contactPassages(),
];

/** Outcome, efficacy and superiority claims. The services scanner's list. */
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
    /\bthe best\b|\bmost powerful\b|\bnumber one\b|\b#1\b|\bleading\b/i,
    "claims superiority",
  ],
  [
    /\btreats\b|\bheals\b|\bcorrects\b|\breverses\b/i,
    "asserts a therapeutic action",
  ],
  [/\bwill relieve\b|\bwill reduce\b|\byou will feel\b/i, "promises an effect"],
  [/\binstant(ly)?\b|\bimmediate relief\b/i, "promises speed"],
];

/** Naming a condition turns a description into an indication. */
const CONDITION_PATTERN =
  /\b(insomnia|arthritis|diabetes|hypertension|depression|anxiety|migraines?|psoriasis|eczema|infertility|obesity|asthma)\b/i;

/** Specifics nobody has supplied: money, clock time, counts, ratings, people. */
const FABRICATION_PATTERNS: readonly [RegExp, string][] = [
  [/[₹$]\s*\d|\bRs\.?\s*\d|\bINR\s*\d/i, "states a price"],
  [
    /\b\d+\s*(minutes?|mins?|hours?|hrs?|weeks?|years?|sessions?|sittings?)\b/i,
    "states a duration or session count",
  ],
  [/\b\d[\d,]*\s*\+|\b\d+\s*%/, "states a statistic"],
  [/★|\b\d(\.\d)?\s*(stars?|\/\s*5)\b/i, "states a rating"],
  [/\bDr\.?\s+[A-Z]/, "names a clinician"],
  [/\bslots? (left|available)\b|\bavailable today\b/i, "claims availability"],
  [
    /\bwe (reply|respond|get back)[^.]*\bwithin\b/i,
    "promises a response time the clinic has not stated",
  ],
];

describe("Phase 05 page copy makes no medical claim", () => {
  it.each(CLAIM_PATTERNS)("contains nothing that %s", (pattern) => {
    const offenders = [...ALL_PASSAGES, ...PROFILE_PASSAGES]
      .filter((passage) => pattern.test(passage.text))
      .map((passage) => `${passage.where}: ${passage.text}`);

    expect(offenders.join("\n"), offenders.join("\n") || undefined).toBe("");
  });

  it("names no medical condition", () => {
    const offenders = [...ALL_PASSAGES, ...PROFILE_PASSAGES]
      .filter((passage) => CONDITION_PATTERN.test(passage.text))
      .map((passage) => `${passage.where}: ${passage.text}`);

    expect(offenders.join("\n"), offenders.join("\n") || undefined).toBe("");
  });
});

describe("Phase 05 page copy fabricates nothing", () => {
  it.each(FABRICATION_PATTERNS)("contains nothing that %s", (pattern) => {
    const offenders = ALL_PASSAGES.filter((passage) =>
      pattern.test(passage.text),
    ).map((passage) => `${passage.where}: ${passage.text}`);

    expect(offenders.join("\n"), offenders.join("\n") || undefined).toBe("");
  });
});

describe("no practitioner is invented", () => {
  it("publishes each confirmed practitioner with a name and qualifications", () => {
    for (const practitioner of PRACTITIONERS.filter(isPublished)) {
      expect(practitioner.name, practitioner.slug).toMatch(/\S/);
      expect(
        practitioner.qualifications?.length ?? 0,
        `"${practitioner.slug}" is published without a qualification`,
      ).toBeGreaterThan(0);
    }
  });

  it("carries no descriptive field on an unverified entry", () => {
    // The type already prevents this. The runtime check exists because a
    // future data source could spread extra keys onto these objects, and a
    // name arriving that way would render as a real clinician.
    const forbidden = [
      "name",
      "designation",
      "qualifications",
      "specialties",
      "shortbio",
      "biography",
      "approach",
      "experience",
      "languages",
      "registrationnumber",
    ];

    for (const practitioner of PRACTITIONERS) {
      if (isPublished(practitioner)) {
        continue;
      }
      const keys = Object.keys(practitioner).map((key) => key.toLowerCase());
      for (const field of forbidden) {
        expect(
          keys,
          `"${practitioner.slug}" exposes a "${field}" field while unverified`,
        ).not.toContain(field);
      }
    }
  });

  it("tells a visitor that choosing a practitioner does not decide the outcome", () => {
    expect(PROFILE_CONSULTATION_NOTE).toMatch(/assessment/i);
    expect(PROFILE_CONSULTATION_NOTE).toMatch(/in advance/i);
  });
});

describe("unverified clinic facts are stated as unverified", () => {
  it("says why the name was chosen has not been supplied", () => {
    expect(ABOUT_PAGE.name.paragraphs.join(" ")).toMatch(
      /has not published its own account/i,
    );
  });

  it("keeps an unconfirmed-hours message for a clinic without hours", () => {
    expect(CONTACT_PAGE.unavailable.hours).toMatch(/not confirmed/i);
    expect(CONTACT_PAGE.unavailable.hours).toMatch(/call/i);
  });

  it("says no email address has been published", () => {
    expect(CONTACT_PAGE.unavailable.email).toMatch(/not published/i);
  });

  it("does not claim an online enquiry channel exists", () => {
    expect(CONTACT_PAGE.enquiryUnavailable.body).toMatch(
      /not yet|does not yet/i,
    );
    expect(CONTACT_PAGE.enquiryUnavailable.body).toMatch(/call/i);
  });
});
