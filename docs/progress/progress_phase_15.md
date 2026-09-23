## PHASE 15 — Notifications & Communication

Status:
COMPLETED — three migrations applied to the live Supabase project and verified
against it with real per-role JWTs, and the whole lifecycle driven end to end
against a production build.

**Extended on 2026-09-23 with notifications for the practitioner** (section 20).
Its migration is **applied to the live project and verified against it** —
including the fan-out, the recipient resolution and row-level isolation driven
against real rows. See section 20.7.

Completed On:
2026-09-19 (original phase) · 2026-09-23 (practitioner notifications)

Summary:
Built the first thing Punarvasu *sends*: a transactional outbox written by
database triggers **inside the domain transaction**, a worker that turns those
rows into notifications, the patient's notification centre, appointment
confirmation, reschedule, cancellation and reminder messages, prescription and
treatment-plan messages, communication preferences, and a provider abstraction
with retry, idempotency and bounded failure.

**A notification cannot affect a domain write.** The event is a row a trigger
writes in the same transaction as the appointment change; no provider is
reachable from inside it; the processor runs afterwards and may fail as often
as it likes.

**There is no recipient parameter and no link parameter anywhere in the
system.** `create_notification` resolves the account from the resource and
derives the deep link from the resource type and id. `recipientEmail`,
`recipientPhone`, `recipientUserId` and `to` do not exist as a function
argument, a schema key or a form field.

**In-app notifications work. Email does not, and the product says so.** The
adapter exists and no provider is configured, so the channel is disabled and
the preferences page explains why. There is no SMS and no WhatsApp anywhere —
not an enum value, not a stub.

3,388 tests pass, up from 3,049. **146 live checks** against the linked
project: 115 database and authorization checks with real per-role JWTs, 3
endpoint-authentication checks, and 28 end-to-end checks driving the real
worker through a production build.

**Three real defects were found by verification rather than by review**, and
one of them was an authorization hole that every test in the suite reported as
closed. All three are described in full below, because the class of each is
worth remembering.

---

### Repository assessment before starting

Phases 06–14 left identity, the patient record, authorization, the appointment
engine, both staff workspaces, clinical records, prescriptions, treatment plans
and patient documents. Reused rather than rebuilt: `requirePermission`/
`assertPermission`, `config/permissions.ts`, the three Supabase clients,
`AppError`, `createRouteHandler` and the API envelope, the structured logger,
`uuidSchema`, the Phase 09 clinic-timezone formatters, `set_updated_at()`,
`Alert`, `Button`, `EmptyState`, `ErrorState`, `Container`, `Section`,
`NavLink`, `Skeleton` and the loading patterns.

Five findings shaped the work:

* **Every domain write already goes through a `security definer` function, and
  every domain table already has a trigger convention.** That is what made a
  true transactional outbox cheap: an `after` trigger on `appointments`,
  `prescriptions` and `treatment_plans` covers every write path — including
  ones added later — without editing a single Phase 09–13 function, so their
  mirror tests still describe what is installed.
* **Phase 14 left a caveat that turned out to be the whole design**: "a
  notification is the first thing Punarvasu sends that reaches a lock screen…
  a document notification must not name the document". The answer was to make
  it impossible rather than remembered — no column, and context functions that
  cannot return one.
* **`PROTECTED_PATH_PREFIXES` did not list `/notifications`.** Unlike
  `/patient` and `/admin`, this path had never been listed speculatively, so
  it had to be added alongside a `robots.txt` entry.
* **Phase 06's `safeRedirectPath` already had the right shape for a deep
  link**, and Phase 06's host-header reasoning already applied: a link in a
  message must be built from configuration, never from a request.
* **No email provider is configured for the application.** Phase 06 put
  authentication email behind a Supabase Auth hook and an Edge Function, which
  the application cannot reach. Anything this phase sent would need its own
  configuration.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260926120000_notifications.sql
supabase/migrations/20260926130000_notification_function_grants_fix.sql
supabase/migrations/20260926140000_notification_preference_reader_gate.sql

src/config/notifications.ts               the mirror: schedule, categories, bounds
src/config/notifications.test.ts

src/features/notifications/types.ts       the domain model
src/features/notifications/links.ts       the deep link, derived
src/features/notifications/links.test.ts
src/features/notifications/templates.ts   every word a patient reads
src/features/notifications/templates.test.ts
src/features/notifications/errors.ts      two vocabularies, deliberately apart
src/features/notifications/errors.test.ts
src/features/notifications/retry.ts       when to try again, and when to stop
src/features/notifications/retry.test.ts
src/features/notifications/validation.ts  the trust boundary
src/features/notifications/validation.test.ts
src/features/notifications/content.ts     the notification centre's copy
src/features/notifications/queries.ts     session-scoped reads
src/features/notifications/actions.ts     three server actions
src/features/notifications/processor.ts   the worker
src/features/notifications/dispatch.ts    the one line a domain action adds
src/features/notifications/dispatch.test.ts

src/lib/notifications/channel.ts          the provider abstraction
src/lib/notifications/providers/emailjs.ts
src/lib/rate-limit/fixed-window.ts
src/lib/rate-limit/fixed-window.test.ts

src/components/notifications/notification-bell.tsx
src/components/notifications/notification-list.tsx
src/components/notifications/notification-item.tsx
src/components/notifications/notification-filters.tsx
src/components/notifications/mark-read-form.tsx
src/components/notifications/mark-all-read-form.tsx
src/components/notifications/notification-preferences-form.tsx

src/app/(app)/notifications/layout.tsx
src/app/(app)/notifications/page.tsx
src/app/(app)/notifications/loading.tsx
src/app/(app)/notifications/preferences/page.tsx
src/app/api/notifications/process/route.ts

tests/integration/notification-processor.test.ts
tests/integration/notification-actions.test.ts
tests/integration/notification-security.test.ts
tests/components/notifications.test.tsx
docs/progress/progress_phase_15.md
```

#### Modified

```text
src/config/permissions.ts              two permissions, held by every role
src/config/permissions.test.ts         the four role lists
src/config/env.server.ts               provider credentials + the worker secret
src/lib/authorization/policy.test.ts   the exhaustive matrix, extended
src/lib/auth/paths.ts                  /notifications protected
src/app/robots.ts                      /notifications disallowed
src/types/database.ts                  four tables, seven enums, nineteen functions
src/app/(app)/layout.tsx               the bell in the authenticated header

src/features/appointments/actions.ts       one dispatch call in two actions
src/features/reception/actions.ts          three
src/features/doctor/actions.ts             one
src/features/prescriptions/actions.ts      one
src/features/treatment-plans/actions.ts    one

.env.example                           the provider and worker configuration
docs/ARCHITECTURE.md, docs/SECURITY.md, docs/DATABASE.md,
docs/QA_STRATEGY.md, docs/DESIGN_SYSTEM.md, docs/PUNARVASU_MASTER_SPEC.md
```

#### Dependencies

**None added.**

---

### 2. Database

Three migrations, all applied to the linked project with `supabase db push`
and verified against it.

```text
Tables:         4 added. 0 altered structurally. No column added to any
                domain table.
Enums:          7 added
Constraints:    ~30 across the four tables
Indexes:        6 added, plus the primary and unique keys
Foreign keys:   3 (recipient, notification, preference owner)
Triggers:       7 — three that emit events on domain tables, four for
                timestamps
RLS policies:   2 added, both SELECT. 0 altered, 0 dropped.
Functions:      19, of which 12 are granted to `service_role` alone, 3 to
                `authenticated` for configuration, 3 to `authenticated` for
                the caller's own read state and preferences, and 1 to nobody
Grants:         column-scoped SELECT on `notifications`, table SELECT on
                `notification_preferences`. **No write grant anywhere. The two
                queues are revoked from `anon`, `authenticated` AND
                `service_role`.**
```

#### The four tables

```text
notification_outbox        one row per domain event, written by an `after`
                           trigger inside the domain transaction
notifications              one thing a patient should know
notification_deliveries    one EXTERNAL delivery attempt
notification_preferences   one row per (user, category, channel)
```

#### What is deliberately absent

* **No column for clinical content** on any table — no diagnosis, symptom,
  assessment, medicine, dose, item, plan title, document title, note,
  cancellation reason or patient note. Nothing can be stored, so nothing can
  be sent.
* **No email, phone or address column** anywhere. A recipient's address is
  read from `auth.users` for one send and is never copied into this schema.
* **No `delivered` delivery status.** `sent` means the provider accepted the
  request, which is the strongest claim any configured provider supports. A
  status nothing can set is one somebody will one day read as true; it arrives
  with the webhook that would set it.
* **No `sms` or `whatsapp` channel.** Not an enum value, not an adapter, not
  a stub.

#### Row-level security

```text
notifications              SELECT  recipient_user_id = auth.uid()
                                   AND status = 'active'
