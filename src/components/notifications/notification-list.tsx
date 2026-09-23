import Link from "next/link";
import { BellOff } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATIONS_PATH,
  NOTIFICATION_CENTRE_COPY,
  notificationEmptyBody,
} from "@/features/notifications/content";
import type {
  NotificationAudience,
  NotificationFilter,
  NotificationPage,
} from "@/features/notifications/types";

import { NotificationItem } from "./notification-item";

/**
 * The notification list, and the way to older ones.
 *
 * ## A real list
 *
 * `<ul>`/`<li>`, so a screen reader announces how many there are. The items
 * are cards on every screen size rather than a table: a notification is a
 * short message, not a row of fields, and nothing here is tabular.
 *
 * ## The empty state depends on the filter, and on the reader
 *
 * Section 89. "You're all caught up" is right for an empty inbox and wrong for
 * an empty *unread* filter, where the answer is "you have read everything —
 * switch to All". Two states, because they lead somewhere different.
 *
 * The empty inbox also says what *will* appear here, and that differs: a
 * patient is waiting for their care, a practitioner for changes to their day.
 * Promising a practitioner that we will tell them when their practitioner
 * shares something would be nonsense.
 *
 * ## Pagination is a link
 *
 * Section 94: never load everything. A cursor in the URL rather than an
 * offset, so a notification arriving between two page loads cannot shift a row
 * across the boundary and hide it — and a link rather than an infinite scroll,
 * because a list that grows as you look at it is a list you cannot get to the
 * bottom of with a keyboard.
 */
export function NotificationList({
  page,
  filter,
  audience,
}: {
  readonly page: NotificationPage;
  readonly filter: NotificationFilter;
  readonly audience: NotificationAudience;
}) {
  if (page.notifications.length === 0) {
    return (
      <EmptyState
        icon={<BellOff />}
        title={
          filter === "unread"
            ? NOTIFICATION_CENTRE_COPY.emptyUnreadTitle
            : NOTIFICATION_CENTRE_COPY.emptyTitle
        }
        description={
          filter === "unread"
            ? NOTIFICATION_CENTRE_COPY.emptyUnreadBody
            : notificationEmptyBody(audience)
        }
        action={
          filter === "unread" ? (
            <Button asChild variant="secondary">
              <Link href={NOTIFICATIONS_PATH}>
                {NOTIFICATION_CENTRE_COPY.filterAll}
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  const listHeading =
    filter === "unread"
      ? NOTIFICATION_CENTRE_COPY.listHeadingUnread
      : NOTIFICATION_CENTRE_COPY.listHeadingAll;

  return (
    <div className="flex flex-col gap-6">
      {/*
        The `h2` between the page's `h1` and each notification's `h3`.

        Phase 18's browser pass found the gap — axe `heading-order`, which
        jsdom's sweeps could not see because they render this list on its own,
        without the page heading above it. It is visible rather than `sr-only`
        because "All notifications" / "Unread notifications" is genuinely
        useful to everybody: it says which view you are looking at, which was
        previously carried only by a control's pressed state.
      */}
      {/* Grouped, so the heading sits with the list it names. */}
      <div className="flex flex-col gap-3">
        <h2 className="text-h5 text-heading font-sans font-medium">
          {listHeading}
        </h2>

        <ul className="flex flex-col gap-3">
          {page.notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))}
        </ul>
      </div>

      {page.nextCursor ? (
        <div>
          <Button asChild variant="secondary" size="sm">
            <Link
              href={`${NOTIFICATIONS_PATH}?${new URLSearchParams({
                ...(filter === "unread" ? { filter: "unread" } : {}),
                cursor: page.nextCursor,
              }).toString()}`}
            >
              {NOTIFICATION_CENTRE_COPY.olderLabel}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
