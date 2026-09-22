-- ---------------------------------------------------------------------------
-- Phase 15 — Notifications & Communication
--
-- The first thing Punarvasu *sends*. Everything before this phase waited for
-- somebody to open the application; a notification arrives on a lock screen,
-- in an inbox, on a shared phone, which is why almost every decision below is
-- about what is NOT in it.
--
-- ## Notifications never own domain state
--
-- `phase_15.md` section 2. Nothing in this migration writes to
-- `public.appointments`, `public.prescriptions`, `public.treatment_plans`,
-- `public.clinical_records`, `public.patients` or `public.user_roles`. The
-- only direction of travel is inward: a domain row changes, and a row appears
-- here. A test asserts that no function in this file contains an `update` or
-- `insert` against a domain table.
--
-- ## The outbox is the transaction, not a hope
--
-- Sections 7, 8, 65 and 103, and example 6. An `after` trigger on the domain
-- table writes `public.notification_outbox` **inside the domain
-- transaction**. So:
--
--   * a confirmed appointment that produced no event is not a state the
--     database can be in, and
--   * an event for an appointment that was never confirmed is not either.
--
-- Nothing in the application layer has to remember to emit anything, and no
-- provider outage can roll back a booking, because no provider is reachable
-- from inside that transaction. The processor runs afterwards, separately,
-- and may fail as often as it likes.
--
-- Triggers rather than edits to the Phase 09/10/11/13 write functions,
-- deliberately: those functions stay byte-identical (their mirror tests still
-- describe what is installed), and **every** write path is covered, including
-- ones added later.
--
-- ## No recipient parameter exists anywhere
--
-- Sections 54, 72, 73, 110, and examples 2 and 9. `create_notification` does
-- not take a recipient: it resolves one from the resource it is about, by way
-- of `patients.profile_id`. There is no `recipientUserId`, no
-- `recipientEmail`, no `recipientPhone` and no `to` in any signature in this
-- file, so none of them can be substituted. The same reasoning Phase 12 and
-- Phase 13 applied to `patientId` and `practitionerId`.
--
-- Nor is there a link parameter. Sections 19 and 84: `create_notification`
-- derives the deep link from the resource type and id through
-- `public.notification_link_path()`, so an arbitrary URL has nowhere to
-- arrive, and a check constraint refuses one a second time.
--
-- ## What a notification may contain
--
-- Sections 36-39, 80-83 and 128, and examples 3 and 4. A title and a short
-- body, both rendered by the application from a fixed template, and a link.
-- There is **no column** for a diagnosis, a symptom, an assessment, a
-- medicine, a dose, a prescription item, a treatment-plan item, a document
-- title, a doctor's note, a cancellation reason or a patient note — so none
-- of those can be stored, let alone sent. The context functions that feed the
-- templates return the same minimum and nothing else, which is what makes
-- "clinical content never leaves the database" structural rather than a
-- convention the next template has to remember.
--
-- ## Reminders read the authoritative appointment, twice
--
-- Sections 29, 30, 67-70, 102, 121, and example 5.
--
--   1. `plan_appointment_reminders` is called when an appointment is
--      confirmed or moved. It reads the appointment, cancels every scheduled
--      reminder that is not in the currently correct set, and returns the set
--      that is. A cancelled or unconfirmed appointment returns an empty set,
--      so "the old reminder must not fire" is not something that has to be
--      remembered — the row is gone.
--   2. `release_due_reminders` runs when a reminder falls due and reads the
--      appointment *again*, requiring it still to be confirmed, still in the
--      future, and still starting at exactly the instant this reminder was
--      computed from. A reminder that fails any of those is cancelled rather
--      than sent.
--
-- The second check is what makes a missed processor run harmless.
--
-- ## Channels
--
-- Section 12 asks for an architecture that supports several and warns against
-- fake integrations. Two values exist: `in_app` and `email`. There is no
-- `sms` and no `whatsapp`, because no SMS or WhatsApp provider is configured
-- for this project and an enum value nothing can produce is exactly the
-- pretence section 14 forbids. Adding one is two migrations (PostgreSQL will
-- not let a value added by `alter type ... add value` be used in the same
-- transaction, and Supabase applies each migration in one) — which is a small
-- price for not shipping a channel that silently delivers nothing.
--
-- In-app delivery *is* the notification row. `notification_deliveries`
-- records attempts against **external** providers only, and a check
-- constraint says so, so "the notification exists but the email failed" is
-- representable and "the email succeeded but there is no notification" is
-- not (section 11).
--
-- ## Who can write what
--
-- Nobody, from a client. `notifications` and `notification_preferences` have
-- a `select` policy scoped to `auth.uid()` and **no insert, update or delete
-- policy and no write grant**; reading and preference changes go through
-- definer functions that take no user id. `notification_outbox` and
-- `notification_deliveries` have **no policy at all and no grant at all** for
-- `anon`, `authenticated` or `service_role` — they are reachable only through
-- the processor functions, which are granted to `service_role` alone.
--
-- ## Error codes
--
-- PV050-PV059, disjoint from every range in use: PV001-PV019 (appointments,
-- clinical records), PV020-PV034 (prescriptions and plans), PV040-PV046
-- (documents).
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

-- Section 5 and section 114: a typed event vocabulary, not arbitrary strings.
-- Every value corresponds to a domain action that actually exists and that a
-- trigger in this migration can produce. `appointment_created` is absent on
-- purpose: a patient's request is not yet an agreement, and telling them
-- "your appointment is confirmed" the moment they ask for one would be the
-- false reassurance `phase_09.md` sections 21 and 48 forbid.
create type public.notification_event_type as enum (
  'appointment_confirmed',
  'appointment_rescheduled',
  'appointment_cancelled',
  'appointment_reminder',
  'prescription_issued',
  'treatment_plan_activated'
);

comment on type public.notification_event_type is
  'Domain events this system communicates. Every value is produced by a '
  'trigger or by the reminder planner in this migration; none is decorative.';

-- What a notification is about. Used to resolve the recipient and to build
-- the deep link, which is why it is an enum rather than text: a new resource
-- type must arrive with the code that knows how to link to it.
create type public.notification_subject_type as enum (
  'appointment',
  'prescription',
  'treatment_plan'
);

-- Sections 20-22. The unit a preference applies to. Deliberately coarser than
-- the event type: a patient wants to decide about "reminders", not about
-- `appointment_rescheduled` separately from `appointment_cancelled`.
create type public.notification_category as enum (
  'appointment_updates',
  'appointment_reminders',
  'clinical_updates'
);

comment on type public.notification_category is
  'Preference units. appointment_updates and clinical_updates are mandatory '
  'transactional communication and cannot be switched off in the '
  'application; appointment_reminders is optional. See '
  'public.notification_category_is_mandatory().';

-- Section 12. Two, because two are real. See the header.
create type public.notification_channel as enum ('in_app', 'email');

