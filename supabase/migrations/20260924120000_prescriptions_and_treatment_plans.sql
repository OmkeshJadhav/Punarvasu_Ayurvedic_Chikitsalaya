-- ---------------------------------------------------------------------------
-- Phase 13 - Prescription & Treatment Plans
--
-- The doctor's clinical *instruction*, as opposed to Phase 12's record of
-- what happened. Different things, so different tables:
--
--     appointment       an operational event   - when care is scheduled
--     clinical record   a medical event        - what happened in the room
--     prescription      a clinical instruction - what the patient must take
--     treatment plan    a clinical instruction - how the patient must live
--
-- ## The boundary this migration exists to hold
--
-- `phase_13.md` section 2 and example 1: a prescription is **not** text in
-- `clinical_records.doctor_notes`, and a treatment plan is **not** text on an
-- appointment. Both are their own tables with their own items, their own
-- lifecycle, their own policies and their own grants.
--
-- So **not one prescription column is added to `public.clinical_records` or
-- to `public.appointments`**. A structural test fails the build if one
-- appears.
--
-- ## What is reused
--
-- Everything underneath, unaltered. `public.assert_care_practitioner()`
-- (Phase 11), `public.current_practitioner_id()` (Phase 09),
-- `public.current_patient_id()` (Phase 09), `public.has_app_role()`
-- (Phase 08) and `public.set_updated_at()` (Phase 06) are all called and
-- none is replaced. **This migration replaces no existing function, drops no
-- policy, alters no existing column and adds no clinical column to an
-- existing table.**
--
-- One thing is added to an existing table, and it only ever refuses more: a
-- unique constraint on
-- `clinical_records (id, appointment_id, patient_id, practitioner_id)`,
-- which exists so the composite foreign keys below can be declared. It is
-- trivially satisfied - `id` is already the primary key - and adds no
-- behaviour, exactly as Phase 12's `appointments_identity_key` did.
--
-- ## The access policy this migration implements
--
-- `phase_13.md` sections 33-37 and 55, and `docs/SECURITY.md` section 6's
-- matrix row ("Prescriptions | View own | **No** | Create/issue | Read,
-- audited").
--
--     doctor         the prescriptions and plans **they authored**, in full,
--                    at any status - the authoring-practitioner model
--                    Phase 12 chose, applied unchanged
--     patient        their **own**, and only once the doctor has issued or
--                    activated them. A draft is invisible to the patient at
--                    the *database* level, not merely in a query
--     receptionist   nothing. No policy at all on any of the four tables
--     admin          nothing. No policy at all. The matrix says "Read,
--                    audited" and the audit subsystem does not exist, so
--                    granting the read now would grant it unaudited
--     anon           no grant at all, so it never reaches row-level security
--
-- ## What a request may say, and what it may not
--
-- Every write is a `security definer` function whose argument list is the
-- allowlist. Across all ten of them there is **no `patientId`, no
-- `practitionerId`, no `doctorId`, no `appointmentId` and no `status`
-- parameter**. The first four are derived from the clinical record, which is
-- itself resolved by id *and* by the caller's own practitioner record in one
-- statement. The fifth does not exist because each transition has its own
-- function: `issue_prescription` is the only path to `issued`,
-- `cancel_prescription` the only path to `cancelled`, and so on.
--
-- ## Historical integrity
--
-- An issued prescription is clinical evidence of what a doctor actually
-- instructed at a moment in time, so:
--
--   * every item carries the **snapshot** of what was prescribed - the
--     medicine or remedy name as the doctor wrote it, its form, strength,
--     dose, frequency, timing, duration, quantity and instructions
--     (section 52). There is no foreign key to a medicine catalog, so a
--     future catalog cannot rewrite an old prescription;
--   * `prescriptions_guard_update()` refuses to change any content of a
--     prescription that is no longer a draft, and
--     `prescription_items_guard_write()` refuses to insert, update or delete
--     an item beneath one. Immutability is in the database, not in the UI;
--   * there is **no delete function, no delete grant and no delete policy**
--     on any of the four tables, and every reference to a patient, a
--     practitioner, an appointment or a clinical record is
--     `on delete restrict`;
--   * correction is `cancel` then a fresh draft, never an edit. The partial
--     unique indexes below are what make that possible: at most one *live*
--     prescription and at most one *live* plan per consultation, so
--     cancelling releases the slot while the cancelled row stays for ever.
--     That is the future-compatible amendment path section 42 asks for, and
--     `amended` is declared in the enum for the formal workflow that will
--     replace it.
--
-- ## No autonomous prescribing
--
-- Nothing in this migration selects a medicine, a dose, a frequency or a
-- duration. Every clinical value arrives as text the doctor typed, and the
-- only thing the database decides is whether the doctor may write it and
-- whether its shape is valid. `phase_13.md` sections 5, 6, 49 and 63.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

-- Section 11. `draft`, `issued` and `cancelled` are reachable today;
-- `amended` is declared and unreachable, for the reason Phase 09 and Phase 12
-- declared their unreachable values: PostgreSQL will not let a value added by
-- `alter type ... add value` be *used* in the same transaction, and Supabase
-- applies each migration in one, so a later phase that added and used it in a
-- single migration would fail. No function below sets it, and a test asserts
-- that.
create type public.prescription_status as enum (
  'draft',
  'issued',
  'cancelled',
  'amended'
);

comment on type public.prescription_status is
  'The prescription lifecycle. Phase 13 reaches draft, issued and cancelled; '
  'amended is declared for a future formal-amendment workflow and is '
  'unreachable today.';

-- Section 45. Only the states the workflow actually needs: a plan is written
-- (draft), given to the patient (active), finished (completed), or withdrawn
-- (cancelled).
create type public.treatment_plan_status as enum (
  'draft',
  'active',
  'completed',
  'cancelled'
);

comment on type public.treatment_plan_status is
  'The treatment plan lifecycle. A plan is editable only while it is a draft; '
  'activating it is what makes it the instruction the patient was given.';

-- Sections 27 and 68. Five categories, because five are what the workflow
-- needs. `exercise` and `medication` from section 27's longer list are
-- deliberately absent: exercise is lifestyle, and medication is a
-- prescription, which is a different table with a different lifecycle and
-- different patient visibility. Section 28 is explicit that the two concepts
-- stay separate and that a plan must not duplicate a prescription.
create type public.treatment_plan_category as enum (
  'diet',
  'lifestyle',
  'therapy',
  'follow_up',
  'other'
);

comment on type public.treatment_plan_category is
  'The structured sections of a treatment plan. Medication is deliberately '
  'absent - that is a prescription, which has its own table, its own '
  'immutability rules and its own patient visibility.';


-- ---------------------------------------------------------------------------
-- 2. The identity key on clinical records
--
-- Exactly Phase 12's `appointments_identity_key`, one level up. It exists so
-- that `prescriptions` and `treatment_plans` can each declare a **composite**
-- foreign key covering all four identities at once, which makes "a
-- prescription that names a different patient than its consultation does"
-- something the database cannot represent rather than something application
-- code must remember to prevent (sections 29-33 and 94).
-- ---------------------------------------------------------------------------

alter table public.clinical_records
  add constraint clinical_records_identity_key
  unique (id, appointment_id, patient_id, practitioner_id);

comment on constraint clinical_records_identity_key on public.clinical_records is
  'Exists so that public.prescriptions and public.treatment_plans can each '
  'declare a composite foreign key to '
  '(id, appointment_id, patient_id, practitioner_id). Trivially true - id is '
  'the primary key - and adds no behaviour of its own.';


-- ---------------------------------------------------------------------------
-- 3. Prescriptions
-- ---------------------------------------------------------------------------

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),

  -- The clinical context (section 29). A prescription is not independent of
  -- the consultation it came out of, so all four identities are carried and
  -- all four are constrained together below.
  clinical_record_id uuid not null,
  appointment_id uuid not null,
  patient_id uuid not null,
  practitioner_id uuid not null,

  status public.prescription_status not null default 'draft',

  -- Section 24. Free text for what the structured item fields cannot carry -
  -- "take with warm water", "stop if the rash returns". It is *additional*
  -- to the items, never a substitute for them: a prescription with no items
  -- cannot be issued, whatever this says.
  general_instructions text,

  -- Optimistic concurrency (section 72), incremented by a trigger on every
  -- update so no function can forget. A caller sends the revision it edited;
  -- a write whose expected version no longer matches reaches no row and is
  -- reported as a conflict rather than overwriting what arrived first.
  --
  -- It is **not** an authorization input. It says *which revision I edited*,
  -- never *whether I may edit*.
  version integer not null default 1,

  -- Who did what, and when (section 78). All three actor columns are
  -- deliberately **absent from the select grant** below, so no client reads
  -- them through any query - they are an audit trail for the subsystem
  -- Phase 19 builds, not screen content. Nullable so the row survives an
  -- account being removed: the instruction is what matters.
  created_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz,
  issued_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,

  -- Section 43. Why a finalized prescription was withdrawn. Granted to
  -- `authenticated`, so the patient sees it - deliberately, and the form
  -- that captures it says so, because "stop taking this" is exactly the
  -- thing a patient must be told.
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ---- Integrity ---------------------------------------------------------

  -- **The consistency guarantee** (sections 29-33 and 94). The quadruple must
  -- exist as a row in `clinical_records`, so a prescription cannot name
  -- patient B against a consultation that belongs to patient A, and cannot
  -- name a practitioner who did not author that consultation. Declarative,
  -- always enforced, and impossible for application code to route around.
  constraint prescriptions_clinical_record_consistency
    foreign key (clinical_record_id, appointment_id, patient_id, practitioner_id)
    references public.clinical_records (id, appointment_id, patient_id, practitioner_id)
    on update cascade
    on delete restrict,

  -- Anchored to the canonical rows directly as well, so the prescription is
  -- not reachable only through the consultation (section 98).
  constraint prescriptions_patient_fkey
    foreign key (patient_id) references public.patients (id)
    on delete restrict,
  constraint prescriptions_practitioner_fkey
    foreign key (practitioner_id) references public.practitioners (id)
    on delete restrict,
  constraint prescriptions_appointment_fkey
    foreign key (appointment_id) references public.appointments (id)
    on delete restrict,

  -- A prescription that has been finalized carries the moment it was
  -- finalized, and a draft carries none. Written as two implications rather
  -- than one equivalence because a prescription cancelled *after* issue
  -- keeps its issue time, which is the whole point of preserving history.
  constraint prescriptions_issued_at_present check (
    status not in ('issued', 'amended') or issued_at is not null
  ),
  constraint prescriptions_draft_not_issued check (
    status <> 'draft' or issued_at is null
  ),
  constraint prescriptions_cancellation_consistency check (
    (status = 'cancelled') = (cancelled_at is not null)
  ),

  -- Bounded text. Long enough for real clinical instruction, short enough
  -- that a payload cannot be used to fill the database. The functions
  -- normalise an empty or whitespace-only value to null, so a stored value
  -- is always meaningful.
  constraint prescriptions_general_instructions_length check (
    general_instructions is null
    or char_length(btrim(general_instructions)) between 1 and 2000
  ),
  constraint prescriptions_cancellation_reason_length check (
    cancellation_reason is null
    or char_length(btrim(cancellation_reason)) between 1 and 300
  ),

  constraint prescriptions_version_positive check (version >= 1)
);

