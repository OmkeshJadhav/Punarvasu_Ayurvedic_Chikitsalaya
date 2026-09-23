import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { NavLink } from "@/components/layout/nav-link";
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
 * This adds the sub-navigation and the permission check, and nothing else.
 */
export const metadata: Metadata = {
  title: {
    template: `%s · ${ADMIN_AREA.title}`,
    default: ADMIN_AREA.title,
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAreaAccess(PROTECTED_AREAS.admin);

  return (
    <div className="flex flex-col">
      <div className="border-border bg-muted/40 border-b">
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
              <li>
                <NavLink
                  // `match: "exact"` because this nav also lists a child of
                  // `/admin`. Without it both entries would report
                  // `aria-current="page"` on `/admin/users`, telling a screen
                  // reader user they are in two places at once.
                  item={{ label: "Overview", href: "/admin", match: "exact" }}
                  className="px-3 whitespace-nowrap"
                />
              </li>
              <li>
                <NavLink
                  item={{
                    label: ADMIN_USERS_PAGE.title,
                    href: "/admin/users",
                  }}
                  className="px-3 whitespace-nowrap"
                />
              </li>
              <li>
                <NavLink
                  item={ANALYTICS_NAV.admin}
                  className="px-3 whitespace-nowrap"
                />
              </li>
            </ul>
          </nav>
        </Container>
      </div>

      {children}
    </div>
  );
}
