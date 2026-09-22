-- ---------------------------------------------------------------------------
-- Phase 12 - Clinical Records & Consultation Management
--
-- The first genuinely clinical data in Punarvasu. Everything before this was
-- operational: who is coming in, when, with whom. This is what happened in
-- the room.
--
-- ## The boundary this migration exists to hold
--
-- `phase_12.md` section 2 and example 1:
--
--     appointment       an operational event - when care is scheduled
--     clinical record   a medical event      - what happened during care
--
-- So **not one clinical column is added to `public.appointments`**. No
-- diagnosis, no note, no assessment. The clinical record is its own table
-- with its own policies, its own grants and its own lifecycle, and it
-- references the appointment rather than living inside it.
--
-- ## What is reused
--
-- Everything underneath. `public.appointments` and its status enum,
-- `appointments_guard_transition()`, `appointment_events`,
-- `public.assert_care_practitioner()`, `public.current_practitioner_id()`,
-- `public.has_app_role()` and `public.set_updated_at()` are all Phase 09's
-- and Phase 11's, and none is altered. This migration **replaces no existing
-- function, drops no policy and alters no existing column**.
--
-- Two things are added to an existing table, and both only ever refuse more:
--   * a unique constraint on `appointments (id, patient_id, practitioner_id)`,
--     which exists so the composite foreign key below can be declared; and
--   * one `before update` trigger, which refuses to complete an appointment
--     whose consultation notes are still a draft.
--
-- ## The access policy this migration implements
--
-- `phase_12.md` section 20 requires the policy to be chosen explicitly and
-- documented, and warns against assuming the broadest access because it is
-- easier. `docs/SECURITY.md` section 6 constrains the choice: *"Doctors can
-- access the clinical records of patients they are treating, scoped by
-- treatment relationship rather than by role alone."*
--
-- This is the **authoring-practitioner model**:
--
--     a doctor may read and write a clinical record when its
--     practitioner_id is the doctor's own practitioner record
--
-- and nothing else. It is the narrowest model that supports the workflow, and
-- it is the one already implied by the rest of the product: Phase 11 scoped a
-- patient's *appointment* history to the practitioner's own diary, so a
-- clinical history that silently included a colleague's consultations would
-- be wider than the appointments it hangs off.
--
--   * A receptionist has **no policy on this table at all** and reads
--     nothing. `docs/SECURITY.md` section 6 makes that a hard boundary, and
--     `phase_12.md` section 22 forbids weakening it for convenience.
--   * A patient has no policy either. `phase_12.md` sections 21 and 53 and
--     example 8: a doctor-facing clinical record is not a patient-facing one,
--     and a patient-visible projection must be designed and authorized
--     deliberately rather than arrived at by returning this table.
--   * An administrator has no policy. Section 23: administrative capability
--     and clinical access are separate concepts.
--
-- Widening this later - to a care team, or clinic-wide - is a change to one
-- policy predicate, and it would need its own audit trail.
--
-- ## Out of scope, and absent rather than filtered
--
-- `phase_12.md` sections 48, 49, 50 and 100. There is no column here for a
-- medication, a dose, a prescription, a treatment plan, a document, a file, a
-- lab result or an AI-generated anything, and no function that writes one.
-- Phase 13 owns prescriptions and treatment plans, Phase 14 documents, Phase
-- 17 AI.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- The record's lifecycle
--
-- `phase_12.md` section 14: draft and completed, and `amended` named as a
-- potential future state. All three values are declared now and only two are
-- reachable, for the reason Phase 09 recorded when it declared four
-- unreachable appointment statuses: PostgreSQL will not let a value added by
-- `alter type ... add value` be *used* in the same transaction, and Supabase
-- applies each migration in one. A later phase that adds and uses `amended`
-- in a single migration would fail. An enum value nothing writes costs
-- nothing.
--
-- Nothing in Phase 12 can produce `amended`: the transition trigger below
-- permits `draft -> completed` and `completed -> amended`, and no function in
-- this migration sets the second. The path is open; the surface is not built
-- (section 17).
-- ---------------------------------------------------------------------------
create type public.clinical_record_status as enum (
  'draft',
  'completed',
  'amended'
);

comment on type public.clinical_record_status is
  'The clinical record lifecycle. Phase 12 reaches draft and completed; '
  'amended is declared for a future formal-amendment workflow and is '
  'unreachable today.';


