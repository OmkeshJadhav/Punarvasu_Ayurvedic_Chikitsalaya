-- ---------------------------------------------------------------------------
-- Phase 16 — Analytics & Reporting
--
-- ## What this migration adds, and what it deliberately does not
--
-- It adds **no table, no column and no enum**. Analytics is not a second
-- source of truth (`phase_16.md` sections 5 and 30, example 1): every number
-- this phase can produce is derived, at read time, from the authoritative
-- domain rows written by Phases 07-15. There is nothing here to fall out of
-- step with an appointment, because there is nothing here that stores one.
--
-- What it adds is a **read interface**: one authorization gate per audience,
-- a small set of internal aggregate helpers, and a thin gated wrapper per
-- question a dashboard asks. Plus the indexes those aggregates actually need.
--
-- ## Why RPC functions rather than views
--
-- Section 29 offers views, materialized views, RPCs and aggregate queries and
-- says to choose on actual requirements. A view is the wrong tool here for a
-- concrete reason: a view is evaluated with the **caller's** row-level
-- security, and the callers of clinic analytics are a receptionist and an
-- administrator — neither of whom has any policy on `prescriptions`,
-- `clinical_records` or `notification_deliveries`. A view over those tables
-- would not be refused; it would return **zero rows**, silently, and the
-- dashboard would report that the clinic issued no prescriptions this month.
--
-- A wrong number that looks right is the worst failure an analytics system
-- has. So every aggregate below is a `security definer` function that
-- authorizes explicitly and then reads with the definer's privileges — which
-- is exactly what section 55 requires of a privileged reporting function, and
-- section 56's checklist (`search_path` pinned, inputs validated, callers
-- authorized, no dynamic SQL, execution granted narrowly) is followed by
-- every one of them.
--
-- ## Why no materialized view
--
-- Section 31 is explicit: only when justified, and never for architectural
-- appearance. Punarvasu is one clinic. The heaviest query here scans one
-- year of appointments through `appointments_starts_at_idx` and groups them;
-- a materialized view would buy nothing measurable and would cost a refresh
-- strategy, a staleness label on every figure, and a class of bug where the
-- dashboard and the export disagree because one read the view and the other
-- did not. If a future Punarvasu has ten branches and five years of history,
-- the wrappers below are where one would go, behind an unchanged signature.
--
-- ## The audiences, and the gate each one goes through
--
--   admin          assert_clinic_analytics_reader()       everything
--   admin + recep  assert_operational_analytics_reader()  scheduling + growth
--   doctor         assert_care_practitioner()             their own practice
--   admin          assert_report_exporter()               the CSV export
--   patient        -- no gate admits one. No function here is callable.
--
-- Every gate is a **role** check, because the database has no permission
-- table: `config/permissions.ts` is the application's policy and
-- `docs/SECURITY.md` section 6 is what both implement. The two are asserted
-- to agree by test.
--
-- ## Scope is never a parameter
--
-- Section 8, section 54 and example 3. A doctor's practitioner scope is
-- resolved from `auth.uid()` inside `assert_care_practitioner()`; there is no
-- practitioner argument on any `analytics_practice_*` function, so there is
-- nothing for a manipulated request to carry. The clinic-wide functions do
-- take an optional practitioner **filter**, and that is a different thing: a
-- receptionist and an administrator are authorized for the whole clinic
-- already, so the filter can only ever narrow what they could have seen
-- anyway.
--
-- There is no clinic or organization parameter, because there is one clinic
-- and section 51 forbids hard-coding an id into a query. When a second
-- location exists it becomes a column on the domain tables and a predicate
-- here; nothing about this interface prevents that (section 52).
--
-- ## Privacy
--
-- Sections 3, 35, 88, 89, 90. Not one function below selects `diagnosis`,
-- `symptoms`, `clinical_observations`, `assessment`, `doctor_notes`,
-- `follow_up_notes`, `chief_complaint`, a medicine name, a dose, a plan
-- title, a document title, a storage path, a notification title, a
-- notification body, a patient name, a patient phone number or a patient
-- email address.
--
-- Every return signature is a count, a rate, a date bucket, a status, a
-- channel or a practitioner's **professional** display name. A patient
-- identifier appears in no return type at all, so section 59's enumeration
-- API cannot be built out of these parts: there is no `p_patient_id`
-- argument anywhere in this migration.
--
-- ## Date semantics, once
--
-- Every range in this file is a pair of **clinic calendar dates** and is
-- interpreted as the half-open instant range
--
--     [ p_from 00:00 clinic-local , (p_to + 1 day) 00:00 clinic-local )
--
-- so the start date is inclusive, the end date is inclusive as a *day*, and
-- no appointment can fall into two buckets or into none. The timezone is
-- `public.clinic_timezone()` — Phase 09's, not the server's and not the
-- viewer's (section 25). `src/features/analytics/ranges.ts` mirrors this and
-- is asserted against it by test.
--
-- An appointment belongs to the clinic day its **`starts_at`** falls on: the
-- day the care was scheduled for, not the day somebody typed it in. That is
-- the semantic every appointment metric in this file uses, and it is the one
-- a clinic means by "how many appointments did we have in March".
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Range rules
--
-- Sections 24, 26, 82 and example 6. A range is bounded in the database, not
-- only in the form, because the form is not what protects the database from
-- a request that asks for every appointment since 2010.
--
-- **`max_range_days` is what does the protecting.** A period is at most a
-- year however early it starts, so the scan is bounded whatever the dates
-- are. `earliest_date` is a *sanity floor* underneath it and nothing more:
-- it refuses an obviously wrong year without constraining a legitimate
-- lookback.
--
-- It is deliberately far below the clinic's first record rather than level
-- with it. A floor set at the first migration would make "the last twelve
-- months" refuse itself for a year after launch — which is how a bound
-- chosen for tidiness becomes a preset nobody can use.
--
-- The numbers are mirrored by `src/config/analytics.ts` and asserted against
-- this function by `src/config/analytics.test.ts`, the same arrangement
-- Phases 09, 14 and 15 have for their own rules.
-- ---------------------------------------------------------------------------
create function public.analytics_range_rules()
returns table (
  max_range_days integer,
  earliest_date date,
  daily_granularity_max_days integer,
  weekly_granularity_max_days integer
)
language sql
immutable
parallel safe
as $fn$
  select
    366::integer,          -- one year, inclusive of both ends plus a leap day
    date '2020-01-01',     -- a sanity floor; see the comment above
    31::integer,           -- up to a month reads day by day
    122::integer;          -- up to four months reads week by week
