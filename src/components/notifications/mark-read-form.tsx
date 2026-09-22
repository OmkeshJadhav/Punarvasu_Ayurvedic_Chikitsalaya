"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { markNotificationReadAction } from "@/features/notifications/actions";
import { NOTIFICATION_CENTRE_COPY } from "@/features/notifications/content";
import { IDLE_NOTIFICATION_FORM_STATE } from "@/features/notifications/types";

/**
 * "Mark as read", for one notification.
 *
 * ## A real form, posting one id
 *
 * The id is the only field. Ownership is not in the form and could not be:
 * `mark_notification_read` matches the row by id **and** by `auth.uid()` in
 * one statement, so somebody else's id affects no rows — which is the same
 * answer as an id that does not exist (`phase_15.md` section 55).
 *
 * ## Why it is a client component
 *
 * For `useActionState`, which gives the button a pending state and keeps the
 * failure message beside the control instead of throwing the page into an
 * error boundary. It still works before hydration: it is a `<form>` with a
 * server action, and the browser will post it.
 *
 * ## The accessible name says which one
 *
 * A list of twelve identical "Mark as read" buttons is a list a screen-reader
 * user cannot navigate. The notification's title is appended, visually hidden.
 */
export function MarkNotificationReadButton({
  notificationId,
  notificationTitle,
}: {
  readonly notificationId: string;
  readonly notificationTitle: string;
}) {
  const [state, formAction, pending] = useActionState(
    markNotificationReadAction,
    IDLE_NOTIFICATION_FORM_STATE,
  );

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="notificationId" value={notificationId} />

      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {NOTIFICATION_CENTRE_COPY.markRead}
        <span className="sr-only">: {notificationTitle}</span>
      </Button>

      {state.status === "error" && state.message ? (
        // `role="alert"`, so a failure is announced rather than appearing
        // silently beside a button somebody has already looked away from.
        <span role="alert" className="text-caption text-destructive">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
