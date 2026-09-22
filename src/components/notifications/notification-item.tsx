import Link from "next/link";

import { formatClinicDateTime } from "@/features/appointments/time";
import { NOTIFICATION_CENTRE_COPY } from "@/features/notifications/content";
import type { Notification } from "@/features/notifications/types";

import { MarkNotificationReadButton } from "./mark-read-form";

/**
 * One notification in the list.
 *
 * ## What it shows, and what it does not
 *
 * Section 88: a title, a short message, a date, the read state and a way to
 * the resource. Nothing else — and there is nothing else available, because
 * the row holds a rendered title and body and no clinical field exists for it
 * to hold one (sections 80, 81).
 *
 * The title and body are rendered as **text**. React escapes them, and they
 * were written by `templates.ts` rather than by anybody's input in the first
 * place, so there are two independent reasons markup in one cannot become
 * markup on the page.
 *
 * ## Unread is a word, not a colour
 *
 * Section 90. The unread state is announced as the word "Unread" and marked
 * with a shape as well as a tone, so it survives a colour-blind reader, a
 * screen reader and a printed page. The surrounding tint is decoration on top
 * of that, never the signal itself.
 *
 * ## Two controls, on purpose
 *
 * A real `<a>` to the resource — so middle-click, "open in new tab" and a
 * screen reader's link list all work — and a separate form button to mark it
 * read. Making the whole row a form button would have taken all of that away
 * in exchange for one fewer tap.
 *
 * The link **authorizes nothing**. It names a resource, and the destination
 * re-authenticates and re-authorizes on arrival; another patient's link
 * reaches the same not-found state as a guessed id, because row-level
 * security means the row is absent (sections 18, 85, and example 8).
 */
export function NotificationItem({
  notification,
}: {
  readonly notification: Notification;
}) {
  const unread = notification.readAt === null;
  const createdAt = new Date(notification.createdAt);
  const titleId = `notification-title-${notification.id}`;

  return (
    <li
      aria-labelledby={titleId}
      className={[
        "border-border rounded-lg border p-4 sm:p-5",
        unread ? "bg-secondary/40 border-border-strong" : "bg-card",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h3
            id={titleId}
            className="text-body text-heading font-sans font-medium"
          >
            {notification.title}
          </h3>

          {unread ? (
            <span className="bg-primary text-primary-foreground text-caption inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-medium">
              {NOTIFICATION_CENTRE_COPY.unreadBadge}
            </span>
          ) : null}
        </div>

        <p className="text-body-sm text-muted-foreground measure">
          {notification.body}
        </p>

        {/*
          An absolute instant rather than "2 hours ago": a relative time needs
          a clock on the client to stay honest, and a patient checking when
          the clinic told them something wants the time it happened.
        */}
        <p className="text-caption text-muted-foreground">
          <time dateTime={notification.createdAt}>
            {formatClinicDateTime(createdAt)}
          </time>
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={notification.linkPath}
            className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {NOTIFICATION_CENTRE_COPY.openLabel}
            <span className="sr-only">: {notification.title}</span>
          </Link>

          {unread ? (
            <MarkNotificationReadButton
              notificationId={notification.id}
              notificationTitle={notification.title}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}
