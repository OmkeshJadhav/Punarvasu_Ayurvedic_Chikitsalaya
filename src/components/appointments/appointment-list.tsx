import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { AppointmentCard } from "@/components/appointments/appointment-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_COPY } from "@/features/appointments/content";
import type { GroupedAppointments } from "@/features/appointments/types";

/**
 * A patient's appointments, in the three groups the product shows.
 *
 * `phase_09.md` sections 25 and 49: upcoming, past, cancelled, each with its
 * own empty state.
 *
 * ## Why cancelled is its own group rather than folded into past
 *
 * "Did I cancel that?" and "when did I last come in?" are different questions.
 * Mixing them means a patient scanning their history has to read a badge on
 * every row to answer either.
 *
 * ## Why an empty group is omitted rather than shown empty
 *
 * Only *upcoming* renders an empty state, because it is the one a patient
 * arrives to act on — "you have nothing booked, here is how to book" is useful
 * (`docs/PRODUCT_SPEC.md` section 14). Three empty panels on a new patient's
 * first visit would be three ways of saying nothing has happened yet. Past and
 * cancelled appear when there is something in them.
 */
export function AppointmentList({
  groups,
}: {
  readonly groups: GroupedAppointments;
}) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="appointments-upcoming">
        <h2
          id="appointments-upcoming"
          className="text-h4 text-heading font-sans font-medium"
        >
          {APPOINTMENT_COPY.upcomingHeading}
        </h2>

        <div className="mt-4">
          {groups.upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title={APPOINTMENT_COPY.emptyUpcomingTitle}
              description={APPOINTMENT_COPY.emptyUpcomingDescription}
              action={
                <Button asChild>
                  <Link href="/patient/appointments/book">
                    {APPOINTMENT_COPY.bookLabel}
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {groups.upcoming.map((appointment) => (
                <li key={appointment.id}>
                  <AppointmentCard appointment={appointment} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {groups.past.length > 0 ? (
        <section aria-labelledby="appointments-past">
          <h2
            id="appointments-past"
            className="text-h4 text-heading font-sans font-medium"
          >
            {APPOINTMENT_COPY.pastHeading}
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {groups.past.map((appointment) => (
              <li key={appointment.id}>
                <AppointmentCard appointment={appointment} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {groups.cancelled.length > 0 ? (
        <section aria-labelledby="appointments-cancelled">
          <h2
            id="appointments-cancelled"
            className="text-h4 text-heading font-sans font-medium"
          >
            {APPOINTMENT_COPY.cancelledHeading}
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {groups.cancelled.map((appointment) => (
              <li key={appointment.id}>
                <AppointmentCard appointment={appointment} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
