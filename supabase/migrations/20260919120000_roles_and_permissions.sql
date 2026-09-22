-- ---------------------------------------------------------------------------
-- Phase 08 - Roles & Permissions
--
-- Phase 06 answered "who is this user". This migration answers "what is this
-- user allowed to do", at the only layer that cannot be talked out of the
-- answer.
--
-- It does four things:
--
--   1. Moves the role out of `public.profiles` and into a dedicated
--      `public.user_roles` assignment table.
--   2. Makes role assignment unreachable from a client at every level - no
--      grant, no policy, no writable path - and reachable only through an
--      admin-authorized, audited `security definer` function.
--   3. Records every role change in an insert-only audit table.
--   4. Gives policies a non-recursive way to ask about the caller's role.
--
-- ## Why `user_roles` rather than keeping `profiles.role`
--
-- `phase_08.md` section 6 asks for a dedicated role-assignment structure with
-- a foreign key to `auth.users` and `unique (user_id, role)`, so that
-- supporting a second role later is a policy change rather than a schema
-- redesign. `profiles.role` could not offer that: a single column is
-- structurally one role forever, and widening it later would mean migrating
-- live authorization data.
--
-- Two sources of truth would be worse than either one, so the column is
-- **moved**, not duplicated. Its data is copied across first, and
-- `current_app_role()` - which Phase 06 shipped for exactly this moment - is
-- redirected at the new table. Nothing that read a role through that function
-- or through `getCurrentUser()` changes behaviour.
--
-- ## One role today, by an index rather than by the schema
--
-- `docs/SECURITY.md` section 6 is canonical and says a user holds exactly one
-- role; a staff member who is also a patient of the clinic uses a separate
-- patient account. That invariant is enforced here by a unique index on
-- `user_id` alone.
--
-- `user_roles_user_role_key` on `(user_id, role)` is therefore redundant
-- *today* - it is implied by the stricter index. It is declared anyway because
-- it is the constraint that remains operative the day multi-role is permitted:
-- allowing a second role is then `drop index user_roles_single_role_per_user`
-- and nothing else. That is the extensibility section 6 is asking for, without
-- pretending to a capability the product has not decided on.
--
-- ## What is deliberately NOT here
--
--   * No staff or admin read access to `public.patients`. A receptionist is
--     operational and a doctor's clinical access is scoped by treatment
--     relationship (`SECURITY.md` section 6), and neither the appointment
--     model nor the treatment relationship exists yet. Granting role-wide
--     access to patient records now would be exactly the blanket policy
--     `phase_08.md` sections 18-19 forbid. Phase 07's ownership policies are
--     untouched.
--   * No appointment, clinical-record, prescription or document policy. Those
--     tables do not exist.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Role assignments
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),

  -- `auth.users`, not `public.profiles`. A role is an attribute of an
  -- identity, and keying it to the identity means a profile row that failed to
  -- be created cannot leave an account in an ambiguous authorization state.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The enum from the Phase 06 migration, which is the canonical four-role
  -- model. Free text would allow 'Doctor', 'DOCTOR', 'superadmin' and 'root'
  -- to become uncontrolled role values (`phase_08.md` section 7).
  role public.app_role not null,

  -- Who granted it. Null for the rows created by the registration trigger and
  -- for the rows migrated from `profiles.role`, because in neither case did a
  -- person decide. `on delete set null` so removing an administrator's account
  -- does not delete the roles they granted.
  assigned_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Requested by `phase_08.md` section 6. Redundant while the index below
  -- exists; operative the moment it does not. See the header.
  constraint user_roles_user_role_key unique (user_id, role)
);

comment on table public.user_roles is
  'The authoritative source of application roles. Not writable by any client: '
  'there is no insert, update or delete grant and no such policy. Roles are '
  'assigned by public.assign_user_role(), which authorizes the caller as an '
  'admin and writes an audit row.';

comment on column public.user_roles.role is
  'Never self-assignable. assign_user_role() refuses a caller acting on their '
  'own account, so an admin cannot promote or demote themselves either.';

