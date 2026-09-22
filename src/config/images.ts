/**
 * Image references.
 *
 * Every photograph the public site uses is declared here once, with its real
 * intrinsic dimensions and its alt text, so that:
 *
 *   - replacing a file is a one-line change in one file (`docs/implementation-plan/phase_03.md` section 11);
 *   - `width`/`height` are always correct, which is what stops layout shift;
 *   - alt text is reviewed as content rather than typed inline at 2am.
 *
 * ## Provenance - read before publishing
 *
 * `logo` is the clinic's own artwork and is the only verified brand asset in
 * this repository.
 *
 * Every other image here is a **stock/generated placeholder**. None of it is
 * photography of the Punarvasu clinic, its treatment rooms, its staff or its
 * patients, and nothing in the UI presents it as such. Production photography
 * must replace these before launch; the rights position of the current files
 * has not been established here (`AGENTS.md` section 25).
 *
 * `objectPosition` exists because these are square source images cropped into
 * wider frames: it records where the subject sits so a crop never decapitates
 * someone or clips text baked into the source.
 *
 * ## Source weight (Phase 20)
 *
 * Every file here was re-encoded: 12.70 MB total became 1.34 MB, an 89%
 * reduction measured at PSNR 38-42 dB, which is the range where a difference
 * is not visible rather than merely "acceptable" (`phase_20.md` section 21 -
 * do not trade away visual quality unnecessarily).
 *
 * Three of them were **photographs stored as PNG with no alpha channel** -
 * `about-hero`, `doctor1` and `doctor2`, at 1.3-1.4 MB each - and are now
 * JPEG at 100-159 KB. The extension is part of the `src` below, so the rename
 * is visible here rather than hidden in the filesystem.
 *
 * This does not change what `next/image` delivers to a browser: it re-encodes
 * to WebP/AVIF per request and was already serving a 640px derivative. What it
 * changes is the repository, the build, the cost of the first uncached
 * optimization of each size, and every direct fetch of a file that bypasses
 * the optimizer - which is how crawlers read `logo.png`.
 *
 * `home-0.png`, `home-1.png` and `home-2.png` were **deleted**. They were
 * never referenced by any code: they were design mockups of a *different*
 * clinic's website, carrying another brand's name, fabricated practitioner
 * details and invented testimonials, and `progress_phase_04.md` recorded that
 * they should be removed rather than left where someone might treat them as
 * assets. They accounted for 4.0 MB of the reduction above.
 */

export interface ImageAsset {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /**
   * Empty string marks a decorative image, which is then rendered with
   * `alt=""` and hidden from assistive technology. Anything informative gets a
   * sentence describing what a sighted user gains from it.
   */
  readonly alt: string;
  /** Tailwind `object-position` utility for the crop. */
  readonly objectPosition?: string;
  /** True for anything that is not verified Punarvasu photography. */
  readonly placeholder?: boolean;
}

/**
 * The clinic's badge.
 *
 * **Phase 20.** Resized from 1056x1080 (1,320 KB) to 512x524 (116 KB) as
 * truecolor PNG. Three things constrained that choice:
 *
 *   - Alpha is real and must survive: 25% of the source is fully transparent
 *     (the area around the circular badge) and 1.4% is partial (its
 *     antialiased edge), so neither JPEG nor a flattened PNG is an option.
 *   - Palette quantisation was measured and rejected: it reached 121 KB but at
 *     a mean absolute error of 19.4/255 with a peak of 212, which is visible
 *     banding on the one verified brand asset in this repository.
 *   - 512px is ~10x what any UI use needs (the lockup renders the badge at
 *     40-48px, so even a 3x display asks for 144px) and 4.5x Google's 112px
 *     minimum for an Organization logo.
 *
 * That last point is why the dimensions cannot simply keep shrinking:
 * `lib/seo/structured-data.ts` publishes this file's URL as the clinic's
 * `logo` and `image`, and crawlers and social scrapers fetch it **raw**,
 * without passing through `next/image`. Its file size is therefore a real
 * cost to them, and its pixel dimensions are a structured-data requirement.
 */
export const BRAND_LOGO: ImageAsset = {
  src: "/images/logo.png",
  width: 512,
  height: 524,
  // The wordmark beside the mark carries the name, so the mark itself is
  // decorative and must not repeat it to a screen reader.
  alt: "",
};

export const HOME_IMAGES = {
  hero: {
    src: "/images/hero.jpg",
    width: 1024,
    height: 1024,
    alt: "A therapist pouring a slow stream of warm oil onto a reclining patient's forehead during a shirodhara treatment.",
    objectPosition: "object-center",
    placeholder: true,
  },
  intro: {
    src: "/images/about-hero.jpg",
    width: 1024,
    height: 1024,
    alt: "Ayurvedic herbs, roots and powders laid out beside a brass mortar and pestle on a wooden table.",
    objectPosition: "object-center",
    placeholder: true,
  },
  philosophy: {
    src: "/images/spotlight.jpg",
    width: 1024,
    height: 1024,
    alt: "A practitioner performing a warm-oil treatment in a quiet, lamp-lit therapy room.",
    objectPosition: "object-center",
    placeholder: true,
  },
} as const satisfies Record<string, ImageAsset>;

