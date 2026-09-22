import Link from "next/link";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { PrimaryDoctorAction } from "@/components/doctor/appointment-status-actions";
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
  formatClinicDateShort,
  formatClinicTime,
  formatClinicTimeRange,
  formatDuration,
} from "@/features/appointments/time";
import { DOCTOR_SCHEDULE_COPY } from "@/features/doctor/content";
import type { DoctorAppointment } from "@/features/doctor/types";
import { calculateAge } from "@/features/patients/format";

/**
 * A list of the practitioner's appointments.
 *
 * ## Two layouts, one data set — not one layout squeezed
 *
 * `docs/DESIGN_SYSTEM.md` section 32 and `phase_11.md` sections 37-38 say the
 * same thing: on a small screen, turn a dense table into cards rather than
 * shrinking it, and do not shrink a desktop table until it becomes unusable.
 * A practitioner on a tablet between patients is a real user.
 *
 * So below `md` this is a list of cards, and from `md` up it is a real table
 * with a caption, column headers and `scope="col"`. Both render the same
 * appointments from the same props; neither is hidden content the other has
 * to duplicate logic for.
 *
 * ## What a row shows, and what it does not
 *
 * `phase_11.md` section 9's columns — time, patient, consultation type,
 * status, action — plus the patient's age, which is the one piece of context
 * a practitioner reads off a list before the patient is in the room. Age is
 * *derived* from the date of birth, never stored: a stored age is wrong
 * within a year.
 *
 * There is no practitioner column. Every row is this practitioner's, and a
 * column with one value repeated down it is noise.
 *
 * There is nothing clinical on a row, and there is nothing to filter out:
 * `DoctorAppointment` has no field for it.
 *
 * ## Why the table is in a `TableScroller`
 *
 * It is focusable and labelled, so a keyboard user can scroll an overflowing
 * table and a screen reader announces what it contains. It is also
 * `position: relative`, which keeps an absolutely positioned descendant — a
 * visually hidden label, say — from escaping the scroller and widening the
 * whole document. That was measured in Phase 08 and cost 35px of overflow at
 * 320px before it was fixed.
 */
export function DoctorSchedule({
  appointments,
  caption = DOCTOR_SCHEDULE_COPY.tableCaption,
  showDate = false,
}: {
  readonly appointments: readonly DoctorAppointment[];
  readonly caption?: string;
  /**
   * Whether to show the calendar date as well as the time.
   *
   * Off for a single day, on for the appointments list, where rows span
   * weeks and a bare "10:30" says nothing.
   */
  readonly showDate?: boolean;
}) {
  return (
    <>
      {/* Mobile and small tablet */}
      <ul className="flex flex-col gap-3 md:hidden">
        {appointments.map((appointment) => (
          <li key={appointment.id}>
            <ScheduleCard appointment={appointment} showDate={showDate} />
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
                <TableHead>
                  {showDate
                    ? DOCTOR_SCHEDULE_COPY.dateHeading
                    : DOCTOR_SCHEDULE_COPY.timeHeading}
                </TableHead>
                <TableHead>{DOCTOR_SCHEDULE_COPY.patientHeading}</TableHead>
                <TableHead>{DOCTOR_SCHEDULE_COPY.typeHeading}</TableHead>
                <TableHead>{DOCTOR_SCHEDULE_COPY.statusHeading}</TableHead>
                <TableHead>
                  <span className="sr-only">
                    {DOCTOR_SCHEDULE_COPY.actionsHeading}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={appointment.startsAt.toISOString()}>
                      {showDate
                        ? `${formatClinicDateShort(appointment.startsAt)}, ${formatClinicTime(appointment.startsAt)}`
                        : formatClinicTime(appointment.startsAt)}
                    </time>
                    <span className="text-muted-foreground block">
                      {formatDuration(appointment.durationMinutes)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground font-medium">
                      {appointment.patientName}
                    </span>
                    <PatientAge appointment={appointment} block />
                  </TableCell>
                  <TableCell>{appointment.typeName}</TableCell>
                  <TableCell>
                    <AppointmentStatusBadge status={appointment.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <PrimaryDoctorAction
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
  showDate,
}: {
  readonly appointment: DoctorAppointment;
  readonly showDate: boolean;
}) {
  return (
    <article className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-h5 text-heading font-sans font-medium">
            <time dateTime={appointment.startsAt.toISOString()}>
              {showDate
                ? `${formatClinicDateShort(appointment.startsAt)}, ${formatClinicTimeRange(appointment.startsAt, appointment.endsAt)}`
                : formatClinicTimeRange(
                    appointment.startsAt,
                    appointment.endsAt,
                  )}
            </time>
          </p>
          <p className="text-body text-foreground mt-1 wrap-break-word">
            {appointment.patientName}
          </p>
        </div>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      <p className="text-body-sm text-muted-foreground wrap-break-word">
        {appointment.typeName}
        <PatientAge appointment={appointment} />
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryDoctorAction
          appointmentId={appointment.id}
          status={appointment.status}
        />
        <OpenLink appointment={appointment} />
      </div>
    </article>
  );
}

/**
 * The patient's age, derived.
 *
 * Never stored — a stored age is wrong within a year — and rendered with its
 * own label rather than as a bare number, so "34" is never read as anything
 * else. Absent when the date of birth is, rather than showing a dash that
 * looks like a value.
 */
function PatientAge({
  appointment,
  block = false,
}: {
  readonly appointment: DoctorAppointment;
  readonly block?: boolean;
}) {
  if (!appointment.patientDateOfBirth) return null;

  const age = calculateAge(appointment.patientDateOfBirth);
  if (age === null) return null;

  const label = `${DOCTOR_SCHEDULE_COPY.ageLabel} ${age}`;

  return block ? (
    <span className="text-muted-foreground block">{label}</span>
  ) : (
    <span className="text-muted-foreground"> · {label}</span>
  );
}

/**
 * The link to the appointment.
 *
 * The visible label is the same on every row, so the accessible name names
 * the time and the patient. It is an `aria-label` rather than an `sr-only`
 * span because the accessible-name algorithm trims each text node before
 * concatenating them, which produced "Openfor 10:30 am" in Phase 09. The
 * visible text is a prefix of the label, so WCAG 2.5.3 still holds.
 */
function OpenLink({
  appointment,
}: {
  readonly appointment: DoctorAppointment;
}) {
  return (
    <Link
      href={`/doctor/appointments/${appointment.id}`}
      aria-label={`${DOCTOR_SCHEDULE_COPY.viewLabel} ${formatClinicTime(
        appointment.startsAt,
      )} — ${appointment.patientName}`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {DOCTOR_SCHEDULE_COPY.viewLabel}
    </Link>
  );
}
