/**
 * Everything the notification centre says.
 *
 * Copy lives here rather than inside components for the same reason it does in
 * every other feature in this project: somebody who is not reading React
 * should be able to review the words a patient sees, and localization later
 * should not mean a hunt through JSX (`phase_15.md` section 100).
 *
 * The *messages themselves* — what a confirmation or a reminder says — are not
 * here. They are in `templates.ts`, because they are rendered once and stored,
 * and mixing the two would make it easy to edit a stored message's wording by
 * accident.
 */

import type { NotificationAudience } from "./types";

export const NOTIFICATIONS_PATH = "/notifications";
export const NOTIFICATION_PREFERENCES_PATH = "/notifications/preferences";

export const NOTIFICATION_CENTRE_COPY = {
  title: "Notifications",
  description:
    "Updates about your appointments and your care. We keep these short on purpose — open one to see the full details in your account.",

  filterLabel: "Show",
  filterAll: "All",
  filterUnread: "Unread",

  /**
   * The heading above the list itself.
   *
   * Added in Phase 18, to fix a real defect its browser pass found: the page
   * went `h1` straight to the `h3` on each notification, so the outline a
   * screen-reader user navigates by had a gap. Phase 15 shipped without a
   * measured browser pass and recorded that omission as its first known issue;
   * this is one of the things it was warning about.
   *
   * It is not a spacer. Which filter is active was previously conveyed only by
   * the pressed state of a control, so somebody arriving at the list by heading
   * had no way to know they were looking at a filtered view. Naming it here
   * fixes the outline and answers that question in the same breath.
   */
  listHeadingAll: "All notifications",
  listHeadingUnread: "Unread notifications",

  markRead: "Mark as read",
  markAllRead: "Mark all as read",
  markAllReadEmpty: "Nothing to mark",
  markedAllRead: "All your notifications are marked as read.",
  markedRead: "Marked as read.",
  nothingToMark: "You had no unread notifications.",

  unreadBadge: "Unread",
  openLabel: "Open",

  /** Section 89. */
  emptyTitle: "You're all caught up",
  emptyBody:
    "There are no notifications here yet. We'll let you know when an appointment is confirmed or changed, and when your practitioner shares something with you.",

  emptyUnreadTitle: "Nothing unread",
  emptyUnreadBody: "You have read everything. Switch to All to see the rest.",

  errorTitle: "We couldn't load your notifications",
  errorBody:
    "Something went wrong at our end. Please try again in a moment — nothing has been lost.",
  retry: "Try again",

  olderLabel: "Show older notifications",

  preferencesLink: "Notification settings",
} as const;

/**
 * The same two screens, in the practitioner's register.
 *
 * Only the sentences that would be *wrong* for them are overridden. "Updates
 * about your appointments and your care" is written for the person being
 * cared for; a practitioner's notifications are about their working day, and
 * telling them otherwise would be the kind of copy that makes a product feel
 * as though it was built for somebody else.
 *
 * Everything not listed here — the filters, the mark-read controls, the error
 * copy — is the same words for everybody, because it means the same thing.
 */
export const PRACTITIONER_NOTIFICATION_COPY = {
  description:
    "Changes to your day. When an appointment with you is confirmed, moved or cancelled, it appears here — open one to see the appointment itself.",

  emptyBody:
    "There are no notifications here yet. We'll let you know when an appointment in your diary is confirmed, moved or cancelled.",

  preferencesDescription:
    "Choose how Punarvasu tells you about changes to your day.",

  scopeNote:
    "Punarvasu only tells you about appointments in your own diary. There is no marketing here and nothing to opt in to.",

  privacyNote:
    "Notifications are deliberately brief, and they never name a patient — a message can be read on a lock screen or over a shoulder. Open the appointment to see who you are seeing.",

  mandatoryNote:
    "Always on — a change to your day has to reach you somewhere, and this is the one place that always exists.",

  emailUnavailableNote:
    "Email notifications are not switched on for this clinic yet. Your notifications are waiting for you here in Punarvasu.",
} as const;

/** The notification centre's introduction, for this reader. */
export function notificationCentreDescription(
  audience: NotificationAudience,
): string {
  return audience === "practitioner"
    ? PRACTITIONER_NOTIFICATION_COPY.description
    : NOTIFICATION_CENTRE_COPY.description;
}