notification_preferences   SELECT  user_id = auth.uid()
notification_outbox        RLS enabled, NO POLICY AT ALL
notification_deliveries    RLS enabled, NO POLICY AT ALL
```

The `status = 'active'` half is what makes a **scheduled reminder invisible to
the patient it is for** until its time comes — a predicate on the row rather
than a filter a query could forget, the same arrangement Phase 13 used for
`status <> 'draft'`.

---

### 3. Event architecture

```text
Events:              appointment_confirmed, appointment_rescheduled,
                     appointment_cancelled, appointment_reminder,
                     prescription_issued, treatment_plan_activated

Outbox mechanism:    `after` triggers on public.appointments,
                     public.prescriptions and public.treatment_plans write
                     public.notification_outbox INSIDE the domain transaction

Idempotency:         three unique keys —
                       outbox.dedupe_key
                       notifications.dedupe_key
                       notification_deliveries (notification_id, channel)
                     Keys are built from the resource id and what happened,
                     never from a clock:
                       appointment:<id>:confirmed:<startsAtEpoch>
                       appointment:<id>:rescheduled:<startsAtEpoch>
                       appointment:<id>:cancelled
                       appointment:<id>:reminder:<offset>:<startsAtEpoch>
                       prescription:<id>:issued
                       treatment_plan:<id>:activated

Worker:              features/notifications/processor.ts, service-role,
                     never throws. Two invocations:
                       - `after()` from a server action, once the response
                         has been sent (promptness)
                       - POST /api/notifications/process (reliability)
                     Claims use `for update skip locked` and a 120-second
                     lease, so two concurrent workers take disjoint batches
                     and a crashed worker's work returns.

Retry:               4 attempts over ~20 minutes for a transient failure
                     (60s, 300s, 900s), then the dead letter. A PERMANENT
                     failure is not retried at all.
```

#### Why the event is a row and not a call

`phase_15.md` sections 7, 8, 65 and 103, and example 6. Because the trigger
runs inside the domain transaction:

* a confirmed appointment that produced no event is not a state the database
  can be in, and
* an event for an appointment that was never confirmed is not either.

No application code emits anything, so no write path can forget — including
ones added later — and no provider is reachable from inside the transaction
that could fail it. Triggers rather than edits to the Phase 09–13 write
functions, so those stay byte-identical and their mirror tests still describe
what is installed.

#### A queued event is a claim about the past

Sections 116, 117, 122 and 123. The processor reads the resource's **current**
state before rendering anything:

| Situation | Outcome |
| --- | --- |
| The appointment has since been cancelled | `skipped` — section 117's own example |
| The appointment no longer starts at the instant the event encodes | `skipped/superseded` — section 118's ordering problem |
| The prescription is not `issued` | `skipped` — the draft rule, checked a second time |
| The patient has no login (a walk-in) | `skipped/no_recipient`, not retried for ever |
| The resource has gone | `skipped/resource_missing` |

---

### 4. Notification lifecycle

```text
domain change
   -> outbox row          (trigger, same transaction)
   -> claimed + leased    (for update skip locked)
   -> authoritative state re-read
   -> template rendered   (typed inputs, versioned)
   -> create_notification (idempotent; resolves recipient AND link)
   -> active              (visible) or scheduled (a reminder, invisible)
   -> enqueue delivery    (external channels only, if configured)
   -> claim, send, record
```

In-app delivery **is** the notification row; `notification_deliveries` records
external attempts only, and a check constraint says so. "The notification
exists but the email failed" is representable; "the email succeeded but there
is no notification" is not.

---

### 5. In-app behaviour

| Route | Purpose |
| --- | --- |
| `/notifications` | The centre: All / Unread, mark one read, mark all read, cursor pagination |
| `/notifications/preferences` | The category × channel grid |

* The **bell** is a server component in the authenticated header. The unread
  count is authorized server state, the count is in the link's accessible
  name, and the header still ships no JavaScript.
* **Unread is the word "Unread"**, not a tint (section 90, WCAG 1.4.1).
* The deep link is a real `<a>`, so middle-click, "open in new tab" and a
  screen reader's link list all work; a separate button marks it read, with
  the notification's title in its accessible name.
* Pagination is a **cursor** in a link, not an offset and not infinite
  scroll: a notification arriving between two page loads cannot shift a row
  across the boundary and hide it.
* Two empty states, because "you're all caught up" is right for an empty
  inbox and wrong for an empty *unread* filter.
* The page is available to **every** authenticated role. A practitioner reads
  their own schedule changes here (section 20); a receptionist and an
  administrator see the empty state, which is honest — no notification is
  written for either.

---

### 6. Appointment behaviour

| Event | When it fires | What the patient is told |
| --- | --- | --- |
| `appointment_confirmed` | On insert as `confirmed`, or any transition into it | "Your *type* with *practitioner* is confirmed for *date, time*." |
| `appointment_rescheduled` | Whenever `starts_at` changes, by any path | "…has moved to *date, time*." |
| `appointment_cancelled` | On the transition into `cancelled` | "…has been cancelled." **No reason** (section 27) |

A booking that arrives as `requested` emits nothing: a request is not an
agreement, and telling a patient their appointment is confirmed when it is not
is the false reassurance Phase 09 was built to avoid.

The confirmation key encodes the start instant, so a patient who reschedules
(which returns a confirmed appointment to `requested`) and is confirmed again
is told about the new agreement rather than deduplicated against the old one.

---

### 7. Reminder strategy

Configurable, and the schedule is the **database's**:
`notification_reminder_offsets()` returns `[1440, 120]` — 24 hours and 2 hours,
taken from `phase_15.md` section 28's own example because Punarvasu has
confirmed no reminder policy. `src/config/notifications.ts` mirrors it and a
test parses the SQL to assert they agree.

The authoritative appointment is read **twice**:

1. **When it changes.** `plan_appointment_reminders` cancels every scheduled
   reminder the appointment no longer justifies and returns the set it does.
   A cancelled or unconfirmed appointment returns an empty set, so "the old
   reminder must not fire" is not something anybody has to remember — the row
   is gone. The offsets are not a parameter, so no caller can ask for a
   reminder the clinic has not configured.
2. **When one falls due.** `release_due_reminders` requires the appointment to
   be still confirmed, still in the future, and **still starting at exactly
   the instant this reminder was computed from**. Anything else is cancelled
   rather than sent.

The second check is what makes a missed processor run harmless.

```text
confirmed              -> reminder eligible            VERIFIED LIVE
cancelled              -> old reminder cancelled       VERIFIED LIVE
rescheduled            -> old invalidated, new set     VERIFIED LIVE
completed / no-show    -> not confirmed, so refused    by the same predicate
duplicate worker run   -> one reminder                 VERIFIED LIVE
```

**Reminders require a scheduler.** An opportunistic drain runs only when
somebody happens to do something in the application, and a reminder due at
four in the morning has nobody to wake it. `POST /api/notifications/process`
is the reliable path; `.env.example` carries the Vercel Cron and pg_cron
recipes. Without one the machinery is correct and idle, and that is recorded
rather than glossed over.

---

### 8. Prescription behaviour

Only an **issued** prescription generates a notification, checked twice: the
trigger fires solely on the transition into `issued`, and the processor
re-reads the authoritative row before rendering anything.

```text
Title:  Prescription available
Body:   <practitioner> has issued a prescription from your recent
        consultation. Sign in to Punarvasu to view it.
Link:   /patient/prescriptions/<id>
Email:  subject "New update from Punarvasu"  — deliberately neutral
```

No medicine, no dose, no frequency, no item count — the context function
returns none of them, so there is nothing for a template to leak. Verified
live: a draft produced no notification; issuing produced exactly one; the body
names no medicine.

Treatment plans work the same way on **activation**, and carry no plan title:
a title is written by a clinician about one patient.

---

### 9. Preferences

Three categories × two channels, stored relationally. Absence means enabled.

| Category | In-app | Email |
| --- | --- | --- |
| Appointment updates | **Always on** | Optional |
| Appointment reminders | Optional | Optional |
| Prescriptions and treatment plans | **Always on** | Optional |

Section 22: operational information about an appointment or a prescription has
to reach the patient somewhere, and the in-app record is that somewhere — it
is the one channel that always exists and costs the patient nothing. The
control renders disabled with the reason beside it, and the database refuses
it anyway (`PV051`).

Preferences are evaluated **at claim time**, not captured at creation
(section 71), so a preference changed after the event still applies.

`set_notification_preference` takes **no user id**, so section 97's
`{"userId": "another-user"}` has nowhere to arrive; section 98's staff
accounts are scoped by the same mechanism.

**No marketing exists.** No promotional category, no campaign, no way to
create one without a migration — and the preferences page says so rather than
leaving a patient to infer it from the absence of a checkbox. Signing in has
never been treated as consent for anything.

---

### 10. Channels

```text
In-app:     FUNCTIONAL. The notification row is the delivery.
Email:      IMPLEMENTED, NOT CONFIGURED. The adapter exists; no credentials
            are set in this deployment, so `resolveChannels()` returns it not
            at all — no delivery rows are created, nothing accumulates in a
            queue that will never drain, and the preferences screen says email
            is not switched on.
