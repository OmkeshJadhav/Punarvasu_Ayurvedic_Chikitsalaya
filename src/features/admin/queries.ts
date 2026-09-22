/**
 * Access-management reads.
 *
 * ## Two checks, not one
 *
 * Every function here calls `assertPermission("roles.manage")` first, and the
 * database function it then calls re-checks the caller's role itself. That is
 * not belt-and-braces theatre: the database check is what holds if this file
 * is called from somewhere that forgot, and the application check is what
 * turns a refusal into a page rather than an exception surfacing as a generic
 * failure.
 *
 * ## Why an RPC and not a table read
 *
 * The clinic identifies a person by their email address, which lives in
 * `auth.users` - a schema PostgREST does not expose and row-level security
 * cannot reach. The two ways to read it are the service-role key in a server
 * route, or a `security definer` function.
 *
 * `public.list_managed_users()` is the second, and it is better on both counts
 * `phase_08.md` section 21 cares about: the authorization check sits in the
 * database next to the data rather than in whichever caller remembered it, and
 * the key that bypasses every policy in the project stays unused. Nothing in
 * this feature touches `lib/supabase/admin.ts`.
 */

import "server-only";

import { assertPermission } from "@/lib/authorization/guards";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_ROLES } from "@/config/permissions";
import type { AppRole } from "@/types/database";

import type { ManagedUser, ManagedUserListResult } from "./types";

/**
 * Every account and the role it holds.
 *
 * Returns a discriminated result rather than an array or `null`, so that "the
 * clinic has no accounts" and "we could not read them" reach different
 * screens. An empty table where a failure occurred would be a quietly wrong
 * answer on the screen where access is granted.
 *
 * Throws `forbidden` for a caller without `roles.manage` - it does not return
 * an empty list, because a caller who is not allowed to ask should learn that
 * they were refused rather than that there is nobody here.
 */
export async function listManagedUsers(): Promise<ManagedUserListResult> {
  const user = await assertPermission("roles.manage");

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_managed_users");

    if (error) {
      // The acting admin's id is opaque and is what makes this diagnosable.
      // No listed account's address or name is logged.
      logger.error("admin.user_list_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    return { status: "ready", users: (data ?? []).map(toManagedUser) };
  } catch (error) {
    logger.error("admin.user_list_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * Maps a row from the database function to the domain model.
 *
 * The one place `snake_case` becomes `camelCase` for this feature, and the one
 * place a role value from the database is narrowed. An unrecognised role reads
 * as `null` - "no role" - rather than being asserted into the union: a type
 * assertion here would make the application's types disagree with the row it
 * is holding, on the screen where that disagreement is most expensive.
 */
function toManagedUser(row: {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole | null;
  email_confirmed: boolean;
  created_at: string;
}): ManagedUser {
  return {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: toAppRole(row.role),
    emailConfirmed: row.email_confirmed,
    createdAt: row.created_at,
  };
}

function toAppRole(value: string | null): AppRole | null {
  return APP_ROLES.find((role) => role === value) ?? null;
}
