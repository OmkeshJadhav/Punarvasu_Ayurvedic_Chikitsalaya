/**
 * Navigation structure.
 *
 * This module defines the *shape* of Punarvasu's navigation and holds the
 * content the layout is built and tested against. Nothing outside this module
 * hard-codes a navigation item, so changing the public navigation is a
 * one-file change.
 *
 * ## Routes, not anchors
 *
 * Phases 03 and 04 pointed most of the header at sections of the home page,
 * because linking to `/about` or `/practitioners` before those pages existed
 * would have put dead links on the site's most valuable page. Phase 05 builds
 * them, so the header now points at four real routes and `FUTURE_PUBLIC_ROUTES`
 * is empty.
 *
 * The footer still links to a few home-page sections. That is deliberate and
 * different: those are deep links into a page that exists, not placeholders
 * for pages that do not.
 *
 * Anchor targets carry the `anchor-offset` utility so the sticky header never
 * covers the heading a user just jumped to
 * (`docs/implementation-plan/phase_03.md` section 41).
 */

import { HOME_SECTIONS } from "./marketing-content";

export interface NavItem {
  readonly label: string;
  readonly href: string;
  /** Marks an external destination: opens in a new tab, gets a rel and a hint. */
  readonly external?: boolean;
  /**
   * How the link decides it is the current page.
   *
   * `"section"` (the default) treats a nested path as still being in this
   * section, so `/services/panchakarma` keeps "Treatments" highlighted.
   *
   * `"exact"` matches the path itself and nothing beneath it. Required for an
   * **index link in a nav that also lists its own children** — without it,
   * "Overview" at `/patient` and "Profile" at `/patient/profile` would both
   * report `aria-current="page"` while viewing the profile, telling a screen
   * reader user they are in two places at once.
   */
  readonly match?: "section" | "exact";
}

export interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/** Builds a link to a section of the home page from anywhere on the site. */
export function homeSectionHref(sectionId: string): string {
  return `/#${sectionId}`;
}

/**
 * The services experience.
 *
 * The path helpers live here rather than in `features/services` so that
 * nothing outside this module composes a public URL by hand, and so the
 * feature does not have to be imported just to render a link. Dependencies
 * point from the feature to navigation, never the other way.
 */
export const SERVICES_PATH = "/services";

/**
 * A treatment's public URL.
 *
 * The slug is not escaped here on purpose: slugs are catalogue constants
 * validated against `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` in
 * `features/services/catalogue.test.ts`, and a value that reaches this
 * function has already been resolved against the catalogue. Nothing user-
 * supplied is ever formatted into a URL by this helper.
 */
export function treatmentPath(slug: string): string {
  return `${SERVICES_PATH}/${slug}`;
}

/** The remaining public routes, all of which exist as of Phase 05. */
export const ABOUT_PATH = "/about";
export const CONTACT_PATH = "/contact";

/**
 * Where the practitioners are introduced.
 *
 * There is no `/practitioners` page: the About page's practitioners section
 * shows each doctor, and the full profile opens in a modal. `next.config.ts`
 * redirects the old URLs here.
 */
export const PRACTITIONERS_HREF = `${ABOUT_PATH}#practitioners`;

/**
 * Primary public navigation.
 *
 * Five entries, matching the page's narrative order. A calm, premium header
 * scans in one glance; a list that grows past six needs a different structure
 * rather than a smaller font.
 */
export const PUBLIC_NAV_ITEMS: readonly NavItem[] = [
  { label: "About", href: ABOUT_PATH },
  { label: "Treatments", href: SERVICES_PATH },
  { label: "Contact", href: CONTACT_PATH },
];

/**
 * Public routes that do not exist yet.
 *
 * Empty as of Phase 05: every item in `PUBLIC_NAV_ITEMS` points at a route
 * that is built. The constant stays so the next phase to plan a public page
 * records its destination here rather than in a commit message.
 */
export const FUTURE_PUBLIC_ROUTES: Readonly<Record<string, string>> = {};

/**
 * The single primary call to action.
 *
 * There is exactly one, by design. Competing primary actions in a header
 * dilute all of them (`docs/DESIGN_SYSTEM.md` section 46).
 *
 * `/appointments/new` is the permanent route for booking. The booking engine
 * belongs to a later phase; until it lands the route serves a short, indexed-
 * out interstitial explaining that online booking is not open, so the site's
 * primary action leads somewhere truthful instead of nowhere.
 */
export const PRIMARY_CTA: NavItem = {
  label: "Book a Consultation",
  href: "/appointments/new",
};

/**
 * Footer link groups.
 *
 * Mirrors the header while the site is one page. `SiteFooter` renders a
 * contact group only when one is passed to it, so the footer is complete and
 * correct with the clinic's real details still absent (see `config/clinic.ts`).
 */
export const FOOTER_NAV_GROUPS: readonly NavGroup[] = [
  {
    title: "Clinic",
    items: [
      { label: "About Punarvasu", href: ABOUT_PATH },
      { label: "Our practitioners", href: PRACTITIONERS_HREF },
      { label: "Visit the clinic", href: CONTACT_PATH },
    ],
  },
  {
    title: "Care",
    items: [
      { label: "Treatments and therapies", href: SERVICES_PATH },
      { label: "Our approach", href: `${ABOUT_PATH}#approach` },
      { label: "Your journey", href: homeSectionHref(HOME_SECTIONS.journey) },
      { label: "Book a Consultation", href: PRIMARY_CTA.href },
    ],
  },
];

/**
 * Legal links.
 *
 * Empty on purpose. A privacy policy, terms and a medical disclaimer page are
 * all required before a healthcare platform handling patient data launches -
 * but none of those pages exists yet, and a footer whose legal links 404 is
 * worse than a footer without them. The medical disclaimer itself is not
 * deferred: it is rendered as text in the footer and again in the philosophy
 * section, where it cannot be missed.
 *
 * Add the items here in the phase that builds the pages.
 */
export const LEGAL_NAV_ITEMS: readonly NavItem[] = [];
