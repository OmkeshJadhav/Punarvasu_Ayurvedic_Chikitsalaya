import { describe, expect, it, vi } from "vitest";

/**
 * The dispatch seam.
 *
 * One property, and it is the whole reason this module is separate: **calling
 * it can never fail the operation that just succeeded.**
 *
 * That is not hypothetical. `after()` throws when there is no request scope,
 * and without the guard that throw lands synchronously inside a domain action
 * — after the database write has committed — and turns a confirmed
 * appointment into an error message on the receptionist's screen. It is
 * exactly the coupling `phase_15.md` section 103 and example 6 forbid,
 * arriving through the one line that was supposed to prevent it.
 *
 * This suite was written because a full test run found it.
 */

const runNotificationWorker = vi.fn();

vi.mock("@/features/notifications/processor", () => ({
  runNotificationWorker: () => runNotificationWorker(),
}));

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@/lib/logging/logger", () => ({
  logger,
  __esModule: true,
}));

describe("scheduleNotificationDispatch", () => {
  it("does not throw outside a request scope", async () => {
    // The real `next/server` `after()`, which throws here — a Vitest run has
    // no request scope, exactly like a script or a background job.
    const { scheduleNotificationDispatch } = await import("./dispatch");

    expect(() => scheduleNotificationDispatch()).not.toThrow();
  });

  it("does not run the worker when there is nothing to run it after", async () => {
    // The correct outcome, not a degraded one: there was no response for the
    // work to happen after, and the scheduled worker drains the outbox
    // regardless.
    runNotificationWorker.mockClear();

    const { scheduleNotificationDispatch } = await import("./dispatch");
    scheduleNotificationDispatch();

    expect(runNotificationWorker).not.toHaveBeenCalled();
  });

  it("swallows a worker failure rather than rejecting", async () => {
    // Inside a request scope this time, with `after()` stubbed to run the
    // callback immediately. A rejected promise here would be an unhandled
    // rejection in a request that already succeeded.
    vi.resetModules();

    const scheduled: (() => Promise<unknown>)[] = [];

    vi.doMock("next/server", () => ({
      after: (task: () => Promise<unknown>) => {
        scheduled.push(task);
      },
    }));

    const failing = vi.fn().mockRejectedValue(new Error("provider exploded"));
    vi.doMock("@/features/notifications/processor", () => ({
      runNotificationWorker: failing,
    }));

    const { scheduleNotificationDispatch } = await import("./dispatch");

    scheduleNotificationDispatch();
    expect(scheduled).toHaveLength(1);

    await expect(scheduled[0]?.()).resolves.toBeUndefined();
    expect(failing).toHaveBeenCalledTimes(1);

    vi.doUnmock("next/server");
    vi.doUnmock("@/features/notifications/processor");
    vi.resetModules();
  });

  it("takes no argument, so no notification concept crosses the edge", async () => {
    // The reason a domain feature may import this at all: it says "flush the
    // queue", in the same register as `revalidatePath`. Delete it from every
    // call site and nothing breaks except promptness.
    const { scheduleNotificationDispatch } = await import("./dispatch");

    expect(scheduleNotificationDispatch.length).toBe(0);
  });
});
