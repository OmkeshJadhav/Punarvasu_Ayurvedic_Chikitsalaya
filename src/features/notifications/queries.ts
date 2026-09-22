import "server-only";

/**
 * Server-side notification reads.
 *
 * ## Every read is scoped by the session, not by an argument
 *
 * `phase_15.md` sections 54 and 55, and example 2. Not one function here takes
 * a user id, so there is none to substitute — the same structural choice Phase
 * 07 made for the patient profile, Phase 13 for prescriptions and Phase 14 for
 * documents. `notifications_select_own` scopes it again in the database, and
 * that policy is what actually denies.
 *
 * The policy carries `status = 'active'` as well as the recipient, so a
 * **scheduled reminder is invisible to the patient it is for** until its time
 * comes. That is a predicate on the row rather than a filter a query could
 * forget, the same arrangement Phase 13 used for `status <> 'draft'`.
 *
 * ## Column lists, never `select *`
 *
 * `dedupe_key`, `reminder_offset_minutes`, `cancelled_at` and `updated_at`
 * have no select grant at all, so `select *` would fail outright. Naming the
 * columns makes that explicit rather than incidental.
 *
 * ## Bounded, always
 *
 * Section 94 and 136. The list is a page with a cursor, the unread count stops
 * at a cap, and neither can be asked for more than it offers.
 */

import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_RECENT_LIMIT_CAP as RECENT_LIMIT_CAP,
  UNREAD_COUNT_CAP,
  isMandatoryChannel,
} from "@/config/notifications";
import { assertPermission } from "@/lib/authorization/guards";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationFilter,
  NotificationListResult,
  NotificationPageResult,
  NotificationPreference,
  NotificationPreferencesResult,
  UnreadCountResult,
} from "./types";

const NOTIFICATION_COLUMNS = [
  "id",
  "event_type",
  "category",
  "title",
  "body",
  "template_version",
  "resource_type",
  "resource_id",
  "link_path",
  "read_at",
  "created_at",
].join(", ");

interface NotificationRow {
  readonly id: string;
  readonly event_type: Notification["eventType"];
  readonly category: NotificationCategory;
  readonly title: string;
  readonly body: string;
  readonly template_version: number;
  readonly resource_type: Notification["resourceType"];
  readonly resource_id: string;
  readonly link_path: string;
  readonly read_at: string | null;
  readonly created_at: string;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    eventType: row.event_type,
    category: row.category,
    title: row.title,
    body: row.body,
    templateVersion: row.template_version,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    linkPath: row.link_path,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/**
 * One page of the signed-in user's notifications.
 *
 * **Takes no user id.** `cursor` is a `created_at` from a previous page, and
 * a cursor rather than an offset because a notification arriving between two
 * page loads would shift every row of an offset-paged list by one and hide
 * whichever fell across the boundary.
 *
 * A cursor pointing at somebody else's notification is not a disclosure and
 * not a concern: it is a timestamp, and the query it narrows is still scoped
 * to the caller by the policy.
 */
export async function listNotifications(
  options: {
    readonly filter?: NotificationFilter;
    readonly cursor?: string | null;
  } = {},
): Promise<NotificationPageResult> {
  await assertPermission("notifications.read.self");

  const filter = options.filter ?? "all";

  try {
    const supabase = await createSupabaseServerClient();

    // One more than the page, so "is there another page?" is answered
    // without a second count query over the same rows.
    let query = supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(NOTIFICATION_PAGE_SIZE + 1);

    if (filter === "unread") {
      query = query.is("read_at", null);
    }

    if (options.cursor) {
      query = query.lt("created_at", options.cursor);
    }

    const { data, error } = await query.returns<NotificationRow[]>();

    if (error) {
      logger.error("notification.list_failed", error);
      return { status: "unavailable" };
    }

    const rows = data ?? [];
    const hasMore = rows.length > NOTIFICATION_PAGE_SIZE;
    const page = rows.slice(0, NOTIFICATION_PAGE_SIZE);

    return {
      status: "ok",
      page: {
        notifications: page.map(toNotification),
        nextCursor:
          hasMore && page.length > 0
            ? (page[page.length - 1]?.created_at ?? null)
            : null,
      },
    };
  } catch (error) {
    logger.error("notification.list_error", error);
    return { status: "unavailable" };
  }
}

/**
 * The newest few notifications, for a summary panel.
 *
 * ## Why it is not `listNotifications` with a smaller page
 *
 * Phase 18's dashboard shows three. `listNotifications` always asks for a
 * page plus one so it can answer "is there more?", and a dashboard has no
 * "more" to offer — it links to the notification centre, which does. Asking
 * for twenty-one rows to render three is the kind of thing `phase_18.md`
 * section 94 is about.
 *
 * It returns a plain list rather than a page: there is deliberately no cursor
 * here, because a dashboard panel that could be paginated would be a second
 * notification centre.
 *
 * Takes no user id, like every other read in this file.
 */
export async function listRecentNotifications(
  limit: number,
): Promise<NotificationListResult> {
  await assertPermission("notifications.read.self");

  // Bounded here as well as by the caller, so a future caller passing a
  // computed value cannot turn a summary panel into an unbounded read.
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), RECENT_LIMIT_CAP);

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(bounded)
      .returns<NotificationRow[]>();

    if (error) {
      logger.error("notification.recent_failed", error);
      return { status: "unavailable" };
    }

    return { status: "ok", notifications: (data ?? []).map(toNotification) };
  } catch (error) {
    logger.error("notification.recent_error", error);
    return { status: "unavailable" };
  }
}

