import { Alert } from "@/components/ui/alert";
import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import {
  EMERGENCY_CONTACT_DISCLAIMER,
  PROFILE_FIELDS,
  PROFILE_SECTIONS,
} from "@/features/patients/content";
import {
  formatAddressLines,
  formatDateOfBirth,
  formatGender,
  formatPhone,
} from "@/features/patients/format";
import type { PatientProfile } from "@/features/patients/types";

/**
 * The patient's profile, read-only.
 *
 * Grouped into the same four sections as the form, so moving between viewing
 * and editing does not mean re-learning where anything is
 * (`phase_07.md` sections 17 and 40).
 *
 * Every value is rendered as text. Nothing here is interpreted as markup, so a
 * name containing `<script>` is shown as those characters
 * (`phase_07.md` section 39).
 *
 * No internal identifier appears: no row id, no user id, no `updated_at`
 * (section 41).
 */
export function ProfileSummary({
  profile,
  email,
}: {
  readonly profile: PatientProfile;
  readonly email: string | null;
}) {
  const addressLines = formatAddressLines(profile);

  return (
    <div className="flex flex-col gap-4">
      <ProfileSection
        id="personal"
        title={PROFILE_SECTIONS.personal.title}
        description={PROFILE_SECTIONS.personal.description}
      >
        <ProfileFieldList>
          <ProfileField
            label={PROFILE_FIELDS.fullName.label}
            value={profile.fullName}
          />
          <ProfileField
            label={PROFILE_FIELDS.preferredName.label}
            value={profile.preferredName}
          />
          <ProfileField
            label={PROFILE_FIELDS.dateOfBirth.label}
            value={formatDateOfBirth(profile.dateOfBirth)}
          />
          <ProfileField
            label={PROFILE_FIELDS.gender.label}
            value={formatGender(profile.gender)}
          />
          <ProfileField
            label={PROFILE_FIELDS.preferredLanguage.label}
            value={profile.preferredLanguage}
          />
        </ProfileFieldList>
      </ProfileSection>

      <ProfileSection
        id="contact"
        title={PROFILE_SECTIONS.contact.title}
        description={PROFILE_SECTIONS.contact.description}
      >
        <ProfileFieldList>
          <ProfileField label={PROFILE_FIELDS.email.label} value={email} />
          <ProfileField
            label={PROFILE_FIELDS.phone.label}
            value={formatPhone(profile.phone)}
          />
        </ProfileFieldList>
      </ProfileSection>

      <ProfileSection
        id="address"
        title={PROFILE_SECTIONS.address.title}
        description={PROFILE_SECTIONS.address.description}
      >
        {addressLines.length > 0 ? (
          // A real `<address>`: it is a postal address associated with the
          // page's subject, which is exactly what the element is for. The
          // browser default italic is overridden because the whole address
          // being italic reads as an aside rather than as data.
          <address className="text-body text-foreground not-italic">
            {addressLines.map((line) => (
              <span key={line} className="block break-words">
                {line}
              </span>
            ))}
          </address>
        ) : (
          <ProfileFieldList>
            <ProfileField
              label={PROFILE_FIELDS.addressLine1.label}
              value={null}
            />
          </ProfileFieldList>
        )}
      </ProfileSection>

      <ProfileSection
        id="emergency"
        title={PROFILE_SECTIONS.emergency.title}
        description={PROFILE_SECTIONS.emergency.description}
      >
        <ProfileFieldList>
          <ProfileField
            label={PROFILE_FIELDS.emergencyContactName.label}
            value={profile.emergencyContactName}
          />
          <ProfileField
            label={PROFILE_FIELDS.emergencyContactRelationship.label}
            value={profile.emergencyContactRelationship}
          />
          <ProfileField
            label={PROFILE_FIELDS.emergencyContactPhone.label}
            value={formatPhone(profile.emergencyContactPhone)}
          />
        </ProfileFieldList>

        {/*
          Shown whether or not a contact has been given. Somebody who has
          already entered one is exactly the person who might otherwise assume
          the clinic is watching it (`phase_07.md` section 31).
        */}
        <Alert tone="info" className="mt-5">
          {EMERGENCY_CONTACT_DISCLAIMER}
        </Alert>
      </ProfileSection>
    </div>
  );
}