-- The one-role-per-user invariant of SECURITY.md section 6. Dropping this
-- single index is the entire change required to permit multiple roles.
create unique index user_roles_single_role_per_user
  on public.user_roles (user_id);

create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Role-change audit
--
-- `SECURITY.md` section 6 requires role changes to be an audited operation,
-- and that document outranks a phase specification on authorization. This is
-- the minimum record that satisfies it: actor, target, before, after, when.
-- It is not the audit subsystem of Phase 19 and must not grow into one here -
-- `phase_08.md` section 27 is explicit about that.
--
-- Insert-only by construction: the only writer is `assign_user_role()`, which
-- runs as definer, and no client holds insert, update or delete on the table.
-- ---------------------------------------------------------------------------
create table public.role_assignment_events (
  id uuid primary key default gen_random_uuid(),

  -- Nullable so the row survives the actor's account being deleted. An audit
  -- record that can be erased by deleting an account is not an audit record.
  actor_id uuid references auth.users (id) on delete set null,

  -- Deliberately NOT a foreign key. The history of a role change has to
  -- outlive the account it was made against; a cascade here would delete the
  -- evidence along with the user.
  target_user_id uuid not null,

  previous_role public.app_role,
  new_role public.app_role not null,

  created_at timestamptz not null default now()
);

comment on table public.role_assignment_events is
  'Insert-only record of every role change: actor, target, previous role, new '
  'role, timestamp. Written only by public.assign_user_role(). Readable by '
  'admins only. Holds no patient information.';

create index role_assignment_events_target_idx
  on public.role_assignment_events (target_user_id, created_at desc);


-- ---------------------------------------------------------------------------
-- Move the existing roles across
--
-- Runs before `profiles.role` is dropped, so no user loses their role. Every
-- migrated row has a null `assigned_by`: nobody decided them, they are the
-- registration default or a manual fix predating this table.
-- ---------------------------------------------------------------------------
insert into public.user_roles (user_id, role)
select p.id, p.role
from public.profiles p
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------------
-- Retire profiles.role
--
-- The guard trigger that made the column self-immutable goes with it. Its job
-- is now done by the absence of any writable path to `user_roles` at all,
-- which is a stronger guarantee than a trigger that fires on an update
-- somebody was permitted to attempt.
-- ---------------------------------------------------------------------------
drop trigger if exists profiles_guard_role on public.profiles;
drop function if exists public.profiles_guard_role();

alter table public.profiles drop column role;


-- ---------------------------------------------------------------------------
-- Role resolution for policies and for the application
--
-- `security definer` and `stable`, per `docs/DATABASE.md` section 6.2. Definer
-- is what prevents recursive policy evaluation (`phase_08.md` section 20): a
-- policy on `user_roles` that queried `user_roles` through the caller's own
-- permissions would re-enter itself and either error or deadlock. Running as
-- the owner, the function reads the table without policies applying to it.
--
-- Both functions are deliberately narrow. Neither takes a user id: they answer
-- only about `auth.uid()`, so no caller can ask them about somebody else, and
-- neither can be turned into a privilege-bypass primitive by being handed a
-- different argument (section 20's warning).
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
security definer
stable
set search_path = ''
as $$
  select r.role
  from public.user_roles r
  where r.user_id = (select auth.uid())
  limit 1;
$$;

comment on function public.current_app_role() is
  'The calling user''s role, or null. Answers only about auth.uid(); it cannot '
  'be asked about another user.';

create function public.has_app_role(target public.app_role)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    where r.user_id = (select auth.uid())
      and r.role = target
  );
$$;

comment on function public.has_app_role(public.app_role) is
  'Whether the calling user holds the given role. The predicate RLS policies '
  'use, so that a policy never queries user_roles directly and never recurses.';


-- ---------------------------------------------------------------------------
-- Registration
--
-- Unchanged in substance: a new account is a patient, and the role is still
-- hard-coded rather than read from `raw_user_meta_data`, which the client
-- supplies at sign-up. A registration form that could ask for the admin role
-- and be given it is `phase_08.md` section 4's forbidden case.
--
-- The only change is where the role is written.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 20), '')
  )
  on conflict (id) do nothing;

  -- Least privilege, and not negotiable from the request: 'patient' is a
  -- literal here, never a value read from metadata.
  insert into public.user_roles (user_id, role)
  values (new.id, 'patient')
  on conflict (user_id) do nothing;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Role assignment
