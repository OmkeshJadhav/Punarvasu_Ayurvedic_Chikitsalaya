"use server";

/**
 * Notification server actions.
 *
 * ## There are four, and none of them sends anything
 *
 * Mark one read, open one (mark it read and go to it), mark all read, change
 * one preference. That is the complete set of things a browser can ask this
 * feature to do.
 *
 * `phase_15.md` section 109 asks that no arbitrary notification-sending
 * endpoint be exposed to ordinary users, and the strongest form of that is
 * having none to expose: creating a notification is `create_notification`,
 * which is granted to `service_role` alone and reachable only from the worker.
 * There is no action, no route handler and no RPC grant by which a signed-in
 * person can cause a message to be sent to anybody — including themselves.
 *
 * ## No action takes a user id
 *
 * Sections 54, 97, 98 and 110. Every one of the database functions
 * behind these actions reads `auth.uid()` itself. A form carrying `userId`,
 * `recipientUserId`, `recipientEmail` or `recipientPhone` is rejected by
 * `strict()` before it reaches one, and would have nowhere to arrive if it
 * were not.
 *
 * ## Why `can()` rather than `assertPermission()`
 *
 * These report failure as form state. An action that throws inside a form
 * submission produces a generic error boundary instead of a message beside the
 * control, which is worse for the person and no safer — the database refuses
 * regardless. The same reasoning every feature since Phase 07 has used.
 *
 * ## What is never logged
 *
 * A notification's title or body, a link, an email address. What is logged is
 * the operation and an opaque user id (section 78).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  NOTIFICATIONS_PATH,
  NOTIFICATION_CENTRE_COPY,
  NOTIFICATION_PREFERENCES_COPY,
  NOTIFICATION_PREFERENCES_PATH,
} from "./content";
import { describeNotificationFailure } from "./errors";
import { isApplicationPath } from "./links";
import { getNotificationLinkPath } from "./queries";
import {
  notificationFormError,
  notificationFormSuccess,
  type NotificationFormState,
} from "./types";
import {
  markNotificationReadSchema,
  setNotificationPreferenceSchema,
} from "./validation";

/** Reads only the fields a form is allowed to carry. The first allowlist gate. */
function readForm(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const name of fields) {
    const value = formData.get(name);
    values[name] = typeof value === "string" ? value : "";
  }

  return values;
}

/** The authenticated user, or the form state explaining why not. */
async function requireNotificationWriter(): Promise<
  { readonly userId: string } | { readonly failure: NotificationFormState }
> {
  const user = await getCurrentUser();

  if (!user) {
    logger.warn("notification.write_unauthenticated");
    return {
      failure: notificationFormError(
        "Your session has ended. Please sign in again to continue.",
      ),
    };
  }

  if (!can(user.role, "notifications.write.self")) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission: "notifications.write.self",
    });
    return { failure: notificationFormError(DEFAULT_USER_MESSAGE.forbidden) };
  }

  return { userId: user.id };
}

const MARK_READ_FIELDS = ["notificationId"] as const;

/**
 * Marks one of the signed-in user's notifications read.
 *
 * Ownership is not checked here, and that is not an omission: it is checked
 * inside `mark_notification_read`, where the row is matched by id **and** by
 * `auth.uid()` in one statement. Somebody else's notification affects no rows,
 * which is indistinguishable from an id that does not exist — section 55's
 * requirement, reached by having nothing else to say.
 */
export async function markNotificationReadAction(
  _previousState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const actor = await requireNotificationWriter();
  if ("failure" in actor) return actor.failure;

  const parsed = markNotificationReadSchema.safeParse(
    readForm(formData, MARK_READ_FIELDS),
  );

  if (!parsed.success) {
    return notificationFormError(
      "We couldn't update that notification. Please try again.",
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: parsed.data.notificationId,
    });

    if (error) {
      const failure = describeNotificationFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return notificationFormError(failure.message);
    }
  } catch (error) {
    logger.error("notification.mark_read_error", error, {
      userId: actor.userId,
    });
    return notificationFormError(DEFAULT_USER_MESSAGE.internal);
  }

  revalidatePath(NOTIFICATIONS_PATH);

  return notificationFormSuccess(NOTIFICATION_CENTRE_COPY.markedRead);
}

