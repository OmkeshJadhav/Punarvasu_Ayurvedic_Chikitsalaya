import Link from "next/link";

import {
  NOTIFICATIONS_PATH,
  NOTIFICATION_CENTRE_COPY,
} from "@/features/notifications/content";
import type { NotificationFilter } from "@/features/notifications/types";

/**
 * All / Unread.
 *
 * ## Two links, no JavaScript
 *
 * The filter lives in the URL, so the view is shareable, survives the back
 * button and works before hydration. A patient reading "unread" and then
 * pressing back gets the list they came from rather than a component that
 * quietly kept its own state.
 *
 * A filter is not sensitive — unlike the patient search Phases 10 and 11 kept
 * out of the URL, "unread" says nothing about anybody. That is the whole
 * distinction, and it is why this one is a query parameter and that one was a
 * POST.
 *
 * ## The current filter is announced
 *
 * `aria-current="page"` plus weight and an underline. Not colour alone
 * (section 90).
 */
export function NotificationFilters({
  active,
}: {
  readonly active: NotificationFilter;
}) {
  const options: readonly {
    readonly value: NotificationFilter;
    readonly label: string;
    readonly href: string;
  }[] = [
    {
      value: "all",
      label: NOTIFICATION_CENTRE_COPY.filterAll,
      href: NOTIFICATIONS_PATH,
    },
    {
      value: "unread",
      label: NOTIFICATION_CENTRE_COPY.filterUnread,
      href: `${NOTIFICATIONS_PATH}?filter=unread`,
    },
  ];

  return (
    <nav aria-label={NOTIFICATION_CENTRE_COPY.filterLabel}>
      <ul className="flex items-center gap-1">
        {options.map((option) => {
          const current = option.value === active;

          return (
            <li key={option.value}>
              <Link
                href={option.href}
                aria-current={current ? "page" : undefined}
                className={[
                  "focus-visible:outline-ring text-body-sm inline-flex min-h-11 items-center rounded-md px-3 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2",
                  current
                    ? "text-foreground font-medium underline"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
