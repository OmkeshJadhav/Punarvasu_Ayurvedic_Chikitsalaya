/**
 * Creates one confirmed account per role, for local and preview testing.
 *
 *   node scripts/seed-dev-accounts.mjs
 *
 * ## Read this before running it anywhere real
 *
 * This script creates accounts with **well-known, shared credentials**,
 * including an administrator. That is acceptable for a development database
 * that holds synthetic data and is unacceptable anywhere else, so it refuses
 * to run when `APP_ENV=production`.
 *
 * The passwords are in this file deliberately: pretending they are a secret
 * would be worse than being plain about what they are. If this script has ever
 * been pointed at a database that later takes real patient data, **delete
 * these accounts**.
 *
 * ## Why it uses the service-role key
 *
 * Two operations here genuinely cannot be performed as a user
 * (`docs/DATABASE.md` section 6.4):
 *
 *   * creating an account with its address pre-confirmed, so testing does not
 *     depend on email delivery;
 *   * writing `public.user_roles` directly. The application cannot: there is
 *     no insert or update grant and no such policy, and `assign_user_role()`
 *     requires an acting administrator — which is the chicken-and-egg problem
 *     this script exists to solve. Bootstrapping the first administrator is
 *     exactly the "controlled migration/bootstrap" mechanism `phase_08.md`
 *     section 4 permits.
 *
 * Every *ordinary* role change goes through `assign_user_role()` instead, with
 * an acting admin and an audit row. This is the bootstrap, not the mechanism.
 *
 * ## Idempotent
 *
 * Safe to re-run. An existing address is found and its role re-asserted rather
 * than a second account being created. No value from `.env` is ever printed.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

/** The shared password. Not a secret — see the header. */
const DEV_PASSWORD = "Abcde@12345";

const ACCOUNTS = [
  { email: "patient@punarvasu.com", role: "patient", fullName: "Test Patient" },
  {
    email: "receptionist@punarvasu.com",
    role: "receptionist",
    fullName: "Test Receptionist",
  },
  { email: "doctor@punarvasu.com", role: "doctor", fullName: "Test Doctor" },
  { email: "admin@punarvasu.com", role: "admin", fullName: "Test Admin" },
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
  // Shared credentials and a known administrator address. Not in production.
  console.error(
    "Refusing to run: APP_ENV is production. This script creates accounts with shared, well-known passwords.",
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

/** Finds an existing account by address, paging until the list is exhausted. */
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

async function seed({ email, role, fullName }) {
  let user = await findUserByEmail(email);

  if (user) {
    // Re-assert the password and confirmation, so a half-set-up account from
    // an earlier run becomes usable rather than staying broken.
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
  }

  // The registration trigger has already written `role = 'patient'`. This is
  // the bootstrap that promotes the staff accounts; see the header for why it
  // does not go through `assign_user_role()`.
  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({ user_id: user.id, role }, { onConflict: "user_id" });
  if (roleError) throw roleError;

  return user.id;
}

let failed = false;

for (const account of ACCOUNTS) {
  try {
    const id = await seed(account);
    console.log(`${account.email.padEnd(30)} ${account.role.padEnd(13)} ${id}`);
  } catch (error) {
    failed = true;
    console.error(
      `${account.email.padEnd(30)} FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (!failed) {
  console.log(`\nAll four accounts are ready. Password: ${DEV_PASSWORD}`);
}

process.exit(failed ? 1 : 0);
