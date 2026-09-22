"use server";

/**
 * Patient profile server actions.
 *
 * ## The sequence every write follows
 *
 *   1. Resolve the authenticated user and check they may write their own
 *      profile. Server-side, verified upstream, role read from the database.
 *   2. Parse the form through the same schema the browser ran. The browser's
 *      result is never trusted (`docs/SECURITY.md` section 2.3).
 *   3. Map the parsed value through the field allowlist in `./queries.ts`.
 *   4. Write as that user, so row-level security applies as well.
 *   5. Return safe copy. Log a category and an opaque user id, nothing else.
 *
 * `phase_07.md` section 48 lists exactly these five, and section 52 asks for
 * them as layers rather than alternatives: the server check and the database
 * policy both hold, so one missing check is not a breach.
 *
 * ## Why step 1 gained a permission check in Phase 08
 *
 * A server action is a public endpoint. It can be invoked directly, without
 * the page that renders the form ever having been loaded, so the guard on
 * `(app)/patient/layout.tsx` protects the *route* and not this. Until Phase 08
 * that meant a doctor or a receptionist could create a patient record for
 * themselves by posting to this action — which `docs/SECURITY.md` section 6
 * rules out, since a staff member who is also a patient uses a separate
 * account.
 *
 * A `profile.write.self` check closes it here, and the Phase 08 migration
 * narrows the `patients` insert and update policies to the patient role so the
 * database closes it too. Ownership is unchanged in both places.
 *
 * The check uses the pure `can()` rather than `assertPermission()`, because
 * this action reports failure as a form state: an action that throws inside a
 * form submission produces a generic error boundary instead of a message
 * beside the control.
 *
 * ## The ownership rule, stated once
 *
 * **No identifier is ever read from the form.** Not a user id, not a profile
 * id, not a role. `profile_id` is taken from the verified session, the insert
 * policy rejects any other value, the update grant does not include the
 * column, and the guard trigger raises if it changes anyway (sections 11-15,
 * 49-51).
 *
 * ## What is never logged
 *
 * Any profile field. Not the name, the phone number, the date of birth, the
 * address or the emergency contact (`phase_07.md` section 79). The structured
 * logger redacts by key name as a safety net, but these actions do not hand it
 * those values in the first place. What is logged is the operation and the
 * user id — opaque, already known to the session, and the only thing that
 * makes a failure diagnosable.
 */

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/authorization/policy";
import { DEFAULT_USER_MESSAGE } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PROFILE_COPY } from "./content";
import { toPatientRecord } from "./queries";
import {
  patientFormError,
  patientFormSuccess,
  type PatientFieldErrors,
  type PatientFormState,
} from "./types";
import { patientProfileSchema } from "./validation";

/*
 * Note for callers: `IDLE_PATIENT_FORM_STATE` lives in `./types`, not here.
 * A `"use server"` module may only export async functions — re-exporting a
 * constant through it is a build error, and the constant is needed by a client
 * component that must not pull the action's server imports with it.
 */

/** The path whose cache is refreshed after a successful write. */
const PROFILE_PATH = "/patient/profile";
const PATIENT_AREA_PATH = "/patient";

/**
 * The form fields, named once.
 *
 * Reading the form through this list rather than iterating `formData` is the
 * first of the allowlist's two gates: a field the form does not define is not
 * read at all, so it cannot reach the schema, let alone the database.
 */
const PROFILE_FORM_FIELDS = [
  "fullName",
  "preferredName",
  "phone",
  "dateOfBirth",
  "gender",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
  "emergencyContactName",
  "emergencyContactRelationship",
  "emergencyContactPhone",
  "preferredLanguage",
] as const;

function readProfileForm(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const name of PROFILE_FORM_FIELDS) {
    const value = formData.get(name);
    // `FormData` can hold files. A file where a name belongs is not a value to
    // coerce; it is a request that does not match the form.
    values[name] = typeof value === "string" ? value : "";
  }

  return values;
}

/**
 * Creates or updates the signed-in user's patient profile.
 *
 * One action for both, because from the patient's point of view there is one
 * operation — "save my details" — and splitting it would mean the client
 * deciding which to call, which is a decision based on state the client cannot
 * be trusted about. The server already knows whether a record exists.
 *
 * ## Idempotency and the refresh-during-onboarding case
 *
 * Two requests can race: a double-submitted onboarding form, a network retry,
 * or a patient who refreshes and submits again (`phase_07.md` section 53).
 * Both would find no existing record and both would insert. The partial unique
 * index on `profile_id` is what actually prevents a second profile; this
 * action turns the resulting unique violation into a second attempt as an
 * update, so the patient sees a saved profile rather than an error for
 * something they did nothing wrong to cause.
 *
 * Checking first and inserting after is *not* sufficient — both requests pass
 * the check. The constraint is the guarantee; this is the recovery.
 */
