import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import {
  AnalyticsTable,
  ProportionCell,
} from "@/components/analytics/analytics-table";
import {
  AppointmentSummaryPanel,
  AppointmentTrendPanel,
  PractitionerWorkloadPanel,
  UtilizationSummary,
} from "@/components/analytics/appointment-panels";
import {
  ClinicalActivityPanel,
  NotificationPanel,
  PatientGrowthPanel,
} from "@/components/analytics/clinic-panels";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { AppointmentReportExport } from "@/components/analytics/export-form";
import { MetricList } from "@/components/analytics/metric-card";
import { MetricDefinitions } from "@/components/analytics/metric-definitions";
import { TrendChart } from "@/components/analytics/trend-chart";
import { formatBucketLabel } from "@/features/analytics/format";
import type {
  AnalyticsRange,
  AnalyticsResult,
  AppointmentCounts,
  PractitionerWorkload,
  TrendPoint,
} from "@/features/analytics/types";
import { appointmentRates, utilization } from "@/features/analytics/metrics";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The analytics UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * **a chart is never the only way to read a figure.** The table is always
 *     rendered, the summary sentence states the shape in words, and the SVG
 *     is `aria-hidden` so a screen reader is not read the same numbers twice
 *     (`phase_16.md` sections 66 and 70);
 *   * **zero and missing are told apart**, everywhere. A rate with no
 *     denominator renders words, never `0.0%`, and an empty period renders a
 *     sentence rather than a row of zeroes with no explanation (section 96,
 *     example 7);
 *   * a failed panel renders a retry and a **refused** one renders nothing,
 *     so one panel failing does not block the dashboard (sections 63 and 65);
 *   * **nothing clinical and nothing identifying appears**, and the notice
 *     that says so is on the page rather than in a comment (sections 3, 36,
 *     104);
 *   * the acceptance-rate figure carries the sentence that stops it being
 *     read as a delivery rate (section 41);
 *   * each form renders exactly one `<form>` carrying exactly the fields its
 *     endpoint reads — the regression guard for the class of defect Phase 07
 *     shipped, where a nested form put a patient's details in the URL;
 *   * markup in a practitioner's name renders as text.
 */

const RANGE: AnalyticsRange = {
  from: "2026-09-01",
  to: "2026-09-30",
  spanDays: 30,
  granularity: "day",
  preset: "this_month",
};

/** `phase_16.md` section 98's fixture. */
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

