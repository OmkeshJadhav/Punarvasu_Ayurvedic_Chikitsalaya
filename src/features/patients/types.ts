/**
 * The patient profile domain model.
 *
 * ## The boundary this file exists to hold
 *
 * A patient profile is **demographic and administrative information**. It is
 * not the medical record (`phase_07.md` sections 1 and 8). There is no field
 * here for a diagnosis, a symptom, a medication, an allergy, a history, a
 * treatment, a report or a prescription — and there must not be. Clinical
 * information belongs to the clinical workflows built in later phases, with
 * their own tables, their own policies and their own append-only semantics.
 *
 * That boundary is enforced in three places, because one is not enough: the
 * database has no column for it, the schema in `./validation` strips unknown
 * keys, and `./validation.test.ts` fails if a clinical field name appears in
 * either.
 *
 * ## Why a separate shape from the database row
 *
 * The row is `snake_case` and carries `id`, `profile_id` and both timestamps.
 * None of that is useful to a page, and two of them are internal identifiers a
 * patient should never be shown (`phase_07.md` section 41). Mapping once, in
 * `./queries.ts`, means a component cannot accidentally render a UUID and a
 * later schema change lands in one place.
 */

/**
 * How a patient describes themselves, where they choose to.
 *
 * Optional everywhere, with `undisclosed` as a real option rather than an
 * absence — someone who declines to say has said something, and a blank looks
 * like an unfinished form the product will nag them about.
 *
 * Collected because `docs/DATABASE.md` section 4.2 names it as part of the
 * patient record and Ayurvedic assessment uses it. It is never inferred from a
 * name, never defaulted, and never required (`phase_07.md` section 29).
 */
export const PATIENT_GENDERS = [
  "female",
  "male",
  "other",
  "undisclosed",
] as const;

export type PatientGender = (typeof PATIENT_GENDERS)[number];

/**
 * A patient profile as the application sees it.
 *
 * `fullName` is the only field that is always present. Everything else is
 * optional because a patient should be able to use the clinic having given
 * their name and nothing more (`phase_07.md` section 76).
 *
 * `dateOfBirth` is an ISO `YYYY-MM-DD` calendar date, not a timestamp and not
 * a display string. A birthday is a calendar fact; storing it as an instant
 * makes it shift across a timezone boundary, and storing it formatted makes it
 * unusable for anything but display (`phase_07.md` section 27).
 *
 * There is deliberately no `age` field. Age is derived when it is needed,
 * because a stored one is wrong within a year (section 28).
 */
export interface PatientProfile {
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly phone: string | null;
  /** ISO `YYYY-MM-DD`, or null. */
  readonly dateOfBirth: string | null;
  readonly gender: PatientGender | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly emergencyContactName: string | null;
  readonly emergencyContactRelationship: string | null;
  readonly emergencyContactPhone: string | null;
  readonly preferredLanguage: string | null;
  /**
   * When the record was first created, ISO 8601.
   *
   * The one timestamp that reaches the UI, and only because "a member since"
   * line is information a patient can use (`phase_07.md` section 42).
   * `updated_at` stays server-side: it is operational metadata.
   */
  readonly createdAt: string;
}

/**
 * The result of asking for the signed-in user's profile.
 *
 * A discriminated union rather than `PatientProfile | null`, because "you have
 * not created one yet" and "we could not read it" are different situations
 * that need different screens — an onboarding invitation and an error with a
 * retry (`phase_07.md` sections 65-66). Collapsing them into `null` is how a
 * database outage ends up telling a patient their details were never saved.
 */
export type PatientProfileResult =
  | { readonly status: "found"; readonly profile: PatientProfile }
  | { readonly status: "absent" }
  | { readonly status: "unavailable" };

/** Field name to the single message shown beneath that field. */
export type PatientFieldErrors = Readonly<Record<string, string>>;

/**
 * What the profile server action hands back to `useActionState`.
 *
 * Mirrors `features/auth/types.ts` deliberately: one convention for form
 * results across the application, so a form added later cannot invent a
 * second.
 */
export interface PatientFormState {
  readonly status: "idle" | "error" | "success";
  /** Always safe to render. Never provider or database text. */
  readonly message?: string;
  readonly fieldErrors?: PatientFieldErrors;
  /**
   * The values the user typed, returned after a failure so a validation error
   * does not make somebody retype their address (`docs/PRODUCT_SPEC.md`
   * section 12.1).
   *
   * These are the patient's own submitted values being echoed back into their
   * own form over an authenticated connection. They are never logged.
   */
  readonly values?: Readonly<Record<string, string>>;
}

export const IDLE_PATIENT_FORM_STATE: PatientFormState = { status: "idle" };

export function patientFormError(
  message: string,
  options: {
    readonly fieldErrors?: PatientFieldErrors;
    readonly values?: Readonly<Record<string, string>>;
  } = {},
): PatientFormState {
  return {
    status: "error",
    message,
    ...(options.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
    ...(options.values ? { values: options.values } : {}),
  };
}

export function patientFormSuccess(message: string): PatientFormState {
  return { status: "success", message };
}
