## PHASE 10 — Receptionist Workspace

Status:
COMPLETED — migration applied to the live Supabase project and verified
against it

Completed On:
2026-09-18

Summary:
Built the front desk: a protected `/receptionist` workspace with today's
schedule, a day-by-day clinic diary with filters, bounded server-side patient
search, operational patient records, walk-in registration with duplicate
warning, booking on a patient's behalf, confirmation, check-in, no-show,
cancellation and rescheduling.

**No scheduling logic was written.** The Phase 09 engine is reused entire: one
slot validator, one conflict guarantee, one transition matrix, one history
table, one availability endpoint and one timezone layer serve both the patient
and the front desk. The single change to a Phase 09 function turns two
*self-service* rules into parameters rather than duplicating the validator —
see *The one Phase 09 function this phase changed*.

**No client role can write `public.appointments`.** Still no insert, update or
delete grant and still no such policy, for anybody. Every receptionist write is
a `security definer` function that re-checks the role in the database, derives
the duration from the appointment type, sets the status itself and re-runs
every booking rule.

1,813 tests pass, up from 1,536. **106 live checks** against the real database
with real per-role JWTs, including two genuinely concurrent bookings for the
same slot and the full cross-role matrix.

**Three real defects were found by verification rather than by review**, and
one of them would have offered the front desk a button the database refuses.
All three are described below.

---

### Repository assessment before starting

Phases 06–09 left identity, the patient record, authorization and the
appointment engine. Reused rather than rebuilt: `assert_bookable_slot`, both
exclusion constraints, `appointments_guard_transition()`, `appointment_events`,
`get_practitioner_busy_intervals`, `generateSlots`, `bookableDates`, the
timezone layer, the status matrix, `describeAppointmentFailure`,
`instantSchema`, `DatePickerStrip`, `TimeSlotPicker`, `useAvailableSlots`,
`AppointmentStatusBadge`, `AppointmentHistory`, `ProfileSection`/
`ProfileFieldList`/`ProfileField`, the `Table` family, `Field`, `NativeSelect`,
`Dialog`, `Toaster`, `EmptyState`, `ErrorState`, `NavLink` and the Phase 07
patient formatters.

Four findings shaped the work:

* **`PROTECTED_PATH_PREFIXES` did *not* list `/receptionist`.** Phase 06 listed
  `/staff` speculatively but not this path, so unlike previous phases the
  prefix had to be added. It now is, alongside a `robots.txt` entry.
* **`docs/PRODUCT_SPEC.md` §5A already settles the architecture question this
  phase raises**: *"Appointments sit beneath both staff workspaces. Appointment
  logic belongs in one shared domain layer, not duplicated per workspace."*
  That is the sanction for `features/reception` depending on
  `features/appointments`, and it is recorded in the query layer's header.
* **The seeded practitioner accepts online booking and works 09:00–13:00 and
  17:00–20:00.** Both facts broke the first live verification run, and both
  times the database was right — see *Defects and false failures*.
* **`getBookingOptions` filtered practitioners by `accepts_online_booking`**,
  which is exactly the filter the front desk must not have. It was decomposed
  rather than copied.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260921120000_receptionist_workspace.sql

src/features/reception/types.ts            the operational domain model
src/features/reception/status.ts           which actions the front desk may take
src/features/reception/status.test.ts
src/features/reception/validation.ts       the trust boundary
src/features/reception/validation.test.ts
src/features/reception/content.ts          all workspace copy
src/features/reception/queries.ts          authorized, column-scoped reads
src/features/reception/actions.ts          five server actions

src/components/reception/reception-nav.tsx
src/components/reception/day-overview.tsx
src/components/reception/schedule-list.tsx
src/components/reception/schedule-filters.tsx
src/components/reception/appointment-status-actions.tsx
src/components/reception/patient-search.tsx
src/components/reception/patient-record.tsx
src/components/reception/new-patient-form.tsx
src/components/reception/staff-booking-flow.tsx
src/components/reception/staff-reschedule-form.tsx

src/app/(app)/receptionist/layout.tsx
src/app/(app)/receptionist/page.tsx
src/app/(app)/receptionist/loading.tsx
src/app/(app)/receptionist/schedule/page.tsx
src/app/(app)/receptionist/schedule/loading.tsx
src/app/(app)/receptionist/schedule/new/page.tsx
src/app/(app)/receptionist/schedule/[id]/page.tsx
src/app/(app)/receptionist/schedule/[id]/reschedule/page.tsx
src/app/(app)/receptionist/patients/page.tsx
src/app/(app)/receptionist/patients/new/page.tsx
src/app/(app)/receptionist/patients/[id]/page.tsx
src/app/(app)/receptionist/patients/[id]/loading.tsx

tests/integration/reception-actions.test.ts
tests/integration/reception-security.test.ts
tests/components/reception.test.tsx
docs/progress/progress_phase_10.md
```

#### Modified

```text
src/config/permissions.ts             three receptionist permissions
src/config/permissions.test.ts        the speculative list, narrowed
src/lib/authorization/routes.ts       PROTECTED_AREAS.receptionist
src/lib/authorization/routes.test.ts
src/lib/authorization/policy.test.ts  the exhaustive matrix, extended
src/lib/auth/paths.ts                 /receptionist protected
src/app/robots.ts                     /receptionist disallowed
src/types/database.ts                 six new functions

