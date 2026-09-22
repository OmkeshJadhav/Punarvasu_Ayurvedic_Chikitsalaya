import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrescriptionBuilder } from "@/components/prescriptions/prescription-builder";
import { PrescriptionHistory } from "@/components/prescriptions/prescription-history";
import { PrescriptionStatusBadge } from "@/components/prescriptions/prescription-status";
import {
  PrescriptionInstructions,
  PrescriptionItems,
} from "@/components/prescriptions/prescription-summary";
import { StartPrescription } from "@/components/prescriptions/start-prescription";
import {
  PRESCRIPTION_BUILDER_COPY,
  PRESCRIPTION_HISTORY_COPY,
  PRESCRIPTION_STATUS_LABELS,
} from "@/features/prescriptions/content";
import {
  EMPTY_PRESCRIPTION_ITEM,
  type Prescription,
  type PrescriptionItem,
  type PrescriptionSummary,
} from "@/features/prescriptions/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The prescription builder's UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * **the form carries exactly the four fields its action reads**, and
 *     nothing that would be a claim about identity — the regression guard for
 *     the class of defect Phase 07 shipped;
 *   * **no control is `required` in the HTML sense**, because a draft may be
 *     incomplete and the browser's own constraint validation would silently
 *     refuse to submit it. This is the defect the Phase 12 component suite
 *     found and nothing else could see;
 *   * **issuing is refused while there are unsaved changes**, so the review
 *     shows what will actually be issued (sections 15-16, example 3);
 *   * issuing asks first, and the dialog names what to check (section 15);
 *   * the save state never claims a save that did not happen (section 69);
 *   * an **issued** prescription renders as prose with no editable control;
 *   * markup in a medicine name renders as text, never as HTML;
 *   * a prescription list carries no clinical content at all;
 *   * **nothing reaches browser storage or a URL** (sections 82 and 83).
 *
 * None of this is a security control. Every action re-checks on the server
 * and the database refuses independently; these assertions are about the
 * experience, and about the UI not undermining the model.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/doctor/appointments/x/prescription",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const submissions: { action: string; data: FormData }[] = [];
let saveOutcome: Record<string, unknown> = { status: "saved", version: 4 };
let issueOutcome: Record<string, unknown> = { status: "issued", version: 5 };
let suggestions: { medicineName: string; form: string }[] = [];
const suggestionQueries: string[] = [];

vi.mock("@/features/prescriptions/actions", () => ({
  createPrescriptionAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "create", data });
    return { status: "saved" };
  },
  savePrescriptionDraftAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "save", data });
    return { ...saveOutcome, savedAt: Date.now() };
  },
  issuePrescriptionAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "issue", data });
    return { ...issueOutcome, savedAt: Date.now() };
  },
  cancelPrescriptionAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "cancel", data });
    return { status: "cancelled" };
  },
  suggestMedicinesAction: async (query: string) => {
    suggestionQueries.push(query);
    return suggestions;
  },
}));

const PRESCRIPTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";

function item(overrides: Partial<PrescriptionItem> = {}): PrescriptionItem {
  return {
    ...EMPTY_PRESCRIPTION_ITEM,
    id: "item-1",
    sortOrder: 1,
    medicineName: "Ashwagandha churna",
    form: "Churna",
    doseAmount: "1",
    doseUnit: "teaspoon",
    frequency: "Twice daily",
    timing: "After meals",
    duration: "2 weeks",
    ...overrides,
  };
}

function prescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: PRESCRIPTION_ID,
    clinicalRecordId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    appointmentId: "55555555-5555-4555-8555-555555555555",
    patientId: PATIENT_ID,
    practitionerId: "33333333-3333-4333-8333-333333333333",
    status: "draft",
    generalInstructions: "",
    version: 3,
    issuedAt: null,
    cancelledAt: null,
    cancellationReason: "",
    createdAt: new Date("2026-09-24T05:00:00.000Z"),
    updatedAt: new Date("2026-09-24T05:10:00.000Z"),
    items: [item()],
    ...overrides,
  };
}

