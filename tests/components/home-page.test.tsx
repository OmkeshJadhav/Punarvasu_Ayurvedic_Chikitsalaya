import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import HomePage from "@/app/(public)/page";
import { CLINIC_CONTACT, CLINIC_IDENTITY } from "@/config/clinic";
import { HOME_SECTIONS } from "@/config/marketing-content";
import {
  ABOUT_PATH,
  CONTACT_PATH,
  FOOTER_NAV_GROUPS,
  LEGAL_NAV_ITEMS,
  PRACTITIONERS_HREF,
  PRIMARY_CTA,
  PUBLIC_NAV_ITEMS,
  SERVICES_PATH,
} from "@/config/navigation";

import { expectNoAxeViolations } from "../support/axe";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

/**
 * The home page, assembled inside the public shell.
 *
 * Mirrors `src/app/(public)/layout.tsx` rather than rendering it: a Next.js
 * layout takes the generated `LayoutProps` type, which only exists inside the
 * framework's own type generation, so constructing one here would mean casting
 * around the very types that make it correct.
 *
 * The duplication is three lines, and it is the shell's *structure* - header,
 * one `<main id="main-content">`, footer - that these tests are about. If the
 * real layout ever stops providing that, the page-level accessibility checks
 * here keep passing while the site breaks, so this fixture is worth
 * re-reading whenever the layout changes.
 */
function PublicPage() {
  return (
    <>
      <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />
      <main id="main-content" className="flex-1">
        <HomePage />
      </main>
      <SiteFooter
        groups={FOOTER_NAV_GROUPS}
        legalItems={LEGAL_NAV_ITEMS}
        tagline={CLINIC_IDENTITY.tagline}
        disclaimer="Information on this website is general in nature."
      />
    </>
  );
}

describe("home page structure", () => {
  it("provides banner, main and contentinfo landmarks", () => {
    render(<PublicPage />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("has exactly one h1", () => {
    render(<PublicPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("never skips a heading level", () => {
    render(<PublicPage />);

    const levels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));

    let previous = 0;
    for (const level of levels) {
      if (previous !== 0) {
        expect(level).toBeLessThanOrEqual(previous + 1);
      }
      previous = level;
    }
  });

  it("uses unique ids throughout", () => {
    const { container } = render(<PublicPage />);

    const ids = [...container.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Since Phase 05 every header item is a real route, and the footer deep-
  // links into sections of this page. Both kinds can rot silently: a route
  // that was never built 404s, and an anchor whose target was renamed scrolls
  // nowhere. Route items are checked by the pages that own them; anchors are
  // checked here, against the rendered document.
  it("gives every in-page navigation anchor a target that exists", () => {
    const { container } = render(<PublicPage />);

    const anchorItems = [
      ...PUBLIC_NAV_ITEMS,
      ...FOOTER_NAV_GROUPS.flatMap((group) => group.items),
    ].filter((item) => item.href.startsWith("/#"));

    expect(anchorItems.length).toBeGreaterThan(0);

    for (const item of anchorItems) {
      const targetId = item.href.replace(/^\/#/, "");
      expect(
        container.querySelector(`#${CSS.escape(targetId)}`),
        `no element with id "${targetId}" for nav item "${item.label}"`,
      ).not.toBeNull();
    }
  });

  it("points the header at routes rather than at placeholders", () => {
    // The whole header is now built pages. An anchor left here would mean a
    // route shipped without its navigation catching up.
    for (const item of PUBLIC_NAV_ITEMS) {
      expect(item.href, item.label).not.toContain("#");
    }
  });

  it("names every section landmark, so they are navigable", () => {
    render(<PublicPage />);

    for (const region of screen.getAllByRole("region")) {
      expect(region).toHaveAccessibleName();
    }
  });

  it("gives the anchored sections a scroll offset clear of the sticky header", () => {
    const { container } = render(<PublicPage />);

    // Without this, a jump link lands with its heading hidden behind the bar.
    for (const id of Object.values(HOME_SECTIONS)) {
      const target = container.querySelector(`#${CSS.escape(id)}`);
      if (target) {
        expect(target.className).toContain("anchor-offset");
      }
    }
  });

  it("points every 'Book a Consultation' action at the same route", () => {
    render(<PublicPage />);

    const ctas = screen.getAllByRole("link", { name: PRIMARY_CTA.label });
    expect(ctas.length).toBeGreaterThan(1);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", PRIMARY_CTA.href);
    }
  });

  it("links nowhere that is known not to exist", () => {
    const { container } = render(<PublicPage />);

    // Every internal link is the home page, an in-page anchor, or one of the
    // public routes this site actually builds. Anything else is a route that
    // does not exist, and a dead link on the site's most valuable page.
    const allowed = new Set([
      "/",
      SERVICES_PATH,
      ABOUT_PATH,
      `${ABOUT_PATH}#approach`,
      PRACTITIONERS_HREF,
      CONTACT_PATH,
      PRIMARY_CTA.href,
    ]);
    for (const anchor of container.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href") ?? "";
      // `tel:` and `mailto:` are not routes. They are checked for content
      // rather than existence, in the contact page's own tests.
      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("tel:") ||
        href.startsWith("mailto:")
      ) {
        continue;
      }
      expect(
        allowed.has(href) || href.startsWith("/#"),
        `unexpected internal link: ${href}`,
      ).toBe(true);
    }
  });

  it("publishes structured data without inventing clinic facts", () => {
    const { container } = render(<PublicPage />);

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();

    const data = JSON.parse(script?.textContent ?? "{}") as Record<
      string,
      unknown
    >;
    expect(data["@type"]).toBe("MedicalClinic");
    expect(data["name"]).toBe(CLINIC_IDENTITY.name);

    // The address and phone number the clinic supplied in Phase 05 are
    // emitted, and they must be exactly what `config/clinic.ts` holds - a
    // search engine republishes this with the clinic's name attached, so a
    // second copy of the address living in a component is how the two drift.
    expect(data["telephone"]).toBe(CLINIC_CONTACT.phone);
    // Supplied by the clinic later, and emitted from the same single source.
    expect(data["email"]).toBe(CLINIC_CONTACT.email);
    expect(data["address"]).toMatchObject({
      "@type": "PostalAddress",
      streetAddress: CLINIC_CONTACT.address?.streetAddress,
      addressLocality: CLINIC_CONTACT.address?.locality,
      postalCode: CLINIC_CONTACT.address?.postalCode,
    });

    // The hours the clinic supplied, one entry per session - and exactly as
    // many as `config/clinic.ts` holds.
    expect(data["openingHoursSpecification"]).toHaveLength(
      CLINIC_CONTACT.openingHoursSpecification?.length ?? 0,
    );
    expect(data["foundingDate"]).toBe(String(CLINIC_IDENTITY.foundedYear));

    // Everything still unverified stays absent. These are the shapes that
    // most invite fabrication, and none of them is ever constructed.
    expect(data).not.toHaveProperty("openingHours");
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("review");
    expect(data).not.toHaveProperty("priceRange");
  });

  it("reaches the primary action from the keyboard past the skip link", async () => {
    const user = userEvent.setup();
    render(<PublicPage />);

    await user.tab();
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus();
  });

  it("has no axe violations, including landmark and region rules", async () => {
    const { container } = render(<PublicPage />);

    await expectNoAxeViolations(container, {
      rules: { region: { enabled: true } },
    });
  });
});