src/features/appointments/queries.ts  getActiveAppointmentTypes,
                                      listSchedulablePractitioners,
                                      getAvailability's minNoticeMinutes option
src/features/appointments/errors.ts   PV014, unknown patient record
src/features/appointments/errors.test.ts   reads both migrations
src/app/api/appointments/availability/route.ts  serves both booking flows
src/features/admin/content.ts         the receptionist's account-page next step
tests/components/authorization.test.tsx
tests/integration/appointment-availability-route.test.ts

docs/ARCHITECTURE.md, docs/SECURITY.md, docs/DATABASE.md,
docs/QA_STRATEGY.md, docs/DESIGN_SYSTEM.md, docs/PUNARVASU_MASTER_SPEC.md
```

#### Dependencies

**None added.**

---

### 2. Database

`supabase/migrations/20260921120000_receptionist_workspace.sql`, applied to the
linked project with `supabase db push` and verified against it.

```text
Tables changed:   none. No table was created, altered or dropped.
Migrations:       1 (20260921120000_receptionist_workspace.sql)
Indexes:          4 added
Constraints:      none added, none altered
RLS policies:     3 added (all SELECT), 0 altered, 0 dropped
Functions/RPCs:   6 added, 1 replaced with a wider signature,
                  2 replaced to pass the new arguments
```

#### Extensions

`pg_trgm`, for the two trigram indexes the patient search needs. A btree cannot
serve a leading-wildcard `ilike`.

#### Indexes

| Index | Why |
| --- | --- |
| `appointments_starts_at_idx (starts_at)` | The workspace's primary query: "who is coming in on this day?" Phase 09 indexed `(practitioner_id, starts_at)`, which does not serve a clinic-wide day with no practitioner filter |
| `patients_full_name_trgm_idx` gin | `search_patients` matches `full_name ilike '%term%'` |
| `patients_phone_trgm_idx` gin | The same, for a phone number |
| `patients_name_dob_idx (lower(btrim(full_name)), date_of_birth)` | Duplicate detection matches both exactly |

#### RLS policies added

```text
appointments_select_receptionist        SELECT  has_app_role('receptionist')
appointment_events_select_receptionist  SELECT  has_app_role('receptionist')
patients_select_receptionist            SELECT  has_app_role('receptionist')
```

Three properties worth stating, each asserted by test and verified live:

* **Every one names the role explicitly.** `phase_10.md` §39 forbids a broad
  policy such as `auth.uid() is not null` on a sensitive table, and there is
  none — `using (true)` appears nowhere in this migration.
* **Not one insert, update or delete policy was added**, and no table grant was
  issued at all. A receptionist reads more *rows*; they read no more *columns*
  and they write through no table.
* **Phase 07 and 08's ownership policies are untouched.** The migration
  contains no `drop policy`. The new ones are additional and permissive, so the
  only change is that a receptionist now matches one.

`schedule_exceptions` still has RLS enabled and **no policy at all**, for
anybody. A blocked period's reason may be personal, and the front desk gets no
more of it than a patient does. Verified live: a receptionist reads zero rows.

#### Functions added

| Function | Purpose |
| --- | --- |
| `assert_appointment_manager()` | The single authorization gate. Takes no argument, reads `auth.uid()` and `user_roles`, raises `insufficient_privilege`. Every staff function starts with it |
| `search_patients(query, limit)` | Bounded operational search. Refuses a term under two characters, clamps its own limit, escapes `%` and `_`, returns seven columns |
| `find_possible_duplicate_patients(name, phone, dob)` | Advisory. Merges nothing, blocks nothing, bounded to ten |
| `create_patient_record(...14 fields)` | Creates an **unlinked** walk-in record. **No owner parameter** |
| `create_appointment_for_patient(patient, practitioner, type, start, note)` | Books on a patient's behalf. Validates the patient id, derives everything else |
| `update_appointment_status_as_staff(id, status, reason)` | Confirm, check in, no-show, cancel. Refuses `completed` and `in_consultation` |
| `reschedule_appointment_as_staff(id, start)` | Moves in place, preserving status and recording the previous time |

#### The one Phase 09 function this phase changed

`assert_bookable_slot` gained two parameters:

```text
p_require_online_booking boolean
p_min_notice_minutes     integer
```

Both existed inside it as fixed rules, and both are rules about **self-service
booking** rather than about whether a time is schedulable at all:

* `accepts_online_booking` means "a patient may book this practitioner
  themselves". A receptionist booking somebody in at the desk with a
  practitioner who does not take online bookings is precisely the case that
  flag exists to permit — and with no practitioner accepting online booking
  today, keeping the check would have made the workspace exactly as unusable as
  patient booking currently is.
* Two hours' minimum notice stops a patient booking a slot the clinic cannot
  prepare for. A receptionist booking somebody in for eleven o'clock at ten
  past ten is not that; it is the front desk doing its job.

The alternative was a second validator for staff — the duplicated scheduling
logic `phase_10.md` §17 forbids, and which would drift the first time a rule
changed. So the rule is parameterised, and the calling **function** decides,
never the request.

Because PostgreSQL identifies a function by its argument list, this meant
dropping the four-argument version and replacing `book_appointment` and
`reschedule_appointment`, whose bodies are reproduced unchanged apart from that
one call. Verified live that the patient path's own rules still hold: a patient
still cannot self-book a practitioner who is not online-bookable (`PV006`), and
a patient is still bound by the minimum notice.

Everything that is a property of the *diary* still applies to both callers:
working hours, the 15-minute grid, the booking horizon, blocked periods, and
"not in the past". Verified live for the front desk.

#### What no receptionist can reach

| Not reachable | Why |
| --- | --- |
| A clinical record | There is none. When there is, it is its own table with its own policies, and nothing here grants anything on it |
| `appointments.internal_note` | Column privileges are granted to a **database** role, and a patient and a receptionist are both `authenticated`. Granting it to one would grant it to the other, so it stays ungranted for everybody and unwritable through any function here |
| A blocked period's reason | No policy on `schedule_exceptions`, for anybody |
| `completed` or `in_consultation` | Refused by the status allowlist in the database, by the schema, and by the UI — `phase_10.md` §31 |
| Role assignment | `assign_user_role` raises `42501`. Verified live |
| `list_managed_users` | Raises `42501`. Verified live |
| An owner for a patient record | `create_patient_record` has no such parameter. Passing one is an error, verified live |

---

### 3. Routes and components

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/receptionist` | Dynamic | Today: counts, what is happening now and next, what needs confirming, the day |
| `/receptionist/schedule` | Dynamic | The diary for one day, with date, practitioner and status filters |
| `/receptionist/schedule/new` | Dynamic | Book on a patient's behalf |
| `/receptionist/schedule/[id]` | Dynamic | One appointment, and what can still be done about it |
| `/receptionist/schedule/[id]/reschedule` | Dynamic | Move it |
| `/receptionist/patients` | Dynamic | Find a patient |
| `/receptionist/patients/new` | Dynamic | Register a walk-in |
| `/receptionist/patients/[id]` | Dynamic | Operational record and their appointments |

