## PHASE 09 — Appointment Engine

Status:
COMPLETED — verified against the live Supabase project and in a real browser

Completed On:
2026-09-18

Summary:
Built the appointment engine: the schema and its policies, appointment types,
a practitioner scheduling foundation, recurring availability and blocked
periods, a timezone-safe availability engine, the patient booking flow, the
appointment list and detail, cancellation, rescheduling, the status lifecycle,
and — the part of this phase a web application cannot provide — **database-level
prevention of double booking**.

**No client role can write `public.appointments`.** Not the patient, not a
future receptionist, not anyone. There is no insert, update or delete grant and
no such policy. Every write goes through a `security definer` function that
derives the patient from `auth.uid()`, the duration from the appointment type
and the status from the transition rules. A request carrying `patientId`,
`status`, `duration` or `endsAt` has nothing to act on, because none of those
is a parameter.

1,513 tests pass, up from 1,241. **79 live checks** against the real database
with real per-role JWTs, including two genuinely concurrent bookings for the
same slot. **64 live browser checks** drive the production build through
booking, rescheduling and cancellation with axe at 390px and 1280px.

**Three real defects were found by verification rather than by review**, and
one of them made every appointment unreadable by every client. All three are
described in full below, because the class of each is worth remembering.

---

### Repository assessment before starting

Phases 06–08 left identity, the patient record and authorization. Reused rather
than rebuilt: `getCurrentUser()`, the `(app)` route group, `src/proxy.ts`,
`requireAreaAccess`/`requirePermission`, `config/permissions.ts`, the Supabase
clients, `AppError`, the structured logger, `parseInput` and the shared
validation primitives, `Field`, `Textarea`, `Button`, `Card`, `Alert`,
`Badge`/`StatusBadge`, `Dialog`, `Toaster`, `EmptyState`, `ErrorState`,
`SectionLoading`, `Skeleton`, and Phase 07's `ProfileSection`/
`ProfileFieldList`/`ProfileField`.

Five findings shaped the work:

* **`docs/DATABASE.md` §11 already specified the answer** to the hardest
  problem here — a `btree_gist` exclusion constraint over practitioner and time
  range, with application-level check-then-insert called out as insufficient.
  That is implemented literally.
* **`docs/DATABASE.md` §11 also documents the status lifecycle**, which is
  longer than `phase_09.md` §5's suggestion. See *Decisions*.
* **`PROTECTED_PATH_PREFIXES` already listed `/patient`**, and `robots.txt`
  already disallowed `/patient/` and `/appointments/`. Phase 06 listed both
  ahead of the features, so this phase inherited protection rather than having
  to remember it. Neither file needed changing.
* **No practitioner is verified.** `features/practitioners/content.ts` holds
  two `pending-verification` placeholders, and a content-safety test fails the
  build if one acquires a name. That constrains what this phase could seed —
  see *Content and configuration*.
* **`lib/authorization/ownership.ts` shipped in Phase 08 with no call site**,
  recorded there as "the primitive Phase 09 consumes the moment a record is
  addressed by its own id". In the event it is still unused, and for a better
  reason — see *Decisions*.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260920120000_appointment_engine.sql
supabase/migrations/20260920130000_appointment_doctor_policy_fix.sql

src/config/appointments.ts                      booking rules + clinic timezone
src/config/appointments.test.ts                 mirror check against the SQL

src/features/appointments/time.ts               the timezone layer
src/features/appointments/time.test.ts
src/features/appointments/availability.ts       the slot engine, pure
src/features/appointments/availability.test.ts
src/features/appointments/status.ts             the transition matrix
src/features/appointments/status.test.ts
src/features/appointments/types.ts
src/features/appointments/validation.ts
src/features/appointments/validation.test.ts
src/features/appointments/errors.ts             SQLSTATE -> safe copy
src/features/appointments/errors.test.ts
src/features/appointments/queries.ts            server reads
src/features/appointments/actions.ts            three server actions
src/features/appointments/content.ts            all patient-facing copy

src/components/appointments/booking-flow.tsx
src/components/appointments/date-picker-strip.tsx
src/components/appointments/time-slot-picker.tsx
src/components/appointments/use-available-slots.ts
src/components/appointments/appointment-card.tsx
src/components/appointments/appointment-list.tsx
src/components/appointments/appointment-status-badge.tsx
src/components/appointments/appointment-summary.tsx
src/components/appointments/appointment-history.tsx
src/components/appointments/cancel-appointment-dialog.tsx
src/components/appointments/reschedule-form.tsx

src/app/(app)/patient/appointments/page.tsx
src/app/(app)/patient/appointments/loading.tsx
src/app/(app)/patient/appointments/book/page.tsx
src/app/(app)/patient/appointments/[id]/page.tsx
src/app/(app)/patient/appointments/[id]/reschedule/page.tsx
src/app/api/appointments/availability/route.ts

scripts/seed-dev-practitioner.mjs

