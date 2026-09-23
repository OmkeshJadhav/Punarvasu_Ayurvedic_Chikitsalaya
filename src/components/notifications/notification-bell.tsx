import { UNREAD_COUNT_CAP } from "@/config/notifications";
import { getNotificationBellSnapshot } from "@/features/notifications/queries";

import { NotificationBellMenu } from "./notification-bell-menu";

/**
 * The notification bell in the authenticated header.
 *
 * ## A server component, and the data is server state
 *
 * `phase_15.md` section 63. The count and the preview come from authorized
 * queries behind row-level security, not from anything the browser keeps — a
 * client-held count is a number a user can edit, and a bell that says "3"
 * because `localStorage` said so is worse than no bell.
 *
 * The `(app)` layout is `force-dynamic`, so both are recomputed per request:
 * the count is a `head` count against a partial index covering exactly
 * `(recipient, unread)`, and the preview is at most five rows.
 *
 * ## Not colour alone
 *
 * Section 90, and WCAG 1.4.1. The unread state is a **number**, and the
 * trigger's accessible name says how many are unread.
 *
 * ## A panel after all, and why that changed
 *
 * Phase 15 made the bell a plain link to the notification centre, reasoning
 * that a panel was a second place notifications are rendered. The preview is
 * now wanted, and it stays deliberately small: the newest five, read and
 * unread, each opening its own resource, and "View all" for the centre. It
 * does not filter, paginate or mark all read — the centre still does those.
 * See `NotificationBellMenu` for the interaction and accessibility model.
 *
 * ## When a read fails
 *
 * A failed count renders the bell with no number; a failed list renders a
 * sentence in the panel pointing at "View all". Neither is worth an error
 * state in the chrome of every page.
 */
export async function NotificationBell() {
  const { unread, recent } = await getNotificationBellSnapshot();

  return (
    <NotificationBellMenu
      unread={unread.status === "ok" ? unread.count : 0}
      unreadCap={UNREAD_COUNT_CAP}
      recent={recent}
    />
  );
}
