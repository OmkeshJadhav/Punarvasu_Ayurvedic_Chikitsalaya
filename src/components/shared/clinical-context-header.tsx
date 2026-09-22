import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import {
  formatClinicDate,
  formatClinicTime,
} from "@/features/appointments/time";
import {
  calculateAge,
  formatDateOfBirth,
  formatPhone,
} from "@/features/patients/format";

/**
 * Who this is for, and which visit it belongs to.
 *
 * `phase_13.md` sections 80 and 81: the prescription and treatment plan
 * builders must show the patient, the appointment, the doctor and the
 * consultation date, so that documenting the wrong patient takes effort. A
 * hidden identifier is not enough — a practitioner cannot check a uuid
 * against the person in front of them, and a name plus a date of birth is
 * what they can.
 *
 * The age is **derived** from the date of birth rather than stored, because a
 * stored age is wrong within a year.
 *
 * Nothing here is an address, an emergency contact or an account identifier:
 * no prescribing workflow needs a doorstep (the data-minimisation rule
 * Phase 11 set for the doctor's patient reads, applied again).
 */
export function ClinicalContextHeader({
  heading,
  fullName,
  preferredName,
  dateOfBirth,
  phone,
  appointmentHeading,
  appointmentStartsAt,
  appointmentTypeName,
  practitionerName,
  practitionerLabel,
  hint,
  labels,
}: {
  readonly heading: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly dateOfBirth: string | null;
  readonly phone?: string | null;
  readonly appointmentHeading: string;
  readonly appointmentStartsAt: Date;
  readonly appointmentTypeName: string;
  readonly practitionerName?: string | null;
  readonly practitionerLabel?: string;
  readonly hint: string;
  readonly labels: {
    readonly dateOfBirth: string;
    readonly age: string;
    readonly phone: string;
    readonly when: string;
    readonly type: string;
  };
}) {
  const age = dateOfBirth ? calculateAge(dateOfBirth) : null;
  const known = preferredName?.trim() || fullName;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-muted border-border rounded-lg border p-5 sm:p-6">
        <p className="text-caption text-muted-foreground font-sans tracking-wide uppercase">
          {heading}
        </p>
        <h2 className="text-h3 text-heading mt-1 font-normal wrap-break-word">
          {known || "—"}
        </h2>

        {/*
          The formal name as well, when it differs from what the practitioner
          would say out loud: the formal one is what goes on a prescription
          somebody takes to a chemist.
        */}
        {preferredName?.trim() && preferredName.trim() !== fullName ? (
          <p className="text-body-sm text-muted-foreground mt-1 wrap-break-word">
            {fullName}
          </p>
        ) : null}

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Fact
            label={labels.dateOfBirth}
            value={dateOfBirth ? formatDateOfBirth(dateOfBirth) : null}
          />
          <Fact label={labels.age} value={age === null ? null : `${age}`} />
          <Fact
            label={labels.phone}
            value={phone === undefined ? null : formatPhone(phone)}
          />
        </dl>

        <p className="text-body-sm text-muted-foreground measure mt-4">
          {hint}
        </p>
      </div>

      <ProfileSection
        id="clinical-context-appointment"
        title={appointmentHeading}
        headingLevel="h3"
      >
        <ProfileFieldList>
          <ProfileField
            label={labels.when}
            value={`${formatClinicDate(appointmentStartsAt)}, ${formatClinicTime(
              appointmentStartsAt,
            )}`}
          />
          <ProfileField label={labels.type} value={appointmentTypeName} />
          {practitionerName && practitionerLabel ? (
            <ProfileField label={practitionerLabel} value={practitionerName} />
          ) : null}
        </ProfileFieldList>
      </ProfileSection>
    </div>
  );
}

function Fact({
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
