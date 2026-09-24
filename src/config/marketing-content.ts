/**
 * Home page content.
 *
 * Marketing copy lives here rather than inside JSX so that it can be reviewed
 * as content - by a clinician, for accuracy - without reading React, and so a
 * later CMS or database integration replaces one module instead of rewriting
 * every section (`docs/implementation-plan/phase_03.md` sections 33 and 53).
 *
 * ## Content safety rules this file follows
 *
 * Nothing here promises an outcome, names a condition it claims to cure, or
 * quantifies anything. There are no patient counts, no success rates, no
 * durations and no fees, because none of those are known
 * (`docs/HEALTHCARE_AND_AI_SAFETY.md`, `AGENTS.md` section 15).
 *
 * Statements are about *how the clinic works* - consultation, individual
 * assessment, follow-up - which is describable without making a medical claim.
 * Every treatment area is phrased as "people come to us with", not "we treat"
 * or "we resolve".
 *
 * Anything a clinician still needs to confirm is marked `PLACEHOLDER` in the
 * comment above it.
 */

import { SERVICE_IMAGES, type ImageAsset } from "./images";

/**
 * Anchor ids for the home page's sections.
 *
 * Exported because the header navigation links to them: while the home page is
 * the only public route, in-page anchors are the honest destination. A nav
 * item pointing at an unbuilt route would 404 on the site's most valuable
 * page. `HomeSectionId` keeps the two in sync at compile time.
 */
export const HOME_SECTIONS = {
  intro: "about",
  approach: "approach",
  services: "treatments",
  why: "why-punarvasu",
  journey: "journey",
  philosophy: "philosophy",
  practitioners: "practitioners",
  faq: "faq",
  contact: "book",
} as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[keyof typeof HOME_SECTIONS];

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export const HERO_CONTENT = {
  eyebrow: "Ayurvedic Chikitsalaya",
  /**
   * Two sentences, deliberately. The first is the tradition, the second is the
   * promise the clinic can actually keep: attention to the individual.
   */
  headline: ["Ancient wisdom.", "Personalized care."],
  /** Set in italic within the headline. See `Emphasis`. */
  headlineEmphasis: "Personalized",
  description:
    "Punarvasu is an Ayurvedic clinic built around one idea — that care should begin with understanding the person, not the symptom. Every consultation starts with a conversation.",
  primaryAction: { label: "Book a Consultation" },
  secondaryAction: { label: "Explore our approach" },
  /**
   * The caption card on the hero photograph. The meaning of the clinic's name,
   * taken from the About page's etymology (`features/about/content.ts`) - a
   * statement about a word, not about care or outcomes.
   */
  nameNote: {
    label: "Punarvasu",
    text: "In Sanskrit, a return — of light, of what was there before.",
  },
} as const;

/**
 * Trust indicators.
 *
 * Qualitative statements about how the clinic practises, and nothing else.
 * There are no figures here on purpose: no patient numbers, ratings or
 * outcomes have been verified, and inventing them would be the single most
 * damaging thing this page could do (`phase_03.md` sections 13-14).
 */
export const TRUST_POINTS: readonly { title: string; description: string }[] = [
  {
    title: "Personalized care",
    description:
      "Assessment and guidance shaped around your constitution, history and daily life.",
  },
  {
    title: "Authentic Ayurveda",
    description:
      "Classical Ayurvedic principles, practised by qualified practitioners.",
  },
  {
    title: "A thoughtful journey",
    description:
      "Time to be heard at the first visit, and follow-up that continues afterwards.",
  },
];

/* ------------------------------------------------------------------ */
/* What is Punarvasu                                                   */
/* ------------------------------------------------------------------ */

