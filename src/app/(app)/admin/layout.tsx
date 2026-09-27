import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ChartColumn, UsersRound } from "lucide-react";

import { Container } from "@/components/layout/container";
import { NavLink } from "@/components/layout/nav-link";
import type { NavItem } from "@/config/navigation";
import { ADMIN_AREA, ADMIN_USERS_PAGE } from "@/features/admin/content";
import { ANALYTICS_NAV } from "@/features/analytics/content";
import { requireAreaAccess } from "@/lib/authorization/guards";
import { PROTECTED_AREAS } from "@/lib/authorization/routes";

/**
 * The administration shell — and the authorization boundary for everything
 * beneath it.
 *
 * ## Why the guard is here rather than on each page
 *
 * A layout runs before any child renders, so a page under it cannot produce
 * content that is then navigated away from on the client: an unauthorized
 * request never has administrative data put into a response at all. Guarding
 * each page instead would work until somebody adds a page and forgets, which
 * is the failure this position is chosen to make impossible.
 *
 * `requireAreaAccess(PROTECTED_AREAS.admin)` takes the area rather than a bare
 * permission string, so the requirement enforced here is literally the entry
 * in `lib/authorization/routes.ts` that the navigation reads. The two cannot
 * drift.
 *
 * ## The layers beneath it
 *
 * This guard is the second of four. `src/proxy.ts` redirects a request with no
 * session before the route renders; the `(app)` layout above calls
 * `requireUser()`; this checks the permission; and `public.assign_user_role()`
 * and `public.list_managed_users()` each re-check the caller's role inside the
 * database. Delete any one of them and an unauthorized user still gets
 * nothing.
 *
 * ## No re-declaration
 *
 * `force-dynamic`, `requireUser()`, the brand, the skip link, the `<main>`
 * landmark, sign-out and the toast region all come from the `(app)` layout.
 * This adds the sub-navigation — a sidebar on wide screens, a bar on narrow
 * ones — and the permission check, and nothing else.
 */
export const metadata: Metadata = {
  title: {
    template: `%s · ${ADMIN_AREA.title}`,
    default: ADMIN_AREA.title,
  },
  robots: { index: false, follow: false },
};

/**
 * The administration navigation, declared once and drawn twice: as a
 * sidebar from `lg` up, and as the wrapping bar below it. Only one is ever
 * displayed, so assistive technology meets a single navigation landmark.
 */
const ADMIN_NAV: readonly {
  readonly item: NavItem;
  readonly icon: ReactNode;
}[] = [
  // Analytics first: it is where an administrator lands. The area has no
  // overview page of its own — `/admin` redirects to the dashboard.
  { item: ANALYTICS_NAV.admin, icon: <ChartColumn /> },
  {
    item: { label: ADMIN_USERS_PAGE.title, href: "/admin/users" },
    icon: <UsersRound />,
  },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAreaAccess(PROTECTED_AREAS.admin);

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch">
      <div className="border-border bg-muted/40 border-b lg:hidden">
        <Container>
          {/*
            Wraps rather than scrolls. `overflow-x-auto` here would absorb any
            overflow by hiding its own entries — the page would report no
            horizontal overflow while a link sat outside the viewport, and
            focusing it would not scroll it into view. Measured across
            320-1440px; see `components/doctor/doctor-nav.tsx`.
          */}
          <nav aria-label={ADMIN_AREA.navLabel} className="-mx-1">
            <ul className="flex flex-wrap items-center gap-1">
              {ADMIN_NAV.map(({ item }) => (
                <li key={item.href}>
                  <NavLink item={item} className="px-3 whitespace-nowrap" />
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>

      {/*
        The sidebar. Quiet by design: neutral entries, and the current page as
        the one filled row. Sticky so the way out of a long dashboard stays in
        reach without scrolling back up.
      */}
      <aside className="border-border bg-card/60 hidden w-64 shrink-0 border-r lg:block">
        <nav
          aria-label={ADMIN_AREA.navLabel}
          className="sticky top-0 flex flex-col gap-3 px-4 py-8"
        >
          <p
            aria-hidden="true"
            className="text-caption text-muted-foreground px-3 font-sans font-semibold tracking-wide uppercase"
          >
            {ADMIN_AREA.navLabel}
          </p>
          <ul className="flex flex-col gap-1">
            {ADMIN_NAV.map(({ item, icon }) => (
              <li key={item.href}>
                <NavLink item={item} appearance="sidebar" icon={icon} />
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
