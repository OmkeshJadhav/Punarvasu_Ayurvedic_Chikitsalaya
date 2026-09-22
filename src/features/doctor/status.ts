/**
 * Which actions a practitioner may take on an appointment in their own diary.
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
 * This file never restates the transition matrix — it imports it — so a
 * lifecycle change lands in one place and a role change lands in the other.
 * It is the same shape `features/reception/status.ts` uses, deliberately:
 * two workspaces, one lifecycle, two role allowlists.
 *
 * ## How this allowlist complements the front desk's
 *
 * ```text
 * receptionist   confirmed, checked_in, no_show, cancelled
 * doctor         confirmed, in_consultation, completed, no_show
 * ```
 *
 * `in_consultation` and `completed` are exactly the two Phase 10 refused the
 * front desk, on the grounds that they describe what happened in the
 * consulting room. This is the role that was in it, and `phase_11.md`
 * section 21 lists completion as a doctor action.
 *
 * `cancelled` is deliberately absent. Cancelling releases a slot, changes a
 * patient's plans and needs somebody to tell them; a practitioner who needs
 * one cancelled asks the desk, which records who did it.
 *
 * Rescheduling is absent for the same reason, and there is no reschedule
 * function on this path at all — not a hidden button, no server action, no
 * RPC.
 *
 * ## None of this is the security boundary
 *
 * `phase_11.md` sections 43 and 45: showing only permitted actions is a
 * usability decision. What actually refuses is
 * `update_appointment_status_as_doctor`, which re-derives both rules inside
 * the database, resolves the appointment by the caller's own practitioner id,
 * and sits on top of `appointments_guard_transition()`. A button rendered ten
 * minutes ago is not evidence of anything — by then the front desk may have
 * checked the patient in, or cancelled.
 */

import {
  canTransition,
  isTerminalStatus,
} from "@/features/appointments/status";
import type { AppointmentStatus } from "@/features/appointments/types";

/**
 * The statuses a practitioner may set, whatever the current state.
 *
 * Mirrors the allowlist in `update_appointment_status_as_doctor`. The two are
 * asserted to agree by test, by reading the migration — two copies of a rule
 * is a divergence waiting to happen, and the failure it prevents is concrete:
 * a button the workspace offers and the database then refuses.
 */
export const DOCTOR_ASSIGNABLE_STATUSES = [
  "confirmed",
  "in_consultation",
  "completed",
  "no_show",
] as const satisfies readonly AppointmentStatus[];

export type DoctorAssignableStatus =
  (typeof DOCTOR_ASSIGNABLE_STATUSES)[number];

export function isDoctorAssignableStatus(
  status: string,
): status is DoctorAssignableStatus {
  return (DOCTOR_ASSIGNABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * The statuses a practitioner may act **from**.
 *
 * The allowlist above says which statuses may be *set*; this says from where.
 * Both are needed — Phase 10 found that out when composing only the
 * transition matrix and a set of assignable statuses offered the front desk
 * an action it had no business taking.
 *
 * Mirrors the `case` branches in `update_appointment_status_as_doctor`, and
 * is asserted against them by reading the migration.
 */
export const DOCTOR_ACTIONABLE_FROM_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
  "in_consultation",
] as const satisfies readonly AppointmentStatus[];

export function isDoctorActionableStatus(status: AppointmentStatus): boolean {
  return (DOCTOR_ACTIONABLE_FROM_STATUSES as readonly string[]).includes(
    status,
  );
}

/**
 * Whether the practitioner may move an appointment from `from` to `to`.
 *
 * The third rule is the one that stops "record a no-show" being offered for a
 * patient who is already in the room: `in_consultation -> no_show` is not a
 * legal transition, so `canTransition` refuses it and this composition
 * inherits the refusal rather than restating it.
 */
export function canDoctorSetStatus(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (!isDoctorActionableStatus(from)) return false;
  if (!isDoctorAssignableStatus(to)) return false;
  return canTransition(from, to);
}

/**
 * Whether the consultation entry point should be offered.
 *
 * `phase_11.md` section 22: a consultation starts from an appointment that
 * is ready for one. The patient has been checked in at the desk, and the
 * practitioner is about to see them.
 *
 * This is the *only* meaning "start a consultation" has in Phase 11 — it
 * moves an appointment the database already knows about from `checked_in` to
 * `in_consultation`. It creates no clinical record, because there is no
 * clinical record to create (`phase_11.md` sections 19 and 51).
 */
export function canStartConsultation(status: AppointmentStatus): boolean {
  return canDoctorSetStatus(status, "in_consultation");
}

/** Whether the consultation can be closed. `in_consultation -> completed`. */
export function canCompleteConsultation(status: AppointmentStatus): boolean {
  return canDoctorSetStatus(status, "completed");
}

/** Whether a consultation is under way for this appointment. */
export function isConsultationInProgress(status: AppointmentStatus): boolean {
  return status === "in_consultation";
}

/** One offerable action on an appointment. */
export interface DoctorStatusAction {
  readonly status: DoctorAssignableStatus;
  /** The button's label. Names the action, never the resulting state. */
  readonly label: string;
  /** Whether it needs a confirmation step before it happens. */
  readonly confirm: boolean;
  /** The sentence the confirmation shows. Empty when it does not confirm. */
  readonly confirmBody: string;
}

const ACTION_PRESENTATION: Readonly<
  Record<DoctorAssignableStatus, Omit<DoctorStatusAction, "status">>
> = {
  confirmed: {
    label: "Confirm appointment",
    // Additive, and reversible in the only sense that matters — a confirmed
    // appointment can still be cancelled at the desk. Asking first would
    // train practitioners to dismiss dialogs.
    confirm: false,
    confirmBody: "",
  },
  in_consultation: {
    label: "Start consultation",
    confirm: false,
    confirmBody: "",
  },
  completed: {
    // Terminal. Once an appointment is completed nothing can move it, and a
    // mistake is corrected by a new appointment rather than by rewriting what
    // happened (`docs/DATABASE.md` sections 2 and 7).
    label: "Complete consultation",
    confirm: true,
    confirmBody:
      "This closes the appointment and records that the consultation took place. It cannot be undone.",
  },
  no_show: {
    label: "Record as not attended",
    confirm: true,
    confirmBody:
      "This records that the patient did not attend. It cannot be undone.",
  },
};

/**
 * The actions to offer for an appointment in this status, in the order a
 * practitioner would reach for them.
 *
 * The order is the lifecycle's own: confirm, start, complete, and then the
 * exception. A terminal appointment offers nothing, which is the correct
 * empty answer rather than a row of disabled buttons telling somebody
 * nothing they can act on.
 */
export function doctorActionsFor(
  status: AppointmentStatus,
): readonly DoctorStatusAction[] {
  if (isTerminalStatus(status)) return [];

  return DOCTOR_ASSIGNABLE_STATUSES.filter((candidate) =>
    canDoctorSetStatus(status, candidate),
  ).map((candidate) => ({
    status: candidate,
    ...ACTION_PRESENTATION[candidate],
  }));
}
