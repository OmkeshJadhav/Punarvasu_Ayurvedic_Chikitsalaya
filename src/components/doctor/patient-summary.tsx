import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { Alert } from "@/components/ui/alert";
import { DOCTOR_PATIENT_COPY } from "@/features/doctor/content";
import type { CarePatient } from "@/features/doctor/types";
import {
  calculateAge,
  formatDateOfBirth,
  formatGender,
  formatMemberSince,
  formatPhone,
} from "@/features/patients/format";
import type { PatientGender } from "@/features/patients/types";

/*
 * `ProfileSection`, `ProfileFieldList` and `ProfileField` live under
 * `components/patient/` because Phase 07 built them there, but nothing about
 * them is profile-specific: they are a titled group and a real `<dl>` with
 * the project's "Not provided" convention, its `min-w-0` overflow fix and its
 * text-only rendering. Phase 09 reused them for the appointment summary,
 * Phase 10 for the operational patient record, and this is the fourth use —
 * so they have long earned a move to `components/shared/`. Recorded as
 * deferred rather than done here, because moving a component four areas
 * depend on is a change that belongs on its own.
 */

/**
 * A patient's context, as the practitioner reads it before a consultation.
 *
 * ## Everything here is demographic or administrative
 *
 * `phase_11.md` sections 14, 17 and 31 list what a doctor may see before a
 * consultation and then list what must not appear beside it. The second list
 * is not filtered out here — `CarePatient` has no field for a diagnosis, a
 * symptom, a medicine, an assessment or a note, `public.patients` has no
 * column for one, and Phase 07's migration says none may be added.
 *
 * Section 31 also says it plainly: **no fabricated health information.**
 * There is none, because there is nothing to fabricate it from.
 *
 * ## Why the page says so out loud
 *
 * A practitioner opening a patient and finding no clinical history has two
 * explanations available: "this patient has none" and "the page is broken".
 * Saying which is how the boundary gets understood rather than worked
 * around, and `phase_11.md` section 18 permits exactly this placeholder:
 * name where clinical records will live, and fabricate nothing.
 *
 * ## Why formatting is reused rather than rewritten
 *
 * `features/patients/format.ts` already renders a date of birth without
 * tripping over timezones, derives an age across a birthday and groups a
 * phone number for reading. A second copy here would be a second place for
 * the timezone bug Phase 07 documented at length to come back.
 */
export function CarePatientSummary({
  patient,
  compact = false,
}: {
  readonly patient: CarePatient;
  /**
   * Drops the clinical notice and the registration date.
   *
   * Used by the consultation page, which carries its own, larger statement
   * about clinical records and does not need the same sentence twice.
   */
  readonly compact?: boolean;
}) {
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;
  const location = [patient.city, patient.state].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-6">
      {compact ? null : (
        <Alert tone="info" title={DOCTOR_PATIENT_COPY.clinicalNotice.title}>
          {DOCTOR_PATIENT_COPY.clinicalNotice.body}
        </Alert>
      )}

      <ProfileSection
        id="care-patient-details"
        title={DOCTOR_PATIENT_COPY.detailsHeading}
      >
        <ProfileFieldList>
          <ProfileField
            label={DOCTOR_PATIENT_COPY.nameLabel}
            value={patient.fullName}
          />
          <ProfileField
            label={DOCTOR_PATIENT_COPY.preferredNameLabel}
            value={patient.preferredName}
          />
          <ProfileField
            label={DOCTOR_PATIENT_COPY.dateOfBirthLabel}
            value={formatDateOfBirth(patient.dateOfBirth)}
          />
          <ProfileField
            label={DOCTOR_PATIENT_COPY.ageLabel}
            // Derived, never stored — a stored age is wrong within a year.
            value={age === null ? null : `${age}`}
          />
          <ProfileField
            label={DOCTOR_PATIENT_COPY.genderLabel}
            value={formatGender(toGender(patient.gender))}
          />
          <ProfileField
            label={DOCTOR_PATIENT_COPY.languageLabel}
            value={patient.preferredLanguage}
          />
        </ProfileFieldList>
      </ProfileSection>

      <ProfileSection
        id="care-patient-contact"
        title={DOCTOR_PATIENT_COPY.contactHeading}
      >
        <ProfileFieldList>
          <ProfileField
            label={DOCTOR_PATIENT_COPY.phoneLabel}
            value={formatPhone(patient.phone)}
          />
          <ProfileField
            label={DOCTOR_PATIENT_COPY.locationLabel}
            // The town, never the street address. No Phase 11 workflow needs
            // a doorstep, so the query does not ask for one.
            value={location === "" ? null : location}
          />
          {compact ? null : (
            <ProfileField
              label={DOCTOR_PATIENT_COPY.registeredLabel}
              value={formatMemberSince(patient.createdAt)}
            />
          )}
        </ProfileFieldList>
      </ProfileSection>

      <ProfileSection
        id="care-patient-emergency"
        title={DOCTOR_PATIENT_COPY.emergencyHeading}
      >
        <ProfileFieldList>
          <ProfileField
            label={DOCTOR_PATIENT_COPY.emergencyNameLabel}
            value={patient.emergencyContactName}
          />
          <ProfileField
            label={DOCTOR_PATIENT_COPY.emergencyRelationshipLabel}
            value={patient.emergencyContactRelationship}
          />
          <ProfileField
            label={DOCTOR_PATIENT_COPY.emergencyPhoneLabel}
            value={formatPhone(patient.emergencyContactPhone)}
          />
        </ProfileFieldList>
      </ProfileSection>
    </div>
  );
}

/**
 * Narrows the database's check-constrained text column.
 *
 * An unrecognised value reads as absent rather than being asserted into the
 * union — a type assertion here would make the application's types disagree
 * with the row it is holding.
 */
function toGender(value: string | null): PatientGender | null {
  const known: readonly string[] = ["female", "male", "other", "undisclosed"];
  return value !== null && known.includes(value)
    ? (value as PatientGender)
    : null;
}
