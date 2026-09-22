import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { PatientSearch } from "@/components/reception/patient-search";
import { Button } from "@/components/ui/button";
import {
  PATIENT_SEARCH_COPY,
  RECEPTION_AREA,
} from "@/features/reception/content";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: RECEPTION_AREA.patients.title,
  robots: { index: false, follow: false },
};

/**
 * Finding a patient.
 *
 * ## Nothing is listed until somebody searches
 *
 * There is no "all patients" view, and that is the point rather than an
 * omission. `phase_10.md` section 13 rules out an endpoint that returns the
 * patient database, and a page that renders one on arrival is the same thing
 * with a nicer interface. The search is bounded in the database, refuses a
 * term shorter than two characters, and clamps its own result count.
 *
 * ## Why the page holds so little
 *
 * The search component owns the form, the results and all four of its
 * states — nothing searched yet, term too short, no matches, and a failed
 * search. Duplicating any of that here would be two places for the empty
 * states to drift.
 *
 * ## Authorization
 *
 * The area layout has already checked `appointments.manage.any`. This page
 * checks `patients.read.operational`, because reading patient records is a
 * capability of its own — a future role that schedules but may not look
 * patients up would be refused here and admitted upstairs, which is the
 * distinction worth keeping.
 */
export default async function ReceptionPatientsPage() {
  await requirePermission(
    "patients.read.operational",
    "/receptionist/patients",
  );

  return (
    <Section aria-labelledby="reception-patients-heading">
      <Container width="wide">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            as="h1"
            titleId="reception-patients-heading"
            title={RECEPTION_AREA.patients.heading}
            description={RECEPTION_AREA.patients.description}
          />
          <div className="shrink-0">
            <Button asChild variant="secondary">
              <Link href="/receptionist/patients/new">
                {PATIENT_SEARCH_COPY.emptyAction}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8">
          <PatientSearch autoFocus />
        </div>
      </Container>
    </Section>
  );
}
