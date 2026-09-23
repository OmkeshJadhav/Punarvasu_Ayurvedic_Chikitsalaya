/**
 * The notification domain model.
 *
 * ## What is not here
 *
 * No recipient email, no phone number, no provider credential, no clinical
 * field, and no way to name a recipient at all. A `Notification` is something
 * one account should know; *who* that account is was decided in the database
 * from the resource the notification is about, and no type in this file can
 * express a different answer (`phase_15.md` sections 54, 72, 73, 110).
 *
 * ## Why the result types are discriminated unions
 *
 * The same reason Phase 07 gave for the patient profile: collapsing "there are
 * none" and "we could not reach the database" into one empty array is how an
 * outage ends up telling a patient they have no appointments. Every read below
 * distinguishes them, and every screen renders them differently.
 */

import type { Database } from "@/types/database";

export type NotificationEventType =
  Database["public"]["Enums"]["notification_event_type"];

export type NotificationCategory =
  Database["public"]["Enums"]["notification_category"];

export type NotificationChannel =
  Database["public"]["Enums"]["notification_channel"];

export type NotificationStatus =
  Database["public"]["Enums"]["notification_status"];

export type NotificationSubjectType =
  Database["public"]["Enums"]["notification_subject_type"];

/**
 * Which side of an appointment a notification was written for.
 *
 * Two values, and neither names anybody. It decides which account the database
 * resolves the notification to and which area the deep link points at — the
 * patient's `/patient/...` or the practitioner's `/doctor/...` — and it is the
 * *only* thing `create_notification` gained when staff notifications arrived.
 * There is still no recipient parameter anywhere in this feature.
 */
export type NotificationAudience =
  Database["public"]["Enums"]["notification_audience"];

export type NotificationDeliveryStatus =
  Database["public"]["Enums"]["notification_delivery_status"];

export type NotificationOutboxStatus =
  Database["public"]["Enums"]["notification_outbox_status"];

/**
 * One notification, as the notification centre reads it.
 *
 * `title` and `body` were rendered by `features/notifications/templates.ts`
 * when the notification was created and stored as they were then — so a
 * template corrected next year does not silently rewrite what a patient was
 * told last year (section 99). `templateVersion` records which wording
 * produced them.
 *
 * `linkPath` is an application-relative path the database derived from the
 * resource. It identifies a resource and grants nothing: the destination
 * authorizes independently (sections 18, 84, 85).
 */
export interface Notification {
  readonly id: string;
  readonly eventType: NotificationEventType;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly body: string;
  readonly templateVersion: number;
  readonly resourceType: NotificationSubjectType;
  readonly resourceId: string;
  readonly linkPath: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}

/** A page of notifications, plus the cursor that continues it. */
export interface NotificationPage {
  readonly notifications: readonly Notification[];
  /**
   * The `createdAt` of the last row, or `null` when this is the last page.
   *
   * A cursor rather than an offset, so a notification arriving between two
   * page loads cannot shift a row across the boundary and hide it.
   */
  readonly nextCursor: string | null;
}

export type NotificationPageResult =
  | { readonly status: "ok"; readonly page: NotificationPage }
  | { readonly status: "unavailable" };

/**
 * A short, un-paginated list, for a summary panel.
 *
 * Deliberately not a `NotificationPage`: there is no cursor, because a
 * dashboard panel that could be paginated would be a second notification
 * centre. It keeps the "could not read" arm, so a panel can say so rather
 * than showing a patient an empty list when the database was unreachable.
 */
export type NotificationListResult =
  | { readonly status: "ok"; readonly notifications: readonly Notification[] }
  | { readonly status: "unavailable" };

export type UnreadCountResult =
  | { readonly status: "ok"; readonly count: number }
  | { readonly status: "unavailable" };

/** Which notifications the notification centre is showing. */
export type NotificationFilter = "all" | "unread";

/**
 * One preference row, as the preferences screen reads it.
 *
 * A row absent from the database means enabled, so the query layer fills the
 * gaps: the screen always renders the full grid and never has to decide what a
 * missing row means.
 */
export interface NotificationPreference {
  readonly category: NotificationCategory;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
  /**
   * True when this channel cannot be switched off for this category
   * (section 22). The control renders disabled with the reason beside it,
   * rather than being offered and then refused.
   */
  readonly mandatory: boolean;
}

export type NotificationPreferencesResult =
  | {
      readonly status: "ok";
      /**
       * Which audience this grid was built for.
       *
       * Carried alongside the rows rather than recomputed by the screen, so
       * the categories rendered and the words describing them cannot come
       * from two different answers to the same question.
       */
      readonly audience: NotificationAudience;
      readonly preferences: readonly NotificationPreference[];
    }
  | { readonly status: "unavailable" };

/**
 * Form state for the notification centre's actions.
 *
 * The same shape every feature in this project uses, so a caller written
 * against one action works against another.
 */
export interface NotificationFormState {
  readonly status: "idle" | "success" | "error";
  readonly message: string | null;
}

export const IDLE_NOTIFICATION_FORM_STATE: NotificationFormState = {
  status: "idle",
  message: null,
};

export function notificationFormError(message: string): NotificationFormState {
  return { status: "error", message };
}

export function notificationFormSuccess(
  message: string,
): NotificationFormState {
  return { status: "success", message };
}
