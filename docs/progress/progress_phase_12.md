## PHASE 12 — Clinical Records & Consultation Management

Status:
COMPLETED — migration applied to the live Supabase project, verified against
it with real per-role JWTs, and driven through a real browser

Completed On:
2026-09-19

Summary:
Built the first genuinely clinical data in Punarvasu: `public.clinical_records`
with its own lifecycle, its own policy and its own permissions, the
consultation workspace that authors it, draft and completion states, the
clinical history, and the concurrency and integrity guarantees that keep a
medical record from being silently overwritten.

**Not one clinical column was added to `public.appointments`.** The clinical
record is its own table referencing the appointment, which is the boundary
`phase_12.md` section 2 and example 1 exist to enforce.

**No client role can write `public.clinical_records`.** No insert, update or
delete grant, no such policy, for anybody. Every write is a `security definer`
function whose argument list is the allowlist — a record id, a version and
eight text fields — and the patient and the practitioner are read out of the
appointment inside the database.

**A doctor reads the clinical records they authored and nobody else's.** A
receptionist, a patient and an administrator have **no policy on the table at
all**. Verified live in both directions with two doctors.

2,405 tests pass, up from 2,187. **75 live database checks** with real per-role
JWTs, including two doctors, two patients, concurrent creation, concurrent
saves and the full draft → completed lifecycle. **102 live browser checks**
driving the production build through Chrome.

**One real defect was found by the component suite and one by the browser
pass**, and the first would have silently prevented a practitioner saving a
draft. Both are described in full below.

---

### Repository assessment before starting

Phases 06–11 left identity, the patient record, authorization, the appointment
engine, the front desk and the doctor workspace. Reused rather than rebuilt:
`requireAreaAccess`/`requirePermission`/`assertPermission`,
`config/permissions.ts`, the Supabase clients, `AppError`, the structured
logger, `uuidSchema`, the whole `features/appointments` domain layer,
`appointments_guard_transition()`, `appointment_events`,
`assert_care_practitioner()`, `current_practitioner_id()`, `has_app_role()`,
`set_updated_at()`, `AppointmentStatusBadge`,
`ProfileSection`/`ProfileFieldList`/`ProfileField`, the `Table` family,
`Field`, `Textarea`, `Dialog`, `Alert`, `Button`, `EmptyState`, `ErrorState`
and the Phase 07 patient formatters.

Five findings shaped the work:

* **Phase 11 left the seam and said where it was.** The consultation route,
  its authorization, the patient context and the completion action already
  existed, with a docblock saying *"Phase 12 adds the record to this page. The
  route, the authorization, the patient context and the completion action are
  already here and do not move."* They did not move.
* **Phase 11 also decided the access model's shape.** `public.SECURITY.md`
  section 6's "scoped by treatment relationship rather than by role alone" was
  implemented for *patients* as the appointment-linked model. The clinical
  record needed its own decision, one notch narrower — see section 3.
* **`public.appointments` had no unique constraint on
  `(id, patient_id, practitioner_id)`**, so the composite foreign key that
  makes section 93's invalid state impossible could not be declared without
  adding one. It is trivially satisfied (`id` is the primary key) and adds no
  behaviour.
* **Phase 09's `appointments_guard_transition()` is a `before update` trigger
  on `appointments`.** That is the shape the clinical-documentation guard
  copies, and it is why that guard is a trigger rather than a check inside
  `update_appointment_status_as_doctor` — see section 5.
* **`Field` sets the HTML `required` attribute from its `required` prop.**
  That is correct for every form before this one and wrong for a clinical
  draft, which must be saveable while incomplete. It produced the phase's
  first real defect.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260923120000_clinical_records.sql

src/features/clinical/types.ts            the clinical domain model
src/features/clinical/status.ts           the lifecycle + completion rules
src/features/clinical/status.test.ts
src/features/clinical/validation.ts       the trust boundary
src/features/clinical/validation.test.ts
src/features/clinical/errors.ts           SQLSTATE -> safe copy
src/features/clinical/errors.test.ts
src/features/clinical/content.ts          all clinical workspace copy
src/features/clinical/queries.ts          authorized, column-scoped reads
src/features/clinical/actions.ts          three server actions

src/components/clinical/consultation-form.tsx
src/components/clinical/clinical-section.tsx
src/components/clinical/clinical-record-status.tsx
src/components/clinical/clinical-history.tsx
src/components/clinical/patient-clinical-header.tsx
src/components/clinical/save-status.tsx
src/components/clinical/start-consultation.tsx
src/components/clinical/unsaved-changes-guard.tsx

src/app/(app)/doctor/patients/[id]/records/[recordId]/page.tsx

tests/integration/clinical-actions.test.ts
tests/integration/clinical-security.test.ts
tests/components/clinical.test.tsx
docs/progress/progress_phase_12.md
```

#### Modified

```text
src/config/permissions.ts                two clinical permissions, doctor only
src/config/permissions.test.ts           the speculative list, narrowed
src/lib/authorization/policy.test.ts     the exhaustive matrix, extended
src/types/database.ts                    one table, one enum, three functions

src/app/(app)/doctor/appointments/[id]/consultation/page.tsx   rewritten
src/app/(app)/doctor/patients/[id]/page.tsx    clinical history added

src/features/appointments/errors.ts      PV019
src/features/appointments/errors.test.ts reads the Phase 12 trigger
src/features/doctor/content.ts           two stale notices corrected
src/features/admin/content.ts            the doctor's account-page next step
tests/components/doctor.test.tsx         the notice assertions, updated