All eight are `noindex`, `private, no-store` (inherited from the `(app)`
layout and the proxy) and disallowed in `robots.txt`. **All thirty public pages
remain static** — the build output confirms it.

Three loading routes render structured skeletons in the shape of the page.

#### Components

| Component | Notes |
| --- | --- |
| `ReceptionNav` | Composes `NavLink`. "Today" uses `match: "exact"`, or it and "Schedule" would both report `aria-current="page"` |
| `DayOverviewSummary` | Four counts as a `<dl>` on the page's own surface — no cards, no icons, no chart (`phase_10.md` §§2 and 56). Every figure is a count of rows on the page beneath it |
| `ScheduleList` | **Cards below `md`, a real table from `md` up.** Two layouts over one data set, not one squeezed. The table has a caption, `scope="col"` headers and a focusable `TableScroller` |
| `ScheduleFilters` | A plain `GET` form and day-stepping links — zero JavaScript, shareable, bookmarkable, correct under the back button |
| `AppointmentStatusActions` | Composes the transition matrix with the role allowlist. Confirm and check-in act immediately; no-show and cancel ask first |
| `QuickStatusAction` | The single most likely next action, for a schedule row (`phase_10.md` §10) |
| `PatientSearch` | A client island and a **POST**, deliberately — see below. Renders all four of its states |
| `PatientRecord` | Reuses `ProfileSection`/`ProfileFieldList`/`ProfileField`. Carries the scope notice |
| `NewPatientForm` | One form, owned here. No field for an account, a credential, a role or anything clinical |
| `StaffBookingFlow` | Patient → type → practitioner → date → time → review. Reuses the Phase 09 pickers and hook |
| `StaffRescheduleForm` | The same pickers again — four flows now share them |

---

### 4. Appointment workflows implemented

```text
Find patient → Select patient → Type → Practitioner → Date → Time
            → Review → Book (created confirmed)

View → Confirm → Check in → No-show / Cancel
     → Reschedule
```

Every write goes through the Phase 09 engine. Specifically:

| Workflow | Function | What it derives rather than accepts |
| --- | --- | --- |
| Book for a patient | `create_appointment_for_patient` | duration, end, blocked-until, status, timestamps, actor |
| Confirm / check in / no-show / cancel | `update_appointment_status_as_staff` | the transition's legality, `cancelled_at`, `cancelled_by` |
| Reschedule | `reschedule_appointment_as_staff` | duration, end, blocked-until; status preserved |

Two behavioural decisions, both documented in the migration and verified live:

* **A receptionist-created appointment is `confirmed`, not `requested`.** A
  patient's request is `requested` because the clinic has not agreed to it yet.
  An appointment the clinic itself entered at its own front desk has been
  agreed by definition; telling the receptionist who just booked it that it is
  awaiting confirmation would describe a step that does not exist. The status
  is still set *by the function* and still subject to the transition trigger.
