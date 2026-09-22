import { describe, expect, it } from "vitest";

import { NOTIFICATION_RETRY } from "@/config/notifications";

import { isFinalAttempt, nextRetryAt } from "./retry";

/**
 * When to try again, and when to stop.
 *
 * `phase_15.md` section 46. The two properties that matter are that a
 * transient failure *is* retried, with increasing delay, and that **nothing**
 * is retried for ever — a queue that retries indefinitely is a queue nobody
 * looks at.
 */

const NOW = new Date("2026-09-19T10:00:00.000Z");

function secondsAfterNow(at: Date | null): number | null {
  return at === null ? null : (at.getTime() - NOW.getTime()) / 1000;
}

describe("nextRetryAt", () => {
  it("backs off further after each failure", () => {
    const delays = [1, 2, 3].map((attempt) =>
      secondsAfterNow(nextRetryAt(attempt, NOW)),
    );

    expect(delays).toEqual([...NOTIFICATION_RETRY.backoffSeconds]);
  });

  it("stops after the last attempt", () => {
    expect(nextRetryAt(NOTIFICATION_RETRY.maxAttempts, NOW)).toBeNull();
    expect(nextRetryAt(NOTIFICATION_RETRY.maxAttempts + 5, NOW)).toBeNull();
  });

  it("never retries a permanent failure, whatever the attempt count", () => {
    // Section 46. Retrying an invalid recipient four times sends nothing
    // four times.
    for (const attempt of [1, 2, 3, 99]) {
      expect(nextRetryAt(attempt, NOW, "permanent")).toBeNull();
    }
  });

  it("gives up within a bounded wall-clock window", () => {
    // The whole schedule, summed. A delivery that has failed for this long is
    // not going to succeed, and somebody should be looking at the dead
    // letter rather than at a queue that is still hoping.
    const total = NOTIFICATION_RETRY.backoffSeconds.reduce(
      (sum, seconds) => sum + seconds,
      0,
    );

    expect(total).toBeLessThanOrEqual(3600);
  });

  it("refuses a nonsensical attempt count rather than computing one", () => {
    for (const attempt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(nextRetryAt(attempt, NOW)).toBeNull();
    }
  });

  it("is pure — the same inputs give the same instant", () => {
    expect(nextRetryAt(1, NOW)?.toISOString()).toBe(
      nextRetryAt(1, NOW)?.toISOString(),
    );
  });

  it("takes `now` as an argument rather than reading a clock", () => {
    const later = new Date("2027-01-01T00:00:00.000Z");
    const at = nextRetryAt(1, later);

    expect(at?.getTime()).toBe(
      later.getTime() + (NOTIFICATION_RETRY.backoffSeconds[0] ?? 0) * 1000,
    );
  });
});

describe("isFinalAttempt", () => {
  it("is false while retries remain", () => {
    expect(isFinalAttempt(1)).toBe(false);
  });

  it("is true at the cap", () => {
    expect(isFinalAttempt(NOTIFICATION_RETRY.maxAttempts)).toBe(true);
  });

  it("is true immediately for a permanent failure", () => {
    expect(isFinalAttempt(1, "permanent")).toBe(true);
  });
});