-- ---------------------------------------------------------------------------
-- The consistency anchor
--
-- `phase_12.md` sections 92-93 give the invalid state to prevent:
--
--     Appointment      Patient A, Doctor A
--     Clinical record  same appointment, Patient B, Doctor C
--
-- and say not to rely entirely on application code for it. The strongest
-- available answer is a **composite foreign key** - the record's
-- (appointment, patient, practitioner) triple must exist as a row in
-- `appointments` - and a composite foreign key needs a unique constraint on
-- the referenced columns.
--
-- `id` is already the primary key, so this constraint is trivially satisfied
-- by every existing row and can never be violated by a future one. It adds an
-- index and no behaviour. It is here solely so that the reference below is
-- declarative rather than a trigger somebody can disable.
-- ---------------------------------------------------------------------------
alter table public.appointments
  add constraint appointments_identity_key
  unique (id, patient_id, practitioner_id);

comment on constraint appointments_identity_key on public.appointments is
  'Exists so that public.clinical_records can declare a composite foreign key '
  'to (id, patient_id, practitioner_id). Trivially true - id is the primary '
  'key - and adds no behaviour of its own.';


-- ---------------------------------------------------------------------------
-- Clinical records
--
-- ## Structured, not one giant text field
--
-- `phase_12.md` sections 10, 12 and 13. Eight named fields, each one a
-- section of the consultation a practitioner already writes, and every one
-- **nullable** - because section 37 says not to make every field mandatory
-- and section 15 says a draft may be incomplete. What is required is required
-- *at completion*, and that is a constraint further down rather than a
-- `not null`.
--
-- The field list is section 13's, unchanged. Nothing Ayurveda-specific is
-- structured here: section 11 permits prakriti, vikriti, agni and the rest as
-- *potential* fields and then says explicitly not to implement every
-- Ayurvedic concept as a structured field without confirmed doctor
-- requirements. The clinic has confirmed none, so the practitioner writes
-- them in the narrative fields they belong in, and a later phase can promote
-- one to a column when somebody has asked for it.
--
-- ## What is not duplicated here
--
-- Sections 8 and 9: no patient name, no phone number, no date of birth, no
-- practitioner name. Those live on `public.patients` and
-- `public.practitioners` and are read through the relationship. A copy would
-- be a second source of truth that goes stale the day somebody corrects a
-- spelling.
--
-- ## Delete behaviour
--
-- Section 62: avoid cascading deletion that could unintentionally destroy
-- clinical history. All three references are `on delete restrict`, which
-- means deleting a patient, a practitioner or an appointment that has a
-- clinical record **fails loudly**.
--
-- That is deliberate, and it is a change in behaviour worth stating: the
-- `auth.users -> profiles -> patients -> appointments` chain cascades, so an
-- account deletion that would previously have taken appointments with it will
-- now be refused once a consultation has been documented. Sections 45 and 46
-- forbid automatic deletion of clinical records, so a refusal is the correct
-- failure - the phase that settles retention policy has to decide what
-- happens instead, deliberately, with an audit trail
-- (`docs/DATABASE.md` section 13).
-- ---------------------------------------------------------------------------
create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),

  -- One consultation per appointment (section 7). The unique constraint is
  -- below, and it is what makes a double-click, a retry, a refresh and two
  -- genuinely concurrent requests all resolve to one record.
  appointment_id uuid not null,

  -- The canonical patient record (section 8). Not the account: a walk-in
  -- registered at the front desk has a patient record and no login, and must
  -- be able to have a consultation documented.
  patient_id uuid not null,

  -- The canonical practitioner identity (section 9). Never a name string.
  -- **Never supplied by a request** - every function below derives it from
  -- the appointment, after `assert_care_practitioner()` has resolved the
  -- caller's own practitioner record from `auth.uid()`.
  practitioner_id uuid not null,

  status public.clinical_record_status not null default 'draft',

  -- ---- The clinical content (section 13) ---------------------------------
  --
  -- All nullable, all bounded. A draft may hold any subset; completion
  -- requires two of them, enforced by a constraint below rather than by
  -- application code.
  chief_complaint text,
  history_of_presenting_concern text,
  symptoms text,
  clinical_observations text,
  assessment text,
  diagnosis_or_clinical_impression text,
  doctor_notes text,
  follow_up_notes text,

  -- ---- Concurrency (section 34) -----------------------------------------
  --
  -- An optimistic concurrency token, incremented by a trigger on every update
  -- so it cannot be forgotten by a function that writes this table. A caller
  -- sends the version it edited; a write whose expected version no longer
  -- matches affects no row and is reported as a conflict rather than
  -- overwriting whatever arrived first.
  --
  -- It is **not** an authorization input. It says *which revision I edited*,
  -- never *whether I may edit*. Sending a wrong one loses the write; sending
  -- a right one for somebody else's record still reaches no row, because
  -- row-level security decided that first.
  version integer not null default 1,

  -- Who documented it, and who closed it. Nullable so the record survives the
  -- account being removed - the clinical content is what matters and it must
  -- not be deleted to tidy up a user table.
  created_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ---- Integrity ---------------------------------------------------------

  -- Section 7 and section 61. One primary consultation record per
  -- appointment, enforced by an index rather than by a check-then-insert that
  -- two concurrent requests both pass.
  constraint clinical_records_one_per_appointment unique (appointment_id),

  -- **The consistency guarantee** (sections 92-93). The triple must exist as
  -- a row in `appointments`, so a record cannot name patient B and
  -- practitioner C against an appointment between patient A and practitioner
  -- A. Declarative, always enforced, and impossible for application code to
  -- route around.
  constraint clinical_records_appointment_consistency
    foreign key (appointment_id, patient_id, practitioner_id)
    references public.appointments (id, patient_id, practitioner_id)
    on update cascade
    on delete restrict,

  -- Direct references as well, so the record is anchored to the canonical
  -- rows themselves and not only through the appointment (section 62).
  constraint clinical_records_patient_fkey
    foreign key (patient_id) references public.patients (id)
    on delete restrict,
  constraint clinical_records_practitioner_fkey
    foreign key (practitioner_id) references public.practitioners (id)
    on delete restrict,

  -- A completed record has a completion time and a draft does not. Written as
  -- an equivalence so neither half can drift.
  constraint clinical_records_completion_consistency check (
    (status = 'draft') = (completed_at is null)
  ),

  -- **Completion validation, in the database** (sections 37-38 and 70).
  -- Drafts may be incomplete; a record that is not a draft must carry the two
  -- fields the clinic's workflow defines as required. A completion that skips
  -- the application's validation still cannot produce an undocumented
  -- completed record.
  constraint clinical_records_completion_requirements check (
    status = 'draft'
    or (
      chief_complaint is not null and btrim(chief_complaint) <> ''
      and assessment is not null and btrim(assessment) <> ''
    )
  ),

  -- Bounded text (section 36). Long enough for real clinical documentation,
  -- short enough that a payload cannot be used to fill the database. The
  -- functions normalise an empty or whitespace-only value to null, so a
  -- stored value is always meaningful.
  constraint clinical_records_chief_complaint_length check (
    chief_complaint is null
    or char_length(btrim(chief_complaint)) between 1 and 500
  ),
  constraint clinical_records_history_length check (
    history_of_presenting_concern is null
    or char_length(btrim(history_of_presenting_concern)) between 1 and 4000
  ),
  constraint clinical_records_symptoms_length check (
    symptoms is null or char_length(btrim(symptoms)) between 1 and 4000
  ),
  constraint clinical_records_observations_length check (
    clinical_observations is null
    or char_length(btrim(clinical_observations)) between 1 and 4000
  ),
  constraint clinical_records_assessment_length check (
    assessment is null or char_length(btrim(assessment)) between 1 and 4000
  ),
  constraint clinical_records_diagnosis_length check (
    diagnosis_or_clinical_impression is null
    or char_length(btrim(diagnosis_or_clinical_impression)) between 1 and 2000
  ),
  constraint clinical_records_doctor_notes_length check (
    doctor_notes is null or char_length(btrim(doctor_notes)) between 1 and 8000
  ),
  constraint clinical_records_follow_up_length check (
    follow_up_notes is null
    or char_length(btrim(follow_up_notes)) between 1 and 2000
  ),

  constraint clinical_records_version_positive check (version >= 1)
);

