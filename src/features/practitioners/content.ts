/**
 * Practitioner roster and page copy.
 *
 * ## Content status - read before changing anything here
 *
 * **Both practitioners below were supplied by the clinic** - name,
 * designation, qualifications, areas of focus and experience - and are
 * published exactly as given. Qualifications keep the clinic's own
 * abbreviations; nothing is expanded or inferred (`types.ts`).
 *
 * Two things are still stand-ins:
 *
 *   - **Photographs.** The two portraits in `config/images.ts` are the site's
 *     existing practitioner photographs, used at the clinic's request until
 *     portraits of these doctors are supplied. Their alt text stays honest,
 *     and the profile modal notes that the photograph is representative.
 *   - **Registration numbers.** PLACEHOLDER - dummy values in the council's
 *     format, to be replaced with the real numbers before launch.
 *
 * And one thing was edited:
 *
 *   - **Outcome language.** "Specialises in ... treatments" became "focuses
 *     on", and nothing says what a practitioner's care will achieve
 *     (`docs/HEALTHCARE_AND_AI_SAFETY.md`, `PROFILE_CONSULTATION_NOTE`).
 *
 * ## Adding a practitioner
 *
 * Add a `published` entry. That is the entire change: the card, the profile
 * page, `generateStaticParams`, the sitemap and the home and About previews
 * all read through `directory.ts`. A `pending-verification` entry is still
 * available for someone the clinic has not yet confirmed - the type does not
 * let it carry a name (`phase_05.md` sections 17-18 and 21).
 */

import { PRACTITIONER_IMAGES } from "@/config/images";

import type { Practitioner } from "./types";

/** VERIFIED - supplied by the clinic. Order is the clinic's own. */
export const PRACTITIONERS: readonly Practitioner[] = [
  {
    slug: "dr-samir-shinde",
    status: "published",
    name: "Dr. Samir Shinde",
    designation: "Chief Physician",
    qualifications: ["M.D.", "M.H.A."],
    specialties: ["Panchakarma", "Lifestyle disorders"],
    experience: "Over 15 years in Ayurvedic medicine",
    // PLACEHOLDER - dummy number; replace with the real registration.
    registrationNumber: "I-00000-A",
    image: PRACTITIONER_IMAGES.one,
    shortBio:
      "Chief Physician at Punarvasu, with a particular focus on classical Panchakarma therapies and on lifestyle disorders.",
    biography: [
      "Dr. Samir Shinde has practised Ayurvedic medicine for over 15 years. His work centres on the traditional Panchakarma therapies, and on the lifestyle disorders that grow out of how people eat, sleep and work today.",
    ],
  },
  {
    slug: "dr-shubhangi-shinde",
    status: "published",
    name: "Dr. Shubhangi Shinde",
    designation: "Senior Ayurvedic Consultant",
    qualifications: ["B.A.M.S.", "PGDEMS"],
    specialties: ["Women's health", "Nutrition"],
    // PLACEHOLDER - dummy number; replace with the real registration.
    registrationNumber: "I-00000-B",
    image: PRACTITIONER_IMAGES.two,
    shortBio:
      "Senior Ayurvedic Consultant, with a focus on women's health, nutrition counselling and holistic wellbeing.",
    biography: [
      "Dr. Shubhangi Shinde brings experience in women's health, nutrition counselling and holistic approaches to wellbeing, combining the classical understanding of Ayurveda with a modern understanding of health.",
    ],
  },
];

/** Anchor ids for the practitioners page. */
/**
 * The practitioners' introduction, shown on the home page's preview.
 *
 * There is no `/practitioners` page any more: the home and About pages both
 * introduce the doctors, and each full profile opens in a modal
 * (`PractitionerProfileDialog`).
 */
export const PRACTITIONERS_PAGE = {
  hero: {
    eyebrow: "Our practitioners",
    title: "The people you will actually sit with",
    description:
      "Ayurvedic care is a relationship before it is a prescription. Meet the practitioners who carry out consultations at Punarvasu.",
  },
} as const;

/**
 * The profile modal's section headings.
 *
 * Exported so the modal and its tests name sections from one place, and so
 * a section with no confirmed content leaves no empty heading behind.
 */
export const PROFILE_SECTION_TITLES = {
  biography: "About the practitioner",
  specialties: "Areas of focus",
  approach: "Approach to care",
  qualifications: "Qualifications",
  registration: "Registration no.",
  experience: "Experience",
  languages: "Languages",
} as const;

/**
 * Shown in every profile.
 *
 * `phase_05.md` section 44: a practitioner CTA must not imply that choosing a
 * particular person guarantees a particular result.
 */
export const PROFILE_CONSULTATION_NOTE =
  "Which practitioner you see does not change how care is decided here. Every plan follows an assessment, and no practitioner can tell you in advance what a therapy will do for you.";