tests/integration/appointment-actions.test.ts
tests/integration/appointment-availability-route.test.ts
tests/integration/appointment-security.test.ts
tests/components/appointments.test.tsx
docs/progress/progress_phase_09.md
```

#### Modified

```text
src/config/permissions.ts          two appointment permissions, patient only
src/config/permissions.test.ts     the speculative list, narrowed
src/lib/authorization/policy.test.ts   the exhaustive matrix, extended
src/types/database.ts              six tables, two enums, six functions
src/features/patients/content.ts   an Appointments nav item; overview copy
src/app/(app)/patient/page.tsx     the next consultation, and two actions
src/app/(public)/appointments/new/page.tsx   now routes into sign-in + booking
src/components/layout/site-header.tsx        a 320px overflow fix — see Defect 3
tests/components/patient-profile.test.tsx    the nav now has three links
package.json                       seed:dev-practitioner

docs/ARCHITECTURE.md               §1.1 state, routes, appointments row
docs/DATABASE.md                   §4.5, §4.6, §11 marked implemented
docs/SECURITY.md                   §6 matrix row, Phase 09 controls, §25
docs/QA_STRATEGY.md                Phase 09 coverage; why one test reads SQL
docs/DESIGN_SYSTEM.md              components/appointments/ index
docs/PUNARVASU_MASTER_SPEC.md      status, routes, areas
```

#### Dependencies

**None added.** No date library, no calendar widget, no scheduling package, no
E2E tool. The timezone layer is `Intl`, which is built in; the reasoning is in
`features/appointments/time.ts`.

---

### 2. Database

Two migrations, both applied to the linked development project with
`supabase db push` and verified against it.

#### Tables

| Table | Purpose |
| --- | --- |
| `practitioners` | A practitioner's **scheduling identity**: a display name and two booleans. No qualification, registration number, specialisation or biography column exists, and none may be added — those are credentials the clinic has not confirmed, and a field that exists gets filled |
| `appointment_types` | The trusted source of duration and buffer. No price column: payments are out of scope and no fee is verified |
| `practitioner_availability` | Recurring working intervals, `time` in clinic wall-clock, `weekday` 0-6 Sunday-based. Multiple rows per weekday express a split day |
| `schedule_exceptions` | Leave, holidays, closures, blocked slots — one mechanism, because they are one thing to the availability engine. Nullable `practitioner_id` means clinic-wide |
| `appointments` | Patient, practitioner, type, `starts_at`, `ends_at`, `blocked_until`, status, a patient note, a staff-only internal note, and the cancellation record |
| `appointment_events` | Insert-only history: created, status changed, rescheduled. No actor name, no free text, no clinical content |

#### Enums

```text
appointment_status      requested, confirmed, checked_in, in_consultation,
                        completed, cancelled, no_show
appointment_event_type  created, status_changed, rescheduled
```

#### Constraints

```text
appointments_practitioner_no_overlap   EXCLUDE USING gist (practitioner_id =,
                                       tstzrange(starts_at, blocked_until, '[)') &&)
                                       WHERE (status <> 'cancelled')
appointments_patient_no_overlap        the same, per patient, over [starts_at, ends_at)
appointments_interval                  ends_at > starts_at
appointments_blocked_until_covers_end  blocked_until >= ends_at
appointments_cancellation_consistency  cancelled <-> cancelled_at is set
appointments_patient_note_length       1..500
appointments_internal_note_length      1..2000
appointments_cancellation_reason_length 1..300
appointment_types_slug_format          lowercase-hyphenated, 2..64
appointment_types_duration_range       5..480 minutes
appointment_types_buffer_range         0..240 minutes
appointment_types_name_length          1..120
appointment_types_description_length   1..400
practitioners_display_name_length      1..120
practitioner_availability_weekday_range 0..6
practitioner_availability_interval     ends_at > starts_at
schedule_exceptions_interval           ends_at > starts_at
schedule_exceptions_reason_length      1..200
practitioners.profile_id               unique, FK -> profiles, cascade
appointments.patient_id                FK -> patients, cascade
appointments.practitioner_id           FK -> practitioners, RESTRICT
appointments.appointment_type_id       FK -> appointment_types, RESTRICT
```

#### Indexes

```text
appointments_patient_idx          (patient_id, starts_at desc)
appointments_practitioner_idx     (practitioner_id, starts_at)
appointment_events_appointment_idx (appointment_id, created_at)
practitioner_availability_lookup_idx (practitioner_id, weekday) where is_active
schedule_exceptions_window_idx    (practitioner_id, starts_at, ends_at)
practitioners_bookable_idx        (is_active, accepts_online_booking)
appointment_types_active_idx      (is_active, sort_order, name)
```

The two exclusion constraints also provide gist indexes over
`(practitioner_id, range)` and `(patient_id, range)`, which is what serves the
conflict check.

#### RLS policies

```text
practitioners              SELECT  authenticated, all rows  (see note)
appointment_types          SELECT  authenticated, all rows  (see note)
practitioner_availability  SELECT  authenticated, active rows
schedule_exceptions        none at all — RLS enabled, zero policies
appointments               SELECT  own patient record (patient role)
                           SELECT  own practitioner record (doctor role)
                           INSERT / UPDATE / DELETE  nobody
