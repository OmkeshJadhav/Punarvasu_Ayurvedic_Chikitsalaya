-- ===========================================================================
-- Doctor check-in — a practitioner may check their own patient in
--
-- Phase 11 kept `checked_in` for the front desk alone. In practice the desk
-- is not always staffed, or is busy, when a patient walks into the consulting
-- room — and because "Start consultation" is only reachable from
-- `checked_in`, a patient nobody had checked in could not be seen in the
-- workspace at all. The practitioner had to find a receptionist first.
--
-- This migration adds exactly one transition to the practitioner's
-- allowlist:
--
--     confirmed -> checked_in
--
-- ## What does not change
--
--   * The appointment is still resolved by id **and** by the caller's own
--     practitioner id, so a doctor can check in only a patient in their own
--     diary.
--   * `cancelled` stays refused. Cancelling changes a patient's plans and
--     needs somebody to tell them; that is still the desk's work.
--   * `requested -> checked_in` is not a legal transition in the Phase 09
--     matrix, and still is not: an unconfirmed request is confirmed first.
--   * `appointments_guard_transition()` still holds beneath all of it.
--   * The check-in writes the same `appointment_events` row, with the doctor
--     as the actor, so "who checked this patient in?" is still answerable.
--
-- ## Why `create or replace` and not a second function
--
-- One status function per role. A separate `check_in_as_doctor` would be a
-- second place the doctor's allowlist lives. The signature is unchanged, so
-- the existing grants carry over; they are restated below regardless so this
-- file reads as the complete definition.
--
-- `src/features/doctor/status.ts` mirrors the allowlist and the `case` below,
-- and `status.test.ts` asserts the two agree by reading **this** migration.
-- ===========================================================================

create or replace function public.update_appointment_status_as_doctor(
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  practitioner uuid;
  appt record;
  allowed boolean;
begin
  practitioner := public.assert_care_practitioner();

  if p_status not in ('confirmed', 'checked_in', 'in_consultation', 'completed', 'no_show') then
    raise exception 'You do not have permission to set that status.'
      using errcode = 'insufficient_privilege';
  end if;

  -- By id *and* by the caller's own practitioner record, in one statement.
  -- There is no window between reading and checking, and cross-doctor access
  -- returns the same answer as a nonexistent appointment.
  select a.id, a.status into appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.practitioner_id = practitioner;

  if appt.id is null then
    raise exception 'Appointment not found.'
      using errcode = 'PV009';
  end if;

  if appt.status = p_status then
    -- Not an error and not a change. A second click, or the doctor and the
    -- front desk checking the same patient in at the same moment, should not
    -- raise.
    return;
  end if;

  -- The Phase 09 matrix narrowed to this role, mirrored here only so the
  -- refusal carries a sentence. The trigger is what enforces it.
  allowed := case
    when appt.status = 'requested' then p_status in ('confirmed')
    when appt.status = 'confirmed' then p_status in ('checked_in', 'no_show')
    when appt.status = 'checked_in' then p_status in ('in_consultation', 'no_show')
    when appt.status = 'in_consultation' then p_status in ('completed')
    else false
  end;

  if not allowed then
    raise exception 'That status change is not allowed.'
      using errcode = 'PV008';
  end if;

  update public.appointments a
  set status = p_status
  where a.id = appt.id;

  insert into public.appointment_events (
    appointment_id, actor_id, event_type, previous_status, new_status
  )
  values (appt.id, actor, 'status_changed', appt.status, p_status);
end;
$$;

comment on function public.update_appointment_status_as_doctor(uuid, public.appointment_status) is
  'The practitioner''s own operational status actions: confirm, check the '
  'patient in, start the consultation, complete it, or record a no-show. It '
  'cannot cancel. It acts only on appointments in the caller''s own diary, '
  'and defers to the Phase 09 transition trigger for legality.';

-- Revoked from `anon` by name, as every migration after Phase 19 does: the
-- body's gate refuses an anonymous caller anyway, but a grant that is never
-- there cannot be relied on by mistake.
revoke all on function public.update_appointment_status_as_doctor(uuid, public.appointment_status)
  from public, anon;
grant execute on function public.update_appointment_status_as_doctor(uuid, public.appointment_status) to authenticated;
