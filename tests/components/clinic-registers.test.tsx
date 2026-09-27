import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AppointmentRegisterCard,
  PatientRegisterCard,
  RecentActivityCard,
} from "@/components/analytics/dashboard/registers";
import type {
  AppointmentRegisterRow,
  PatientRegisterRow,
  RegisterPage,
  RegisterResult,
} from "@/features/clinic-registers/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The clinic registers on the dashboard.
 *
 * Asserted: the audit sentence is always on the page beside the names; paging
 * is plain links carrying the page number and nothing about anybody; a page
 * past the end, a failed read and a refused read each render their own
 * state; and markup in a name renders as text.
 */

const HREF = "/admin/analytics?preset=custom&from=2026-09-01&to=2026-09-30";
const hrefFor = (page: number) => `${HREF}&appointmentsPage=${page}#r`;

function ready<T>(data: T): RegisterResult<T> {
  return { status: "ready", data };
}

function appointment(
  overrides: Partial<AppointmentRegisterRow> = {},
): AppointmentRegisterRow {
  return {
    appointmentId: "a1",
    startsAt: "2026-09-30T05:00:00.000Z",
    status: "completed",
    patientId: "p1",
    patientName: "Ananya Sharma",
    practitionerName: "Dr. Meera Sharma",
    appointmentTypeName: "Consultation",
    ...overrides,
  };
}

function page<Row>(
  rows: readonly Row[],
  overrides: Partial<RegisterPage<Row>> = {},
): RegisterPage<Row> {
  return { rows, total: rows.length, page: 1, pageSize: 8, ...overrides };
}

describe("the appointment register", () => {
  it("lists the appointment with a status in words and the audit note", async () => {
    const { container } = render(
      <AppointmentRegisterCard
        titleId="ar"
        register={ready(page([appointment()]))}
        hrefFor={hrefFor}
        retryHref={HREF}
      />,
    );

    const table = screen.getByRole("table", {
      name: /appointments in the period/i,
    });
    const row = within(table).getAllByRole("row")[1]!;
    expect(row.textContent).toContain("Ananya Sharma");
    expect(row.textContent).toContain("Dr. Meera Sharma");
    expect(row.textContent).toContain("Consultation");
    expect(row.textContent).toContain("Completed");
    expect(
      screen.getByText(/recorded in the security audit trail/i),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("pages with links that carry only the page number", () => {
    render(
      <AppointmentRegisterCard
        titleId="ar"
        register={ready(
          page([appointment()], { total: 40, page: 2, pageSize: 8 }),
        )}
        hrefFor={hrefFor}
        retryHref={HREF}
      />,
    );

    expect(screen.getByText("Showing 9–16 of 40")).toBeInTheDocument();
    const current = screen.getByRole("link", { name: "Page 2" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      hrefFor(3),
    );
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      hrefFor(1),
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/Ananya|p1|a1/);
    }
  });

  it("says a page past the end is empty, with the way back", () => {
    render(
      <AppointmentRegisterCard
        titleId="ar"
        register={ready(page([], { total: 0, page: 9 }))}
        hrefFor={hrefFor}
        retryHref={HREF}
      />,
    );

    expect(screen.getByText(/no rows on this page/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /first page/i })).toHaveAttribute(
      "href",
      hrefFor(1),
    );
  });

  it("offers a retry when the register could not be read", () => {
    render(
      <AppointmentRegisterCard
        titleId="ar"
        register={{ status: "unavailable" }}
        hrefFor={hrefFor}
        retryHref={HREF}
      />,
    );
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      HREF,
    );
  });

  it("renders markup in a patient's name as text", () => {
    render(
      <AppointmentRegisterCard
        titleId="ar"
        register={ready(
          page([appointment({ patientName: "<img src=x onerror=alert(1)>" })]),
        )}
        hrefFor={hrefFor}
        retryHref={HREF}
      />,
    );
    expect(document.querySelector("img")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
  });
});

describe("the patient register", () => {
  const patient: PatientRegisterRow = {
    patientId: "p1",
    patientName: "Rohit Verma",
    registeredAt: "2026-09-10T05:00:00.000Z",
    isNew: true,
    appointmentsInPeriod: 2,
    completedInPeriod: 1,
    lastVisitAt: null,
  };

  it("marks a new patient in words and says when there has been no visit", () => {
    render(
      <PatientRegisterCard
        titleId="pr"
        register={ready(page([patient], { pageSize: 6 }))}
        hrefFor={hrefFor}
        retryHref={HREF}
      />,
    );

    const row = within(screen.getByRole("table")).getAllByRole("row")[1]!;
    expect(row.textContent).toContain("Rohit Verma");
    expect(row.textContent).toContain("New");
    expect(row.textContent).toContain("No visit yet");
  });

  it("renders nothing for a refused read", () => {
    const { container } = render(
      <PatientRegisterCard
        titleId="pr"
        register={{ status: "forbidden" }}
        hrefFor={hrefFor}
        retryHref={HREF}
      />,
    );
    expect(container.querySelector("table")).toBeNull();
  });
});

describe("recent activity", () => {
  it("describes each event in words, with the patient and practitioner", async () => {
    const { container } = render(
      <RecentActivityCard
        titleId="ra"
        activity={ready([
          {
            occurredAt: "2026-09-30T05:12:00.000Z",
            kind: "status_changed",
            status: "cancelled",
            patientId: "p1",
            patientName: "Suresh Kumar",
            practitionerName: "Dr. Vikram Patel",
          },
          {
            occurredAt: "2026-09-29T05:12:00.000Z",
            kind: "patient_registered",
            status: null,
            patientId: "p2",
            patientName: "Neha Kapoor",
            practitionerName: null,
          },
        ])}
        retryHref={HREF}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("Appointment updated");
    expect(items[0]?.textContent).toContain("Cancelled");
    expect(items[0]?.textContent).toContain(
      "Suresh Kumar with Dr. Vikram Patel",
    );
    expect(items[1]?.textContent).toContain("New patient registered");
    expect(items[1]?.textContent).not.toContain(" with ");
    await expectNoAxeViolations(container);
  });

  it("says so when nothing happened", () => {
    render(
      <RecentActivityCard titleId="ra" activity={ready([])} retryHref={HREF} />,
    );
    expect(screen.getByText("No recent activity")).toBeInTheDocument();
  });
});