export async function savePatientProfileAction(
  _previousState: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const user = await getCurrentUser();
  if (!user) {
    // The page above this is behind `requireUser()`, so reaching here means
    // the session expired between render and submit. Saying so plainly beats a
    // generic failure the patient would retry forever.
    logger.warn("patient.profile_save_unauthenticated");
    return patientFormError(
      "Your session has ended. Please sign in again to save your details.",
    );
  }

  // Authorization, independent of the route guard. See the header: this action
  // is reachable without the page that renders the form.
  if (!can(user.role, "profile.write.self")) {
    logger.warn("authz.denied", {
      userId: user.id,
      reason: "permission",
      permission: "profile.write.self",
    });
    // Generic. It does not say which role would have been required
    // (`phase_08.md` section 12).
    return patientFormError(DEFAULT_USER_MESSAGE.forbidden);
  }

  const values = readProfileForm(formData);

  const parsed = patientProfileSchema.safeParse(values);
  if (!parsed.success) {
    return patientFormError(PROFILE_COPY.validationErrorBody, {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values,
    });
  }

  const record = toPatientRecord(parsed.data);

  // Which of the two happened, so the confirmation can say so. The server is
  // the only party that knows; the client cannot be trusted to.
  let created = false;

  try {
    const supabase = await createSupabaseServerClient();

    const { data: updated, error } = await supabase
      .from("patients")
      .update(record)
      .eq("profile_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      logger.error("patient.profile_update_failed", error, {
        userId: user.id,
      });
      return patientFormError(PROFILE_COPY.saveErrorBody, { values });
    }

    // No row updated means there was nothing to update, which is the ordinary
    // onboarding case rather than a failure. Insert instead.
    if (!updated) {
      const failure = await insertIfAbsent(supabase, user.id, record, values);
      if (failure) return failure;
      created = true;
    }
  } catch (error) {
    logger.error("patient.profile_save_error", error, { userId: user.id });
    return patientFormError(PROFILE_COPY.saveErrorBody, { values });
  }

  // The operation and an opaque user id. No profile field is logged - not the
  // name, the number, the date of birth, the address or the emergency contact.
  logger.info(created ? "patient.profile_created" : "patient.profile_updated", {
    userId: user.id,
  });

  // The profile page reads the record on the server, so its cached render has
  // to be discarded or the patient sees the values they just replaced.
  revalidatePath(PROFILE_PATH);
  revalidatePath(PATIENT_AREA_PATH);

  return patientFormSuccess(
    created ? PROFILE_COPY.createSuccessBody : PROFILE_COPY.saveSuccessBody,
  );
}

/**
 * Inserts the profile when the update matched nothing.
 *
 * It inserts rather than checking first and then inserting, because a check
 * followed by an insert is precisely the race this has to survive: two
 * concurrent requests both pass the check. The unique index is the guarantee;
 * the `23505` branch below is the recovery.
 *
 * Split out so the happy path above reads as one sequence. Returns a form
 * state only when it has something to report; `undefined` means "carry on".
 */
async function insertIfAbsent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  record: ReturnType<typeof toPatientRecord>,
  values: Record<string, string>,
): Promise<PatientFormState | undefined> {
  const { error } = await supabase.from("patients").insert({
    // The only place ownership is set, and it comes from the verified session.
    // The insert policy independently requires it to equal `auth.uid()`.
    profile_id: userId,
    ...record,
  });

  if (!error) return undefined;

  // 23505 is a unique violation: a concurrent request created the profile
  // between the update above and this insert. The record is now present, so
  // the patient's own values should be written onto it rather than lost.
  if (error.code === "23505") {
    logger.info("patient.profile_insert_raced", { userId });

    const { error: retryError } = await supabase
      .from("patients")
      .update(record)
      .eq("profile_id", userId);

    if (retryError) {
      logger.error("patient.profile_update_failed", retryError, { userId });
      return patientFormError(PROFILE_COPY.saveErrorBody, { values });
    }

    return undefined;
  }

  logger.error("patient.profile_insert_failed", error, { userId });
  return patientFormError(PROFILE_COPY.saveErrorBody, { values });
}

/**
 * Reduces parser issues to one message per field.
 *
 * A field shows a single error at a time; three stacked messages under one
 * input is noise, and the first is the one the patient acts on. An issue with
 * no path belongs to the form as a whole and is dropped here — the form-level
 * message is already set by the caller.
 */
function toFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): PatientFieldErrors {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