comment on table public.prescriptions is
  'A doctor''s finalized clinical instruction. Highly confidential '
  '(docs/SECURITY.md section 4). Readable in full only by the practitioner '
  'who authored it, and once issued by the patient it was written for. No '
  'receptionist and no administrator has any policy on this table. Every '
  'write is a security definer function - there is no insert, update or '
  'delete grant for any client role.';

comment on column public.prescriptions.practitioner_id is
  'Derived from the clinical record inside the database, never from a '
  'request. No function in this migration has a practitioner parameter.';

comment on column public.prescriptions.version is
  'Optimistic concurrency token, incremented by trigger on every update. A '
  'concurrency control, never an authorization input.';

-- **At most one live prescription per consultation** (sections 73 and 92).
-- A partial unique index rather than a plain one, for two reasons:
--
--   * it is what decides between two genuinely concurrent create requests,
--     under the database's own concurrency control, rather than a
--     check-then-insert that both requests pass; and
--   * excluding `cancelled` leaves the correction path open. A doctor who
--     must replace an issued prescription cancels it - which preserves it
--     for ever - and then starts a fresh draft for the same consultation.
--     That is section 42's "preserve original, new authoritative state",
--     reachable without a formal versioning subsystem.
create unique index prescriptions_one_live_per_record
  on public.prescriptions (clinical_record_id)
  where status <> 'cancelled';

comment on index public.prescriptions_one_live_per_record is
  'At most one draft-or-issued prescription per consultation. Cancelled rows '
  'are excluded so that a withdrawn prescription can be replaced without '
  'being destroyed.';

-- The patient's own history, and the practitioner's (sections 38-39).
create index prescriptions_patient_idx
  on public.prescriptions (patient_id, created_at desc);

create index prescriptions_practitioner_idx
  on public.prescriptions (practitioner_id, created_at desc);

-- Resolving the prescription for a consultation, including cancelled ones,
-- which the partial index above deliberately does not cover.
create index prescriptions_clinical_record_idx
  on public.prescriptions (clinical_record_id);


