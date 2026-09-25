/**
 * About page content.
 *
 * ## Read this before changing a sentence
 *
 * Everything a visitor reads on `/about` lives here, so that a clinician or
 * the clinic's owner can review it as content without opening a React
 * component - the same rule `features/services/content.ts` follows.
 *
 * ## What this file may and may not say
 *
 *   - **The meaning of the word "Punarvasu"** is a statement about Sanskrit
 *     and about classical Indian astronomy. It is checkable, and it is
 *     phrased as what the word means rather than as why the clinic chose it.
 *   - **The clinic's own account of itself** - founded in 2010 in Satara,
 *     Panchakarma, diet counselling, its own pharmacy - was supplied by the
 *     clinic and is `purpose` below. It was edited only where a sentence made
 *     a therapeutic promise ("treat the root cause of ailments", "empower you
 *     to achieve sustainable wellness"): each became a description of what
 *     the clinic does rather than of what it will achieve. Nothing was added.
 *   - **Why the name was chosen** has still not been supplied, and the name
 *     chapter still says so.
 *   - **How the clinic practises** is describable: it is the same method the
 *     rest of this site already commits to publicly.
 *   - **No outcome, no ranking, no statistic, no practitioner by name.**
 *     `content-safety.test.ts` fails the build if one appears.
 *
 * The section headings avoid the generic "Mission / Vision / Values" shape
 * deliberately (`phase_05.md` section 64). Each heading answers a question a
 * visitor actually has.
 */

import { CLINIC_IDENTITY } from "@/config/clinic";

/** Anchor ids for the about page's sections. */
export const ABOUT_SECTIONS = {
  name: "the-name",
  purpose: "why-punarvasu-exists",
  beliefs: "what-we-believe",
  approach: "approach",
  commitments: "commitments",
  clinic: "the-clinic",
  practitioners: "practitioners",
} as const;

