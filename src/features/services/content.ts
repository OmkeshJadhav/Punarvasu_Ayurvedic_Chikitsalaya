/**
 * Treatment and services content.
 *
 * ## Read this before changing a single sentence
 *
 * Everything a visitor reads about a treatment lives in this one file, so that
 * a practitioner can review the clinic's medical content without opening a
 * React component (`docs/implementation-plan/phase_04.md` sections 68-69).
 * Do not move a claim into JSX.
 *
 * ## Content status
 *
 * **Every treatment below is `pending-clinical-review`.** Punarvasu has not
 * supplied a confirmed service list or approved descriptions, so this is
 * development content and the UI says so, on the listing page and on every
 * detail page. It is not disguised as verified guidance
 * (`phase_04.md` section 68, `docs/HEALTHCARE_AND_AI_SAFETY.md` section 2).
 *
 * What is safe here and what is not:
 *
 *   - Describing what a classical Ayurvedic therapy *is*, and what physically
 *     happens during it, is an educational statement about a documented
 *     tradition. That is the only kind of statement this file makes.
 *   - Whether Punarvasu offers a given therapy is a fact about the clinic.
 *     Unverified, hence the review notice on every page.
 *   - What a therapy will do for a reader is a medical claim. Nothing here
 *     makes one, and `content-safety.test.ts` fails the build if one appears.
 *
 * ## Rules every entry follows
 *
 *   - No condition is named as something a therapy addresses, resolves or
 *     helps with.
 *   - No outcome is promised, implied or hinted at.
 *   - No duration, fee, package, slot count or availability appears anywhere -
 *     the type does not even have fields for them.
 *   - No practitioner, credential, statistic, rating or testimonial appears.
 *   - Traditional descriptions are labelled as traditional and explicitly
 *     separated from clinical evidence (`phase_04.md` section 26).
 *   - Precautions are either verified or general. An invented contraindication
 *     list is more dangerous than none (`phase_04.md` section 29).
 */

import { TREATMENT_IMAGES } from "@/config/images";

import type {
  Treatment,
  TreatmentCategory,
  TreatmentFaq,
  TreatmentStep,
} from "./types";

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

/**
 * Three groups, in the order a visitor meets them: what you book first, what
 * happens at the clinic, what continues afterwards.
 *
 * Three rather than five. Categories exist to help someone scan seven
 * entries; a group holding one item helps nobody and turns a navigation aid
 * into decoration (`phase_04.md` section 13).
 */
export const TREATMENT_CATEGORIES: readonly TreatmentCategory[] = [
  {
    id: "consultations",
    name: "Consultation",
    description:
      "Where every path at Punarvasu begins, and the only place a therapy is chosen.",
  },
  {
    id: "therapies",
    name: "Therapies",
    description:
      "Hands-on Ayurvedic therapies carried out at the clinic, as part of a plan agreed with you.",
  },
  {
    id: "wellness-support",
    name: "Ongoing support",
    description:
      "Preparations and guidance that continue between visits and are revisited as things change.",
  },
];

/* ------------------------------------------------------------------ */
/* Shared safety copy                                                  */
/* ------------------------------------------------------------------ */

/**
 * Shown under "Before you consider this" whenever a treatment has no verified
 * precautions of its own.
 *
 * The page never leaves that heading empty and never fills it with a guess.
 * This is the wording `phase_04.md` section 29 asks for, and it is itself
 * pending the clinic's final content policy.
 */
export const GENERAL_PRECAUTION_NOTE =
  "Punarvasu has not published specific precautions for this therapy, and we will not invent a list. Please discuss your health history, any medicines you are taking, pregnancy or breastfeeding, recent surgery and any ongoing condition with your practitioner before treatment begins.";

/** Rendered wherever a visitor might be describing an acute problem. */
export const EMERGENCY_NOTE =
  "Punarvasu is a clinic, not an emergency service. If you have severe, sudden or worsening symptoms, contact emergency medical services or your nearest hospital rather than waiting for a consultation.";

export const MEDICAL_DISCLAIMER =
  "These pages describe Ayurvedic therapies in general terms. They are information, not medical advice, and they are not a substitute for professional diagnosis, treatment or emergency care.";

