import type { Metadata } from "next";

import { PatientNav } from "@/components/patient/patient-nav";
import { Container } from "@/components/layout/container";
import { PATIENT_AREA } from "@/features/patients/content";
import { requireAreaAccess } from "@/lib/authorization/guards";
import { PROTECTED_AREAS } from "@/lib/authorization/routes";

/**
 * The patient area shell.
 *
 * ## What it adds, and what it does not repeat
 *
 * The `(app)` layout above already carries the brand, the skip link, the
 * `<main>` landmark, sign-out, `requireUser()` and `force-dynamic`. This layout
 * adds one thing: the navigation between the patient's own pages
 * (`phase_07.md` sections 60-63). It does not re-declare any of the above, and
 * it deliberately does not call `requireUser()` again — the guard is one layer
 * up, and a second copy would invite the reading that each layout is
 * responsible for its own protection.
 *
 * ## Two links, and only two
 *
 * `phase_07.md` section 62 says not to expose future sections as
 * non-functional links. Appointments, prescriptions and documents do not
 * exist, so they are not listed; the overview page says in words that they are
 * being built, which is honest in a way a disabled menu item is not.
 *
 * ## The authorization boundary for this area (Phase 08)
 *
 * Phase 07 left this open to any authenticated user and recorded the reason:
 * whether a doctor or a receptionist should *see* the patient area is a role
 * question, and the model to answer it did not exist yet. It does now, so the
 * guard is here.
 *
 * `requireAreaAccess(PROTECTED_AREAS.patient)` requires `profile.read.self`,
 * which `config/permissions.ts` grants to the patient role alone. That follows
 * `docs/SECURITY.md` section 6: a staff member who is also a patient of the
 * clinic uses a separate patient account, which keeps every authorization
 * decision unambiguous. A receptionist, a doctor or an administrator reaching
 * `/patient` gets the forbidden page.
 *
 * It sits in the layout rather than on each page so that a page added beneath
 * it inherits the guard instead of having to remember it — and it takes the
 * *area* rather than a bare permission string, so what is enforced here is
 * literally the entry in `lib/authorization/routes.ts` that the navigation
 * reads.
 *
 * `requireUser()` is still one layer up, unrepeated. Row-level security on
 * `public.patients` is still the last word, and is unchanged from Phase 07:
 * even a patient who passes this guard can only ever read their own row.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PatientLayout({
  children,
}: LayoutProps<"/patient">) {
  await requireAreaAccess(PROTECTED_AREAS.patient);

  return (
    <div className="flex flex-col">
      <div className="border-border bg-muted/40 border-b">
        <Container>
          <PatientNav label={PATIENT_AREA.navLabel} />
        </Container>
      </div>

      {children}
    </div>
  );
}
