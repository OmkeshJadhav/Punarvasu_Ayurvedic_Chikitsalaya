import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AboutPage from "@/app/(public)/about/page";
import { ProseSection } from "@/components/marketing/prose-section";
import { StatementList } from "@/components/marketing/statement-list";
import {
  ABOUT_PATH,
  CONTACT_PATH,
  PRACTITIONERS_PATH,
  PRIMARY_CTA,
  SERVICES_PATH,
} from "@/config/navigation";
import { ABOUT_PAGE, ABOUT_SECTIONS } from "@/features/about/content";

import { expectNoAxeViolations } from "../support/axe";

vi.mock("next/navigation", () => ({
  usePathname: () => ABOUT_PATH,
}));

/**
 * The About page.
 *
 * These cover what a screenshot cannot show: that the page owns exactly one
 * `<h1>` and skips no heading level, that every anchor the page or the footer
 * points at actually exists and clears the sticky header, that no link leads
 * somewhere unbuilt, and - most importantly - that the page still says out
 * loud that its content is unreviewed and that no founder story has been
 * supplied.
 */
describe("about page", () => {
  it("owns exactly one h1", () => {
    render(<AboutPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("never skips a heading level", () => {
    render(<AboutPage />);

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

  it("names every section landmark, so they are navigable", () => {
    render(<AboutPage />);

    for (const region of screen.getAllByRole("region")) {
      expect(region).toHaveAccessibleName();
    }
  });

  it("gives every anchored section an id and a scroll offset", () => {
    const { container } = render(<AboutPage />);

    for (const id of Object.values(ABOUT_SECTIONS)) {
      const target = container.querySelector(`#${CSS.escape(id)}`);
      expect(target, `no section with id "${id}"`).not.toBeNull();
      // Without this a jump link lands with its heading behind the bar.
      expect(target?.className).toContain("anchor-offset");
    }
  });

  it("resolves the footer's deep link into this page", () => {
    // `FOOTER_NAV_GROUPS` links to `/about#approach`. If that section is ever
    // renamed the link rots silently, so the target is asserted here rather
    // than trusted.
    const { container } = render(<AboutPage />);
    expect(container.querySelector("#approach")).not.toBeNull();
  });

  it("links only to routes that exist", () => {
    const { container } = render(<AboutPage />);

    const allowed = new Set<string>([
      "/",
      ABOUT_PATH,
      SERVICES_PATH,
      PRACTITIONERS_PATH,
      CONTACT_PATH,
      PRIMARY_CTA.href,
      "/#journey",
    ]);

    for (const anchor of container.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("http") || href.startsWith("#")) {
        continue;
      }
      expect(
        allowed.has(href) || href.startsWith("/#"),
        `unexpected internal link: ${href}`,
      ).toBe(true);
    }
  });

  it("offers a way on to the services, practitioners and contact pages", () => {
    const { container } = render(<AboutPage />);

    const hrefs = [...container.querySelectorAll("a[href]")].map((anchor) =>
      anchor.getAttribute("href"),
    );
    // "The user should never feel trapped on a page" - phase_05.md section 5.
    expect(hrefs).toContain(SERVICES_PATH);
    expect(hrefs).toContain(PRACTITIONERS_PATH);
    expect(hrefs).toContain(CONTACT_PATH);
    expect(hrefs).toContain(PRIMARY_CTA.href);
  });

  it("says in the page that the content is awaiting the clinic's review", () => {
    render(<AboutPage />);

    // Not a source comment. The person at risk of mistaking development copy
    // for the clinic's own words is the reader.
    expect(
      screen.getByText(/has not yet supplied its own account/i),
    ).toBeInTheDocument();
  });

  it("explains the name without claiming to know why it was chosen", () => {
    render(<AboutPage />);

    expect(
      screen.getByText(/has not published its own account of why the name/i),
    ).toBeInTheDocument();
  });

  it("states what the clinic will not do", () => {
    render(<AboutPage />);

    for (const item of ABOUT_PAGE.commitments.items) {
      expect(
        screen.getByRole("heading", { name: item.title }),
      ).toBeInTheDocument();
    }
  });

  it("gives the clinic's location in text, not only on the contact page", () => {
    render(<AboutPage />);

    expect(screen.getByText(/Godoli, Satara/)).toBeInTheDocument();
  });

  it("does not use a stock photograph as the clinic's own rooms", () => {
    render(<AboutPage />);

    // `phase_05.md` section 24. The page says so instead of showing one.
    expect(
      screen.getByText(/have not been published yet/i),
    ).toBeInTheDocument();

    // Any alt text that describes a clinic interior must also say it is a
    // placeholder, or a screen-reader user is told they are looking at
    // Punarvasu's own rooms when they are not.
    for (const image of screen.getAllByRole("img")) {
      const alt = image.getAttribute("alt") ?? "";
      if (/consulting room|treatment room|reception|clinic/i.test(alt)) {
        expect(alt, alt).toMatch(/placeholder/i);
      }
    }
  });

  it("gives every image an alt attribute", () => {
    const { container } = render(<AboutPage />);

    for (const image of container.querySelectorAll("img")) {
      expect(image.hasAttribute("alt")).toBe(true);
    }
  });

  it("publishes breadcrumb structured data and nothing medical", () => {
    const { container } = render(<AboutPage />);

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    const data = JSON.parse(script?.textContent ?? "{}") as Record<
      string,
      unknown
    >;

    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data).not.toHaveProperty("medicalSpecialty");
    expect(data).not.toHaveProperty("aggregateRating");
  });

  it("has no axe violations, including landmark and region rules", async () => {
    const { container } = render(<AboutPage />);

    await expectNoAxeViolations(container, {
      rules: { region: { enabled: true } },
    });
  });
});

describe("ProseSection", () => {
  const PARAGRAPHS = ["First paragraph.", "Second paragraph."];

  it("renders its paragraphs under a labelled section", () => {
    render(
      <ProseSection
        id="test-section"
        titleId="test-title"
        eyebrow="Eyebrow"
        title="A heading"
        paragraphs={PARAGRAPHS}
      />,
    );

    const region = screen.getByRole("region", { name: "A heading" });
    expect(region).toBeInTheDocument();
    for (const paragraph of PARAGRAPHS) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
  });

  it("renders no onward link when none is given", () => {
    render(
      <ProseSection
        id="test-section"
        titleId="test-title"
        eyebrow="Eyebrow"
        title="A heading"
        paragraphs={PARAGRAPHS}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders the onward link when one is given", () => {
    render(
      <ProseSection
        id="test-section"
        titleId="test-title"
        eyebrow="Eyebrow"
        title="A heading"
        paragraphs={PARAGRAPHS}
        link={{ href: "/contact", label: "Visit the clinic" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Visit the clinic" }),
    ).toHaveAttribute("href", "/contact");
  });
});

describe("StatementList", () => {
  const STATEMENTS = [
    { title: "One", description: "First." },
    { title: "Two", description: "Second." },
  ];

  it("renders a real list, so the count is announced", () => {
    render(<StatementList statements={STATEMENTS} />);

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("UL");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders nothing rather than an empty list", () => {
    const { container } = render(<StatementList statements={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("puts each statement's title at the requested heading level", () => {
    render(<StatementList statements={STATEMENTS} headingLevel="h4" />);

    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(2);
  });

  it("has no axe violations", async () => {
    const { container } = render(<StatementList statements={STATEMENTS} />);
    await expectNoAxeViolations(container);
  });
});