/** The banner shown while a treatment's copy has not been signed off. */
export const REVIEW_NOTICE = {
  listing: {
    title: "Service information is being prepared",
    body: "The treatments described below are development content awaiting review by a practitioner at Punarvasu. Descriptions may change, and this is not yet confirmed as the clinic's final range of services.",
  },
  detail: {
    title: "This description is awaiting clinical review",
    body: "It was written during development and has not yet been confirmed by a practitioner at Punarvasu. Please treat it as provisional, and ask your practitioner about anything that matters to you.",
  },
} as const;

/* ------------------------------------------------------------------ */
/* Treatments                                                          */
/* ------------------------------------------------------------------ */

const AYURVEDIC_CONSULTATION: Treatment = {
  slug: "ayurvedic-consultation",
  name: "Ayurvedic Consultation",
  categoryId: "consultations",
  featured: true,
  reviewStatus: "pending-clinical-review",
  summary:
    "An unhurried assessment of the person rather than of a single complaint. Everything else at Punarvasu follows from it.",
  // No photograph honestly depicts a consultation at this clinic, so this
  // entry carries none and the card renders its typographic composition
  // instead. See `config/images.ts`.
  content: {
    overview: [
      "An Ayurvedic consultation is an assessment of you, not of a symptom. Your practitioner asks about digestion, sleep, appetite, energy, routine, work and stress alongside the concern that brought you in, and takes a conventional medical history as well.",
      "Nothing is decided before that conversation. Whether a therapy is appropriate for you, which one, and in what order are questions the assessment answers — which is why every other service on this page begins here.",
    ],
    traditionalContext: [
      "Classical Ayurveda approaches examination through constitution (prakriti), current imbalance (vikriti) and the state of digestion (agni), using observation, questioning and physical examination.",
      "That is a description of a traditional method of assessment. It is not a claim that the method has been validated by modern clinical research.",
    ],
    whatToExpect: [
      {
        title: "Your account",
        description:
          "You describe what brought you here, in your own words, without being hurried through it.",
      },
      {
        title: "The wider picture",
        description:
          "Questions about digestion, sleep, appetite, energy, routine, season and stress — and about any treatment you are already receiving.",
      },
      {
        title: "Examination",
        description:
          "A physical examination appropriate to what you have described, alongside any reports or investigations you have brought.",
      },
      {
        title: "What was found",
        description:
          "Your practitioner explains the assessment in plain language, and what they would suggest considering next.",
      },
      {
        title: "A plan you agree to",
        description:
          "Anything suggested is explained before it begins — what it involves, and what it asks of you.",
      },
    ],
    preparation: [
      "Bring recent medical reports, investigations and prescriptions, including medicines prescribed by other doctors.",
      "Come with a sense of your ordinary day — when you eat, sleep, work and rest. Those form part of the assessment.",
      "Write down anything you want to ask. It is easy to forget a question once the conversation starts.",
    ],
    faqs: [
      {
        id: "consultation-choose",
        question: "Will I be told which treatment I need?",
        answer:
          "Your practitioner will explain what the assessment found and what they would suggest considering. That suggestion is made for you, after examining you — which is the opposite of choosing a therapy from a list on a website.",
      },
      {
        id: "consultation-existing-treatment",
        question: "Should I mention treatment I am already receiving?",
        answer:
          "Yes, all of it, including medicines prescribed by other doctors and anything bought without a prescription. Ayurvedic care is not a replacement for treatment prescribed to you, and you should not stop or change that treatment without speaking to the doctor who prescribed it.",
      },
    ],
  },
  relatedSlugs: ["panchakarma", "lifestyle-guidance"],
};

