## PHASE 11 — Doctor Dashboard & Clinical Workspace

Status:
COMPLETED — migration applied to the live Supabase project, verified against
it with real per-role JWTs, and driven through a real browser

Completed On:
2026-09-18

Summary:
Built the practitioner's workspace: a protected `/doctor` area with today's
schedule, the current and next patient, an appointment list with useful
filters, appointment detail, care-scoped patient search, a patient summary
with appointment history, operational status actions, and a consultation
entry point that changes real appointment state and persists nothing
clinical.

**No scheduling logic was written.** The Phase 09 engine is reused entire:
one status matrix, one timezone layer, one error mapper, one set of schedule
helpers. The two helpers Phase 10 wrote inside the reception feature moved
down into `features/appointments/schedule.ts` rather than being copied, so
both workspaces now share them.

**No client role can write `public.appointments`.** Still no insert, update
or delete grant and still no such policy, for anybody. Every doctor write is
a `security definer` function that re-checks the role, resolves the caller's
*own* practitioner record, and resolves the appointment by id **and** by that
practitioner in one statement.

**A doctor's access to a patient is a relationship, not a role.** The policy
is an appointment between that patient and the caller's own practitioner
record. A doctor with no appointment with somebody reads nothing about them,
cannot find them by searching, and cannot act on their appointments — and two
doctors at the same clinic are isolated from each other, verified in both
directions.

2,187 tests pass, up from 1,830. **71 live database checks** with real
per-role JWTs, including two doctors, a doctor account with no practitioner
record, and the full consultation lifecycle. **133 live browser checks**
driving the production build through Chrome.

**One real accessibility defect was found by the browser pass and fixed — and
the same defect turned out to have shipped in Phase 10.** It is described in
full below, because the class of it is worth remembering.

---

### Repository assessment before starting

Phases 06–10 left identity, the patient record, authorization, the
appointment engine and the front desk. Reused rather than rebuilt:
`requireAreaAccess`/`requirePermission`/`assertPermission`,
`config/permissions.ts`, the Supabase clients, `AppError`, the structured
logger, `uuidSchema`, `instantSchema`, `clinicDateSchema`, the whole
`features/appointments` domain layer, `AppointmentStatusBadge`,
`AppointmentHistory`, `appointmentReference`,
`ProfileSection`/`ProfileFieldList`/`ProfileField`, the `Table` family,
`Field`, `NativeSelect`, `Dialog`, `Toaster`, `EmptyState`, `ErrorState`,
`NavLink` and the Phase 07 patient formatters.

Four findings shaped the work:

* **Phase 09 already shipped the relationship this phase needed, unused.**
  `appointments_select_own_practitioner` scopes a doctor to their own diary
  by the practitioner relationship rather than by the doctor role, and
  `current_practitioner_id()` exists to support it. Phase 09 recorded both as
  deliberately having no caller. This is the phase that uses them, and it
  creates neither again.
* **`docs/SECURITY.md` §6 already decides the patient-access model**:
  *"Doctors can access the clinical records of patients they are treating,
  scoped by treatment relationship rather than by role alone."*
  `phase_11.md` §16 asks for the model to be chosen explicitly and warns
  against clinic-wide access "because it is easier". The documented answer is
  the appointment-linked model, so that is what was built.
* **`PROTECTED_PATH_PREFIXES` did *not* list `/doctor`.** Phase 06 listed
  `/staff` speculatively but not this path, so it had to be added, alongside
  a `robots.txt` entry.
* **`features/reception/queries.ts` held two pure helpers this workspace
  needed identically** — `currentAndNext` and the upcoming/past split. Copying
  them would be the duplicated scheduling logic `docs/PRODUCT_SPEC.md` §5A and
  `phase_11.md` §10 forbid, so they moved down to the shared domain layer and
  reception now delegates.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260922120000_doctor_workspace.sql

src/features/appointments/schedule.ts        shared pure schedule helpers

src/features/doctor/types.ts                 the operational domain model
src/features/doctor/status.ts                what a practitioner may do
src/features/doctor/status.test.ts
src/features/doctor/validation.ts            the trust boundary
src/features/doctor/validation.test.ts
src/features/doctor/content.ts               all workspace copy
src/features/doctor/queries.ts               authorized, column-scoped reads
src/features/doctor/actions.ts               two server actions

src/components/doctor/doctor-nav.tsx
src/components/doctor/day-summary.tsx
src/components/doctor/doctor-schedule.tsx
src/components/doctor/next-patient.tsx
src/components/doctor/appointment-filters.tsx
src/components/doctor/appointment-status-actions.tsx
src/components/doctor/care-patient-search.tsx
src/components/doctor/patient-summary.tsx

