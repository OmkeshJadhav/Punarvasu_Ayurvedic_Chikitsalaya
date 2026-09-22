/**
 * Which operational actions the front desk may take on an appointment.
 *
 * ## Two rules, composed — not one rule rewritten
 *
 * An action is offered when **both** hold:
 *
 *   1. the transition is legal at all, which is
 *      `features/appointments/status.ts`'s `canTransition` and therefore the
 *      Phase 09 matrix and therefore the database trigger; and
 *   2. the *role* is allowed to set that status, which is the list below.
 *
 * The second is what `phase_10.md` section 31 asks for. A receptionist may not
 * mark an appointment `completed` even though `in_consultation -> completed`
 * is a perfectly legal transition, because completion describes what happened
 * in the consulting room and the front desk was not in it. Nothing is inferred
 * from "the receptionist can manage appointments"; the capability is listed.
 *
 * Keeping the two rules separate is the point. This file never restates the
 * transition matrix — it imports it — so a lifecycle change lands in one place
 * and a role change lands in the other.
 *
 * ## None of this is the security boundary
 *
 * `phase_10.md` example 5 and `docs/SECURITY.md` section 6: showing only
 * permitted actions is a usability decision. What actually refuses is
 * `update_appointment_status_as_staff`, which re-derives both rules inside the
 * database, and `appointments_guard_transition()` beneath it. A button
 * rendered ten minutes ago is not evidence of anything — by the time it is
 * clicked another receptionist may have confirmed the same appointment.
 */

import {
  canTransition,
  isTerminalStatus,
} from "@/features/appointments/status";
import type { AppointmentStatus } from "@/features/appointments/types";

/**
 * The statuses a receptionist may set, whatever the current state.
 *
 * Mirrors the allowlist in `update_appointment_status_as_staff`. The two are
 * asserted to agree by test, by reading the migration — two copies of a rule
 * is a divergence waiting to happen, and the failure it prevents is a button
 * that is offered and then refused.
 */
export const STAFF_ASSIGNABLE_STATUSES = [
  "confirmed",
  "checked_in",
  "no_show",
  "cancelled",
] as const satisfies readonly AppointmentStatus[];

export type StaffAssignableStatus = (typeof STAFF_ASSIGNABLE_STATUSES)[number];

export function isStaffAssignableStatus(
  status: string,
): status is StaffAssignableStatus {
  return (STAFF_ASSIGNABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * The statuses the front desk may act **from**.
 *
 * The allowlist above says which statuses may be *set*; this says from where.
 * Both are needed, and the case that proves it is `in_consultation`:
 * `in_consultation -> cancelled` is a legal transition, and `cancelled` is a
 * status the front desk may set — so composing only those two rules would have
 * offered "Cancel appointment" for a patient who is in the room with the
 * practitioner. That is the clinician's call, not the desk's.
 *
 * This was not reasoned out in advance. `status.test.ts` compared the
 * composition against the database's own allowlist and found them disagreeing,
 * which is precisely the divergence the mirror test exists to catch.
 *
 * Mirrors the `case` in `update_appointment_status_as_staff`, and is asserted
 * against it by reading the migration.
 */
export const STAFF_ACTIONABLE_FROM_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
] as const satisfies readonly AppointmentStatus[];

/** Whether the front desk may act on an appointment in this status at all. */
export function isStaffActionableStatus(status: AppointmentStatus): boolean {
  return (STAFF_ACTIONABLE_FROM_STATUSES as readonly string[]).includes(status);
}

/** Whether the front desk may move an appointment from `from` to `to`. */
export function canStaffSetStatus(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (!isStaffActionableStatus(from)) return false;
  if (!isStaffAssignableStatus(to)) return false;
  return canTransition(from, to);
}

/**
 * Whether the front desk may move this appointment to another time.
 *
 * Status only. Unlike the patient path, a start time that has already passed
 * is **not** disqualifying: a patient who arrives late and is fitted in an
 * hour later is an ordinary afternoon at a clinic, and
 * `reschedule_appointment_as_staff` allows it deliberately. The *new* time
 * still has to be in the future, and the database is what checks that.
 */
export function canStaffReschedule(status: AppointmentStatus): boolean {
  return status === "requested" || status === "confirmed";
}

/** One offerable action on an appointment. */
export interface StaffStatusAction {
  readonly status: StaffAssignableStatus;
  /** The button's label. Names the action, never the resulting state. */
  readonly label: string;
  /** Whether it needs a confirmation step before it happens. */
  readonly confirm: boolean;
  /** Whether it should be styled as destructive. */
  readonly destructive: boolean;
}

const ACTION_PRESENTATION: Readonly<
  Record<StaffAssignableStatus, Omit<StaffStatusAction, "status">>
> = {
  confirmed: {
    label: "Confirm",
    // Confirming is additive and reversible in the only sense that matters —
    // a confirmed appointment can still be cancelled. Asking first would train
    // the front desk to dismiss dialogs.
    confirm: false,
    destructive: false,
  },
  checked_in: {
    label: "Check in",
    confirm: false,
    destructive: false,
  },
  no_show: {
    // A record that somebody did not attend. It is operationally significant
    // and not obviously undoable, so it asks first (`phase_10.md` section 30).
    label: "Mark as no-show",
    confirm: true,
    destructive: false,
  },
  cancelled: {
    label: "Cancel appointment",
    confirm: true,
    destructive: true,
  },
};

/**
 * The actions to offer for an appointment in this status, in the order the
 * front desk would reach for them.
 *
 * The order is the lifecycle's own: confirm, check in, then the two exceptions.
 * A terminal appointment offers nothing, which is the correct empty answer
 * rather than a row of disabled buttons.
 */
export function staffActionsFor(
  status: AppointmentStatus,
): readonly StaffStatusAction[] {
  if (isTerminalStatus(status)) return [];

  return STAFF_ASSIGNABLE_STATUSES.filter((candidate) =>
    canStaffSetStatus(status, candidate),
  ).map((candidate) => ({
    status: candidate,
    ...ACTION_PRESENTATION[candidate],
  }));
}
