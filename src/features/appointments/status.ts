/**
 * The appointment status lifecycle, as rules rather than as strings.
 *
 * ## One matrix, two enforcers
 *
 * `phase_09.md` sections 7 and 37 require that a status change is not
 * something a client can request and the server saves. The enforcement that
 * actually matters lives in the database — `appointments_guard_transition()`
 * raises on an illegal transition, and no client holds an update grant on the
 * table at all, so there is no path to a status except through a function that
 * sets it.
 *
 * This module is the application's copy. It exists so the UI can decide
 * whether to offer a Cancel button, and so an action can refuse before making
 * a round trip. It is **not** the security boundary, and
 * `status.test.ts` asserts it agrees with the migration by reading the SQL —
 * two copies of a rule is a divergence waiting to happen.
 *
 * ## Terminal states are terminal
 *
 * `completed`, `cancelled` and `no_show` have no outgoing transition. A
 * mistake there is corrected by a new appointment and a record of why, not by
 * rewriting what happened (`docs/DATABASE.md` sections 2 and 7 — history is
 * never silently overwritten).
 *
 * ## What a patient can reach
 *
 * Only `cancelled`, and only from `requested` or `confirmed`. Confirming,
 * checking in, completing and marking a no-show are staff actions; they are in
 * the matrix because the lifecycle is the lifecycle, and they have no caller
 * in this phase because the receptionist and doctor workspaces are Phase 10
 * and 11 (`phase_09.md` sections 32-33).
 */

import type { AppointmentStatus } from "./types";

/** Every status, in lifecycle order. */
export const APPOINTMENT_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
  "in_consultation",
  "completed",
  "cancelled",
  "no_show",
] as const satisfies readonly AppointmentStatus[];

/**
 * **The transition matrix.** A status's entry is the whole set of statuses it
 * may move to.
 *
 * Written out rather than derived, so that reading this answers "what can
 * happen to a confirmed appointment?" without tracing code.
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<AppointmentStatus, readonly AppointmentStatus[]>
> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_consultation", "cancelled", "no_show"],
  in_consultation: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Statuses an appointment can still move out of. */
export const TERMINAL_STATUSES: readonly AppointmentStatus[] = [
  "completed",
  "cancelled",
  "no_show",
];

/**
 * Statuses that still hold a slot in the diary.
 *
 * Everything except `cancelled` — which is exactly the predicate on the
 * database's exclusion constraint, and deliberately so: a completed or missed
 * appointment occupied that time and still does, historically.
 */
export function holdsSlot(status: AppointmentStatus): boolean {
  return status !== "cancelled";
}

/** Whether a transition is permitted at all. */
export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  // A no-op is not a transition. The database trigger returns early on it too,
  // so the two agree about the one case that is neither legal nor illegal.
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: AppointmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Whether a patient may cancel an appointment in this status.
 *
 * Status only. Whether it is *also* in the future, and whether any
 * cancellation cutoff has passed, is {@link canPatientCancel}'s job — and the
 * database re-checks both, because a button that was rendered ten minutes ago
 * is not evidence of anything.
 */
export function isCancellableStatus(status: AppointmentStatus): boolean {
  return status === "requested" || status === "confirmed";
}

/** Whether a patient may move an appointment in this status. */
export function isReschedulableStatus(status: AppointmentStatus): boolean {
  return status === "requested" || status === "confirmed";
}

export interface PatientActionContext {
  readonly status: AppointmentStatus;
  readonly startsAt: Date;
  readonly now: Date;
  /**
   * How close to the appointment a patient may still cancel.
   *
   * Zero today: the clinic has set no cutoff (`phase_09.md` section 28), so a
   * patient may cancel any appointment that has not yet started.
   */
  readonly cancellationCutoffMinutes: number;
}

/**
 * Whether the Cancel action should be offered, and permitted.
 *
 * Used by the UI to decide what to render *and* by the server action to decide
 * whether to call the database. Neither is the guarantee: `cancel_appointment`
 * re-derives all of this, because the page a patient is looking at was
 * rendered at some point in the past.
 */
export function canPatientCancel(context: PatientActionContext): boolean {
  if (!isCancellableStatus(context.status)) return false;
  if (context.startsAt.getTime() <= context.now.getTime()) return false;

  if (context.cancellationCutoffMinutes > 0) {
    const cutoff =
      context.now.getTime() + context.cancellationCutoffMinutes * 60_000;
    if (context.startsAt.getTime() < cutoff) return false;
  }

  return true;
}

/**
 * Whether the Reschedule action should be offered, and permitted.
 *
 * Rescheduling is not gated by the cancellation cutoff: moving an appointment
 * leaves the clinic with a patient, whereas cancelling leaves it with a gap,
 * so a rule written for the second does not automatically apply to the first.
 * The clinic has set neither; if it sets a reschedule rule, it belongs here
 * and in `appointment_booking_rules()`.
 */
export function canPatientReschedule(
  context: Omit<PatientActionContext, "cancellationCutoffMinutes">,
): boolean {
  if (!isReschedulableStatus(context.status)) return false;
  return context.startsAt.getTime() > context.now.getTime();
}