docs/ARCHITECTURE.md, docs/SECURITY.md, docs/DATABASE.md,
docs/QA_STRATEGY.md, docs/DESIGN_SYSTEM.md, docs/PUNARVASU_MASTER_SPEC.md
```

#### Dependencies

**None added.**

---

### 2. Database

`supabase/migrations/20260923120000_clinical_records.sql`, applied to the
linked project with `supabase db push` and verified against it.

```text
Tables:         1 added (public.clinical_records). 0 altered structurally.
Enums:          1 added (public.clinical_record_status)
Constraints:    13 on the new table, 1 added to public.appointments
Indexes:        3 added, plus the unique constraint's
Foreign keys:   3 from clinical_records (1 composite), all ON DELETE RESTRICT
RLS policies:   1 added (SELECT). 0 altered, 0 dropped.
Functions/RPCs: 5 added, 0 replaced
Triggers:       3 added (2 on clinical_records, 1 on appointments)
Grants:         SELECT on the new table to authenticated; EXECUTE on 3
                functions. No write grant anywhere. anon receives nothing.
```

#### The table

```text
id                uuid pk
appointment_id    uuid not null    -- unique
patient_id        uuid not null
practitioner_id   uuid not null    -- derived, never a parameter
status            clinical_record_status not null default 'draft'

chief_complaint                    text
history_of_presenting_concern      text
symptoms                           text
clinical_observations              text
assessment                         text
diagnosis_or_clinical_impression   text
doctor_notes                       text
follow_up_notes                    text

version           integer not null default 1   -- optimistic concurrency
created_by        uuid -> auth.users on delete set null
completed_at      timestamptz
completed_by      uuid -> auth.users on delete set null
created_at        timestamptz not null
updated_at        timestamptz not null
```

The eight clinical fields are `phase_12.md` section 13's list unchanged, and
every one is **nullable** — section 37 says not to make every field mandatory,
and section 15 says a draft may be incomplete. What is required is required
*at completion*, which is a check constraint rather than a `not null`.

Nothing Ayurveda-specific is structured. Section 11 permits prakriti, vikriti
and agni as *potential* fields and then says explicitly not to implement every
Ayurvedic concept without confirmed doctor requirements. The clinic has
confirmed none.

#### Enum

`clinical_record_status` — `draft`, `completed`, `amended`. Two are reachable.
`amended` is declared now and unreachable, for the reason Phase 09 recorded
about appointment statuses: PostgreSQL will not let a value added by
`alter type ... add value` be *used* in the same transaction, and Supabase
applies each migration in one — so a later phase that adds and uses it in a
single migration would fail. Asserted by test that no write function names it.

#### Constraints

| Constraint | Purpose |
| --- | --- |
| `clinical_records_one_per_appointment` — `unique (appointment_id)` | **Section 7.** One consultation per appointment, enforced by an index rather than a check-then-insert that two concurrent requests both pass |
| `clinical_records_appointment_consistency` — composite FK on `(appointment_id, patient_id, practitioner_id)` | **Sections 92–93.** The triple must exist as a row in `appointments`, so a record cannot name patient B and practitioner C against an appointment between patient A and practitioner A |
| `appointments_identity_key` — `unique (id, patient_id, practitioner_id)` | Added to `public.appointments` solely so the composite FK can be declared. Trivially satisfied; adds no behaviour |
| `clinical_records_patient_fkey`, `_practitioner_fkey` | Direct references as well, `on delete restrict` |
| `clinical_records_completion_consistency` | `(status = 'draft') = (completed_at is null)`, as an equivalence so neither half drifts |
| `clinical_records_completion_requirements` | **Sections 37–38.** A non-draft record must carry a chief complaint and an assessment. Holds against any writer, including one that skipped the function |
| 8 × `clinical_records_*_length` | Section 36. Bounded text, mirrored by `CLINICAL_FIELD_LIMITS` and asserted against it by test |
| `clinical_records_version_positive` | `version >= 1` |

**Every reference is `on delete restrict`** (section 62). That is a behaviour
change worth stating: the `auth.users → profiles → patients → appointments`
chain cascades, so an account deletion that would previously have taken
appointments with it is now **refused** once a consultation has been
documented. Sections 45 and 46 forbid automatic deletion of clinical records,
so a loud refusal is the correct failure — the phase that settles retention
has to decide what happens instead, deliberately. Verified live.

#### Triggers

| Trigger | Purpose |
| --- | --- |
| `clinical_records_set_updated_at` | Reuses `public.set_updated_at()` from Phase 06 |
| `clinical_records_guard_update` | Three rules in one place: the version **always** increments; the lifecycle is `draft → completed → amended` and nothing else; and **a completed record's content is immutable**. The identity columns are immutable too |
| `appointments_guard_clinical_documentation` | **Section 73.** Refuses to complete an appointment whose clinical record is still a draft |

The version increment lives in the trigger rather than in each function
specifically so that a function added later cannot forget it — which is the
failure that turns optimistic concurrency into silent overwrite.

#### Functions

| Function | Purpose |
| --- | --- |
| `start_consultation(uuid)` | **One parameter: an appointment id.** Derives the patient and the practitioner from the appointment, creates the draft, and moves `checked_in → in_consultation` in the same transaction. Idempotent |
| `save_clinical_draft(uuid, integer, text × 8)` | Saves draft content. Refuses a completed record and a stale version. Returns the new version |
| `complete_clinical_record(uuid, integer, text × 8)` | Validates, saves, transitions to `completed`, and completes the appointment in the same transaction |
| `clinical_records_guard_update()` | The trigger above |
| `appointments_guard_clinical_documentation()` | The trigger above |

Each of the three write functions calls `public.assert_care_practitioner()`
**first** — Phase 11's gate, which refuses no session, a non-doctor and a
doctor with no practitioner record, and *returns the practitioner id*. So the
practitioner is derived, never accepted: there is no `doctorId`,
`practitionerId`, `patientId` or `status` parameter anywhere in this feature.
Asserted structurally and verified live.

#### RLS

```text
clinical_records_select_author   SELECT  has_app_role('doctor')
                                         and practitioner_id = current_practitioner_id()
