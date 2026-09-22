import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The notification processor.
 *
 * These assert the properties the whole phase rests on:
 *
 *   * a **stale event does not send** — the processor reads the resource's
 *     current state and refuses to announce something that is no longer true
 *     (`phase_15.md` sections 116, 117, 122, 123);
 *   * a **superseded event does not send** — an appointment event carries the
 *     start instant it was emitted for, so two reschedules processed out of
 *     order cannot announce the older one (section 118);
 *   * a **draft prescription produces no final-prescription notification**,
 *     which is checked twice: the trigger only fires on the transition into
 *     `issued`, and this refuses anything that is not `issued` when it runs;
 *   * **reminders are recomputed from the authoritative appointment**, so a
 *     cancellation and a reschedule invalidate the old ones (sections 29, 30,
 *     68, 69, 70, and example 5);
 *   * **processing an event twice produces one notification**, because the
 *     creation is idempotent on a stable key (sections 47, 119, 120, and
 *     example 7);
 *   * a **provider failure is retried when transient and not when permanent**,
 *     and never for ever (sections 45, 46);
 *   * **no recipient, title, body, link or address reaches a log** (sections
 *     77, 78);
 *   * an unconfigured channel **creates no delivery at all**, rather than a
 *     queue that never drains (sections 12, 14).
 *
 * ## What they prove, and what they do not
 *
 * The Supabase client is a recording stub, so this exercises the
 * **application's** side of the boundary: which functions the processor calls,
 * with what arguments, in what order, and what it does with each answer.
 *
 * The other half — that the outbox row is written inside the domain
 * transaction, that `create_notification` is genuinely idempotent, that the
 * reminder planner genuinely cancels — is a property of
 * `supabase/migrations/20260926120000_notifications.sql`, asserted
 * structurally in `notification-security.test.ts`. Both halves are needed;
 * neither substitutes for the other.
 */

const APPOINTMENT_ID = "11111111-1111-4111-8111-111111111111";
const PRESCRIPTION_ID = "22222222-2222-4222-8222-222222222222";
const PLAN_ID = "33333333-3333-4333-8333-333333333333";
const NOTIFICATION_ID = "44444444-4444-4444-8444-444444444444";
const DELIVERY_ID = "55555555-5555-4555-8555-555555555555";

/** 2026-09-19T05:00:00Z — 10:30 am in the clinic's timezone. */
const STARTS_AT = "2026-09-19T05:00:00.000Z";
const STARTS_AT_EPOCH = Math.floor(Date.parse(STARTS_AT) / 1000);

const PRACTITIONER = "Dr Anaya Kulkarni";
const PATIENT_EMAIL = "patient@example.test";

interface RpcCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

let rpcCalls: RpcCall[] = [];
let rpcResults: Record<string, { data: unknown; error: unknown }> = {};
let rpcQueues: Record<string, { data: unknown; error: unknown }[]> = {};

const logLines: string[] = [];
let channels: unknown[] = [];
const sendMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push({ name, args });
      const queued = rpcQueues[name]?.shift();
      if (queued) return queued;
      return rpcResults[name] ?? { data: null, error: null };
    },
  }),
}));

vi.mock("@/lib/notifications/channel", () => ({
  resolveChannels: () => channels,
  hasConfiguredExternalChannel: () => channels.length > 0,
}));

vi.mock("@/lib/logging/logger", () => {
  const record = (event: string, ...rest: unknown[]) => {
    logLines.push(`${event} ${JSON.stringify(rest)}`);
  };
  return {
    logger: {
      debug: record,
      info: record,
      warn: record,
      error: record,
      child: () => ({
        debug: record,
        info: record,
        warn: record,
        error: record,
      }),
    },
  };
});

const { runNotificationWorker } =
  await import("@/features/notifications/processor");

function pgError(code: string, message = "internal database detail") {
  return { code, message, details: null, hint: null };
}

function outboxEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    event_type: "appointment_confirmed",
    subject_type: "appointment",
    subject_id: APPOINTMENT_ID,
    dedupe_key: `appointment:${APPOINTMENT_ID}:confirmed:${STARTS_AT_EPOCH}`,
    attempt_count: 1,
    occurred_at: "2026-09-18T09:00:00.000Z",
    ...overrides,
  };
}

function appointmentContext(status = "confirmed", startsAt = STARTS_AT) {
  return [
    {
      status,
      starts_at: startsAt,
      ends_at: "2026-09-19T05:45:00.000Z",
      practitioner_name: PRACTITIONER,
      appointment_type_name: "Initial consultation",
    },
  ];
}