* **A staff reschedule preserves the status.** The patient path sends a
  confirmed appointment back to `requested`, because moving it makes the
  clinic's confirmation stale. A receptionist moving it *is* the clinic, and
  sending its own change back to itself would make a confirmed patient's
  appointment look unconfirmed to them.

Also deliberate: the per-patient abuse cap does not apply to staff booking. It
exists so one account cannot hold the diary; a course of six appointments is an
ordinary thing for a front desk to arrange.

**Double booking remains impossible.** The same exclusion constraint decides a
race between a receptionist at the desk and a patient booking from home.
Verified live with two genuinely parallel calls: one succeeded, one was refused
with `23P01` by the database.

---

### 5. Patient search and onboarding

#### Search

Server-side, authorized in the database, bounded in the database, and it is
impossible to ask it for the whole patient list.

| Control | Where |
| --- | --- |
| Receptionist role required | `assert_appointment_manager()` inside `search_patients` |
| A term under two characters finds nothing | The function returns early. Verified live |
| An empty or whitespace term finds nothing | The same. Verified live — an empty box is never a "list everybody" button |
| The caller does not choose the result count | `least(greatest(coalesce(p_limit, 20), 1), 50)`. Verified live with `p_limit: 100000` |
| `%` and `_` are escaped | Verified live: a query of `%%` returns nothing |
| Minimum fields | Seven columns: id, name, preferred name, phone, date of birth, town, whether they have an account. **No address, no emergency contact, no account id.** Asserted structurally and verified live |

**Why it is a POST and a client island**, when almost nothing else here is: a
search term at a front desk is somebody's name, and `?q=Priya+Sharma` reaches
browser history on a shared machine, every proxy's access log and the `Referer`
header of the next request (`phase_10.md` §36, `docs/SECURITY.md` §14). The
query still runs on the server and the term is never logged — asserted by test.

The schedule filters make the opposite call, for the opposite reason: a date, a
practitioner id and a status are not sensitive, so putting them in the URL makes
the view shareable and correct under the back button. The distinction is what
is being put there.

**Why there is no search-as-you-type:** a request per keystroke is a request
per keystroke that reads patient records, to save one key press. An explicit
submit is one request and makes "is it searching?" a state with one answer.

#### Onboarding

`phase_10.md` §§32–35, and the whole security argument is the argument list:
`create_patient_record` has **no owner parameter**. A receptionist therefore
cannot attach a record to an account, create an account, set a password or
grant a role — not because something filters it, but because there is nothing
to pass. Verified live: passing `p_profile_id` is an error.

The record is created unlinked, which is the walk-in case
`docs/DATABASE.md` §4.2 describes and which Phase 07's *partial* unique index
on `profile_id` was built for. Verified live that `profile_id` is null.

Claiming such a record when that person later registers is a separate,
deliberate workflow. It is **not** implemented, and it must not be implemented
by letting somebody pass an id.

The form says so to the receptionist: *"This creates a clinic record, not a
login."*

#### Duplicates

`phase_10.md` §33 and example 7. The first submission checks, shows what it
found and **writes nothing**; the receptionist then opens an existing record or
says this is somebody else, and the second submission goes through.

It warns once and never blocks, and it never merges. Refusing to register
somebody standing at the desk over a shared phone number is worse than the
duplicate it prevents; merging automatically on a name match would attach one
person's appointments to another person's record, which is worse than both.

Two conservative signals: the same phone number, or the same name **and** the
same date of birth. A name alone is not a signal — two people called the same
thing is ordinary. Verified live.

A failed duplicate check does not block registration. It is advisory, and being
unable to register a patient because a hint query timed out is not a trade
worth making. Asserted by test.

---

### 6. Authorization and RLS changes

```text
src/proxy.ts                    optimistic redirect; /receptionist added
  v
(app)/layout.tsx                requireUser()
  v
(app)/receptionist/layout.tsx   requireAreaAccess(PROTECTED_AREAS.receptionist)
  v
page                            requirePermission(...) — its own capability
  v
server action                   can(user.role, ...)
  v
database function               auth.uid() + has_app_role('receptionist')
  v
RLS                             the last word
```

Three permissions were added to `config/permissions.ts` and granted to the
**receptionist role alone**:

| Permission | Covers |
| --- | --- |
| `appointments.manage.any` | View, create, confirm, check in, no-show, reschedule, cancel any appointment |
| `patients.read.operational` | Search for a patient and read their operational record |
| `patients.write.operational` | Register a patient at the front desk |

**The doctor still holds nothing**, because there is still no doctor workspace.
**The admin does not hold these either**: `docs/SECURITY.md` §6's matrix marks
the front-desk capabilities "Controlled" for an administrator, which is a
statement about a surface that does not exist — there is no administrative
scheduling screen and no audit trail for administrative access to patient
records. Granting them would grant them through a UI nobody has designed.

`PROTECTED_AREAS` gained a third entry, so the guard and the navigation read
the same table: a link cannot be offered for an area the guard will refuse, and
an area cannot acquire a link while nobody remembers to guard it.

