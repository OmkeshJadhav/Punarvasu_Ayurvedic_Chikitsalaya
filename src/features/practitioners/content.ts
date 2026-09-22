/**
 * Practitioner roster and page copy.
 *
 * ## Content status - read before changing anything here
 *
 * **No practitioner has been verified for publication.** Punarvasu has not
 * supplied a name, a qualification, a registration number or a specialisation
 * for anybody, so the roster below holds two `pending-verification`
 * placeholders and nothing else. The type does not let a placeholder carry a
 * name, and `content-safety.test.ts` fails the build if one appears
 * (`docs/implementation-plan/phase_05.md` sections 17-18, 21 and 77).
 *
 * The page copy is about *how practitioners work at this clinic*, which is
 * describable without asserting anything about a particular clinician.
 *
 * ## Publishing a practitioner
 *
 * Replace a placeholder with a `published` entry. That is the entire change:
 * the card, the profile page, `generateStaticParams`, the sitemap and the
 * About page's preview all read through `directory.ts`.
 */

import { PRACTITIONER_IMAGES } from "@/config/images";

import type { Practitioner } from "./types";

/**
 * PLACEHOLDER - no practitioner has been verified.
 *
 * Two entries, because the placeholder photographs in `config/images.ts` are
 * two. That is the only thing the count reflects: it is not a claim that the
 * clinic has two practitioners, and no copy on the page states a number.
 */
export const PRACTITIONERS: readonly Practitioner[] = [
  {
    slug: "practitioner-profile-1",
    status: "pending-verification",
    image: PRACTITIONER_IMAGES.one,
  },
  {
    slug: "practitioner-profile-2",
    status: "pending-verification",
    image: PRACTITIONER_IMAGES.two,
  },
];

/** Anchor ids for the practitioners page. */
export const PRACTITIONERS_SECTIONS = {
  roster: "profiles",
  working: "how-we-work",
} as const;

export const PRACTITIONERS_PAGE = {
  hero: {
    eyebrow: "Our practitioners",
    title: "The people you will actually sit with",
    description:
      "Ayurvedic care is a relationship before it is a prescription. This page introduces the practitioners who carry out consultations at Punarvasu.",
  },

  roster: {
    eyebrow: "Practitioner profiles",
    title: "Who you will meet",
    description:
      "Each profile carries a practitioner's own name, qualifications and areas of focus, exactly as the clinic has confirmed them.",
  },

  /**
   * The unpublished state, as visible copy.
   *
   * A visitor who came here to answer "who will care for me?" is owed a
   * straight answer, including when the answer is "we have not published that
   * yet". Saying so is more trustworthy than a row of stock portraits with
   * invented credentials under them (`phase_05.md` sections 21 and 77).
   */
  unpublishedNotice: {
    title: "Practitioner profiles are being prepared",
    body: "Punarvasu has not yet confirmed its practitioners' names, qualifications and registration details for publication, so this page does not state them. We would rather leave a profile blank than publish a credential we have not checked. The photographs below are placeholders and are not of the clinic's practitioners. Please call the clinic if you would like to know who you will be seeing.",
  },

  emptyState: {
    title: "No practitioner profiles yet",
    description:
      "Profiles appear here once the clinic has confirmed them. In the meantime the clinic can answer any question about who carries out consultations.",
  },

  /**
   * How practitioners work here.
   *
   * Prose rather than a fourth numbered sequence on this website. The
   * consultation method is set out step by step on `/about`, and repeating it
   * here would make the two pages read as one page twice
   * (`phase_05.md` section 13).
   */
  working: {
    eyebrow: "How we work",
    title: "One method, whoever you see",
    paragraphs: [
      "Punarvasu does not run parallel styles of practice. Whoever you consult takes the same kind of history, assesses the same way, and explains what they found before anything is decided. That matters more than which name is on the appointment: a clinic where the answer depends on who you happened to get is not practising a method, it is improvising.",
      "It also means you are not asked to choose a practitioner on the strength of a photograph. If you have a preference, say so when you contact the clinic and it will be accommodated where possible.",
    ],
    approachLinkLabel: "Read our approach to care",
  },

  cta: {
    title: "Meet a practitioner",
    description:
      "A first consultation is a conversation. Tell us what brought you here, and we will arrange a time.",
    secondaryLabel: "Visit the clinic",
  },
} as const;

/**
 * The profile page's section headings.
 *
 * Exported so the profile component and its tests name sections from one
 * place, and so a section with no confirmed content leaves no empty heading
 * behind.
 */
export const PROFILE_SECTION_TITLES = {
  biography: "About the practitioner",
  specialties: "Areas of focus",
  approach: "Approach to care",
  qualifications: "Qualifications",
  languages: "Languages",
} as const;

/**
 * Shown on every profile page.
 *
 * `phase_05.md` section 44: a practitioner CTA must not imply that choosing a
 * particular person guarantees a particular result.
 */
export const PROFILE_CONSULTATION_NOTE =
  "Which practitioner you see does not change how care is decided here. Every plan follows an assessment, and no practitioner can tell you in advance what a therapy will do for you.";