SMS:        NOT IMPLEMENTED. No enum value, no adapter, no stub.
WhatsApp:   NOT IMPLEMENTED. Likewise.
Provider:   EmailJS, the provider this project already uses for authentication
            email (Phase 06). Behind `NotificationChannelAdapter`.
```

**No email has been sent from this application.** The adapter's code path is
exercised by tests against a stub `fetch` and has not been run against
EmailJS. That is stated rather than implied.

Phase 06's trade-offs still apply and are the reason **Custom SMTP on the
clinic's own domain remains the better answer before real patients rely on
this**: EmailJS relays through a connected mailbox, so deliverability, volume
and the visible sender are that mailbox's. Switching is a new module beside
`emailjs.ts` and one line in `resolveChannels()` — which is what the adapter
interface is for.

---

### 11. Retry and idempotency

| Protection against | Mechanism | Verified |
| --- | --- | --- |
| A duplicate domain event | `notification_outbox.dedupe_key` unique; `on conflict do nothing` | live — repeating the same change emitted no second event |
| A worker retry | `create_notification` idempotent on the notification key | live — a second worker run created no duplicate |
| A browser refresh / repeated request | the same key | live |
| A process restart | the lease expires and the row returns to the queue | by construction |
| Two concurrent workers | `for update skip locked` | by construction |
| A duplicate delivery attempt | unique `(notification_id, channel)` | structural |
| A provider webhook retry | not applicable — no webhooks | — |

**Duplicate logical notifications are impossible.** Duplicate external
messages are *bounded* rather than impossible, and that is stated honestly:
the claim pushes the retry time out **before** the send, so a process killed
after the provider accepted a message will retry it. No configured provider
offers request idempotency — EmailJS does not — so email is at-least-once.
`NotificationMessage.idempotencyKey` is carried for the provider that one day
does.

---

### 12. Webhooks

**Not implemented.** `phase_15.md` section 51 is conditional — "if the
provider supports delivery webhooks" — and EmailJS does not. Building a
webhook endpoint no provider will ever call would be an unauthenticated
public surface with no purpose.

What is in place for the day one arrives:
`notification_deliveries.provider_message_id` to resolve against, and the
deliberate **absence** of a `delivered` status, which arrives in the same
change as the webhook that would set it.

---

### 13. Authorization and RLS

```text
src/proxy.ts                        optimistic redirect; /notifications added
  v
(app)/layout.tsx                    requireUser()
  v
(app)/notifications/layout.tsx      requirePermission("notifications.read.self")
  v
page                                requirePermission(...)
  v
server action                       can(user.role, "notifications.write.self")
  v
definer function                    auth.uid(), in the statement itself
  v
