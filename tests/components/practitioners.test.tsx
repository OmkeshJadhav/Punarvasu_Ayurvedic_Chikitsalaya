import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PractitionersPage from "@/app/(public)/practitioners/page";
import { PractitionerCard } from "@/components/marketing/practitioner-card";
import { PractitionerGrid } from "@/components/marketing/practitioner-grid";
import { PractitionerProfile } from "@/components/marketing/practitioner-profile";
import { PRACTITIONER_IMAGES } from "@/config/images";
import {
  ABOUT_PATH,
  CONTACT_PATH,
  PRACTITIONERS_PATH,
  PRIMARY_CTA,
  practitionerPath,
} from "@/config/navigation";
import {
  PRACTITIONERS,
  PROFILE_SECTION_TITLES,
} from "@/features/practitioners/content";
import { getPractitionerSlugs } from "@/features/practitioners/directory";
import type {
  PendingPractitioner,
  PublishedPractitioner,
} from "@/features/practitioners/types";

import { expectNoAxeViolations } from "../support/axe";

vi.mock("next/navigation", () => ({
  usePathname: () => PRACTITIONERS_PATH,
}));

/**
 * The practitioners experience.
 *
 * The roster ships with nobody published, so most of these assert the
 * *unpublished* behaviour - that the page names no one, marks the
 * placeholders, offers the phone instead, and gives a placeholder no
 * reachable profile page.
 *
 * The published path is proven with a synthetic fixture. Without that, the
 * card and the profile would be untested code that happens to compile, and
 * the phase that publishes a real practitioner would be discovering their
 * defects on a live clinic site. Every fixture value is obviously fake
 * (`docs/QA_STRATEGY.md` section 31).
 */

const PUBLISHED: PublishedPractitioner = {
  slug: "example-practitioner",
  status: "published",
  name: "Example Practitioner",
  designation: "Ayurvedic Physician",
  qualifications: ["BAMS", "MD (Ayurveda)"],
  specialties: ["Panchakarma", "Lifestyle guidance"],
  shortBio: "A short synthetic biography used only in tests.",
  biography: ["A first paragraph.", "A second paragraph."],
  approach: ["How this fixture works with a patient."],
  experience: "In practice since an example year",
  languages: ["Marathi", "Hindi", "English"],
  image: PRACTITIONER_IMAGES.one,
};

const PENDING: PendingPractitioner = {
  slug: "pending-example",
  status: "pending-verification",
  image: PRACTITIONER_IMAGES.two,
};

