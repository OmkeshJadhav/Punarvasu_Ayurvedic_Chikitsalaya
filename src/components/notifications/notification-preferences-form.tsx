"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
} from "@/config/notifications";
import { setNotificationPreferenceAction } from "@/features/notifications/actions";
import { NOTIFICATION_PREFERENCES_COPY } from "@/features/notifications/content";
import {
  IDLE_NOTIFICATION_FORM_STATE,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreference,
} from "@/features/notifications/types";

/**
 * The communication preferences grid.
 *
 * ## One form per control, not one big save
 *
 * Each toggle is its own form posting one (category, channel, enabled)
 * triple. A patient who switches one thing off gets one confirmation and one
 * possible failure, rather than a screen of controls whose save button might
 * have failed for a reason nobody can attribute.
 *
 * It works before hydration: each is a `<form>` with a server action and a
 * submit button, and the browser will post it. `useActionState` adds the
 * pending state and keeps the message beside the control.
 *
 * ## A mandatory channel is disabled, and says why
 *
 * `phase_15.md` section 22. An appointment being cancelled has to reach the
 * patient somewhere, and the in-app record is that somewhere. The control is
 * rendered disabled with the reason in the open, because a disabled control
 * with no explanation reads as a bug — and the database refuses it anyway, so
 * a posted form that tries is answered with a sentence rather than silently
 * ignored.
 *
 * ## An unconfigured channel is disabled, and says why
 *
 * Sections 12 and 14. Email is not switched on for this clinic, so the email
 * controls are disabled and the reason is stated. Offering a preference for a
 * channel that delivers nothing is the pretence those sections forbid, and a
 * patient who switched email "on" and then received none would be entitled to
 * conclude the clinic had lost their messages.
 */
export function NotificationPreferencesForm({
  preferences,
  emailConfigured,
}: {
  readonly preferences: readonly NotificationPreference[];
  readonly emailConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    setNotificationPreferenceAction,
    IDLE_NOTIFICATION_FORM_STATE,
  );

  const byCategory = new Map<NotificationCategory, NotificationPreference[]>();
  for (const preference of preferences) {
    const bucket = byCategory.get(preference.category) ?? [];
    bucket.push(preference);
    byCategory.set(preference.category, bucket);
  }

  return (
    <div className="flex flex-col gap-8">
      {state.message ? (
        <Alert tone={state.status === "error" ? "danger" : "success"}>
          {state.message}
        </Alert>
      ) : null}

      {(Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]).map(
        (category) => {
          const rule = NOTIFICATION_CATEGORIES[category];
          const rows = byCategory.get(category) ?? [];
          const headingId = `notification-category-${category}`;

          return (
            <section
              key={category}
              aria-labelledby={headingId}
              className="border-border bg-card rounded-lg border p-5"
            >
              <h2
                id={headingId}
                className="text-h5 text-heading font-sans font-medium"
              >
                {rule.label}
              </h2>
              <p className="text-body-sm text-muted-foreground measure mt-1">
                {rule.description}
              </p>

              <ul className="mt-4 flex flex-col gap-3">
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const row = rows.find(
                    (candidate) => candidate.channel === channel,
                  );
                  if (!row) return null;

                  const unavailable = channel === "email" && !emailConfigured;
                  const locked = row.mandatory || unavailable;

                  return (
                    <li
                      key={channel}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
                    >
                      <div className="min-w-0">
                        <span className="text-body-sm text-foreground">
                          {channelLabel(channel)}
                        </span>
                        {locked ? (
                          <p className="text-caption text-muted-foreground measure mt-0.5">
                            {row.mandatory
                              ? NOTIFICATION_PREFERENCES_COPY.mandatoryNote
                              : NOTIFICATION_PREFERENCES_COPY.emailUnavailableNote}
                          </p>
                        ) : null}
                      </div>

                      <form action={formAction}>
                        <input type="hidden" name="category" value={category} />
                        <input type="hidden" name="channel" value={channel} />
                        {/*
                          An explicit value rather than a checkbox: an
                          unchecked box posts nothing, and "absent" and "off"
                          would then be the same request. The schema requires
                          a literal "true" or "false".
                        */}
                        <input
                          type="hidden"
                          name="enabled"
                          value={row.enabled ? "false" : "true"}
                        />

                        <Button
                          type="submit"
                          variant={row.enabled ? "secondary" : "outline"}
                          size="sm"
                          disabled={locked}
                          loading={pending}
                        >
                          {row.enabled ? "On" : "Off"}
                          <span className="sr-only">
                            {` — ${rule.label}, ${channelLabel(channel)}. ${
                              locked
                                ? "Cannot be changed."
                                : row.enabled
                                  ? "Select to turn off."
                                  : "Select to turn on."
                            }`}
                          </span>
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        },
      )}
    </div>
  );
}

function channelLabel(channel: NotificationChannel): string {
  return channel === "in_app"
    ? NOTIFICATION_PREFERENCES_COPY.inAppLabel
    : NOTIFICATION_PREFERENCES_COPY.emailLabel;
}