comment on table public.clinical_records is
  'What happened during a consultation. Highly confidential '
  '(docs/SECURITY.md section 4). Readable only by the practitioner who '
  'authored it; no receptionist, patient or administrator has any policy on '
  'this table. Every write is a security definer function - there is no '
  'insert, update or delete grant for any client role.';

comment on column public.clinical_records.version is
  'Optimistic concurrency token, incremented by trigger on every update. A '
  'concurrency control, never an authorization input.';

comment on column public.clinical_records.practitioner_id is
  'Derived from the appointment inside the database, never from a request. '
  'No function in this migration has a practitioner parameter.';


-- ---------------------------------------------------------------------------
-- Indexes
--
-- Section 63: use actual query patterns, and do not add unnecessary indexes.
-- Three queries exist in this phase, and there are three indexes.
--
-- `appointment_id` is already indexed by the unique constraint above, which
-- serves "does this appointment have a consultation record?" - the question
-- the consultation page and the completion trigger both ask.
-- ---------------------------------------------------------------------------

-- A patient's clinical history, newest first (sections 39 and 64). The
-- ordering is in the index, so the history query is a range scan rather than
-- a sort over everything the patient has.
create index clinical_records_patient_idx
  on public.clinical_records (patient_id, created_at desc);

-- The practitioner's own records, newest first (section 65).
create index clinical_records_practitioner_idx
  on public.clinical_records (practitioner_id, created_at desc);

