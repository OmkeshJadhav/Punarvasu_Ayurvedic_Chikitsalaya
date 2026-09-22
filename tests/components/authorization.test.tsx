import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UserAccessTable } from "@/components/admin/user-access-table";
import { AppNav } from "@/components/layout/app-nav";
import { APP_ROLES, ROLE_LABELS } from "@/config/permissions";
import { ADMIN_USERS_PAGE, FORBIDDEN_PAGE } from "@/features/admin/content";
import type { ManagedUser } from "@/features/admin/types";
import ForbiddenPage from "@/app/(app)/forbidden/page";

import { expectNoAxeViolations } from "../support/axe";

/**
 * Authorization UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * the forbidden page tells the user nothing about the privilege model —
 *     not their role, not the required role, not the permission. A refusal
 *     that describes the lock is a hint about the key (`phase_08.md` section
 *     12 and example 6);
 *   * navigation offers exactly the areas the role can enter, so nobody is
 *     sent to a page that will turn them away — and no link is invented for a
 *     workspace that does not exist (section 23);
 *   * the administrator's own row carries an explanation rather than a control
 *     with no reason;
 *   * nothing in the access table is communicated by colour alone.
 *
 * None of this is a security control. Every area guards itself on the server
 * and row-level security guards every table beneath it; these assertions are
 * about the experience, and about the UI not *undermining* the model by
 * describing it.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
}));

// The role control posts to a server action. Stubbing the action keeps this a
// test of the table and its rows; the action itself is driven end to end in
// `tests/integration/role-assignment.test.ts`.
vi.mock("@/features/admin/actions", () => ({
  assignRoleAction: vi.fn(async () => ({ status: "idle" as const })),
}));

const ADMIN_ID = "11111111-1111-4111-8111-1111111111ab";
const OTHER_ID = "22222222-2222-4222-8222-2222222222cd";

const USERS: readonly ManagedUser[] = [
  {
    id: ADMIN_ID,
    email: "admin@example.test",
    fullName: "Clinic Administrator",
    role: "admin",
    emailConfirmed: true,
    createdAt: "2026-09-01T10:00:00.000Z",
  },
  {
    id: OTHER_ID,
    email: "doctor@example.test",
    fullName: "Practitioner",
    role: "doctor",
    emailConfirmed: false,
    createdAt: "2026-09-02T10:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-3333333333ef",
    email: "new@example.test",
    fullName: null,
    role: null,
    emailConfirmed: false,
    createdAt: "2026-09-03T10:00:00.000Z",
  },
];

describe("the forbidden page", () => {
  it("says what happened and offers a way back", () => {
    render(<ForbiddenPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: FORBIDDEN_PAGE.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: FORBIDDEN_PAGE.accountAction }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: FORBIDDEN_PAGE.homeAction }),
    ).toBeInTheDocument();
  });

  it("describes neither the role held nor the role required", () => {
    const { container } = render(<ForbiddenPage />);
    const text = container.textContent ?? "";

    for (const role of APP_ROLES) {
      expect(text.toLowerCase()).not.toContain(role);
    }
    for (const term of ["permission required", "policy", "403", "forbidden"]) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });

  it("does not leak an internal identifier", () => {
    const { container } = render(<ForbiddenPage />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    expect(text).not.toContain("roles.manage");
    expect(text).not.toContain("profile.read.self");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ForbiddenPage />);
    await expectNoAxeViolations(container);
  });
});

describe("authorization-aware navigation", () => {
  it("offers a patient their own area and nothing else", () => {
    render(<AppNav role="patient" label="Your areas" />);

    expect(screen.getByRole("link", { name: "Patient area" })).toHaveAttribute(
      "href",
      "/patient",
    );
    expect(
      screen.queryByRole("link", { name: "Administration" }),
    ).not.toBeInTheDocument();
  });

  it("offers an admin administration and not the patient area", () => {
    render(<AppNav role="admin" label="Your areas" />);

    expect(
      screen.getByRole("link", { name: "Administration" }),
    ).toHaveAttribute("href", "/admin");
    expect(
      screen.queryByRole("link", { name: "Patient area" }),
    ).not.toBeInTheDocument();
  });

  it("offers a receptionist the front desk and neither other area", () => {
    render(<AppNav role="receptionist" label="Your areas" />);

    expect(screen.getByRole("link", { name: "Front desk" })).toHaveAttribute(
      "href",
      "/receptionist",
    );
    expect(
      screen.queryByRole("link", { name: "Patient area" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Administration" }),
    ).not.toBeInTheDocument();
  });

  it("offers a doctor the clinical workspace and neither other area", () => {
    // Phase 11 built the workspace, so the link is no longer a promise the
    // guard would refuse. It is offered *because* `requireAreaAccess` would
    // admit this role — the two read the same table.
    render(<AppNav role="doctor" label="Your areas" />);

    expect(
      screen.getByRole("link", { name: "Clinical workspace" }),
    ).toHaveAttribute("href", "/doctor");
    expect(
      screen.queryByRole("link", { name: "Front desk" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Patient area" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Administration" }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when the role could not be resolved", () => {
    const { container } = render(<AppNav role={null} label="Your areas" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the region and has no accessibility violations", async () => {
    const { container } = render(<AppNav role="admin" label="Your areas" />);

    expect(
      screen.getByRole("navigation", { name: "Your areas" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  /*
   * The defect Phase 18's browser pass found in this component's placement.
   *
   * On one row with the brand, the bell and sign-out, there was not room on a
   * phone: measured at 320px the nav was **90px wider** than the box it was
   * given, so `overflow-x-auto` clipped "Patient area" mid-word and squeezed
   * the notification bell to 20px — half its 44px touch target. The *page*
   * never overflowed, which is why four earlier browser passes missed it: the
   * nav was absorbing the overflow by hiding its own content.
   *
   * The fix is in `(app)/layout.tsx`, which gives the nav its own row below
   * `sm`. This asserts the contract that makes that possible — the nav accepts
   * placement from its caller — because jsdom has no layout engine and cannot
   * measure the pixels. The pixel result was measured in Chrome against the
   * production build: `navOverflow=0` at 320, 360, 390, 430, 640 and 768.
   */
  it("accepts layout from its caller, so the header can move it to its own row", () => {
    render(
      <AppNav role="patient" label="Your areas" className="w-full sm:w-auto" />,
    );

    const nav = screen.getByRole("navigation", { name: "Your areas" });
    expect(nav).toHaveClass("w-full");
    expect(nav).toHaveClass("sm:w-auto");
    // And it keeps its own behaviour rather than being overridden.
    expect(nav).toHaveClass("overflow-x-auto");
  });
});

