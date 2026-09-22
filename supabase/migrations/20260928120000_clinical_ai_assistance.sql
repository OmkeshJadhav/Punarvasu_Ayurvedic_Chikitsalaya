-- ---------------------------------------------------------------------------
-- Phase 17 — AI Clinical Decision Support
--
-- ## What this migration is, and what it deliberately is not
--
-- It is an **operational audit and a quota**, and nothing else.
--
-- `phase_17.md` sections 25, 28 and 151 make persistence optional and warn
-- against storing AI output in the patient's record.
-- `docs/HEALTHCARE_AND_AI_SAFETY.md` section 8 makes one thing mandatory in
-- the other direction: prompts and responses involving patient data are
-- subject to the same retention, logging and audit rules as any other
-- clinical access, "including an entry recording that AI processed a given
-- patient's record".
--
-- So the table below records **that** a model was asked about a patient, by
-- whom, when, for which task, with which prompt version and model, and how it
-- went. It has:
--
--   * no prompt column          (section 27)
--   * no response column        (section 28)
--   * no summary, consideration, warning or missing-information column
--   * no clinical text of any kind
--   * no confidence score       (sections 30, 31)
--
-- A row here is evidence that an access happened. It is not a clinical record,
-- it is not a draft, and nothing in the application reads it back into a
-- consultation. Section 25: AI suggestions are not clinical records.
--
-- ## Why the quota lives here rather than in memory
--
-- `src/lib/rate-limit/fixed-window.ts` says plainly what it is: a guard rail
-- on one server instance, cleared by a restart, uncoordinated across a fleet.
-- That is adequate for an internal endpoint behind a shared secret. It is not
-- adequate for section 104's cost abuse, where the thing being bounded is
-- money spent with an external provider, and a restart must not refill the
-- bucket.
--
-- So the quota is a count of rows in a window, taken **before** the provider
-- is called. A flood of concurrent requests is bounded because each one
-- inserts before any of them reaches the provider, and the audit entry is
-- written before the data leaves the building — which is the right order for
-- an audit.
--
-- ## No client can write this table, and no client can read it
--
-- No insert, update or delete grant and no such policy, for anybody — the
-- discipline every phase since 08 has followed. There is also **no select
-- policy at all**: no workflow needs one, and an absent policy is a stronger
-- statement than a predicate somebody could weaken. The definer functions
-- below are the whole interface.
--
-- ## The grant lesson from Phase 15
--
-- `revoke ... from public` does **not** remove Supabase's default named
-- grants: a newly created function is granted to `anon` and `authenticated`
-- by name at creation time. Phase 15 shipped that defect and needed two
-- follow-up migrations. Every revoke below names `anon` explicitly, and every
-- reachable function carries its gate in the **body** rather than relying on
-- the grant.
--
-- ## Summary of change
--
-- Tables:            1 added (public.ai_assistance_sessions). 0 altered.
-- Enums:             2 added
-- Existing objects:  0 altered, 0 dropped, 0 replaced
-- RLS policies:      0 added (RLS enabled, no policy at all)
-- Functions:         6 added
-- Grants:            EXECUTE on 5 functions to authenticated; nothing to anon;
--                    no table grant to any client role
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- The tasks a doctor may ask for. A closed set, in the database as well as in
-- the application, so section 92's "no generic AI endpoint" is a property of
-- the schema and not only of a route handler. A task the clinic has not
-- defined cannot be recorded, which means it cannot be run.
--
-- `document_summary` from section 16 is deliberately absent: Phase 14 stores
-- no document text and section 59 forbids adding OCR for this phase, so a
-- document summary would have nothing to summarise. Adding it later is an
-- `alter type ... add value` in the migration that makes text available.
create type public.ai_assistance_task as enum (
  'clinical_summary',
  'missing_information',
  'clinical_considerations',
  'consultation_summary'
);

comment on type public.ai_assistance_task is
  'The closed set of doctor-facing AI tasks. Not an open prompt interface.';


-- How an invocation ended.
--
-- `rejected` is the one worth naming: the provider answered and the
-- application's own safety layer refused the answer (section 69). It is not a
-- failure of the provider and it is not a success, and collapsing it into
-- either would hide the number that matters most operationally — how often
-- the model tries to step outside the clinical-support boundary.
create type public.ai_assistance_status as enum (
  'pending',
  'succeeded',
  'failed',
  'rejected'
);