--
-- The single trusted mechanism `phase_08.md` section 9 asks for, expressed in
-- the database rather than only in a server action. Putting the check here
-- means it holds even if a future route handler forgets it, and it means
-- routine role management does not need the service-role key, which section 21
-- asks us to avoid wherever normal authenticated access can do the job.
--
-- Four refusals, in order:
--
--   1. No session          -> nobody may assign a role.
--   2. Caller is not admin -> a patient, receptionist or doctor may not, and
--                             `has_app_role` reads the database, not the
--                             request.
--   3. Caller is the target -> **including an admin acting on themselves.**
--                             `SECURITY.md` section 6 requires it: no user can
--                             change their own role. It also closes the
--                             "promote a second account, then promote
--                             yourself" path and prevents an administrator
--                             locking the clinic out by demoting themselves.
--   4. Unknown target      -> a role cannot be parked against an id that is
--                             not an account.
--
-- `target_user_id` and `new_role` come from the client, and that is safe
-- precisely because none of the four checks above consults them for authority:
-- the actor is `auth.uid()`, the actor's role is read from the database, and
-- `new_role` is constrained by the enum. Section 25's "request body role
-- injection" has nothing to act on.
--
-- The exception messages are written to be safe to surface. The application
-- maps by SQLSTATE and shows its own copy regardless, so no database text
-- reaches a user.
-- ---------------------------------------------------------------------------
create function public.assign_user_role(
  target_user_id uuid,
  new_role public.app_role
)
returns public.app_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  previous public.app_role;
begin
  if actor is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.has_app_role('admin') then
    raise exception 'You do not have permission to change roles.'
      using errcode = 'insufficient_privilege';
  end if;

  if target_user_id = actor then
    raise exception 'A user cannot change their own role.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'Unknown user.'
      using errcode = 'no_data_found';
  end if;

  select r.role into previous
  from public.user_roles r
  where r.user_id = target_user_id;

  insert into public.user_roles (user_id, role, assigned_by)
  values (target_user_id, new_role, actor)
  on conflict (user_id) do update
    set role = excluded.role,
        assigned_by = excluded.assigned_by,
        updated_at = now();

  insert into public.role_assignment_events (
    actor_id, target_user_id, previous_role, new_role
  )
  values (actor, target_user_id, previous, new_role);

  return new_role;
end;
$$;


-- ---------------------------------------------------------------------------
-- The managed-user list
--
-- An administrator managing staff access needs to identify people, and the
-- clinic identifies them by email address - which lives in `auth.users` and is
-- not reachable through row-level security at all.
--
-- The alternative was the service-role key in a server route. This is better
-- on both counts `phase_08.md` section 21 cares about: the authorization check
-- is in the database rather than in the caller, and the key stays unused.
--
-- It returns the minimum an access-management screen needs. No phone number,
-- no address, no patient record, no metadata - an administrator managing roles
-- is not thereby browsing patient data (`SECURITY.md` section 6, "Admins").
-- ---------------------------------------------------------------------------
create function public.list_managed_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role public.app_role,
  email_confirmed boolean,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.has_app_role('admin') then
    raise exception 'You do not have permission to view user accounts.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.full_name,
      r.role,
      (u.email_confirmed_at is not null),
      u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.user_roles r on r.user_id = u.id
    order by u.created_at asc;
end;
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Enabled with no permissive default on both new tables. Policies are per
-- operation, never `for all`, so each of `phase_08.md` section 19's questions
-- is answered deliberately - and there is no `using (true)` anywhere.
--
-- public.user_roles
--   SELECT  the user's own row, so the application can resolve their role;
--           and every row for an admin, so staff access can be managed.
--   INSERT  nobody.
--   UPDATE  nobody.
--   DELETE  nobody.
--
-- public.role_assignment_events
--   SELECT  admins only. It names who changed whose access.
--   INSERT  nobody. UPDATE nobody. DELETE nobody - an audit trail that can be
--           edited is not one.
--
-- "Nobody" here means exactly that: no policy exists, and no grant exists
-- either, so a write is refused at the privilege check before RLS is even
-- consulted. `assign_user_role()` writes as definer and is not subject to
-- these policies, which is why the authorization check lives inside it.
-- ---------------------------------------------------------------------------
alter table public.user_roles enable row level security;

