-- ---------------------------------------------------------------------------
-- Phase 10 - Receptionist Workspace
--
-- Phase 09 answered "when can care happen, with whom, and what state is it
-- in", for one actor: the patient, acting on their own appointments. This
-- migration adds the second actor - the front desk - without adding a second
-- scheduling engine.
--
-- ## What is reused, and what that means concretely
--
-- Everything that decides whether a time is bookable. `assert_bookable_slot`
-- is still the one validator, the exclusion constraints are still the one
-- conflict guarantee, `appointments_guard_transition()` is still the one
-- transition matrix, and `appointment_events` is still the one history. A
-- receptionist booking at the desk and a patient booking at home go through
-- the same rules and race against each other through the same index.
--
-- `phase_10.md` sections 16-17 and 60 are explicit that the Phase 09 engine
-- must be reused rather than duplicated, and that a receptionist UI must not
-- reach the database directly. Both hold: there is still **no insert, update
-- or delete grant on `public.appointments` for any client role**, and there
-- still never will be. The receptionist's writes are `security definer`
-- functions, exactly as the patient's are.
--
-- ## The one Phase 09 function this migration changes, and why
--
-- `assert_bookable_slot` gains two parameters:
--
--     p_require_online_booking boolean
--     p_min_notice_minutes     integer
--
-- Both existed inside it as fixed rules, and both are rules about *self-
-- service booking* rather than about whether a time is schedulable at all:
--
--   * `accepts_online_booking` means "a patient may book this practitioner
--     themselves". A receptionist at the desk booking somebody in with a
--     practitioner who does not take online bookings is precisely the case
--     that flag exists to permit. Keeping the check would have made the
--     receptionist workspace exactly as unusable as patient booking currently
--     is - no practitioner accepts online booking today.
--
--   * Minimum notice - two hours - stops a patient booking a slot the clinic
--     cannot prepare for. A receptionist booking somebody in for eleven
--     o'clock at ten past ten is not that; it is the front desk doing its job.
--
-- The alternative was a second validator for staff, which is the duplicated
-- scheduling logic `phase_10.md` section 17 forbids and which would drift the
-- first time a rule changed. So the rule is parameterised instead, and the
-- calling *function* decides - never the request.
--
-- Because PostgreSQL identifies a function by its argument list, adding the
-- parameters means dropping the four-argument version and replacing the two
-- Phase 09 functions that call it. Their bodies are reproduced below unchanged
-- apart from that one call. Everything else about them - the authentication
-- check, the patient role check, the derived patient, the derived duration,
-- the set status, the abuse bound - is identical.
--
-- ## What a receptionist still cannot do
--
--   * **Read a clinical record.** There is none to read; when there is, it
--     will be its own table with its own policies, and nothing here grants
--     anything on it.
--   * **Read `appointments.internal_note`.** Column privileges are granted to
--     a *database* role, and a patient and a receptionist are both
--     `authenticated`. Making the staff note readable by a receptionist would
--     make it readable by every patient, so it stays unreadable by anyone and
--     unwritable through any function in this migration. A staff note needs a
--     definer accessor, and no Phase 10 workflow requires one.
--   * **Read a blocked period's reason.** `schedule_exceptions` still has RLS
--     enabled and no policy at all, for any role.
--   * **Complete an appointment.** `phase_10.md` section 31 says completion
--     stays a clinical responsibility unless explicitly authorized, and
--     `docs/SECURITY.md` section 6's matrix does not authorize it. The status
--     allowlist below refuses it.
--   * **Assign a role, or create an account.** Nothing here touches
--     `user_roles` or `auth.users`, and `create_patient_record` has no
--     parameter for an owner, so a receptionist cannot attach a patient record
--     to anybody's login (`phase_10.md` sections 34-35).
--   * **Set a status, a duration, an end time or a patient id directly.** Same
--     as Phase 09: none of those is a parameter of anything a client may call,
--     with the single deliberate exception of the patient id on staff booking,
--     which section 18 requires and which is validated server-side.
-- ---------------------------------------------------------------------------


