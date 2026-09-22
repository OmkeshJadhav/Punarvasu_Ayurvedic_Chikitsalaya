/**
 * The trust boundary for the notification centre.
 *
 * ## What a browser is allowed to send
 *
 * Three things, in total: the id of a notification to mark read, and a
 * (category, channel, enabled) triple for a preference. That is the whole
 * surface.
 *
 * There is **no schema here for creating a notification**, for choosing a
 * recipient, for setting a title, a body, a channel's provider, a delivery
 * status or a link — because there is no action that accepts any of them
 * (`phase_15.md` sections 42, 109, 110, 129, and example 9). This module's
 * tests assert that, one hostile field at a time: every one of
 * `recipientUserId`, `recipientEmail`, `recipientPhone`, `userId`, `to`,
 * `subject`, `body`, `title`, `template`, `linkPath`, `url`, `status`,
 * `provider` and `deliveryStatus` is **rejected rather than stripped**, so a
 * request carrying one is visible in a log instead of quietly succeeding
 * minus a field.
 *
 * ## Why `strict()` rather than a permissive parse
 *
 * The same reason every phase since 07 gives: a dropped field is how a
 * capability arrives by accident, and a rejected request is a thing somebody
 * can see happening.
 */

import { z } from "zod";

import { uuidSchema } from "@/lib/validation/schemas";

/**
 * Marking one notification read.
 *
 * The id is the only field. Ownership is not in this schema and cannot be:
 * `mark_notification_read` scopes by `auth.uid()` in the statement itself, so
 * somebody else's id matches no rows — the same answer as an id that does not
 * exist (section 55).
 */
export const markNotificationReadSchema = z
  .object({
    notificationId: uuidSchema,
  })
  .strict();

export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadSchema
>;

/** The three preference categories. Mirrors the database enum. */
export const notificationCategorySchema = z.enum([
  "appointment_updates",
  "appointment_reminders",
  "clinical_updates",
]);

/**
 * The two channels that exist.
 *
 * `sms` and `whatsapp` are absent because no such channel exists anywhere in
 * this system — not in the enum, not as an adapter, not as a delivery row. A
 * request naming one is rejected here and would be rejected by the database's
 * enum afterwards.
 */
export const notificationChannelSchema = z.enum(["in_app", "email"]);

/**
 * Changing one preference.
 *
 * No user id, deliberately and structurally: section 97's
 * `{"userId": "another-user"}` is rejected by `strict()` here and has no
 * parameter to arrive at in `set_notification_preference`, which reads
 * `auth.uid()` itself.
 */
export const setNotificationPreferenceSchema = z
  .object({
    category: notificationCategorySchema,
    channel: notificationChannelSchema,
    // A checkbox posts "on" or nothing; the form sends an explicit value so
    // an unchecked box is a deliberate `false` rather than an absent field.
    enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
  })
  .strict();

export type SetNotificationPreferenceInput = z.infer<
  typeof setNotificationPreferenceSchema
>;

/**
 * The notification centre's filter, from the query string.
 *
 * Anything else falls back to `all` rather than failing: a mistyped URL should
 * show a list, not an error.
 */
export function parseNotificationFilter(value: unknown): "all" | "unread" {
  return value === "unread" ? "unread" : "all";
}

/**
 * The pagination cursor, from the query string.
 *
 * An ISO instant and nothing else. It is compared against `created_at` in a
 * query that row-level security has already scoped to the caller, so a
 * hostile value narrows somebody's own list and discloses nothing — but it is
 * bounded and shape-checked anyway, because an unvalidated string reaching a
 * query is a habit worth not having.
 */
export function parseNotificationCursor(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 40) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;

  return new Date(parsed).toISOString();
}
