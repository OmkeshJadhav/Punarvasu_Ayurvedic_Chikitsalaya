import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUSES } from "@/features/appointments/status";
import type { AppointmentStatus } from "@/features/appointments/types";

import {
  STAFF_ACTIONABLE_FROM_STATUSES,
  STAFF_ASSIGNABLE_STATUSES,
  canStaffReschedule,
  canStaffSetStatus,
  isStaffAssignableStatus,
  staffActionsFor,
} from "./status";

/**
 * What the front desk may do to an appointment.
 *
 * Two rules compose here, and the tests keep them apart deliberately:
 *
 *   * the **transition** matrix, which is Phase 09's and the database
 *     trigger's, and which this module imports rather than restates;
 *   * the **role** allowlist, which is Phase 10's and is the subject of most
 *     of this file.
 *
 * The last block reads the migration, because the allowlist exists in two
 * places — here and in `update_appointment_status_as_staff` — and two copies
 * of a rule is a divergence waiting to happen. The failure it prevents is
 * concrete: a button offered by the UI and then refused by the database.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260921120000_receptionist_workspace.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("the front desk's status allowlist", () => {
  it("is exactly confirm, check in, no-show and cancel", () => {
    expect([...STAFF_ASSIGNABLE_STATUSES].sort()).toEqual([
      "cancelled",
      "checked_in",
      "confirmed",
      "no_show",
    ]);
  });

  it("excludes completed, which is a clinical judgement", () => {
    // `phase_10.md` section 31: completion stays a doctor's responsibility
    // unless explicitly authorized, and `docs/SECURITY.md` section 6's matrix
    // does not authorize it. Nothing is inferred from "the receptionist can
    // manage appointments".
    expect(isStaffAssignableStatus("completed")).toBe(false);
    expect(isStaffAssignableStatus("in_consultation")).toBe(false);
  });

  it("refuses a status that is not one at all", () => {
    for (const candidate of ["admin", "deleted", "COMPLETED", "", "*"]) {
      expect(isStaffAssignableStatus(candidate), candidate).toBe(false);
    }
  });

  it("agrees with the database about which statuses it may act from", () => {
    // The rule that stops "cancel" being offered for a patient who is in the
    // room with the practitioner. It exists because this assertion found the
    // TypeScript and the SQL disagreeing about exactly that case.
    const branches = [
      ...MIGRATION.matchAll(/when appt\.status = '(\w+)' then/g),
    ].map((match) => match[1] as string);

    expect(branches.sort()).toEqual([...STAFF_ACTIONABLE_FROM_STATUSES].sort());
    expect(branches).not.toContain("in_consultation");
    expect(branches).not.toContain("completed");
  });

  it("agrees with the database's own allowlist", () => {
    // Parsed out of the SQL rather than restated, so a change to one without
    // the other fails here.
    const match = /p_status not in \(([^)]*)\)/.exec(MIGRATION);
    expect(match).not.toBeNull();

    const inSql = (match?.[1] ?? "")
      .split(",")
      .map((value) => value.trim().replace(/^'|'$/g, ""))
      .filter(Boolean)
      .sort();

    expect(inSql).toEqual([...STAFF_ASSIGNABLE_STATUSES].sort());
  });
});

describe("canStaffSetStatus", () => {
  /**
   * The whole matrix, written out.
   *
   * Derived from neither `ALLOWED_TRANSITIONS` nor the allowlist — deriving it
   * would make the test agree with any pair of tables, including a wrong one.
   */
  const EXPECTED: Readonly<
    Record<AppointmentStatus, readonly AppointmentStatus[]>
  > = {
    requested: ["confirmed", "cancelled"],
    confirmed: ["checked_in", "cancelled", "no_show"],
    // `in_consultation` is a legal transition from `checked_in` but is not a
    // status this role may set, so it is absent here. That is the two rules
    // composing.
    checked_in: ["cancelled", "no_show"],
    // Nothing. `in_consultation -> cancelled` is a legal transition and
    // `cancelled` is a status the front desk may set — but the patient is in
    // the room with the practitioner, so it is not the desk's call. That is
    // what `STAFF_ACTIONABLE_FROM_STATUSES` exists for, and this row is the
    // assertion that found the two rules were not enough on their own.
    in_consultation: [],
    completed: [],
    cancelled: [],
    no_show: [],
  };

  for (const from of APPOINTMENT_STATUSES) {
    for (const to of APPOINTMENT_STATUSES) {
      const permitted = EXPECTED[from].includes(to);

      it(`${permitted ? "allows" : "refuses"} ${from} -> ${to}`, () => {
        expect(canStaffSetStatus(from, to)).toBe(permitted);
      });
    }
  }

  it("never allows a terminal appointment to move", () => {
    for (const from of ["completed", "cancelled", "no_show"] as const) {
      for (const to of APPOINTMENT_STATUSES) {
        expect(canStaffSetStatus(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("never allows an appointment to be completed by the front desk", () => {
    for (const from of APPOINTMENT_STATUSES) {
      expect(canStaffSetStatus(from, "completed"), from).toBe(false);
    }
  });

  it("treats a no-op as not a transition", () => {
    // The database trigger returns early on one too, so the two agree about
    // the one case that is neither legal nor illegal.
    for (const status of APPOINTMENT_STATUSES) {
      expect(canStaffSetStatus(status, status), status).toBe(false);
    }
  });
});

describe("canStaffReschedule", () => {
  it("allows a requested or confirmed appointment to be moved", () => {
    expect(canStaffReschedule("requested")).toBe(true);
    expect(canStaffReschedule("confirmed")).toBe(true);
  });

  it.each([
    "checked_in",
    "in_consultation",
    "completed",
    "cancelled",
    "no_show",
  ] as const)("refuses to move a %s appointment", (status) => {
    expect(canStaffReschedule(status)).toBe(false);
  });

  it("does not depend on the appointment's start time", () => {
    // Unlike the patient path. A patient who arrives late and is fitted in an
    // hour later is an ordinary afternoon at a clinic, and
    // `reschedule_appointment_as_staff` allows it deliberately — the *new*
    // time still has to be in the future, and the database checks that.
    expect(canStaffReschedule.length).toBe(1);
  });
});

describe("staffActionsFor", () => {
  it("offers confirm first for a requested appointment", () => {
    const actions = staffActionsFor("requested");

    expect(actions.map((action) => action.status)).toEqual([
      "confirmed",
      "cancelled",
    ]);
    expect(actions[0]?.label).toBe("Confirm");
  });

  it("offers check-in, no-show and cancel for a confirmed appointment", () => {
    expect(staffActionsFor("confirmed").map((action) => action.status)).toEqual(
      ["checked_in", "no_show", "cancelled"],
    );
  });

  it("offers nothing for a terminal appointment", () => {
    // An empty list, so the UI renders a sentence rather than a row of
    // disabled buttons — a disabled control tells somebody nothing they can
    // act on.
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      expect(staffActionsFor(status)).toEqual([]);
    }
  });

  it("asks before the two actions that are not easily undone", () => {
    const confirmed = staffActionsFor("confirmed");

    const byStatus = Object.fromEntries(
      confirmed.map((action) => [action.status, action]),
    );

    // Confirming and checking in are additive and still cancellable.
    expect(byStatus["checked_in"]?.confirm).toBe(false);
    // A no-show is a record that somebody did not attend; cancelling frees
    // the slot for another patient.
    expect(byStatus["no_show"]?.confirm).toBe(true);
    expect(byStatus["cancelled"]?.confirm).toBe(true);
    expect(byStatus["cancelled"]?.destructive).toBe(true);
  });

  it("labels an action by what it does, never by the resulting state", () => {
    // "Confirm", not "Confirmed". A button is a verb.
    for (const status of APPOINTMENT_STATUSES) {
      for (const action of staffActionsFor(status)) {
        expect(action.label).not.toMatch(/ed$/);
        expect(action.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("only ever offers a status this role may set", () => {
    for (const status of APPOINTMENT_STATUSES) {
      for (const action of staffActionsFor(status)) {
        expect(STAFF_ASSIGNABLE_STATUSES).toContain(action.status);
      }
    }
  });
});
