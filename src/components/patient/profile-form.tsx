"use client";

import { useState, type ReactNode } from "react";

import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  EMERGENCY_CONTACT_DISCLAIMER,
  GENDER_OPTIONS,
  NO_CLINICAL_DATA_NOTICE,
  PROFILE_COPY,
  PROFILE_FIELDS,
  PROFILE_SECTIONS,
} from "@/features/patients/content";
import type {
  PatientFieldErrors,
  PatientProfile,
} from "@/features/patients/types";
import { todayIsoDate } from "@/features/patients/validation";
import { useUnsavedChangesWarning } from "@/components/patient/use-unsaved-changes-warning";

/**
 * The profile form.
 *
 * ## How it submits
 *
 * It renders **the** `<form>`, and takes the server action as a prop. The
 * browser posts it, so nothing here fetches, serialises or hand-rolls a
 * request — and Next.js checks `Origin` against `Host` on a server action,
 * which is the CSRF protection this form needs without a token scheme written
 * by hand (`docs/SECURITY.md` section 11).
 *
 * **The form element belongs here, not to the caller.** An earlier revision
 * had the caller render `<form action={...}>` around this component, which
 * then rendered a second `<form>` inside it. Nested forms are invalid HTML:
 * the server-rendered markup parsed as one form, but on hydration React
 * created the inner element through DOM APIs, which permit it — and the inputs
 * then belonged to the inner form, which had no action. Submitting therefore
 * did a plain **GET**, putting the patient's name, date of birth, phone number
 * and address into the URL, where they reach browser history, proxy logs and
 * `Referer` headers. That is the exact failure `phase_07.md` section 83
 * forbids. It was invisible in tests and in review, and was caught by driving
 * the built application in a real browser. One form, owned here, is what
 * prevents it recurring; `profile-form.test` asserts there is exactly one and
 * that it carries an action.
 *
 * ## Why every control is uncontrolled
 *
 * `defaultValue` rather than `value` plus state. The form holds fourteen
 * fields; making each a controlled input would re-render the whole form on
 * every keystroke for no gain, and the values are read from `FormData` on
 * submit either way. The one piece of state that does exist tracks whether
 * anything has changed, for the unsaved-changes warning.
 *
 * ## Error handling
 *
 * Field errors come back from the server and are attached to the field they
 * belong to; `Field` binds them with `aria-describedby`, sets `aria-invalid`
 * and gives the message `role="alert"`, so a failure after submission is
 * announced rather than appearing silently. The values the patient typed are
 * returned with the errors and put back into the form, so a mistyped postal
 * code does not cost them their address (`phase_07.md` section 67).
 *
 * ## What it does not collect
 *
 * Nothing clinical, and no identifier. There is no field for symptoms,
 * diagnosis, medications, allergies or history, and none for a user id, a
 * profile id or a role (sections 8, 50-51, 77).
 */
export interface ProfileFormProps {
  /**
   * The server action this form posts to.
   *
   * Required, and typed as such: a form without one submits by GET, which for
   * this form means the patient's details in the query string.
   */
  readonly formAction: (formData: FormData) => void;
  readonly profile: PatientProfile | null;
  readonly fieldErrors: PatientFieldErrors | undefined;
  /** Values echoed back after a failed submission, keyed by field name. */
  readonly submittedValues: Readonly<Record<string, string>> | undefined;
  readonly pending: boolean;
  readonly submitLabel: string;
  readonly submittingLabel: string;
  /** Omitted during onboarding, where there is nothing to cancel back to. */
  readonly onCancel?: (dirty: boolean) => void;
  /** Rendered above the fields: the form-level result, if there is one. */
  readonly message?: ReactNode;
  readonly email: string | null;
}

