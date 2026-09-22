import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DoctorAppointmentFilters } from "@/components/doctor/appointment-filters";
import { DoctorAppointmentActions } from "@/components/doctor/appointment-status-actions";
import { CarePatientSearch } from "@/components/doctor/care-patient-search";
import { DoctorDaySummaryPanel } from "@/components/doctor/day-summary";
import { DoctorNav } from "@/components/doctor/doctor-nav";
import { DoctorSchedule } from "@/components/doctor/doctor-schedule";
import { NextPatientPanel } from "@/components/doctor/next-patient";
import { CarePatientSummary } from "@/components/doctor/patient-summary";
import { Toaster } from "@/components/ui/toast";
import { APPOINTMENT_STATUSES } from "@/features/appointments/status";
import type { AppointmentStatus } from "@/features/appointments/types";
import {
  CONSULTATION_COPY,
  DOCTOR_APPOINTMENT_COPY,
  DOCTOR_PATIENT_COPY,
} from "@/features/doctor/content";
import type {
  CarePatient,
  CarePatientSearchResult,
  DoctorAppointment,
  DoctorDaySummary,
} from "@/features/doctor/types";
import { PATIENT_RECORD_COPY, TODAY_COPY } from "@/features/reception/content";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The doctor workspace's UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * **nothing clinical appears anywhere**, and the two places a
 *     practitioner would look for it say so out loud rather than leaving the
 *     absence to be read as a loading failure (`phase_11.md` sections 18 and
 *     51);
 *   * the actions offered for a status compose all three rules — so "Cancel"
 *     is never rendered, "Start consultation" appears only for a checked-in
 *     patient, and a terminal appointment gets a sentence rather than a row
 *     of disabled buttons (section 21, example 7);
 *   * terminal actions ask first and reversible ones do not, so a
 *     practitioner does not learn to dismiss dialogs (section 40);
 *   * each form carries **exactly** the fields its action reads and nothing
 *     that would be a claim about identity — the regression test for the
 *     class of defect Phase 07 shipped;
 *   * the patient search shows all four of its states, never lists anybody
 *     before somebody searches, and never puts the term in a URL (section
 *     43);
 *   * the schedule renders as cards on a phone and a real table on a
 *     desktop, rather than one squeezed (sections 37-38);
 *   * every count on the summary is a number it was given, not one it made
 *     up (section 7 and example 6).
 *
 * None of this is a security control. Every action re-checks on the server
 * and the database refuses independently; these assertions are about the
 * experience, and about the UI not undermining the model.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/doctor",
}));

const submissions: FormData[] = [];

/*
 * The server actions, replaced by recorders.
 *
 * `useActionState` needs a function of `(state, formData)`, and what these
 * tests care about is *what the form carried* — which fields, and which
 * values. The actions' own behaviour is covered against a recording Supabase
 * stub in `tests/integration/doctor-actions.test.ts`.
 */
vi.mock("@/features/doctor/actions", () => ({
  updateDoctorAppointmentStatusAction: async (
    _state: unknown,
    formData: FormData,
  ) => {
    submissions.push(formData);
    return { status: "success", message: "Appointment confirmed." };
  },
  searchCarePatientsAction: async (_state: unknown, formData: FormData) => {
    submissions.push(formData);
    const query = String(formData.get("query") ?? "");

    if (query === "none") {
      return { status: "found", results: [], tooShort: false, query };
    }
    if (query === "boom") {
      return {
        status: "unavailable",
        results: [],
        tooShort: false,
        query,
      };
    }
    if (query.length < 2) {
      return { status: "idle", results: [], tooShort: true, query: "" };
    }

    return {
      status: "found",
      results: [SEARCH_RESULT],
      tooShort: false,
      query,
    };
  },
}));

const APPOINTMENT_ID = "55555555-5555-4555-8555-555555555555";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";

function appointment(
  overrides: Partial<DoctorAppointment> = {},
): DoctorAppointment {
  return {
    id: APPOINTMENT_ID,
    startsAt: new Date("2026-09-22T05:00:00.000Z"),
    endsAt: new Date("2026-09-22T05:45:00.000Z"),
    status: "confirmed",
    durationMinutes: 45,
    patientId: PATIENT_ID,
    patientName: "Test Patient",
    patientDateOfBirth: "1990-04-07",
    appointmentTypeId: "44444444-4444-4444-8444-444444444444",
    typeName: "Initial consultation",
    patientNote: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-01T05:00:00.000Z"),
    ...overrides,
  };
}

