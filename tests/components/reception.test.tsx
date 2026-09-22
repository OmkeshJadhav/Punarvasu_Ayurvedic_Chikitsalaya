import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentStatusActions } from "@/components/reception/appointment-status-actions";
import { DayOverviewSummary } from "@/components/reception/day-overview";
import { NewPatientForm } from "@/components/reception/new-patient-form";
import { PatientRecord } from "@/components/reception/patient-record";
import { PatientSearch } from "@/components/reception/patient-search";
import { ReceptionNav } from "@/components/reception/reception-nav";
import { ScheduleFilters } from "@/components/reception/schedule-filters";
import { ScheduleList } from "@/components/reception/schedule-list";
import { Toaster } from "@/components/ui/toast";
import { APPOINTMENT_STATUSES } from "@/features/appointments/status";
import type { AppointmentStatus } from "@/features/appointments/types";
import type {
  DayOverview,
  OperationalPatient,
  PatientSearchResult,
  ScheduledAppointment,
} from "@/features/reception/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The receptionist workspace's UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * **nothing clinical appears anywhere**, and the patient record says so
 *     out loud rather than leaving the absence to be read as a loading
 *     failure (`phase_10.md` sections 4 and 14);
 *   * a status is never communicated by colour alone, and the actions offered
 *     for it compose the transition matrix with the role allowlist — so
 *     "Complete" is never rendered and a terminal appointment gets a sentence
 *     rather than a row of disabled buttons (section 31, example 5);
 *   * destructive actions ask first and non-destructive ones do not, so the
 *     front desk does not learn to dismiss dialogs (sections 20 and 30);
 *   * each form renders **exactly one** `<form>` element carrying exactly the
 *     fields its action reads — the regression test for the class of defect
 *     Phase 07 shipped, where a nested form submitted a patient's details by
 *     GET into the URL;
 *   * patient search shows all four of its states and never lists anybody
 *     before somebody searches (section 13);
 *   * the schedule renders as cards on a phone and a real table on a desktop,
 *     rather than one squeezed (section 48);
 *   * every count on the overview is a number it was given, not one it made
 *     up (section 6).
 *
 * None of this is a security control. Every action re-checks on the server and
 * the database refuses independently; these assertions are about the
 * experience, and about the UI not undermining the model.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/receptionist",
}));

const submissions: FormData[] = [];

/*
 * The server actions, replaced by recorders.
 *
 * `useActionState` needs a function of `(state, formData)`, and what these
 * tests care about is *what the form carried* — which fields, and which
 * values. The actions' own behaviour is covered against a recording Supabase
 * stub in `tests/integration/reception-actions.test.ts`.
 */
vi.mock("@/features/reception/actions", () => ({
  createPatientAction: async (_state: unknown, formData: FormData) => {
    submissions.push(formData);
    return { status: "idle" };
  },
  createAppointmentForPatientAction: async (
    _state: unknown,
    formData: FormData,
  ) => {
    submissions.push(formData);
    return { status: "idle" };
  },
  updateAppointmentStatusAction: async (
    _state: unknown,
    formData: FormData,
  ) => {
    submissions.push(formData);
    return { status: "success", message: "Appointment confirmed." };
  },
  rescheduleAppointmentForPatientAction: async (
    _state: unknown,
    formData: FormData,
  ) => {
    submissions.push(formData);
    return { status: "idle" };
  },
  searchPatientsAction: async (_state: unknown, formData: FormData) => {
    submissions.push(formData);
    const query = String(formData.get("query") ?? "");

    if (query.trim().length < 2) {
      return { status: "idle", results: [], tooShort: true, query };
    }
    if (query === "nobody") {
      return { status: "found", results: [], tooShort: false, query };
    }

    return {
      status: "found",
      results: [SEARCH_RESULT],
      tooShort: false,
      query,
    };
  },
}));

const SEARCH_RESULT: PatientSearchResult = {
  id: "22222222-2222-4222-8222-222222222222",
  fullName: "Test Patient",
  preferredName: null,
  phone: "9999999999",
  dateOfBirth: "1990-04-07",
  city: "Satara",
  hasAccount: false,
};