export function ProfileForm({
  formAction,
  profile,
  fieldErrors,
  submittedValues,
  pending,
  submitLabel,
  submittingLabel,
  onCancel,
  message,
  email,
}: ProfileFormProps) {
  const [dirty, setDirty] = useState(false);

  // Guards a full page reload or a closed tab. In-app navigation is not
  // guarded — see the hook for why that is the right trade.
  useUnsavedChangesWarning(dirty && !pending);

  /**
   * The value a control starts with.
   *
   * A returned submission wins over the stored record, so a failed save shows
   * what the patient typed rather than silently reverting it. `??` rather than
   * `||`, so a field the patient deliberately cleared stays cleared.
   */
  const initial = (name: keyof PatientProfile, fallback = ""): string =>
    submittedValues?.[name] ?? (profile?.[name] as string | null) ?? fallback;

  const error = (name: string): string | undefined => fieldErrors?.[name];

  return (
    <form
      action={formAction}
      // `onInput` rather than `onChange`: React's `onChange` on a text input
      // fires per keystroke, but `onInput` also catches an autofill, which is
      // how many patients will complete an address.
      onInput={() => {
        if (!dirty) setDirty(true);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      {message}

      <Alert tone="info" title="Contact details only">
        {NO_CLINICAL_DATA_NOTICE}
      </Alert>

      <ProfileSection
        id="personal-fields"
        title={PROFILE_SECTIONS.personal.title}
        description={PROFILE_SECTIONS.personal.description}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="fullName"
            label={PROFILE_FIELDS.fullName.label}
            description={PROFILE_FIELDS.fullName.description}
            error={error("fullName")}
            required
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete={PROFILE_FIELDS.fullName.autoComplete}
                maxLength={120}
                defaultValue={initial("fullName")}
              />
            )}
          </Field>

          <Field
            name="preferredName"
            label={PROFILE_FIELDS.preferredName.label}
            description={PROFILE_FIELDS.preferredName.description}
            error={error("preferredName")}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete={PROFILE_FIELDS.preferredName.autoComplete}
                maxLength={60}
                defaultValue={initial("preferredName")}
              />
            )}
          </Field>

          <Field
            name="dateOfBirth"
            label={PROFILE_FIELDS.dateOfBirth.label}
            description={PROFILE_FIELDS.dateOfBirth.description}
            error={error("dateOfBirth")}
            disabled={pending}
          >
            {(control) => (
              /*
                A native date input, not a custom picker. It is keyboard
                operable, announced correctly, and on a phone it opens the
                platform's own calendar — which is what `phase_07.md` section
                70 asks for. `max` stops most future dates at the control, and
                the schema and a database trigger stop the rest.
              */
              <Input
                {...control}
                type="date"
                autoComplete={PROFILE_FIELDS.dateOfBirth.autoComplete}
                min="1900-01-01"
                max={todayIsoDate()}
                defaultValue={initial("dateOfBirth")}
              />
            )}
          </Field>

          <Field
            name="gender"
            label={PROFILE_FIELDS.gender.label}
            description={PROFILE_FIELDS.gender.description}
            error={error("gender")}
            disabled={pending}
          >
            {(control) => (
              <NativeSelect {...control} defaultValue={initial("gender")}>
                {/* An explicit way back to "not specified". */}
                <option value="">Not specified</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>

          <Field
            name="preferredLanguage"
            label={PROFILE_FIELDS.preferredLanguage.label}
            description={PROFILE_FIELDS.preferredLanguage.description}
            error={error("preferredLanguage")}
            disabled={pending}
            className="sm:col-span-2"
          >
            {(control) => (
              <Input
                {...control}
                autoComplete={PROFILE_FIELDS.preferredLanguage.autoComplete}
                maxLength={60}
                defaultValue={initial("preferredLanguage")}
              />
            )}
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        id="contact-fields"
        title={PROFILE_SECTIONS.contact.title}
        description={PROFILE_SECTIONS.contact.description}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {/*
            The email address is shown, not edited. It is the account identity,
            and changing it means proving control of the new address through
            Supabase Auth's own flow (`phase_07.md` sections 22-23). A disabled
            input would look like a field that might become editable; a value
            with an explanation is honest about what it is.
          */}
          <div className="flex flex-col gap-2">
            <ProfileFieldList>
              <ProfileField label={PROFILE_FIELDS.email.label} value={email} />
            </ProfileFieldList>
            <p className="text-body-sm text-muted-foreground">
              {PROFILE_FIELDS.email.description}
            </p>
          </div>

          <Field
            name="phone"
            label={PROFILE_FIELDS.phone.label}
            description={PROFILE_FIELDS.phone.description}
            error={error("phone")}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                type="tel"
                inputMode="tel"
                autoComplete={PROFILE_FIELDS.phone.autoComplete}
                maxLength={20}
                defaultValue={initial("phone")}
              />
            )}
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        id="address-fields"
        title={PROFILE_SECTIONS.address.title}
        description={PROFILE_SECTIONS.address.description}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="addressLine1"
            label={PROFILE_FIELDS.addressLine1.label}
            error={error("addressLine1")}
            disabled={pending}
            className="sm:col-span-2"
          >
            {(control) => (
              <Input
                {...control}
                autoComplete={PROFILE_FIELDS.addressLine1.autoComplete}
                maxLength={120}
                defaultValue={initial("addressLine1")}
              />
            )}
          </Field>

          <Field
            name="addressLine2"
            label={PROFILE_FIELDS.addressLine2.label}
            error={error("addressLine2")}
            disabled={pending}
            className="sm:col-span-2"
          >
            {(control) => (
              <Input
                {...control}
                autoComplete={PROFILE_FIELDS.addressLine2.autoComplete}
                maxLength={120}
                defaultValue={initial("addressLine2")}
              />
            )}
          </Field>

          <Field
            name="city"
            label={PROFILE_FIELDS.city.label}
            error={error("city")}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete={PROFILE_FIELDS.city.autoComplete}
                maxLength={80}
                defaultValue={initial("city")}
              />
            )}
          </Field>

          {/*
            A free-text state, not a dropdown of Indian states. A list would
            have to be complete and current to be usable, and it would quietly
            exclude a patient who lives abroad — which `phase_07.md` section 26
            rules out.
          */}
          <Field
            name="state"
            label={PROFILE_FIELDS.state.label}
            error={error("state")}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete={PROFILE_FIELDS.state.autoComplete}
                maxLength={80}
                defaultValue={initial("state")}
              />
            )}
          </Field>

          <Field
            name="postalCode"
            label={PROFILE_FIELDS.postalCode.label}
            description={PROFILE_FIELDS.postalCode.description}
            error={error("postalCode")}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                autoComplete={PROFILE_FIELDS.postalCode.autoComplete}
                maxLength={12}
                defaultValue={initial("postalCode")}
              />
            )}
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        id="emergency-fields"
        title={PROFILE_SECTIONS.emergency.title}
        description={PROFILE_SECTIONS.emergency.description}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="emergencyContactName"
            label={PROFILE_FIELDS.emergencyContactName.label}
            error={error("emergencyContactName")}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                maxLength={120}
                defaultValue={initial("emergencyContactName")}
              />
            )}
          </Field>

          <Field
            name="emergencyContactRelationship"
            label={PROFILE_FIELDS.emergencyContactRelationship.label}
            description={
              PROFILE_FIELDS.emergencyContactRelationship.description
            }
            error={error("emergencyContactRelationship")}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                maxLength={60}
                defaultValue={initial("emergencyContactRelationship")}
              />
            )}
          </Field>

          <Field
            name="emergencyContactPhone"
            label={PROFILE_FIELDS.emergencyContactPhone.label}
            error={error("emergencyContactPhone")}
            disabled={pending}
          >
            {(control) => (
              <Input
                {...control}
                type="tel"
                inputMode="tel"
                maxLength={20}
                defaultValue={initial("emergencyContactPhone")}
              />
            )}
          </Field>
        </div>

        <Alert tone="info" className="mt-5">
          {EMERGENCY_CONTACT_DISCLAIMER}
        </Alert>
      </ProfileSection>

      {/*
        The actions, at the end of the form and in the document order a
        keyboard user reaches them. Save is first on a phone so it is the one
        under the thumb; on a wider screen they sit right-aligned in the
        conventional order.
      */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => onCancel(dirty)}
          >
            {PROFILE_COPY.cancelLabel}
          </Button>
        ) : null}

        <Button
          type="submit"
          size="lg"
          loading={pending}
          loadingLabel={submittingLabel}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
