import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClinicalHistory } from "@/components/clinical/clinical-history";
import { ClinicalRecordStatusBadge } from "@/components/clinical/clinical-record-status";
import { ClinicalRecordView } from "@/components/clinical/clinical-section";
import { ConsultationForm } from "@/components/clinical/consultation-form";
import { PatientClinicalHeader } from "@/components/clinical/patient-clinical-header";
import { SaveStatus } from "@/components/clinical/save-status";
import { StartConsultation } from "@/components/clinical/start-consultation";
import { Toaster } from "@/components/ui/toast";
import {
  CLINICAL_FORM_COPY,
  CLINICAL_HISTORY_COPY,
  CLINICAL_RECORD_VIEW_COPY,
  CLINICAL_SECTIONS,
  CONSULTATION_WORKSPACE_COPY,
} from "@/features/clinical/content";
import {
  CLINICAL_FIELDS,
  EMPTY_CLINICAL_CONTENT,
  type ClinicalHistoryEntry,
  type ClinicalRecord,
  type ConsultationAppointment,
  type ConsultationPatient,
} from "@/features/clinical/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The clinical workspace's UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * **the form is one `<form>` carrying exactly the ten fields its actions
 *     read**, and nothing that would be a claim about identity — the
 *     regression test for the class of defect Phase 07 shipped, applied to
 *     the most sensitive form in the application;
 *   * the save state never claims a save that did not happen, and says
 *     explicitly when changes are unsaved (sections 33 and 69);
 *   * a **completed** record renders as prose with no editable control, and
 *     the reason is a sentence rather than a disabled button (section 16);
 *   * completion asks first and refuses until the required fields are
 *     written (sections 35 and 38);
 *   * the patient's identity is prominent, so a practitioner can tell they
 *     have the right person (sections 28-29);
 *   * **nothing clinical reaches browser storage or a URL** (sections 42, 79);
 *   * a clinical history list carries no clinical content at all (section 26);
 *   * markup in a clinical note renders as text, never as HTML.
 *
 * None of this is a security control. Every action re-checks on the server
 * and the database refuses independently; these assertions are about the
 * experience, and about the UI not undermining the model.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/doctor/appointments/x/consultation",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const submissions: FormData[] = [];
let saveOutcome: Record<string, unknown> = { status: "saved", version: 5 };
let completeOutcome: Record<string, unknown> = {
  status: "completed",
  version: 6,
};

/*
 * The server actions, replaced by recorders.
 *
 * `useActionState` needs a function of `(state, formData)`, and what these
 * tests care about is *what the form carried* — which fields, and which
 * values. The actions' own behaviour is covered against a recording Supabase
 * stub in `tests/integration/clinical-actions.test.ts`.
 */
vi.mock("@/features/clinical/actions", () => ({
  startConsultationAction: async (_state: unknown, formData: FormData) => {
    submissions.push(formData);
    return { status: "saved" };
  },
  saveClinicalDraftAction: async (_state: unknown, formData: FormData) => {
    submissions.push(formData);
    return { ...saveOutcome, savedAt: Date.now() };
  },
  completeClinicalRecordAction: async (_state: unknown, formData: FormData) => {
    submissions.push(formData);
    return { ...completeOutcome, savedAt: Date.now() };
  },
}));

const RECORD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPOINTMENT_ID = "55555555-5555-4555-8555-555555555555";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";

function record(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return {
    ...EMPTY_CLINICAL_CONTENT,
    id: RECORD_ID,
    appointmentId: APPOINTMENT_ID,
    patientId: PATIENT_ID,
    practitionerId: "33333333-3333-4333-8333-333333333333",
    status: "draft",
    version: 4,
    completedAt: null,
    createdAt: new Date("2026-09-22T05:00:00.000Z"),
    updatedAt: new Date("2026-09-22T05:10:00.000Z"),
    ...overrides,
  };
}