$fn$;

comment on function public.analytics_range_rules() is
  'Bounds and trend granularity thresholds for analytics. Mirrored by ANALYTICS_RANGE_RULES in src/config/analytics.ts, which is asserted against this file by test.';


-- The half-open instant range a pair of clinic dates denotes. See the header.
create function public.analytics_range_start(p_from date)
returns timestamptz
language sql
stable
parallel safe
set search_path = ''
as $fn$
  select (p_from::timestamp at time zone public.clinic_timezone());
$fn$;

create function public.analytics_range_end(p_to date)
returns timestamptz
language sql
stable
parallel safe
set search_path = ''
as $fn$
  select ((p_to + 1)::timestamp at time zone public.clinic_timezone());
$fn$;


-- ---------------------------------------------------------------------------
-- Range validation.
--
-- Raised codes are disjoint from every earlier phase's: appointments hold
-- PV001-PV019, prescriptions PV020-PV025, treatment plans PV030-PV035,
-- documents PV040-PV047, notifications PV050-PV059. Analytics takes PV060+.
-- ---------------------------------------------------------------------------
create function public.analytics_assert_range(p_from date, p_to date)
returns void
language plpgsql
stable
parallel safe
set search_path = ''
as $fn$
declare
  rules record;
begin
  if p_from is null or p_to is null then
    raise exception 'A reporting period is required.'
      using errcode = 'PV060';
  end if;

  if p_from > p_to then
    raise exception 'The reporting period ends before it starts.'
      using errcode = 'PV060';
  end if;

  select * into rules from public.analytics_range_rules();

  -- Inclusive of both ends, which is how the range is interpreted, so a
  -- 366-day maximum means "up to a year" rather than "up to a year and a day".
  if (p_to - p_from) + 1 > rules.max_range_days then
    raise exception 'That reporting period is longer than this report supports.'
      using errcode = 'PV061';
  end if;

  if p_from < rules.earliest_date then
    raise exception 'That reporting period starts before the clinic has records.'
      using errcode = 'PV062';
  end if;
end;
$fn$;

comment on function public.analytics_assert_range(date, date) is
  'Bounds every analytics range. Raises PV060 (invalid ordering), PV061 (too long) or PV062 (before the supported floor). Called first by every public analytics function, after its authorization gate.';


-- ---------------------------------------------------------------------------
-- Trend granularity (section 27).
--
-- Derived from the range rather than chosen by the caller, so there is one
-- fewer input to validate and the number of points a chart can be asked for
-- is bounded by construction: at most 31 daily points, at most 18 weekly,
-- at most 13 monthly. `src/config/analytics.ts` derives the same value from
-- the same thresholds for labelling, and the mirror test asserts they agree.
-- ---------------------------------------------------------------------------
create function public.analytics_trend_granularity(p_from date, p_to date)
returns text
language plpgsql
stable
parallel safe
set search_path = ''
as $fn$
declare
  rules record;
  span integer := (p_to - p_from) + 1;
begin
  select * into rules from public.analytics_range_rules();

  if span <= rules.daily_granularity_max_days then
    return 'day';
  elsif span <= rules.weekly_granularity_max_days then
    return 'week';
  else
    return 'month';
  end if;
end;
$fn$;


-- Minutes covered by a multirange. Used by the utilization aggregate, where
-- both figures are the duration of a set of instants rather than of a single
-- interval — which is what makes them impossible to make negative.
create function public.analytics_multirange_minutes(p_ranges tstzmultirange)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $fn$
  select coalesce(
    (
      select sum(extract(epoch from (upper(r) - lower(r))) / 60.0)
      from unnest(p_ranges) r
    ),
    0
  )::numeric;
$fn$;


-- ---------------------------------------------------------------------------
-- 2. Authorization gates
--
-- Each is the single place its audience is defined, so moving a capability
-- between roles is an edit to one function body rather than a search.
--
-- Every one raises `insufficient_privilege` (42501) with copy that names no
-- role, no permission and no policy — the same discipline the application's
-- forbidden page follows (`phase_08.md` section 12).
-- ---------------------------------------------------------------------------
create function public.assert_operational_analytics_reader()
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

  -- The front desk runs the clinic's diary and registers its patients, so
  -- scheduling volume, outcome rates and patient growth are the numbers about
  -- their own work (`phase_16.md` section 6). An administrator holds this too:
  -- there is no role hierarchy in this product, so it is listed rather than
  -- inherited.
  if not (
    public.has_app_role('admin') or public.has_app_role('receptionist')
  ) then
    raise exception 'You do not have permission to view these analytics.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$fn$;

