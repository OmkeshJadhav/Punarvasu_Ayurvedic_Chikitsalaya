/**
 * The provider abstraction.
 *
 * ## One interface, so a provider is replaceable
 *
 * `phase_15.md` section 44, and `docs/ARCHITECTURE.md` section 32's rule that
 * an external service sits behind an application-level adapter. The processor
 * depends on {@link NotificationChannelAdapter} and knows nothing about
 * EmailJS, an SMTP host or an HTTP shape. Swapping the provider is a new
 * module and one line in `resolveChannels()`.
 *
 * ## An unconfigured channel does not exist
 *
 * `resolveChannels()` returns only adapters whose credentials are actually
 * present. A channel that cannot deliver is absent rather than present and
 * failing, so:
 *
 *   * no delivery row is created for it, and therefore
 *   * nothing accumulates in a queue that will never drain, and
 *   * the preferences screen can say honestly that it is not switched on.
 *
 * That is section 14's "create an extensible channel interface without
 * pretending delivery works", and section 12's "only enable channels that are
 * actually configured".
 *
 * ## What is deliberately not here
 *
 * No SMS adapter and no WhatsApp adapter — not a stub, not a to-do, not an
 * interface implementation that logs and returns success. No provider is
 * configured for either, and `docs/SECURITY.md` and section 101 both require
 * consent, sender registration and template approval to be settled before
 * one could be. The interface below is what they would implement.
 */

import "server-only";

import type { NotificationChannel } from "@/features/notifications/types";

import { createEmailChannel } from "./providers/emailjs";

/**
 * One message, ready for a provider.
 *
 * Every field was produced server-side: the address came from `auth.users`
 * inside a definer function, and the subject, body and link came from
 * `features/notifications/templates.ts`. Section 42 — a browser supplies none
 * of them, and there is no code path by which it could.
 */
export interface NotificationMessage {
  /** The recipient. Resolved in the database; never held anywhere else. */
  readonly to: string;
  readonly subject: string;
  readonly heading: string;
  readonly body: string;
  readonly actionLabel: string;
  readonly actionUrl: string;
  /**
   * A stable key for this notification and channel.
   *
   * Passed to providers that support request idempotency so a retry cannot
   * become a second message (section 104). EmailJS does not support one; the
   * key is still supplied so that a provider which does can use it without
   * the processor changing.
   */
  readonly idempotencyKey: string;
}

/** What one send attempt produced. */
export type DeliveryOutcome =
  | { readonly status: "sent"; readonly providerMessageId?: string }
  | {
      readonly status: "transient_failure";
      readonly errorCode: string;
    }
  | {
      readonly status: "permanent_failure";
      readonly errorCode: string;
    };

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  /** Short, stable, lower-case. Stored against every attempt. */
  readonly provider: string;
  send(message: NotificationMessage): Promise<DeliveryOutcome>;
}

/**
 * The external channels this deployment can actually deliver on.
 *
 * Empty when nothing is configured, which is the correct state for a
 * deployment that has not been given a provider — and the state this one is
 * in until `NOTIFICATIONS_EMAILJS_*` is set. In-app notifications are
 * unaffected: an in-app notification *is* the row, and it never passes
 * through here.
 */
export function resolveChannels(): readonly NotificationChannelAdapter[] {
  const email = createEmailChannel();
  return email ? [email] : [];
}

/** Whether any external channel is configured. Used by the preferences copy. */
export function hasConfiguredExternalChannel(): boolean {
  return resolveChannels().length > 0;
}