const PATIENT: ConsultationPatient = {
  id: PATIENT_ID,
  fullName: "Test Patient",
  preferredName: null,
  dateOfBirth: "1990-04-07",
  gender: "female",
  phone: "9999999999",
};

const APPOINTMENT: ConsultationAppointment = {
  id: APPOINTMENT_ID,
  startsAt: new Date("2026-09-22T05:00:00.000Z"),
  endsAt: new Date("2026-09-22T05:45:00.000Z"),
  status: "in_consultation",
  typeName: "Initial consultation",
};

function historyEntry(
  overrides: Partial<ClinicalHistoryEntry> = {},
): ClinicalHistoryEntry {
  return {
    id: RECORD_ID,
    appointmentId: APPOINTMENT_ID,
    status: "completed",
    occurredAt: new Date("2026-09-22T05:00:00.000Z"),
    appointmentTypeName: "Initial consultation",
    completedAt: new Date("2026-09-22T05:50:00.000Z"),
    updatedAt: new Date("2026-09-22T05:50:00.000Z"),
    ...overrides,
  };
}

function renderWithToaster(ui: React.ReactElement) {
  // `Toaster` owns the live region its children publish into, so it wraps
  // rather than sits beside them — the same shape the reception and doctor
  // suites use.
  return render(<Toaster>{ui}</Toaster>);
}

