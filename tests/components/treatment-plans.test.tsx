import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StartTreatmentPlan } from "@/components/treatment-plans/start-treatment-plan";
import { TreatmentPlanActions } from "@/components/treatment-plans/treatment-plan-actions";
import { TreatmentPlanBuilder } from "@/components/treatment-plans/treatment-plan-builder";
import { TreatmentPlanHistory } from "@/components/treatment-plans/treatment-plan-history";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status";
import { TreatmentPlanSections } from "@/components/treatment-plans/treatment-plan-summary";
import {
  TREATMENT_PLAN_BUILDER_COPY,
  TREATMENT_PLAN_HISTORY_COPY,
  TREATMENT_PLAN_STATUS_LABELS,
} from "@/features/treatment-plans/content";
import {
  EMPTY_TREATMENT_PLAN_ITEM,
  type TreatmentPlan,
  type TreatmentPlanItem,
  type TreatmentPlanSummary,
} from "@/features/treatment-plans/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The treatment plan builder's UI.
 *
 * The same contract as the prescription builder, plus the two things that are
 * specific to a plan:
 *
 *   * it is **grouped by section** — Diet, Lifestyle, Therapy, Follow-up,
 *     Other — rather than being one list or one blob (example 8), and an
 *     empty section is omitted rather than rendered as a heading with nothing
 *     under it;
 *   * the follow-up date **says it books nothing** (section 47), because a
 *     patient who believed it was a booking would miss their visit.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/doctor/appointments/x/treatment-plan",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const submissions: { action: string; data: FormData }[] = [];
let saveOutcome: Record<string, unknown> = { status: "saved", version: 3 };
let activateOutcome: Record<string, unknown> = {
  status: "activated",
  version: 4,
};

vi.mock("@/features/treatment-plans/actions", () => ({
  createTreatmentPlanAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "create", data });
    return { status: "saved" };
  },
  saveTreatmentPlanDraftAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "save", data });
    return { ...saveOutcome, savedAt: Date.now() };
  },
  activateTreatmentPlanAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "activate", data });
    return { ...activateOutcome, savedAt: Date.now() };
  },
  completeTreatmentPlanAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "complete", data });
    return { status: "completed", version: 4 };
  },
  cancelTreatmentPlanAction: async (_state: unknown, data: FormData) => {
    submissions.push({ action: "cancel", data });
    return { status: "cancelled", version: 4 };
  },
}));

const PLAN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PATIENT_ID = "22222222-2222-4222-8222-222222222222";

function planItem(
  overrides: Partial<TreatmentPlanItem> = {},
): TreatmentPlanItem {
  return {
    ...EMPTY_TREATMENT_PLAN_ITEM,
    id: "plan-item-1",
    sortOrder: 1,
    category: "diet",
    title: "Warm, freshly cooked food",
    instructions: "Avoid cold and leftover food.",
    frequency: "Every meal",
    duration: "1 month",
    ...overrides,
  };
}

function plan(overrides: Partial<TreatmentPlan> = {}): TreatmentPlan {
  return {
    id: PLAN_ID,
    clinicalRecordId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    appointmentId: "55555555-5555-4555-8555-555555555555",
    patientId: PATIENT_ID,
    practitionerId: "33333333-3333-4333-8333-333333333333",
    status: "draft",
    title: "Digestive care over the next month",
    summary: "",
    startDate: null,
    followUpOn: null,
    version: 2,
    activatedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-24T05:00:00.000Z"),
    updatedAt: new Date("2026-09-24T05:10:00.000Z"),
    items: [planItem()],
    ...overrides,
  };
}