-- Section 49: only states that mean something here.
--
--   scheduled  a reminder whose time has not come. Invisible to the patient,
--              by policy predicate rather than by query filter.
--   active     the patient can see it.
--   cancelled  superseded before it was ever shown — the appointment moved or
--              was cancelled. Kept rather than deleted, so "why did I not get
--              a reminder" is answerable.
create type public.notification_status as enum (
  'scheduled',
  'active',
  'cancelled'
);

create type public.notification_outbox_status as enum (
  'pending',
  'processing',
  'processed',
  'failed',
  'skipped'
);

-- Section 50. `sent` means the provider accepted the request, and that is the
-- strongest claim any configured provider supports. There is deliberately no
-- `delivered`: no provider configured for this project reports delivery
-- confirmation, and a status nothing can set is a status somebody will one
-- day read as true. It arrives in the same change as the webhook that would
-- set it.
create type public.notification_delivery_status as enum (
  'pending',
  'sent',
  'failed',
  'skipped'
);


-- ---------------------------------------------------------------------------
-- 2. Configuration the database owns
-- ---------------------------------------------------------------------------

-- Section 28: the reminder schedule is configurable and must not be hard-coded
-- per clinic. The database is the authority — it is what the planner reads —
-- and `src/config/notifications.ts` mirrors it so the application can describe
-- the schedule to a patient. `config/notifications.test.ts` reads this
-- function and asserts the two agree, exactly as Phase 09 does for the
-- booking rules.
--
-- Minutes before the appointment starts. Provisional, like every other
-- scheduling number in this product: the clinic has not confirmed a reminder
-- policy, and 24 hours plus 2 hours is `phase_15.md` section 28's own
-- example, so the value is traceable to a document rather than invented.
create function public.notification_reminder_offsets()
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select array[1440, 120]::integer[];  -- 24 hours, 2 hours
$$;

comment on function public.notification_reminder_offsets() is
  'Minutes before an appointment at which a reminder is due. Provisional; '
  'mirrored by APPOINTMENT_REMINDER_OFFSETS_MINUTES in '
  'src/config/notifications.ts and asserted against it by test.';

-- Section 22. Which categories a patient may not switch off.
--
-- A mandatory category may not have its **in-app** channel disabled: an
-- appointment being cancelled is operational information the clinic has a
-- duty to put somewhere the patient can find it. Email stays optional for
-- every category, because the in-app record is the one that always exists.
create function public.notification_category_is_mandatory(
  p_category public.notification_category
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_category in ('appointment_updates', 'clinical_updates');
$$;

comment on function public.notification_category_is_mandatory(public.notification_category) is
  'True for transactional categories whose in-app channel cannot be '
  'disabled. Mirrored by NOTIFICATION_CATEGORIES in '
  'src/config/notifications.ts and asserted against it by test.';

-- Sections 19 and 84. The deep link, derived from the resource, never
-- accepted from anything.
--
-- Every recipient today is a patient, so every path is under `/patient`.
-- These are real routes that existed before this phase and that authorize
-- independently — a notification link identifies a resource and grants
-- nothing (sections 18, 85). Mirrored by `notificationLinkPath()` in
-- `src/features/notifications/links.ts` and asserted against it by test.
create function public.notification_link_path(
  p_resource_type public.notification_subject_type,
  p_resource_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_resource_type
    when 'appointment' then '/patient/appointments/' || p_resource_id::text
    when 'prescription' then '/patient/prescriptions/' || p_resource_id::text
    when 'treatment_plan' then '/patient/treatment-plans/' || p_resource_id::text
  end;
$$;

comment on function public.notification_link_path(public.notification_subject_type, uuid) is
  'The application route a notification points at, built from the resource '
  'rather than accepted as a parameter. Mirrored in '
  'src/features/notifications/links.ts.';


-- ---------------------------------------------------------------------------
-- 3. The outbox
--
-- Sections 8 and 113. One row per domain event, written by a trigger inside
-- the domain transaction.
--
-- Section 115: identifiers and the minimum necessary, never an embedded
-- record. There is a resource type, a resource id and a timestamp. The
-- processor loads authoritative state when it runs (sections 116, 117, 122,
-- 123), which is the only way to be right about an event that has been
-- sitting in a queue while the world moved on.
-- ---------------------------------------------------------------------------
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),

  event_type public.notification_event_type not null,
  subject_type public.notification_subject_type not null,
  subject_id uuid not null,

  -- Sections 47, 119, 120. The idempotency key, and the reason a trigger
  -- firing twice, a domain function retrying, or a statement being replayed
  -- cannot produce two events. Stable by construction: it is built from the
  -- resource id and the thing that happened, never from a clock.
  dedupe_key text not null,

  status public.notification_outbox_status not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,

  -- A short machine code (`provider_timeout`, `stale_event`), never a message
  -- and never a provider's response body. Section 105: enough to operate on,
  -- nothing sensitive.
  last_error_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_outbox_dedupe_key_unique unique (dedupe_key),

  constraint notification_outbox_dedupe_key_shape check (
    dedupe_key ~ '^[a-z_]+:[0-9a-f-]{36}:[a-z_]+(:[0-9]+){0,2}$'
    and char_length(dedupe_key) between 8 and 200
  ),

  constraint notification_outbox_attempt_range check (
    attempt_count between 0 and 50
  ),

  constraint notification_outbox_error_code_shape check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9_]{1,64}$'
  )
);

comment on table public.notification_outbox is
  'Transactional outbox. One row per domain event, written by an after '
  'trigger inside the domain transaction, so a domain change and its event '
  'commit together or not at all. Carries identifiers only.';

comment on column public.notification_outbox.dedupe_key is
  'Stable idempotency key, e.g. appointment:<uuid>:confirmed:<epoch>. Unique, '
  'so a repeated trigger, retry or replay produces no second event.';

-- The processor's only query: the oldest work that is due.
create index notification_outbox_due_idx
  on public.notification_outbox (available_at, created_at)
  where status in ('pending', 'processing');


