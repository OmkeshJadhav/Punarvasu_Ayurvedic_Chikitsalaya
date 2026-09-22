-- ---------------------------------------------------------------------------
-- Phase 07 - Patient Profile & Onboarding
--
-- The patient's *demographic and administrative* record. It is deliberately
-- not the medical record: there is no column here for a diagnosis, a symptom,
-- a medication, an allergy, a history, a note or a prescription, and the
-- surest way to keep clinical data out of a demographic table is to give it
-- nowhere to go (`phase_07.md` sections 1, 8 and 77).
--
-- Clinical records arrive in later phases as their own tables, referencing
-- `patients.id`, with their own policies and their own append-only semantics
-- (`docs/DATABASE.md` sections 4.6-4.11).
--
-- ## Why `patients` and not `patient_profiles`
--
-- `phase_07.md` section 56 offers `patient_profiles` as *a possible name* and
-- says to use the actual architecture where a different one was established.
-- One was: `docs/DATABASE.md` section 4.2 defines this entity as `patients`,
-- keyed to `profiles.id` through `profile_id`, and every later table in that
-- document references `patient_id`. Naming it something else here would mean
-- renaming it, or living with two vocabularies, the moment appointments land.
--
-- ## Why `profile_id` is nullable
--
-- `DATABASE.md` section 4.2 is explicit: a patient may exist before a login
-- does, because a receptionist registers a walk-in. The link is therefore
-- nullable and claimed later. Nothing in this phase creates an unlinked row -
-- there is no staff surface yet - but the column is shaped for it now so that
-- the phase which adds one is not a migration of live patient data.
--
-- Uniqueness is enforced by a *partial* unique index rather than a plain
-- `unique` constraint, so "at most one patient record per user" holds while
-- many unlinked walk-in records remain possible.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------------
create table public.patients (
  id uuid primary key default gen_random_uuid(),

  -- The owner. `on delete cascade` matches `profiles`, which itself cascades
  -- from `auth.users`: deleting an account removes the demographic record with
  -- it. The phase that adds clinical records must revisit this - history that
  -- has to outlive an account cannot hang off a cascading chain
  -- (`phase_07.md` section 16, `DATABASE.md` section 13).
  profile_id uuid references public.profiles (id) on delete cascade,

  -- The only required field. Everything else is optional, because a patient
  -- should be able to use the clinic having told it their name and nothing
  -- more (`phase_07.md` sections 7 and 76).
  full_name text not null,
  preferred_name text,

  phone text,
  date_of_birth date,

  -- Self-described, optional, and with an explicit "prefer not to say".
  -- `phase_07.md` section 29 permits collection only where there is a clear
  -- requirement; `DATABASE.md` section 4.2 names it as part of this record,
  -- and Ayurvedic assessment uses it. Check-constrained rather than free text
  -- (`DATABASE.md` section 2, rule 6). It is never inferred, never defaulted,
  -- and never required.
  gender text,

  -- Structured rather than one free-text block, because appointment reminders,
  -- clinic catchment and any future correspondence need the parts
  -- (`phase_07.md` section 25). No country column: the clinic serves one
  -- country today and `state`/`postal_code` are shaped to take an
  -- international value without one (section 26).
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,

  -- Kept distinct from the patient's own contact details (section 30). This is
  -- someone to call *about* the patient; it is not a channel Punarvasu
  -- monitors, and the UI says so (section 31).
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,

  preferred_language text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Bounds, so no column can take unbounded input even if a caller skips
  -- validation (`phase_07.md` section 54: do not rely only on TypeScript).
  constraint patients_full_name_length check (
    char_length(btrim(full_name)) between 1 and 120
  ),
  constraint patients_preferred_name_length check (
    preferred_name is null or char_length(preferred_name) between 1 and 60
  ),
  constraint patients_phone_length check (
    phone is null or char_length(phone) between 1 and 20
  ),
  constraint patients_gender_allowed check (
    gender is null or gender in ('female', 'male', 'other', 'undisclosed')
  ),
  constraint patients_address_line1_length check (
    address_line1 is null or char_length(address_line1) between 1 and 120
  ),
  constraint patients_address_line2_length check (
    address_line2 is null or char_length(address_line2) between 1 and 120
  ),
  constraint patients_city_length check (
    city is null or char_length(city) between 1 and 80
  ),
  constraint patients_state_length check (
    state is null or char_length(state) between 1 and 80
  ),
  constraint patients_postal_code_length check (
    postal_code is null or char_length(postal_code) between 3 and 12
  ),
  constraint patients_emergency_name_length check (
    emergency_contact_name is null
    or char_length(emergency_contact_name) between 1 and 120
  ),
  constraint patients_emergency_relationship_length check (
    emergency_contact_relationship is null
    or char_length(emergency_contact_relationship) between 1 and 60
  ),
  constraint patients_emergency_phone_length check (
    emergency_contact_phone is null
    or char_length(emergency_contact_phone) between 1 and 20
  ),
  constraint patients_preferred_language_length check (
    preferred_language is null
    or char_length(preferred_language) between 1 and 60
  ),

  -- A lower bound only. "Not in the future" cannot live in a check constraint
  -- because PostgreSQL requires check expressions to be immutable and
  -- `current_date` is not; it is enforced by the trigger below instead.
  constraint patients_date_of_birth_lower_bound check (
    date_of_birth is null or date_of_birth >= date '1900-01-01'
  )
);

comment on table public.patients is
  'Demographic and administrative patient record. NOT the medical record: no '
  'diagnosis, symptom, medication, allergy, history or note column exists '
  'here, and clinical data must never be added to this table. Clinical '
  'records are separate tables referencing patients.id.';

