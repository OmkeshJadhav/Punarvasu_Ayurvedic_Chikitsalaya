import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { PatientRecord } from "@/components/reception/patient-record";
import { ScheduleList } from "@/components/reception/schedule-list";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  NEW_PATIENT_COPY,
  PATIENT_RECORD_COPY,
  RECEPTION_AREA,
} from "@/features/reception/content";
import {
  getOperationalPatient,
  getPatientAppointments,
  splitPatientAppointments,
} from "@/features/reception/queries";
import type { ScheduledAppointment } from "@/features/reception/types";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the patient's name. A page title reaches browser history, the tab
  // strip and a screen share, and a front-desk machine is read over shoulders.
  title: RECEPTION_AREA.patient.title,
  robots: { index: false, follow: false },
};

/**
 * One patient's operational record.
 *
 * ## The id in the URL is a filter, not a key to the door
 *
 * `getOperationalPatient` checks the permission and runs under the
 * receptionist row-level-security policy. A receptionist is authorized for the
 * clinic's patients, so unlike the patient case there is no row this id could
 * reach that the policy would not have allowed anyway — and for any other
 * role, the policy returns nothing whatever the id says.
 *
 * ## What is here, and what has no source
 *
 * Name, contact details, date of birth, address, emergency contact, and this
 * patient's appointments. `phase_10.md` section 14 lists exactly that, and
 * then lists what must not appear beside it — a diagnosis, a doctor's note, a
 * prescription, a treatment plan. None of those is filtered out on this page:
 * `public.patients` has no column for one, `OperationalPatient` has no field
 * for one, and the page says so to the receptionist rather than leaving the
 * absence to be read as a loading failure.
 *
 * ## Appointments are bounded
 *
 * The twenty most recent. A long-standing patient's whole history is not
 * something a front desk reads in one sitting, and an unbounded query on a
 * page that renders every row is how a screen becomes slow years after it was
 * written (`phase_10.md` sections 50-51).
 */
export default async function ReceptionPatientPage({
  params,
  searchParams,
}: PageProps<"/receptionist/patients/[id]">) {
  await requirePermission(
    "patients.read.operational",
    "/receptionist/patients",
  );

  const { id } = await params;
  const query = await searchParams;
  const result = await getOperationalPatient(id);

  if (result.status === "unavailable") {
    return (
      <PatientShell>
        <ErrorState
          title={PATIENT_RECORD_COPY.loadErrorTitle}
          description={PATIENT_RECORD_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/receptionist/patients/${id}`}>
                {PATIENT_RECORD_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </PatientShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <PatientShell>
        <EmptyState
          title={PATIENT_RECORD_COPY.notFoundTitle}
          description={PATIENT_RECORD_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/receptionist/patients">
                {PATIENT_RECORD_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </PatientShell>
    );
  }

  const { patient } = result;
  const appointments = await getPatientAppointments(patient.id);
  // Split in the feature layer rather than here, so the impure "what time is
  // it" call lives outside the component — which React's purity rule requires
  // and which also makes the split testable without a clock.
  const { upcoming, past: recent } = splitPatientAppointments(appointments);

  const justCreated = query["created"] === "1";

  return (
    <PatientShell>
      <div className="flex flex-col gap-8">
        {justCreated ? (
          <Alert tone="success" title={NEW_PATIENT_COPY.successTitle}>
            {NEW_PATIENT_COPY.successBody}
          </Alert>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-h3 text-heading font-normal wrap-break-word">
            {patient.preferredName?.trim() || patient.fullName}
          </h2>
          <div className="shrink-0">
            <Button asChild>
              <Link href={`/receptionist/schedule/new?patientId=${patient.id}`}>
                {PATIENT_RECORD_COPY.bookLabel}
              </Link>
            </Button>
          </div>
        </div>

        <PatientRecord patient={patient} />

        <section aria-labelledby="reception-patient-upcoming">
          <h2
            id="reception-patient-upcoming"
            className="text-h4 text-heading font-sans font-medium"
          >
            {PATIENT_RECORD_COPY.upcomingHeading}
          </h2>
          <div className="mt-4">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarClock />}
                title={PATIENT_RECORD_COPY.upcomingHeading}
                description={PATIENT_RECORD_COPY.upcomingEmpty}
                action={
                  <Button asChild>
                    <Link
                      href={`/receptionist/schedule/new?patientId=${patient.id}`}
                    >
                      {PATIENT_RECORD_COPY.bookLabel}
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ScheduleList
                appointments={upcoming}
                caption={PATIENT_RECORD_COPY.upcomingCaption}
              />
            )}
          </div>
        </section>

        {recent.length > 0 ? (
          <RecentAppointments appointments={recent} />
        ) : null}
      </div>
    </PatientShell>
  );
}

function RecentAppointments({
  appointments,
}: {
  readonly appointments: readonly ScheduledAppointment[];
}) {
  return (
    <section aria-labelledby="reception-patient-recent">
      <h2
        id="reception-patient-recent"
        className="text-h4 text-heading font-sans font-medium"
      >
        {PATIENT_RECORD_COPY.recentHeading}
      </h2>
      <div className="mt-4">
        <ScheduleList
          appointments={appointments}
          caption={PATIENT_RECORD_COPY.recentCaption}
        />
      </div>
    </section>
  );
}

/**
 * The page frame, shared by all three outcomes.
 *
 * It owns the `<h1>` so every state has exactly one, including the two that
 * render an error rather than a patient. The `<h1>` is generic — "Patient" —
 * and the person's name is an `<h2>` below it, so the document outline does
 * not put somebody's name in the place a screen reader announces first and a
 * tab title mirrors.
 */
function PatientShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <Section aria-labelledby="reception-patient-heading">
      <Container width="content">
        <Link
          href="/receptionist/patients"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {RECEPTION_AREA.patients.title}
        </Link>

        <h1
          id="reception-patient-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {RECEPTION_AREA.patient.title}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