function emailChannel() {
  return {
    channel: "email",
    provider: "emailjs",
    send: sendMock,
  };
}

function callsTo(name: string): RpcCall[] {
  return rpcCalls.filter((call) => call.name === name);
}

beforeEach(() => {
  rpcCalls = [];
  rpcQueues = {};
  logLines.length = 0;
  channels = [];
  sendMock.mockReset();
  sendMock.mockResolvedValue({ status: "sent" });

  rpcResults = {
    claim_notification_outbox: { data: [], error: null },
    complete_notification_outbox: { data: null, error: null },
    notification_appointment_context: {
      data: appointmentContext(),
      error: null,
    },
    notification_prescription_context: {
      data: [
        {
          status: "issued",
          issued_at: STARTS_AT,
          practitioner_name: PRACTITIONER,
        },
      ],
      error: null,
    },
    notification_treatment_plan_context: {
      data: [
        {
          status: "active",
          activated_at: STARTS_AT,
          practitioner_name: PRACTITIONER,
        },
      ],
      error: null,
    },
    create_notification: { data: NOTIFICATION_ID, error: null },
    plan_appointment_reminders: { data: [], error: null },
    cancel_appointment_reminders: { data: 0, error: null },
    release_due_reminders: { data: [], error: null },
    enqueue_notification_delivery: { data: DELIVERY_ID, error: null },
    claim_notification_deliveries: { data: [], error: null },
    record_notification_delivery_result: { data: null, error: null },
  };
});

/* ------------------------------------------------------------------------ */

describe("appointment confirmation", () => {
  it("creates one notification from the event", async () => {
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxProcessed).toBe(1);

    const created = callsTo("create_notification");
    expect(created).toHaveLength(1);
    expect(created[0]?.args.p_event_type).toBe("appointment_confirmed");
    expect(created[0]?.args.p_resource_type).toBe("appointment");
    expect(created[0]?.args.p_resource_id).toBe(APPOINTMENT_ID);
    expect(created[0]?.args.p_status).toBe("active");
  });

  it("passes no recipient, no link and no channel", () => {
    // Sections 54, 72, 84, 110. The database resolves the recipient from the
    // resource and derives the link; neither is a parameter anywhere.
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };

    return runNotificationWorker().then(() => {
      const args = callsTo("create_notification")[0]?.args ?? {};
      const names = Object.keys(args).join(" ").toLowerCase();

      expect(names).not.toContain("recipient");
      expect(names).not.toContain("user");
      expect(names).not.toContain("email");
      expect(names).not.toContain("phone");
      expect(names).not.toContain("link");
      expect(names).not.toContain("url");
      expect(names).not.toContain("patient");
    });
  });

  it("reads the authoritative appointment before it renders anything", () => {
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };

    return runNotificationWorker().then(() => {
      const contextIndex = rpcCalls.findIndex(
        (call) => call.name === "notification_appointment_context",
      );
      const createIndex = rpcCalls.findIndex(
        (call) => call.name === "create_notification",
      );

      expect(contextIndex).toBeGreaterThanOrEqual(0);
      expect(createIndex).toBeGreaterThan(contextIndex);
    });
  });

  it("skips the event when the appointment is no longer confirmed", async () => {
    // Section 117's own example: a confirmation event that has been sitting
    // in the queue while the appointment was cancelled.
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };
    rpcResults.notification_appointment_context = {
      data: appointmentContext("cancelled"),
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxSkipped).toBe(1);
    expect(callsTo("create_notification")).toHaveLength(0);
    expect(callsTo("complete_notification_outbox")[0]?.args.p_status).toBe(
      "skipped",
    );
  });

  it("skips an event whose time the appointment no longer starts at", async () => {
    // Section 118. Two reschedules processed out of order must not announce
    // the older one.
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };
    rpcResults.notification_appointment_context = {
      data: appointmentContext("confirmed", "2026-09-20T05:00:00.000Z"),
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxSkipped).toBe(1);
    expect(callsTo("create_notification")).toHaveLength(0);
    expect(callsTo("complete_notification_outbox")[0]?.args.p_error_code).toBe(
      "superseded",
    );
  });

  it("skips when the resource has gone", async () => {
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };
    rpcResults.notification_appointment_context = { data: [], error: null };

    const summary = await runNotificationWorker();

    expect(summary.outboxSkipped).toBe(1);
    expect(callsTo("complete_notification_outbox")[0]?.args.p_error_code).toBe(
      "resource_missing",
    );
  });

  it("skips, rather than fails, when there is nobody to notify", async () => {
    // A walk-in registered at the front desk has a clinic record and no
    // login. Retrying that for ever would be a queue that never drains.
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };
    rpcResults.create_notification = { data: null, error: pgError("PV050") };

    const summary = await runNotificationWorker();

    expect(summary.outboxSkipped).toBe(1);
    expect(summary.outboxFailed).toBe(0);
    expect(callsTo("complete_notification_outbox")[0]?.args.p_error_code).toBe(
      "no_recipient",
    );
  });
});

