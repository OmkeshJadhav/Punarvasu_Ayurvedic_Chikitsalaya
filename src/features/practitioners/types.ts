/**
 * The practitioner content model.
 *
 * ## The rule this model exists to enforce
 *
 * A clinician's name, qualification, registration and years of practice are
 * facts a patient decides on. Inventing any of them is not a content
 * shortcut — it is the most damaging thing this website could do
 * (`docs/implementation-plan/phase_05.md` sections 17-18 and 21,
 * `docs/HEALTHCARE_AND_AI_SAFETY.md` section 2).
 *
 * So the model is built around a single discriminant. A `published`
 * practitioner carries a real name and whatever the clinic has confirmed; a
 * `pending-verification` placeholder carries **no descriptive field at all**,
 * because there is nothing true to put in one. The type makes the second case
 * impossible to fill in by accident: the fields simply are not there.
 *
 * ## What is deliberately absent
 *
 * There is no `rating`, no `patientCount`, no `awards` and no `availability`.
 * A field that exists gets filled. When the clinic supplies verified values,
 * the field is added in the same change that adds the data.
 *
 * `experience` is a free-text string rather than a number of years, so that
 * the only way to state it is to quote what the clinic actually said.
 */

import type { ImageAsset } from "@/config/images";

/**
 * Whether the clinic has confirmed this person's details for publication.
 *
 * Surfaced to visitors, not just to the team: a placeholder card says it is a
 * placeholder, and a placeholder gets no profile page.
 */
export type PractitionerStatus = "published" | "pending-verification";

/** Everything the clinic has confirmed about a real practitioner. */
export interface PublishedPractitionerDetails {
  readonly name: string;
  /** Professional title, e.g. "Ayurvedic Physician". Verified only. */
  readonly designation?: string;
  /** Exactly as awarded. Never expanded, abbreviated or inferred. */
  readonly qualifications?: readonly string[];
  /** Areas of focus. Never a list of conditions the person claims to resolve. */
  readonly specialties?: readonly string[];
  /** One or two sentences for the listing card. */
  readonly shortBio?: string;
  /** Paragraphs for the profile page. */
  readonly biography?: readonly string[];
  /** How this practitioner works with a patient. Their own words where possible. */
  readonly approach?: readonly string[];
  /**
   * The practitioner's registration with the state medical council, exactly
   * as it appears on the certificate.
   */
  readonly registrationNumber?: string;
  /** As stated by the clinic, e.g. "In practice since 2014". */
  readonly experience?: string;
  readonly languages?: readonly string[];
  readonly image?: ImageAsset;
}

interface PractitionerBase {
  /** Lowercase, hyphenated, URL-safe, stable. Validated in the directory test. */
  readonly slug: string;
}

export interface PublishedPractitioner
  extends PractitionerBase, PublishedPractitionerDetails {
  readonly status: "published";
}

/**
 * A place in the roster that a real person will occupy.
 *
 * It exists so the listing page can say truthfully how many practitioners the
 * clinic has *slots* for without naming anyone — and so the photograph, which
 * is a marked placeholder, is never captioned with a name.
 *
 * It has a slug for React keys and test fixtures only. It is never routable:
 * `getPractitionerSlugs` returns published slugs alone, so
 * `/practitioners/<placeholder-slug>` is a 404 like any other unknown slug.
 */
export interface PendingPractitioner extends PractitionerBase {
  readonly status: "pending-verification";
  /** A marked placeholder whose alt text says it is one. */
  readonly image?: ImageAsset;
}

export type Practitioner = PublishedPractitioner | PendingPractitioner;

export function isPublished(
  practitioner: Practitioner,
): practitioner is PublishedPractitioner {
  return practitioner.status === "published";
}