const PANCHAKARMA: Treatment = {
  slug: "panchakarma",
  name: "Panchakarma",
  sanskritName: "Pañcakarma",
  categoryId: "therapies",
  featured: true,
  reviewStatus: "pending-clinical-review",
  image: TREATMENT_IMAGES.panchakarma,
  summary:
    "A staged classical programme of preparatory therapies, principal procedures and a guided return to ordinary routine. It is planned individually, not booked as a single appointment.",
  content: {
    overview: [
      "Panchakarma is a programme rather than a single therapy. Classically it runs in three stages: preparation (purvakarma), the principal procedures (pradhanakarma), and a graded return to ordinary diet and routine afterwards (paschatkarma).",
      "Because it is staged, it is planned rather than picked. What it would consist of for you — which procedures, in what order, over what period — is decided by your practitioner after assessment, and it is not appropriate for everyone.",
    ],
    traditionalContext: [
      "The name refers to five principal actions described in the classical texts. Those texts treat preparation and the return to routine as inseparable from the procedures themselves, rather than as optional extras around them.",
      "This describes the traditional structure of the programme. It is not a statement about what a programme will achieve.",
    ],
    whatToExpect: [
      {
        title: "Assessment",
        description:
          "Your practitioner assesses whether a programme is appropriate for you at all, and what it would consist of.",
      },
      {
        title: "Preparation",
        description:
          "Preparatory therapies, carried out over a period agreed with you beforehand.",
      },
      {
        title: "Principal procedures",
        description:
          "The procedures your practitioner has selected, carried out under supervision at the clinic.",
      },
      {
        title: "Return to routine",
        description:
          "A guided, gradual return to ordinary food, activity and routine. This stage is part of the programme.",
      },
      {
        title: "Review",
        description:
          "Follow-up to see how you have actually responded, and to adjust what comes next.",
      },
    ],
    preparation: [
      "A programme is planned in advance. Discuss dates, rest and any commitments with your practitioner before it begins.",
      "Tell your practitioner about every medicine and treatment you are currently receiving.",
    ],
    aftercare: [
      "The return to ordinary diet and routine is deliberate and gradual. Follow the guidance you are given rather than resuming everything at once.",
      "Tell your practitioner about anything unexpected rather than waiting for the next scheduled review.",
    ],
    faqs: [
      {
        id: "panchakarma-length",
        question: "How long does a programme take?",
        answer:
          "That depends entirely on the programme your practitioner plans with you. Punarvasu has not published standard programme lengths, and a figure quoted here would not describe yours.",
      },
      {
        id: "panchakarma-suitability",
        question: "Can anyone have Panchakarma?",
        answer:
          "No. Whether it is appropriate for you is a clinical judgement made after assessment, taking account of your health history and anything you are currently being treated for.",
      },
    ],
  },
  relatedSlugs: ["abhyanga", "ayurvedic-consultation"],
};

const ABHYANGA: Treatment = {
  slug: "abhyanga",
  name: "Abhyanga",
  sanskritName: "Abhyaṅga",
  categoryId: "therapies",
  featured: true,
  reviewStatus: "pending-clinical-review",
  image: TREATMENT_IMAGES.abhyanga,
  summary:
    "Warm medicated oil applied over the body and worked in by a therapist with long, sustained strokes. Used on its own and as preparation within a longer programme.",
  content: {
    overview: [
      "Abhyanga is the application of warm oil to the body, worked in with rhythmic strokes by a therapist. In Ayurveda the oil itself is part of the therapy: which preparation is used is a decision the practitioner makes, not a detail.",
      "It appears both as a therapy in its own right and as a preparatory stage within a longer programme. Which of those applies to you, and which oil, is settled at consultation.",
    ],
    traditionalContext: [
      "Classical texts describe oil application as part of dinacharya, the daily routine, and as a preparatory measure before other procedures, with oils selected according to constitution, season and the imbalance being addressed.",
      "That is the traditional rationale for the therapy, not evidence of what it does.",
    ],
    whatToExpect: [
      {
        title: "Before",
        description:
          "Your therapist confirms what has been planned for you and answers anything you want to ask first.",
      },
      {
        title: "The therapy",
        description:
          "Warm oil is applied over the body and worked in with long strokes at a pressure you are comfortable with. Say so at any point if anything is uncomfortable.",
      },
      {
        title: "Rest",
        description:
          "A period of rest afterwards, before the oil is washed off.",
      },
      {
        title: "Guidance",
        description:
          "Anything to do or avoid for the rest of the day is explained before you leave.",
      },
    ],
    preparation: [
      "Wear or bring clothing you do not mind getting oil on.",
      "Tell your therapist about skin conditions, recent injury or surgery, pregnancy, and any medicine you are taking.",
    ],
    aftercare: [
      "Oil takes time and warm water to come off. Allow for that before your next commitment.",
      "Follow whatever your practitioner advises about food, activity and rest for the remainder of the day.",
    ],
  },
  relatedSlugs: ["shirodhara", "panchakarma"],
};