-- ---------------------------------------------------------------------------
-- 4. Prescription items
--
-- Section 8, and section 52's snapshot list exactly: medicine or remedy name,
-- form, strength, dose, frequency, timing, duration, quantity, instructions.
--
-- **There is no medicine catalog and no `medicine_id` column.** Section 9 is
-- explicit - do not invent an Ayurvedic medicine catalog - and the clinic has
-- supplied no verified one. Section 51 then asks that a prescription remain
-- historically understandable even if a catalog arrives later, and the answer
-- is that every clinically relevant value is stored here as the doctor wrote
-- it. A future catalog can add a nullable reference beside these columns
-- without touching a single existing row, and a change to that catalog still
-- cannot rewrite an issued prescription, because nothing here reads from it.
--
-- Suggestions come from the practitioner's **own prescribing history**
-- (`public.search_prescribed_medicines` below), which is a different thing
-- from a catalog: it is a record of what this doctor has actually written,
-- and it makes no claim about what anyone should prescribe.
--
-- ## Why dose is two text columns and duration is one
--
-- Section 18 asks for dosage structured enough to be clear, and warns against
-- falling back on "take as instructed". `dose_amount` and `dose_unit` are
-- that structure: they render as "1-2 teaspoon" and can be reported on. They
-- are **text**, not numeric, because real Ayurvedic dosing includes "1/2",
-- "1-2" and "a pinch", and a numeric column would push every one of those
-- into the free-text instructions field - which is precisely the outcome
-- section 18 exists to prevent.
--
-- Duration is one text column because section 21's own examples include
-- "Until follow-up" and "As directed", which are not a value and a unit.
-- ---------------------------------------------------------------------------

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),

  -- `cascade` is the correct composition semantic - an item cannot exist
  -- without its prescription - and it is unreachable: there is no delete
  -- function, no delete grant and no delete policy on `prescriptions`, and
  -- every reference into it is `on delete restrict`. Section 98's warning is
  -- about cascades that could destroy clinical history; nothing can delete
  -- the parent.
  prescription_id uuid not null
    references public.prescriptions (id) on delete cascade,

  -- Section 66. A deterministic order the doctor controls, never database row
  -- order. Unique per prescription, so two items cannot claim one place.
  sort_order integer not null,

  -- The only required field. Section 17: do not make every field mandatory,
  -- because a churna has no strength and a therapy has no quantity.
  medicine_name text not null,

  form text,
  strength text,
  dose_amount text,
  dose_unit text,
  frequency text,
  timing text,
  duration text,
  quantity text,
  quantity_unit text,
  instructions text,

  created_at timestamptz not null default now(),

  constraint prescription_items_order_unique unique (prescription_id, sort_order),
  constraint prescription_items_order_range check (sort_order between 1 and 50),

  constraint prescription_items_medicine_name_length check (
    char_length(btrim(medicine_name)) between 1 and 160
  ),
  constraint prescription_items_form_length check (
    form is null or char_length(btrim(form)) between 1 and 80
  ),
  constraint prescription_items_strength_length check (
    strength is null or char_length(btrim(strength)) between 1 and 80
  ),
  constraint prescription_items_dose_amount_length check (
    dose_amount is null or char_length(btrim(dose_amount)) between 1 and 60
  ),
  constraint prescription_items_dose_unit_length check (
    dose_unit is null or char_length(btrim(dose_unit)) between 1 and 60
  ),
  constraint prescription_items_frequency_length check (
    frequency is null or char_length(btrim(frequency)) between 1 and 120
  ),
  constraint prescription_items_timing_length check (
    timing is null or char_length(btrim(timing)) between 1 and 120
  ),
  constraint prescription_items_duration_length check (
    duration is null or char_length(btrim(duration)) between 1 and 120
  ),
  constraint prescription_items_quantity_length check (
    quantity is null or char_length(btrim(quantity)) between 1 and 60
  ),
  constraint prescription_items_quantity_unit_length check (
    quantity_unit is null or char_length(btrim(quantity_unit)) between 1 and 60
  ),
  constraint prescription_items_instructions_length check (
    instructions is null or char_length(btrim(instructions)) between 1 and 1000
  )
);

comment on table public.prescription_items is
  'What was prescribed, as the doctor wrote it. Every clinically relevant '
  'value is stored here rather than referenced from a mutable catalog, so a '
  'later catalog change cannot rewrite an issued prescription.';

create index prescription_items_prescription_idx
  on public.prescription_items (prescription_id, sort_order);

-- Serves the prefix search behind the medicine autocomplete. A btree on the
-- lower-cased name with `text_pattern_ops` is what makes `name ilike 'as%'`
-- an index scan rather than a sequential one.
create index prescription_items_medicine_name_idx
  on public.prescription_items (lower(btrim(medicine_name)) text_pattern_ops);


-- ---------------------------------------------------------------------------
-- 5. Treatment plans
--
-- Section 25-28. Broader than a prescription and deliberately separate from
-- it: a plan says how to eat, live, be treated and when to come back, and it
-- must not restate the medicines, which have their own table, their own
-- immutability and their own patient visibility.
-- ---------------------------------------------------------------------------

create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),

  clinical_record_id uuid not null,
  appointment_id uuid not null,
  patient_id uuid not null,
  practitioner_id uuid not null,

  status public.treatment_plan_status not null default 'draft',

  -- Nullable until the plan is activated, then required by the constraint
  -- below - the same shape Phase 12 used for a clinical record's chief
  -- complaint. A draft may be incomplete; what the patient is *given* may
  -- not be.
  title text,
  summary text,

  -- Section 46. Dates the practitioner sets, and nothing else reads. Section
  -- 47 is emphatic: entering a follow-up date must not create an
  -- appointment. Nothing in this migration writes to `public.appointments`,
  -- and a structural test asserts that.
  start_date date,
  follow_up_on date,

  version integer not null default 1,

  created_by uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  activated_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint treatment_plans_clinical_record_consistency
    foreign key (clinical_record_id, appointment_id, patient_id, practitioner_id)
    references public.clinical_records (id, appointment_id, patient_id, practitioner_id)
    on update cascade
    on delete restrict,

  constraint treatment_plans_patient_fkey
    foreign key (patient_id) references public.patients (id)
    on delete restrict,
  constraint treatment_plans_practitioner_fkey
    foreign key (practitioner_id) references public.practitioners (id)
    on delete restrict,
  constraint treatment_plans_appointment_fkey
    foreign key (appointment_id) references public.appointments (id)
    on delete restrict,

  -- **Activation validation, in the database.** A plan the patient has been
  -- given must have a title. An activation that skipped the application's
  -- validation still cannot produce an untitled active plan.
  constraint treatment_plans_activation_requirements check (
    status = 'draft'
    or (title is not null and btrim(title) <> '')
  ),

  -- A plan that has reached the patient carries the moment it did.
  constraint treatment_plans_activated_at_present check (
    status not in ('active', 'completed') or activated_at is not null
  ),
  constraint treatment_plans_draft_not_activated check (
    status <> 'draft' or activated_at is null
  ),
  constraint treatment_plans_completion_consistency check (
    (status = 'completed') = (completed_at is not null)
  ),
  constraint treatment_plans_cancellation_consistency check (
    (status = 'cancelled') = (cancelled_at is not null)
  ),

  constraint treatment_plans_title_length check (
    title is null or char_length(btrim(title)) between 1 and 160
  ),
  constraint treatment_plans_summary_length check (
    summary is null or char_length(btrim(summary)) between 1 and 2000
  ),

  constraint treatment_plans_version_positive check (version >= 1)
);

comment on table public.treatment_plans is
  'How the patient should eat, live and be treated, and when to come back. '
  'Kept separate from prescriptions (section 28) and never a copy of them. '
  'Readable in full only by the practitioner who wrote it, and once active '
  'by the patient it was written for.';

-- At most one live plan per consultation, on the same reasoning as the
-- prescription index: it decides between concurrent creates, and completing
-- or cancelling a plan releases the slot so a replacement can be written
-- without the previous one being destroyed (sections 44 and 100).
create unique index treatment_plans_one_live_per_record
  on public.treatment_plans (clinical_record_id)
  where status in ('draft', 'active');