/**
 * About page photography.
 *
 * One image, and it is the same file the home page's introduction uses. That
 * is a reuse of an editorial motif rather than a reuse of convenience: the
 * rule in this file forbids stretching one photograph across two *treatments*
 * (which would imply it depicts both), and nothing here depicts a therapy.
 * The alt text differs because the context does.
 *
 * There is deliberately **no clinic interior photograph**. None of the files
 * in this repository shows Punarvasu's own consulting or treatment rooms, and
 * `phase_05.md` section 24 forbids implying that stock imagery is the clinic.
 * The About page says so in words instead.
 */
export const ABOUT_IMAGES = {
  hero: {
    src: "/images/about-hero.jpg",
    width: 1024,
    height: 1024,
    alt: "Dried herbs, roots and powders arranged on a wooden table beside a brass mortar and pestle.",
    objectPosition: "object-center",
    placeholder: true,
  },
} as const satisfies Record<string, ImageAsset>;

export const SERVICE_IMAGES = {
  joints: {
    src: "/images/arthritis.jpg",
    width: 1024,
    height: 1024,
    alt: "A therapist applying warm medicated oil to a patient's knee.",
    // The source file has a caption burned into its top quarter. Anchoring the
    // crop to the bottom keeps that text out of frame; it would otherwise be
    // unreadable, untranslatable and invisible to a screen reader.
    objectPosition: "object-bottom",
    placeholder: true,
  },
  skin: {
    src: "/images/skincare.jpg",
    width: 1024,
    height: 1024,
    alt: "A person holding a leaf beside their face while a herbal paste is applied.",
    objectPosition: "object-center",
    placeholder: true,
  },
  stress: {
    src: "/images/stress.jpg",
    width: 1024,
    height: 1024,
    alt: "A person sitting cross-legged and still in a bright room filled with plants.",
    objectPosition: "object-center",
    placeholder: true,
  },
} as const satisfies Record<string, ImageAsset>;

export const PRACTITIONER_IMAGES = {
  one: {
    src: "/images/doctor1.jpg",
    width: 1024,
    height: 1024,
    // Not a named practitioner: the profile is unverified, so the alt text
    // describes the photograph and claims nothing about who is in it.
    alt: "Portrait photograph placeholder: a practitioner standing in a consulting room lined with herb jars.",
    objectPosition: "object-top",
    placeholder: true,
  },
  two: {
    src: "/images/doctor2.jpg",
    width: 1024,
    height: 1024,
    alt: "Portrait photograph placeholder: a practitioner standing beside shelves of herbal preparations.",
    objectPosition: "object-top",
    placeholder: true,
  },
} as const satisfies Record<string, ImageAsset>;

/**
 * Treatment photography.
 *
 * Same provenance warning as everything above: these are placeholders, not
 * photographs of Punarvasu's own treatment rooms, therapists or patients.
 *
 * Each file is assigned to the one treatment it honestly depicts. Nothing here
 * is reused across two treatments to fill a frame, and a treatment with no
 * matching photograph gets no `image` at all - the card and the detail hero
 * both have a typographic composition for that case. Stretching an unrelated
 * stock photo over a therapy it does not show is a small lie that a visitor
 * can see (`docs/implementation-plan/phase_04.md` section 57).
 *
 * `hero.jpg` appears both here and in `HOME_IMAGES`: it depicts shirodhara
 * specifically, so it is the correct file in both places rather than a reuse
 * of convenience. The alt text differs because the context does.
 */
export const TREATMENT_IMAGES = {
  panchakarma: {
    src: "/images/spotlight.jpg",
    width: 1024,
    height: 1024,
    alt: "A practitioner carrying out a warm-oil therapy in a quiet, lamp-lit treatment room.",
    objectPosition: "object-center",
    placeholder: true,
  },
  abhyanga: {
    src: "/images/arthritis.jpg",
    width: 1024,
    height: 1024,
    alt: "A therapist working warm medicated oil into a patient's knee and lower leg.",
    // The source file has a caption burned into its top quarter; anchoring the
    // crop to the bottom keeps that text out of frame. See SERVICE_IMAGES.
    objectPosition: "object-bottom",
    placeholder: true,
  },
  shirodhara: {
    src: "/images/hero.jpg",
    width: 1024,
    height: 1024,
    alt: "Warm oil falling in a slow, steady stream onto the forehead of a reclining patient.",
    objectPosition: "object-center",
    placeholder: true,
  },
  mukhaLepa: {
    src: "/images/skincare.jpg",
    width: 1024,
    height: 1024,
    alt: "A herbal paste being applied to a person's face, with a fresh leaf held beside it.",
    objectPosition: "object-center",
    placeholder: true,
  },
  herbalPreparations: {
    src: "/images/about-hero.jpg",
    width: 1024,
    height: 1024,
    alt: "Dried herbs, roots and powders arranged beside a brass mortar and pestle.",
    objectPosition: "object-center",
    placeholder: true,
  },
  lifestyleGuidance: {
    src: "/images/stress.jpg",
    width: 1024,
    height: 1024,
    alt: "A person sitting cross-legged and still in a bright room filled with plants.",
    objectPosition: "object-center",
    placeholder: true,
  },
} as const satisfies Record<string, ImageAsset>;
