import Link from "next/link";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { QuickStatusAction } from "@/components/reception/appointment-status-actions";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import {
  formatClinicTime,
  formatClinicTimeRange,
  formatDuration,
} from "@/features/appointments/time";
import { SCHEDULE_COPY } from "@/features/reception/content";
import type { ScheduledAppointment } from "@/features/reception/types";
import { formatPhone } from "@/features/patients/format";

/**
 * The day's appointments.
 *
 * ## Two layouts, one data set — not one layout squeezed
 *
 * `docs/DESIGN_SYSTEM.md` section 32 and `phase_10.md` section 48 both say the
 * same thing: on a small screen, turn a dense table into cards rather than
 * shrinking it. Six columns at 320px is unreadable however it is scaled, and a
 * receptionist on a tablet at the desk is a real user rather than a
 * hypothetical one.
 *
 * So below `md` this is a list of cards, and from `md` up it is a real table
 * with a caption, column headers and `scope="col"`. Both render the same
 * appointments from the same props; neither is hidden content the other has to
 * duplicate logic for.
 *
 * ## Why the table is in a `TableScroller`
 *
 * It is focusable and labelled, so a keyboard user can scroll an overflowing
 * table and a screen reader announces what it contains. It is also
 * `position: relative`, which is what keeps an absolutely positioned
 * descendant — a visually hidden label, say — from escaping the scroller and
 * widening the whole document. That was measured in Phase 08 and cost 35px of
 * overflow at 320px before it was fixed.
 *
 * ## What a row shows
 *
 * `phase_10.md` section 7's columns: time, patient, consultation,
 * practitioner, status, and one action. The patient's phone number is on the
 * card but not in the table, because a phone number is what the front desk
 * needs when they are holding a phone — which is the mobile case — and a
 * seventh column is what makes a table unreadable.
 *
 * There is nothing clinical on a row, and there is nothing to filter out:
 * `ScheduledAppointment` has no field for it.
 */
export function ScheduleList({
  appointments,
  caption = SCHEDULE_COPY.tableCaption,
}: {
  readonly appointments: readonly ScheduledAppointment[];
  readonly caption?: string;
}) {
  return (
    <>
      {/* Mobile and small tablet */}
      <ul className="flex flex-col gap-3 md:hidden">
        {appointments.map((appointment) => (
          <li key={appointment.id}>
            <ScheduleCard appointment={appointment} />
          </li>
        ))}
      </ul>

      {/* Desktop */}
      <div className="hidden md:block">
        <TableScroller label={caption}>
          <Table>
            <TableCaption className="sr-only">{caption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{SCHEDULE_COPY.timeHeading}</TableHead>
                <TableHead>{SCHEDULE_COPY.patientHeading}</TableHead>
                <TableHead>{SCHEDULE_COPY.typeHeading}</TableHead>
                <TableHead>{SCHEDULE_COPY.practitionerHeading}</TableHead>
                <TableHead>{SCHEDULE_COPY.statusHeading}</TableHead>
                <TableHead>
                  <span className="sr-only">
                    {SCHEDULE_COPY.actionsHeading}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={appointment.startsAt.toISOString()}>
                      {formatClinicTime(appointment.startsAt)}
                    </time>
                    <span className="text-muted-foreground block">
                      {formatDuration(appointment.durationMinutes)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground font-medium">
                      {appointment.patientName}
                    </span>
                  </TableCell>
                  <TableCell>{appointment.typeName}</TableCell>
                  <TableCell>{appointment.practitionerName}</TableCell>
                  <TableCell>
                    <AppointmentStatusBadge status={appointment.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <QuickStatusAction
                        appointmentId={appointment.id}
                        status={appointment.status}
                      />
                      <OpenLink appointment={appointment} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroller>
      </div>
    </>
  );
}

/** One appointment, for a screen too narrow for a table. */
function ScheduleCard({
  appointment,
}: {
  readonly appointment: ScheduledAppointment;
}) {
  const phone = formatPhone(appointment.patientPhone);

  return (
    <article className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-h5 text-heading font-sans font-medium">
            <time dateTime={appointment.startsAt.toISOString()}>
              {formatClinicTimeRange(appointment.startsAt, appointment.endsAt)}
            </time>
          </p>
          <p className="text-body text-foreground mt-1 wrap-break-word">
            {appointment.patientName}
          </p>
        </div>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      <p className="text-body-sm text-muted-foreground wrap-break-word">
        {appointment.typeName} · {appointment.practitionerName}
      </p>

      {phone ? (
        <p className="text-body-sm">
          {/*
            A tel: link, because on the device this layout is for, ringing the
            patient is the action. 44px tall, because it is a touch target.
          */}
          <a
            href={`tel:${appointment.patientPhone}`}
            className="text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {phone}
          </a>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <QuickStatusAction
          appointmentId={appointment.id}
          status={appointment.status}
        />
        <OpenLink appointment={appointment} />
      </div>
    </article>
  );
}

/**
 * The link to the appointment.
 *
 * The visible label is the same on every row, so the accessible name names the
 * time and the patient. It is an `aria-label` rather than an `sr-only` span
 * because the accessible-name algorithm trims each text node before
 * concatenating them, which produced "Openfor 10:30 am" in Phase 09. The
 * visible text is a prefix of the label, so WCAG 2.5.3 still holds.
 */
function OpenLink({
  appointment,
}: {
  readonly appointment: ScheduledAppointment;
}) {
  return (
    <Link
      href={`/receptionist/schedule/${appointment.id}`}
      aria-label={`${SCHEDULE_COPY.viewLabel} ${formatClinicTime(
        appointment.startsAt,
      )} — ${appointment.patientName}`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {SCHEDULE_COPY.viewLabel}
    </Link>
  );
}
