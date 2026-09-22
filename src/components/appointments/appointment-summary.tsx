import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { APPOINTMENT_COPY } from "@/features/appointments/content";
import {
  formatClinicDate,
  formatClinicDateTime,
  formatClinicTimeRange,
  formatDuration,
} from "@/features/appointments/time";
import type { PatientAppointment } from "@/features/appointments/types";

/*
 * `ProfileSection`, `ProfileFieldList` and `ProfileField` live under
 * `components/patient/` because Phase 07 built them there, but nothing about
 * them is profile-specific: they are a titled group and a real `<dl>` with the
 * project's "Not provided" convention, its `min-w-0` overflow fix and its
 * text-only rendering. Writing a second pair for appointments is exactly the
 * duplication `AGENTS.md` section 32 exists to prevent, so they are reused.
 * If a third area needs them they should move to `components/shared/`.
 */

/**
 * An appointment's details, as a patient reads them.
 *
 * `phase_09.md` sections 26 and 48 list what belongs here: what kind of
 * consultation, with whom, when, how long, where, its status, and a reference.
 *
 * ## What is deliberately absent
 *
 * The internal note. Not filtered here — `authenticated` holds no column grant
 * on it, so it never reaches the application at all, and there is no field on
 * `PatientAppointment` for a component to reach for (section 24).
 *
 * Also absent: the patient's own id, the practitioner's id and the appointment
 * type's id. A patient has no use for an internal identifier
 * (section 55).
 */
export function AppointmentSummary({
  appointment,
  locationLines,
}: {
  readonly appointment: PatientAppointment;
  readonly locationLines: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileSection
        id="appointment-details"
        title={APPOINTMENT_COPY.summaryHeading}
      >
        <ProfileFieldList>
          <ProfileField
            label={APPOINTMENT_COPY.whenLabel}
            value={`${formatClinicDate(appointment.startsAt)}, ${formatClinicTimeRange(
              appointment.startsAt,
              appointment.endsAt,
            )}`}
          />
          <ProfileField
            label={APPOINTMENT_COPY.durationLabel}
            value={formatDuration(appointment.durationMinutes)}
          />
          <ProfileField
            label={APPOINTMENT_COPY.typeLabel}
            value={appointment.typeName}
          />
          <ProfileField
            label={APPOINTMENT_COPY.practitionerLabel}
            value={appointment.practitionerName}
          />
          {locationLines.length > 0 ? (
            <ProfileField
              label={APPOINTMENT_COPY.whereLabel}
              value={locationLines.join(", ")}
            />
          ) : null}
          <ProfileField
            label={APPOINTMENT_COPY.referenceLabel}
            value={appointmentReference(appointment.id)}
          />
          <ProfileField
            label={APPOINTMENT_COPY.requestedOnLabel}
            value={formatClinicDateTime(appointment.createdAt)}
          />
          {appointment.patientNote ? (
            <ProfileField
              label={APPOINTMENT_COPY.noteLabel}
              value={appointment.patientNote}
            />
          ) : null}
          {appointment.cancelledAt ? (
            <ProfileField
              label={APPOINTMENT_COPY.cancelledOnLabel}
              value={formatClinicDateTime(appointment.cancelledAt)}
            />
          ) : null}
          {appointment.cancellationReason ? (
            <ProfileField
              label={APPOINTMENT_COPY.cancellationReasonLabel}
              value={appointment.cancellationReason}
            />
          ) : null}
        </ProfileFieldList>
      </ProfileSection>
    </div>
  );
}

/**
 * A short reference a patient can quote on the phone.
 *
 * The last six characters of the appointment's own id. It is not a secret and
 * it is not an access token: the id it comes from authorizes nothing, because
 * every read of an appointment is restricted by row-level security to the
 * caller's own (`phase_09.md` section 35). Six characters is short enough to
 * read aloud and long enough to distinguish one patient's appointments from
 * each other, which is all it has to do.
 */
export function appointmentReference(appointmentId: string): string {
  return `PNV-${appointmentId.replace(/-/g, "").slice(-6).toUpperCase()}`;
}