create index treatment_plans_patient_idx
  on public.treatment_plans (patient_id, created_at desc);

create index treatment_plans_practitioner_idx
  on public.treatment_plans (practitioner_id, created_at desc);

create index treatment_plans_clinical_record_idx
  on public.treatment_plans (clinical_record_id);


-- ---------------------------------------------------------------------------
-- 6. Treatment plan items
--
-- Section 27, and example 8: a plan is structured sections, not one
-- unstructured blob.
-- ---------------------------------------------------------------------------

create table public.treatment_plan_items (
  id uuid primary key default gen_random_uuid(),

  treatment_plan_id uuid not null
    references public.treatment_plans (id) on delete cascade,

  sort_order integer not null,
  category public.treatment_plan_category not null,

  title text not null,
  instructions text,
  frequency text,
  duration text,

  created_at timestamptz not null default now(),

  constraint treatment_plan_items_order_unique
    unique (treatment_plan_id, sort_order),
  constraint treatment_plan_items_order_range check (sort_order between 1 and 50),

  constraint treatment_plan_items_title_length check (
    char_length(btrim(title)) between 1 and 160
  ),
  constraint treatment_plan_items_instructions_length check (
    instructions is null or char_length(btrim(instructions)) between 1 and 2000
  ),
  constraint treatment_plan_items_frequency_length check (
    frequency is null or char_length(btrim(frequency)) between 1 and 120
  ),
  constraint treatment_plan_items_duration_length check (
    duration is null or char_length(btrim(duration)) between 1 and 120
  )
);

comment on table public.treatment_plan_items is
  'The structured sections of a treatment plan - diet, lifestyle, therapy, '
  'follow-up and other instructions. Preserved as written once the plan is '
  'active (section 53).';

create index treatment_plan_items_plan_idx
  on public.treatment_plan_items (treatment_plan_id, sort_order);


-- ---------------------------------------------------------------------------
-- 7. Timestamps
-- ---------------------------------------------------------------------------

create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row
  execute function public.set_updated_at();

create trigger treatment_plans_set_updated_at
  before update on public.treatment_plans
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 8. The prescription guard
--
-- Three rules in one place, fired before every update whatever wrote it:
-- the identity is fixed, the lifecycle is what it is, and a prescription
-- that is no longer a draft cannot have its content changed. Plus the
-- version increment, which lives here rather than in each function so that a
-- function added later cannot forget it - and a forgotten increment is what
-- turns optimistic concurrency into silent overwrite.
-- ---------------------------------------------------------------------------

create function public.prescriptions_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clinical_record_id <> old.clinical_record_id
     or new.appointment_id <> old.appointment_id
     or new.patient_id <> old.patient_id
     or new.practitioner_id <> old.practitioner_id then
    raise exception 'A prescription cannot be moved to another consultation, patient or practitioner.'
      using errcode = 'PV021';
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status in ('issued', 'cancelled'))
      or (old.status = 'issued' and new.status in ('cancelled', 'amended'))
    ) then
      raise exception 'A prescription cannot change from % to %.',
        old.status, new.status
        using errcode = 'PV024';
    end if;

    -- Section 71 and the acceptance criteria: an issued prescription with no
    -- items is an empty clinical instruction. The function raises a sentence
    -- a practitioner can act on before it gets here; this is what actually
    -- holds, against any writer.
    if new.status = 'issued'
       and not exists (
         select 1 from public.prescription_items pi
         where pi.prescription_id = new.id
       ) then
      raise exception 'A prescription needs at least one medicine or remedy before it can be issued.'
        using errcode = 'PV023';
    end if;
  end if;

  -- **Immutability** (sections 42, 51, 52 and 74). Content is editable only
  -- while the prescription is a draft. The one exception is the issuing
  -- update itself, which may carry nothing but the transition - and it does,
  -- because `issue_prescription` takes no content at all.
  if old.status <> 'draft'
     and (
       new.general_instructions is distinct from old.general_instructions
     ) then
    raise exception 'An issued prescription cannot be edited.'
      using errcode = 'PV021';
  end if;

  new.version := old.version + 1;

  return new;
end;
$$;

comment on function public.prescriptions_guard_update() is
  'Holds the prescription lifecycle, the immutability of an issued '
  'prescription and of its identity columns, the requirement that an issued '
  'prescription has at least one item, and the version increment that makes '
  'optimistic concurrency work.';

create trigger prescriptions_guard_update
  before update on public.prescriptions
  for each row
  execute function public.prescriptions_guard_update();


-- The items half of the same guarantee (section 67). Issued items must not
-- simply disappear from history, so no insert, update or delete is permitted
-- beneath a prescription that is not a draft - whatever route it came by.
create function public.prescription_items_guard_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent uuid;
  parent_status public.prescription_status;
begin
  if tg_op = 'DELETE' then
    parent := old.prescription_id;
  else
    parent := new.prescription_id;
  end if;

  select p.status into parent_status
  from public.prescriptions p
  where p.id = parent;

  if parent_status is distinct from 'draft' then
    raise exception 'The medicines on an issued prescription cannot be changed.'
      using errcode = 'PV021';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.prescription_items_guard_write() is
  'Refuses to insert, update or delete an item beneath a prescription that is '
  'no longer a draft, so that what was issued stays what was issued.';

create trigger prescription_items_guard_write
  before insert or update or delete on public.prescription_items
  for each row
  execute function public.prescription_items_guard_write();


-- ---------------------------------------------------------------------------
-- 9. The treatment plan guard
--
-- The same three rules. Content is frozen on **activation** rather than on
-- completion, because an active plan is the instruction the patient was
-- actually given, and silently rewriting it would rewrite what they were
-- told (sections 44 and 53). Revising a plan means completing or cancelling
-- it and writing a new one, which the partial unique index above allows.
-- ---------------------------------------------------------------------------

