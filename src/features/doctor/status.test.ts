import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUSES } from "@/features/appointments/status";
import type { AppointmentStatus } from "@/features/appointments/types";
import { STAFF_ASSIGNABLE_STATUSES } from "@/features/reception/status";

import {
  DOCTOR_ACTIONABLE_FROM_STATUSES,
  DOCTOR_ASSIGNABLE_STATUSES,
  canCompleteConsultation,
  canDoctorSetStatus,
  canStartConsultation,
  doctorActionsFor,
  isConsultationInProgress,
  isDoctorAssignableStatus,
} from "./status";

/**
 * What a practitioner may do to an appointment in their own diary.
 *
 * Three rules compose here, and the tests keep them apart deliberately:
 *
 *   * the **transition** matrix, which is Phase 09's and the database
 *     trigger's, and which this module imports rather than restates;
 *   * the **role** allowlist — which statuses may be set;
 *   * the **actionable-from** list — which statuses may be acted from.
 *
 * The last block reads the migration, because the allowlist and the
 * transition branches exist in two places — here and in
 * `update_appointment_status_as_doctor` — and two copies of a rule is a
 * divergence waiting to happen. The failure it prevents is concrete: a button
 * the workspace offers and the database then refuses. Phase 10's equivalent
 * test found exactly that before it shipped.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260922120000_doctor_workspace.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("the practitioner's status allowlist", () => {
  it("is exactly confirm, start, complete and no-show", () => {
    expect([...DOCTOR_ASSIGNABLE_STATUSES].sort()).toEqual([
      "completed",
      "confirmed",
      "in_consultation",
      "no_show",
    ]);
  });

  it("excludes cancelling, which changes a patient's plans", () => {
    // `phase_11.md` section 21 lists confirm, complete and no-show, and does
    // not list cancel. Cancelling releases a slot and needs somebody to tell
    // the patient, which is the front desk's work.
    expect(isDoctorAssignableStatus("cancelled")).toBe(false);
  });

  it("excludes checking a patient in, which happens at the desk", () => {
    expect(isDoctorAssignableStatus("checked_in")).toBe(false);
  });

  it("refuses a status that is not one at all", () => {
    for (const candidate of ["admin", "deleted", "COMPLETED", "", "*"]) {
      expect(isDoctorAssignableStatus(candidate), candidate).toBe(false);
    }
  });

  it("is the complement of the front desk's, not a subset of it", () => {
    // `phase_11.md` section 25: the doctor workspace is not the receptionist
    // interface with a different heading. The two allowlists overlap on
    // exactly the two statuses both roles can legitimately reach — confirming
    // an appointment and recording that nobody came — and differ everywhere
    // else.
    const doctor = new Set<string>(DOCTOR_ASSIGNABLE_STATUSES);
    const desk = new Set<string>(STAFF_ASSIGNABLE_STATUSES);

    const shared = [...doctor].filter((status) => desk.has(status)).sort();
    expect(shared).toEqual(["confirmed", "no_show"]);

    // The two Phase 10 refused the front desk, because they describe what
    // happened in the consulting room.
    expect(doctor.has("in_consultation")).toBe(true);
    expect(doctor.has("completed")).toBe(true);
    expect(desk.has("in_consultation")).toBe(false);
    expect(desk.has("completed")).toBe(false);

    // And the two the desk keeps.
    expect(desk.has("checked_in")).toBe(true);
    expect(desk.has("cancelled")).toBe(true);
    expect(doctor.has("checked_in")).toBe(false);
    expect(doctor.has("cancelled")).toBe(false);
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

    expect(inSql).toEqual([...DOCTOR_ASSIGNABLE_STATUSES].sort());
  });

  it("agrees with the database about which statuses it may act from", () => {
    const branches = [
      ...MIGRATION.matchAll(/when appt\.status = '(\w+)' then/g),
    ].map((match) => match[1] as string);

    expect(branches.sort()).toEqual(
      [...DOCTOR_ACTIONABLE_FROM_STATUSES].sort(),
    );
  });

  it("agrees with the database about the whole transition table", () => {
    // Stronger than Phase 10's mirror: the SQL's `case` is parsed into a
    // from -> to map and compared against the composed TypeScript rules, so
    // a divergence in any single cell fails rather than only a divergence in
    // the two lists.
    const branches = [
      ...MIGRATION.matchAll(
        /when appt\.status = '(\w+)' then p_status in \(([^)]*)\)/g,
      ),
    ];

    expect(branches.length).toBe(DOCTOR_ACTIONABLE_FROM_STATUSES.length);

    for (const [, from, targets] of branches) {
      const inSql = (targets ?? "")
        .split(",")
        .map((value) => value.trim().replace(/^'|'$/g, ""))
        .filter(Boolean)
        .sort();

      const inTypeScript = APPOINTMENT_STATUSES.filter((candidate) =>
        canDoctorSetStatus(from as AppointmentStatus, candidate),
      ).sort();

      expect(inTypeScript, `from ${from}`).toEqual(inSql);
    }
  });
});

describe("canDoctorSetStatus", () => {
  /**
   * The whole matrix, written out.
   *
   * Derived from neither `ALLOWED_TRANSITIONS` nor the allowlist — deriving
   * it would make the test agree with any pair of tables, including a wrong
   * one.
   */
  const EXPECTED: Readonly<
    Record<AppointmentStatus, readonly AppointmentStatus[]>
  > = {
    // `requested -> cancelled` is a legal transition and is absent here,
    // because `cancelled` is not a status this role may set.
    requested: ["confirmed"],
    // `confirmed -> checked_in` is legal and absent for the same reason:
    // checking a patient in happens at the desk.
    confirmed: ["no_show"],
    checked_in: ["in_consultation", "no_show"],
    in_consultation: ["completed"],
    completed: [],
    cancelled: [],
    no_show: [],
  };

  for (const from of APPOINTMENT_STATUSES) {
    for (const to of APPOINTMENT_STATUSES) {
      const permitted = EXPECTED[from].includes(to);

      it(`${permitted ? "allows" : "refuses"} ${from} -> ${to}`, () => {
        expect(canDoctorSetStatus(from, to)).toBe(permitted);
      });
    }
  }

  it("never allows a terminal appointment to move", () => {
    for (const from of ["completed", "cancelled", "no_show"] as const) {
      for (const to of APPOINTMENT_STATUSES) {
        expect(canDoctorSetStatus(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("never allows a practitioner to cancel, from any state", () => {
    for (const from of APPOINTMENT_STATUSES) {
      expect(canDoctorSetStatus(from, "cancelled"), from).toBe(false);
    }
  });

  it("never allows a practitioner to check a patient in, from any state", () => {
    for (const from of APPOINTMENT_STATUSES) {
      expect(canDoctorSetStatus(from, "checked_in"), from).toBe(false);
    }
  });
});

describe("the consultation entry point", () => {
  it("is offered only for a patient who has been checked in", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(canStartConsultation(status), status).toBe(
        status === "checked_in",
      );
    }
  });

  it("can be completed only from a consultation in progress", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(canCompleteConsultation(status), status).toBe(
        status === "in_consultation",
      );
    }
  });

  it("reports a consultation as in progress only in that one state", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(isConsultationInProgress(status), status).toBe(
        status === "in_consultation",
      );
    }
  });
});

