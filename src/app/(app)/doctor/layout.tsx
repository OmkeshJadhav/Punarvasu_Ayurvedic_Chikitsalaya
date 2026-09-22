import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { DoctorNav } from "@/components/doctor/doctor-nav";
import { DOCTOR_AREA } from "@/features/doctor/content";
import { requireAreaAccess } from "@/lib/authorization/guards";
import { PROTECTED_AREAS } from "@/lib/authorization/routes";

/**
 * The clinical workspace shell — and the authorization boundary for
 * everything beneath it.
 *
 * ## Why the guard is here rather than on each page
 *
 * A layout runs before any child renders, so a page under it cannot produce
 * content that is then navigated away from on the client: an unauthorized
 * request never has a patient's name or a practitioner's diary put into a
 * response at all. Guarding each page instead would work until somebody adds
 * a page and forgets, which is the failure this position makes impossible.
 *
 * `requireAreaAccess(PROTECTED_AREAS.doctor)` takes the *area* rather than a
 * bare permission string, so the requirement enforced here is literally the
 * entry in `lib/authorization/routes.ts` that the navigation reads. The two
 * cannot drift — a link cannot be offered for an area the guard will refuse,
 * and an area cannot acquire a link while nobody remembers to guard it.
 *
 * ## The layers beneath it
 *
 * This guard is the second of five. `src/proxy.ts` redirects a request with
 * no session before the route renders; the `(app)` layout above calls
 * `requireUser()`; this checks the permission; every page and action below
 * checks its own permission again; the database re-checks the role inside
 * each `security definer` function; and row-level security decides what any
 * query can see. Delete any one of them and an unauthorized user still gets
 * nothing (`phase_11.md` sections 45-46).
 *
 * A patient, a receptionist or an administrator reaching `/doctor` gets the
 * forbidden page, which names no role, no required permission and no policy.
 *
 * ## No re-declaration
 *
 * `force-dynamic`, `requireUser()`, the brand, the skip link, the `<main>`
 * landmark, sign-out and the toast region all come from the `(app)` layout.
 * This adds the sub-navigation and the permission check, and nothing else.
 */
export const metadata: Metadata = {
  title: {
    template: `%s · ${DOCTOR_AREA.title}`,
    default: DOCTOR_AREA.title,
  },
  robots: { index: false, follow: false },
};

export default async function DoctorLayout({
  children,
}: LayoutProps<"/doctor">) {
  await requireAreaAccess(PROTECTED_AREAS.doctor);

  return (
    <div className="flex flex-col">
      <div className="border-border bg-muted/40 border-b">
        <Container>
          <DoctorNav label={DOCTOR_AREA.navLabel} />
        </Container>
      </div>

      {children}
    </div>
  );
}