const SEARCH_RESULT: CarePatientSearchResult = {
  id: PATIENT_ID,
  fullName: "Test Patient",
  preferredName: null,
  phone: "9999999999",
  dateOfBirth: "1990-04-07",
  lastAppointmentAt: new Date("2026-09-01T05:00:00.000Z"),
};

const PATIENT: CarePatient = {
  id: PATIENT_ID,
  fullName: "Test Patient",
  preferredName: "Testy",
  phone: "9999999999",
  dateOfBirth: "1990-04-07",
  gender: "female",
  city: "Satara",
  state: "Maharashtra",
  preferredLanguage: "Marathi",
  emergencyContactName: "Other Person",
  emergencyContactRelationship: "Sibling",
  emergencyContactPhone: "9999999998",
  createdAt: "2026-04-01T05:00:00.000Z",
};

const SUMMARY: DoctorDaySummary = {
  total: 6,
  awaitingConfirmation: 2,
  remaining: 4,
  completed: 1,
};

/** Words that must not appear anywhere in this workspace. */
const CLINICAL_WORDS = [
  "diagnos",
  "symptom",
  "prescri",
  "medicat",
  "medicine",
  "allerg",
  "vital",
  "blood pressure",
  "treatment plan",
];

/**
 * Anything that renders a status action announces through `useToast`, and so
 * needs a `Toaster` above it. Wrapping here rather than in each test keeps
 * the assertions about the component under test.
 */
function renderWithToaster(ui: React.ReactElement) {
  return render(<Toaster>{ui}</Toaster>);
}

