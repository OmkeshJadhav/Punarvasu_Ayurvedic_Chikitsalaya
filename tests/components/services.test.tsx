import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ServicesPage from "@/app/(public)/services/page";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { RelatedTreatments } from "@/components/marketing/related-treatments";
import { TreatmentArticle } from "@/components/marketing/treatment-article";
import { TreatmentCard } from "@/components/marketing/treatment-card";
import { TreatmentHero } from "@/components/marketing/treatment-hero";
import { ServiceCollection } from "@/components/services/service-collection";
import { TestimonialCarousel } from "@/components/services/testimonial-carousel";
import {
  CONTACT_PATH,
  PRIMARY_CTA,
  SERVICES_PATH,
  treatmentPath,
} from "@/config/navigation";
import {
  getAllTreatments,
  getCategory,
  getRelatedTreatments,
  getTreatmentBySlug,
  getTreatmentsByCategory,
} from "@/features/services/catalogue";
import {
  ONGOING_SUPPORT_SLUG,
  SERVICES_PAGE,
  SERVICES_SECTIONS,
} from "@/features/services/content";
import {
  getDisplayTestimonials,
  TESTIMONIALS,
} from "@/features/testimonials/content";
import type { Treatment } from "@/features/services/types";

import { expectNoAxeViolations } from "../support/axe";

vi.mock("next/navigation", () => ({
  usePathname: () => SERVICES_PATH,
}));

/**
 * The services experience.
 *
 * These cover the things that are easy to get wrong and impossible to see in
 * a screenshot: that every card is a real link to a page that exists, that
 * the jump rail lands somewhere, that an optional section with no content
 * leaves no empty heading behind, that the safety copy is present on every
 * treatment page, and that the whole thing is operable from a keyboard.
 */

function requireTreatment(slug: string): Treatment {
  const treatment = getTreatmentBySlug(slug);
  if (!treatment) {
    throw new Error(`fixture error: no treatment "${slug}"`);
  }
  return treatment;
}

const WITH_IMAGE = requireTreatment("shirodhara");
const WITHOUT_IMAGE = requireTreatment("ayurvedic-consultation");