src/app/(app)/doctor/layout.tsx
src/app/(app)/doctor/page.tsx
src/app/(app)/doctor/loading.tsx
src/app/(app)/doctor/appointments/page.tsx
src/app/(app)/doctor/appointments/loading.tsx
src/app/(app)/doctor/appointments/[id]/page.tsx
src/app/(app)/doctor/appointments/[id]/consultation/page.tsx
src/app/(app)/doctor/patients/page.tsx
src/app/(app)/doctor/patients/[id]/page.tsx
src/app/(app)/doctor/patients/[id]/loading.tsx

tests/integration/doctor-actions.test.ts
tests/integration/doctor-security.test.ts
tests/components/doctor.test.tsx
docs/progress/progress_phase_11.md
```

#### Modified

```text
src/config/permissions.ts               three doctor permissions
src/config/permissions.test.ts          the speculative list, narrowed
src/lib/authorization/routes.ts         PROTECTED_AREAS.doctor
src/lib/authorization/routes.test.ts
src/lib/authorization/policy.test.ts    the exhaustive matrix, extended
src/lib/auth/paths.ts                   /doctor protected
src/app/robots.ts                       /doctor disallowed
src/types/database.ts                   five new functions
src/features/admin/content.ts           the doctor's account-page next step
src/features/appointments/errors.test.ts  reads the new migration too
src/features/reception/queries.ts       delegates to the shared helpers
tests/components/authorization.test.tsx

src/features/reception/content.ts       three table captions — see Defect 1
src/app/(app)/receptionist/page.tsx     "
src/app/(app)/receptionist/patients/[id]/page.tsx   "

docs/ARCHITECTURE.md, docs/SECURITY.md, docs/QA_STRATEGY.md,
docs/DESIGN_SYSTEM.md
```

#### Dependencies

**None added.**

---

### 2. Database

`supabase/migrations/20260922120000_doctor_workspace.sql`, applied to the
linked project with `supabase db push` and verified against it.

```text
Tables changed:   none. No table was created, altered or dropped.
Migrations:       1 (20260922120000_doctor_workspace.sql)
Indexes:          1 added
Constraints:      none added, none altered
Enums:            none added, none altered
Triggers:         none added, none altered
RLS policies:     2 added (both SELECT), 0 altered, 0 dropped
Functions/RPCs:   5 added, 0 replaced
Grants:           5 function grants; **no table grant at all**
```

#### Functions

| Function | Purpose |
| --- | --- |
| `doctor_has_care_relationship(uuid)` | **The whole patient-access policy.** True when an appointment exists between the calling practitioner and this patient. Takes a patient id and answers only about the caller's own practitioner record — there is no practitioner argument, so a doctor cannot ask whether some other doctor treats somebody |
| `doctor_owns_appointment(uuid)` | The same shape, for the appointment history |
| `assert_care_practitioner()` | The single authorization gate. Refuses no session, a non-doctor, and a doctor with no practitioner record — three raises, all `insufficient_privilege` — and **returns the practitioner id**, so every function below derives it rather than accepting one |
| `search_care_patients(text, integer)` | Bounded search restricted to the caller's own care scope, in the `from` clause rather than in a predicate a later edit could drop |
| `update_appointment_status_as_doctor(uuid, appointment_status)` | Confirm, start, complete, no-show. No practitioner parameter, no reason parameter. Resolves the appointment by id **and** by the caller's own practitioner id in one statement |

Both predicates are `security definer` for the reason the Phase 09 fix
records at length: a policy expression is evaluated with the *calling* role's
privileges, and a policy that raises takes out the query for **every** caller
because policies are OR-ed and all of them are evaluated. That defect cost
Phase 09 a second migration; this phase inherits the lesson rather than the
defect.

#### RLS policies added

```text
patients_select_doctor_care                 SELECT  has_app_role('doctor')
                                                    and doctor_has_care_relationship(id)
appointment_events_select_own_practitioner  SELECT  has_app_role('doctor')
                                                    and doctor_owns_appointment(appointment_id)
