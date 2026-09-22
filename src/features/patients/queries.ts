/**
 * Patient profile data access.
 *
 * ## Every query is scoped to the authenticated user
 *
 * These functions take no user id, and there is no overload that does. That is
 * the point: an identifier that cannot be passed cannot be substituted, so the
 * class of bug where a caller forwards `searchParams.userId` into a query does
 * not exist here (`phase_07.md` sections 11, 46-47).
 *
 * The identity comes from `getCurrentUser()`, which verifies the session with
 * the Auth server rather than decoding a cookie. The query then runs through
 * the user-scoped Supabase client, so row-level security applies as well: even
 * if a filter were wrong, the database would return nothing. Three layers, as
 * `docs/SECURITY.md` section 2.2 asks for, and the phase's section 52 repeats.
 *
 * ## What is not here
 *
 * No delete. Healthcare records carry retention and legal implications that
 * have not been settled (`phase_07.md` section 16, `docs/DATABASE.md` section
 * 13), so there is no delete policy in the database and no function to call
 * one. Account deletion is a privacy workflow for a later phase.
 *
 * No staff or admin access. A receptionist looking up a patient and a doctor
 * reading the record of someone they treat are Phase 08's, together with the
 * permission matrix and audit trail that make them accountable (sections
 * 91-92).
 */

import "server-only";

import { getCurrentUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { PATIENT_GENDERS } from "./types";
import type {
  PatientGender,
  PatientProfile,
  PatientProfileResult,
} from "./types";
import type { PatientProfileInput } from "./validation";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

/**
 * The columns a profile screen needs.
 *
 * Listed rather than `select("*")`, so adding a column to the table does not
 * silently start shipping it to a page — which matters more here than usual,
 * because the columns a later phase adds to a patient record are the sensitive
 * ones (`docs/ARCHITECTURE.md` section 36: return only what the screen needs).
 *
 * `id`, `profile_id` and `updated_at` are excluded: internal identifiers and
 * operational metadata that a patient has no use for (`phase_07.md` section
 * 41).
 */
const PROFILE_COLUMNS = [
  "full_name",
  "preferred_name",
  "phone",
  "date_of_birth",
  "gender",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "postal_code",
  "emergency_contact_name",
  "emergency_contact_relationship",
  "emergency_contact_phone",
  "preferred_language",
  "created_at",
].join(", ");

/**
 * The signed-in user's own patient profile.
 *
 * Returns a discriminated result rather than `null`, so that "you have not
 * created one yet" and "we could not read it" reach different screens. A
 * database outage must not tell a patient their details were never saved.
 *
 * An unauthenticated caller receives `unavailable`, not `absent`: there is no
 * profile to offer to create, and the page above this is behind
 * `requireUser()` anyway.
 */
export async function getPatientProfile(): Promise<PatientProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "unavailable" };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("patients")
      .select(PROFILE_COLUMNS)
      // Belt to RLS's braces. The policy already restricts this to the
      // caller's own row; the filter means a policy mistake would produce no
      // rows rather than somebody else's.
      .eq("profile_id", user.id)
      .maybeSingle<PatientRow>();

    if (error) {
      // The user id is an opaque identifier and is what makes this
      // diagnosable. No profile field is logged — not the name, not the phone
      // number, not the address (`phase_07.md` section 79).
      logger.error("patient.profile_read_failed", error, { userId: user.id });
      return { status: "unavailable" };
    }

    if (!data) return { status: "absent" };

    return { status: "found", profile: toPatientProfile(data) };
  } catch (error) {
    logger.error("patient.profile_read_error", error, { userId: user.id });
    return { status: "unavailable" };
  }
}

/**
 * Whether the signed-in user has a patient profile yet.
 *
 * Used by the patient area to decide between onboarding and the ordinary
 * experience (`phase_07.md` section 6). It deliberately does not answer for
 * `unavailable`: a page that treats a failed read as "no profile" would invite
 * someone to create a second one.
 */
export async function hasPatientProfile(): Promise<boolean> {
  const result = await getPatientProfile();
  return result.status === "found";
}

/**
 * Maps a database row to the domain model.
 *
 * The one place `snake_case` becomes `camelCase`, and the one place a value
 * from the database is narrowed. `gender` is a check-constrained text column,
 * so the generated type is `string`; an unrecognised value is treated as
 * absent rather than cast, because a type assertion here would make the
 * application's type system disagree with the row it is holding.
 */
export function toPatientProfile(row: PatientRow): PatientProfile {
  return {
    fullName: row.full_name,
    preferredName: row.preferred_name,
    phone: row.phone,
    dateOfBirth: row.date_of_birth,
    gender: toPatientGender(row.gender),
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactRelationship: row.emergency_contact_relationship,
    emergencyContactPhone: row.emergency_contact_phone,
    preferredLanguage: row.preferred_language,
    createdAt: row.created_at,
  };
}

function toPatientGender(value: string | null): PatientGender | null {
  return PATIENT_GENDERS.find((gender) => gender === value) ?? null;
}

/**
 * Maps validated input to the columns of a write.
 *
 * **This is the field allowlist** (`phase_07.md` sections 49-50). The object
 * is built key by key from the parsed value; nothing is spread from the
 * request, so a key the schema did not define cannot reach the database even
 * if the schema's `strict()` were relaxed tomorrow. `id`, `profile_id`,
 * `created_at`, `updated_at` and `role` are absent, and the column-level
 * grants in the migration make them unreachable regardless.
 *
 * `undefined` becomes `null` rather than being omitted, so clearing a field in
 * the form clears it in the record. Omitting the key would leave the old value
 * in place, and a patient who deleted their old address would find it still
 * there.
 */
export function toPatientRecord(input: PatientProfileInput) {
  // A relationship with no contact to relate to is a stray value. The schema
  // lets it through without an error, because a message about a field the
  // patient did not mean to fill in is noise; it is dropped here instead.
  const hasEmergencyContact = Boolean(
    input.emergencyContactName && input.emergencyContactPhone,
  );

  return {
    full_name: input.fullName,
    preferred_name: input.preferredName ?? null,
    phone: input.phone ?? null,
    date_of_birth: input.dateOfBirth ?? null,
    gender: input.gender ?? null,
    address_line1: input.addressLine1 ?? null,
    address_line2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postalCode ?? null,
    emergency_contact_name: hasEmergencyContact
      ? (input.emergencyContactName ?? null)
      : null,
    emergency_contact_relationship: hasEmergencyContact
      ? (input.emergencyContactRelationship ?? null)
      : null,
    emergency_contact_phone: hasEmergencyContact
      ? (input.emergencyContactPhone ?? null)
      : null,
    preferred_language: input.preferredLanguage ?? null,
  } as const;
}
