-- ---------------------------------------------------------------------------
-- Phase 11 - Doctor Workspace
--
-- The third actor on the Phase 09 appointment engine. Phase 09 gave the
-- patient their own bookings, Phase 10 gave the front desk the clinic diary,
-- and this gives a practitioner their own diary and the patients in their
-- care - without adding a second scheduling engine and without adding a
-- single clinical column.
--
-- ## What is reused
--
-- Everything. `assert_bookable_slot`, both exclusion constraints,
-- `appointments_guard_transition()`, `appointment_events`,
-- `current_practitioner_id()` and the availability functions are untouched.
-- This migration adds **no table, no enum, no constraint and no trigger**; it
-- adds two predicates, one authorization gate, one bounded search, one status
-- function, two select policies and one index.
--
-- Phase 09 already shipped `appointments_select_own_practitioner`, scoped by
-- the practitioner *relationship* rather than by the doctor role, and left it
-- unused. This is the phase that uses it.
--
-- ## The access policy this migration implements
--
-- `phase_11.md` section 16 requires the patient-access model to be chosen
-- explicitly and documented, and warns against implementing clinic-wide
-- access because it is easier. `docs/SECURITY.md` section 6 already decides
-- it: *"Doctors can access the clinical records of patients they are
-- treating, scoped by treatment relationship rather than by role alone"*, and
-- its matrix says a doctor sees "treated patients" and their "own schedule".
--
-- So this is the **appointment-linked model**:
--
--     a doctor may read a patient record when an appointment exists
--     between that patient and the doctor's own practitioner record
--
-- and nothing else. A doctor with no appointment with a patient cannot read
-- that patient, cannot find them by searching, and cannot act on their
-- appointments. Two doctors at the same clinic are isolated from each other's
-- patients.
--
-- ### Why an appointment of any status counts
--
-- The narrower alternative - excluding cancelled appointments - was
-- considered and rejected, because it is incoherent with what the doctor can
-- already see. A cancelled appointment still appears in their own diary
-- (Phase 09's policy has no status predicate), so hiding the patient's name
-- from a row that is already on their screen would show them an appointment
-- with nobody in it. The relationship is established by the appointment
-- existing, which is the patient having asked to be seen by this
-- practitioner.
--
-- Widening that rule later is a change to one function. Narrowing it is too.
--
-- ## No clinical anything
--
-- `phase_11.md` sections 18, 53 and 54: no diagnosis, no symptom, no note, no
-- vital, no prescription, no treatment plan. There is no column here to hold
-- one, no function that writes one, and `public.patients` still has none -
-- Phase 07's migration says none may be added to it.
--
-- The two statuses this migration lets a doctor set that the front desk
-- cannot are `in_consultation` and `completed`, and neither is a clinical
-- record: both are values Phase 09 already declared in `appointment_status`
-- and left unreachable, precisely so that the phase which gives a
-- practitioner a workspace could reach them.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- The care relationship
--
-- `security definer`, for the same reason `current_patient_id()` and
-- `current_practitioner_id()` are: a policy expression is evaluated with the
-- *calling* role's privileges, and Phase 09 learned what that costs - see
-- `20260920130000_appointment_doctor_policy_fix.sql`, where a policy reading
-- an ungranted column raised `42501` and, because policies are OR-ed and all
-- of them are evaluated, took out the query for every caller including the
-- patient whose own policy would have admitted them.
--
-- It takes a patient id and answers only about the *caller's own*
-- practitioner record. There is no argument for a practitioner, so there is
-- none to substitute: a doctor cannot ask whether some other doctor treats
-- somebody.
--
-- `current_practitioner_id()` returns null for anybody who is not a
-- practitioner, and `practitioner_id = null` is never true, so this returns
-- false for a patient, a receptionist, an administrator, and a doctor with no
-- practitioner record.
-- ---------------------------------------------------------------------------
create function public.doctor_has_care_relationship(p_patient_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments a
    where a.patient_id = p_patient_id
      and a.practitioner_id = public.current_practitioner_id()
  );
$$;

comment on function public.doctor_has_care_relationship(uuid) is
  'True when an appointment exists between the calling practitioner and this '
  'patient. The whole of the doctor patient-access policy. Answers only about '
  'the caller''s own practitioner record; it cannot be asked about another '
  'practitioner.';


-- ---------------------------------------------------------------------------
-- Ownership of one appointment
--
-- The same shape, for the appointment history. A doctor reads the events of
-- their own appointments and of nobody else's.
-- ---------------------------------------------------------------------------
create function public.doctor_owns_appointment(p_appointment_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.appointments a
    where a.id = p_appointment_id
      and a.practitioner_id = public.current_practitioner_id()
  );
$$;

comment on function public.doctor_owns_appointment(uuid) is
  'True when this appointment is in the calling practitioner''s own diary.';


-- ---------------------------------------------------------------------------
-- The authorization gate
--
-- The doctor equivalent of `assert_appointment_manager()`, with one
-- difference that matters: it also **resolves the practitioner identity** and
-- returns it, so every function below derives the practitioner from
-- `auth.uid()` rather than accepting one.
--
-- `phase_11.md` sections 4, 46 and 47 and example 2: a `doctorId` from the
-- browser is not proof of identity, and there is no parameter here for one.
--
-- It raises rather than returning null, because a caller that forgets to
-- check a returned null is a caller that has authorized nothing. Three
-- distinct refusals, all mapped to the same generic copy by
-- `features/appointments/errors.ts`, so the application never discloses which
-- one it was.
-- ---------------------------------------------------------------------------
create function public.assert_care_practitioner()
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  practitioner uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A role check rather than a permission check, because the database has no
  -- permission table: `config/permissions.ts` is the application's policy and
  -- `docs/SECURITY.md` section 6 is what both implement. The two are asserted
  -- to agree by test.
  if not public.has_app_role('doctor') then
    raise exception 'You do not have permission to do that.'
      using errcode = 'insufficient_privilege';
  end if;

  practitioner := public.current_practitioner_id();

  -- Holding the doctor role is not the same as being on the clinic's
  -- scheduling roster. An account with no practitioner record has no diary
  -- and no patients, and must not fall through to "everybody".
  if practitioner is null then
    raise exception 'This account is not linked to a practitioner record.'
      using errcode = 'insufficient_privilege';
  end if;

  return practitioner;
end;
$$;

comment on function public.assert_care_practitioner() is
  'Refuses anybody who is not a signed-in doctor with a practitioner record, '
  'and returns that practitioner id. The single authorization gate for every '
  'doctor function, and the only place a practitioner identity is produced.';


-- ---------------------------------------------------------------------------
-- Patient search, within the doctor's own care scope
--
-- `phase_11.md` sections 15-16 and example 5: authorized, server-side,
-- bounded, minimal fields, and it must be impossible to ask it for the whole
-- patient database.
--
-- It is a separate function from `search_patients` rather than a parameter on
-- it, because the two answer different questions over different row sets, and
-- fusing them would mean one function whose scope depends on an argument -
-- exactly the shape that eventually gets called with the wrong argument. What
-- they share (the bounds, the escaping, the digit comparison) is small and
-- duplicated deliberately; what they must not share is the scope.
--
-- The join to `appointments` is the care-relationship filter, and it is in
-- the `from` clause rather than in a predicate a later edit could drop.
--
-- ## What it discloses
--
-- A name, a phone number, a date of birth, and when this practitioner last
-- had an appointment with them - which is the discriminator a doctor
-- actually uses to tell two similarly named people apart. No address, no
-- emergency contact, no account identifier, and nothing clinical.
-- ---------------------------------------------------------------------------
create function public.search_care_patients(
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  full_name text,
  preferred_name text,
  phone text,
  date_of_birth date,
  last_appointment_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  practitioner uuid;
  term text;
  pattern text;
  digits text;
  bounded integer;
begin
  practitioner := public.assert_care_practitioner();

  term := btrim(coalesce(p_query, ''));
  if char_length(term) < 2 then
    return;
  end if;

  -- Bounded in the function. A caller asking for ten thousand rows gets fifty.
  bounded := least(greatest(coalesce(p_limit, 20), 1), 50);

  -- Escaped, so wildcard characters in the query are searched for rather than
  -- interpreted. The backslash is escaped first, or it would escape the
  -- escapes added after it.
  pattern := '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- A phone number is typed with spaces, dashes and country codes in it. The
  -- stored form is ten digits, so both sides are reduced to digits before
  -- being compared.
  digits := regexp_replace(term, '\D', '', 'g');

  return query
    select
      p.id,
      p.full_name,
      p.preferred_name,
      p.phone,
      p.date_of_birth,
      max(a.starts_at)
    from public.patients p
    join public.appointments a on a.patient_id = p.id
    where a.practitioner_id = practitioner
      and (
        p.full_name ilike pattern escape '\'
        or p.preferred_name ilike pattern escape '\'
        or (
          char_length(digits) >= 4
          and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || digits || '%'
        )
      )
    group by p.id, p.full_name, p.preferred_name, p.phone, p.date_of_birth
    order by max(a.starts_at) desc, p.full_name asc
    limit bounded;
end;
$$;

comment on function public.search_care_patients(text, integer) is
  'Bounded patient search restricted to the calling practitioner''s own care '
  'scope. Refuses a caller who is not a doctor with a practitioner record, '
  'returns nothing below two characters, clamps its own limit, and discloses '
  'no address, emergency contact or account identifier.';


-- ---------------------------------------------------------------------------
-- The doctor's operational status actions
--
-- `phase_11.md` sections 21-22 and example 7: the current status decides
-- which transitions are possible, the server validates, and unrestricted
-- status editing is forbidden.
--
-- ## The allowlist, and how it complements the front desk's
--
--     receptionist   confirmed, checked_in, no_show, cancelled
--     doctor         confirmed, in_consultation, completed, no_show
--
-- `in_consultation` and `completed` are exactly the two Phase 10 refused the
-- front desk, on the grounds that they describe what happened in the
-- consulting room. This is the role that was in it.
--
-- `cancelled` is deliberately **not** here. Cancelling releases a slot,
-- changes a patient's plans and needs somebody to tell them; it is a
-- front-desk operation, and a practitioner who needs one cancelled asks the
-- desk, which records who did it. `phase_11.md` section 21 lists confirm,
-- complete and no-show, and does not list cancel.
--
-- ## No reason parameter
--
-- The receptionist's equivalent takes one because it can cancel, and a
-- cancellation reason is recorded against the row. None of the four
-- transitions here writes a reason, so there is no parameter for one - which
-- also means there is no free-text field anywhere on this path for a clinical
-- note to be typed into.
--
-- ## Three things refuse, not one
--
--   1. the allowlist below, which is about the role;
--   2. the explicit legality check, which exists only so the refusal carries a
--      sentence a person can act on;
--   3. `appointments_guard_transition()`, the Phase 09 trigger, which is what
--      actually holds and which this function cannot talk its way past.
--
-- And beneath all three, the appointment is resolved by id **and** by the
-- caller's own practitioner id in one statement, so another doctor's
-- appointment is indistinguishable from one that does not exist.
-- ---------------------------------------------------------------------------
create function public.update_appointment_status_as_doctor(
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  practitioner uuid;
  appt record;
  allowed boolean;
begin
  practitioner := public.assert_care_practitioner();

  if p_status not in ('confirmed', 'in_consultation', 'completed', 'no_show') then
    raise exception 'You do not have permission to set that status.'
      using errcode = 'insufficient_privilege';
  end if;

  -- By id *and* by the caller's own practitioner record, in one statement.
  -- There is no window between reading and checking, and cross-doctor access
  -- returns the same answer as a nonexistent appointment.
  select a.id, a.status into appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.practitioner_id = practitioner;

  if appt.id is null then
    raise exception 'Appointment not found.'
      using errcode = 'PV009';
  end if;

  if appt.status = p_status then
    -- Not an error and not a change. A second click, or the doctor and the
    -- front desk acting at the same moment, should not raise.
    return;
  end if;

  -- The Phase 09 matrix narrowed to this role, mirrored here only so the
  -- refusal carries a sentence. The trigger is what enforces it.
  allowed := case
    when appt.status = 'requested' then p_status in ('confirmed')
    when appt.status = 'confirmed' then p_status in ('no_show')
    when appt.status = 'checked_in' then p_status in ('in_consultation', 'no_show')
    when appt.status = 'in_consultation' then p_status in ('completed')
    else false
  end;

  if not allowed then
    raise exception 'That status change is not allowed.'
      using errcode = 'PV008';
  end if;

  update public.appointments a
  set status = p_status
  where a.id = appt.id;

  insert into public.appointment_events (
    appointment_id, actor_id, event_type, previous_status, new_status
  )
  values (appt.id, actor, 'status_changed', appt.status, p_status);
end;
$$;

comment on function public.update_appointment_status_as_doctor(uuid, public.appointment_status) is
  'The practitioner''s own operational status actions: confirm, start the '
  'consultation, complete it, or record a no-show. It cannot cancel. It acts '
  'only on appointments in the caller''s own diary, and defers to the Phase '
  '09 transition trigger for legality.';


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Two new select policies, each naming the doctor role explicitly **and**
-- scoping by relationship. `phase_11.md` sections 11, 23 and 45 all require
-- the second half: holding the doctor role must not by itself reach a patient
-- or an appointment.
--
-- No insert, update or delete policy is created, and no write grant is
-- issued. The Phase 09 guarantee stands unchanged: **no client role can write
-- `public.appointments`.** Every doctor write is a function call.
--
-- The existing policies are untouched. There is no `drop policy` in this
-- migration: a patient's own-record policies, the receptionist's operational
-- ones and the practitioner's own-diary policy all still say exactly what
-- they said.
-- ---------------------------------------------------------------------------

-- The patients a doctor is treating, and only those. This is the whole
-- patient-access boundary, expressed where application code cannot bypass it.
create policy patients_select_doctor_care
  on public.patients
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and public.doctor_has_care_relationship(id)
  );

-- The history of the doctor's own appointments. It carries no clinical
-- content and no free text - `appointment_events` has columns for which
-- values changed and when, and for nothing else.
create policy appointment_events_select_own_practitioner
  on public.appointment_events
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and public.doctor_owns_appointment(appointment_id)
  );


-- ---------------------------------------------------------------------------
-- Index
--
-- The care-relationship predicate is an equality on
-- `(practitioner_id, patient_id)`, and it is evaluated once per candidate row
-- on every doctor read of `public.patients` and once per row of the doctor's
-- search. Phase 09 indexed `(practitioner_id, starts_at)` and Phase 10
-- `(starts_at)`; neither serves an equality on that pair.
-- ---------------------------------------------------------------------------
create index appointments_practitioner_patient_idx
  on public.appointments (practitioner_id, patient_id);


-- ---------------------------------------------------------------------------
-- Grants
--
-- `doctor_has_care_relationship` and `doctor_owns_appointment` are executed
-- **by the caller** as part of a policy expression, so `authenticated` needs
-- execute on both. Each answers only about the caller's own practitioner
-- record, and returns false for every non-practitioner.
--
-- `assert_care_practitioner` is internal: it is called only from other
-- `security definer` functions, which run as the owner, so it needs no grant
-- at all - the same arrangement as `assert_appointment_manager`.
--
-- There is no new grant on any table. A doctor reads `public.patients`
-- through the existing table-wide select grant, narrowed to their care scope
-- by the policy above, and the application names the columns it wants
-- (`phase_11.md` section 44).
-- ---------------------------------------------------------------------------
revoke all on function public.doctor_has_care_relationship(uuid) from public;
grant execute on function public.doctor_has_care_relationship(uuid) to authenticated;

revoke all on function public.doctor_owns_appointment(uuid) from public;
grant execute on function public.doctor_owns_appointment(uuid) to authenticated;

revoke all on function public.assert_care_practitioner() from public;

revoke all on function public.search_care_patients(text, integer) from public;
grant execute on function public.search_care_patients(text, integer) to authenticated;

revoke all on function public.update_appointment_status_as_doctor(uuid, public.appointment_status) from public;
grant execute on function public.update_appointment_status_as_doctor(uuid, public.appointment_status) to authenticated;
