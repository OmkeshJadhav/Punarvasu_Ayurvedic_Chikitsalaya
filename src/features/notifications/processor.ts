import "server-only";

/**
 * The notification processor.
 *
 * ```text
 *   domain transaction  ->  outbox row        (an after trigger; not this)
 *          |
 *          v
 *   claim an event      ->  read authoritative state
 *          |                       |
 *          |                       v
 *          |                render a template
 *          |                       |
 *          v                       v
 *   plan/cancel reminders    create_notification   (idempotent)
 *          |                       |
 *          v                       v
 *   release due reminders    enqueue delivery      (external channels only)
 *                                  |
 *                                  v
 *                           claim, send, record
 * ```
 *
 * ## Why this is not inside the domain transaction
 *
 * `phase_15.md` sections 65 and 103, and example 6. An appointment is
 * confirmed and committed before this file runs. Everything here may fail, be
 * retried, or never run at all, and the appointment is still confirmed. That
 * is the property the whole phase exists to have.
 *
 * ## The event payload is not trusted
 *
 * Sections 116, 117, 122 and 123. An event carries a resource id and nothing
 * else, and the first thing every handler does is read the resource's
 * **current** state. An `appointment_confirmed` event for an appointment that
 * has since been cancelled is `skipped`, not sent — that is section 117's
 * example, and it is why the handlers look repetitive: each one states the
 * state it requires.
 *
 * Section 118's ordering problem is handled the same way, with one extra
 * step: the appointment events encode the start instant they were emitted
 * for, so an event describing a time the appointment no longer starts at is
 * superseded and skipped. Two reschedules processed out of order cannot
 * announce the older one.
 *
 * ## Idempotency
 *
 * Sections 47, 104, 119 and 120, and example 7. Three layers:
 *
 *   1. the outbox key is unique, so a repeated trigger writes no second event;
 *   2. `create_notification` is idempotent on the notification key, so
 *      processing the same event twice produces one notification;
 *   3. `enqueue_notification_delivery` is unique per (notification, channel),
 *      so a retry resumes an attempt rather than starting a second one.
 *
 * Duplicate *logical* notifications are therefore impossible. Duplicate
 * external messages are bounded rather than impossible, and that is stated
 * honestly: the claim pushes the retry time out **before** the send, so a
 * process killed after the provider accepted a message will retry it. No
 * configured provider offers request idempotency (EmailJS does not), so this
 * is at-least-once by necessity — `NotificationMessage.idempotencyKey` is
 * carried for the provider that one day does.
 *
 * ## What is never logged
 *
 * Sections 77 and 78. A title, a body, an email address, a link, a
 * practitioner's name, an appointment time. What is logged is the operation,
 * the opaque event or delivery id, the event type and a short machine code —
 * section 78's own "safe example", near enough word for word.
 */

import { NOTIFICATION_WORKER } from "@/config/notifications";
import { getSiteConfig } from "@/config/env.public";
import { logger } from "@/lib/logging/logger";
import {
  resolveChannels,
  type NotificationChannelAdapter,
} from "@/lib/notifications/channel";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { NOTIFICATION_ERROR_CODES } from "./errors";
import { notificationActionUrl } from "./links";
import { nextRetryAt } from "./retry";
import {
  renderEmail,
  renderNotification,
  type NotificationTemplateData,
} from "./templates";
import type { NotificationEventType, NotificationSubjectType } from "./types";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/** What one worker run did. Counts only — no identifiers, no content. */
export interface NotificationWorkerSummary {
  readonly outboxClaimed: number;
  readonly outboxProcessed: number;
  readonly outboxSkipped: number;
  readonly outboxRetried: number;
  readonly outboxFailed: number;
  readonly remindersReleased: number;
  readonly remindersCancelled: number;
  readonly deliveriesClaimed: number;
  readonly deliveriesSent: number;
  readonly deliveriesRetried: number;
  readonly deliveriesFailed: number;
}

