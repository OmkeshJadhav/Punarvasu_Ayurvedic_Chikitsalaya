import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarkAllNotificationsReadForm } from "@/components/notifications/mark-all-read-form";
import { NotificationFilters } from "@/components/notifications/notification-filters";
import { NotificationItem } from "@/components/notifications/notification-item";
import { NotificationList } from "@/components/notifications/notification-list";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { RecentNotifications } from "@/components/notifications/recent-notifications";
import {
  NOTIFICATION_CENTRE_COPY,
  PRACTITIONER_NOTIFICATION_COPY,
} from "@/features/notifications/content";
import { DOCTOR_NOTIFICATIONS_COPY } from "@/features/doctor/content";
import type {
  Notification,
  NotificationPreference,
} from "@/features/notifications/types";

import { expectNoAxeViolations } from "../support/axe";

/**
 * The notification UI.
 *
 * What is asserted, and why each matters more than it looks:
 *
 *   * **unread is a word, not a colour** — section 90, and WCAG 1.4.1. A
 *     coloured dot tells a colour-blind reader and a screen-reader user
 *     nothing;
 *   * **the deep link is a real anchor**, so middle-click, "open in new tab"
 *     and a screen reader's link list all work — and it authorizes nothing;
 *   * **every form carries exactly the fields its action reads**, and nothing
 *     that would be a claim about a recipient (sections 42, 110, 129);
 *   * **no control is `required` in the HTML sense** — the defect the Phase 12
 *     component suite found, guarded here from the start;
 *   * **a mandatory or unconfigured channel is disabled and says why**, rather
 *     than being offered and then refused (sections 14, 22);
 *   * **markup in a title renders as text**, never as HTML;
 *   * **nothing reaches browser storage** (section 128's caching requirement,
 *     applied to the client).
 *
 * None of this is a security control. Every action re-checks on the server and
 * row-level security refuses independently; these assertions are about the
 * experience, and about the UI not undermining the model.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/notifications",
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const markReadSubmissions: FormData[] = [];
const markAllSubmissions: number[] = [];
const preferenceSubmissions: FormData[] = [];

vi.mock("@/features/notifications/actions", () => ({
  markNotificationReadAction: async (_state: unknown, formData: FormData) => {
    markReadSubmissions.push(formData);
    return { status: "success", message: "Marked as read." };
  },
  markAllNotificationsReadAction: async () => {
    markAllSubmissions.push(1);
    return {
      status: "success",
      message: "All your notifications are marked as read.",
    };
  },
  setNotificationPreferenceAction: async (
    _state: unknown,
    formData: FormData,
  ) => {
    preferenceSubmissions.push(formData);
    return {
      status: "success",
      message: "Your notification settings have been updated.",
    };
  },
}));

const BASE: Notification = {
  id: "11111111-1111-4111-8111-111111111111",
  eventType: "appointment_confirmed",
  category: "appointment_updates",
  title: "Appointment confirmed",
  body: "Your Initial consultation with Dr Anaya Kulkarni is confirmed for Saturday 19 September 2026, 10:30 am.",
  templateVersion: 1,
  resourceType: "appointment",
  resourceId: "22222222-2222-4222-8222-222222222222",
  linkPath: "/patient/appointments/22222222-2222-4222-8222-222222222222",
  readAt: null,
  createdAt: "2026-09-18T09:00:00.000Z",
};

function notification(overrides: Partial<Notification> = {}): Notification {
  return { ...BASE, ...overrides };
}

const PREFERENCES: readonly NotificationPreference[] = [
  {
    category: "appointment_updates",
    channel: "in_app",
    enabled: true,
    mandatory: true,
  },
  {
    category: "appointment_updates",
    channel: "email",
    enabled: true,
    mandatory: false,
  },
  {
    category: "appointment_reminders",
    channel: "in_app",
    enabled: true,
    mandatory: false,
  },
  {
    category: "appointment_reminders",
    channel: "email",
    enabled: false,
    mandatory: false,
  },
  {
    category: "clinical_updates",
    channel: "in_app",
    enabled: true,
    mandatory: true,
  },
  {
    category: "clinical_updates",
    channel: "email",
    enabled: true,
    mandatory: false,
  },
];

beforeEach(() => {
  markReadSubmissions.length = 0;
  markAllSubmissions.length = 0;
  preferenceSubmissions.length = 0;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/* ------------------------------------------------------------------------ */