comment on function public.assert_operational_analytics_reader() is
  'Admin or receptionist. The gate for clinic-wide scheduling and patient growth analytics.';


create function public.assert_clinic_analytics_reader()
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

  -- Administrator only. Notification delivery performance is a systems
  -- concern rather than a scheduling one, and clinical *activity* counts —
  -- prescriptions issued, plans activated, consultations documented — sit on
  -- the far side of `docs/SECURITY.md` section 6's hard receptionist
  -- boundary. An aggregate is not a prescription, but "operational, never
  -- clinical" is a line worth keeping bright rather than arguing about per
  -- figure.
  if not public.has_app_role('admin') then
    raise exception 'You do not have permission to view these analytics.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$fn$;

comment on function public.assert_clinic_analytics_reader() is
  'Administrator only. The gate for notification delivery and clinical activity aggregates.';


create function public.assert_report_exporter()
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

  -- Section 44: exporting is a stronger capability than viewing, and the two
  -- are separate permissions in `config/permissions.ts`. The body happens to
  -- be the same role check as the clinic reader today; it is a function of
  -- its own so that changing who may export is one edit rather than a
  -- widening of who may read.
  if not public.has_app_role('admin') then
    raise exception 'You do not have permission to export reports.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$fn$;

comment on function public.assert_report_exporter() is
  'Administrator only. The gate for report export, deliberately separate from the read gate even though the role check currently matches.';


-- ---------------------------------------------------------------------------
-- 3. Internal aggregates
--
-- These take an explicit scope and perform **no** authorization. They are
-- unreachable by any client role — no grant, and nothing in this file grants
-- one — and are called only from the gated wrappers in section 4, which run
-- as the definer and therefore may execute them.
--
-- Splitting them out is what stops the doctor's own-practice functions being
-- a second implementation of the clinic ones. Section 93: one definition of a
-- metric, consumed by the dashboard, the API and the export alike.
-- ---------------------------------------------------------------------------

-- Appointment counts by status over an instant range, optionally narrowed to
-- one practitioner.
--
-- `eligible` is the denominator every rate in this product divides by, and it
-- is defined once, here: an appointment **whose outcome is known** —
-- completed, cancelled or a no-show. Section 14 asks for the denominator to be
-- explicit and warns against casually mixing statuses, and this is the mix
-- that is not casual: an appointment that is still `requested`, `confirmed`,
-- `checked_in` or `in_consultation` has not happened yet, and counting it as a
-- denominator would make a cancellation rate for March fall every time
-- somebody books an appointment in April.
--
-- The three rates therefore sum to exactly 1 whenever `eligible > 0`, which
-- is a property the metric tests assert.
create function public.analytics_appointment_counts(
  p_start timestamptz,
  p_end timestamptz,
  p_practitioner_id uuid
)
returns table (
  total bigint,
  requested bigint,
  confirmed bigint,
  checked_in bigint,
  in_consultation bigint,
  completed bigint,
  cancelled bigint,
  no_show bigint,
  eligible bigint
)
language sql
stable
parallel safe
set search_path = ''
as $fn$
  select
    count(*)::bigint,
    count(*) filter (where a.status = 'requested')::bigint,
    count(*) filter (where a.status = 'confirmed')::bigint,
    count(*) filter (where a.status = 'checked_in')::bigint,
    count(*) filter (where a.status = 'in_consultation')::bigint,
    count(*) filter (where a.status = 'completed')::bigint,
    count(*) filter (where a.status = 'cancelled')::bigint,
    count(*) filter (where a.status = 'no_show')::bigint,
    count(*) filter (
      where a.status in ('completed', 'cancelled', 'no_show')
    )::bigint
  from public.appointments a
  where a.starts_at >= p_start
    and a.starts_at < p_end
    and (p_practitioner_id is null or a.practitioner_id = p_practitioner_id);
$fn$;

comment on function public.analytics_appointment_counts(timestamptz, timestamptz, uuid) is
  'Appointment status counts over a half-open instant range. The single definition of the rate denominator: eligible = completed + cancelled + no_show. Internal; no client role may execute it.';


-- The appointment trend, bucketed in the clinic timezone.
--
-- Every bucket in the range is emitted, including the empty ones, so that a
-- quiet Sunday is a zero rather than a gap the chart closes up — section 96's
-- zero-versus-missing distinction expressed in the data rather than left to
-- the renderer.
create function public.analytics_appointment_buckets(
  p_from date,
  p_to date,
  p_practitioner_id uuid
)
returns table (
  bucket_start date,
  total bigint,
  completed bigint,
  cancelled bigint,
  no_show bigint
)
language sql
stable
set search_path = ''
as $fn$
  with granularity as (
    select public.analytics_trend_granularity(p_from, p_to) as unit
  ),
  buckets as (
    select distinct
      date_trunc((select unit from granularity), d)::date as bucket_start
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  ),
  scoped as (
    select
      date_trunc(
        (select unit from granularity),
        a.starts_at at time zone public.clinic_timezone()
      )::date as bucket_start,
      a.status
    from public.appointments a
    where a.starts_at >= public.analytics_range_start(p_from)
      and a.starts_at < public.analytics_range_end(p_to)
      and (p_practitioner_id is null or a.practitioner_id = p_practitioner_id)
  )
  select
    b.bucket_start,
    count(s.status)::bigint,
    count(*) filter (where s.status = 'completed')::bigint,
    count(*) filter (where s.status = 'cancelled')::bigint,
    count(*) filter (where s.status = 'no_show')::bigint
  from buckets b
  left join scoped s on s.bucket_start = b.bucket_start
  group by b.bucket_start
  order by b.bucket_start;
