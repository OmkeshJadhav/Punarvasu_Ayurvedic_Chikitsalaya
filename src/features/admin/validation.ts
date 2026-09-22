/**
 * Role-assignment input validation.
 *
 * Runs on both sides of the trust boundary: in the browser for immediate
 * feedback, and again in the server action, which never trusts the browser's
 * result (`docs/SECURITY.md` section 2.3).
 *
 * ## What validation is and is not doing here
 *
 * It bounds the *shape* of the request: a target that is a UUID, a role that
 * is one of four. It does **not** decide whether the request is allowed - that
 * is `assertPermission("roles.manage")` in the action and
 * `public.assign_user_role()` in the database, both of which ignore everything
 * in this file and read the caller's own role from Postgres.
 *
 * Worth being explicit about, because the fields here are the classic
 * privilege-escalation payload: `{ "userId": "victim", "role": "admin" }`
 * (`phase_08.md` section 25). Both values are accepted from the client and
 * neither confers any authority - they say *what* to do, and three independent
 * layers decide *whether*.
 */

import { z } from "zod";

import { APP_ROLES } from "@/config/permissions";
import { uuidSchema } from "@/lib/validation/schemas";

/**
 * The role a form may request.
 *
 * Built from the canonical list rather than repeated, so a role added to
 * `config/permissions.ts` cannot be one this schema silently refuses - or,
 * worse, one it silently accepts after the enum has moved on. The database
 * enum is the final gate regardless: `'superadmin'`, `'root'` and `'Doctor'`
 * are not values `public.app_role` can hold (`phase_08.md` section 7).
 */
export const appRoleSchema = z.enum(APP_ROLES, {
  message: "Choose one of the available roles.",
});

/**
 * A request to assign a role to a user.
 *
 * `strict()` so an unexpected key is **rejected rather than dropped**.
 *
 * It is the second of two gates and it will rarely be the one that fires:
 * `readRoleForm` in `./actions.ts` reads two named fields from the submission,
 * so an extra field on the form is never read in the first place. `strict()`
 * catches the other route in — an object assembled in code, by a future route
 * handler or a caller that reaches for this schema directly — where being told
 * that something unexpected was supplied is worth more than being tolerant of
 * it.
 */
export const roleAssignmentSchema = z
  .object({
    targetUserId: uuidSchema,
    role: appRoleSchema,
  })
  .strict();

export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>;