const EMPTY_COUNTS: AppointmentCounts = {
  total: 0,
  requested: 0,
  confirmed: 0,
  checkedIn: 0,
  inConsultation: 0,
  completed: 0,
  cancelled: 0,
  noShow: 0,
  eligible: 0,
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

function workloadRow(
  overrides: Partial<PractitionerWorkload> = {},
): PractitionerWorkload {
  const time = utilization(180, 480);
  return {
    practitionerId: "22222222-2222-4222-8222-222222222222",
    displayName: "Dr Example",
    isActive: true,
    ...COUNTS,
    ...time,
    rates: appointmentRates(COUNTS),
    ...overrides,
  };
}

function ready<T>(data: T): AnalyticsResult<T> {
  return { status: "ready", data };
}

const HREF = "/admin/analytics?preset=custom&from=2026-09-01&to=2026-09-30";

describe("the trend chart", () => {
  it("renders the figures as a real table, not only as bars", () => {
    // Section 66's tabular alternative. Always present — not hidden, not
    // behind a control that has to be found first.
    render(
      <TrendChart
        points={TREND.map((point) => ({
          bucketStart: point.bucketStart,
          value: point.total,
        }))}
        granularity="day"
        labelFor={formatBucketLabel}
        valueHeader="Appointments"
        summaryLabel="appointments"
        caption="Appointments by day"
      />,
    );

    const table = screen.getByRole("table", { name: /appointments by day/i });
    expect(within(table).getByText("1 Sep")).toBeInTheDocument();
    expect(within(table).getByText("6")).toBeInTheDocument();
  });

  it("hides the drawing from assistive technology", () => {
    // It is a redundant presentation of the table beneath it; exposing both
    // would read the same numbers twice.
    const { container } = render(
      <TrendChart
        points={[{ bucketStart: "2026-09-01", value: 4 }]}
        granularity="day"
        labelFor={formatBucketLabel}
        valueHeader="Appointments"
        summaryLabel="appointments"
        caption="Appointments by day"
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("states the shape of the data in a visible sentence", () => {
    // So somebody who never sees the bars still learns the total, the period
    // and where the peak was — without hovering anything.
    render(
      <TrendChart
        points={TREND.map((point) => ({
          bucketStart: point.bucketStart,
          value: point.total,
        }))}
        granularity="day"
        labelFor={formatBucketLabel}
        valueHeader="Appointments"
        summaryLabel="appointments"
        caption="Appointments by day"
      />,
    );

    const summary = screen.getByText(/10 appointments between/i);
    expect(summary).toBeInTheDocument();
    expect(summary.textContent).toContain("Busiest: 3 Sep, 6");
  });

  it("gives every bar a native title, so hover is a supplement", () => {
    // Section 70: a tooltip supplements a visible label rather than replacing
    // it. Nothing is available only through this.
    const { container } = render(
      <TrendChart
        points={TREND.map((point) => ({
          bucketStart: point.bucketStart,
          value: point.total,
        }))}
        granularity="day"
        labelFor={formatBucketLabel}
        valueHeader="Appointments"
        summaryLabel="appointments"
        caption="Appointments by day"
      />,
    );

    const titles = [...container.querySelectorAll("svg title")].map(
      (node) => node.textContent,
    );
    expect(titles).toContain("1 Sep: 4");
    expect(titles).toContain("2 Sep: 0");
  });

  it("draws an empty bucket as a bucket, not as a gap", () => {
    // Section 96, in the drawing as well as in the data: a quiet day is a
    // zero the eye can see, not a hole the chart closes up.
    const { container } = render(
      <TrendChart
        points={TREND.map((point) => ({
          bucketStart: point.bucketStart,
          value: point.total,
        }))}
        granularity="day"
        labelFor={formatBucketLabel}
        valueHeader="Appointments"
        summaryLabel="appointments"
        caption="Appointments by day"
      />,
    );

    expect(container.querySelectorAll("svg rect")).toHaveLength(TREND.length);
  });

  it("uses one colour and encodes the value in height", () => {
    // Section 66's "non-color-dependent meaning". One series, one hue, so
    // there is no identity for colour to carry.
    const { container } = render(
      <TrendChart
        points={TREND.map((point) => ({
          bucketStart: point.bucketStart,
          value: point.total,
        }))}
        granularity="day"
        labelFor={formatBucketLabel}
        valueHeader="Appointments"
        summaryLabel="appointments"
        caption="Appointments by day"
      />,
    );

    const fills = new Set(
      [...container.querySelectorAll("svg rect")].map((node) =>
        node.getAttribute("fill"),
      ),
    );
    // The series colour, and the track for a zero bucket. No third.
    expect(fills).toEqual(
      new Set(["var(--chart-series)", "var(--chart-track)"]),
    );
  });

  it("says so rather than drawing nothing when there is nothing to plot", () => {
    render(
      <TrendChart
        points={[]}
        granularity="day"
        labelFor={formatBucketLabel}
        valueHeader="Appointments"
        summaryLabel="appointments"
        caption="Appointments by day"
      />,
    );

    expect(screen.getByText(/nothing to plot/i)).toBeInTheDocument();
  });

  it("carries the outcome split in the table without plotting it", () => {
    render(
      <AppointmentTrendPanel
        result={ready(TREND)}
        granularity="day"
        retryHref={HREF}
      />,
    );

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "Cancelled" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "No-shows" }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <TrendChart
        points={TREND.map((point) => ({
          bucketStart: point.bucketStart,
          value: point.total,
        }))}
        granularity="day"
        labelFor={formatBucketLabel}
        valueHeader="Appointments"
        summaryLabel="appointments"
        caption="Appointments by day"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("zero versus missing", () => {
  it("renders words, never 0%, when nothing concluded", () => {
    render(
      <AppointmentSummaryPanel
        result={ready({ ...EMPTY_COUNTS, total: 4, confirmed: 4 })}
        headingId="h"
        retryHref={HREF}
      />,
    );

    expect(
      screen.getAllByText(/no concluded appointments/i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
  });

  it("says a period was empty rather than showing a row of zeroes", () => {
    render(
      <AppointmentSummaryPanel
        result={ready(EMPTY_COUNTS)}
        headingId="h"
        retryHref={HREF}
      />,
    );

    expect(screen.getByText(/no activity in this period/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no appointments were scheduled/i),
    ).toBeInTheDocument();
  });

  it("shows a genuine zero as a zero", () => {
    // The other direction: nine concluded and none cancelled *is* 0%.
    render(
      <AppointmentSummaryPanel
        result={ready({
          ...EMPTY_COUNTS,
          total: 9,
          completed: 9,
          eligible: 9,
        })}
        headingId="h"
        retryHref={HREF}
      />,
    );

    // Two of them: cancellation and no-show are each 0 of 9.
    expect(screen.getAllByText("0.0%")).toHaveLength(2);
  });

  it("says a practitioner had no working hours rather than 0% utilisation", () => {
    render(
      <PractitionerWorkloadPanel
        result={ready([
          workloadRow({ ...utilization(0, 0), bookedMinutes: 0 }),
        ])}
        retryHref={HREF}
      />,
    );

    // In the cell itself, not only in the footnote that explains the rule.
    const table = screen.getByRole("table");
    expect(within(table).getByText(/no working hours/i)).toBeInTheDocument();
  });
});

describe("panel states", () => {
  it("offers a retry when a report could not be loaded", () => {
    render(
      <AnalyticsPanel result={{ status: "unavailable" }} retryHref={HREF}>
        {() => <p>never rendered</p>}
      </AnalyticsPanel>,
    );

    expect(screen.getByText(/couldn't load this report/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try again/i })).toHaveAttribute(
      "href",
      HREF,
    );
    expect(screen.queryByText("never rendered")).not.toBeInTheDocument();
  });

  it("renders nothing at all for a refused panel", () => {
    // Not a refusal notice: the reader was never offered this report, and
    // telling them it exists discloses it (`phase_08.md` section 12).
    const { container } = render(
      <AnalyticsPanel result={{ status: "forbidden" }} retryHref={HREF}>
        {() => <p>never rendered</p>}
      </AnalyticsPanel>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("exposes no SQL, table name or database detail in an error", () => {
    render(
      <AnalyticsPanel result={{ status: "unavailable" }} retryHref={HREF}>
        {() => <p>never rendered</p>}
      </AnalyticsPanel>,
    );

    const text = document.body.textContent ?? "";
    for (const term of ["select", "public.", "relation", "42501", "PV06"]) {
      expect(text.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });
});

describe("the figures", () => {
  it("shows the specification's fixture with the right denominator", () => {
    render(
      <AppointmentSummaryPanel
        result={ready(COUNTS)}
        headingId="h"
        retryHref={HREF}
      />,
    );

    expect(screen.getByText("66.7%")).toBeInTheDocument();
    expect(screen.getByText("22.2%")).toBeInTheDocument();
    expect(screen.getByText("11.1%")).toBeInTheDocument();
  });

  it("states the denominator on the page, not only in a comment", () => {
    render(
      <AppointmentSummaryPanel
        result={ready(COUNTS)}
        headingId="h"
        retryHref={HREF}
      />,
    );

    expect(
      screen.getByText(/shares of concluded appointments/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 in this period is still ahead of the clinic/i),
    ).toBeInTheDocument();
  });

  it("is a description list, so a figure is announced with its label", () => {
    const { container } = render(
      <MetricList
        figures={[{ label: "Appointments", value: "10" }]}
        headingId="h"
      />,
    );

    expect(container.querySelector("dl")).not.toBeNull();
    expect(container.querySelector("dt")?.textContent).toBe("Appointments");
    expect(container.querySelector("dd")?.textContent).toContain("10");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <AppointmentSummaryPanel
        result={ready(COUNTS)}
        headingId="h"
        retryHref={HREF}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("practitioner workload", () => {
  it("compares operational figures only", () => {
    render(
      <PractitionerWorkloadPanel
        result={ready([workloadRow()])}
        retryHref={HREF}
      />,
    );

    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((node) => node.textContent);

    expect(headers).toEqual([
      "Practitioner",
      "Appointments",
      "Completed",
      "Cancelled",
      "No-shows",
      "Utilisation",
    ]);
  });

  it("names no clinical measure anywhere", () => {
    // Section 20: no ranking by diagnosis, prescribing or outcome. There is
    // no column in the type for one, and this asserts none appears.
    render(
      <PractitionerWorkloadPanel
        result={ready([workloadRow()])}
        retryHref={HREF}
      />,
    );

    const text = (document.body.textContent ?? "").toLowerCase();
    for (const term of [
      "diagnos",
      "prescrib",
      "outcome",
      "efficacy",
      "effective",
      "score",
      "rank",
    ]) {
      expect(text, `the workload table mentions "${term}"`).not.toContain(term);
    }
  });

  it("prints the utilisation number beside the bar", () => {
    // The bar is decoration; remove all colour and the cell still reads.
    render(
      <ProportionCell
        value={0.375}
        label="37.5%"
        fallback="No working hours"
      />,
    );
    expect(screen.getByText("37.5%")).toBeInTheDocument();
  });

  it("renders markup in a practitioner's name as text", () => {
    render(
      <PractitionerWorkloadPanel
        result={ready([
          workloadRow({ displayName: "<script>alert(1)</script>" }),
        ])}
        retryHref={HREF}
      />,
    );

    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("says why an empty workload table is empty", () => {
    render(<PractitionerWorkloadPanel result={ready([])} retryHref={HREF} />);
    expect(
      screen.getByText(/no practitioner has a schedule/i),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <PractitionerWorkloadPanel
        result={ready([workloadRow()])}
        retryHref={HREF}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("patient growth", () => {
  it("says a new patient is a record and not an account", () => {
    // Section 22's warning, on the page rather than in a comment.
    render(
      <PatientGrowthPanel
        summary={ready({
          newPatients: 12,
          returningPatients: 5,
          activePatients: 30,
          totalPatients: 420,
        })}
        growth={ready([{ bucketStart: "2026-09-01", newPatients: 12 }])}
        granularity="day"
        headingId="h"
        retryHref={HREF}
      />,
    );

    expect(
      screen.getByText(/does not count user accounts/i),
    ).toBeInTheDocument();
  });

  it("shows no patient name, phone or email", () => {
    render(
      <PatientGrowthPanel
        summary={ready({
          newPatients: 12,
          returningPatients: 5,
          activePatients: 30,
          totalPatients: 420,
        })}
        growth={ready([])}
        granularity="day"
        headingId="h"
        retryHref={HREF}
      />,
    );

    const text = (document.body.textContent ?? "").toLowerCase();
    expect(text).not.toContain("@");
    expect(text).not.toMatch(/\+?\d{10}/);
  });
});

describe("notification analytics", () => {
  const deliveries = ready([
    {
      channel: "email",
      provider: "emailjs",
      pending: 4,
      sent: 301,
      failed: 19,
      skipped: 0,
      acceptanceRate: 301 / 320,
    },
  ]);

  const volume = ready([
    {
      category: "appointment_updates",
      scheduled: 0,
      active: 40,
      cancelled: 2,
      readCount: 10,
      readRate: 0.25,
    },
  ]);

  it("calls the figure acceptance, never delivery", () => {
    // Section 41. This is the figure somebody would otherwise assume means
    // something stronger than it does.
    render(
      <NotificationPanel
        deliveries={deliveries}
        volume={volume}
        retryHref={HREF}
      />,
    );

    expect(
      screen.getByRole("columnheader", { name: /acceptance rate/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /delivery rate/i }),
    ).not.toBeInTheDocument();
  });

  it("says in words that acceptance is not delivery", () => {
    render(
      <NotificationPanel
        deliveries={deliveries}
        volume={volume}
        retryHref={HREF}
      />,
    );

    expect(
      screen.getByText(/not confirmation that it reached the recipient/i),
    ).toBeInTheDocument();
  });

  it("shows no message content or recipient", () => {
    // Example 8: counts, never a body or a recipient.
    render(
      <NotificationPanel
        deliveries={deliveries}
        volume={volume}
        retryHref={HREF}
      />,
    );

    // The acceptance note is excluded, because it is the sentence that says
    // a message reaching the *recipient* is exactly what this does not
    // report — scanning it would punish the copy that protects the figure.
    const text = (document.body.textContent ?? "")
      .toLowerCase()
      .replace(/accepted means the provider[^.]*\.[^.]*\./, "");

    for (const term of ["subject", "body", "@", "message id"]) {
      expect(text, `the notification panel shows "${term}"`).not.toContain(
        term,
      );
    }

    // And "recipient" appears nowhere else.
    expect(text).not.toContain("recipient");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <NotificationPanel
        deliveries={deliveries}
        volume={volume}
        retryHref={HREF}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("clinical activity", () => {
  const activity = ready({
    prescriptionsIssued: 12,
    treatmentPlansActivated: 3,
    consultationsDocumented: 9,
    documentsUploaded: 5,
  });

  it("says what the counts are not", () => {
    // Sections 36 and 38: a plan count beside a prescription count invites an
    // efficacy reading, and the page refuses it explicitly.
    render(
      <ClinicalActivityPanel
        activity={activity}
        documentTypes={ready([])}
        headingId="h"
        retryHref={HREF}
      />,
    );

    expect(
      screen.getByText(/does not report on diagnoses, symptoms, medicines/i),
    ).toBeInTheDocument();
  });

  it("shows no medicine, diagnosis or document title", () => {
    render(
      <ClinicalActivityPanel
        activity={activity}
        documentTypes={ready([{ documentType: "lab_report", uploaded: 3 }])}
        headingId="h"
        retryHref={HREF}
      />,
    );

    const text = (document.body.textContent ?? "").toLowerCase();
    // "diagnoses" appears once, in the sentence saying they are not reported.
    const withoutNotice = text.replace(
      /punarvasu does not report on[^.]*\./,
      "",
    );

    for (const term of [
      "diagnos",
      "symptom",
      "dose",
      "mg",
      "ashwagandha",
      "storage",
      "signed",
    ]) {
      expect(withoutNotice, `clinical activity shows "${term}"`).not.toContain(
        term,
      );
    }
  });

  it("names a document by its kind, never by its title", () => {
    render(
      <ClinicalActivityPanel
        activity={activity}
        documentTypes={ready([{ documentType: "lab_report", uploaded: 3 }])}
        headingId="h"
        retryHref={HREF}
      />,
    );

    expect(screen.getByText("Lab report")).toBeInTheDocument();
  });
});

describe("the date filter", () => {
  it("renders exactly one form, carrying exactly its own fields", () => {
    const { container } = render(
      <DateRangeFilter
        range={RANGE}
        practitionerId={undefined}
        practitioners={[{ id: "p1", displayName: "Dr Example" }]}
        basePath="/admin/analytics"
        fellBack={false}
        problem={null}
      />,
    );

    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);

    const names = [...forms[0]!.querySelectorAll("[name]")].map((node) =>
      node.getAttribute("name"),
    );
    expect(new Set(names)).toEqual(
      new Set(["preset", "from", "to", "practitionerId"]),
    );
  });

  it("submits by GET, so the view is shareable and bookmarkable", () => {
    const { container } = render(
      <DateRangeFilter
        range={RANGE}
        practitionerId={undefined}
        basePath="/admin/analytics"
        fellBack={false}
        problem={null}
      />,
    );

    const form = container.querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/admin/analytics");
  });

  it("omits the practitioner control where there is no practitioner filter", () => {
    // The doctor's own dashboard. Not disabled, not hidden — absent.
    const { container } = render(
      <DateRangeFilter
        range={RANGE}
        practitionerId={undefined}
        basePath="/doctor/analytics"
        fellBack={false}
        problem={null}
      />,
    );

    expect(container.querySelector('[name="practitionerId"]')).toBeNull();
  });

  it("states the current period in words", () => {
    render(
      <DateRangeFilter
        range={RANGE}
        practitionerId={undefined}
        basePath="/admin/analytics"
        fellBack={false}
        problem={null}
      />,
    );

    expect(
      screen.getByText("1 September to 30 September 2026"),
    ).toBeInTheDocument();
  });

  it("says whose day a date means", () => {
    render(
      <DateRangeFilter
        range={RANGE}
        practitionerId={undefined}
        basePath="/admin/analytics"
        fellBack={false}
        problem={null}
      />,
    );

    expect(screen.getByText(/clinic's own day/i)).toBeInTheDocument();
  });

  it("reports a rejected period instead of silently replacing it", () => {
    // The failure that would otherwise be invisible: the page just shows
    // different numbers.
    render(
      <DateRangeFilter
        range={RANGE}
        practitionerId={undefined}
        basePath="/admin/analytics"
        fellBack
        problem="too_long"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/couldn't use that period/i);
    expect(alert.textContent).toMatch(/up to one year/i);
  });

  it("gives every control a real label", async () => {
    const { container } = render(
      <DateRangeFilter
        range={RANGE}
        practitionerId={undefined}
        practitioners={[{ id: "p1", displayName: "Dr Example" }]}
        basePath="/admin/analytics"
        fellBack={false}
        problem={null}
      />,
    );

    expect(screen.getByLabelText("Period")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.getByLabelText("Practitioner")).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });
});

describe("the export form", () => {
  it("renders one form posting exactly the period and the filter", () => {
    const { container } = render(
      <AppointmentReportExport range={RANGE} practitionerId="p1" />,
    );

    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    expect(forms[0]?.getAttribute("method")).toBe("post");
    expect(forms[0]?.getAttribute("action")).toBe("/api/reports/appointments");

    const names = [...forms[0]!.querySelectorAll("[name]")].map((node) =>
      node.getAttribute("name"),
    );
    expect(new Set(names)).toEqual(new Set(["from", "to", "practitionerId"]));
  });

  it("carries no field a caller could use to widen the report", () => {
    const { container } = render(
      <AppointmentReportExport range={RANGE} practitionerId={undefined} />,
    );

    const names = [...container.querySelectorAll("[name]")].map((node) =>
      node.getAttribute("name"),
    );

    for (const forbidden of [
      "columns",
      "format",
      "reportId",
      "patientId",
      "limit",
      "includeClinical",
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("says what is in the file before it is created", () => {
    render(
      <AppointmentReportExport range={RANGE} practitionerId={undefined} />,
    );

    expect(
      screen.getByText(
        /Date · Practitioner · Appointment type · Status · Appointments/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no patient information of any kind/i),
    ).toBeInTheDocument();
  });

  it("says the download is recorded", () => {
    render(
      <AppointmentReportExport range={RANGE} practitionerId={undefined} />,
    );
    expect(
      screen.getByText(/recorded against your account/i),
    ).toBeInTheDocument();
  });
});

describe("the metric definitions panel", () => {
  it("prints the formula beside the name", () => {
    render(<MetricDefinitions keys={["completionRate", "eligible"]} />);

    expect(screen.getByText("Completed ÷ concluded.")).toBeInTheDocument();
    expect(screen.getByText("Completion rate")).toBeInTheDocument();
  });

  it("is a disclosure, so it is reachable from the keyboard", () => {
    const { container } = render(
      <MetricDefinitions keys={["completionRate"]} />,
    );

    expect(container.querySelector("details")).not.toBeNull();
    expect(container.querySelector("summary")).not.toBeNull();
  });

  it("renders only the metrics a page shows", () => {
    render(<MetricDefinitions keys={["completionRate"]} />);
    expect(screen.queryByText("Acceptance rate")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<MetricDefinitions />);
    await expectNoAxeViolations(container);
  });
});

describe("tables", () => {
  it("names every table with a caption", () => {
    render(
      <AnalyticsTable
        caption="Something measurable"
        rows={[{ id: "1", value: 2 }]}
        rowKey={(row) => row.id}
        columns={[
          { header: "Thing", cell: (row) => row.id },
          { header: "Count", numeric: true, cell: (row) => row.value },
        ]}
      />,
    );

    expect(
      screen.getByRole("table", { name: "Something measurable" }),
    ).toBeInTheDocument();
  });

  it("names the scroll region, so an overflowing table is reachable", () => {
    render(
      <AnalyticsTable
        caption="Something measurable"
        rows={[]}
        rowKey={(row: { id: string }) => row.id}
        columns={[{ header: "Thing", cell: (row) => row.id }]}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Something measurable" }),
    ).toBeInTheDocument();
  });
});

describe("a practitioner's own utilisation", () => {
  it("shows the raw minutes as well as the share", () => {
    render(
      <UtilizationSummary
        bookedMinutes={180}
        availableMinutes={480}
        utilizationRate={0.375}
      />,
    );

    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.getByText("8 hours")).toBeInTheDocument();
    expect(screen.getByText("37.5%")).toBeInTheDocument();
  });

  it("says there were no working hours rather than showing 0%", () => {
    render(
      <UtilizationSummary
        bookedMinutes={0}
        availableMinutes={0}
        utilizationRate={null}
      />,
    );

    expect(
      screen.getByText(/no working hours in this period/i),
    ).toBeInTheDocument();
  });
});
