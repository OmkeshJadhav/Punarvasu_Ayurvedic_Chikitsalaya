import { timingSafeEqual } from "node:crypto";

import { WORKER_RATE_LIMIT } from "@/config/notifications";
import { getNotificationsWorkerSecret } from "@/config/env.server";
import { apiSuccess } from "@/lib/api/response";
import { createRouteHandler } from "@/lib/api/route-handler";
import { rateLimitedError, unauthorizedError } from "@/lib/errors/app-error";
import { createFixedWindowRateLimiter } from "@/lib/rate-limit/fixed-window";
import { runNotificationWorker } from "@/features/notifications/processor";

/**
 * Drains the notification outbox, releases due reminders and attempts pending
 * external deliveries.
 *
 * ## This is the reliable path
 *
 * Server actions drain the outbox opportunistically through `after()`, which
 * makes a confirmation appear promptly. It does **not** make anything
 * reliable: an opportunistic drain runs only when somebody happens to do
 * something, and a reminder that falls due at four in the morning needs
 * somebody to wake it.
 *
 * **Reminders and retries therefore require a scheduler.** Without one the
 * machinery is correct and idle. Invoke this endpoint every few minutes with
 * whatever the deployment has:
 *
 * ```text
 *   Vercel Cron      vercel.json -> { "crons": [{ "path": "/api/notifications/process",
 *                                                 "schedule": "*./5 * * * *" }] }
 *                    plus a request header carrying the secret
 *
 *   Supabase         select cron.schedule('punarvasu-notifications', '*./5 * * * *',
 *   pg_cron          $$ select net.http_post(
 *                         url := 'https://<host>/api/notifications/process',
 *                         headers := '{"authorization":"Bearer <secret>"}'::jsonb) $$);
 *
 *   anything else    curl -X POST -H "authorization: Bearer <secret>" <url>
 * ```
 *
 * ## Authentication
 *
 * A shared secret in `NOTIFICATIONS_WORKER_SECRET`, compared in constant time.
 *
 * When it is unset the endpoint **refuses every request**. That is deliberate
 * and is the difference between "not configured" and "configured wrong": an
 * endpoint that drains a queue and sends email must never default to open
 * because a variable is missing. Phase 06's Send Email hook took the same
 * position for the same reason.
 *
 * ## What it discloses
 *
 * Counts. How many events were processed, skipped, retried or failed; how many
 * reminders were released or cancelled; how many deliveries were attempted.
 * No identifier, no recipient, no title, no body, no link — a scheduler's log
 * is not a place for any of those (`phase_15.md` sections 77, 78).
 *
 * A refused request discloses nothing at all, not even whether the secret is
 * configured: both answer `401` with the same body.
 *
 * ## Why POST
 *
 * It changes state. A `GET` that drains a queue is one prefetch away from
 * running when nobody asked.
 */

/**
 * Per instance and in memory — a guard rail on secret-guessing and on a
 * scheduler misconfigured into a loop, not a distributed quota. The limiter's
 * own documentation is explicit about the difference.
 */
const limiter = createFixedWindowRateLimiter({
  maxRequests: WORKER_RATE_LIMIT.maxRequests,
  windowMs: WORKER_RATE_LIMIT.windowMs,
});

export const dynamic = "force-dynamic";

export const POST = createRouteHandler(
  "notifications.process",
  async (request, { log }) => {
    // Keyed on the path rather than on the caller: the endpoint has one
    // legitimate caller, so one bucket is the whole quota and there is no
    // client-controlled value to key on (which would be a memory leak an
    // attacker controls).
    const limit = limiter.check("notifications.process");

    if (!limit.allowed) {
      log.warn("notification.worker_rate_limited");
      throw rateLimitedError({
        cause: new Error("Notification worker rate limit exceeded."),
      });
    }

    const secret = getNotificationsWorkerSecret();

    if (!secret) {
      // Named once so an operator can see why the scheduler is being
      // refused. The value, obviously, is not logged — there is none.
      log.warn("notification.worker_not_configured");
      throw unauthorizedError({
        cause: new Error("NOTIFICATIONS_WORKER_SECRET is not configured."),
      });
    }

    if (!isAuthorized(request.headers.get("authorization"), secret)) {
      log.warn("notification.worker_unauthorized");
      throw unauthorizedError({
        cause: new Error("Notification worker secret did not match."),
      });
    }

    const summary = await runNotificationWorker();

    // Counts only.
    return apiSuccess(summary, {
      headers: { "cache-control": "private, no-store" },
    });
  },
);

/**
 * Constant-time comparison of `Authorization: Bearer <secret>`.
 *
 * Length is checked first, because `timingSafeEqual` throws on a length
 * mismatch — and a throw inside an authentication check is its own kind of
 * oracle. The lengths of two secrets differing is not information worth
 * protecting; the bytes are.
 */
function isAuthorized(header: string | null, secret: string): boolean {
  if (!header) return false;

  const prefix = "bearer ";
  if (!header.toLowerCase().startsWith(prefix)) return false;

  const presented = Buffer.from(header.slice(prefix.length).trim(), "utf8");
  const expected = Buffer.from(secret, "utf8");

  if (presented.length !== expected.length) return false;

  return timingSafeEqual(presented, expected);
}
