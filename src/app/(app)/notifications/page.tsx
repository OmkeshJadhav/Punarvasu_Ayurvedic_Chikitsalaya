import type { Metadata } from "next";
import Link from "next/link";

import { NotificationFilters } from "@/components/notifications/notification-filters";
import { NotificationList } from "@/components/notifications/notification-list";
import { MarkAllNotificationsReadForm } from "@/components/notifications/mark-all-read-form";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { notificationAudienceForRole } from "@/config/notifications";
import {
  NOTIFICATIONS_PATH,
  NOTIFICATION_CENTRE_COPY,
  NOTIFICATION_PREFERENCES_PATH,
  notificationCentreDescription,
} from "@/features/notifications/content";
import { listNotifications } from "@/features/notifications/queries";
import { requireUser } from "@/lib/auth/current-user";
import {
  parseNotificationCursor,
  parseNotificationFilter,
} from "@/features/notifications/validation";

/**
 * The notification centre.
 *
 * ## No user id, anywhere
 *
 * `listNotifications()` takes a filter and a cursor and nothing else. There is
 * no identifier on this page, in its URL or in any form it renders that names
 * a person — `phase_15.md` sections 54 and 55, and example 2. Row-level
 * security scopes every row to `auth.uid()`, and it also carries
 * `status = 'active'`, so a scheduled reminder is invisible here even to the
 * patient it is for.
 *
 * ## A failed read is not an empty one
 *
 * Distinguished deliberately, as everywhere else in this project: telling
 * somebody they have no notifications when the database was unreachable is
 * how a patient concludes the clinic never told them anything.
 *
 * ## Available to every signed-in person
 *
 * One page, every role, because a notification is a message addressed to an
 * account rather than to a kind of person. A practitioner reads their own
 * schedule changes here; a receptionist and an administrator see the empty
 * state, which is honest — no notification is written for either.
 *
 * The **words** differ by role and nothing else does. The list, the filters,
 * the read state and the query are identical, and the audience below decides
 * only how the page introduces itself. It decides nothing about what can be
 * read: `notifications_select_own` scopes every row to `auth.uid()` whatever
 * the role says.
 */
export const metadata: Metadata = {
  title: NOTIFICATION_CENTRE_COPY.title,
  robots: { index: false, follow: false },
};

export default async function NotificationsPage(
  props: PageProps<"/notifications">,
) {
  const searchParams = await props.searchParams;

  // The role comes from the database through `requireUser()`, not from
  // anything the browser sent. `listNotifications()` authorizes separately.
  const user = await requireUser(NOTIFICATIONS_PATH);
  const audience = notificationAudienceForRole(user.role);

  const filter = parseNotificationFilter(searchParams.filter);
  const cursor = parseNotificationCursor(searchParams.cursor);

  const result = await listNotifications({ filter, cursor });

  const hasUnread =
    result.status === "ok" &&
    result.page.notifications.some(
      (notification) => notification.readAt === null,
    );

  return (
    <Section aria-labelledby="notifications-heading">
      <Container width="content">
        <h1
          id="notifications-heading"
          className="text-h2 text-heading font-normal"
        >
          {NOTIFICATION_CENTRE_COPY.title}
        </h1>
        <p className="text-body text-muted-foreground measure mt-2">
          {notificationCentreDescription(audience)}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <NotificationFilters active={filter} />

          <Link
            href={NOTIFICATION_PREFERENCES_PATH}
            className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {NOTIFICATION_CENTRE_COPY.preferencesLink}
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {result.status === "unavailable" ? (
            <ErrorState
              title={NOTIFICATION_CENTRE_COPY.errorTitle}
              description={NOTIFICATION_CENTRE_COPY.errorBody}
              action={
                <Button asChild variant="secondary">
                  {/*
                    The read happens during server rendering, so re-requesting
                    the page *is* the retry — no client component needed.
                  */}
                  <Link href={NOTIFICATIONS_PATH}>
                    {NOTIFICATION_CENTRE_COPY.retry}
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              {result.page.notifications.length > 0 ? (
                <MarkAllNotificationsReadForm hasUnread={hasUnread} />
              ) : null}

              <NotificationList
                page={result.page}
                filter={filter}
                audience={audience}
              />
            </>
          )}
        </div>
      </Container>
    </Section>
  );
}
