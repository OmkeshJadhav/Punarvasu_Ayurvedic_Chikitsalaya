import Link from "next/link";
import type { Metadata } from "next";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Toaster } from "@/components/ui/toast";
import { Logo } from "@/components/brand/logo";
import { AppNav } from "@/components/layout/app-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Container } from "@/components/layout/container";
import { SkipLink } from "@/components/layout/site-header";
import { requireUser } from "@/lib/auth/current-user";
import { AUTH_FOOTNOTE } from "@/features/auth/content";

/**
 * The authenticated application shell.
 *
 * ## This is the security boundary
 *
 * `requireUser()` runs before any child renders. If there is no verified
 * session it redirects, so a protected page never produces content that is
 * then navigated away from on the client - the data is never put into a
 * response at all (`phase_06.md` section 29).
 *
 * The proxy also redirects unauthenticated requests away from these paths, but
 * that is an optimisation, not the guarantee. Next.js's own guidance is that
 * proxy checks are optimistic and the real check belongs next to the data;
 * `docs/SECURITY.md` section 2.2 asks for the same layering. If the proxy were
 * deleted tomorrow, this layout would still deny access, and the database's
 * row-level security would still deny it a third time.
 *
 * ## Why this route group exists separately
 *
 * `(app)` is a route group, so these pages are not wrapped in the marketing
 * header and footer. That is not only presentational: the public shell is
 * statically prerendered, and a layout that reads a session cannot be.
 * Separating them keeps thirty public pages static while everything here is
 * rendered per request.
 *
 * ## Caching
 *
 * `force-dynamic` states the rule rather than relying on the fact that reading
 * cookies happens to opt the route out of static generation. A page under this
 * layout holds one person's data; a cached copy of it is a data breach with a
 * long shelf life (`phase_06.md` section 74). The proxy sets `no-store` on the
 * response as well.
 *
 * ## What is deliberately not here
 *
 * Any role check. This layout is the *authentication* boundary and nothing
 * more: every authenticated user may reach `/account` and `/forbidden`
 * whatever role they hold. Authorization belongs to the area that needs it,
 * where the requirement can be stated next to the thing it protects —
 * `(app)/patient/layout.tsx` and `(app)/admin/layout.tsx` each call
 * `requireAreaAccess` for their own area (`phase_08.md` section 11).
 *
 * Putting a role gate here instead would mean one place deciding access for
 * every area beneath it, which is the arrangement that ends with a new area
 * being added and quietly inheriting somebody else's rule.
 *
 * This shell is a foundation, not a dashboard. The doctor workspace and the
 * receptionist workspace get their own navigation in the phases that build
 * them; the patient area has its own under `(app)/patient`, and administration
 * under `(app)/admin`.
 *
 * ## The navigation is not a security control
 *
 * `AppNav` lists the areas the signed-in role can enter, so nobody is offered
 * a link that will turn them away. It is a usability affordance: every area
 * guards itself on the server, and row-level security guards every table
 * beneath it (`phase_08.md` section 10, layer 1).
 *
 * ## Why the toast region is mounted here
 *
 * Added in Phase 07. `Toaster` has to be an ancestor of anything calling
 * `useToast`, and the authenticated area is where confirmations of a saved
 * change belong. Mounting it at this level rather than per page means a
 * confirmation survives the navigation that follows the action that caused it.
 * It renders nothing until something is announced, so it costs a provider and
 * an empty viewport.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // The guard. Not a data fetch that happens to be here - the reason the
  // layout exists. It also resolves the role, from the database, for the
  // navigation below; `getCurrentUser()` is memoised per render pass, so the
  // areas beneath do not pay for it again.
  const user = await requireUser();

  return (
    <Toaster>
      <div className="flex min-h-dvh flex-col">
        <header className="border-border bg-card border-b">
          <SkipLink />
          {/*
            One row from `sm` up; two rows below it.

            **Phase 18 fix, found by measurement.** The brand, the area
            navigation, the bell and sign-out did not fit on one row on a
            phone: at 320px the nav was 90px wider than the space it was
            given, so `overflow-x-auto` clipped the label mid-word and the
            bell sat against the cut. The page never overflowed, which is why
            four earlier browser passes did not catch it — the nav was
            absorbing the overflow by hiding its own content.

            Wrapping is the fix rather than hiding: an area link is a signed-in
            person's only route to their own workspace from a page outside it,
            and removing it on small screens would cost a doctor on
            `/notifications` their way back. Each control is still rendered
            exactly once — the ordering is CSS — so the notification count is
            still one query per request.
          */}
          <Container className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 sm:h-16 sm:flex-nowrap sm:gap-y-0 sm:py-0 lg:h-20">
            <Logo showSubline={false} />

            {/*
              No name, no email, no identifiers in the chrome
              (`phase_06.md` section 39). The navigation names areas, never the
              person. Sign out is the only other control the foundation needs.

              `NotificationBell` is Phase 15: a server component, so the unread
              count is authorized server state rather than a number the browser
              keeps (`phase_15.md` section 63), and so the header still ships
              no JavaScript. It renders for every role — a notification is
              addressed to an account, and a role with none sees a bell with no
              number.
            */}
            <div className="order-2 ml-auto flex shrink-0 items-center gap-1 sm:order-3 sm:ml-0 sm:gap-4">
              <NotificationBell />
              <SignOutButton />
            </div>

            <AppNav
              role={user.role}
              label="Your areas"
              className="order-3 w-full sm:order-2 sm:ml-auto sm:w-auto"
            />
          </Container>
        </header>

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <footer className="border-border border-t">
          <Container className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-muted-foreground measure">
              {AUTH_FOOTNOTE}
            </p>
            <Link
              href="/"
              className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Punarvasu website
            </Link>
          </Container>
        </footer>
      </div>
    </Toaster>
  );
}