```

Four properties, each asserted by test and verified live:

* **Both name the role *and* scope by relationship.** `phase_11.md` §§11, 23
  and 45 all require the second half: holding the doctor role must not by
  itself reach a patient or an appointment. There is no `using (true)` and no
  `auth.uid() is not null` anywhere in the migration.
* **No insert, update or delete policy was added**, and **no table grant was
  issued at all.** A doctor reads `public.patients` through the existing
  table-wide select grant, narrowed by the policy; widening a *column* grant
  would widen it for every `authenticated` role at once, which is the trap
  Phase 10 recorded about `internal_note`.
* **No policy was dropped.** There is no `drop policy` in this migration, so a
  patient's own-record policies, the receptionist's operational ones and the
  practitioner's own-diary policy all still say exactly what they said.
* `schedule_exceptions` still has RLS and **no policy at all**, for anybody.
  Verified live: a doctor reads zero rows.

#### Index

`appointments_practitioner_patient_idx (practitioner_id, patient_id)` — the
care-relationship predicate is an equality on that pair, evaluated once per
candidate row on every doctor read of `public.patients`. Phase 09 indexed
`(practitioner_id, starts_at)` and Phase 10 `(starts_at)`; neither serves it.

---

### 3. The patient-access policy, decided and documented

`phase_11.md` §16 requires this to be an explicit, recorded decision. It is
the **appointment-linked model**:

```text
a doctor may read a patient record when an appointment exists
between that patient and the doctor's own practitioner record
```

and nothing else. It implements `docs/SECURITY.md` §6's "scoped by treatment
relationship rather than by role alone", and it is enforced in the database
rather than in application code, so no query anywhere can widen it.

**Why an appointment of any status counts.** The narrower alternative —
excluding cancelled appointments — was considered and rejected, because it is
incoherent with what the doctor can already see. A cancelled appointment
still appears in their own diary (Phase 09's policy has no status predicate),
so hiding the patient's name from a row already on their screen would show
them an appointment with nobody in it. The relationship is established by the
appointment existing, which is the patient having asked to be seen by this
practitioner. Widening or narrowing that later is a change to one function.

**What it is not.** Not clinic-wide. A doctor cannot search the clinic's
patient list, cannot open a patient they have never been booked to see, and
cannot read what a colleague did — the appointment history on a patient page
is *this practitioner's own*, because row-level security restricts the
appointments table to their diary. All verified live, in both directions.

---

### 4. Routes and components

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/doctor` | Dynamic | Today: four counts, who is with them now, who is next, the day |
| `/doctor/appointments` | Dynamic | Everything booked with them, with range, status and type filters |
| `/doctor/appointments/[id]` | Dynamic | One appointment, and what can still be done about it |
| `/doctor/appointments/[id]/consultation` | Dynamic | The consultation workspace — the Phase 12 entry point |
| `/doctor/patients` | Dynamic | Care-scoped patient search |
| `/doctor/patients/[id]` | Dynamic | Patient context and appointment history |

All six are `noindex`, `private, no-store` and disallowed in `robots.txt` —
each verified in a browser. **All 30 public pages remain static**; the build
output confirms it.

Three loading routes render structured skeletons in the shape of the page.

Components are indexed in `docs/DESIGN_SYSTEM.md` §`src/components/doctor/`.
Seven of the eight are server components; `DoctorAppointmentFilters`,
`DoctorAppointmentActions` and `CarePatientSearch` are the client islands,
and the first of those declines to use the interactivity the directive buys —
it is a plain `GET` form that works before hydration.

---

### 5. Appointment integration

```text
Doctor UI
   → server authentication            (app)/layout.tsx, requireUser()
   → doctor authorization             (app)/doctor/layout.tsx, requireAreaAccess
   → per-page permission              requirePermission(...)
   → per-action permission            can(user.role, ...)
   → Phase 09 appointment layer       features/appointments/*
   → security definer function        assert_care_practitioner() first
   → RLS                              the last word
```

No scheduling logic was written. Specifically:

| Reused from Phase 09 | Where |
| --- | --- |
| The transition matrix | `features/appointments/status.ts` — imported, never restated |
| The database trigger | `appointments_guard_transition()` — untouched |
| The timezone layer | `features/appointments/time.ts` |
| The error mapper | `features/appointments/errors.ts` — no new SQLSTATE was needed |
| The appointment types | `getActiveAppointmentTypes()` — the same query both staff workspaces use |
| The history table and component | `appointment_events`, `AppointmentHistory` |
| The status badge and its vocabulary | `AppointmentStatusBadge` |
| The practitioner relationship | `current_practitioner_id()`, `appointments_select_own_practitioner` |

And the one thing that moved rather than being copied: `currentAndNext` and
the upcoming/past split, now in `features/appointments/schedule.ts` and
generic over the three appointment shapes. `features/reception/queries.ts`
re-exports them, so its callers are unchanged.

#### Status actions

The doctor's allowlist is the **complement** of the front desk's, not a
subset:

```text
receptionist   confirmed, checked_in, no_show, cancelled
doctor         confirmed, in_consultation, completed, no_show
```

`in_consultation` and `completed` are exactly the two Phase 10 refused the
desk on the grounds that they describe what happened in the consulting room.
This is the role that was in it, and `phase_11.md` §21 lists completion as a
doctor action.

`cancelled` is deliberately absent, and so is rescheduling — not as a hidden
control but as an absent capability: no permission, no server action, no RPC.
Both change a patient's plans and need somebody to tell them, so they stay at
the front desk where the actor is recorded. The workspace says so in a
sentence rather than offering a control that would be refused.