RLS                                 the last word
```

Two permissions, and they are the first in the matrix held by **every** role:
a notification is a message addressed to one account, not clinical data and
not somebody else's data. Neither confers any ability to send.

`/notifications` is deliberately **not** in `PROTECTED_AREAS`: that table also
drives the area navigation, and an entry would put a second link to the thing
the bell already points at in the same header. `/account` and `/forbidden` are
absent for the same reason. The permission is still checked, in a layout, on
the server, on every request.

---

### 14. Defects found and fixed

All three were found by verification. None was visible to 3,382 passing tests,
to ESLint, to the type checker or to review.

#### 1. Every authenticated user could call the processor. *(serious)*

The migration protects the processor's interface with

```sql
revoke all on function public.create_notification(...) from public;
grant execute on function public.create_notification(...) to service_role;
```

which is the pattern every phase since 08 has used, and which is **not
sufficient**. Supabase's project bootstrap carries `alter default privileges
... grant execute on functions to anon, authenticated, service_role`, so a
newly created function is granted to those roles **by name** at creation time.
`revoke ... from public` removes only the PUBLIC grant.

So any signed-in patient could call `create_notification`,
`claim_notification_outbox`, `claim_notification_deliveries`,
`release_due_reminders`, `plan_appointment_reminders`,
`enqueue_notification_delivery`, `record_notification_delivery_result`, the
three context functions and the rest. That is a real authorization hole: with
a resource id they did not own, a patient could have created a notification
for another account.

**Every earlier phase happened to survive this** because each of its functions
calls an authorization gate — `assert_care_practitioner()`,
`assert_appointment_manager()` — as its first statement, so the `42501` those
phases' live checks observed was raised by the **function body**, not by the
privilege system. Phase 15's processor functions have no such gate: they are
meant to be unreachable, so they were written to trust the grant.

It was found by running this phase's live verification, and by nothing else.
The structural test asserts the migration *says* `grant execute ... to
service_role`, which it does.

Fixed in two layers, forward-only:

* `20260926130000` revokes every processor function `from public, anon,
  authenticated` — the named roles, which is what actually removes it — and
  adds `assert_notification_worker()` to fourteen function bodies;
* `20260926140000` gives the same gate to `notification_preference_enabled`,
  which the first fix had left protected by its grant alone because it was
  `language sql`. It takes another account's id, which is exactly the shape
  that deserves the strongest treatment, and "it was inconvenient to rewrite"
  is not a security argument.

The gate is a **deny-list of `anon` and `authenticated`**, not an allow-list
of `service_role`: the set of legitimate non-client contexts is open — a
migration, `psql`, an in-database `pg_cron` job, a future worker with its own
role — and an allow-list would refuse all of them the first time one appeared.

`emit_notification_event` is the one function left ungated, and that is a
genuine exception: the three domain triggers call it as whichever role
performed the domain write, so a gate there would make a patient's own booking
fail. Its grant is revoked, which is the whole of what it needs.

**The structural test now reads all three migrations**, because the first
one's grants are no longer the whole truth and a reader who checked only it
would conclude the wrong thing.

#### 2. The dispatch call could have turned a committed booking into an error.

`scheduleNotificationDispatch()` is the one line a domain action adds. The
first version called `after()` directly — and **`after()` throws when there is
no request scope**. A full test run turned 40 existing appointment, doctor,
prescription and treatment-plan action tests red at once.

In production that throw lands *synchronously inside the domain action*, after
the database write has committed, and turns a confirmed appointment into an
error message on the receptionist's screen. It is precisely the coupling
section 103 and example 6 forbid, arriving through the line that was supposed
to prevent it.

The fix guards the scheduling call as well as the callback, and
`dispatch.test.ts` asserts both directions. The lesson generalises: **a "fire
and forget" call is still a call, and it can still throw.**

#### 3. A privacy scanner that was matching nothing. *(in the tests)*

`templates.test.ts` scans every rendered message for 26 clinical words. The
first version built the word boundary with a plain template literal:

```ts
new RegExp(`\b${word}\b`, "i")   //  \b is a BACKSPACE here, not a boundary
```

It compiled, it ran, it matched nothing, and **every privacy assertion in the
file passed vacuously**.

This is the same defect class Phase 06 found in `lib/auth/redirect.ts` and
Phase 14 found in two security assertions — arriving by a third route: not a
formatter rewriting an escape, but a template literal consuming one.
`source-hygiene.test.ts` could not catch it, because the source bytes were
correct; the corruption happened at parse time.

Fixed with `String.raw`, and guarded by three tests asserting the scanner
**finds a word it is meant to find**, ignores substrings, and matches across
whitespace. A scanner without a self-test is a scanner that silently stops
scanning.

#### Three harness bugs, recorded because a report listing only what passed is not evidence

* **"the trigger emitted no event" — it had.** The harness read
  `notification_outbox` with the service-role client, which has no grant on it
  **by design**. The events were there; the harness had to claim them through
  `claim_notification_outbox`, which is the only path that exists. The
  database was right and the guarantee was stronger than the harness assumed.
* **"an in-app delivery row is refused with `23514`" — it was refused with
  `42501`.** Both layers refuse; the missing grant refuses first, so the check
  constraint is never reached. The reachable assertion is
  `enqueue_notification_delivery` raising `PV054`, and both are now asserted.
* **A prescription item was rejected for having no medicine name.** The
  harness sent `medicine_name`; `save_prescription_draft` reads `medicineName`
  from the JSON. The database was right.

#### And the stale-server trap, for the sixth phase running

Phases 06, 07, 08, 11 and 12 each recorded it. It struck again: an end-to-end
script kept pointing at a server started before two migrations were applied,
and passed. Re-run explicitly against a fresh build on a fresh port, it passed
again — so the result stood — but the run that "proved" it had proved nothing
about the current code.

---

### 15. Verification

Executed on 2026-09-19:

```text
Lint:       PASS — npx eslint . --max-warnings=0, 0 problems
Typecheck:  PASS — npm run typecheck, exit 0
Formatting: PASS — npx prettier --check .
Tests:      PASS — 3,388 tests, 107 files (was 3,049 / 95)
Build:      PASS — npx next build, 37 static pages, no warnings
```

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 3,388 / 107 files** |
| Production build | `npx next build` | **PASS** — all 30 public pages still static; the 3 new routes dynamic |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 178 files, 0 findings |
| Migrations | `supabase db push` | **PASS** — all three applied to the linked project |
| **Live database** | 115 checks, real per-role JWTs | **PASS — 115/115** |
| **Live endpoint auth** | unauthenticated, wrong secret, correct secret | **PASS — 401, 401, 200** |
| **Live end-to-end** | 19 appointment-lifecycle + 9 prescription checks, real worker, production build | **PASS — 28/28** |
| Live browser (rendered, measured) | — | **NOT RUN** — see *Known issues* |
| E2E | — | **NOT RUN** — no maintained E2E tool (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

#### Live database — 115 checks, real per-role JWTs

| Area | Result |
| --- | --- |
| The reminder schedule, the mandatory rule and the link builder match the mirror | PASS (4) |
| `anon` reads no notification table and can call nothing | PASS (6) |
| **Every role reads nothing from either queue** | PASS (8) |
| **Every role is refused every one of ten processor functions** (`42501`) | PASS (40) |
| **Creating a confirmed appointment emitted exactly one event, inside the transaction** | PASS (3) |
| A reschedule emitted a distinct event keyed on the new time | PASS |
| **Repeating the same change emitted no second event** | PASS |
| A cancellation emitted a cancelled event with no discriminator | PASS (2) |
| `create_notification` resolved the recipient and the link from the resource | PASS (3) |
| **Calling it twice returned the same notification and created no second row** | PASS (2) |
| The patient reads their own; **receptionist, doctor and admin read none** | PASS (4) |
| **A scheduled reminder is invisible to its own recipient** | PASS |
| **No role can insert, update or delete a notification** | PASS (12) |
| The recipient can mark their own read; marking it twice is a no-op | PASS (3) |
| **Every other role marking it affects nothing** | PASS (3) |
| A patient can switch an optional channel off | PASS |
| **A mandatory in-app channel cannot be switched off** (`PV051`) | PASS |
| A patient reads only their own preferences; a doctor reads none and changes none | PASS (3) |
| A confirmed future appointment plans reminders, all in the future | PASS (2) |
| **A cancelled appointment plans none, and its scheduled reminder was cancelled** | PASS (2) |
| **Even the service role cannot store an absolute URL or a traversal path as a link** | PASS (2) |
| **Even the service role cannot write the delivery table**; the function refuses in-app (`PV054`) | PASS (2) |
| Regressions: receptionist reads no clinical record; patient reads own appointments; doctor reads own prescriptions | PASS (3) |
| The fixture was removed | PASS (2) |

#### Live end-to-end — 28 checks, real worker, production build

The Definition of Done, driven for real:

| Area | Result |
| --- | --- |
| Appointment confirmed → the worker processed it → **the patient sees exactly one notification** | PASS (3) |
| Its title, body, link and absence of clinical content | PASS (4) |
| **Two reminders scheduled, invisible to the patient, each timed from the appointment** | PASS (4) |
| **A second worker run creates no duplicate** | PASS |
| Reschedule → **old reminders cancelled, new ones scheduled from the new start**, patient told | PASS (4) |
| Cancel → **no reminder remains scheduled**, patient told | PASS (2) |
| No delivery row exists, because email is unconfigured | PASS |
| **A draft prescription produced no notification** | PASS |
| The doctor issued it → the worker processed it → **the patient sees one notification** | PASS (3) |
| It says a prescription is available and **names no medicine, dose or quantity** | PASS (3) |
| It links to the patient's own prescription; a second run creates no duplicate | PASS (2) |
| The endpoint refuses an unauthenticated request and a wrong secret | PASS (2) |
| A stale event for a deleted resource is **skipped**, not failed | PASS |

---

### 16. Acceptance criteria

#### Architecture

| Criterion | Result |
| --- | --- |
| Notification system is event-driven | PASS — triggers write an outbox inside the domain transaction |
| Notifications do not own domain state | PASS — no insert, update or delete against any domain table; asserted structurally |
| Domain events are typed | PASS — a database enum and a discriminated union, not strings |
| Event processing is idempotent | PASS — three unique keys; verified live |
| Provider integrations are abstracted | PASS — `NotificationChannelAdapter`; the processor knows no provider |
| Notification delivery is decoupled from critical domain mutations | PASS — the outbox commits with the domain write; the worker runs after the response |

#### In-app

| Criterion | Result |
| --- | --- |
| Authenticated users can view their notifications | PASS — live and end to end |
| Users cannot view another user's notifications | PASS — live, all four roles |
| Read/unread state works | PASS — live |
| Notification center is responsive | PASS by construction — cards at every width, no fixed pixel widths. **Not pixel-verified**; see *Known issues* |
| Notification links are authorization-safe | PASS — derived, constrained, and the destination authorizes independently |

#### Appointments

| Criterion | Result |
| --- | --- |
| Confirmation notification works | PASS — live end to end |
| Reschedule notification works | PASS — live end to end |
| Cancellation notification works | PASS — live end to end |
| Reminder workflow works if enabled | PASS — scheduled live; **firing requires a scheduler**, which is documented |
| Cancelled appointments do not trigger old reminders | PASS — live |
| Rescheduled appointments invalidate old reminders | PASS — live |

#### Prescriptions

| Criterion | Result |
| --- | --- |
| Issued prescription can generate notification | PASS — live end to end |
| Draft prescription does not generate a final-prescription notification | PASS — live, and checked twice in the design |
| Notification does not expose full prescription details | PASS — the context function returns none; verified live |

#### Treatment plans / documents

| Criterion | Result |
| --- | --- |
| Notifications can be extended to these resources where required | PASS — treatment plans are implemented; documents are deliberately deferred, see *Deferred* |
| Sensitive content is not unnecessarily sent through external channels | PASS — no plan title, no document title; there is no column for either |

#### Preferences

| Criterion | Result |
| --- | --- |
| User preferences are scoped to the authenticated user | PASS — no user id parameter; verified live |
| Optional notifications respect preferences | PASS — evaluated at claim time |
| Mandatory transactional communications follow defined policy | PASS — defined in `config/notifications.ts`, enforced in the database, explained on the page |

#### External delivery

| Criterion | Result |
| --- | --- |
| Email adapter works if configured | PARTIAL, honestly — the adapter is implemented and unit-tested against a stub `fetch`; **no provider is configured and no email has been sent** |
| SMS/WhatsApp only exists if actually configured | PASS — neither exists at all |
| Provider credentials remain server-side | PASS — `server-only`; bundle scan clean |
| Provider failures are handled | PASS — timeout, rate limit, 5xx, auth failure, invalid recipient, transport failure, each classified |
| Retry strategy exists for transient failures | PASS — and permanent failures are not retried |
| Duplicate delivery is prevented | PARTIAL, honestly — duplicate *logical* notifications are impossible; external email is at-least-once, because no configured provider offers request idempotency |

#### Webhooks

| Criterion | Result |
| --- | --- |
| Provider signatures are verified where supported | NOT APPLICABLE — no configured provider supports delivery webhooks |
| Webhooks are idempotent | NOT APPLICABLE — none implemented |
| Replayed events do not corrupt delivery state | NOT APPLICABLE — none implemented |

#### Privacy

| Criterion | Result |
| --- | --- |
| Clinical details are minimized | PASS — structurally: no column, and the template inputs cannot reach one |
| No diagnosis in generic notification previews | PASS — asserted over every template |
| No prescription details in SMS by default | PASS — there is no SMS, and none in any message |
| No document content in notifications by default | PASS — no document notification exists, and no column for one |
| Sensitive data is not logged | PASS — asserted over every `logger.*` call in the feature and behaviourally |
| Notification links do not bypass authorization | PASS |

#### Security

| Criterion | Result |
| --- | --- |
| Notification IDOR tests pass | PASS — live, all four roles |
| Preference IDOR tests pass | PASS — live |
| Recipient manipulation is blocked | PASS — there is no recipient parameter to manipulate, anywhere |
| Arbitrary notification sending is blocked | PASS — **and this is where the grant defect was found and fixed**; verified live for all four roles across ten functions |
| Provider credentials are protected | PASS |
| RLS is enabled and tested | PASS — 115 live checks |

#### Engineering

| Criterion | Result |
| --- | --- |
| Existing authorization is reused | PASS — no second mechanism |
| Existing appointment system is reused | PASS — and no appointment is written |
| Existing prescription system is reused | PASS — read-only, through a minimal context function |
| Existing patient identity is reused | PASS — `patients.profile_id` |
| TypeScript remains strict | PASS — no `any` added |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

```text
Appointment -> confirmed -> notification event -> patient notification
Prescription -> issued   -> notification event -> patient notified
```

Both driven end to end against a production build and the live database.

```text
Domain State  ≠  Notification State  ≠  Delivery State
```

Three tables, three lifecycles, and a check constraint keeping in-app delivery
out of the delivery table.

```text
Patient A  ✕  Patient B notifications      — verified live
Patient A  ✕  Patient B notification links — the destination authorizes
Unauthorized user ✕ notification resource  — verified live, four roles
Browser    ✕  arbitrary recipient          — no parameter exists
Notification ✕ clinical decision           — nothing here writes a domain row
```

The system remains reliable when a provider fails: the domain transaction
committed before the worker existed, and a provider failure is retried,
bounded, and then recorded as a dead letter.

---

### 17. Deferred

Intentionally not built:

* **~~Staff notifications.~~** Superseded for the practitioner by section 20.
  **Receptionist and administrator notifications remain deferred**, for the
  reason this entry originally gave: section 56 asks for useful workflows
  rather than every database event, and no front-desk workflow has been
  designed. The architecture is now demonstrably ready — a second audience
  exists, costs one enum value and one branch, and changes no trigger.
* **Document notifications.** Section 35 makes them conditional, and Phase 14
  emits no document event at all — inventing one would be the fake event
  section 5 forbids. Section 57 lists "patient submitted document" among a
  doctor's candidates, so this is the one item of section 57 that section 20
  did **not** implement. Adding it is a trigger on `patient_documents`, an
  enum value in a migration of its own (the `alter type ... add value` rule),
  a subject type, a link branch and a template.
* **Webhooks.** No configured provider supports them. See section 12.
* **SMS and WhatsApp.** No provider, and section 101 requires capability,
  consent, sender registration and template approval to be settled first.
* **Quiet hours** (section 60). Designing them properly means deciding which
  messages may be delayed and which may not, and "do not silently delay
  critical operational messages" is the hard part. Nobody has asked for them.
* **Batching** (section 62) and **priority** (section 59). Both are "potential"
  in the specification; neither has a workflow, and a priority column nothing
  sets is a field somebody will later set arbitrarily.
* **Realtime** (section 64). The bell is recomputed per request on a
  `force-dynamic` shell, which is adequate; realtime would add a subscription
  to authorize and scope for no capability.
* **An operations dashboard** (section 106). Section 106 itself says not to
  build one unless required. The counts the worker returns are the minimal
  operational view.
* **Retention and automatic deletion** (section 96). No policy is defined, so
  nothing is deleted automatically.
* **Marketing, campaigns, segmentation, chat** — explicitly out of scope
  (section 139), and structurally impossible to add without a migration.
* **Moving `ProfileSection`/`ProfileFieldList`/`ProfileField` to
  `components/shared/`.** Eight areas depend on them; still its own change.

---

### 18. Known issues

1. **CLOSED on 2026-09-23 for the notification surfaces, both audiences.**

   Every notification surface has now been measured in real Chrome 150 over
   the DevTools Protocol against a production build, signed in through the
   real login form — `/doctor`, `/notifications` and
   `/notifications/preferences` as a doctor, and `/patient`,
   `/notifications` and `/notifications/preferences` as a patient, because the
   preference grid and the empty-state wording differ by audience and a pass on
   one proves nothing about the other.

   ```text
   Widths      320, 375, 390, 430, 768, 1024, 1280, 1440
   axe         wcag2a + wcag2aa + wcag21a + wcag21aa + best-practice
   Result      0 violations, 0 contrast failures (lowest measured 8.13:1),
               0 horizontal overflow, every tab stop named, visibly focused
               and inside the viewport — on all six route/role combinations
   ```

   It found two real defects, both now fixed and both invisible to the 4,500+
   tests, to ESLint and to review: a **template rendering "A Initial
   consultation"**, because an article cannot agree with interpolated data;
   and **four area navigations hiding their own links** behind
   `overflow-x-auto`, worst on the patient area where four of six links were
   off-screen at 320px. Sections 20.7 and 20.9 describe both, and three
   harness false positives that were chased down rather than reported.

   **Still not measured, and this is what remains of the original gap:** dark
   mode, `prefers-reduced-motion`, a real screen reader, and Lighthouse — on
   any route. The original wording is kept below because that general gap is
   real and applies to the whole product, not only to this phase.

   > Phases 03–09, 11, 12 and 14 drove the production build through Chrome
   > over the DevTools Protocol to measure computed contrast, horizontal
   > overflow, focus order and keyboard operation. That was not done here. The
   > component suite's axe sweeps run in jsdom, which has no layout engine and
   > therefore no computed colours. Phase 08 found a 35px overflow, Phase 09 a
   > 3.89:1 contrast failure and Phase 11 a duplicate landmark that nothing
   > else could see.

   The lesson worth carrying: the first pass's overflow table was **correct and
   still missed the nav defect**, because it measured the *document* and the
   nav was absorbing the overflow internally. "No horizontal overflow" and "no
   content hidden" are two different questions, and only the second one finds a
   scroll container quietly eating its own links.

2. **Reminders do not fire without a scheduler.** The machinery is complete
   and verified — reminders are planned, invalidated and re-planned correctly
   — but nothing wakes them. `POST /api/notifications/process` must be called
   on a schedule; `.env.example` carries the Vercel Cron and pg_cron recipes.
   **No scheduler is configured for this project**, so today reminders are
   scheduled and never released.

3. **Email is not configured and no email has been sent from this
   application.** The adapter is implemented and unit-tested against a stub
   `fetch`. The first real send will be the first real test of the EmailJS
   template's parameter names — the failure Phase 06 spent a debugging session
   on. Configure and send one deliberately before relying on it.

4. **External email is at-least-once.** A process killed after the provider
   accepted a message will retry it. No configured provider offers request
   idempotency. Duplicate *logical* notifications remain impossible.

5. **The permission-grant lesson applies beyond this phase.** `revoke ... from
   public` does not remove Supabase's default named grants. Every phase since
   08 has written that pattern and survived only because its functions carry
   an internal gate. **Any future `security definer` function that relies on
   its grant alone is exposed**, and the fix is `from public, anon,
   authenticated` plus a gate in the body. Worth auditing the earlier phases'
   functions that *return data* rather than raising early.

6. **The dev database now holds Phase 15 fixture residue.** One prescription
   moved from `draft` to `cancelled` during verification (a state the database
   already contained), and the outbox holds processed and skipped rows for
   deleted fixtures. No notification, appointment or delivery row remains.

7. **`src/types/database.ts` is still hand-written**, deliberately.
   `npm run db:types` would overwrite it with generated output whose `Insert`
   and `Update` shapes are permissive; the hand-written file types them
   `never`, which makes a client table write a compile error. Every table and
   function it declares was exercised live.

8. **The four Phase 08 test accounts remain on the development project.**
   Shared, well-known credentials, including an administrator. **Delete them
   before this database takes real patient data.**

9. **No E2E tool, no manual screen-reader pass, no Lighthouse run.** Unchanged
   since Phase 01/02. The 146 live checks are a script written for this phase,
   not a maintained suite.

10. **Still no CSP.** Unchanged since Phase 02.

11. **Legal pages still do not exist.** Required before the clinic handles
    real records through this website — and now the clinic also *sends*
    messages, which a privacy policy would have to describe.

12. **~~`20260930120000_doctor_notifications.sql` is not applied.~~ Applied
    2026-09-23** and verified — see section 20.7. The reason it was urgent
    still holds for **any other environment**: the worker calls
    `create_notification` with `p_audience`, so against a database without this
    migration the function does not exist and **every appointment event fails
    to notify** (domain writes are unaffected — that is the outbox design).
    Push it with the code, not after it, wherever this is deployed next.

13. **Applying DDL requires a PostgREST schema reload.** `notify pgrst,
    'reload schema'` was issued after this migration. Supabase's
    `pgrst_ddl_watch` event trigger normally does it automatically and both
    watchers are present on this project, but a stale cache makes a new RPC
    signature return "function not found" — which would look exactly like a
    migration that had not been applied. Worth doing explicitly after any
    migration that changes a function signature.

---

### 20. Practitioner notifications (2026-09-23)

The one deferred item in section 17 that had a designed workflow behind it.
`phase_15.md` section 57 names three candidate doctor notifications — an
upcoming appointment, an appointment rescheduled, and a patient submitting a
document. The first two are changes to a practitioner's own day made **by
somebody else**: the front desk books, moves or cancels, and without this the
practitioner finds out by noticing. Those are built. The third is not, because
Phase 14 emits no document event and inventing one would be the fake event
section 5 forbids.

#### 20.1 What a practitioner now gets

| Event | What they are told |
| --- | --- |
| `appointment_confirmed` | "New appointment in your day" — *A \<type\> is confirmed for \<date, time\>. Open it to see who you are seeing.* |
| `appointment_rescheduled` | "An appointment has moved" — *A \<type\> in your diary has moved to \<date, time\>.* |
| `appointment_cancelled` | "An appointment has been cancelled" — *A \<type\> on \<date, time\> is no longer in your diary.* |

Reached three ways, all of which already existed: the **bell** in the
authenticated header (its count was always `recipient_user_id = auth.uid()`,
so it started counting these with no change at all), the **notification
centre** at `/notifications`, and a new **Recent updates** panel at the foot of
`/doctor`.

#### 20.2 A practitioner's notification names no patient

Sections 36, 37, 57 and 81, and the strongest single decision in this change.

A practitioner is authorized to know who is on their own list. A notification
is the one thing this product sends that reaches a lock screen, a notification
shade or a phone somebody else is holding — so a patient's name there is a
disclosure the clinic did not have to make.

`PractitionerAppointmentTemplateData` therefore has **two fields**: the
consultation type and the start instant. No patient name, no preferred name, no
phone, no patient id — and no practitioner name either, because the reader is
the practitioner. It is a separate interface and a separate renderer from the
patient's rather than one renderer with a flag, so passing a patient's data to
a practitioner's template is a **compile error** rather than something review
has to catch.

The message says the day changed. The diary behind the link says who.

#### 20.3 One domain fact, two audiences

**No trigger changed, and no second outbox row is written.** An appointment
being confirmed is one thing that happened, and it was already recorded inside
the domain transaction; *who should be told* is a delivery concern the
processor decides afterwards. So `notification_outbox` stays a log of what
happened to the clinic rather than a log of messages somebody intends to send,
and the three Phase 15 emit triggers are byte-identical.

```text
appointment confirmed
   -> ONE outbox row            (unchanged trigger, same transaction)
   -> claimed once
   -> authoritative state read once
        |-> patient notification       appointment:<id>:confirmed:<epoch>
        `-> practitioner notification  appointment:<id>:confirmed_practitioner:<epoch>
```

