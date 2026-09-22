import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AttentionPanel } from "@/components/patient/attention-panel";
import { CareSummary } from "@/components/patient/care-summary";
import { DashboardPanel } from "@/components/patient/dashboard-panel";
import { NextVisitCard } from "@/components/patient/next-visit-card";
import { RecentUpdates } from "@/components/patient/recent-updates";
import { APPOINTMENT_COPY } from "@/features/appointments/content";
import type { PatientAppointment } from "@/features/appointments/types";
import type { Notification } from "@/features/notifications/types";
import { deriveAttentionItems } from "@/features/patients/attention";
import { evaluateCompleteness } from "@/features/patients/completeness";
import { PATIENT_DASHBOARD } from "@/features/patients/content";
import type { PrescriptionSummary } from "@/features/prescriptions/types";
import type { TreatmentPlanSummary } from "@/features/treatment-plans/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The patient dashboard (Phase 18).
 *
 * What is asserted, and why each one matters more than it looks:
 *
 *   * **"nothing" and "we could not read it" are different screens.** Telling a
 *     patient they have no prescription because a query failed is a clinically
 *     misleading claim (`phase_18.md` section 72);
 *   * **no clinical content leaks into a summary.** The dashboard is read on a
 *     phone in a waiting room, and section 4 scopes what a patient may see;
 *   * **no identifier is rendered.** Not a patient id, not a storage path, not
 *     a practitioner id (sections 33, 142);
 *   * **unread is a word, not a colour** (WCAG 1.4.1);
 *   * **markup in stored text is displayed, not executed**;
 *   * **every panel is a named landmark with an `h2`**, so the outline a
 *     screen-reader user navigates by has no gaps.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/patient",
}));

const NOW = new Date("2026-10-01T09:00:00.000Z");

function appointment(
  overrides: Partial<PatientAppointment> = {},
): PatientAppointment {
  return {
    id: "appointment-1",
    startsAt: new Date("2026-10-05T09:00:00.000Z"),
    endsAt: new Date("2026-10-05T09:30:00.000Z"),
    status: "confirmed",
    practitionerId: "practitioner-uuid-1",
    practitionerName: "Test Doctor",
    appointmentTypeId: "type-uuid-1",
    typeName: "Follow-up consultation",
    durationMinutes: 30,
    patientNote: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

const PRESCRIPTION: PrescriptionSummary = {
  id: "prescription-uuid-1",
  appointmentId: "appointment-uuid-1",
  status: "issued",
  itemCount: 2,
  issuedAt: new Date("2026-09-20T06:00:00.000Z"),
  cancelledAt: null,
  createdAt: new Date("2026-09-20T05:00:00.000Z"),
  updatedAt: new Date("2026-09-20T06:00:00.000Z"),
  practitionerName: "Test Doctor",
};

const PLAN: TreatmentPlanSummary = {
  id: "plan-uuid-1",
  appointmentId: "appointment-uuid-1",
  status: "active",
  title: "Digestive care plan",
  itemCount: 4,
  followUpOn: "2026-11-01",
  activatedAt: new Date("2026-09-20T06:30:00.000Z"),
  createdAt: new Date("2026-09-20T05:00:00.000Z"),
  practitionerName: "Test Doctor",
};

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notification-uuid-1",
    eventType: "appointment_confirmed",
    category: "appointment_updates",
    title: "Your appointment is confirmed",
    body: "Your follow-up consultation is confirmed for 5 October at 2:30 pm.",
    templateVersion: 1,
    resourceType: "appointment",
    resourceId: "appointment-uuid-1",
    linkPath: "/patient/appointments/appointment-uuid-1",
    readAt: null,
    createdAt: "2026-09-25T06:00:00.000Z",
    ...overrides,
  };
}

/** Identifiers that must never be rendered on a dashboard. */
const IDENTIFIER_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}|uuid|practitioner-|type-/i;