export const INTRO_CONTENT = {
  eyebrow: "What is Punarvasu",
  title: "An Ayurvedic clinic, practised patiently",
  titleEmphasis: "patiently",
  /** Lifted from the first paragraph, for the card on the photograph. */
  pullQuote: "The same complaint in two bodies can have two different causes.",
  paragraphs: [
    "Punarvasu is a clinic for people who want to understand their health rather than only manage it. Ayurveda begins from the view that no two people are the same — that the same complaint in two bodies can have two different causes, and so two different paths back to balance.",
    "That belief shapes how a visit works here. A consultation is unhurried. A practitioner asks about sleep, digestion, work, season and stress before discussing anything else, because those are the details that make guidance fit a real life rather than a general one.",
  ],
  /**
   * Points at the About page, which Phase 05 built. Until then it read on to
   * this page's own philosophy section, because a link that 404s is worse
   * than one that scrolls.
   */
  readMore: {
    label: "Read our story",
    href: "/about",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Our approach                                                        */
/* ------------------------------------------------------------------ */

export const APPROACH_CONTENT = {
  eyebrow: "Our approach",
  title: "Understand first. Then personalize. Then care.",
  titleEmphasis: "Then care.",
  description:
    "Three commitments that shape every consultation at Punarvasu, in the order they happen.",
  steps: [
    {
      title: "Understand",
      description:
        "A full Ayurvedic assessment: constitution, current imbalance, medical history, diet, sleep, routine and the life the symptoms sit inside.",
    },
    {
      title: "Personalize",
      description:
        "Guidance built for you — therapies, herbal preparations and daily practices chosen for your constitution rather than from a standard protocol.",
    },
    {
      title: "Care",
      description:
        "Treatment delivered with attention, and follow-up that reviews how your body has actually responded and adjusts accordingly.",
    },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Featured services                                                   */
/* ------------------------------------------------------------------ */

export interface ServicePreview {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly image: ImageAsset;
}

/**
 * PLACEHOLDER — requires clinical review.
 *
 * These describe *areas people consult us about*, not treatments the clinic
 * has confirmed it offers, and certainly not conditions it claims to resolve.
 * The wording ("people come to us with", "we begin by") is chosen so that no
 * sentence survives as a medical claim if it is quoted on its own.
 *
 * A practitioner must confirm the service list, the names and these
 * descriptions before launch. The treatments section of the site is a later
 * phase; this array is the seam where that data will arrive.
 */
export const FEATURED_SERVICES: readonly ServicePreview[] = [
  {
    slug: "joint-and-mobility",
    name: "Joint and mobility concerns",
    description:
      "People come to us with stiffness, aching joints and reduced movement. We begin with an assessment of constitution, routine and aggravating factors before discussing any therapy.",
    image: SERVICE_IMAGES.joints,
  },
  {
    slug: "skin-and-wellbeing",
    name: "Skin and everyday wellbeing",
    description:
      "Skin often reflects digestion, sleep and stress. A consultation looks at those together rather than at the skin alone, and guidance follows from what it finds.",
    image: SERVICE_IMAGES.skin,
  },
  {
    slug: "stress-and-rest",
    name: "Stress, rest and daily rhythm",
    description:
      "Disturbed sleep and persistent tension respond to routine as much as to remedy. We look at the shape of your day — meals, work, rest — and where it can realistically change.",
    image: SERVICE_IMAGES.stress,
  },
];

export const SERVICES_CONTENT = {
  eyebrow: "Consultation areas",
  title: "Where people usually begin",
  description:
    "A consultation is the starting point for all of them. What follows is decided with you, after the assessment — never before it.",
} as const;

/* ------------------------------------------------------------------ */
/* Why Punarvasu                                                       */
/* ------------------------------------------------------------------ */

export const WHY_CONTENT = {
  eyebrow: "Why Punarvasu",
  title: "A quieter kind of clinic",
  titleEmphasis: "quieter",
  description:
    "Four things we hold to, which together describe the difference a visit here is meant to feel like.",
  points: [
    {
      title: "Personal",
      description:
        "Your constitution, history and routine decide your guidance. Nothing is issued from a template.",
    },
    {
      title: "Holistic",
      description:
        "We look past the presenting complaint to digestion, sleep, season and stress, because that is where causes usually sit.",
    },
    {
      title: "Unhurried",
      description:
        "The first consultation is a conversation. Being properly heard is not an extra — it is the assessment.",
    },
    {
      title: "Continuous",
      description:
        "Follow-up is part of care, not an upsell. Guidance is reviewed against how you have actually responded.",
    },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Patient journey                                                     */
/* ------------------------------------------------------------------ */

/**
 * What happens after "Book a Consultation" is pressed.
 *
 * The section exists to remove uncertainty, so each step describes a *process*
 * step only. No step states a duration, a fee or a number of visits: none of
 * those is verified (`phase_03.md` section 27).
 */
export const JOURNEY_CONTENT = {
  eyebrow: "Your journey",
  title: "What happens after you book",
  description: "Five steps, so nothing about your first visit is a surprise.",
  steps: [
    {
      title: "Reach out",
      description:
        "Request a consultation and tell us, in your own words, what brought you here.",
    },
    {
      title: "Consult",
      description:
        "Meet your practitioner. Expect questions about far more than the complaint itself.",
    },
    {
      title: "Understand",
      description:
        "Your practitioner explains what the assessment found, in language you can act on.",
    },
    {
      title: "Personalize",
      description:
        "A plan is agreed with you — therapies, preparations and the daily changes that support them.",
    },
    {
      title: "Follow up",
      description:
        "You are reviewed as things change, and the plan is adjusted to match.",
    },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Ayurvedic philosophy                                                */
/* ------------------------------------------------------------------ */

export const PHILOSOPHY_CONTENT = {
  eyebrow: "Ayurveda at Punarvasu",
  title: "A more thoughtful approach to Ayurveda",
  /**
   * The section's second paragraph, set as a pull quote. It is the same
   * sentence, not new copy - the page states it once, larger.
   */
  quote:
    "Practised well, Ayurveda is unglamorous and specific. Most of what we recommend is ordinary. That is the point.",
  quoteEmphasis: "That is the point.",
  paragraphs: [
    "Ayurveda is a system of understanding rather than a catalogue of remedies. It reads health through balance — of constitution, of digestion, of the rhythm of a day and a season — and treats the person the imbalance belongs to.",
    "Practised well, it is unglamorous and specific: what you eat, when you sleep, how you work, what your body has been doing for years. Most of what we recommend is ordinary. That is the point.",
  ],
  /** Short, concrete ideas. None of them is advice for an individual. */
  principles: [
    {
      title: "Balance",
      description: "Health as equilibrium, not the absence of symptoms.",
    },
    {
      title: "Individuality",
      description:
        "The same complaint can have different causes in different people.",
    },
    {
      title: "Daily rhythm",
      description: "Food, sleep and routine do most of the quiet work.",
    },
    {
      title: "Prevention",
      description: "Attention before a problem becomes established.",
    },
  ],
  /**
   * Required wherever the site discusses health. Stated plainly rather than
   * buried, per `docs/HEALTHCARE_AND_AI_SAFETY.md`.
   */
  disclaimer:
    "This page describes how we practise. It is general information, not medical advice, and it is not a substitute for professional diagnosis or emergency care. Please speak to a qualified practitioner about your own health.",
} as const;

/* ------------------------------------------------------------------ */
/* Practitioners                                                       */
/* ------------------------------------------------------------------ */

/*
 * Moved to `features/practitioners` in Phase 05.
 *
 * The home page's preview section used to define its own `PractitionerPreview`
 * shape and its own placeholder array here, because there was nowhere else for
 * them to live. `/practitioners` now exists, and two models of the same domain
 * concept is the duplication `AGENTS.md` section 32 forbids - so the roster,
 * its types, its query layer and its copy all live in
 * `features/practitioners/` and the home page reads them through
 * `getPractitionerPreviews()`.
 */

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

/**
 * PLACEHOLDER — requires clinic confirmation.
 *
 * Every answer here is written to be true regardless of the clinic's specific
 * policies, because those policies have not been supplied. Questions whose
 * only useful answer is a fact we do not have - how long a consultation takes,
 * what it costs, where the clinic is, what its hours are - are deliberately
 * absent rather than answered with a guess (`phase_03.md` section 27).
 *
 * Nothing medical or legal is hidden in here; the medical disclaimer is
 * rendered in the open, in the philosophy section and in the footer.
 */
export const FAQ_CONTENT = {
  eyebrow: "Questions",
  title: "Before you visit",
  description:
    "If your question is not here, ask it when you request a consultation — we would rather answer it properly.",
} as const;

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "what-happens",
    question: "What happens during a first consultation?",
    answer:
      "Your practitioner takes a full Ayurvedic history. Expect questions about digestion, sleep, energy, routine, stress and past medical history alongside the concern that brought you in. The assessment comes first; any recommendation follows from it and is explained to you.",
  },
  {
    id: "what-to-bring",
    question: "What should I bring?",
    answer:
      "Bring any recent medical reports, investigations or prescriptions you have, including medicines prescribed by other doctors. It also helps to arrive with a sense of your usual daily routine — meal times, sleep, work — since those form part of the assessment.",
  },
  {
    id: "how-to-book",
    question: "How do I book an appointment?",
    answer:
      "Use the Book a Consultation action on this page. Online booking is not open yet, so the request currently reaches the clinic rather than confirming a slot immediately; you will be contacted to arrange a time.",
  },
  {
    id: "alongside-treatment",
    question: "Can I continue my existing medical treatment?",
    answer:
      "Tell your practitioner about every medicine and treatment you are currently receiving. Ayurvedic care is not a replacement for treatment prescribed to you by another doctor, and you should not stop or change that treatment without speaking to the doctor who prescribed it.",
  },
  {
    id: "follow-up",
    question: "Is follow-up part of the process?",
    answer:
      "Yes. Follow-up is how guidance gets corrected — your practitioner reviews how your body has responded and adjusts the plan. When a review should happen is decided at your consultation.",
  },
  {
    id: "urgent-care",
    question: "What if my problem is urgent?",
    answer:
      "Punarvasu is a clinic, not an emergency service. If you have severe, sudden or worsening symptoms, contact emergency medical services or your nearest hospital rather than waiting for a consultation here.",
  },
];

/* ------------------------------------------------------------------ */
/* Final call to action                                                */
/* ------------------------------------------------------------------ */

export const FINAL_CTA_CONTENT = {
  title: "Begin your Punarvasu journey",
  titleEmphasis: "journey",
  description:
    "A consultation is a conversation first. Tell us what brought you here, and we will take it from there.",
  primaryAction: { label: "Book a Consultation" },
} as const;