describe("idempotency", () => {
  it("uses the event's own key, so processing it twice creates one notification", async () => {
    // Sections 119 and 120, and example 7. The key is the outbox row's, which
    // is unique — so the second pass reaches an insert that does nothing and
    // returns the first notification.
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };

    await runNotificationWorker();
    const firstKey = callsTo("create_notification")[0]?.args.p_dedupe_key;

    rpcCalls = [];
    await runNotificationWorker();
    const secondKey = callsTo("create_notification")[0]?.args.p_dedupe_key;

    expect(firstKey).toBe(secondKey);
    expect(firstKey).toBe(
      `appointment:${APPOINTMENT_ID}:confirmed:${STARTS_AT_EPOCH}`,
    );
  });

  it("enqueues one delivery per channel, keyed by the notification", async () => {
    channels = [emailChannel()];
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };

    await runNotificationWorker();

    const enqueued = callsTo("enqueue_notification_delivery");
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.args.p_notification_id).toBe(NOTIFICATION_ID);
    expect(enqueued[0]?.args.p_channel).toBe("email");
  });
});

describe("appointment cancellation", () => {
  it("notifies and cancels every scheduled reminder", async () => {
    rpcResults.claim_notification_outbox = {
      data: [
        outboxEvent({
          event_type: "appointment_cancelled",
          dedupe_key: `appointment:${APPOINTMENT_ID}:cancelled`,
        }),
      ],
      error: null,
    };
    rpcResults.notification_appointment_context = {
      data: appointmentContext("cancelled"),
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxProcessed).toBe(1);
    expect(callsTo("cancel_appointment_reminders")).toHaveLength(1);
    // Section 68: the old reminder must not fire, and it is removed rather
    // than left to be refused later.
    expect(callsTo("plan_appointment_reminders")).toHaveLength(0);
  });

  it("does not announce a cancellation for an appointment that is not cancelled", async () => {
    rpcResults.claim_notification_outbox = {
      data: [
        outboxEvent({
          event_type: "appointment_cancelled",
          dedupe_key: `appointment:${APPOINTMENT_ID}:cancelled`,
        }),
      ],
      error: null,
    };
    rpcResults.notification_appointment_context = {
      data: appointmentContext("confirmed"),
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxSkipped).toBe(1);
    expect(callsTo("create_notification")).toHaveLength(0);
  });
});