describe("practitioners page", () => {
  it("owns exactly one h1", () => {
    render(<PractitionersPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("never skips a heading level", () => {
    render(<PractitionersPage />);

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

  it("names nobody, because nobody has been verified", () => {
    render(<PractitionersPage />);

    // The single most important assertion on this page. A fabricated
    // clinician name and qualification on a healthcare site is a patient
    // safety problem, not a content gap.
    const markers = screen.getAllByText("Profile to be published");
    expect(markers).toHaveLength(PRACTITIONERS.length);
  });

  it("tells the visitor why the profiles are blank, and what to do", () => {
    render(<PractitionersPage />);

    expect(
      screen.getByText(/has not yet confirmed its practitioners/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/call the clinic/i)).toBeInTheDocument();
  });

  it("marks the placeholder photographs as placeholders in their alt text", () => {
    render(<PractitionersPage />);

    for (const image of screen.getAllByRole("img")) {
      expect(image.getAttribute("alt")).toMatch(/placeholder/i);
    }
  });

  it("offers no profile link while no profile exists", () => {
    const { container } = render(<PractitionersPage />);

    for (const anchor of container.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href") ?? "";
      expect(
        href.startsWith(`${PRACTITIONERS_PATH}/`),
        `links to a profile page that does not exist: ${href}`,
      ).toBe(false);
    }
  });

  it("builds no profile page while no practitioner is published", () => {
    // `generateStaticParams` reads this, so an empty list means every
    // `/practitioners/<slug>` URL is a real 404 under `dynamicParams = false`.
    expect(getPractitionerSlugs()).toHaveLength(0);
  });

  it("links on to the about and contact pages", () => {
    const { container } = render(<PractitionersPage />);

    const hrefs = [...container.querySelectorAll("a[href]")].map((anchor) =>
      anchor.getAttribute("href"),
    );
    expect(hrefs).toContain(CONTACT_PATH);
    expect(hrefs).toContain(`${ABOUT_PATH}#approach`);
    expect(hrefs).toContain(PRIMARY_CTA.href);
  });

  it("publishes breadcrumbs and no Person structured data", () => {
    const { container } = render(<PractitionersPage />);

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    const data = JSON.parse(script?.textContent ?? "{}") as Record<
      string,
      unknown
    >;

    // `Person` carries a name, a title and credentials - exactly what has not
    // been verified. A search engine would republish it under the clinic's
    // name (`phase_05.md` section 53).
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(JSON.stringify(data)).not.toContain("Person");
  });

  it("names every section landmark", () => {
    render(<PractitionersPage />);

    for (const region of screen.getAllByRole("region")) {
      expect(region).toHaveAccessibleName();
    }
  });

  it("has no axe violations, including landmark and region rules", async () => {
    const { container } = render(<PractitionersPage />);

    await expectNoAxeViolations(container, {
      rules: { region: { enabled: true } },
    });
  });
});

describe("PractitionerCard", () => {
  it("links a published practitioner to their profile", () => {
    render(<PractitionerCard practitioner={PUBLISHED} />);

    expect(screen.getByRole("link", { name: PUBLISHED.name })).toHaveAttribute(
      "href",
      practitionerPath(PUBLISHED.slug),
    );
  });

  it("shows only what the clinic has confirmed", () => {
    render(<PractitionerCard practitioner={PUBLISHED} />);

    expect(screen.getByText("BAMS, MD (Ayurveda)")).toBeInTheDocument();
    expect(screen.getByText(PUBLISHED.shortBio ?? "")).toBeInTheDocument();
  });

  it("omits a field the clinic has not supplied rather than inventing one", () => {
    render(
      <PractitionerCard
        practitioner={{
          slug: "minimal",
          status: "published",
          name: "Minimal Fixture",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Minimal Fixture" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("BAMS")).toBeNull();
  });

  it("gives an unpublished card no link at all", () => {
    render(<PractitionerCard practitioner={PENDING} />);

    // A "View profile" action leading to a 404 is worse than no action.
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Profile to be published")).toBeInTheDocument();
  });

  it("gives every card a heading, published or not", () => {
    render(
      <>
        <PractitionerCard practitioner={PUBLISHED} />
        <PractitionerCard practitioner={PENDING} />
      </>,
    );

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("has no axe violations in either state", async () => {
    const { container } = render(
      <>
        <PractitionerCard practitioner={PUBLISHED} />
        <PractitionerCard practitioner={PENDING} />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("PractitionerGrid", () => {
  it("renders a real list, so the count is announced", () => {
    render(<PractitionerGrid practitioners={[PUBLISHED, PENDING]} />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("explains an empty roster instead of showing a blank band", () => {
    render(<PractitionerGrid practitioners={[]} />);

    expect(
      screen.getByText(/No practitioner profiles yet/i),
    ).toBeInTheDocument();
  });

  it("has no axe violations when empty", async () => {
    const { container } = render(<PractitionerGrid practitioners={[]} />);
    await expectNoAxeViolations(container);
  });
});

describe("PractitionerProfile", () => {
  it("owns the page's h1 and names the practitioner", () => {
    render(
      <PractitionerProfile practitioner={PUBLISHED} titleId="profile-title" />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(PUBLISHED.name);
  });

  it("renders every confirmed section", () => {
    render(
      <PractitionerProfile practitioner={PUBLISHED} titleId="profile-title" />,
    );

    for (const title of Object.values(PROFILE_SECTION_TITLES)) {
      expect(
        screen.getByRole("heading", { name: title }),
        `missing section "${title}"`,
      ).toBeInTheDocument();
    }
  });

  it("leaves no empty heading behind for a section the clinic did not supply", () => {
    render(
      <PractitionerProfile
        practitioner={{
          slug: "minimal",
          status: "published",
          name: "Minimal Fixture",
        }}
        titleId="profile-title"
      />,
    );

    expect(
      screen.queryByRole("heading", { name: PROFILE_SECTION_TITLES.biography }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: PROFILE_SECTION_TITLES.languages }),
    ).toBeNull();
  });

  it("always says that choosing a practitioner does not decide the outcome", () => {
    render(
      <PractitionerProfile
        practitioner={{
          slug: "minimal",
          status: "published",
          name: "Minimal Fixture",
        }}
        titleId="profile-title"
      />,
    );

    // `phase_05.md` section 44. Present even on the sparsest profile.
    expect(
      screen.getByText(/does not change how care is decided/i),
    ).toBeInTheDocument();
  });

  it("offers a consultation and a way to contact the clinic", () => {
    render(
      <PractitionerProfile practitioner={PUBLISHED} titleId="profile-title" />,
    );

    expect(
      screen.getByRole("link", { name: PRIMARY_CTA.label }),
    ).toHaveAttribute("href", PRIMARY_CTA.href);
    expect(
      screen.getByRole("link", { name: "Contact the clinic" }),
    ).toHaveAttribute("href", CONTACT_PATH);
  });

  it("marks the current page in the breadcrumb trail", () => {
    render(
      <PractitionerProfile practitioner={PUBLISHED} titleId="profile-title" />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByText(PUBLISHED.name)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <PractitionerProfile practitioner={PUBLISHED} titleId="profile-title" />,
    );
    await expectNoAxeViolations(container);
  });
});
