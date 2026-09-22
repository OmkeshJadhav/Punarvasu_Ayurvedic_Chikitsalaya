import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, UserRound } from "lucide-react";

import { BookingFlow } from "@/components/appointments/booking-flow";
import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BOOKING_RULES } from "@/config/appointments";
import { CLINIC_CONTACT, addressLines } from "@/config/clinic";
import { bookableDates } from "@/features/appointments/availability";
import {
  BOOKING_COPY,
  BOOKING_REVIEW_NOTICE,
  APPOINTMENTS_AREA,
} from "@/features/appointments/content";
import {
  getBookingOptions,
  getWorkingIntervals,
} from "@/features/appointments/queries";
import { toClinicIsoDate } from "@/features/appointments/time";
import { hasPatientProfile } from "@/features/patients/queries";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: APPOINTMENTS_AREA.book.title,
  robots: { index: false, follow: false },
};

/**
 * Requesting an appointment.
 *
 * ## The order of the checks, and why
 *
 *   1. `requirePermission("appointments.write.self")`. Booking is a capability
 *      of its own, checked on the server, independently of the area guard.
 *   2. **Does this user have a patient record?** `phase_09.md` section 51 asks
 *      for exactly this gate: a patient the clinic cannot identify cannot be
 *      booked. The page invites them to complete their profile rather than
 *      letting them fill in a booking form and be refused at the end of it —
 *      and the database refuses regardless, with `PV007`.
 *   3. **Is there anyone to book?** With no practitioner set up for online
 *      booking there is nothing to choose between, and the page says so
 *      plainly instead of rendering an empty select. That is the honest state
 *      today, because no practitioner has been confirmed by the clinic.
 *
 * ## What the server computes and the client does not
 *
 * The bookable dates. They come from each practitioner's working week, which
 * the client has no business fetching just to grey out a Sunday. Times are
 * fetched per day as the patient chooses, because that is the only part that
 * changes minute to minute.
 *
 * One query per bookable practitioner. The roster is a handful of people; if
 * it ever is not, the replacement is one query returning every practitioner's
 * intervals, and the place to make that change is
 * `features/appointments/queries.ts`.
 */
export default async function BookAppointmentPage() {
  await requirePermission(
    "appointments.write.self",
    "/patient/appointments/book",
  );

  const [profileExists, options] = await Promise.all([
    hasPatientProfile(),
    getBookingOptions(),
  ]);

  const heading = (
    <SectionHeader
      as="h1"
      titleId="book-appointment-heading"
      title={APPOINTMENTS_AREA.book.heading}
      description={APPOINTMENTS_AREA.book.description}
    />
  );

  if (!profileExists) {
    return (
      <Section aria-labelledby="book-appointment-heading">
        <Container width="content">
          {heading}
          <div className="mt-10">
            <EmptyState
              icon={<UserRound />}
              title={BOOKING_COPY.profileRequiredTitle}
              description={BOOKING_COPY.profileRequiredDescription}
              action={
                <Button asChild>
                  <Link href="/patient/profile">
                    {BOOKING_COPY.profileRequiredAction}
                  </Link>
                </Button>
              }
            />
          </div>
        </Container>
      </Section>
    );
  }

  if (
    options.practitioners.length === 0 ||
    options.appointmentTypes.length === 0
  ) {
    return (
      <Section aria-labelledby="book-appointment-heading">
        <Container width="content">
          {heading}
          <div className="mt-10">
            <EmptyState
              icon={<CalendarClock />}
              title={BOOKING_COPY.noPractitionersTitle}
              description={BOOKING_COPY.noPractitionersDescription}
              action={
                CLINIC_CONTACT.phone ? (
                  <Button asChild>
                    <a href={`tel:${CLINIC_CONTACT.phone}`}>Call the clinic</a>
                  </Button>
                ) : undefined
              }
            />
          </div>
        </Container>
      </Section>
    );
  }

  const today = toClinicIsoDate(new Date());

  const datesByPractitioner = Object.fromEntries(
    await Promise.all(
      options.practitioners.map(async (practitioner) => {
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
    <Section aria-labelledby="book-appointment-heading">
      <Container width="content">
        {heading}

        <div className="mt-8 flex flex-col gap-8">
          {/*
            Said to the patient, not only in a source comment. Every phase of
            this project has published the fact that content is unreviewed
            rather than quietly shipping it, and the consultation types,
            durations and notice period here are working defaults the clinic
            has not confirmed.
          */}
          <Alert tone="info" title={BOOKING_REVIEW_NOTICE.title}>
            {BOOKING_REVIEW_NOTICE.body}
          </Alert>

          <p className="text-body-sm text-muted-foreground measure">
            {BOOKING_COPY.noticeSummary(
              Math.round(BOOKING_RULES.minNoticeMinutes / 60),
              BOOKING_RULES.maxHorizonDays,
            )}
          </p>

          <BookingFlow
            appointmentTypes={options.appointmentTypes}
            practitioners={options.practitioners}
            datesByPractitioner={datesByPractitioner}
            locationLines={addressLines(CLINIC_CONTACT.address)}
          />
        </div>
      </Container>
    </Section>
  );
}