-- Unfinished documentation, per practitioner. Partial, so it indexes only the
-- handful of rows that are actually drafts rather than the whole table.
create index clinical_records_draft_idx
  on public.clinical_records (practitioner_id, updated_at desc)
  where status = 'draft';


-- ---------------------------------------------------------------------------
-- updated_at
--
-- Reuses `public.set_updated_at()` from the Phase 06 migration rather than
-- defining a second copy.
-- ---------------------------------------------------------------------------
create trigger clinical_records_set_updated_at
  before update on public.clinical_records
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- The record's own guard trigger
--
-- Three rules, in one `before update` trigger because all three are about the
-- same thing - what an update to a clinical record is allowed to be.
--
--   1. **The version always increments.** Put here rather than in each
--      function so that a function added later cannot forget it, which is the
--      failure mode that turns optimistic concurrency into silent overwrite.
--
--   2. **The lifecycle.** `draft -> completed` and `completed -> amended`.
--      Nothing reopens a completed record and nothing moves an amended one,
--      which is the same terminal-state discipline the appointment lifecycle
--      uses (`docs/DATABASE.md` section 2): a mistake is corrected by an
--      amendment that preserves what was there, never by rewriting history.
--
--   3. **Completed content is immutable.** Section 16 and example 5: once
--      completed, normal editing is restricted and a completed medical record
--      must not be silently overwritten. So an update that changes any
--      clinical field while the record is already completed is refused - not
--      hidden in the UI, refused by the database.
--
--      The one write a completed record still accepts is the status
--      transition to `amended`, and the workflow that performs it does not
--      exist yet. When it does, it writes a new revision and a reason; this
--      trigger is what guarantees it cannot instead quietly edit the original.
--
-- The identity columns are immutable too. A record cannot be re-pointed at
-- another appointment, patient or practitioner after the fact - which closes
-- the one remaining way the composite foreign key could be satisfied at
-- insert and then subverted.
-- ---------------------------------------------------------------------------
create function public.clinical_records_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Identity is fixed at creation. Changing it would make the record describe
  -- a different episode of care.
  if new.appointment_id <> old.appointment_id
     or new.patient_id <> old.patient_id
     or new.practitioner_id <> old.practitioner_id then
    raise exception 'A clinical record cannot be moved to another appointment, patient or practitioner.'
      using errcode = 'PV016';
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status = 'completed')
      or (old.status = 'completed' and new.status = 'amended')
    ) then
      raise exception 'A clinical record cannot change from % to %.',
        old.status, new.status
        using errcode = 'PV016';
    end if;
  end if;

  -- Content is editable only while the record is a draft. The exception is
  -- the completing update itself, which carries the final content and the
  -- transition together.
  if old.status <> 'draft'
     and not (old.status = 'completed' and new.status = 'amended')
     and (
       new.chief_complaint is distinct from old.chief_complaint
       or new.history_of_presenting_concern
            is distinct from old.history_of_presenting_concern
       or new.symptoms is distinct from old.symptoms
       or new.clinical_observations is distinct from old.clinical_observations
       or new.assessment is distinct from old.assessment
       or new.diagnosis_or_clinical_impression
            is distinct from old.diagnosis_or_clinical_impression
       or new.doctor_notes is distinct from old.doctor_notes
       or new.follow_up_notes is distinct from old.follow_up_notes
     ) then
    raise exception 'A completed clinical record cannot be edited.'
      using errcode = 'PV016';
  end if;

  new.version := old.version + 1;

  return new;
end;
$$;

comment on function public.clinical_records_guard_update() is
  'Holds the clinical record lifecycle, the immutability of a completed '
  'record and of the identity columns, and the version increment that makes '
  'optimistic concurrency work. Fires before every update, whatever wrote it.';