-- ---------------------------------------------------------------------------
-- 4. Notifications
--
-- Section 9, narrowed. The fields that are absent matter more than the ones
-- present: no recipient email, no phone, no clinical column, no free text a
-- client supplied, no arbitrary URL.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),

  -- Resolved by `create_notification` from the resource. Never a parameter.
  recipient_user_id uuid not null
    references auth.users (id) on delete cascade,

  event_type public.notification_event_type not null,
  category public.notification_category not null,

  -- Rendered by the application from a fixed template before it reaches the
  -- database, and bounded here. Section 42: a browser can submit neither, and
  -- there is no code path from a request to these columns.
  --
  -- Storing the rendered text rather than only a reference is section 99's
  -- requirement: a template corrected next year must not silently rewrite
  -- what a patient was told last year. `template_version` records which
  -- wording produced it.
  title text not null,
  body text not null,
  template_version integer not null,

  resource_type public.notification_subject_type not null,
  resource_id uuid not null,

  -- Derived by `public.notification_link_path()`. Constrained again below, so
  -- an uncontrolled path is refused even against a writer that skipped the
  -- function.
  link_path text not null,

  status public.notification_status not null default 'active',

  dedupe_key text not null,

  -- Set for a reminder; null for everything else. A reminder is `scheduled`
  -- until its time comes and the appointment still justifies it.
  scheduled_for timestamptz,
  reminder_offset_minutes integer,

  read_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_dedupe_key_unique unique (dedupe_key),

  constraint notifications_dedupe_key_shape check (
    dedupe_key ~ '^[a-z_]+:[0-9a-f-]{36}:[a-z_]+(:[0-9]+){0,2}$'
    and char_length(dedupe_key) between 8 and 200
  ),

  constraint notifications_title_length check (
    char_length(btrim(title)) between 1 and 120
  ),
  constraint notifications_body_length check (
    char_length(btrim(body)) between 1 and 400
  ),
  constraint notifications_template_version_positive check (
    template_version >= 1
  ),

  -- An application-relative path under a route that exists, with no scheme,
  -- no host, no protocol-relative form and no traversal segment. Sections 19
  -- and 84, and the same refusal Phase 06's `safeRedirectPath` makes.
  constraint notifications_link_path_shape check (
    link_path ~ '^/(patient|doctor|receptionist)/[a-z0-9]([a-z0-9/-]{0,180})$'
    and link_path not like '%..%'
    and link_path not like '//%'
  ),

  -- A scheduled notification must say when. Sections 67 and 102.
  constraint notifications_scheduled_has_time check (
    status <> 'scheduled' or scheduled_for is not null
  ),

  -- Only a reminder carries an offset, and every reminder carries one — it is
  -- what `release_due_reminders` re-derives the appointment's start from.
  constraint notifications_reminder_offset_consistency check (
    (event_type = 'appointment_reminder') = (reminder_offset_minutes is not null)
  ),
  constraint notifications_reminder_offset_range check (
    reminder_offset_minutes is null
    or reminder_offset_minutes between 1 and 20160
  ),

  -- Nothing a patient has never been shown can be marked read.
  constraint notifications_read_only_when_active check (
    read_at is null or status = 'active'
  ),

  constraint notifications_cancellation_consistency check (
    (status = 'cancelled') = (cancelled_at is not null)
  )
);

comment on table public.notifications is
  'One thing a patient should know. Title and body are rendered by the '
  'application from a fixed template and carry no clinical content; the link '
  'is derived from the resource and authorizes nothing.';

comment on column public.notifications.recipient_user_id is
  'Resolved inside create_notification from the resource. There is no '
  'recipient parameter anywhere in this migration.';

comment on column public.notifications.link_path is
  'Application-relative path built by notification_link_path(). The '
  'destination authorizes independently; this is an identifier, not a grant.';

-- The notification centre's list query, newest first.
create index notifications_recipient_idx
  on public.notifications (recipient_user_id, created_at desc)
  where status = 'active';

-- The unread count, which runs on every authenticated page load.
create index notifications_unread_idx
  on public.notifications (recipient_user_id)
  where status = 'active' and read_at is null;

-- The reminder release sweep.
create index notifications_due_reminder_idx
  on public.notifications (scheduled_for)
  where status = 'scheduled';

-- Reminder planning: "which scheduled reminders does this appointment have?"
create index notifications_resource_idx
  on public.notifications (resource_type, resource_id);


-- ---------------------------------------------------------------------------
-- 5. Deliveries
--
-- Sections 10 and 11. An external delivery attempt. Separate from the
-- notification so a failed email does not mean the patient was never told:
-- the in-app record exists either way.
--
-- Section 10: no provider payloads. An accepted message's provider id (so a
-- support request can be traced, and so a future delivery webhook has
-- something to resolve against) and a short error code. Nothing else.
-- ---------------------------------------------------------------------------
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),

  notification_id uuid not null
    references public.notifications (id) on delete cascade,

  channel public.notification_channel not null,

  -- Which adapter handled it, e.g. `emailjs`. Recorded so an operator can
  -- tell attempts apart after a provider change.
  provider text not null,

  status public.notification_delivery_status not null default 'pending',
  attempt_count integer not null default 0,

  provider_message_id text,
  error_code text,

  available_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Section 47 and example 7. One attempt row per notification per channel,
  -- so a retried worker resumes an attempt rather than starting a second one.
  constraint notification_deliveries_unique unique (notification_id, channel),

  -- In-app delivery *is* the notification row. A delivery row for it would be
  -- a second place the same fact is recorded, and two places disagree.
  constraint notification_deliveries_external_only check (channel <> 'in_app'),

  constraint notification_deliveries_provider_shape check (
    provider ~ '^[a-z0-9_]{1,32}$'
  ),
  constraint notification_deliveries_attempt_range check (
    attempt_count between 0 and 50
  ),
  constraint notification_deliveries_error_code_shape check (
    error_code is null or error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  constraint notification_deliveries_provider_message_id_shape check (
    provider_message_id is null
    or char_length(provider_message_id) between 1 and 200
  ),
  -- Section 50: `sent` means accepted, and only a sent delivery has a moment
  -- it was accepted at.
  constraint notification_deliveries_sent_consistency check (
    (status = 'sent') = (sent_at is not null)
  ),
  constraint notification_deliveries_failed_consistency check (
    (status = 'failed') = (failed_at is not null)
  )
);

comment on table public.notification_deliveries is
  'An external delivery attempt. In-app delivery is the notification row '
  'itself, which a check constraint enforces. No provider payloads are '
  'stored.';

create index notification_deliveries_due_idx
  on public.notification_deliveries (available_at, created_at)
  where status = 'pending';


-- ---------------------------------------------------------------------------
-- 6. Preferences
--
-- Section 21: a normalized row per (user, category, channel), not a JSON blob,
-- because the processor filters on it at claim time and that is a relational
-- question.
--
-- Absence means enabled. A patient who has never opened the preferences page
-- receives their appointment confirmations, which is the safe default for
-- transactional healthcare communication — and section 23 is satisfied
-- because nothing here is promotional: there is no marketing category, no
-- campaign, and no way to create one without a migration.
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  category public.notification_category not null,
  channel public.notification_channel not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),

  primary key (user_id, category, channel)
);

comment on table public.notification_preferences is
  'A row per (user, category, channel). Absent means enabled. Written only '
  'by set_notification_preference, which takes no user id.';


-- ---------------------------------------------------------------------------
-- 7. Timestamp maintenance
-- ---------------------------------------------------------------------------
create trigger notification_outbox_set_updated_at
  before update on public.notification_outbox
  for each row
  execute function public.set_updated_at();

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row
  execute function public.set_updated_at();

