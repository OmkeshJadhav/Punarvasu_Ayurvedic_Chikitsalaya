/**
 * Notification configuration.
 *
 * ## What is authoritative and what is a mirror
 *
 * The reminder schedule and the mandatory-category rule are the **database's**
 * — `public.notification_reminder_offsets()` is what the reminder planner
 * reads, and `public.set_notification_preference` is what refuses to switch a
 * mandatory channel off. The copies here exist so the application can describe
 * the schedule to a patient and render a preference control that is disabled
 * rather than one that is offered and then refused.
 *
 * Two copies of a rule is a divergence waiting to happen, so
 * `config/notifications.test.ts` reads the migration and asserts they agree.
 * Same arrangement as `config/appointments.ts` (Phase 09) and
 * `config/documents.ts` (Phase 14), and the failure it prevents is the same: a
 * UI that confidently offers something the system will refuse.
 *
 * ## The numbers are provisional
 *
 * `phase_15.md` section 28 says the reminder schedule must be configurable and
 * must not be hard-coded per clinic. Punarvasu has not confirmed a reminder
 * policy, so 24 hours and 2 hours are taken from section 28's own example —
 * traceable to a document rather than invented, the same approach Phase 09
 * took to the minimum notice and the booking horizon.
 *
 * ## This module is pure data
 *
 * No server imports and no secrets. Provider credentials and the worker secret
 * live in `config/env.server.ts`, which is fenced with `server-only`; nothing
 * about a provider's identity or configuration is reachable from here.
 */

import type {
  NotificationAudience,
  NotificationCategory,
  NotificationChannel,
} from "@/features/notifications/types";
import type { AppRole } from "@/types/database";

/**
 * Minutes before an appointment at which a reminder is due.
 *
 * Ordered longest-first only for readability; the planner treats the array as
 * a set. Mirrored from `public.notification_reminder_offsets()`.
 */
export const APPOINTMENT_REMINDER_OFFSETS_MINUTES: readonly number[] = [
  1440, 120,
];

/**
 * The channels that exist.
 *
 * Two, because two are real. There is no `sms` and no `whatsapp` — not in this
 * list, not in the database enum, and not as an adapter — because no SMS or
 * WhatsApp provider is configured for this project and `phase_15.md` section
 * 14 is explicit that an unconfigured channel must not be pretended into
 * existence.
 *
 * Whether `email` actually *delivers* is a separate question, answered by
 * `getNotificationEmailConfig()` at runtime: the channel exists in the model
 * and is disabled when the provider is not configured. The preferences screen
 * says which.
 */
export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  "in_app",
  "email",
];

export interface NotificationCategoryRule {
  /** What a patient calls this group of messages. */
  readonly label: string;
  /** One sentence on what falls into it, shown beside the controls. */
  readonly description: string;
  /**
   * Channels that cannot be switched off.
   *
   * `phase_15.md` section 22: some operational communication is necessary for
   * patient safety and clinic operation, and a patient must not be able to
   * make an appointment cancellation reach them nowhere. The in-app record is
   * the "somewhere" — it is the one channel that always exists and costs the
   * patient nothing — so for a mandatory category it stays on.
   *
   * Email is optional for every category, deliberately. Nothing here is
   * promotional (section 24), so there is no consent question to answer; the
   * question is only which of the channels that *do* carry transactional
   * information the patient wants, and the in-app record answers it.
   */
  readonly mandatoryChannels: readonly NotificationChannel[];
  /**
   * How the same category reads to a practitioner.
   *
   * The category is the same preference unit — "an appointment was confirmed,
   * moved or cancelled" — but "part of your care" is a sentence written for
   * the person being cared for. A practitioner reading their own settings is
   * told what the messages are about instead.
   *
   * Absent where an audience never receives the category, which
   * `NOTIFICATION_AUDIENCE_CATEGORIES` already keeps off their screen.
   */
  readonly practitioner?: {
    readonly label: string;
    readonly description: string;
  };
}

/**
 * The preference units.
 *
 * Coarser than the event type on purpose: a patient wants to decide about
 * "reminders", not about `appointment_rescheduled` separately from
 * `appointment_cancelled`.
 */
export const NOTIFICATION_CATEGORIES: Readonly<
  Record<NotificationCategory, NotificationCategoryRule>
> = {
  appointment_updates: {
    label: "Appointment updates",
    description:
      "When an appointment is confirmed, moved or cancelled. These are part of your care and always appear in Punarvasu.",
    mandatoryChannels: ["in_app"],
    practitioner: {
      label: "Changes to your day",
      description:
        "When an appointment in your diary is confirmed, moved or cancelled. These always appear in Punarvasu, so a change made at the front desk reaches you.",
    },
  },
  appointment_reminders: {
    label: "Appointment reminders",
    description:
      "A reminder before an appointment you have booked. Optional — switch these off if you would rather not be reminded.",
    mandatoryChannels: [],
  },
  clinical_updates: {
    label: "Prescriptions and treatment plans",
    description:
      "When your practitioner issues a prescription or shares a treatment plan. We never include what was prescribed — only that something is waiting for you.",
    mandatoryChannels: ["in_app"],
  },
};

/**
 * Which categories each audience can actually receive.
 *
 * A patient receives all three. A practitioner receives **one** — the
 * schedule changes that happen to their day without them.
 *
 * There is no `appointment_reminders` for a practitioner because none is sent:
 * somebody with eight appointments does not want sixteen reminders about a day
 * they are already looking at, and the day view is the reminder (`phase_15.md`
 * sections 56 and 61). And no `clinical_updates`, because a prescription
 * notification would tell a practitioner about the prescription they had just
 * written.
 *
 * The preferences screen renders from this, so nobody is shown a control over
 * messages they will never be sent. That is the honesty rule the rest of this
 * feature follows — an unconfigured email channel is disabled and says why
 * rather than silently doing nothing — applied to categories.
 */
