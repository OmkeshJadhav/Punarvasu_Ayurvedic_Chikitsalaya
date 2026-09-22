-- ---------------------------------------------------------------------------
-- Phase 19 — Security & Privacy Hardening
--
-- Three things, none of them a feature:
--
--   1. Close the function-grant hole Phase 15 found and carried forward.
--   2. Take `assert_bookable_slot` out of reach of clients.
--   3. Add the security audit trail Phases 12-18 each deferred.
--
-- No table is altered. No policy is dropped. No existing function is replaced.
-- Every change either removes a privilege or adds an append-only record.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- 1. The function-grant hole
--
-- Phase 15 discovered, the hard way, that
--
--     revoke all on function public.f(...) from public;
--
-- does **not** make a function unreachable by a client. Supabase's project
-- bootstrap carries
--
--     alter default privileges in schema public
--       grant execute on functions to anon, authenticated, service_role;
--
-- so a newly created function is granted to those three roles **by name** at
-- creation time, and `revoke ... from public` removes only the PUBLIC grant.
-- Phase 15 fixed its own functions in two follow-up migrations and recorded
-- the rest as an audit item for this phase. This is that audit, carried out.
--
-- ## What was actually exposed
--
-- Every `security definer` function in `public` whose migration revoked only
-- from `public` — roughly sixty of them — retained EXECUTE for `anon`. In
-- practice each one failed closed, because each begins by resolving
-- `auth.uid()` or calling a gate that raises for a caller with no session. So
-- there is no known data exposure, and the Phase 09-17 live verifications that
-- observed `anon` being refused were observing a real refusal — it just came
-- from the function body rather than from the privilege system.
--
-- That is defence in depth working, and it is not a reason to leave it. A
-- privilege that is only harmless because every function body happens to check
-- is a privilege that becomes harmful the first time one does not.
-- `phase_19.md` sections 186 and 188: do not expose privileged RPCs
-- unnecessarily, and follow least privilege.
--
-- ## Why revoking from `anon` is safe
--
-- Every row-level-security policy in this project is declared `to
-- authenticated` — all thirty-seven of them, verified. PostgreSQL does not
-- evaluate a policy for a role it does not name, so no policy predicate is
-- ever executed as `anon`, and removing `anon`'s EXECUTE cannot reproduce the
-- Phase 09 defect where a policy that raised took out the query for everybody.
--
-- The application has no anonymous database path at all: the public marketing
-- site reads nothing from PostgreSQL, and authentication goes through Supabase
-- Auth rather than through a function of ours.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Two filters and a guard, and each is here for a reason.
--
--   * **Extension functions are skipped.** `btree_gist` and `pg_trgm` are
--     installed without an explicit schema, so depending on the search path in
--     force they may land in `public`. They are not ours: revoking on them
--     could break an operator class an index depends on, and the migration
--     role may not own them — which would raise, and abort this entire
--     migration. `pg_depend` with `deptype = 'e'` is what identifies them.
--
--   * **Trigger functions are skipped.** A trigger function is invoked by its
--     trigger, never called directly, and carries no EXECUTE grant to remove.
--
--   * **Each revoke is individually guarded.** A migration that aborts because
--     one function in a shared schema has an unexpected owner is worse than
--     one that reports it and carries on: the sixty functions that matter are
--     ours and will succeed, and anything skipped is named in the output for
--     somebody to look at. `tests/security/database-grants.test.ts` asserts
--     that every *future* function names `anon` in its own revoke, so this
--     sweep is a one-time repair rather than the ongoing mechanism.
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
  revoked integer := 0;
  skipped integer := 0;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype <> 'pg_catalog.trigger'::pg_catalog.regtype
      and not exists (
        select 1
        from pg_depend d
        where d.objid = p.oid
          and d.classid = 'pg_proc'::regclass
          and d.deptype = 'e'
      )
  loop
    begin
      execute format('revoke all on function %s from anon', fn.signature);
      revoked := revoked + 1;
    exception
      when others then
        skipped := skipped + 1;
        raise notice 'Phase 19: could not revoke on %, skipped.', fn.signature;
    end;
  end loop;

  raise notice 'Phase 19: revoked EXECUTE from anon on % functions in public (% skipped).',
    revoked, skipped;

  if revoked < 50 then
    -- The project had well over a hundred functions in `public` when this was
    -- written. A sweep that touched almost nothing has not found them, and
    -- silently succeeding would leave the hole open while looking fixed.
    raise exception 'Phase 19: expected to revoke on many more functions, got %. Aborting rather than half-applying.', revoked;
  end if;
end;
$$;

