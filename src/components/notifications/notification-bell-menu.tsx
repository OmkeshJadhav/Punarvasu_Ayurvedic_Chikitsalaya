"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { formatClinicDateTime } from "@/features/appointments/time";
import { openNotificationAction } from "@/features/notifications/actions";
import {
  NOTIFICATIONS_PATH,
  NOTIFICATION_BELL_COPY,
  NOTIFICATION_CENTRE_COPY,
  notificationBellLabel,
  notificationBellUnreadSummary,
} from "@/features/notifications/content";
import type {
  Notification,
  NotificationListResult,
} from "@/features/notifications/types";
import { cn } from "@/lib/utils/cn";

/** Long enough that sweeping the pointer across the header opens nothing. */
const HOVER_OPEN_DELAY_MS = 150;
/** Long enough to cross the gap between the bell and the panel. */
const HOVER_CLOSE_DELAY_MS = 200;

/**
 * How the panel was opened, which decides how it closes.
 *
 * `hover` follows the pointer and never takes focus; `click` (a click, a tap,
 * Enter or Space) stays until dismissed and moves focus into the panel.
 */
type OpenMode = "hover" | "click";

/**
 * The header bell and its preview of the newest notifications.
 *
 * ## A popover, not a tooltip
 *
 * The panel holds links and buttons, and a tooltip may not: it is skipped by
 * assistive technology and unreachable by touch. A Radix popover is a real
 * non-modal dialog — `aria-expanded` on the trigger, Escape and outside-click
 * dismissal, focus returned to the bell afterwards.
 *
 * ## Hover is an enhancement, never the only way in
 *
 * A mouse pointer resting on the bell opens it; `AGENTS.md` section 34 rules
 * out hover-only behaviour, so a click, a tap or Enter opens it too and keeps
 * it open. A touch pointer never triggers hover — a touch "hover" is the
 * first half of a tap, and opening on it would make the tap close it again.
 * Mouse and pen both do.
 *
 * ## The data is server state
 *
 * The count and the list arrive as props from `NotificationBell`, a server
 * component, read under row-level security on this request. Nothing is
 * fetched from here and nothing is kept in browser storage.
 */
