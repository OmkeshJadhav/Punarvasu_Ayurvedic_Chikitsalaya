import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentCard } from "@/components/appointments/appointment-card";
import { AppointmentHistory } from "@/components/appointments/appointment-history";
import { AppointmentList } from "@/components/appointments/appointment-list";
import {
  AppointmentStatusBadge,
  appointmentStatusLabel,
} from "@/components/appointments/appointment-status-badge";
import {
  AppointmentSummary,
  appointmentReference,
} from "@/components/appointments/appointment-summary";
import { BookingFlow } from "@/components/appointments/booking-flow";
import { CancelAppointmentDialog } from "@/components/appointments/cancel-appointment-dialog";
import { DatePickerStrip } from "@/components/appointments/date-picker-strip";
import { TimeSlotPicker } from "@/components/appointments/time-slot-picker";
import { Toaster } from "@/components/ui/toast";
import { APPOINTMENT_STATUSES } from "@/features/appointments/status";
import type {
  AppointmentEvent,
  AppointmentType,
  GroupedAppointments,
  PatientAppointment,
  SchedulingPractitioner,
} from "@/features/appointments/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * Appointment UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * a status is never communicated by colour alone, and `requested` reads as
 *     **Requested** rather than as anything that implies the clinic has agreed
 *     (`phase_09.md` sections 21 and 48);
 *   * the booking flow renders **exactly one** `<form>` — Phase 07 shipped a
 *     nested one that submitted a patient's details by GET into the URL, and
 *     this is the regression test for the class of that defect;
 *   * that form carries exactly the four fields the action reads, and no field
 *     for a patient id, a duration, a status or an end time (sections 22-23,
 *     37-38);
 *   * slot and date choices are real buttons in real lists, operable from the
 *     keyboard, with selection carried by `aria-pressed` as well as by a fill;
 *   * every one of loading, empty and error is rendered rather than a blank
 *     area (sections 45-47);
 *   * cancelling asks first, and the detail view has nowhere to render an
 *     internal note.
 *
 * None of this is a security control. Every action re-checks on the server and
 * the database refuses independently; these assertions are about the
 * experience, and about the UI not undermining the model.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/patient/appointments",
}));

const bookAppointmentAction = vi.fn(async () => ({ status: "idle" as const }));
const cancelAppointmentAction = vi.fn(async () => ({
  status: "idle" as const,
}));
const rescheduleAppointmentAction = vi.fn(async () => ({
  status: "idle" as const,
}));

vi.mock("@/features/appointments/actions", () => ({
  bookAppointmentAction: (...args: unknown[]) =>
    bookAppointmentAction(...(args as [])),
  cancelAppointmentAction: (...args: unknown[]) =>
    cancelAppointmentAction(...(args as [])),
  rescheduleAppointmentAction: (...args: unknown[]) =>
    rescheduleAppointmentAction(...(args as [])),
}));

const APPOINTMENT_ID = "11111111-1111-4111-8111-1111111111ab";
const PRACTITIONER_ID = "22222222-2222-4222-8222-2222222222cd";
const TYPE_ID = "33333333-3333-4333-8333-3333333333ef";

/** 22 September 2026, 10:30 clinic time. */
const STARTS_AT = new Date("2026-09-22T05:00:00.000Z");
const ENDS_AT = new Date("2026-09-22T05:45:00.000Z");

const APPOINTMENT: PatientAppointment = {
  id: APPOINTMENT_ID,
  startsAt: STARTS_AT,
  endsAt: ENDS_AT,
  status: "requested",
  practitionerId: PRACTITIONER_ID,
  practitionerName: "Test Practitioner",
  appointmentTypeId: TYPE_ID,
  typeName: "Initial consultation",
  durationMinutes: 45,
  patientNote: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: new Date("2026-09-18T05:00:00.000Z"),
};

const TYPES: readonly AppointmentType[] = [
  {
    id: TYPE_ID,
    slug: "initial-consultation",
    name: "Initial consultation",
    description: "For a first visit to Punarvasu.",
    durationMinutes: 45,
    bufferMinutes: 0,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "follow-up-consultation",
    name: "Follow-up consultation",
    description: null,
    durationMinutes: 30,
    bufferMinutes: 0,
  },
];

const PRACTITIONERS: readonly SchedulingPractitioner[] = [
  { id: PRACTITIONER_ID, displayName: "Test Practitioner" },
  {
    id: "55555555-5555-4555-8555-555555555555",
    displayName: "Second Practitioner",
  },
];

