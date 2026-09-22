"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/features/notifications/actions";
import { NOTIFICATION_CENTRE_COPY } from "@/features/notifications/content";
import { IDLE_NOTIFICATION_FORM_STATE } from "@/features/notifications/types";

/**
 * "Mark all as read".
 *
 * ## The form carries nothing
 *
 * No fields at all — not a user id, not a list of ids, not a filter. The
 * database scopes the update by `auth.uid()` in the statement, so there is
 * nothing here to manipulate and nothing this component could get wrong
 * (`phase_15.md` sections 17, 54).
 *
 * ## It says what happened
 *
 * Marking all read when nothing was unread reports exactly that, rather than
 * a success message implying something changed. A confirmation that is true
 * whatever happened is a confirmation nobody reads.
 *
 * ## Disabled when there is nothing to do
 *
 * Not a security decision — the action is safe to run on an empty set. It
 * keeps the control from being the most prominent thing on a page that is
 * already all read.
 */
export function MarkAllNotificationsReadForm({
  hasUnread,
}: {
  readonly hasUnread: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    markAllNotificationsReadAction,
    IDLE_NOTIFICATION_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        loading={pending}
        disabled={!hasUnread}
      >
        {hasUnread
          ? NOTIFICATION_CENTRE_COPY.markAllRead
          : NOTIFICATION_CENTRE_COPY.markAllReadEmpty}
      </Button>

      {state.message ? (
        <span
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-caption text-destructive"
              : "text-caption text-muted-foreground"
          }
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