#### The consultation entry point

`phase_11.md` §§19, 20 and 51, and example 8. Phase 11 establishes
`Doctor dashboard → Patient → Consultation entry`, and Phase 12 implements
the clinical record that follows.

"Start consultation" moves an appointment from `checked_in` to
`in_consultation` and writes one `appointment_events` row. That is a real
state change on a value Phase 09 declared in `appointment_status` and
deliberately left unreachable until a practitioner had a workspace — **not**
invented clinical persistence. The consultation page carries the patient's
context, this appointment, the practitioner's previous appointments with
them, and the completion action.

It has **no form, no text area and no text input**, verified in a browser,
and it says out loud that there is nowhere to record notes yet so a
practitioner keeps using their existing notes rather than typing into
something that discards them. Phase 12 adds the record to this page; the
route, the authorization, the context and the completion action do not move.

---

### 6. Patient access and search

| Property | How |
| --- | --- |
| Authorized | `assertPermission("patients.read.care")`, then the database's own role check, then RLS |
| Scoped | To the caller's own care scope, in the `from` clause of `search_care_patients` and in `patients_select_doctor_care` for a direct read |
| Server-side | A server action; nothing is filtered in the browser and the patient list is never sent to it |
| Bounded | A term under two characters returns nothing; the function clamps its own limit to 50; verified live with `p_limit: 100000` |
| Not enumerable | An empty box is not a browse button. Verified live that empty, one-character and `%%` all return nothing |
| Privacy-conscious | A **POST**, so the term never reaches a URL — verified in a browser. Never logged, on success or failure |
| Minimal | Six columns: id, name, preferred name, phone, date of birth, and when this practitioner last saw them. No address, no emergency contact, no account identifier — asserted against the function's `returns table` and verified live |

The patient *record* a doctor reads is narrower than the front desk's:
no `address_line1`, `address_line2` or `postal_code`. `phase_11.md` §44 asks
for only the fields the workflow needs, and no Phase 11 workflow needs a
doorstep — the front desk holds it for the one thing it is for. The town and
state stay, because where somebody has travelled from is context a
practitioner uses. Verified in a browser that no street address renders.

Pagination: the search is **bounded rather than paged**. Twenty results, with
a visible notice saying so and asking the practitioner to narrow the search.
A care scope is tens of people, not thousands, and a page-two control on a
list nobody reads to the end is a control that exists to be unused. The bound
is enforced in the database, so this is a presentation decision on top of a
hard limit rather than instead of one.

---

### 7. Authorization and RLS changes

Three permissions added to `config/permissions.ts`, granted to the **doctor
role alone**:

| Permission | Covers |
| --- | --- |
| `appointments.read.own_schedule` | The practitioner's own diary — today, upcoming, past, one appointment |
| `appointments.manage.own_schedule` | Confirm, start, complete, no-show on their own appointments. No cancel, no reschedule |
| `patients.read.care` | Read and search the patients they are booked to see |

`PROTECTED_AREAS` gained a fourth entry, so the guard and the navigation read
the same table: a link cannot be offered for an area the guard will refuse,
and an area cannot acquire a link while nobody remembers to guard it. The
account page's doctor entry changed from "still being built" to a link.

**No clinical permission is declared.** `phase_11.md` §§18, 53 and 54 put
clinical records, prescriptions and treatment plans in later phases, and a
permission that protects nothing gets granted casually. A test asserts no
permission anywhere matches `/clinical|diagnos|prescription|treatment|…/`.

---

### 8. Security and adversarial results

#### Live database — 71 checks, real per-role JWTs

Run against the linked project by signing in as each account with the anon
key, so every check went through real RLS with a real `auth.uid()`. The
service-role client was used only to build and remove the fixture, never to
perform an operation under test. Synthetic data only; everything created was
deleted.

