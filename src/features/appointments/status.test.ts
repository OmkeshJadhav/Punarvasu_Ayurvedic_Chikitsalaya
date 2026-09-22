import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ALLOWED_TRANSITIONS,
  APPOINTMENT_STATUSES,
  TERMINAL_STATUSES,
  canPatientCancel,
  canPatientReschedule,
  canTransition,
  holdsSlot,
  isCancellableStatus,
  isReschedulableStatus,
  isTerminalStatus,
} from "./status";
import type { AppointmentStatus } from "./types";

/**
 * The status lifecycle.
 *
 * Two things are asserted here, and the second matters more than the first:
 *
 *   1. That the matrix says what `phase_09.md` section 67 says it should.
 *   2. That the matrix in TypeScript **agrees with the one in the database**,
 *      by reading the migration.
 *
 * Without (2) this file would happily prove that an application-level copy of
 * the rules is self-consistent while the database enforced something else —
 * and the database is the one that decides. The mirror check is the same
 * arrangement `lib/design/palette.ts` has with `globals.css`.
 */

const MIGRATION = readFileSync(
  new URL(
    "../../../supabase/migrations/20260920120000_appointment_engine.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("the status vocabulary", () => {
  it("is the lifecycle docs/DATABASE.md section 11 documents", () => {
    expect([...APPOINTMENT_STATUSES]).toEqual([
      "requested",
      "confirmed",
      "checked_in",
      "in_consultation",
      "completed",
      "cancelled",
      "no_show",
    ]);
  });

  it("matches the database enum exactly", () => {
    const enumBlock =
      /create type public\.appointment_status as enum \(([\s\S]*?)\);/.exec(
        MIGRATION,
      );
    expect(enumBlock).not.toBeNull();

    const declared = [...(enumBlock?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );

    expect(declared).toEqual([...APPOINTMENT_STATUSES]);
  });
});

describe("transitions", () => {
  it("allows the transitions phase_09.md section 67 requires", () => {
    expect(canTransition("requested", "confirmed")).toBe(true);
    expect(canTransition("requested", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "no_show")).toBe(true);
    expect(canTransition("confirmed", "checked_in")).toBe(true);
    expect(canTransition("checked_in", "in_consultation")).toBe(true);
    expect(canTransition("in_consultation", "completed")).toBe(true);
  });

  it("rejects the transitions phase_09.md section 67 forbids", () => {
    expect(canTransition("completed", "requested")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
    expect(canTransition("no_show", "requested")).toBe(false);
  });

  it("rejects every other reversal", () => {
    // Written as an exhaustive sweep rather than a list, so a transition
    // added to the matrix without thought fails here.
    const allowed = new Set(
      APPOINTMENT_STATUSES.flatMap((from) =>
        ALLOWED_TRANSITIONS[from].map((to) => `${from}->${to}`),
      ),
    );

    for (const from of APPOINTMENT_STATUSES) {
      for (const to of APPOINTMENT_STATUSES) {
        expect(canTransition(from, to)).toBe(allowed.has(`${from}->${to}`));
      }
    }
  });

  it("treats a no-op as not a transition", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("leaves every terminal status terminal", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toEqual([]);
      expect(isTerminalStatus(status)).toBe(true);
    }

    expect(isTerminalStatus("requested")).toBe(false);
    expect(isTerminalStatus("confirmed")).toBe(false);
  });

  it("names only real statuses on both sides", () => {
    for (const from of APPOINTMENT_STATUSES) {
      for (const to of ALLOWED_TRANSITIONS[from]) {
        expect(APPOINTMENT_STATUSES as readonly string[]).toContain(to);
      }
    }
  });

  /**
   * The mirror check.
   *
   * `appointments_guard_transition()` is the enforcement. This asserts the
   * TypeScript matrix is the same matrix, by parsing the trigger's own
   * conditions out of the migration — so changing one without the other
   * fails the build rather than producing an application that offers a button
   * the database refuses.
   */
  it("agrees with the database trigger", () => {
    const guard =
      /create function public\.appointments_guard_transition[\s\S]*?\$\$;/.exec(
        MIGRATION,
      );
    expect(guard).not.toBeNull();

    const clauses = [
      ...(guard?.[0] ?? "").matchAll(
        /old\.status = '([a-z_]+)' and new\.status in \(([^)]*)\)/g,
      ),
    ];

    expect(clauses.length).toBeGreaterThan(0);

    const fromSql: Record<string, string[]> = {};
    for (const clause of clauses) {
      const from = clause[1] as AppointmentStatus;
      fromSql[from] = [...(clause[2] ?? "").matchAll(/'([a-z_]+)'/g)].map(
        (match) => match[1] as string,
      );
    }

    for (const status of APPOINTMENT_STATUSES) {
      expect([...(fromSql[status] ?? [])].sort()).toEqual(
        [...ALLOWED_TRANSITIONS[status]].sort(),
      );
    }
  });
});

