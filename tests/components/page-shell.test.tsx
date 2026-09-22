import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  FOOTER_NAV_GROUPS,
  LEGAL_NAV_ITEMS,
  PRIMARY_CTA,
  PUBLIC_NAV_ITEMS,
} from "@/config/navigation";

import { expectNoAxeViolations } from "../support/axe";

vi.mock("next/navigation", () => ({
  usePathname: () => "/treatments",
}));

/**
 * Page-level accessibility.
 *
 * Component tests check components; these check the things that only exist
 * once a page is assembled - landmark structure, heading order, id uniqueness,
 * and the skip link actually pointing at the main landmark. The `region` rule
 * is re-enabled here, because at page level every piece of content *should*
 * live inside a landmark.
 */
function AssembledPage() {
  return (
    <>
      <SiteHeader navItems={PUBLIC_NAV_ITEMS} primaryAction={PRIMARY_CTA} />
      <main id="main-content">
        <Section aria-labelledby="intro">
          <Container>
            <SectionHeader
              titleId="intro"
              as="h1"
              eyebrow="Treatments"
              title="Ayurvedic treatments"
              description="Consultation and treatment guided by qualified practitioners."
            />
            <Card>
              <CardTitle as="h2">Panchakarma</CardTitle>
              <CardDescription>
                Traditional Ayurvedic detoxification.
              </CardDescription>
            </Card>
            <Button>Book a Consultation</Button>
          </Container>
        </Section>
      </main>
      <SiteFooter
        groups={FOOTER_NAV_GROUPS}
        legalItems={LEGAL_NAV_ITEMS}
        tagline="Ayurvedic consultation and treatment."
        disclaimer="Information on this website is general in nature and is not a substitute for professional diagnosis or treatment."
      />
    </>
  );
}

describe("assembled page", () => {
  it("provides banner, main and contentinfo landmarks", () => {
    render(<AssembledPage />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("has exactly one h1", () => {
    render(<AssembledPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("does not skip a heading level", () => {
    render(<AssembledPage />);

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

  it("names every section landmark", () => {
    render(<AssembledPage />);

    expect(
      screen.getByRole("region", { name: "Ayurvedic treatments" }),
    ).toBeInTheDocument();
  });

  it("points the skip link at the main landmark, which exists", async () => {
    const user = userEvent.setup();
    const { container } = render(<AssembledPage />);

    await user.tab();
    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toHaveFocus();

    const target = container.querySelector("#main-content");
    expect(target).not.toBeNull();
    expect(target?.tagName).toBe("MAIN");
  });

  it("uses unique ids throughout", () => {
    const { container } = render(<AssembledPage />);

    const ids = [...container.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no axe violations, including landmark and region rules", async () => {
    const { container } = render(<AssembledPage />);

    await expectNoAxeViolations(container, {
      rules: { region: { enabled: true } },
    });
  });
});

describe("StatusMessage", () => {
  it("owns the main landmark and the page heading", () => {
    render(
      <StatusMessage
        title="We couldn't find that page"
        description="The page may have moved."
      >
        <Button>Go to the homepage</Button>
      </StatusMessage>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn't find that page",
      }),
    ).toBeInTheDocument();
  });

  it("shows only an opaque reference", () => {
    render(
      <StatusMessage
        title="Something went wrong"
        description="We couldn't load this page."
        reference="9f2c1a"
      />,
    );

    expect(screen.getByText("9f2c1a")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <StatusMessage
        icon={<svg />}
        title="Something went wrong"
        description="We couldn't load this page."
        reference="9f2c1a"
      >
        <Button>Try again</Button>
      </StatusMessage>,
    );

    await expectNoAxeViolations(container, {
      rules: { region: { enabled: true } },
    });
  });
});
