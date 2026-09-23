import type { Metadata } from "next";
import Link from "next/link";

import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATIONS_PATH,
  NOTIFICATION_CENTRE_COPY,
  NOTIFICATION_PREFERENCES_COPY,
  notificationPreferencesCopy,
} from "@/features/notifications/content";
import { getNotificationPreferences } from "@/features/notifications/queries";
import { hasConfiguredExternalChannel } from "@/lib/notifications/channel";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * Notification settings.
 *
 * ## Only this person's settings, and no id to say whose
 *
 * `getNotificationPreferences()` takes no user id and
 * `set_notification_preference` has no parameter for one — section 97's
 * `{"userId": "another-user"}` has nowhere to arrive, and section 98's staff
 * accounts are scoped by exactly the same mechanism as a patient's.
 *
 * ## It says what this system is not
 *
 * Sections 23 and 24. There is no marketing category, no campaign and no
 * opt-in, and the page says so rather than leaving a patient to infer it from
 * the absence of a checkbox. Signing in has never been treated as consent for
 * anything, because there is nothing here to consent to.
 *
 * ## It says why the messages are so short
 *
 * Sections 36 and 38. A patient who receives "something is waiting for you"
 * and nothing else should know that is deliberate, not a system that failed to
 * include the details. A practitioner is told the matching thing: that a
 * message never names the patient it is about, and why.
 *
 * ## The grid is the reader's, not the enum's
 *
 * A practitioner is shown the one category they are sent rather than three,
 * two of which would be controls over messages nobody will ever send them. The
 * audience comes back with the rows from `getNotificationPreferences()`, so
 * the categories rendered and the words describing them cannot come from two
 * different answers to the same question.
 */
export const metadata: Metadata = {
  title: NOTIFICATION_PREFERENCES_COPY.title,
  robots: { index: false, follow: false },
};

export default async function NotificationPreferencesPage() {
  await requirePermission("notifications.write.self", NOTIFICATIONS_PATH);

  const result = await getNotificationPreferences();

  // Falls back to the patient wording on a failed read, which is the one the
  // error state beneath does not use anyway.
  const copy = notificationPreferencesCopy(
    result.status === "ok" ? result.audience : "patient",
  );

  // Resolved on the server: whether an external provider is configured is a
  // deployment fact, and the page renders the controls accordingly rather than
  // offering a preference for a channel that delivers nothing.
  const emailConfigured = hasConfiguredExternalChannel();

  return (
    <Section aria-labelledby="notification-preferences-heading">
      <Container width="content">
        <h1
          id="notification-preferences-heading"
          className="text-h2 text-heading font-normal"
        >
          {NOTIFICATION_PREFERENCES_COPY.title}
        </h1>
        <p className="text-body text-muted-foreground measure mt-2">
          {copy.description}
        </p>

        <div className="mt-8 flex flex-col gap-8">
          {result.status === "unavailable" ? (
            <ErrorState
              title={NOTIFICATION_CENTRE_COPY.errorTitle}
              description={NOTIFICATION_CENTRE_COPY.errorBody}
              action={
                <Button asChild variant="secondary">
                  <Link href={`${NOTIFICATIONS_PATH}/preferences`}>
                    {NOTIFICATION_CENTRE_COPY.retry}
                  </Link>
                </Button>
              }
            />
          ) : (
            <NotificationPreferencesForm
              preferences={result.preferences}
              audience={result.audience}
              emailConfigured={emailConfigured}
            />
          )}

          <div className="flex flex-col gap-4">
            <Alert tone="info" title="What Punarvasu sends you">
              {copy.scopeNote}
            </Alert>
            <Alert tone="info" title="Why our messages are brief">
              {copy.privacyNote}
            </Alert>
          </div>

          <div>
            <Button asChild variant="ghost" size="sm">
              <Link href={NOTIFICATIONS_PATH}>
                {NOTIFICATION_PREFERENCES_COPY.backLink}
              </Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