beforeEach(() => {
  submissions.length = 0;
  suggestionQueries.length = 0;
  suggestions = [];
  saveOutcome = { status: "saved", version: 4 };
  issueOutcome = { status: "issued", version: 5 };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the builder's form", () => {
  it("is one form carrying exactly the four fields the action reads", () => {
    const { container } = render(
      <PrescriptionBuilder prescription={prescription()} />,
    );

    // One form. A nested one is how Phase 07 shipped a profile that submitted
    // by GET with the patient's details in the query string.
    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);

    const hidden = [...forms[0]!.querySelectorAll('input[type="hidden"]')].map(
      (input) => input.getAttribute("name"),
    );

    expect(hidden.sort()).toEqual([
      "expectedVersion",
      "items",
      "prescriptionId",
    ]);
  });

  it("carries no field that would be a claim about identity", () => {
    const { container } = render(
      <PrescriptionBuilder prescription={prescription()} />,
    );

    const names = [...container.querySelectorAll("[name]")].map((node) =>
      node.getAttribute("name"),
    );

    for (const forbidden of [
      "patientId",
      "practitionerId",
      "doctorId",
      "appointmentId",
      "clinicalRecordId",
      "status",
      "role",
    ]) {
      expect(names, `the form carries ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("marks no control required, so an incomplete draft can be saved", async () => {
    // **The Phase 12 defect, guarded here from the start.** `Field` sets the
    // HTML `required` attribute; with it on, the browser's own constraint
    // validation silently refuses to submit — which is precisely the state a
    // draft exists to hold.
    const { container } = render(
      <PrescriptionBuilder prescription={prescription({ items: [] })} />,
    );

    expect(container.querySelectorAll("[required]")).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() => expect(submissions).toHaveLength(1));
    expect(submissions[0]?.action).toBe("save");
  });

  it("serialises the items as JSON, dropping entirely blank rows", async () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    // "Add another" leaves an empty card, which must not become an error the
    // doctor has to clear before saving.
    await userEvent.click(
      screen.getByRole("button", {
        name: new RegExp(PRESCRIPTION_BUILDER_COPY.addItemLabel, "i"),
      }),
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() => expect(submissions).toHaveLength(1));

    const items = JSON.parse(
      String(submissions[0]?.data.get("items")),
    ) as unknown[];

    expect(items).toHaveLength(1);
  });

  it("sends the revision it was editing", async () => {
    render(<PrescriptionBuilder prescription={prescription({ version: 7 })} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() => expect(submissions).toHaveLength(1));
    expect(submissions[0]?.data.get("expectedVersion")).toBe("7");
  });
});

describe("adding, removing and reordering", () => {
  it("adds an item", async () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    expect(screen.getAllByRole("group")).toHaveLength(1);

    await userEvent.click(
      screen.getByRole("button", {
        name: new RegExp(PRESCRIPTION_BUILDER_COPY.addItemLabel, "i"),
      }),
    );

    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  it("removes an item, and never leaves nothing to type into", async () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: /remove ashwagandha churna/i,
      }),
    );

    // One empty card remains: a builder with no cards has no way back.
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(
      screen.getByLabelText(PRESCRIPTION_BUILDER_COPY.medicineLabel),
    ).toHaveValue("");
  });

  it("reorders items, and says which one is moving", async () => {
    render(
      <PrescriptionBuilder
        prescription={prescription({
          items: [
            item({ id: "a", medicineName: "Ashwagandha" }),
            item({ id: "b", sortOrder: 2, medicineName: "Triphala" }),
          ],
        })}
      />,
    );

    // The accessible name names the medicine, not "row 2" — a screen-reader
    // user reordering a prescription needs to know what they are moving.
    await userEvent.click(
      screen.getByRole("button", { name: /move triphala up/i }),
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() => expect(submissions).toHaveLength(1));

    const items = JSON.parse(String(submissions[0]?.data.get("items"))) as {
      medicineName: string;
    }[];

    expect(items.map((entry) => entry.medicineName)).toEqual([
      "Triphala",
      "Ashwagandha",
    ]);
  });

  it("disables moving the first item up and the last one down", () => {
    render(
      <PrescriptionBuilder
        prescription={prescription({
          items: [
            item({ id: "a", medicineName: "Ashwagandha" }),
            item({ id: "b", sortOrder: 2, medicineName: "Triphala" }),
          ],
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: /move ashwagandha up/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /move triphala down/i }),
    ).toBeDisabled();
  });
});

describe("the save state", () => {
  it("starts idle and becomes dirty when something is typed", async () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    // Scoped by name: the medicine combobox has a live region of its own, and
    // an unscoped query would be asking "which status?".
    expect(
      screen.getByRole("status", {
        name: PRESCRIPTION_BUILDER_COPY.statusRegionLabel,
      }),
    ).toHaveTextContent(PRESCRIPTION_BUILDER_COPY.statusIdle);

    await userEvent.type(
      screen.getByLabelText(PRESCRIPTION_BUILDER_COPY.medicineLabel),
      "x",
    );

    await waitFor(() =>
      expect(
        screen.getByText(PRESCRIPTION_BUILDER_COPY.statusDirty),
      ).toBeInTheDocument(),
    );
  });

  it("never says saved when the server refused", async () => {
    saveOutcome = { status: "error", message: "We couldn't save that." };

    render(<PrescriptionBuilder prescription={prescription()} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", {
          name: PRESCRIPTION_BUILDER_COPY.statusRegionLabel,
        }),
      ).toHaveTextContent(PRESCRIPTION_BUILDER_COPY.statusFailed),
    );

    expect(screen.queryByText(/^Saved at/)).toBeNull();
  });

  it("stops offering to save after a conflict, and asks for a reload", async () => {
    // Saving again would perform exactly the overwrite the refusal prevented.
    saveOutcome = {
      status: "conflict",
      message: "This prescription was updated somewhere else.",
    };

    render(<PrescriptionBuilder prescription={prescription()} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: PRESCRIPTION_BUILDER_COPY.saveDraftLabel,
        }),
      ).toBeDisabled(),
    );

    expect(screen.getByText(/updated somewhere else/i)).toBeInTheDocument();
  });
});

describe("review and issue", () => {
  it("refuses to issue while there are unsaved changes, and says why", async () => {
    // **The property that keeps the review honest.** `issue_prescription`
    // takes no content, so anything unsaved would be silently left out.
    render(<PrescriptionBuilder prescription={prescription()} />);

    await userEvent.type(
      screen.getByLabelText(PRESCRIPTION_BUILDER_COPY.medicineLabel),
      "x",
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: PRESCRIPTION_BUILDER_COPY.issueLabel,
        }),
      ).toBeDisabled(),
    );

    expect(
      screen.getByText(PRESCRIPTION_BUILDER_COPY.reviewUnsavedTitle),
    ).toBeInTheDocument();
  });

  it("refuses to issue a prescription with nothing in it", () => {
    render(<PrescriptionBuilder prescription={prescription({ items: [] })} />);

    expect(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.issueLabel,
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(PRESCRIPTION_BUILDER_COPY.reviewEmptyTitle),
    ).toBeInTheDocument();
  });

  it("shows the saved prescription in the review, not the unsaved edits", async () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    const review = screen.getByRole("region", {
      name: PRESCRIPTION_BUILDER_COPY.reviewHeading,
    });

    expect(within(review).getByText(/Ashwagandha churna/)).toBeInTheDocument();

    await userEvent.clear(
      screen.getByLabelText(PRESCRIPTION_BUILDER_COPY.medicineLabel),
    );
    await userEvent.type(
      screen.getByLabelText(PRESCRIPTION_BUILDER_COPY.medicineLabel),
      "Something else",
    );

    // Still the saved one, because that is what would be issued.
    expect(within(review).queryByText(/Something else/)).toBeNull();
  });

  it("asks before issuing, and names what to check", async () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.issueLabel,
      }),
    );

    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText(PRESCRIPTION_BUILDER_COPY.issueDialogTitle),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/dosage, frequency and duration/i),
    ).toBeInTheDocument();

    // Nothing has been sent yet.
    expect(submissions).toHaveLength(0);
  });

  it("sends only an id and a revision when it does issue", async () => {
    render(<PrescriptionBuilder prescription={prescription({ version: 9 })} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.issueLabel,
      }),
    );

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.issueDialogConfirm,
      }),
    );

    await waitFor(() =>
      expect(submissions.some((entry) => entry.action === "issue")).toBe(true),
    );

    const issue = submissions.find((entry) => entry.action === "issue")!;
    expect([...issue.data.keys()].sort()).toEqual([
      "expectedVersion",
      "prescriptionId",
    ]);
    expect(issue.data.get("expectedVersion")).toBe("9");
  });

  it("asks before withdrawing, and offers a reason the patient will see", async () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.cancelLabel,
      }),
    );

    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByLabelText(
        PRESCRIPTION_BUILDER_COPY.cancelReasonLabel,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/the patient will see it/i),
    ).toBeInTheDocument();
  });
});

describe("the medicine autocomplete", () => {
  it("is a combobox, not a plain input", () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    const input = screen.getByLabelText(
      PRESCRIPTION_BUILDER_COPY.medicineLabel,
    );

    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("debounces, so it does not query on every keystroke", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    suggestions = [{ medicineName: "Ashwagandha churna", form: "Churna" }];

    render(<PrescriptionBuilder prescription={prescription({ items: [] })} />);

    const input = screen.getByLabelText(
      PRESCRIPTION_BUILDER_COPY.medicineLabel,
    );

    await userEvent.type(input, "Ash");

    // Nothing yet — the timer has not fired.
    expect(suggestionQueries).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(300);

    // One query for three keystrokes, and it carries the latest term.
    expect(suggestionQueries).toEqual(["Ash"]);

    vi.useRealTimers();
  });

  it("offers what came back, and accepts a pick", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    suggestions = [{ medicineName: "Ashwagandha churna", form: "Churna" }];

    render(<PrescriptionBuilder prescription={prescription({ items: [] })} />);

    const input = screen.getByLabelText(
      PRESCRIPTION_BUILDER_COPY.medicineLabel,
    );

    await userEvent.type(input, "Ash");
    await vi.advanceTimersByTimeAsync(300);

    const option = await screen.findByRole("option", {
      name: /Ashwagandha churna/,
    });

    await userEvent.click(option);

    expect(input).toHaveValue("Ashwagandha churna");
    // The form it was last used with, offered because the field was empty.
    expect(screen.getByLabelText("Form")).toHaveValue("Churna");

    vi.useRealTimers();
  });

  it("finds nothing for an empty field, and offers no list", async () => {
    render(<PrescriptionBuilder prescription={prescription({ items: [] })} />);

    const input = screen.getByLabelText(
      PRESCRIPTION_BUILDER_COPY.medicineLabel,
    );

    await userEvent.type(input, "a");
    await userEvent.clear(input);

    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});

describe("an issued prescription", () => {
  it("renders as prose with no editable control", () => {
    render(
      <PrescriptionItems items={[item()]} emptyMessage="Nothing prescribed." />,
    );

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Ashwagandha churna/)).toBeInTheDocument();
  });

  it("shows the dose, frequency, timing and duration as facts", () => {
    render(<PrescriptionItems items={[item()]} emptyMessage="none" />);

    expect(screen.getByText("Dose")).toBeInTheDocument();
    expect(screen.getByText("1 teaspoon")).toBeInTheDocument();
    expect(screen.getByText("Twice daily")).toBeInTheDocument();
    expect(screen.getByText("2 weeks")).toBeInTheDocument();
  });

  it("omits a fact that was never recorded", () => {
    render(
      <PrescriptionItems
        items={[{ ...EMPTY_PRESCRIPTION_ITEM, medicineName: "Shirodhara" }]}
        emptyMessage="none"
      />,
    );

    expect(screen.queryByText("Dose")).toBeNull();
    expect(screen.queryByText("Quantity")).toBeNull();
  });

  it("renders markup in a medicine name as text", () => {
    render(
      <PrescriptionItems
        items={[item({ medicineName: "<script>alert(1)</script>" })]}
        emptyMessage="none"
      />,
    );

    expect(document.querySelector("script")).toBeNull();
    expect(
      screen.getByText(/<script>alert\(1\)<\/script>/),
    ).toBeInTheDocument();
  });

  it("omits the whole instructions block when there are none", () => {
    const { container } = render(
      <PrescriptionInstructions heading="Instructions" instructions="   " />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("the prescription list", () => {
  const summary = (
    overrides: Partial<PrescriptionSummary> = {},
  ): PrescriptionSummary => ({
    id: PRESCRIPTION_ID,
    appointmentId: "55555555-5555-4555-8555-555555555555",
    status: "issued",
    itemCount: 3,
    issuedAt: new Date("2026-09-24T05:00:00.000Z"),
    cancelledAt: null,
    createdAt: new Date("2026-09-24T04:00:00.000Z"),
    updatedAt: new Date("2026-09-24T05:00:00.000Z"),
    practitionerName: null,
    ...overrides,
  });

  it("carries no clinical content at all", () => {
    render(
      <PrescriptionHistory
        prescriptions={[summary()]}
        patientId={PATIENT_ID}
      />,
    );

    const text = document.body.textContent ?? "";

    for (const clinical of [
      "Ashwagandha",
      "teaspoon",
      "Twice daily",
      "After meals",
    ]) {
      expect(text).not.toContain(clinical);
    }

    expect(screen.getAllByText(/3 items/)).not.toHaveLength(0);
  });

  it("names the ordering in the caption, so it differs from a heading above it", () => {
    // The `landmark-unique` collision Phase 11 found with a real browser and
    // jsdom could not see: a labelled scroll region with the same accessible
    // name as the section around it.
    expect(PRESCRIPTION_HISTORY_COPY.caption).not.toBe(
      PRESCRIPTION_HISTORY_COPY.heading,
    );
    expect(PRESCRIPTION_HISTORY_COPY.caption).toMatch(/most recent first/i);
  });

  it("links to the prescription, with a name that says which one", () => {
    render(
      <PrescriptionHistory
        prescriptions={[summary()]}
        patientId={PATIENT_ID}
      />,
    );

    const links = screen.getAllByRole("link", {
      name: new RegExp(PRESCRIPTION_HISTORY_COPY.viewLabel, "i"),
    });

    expect(links[0]).toHaveAttribute(
      "href",
      `/doctor/patients/${PATIENT_ID}/prescriptions/${PRESCRIPTION_ID}`,
    );
  });
});

describe("the status badge", () => {
  it("is never colour alone", () => {
    for (const status of ["draft", "issued", "cancelled", "amended"] as const) {
      const { unmount } = render(<PrescriptionStatusBadge status={status} />);

      expect(
        screen.getByText(PRESCRIPTION_STATUS_LABELS[status]),
      ).toBeInTheDocument();

      unmount();
    }
  });

  it("calls a cancelled prescription withdrawn", () => {
    // The word a practitioner and a patient both use about a prescription.
    render(<PrescriptionStatusBadge status="cancelled" />);

    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
  });
});

describe("starting a prescription", () => {
  it("carries the consultation id and nothing else", async () => {
    render(<StartPrescription clinicalRecordId="record-1" />);

    await userEvent.click(
      screen.getByRole("button", {
        name: PRESCRIPTION_BUILDER_COPY.startLabel,
      }),
    );

    await waitFor(() => expect(submissions).toHaveLength(1));

    expect([...submissions[0]!.data.keys()]).toEqual(["clinicalRecordId"]);
  });
});

describe("privacy", () => {
  it("writes nothing to browser storage", async () => {
    render(<PrescriptionBuilder prescription={prescription()} />);

    await userEvent.type(
      screen.getByLabelText(PRESCRIPTION_BUILDER_COPY.medicineLabel),
      "Ashwagandha",
    );

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("puts nothing in the URL", async () => {
    const before = window.location.href;

    render(<PrescriptionBuilder prescription={prescription()} />);

    await userEvent.type(
      screen.getByLabelText(PRESCRIPTION_BUILDER_COPY.medicineLabel),
      "Ashwagandha",
    );

    expect(window.location.href).toBe(before);
    expect(window.location.search).not.toContain("Ashwagandha");
  });

  it("keeps the browser's own saved values out of every clinical field", () => {
    // A shared consulting-room machine must not offer the previous patient's
    // medicine back to the next one.
    const { container } = render(
      <PrescriptionBuilder prescription={prescription()} />,
    );

    for (const control of container.querySelectorAll("input, textarea")) {
      if (control.getAttribute("type") === "hidden") continue;
      expect(control.getAttribute("autocomplete")).toBe("off");
    }
  });
});

describe("accessibility", () => {
  it("has no violations in the builder", async () => {
    const { container } = render(
      <PrescriptionBuilder prescription={prescription()} />,
    );

    await expectNoAxeViolations(container);
  });

  it("has no violations in a rendered prescription", async () => {
    const { container } = render(
      <PrescriptionItems items={[item()]} emptyMessage="none" />,
    );

    await expectNoAxeViolations(container);
  });

  it("has no violations in the history list", async () => {
    const { container } = render(
      <PrescriptionHistory
        prescriptions={[
          {
            id: PRESCRIPTION_ID,
            appointmentId: "a",
            status: "issued",
            itemCount: 2,
            issuedAt: new Date("2026-09-24T05:00:00.000Z"),
            cancelledAt: null,
            createdAt: new Date("2026-09-24T04:00:00.000Z"),
            updatedAt: new Date("2026-09-24T05:00:00.000Z"),
            practitionerName: null,
          },
        ]}
        patientId={PATIENT_ID}
      />,
    );

    await expectNoAxeViolations(container);
  });

  it("gives every clinical control a real label", () => {
    const { container } = render(
      <PrescriptionBuilder prescription={prescription()} />,
    );

    for (const control of container.querySelectorAll("input, textarea")) {
      if (control.getAttribute("type") === "hidden") continue;
      expect(
        control.getAttribute("id"),
        "a control with no id cannot be labelled",
      ).toBeTruthy();
      expect(
        container.querySelector(`label[for="${control.getAttribute("id")}"]`),
        `no label for ${control.getAttribute("name")}`,
      ).not.toBeNull();
    }
  });
});