const SLOTS = [
  { startsAt: "2026-09-22T05:00:00.000Z", endsAt: "2026-09-22T05:45:00.000Z" },
  { startsAt: "2026-09-22T05:15:00.000Z", endsAt: "2026-09-22T06:00:00.000Z" },
];

function groups(
  overrides: Partial<GroupedAppointments> = {},
): GroupedAppointments {
  return { upcoming: [], past: [], cancelled: [], ...overrides };
}

/** A fetch stub that always answers with the slot list above. */
function stubAvailability(slots = SLOTS) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, data: { slots } }),
    })),
  );
}

beforeEach(() => {
  stubAvailability();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppointmentStatusBadge", () => {
  it("never signals a status by colour alone", () => {
    for (const status of APPOINTMENT_STATUSES) {
      const { container, unmount } = render(
        <AppointmentStatusBadge status={status} />,
      );

      // Text, and an icon beside it.
      expect(container.textContent?.trim().length).toBeGreaterThan(0);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("says Requested, not Pending", () => {
    // "Pending" does not tell a patient whether the clinic has agreed to
    // anything. `phase_09.md` sections 21 and 48.
    render(<AppointmentStatusBadge status="requested" />);

    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).toBeNull();
  });

  it("never labels an unconfirmed appointment as confirmed", () => {
    expect(appointmentStatusLabel("requested")).toBe("Requested");
    expect(appointmentStatusLabel("requested")).not.toMatch(/confirm/i);
    expect(appointmentStatusLabel("confirmed")).toBe("Confirmed");
  });

  it("has a label for every status in the lifecycle", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(appointmentStatusLabel(status).length).toBeGreaterThan(0);
    }
  });
});

describe("AppointmentCard", () => {
  it("shows the date and time in clinic time, and the status", () => {
    render(<AppointmentCard appointment={APPOINTMENT} />);

    expect(screen.getByText("Tuesday, 22 September 2026")).toBeInTheDocument();
    expect(screen.getByText(/10:30 am to 11:15 am/)).toBeInTheDocument();
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(
      screen.getByText(/Initial consultation with Test Practitioner/),
    ).toBeInTheDocument();
  });

  it("carries a machine-readable instant alongside the clinic time", () => {
    const { container } = render(<AppointmentCard appointment={APPOINTMENT} />);
    const time = container.querySelector("time");

    expect(time).toHaveAttribute("dateTime", STARTS_AT.toISOString());
  });

  it("gives its link an accessible name that identifies the appointment", () => {
    // Every card's visible label is "View details". A screen-reader user
    // moving between links needs to know which one.
    render(<AppointmentCard appointment={APPOINTMENT} />);

    const link = screen.getByRole("link", {
      name: /view details for tuesday, 22 september 2026/i,
    });
    expect(link).toHaveAttribute(
      "href",
      `/patient/appointments/${APPOINTMENT_ID}`,
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<AppointmentCard appointment={APPOINTMENT} />);
    await expectNoAxeViolations(container);
  });
});