beforeEach(() => {
  submissions.length = 0;
  saveOutcome = { status: "saved", version: 3 };
  activateOutcome = { status: "activated", version: 4 };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the builder's form", () => {
  it("is one form carrying exactly the seven fields the action reads", () => {
    const { container } = render(<TreatmentPlanBuilder plan={plan()} />);

    const forms = container.querySelectorAll("form");
    expect(forms).toHaveLength(1);

    const submitted = [...forms[0]!.querySelectorAll("[name]")]
      .map((node) => node.getAttribute("name"))
      .filter(
        (name): name is string =>
          name !== null && !name.includes("-plan-item-"),
      );

    expect(submitted.sort()).toEqual([
      "expectedVersion",
      "followUpOn",
      "items",
      "startDate",
      "summary",
      "title",
      "treatmentPlanId",
    ]);
  });

  it("carries no field that would be a claim about identity", () => {
    const { container } = render(<TreatmentPlanBuilder plan={plan()} />);

    const names = [...container.querySelectorAll("[name]")].map((node) =>
      node.getAttribute("name"),
    );

    for (const forbidden of [
      "patientId",
      "practitionerId",
      "appointmentId",
      "clinicalRecordId",
      "status",
      "role",
    ]) {
      expect(names, `the form carries ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("marks no control required, so an incomplete draft can be saved", async () => {
    const { container } = render(
      <TreatmentPlanBuilder plan={plan({ title: "", items: [] })} />,
    );

    expect(container.querySelectorAll("[required]")).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() => expect(submissions).toHaveLength(1));
  });

  it("says the follow-up date books nothing", () => {
    // Section 47, in the words a practitioner reads.
    render(<TreatmentPlanBuilder plan={plan()} />);

    expect(
      screen.getByText(/does not book an appointment/i),
    ).toBeInTheDocument();
  });

  it("offers the five sections and no medication section", () => {
    // Section 28: medicines belong on the prescription, and a `medication`
    // option here would be an invitation to write them twice.
    render(<TreatmentPlanBuilder plan={plan()} />);

    const select = screen.getByLabelText(
      TREATMENT_PLAN_BUILDER_COPY.categoryLabel,
    );
    const options = [...select.querySelectorAll("option")].map(
      (option) => option.textContent,
    );

    expect(options).toEqual([
      "Diet",
      "Lifestyle",
      "Therapy",
      "Follow-up",
      "Other instructions",
    ]);
    expect(options).not.toContain("Medication");
  });
});

describe("activation", () => {
  it("refuses while there are unsaved changes", async () => {
    render(<TreatmentPlanBuilder plan={plan()} />);

    await userEvent.type(
      screen.getByLabelText(TREATMENT_PLAN_BUILDER_COPY.titleLabel),
      "x",
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: TREATMENT_PLAN_BUILDER_COPY.activateLabel,
        }),
      ).toBeDisabled(),
    );

    expect(
      screen.getByText(TREATMENT_PLAN_BUILDER_COPY.reviewUnsavedTitle),
    ).toBeInTheDocument();
  });

  it("refuses a plan with no title, and says which thing is missing", () => {
    render(<TreatmentPlanBuilder plan={plan({ title: "" })} />);

    expect(
      screen.getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.activateLabel,
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(TREATMENT_PLAN_BUILDER_COPY.reviewBlockedNoTitle),
    ).toBeInTheDocument();
  });

  it("refuses a plan with no instructions", () => {
    render(<TreatmentPlanBuilder plan={plan({ items: [] })} />);

    expect(
      screen.getByText(TREATMENT_PLAN_BUILDER_COPY.reviewBlockedNoItems),
    ).toBeInTheDocument();
  });

  it("asks first, and sends only an id and a revision", async () => {
    render(<TreatmentPlanBuilder plan={plan({ version: 6 })} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.activateLabel,
      }),
    );

    // Nothing sent yet.
    expect(submissions).toHaveLength(0);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.activateDialogConfirm,
      }),
    );

    await waitFor(() =>
      expect(submissions.some((entry) => entry.action === "activate")).toBe(
        true,
      ),
    );

    const activate = submissions.find((entry) => entry.action === "activate")!;
    expect([...activate.data.keys()].sort()).toEqual([
      "expectedVersion",
      "treatmentPlanId",
    ]);
    expect(activate.data.get("expectedVersion")).toBe("6");
  });

  it("says the plan becomes visible to the patient and can no longer be edited", async () => {
    render(<TreatmentPlanBuilder plan={plan()} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.activateLabel,
      }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        /visible to the patient and can no longer be edited/i,
      ),
    ).toBeInTheDocument();
  });
});

describe("the save state", () => {
  it("never says saved when the server refused", async () => {
    saveOutcome = { status: "error", message: "We couldn't save that." };

    render(<TreatmentPlanBuilder plan={plan()} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", {
          name: TREATMENT_PLAN_BUILDER_COPY.statusRegionLabel,
        }),
      ).toHaveTextContent(TREATMENT_PLAN_BUILDER_COPY.statusFailed),
    );

    expect(screen.queryByText(/^Saved at/)).toBeNull();
  });

  it("stops offering to save after a conflict", async () => {
    saveOutcome = {
      status: "conflict",
      message: "This treatment plan was updated somewhere else.",
    };

    render(<TreatmentPlanBuilder plan={plan()} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.saveDraftLabel,
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: TREATMENT_PLAN_BUILDER_COPY.saveDraftLabel,
        }),
      ).toBeDisabled(),
    );
  });
});

describe("a rendered plan", () => {
  it("groups instructions by section", () => {
    render(
      <TreatmentPlanSections
        items={[
          planItem({ category: "diet", title: "Warm food" }),
          planItem({ id: "2", category: "lifestyle", title: "Early nights" }),
        ]}
        emptyMessage="none"
      />,
    );

    expect(screen.getByRole("heading", { name: "Diet" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lifestyle" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Therapy" })).toBeNull();
  });

  it("omits an empty section rather than rendering a bare heading", () => {
    // A heading with nothing under it reads as something the practitioner
    // forgot.
    render(
      <TreatmentPlanSections
        items={[planItem({ category: "diet" })]}
        emptyMessage="none"
      />,
    );

    for (const section of ["Lifestyle", "Therapy", "Follow-up"]) {
      expect(screen.queryByRole("heading", { name: section })).toBeNull();
    }
  });

  it("renders as prose with no editable control", () => {
    render(<TreatmentPlanSections items={[planItem()]} emptyMessage="none" />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders markup in an instruction as text", () => {
    render(
      <TreatmentPlanSections
        items={[planItem({ instructions: "<img src=x onerror=alert(1)>" })]}
        emptyMessage="none"
      />,
    );

    expect(document.querySelector("img")).toBeNull();
    expect(
      screen.getByText(/<img src=x onerror=alert\(1\)>/),
    ).toBeInTheDocument();
  });
});

describe("closing an active plan", () => {
  it("offers completing and withdrawing, and both ask first", async () => {
    render(<TreatmentPlanActions planId={PLAN_ID} version={4} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.completeLabel,
      }),
    );

    expect(submissions).toHaveLength(0);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.completeDialogConfirm,
      }),
    );

    await waitFor(() =>
      expect(submissions.some((entry) => entry.action === "complete")).toBe(
        true,
      ),
    );
  });

  it("offers no way to edit it", () => {
    // Section 44: an active plan is what the patient was told to do.
    render(<TreatmentPlanActions planId={PLAN_ID} version={4} />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.saveDraftLabel,
      }),
    ).toBeNull();
  });
});

describe("the plan list", () => {
  const summary = (
    overrides: Partial<TreatmentPlanSummary> = {},
  ): TreatmentPlanSummary => ({
    id: PLAN_ID,
    appointmentId: "55555555-5555-4555-8555-555555555555",
    status: "active",
    title: "Digestive care over the next month",
    itemCount: 4,
    followUpOn: "2026-11-02",
    activatedAt: new Date("2026-09-24T05:00:00.000Z"),
    createdAt: new Date("2026-09-24T04:00:00.000Z"),
    practitionerName: null,
    ...overrides,
  });

  it("carries a title and a status, and no instruction text", () => {
    render(<TreatmentPlanHistory plans={[summary()]} patientId={PATIENT_ID} />);

    const text = document.body.textContent ?? "";

    for (const clinical of [
      "Warm, freshly cooked food",
      "Avoid cold",
      "Every meal",
    ]) {
      expect(text).not.toContain(clinical);
    }
  });

  it("names an untitled plan rather than showing an empty cell", () => {
    render(
      <TreatmentPlanHistory
        plans={[summary({ title: "" })]}
        patientId={PATIENT_ID}
      />,
    );

    expect(
      screen.getAllByText(TREATMENT_PLAN_HISTORY_COPY.untitled).length,
    ).toBeGreaterThan(0);
  });

  it("names the ordering in the caption, so it differs from the heading above it", () => {
    expect(TREATMENT_PLAN_HISTORY_COPY.caption).not.toBe(
      TREATMENT_PLAN_HISTORY_COPY.heading,
    );
    expect(TREATMENT_PLAN_HISTORY_COPY.caption).toMatch(/most recent first/i);
  });
});

describe("the status badge", () => {
  it("is never colour alone", () => {
    for (const status of [
      "draft",
      "active",
      "completed",
      "cancelled",
    ] as const) {
      const { unmount } = render(<TreatmentPlanStatusBadge status={status} />);

      expect(
        screen.getByText(TREATMENT_PLAN_STATUS_LABELS[status]),
      ).toBeInTheDocument();

      unmount();
    }
  });
});

describe("starting a plan", () => {
  it("carries the consultation id and nothing else", async () => {
    render(<StartTreatmentPlan clinicalRecordId="record-1" />);

    await userEvent.click(
      screen.getByRole("button", {
        name: TREATMENT_PLAN_BUILDER_COPY.startLabel,
      }),
    );

    await waitFor(() => expect(submissions).toHaveLength(1));

    expect([...submissions[0]!.data.keys()]).toEqual(["clinicalRecordId"]);
  });
});

describe("privacy", () => {
  it("writes nothing to browser storage and nothing to the URL", async () => {
    const before = window.location.href;

    render(<TreatmentPlanBuilder plan={plan()} />);

    await userEvent.type(
      screen.getByLabelText(TREATMENT_PLAN_BUILDER_COPY.itemTitleLabel),
      "Warm food",
    );

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(window.location.href).toBe(before);
  });
});

describe("accessibility", () => {
  it("has no violations in the builder", async () => {
    const { container } = render(<TreatmentPlanBuilder plan={plan()} />);

    await expectNoAxeViolations(container);
  });

  it("has no violations in a rendered plan", async () => {
    const { container } = render(
      <TreatmentPlanSections items={[planItem()]} emptyMessage="none" />,
    );

    await expectNoAxeViolations(container);
  });

  it("gives every control a real label", () => {
    const { container } = render(<TreatmentPlanBuilder plan={plan()} />);

    for (const control of container.querySelectorAll(
      "input, textarea, select",
    )) {
      if (control.getAttribute("type") === "hidden") continue;
      const id = control.getAttribute("id");
      expect(id, "a control with no id cannot be labelled").toBeTruthy();
      expect(
        container.querySelector(`label[for="${id}"]`),
        `no label for ${control.getAttribute("name")}`,
      ).not.toBeNull();
    }
  });
});
