-- ===========================================================================
-- Clinic registers — the administrator's patient-level operational reports
--
-- `phase_16.md` sections 35 and 90 keep patient identifiers out of *general*
-- analytics and say that a report which genuinely needs them "must be a
-- separately authorized operational report". This migration is that report,
-- in three parts, shown on the clinic dashboard beside the aggregates:
--
--   clinic_appointment_register  who was booked with whom, when, and how it
--                                concluded — one page at a time
--   clinic_patient_register      the patients the clinic saw or registered in
--                                the period, with visit counts
--   clinic_recent_activity       the latest bookings, status changes,
--                                reschedules and registrations
--
-- ## Why a separate migration, a separate gate and a separate module
--
-- `20260927120000_analytics_reporting.sql` promises — and a test asserts —
-- that no analytics function returns a patient identifier. That promise stays
-- true. These functions are not analytics: they are a register, gated by
-- their own permission (`registers.read.patients`, administrator only),
-- audited per patient, and consumed by `src/features/clinic-registers/`
-- rather than by the analytics module.
--
-- ## What a row may contain
--
-- A patient's **name**, and operational facts about appointments: time,
-- practitioner, appointment type, status, counts and dates. Nothing else.
--
-- Not the phone, email, date of birth, gender or address — the front desk's
-- `search_patients()` is where contact details live, behind its own role.
-- Not `patient_note`, `internal_note` or `cancellation_reason`, which are free
-- text somebody wrote about a person. Not a single clinical column.
--
-- ## Every read is audited, in the database
--
-- `docs/SECURITY.md` section 27: administrative access to patient data must be
-- audited. Phase 13 and Phase 10 both withheld administrator access to
-- patient records on exactly that ground; Phase 19's
-- `security_audit_events` is what makes it grantable. Each function records
-- one `patient_register.read` entry **per distinct patient it returned**,
-- with that patient as `subject_patient_id` — so "who has seen this person's
-- name on a register" is the same single indexed query as every other access.
--
-- The audit call is inside the function, not in the application, so a caller
-- that skipped the application still leaves the trail. That makes these
-- functions `volatile`, which is correct: they write.
--
-- ## No enumeration surface
--
-- No patient parameter, no sort parameter, no page-size parameter. The period
-- is bounded by `analytics_assert_range`, the page size is a constant here,
-- and the page number is clamped. A caller can page through the period they
-- are allowed to see, and nothing else.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The audit vocabulary
--
-- `add value` inside a transaction is permitted from PostgreSQL 12, with the
-- restriction that the new value cannot be *used* before the transaction
-- commits. Nothing below uses it at creation time — the function bodies are
-- only resolved when called — so the migration is safe to run as one unit.
-- ---------------------------------------------------------------------------
alter type public.security_audit_action
  add value if not exists 'patient_register.read';


-- ---------------------------------------------------------------------------
-- 2. The gate
-- ---------------------------------------------------------------------------
create function public.assert_patient_register_reader()
returns void
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Administrator only. A receptionist already has the front desk's own,
  -- differently shaped patient search and schedule; a doctor has their own
  -- patients. This is the clinic-wide list, and it is the administrator's.
  if not public.has_app_role('admin') then
    raise exception 'You do not have permission to view this register.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$fn$;

comment on function public.assert_patient_register_reader() is
  'Administrator only. The gate for the patient-level clinic registers.';


-- ---------------------------------------------------------------------------
-- 3. The audit helper
--
-- One entry per distinct patient. Delegates to Phase 19's writer, which
-- resolves the actor and their role itself and swallows its own failures —
-- an audit problem must not become a failed page.
-- ---------------------------------------------------------------------------
create function public.clinic_register_audit(p_patient_ids uuid[])
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $fn$
declare
  v_patient uuid;
begin
  for v_patient in
    select distinct ids.patient
    from unnest(coalesce(p_patient_ids, '{}'::uuid[])) as ids (patient)
    where ids.patient is not null
  loop
    perform public.record_security_audit_event(
      'patient_register.read'::public.security_audit_action,
      'report'::public.security_audit_resource,
      'allowed'::public.security_audit_outcome,
      null,
      v_patient,
      null
    );
  end loop;
end;
$fn$;

comment on function public.clinic_register_audit(uuid[]) is
  'Records one patient_register.read audit entry per distinct patient shown. Internal.';


-- ---------------------------------------------------------------------------
-- 4. The appointment register
--
-- Appointments whose start falls in the period — the same membership rule as
-- every appointment figure on the dashboard, so the register's total is the
-- "Appointments" headline figure. Newest first, eight to a page.
-- ---------------------------------------------------------------------------
create function public.clinic_appointment_register(
  p_from date,
  p_to date,
  p_practitioner_id uuid default null,
  p_page integer default 1
)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  status public.appointment_status,
  patient_id uuid,
  patient_name text,
  practitioner_name text,
  appointment_type_name text,
  total_count bigint
)
language plpgsql
security definer
volatile
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  c_page_size constant integer := 8;
  v_page integer := least(greatest(coalesce(p_page, 1), 1), 1000);
  v_patients uuid[] := '{}'::uuid[];
  r record;
