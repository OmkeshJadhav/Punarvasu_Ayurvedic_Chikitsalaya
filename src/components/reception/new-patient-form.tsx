"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ProfileSection } from "@/components/patient/profile-section";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { GENDER_OPTIONS } from "@/features/patients/content";
import { formatDateOfBirth, formatPhone } from "@/features/patients/format";
import { createPatientAction } from "@/features/reception/actions";
import { NEW_PATIENT_COPY } from "@/features/reception/content";
import {
  IDLE_RECEPTION_FORM_STATE,
  type DuplicateCandidate,
} from "@/features/reception/types";

/**
 * Registering a patient at the front desk.
 *
 * ## One form element, owned here
 *
 * Phase 07 shipped a nested `<form>` that hydrated into an inner form with no
 * action, so the patient's details were submitted by **GET** and appeared in
 * the URL. The rule that came out of it is that one component owns the form
 * element, and a test asserts there is exactly one here carrying an action.
 *
 * ## What it can and cannot create
 *
 * A clinic record, and nothing else. There is no field for an email address, a
 * password, a role or an owner, `createPatientSchema` is `strict()` so a
 * request carrying one is rejected rather than stripped, and
 * `create_patient_record` has no parameter for any of them
 * (`phase_10.md` sections 34-35). The page says so to the receptionist as
 * well, because "register a patient" reasonably sounds like it creates an
 * account.
 *
 * ## What it must not collect
 *
 * Anything clinical. There is no field for a symptom, a condition, a medicine
 * or a history, and the form says in words that this is not the place for
 * them — the same sentence the patient's own profile form carries, for the
 * same reason: the only way to keep clinical data out of a demographic table
 * is to give it nowhere to go and to say so.
 *
 * ## Only a name is required
 *
 * A receptionist registering somebody who has just walked in should not be
 * blocked from booking them because they have not been asked for a postcode.
 * Everything else can be added later, from this record or by the patient
 * themselves once they have an account.
 *
 * ## Uncontrolled inputs
 *
 * `defaultValue` rather than `value` plus state — fourteen controlled fields
 * would re-render the form on every keystroke for no gain, and the values are
 * read from `FormData` on submit either way. After a validation failure the
 * server returns what was typed, and it is put back, so a mistyped phone
 * number does not cost the receptionist the address they just took down.
 */
