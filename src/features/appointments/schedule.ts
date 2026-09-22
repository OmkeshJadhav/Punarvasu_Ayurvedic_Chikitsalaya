/**
 * Reading a list of appointments: what is happening now, what is next, and
 * what is behind you.
 *
 * ## Why this is in the appointments feature rather than in a workspace
 *
 * Two staff workspaces ask the same two questions of the same data. Phase 10
 * answered them inside `features/reception/queries.ts`; Phase 11 needed the
 * identical answers for a practitioner's own diary, and a second copy is the
 * duplicated scheduling logic `docs/PRODUCT_SPEC.md` section 5A and
 * `phase_11.md` section 10 both forbid.
 *
 * So the two functions moved down here, where both workspaces already depend,
 * and became generic over the shape they actually need. `features/reception`
 * re-exports them so its callers are unchanged.
 *
 * ## No `server-only`
 *
 * Deliberately. These are pure functions of their arguments, with `now`
 * injected, so they are testable without a clock and usable from either side
 * of the boundary. Nothing here reads a session, a request or a database —
 * the authorization happened before the list was fetched.
 */

import type { AppointmentStatus } from "./types";

/**
 * The minimum an appointment needs to be placed on a timeline.
 *
 * A structural constraint rather than a concrete type, so the patient's
 * appointment, the front desk's and the practitioner's all satisfy it without
 * any of them having to become the same type. They are deliberately different
 * — each carries the fields its own screen may render, and no more.
 */
export interface ScheduleEntry {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly status: AppointmentStatus;
}

/**
 * The appointment happening now, and the one after it.
 *
 * "Now" is a real comparison against real stored instants, evaluated at the
 * moment the caller asks. It is as current as the render that produced it, and
 * there is no ticking clock claiming otherwise — `phase_10.md` section 9 and
 * `phase_11.md` section 8 both rule out a fake live indicator.
 *
 * A cancelled or missed appointment is neither current nor next: nobody is in
 * the room and nobody is coming.
 */
export function currentAndNext<T extends ScheduleEntry>(
  appointments: readonly T[],
  now: Date = new Date(),
): { readonly current: T | null; readonly next: T | null } {
  const moment = now.getTime();

  const live = appointments.filter(
    (appointment) =>
      appointment.status !== "cancelled" && appointment.status !== "no_show",
  );

  const current =
    live.find(
      (appointment) =>
        appointment.startsAt.getTime() <= moment &&
        appointment.endsAt.getTime() > moment,
    ) ?? null;

  const next =
    live.find((appointment) => appointment.startsAt.getTime() > moment) ?? null;

  return { current, next };
}

/**
 * Splits appointments into what is still to come and what is not.
 *
 * "Upcoming" is decided by the appointment's **end**, so a consultation that
 * is under way still reads as upcoming rather than dropping out of view while
 * the patient is in the room. A cancelled appointment is never upcoming,
 * whatever its time.
 *
 * Soonest first for what is still to come, most recent first for what is
 * over. Both are the order somebody scans them in.
 */
export function partitionByTime<T extends ScheduleEntry>(
  appointments: readonly T[],
  now: Date = new Date(),
): { readonly upcoming: readonly T[]; readonly past: readonly T[] } {
  const moment = now.getTime();

  const upcoming = appointments
    .filter(
      (appointment) =>
        appointment.status !== "cancelled" &&
        appointment.endsAt.getTime() > moment,
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const past = appointments
    .filter(
      (appointment) =>
        appointment.status === "cancelled" ||
        appointment.endsAt.getTime() <= moment,
    )
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  return { upcoming, past };
}