create function public.treatment_plans_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clinical_record_id <> old.clinical_record_id
     or new.appointment_id <> old.appointment_id
     or new.patient_id <> old.patient_id
     or new.practitioner_id <> old.practitioner_id then
    raise exception 'A treatment plan cannot be moved to another consultation, patient or practitioner.'
      using errcode = 'PV031';
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status in ('active', 'cancelled'))
      or (old.status = 'active' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'A treatment plan cannot change from % to %.',
        old.status, new.status
        using errcode = 'PV034';
    end if;

    if new.status = 'active'
       and not exists (
         select 1 from public.treatment_plan_items ti
         where ti.treatment_plan_id = new.id
       ) then
      raise exception 'A treatment plan needs at least one instruction before it can be activated.'
        using errcode = 'PV033';
    end if;
  end if;

  if old.status <> 'draft'
     and (
       new.title is distinct from old.title
       or new.summary is distinct from old.summary
       or new.start_date is distinct from old.start_date
       or new.follow_up_on is distinct from old.follow_up_on
     ) then
    raise exception 'An active treatment plan cannot be edited.'
      using errcode = 'PV031';
  end if;

  new.version := old.version + 1;

  return new;
end;
$$;

comment on function public.treatment_plans_guard_update() is
  'Holds the treatment plan lifecycle, the immutability of an activated plan '
  'and of its identity columns, the requirement that an active plan has at '
  'least one instruction, and the version increment.';

create trigger treatment_plans_guard_update
  before update on public.treatment_plans
  for each row
  execute function public.treatment_plans_guard_update();


create function public.treatment_plan_items_guard_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent uuid;
  parent_status public.treatment_plan_status;
begin
  if tg_op = 'DELETE' then
    parent := old.treatment_plan_id;
  else
    parent := new.treatment_plan_id;
  end if;

  select p.status into parent_status
  from public.treatment_plans p
  where p.id = parent;

  if parent_status is distinct from 'draft' then
    raise exception 'The instructions in an active treatment plan cannot be changed.'
      using errcode = 'PV031';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.treatment_plan_items_guard_write() is
  'Refuses to insert, update or delete an item beneath a treatment plan that '
  'is no longer a draft, so that what the patient was told stays what they '
  'were told.';

create trigger treatment_plan_items_guard_write
  before insert or update or delete on public.treatment_plan_items
  for each row
  execute function public.treatment_plan_items_guard_write();


-- ---------------------------------------------------------------------------
-- 10. Policy predicates
--
-- `security definer` rather than a direct table read inside the policy, for
-- the reason Phase 09's second migration exists: a policy expression is
-- evaluated with the *calling* role's privileges, and because policies are
-- OR-ed, PostgreSQL evaluates all of them - so one policy that raises takes
-- out the query for every caller, including the one whose own policy would
-- have admitted them. These four never touch a column a client cannot read.
-- ---------------------------------------------------------------------------

create function public.prescription_belongs_to_current_practitioner(
  p_prescription_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.prescriptions p
    where p.id = p_prescription_id
      and p.practitioner_id = public.current_practitioner_id()
  );
$$;

comment on function public.prescription_belongs_to_current_practitioner(uuid) is
  'Whether the calling practitioner authored this prescription. Takes a '
  'prescription id and answers only about the caller''s own practitioner '
  'record - there is no practitioner argument, so a doctor cannot ask '
  'whether a colleague wrote something.';

-- **The patient visibility rule, in one place** (sections 34, 60 and
-- example 4). A draft is not visible, full stop: the predicate is `status
-- <> 'draft'`, evaluated by the database, not a filter a query could forget.
create function public.prescription_is_visible_to_current_patient(
  p_prescription_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.prescriptions p
    where p.id = p_prescription_id
      and p.status <> 'draft'
      and p.patient_id = public.current_patient_id()
  );
$$;

comment on function public.prescription_is_visible_to_current_patient(uuid) is
  'Whether this prescription has been issued to the calling patient. A draft '
  'never satisfies it.';

create function public.treatment_plan_belongs_to_current_practitioner(
  p_treatment_plan_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.treatment_plans p
    where p.id = p_treatment_plan_id
      and p.practitioner_id = public.current_practitioner_id()
  );
$$;

create function public.treatment_plan_is_visible_to_current_patient(
  p_treatment_plan_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.treatment_plans p
    where p.id = p_treatment_plan_id
      and p.status <> 'draft'
      and p.patient_id = public.current_patient_id()
  );
$$;


-- ---------------------------------------------------------------------------
-- 11. Row-level security
-- ---------------------------------------------------------------------------

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.treatment_plans enable row level security;
alter table public.treatment_plan_items enable row level security;

-- The authoring practitioner, at any status. Scoped by the relationship as
-- well as by the role: holding the doctor role reaches nothing on its own.
create policy prescriptions_select_author
  on public.prescriptions
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and practitioner_id = public.current_practitioner_id()
  );

-- The patient it was written for, once it is no longer a draft.
create policy prescriptions_select_patient
  on public.prescriptions
  for select
  to authenticated
  using (
    public.has_app_role('patient')
    and status <> 'draft'
    and patient_id = public.current_patient_id()
  );

create policy prescription_items_select_author
  on public.prescription_items
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and public.prescription_belongs_to_current_practitioner(prescription_id)
  );

create policy prescription_items_select_patient
  on public.prescription_items
  for select
  to authenticated
  using (
    public.has_app_role('patient')
    and public.prescription_is_visible_to_current_patient(prescription_id)
  );

create policy treatment_plans_select_author
  on public.treatment_plans
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and practitioner_id = public.current_practitioner_id()
  );

create policy treatment_plans_select_patient
  on public.treatment_plans
  for select
  to authenticated
  using (
    public.has_app_role('patient')
    and status <> 'draft'
    and patient_id = public.current_patient_id()
  );

create policy treatment_plan_items_select_author
  on public.treatment_plan_items
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and public.treatment_plan_belongs_to_current_practitioner(treatment_plan_id)
  );

create policy treatment_plan_items_select_patient
  on public.treatment_plan_items
  for select
  to authenticated
  using (
    public.has_app_role('patient')
    and public.treatment_plan_is_visible_to_current_patient(treatment_plan_id)
  );

-- There is no insert, update or delete policy on any of the four tables, for
-- any role, and no grant either - so such a write is refused at the privilege
-- check before row-level security is even consulted. A receptionist and an
-- administrator have **no policy at all**, which is a stronger statement than
-- a predicate that evaluates to false: a predicate can be weakened by an
-- edit, an absent policy cannot.


-- ---------------------------------------------------------------------------
-- 12. Grants
--
-- `anon` receives nothing on any of the four tables.
--
-- The select grants are **column-scoped**, and the columns left out are the
-- actor ids: `created_by`, `issued_by`, `cancelled_by`, `activated_by` and
-- `completed_by`. Column privileges belong to a database role, and a patient
-- and a doctor are both `authenticated`, so a column readable by one is
-- readable by the other - the trap Phase 10 recorded about `internal_note`.
-- Nothing on a screen needs them, so nothing reads them: they are an audit
-- trail for the subsystem Phase 19 builds (section 78).
-- ---------------------------------------------------------------------------

revoke all on public.prescriptions from anon, authenticated;
grant select (
  id,
  clinical_record_id,
  appointment_id,
  patient_id,
  practitioner_id,
  status,
  general_instructions,
  version,
  issued_at,
  cancelled_at,
  cancellation_reason,
  created_at,
  updated_at
) on public.prescriptions to authenticated;

revoke all on public.prescription_items from anon, authenticated;
grant select on public.prescription_items to authenticated;

revoke all on public.treatment_plans from anon, authenticated;
grant select (
  id,
  clinical_record_id,
  appointment_id,
  patient_id,
  practitioner_id,
  status,
  title,
  summary,
  start_date,
  follow_up_on,
  version,
  activated_at,
  completed_at,
  cancelled_at,
  created_at,
  updated_at
) on public.treatment_plans to authenticated;

revoke all on public.treatment_plan_items from anon, authenticated;
grant select on public.treatment_plan_items to authenticated;


-- ---------------------------------------------------------------------------
-- 13. Creating a prescription
--
-- One parameter: the id of one of the caller's own clinical records. The
-- patient, the practitioner and the appointment are read **out of that
-- record**, which is section 58's manipulated payload made irrelevant -
-- there is nowhere for a patient id to arrive and nothing for it to do.
--
-- Idempotent. A double-click, a retry, a refresh and two genuinely
-- concurrent requests all resolve to one prescription, because the partial
-- unique index is what decides and the insert reads back whatever won.
-- ---------------------------------------------------------------------------

