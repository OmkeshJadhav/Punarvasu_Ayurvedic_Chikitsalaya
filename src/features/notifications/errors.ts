/**
 * Database and provider failure to safe copy, for notifications.
 *
 * ## What may not cross this boundary
 *
 * `phase_15.md` sections 77-79, and `docs/SECURITY.md` section 16. A message
 * like *"permission denied for table notification_outbox"* names a table and
 * tells a caller the shape of the schema; a provider's response body can echo
 * the request back, which for this feature means an email address and a live
 * link. Neither reaches a screen, and neither reaches a log: every message
 * below is written here in full, and the provider's own text is discarded.
 *
 * ## Two vocabularies, deliberately separate
 *
 * `describeNotificationFailure` is for a **person** — somebody who pressed
 * "Mark all as read" and needs a sentence. `classifyProviderFailure` is for
 * the **worker** — it decides whether an external send is worth retrying, and
 * its output is a short machine code that goes into a column and a log, never
 * onto a screen.
 *
 * Keeping them apart is what stops a provider's status code becoming a
 * patient-facing message by the shortest available route.
 */

import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";

/**
 * The application-defined SQLSTATEs the Phase 15 migration raises.
 *
 * PV050-PV059, disjoint from every range in use: PV001-PV019 (appointments,
 * clinical records), PV020-PV034 (prescriptions and plans), PV040-PV046
 * (documents).
 */
export const NOTIFICATION_ERROR_CODES = {
  /** The resource has no account to notify — a walk-in with no login. */
  noRecipient: "PV050",
  /** A mandatory transactional channel cannot be switched off. */
  mandatoryChannel: "PV051",
  /** No session on a call that needs one. */
  unauthenticated: "PV052",
  /** A completion status the outbox does not accept. */
  unsupportedOutboxStatus: "PV053",
  /** In-app notifications have no separate delivery row. */
  inAppDelivery: "PV054",
  /** A completion status the delivery table does not accept. */
  unsupportedDeliveryStatus: "PV055",
} as const;

const INSUFFICIENT_PRIVILEGE = "42501";

export interface NotificationFailure {
  readonly message: string;
  readonly logEvent: string;
}

const FAILURES: Readonly<Record<string, NotificationFailure>> = {
  [NOTIFICATION_ERROR_CODES.mandatoryChannel]: {
    message:
      "These updates are part of your care and stay switched on in Punarvasu. You can still turn off the email for them.",
    logEvent: "notification.mandatory_channel",
  },
  [NOTIFICATION_ERROR_CODES.unauthenticated]: {
    message: "Your session has ended. Please sign in again to continue.",
    logEvent: "notification.unauthenticated",
  },
  [NOTIFICATION_ERROR_CODES.noRecipient]: {
    // Not reachable from a user-facing action — it is a worker outcome — but
    // mapped so that if it ever were, it would not fall through to a
    // stack-shaped generic.
    message: DEFAULT_USER_MESSAGE.internal,
    logEvent: "notification.no_recipient",
  },
  [INSUFFICIENT_PRIVILEGE]: {
    message: DEFAULT_USER_MESSAGE.forbidden,
    logEvent: "notification.forbidden",
  },
};

const GENERIC: NotificationFailure = {
  message:
    "We couldn't update your notifications just now. Nothing has been changed — please try again.",
  logEvent: "notification.operation_failed",
};

export function describeNotificationFailure(
  error: unknown,
): NotificationFailure {
  const code = readCode(error);
  if (!code) return GENERIC;
  return FAILURES[code] ?? GENERIC;
}

function readCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * What the worker does next after an external send failed.
 *
 * `phase_15.md` sections 45 and 46: retry transient failures, and do not
 * retry a permanent one at all. The distinction is the whole reason this
 * function exists — retrying an invalid recipient four times sends nothing
 * four times, and *not* retrying a rate limit throws away a message the
 * provider was willing to take a minute later.
 */
export type ProviderFailureKind = "transient" | "permanent";

export interface ProviderFailure {
  readonly kind: ProviderFailureKind;
  /**
   * A short machine code. Stored in `notification_deliveries.error_code` and
   * logged. Never a provider message, never a response body, never an
   * address.
   */
  readonly errorCode: string;
}

/** Codes this module can produce. Kept as a list so tests can be exhaustive. */
export const PROVIDER_ERROR_CODES = [
  "provider_timeout",
  "provider_unreachable",
  "provider_rate_limited",
  "provider_unavailable",
  "provider_auth_failed",
  "provider_rejected",
  "invalid_recipient",
  "provider_not_configured",
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

/**
 * Classifies a provider's HTTP response.
 *
 * Nothing about the body is read except to distinguish an invalid recipient,
 * and even then only a fixed substring is looked for — the body itself is
 * never stored, never logged and never returned.
 */
export function classifyProviderStatus(
  status: number,
  bodyHint = "",
): ProviderFailure {
  if (status === 429) {
    return { kind: "transient", errorCode: "provider_rate_limited" };
  }

  if (status >= 500) {
    return { kind: "transient", errorCode: "provider_unavailable" };
  }

  if (status === 401 || status === 403) {
    // A misconfigured or revoked credential. Retrying will not fix it, and
    // hammering an authentication endpoint is how a key gets locked.
    return { kind: "permanent", errorCode: "provider_auth_failed" };
  }

  if (looksLikeInvalidRecipient(bodyHint)) {
    return { kind: "permanent", errorCode: "invalid_recipient" };
  }

  return { kind: "permanent", errorCode: "provider_rejected" };
}

/** Classifies a thrown transport failure — a timeout, a DNS failure, a reset. */
export function classifyProviderException(error: unknown): ProviderFailure {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";

  if (name === "TimeoutError" || name === "AbortError") {
    return { kind: "transient", errorCode: "provider_timeout" };
  }

  // Everything else at transport level — a reset connection, a DNS failure, a
  // TLS error — is the provider being unreachable right now, which is exactly
  // what a retry is for.
  return { kind: "transient", errorCode: "provider_unreachable" };
}

function looksLikeInvalidRecipient(bodyHint: string): boolean {
  const normalized = bodyHint.toLowerCase();
  return (
    normalized.includes("recipient") ||
    normalized.includes("invalid email") ||
    normalized.includes("address is empty")
  );
}