const EMPTY_SUMMARY: NotificationWorkerSummary = {
  outboxClaimed: 0,
  outboxProcessed: 0,
  outboxSkipped: 0,
  outboxRetried: 0,
  outboxFailed: 0,
  remindersReleased: 0,
  remindersCancelled: 0,
  deliveriesClaimed: 0,
  deliveriesSent: 0,
  deliveriesRetried: 0,
  deliveriesFailed: 0,
};

/**
 * One pass over everything that is due.
 *
 * Called two ways, and both matter:
 *
 *   * **opportunistically**, from `after()` in a server action, so a patient
 *     sees a confirmation without waiting for a scheduler. That runs after
 *     the response has been sent, so it cannot delay or fail the action;
 *   * **on a schedule**, through `POST /api/notifications/process`, which is
 *     what makes reminders and retries reliable. Without a scheduler
 *     reminders do not fire — there is nothing else to wake them — and the
 *     route's documentation says so.
 *
 * Never throws. A worker that throws in `after()` produces an unhandled
 * rejection in a request that has already succeeded.
 */
export async function runNotificationWorker(
  options: { readonly now?: Date } = {},
): Promise<NotificationWorkerSummary> {
  const now = options.now ?? new Date();

  let supabase: AdminClient;
  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    // No service-role key. A deployment without one cannot process
    // notifications, and saying so once per run beats failing per event.
    logger.error("notification.worker_unconfigured", error);
    return EMPTY_SUMMARY;
  }

  const channels = resolveChannels();

  const outbox = await processOutbox(supabase, channels, now);
  const reminders = await releaseReminders(supabase, channels);
  const deliveries = await processDeliveries(supabase, channels, now);

  const summary: NotificationWorkerSummary = {
    ...outbox,
    ...reminders,
    ...deliveries,
  };

  // Counts only. Nothing here identifies a patient or says what was sent.
  logger.info("notification.worker_run", { ...summary });

  return summary;
}

/* ------------------------------------------------------------------------ */
/* The outbox                                                                */
/* ------------------------------------------------------------------------ */

type OutboxCounters = Pick<
  NotificationWorkerSummary,
  | "outboxClaimed"
  | "outboxProcessed"
  | "outboxSkipped"
  | "outboxRetried"
  | "outboxFailed"
>;

async function processOutbox(
  supabase: AdminClient,
  channels: readonly NotificationChannelAdapter[],
  now: Date,
): Promise<OutboxCounters> {
  const counters = {
    outboxClaimed: 0,
    outboxProcessed: 0,
    outboxSkipped: 0,
    outboxRetried: 0,
    outboxFailed: 0,
  };

  const { data, error } = await supabase.rpc("claim_notification_outbox", {
    p_limit: NOTIFICATION_WORKER.outboxBatchSize,
    p_lease_seconds: NOTIFICATION_WORKER.leaseSeconds,
  });

  if (error) {
    logger.error("notification.outbox_claim_failed", error);
    return counters;
  }

  const events = data ?? [];
  counters.outboxClaimed = events.length;

  for (const event of events) {
    try {
      const outcome = await handleEvent(supabase, channels, event);

      if (outcome.kind === "processed") {
        counters.outboxProcessed += 1;
        await supabase.rpc("complete_notification_outbox", {
          p_id: event.id,
          p_status: "processed",
        });
        continue;
      }

      // A skip is a decision, not a failure: the appointment moved on, the
      // patient has no login, the event was superseded. Retrying would
      // produce the same answer for ever.
      counters.outboxSkipped += 1;
      logger.info("notification.event_skipped", {
        outboxId: event.id,
        eventType: event.event_type,
        reason: outcome.reason,
      });
      await supabase.rpc("complete_notification_outbox", {
        p_id: event.id,
        p_status: "skipped",
        p_error_code: outcome.reason,
      });
    } catch (error) {
      const retryAt = nextRetryAt(event.attempt_count, now);

      if (retryAt) {
        counters.outboxRetried += 1;
        logger.warn("notification.event_retry", {
          outboxId: event.id,
          eventType: event.event_type,
          attempt: event.attempt_count,
        });
      } else {
        // Section 105. The dead letter: kept, with enough to operate on and
        // nothing sensitive in it.
        counters.outboxFailed += 1;
        logger.error("notification.event_failed", error, {
          outboxId: event.id,
          eventType: event.event_type,
          attempt: event.attempt_count,
        });
      }

      await supabase.rpc("complete_notification_outbox", {
        p_id: event.id,
        p_status: "failed",
        p_error_code: "processing_failed",
        p_retry_at: retryAt ? retryAt.toISOString() : null,
      });
    }
  }

  return counters;
}