describe("the access table", () => {
  it("shows each person's current role as text in its own cell", () => {
    // Read from the row's role cell rather than from anywhere on the page: the
    // select lists every role as an option, so a page-wide text search would
    // pass even if the cell were blank.
    render(<UserAccessTable users={USERS} currentUserId={ADMIN_ID} />);

    const roleCellOf = (personText: string) =>
      screen.getByText(personText).closest("tr")?.querySelectorAll("td")[1]
        ?.textContent;

    expect(roleCellOf("Clinic Administrator")).toBe(ROLE_LABELS.admin);
    expect(roleCellOf("Practitioner")).toBe(ROLE_LABELS.doctor);
    // A user between account creation and the trigger committing is shown as
    // having no role, not silently rendered as a patient.
    expect(roleCellOf("new@example.test")).toBe(ADMIN_USERS_PAGE.noRoleLabel);
  });

  it("gives the administrator's own row an explanation instead of a control", () => {
    render(<UserAccessTable users={USERS} currentUserId={ADMIN_ID} />);

    const ownRow = screen.getByText("Clinic Administrator").closest("tr");
    expect(ownRow).not.toBeNull();
    expect(
      within(ownRow as HTMLElement).getByText(ADMIN_USERS_PAGE.selfNotice),
    ).toBeInTheDocument();
    expect(
      within(ownRow as HTMLElement).queryByRole("combobox"),
    ).not.toBeInTheDocument();
  });

  it("gives every other row a labelled role control", () => {
    render(<UserAccessTable users={USERS} currentUserId={ADMIN_ID} />);

    // Named after the person, so a screen-reader user knows whose access they
    // are about to change.
    const control = screen.getByRole("combobox", {
      name: `${ADMIN_USERS_PAGE.roleFieldLabel} for doctor@example.test`,
    });
    expect(control).toBeInTheDocument();
    expect(control).toHaveValue("doctor");
  });

  it("offers every role as an option, and no role outside the model", () => {
    render(<UserAccessTable users={USERS} currentUserId={ADMIN_ID} />);

    const control = screen.getByRole("combobox", {
      name: `${ADMIN_USERS_PAGE.roleFieldLabel} for doctor@example.test`,
    });
    const values = within(control)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    expect(values).toEqual([...APP_ROLES]);
    expect(values).not.toContain("superadmin");
  });

  it("carries the target as data, not as authority", () => {
    // The hidden field is editable by anybody with developer tools. It says
    // *what* to change; `assertPermission` and `public.assign_user_role()`
    // decide whether — which is what makes it safe to render at all.
    const { container } = render(
      <UserAccessTable users={USERS} currentUserId={ADMIN_ID} />,
    );

    const hidden = container.querySelector<HTMLInputElement>(
      'input[name="targetUserId"]',
    );
    expect(hidden?.value).toBe(OTHER_ID);
    expect(
      container.querySelector('input[name="role"][type="hidden"]'),
    ).toBeNull();
  });

  it("communicates verification with text as well as colour", () => {
    render(<UserAccessTable users={USERS} currentUserId={ADMIN_ID} />);

    expect(
      screen.getByText(ADMIN_USERS_PAGE.verifiedLabel),
    ).toBeInTheDocument();
    expect(screen.getAllByText(ADMIN_USERS_PAGE.unverifiedLabel).length).toBe(
      2,
    );
  });

  it("shows no patient information", () => {
    // Managing who may sign in is not a licence to browse patient data
    // (`docs/SECURITY.md` section 6, "Admins").
    const { container } = render(
      <UserAccessTable users={USERS} currentUserId={ADMIN_ID} />,
    );
    const text = container.textContent ?? "";

    for (const term of [
      "Date of birth",
      "Phone",
      "Address",
      "Emergency",
      "Diagnosis",
      "Prescription",
    ]) {
      expect(text).not.toContain(term);
    }
  });

  it("renders a name containing markup as text", () => {
    const hostile: readonly ManagedUser[] = [
      { ...USERS[1]!, fullName: "<script>alert(1)</script>" },
    ];

    const { container } = render(
      <UserAccessTable users={hostile} currentUserId={ADMIN_ID} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <UserAccessTable users={USERS} currentUserId={ADMIN_ID} />,
    );
    await expectNoAxeViolations(container);
  });
});
