import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PractitionerPortrait } from "@/components/marketing/practitioner-portrait";
import { PRACTITIONER_IMAGES } from "@/config/images";
import { ABOUT_PATH, PRIMARY_CTA } from "@/config/navigation";
import {
  PRACTITIONERS,
  PROFILE_CONSULTATION_NOTE,
  PROFILE_SECTION_TITLES,
} from "@/features/practitioners/content";
import {
  isPublished,
  type PendingPractitioner,
  type PublishedPractitioner,
} from "@/features/practitioners/types";

import { expectNoAxeViolations } from "../support/axe";

vi.mock("next/navigation", () => ({
  usePathname: () => ABOUT_PATH,
}));

/**
 * Practitioner portraits and the full-profile modal.
 *
 * `/practitioners` was retired: the home and About pages introduce each
 * doctor, and the full profile opens in `PractitionerProfileDialog`. These
 * tests prove the modal carries everything the old profile page did, opens
 * and closes accessibly, and never opens for an unconfirmed profile.
 *
 * Fixture values are obviously fake (`docs/QA_STRATEGY.md` section 31).
 */

const PUBLISHED: PublishedPractitioner = {
  slug: "example-practitioner",
  status: "published",
  name: "Example Practitioner",
  designation: "Ayurvedic Physician",
  qualifications: ["BAMS", "MD (Ayurveda)"],
  registrationNumber: "EXAMPLE-000",
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

async function openProfile() {
  const user = userEvent.setup();
  render(<PractitionerPortrait practitioner={PUBLISHED} summary />);
  await user.click(screen.getByRole("button", { name: /view full profile/i }));
  return { user, dialog: await screen.findByRole("dialog") };
}

describe("PractitionerPortrait", () => {
  it("shows the short details on the card", () => {
    render(<PractitionerPortrait practitioner={PUBLISHED} summary />);

    expect(
      screen.getByRole("heading", { name: PUBLISHED.name }),
    ).toBeInTheDocument();
    expect(screen.getByText("BAMS, MD (Ayurveda)")).toBeInTheDocument();
    expect(screen.getByText(PUBLISHED.shortBio ?? "")).toBeInTheDocument();
  });

  it("links nowhere - the full profile is a modal, not a page", () => {
    const { container } = render(
      <PractitionerPortrait practitioner={PUBLISHED} />,
    );

    expect(container.querySelector("a[href]")).toBeNull();
  });

  it("offers no profile for an unconfirmed practitioner", () => {
    render(<PractitionerPortrait practitioner={PENDING} />);

    expect(screen.getByText("Profile to be published")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <PractitionerPortrait practitioner={PUBLISHED} summary />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("PractitionerProfileDialog", () => {
  it("is named by the practitioner", async () => {
    const { dialog } = await openProfile();

    expect(dialog).toHaveAccessibleName(PUBLISHED.name);
  });

  it("carries every confirmed detail", async () => {
    const { dialog } = await openProfile();
    const inDialog = within(dialog);

    expect(inDialog.getByText("BAMS, MD (Ayurveda)")).toBeInTheDocument();
    expect(inDialog.getByText("EXAMPLE-000")).toBeInTheDocument();
    expect(inDialog.getByText("Marathi, Hindi, English")).toBeInTheDocument();
    for (const specialty of PUBLISHED.specialties ?? []) {
      expect(inDialog.getByText(specialty)).toBeInTheDocument();
    }
    for (const paragraph of PUBLISHED.biography ?? []) {
      expect(inDialog.getByText(paragraph)).toBeInTheDocument();
    }
    expect(
      inDialog.getByRole("heading", { name: PROFILE_SECTION_TITLES.approach }),
    ).toBeInTheDocument();
    expect(inDialog.getByText(PROFILE_CONSULTATION_NOTE)).toBeInTheDocument();
  });

  it("leaves no empty heading for a detail the clinic has not supplied", async () => {
    const user = userEvent.setup();
    const minimal: PublishedPractitioner = {
      slug: "minimal-example",
      status: "published",
      name: "Minimal Example",
      qualifications: ["BAMS"],
    };
    render(<PractitionerPortrait practitioner={minimal} />);
    await user.click(
      screen.getByRole("button", { name: /view full profile/i }),
    );
    const dialog = within(await screen.findByRole("dialog"));

    for (const title of [
      PROFILE_SECTION_TITLES.biography,
      PROFILE_SECTION_TITLES.approach,
      PROFILE_SECTION_TITLES.specialties,
    ]) {
      expect(dialog.queryByRole("heading", { name: title })).toBeNull();
    }
    expect(dialog.queryByText(PROFILE_SECTION_TITLES.registration)).toBeNull();
  });

  it("leads to booking", async () => {
    const { dialog } = await openProfile();

    expect(
      within(dialog).getByRole("link", { name: /book a consultation/i }),
    ).toHaveAttribute("href", PRIMARY_CTA.href);
  });

  it("closes with Escape and returns focus to its trigger", async () => {
    const { user } = await openProfile();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: /view full profile/i }),
    ).toHaveFocus();
  });

  it("has no axe violations while open", async () => {
    const { dialog } = await openProfile();
    await expectNoAxeViolations(dialog);
  });
});

describe("the shipped roster", () => {
  it("opens a full profile for every confirmed practitioner", async () => {
    const user = userEvent.setup();

    for (const practitioner of PRACTITIONERS.filter(isPublished)) {
      const { unmount } = render(
        <PractitionerPortrait practitioner={practitioner} />,
      );
      await user.click(
        screen.getByRole("button", { name: /view full profile/i }),
      );
      expect(await screen.findByRole("dialog")).toHaveAccessibleName(
        practitioner.name,
      );
      unmount();
    }
  });
});