const SHIRODHARA: Treatment = {
  slug: "shirodhara",
  name: "Shirodhara",
  sanskritName: "Śirodhārā",
  categoryId: "therapies",
  reviewStatus: "pending-clinical-review",
  image: TREATMENT_IMAGES.shirodhara,
  summary:
    "A warm liquid, usually a medicated oil, poured in a slow and continuous stream across the forehead for a period the practitioner sets.",
  content: {
    overview: [
      "During shirodhara you lie still while a steady stream of warm liquid falls onto the forehead from a vessel suspended above it. The preparation used, its temperature and the length of the therapy are all set by the practitioner.",
      "It is one of the most recognisable Ayurvedic therapies and one of the most often asked for by name. Whether it suits you is still a question for a consultation rather than for a website.",
    ],
    traditionalContext: [
      "The name joins shiras, the head, with dhara, a continuous stream. Classical descriptions place it among the therapies applied to the head and specify the preparation according to the individual.",
      "Traditional use is not the same thing as clinical evidence, and nothing here should be read as a claim about what the therapy will do for you.",
    ],
    whatToExpect: [
      {
        title: "Settling",
        description:
          "You lie down and are made comfortable; your eyes and hair are protected before anything begins.",
      },
      {
        title: "The stream",
        description:
          "Warm liquid is poured in a slow, continuous stream across the forehead for the period your practitioner has set.",
      },
      {
        title: "Stillness",
        description:
          "The therapy asks very little of you. Most people simply lie still for its duration.",
      },
      {
        title: "Afterwards",
        description:
          "Time to get up slowly, and guidance for the rest of your day.",
      },
    ],
    preparation: [
      "Tell your therapist beforehand about any scalp or skin condition, and about anything that makes lying flat uncomfortable.",
      "Expect oil in your hair afterwards, and plan the rest of the day around that.",
    ],
    aftercare: [
      "Get up slowly rather than immediately.",
      "Follow the guidance you are given about rest, food and activity for the remainder of the day.",
    ],
  },
  relatedSlugs: ["abhyanga", "ayurvedic-consultation"],
};

const MUKHA_LEPA: Treatment = {
  slug: "mukha-lepa",
  name: "Mukha Lepa",
  sanskritName: "Mukhalepa",
  categoryId: "therapies",
  reviewStatus: "pending-clinical-review",
  image: TREATMENT_IMAGES.mukhaLepa,
  summary:
    "A prepared herbal paste applied to the face and left for a set time before removal, with the preparation chosen by the practitioner.",
  content: {
    overview: [
      "Lepa is the Ayurvedic term for a paste applied externally; mukha lepa is its application to the face. The herbs, what they are mixed with and how long the application is left are all chosen by the practitioner.",
      "Skin is rarely considered on its own in Ayurveda. A consultation usually looks at digestion, sleep and routine alongside the skin itself, and an external therapy sits inside that wider picture rather than replacing it.",
    ],
    traditionalContext: [
      "Classical texts describe external applications prepared from specified herbs and applied for a defined period, varying the preparation by individual and by season.",
      "That is a description of traditional practice, not a claim of clinical evidence.",
    ],
    whatToExpect: [
      {
        title: "Preparation",
        description:
          "The paste is prepared for you, and your therapist explains what it contains.",
      },
      {
        title: "Application",
        description:
          "It is applied to the face and left in place for the period your practitioner has set.",
      },
      {
        title: "Removal and guidance",
        description:
          "The paste is removed, and anything to apply or avoid for the rest of the day is explained.",
      },
    ],
    preparation: [
      "Arrive with your face free of make-up where you can.",
      "Tell your therapist about allergies, sensitivities and any skin treatment you are already using.",
    ],
  },
  relatedSlugs: ["ayurvedic-consultation", "lifestyle-guidance"],
};

