import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceNav } from "@/components/doctor/workspace/workspace-nav";
import {
  WaitingNotice,
  WorkspaceSection,
  WorkspaceSectionFallback,
} from "@/components/doctor/workspace/workspace-section";
import { DOCTOR_WORKSPACE_COPY } from "@/features/doctor/content";
import {
  WORKSPACE_SECTIONS,
  appointmentWorkspaceHref,
} from "@/features/doctor/workspace";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The doctor's appointment workspace — notes, prescription, treatment plan,
 * documents and AI support as sections of one page.
 *
 * The sections themselves are async server components over the existing,
 * already-tested builders and queries. What is asserted here is the frame that
 * holds them together: the jump links resolve to real section ids, every
 * section is a distinctly named region, and a loading section keeps its id so
 * a jump link followed early still lands.
 */

const APPOINTMENT_ID = "11111111-1111-4111-8111-111111111111";

describe("appointmentWorkspaceHref", () => {
  it("links to the appointment, or to one section of it", () => {
    expect(appointmentWorkspaceHref(APPOINTMENT_ID)).toBe(
      `/doctor/appointments/${APPOINTMENT_ID}`,
    );
    expect(appointmentWorkspaceHref(APPOINTMENT_ID, "prescription")).toBe(
      `/doctor/appointments/${APPOINTMENT_ID}#prescription`,
    );
    expect(appointmentWorkspaceHref(APPOINTMENT_ID, "treatmentPlan")).toBe(
      `/doctor/appointments/${APPOINTMENT_ID}#treatment-plan`,
    );
  });

  it("cannot be steered out of the appointment path by the id", () => {
    expect(appointmentWorkspaceHref("../patients/x")).toBe(
      "/doctor/appointments/..%2Fpatients%2Fx",
    );
  });
});

describe("WorkspaceNav", () => {
  it("is a labelled list of fragment links, one per section given", () => {
    render(
      <WorkspaceNav sections={["overview", "consultation", "prescription"]} />,
    );

    const nav = screen.getByRole("navigation", {
      name: DOCTOR_WORKSPACE_COPY.jumpNavLabel,
    });
    const links = within(nav).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#overview",
      "#consultation",
      "#prescription",
    ]);
    expect(links[1]).toHaveTextContent(
      DOCTOR_WORKSPACE_COPY.sections.consultation,
    );
  });

  it("names every section it can link to", () => {
    for (const section of Object.keys(WORKSPACE_SECTIONS)) {
      expect(
        DOCTOR_WORKSPACE_COPY.sections[
          section as keyof typeof DOCTOR_WORKSPACE_COPY.sections
        ],
      ).toBeTruthy();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <WorkspaceNav sections={["overview", "consultation", "ai"]} />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("WorkspaceSection", () => {
  it("is a region named by its heading, at the id the jump link targets", () => {
    const { container } = render(
      <WorkspaceSection
        id={WORKSPACE_SECTIONS.prescription}
        title="Prescription"
      >
        <p>Body</p>
      </WorkspaceSection>,
    );

    const region = screen.getByRole("region", { name: "Prescription" });
    expect(region).toHaveAttribute("id", "prescription");
    expect(
      within(region).getByRole("heading", { level: 2, name: "Prescription" }),
    ).toBeInTheDocument();
    expect(container.querySelector("#prescription")).toBe(region);
  });

  it("gives every section a distinct landmark name", async () => {
    // Two regions sharing a name is axe's `landmark-unique` — the defect Phase
    // 11 found on three doctor pages.
    const { container } = render(
      <main>
        {(
          [
            "consultation",
            "prescription",
            "treatmentPlan",
            "documents",
            "ai",
          ] as const
        ).map((section) => (
          <WorkspaceSection
            key={section}
            id={WORKSPACE_SECTIONS[section]}
            title={DOCTOR_WORKSPACE_COPY.sections[section]}
          >
            <p>Body</p>
          </WorkspaceSection>
        ))}
      </main>,
    );

    await expectNoAxeViolations(container);
  });

  it("keeps its id and heading while loading, and announces it", () => {
    render(
      <WorkspaceSectionFallback
        id={WORKSPACE_SECTIONS.documents}
        title={DOCTOR_WORKSPACE_COPY.sections.documents}
      />,
    );

    const region = screen.getByRole("region", { name: "Documents" });
    expect(region).toHaveAttribute("id", "documents");
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Loading documents",
    );
  });
});

describe("WaitingNotice", () => {
  it("says what is missing and offers the way to it", () => {
    render(
      <WaitingNotice action={<a href="#consultation">Go to notes</a>}>
        {DOCTOR_WORKSPACE_COPY.prescriptionWaiting}
      </WaitingNotice>,
    );

    expect(
      screen.getByText(DOCTOR_WORKSPACE_COPY.prescriptionWaiting),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to notes" })).toHaveAttribute(
      "href",
      "#consultation",
    );
  });
});
