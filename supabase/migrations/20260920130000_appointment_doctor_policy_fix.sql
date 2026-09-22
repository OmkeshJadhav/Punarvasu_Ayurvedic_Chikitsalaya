-- ---------------------------------------------------------------------------
-- Phase 09 - fix: the doctor's-diary policy read a column no client may read
--
-- ## The defect
--
-- `20260920120000_appointment_engine.sql` scoped a doctor to their own diary
-- with a subquery:
--
--     practitioner_id in (
--       select p.id from public.practitioners p
--       where p.profile_id = (select auth.uid())
--     )
--
-- A policy expression is evaluated **with the calling role's privileges**, and
-- the column-level grant on `public.practitioners` is deliberately
-- `(id, display_name, is_active, accepts_online_booking)` - `profile_id` is
-- not granted, because which account a practitioner signs in with is none of a
-- patient's business.
--
-- So evaluating that policy raised `42501: permission denied for table
-- practitioners`. And because policies are OR-ed, PostgreSQL evaluates them
-- all: the error took out the query for **every** caller, including the
-- patient whose own `appointments_select_own_patient` policy would have
-- admitted them. The net effect was that no client could read any appointment
-- at all.
--
-- It was invisible to the migration applying cleanly, invisible to the
-- structural assertions in `tests/integration/appointment-security.test.ts` -
-- which check that the policy is scoped by relationship, and it is - and
-- invisible to every stubbed integration test. It was found by signing in as a
-- real patient against the real database and reading back the appointment they
-- had just booked. `docs/QA_STRATEGY.md` section 49, rule 1: compilation is
-- not functional verification.
--
-- ## The fix
--
-- A `security definer` helper, exactly parallel to `current_patient_id()`,
-- which the patient policy already uses for the same reason. It runs as its
-- owner, so it needs no grant on `profile_id`; it takes no argument, so no
-- caller can ask it about somebody else; and the policy becomes a plain
-- equality with nothing privileged in it.
--
-- The scoping is unchanged in substance: a doctor still reaches their own
-- diary and nothing else, by **relationship** rather than by role
-- (`docs/SECURITY.md` section 6).
--
-- ## Why a second migration rather than an edit
--
-- `docs/DATABASE.md` section 12: migrations are forward-only and applied
-- exactly once. The engine migration has been applied; editing it would leave
-- the file and the database disagreeing for anybody who already ran it. The
-- history showing a defect and its fix is more useful than a history that
-- pretends the defect never happened.
-- ---------------------------------------------------------------------------

create function public.current_practitioner_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select p.id
  from public.practitioners p
  where p.profile_id = (select auth.uid())
  limit 1;
$$;

comment on function public.current_practitioner_id() is
  'The calling user''s own practitioner record, or null. Answers only about '
  'auth.uid(); it cannot be asked about another user. Exists so a policy can '
  'scope a practitioner to their own rows without the caller needing a grant '
  'on practitioners.profile_id.';

revoke all on function public.current_practitioner_id() from public;
grant execute on function public.current_practitioner_id() to authenticated;

drop policy appointments_select_own_practitioner on public.appointments;

create policy appointments_select_own_practitioner
  on public.appointments
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and practitioner_id = public.current_practitioner_id()
  );