comment on type public.ai_assistance_status is
  'pending -> succeeded | failed | rejected. rejected means our own safety layer refused the provider output.';


-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------
create table public.ai_assistance_sessions (
  id uuid primary key default gen_random_uuid(),

  -- Derived from auth.uid() inside the function below, never a parameter.
  practitioner_id uuid not null
    references public.practitioners(id) on delete restrict,

  -- Derived from the appointment, never a parameter. Section 8 and example 4:
  -- a doctor cannot supply an arbitrary patient identifier.
  patient_id uuid not null
    references public.patients(id) on delete restrict,

  appointment_id uuid not null
    references public.appointments(id) on delete restrict,

  -- Null when the consultation has not been documented yet. The context
  -- builder can still work from the appointment alone.
  clinical_record_id uuid
    references public.clinical_records(id) on delete restrict,

  task public.ai_assistance_task not null,

  -- Section 33. Which prompt produced this, so a later behaviour change is
  -- traceable to a versioned template rather than to "the model changed".
  prompt_version text not null,

  -- Section 124. The model is recorded per invocation because changing it can
  -- change clinical behaviour, and "which model said that?" must be
  -- answerable six months later.
  provider text not null,
  model text not null,

  status public.ai_assistance_status not null default 'pending',

  -- A stable, low-cardinality category — provider_timeout, invalid_response,
  -- safety_rejected. **Never** provider text: a provider error message can
  -- echo the request back, and the request is a clinical prompt (section 90).
  failure_code text,

  latency_ms integer,
  input_tokens integer,
  output_tokens integer,

  -- Sections 84-85. A short hash of the context the result was generated
  -- from — record version, selected document ids, history counts. It carries
  -- no clinical content and cannot be reversed into any; it exists so a result
  -- generated against revision 1 cannot silently look current against
  -- revision 2.
  context_fingerprint text not null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  -- The composite keys Phases 12-14 added exist for exactly this: the triple
  -- must be a real appointment, so a session naming this patient against that
  -- practitioner's appointment is not something application code has to
  -- prevent — the database cannot represent it.
  constraint ai_assistance_sessions_appointment_consistency
    foreign key (appointment_id, patient_id, practitioner_id)
    references public.appointments (id, patient_id, practitioner_id)
    on delete restrict,

  -- MATCH SIMPLE, so it is simply not checked when there is no consultation
  -- yet. When there is one, it must belong to the same patient.
  constraint ai_assistance_sessions_record_consistency
    foreign key (clinical_record_id, patient_id)
    references public.clinical_records (id, patient_id)
    on delete restrict,

  constraint ai_assistance_sessions_completion_consistency
    check ((status = 'pending') = (completed_at is null)),

  constraint ai_assistance_sessions_failure_code_shape
    check (
      failure_code is null
      or failure_code ~ '^[a-z][a-z0-9_]{1,48}$'
    ),

  constraint ai_assistance_sessions_fingerprint_shape
    check (context_fingerprint ~ '^[a-f0-9]{16,64}$'),

  constraint ai_assistance_sessions_prompt_version_shape
    check (prompt_version ~ '^[a-z][a-z0-9_]{1,62}$'),

  constraint ai_assistance_sessions_provider_shape
    check (provider ~ '^[a-z][a-z0-9_-]{1,30}$'),

  constraint ai_assistance_sessions_model_length
    check (char_length(model) between 1 and 120),

  constraint ai_assistance_sessions_latency_range
    check (latency_ms is null or latency_ms between 0 and 600000),

  constraint ai_assistance_sessions_input_tokens_range
    check (input_tokens is null or input_tokens between 0 and 10000000),

  constraint ai_assistance_sessions_output_tokens_range
    check (output_tokens is null or output_tokens between 0 and 10000000)
);

comment on table public.ai_assistance_sessions is
  'Operational audit of clinical AI invocations. No prompt, no response, no clinical text, no confidence score.';

comment on column public.ai_assistance_sessions.context_fingerprint is
  'Opaque hash of the context version, for staleness detection. Carries no clinical content.';

comment on column public.ai_assistance_sessions.failure_code is
  'Stable operational category. Never provider text, which can echo a clinical prompt back.';