type EventOutcome =
  | { readonly kind: "processed" }
  | { readonly kind: "skipped"; readonly reason: string };

interface ClaimedEvent {
  readonly id: string;
  readonly event_type: NotificationEventType;
  readonly subject_type: NotificationSubjectType;
  readonly subject_id: string;
  readonly dedupe_key: string;
  readonly attempt_count: number;
}

async function handleEvent(
  supabase: AdminClient,
  channels: readonly NotificationChannelAdapter[],
  event: ClaimedEvent,
): Promise<EventOutcome> {
  switch (event.event_type) {
    case "appointment_confirmed":
    case "appointment_rescheduled":
    case "appointment_cancelled":
      return handleAppointmentEvent(supabase, channels, event);
    case "prescription_issued":
      return handlePrescriptionEvent(supabase, channels, event);
    case "treatment_plan_activated":
      return handleTreatmentPlanEvent(supabase, channels, event);
    case "appointment_reminder":
      // Reminders are planned and released, never queued as outbox events.
      // Reaching here means an event was written by something other than the
      // triggers in the migration.
      return { kind: "skipped", reason: "unexpected_event" };
  }
}

async function handleAppointmentEvent(
  supabase: AdminClient,
  channels: readonly NotificationChannelAdapter[],
  event: ClaimedEvent,
): Promise<EventOutcome> {
  const { data, error } = await supabase.rpc(
    "notification_appointment_context",
    { p_appointment_id: event.subject_id },
  );

  if (error) throw error;

  const context = data?.[0];
  if (!context) return { kind: "skipped", reason: "resource_missing" };

  const startsAt = new Date(context.starts_at);

  // Section 118. The key carries the start instant the event was emitted
  // for. If the appointment no longer starts then, a later reschedule has
  // already been queued and this event is describing a time that no longer
  // exists.
  const keyedEpoch = readTrailingEpoch(event.dedupe_key);
  const supersedable =
    event.event_type === "appointment_confirmed" ||
    event.event_type === "appointment_rescheduled";

  if (
    supersedable &&
    keyedEpoch !== null &&
    keyedEpoch !== Math.floor(startsAt.getTime() / 1000)
  ) {
    return { kind: "skipped", reason: "superseded" };
  }

  // Section 122: the authoritative state decides, not the event's name.
  const requiredStatus =
    event.event_type === "appointment_cancelled" ? "cancelled" : null;

  if (requiredStatus && context.status !== requiredStatus) {
    return { kind: "skipped", reason: "stale_event" };
  }

  if (event.event_type === "appointment_confirmed") {
    if (context.status !== "confirmed") {
      return { kind: "skipped", reason: "stale_event" };
    }
  }

  if (event.event_type === "appointment_rescheduled") {
    // A reschedule of an appointment that has since been cancelled or
    // attended is not news the patient needs.
    if (
      context.status === "cancelled" ||
      context.status === "completed" ||
      context.status === "no_show"
    ) {
      return { kind: "skipped", reason: "stale_event" };
    }
  }

  const rendered = renderNotification({
    event: event.event_type,
    data: {
      practitionerName: context.practitioner_name,
      appointmentTypeName: context.appointment_type_name,
      startsAt,
    },
  } as NotificationTemplateData);

  const notificationId = await createNotification(supabase, {
    dedupeKey: event.dedupe_key,
    eventType: event.event_type,
    resourceType: "appointment",
    resourceId: event.subject_id,
    rendered,
  });

  if (!notificationId) return { kind: "skipped", reason: "no_recipient" };

  await enqueueDeliveries(supabase, channels, notificationId);

  // Sections 29, 30 and 68, and example 5. The reminder set is recomputed
  // from the authoritative appointment every time it changes, so a moved or
  // cancelled appointment invalidates its old reminders here rather than
  // relying on somebody remembering to cancel them.
  if (event.event_type === "appointment_cancelled") {
    await supabase.rpc("cancel_appointment_reminders", {
      p_appointment_id: event.subject_id,
    });
  } else {
    await syncReminders(supabase, event.subject_id, context);
  }

  return { kind: "processed" };
}