describe("doctorActionsFor", () => {
  it("offers nothing for a terminal appointment", () => {
    // A sentence rather than a row of disabled buttons is the UI's job; this
    // is the rule that makes it possible.
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      expect(doctorActionsFor(status)).toEqual([]);
    }
  });

  it("offers exactly one action for a requested appointment", () => {
    const actions = doctorActionsFor("requested");
    expect(actions.map((action) => action.status)).toEqual(["confirmed"]);
  });

  it("offers starting the consultation first for a checked-in patient", () => {
    // Lifecycle order: the likely action before the exception.
    const actions = doctorActionsFor("checked_in");
    expect(actions.map((action) => action.status)).toEqual([
      "in_consultation",
      "no_show",
    ]);
  });

  it("asks before the two terminal actions and not before the others", () => {
    // `docs/PRODUCT_SPEC.md` section 19 and `phase_11.md` section 40. The
    // distinction is whether it can be put back: `completed` and `no_show`
    // are terminal and nothing in the product moves an appointment out of
    // either.
    const confirming = new Map<string, boolean>();

    for (const status of APPOINTMENT_STATUSES) {
      for (const action of doctorActionsFor(status)) {
        confirming.set(action.status, action.confirm);
      }
    }

    expect(confirming.get("confirmed")).toBe(false);
    expect(confirming.get("in_consultation")).toBe(false);
    expect(confirming.get("completed")).toBe(true);
    expect(confirming.get("no_show")).toBe(true);
  });

  it("gives every confirming action a sentence to confirm with", () => {
    for (const status of APPOINTMENT_STATUSES) {
      for (const action of doctorActionsFor(status)) {
        if (action.confirm) expect(action.confirmBody).not.toBe("");
      }
    }
  });

  it("labels every action with what it does, never with a clinical word", () => {
    // `phase_11.md` sections 18 and 54. There is nothing clinical behind any
    // of these buttons, and there must be nothing clinical on one either.
    for (const status of APPOINTMENT_STATUSES) {
      for (const action of doctorActionsFor(status)) {
        expect(action.label).not.toMatch(
          /diagnos|symptom|prescri|medicat|treatment plan|note|vital/i,
        );
      }
    }
  });
});