-- `pg_trgm` backs the index that makes `ilike '%name%'` a search rather than a
-- sequential scan. `phase_10.md` section 52 warns against adding expensive
-- indexes blindly; these are added because `search_patients` below is the only
-- way the front desk finds anybody, and it is the query the workspace makes
-- most often.
create extension if not exists pg_trgm;


-- ---------------------------------------------------------------------------
-- Slot validation, parameterised
--
-- See the header. The rules are unchanged; two of them are now decided by the
-- caller rather than being fixed, and no client is a caller.
-- ---------------------------------------------------------------------------
drop function public.assert_bookable_slot(uuid, timestamptz, timestamptz, timestamptz);

create function public.assert_bookable_slot(
  p_practitioner_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_blocked_until timestamptz,
  p_require_online_booking boolean,
  p_min_notice_minutes integer
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

  -- The practitioner must exist and work here. Whether they must *also* accept
  -- online booking depends on who is asking: a patient booking themselves,
  -- yes; the front desk booking on their behalf, no.
  if not exists (
    select 1
    from public.practitioners p
    where p.id = p_practitioner_id
      and p.is_active
      and (not p_require_online_booking or p.accepts_online_booking)
  ) then
    raise exception 'Practitioner is not available for booking.'
      using errcode = 'PV006';
  end if;

  if p_starts_at <= now() then
    raise exception 'Appointments cannot be booked in the past.'
      using errcode = 'PV005';
  end if;

  -- Zero for the front desk, which books people in for today.
  if p_min_notice_minutes > 0
     and p_starts_at < now() + make_interval(mins => p_min_notice_minutes)
  then
    raise exception 'That time is too soon to book.'
      using errcode = 'PV003';
  end if;

  -- The horizon binds everybody. It is a bound on how far the diary is open,
  -- not a self-service rule.
  if p_starts_at > now() + make_interval(days => rules.max_horizon_days) then
    raise exception 'That date is too far ahead to book.'
      using errcode = 'PV004';
  end if;

  local_start := p_starts_at at time zone tz;
  day_of_week := extract(dow from local_start)::integer;
  start_minute :=
    extract(hour from local_start)::integer * 60
    + extract(minute from local_start)::integer;
  end_minute :=
    start_minute
    + (extract(epoch from (p_ends_at - p_starts_at)) / 60)::integer;

  if start_minute % rules.slot_interval_minutes <> 0 then
    raise exception 'That is not an offered appointment time.'
      using errcode = 'PV002';
  end if;

  if extract(second from local_start) <> 0 then
    raise exception 'That is not an offered appointment time.'
      using errcode = 'PV002';
  end if;

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

comment on function public.assert_bookable_slot(uuid, timestamptz, timestamptz, timestamptz, boolean, integer) is
  'Every booking rule except overlap, which the exclusion constraint owns. '
  'Shared by patient and staff scheduling so the two cannot drift. The last '
  'two parameters are decided by the calling function, never by a request.';


-- ---------------------------------------------------------------------------
-- The two Phase 09 patient functions, replaced only to pass the new arguments
--
-- `create or replace` rather than a rewrite: the bodies below are Phase 09's,
-- and the one changed line in each is the `assert_bookable_slot` call.
-- Reproduced in full because PostgreSQL has no way to patch a function body.
-- ---------------------------------------------------------------------------
create or replace function public.book_appointment(
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

  if not public.has_app_role('patient') then
    raise exception 'You do not have permission to book an appointment.'
      using errcode = 'insufficient_privilege';
  end if;

  patient := public.current_patient_id();
  if patient is null then
    raise exception 'No patient record for this account.'
      using errcode = 'PV007';
  end if;

  select t.id, t.duration_minutes, t.buffer_minutes
    into appointment_type
  from public.appointment_types t
  where t.id = p_appointment_type_id and t.is_active;

  if appointment_type.id is null then
    raise exception 'Unknown appointment type.'
      using errcode = 'PV006';
  end if;

  select * into rules from public.appointment_booking_rules();

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

  -- The one changed line: self-service requires online booking and the minimum
  -- notice. Both were previously fixed inside the validator.
  perform public.assert_bookable_slot(
    p_practitioner_id, p_starts_at, computed_ends_at, computed_blocked_until,
    true, rules.min_notice_minutes
  );

  note := nullif(btrim(coalesce(p_patient_note, '')), '');
  if note is not null and char_length(note) > 500 then
    raise exception 'Note is too long.' using errcode = 'PV013';
  end if;

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


create or replace function public.reschedule_appointment(
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
  rules record;
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

  select t.id, t.duration_minutes, t.buffer_minutes
    into appointment_type
  from public.appointment_types t
  where t.id = appt.appointment_type_id and t.is_active;

  if appointment_type.id is null then
    raise exception 'Unknown appointment type.'
      using errcode = 'PV006';
  end if;

  select * into rules from public.appointment_booking_rules();

  new_ends_at :=
    p_starts_at + make_interval(mins => appointment_type.duration_minutes);
  new_blocked_until :=
    new_ends_at + make_interval(mins => appointment_type.buffer_minutes);

  -- The one changed line, as above.
  perform public.assert_bookable_slot(
    appt.practitioner_id, p_starts_at, new_ends_at, new_blocked_until,
    true, rules.min_notice_minutes
  );

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
-- The front desk's authorization, in one place
--
-- Every staff function below starts with this. It answers from the database -
-- `auth.uid()` and `public.user_roles` - and takes no argument, so there is
-- nothing a caller could substitute (`phase_10.md` sections 3 and 38).
--
-- It raises rather than returning a boolean, because a caller that forgets to
-- check a returned boolean is a caller that has authorized nothing.
-- ---------------------------------------------------------------------------
create function public.assert_appointment_manager()
returns void
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A role check rather than a permission check, because the database has no
  -- permission table: `config/permissions.ts` is the application's policy, and
  -- `docs/SECURITY.md` section 6 is what both of them implement. The two are
  -- asserted to agree by test.
  if not public.has_app_role('receptionist') then
    raise exception 'You do not have permission to manage appointments.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

comment on function public.assert_appointment_manager() is
  'Refuses anybody who is not a signed-in receptionist. The single '
  'authorization gate for every staff scheduling function in this migration.';


-- ---------------------------------------------------------------------------
-- Patient search
--
-- `phase_10.md` sections 11-13: server-side, authorized, bounded, minimal
-- fields, and it must be impossible to ask it for the whole patient database.
--
-- ## Why a function rather than a filtered table read
--
-- Searching several columns at once through PostgREST means an `or=(...)`
-- filter built from the receptionist's typed text. That text would then be
-- part of a filter *expression* rather than a parameter, and a query
-- containing a comma or a bracket changes the shape of the expression rather
-- than being searched for. Here the text is a parameter and can only ever be
-- data.
--
-- ## What bounds it
--
--   * Fewer than two characters returns nothing, so an empty box is not a
--     "list every patient" button.
--   * `p_limit` is clamped in the function, not trusted from the caller.
--   * `%`, `_` and the escape character are escaped, so a query of `%` matches
--     a literal percent sign rather than everybody.
--
-- ## What it discloses
--
-- The minimum the front desk needs to pick the right person out of a list
-- (`phase_10.md` example 6): a name, a phone number, a date of birth and a
-- town. No address, no emergency contact, no account identifier - those are
-- read one patient at a time, after the receptionist has chosen who they are
-- dealing with.
--
-- `has_account` is derived from `profile_id is not null` and does not disclose
-- the id itself. It is there because the onboarding workflow needs to know
-- whether this person can already sign in.
-- ---------------------------------------------------------------------------
create function public.search_patients(
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  full_name text,
  preferred_name text,
  phone text,
  date_of_birth date,
  city text,
  has_account boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  term text;
  pattern text;
  digits text;
  bounded integer;
begin
  perform public.assert_appointment_manager();

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
      p.city,
      p.profile_id is not null
    from public.patients p
    where p.full_name ilike pattern escape '\'
       or p.preferred_name ilike pattern escape '\'
       or (
         char_length(digits) >= 4
         and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || digits || '%'
       )
    order by p.full_name asc, p.created_at asc
    limit bounded;
end;
$$;

comment on function public.search_patients(text, integer) is
  'Bounded operational patient search for the front desk. Returns the minimum '
  'needed to identify a person; discloses no address, emergency contact or '
  'account identifier. Refuses a caller who is not a receptionist.';


-- ---------------------------------------------------------------------------
-- Possible duplicates
--
-- `phase_10.md` section 33: prevent obvious duplicate identities where
-- practical, show the receptionist what already exists, and **never merge
-- automatically**. Nothing here writes anything; it answers a question the
-- receptionist then decides about.
--
-- Two signals, both conservative:
--
--   * the same phone number, which in a clinic is close to an identity;
--   * the same name and the same date of birth.
--
-- Fuzzy name similarity alone is deliberately not a signal. Two people called
-- the same thing is ordinary, and a false "this already exists" at the front
-- desk either creates a duplicate anyway or attaches somebody's appointment to
-- a stranger's record.
-- ---------------------------------------------------------------------------
create function public.find_possible_duplicate_patients(
  p_full_name text,
  p_phone text default null,
  p_date_of_birth date default null
)
returns table (
  id uuid,
  full_name text,
  preferred_name text,
  phone text,
  date_of_birth date,
  city text,
  has_account boolean,
  match_reason text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  name_term text;
  phone_digits text;
begin
  perform public.assert_appointment_manager();

  name_term := lower(btrim(coalesce(p_full_name, '')));
  phone_digits := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

  if name_term = '' and phone_digits is null then
    return;
  end if;

  return query
    select
      p.id,
      p.full_name,
      p.preferred_name,
      p.phone,
      p.date_of_birth,
      p.city,
      p.profile_id is not null,
      case
        when phone_digits is not null
         and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = phone_digits
          then 'phone'
        else 'name_and_date_of_birth'
      end
    from public.patients p
    where (
        phone_digits is not null
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = phone_digits
      )
      or (
        name_term <> ''
        and p_date_of_birth is not null
        and lower(btrim(p.full_name)) = name_term
        and p.date_of_birth = p_date_of_birth
      )
    order by p.full_name asc
    limit 10;
end;
$$;

comment on function public.find_possible_duplicate_patients(text, text, date) is
  'Candidate existing patients for a record about to be created. Advisory '
  'only: it merges nothing and blocks nothing. The receptionist decides.';


-- ---------------------------------------------------------------------------
-- Creating a patient record at the front desk
--
-- `phase_10.md` sections 32-35. The whole security argument is the argument
-- list: there is **no owner parameter**. A receptionist cannot attach a record
-- to an account, cannot create an account, cannot set a password, and cannot
-- grant a role - because none of those is something this function takes or
-- does.
--
-- The record is created unlinked (`profile_id` null), which is exactly the
-- walk-in case `docs/DATABASE.md` section 4.2 describes and which the partial
-- unique index on `profile_id` was built for in Phase 07. If that person later
-- registers, claiming the record is a separate, deliberate workflow - it is
-- not implemented here, and it must not be implemented by letting somebody
-- pass an id.
--
-- Field bounds and the gender allowlist are the Phase 07 check constraints,
-- unchanged. This function adds no column and no field of its own, and in
-- particular adds nowhere to put clinical information.
-- ---------------------------------------------------------------------------
create function public.create_patient_record(
  p_full_name text,
  p_preferred_name text default null,
  p_phone text default null,
  p_date_of_birth date default null,
  p_gender text default null,
  p_address_line1 text default null,
  p_address_line2 text default null,
  p_city text default null,
  p_state text default null,
  p_postal_code text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_relationship text default null,
  p_emergency_contact_phone text default null,
  p_preferred_language text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform public.assert_appointment_manager();

  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'A name is required.' using errcode = 'PV013';
  end if;

  insert into public.patients (
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
  )
  values (
    -- Not a parameter, and never will be. `phase_10.md` section 34.
    null,
    btrim(p_full_name),
    nullif(btrim(coalesce(p_preferred_name, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_date_of_birth,
    nullif(btrim(coalesce(p_gender, '')), ''),
    nullif(btrim(coalesce(p_address_line1, '')), ''),
    nullif(btrim(coalesce(p_address_line2, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_state, '')), ''),
    nullif(btrim(coalesce(p_postal_code, '')), ''),
    nullif(btrim(coalesce(p_emergency_contact_name, '')), ''),
    nullif(btrim(coalesce(p_emergency_contact_relationship, '')), ''),
    nullif(btrim(coalesce(p_emergency_contact_phone, '')), ''),
    nullif(btrim(coalesce(p_preferred_language, '')), '')
  )
  returning id into new_id;

  -- No `created_by` column is added to `public.patients`, deliberately.
  -- `phase_10.md` section 60 offers one; the table's select grant is
  -- table-wide, so the column would also be readable by the patient whose
  -- record it is, which discloses a staff identifier to them for no benefit
  -- either party gets. The operation is recorded in the structured
  -- application log against the actor's opaque id, and the fuller audit trail
  -- is Phase 19's.
  return new_id;
end;
$$;

comment on function public.create_patient_record is
  'Creates an UNLINKED patient record for a walk-in. Has no owner parameter, '
  'so a receptionist cannot attach a record to an account, and creates no '
  'authentication account and no credential.';


-- ---------------------------------------------------------------------------
-- Booking on a patient's behalf
--
-- `phase_10.md` sections 16-18. The receptionist selects the patient, so
-- unlike `book_appointment` this does take a patient id - and section 18 is
-- explicit about what that costs: the id must be validated server-side and the
-- receptionist's permission checked independently. Both happen here, and the
-- id is a *filter* that must resolve to a real patient record, never a claim
-- about who the caller is.
--
-- Everything else is derived exactly as in Phase 09: the duration and buffer
-- from the appointment type, the end and blocked-until from the duration, the
-- status from this function, the timestamps from the database. There is no
-- parameter for any of them.
--
-- ## Why the status is `confirmed`
--
-- A patient's request is `requested` because the clinic has not agreed to it
-- yet. An appointment the clinic itself entered at its own front desk has been
-- agreed to by definition - telling the receptionist who just booked it that
-- it is "awaiting confirmation" would be describing a step that does not
-- exist. The status is still set *by this function* and still subject to the
-- transition trigger.
--
-- ## Why the per-patient cap does not apply
--
-- `max_active_per_patient` is an abuse bound on self-service, so one account
-- cannot hold the diary. A receptionist is the clinic; a patient with a course
-- of six appointments is an ordinary thing for the front desk to arrange and
-- an odd thing to refuse.
-- ---------------------------------------------------------------------------
create function public.create_appointment_for_patient(
  p_patient_id uuid,
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
  appointment_type record;
  computed_ends_at timestamptz;
  computed_blocked_until timestamptz;
  note text;
  new_id uuid;
begin
  perform public.assert_appointment_manager();

  -- The patient id is validated, not trusted. An id that is not a patient
  -- record of this clinic is refused before anything is written.
  if not exists (select 1 from public.patients p where p.id = p_patient_id) then
    raise exception 'Unknown patient record.' using errcode = 'PV014';
  end if;

  select t.id, t.duration_minutes, t.buffer_minutes
    into appointment_type
  from public.appointment_types t
  where t.id = p_appointment_type_id and t.is_active;

  if appointment_type.id is null then
    raise exception 'Unknown appointment type.'
      using errcode = 'PV006';
  end if;

  computed_ends_at :=
    p_starts_at + make_interval(mins => appointment_type.duration_minutes);
  computed_blocked_until :=
    computed_ends_at + make_interval(mins => appointment_type.buffer_minutes);

  -- The same validator the patient path uses, with the two self-service rules
  -- switched off. Working hours, the grid, blocked periods, the horizon and
  -- "not in the past" all still apply.
  perform public.assert_bookable_slot(
    p_practitioner_id, p_starts_at, computed_ends_at, computed_blocked_until,
    false, 0
  );

  note := nullif(btrim(coalesce(p_patient_note, '')), '');
  if note is not null and char_length(note) > 500 then
    raise exception 'Note is too long.' using errcode = 'PV013';
  end if;

  -- The same exclusion constraint decides a race between this and a patient
  -- booking the same slot from home. At most one of them can succeed.
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
    p_patient_id,
    p_practitioner_id,
    appointment_type.id,
    p_starts_at,
    computed_ends_at,
    computed_blocked_until,
    'confirmed',
    note,
    actor
  )
  returning id into new_id;

  insert into public.appointment_events (
    appointment_id, actor_id, event_type, new_status, new_starts_at, new_ends_at
  )
  values (new_id, actor, 'created', 'confirmed', p_starts_at, computed_ends_at);

  return new_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Operational status changes
--
-- One function rather than four, because confirming, checking in, marking a
-- no-show and cancelling differ only in the value they set - and four copies
-- of the same authorization, lookup and history code is four places for one of
-- them to be wrong.
--
-- `phase_10.md` example 5 asks that the current status decide which
-- transitions are offered, that only permitted actions be shown, and that the
-- server validate the transition. Three independent things enforce it here:
--
--   1. the allowlist below, which is about the *role* - a receptionist may not
--      set `completed`, whatever the appointment's state
--      (`phase_10.md` section 31);
--   2. the explicit legality check, which produces a message a person can act
--      on;
--   3. `appointments_guard_transition()`, the Phase 09 trigger, which is what
--      actually holds and which this function cannot talk its way past.
-- ---------------------------------------------------------------------------
create function public.update_appointment_status_as_staff(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  appt record;
  reason text;
  allowed boolean;
begin
  perform public.assert_appointment_manager();

  -- The statuses this role may set at all. `completed` and `in_consultation`
  -- are absent deliberately: they describe what happened in the consulting
  -- room, and the front desk is not in it.
  if p_status not in ('confirmed', 'checked_in', 'no_show', 'cancelled') then
    raise exception 'You do not have permission to set that status.'
      using errcode = 'insufficient_privilege';
  end if;

  select a.id, a.status, a.starts_at into appt
  from public.appointments a
  where a.id = p_appointment_id;

  if appt.id is null then
    raise exception 'Appointment not found.'
      using errcode = 'PV009';
  end if;

  if appt.status = p_status then
    -- Not an error and not a change. A second click, or two receptionists
    -- confirming the same appointment, should not raise.
    return;
  end if;

  -- The Phase 09 matrix, mirrored here only so the refusal carries a sentence.
  -- The trigger is what enforces it.
  allowed := case
    when appt.status = 'requested' then p_status in ('confirmed', 'cancelled')
    when appt.status = 'confirmed' then p_status in ('checked_in', 'cancelled', 'no_show')
    when appt.status = 'checked_in' then p_status in ('cancelled', 'no_show')
    else false
  end;

  if not allowed then
    raise exception 'That status change is not allowed.'
      using errcode = 'PV008';
  end if;

  reason := nullif(btrim(coalesce(p_reason, '')), '');
  if reason is not null and char_length(reason) > 300 then
    raise exception 'Reason is too long.' using errcode = 'PV013';
  end if;

  if p_status = 'cancelled' then
    update public.appointments a
    set status = 'cancelled',
        cancelled_at = now(),
        cancelled_by = actor,
        cancellation_reason = reason
    where a.id = appt.id;
  else
    update public.appointments a
    set status = p_status
    where a.id = appt.id;
  end if;

  insert into public.appointment_events (
    appointment_id, actor_id, event_type, previous_status, new_status
  )
  values (appt.id, actor, 'status_changed', appt.status, p_status);
end;
$$;

comment on function public.update_appointment_status_as_staff(uuid, public.appointment_status, text) is
  'The front desk operational status actions: confirm, check in, no-show, '
  'cancel. Refuses completed and in_consultation for this role, and defers to '
  'the Phase 09 transition trigger for legality.';


-- ---------------------------------------------------------------------------
-- Rescheduling on a patient's behalf
--
-- The Phase 09 shape: moved in place, identity preserved, previous time kept
-- as history, validated through the one validator, raced through the one
-- exclusion constraint (`phase_10.md` section 21).
--
-- ## Two differences from the patient path, both deliberate
--
--   * **The status is preserved rather than reset to `requested`.** A patient
--     moving their own appointment makes the clinic's confirmation stale, so
--     Phase 09 sends it back for confirmation. A receptionist moving it *is*
--     the clinic; sending the clinic's own change back to the clinic for
--     approval would be ceremony, and would make a confirmed patient's
--     appointment look unconfirmed to them.
--
--   * **An appointment whose start time has passed may still be moved**, as
--     long as it has not reached a terminal state. A patient who arrives late
--     and is fitted in an hour later is an ordinary afternoon at a clinic. The
--     *new* time still has to be in the future and still has to pass every
--     other rule.
-- ---------------------------------------------------------------------------
create function public.reschedule_appointment_as_staff(
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
  appt record;
  appointment_type record;
  new_ends_at timestamptz;
  new_blocked_until timestamptz;
begin
  perform public.assert_appointment_manager();

  select a.id, a.status, a.starts_at, a.ends_at,
         a.practitioner_id, a.appointment_type_id
    into appt
  from public.appointments a
  where a.id = p_appointment_id;

  if appt.id is null then
    raise exception 'Appointment not found.'
      using errcode = 'PV009';
  end if;

  if appt.status not in ('requested', 'confirmed') then
    raise exception 'This appointment can no longer be rescheduled.'
      using errcode = 'PV008';
  end if;

  -- The duration comes from the stored appointment type, never from the
  -- request. A reschedule cannot lengthen an appointment.
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
    appt.practitioner_id, p_starts_at, new_ends_at, new_blocked_until,
    false, 0
  );

  update public.appointments a
  set starts_at = p_starts_at,
      ends_at = new_ends_at,
      blocked_until = new_blocked_until
  where a.id = appt.id;

  insert into public.appointment_events (
    appointment_id, actor_id, event_type,
    previous_status, new_status,
    previous_starts_at, previous_ends_at,
    new_starts_at, new_ends_at
  )
  values (
    appt.id, actor, 'rescheduled',
    appt.status, appt.status,
    appt.starts_at, appt.ends_at,
    p_starts_at, new_ends_at
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Three new select policies, each naming the receptionist role explicitly.
-- `phase_10.md` section 39 forbids broad policies such as
-- `auth.uid() is not null` on sensitive tables, and none of these is one: each
-- requires a specific role, read from `public.user_roles` through
-- `public.has_app_role()`.
--
-- No new insert, update or delete policy is created anywhere, and no new write
-- grant is issued. The receptionist's writes remain function calls.
--
-- The existing policies are untouched. A patient's own-record policies from
-- Phase 07 and 08 still say exactly what they said; these are additional
-- permissive policies, so the only thing that changes is that a receptionist
-- now matches one.
-- ---------------------------------------------------------------------------

-- The clinic's diary. A receptionist schedules for the whole clinic, so the
-- scope is the whole table rather than a subset - there is no narrower scope
-- that would still let them answer "who is coming in today".
--
-- What that does *not* include is the internal note, which no client role
-- holds a column grant on, and `schedule_exceptions`, which still has no
-- policy at all.
create policy appointments_select_receptionist
  on public.appointments
  for select
  to authenticated
  using (public.has_app_role('receptionist'));

-- The history of an appointment the receptionist can already see. It carries
-- only which values changed and when - no clinical content and no free text.
create policy appointment_events_select_receptionist
  on public.appointment_events
  for select
  to authenticated
  using (public.has_app_role('receptionist'));

-- Operational patient information.
--
-- `public.patients` is demographic and administrative by construction: it has
-- no column for a diagnosis, a symptom, a medication, an allergy, a history or
-- a note, and Phase 07's migration says none may be added. So "the front desk
-- may read a patient record" and "the front desk may not read clinical
-- information" are not in tension here - the second is true because the data
-- does not exist in this table, not because a policy filters it.
--
-- Column-level minimisation still applies above this, in the query layer,
-- which selects the fields a screen needs rather than `select *`
-- (`phase_10.md` section 37).
create policy patients_select_receptionist
  on public.patients
  for select
  to authenticated
  using (public.has_app_role('receptionist'));


-- ---------------------------------------------------------------------------
-- Indexes
--
-- Added for queries this phase actually makes, not speculatively
-- (`phase_10.md` sections 50 and 52).
-- ---------------------------------------------------------------------------

-- "Who is coming in on this day?" - the workspace's primary query. Phase 09
-- indexed (practitioner_id, starts_at), which does not serve a clinic-wide day
-- with no practitioner filter.
create index appointments_starts_at_idx
  on public.appointments (starts_at);

-- The two columns `search_patients` matches on. Trigram, because the search is
-- `ilike '%term%'` - a btree cannot serve a leading wildcard.
create index patients_full_name_trgm_idx
  on public.patients using gin (full_name gin_trgm_ops);

create index patients_phone_trgm_idx
  on public.patients using gin (phone gin_trgm_ops);

-- Duplicate detection matches a name and a date of birth exactly.
create index patients_name_dob_idx
  on public.patients (lower(btrim(full_name)), date_of_birth);


-- ---------------------------------------------------------------------------
-- Grants
--
-- Every function is revoked from `public` first and then granted to
-- `authenticated` alone, so `anon` can call none of them. Each one authorizes
-- its caller itself; the grant only decides who may attempt it.
--
-- `assert_appointment_manager` and `assert_bookable_slot` are internal. They
-- are `security definer` and read scheduling data, so neither is something a
-- client should be able to call directly even though both disclose nothing but
-- a yes or a raise.
-- ---------------------------------------------------------------------------
revoke all on function public.assert_bookable_slot(uuid, timestamptz, timestamptz, timestamptz, boolean, integer) from public;

revoke all on function public.assert_appointment_manager() from public;

revoke all on function public.search_patients(text, integer) from public;
grant execute on function public.search_patients(text, integer) to authenticated;

revoke all on function public.find_possible_duplicate_patients(text, text, date) from public;
grant execute on function public.find_possible_duplicate_patients(text, text, date) to authenticated;

revoke all on function public.create_patient_record(
  text, text, text, date, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.create_patient_record(
  text, text, text, date, text, text, text, text, text, text, text, text, text, text
) to authenticated;

revoke all on function public.create_appointment_for_patient(uuid, uuid, uuid, timestamptz, text) from public;
grant execute on function public.create_appointment_for_patient(uuid, uuid, uuid, timestamptz, text) to authenticated;

revoke all on function public.update_appointment_status_as_staff(uuid, public.appointment_status, text) from public;
grant execute on function public.update_appointment_status_as_staff(uuid, public.appointment_status, text) to authenticated;

revoke all on function public.reschedule_appointment_as_staff(uuid, timestamptz) from public;
grant execute on function public.reschedule_appointment_as_staff(uuid, timestamptz) to authenticated;