async function handlePrescriptionEvent(
  supabase: AdminClient,
  channels: readonly NotificationChannelAdapter[],
  event: ClaimedEvent,
): Promise<EventOutcome> {
  const { data, error } = await supabase.rpc(
    "notification_prescription_context",
    { p_prescription_id: event.subject_id },
  );

  if (error) throw error;

  const context = data?.[0];
  if (!context) return { kind: "skipped", reason: "resource_missing" };

  // Section 123, and the acceptance criterion that a draft must never
  // produce a final-prescription notification. The trigger already only
  // fires on the transition into `issued`; this is the second check, against
  // the authoritative row, at the moment the message would be sent.
  if (context.status !== "issued") {
    return { kind: "skipped", reason: "stale_event" };
  }

  const rendered = renderNotification({
    event: "prescription_issued",
    data: { practitionerName: context.practitioner_name },
  });

  const notificationId = await createNotification(supabase, {
    dedupeKey: event.dedupe_key,
    eventType: "prescription_issued",
    resourceType: "prescription",
    resourceId: event.subject_id,
    rendered,
  });

  if (!notificationId) return { kind: "skipped", reason: "no_recipient" };

  await enqueueDeliveries(supabase, channels, notificationId);
  return { kind: "processed" };
}

async function handleTreatmentPlanEvent(
  supabase: AdminClient,
  channels: readonly NotificationChannelAdapter[],
  event: ClaimedEvent,
): Promise<EventOutcome> {
  const { data, error } = await supabase.rpc(
    "notification_treatment_plan_context",
    { p_plan_id: event.subject_id },
  );

  if (error) throw error;

  const context = data?.[0];
  if (!context) return { kind: "skipped", reason: "resource_missing" };

  if (context.status !== "active") {
    return { kind: "skipped", reason: "stale_event" };
  }

  const rendered = renderNotification({
    event: "treatment_plan_activated",
    data: { practitionerName: context.practitioner_name },
  });

  const notificationId = await createNotification(supabase, {
    dedupeKey: event.dedupe_key,
    eventType: "treatment_plan_activated",
    resourceType: "treatment_plan",
    resourceId: event.subject_id,
    rendered,
  });

  if (!notificationId) return { kind: "skipped", reason: "no_recipient" };

  await enqueueDeliveries(supabase, channels, notificationId);
  return { kind: "processed" };
}

/* ------------------------------------------------------------------------ */
/* Reminders                                                                 */
/* ------------------------------------------------------------------------ */

interface AppointmentContext {
  readonly practitioner_name: string;
  readonly appointment_type_name: string;
  readonly starts_at: string;
}

/**
 * Recomputes an appointment's reminders from its authoritative state.
 *
 * The planner cancels what is no longer correct and returns what is; this
 * renders each one and creates it as `scheduled`. A reminder is invisible to
 * the patient until `release_due_reminders` promotes it, which is a predicate
 * in the row-level-security policy rather than a filter a query could forget.
 */
