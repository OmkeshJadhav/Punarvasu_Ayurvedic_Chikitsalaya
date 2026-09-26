/**
 * The treatment content model.
 *
 * ## What this model deliberately does not have
 *
 * There is no `price`, no `duration`, no `availability` and no `rating` field.
 * Their absence is the design, not an omission: a field that exists gets
 * filled, and none of those values has been supplied by the clinic. Adding
 * `duration?: string` now is how "60 minutes" ends up on a healthcare site
 * because it is "typical elsewhere" (`docs/implementation-plan/phase_04.md`
 * sections 30-32, `docs/HEALTHCARE_AND_AI_SAFETY.md` section 2).
 *
 * When the clinic supplies verified values, the field is added in the same
 * change that adds the data.
 *
 * ## Review status
 *
 * `reviewStatus` is a required field rather than an optional flag, so a
 * treatment cannot be added without someone stating whether a clinician has
 * approved its wording. The UI reads it and marks unreviewed content visibly.
 *
 * ## Optional sections
 *
 * Every section of `TreatmentContent` except `overview` is optional, and the
 * detail page renders a heading only when the section has content. A treatment
 * with no verified aftercare guidance shows no "Aftercare" heading rather than
 * an empty one (`phase_04.md` section 60).
 */

import type { ImageAsset } from "@/config/images";

/**
 * Whether a qualified person at the clinic has approved this content for
 * publication.
 *
 * `pending-clinical-review` is the honest default for everything written by a
 * developer. The value is surfaced to visitors, not just to the team.
 */
export type TreatmentReviewStatus = "verified" | "pending-clinical-review";

/** Category identifiers. A union, so a treatment cannot invent a category. */
export type TreatmentCategoryId =
  "consultations" | "therapies" | "wellness-support";

export interface TreatmentCategory {
  readonly id: TreatmentCategoryId;
  /** Full name, used as the section heading. */
  readonly name: string;
  /** One sentence describing what belongs in this group. */
  readonly description: string;
}

/** One stage of a treatment, as the visitor experiences it. */
export interface TreatmentStep {
  readonly title: string;
  readonly description: string;
}

export interface TreatmentFaq {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface TreatmentContent {
  /** Always present. Short paragraphs, not an essay. */
  readonly overview: readonly string[];
  /**
   * How the therapy is described within the Ayurvedic tradition.
   *
   * Rendered under a heading that names it as traditional context, so a
   * classical description is never mistaken for a claim of clinical evidence
   * (`phase_04.md` section 26).
   */
  readonly traditionalContext?: readonly string[];
  /** What happens, in order, from the visitor's point of view. */
  readonly whatToExpect?: readonly TreatmentStep[];
  readonly preparation?: readonly string[];
  readonly aftercare?: readonly string[];
  /**
   * Verified contraindications only.
   *
   * When the clinic has not supplied any, this stays empty and the page shows
   * the general "discuss your history with your practitioner" guidance
   * instead. An invented contraindication list is worse than none
   * (`phase_04.md` section 29).
   */
  readonly precautions?: readonly string[];
  readonly faqs?: readonly TreatmentFaq[];
}

export interface Treatment {
  /** Lowercase, hyphenated, URL-safe, stable. Validated in the catalogue test. */
  readonly slug: string;
  readonly name: string;
  /**
   * The classical Sanskrit term, transliterated, where the treatment has one
   * and the English name differs from it. Presentational only - it is never
   * the slug.
   */
  readonly sanskritName?: string;
  readonly categoryId: TreatmentCategoryId;
  /**
   * One or two sentences. Used on the card, in the hero and as the page's
   * meta description, so it has to read correctly out of context.
   */
  readonly summary: string;
  /**
   * A single short line for the compact tiles on `/services`, where the full
   * summary would crowd a row of photographs. It describes what the therapy
   * *is*, like the summary, and is held to the same content-safety rules.
   */
  readonly teaser: string;
  /**
   * `undefined` where no photograph honestly depicts this treatment. The card
   * and the hero both handle its absence; no stock image is pressed into
   * service to fill a frame.
   */
  readonly image?: ImageAsset;
  readonly reviewStatus: TreatmentReviewStatus;
  /** Surfaces this treatment in the "where most people begin" group. */
  readonly featured?: boolean;
  readonly content: TreatmentContent;
  /**
   * Content navigation, not a medical recommendation
   * (`phase_04.md` sections 33-34). Slugs are resolved and validated by the
   * catalogue; an unknown one fails the test rather than rendering a dead card.
   */
  readonly relatedSlugs?: readonly string[];
}
