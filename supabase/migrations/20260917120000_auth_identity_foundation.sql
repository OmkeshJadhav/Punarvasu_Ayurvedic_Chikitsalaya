-- ---------------------------------------------------------------------------
-- Phase 06 - Authentication & Identity Foundation
--
-- The first migration in the project. It introduces exactly what
-- authentication needs and nothing more (`phase_06.md` section 88):
--
--   * public.app_role  - the canonical four-role enum (SECURITY.md section 6)
--   * public.profiles  - one row per authenticated user, holding the role
--   * a trigger that creates the profile when an auth user is created
--   * role resolution and role-immutability enforcement
--   * row-level security, deny by default
--
-- Deliberately NOT here: patients, practitioners, appointments, clinical
-- records. Patient profile fields belong to Phase 07; the permission model
-- belongs to Phase 08. `docs/DATABASE.md` section 4.1 is the specification
-- this implements.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Roles
--
-- A database enum, not free text validated in application code
-- (`DATABASE.md` section 2, rule 6). Four values, exactly matching
-- `SECURITY.md` section 6. `SUPER_ADMIN` is deliberately absent.
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('patient', 'receptionist', 'doctor', 'admin');


-- ---------------------------------------------------------------------------
-- Profiles
--
-- `id` is both the primary key and a foreign key to `auth.users`, so a profile
-- cannot exist without an identity and cannot be re-pointed at a different
-- one. Deleting the auth user removes the profile; nothing clinical hangs off
-- this table yet, so a cascade is safe here and will be reconsidered by the
-- phase that adds records which must outlive an account.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- The basis of all authorization. Defaults to the least-privileged role, so
  -- a row created by any path that forgets to set it is still a patient.
  role public.app_role not null default 'patient',

  -- Display and contact information. Deliberately minimal: registration
  -- collects only what account creation needs (`phase_06.md` sections 7-8),
  -- and no clinical field exists on this table for one to be written into.
  full_name text,
  phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_full_name_length check (
    full_name is null or char_length(full_name) between 1 and 120
  ),
  constraint profiles_phone_length check (
    phone is null or char_length(phone) between 1 and 20
  )
);

comment on table public.profiles is
  'One row per authenticated user. Holds the role, which is the basis of all '
  'authorization. The email address is NOT duplicated here: auth.users owns '
  'it, and a second copy would drift.';

comment on column public.profiles.role is
  'Never self-updatable. Enforced by the profiles_guard_role trigger, not by '
  'RLS alone. Role changes are an audited admin operation (Phase 08).';


-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Role immutability
--
-- `DATABASE.md` section 4.1 requires this to be enforced with a restriction or
-- a trigger, not only with an RLS `USING` clause - because a `USING` clause
-- decides *which rows* may be updated, not *which columns*. A patient passing
-- an RLS check on their own row could otherwise set role = 'admin' in the same
-- statement.
--
-- The trigger raises rather than silently restoring the old value: a request
-- that tried to change its own role is a security event, and it should fail
-- loudly rather than appear to succeed.
--
-- `postgres` and `service_role` are exempt so that migrations and the audited
-- admin operation Phase 08 introduces can still assign roles. Every such use
-- is server-side and preceded by its own authorization check
-- (`DATABASE.md` section 6.4).
-- ---------------------------------------------------------------------------
create function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    raise exception 'A user cannot change their own role.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row
  execute function public.profiles_guard_role();


-- ---------------------------------------------------------------------------
-- Profile creation
--
-- Runs when Supabase Auth creates a user, so a profile always exists for an
-- identity and the application never has to create one lazily from a request.
--
-- The role is hard-coded to 'patient'. It is NOT read from
-- `raw_user_meta_data`, which is supplied by the client at sign-up: a
-- registration form could otherwise ask for the admin role and be given it.
-- Staff accounts are created by an administrator in Phase 08.
--
-- `full_name` and `phone` are read from that same client-supplied metadata,
-- which is acceptable because they are display and contact text with no
-- authorization meaning, and both are length-bounded by the table's
-- constraints.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'patient',
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 20), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- Role resolution for policies
--
-- `security definer` and `stable`, per `DATABASE.md` section 6.2. Marking it
-- `security definer` is what avoids recursive policy evaluation: a policy on
-- `profiles` that queried `profiles` through the caller's own permissions
-- would re-enter itself.
--
-- Nothing in Phase 06 uses this yet. It ships now because it is part of the
-- identity foundation Phase 08 builds authorization on, and because writing it
-- alongside the table keeps the "role comes from the database" rule in one
-- place.
-- ---------------------------------------------------------------------------
create function public.current_app_role()
returns public.app_role
language sql
security definer
stable
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid());
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Enabled with no permissive default, so the table returns zero rows until a
-- policy says otherwise (`DATABASE.md` section 6.1). Policies are written per
-- operation, never `for all`, so "who may delete this?" has to be answered
-- deliberately (section 6.3).
--
-- Answers for this table:
--   SELECT  the user, their own row only.
--   INSERT  nobody. Rows are created by the trigger above, which runs as
--           definer and is therefore not subject to these policies.
--   UPDATE  the user, their own row only, and never the role column.
--   DELETE  nobody. An account is removed through Supabase Auth, and the
--           foreign key cascades.
--
-- Staff and admin read access is deliberately absent. It belongs to Phase 08,
-- with the permission matrix and the audit trail that make it accountable.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);


-- ---------------------------------------------------------------------------
-- Grants
--
-- Table privileges are the first gate; RLS is the second. `anon` receives
-- nothing at all: a signed-out request has no business reading any profile,
-- and relying on RLS alone to express that would be one policy edit away from
-- a leak.
--
-- `update` is granted column by column so the role column is unreachable even
-- before the guard trigger fires. Defence in depth, and it costs one line.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;
