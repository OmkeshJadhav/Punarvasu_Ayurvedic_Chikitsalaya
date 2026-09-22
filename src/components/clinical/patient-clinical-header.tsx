import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import {
  formatClinicDate,
  formatClinicTimeRange,
} from "@/features/appointments/time";
import { CONSULTATION_WORKSPACE_COPY } from "@/features/clinical/content";
import type {
  ConsultationAppointment,
  ConsultationPatient,
} from "@/features/clinical/types";
import {
  calculateAge,
  formatDateOfBirth,
  formatGender,
  formatPhone,
} from "@/features/patients/format";
import type { PatientGender } from "@/features/patients/types";

/**
 * Who the practitioner is seeing, and which appointment this is.
 *
 * ## Why this is prominent rather than a line of small print
 *
 * `phase_12.md` sections 28-29: clinical data is highly sensitive, the
 * practitioner must be able to satisfy themselves that this is the right
 * patient, and *"avoid relying only on a tiny name label."* Writing an
 * assessment onto the wrong record is a patient-safety failure, not a data
 * failure, and the only defence against it is that the person writing can see
 * who they are writing about without looking for it.
 *
 * So the name is a heading, and beneath it are the three things that
 * distinguish two people with the same name in a small clinic: date of birth,
 * age and phone number.
 *
 * ## Age is derived
 *
 * Section 28 says so explicitly. `calculateAge` reads the date of birth at
 * render time; nothing stores an age, because a stored age is wrong within a
 * year of being written.
 *
 * ## The appointment is context, not content
 *
 * Section 30: show the date, the type, the practitioner and the status — and
 * do not duplicate the entire appointment object into the clinical record.
 * Five fields, read from the appointment, rendered beside the notes and
 * stored nowhere.
 *
 * ## What is not here
 *
 * The patient's address, emergency contact, account identifier or record id.
 * None helps confirm an identity in the room, and each would be one more
 * thing on a screen that gets read over a shoulder.
 */
export function PatientClinicalHeader({
  patient,
  appointment,
}: {
  readonly patient: ConsultationPatient | null;
  readonly appointment: ConsultationAppointment;
}) {
  const age = patient?.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-muted border-border rounded-lg border p-5 sm:p-6">
        {patient ? (
          <>
            <p className="text-caption text-muted-foreground font-sans tracking-wide uppercase">
              {CONSULTATION_WORKSPACE_COPY.patientHeading}
            </p>
            <h2 className="text-h3 text-heading mt-1 font-normal wrap-break-word">
              {patient.preferredName?.trim() || patient.fullName}
            </h2>

            {/*
              The name on the record, when it differs from what the
              practitioner would say out loud. Both are shown, because the
              formal name is what appears on a referral letter and the
              preferred name is what gets used in the room.
            */}
            {patient.preferredName?.trim() &&
            patient.preferredName.trim() !== patient.fullName ? (
              <p className="text-body-sm text-muted-foreground mt-1 wrap-break-word">
                {patient.fullName}
              </p>
            ) : null}

            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              <IdentityFact
                label={CONSULTATION_WORKSPACE_COPY.dateOfBirthLabel}
                value={
                  patient.dateOfBirth
                    ? formatDateOfBirth(patient.dateOfBirth)
                    : null
                }
              />
              <IdentityFact
                label={CONSULTATION_WORKSPACE_COPY.ageLabel}
                value={age === null ? null : `${age}`}
              />
              <IdentityFact
                label={CONSULTATION_WORKSPACE_COPY.genderLabel}
                value={formatGender(toGender(patient.gender))}
              />
              <IdentityFact
                label={CONSULTATION_WORKSPACE_COPY.phoneLabel}
                value={formatPhone(patient.phone)}
              />
            </dl>

            <p className="text-body-sm text-muted-foreground measure mt-4">
              {CONSULTATION_WORKSPACE_COPY.identityHint}
            </p>
          </>
        ) : (
          /*
            It should not happen — the appointment establishes the care
            relationship the patient policy checks — so this is a database
            outage rather than a refusal. A sentence, not an error screen: the
            notes below are still correct and still saveable, and taking the
            whole page away would be the worse failure.
          */
          <p className="text-body-sm text-muted-foreground measure">
            {PATIENT_CONTEXT_UNAVAILABLE}
          </p>
        )}
      </div>

      <ProfileSection
        id="consultation-appointment"
        title={CONSULTATION_WORKSPACE_COPY.appointmentHeading}
        headingLevel="h3"
      >
        <ProfileFieldList>
          <ProfileField
            label={CONSULTATION_WORKSPACE_COPY.whenLabel}
            value={`${formatClinicDate(appointment.startsAt)}, ${formatClinicTimeRange(
              appointment.startsAt,
              appointment.endsAt,
            )}`}
          />
          <ProfileField
            label={CONSULTATION_WORKSPACE_COPY.typeLabel}
            value={appointment.typeName}
          />
        </ProfileFieldList>

        <div className="mt-4">
          <AppointmentStatusBadge status={appointment.status} />
        </div>
      </ProfileSection>
    </div>
  );
}

/** One identity fact. A real `<dt>`/`<dd>` pair inside the header's `<dl>`. */
function IdentityFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div className="min-w-0">
      <dt className="text-caption text-muted-foreground font-sans">{label}</dt>
      <dd className="text-body text-foreground font-sans font-medium wrap-break-word">
        {value}
      </dd>
    </div>
  );
}

/**
 * Narrows the stored string to the gender union.
 *
 * The column is constrained by the database, but it arrives here as a string
 * through a hand-maintained generated type — so an unrecognised value renders
 * as absent rather than as a raw token on a clinical screen.
 */
function toGender(value: string | null): PatientGender | null {
  const known: readonly string[] = ["female", "male", "other", "undisclosed"];
  return value !== null && known.includes(value)
    ? (value as PatientGender)
    : null;
}

const PATIENT_CONTEXT_UNAVAILABLE =
  "We couldn't load this patient's details just now. The appointment below is still correct, and anything you write here will still be saved against the right record.";