describe("reminders", () => {
  it("recomputes the set from the authoritative appointment after a reschedule", async () => {
    // Example 5. The planner cancels what is no longer correct and returns
    // what is; the processor renders exactly what it returned.
    rpcResults.claim_notification_outbox = {
      data: [
        outboxEvent({
          event_type: "appointment_rescheduled",
          dedupe_key: `appointment:${APPOINTMENT_ID}:rescheduled:${STARTS_AT_EPOCH}`,
        }),
      ],
      error: null,
    };
    rpcResults.plan_appointment_reminders = {
      data: [
        {
          offset_minutes: 1440,
          scheduled_for: "2026-09-18T05:00:00.000Z",
          dedupe_key: `appointment:${APPOINTMENT_ID}:reminder:1440:${STARTS_AT_EPOCH}`,
        },
      ],
      error: null,
    };

    await runNotificationWorker();

    const reminders = callsTo("create_notification").filter(
      (call) => call.args.p_event_type === "appointment_reminder",
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.args.p_status).toBe("scheduled");
    expect(reminders[0]?.args.p_reminder_offset_minutes).toBe(1440);
    expect(reminders[0]?.args.p_dedupe_key).toContain(":reminder:1440:");
  });

  it("does not choose its own schedule", async () => {
    // The offsets are configuration the database reads for itself. A caller
    // that could pass them could ask for a reminder the clinic never agreed
    // to.
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };

    await runNotificationWorker();

    const planned = callsTo("plan_appointment_reminders")[0];
    expect(planned).toBeDefined();
    expect(Object.keys(planned?.args ?? {})).toEqual(["p_appointment_id"]);
  });

  it("creates a scheduled reminder, which the patient cannot yet see", async () => {
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };
    rpcResults.plan_appointment_reminders = {
      data: [
        {
          offset_minutes: 120,
          scheduled_for: "2026-09-19T03:00:00.000Z",
          dedupe_key: `appointment:${APPOINTMENT_ID}:reminder:120:${STARTS_AT_EPOCH}`,
        },
      ],
      error: null,
    };
    channels = [emailChannel()];

    await runNotificationWorker();

    const reminder = callsTo("create_notification").find(
      (call) => call.args.p_event_type === "appointment_reminder",
    );
    expect(reminder?.args.p_status).toBe("scheduled");

    // A scheduled reminder gets no delivery until it is released. Only the
    // confirmation's own notification was enqueued.
    expect(callsTo("enqueue_notification_delivery")).toHaveLength(1);
  });

  it("enqueues a delivery only for a reminder that was released", async () => {
    channels = [emailChannel()];
    rpcResults.release_due_reminders = {
      data: [
        { notification_id: NOTIFICATION_ID, released: true },
        {
          notification_id: "66666666-6666-4666-8666-666666666666",
          released: false,
        },
      ],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.remindersReleased).toBe(1);
    expect(summary.remindersCancelled).toBe(1);

    const enqueued = callsTo("enqueue_notification_delivery");
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.args.p_notification_id).toBe(NOTIFICATION_ID);
  });

  it("releases reminders on every run, even with an empty outbox", async () => {
    // Sections 67 and 102: a reminder falling due at four in the morning
    // needs somebody to wake it, and nothing else does.
    await runNotificationWorker();

    expect(callsTo("release_due_reminders")).toHaveLength(1);
  });
});

describe("prescriptions", () => {
  it("notifies when the prescription is issued", async () => {
    rpcResults.claim_notification_outbox = {
      data: [
        outboxEvent({
          event_type: "prescription_issued",
          subject_type: "prescription",
          subject_id: PRESCRIPTION_ID,
          dedupe_key: `prescription:${PRESCRIPTION_ID}:issued`,
        }),
      ],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxProcessed).toBe(1);
    const created = callsTo("create_notification")[0];
    expect(created?.args.p_event_type).toBe("prescription_issued");
    expect(created?.args.p_category).toBe("clinical_updates");
  });

  it("does not notify for a draft", async () => {
    // The acceptance criterion, checked at the moment the message would be
    // sent rather than only at the moment the event was written.
    rpcResults.claim_notification_outbox = {
      data: [
        outboxEvent({
          event_type: "prescription_issued",
          subject_type: "prescription",
          subject_id: PRESCRIPTION_ID,
          dedupe_key: `prescription:${PRESCRIPTION_ID}:issued`,
        }),
      ],
      error: null,
    };
    rpcResults.notification_prescription_context = {
      data: [
        { status: "draft", issued_at: null, practitioner_name: PRACTITIONER },
      ],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxSkipped).toBe(1);
    expect(callsTo("create_notification")).toHaveLength(0);
  });

  it("sends no medicine, dose or item", async () => {
    rpcResults.claim_notification_outbox = {
      data: [
        outboxEvent({
          event_type: "prescription_issued",
          subject_type: "prescription",
          subject_id: PRESCRIPTION_ID,
          dedupe_key: `prescription:${PRESCRIPTION_ID}:issued`,
        }),
      ],
      error: null,
    };

    await runNotificationWorker();

    const args = callsTo("create_notification")[0]?.args ?? {};
    const body = `${String(args.p_title)} ${String(args.p_body)}`;

    expect(body).not.toMatch(/\bmg\b|\bml\b|twice daily|tablet|churna/i);
  });
});

