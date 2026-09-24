import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { getSiteConfig } from "@/config/env.public";
import { isIndexableDeployment } from "@/lib/seo/indexing";

import "./globals.css";

/**
 * Two families, one job each.
 *
 * Inter carries every piece of functional UI - navigation, forms, labels,
 * tables, system messages - because it is unambiguous at small sizes, which is
 * what healthcare information needs.
 *
 * Playfair Display carries headings and brand voice. It is what makes the
 * product read as editorial rather than as an admin console.
 *
 * It replaced Cormorant Garamond, which `docs/DESIGN_SYSTEM.md` section 6.1
 * lists as interchangeable with it. Cormorant is a low-contrast face with a
 * small x-height: set at the weights this product uses it went pale against a
 * warm page and the headings stopped holding the hierarchy they were sized to
 * hold. Playfair's high stroke contrast and larger x-height give the same
 * editorial voice with the presence a display size is asking for.
 *
 * Both are self-hosted by `next/font`, so there is no third-party request on
 * first paint and no layout shift from a late-arriving font file.
 */
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  // 400 for display headings, 500-600 for the smaller headings that sit
  // inside cards and lists. Nothing here needs a bolder cut.
  weight: ["400", "500", "600"],
  // Italic carries editorial emphasis in display headings - one word or
  // phrase per heading, never a whole line (`components/marketing/emphasis.tsx`).
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteConfig().siteUrl),
  title: {
    default: "Punarvasu — Ayurvedic Clinic",
    template: "%s | Punarvasu",
  },
  description:
    "Punarvasu is an Ayurvedic clinic offering consultations and treatments guided by qualified practitioners.",
  applicationName: "Punarvasu",
  /**
   * Phase 20. `robots.txt` asks a crawler not to *fetch* a URL; it does not
   * remove one it already knows, and a URL discovered from a link elsewhere
   * can still appear in results. `noindex` on the page is the instruction that
   * actually excludes it, so a non-production deployment carries both.
   *
   * On production this stays `index: true` and the individual private areas
   * override it with their own `noindex` - the patient portal, the staff
   * workspaces, every `/auth` page. Those overrides are unconditional and do
   * not depend on this.
   */
  robots: isIndexableDeployment()
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Matches `--background`, so the browser chrome on mobile blends with the
  // page instead of framing it in white.
  themeColor: "#faf6ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground text-body flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