/**
 * How many unread notifications the signed-in user has.
 *
 * Section 63: the count comes from authorized server state, never from a
 * number the browser keeps. It runs on every authenticated page, so it is a
 * `head` count against a partial index and it stops at the cap — a precise
 * figure in the hundreds tells nobody anything they can act on.
 */
export async function getUnreadNotificationCount(): Promise<UnreadCountResult> {
  const user = await getCurrentUser();

  // Deliberately not `assertPermission`: this runs in the application shell
  // for every signed-in person, and a role that cannot read notifications
  // should see no bell rather than a thrown error on every page.
  if (!user || !can(user.role, "notifications.read.self")) {
    return { status: "ok", count: 0 };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .limit(UNREAD_COUNT_CAP + 1);

    if (error) {
      logger.error("notification.unread_count_failed", error);
      return { status: "unavailable" };
    }

    return {
      status: "ok",
      count: Math.min(count ?? 0, UNREAD_COUNT_CAP + 1),
    };
  } catch (error) {
    logger.error("notification.unread_count_error", error);
    return { status: "unavailable" };
  }
}

/**
 * The signed-in user's communication preferences, as a complete grid.
 *
 * A missing row means enabled, so the gaps are filled here: the screen always
 * renders every category against every channel and never has to decide what an
 * absent row meant. `mandatory` comes from the same table the database checks,
 * so a control that would be refused is rendered disabled instead of being
 * offered (section 22).
 */
export async function getNotificationPreferences(): Promise<NotificationPreferencesResult> {
  await assertPermission("notifications.write.self");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("category, channel, enabled")
      .returns<
        {
          category: NotificationCategory;
          channel: NotificationChannel;
          enabled: boolean;
        }[]
      >();

    if (error) {
      logger.error("notification.preferences_failed", error);
      return { status: "unavailable" };
    }

    const stored = new Map<string, boolean>(
      (data ?? []).map((row) => [
        `${row.category}:${row.channel}`,
        row.enabled,
      ]),
    );

    const preferences: NotificationPreference[] = [];

    for (const category of Object.keys(
      NOTIFICATION_CATEGORIES,
    ) as NotificationCategory[]) {
      for (const channel of NOTIFICATION_CHANNELS) {
        const mandatory = isMandatoryChannel(category, channel);
        preferences.push({
          category,
          channel,
          // A mandatory channel reads as enabled whatever the table says,
          // because the database refuses to disable it. A stale row from a
          // policy change must not render a control as off when it is on.
          enabled: mandatory || (stored.get(`${category}:${channel}`) ?? true),
          mandatory,
        });
      }
    }

    return { status: "ok", preferences };
  } catch (error) {
    logger.error("notification.preferences_error", error);
    return { status: "unavailable" };
  }
}