-- Fires before `clinical_records_set_updated_at` - PostgreSQL runs before-row
-- triggers in name order, and `g` sorts before `s`. Neither depends on the
-- other, but the guard rejecting first means a refused update never touches a
-- timestamp.
create trigger clinical_records_guard_update
  before update on public.clinical_records
  for each row
  execute function public.clinical_records_guard_update();


-- ---------------------------------------------------------------------------
-- The appointment side of the relationship
--
-- `phase_12.md` section 73: the relationship between "clinical record
-- completed" and "appointment completed" must be defined so the two cannot
-- accidentally disagree.
--
-- The model is:
--
--     completing the clinical record completes the appointment, atomically
--     completing the appointment requires the notes not to be a draft
--
-- This trigger is the second half, and it is a trigger rather than a check
-- inside `update_appointment_status_as_doctor` for two reasons: it binds
-- **every** write path including any added later, and it leaves the Phase 11
-- function byte-identical, so the mirror test that parses that migration
-- still describes the function that is actually installed.
--
-- An appointment with no clinical record at all is unaffected. A consultation
-- can legitimately happen without documentation being started in Punarvasu,
-- and refusing to close that appointment would be inventing a requirement the
-- clinic has not asked for. What is refused is the narrower, genuinely
-- inconsistent case: notes were started, they are still a draft, and somebody
-- is about to mark the appointment finished - which would leave a completed
-- episode of care whose documentation is permanently half-written.
-- ---------------------------------------------------------------------------
create function public.appointments_guard_clinical_documentation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if exists (
      select 1
      from public.clinical_records cr
      where cr.appointment_id = new.id
        and cr.status = 'draft'
    ) then
      raise exception 'The consultation notes for this appointment are still a draft.'
        using errcode = 'PV019';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.appointments_guard_clinical_documentation() is
  'Refuses to complete an appointment whose clinical record is still a draft, '
  'so that a completed episode of care cannot be left with permanently '
  'half-written documentation. An appointment with no clinical record is '
  'unaffected.';

create trigger appointments_guard_clinical_documentation
  before update on public.appointments
  for each row
  execute function public.appointments_guard_clinical_documentation();