-- The durable half. Without this, the next migration to create a function
-- re-opens exactly the hole closed above, and somebody has to remember.
--
-- `alter default privileges` applies to objects created **by the role that
-- runs this statement**, which is the same role every migration runs as. A
-- function created by a different owner would not inherit it; nothing in this
-- project creates one, and `tests/security/database-grants.test.ts` asserts
-- that every new function still names `anon` in its own revoke, so the belt
-- and the braces are both checked.
alter default privileges in schema public
  revoke execute on functions from anon;


-- ===========================================================================
-- 2. `assert_bookable_slot`
--
-- The one `security definer` function in the project that is reachable by a
-- client and performs no authorization check of its own. It was never meant to
-- be reachable — its own comment says the last two parameters are "decided by
-- the calling function, never by a request" — but the grant made every client
-- a caller.
--
-- ## What it leaked
--
-- It returns `void` and is `stable`, so nothing could be written through it.
-- What it gave away was the clinic's diary, through its error codes, to anyone
-- holding the publishable key:
--
--   PV006  this practitioner does not exist / is inactive / does not take
--          online bookings
--   PV002  outside working hours, off the slot grid, or **overlapping a
--          blocked period**
--
-- That last one is the part that matters. `public.schedule_exceptions` has
-- row-level security enabled and **no policy at all**, for anybody, because a
-- blocked period's reason may be personal — Phase 10 verified that even a
-- receptionist reads zero rows from it. This function was a side channel
-- around a table nobody is permitted to read: a caller could not learn *why* a
-- practitioner was unavailable, but could map exactly *when*.
--
-- It also let a caller set `p_require_online_booking` and
-- `p_min_notice_minutes` themselves, which are the two rules that distinguish
-- a patient booking from the front desk booking on their behalf.
--
-- Phase 09 section 50 authenticated the availability endpoint specifically so
-- that "the clinic's diary shape [is not] scrapable by anyone who finds the
-- URL". This closes the path around it.
--
-- ## Why revoking is enough, and why it is safe
--
-- Its four callers — `book_appointment`, `create_appointment_for_patient`,
-- `reschedule_appointment`, `reschedule_appointment_as_staff` — are all
-- `security definer` and therefore execute as the owner, which holds EXECUTE
-- regardless of what any client role does. Adding a gate to the function
-- instead would be wrong: it has no notion of who is asking, and inventing one
-- would duplicate the authorization its callers already do.
-- ===========================================================================

revoke all on function public.assert_bookable_slot(
  uuid, timestamptz, timestamptz, timestamptz, boolean, integer
) from public, anon, authenticated;

comment on function public.assert_bookable_slot(
  uuid, timestamptz, timestamptz, timestamptz, boolean, integer
) is
  'Every booking rule except overlap, which the exclusion constraint owns. '
  'Shared by patient and staff scheduling so the two cannot drift. The last '
  'two parameters are decided by the calling function, never by a request — '
  'and since Phase 19 no client role can call it, so that is now enforced '
  'rather than asserted.';


-- ---------------------------------------------------------------------------
-- The internal gates, and one dead predicate.
--
-- None of these is called by the application (checked against every `.rpc()`
-- call site) and none appears in a policy expression (checked against every
-- `create policy` body). They are called from inside other `security definer`
-- functions, which execute as the owner.
--
-- `can_read_patient_document` has no caller at all: the storage policy uses
-- `can_read_patient_document_object`, which resolves an object name to a row
-- and applies the same rule inline. It is left in place rather than dropped —
-- dropping a predicate whose name appears in three comments is a change for a
-- phase that is reading the document feature, not for this one — but it is put
-- out of reach.
-- ---------------------------------------------------------------------------

revoke all on function public.assert_care_practitioner() from public, anon, authenticated;
revoke all on function public.assert_appointment_manager() from public, anon, authenticated;
revoke all on function public.assert_document_patient() from public, anon, authenticated;
revoke all on function public.can_read_patient_document(uuid) from public, anon, authenticated;


-- ===========================================================================
-- 3. The security audit trail
--
-- `phase_19.md` sections 89-91, and the item Phases 12, 13, 14, 15, 16 and 17
-- each deferred with the same sentence: a capability was withheld because
-- granting it would grant it *unaudited*.
--
-- ## What it records, and what it deliberately does not
--
-- Who reached what, when, and whether they were allowed to. That is the whole
-- question an access audit answers, and answering it needs no clinical
-- content whatsoever:
--
--   * **no** diagnosis, symptom, assessment, note, medicine, dose, title,
--     filename, storage path, search term or reason — there is no column for
--     any of them, so none can be added by a caller
--   * **no** free text at all except a bounded correlation id
--   * `resource_id` and `actor_id` are opaque uuids
--
-- A reader of this table learns that Dr A opened patient B's clinical record
-- at 14:32. They do not learn what it said. That is the correct amount of
-- information for an audit trail to hold, and it is why the table can be kept
-- for longer than the thing it describes.
--
-- ## Append-only, against everybody
--
-- No update policy, no delete policy, no grant for either, and a trigger that
-- raises on both — so the trail resists the service-role client too, the same
-- way Phase 13's issued prescriptions and Phase 17's AI sessions do. An audit
-- record an administrator can quietly edit is not an audit record.
--
-- ## Who may read it
--
-- Administrators. Section 91: not patients, not receptionists, not doctors.
-- A practitioner being able to see who else opened a record sounds reasonable
-- and is a different product decision with a different privacy analysis; it is
-- not made here.
-- ===========================================================================