describe("NextVisitCard", () => {
  it("shows the appointment, its type and its practitioner", () => {
    render(
      <NextVisitCard
        result={{ status: "found", appointment: appointment() }}
        now={NOW}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: PATIENT_DASHBOARD.nextVisit.heading,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Follow-up consultation with Test Doctor/),
    ).toBeInTheDocument();
  });

  it("links to that appointment", () => {
    render(
      <NextVisitCard
        result={{ status: "found", appointment: appointment({ id: "abc-1" }) }}
        now={NOW}
      />,
    );

    expect(
      screen.getByRole("link", { name: PATIENT_DASHBOARD.nextVisit.viewLabel }),
    ).toHaveAttribute("href", "/patient/appointments/abc-1");
  });

  it("carries a machine-readable instant alongside the formatted date", () => {
    const { container } = render(
      <NextVisitCard
        result={{ status: "found", appointment: appointment() }}
        now={NOW}
      />,
    );

    expect(container.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2026-10-05T09:00:00.000Z",
    );
  });

  it("mentions that a nearby appointment is coming up", () => {
    render(
      <NextVisitCard
        result={{
          status: "found",
          appointment: appointment({
            startsAt: new Date("2026-10-02T09:00:00.000Z"),
            endsAt: new Date("2026-10-02T09:30:00.000Z"),
          }),
        }}
        now={NOW}
      />,
    );

    expect(
      screen.getByText(PATIENT_DASHBOARD.nextVisit.imminentNote),
    ).toBeInTheDocument();
  });

  it("does not for one that is weeks away", () => {
    render(
      <NextVisitCard
        result={{ status: "found", appointment: appointment() }}
        now={NOW}
      />,
    );

    expect(
      screen.queryByText(PATIENT_DASHBOARD.nextVisit.imminentNote),
    ).not.toBeInTheDocument();
  });

  it("offers booking when there is no upcoming appointment", () => {
    render(<NextVisitCard result={{ status: "not_found" }} now={NOW} />);

    expect(
      screen.getByText(PATIENT_DASHBOARD.nextVisit.emptyTitle),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: APPOINTMENT_COPY.bookLabel }),
    ).toHaveAttribute("href", "/patient/appointments/book");
  });

  it("distinguishes a failed read from having none", () => {
    // The distinction this project has carried since Phase 07. A patient told
    // they have no appointment during an outage books a second one.
    render(<NextVisitCard result={{ status: "unavailable" }} now={NOW} />);

    expect(
      screen.getByText(PATIENT_DASHBOARD.nextVisit.errorTitle),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(PATIENT_DASHBOARD.nextVisit.emptyTitle),
    ).not.toBeInTheDocument();
  });

  it("says the rest of the page is still current when it fails", () => {
    render(<NextVisitCard result={{ status: "unavailable" }} now={NOW} />);

    expect(screen.getByText(/still up to date/i)).toBeInTheDocument();
  });

  it("renders no identifier", () => {
    const { container } = render(
      <NextVisitCard
        result={{ status: "found", appointment: appointment() }}
        now={NOW}
      />,
    );

    // The appointment id is legitimately in the link's href; nothing else may
    // carry an identifier into the visible text.
    expect(container.textContent ?? "").not.toMatch(IDENTIFIER_PATTERN);
  });

  it("renders no internal note or clinical field", () => {
    const { container } = render(
      <NextVisitCard
        result={{ status: "found", appointment: appointment() }}
        now={NOW}
      />,
    );

    expect(container.textContent ?? "").not.toMatch(
      /internal|diagnos|symptom|assessment/i,
    );
  });

  /**
   * Each state is swept on its own, not all three together.
   *
   * The panel is a landmark named by its heading, and three of them in one
   * container share one accessible name — which axe correctly reports as
   * `landmark-unique`. That is a property of rendering three copies of the
   * same panel, not of the page, where the five panel headings are distinct.
   * Sweeping them separately asks the question the page actually poses.
   */
  it.each([
    ["found", { status: "found" as const, appointment: appointment() }],
    ["empty", { status: "not_found" as const }],
    ["unavailable", { status: "unavailable" as const }],
  ])("has no axe violations when %s", async (_label, result) => {
    const { container } = render(<NextVisitCard result={result} now={NOW} />);
    await expectNoAxeViolations(container);
  });
});