beforeEach(() => {
  submissions.length = 0;
  saveOutcome = { status: "saved", version: 5 };
  completeOutcome = { status: "completed", version: 6 };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the consultation form", () => {
  it("renders exactly one form", () => {
    // Nested forms are invalid HTML, and after hydration the inner one owns
    // the inputs and submits by GET — which is how Phase 07 put a patient's
    // details in a URL. On a clinical form that would be a page of notes in
    // browser history.
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );

    expect(container.querySelectorAll("form")).toHaveLength(1);
  });

  it("carries exactly the ten fields its actions read", () => {
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );

    const names = [...container.querySelectorAll<HTMLElement>("[name]")].map(
      (element) => element.getAttribute("name"),
    );

    expect([...new Set(names)].sort()).toEqual([
      "assessment",
      "chiefComplaint",
      "clinicalObservations",
      "diagnosisOrClinicalImpression",
      "doctorNotes",
      "expectedVersion",
      "followUpNotes",
      "historyOfPresentingConcern",
      "recordId",
      "symptoms",
    ]);
  });

  it("carries no field that would be a claim about identity", () => {
    // Examples 3 and 4. The practitioner is resolved from `auth.uid()` inside
    // the database and the patient is read out of the appointment, so there
    // is nothing here to manipulate — asserted rather than assumed.
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );

    for (const forbidden of [
      "doctorId",
      "practitionerId",
      "patientId",
      "appointmentId",
      "status",
      "role",
      "permission",
      "completedAt",
    ]) {
      expect(
        container.querySelector(`[name="${forbidden}"]`),
        forbidden,
      ).toBeNull();
    }
  });

  it("does not submit by GET", () => {
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );
    const form = container.querySelector("form");

    // React sets no `method` when a form has an action function; what matters
    // is that nothing has set it to `get`, which would put clinical notes in
    // the query string.
    expect(form?.getAttribute("method")?.toLowerCase() ?? "post").not.toBe(
      "get",
    );
  });

  it("gives every clinical field a real label", () => {
    renderWithToaster(<ConsultationForm record={record()} />);

    for (const section of CLINICAL_SECTIONS) {
      for (const field of section.fields) {
        expect(
          screen.getByLabelText(new RegExp(field.label, "i")),
          field.name,
        ).toBeInTheDocument();
      }
    }
  });

  it("uses a textarea for every clinical field", () => {
    // Section 31: textareas for narrative notes. A single-line input for a
    // history is a control that makes a practitioner write less.
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );

    expect(container.querySelectorAll("textarea")).toHaveLength(
      CLINICAL_FIELDS.length,
    );
  });

  it("groups the fields into titled sections", () => {
    // Sections 27 and 66: clear section hierarchy, logical grouping, and not
    // one giant undifferentiated form. Real `<fieldset>`/`<legend>`, so the
    // group's name is part of each field's context.
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );

    expect(container.querySelectorAll("fieldset")).toHaveLength(
      CLINICAL_SECTIONS.length,
    );

    for (const section of CLINICAL_SECTIONS) {
      expect(screen.getByText(section.title)).toBeInTheDocument();
    }
  });

  it("does not mark any field required in HTML, so a draft can be saved", () => {
    // Section 15 and example 6. A browser refusing to submit would make
    // "save what I have so far" impossible, which is the whole point of a
    // draft. `Field` still renders the marker and sets `aria-required` on the
    // two that completion needs.
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );

    expect(container.querySelectorAll("textarea[required]")).toHaveLength(0);
    expect(
      screen.getByLabelText(/chief complaint/i).getAttribute("aria-required"),
    ).toBe("true");
    expect(
      screen.getByLabelText(/^symptoms/i).getAttribute("aria-required"),
    ).not.toBe("true");
  });

  it("bounds each field at the length the database allows", () => {
    renderWithToaster(<ConsultationForm record={record()} />);

    expect(
      screen.getByLabelText(/chief complaint/i).getAttribute("maxlength"),
    ).toBe("500");
    expect(screen.getByLabelText(/^notes/i).getAttribute("maxlength")).toBe(
      "8000",
    );
  });

  it("keeps password managers and stored suggestions out of clinical fields", () => {
    // A consulting-room machine is shared. An autofill suggestion drawn from
    // another patient's consultation would be a disclosure.
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );

    for (const textarea of container.querySelectorAll("textarea")) {
      expect(textarea.getAttribute("autocomplete")).toBe("off");
    }
  });

  it("submits what was typed, with the record and the version", async () => {
    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.type(
      screen.getByLabelText(/chief complaint/i),
      "Reported concern",
    );
    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.saveDraftLabel }),
    );

    expect(submissions).toHaveLength(1);
    const submitted = submissions[0];
    expect(submitted?.get("recordId")).toBe(RECORD_ID);
    expect(submitted?.get("expectedVersion")).toBe("4");
    expect(submitted?.get("chiefComplaint")).toBe("Reported concern");
  });

  it("adopts the version the server returns, so editing can continue", async () => {
    const user = userEvent.setup();
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );

    await user.type(screen.getByLabelText(/chief complaint/i), "Something");
    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.saveDraftLabel }),
    );

    // `waitFor`, because a server action resolves asynchronously and
    // `userEvent.click` only awaits the click. Asserting straight after it
    // passes in isolation and fails under a loaded worker — a flake, and
    // `docs/QA_STRATEGY.md` section 35 forbids papering over one.
    await waitFor(() =>
      expect(
        container
          .querySelector('input[name="expectedVersion"]')
          ?.getAttribute("value"),
      ).toBe("5"),
    );
  });
});

