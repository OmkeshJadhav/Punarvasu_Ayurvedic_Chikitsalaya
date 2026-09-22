-- ---------------------------------------------------------------------------
-- Phase 09 - Appointment Engine
--
-- Phase 06 answered "who is this user", Phase 07 "who is the patient", Phase
-- 08 "what may they do". This migration answers "when can care happen, with
-- whom, and what state is it in" - and it answers the one question in this
-- product that a web application cannot be trusted to answer on its own:
--
--     can two people book the same practitioner at the same moment?
--
-- The answer is no, and it is PostgreSQL that says so. An exclusion constraint
-- over (practitioner_id, time range) makes overlap a violated invariant rather
-- than a race the application hopes to win. `docs/DATABASE.md` section 11 is
-- explicit that application-level check-then-insert is not sufficient, and
-- `phase_09.md` section 17 makes database enforcement mandatory.
--
-- ## The shape of the trust boundary
--
-- No client holds insert, update or delete on `public.appointments`. Not the
-- patient, not a future receptionist, not anyone. Every write goes through a
-- `security definer` function that:
--
--   * derives the patient from `auth.uid()`, never from an argument;
--   * reads the duration and buffer from `appointment_types`, never from an
--     argument;
--   * sets the status itself, never from an argument;
--   * sets every timestamp itself, never from an argument;
--   * re-validates availability at the moment of the write.
--
-- That is `phase_09.md` sections 22-23, 37-38 expressed where it cannot be
-- forgotten. A request that manipulates `patientId`, `status`, `duration`,
-- `startAt` or `endAt` has nothing to act on, because none of those is an
-- input the write path reads.
--
-- This mirrors the Phase 08 `assign_user_role()` pattern deliberately: the
-- authorization check lives next to the data, so it holds whatever the calling
-- code does, and the service-role key stays out of the request path entirely.
--
-- ## What is deliberately NOT here
--
--   * **No receptionist or admin policy on appointments.** Those roles hold no
--     appointment permission in `config/permissions.ts`, their workspaces do
--     not exist, and Phase 08's rule - permissions arrive with the surfaces
--     they protect - applies. Phase 10 adds both together.
--   * **No staff write functions.** `create_appointment_for_patient`,
--     `confirm_appointment` and the rest belong to the phase that builds the
--     surface that calls them (`phase_09.md` section 32).
--   * **No seeded practitioner and no seeded availability.** Naming a
--     practitioner the clinic has not confirmed is the one thing
--     `docs/HEALTHCARE_AND_AI_SAFETY.md` forbids outright, and inventing a
--     working week for a real clinic is a claim a patient would act on.
--     `scripts/seed-dev-practitioner.mjs` populates a development environment
--     from an account that actually exists; production data arrives with the
--     administration surface in Phase 10/11.
--   * **No `location_type` column.** The clinic offers in-person consultation
--     at one verified address and telemedicine is explicitly out of scope
--     (`phase_09.md` section 73). A column that can only ever hold one value
--     holds no information; the booking screens render the verified address
--     from `config/clinic.ts`. The column arrives with the second mode.
--   * **No price column.** Payments are out of scope and no fee has been
--     verified by the clinic.
-- ---------------------------------------------------------------------------


-- `btree_gist` is what lets a gist exclusion constraint mix an equality test
-- on a scalar (practitioner_id) with an overlap test on a range. Without it,
-- gist cannot index uuid equality and the constraint below cannot be created.
create extension if not exists btree_gist;


-- ---------------------------------------------------------------------------
-- The clinic's scheduling timezone
--
-- An appointment instant is stored as `timestamptz`, which is an absolute
-- moment. "09:00 on Tuesday" is not - it is a wall-clock time in a particular
-- place, and the place has to be named somewhere rather than assumed from the
-- server's locale (`phase_09.md` sections 11-12).
--
-- It is a function rather than a literal scattered through the bodies below so
-- that there is exactly one place to change it, and one place for the
-- application's mirror in `src/config/appointments.ts` to be checked against.
-- `src/config/appointments.test.ts` reads this file and fails if the two
-- disagree.
--
-- Asia/Kolkata is derived from the clinic's *verified* postal address in
-- Satara, Maharashtra (`src/config/clinic.ts`). It is not a guess, and India
-- observes no daylight saving, which is why the arithmetic below is exact.
-- ---------------------------------------------------------------------------
create function public.clinic_timezone()
returns text
language sql
immutable
parallel safe
as $$
  select 'Asia/Kolkata'::text;
$$;

comment on function public.clinic_timezone() is
  'The clinic scheduling timezone. Mirrored by CLINIC_TIMEZONE in '
  'src/config/appointments.ts, which is asserted against this file by test.';


-- ---------------------------------------------------------------------------
-- Booking rules
--
-- `phase_09.md` section 16 asks for these to be configurable and explicitly
-- forbids hard-coding arbitrary business values without documenting them. So:
-- one function, one place, and every value below is documented as provisional.
--
-- **The clinic has confirmed none of these.** Minimum notice and booking
-- horizon are the example values from the phase specification itself (section
-- 16), chosen so the numbers are traceable to a document rather than invented.
-- The booking screen says in plain words that they are provisional.
--
-- `cancellation_cutoff_minutes` is 0 on purpose. `phase_09.md` section 28 says
-- that where the clinic has not asked for a cutoff, the decision should be
-- documented rather than a value invented - so a patient may cancel any
-- appointment that has not yet started, and nothing silently traps them into
-- attending.
--
-- These become rows in a clinic settings table when an administrator can edit
-- them. Until then a change is a migration, which is the correct amount of
-- ceremony for a rule that governs every booking.
-- ---------------------------------------------------------------------------
create function public.appointment_booking_rules()
returns table (
  min_notice_minutes integer,
  max_horizon_days integer,
  slot_interval_minutes integer,
  cancellation_cutoff_minutes integer,
  max_active_per_patient integer
)
language sql
immutable
parallel safe
as $$
  select
    120::integer,  -- minimum notice: 2 hours
    90::integer,   -- booking horizon: 90 days
    15::integer,   -- slots are offered on a 15-minute grid
    0::integer,    -- no cancellation cutoff; see the comment above
    5::integer;    -- concurrent upcoming requests one patient may hold
