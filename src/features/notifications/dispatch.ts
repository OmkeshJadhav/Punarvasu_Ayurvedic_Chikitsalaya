import "server-only";

/**
 * The one line a domain action adds.
 *
 * ## Why a domain action touches notifications at all
 *
 * It does not, really. The **event** was already written, by an after trigger,
 * inside the transaction the action had just committed — that is the whole
 * outbox guarantee and no application code participates in it
 * (`phase_15.md` sections 7, 8 and example 1).
 *
 * What this adds is *promptness*. Without it the outbox drains only when a
 * scheduler runs, and a patient whose appointment was just confirmed would
 * wait for the next tick to see it. With it, the drain happens as soon as the
 * response has been sent.
 *
 * ## Why `after()` and not `await`
 *
 * Section 103, and example 6. `after()` runs the callback once the response
 * is on its way, so:
 *
 *   * an email provider timing out cannot slow down the confirmation the
 *     receptionist is waiting to see;
 *   * a provider failing cannot fail the action, because the action has
 *     already returned;
 *   * a throw here cannot roll anything back, because the domain transaction
 *     committed before the trigger that wrote the event even ran.
 *
 * Awaiting the worker instead would reintroduce exactly the coupling the
 * outbox exists to remove.
 *
 * ## Why it cannot throw — in either direction
 *
 * Two separate catches, because there are two separate ways to fail.
 *
 * **Inside** the callback: a rejected promise there is an unhandled rejection
 * in a request that already succeeded. The worker is written not to throw;
 * this catches anyway, because "written not to" is not a guarantee.
 *
 * **Around the call**: `after()` itself throws when there is no request scope
 * — in a test, in a script, in any context the framework did not create. That
 * throw would land *synchronously inside the domain action*, after the
 * database write had committed, and turn a successful booking into an error
 * message. It would be exactly the coupling section 103 and example 6 exist to
 * forbid, arriving through the one line that was supposed to prevent it.
 *
 * So the scheduling itself is guarded. Outside a request scope this is a
 * no-op, and the outbox drains on the scheduler's next run — which is the
 * correct outcome, because there was no response for the work to happen
 * after.
 *
 * ## Why a domain feature may import this
 *
 * `docs/ARCHITECTURE.md` section 4 says a feature must not reach into another
 * feature's internals, and `docs/PRODUCT_SPEC.md` section 5A puts
 * notifications *beneath* appointments and clinical events — so an import
 * pointing from `features/appointments` to `features/notifications` deserves
 * an explanation rather than a shrug.
 *
 * The explanation is that **no notification concept crosses this edge**. This
 * function takes no argument, names no event, carries no payload and returns
 * nothing. It says "flush the queue", in the same register as
 * `revalidatePath`. The actual data flows the documented direction and does
 * not pass through the application at all: a database trigger writes the
 * outbox row inside the domain transaction, and the processor reads it later.
 *
 * Delete this import from all five call sites and nothing breaks except
 * promptness — every notification still arrives, on the scheduler's next run.
 * That is the test of whether an edge carries meaning, and this one does not.
 *
 * ## It is not the reliability mechanism
 *
 * Reminders need a scheduler and retries need one too: an opportunistic drain
 * only runs when somebody happens to do something. `POST
 * /api/notifications/process` is the reliable path, and its documentation says
 * what has to invoke it.
 */

import { after } from "next/server";

import { logger } from "@/lib/logging/logger";

import { runNotificationWorker } from "./processor";

/**
 * Drains the notification outbox once the current response has been sent.
 *
 * Safe to call from any server action. Safe to call when nothing is pending —
 * the claim returns an empty batch and the run costs one query.
 */
export function scheduleNotificationDispatch(): void {
  try {
    after(async () => {
      try {
        await runNotificationWorker();
      } catch (error) {
        // Deliberately swallowed. The event is still in the outbox with its
        // lease expired, so the next run — opportunistic or scheduled — picks
        // it up. Nothing about the domain operation is affected.
        logger.error("notification.dispatch_failed", error);
      }
    });
  } catch {
    // No request scope, so there is no response for the work to happen
    // after. Not logged: this is the expected state in a test or a script,
    // and an error line per call would be noise that trains people to ignore
    // the log. The scheduled worker drains the outbox regardless.
  }
}