export const NOTIFICATION_AUDIENCE_CATEGORIES: Readonly<
  Record<NotificationAudience, readonly NotificationCategory[]>
> = {
  patient: ["appointment_updates", "appointment_reminders", "clinical_updates"],
  practitioner: ["appointment_updates"],
};

/**
 * The audience a signed-in role reads and writes notifications as.
 *
 * Presentation only. It decides which preference controls a person is shown
 * and which words the notification centre introduces itself with; it decides
 * **nothing** about what they can read. That is `notifications_select_own`,
 * which scopes every row to `auth.uid()` whatever this returns.
 *
 * A receptionist or an administrator maps to `patient` because that is the
 * full preference grid and the neutral wording — not because either receives a
 * patient's notifications. Neither receives any notification at all today, and
 * both see the empty state, which is honest.
 *
 * `null` — a session whose role has not resolved — maps there too, for the
 * same reason: the neutral wording is the safe thing to show somebody whose
 * role is not known, and nothing about what they can read depends on it.
 */
export function notificationAudienceForRole(
  role: AppRole | null,
): NotificationAudience {
  return role === "doctor" ? "practitioner" : "patient";
}

/** What this category is called for this audience, and what it covers. */
export function notificationCategoryCopy(
  category: NotificationCategory,
  audience: NotificationAudience,
): { readonly label: string; readonly description: string } {
  const rule = NOTIFICATION_CATEGORIES[category];

  if (audience === "practitioner" && rule.practitioner) {
    return rule.practitioner;
  }

  return { label: rule.label, description: rule.description };
}

/** True when this channel may not be switched off for this category. */
export function isMandatoryChannel(
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  return NOTIFICATION_CATEGORIES[category].mandatoryChannels.includes(channel);
}

/**
 * How many notifications one page of the notification centre holds.
 *
 * `phase_15.md` section 94 rules out loading every notification ever. The list
 * is paginated with a cursor rather than an offset, so a notification arriving
 * between two page loads cannot shift a row across the boundary and hide it.
 */
export const NOTIFICATION_PAGE_SIZE = 20;

/**
 * The most notifications a summary panel may ask for.
 *
 * A dashboard panel is a glance, not a list. `phase_18.md` section 94 asks for
 * small purpose-specific queries rather than a page of everything, and capping
 * it here — rather than trusting each caller's argument — means a future
 * caller passing a computed number cannot turn a glance into an unbounded
 * read.
 */
export const NOTIFICATION_RECENT_LIMIT_CAP = 5;

/**
 * How many the patient dashboard actually shows.
 *
 * Three. Enough to see whether anything has happened since the patient last
 * looked; few enough that the panel never becomes the thing the page is
 * about, which is what section 63's "what needs your attention, not twelve
 * KPIs" is guarding against.
 */
export const DASHBOARD_NOTIFICATION_COUNT = 3;

/**
 * How many the bell's preview panel shows.
 *
 * Five — the most a glance should hold, and the cap above. Read and unread
 * alike, newest first, so the panel answers "what has happened lately?" rather
 * than only "what have I missed?"; the notification centre is the full list.
 */
export const BELL_PREVIEW_NOTIFICATION_COUNT = 5;

/**
 * The largest unread count the bell will print.
 *
 * Beyond this it reads "99+". A precise number in the hundreds tells a patient
 * nothing they can act on, and the query is cheaper when it can stop counting.
 */
export const UNREAD_COUNT_CAP = 99;

/**
 * Batch sizes and lease duration for one worker run.
 *
 * Bounded (section 136: the worker must not repeatedly query unbounded data),
 * and the lease is what makes a crashed worker recoverable — a claimed row
 * returns to the queue when its lease expires rather than staying `processing`
 * for ever.
 */
export const NOTIFICATION_WORKER = {
  outboxBatchSize: 25,
  deliveryBatchSize: 25,
  reminderBatchSize: 100,
  leaseSeconds: 120,
} as const;

/**
 * The retry schedule for a transient failure.
 *
 * `phase_15.md` section 46: retry transient failures, and do not retry
 * anything indefinitely. Four attempts over roughly twenty minutes, then the
 * dead letter — a notification that has failed four times over twenty minutes
 * is not going to succeed on the fifth, and a queue that retries for ever is a
 * queue nobody ever looks at.
 *
 * A **permanent** failure — an invalid recipient, a provider rejecting the
 * request — is not retried at all, whatever the attempt count says.
 */
export const NOTIFICATION_RETRY = {
  maxAttempts: 4,
  /** Seconds to wait after attempt 1, 2 and 3. */
  backoffSeconds: [60, 300, 900] as readonly number[],
} as const;

/**
 * How long one external send may take before it is abandoned.
 *
 * Section 45 lists timeout first among the provider failures that must not
 * break the underlying domain operation. It cannot break one here — the domain
 * transaction committed before the worker existed — but a send that hangs
 * holds a worker run open, so it is bounded.
 */
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

/**
 * How many worker invocations one instance accepts in a window.
 *
 * Section 108. The worker endpoint is authenticated by a shared secret; this
 * bounds the cost of somebody guessing at it, and bounds an accidental
 * scheduler loop. Per instance and in memory, which is the honest description:
 * it is a guard rail, not a distributed quota.
 */
export const WORKER_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60_000,
} as const;
