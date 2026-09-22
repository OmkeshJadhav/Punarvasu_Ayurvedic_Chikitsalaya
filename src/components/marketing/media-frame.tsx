import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";

import type { ImageAsset } from "@/config/images";
import { cn } from "@/lib/utils/cn";

/**
 * A photograph in a controlled frame.
 *
 * Marketing imagery is square-ish source material dropped into wildly
 * different shapes, so every use needs the same four things: a fixed aspect so
 * the layout never shifts while the file loads, `object-cover` with the crop
 * anchored where the subject is, a `sizes` hint that matches the *rendered*
 * width, and a muted placeholder underneath. Doing that inline at each call
 * site is how one section ends up shipping a 1024px file to a phone.
 *
 * `sizes` is required rather than defaulted. A wrong default is invisible in
 * review and expensive on a mobile connection; being forced to state the width
 * makes the author look at the layout.
 *
 * ## Scrim
 *
 * `scrim` darkens the photograph so text can sit on top of it. The two
 * strengths are fixed by `MEDIA_FRAME_SCRIM_ALPHA` and verified in
 * `lib/design/contrast.test.ts` against the lightest photograph possible, so a
 * caller may put a headline over an image it has never seen and still clear
 * WCAG AA. That guarantee is the reason the strength is a named option rather
 * than a free opacity.
 */
const frameVariants = cva("relative overflow-hidden bg-muted", {
  variants: {
    aspect: {
      square: "aspect-square",
      portrait: "aspect-[4/5]",
      landscape: "aspect-[3/2]",
      wide: "aspect-[16/10]",
      hero: "aspect-[4/5] sm:aspect-[3/2] lg:aspect-[4/5]",
      /**
       * No aspect of its own: the frame stretches to whatever the positioned
       * parent is. Used for a full-bleed band whose height comes from the
       * content laid over it.
       */
      fill: "absolute inset-0 size-full",
    },
    radius: {
      lg: "rounded-lg",
      xl: "rounded-xl",
      none: "rounded-none",
    },
  },
  defaultVariants: { aspect: "landscape", radius: "lg" },
});

/** How dark the wash over the photograph is. See the component docblock. */
export type MediaFrameScrim = "none" | "soft" | "strong";

export interface MediaFrameProps extends VariantProps<typeof frameVariants> {
  readonly image: ImageAsset;
  /**
   * The rendered width at each breakpoint, largest first. Describe the real
   * layout - see the call sites in `components/marketing` for worked examples,
   * including the ones that must overstate the width because the crop is
   * driven by height.
   */
  readonly sizes: string;
  /** Reserve for the LCP image only - one per page. */
  readonly priority?: boolean;
  readonly className?: string;
  readonly imageClassName?: string;
  /**
   * `strong` where text sits on the image, `soft` for depth behind a label or
   * under a heading-sized caption. Defaults to `none`.
   */
  readonly scrim?: MediaFrameScrim;
}

/**
 * Tailwind cannot read a runtime number, so the alphas in
 * `MEDIA_FRAME_SCRIM_ALPHA` are expressed here as the matching opacity
 * utilities. The two must stay in step: the test asserts the numbers, the
 * browser paints these classes.
 *
 * `strong` is a flat wash plus a gradient that deepens towards the bottom-left
 * corner, where the copy sits. The flat wash is what carries the guarantee;
 * the gradient only ever makes it darker, so it cannot undo one.
 */
const SCRIM_CLASSES: Record<MediaFrameScrim, string | null> = {
  none: null,
  soft: "bg-scrim/55",
  strong: "bg-scrim/70",
};

export function MediaFrame({
  image,
  sizes,
  aspect,
  radius,
  priority = false,
  scrim = "none",
  className,
  imageClassName,
}: MediaFrameProps) {
  const scrimClass = SCRIM_CLASSES[scrim];

  return (
    <div className={cn(frameVariants({ aspect, radius }), className)}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(
          "object-cover",
          image.objectPosition ?? "object-center",
          imageClassName,
        )}
      />
      {scrimClass ? (
        <div
          aria-hidden="true"
          className={cn("absolute inset-0", scrimClass)}
        />
      ) : null}
      {scrim === "strong" ? (
        // Depth, not legibility: it deepens the corner the copy occupies so
        // the headline does not float on an evenly grey rectangle.
        <div
          aria-hidden="true"
          className="from-scrim/55 absolute inset-0 bg-linear-to-tr to-transparent"
        />
      ) : null}
    </div>
  );
}

export { frameVariants };
