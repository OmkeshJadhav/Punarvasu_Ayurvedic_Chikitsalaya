-- ---------------------------------------------------------------------------
-- Phase 15 (continued) — reception notifications, part 1 of 2: the vocabulary
--
-- Two enum values, in a migration of their own, because PostgreSQL will not
-- let a value added by `alter type ... add value` be used inside the
-- transaction that added it. `20261003130000_reception_notifications.sql`
-- uses both — in a trigger, in two `language sql` function bodies that are
-- validated at creation, and in a check — so it must run after this one has
-- committed.
--
-- Nothing here produces either value. Section 5: "only implement events that
-- correspond to actual implemented domain actions". The event a patient's
-- booking produces, and the audience it is addressed to, arrive together in the
-- next migration.
-- ---------------------------------------------------------------------------

-- A patient asked for a time. Produced only by a row inserted as `requested`,
-- which only `book_appointment` — the patient's own self-service path — does:
-- a front-desk booking is inserted as `confirmed` and emits
-- `appointment_confirmed` exactly as before.
alter type public.notification_event_type add value 'appointment_requested';

-- The front desk. Not a person and not a role name: an audience, like
-- `patient` and `practitioner`, which the database resolves to accounts. Unlike
-- the other two it resolves to **every** receptionist, because a booking
-- request is addressed to the desk rather than to whoever happens to be on it.
alter type public.notification_audience add value 'reception';