/**
 * Opens one notification from the bell's preview: marks it read, then goes to
 * the resource it is about.
 *
 * ## The destination is read from the row, never from the form
 *
 * The form carries the id and nothing else. The path is looked up under
 * `notifications_select_own`, so the only places this can send anybody are
 * links on their own notifications — and it is checked to be an application
 * path before `redirect()` sees it, because `redirect()` would follow an
 * absolute URL off-site.
 *
 * ## It always navigates
 *
 * Opening a notification is the point; marking it read is housekeeping. So a
 * failed mark-read still goes to the resource (the notification simply stays
 * unread), and anything that prevents finding the resource — an invalid id,
 * somebody else's id, a signed-out session — lands on the notification
 * centre, which explains itself properly.
 */
export async function openNotificationAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireNotificationWriter();
  const parsed = markNotificationReadSchema.safeParse(
    readForm(formData, MARK_READ_FIELDS),
  );

  if ("failure" in actor || !parsed.success) {
    redirect(NOTIFICATIONS_PATH);
  }

  const linkPath = await getNotificationLinkPath(parsed.data.notificationId);

  if (linkPath === null || !isApplicationPath(linkPath)) {
    redirect(NOTIFICATIONS_PATH);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: parsed.data.notificationId,
    });

    if (error) {
      logger.warn(describeNotificationFailure(error).logEvent, {
        userId: actor.userId,
      });
    }
  } catch (error) {
    logger.error("notification.open_mark_read_error", error, {
      userId: actor.userId,
    });
  }

  revalidatePath(NOTIFICATIONS_PATH);

  // Outside the try, deliberately: `redirect()` signals by throwing.
  redirect(linkPath);
}

/**
 * Marks every unread notification of the signed-in user read.
 *
 * Takes no form fields at all, which is the point: there is nothing to
 * manipulate. The database scopes the update by `auth.uid()` in the statement.
 */
export async function markAllNotificationsReadAction(
  _previousState: NotificationFormState,
): Promise<NotificationFormState> {
  const actor = await requireNotificationWriter();
  if ("failure" in actor) return actor.failure;

  let marked = 0;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("mark_all_notifications_read");

    if (error) {
      const failure = describeNotificationFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return notificationFormError(failure.message);
    }

    marked = typeof data === "number" ? data : 0;
  } catch (error) {
    logger.error("notification.mark_all_read_error", error, {
      userId: actor.userId,
    });
    return notificationFormError(DEFAULT_USER_MESSAGE.internal);
  }

  revalidatePath(NOTIFICATIONS_PATH);

  // A count, not a list. Saying "nothing was unread" beats a success message
  // that implies something happened when nothing did.
  return notificationFormSuccess(
    marked > 0
      ? NOTIFICATION_CENTRE_COPY.markedAllRead
      : NOTIFICATION_CENTRE_COPY.nothingToMark,
  );
}

const PREFERENCE_FIELDS = ["category", "channel", "enabled"] as const;

/**
 * Changes one of the signed-in user's communication preferences.
 *
 * Section 97: a user modifies only their own, and section 98: a staff account
 * is scoped the same way. Neither is enforced here — `set_notification_
 * preference` has no user id parameter, so there is nothing for this action to
 * get wrong.
 *
 * Section 22's mandatory rule is enforced in the database too. The control is
 * rendered disabled so it is not normally reachable, but a posted form that
 * tries anyway is refused with a sentence rather than silently ignored.
 */
export async function setNotificationPreferenceAction(
  _previousState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const actor = await requireNotificationWriter();
  if ("failure" in actor) return actor.failure;

  const parsed = setNotificationPreferenceSchema.safeParse(
    readForm(formData, PREFERENCE_FIELDS),
  );

  if (!parsed.success) {
    return notificationFormError(NOTIFICATION_PREFERENCES_COPY.saveError);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("set_notification_preference", {
      p_category: parsed.data.category,
      p_channel: parsed.data.channel,
      p_enabled: parsed.data.enabled,
    });

    if (error) {
      const failure = describeNotificationFailure(error);
      logger.warn(failure.logEvent, { userId: actor.userId });
      return notificationFormError(failure.message);
    }
  } catch (error) {
    logger.error("notification.preference_error", error, {
      userId: actor.userId,
    });
    return notificationFormError(DEFAULT_USER_MESSAGE.internal);
  }

  logger.info("notification.preference_updated", { userId: actor.userId });

  revalidatePath(NOTIFICATION_PREFERENCES_PATH);

  return notificationFormSuccess(NOTIFICATION_PREFERENCES_COPY.saved);
}
