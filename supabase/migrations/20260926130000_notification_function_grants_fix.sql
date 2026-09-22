-- ---------------------------------------------------------------------------
-- Phase 15 — the notification processor's functions were reachable by any
-- signed-in user
--
-- ## The defect
--
-- `20260926120000_notifications.sql` protects the processor's interface with
--
--     revoke all on function public.<name>(...) from public;
--     grant execute on function public.<name>(...) to service_role;
--
-- which is the pattern every phase since 08 has used, and which is **not
-- sufficient here**. Supabase's project bootstrap carries
-- `alter default privileges ... grant execute on functions to anon,
-- authenticated, service_role`, so a newly created function is granted to
-- those roles *by name* at creation time. `revoke ... from public` removes
-- only the PUBLIC grant and leaves the named ones in place.
--
-- Every earlier phase happened to survive this because each of its functions
-- calls an authorization gate — `assert_care_practitioner()`,
-- `assert_appointment_manager()` — as its first statement, so the `42501` a
-- live check observed was raised by the **function body** rather than by the
-- privilege system. Phase 15's processor functions have no such gate: they are
-- meant to be unreachable, so they were written to trust the grant.
--
-- The consequence, before this migration: any authenticated user could call
-- `create_notification`, `claim_notification_outbox`,
-- `claim_notification_deliveries`, `release_due_reminders`,
-- `plan_appointment_reminders`, `enqueue_notification_delivery`,
-- `record_notification_delivery_result`, `complete_notification_outbox`, the
-- three context functions, `emit_notification_event`,
-- `notification_recipient_for_resource` and `notification_preference_enabled`.
--
-- That is a real authorization hole. It was found by running the phase's live
-- verification against the project, and by nothing else: the structural test
-- asserts the migration *says* `grant execute ... to service_role`, which it
-- does, and a stubbed integration test never reaches a grant at all.
--
-- ## The fix, in two layers
--
-- 1. **Revoke by name.** `from public` is replaced with
--    `from public, anon, authenticated` for every processor function, which
--    is what actually removes the default grant.
--
-- 2. **A gate in the body.** `assert_notification_worker()` refuses a caller
--    whose request role is `anon` or `authenticated`, so restoring a grant by
--    accident — a later `alter default privileges`, a careless migration, a
--    Supabase platform change — does not restore the hole. Every phase since
--    11 has put its authorization in the function body for exactly this
--    reason; Phase 15 now does too.
--
--    It is a **deny-list of the two client roles**, not an allow-list of
--    `service_role`. The set of legitimate non-client contexts is open —
--    a migration, `psql`, an in-database `pg_cron` job, a future worker with
--    its own role — and an allow-list would refuse all of them the first time
--    one appeared.
--
-- `emit_notification_event` is deliberately **not** gated: it is called by the
-- three domain triggers, which run as whichever role performed the domain
-- write, and a gate there would refuse an ordinary booking. Its grant is
-- revoked, which is the whole of what it needs — a client that called it
-- directly could write a duplicate-keyed outbox row and nothing else, and now
-- cannot call it at all.
--
-- Forward-only, as `docs/DATABASE.md` section 12 requires: the previous
-- migration has been applied, so it is not edited.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. The gate
-- ---------------------------------------------------------------------------
create function public.assert_notification_worker()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requester text := coalesce((select auth.role()), '');
begin
  if requester in ('anon', 'authenticated') then
    raise exception 'This operation is not available.'
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.assert_notification_worker() is
  'Refuses a caller arriving as anon or authenticated. A deny-list of the two '
  'client roles rather than an allow-list of service_role, because the set of '
  'legitimate non-client contexts — a migration, psql, pg_cron, a future '
  'worker role — is open. Second layer behind the execute grants.';

