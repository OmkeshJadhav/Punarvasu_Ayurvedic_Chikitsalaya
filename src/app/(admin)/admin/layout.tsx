import Link from "next/link";
import type { Metadata } from "next";

import { AdminAccountMenu } from "@/components/admin/admin-account-menu";
import { AdminMobileMenu } from "@/components/admin/admin-mobile-menu";
import { AdminHelpCard, AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { SkipLink } from "@/components/layout/site-header";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Toaster } from "@/components/ui/toast";
import { ROLE_LABELS } from "@/config/permissions";
import { ADMIN_AREA, ADMIN_SHELL } from "@/features/admin/content";
import { formatClinicDate } from "@/features/appointments/time";
import { AUTH_FOOTNOTE } from "@/features/auth/content";
import { requireAreaAccess } from "@/lib/authorization/guards";
import { PROTECTED_AREAS } from "@/lib/authorization/routes";

/**
 * The administration shell — and the authorization boundary for everything
 * beneath it.
 *
 * ## Why administration has its own route group
 *
 * Every other signed-in area sits under `(app)`, whose layout draws a header
 * across the top of the page. The administration area is a workspace in its
 * own right — a full-height sidebar carrying the brand and the navigation,
 * with a slim top bar beside it — and a layout cannot remove chrome its parent
 * has already drawn. So `(admin)` is a sibling of `(app)`, not a child. The
 * URLs are unchanged: a route group is not a path segment.
 *
 * Being a sibling means this layout takes over the three things `(app)`'s
 * would otherwise have supplied, and each is restated here deliberately:
 *
 *   - **authentication**, through `requireAreaAccess`, which calls
 *     `requireUser()` before checking the permission;
 *   - **`force-dynamic`**, because a page here holds clinic data and a cached
 *     copy of it would be a data breach with a long shelf life
 *     (`phase_06.md` section 74);
 *   - **the toast region**, the skip link and the `<main>` landmark.
 *
 * ## Why the guard is here rather than on each page
 *
 * A layout runs before any child renders, so an unauthorized request never
 * has administrative data put into a response at all. Guarding each page
 * instead would work until somebody adds a page and forgets.
 * `requireAreaAccess(PROTECTED_AREAS.admin)` takes the area rather than a bare
 * permission string, so the requirement enforced here is literally the entry
 * in `lib/authorization/routes.ts` that the proxy and navigation read.
 *
 * The layers beneath are unchanged: `src/proxy.ts` redirects a request with no
 * session before the route renders, this checks the session and the
 * permission, and the database re-checks the caller's role inside every
 * administrative function. Delete any one of them and an unauthorized user
 * still gets nothing.
 *
 * ## No identity in the chrome
 *
 * The top bar names the role, never the person (`phase_06.md` section 39).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    template: `%s · ${ADMIN_AREA.title}`,
    default: ADMIN_AREA.title,
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAreaAccess(PROTECTED_AREAS.admin);
  const roleLabel = user.role ? ROLE_LABELS[user.role] : ADMIN_AREA.title;

  return (
    <Toaster>
      <SkipLink />
      <div className="flex min-h-dvh">
        {/*
          The sidebar, from `lg` up. The column runs the page's full height so
          its surface never stops short; the contents inside it are sticky, so
          the way around a long dashboard stays in reach, and the list scrolls
          if a short window cannot hold it.
        */}
        <aside className="border-border/70 bg-card/70 hidden w-72 shrink-0 border-r lg:block">
          <div className="sticky top-0 flex h-dvh flex-col">
            <div className="px-6 pt-6 pb-8">
              <Logo />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              <AdminNav label={ADMIN_AREA.navLabel} />
            </div>
            <div className="p-4">
              <AdminHelpCard />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-border/70 bg-card/40 border-b">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-18 lg:px-8">
              <div className="lg:hidden">
                <Logo showSubline={false} />
              </div>
              <p className="text-body-sm text-muted-foreground hidden font-sans lg:block">
                {formatClinicDate(new Date())}
              </p>

              <div className="ml-auto flex items-center gap-1 sm:gap-3">
                <NotificationBell />
                <AdminAccountMenu
                  roleLabel={roleLabel}
                  signOut={<SignOutButton block />}
                />
                <AdminMobileMenu />
              </div>
            </div>
          </header>

          <main id="main-content" className="flex-1">
            {children}
          </main>

          <footer className="border-border/70 border-t">
            <div className="flex flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <p className="text-caption text-muted-foreground measure font-sans">
                {AUTH_FOOTNOTE}
              </p>
              <Link
                href="/"
                className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm font-sans underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {ADMIN_SHELL.websiteLink}
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </Toaster>
  );
}
