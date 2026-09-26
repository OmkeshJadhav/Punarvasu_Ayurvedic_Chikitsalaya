/**
 * Patient testimonials.
 *
 * ## Read before adding an entry
 *
 * A testimonial on a clinic's website is read as evidence, so every published
 * entry needs three things: the patient's written consent to publish, their
 * words exactly as they gave them, and a clinician's check that the quote
 * makes no claim the clinic could not make itself
 * (`docs/HEALTHCARE_AND_AI_SAFETY.md` section 2). `Testimonial` requires the
 * consent reference so an entry cannot be added without someone writing down
 * where that consent lives.
 *
 * ## Placeholders
 *
 * `PLACEHOLDER_TESTIMONIALS` exist so the layout can be judged with more than
 * one quote in it. They are obviously placeholder text - no invented name, no
 * invented words - and `getDisplayTestimonials` drops them from production
 * builds entirely, so they cannot ship by accident
 * (`docs/implementation-plan/phase_03.md` section 25, option A).
 */
export interface Testimonial {
  readonly id: string;
  readonly quote: string;
  /** As the patient agreed to be named - often a first name and a town. */
  readonly attribution: string;
  /** Where the signed consent is kept, e.g. a document reference. */
  readonly consentRecord: string;
}

/** A testimonial as a page renders it. */
export interface DisplayTestimonial {
  readonly id: string;
  readonly quote: string;
  readonly attribution: string;
  /** Rendered with a visible "Placeholder" label. */
  readonly placeholder: boolean;
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    id: "balanced-and-at-peace",
    quote:
      "I feel more balanced, energetic and at peace. The care felt truly personal, not generic.",
    attribution: "A Punarvasu patient",
    // TODO(clinic): replace with the reference to this patient's signed
    // consent before launch. The quote is real; the record is not yet filed.
    consentRecord: "[Consent reference — to be supplied by clinic]",
  },
];

export const PLACEHOLDER_TESTIMONIALS: readonly Omit<
  DisplayTestimonial,
  "placeholder"
>[] = [
  {
    id: "placeholder-1",
    quote:
      "[Placeholder — a patient's own words will appear here once they have given written consent to publish them.]",
    attribution: "[Patient attribution pending]",
  },
  {
    id: "placeholder-2",
    quote:
      "[Placeholder — reserved for a second consented patient testimonial.]",
    attribution: "[Patient attribution pending]",
  },
];

/**
 * The testimonials a page should render.
 *
 * Placeholders are included everywhere except a production build, which is
 * decided at build time: `NODE_ENV` is inlined by Next.js, so the placeholder
 * strings are not even present in the production bundle's rendered HTML.
 */
export function getDisplayTestimonials(
  includePlaceholders: boolean = process.env.NODE_ENV !== "production",
): readonly DisplayTestimonial[] {
  const real = TESTIMONIALS.map(({ id, quote, attribution }) => ({
    id,
    quote,
    attribution,
    placeholder: false,
  }));

  if (!includePlaceholders) {
    return real;
  }

  return [
    ...real,
    ...PLACEHOLDER_TESTIMONIALS.map((entry) => ({
      ...entry,
      placeholder: true,
    })),
  ];
}