---

### 7. Security and adversarial test results

#### Live database — 106 checks, real per-role JWTs

Run against the linked project by signing in as each seeded account with the
anon key, so every check went through real RLS with a real `auth.uid()`. The
service-role client was used only to set up the fixture and read back what a
check wrote — never to perform the operation under test. Synthetic data only;
the fixture was removed afterwards and the practitioner's flag restored.

| Area | Result |
| --- | --- |
| `anon` can read none of the six tables and call none of the six functions | PASS (12) |
| **Patient, doctor and admin cannot search patients** (`42501`) | PASS (3) |
| A receptionist can, and gets only the seven operational columns | PASS (2) |
| A one-character, empty and wildcard query each return nothing | PASS (3) |
| `p_limit: 100000` returns at most 50 | PASS |
| A receptionist can read appointments and patient records | PASS (2) |
| **A receptionist cannot read `internal_note`** | PASS |
| A receptionist reads **no** blocked period | PASS |
| A doctor and an admin still read **no** patient record | PASS (2) |
| **No role — patient, receptionist, doctor or admin — can insert, update or delete an appointment** | PASS (12) |
| A receptionist cannot grant themselves a role, call `assign_user_role`, or list managed users | PASS (3) |
| **Patient, doctor and admin cannot create a patient record** (`42501`) | PASS (3) |
| A receptionist can, and the record is **unlinked** | PASS (2) |
| **Passing an owner is an error** | PASS |
| A blank name and an unlisted gender are refused by the database | PASS (2) |
| Duplicate detection: phone match found, reason reported, name alone is not a signal | PASS (3) |
| Patient, doctor and admin cannot run the duplicate check | PASS (3) |
| **Patient, doctor and admin cannot book on a patient's behalf** (`42501`) | PASS (3) |
| A receptionist can; it is `confirmed`, belongs to the chosen patient, takes its length from the type, records the actor and writes a history event | PASS (5) |
| **An unknown patient id is refused** (`PV014`) | PASS |
| **A patient cannot self-book a practitioner who is not online-bookable** (`PV006`) — and the front desk can | PASS (2) |
| A patient is still bound by the minimum notice | PASS |
| Outside working hours, off-grid and in the past are refused for the front desk too | PASS (3) |
| **Two concurrent bookings: at most one succeeds, and the loser is refused by the database (`23P01`)** | PASS (2) |
| Patient, doctor and admin cannot change a status as staff (`42501`) | PASS (3) |
| **A receptionist cannot set `completed` or `in_consultation`** (`42501`) | PASS (2) |
| A receptionist can check a patient in; an illegal transition is refused (`PV008`); a repeat is a no-op | PASS (3) |
| Cancellation preserves the row and records who, when and why | PASS (4) |
| A cancelled appointment cannot be revived or moved (`PV008`) | PASS (2) |
| An unknown appointment is refused (`PV009`) | PASS |
| Patient, doctor and admin cannot reschedule as staff (`42501`) | PASS (3) |
| A receptionist can; it keeps its identity, its status and its type's duration, and the previous time is kept as history | PASS (4) |
| **A patient still sees only their own appointments and only their own record**, and cannot read the walk-in's | PASS (3) |

**106 passed, 0 failed.**

#### `phase_10.md` §62's checklist

| Attempt | Result | Where proved |
| --- | --- | --- |
| Unauthenticated → `/receptionist` | **DENIED** | `PROTECTED_PATH_PREFIXES` + `requireUser()`; route test |
| Patient → `/receptionist` | **DENIED** | `requireAreaAccess`; `routes.test.ts`; live `42501` on every function |
| Doctor → receptionist-only operation | **DENIED** | Live, all six functions |
| Receptionist → `/receptionist` | **ALLOWED** | Live, and the permission matrix |
| Receptionist → permitted patient profile | **ALLOWED** | Live |
| Receptionist → clinical record | **DENIED** — none exists, no grant, no column | Structural test + live |
| Receptionist → arbitrary patient id | Validated against the patients table; `PV014` | Live |
| Receptionist → invalid status transition | **DENIED** (`PV008`) | Live |
| Receptionist → manipulated `patientId` | Validated; a non-UUID never reaches the database | Action test + live |
| Receptionist → manipulated `practitionerId` | Validated as a UUID, then checked for active in the database | Action test + live |
| Receptionist → manipulated `duration` | **No effect** — not a parameter, never read from the form | Action test + structural test |
| Receptionist → manipulated `status` | **DENIED** at the schema, the allowlist and the trigger | 3 layers, all tested |
| Receptionist → assign admin role | **DENIED** (`42501`) | Live |
| Receptionist → assign doctor role | **DENIED** (`42501`) | Live |
| Receptionist → modify permissions | **DENIED** — no grant on `user_roles` | Live |
| Receptionist → service-role functionality | **N/A** — the feature never touches the admin client | Structural test |

#### Automated — 1,813 tests, up from 1,536