$fn$;

comment on function public.analytics_appointment_buckets(date, date, uuid) is
  'Appointment counts per trend bucket, in the clinic timezone, with empty buckets emitted as zeroes. Internal; no client role may execute it.';


-- ---------------------------------------------------------------------------
-- Utilization (sections 17-18).
--
-- Implemented because Phase 09's model carries the authoritative data section
-- 17 requires it to be based on, and it assumes nothing Phase 09 does not say.
--
--   available = the practitioner's recurring working intervals on each clinic
--               day in the range, merged so an overlapping roster entry is not
--               counted twice, minus every blocked period that overlaps them
--               (the practitioner's own leave and clinic-wide closures alike)
--
--   booked    = the part of those remaining windows covered by an appointment
--               that holds a slot — every status except `cancelled`, which is
--               `holdsSlot()` in `features/appointments/status.ts` and the
--               same predicate the exclusion constraint uses
--
--   utilization = booked / available, and null when available is zero
--
-- Two deliberate properties, both of which section 97 asks for:
--
-- * Booked time is **clamped to available time** by intersecting the two
--   multiranges. An appointment the front desk placed outside the roster is
--   real and appears in every count, but it cannot push utilization above
--   100%, which would be a number nobody could act on.
-- * Neither figure can be negative, because both are sums of multirange
--   durations.
--
-- `range_agg` merges overlapping intervals, which is why a roster with two
-- overlapping Tuesday entries reports one Tuesday rather than two.
-- ---------------------------------------------------------------------------
create function public.analytics_utilization(
  p_from date,
  p_to date,
  p_practitioner_id uuid
)
returns table (
  practitioner_id uuid,
  booked_minutes numeric,
  available_minutes numeric
)
language sql
stable
set search_path = ''
as $fn$
  with scope as (
    select p.id
    from public.practitioners p
    where p_practitioner_id is null or p.id = p_practitioner_id
  ),
  days as (
    select d::date as clinic_day
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  ),
  windows as (
    select
      s.id as practitioner_id,
      range_agg(
        tstzrange(
          ((d.clinic_day + av.starts_at) at time zone public.clinic_timezone()),
          ((d.clinic_day + av.ends_at) at time zone public.clinic_timezone()),
          '[)'
        )
      ) as roster
    from scope s
    join public.practitioner_availability av
      on av.practitioner_id = s.id
     and av.is_active
    join days d
      on av.weekday = extract(dow from d.clinic_day)::smallint
    group by s.id
  ),
  blocked as (
    select
      s.id as practitioner_id,
      range_agg(tstzrange(e.starts_at, e.ends_at, '[)')) as closed
    from scope s
    join public.schedule_exceptions e
      on e.practitioner_id is null or e.practitioner_id = s.id
    where e.starts_at < public.analytics_range_end(p_to)
      and e.ends_at > public.analytics_range_start(p_from)
    group by s.id
  ),
  taken as (
    select
      s.id as practitioner_id,
      range_agg(tstzrange(a.starts_at, a.ends_at, '[)')) as booked
    from scope s
    join public.appointments a
      on a.practitioner_id = s.id
    where a.status <> 'cancelled'
      and a.starts_at >= public.analytics_range_start(p_from)
      and a.starts_at < public.analytics_range_end(p_to)
    group by s.id
  ),
  net as (
    select
      s.id as practitioner_id,
      coalesce(w.roster, '{}'::tstzmultirange)
        - coalesce(b.closed, '{}'::tstzmultirange) as open_time,
      coalesce(t.booked, '{}'::tstzmultirange) as booked
    from scope s
    left join windows w on w.practitioner_id = s.id
    left join blocked b on b.practitioner_id = s.id
    left join taken t on t.practitioner_id = s.id
  )
  select
    n.practitioner_id,
    public.analytics_multirange_minutes(n.open_time * n.booked),
    public.analytics_multirange_minutes(n.open_time)
  from net n;
$fn$;

comment on function public.analytics_utilization(date, date, uuid) is
  'Booked and available minutes per practitioner, from Phase 09 availability and blocked periods. Booked time is clamped to available time, so utilization cannot exceed 100%. Internal; no client role may execute it.';


-- ---------------------------------------------------------------------------
-- 4. Public read interface — clinic scheduling and growth
--
-- Admin and receptionist. Each is a gate, a range check and a call into
-- section 3; none contains a metric definition of its own.
-- ---------------------------------------------------------------------------
create function public.analytics_clinic_appointment_summary(
  p_from date,
  p_to date,
  p_practitioner_id uuid default null
)
returns table (
  total bigint,
  requested bigint,
  confirmed bigint,
  checked_in bigint,
  in_consultation bigint,
  completed bigint,
  cancelled bigint,
  no_show bigint,
  eligible bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_operational_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select *
    from public.analytics_appointment_counts(
      public.analytics_range_start(p_from),
      public.analytics_range_end(p_to),
      p_practitioner_id
    );
end;
$fn$;


create function public.analytics_clinic_appointment_trend(
  p_from date,
  p_to date,
  p_practitioner_id uuid default null
)
returns table (
  bucket_start date,
  total bigint,
  completed bigint,
  cancelled bigint,
  no_show bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_operational_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select *
    from public.analytics_appointment_buckets(p_from, p_to, p_practitioner_id);
end;
$fn$;


-- Practitioner workload (sections 19-20).
--
-- **Operational figures only.** Volume, outcome counts, and time booked
-- against time available. Nothing here touches a diagnosis, a prescription or
-- an outcome, and there is no column in the return type for one, so section
-- 20's prohibition on ranking practitioners by clinical behaviour is a
-- property of the interface rather than a rule somebody has to remember.
--
-- The display name is the practitioner's professional scheduling name — the
-- one already printed on the diary every receptionist reads all day.
create function public.analytics_clinic_practitioner_workload(
  p_from date,
  p_to date
)
returns table (
  practitioner_id uuid,
  display_name text,
  is_active boolean,
  total bigint,
  completed bigint,
  cancelled bigint,
  no_show bigint,
  eligible bigint,
  booked_minutes numeric,
  available_minutes numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_operational_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  -- One grouped scan plus one utilization pass, joined on the practitioner.
  -- Deliberately not a per-practitioner loop: section 81's N+1 is exactly the
  -- shape "list practitioners, then query appointments for each" takes, and
  -- it is the easiest mistake to make on this particular report.
  return query
    with counts as (
      select
        a.practitioner_id,
        count(*)::bigint as total,
        count(*) filter (where a.status = 'completed')::bigint as completed,
        count(*) filter (where a.status = 'cancelled')::bigint as cancelled,
        count(*) filter (where a.status = 'no_show')::bigint as no_show,
        count(*) filter (
          where a.status in ('completed', 'cancelled', 'no_show')
        )::bigint as eligible
      from public.appointments a
      where a.starts_at >= public.analytics_range_start(p_from)
        and a.starts_at < public.analytics_range_end(p_to)
      group by a.practitioner_id
    ),
    utilization as (
      select * from public.analytics_utilization(p_from, p_to, null)
    )
    select
      p.id,
      p.display_name,
      p.is_active,
      coalesce(c.total, 0)::bigint,
      coalesce(c.completed, 0)::bigint,
      coalesce(c.cancelled, 0)::bigint,
      coalesce(c.no_show, 0)::bigint,
      coalesce(c.eligible, 0)::bigint,
      coalesce(u.booked_minutes, 0)::numeric,
      coalesce(u.available_minutes, 0)::numeric
    from public.practitioners p
    left join counts c on c.practitioner_id = p.id
    left join utilization u on u.practitioner_id = p.id
    -- An inactive practitioner with no activity in the range is not part of
    -- this report; one who *did* work in the range still is, because removing
    -- them would make the clinic total disagree with the rows beneath it.
    where p.is_active or coalesce(c.total, 0) > 0
    order by coalesce(c.total, 0) desc, p.display_name;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- Patient growth (sections 21-23).
--
-- Three definitions, each written down here because section 21 asks for them
-- to be defined before implementation and section 22 forbids the lazy one.
--
--   new        a `public.patients` row created in the range. That is the
--              clinic acquiring a patient *record*, by either route Phase 07
--              and Phase 10 allow — a patient completing their own profile, or
--              a receptionist registering a walk-in at the desk. It is
--              deliberately **not** `auth.users.created_at`: an account is not
--              a patient, which is precisely section 22's warning.
--
--   returning  a patient with a completed appointment inside the range who
--              also has an earlier completed appointment **before** the range
--              started. Section 23 offers "more than one completed
--              appointment"; this is that, anchored to the range, so the
--              figure means "came back to us during this period" rather than
--              "has ever been here twice".
--
--   active     a patient with at least one appointment in the range that was
--              not cancelled. The clinic had a relationship with them during
--              the period, whether or not the visit has happened yet.
--
-- A patient can be counted in more than one of the three, and that is correct:
-- they are three different questions, not a partition.
-- ---------------------------------------------------------------------------
create function public.analytics_clinic_patient_summary(p_from date, p_to date)
returns table (
  new_patients bigint,
  returning_patients bigint,
  active_patients bigint,
  total_patients bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
declare
  range_start timestamptz;
  range_end timestamptz;
begin
  perform public.assert_operational_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  range_start := public.analytics_range_start(p_from);
  range_end := public.analytics_range_end(p_to);

  return query
    select
      (
        select count(*)::bigint
        from public.patients pt
        where pt.created_at >= range_start and pt.created_at < range_end
      ),
      (
        select count(distinct a.patient_id)::bigint
        from public.appointments a
        where a.status = 'completed'
          and a.starts_at >= range_start
          and a.starts_at < range_end
          and exists (
            select 1
            from public.appointments earlier
            where earlier.patient_id = a.patient_id
              and earlier.status = 'completed'
              and earlier.starts_at < range_start
          )
      ),
      (
        select count(distinct a.patient_id)::bigint
        from public.appointments a
        where a.status <> 'cancelled'
          and a.starts_at >= range_start
          and a.starts_at < range_end
      ),
      -- A point-in-time count as at the end of the range, not a count of the
      -- whole table: a report about March must read the same in April.
      (
        select count(*)::bigint
        from public.patients pt
        where pt.created_at < range_end
      );
end;
$fn$;


create function public.analytics_clinic_patient_growth(p_from date, p_to date)
returns table (
  bucket_start date,
  new_patients bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_operational_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    with granularity as (
      select public.analytics_trend_granularity(p_from, p_to) as unit
    ),
    buckets as (
      select distinct
        date_trunc((select unit from granularity), d)::date as bucket_start
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
    ),
    registered as (
      select
        date_trunc(
          (select unit from granularity),
          pt.created_at at time zone public.clinic_timezone()
        )::date as bucket_start
      from public.patients pt
      where pt.created_at >= public.analytics_range_start(p_from)
        and pt.created_at < public.analytics_range_end(p_to)
    )
    select b.bucket_start, count(r.bucket_start)::bigint
    from buckets b
    left join registered r on r.bucket_start = b.bucket_start
    group by b.bucket_start
    order by b.bucket_start;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- 5. Public read interface — administrator only
-- ---------------------------------------------------------------------------

-- Notification delivery (sections 40-41, 86, example 8).
--
-- Phase 15's own states, reported as they are and named as they are. There is
-- deliberately **no `delivered`** and no "delivery rate": Phase 15 records
-- `sent` to mean *the provider accepted the request*, which is the strongest
-- claim any configured provider supports, and section 41 forbids calling that
-- delivery. What this returns is the raw state counts; the application labels
-- the derived figure "acceptance rate" and says in words what it does and
-- does not mean.
--
-- No title, no body, no recipient and no provider message id crosses this
-- boundary — none of them is in the return type.
create function public.analytics_notification_delivery_summary(
  p_from date,
  p_to date
)
returns table (
  channel public.notification_channel,
  provider text,
  pending bigint,
  sent bigint,
  failed bigint,
  skipped bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_clinic_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select
      d.channel,
      d.provider,
      count(*) filter (where d.status = 'pending')::bigint,
      count(*) filter (where d.status = 'sent')::bigint,
      count(*) filter (where d.status = 'failed')::bigint,
      count(*) filter (where d.status = 'skipped')::bigint
    from public.notification_deliveries d
    where d.created_at >= public.analytics_range_start(p_from)
      and d.created_at < public.analytics_range_end(p_to)
    group by d.channel, d.provider
    order by d.channel, d.provider;
end;
$fn$;


-- In-app notifications are not a delivery attempt — the row *is* the
-- delivery, which `notification_deliveries_external_only` enforces. So the
-- in-app picture is a count of notifications by state, reported separately
-- rather than folded into the table above where it would look like a channel
-- that never sends anything.
create function public.analytics_notification_summary(p_from date, p_to date)
returns table (
  category public.notification_category,
  scheduled bigint,
  active bigint,
  cancelled bigint,
  read_count bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_clinic_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select
      n.category,
      count(*) filter (where n.status = 'scheduled')::bigint,
      count(*) filter (where n.status = 'active')::bigint,
      count(*) filter (where n.status = 'cancelled')::bigint,
      count(*) filter (where n.read_at is not null)::bigint
    from public.notifications n
    where n.created_at >= public.analytics_range_start(p_from)
      and n.created_at < public.analytics_range_end(p_to)
    group by n.category
    order by n.category;
end;
$fn$;


-- Clinical **activity** (sections 36-39).
--
-- Four counts of things the clinic did, and nothing about what was in them.
-- Section 36 rules out diagnosis frequency, disease prevalence, medicine
-- effectiveness and outcome rankings; section 37 rules out medicine-level
-- prescribing patterns; section 39 rules out document contents. None of those
-- has a column here, and none of the tables read below is joined to a column
-- that carries clinical text.
--
-- Date semantics differ per figure and each is the moment the act happened:
-- a prescription counts on its `issued_at`, a plan on its `activated_at`, a
-- consultation on its `completed_at`, a document on its `created_at`. A draft
-- counts nowhere, because a draft is not an act.
create function public.analytics_clinical_activity_summary(
  p_from date,
  p_to date
)
returns table (
  prescriptions_issued bigint,
  treatment_plans_activated bigint,
  consultations_documented bigint,
  documents_uploaded bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
declare
  range_start timestamptz;
  range_end timestamptz;
begin
  perform public.assert_clinic_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  range_start := public.analytics_range_start(p_from);
  range_end := public.analytics_range_end(p_to);

  return query
    select
      (
        select count(*)::bigint
        from public.prescriptions p
        where p.issued_at >= range_start and p.issued_at < range_end
      ),
      (
        select count(*)::bigint
        from public.treatment_plans tp
        where tp.activated_at >= range_start and tp.activated_at < range_end
      ),
      (
        select count(*)::bigint
        from public.clinical_records cr
        where cr.completed_at >= range_start and cr.completed_at < range_end
      ),
      (
        select count(*)::bigint
        from public.patient_documents pd
        where pd.created_at >= range_start and pd.created_at < range_end
      );
end;
$fn$;


-- Document volume by type (section 39). The *type* is an operational
-- category — a lab report, a referral — and is as far as this goes. No title,
-- no storage path, no file name, no content.
create function public.analytics_document_type_summary(p_from date, p_to date)
returns table (
  document_type public.patient_document_type,
  uploaded bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_clinic_analytics_reader();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select pd.document_type, count(*)::bigint
    from public.patient_documents pd
    where pd.created_at >= public.analytics_range_start(p_from)
      and pd.created_at < public.analytics_range_end(p_to)
    group by pd.document_type
    order by count(*) desc, pd.document_type;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- 6. Public read interface — a practitioner's own practice
--
-- Section 54 and example 3. **No practitioner argument.** The scope is
-- resolved from `auth.uid()` by Phase 11's own gate, which also refuses a
-- doctor account that is not on the scheduling roster — so there is nothing a
-- manipulated request can carry, and nothing that falls through to "every
-- practitioner" when the account has no practitioner record.
--
-- The doctor sees no other practitioner's figures and no clinic-wide total,
-- because neither is in any of these return types.
-- ---------------------------------------------------------------------------
create function public.analytics_practice_appointment_summary(
  p_from date,
  p_to date
)
returns table (
  total bigint,
  requested bigint,
  confirmed bigint,
  checked_in bigint,
  in_consultation bigint,
  completed bigint,
  cancelled bigint,
  no_show bigint,
  eligible bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
declare
  practitioner uuid;
begin
  practitioner := public.assert_care_practitioner();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select *
    from public.analytics_appointment_counts(
      public.analytics_range_start(p_from),
      public.analytics_range_end(p_to),
      practitioner
    );
end;
$fn$;


create function public.analytics_practice_appointment_trend(
  p_from date,
  p_to date
)
returns table (
  bucket_start date,
  total bigint,
  completed bigint,
  cancelled bigint,
  no_show bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
declare
  practitioner uuid;
begin
  practitioner := public.assert_care_practitioner();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select *
    from public.analytics_appointment_buckets(p_from, p_to, practitioner);
end;
$fn$;


create function public.analytics_practice_utilization(p_from date, p_to date)
returns table (
  booked_minutes numeric,
  available_minutes numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
declare
  practitioner uuid;
begin
  practitioner := public.assert_care_practitioner();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select u.booked_minutes, u.available_minutes
    from public.analytics_utilization(p_from, p_to, practitioner) u;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- 7. The export report (sections 43-48, 92, 114, example 4)
--
-- One report, defined here and nowhere else:
--
--   Name          Appointment operations
--   Purpose       What the clinic scheduled, and how it turned out
--   Audience      Administrator
--   Data source   public.appointments, joined to the practitioner and the
--                 appointment type for their names
--   Filters       clinic date range (bounded), optional practitioner
--   Calculation   a count per (clinic day, practitioner, type, status)
--   Permissions   reports.export in the application, assert_report_exporter()
--                 here
--   Export fields exactly the five columns below
--
-- It is **aggregated rather than a row per appointment**, which is the
-- difference between section 35's two examples. A row per appointment would
-- carry a date, a time and a practitioner for one identifiable person's visit,
-- and a spreadsheet of those leaves the clinic on a laptop. A count per day,
-- practitioner, type and status answers every operational question an
-- administrator actually asks of this report and identifies nobody.
--
-- There is no patient id, no patient name, no note and no internal note in
-- the return type, so section 45's bad example cannot be produced from this
-- function however it is called.
-- ---------------------------------------------------------------------------
create function public.analytics_appointment_report(
  p_from date,
  p_to date,
  p_practitioner_id uuid default null
)
returns table (
  clinic_date date,
  practitioner_name text,
  appointment_type_name text,
  status public.appointment_status,
  appointment_count bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_report_exporter();
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select
      (a.starts_at at time zone public.clinic_timezone())::date,
      p.display_name,
      t.name,
      a.status,
      count(*)::bigint
    from public.appointments a
    join public.practitioners p on p.id = a.practitioner_id
    join public.appointment_types t on t.id = a.appointment_type_id
    where a.starts_at >= public.analytics_range_start(p_from)
      and a.starts_at < public.analytics_range_end(p_to)
      and (p_practitioner_id is null or a.practitioner_id = p_practitioner_id)
    group by 1, 2, 3, 4
    order by 1, 2, 3, 4;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- 8. Indexes (sections 79-80)
--
-- Only what the aggregates above actually scan. Section 80 is explicit that
-- an index should be supported by a real query pattern, so each of these is
-- named after the function that needs it, and the ones already present are
-- listed rather than duplicated:
--
--   appointments_starts_at_idx          Phase 10. Every appointment aggregate
--                                       here is a range scan on starts_at.
--   appointments_practitioner_idx       Phase 09, (practitioner_id, starts_at).
--                                       Serves the practitioner-filtered path.
--   practitioner_availability_lookup_idx Phase 09. The utilization roster join.
--   schedule_exceptions_window_idx      Phase 09. The blocked-period overlap.
--
-- `appointments.status` deliberately gets no index of its own: every query
-- here filters by range first and aggregates statuses within it, so a status
-- index would be scanned past rather than used.
-- ---------------------------------------------------------------------------

-- Patient growth: a range scan on registration time.
create index patients_created_at_idx on public.patients (created_at);

-- Clinical activity. Partial, because a draft has no moment and there is no
-- query that wants one — which also keeps each index to the rows that exist.
create index prescriptions_issued_at_idx
  on public.prescriptions (issued_at)
  where issued_at is not null;

create index treatment_plans_activated_at_idx
  on public.treatment_plans (activated_at)
  where activated_at is not null;

create index clinical_records_completed_at_idx
  on public.clinical_records (completed_at)
  where completed_at is not null;

create index patient_documents_created_at_idx
  on public.patient_documents (created_at);

-- Notification analytics.
create index notifications_created_at_idx on public.notifications (created_at);

create index notification_deliveries_created_at_idx
  on public.notification_deliveries (created_at);


-- ---------------------------------------------------------------------------
-- 9. Grants
--
-- Two rules, and the second is the one Phase 15 had to learn the hard way.
--
-- 1. **Revoke by name, not from PUBLIC alone.** Supabase's project bootstrap
--    carries `alter default privileges ... grant execute on functions to anon,
--    authenticated, service_role`, so a newly created function is granted to
--    those roles *by name* at creation time. `revoke ... from public` removes
--    only the PUBLIC grant and leaves the named ones. Every revoke below names
--    `anon` explicitly, and the internal helpers name `authenticated` too.
--
-- 2. **The gate is in the body as well.** Every public function starts with
--    its gate, so restoring a grant by accident — a later
--    `alter default privileges`, a careless migration, a platform change —
--    does not restore access. That is why section 3's helpers are safe to be
--    ungranted rather than gated: they are unreachable *and* only ever called
--    from something that has already authorized.
--
-- `anon` receives nothing at all. A signed-out request has no business asking
-- the clinic how many appointments it had.
-- ---------------------------------------------------------------------------

-- Configuration and helpers: internal. No client role may execute them.
revoke all on function public.analytics_range_rules()
  from public, anon, authenticated;
revoke all on function public.analytics_range_start(date)
  from public, anon, authenticated;
revoke all on function public.analytics_range_end(date)
  from public, anon, authenticated;
revoke all on function public.analytics_assert_range(date, date)
  from public, anon, authenticated;
revoke all on function public.analytics_trend_granularity(date, date)
  from public, anon, authenticated;
revoke all on function public.analytics_multirange_minutes(tstzmultirange)
  from public, anon, authenticated;
revoke all on function public.analytics_appointment_counts(timestamptz, timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function public.analytics_appointment_buckets(date, date, uuid)
  from public, anon, authenticated;
revoke all on function public.analytics_utilization(date, date, uuid)
  from public, anon, authenticated;

-- Gates: internal. They are called by the functions below, never directly.
revoke all on function public.assert_operational_analytics_reader()
  from public, anon, authenticated;
revoke all on function public.assert_clinic_analytics_reader()
  from public, anon, authenticated;
revoke all on function public.assert_report_exporter()
  from public, anon, authenticated;

-- The public interface: reachable by a signed-in user, refused in the body by
-- anyone whose role the gate does not admit.
revoke all on function public.analytics_clinic_appointment_summary(date, date, uuid)
  from public, anon;
grant execute on function public.analytics_clinic_appointment_summary(date, date, uuid)
  to authenticated;

revoke all on function public.analytics_clinic_appointment_trend(date, date, uuid)
  from public, anon;
grant execute on function public.analytics_clinic_appointment_trend(date, date, uuid)
  to authenticated;

revoke all on function public.analytics_clinic_practitioner_workload(date, date)
  from public, anon;
grant execute on function public.analytics_clinic_practitioner_workload(date, date)
  to authenticated;

revoke all on function public.analytics_clinic_patient_summary(date, date)
  from public, anon;
grant execute on function public.analytics_clinic_patient_summary(date, date)
  to authenticated;

revoke all on function public.analytics_clinic_patient_growth(date, date)
  from public, anon;
grant execute on function public.analytics_clinic_patient_growth(date, date)
  to authenticated;

revoke all on function public.analytics_notification_delivery_summary(date, date)
  from public, anon;
grant execute on function public.analytics_notification_delivery_summary(date, date)
  to authenticated;

revoke all on function public.analytics_notification_summary(date, date)
  from public, anon;
grant execute on function public.analytics_notification_summary(date, date)
  to authenticated;

revoke all on function public.analytics_clinical_activity_summary(date, date)
  from public, anon;
grant execute on function public.analytics_clinical_activity_summary(date, date)
  to authenticated;

revoke all on function public.analytics_document_type_summary(date, date)
  from public, anon;
grant execute on function public.analytics_document_type_summary(date, date)
  to authenticated;

revoke all on function public.analytics_practice_appointment_summary(date, date)
  from public, anon;
grant execute on function public.analytics_practice_appointment_summary(date, date)
  to authenticated;

revoke all on function public.analytics_practice_appointment_trend(date, date)
  from public, anon;
grant execute on function public.analytics_practice_appointment_trend(date, date)
  to authenticated;

revoke all on function public.analytics_practice_utilization(date, date)
  from public, anon;
grant execute on function public.analytics_practice_utilization(date, date)
  to authenticated;

revoke all on function public.analytics_appointment_report(date, date, uuid)
  from public, anon;
grant execute on function public.analytics_appointment_report(date, date, uuid)
  to authenticated;


-- ---------------------------------------------------------------------------
-- 10. What this migration did not touch
--
-- No table was created, altered or dropped. No policy was created, altered or
-- dropped. No existing function was replaced. No column grant was widened.
--
-- That is the whole of section 103's "analytics must be read-only with respect
-- to the domain", stated as a property of the diff rather than as an
-- intention: there is nothing in this file that can write a domain row, and
-- nothing that can make one visible to somebody a Phase 07-15 policy would
-- have refused — because every function here reads with the definer's
-- privileges only after its own gate has decided the caller is staff.
-- ---------------------------------------------------------------------------