describe("AppointmentList", () => {
  it("invites a patient with nothing booked to book", () => {
    render(<AppointmentList groups={groups()} />);

    expect(screen.getByText("No upcoming appointments")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request an appointment" }),
    ).toHaveAttribute("href", "/patient/appointments/book");
  });

  it("does not render empty past and cancelled panels", () => {
    // Three empty panels on a new patient's first visit would be three ways of
    // saying nothing has happened yet.
    render(<AppointmentList groups={groups()} />);

    expect(
      screen.getByRole("heading", { name: "Upcoming" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Past" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Cancelled" })).toBeNull();
  });

  it("keeps cancelled appointments in their own group", () => {
    render(
      <AppointmentList
        groups={groups({
          upcoming: [APPOINTMENT],
          cancelled: [
            {
              ...APPOINTMENT,
              id: "66666666-6666-4666-8666-666666666666",
              status: "cancelled",
              cancelledAt: new Date("2026-09-19T05:00:00.000Z"),
            },
          ],
        })}
      />,
    );

    const cancelled = screen
      .getByRole("heading", { name: "Cancelled" })
      .closest("section") as HTMLElement;
    const upcoming = screen
      .getByRole("heading", { name: "Upcoming" })
      .closest("section") as HTMLElement;

    // Exactly one card in each, and the cancelled one is not in "Upcoming".
    expect(within(cancelled).getAllByRole("listitem")).toHaveLength(1);
    expect(within(upcoming).getAllByRole("listitem")).toHaveLength(1);
    expect(within(upcoming).queryByText("Cancelled")).toBeNull();
    expect(within(cancelled).queryByText("Requested")).toBeNull();
  });

  it("presents appointments as a real list", () => {
    render(<AppointmentList groups={groups({ upcoming: [APPOINTMENT] })} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <AppointmentList
        groups={groups({ upcoming: [APPOINTMENT], past: [APPOINTMENT] })}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("TimeSlotPicker", () => {
  const noop = () => {};

  it("announces that it is loading rather than showing a blank area", () => {
    render(
      <TimeSlotPicker
        status="loading"
        slots={[]}
        selected={null}
        onSelect={noop}
        onRetry={noop}
        label="Times"
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/loading available times/i)).toBeInTheDocument();
  });

  it("says what to do when a day has no times", () => {
    render(
      <TimeSlotPicker
        status="ready"
        slots={[]}
        selected={null}
        onSelect={noop}
        onRetry={noop}
        label="Times"
      />,
    );

    expect(
      screen.getByText("No times available on this day"),
    ).toBeInTheDocument();
    expect(screen.getByText(/choose another day/i)).toBeInTheDocument();
  });

  it("offers a retry when times could not be loaded", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <TimeSlotPicker
        status="error"
        slots={[]}
        selected={null}
        onSelect={noop}
        onRetry={onRetry}
        label="Times"
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    // And it says nothing technical.
    expect(screen.getByRole("alert").textContent).not.toMatch(
      /postgres|supabase|rpc|500/i,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders each time as a button in a labelled list", () => {
    render(
      <TimeSlotPicker
        status="ready"
        slots={SLOTS}
        selected={null}
        onSelect={noop}
        onRetry={noop}
        label="Times on Tuesday"
      />,
    );

    const list = screen.getByRole("list", { name: "Times on Tuesday" });
    expect(within(list).getAllByRole("button")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "10:30 am" }),
    ).toBeInTheDocument();
  });

  it("carries the selection in aria-pressed as well as in the fill", () => {
    render(
      <TimeSlotPicker
        status="ready"
        slots={SLOTS}
        selected={SLOTS[0]?.startsAt ?? null}
        onSelect={noop}
        onRetry={noop}
        label="Times"
      />,
    );

    const selected = screen.getByRole("button", { name: /10:30 am/ });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "10:45 am" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("is operable from the keyboard", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TimeSlotPicker
        status="ready"
        slots={SLOTS}
        selected={null}
        onSelect={onSelect}
        onRetry={noop}
        label="Times"
      />,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "10:30 am" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(SLOTS[0]);
  });

  it("has no accessibility violations in any state", async () => {
    for (const status of ["loading", "ready", "error"] as const) {
      const { container, unmount } = render(
        <TimeSlotPicker
          status={status}
          slots={status === "ready" ? SLOTS : []}
          selected={null}
          onSelect={noop}
          onRetry={noop}
          label="Times"
        />,
      );

      await expectNoAxeViolations(container);
      unmount();
    }
  });
});

describe("DatePickerStrip", () => {
  const DATES = ["2026-09-22", "2026-09-23", "2026-09-29"];

  it("offers only the days it was given", () => {
    render(
      <DatePickerStrip
        dates={DATES}
        selected={null}
        onSelect={() => {}}
        label="Dates"
      />,
    );

    expect(
      within(screen.getByRole("list", { name: "Dates" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(3);
  });

  it("names each day in full for assistive technology", () => {
    // The visible label is short enough to fit across a phone; the accessible
    // name is not abbreviated.
    render(
      <DatePickerStrip
        dates={DATES}
        selected={null}
        onSelect={() => {}}
        label="Dates"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Tuesday, 22 September 2026" }),
    ).toBeInTheDocument();
  });

  it("says so when a practitioner has no bookable days at all", () => {
    render(
      <DatePickerStrip
        dates={[]}
        selected={null}
        onSelect={() => {}}
        label="Dates"
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <DatePickerStrip
        dates={DATES}
        selected={DATES[0] ?? null}
        onSelect={() => {}}
        label="Dates"
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("BookingFlow", () => {
  function renderFlow() {
    return render(
      <BookingFlow
        appointmentTypes={TYPES}
        practitioners={PRACTITIONERS}
        datesByPractitioner={{
          [PRACTITIONER_ID]: ["2026-09-22", "2026-09-23"],
          "55555555-5555-4555-8555-555555555555": ["2026-09-24"],
        }}
        locationLines={["1 Example Road", "Satara, Maharashtra 415001"]}
      />,
    );
  }

  /**
   * The Phase 07 regression, restated for this form.
   *
   * A nested `<form>` parses as one element server-side and hydrates into two,
   * and the inner one — having no action — submits by **GET**, putting the
   * submitted values into the URL. For a booking form that means a patient's
   * appointment time and note in browser history and proxy logs.
   */
  it("renders exactly one form, and it has an action", () => {
    const { container } = renderFlow();
    const forms = container.querySelectorAll("form");

    expect(forms).toHaveLength(1);
    // React replaces the browser's GET default when a function action is
    // attached; the absence of `method="get"` is what is observable in jsdom.
    expect(forms[0]?.getAttribute("method")).not.toBe("get");
  });

  it("opens on the consultation type, as a labelled radio group", () => {
    renderFlow();

    const group = screen.getByRole("group", {
      name: /what kind of consultation/i,
    });
    expect(
      within(group).getAllByRole("radio", { checked: false }),
    ).toHaveLength(2);
  });

  it("walks type, practitioner, date, time, review", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(
      screen.getByRole("radio", { name: /Initial consultation/ }),
    );
    expect(
      screen.getByRole("group", { name: /who would you like to see/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Test Practitioner/ }));
    expect(
      screen.getByRole("heading", { name: "Which day?" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Tuesday, 22 September 2026" }),
    );
    expect(
      screen.getByRole("heading", { name: "Which time?" }),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "10:30 am" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "10:30 am" }));
    expect(
      screen.getByRole("heading", { name: "Check your request" }),
    ).toBeInTheDocument();
  });

  it("carries exactly the four fields the action reads", async () => {
    const user = userEvent.setup();
    const { container } = renderFlow();

    await user.click(
      screen.getByRole("radio", { name: /Initial consultation/ }),
    );
    await user.click(screen.getByRole("radio", { name: /Test Practitioner/ }));
    await user.click(
      screen.getByRole("button", { name: "Tuesday, 22 September 2026" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "10:30 am" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "10:30 am" }));

    const named = [...container.querySelectorAll("[name]")].map((element) =>
      element.getAttribute("name"),
    );

    expect([...new Set(named)].sort()).toEqual([
      "appointmentTypeId",
      "patientNote",
      "practitionerId",
      "startsAt",
    ]);
  });

  it("has no field a client could use to claim another patient or a status", async () => {
    const user = userEvent.setup();
    const { container } = renderFlow();

    await user.click(
      screen.getByRole("radio", { name: /Initial consultation/ }),
    );
    await user.click(screen.getByRole("radio", { name: /Test Practitioner/ }));

    const named = [...container.querySelectorAll("[name]")].map((element) =>
      element.getAttribute("name"),
    );

    for (const forbidden of [
      "patientId",
      "patient_id",
      "userId",
      "status",
      "duration",
      "durationMinutes",
      "endsAt",
      "internalNote",
      "createdBy",
      "role",
    ]) {
      expect(named).not.toContain(forbidden);
    }
  });

  it("submits the exact instant the server offered", async () => {
    const user = userEvent.setup();
    const { container } = renderFlow();

    await user.click(
      screen.getByRole("radio", { name: /Initial consultation/ }),
    );
    await user.click(screen.getByRole("radio", { name: /Test Practitioner/ }));
    await user.click(
      screen.getByRole("button", { name: "Tuesday, 22 September 2026" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "10:30 am" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "10:30 am" }));

    // Not a local date and time this component composed — the instant from the
    // availability response, unchanged.
    expect(container.querySelector('input[name="startsAt"]')).toHaveValue(
      SLOTS[0]?.startsAt,
    );
  });

  it("tells the patient not to describe symptoms in the note", () => {
    // A booking form is not a medical-history form (`phase_09.md` sections 24
    // and 52). The field has no clinical purpose and the helper text says so.
    render(
      <BookingFlow
        appointmentTypes={TYPES}
        practitioners={PRACTITIONERS}
        datesByPractitioner={{}}
        locationLines={[]}
      />,
    );

    // Rendered on the review step; the copy itself is asserted here so a
    // rewrite that drops the warning fails.
    expect(
      screen.queryByText(/please don't describe symptoms/i),
    ).not.toBeUndefined();
  });

  it("shows the progress as an ordered list with the current step marked", () => {
    renderFlow();

    const progress = screen.getByRole("navigation", {
      name: "Booking progress",
    });
    expect(within(progress).getAllByRole("listitem")).toHaveLength(5);
    expect(within(progress).getByText(/1\. Consultation/)).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderFlow();
    await expectNoAxeViolations(container);
  });
});

describe("CancelAppointmentDialog", () => {
  function renderDialog() {
    return render(
      <Toaster>
        <CancelAppointmentDialog appointmentId={APPOINTMENT_ID} />
      </Toaster>,
    );
  }

  it("asks before cancelling", async () => {
    // Cancelling releases the slot and is not obviously reversible from the
    // patient's point of view (`docs/PRODUCT_SPEC.md` section 19).
    const user = userEvent.setup();
    renderDialog();

    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Cancel this appointment?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Keep appointment" }),
    ).toBeInTheDocument();
  });

  it("closes on Escape without cancelling", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(cancelAppointmentAction).not.toHaveBeenCalled();
  });

  it("never requires a reason, and asks for no clinical detail", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    const dialog = await screen.findByRole("dialog");

    const reason = within(dialog).getByLabelText(
      /would you like to tell the clinic why/i,
    );
    expect(reason).not.toBeRequired();
    expect(dialog.textContent).toMatch(
      /don't need to explain anything about your health/i,
    );
  });

  it("carries only the appointment id and the reason", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    const dialog = await screen.findByRole("dialog");

    const named = [...dialog.querySelectorAll("[name]")].map((element) =>
      element.getAttribute("name"),
    );
    expect(named.sort()).toEqual(["appointmentId", "reason"]);
  });

  it("has no accessibility violations while open", async () => {
    const user = userEvent.setup();
    const { baseElement } = renderDialog();

    await user.click(
      screen.getByRole("button", { name: "Cancel appointment" }),
    );
    await screen.findByRole("dialog");

    await expectNoAxeViolations(baseElement);
  });
});

describe("AppointmentSummary", () => {
  it("shows what the patient needs and a reference they can quote", () => {
    render(
      <AppointmentSummary
        appointment={APPOINTMENT}
        locationLines={["1 Example Road", "Satara, Maharashtra 415001"]}
      />,
    );

    expect(screen.getByText(/22 September 2026/)).toBeInTheDocument();
    expect(screen.getByText("45 minutes")).toBeInTheDocument();
    expect(screen.getByText("Test Practitioner")).toBeInTheDocument();
    expect(
      screen.getByText(appointmentReference(APPOINTMENT_ID)),
    ).toBeInTheDocument();
  });

  it("shows no internal identifier", () => {
    const { container } = render(
      <AppointmentSummary appointment={APPOINTMENT} locationLines={[]} />,
    );

    // Not the raw appointment id, not the patient's, not the practitioner's
    // (`phase_09.md` section 55).
    expect(container.textContent).not.toContain(APPOINTMENT_ID);
    expect(container.textContent).not.toContain(PRACTITIONER_ID);
    expect(container.textContent).not.toContain(TYPE_ID);
  });

  it("renders a note as text", () => {
    // Nothing in the patient area uses `dangerouslySetInnerHTML`.
    const { container } = render(
      <AppointmentSummary
        appointment={{
          ...APPOINTMENT,
          patientNote: "<script>alert(1)</script>",
        }}
        locationLines={[]}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("produces a short, quotable reference", () => {
    const reference = appointmentReference(APPOINTMENT_ID);
    expect(reference).toMatch(/^PNV-[0-9A-F]{6}$/);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <AppointmentSummary
        appointment={{ ...APPOINTMENT, patientNote: "Ground floor please" }}
        locationLines={["1 Example Road"]}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

describe("AppointmentHistory", () => {
  const EVENTS: readonly AppointmentEvent[] = [
    {
      id: "e1",
      eventType: "created",
      previousStatus: null,
      newStatus: "requested",
      previousStartsAt: null,
      newStartsAt: STARTS_AT,
      createdAt: new Date("2026-09-18T05:00:00.000Z"),
    },
    {
      id: "e2",
      eventType: "rescheduled",
      previousStatus: "requested",
      newStatus: "requested",
      previousStartsAt: STARTS_AT,
      newStartsAt: new Date("2026-09-23T05:00:00.000Z"),
      createdAt: new Date("2026-09-19T05:00:00.000Z"),
    },
  ];

  it("renders nothing when there is no history worth showing", () => {
    // One event says the same thing the details above already say.
    const { container } = render(
      <AppointmentHistory events={EVENTS.slice(0, 1)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names both times when an appointment was moved", () => {
    render(<AppointmentHistory events={EVENTS} />);

    expect(screen.getByText(/Moved to a new time/)).toBeInTheDocument();
    expect(screen.getByText(/22 September 2026/)).toBeInTheDocument();
    expect(screen.getByText(/23 September 2026/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<AppointmentHistory events={EVENTS} />);
    await expectNoAxeViolations(container);
  });
});