begin
  perform public.assert_patient_register_reader();
  perform public.analytics_assert_range(p_from, p_to);

  for r in
    select
      a.id as appointment_id,
      a.starts_at,
      a.status,
      a.patient_id,
      pt.full_name as patient_name,
      pr.display_name as practitioner_name,
      t.name as appointment_type_name,
      count(*) over () as total_count
    from public.appointments a
    join public.patients pt on pt.id = a.patient_id
    join public.practitioners pr on pr.id = a.practitioner_id
    join public.appointment_types t on t.id = a.appointment_type_id
    where a.starts_at >= public.analytics_range_start(p_from)
      and a.starts_at < public.analytics_range_end(p_to)
      and (p_practitioner_id is null or a.practitioner_id = p_practitioner_id)
    order by a.starts_at desc, a.id
    limit c_page_size
    offset (v_page - 1) * c_page_size
  loop
    appointment_id := r.appointment_id;
    starts_at := r.starts_at;
    status := r.status;
    patient_id := r.patient_id;
    patient_name := r.patient_name;
    practitioner_name := r.practitioner_name;
    appointment_type_name := r.appointment_type_name;
    total_count := r.total_count;
    v_patients := v_patients || r.patient_id;
    return next;
  end loop;

  perform public.clinic_register_audit(v_patients);
end;
$fn$;

comment on function public.clinic_appointment_register(date, date, uuid, integer) is
  'Administrator only, audited per patient. One page (8 rows) of appointments starting in the period: time, patient name, practitioner, type, status. No contact details, notes or clinical fields.';


