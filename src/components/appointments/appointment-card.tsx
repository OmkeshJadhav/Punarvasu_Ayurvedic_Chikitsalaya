import Link from "next/link";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { APPOINTMENT_COPY } from "@/features/appointments/content";
import {
  formatClinicDate,
  formatClinicTimeRange,
  formatDuration,
} from "@/features/appointments/time";
import type { PatientAppointment } from "@/features/appointments/types";

/**
 * One appointment in a list.
 *
 * A server component: it renders text and a link, and nothing about it needs
 * the browser.
 *
 * ## Why the whole card is not a link
 *
 * `CardLink` exists and would give a larger target, but a card here can carry
 * two actions in later phases (view, and add to calendar), and a stretched
 * link makes a second control inside the card unreachable by pointer. One
 * explicit link, at a full 44px, is the honest version
 * (`docs/DESIGN_SYSTEM.md` section 44).
 *
 * ## The date is a `<time>` element
 *
 * With a machine-readable `dateTime`, so the instant is unambiguous to
 * anything parsing the page, while the visible text stays the clinic's own
 * wall-clock time. A patient must be told the time they need to be in the
 * room, not that instant translated into wherever they happen to be sitting.
 */
export function AppointmentCard({
  appointment,
}: {
  readonly appointment: PatientAppointment;
}) {
  const href = `/patient/appointments/${appointment.id}`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-h5 text-heading font-sans font-medium">
            <time dateTime={appointment.startsAt.toISOString()}>
              {formatClinicDate(appointment.startsAt)}
            </time>
          </p>

          <p className="text-body text-foreground mt-1">
            {formatClinicTimeRange(appointment.startsAt, appointment.endsAt)}
            <span className="text-muted-foreground">
              {" · "}
              {formatDuration(appointment.durationMinutes)}
            </span>
          </p>

          <p className="text-body-sm text-muted-foreground mt-2">
            {appointment.typeName} with {appointment.practitionerName}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <AppointmentStatusBadge status={appointment.status} />

          {/*
            The visible label is "View details", which is the same on every
            card in the list. A screen-reader user moving between links needs
            to know *which* appointment, so the accessible name names the date.

            It is an `aria-label` rather than an `sr-only` span, because the
            accessible-name algorithm trims each text node before concatenating
            them — a span produced "View detailsfor Tuesday…", which is what
            the test below caught. The visible text is a prefix of the label,
            so WCAG 2.5.3 (Label in Name) still holds.
          */}
          <Link
            href={href}
            aria-label={`${APPOINTMENT_COPY.viewLabel} for ${formatClinicDate(
              appointment.startsAt,
            )}`}
            className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {APPOINTMENT_COPY.viewLabel}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