| File | Count | Covers |
| --- | --- | --- |
| `src/features/reception/validation.test.ts` | 64 | Every hostile field one at a time — `profileId`, `userId`, `role`, `email`, `password`, `status`, `duration`, `endsAt` and eight clinical names — **rejected rather than dropped**; naive local times; a landline accepted and a script tag refused; the emergency-contact pairing; and that no schema has a field whose name suggests clinical content or authority |
| `src/features/reception/status.test.ts` | 70 | The 7×7 staff matrix written out; that `completed` is unreachable from every state; that the allowlist and the actionable-from list both **agree with the migration**, parsed out of the SQL |
| `tests/integration/reception-actions.test.ts` | 43 | Four roles writing nothing; refusals naming no role or permission; the exact RPC argument list; a planted status, duration, owner or role changing nothing; a slot conflict becoming recoverable copy; the duplicate warning writing nothing and then proceeding; and that no log carries a name, a phone number, an address, a date of birth, a cancellation reason or a search term |
| `tests/integration/reception-security.test.ts` | 48 | The **database's** guarantees, asserted against the migration text: every new policy names the role, no blanket policy, no write policy or grant, `internal_note` ungranted, pinned `search_path`, every function authorizing first, the search bounds and escaping, and that the reception feature never writes through a table client or touches the service-role client |
| `tests/components/reception.test.tsx` | 52 | Nothing clinical anywhere; the status actions composing both rules; destructive actions asking first; one `<form>` per form carrying exactly its action's fields; all four search states and no listing before a search; the two schedule layouts; the term never reaching a URL; and axe |

---

### 8. Defects and false failures

#### Real defects, found by verification