revoke all on function public.assert_notification_worker()
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Revoke the default grants, by name
--
-- `create or replace function` is deliberately avoided for the bodies below
-- that do not change; only the ones gaining the gate are replaced. The rest is
-- pure privilege maintenance.
-- ---------------------------------------------------------------------------
revoke all on function public.emit_notification_event(
  public.notification_event_type, public.notification_subject_type, uuid, text
) from public, anon, authenticated;

revoke all on function public.notification_recipient_for_resource(
  public.notification_subject_type, uuid
) from public, anon, authenticated;

revoke all on function public.notification_preference_enabled(
  uuid, public.notification_category, public.notification_channel
) from public, anon, authenticated;

revoke all on function public.notification_appointment_context(uuid)
  from public, anon, authenticated;
revoke all on function public.notification_prescription_context(uuid)
  from public, anon, authenticated;
revoke all on function public.notification_treatment_plan_context(uuid)
  from public, anon, authenticated;

revoke all on function public.create_notification(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer,
  public.notification_status, timestamptz, integer
) from public, anon, authenticated;

revoke all on function public.plan_appointment_reminders(uuid)
  from public, anon, authenticated;
revoke all on function public.cancel_appointment_reminders(uuid)
  from public, anon, authenticated;
revoke all on function public.release_due_reminders(integer)
  from public, anon, authenticated;