```

One policy. Everything else is denied by having **no policy at all**, which is
a stronger statement than a predicate that evaluates to false: a predicate can
be weakened by an edit, and an absent policy cannot.

* **receptionist** — no policy. `docs/SECURITY.md` section 6's hard boundary,
  and section 22 forbids weakening it for convenience.
* **patient** — no policy. Sections 21 and 53 and example 8: a doctor-facing
  record is not a patient-facing one.
* **admin** — no policy. Section 23: administrative capability and clinical
  access are separate concepts.
* **anon** — no grant at all, so it never reaches RLS.

No `drop policy` anywhere. Phase 07's ownership policies, Phase 10's
operational ones and Phase 11's care-scoped ones all still say exactly what
they said.

---

### 3. The clinical access policy, decided and documented

`phase_12.md` section 20 requires this to be an explicit, recorded decision
and warns against assuming the broadest access because it is easier. It is the
**authoring-practitioner model**:

```text
a doctor may read and write a clinical record when its
practitioner_id is the doctor's own practitioner record
```

and nothing else.

**Why not care-team or clinic-wide.** It is the narrowest model that supports
the workflow, and it is the one the rest of the product already implies: Phase
11 scoped a patient's *appointment* history to the practitioner's own diary,
so a clinical history that silently included a colleague's consultations would
be **wider than the appointments it hangs off**. A practitioner covering for a
colleague sees what was booked with them and what they themselves documented.

**Why it is narrower than `patients.read.care`.** Being booked to see somebody
lets a practitioner read who they are; it does not let them read what a
colleague concluded about them. Those are two different disclosures and they
get two different permissions.

**What it is not.** Not clinic-wide, not care-team, and not inherited by the
doctor role. Verified live in both directions: doctor A cannot read, save into
or complete doctor B's record, and vice versa.

Widening it later — to a care team, or clinic-wide — is a change to one policy
predicate, and it would need its own audit trail. **If the clinic wants shared
clinical history, that is a product decision with its own policy, not a query
change.**

---

### 4. Routes and components

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/doctor/appointments/[id]/consultation` | Dynamic | **Rewritten.** The consultation workspace: patient header, appointment context, the clinical record, save and complete |
| `/doctor/patients/[id]` | Dynamic | **Extended.** Clinical history added above the appointment history |
| `/doctor/patients/[id]/records/[recordId]` | Dynamic | **New.** One clinical record, read |

All are `noindex`, `private, no-store` and disallowed in `robots.txt` — each
verified in a browser. **All 30 public pages remain static**; the build output
confirms it.

Seven of the eight new components are server components. The three client
islands are the consultation form, the start button and the navigation guard —
the things that genuinely need the browser (section 78).

---

### 5. The consultation workflow

```text
Doctor dashboard
  → Appointment
  → Start consultation        start_consultation
  → Clinical record (draft)
  → Save draft                save_clinical_draft      (repeatable)
  → Continue editing
  → Complete consultation     complete_clinical_record
  → Clinical history
```

#### Starting

`start_consultation` takes **one appointment id**. It resolves the appointment
by that id *and* by the caller's own practitioner record in one statement,
checks eligibility, then reads the patient and the practitioner **out of the
appointment row** — so example 3's `doctorId` and example 4's `patientId` have
nowhere to arrive and nothing to do.

Eligibility is `checked_in` or `in_consultation`. Both, because two paths reach
the same place: Phase 11's status action can move an appointment into
consultation without creating a record, and a practitioner who took that path
must not find a page saying the consultation has not been started with no way
to start it. `isConsultationEligible` mirrors the SQL and is asserted against
it.

#### The appointment/record relationship (section 73)

The two states cannot disagree:

```text
completing the clinical record completes the appointment, atomically
completing the appointment requires the notes not to be a draft
```

The second half is `appointments_guard_clinical_documentation()`, a trigger
rather than a check inside `update_appointment_status_as_doctor`, for two
reasons: it binds **every** write path including any added later, and it leaves
the Phase 11 function byte-identical — so the mirror test that parses that
migration still describes the function actually installed.

An appointment with **no** clinical record is unaffected. A consultation can
legitimately happen without documentation being started in Punarvasu, and
refusing to close that appointment would invent a requirement the clinic has
not asked for. What is refused is the narrower, genuinely inconsistent case:
notes were started, they are still a draft, and somebody is about to mark the
appointment finished.

The legitimate remaining difference, documented as section 73 requires: if the
appointment was already completed or was cancelled after the consultation
began, the record still completes and the appointment is left alone. A clinical
record describes care that happened, and it must be possible to finish
documenting it whatever later became of the scheduling row.

---

### 6. Draft, completion and concurrency

#### Why an explicit save and not autosave

Section 32 lists what autosave has to get right — debouncing, races, offline
failure, never silently overwriting newer content, never claiming a save that
did not happen — and then says plainly that a reliable explicit `Save draft` is
preferable to a fragile autosave system. This is the explicit one.

#### The save state never lies (sections 33, 69)

Five states, always visible above the controls, never a toast:

```text
No changes yet    nothing to lose
Unsaved changes   work is at risk        (warning tone)
Saving…           a request is in flight
Saved at 14:32    it is in the database, and when
Not saved         it failed, and the changes are still here
```