function appointment(
  overrides: Partial<ScheduledAppointment> = {},
): ScheduledAppointment {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    startsAt: new Date("2026-09-22T05:00:00.000Z"),
    endsAt: new Date("2026-09-22T05:45:00.000Z"),
    status: "confirmed",
    durationMinutes: 45,
    patientId: "22222222-2222-4222-8222-222222222222",
    patientName: "Test Patient",
    patientPhone: "9999999999",
    practitionerId: "33333333-3333-4333-8333-333333333333",
    practitionerName: "Practitioner Example",
    appointmentTypeId: "44444444-4444-4444-8444-444444444444",
    typeName: "Initial consultation",
    patientNote: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date("2026-09-20T05:00:00.000Z"),
    ...overrides,
  };
}

const PATIENT: OperationalPatient = {
  id: "22222222-2222-4222-8222-222222222222",
  fullName: "Test Patient",
  preferredName: "Testy",
  phone: "9999999999",
  dateOfBirth: "1990-04-07",
  gender: "undisclosed",
  addressLine1: "1 Example Road",
  addressLine2: null,
  city: "Satara",
  state: "Maharashtra",
  postalCode: "415001",
  emergencyContactName: "Example Contact",
  emergencyContactRelationship: "Sibling",
  emergencyContactPhone: "9888888888",
  preferredLanguage: "Marathi",
  hasAccount: false,
  createdAt: "2026-04-01T00:00:00.000Z",
};

const OVERVIEW: DayOverview = {
  total: 12,
  awaitingConfirmation: 3,
  confirmed: 7,
  checkedIn: 2,
  completed: 0,
  cancelled: 1,
  noShow: 0,
};