Each audience has its own idempotency key, so processing the event twice still
produces exactly one of each and neither dedupes the other. The keys satisfy
the existing `dedupe_key` shape constraint unchanged, and the practitioner's
epoch is derived from the **authoritative** appointment rather than parsed back
out of the event's own key.

A walk-in with no login no longer short-circuits the event: the patient's
`PV050` is recorded and the practitioner is still told, because their diary
still changed. That is a real behaviour change and it has its own test.

#### 20.4 Still no recipient parameter

`create_notification` gained exactly one parameter: `p_audience`, which takes
`patient` or `practitioner`. **Neither value names anybody.** The account is
still resolved from the resource —`patients.profile_id` for a patient,
`practitioners.profile_id` for a practitioner — and the deep link is still
derived, now from the audience as well. There is no `recipientUserId`, no
`recipientEmail`, no `recipientPhone` and no `to` in any signature, any schema
or any form, exactly as before.

Sections 54, 72, 73, 110 and examples 2 and 9 hold structurally, and the
existing scan over every function's parameter list still asserts it.

#### 20.5 What a practitioner is *not* sent, and why

| Not sent | Reason |
| --- | --- |
| Reminders | Sections 56 and 61. Somebody with eight appointments does not want sixteen reminders about a day they are already looking at — the day view *is* the reminder. `plan_appointment_reminders` is untouched and still plans for the patient alone |
| `prescription_issued` | They wrote it. Telling somebody they have issued the prescription they just issued is the noise section 56 exists to prevent — so there is no recipient branch, no route, and `notification_link_path` returns `null` |
| `treatment_plan_activated` | The same |
| Anything for a receptionist or an administrator | No workflow has been designed. `notification_audience` has **two** values, not four, because an enum value nothing can produce is the pretence section 14 forbids |

