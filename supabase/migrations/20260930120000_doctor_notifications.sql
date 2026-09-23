-- ---------------------------------------------------------------------------
-- Phase 15 (continued) — notifications for the practitioner
--
-- Phase 15 shipped with staff notifications deferred, and recorded why: section
-- 56 asks for useful workflows rather than every database event, and nobody had
-- decided what a member of staff should be told. `progress_phase_15.md` section
-- 17 left the architecture ready for the day that decision arrived — "
-- `recipient_user_id` is any account, the permission is already held by every
-- role, and `/notifications` already renders for staff".
--
-- This is that day, for one role. `phase_15.md` section 57 names three
-- candidate doctor notifications: an upcoming appointment, an appointment
-- rescheduled, and a patient submitting a document. The first two are changes
-- to a practitioner's own day that happen **without them** — the front desk
-- books, moves or cancels, and the practitioner finds out when they next look
-- at their diary. Those are implemented. The third is not: Phase 14 emits no
-- document event at all, and inventing one here would be the fake event
-- section 5 forbids.
--
-- ## What this is not
--
-- It is not a second notification system. There is no new table, no new queue,
-- no second worker and no second read path. The practitioner's notification is
-- a row in `public.notifications` like every other, read by the same policy,
-- marked read by the same function, counted by the same bell.
--
-- ## One domain event, two audiences
--
-- No trigger changes and no new outbox row. An appointment being confirmed is
-- **one** domain fact, and it was already recorded inside the domain
-- transaction; who should be told about it is a delivery concern, decided
-- afterwards by the processor. So the outbox stays a log of what happened to
-- the clinic rather than a log of messages somebody intends to send, and
-- `notification_outbox` is untouched by this migration.
--
-- Each audience gets its own notification row with its own idempotency key —
-- `appointment:<id>:confirmed` for the patient, and
-- `appointment:<id>:confirmed_practitioner` for the practitioner — so
-- processing one event twice still produces exactly one of each.
--
-- ## The recipient is still never a parameter
--
-- Sections 54, 72, 73 and 110 hold exactly as before. `create_notification`
-- gains an **audience**, not a recipient: `patient` or `practitioner`, two
-- values, neither of which names anybody. The account is still resolved from
-- the resource — `patients.profile_id` for a patient, `practitioners.profile_id`
-- for a practitioner — and the deep link is still derived rather than accepted.
-- There is no `recipientUserId`, no `recipientEmail`, no `recipientPhone` and
-- no `to` in any signature here either.
--
-- ## A practitioner's notification names no patient
--
-- Sections 36, 37, 57 and 81. A practitioner is authorized to know who is on
-- their own list — but a notification is the one thing this product sends that
-- reaches a lock screen, a notification shade or a shared phone, and a patient's
-- name on a lock screen is a disclosure the clinic did not have to make. So the
-- practitioner templates take the consultation type and the time and **nothing
-- else**: `notification_appointment_context()` is unchanged, and the template
-- inputs on the application side carry no patient field for one to arrive in.
--
-- The notification says the day changed; the diary behind the link says who.
--
-- ## Reminders stay a patient's
--
-- Sections 56 and 61: do not flood staff with every database event. A
-- practitioner with eight appointments does not want sixteen reminders about a
-- day they are already looking at — the day view is the reminder.
-- `plan_appointment_reminders` is untouched and still plans for the patient
-- alone.
--
-- ## Preferences
--
-- No new category. A practitioner's schedule change is the same preference unit
-- as a patient's — `appointment_updates`, "an appointment was confirmed, moved
-- or cancelled" — and it is mandatory in-app for the same reason: it is
-- operational information the clinic has a duty to put somewhere the person can
-- find it. Section 98's requirement that staff preferences be scoped to the
-- authenticated staff account is met by the mechanism that already scopes a
-- patient's: `set_notification_preference` takes no user id.
--
-- ## Forward-only
--
-- `docs/DATABASE.md` section 12. The three Phase 15 migrations are applied, so
-- they are not edited. Three functions change signature, which PostgreSQL
-- cannot do in place, so each is dropped and recreated — and every one of them
-- has its grants re-applied and its gate re-stated afterwards, because
-- `create function` takes Supabase's default named grants exactly as
-- `20260926130000` discovered.
--
-- Error codes: PV050-PV059 remain this feature's range. PV056 is new here.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Who a notification was written for
--
-- Two values, because two exist. There is no `receptionist` and no
-- `administrator`: no receptionist or administrator workflow has been designed
-- (section 58 asks for the same restraint section 56 does), and an enum value
-- nothing can produce is the pretence section 14 forbids. Adding one later is
-- one `alter type ... add value` and the migration that uses it.
-- ---------------------------------------------------------------------------
create type public.notification_audience as enum ('patient', 'practitioner');

comment on type public.notification_audience is
  'Which side of an appointment a notification was written for. Decides the '
  'account it is resolved to and the area its deep link points at. It names '
  'no person: there is still no recipient parameter anywhere in this feature.';


-- ---------------------------------------------------------------------------
-- 2. The column
--
-- Machinery rather than message, like `dedupe_key` — so it is deliberately
-- **not** added to the select grant. Nothing the notification centre renders
-- depends on it: the row carries the title and body that were rendered for this
-- audience when it was created, and those are what a reader sees.
--
-- It is stored because a row must remain interpretable on its own (section 99's
-- argument for `template_version`, applied to vocabulary rather than wording):
-- without it, "which template wrote this sentence?" would have to be inferred
-- from the shape of a dedupe key.
--
-- `default 'patient'` is the truth about every row that exists: before this
-- migration every recipient was a patient.
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column audience public.notification_audience not null default 'patient';