describe("treatment plans", () => {
  it("notifies on activation and not before", async () => {
    const event = outboxEvent({
      event_type: "treatment_plan_activated",
      subject_type: "treatment_plan",
      subject_id: PLAN_ID,
      dedupe_key: `treatment_plan:${PLAN_ID}:activated`,
    });

    rpcResults.claim_notification_outbox = { data: [event], error: null };
    rpcResults.notification_treatment_plan_context = {
      data: [
        {
          status: "draft",
          activated_at: null,
          practitioner_name: PRACTITIONER,
        },
      ],
      error: null,
    };

    expect((await runNotificationWorker()).outboxSkipped).toBe(1);

    rpcCalls = [];
    rpcResults.notification_treatment_plan_context = {
      data: [
        {
          status: "active",
          activated_at: STARTS_AT,
          practitioner_name: PRACTITIONER,
        },
      ],
      error: null,
    };

    expect((await runNotificationWorker()).outboxProcessed).toBe(1);
    expect(callsTo("create_notification")[0]?.args.p_event_type).toBe(
      "treatment_plan_activated",
    );
  });

  it("sends no plan title and no plan item", async () => {
    rpcResults.claim_notification_outbox = {
      data: [
        outboxEvent({
          event_type: "treatment_plan_activated",
          subject_type: "treatment_plan",
          subject_id: PLAN_ID,
          dedupe_key: `treatment_plan:${PLAN_ID}:activated`,
        }),
      ],
      error: null,
    };

    await runNotificationWorker();

    // The context function returns no title at all, so there is nothing for
    // the template to have leaked.
    const args = callsTo("create_notification")[0]?.args ?? {};
    expect(String(args.p_body)).not.toMatch(/diet|therapy|lifestyle/i);
  });
});

describe("failure handling", () => {
  it("retries a database failure and does not mark the event processed", async () => {
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent({ attempt_count: 1 })],
      error: null,
    };
    rpcResults.notification_appointment_context = {
      data: null,
      error: pgError("08006", "connection failure"),
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxRetried).toBe(1);
    expect(summary.outboxProcessed).toBe(0);

    const completed = callsTo("complete_notification_outbox")[0];
    expect(completed?.args.p_status).toBe("failed");
    expect(completed?.args.p_retry_at).toBeTruthy();
  });

  it("stops retrying at the cap and dead-letters", async () => {
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent({ attempt_count: 99 })],
      error: null,
    };
    rpcResults.notification_appointment_context = {
      data: null,
      error: pgError("08006"),
    };

    const summary = await runNotificationWorker();

    expect(summary.outboxFailed).toBe(1);
    expect(callsTo("complete_notification_outbox")[0]?.args.p_retry_at).toBe(
      null,
    );
  });

  it("carries on when one event fails", async () => {
    rpcResults.claim_notification_outbox = {
      data: [
        outboxEvent({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }),
        outboxEvent({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2" }),
      ],
      error: null,
    };
    rpcQueues.notification_appointment_context = [
      { data: null, error: pgError("08006") },
      { data: appointmentContext(), error: null },
    ];

    const summary = await runNotificationWorker();

    expect(summary.outboxRetried + summary.outboxFailed).toBe(1);
    expect(summary.outboxProcessed).toBe(1);
  });

  it("never throws, whatever the database says", async () => {
    rpcResults.claim_notification_outbox = {
      data: null,
      error: pgError("42501", "permission denied for function"),
    };

    await expect(runNotificationWorker()).resolves.toBeDefined();
  });
});

