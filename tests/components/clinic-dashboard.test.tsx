import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AppointmentsOverviewCard,
  BusiestPractitionersCard,
  ClinicalActivityCard,
  NotificationsCard,
} from "@/components/analytics/dashboard/clinic-dashboard";
import { initialsOf } from "@/components/analytics/dashboard/dashboard-card";
import { ClinicHeadlineFigures } from "@/components/analytics/dashboard/headline-figures";
import { KpiCard } from "@/components/analytics/dashboard/kpi-card";
import {
  StackedBarChart,
  niceScale,
} from "@/components/analytics/dashboard/stacked-bar-chart";
import { appointmentRates, utilization } from "@/features/analytics/metrics";
import type {
  AnalyticsRange,
  AnalyticsResult,
  AppointmentCounts,
  ClinicAnalytics,
  PractitionerWorkload,
  TrendPoint,
} from "@/features/analytics/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The redesigned clinic dashboard.
 *
 * The same guarantees the original panels carry, asserted on the new
 * surface: a chart is never the only way to read a figure, zero and missing
 * stay different, a comparison is never invented, and nothing identifies a
 * patient.
 */

const RANGE: AnalyticsRange = {
  from: "2026-09-01",
  to: "2026-09-30",
  spanDays: 30,
  granularity: "day",
  preset: "this_month",
};

const COUNTS: AppointmentCounts = {
  total: 10,
  requested: 1,
  confirmed: 0,
  checkedIn: 0,
  inConsultation: 0,
  completed: 6,
  cancelled: 2,
  noShow: 1,
  eligible: 9,
};

const TREND: readonly TrendPoint[] = [
  {
    bucketStart: "2026-09-01",
    total: 4,
    completed: 3,
    cancelled: 1,
    noShow: 0,
  },
  {
    bucketStart: "2026-09-02",
    total: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  },
  {
    bucketStart: "2026-09-03",
    total: 6,
    completed: 3,
    cancelled: 1,
    noShow: 1,
  },
];

const HREF = "/admin/analytics?preset=custom&from=2026-09-01&to=2026-09-30";

function ready<T>(data: T): AnalyticsResult<T> {
  return { status: "ready", data };
}

function workloadRow(
  overrides: Partial<PractitionerWorkload> = {},
): PractitionerWorkload {
  return {
    practitionerId: "p1",
    displayName: "Dr. Meera Sharma",
    isActive: true,
    ...COUNTS,
    ...utilization(180, 480),
    rates: appointmentRates(COUNTS),
    ...overrides,
  };
}

function analytics(overrides: Partial<ClinicAnalytics> = {}): ClinicAnalytics {
  return {
    range: RANGE,
    generatedAt: "2026-09-30T06:00:00.000Z",
    appointments: ready(COUNTS),
    trend: ready(TREND),
    workload: ready([workloadRow()]),
    patients: ready({
      newPatients: 12,
      returningPatients: 30,
      activePatients: 40,
      totalPatients: 400,
    }),
    growth: ready([
      { bucketStart: "2026-09-01", newPatients: 5 },
      { bucketStart: "2026-09-02", newPatients: 7 },
    ]),
    ...overrides,
  };
}

describe("niceScale", () => {
  it("rounds the top of the axis up to a whole, round number", () => {
    expect(niceScale(83)).toBe(100);
    expect(niceScale(6)).toBe(8);
    expect(niceScale(248)).toBe(320);
    expect(niceScale(31)).toBe(32);
  });

  it("never draws gridlines between whole counts", () => {
    expect(niceScale(1)).toBe(4);
    expect(niceScale(0)).toBe(4);
  });
});

describe("initialsOf", () => {
  it("drops an honorific and takes the first and last names", () => {
    expect(initialsOf("Dr. Meera Sharma")).toBe("MS");
    expect(initialsOf("Vaidya Rohan K Iyer")).toBe("RI");
    expect(initialsOf("Asha")).toBe("A");
  });
});

