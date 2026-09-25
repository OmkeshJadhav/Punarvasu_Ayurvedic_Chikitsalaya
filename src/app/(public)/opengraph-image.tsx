import { ImageResponse } from "next/og";

import { PALETTE } from "@/lib/design/palette";

/**
 * The social sharing card for the public site.
 *
 * Generated rather than photographed, for two reasons. The photographs in
 * `public/images` are square placeholders that crop badly to 1.91:1, and a
 * shared link is often the first impression of the brand — a typographic card
 * in the clinic's own colours says more than a cropped stock photo.
 *
 * Built with `next/og`, which ships with Next.js, so this adds no dependency.
 * It is generated at build time and served as a static file.
 *
 * Colours come from the palette mirror, the same values the contrast tests
 * assert, so the card cannot drift away from the brand. Only the brand serif
 * is unavailable here (loading a font file into `ImageResponse` for one image
 * is not worth the build weight), so the card uses the runtime's default
 * family deliberately rather than by accident.
 */
export const alt =
  "Punarvasu — an Ayurvedic clinic. Ancient wisdom, personalized care.";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpengraphImage() {
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
        Punarvasu Ayurvedic Chikitsalaya
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            color: PALETTE.brandSurfaceForeground,
            fontSize: 92,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Ancient wisdom.
        </div>
        <div
          style={{
            display: "flex",
            color: PALETTE.brandSurfaceMuted,
            fontSize: 92,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Personalized care.
        </div>
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
        <span>An Ayurvedic clinic</span>
      </div>
    </div>,
    size,
  );
}