create function public.create_prescription(p_clinical_record_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  practitioner uuid;
  rec record;
  prescription_id uuid;
begin
  practitioner := public.assert_care_practitioner();

  -- By id *and* by the caller's own practitioner record, in one statement.
  -- Another practitioner's consultation is indistinguishable from one that
  -- does not exist (section 56).
  select cr.id, cr.appointment_id, cr.patient_id, cr.practitioner_id
    into rec
  from public.clinical_records cr
  where cr.id = p_clinical_record_id
    and cr.practitioner_id = practitioner;

  if rec.id is null then
    raise exception 'Consultation not found.'
      using errcode = 'PV025';
  end if;

  insert into public.prescriptions (
    clinical_record_id, appointment_id, patient_id, practitioner_id,
    status, created_by
  )
  values (
    rec.id, rec.appointment_id, rec.patient_id, rec.practitioner_id,
    'draft', actor
  )
  on conflict (clinical_record_id) where status <> 'cancelled' do nothing
  returning id into prescription_id;

  if prescription_id is null then
    -- Somebody got there first - a second click, a retry, or a genuinely
    -- concurrent request. Read back the one that exists rather than failing:
    -- at most one live prescription exists for this consultation, which is
    -- what the caller wanted.
    select p.id into prescription_id
    from public.prescriptions p
    where p.clinical_record_id = rec.id
      and p.status <> 'cancelled';
  end if;

  return prescription_id;
end;
$$;

comment on function public.create_prescription(uuid) is
  'Opens a draft prescription against one of the calling practitioner''s own '
  'consultations, deriving the patient, the practitioner and the appointment '
  'from the consultation itself. Idempotent: a repeat returns the existing '
  'draft.';


-- ---------------------------------------------------------------------------
-- 14. Saving a prescription draft
--
-- The argument list is the allowlist: a prescription id, the revision being
-- edited, the general instructions, and the items. No status, no patient, no
-- practitioner, no appointment, no timestamp.
--
-- Items arrive as a JSON array and are extracted **key by key**, so an
-- unexpected key in the payload reaches no column. The whole collection is
-- replaced rather than diffed, which is what makes add, edit, remove and
-- reorder one atomic operation against one revision - and the replacement
-- happens after the guarded update, so a stale caller replaces nothing.
-- ---------------------------------------------------------------------------

create function public.save_prescription_draft(
  p_prescription_id uuid,
  p_expected_version integer,
  p_general_instructions text,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  practitioner uuid;
  existing record;
  items jsonb := coalesce(p_items, '[]'::jsonb);
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  if jsonb_typeof(items) <> 'array' then
    raise exception 'The prescription items are not in the expected form.'
      using errcode = 'PV023';
  end if;

  if jsonb_array_length(items) > 50 then
    raise exception 'A prescription can hold at most 50 medicines or remedies.'
      using errcode = 'PV023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(items) as e(value)
    where jsonb_typeof(e.value) <> 'object'
       or nullif(btrim(coalesce(e.value ->> 'medicineName', '')), '') is null
  ) then
    raise exception 'Every item needs a medicine or remedy name.'
      using errcode = 'PV023';
  end if;

  select p.id, p.status, p.version into existing
  from public.prescriptions p
  where p.id = p_prescription_id
    and p.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Prescription not found.'
      using errcode = 'PV020';
  end if;

  if existing.status <> 'draft' then
    raise exception 'An issued prescription cannot be edited.'
      using errcode = 'PV021';
  end if;

  -- Distinguished from "not found" deliberately: "this has moved on" is
  -- something the practitioner can act on by reloading, and "this does not
  -- exist" is not.
  if existing.version <> p_expected_version then
    raise exception 'This prescription was updated elsewhere.'
      using errcode = 'PV022';
  end if;

  update public.prescriptions p
  set general_instructions =
        nullif(btrim(coalesce(p_general_instructions, '')), '')
  where p.id = existing.id
    and p.practitioner_id = practitioner
    and p.status = 'draft'
    -- The optimistic lock, applied again in the statement itself so that two
    -- concurrent saves cannot both pass the check above and both write.
    and p.version = p_expected_version
  returning p.version into next_version;

  if next_version is null then
    raise exception 'This prescription was updated elsewhere.'
      using errcode = 'PV022';
  end if;

  delete from public.prescription_items pi
  where pi.prescription_id = existing.id;

  insert into public.prescription_items (
    prescription_id, sort_order, medicine_name, form, strength,
    dose_amount, dose_unit, frequency, timing, duration,
    quantity, quantity_unit, instructions
  )
  select
    existing.id,
    e.ordinality::integer,
    btrim(e.value ->> 'medicineName'),
    nullif(btrim(coalesce(e.value ->> 'form', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'strength', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'doseAmount', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'doseUnit', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'frequency', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'timing', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'duration', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'quantity', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'quantityUnit', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'instructions', '')), '')
  from jsonb_array_elements(items) with ordinality as e(value, ordinality);

  return next_version;
end;
$$;

comment on function public.save_prescription_draft(uuid, integer, text, jsonb) is
  'Saves the content of one of the calling practitioner''s own draft '
  'prescriptions, replacing its items atomically. Refuses an issued '
  'prescription and refuses a stale write, and returns the new revision so '
  'the caller can carry on editing without reloading.';


-- ---------------------------------------------------------------------------
-- 15. Issuing a prescription
--
-- **Takes no content.** The doctor reviews what is saved and then issues
-- exactly that, so there is no way for the act of issuing to change what is
-- issued (sections 15, 16 and example 3). Two parameters: which prescription,
-- and which revision the doctor was looking at.
-- ---------------------------------------------------------------------------

create function public.issue_prescription(
  p_prescription_id uuid,
  p_expected_version integer
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
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  select p.id, p.status, p.version into existing
  from public.prescriptions p
  where p.id = p_prescription_id
    and p.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Prescription not found.'
      using errcode = 'PV020';
  end if;

  if existing.status <> 'draft' then
    raise exception 'This prescription has already been issued.'
      using errcode = 'PV021';
  end if;

  if existing.version <> p_expected_version then
    raise exception 'This prescription was updated elsewhere.'
      using errcode = 'PV022';
  end if;

  -- Raised here so the refusal carries a sentence the practitioner can act
  -- on; the guard trigger is what actually holds, against any writer.
  if not exists (
    select 1 from public.prescription_items pi
    where pi.prescription_id = existing.id
  ) then
    raise exception 'A prescription needs at least one medicine or remedy before it can be issued.'
      using errcode = 'PV023';
  end if;

  update public.prescriptions p
  set status = 'issued',
      issued_at = now(),
      issued_by = actor
  where p.id = existing.id
    and p.practitioner_id = practitioner
    and p.status = 'draft'
    and p.version = p_expected_version
  returning p.version into next_version;

  -- A second, concurrent issue request finds the row already `issued` and
  -- matches nothing here, so exactly one of two simultaneous requests
  -- succeeds and the other is told the prescription has moved on. There is
  -- no path by which both write, and no path by which a second prescription
  -- is created (section 92).
  if next_version is null then
    raise exception 'This prescription was updated elsewhere.'
      using errcode = 'PV022';
  end if;

  return next_version;
end;
$$;

comment on function public.issue_prescription(uuid, integer) is
  'The only path to the issued status. Takes no clinical content, so issuing '
  'cannot change what is issued, and refuses a prescription with no items.';


-- ---------------------------------------------------------------------------
-- 16. Cancelling a prescription
--
-- Section 43 and section 99: invalidation is a status change, never a
-- delete. The row, its items and its issue time all survive.
-- ---------------------------------------------------------------------------

create function public.cancel_prescription(
  p_prescription_id uuid,
  p_expected_version integer,
  p_reason text default null
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
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  select p.id, p.status, p.version into existing
  from public.prescriptions p
  where p.id = p_prescription_id
    and p.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Prescription not found.'
      using errcode = 'PV020';
  end if;

  if existing.status not in ('draft', 'issued') then
    raise exception 'This prescription has already been withdrawn.'
      using errcode = 'PV024';
  end if;

  if existing.version <> p_expected_version then
    raise exception 'This prescription was updated elsewhere.'
      using errcode = 'PV022';
  end if;

  update public.prescriptions p
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = actor,
      cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where p.id = existing.id
    and p.practitioner_id = practitioner
    and p.status in ('draft', 'issued')
    and p.version = p_expected_version
  returning p.version into next_version;

  if next_version is null then
    raise exception 'This prescription was updated elsewhere.'
      using errcode = 'PV022';
  end if;

  return next_version;
end;
$$;

comment on function public.cancel_prescription(uuid, integer, text) is
  'Withdraws a prescription by status, never by deletion. The row, its items '
  'and its issue time are preserved, and the consultation becomes free for a '
  'corrected prescription.';


-- ---------------------------------------------------------------------------
-- 17. Creating a treatment plan
-- ---------------------------------------------------------------------------

create function public.create_treatment_plan(p_clinical_record_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  practitioner uuid;
  rec record;
  plan_id uuid;
begin
  practitioner := public.assert_care_practitioner();

  select cr.id, cr.appointment_id, cr.patient_id, cr.practitioner_id
    into rec
  from public.clinical_records cr
  where cr.id = p_clinical_record_id
    and cr.practitioner_id = practitioner;

  if rec.id is null then
    raise exception 'Consultation not found.'
      using errcode = 'PV035';
  end if;

  insert into public.treatment_plans (
    clinical_record_id, appointment_id, patient_id, practitioner_id,
    status, created_by
  )
  values (
    rec.id, rec.appointment_id, rec.patient_id, rec.practitioner_id,
    'draft', actor
  )
  on conflict (clinical_record_id) where status in ('draft', 'active') do nothing
  returning id into plan_id;

  if plan_id is null then
    select p.id into plan_id
    from public.treatment_plans p
    where p.clinical_record_id = rec.id
      and p.status in ('draft', 'active');
  end if;

  return plan_id;
end;
$$;

comment on function public.create_treatment_plan(uuid) is
  'Opens a draft treatment plan against one of the calling practitioner''s '
  'own consultations. Idempotent: a repeat returns the existing live plan.';


-- ---------------------------------------------------------------------------
-- 18. Saving a treatment plan draft
-- ---------------------------------------------------------------------------

create function public.save_treatment_plan_draft(
  p_treatment_plan_id uuid,
  p_expected_version integer,
  p_title text,
  p_summary text,
  p_start_date date,
  p_follow_up_on date,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  practitioner uuid;
  existing record;
  items jsonb := coalesce(p_items, '[]'::jsonb);
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  if jsonb_typeof(items) <> 'array' then
    raise exception 'The treatment plan items are not in the expected form.'
      using errcode = 'PV033';
  end if;

  if jsonb_array_length(items) > 50 then
    raise exception 'A treatment plan can hold at most 50 instructions.'
      using errcode = 'PV033';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(items) as e(value)
    where jsonb_typeof(e.value) <> 'object'
       or nullif(btrim(coalesce(e.value ->> 'title', '')), '') is null
       or coalesce(e.value ->> 'category', '') not in (
            'diet', 'lifestyle', 'therapy', 'follow_up', 'other'
          )
  ) then
    raise exception 'Every instruction needs a heading and a section.'
      using errcode = 'PV033';
  end if;

  select p.id, p.status, p.version into existing
  from public.treatment_plans p
  where p.id = p_treatment_plan_id
    and p.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Treatment plan not found.'
      using errcode = 'PV030';
  end if;

  if existing.status <> 'draft' then
    raise exception 'An active treatment plan cannot be edited.'
      using errcode = 'PV031';
  end if;

  if existing.version <> p_expected_version then
    raise exception 'This treatment plan was updated elsewhere.'
      using errcode = 'PV032';
  end if;

  update public.treatment_plans p
  set title = nullif(btrim(coalesce(p_title, '')), ''),
      summary = nullif(btrim(coalesce(p_summary, '')), ''),
      start_date = p_start_date,
      follow_up_on = p_follow_up_on
  where p.id = existing.id
    and p.practitioner_id = practitioner
    and p.status = 'draft'
    and p.version = p_expected_version
  returning p.version into next_version;

  if next_version is null then
    raise exception 'This treatment plan was updated elsewhere.'
      using errcode = 'PV032';
  end if;

  delete from public.treatment_plan_items ti
  where ti.treatment_plan_id = existing.id;

  insert into public.treatment_plan_items (
    treatment_plan_id, sort_order, category, title,
    instructions, frequency, duration
  )
  select
    existing.id,
    e.ordinality::integer,
    (e.value ->> 'category')::public.treatment_plan_category,
    btrim(e.value ->> 'title'),
    nullif(btrim(coalesce(e.value ->> 'instructions', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'frequency', '')), ''),
    nullif(btrim(coalesce(e.value ->> 'duration', '')), '')
  from jsonb_array_elements(items) with ordinality as e(value, ordinality);

  return next_version;
end;
$$;

comment on function public.save_treatment_plan_draft(uuid, integer, text, text, date, date, jsonb) is
  'Saves the content of one of the calling practitioner''s own draft '
  'treatment plans, replacing its items atomically. Writes no appointment: a '
  'follow-up date is a note to the patient, not a booking (section 47).';


-- ---------------------------------------------------------------------------
-- 19. Activating, completing and cancelling a treatment plan
--
-- Three functions rather than one with a status parameter, so that there is
-- no status parameter anywhere in this feature to manipulate (section 59).
-- ---------------------------------------------------------------------------

create function public.activate_treatment_plan(
  p_treatment_plan_id uuid,
  p_expected_version integer
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
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  select p.id, p.status, p.version, p.title into existing
  from public.treatment_plans p
  where p.id = p_treatment_plan_id
    and p.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Treatment plan not found.'
      using errcode = 'PV030';
  end if;

  if existing.status <> 'draft' then
    raise exception 'This treatment plan is no longer a draft.'
      using errcode = 'PV031';
  end if;

  if existing.version <> p_expected_version then
    raise exception 'This treatment plan was updated elsewhere.'
      using errcode = 'PV032';
  end if;

  if nullif(btrim(coalesce(existing.title, '')), '') is null then
    raise exception 'A treatment plan needs a title before the patient can be given it.'
      using errcode = 'PV033';
  end if;

  if not exists (
    select 1 from public.treatment_plan_items ti
    where ti.treatment_plan_id = existing.id
  ) then
    raise exception 'A treatment plan needs at least one instruction before it can be activated.'
      using errcode = 'PV033';
  end if;

  update public.treatment_plans p
  set status = 'active',
      activated_at = now(),
      activated_by = actor
  where p.id = existing.id
    and p.practitioner_id = practitioner
    and p.status = 'draft'
    and p.version = p_expected_version
  returning p.version into next_version;

  if next_version is null then
    raise exception 'This treatment plan was updated elsewhere.'
      using errcode = 'PV032';
  end if;

  return next_version;
end;
$$;

comment on function public.activate_treatment_plan(uuid, integer) is
  'The only path to the active status, and therefore the only point at which '
  'a treatment plan becomes visible to the patient.';


create function public.complete_treatment_plan(
  p_treatment_plan_id uuid,
  p_expected_version integer
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
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  select p.id, p.status, p.version into existing
  from public.treatment_plans p
  where p.id = p_treatment_plan_id
    and p.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Treatment plan not found.'
      using errcode = 'PV030';
  end if;

  if existing.status <> 'active' then
    raise exception 'Only an active treatment plan can be completed.'
      using errcode = 'PV034';
  end if;

  if existing.version <> p_expected_version then
    raise exception 'This treatment plan was updated elsewhere.'
      using errcode = 'PV032';
  end if;

  update public.treatment_plans p
  set status = 'completed',
      completed_at = now(),
      completed_by = actor
  where p.id = existing.id
    and p.practitioner_id = practitioner
    and p.status = 'active'
    and p.version = p_expected_version
  returning p.version into next_version;

  if next_version is null then
    raise exception 'This treatment plan was updated elsewhere.'
      using errcode = 'PV032';
  end if;

  return next_version;
end;
$$;


create function public.cancel_treatment_plan(
  p_treatment_plan_id uuid,
  p_expected_version integer
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
  next_version integer;
begin
  practitioner := public.assert_care_practitioner();

  select p.id, p.status, p.version into existing
  from public.treatment_plans p
  where p.id = p_treatment_plan_id
    and p.practitioner_id = practitioner;

  if existing.id is null then
    raise exception 'Treatment plan not found.'
      using errcode = 'PV030';
  end if;

  if existing.status not in ('draft', 'active') then
    raise exception 'This treatment plan has already been closed.'
      using errcode = 'PV034';
  end if;

  if existing.version <> p_expected_version then
    raise exception 'This treatment plan was updated elsewhere.'
      using errcode = 'PV032';
  end if;

  update public.treatment_plans p
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = actor
  where p.id = existing.id
    and p.practitioner_id = practitioner
    and p.status in ('draft', 'active')
    and p.version = p_expected_version
  returning p.version into next_version;

  if next_version is null then
    raise exception 'This treatment plan was updated elsewhere.'
      using errcode = 'PV032';
  end if;

  return next_version;
end;
$$;

comment on function public.cancel_treatment_plan(uuid, integer) is
  'Withdraws a treatment plan by status, never by deletion (section 100). '
  'The consultation then becomes free for a replacement plan.';


-- ---------------------------------------------------------------------------
-- 20. Medicine suggestions
--
-- Section 65: a medicine or remedy this doctor has prescribed before should
-- be offered as a suggestion while they type.
--
-- This is **not** a catalog and makes no clinical claim. It is a record of
-- what this practitioner has actually written, scoped to their own
-- prescriptions in the `from` clause rather than in a predicate a later edit
-- could drop. It discloses no patient, no date and no dose - one name and
-- the form last used with it - so it cannot be used to learn anything about
-- anybody.
--
-- Bounded like every other search in this project: it refuses an empty term,
-- clamps its own limit, escapes `%` and `_`, and matches a **prefix** only,
-- so there is no term that returns everything.
-- ---------------------------------------------------------------------------

create function public.search_prescribed_medicines(
  p_query text,
  p_limit integer default 8
)
returns table (
  medicine_name text,
  form text
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
  bounded integer;
begin
  practitioner := public.assert_care_practitioner();

  term := btrim(coalesce(p_query, ''));
  if char_length(term) < 1 then
    return;
  end if;

  bounded := least(greatest(coalesce(p_limit, 8), 1), 20);

  pattern := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    select distinct on (lower(btrim(pi.medicine_name)))
      pi.medicine_name,
      pi.form
    from public.prescription_items pi
    join public.prescriptions p on p.id = pi.prescription_id
    where p.practitioner_id = practitioner
      and pi.medicine_name ilike pattern escape '\'
    order by lower(btrim(pi.medicine_name)), pi.created_at desc
    limit bounded;
end;
$$;

comment on function public.search_prescribed_medicines(text, integer) is
  'Prefix suggestions drawn from the calling practitioner''s own prescribing '
  'history. Not a medicine catalog and not a recommendation: it reports what '
  'this doctor has written before and nothing else. Refuses a caller who is '
  'not a doctor with a practitioner record, returns nothing for an empty '
  'term, clamps its own limit and escapes wildcards.';


-- ---------------------------------------------------------------------------
-- 21. Function grants
--
-- Every write function is revoked from `public` and granted to
-- `authenticated` only; each one then refuses a caller who is not a doctor
-- with a practitioner record, inside the database, before it reads or writes
-- anything. The four policy predicates are **not** granted to any client
-- role - they exist for row-level security and are not an API.
-- ---------------------------------------------------------------------------

revoke all on function public.create_prescription(uuid) from public;
grant execute on function public.create_prescription(uuid) to authenticated;

revoke all on function public.save_prescription_draft(uuid, integer, text, jsonb) from public;
grant execute on function public.save_prescription_draft(uuid, integer, text, jsonb) to authenticated;

revoke all on function public.issue_prescription(uuid, integer) from public;
grant execute on function public.issue_prescription(uuid, integer) to authenticated;

revoke all on function public.cancel_prescription(uuid, integer, text) from public;
grant execute on function public.cancel_prescription(uuid, integer, text) to authenticated;

revoke all on function public.create_treatment_plan(uuid) from public;
grant execute on function public.create_treatment_plan(uuid) to authenticated;

revoke all on function public.save_treatment_plan_draft(uuid, integer, text, text, date, date, jsonb) from public;
grant execute on function public.save_treatment_plan_draft(uuid, integer, text, text, date, date, jsonb) to authenticated;

revoke all on function public.activate_treatment_plan(uuid, integer) from public;
grant execute on function public.activate_treatment_plan(uuid, integer) to authenticated;

revoke all on function public.complete_treatment_plan(uuid, integer) from public;
grant execute on function public.complete_treatment_plan(uuid, integer) to authenticated;

revoke all on function public.cancel_treatment_plan(uuid, integer) from public;
grant execute on function public.cancel_treatment_plan(uuid, integer) to authenticated;

revoke all on function public.search_prescribed_medicines(text, integer) from public;
grant execute on function public.search_prescribed_medicines(text, integer) to authenticated;

revoke all on function public.prescription_belongs_to_current_practitioner(uuid) from public;
revoke all on function public.prescription_is_visible_to_current_patient(uuid) from public;
revoke all on function public.treatment_plan_belongs_to_current_practitioner(uuid) from public;
revoke all on function public.treatment_plan_is_visible_to_current_patient(uuid) from public;