`Saved` is produced only after the action has returned success, and it carries
a **time**, because "Saved" with no time is indistinguishable from "Saved half
an hour ago". Every failure message says explicitly that the changes were not
saved.

#### Stale updates (section 34)

Optimistic concurrency on a `version` column:

* the trigger increments it on **every** update, so no function can forget;
* both save functions scope their update by `version = p_expected_version`
  **in the statement itself**, not only in an `if` above it — two concurrent
  saves cannot both pass a check and both write;
* a stale write raises `PV015` and the application reports it as a
  **conflict**, which is neither success nor an ordinary error: the form stops
  offering to save at all and asks for a reload, because saving again would
  perform exactly the overwrite the conflict prevented;
* **no version is handed back on a conflict.**

Verified live: two concurrent saves at one version, exactly one succeeded.

#### Completed records are not silently overwritable (section 16, example 5)

Three layers. The UI renders a completed record as prose rather than a form.
Both save functions refuse a non-draft. And `clinical_records_guard_update()`
refuses an update that changes **any** of the eight clinical fields on a
non-draft row — asserted by test to name every one of them, so none is a column
a completed record could still be edited through.

A completed record is also rendered with no edit control and no delete control
anywhere, and there is no delete function, no delete grant and no delete
policy — absent at four levels rather than hidden at one (sections 45–46).

#### Duplicate creation (section 87)

A double-click, a retry, a browser refresh and two genuinely concurrent
requests all resolve to one record:

* the button is disabled for the duration of the request;
* `start_consultation` inserts `on conflict (appointment_id) do nothing` and
  reads back whatever is there, so the second caller gets the first caller's
  record rather than an error;
* `clinical_records_one_per_appointment` is a unique index, which is what
  decides between two genuinely concurrent requests under the database's own
  concurrency control.

Verified live with two parallel calls: exactly one record.

---

### 7. Clinical history

Section 39. The patient page carries the consultations this practitioner has
documented, above the appointment history — because a practitioner about to see
somebody reads what happened last time before they read when it happened.

**The list carries no clinical content at all.** Four columns: when, what kind
of consultation, whether the notes are finished, and a way in. That is section
26 applied within the doctor's own screens — a list is read at a glance, often
with somebody else in the room. The *query* does not fetch the notes either:
`HISTORY_COLUMNS` names six summary columns and no clinical field.

Bounded at twenty with a visible notice, ordered by an index
(`clinical_records_patient_idx`), filtered and limited in the statement.
Section 64: "do not query all clinical records and filter in JavaScript."

A notice says the list is the practitioner's own, because an empty list has two
explanations and the practitioner needs to know which.

---

### 8. Authorization and RLS changes

Two permissions added to `config/permissions.ts`, granted to the **doctor role
alone**:

| Permission | Covers |
| --- | --- |
| `clinical_records.read` | Read the clinical records this practitioner authored, and a patient's clinical history |
| `clinical_records.write` | Start a consultation, save a draft, complete it |

They arrive in the same change as `public.clinical_records` and the workspace
that uses them — the rule every phase since 08 has followed, finally applied to
a clinical permission. Prescriptions, treatment plans and documents remain
undeclared.

```text
src/proxy.ts                    optimistic redirect; /doctor already listed
  v
(app)/layout.tsx                requireUser()
  v
(app)/doctor/layout.tsx         requireAreaAccess(PROTECTED_AREAS.doctor)
  v
page                            requirePermission("clinical_records.read")
  v
server action                   can(user.role, "clinical_records.write")
  v
assert_care_practitioner()      auth.uid() -> role -> practitioner id
  v
the function's own scoping      by id AND by that practitioner, one statement
  v
RLS                             clinical_records_select_author
```

---

### 9. Security and adversarial results

#### Live database — 75 checks, real per-role JWTs

Run against the linked project by signing in as each account with the anon key,
so every check went through real RLS with a real `auth.uid()`. The service-role
client was used only to build and remove the fixture and to read back what a
check wrote — never to perform an operation under test. Synthetic data only;
everything created was deleted.

| Area | Result |
| --- | --- |
| `anon` reads no clinical record, cannot start a consultation, cannot save | PASS (3) |
| **Patient, receptionist and admin cannot start a consultation** (`42501`) | PASS (3) |
| Doctor A can start one; it is a draft at version 1 | PASS (3) |
| **The patient and practitioner come from the appointment** | PASS (2) |
| The acting account is recorded | PASS |
| The appointment moved to `in_consultation` in the same transaction | PASS |
| **Starting twice returns the same record; still exactly one** | PASS (2) |
| **Two concurrent starts produce exactly one record** | PASS |
| A consultation cannot start from a `requested` appointment (`PV008`) | PASS |
| **Doctor B cannot start a consultation on doctor A's appointment** (`PV009`) | PASS |
| Doctor A reads their own record | PASS |
| **Patient, receptionist, admin and doctor B cannot read it** | PASS (4) |
| A bare `select` returns nothing for a receptionist, a patient, and none of A's for doctor B | PASS (3) |
| **No role — patient, receptionist, doctor, admin — can insert, update or delete a clinical record** | PASS (12) |
| **Patient, receptionist and admin cannot save a draft** (`42501`) | PASS (3) |
| **Doctor B cannot save into doctor A's record** (`PV018`) | PASS |
| Doctor A can; the version increments and is returned; content stored; blank → null; status still draft | PASS (5) |
| An incomplete draft can be saved | PASS |
| **A stale write is refused** (`PV015`) | PASS |
| **Two concurrent saves at one version: exactly one succeeds** | PASS |
| Completion without an assessment is refused (`PV017`) | PASS |
| **The appointment cannot be completed while its notes are a draft** (`PV019`) | PASS |
| Doctor A can complete; status, completion time and actor recorded | PASS (5) |
| **The appointment was completed in the same transaction, with history** | PASS (2) |
| **A completed record cannot be edited or re-completed** (`PV016`), and its content is unchanged | PASS (3) |
| **An inconsistent patient/practitioner/appointment triple is refused** (`23503`) | PASS |
| **A second record for one appointment is refused** (`23505`) | PASS |
| **A record cannot be moved to another patient** | PASS |
| **A patient with a clinical record cannot be deleted** (`23503`) | PASS |
| Doctor B can start their own; doctor A cannot read or save into it | PASS (3) |
| **A doctor with no practitioner record cannot start one and reads none** | PASS (2) |
| Regressions: patient appointments, receptionist patients, blocked periods, `internal_note` | PASS (4) |