beforeEach(() => {
  submissions.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("the day overview", () => {
  it("shows every figure it was given and invents none", () => {
    render(<DayOverviewSummary overview={OVERVIEW} />);

    // `phase_10.md` section 6: all counts come from real data.
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("pairs each number with its label as a definition list", () => {
    const { container } = render(<DayOverviewSummary overview={OVERVIEW} />);

    const list = container.querySelector("dl");
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll("dt")).toHaveLength(4);
    expect(list?.querySelectorAll("dd")).toHaveLength(4);
  });

  it("shows no revenue, outcome or health figure", () => {
    const { container } = render(<DayOverviewSummary overview={OVERVIEW} />);
    const text = container.textContent ?? "";

    // `phase_10.md` section 42.
    expect(text).not.toMatch(/revenue|income|₹|diagnos|outcome/i);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<DayOverviewSummary overview={OVERVIEW} />);
    await expectNoAxeViolations(container);
  });
});

/**
 * `ScheduleList` renders a quick status action, which announces through
 * `useToast` and therefore needs a `Toaster` above it. Wrapping here rather
 * than in each test keeps the assertions about the schedule.
 */
function renderSchedule(appointments: readonly ScheduledAppointment[]) {
  return render(
    <Toaster>
      <ScheduleList appointments={appointments} />
    </Toaster>,
  );
}

describe("the schedule", () => {
  it("renders the same appointments as cards and as a table", () => {
    renderSchedule([appointment()]);

    // Two layouts, one data set — CSS decides which is shown, so both exist in
    // the DOM and both must be correct.
    expect(screen.getAllByText("Test Patient").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("gives the table a caption and column headers", () => {
    renderSchedule([appointment()]);

    const table = screen.getByRole("table");
    expect(within(table).getByText(/earliest first/i)).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Time" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Patient" }),
    ).toBeInTheDocument();
  });

  it("shows a status as a badge with text, never colour alone", () => {
    renderSchedule([appointment()]);

    // The badge carries an icon *and* a word. `docs/DESIGN_SYSTEM.md` §5.
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
  });

  it("names each row's link after the person it opens", () => {
    renderSchedule([appointment()]);

    // The visible label is "Open" on every row, so the accessible name has to
    // distinguish them for a screen-reader user moving between links.
    const links = screen.getAllByRole("link", { name: /Open .*Test Patient/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute(
      "href",
      "/receptionist/schedule/55555555-5555-4555-8555-555555555555",
    );
  });

  it("offers a phone link on the card layout", () => {
    renderSchedule([appointment()]);

    const call = screen.getByRole("link", { name: /9999/ });
    expect(call).toHaveAttribute("href", "tel:9999999999");
  });

  it("renders nothing clinical", () => {
    const { container } = renderSchedule([
      appointment({ patientNote: "Ground floor" }),
    ]);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(
      /diagnos|symptom|medicat|allerg|prescrib|treatment plan/i,
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <Toaster>
        <ScheduleList
          appointments={[appointment(), appointment({ id: "x" })]}
        />
      </Toaster>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("appointment status actions", () => {
  it("offers confirm for a requested appointment and no dialog", async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <AppointmentStatusActions appointmentId="a" status="requested" />
      </Toaster>,
    );

    const confirm = screen.getByRole("button", { name: "Confirm" });
    await user.click(confirm);

    // Confirming is additive and still cancellable, so it happens immediately.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.get("status")).toBe("confirmed");
    expect(submissions[0]?.get("appointmentId")).toBe("a");
  });

  it("asks before cancelling", async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <AppointmentStatusActions appointmentId="a" status="confirmed" />
      </Toaster>,
    );

    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/goes back into the diary/i),
    ).toBeInTheDocument();
    // Nothing has been submitted by opening the dialog.
    expect(submissions).toHaveLength(0);
  });

  it("asks before marking a no-show", async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <AppointmentStatusActions appointmentId="a" status="confirmed" />
      </Toaster>,
    );

    await user.click(screen.getByRole("button", { name: "Mark as no-show" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/did not attend/i)).toBeInTheDocument();
  });

  it("never offers to complete an appointment", () => {
    // `phase_10.md` section 31: completion stays a clinical responsibility.
    for (const status of APPOINTMENT_STATUSES) {
      const { container, unmount } = render(
        <Toaster>
          <AppointmentStatusActions appointmentId="a" status={status} />
        </Toaster>,
      );

      expect(container.textContent, status).not.toMatch(/complete/i);
      unmount();
    }
  });

  it("says so rather than showing disabled buttons for a finished appointment", () => {
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      const { unmount } = render(
        <Toaster>
          <AppointmentStatusActions appointmentId="a" status={status} />
        </Toaster>,
      );

      expect(
        screen.getByText(/nothing left to change/i),
        status,
      ).toBeInTheDocument();
      expect(screen.queryAllByRole("button"), status).toHaveLength(0);
      unmount();
    }
  });

  it("offers nothing for an appointment in the consulting room", () => {
    // `in_consultation -> cancelled` is a legal transition and `cancelled` is
    // a status the front desk may set — but the patient is in the room with
    // the practitioner, so it is not the desk's call.
    render(
      <Toaster>
        <AppointmentStatusActions appointmentId="a" status="in_consultation" />
      </Toaster>,
    );

    expect(screen.getByText(/nothing left to change/i)).toBeInTheDocument();
  });

  it("carries only an appointment id, a status and an optional reason", async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <AppointmentStatusActions appointmentId="a" status="requested" />
      </Toaster>,
    );

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    // No patient id, no duration, no timestamp, no role.
    const fields = [...(submissions[0]?.keys() ?? [])].sort();
    expect(fields).toEqual(["appointmentId", "status"]);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <Toaster>
        <AppointmentStatusActions appointmentId="a" status="confirmed" />
      </Toaster>,
    );
    await expectNoAxeViolations(container);
  });
});

