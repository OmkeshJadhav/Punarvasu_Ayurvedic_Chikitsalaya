import {
  OG_CARD_CONTENT_TYPE,
  OG_CARD_SIZE,
  renderOgCard,
} from "@/lib/seo/og-card";

/**
 * The social sharing card for /contact.
 *
 * Brand furniture only, generated at build time by the shared card
 * composition. See `lib/seo/og-card.tsx` for why these are typographic
 * rather than photographic, and why no page copy is burned into them.
 */
export const alt = "Punarvasu — Contact and Visit.";

export const size = OG_CARD_SIZE;

export const contentType = OG_CARD_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Contact and Visit",
    title: "Talk to the clinic.",
    footnote: "Godoli, Satara",
  });
}