beforeEach(() => {
  submissions.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the clinical boundary", () => {
  it("renders nothing clinical on a schedule", () => {
    const { container } = renderWithToaster(
      <DoctorSchedule appointments={[appointment()]} />,
    );

    const text = (container.textContent ?? "").toLowerCase();
    for (const word of CLINICAL_WORDS) {
      expect(text, word).not.toContain(word);
    }
  });

  it("renders nothing clinical on a patient summary", () => {
    // The `compact` variant, because the full one carries a notice that
    // *names* the missing capabilities — "consultation notes, assessments,
    // prescriptions and documents" — which is the point of the notice and
    // is asserted on its own below. Everything the page actually renders
    // about the patient is in both.
    const { container } = render(
      <CarePatientSummary patient={PATIENT} compact />,
    );
    const text = (container.textContent ?? "").toLowerCase();

    for (const word of CLINICAL_WORDS) {
      expect(text, word).not.toContain(word);
    }
  });

  it("says what this summary is, and what is still not built", () => {
    // Phase 11 used this notice to say clinical records did not exist. They
    // do now, so it says where they are — and it still names the two
    // capabilities that genuinely do not exist, which is the convention every
    // phase of this project has followed (`phase_12.md` sections 48-49).
    //
    // The assertion is that the notice does not claim something absent is
    // present, nor something present is absent: a practitioner who finds no
    // history needs to know whether the patient has none or the page is
    // broken.
    render(<CarePatientSummary patient={PATIENT} />);

    expect(
      screen.getByText(/this is the patient's record, not their notes/i),
    ).toBeInTheDocument();
    // Phase 14 built documents, so the notice no longer names them. A stale
    // placeholder outliving the thing it stood in for is the defect Phase
    // 12's browser pass found three times over and Phase 13's review found
    // five times over, and these are the assertions that catch it here.
    expect(
      screen.queryByText(/documents[^.]*(are|is) still being built/i),
    ).toBeNull();
    expect(
      screen.queryByText(/prescriptions[^.]*are still being built/i),
    ).toBeNull();
    // What the summary genuinely is not: the patient's clinical notes, and
    // the documents on their record — both of which are elsewhere on the
    // page, and the notice says where.
    expect(screen.getByText(/documents/i)).toBeInTheDocument();
  });

  it("no longer claims clinical records are unavailable", () => {
    // The regression this guards is a stale placeholder outliving the thing
    // it was a placeholder for — which would send a practitioner to write
    // their notes somewhere else while the page that holds them sits one
    // click away.
    const { container } = render(<CarePatientSummary patient={PATIENT} />);

    expect(container.textContent ?? "").not.toMatch(
      /clinical records are not available/i,
    );
  });

  it("drops the notice on a compact summary, where the page carries its own", () => {
    render(<CarePatientSummary patient={PATIENT} compact />);

    expect(
      screen.queryByText(/this is the patient's record, not their notes/i),
    ).not.toBeInTheDocument();
  });

  it("renders no form and no text box on a patient summary", () => {
    // There is nowhere to write a clinical record, and there must be nowhere
    // that looks like one either (`phase_11.md` section 51).
    const { container } = render(<CarePatientSummary patient={PATIENT} />);

    expect(container.querySelectorAll("form")).toHaveLength(0);
    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll('input[type="text"]')).toHaveLength(0);
  });

  it("shows no street address on a patient summary", () => {
    // `phase_11.md` section 44: only the fields the workflow needs. No Phase
    // 11 workflow needs a doorstep, so the query does not ask for one — this
    // asserts the component has nowhere to render one either.
    const { container } = render(<CarePatientSummary patient={PATIENT} />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/address line/i);
    expect(text).not.toMatch(/postal code/i);
  });
});

describe("the status actions", () => {
  it("offers no way to cancel, from any status", () => {
    // Cancelling changes a patient's plans and needs somebody to tell them.
    // It is the front desk's work (`phase_11.md` section 21).
    for (const status of APPOINTMENT_STATUSES) {
      const { container, unmount } = renderWithToaster(
        <DoctorAppointmentActions
          appointmentId={APPOINTMENT_ID}
          status={status}
        />,
      );

      expect(container.textContent ?? "", status).not.toMatch(/\bcancel\b/i);
      unmount();
    }
  });

  it("offers no way to reschedule, from any status", () => {
    for (const status of APPOINTMENT_STATUSES) {
      const { container, unmount } = renderWithToaster(
        <DoctorAppointmentActions
          appointmentId={APPOINTMENT_ID}
          status={status}
        />,
      );

      expect(container.textContent ?? "", status).not.toMatch(
        /reschedul|change (the )?time|move/i,
      );
      unmount();
    }
  });

  it("says who does cancel and move an appointment", () => {
    renderWithToaster(
      <DoctorAppointmentActions
        appointmentId={APPOINTMENT_ID}
        status="confirmed"
      />,
    );

    expect(screen.getByText(/done at the front desk/i)).toBeInTheDocument();
  });

  it("offers starting a consultation only for a checked-in patient", () => {
    for (const status of APPOINTMENT_STATUSES) {
      const { queryByRole, unmount } = renderWithToaster(
        <DoctorAppointmentActions
          appointmentId={APPOINTMENT_ID}
          status={status}
        />,
      );

      const button = queryByRole("button", { name: "Start consultation" });
      if (status === "checked_in") {
        expect(button, status).not.toBeNull();
      } else {
        expect(button, status).toBeNull();
      }
      unmount();
    }
  });

  it("gives a terminal appointment a sentence rather than disabled buttons", () => {
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      const { container, unmount } = renderWithToaster(
        <DoctorAppointmentActions
          appointmentId={APPOINTMENT_ID}
          status={status}
        />,
      );

      expect(container.querySelectorAll("button"), status).toHaveLength(0);
      expect(
        screen.getByText(/nothing left to change/i),
        status,
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("carries exactly the two fields the action reads", async () => {
    const user = userEvent.setup();
    const { container } = renderWithToaster(
      <DoctorAppointmentActions
        appointmentId={APPOINTMENT_ID}
        status="requested"
      />,
    );

    // Exactly one form per action, and no nesting — the Phase 07 defect
    // where a nested form submitted by GET into the URL.
    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    expect(forms[0]?.querySelectorAll("form")).toHaveLength(0);

    await user.click(
      screen.getByRole("button", { name: "Confirm appointment" }),
    );

    expect(submissions).toHaveLength(1);
    expect([...(submissions[0]?.keys() ?? [])].sort()).toEqual([
      "appointmentId",
      "status",
    ]);
    expect(submissions[0]?.get("status")).toBe("confirmed");
  });

  it("asks before completing, and does not write until it is confirmed", async () => {
    const user = userEvent.setup();
    renderWithToaster(
      <DoctorAppointmentActions
        appointmentId={APPOINTMENT_ID}
        status="in_consultation"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Complete consultation" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(submissions).toHaveLength(0);

    await user.click(
      within(dialog).getByRole("button", { name: "Complete consultation" }),
    );

    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.get("status")).toBe("completed");
  });

  it("does not ask before confirming or starting", async () => {
    const user = userEvent.setup();
    renderWithToaster(
      <DoctorAppointmentActions
        appointmentId={APPOINTMENT_ID}
        status="checked_in"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Start consultation" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.get("status")).toBe("in_consultation");
  });

  it("announces a successful change", async () => {
    const user = userEvent.setup();
    renderWithToaster(
      <DoctorAppointmentActions
        appointmentId={APPOINTMENT_ID}
        status="requested"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm appointment" }),
    );

    expect(
      await screen.findByText("Appointment confirmed."),
    ).toBeInTheDocument();
  });
});

describe("the schedule", () => {
  it("renders cards and a table over the same data", () => {
    // `phase_11.md` sections 37-38: turn a dense table into cards on a small
    // screen rather than shrinking it. Both layouts are in the DOM and CSS
    // chooses; jsdom has no layout engine, so the class is what is asserted.
    const { container } = renderWithToaster(
      <DoctorSchedule appointments={[appointment()]} />,
    );

    expect(container.querySelector("ul.md\\:hidden")).not.toBeNull();
    expect(container.querySelector("div.hidden.md\\:block")).not.toBeNull();
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });

  it("gives the table a caption and column headers", () => {
    renderWithToaster(<DoctorSchedule appointments={[appointment()]} />);

    const table = screen.getByRole("table");
    expect(
      within(table).getByText(/your appointments, earliest first/i),
    ).toBeInTheDocument();

    for (const heading of ["Time", "Patient", "Consultation", "Status"]) {
      expect(
        within(table).getByRole("columnheader", { name: heading }),
      ).toBeInTheDocument();
    }
  });

  it("has no practitioner column", () => {
    // Every row is this practitioner's. A column with one value repeated
    // down it is noise (`phase_11.md` section 12).
    renderWithToaster(<DoctorSchedule appointments={[appointment()]} />);

    expect(
      screen.queryByRole("columnheader", { name: /practitioner/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the patient's age, derived, and never a stored one", () => {
    renderWithToaster(<DoctorSchedule appointments={[appointment()]} />);
    // Two layouts render it, so there are two matches.
    expect(screen.getAllByText(/Age \d+/).length).toBeGreaterThan(0);
  });

  it("omits the age entirely when there is no date of birth", () => {
    renderWithToaster(
      <DoctorSchedule
        appointments={[appointment({ patientDateOfBirth: null })]}
      />,
    );

    expect(screen.queryByText(/Age /)).not.toBeInTheDocument();
  });

  it("names the patient in each row's accessible link name", () => {
    // The visible label is identical on every row.
    renderWithToaster(<DoctorSchedule appointments={[appointment()]} />);

    const links = screen.getAllByRole("link", { name: /Open .* Test Patient/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute(
        "href",
        `/doctor/appointments/${APPOINTMENT_ID}`,
      );
    }
  });

  it("offers at most one action per row, and never a confirming one", () => {
    // `phase_11.md` sections 3 and 9: a row gets one action, and a dialog
    // never opens from a list.
    for (const status of APPOINTMENT_STATUSES) {
      const { container, unmount } = renderWithToaster(
        <DoctorSchedule appointments={[appointment({ status })]} />,
      );

      // Two layouts, so at most two copies of the same single action.
      const buttons = container.querySelectorAll("button");
      expect(buttons.length, status).toBeLessThanOrEqual(2);

      for (const button of buttons) {
        expect(button.textContent ?? "", status).not.toMatch(
          /complete|not attended/i,
        );
      }
      unmount();
    }
  });
});

describe("the day summary", () => {
  it("renders the numbers it was given and no others", () => {
    const { container } = render(<DoctorDaySummaryPanel summary={SUMMARY} />);

    const values = [...container.querySelectorAll("dd")].map(
      (node) => node.textContent,
    );
    expect(values).toEqual(["6", "4", "1", "2"]);
  });

  it("is a description list, so each number is announced with its label", () => {
    const { container } = render(<DoctorDaySummaryPanel summary={SUMMARY} />);

    expect(container.querySelector("dl")).not.toBeNull();
    expect(container.querySelectorAll("dt")).toHaveLength(4);
  });

  it("renders no chart, no icon and no card", () => {
    // `phase_11.md` sections 3 and 7: avoid excessive KPI cards, and do not
    // let this read as a SaaS analytics dashboard.
    const { container } = render(<DoctorDaySummaryPanel summary={SUMMARY} />);

    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(container.querySelectorAll("canvas")).toHaveLength(0);
  });

  it("carries no clinical or financial figure", () => {
    const { container } = render(<DoctorDaySummaryPanel summary={SUMMARY} />);
    const text = (container.textContent ?? "").toLowerCase();

    for (const word of [
      "revenue",
      "income",
      "₹",
      "success",
      "outcome",
      "rate",
    ]) {
      expect(text, word).not.toContain(word);
    }
  });
});

describe("the next-patient panel", () => {
  it("says what is empty rather than showing a blank box", () => {
    render(
      <NextPatientPanel
        label="Next patient"
        appointment={null}
        emptyText="Nothing else is booked today."
      />,
    );

    expect(
      screen.getByText("Nothing else is booked today."),
    ).toBeInTheDocument();
  });

  it("offers the consultation when one is under way", () => {
    render(
      <NextPatientPanel
        label="With you now"
        appointment={appointment({ status: "in_consultation" })}
        emptyText="Nobody."
      />,
    );

    expect(
      screen.getByRole("link", { name: /Open the consultation with/ }),
    ).toHaveAttribute(
      "href",
      `/doctor/appointments/${APPOINTMENT_ID}/consultation`,
    );
  });

  it("offers starting one when the patient has been checked in", () => {
    renderWithToaster(
      <NextPatientPanel
        label="Next patient"
        appointment={appointment({ status: "checked_in" })}
        emptyText="Nobody."
      />,
    );

    expect(
      screen.getByRole("button", { name: "Start consultation" }),
    ).toBeInTheDocument();
  });
});

describe("the patient search", () => {
  it("lists nobody before anybody searches", () => {
    render(<CarePatientSearch />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Nothing is listed until you search/i),
    ).toBeInTheDocument();
  });

  it("carries exactly the one field the action reads", async () => {
    const user = userEvent.setup();
    const { container } = render(<CarePatientSearch />);

    expect(container.querySelectorAll("form")).toHaveLength(1);

    await user.type(screen.getByLabelText(/search your patients/i), "Priya");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(submissions).toHaveLength(1);
    expect([...(submissions[0]?.keys() ?? [])]).toEqual(["query"]);
  });

  it("never puts the term in the URL", async () => {
    // A search term is somebody's name, and a URL reaches browser history on
    // a shared consulting-room machine (`phase_11.md` section 43).
    const user = userEvent.setup();
    const { container } = render(<CarePatientSearch />);

    const form = container.querySelector("form");
    // A `useActionState` form posts; it has no `method="get"` and no action
    // URL of its own.
    expect(form?.getAttribute("method")).not.toBe("get");

    await user.type(screen.getByLabelText(/search your patients/i), "Priya");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(window.location.search).toBe("");
  });

  it("renders the found state with the minimum columns", async () => {
    const user = userEvent.setup();
    render(<CarePatientSearch />);

    await user.type(screen.getByLabelText(/search your patients/i), "Priya");
    await user.click(screen.getByRole("button", { name: "Search" }));

    const table = await screen.findByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((node) => node.textContent?.trim());

    expect(headers).toEqual([
      "Name",
      "Date of birth",
      "Phone",
      "Last appointment with you",
      "Action",
    ]);

    // Never an address, an emergency contact or an account identifier.
    const text = table.textContent ?? "";
    expect(text).not.toMatch(/address|emergency|account/i);
  });

  it("renders the no-match state", async () => {
    const user = userEvent.setup();
    render(<CarePatientSearch />);

    await user.type(screen.getByLabelText(/search your patients/i), "none");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/No patients found/i)).toBeInTheDocument();
    // And it explains the scope rather than implying the person is missing.
    expect(
      screen.getByText(/among the people you are booked to see/i),
    ).toBeInTheDocument();
  });

  it("renders the failure state as an outage rather than as no results", async () => {
    const user = userEvent.setup();
    render(<CarePatientSearch />);

    await user.type(screen.getByLabelText(/search your patients/i), "boom");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText(/couldn't run that search/i),
    ).toBeInTheDocument();
  });

  it("renders the too-short state", async () => {
    const user = userEvent.setup();
    render(<CarePatientSearch />);

    await user.type(screen.getByLabelText(/search your patients/i), "P");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/Keep typing/i)).toBeInTheDocument();
  });
});

describe("the appointment filters", () => {
  it("is a plain GET form, so it works before hydration", () => {
    const { container } = render(
      <DoctorAppointmentFilters
        range="upcoming"
        status={undefined}
        appointmentTypeId={undefined}
        appointmentTypes={[]}
        basePath="/doctor/appointments"
      />,
    );

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/doctor/appointments");
  });

  it("offers no practitioner filter", () => {
    // `phase_11.md` section 12: a control with one option is worse than no
    // control.
    render(
      <DoctorAppointmentFilters
        range="upcoming"
        status={undefined}
        appointmentTypeId={undefined}
        appointmentTypes={[]}
        basePath="/doctor/appointments"
      />,
    );

    expect(screen.queryByLabelText(/practitioner/i)).not.toBeInTheDocument();
  });

  it("labels every control", () => {
    render(
      <DoctorAppointmentFilters
        range="today"
        status="confirmed"
        appointmentTypeId={undefined}
        appointmentTypes={[]}
        basePath="/doctor/appointments"
      />,
    );

    expect(screen.getByLabelText("When")).toHaveValue("today");
    expect(screen.getByLabelText("Status")).toHaveValue("confirmed");
    expect(screen.getByLabelText("Consultation")).toHaveValue("");
  });

  it("offers a way to clear the filters only when some are set", () => {
    const { rerender } = render(
      <DoctorAppointmentFilters
        range="upcoming"
        status={undefined}
        appointmentTypeId={undefined}
        appointmentTypes={[]}
        basePath="/doctor/appointments"
      />,
    );

    expect(
      screen.queryByRole("link", { name: "Clear filters" }),
    ).not.toBeInTheDocument();

    rerender(
      <DoctorAppointmentFilters
        range="upcoming"
        status="no_show"
        appointmentTypeId={undefined}
        appointmentTypes={[]}
        basePath="/doctor/appointments"
      />,
    );

    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/doctor/appointments?range=upcoming",
    );
  });
});

describe("navigation", () => {
  it("marks exactly one item as the current page", () => {
    const { container } = render(<DoctorNav label="Clinical workspace" />);

    const current = container.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe("Today");
  });

  it("offers the three places the workspace has", () => {
    render(<DoctorNav label="Clinical workspace" />);

    for (const [label, href] of [
      ["Today", "/doctor"],
      ["Appointments", "/doctor/appointments"],
      ["Patients", "/doctor/patients"],
    ] as const) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
  });
});

describe("landmark names", () => {
  /**
   * A `<section aria-labelledby>` is a `region` landmark, and so is
   * `TableScroller`, which is labelled with the table's caption. When a
   * section's heading and the caption of the table inside it say the same
   * thing, the page has two regions with one name — an axe `landmark-unique`
   * violation.
   *
   * The component tests could not catch it: they render a schedule on its
   * own, and the duplication only exists once a page puts one inside a
   * section. It was found by the Phase 11 browser pass, in this workspace
   * **and** in the receptionist workspace, where it had shipped in Phase 10
   * because that phase ran no browser pass.
   *
   * So the guard is on the copy: a caption may never equal the heading it
   * sits under. It is a cheap assertion for a defect that costs a real
   * browser to see.
   */
  it.each([
    [
      "doctor patient upcoming",
      DOCTOR_PATIENT_COPY.upcomingHeading,
      DOCTOR_PATIENT_COPY.upcomingCaption,
    ],
    [
      "doctor patient history",
      DOCTOR_PATIENT_COPY.historyHeading,
      DOCTOR_PATIENT_COPY.historyCaption,
    ],
    [
      "consultation history",
      CONSULTATION_COPY.historyHeading,
      CONSULTATION_COPY.historyCaption,
    ],
    [
      "reception awaiting confirmation",
      TODAY_COPY.awaitingHeading,
      TODAY_COPY.awaitingCaption,
    ],
    [
      "reception patient upcoming",
      PATIENT_RECORD_COPY.upcomingHeading,
      PATIENT_RECORD_COPY.upcomingCaption,
    ],
    [
      "reception patient recent",
      PATIENT_RECORD_COPY.recentHeading,
      PATIENT_RECORD_COPY.recentCaption,
    ],
  ])(
    "%s: the caption differs from the heading above it",
    (_label, heading, caption) => {
      expect(caption).not.toBe(heading);
    },
  );

  it("does not reuse the page heading as a section heading on the appointment page", () => {
    // Same class, different pair: the page's `<h1>` names the outer region,
    // and a `ProfileSection` titled the same thing would collide with it.
    expect(DOCTOR_APPOINTMENT_COPY.detailsHeading).not.toBe(
      DOCTOR_APPOINTMENT_COPY.heading,
    );
    expect(DOCTOR_APPOINTMENT_COPY.patientHeading).not.toBe(
      DOCTOR_APPOINTMENT_COPY.heading,
    );
  });
});

describe("accessibility", () => {
  it("has no violations on a schedule", async () => {
    const { container } = renderWithToaster(
      <DoctorSchedule
        appointments={[
          appointment(),
          appointment({
            id: "77777777-7777-4777-8777-777777777777",
            status: "checked_in",
          }),
        ]}
      />,
    );

    await expectNoAxeViolations(container);
  });

  it("has no violations on a patient summary", async () => {
    const { container } = render(<CarePatientSummary patient={PATIENT} />);
    await expectNoAxeViolations(container);
  });

  it("has no violations on the day summary and the next-patient panels", async () => {
    const { container } = renderWithToaster(
      <div>
        <DoctorDaySummaryPanel summary={SUMMARY} />
        <NextPatientPanel
          label="With you now"
          appointment={appointment({ status: "in_consultation" })}
          emptyText="Nobody."
        />
        <NextPatientPanel
          label="Next patient"
          appointment={null}
          emptyText="Nothing else is booked today."
        />
      </div>,
    );

    await expectNoAxeViolations(container);
  });

  it("has no violations on the status actions", async () => {
    const { container } = renderWithToaster(
      <DoctorAppointmentActions
        appointmentId={APPOINTMENT_ID}
        status="checked_in"
      />,
    );

    await expectNoAxeViolations(container);
  });

  it("has no violations on the filters", async () => {
    const { container } = render(
      <DoctorAppointmentFilters
        range="upcoming"
        status={undefined}
        appointmentTypeId={undefined}
        appointmentTypes={[]}
        basePath="/doctor/appointments"
      />,
    );

    await expectNoAxeViolations(container);
  });

  it("has no violations on the patient search, before and after a search", async () => {
    const user = userEvent.setup();
    const { container } = render(<CarePatientSearch />);

    await expectNoAxeViolations(container);

    await user.type(screen.getByLabelText(/search your patients/i), "Priya");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("table");

    await expectNoAxeViolations(container);
  });

  it("has no violations on the navigation", async () => {
    const { container } = render(<DoctorNav label="Clinical workspace" />);
    await expectNoAxeViolations(container);
  });

  it("communicates a status with a word as well as a colour", () => {
    // Inherited from the shared badge, asserted here because this workspace
    // renders it (`phase_11.md` section 39).
    for (const status of APPOINTMENT_STATUSES) {
      const { container, unmount } = renderWithToaster(
        <DoctorSchedule appointments={[appointment({ status })]} />,
      );

      expect(
        (container.textContent ?? "").trim().length,
        status,
      ).toBeGreaterThan(0);
      unmount();
    }
  });

  it("keeps every action reachable from the keyboard", async () => {
    const user = userEvent.setup();
    renderWithToaster(
      <DoctorAppointmentActions
        appointmentId={APPOINTMENT_ID}
        status="checked_in"
      />,
    );

    const start = screen.getByRole("button", { name: "Start consultation" });
    await user.tab();
    expect(start).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(submissions).toHaveLength(1);
  });
});

/** A type-level reminder that the fixture matches the shipped shape. */
const _statusIsAnAppointmentStatus: AppointmentStatus = appointment().status;
void _statusIsAnAppointmentStatus;