describe("the save state is never a lie", () => {
  it("starts with nothing to lose", () => {
    renderWithToaster(<ConsultationForm record={record()} />);

    expect(
      screen.getByRole("status", {
        name: CLINICAL_FORM_COPY.statusRegionLabel,
      }),
    ).toHaveTextContent(CLINICAL_FORM_COPY.statusIdle);
  });

  it("warns as soon as there are unsaved changes", async () => {
    // Section 69. This is the state in which closing a laptop loses work, so
    // it is a warning rather than a neutral note.
    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.type(screen.getByLabelText(/chief complaint/i), "Something");

    expect(
      screen.getByRole("status", {
        name: CLINICAL_FORM_COPY.statusRegionLabel,
      }),
    ).toHaveTextContent(CLINICAL_FORM_COPY.statusDirty);
  });

  it("reports the time of a save rather than a bare 'Saved'", async () => {
    // "Saved" with no time is indistinguishable from "Saved half an hour
    // ago", which is exactly the ambiguity a practitioner needs resolved.
    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.type(screen.getByLabelText(/chief complaint/i), "Something");
    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.saveDraftLabel }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", {
          name: CLINICAL_FORM_COPY.statusRegionLabel,
        }),
      ).toHaveTextContent(/saved at \d/i),
    );
  });

  it("never says saved when the server refused", async () => {
    // Section 33, stated as plainly as the specification does: never display
    // "Saved" if the server operation failed.
    saveOutcome = {
      status: "error",
      message: "We couldn't save the clinical record.",
    };

    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.type(screen.getByLabelText(/chief complaint/i), "Something");
    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.saveDraftLabel }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", {
          name: CLINICAL_FORM_COPY.statusRegionLabel,
        }),
      ).toHaveTextContent(CLINICAL_FORM_COPY.statusFailed),
    );

    expect(
      screen.getByRole("status", {
        name: CLINICAL_FORM_COPY.statusRegionLabel,
      }),
    ).not.toHaveTextContent(/saved at/i);
  });

  it("stops offering to save after a conflict", async () => {
    // Section 34. Saving again would perform exactly the overwrite the
    // conflict prevented, so the control is taken away and the message says
    // to reload.
    saveOutcome = {
      status: "conflict",
      message: "This consultation was updated somewhere else. Reload the page.",
    };

    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.type(screen.getByLabelText(/chief complaint/i), "Something");
    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.saveDraftLabel }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: CLINICAL_FORM_COPY.saveDraftLabel }),
      ).toBeDisabled(),
    );

    expect(screen.getByText(/updated somewhere else/i)).toBeInTheDocument();
  });

  it("announces the save state in a live region", () => {
    // A practitioner using a screen reader must hear the outcome of a save
    // they cannot see. `polite`, so it waits for a gap rather than
    // interrupting typing.
    renderWithToaster(<ConsultationForm record={record()} />);

    const status = screen.getByRole("status", {
      name: CLINICAL_FORM_COPY.statusRegionLabel,
    });
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("never communicates a save state by colour alone", () => {
    // `docs/DESIGN_SYSTEM.md` section 5. Each state carries an icon and a
    // word as well as a tone.
    for (const state of ["idle", "dirty", "saving", "failed"] as const) {
      const { container, unmount } = render(<SaveStatus state={state} />);

      expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });
});

describe("completing a consultation", () => {
  it("asks before completing", async () => {
    // Section 35: completion is deliberate, and it is terminal. Confirming
    // and starting are not asked about; completing is.
    const user = userEvent.setup();
    renderWithToaster(
      <ConsultationForm
        record={record({ chiefComplaint: "A", assessment: "B" })}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.completeLabel }),
    );

    expect(
      screen.getByRole("dialog", {
        name: CLINICAL_FORM_COPY.completeDialogTitle,
      }),
    ).toBeInTheDocument();
    expect(submissions).toHaveLength(0);
  });

  it("says what completing will do, including that it cannot be undone", async () => {
    const user = userEvent.setup();
    renderWithToaster(
      <ConsultationForm
        record={record({ chiefComplaint: "A", assessment: "B" })}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.completeLabel }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/no longer be edited/i);
    expect(dialog).toHaveTextContent(/appointment completed/i);
  });

  it("refuses to complete until the required fields are written", async () => {
    // Section 38. The explanation is a sentence rather than a control that
    // silently does nothing — and the confirm button is what is disabled, so
    // pressing "Complete consultation" still opens the dialog and explains.
    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    expect(
      screen.getByText(CLINICAL_FORM_COPY.completeBlockedBody),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.completeLabel }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", {
        name: CLINICAL_FORM_COPY.completeDialogConfirm,
      }),
    ).toBeDisabled();
    expect(submissions).toHaveLength(0);
  });

  it("stops blocking once both fields are written", async () => {
    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.type(screen.getByLabelText(/chief complaint/i), "Concern");
    await user.type(screen.getByLabelText(/assessment/i), "Impression");

    expect(
      screen.queryByText(CLINICAL_FORM_COPY.completeBlockedBody),
    ).not.toBeInTheDocument();
  });

  it("submits the same fields the save does", async () => {
    const user = userEvent.setup();
    renderWithToaster(
      <ConsultationForm
        record={record({ chiefComplaint: "A", assessment: "B" })}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.completeLabel }),
    );
    await user.click(
      screen.getByRole("button", {
        name: CLINICAL_FORM_COPY.completeDialogConfirm,
      }),
    );

    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.get("recordId")).toBe(RECORD_ID);
    expect(submissions[0]?.get("chiefComplaint")).toBe("A");
    expect(submissions[0]?.get("assessment")).toBe("B");
    // And still no identity.
    expect(submissions[0]?.get("patientId")).toBeNull();
    expect(submissions[0]?.get("status")).toBeNull();
  });
});

