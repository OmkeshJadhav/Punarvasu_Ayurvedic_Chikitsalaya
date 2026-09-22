## PHASE 15 — Notifications & Communication

Status:
COMPLETED — three migrations applied to the live Supabase project and verified
against it with real per-role JWTs, and the whole lifecycle driven end to end
against a production build

Completed On:
2026-09-19

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
* The page is available to **every** authenticated role. Staff see an empty
  state today, which is honest: no staff notification exists yet.

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

* **Staff notifications.** Section 56 asks for useful workflows rather than
  every database event, and no staff workflow has been designed. The
  architecture is ready — `recipient_user_id` is any account, the permission
  is already held by every role, and `/notifications` already renders for
  staff. What is missing is the decision about *what* a receptionist should be
  told, which is the clinic's.
* **Document notifications.** Section 35 makes them conditional. A document
  notification would be a **staff** notification (a patient uploaded a report),
  so it waits for the same decision. Adding one is a trigger, an enum value in
  a second migration, and a template.
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

1. **No *measured* browser verification was run for this phase.** Phases
   03–09, 11, 12 and 14 drove the production build through Chrome over the
   DevTools Protocol to measure computed contrast, horizontal overflow, focus
   order and keyboard operation. That was not done here. The component suite's
   axe sweeps run in jsdom, which has no layout engine and therefore no
   computed colours — so **contrast, overflow at 320px and real focus
   behaviour on the three new routes are unverified**. Phase 08 found a 35px
   overflow, Phase 09 a 3.89:1 contrast failure and Phase 11 a duplicate
   landmark that nothing else could see. The notification centre and the
   preferences grid should have the same check before they are relied on.

   The routes *were* driven for real over HTTP as part of the end-to-end runs,
   so they render and behave correctly. That proves nothing about how they
   look.

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

---

### 19. Phase status

```text
Phase 15: COMPLETE
Ready for Phase 16: YES
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
