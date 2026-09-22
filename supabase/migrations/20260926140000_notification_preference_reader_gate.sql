-- ---------------------------------------------------------------------------
-- Phase 15 — the preference reader gets the gate too
--
-- `20260926130000` revoked `notification_preference_enabled` from the named
-- client roles and gave the gate to every other processor function, but left
-- this one ungated because it is `language sql` and rewriting it was
-- inconvenient.
--
-- That is not a security argument. This function **takes another account's id
-- as a parameter**, which is precisely the shape that deserves the strongest
-- treatment — `notification_recipient_for_resource` returns nothing more than
-- a uuid and is gated for exactly that reason. Leaving one function protected
-- only by its grant, when the whole point of the previous migration was that a
-- grant had silently not been what everybody assumed, would be an
-- inconsistency a reader has to reason about rather than one they can trust.
--
-- So: the same gate, and the body is otherwise unchanged. It is still called
-- from inside `claim_notification_deliveries`, where `auth.role()` is the
-- request's role and therefore `service_role` for the worker — a nested
-- definer call does not change it.
--
-- `emit_notification_event` remains the one ungated function, and that is a
-- genuine exception rather than a convenience: it is called by the three
-- domain triggers, which run as whichever role performed the domain write, so
-- a gate there would make a patient's own booking fail.
-- ---------------------------------------------------------------------------

create or replace function public.notification_preference_enabled(
  p_user_id uuid,
  p_category public.notification_category,
  p_channel public.notification_channel
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result boolean;
begin
  perform public.assert_notification_worker();

  select coalesce(
    (
      select np.enabled
      from public.notification_preferences np
      where np.user_id = p_user_id
        and np.category = p_category
        and np.channel = p_channel
    ),
    true
  )
  into result;

  return result;
end;
$$;

comment on function public.notification_preference_enabled(
  uuid, public.notification_category, public.notification_channel
) is
  'Whether an account has this channel switched on for this category. Absence '
  'means enabled. Takes a user id, and is therefore both revoked from every '
  'client role and gated in its body.';

-- `create or replace` resets privileges to the defaults for a newly created
-- function, which is the very thing the previous migration exists to correct.
revoke all on function public.notification_preference_enabled(
  uuid, public.notification_category, public.notification_channel
) from public, anon, authenticated;