/** What an empty inbox says, for this reader. */
export function notificationEmptyBody(audience: NotificationAudience): string {
  return audience === "practitioner"
    ? PRACTITIONER_NOTIFICATION_COPY.emptyBody
    : NOTIFICATION_CENTRE_COPY.emptyBody;
}

export const NOTIFICATION_PREFERENCES_COPY = {
  title: "Notification settings",
  description: "Choose how Punarvasu keeps in touch with you about your care.",

  inAppLabel: "In Punarvasu",
  emailLabel: "Email",

  /**
   * Shown beside a control that cannot be switched off.
   *
   * Section 22. It says *why*, because a disabled control with no explanation
   * reads as a bug.
   */
  mandatoryNote:
    "Always on — these are part of your care and we need to be able to tell you.",

  /**
   * Shown when no external channel is configured.
   *
   * `phase_15.md` section 14 and section 12: an unconfigured channel must not
   * be presented as working. The control is disabled and the reason is in the
   * open, rather than the preference silently having no effect.
   */
  emailUnavailableNote:
    "Email notifications are not switched on for this clinic yet. Your notifications are waiting for you here in Punarvasu.",

  saved: "Your notification settings have been updated.",
  saveError:
    "We couldn't update that setting. Nothing has been changed — please try again.",

  /**
   * The honest statement of what this system is and is not.
   *
   * No marketing exists, no consent is being sought, and a patient should be
   * able to see that stated rather than infer it from the absence of a
   * checkbox (sections 23, 24).
   */
  scopeNote:
    "Punarvasu only sends you messages about your own appointments and your own care. We do not send marketing, offers or newsletters, and there is nothing here to opt in to.",

  /** Section 38 and 36: why the messages say so little. */
  privacyNote:
    "Notifications are deliberately brief. We never include your diagnosis, your notes or what you have been prescribed — only that something is waiting for you in your account.",

  backLink: "Back to notifications",
} as const;

/** The notification-settings sentences that differ by reader. */
export function notificationPreferencesCopy(audience: NotificationAudience): {
  readonly description: string;
  readonly scopeNote: string;
  readonly privacyNote: string;
  readonly mandatoryNote: string;
  readonly emailUnavailableNote: string;
} {
  if (audience === "practitioner") {
    return {
      description: PRACTITIONER_NOTIFICATION_COPY.preferencesDescription,
      scopeNote: PRACTITIONER_NOTIFICATION_COPY.scopeNote,
      privacyNote: PRACTITIONER_NOTIFICATION_COPY.privacyNote,
      mandatoryNote: PRACTITIONER_NOTIFICATION_COPY.mandatoryNote,
      emailUnavailableNote: PRACTITIONER_NOTIFICATION_COPY.emailUnavailableNote,
    };
  }

  return {
    description: NOTIFICATION_PREFERENCES_COPY.description,
    scopeNote: NOTIFICATION_PREFERENCES_COPY.scopeNote,
    privacyNote: NOTIFICATION_PREFERENCES_COPY.privacyNote,
    mandatoryNote: NOTIFICATION_PREFERENCES_COPY.mandatoryNote,
    emailUnavailableNote: NOTIFICATION_PREFERENCES_COPY.emailUnavailableNote,
  };
}

/**
 * The bell's preview panel.
 *
 * A glance at the newest few, read and unread alike. It deliberately has no
 * "mark all" and no filters — those belong to the notification centre, which
 * "View all" opens.
 */
export const NOTIFICATION_BELL_COPY = {
  panelTitle: "Notifications",
  viewAll: "View all notifications",
  emptyTitle: "You're all caught up",
  emptyBody: "New updates will appear here.",
  errorBody:
    "We couldn't load your latest notifications. View all to try again.",
  opening: "Opening…",
} as const;

/** "3 unread" / "99+ unread" / "No unread" — the panel's header line. */
export function notificationBellUnreadSummary(
  unread: number,
  cap: number,
): string {
  if (unread <= 0) return "No unread";
  return unread > cap ? `${cap}+ unread` : `${unread} unread`;
}

/**
 * What the bell says to a screen reader.
 *
 * Section 90: the unread state must not be colour alone, and the count must be
 * announced rather than left as a coloured dot.
 */
export function notificationBellLabel(unread: number, cap: number): string {
  if (unread <= 0) return "Notifications";
  if (unread > cap) return `Notifications, more than ${cap} unread`;
  return `Notifications, ${unread} unread`;
}