const HERBAL_PREPARATIONS: Treatment = {
  slug: "herbal-preparations",
  name: "Herbal Preparations",
  sanskritName: "Auṣadha",
  categoryId: "wellness-support",
  reviewStatus: "pending-clinical-review",
  image: TREATMENT_IMAGES.herbalPreparations,
  summary:
    "Internal Ayurvedic preparations, selected and adjusted by a practitioner as part of a plan rather than dispensed from a list.",
  content: {
    overview: [
      "Ayurvedic preparations are classically chosen for the person and the current imbalance rather than for the name of a complaint. Which preparation, in what form and for how long are decisions a practitioner makes after assessment, and revisits at follow-up.",
      "This page names no preparation and lists none. Nothing on a website can stand in for that assessment, and choosing a preparation for yourself is precisely what the practice is built to avoid.",
    ],
    traditionalContext: [
      "Classical Ayurveda regards the preparation, the dose, the timing and what it is taken with as parts of a single decision, alongside diet and routine.",
      "It is a traditional framework rather than a modern clinical protocol, and it is described here as such.",
    ],
    whatToExpect: [
      {
        title: "Assessment",
        description:
          "Your practitioner assesses your constitution, your current state and everything you are already taking.",
      },
      {
        title: "Selection and explanation",
        description:
          "Anything chosen is explained to you: what it is, how to take it, and for how long before it is reviewed.",
      },
      {
        title: "Review",
        description:
          "Follow-up looks at how you have actually responded, and adjusts accordingly.",
      },
    ],
    aftercare: [
      "Take what you are given exactly as it was explained, and ask if anything is unclear.",
      "Tell your practitioner about every other medicine you take, including anything bought without a prescription.",
    ],
    // Verified-safe general statements rather than an invented
    // contraindication list. See GENERAL_PRECAUTION_NOTE.
    precautions: [
      "Ayurvedic preparations are not a replacement for treatment prescribed to you by another doctor. Do not stop or change that treatment without speaking to the doctor who prescribed it.",
      "Tell your practitioner if you are pregnant, breastfeeding, or being treated for any ongoing condition.",
      "Tell your practitioner about any allergy or reaction you have had to a medicine, food or herbal product.",
    ],
  },
  relatedSlugs: ["ayurvedic-consultation", "lifestyle-guidance"],
};

const LIFESTYLE_GUIDANCE: Treatment = {
  slug: "lifestyle-guidance",
  name: "Daily Routine and Lifestyle Guidance",
  sanskritName: "Dinacaryā",
  categoryId: "wellness-support",
  reviewStatus: "pending-clinical-review",
  image: TREATMENT_IMAGES.lifestyleGuidance,
  summary:
    "Practical guidance on food, sleep, activity and the shape of a day, built around your assessment and revisited as things change.",
  content: {
    overview: [
      "In Ayurveda the ordinary parts of a day — when you eat, what you eat, when you sleep, how you move — are treated as part of care rather than as advice added at the end of it. Dinacharya is the classical term for that daily routine.",
      "Guidance here is specific and deliberately unglamorous, and it is shaped around the life you actually live. A change you cannot keep is not a useful one.",
    ],
    traditionalContext: [
      "The classical texts describe routines for the day and for the seasons, adjusted to constitution and circumstance.",
      "They are a traditional framework for daily living, not a clinical protocol, and they are presented here as such.",
    ],
    whatToExpect: [
      {
        title: "What your day looks like now",
        description:
          "Meals, sleep, work, movement and rest, described as they actually are rather than as they ought to be.",
      },
      {
        title: "What is worth changing first",
        description:
          "A small number of changes, chosen because they fit your circumstances, not because they are the full list.",
      },
      {
        title: "Review",
        description:
          "What held, what did not, and what to adjust — reviewed with your practitioner rather than assumed.",
      },
    ],
    preparation: [
      "It helps to arrive able to describe an ordinary day: meal times, sleep, work, movement and rest.",
    ],
  },
  relatedSlugs: ["ayurvedic-consultation", "herbal-preparations"],
};

/**
 * The catalogue, in the order it is presented within each category.
 *
 * Seven entries. A catalogue this size is read, not searched: the treatments
 * are grouped under three headings and every one of them is on the page at
 * once, so a search field and a filter control would both add interaction cost
 * without removing any (`phase_04.md` sections 13, 35 and 37). The point at
 * which that stops being true is recorded in `catalogue.ts`.
 */
export const TREATMENTS: readonly Treatment[] = [
  AYURVEDIC_CONSULTATION,
  PANCHAKARMA,
  ABHYANGA,
  SHIRODHARA,
  MUKHA_LEPA,
  HERBAL_PREPARATIONS,
  LIFESTYLE_GUIDANCE,
];

/* ------------------------------------------------------------------ */
/* Services page copy                                                  */
/* ------------------------------------------------------------------ */

/** Anchor ids on `/services`. Exported so the in-page nav cannot drift. */
export const SERVICES_SECTIONS = {
  selection: "how-treatment-is-chosen",
  catalogue: "all-services",
  personalization: "personalization",
  faq: "questions",
} as const;