create type public.security_audit_outcome as enum (
  -- The operation was authorized and performed.
  'allowed',
  -- The operation was refused. Recorded because a run of these against one
  -- actor is the clearest signal in the system that somebody is probing
  -- (`phase_19.md` sections 156-157).
  'denied'
);

create type public.security_audit_action as enum (
  -- A clinical record was opened for reading.
  'clinical_record.read',
  -- A prescription was opened for reading.
  'prescription.read',
  -- A treatment plan was opened for reading.
  'treatment_plan.read',
  -- A patient's demographic record was opened by staff. Not the patient's own
  -- read of their own record: that is not privileged access, and recording it
  -- would bury the entries that are.
  'patient_record.read',
  -- A short-lived signed URL was minted for a patient document. This is the
  -- moment a file becomes reachable, so it is the moment worth recording.
  'document.access_granted',
  -- An operational report was generated and downloaded.
  'report.exported',
  -- An authorization check refused a request. Always paired with 'denied'.
  'authorization.denied'
);

create type public.security_audit_resource as enum (
  'clinical_record',
  'prescription',
  'treatment_plan',
  'patient',
  'document',
  'report',
  'route'
);

create table public.security_audit_events (
  id uuid primary key default gen_random_uuid(),

  occurred_at timestamptz not null default now(),

  -- The account that acted.
  --
  -- **Deliberately not a foreign key**, for two reasons that point the same
  -- way. The record of who reached a patient's file has to outlive the account
  -- that did it — the same reasoning that left Phase 08's
  -- `role_assignment_events.target_user_id` unconstrained — and a referential
  -- action would collide with this table's own immutability trigger: an
  -- `on delete set null` performs an UPDATE, the trigger refuses every UPDATE,
  -- and deleting a staff account would fail with an audit error rather than an
  -- explanation.
  actor_id uuid,

  -- Denormalised on purpose. The actor's role at the *time of the access* is
  -- the fact an auditor needs, and resolving it later from `user_roles` would
  -- give today's role instead — which is precisely wrong when the question
  -- being asked is what somebody could reach before they were moved.
  actor_role public.app_role,

  action public.security_audit_action not null,
  resource_type public.security_audit_resource not null,

  -- Null for a route-level denial, which has no resource to name.
  resource_id uuid,

  -- Whose data this was, when that is a different question from which record
  -- was opened. It is what makes "show me everyone who reached this patient"
  -- a single indexed query rather than a join per resource type.
  subject_patient_id uuid,

  outcome public.security_audit_outcome not null,

  -- The application's correlation id, so an entry can be tied to the request
  -- that produced it without the request having to carry anything about the
  -- user. Bounded and shaped, because an unbounded string column on an
  -- append-only table is a place to hide things.
  request_id text,

  constraint security_audit_events_request_id_format check (
    request_id is null
    or request_id ~ '^[A-Za-z0-9._-]{8,64}$'
  ),

  -- A route-level denial names no resource, because there is no resource to
  -- name — the request was refused before one was resolved. Stated as a
  -- constraint rather than a convention so a caller cannot record an entry
  -- that claims to be about a route and a record at the same time.
  constraint security_audit_events_route_has_no_resource check (
    resource_type <> 'route' or resource_id is null
  )
);

-- The three questions this table exists to answer, each served by one index.
--
-- "Who reached this patient?"
create index security_audit_events_subject_idx
  on public.security_audit_events (subject_patient_id, occurred_at desc)
  where subject_patient_id is not null;

-- "What did this account do?"
create index security_audit_events_actor_idx
  on public.security_audit_events (actor_id, occurred_at desc);

-- "What has been refused lately?" — the abuse-monitoring query of section 156.
create index security_audit_events_denied_idx
  on public.security_audit_events (occurred_at desc)
  where outcome = 'denied';


-- ---------------------------------------------------------------------------
-- Append-only enforcement
-- ---------------------------------------------------------------------------

create function public.security_audit_events_guard_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Security audit events cannot be modified or removed.'
    using errcode = 'PV080';
end;
$$;

comment on function public.security_audit_events_guard_write() is
  'Refuses every update and delete on the audit trail, including from the '
  'service role. An audit record an administrator can edit is not one.';