#### 20.6 Preferences, and the words

No new category. A practitioner's schedule change is the same preference unit
as a patient's — `appointment_updates` — and mandatory in-app for the same
reason: it is operational information the clinic has a duty to put somewhere
the person can find it (section 22). Section 98's requirement that staff
preferences be scoped to the authenticated staff account is met by the
mechanism that already scopes a patient's: `set_notification_preference` takes
no user id.

What did change is **which controls a practitioner is shown**. The grid is now
the audience's rather than the enum's, so a practitioner sees the one category
they receive instead of three, two of which would be controls over messages
nobody will ever send them. That is the same honesty rule the unconfigured
email channel follows — disabled, and saying why — applied to categories.

The copy that would be *wrong* for them is overridden and nothing else is:
"part of your care" is written for the person being cared for. Everything
shared — the filters, the read controls, the error copy — stays one set of
words, because it means one thing.

#### 20.7 Files, and what was verified

**Created**

```text
supabase/migrations/20260930120000_doctor_notifications.sql
src/components/notifications/recent-notifications.tsx
```

**Modified**

```text
src/config/notifications.ts             audience categories, role mapping, copy
src/config/notifications.test.ts
src/features/notifications/types.ts     NotificationAudience
src/features/notifications/links.ts     the audience branch
src/features/notifications/links.test.ts   now reads the CURRENT migration
src/features/notifications/templates.ts    the practitioner's vocabulary
src/features/notifications/templates.test.ts
src/features/notifications/errors.ts       PV056
src/features/notifications/errors.test.ts  now reads all four migrations
src/features/notifications/processor.ts    the fan-out; the epoch fix
src/features/notifications/queries.ts      preferences scoped by audience
src/features/notifications/content.ts      the practitioner's copy
src/components/notifications/notification-list.tsx
src/components/notifications/notification-preferences-form.tsx
src/components/patient/recent-updates.tsx  now a wrapper; same props, same tests
src/app/(app)/notifications/page.tsx
src/app/(app)/notifications/preferences/page.tsx
src/app/(app)/doctor/page.tsx              the Recent updates panel
src/features/doctor/content.ts             panel copy; the scope notice corrected
src/features/clinical/content.ts           the consultation scope notice corrected
src/types/database.ts
tests/components/notifications.test.tsx
tests/integration/notification-processor.test.ts
tests/integration/notification-security.test.ts
```

**No dependency added.**

Two pieces of product copy said Punarvasu sent nobody anything. Both were true
when they were written and stopped being true when Phase 15 shipped, and a
practitioner deciding whether to telephone somebody needs them to be current:

* `DOCTOR_SCOPE_NOTICE` — was *"Reminders and notifications are still being
  built… Punarvasu does not yet send a patient any reminder or notification"*.
  Now names what actually reaches whom, and keeps the one thing that genuinely
  does not work: **reminders are not being sent**, because no scheduler is
  configured (known issue 2).
* `CONSULTATION_COPY.scopeNotice` — was *"The patient is not told
  automatically"*. Now says the patient is told when a prescription is issued
  or a plan activated, that notes and documents reach them not at all, and that
  reminders do not fire.

##### Verification

```text
Lint:       PASS — npx eslint . --max-warnings=0, 0 problems
Typecheck:  PASS — npm run typecheck, exit 0
Formatting: PASS for every file touched — npx prettier --write, then --check
Tests:      PASS — 4,530 of 4,531; the one failure is PRE-EXISTING and
            unrelated (see below). 50 tests added, four of them the guard on
            the epoch defect found by the live worker run.
Build:      PASS — npx next build, exit 0
Bundle:     PASS — node scripts/scan-client-bundle.mjs, 182 files, 0 findings
Migration:  APPLIED to the live project, 2026-09-23
Live:       PASS — 19 checks against the linked project (below)
Browser:    PASS — measured in Chrome over the DevTools Protocol against a
            production build; known issue 1 is CLOSED for these three routes
```