describe("services page", () => {
  it("owns exactly one h1", () => {
    render(<ServicesPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("never skips a heading level", () => {
    render(<ServicesPage />);

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
    const { container } = render(<ServicesPage />);

    const ids = [...container.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("links every treatment in the catalogue to its own page", () => {
    render(<ServicesPage />);

    for (const treatment of getAllTreatments()) {
      const links = screen.getAllByRole("link", { name: treatment.name });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toHaveAttribute("href", treatmentPath(treatment.slug));
      }
    }
  });

  it("points the hero's secondary action at a section that exists", () => {
    const { container } = render(<ServicesPage />);

    const link = screen.getByRole("link", {
      name: SERVICES_PAGE.hero.secondaryAction.label,
    });
    const targetId = (link.getAttribute("href") ?? "").replace(/^#/, "");
    const target = container.querySelector(`#${CSS.escape(targetId)}`);
    expect(target, `no element with id "${targetId}"`).not.toBeNull();
  });

  it("gives every in-page section a scroll offset clear of the sticky header", () => {
    const { container } = render(<ServicesPage />);

    for (const id of Object.values(SERVICES_SECTIONS)) {
      const target = container.querySelector(`#${CSS.escape(id)}`);
      expect(target, `no section with id "${id}"`).not.toBeNull();
      expect(target?.className).toContain("anchor-offset");
    }
  });

  it("labels every treatment tile with its category", () => {
    render(<ServicesPage />);

    const collection = screen.getByRole("region", {
      name: SERVICES_PAGE.catalogue.title,
    });
    for (const group of getTreatmentsByCategory()) {
      expect(within(collection).getAllByText(group.category.name)).toHaveLength(
        group.treatments.length,
      );
    }
  });

  it("links the ongoing-support section to a treatment that exists", () => {
    render(<ServicesPage />);

    expect(getTreatmentBySlug(ONGOING_SUPPORT_SLUG)).toBeDefined();
    expect(
      screen.getByRole("link", { name: SERVICES_PAGE.ongoing.actionLabel }),
    ).toHaveAttribute("href", treatmentPath(ONGOING_SUPPORT_SLUG));
  });

  it("shows the patient's real words, attributed", () => {
    render(<ServicesPage />);

    for (const testimonial of TESTIMONIALS) {
      expect(screen.getByText(testimonial.quote)).toBeInTheDocument();
    }
  });

  it("names topics people raise rather than promising outcomes", () => {
    render(<ServicesPage />);

    for (const topic of SERVICES_PAGE.testimonials.topics) {
      expect(topic).not.toMatch(/\b(better|improved|more|less|reduced)\b/i);
      expect(screen.getByText(topic)).toBeInTheDocument();
    }
  });

  it("names every section landmark, so they are navigable", () => {
    render(<ServicesPage />);

    for (const region of screen.getAllByRole("region")) {
      expect(region).toHaveAccessibleName();
    }
  });

  it("says plainly that the content has not been reviewed by a clinician", () => {
    render(<ServicesPage />);

    expect(
      screen.getByText(/awaiting review by a practitioner/i),
    ).toBeInTheDocument();
  });

  it("renders the medical disclaimer and emergency guidance outside any disclosure", () => {
    render(<ServicesPage />);

    // Not behind the accordion: a collapsed panel is not "visible where
    // appropriate" (`HEALTHCARE_AND_AI_SAFETY.md` 3.2-3.3).
    expect(screen.getByText(/not medical advice/i)).toBeVisible();
    expect(
      screen.getByText(/contact emergency medical services/i),
    ).toBeVisible();
  });

  it("points every 'Book a Consultation' action at the booking route", () => {
    render(<ServicesPage />);

    const ctas = screen.getAllByRole("link", { name: PRIMARY_CTA.label });
    expect(ctas.length).toBeGreaterThan(1);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", PRIMARY_CTA.href);
    }
  });

  it("links nowhere that is known not to exist", () => {
    const { container } = render(<ServicesPage />);

    const treatmentHrefs = new Set(
      getAllTreatments().map((treatment) => treatmentPath(treatment.slug)),
    );

    for (const anchor of container.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#") || href.startsWith("http")) {
        continue;
      }
      expect(
        href === "/" ||
          href === SERVICES_PATH ||
          href === PRIMARY_CTA.href ||
          href.startsWith(`${CONTACT_PATH}#`) ||
          href.startsWith("/#") ||
          treatmentHrefs.has(href),
        `unexpected internal link: ${href}`,
      ).toBe(true);
    }
  });

  it("gives every image alt text", () => {
    render(<ServicesPage />);

    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveAccessibleName();
    }
  });

  it("opens and closes an FAQ answer from the keyboard", async () => {
    const user = userEvent.setup();
    render(<ServicesPage />);

    const trigger = screen.getByRole("button", {
      name: /which treatment should i choose/i,
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("has no axe violations", async () => {
    const { container } = render(<ServicesPage />);
    await expectNoAxeViolations(container);
  });
});

describe("ServiceCollection", () => {
  it("shows a useful empty state instead of an empty grid", () => {
    render(<ServiceCollection groups={[]} showReviewNotice={false} />);

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: PRIMARY_CTA.label }),
    ).toBeInTheDocument();
  });

  it("lists every treatment in a real list, one link per tile", () => {
    render(
      <ServiceCollection
        groups={getTreatmentsByCategory()}
        showReviewNotice={false}
      />,
    );

    const treatments = getAllTreatments();
    expect(screen.getAllByRole("listitem")).toHaveLength(treatments.length);
    for (const treatment of treatments) {
      expect(
        screen.getAllByRole("link", { name: treatment.name }),
      ).toHaveLength(1);
    }
  });

  it("shows the review notice only when asked to", () => {
    const { rerender } = render(
      <ServiceCollection
        groups={getTreatmentsByCategory()}
        showReviewNotice={false}
      />,
    );
    expect(
      screen.queryByText(/awaiting review by a practitioner/i),
    ).not.toBeInTheDocument();

    rerender(
      <ServiceCollection groups={getTreatmentsByCategory()} showReviewNotice />,
    );
    expect(
      screen.getByText(/awaiting review by a practitioner/i),
    ).toBeInTheDocument();
  });
});

describe("testimonials", () => {
  it("never ships placeholders in a production build", () => {
    expect(
      getDisplayTestimonials(false).some((entry) => entry.placeholder),
    ).toBe(false);
    expect(getDisplayTestimonials(false)).toHaveLength(TESTIMONIALS.length);
  });

  it("requires a consent reference on every published testimonial", () => {
    for (const testimonial of TESTIMONIALS) {
      expect(testimonial.consentRecord.trim(), testimonial.id).not.toBe("");
    }
  });

  it("marks every placeholder visibly", () => {
    const entries = getDisplayTestimonials(true);
    const placeholders = entries.filter((entry) => entry.placeholder);
    expect(placeholders.length).toBeGreaterThan(0);

    render(<TestimonialCarousel testimonials={placeholders} label="Quotes" />);
    const labels = screen.getAllByText("Placeholder", { ignore: false });
    expect(labels).toHaveLength(placeholders.length);
    // The visible slide carries its label; hidden slides carry theirs too.
    expect(labels[0]).toBeVisible();
  });

  it("moves between quotes from the keyboard, without a timer", async () => {
    const user = userEvent.setup();
    const entries = getDisplayTestimonials(true);
    render(<TestimonialCarousel testimonials={entries} label="Quotes" />);

    const slides = screen.getAllByRole("group", { hidden: true });
    expect(slides).toHaveLength(entries.length);
    expect(slides[0]).toBeVisible();
    expect(slides[1]).not.toBeVisible();

    screen.getByRole("button", { name: "Next testimonial" }).focus();
    await user.keyboard("{Enter}");
    expect(slides[0]).not.toBeVisible();
    expect(slides[1]).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Previous testimonial" }),
    );
    expect(slides[0]).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: `Show testimonial 1 of ${entries.length}`,
      }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("renders no controls for a single quote", () => {
    render(
      <TestimonialCarousel
        testimonials={getDisplayTestimonials(false)}
        label="Quotes"
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("TreatmentCard", () => {
  it("makes the whole card one link with the treatment's name", () => {
    render(<TreatmentCard treatment={WITH_IMAGE} imageSizes="100vw" />);

    const link = screen.getByRole("link", { name: WITH_IMAGE.name });
    expect(link).toHaveAttribute("href", treatmentPath(WITH_IMAGE.slug));
    // One link per card: the "Explore treatment" affordance is decorative, so
    // a keyboard user tabs through the catalogue once, not twice.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders a treatment with no photograph without an empty frame", () => {
    render(<TreatmentCard treatment={WITHOUT_IMAGE} imageSizes="100vw" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: WITHOUT_IMAGE.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(WITHOUT_IMAGE.summary)).toBeInTheDocument();
  });

  it("does not invite booking a therapy nobody has assessed", () => {
    render(<TreatmentCard treatment={WITH_IMAGE} imageSizes="100vw" />);

    expect(screen.queryByText(/book now|buy|order/i)).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <TreatmentCard treatment={WITH_IMAGE} imageSizes="100vw" />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("Breadcrumbs", () => {
  const items = [
    { label: "Home", href: "/" },
    { label: "Services", href: SERVICES_PATH },
    { label: "Shirodhara" },
  ];

  it("marks the current page and does not link it to itself", () => {
    render(<Breadcrumbs items={items} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getAllByRole("link")).toHaveLength(2);

    const current = within(nav).getByText("Shirodhara");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("keeps the trail in an ordered list", () => {
    render(<Breadcrumbs items={items} />);

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(items.length);
  });

  it("has no axe violations", async () => {
    const { container } = render(<Breadcrumbs items={items} />);
    await expectNoAxeViolations(container);
  });
});

describe("TreatmentHero", () => {
  it("puts the name in the page's h1 and the actions above the fold", () => {
    render(
      <TreatmentHero
        treatment={WITH_IMAGE}
        category={getCategory(WITH_IMAGE.categoryId)}
        titleId="treatment-title"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: WITH_IMAGE.name }),
    ).toBeInTheDocument();

    const primary = screen.getByRole("link", { name: PRIMARY_CTA.label });
    expect(primary).toHaveAttribute("href", PRIMARY_CTA.href);

    const secondary = screen.getByRole("link", {
      name: "Explore other treatments",
    });
    expect(secondary).toHaveAttribute("href", SERVICES_PATH);
    // The primary action precedes the photograph in the DOM, so a phone
    // reaches it without scrolling past an image.
    const image = screen.getByRole("img");
    expect(
      primary.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders a single column when the treatment has no photograph", () => {
    render(
      <TreatmentHero
        treatment={WITHOUT_IMAGE}
        category={getCategory(WITHOUT_IMAGE.categoryId)}
        titleId="treatment-title"
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: WITHOUT_IMAGE.name }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <TreatmentHero
        treatment={WITH_IMAGE}
        category={getCategory(WITH_IMAGE.categoryId)}
        titleId="treatment-title"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("TreatmentArticle", () => {
  it("always renders precautions and the emergency guidance", () => {
    for (const treatment of getAllTreatments()) {
      const { unmount } = render(<TreatmentArticle treatment={treatment} />);

      expect(
        screen.getByRole("heading", { name: "Before you consider this" }),
        `${treatment.slug} has no precautions section`,
      ).toBeInTheDocument();
      expect(
        screen.getByText(/contact emergency medical services/i),
      ).toBeVisible();

      unmount();
    }
  });

  it("falls back to general guidance rather than an invented list", () => {
    render(<TreatmentArticle treatment={WITH_IMAGE} />);

    expect(
      screen.getByText(/has not published specific precautions/i),
    ).toBeVisible();
  });

  it("renders no heading for a section the treatment has no content for", () => {
    // Shirodhara has no FAQs of its own; the heading must be absent rather
    // than sitting over nothing (`phase_04.md` section 60).
    expect(WITH_IMAGE.content.faqs).toBeUndefined();

    render(<TreatmentArticle treatment={WITH_IMAGE} />);

    expect(
      screen.queryByRole("heading", {
        name: /questions about this treatment/i,
      }),
    ).toBeNull();
  });

  it("labels traditional description as tradition rather than evidence", () => {
    render(<TreatmentArticle treatment={WITH_IMAGE} />);

    expect(
      screen.getByRole("heading", { name: "Traditional Ayurvedic context" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not a summary of modern clinical research/i),
    ).toBeVisible();
  });

  it("gives the contents rail a target for every section it lists", () => {
    const { container } = render(<TreatmentArticle treatment={WITH_IMAGE} />);

    const rail = screen.getByRole("navigation", { name: "On this page" });
    for (const link of within(rail).getAllByRole("link")) {
      const targetId = (link.getAttribute("href") ?? "").replace(/^#/, "");
      expect(
        container.querySelector(`#${CSS.escape(targetId)}`),
        `no element with id "${targetId}"`,
      ).not.toBeNull();
    }
  });

  it("marks unreviewed copy on the page itself", () => {
    render(<TreatmentArticle treatment={WITH_IMAGE} />);

    expect(screen.getByText(/awaiting clinical review/i)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<TreatmentArticle treatment={WITH_IMAGE} />);
    await expectNoAxeViolations(container);
  });
});

describe("RelatedTreatments", () => {
  it("frames related treatments as navigation, not as a recommendation", () => {
    render(<RelatedTreatments treatments={getRelatedTreatments(WITH_IMAGE)} />);

    expect(
      screen.getByRole("heading", {
        name: /explore related ayurvedic therapies/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/recommended for you|because you viewed/i),
    ).toBeNull();
  });

  it("renders nothing when there is nothing related", () => {
    const { container } = render(<RelatedTreatments treatments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links each related treatment to its page", () => {
    const related = getRelatedTreatments(WITH_IMAGE);
    render(<RelatedTreatments treatments={related} />);

    for (const treatment of related) {
      expect(
        screen.getByRole("link", { name: treatment.name }),
      ).toHaveAttribute("href", treatmentPath(treatment.slug));
    }
  });
});