create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row
  execute function public.set_updated_at();

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row
  execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 8. Emitting events — the transactional outbox
--
-- Sections 6, 7, 8 and example 1. An `after` trigger, so the row is written
-- in the same transaction as the domain change and only if that change
-- commits. There is no branch in which the application decides whether to
-- emit; there is no application in the path at all.
--
-- These functions are `security definer` so that a future write path running
-- as some other role still writes the event. They write **only** to
-- `public.notification_outbox` — never back to the table that fired them,
-- which is what keeps section 2's arrow pointing one way.
--
-- They raise nothing. `on conflict do nothing` is the whole error handling,
-- because the only failure available is a duplicate key and a duplicate is
-- precisely what should be discarded (sections 47, 119).
-- ---------------------------------------------------------------------------

create function public.emit_notification_event(
  p_event_type public.notification_event_type,
  p_subject_type public.notification_subject_type,
  p_subject_id uuid,
  p_dedupe_key text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notification_outbox (
    event_type, subject_type, subject_id, dedupe_key
  )
  values (p_event_type, p_subject_type, p_subject_id, p_dedupe_key)
  on conflict (dedupe_key) do nothing;
$$;

comment on function public.emit_notification_event(
  public.notification_event_type, public.notification_subject_type, uuid, text
) is
  'Writes one outbox row, discarding a duplicate. Called only by the emit '
  'triggers below; revoked from every client role.';


-- Appointments.
--
--   confirmed    the clinic has agreed to a time. Keyed on the time as well
--                as the appointment, so a patient who reschedules (which
--                returns a confirmed appointment to `requested`) and is
--                confirmed again is told about the new agreement rather than
--                deduplicated against the old one.
--   rescheduled  the start moved. Fires whichever path moved it — the
--                patient's, the front desk's, or one added later.
--   cancelled    terminal, so the key needs no discriminator.
--
-- A booking that arrives as `requested` emits nothing: a request is not an
-- agreement, and section 25 is about the confirmation.
create function public.appointments_emit_notification_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then
      perform public.emit_notification_event(
        'appointment_confirmed',
        'appointment',
        new.id,
        'appointment:' || new.id::text || ':confirmed:'
          || extract(epoch from new.starts_at)::bigint::text
      );
    end if;

    return null;
  end if;

  -- The start moved. Checked before the status, because a front-desk
  -- reschedule preserves `confirmed` and a patient reschedule returns it to
  -- `requested`; in both cases what the patient needs to know is that the
  -- time changed (sections 26, 30).
  if new.starts_at is distinct from old.starts_at then
    perform public.emit_notification_event(
      'appointment_rescheduled',
      'appointment',
      new.id,
      'appointment:' || new.id::text || ':rescheduled:'
        || extract(epoch from new.starts_at)::bigint::text
    );
  end if;

  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    perform public.emit_notification_event(
      'appointment_confirmed',
      'appointment',
      new.id,
      'appointment:' || new.id::text || ':confirmed:'
        || extract(epoch from new.starts_at)::bigint::text
    );
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.emit_notification_event(
      'appointment_cancelled',
      'appointment',
      new.id,
      'appointment:' || new.id::text || ':cancelled'
    );
  end if;

  return null;
end;
$$;

create trigger appointments_emit_notification_events
  after insert or update on public.appointments
  for each row
  execute function public.appointments_emit_notification_events();

comment on function public.appointments_emit_notification_events() is
  'Writes the appointment confirmation, reschedule and cancellation events '
  'into the outbox, inside the same transaction as the appointment change.';


-- Prescriptions. Section 33 and section 123, and the acceptance criterion
-- that a **draft** must never produce a final-prescription notification: the
-- only transition this trigger reacts to is into `issued`, and
-- `issue_prescription` is the only path to that value.
create function public.prescriptions_emit_notification_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'issued' and old.status is distinct from 'issued' then
    perform public.emit_notification_event(
      'prescription_issued',
      'prescription',
      new.id,
      'prescription:' || new.id::text || ':issued'
    );
  end if;

  return null;
end;
$$;

create trigger prescriptions_emit_notification_events
  after update on public.prescriptions
  for each row
  execute function public.prescriptions_emit_notification_events();

comment on function public.prescriptions_emit_notification_events() is
  'Emits prescription_issued, and only on the transition into issued. A '
  'draft prescription produces no event and therefore no notification.';


-- Treatment plans. Section 34. Activation, not every save: a draft is the
-- practitioner still thinking, and an active plan is what the patient was
-- actually told to do.
create function public.treatment_plans_emit_notification_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    perform public.emit_notification_event(
      'treatment_plan_activated',
      'treatment_plan',
      new.id,
      'treatment_plan:' || new.id::text || ':activated'
    );
  end if;

  return null;
end;
$$;

create trigger treatment_plans_emit_notification_events
  after update on public.treatment_plans
  for each row
  execute function public.treatment_plans_emit_notification_events();

comment on function public.treatment_plans_emit_notification_events() is
  'Emits treatment_plan_activated on the transition into active.';


-- ---------------------------------------------------------------------------
-- 9. Resolving a recipient
--
-- Sections 54, 72 and 110, and example 9. One function, used by everything
-- that needs to know who a notification is for, and it takes a **resource**
-- rather than a person.
--
-- Returns null when the patient has no account — a walk-in registered at the
-- front desk has a clinic record and no login, and there is nobody to notify.
-- The processor records that as `skipped`, which is the truth, rather than
-- failing forever.
-- ---------------------------------------------------------------------------
create function public.notification_recipient_for_resource(
  p_resource_type public.notification_subject_type,
  p_resource_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.profile_id
  from public.patients p
  where p.id = (
    case p_resource_type
      when 'appointment' then (
        select a.patient_id from public.appointments a where a.id = p_resource_id
      )
      when 'prescription' then (
        select pr.patient_id from public.prescriptions pr where pr.id = p_resource_id
      )
      when 'treatment_plan' then (
        select tp.patient_id from public.treatment_plans tp where tp.id = p_resource_id
      )
    end
  );
$$;

comment on function public.notification_recipient_for_resource(
  public.notification_subject_type, uuid
) is
  'The account a notification about this resource belongs to, resolved from '
  'the resource. Null when the patient has no login. There is no recipient '
  'parameter anywhere in this migration.';


-- ---------------------------------------------------------------------------
-- 10. Authoritative context for a template
--
-- Sections 25, 116, 117, 122 and 123. The processor must read the resource's
-- **current** state rather than trust an event that may have been queued
-- while the world moved on, and section 25 forbids inventing a practitioner,
-- a time or a type.
--
-- What each function returns is the whole of what a template may know. There
-- is no patient note, no internal note, no cancellation reason, no clinical
-- record, no prescription item, no medicine, no plan title and no plan item
-- in any of them — so a template cannot leak one by accident, and a template
-- added later cannot either.
-- ---------------------------------------------------------------------------
create function public.notification_appointment_context(p_appointment_id uuid)
returns table (
  status public.appointment_status,
  starts_at timestamptz,
  ends_at timestamptz,
  practitioner_name text,
  appointment_type_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.status,
    a.starts_at,
    a.ends_at,
    pr.display_name,
    at.name
  from public.appointments a
  join public.practitioners pr on pr.id = a.practitioner_id
  join public.appointment_types at on at.id = a.appointment_type_id
  where a.id = p_appointment_id;
$$;

comment on function public.notification_appointment_context(uuid) is
  'The minimum an appointment template needs: status, time, practitioner and '
  'consultation type. No patient note, no internal note, no cancellation '
  'reason.';

create function public.notification_prescription_context(p_prescription_id uuid)
returns table (
  status public.prescription_status,
  issued_at timestamptz,
  practitioner_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.status, p.issued_at, pr.display_name
  from public.prescriptions p
  join public.practitioners pr on pr.id = p.practitioner_id
  where p.id = p_prescription_id;
$$;

comment on function public.notification_prescription_context(uuid) is
  'Whether the prescription is issued, when, and by whom. Deliberately no '
  'items, no medicine name, no dose and no instruction: sections 33, 82 and '
  'example 3.';

create function public.notification_treatment_plan_context(p_plan_id uuid)
returns table (
  status public.treatment_plan_status,
  activated_at timestamptz,
  practitioner_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select tp.status, tp.activated_at, pr.display_name
  from public.treatment_plans tp
  join public.practitioners pr on pr.id = tp.practitioner_id
  where tp.id = p_plan_id;
$$;

comment on function public.notification_treatment_plan_context(uuid) is
  'Whether the plan is active, when and by whom. Deliberately no title, no '
  'summary and no items — a plan title is written by a clinician about one '
  'patient (section 34).';


-- ---------------------------------------------------------------------------
-- 11. Creating a notification
--
-- The one way a row appears in `public.notifications`. It takes no recipient
-- and no link: both are derived, so sections 54, 72, 84 and 110 hold
-- structurally rather than by review.
--
-- Idempotent on `dedupe_key` (sections 47, 120, and example 7). Calling it
-- twice with the same key returns the same id and creates nothing, which is
-- what makes a worker retry, a process restart and a duplicate event safe.
-- ---------------------------------------------------------------------------
create function public.create_notification(
  p_dedupe_key text,
  p_event_type public.notification_event_type,
  p_category public.notification_category,
  p_resource_type public.notification_subject_type,
  p_resource_id uuid,
  p_title text,
  p_body text,
  p_template_version integer,
  p_status public.notification_status default 'active',
  p_scheduled_for timestamptz default null,
  p_reminder_offset_minutes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  created uuid;
begin
  recipient := public.notification_recipient_for_resource(
    p_resource_type, p_resource_id
  );

  if recipient is null then
    -- A walk-in with no login, or a resource that has gone. Distinguished
    -- from a failure so the processor can mark the event `skipped` and stop,
    -- rather than retrying something that will never succeed.
    raise exception 'No account to notify for this resource.'
      using errcode = 'PV050';
  end if;

  insert into public.notifications (
    recipient_user_id,
    event_type,
    category,
    title,
    body,
    template_version,
    resource_type,
    resource_id,
    link_path,
    status,
    dedupe_key,
    scheduled_for,
    reminder_offset_minutes
  )
  values (
    recipient,
    p_event_type,
    p_category,
    btrim(p_title),
    btrim(p_body),
    p_template_version,
    p_resource_type,
    p_resource_id,
    public.notification_link_path(p_resource_type, p_resource_id),
    p_status,
    p_dedupe_key,
    p_scheduled_for,
    p_reminder_offset_minutes
  )
  on conflict (dedupe_key) do nothing
  returning id into created;

  if created is null then
    -- Already created by an earlier run. Return what exists so the caller
    -- can enqueue deliveries against it without a second logical
    -- notification ever coming into being.
    select n.id into created
    from public.notifications n
    where n.dedupe_key = p_dedupe_key;
  end if;

  return created;
end;
$$;

comment on function public.create_notification(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer,
  public.notification_status, timestamptz, integer
) is
  'The only way a notification is created. Resolves the recipient and the '
  'deep link from the resource — neither is a parameter — and is idempotent '
  'on dedupe_key.';


-- ---------------------------------------------------------------------------
-- 12. Reminders
--
-- Sections 29, 30, 48, 67-70, 102 and 121, and example 5.
--
-- The schedule is not a parameter: `plan_appointment_reminders` reads
-- `notification_reminder_offsets()` itself, so no caller can ask for a
-- reminder the clinic has not configured.
--
-- The key encodes the appointment, the offset and **the start instant the
-- reminder was computed from**. That is what makes a reschedule
-- self-invalidating: the desired set changes wholesale, every scheduled
-- reminder outside it is cancelled here, and the release sweep re-derives the
-- start from the key's offset and refuses anything that no longer matches.
-- ---------------------------------------------------------------------------
create function public.plan_appointment_reminders(p_appointment_id uuid)
returns table (
  offset_minutes integer,
  scheduled_for timestamptz,
  dedupe_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  appointment_status public.appointment_status;
  appointment_starts_at timestamptz;
  desired text[] := array[]::text[];
begin
  select a.status, a.starts_at
  into appointment_status, appointment_starts_at
  from public.appointments a
  where a.id = p_appointment_id;

  -- Section 68 and 69. Only a confirmed appointment that has not started is
  -- reminder-eligible. Requested, checked in, in consultation, completed,
  -- no-show and cancelled all produce an empty desired set, which cancels
  -- every scheduled reminder below.
  if appointment_status = 'confirmed' and appointment_starts_at > now() then
    select coalesce(array_agg(
      'appointment:' || p_appointment_id::text || ':reminder:'
        || o::text || ':'
        || extract(epoch from appointment_starts_at)::bigint::text
    ), array[]::text[])
    into desired
    from unnest(public.notification_reminder_offsets()) as o
    where appointment_starts_at - make_interval(mins => o) > now();
  end if;

  update public.notifications n
  set status = 'cancelled',
      cancelled_at = now()
  where n.resource_type = 'appointment'
    and n.resource_id = p_appointment_id
    and n.event_type = 'appointment_reminder'
    and n.status = 'scheduled'
    and not (n.dedupe_key = any (desired));

  return query
  select
    o,
    appointment_starts_at - make_interval(mins => o),
    'appointment:' || p_appointment_id::text || ':reminder:'
      || o::text || ':'
      || extract(epoch from appointment_starts_at)::bigint::text
  from unnest(public.notification_reminder_offsets()) as o
  where appointment_status = 'confirmed'
    and appointment_starts_at > now()
    and appointment_starts_at - make_interval(mins => o) > now();
end;
$$;

comment on function public.plan_appointment_reminders(uuid) is
  'Cancels every scheduled reminder that the appointment no longer justifies '
  'and returns the set it does. Reads the authoritative appointment; the '
  'offsets are configuration, not a parameter.';


-- Section 68. Used when an appointment is cancelled, so a pending reminder
-- disappears immediately rather than waiting for the release sweep to refuse
-- it. Belt and braces: the sweep would refuse it anyway.
create function public.cancel_appointment_reminders(p_appointment_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.notifications n
  set status = 'cancelled',
      cancelled_at = now()
  where n.resource_type = 'appointment'
    and n.resource_id = p_appointment_id
    and n.event_type = 'appointment_reminder'
    and n.status = 'scheduled';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function public.cancel_appointment_reminders(uuid) is
  'Cancels every scheduled reminder for an appointment. A cancelled reminder '
  'is kept rather than deleted, so "why did I not get a reminder" is '
  'answerable.';


-- Section 67 and 102. The second read of authoritative state, at the moment
-- the reminder is due.
--
-- A reminder is released only if its appointment is still confirmed, still in
-- the future, and still starts at exactly the instant this reminder was
-- computed from — so a reschedule that the processor never saw, a completed
-- consultation and a no-show all resolve to `cancelled` rather than to a
-- message telling somebody to attend an appointment that is not happening.
create function public.release_due_reminders(p_limit integer default 100)
returns table (notification_id uuid, released boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch uuid[];
  valid_ids uuid[];
begin
  select coalesce(array_agg(due.id), array[]::uuid[])
  into batch
  from (
    select n.id
    from public.notifications n
    where n.status = 'scheduled'
      and n.scheduled_for <= now()
    order by n.scheduled_for
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update skip locked
  ) due;

  if array_length(batch, 1) is null then
    return;
  end if;

  select coalesce(array_agg(n.id), array[]::uuid[])
  into valid_ids
  from public.notifications n
  join public.appointments a on a.id = n.resource_id
  where n.id = any (batch)
    and n.resource_type = 'appointment'
    and a.status = 'confirmed'
    and a.starts_at > now()
    and a.starts_at
        = n.scheduled_for + make_interval(mins => n.reminder_offset_minutes);

  update public.notifications n
  set status = 'cancelled',
      cancelled_at = now()
  where n.id = any (batch)
    and not (n.id = any (valid_ids));

  update public.notifications n
  set status = 'active'
  where n.id = any (valid_ids);

  return query
  select b.id, b.id = any (valid_ids)
  from unnest(batch) as b(id);
end;
$$;

comment on function public.release_due_reminders(integer) is
  'Releases reminders whose time has come and whose appointment still '
  'justifies them; cancels the rest. Re-reads the authoritative appointment '
  'rather than trusting the scheduled row.';


-- ---------------------------------------------------------------------------
-- 13. Preferences, evaluated where delivery happens
--
-- Section 71: preferences change after an event is created, so they are read
-- close to delivery rather than captured at creation.
--
-- Absence means enabled. Takes a user id and is therefore revoked from every
-- client role — it is called only from inside other definer functions, where
-- the current user is the function owner.
-- ---------------------------------------------------------------------------
create function public.notification_preference_enabled(
  p_user_id uuid,
  p_category public.notification_category,
  p_channel public.notification_channel
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select np.enabled
      from public.notification_preferences np
      where np.user_id = p_user_id
        and np.category = p_category
        and np.channel = p_channel
    ),
    true
  );
$$;


-- Section 97 and 98. A user changes only their own preferences: there is no
-- user id parameter, so `{"userId": "another-user"}` has nowhere to arrive.
-- Staff accounts use the same function and are scoped the same way.
create function public.set_notification_preference(
  p_category public.notification_category,
  p_channel public.notification_channel,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Sign in to change your notification preferences.'
      using errcode = 'PV052';
  end if;

  -- Section 22. Operational information about an appointment or a
  -- prescription has to reach the patient somewhere; the in-app record is
  -- that somewhere, and it cannot be switched off. Email stays optional for
  -- every category.
  if p_enabled = false
     and p_channel = 'in_app'
     and public.notification_category_is_mandatory(p_category) then
    raise exception 'These updates are part of your care and cannot be turned off in the app.'
      using errcode = 'PV051';
  end if;

  insert into public.notification_preferences (
    user_id, category, channel, enabled
  )
  values (actor, p_category, p_channel, p_enabled)
  on conflict (user_id, category, channel) do update
  set enabled = excluded.enabled,
      updated_at = now();

  return p_enabled;
end;
$$;

comment on function public.set_notification_preference(
  public.notification_category, public.notification_channel, boolean
) is
  'Changes the calling user''s own preference. No user id parameter. Refuses '
  'to disable the in-app channel of a mandatory transactional category.';


-- ---------------------------------------------------------------------------
-- 14. Read state
--
-- Sections 16 and 17. The server decides ownership: neither function takes a
-- notification's owner, and both scope by `auth.uid()` in the statement
-- itself, so marking somebody else's notification read affects no rows rather
-- than being refused after a lookup.
-- ---------------------------------------------------------------------------
create function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  affected integer;
begin
  if actor is null then
    raise exception 'Sign in to continue.' using errcode = 'PV052';
  end if;

  update public.notifications n
  set read_at = now()
  where n.id = p_notification_id
    and n.recipient_user_id = actor
    and n.status = 'active'
    and n.read_at is null;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

comment on function public.mark_notification_read(uuid) is
  'Marks one of the calling user''s own notifications read. Somebody else''s '
  'notification matches nothing, which is the same answer as one that does '
  'not exist.';

create function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  affected integer;
begin
  if actor is null then
    raise exception 'Sign in to continue.' using errcode = 'PV052';
  end if;

  update public.notifications n
  set read_at = now()
  where n.recipient_user_id = actor
    and n.status = 'active'
    and n.read_at is null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

comment on function public.mark_all_notifications_read() is
  'Marks every unread notification of the calling user read. Scoped by '
  'auth.uid() in the statement; no user id parameter.';


-- ---------------------------------------------------------------------------
-- 15. The processor's interface
--
-- Sections 66 and 8. Everything below is granted to `service_role` and to
-- nothing else. No authenticated user can claim an event, record a delivery
-- or change a delivery status — section 107's "do not allow the browser to
-- update delivery status", made structural.
--
-- Claiming uses `for update skip locked`, so two concurrent workers (a cron
-- run overlapping an opportunistic drain) take disjoint work rather than
-- racing over the same rows. Section 127's "worker restart" and "duplicate
-- worker execution".
-- ---------------------------------------------------------------------------
create function public.claim_notification_outbox(
  p_limit integer default 25,
  p_lease_seconds integer default 120
)
returns table (
  id uuid,
  event_type public.notification_event_type,
  subject_type public.notification_subject_type,
  subject_id uuid,
  dedupe_key text,
  attempt_count integer,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch uuid[];
begin
  select coalesce(array_agg(due.id), array[]::uuid[])
  into batch
  from (
    select o.id
    from public.notification_outbox o
    where o.status in ('pending', 'processing')
      and o.available_at <= now()
    order by o.available_at, o.created_at
    limit least(greatest(coalesce(p_limit, 25), 1), 200)
    for update skip locked
  ) due;

  if array_length(batch, 1) is null then
    return;
  end if;

  -- The lease is what makes a crashed worker recoverable: the row goes back
  -- on the queue when it expires rather than staying `processing` for ever.
  return query
  update public.notification_outbox o
  set status = 'processing',
      attempt_count = o.attempt_count + 1,
      available_at = now()
        + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 120), 10), 3600))
  where o.id = any (batch)
  returning
    o.id,
    o.event_type,
    o.subject_type,
    o.subject_id,
    o.dedupe_key,
    o.attempt_count,
    o.occurred_at;
end;
$$;

comment on function public.claim_notification_outbox(integer, integer) is
  'Leases a batch of due outbox events to one worker. Concurrent workers take '
  'disjoint batches; a crashed worker''s lease expires and the work returns.';


-- Section 46 and 105. `processed` and `skipped` are terminal; `failed` with a
-- retry time puts the event back on the queue, and `failed` without one is
-- the dead letter. The application decides which, because the application is
-- what knows whether the failure was transient.
create function public.complete_notification_outbox(
  p_id uuid,
  p_status public.notification_outbox_status,
  p_error_code text default null,
  p_retry_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('processed', 'failed', 'skipped', 'pending') then
    raise exception 'Unsupported outbox completion status.'
      using errcode = 'PV053';
  end if;

  update public.notification_outbox o
  set status = case
        when p_status = 'failed' and p_retry_at is not null then 'pending'
        else p_status
      end,
      processed_at = case
        when p_status in ('processed', 'skipped') then now()
        else o.processed_at
      end,
      available_at = coalesce(p_retry_at, o.available_at),
      last_error_code = p_error_code
  where o.id = p_id;
end;
$$;

comment on function public.complete_notification_outbox(
  uuid, public.notification_outbox_status, text, timestamptz
) is
  'Records the outcome of processing one event. A failure with a retry time '
  'returns to pending; a failure without one is the dead letter.';


-- Section 11. Creates the external delivery attempt for a notification that
-- already exists. Idempotent, so a retried worker resumes rather than
-- starting a second attempt (section 47, example 7).
create function public.enqueue_notification_delivery(
  p_notification_id uuid,
  p_channel public.notification_channel,
  p_provider text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created uuid;
begin
  if p_channel = 'in_app' then
    -- In-app delivery is the notification row. A check constraint refuses
    -- this too; raising here makes the reason legible.
    raise exception 'In-app notifications have no separate delivery.'
      using errcode = 'PV054';
  end if;

  if not exists (
    select 1 from public.notifications n
    where n.id = p_notification_id and n.status = 'active'
  ) then
    -- A scheduled reminder has no delivery until it is released, and a
    -- cancelled notification never gets one.
    return null;
  end if;

  insert into public.notification_deliveries (
    notification_id, channel, provider
  )
  values (p_notification_id, p_channel, p_provider)
  on conflict (notification_id, channel) do nothing
  returning id into created;

  if created is null then
    select d.id into created
    from public.notification_deliveries d
    where d.notification_id = p_notification_id
      and d.channel = p_channel;
  end if;

  return created;
end;
$$;

comment on function public.enqueue_notification_delivery(
  uuid, public.notification_channel, text
) is
  'Creates the external delivery attempt for an active notification, once per '
  'channel. Refuses in_app, whose delivery is the notification itself.';


-- Sections 71-75. The claim, and the point at which preferences and contact
-- verification are evaluated.
--
-- Two outcomes never reach a provider:
--
--   preference_disabled   the patient has switched this channel off for this
--                         category since the notification was created.
--   unverified_contact    there is no confirmed email address on the account.
--                         Section 75: a transactional message about a
--                         consultation does not go to an address nobody has
--                         proved they control.
--
-- Both are recorded as `skipped` rather than `failed`, because neither is an
-- error and neither should be retried.
--
-- The recipient address is read here, from `auth.users`, and returned to the
-- worker for one send. It is never stored in this schema and never logged.
create function public.claim_notification_deliveries(
  p_limit integer default 25,
  p_lease_seconds integer default 120
)
returns table (
  delivery_id uuid,
  channel public.notification_channel,
  provider text,
  attempt_count integer,
  notification_id uuid,
  event_type public.notification_event_type,
  category public.notification_category,
  title text,
  body text,
  link_path text,
  recipient_email text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch uuid[];
begin
  select coalesce(array_agg(due.id), array[]::uuid[])
  into batch
  from (
    select d.id
    from public.notification_deliveries d
    where d.status = 'pending'
      and d.available_at <= now()
    order by d.available_at, d.created_at
    limit least(greatest(coalesce(p_limit, 25), 1), 200)
    for update skip locked
  ) due;

  if array_length(batch, 1) is null then
    return;
  end if;

  update public.notification_deliveries d
  set status = 'skipped',
      error_code = 'preference_disabled'
  from public.notifications n
  where d.id = any (batch)
    and n.id = d.notification_id
    and not public.notification_preference_enabled(
      n.recipient_user_id, n.category, d.channel
    );

  update public.notification_deliveries d
  set status = 'skipped',
      error_code = 'unverified_contact'
  from public.notifications n
  left join auth.users u on u.id = n.recipient_user_id
  where d.id = any (batch)
    and d.status = 'pending'
    and n.id = d.notification_id
    and d.channel = 'email'
    and (u.email is null or u.email_confirmed_at is null);

  return query
  with leased as (
    update public.notification_deliveries d
    set attempt_count = d.attempt_count + 1,
        last_attempt_at = now(),
        available_at = now()
          + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 120), 10), 3600))
    where d.id = any (batch)
      and d.status = 'pending'
    returning d.id, d.channel, d.provider, d.attempt_count, d.notification_id
  )
  select
    l.id,
    l.channel,
    l.provider,
    l.attempt_count,
    l.notification_id,
    n.event_type,
    n.category,
    n.title,
    n.body,
    n.link_path,
    u.email::text
  from leased l
  join public.notifications n on n.id = l.notification_id
  join auth.users u on u.id = n.recipient_user_id;
end;
$$;

comment on function public.claim_notification_deliveries(integer, integer) is
  'Leases due external deliveries, skipping those the patient has switched '
  'off and those with no confirmed contact. Returns the recipient address for '
  'one send; it is never stored here and never logged.';


create function public.record_notification_delivery_result(
  p_delivery_id uuid,
  p_status public.notification_delivery_status,
  p_provider_message_id text default null,
  p_error_code text default null,
  p_retry_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed', 'skipped', 'pending') then
    raise exception 'Unsupported delivery status.' using errcode = 'PV055';
  end if;

  update public.notification_deliveries d
  set status = case
        when p_status = 'failed' and p_retry_at is not null then 'pending'
        else p_status
      end,
      provider_message_id = coalesce(p_provider_message_id, d.provider_message_id),
      error_code = p_error_code,
      available_at = coalesce(p_retry_at, d.available_at),
      sent_at = case when p_status = 'sent' then now() else d.sent_at end,
      failed_at = case
        when p_status = 'failed' and p_retry_at is null then now()
        else d.failed_at
      end
  where d.id = p_delivery_id;
end;
$$;

comment on function public.record_notification_delivery_result(
  uuid, public.notification_delivery_status, text, text, timestamptz
) is
  'Records the outcome of one external send. A transient failure with a retry '
  'time returns to pending; without one it is terminal. Stores a short code, '
  'never a provider response body.';


-- ---------------------------------------------------------------------------
-- 16. Row-level security
--
-- `notifications` and `notification_preferences`: one select policy each,
-- scoped to the calling account, and nothing else. No insert, update or
-- delete policy and no write grant, so every change goes through a definer
-- function that takes no user id.
--
-- The `status = 'active'` half of the notifications policy is what makes a
-- scheduled reminder invisible to the patient it is for — a predicate on the
-- row rather than a filter a query could forget, the same arrangement Phase
-- 13 used for `status <> 'draft'`.
--
-- `notification_outbox` and `notification_deliveries`: row-level security
-- enabled and **no policy at all**, which is a stronger statement than a
-- predicate that evaluates to false — a predicate can be weakened by an edit
-- and an absent policy cannot.
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_deliveries enable row level security;

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and status = 'active'
  );

comment on policy notifications_select_own on public.notifications is
  'A user reads their own notifications, and only those that have been '
  'released. A scheduled reminder is invisible until its time comes.';

create policy notification_preferences_select_own
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on policy notification_preferences_select_own
  on public.notification_preferences is
  'A user reads their own preferences. Section 97: another user''s row is '
  'not visible and not writable.';


-- ---------------------------------------------------------------------------
-- 17. Grants
--
-- `anon` receives nothing anywhere in this migration.
--
-- The outbox and the delivery table are revoked from every client role
-- **including `service_role`**: the processor reaches them only through the
-- definer functions above, which run as their owner, so there is no path by
-- which a stray query touches a queue directly.
-- ---------------------------------------------------------------------------
revoke all on public.notifications from anon, authenticated;
revoke all on public.notification_preferences from anon, authenticated;
revoke all on public.notification_outbox from anon, authenticated, service_role;
revoke all on public.notification_deliveries from anon, authenticated, service_role;

-- Column by column. `dedupe_key`, `reminder_offset_minutes`, `cancelled_at`
-- and `updated_at` are deliberately absent: they are the machinery, not the
-- message, and the notification centre needs none of them.
grant select (
  id,
  recipient_user_id,
  event_type,
  category,
  title,
  body,
  template_version,
  resource_type,
  resource_id,
  link_path,
  status,
  scheduled_for,
  read_at,
  created_at
) on public.notifications to authenticated;

grant select (user_id, category, channel, enabled, updated_at)
  on public.notification_preferences to authenticated;

-- Configuration. Pure, and useful to a page that describes the reminder
-- schedule or explains why a preference cannot be switched off.
revoke all on function public.notification_reminder_offsets() from public;
grant execute on function public.notification_reminder_offsets() to authenticated;

revoke all on function public.notification_category_is_mandatory(
  public.notification_category
) from public;
grant execute on function public.notification_category_is_mandatory(
  public.notification_category
) to authenticated;

revoke all on function public.notification_link_path(
  public.notification_subject_type, uuid
) from public;
grant execute on function public.notification_link_path(
  public.notification_subject_type, uuid
) to authenticated;

-- The three things a signed-in person may do.
revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke all on function public.set_notification_preference(
  public.notification_category, public.notification_channel, boolean
) from public;
grant execute on function public.set_notification_preference(
  public.notification_category, public.notification_channel, boolean
) to authenticated;

-- Everything the processor uses. `service_role` only: no authenticated user
-- can create a notification, claim an event, enqueue a delivery or record a
-- delivery result, which is what makes section 109's arbitrary
-- notification-sending endpoint impossible to build by accident.
revoke all on function public.emit_notification_event(
  public.notification_event_type, public.notification_subject_type, uuid, text
) from public;

revoke all on function public.notification_recipient_for_resource(
  public.notification_subject_type, uuid
) from public;

revoke all on function public.notification_preference_enabled(
  uuid, public.notification_category, public.notification_channel
) from public;

revoke all on function public.notification_appointment_context(uuid) from public;
grant execute on function public.notification_appointment_context(uuid) to service_role;

revoke all on function public.notification_prescription_context(uuid) from public;
grant execute on function public.notification_prescription_context(uuid) to service_role;

revoke all on function public.notification_treatment_plan_context(uuid) from public;
grant execute on function public.notification_treatment_plan_context(uuid) to service_role;

revoke all on function public.create_notification(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer,
  public.notification_status, timestamptz, integer
) from public;
grant execute on function public.create_notification(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer,
  public.notification_status, timestamptz, integer
) to service_role;

revoke all on function public.plan_appointment_reminders(uuid) from public;
grant execute on function public.plan_appointment_reminders(uuid) to service_role;

revoke all on function public.cancel_appointment_reminders(uuid) from public;
grant execute on function public.cancel_appointment_reminders(uuid) to service_role;

revoke all on function public.release_due_reminders(integer) from public;
grant execute on function public.release_due_reminders(integer) to service_role;

revoke all on function public.claim_notification_outbox(integer, integer) from public;
grant execute on function public.claim_notification_outbox(integer, integer) to service_role;

revoke all on function public.complete_notification_outbox(
  uuid, public.notification_outbox_status, text, timestamptz
) from public;
grant execute on function public.complete_notification_outbox(
  uuid, public.notification_outbox_status, text, timestamptz
) to service_role;

revoke all on function public.enqueue_notification_delivery(
  uuid, public.notification_channel, text
) from public;
grant execute on function public.enqueue_notification_delivery(
  uuid, public.notification_channel, text
) to service_role;

revoke all on function public.claim_notification_deliveries(integer, integer) from public;
grant execute on function public.claim_notification_deliveries(integer, integer) to service_role;

revoke all on function public.record_notification_delivery_result(
  uuid, public.notification_delivery_status, text, text, timestamptz
) from public;
grant execute on function public.record_notification_delivery_result(
  uuid, public.notification_delivery_status, text, text, timestamptz
) to service_role;