async function syncReminders(
  supabase: AdminClient,
  appointmentId: string,
  context: AppointmentContext,
): Promise<void> {
  const { data, error } = await supabase.rpc("plan_appointment_reminders", {
    p_appointment_id: appointmentId,
  });

  if (error) throw error;

  for (const reminder of data ?? []) {
    const rendered = renderNotification({
      event: "appointment_reminder",
      data: {
        practitionerName: context.practitioner_name,
        appointmentTypeName: context.appointment_type_name,
        startsAt: new Date(context.starts_at),
      },
    });

    await createNotification(supabase, {
      dedupeKey: reminder.dedupe_key,
      eventType: "appointment_reminder",
      resourceType: "appointment",
      resourceId: appointmentId,
      rendered,
      status: "scheduled",
      scheduledFor: reminder.scheduled_for,
      reminderOffsetMinutes: reminder.offset_minutes,
    });
  }
}

type ReminderCounters = Pick<
  NotificationWorkerSummary,
  "remindersReleased" | "remindersCancelled"
>;

async function releaseReminders(
  supabase: AdminClient,
  channels: readonly NotificationChannelAdapter[],
): Promise<ReminderCounters> {
  const counters = { remindersReleased: 0, remindersCancelled: 0 };

  const { data, error } = await supabase.rpc("release_due_reminders", {
    p_limit: NOTIFICATION_WORKER.reminderBatchSize,
  });

  if (error) {
    logger.error("notification.reminder_release_failed", error);
    return counters;
  }

  for (const row of data ?? []) {
    if (row.released) {
      counters.remindersReleased += 1;
      await enqueueDeliveries(supabase, channels, row.notification_id);
    } else {
      // The appointment was cancelled, moved, completed or not attended.
      // Section 68, 69 and 70: this is the reminder not firing, recorded.
      counters.remindersCancelled += 1;
    }
  }

  return counters;
}

/* ------------------------------------------------------------------------ */
/* Deliveries                                                                */
/* ------------------------------------------------------------------------ */

type DeliveryCounters = Pick<
  NotificationWorkerSummary,
  | "deliveriesClaimed"
  | "deliveriesSent"
  | "deliveriesRetried"
  | "deliveriesFailed"
>;

async function processDeliveries(
  supabase: AdminClient,
  channels: readonly NotificationChannelAdapter[],
  now: Date,
): Promise<DeliveryCounters> {
  const counters = {
    deliveriesClaimed: 0,
    deliveriesSent: 0,
    deliveriesRetried: 0,
    deliveriesFailed: 0,
  };

  // Nothing configured, nothing to drain. Deliveries are only ever created
  // for a channel that exists, so this is a cheap early return rather than a
  // guard against a queue that should not have filled.
  if (channels.length === 0) return counters;

  const { data, error } = await supabase.rpc("claim_notification_deliveries", {
    p_limit: NOTIFICATION_WORKER.deliveryBatchSize,
    p_lease_seconds: NOTIFICATION_WORKER.leaseSeconds,
  });

  if (error) {
    logger.error("notification.delivery_claim_failed", error);
    return counters;
  }

  const claimed = data ?? [];
  counters.deliveriesClaimed = claimed.length;

  const siteUrl = getSiteConfig().siteUrl;

  for (const delivery of claimed) {
    const adapter = channels.find(
      (candidate) => candidate.channel === delivery.channel,
    );

    if (!adapter) {
      // The channel was configured when the delivery was enqueued and is not
      // now. Not an error, and not something a retry fixes.
      await supabase.rpc("record_notification_delivery_result", {
        p_delivery_id: delivery.delivery_id,
        p_status: "skipped",
        p_error_code: "provider_not_configured",
      });
      continue;
    }

    const email = renderEmail({
      title: delivery.title,
      body: delivery.body,
      category: delivery.category,
    });

    const outcome = await adapter.send({
      to: delivery.recipient_email,
      subject: email.subject,
      heading: email.heading,
      body: email.body,
      actionLabel: email.actionLabel,
      actionUrl: notificationActionUrl(siteUrl, delivery.link_path),
      idempotencyKey: `${delivery.notification_id}:${delivery.channel}`,
    });

    if (outcome.status === "sent") {
      counters.deliveriesSent += 1;
      await supabase.rpc("record_notification_delivery_result", {
        p_delivery_id: delivery.delivery_id,
        p_status: "sent",
        p_provider_message_id: outcome.providerMessageId ?? null,
      });
      continue;
    }

    const kind =
      outcome.status === "transient_failure" ? "transient" : "permanent";
    const retryAt = nextRetryAt(delivery.attempt_count, now, kind);

    if (retryAt) {
      counters.deliveriesRetried += 1;
    } else {
      counters.deliveriesFailed += 1;
    }

    // A short code, never the provider's words. Section 77.
    logger.warn("notification.delivery_failed", {
      deliveryId: delivery.delivery_id,
      channel: delivery.channel,
      provider: delivery.provider,
      errorCode: outcome.errorCode,
      attempt: delivery.attempt_count,
      willRetry: retryAt !== null,
    });

    await supabase.rpc("record_notification_delivery_result", {
      p_delivery_id: delivery.delivery_id,
      p_status: "failed",
      p_error_code: outcome.errorCode,
      p_retry_at: retryAt ? retryAt.toISOString() : null,
    });
  }

  return counters;
}