-- The quota window's query: one practitioner, recent rows.
create index ai_assistance_sessions_practitioner_window_idx
  on public.ai_assistance_sessions (practitioner_id, created_at desc);

-- The per-patient quota, and "was this patient's record processed by AI?" —
-- the question `docs/HEALTHCARE_AND_AI_SAFETY.md` section 8 exists to make
-- answerable.
create index ai_assistance_sessions_patient_idx
  on public.ai_assistance_sessions (patient_id, created_at desc);

-- Phase 16's aggregate read.
create index ai_assistance_sessions_created_at_idx
  on public.ai_assistance_sessions (created_at);


-- ---------------------------------------------------------------------------
-- Row-level security: enabled, and no policy at all
-- ---------------------------------------------------------------------------
-- Not a patient, not a receptionist, not an administrator, not the doctor who
-- created the row. No workflow reads this table directly; the definer
-- functions below are the whole interface, and Phase 16's aggregate reads it
-- as the definer.
--
-- An absent policy is stronger than a predicate that evaluates to false: a
-- predicate can be weakened by an edit, and an absent policy cannot.
alter table public.ai_assistance_sessions enable row level security;

revoke all on public.ai_assistance_sessions from anon, authenticated;


-- ---------------------------------------------------------------------------
-- Immutability
-- ---------------------------------------------------------------------------
-- An audit entry that can be rewritten is not an audit entry. Identity is
-- fixed, the task and the model are fixed, and the status moves one way out
-- of pending and never back.
create function public.ai_assistance_sessions_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.id is distinct from old.id
     or new.practitioner_id is distinct from old.practitioner_id
     or new.patient_id is distinct from old.patient_id
     or new.appointment_id is distinct from old.appointment_id
     or new.clinical_record_id is distinct from old.clinical_record_id
     or new.task is distinct from old.task
     or new.prompt_version is distinct from old.prompt_version
     or new.provider is distinct from old.provider
     or new.model is distinct from old.model
     or new.context_fingerprint is distinct from old.context_fingerprint
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'An AI assistance session cannot be rewritten.'
      using errcode = 'PV073';
  end if;

  if old.status <> 'pending' then
    raise exception 'This AI assistance session has already been recorded.'
      using errcode = 'PV073';
  end if;

  return new;
end;
$fn$;

create trigger ai_assistance_sessions_guard_update
  before update on public.ai_assistance_sessions
  for each row execute function public.ai_assistance_sessions_guard_update();


-- ---------------------------------------------------------------------------
-- The quota
-- ---------------------------------------------------------------------------
-- Section 53's dimensions — user, patient, time window — as one immutable
-- function so the application and the database cannot disagree about the
-- limit, and `src/config/clinical-ai.ts` mirrors it under test.
--
-- The numbers are a cost guard rail, not a clinical rule. Nobody has told this
-- project how often a practitioner should reasonably ask; these are set high
-- enough not to interrupt a consultation and low enough that a stuck retry
-- loop or a leaning keyboard costs a handful of requests rather than a bill.
create function public.ai_assistance_limits()
returns table (
  window_minutes integer,
  max_per_practitioner integer,
  max_per_patient integer
)
language sql
immutable
set search_path = ''
as $fn$
  select 60, 40, 12;
$fn$;

comment on function public.ai_assistance_limits() is
  'The AI quota. Mirrored by src/config/clinical-ai.ts and asserted against it by test.';