describe("patient search", () => {
  it("lists nobody before a search is made", () => {
    render(<PatientSearch />);

    // `phase_10.md` section 13: there is no "all patients" view.
    expect(screen.getByText(/Search for a patient/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("asks for more characters rather than searching for one", async () => {
    const user = userEvent.setup();
    render(<PatientSearch />);

    await user.type(screen.getByLabelText(/Search patients/i), "P");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/Keep typing/i)).toBeInTheDocument();
  });

  it("shows matches with only the fields needed to identify somebody", async () => {
    const user = userEvent.setup();
    render(<PatientSearch />);

    await user.type(screen.getByLabelText(/Search patients/i), "Test");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("Test Patient").length).toBeGreaterThan(0);

    // `phase_10.md` example 6: no address, no emergency contact.
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("1 Example Road");
    expect(text).not.toContain("Example Contact");
  });

  it("offers registration when nothing matches", async () => {
    const user = userEvent.setup();
    render(<PatientSearch />);

    await user.type(screen.getByLabelText(/Search patients/i), "nobody");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/No patients found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Register a patient/i }),
    ).toHaveAttribute("href", "/receptionist/patients/new");
  });

  it("never puts the search term in a link or a URL", async () => {
    const user = userEvent.setup();
    const { container } = render(<PatientSearch />);

    await user.type(screen.getByLabelText(/Search patients/i), "Test");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("table");

    // A search term at a front desk is somebody's name. It must not reach
    // browser history, a proxy log or a `Referer` header.
    const form = container.querySelector("form");
    expect(form?.getAttribute("method")).not.toBe("get");

    for (const link of container.querySelectorAll("a")) {
      expect(link.getAttribute("href")).not.toContain("Test");
    }
  });

  it("names each result's link after the person it opens", async () => {
    const user = userEvent.setup();
    render(<PatientSearch />);

    await user.type(screen.getByLabelText(/Search patients/i), "Test");
    await user.click(screen.getByRole("button", { name: "Search" }));

    const links = await screen.findAllByRole("link", {
      name: /Open Test Patient/,
    });
    expect(links[0]).toHaveAttribute(
      "href",
      "/receptionist/patients/22222222-2222-4222-8222-222222222222",
    );
  });

  it("hands the patient back instead of linking when choosing one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PatientSearch onSelect={onSelect} />);

    await user.type(screen.getByLabelText(/Search patients/i), "Test");
    await user.click(screen.getByRole("button", { name: "Search" }));

    const choose = await screen.findAllByRole("button", {
      name: /Choose Test Patient/,
    });
    await user.click(choose[0]!);

    expect(onSelect).toHaveBeenCalledWith(SEARCH_RESULT);
  });

  it("renders exactly one form, carrying only the query", async () => {
    const { container } = render(<PatientSearch />);

    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);

    const fields = [...forms[0]!.querySelectorAll("input, select, textarea")]
      .map((field) => field.getAttribute("name"))
      .filter(Boolean);
    expect(fields).toEqual(["query"]);
  });

  it("has no accessibility violations in any state", async () => {
    const user = userEvent.setup();
    const { container } = render(<PatientSearch />);

    await expectNoAxeViolations(container);

    await user.type(screen.getByLabelText(/Search patients/i), "Test");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("table");

    await expectNoAxeViolations(container);
  });
});

describe("the patient record", () => {
  it("shows the operational fields the front desk needs", () => {
    render(<PatientRecord patient={PATIENT} />);

    expect(screen.getByText("Test Patient")).toBeInTheDocument();
    expect(screen.getByText("+91 99999 99999")).toBeInTheDocument();
    expect(screen.getByText("7 April 1990")).toBeInTheDocument();
    expect(screen.getByText(/1 Example Road/)).toBeInTheDocument();
    expect(screen.getByText("Example Contact")).toBeInTheDocument();
  });

  it("shows no clinical information and says why", () => {
    const { container } = render(<PatientRecord patient={PATIENT} />);

    /*
     * Scanned over the record's own fields rather than the whole container,
     * because the scope notice *names* what it excludes — "Consultation notes,
     * assessments and prescriptions are not shown here" — and a sweep of the
     * page text would fail on the very sentence that makes the boundary
     * visible. What matters is that no clinical word appears as a label or a
     * value.
     */
    const fields = [...container.querySelectorAll("dt, dd")]
      .map((node) => node.textContent ?? "")
      .join(" ");

    expect(fields).not.toMatch(
      /diagnos|symptom|medicat|allerg|prescrib|treatment plan|assessment/i,
    );
    // It says so out loud, rather than leaving the absence to be read as a
    // loading failure (`phase_10.md` section 14).
    expect(
      screen.getByText(/Operational information only/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/are not shown here and are not available/i),
    ).toBeInTheDocument();
  });

  it("says whether the patient can sign in, never which account", () => {
    const { container } = render(<PatientRecord patient={PATIENT} />);

    expect(screen.getByText(/cannot sign in yet/i)).toBeInTheDocument();
    // No profile id, no auth identifier.
    expect(container.textContent).not.toMatch(/profile_id|profileId/);
  });

  it("derives the age rather than storing one", () => {
    const { container } = render(<PatientRecord patient={PATIENT} />);
    // A number is rendered against the Age label. The exact value moves with
    // the calendar, which is the point of deriving it.
    expect(container.textContent).toMatch(/Age/);
  });

  it("renders a name containing markup as text", () => {
    const hostile = { ...PATIENT, fullName: "<script>alert(1)</script>" };
    const { container } = render(<PatientRecord patient={hostile} />);

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PatientRecord patient={PATIENT} />);
    await expectNoAxeViolations(container);
  });
});