appointment_events         SELECT  the owning patient
                           INSERT / UPDATE / DELETE  nobody
```

"Nobody" means no policy **and** no grant, so a write is refused at the
privilege check before RLS is consulted.

The note: practitioners and appointment types are readable in full rather than
filtered to active, because a patient's *past* appointment references the
practitioner they saw and the type they had. If either is later deactivated,
their own history must not start rendering a blank. The booking screens filter
on `is_active and accepts_online_booking` in the query, and
`assert_bookable_slot` refuses an inactive practitioner regardless of what any
query returned. The column grant limits the disclosure to a name and two
booleans.

#### Column-level grants

`anon` receives nothing on any of the six tables. The `appointments` select
grant is column by column, and **`internal_note` is not in it** — so a patient
cannot read it through any query, a `select *` included. `blocked_until`,
`created_by` and `cancelled_by` are likewise absent.

#### Functions / RPCs

| Function | Security | Purpose |
| --- | --- | --- |
| `clinic_timezone()` | immutable | The scheduling timezone, named once |
| `appointment_booking_rules()` | immutable | Minimum notice, horizon, slot grid, cancellation cutoff, per-patient cap |
| `current_patient_id()` | definer, stable | The caller's own patient record. Takes no argument |
| `current_practitioner_id()` | definer, stable | The caller's own practitioner record. Added by the fix migration |
| `get_practitioner_busy_intervals()` | definer, stable | Interval boundaries only. No id, no patient, no status, no reason |
| `assert_bookable_slot()` | definer, stable | Every rule except overlap. Shared by booking and rescheduling, revoked from clients |
| `book_appointment()` | definer | The only way a patient creates an appointment |
| `cancel_appointment()` | definer | Status change plus who and when. Never a delete |
| `reschedule_appointment()` | definer | Moves in place, re-validates, re-records |
| `appointments_guard_transition()` | trigger | The status matrix, in the database |

---

### 3. Availability architecture

```text
practitioner_availability          the recurring working week (RLS-readable)
        +
get_practitioner_busy_intervals()  appointments + blocked periods, as bare
        |                          (start, end) pairs — definer, minimal
        v
features/appointments/availability.ts     a pure function of its inputs
        |
        v
GET /api/appointments/availability         authenticated, permission-checked,
        |                                  bounded, private + no-store
        v
useAvailableSlots -> TimeSlotPicker         a snapshot, and nothing more
```

Rules applied, in order: working intervals for that weekday; the slot grid, and
the whole appointment plus its buffer fitting inside one interval; minimum
notice; booking horizon; existing appointments and blocked periods. Past times
need no rule of their own — anything past is also inside the notice window.

Three decisions worth naming:

* **The engine is pure and the inputs are injected**, including `now`. That is
  what lets each of `phase_09.md` §66's rules be tested one at a time, and it
  is why no scheduling test depends on when it runs.
* **Slot generation is in TypeScript, validation is in SQL.** The alternative —
  generating slots in PL/pgSQL — would have put the rules in one place but made
  them untestable without a database. Instead the *authority* is SQL
  (`assert_bookable_slot` re-derives every rule at write time) and the
  *snapshot* is TypeScript. They cannot silently disagree about the grid or the
  timezone, because `config/appointments.test.ts` reads the migration and
  asserts the numbers match.
* **The buffer is in the busy interval, not in a rule applied afterwards.**
  `get_practitioner_busy_intervals` returns `blocked_until`, so separation is a
  property of the data the engine is given — and the same property the database
  enforces.

---

### 4. Conflict prevention

```sql
alter table public.appointments
  add constraint appointments_practitioner_no_overlap
  exclude using gist (
    practitioner_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  )
  where (status <> 'cancelled');
```

This is the whole guarantee. Two concurrent requests both pass an application
"is the slot free?" check, because both read before either writes; an exclusion
constraint is evaluated by the index at write time under the database's own
concurrency control, so the second writer blocks on the first and then fails.
At most one succeeds, always.

* `'[)'` — half-open — is what makes back-to-back appointments legal.
* `blocked_until` is `ends_at` plus the type's buffer **as configured at
  booking time**, so buffer separation is an invariant rather than a check
  somebody hoped nobody raced, and changing the configuration cannot
  retroactively move an existing booking.
* The predicate excludes only `cancelled`, written as `<> 'cancelled'` rather
  than as a list of live statuses, so adding a status later cannot accidentally
  stop it blocking.
* A second constraint applies the same rule per patient, so nobody can hold two
  overlapping appointments with different practitioners.

**Verified live**, not argued: two genuinely parallel `book_appointment` calls
from two different signed-in patients for the same slot — one succeeded, one was
refused with `23P01`.

---

### 5. Authorization and RLS

```text
src/proxy.ts                 optimistic redirect, no role check, no query
  v