describe("external delivery", () => {
  it("creates none when no channel is configured", async () => {
    // Sections 12 and 14. A deployment without a provider accumulates no
    // queue, rather than a queue that will never drain.
    channels = [];
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(callsTo("enqueue_notification_delivery")).toHaveLength(0);
    expect(callsTo("claim_notification_deliveries")).toHaveLength(0);
    expect(summary.deliveriesClaimed).toBe(0);
  });

  it("sends the rendered message to the claimed address", async () => {
    channels = [emailChannel()];
    rpcResults.claim_notification_deliveries = {
      data: [
        {
          delivery_id: DELIVERY_ID,
          channel: "email",
          provider: "emailjs",
          attempt_count: 1,
          notification_id: NOTIFICATION_ID,
          event_type: "appointment_confirmed",
          category: "appointment_updates",
          title: "Appointment confirmed",
          body: "Your Initial consultation is confirmed.",
          link_path: "/patient/appointments/1",
          recipient_email: PATIENT_EMAIL,
        },
      ],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.deliveriesSent).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);

    const message = sendMock.mock.calls[0]?.[0];
    expect(message.to).toBe(PATIENT_EMAIL);
    expect(message.subject).toContain("Appointment confirmed");
    expect(message.actionUrl).toContain("/patient/appointments/1");
    // Section 104: a stable key, for a provider that supports one.
    expect(message.idempotencyKey).toBe(`${NOTIFICATION_ID}:email`);
  });

  it("uses a neutral subject for a clinical message", async () => {
    channels = [emailChannel()];
    rpcResults.claim_notification_deliveries = {
      data: [
        {
          delivery_id: DELIVERY_ID,
          channel: "email",
          provider: "emailjs",
          attempt_count: 1,
          notification_id: NOTIFICATION_ID,
          event_type: "prescription_issued",
          category: "clinical_updates",
          title: "Prescription available",
          body: "Sign in to Punarvasu to view it.",
          link_path: "/patient/prescriptions/1",
          recipient_email: PATIENT_EMAIL,
        },
      ],
      error: null,
    };

    await runNotificationWorker();

    const message = sendMock.mock.calls[0]?.[0];
    expect(message.subject).toBe("New update from Punarvasu");
    expect(message.subject.toLowerCase()).not.toContain("prescription");
  });

  it("retries a transient provider failure", async () => {
    channels = [emailChannel()];
    sendMock.mockResolvedValue({
      status: "transient_failure",
      errorCode: "provider_rate_limited",
    });
    rpcResults.claim_notification_deliveries = {
      data: [deliveryRow(1)],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.deliveriesRetried).toBe(1);
    const recorded = callsTo("record_notification_delivery_result")[0];
    expect(recorded?.args.p_status).toBe("failed");
    expect(recorded?.args.p_retry_at).toBeTruthy();
    expect(recorded?.args.p_error_code).toBe("provider_rate_limited");
  });

  it("does not retry a permanent provider failure", async () => {
    // Section 46. Retrying an invalid recipient four times sends nothing
    // four times.
    channels = [emailChannel()];
    sendMock.mockResolvedValue({
      status: "permanent_failure",
      errorCode: "invalid_recipient",
    });
    rpcResults.claim_notification_deliveries = {
      data: [deliveryRow(1)],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.deliveriesFailed).toBe(1);
    expect(summary.deliveriesRetried).toBe(0);
    expect(
      callsTo("record_notification_delivery_result")[0]?.args.p_retry_at,
    ).toBe(null);
  });

  it("stops retrying a transient failure at the cap", async () => {
    channels = [emailChannel()];
    sendMock.mockResolvedValue({
      status: "transient_failure",
      errorCode: "provider_timeout",
    });
    rpcResults.claim_notification_deliveries = {
      data: [deliveryRow(99)],
      error: null,
    };

    const summary = await runNotificationWorker();

    expect(summary.deliveriesFailed).toBe(1);
    expect(
      callsTo("record_notification_delivery_result")[0]?.args.p_retry_at,
    ).toBe(null);
  });

  it("skips a delivery whose channel is no longer configured", async () => {
    channels = [emailChannel()];
    rpcResults.claim_notification_deliveries = {
      data: [{ ...deliveryRow(1), channel: "in_app" }],
      error: null,
    };

    await runNotificationWorker();

    expect(sendMock).not.toHaveBeenCalled();
    const recorded = callsTo("record_notification_delivery_result")[0];
    expect(recorded?.args.p_status).toBe("skipped");
    expect(recorded?.args.p_error_code).toBe("provider_not_configured");
  });
});

describe("logging", () => {
  it("carries no address, title, body or link into a log line", async () => {
    // Sections 77 and 78.
    channels = [emailChannel()];
    sendMock.mockResolvedValue({
      status: "transient_failure",
      errorCode: "provider_timeout",
    });
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };
    rpcResults.claim_notification_deliveries = {
      data: [deliveryRow(1)],
      error: null,
    };

    await runNotificationWorker();

    const log = logLines.join("\n");

    expect(log).not.toContain(PATIENT_EMAIL);
    expect(log).not.toContain("Appointment confirmed");
    expect(log).not.toContain(PRACTITIONER);
    expect(log).not.toContain("/patient/appointments/");
    expect(log).not.toContain("10:30");
  });

  it("logs counts and opaque ids, which is what section 78's example logs", async () => {
    rpcResults.claim_notification_outbox = {
      data: [outboxEvent()],
      error: null,
    };

    await runNotificationWorker();

    expect(logLines.join("\n")).toContain("notification.worker_run");
  });
});

function deliveryRow(attempt: number) {
  return {
    delivery_id: DELIVERY_ID,
    channel: "email",
    provider: "emailjs",
    attempt_count: attempt,
    notification_id: NOTIFICATION_ID,
    event_type: "appointment_confirmed",
    category: "appointment_updates",
    title: "Appointment confirmed",
    body: `Your Initial consultation with ${PRACTITIONER} is confirmed for Saturday 19 September 2026, 10:30 am.`,
    link_path: "/patient/appointments/1",
    recipient_email: PATIENT_EMAIL,
  };
}