create trigger security_audit_events_immutable
  before update or delete on public.security_audit_events
  for each row
  execute function public.security_audit_events_guard_write();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.security_audit_events enable row level security;

-- Administrators read. Nobody else has a policy, which is a stronger statement
-- than a predicate that evaluates to false: a predicate can be weakened by an
-- edit, and an absent policy cannot.
create policy security_audit_events_select_admin
  on public.security_audit_events
  for select
  to authenticated
  using (public.has_app_role('admin'));

-- No insert, update or delete policy for any role. Writes go through the
-- function below, which is the only path.
revoke all on public.security_audit_events from anon, authenticated;
grant select on public.security_audit_events to authenticated;


-- ---------------------------------------------------------------------------
-- The write path
-- ---------------------------------------------------------------------------

create function public.record_security_audit_event(
  p_action public.security_audit_action,
  p_resource_type public.security_audit_resource,
  p_outcome public.security_audit_outcome,
  p_resource_id uuid default null,
  p_subject_patient_id uuid default null,
  p_request_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.app_role;
begin
  -- An entry with no actor is not an audit entry, it is noise. A caller with
  -- no session has nothing to record.
  if v_actor is null then
    return;
  end if;

  -- Resolved here, from the database, at the moment of the access. Not a
  -- parameter: an actor who could name their own role in the audit trail could
  -- write a trail that exonerates them.
  select ur.role into v_role
  from public.user_roles ur
  where ur.user_id = v_actor
  limit 1;

  insert into public.security_audit_events (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    subject_patient_id,
    outcome,
    request_id
  )
  values (
    v_actor,
    v_role,
    p_action,
    p_resource_type,
    p_resource_id,
    p_subject_patient_id,
    p_outcome,
    -- A malformed correlation id is dropped rather than refused: a request
    -- must never fail because its audit entry was imperfect.
    case
      when p_request_id ~ '^[A-Za-z0-9._-]{8,64}$' then p_request_id
      else null
    end
  );
exception
  when others then
    -- Deliberately swallowed.
    --
    -- This is called after an operation the caller was already authorized to
    -- perform, so a failure here must not undo it or surface to them. The
    -- alternative — an audit failure that fails the request — turns a logging
    -- problem into a clinical one: a practitioner who cannot open a record
    -- mid-consultation because an insert failed.
    --
    -- `phase_19.md` section 50's reasoning about audit rows, applied to reads.
    -- The application logs the same operation to the structured log
    -- independently, so an entry lost here is not an event lost entirely.
    return;
end;
$$;

comment on function public.record_security_audit_event(
  public.security_audit_action,
  public.security_audit_resource,
  public.security_audit_outcome,
  uuid, uuid, text
) is
  'Records one privileged access. The actor and their role are derived from '
  'auth.uid() and never accepted, so an entry cannot be attributed to somebody '
  'else. Carries no clinical content: there is no column for any.';

-- Callable by any signed-in user, because the server records the access as the
-- user whose access it was — the whole point being that the entry is
-- attributable. There is no parameter through which a caller can name a
-- different actor, so the worst a forged call achieves is an entry saying the
-- forger touched something, which is not a useful lie to tell.
revoke all on function public.record_security_audit_event(
  public.security_audit_action,
  public.security_audit_resource,
  public.security_audit_outcome,
  uuid, uuid, text
) from public, anon;

grant execute on function public.record_security_audit_event(
  public.security_audit_action,
  public.security_audit_resource,
  public.security_audit_outcome,
  uuid, uuid, text
) to authenticated;


-- ---------------------------------------------------------------------------
-- Reading the trail
--
-- One admin-gated function rather than letting the dashboard query the table
-- directly, for the same reason Phase 16 gave: the authorization check sits in
-- the database next to the data rather than in whichever caller remembered it.
-- ---------------------------------------------------------------------------

create function public.security_audit_recent(
  p_limit integer default 100
)
returns table (
  occurred_at timestamptz,
  actor_id uuid,
  actor_role public.app_role,
  action public.security_audit_action,
  resource_type public.security_audit_resource,
  resource_id uuid,
  subject_patient_id uuid,
  outcome public.security_audit_outcome
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  if not public.has_app_role('admin') then
    raise exception 'Administrator role required.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    e.occurred_at,
    e.actor_id,
    e.actor_role,
    e.action,
    e.resource_type,
    e.resource_id,
    e.subject_patient_id,
    e.outcome
  from public.security_audit_events e
  order by e.occurred_at desc
  -- The caller does not choose how much of the trail to pull in one go.
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function public.security_audit_recent(integer) from public, anon;
grant execute on function public.security_audit_recent(integer) to authenticated;

comment on function public.security_audit_recent(integer) is
  'The recent audit trail, for administrators. Bounded in the function rather '
  'than by the caller.';
