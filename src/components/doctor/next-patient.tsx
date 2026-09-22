import Link from "next/link";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { PrimaryDoctorAction } from "@/components/doctor/appointment-status-actions";
import { formatClinicTimeRange } from "@/features/appointments/time";
import {
  DOCTOR_SCHEDULE_COPY,
  DOCTOR_TODAY_COPY,
} from "@/features/doctor/content";
import type { DoctorAppointment } from "@/features/doctor/types";
import { isConsultationInProgress } from "@/features/doctor/status";
import { calculateAge } from "@/features/patients/format";

/**
 * Who is with the practitioner now, and who is next.
 *
 * ## Why a panel rather than a card
 *
 * Two cards side by side above a table is the clutter `phase_11.md` sections
 * 3 and 7 warn against. These are two quiet regions on the page's own
 * surface, and the empty state is a sentence rather than an illustration.
 *
 * ## "Now" is a real comparison, not a live indicator
 *
 * The caller works it out with `currentAndNext`, which compares stored
 * instants against the moment the page rendered. There is no ticking clock
 * claiming otherwise and no polling — the panel is exactly as current as the
 * page is (`phase_11.md` section 8).
 *
 * ## What it offers
 *
 * The one action that makes sense for the appointment's state, from the same
 * composed rules the schedule rows and the appointment page use — so
 * "Start consultation" appears here exactly when the database would accept
 * it, and never otherwise. When a consultation is already under way, the
 * panel links into it instead.
 */
export function NextPatientPanel({
  label,
  appointment,
  emptyText,
}: {
  readonly label: string;
  readonly appointment: DoctorAppointment | null;
  readonly emptyText: string;
}) {
  return (
    <div className="border-border bg-muted/40 rounded-lg border p-5">
      <p className="text-caption text-muted-foreground font-sans tracking-wide uppercase">
        {label}
      </p>

      {appointment ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-h5 text-heading font-sans font-medium">
            <time dateTime={appointment.startsAt.toISOString()}>
              {formatClinicTimeRange(appointment.startsAt, appointment.endsAt)}
            </time>
          </p>
          <p className="text-body text-foreground wrap-break-word">
            {appointment.patientName}
            <PatientAge appointment={appointment} />
          </p>
          <p className="text-body-sm text-muted-foreground wrap-break-word">
            {appointment.typeName}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <AppointmentStatusBadge status={appointment.status} />

            {isConsultationInProgress(appointment.status) ? (
              <WorkspaceLink
                href={`/doctor/appointments/${appointment.id}/consultation`}
                label={DOCTOR_TODAY_COPY.nowHeading}
                accessibleName={`Open the consultation with ${appointment.patientName}`}
              />
            ) : (
              <PrimaryDoctorAction
                appointmentId={appointment.id}
                status={appointment.status}
              />
            )}

            <WorkspaceLink
              href={`/doctor/appointments/${appointment.id}`}
              label={DOCTOR_SCHEDULE_COPY.viewLabel}
              accessibleName={`${DOCTOR_SCHEDULE_COPY.viewLabel} ${appointment.patientName}`}
            />
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-muted-foreground mt-2">{emptyText}</p>
      )}
    </div>
  );
}

/**
 * A link that is also a 44px touch target.
 *
 * The accessible name carries the patient's name, because the visible label
 * is generic and a screen-reader user needs to know who it is about. The
 * visible text is a prefix of the label, so WCAG 2.5.3 still holds.
 */
function WorkspaceLink({
  href,
  label,
  accessibleName,
}: {
  readonly href: string;
  readonly label: string;
  readonly accessibleName: string;
}) {
  return (
    <Link
      href={href}
      aria-label={accessibleName}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {label}
    </Link>
  );
}

/** The patient's age, derived from the date of birth and never stored. */
function PatientAge({
  appointment,
}: {
  readonly appointment: DoctorAppointment;
}) {
  if (!appointment.patientDateOfBirth) return null;

  const age = calculateAge(appointment.patientDateOfBirth);
  if (age === null) return null;

  return (
    <span className="text-muted-foreground">
      {" "}
      · {DOCTOR_SCHEDULE_COPY.ageLabel} {age}
    </span>
  );
}