comment on column public.notifications.audience is
  'Which template vocabulary rendered this row, and which area its link points '
  'at. Set by create_notification; not granted to any client role.';


-- ---------------------------------------------------------------------------
-- 3. The deep link, still derived
--
-- Sections 19 and 84. A practitioner's appointment notification points at
-- `/doctor/appointments/<id>`, which is a route that existed before this
-- migration and authorizes independently — `requireAreaAccess`, then
-- `requirePermission`, then `doctor_owns_appointment()` in the database. A link
-- identifies a resource and grants nothing (sections 18, 85).
--
-- A practitioner has **no** prescription or treatment-plan branch, and that is
-- not an omission: those are documents the practitioner wrote. Telling somebody
-- they have issued the prescription they just issued is the noise section 56
-- exists to prevent, so there is no route, no recipient and no notification.
--
-- The old two-argument function is dropped rather than left beside this one: an
-- overload that resolves to a patient route whenever the audience is omitted is
-- exactly the default that ends up sending a doctor to a patient's page.
-- ---------------------------------------------------------------------------
drop function public.create_notification(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer,
  public.notification_status, timestamptz, integer
);

drop function public.notification_link_path(
  public.notification_subject_type, uuid
);

drop function public.notification_recipient_for_resource(
  public.notification_subject_type, uuid
);

create function public.notification_link_path(
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
    else
      case p_resource_type
        when 'appointment' then '/patient/appointments/' || p_resource_id::text
        when 'prescription' then '/patient/prescriptions/' || p_resource_id::text
        when 'treatment_plan' then '/patient/treatment-plans/' || p_resource_id::text
      end
  end;
$$;

comment on function public.notification_link_path(
  public.notification_audience, public.notification_subject_type, uuid
) is
  'The application route a notification points at, built from the audience and '
  'the resource rather than accepted as a parameter. Null where that audience '
  'has no route for that resource. Mirrored in '
  'src/features/notifications/links.ts.';

revoke all on function public.notification_link_path(
  public.notification_audience, public.notification_subject_type, uuid
) from public, anon, authenticated;
grant execute on function public.notification_link_path(
  public.notification_audience, public.notification_subject_type, uuid
) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Resolving a recipient
--
-- Still from the resource, never from an argument. The practitioner branch
-- reads `appointments.practitioner_id` and then `practitioners.profile_id`,
-- which is `not null` — a practitioner who cannot sign in cannot be on the
-- roster (Phase 09) — so a practitioner appointment always has somebody to
-- notify, unlike a walk-in patient who may have no login.
--
-- Null for every other (audience, resource) pair, which `create_notification`
-- turns into PV050 and the processor records as a skip. Nothing retries
-- forever, and nothing invents a recipient.
-- ---------------------------------------------------------------------------
create function public.notification_recipient_for_resource(
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
    else (
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
  end;
$$;

comment on function public.notification_recipient_for_resource(
  public.notification_audience, public.notification_subject_type, uuid
) is
  'The account a notification about this resource belongs to, resolved from '
  'the resource and the audience. Null when there is nobody to tell — a '
  'walk-in with no login, or an audience with no interest in that resource. '
  'There is no recipient parameter anywhere in this feature.';

revoke all on function public.notification_recipient_for_resource(
  public.notification_audience, public.notification_subject_type, uuid
) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. Creating a notification
--
-- The same function, one parameter wider. Still idempotent on `dedupe_key`,
-- still gated by `assert_notification_worker()`, still resolving both the
-- recipient and the link itself.
--
-- The new refusal, PV056, is the one case the old signature could not reach: an
-- audience with a recipient but no route. It cannot happen today — the only
-- practitioner notifications are about appointments, and appointments have a
-- doctor route — and it is raised rather than assumed away, because the pair of
-- `case` expressions above are two places that have to agree and a silent null
-- would become a `not null` violation with no explanation attached.
-- ---------------------------------------------------------------------------
create function public.create_notification(
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

  recipient := public.notification_recipient_for_resource(
    p_audience, p_resource_type, p_resource_id
  );

  if recipient is null then
    -- A walk-in with no login, a resource that has gone, or an audience this
    -- resource says nothing to. Distinguished from a failure so the processor
    -- marks the event skipped and stops, rather than retrying something that
    -- will never succeed.
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
  on conflict (dedupe_key) do nothing
  returning id into created;

  if created is null then
    -- Already created by an earlier run. Return what exists so the caller can
    -- enqueue deliveries against it without a second logical notification ever
    -- coming into being.
    select n.id into created
    from public.notifications n
    where n.dedupe_key = p_dedupe_key;
  end if;

  return created;
end;
$$;

comment on function public.create_notification(
  text, public.notification_audience, public.notification_event_type,
  public.notification_category, public.notification_subject_type, uuid, text,
  text, integer, public.notification_status, timestamptz, integer
) is
  'The only way a notification is created. Resolves the recipient and the deep '
  'link from the audience and the resource — neither is a parameter — and is '
  'idempotent on dedupe_key.';

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