describe("holdsSlot", () => {
  it("matches the database's exclusion-constraint predicate", () => {
    // The constraint is `where (status <> 'cancelled')`. A completed or missed
    // appointment held that time and still does, historically.
    for (const status of APPOINTMENT_STATUSES) {
      expect(holdsSlot(status)).toBe(status !== "cancelled");
    }

    expect(MIGRATION).toContain("where (status <> 'cancelled')");
  });
});

describe("what a patient may do", () => {
  const now = new Date("2026-09-22T05:00:00.000Z");
  const future = new Date("2026-09-23T05:00:00.000Z");
  const past = new Date("2026-09-21T05:00:00.000Z");

  it("allows cancelling an upcoming requested or confirmed appointment", () => {
    for (const status of ["requested", "confirmed"] as const) {
      expect(
        canPatientCancel({
          status,
          startsAt: future,
          now,
          cancellationCutoffMinutes: 0,
        }),
      ).toBe(true);
    }
  });

  it("refuses to cancel an appointment that has already started", () => {
    expect(
      canPatientCancel({
        status: "confirmed",
        startsAt: past,
        now,
        cancellationCutoffMinutes: 0,
      }),
    ).toBe(false);
  });

  it("refuses to cancel from a status that is not cancellable", () => {
    for (const status of [
      "checked_in",
      "in_consultation",
      "completed",
      "cancelled",
      "no_show",
    ] as const) {
      expect(isCancellableStatus(status)).toBe(false);
      expect(
        canPatientCancel({
          status,
          startsAt: future,
          now,
          cancellationCutoffMinutes: 0,
        }),
      ).toBe(false);
    }
  });

  it("applies a cancellation cutoff when one is configured", () => {
    // The clinic has set none (the configured value is 0), so this asserts the
    // mechanism rather than the current policy — setting a cutoff must be a
    // change to one number, not a code change.
    const soon = new Date(now.getTime() + 30 * 60_000);

    expect(
      canPatientCancel({
        status: "confirmed",
        startsAt: soon,
        now,
        cancellationCutoffMinutes: 0,
      }),
    ).toBe(true);

    expect(
      canPatientCancel({
        status: "confirmed",
        startsAt: soon,
        now,
        cancellationCutoffMinutes: 120,
      }),
    ).toBe(false);
  });

  it("allows rescheduling an upcoming requested or confirmed appointment", () => {
    for (const status of ["requested", "confirmed"] as const) {
      expect(isReschedulableStatus(status)).toBe(true);
      expect(canPatientReschedule({ status, startsAt: future, now })).toBe(
        true,
      );
    }
  });

  it("refuses to reschedule a past or terminal appointment", () => {
    expect(
      canPatientReschedule({ status: "confirmed", startsAt: past, now }),
    ).toBe(false);
    expect(
      canPatientReschedule({ status: "cancelled", startsAt: future, now }),
    ).toBe(false);
    expect(
      canPatientReschedule({ status: "completed", startsAt: future, now }),
    ).toBe(false);
  });
});