describe("the stacked bar chart", () => {
  const series = [
    { key: "a", label: "Completed", swatchClass: "bg-chart-1" },
    { key: "b", label: "Cancelled", swatchClass: "bg-chart-3" },
  ];
  const buckets = [
    { key: "1", label: "1 Sep", values: [3, 1] },
    { key: "2", label: "2 Sep", values: [0, 0] },
    { key: "3", label: "3 Sep", values: [5, 2] },
  ];

  it("hides the drawing and states the shape in words", () => {
    const { container } = render(
      <StackedBarChart
        series={series}
        buckets={buckets}
        caption="Appointments by day"
        summaryNoun="appointments"
      />,
    );

    expect(
      screen.getByText(
        "11 appointments between 1 Sep and 3 Sep. Busiest: 3 Sep, 7.",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("always renders the exact table, with a total per bucket", () => {
    render(
      <StackedBarChart
        series={series}
        buckets={buckets}
        caption="Appointments by day"
        summaryNoun="appointments"
      />,
    );

    const table = screen.getByRole("table", { name: "Appointments by day" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(
      within(rows[3]!)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["3 Sep", "5", "2", "7"]);
  });

  it("names every series in a text legend", async () => {
    const { container } = render(
      <StackedBarChart
        series={series}
        buckets={buckets}
        caption="Appointments by day"
        summaryNoun="appointments"
      />,
    );

    const legend = screen.getByRole("list", { name: /outcomes shown/i });
    expect(legend.textContent).toContain("Completed8");
    expect(legend.textContent).toContain("Cancelled3");
    await expectNoAxeViolations(container);
  });
});

describe("a headline card", () => {
  it("states a rise with its basis, and says up for a screen reader", () => {
    render(
      <dl>
        <KpiCard
          label="Appointments"
          value="248"
          icon={<span />}
          comparison={{ direction: "up", magnitude: "12.5%", tone: "positive" }}
          comparisonBasis="vs. previous 30 days"
        />
      </dl>,
    );

    const value = screen.getByText("248").closest("dd");
    expect(value?.textContent).toContain("Up 12.5%");
    expect(value?.textContent).toContain("vs. previous 30 days");
  });

  it("says there is nothing to compare rather than drawing a flat arrow", () => {
    render(
      <dl>
        <KpiCard
          label="New patients"
          value="3"
          icon={<span />}
          comparison={null}
          comparisonBasis="vs. previous 30 days"
        />
      </dl>,
    );

    expect(
      screen.getByText(/no comparison with the previous period/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no change/i)).toBeNull();
  });
});

describe("the headline figures", () => {
  it("compares against the earlier period when both reads succeeded", async () => {
    const { container } = render(
      <ClinicHeadlineFigures
        headingId="h"
        analytics={analytics()}
        comparison={{
          range: { ...RANGE, from: "2026-08-02", to: "2026-08-31" },
          appointments: ready({ ...COUNTS, total: 8 }),
          patients: ready({
            newPatients: 12,
            returningPatients: 0,
            activePatients: 0,
            totalPatients: 0,
          }),
        }}
      />,
    );

    const appointments = screen.getByText("Appointments").closest("div");
    expect(appointments?.textContent).toContain("Up 25.0%");
    const patients = screen.getByText("New patients").closest("div");
    expect(patients?.textContent).toContain("No change");
    await expectNoAxeViolations(container);
  });

  it("renders a failed read as unavailable, never as zero", () => {
    render(
      <ClinicHeadlineFigures
        headingId="h"
        analytics={analytics({ appointments: { status: "unavailable" } })}
        comparison={null}
      />,
    );

    const card = screen.getByText("Appointments").closest("div");
    expect(card?.textContent).toContain("—");
    expect(card?.textContent).toContain("Data unavailable");
    expect(card?.textContent).not.toMatch(/\b0\b/);
  });

  it("shows no cancellation rate when nothing concluded", () => {
    render(
      <ClinicHeadlineFigures
        headingId="h"
        analytics={analytics({
          appointments: ready({
            ...COUNTS,
            completed: 0,
            cancelled: 0,
            noShow: 0,
            eligible: 0,
            total: 1,
          }),
        })}
        comparison={null}
      />,
    );

    const card = screen.getByText("Cancellation rate").closest("div");
    expect(card?.textContent).toContain("No concluded appointments");
    expect(card?.textContent).not.toContain("0.0%");
  });
});

describe("the dashboard panels", () => {
  it("splits the overview into its four outcomes and keeps the denominator note", () => {
    render(
      <AppointmentsOverviewCard
        titleId="o"
        counts={ready(COUNTS)}
        trend={ready(TREND)}
        granularity="day"
        retryHref={HREF}
      />,
    );

    const table = screen.getByRole("table");
    // 1 Sep: 3 completed, 0 scheduled, 1 cancelled, 0 no-show, 4 total.
    const firstRow = within(table).getAllByRole("row")[1]!;
    expect(
      within(firstRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["1 Sep", "3", "0", "1", "0", "4"]);
    expect(
      screen.getByText(/shares of concluded appointments/i),
    ).toBeInTheDocument();
  });

  it("offers a retry when the trend could not be read", () => {
    render(
      <AppointmentsOverviewCard
        titleId="o"
        counts={ready(COUNTS)}
        trend={{ status: "unavailable" }}
        granularity="day"
        retryHref={HREF}
      />,
    );

    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      HREF,
    );
  });

  it("ranks practitioners by volume and renders markup in a name as text", () => {
    render(
      <BusiestPractitionersCard
        titleId="b"
        workload={ready([
          workloadRow({
            practitionerId: "a",
            displayName: "Dr. Quiet",
            total: 2,
          }),
          workloadRow({
            practitionerId: "b",
            displayName: "<img src=x onerror=alert(1)>",
            total: 9,
          }),
        ])}
        tableAnchor="w"
        retryHref={HREF}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(items[1]?.textContent).toContain("Dr. Quiet");
    expect(document.querySelector("img")).toBeNull();
  });

  it("keeps the acceptance-rate caveat beside the sending figures", () => {
    render(
      <NotificationsCard
        titleId="n"
        deliveries={ready([
          {
            channel: "email",
            provider: "resend",
            pending: 1,
            sent: 9,
            failed: 1,
            skipped: 0,
            acceptanceRate: 0.9,
          },
        ])}
        volume={ready([])}
        retryHref={HREF}
      />,
    );

    expect(screen.getByText("90.0%")).toBeInTheDocument();
    expect(
      screen.getByText(/not confirmation that it reached/i),
    ).toBeInTheDocument();
  });

  it("states that clinical activity carries no clinical content", () => {
    render(
      <ClinicalActivityCard
        titleId="c"
        activity={ready({
          prescriptionsIssued: 4,
          treatmentPlansActivated: 2,
          consultationsDocumented: 6,
          documentsUploaded: 3,
        })}
        documentTypes={ready([{ documentType: "lab_report", uploaded: 3 }])}
        retryHref={HREF}
      />,
    );

    expect(screen.getByText("Lab report")).toBeInTheDocument();
    expect(
      screen.getByText(/does not report on diagnoses/i),
    ).toBeInTheDocument();
  });
});
