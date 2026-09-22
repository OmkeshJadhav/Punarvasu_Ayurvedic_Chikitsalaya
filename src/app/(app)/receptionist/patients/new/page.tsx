import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { NewPatientForm } from "@/components/reception/new-patient-form";
import { Alert } from "@/components/ui/alert";
import { NEW_PATIENT_COPY, RECEPTION_AREA } from "@/features/reception/content";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: RECEPTION_AREA.newPatient.title,
  robots: { index: false, follow: false },
};

/**
 * Registering a patient the clinic has not seen before.
 *
 * ## What this creates, and what it deliberately does not
 *
 * A clinic record with no owner. It creates no authentication account, no
 * password and no role, and it cannot attach the record to anybody's login —
 * `create_patient_record` has no parameter for an owner, so there is no
 * request shape that does it (`phase_10.md` sections 34-35).
 *
 * That leaves an unlinked record, which is the walk-in case
 * `docs/DATABASE.md` section 4.2 describes and which Phase 07's *partial*
 * unique index on `profile_id` was built for. Claiming such a record when that
 * person later registers is a separate, deliberate workflow — and it must stay
 * separate, because the way to get it wrong is to let somebody pass an id.
 *
 * ## Duplicates
 *
 * The first submission checks, shows what it found and writes nothing. The
 * receptionist then opens an existing record or says this is somebody else.
 * It warns once and never blocks, because refusing to register a patient at
 * the desk over a shared phone number is worse than the duplicate it prevents,
 * and merging automatically would be worse than both.
 *
 * ## Authorization
 *
 * `patients.write.operational`, checked here and again in the database. It is
 * separate from reading because creating a record is the capability that can
 * put a wrong person into the system.
 */
export default async function NewPatientPage() {
  await requirePermission(
    "patients.write.operational",
    "/receptionist/patients/new",
  );

  return (
    <Section aria-labelledby="new-patient-heading">
      <Container width="content">
        <Link
          href="/receptionist/patients"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {RECEPTION_AREA.patients.title}
        </Link>

        <div className="mt-2">
          <SectionHeader
            as="h1"
            titleId="new-patient-heading"
            title={RECEPTION_AREA.newPatient.heading}
            description={RECEPTION_AREA.newPatient.description}
          />
        </div>

        <div className="mt-6">
          {/*
            Said before the form rather than after it fails. A receptionist who
            has not searched first is the most likely way a duplicate record is
            created, and the check that follows is a safety net rather than the
            workflow.
          */}
          <Alert tone="info" title="Search first">
            If this patient may already be registered, search for them before
            creating a new record. Anything you enter here is checked against
            existing patients, but a search is quicker than correcting a
            duplicate afterwards.
          </Alert>
        </div>

        <div className="mt-8">
          <NewPatientForm cancelHref="/receptionist/patients" />
        </div>

        <p className="text-caption text-muted-foreground measure mt-8">
          {NEW_PATIENT_COPY.clinicalNotice}
        </p>
      </Container>
    </Section>
  );
}