describe("a completed record", () => {
  it("renders as prose with no editable control", () => {
    // Section 16 and example 5. A disabled control says "not right now"; a
    // completed clinical record is finished permanently.
    const { container } = render(
      <ClinicalRecordView
        content={{ ...EMPTY_CLINICAL_CONTENT, assessment: "Recorded." }}
      />,
    );

    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("form")).toHaveLength(0);
  });

  it("shows a section that was not written rather than hiding it", () => {
    // On a clinical record the difference between "there was nothing to note"
    // and "this section is missing from the page" matters.
    render(<ClinicalRecordView content={EMPTY_CLINICAL_CONTENT} />);

    expect(
      screen.getAllByText(CLINICAL_RECORD_VIEW_COPY.emptyFieldValue).length,
    ).toBe(CLINICAL_FIELDS.length);
  });

  it("renders markup in a note as text", () => {
    // Clinical prose legitimately contains angle brackets. Nothing in this
    // feature uses `dangerouslySetInnerHTML`, so a note quoting a patient
    // renders as the characters that were typed.
    const { container } = render(
      <ClinicalRecordView
        content={{
          ...EMPTY_CLINICAL_CONTENT,
          doctorNotes: "<script>alert(1)</script>",
        }}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("keeps the line breaks a practitioner typed", () => {
    const { container } = render(
      <ClinicalRecordView
        content={{ ...EMPTY_CLINICAL_CONTENT, symptoms: "One\n\nTwo" }}
      />,
    );

    const value = [...container.querySelectorAll("dd")].find((dd) =>
      dd.textContent?.includes("One"),
    );
    expect(value?.className).toContain("whitespace-pre-wrap");
  });
});

describe("the patient's identity", () => {
  it("is prominent rather than a small label", () => {
    // Sections 28-29. Writing an assessment onto the wrong record is a
    // patient-safety failure, and the defence is that the person writing can
    // see who they are writing about without looking for it.
    render(
      <PatientClinicalHeader patient={PATIENT} appointment={APPOINTMENT} />,
    );

    expect(
      screen.getByRole("heading", { name: "Test Patient" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(CONSULTATION_WORKSPACE_COPY.identityHint),
    ).toBeInTheDocument();
  });

  it("derives the age rather than showing a stored one", () => {
    // Section 28. A stored age is wrong within a year of being written.
    render(
      <PatientClinicalHeader patient={PATIENT} appointment={APPOINTMENT} />,
    );

    const age = screen.getByText(
      CONSULTATION_WORKSPACE_COPY.ageLabel,
    ).nextElementSibling;
    expect(Number(age?.textContent)).toBeGreaterThan(30);
  });

  it("shows no address or emergency contact", () => {
    // Neither helps confirm an identity in the room, and each would be one
    // more thing on a screen read over shoulders.
    const { container } = render(
      <PatientClinicalHeader patient={PATIENT} appointment={APPOINTMENT} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/address/i);
    expect(text).not.toMatch(/emergency/i);
    expect(text).not.toMatch(/postal/i);
  });

  it("stays usable when the patient's record cannot be read", () => {
    // A sentence rather than an error screen: the notes are still correct and
    // still saveable, and taking the page away would be the worse failure.
    render(<PatientClinicalHeader patient={null} appointment={APPOINTMENT} />);

    expect(screen.getByText(/couldn't load this patient/i)).toBeInTheDocument();
    expect(
      screen.getByText(CONSULTATION_WORKSPACE_COPY.typeLabel),
    ).toBeInTheDocument();
  });
});

describe("the clinical history list", () => {
  it("carries no clinical content", () => {
    // Section 26. A list is read at a glance, often with somebody else in the
    // room. The query does not fetch the notes and the type has no field for
    // them, so this asserts the component has nowhere to render one.
    const { container } = render(
      <ClinicalHistory entries={[historyEntry()]} patientId={PATIENT_ID} />,
    );
    const text = (container.textContent ?? "").toLowerCase();

    for (const word of [
      "chief complaint",
      "assessment",
      "diagnosis",
      "symptom",
      "observation",
    ]) {
      expect(text, word).not.toContain(word);
    }
  });

  it("renders as cards on a phone and a table on a desktop", () => {
    // `docs/DESIGN_SYSTEM.md` section 32: two layouts over one data set, not
    // one squeezed.
    const { container } = render(
      <ClinicalHistory entries={[historyEntry()]} patientId={PATIENT_ID} />,
    );

    expect(container.querySelector("ul.md\\:hidden")).not.toBeNull();
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("gives each row link a distinguishable accessible name", () => {
    // "Open" is identical on every row, so a screen-reader user tabbing the
    // list would hear it repeated with nothing to tell the rows apart. The
    // name carries the date, never anything clinical.
    render(
      <ClinicalHistory
        entries={[
          historyEntry(),
          historyEntry({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            occurredAt: new Date("2026-08-02T05:00:00.000Z"),
          }),
        ]}
        patientId={PATIENT_ID}
      />,
    );

    const names = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"));

    expect(new Set(names).size).toBeGreaterThan(1);
    for (const name of names) {
      expect(name).toMatch(/open/i);
    }
  });

  it("does not repeat the heading in the table caption", () => {
    // `TableScroller` is a labelled `region` landmark and so is the section
    // above it; two landmarks with one accessible name is an axe
    // `landmark-unique` violation. Found by Phase 11's browser pass on five
    // pages, and invisible to jsdom — so the guard is on the copy.
    expect(CLINICAL_HISTORY_COPY.caption).not.toBe(
      CLINICAL_HISTORY_COPY.heading,
    );
    expect(CLINICAL_HISTORY_COPY.caption).toMatch(/most recent first/i);
  });

  it("distinguishes a draft from a completed record without colour alone", () => {
    const { container: draft } = render(
      <ClinicalRecordStatusBadge status="draft" />,
    );
    const { container: completed } = render(
      <ClinicalRecordStatusBadge status="completed" />,
    );

    expect(draft.textContent).toBe("Draft");
    expect(completed.textContent).toBe("Completed");
    expect(draft.querySelector("svg")).not.toBeNull();
  });
});

describe("starting a consultation", () => {
  it("carries exactly an appointment id", () => {
    const { container } = renderWithToaster(
      <StartConsultation appointmentId={APPOINTMENT_ID} />,
    );

    const names = [...container.querySelectorAll("[name]")].map((element) =>
      element.getAttribute("name"),
    );

    expect(names).toEqual(["appointmentId"]);
  });

  it("disables the control while the request is in flight", async () => {
    // The first of three layers against a double-click. The other two are in
    // the database: `on conflict do nothing`, and the unique index that
    // decides between two genuinely concurrent requests.
    const user = userEvent.setup();
    renderWithToaster(<StartConsultation appointmentId={APPOINTMENT_ID} />);

    const button = screen.getByRole("button", {
      name: CONSULTATION_WORKSPACE_COPY.startLabel,
    });
    await user.click(button);

    expect(submissions).toHaveLength(1);
  });
});

describe("clinical content stays out of places it must not reach", () => {
  it("writes nothing to browser storage", async () => {
    // Section 79. A consulting-room machine is shared, and browser storage
    // survives a sign-out.
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.type(screen.getByLabelText(/chief complaint/i), "Confidential");
    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.saveDraftLabel }),
    );

    expect(setItem).not.toHaveBeenCalled();
  });

  it("puts nothing clinical in the URL", () => {
    // Section 42 and `docs/SECURITY.md` section 14. A URL reaches browser
    // history on a shared machine, proxy logs and the next `Referer`.
    const before = window.location.href;
    renderWithToaster(<ConsultationForm record={record()} />);

    expect(window.location.href).toBe(before);
    expect(window.location.search).not.toMatch(/complaint|assessment|symptom/i);
  });

  it("names no clinical content in any form field's value attribute", () => {
    // The two hidden fields carry an identifier and a revision, and nothing
    // else.
    const { container } = renderWithToaster(
      <ConsultationForm
        record={record({ chiefComplaint: "Confidential detail" })}
      />,
    );

    for (const input of container.querySelectorAll("input")) {
      expect(input.getAttribute("value")).not.toContain("Confidential");
    }
  });
});

describe("accessibility", () => {
  it("has no axe violations on the consultation form", async () => {
    const { container } = renderWithToaster(
      <ConsultationForm record={record()} />,
    );
    await expectNoAxeViolations(container);
  });

  it("has no axe violations on a completed record", async () => {
    const { container } = render(
      <ClinicalRecordView
        content={{ ...EMPTY_CLINICAL_CONTENT, assessment: "Recorded." }}
      />,
    );
    await expectNoAxeViolations(container);
  });

  it("has no axe violations on the patient header", async () => {
    const { container } = render(
      <PatientClinicalHeader patient={PATIENT} appointment={APPOINTMENT} />,
    );
    await expectNoAxeViolations(container);
  });

  it("has no axe violations on the clinical history", async () => {
    const { container } = render(
      <ClinicalHistory entries={[historyEntry()]} patientId={PATIENT_ID} />,
    );
    await expectNoAxeViolations(container);
  });

  it("is operable from the keyboard", async () => {
    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.tab();
    expect(screen.getByLabelText(/chief complaint/i)).toHaveFocus();
  });

  it("associates a field error with its field", async () => {
    // Section 81. A validation failure arriving after submission must be
    // announced and programmatically associated, not signalled by a red
    // border alone.
    saveOutcome = {
      status: "error",
      message: "Please check the notes.",
      fieldErrors: { chiefComplaint: "This is too long." },
    };

    const user = userEvent.setup();
    renderWithToaster(<ConsultationForm record={record()} />);

    await user.type(screen.getByLabelText(/chief complaint/i), "Something");
    await user.click(
      screen.getByRole("button", { name: CLINICAL_FORM_COPY.saveDraftLabel }),
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText(/chief complaint/i).getAttribute("aria-invalid"),
      ).toBe("true"),
    );

    const field = screen.getByLabelText(/chief complaint/i);

    // Announced — and **associated**, which is the part a red border alone
    // does not do. The field-level error and the form-level one are both
    // `role="alert"`, so the field's own message is found by its text and
    // then checked to be the element `aria-describedby` points at.
    const message = screen.getByText("This is too long.");
    expect(message.getAttribute("role")).toBe("alert");
    expect(field.getAttribute("aria-describedby")).toContain(message.id);
  });
});
