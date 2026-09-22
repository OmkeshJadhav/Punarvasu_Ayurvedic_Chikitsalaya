/**
 * Which permission each authenticated area requires, and where each role
 * belongs.
 *
 * ## One table, three consumers
 *
 * The rules below are read by the layout that guards an area, by the
 * navigation that decides whether to offer a link to it, and by the tests that
 * assert the two agree. Writing the requirement once is what stops a link
 * appearing for a role the guard will then turn away - and, far more
 * importantly, stops a guard being forgotten for an area whose link was
 * remembered.
 *
 * Hiding a link is a usability decision. The guard is the security decision,
 * and it runs on the server whether or not a link was ever rendered
 * (`phase_08.md` sections 10 and 33, example 5).
 *
 * ## Only areas that exist
 *
 * Four entries, because the authenticated application currently has four
 * permission-gated areas. `phase_08.md` section 23 and section 37 both forbid
 * fabricating routes for future phases, and none of these is one:
 * `/receptionist` arrived in Phase 10 and `/doctor` in Phase 11, each
 * alongside the workspace it guards.
 *
 * `/account` is deliberately absent: it requires authentication and no
 * particular permission, which is the `(app)` layout's job, not this table's.
 */

import type { Permission } from "@/config/permissions";
import { AUTHENTICATED_LANDING_PATH } from "@/lib/auth/paths";
import type { AppRole } from "@/types/database";

import { can } from "./policy";

/**
 * Where an authorization failure sends the user.
 *
 * A real page inside the authenticated shell rather than a bare 403, so the
 * person keeps the header, the sign-out control and a way back
 * (`phase_08.md` section 28).
 */
export const FORBIDDEN_PATH = "/forbidden";

/** The patient's own area: their record, and later their own appointments. */
export const PATIENT_AREA_PATH = "/patient";

/**
 * The front desk: today's schedule, patient lookup, appointment operations.
 *
 * Operational only. Nothing beneath this path reads or writes clinical
 * information, and `docs/SECURITY.md` section 6 makes that a hard boundary
 * rather than a UI preference.
 */
export const RECEPTIONIST_AREA_PATH = "/receptionist";

/**
 * The practitioner's own workspace: their diary, and the patients they are
 * booked to see.
 *
 * Scoped by the care relationship throughout, never by the doctor role alone
 * (`docs/SECURITY.md` section 6). Nothing beneath this path reads or writes a
 * clinical record, because none exists — Phase 12 brings the record and the
 * permission that guards it together.
 */
export const DOCTOR_AREA_PATH = "/doctor";

/** Clinic administration: staff access management. */
export const ADMIN_AREA_PATH = "/admin";

export interface ProtectedArea {
  /** The route prefix. Everything at or beneath it needs `permission`. */
  readonly path: string;
  /** The capability required to enter. Checked server-side, every request. */
  readonly permission: Permission;
  /** The navigation label, when the area is offered as a link. */
  readonly label: string;
}

/**
 * The areas of the authenticated application, and what each one requires.
 *
 * Keyed rather than a bare list so a guard names its area in a way TypeScript
 * checks: `requireAreaAccess(PROTECTED_AREAS.admin)` cannot be typo'd into a
 * rule that does not exist and therefore silently guards nothing.
 */
export const PROTECTED_AREAS = {
  patient: {
    path: PATIENT_AREA_PATH,
    permission: "profile.read.self",
    label: "Patient area",
  },
  receptionist: {
    path: RECEPTIONIST_AREA_PATH,
    permission: "appointments.manage.any",
    label: "Front desk",
  },
  doctor: {
    path: DOCTOR_AREA_PATH,
    permission: "appointments.read.own_schedule",
    label: "Clinical workspace",
  },
  admin: {
    path: ADMIN_AREA_PATH,
    permission: "roles.manage",
    label: "Administration",
  },
} as const satisfies Readonly<Record<string, ProtectedArea>>;

export const PROTECTED_AREA_LIST: readonly ProtectedArea[] =
  Object.values(PROTECTED_AREAS);

/**
 * The permission a path requires, or `null` when it requires none beyond a
 * session.
 *
 * Prefix matching, with the separator checked, so `/administration` never
 * matches the `/admin` rule and inherits a requirement that was not written
 * for it.
 */
export function requiredPermissionForPath(pathname: string): Permission | null {
  const area = PROTECTED_AREA_LIST.find(
    (candidate) =>
      pathname === candidate.path || pathname.startsWith(`${candidate.path}/`),
  );

  return area?.permission ?? null;
}

/**
 * The areas a role may enter.
 *
 * Used to build navigation. A role with no area gets an empty list, and the
 * account page says in words that their workspace is still being built rather
 * than offering a link to nothing. Every role now has one, so that branch is
 * currently unreachable — it stays because the next role added will reach it
 * before its workspace exists.
 */
export function areasForRole(role: AppRole | null): readonly ProtectedArea[] {
  return PROTECTED_AREA_LIST.filter((area) => can(role, area.permission));
}

/**
 * Where a role's own work lives.
 *
 * Used by the account page to offer the obvious next step, **not** by the
 * sign-in redirect. Sign-in continues to land on `/account` for everybody:
 * making the landing role-dependent would mean resolving the role in
 * `src/proxy.ts`, which runs on every request including prefetches, and
 * `phase_08.md` sections 24 and 31 both argue against putting an
 * authorization lookup there.
 *
 * A role with no area of its own lands on the account page, which is honest
 * about why.
 */
export function landingPathForRole(role: AppRole | null): string {
  return areasForRole(role)[0]?.path ?? AUTHENTICATED_LANDING_PATH;
}
