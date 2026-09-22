import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FaqSection } from "@/components/marketing/faq-section";
import { Hero } from "@/components/marketing/hero";
import { LocationSection } from "@/components/marketing/location-section";
import { PractitionerPreviewSection } from "@/components/marketing/practitioner-preview";
import { ServicePreviewSection } from "@/components/marketing/service-preview";
import type { ClinicContact } from "@/config/clinic";
import { SERVICE_IMAGES, PRACTITIONER_IMAGES } from "@/config/images";
import {
  FAQ_ITEMS,
  FEATURED_SERVICES,
  type ServicePreview,
} from "@/config/marketing-content";
import { PRACTITIONERS } from "@/features/practitioners/content";
import type { PublishedPractitioner } from "@/features/practitioners/types";
import { PRIMARY_CTA } from "@/config/navigation";

import { expectNoAxeViolations } from "../support/axe";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

/**
 * Marketing section tests.
 *
 * These check the three things that are easy to get wrong in a marketing page
 * and impossible to see in a screenshot: that interactive content is operable
 * from a keyboard, that a section with no data degrades instead of rendering
 * an empty shell, and that nothing claims a fact the clinic has not verified.
 */

describe("Hero", () => {
  it("owns the page's single h1", () => {
    render(<Hero />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
  });

  it("offers a primary and a secondary action, in that order", () => {
    render(<Hero />);

    const primary = screen.getByRole("link", { name: "Book a Consultation" });
    const secondary = screen.getByRole("link", {
      name: "Explore our approach",
    });

    expect(primary).toHaveAttribute("href", PRIMARY_CTA.href);
    // The secondary action scrolls; it must not lead off to a route that does
    // not exist yet.
    expect(secondary.getAttribute("href")).toMatch(/^\/#/);
    expect(
      primary.compareDocumentPosition(secondary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("gives the hero photograph descriptive alt text", () => {
    render(<Hero />);

    const image = screen.getByRole("img");
    expect(image.getAttribute("alt")?.length ?? 0).toBeGreaterThan(20);
  });

  it("states trust qualitatively, with no invented figures", () => {
    render(<Hero />);

    const list = screen.getByRole("list");
    // Nothing in the trust strip may be a count, a percentage or a rating.
    expect(within(list).queryByText(/\d[\d,]*\s*\+|\d+%|★/)).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(<Hero />);
    await expectNoAxeViolations(container);
  });
});

describe("ServicePreviewSection", () => {
  it("renders one card per service, each linking somewhere real", () => {
    render(<ServicePreviewSection services={FEATURED_SERVICES} />);

    for (const service of FEATURED_SERVICES) {
      expect(screen.getByRole("link", { name: service.name })).toHaveAttribute(
        "href",
        PRIMARY_CTA.href,
      );
    }
  });

  it("keeps the cards in a real list, so the count is announced", () => {
    render(<ServicePreviewSection services={FEATURED_SERVICES} />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(
      FEATURED_SERVICES.length,
    );
  });

  it("shows a useful empty state instead of an empty grid", () => {
    render(<ServicePreviewSection services={[]} />);

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    // The visitor is still given the action the whole page exists for.
    expect(
      screen.getByRole("link", { name: PRIMARY_CTA.label }),
    ).toBeInTheDocument();
  });

  it("gives every service image alt text", () => {
    render(<ServicePreviewSection services={FEATURED_SERVICES} />);

    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveAccessibleName();
    }
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ServicePreviewSection services={FEATURED_SERVICES} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("PractitionerPreviewSection", () => {
  // A synthetic fixture. The shipped roster names nobody, so a published
  // profile has to be constructed here to prove the component can render one
  // (`docs/QA_STRATEGY.md` section 31 - test data is always clearly fake).
  const publishedPractitioner: PublishedPractitioner = {
    slug: "example-practitioner",
    status: "published",
    image: PRACTITIONER_IMAGES.one,
    name: "Example Name",
    qualifications: ["BAMS"],
    specialties: ["General Ayurvedic practice"],
    shortBio: "An introduction.",
  };

  it("never invents a name for an unverified profile", () => {
    render(<PractitionerPreviewSection practitioners={PRACTITIONERS} />);

    // The shipped data has no names. Each card must say so rather than fill
    // the gap - a fabricated clinician is a patient-safety problem.
    const markers = screen.getAllByText("Profile to be published");
    expect(markers).toHaveLength(PRACTITIONERS.length);
  });

  it("marks the placeholder photographs as placeholders in their alt text", () => {
    render(<PractitionerPreviewSection practitioners={PRACTITIONERS} />);

    for (const image of screen.getAllByRole("img")) {
      expect(image.getAttribute("alt")).toMatch(/placeholder/i);
    }
  });

  it("renders a real profile when one is supplied", () => {
    render(
      <PractitionerPreviewSection practitioners={[publishedPractitioner]} />,
    );

    expect(
      screen.getByRole("heading", { name: "Example Name" }),
    ).toBeInTheDocument();
    expect(screen.getByText("BAMS")).toBeInTheDocument();
    expect(screen.queryByText("Profile to be published")).toBeNull();
  });

  it("gives every card a heading, published or not", () => {
    render(<PractitionerPreviewSection practitioners={PRACTITIONERS} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(
      PRACTITIONERS.length,
    );
  });

  it("hides itself entirely when there is nobody to show", () => {
    const { container } = render(
      <PractitionerPreviewSection practitioners={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <PractitionerPreviewSection practitioners={PRACTITIONERS} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("FaqSection", () => {
  it("renders every question as a collapsed disclosure", () => {
    render(<FaqSection items={FAQ_ITEMS} />);

    const triggers = screen.getAllByRole("button");
    expect(triggers).toHaveLength(FAQ_ITEMS.length);
    for (const trigger of triggers) {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("puts each question in the document outline at h3", () => {
    render(<FaqSection items={FAQ_ITEMS} />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(FAQ_ITEMS.length);
  });

  it("opens an answer with the keyboard alone", async () => {
    const user = userEvent.setup();
    render(<FaqSection items={FAQ_ITEMS} />);

    const first = screen.getAllByRole("button")[0];
    expect(first).toBeDefined();

    first?.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(first).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByText(FAQ_ITEMS[0]!.answer)).toBeVisible();
  });

  it("collapses again, so nothing is trapped open", async () => {
    const user = userEvent.setup();
    render(<FaqSection items={FAQ_ITEMS} />);

    const first = screen.getAllByRole("button")[0];
    first?.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(first).toHaveAttribute("aria-expanded", "true"));

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(first).toHaveAttribute("aria-expanded", "false"),
    );
  });

  it("shows one answer at a time, so the page does not jump", async () => {
    const user = userEvent.setup();
    render(<FaqSection items={FAQ_ITEMS} />);

    const triggers = screen.getAllByRole("button");
    await user.click(triggers[0]!);
    await waitFor(() =>
      expect(triggers[0]).toHaveAttribute("aria-expanded", "true"),
    );

    await user.click(triggers[1]!);
    await waitFor(() =>
      expect(triggers[1]).toHaveAttribute("aria-expanded", "true"),
    );
    expect(triggers[0]).toHaveAttribute("aria-expanded", "false");
  });

  it("reaches every question by Tab", async () => {
    const user = userEvent.setup();
    render(<FaqSection items={FAQ_ITEMS} />);

    const triggers = screen.getAllByRole("button");
    for (const trigger of triggers) {
      await user.tab();
      expect(trigger).toHaveFocus();
    }
  });

  it("renders nothing when there are no questions", () => {
    const { container } = render(<FaqSection items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no axe violations, open and closed", async () => {
    const user = userEvent.setup();
    const { container } = render(<FaqSection items={FAQ_ITEMS} />);

    await expectNoAxeViolations(container);

    await user.click(screen.getAllByRole("button")[0]!);
    await waitFor(() =>
      expect(screen.getAllByRole("button")[0]).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
    await expectNoAxeViolations(container);
  });
});

describe("LocationSection", () => {
  it("renders nothing while no clinic details are verified", () => {
    const { container } = render(<LocationSection contact={{}} />);

    // Deliberate: an invented address on a clinic website sends a patient to
    // the wrong building.
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the details that do exist, and only those", () => {
    const contact: ClinicContact = {
      phone: "+910000000000",
      openingHours: "Mon-Sat, 9:00-19:00",
    };
    render(<LocationSection contact={contact} />);

    expect(screen.getByText("Mon-Sat, 9:00-19:00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+910000000000" })).toHaveAttribute(
      "href",
      "tel:+910000000000",
    );
    expect(screen.queryByText("Address")).not.toBeInTheDocument();
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
  });

  it("marks a directions link as opening in a new tab", () => {
    render(
      <LocationSection
        contact={{
          phone: "+910000000000",
          directionsUrl: "https://example.org/map",
        }}
      />,
    );

    // `\s*` rather than a literal space: jsdom has no layout, so
    // dom-accessibility-api trims the space in front of the visually hidden
    // suffix that a real browser keeps. What matters is that the suffix is
    // part of the name at all.
    const link = screen.getByRole("link", {
      name: /^Get directions\s*\(opens in a new tab\)$/,
    });
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <LocationSection
        contact={{
          phone: "+910000000000",
          email: "someone@example.org",
          openingHours: "Mon-Sat",
        }}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("marketing content safety", () => {
  it("uses no numeric trust claims anywhere in the shipped copy", () => {
    const services: readonly ServicePreview[] = FEATURED_SERVICES;
    const copy = [
      ...services.map((service) => `${service.name} ${service.description}`),
      ...FAQ_ITEMS.map((item) => `${item.question} ${item.answer}`),
    ].join(" ");

    // Patient counts, success rates and rankings are the specific claims the
    // phase forbids without verified data.
    expect(copy).not.toMatch(/\d+\s*%/);
    expect(copy).not.toMatch(/\d[\d,]{2,}\+/);
    expect(copy).not.toMatch(/\b(?:cure|cures|guaranteed|100% safe)\b/i);
  });

  it("keeps every service image paired with real alt text", () => {
    for (const image of Object.values(SERVICE_IMAGES)) {
      expect(image.alt.length).toBeGreaterThan(20);
    }
  });
});