-- ---------------------------------------------------------------------------
-- 5. The patient register
--
-- The patients the clinic had a relationship with during the period, using
-- the dashboard's own definitions (`analytics_reporting.sql`, section on
-- patient growth):
--
--   in the register  an *active* patient — at least one appointment in the
--                    period that was not cancelled — or a *new* one, whose
--                    record was created in the period.
--
--   last visit       the latest **completed** appointment up to the end of
--                    the period. Not the latest booking: a visit is something
--                    that happened.
--
-- Ordered by most recent activity, six to a page.
-- ---------------------------------------------------------------------------
create function public.clinic_patient_register(
  p_from date,
  p_to date,
  p_page integer default 1
)
returns table (
  patient_id uuid,
  patient_name text,
  registered_at timestamptz,
  is_new boolean,
  appointments_in_period bigint,
  completed_in_period bigint,
  last_visit_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
volatile
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  c_page_size constant integer := 6;
  v_page integer := least(greatest(coalesce(p_page, 1), 1), 1000);
  v_start timestamptz;
  v_end timestamptz;
  v_patients uuid[] := '{}'::uuid[];
  r record;
begin
  perform public.assert_patient_register_reader();
  perform public.analytics_assert_range(p_from, p_to);

  v_start := public.analytics_range_start(p_from);
  v_end := public.analytics_range_end(p_to);

  for r in
    with in_period as (
      select
        a.patient_id,
        count(*) filter (where a.status <> 'cancelled') as appointments,
        count(*) filter (where a.status = 'completed') as completed
      from public.appointments a
      where a.starts_at >= v_start
        and a.starts_at < v_end
      group by a.patient_id
    ),
    population as (
      select
        pt.id,
        pt.full_name,
        pt.created_at,
        (pt.created_at >= v_start and pt.created_at < v_end) as is_new,
        coalesce(ip.appointments, 0)::bigint as appointments,
        coalesce(ip.completed, 0)::bigint as completed,
        (
          select max(v.starts_at)
          from public.appointments v
          where v.patient_id = pt.id
            and v.status = 'completed'
            and v.starts_at < v_end
        ) as last_visit_at
      from public.patients pt
      left join in_period ip on ip.patient_id = pt.id
      where coalesce(ip.appointments, 0) > 0
         or (pt.created_at >= v_start and pt.created_at < v_end)
    )
    select
      p.id as patient_id,
      p.full_name as patient_name,
      p.created_at as registered_at,
      p.is_new,
      p.appointments as appointments_in_period,
      p.completed as completed_in_period,
      p.last_visit_at,
      count(*) over () as total_count
    from population p
    order by greatest(p.last_visit_at, p.created_at) desc, p.full_name, p.id
    limit c_page_size
    offset (v_page - 1) * c_page_size
  loop
    patient_id := r.patient_id;
    patient_name := r.patient_name;
    registered_at := r.registered_at;
    is_new := r.is_new;
    appointments_in_period := r.appointments_in_period;
    completed_in_period := r.completed_in_period;
    last_visit_at := r.last_visit_at;
    total_count := r.total_count;
    v_patients := v_patients || r.patient_id;
    return next;
  end loop;

  perform public.clinic_register_audit(v_patients);
end;
$fn$;

comment on function public.clinic_patient_register(date, date, integer) is
  'Administrator only, audited per patient. One page (6 rows) of patients active or registered in the period, with visit counts and last completed visit. Name only; no contact details or clinical fields.';


-- ---------------------------------------------------------------------------
-- 6. Recent activity
--
-- The latest events **recorded** during the period, newest first, at most
-- ten. Membership here is by when the event happened (`appointment_events.
-- created_at`, `patients.created_at`), not by when the appointment is for —
-- a booking made today for next month is today's activity.
--
-- Sources, both authoritative and both already written by earlier phases:
--
--   appointment_events  Phase 09's append-only history: created,
--                       status_changed, rescheduled
--   patients            a new patient record
--
-- The practitioner filter narrows appointment events to that practitioner
-- and, because a registration has no practitioner, leaves registrations out.
-- ---------------------------------------------------------------------------
create function public.clinic_recent_activity(
  p_from date,
  p_to date,
  p_practitioner_id uuid default null
)
returns table (
  occurred_at timestamptz,
  activity text,
  status public.appointment_status,
  patient_id uuid,
  patient_name text,
  practitioner_name text
)
language plpgsql
security definer
volatile
set search_path = ''
as $fn$
#variable_conflict use_column
declare
  c_limit constant integer := 10;
  v_start timestamptz;
  v_end timestamptz;
  v_patients uuid[] := '{}'::uuid[];
  r record;
begin
  perform public.assert_patient_register_reader();
  perform public.analytics_assert_range(p_from, p_to);

  v_start := public.analytics_range_start(p_from);
  v_end := public.analytics_range_end(p_to);

  for r in
    select * from (
      select
        e.created_at as occurred_at,
        case e.event_type
          when 'created' then 'booked'
          when 'rescheduled' then 'rescheduled'
          else 'status_changed'
        end as activity,
        coalesce(e.new_status, a.status) as status,
        a.patient_id,
        pt.full_name as patient_name,
        pr.display_name as practitioner_name
      from public.appointment_events e
      join public.appointments a on a.id = e.appointment_id
      join public.patients pt on pt.id = a.patient_id
      join public.practitioners pr on pr.id = a.practitioner_id
      where e.created_at >= v_start
        and e.created_at < v_end
        and (p_practitioner_id is null or a.practitioner_id = p_practitioner_id)

      union all

      select
        pt.created_at,
        'patient_registered',
        null::public.appointment_status,
        pt.id,
        pt.full_name,
        null::text
      from public.patients pt
      where p_practitioner_id is null
        and pt.created_at >= v_start
        and pt.created_at < v_end
    ) events
    order by events.occurred_at desc
    limit c_limit
  loop
    occurred_at := r.occurred_at;
    activity := r.activity;
    status := r.status;
    patient_id := r.patient_id;
    patient_name := r.patient_name;
    practitioner_name := r.practitioner_name;
    v_patients := v_patients || r.patient_id;
    return next;
  end loop;

  perform public.clinic_register_audit(v_patients);
end;
$fn$;

comment on function public.clinic_recent_activity(date, date, uuid) is
  'Administrator only, audited per patient. The ten latest appointment events and patient registrations recorded in the period. No notes, reasons or clinical fields.';


-- ---------------------------------------------------------------------------
-- 7. Grants
--
-- The same two rules as the analytics migration: revoke by name (Supabase
-- grants new functions to anon and authenticated by default), and gate in the
-- body so a restored grant restores nothing.
-- ---------------------------------------------------------------------------
revoke all on function public.assert_patient_register_reader()
  from public, anon, authenticated;
revoke all on function public.clinic_register_audit(uuid[])
  from public, anon, authenticated;

revoke all on function public.clinic_appointment_register(date, date, uuid, integer)
  from public, anon;
grant execute on function public.clinic_appointment_register(date, date, uuid, integer)
  to authenticated;

revoke all on function public.clinic_patient_register(date, date, integer)
  from public, anon;
grant execute on function public.clinic_patient_register(date, date, integer)
  to authenticated;

revoke all on function public.clinic_recent_activity(date, date, uuid)
  from public, anon;
grant execute on function public.clinic_recent_activity(date, date, uuid)
  to authenticated;


-- ---------------------------------------------------------------------------
-- 8. What this migration did not touch
--
-- No table, policy or column grant. One enum value added. Every function is
-- new; none replaces an earlier one. The only write any of them performs is
-- the audit entry, through Phase 19's own writer.
-- ---------------------------------------------------------------------------
