/**
 * Makes the development doctor account bookable, for local and preview testing.
 *
 *   node scripts/seed-dev-practitioner.mjs
 *
 * ## Why this is a script and not a migration
 *
 * A migration runs everywhere, including production. Seeding a practitioner
 * there would mean inventing one: Punarvasu has confirmed no practitioner's
 * name, qualifications or registration details, the public directory says so
 * to visitors, and `docs/HEALTHCARE_AND_AI_SAFETY.md` forbids publishing a
 * credential nobody has checked. A working week is the same kind of claim — a
 * patient would arrive on the strength of it.
 *
 * So the migration creates the tables and seeds **nothing**, and this script
 * populates a development database from an account that actually exists:
 * `doctor@punarvasu.com`, created by `seed-dev-accounts.mjs`. The name it
 * writes is that account's own display name, not a clinician's.
 *
 * Practitioner and availability administration is Phase 10/11's, with the
 * staff surfaces that need it (`phase_09.md` sections 10 and 65).
 *
 * ## Why it uses the service-role key
 *
 * `practitioners`, `practitioner_availability` and `schedule_exceptions` have
 * no insert grant for any client role, deliberately — there is no application
 * path to writing them yet. Bootstrapping development data is the "controlled
 * migration/bootstrap" mechanism `docs/DATABASE.md` section 6.4 permits.
 *
 * It refuses to run when `APP_ENV=production`.
 *
 * ## Idempotent
 *
 * Safe to re-run. It upserts the practitioner and replaces the working week
 * rather than accumulating duplicate intervals. No value from `.env` is ever
 * printed.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

/** The account created by `seed-dev-accounts.mjs`. */
const PRACTITIONER_EMAIL = "doctor@punarvasu.com";

/**
 * A development working week. **Not the clinic's hours.**
 *
 * Monday to Saturday, morning and evening, which is a shape that exercises
 * split days, a non-working day (Sunday) and the slot generator's boundaries.
 * The clinic's real opening hours are still unconfirmed — `config/clinic.ts`
 * says so, and the contact page says so to visitors.
 *
 * weekday: 0 = Sunday, matching PostgreSQL `extract(dow)`.
 */
const WORKING_WEEK = [
  { weekday: 1, starts_at: "09:00:00", ends_at: "13:00:00" },
  { weekday: 1, starts_at: "17:00:00", ends_at: "20:00:00" },
  { weekday: 2, starts_at: "09:00:00", ends_at: "13:00:00" },
  { weekday: 2, starts_at: "17:00:00", ends_at: "20:00:00" },
  { weekday: 3, starts_at: "09:00:00", ends_at: "13:00:00" },
  { weekday: 4, starts_at: "09:00:00", ends_at: "13:00:00" },
  { weekday: 4, starts_at: "17:00:00", ends_at: "20:00:00" },
  { weekday: 5, starts_at: "09:00:00", ends_at: "13:00:00" },
  { weekday: 6, starts_at: "09:00:00", ends_at: "13:00:00" },
];

function readEnvFile() {
  const file = path.join(process.cwd(), ".env");
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {};
  }

  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
      .map((line) => {
        const i = line.indexOf("=");
        let value = line.slice(i + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [line.slice(0, i), value];
      }),
  );
}

const fileEnv = readEnvFile();
const env = { ...fileEnv, ...process.env };

if (env.APP_ENV === "production") {
  console.error(
    "Refusing to run: APP_ENV is production. This script writes development scheduling data.",
  );
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  // Names only, never values.
  console.error(
    "Missing configuration. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  const target = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === target,
    );
    if (match) return match;
    if (data.users.length < 200) return null;
  }

  return null;
}

async function main() {
  const user = await findUserByEmail(PRACTITIONER_EMAIL);

  if (!user) {
    console.error(
      `No account for ${PRACTITIONER_EMAIL}. Run "npm run seed:dev-accounts" first.`,
    );
    process.exit(1);
  }

  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "Test Doctor";

  const { data: practitioner, error } = await supabase
    .from("practitioners")
    .upsert(
      {
        profile_id: user.id,
        display_name: displayName,
        is_active: true,
        // Explicitly granted, never implied. The column defaults to false.
        accepts_online_booking: true,
      },
      { onConflict: "profile_id" },
    )
    .select("id")
    .single();

  if (error) throw error;

  // Replaced rather than appended, so re-running does not accumulate
  // duplicate working intervals.
  const { error: clearError } = await supabase
    .from("practitioner_availability")
    .delete()
    .eq("practitioner_id", practitioner.id);
  if (clearError) throw clearError;

  const { error: insertError } = await supabase
    .from("practitioner_availability")
    .insert(
      WORKING_WEEK.map((interval) => ({
        practitioner_id: practitioner.id,
        ...interval,
      })),
    );
  if (insertError) throw insertError;

  console.log(`practitioner   ${practitioner.id}`);
  console.log(`account        ${PRACTITIONER_EMAIL}`);
  console.log(`display name   ${displayName}`);
  console.log(`working week   ${WORKING_WEEK.length} intervals, Mon-Sat`);
  console.log(
    "\nDevelopment scheduling data only. These are NOT the clinic's confirmed hours.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