export function NotificationBellMenu({
  unread,
  unreadCap,
  recent,
}: {
  readonly unread: number;
  readonly unreadCap: number;
  readonly recent: NotificationListResult;
}) {
  const [mode, setMode] = useState<OpenMode | null>(null);
  const open = mode !== null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingId = useId();

  // Opening a notification navigates; the panel belongs to the layout and
  // would otherwise stay open over the page it just opened. Adjusted during
  // render rather than in an effect, as React recommends for derived state.
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMode(null);
  }

  function clearTimer() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  useEffect(() => clearTimer, []);

  function handlePointerEnter(event: ReactPointerEvent) {
    if (event.pointerType === "touch") return;
    clearTimer();
    if (open) return;
    timer.current = setTimeout(() => setMode("hover"), HOVER_OPEN_DELAY_MS);
  }

  function handlePointerLeave(event: ReactPointerEvent) {
    if (event.pointerType === "touch") return;
    clearTimer();
    if (mode === "click") return;
    timer.current = setTimeout(
      () => setMode((current) => (current === "hover" ? null : current)),
      HOVER_CLOSE_DELAY_MS,
    );
  }

  const overCap = unread > unreadCap;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        clearTimer();
        setMode(next ? "click" : null);
      }}
    >
      <PopoverTrigger
        aria-label={notificationBellLabel(unread, unreadCap)}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={(event) => {
          // A click on a panel the pointer already opened pins it rather than
          // closing it — the person reached for it, so keep it.
          if (mode === "hover") {
            event.preventDefault();
            clearTimer();
            setMode("click");
          }
        }}
        className={cn(
          "text-foreground hover:bg-muted focus-visible:outline-ring relative inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
          open && "bg-muted",
        )}
      >
        <Bell aria-hidden className="size-5" />

        {unread > 0 ? (
          <span
            // `aria-hidden`, because the trigger's accessible name already
            // says how many are unread. Without this a screen reader reads
            // the count twice, once as a number with no context.
            aria-hidden
            className="bg-primary text-primary-foreground ring-card absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[0.6875rem] leading-5 font-medium ring-2"
          >
            {overCap ? `${unreadCap}+` : unread}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        aria-labelledby={headingId}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onOpenAutoFocus={(event) => {
          // A panel that opened because a pointer passed over the bell must
          // not pull keyboard focus away from wherever it was.
          if (mode === "hover") event.preventDefault();
        }}
        className="flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden"
      >
        <div className="border-border flex items-baseline justify-between gap-4 border-b px-4 py-3">
          <h2
            id={headingId}
            className="text-body text-heading font-sans font-medium"
          >
            {NOTIFICATION_BELL_COPY.panelTitle}
          </h2>
          <p className="text-caption text-muted-foreground">
            {notificationBellUnreadSummary(unread, unreadCap)}
          </p>
        </div>

        <BellPreviewBody recent={recent} />

        <div className="border-border border-t p-1">
          <Link
            href={NOTIFICATIONS_PATH}
            onClick={() => setMode(null)}
            className="text-body-sm text-primary hover:bg-muted focus-visible:outline-ring flex min-h-11 items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            {NOTIFICATION_BELL_COPY.viewAll}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BellPreviewBody({
  recent,
}: {
  readonly recent: NotificationListResult;
}) {
  if (recent.status === "unavailable") {
    return (
      <p className="text-body-sm text-muted-foreground px-4 py-6">
        {NOTIFICATION_BELL_COPY.errorBody}
      </p>
    );
  }

  if (recent.notifications.length === 0) {
    return (
      <div className="flex flex-col gap-1 px-4 py-6 text-center">
        <p className="text-body-sm text-heading font-medium">
          {NOTIFICATION_BELL_COPY.emptyTitle}
        </p>
        <p className="text-caption text-muted-foreground">
          {NOTIFICATION_BELL_COPY.emptyBody}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-border max-h-[min(28rem,60dvh)] divide-y overflow-y-auto">
      {recent.notifications.map((notification) => (
        <li key={notification.id}>
          <BellPreviewItem notification={notification} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One notification in the preview.
 *
 * ## A form, not a link
 *
 * Opening a notification from here also marks it read, and that is a write —
 * so it is a POST to `openNotificationAction`, which marks it and redirects to
 * the resource. It carries the id only; the destination is read from the
 * database. It works before hydration, because the browser posts the form.
 *
 * ## Unread is a dot *and* a word, with a tint on top
 *
 * `phase_15.md` section 90 and WCAG 1.4.1: the tint alone would tell a
 * colour-blind reader nothing, so an unread row also carries a dot, a heavier
 * title and the word "Unread" in its accessible name.
 */
function BellPreviewItem({
  notification,
}: {
  readonly notification: Notification;
}) {
  const unread = notification.readAt === null;
  const detailsId = useId();

  // The button's name is the title alone (prefixed "Unread" when it is); the
  // message and the time are its description. Left to the content, a screen
  // reader would run title, body and date together as one long name.
  const label = unread
    ? `${NOTIFICATION_CENTRE_COPY.unreadBadge}: ${notification.title}`
    : notification.title;

  return (
    <form action={openNotificationAction}>
      <input type="hidden" name="notificationId" value={notification.id} />
      <OpenButton unread={unread} label={label} describedBy={detailsId}>
        <span className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "mt-2 size-2 shrink-0 rounded-full",
              unread ? "bg-primary" : "bg-transparent",
            )}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className={cn(
                "text-body-sm text-heading line-clamp-1",
                unread ? "font-semibold" : "font-medium",
              )}
            >
              {notification.title}
            </span>
            <span id={detailsId} className="flex flex-col gap-0.5">
              <span className="text-caption text-muted-foreground line-clamp-2">
                {notification.body}
              </span>
              <span className="text-caption text-muted-foreground">
                <time dateTime={notification.createdAt}>
                  {formatClinicDateTime(new Date(notification.createdAt))}
                </time>
              </span>
            </span>
          </span>
        </span>
      </OpenButton>
    </form>
  );
}

function OpenButton({
  unread,
  label,
  describedBy,
  children,
}: {
  readonly unread: boolean;
  readonly label: string;
  readonly describedBy: string;
  readonly children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={label}
      aria-describedby={describedBy}
      aria-busy={pending || undefined}
      disabled={pending}
      className={cn(
        "focus-visible:outline-ring relative block w-full px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
        unread
          ? "bg-secondary/60 hover:bg-secondary"
          : "bg-popover hover:bg-muted",
        pending && "cursor-progress opacity-70",
      )}
    >
      {children}
      {pending ? (
        <Spinner
          label={NOTIFICATION_BELL_COPY.opening}
          className="absolute top-3 right-4 size-4"
        />
      ) : null}
    </button>
  );
}