**75 passed, 0 failed.**

#### `phase_12.md` sections 85 and 101's checklist

| Attempt | Result | Where proved |
| --- | --- | --- |
| Unauthenticated → clinical record | **DENIED** | Browser (redirect to sign-in); live DB |
| Patient → doctor clinical record | **DENIED** | Live DB; browser `/forbidden` |
| Receptionist → clinical record | **DENIED** | Live DB; browser; no policy at all |
| Unauthorized doctor → record | **DENIED** | Live DB, both directions |
| Authorized doctor → permitted record | **ALLOWED** | Live DB and browser |
| Changed `recordId` | Resolved by the caller's own practitioner; `PV018`, indistinguishable from not-found | Live DB |
| Changed `patientId` | **No effect** — not a parameter of any write; on a read, a filter the policy refuses | Live DB, action tests |
| Changed `doctorId` / `practitionerId` | **No effect** — no parameter, no schema field, no form field. Asserted in the source | Validation tests, structural test, component test |
| Changed `appointmentId` | Validated as a UUID, then resolved by the caller's own practitioner | Live DB |
| Client role spoofing | Rejected by `strict()`, never read from the form; the database re-checks | Validation tests, live DB |
| Manipulated `status` | **No parameter anywhere.** The only path to `completed` is the function, which validates | Structural test, live DB |
| IDOR | **DENIED**, and indistinguishable from not-found | Live DB and browser |
| Cross-patient access | **DENIED** | Live DB |
| Cross-doctor access | **DENIED both ways** | Live DB, two doctors |
| Duplicate consultation | **PREVENTED** — unique index; idempotent function | Live DB, including concurrent |
| Concurrent creation | **SAFE** — exactly one record | Live DB |
| Stale update | **SAFE** — `PV015`, nothing overwritten | Live DB, including concurrent saves |

#### Live browser — 102 checks, real Chrome, production build

Signed in through the **real sign-in form** as each seeded account.

| | `/doctor` | `/doctor/appointments` | `/doctor/patients` | appointment | consultation |
| --- | --- | --- | --- | --- | --- |
| unauthenticated | → sign in | → sign in | → sign in | — | — |
| patient | → `/forbidden` | → `/forbidden` | → `/forbidden` | — | — |
| receptionist | → `/forbidden` | → `/forbidden` | → `/forbidden` | — | — |
| admin | → `/forbidden` | → `/forbidden` | → `/forbidden` | — | — |
| doctor | ✓ | ✓ | ✓ | ✓ | ✓ |

Every refusal was also checked to disclose no clinical content.

Also verified live:

* **Zero axe violations, with real computed colour**, on all five doctor
  routes at both 390px and 1280px.
* **Zero horizontal overflow** at 320, 375, 390, 430, 768, 1024, 1280, 1440 and
  1920px on all five — measured with a fresh layout at each width.
* Exactly one `<h1>`, no skipped heading level, every visible target ≥24px.
* The consultation page renders, names the patient, and **no longer says there
  is nowhere to record notes**.
* **No clinical content in `localStorage`, `sessionStorage` or the URL.**
* `private, no-store` on the workspace; the consultation page is `noindex`.
* Zero running animations under `prefers-reduced-motion`.
* Regression: `/`, `/services`, `/contact`, `/receptionist` and
  `/receptionist/schedule` all axe-clean, and **the front desk renders nothing
  clinical**.

**102 passed, 0 failed.**

#### Automated — 2,405 tests, up from 2,187