$$;

comment on function public.appointment_booking_rules() is
  'Provisional booking rules. None has been confirmed by the clinic. '
  'Mirrored by BOOKING_RULES in src/config/appointments.ts, which is asserted '
  'against this file by test.';


-- ---------------------------------------------------------------------------
-- Enumerations
--
-- Database enums rather than check-constrained text or free strings validated
-- in TypeScript (`docs/DATABASE.md` section 2, rule 6). A status is an
-- authorization-relevant value; 'Completed', 'COMPLETED' and 'completed' must
-- not all be storable.
--
-- The seven values are the lifecycle `docs/DATABASE.md` section 11 documents,
-- plus `no_show` from `phase_09.md` section 5. Only three are reachable in
-- this phase: an appointment is created `requested`, and a patient may take it
-- to `cancelled`. `confirmed`, `checked_in`, `in_consultation`, `completed`
-- and `no_show` are staff transitions that arrive with the receptionist and
-- doctor workspaces.
--
-- They are declared now rather than added later for a concrete reason:
-- PostgreSQL will not let a value added by `alter type ... add value` be
-- *used* in the same transaction, and Supabase applies each migration file in
-- one. A later phase adding and using a status in a single migration would
-- fail; declaring the documented lifecycle up front removes that trap. An enum
-- value that nothing writes costs nothing.
-- ---------------------------------------------------------------------------
create type public.appointment_status as enum (
  'requested',
  'confirmed',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show'
);

comment on type public.appointment_status is
  'Appointment lifecycle per docs/DATABASE.md section 11. Transitions are '
  'constrained by public.appointments_guard_transition(); a client cannot set '
  'a status at all, because no client holds insert or update on the table.';

create type public.appointment_event_type as enum (
  'created',
  'status_changed',
  'rescheduled'
);


-- ---------------------------------------------------------------------------
-- Practitioners
--
-- The *scheduling* identity of a practitioner, and nothing more.
--
-- This table deliberately holds no qualification, no registration number and
-- no biography. Those are clinical credentials, they are facts a patient
-- decides on, and the clinic has confirmed none of them - the public directory
-- in `src/features/practitioners/content.ts` says so to visitors and a test
-- fails the build if a name appears there unverified. Duplicating a place to
-- put an unverified credential would defeat that.
--
-- `display_name` is the one denormalised field, and it is denormalised on
-- purpose: a patient choosing who to see must be able to read the name, and
-- `public.profiles` is readable only by its own owner. It is the practitioner's
-- own scheduling name, set by an administrator from a real account.
-- ---------------------------------------------------------------------------
create table public.practitioners (
  id uuid primary key default gen_random_uuid(),

  -- The account this practitioner works as. Required: a practitioner who
  -- cannot sign in cannot be scoped by a treatment relationship later, and
  -- `docs/SECURITY.md` section 6 requires exactly that scoping.
  profile_id uuid not null unique
    references public.profiles (id) on delete cascade,

  display_name text not null,

  -- Works at the clinic at all.
  is_active boolean not null default true,

  -- May be self-booked by a patient. Secure by default: explicitly granted,
  -- never implied by existing (`docs/SECURITY.md` section 2.4).
  accepts_online_booking boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint practitioners_display_name_length check (
    char_length(btrim(display_name)) between 1 and 120
  )
);

comment on table public.practitioners is
  'Scheduling identity for a practitioner. Holds NO clinical credential: no '
  'qualification, registration number, specialisation or biography column '
  'exists here and none may be added. Verified credentials belong to the '
  'public practitioner directory and are published only when the clinic has '
  'confirmed them.';

create index practitioners_bookable_idx
  on public.practitioners (is_active, accepts_online_booking);

create trigger practitioners_set_updated_at
  before update on public.practitioners
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Appointment types
--
-- The trusted source of an appointment's duration (`phase_09.md` section 38).
-- A client sends an id; the server reads the length from here. There is no
-- request shape that can make a consultation five minutes long or eight hours
-- long.
--
-- `buffer_minutes` is modelled because section 4 lists it and section 18 makes
-- the rule explicit - back-to-back is allowed unless a buffer separates them.
-- It is seeded at 0 because the clinic has specified no buffer. Where it is
-- non-zero it is a real database invariant, not a hint: the booking functions
-- write `blocked_until = ends_at + buffer` and the exclusion constraint below
-- is defined over that, so two concurrent bookings cannot violate a buffer any
-- more than they can violate an overlap.
-- ---------------------------------------------------------------------------
create table public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,

  duration_minutes integer not null,
  buffer_minutes integer not null default 0,

  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointment_types_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 64
  ),
  constraint appointment_types_name_length check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint appointment_types_description_length check (
    description is null or char_length(description) between 1 and 400
  ),
  -- Bounds, so no configuration change can produce a slot shorter than a
  -- scheduling grid step or longer than a working day.
  constraint appointment_types_duration_range check (
    duration_minutes between 5 and 480
  ),
  constraint appointment_types_buffer_range check (
    buffer_minutes between 0 and 240
  )
);

comment on table public.appointment_types is
  'Operational scheduling categories, NOT a catalogue of clinical treatments. '
  'Durations here are provisional development configuration and have not been '
  'confirmed by the clinic; the booking screen says so. No price column: '
  'payments are out of scope and no fee has been verified.';

create index appointment_types_active_idx
  on public.appointment_types (is_active, sort_order, name);

