import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { UserAccessTable } from "@/components/admin/user-access-table";
import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { ADMIN_USERS_PAGE } from "@/features/admin/content";
import { listManagedUsers } from "@/features/admin/queries";
import { requireAreaAccess } from "@/lib/authorization/guards";
import { PROTECTED_AREAS } from "@/lib/authorization/routes";

/**
 * Access management.
 *
 * ## The guard runs twice, and that is the design
 *
 * The layout above already refused anyone without `roles.manage`. This page
 * calls `requireAreaAccess` again, and `listManagedUsers()` calls
 * `assertPermission` a third time, and `public.list_managed_users()` re-checks
 * the caller's role inside the database a fourth.
 *
 * The repetition costs nothing — `getCurrentUser()` is memoised per render
 * pass, so it is one verification round trip and one role query for the whole
 * request. What it buys is that the page holds its own guarantee rather than
 * inheriting one from a layout that a future refactor could move, and that the
 * *data access* is protected independently of the *route*. `phase_08.md`
 * section 10's four layers are layers precisely so that no single one of them
 * is load-bearing.
 *
 * ## Three states, all handled
 *
 * A failed read gets its own screen with a retry rather than an empty table:
 * on the page where access is granted, "nobody has an account" and "we could
 * not read the accounts" must not look the same. The retry is a link to this
 * page, because the read happens during server rendering, so re-requesting
 * *is* the retry and it needs no client component.
 */
export const metadata: Metadata = {
  title: ADMIN_USERS_PAGE.title,
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage() {
  const admin = await requireAreaAccess(PROTECTED_AREAS.admin);
  const result = await listManagedUsers();

  return (
    <Section aria-labelledby="admin-users-heading">
      <Container>
        <SectionHeader
          as="h1"
          titleId="admin-users-heading"
          title={ADMIN_USERS_PAGE.heading}
          description={ADMIN_USERS_PAGE.description}
        />

        <div className="mt-8">
          {result.status === "unavailable" ? (
            <ErrorState
              title={ADMIN_USERS_PAGE.errorTitle}
              description={ADMIN_USERS_PAGE.errorBody}
              action={
                <Button asChild variant="secondary">
                  <Link href="/admin/users">
                    {ADMIN_USERS_PAGE.errorAction}
                  </Link>
                </Button>
              }
            />
          ) : result.users.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title={ADMIN_USERS_PAGE.emptyTitle}
              description={ADMIN_USERS_PAGE.emptyBody}
            />
          ) : (
            <UserAccessTable users={result.users} currentUserId={admin.id} />
          )}
        </div>
      </Container>
    </Section>
  );
}