##### Live verification, 2026-09-23

Applied with `psql` (the Supabase CLI was not installed in that session), after
a **dry run inside a transaction that was rolled back** to prove it applied
cleanly first. The schema change and its
`supabase_migrations.schema_migrations` row were inserted in one transaction,
so they commit together or not at all.

Every check that had to *write* ran inside a transaction that was **rolled
back**: the live project holds no fixture residue from this run, and
`notifications` still holds the same 4 rows it held before.

| Check | Result |
| --- | --- |
| `notification_audience` exists with exactly `patient`, `practitioner` | PASS |
| `notifications.audience` is `not null default 'patient'` | PASS |
| **`audience` is granted to no client role** — `title` has `authenticated` SELECT, `audience` has none | PASS |
| All three functions installed with their new three- and twelve-argument signatures | PASS |
| `create_notification` executable by `service_role` **and nobody else** | PASS |
| `notification_recipient_for_resource` executable by `service_role` **and nobody else** | PASS |
| `notification_link_path` executable by `authenticated` (it is a configuration mirror) | PASS |
| **`authenticated` calling `create_notification`** | **PASS — `42501`, from the privilege system itself** |
| **`authenticated` calling `notification_recipient_for_resource`** | **PASS — `42501`** |
| **`anon` calling `notification_link_path`** | **PASS — `42501`** (Phase 19's sweep, same run) |
| The link builder returns `/patient/appointments/<id>` and `/doctor/appointments/<id>` | PASS |
| It returns `null` for a practitioner's prescription and plan | PASS |
| The doctor path satisfies the column's own check-constraint regex | PASS |
| **The two audiences resolve to two different accounts**, against a real confirmed appointment | PASS |
| The practitioner account really is that appointment's `practitioners.profile_id` | PASS |
| **One appointment produced two notifications**, distinct rows, distinct keys, distinct links, correct `audience` on each | PASS |
| **The practitioner's message contains no patient name** — checked against the real patient's `full_name` in the database, not a fixture | PASS |
| **Idempotency** — repeating each key returned the same row id and created no second row (2 before, 2 after) | PASS |
| **Row-level isolation, three directions** — the patient sees their own and not the practitioner's; the practitioner sees their own and not the patient's; an unrelated third account sees neither | PASS |
| PostgREST resolves the new signature (`notify pgrst, 'reload schema'` issued after the DDL) | PASS |
| **`anon` calling `create_notification` over HTTP** | **PASS — `404`.** PostgREST does not expose a function the role cannot execute, so it is not merely forbidden, it is absent |

The three `42501` refusals came from the **privilege system**, not from a
function body — which is the layer that was missing when section 14's grants
defect was found, and the reason this migration re-issues its revokes after
recreating each function.

##### The worker, driven end to end — and the defect it found

Run on 2026-09-23 against a **fresh production build** on its own port, with
`NOTIFICATIONS_WORKER_SECRET` supplied through the environment rather than
written into `.env`, driving `POST /api/notifications/process` — the real
route, the real `runNotificationWorker()`, the real database. Every fixture row
was deleted afterwards.

**The first run failed, and the failure was real.**

```text
{"outboxClaimed":1,"outboxProcessed":0,"outboxSkipped":1,...}
notification.event_skipped  reason: superseded
```

An appointment was confirmed, the trigger wrote its outbox row inside the
transaction, and the worker **silently declined to tell anybody**. Not an
error, not a retry — a skip, which is a decision the processor makes on
purpose and logs at `info`.

The cause: every dedupe key on the database side is built with
`extract(epoch from starts_at)::bigint`, and a `numeric -> bigint` cast in
PostgreSQL **rounds half away from zero**. `processor.ts` compared it against
`Math.floor(startsAt.getTime() / 1000)`, which **truncates**. The two agree
only while `starts_at` lands on a whole second.

Nothing requires it to. `book_appointment` stores `p_starts_at` unaltered,
there is no constraint on the column, and the live database already held rows
at `…:48.675+00`. For **any appointment whose fractional second is .5 or
more**, the confirmation and reschedule events were skipped as `superseded`
and the patient was never told.

| | |
| --- | --- |
| Introduced by | **Phase 15**, not this change. The comparison is the original supersession check; the practitioner key inherited the same `Math.floor` |
| Why no test saw it | Every fixture in the suite used a whole-second time, where `round` and `floor` agree |
| Why the original live run did not see it | Its fixtures happened to fall below `.5`. The other appointment on this database from a parallel run sits at `.183709` — `round == floor`, so it passed |
| Fixed by | `appointmentEpoch()` in `processor.ts`, using `Math.round` to match the database, which is authoritative because it writes the keys |
| Guarded by | Four tests using a `.627` start. Three of them go **red** against the old `Math.floor`, and the fourth asserts a genuinely superseded event is still refused, so the fix cannot be loosened into uselessness |

Re-run against a rebuilt server with a deliberately `.627`-second start — the
exact shape that had been silently dropped:

| Step | Worker result | State afterwards |
| --- | --- | --- |
| Confirm | `outboxProcessed: 1, outboxSkipped: 0` | patient + practitioner notification, **2 reminders scheduled** |
| Run the worker again | `outboxClaimed: 0` | still 4 rows — **idempotent** |
| Reschedule (+3 days) | `outboxProcessed: 1` | both audiences told again; the **2 old reminders cancelled, 2 new ones scheduled** — example 5, for real |
| Cancel | `outboxProcessed: 1` | both audiences told; **0 reminders remain scheduled**, all 4 cancelled |

And on the resulting rows:

```text
practitioner messages naming the real patient's full name    0 of 3
practitioner messages containing the word "patient"          0 of 3
practitioner links pointing anywhere but /doctor/...         0 of 3
the internal cancellation_reason appearing in any message    0 of 7
distinct recipient accounts across the 7 rows                2
delivery rows created (email is unconfigured)                0
```

The cancellation was given the reason *"clinician unavailable — internal note
that must never appear in a message"* precisely so its absence could be
asserted rather than assumed.

**The pre-existing test failure.** `tests/security/secrets.test.ts >
ignores every .env except the example` fails because `.gitignore` lines 33–37
carry **trailing spaces**, so `/^\.env\*$/m` does not match. It is unrelated
to this work — `.gitignore` is untouched and unmodified since `eb0af63` — and
it is not a security hole: git ignores trailing whitespace in a pattern unless
it is backslash-escaped, so `.env*` is still honoured. It is left for whoever
owns that file to fix; removing five trailing spaces makes the suite green.
`.prettierrc.json` also fails `prettier --check` and is likewise pre-existing
and untouched.

##### The browser pass — known issue 1, closed for these routes

Phases 03–09, 11, 12 and 14 drove the production build through Chrome over the
DevTools Protocol; Phase 15 did not, and recorded that as its first known
issue. This is that pass, run on 2026-09-23 against a fresh production build,
signed in as a real doctor through the real login form — so `/doctor` rendered
a real practitioner's day and `/notifications` rendered real practitioner
notifications, not fixtures.

**Horizontal overflow** — `documentElement.scrollWidth - clientWidth`, at every
width `phase_15.md` section 93 lists:

| Route | 320 | 375 | 390 | 430 | 768 | 1024 | 1280 | 1440 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/doctor` | clean | clean | clean | clean | clean | clean | clean | clean |
| `/notifications` | clean | clean | clean | clean | clean | clean | clean | clean |
| `/notifications/preferences` | clean | clean | clean | clean | clean | clean | clean | clean |

Phase 08 found a 35px overflow this way and Phase 18 found the header clipping
its own navigation; there is none here.

**Computed contrast** — the thing jsdom cannot do, because it has no layout
engine and therefore no computed colours. Measured with axe-core's
`color-contrast` rule in a real browser:

| Route | Text nodes checked | Failing | Needs review | Lowest ratio measured |
| --- | --- | --- | --- | --- |
| `/doctor` | 50 | 0 | 0 | **8.13:1** |
| `/notifications` | 31 | 0 | 0 | **8.18:1** |
| `/notifications/preferences` | 19 | 0 | 0 | **8.13:1** |

WCAG AA asks 4.5:1 for body text. The worst measured is 8.13:1, with room to
spare — Phase 09 found a 3.89:1 failure by exactly this method, so the check is
one that can fail.

**axe, with a real layout engine:** 0 violations on all three routes, at 1280px
and again at 320px.

**Keyboard operation:** 39 tab stops walked per route with real `Tab` key
events. Every stop has an accessible name, and every stop shows a visible focus
indicator.

Six stops on `/doctor` *appeared* to have none, and that was worth chasing
rather than dismissing: they are the notification cards' stretched links, which
carry `focus-visible:outline-none` deliberately. Walking the ancestor chain
with the link focused found `outline: solid 2px rgb(42, 71, 58)` on the card
four levels up — `Card`'s `interactive` variant puts the ring on the card
rather than on the hidden link, which its source comment says and which this
confirms. **A false positive in the harness, not a defect in the product**, and
recorded here because "6 elements with no focus ring" is exactly the kind of
number that gets copied into a report unchecked.

##### The wording defect the live render found

The practitioner's message rendered as **"A Initial consultation is confirmed
for…"**.

The consultation type is *data* — whatever the clinic named a row in
`appointment_types` — so an article written beside it in a template cannot
agree with it. Every unit test passed, because every fixture happened to use a
consonant-initial name; only a render against a real appointment type showed
it.

Fixed by restructuring the three practitioner sentences so no article is
needed, rather than by computing "a" against "an": section 100 asks that
localization stay possible later, and a hard-coded English article rule is the
opposite of that. `NOTIFICATION_TEMPLATE_VERSION` is now **2** — the patient
wording is unchanged in that revision, and the version is global, so a patient
notification created from now on records 2 while reading exactly as 1 did.

`templates.test.ts` now renders **every** message, patient and practitioner,
with a vowel-initial and a consonant-initial type and asserts no article
misagrees — plus a test that the detector finds the defect it is meant to find,
so it cannot pass vacuously the way the clinical-word scanner once did.

##### The second pass: the other audience, and the navigation beside the panel

The pass above covered the three doctor routes. It was then extended to the
**patient** side of the same surfaces — the preference grid and the empty-state
wording differ by audience, so a pass on one proves nothing about the other —
and the focus walk was extended to ask a question it had not asked: **is the
focused element inside the viewport?**

Six route/role combinations, eight widths each, axe at each:

| Signed in as | Route | Findings |
| --- | --- | --- |
| doctor | `/doctor` | 0 |
| doctor | `/notifications` | 0 |
| doctor | `/notifications/preferences` | 0 |
| patient | `/patient` | 0 |
| patient | `/notifications` | 0 |
| patient | `/notifications/preferences` | 0 |

Zero axe violations, zero contrast failures, zero horizontal overflow, every
focus stop visible and in view — **on the notification surfaces**. The new
question found something next to them.

**The area navigations were hiding their own links.** The doctor workspace nav
needed 376px and was given 288 at a 320px viewport, so **"My practice" sat
entirely outside the viewport**, as did three items at 375 and 390. The
document reported *no* horizontal overflow — which is why the first pass's
overflow table is accurate and still missed this — because `overflow-x-auto`
was absorbing it by hiding the nav's own content. That is exactly the failure
mode Phase 18 found in the header nav and fixed *there*; nobody re-measured the
four area navs afterwards, and Phase 16 had since added a fourth item to this
one.

Worse than invisible: **focusing a hidden entry did not scroll it into view**,
so a keyboard user tabbing through the workspace landed on a link they could
not see — WCAG 2.4.7 in practice, whatever the focus ring says.

The same pattern was measured in the other three, and the **patient area was
the worst**: at 320px four of its six links — Prescriptions, Treatment plans,
Documents and Profile — were off-screen and unreachable.

| Nav | Before | After |
| --- | --- | --- |
| `components/patient/patient-nav.tsx` | 4 of 6 links off-screen at 320px, 3 at 375/390/430 | all in view; wraps to 3 rows at 320, 2 above |
| `components/doctor/doctor-nav.tsx` | "My practice" off-screen at 320/375/390 | all in view; 2 rows below 430 |
| `components/reception/reception-nav.tsx` | same pattern | all in view |
| `app/(app)/admin/layout.tsx` | same pattern | all in view |

All four now wrap instead of scrolling. `AppNav` in the header deliberately
still scrolls and was left alone: it shares a row with the brand and sign-out,
and a second line there would shift the page beneath it — Phase 18 gave it its
own row instead. These four each have a row to themselves, so they can wrap.

##### Three findings that were the harness, not the product

Recorded because a report listing only what it found is not evidence of how
carefully it looked.

* **"Focus is invisible on the dashboard notification links."** It is not — the
  card draws the ring for its stretched link through `focus-within`. Confirmed
  by capturing the card's computed outline focused and unfocused: `none` →
  `solid 2px`. (The first pass reached the same conclusion independently.)
* **"Those links are a 20px touch target."** They are 350×159: the anchor's
  `::after` covers the whole card. The harness was measuring the text, not the
  target.
* **"The preferences page has no `main` landmark and no `h1`."** A stale Chrome
  held the debugging port, so a later run opened its tab in an **already
  signed-in** browser and measured a page that had never navigated. The page
  has exactly one `main` and one `h1`.

Each was re-measured in isolation before being believed, and each turned out to
be the instrument rather than the thing being measured.

**What this pass did not cover:** dark mode, `prefers-reduced-motion`, a real
screen reader, and Lighthouse. Known issue 1 is closed for the notification
surfaces on both sides; those four remain.

#### 20.8 What this did not change

Worth stating explicitly, because the value of this change is mostly in what it
left alone:

```text
notification_outbox        no column, no row, no trigger, no policy
the three emit triggers    byte-identical
plan_appointment_reminders untouched
release_due_reminders      untouched
the delivery pipeline      untouched — it reads recipient_user_id and always did
notifications_select_own   untouched; a practitioner reads through a patient's policy
notification_preferences   no new category, no new row shape
permissions.ts             no new permission; every role already held both
```

The one schema change is `notifications.audience`, which is **not granted to
any client role** — machinery like `dedupe_key`, not message. It is stored so a
row stays interpretable on its own, which is section 99's argument for
`template_version` applied to vocabulary rather than to wording.

#### 20.9 Known limitations of this addition

1. **The migration is not applied and nothing is verified live.** Restated here
   because it is the single most important caveat. See 20.7.
2. **A practitioner confirming an appointment themselves is told about it.**
   The outbox carries no actor — deliberately, section 115 wants identifiers
   and the minimum — so the processor cannot tell a front-desk change from the
   practitioner's own. One redundant message per self-confirmation, and the
   alternative is putting an actor into a domain event, which is a larger
   change than the noise justifies. Worth revisiting if practitioners complain.
3. **Analytics now folds two audiences into one number.**
   `analytics_notification_summary` groups by `category`, so a practitioner's
   schedule message and a patient's are counted together under
   `appointment_updates`. Nothing is wrong, but "appointment update
   notifications" no longer means "messages to patients". Adding an audience
   dimension is a one-line change to that function whenever Phase 16's
   dashboard needs the distinction.
4. **No browser pass.** Known issue 1 already recorded that the notification
   centre and preferences grid had never been measured for contrast, overflow
   at 320px or real focus behaviour. This adds a panel to `/doctor` and a
   fourth rendering path to the preferences grid, so the gap is now larger.
   The component suite's axe sweeps run in jsdom, which has no layout engine.
5. **Email for a practitioner is untested in the same way it is untested for a
   patient.** The delivery pipeline reads `recipient_user_id` and never cared
   who it belonged to, so a practitioner's email would work exactly as well as
   a patient's does — which is to say, no email has been sent from this
   application at all (known issue 3).

---

### 19. Phase status

```text
Phase 15: COMPLETE
Ready for Phase 16: YES

Practitioner notifications (section 20): COMPLETE
Migration applied to the live project:   YES — 2026-09-23
Verified live:                           YES — 19 checks, section 20.7
Verified in a browser:                   NO  — known issue 1
```

Phase 16 has not been started. Its specification is a zero-byte placeholder
and must be written before implementation.

Analytics can be built on what exists without changing it. `notifications`,
`notification_deliveries` and `notification_outbox` carry counts, statuses,
timestamps and error codes and **no patient-identifying content**, which is
exactly the shape section 31 of `docs/PRODUCT_SPEC.md` asks analytics to
consume. The worker already returns a count-only summary.

Two caveats to carry forward:

* **Notification metrics are operational, not clinical.** "How many
  prescription notifications were sent" is a count of messages, not a count of
  prescriptions, and the two must not be presented as the same number.
* **The browser pass this phase skipped should be run before Phase 16 adds
  more surface to it.** The gap compounds; Phase 13 recorded the same thing
  and Phase 14 closed it.