create trigger appointment_types_set_updated_at
  before update on public.appointment_types
  for each row
  execute function public.set_updated_at();

-- Seeded per `phase_09.md` section 64: server-controlled, read-only to
-- patients, no admin CRUD in this phase.
--
-- These two are *operational categories* - how long the diary reserves and
-- whether the clinic has seen you before. They are not treatments, they make
-- no claim about what care will involve or achieve, and they deliberately do
-- not mirror the treatment catalogue, which is unreviewed clinical content.
insert into public.appointment_types
  (slug, name, description, duration_minutes, buffer_minutes, sort_order)
values
  (
    'initial-consultation',
    'Initial consultation',
    'For a first visit to Punarvasu. Allows time for a full history before anything is decided.',
    45,
    0,
    1
  ),
  (
    'follow-up-consultation',
    'Follow-up consultation',
    'For patients the clinic has already seen, to review how things are going.',
    30,
    0,
    2
  )
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------------
-- Recurring working schedule
--
-- One row per contiguous working interval, so a split day is two rows and
-- `phase_09.md` section 14's "Monday 09:00-13:00 and 14:00-18:00" is
-- expressible without a second concept.
--
-- `weekday` is 0-6 with 0 = Sunday, matching PostgreSQL's `extract(dow ...)`
-- and JavaScript's `getDay()`, so no translation layer can get it wrong.
--
-- Times are `time` in the clinic timezone, not `timestamptz`: a working week
-- is a wall-clock fact that repeats, and storing it as an instant would make
-- it drift the first time a timezone rule changed.
--
-- Overlapping intervals on the same weekday are permitted by the schema. They
-- would be a data-entry mistake rather than a hazard - the slot generator
-- deduplicates - and PostgreSQL has no `timerange` type to exclude them with,
-- so a constraint here would cost more than it protects.
-- ---------------------------------------------------------------------------
create table public.practitioner_availability (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null
    references public.practitioners (id) on delete cascade,

  weekday smallint not null,
  starts_at time not null,
  ends_at time not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint practitioner_availability_weekday_range check (
    weekday between 0 and 6
  ),
  -- A working interval that ends before it starts, or spans midnight, would
  -- silently produce no slots or wrong ones. Rejected outright.
  constraint practitioner_availability_interval check (ends_at > starts_at)
);

comment on table public.practitioner_availability is
  'Recurring working intervals in the clinic timezone. weekday: 0 = Sunday. '
  'Multiple rows per weekday express a split day.';

create index practitioner_availability_lookup_idx
  on public.practitioner_availability (practitioner_id, weekday)
  where is_active;

create trigger practitioner_availability_set_updated_at
  before update on public.practitioner_availability
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Blocked periods
--
-- Leave, a clinic holiday, a closure, or a manually blocked slot - one
-- mechanism, because to the availability engine they are the same thing: an
-- interval nobody may be booked into (`phase_09.md` section 15).
--
-- `practitioner_id` is nullable, and null means clinic-wide. That is what lets
-- a public holiday be one row rather than one row per practitioner.
--
-- `reason` is INTERNAL. Section 15 is explicit that it must not reach
-- patients, and it does not: there is no select policy on this table for any
-- client role at all. The availability path reads it through a definer
-- function that returns interval boundaries and nothing else.
-- ---------------------------------------------------------------------------
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),

  -- Null = the whole clinic is closed for this period.
  practitioner_id uuid references public.practitioners (id) on delete cascade,

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  -- Never shown to a patient. May be personal (`docs/DATABASE.md` section 4.6).
  reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint schedule_exceptions_interval check (ends_at > starts_at),
  constraint schedule_exceptions_reason_length check (
    reason is null or char_length(reason) between 1 and 200
  )
);

comment on table public.schedule_exceptions is
  'Blocked periods: leave, holidays, closures. practitioner_id null means '
  'clinic-wide. The reason column is internal and has no select policy for '
  'any client role; availability reads it through a definer function that '
  'returns boundaries only.';

create index schedule_exceptions_window_idx
  on public.schedule_exceptions (practitioner_id, starts_at, ends_at);

