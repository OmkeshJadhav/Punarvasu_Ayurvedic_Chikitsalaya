import type { Metadata } from "next";

import { requirePermission } from "@/lib/authorization/guards";

/**
 * The notification centre's guard.
 *
 * ## Why a layout and not a per-page check
 *
 * The same reason every area since Phase 08 puts its guard in a layout: a page
 * added beneath it inherits protection instead of having to remember it.
 *
 * ## Why it is not in `PROTECTED_AREAS`
 *
 * That table maps a route prefix to the permission an area needs *and* drives
 * the navigation that offers a link to it. Every role holds
 * `notifications.read.self`, so an entry there would put "Notifications" in
 * the area navigation for everybody alongside their workspace — a second link
 * to the thing the bell already points at, in the same header.
 *
 * `/account` and `/forbidden` are absent from that table for the same reason:
 * they need a session and no particular area. The permission is still checked,
 * here, on the server, on every request.
 *
 * ## Caching
 *
 * Inherited. The `(app)` layout is `force-dynamic` and the proxy serves
 * `private, no-store`; `robots.txt` disallows `/notifications` and the
 * metadata below says `noindex` on top of it. A notification list is one
 * person's messages and a cached copy of it is a disclosure with a long shelf
 * life (`phase_15.md` section 128's "private notification pages are not
 * publicly cached").
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function NotificationsLayout({
  children,
}: LayoutProps<"/notifications">) {
  await requirePermission("notifications.read.self", "/notifications");

  return children;
}
