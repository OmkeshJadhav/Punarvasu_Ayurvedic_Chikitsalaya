# Supabase — local development and migrations

This directory holds the Supabase project configuration, the migration
history and the Edge Functions. The database schema itself is defined in
`../docs/DATABASE.md`; the first migration landed in Phase 06 and creates the
identity foundation (`profiles`, the role enum, and its triggers and
policies).

The Supabase CLI is a dev dependency, so the version is pinned in
`package-lock.json` and every developer runs the same tool. Prefix commands
with `npx` (or use the npm scripts below).

## Layout

```text
supabase/
├── config.toml     local stack configuration, committed
├── migrations/     ordered, forward-only SQL migrations, committed
├── functions/      Edge Functions (Deno), committed
└── .temp/          CLI scratch space, git-ignored
```

## Authenticating the CLI

Anything that touches the *hosted* project — deploying a function, pushing
migrations without an explicit `--db-url`, generating types — needs a
**Personal Access Token**. It is account-level and quite separate from the keys
in `.env`: it can manage every project on the account, not just this one.

```bash
npx supabase login
```

That opens a browser, shows a verification code, and stores the token in the
CLI's own credential store. Prefer it: the token never touches the repository.

Where a browser is not available, mint one at
<https://supabase.com/dashboard/account/tokens> and export
`SUPABASE_ACCESS_TOKEN` for the shell. **Do not put it in `.env`.** That file
is the application's configuration and is loaded into the application's
process; a token that can delete projects has no business there.

Most commands also need to know *which* project. Either link once:

```bash
npx supabase link --project-ref <project-ref>   # prompts for the DB password
```

or pass `--project-ref <project-ref>` per command. Linking is worth doing
eventually — it is what lets `npm run db:push` and `npm run db:types` run
without flags.

## Workflow

1. **Create a migration.** Names describe intent, not mechanics.

   ```bash
   npm run db:migration -- create_patient_profiles
   ```

   This writes `supabase/migrations/<timestamp>_create_patient_profiles.sql`.

2. **Write the SQL.** A migration that creates a table holding user or
   clinical data enables Row Level Security and creates its policies *in the
   same migration*. A table must never exist in any environment without its
   policies (`docs/DATABASE.md` section 6.1, section 12).

3. **Apply it locally.**

   ```bash
   npx supabase start      # first time, or after a restart; requires Docker
   npx supabase db reset   # replays every migration from scratch
   ```

   `db reset` is the real test of a migration: it proves the history replays
   cleanly on an empty database, which is what a new environment does.

4. **Regenerate types.**

   ```bash
   npm run db:types
   ```

   This overwrites `src/types/database.ts`. Never edit that file by hand.

5. **Apply to a remote project.**

   ```bash
   npx supabase link --project-ref <project-ref>
   npm run db:push
   ```

## Edge Functions

`functions/send-auth-email/` delivers authentication email through the Supabase
Auth "Send Email" hook, because the built-in sender only reaches members of the
Supabase organisation. Full setup steps, and the trade-offs of the chosen
provider, are in `../docs/progress/progress_phase_06.md`.

```bash
npx supabase functions deploy send-auth-email --project-ref <ref> --no-verify-jwt
npx supabase secrets set NAME=value            # one per required secret
npx supabase functions logs send-auth-email    # after a test send
```

`--no-verify-jwt` is not a shortcut. Supabase Auth calls the hook with a
Standard Webhooks signature rather than a user JWT, so the platform's JWT gate
would reject every legitimate call. Authentication is the signature check
inside the function instead (`functions/send-auth-email/lib.ts`), and it is
what stands between that URL and an open mail relay. Never deploy a function
with `--no-verify-jwt` unless it authenticates callers itself.

The secrets the function needs are listed in `../.env.example` under
"AUTHENTICATION EMAIL". They are **Edge Function secrets, not application
environment variables** — nothing in `src/` reads them.

## Rules

* Every schema change is a committed migration. No manual SQL against a shared
  or production database.
* Migrations are forward-only and ordered. To correct a mistake, write a new
  migration.
* Destructive changes (dropping a column or table holding clinical data)
  destroy patient history. They need an explicit, reviewed decision and a
  migration path for the existing rows.
* RLS policies belong to the migration that creates the table.
* Review migrations with the same care as application code.

## Local credentials

`npx supabase start` prints local URLs and keys. They are local-only
throwaway values, but they still belong in `.env.local`, which is git-ignored -
never in a committed file.