| Area | Result |
| --- | --- |
| `anon` cannot search, cannot change a status, reads no patient | PASS (3) |
| **Patient, receptionist and admin cannot search care patients** (`42501`) | PASS (3) |
| **Patient, receptionist and admin cannot change a status as a doctor** (`42501`) | PASS (3) |
| The care predicate is false for a patient, a receptionist and an admin | PASS (3) |
| A patient, an admin still read no patient record; a receptionist still reads the clinic's | PASS (3) |
| Doctor A reads their own appointment | PASS |
| **Doctor A cannot read doctor B's appointment (IDOR)** | PASS |
| **Doctor A cannot select `internal_note`** | PASS |
| Doctor A reads no blocked period | PASS |
| Doctor A reads a patient they are booked to see | PASS |
| **Doctor A cannot read a patient outside their care (IDOR)** | PASS |
| **A bare `select` on `patients` returns only the care scope** | PASS |
| The care predicate is false for somebody else's patient | PASS |
| Doctor A finds their own patient; the search discloses exactly six columns | PASS (2) |
| **Doctor A cannot find a patient outside their care** | PASS |
| One-character, empty and `%%` searches all find nothing | PASS (3) |
| `p_limit: 100000` returns at most 50 | PASS |
| **Doctor A cannot cancel, and cannot check a patient in** (`42501`) | PASS (2) |
| **Doctor A cannot act on doctor B's appointment** (`PV009`) | PASS |
| An unknown appointment is refused the same way (`PV009`) | PASS |
| `confirmed -> completed` refused as illegal (`PV008`) | PASS |
| Doctor A can confirm; confirming twice is a no-op | PASS (2) |
| **Doctor A can start and complete a consultation**, and the row really is `completed` | PASS (3) |
| A completed appointment cannot be reopened (`PV008`) | PASS |
| Every change is in `appointment_events`, against the acting account | PASS (2) |
| Doctor A reads their own history and none of doctor B's | PASS (2) |
| **Doctor A cannot insert, update or delete an appointment** | PASS (3) |
| **Doctor A's update and delete of a patient record change nothing; an insert is refused** | PASS (4) |
| **Doctor A cannot use the front desk's search, registration, booking or status function** (`42501`) | PASS (4) |
| **Doctor A cannot list accounts, assign a role, or promote themselves** | PASS (3) |
| **Doctor B cannot read, find or act on doctor A's patient or appointment** | PASS (4) |
| Doctor B can read their own patient | PASS |
| **A doctor with no practitioner record resolves to null, cannot search, and reads no patient** | PASS (3) |
| Phase 07/09/10 regressions: patient, receptionist and patient-write all unchanged | PASS (4) |

**71 passed, 0 failed.**

#### Live browser — 133 checks, real Chrome, production build

Signed in through the **real sign-in form** as each seeded account.

| | `/doctor` | `/doctor/appointments` | `/doctor/patients` | `…/[id]` | `…/consultation` |
| --- | --- | --- | --- | --- | --- |
| unauthenticated | → sign in | → sign in | → sign in | → sign in | → sign in |
| patient | → `/forbidden` | → `/forbidden` | → `/forbidden` | → `/forbidden` | → `/forbidden` |
| receptionist | → `/forbidden` | → `/forbidden` | → `/forbidden` | → `/forbidden` | → `/forbidden` |
| admin | → `/forbidden` | → `/forbidden` | → `/forbidden` | → `/forbidden` | → `/forbidden` |
| doctor | ✓ | ✓ | ✓ | ✓ | ✓ |

Every refused response was also checked to contain no patient name and no
phone number.

Also verified live:

* **Zero axe violations, with real computed colour**, on all six routes at
  both 390px and 1280px, plus the search-results state.
* **Zero horizontal overflow** at 320, 375, 390, 430, 768, 1024, 1280, 1440
  and 1920px on all six routes — measured with a fresh layout at each width,
  because a resize alone produced a false positive in Phase 09.
* Exactly one `<h1>`, no skipped heading level, and every visible target at
  least 24px, on every route.
* The consultation journey end to end: not-started state → Start consultation
  → the row really is `in_consultation` → the page opens, says there is
  nowhere to record notes, carries the patient's context, and has **no
  textarea and no text input** → Complete asks first → the row really is
  `completed`.
* The search term never reaches the URL; nothing is listed before a search;
  the results carry no address or emergency contact.
* **IDOR in a browser**: a patient outside the care scope renders "we
  couldn't find that patient" and does not disclose their name; an unknown
  appointment renders the same not-found.
* `private, no-store` on the workspace; `robots.txt` disallows `/doctor`.
* A visible focus outline; zero running animations under
  `prefers-reduced-motion`.
* Regression: `/`, `/services`, `/contact`, `/receptionist`,
  `/receptionist/schedule` and a receptionist patient page all axe-clean.

**133 passed, 0 failed.**

#### `phase_11.md` §§59-60 and §65's checklist

