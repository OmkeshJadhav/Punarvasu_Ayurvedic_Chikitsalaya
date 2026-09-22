import { Check, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { ROLE_LABELS } from "@/config/permissions";
import { ADMIN_USERS_PAGE } from "@/features/admin/content";
import type { ManagedUser } from "@/features/admin/types";

import { RoleAssignmentForm } from "./role-assignment-form";

/**
 * Every account and the role it holds.
 *
 * A server component. Only the per-row role control is a client component,
 * because only it needs a pending state.
 *
 * ## The administrator's own row has no control
 *
 * It carries a sentence explaining why instead. `docs/SECURITY.md` section 6
 * requires that no user changes their own role, including an admin acting on
 * their own account, and that rule is enforced in the server action and again
 * inside `public.assign_user_role()`. Omitting the control here is the third,
 * weakest layer — the explanation is the point, not the omission.
 *
 * ## What the table shows, and what it does not
 *
 * A name, an email address, the role held, and whether the address is
 * verified. No phone number, no postal address, no date of birth and no link
 * into any patient record: managing who may sign in is not a licence to browse
 * patient data (`docs/SECURITY.md` section 6, "Admins").
 *
 * Verification state is a `Badge`, which carries an icon as well as a colour,
 * so the distinction is not made by colour alone.
 *
 * ## Mobile
 *
 * Wrapped in `TableScroller`, which makes the overflow region focusable so a
 * keyboard user can reach it at all. The row control stacks above `sm` breaks.
 */
export function UserAccessTable({
  users,
  currentUserId,
}: {
  readonly users: readonly ManagedUser[];
  /** The signed-in administrator, so their own row can explain itself. */
  readonly currentUserId: string;
}) {
  return (
    <TableScroller label={ADMIN_USERS_PAGE.tableCaption}>
      <Table>
        <TableCaption>{ADMIN_USERS_PAGE.tableCaption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{ADMIN_USERS_PAGE.columnPerson}</TableHead>
            <TableHead scope="col">{ADMIN_USERS_PAGE.columnRole}</TableHead>
            <TableHead scope="col">{ADMIN_USERS_PAGE.columnStatus}</TableHead>
            <TableHead scope="col">{ADMIN_USERS_PAGE.columnAction}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const personLabel =
              user.email ?? user.fullName ?? ADMIN_USERS_PAGE.unnamedLabel;

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <span className="text-foreground block font-medium [overflow-wrap:anywhere]">
                    {user.fullName ?? ADMIN_USERS_PAGE.unnamedLabel}
                  </span>
                  <span className="text-caption text-muted-foreground block [overflow-wrap:anywhere]">
                    {user.email ?? "—"}
                    {isSelf ? ` · ${ADMIN_USERS_PAGE.youLabel}` : ""}
                  </span>
                </TableCell>

                <TableCell>
                  {/*
                    The role as text, not only as a colour. It is also printed
                    here rather than left implicit in the select, so the
                    current value survives a browser that has not hydrated.
                  */}
                  {user.role
                    ? ROLE_LABELS[user.role]
                    : ADMIN_USERS_PAGE.noRoleLabel}
                </TableCell>

                <TableCell>
                  <Badge
                    tone={user.emailConfirmed ? "success" : "warning"}
                    icon={
                      user.emailConfirmed ? (
                        <Check className="size-3.5" />
                      ) : (
                        <CircleAlert className="size-3.5" />
                      )
                    }
                  >
                    {user.emailConfirmed
                      ? ADMIN_USERS_PAGE.verifiedLabel
                      : ADMIN_USERS_PAGE.unverifiedLabel}
                  </Badge>
                </TableCell>

                <TableCell>
                  {isSelf ? (
                    <p className="text-caption text-muted-foreground measure">
                      {ADMIN_USERS_PAGE.selfNotice}
                    </p>
                  ) : (
                    <RoleAssignmentForm
                      userId={user.id}
                      currentRole={user.role}
                      personLabel={personLabel}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableScroller>
  );
}
