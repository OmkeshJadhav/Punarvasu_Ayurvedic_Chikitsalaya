-- ---------------------------------------------------------------------------
-- Phase 15 (continued) — reception notifications, part 2 of 2
--
-- When a patient books an appointment online, the front desk is told.
--
-- `phase_15.md` section 58 names "appointment request" first among the
-- receptionist notifications, and it is the one with a real workflow behind
-- it: a patient's self-service booking arrives as `requested`, and it stays
-- that way until somebody at the desk confirms it. Until now nobody was told —
-- the request sat in the schedule until a receptionist happened to look.
--
-- ## The event
--
-- `appointment_requested`, emitted by the existing appointments trigger when a
-- row is **inserted** as `requested`. Only `book_appointment` does that; the
-- front desk's own booking path inserts `confirmed`, so a receptionist is never
-- told about a booking a receptionist just made. A patient's reschedule, which
-- returns an appointment to `requested` through an UPDATE, still emits
-- `appointment_rescheduled` and nothing new — that is a separate workflow and
-- is not decided here.
--
-- Written inside the booking transaction, exactly like every other event: a
-- request that produced no event, or an event for a request that never
-- committed, is not a state the database can be in.
--
-- ## One event, every receptionist
--
-- The patient and the practitioner are each one account resolved from the
-- appointment. The desk is not: a request is addressed to whoever is on it, so
-- the notification goes to **every** account whose role is `receptionist`. The
-- first to open it confirms the request; the others find it already confirmed,
-- because the page reads the appointment, not the notification.
--
-- That needs one structural change. `notifications.dedupe_key` was unique on
-- its own, which made "one logical notification per event" and "one row per
-- event" the same statement. With a fan-out they are not, so the key becomes
-- unique **per recipient**: `(dedupe_key, recipient_user_id)`. For the patient
-- and the practitioner nothing changes — each key resolves to exactly one
-- account, deterministically, from the resource — and for the desk it means
-- processing the event twice still produces exactly one row per receptionist.
--
-- ## Still no recipient parameter
--
-- `create_reception_notifications` takes no account id, no email and no phone,
-- exactly like `create_notification`. It resolves its recipients itself, from
-- `profiles.role`, which is not self-updatable (Phase 06's
-- `profiles_guard_role` trigger). `create_notification` refuses the `reception`
-- audience outright (PV057) rather than falling through to a patient.
--
-- ## A reception notification names no patient
--
-- Sections 36, 37 and 58. A receptionist is authorized to know who booked —
-- the schedule shows it — but a notification reaches a lock screen and a
-- shared front-desk screen, so the message carries the consultation type, the
-- practitioner and the time, and nothing else. No patient name, no phone, no
-- patient note. The page behind the link says who.
--
-- ## Preferences
--
-- No new category. An appointment request is an `appointment_updates` message,
-- mandatory in-app for the reason every other one is: it is operational, and
-- a request nobody sees is a patient nobody calls back.
--
-- ## Forward-only
--
-- Earlier migrations are applied and are not edited. Every function below
-- keeps its signature and is replaced in place, so its grants survive; they are
-- re-stated anyway, because `20260926130000` is what happens when that is
-- assumed.
--
-- Error codes: PV050-PV059 remain this feature's range. PV057 is new here.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Emitting the event
--
-- The Phase 15 trigger, with one branch added to the INSERT arm. Every other
-- line is unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.appointments_emit_notification_events()
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

    -- A patient's own online booking. Keyed on the start instant like a
    -- confirmation, so the processor can refuse an event describing a time
    -- the appointment no longer has.
    if new.status = 'requested' then
      perform public.emit_notification_event(
        'appointment_requested',
        'appointment',
        new.id,
        'appointment:' || new.id::text || ':requested:'
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

comment on function public.appointments_emit_notification_events() is
  'Writes the appointment request, confirmation, reschedule and cancellation '
  'events into the outbox, inside the same transaction as the appointment '
  'change.';

revoke all on function public.appointments_emit_notification_events()
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Idempotency, per recipient
--
-- See the header. The composite key still leads with `dedupe_key`, so every
-- existing lookup by key alone is still served by an index.
-- ---------------------------------------------------------------------------
alter table public.notifications
  drop constraint notifications_dedupe_key_unique;

alter table public.notifications
  add constraint notifications_dedupe_key_recipient_unique
  unique (dedupe_key, recipient_user_id);

comment on constraint notifications_dedupe_key_recipient_unique
  on public.notifications is
  'One notification per event per recipient. A patient or practitioner key '
  'resolves to one account; a reception key fans out to every receptionist.';


-- ---------------------------------------------------------------------------
-- 3. The deep link
--
-- A reception notification points at `/receptionist/schedule/<id>`, the
-- front desk's own view of the appointment, which existed before this
-- migration and authorizes independently (`requireAreaAccess`, then
-- `requirePermission`, then row-level security). It is also where the request
-- is confirmed. The link identifies a resource and grants nothing.
-- ---------------------------------------------------------------------------
create or replace function public.notification_link_path(
  p_audience public.notification_audience,
  p_resource_type public.notification_subject_type,
  p_resource_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_audience = 'practitioner' then
      case p_resource_type
        when 'appointment' then '/doctor/appointments/' || p_resource_id::text
        else null
      end
    when p_audience = 'reception' then
      case p_resource_type
        when 'appointment' then '/receptionist/schedule/' || p_resource_id::text
        else null
      end
    else
      case p_resource_type
        when 'appointment' then '/patient/appointments/' || p_resource_id::text
        when 'prescription' then '/patient/prescriptions/' || p_resource_id::text
        when 'treatment_plan' then '/patient/treatment-plans/' || p_resource_id::text
      end
  end;
$$;

revoke all on function public.notification_link_path(
  public.notification_audience, public.notification_subject_type, uuid
) from public, anon, authenticated;
grant execute on function public.notification_link_path(
  public.notification_audience, public.notification_subject_type, uuid
) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Resolving a single recipient
--
-- The patient branch is now named rather than being the `else`. With a third
-- audience, an `else` that resolves to the patient is exactly the default that
-- would one day address a front-desk message to a patient. `reception` has no
-- single recipient, so it resolves to null here.
-- ---------------------------------------------------------------------------
create or replace function public.notification_recipient_for_resource(
  p_audience public.notification_audience,
  p_resource_type public.notification_subject_type,
  p_resource_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_audience = 'practitioner' then (
      select pr.profile_id
      from public.practitioners pr
      join public.appointments a on a.practitioner_id = pr.id
      where p_resource_type = 'appointment'
        and a.id = p_resource_id
    )
    when p_audience = 'patient' then (
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
      )
    )
    else null
  end;
$$;

revoke all on function public.notification_recipient_for_resource(
  public.notification_audience, public.notification_subject_type, uuid
) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. Creating a single-recipient notification
--
-- Unchanged except for two things: it refuses the `reception` audience
-- (PV057), and its conflict target is the new per-recipient key.
-- ---------------------------------------------------------------------------
create or replace function public.create_notification(
  p_dedupe_key text,
  p_audience public.notification_audience,
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
  link text;
  created uuid;
begin
  perform public.assert_notification_worker();

  if p_audience = 'reception' then
    -- The desk has many accounts, not one. Refused rather than resolved to
    -- nobody, so a caller that reaches for the wrong function hears about it
    -- instead of recording a silent skip.
    raise exception 'Reception notifications are created by create_reception_notifications.'
      using errcode = 'PV057';
  end if;

  recipient := public.notification_recipient_for_resource(
    p_audience, p_resource_type, p_resource_id
  );

  if recipient is null then
    raise exception 'No account to notify for this resource.'
      using errcode = 'PV050';
  end if;

  link := public.notification_link_path(
    p_audience, p_resource_type, p_resource_id
  );

  if link is null then
    raise exception 'No route for this audience and resource.'
      using errcode = 'PV056';
  end if;

  insert into public.notifications (
    recipient_user_id,
    audience,
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
    p_audience,
    p_event_type,
    p_category,
    btrim(p_title),
    btrim(p_body),
    p_template_version,
    p_resource_type,
    p_resource_id,
    link,
    p_status,
    p_dedupe_key,
    p_scheduled_for,
    p_reminder_offset_minutes
  )
  on conflict (dedupe_key, recipient_user_id) do nothing
  returning id into created;

  if created is null then
    select n.id into created
    from public.notifications n
    where n.dedupe_key = p_dedupe_key
      and n.recipient_user_id = recipient;
  end if;

  return created;
end;
$$;

revoke all on function public.create_notification(
  text, public.notification_audience, public.notification_event_type,
  public.notification_category, public.notification_subject_type, uuid, text,
  text, integer, public.notification_status, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.create_notification(
  text, public.notification_audience, public.notification_event_type,
  public.notification_category, public.notification_subject_type, uuid, text,
  text, integer, public.notification_status, timestamptz, integer
) to service_role;


-- ---------------------------------------------------------------------------
-- 6. Creating the front desk's notifications
--
-- One row per receptionist, resolved here from `profiles.role` — never from an
-- argument. Idempotent per recipient; returns every reception row for this key
-- so the caller can enqueue deliveries against each without creating any
-- twice. An empty set means the clinic has no receptionist account, which the
-- processor records as a skip rather than a failure.
--
-- Always `active`: there is no reception reminder, and a request is news now.
-- ---------------------------------------------------------------------------
create function public.create_reception_notifications(
  p_dedupe_key text,
  p_event_type public.notification_event_type,
  p_category public.notification_category,
  p_resource_type public.notification_subject_type,
  p_resource_id uuid,
  p_title text,
  p_body text,
  p_template_version integer
)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link text;
begin
  perform public.assert_notification_worker();

  link := public.notification_link_path(
    'reception', p_resource_type, p_resource_id
  );

  if link is null then
    raise exception 'No route for this audience and resource.'
      using errcode = 'PV056';
  end if;

  insert into public.notifications (
    recipient_user_id,
    audience,
    event_type,
    category,
    title,
    body,
    template_version,
    resource_type,
    resource_id,
    link_path,
    status,
    dedupe_key
  )
  select
    pr.id,
    'reception',
    p_event_type,
    p_category,
    btrim(p_title),
    btrim(p_body),
    p_template_version,
    p_resource_type,
    p_resource_id,
    link,
    'active',
    p_dedupe_key
  from public.profiles pr
  where pr.role = 'receptionist'
  on conflict (dedupe_key, recipient_user_id) do nothing;

  return query
  select n.id
  from public.notifications n
  where n.dedupe_key = p_dedupe_key
    and n.audience = 'reception';
end;
$$;

comment on function public.create_reception_notifications(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer
) is
  'Creates one notification per receptionist account for a front-desk event. '
  'Recipients are resolved from profiles.role and the link from the resource; '
  'neither is a parameter. Idempotent per recipient on dedupe_key.';

revoke all on function public.create_reception_notifications(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer
) from public, anon, authenticated;
grant execute on function public.create_reception_notifications(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer
) to service_role;

