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
 *   - **Why the clinic was founded, by whom, and when** has not been supplied
 *     to this repository. There is therefore no founder story here and none
 *     may be written (`docs/implementation-plan/phase_05.md` sections 9-10).
 *     `ABOUT_REVIEW_NOTICE` says so on the page.
 *   - **How the clinic practises** is describable: it is the same method the
 *     rest of this site already commits to publicly.
 *   - **No outcome, no ranking, no statistic, no credential.**
 *     `content-safety.test.ts` fails the build if one appears.
 *
 * The section headings avoid the generic "Mission / Vision / Values" shape
 * deliberately (`phase_05.md` section 64). Each heading answers a question a
 * visitor actually has.
 */

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
    description:
      "Punarvasu is an Ayurvedic clinic in Satara, built around one unfashionable idea - that care should begin by understanding a person, and that this takes longer than it is usually given.",
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
  },

  purpose: {
    eyebrow: "Why Punarvasu exists",
    title: "For the questions a short appointment cannot hold",
    paragraphs: [
      "Most people arrive here having already been somewhere else. They have a diagnosis, or several, and a set of instructions that made sense on their own but never quite added up to a way of living. What they have rarely had is an unhurried conversation about the whole of it — sleep, digestion, work, season, appetite, and the years that led up to the complaint.",
      "That conversation is what Punarvasu is organised around. Ayurveda begins from the view that the same complaint in two people can have two different causes, and therefore two different paths back. You cannot find which one applies without asking, and you cannot ask properly in a hurry.",
    ],
  },

  beliefs: {
    eyebrow: "What we believe",
    title: "Ayurveda as a way of understanding, not a catalogue of remedies",
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
          "Where this site has no confirmed answer — a practitioner's qualification, the clinic's hours — it says so rather than filling the gap.",
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

  practitioners: {
    eyebrow: "The people behind it",
    title: "Who you will meet",
    description:
      "Consultations at Punarvasu are carried out by qualified Ayurvedic practitioners.",
    linkLabel: "See our practitioners",
  },

  cta: {
    title: "Come and be asked the long questions",
    description:
      "A first consultation is a conversation before it is anything else. Tell us what brought you here, and your practitioner will take it from there.",
    secondaryLabel: "Explore treatments",
  },
} as const;

/**
 * The About page's content-review notice.
 *
 * Phase 04 established that unverified copy says so to the reader rather than
 * only in a source comment. The same applies here, and more sharply: the
 * clinic's own story is exactly the part a visitor would assume came from the
 * clinic.
 */
export const ABOUT_REVIEW_NOTICE = {
  title: "This page is awaiting the clinic's review",
  body: "Punarvasu has not yet supplied its own account of how and why the clinic was founded, so none is given here. What you are reading describes how the clinic practises and what the name means; it has been prepared for review and has not been signed off. Nothing on this page states anything about a particular practitioner.",
} as const;