-- ---------------------------------------------------------------------------
-- Starting a consultation
--
-- `phase_12.md` sections 18, 19 and 55. The whole authorization sequence, in
-- order, before anything is written:
--
--     authenticate
--       -> require the doctor role
--       -> resolve the caller's own practitioner identity
--       -> load the appointment, scoped to that practitioner
--       -> verify the appointment is eligible
--       -> derive patient and practitioner FROM THE APPOINTMENT
--       -> create
--
-- ## Nothing about the record is accepted from the caller
--
-- The argument list is one appointment id. There is no `patientId`, no
-- `doctorId`, no `practitionerId` and no `status` - so example 3's
-- `{"doctorId": "doctor-b"}` and example 4's `{"patientId": "patient-b"}`
-- have nothing to attach to. The patient and the practitioner are read out of
-- the appointment row, which was itself resolved by the caller's own
-- practitioner id, so the record's triple is consistent by construction as
-- well as by constraint.
--
-- ## Duplicate creation, four ways (section 7 and section 87)
--
-- A double-click, a retry, a browser refresh and two genuinely concurrent
-- requests all end at the same place: `on conflict do nothing` against the
-- unique index, then read back whatever is there. The second caller gets the
-- first caller's record id rather than an error, because from the
-- practitioner's side "open the consultation" is idempotent - they asked to
-- be in the consultation, and they are.
--
-- The index is what decides, under the database's own concurrency control.
-- An application-level "does one exist?" check would be passed by both of two
-- concurrent requests, for exactly the reason `docs/DATABASE.md` section 11
-- gives about appointment booking.
--
-- ## It also moves the appointment, in the same transaction
--
-- Section 71: where a workflow requires several changes to succeed together,
-- perform them atomically. A PL/pgSQL function body is one transaction, so
-- creating the record and moving `checked_in -> in_consultation` either both
-- happen or neither does. The status change goes through the ordinary
-- `appointments` update, so `appointments_guard_transition()` still decides
-- legality - section 72: no second appointment status system is created here.
-- ---------------------------------------------------------------------------
create function public.start_consultation(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  practitioner uuid;
  appt record;
  record_id uuid;
begin
  practitioner := public.assert_care_practitioner();

  -- By id *and* by the caller's own practitioner record, in one statement.
  -- Another practitioner's appointment is indistinguishable from one that
  -- does not exist (section 56).
  select a.id, a.status, a.patient_id, a.practitioner_id
    into appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.practitioner_id = practitioner;

  if appt.id is null then
    raise exception 'Appointment not found.'
      using errcode = 'PV009';
  end if;

  -- Eligibility (section 18). A consultation is documented for a patient who
  -- is with the practitioner: the front desk has checked them in, or the
  -- consultation is already under way. Anything else - a request nobody has
  -- confirmed, a cancelled appointment, a completed one - is not a
  -- consultation that is happening now.
  if appt.status not in ('checked_in', 'in_consultation') then
    raise exception 'This appointment is not ready for a consultation.'
      using errcode = 'PV008';
  end if;

  -- Patient and practitioner come from the appointment. This is the line that
  -- makes example 4's manipulated patient id irrelevant: there is nowhere for
  -- one to arrive, and nowhere for one to be used.
  insert into public.clinical_records (
    appointment_id, patient_id, practitioner_id, status, created_by
  )
  values (appt.id, appt.patient_id, appt.practitioner_id, 'draft', actor)
  on conflict (appointment_id) do nothing
  returning id into record_id;

  if record_id is null then
    -- Somebody got there first - a second click, a retry, or a genuinely
    -- concurrent request. Read back the one that exists rather than failing:
    -- at most one record exists for this appointment, which is what the
    -- caller wanted.
    select cr.id into record_id
    from public.clinical_records cr
    where cr.appointment_id = appt.id;
  end if;

  -- Atomic with the creation above. Only when it is actually a change, so a
  -- second call does not re-run a transition and does not write a second
  -- history event.
  if appt.status = 'checked_in' then
    update public.appointments a
    set status = 'in_consultation'
    where a.id = appt.id;

    insert into public.appointment_events (
      appointment_id, actor_id, event_type, previous_status, new_status
    )
    values (appt.id, actor, 'status_changed', appt.status, 'in_consultation');
  end if;

  return record_id;
end;
$$;

comment on function public.start_consultation(uuid) is
  'Opens the clinical record for one of the calling practitioner''s own '
  'appointments, deriving the patient and the practitioner from the '
  'appointment itself, and moves the appointment into consultation in the '
  'same transaction. Idempotent: a repeat returns the existing record.';


-- ---------------------------------------------------------------------------
-- Saving a draft
--
-- Sections 15, 33 and 38: a draft may be incomplete, and saving one must be
-- reliable and honest about whether it worked.
--
-- ## The argument list is the allowlist
--
-- A record id, an expected version, and the eight clinical fields. No status,
-- no patient, no practitioner, no appointment, no timestamp, no version to
-- write - so section 85's payload-manipulation list has nothing to
-- manipulate. The status stays whatever it was; the version is set by the
-- trigger.
--
-- ## Stale writes lose, and are told so (section 34)
--
-- The update is scoped by `version = p_expected_version`. If the record has
-- moved on since the caller loaded it - a second tab, a second device, the
-- same practitioner on the ward computer - the update matches no row and this
-- raises `PV015` rather than replacing newer clinical documentation with
-- older. **Nothing is silently overwritten.**
--
-- ## Ownership is not re-argued here
--
-- The update is scoped by `practitioner_id = practitioner`, resolved from
-- `auth.uid()`. A record id for somebody else's consultation matches no row
-- and is reported as not found - the same answer as an id that never existed
-- (section 57).
-- ---------------------------------------------------------------------------
create function public.save_clinical_draft(
  p_record_id uuid,
  p_expected_version integer,
  p_chief_complaint text,
  p_history_of_presenting_concern text,
  p_symptoms text,
  p_clinical_observations text,
  p_assessment text,
  p_diagnosis_or_clinical_impression text,
  p_doctor_notes text,
  p_follow_up_notes text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  practitioner uuid;
  existing record;
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  select cr.id, cr.status, cr.version into existing
  from public.clinical_records cr
  where cr.id = p_record_id
    and cr.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Clinical record not found.'
      using errcode = 'PV018';
  end if;

  if existing.status <> 'draft' then
    raise exception 'A completed clinical record cannot be edited.'
      using errcode = 'PV016';
  end if;

  -- Distinguished from a conflict deliberately: "this record has moved on" is
  -- something the practitioner can act on by reloading, and "this record does
  -- not exist" is not.
  if existing.version <> p_expected_version then
    raise exception 'This clinical record was updated elsewhere.'
      using errcode = 'PV015';
  end if;

  update public.clinical_records cr
  set
    chief_complaint = nullif(btrim(coalesce(p_chief_complaint, '')), ''),
    history_of_presenting_concern =
      nullif(btrim(coalesce(p_history_of_presenting_concern, '')), ''),
    symptoms = nullif(btrim(coalesce(p_symptoms, '')), ''),
    clinical_observations =
      nullif(btrim(coalesce(p_clinical_observations, '')), ''),
    assessment = nullif(btrim(coalesce(p_assessment, '')), ''),
    diagnosis_or_clinical_impression =
      nullif(btrim(coalesce(p_diagnosis_or_clinical_impression, '')), ''),
    doctor_notes = nullif(btrim(coalesce(p_doctor_notes, '')), ''),
    follow_up_notes = nullif(btrim(coalesce(p_follow_up_notes, '')), '')
  where cr.id = existing.id
    and cr.practitioner_id = practitioner
    and cr.status = 'draft'
    -- The optimistic lock, applied again in the statement itself so that two
    -- concurrent saves cannot both pass the check above and both write.
    and cr.version = p_expected_version
  returning cr.version into next_version;

  if next_version is null then
    raise exception 'This clinical record was updated elsewhere.'
      using errcode = 'PV015';
  end if;

  return next_version;
end;
$$;

comment on function public.save_clinical_draft(uuid, integer, text, text, text, text, text, text, text, text) is
  'Saves draft clinical content for one of the calling practitioner''s own '
  'records. Refuses a completed record and refuses a stale write, and returns '
  'the new version so the caller can continue editing without reloading.';


-- ---------------------------------------------------------------------------
-- Completing the consultation
--
-- Sections 35, 38, 70, 71 and 73, and example 9. Completion is deliberate,
-- validated on the server, and returns authoritative state - the UI must
-- never say completed while the database says draft.
--
-- What happens, in one transaction:
--
--   1. authorize, and resolve the caller's own practitioner record;
--   2. resolve the record by id **and** by that practitioner;
--   3. refuse a stale version;
--   4. validate the fields the clinic requires at completion;
--   5. write the final content and transition to `completed`;
--   6. complete the appointment, if it is in consultation.
--
-- Step 6 is what makes section 73's two states agree. It runs **after** the
-- record is completed, so `appointments_guard_clinical_documentation()` sees
-- no draft and permits it - and it goes through the ordinary appointment
-- update, so `appointments_guard_transition()` still decides legality and the
-- appointment history still records the change.
--
-- If the appointment is in some other state - already completed, or cancelled
-- after the consultation began - the record still completes and the
-- appointment is left alone. That is the legitimate difference section 73
-- asks to have documented: the clinical record describes care that happened,
-- and it must be possible to finish documenting it whatever later became of
-- the scheduling row.
--
-- ## Completion is not a status a caller sets
--
-- There is no status parameter here or anywhere in this migration. Section 85
-- and `phase_12.md`'s "do not allow arbitrary status manipulation from the
-- browser": the only way to reach `completed` is to call this function and
-- satisfy its validation.
-- ---------------------------------------------------------------------------
create function public.complete_clinical_record(
  p_record_id uuid,
  p_expected_version integer,
  p_chief_complaint text,
  p_history_of_presenting_concern text,
  p_symptoms text,
  p_clinical_observations text,
  p_assessment text,
  p_diagnosis_or_clinical_impression text,
  p_doctor_notes text,
  p_follow_up_notes text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  practitioner uuid;
  existing record;
  appt record;
  chief text;
  finding text;
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  select cr.id, cr.status, cr.version, cr.appointment_id into existing
  from public.clinical_records cr
  where cr.id = p_record_id
    and cr.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Clinical record not found.'
      using errcode = 'PV018';
  end if;

  if existing.status <> 'draft' then
    raise exception 'This consultation has already been completed.'
      using errcode = 'PV016';
  end if;

  if existing.version <> p_expected_version then
    raise exception 'This clinical record was updated elsewhere.'
      using errcode = 'PV015';
  end if;

  chief := nullif(btrim(coalesce(p_chief_complaint, '')), '');
  finding := nullif(btrim(coalesce(p_assessment, '')), '');

  -- The required fields (sections 37-38). Checked here so the refusal carries
  -- a sentence the practitioner can act on; the check constraint on the table
  -- is what actually holds, and it holds against any writer.
  if chief is null or finding is null then
    raise exception 'A completed consultation needs a chief complaint and an assessment.'
      using errcode = 'PV017';
  end if;

  update public.clinical_records cr
  set
    chief_complaint = chief,
    history_of_presenting_concern =
      nullif(btrim(coalesce(p_history_of_presenting_concern, '')), ''),
    symptoms = nullif(btrim(coalesce(p_symptoms, '')), ''),
    clinical_observations =
      nullif(btrim(coalesce(p_clinical_observations, '')), ''),
    assessment = finding,
    diagnosis_or_clinical_impression =
      nullif(btrim(coalesce(p_diagnosis_or_clinical_impression, '')), ''),
    doctor_notes = nullif(btrim(coalesce(p_doctor_notes, '')), ''),
    follow_up_notes = nullif(btrim(coalesce(p_follow_up_notes, '')), ''),
    status = 'completed',
    completed_at = now(),
    completed_by = actor
  where cr.id = existing.id
    and cr.practitioner_id = practitioner
    and cr.status = 'draft'
    and cr.version = p_expected_version
  returning cr.version into next_version;

  if next_version is null then
    raise exception 'This clinical record was updated elsewhere.'
      using errcode = 'PV015';
  end if;

  -- The appointment, in the same transaction. Read under the practitioner
  -- scope again rather than trusted from earlier.
  select a.id, a.status into appt
  from public.appointments a
  where a.id = existing.appointment_id
    and a.practitioner_id = practitioner;

  if appt.id is not null and appt.status = 'in_consultation' then
    update public.appointments a
    set status = 'completed'
    where a.id = appt.id;

    insert into public.appointment_events (
      appointment_id, actor_id, event_type, previous_status, new_status
    )
    values (appt.id, actor, 'status_changed', appt.status, 'completed');
  end if;

  return next_version;
end;
$$;

comment on function public.complete_clinical_record(uuid, integer, text, text, text, text, text, text, text, text) is
  'Validates, saves and closes a consultation, and completes the appointment '
  'in the same transaction. The only way a clinical record reaches the '
  'completed status - there is no status parameter anywhere in this feature.';


-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Deny by default (`docs/SECURITY.md` section 7). RLS on, one policy, and
-- that policy admits exactly one person: the practitioner who authored the
-- record.
--
-- Everything else is denied by having no policy at all, which is a stronger
-- statement than a policy that evaluates to false:
--
--     receptionist  -> no policy. Section 22, and a hard boundary in
--                      docs/SECURITY.md section 6.
--     patient       -> no policy. Sections 21 and 53: a doctor-facing record
--                      is not a patient-facing one, and a patient-visible
--                      projection is a deliberate future design with its own
--                      authorization, not this table with a different query.
--     admin         -> no policy. Section 23: administrative capability and
--                      clinical access are separate concepts, and clinical
--                      access for an administrator needs an audit trail that
--                      does not exist yet.
--     anon          -> no grant at all, so it never reaches RLS.
--
-- **No insert, update or delete policy is created, and no write grant is
-- issued.** The Phase 09 discipline, unchanged: every write is a
-- `security definer` function whose argument list is the allowlist.
-- ---------------------------------------------------------------------------
alter table public.clinical_records enable row level security;

create policy clinical_records_select_author
  on public.clinical_records
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and practitioner_id = public.current_practitioner_id()
  );


-- ---------------------------------------------------------------------------
-- Grants
--
-- `anon` receives nothing on this table - not select, not anything.
--
-- `authenticated` receives `select` only, and every column of it: a clinical
-- record has no column its own author should not see, and column privileges
-- are held by the *database* role, which a patient, a receptionist and a
-- doctor all share. Narrowing by column here would protect nobody; the policy
-- above is what restricts the rows, and it restricts them to one person.
--
-- The three functions are granted to `authenticated` because a doctor calls
-- them. Each begins with `assert_care_practitioner()`, which refuses anybody
-- who is not a signed-in doctor with a practitioner record - so the grant is
-- the ability to *ask*, and the function is what decides.
-- ---------------------------------------------------------------------------
revoke all on public.clinical_records from anon, authenticated;
grant select on public.clinical_records to authenticated;

revoke all on function public.start_consultation(uuid) from public;
grant execute on function public.start_consultation(uuid) to authenticated;

revoke all on function public.save_clinical_draft(
  uuid, integer, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.save_clinical_draft(
  uuid, integer, text, text, text, text, text, text, text, text
) to authenticated;

revoke all on function public.complete_clinical_record(
  uuid, integer, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.complete_clinical_record(
  uuid, integer, text, text, text, text, text, text, text, text
) to authenticated;