create policy user_roles_select_own
  on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_roles_select_admin
  on public.user_roles
  for select
  to authenticated
  using (public.has_app_role('admin'));

alter table public.role_assignment_events enable row level security;

create policy role_assignment_events_select_admin
  on public.role_assignment_events
  for select
  to authenticated
  using (public.has_app_role('admin'));


-- ---------------------------------------------------------------------------
-- Phase 07's patient policies, narrowed by role
--
-- Phase 07 allowed **any authenticated user** to create, read and update a
-- patient record they owned, because no role model existed to say otherwise.
-- That left a real hole: a doctor could invoke the profile server action
-- directly and create a patient record for themselves, and the database would
-- have allowed it.
--
-- `docs/SECURITY.md` section 6 says a staff member who is also a patient of
-- the clinic uses a separate patient account. So self-service on
-- `public.patients` is narrowed to the patient role, matching
-- `profile.read.self` and `profile.write.self` in `config/permissions.ts`.
--
-- **The ownership rule is untouched.** Each policy still requires
-- `profile_id = auth.uid()`, in `using` and in `with check` exactly as before;
-- a role predicate is added alongside it, never in place of it. A patient's
-- experience is identical, and `patients_select_own` still returns one row at
-- most. Delete is still granted to nobody.
--
-- Note the direction of the change: it only ever denies more. A user with no
-- resolvable role now reads nothing, which is the fail-closed direction
-- (`docs/SECURITY.md` section 2.5).
--
-- Staff and admin access to patient records is still deliberately absent. A
-- receptionist's operational scope and a doctor's treatment-relationship
-- scoping both depend on an appointment model that does not exist, and
-- granting role-wide access now would be the blanket policy `phase_08.md`
-- sections 18-19 forbid.
-- ---------------------------------------------------------------------------
drop policy patients_select_own on public.patients;
drop policy patients_insert_own on public.patients;
drop policy patients_update_own on public.patients;

create policy patients_select_own
  on public.patients
  for select
  to authenticated
  using (
    profile_id is not null
    and profile_id = (select auth.uid())
    and public.has_app_role('patient')
  );

create policy patients_insert_own
  on public.patients
  for insert
  to authenticated
  with check (
    profile_id is not null
    and profile_id = (select auth.uid())
    and public.has_app_role('patient')
  );

create policy patients_update_own
  on public.patients
  for update
  to authenticated
  using (
    profile_id is not null
    and profile_id = (select auth.uid())
    and public.has_app_role('patient')
  )
  with check (
    profile_id is not null
    and profile_id = (select auth.uid())
    and public.has_app_role('patient')
  );


-- ---------------------------------------------------------------------------
-- Grants
--
-- Table privileges are the first gate, RLS the second. `anon` gets nothing at
-- all on either table: a signed-out request has no business reading anybody's
-- role, and expressing that only through RLS would be one policy edit away
-- from a leak.
--
-- `authenticated` receives `select` and nothing else. There is no
-- `grant insert`, `grant update` or `grant delete` on `user_roles` for any
-- client role, so client-side role assignment fails before a policy is
-- evaluated.
-- ---------------------------------------------------------------------------
revoke all on public.user_roles from anon, authenticated;
revoke all on public.role_assignment_events from anon, authenticated;

grant select on public.user_roles to authenticated;
grant select on public.role_assignment_events to authenticated;

revoke all on function public.has_app_role(public.app_role) from public;
grant execute on function public.has_app_role(public.app_role) to authenticated;

revoke all on function public.assign_user_role(uuid, public.app_role) from public;
grant execute on function public.assign_user_role(uuid, public.app_role) to authenticated;

revoke all on function public.list_managed_users() from public;
grant execute on function public.list_managed_users() to authenticated;