(app)/layout.tsx             requireUser()
  v
(app)/patient/layout.tsx     requireAreaAccess(PROTECTED_AREAS.patient)
  v
page                         requirePermission("appointments.read.self" | ".write.self")
  v
server action                can(user.role, "appointments.write.self")
  v
database function            auth.uid() + has_app_role('patient') + ownership
  v
RLS                          the last word
```

Two permissions were added to `config/permissions.ts` —
`appointments.read.self` and `appointments.write.self` — and granted to the
**patient role alone**. Receptionist, doctor and admin hold neither, because
their workspaces do not exist; Phase 08's rule that permissions arrive with the
surfaces they protect is the reason these two arrived now, alongside the
screens that use them.

The doctor's-diary policy is scoped by the practitioner **relationship**
(`practitioners.profile_id = auth.uid()`), never by the doctor role alone,
which is what `docs/SECURITY.md` §6 requires of every clinical-facing grant.
No application surface reads it yet; it is the relationship Phase 09 was asked
to establish, and Phase 11 brings the screen.

---

### 6. Booking, cancellation and rescheduling

**Booking.** `Consultation type → Practitioner → Date → Time → Review →
Request`, one form, posting to a server action. The appointment is created
`requested`, and the confirmation says **"Appointment requested"** with the
sentence "The clinic has your request and will contact you to confirm the time.
It is not confirmed yet." Claiming otherwise is what `phase_09.md` §§21 and 48
forbid, and it would be a false reassurance to somebody arranging their week.

The booking page refuses to start when there is no patient record (it invites
the patient to complete their profile) or no practitioner accepting online
booking (it says so and offers the clinic's phone number).

**Cancellation.** A confirmation dialog, an optional reason that says it is
optional and asks the patient to keep it to scheduling, and then a status
change — never a delete. The row, its note and its history all survive, and the
slot is released to other patients.

**Rescheduling.** Moved in place, not cancelled and recreated. The appointment
keeps its identity, the previous time is preserved as a history event, the
duration is re-read from the stored appointment type — so a patient cannot
lengthen their own appointment — and the same exclusion constraint applies, so
a reschedule is exactly as safe under concurrency as a booking. A confirmed
appointment returns to `requested`, because the clinic agreed to a time and
that time has changed.

**Failure.** A slot taken between choosing and submitting returns the patient to
the time step with a **refreshed** list, because the one on screen is then known
to be wrong.

---

### 7. Security and adversarial results

#### Live database — 79 checks, real per-role JWTs

Run against the linked project by signing in as each seeded account with the
anon key, so every check went through real RLS with a real `auth.uid()`.
Synthetic data only; the second patient account was deleted afterwards.

| Area | Result |
| --- | --- |
| `anon` can read none of the six tables | PASS |
| Patient books a valid slot; status is `requested`; duration comes from the type | PASS |
| Past time, too-soon, beyond-horizon, outside-hours and off-grid all refused, each with its own code | PASS (5) |
| **Two concurrent bookings for the same slot: at most one succeeds** | PASS |
| **The loser is refused by the database (`23P01`), not by the application** | PASS |
| An overlapping booking is refused | PASS |
| **Patient B cannot read, cancel or reschedule patient A's appointment** | PASS (3) |
| Patient A can read their own | PASS |
| **Receptionist, doctor and admin cannot book or cancel** (`42501`) | PASS (6) |
| `anon` cannot book | PASS |
| **No role can INSERT, UPDATE or DELETE an appointment directly** | PASS (12) |
| A patient cannot select `internal_note` | PASS |
| A patient reads no blocked period at all | PASS |
| A blocked period is not bookable, and the refusal does not disclose the reason | PASS (2) |
| Busy intervals carry boundaries and nothing else | PASS |
| An oversized availability window is refused; `anon` cannot read one | PASS (2) |
| A doctor reads their own diary; a receptionist and an admin read nothing | PASS (3) |
| Reschedule keeps the identity, the type's duration, and records both times | PASS (5) |
| Cancel preserves the row, records who and when, and cannot be repeated | PASS (6) |
| The cancelled slot becomes bookable by another patient | PASS |
| `completed → requested`, `cancelled → completed`, `no_show → requested` all refused | PASS (3) |

**79 passed, 0 failed.**

#### `phase_09.md` §70's checklist

| Attempt | Result | Where proved |
| --- | --- | --- |
| Manipulated `patientId` | **No effect** — never read; not an RPC parameter | Live DB, `appointment-actions.test.ts`, `validation.test.ts` |
| Manipulated `practitionerId` | Validated as a uuid, then checked for active + bookable in the database | Live DB, validation tests |
| Manipulated `appointmentId` | Resolved by id **and** owner in one statement; somebody else's is indistinguishable from a missing one | Live DB (`PV009`) |
| Manipulated `appointmentTypeId` | Resolved server-side; unknown or inactive refused (`PV006`) | Live DB |
| Manipulated `status` | Not a parameter; set by the function; transitions trigger-enforced | Live DB, security test |
| Manipulated `startAt` | Must carry a timezone offset; then re-validated against grid, hours, notice, horizon and blocked periods | Live DB, validation tests |
| Manipulated `endAt` / `duration` | Not parameters; derived from the type | Live DB, security test |
| Duplicate / concurrent booking | Exclusion constraint | Live DB, parallel requests |
| Unauthorized cancellation / rescheduling | `PV009` | Live DB |
| Cross-user appointment access | Zero rows | Live DB |

#### Live browser — 64 checks, real Chrome, production build

Signed in through the real form as the seeded patient.

| Area | Result |
| --- | --- |
| Unauthenticated visitor redirected to sign-in with the destination kept | PASS |
| **axe, real computed contrast**: `/appointments/new`, `/patient/appointments` (390 + 1280), booking page, review step (390 + 1280), appointment detail (390 + 1280), reschedule, cancel dialog | **PASS — 0 violations** |
| Public regression: `/`, `/services`, `/about`, `/contact` | **PASS — 0 violations** |
| Exactly one `<h1>` and no skipped level on every appointment page | PASS |
| Touch targets ≥24px at 390px | PASS |
| **No horizontal overflow at 320/375/390/430/768/1024/1280/1440/1920** on every public and appointment page | PASS |
| Exactly one `<form>` on the booking page, and it does not submit by GET | PASS |
| The form carries exactly `appointmentTypeId`, `practitionerId`, `startsAt`, `patientNote` | PASS |
| The provisional-configuration notice and the notice period are shown | PASS |
| The review step shows the clinic's verified address and the "don't describe symptoms" warning | PASS |
| Booking lands on the appointment page, says **requested** and not confirmed | PASS |
| A quotable reference is shown; no raw identifier and no internal note | PASS |
| The appointment page is `private, no-store` and `noindex` | PASS |
| Reschedule chooses a new time, confirms, and shows the move in the visible history | PASS |
| Cancelling asks first, traps focus, and the cancelled appointment still exists | PASS |
| No animation runs under `prefers-reduced-motion` | PASS |

**64 passed, 0 failed.**

---

### 8. Defects found and fixed

All three were found by verification. None was visible to 1,513 tests, to
ESLint, to the type checker or to review.

**1. The doctor's-diary policy made every appointment unreadable by everyone.**
*(serious — found by live database verification)*

The original policy scoped a doctor to their own diary with

```sql
practitioner_id in (
  select p.id from public.practitioners p
  where p.profile_id = (select auth.uid())
)
```

A policy expression is evaluated **with the calling role's privileges**, and
`practitioners.profile_id` is deliberately not in the column grant — which
account a practitioner signs in with is none of a patient's business. So
evaluating it raised `42501: permission denied for table practitioners`. And
because policies are OR-ed, PostgreSQL evaluates them all: the error took out
the query for **every** caller, including the patient whose own policy would
have admitted them. The net effect was that no client could read any
appointment at all.

The migration applied cleanly. The structural test passed — it checks the
policy is scoped by relationship, and it was. Every stubbed integration test
passed. It was found by signing in as a real patient and reading back the
appointment they had just booked.

Fixed forward in `20260920130000_appointment_doctor_policy_fix.sql` with
`current_practitioner_id()`, a `security definer` helper exactly parallel to
`current_patient_id()` — which the patient policy already used for the same
reason. A second migration rather than an edit, because migrations are
forward-only and the first had been applied (`docs/DATABASE.md` §12).

**2. A progress-step label failed AA at 3.89:1.** *(real — found by live axe)*

`text-muted-foreground/70` on the booking flow's step indicator measured 3.89:1
on the cream page. An opacity modifier applied to a token is a **new colour**,
and `lib/design/contrast.test.ts` verifies the palette's tokens — it knows
nothing about a derivative invented in a component. All three step states now
use verified tokens and are told apart by weight, `aria-current` and a check
mark rather than by colour.

**3. The public header overflowed 320px by 12px — but only when signed in.**
*(real — found by live measurement, pre-existing since Phase 06)*

At 320px there is not room for the logo, an account control and a menu trigger.
It survived every earlier phase's responsive checks because those browsed
**signed out**, where the control reads "Sign in" — two characters shorter than
"My account". Phase 09 is the phase that gives a signed-in patient a reason to
be on the public site, which is how it surfaced.

Fixed by hiding the account control in the bar below `sm`, exactly as the CTA
beside it already is. Nothing is lost: `MobileNav`'s footer renders the same
control, one tap away in the menu a phone user opens anyway.

#### Three harness bugs, recorded because a report listing only what passed is not evidence

* **`document.querySelector('form button[type="submit"]')` clicked *sign out*.**
  The authenticated shell's header carries a sign-out form, so a page-wide
  query finds it first. Every "failure" in that run was the harness signing
  itself out. This is the same trap `progress_phase_07.md` records; it is
  apparently worth re-learning. Every selector is now scoped to `<main>`.
* **`ul button` clicked a date twice.** The date strip and the slot grid are
  both `<ul>`, so document order picked the wrong one and the flow never
  reached the time step. Lists are now found by accessible name.
* **"The first bookable day has no free time" is not a failure.** Minimum
  notice can consume the rest of today, which is the empty state working
  correctly. The harness now walks forward until a day has slots.

And one mismeasurement worth naming: an overflow sweep that resizes the
viewport without re-navigating reported +12px on `/contact`, because the Google
Maps iframe does not reflow on resize. Measured with a fresh layout at each
width, it is clean. Both methods are now used; they disagree only there.

---

### 9. Content and configuration — what is real and what is not

**Nothing in this phase's configuration has been confirmed by the clinic**, and
the product says so to the patient rather than only in a source comment.

| Item | Status |
| --- | --- |
| Consultation types ("Initial", "Follow-up") | **Provisional.** Operational scheduling categories, not treatments. They make no claim about what care involves or achieves |
| Durations (45 / 30 minutes) | **Provisional.** Seeded by the migration; a review notice on the booking page says so |
| Buffer (0 minutes) | The clinic has specified none. Modelled and database-enforced where non-zero |
| Minimum notice (2 hours) | **Provisional**, and taken from `phase_09.md` §16's own example so the number is traceable to a document rather than invented |
| Booking horizon (90 days) | **Provisional**, same source |
| Cancellation cutoff (**none**) | `phase_09.md` §28: where the clinic has not asked for a cutoff, document the decision rather than invent one. A patient may cancel any appointment that has not started |
| Concurrent appointments per patient (5) | An abuse bound, not a clinical rule |
| Clinic timezone (`Asia/Kolkata`) | **Derived from the clinic's verified address** in Satara, Maharashtra — not a guess |
| Clinic address on the review and detail screens | **Verified** (Phase 05) |
| Practitioners | **None configured for online booking.** The migration seeds none; naming one the clinic has not confirmed is what `docs/HEALTHCARE_AND_AI_SAFETY.md` forbids. `scripts/seed-dev-practitioner.mjs` populates a development database from an account that exists, using that account's own display name |
| Working hours | **Not the clinic's.** The seed script's week is development data and says so |

`BOOKING_REVIEW_NOTICE` renders on the booking page: the types, their lengths
and the notice period are working defaults while Punarvasu confirms how it
wants online booking to run.

---

### 10. Decisions

**1. Seven statuses, not five.** `phase_09.md` §5 suggests
`pending/confirmed/cancelled/completed/no_show`; `docs/DATABASE.md` §11 — the
owning document for the data model — documents
`requested → confirmed → checked_in → in_consultation → completed` with
cancellation branches. The enum is the union, using `requested` rather than
`pending` so every later phase reads one vocabulary.

Declaring the unreachable values now is not speculation, it is avoiding a trap:
PostgreSQL will not let a value added by `alter type ... add value` be *used*
in the same transaction, and Supabase applies each migration in one. A later
phase adding and using a status in a single migration would fail. An enum value
nothing writes costs nothing.

**2. No `location_type` column.** The spec's conceptual model lists one, and
the spec also says to adapt to the existing architecture. The clinic offers
in-person consultation at one verified address and telemedicine is explicitly
out of scope, so the column could only ever hold one value — which is no
information. The screens render the verified address from `config/clinic.ts`.
The column arrives with the second mode.

**3. One `patient_note`, not a `reason` as well.** §8 lists both. Two free-text
fields on a booking form is an invitation to describe symptoms in one of them.
There is one, it is bounded, and its label and helper text say it is for
practical scheduling matters.

**4. No client write grant at all.** The alternative was RLS with a `with
check` constraining `status = 'requested'` and ownership. That cannot express
"the duration must match the type" or "this must be inside working hours", so
the interesting rules would have lived only in application code — and a client
holding the anon key can post directly to PostgREST. Putting every write behind
a `security definer` function makes the argument list the allowlist.

**5. Slot generation in TypeScript, validation in SQL.** Reasoned in §3 above.

**6. `assertResourceOwner` is still unused, and for a better reason than
Phase 08 anticipated.** Phase 08 recorded it as the primitive Phase 09 would
consume "the moment a record is addressed by its own id". An appointment *is*
addressed by its own id — but the ownership check ended up in the database,
resolving the row by id **and** by the caller's own patient record in one
statement. That is strictly better than reading the row and then comparing:
there is no window between the two, and a wrong id and somebody else's id are
indistinguishable to the caller. The helper stays, tested, for a case that
genuinely needs it.

**7. A date strip, not a calendar.** §44 asks that available and unavailable
dates be clearly distinguished, past dates be unselectable, and the control
work on a phone and from a keyboard. A month grid satisfies the first two by
greying out most of itself and the last two only with a custom roving-focus
widget — the kind of component that looks finished and fails a keyboard test.
Only working days inside the horizon are offered, as real buttons, so there is
nothing misleading to tab through. The cost, stated plainly: a patient cannot
jump to a month; they extend the strip a fortnight at a time. `date-picker-strip.tsx`
records when that trade reverses.

**8. Unavailable times are absent, not disabled.** A disabled grid of greyed-out
times tells a patient nothing they can act on, and on a busy day it would bury
the three free times among forty that are not.

**9. The confirmation is the appointment's own page.** Rather than a separate
screen rendering what the form thought it did, the booking action redirects to
the appointment and the page renders the row. What is confirmed is therefore
whatever the database says, always.

**10. A doctor read policy with no surface.** Included deliberately: it is the
narrowest expression of the practitioner relationship §§33 and 36 ask this
phase to establish, it is scoped by a real relationship rather than by role, and
it is verifiable now. No permission in `config/permissions.ts` corresponds to
it; Phase 11 brings both the permission and the screen.

---

### 11. Verification

Executed on 2026-09-18:

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npm test` | **PASS — 1,513 tests, 58 files** (was 1,241) |
| Production build | `npm run build` | **PASS** — 36 pages; all public pages still static, the four appointment routes dynamic |
| Client secret scan | `npm run security:scan-bundle` | **PASS** — 159 files, 0 findings |
| Migrations | `supabase db push` | **PASS** — both applied to the linked project |
| Live database | 79 checks, real per-role JWTs | **PASS — 79/79** |
| Live browser | 64 checks, real Chrome, production build | **PASS — 64/64** |
| Live axe, real computed contrast | 11 sweeps across 390px and 1280px | **PASS** — 0 violations |
| Live overflow | 9 widths × 8 pages, fresh layout each | **PASS** — none |
| E2E | — | **NOT RUN** — no E2E tool is installed (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

New test files and what they cover are tabulated in `docs/QA_STRATEGY.md`.

---

### 12. Acceptance criteria

#### Appointment model

| Criterion | Result |
| --- | --- |
| Appointment database model exists | PASS — `public.appointments`, applied and verified live |
| Patient relationship is secure | PASS — derived from `auth.uid()` inside the database; verified live that B cannot reach A's |
| Practitioner relationship is secure | PASS — FK to `practitioners`, `restrict` on delete; the doctor policy is scoped by relationship |
| Appointment type is trusted/configured | PASS — duration and buffer read server-side; not a parameter |
| Status values are constrained | PASS — a database enum, plus a transition trigger; verified live |
| Timestamps are timezone-safe | PASS — `timestamptz` throughout; an input instant must carry an offset |

#### Availability

| Criterion | Result |
| --- | --- |
| Practitioner schedule model exists | PASS — `practitioner_availability`, split days supported |
| Working hours are respected | PASS — engine tests, and `assert_bookable_slot` live |
| Existing appointments are excluded | PASS — engine tests and live |
| Blocked/unavailable periods are respected | PASS — live, including that the reason never surfaces |
| Past slots are unavailable | PASS — engine tests and live (`PV005`) |
| Booking rules are enforced | PASS — notice, horizon, grid, per-patient cap; all live |

#### Booking

| Criterion | Result |
| --- | --- |
| Authenticated patient can book | PASS — live database and live browser |
| Patient identity is derived securely | PASS — `current_patient_id()`, no argument |
| Client cannot assign another patient | PASS — no parameter; verified live |
| Client cannot control trusted duration/status | PASS — no parameter; verified live |
| Booking is server-authorized | PASS — permission in the action, role and ownership in the database |
| Booking conflicts are atomically prevented | PASS — exclusion constraint; two concurrent requests, one succeeded |

#### Rescheduling / cancellation

| Criterion | Result |
| --- | --- |
| Cancellation is authorization-controlled | PASS — live for all five actors |
| Cancellation preserves appointment history | PASS — row, note and events survive; verified live |
| Rescheduling is authorization-controlled | PASS — live |
| Rescheduling revalidates availability | PASS — same `assert_bookable_slot`, same constraint |
| Invalid status transitions are rejected | PASS — trigger; three refusals verified live |

#### Security

| Criterion | Result |
| --- | --- |
| RLS is enabled/configured appropriately | PASS — six tables, per-operation, no blanket policy |
| Cross-patient access is denied | PASS — read, cancel and reschedule, live |
| IDOR attempts fail | PASS — and a missing appointment is indistinguishable from somebody else's |
| Privilege escalation attempts fail | PASS — receptionist, doctor, admin and `anon`, live |
| Sensitive data is not publicly exposed | PASS — `anon` has nothing; `internal_note` has no grant; pages are `noindex` and `no-store` |
| Service-role credentials are never exposed | PASS — unused by the feature; bundle scan clean |

#### UX

| Criterion | Result |
| --- | --- |
| Booking flow is complete | PASS — five steps, driven end to end in a real browser |
| Appointment list exists for patients | PASS — upcoming, past, cancelled |
| Appointment detail exists | PASS |
| Loading states exist | PASS — route skeleton and an announced slot-loading region |
| Empty states exist | PASS — no appointments, no times, no bookable days, no practitioner, no profile |
| Error states exist | PASS — failed list read, failed slot load with retry, failed write with safe copy |
| Confirmation state reflects actual server status | PASS — renders the row; says "requested" |
| Cancellation/rescheduling UX is safe | PASS — dialog with confirmation; reschedule is its own page |
| Mobile experience is polished | PASS — no overflow at nine widths; targets ≥24px at 390px |
| Accessibility requirements are met | PASS — 0 axe violations with real computed contrast at 390px and 1280px |

#### Engineering

| Criterion | Result |
| --- | --- |
| Existing design system is reused | PASS — tokens only; no new colour, radius or shadow. One opacity derivative was introduced and removed when it failed AA |
| Existing authentication/authorization architecture is reused | PASS — no second mechanism |
| No unnecessary client-side security logic | PASS — the client decides what to render; the server and the database decide what happens |
| TypeScript remains strict | PASS — no `any` added |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

```text
Determine availability -> Allow authorized booking -> Prevent conflicts
-> Track appointment status -> Allow permitted cancellation
-> Allow permitted rescheduling -> Preserve appointment history
```

Every step is implemented and verified against the live database. The system is
safe under concurrent requests — demonstrated, not argued — and under malicious
client input, because the values that matter are not inputs.

---

### 13. Known issues

1. **No practitioner is configured for online booking in production**, so the
   booking page renders its "not open yet" state. Intended: the clinic has
   confirmed no practitioner and no working hours. Practitioner and availability
   administration is Phase 10/11's.
2. **The consultation types, durations, minimum notice and booking horizon are
   provisional**, and the booking page says so. They must be confirmed before
   launch.
3. **No receptionist or doctor appointment surface**, and therefore no
   confirmation, check-in, completion or no-show action. An appointment stays
   `requested` until Phase 10 gives somebody the ability to confirm it. The
   product says so to the patient.
4. **The doctor read policy has no application surface.** Deliberate; see
   Decision 10.
5. **`appointments.patient_id` cascades from the patient record**, which
   cascades from the account. Appointment history that must outlive an account
   cannot hang off that chain — the phase that settles retention has to revisit
   it (`docs/DATABASE.md` §13).
6. **No notification of any kind.** Phase 15. The appointment events table and
   the log events are shaped for it.
7. **`src/types/database.ts` is still hand-written.** `npm run db:types`
   requires Docker. The shape was written against the migrations and every
   table and function it declares was exercised live.
8. **The four Phase 08 test accounts and the seeded development practitioner
   remain on the development project.** Shared, well-known credentials. Delete
   them before this database takes real patient data.
9. **No E2E tool, no screen-reader pass, no Lighthouse run.** Unchanged since
   Phase 01/02. The live browser checks are a script written for this phase,
   not a maintained suite.
10. **Still no CSP.** Unchanged since Phase 02.
11. **Legal pages still do not exist.** Required before the clinic handles real
    records through this website.

---

### 14. Deferred work

* Receptionist appointment management: the clinic diary, booking on a patient's
  behalf, confirmation, check-in (Phase 10). The permissions and the RLS
  policies arrive with those screens.
* The doctor dashboard and today's schedule (Phase 11); the relationship and
  its policy already exist.
* Practitioner, availability and appointment-type administration.
* Appointment reminders and confirmations (Phase 15).
* Appointment analytics (Phase 16); the timestamps and status history are
  shaped for it.
* A cancellation cutoff and a reschedule rule, if the clinic asks for them —
  both are a change to `appointment_booking_rules()` and its mirror.
* Clinic settings replacing `config/appointments.ts` and `config/clinic.ts`.
* E2E tooling, a manual screen-reader pass, Lighthouse.
* Content-Security-Policy.
* Regenerating `src/types/database.ts` from the live project.

---

### 15. Phase status

```text
Phase 09: COMPLETE
Ready for Phase 10: YES
```

Phase 10 has not been started.

The receptionist workspace can be built directly on what exists: an
`appointments.manage.any` permission added to `config/permissions.ts` in the
same change as the surface it protects, a `PROTECTED_AREAS` entry, RLS policies
for the receptionist role, and `security definer` functions for the staff
writes — following `book_appointment`'s shape, so the patient derivation
becomes an explicit, authorized patient selection. The availability engine, the
status matrix, the conflict guarantee and the timezone layer are all reusable
unchanged.