describe("AttentionPanel", () => {
  const items = deriveAttentionItems({
    completeness: evaluateCompleteness(null),
    nextAppointment: appointment({ status: "requested" }),
    unreadNotifications: 2,
  });

  it("renders one list item per thing needing attention", () => {
    render(<AttentionPanel items={items} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(items.length);
  });

  it("gives every item a link a patient can follow", () => {
    render(<AttentionPanel items={items} />);

    for (const item of items) {
      expect(screen.getByRole("link", { name: item.title })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  it("says so calmly when nothing needs attention", () => {
    // Section 62: no invented task to fill the space.
    render(<AttentionPanel items={[]} />);

    expect(
      screen.getByText(PATIENT_DASHBOARD.attention.emptyTitle),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("distinguishes information from action by words, not colour alone", () => {
    render(<AttentionPanel items={items} />);

    // The informational item says there is nothing to do, in text.
    expect(screen.getByText(/nothing you need to do/i)).toBeInTheDocument();
  });

  it("has no axe violations, populated or empty", async () => {
    const { container } = render(
      <>
        <AttentionPanel items={items} />
        <AttentionPanel items={[]} />
      </>,
    );

    await expectNoAxeViolations(container);
  });
});

describe("CareSummary", () => {
  it("links to each of the three care destinations", () => {
    render(
      <CareSummary
        prescriptions={{ status: "found", prescriptions: [PRESCRIPTION] }}
        treatmentPlans={{ status: "found", plans: [PLAN] }}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: PATIENT_DASHBOARD.care.prescriptionsLabel,
      }),
    ).toHaveAttribute("href", "/patient/prescriptions");
    expect(
      screen.getByRole("link", {
        name: PATIENT_DASHBOARD.care.treatmentPlansLabel,
      }),
    ).toHaveAttribute("href", "/patient/treatment-plans");
    expect(
      screen.getByRole("link", { name: PATIENT_DASHBOARD.care.documentsLabel }),
    ).toHaveAttribute("href", "/patient/documents");
  });

  it("shows when the latest prescription was issued", () => {
    render(
      <CareSummary
        prescriptions={{ status: "found", prescriptions: [PRESCRIPTION] }}
        treatmentPlans={{ status: "found", plans: [] }}
      />,
    );

    expect(screen.getByText(/^Issued /)).toBeInTheDocument();
  });

  it("never shows a medicine, a dose or a plan's contents", () => {
    // The whole reason the dashboard queries ask for one row and show a date:
    // a glance is read over shoulders, the detail is one deliberate tap away.
    const { container } = render(
      <CareSummary
        prescriptions={{ status: "found", prescriptions: [PRESCRIPTION] }}
        treatmentPlans={{ status: "found", plans: [PLAN] }}
      />,
    );

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/ashwagandha|triphala|\d+\s?mg|teaspoon/i);
    // Not even the plan's own title, which a clinician wrote about one patient.
    expect(text).not.toMatch(/Digestive care plan/);
  });

  it("says what a patient will not find here, rather than leaving a gap", () => {
    render(
      <DashboardPanel
        heading={PATIENT_DASHBOARD.care.heading}
        headingId="care"
        description={PATIENT_DASHBOARD.care.description}
      >
        <CareSummary
          prescriptions={{ status: "found", prescriptions: [] }}
          treatmentPlans={{ status: "found", plans: [] }}
        />
      </DashboardPanel>,
    );

    expect(
      screen.getByText(/consultation notes stay with the clinic/i),
    ).toBeInTheDocument();
  });

  it("distinguishes 'nothing yet' from 'could not read'", () => {
    const { rerender } = render(
      <CareSummary
        prescriptions={{ status: "found", prescriptions: [] }}
        treatmentPlans={{ status: "found", plans: [] }}
      />,
    );
    expect(
      screen.getByText(PATIENT_DASHBOARD.care.prescriptionsEmpty),
    ).toBeInTheDocument();

    rerender(
      <CareSummary
        prescriptions={{ status: "unavailable" }}
        treatmentPlans={{ status: "unavailable" }}
      />,
    );
    expect(
      screen.queryByText(PATIENT_DASHBOARD.care.prescriptionsEmpty),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(PATIENT_DASHBOARD.care.errorBody).length,
    ).toBeGreaterThan(0);
  });

  it("renders no identifier", () => {
    const { container } = render(
      <CareSummary
        prescriptions={{ status: "found", prescriptions: [PRESCRIPTION] }}
        treatmentPlans={{ status: "found", plans: [PLAN] }}
      />,
    );

    expect(container.textContent ?? "").not.toMatch(IDENTIFIER_PATTERN);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <CareSummary
        prescriptions={{ status: "found", prescriptions: [PRESCRIPTION] }}
        treatmentPlans={{ status: "found", plans: [PLAN] }}
      />,
    );

    await expectNoAxeViolations(container);
  });
});

describe("RecentUpdates", () => {
  it("lists the notifications it is given", () => {
    render(
      <RecentUpdates
        result={{ status: "ok", notifications: [notification()] }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Your appointment is confirmed" }),
    ).toHaveAttribute("href", "/patient/appointments/appointment-uuid-1");
  });

  it("marks unread with a word, not only a tint", () => {
    render(
      <RecentUpdates
        result={{ status: "ok", notifications: [notification()] }}
      />,
    );

    expect(screen.getByText("Unread")).toBeInTheDocument();
  });

  it("does not mark a read notification unread", () => {
    render(
      <RecentUpdates
        result={{
          status: "ok",
          notifications: [notification({ readAt: "2026-09-26T06:00:00.000Z" })],
        }}
      />,
    );

    expect(screen.queryByText("Unread")).not.toBeInTheDocument();
  });

  it("offers no way to manage notifications — that is the centre's job", () => {
    render(
      <RecentUpdates
        result={{ status: "ok", notifications: [notification()] }}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says so when there is nothing", () => {
    render(<RecentUpdates result={{ status: "ok", notifications: [] }} />);

    expect(
      screen.getByText(PATIENT_DASHBOARD.updates.emptyTitle),
    ).toBeInTheDocument();
  });

  it("distinguishes a failed read from an empty one", () => {
    render(<RecentUpdates result={{ status: "unavailable" }} />);

    expect(
      screen.getByText(PATIENT_DASHBOARD.updates.errorBody),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(PATIENT_DASHBOARD.updates.emptyTitle),
    ).not.toBeInTheDocument();
  });

  it("renders markup in a stored title as text", () => {
    const { container } = render(
      <RecentUpdates
        result={{
          status: "ok",
          notifications: [
            notification({ title: "<img src=x onerror=alert(1)>" }),
          ],
        }}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
  });

  it("exposes no internal error text when a read fails", () => {
    const { container } = render(
      <RecentUpdates result={{ status: "unavailable" }} />,
    );

    expect(container.textContent ?? "").not.toMatch(
      /supabase|postgres|relation|policy|row-level/i,
    );
  });

  it("has no axe violations in all three states", async () => {
    const { container } = render(
      <>
        <RecentUpdates
          result={{ status: "ok", notifications: [notification()] }}
        />
        <RecentUpdates result={{ status: "ok", notifications: [] }} />
        <RecentUpdates result={{ status: "unavailable" }} />
      </>,
    );

    await expectNoAxeViolations(container);
  });
});

describe("DashboardPanel", () => {
  it("names its region with its own heading", () => {
    render(
      <DashboardPanel heading="Your care" headingId="care-heading">
        <p>Content</p>
      </DashboardPanel>,
    );

    const region = screen.getByRole("region", { name: "Your care" });
    expect(
      within(region).getByRole("heading", { level: 2, name: "Your care" }),
    ).toBeInTheDocument();
  });

  it("always uses h2, so the page outline cannot gain a gap", () => {
    render(
      <DashboardPanel heading="A panel" headingId="a-panel">
        <p>Content</p>
      </DashboardPanel>,
    );

    expect(screen.getByRole("heading", { name: "A panel" }).tagName).toBe("H2");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <DashboardPanel
        heading="Recent updates"
        headingId="updates"
        description="What has happened lately."
        action={<a href="/notifications">All notifications</a>}
      >
        <p>Content</p>
      </DashboardPanel>,
    );

    await expectNoAxeViolations(container);
  });
});
