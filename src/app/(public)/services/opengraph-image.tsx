import {
  OG_CARD_CONTENT_TYPE,
  OG_CARD_SIZE,
  renderOgCard,
} from "@/lib/seo/og-card";

/**
 * The social sharing card for /services.
 *
 * Brand furniture only, generated at build time by the shared card
 * composition. See `lib/seo/og-card.tsx` for why these are typographic
 * rather than photographic, and why no page copy is burned into them.
 *
 * **Added in Phase 20.** `/services` was the one public page shipping without
 * an `og:image`, which an audit of every public route's metadata caught. It is
 * the page that can least afford it: the sitemap gives it priority 0.9 and
 * describes it as the main entry point for search traffic, and it is the most
 * natural page for the clinic to share. Every sibling - `/`, `/about`,
 * `/practitioners`, `/contact` and all seven treatment pages - already had
 * one, so a link to the services index was the only one that previewed as a
 * bare title.
 *
 * The wording is the page's own hero, not a new claim: `SERVICES_PAGE.hero`
 * reads "Services and treatments" / "Ayurvedic care, chosen for the person".
 * Nothing here states an outcome, a price or an availability
 * (`phase_20.md` sections 68, 72 and 174).
 */
export const alt = "Punarvasu — Services and treatments.";

export const size = OG_CARD_SIZE;

export const contentType = OG_CARD_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Services and treatments",
    title: "Ayurvedic care, chosen for the person.",
    footnote: "An Ayurvedic clinic in Satara",
  });
}
