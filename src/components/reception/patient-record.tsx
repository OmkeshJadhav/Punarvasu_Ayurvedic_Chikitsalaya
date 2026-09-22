import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { Alert } from "@/components/ui/alert";
import {
  calculateAge,
  formatAddressLines,
  formatDateOfBirth,
  formatGender,
  formatPhone,
} from "@/features/patients/format";
import type { PatientGender } from "@/features/patients/types";
import { PATIENT_RECORD_COPY } from "@/features/reception/content";
import type { OperationalPatient } from "@/features/reception/types";

/*
 * `ProfileSection`, `ProfileFieldList` and `ProfileField` live under
 * `components/patient/` because Phase 07 built them there, but nothing about
 * them is profile-specific: they are a titled group and a real `<dl>` with the
 * project's "Not provided" convention, its `min-w-0` overflow fix and its
 * text-only rendering. Phase 09 reused them for the appointment summary and
 * this is the third use, so they have earned a move to `components/shared/` —
 * recorded as deferred rather than done here, because moving a component three
 * areas depend on is a change that belongs on its own.
 */

/**
 * A patient's operational record, as the front desk reads it.
 *
 * ## Everything here is demographic or administrative
 *
 * `phase_10.md` section 14 lists what a receptionist may see and then lists
 * what must not appear beside it. The second list is not filtered out here —
 * `OperationalPatient` has no field for a diagnosis, a note, a prescription or
 * a treatment plan, `public.patients` has no column for one, and Phase 07's
 * migration says none may be added.
 *
 * ## Why the page says so out loud
 *
 * The scope notice is not decoration. A new receptionist looking at a patient
 * record and finding no clinical information has two explanations available:
 * "this account is not allowed to see it" and "it has not loaded". Saying
 * which is how the boundary gets learned rather than worked around.
 *
 * ## Why formatting is reused rather than rewritten
 *
 * `features/patients/format.ts` already renders a date of birth without
 * tripping over timezones, groups a phone number for reading and assembles an
 * address into lines. A second copy here would be a second place for the
 * timezone bug Phase 07 documented at length to come back.
 */
export function PatientRecord({
  patient,
}: {
  readonly patient: OperationalPatient;
}) {
  const addressLines = formatAddressLines(patient);
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;

  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info" title={PATIENT_RECORD_COPY.scopeNotice.title}>
        {PATIENT_RECORD_COPY.scopeNotice.body}
      </Alert>

      <ProfileSection
        id="patient-details"
        title={PATIENT_RECORD_COPY.detailsHeading}
      >
        <ProfileFieldList>
          <ProfileField
            label={PATIENT_RECORD_COPY.nameLabel}
            value={patient.fullName}
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.preferredNameLabel}
            value={patient.preferredName}
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.dateOfBirthLabel}
            value={formatDateOfBirth(patient.dateOfBirth)}
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.ageLabel}
            // Derived, never stored — a stored age is wrong within a year.
            value={age === null ? null : `${age}`}
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.genderLabel}
            value={formatGender(toGender(patient.gender))}
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.languageLabel}
            value={patient.preferredLanguage}
          />
        </ProfileFieldList>
      </ProfileSection>

      <ProfileSection
        id="patient-contact"
        title={PATIENT_RECORD_COPY.contactHeading}
      >
        <ProfileFieldList>
          <ProfileField
            label={PATIENT_RECORD_COPY.phoneLabel}
            value={formatPhone(patient.phone)}
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.addressLabel}
            // Joined rather than rendered as lines, because `ProfileField`
            // renders a value as text — and because an address on a
            // front-desk screen is read across, not down.
            value={addressLines.length > 0 ? addressLines.join(", ") : null}
          />
        </ProfileFieldList>
      </ProfileSection>

      <ProfileSection
        id="patient-emergency"
        title={PATIENT_RECORD_COPY.emergencyHeading}
      >
        <ProfileFieldList>
          <ProfileField
            label={PATIENT_RECORD_COPY.emergencyNameLabel}
            value={patient.emergencyContactName}
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.emergencyRelationshipLabel}
            value={patient.emergencyContactRelationship}
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.emergencyPhoneLabel}
            value={formatPhone(patient.emergencyContactPhone)}
          />
        </ProfileFieldList>
      </ProfileSection>

      <ProfileSection
        id="patient-account"
        title={PATIENT_RECORD_COPY.accountLabel}
      >
        <ProfileFieldList>
          <ProfileField
            label={PATIENT_RECORD_COPY.accountLabel}
            // Whether they can sign in — never which account. The front desk
            // needs the first to know whether to tell somebody to check their
            // email; the second is an identifier it has no use for.
            value={
              patient.hasAccount
                ? PATIENT_RECORD_COPY.hasAccountValue
                : PATIENT_RECORD_COPY.noAccountValue
            }
          />
          <ProfileField
            label={PATIENT_RECORD_COPY.registeredLabel}
            value={formatRegistered(patient.createdAt)}
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

/** "April 2026". Month and year only; the exact second is operational noise. */
function formatRegistered(isoTimestamp: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoTimestamp);
  if (!match) return null;

  const [, year, month] = match;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const name = months[Number(month) - 1];

  return name && year ? `${name} ${year}` : null;
}
