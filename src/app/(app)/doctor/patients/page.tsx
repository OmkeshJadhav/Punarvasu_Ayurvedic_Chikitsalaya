import type { Metadata } from "next";

import { CarePatientSearch } from "@/components/doctor/care-patient-search";
import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Alert } from "@/components/ui/alert";
import {
  DOCTOR_AREA,
  DOCTOR_PATIENT_SEARCH_COPY,
} from "@/features/doctor/content";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: DOCTOR_AREA.patients.title,
  robots: { index: false, follow: false },
};

/**
 * Finding a patient the practitioner is booked to see.
 *
 * ## Nothing is listed until something is searched for
 *
 * There is no "all patients" list on this page, and there is no query that
 * would produce one: `search_care_patients` returns nothing for a term
 * shorter than two characters, so an empty box is not a browse button
 * (`phase_11.md` section 15 — do not load all patients into the browser).
 *
 * ## The scope is on the page, not only in the documentation
 *
 * `phase_11.md` section 16 requires the patient-access model to be chosen
 * explicitly and documented. It is the appointment-linked model, decided in
 * `docs/SECURITY.md` section 6 and enforced by
 * `patients_select_doctor_care` — and a practitioner who cannot find
 * somebody needs to know whether the search failed or the person is simply
 * not theirs, so the page says which.
 *
 * ## Why the search itself is a client island
 *
 * A search term is somebody's name, and a term in a URL reaches browser
 * history on a shared consulting-room machine. `CarePatientSearch` posts to a
 * server action instead; the query, the authorization and the bounds are all
 * still server-side. The reasoning is in that component.
 */
export default async function DoctorPatientsPage() {
  await requirePermission("patients.read.care", "/doctor/patients");

  return (
    <Section aria-labelledby="doctor-patients-heading">
      <Container width="wide">
        <SectionHeader
          as="h1"
          titleId="doctor-patients-heading"
          title={DOCTOR_AREA.patients.heading}
          description={DOCTOR_AREA.patients.description}
        />

        <div className="mt-8">
          <Alert
            tone="info"
            title={DOCTOR_PATIENT_SEARCH_COPY.scopeNotice.title}
          >
            {DOCTOR_PATIENT_SEARCH_COPY.scopeNotice.body}
          </Alert>
        </div>

        <div className="mt-8">
          <CarePatientSearch autoFocus />
        </div>
      </Container>
    </Section>
  );
}