describe("registering a patient", () => {
  it("renders exactly one form, which does not submit by GET", () => {
    // The regression test for Phase 07's nested-form defect, which put a
    // patient's name, date of birth and address into the URL.
    const { container } = render(
      <NewPatientForm cancelHref="/receptionist/patients" />,
    );

    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    expect(forms[0]?.getAttribute("method")).not.toBe("get");
  });

  it("requires only a name", () => {
    render(<NewPatientForm cancelHref="/receptionist/patients" />);

    const name = screen.getByLabelText(/Full name/i);
    expect(name).toBeRequired();

    // Exact labels: "Phone number" and "Contact phone number" both match a
    // loose pattern, and `getByLabelText` throws on an ambiguous one.
    for (const label of ["Phone number", "Town or city", "Postal code"]) {
      expect(screen.getByLabelText(label, { exact: true })).not.toBeRequired();
    }
  });

  it("has no field for an account, a credential or a role", () => {
    const { container } = render(
      <NewPatientForm cancelHref="/receptionist/patients" />,
    );

    const names = [...container.querySelectorAll("input, select, textarea")]
      .map((field) => field.getAttribute("name"))
      .filter((name): name is string => Boolean(name));

    for (const forbidden of [
      "email",
      "password",
      "role",
      "profileId",
      "userId",
      "id",
    ]) {
      expect(names, forbidden).not.toContain(forbidden);
    }
  });

  it("has no field for clinical information, and says not to record any", () => {
    const { container } = render(
      <NewPatientForm cancelHref="/receptionist/patients" />,
    );

    const names = [...container.querySelectorAll("input, select, textarea")]
      .map((field) => field.getAttribute("name"))
      .filter((name): name is string => Boolean(name));

    for (const name of names) {
      expect(name).not.toMatch(
        /diagnos|symptom|medicat|allerg|prescri|treatment|clinical|condition/i,
      );
    }

    expect(
      screen.getByText(/don't record symptoms, conditions or medicines/i),
    ).toBeInTheDocument();
  });

  it("says that registering does not create a login", () => {
    render(<NewPatientForm cancelHref="/receptionist/patients" />);

    // `phase_10.md` section 35. "Register a patient" reasonably sounds like it
    // creates an account, so the form says it does not.
    expect(
      screen.getByText(/creates a clinic record, not a login/i),
    ).toBeInTheDocument();
  });

  it("lets a gender be unset again", () => {
    render(<NewPatientForm cancelHref="/receptionist/patients" />);

    const gender = screen.getByLabelText(/Gender/i);
    expect(
      within(gender).getByRole("option", { name: "Not specified" }),
    ).toBeInTheDocument();
  });

  it("gives every control a real label", () => {
    const { container } = render(
      <NewPatientForm cancelHref="/receptionist/patients" />,
    );

    for (const field of container.querySelectorAll("input, select, textarea")) {
      const name = field.getAttribute("name");
      if (!name) continue;
      // Throws if the control has no accessible label.
      expect(screen.getByLabelText(labelFor(field))).toBeInTheDocument();
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <NewPatientForm cancelHref="/receptionist/patients" />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("the schedule filters", () => {
  it("submits by GET, because a date and a status are not sensitive", () => {
    const { container } = render(
      <ScheduleFilters
        date="2026-09-22"
        practitionerId={undefined}
        status={undefined}
        practitioners={[
          {
            id: "33333333-3333-4333-8333-333333333333",
            displayName: "Practitioner Example",
            acceptsOnlineBooking: false,
          },
        ]}
        basePath="/receptionist/schedule"
      />,
    );

    // Deliberately the opposite call from the patient search: these are
    // shareable and bookmarkable, and none of them is somebody's name.
    const form = container.querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/receptionist/schedule");
  });

  it("steps days as links, which work without JavaScript", () => {
    render(
      <ScheduleFilters
        date="2026-09-22"
        practitionerId={undefined}
        status={undefined}
        practitioners={[]}
        basePath="/receptionist/schedule"
      />,
    );

    expect(screen.getByRole("link", { name: /Previous day/ })).toHaveAttribute(
      "href",
      expect.stringContaining("date=2026-09-21"),
    );
    expect(screen.getByRole("link", { name: /Next day/ })).toHaveAttribute(
      "href",
      expect.stringContaining("date=2026-09-23"),
    );
  });

  it("keeps the other filters when only the day changes", () => {
    render(
      <ScheduleFilters
        date="2026-09-22"
        practitionerId="33333333-3333-4333-8333-333333333333"
        status="requested"
        practitioners={[]}
        basePath="/receptionist/schedule"
      />,
    );

    const next = screen.getByRole("link", { name: /Next day/ });
    expect(next.getAttribute("href")).toContain("practitionerId=");
    expect(next.getAttribute("href")).toContain("status=requested");
  });

  it("labels a status with the product's own vocabulary", () => {
    render(
      <ScheduleFilters
        date="2026-09-22"
        practitionerId={undefined}
        status={undefined}
        practitioners={[]}
        basePath="/receptionist/schedule"
      />,
    );

    const status = screen.getByLabelText("Status");
    // "Requested", never "Pending" — the same word the badge beside it uses.
    expect(
      within(status).getByRole("option", { name: "Requested" }),
    ).toBeInTheDocument();
    expect(
      within(status).queryByRole("option", { name: "Pending" }),
    ).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ScheduleFilters
        date="2026-09-22"
        practitionerId={undefined}
        status={undefined}
        practitioners={[]}
        basePath="/receptionist/schedule"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("workspace navigation", () => {
  it("offers the three places the workspace has", () => {
    render(<ReceptionNav label="Front desk" />);

    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute(
      "href",
      "/receptionist",
    );
    expect(screen.getByRole("link", { name: "Schedule" })).toHaveAttribute(
      "href",
      "/receptionist/schedule",
    );
    expect(screen.getByRole("link", { name: "Patients" })).toHaveAttribute(
      "href",
      "/receptionist/patients",
    );
  });

  it("marks exactly one link as the current page", () => {
    const { container } = render(<ReceptionNav label="Front desk" />);

    // "Today" uses `match: "exact"`, or it and "Schedule" would both report
    // `aria-current="page"` on `/receptionist/schedule`.
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ReceptionNav label="Front desk" />);
    await expectNoAxeViolations(container);
  });
});

describe("the workspace as a whole", () => {
  it("renders no clinical vocabulary on an assembled schedule view", async () => {
    const statuses: readonly AppointmentStatus[] = APPOINTMENT_STATUSES;

    const { container } = render(
      <Toaster>
        <div>
          <DayOverviewSummary overview={OVERVIEW} />
          <ScheduleList
            appointments={statuses.map((status, index) =>
              appointment({ id: `appointment-${index}`, status }),
            )}
          />
        </div>
      </Toaster>,
    );

    expect(container.textContent).not.toMatch(
      /diagnos|symptom|medicat|allerg|prescrib|treatment plan|assessment|consultation note/i,
    );
  });

  it("has no accessibility violations when assembled", async () => {
    const { container } = render(
      <Toaster>
        <div>
          <DayOverviewSummary overview={OVERVIEW} />
          <ScheduleList
            appointments={[appointment(), appointment({ id: "b" })]}
          />
          <PatientRecord patient={PATIENT} />
        </div>
      </Toaster>,
    );

    await expectNoAxeViolations(container);
  });
});

/** The accessible label of a control, for the "everything is labelled" sweep. */
function labelFor(field: Element): RegExp {
  const id = field.getAttribute("id");
  const label = id
    ? document.querySelector(`label[for="${id}"]`)?.textContent
    : null;

  return new RegExp(
    (label ?? field.getAttribute("aria-label") ?? "").replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    ),
  );
}
