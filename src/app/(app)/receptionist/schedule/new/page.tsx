import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { StaffBookingFlow } from "@/components/reception/staff-booking-flow";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { BOOKING_RULES } from "@/config/appointments";
import { bookableDates } from "@/features/appointments/availability";
import {
  getActiveAppointmentTypes,
  getWorkingIntervals,
  listSchedulablePractitioners,
} from "@/features/appointments/queries";
import { toClinicIsoDate } from "@/features/appointments/time";
import {
  RECEPTION_AREA,
  STAFF_BOOKING_COPY,
} from "@/features/reception/content";
import { getOperationalPatient } from "@/features/reception/queries";
import type { PatientSearchResult } from "@/features/reception/types";
import { requirePermission } from "@/lib/authorization/guards";
import { uuidSchema } from "@/lib/validation/schemas";

export const metadata: Metadata = {
  title: RECEPTION_AREA.newAppointment.title,
  robots: { index: false, follow: false },
};

/**
 * Booking an appointment on a patient's behalf.
 *
 * ## `?patientId=` is a convenience, and it is still validated
 *
 * Arriving from a patient's record carries the patient through, so the
 * receptionist does not search for somebody they are already looking at. The
 * id is parsed as a UUID and then **loaded** — if it does not resolve to a
 * patient record, the flow simply opens on its own search rather than
 * pre-filling something that does not exist.
 *
 * It is worth being precise about why the id in a URL is acceptable here when
 * a search term is not: an opaque identifier says nothing about a person to
 * anybody reading a log, whereas a name says everything. And it authorizes
 * nothing — `create_appointment_for_patient` validates the patient id against
 * the patients table on every write, whatever this page rendered
 * (`phase_10.md` section 18).
 *
 * ## What the server computes and the client does not
 *
 * The bookable dates, from each practitioner's working week. The client has no
 * business fetching a whole roster's availability just to grey out a Sunday.
 * Times are fetched per day as the receptionist chooses, because that is the
 * only part that changes minute to minute — and through the same endpoint the
 * patient flow uses, which resolves the minimum notice from the caller's role.
 *
 * ## The two honest empty states
 *
 * No practitioner on the scheduling roster, and no consultation type. Both are
 * real states today — the clinic has confirmed no practitioner — and the page
 * says so plainly rather than rendering an empty select. Neither is a
 * permission problem, and the copy says whose job it is to fix.
 */
export default async function NewAppointmentPage({
  searchParams,
}: PageProps<"/receptionist/schedule/new">) {
  await requirePermission(
    "appointments.manage.any",
    "/receptionist/schedule/new",
  );

  const query = await searchParams;
  const requestedPatientId = readParam(query["patientId"]);

  const [appointmentTypes, practitioners, patient] = await Promise.all([
    getActiveAppointmentTypes(),
    listSchedulablePractitioners({ onlineBookableOnly: false }),
    resolvePatient(requestedPatientId),
  ]);

  const heading = (
    <SectionHeader
      as="h1"
      titleId="new-appointment-heading"
      title={RECEPTION_AREA.newAppointment.heading}
      description={RECEPTION_AREA.newAppointment.description}
    />
  );

  if (practitioners.length === 0 || appointmentTypes.length === 0) {
    const noPractitioners = practitioners.length === 0;

    return (
      <Section aria-labelledby="new-appointment-heading">
        <Container width="content">
          {heading}
          <div className="mt-10">
            <EmptyState
              icon={<CalendarClock />}
              title={
                noPractitioners
                  ? STAFF_BOOKING_COPY.noPractitionersTitle
                  : STAFF_BOOKING_COPY.noTypesTitle
              }
              description={
                noPractitioners
                  ? STAFF_BOOKING_COPY.noPractitionersDescription
                  : STAFF_BOOKING_COPY.noTypesDescription
              }
              action={
                <Button asChild variant="secondary">
                  <Link href="/receptionist">Back to today</Link>
                </Button>
              }
            />
          </div>
        </Container>
      </Section>
    );
  }

  const today = toClinicIsoDate(new Date());

  /*
   * One query per practitioner. The roster is a handful of people; if it ever
   * is not, the replacement is one query returning every practitioner's
   * intervals, and the place to make that change is
   * `features/appointments/queries.ts`.
   */
  const datesByPractitioner = Object.fromEntries(
    await Promise.all(
      practitioners.map(async (practitioner) => {
        const intervals = await getWorkingIntervals(practitioner.id);
        return [
          practitioner.id,
          bookableDates({
            workingIntervals: intervals,
            from: today,
            days: BOOKING_RULES.maxHorizonDays + 1,
            maxHorizonDays: BOOKING_RULES.maxHorizonDays,
          }),
        ] as const;
      }),
    ),
  );

  return (
    <Section aria-labelledby="new-appointment-heading">
      <Container width="content">
        {heading}

        <div className="mt-8">
          <StaffBookingFlow
            appointmentTypes={appointmentTypes}
            practitioners={practitioners}
            datesByPractitioner={datesByPractitioner}
            patient={patient}
          />
        </div>
      </Container>
    </Section>
  );
}

/**
 * The patient named in the URL, if there is one and it resolves.
 *
 * Returns `undefined` rather than throwing or redirecting for an id that is
 * malformed or unknown: the flow's first step is a patient search, so "we
 * could not pre-fill that" degrades into "choose the patient", which is where
 * the receptionist was going anyway.
 *
 * `getOperationalPatient` performs its own permission check and runs under the
 * receptionist row-level-security policy, so this is a real read rather than a
 * shape check on a string.
 */
async function resolvePatient(
  patientId: string | undefined,
): Promise<PatientSearchResult | undefined> {
  if (!patientId) return undefined;
  if (!uuidSchema.safeParse(patientId).success) return undefined;

  const result = await getOperationalPatient(patientId);
  if (result.status !== "found") return undefined;

  const { patient } = result;
  return {
    id: patient.id,
    fullName: patient.fullName,
    preferredName: patient.preferredName,
    phone: patient.phone,
    dateOfBirth: patient.dateOfBirth,
    city: patient.city,
    hasAccount: patient.hasAccount,
  };
}

/** One value from a search parameter. A repeated one is discarded entirely. */
function readParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