create trigger schedule_exceptions_set_updated_at
  before update on public.schedule_exceptions
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),

  -- The patient record, not the user. A walk-in registered by a receptionist
  -- has a patient record and no login (`docs/DATABASE.md` section 4.2), and an
  -- appointment must be able to belong to them.
  --
  -- `on delete cascade` matches the existing profiles -> patients chain. The
  -- phase that settles retention and deletion policy must revisit it:
  -- appointment history that has to outlive an account cannot hang off a
  -- cascade (`docs/DATABASE.md` section 13).
  patient_id uuid not null
    references public.patients (id) on delete cascade,

  -- `restrict`, not `cascade`: removing a practitioner must not silently
  -- delete the record that a patient was seen.
  practitioner_id uuid not null
    references public.practitioners (id) on delete restrict,

  appointment_type_id uuid not null
    references public.appointment_types (id) on delete restrict,

  -- Absolute instants. Never a formatted string, never a naive local time
  -- (`phase_09.md` sections 11-12, `docs/DATABASE.md` section 2 rule 7).
  starts_at timestamptz not null,

  -- The patient-visible end. Derived server-side from the appointment type's
  -- duration, never from the request.
  ends_at timestamptz not null,

  -- The end of the interval the practitioner's diary is actually held for:
  -- `ends_at` plus the type's buffer. Stored rather than computed so that the
  -- exclusion constraint below can be defined over an immutable expression,
  -- which makes buffer separation a database invariant rather than a check the
  -- application hopes nobody raced.
  --
  -- It also captures the buffer *as configured at booking time*, so changing
  -- the configuration cannot retroactively move an existing booking.
  blocked_until timestamptz not null,

  status public.appointment_status not null default 'requested',

  -- Operational only. The booking form says in words not to describe symptoms
  -- here, and nothing in the product treats this as clinical content
  -- (`phase_09.md` sections 24 and 52).
  patient_note text,

  -- Staff-only. No client role holds a select grant on this column - see the
  -- column-level grants at the foot of this file. A patient cannot read it
  -- through a generic appointment query (section 24).
  internal_note text,

  -- Who created it. The patient themselves today; a receptionist later.
  created_by uuid references auth.users (id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointments_interval check (ends_at > starts_at),
  constraint appointments_blocked_until_covers_end check (
    blocked_until >= ends_at
  ),
  constraint appointments_patient_note_length check (
    patient_note is null or char_length(patient_note) between 1 and 500
  ),
  constraint appointments_internal_note_length check (
    internal_note is null or char_length(internal_note) between 1 and 2000
  ),
  constraint appointments_cancellation_reason_length check (
    cancellation_reason is null
    or char_length(cancellation_reason) between 1 and 300
  ),
  -- A cancelled appointment records when it was cancelled; a live one does
  -- not. Keeps the two from drifting apart.
  constraint appointments_cancellation_consistency check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

comment on table public.appointments is
  'A booked slot linking a patient, a practitioner and an appointment type. '
  'No client role holds insert, update or delete: every write goes through a '
  'security definer function that derives the patient from auth.uid(), the '
  'duration from the appointment type, and the status from the transition '
  'rules.';

comment on column public.appointments.internal_note is
  'Staff-only. Not included in the column-level select grant to authenticated, '
  'so a patient cannot read it through any query.';

comment on column public.appointments.blocked_until is
  'ends_at plus the appointment type buffer as configured at booking time. '
  'The exclusion constraint is defined over this, so buffer separation is an '
  'invariant rather than an application check.';


-- ---------------------------------------------------------------------------
-- *** The double-booking guarantee ***
--
-- This is the part of the phase that a web application cannot provide.
--
-- Two concurrent requests both pass an application "is the slot free?" check,
-- because both read before either writes (`phase_09.md` section 17). An
-- exclusion constraint is evaluated by the index at write time under the
-- database's own concurrency control: the second writer blocks on the first
-- and then fails. At most one succeeds, always, regardless of how many
-- application servers are running or how the application is written.
--
-- `'[)'` - half-open - is what makes back-to-back appointments legal
-- (section 18): 10:00-10:30 and 10:30-11:00 do not overlap.
--
-- The predicate excludes only `cancelled`. A completed or missed appointment
-- held that slot and still does, historically; a cancelled one released it.
-- Written as `<> 'cancelled'` rather than as a list of live statuses so that
-- adding a status to the enum later cannot accidentally stop blocking.
-- ---------------------------------------------------------------------------
alter table public.appointments
  add constraint appointments_practitioner_no_overlap
  exclude using gist (
    practitioner_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  )
  where (status <> 'cancelled');

-- The same guarantee from the patient's side. Without it a patient could hold
-- two overlapping appointments with different practitioners - which is not a
-- clinic conflict, but it is certainly a mistake, and it is the one the
-- patient themselves would be unable to attend.
alter table public.appointments
  add constraint appointments_patient_no_overlap
  exclude using gist (
    patient_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled');


-- Indexes for the two questions this table is actually asked
-- (`docs/DATABASE.md` section 4.5): "my upcoming appointments" and "today's
-- schedule for practitioner X". The exclusion constraints already provide a
-- gist index on (practitioner_id, range), which serves the conflict query; a
-- btree on (practitioner_id, starts_at) serves ordered schedule reads.
create index appointments_patient_idx
  on public.appointments (patient_id, starts_at desc);

create index appointments_practitioner_idx
  on public.appointments (practitioner_id, starts_at);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Appointment history
--
-- `phase_09.md` section 31: history must be preserved, and it must remain
-- possible to understand what happened and when. An appointment row is
-- current state; this is the record of how it got there.
--
-- Insert-only by construction, like `role_assignment_events`: written only by
-- the definer functions below, and no client holds insert, update or delete.
-- It is not the audit subsystem of Phase 19 and must not grow into one here.
--
-- It carries no clinical content and no free text - only which values changed.
-- ---------------------------------------------------------------------------
create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),

  appointment_id uuid not null
    references public.appointments (id) on delete cascade,

  -- Nullable so the record survives the actor's account being deleted.
  actor_id uuid references auth.users (id) on delete set null,

  event_type public.appointment_event_type not null,

  previous_status public.appointment_status,
  new_status public.appointment_status,

  previous_starts_at timestamptz,
  previous_ends_at timestamptz,
  new_starts_at timestamptz,
  new_ends_at timestamptz,

  created_at timestamptz not null default now()
);

comment on table public.appointment_events is
  'Insert-only history of an appointment: created, status changed, '
  'rescheduled. Written only by the appointment functions. Carries no '
  'clinical content and no free text.';

create index appointment_events_appointment_idx
  on public.appointment_events (appointment_id, created_at);


-- ---------------------------------------------------------------------------
-- Status transition rules, in the database
--
-- `phase_09.md` sections 7 and 37: arbitrary status changes must be rejected,
-- and `completed -> pending` must not be reachable through a normal update.
--
-- No client can update this table at all, so this trigger guards the definer
-- functions rather than the request. That is still worth having: a future
-- staff function that sets a status directly gets the matrix enforced for free
-- rather than re-deriving it, and the rules live next to the data they
-- describe. `src/features/appointments/status.ts` holds the same matrix for
-- the application, and `status.test.ts` asserts the two agree by reading this
-- file.
--
-- The terminal states - completed, cancelled, no_show - have no outgoing
-- transition. A mistake there is corrected by a new appointment and a record
-- of why, not by rewriting history.
-- ---------------------------------------------------------------------------
create function public.appointments_guard_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'requested' and new.status in ('confirmed', 'cancelled'))
    or (old.status = 'confirmed' and new.status in ('checked_in', 'cancelled', 'no_show'))
    or (old.status = 'checked_in' and new.status in ('in_consultation', 'cancelled', 'no_show'))
    or (old.status = 'in_consultation' and new.status in ('completed', 'cancelled'))
  ) then
    raise exception 'Appointment status cannot change from % to %.',
      old.status, new.status
      using errcode = 'PV008';
  end if;

  return new;