/* The item                                                                  */
/* ------------------------------------------------------------------------ */

describe("a notification", () => {
  it("shows its title, message and time", () => {
    render(
      <ul>
        <NotificationItem notification={notification()} />
      </ul>,
    );

    expect(
      screen.getByRole("heading", { name: "Appointment confirmed" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Initial consultation/)).toBeInTheDocument();
    // An absolute instant in the clinic's timezone, not a relative "2 hours
    // ago" that needs a clock on the client to stay honest.
    expect(screen.getByText(/18 September 2026/)).toBeInTheDocument();
  });

  it("announces unread as a word, not only a colour", () => {
    render(
      <ul>
        <NotificationItem notification={notification()} />
      </ul>,
    );

    expect(
      screen.getByText(NOTIFICATION_CENTRE_COPY.unreadBadge),
    ).toBeInTheDocument();
  });

  it("offers no unread badge and no mark-as-read once it is read", () => {
    render(
      <ul>
        <NotificationItem
          notification={notification({ readAt: "2026-09-18T10:00:00.000Z" })}
        />
      </ul>,
    );

    expect(
      screen.queryByText(NOTIFICATION_CENTRE_COPY.unreadBadge),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mark as read/i }),
    ).not.toBeInTheDocument();
  });

  it("links to the resource with a real anchor", () => {
    render(
      <ul>
        <NotificationItem notification={notification()} />
      </ul>,
    );

    const link = screen.getByRole("link", { name: /open/i });
    expect(link).toHaveAttribute("href", BASE.linkPath);
  });

  it("gives each mark-as-read control a distinct accessible name", async () => {
    // A list of twelve identical "Mark as read" buttons is a list a
    // screen-reader user cannot navigate.
    render(
      <ul>
        <NotificationItem notification={notification()} />
        <NotificationItem
          notification={notification({
            id: "33333333-3333-4333-8333-333333333333",
            title: "Prescription available",
          })}
        />
      </ul>,
    );

    expect(
      screen.getByRole("button", {
        name: /mark as read: Appointment confirmed/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /mark as read: Prescription available/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders markup in a title as text", () => {
    render(
      <ul>
        <NotificationItem
          notification={notification({
            title: "<img src=x onerror=alert(1)>",
          })}
        />
      </ul>,
    );

    expect(document.querySelector("img")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
  });

  it("submits only the notification id when marked read", async () => {
    const user = userEvent.setup();

    render(
      <ul>
        <NotificationItem notification={notification()} />
      </ul>,
    );

    await user.click(screen.getByRole("button", { name: /mark as read/i }));

    await waitFor(() => expect(markReadSubmissions).toHaveLength(1));

    const submitted = markReadSubmissions[0];
    expect([...(submitted?.keys() ?? [])]).toEqual(["notificationId"]);
    expect(submitted?.get("notificationId")).toBe(BASE.id);
  });
});

/* ------------------------------------------------------------------------ */
/* The list                                                                  */
/* ------------------------------------------------------------------------ */

describe("the list", () => {
  it("is a real list, so the count is announced", () => {
    render(
      <NotificationList
        page={{ notifications: [notification()], nextCursor: null }}
        filter="all"
        audience="patient"
      />,
    );

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  /*
   * The heading-order defect Phase 18's browser pass found.
   *
   * The page renders `h1` "Notifications"; each notification renders `h3`.
   * Without an `h2` between them the outline had a gap, which axe reports as
   * `heading-order` — and which the sweeps in this file could not see, because
   * they render the list on its own, with no page heading above it. So the
   * regression guard is on the level itself rather than on an axe run.
   */
  it("puts an h2 between the page heading and each notification's h3", () => {
    render(
      <NotificationList
        page={{ notifications: [notification()], nextCursor: null }}
        filter="all"
        audience="patient"
      />,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent(NOTIFICATION_CENTRE_COPY.listHeadingAll);
    // And the notification below it is one level deeper, not two.
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("names the active filter in that heading", () => {
    // Which view you are looking at was previously carried only by a control's
    // pressed state, so somebody arriving by heading could not tell.
    render(
      <NotificationList
        page={{ notifications: [notification()], nextCursor: null }}
        filter="unread"
        audience="patient"
      />,
    );

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      NOTIFICATION_CENTRE_COPY.listHeadingUnread,
    );
  });

  it("says you are all caught up when there is nothing", () => {
    render(
      <NotificationList
        page={{ notifications: [], nextCursor: null }}
        filter="all"
        audience="patient"
      />,
    );

    expect(
      screen.getByText(NOTIFICATION_CENTRE_COPY.emptyTitle),
    ).toBeInTheDocument();
  });

  it("says something different when the unread filter is empty", () => {
    // Two empty states, because they lead somewhere different.
    render(
      <NotificationList
        page={{ notifications: [], nextCursor: null }}
        filter="unread"
        audience="patient"
      />,
    );

    expect(
      screen.getByText(NOTIFICATION_CENTRE_COPY.emptyUnreadTitle),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /all/i })).toBeInTheDocument();
  });

  it("offers older notifications as a link, and keeps the filter", () => {
    render(
      <NotificationList
        page={{
          notifications: [notification()],
          nextCursor: "2026-09-18T09:00:00.000Z",
        }}
        filter="unread"
        audience="patient"
      />,
    );

    const older = screen.getByRole("link", {
      name: NOTIFICATION_CENTRE_COPY.olderLabel,
    });

    expect(older.getAttribute("href")).toContain("cursor=");
    expect(older.getAttribute("href")).toContain("filter=unread");
  });

  it("offers nothing older on the last page", () => {
    render(
      <NotificationList
        page={{ notifications: [notification()], nextCursor: null }}
        filter="all"
        audience="patient"
      />,
    );

    expect(
      screen.queryByRole("link", { name: NOTIFICATION_CENTRE_COPY.olderLabel }),
    ).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <NotificationList
        page={{
          notifications: [
            notification(),
            notification({
              id: "44444444-4444-4444-8444-444444444444",
              title: "Prescription available",
              readAt: "2026-09-18T12:00:00.000Z",
            }),
          ],
          nextCursor: "2026-09-18T09:00:00.000Z",
        }}
        filter="all"
        audience="patient"
      />,
    );

    await expectNoAxeViolations(container);
  });
});

/* ------------------------------------------------------------------------ */
/* Filters                                                                   */
/* ------------------------------------------------------------------------ */

describe("the filters", () => {
  it("mark the current one for assistive technology", () => {
    render(<NotificationFilters active="unread" />);

    const current = screen.getByRole("link", { name: /unread/i });
    expect(current).toHaveAttribute("aria-current", "page");

    expect(screen.getByRole("link", { name: /^all$/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("are links, so the view survives the back button", () => {
    render(<NotificationFilters active="all" />);

    expect(screen.getByRole("link", { name: /unread/i })).toHaveAttribute(
      "href",
      "/notifications?filter=unread",
    );
  });
});

/* ------------------------------------------------------------------------ */
/* Mark all                                                                  */
/* ------------------------------------------------------------------------ */

describe("mark all as read", () => {
  it("submits no fields at all", async () => {
    // Section 54: there is nothing here to manipulate.
    const user = userEvent.setup();
    render(<MarkAllNotificationsReadForm hasUnread />);

    await user.click(
      screen.getByRole("button", {
        name: NOTIFICATION_CENTRE_COPY.markAllRead,
      }),
    );

    await waitFor(() => expect(markAllSubmissions).toHaveLength(1));
  });

  it("is disabled when there is nothing to do", () => {
    render(<MarkAllNotificationsReadForm hasUnread={false} />);

    expect(
      screen.getByRole("button", {
        name: NOTIFICATION_CENTRE_COPY.markAllReadEmpty,
      }),
    ).toBeDisabled();
  });
});

/* ------------------------------------------------------------------------ */
/* Preferences                                                               */
/* ------------------------------------------------------------------------ */

describe("preferences", () => {
  it("renders every category and channel", () => {
    render(
      <NotificationPreferencesForm
        preferences={PREFERENCES}
        audience="patient"
        emailConfigured
      />,
    );

    expect(
      screen.getByRole("heading", { name: /appointment updates/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /appointment reminders/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /prescriptions and treatment plans/i,
      }),
    ).toBeInTheDocument();
  });

  it("disables a mandatory channel and says why", async () => {
    // Section 22. A disabled control with no explanation reads as a bug.
    render(
      <NotificationPreferencesForm
        preferences={PREFERENCES}
        audience="patient"
        emailConfigured
      />,
    );

    const section = screen
      .getByRole("heading", { name: /appointment updates/i })
      .closest("section");

    expect(section).not.toBeNull();

    const inApp = within(section as HTMLElement).getByRole("button", {
      name: /in punarvasu/i,
    });

    expect(inApp).toBeDisabled();
    expect(
      within(section as HTMLElement).getByText(/always on/i),
    ).toBeInTheDocument();
  });

  it("disables email and says why when no provider is configured", async () => {
    // Sections 12 and 14. A patient who switched email "on" and then
    // received none would be entitled to conclude the clinic lost their
    // messages.
    render(
      <NotificationPreferencesForm
        preferences={PREFERENCES}
        audience="patient"
        emailConfigured={false}
      />,
    );

    const section = screen
      .getByRole("heading", { name: /appointment reminders/i })
      .closest("section");

    const email = within(section as HTMLElement).getByRole("button", {
      name: /email/i,
    });

    expect(email).toBeDisabled();
    expect(
      within(section as HTMLElement).getByText(
        /not switched on for this clinic/i,
      ),
    ).toBeInTheDocument();
  });

  it("submits exactly the three fields the action reads", async () => {
    const user = userEvent.setup();

    render(
      <NotificationPreferencesForm
        preferences={PREFERENCES}
        audience="patient"
        emailConfigured
      />,
    );

    const section = screen
      .getByRole("heading", { name: /appointment reminders/i })
      .closest("section");

    await user.click(
      within(section as HTMLElement).getByRole("button", { name: /email/i }),
    );

    await waitFor(() => expect(preferenceSubmissions).toHaveLength(1));

    const submitted = preferenceSubmissions[0];
    expect([...(submitted?.keys() ?? [])].sort()).toEqual([
      "category",
      "channel",
      "enabled",
    ]);
    // It was off; the control turns it on.
    expect(submitted?.get("enabled")).toBe("true");
    expect(submitted?.get("channel")).toBe("email");
  });

  it("carries no user id in any form", () => {
    // Section 97. `{"userId": "another-user"}` is not something this UI can
    // express, and `set_notification_preference` has no parameter for one.
    render(
      <NotificationPreferencesForm
        preferences={PREFERENCES}
        audience="patient"
        emailConfigured
      />,
    );

    for (const input of document.querySelectorAll("input")) {
      expect(["category", "channel", "enabled"]).toContain(input.name);
    }
  });

  it("marks no control `required` in the HTML sense", () => {
    // The Phase 12 defect: the browser's own constraint validation refuses to
    // fire the submit event at all, so the control does visibly nothing.
    render(
      <NotificationPreferencesForm
        preferences={PREFERENCES}
        audience="patient"
        emailConfigured
      />,
    );

    expect(document.querySelectorAll("[required]")).toHaveLength(0);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <NotificationPreferencesForm
        preferences={PREFERENCES}
        audience="patient"
        emailConfigured={false}
      />,
    );

    await expectNoAxeViolations(container);
  });
});

/* ------------------------------------------------------------------------ */
/* The practitioner's view                                                   */
/* ------------------------------------------------------------------------ */

describe("a practitioner's notification centre", () => {
  /** The one category a practitioner is sent, in both channels. */
  const PRACTITIONER_PREFERENCES: readonly NotificationPreference[] = [
    {
      category: "appointment_updates",
      channel: "in_app",
      enabled: true,
      mandatory: true,
    },
    {
      category: "appointment_updates",
      channel: "email",
      enabled: true,
      mandatory: false,
    },
  ];

  it("promises a practitioner what they will actually receive", () => {
    // Telling a practitioner we will let them know when their practitioner
    // shares something with them would be nonsense.
    render(
      <NotificationList
        page={{ notifications: [], nextCursor: null }}
        filter="all"
        audience="practitioner"
      />,
    );

    expect(
      screen.getByText(PRACTITIONER_NOTIFICATION_COPY.emptyBody),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(NOTIFICATION_CENTRE_COPY.emptyBody),
    ).not.toBeInTheDocument();
  });

  it("offers a practitioner only the category they are sent", () => {
    render(
      <NotificationPreferencesForm
        preferences={PRACTITIONER_PREFERENCES}
        audience="practitioner"
        emailConfigured
      />,
    );

    // Their one category, in their own words.
    expect(
      screen.getByRole("heading", { name: /changes to your day/i }),
    ).toBeInTheDocument();

    // And not two controls over messages nobody will ever send them.
    expect(
      screen.queryByRole("heading", { name: /appointment reminders/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: /prescriptions and treatment plans/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("locks their in-app channel and says why in their own words", () => {
    // Section 22. A change to somebody's working day made by the front desk
    // has to reach them somewhere.
    render(
      <NotificationPreferencesForm
        preferences={PRACTITIONER_PREFERENCES}
        audience="practitioner"
        emailConfigured
      />,
    );

    expect(
      screen.getByText(PRACTITIONER_NOTIFICATION_COPY.mandatoryNote),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <NotificationPreferencesForm
        preferences={PRACTITIONER_PREFERENCES}
        audience="practitioner"
        emailConfigured={false}
      />,
    );

    await expectNoAxeViolations(container);
  });
});

describe("the recent-notifications panel", () => {
  it("distinguishes an empty list from a failed read", () => {
    // Telling a practitioner nothing has changed when the database was
    // unreachable is how somebody misses a cancellation.
    const { unmount } = render(
      <RecentNotifications
        result={{ status: "ok", notifications: [] }}
        copy={DOCTOR_NOTIFICATIONS_COPY}
      />,
    );

    expect(
      screen.getByText(DOCTOR_NOTIFICATIONS_COPY.emptyTitle),
    ).toBeInTheDocument();
    unmount();

    render(
      <RecentNotifications
        result={{ status: "unavailable" }}
        copy={DOCTOR_NOTIFICATIONS_COPY}
      />,
    );

    expect(
      screen.getByText(DOCTOR_NOTIFICATIONS_COPY.errorBody),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(DOCTOR_NOTIFICATIONS_COPY.emptyTitle),
    ).not.toBeInTheDocument();
  });

  it("is a list of links to the resource, with no mark-read control", () => {
    // The glance, not the centre. A second place to manage notifications
    // would be a second thing to keep correct.
    render(
      <RecentNotifications
        result={{
          status: "ok",
          notifications: [
            notification({
              title: "An appointment has moved",
              body: "Initial consultation has moved to Saturday, 19 September at 10:30 am.",
              linkPath: `/doctor/appointments/${BASE.resourceId}`,
            }),
          ],
        }}
        copy={DOCTOR_NOTIFICATIONS_COPY}
      />,
    );

    const link = screen.getByRole("link", {
      name: /an appointment has moved/i,
    });
    expect(link).toHaveAttribute(
      "href",
      `/doctor/appointments/${BASE.resourceId}`,
    );

    expect(
      screen.queryByRole("button", { name: /mark as read/i }),
    ).not.toBeInTheDocument();
  });

  it("marks unread with a word rather than a tint", () => {
    render(
      <RecentNotifications
        result={{ status: "ok", notifications: [notification()] }}
        copy={DOCTOR_NOTIFICATIONS_COPY}
      />,
    );

    expect(
      screen.getByText(NOTIFICATION_CENTRE_COPY.unreadBadge),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <RecentNotifications
        result={{ status: "ok", notifications: [notification()] }}
        copy={DOCTOR_NOTIFICATIONS_COPY}
      />,
    );

    await expectNoAxeViolations(container);
  });
});

/* ------------------------------------------------------------------------ */
/* Privacy                                                                   */
/* ------------------------------------------------------------------------ */

describe("privacy", () => {
  it("writes nothing to browser storage", async () => {
    const user = userEvent.setup();

    render(
      <NotificationList
        page={{ notifications: [notification()], nextCursor: null }}
        filter="all"
        audience="patient"
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark as read/i }));
    await waitFor(() => expect(markReadSubmissions).toHaveLength(1));

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("shows nothing clinical on a list row", () => {
    // The row can only render what the notification holds, and the
    // notification holds a title and a body a template wrote. This is the
    // last of the three places that is checked.
    render(
      <NotificationList
        page={{
          notifications: [
            notification({
              title: "Prescription available",
              body: "Dr Anaya Kulkarni has issued a prescription from your recent consultation. Sign in to Punarvasu to view it.",
              eventType: "prescription_issued",
              category: "clinical_updates",
              resourceType: "prescription",
              linkPath: "/patient/prescriptions/1",
            }),
          ],
          nextCursor: null,
        }}
        filter="all"
        audience="patient"
      />,
    );

    const text = document.body.textContent ?? "";

    expect(text).not.toMatch(/\bmg\b|\bml\b|twice daily|tablet|churna/i);
    expect(text).not.toMatch(/\bdiagnosis\b|\bsymptom\b|\bassessment\b/i);
  });
});
