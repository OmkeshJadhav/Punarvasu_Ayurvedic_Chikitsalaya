import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";

import { BRAND_LOGO } from "@/config/images";
import { cn } from "@/lib/utils/cn";

/**
 * Brand treatment.
 *
 * Uses the clinic's own artwork (`public/images/logo.png`) - the one verified
 * brand asset in the repository. Phase 02's abstract placeholder mark has been
 * replaced; `Logo`'s markup, sizing and link behaviour are unchanged, which is
 * what the placeholder was built to allow.
 *
 * The artwork is a circular badge that already contains the wordmark, the
 * Devanagari form and "Ayurvedic Chikitsalaya". At header size none of that
 * text is legible, so the lockup pairs the badge with the wordmark set in the
 * brand serif. The badge is therefore decorative (`alt=""`) and the accessible
 * name comes from the link's `aria-label`, not from the image.
 *
 * Loading: the logo is above the fold on every page, so it is fetched eagerly.
 * It is deliberately *not* marked `priority` - the hero image is the LCP
 * candidate and should keep the high-priority slot to itself.
 */

export interface BrandMarkProps extends Omit<
  ComponentProps<typeof Image>,
  "src" | "alt" | "width" | "height"
> {
  readonly className?: string;
}

export function BrandMark({ className, sizes, ...props }: BrandMarkProps) {
  return (
    <Image
      src={BRAND_LOGO.src}
      alt={BRAND_LOGO.alt}
      width={BRAND_LOGO.width}
      height={BRAND_LOGO.height}
      loading="eager"
      // Rendered at 40-48px; the hint stops the optimizer shipping a 1056px
      // source for a element the size of a thumbnail.
      sizes={sizes ?? "48px"}
      className={cn("size-10 shrink-0 object-contain", className)}
      {...props}
    />
  );
}

export interface LogoProps extends Omit<
  ComponentProps<typeof Link>,
  "children" | "href"
> {
  /** Defaults to the site root. */
  readonly href?: ComponentProps<typeof Link>["href"];
  /** Hides the wordmark, leaving the badge alone. Useful in tight footers. */
  readonly markOnly?: boolean;
  readonly showMark?: boolean;
  /**
   * The "Ayurvedic Chikitsalaya" line under the wordmark.
   *
   * Off in narrow columns. In a four-column footer the line is wider than the
   * column and wraps mid-phrase, which reads as a broken lockup rather than as
   * a two-line one - and the footer states the same thing in its tagline
   * directly underneath.
   */
  readonly showSubline?: boolean;
}

/**
 * The linked brand lockup for a header or footer.
 *
 * `aria-label` names it explicitly so the link reads as "Punarvasu, home"
 * rather than as the wordmark text followed by an image.
 */
export function Logo({
  className,
  href = "/",
  showMark = true,
  markOnly = false,
  showSubline = true,
  ...props
}: LogoProps) {
  return (
    <Link
      href={href}
      aria-label="Punarvasu, home"
      className={cn(
        // `min-h-11` keeps the lockup at the 44px WCAG 2.2 target size; the
        // badge alone renders 40px tall.
        "text-foreground inline-flex min-h-11 items-center gap-2.5 rounded-sm",
        "ease-natural transition-opacity duration-(--duration-fast) hover:opacity-80",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
        className,
      )}
      {...props}
    >
      {showMark ? <BrandMark /> : null}
      <span
        aria-hidden="true"
        className={cn("flex flex-col leading-none", markOnly && "sr-only")}
      >
        <span className="text-h5 font-serif font-medium tracking-tight">
          Punarvasu
        </span>
        {showSubline ? (
          <span className="text-caption text-muted-foreground mt-0.5 hidden font-sans tracking-[0.18em] whitespace-nowrap uppercase sm:block">
            Ayurvedic Chikitsalaya
          </span>
        ) : null}
      </span>
    </Link>
  );
}
