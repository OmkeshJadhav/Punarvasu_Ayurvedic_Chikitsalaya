import {
  OG_CARD_CONTENT_TYPE,
  OG_CARD_SIZE,
  renderOgCard,
} from "@/lib/seo/og-card";

/**
 * The social sharing card for /practitioners.
 *
 * Brand furniture only, generated at build time by the shared card
 * composition. See `lib/seo/og-card.tsx` for why these are typographic
 * rather than photographic, and why no page copy is burned into them.
 */
export const alt = "Punarvasu — Our Practitioners.";

export const size = OG_CARD_SIZE;

export const contentType = OG_CARD_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Our Practitioners",
    title: "The people you will actually sit with.",
    footnote: "Ayurvedic consultation",
  });
}