/* ------------------------------------------------------------------------ */
/* Shared helpers                                                            */
/* ------------------------------------------------------------------------ */

interface CreateNotificationInput {
  readonly dedupeKey: string;
  readonly eventType: NotificationEventType;
  readonly resourceType: NotificationSubjectType;
  readonly resourceId: string;
  readonly rendered: {
    readonly title: string;
    readonly body: string;
    readonly category: ReturnType<typeof renderNotification>["category"];
    readonly templateVersion: number;
  };
  readonly status?: "active" | "scheduled";
  readonly scheduledFor?: string;
  readonly reminderOffsetMinutes?: number;
}

/**
 * Creates one notification, or returns the one that already exists.
 *
 * Returns `null` when there is nobody to notify — a walk-in registered at the
 * front desk has a clinic record and no login. That is a skip, not a failure:
 * retrying it would produce the same answer for ever.
 *
 * **No recipient is passed.** The database resolves one from the resource.
 */
async function createNotification(
  supabase: AdminClient,
  input: CreateNotificationInput,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("create_notification", {
    p_dedupe_key: input.dedupeKey,
    p_event_type: input.eventType,
    p_category: input.rendered.category,
    p_resource_type: input.resourceType,
    p_resource_id: input.resourceId,
    p_title: input.rendered.title,
    p_body: input.rendered.body,
    p_template_version: input.rendered.templateVersion,
    p_status: input.status ?? "active",
    p_scheduled_for: input.scheduledFor ?? null,
    p_reminder_offset_minutes: input.reminderOffsetMinutes ?? null,
  });

  if (error) {
    if (readCode(error) === NOTIFICATION_ERROR_CODES.noRecipient) return null;
    throw error;
  }

  return typeof data === "string" ? data : null;
}

/**
 * Creates the external delivery attempts for a notification.
 *
 * One per configured channel, and none at all when nothing is configured —
 * so a deployment without a provider accumulates no queue. In-app delivery is
 * the notification row and never appears here.
 */
async function enqueueDeliveries(
  supabase: AdminClient,
  channels: readonly NotificationChannelAdapter[],
  notificationId: string,
): Promise<void> {
  for (const channel of channels) {
    const { error } = await supabase.rpc("enqueue_notification_delivery", {
      p_notification_id: notificationId,
      p_channel: channel.channel,
      p_provider: channel.provider,
    });

    if (error) {
      // A delivery that could not be queued is not a reason to reprocess the
      // event and create a second notification. Recorded and moved past; the
      // in-app notification, which is the one that always exists, is already
      // there.
      logger.warn("notification.delivery_enqueue_failed", {
        notificationId,
        channel: channel.channel,
      });
    }
  }
}

/** The trailing `:<digits>` of a dedupe key, or `null`. */
function readTrailingEpoch(dedupeKey: string): number | null {
  const match = /:(\d+)$/.exec(dedupeKey);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