-- ---------------------------------------------------------------------------
-- Claim: consume quota, write the audit entry, and hand back derived scope
-- ---------------------------------------------------------------------------
-- Runs **before** the provider is called. Four refusals, in order:
--
--   1. assert_care_practitioner() — no session, not a doctor, or a doctor
--      with no practitioner record. It returns the practitioner id, so the
--      practitioner is derived and there is no parameter to spoof
--      (sections 6, 7, 99).
--   2. the appointment must be this practitioner's — resolved by id **and**
--      by that practitioner in one statement, so somebody else's appointment
--      is indistinguishable from one that never existed (sections 8, 141).
--   3. the practitioner's hourly quota.
--   4. the per-patient quota, which bounds a loop pointed at one record.
--
-- The patient, the appointment and the clinical record come **out of the
-- appointment row**. Example 4's patientId has nowhere to arrive.
create function public.start_ai_assistance_session(
  p_appointment_id uuid,
  p_task public.ai_assistance_task,
  p_prompt_version text,
  p_provider text,
  p_model text,
  p_context_fingerprint text
)
returns table (
  session_id uuid,
  resolved_patient_id uuid,
  resolved_clinical_record_id uuid
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_practitioner uuid;
  v_patient uuid;
  v_record uuid;
  v_session uuid;
  v_window integer;
  v_max_practitioner integer;
  v_max_patient integer;
  v_used integer;
begin
  v_practitioner := public.assert_care_practitioner();

  select a.patient_id into v_patient
  from public.appointments a
  where a.id = p_appointment_id
    and a.practitioner_id = v_practitioner;

  if v_patient is null then
    -- Deliberately the same answer as "no such appointment". An appointment
    -- id must not be an oracle for another practitioner's diary.
    raise exception 'We could not find that appointment.'
      using errcode = 'PV070';
  end if;

  select c.id into v_record
  from public.clinical_records c
  where c.appointment_id = p_appointment_id
    and c.practitioner_id = v_practitioner;

  select l.window_minutes, l.max_per_practitioner, l.max_per_patient
    into v_window, v_max_practitioner, v_max_patient
  from public.ai_assistance_limits() l;

  select count(*) into v_used
  from public.ai_assistance_sessions s
  where s.practitioner_id = v_practitioner
    and s.created_at > now() - make_interval(mins => v_window);

  if v_used >= v_max_practitioner then
    raise exception 'AI assistance has been used too many times recently.'
      using errcode = 'PV071';
  end if;

  select count(*) into v_used
  from public.ai_assistance_sessions s
  where s.patient_id = v_patient
    and s.practitioner_id = v_practitioner
    and s.created_at > now() - make_interval(mins => v_window);

  if v_used >= v_max_patient then
    raise exception 'AI assistance has been used too many times for this patient recently.'
      using errcode = 'PV072';
  end if;

  insert into public.ai_assistance_sessions (
    practitioner_id, patient_id, appointment_id, clinical_record_id,
    task, prompt_version, provider, model, status,
    context_fingerprint, created_by
  )
  values (
    v_practitioner, v_patient, p_appointment_id, v_record,
    p_task, p_prompt_version, p_provider, p_model, 'pending',
    p_context_fingerprint, (select auth.uid())
  )
  returning id into v_session;

  return query select v_session, v_patient, v_record;
end;
$fn$;

comment on function public.start_ai_assistance_session(uuid, public.ai_assistance_task, text, text, text, text) is
  'Consumes AI quota and writes the audit entry BEFORE the provider is called. No patient or practitioner parameter.';


-- ---------------------------------------------------------------------------
-- Record the outcome
-- ---------------------------------------------------------------------------
-- Resolved by session id **and** by the caller's own practitioner record, so a
-- session id from somebody else's consultation reaches no row. Metrics only:
-- there is no parameter for a summary, a consideration, a warning or any other
-- clinical text, because there is no column for one.
create function public.complete_ai_assistance_session(
  p_session_id uuid,
  p_status public.ai_assistance_status,
  p_failure_code text default null,
  p_latency_ms integer default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_practitioner uuid;
begin
  v_practitioner := public.assert_care_practitioner();

  if p_status = 'pending' then
    raise exception 'An AI assistance session cannot be completed as pending.'
      using errcode = 'PV073';
  end if;

  -- Deliberately silent when nothing matches. The provider call has already
  -- happened and the doctor is waiting for a result; failing the request
  -- because the metrics row could not be closed would turn an audit
  -- inconvenience into a clinical-workflow interruption, which section 50
  -- forbids. The row stays pending, which is itself the operational signal.
  update public.ai_assistance_sessions s
  set status = p_status,
      failure_code = p_failure_code,
      latency_ms = p_latency_ms,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      completed_at = now()
  where s.id = p_session_id
    and s.practitioner_id = v_practitioner
    and s.status = 'pending';
end;
$fn$;

comment on function public.complete_ai_assistance_session(uuid, public.ai_assistance_status, text, integer, integer, integer) is
  'Records how an AI invocation ended. Metrics only — there is no parameter for clinical text.';


-- ---------------------------------------------------------------------------
-- The caller's own usage, for the panel
-- ---------------------------------------------------------------------------
-- About the caller and nobody else: no practitioner parameter, no patient
-- dimension in the return type, and therefore nothing here that could become
-- section 108's per-doctor acceptance ranking.
create function public.ai_assistance_usage()
returns table (
  used integer,
  allowed integer,
  window_minutes integer
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
declare
  v_practitioner uuid;
  v_window integer;
  v_max_practitioner integer;
  v_max_patient integer;
  v_used integer;
begin
  v_practitioner := public.assert_care_practitioner();

  select l.window_minutes, l.max_per_practitioner, l.max_per_patient
    into v_window, v_max_practitioner, v_max_patient
  from public.ai_assistance_limits() l;

  select count(*) into v_used
  from public.ai_assistance_sessions s
  where s.practitioner_id = v_practitioner
    and s.created_at > now() - make_interval(mins => v_window);

  return query select v_used, v_max_practitioner, v_window;
end;
$fn$;

comment on function public.ai_assistance_usage() is
  'The calling practitioner own quota usage. No practitioner parameter, no patient dimension.';


-- ---------------------------------------------------------------------------
-- Phase 16 integration: aggregate operational metrics only
-- ---------------------------------------------------------------------------
-- Sections 105-108. Counts, latency and token totals by task and status.
--
-- What is **not** in the return type, and could not be added without changing
-- it: a prompt, a response, a patient, a practitioner, a diagnosis, an
-- acceptance rate. Section 108 in particular — there is no practitioner
-- dimension, so "Doctor A accepts 90%, Doctor B 40%" cannot be computed from
-- this at all.
--
-- Gated by assert_clinic_analytics_reader(), so it is administrator-only,
-- exactly like every other clinic-wide aggregate.
create function public.analytics_ai_assistance_summary(
  p_from date,
  p_to date
)
returns table (
  task public.ai_assistance_task,
  status public.ai_assistance_status,
  sessions bigint,
  total_input_tokens bigint,
  total_output_tokens bigint,
  avg_latency_ms integer
)
language plpgsql
security definer
stable
set search_path = ''
as $fn$
begin
  perform public.assert_clinic_analytics_reader();
  -- The same bounds every other aggregate uses: reversed, over-long and
  -- pre-floor periods are refused identically, and the clinic-day boundaries
  -- are Phase 16's rather than a second interpretation of them.
  perform public.analytics_assert_range(p_from, p_to);

  return query
    select
      s.task,
      s.status,
      count(*)::bigint,
      coalesce(sum(s.input_tokens), 0)::bigint,
      coalesce(sum(s.output_tokens), 0)::bigint,
      coalesce(avg(s.latency_ms), 0)::integer
    from public.ai_assistance_sessions s
    where s.created_at >= public.analytics_range_start(p_from)
      and s.created_at < public.analytics_range_end(p_to)
    group by s.task, s.status
    order by s.task, s.status;
end;
$fn$;

comment on function public.analytics_ai_assistance_summary(date, date) is
  'Aggregate AI operational metrics. No prompt, no response, no patient, no practitioner dimension.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- `from public, anon` by name, because `revoke ... from public` alone does not
-- remove Supabase default named grants — the defect Phase 15 shipped.
--
-- ai_assistance_limits() is granted to authenticated on purpose: it returns
-- three constants and no data, and the panel reads it to show a practitioner
-- what the limit is before they hit it.
revoke all on function public.ai_assistance_limits()
  from public, anon;
grant execute on function public.ai_assistance_limits()
  to authenticated;

revoke all on function public.start_ai_assistance_session(uuid, public.ai_assistance_task, text, text, text, text)
  from public, anon;
grant execute on function public.start_ai_assistance_session(uuid, public.ai_assistance_task, text, text, text, text)
  to authenticated;

revoke all on function public.complete_ai_assistance_session(uuid, public.ai_assistance_status, text, integer, integer, integer)
  from public, anon;
grant execute on function public.complete_ai_assistance_session(uuid, public.ai_assistance_status, text, integer, integer, integer)
  to authenticated;

revoke all on function public.ai_assistance_usage()
  from public, anon;
grant execute on function public.ai_assistance_usage()
  to authenticated;

revoke all on function public.analytics_ai_assistance_summary(date, date)
  from public, anon;
grant execute on function public.analytics_ai_assistance_summary(date, date)
  to authenticated;

-- The trigger function is called by the trigger, never by a caller.
revoke all on function public.ai_assistance_sessions_guard_update()
  from public, anon, authenticated;