| File | Count | Covers |
| --- | --- | --- |
| `src/features/clinical/status.test.ts` | 19 | The lifecycle, editability and completion requirements — and that **all four agree with the migration**, by parsing the enum, the guard's transition branches, the check constraint and the eligibility list out of the SQL. Plus: the immutability clause names every one of the eight columns |
| `src/features/clinical/validation.test.ts` | 38 | Nineteen hostile fields one at a time — `doctorId`, `practitionerId`, `patientId`, `status`, `completedAt`, `role`, `version`, `prescription`, `treatmentPlan`, `documentId` and more — **rejected rather than stripped**; that the module's source names none of them; that the form's field list is exactly the schema's keys; that the bounds equal the check constraints', read from the migration; and that clinical prose (angle brackets, slashes, percent signs) is accepted rather than mangled |
| `src/features/clinical/errors.test.ts` | 12 | Every code the migration raises is recognised and none is declared that it does not raise; a conflict is its own outcome; every message says the changes were not saved; and **no policy error, RLS failure, SQL, constraint name, table name or connection string can reach a screen or a log** |
| `tests/integration/clinical-actions.test.ts` | 40 | Four roles writing nothing; a refusal naming no role and no permission; the exact RPC argument lists; **fifteen planted fields changing nothing**; a stale write becoming a conflict with no version handed back; completion validating before it calls; and that **no log line carries clinical content, a patient name or a phone number** |
| `tests/integration/clinical-security.test.ts` | 50 | The **database's** guarantees, asserted against the migration: one policy, scoped by relationship, no blanket policy, no write policy or grant, every function authorizing before it reads or writes, pinned `search_path`, no practitioner/doctor/patient/status parameter, the composite foreign key, the unique constraint, `on delete restrict` on every reference, the version increment, the optimistic lock in the statement, the completion constraints, the draft-notes trigger, and that **no clinical column is added to `appointments`**, no existing function is replaced and no policy is dropped. Plus the application layer: no table write, no service-role client, a permission check on every exported read, no `select *`, nothing in browser storage, and **no clinical field name in any log call** |
| `tests/components/clinical.test.tsx` | 48 | One `<form>` carrying exactly ten fields and no identity claim; a textarea per clinical field with a real label; **no HTML `required`, so a draft can be saved**; the five save states, and that "Saved" is never shown when the server refused; the form stopping after a conflict; completion asking first and refusing until both fields are written; a completed record as prose with no editable control; markup rendered as text; the patient's identity prominent with a derived age; no address or emergency contact; a history list with no clinical content; nothing in browser storage or the URL; keyboard operation; error association; and axe |

---

### 10. Defects found and fixed

**1. The browser's own validation silently blocked "Save draft".**
*(real — found by the component suite, and it would have broken the core
workflow)*

`Field` sets the HTML `required` attribute from its `required` prop, which is
correct for every form before this one. The consultation form marks the chief
complaint and the assessment as required *for completion*, so both textareas
carried `required` — and the browser's constraint validation therefore refused
to submit the form while either was empty.

That is precisely the state a draft exists to hold. A practitioner who had
written half a history and no assessment would press "Save draft" and get
**nothing**: no request, no error, no saved notes.

Found because `tests/components/clinical.test.tsx` measured zero submissions
*and* no `submit` event at all. It passed in isolation for the tests that did
not need a save, which is what made it worth chasing rather than assuming a
harness fault.

Fixed with `required={false}` after the spread, so `Field` still renders the
marker and sets `aria-required` while the HTML attribute stays off. Two
regression tests: one asserting no textarea carries `required`, one asserting
`aria-required` is still `true` on the two that need it.

**2. A stale placeholder outlived the thing it stood in for.**
*(real — found by the browser pass)*

Three notices still told a practitioner that clinical records were being built
and were not available:

* `DOCTOR_PATIENT_COPY.clinicalNotice` — on every patient summary;
* `DOCTOR_SCOPE_NOTICE` — at the top of the workspace;
* `ROLE_NEXT_STEPS.doctor` — on the account page.

All three now name what exists and what still does not. The consequence of
leaving them is specific: a practitioner reading "clinical records are not
available yet" goes and writes their notes somewhere else, with the page that
holds them one click away.

A regression test asserts the patient summary no longer claims clinical records
are unavailable.

**3. A flaky assertion, fixed rather than retried.**
*(found by running the full suite)*

Five component tests passed in isolation and failed in a full run: a server
action resolves asynchronously and `userEvent.click` only awaits the click, so
asserting immediately afterwards races the result under a loaded worker.
`docs/QA_STRATEGY.md` section 35 forbids papering over a flake, so the
assertions now `waitFor` the state they are about. No assertion was weakened
and nothing is retried. Three consecutive full runs: 2,405 passed each time.

#### Three harness bugs, recorded because a report listing only what passed is not evidence

* **The fixture could not create a practitioner.** `practitioners.profile_id`
  is `not null`, and the harness inserted the row and then set the owner. The
  database was right; the harness now inserts both together.
* **A body-wide clinical-word scan flagged the site footer.** The footer
  carries the healthcare disclaimer `AGENTS.md` section 15 requires — "not a
  substitute for professional **diagnosis**, treatment or emergency care" — so
  the scan flagged the very sentence that keeps the product responsible. It now
  scans `<main>`, which is the right question anyway. This is the same class of
  false failure Phase 11 recorded about the word "prescriptions".
* **`textContent` on a detached clone read the RSC flight payload.** The first
  attempt at excluding boundary notices cloned `document.body` and removed the
  alerts — but a detached node has no layout, so `innerText` is empty and
  `textContent` is used instead, and that includes every string inside
  `<script>` whether rendered or not. The scan now subtracts the notices from
  the live `innerText`.

#### And the stale-server trap, avoided rather than hit

Phases 06, 07, 08 and 11 each recorded it. The harness uses a **fresh port per
run** and the ports are stopped with `Get-NetTCPConnection` plus
`Stop-Process`, because on Windows `next start` survives a `kill()` of the
shell that spawned it.

---

### 11. Verification

Executed on 2026-09-19:

```text
Lint:       PASS — npx eslint . --max-warnings=0, 0 problems
Typecheck:  PASS — npm run typecheck, exit 0
Formatting: PASS — npx prettier --check .
Tests:      PASS — 2,405 tests, 74 files (was 2,187 / 68)
Build:      PASS — npx next build, 36 static pages, no warnings
```

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 2,405 / 74 files**, three consecutive clean runs |
| Production build | `npx next build` | **PASS** — all 30 public pages still static; the 7 doctor routes dynamic |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 169 files, 0 findings |
| Migration | `supabase db push` | **PASS** — applied to the linked project |
| Live database | 75 checks, real per-role JWTs | **PASS — 75/75** |
| **Live browser** | 102 checks, real Chrome, production build | **PASS — 102/102** |
| Live axe, real computed colour | 5 routes × 2 widths, plus 5 regression pages | **PASS** — 0 violations |
| Live overflow | 9 widths × 5 routes, fresh layout each | **PASS** — none |
| E2E | — | **NOT RUN** — no E2E tool is installed (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

---

### 12. Acceptance criteria

#### Clinical model

| Criterion | Result |
| --- | --- |
| Clinical record schema exists | PASS — `public.clinical_records`, applied and verified live |
| Patient relationship is enforced | PASS — FK plus the composite FK; derived from the appointment, never a parameter |
| Practitioner relationship is enforced | PASS — FK plus the composite FK; derived from `auth.uid()` |
| Appointment relationship is enforced | PASS — FK, `not null`, `on delete restrict` |
| Record status is constrained | PASS — a database enum, a transition trigger, and two check constraints |
| Duplicate consultation creation is prevented | PASS — unique index; verified live including two concurrent starts |

#### Consultation

| Criterion | Result |
| --- | --- |
| Doctor can start a consultation from an eligible appointment | PASS — live and in a browser |
| Doctor can create a draft clinical record | PASS |
| Doctor can update a draft | PASS — live, including an incomplete one |
| Doctor can complete a record | PASS — live; the appointment completes with it |
| Completion validation works | PASS — three layers; live (`PV017`) |
| Invalid status transitions are rejected | PASS — the guard trigger; live (`PV016`) |

#### Clinical history

| Criterion | Result |
| --- | --- |
| Authorized doctor can view permitted clinical history | PASS |
| Clinical history is securely scoped | PASS — `clinical_records_select_author` plus the patient filter; verified live |
| Unauthorized records cannot be accessed | PASS — live, both directions, indistinguishable from not-found |
| History is efficiently queried | PASS — filtered, ordered and bounded in the statement, served by `clinical_records_patient_idx`; no clinical column fetched |

#### Security

| Criterion | Result |
| --- | --- |
| Clinical data is protected by server authorization | PASS — permission, then the database's role check, then RLS |
| RLS is enabled and tested | PASS — 75 live checks |
| Cross-patient access is denied | PASS — live |
| Unauthorized doctor access is denied according to policy | PASS — live, both directions |
| Receptionist clinical access is denied | PASS — **no policy at all**; live and in a browser |
| Client-controlled IDs cannot bypass authorization | PASS — a record id is resolved by the caller's own practitioner id |
| Practitioner spoofing fails | PASS — there is no practitioner parameter to spoof, anywhere |
| Clinical data is not placed in browser storage | PASS — asserted in jsdom and **measured in a browser** |
| Clinical data is not leaked through logs/errors/analytics | PASS — asserted structurally and behaviourally; no analytics exists |
| Private routes are not publicly cacheable/indexable | PASS — `private, no-store` and `noindex` verified in a browser |

#### Data integrity

| Criterion | Result |
| --- | --- |
| Appointment/patient/practitioner relationships are consistent | PASS — a **composite foreign key**; verified live that an inconsistent triple is refused |
| Clinical records cannot be accidentally orphaned | PASS — three `not null` references, all `on delete restrict` |
| Completed records are not silently overwritten | PASS — the guard trigger refuses a content change; live (`PV016`) |
| Concurrent creation is handled | PASS — one record from two parallel calls |
| Stale updates are handled appropriately | PASS — `PV015`; two concurrent saves, exactly one won |

#### UX

| Criterion | Result |
| --- | --- |
| Consultation form is clear and clinically usable | PASS — three titled sections in the order a consultation runs, textareas throughout, no dropdowns |
| Patient identity is visible | PASS — a heading, date of birth, derived age and phone, with a prompt to check |
| Appointment context is visible | PASS — date, time, type and status |
| Save status is clear | PASS — five states, always visible, announced, never claiming a save that failed |
| Unsaved changes are handled | PASS — `beforeunload` **and** in-app link interception, with Stay / Save & leave / Leave |
| Loading/error/empty states exist | PASS — loading skeleton, four consultation states, a failed history distinguished from an empty one |
| Responsive design works | PASS — **measured**, nine widths, five routes, no overflow |
| Accessibility requirements are met | PASS — **0 axe violations with real computed contrast** at 390px and 1280px; one `h1`; no skipped level; targets ≥24px; real fieldsets, labels and error association |

#### Architecture

| Criterion | Result |
| --- | --- |
| Phase 08 authorization is reused | PASS — no second mechanism; two permissions added to the one table |
| Phase 09 appointment engine is reused | PASS — the status enum, the transition trigger and the event history are untouched and called through |
| Phase 11 doctor workspace integrates cleanly | PASS — the route, the guard and the patient context did not move; `assert_care_practitioner()` is reused unchanged |
| No prescription logic exists | PASS — no column, no field, no permission; asserted |
| No document storage exists | PASS — no column, no upload, no bucket; asserted |
| No AI clinical logic exists | PASS — no model, no key, no call |

#### Engineering

| Criterion | Result |
| --- | --- |
| TypeScript remains strict | PASS — no `any` added |
| No unnecessary `any` | PASS |
| No unnecessary client components | PASS — three islands, each for a browser capability |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

```text
Doctor Dashboard → Appointment → Start Consultation → Create Clinical Record
     → Save Draft → Continue Editing → Complete Consultation
     → View Clinical History
```

Every step is implemented and verified against the live database. The
boundaries hold, each verified live:

```text
Receptionist        ✕ clinical records    — no policy at all
Unauthorized doctor ✕ another's records   — PV018, indistinguishable from not-found
Patient             ✕ doctor-only record  — no policy at all
Admin               ✕ clinical records    — no policy at all
```

Clinical data is protected at **both** the application-authorization layer and
the database-RLS layer, and the phase adds no path that reaches it through
only one.

---

### 13. Deferred

Intentionally not built:

* **Prescriptions and treatment plans** — Phase 13. No permission, no column,
  no field, no navigation placeholder. The clinical record is the foundation
  they hang off and does not need redesigning for them.
* **Clinical documents, file uploads, lab reports** — Phase 14.
* **AI clinical decision support** — Phase 17. No model, no key, no call.
* **The amendment workflow** (section 17). The enum value, the transition edge
  and the trigger that forbids editing instead of amending all exist; the
  surface does not. When it arrives it writes a new revision and a reason, and
  the guard is what guarantees it cannot instead quietly edit the original.
* **A patient-facing clinical view** (sections 21, 53, example 8). Deliberately
  not derived from this table. It would be its own authorized projection with
  its own query, its own policy and its own type.
* **Administrative clinical access** (section 23). `docs/SECURITY.md` section
  6's matrix marks it "Read, audited", and the audit subsystem that "audited"
  refers to does not exist — so granting the read now would grant it unaudited.
* **Clinical search** (section 41). Not required by any Phase 12 workflow, and
  full-text search over clinical records is a high-sensitivity operation that
  needs its own bounds and its own review.
* **Autosave** (section 32). The specification prefers a reliable explicit save
  to a fragile autosave, and this is the explicit one.
* **A clinical timeline visualisation** (section 40). The history list is
  chronological and readable; a decorative timeline would add nothing a
  practitioner acts on.
* **Deleting a clinical record** (sections 45–46). No function, no grant, no
  policy, no control.
* **Notifications** (Phase 15) and **analytics** (Phase 16). Nothing tells a
  patient a consultation was documented, and no clinical content is measured.
* **Moving `ProfileSection`/`ProfileFieldList`/`ProfileField` to
  `components/shared/`.** Five areas now depend on them, which more than earns
  the move; it belongs on its own change rather than inside this one.

---

### 14. Known issues

1. **The browser's back button is not intercepted.** The unsaved-changes guard
   covers refresh, tab close and navigation out of the application through
   `beforeunload`, and **every in-app link** through a capture-phase click
   listener. It does not cover the browser's back button within the
   application, because blocking that needs a decoy history entry which breaks
   the back button in its own right. The mitigation is that the save control
   is always visible and the save state always says whether there is anything
   to lose. `phase_12.md` section 68 lists the back button; this is a partial
   answer, recorded rather than claimed.
2. **Deleting a patient, practitioner or appointment with a clinical record now
   fails.** Deliberate (section 62), and it changes the behaviour of the
   existing cascade chain: an account deletion is refused once a consultation
   has been documented. The phase that settles retention has to decide what
   happens instead.
3. **The clinical access policy is authoring-practitioner scoped.** A
   practitioner covering for a colleague sees no clinical record the colleague
   wrote. That is the model working as designed and documented in section 3
   above — but it is a product decision the clinic should confirm, and widening
   it is a change to one predicate plus an audit trail.
4. **No audit of clinical-record *access*.** Every write is recorded — the
   actor, the record and the operation in the structured log, and the
   appointment's own status changes in `appointment_events`. A doctor *reading*
   a record is not recorded. `docs/SECURITY.md` section 15 lists that as
   something to record "where appropriate", and it belongs with Phase 19.
5. **The clinic has no verified practitioner**, and the development project's
   seeded one is named "Test Doctor". Unchanged from Phases 09–11.
6. **The consultation types, durations, minimum notice and booking horizon are
   still provisional.** Unchanged from Phase 09.
7. **Required fields at completion are chief complaint and assessment**, taken
   from section 37's own example because the clinic has specified none.
   `CLINICAL_COMPLETION_REQUIRED_FIELDS` and the check constraint are the two
   places to change if the clinic decides otherwise.
8. **`src/types/database.ts` is still hand-written.** `npm run db:types`
   requires Docker. The shape was written against the migration and every table
   and function it declares was exercised live.
9. **The four Phase 08 test accounts and the seeded practitioner remain on the
   development project.** Shared, well-known credentials, including an
   administrator. **Delete them before this database takes real patient data** —
   and that now matters more, because the database can hold clinical records.
10. **No E2E tool, no screen-reader pass, no Lighthouse run.** Unchanged since
    Phase 01/02. The live browser checks are a script written for this phase,
    not a maintained suite.
11. **Still no CSP.** Unchanged since Phase 02.
12. **Legal pages still do not exist.** Required before the clinic handles real
    records through this website — and now unambiguously so.

---

### 15. Phase status

```text
Phase 12: COMPLETE
Ready for Phase 13: YES
```

Phase 13 has not been started.

Prescriptions and treatment plans can be built directly on what exists. The
clinical record is the anchor they reference, `assert_care_practitioner()` is
the gate they start with, `clinical_records_select_author` is the predicate
their own policy mirrors, and the `draft → completed` discipline — with a
completed record made immutable by a trigger rather than by the UI — is the
shape an issued prescription needs, only stricter. The permission arrives in
`config/permissions.ts` in the same change as the surface that uses it, which
is the rule every phase since 08 has followed.

One caveat to carry forward: `docs/SECURITY.md` section 6 says a prescription
is **immutable once issued**. Phase 12 makes a completed clinical record
immutable through `clinical_records_guard_update()`; a prescription needs the
same treatment from its first migration, not added later — because by then
there are rows that were mutable.
