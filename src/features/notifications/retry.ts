/**
 * When to try again, and when to stop.
 *
 * ## The rule
 *
 * `phase_15.md` section 46: retry transient failures; do not retry anything
 * indefinitely. Four attempts over roughly twenty minutes, then the dead
 * letter — a delivery that has failed four times over twenty minutes is not
 * going to succeed on the fifth, and a queue that retries for ever is a queue
 * nobody ever looks at (section 105).
 *
 * A **permanent** failure is not retried at all, whatever the attempt count
 * says. Retrying an invalid recipient four times sends nothing four times.
 *
 * ## Pure, so it can be tested without a clock
 *
 * `now` is an argument. The same choice the Phase 09 availability engine made,
 * and for the same reason: a schedule you cannot test at an arbitrary instant
 * is a schedule you have not tested.
 */

import { NOTIFICATION_RETRY } from "@/config/notifications";

import type { ProviderFailureKind } from "./errors";

/**
 * When the next attempt becomes due, or `null` for "never again".
 *
 * `attempt` is the attempt that has just **completed**, counting from 1 — the
 * value the database returns from a claim, which has already been
 * incremented. So after the first failure `attempt` is 1 and the caller waits
 * the first backoff.
 */
export function nextRetryAt(
  attempt: number,
  now: Date,
  kind: ProviderFailureKind = "transient",
): Date | null {
  if (kind === "permanent") return null;
  if (!Number.isFinite(attempt) || attempt < 1) return null;
  if (attempt >= NOTIFICATION_RETRY.maxAttempts) return null;

  const backoff = NOTIFICATION_RETRY.backoffSeconds;
  // Past the end of the table the last interval repeats, which cannot happen
  // while `maxAttempts` is one more than the table's length — but a table
  // shortened later should degrade into a slower retry, not into a crash.
  const seconds = backoff[attempt - 1] ?? backoff[backoff.length - 1] ?? 60;

  return new Date(now.getTime() + seconds * 1000);
}

/** True when this attempt was the last one that will be made. */
export function isFinalAttempt(
  attempt: number,
  kind: ProviderFailureKind = "transient",
): boolean {
  return nextRetryAt(attempt, new Date(), kind) === null;
}
