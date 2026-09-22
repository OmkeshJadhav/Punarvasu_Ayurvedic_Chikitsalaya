import { describe, expect, it } from "vitest";

import { createFixedWindowRateLimiter } from "./fixed-window";

/**
 * The rate limiter.
 *
 * A guard rail on one instance, tested at an arbitrary instant rather than by
 * sleeping — `now` is injectable for the same reason the Phase 09 availability
 * engine's was.
 */

function limiterAt(start: number, maxRequests = 3, windowMs = 1000) {
  let now = start;
  const limiter = createFixedWindowRateLimiter({
    maxRequests,
    windowMs,
    now: () => now,
  });

  return {
    limiter,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("createFixedWindowRateLimiter", () => {
  it("allows up to the limit", () => {
    const { limiter } = limiterAt(0);

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("refuses past the limit", () => {
    const { limiter } = limiterAt(0);

    limiter.check("a");
    limiter.check("a");
    limiter.check("a");

    const result = limiter.check("a");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets when the window passes", () => {
    const { limiter, advance } = limiterAt(0);

    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    advance(1001);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("keeps separate buckets per key", () => {
    const { limiter } = limiterAt(0);

    limiter.check("a");
    limiter.check("a");
    limiter.check("a");

    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("reports a retry delay of at least a second", () => {
    // A `Retry-After: 0` tells a caller to come straight back.
    const { limiter, advance } = limiterAt(0, 1, 1000);

    limiter.check("a");
    advance(999);

    expect(limiter.check("a").retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("bounds how many keys it tracks", () => {
    // A limiter keyed on something an attacker controls is a memory leak an
    // attacker controls. The oldest key is discarded rather than the map
    // growing without limit.
    const bounded = createFixedWindowRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      maxKeys: 2,
      now: () => 0,
    });

    bounded.check("first");
    bounded.check("second");
    bounded.check("third");

    // "first" was evicted, so it starts a fresh window rather than being
    // remembered for ever.
    expect(bounded.check("first").allowed).toBe(true);
    // "third" is still tracked and still limited.
    expect(bounded.check("third").allowed).toBe(false);
  });
});
