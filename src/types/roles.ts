import type { Database } from "./database";

/**
 * The canonical role model (`docs/SECURITY.md` section 6).
 *
 * Re-exported as a named type because application code needs to name a role
 * without reaching into the generated table shapes. A user holds exactly one.
 *
 * Lives outside `database.ts` because that file is regenerated wholesale by
 * `npm run db:types`, which would drop anything added to it by hand.
 */
export type AppRole = Database["public"]["Enums"]["app_role"];
