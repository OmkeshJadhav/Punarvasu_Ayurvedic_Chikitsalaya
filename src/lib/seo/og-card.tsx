import { ImageResponse } from "next/og";

import { PALETTE } from "@/lib/design/palette";

/**
 * The shared social sharing card.
 *
 * Phase 03 generated one card for the site and Phase 04 a variant per
 * treatment; Phase 05 needed three more, at which point five near-identical
 * `ImageResponse` trees is a maintenance problem and a guarantee that they
 * will drift apart. This is the one composition, taking the words as data.
 *
 * ## Why generated rather than photographed
 *
 * The photographs in `public/images` are square placeholders that crop badly
 * to 1.91:1 - a head or a burned-in caption ends up outside the frame - and
 * none of them is Punarvasu's own photography, so a shared link showing one
 * would put an unrelated stock image under the clinic's name. A typographic
 * card in the clinic's own colours says exactly as much and claims nothing.
 *
 * `next/og` ships with Next.js, so this adds no dependency, and every card
 * that uses it is generated at build time and served as a static file.
 *
 * Colours come from the palette mirror - the same values `contrast.test.ts`
 * asserts - so a card cannot drift away from the brand. The brand serif is
 * deliberately not loaded: embedding a font file for a handful of cards is
 * not worth the build weight, so they use the runtime's default family by
 * decision rather than by accident.
 *
 * ## What may go on a card
 *
 * Brand furniture only. No unreviewed clinic copy and no claim about a
 * practitioner: once a link has been shared, text burned into a PNG cannot be
 * corrected. The page's own description travels beside the image in the Open
 * Graph metadata, where it can be.
 */
export const OG_CARD_SIZE = { width: 1200, height: 630 } as const;

export const OG_CARD_CONTENT_TYPE = "image/png";

export interface OgCardOptions {
  /** Small tracked line at the top. Two or three words. */
  readonly eyebrow: string;
  /** The card's subject, set large. Kept short enough not to wrap past two lines. */
  readonly title: string;
  /** The line at the bottom right, opposite the wordmark. */
  readonly footnote: string;
}

export function renderOgCard({
  eyebrow,
  title,
  footnote,
}: OgCardOptions): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PALETTE.brandSurface,
        padding: "72px 80px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          color: PALETTE.brandSurfaceAccent,
          fontSize: 26,
          letterSpacing: 6,
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </div>

      <div
        style={{
          display: "flex",
          color: PALETTE.brandSurfaceForeground,
          fontSize: 84,
          lineHeight: 1.08,
          letterSpacing: -2,
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${PALETTE.brandSurfaceBorder}`,
          paddingTop: 32,
          color: PALETTE.brandSurfaceMuted,
          fontSize: 30,
        }}
      >
        <span style={{ color: PALETTE.brandSurfaceForeground }}>Punarvasu</span>
        <span>{footnote}</span>
      </div>
    </div>,
    OG_CARD_SIZE,
  );
}