end;
$$;

create trigger appointments_guard_transition
  before update on public.appointments
  for each row
  execute function public.appointments_guard_transition();


-- ---------------------------------------------------------------------------
-- Busy intervals, for the availability snapshot
--
-- The availability engine needs to know when a practitioner is unavailable. A
-- patient must not be able to read other patients' appointments, and must
-- never see why a period is blocked (`phase_09.md` sections 15, 36).
--
-- So this is the only read path that crosses that boundary, and it is shaped
-- to disclose the minimum that showing availability requires: a list of
-- (start, end) pairs. No appointment id, no patient, no practitioner note, no
-- exception reason, no status. A caller learns "10:00-10:30 is not bookable",
-- which is exactly what the slot list they are about to be shown tells them
-- anyway.
--
-- `security definer`, bounded to a window, and it refuses an unauthenticated
-- caller.
-- ---------------------------------------------------------------------------
create function public.get_practitioner_busy_intervals(
  p_practitioner_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (busy_start timestamptz, busy_end timestamptz)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  max_days integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_to <= p_from then
    return;
  end if;

  select r.max_horizon_days into max_days
  from public.appointment_booking_rules() r;

  -- Bounds the work an authenticated caller can ask for in one request, so
  -- this cannot be used to scan the whole table by passing a decade.
  if p_to > p_from + make_interval(days => max_days + 1) then
    raise exception 'Requested window is too large.'
      using errcode = 'PV011';
  end if;

  return query
    select a.starts_at, a.blocked_until
    from public.appointments a
    where a.practitioner_id = p_practitioner_id
      and a.status <> 'cancelled'
      and a.starts_at < p_to
      and a.blocked_until > p_from
    union all
    select e.starts_at, e.ends_at
    from public.schedule_exceptions e
    where (e.practitioner_id is null or e.practitioner_id = p_practitioner_id)
      and e.starts_at < p_to
      and e.ends_at > p_from;
end;
$$;

comment on function public.get_practitioner_busy_intervals(uuid, timestamptz, timestamptz) is
  'Interval boundaries only. Deliberately discloses no appointment id, no '
  'patient, no status and no exception reason.';


-- ---------------------------------------------------------------------------
-- Slot validation
--
-- Everything a booking or a reschedule must satisfy other than overlap, which
-- the exclusion constraint owns. Shared by both, so the two can never drift.
--
-- Each failure raises its own SQLSTATE, because "please choose another time"
-- and "that is too soon to book" are different things for a patient to read
-- and the application maps them to its own copy
-- (`src/features/appointments/errors.ts`). The exception text here is never
-- shown to anybody.
-- ---------------------------------------------------------------------------
create function public.assert_bookable_slot(
  p_practitioner_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_blocked_until timestamptz
)
returns void
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  tz text := public.clinic_timezone();
  rules record;
  local_start timestamp;
  start_minute integer;
  end_minute integer;
  day_of_week integer;
begin
  select * into rules from public.appointment_booking_rules();

  -- The practitioner must exist, work here, and accept online booking.
  if not exists (
    select 1
    from public.practitioners p
    where p.id = p_practitioner_id
      and p.is_active
      and p.accepts_online_booking
  ) then
    raise exception 'Practitioner is not available for booking.'
      using errcode = 'PV006';
  end if;

  if p_starts_at <= now() then
    raise exception 'Appointments cannot be booked in the past.'
      using errcode = 'PV005';
  end if;

  if p_starts_at < now() + make_interval(mins => rules.min_notice_minutes) then
    raise exception 'That time is too soon to book.'
      using errcode = 'PV003';
  end if;

  if p_starts_at > now() + make_interval(days => rules.max_horizon_days) then
    raise exception 'That date is too far ahead to book.'
      using errcode = 'PV004';
  end if;

  -- The wall-clock view of the instant, in the clinic's own timezone. This is
  -- the one place a stored instant becomes a local day and time, and it is why
  -- the timezone is named in exactly one function.
  local_start := p_starts_at at time zone tz;
  day_of_week := extract(dow from local_start)::integer;
  start_minute :=
    extract(hour from local_start)::integer * 60
    + extract(minute from local_start)::integer;
  end_minute :=
    start_minute
    + (extract(epoch from (p_ends_at - p_starts_at)) / 60)::integer;

  -- Offered slots sit on a fixed grid. Enforced rather than assumed, so a
  -- caller cannot request 10:07 and quietly fragment the diary.
  if start_minute % rules.slot_interval_minutes <> 0 then
    raise exception 'That is not an offered appointment time.'
      using errcode = 'PV002';
  end if;

  -- Seconds and sub-seconds are not a scheduling concept here. A start that
  -- is not on a whole minute would pass the grid test above after truncation.
  if extract(second from local_start) <> 0 then
    raise exception 'That is not an offered appointment time.'
      using errcode = 'PV002';
  end if;

  -- The whole appointment must fit inside one working interval. An appointment
  -- running past midnight yields end_minute > 1440 and matches nothing, which
  -- is the correct answer rather than a special case.
  if not exists (
    select 1
    from public.practitioner_availability a
    where a.practitioner_id = p_practitioner_id
      and a.is_active
      and a.weekday = day_of_week
      and start_minute >=
        extract(hour from a.starts_at)::integer * 60
        + extract(minute from a.starts_at)::integer
      and end_minute <=
        extract(hour from a.ends_at)::integer * 60
        + extract(minute from a.ends_at)::integer
  ) then
    raise exception 'That time is outside working hours.'
      using errcode = 'PV002';
  end if;

  -- A blocked period. The reason is never surfaced; to the patient this is
  -- indistinguishable from an unavailable time, which is the point.
  if exists (
    select 1
    from public.schedule_exceptions e
    where (e.practitioner_id is null or e.practitioner_id = p_practitioner_id)
      and tstzrange(e.starts_at, e.ends_at, '[)')
          && tstzrange(p_starts_at, p_blocked_until, '[)')
  ) then
    raise exception 'That time is not available.'
      using errcode = 'PV002';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- The caller's own patient record
--
-- Used by every write below. It answers only about `auth.uid()` and takes no
-- argument, so there is nothing a caller could substitute
-- (`phase_09.md` section 23).
-- ---------------------------------------------------------------------------
create function public.current_patient_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select p.id
  from public.patients p
  where p.profile_id = (select auth.uid())
  limit 1;
$$;


-- ---------------------------------------------------------------------------
-- Booking
--
-- The single trusted way a patient creates an appointment.
--
-- Read the argument list and note what is *not* there: no patient id, no
-- duration, no end time, no status, no timestamps, no internal note. Those are
-- exactly the values `phase_09.md` sections 22, 23, 37 and 38 say a client must
-- not control, and the way they are protected is that there is no way to send
-- them.
--
-- Order of operations, matching section 22:
--   authenticate -> authorize -> resolve patient -> resolve trusted type
--   -> compute the window -> validate the slot -> atomic insert -> history.
-- ---------------------------------------------------------------------------
create function public.book_appointment(
  p_practitioner_id uuid,
  p_appointment_type_id uuid,
  p_starts_at timestamptz,
  p_patient_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  patient uuid;
  appointment_type record;
  rules record;
  computed_ends_at timestamptz;
  computed_blocked_until timestamptz;
  note text;
  new_id uuid;
  active_count integer;
begin
  if actor is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  -- The role comes from the database, never from the request
  -- (`docs/SECURITY.md` section 6).
  if not public.has_app_role('patient') then
    raise exception 'You do not have permission to book an appointment.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Ownership is derived, not asserted. `phase_09.md` example 2.
  patient := public.current_patient_id();
  if patient is null then
    raise exception 'No patient record for this account.'
      using errcode = 'PV007';
  end if;

  -- The trusted configuration. Duration and buffer come from here and from
  -- nowhere else (`phase_09.md` example 4).
  select t.id, t.duration_minutes, t.buffer_minutes
    into appointment_type
  from public.appointment_types t
  where t.id = p_appointment_type_id and t.is_active;

  if appointment_type.id is null then
    raise exception 'Unknown appointment type.'
      using errcode = 'PV006';
  end if;

  select * into rules from public.appointment_booking_rules();

  -- Abuse bound. A provisional value, documented in
  -- `appointment_booking_rules()`; it exists so one account cannot hold the
  -- whole diary (`docs/SECURITY.md` section 12).
  select count(*) into active_count
  from public.appointments a
  where a.patient_id = patient
    and a.status in ('requested', 'confirmed')
    and a.starts_at > now();

  if active_count >= rules.max_active_per_patient then
    raise exception 'Too many upcoming appointments.'
      using errcode = 'PV012';
  end if;

  computed_ends_at :=
    p_starts_at + make_interval(mins => appointment_type.duration_minutes);
  computed_blocked_until :=
    computed_ends_at + make_interval(mins => appointment_type.buffer_minutes);

  perform public.assert_bookable_slot(
    p_practitioner_id, p_starts_at, computed_ends_at, computed_blocked_until
  );

  -- Operational text only, bounded and trimmed. Null rather than an empty
  -- string, so "no note" is one value.
  note := nullif(btrim(coalesce(p_patient_note, '')), '');
  if note is not null and char_length(note) > 500 then
    raise exception 'Note is too long.' using errcode = 'PV013';
  end if;

  -- The insert. If a concurrent request took this slot between the validation
  -- above and this statement, the exclusion constraint raises 23P01 and the
  -- caller maps it to "that time is no longer available". That window is
  -- exactly why the constraint exists (`phase_09.md` sections 17 and 42).
  insert into public.appointments (
    patient_id,
    practitioner_id,
    appointment_type_id,
    starts_at,
    ends_at,
    blocked_until,
    status,
    patient_note,
    created_by
  )
  values (
    patient,
    p_practitioner_id,
    appointment_type.id,
    p_starts_at,
    computed_ends_at,
    computed_blocked_until,
    -- Set here, not sent. A request carrying status = 'confirmed' has nowhere
    -- to put it (`phase_09.md` example 3).
    'requested',
    note,
    actor
  )
  returning id into new_id;

  insert into public.appointment_events (
    appointment_id, actor_id, event_type, new_status, new_starts_at, new_ends_at
  )
  values (new_id, actor, 'created', 'requested', p_starts_at, computed_ends_at);

  return new_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Cancellation
--
-- Never a delete (`phase_09.md` sections 27 and example 6). The row stays, the
-- status changes, and who cancelled it and when are recorded.
-- ---------------------------------------------------------------------------
create function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  patient uuid;
  appt record;
  rules record;
  reason text;
begin
  if actor is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.has_app_role('patient') then
    raise exception 'You do not have permission to cancel this appointment.'
      using errcode = 'insufficient_privilege';
  end if;

  patient := public.current_patient_id();
  if patient is null then
    raise exception 'No patient record for this account.'
      using errcode = 'PV007';
  end if;

  -- Ownership and existence are resolved in one statement, so a wrong id and
  -- somebody else's id are indistinguishable to the caller. An appointment id
  -- is not an access token (`phase_09.md` section 35).
  select a.id, a.status, a.starts_at, a.ends_at
    into appt
  from public.appointments a
  where a.id = p_appointment_id and a.patient_id = patient;

  if appt.id is null then
    raise exception 'Appointment not found.'
      using errcode = 'PV009';
  end if;

  if appt.status not in ('requested', 'confirmed') then
    raise exception 'This appointment can no longer be cancelled.'
      using errcode = 'PV008';
  end if;

  if appt.starts_at <= now() then
    raise exception 'This appointment can no longer be cancelled.'
      using errcode = 'PV010';
  end if;

  select * into rules from public.appointment_booking_rules();

  -- 0 today: the clinic has set no cutoff, so this is inert and is here so
  -- that setting one is a change to `appointment_booking_rules()` alone.
  if rules.cancellation_cutoff_minutes > 0
     and appt.starts_at
         < now() + make_interval(mins => rules.cancellation_cutoff_minutes)
  then
    raise exception 'This appointment can no longer be cancelled.'
      using errcode = 'PV010';
  end if;

  reason := nullif(btrim(coalesce(p_reason, '')), '');
  if reason is not null and char_length(reason) > 300 then
    raise exception 'Reason is too long.' using errcode = 'PV013';
  end if;

  update public.appointments a
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = actor,
      cancellation_reason = reason
  where a.id = appt.id;

  insert into public.appointment_events (
    appointment_id, actor_id, event_type, previous_status, new_status
  )
  values (appt.id, actor, 'status_changed', appt.status, 'cancelled');
end;
$$;


-- ---------------------------------------------------------------------------
-- Rescheduling
--
-- Moved in place, not cancelled and recreated (`phase_09.md` section 29): the
-- appointment keeps its identity, and the move is recorded as an event so the
-- previous time is not lost.
--
-- The same slot validation and the same exclusion constraint apply, so a
-- reschedule is exactly as safe under concurrency as a booking (section 30).
--
-- A confirmed appointment returns to `requested`. The clinic confirmed a
-- particular time; moving it makes that confirmation stale, and presenting the
-- new time as still confirmed would be telling the patient something the
-- clinic has not agreed to.
-- ---------------------------------------------------------------------------
create function public.reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  patient uuid;
  appt record;
  appointment_type record;
  new_ends_at timestamptz;
  new_blocked_until timestamptz;
begin
  if actor is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.has_app_role('patient') then
    raise exception 'You do not have permission to change this appointment.'
      using errcode = 'insufficient_privilege';
  end if;

  patient := public.current_patient_id();
  if patient is null then
    raise exception 'No patient record for this account.'
      using errcode = 'PV007';
  end if;

  select a.id, a.status, a.starts_at, a.ends_at,
         a.practitioner_id, a.appointment_type_id
    into appt
  from public.appointments a
  where a.id = p_appointment_id and a.patient_id = patient;

  if appt.id is null then
    raise exception 'Appointment not found.'
      using errcode = 'PV009';
  end if;

  if appt.status not in ('requested', 'confirmed') then
    raise exception 'This appointment can no longer be rescheduled.'
      using errcode = 'PV008';
  end if;

  if appt.starts_at <= now() then
    raise exception 'This appointment can no longer be rescheduled.'
      using errcode = 'PV010';
  end if;

  -- The duration comes from the stored appointment type, not from the
  -- request and not from the old row's arithmetic. A client rescheduling
  -- cannot lengthen its own appointment.
  select t.id, t.duration_minutes, t.buffer_minutes
    into appointment_type
  from public.appointment_types t
  where t.id = appt.appointment_type_id and t.is_active;

  if appointment_type.id is null then
    raise exception 'Unknown appointment type.'
      using errcode = 'PV006';
  end if;

  new_ends_at :=
    p_starts_at + make_interval(mins => appointment_type.duration_minutes);
  new_blocked_until :=
    new_ends_at + make_interval(mins => appointment_type.buffer_minutes);

  perform public.assert_bookable_slot(
    appt.practitioner_id, p_starts_at, new_ends_at, new_blocked_until
  );

  -- An exclusion constraint never conflicts a row with itself, so moving an
  -- appointment within its own window is not a false conflict.
  update public.appointments a
  set starts_at = p_starts_at,
      ends_at = new_ends_at,
      blocked_until = new_blocked_until,
      status = 'requested'
  where a.id = appt.id;

  insert into public.appointment_events (
    appointment_id, actor_id, event_type,
    previous_status, new_status,
    previous_starts_at, previous_ends_at,
    new_starts_at, new_ends_at
  )
  values (
    appt.id, actor, 'rescheduled',
    appt.status, 'requested',
    appt.starts_at, appt.ends_at,
    p_starts_at, new_ends_at
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Enabled everywhere, no permissive default, policies per operation. There is
-- no `using (true)` and no `using (auth.uid() is not null)` on anything
-- holding appointment data - `phase_09.md` section 36 forbids exactly that.
--
--   practitioners             SELECT  any authenticated user
--   appointment_types         SELECT  any authenticated user
--   practitioner_availability SELECT  any authenticated user, active rows only
--   schedule_exceptions       SELECT  nobody. The reason is internal.
--   appointments              SELECT  the owning patient; a doctor's own diary
--                             INSERT/UPDATE/DELETE  nobody
--   appointment_events        SELECT  the owning patient
--                             INSERT/UPDATE/DELETE  nobody
--
-- "Nobody" means no policy *and* no grant, so a write is refused at the
-- privilege check before RLS is consulted.
--
-- Practitioners, types and working hours are operational configuration rather
-- than patient data: a patient about to book has to see who is available and
-- when. `anon` gets none of it, because booking is authenticated
-- (`phase_09.md` section 50).
-- ---------------------------------------------------------------------------
-- Deliberately not restricted to active rows, and here is the reason: a
-- patient's past appointment references the practitioner they saw, and if
-- that practitioner later stops working at the clinic, their own history must
-- not start rendering a blank where a name was. The booking screens filter on
-- `is_active and accepts_online_booking` in the query, and
-- `assert_bookable_slot` refuses an inactive practitioner regardless of what
-- any query returned.
--
-- This is a roster of who works at a clinic, limited by the column grant to a
-- name and two booleans. It is operational configuration, not patient data,
-- and `phase_09.md` section 36's prohibition is about the latter.
alter table public.practitioners enable row level security;

create policy practitioners_select_all
  on public.practitioners
  for select
  to authenticated
  using (true);

-- Same reasoning: a retired appointment type still names what a past
-- appointment was.
alter table public.appointment_types enable row level security;

create policy appointment_types_select_all
  on public.appointment_types
  for select
  to authenticated
  using (true);

alter table public.practitioner_availability enable row level security;

create policy practitioner_availability_select_active
  on public.practitioner_availability
  for select
  to authenticated
  using (is_active);

-- Enabled with no policy at all. Every client read returns zero rows; the
-- definer function above is the only path, and it returns boundaries only.
alter table public.schedule_exceptions enable row level security;

alter table public.appointments enable row level security;

-- The patient's own appointments. Ownership goes through `patients`, because
-- an appointment belongs to a patient record and a patient record belongs to a
-- user; the role predicate is added alongside ownership, never instead of it.
create policy appointments_select_own_patient
  on public.appointments
  for select
  to authenticated
  using (
    public.has_app_role('patient')
    and patient_id = public.current_patient_id()
  );

-- A doctor's own diary, and nothing else.
--
-- Scoped by the practitioner *relationship* rather than by the doctor role,
-- which is what `docs/SECURITY.md` section 6 requires of every clinical-facing
-- grant: "any doctor can read any patient" is not acceptable, and this policy
-- cannot become that. It is the practitioner relationship `phase_09.md`
-- sections 33 and 36 ask this phase to establish, expressed where it will
-- still be true when Phase 11 builds the surface that reads it.
--
-- No application surface consumes it yet, and no permission in
-- `config/permissions.ts` corresponds to it - the doctor dashboard is Phase 11
-- and brings both. What a doctor can reach today is their own schedule, which
-- is unambiguously theirs, and not `internal_note`, which no client role holds
-- a column grant for.
create policy appointments_select_own_practitioner
  on public.appointments
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and practitioner_id in (
      select p.id
      from public.practitioners p
      where p.profile_id = (select auth.uid())
    )
  );

alter table public.appointment_events enable row level security;

create policy appointment_events_select_own_patient
  on public.appointment_events
  for select
  to authenticated
  using (
    public.has_app_role('patient')
    and appointment_id in (
      select a.id
      from public.appointments a
      where a.patient_id = public.current_patient_id()
    )
  );


-- ---------------------------------------------------------------------------
-- Grants
--
-- Table privileges are the first gate, RLS the second. `anon` receives nothing
-- anywhere in this migration.
--
-- The `appointments` select grant is **column by column**, which is what makes
-- `phase_09.md` section 24 true rather than aspirational: `internal_note` is
-- not in the list, so a patient cannot read it through any query, a `select *`
-- included. `blocked_until`, `created_by` and `cancelled_by` are likewise
-- operational and absent.
--
-- There is no insert, update or delete grant on `appointments` or
-- `appointment_events` for any client role. Every write is a function call.
-- ---------------------------------------------------------------------------
revoke all on public.practitioners from anon, authenticated;
revoke all on public.appointment_types from anon, authenticated;
revoke all on public.practitioner_availability from anon, authenticated;
revoke all on public.schedule_exceptions from anon, authenticated;
revoke all on public.appointments from anon, authenticated;
revoke all on public.appointment_events from anon, authenticated;

grant select (id, display_name, is_active, accepts_online_booking)
  on public.practitioners to authenticated;

grant select (
  id, slug, name, description, duration_minutes, buffer_minutes,
  is_active, sort_order
) on public.appointment_types to authenticated;

grant select (id, practitioner_id, weekday, starts_at, ends_at, is_active)
  on public.practitioner_availability to authenticated;

grant select (
  id,
  patient_id,
  practitioner_id,
  appointment_type_id,
  starts_at,
  ends_at,
  status,
  patient_note,
  cancelled_at,
  cancellation_reason,
  created_at,
  updated_at
) on public.appointments to authenticated;

grant select (
  id, appointment_id, event_type,
  previous_status, new_status,
  previous_starts_at, previous_ends_at,
  new_starts_at, new_ends_at,
  created_at
) on public.appointment_events to authenticated;

revoke all on function public.clinic_timezone() from public;
grant execute on function public.clinic_timezone() to authenticated;

revoke all on function public.appointment_booking_rules() from public;
grant execute on function public.appointment_booking_rules() to authenticated;

revoke all on function public.current_patient_id() from public;
grant execute on function public.current_patient_id() to authenticated;

revoke all on function public.get_practitioner_busy_intervals(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_practitioner_busy_intervals(uuid, timestamptz, timestamptz) to authenticated;

revoke all on function public.book_appointment(uuid, uuid, timestamptz, text) from public;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text) to authenticated;

revoke all on function public.cancel_appointment(uuid, text) from public;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;

revoke all on function public.reschedule_appointment(uuid, timestamptz) from public;
grant execute on function public.reschedule_appointment(uuid, timestamptz) to authenticated;

-- Internal helper. It is `security definer` and reads blocked periods, so it
-- is not a function a client should be able to call directly even though it
-- discloses nothing but a yes/no.
revoke all on function public.assert_bookable_slot(uuid, timestamptz, timestamptz, timestamptz) from public;
