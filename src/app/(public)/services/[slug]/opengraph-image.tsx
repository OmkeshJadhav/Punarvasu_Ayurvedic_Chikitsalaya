import { ImageResponse } from "next/og";

import {
  getCategory,
  getTreatmentBySlug,
  getTreatmentSlugs,
} from "@/features/services/catalogue";
import { PALETTE } from "@/lib/design/palette";

/**
 * The social sharing card for a treatment page.
 *
 * Generated in the clinic's own colours rather than cropped from the
 * treatment photograph. The photographs in `public/images` are square
 * placeholders that crop badly to 1.91:1 — a head or a caption ends up
 * outside the frame — and they are not Punarvasu's own photography, so a
 * shared link showing one would put an unrelated stock image under the
 * clinic's name. A typographic card says exactly as much and claims nothing
 * (`docs/implementation-plan/phase_04.md` section 45).
 *
 * `next/og` ships with Next.js, so this adds no dependency, and with
 * `generateStaticParams` on the page these render at build time as static
 * files. The brand serif is not loaded here: embedding a font file for seven
 * cards is not worth the build weight, so the card uses the runtime's default
 * family deliberately rather than by accident — the same decision as the
 * site-wide card.
 *
 * No summary text appears on the card. The description travels in the OG
 * metadata, and burning unreviewed treatment copy into a PNG makes it
 * impossible to correct once a link has been shared.
 */
export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

/**
 * One alt text for all seven cards.
 *
 * `generateImageMetadata` would allow a per-treatment alt, but it makes the
 * route an image *set* and the build then fails to resolve the generated
 * per-id module under Turbopack. The card is brand furniture rather than
 * content — the treatment's name and description travel in the Open Graph
 * title and description beside it — so a single accurate sentence loses
 * nothing worth a workaround.
 */
export const alt = "Punarvasu — an Ayurvedic clinic.";

export function generateStaticParams(): { slug: string }[] {
  return getTreatmentSlugs().map((slug) => ({ slug }));
}

export default async function TreatmentOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const treatment = getTreatmentBySlug(slug);
  const category = treatment ? getCategory(treatment.categoryId) : undefined;

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
          color: PALETTE.brandSurfaceAccent,
          fontSize: 26,
          letterSpacing: 6,
          textTransform: "uppercase",
        }}
      >
        {category?.name ?? "Ayurvedic Chikitsalaya"}
      </div>

      <div
        style={{
          display: "flex",
          color: PALETTE.brandSurfaceForeground,
          fontSize: 84,
          lineHeight: 1.05,
          letterSpacing: -2,
        }}
      >
        {treatment?.name ?? "Services"}
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