comment on column public.patients.profile_id is
  'The owning user. Nullable because a receptionist may register a walk-in '
  'before that person has a login; the link is claimed later. At most one '
  'linked record per user, enforced by patients_profile_id_key.';

comment on column public.patients.date_of_birth is
  'A date, not a formatted string. Age is derived when needed and never '
  'stored, because a stored age is wrong within a year.';


-- ---------------------------------------------------------------------------
-- Indexes
--
-- One index, and it earns its place twice: it enforces "at most one patient
-- record per user" and it serves the only query this phase makes - the
-- authenticated user looking up their own record. Staff search indexes belong
-- to the phase that builds staff search (`phase_07.md` section 88).
-- ---------------------------------------------------------------------------
create unique index patients_profile_id_key
  on public.patients (profile_id)
  where profile_id is not null;


-- ---------------------------------------------------------------------------
-- updated_at
--
-- Reuses `public.set_updated_at()` from the Phase 06 migration rather than
-- defining a second copy. The timestamp is set by the database, so a client
-- cannot supply one (`phase_07.md` sections 57-58).
-- ---------------------------------------------------------------------------
create trigger patients_set_updated_at
  before update on public.patients
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Ownership immutability
--
-- The column-level `update` grant below already makes `id` and `profile_id`
-- unreachable for an ordinary caller. This trigger is the second layer, for
-- the same reason `profiles_guard_role` exists: a grant is one `grant`
-- statement away from being widened, and re-pointing a patient record at
-- another user is the single worst write this table can take.
--
-- It raises rather than silently restoring the old value. A request that tried
-- to change a record's owner is a security event and should fail loudly.
-- ---------------------------------------------------------------------------
create function public.patients_guard_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.id is distinct from old.id
      or new.profile_id is distinct from old.profile_id)
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    raise exception 'A patient record cannot be re-assigned to another user.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger patients_guard_ownership
  before update on public.patients
  for each row
  execute function public.patients_guard_ownership();


-- ---------------------------------------------------------------------------
-- Date-of-birth sanity
--
-- A future date of birth is a data-integrity error, not a matter of taste, and
-- `phase_07.md` sections 27 and 38 ask for it to be rejected. It lives in a
-- trigger because a check constraint may not call `current_date`.
--
-- Deliberately permissive at the far end: it rejects tomorrow, not an
-- implausible-but-possible great age. Refusing to register a 112-year-old
-- would be a worse failure than accepting one.
-- ---------------------------------------------------------------------------
create function public.patients_validate_date_of_birth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_of_birth is not null and new.date_of_birth > current_date then
    raise exception 'Date of birth cannot be in the future.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger patients_validate_date_of_birth
  before insert or update on public.patients
  for each row
  execute function public.patients_validate_date_of_birth();


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Enabled with no permissive default: the table returns zero rows until a
-- policy says otherwise (`DATABASE.md` section 6.1). Policies are per
-- operation, never `for all`, so each question is answered deliberately
-- (section 6.3).
--
--   SELECT  the owner, their own row only.
--   INSERT  the owner, and only a row whose profile_id is their own id - so a
--           client cannot create a record belonging to somebody else
--           (`phase_07.md` section 14).
--   UPDATE  the owner, their own row only, both before and after the write.
--           `with check` matters as much as `using`: without it a row could
--           pass the check on the way in and be written pointing elsewhere.
--   DELETE  nobody. Healthcare records carry retention and legal implications
--           and the deletion policy has not been decided
--           (`phase_07.md` section 16, `DATABASE.md` section 13). An account
--           removed through Supabase Auth still cascades.
--
-- Receptionist, doctor and admin access is deliberately absent. `phase_07.md`
-- sections 91-92 rule it out for this phase; it belongs with the permission
-- matrix and the audit trail that make it accountable (Phase 08).
-- ---------------------------------------------------------------------------
alter table public.patients enable row level security;

create policy patients_select_own
  on public.patients
  for select
  to authenticated
  using (profile_id is not null and profile_id = (select auth.uid()));

create policy patients_insert_own
  on public.patients
  for insert
  to authenticated
  with check (profile_id is not null and profile_id = (select auth.uid()));

create policy patients_update_own
  on public.patients
  for update
  to authenticated
  using (profile_id is not null and profile_id = (select auth.uid()))
  with check (profile_id is not null and profile_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- Grants
--
-- Table privileges are the first gate, RLS the second. `anon` receives
-- nothing: a signed-out request has no business reading any patient record,
-- and expressing that through RLS alone would be one policy edit away from a
-- leak.
--
-- `insert` and `update` are granted column by column. The effect of the
-- `update` list is that `id`, `profile_id`, `created_at` and `updated_at` are
-- unreachable for an ordinary caller - the field allowlist of `phase_07.md`
-- sections 49-50 expressed in the database rather than only in application
-- code.
-- ---------------------------------------------------------------------------
revoke all on public.patients from anon, authenticated;

grant select on public.patients to authenticated;

grant insert (
  profile_id,
  full_name,
  preferred_name,
  phone,
  date_of_birth,
  gender,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  emergency_contact_name,
  emergency_contact_relationship,
  emergency_contact_phone,
  preferred_language
) on public.patients to authenticated;

grant update (
  full_name,
  preferred_name,
  phone,
  date_of_birth,
  gender,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  emergency_contact_name,
  emergency_contact_relationship,
  emergency_contact_phone,
  preferred_language
) on public.patients to authenticated;
