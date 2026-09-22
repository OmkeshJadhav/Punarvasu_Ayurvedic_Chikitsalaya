import "server-only";

/**
 * A fixed-window rate limiter, in memory.
 *
 * ## What it is, said plainly
 *
 * A guard rail on one server instance. It is **not** a distributed quota: two
 * instances keep two counters, and a restart clears them. Anything that needs
 * a real quota — abuse prevention on a public endpoint, a per-account limit
 * that has to hold across a fleet — needs shared state and is a different
 * thing entirely.
 *
 * Saying so matters, because an in-memory limiter that is described as more
 * than it is becomes the reason nobody adds the real one.
 *
 * ## What it is for here
 *
 * `phase_15.md` section 108 asks for rate limits on webhook and
 * notification-triggering endpoints. The only endpoint this phase adds is the
 * worker, which is already behind a shared secret; this bounds the cost of
 * somebody guessing at that secret and bounds a scheduler that has been
 * misconfigured into a loop.
 *
 * The thing section 108 most cares about — "do not allow a user to
 * intentionally spam another person's email or phone" — is not solved by a
 * rate limit in this design and does not need to be: there is no endpoint that
 * takes a recipient, so there is nothing to aim at anybody.
 *
 * ## Fixed window, not a sliding one
 *
 * A fixed window lets through up to twice the limit across a boundary. For a
 * guard rail on an authenticated internal endpoint that is an acceptable
 * trade for not keeping a timestamp per request, and the alternative is
 * complexity nothing here needs.
 */

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Seconds until the window resets. For a `Retry-After` header. */
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

/**
 * Creates a limiter.
 *
 * `now` is injectable so the behaviour at a window boundary can be tested at
 * an arbitrary instant rather than by sleeping.
 */
export function createFixedWindowRateLimiter(options: {
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly now?: () => number;
  /**
   * How many distinct keys to track before the oldest are discarded.
   *
   * Bounded deliberately: a limiter keyed on something an attacker controls
   * is a memory leak an attacker controls.
   */
  readonly maxKeys?: number;
}): RateLimiter {
  const clock = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 1000;
  const windows = new Map<string, Window>();

  return {
    check(key: string): RateLimitResult {
      const now = clock();
      const existing = windows.get(key);

      if (!existing || existing.resetAt <= now) {
        if (windows.size >= maxKeys) {
          // Map iteration order is insertion order, so this discards the
          // oldest key. Crude, bounded, and adequate for a guard rail.
          const oldest = windows.keys().next();
          if (!oldest.done) windows.delete(oldest.value);
        }

        windows.set(key, { count: 1, resetAt: now + options.windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      existing.count += 1;

      if (existing.count > options.maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.resetAt - now) / 1000),
          ),
        };
      }

      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
