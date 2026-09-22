import Link from "next/link";
import { Bell } from "lucide-react";

import { UNREAD_COUNT_CAP } from "@/config/notifications";
import {
  NOTIFICATIONS_PATH,
  notificationBellLabel,
} from "@/features/notifications/content";
import { getUnreadNotificationCount } from "@/features/notifications/queries";

/**
 * The notification bell in the authenticated header.
 *
 * ## A server component, and the count is server state
 *
 * `phase_15.md` section 63. The number comes from an authorized query behind
 * row-level security, not from anything the browser keeps — a client-held
 * count is a number a user can edit, and a bell that says "3" because
 * `localStorage` said so is worse than no bell.
 *
 * It ships no JavaScript. The `(app)` layout is `force-dynamic`, so the count
 * is recomputed per request; the query is a `head` count against a partial
 * index covering exactly `(recipient, unread)`.
 *
 * ## Not colour alone
 *
 * Section 90, and WCAG 1.4.1. The unread state is a **number**, and the link's
 * accessible name says how many are unread — so a screen reader and a
 * colour-blind reader get the same information a coloured dot would have given
 * only to somebody who can see it.
 *
 * ## Why it is a link and not a panel
 *
 * Section 87 sketches a bell opening a panel. A panel is a client component, a
 * focus trap and a second place notifications are rendered; a link to a page
 * that already exists is none of those, works before hydration, can be opened
 * in a new tab, and is what somebody on a phone can actually hit. The page is
 * the notification centre.
 *
 * ## When the count cannot be read
 *
 * The bell still renders, with no number. A failed count is not worth an error
 * state in the chrome of every page — the notification centre itself says so
 * properly when somebody opens it.
 */
export async function NotificationBell() {
  const result = await getUnreadNotificationCount();
  const unread = result.status === "ok" ? result.count : 0;
  const overCap = unread > UNREAD_COUNT_CAP;

  return (
    <Link
      href={NOTIFICATIONS_PATH}
      aria-label={notificationBellLabel(unread, UNREAD_COUNT_CAP)}
      className="text-foreground hover:bg-muted focus-visible:outline-ring relative inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Bell aria-hidden className="size-5" />

      {unread > 0 ? (
        <span
          // `aria-hidden`, because the link's accessible name already says
          // how many are unread. Without this a screen reader reads the count
          // twice, once as a number with no context.
          aria-hidden
          className="bg-primary text-primary-foreground absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[0.6875rem] leading-5 font-medium"
        >
          {overCap ? `${UNREAD_COUNT_CAP}+` : unread}
        </span>
      ) : null}
    </Link>
  );
}