export const SERVICES_PAGE = {
  hero: {
    eyebrow: "Services and treatments",
    title: "Ayurvedic care, chosen for the person",
    description:
      "Punarvasu offers consultation, classical Ayurvedic therapies, and guidance that continues between visits. Which of them is appropriate — and whether any of them is — is decided with you after an assessment, never before it.",
    secondaryAction: {
      label: "How treatment is chosen",
      targetId: SERVICES_SECTIONS.selection,
    },
  },
  selection: {
    eyebrow: "Before any therapy",
    title: "Assessment first. Every time.",
    description:
      "Four steps sit between an interest in a therapy and actually receiving one.",
    steps: [
      {
        title: "Consultation",
        description:
          "A full Ayurvedic assessment, including a conventional medical history and everything you are already being treated for.",
      },
      {
        title: "A judgement, not a menu",
        description:
          "Your practitioner decides what is appropriate for you. Sometimes that is a therapy on this page. Sometimes it is not a therapy at all.",
      },
      {
        title: "Agreement",
        description:
          "Whatever is suggested is explained to you first — what it involves, what it asks of you, and what it does not do.",
      },
      {
        title: "Review",
        description:
          "How you actually respond is what adjusts the plan. Nothing is fixed at the first visit.",
      },
    ] as const satisfies readonly TreatmentStep[],
  },
  catalogue: {
    eyebrow: "What we offer",
    title: "Services and therapies",
    description:
      "Grouped by what they are for. Each page explains what a therapy is and what happens during it. None of them tells you whether it is right for you.",
  },
  featured: {
    eyebrow: "Where most people begin",
    title: "Three starting points",
    description:
      "Most first visits involve one of these. They are the most asked about, not the most recommended — Punarvasu does not recommend a therapy before meeting you.",
  },
  personalization: {
    title: "Why this page will not recommend a treatment",
    paragraphs: [
      "In Ayurveda the same complaint in two people can have two different causes, and two different paths back. A website cannot see your constitution, your history, your digestion or the medicines you already take, so it cannot responsibly tell you which therapy you need. A page that did would be selling rather than practising.",
      "Read these pages to understand what a therapy is and what receiving it is actually like. Bring the questions they raise to a consultation, where someone can answer them properly.",
    ],
  },
  faq: {
    eyebrow: "Questions",
    title: "Before you choose",
    description:
      "If your question is not answered here, ask it when you request a consultation — we would rather answer it properly than approximately.",
  },
  cta: {
    title: "Not sure where to begin?",
    description:
      "That is the usual starting point. A consultation is a conversation first: tell us what brought you here, and your practitioner will take it from there.",
    secondaryLabel: "Read our approach",
  },
} as const;

/**
 * PLACEHOLDER — requires clinic confirmation.
 *
 * Each answer is written so that it stays true whatever Punarvasu's specific
 * policies turn out to be, because those policies have not been supplied.
 * Questions whose only useful answer is a fact we do not hold — what a
 * treatment costs, how long it takes — are answered by saying so, rather than
 * with an estimate.
 */
export const SERVICES_FAQ_ITEMS: readonly TreatmentFaq[] = [
  {
    id: "which-treatment",
    question: "Which treatment should I choose?",
    answer:
      "That is the one question these pages deliberately do not answer. Suitability depends on your constitution, your history and anything you are already being treated for, and it is assessed individually at consultation. Read the pages to understand what each therapy is; bring the choice itself to your practitioner.",
  },
  {
    id: "consultation-first",
    question: "Do I need a consultation before a therapy?",
    answer:
      "Whether a therapy is appropriate for you is a clinical judgement, and making that judgement is what a consultation is for. The clinic's specific booking arrangements will be published here alongside online booking.",
  },
  {
    id: "duration-and-cost",
    question: "How long does a treatment take, and what does it cost?",
    answer:
      "Punarvasu has not published durations or fees, and we will not estimate them here — a number invented for a website is worse than no number at all. Both will appear on these pages once the clinic has confirmed them.",
  },
  {
    id: "alongside-treatment",
    question: "Can I have Ayurvedic treatment alongside my current medicine?",
    answer:
      "Tell your practitioner about every medicine and treatment you are receiving. Ayurvedic care is not a replacement for treatment prescribed to you by another doctor, and you should not stop or change that treatment without speaking to the doctor who prescribed it.",
  },
  {
    id: "full-range",
    question: "Is this the complete list of services?",
    answer:
      "Not yet. The list on this page is development content awaiting confirmation by the clinic, so entries may change and others may be added. If you are looking for something you cannot see here, ask when you request a consultation.",
  },
  {
    id: "urgent",
    question: "What if my problem is urgent?",
    answer: EMERGENCY_NOTE,
  },
];