export const ABOUT_PAGE = {
  hero: {
    eyebrow: "About Punarvasu",
    title: "A quieter way to practise Ayurveda",
    titleEmphasis: "Ayurveda",
    description:
      "Founded in 2010, Punarvasu is an Ayurvedic clinic in Satara built around one unfashionable idea — that care should begin by understanding a person, and that this takes longer than it is usually given.",
  },

  /**
   * The name.
   *
   * Etymology and nakshatra reference only. The clinic's own reason for
   * choosing the name is explicitly not stated, because it has not been
   * supplied.
   */
  name: {
    eyebrow: "The name",
    title: "What Punarvasu means",
    paragraphs: [
      "In Sanskrit, punar means “again”, and vasu carries a sense of light, goodness and wellbeing. Punarvasu is also the name of a nakshatra — one of the lunar mansions of classical Indian astronomy — and the word is commonly read as a return: of light, of what was there before.",
      "The clinic has not published its own account of why the name was chosen, so this page does not offer one. What the word points at, though, is the shape of the work: not adding something new to a person, but helping what was already working find its way back.",
    ],
    devanagariLabel: "Punarvasu, written in Devanagari",
    titleEmphasis: "Punarvasu",
    /**
     * The two halves of the word, restating the first paragraph as a gloss.
     * No meaning here goes beyond what that paragraph already says.
     */
    glossary: [
      {
        devanagari: "पुनर्",
        term: "punar",
        meaning: "“again” — a return, a second time",
      },
      {
        devanagari: "वसु",
        term: "vasu",
        meaning: "light, goodness, wellbeing",
      },
    ],
    archCaption: "The return of light",
  },

  /**
   * The clinic's story, in its own words.
   *
   * VERIFIED - supplied by the clinic. Kept under the `purpose` key and the
   * `why-punarvasu-exists` anchor so existing links keep working. See the
   * file header for the edits made to it.
   */
  purpose: {
    eyebrow: "Our story",
    title: "Caring for Satara since 2010",
    titleEmphasis: "since 2010",
    paragraphs: [
      "Founded in 2010, Punarvasu Ayurveda Chikitsalaya has been a place of holistic Ayurvedic care in Satara. The clinic brings the classical wisdom of Ayurveda together with modern diagnostic understanding, and looks for the root cause of a complaint rather than only its symptoms.",
      "Care here includes classical Panchakarma therapies, personalised diet counselling, and a pharmacy stocked with authentic Ayurvedic formulations. The clinic itself is kept calm by design — a place to step away from the pace of daily life and attend to your own balance.",
      "At Punarvasu, health is understood as a harmony of body, mind and spirit. The clinic's practitioners build each treatment plan around the person in front of them, with the aim of wellbeing that fits, and lasts, in an ordinary life.",
    ],
  },

  beliefs: {
    eyebrow: "What we believe",
    title: "Ayurveda as a way of understanding, not a catalogue of remedies",
    titleEmphasis: "not a catalogue of remedies",
    paragraphs: [
      "Practised carefully, Ayurveda is unglamorous and specific. It reads health as balance — of constitution, of digestion, of the rhythm of a day and a season — and it attends to the person an imbalance belongs to rather than to the name the imbalance has been given.",
      "Most of what follows from that is ordinary: what you eat, when you eat it, when you sleep, how you work, what your body has been doing for years. The ordinariness is the point. Guidance that cannot survive contact with a real week is not guidance.",
    ],
    principles: [
      {
        title: "The person before the complaint",
        description:
          "An assessment starts with who you are and how you live, and reaches the presenting problem on the way through.",
      },
      {
        title: "Nothing before an assessment",
        description:
          "No therapy, preparation or regimen is chosen for anyone at Punarvasu before they have been seen and assessed.",
      },
      {
        title: "Alongside, not instead",
        description:
          "Ayurvedic care sits beside the care you already receive. Your practitioner needs to know about all of it.",
      },
      {
        title: "Correction over prescription",
        description:
          "How your body actually responds is better information than any plan written on the first day, so plans here are meant to change.",
      },
    ],
  },

  /**
   * How a consultation is actually conducted.
   *
   * Deliberately different from the home page's "What happens after you
   * book", which is the visitor's itinerary - this is the practitioner's
   * method inside the room (`phase_05.md` section 13). The two link to each
   * other rather than repeating one another.
   */
  approach: {
    eyebrow: "Our approach to care",
    title: "What your practitioner does with the time",
    titleEmphasis: "does with the time",
    description:
      "The same method, whoever you see. It is the part of a visit that decides everything after it.",
    steps: [
      {
        title: "Listen",
        description:
          "You describe what brought you here in your own words, without being interrupted into a category.",
      },
      {
        title: "Ask wider",
        description:
          "Digestion, sleep, appetite, energy, work, season and routine — and everything you are already being cared for, by anyone.",
      },
      {
        title: "Assess",
        description:
          "A classical Ayurvedic assessment of constitution and current imbalance, read alongside your conventional medical history rather than instead of it.",
      },
      {
        title: "Explain",
        description:
          "What the assessment found, in language you can act on — and, just as importantly, what it does not tell us.",
      },
      {
        title: "Agree",
        description:
          "Nothing begins without your understanding of what it involves, what it asks of you and what it does not do.",
      },
      {
        title: "Review",
        description:
          "You are seen again as things change, and the plan is adjusted to match what actually happened.",
      },
    ],
    journeyLinkLabel: "See what happens after you book",
  },

  /**
   * Differentiators, stated as commitments rather than adjectives.
   *
   * Every line here is a rule this website already visibly follows, which is
   * why it can be published without clinical sign-off: these are statements
   * about conduct, not about outcomes (`phase_05.md` section 15).
   */
  commitments: {
    eyebrow: "What makes Punarvasu different",
    title: "Four things we will not do",
    titleEmphasis: "will not",
    description:
      "A difference is easier to trust when it is stated as a limit rather than as an adjective.",
    items: [
      {
        title: "We will not choose a therapy before meeting you",
        description:
          "Not on this website, not over the phone, and not from a description of your symptoms. An assessment comes first, every time.",
      },
      {
        title: "We will not promise you an outcome",
        description:
          "Nobody can honestly tell you in advance what a therapy will do for your body. A practitioner who does is selling rather than practising.",
      },
      {
        title: "We will not ask you to stop your other care",
        description:
          "Never stop or change medication prescribed to you by another doctor because of something said here. Tell your practitioner about all of it instead.",
      },
      {
        title: "We will not publish what we have not checked",
        description:
          "Everything this site states about the clinic and its practitioners came from the clinic. Where there is no confirmed answer, it says so rather than filling the gap.",
      },
    ],
  },

  /**
   * The clinic itself.
   *
   * No photographs of the clinic's own rooms have been supplied, so none is
   * shown and none is implied (`phase_05.md` sections 23-24 and 68). What can
   * be said truthfully is where it is and what visiting involves.
   */
  clinic: {
    eyebrow: "The clinic",
    title: "Where Punarvasu is",
    paragraphs: [
      "The clinic is on the first floor of Samruddhi 7 Apartment, near Sai Baba Mandir Road in Godoli, Satara. Consultations and therapies are carried out there.",
      "Photographs of the clinic's own consulting and treatment rooms have not been published yet, and this site does not use stock photography to stand in for them. The contact page carries the full address, a map and directions.",
    ],
    linkLabel: "Visit the clinic",
  },

  /**
   * Editorial figures.
   *
   * Set large, the way a prospectus sets its numbers. The founding year was
   * supplied by the clinic; the other two are counts of what this page itself
   * commits to, so each is true by construction. There is no patient count
   * and no therapy count, because none has been supplied (`phase_05.md`
   * section 15); when the clinic confirms one, it belongs in this list with
   * its source noted beside it.
   */
  figures: {
    eyebrow: "In numbers",
    title: "Three figures we can stand behind",
    items: [
      {
        value: String(CLINIC_IDENTITY.foundedYear),
        label: "the year Punarvasu opened in Satara",
        detail: "Caring for the town ever since.",
      },
      {
        value: "6",
        label: "steps in every consultation",
        detail: "The same method, whoever you see.",
      },
      {
        value: "0",
        label: "therapies chosen before you are assessed",
        detail: "Not online, not over the phone.",
      },
    ],
  },

  practitioners: {
    eyebrow: "The people behind it",
    title: "Who you will meet",
    description:
      "Consultations at Punarvasu are carried out by qualified Ayurvedic practitioners. Open a profile for their full details.",
  },

  cta: {
    title: "Your healthier tomorrow begins here",
    titleEmphasis: "begins here",
    description:
      "A first consultation is a conversation before it is anything else. Tell us what brought you here, and your practitioner will take it from there.",
    secondaryLabel: "Explore treatments",
  },
} as const;

/**
 * Patient testimonials.
 *
 * **Empty, and it must stay empty until each entry is real.** A testimonial
 * on a clinic's website is read as evidence, so every entry needs the
 * patient's written consent to publish, the words exactly as they gave them,
 * and a clinician's check that the quote makes no claim the clinic could not
 * make itself. The type requires the consent record so an entry cannot be
 * added without one. `TestimonialsSection` renders nothing while the list is
 * empty (`docs/HEALTHCARE_AND_AI_SAFETY.md`).
 */
export interface Testimonial {
  readonly id: string;
  readonly quote: string;
  /** As the patient agreed to be named - often a first name and a town. */
  readonly attribution: string;
  /** Where the signed consent is kept, e.g. a document reference. */
  readonly consentRecord: string;
}

export const ABOUT_TESTIMONIALS: readonly Testimonial[] = [];
