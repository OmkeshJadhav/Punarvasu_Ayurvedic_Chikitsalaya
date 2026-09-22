import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { isCurrentPath } from "@/components/layout/nav-link";
import {
  FOOTER_NAV_GROUPS,
  LEGAL_NAV_ITEMS,
  PRIMARY_CTA,
  PUBLIC_NAV_ITEMS,
} from "@/config/navigation";

import { expectNoAxeViolations } from "../support/axe";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

beforeEach(() => {
  pathname.current = "/";
});

describe("isCurrentPath", () => {
  it("matches the root only exactly", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    // Otherwise "Home" would be current on every page in the site.
    expect(isCurrentPath("/treatments", "/")).toBe(false);
  });

  it("matches an exact path", () => {
    expect(isCurrentPath("/treatments", "/treatments")).toBe(true);
  });

  it("matches a nested path, so a section stays highlighted", () => {
    expect(isCurrentPath("/treatments/panchakarma", "/treatments")).toBe(true);
  });

  it("does not match a path that merely shares a prefix", () => {
    expect(isCurrentPath("/treatments-archive", "/treatments")).toBe(false);
  });

  it("matches only itself when asked to be exact", () => {
    // Added in Phase 07, for a real defect it caught: the patient area lists
    // "Overview" at /patient and "Profile" at /patient/profile, and with
    // section matching both reported aria-current="page" on the profile page
    // — telling a screen-reader user they were in two places at once.
    expect(isCurrentPath("/patient", "/patient", "exact")).toBe(true);
    expect(isCurrentPath("/patient/profile", "/patient", "exact")).toBe(false);
  });

  it("still matches nested paths when not asked to be exact", () => {
    expect(isCurrentPath("/patient/profile", "/patient")).toBe(true);
  });
});

describe("SiteHeader", () => {
  it("renders a banner landmark and a named main navigation", () => {
    render(
      <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
  });

  it("puts a skip link first in the tab order", async () => {
    const user = userEvent.setup();
    render(
      <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />,
    );

    await user.tab();

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toHaveFocus();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("links the brand to the homepage with an accessible name", () => {
    render(<SiteHeader navItems={PUBLIC_NAV_ITEMS} />);

    expect(
      screen.getByRole("link", { name: "Punarvasu, home" }),
    ).toHaveAttribute("href", "/");
  });

  // Fixture rather than `PUBLIC_NAV_ITEMS`: the live public navigation points
  // at sections of the home page while that is the only public route, so it
  // has no route-shaped item to be "current". What is under test here is
  // `NavLink`'s behaviour, which must keep working for the route-based
  // navigation that replaces it.
  it("marks the current section with aria-current, not colour alone", () => {
    const routeItems = [
      { label: "About", href: "/about" },
      { label: "Treatments", href: "/treatments" },
    ];
    pathname.current = "/treatments/panchakarma";
    render(<SiteHeader navItems={routeItems} />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    const current = within(nav).getByRole("link", { name: "Treatments" });
    expect(current).toHaveAttribute("aria-current", "page");

    expect(
      within(nav).getByRole("link", { name: "About" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("does not mark an in-page anchor as the current page", () => {
    pathname.current = "/";
    render(<SiteHeader navItems={PUBLIC_NAV_ITEMS} />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const link of within(nav).getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("renders exactly one primary action", () => {
    render(
      <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />,
    );

    // Once in the desktop bar and once inside the mobile menu; the mobile copy
    // is not mounted until the menu opens.
    expect(
      screen.getAllByRole("link", { name: PRIMARY_CTA.label }),
    ).toHaveLength(1);
  });

  it("renders no primary action when none is given", () => {
    render(<SiteHeader navItems={PUBLIC_NAV_ITEMS} />);

    expect(
      screen.queryByRole("link", { name: PRIMARY_CTA.label }),
    ).not.toBeInTheDocument();
  });

  it("renders an account slot for an authenticated state", () => {
    render(
      <SiteHeader
        navItems={PUBLIC_NAV_ITEMS}
        accountSlot={<a href="/account">My account</a>}
      />,
    );

    expect(
      screen.getByRole("link", { name: "My account" }),
    ).toBeInTheDocument();
  });

  describe("mobile menu", () => {
    it("opens from a labelled trigger and lists the navigation", async () => {
      const user = userEvent.setup();
      render(
        <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />,
      );

      await user.click(screen.getByRole("button", { name: "Open menu" }));

      const menu = await screen.findByRole("dialog");
      for (const item of PUBLIC_NAV_ITEMS) {
        expect(
          within(menu).getByRole("link", { name: item.label }),
        ).toBeInTheDocument();
      }
      expect(
        within(menu).getByRole("link", { name: PRIMARY_CTA.label }),
      ).toBeInTheDocument();
    });

    it("closes on Escape and returns focus to the trigger", async () => {
      const user = userEvent.setup();
      render(<SiteHeader navItems={PUBLIC_NAV_ITEMS} />);
      const trigger = screen.getByRole("button", { name: "Open menu" });

      await user.click(trigger);
      await screen.findByRole("dialog");

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      await waitFor(() => expect(trigger).toHaveFocus());
    });

    it("has no axe violations while open", async () => {
      const user = userEvent.setup();
      const { baseElement } = render(
        <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />,
      );
      await user.click(screen.getByRole("button", { name: "Open menu" }));
      await screen.findByRole("dialog");

      await expectNoAxeViolations(baseElement);
    });
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("SiteFooter", () => {
  it("renders a contentinfo landmark with named link groups", () => {
    render(
      <SiteFooter groups={FOOTER_NAV_GROUPS} legalItems={LEGAL_NAV_ITEMS} />,
    );

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    for (const group of FOOTER_NAV_GROUPS) {
      expect(
        screen.getByRole("navigation", { name: group.title }),
      ).toBeInTheDocument();
    }
  });

  it("omits the contact block entirely when no details are supplied", () => {
    render(<SiteFooter groups={FOOTER_NAV_GROUPS} />);

    // The clinic's real contact details are not invented by this phase, and
    // the footer must be correct without them.
    expect(
      screen.queryByRole("heading", { name: "Contact" }),
    ).not.toBeInTheDocument();
  });

  it("renders contact details when they are supplied", () => {
    render(
      <SiteFooter contact={[{ label: "Phone", value: "+91 00000 00000" }]} />,
    );

    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("+91 00000 00000")).toBeInTheDocument();
  });

  it("marks an external link and warns that it opens a new tab", () => {
    render(
      <SiteFooter
        legalItems={[
          { label: "Instagram", href: "https://example.com", external: true },
        ]}
      />,
    );

    const link = screen.getByRole("link", {
      name: /Instagram.*opens in a new tab/,
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders the medical disclaimer when supplied", () => {
    render(
      <SiteFooter disclaimer="Information on this website is general in nature." />,
    );

    expect(
      screen.getByText("Information on this website is general in nature."),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <SiteFooter
        groups={FOOTER_NAV_GROUPS}
        legalItems={LEGAL_NAV_ITEMS}
        contact={[{ label: "Phone", value: "+91 00000 00000" }]}
        tagline="Ayurvedic consultation and treatment."
        disclaimer="Information on this website is general in nature."
      />,
    );
    await expectNoAxeViolations(container);
  });
});
