import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { formatClinicDateTime } from "@/features/appointments/time";
import { NOTIFICATION_CENTRE_COPY } from "@/features/notifications/content";
import type { NotificationListResult } from "@/features/notifications/types";
import { PATIENT_DASHBOARD } from "@/features/patients/content";

/**
 * The newest few notifications, as a glance.
 *
 * ## Why it repeats the notification centre rather than replacing it
 *
 * `phase_18.md` section 5 puts recent notifications on the dashboard, and
 * section 38 keeps the notification centre. This is the glance; the centre is
 * the list, with filtering, marking read and pagination. So this panel
 * deliberately has **no** "mark as read" control and **no** cursor: a second
 * place to manage notifications would be a second thing to keep correct, and
 * the difference between the two would confuse before it helped.
 *
 * ## Titles and bodies are already minimal, and that is not this file's doing
 *
 * Phase 15 renders a notification's wording when it is created, from a
 * template that carries no medicine, no dose, no diagnosis and no document
 * title — and there is no column on `notifications` for any of them. So
 * section 39's "minimise sensitive content" is satisfied by the schema rather
 * than by truncation here, and this panel can show the real title safely.
 *
 * They are rendered as **text**: React escapes them, and they were written by
 * a template rather than by anybody's input in the first place.
 *
 * ## The link authorizes nothing
 *
 * `linkPath` names a resource. The destination re-authenticates and
 * re-authorizes on arrival, so another patient's link reaches the same
 * not-found state as a guessed id (sections 40, 86).
 */
export function RecentUpdates({
  result,
}: {
  readonly result: NotificationListResult;
}) {
  const copy = PATIENT_DASHBOARD.updates;

  if (result.status === "unavailable") {
    return (
      <Card variant="muted">
        <CardContent>
          <p className="text-body-sm text-muted-foreground measure">
            {copy.errorBody}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (result.notifications.length === 0) {
    return (
      <Card variant="muted">
        <CardContent className="flex flex-col gap-1">
          <p className="text-body text-heading font-sans font-medium">
            {copy.emptyTitle}
          </p>
          <p className="text-body-sm text-muted-foreground measure">
            {copy.emptyBody}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {result.notifications.map((notification) => {
        const unread = notification.readAt === null;

        return (
          <li key={notification.id}>
            <Card variant="interactive" padding="compact">
              <CardContent className="flex flex-col gap-1">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <h3 className="text-body text-heading font-sans font-medium">
                    <Link
                      href={notification.linkPath}
                      className="after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {notification.title}
                    </Link>
                  </h3>

                  {/*
                    Unread is a word, not a tint (section 90, WCAG 1.4.1) —
                    the same treatment the notification centre uses, so the two
                    screens agree about what "unread" looks like.
                  */}
                  {unread ? (
                    <span className="bg-primary text-primary-foreground text-caption inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-medium">
                      {NOTIFICATION_CENTRE_COPY.unreadBadge}
                    </span>
                  ) : null}
                </div>

                <p className="text-body-sm text-muted-foreground measure">
                  {notification.body}
                </p>

                <p className="text-caption text-muted-foreground mt-1">
                  <time dateTime={notification.createdAt}>
                    {formatClinicDateTime(new Date(notification.createdAt))}
                  </time>
                </p>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