**1. The UI would have offered an action the database refuses.**
*(found by `status.test.ts`'s mirror assertion)*

`canStaffSetStatus` composed two rules — is the transition legal, and may this
role set that status. `in_consultation → cancelled` passes both: it is a legal
transition, and `cancelled` is a status the front desk may set. So the UI would
have rendered "Cancel appointment" for a patient who is in the room with the
practitioner, and `update_appointment_status_as_staff` would have refused it.

Two rules were not enough. `STAFF_ACTIONABLE_FROM_STATUSES` is the third —
which statuses the front desk may act *from* — and it is now asserted against
the migration's own `case` branches. The database was right; the composition
was over-permissive.

**2. The phone validator refused a legitimate landline.**
*(found by `validation.test.ts`)*

The pattern required the first character to be `+` or a digit, which refused
`(022) 2555-1234` — an ordinary way to write an Indian landline with its STD
code, and exactly the kind of number a receptionist copies off a handwritten
form. Now a composition rule (only characters that appear in written phone
numbers, and at least eight digits), which still rejects a name, a script tag
and a SQL fragment.

**3. React's purity rule caught a clock in a component.**
*(found by ESLint)*

The patient record page called `Date.now()` during render to split appointments
into upcoming and past. Moved into `splitPatientAppointments` in the feature
layer with `now` injected — the same shape `groupAppointments` has, and it
makes the split testable without a clock.

#### False failures, recorded because a report listing only what passed is not evidence

The first live verification run reported **four failures, all `PV002`**. Every
one was the harness being wrong about the fixture, and the database being right:

* The script inserted 09:00–18:00 working hours *only if none existed*, and
  some did — the seeded practitioner works 09:00–13:00 and 17:00–20:00. It then
  asked for 13:00, 15:00 and 16:00, which nobody works. The rewrite reads the
  real intervals and picks times inside them.
* It assumed the seeded practitioner did **not** accept online booking, and
  they do. The check that matters — a patient refused, the front desk allowed —
  now flips the flag and restores it, which tests the distinction rather than
  hoping for it.

A second run left **two failures**, also `PV002`, for the same class of reason:
`slot(6)` advances six appointment-lengths into a four-hour interval and lands
at 13:30. A `gridSlot(steps)` helper that advances by the 15-minute grid step
and **throws** if the result falls outside the interval replaced it, so the
harness now fails loudly rather than blaming the product.

---

### 9. Verification

Executed on 2026-09-18:

```text
Lint:       PASS — npx eslint . --max-warnings=0, 0 problems
Typecheck:  PASS — npm run typecheck, exit 0
Formatting: PASS — npx prettier --check .
Tests:      PASS — 1,813 tests, 63 files (was 1,536 / 58)
Build:      PASS — npx next build, 44 routes, no warnings
```

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 1,830 / 63 files** |
| Production build | `npx next build` | **PASS** — all 30 public pages still static; the 8 receptionist routes dynamic |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 165 files, 0 findings |
| Migration | `supabase db push` | **PASS** — applied to the linked project |
| Live database | 106 checks, real per-role JWTs | **PASS — 106/106** |
| Component axe (jsdom) | included in the suite | **PASS** — 0 violations |
| Live HTTP, signed in as a receptionist | all 8 routes requested against a running server with a real session cookie | **PASS** — 8/8 render, 0 server errors. Found the `Field` defect below |
| **Live browser (rendered, measured)** | — | **NOT RUN** — see *Known issues* |
| E2E | — | **NOT RUN** — no E2E tool is installed (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

---

### 10. Acceptance criteria

#### Workspace

| Criterion | Result |
| --- | --- |
| Receptionist has a dedicated protected workspace | PASS — `/receptionist`, guarded in the layout, verified live for all four roles |
| Dashboard prioritizes today's operational work | PASS — counts, now/next, awaiting confirmation, then the day. No chart, no KPI tiles |
| Today's appointments are visible | PASS |
| Appointment statuses are clear | PASS — icon + word, never colour alone; asserted |
| Quick actions are available | PASS — two on the header, one per schedule row |
| Workspace is responsive | PASS — cards below `md`, table above; no fixed pixel widths. **Not pixel-verified in a browser** |

#### Appointments

| Criterion | Result |
| --- | --- |
| Receptionist can view authorized appointments | PASS — live |
| Receptionist can create appointments for patients | PASS — live |
| Confirmation works through the Phase 09 engine | PASS — the same transition trigger; live |
| Cancellation works through the Phase 09 engine | PASS — status change, never a delete; live |
| Rescheduling works through the Phase 09 engine | PASS — the same validator and constraint; live |
| Invalid status transitions are prevented | PASS — three layers; live (`PV008`) |
| Double booking remains impossible | PASS — two concurrent calls, one refused by `23P01`; live |

#### Patients

| Criterion | Result |
| --- | --- |
| Patient search works securely | PASS — live, all four roles |
| Search is server-side and bounded | PASS — live, including `p_limit: 100000` |
| Basic permitted patient information is accessible | PASS — live |
| Clinical information is not exposed | PASS — no column, no field, no grant; and the page says so |
| Patient onboarding follows the approved identity architecture | PASS — unlinked record, no owner parameter; live |
| Duplicate-patient handling is considered | PASS — warns once, never merges, never blocks; live |

#### Authorization

| Criterion | Result |
| --- | --- |
| Receptionist routes are protected | PASS — proxy, layout guard, per-page permission |
| Server operations are independently authorized | PASS — every action and every query checks; the database re-checks |
| RLS protects sensitive data | PASS — three role-named policies, no blanket policy; live |
| Cross-role access tests pass | PASS — 106 live checks |
| Privilege escalation tests pass | PASS — role assignment, self-promotion and status escalation all refused live |

#### UX

| Criterion | Result |
| --- | --- |
| Loading states exist | PASS — three structured skeletons |
| Empty states exist | PASS — nothing today, no match, no results, nothing searched yet, no practitioner, no type, no working days |
| Error states exist | PASS — a failed read is distinguished from an empty one everywhere |
| Confirmation dialogs exist for destructive operations | PASS — cancel and no-show ask; confirm and check-in do not |
| Mobile/tablet layouts work | PASS by construction — **not pixel-verified** |
| Accessibility requirements are met | PASS in jsdom — axe clean, real labels, `aria-current`, one `h1` per page. **Contrast and focus order not measured in a browser** |
| Punarvasu visual language is maintained | PASS — tokens only; no new colour, radius or shadow; no gradient, emoji or decorative illustration |

#### Engineering

| Criterion | Result |
| --- | --- |
| Phase 09 appointment logic is reused | PASS — one validator, called by all four write paths; asserted |
| No duplicate scheduling logic exists | PASS — asserted structurally |
| No unnecessary client-side data fetching | PASS — one client fetch, for slot times, through the Phase 09 endpoint. The search POSTs for a privacy reason that is recorded |
| TypeScript remains strict | PASS — no `any` added |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

```text
Login → Receptionist workspace → today's schedule → find patient
     → create / confirm / reschedule / cancel → back to the schedule
```

Every step is implemented and every write is verified against the live
database. The boundaries hold:

```text
Receptionist ✕ clinical authoring      — nothing to author, no grant, no column
Receptionist ✕ admin role management   — 42501, verified live
Receptionist ✕ unauthorized patient data — internal note, blocked periods
```

---

### 11. Deferred

Intentionally not built:

* **A week view.** `phase_10.md` §26 asks for the daily schedule as the
  default and warns against a complex calendar. Seven columns of the same
  information is unreadable on the tablet this is used on, and stepping a day
  at a time already answers "how busy is Thursday?".
* **Realtime updates.** §43 makes them optional and permits revalidation
  instead. Every write revalidates the pages that show it. Realtime adds a
  subscription to authorize and scope for a clinic where two receptionists
  rarely act on the same appointment within seconds.
* **Optimistic status updates.** §44 forbids showing success before the server
  confirms, and two receptionists can act on the same appointment at once.
* **A staff-visible internal note.** Column privileges are per database role,
  so making it readable by a receptionist would make it readable by every
  patient. It needs a definer accessor, and no Phase 10 workflow requires one.
* **A patient's email address.** `public.patients` has no email column; it
  lives in `auth.users`. Reading it for operational search would widen the
  disclosure surface for a workflow this phase does not need. Search is by name
  and phone.
* **Marking an appointment completed.** §31 — a clinical responsibility.
* **`created_by` on `public.patients`.** §60 offers it; the table's select
  grant is table-wide, so the column would also be readable by the patient
  whose record it is, disclosing a staff identifier for no benefit. The
  operation is in the structured log against the actor's opaque id.
* **Claiming an unlinked walk-in record when that person registers.** A
  separate, deliberate workflow. It must not be built by letting somebody pass
  an id.
* **Moving `ProfileSection`/`ProfileFieldList`/`ProfileField` to
  `components/shared/`.** Three areas now depend on them, which earns the move;
  it belongs on its own change rather than inside this one.
* **An administrative scheduling surface**, and the permissions that would go
  with it. `docs/SECURITY.md` §6 marks them "Controlled", which needs a UI and
  an audit trail nobody has designed.
* Notifications (Phase 15), analytics (Phase 16), the doctor workspace (Phase
  11), the full admin console, payments, telemedicine and the audit subsystem
  (Phase 19) — all explicitly out of scope per §65.

---

### 12. Known issues

1. **No *measured* browser verification was run for this phase.** Phases 03–09
   drove the production build through Chrome over the DevTools Protocol to
   measure computed contrast, horizontal overflow, focus order and keyboard
   operation. That was not done here. The component suite's axe sweeps run in
   jsdom, which has no layout engine and therefore no computed colours — so
   **contrast, overflow at 320px and real focus behaviour on the eight new
   routes are unverified**. Phase 08 found a 35px overflow and Phase 09 a
   3.89:1 contrast failure that nothing but a browser could see; this phase has
   had no equivalent check, and it should have one before the workspace is
   used.

   Every route *was* subsequently requested over HTTP with a real receptionist
   session, which is how the `Field` defect below was found. That proves each
   page renders; it proves nothing about how it looks.
1b. **Fixed after the first browser session: `ScheduleFilters` crashed the
   schedule page.** It was written as a server component — deliberately, since
   a `GET` filter form needs no JavaScript — but it renders `Field`, which is a
   client component taking a render prop. A function cannot cross the
   server/client boundary, so `/receptionist/schedule` threw "Functions are not
   valid as a child of Client Components" on every request and showed the error
   boundary. Lint, typecheck, the production build and all 1,813 tests passed
   with the defect present: the component test renders `ScheduleFilters`
   directly and so never crosses the boundary that breaks. The fix is
   `"use client"` on that one module, plus a structural guard in
   `tests/components/field.test.tsx` asserting that **every** module importing
   `Field` declares the directive.

1c. **Not a defect: a stale dev route tree.** During the same session every
   route three or more segments deep 404'd — including `/patient/appointments/
   book`, a Phase 09 route this phase did not touch — while every shallower
   route served correctly. Deleting `.next` and restarting `next dev` fixed it,
   and all eight receptionist routes then returned 200. **The trigger is
   unknown**: running `next build` against a live dev server was the obvious
   suspect and did not reproduce it. Worth recognising rather than debugging
   from the application code, which was correct throughout — the production
   build had listed all eight routes all along.

2. **No practitioner is configured for online booking in production**, and the
   development project's seeded practitioner is named "Test Doctor". The front
   desk can now book them regardless, which is the point of this phase — but
   the roster is still development data.
3. **The consultation types, durations, minimum notice and booking horizon are
   still provisional**, and the workspace says so. They must be confirmed
   before launch.
4. **No practitioner, availability or appointment-type administration.** A
   receptionist can schedule within the configured hours but cannot change
   them, and nothing in the product can — it is still a migration.
5. **No audit subsystem.** `appointment_events` records every status change and
   reschedule with its actor, and the structured log records each operation
   against an opaque user id. Patient-record *access* is not logged, which
   `docs/SECURITY.md` §15 lists as something to record "where appropriate".
   That belongs with Phase 19.
6. **`src/types/database.ts` is still hand-written.** `npm run db:types`
   requires Docker. The shape was written against the migration and every
   function it declares was exercised live.
7. **The four Phase 08 test accounts and the seeded practitioner remain on the
   development project.** Shared, well-known credentials, including an
   administrator. Delete them before this database takes real patient data.
8. **No E2E tool, no screen-reader pass, no Lighthouse run.** Unchanged since
   Phase 01/02.
9. **Still no CSP.** Unchanged since Phase 02.
10. **Legal pages still do not exist.** Required before the clinic handles real
    records through this website.

---

### 13. Phase status

```text
Phase 10: COMPLETE
Ready for Phase 11: YES
```

Phase 11 has not been started.

The doctor workspace can be built directly on what exists. Phase 09 already
shipped `appointments_select_own_practitioner`, scoped by the practitioner
*relationship* rather than by the doctor role, and `current_practitioner_id()`
to support it — both unused so far. Phase 11 adds the permission, the
`PROTECTED_AREAS` entry and the screens, in the same change, following the
pattern this phase used. The shared appointment domain layer, the status
matrix, the availability engine and the conflict guarantee are all reusable
unchanged.

One caveat to carry forward: `docs/SECURITY.md` §6 requires a doctor's clinical
access to be scoped by treatment relationship rather than by role. The policy
that exists today scopes a doctor to *their own diary*, which is the
scheduling half. The clinical half arrives with the clinical tables.