| Attempt | Result | Where proved |
| --- | --- | --- |
| Unauthenticated → doctor route | **DENIED** | Browser, five routes |
| Patient → `/doctor` | **DENIED** | Browser, six routes; live DB |
| Receptionist → doctor-only functionality | **DENIED** | Browser; live DB, all functions |
| Doctor → admin functionality | **DENIED** | Live DB (`42501`) on `assign_user_role` and `list_managed_users` |
| Doctor → permitted appointments | **ALLOWED** | Live DB and browser |
| Doctor → unauthorized patient | **DENIED** | Live DB by id and by search; browser |
| Cross-doctor access | **DENIED both ways** | Live DB, two doctors, two patients |
| IDOR | **DENIED**, and indistinguishable from not-found | Live DB and browser |
| Manipulated `doctorId` / `practitionerId` | **No effect** — no parameter, no schema field, asserted in the source | Validation tests, structural test |
| Manipulated `patientId` | **No effect** on a write — not a parameter. On a read, a filter the policy refuses | Live DB |
| Manipulated `appointmentId` | Validated as a UUID, then resolved by the caller's own practitioner id | Action tests, live DB |
| Manipulated `role` / `permission` | Rejected by `strict()`, never read from the form | Validation tests, action tests |
| Invalid status transition | **DENIED** (`PV008`), three layers | Live DB |
| Status the role may not set | **DENIED** (`42501`), three layers | Live DB |

---

### 9. Defects found and fixed

**1. Duplicate landmark names — three Phase 11 pages, and two Phase 10 pages.**
*(real, found only by the browser pass)*

axe reported `landmark-unique` on the doctor's appointment detail, patient
and consultation pages. Two causes, both the same shape:

* The appointment page's `<h1>` named the outer region "Appointment", and a
  `ProfileSection` inside it was titled "Appointment" too. Two `region`
  landmarks, one accessible name.
* `TableScroller` is a labelled `region`, and its label is the table's
  caption. A `<section>` headed "Previous appointments with you" containing a
  table captioned "Previous appointments with you" is the same collision.

Fixed by renaming the section title to "Appointment details", and by making
every caption in the workspace name the **ordering** as well as the contents
— "Previous appointments with you, most recent first". That makes the names
distinct *and* tells a screen-reader user something the sighted reader gets
from the column order for free.

Then the reception regression sweep found the identical defect on
`/receptionist` and `/receptionist/patients/[id]`, where it had shipped in
Phase 10 — because that phase ran no browser pass and recorded the omission
as its first known issue. Fixed the same way, in three strings.

**The component suite could not have caught it.** It renders a schedule on
its own, and the collision only exists once a page puts one inside a section.
So the regression guard is on the copy — a caption may never equal the
heading above it — which is a cheap assertion for a defect that costs a real
browser to see.

**2. `landmark-unique` was invisible to 2,180 passing tests**, to ESLint, to
the type checker and to review. That is the third phase running in which the
browser pass found something nothing else could — after Phase 08's 35px
overflow and Phase 09's 3.89:1 contrast failure — and it is the argument for
never skipping it again.

#### Three harness bugs, recorded because a report listing only what passed is not evidence

* **"doctor A reads no blocked period" failed with `42501`.** The assertion
  expected zero rows; the database refused at the *privilege* check, before
  RLS was consulted, because `schedule_exceptions` has no grant at all. That
  is stronger than what was asserted. The check now accepts either shape and
  asserts the thing that matters: no row comes back.
* **"doctor A cannot update a patient record" failed with no error.** Also
  correct behaviour: `grant update (...) on public.patients` is held by the
  database role `authenticated`, which a doctor is, so the privilege check
  passes and RLS decides — and with no matching policy the statement affects
  **zero rows** and PostgREST answers 204. The assertion was rewritten to read
  the row back and prove nothing changed, which is what it should have said in
  the first place. Insert and delete were added alongside it.
* **"today shows no clinical word" failed on the word "prescriptions".** It is
  in the scope notice, which deliberately names the capabilities that are *not*
  built — `phase_11.md` §18's permitted placeholder. The sweep now excludes the
  notice and asserts everything outside it.

#### And the stale-server trap, for the fourth phase running

Phases 06, 07 and 08 each recorded it; it struck again. On Windows
`next start` survives a `kill()` of the shell that spawned it, so the second
verification run connected to a server still serving the **previous** build
and reported a correct fix as broken. `Get-NetTCPConnection -LocalPort <port>`
plus `Stop-Process` is what actually stops it; the harness now uses a fresh
port per run.

---

### 10. Verification

Executed on 2026-09-18:

```text
Lint:       PASS — npx eslint . --max-warnings=0, 0 problems
Typecheck:  PASS — npm run typecheck, exit 0
Formatting: PASS — npx prettier --check .
Tests:      PASS — 2,187 tests, 68 files (was 1,830 / 63)
Build:      PASS — npx next build, 36 static pages, no warnings
```

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 2,187 / 68 files** |
| Production build | `npx next build` | **PASS** — all 30 public pages still static; the 6 doctor routes dynamic |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 168 files, 0 findings |
| Migration | `supabase db push` | **PASS** — applied to the linked project |
| Live database | 71 checks, real per-role JWTs | **PASS — 71/71** |
| **Live browser** | 133 checks, real Chrome, production build | **PASS — 133/133** |
| Live axe, real computed colour | 6 routes × 2 widths, plus 3 reception and 3 public pages | **PASS** — 0 violations |
| Live overflow | 9 widths × 7 pages, fresh layout each | **PASS** — none |
| E2E | — | **NOT RUN** — no E2E tool is installed (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

---

### 11. Acceptance criteria

#### Doctor workspace

| Criterion | Result |
| --- | --- |
| Doctor has a dedicated protected workspace | PASS — `/doctor`, guarded in the layout, verified live for all five actors |
| Today's schedule is visible | PASS — the default page, with day stepping |
| Current/next appointment is easy to identify | PASS — two panels above the day, from a real comparison against stored instants |
| Upcoming appointments are available | PASS — `/doctor/appointments?range=upcoming`, the default range |
| Appointment statuses are clear | PASS — icon + word, never colour alone |
| Useful appointment filters exist | PASS — range, status and type. **No practitioner filter**, per §12 |
| Workspace is responsive | PASS — cards below `md`, table above; **measured at nine widths in a browser**, no overflow |

#### Patient access

| Criterion | Result |
| --- | --- |
| Doctor can search authorized patients | PASS — live and in a browser |
| Patient search is server-side and bounded | PASS — live, including `p_limit: 100000` |
| Basic patient context is available | PASS — name, preferred name, date of birth, derived age, gender, language, phone, town, emergency contact |
| Patient access follows documented care/authorization policy | PASS — the appointment-linked model, decided in `docs/SECURITY.md` §6, enforced by `patients_select_doctor_care`, documented in §3 above |
| Cross-patient IDOR is prevented | PASS — live by id and by search, and in a browser |

#### Appointment

| Criterion | Result |
| --- | --- |
| Doctor appointment views reuse Phase 09 | PASS — asserted structurally; no scheduling logic written, and two helpers moved down rather than copied |
| Appointment detail works | PASS |
| Permitted status actions work | PASS — live, all four |
| Invalid transitions are rejected | PASS — three layers; live (`PV008`, `42501`) |
| Doctor identity is derived securely | PASS — `assert_care_practitioner()` from `auth.uid()`; no parameter anywhere |
| Unauthorized appointments cannot be accessed | PASS — live, both directions, and indistinguishable from not-found |

#### Clinical boundary

| Criterion | Result |
| --- | --- |
| No clinical record persistence is implemented | PASS — no table, no column, no form, no text input; asserted structurally and in a browser |
| No diagnosis functionality | PASS |
| No prescription functionality | PASS |
| No treatment-plan functionality | PASS |
| No AI clinical functionality | PASS — no model, no key, no call |
| Consultation entry point is correctly separated from Phase 12 | PASS — it changes an appointment status Phase 09 already declared, persists nothing clinical, and says so on the page |

#### Security

| Criterion | Result |
| --- | --- |
| Doctor routes are protected | PASS — proxy, layout guard, per-page permission; 30 browser checks across five actors |
| Server authorization is enforced | PASS — every action and every query checks; the database re-checks |
| RLS protects patient/appointment access | PASS — two relationship-scoped policies; 71 live checks |
| Client-controlled IDs cannot bypass authorization | PASS — no practitioner id exists to send; an appointment id is resolved by the caller's own practitioner |
| Doctor cannot gain admin privileges | PASS — live (`42501`) on role assignment, account listing and a direct `user_roles` write |
| Sensitive data is not stored in browser storage | PASS — nothing in this feature writes `localStorage` or `sessionStorage` |
| Private pages are not publicly cacheable/indexable | PASS — `private, no-store` and `noindex` verified in a browser; `robots.txt` disallows |

#### UX

| Criterion | Result |
| --- | --- |
| Punarvasu design system is reused | PASS — tokens only; no new colour, radius, shadow or spacing value |
| Loading states exist | PASS — three structured skeletons |
| Empty states exist | PASS — nothing today, nothing in range, no filter match, nothing searched yet, too short, no results, no upcoming, no history, no practitioner record |
| Error states exist | PASS — a failed read is distinguished from an empty one everywhere |
| Responsive layouts work | PASS — **measured**, nine widths, seven pages |
| Accessibility requirements are met | PASS — **0 axe violations with real computed contrast** at 390px and 1280px on every route; one `h1`; no skipped level; targets ≥24px; focus visible; reduced motion respected |

#### Engineering

| Criterion | Result |
| --- | --- |
| No duplicate appointment logic exists | PASS — asserted structurally, and two existing helpers were de-duplicated in the process |
| Existing Phase 08/09 architecture is reused | PASS — no second mechanism anywhere |
| TypeScript remains strict | PASS — no `any` added |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

```text
Login → Doctor workspace → today's appointments → identify the next patient
     → open authorized patient context → review appointment history
     → enter the consultation workflow
```

Every step was driven end to end in a real browser against the production
build. The boundaries hold, each verified live:

```text
Doctor ✕ unauthorized patient      — RLS by care relationship, both directions
Doctor ✕ another doctor's diary    — PV009, indistinguishable from not-found
Doctor ✕ admin functionality       — 42501
Doctor ✕ clinical persistence      — nothing to persist, nowhere to type
```

---

### 12. Deferred

Intentionally not built:

* **Clinical records, diagnosis, symptoms, vitals, notes and assessments** —
  Phase 12. The consultation page is the seam they land on; the route, the
  authorization, the patient context and the completion action already exist.
* **Prescriptions and treatment plans** — Phase 13. No permission, no field,
  no navigation placeholder.
* **Patient clinical documents** — Phase 14.
* **AI clinical decision support** — Phase 17. No model, no key, no call.
* **Notifications** — Phase 15. Nothing tells a patient their appointment was
  confirmed or completed; `appointment_events` is shaped for it.
* **Analytics** — Phase 16.
* **Cancelling and rescheduling from the doctor workspace.** Deliberate: both
  change a patient's plans and need somebody to tell them. A practitioner
  asks the front desk, which records who did it.
* **A week or month calendar.** The day view with stepping is the default
  `phase_11.md` §28 asks for; a grid is seven columns of the same information
  on a tablet.
* **Realtime.** §35 makes it optional and permits revalidation instead. Every
  status action revalidates the pages that show it.
* **Global search across appointments.** §30 scopes search to patients and
  appointments; the appointment list's filters answer the appointment half,
  and a second search box would be a second thing to secure.
* **Paged patient search.** Bounded at twenty with a visible notice instead.
  A care scope is tens of people, and the bound is enforced in the database.
* **Practitioner self-service** (own profile subset, leave requests) — the
  matrix marks it "Own, request leave"; there is no administrative surface for
  availability at all yet.
* **Moving `ProfileSection`/`ProfileFieldList`/`ProfileField` to
  `components/shared/`.** Four areas now depend on them, which more than earns
  the move; it belongs on its own change rather than inside this one.

---

### 13. Known issues

1. **The clinic has no verified practitioner.** The development project's
   seeded practitioner is named "Test Doctor", and `features/practitioners/`
   still publishes nobody. The workspace works; the roster is development
   data.
2. **A doctor account not on the scheduling roster gets a notice, not a
   workspace.** Correct — and it means adding a practitioner is still a
   migration or a script, because there is no administrative surface for it.
3. **The consultation types, durations, minimum notice and booking horizon
   are still provisional.** Unchanged from Phase 09.
4. **No audit of patient-record *access*.** `appointment_events` records every
   status change with its actor, and the structured log records each operation
   against an opaque user id — but a doctor reading a patient is not recorded.
   `docs/SECURITY.md` §15 lists that as something to record "where
   appropriate", and it belongs with Phase 19's audit subsystem.
5. **The doctor's appointment history for a patient is their own, not the
   clinic's.** That is the treatment-relationship scoping working as designed,
   and it is worth stating: a practitioner covering for a colleague sees only
   what was booked with them. If the clinic wants shared history, that is a
   product decision with its own policy, not a query change.
6. **`src/types/database.ts` is still hand-written.** `npm run db:types`
   requires Docker. The shape was written against the migration and every
   function it declares was exercised live.
7. **The four Phase 08 test accounts and the seeded practitioner remain on the
   development project.** Shared, well-known credentials, including an
   administrator. Delete them before this database takes real patient data.
8. **No E2E tool, no screen-reader pass, no Lighthouse run.** Unchanged since
   Phase 01/02. The live browser checks are a script written for this phase,
   not a maintained suite.
9. **Still no CSP.** Unchanged since Phase 02.
10. **Legal pages still do not exist.** Required before the clinic handles
    real records through this website.

---

### 14. Phase status

```text
Phase 11: COMPLETE
Ready for Phase 12: YES
```

Phase 12 has not been started.

Clinical records can be built directly on what exists. The care relationship
is decided in one place — `public.doctor_has_care_relationship()` — so a
`clinical_records` table's policy is `has_app_role('doctor') and
doctor_has_care_relationship(patient_id)` and nothing new has to be reasoned
out. The consultation route is already authorized, already scoped and already
carries the patient's context; Phase 12 adds the record to it, plus its own
permission in `config/permissions.ts` in the same change as the surface that
uses it — the rule every phase since 08 has followed.

One caveat to carry forward: `docs/SECURITY.md` §6 also says a receptionist
**cannot** read clinical notes, assessments, treatment plans or
prescriptions. Today that is true because none exists. Phase 12 is the phase
where it stops being free and has to be enforced — with its own table, its
own policies, and no column grant to `authenticated` that a receptionist
shares.