export function NewPatientForm({
  cancelHref,
}: {
  readonly cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(
    createPatientAction,
    IDLE_RECEPTION_FORM_STATE,
  );

  const value = (name: string) => state.values?.[name] ?? "";
  const error = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Alert tone="info" title={NEW_PATIENT_COPY.accountNotice.title}>
        {NEW_PATIENT_COPY.accountNotice.body}
      </Alert>

      {state.duplicates?.length ? (
        <DuplicateWarning candidates={state.duplicates} pending={pending} />
      ) : state.status === "error" && state.message ? (
        <Alert tone="danger" title="We couldn't register that patient">
          {state.message}
        </Alert>
      ) : null}

      <ProfileSection
        id="new-patient-identity"
        title={NEW_PATIENT_COPY.identityHeading}
        description={NEW_PATIENT_COPY.clinicalNotice}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              name="fullName"
              label={NEW_PATIENT_COPY.fullNameLabel}
              description={NEW_PATIENT_COPY.fullNameDescription}
              required
              error={error("fullName")}
            >
              {(control) => (
                <Input
                  autoComplete="off"
                  maxLength={120}
                  defaultValue={value("fullName")}
                  {...control}
                />
              )}
            </Field>
          </div>

          <Field
            name="preferredName"
            label={NEW_PATIENT_COPY.preferredNameLabel}
            error={error("preferredName")}
          >
            {(control) => (
              <Input
                autoComplete="off"
                maxLength={60}
                defaultValue={value("preferredName")}
                {...control}
              />
            )}
          </Field>

          <Field
            name="dateOfBirth"
            label={NEW_PATIENT_COPY.dateOfBirthLabel}
            error={error("dateOfBirth")}
          >
            {(control) => (
              // A native date input: keyboard operable, announced correctly,
              // and on a tablet it opens the platform's own calendar. The same
              // choice the patient's profile form makes.
              <Input
                type="date"
                defaultValue={value("dateOfBirth")}
                {...control}
              />
            )}
          </Field>

          <Field
            name="gender"
            label={NEW_PATIENT_COPY.genderLabel}
            error={error("gender")}
          >
            {(control) => (
              // A native `<select>` rather than the Radix one, because only a
              // native select can carry an empty "not specified" option —
              // Radix reserves the empty string, so a value chosen there could
              // not be unchosen. Nothing about gender may be a one-way door.
              <NativeSelect defaultValue={value("gender")} {...control}>
                <option value="">{NEW_PATIENT_COPY.genderUnspecified}</option>
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
            label={NEW_PATIENT_COPY.languageLabel}
            error={error("preferredLanguage")}
          >
            {(control) => (
              <Input
                autoComplete="off"
                maxLength={60}
                defaultValue={value("preferredLanguage")}
                {...control}
              />
            )}
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        id="new-patient-contact"
        title={NEW_PATIENT_COPY.contactHeading}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="phone"
            label={NEW_PATIENT_COPY.phoneLabel}
            description={NEW_PATIENT_COPY.phoneDescription}
            error={error("phone")}
          >
            {(control) => (
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                maxLength={20}
                defaultValue={value("phone")}
                {...control}
              />
            )}
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        id="new-patient-address"
        title={NEW_PATIENT_COPY.addressHeading}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              name="addressLine1"
              label={NEW_PATIENT_COPY.addressLine1Label}
              error={error("addressLine1")}
            >
              {(control) => (
                <Input
                  autoComplete="off"
                  maxLength={120}
                  defaultValue={value("addressLine1")}
                  {...control}
                />
              )}
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              name="addressLine2"
              label={NEW_PATIENT_COPY.addressLine2Label}
              error={error("addressLine2")}
            >
              {(control) => (
                <Input
                  autoComplete="off"
                  maxLength={120}
                  defaultValue={value("addressLine2")}
                  {...control}
                />
              )}
            </Field>
          </div>

          <Field
            name="city"
            label={NEW_PATIENT_COPY.cityLabel}
            error={error("city")}
          >
            {(control) => (
              <Input
                autoComplete="off"
                maxLength={80}
                defaultValue={value("city")}
                {...control}
              />
            )}
          </Field>

          <Field
            name="state"
            label={NEW_PATIENT_COPY.stateLabel}
            error={error("state")}
          >
            {(control) => (
              <Input
                autoComplete="off"
                maxLength={80}
                defaultValue={value("state")}
                {...control}
              />
            )}
          </Field>

          <Field
            name="postalCode"
            label={NEW_PATIENT_COPY.postalCodeLabel}
            error={error("postalCode")}
          >
            {(control) => (
              <Input
                autoComplete="off"
                maxLength={12}
                defaultValue={value("postalCode")}
                {...control}
              />
            )}
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        id="new-patient-emergency"
        title={NEW_PATIENT_COPY.emergencyHeading}
        description={NEW_PATIENT_COPY.emergencyDescription}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="emergencyContactName"
            label={NEW_PATIENT_COPY.emergencyNameLabel}
            error={error("emergencyContactName")}
          >
            {(control) => (
              <Input
                autoComplete="off"
                maxLength={120}
                defaultValue={value("emergencyContactName")}
                {...control}
              />
            )}
          </Field>

          <Field
            name="emergencyContactRelationship"
            label={NEW_PATIENT_COPY.emergencyRelationshipLabel}
            error={error("emergencyContactRelationship")}
          >
            {(control) => (
              <Input
                autoComplete="off"
                maxLength={60}
                defaultValue={value("emergencyContactRelationship")}
                {...control}
              />
            )}
          </Field>

          <Field
            name="emergencyContactPhone"
            label={NEW_PATIENT_COPY.emergencyPhoneLabel}
            error={error("emergencyContactPhone")}
          >
            {(control) => (
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                maxLength={20}
                defaultValue={value("emergencyContactPhone")}
                {...control}
              />
            )}
          </Field>
        </div>
      </ProfileSection>

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Button
          type="submit"
          size="lg"
          loading={pending}
          loadingLabel={NEW_PATIENT_COPY.submittingLabel}
        >
          {NEW_PATIENT_COPY.submitLabel}
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={cancelHref}>{NEW_PATIENT_COPY.cancelLabel}</Link>
        </Button>
      </div>
    </form>
  );
}

/**
 * Possible duplicates, and the two ways out of them.
 *
 * ## It warns; it never merges and never blocks
 *
 * `phase_10.md` section 33 and its example 7. The receptionist sees what
 * already exists and decides: open one of these records, or say this is
 * somebody else. Automatically merging on a name match would attach one
 * person's appointments to another person's record, which is far worse than
 * the duplicate it would prevent.
 *
 * ## Why "register anyway" is a submit button carrying its own value
 *
 * `<button type="submit" name="duplicateAcknowledged" value="1">` contributes
 * its name and value to the submission when it is the button that submitted —
 * that is what a submit button has always done. So the acknowledgement needs
 * no state, no hidden field kept in sync, and no chance of the flag and the
 * click disagreeing about which submission they belong to. The ordinary submit
 * button carries no such field, so it submits without the acknowledgement and
 * the warning appears again.
 *
 * ## Announced
 *
 * `role="alert"` via `Alert`'s warning tone, so a receptionist who has just
 * submitted is told the form did not go through rather than being left to
 * notice.
 */
function DuplicateWarning({
  candidates,
  pending,
}: {
  readonly candidates: readonly DuplicateCandidate[];
  readonly pending: boolean;
}) {
  return (
    <Alert tone="warning" title={NEW_PATIENT_COPY.duplicateTitle}>
      <div className="flex flex-col gap-4">
        <p>{NEW_PATIENT_COPY.duplicateBody}</p>

        <ul className="flex flex-col gap-3">
          {candidates.map((candidate) => (
            <li
              key={candidate.id}
              className="border-border bg-card flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-body text-foreground font-medium wrap-break-word">
                  {candidate.fullName}
                </p>
                <p className="text-body-sm text-muted-foreground wrap-break-word">
                  {formatPhone(candidate.phone) ?? "No phone"}
                  {candidate.dateOfBirth
                    ? ` · ${formatDateOfBirth(candidate.dateOfBirth)}`
                    : ""}
                </p>
                <p className="text-caption text-muted-foreground">
                  {candidate.matchReason === "phone"
                    ? NEW_PATIENT_COPY.duplicateReasonPhone
                    : NEW_PATIENT_COPY.duplicateReasonNameDob}
                </p>
              </div>

              <Link
                href={`/receptionist/patients/${candidate.id}`}
                aria-label={`${NEW_PATIENT_COPY.duplicateOpenLabel} ${candidate.fullName}`}
                className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 shrink-0 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {NEW_PATIENT_COPY.duplicateOpenLabel}
              </Link>
            </li>
          ))}
        </ul>

        <div>
          <Button
            type="submit"
            name="duplicateAcknowledged"
            value="1"
            variant="secondary"
            loading={pending}
            loadingLabel={NEW_PATIENT_COPY.submittingLabel}
          >
            {NEW_PATIENT_COPY.duplicateContinueLabel}
          </Button>
        </div>
      </div>
    </Alert>
  );
}