revoke all on function public.claim_notification_outbox(integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_notification_outbox(
  uuid, public.notification_outbox_status, text, timestamptz
) from public, anon, authenticated;

revoke all on function public.enqueue_notification_delivery(
  uuid, public.notification_channel, text
) from public, anon, authenticated;
revoke all on function public.claim_notification_deliveries(integer, integer)
  from public, anon, authenticated;
revoke all on function public.record_notification_delivery_result(
  uuid, public.notification_delivery_status, text, text, timestamptz
) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. The gate, inside each function a client could otherwise reach
--
-- Bodies are otherwise byte-identical to the previous migration's. Each gains
-- one line, as its first statement — the same shape Phases 10 to 14 use.
-- ---------------------------------------------------------------------------

create or replace function public.notification_recipient_for_resource(
  p_resource_type public.notification_subject_type,
  p_resource_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result uuid;
begin
  perform public.assert_notification_worker();

  select p.profile_id
  into result
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

  return result;
end;
$$;

create or replace function public.notification_appointment_context(
  p_appointment_id uuid
)
returns table (
  status public.appointment_status,
  starts_at timestamptz,
  ends_at timestamptz,
  practitioner_name text,
  appointment_type_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_notification_worker();

  return query
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
end;
$$;

create or replace function public.notification_prescription_context(
  p_prescription_id uuid
)
returns table (
  status public.prescription_status,
  issued_at timestamptz,
  practitioner_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_notification_worker();

  return query
  select p.status, p.issued_at, pr.display_name
  from public.prescriptions p
  join public.practitioners pr on pr.id = p.practitioner_id
  where p.id = p_prescription_id;
end;
$$;

create or replace function public.notification_treatment_plan_context(
  p_plan_id uuid
)
returns table (
  status public.treatment_plan_status,
  activated_at timestamptz,
  practitioner_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_notification_worker();

  return query
  select tp.status, tp.activated_at, pr.display_name
  from public.treatment_plans tp
  join public.practitioners pr on pr.id = tp.practitioner_id
  where tp.id = p_plan_id;
end;
$$;

create or replace function public.create_notification(
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
  perform public.assert_notification_worker();

  recipient := public.notification_recipient_for_resource(
    p_resource_type, p_resource_id
  );

  if recipient is null then
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
    select n.id into created
    from public.notifications n
    where n.dedupe_key = p_dedupe_key;
  end if;

  return created;
end;
$$;

create or replace function public.plan_appointment_reminders(
  p_appointment_id uuid
)
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
  perform public.assert_notification_worker();

  select a.status, a.starts_at
  into appointment_status, appointment_starts_at
  from public.appointments a
  where a.id = p_appointment_id;

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

create or replace function public.cancel_appointment_reminders(
  p_appointment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  perform public.assert_notification_worker();

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

create or replace function public.release_due_reminders(
  p_limit integer default 100
)
returns table (notification_id uuid, released boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch uuid[];
  valid_ids uuid[];
begin
  perform public.assert_notification_worker();

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

create or replace function public.claim_notification_outbox(
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
  perform public.assert_notification_worker();

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

create or replace function public.complete_notification_outbox(
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
  perform public.assert_notification_worker();

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

create or replace function public.enqueue_notification_delivery(
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
  perform public.assert_notification_worker();

  if p_channel = 'in_app' then
    raise exception 'In-app notifications have no separate delivery.'
      using errcode = 'PV054';
  end if;

  if not exists (
    select 1 from public.notifications n
    where n.id = p_notification_id and n.status = 'active'
  ) then
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

create or replace function public.claim_notification_deliveries(
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
  perform public.assert_notification_worker();

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

create or replace function public.record_notification_delivery_result(
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
  perform public.assert_notification_worker();

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


-- ---------------------------------------------------------------------------
-- 4. Re-apply the intended grants
--
-- `create or replace function` resets a function's privileges to the defaults
-- for a newly created one, which is the very thing this migration exists to
-- correct — so every revoke is repeated after the replacements, and the
-- service-role grants are re-issued.
-- ---------------------------------------------------------------------------
revoke all on function public.notification_recipient_for_resource(
  public.notification_subject_type, uuid
) from public, anon, authenticated;

revoke all on function public.notification_preference_enabled(
  uuid, public.notification_category, public.notification_channel
) from public, anon, authenticated;

revoke all on function public.notification_appointment_context(uuid)
  from public, anon, authenticated;
revoke all on function public.notification_prescription_context(uuid)
  from public, anon, authenticated;
revoke all on function public.notification_treatment_plan_context(uuid)
  from public, anon, authenticated;

revoke all on function public.create_notification(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer,
  public.notification_status, timestamptz, integer
) from public, anon, authenticated;

revoke all on function public.plan_appointment_reminders(uuid)
  from public, anon, authenticated;
revoke all on function public.cancel_appointment_reminders(uuid)
  from public, anon, authenticated;
revoke all on function public.release_due_reminders(integer)
  from public, anon, authenticated;

revoke all on function public.claim_notification_outbox(integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_notification_outbox(
  uuid, public.notification_outbox_status, text, timestamptz
) from public, anon, authenticated;

revoke all on function public.enqueue_notification_delivery(
  uuid, public.notification_channel, text
) from public, anon, authenticated;
revoke all on function public.claim_notification_deliveries(integer, integer)
  from public, anon, authenticated;
revoke all on function public.record_notification_delivery_result(
  uuid, public.notification_delivery_status, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.notification_appointment_context(uuid)
  to service_role;
grant execute on function public.notification_prescription_context(uuid)
  to service_role;
grant execute on function public.notification_treatment_plan_context(uuid)
  to service_role;
grant execute on function public.create_notification(
  text, public.notification_event_type, public.notification_category,
  public.notification_subject_type, uuid, text, text, integer,
  public.notification_status, timestamptz, integer
) to service_role;
grant execute on function public.plan_appointment_reminders(uuid)
  to service_role;
grant execute on function public.cancel_appointment_reminders(uuid)
  to service_role;
grant execute on function public.release_due_reminders(integer)
  to service_role;
grant execute on function public.claim_notification_outbox(integer, integer)
  to service_role;
grant execute on function public.complete_notification_outbox(
  uuid, public.notification_outbox_status, text, timestamptz
) to service_role;
grant execute on function public.enqueue_notification_delivery(
  uuid, public.notification_channel, text
) to service_role;
grant execute on function public.claim_notification_deliveries(integer, integer)
  to service_role;
grant execute on function public.record_notification_delivery_result(
  uuid, public.notification_delivery_status, text, text, timestamptz
) to service_role;
