/**
 * The email channel, over EmailJS.
 *
 * ## Why EmailJS
 *
 * Because it is the provider this project already has. Phase 06 moved
 * authentication email onto it through a Supabase Send Email hook, and the
 * trade-offs were recorded there in full: it relays through a connected
 * mailbox, so deliverability, daily volume and the visible sender are that
 * mailbox's, and there is no SPF or DKIM alignment for the clinic's own
 * domain. **Custom SMTP on the clinic's domain remains the better answer
 * before real patients rely on this**, and switching to it is a new module
 * beside this one plus one line in `resolveChannels()` — that is what the
 * adapter interface is for.
 *
 * Inventing a second provider here instead would have meant credentials
 * nobody has, a sender nobody has verified, and a channel that reports
 * success while delivering nothing.
 *
 * ## Configured or absent — never half-present
 *
 * `createEmailChannel()` returns `null` unless every credential is present.
 * A deployment with three of the four values out of four does not get a
 * channel that fails on every send; it gets no email channel, no delivery
 * rows, and a preferences screen that says email is not switched on.
 *
 * **In this repository nothing is configured**, so email is off. The code
 * path below is exercised by tests against a stub `fetch`, and has not sent
 * a message from this application.
 *
 * ## What leaves the process
 *
 * A recipient address, a subject, a heading, a body and a link — the same
 * minimum the template produced. No patient id, no appointment id, no
 * practitioner id, no role, no session token and no clinical field, because
 * none of those is in a `NotificationMessage`.
 *
 * ## What never enters a log
 *
 * Sections 77 and 78. The provider's response body can echo the request back,
 * which for this feature means an address and a live link, so it is read only
 * far enough to tell an invalid recipient from a rejection and is then
 * discarded. The credentials are never logged at any level.
 */

import "server-only";

import { EMAIL_SEND_TIMEOUT_MS } from "@/config/notifications";
import { getNotificationEmailConfig } from "@/config/env.server";
import {
  classifyProviderException,
  classifyProviderStatus,
} from "@/features/notifications/errors";

import type {
  DeliveryOutcome,
  NotificationChannelAdapter,
  NotificationMessage,
} from "../channel";

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

/** Everything one send needs. Assembled from server-only configuration. */
export interface EmailJsConfig {
  readonly serviceId: string;
  readonly templateId: string;
  readonly publicKey: string;
  readonly privateKey: string;
  readonly fromName: string;
}

/** Injectable for tests. The real one is the platform `fetch`. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Sends one message.
 *
 * Exported separately from the adapter so the retry classification, the
 * timeout and the payload shape can be tested without configuration and
 * without a network — the lesson Phase 06 recorded when a behaviour test in
 * one runtime failed to prove correctness in another.
 */
export async function sendViaEmailJs(
  config: EmailJsConfig,
  message: NotificationMessage,
  fetchImpl: FetchLike = fetch,
): Promise<DeliveryOutcome> {
  let response: Response;

  try {
    response = await fetchImpl(EMAILJS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Section 45: a send that hangs holds a worker run open. It cannot
      // break the domain operation — that transaction committed long before
      // this code existed — but it is still bounded.
      signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        // Server-side sending needs the private key as well, and requires
        // "Allow EmailJS API for non-browser applications" to be enabled.
        // Both keys are server-only: `env.server.ts` imports `server-only`,
        // so a client component that reached for either would fail the build.
        accessToken: config.privateKey,
        template_params: {
          // The address is sent under both names EmailJS templates use. Which
          // one a template reads is the template author's choice, the
          // template lives outside this repository, and EmailJS answers a
          // mismatch with "the recipients address is empty" and no hint —
          // the exact failure Phase 06 spent a debugging session on.
          email: message.to,
          to_email: message.to,
          from_name: config.fromName,
          subject: message.subject,
          heading: message.heading,
          body: message.body,
          action_label: message.actionLabel,
          action_url: message.actionUrl,
          // Some clients strip links; the plain form keeps the message
          // actionable without one.
          action_url_plain: message.actionUrl,
        },
      }),
    });
  } catch (error) {
    const failure = classifyProviderException(error);
    return { status: `${failure.kind}_failure`, errorCode: failure.errorCode };
  }

  if (response.ok) {
    // EmailJS returns the literal text "OK" and no message identifier. There
    // is nothing to record, and inventing one would give an operator a value
    // that resolves to nothing at the provider.
    return { status: "sent" };
  }

  // Read only far enough to tell an invalid recipient from a rejection, and
  // bound it so a large error page cannot be carried around in memory. The
  // text is not returned, not stored and not logged.
  const hint = await readBodyHint(response);
  const failure = classifyProviderStatus(response.status, hint);

  return { status: `${failure.kind}_failure`, errorCode: failure.errorCode };
}

async function readBodyHint(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "";
  }
}

/**
 * The email adapter, or `null` when email is not configured.
 *
 * Called once per worker run. Reading configuration here rather than at module
 * load means a deployment that adds the credentials starts delivering on its
 * next run rather than on its next restart.
 */
export function createEmailChannel(): NotificationChannelAdapter | null {
  const config = getNotificationEmailConfig();
  if (!config) return null;

  return {
    channel: "email",
    provider: "emailjs",
    send: (message) => sendViaEmailJs(config, message),
  };
}
