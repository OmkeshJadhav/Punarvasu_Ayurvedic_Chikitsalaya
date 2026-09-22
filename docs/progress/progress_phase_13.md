## PHASE 13 — Prescription & Treatment Plans

Status:
COMPLETED — migration applied to the live Supabase project and verified
against it with real per-role JWTs

Completed On:
2026-09-19

Summary:
Built the doctor's clinical *instruction* on top of Phase 12's record of what
happened: `public.prescriptions` and `public.prescription_items`,
`public.treatment_plans` and `public.treatment_plan_items`, the two builders
inside the consultation workflow, the deliberate review-before-issue, the
draft → issued → withdrawn lifecycle, the prescription and plan history, and
the first patient-facing clinical surfaces in the product.

**Not one prescription column was added to `public.clinical_records` or
`public.appointments`.** Both instruments are their own tables with their own
items, their own lifecycle, their own policies and their own grants.

**No client role can write any of the four tables.** No insert, update or
delete grant, no such policy, for anybody. Every write is one of ten
`security definer` functions, and across all ten there is **no `patientId`, no
`practitionerId`, no `doctorId`, no `appointmentId` and no `status`
parameter** — the first four are read out of the clinical record, which is
itself resolved by id *and* by the caller's own practitioner record in one
statement, and the fifth does not exist because each transition has its own
function.

**A draft is invisible to the patient at the database level.**
`prescriptions_select_patient` carries `status <> 'draft'`, so it is a
predicate on the row rather than a filter a query could forget.

2,784 tests pass, up from 2,405. **141 live database checks** with real
per-role JWTs, including two doctors, two patients, two genuinely concurrent
prescription creations, two genuinely concurrent saves at one revision, **two
genuinely concurrent issues**, the full draft → issued → withdrawn → replaced
lifecycle, and the service-role client being refused an edit to an issued
prescription.

**No browser pass was run.** That gap is recorded honestly in section 14.

---

### Repository assessment before starting

Phases 06–12 left identity, the patient record, authorization, the appointment
engine, both staff workspaces and the clinical record. Reused rather than
rebuilt: `requireAreaAccess`/`requirePermission`/`assertPermission`,
`config/permissions.ts`, the Supabase clients, `AppError`, the structured
logger, `uuidSchema`, `clinicDateSchema`, `assert_care_practitioner()`,
`current_practitioner_id()`, `current_patient_id()`, `has_app_role()`,
`set_updated_at()`, the `Table` family, `Field`, `Input`, `Textarea`,
`NativeSelect`, `Dialog`, `Alert`, `Button`, `EmptyState`, `ErrorState`, the
Phase 07 patient formatters and the Phase 09 clinic-date formatters.

Five findings shaped the work:

* **Phase 12 left the seam and named it.** Its progress file said
  prescriptions and treatment plans "can be built directly on what exists:
  the clinical record is the anchor they reference,
  `assert_care_practitioner()` is the gate they start with, and the
  `draft → completed` discipline is the shape an issued prescription needs,
  only stricter." That is exactly what was built.
* **Phase 12 also left a warning**: *"a prescription needs the same treatment
  from its first migration, not added later — because by then there are rows
  that were mutable."* Immutability is in this migration from the start, in a
  trigger rather than in the UI.
* **`docs/SECURITY.md` §6's matrix has always read "Prescriptions | View
  own" for a patient**, and `docs/PRODUCT_SPEC.md` §5.2 says patients want
  their prescriptions and treatment plan in one place. So patient visibility
  is in scope, and this is the phase that builds it — which makes it the
  phase that must make a draft invisible.
* **`clinical_records` had no unique constraint on
  `(id, appointment_id, patient_id, practitioner_id)`**, so the composite
  foreign keys could not be declared without adding one. It is trivially
  satisfied and adds no behaviour — exactly Phase 12's
  `appointments_identity_key`, one level up.
* **Three save/guard components in `components/clinical/` were about to be
  needed three times over.** They were generalised into
  `components/shared/` rather than copied.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql

src/features/prescriptions/types.ts          the domain model
src/features/prescriptions/status.ts         the lifecycle rules
src/features/prescriptions/status.test.ts
src/features/prescriptions/validation.ts     the trust boundary
src/features/prescriptions/validation.test.ts
src/features/prescriptions/errors.ts         SQLSTATE -> safe copy
src/features/prescriptions/errors.test.ts
src/features/prescriptions/format.ts         display formatting
src/features/prescriptions/format.test.ts
src/features/prescriptions/content.ts        all prescribing copy
src/features/prescriptions/queries.ts        authorized, column-scoped reads
src/features/prescriptions/actions.ts        five server actions

src/features/treatment-plans/types.ts
src/features/treatment-plans/status.ts
src/features/treatment-plans/status.test.ts
src/features/treatment-plans/validation.ts
src/features/treatment-plans/validation.test.ts
src/features/treatment-plans/errors.ts
src/features/treatment-plans/errors.test.ts
src/features/treatment-plans/content.ts
src/features/treatment-plans/queries.ts
src/features/treatment-plans/actions.ts      five server actions

src/components/prescriptions/prescription-builder.tsx
src/components/prescriptions/medicine-name-field.tsx
src/components/prescriptions/prescription-summary.tsx
src/components/prescriptions/prescription-history.tsx
src/components/prescriptions/prescription-status.tsx
src/components/prescriptions/prescription-actions.tsx
src/components/prescriptions/start-prescription.tsx

src/components/treatment-plans/treatment-plan-builder.tsx
src/components/treatment-plans/treatment-plan-summary.tsx
src/components/treatment-plans/treatment-plan-history.tsx
src/components/treatment-plans/treatment-plan-status.tsx
src/components/treatment-plans/treatment-plan-actions.tsx
src/components/treatment-plans/start-treatment-plan.tsx

src/components/shared/save-state.tsx
src/components/shared/unsaved-changes-guard.tsx
src/components/shared/clinical-context-header.tsx

src/app/(app)/doctor/appointments/[id]/prescription/page.tsx
src/app/(app)/doctor/appointments/[id]/treatment-plan/page.tsx
src/app/(app)/doctor/patients/[id]/prescriptions/[prescriptionId]/page.tsx
src/app/(app)/doctor/patients/[id]/treatment-plans/[planId]/page.tsx
src/app/(app)/patient/prescriptions/page.tsx
src/app/(app)/patient/prescriptions/loading.tsx
src/app/(app)/patient/prescriptions/[id]/page.tsx
src/app/(app)/patient/treatment-plans/page.tsx
src/app/(app)/patient/treatment-plans/loading.tsx
src/app/(app)/patient/treatment-plans/[id]/page.tsx

tests/integration/prescription-actions.test.ts
tests/integration/prescription-security.test.ts
tests/components/prescriptions.test.tsx
tests/components/treatment-plans.test.tsx
docs/progress/progress_phase_13.md
```

#### Modified

```text
src/config/permissions.ts              six permissions: four doctor, two patient
src/config/permissions.test.ts         the speculative list, narrowed
src/lib/authorization/policy.test.ts   the exhaustive matrix, extended
src/types/database.ts                  four tables, three enums, ten functions
src/lib/logging/redact.ts              clinical key fragments + an identifier
                                       allowlist so an opaque id still logs
src/lib/logging/redact.test.ts

src/components/clinical/save-status.tsx            delegates to the shared one
src/components/clinical/unsaved-changes-guard.tsx  delegates to the shared one
src/app/(app)/doctor/appointments/[id]/consultation/page.tsx  entry points
src/app/(app)/doctor/patients/[id]/page.tsx        two histories added

src/features/clinical/content.ts       the scope notice, no longer stale
src/features/doctor/content.ts         two notices, no longer stale
src/features/admin/content.ts          the doctor's account-page next step
src/features/patients/content.ts       two nav items; the overview description
src/features/auth/content.ts           the account description
src/app/(app)/patient/page.tsx         the "what comes next" card
src/app/(app)/account/page.tsx         the "what comes next" card
tests/components/doctor.test.tsx       the notice assertions
tests/components/patient-profile.test.tsx  the nav count

docs/ARCHITECTURE.md, docs/SECURITY.md, docs/DATABASE.md,
docs/QA_STRATEGY.md, docs/DESIGN_SYSTEM.md, docs/PUNARVASU_MASTER_SPEC.md
```

#### Dependencies

**None added.**

---

### 2. Prescription schema

`supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql`,
applied to the linked project with `supabase db push` and verified against it.

```text
Tables:         4 added. 0 altered structurally.
Enums:          3 added
Constraints:    1 added to public.clinical_records (a unique identity key);
                29 on the four new tables
Foreign keys:   8, of which 2 are composite, and every one on delete restrict
                except the two item-to-parent references (cascade, and
                unreachable — the parent has no delete path at all)
Indexes:        2 partial unique, 7 plain
RLS policies:   8 added, all SELECT. 0 altered, 0 dropped.
Functions/RPCs: 10 callable + 4 policy predicates + 4 trigger functions.
                0 replaced.
Triggers:       6 added
Grants:         column-scoped SELECT on the two parent tables, table SELECT on
                the two item tables, EXECUTE on 10 functions. No write grant
                anywhere. anon receives nothing.
```

#### `public.prescriptions`

```text
id                    uuid pk
clinical_record_id    uuid not null
appointment_id        uuid not null
patient_id            uuid not null      -- derived, never a parameter
practitioner_id       uuid not null      -- derived, never a parameter
status                prescription_status not null default 'draft'
general_instructions  text
version               integer not null default 1   -- optimistic concurrency
created_by            uuid -> auth.users on delete set null
issued_at             timestamptz
issued_by             uuid -> auth.users on delete set null
cancelled_at          timestamptz
cancelled_by          uuid -> auth.users on delete set null
cancellation_reason   text
created_at            timestamptz not null
updated_at            timestamptz not null
```

The five `*_by` columns are **absent from the select grant**, so no client
reads them through any query. A column privilege belongs to a database role
and a patient and a doctor are both `authenticated`, so a column readable by
one is readable by the other — the trap Phase 10 recorded about
`internal_note`. Nothing on a screen needs them.

#### `public.prescription_items`

Section 52's snapshot list exactly: `medicine_name` (the only required field),
`form`, `strength`, `dose_amount`, `dose_unit`, `frequency`, `timing`,
`duration`, `quantity`, `quantity_unit`, `instructions`, plus `sort_order` and
`created_at`.

**There is no medicine catalog and no `medicine_id` column.** Section 9 is
explicit — do not invent an Ayurvedic medicine catalog — and the clinic has
supplied no verified one. Section 51 then asks that an issued prescription
remain historically understandable if a catalog arrives later, and the answer
is that every clinically relevant value is stored as the doctor wrote it. A
future catalog can add a nullable reference beside these columns without
touching a single existing row, and a change to it still cannot rewrite an
issued prescription, because nothing here reads from it.

#### Why dose is two text columns and duration is one

Section 18 asks for dosage structured enough to be clear and warns against
falling back on "take as instructed". `dose_amount` and `dose_unit` are that
structure — they render as "1-2 teaspoon" and can be reported on. They are
**text** rather than numeric because real Ayurvedic dosing includes "1/2",
"1-2" and "a pinch", and a numeric column would push every one of those into
the free-text instructions, which is the outcome section 18 exists to prevent.

Duration is one text column because section 21's own examples include "Until
follow-up" and "As directed", which are not a value and a unit.

#### Constraints worth naming

| Constraint | What it makes impossible |
| --- | --- |
| `prescriptions_clinical_record_consistency` | **A composite foreign key** on `(clinical_record_id, appointment_id, patient_id, practitioner_id)` into `clinical_records`. A prescription naming a patient its consultation does not, a practitioner who did not author it, or a different appointment — all three are not things application code must prevent. Verified live: `23503` for each |
| `prescriptions_one_live_per_record` | A **partial** unique index, `where status <> 'cancelled'`. At most one draft-or-issued prescription per consultation, decided by the index rather than a check-then-insert two requests both pass — and excluding `cancelled` is what leaves the correction path open |
| `prescriptions_issued_at_present` / `_draft_not_issued` | Two implications rather than one equivalence, because a prescription cancelled *after* issue keeps its issue time |
| 11 × `prescription_items_*_length` | Bounded text, mirrored by `PRESCRIPTION_FIELD_LIMITS` and asserted against it by reading the SQL |

---

### 3. Treatment-plan schema

```text
public.treatment_plans
  id, clinical_record_id, appointment_id, patient_id, practitioner_id,
  status treatment_plan_status not null default 'draft',
  title, summary, start_date date, follow_up_on date,
  version, created_by, activated_at/by, completed_at/by, cancelled_at/by,
  created_at, updated_at

public.treatment_plan_items
  id, treatment_plan_id, sort_order, category treatment_plan_category not null,
  title not null, instructions, frequency, duration, created_at
```

Five categories — `diet`, `lifestyle`, `therapy`, `follow_up`, `other`.
Section 27's longer list also offers `exercise` and `medication`; both are
deliberately absent. Exercise is lifestyle, and **medication is a
prescription** — a different table with a different lifecycle and different
patient visibility, and section 28 is explicit that a plan must not duplicate
one. A `medication` section here would be an invitation to write medicines
twice and have them disagree.

`title` is nullable until activation and required by
`treatment_plans_activation_requirements` after it — the same shape Phase 12
used for a clinical record's chief complaint. A draft may be incomplete; what
the patient is *given* may not be.

**A follow-up date books nothing.** Section 47. Nothing in the migration or in
either feature writes to `public.appointments`, asserted structurally and
verified live by counting appointments before and after a plan with a
follow-up date was activated.

---

### 4. Prescription builder workflow

```text
Consultation
   -> Prescription            /doctor/appointments/[id]/prescription
   -> Start a prescription    create_prescription(clinical_record_id)
   -> Add medicine/remedy     with suggestions from this doctor's own history
   -> dose, frequency, timing, duration, quantity, instructions
   -> Add another / reorder / remove
   -> Save draft              save_prescription_draft(id, version, …, items)
   -> Review                  renders the SAVED prescription
   -> Issue                   issue_prescription(id, version)
   -> Prescription history    /doctor/patients/[id]
```

It sits on the appointment, beside the consultation notes, because that is
where a practitioner already is when they decide what to prescribe (section
64 — do not open unrelated pages during a consultation). The patient, the
appointment and the practitioner are derived from the consultation; nothing
asks the doctor to re-enter them and nothing accepts them from a request
(section 79).

#### The review renders the saved prescription, not the unsaved edits

`issue_prescription` takes **no content** — an id and a revision — so what
gets issued is whatever the database already holds. The review therefore
renders the saved snapshot, and issuing is **refused while the form is
dirty**, with a sentence saying to save first. A review that showed unsaved
edits would be showing something that is not going to be issued, which is the
one thing a review must never do.

#### Items

Add, edit, remove and reorder are one atomic operation: the client sends the
full ordered list as one JSON array, and `save_prescription_draft` replaces
the collection inside the database **after** the optimistic lock, so a stale
caller replaces nothing. The items are extracted key by key in SQL rather than
through `jsonb_populate_record`, so the eleven-key allowlist holds on the
database side too.

An entirely blank card is dropped before submission — "add another" leaves
one, and it must not become an error the doctor has to clear. A card with
*something* in it is not dropped, and must name a medicine: a half-filled row
errors rather than silently disappearing.

#### Medicine autocomplete (section 65)

A WAI-ARIA combobox, not a `<datalist>`: a datalist cannot say "still
loading", cannot be styled to the design system and is announced
inconsistently. Arrow keys move, Enter accepts, Escape dismisses, the input
keeps focus, and a polite live region says how many suggestions there are.

Debounced at 220ms with a request sequence number, so a reply for a term the
doctor has already typed past is discarded rather than replacing the right
list with an old one. A request per keystroke would be a query against
prescribing history per keystroke, and the doctor would watch the list flicker
through three wrong answers on the way to the right one.

`public.search_prescribed_medicines` is **not a catalog and makes no clinical
claim**. It reports names *this practitioner has actually written*, scoped to
their own prescriptions in the `from` clause, prefix-matched, bounded,
wildcard-escaped, and returning one name and the form last used with it — no
patient, no date, no dose. It is a server action rather than a `GET`
endpoint, because what a doctor is typing into a medicine field is clinical
content and a URL reaches browser history on a shared consulting-room machine.

The secondary fields — form, dose unit, frequency, timing, duration, quantity
unit — carry a `<datalist>` of **phrasings**. Not one is preselected, none is
required, and the fields accept anything typed. Suggesting a *spelling* is not
suggesting a *treatment*.

---

### 5. Draft / issue lifecycle

```text
draft ──issue──> issued ──withdraw──> cancelled
  │                 │
  └──withdraw───────┴──(amend)──────> amended   (declared, unreachable)
```

| Transition | Function | What it cannot do |
| --- | --- | --- |
| `draft -> issued` | `issue_prescription(id, version)` | carry any content |
| `draft -> cancelled` | `cancel_prescription(id, version, reason)` | delete anything |
| `issued -> cancelled` | the same | change what was issued |
| `issued -> amended` | nothing sets it | — |

Each transition is its own function, so **there is no status parameter in the
feature at all** — section 59's manipulated `{"status": "issued"}` has nowhere
to arrive. Asserted structurally and verified live.

`amended` is declared and unreachable, for the reason Phase 09 and Phase 12
declared theirs: PostgreSQL will not let a value added by
`alter type ... add value` be *used* in the same transaction, and Supabase
applies each migration in one. A test asserts nothing sets it, and that test
is meant to fail on the day the formal amendment workflow arrives.

The treatment plan's is `draft → active → completed`, with `cancelled`
reachable from either live state. Content freezes on **activation** rather
than completion, because an active plan is what the patient was actually told
to do.

#### Concurrency and duplicate protection

| Case | What prevents it | Verified |
| --- | --- | --- |
| Double-click *Start a prescription* | The button disables, and the **partial unique index** decides; the function reads back whichever request won | live: creating twice returns the same id, still one row |
| Two concurrent creates | The same index | live: two parallel calls, exactly one row |
| Double-click *Save draft* | The button disables; the optimistic lock refuses the second | live |
| Two concurrent saves at one revision | `and p.version = p_expected_version` **in the update statement**, not only in an `if` above it | live: exactly one won |
| Stale save after somebody else's | The same | live: `PV022`, and **nothing was overwritten** |
| **Double-click *Issue*** | The update matches only a `draft` row at the expected revision | live |
| **Two concurrent issues** | The same | **live: exactly one succeeded** |
| Network retry / refresh | Idempotent create; a repeat issue is a conflict, not a second prescription | live |
| Concurrent editing by two people | Optimistic `version`, incremented by trigger so no function can forget | live |

After a conflict the form **stops offering to save** and asks for a reload,
because saving again would perform exactly the overwrite the refusal
prevented.

---

### 6. Historical-integrity strategy

An issued prescription is clinical evidence of what a doctor actually
instructed at a moment in time. Five things hold that, and all five are in the
database:

1. **The snapshot.** Every clinically relevant value is stored as the doctor
   wrote it, with no reference to a catalog. A future catalog cannot rewrite
   an old prescription because nothing reads from one (sections 51–52,
   example 5).
2. **Immutability by trigger.** `prescriptions_guard_update()` refuses a
   content change on a non-draft row; `prescription_items_guard_write()`
   refuses any insert, update or delete beneath one. **Verified live against
   the service-role client**, which bypasses row-level security entirely and
   is still refused (`PV021`).
3. **No delete path at all.** No delete function, no delete grant, no delete
   policy, and `on delete restrict` on every reference to a patient,
   practitioner, appointment or clinical record. The items guard refuses even
   a cascade, so an issued prescription cannot be deleted **by anybody** —
   demonstrated live, including on the development fixture, which is why those
   synthetic rows are still there (section 14).
4. **Identity is fixed.** The guard refuses a change to
   `clinical_record_id`, `appointment_id`, `patient_id` or `practitioner_id`.
   Verified live.
5. **Correction is withdraw-then-replace.** The partial unique index excludes
   `cancelled`, so withdrawing frees the consultation for a corrected
   prescription while the withdrawn row — its items, its issue time and its
   reason — stays for ever. That is section 42's "preserve original, new
   authoritative state", reachable without a versioning subsystem, and it is
   the future-compatible path the formal amendment workflow will replace.
   **Verified live end to end**: withdraw, write a replacement, and the
   original is untouched.

Treatment plans get the same treatment from activation. Section 53's "do not
dynamically rewrite a patient's historical treatment plan" is
`treatment_plans_guard_update()`, verified live against the service role.

---

### 7. Patient visibility behaviour

Implemented, because `docs/SECURITY.md` §6's matrix has always read
"Prescriptions | View own" for a patient and `docs/PRODUCT_SPEC.md` §5.2 says
patients want their prescriptions and treatment plan in one place.

| Surface | What it shows |
| --- | --- |
| `/patient/prescriptions` | Issued and withdrawn prescriptions, most recent first. A date, the practitioner, an item count and a status — **no medicine name**, and the query does not fetch one |
| `/patient/prescriptions/[id]` | The full prescription: what to take, the instructions, who issued it and when |
| `/patient/treatment-plans` | Active, completed and withdrawn plans |
| `/patient/treatment-plans/[id]` | The plan, grouped by section |

**A draft is never visible**, and that is not a query filter:
`prescriptions_select_patient` and `treatment_plans_select_patient` carry
`status <> 'draft'`, and the item policies say the same through a
`security definer` predicate. The `.neq("status", "draft")` in the query layer
is defence in depth on top of that, not the control. **Verified live: while
the prescription was a draft the patient saw nothing — not the prescription,
not its items — and the moment it was issued they saw both.**

What a patient does **not** see: a doctor's note, an assessment, a diagnosis,
clinical reasoning, the consultation, or any actor identifier. None of that is
filtered out — `clinical_records` has **no policy at all** for a patient, so
there is nothing to filter.

A **withdrawn** prescription stays visible, marked withdrawn, with the
practitioner's reason. Hiding it would leave somebody following a paper copy
with no way to find out it had been stopped, which is the more dangerous of
the two outcomes by a distance.

Both patient pages carry the safety notice section 75 asks for: this is a
prescription written for you at a particular consultation, it is not general
health information, contact the clinic if anything is unclear, and do not stop
or change medicine prescribed to you by another doctor without speaking to
them. No claim is made anywhere about what the medicines will do.

**A receptionist gets nothing**, and an administrator gets nothing — no policy
at all on any of the four tables, which is stronger than a predicate that
evaluates to false. Section 36 and example 7, and section 37's "admin does not
automatically imply clinical prescription access… must be explicitly
authorized **and audited**" — the audit subsystem does not exist, so granting
the read would grant it unaudited.

---

### 8. Authorization / RLS changes

Six permissions added to `config/permissions.ts`:

| Permission | Role | Covers |
| --- | --- | --- |
| `prescriptions.read` | doctor | Read the prescriptions this practitioner authored |
| `prescriptions.write` | doctor | Create, edit, issue, withdraw |
| `prescriptions.read.self` | **patient** | Read their own **issued** prescriptions |
| `treatment_plans.read` | doctor | Read the plans this practitioner wrote |
| `treatment_plans.write` | doctor | Create, edit, activate, complete, withdraw |
| `treatment_plans.read.self` | **patient** | Read their own **active** plans |

The receptionist and the administrator hold none of the six. No new
`PROTECTED_AREAS` entry was needed: `/doctor` and `/patient` already exist and
already guard every new route.

```text
src/proxy.ts                    optimistic redirect
  v
(app)/layout.tsx                requireUser()
  v
(app)/{doctor,patient}/layout   requireAreaAccess(...)
  v
page                            requirePermission("prescriptions.read" | ".read.self")
  v
server action                   can(user.role, "prescriptions.write")
  v
assert_care_practitioner()      auth.uid() -> role -> practitioner id
  v
the function's own scoping      by id AND by that practitioner, one statement
  v
RLS                             the last word
```

Eight policies added, all `select`, every one naming a role through
`has_app_role()` **and** scoping by a relationship. No `using (true)`
anywhere, no policy dropped, no existing predicate altered, and no write
policy or grant for any role on any of the four tables.

---

### 9. Security and adversarial test results

#### Live database — 141 checks, real per-role JWTs

Run against the linked project by signing in as each account with the anon
key, so every check went through real RLS with a real `auth.uid()`. The
service-role client was used only to build the fixture and read back what a
check wrote — except where it is the subject, in the immutability checks.
Synthetic data only.

The first run made **130** checks; **128 passed and 2 assertions were wrong in
the harness, not in the product** (recorded in section 12). A second run
re-asked those correctly and added cleanup: **11 more checks, all passing**.

| Area | Result |
| --- | --- |
| `anon` reads none of the four tables and can call none of the functions | PASS (8) |
| **Patient, receptionist and admin cannot create a prescription** (`42501`) | PASS (3) |
| Doctor A can; it is a draft at version 1 | PASS (2) |
| **The patient, practitioner and appointment come from the consultation** | PASS (3) |
| The acting account is recorded | PASS |
| Creating twice returns the same prescription; still exactly one | PASS (2) |
| **Two concurrent creates produce exactly one prescription** | PASS |
| **Doctor B cannot create one against doctor A's consultation** (`PV025`) | PASS |
| **Patient, receptionist and admin cannot save a draft** (`42501`) | PASS (3) |
| **Doctor B cannot save into doctor A's prescription** (`PV020`) | PASS |
| Doctor A can; the version increments and is returned | PASS (2) |
| Items stored in the doctor's order; the dose is kept; a blank field becomes null | PASS (4) |
| **A stale save is refused (`PV022`) and nothing was overwritten** | PASS (2) |
| **Two concurrent saves at one revision: exactly one wins** | PASS |
| An item with no medicine name, and more than 50 items, are refused | PASS (2) |
| **A patient cannot see their own DRAFT prescription, nor its items** | PASS (2) |
| A prescription with no items cannot be issued (`PV023`) | PASS |
| **Patient, receptionist and admin cannot issue** (`42501`) | PASS (3) |
| **Doctor B cannot issue doctor A's prescription** (`PV020`) | PASS |
| **Two concurrent issues: exactly one succeeds** | PASS |
| It is issued, with the time and the acting account recorded | PASS (3) |
| Issuing again is refused; still exactly one prescription | PASS (2) |
| **An issued prescription cannot be edited** (`PV021`) | PASS |
| **Even the service role cannot rewrite it, or remove an issued item** | PASS (2) |
| The issued items are intact; it cannot be moved to another patient | PASS (2) |
| **No role can insert, update or delete a prescription or an item** | PASS (16) |
| The patient sees their ISSUED prescription and its items | PASS (2) |
| **Another patient, a receptionist, an administrator and doctor B all see nothing** | PASS (5) |
| Doctor A sees their own; no client can read the actor columns | PASS (2) |
| **Patient, receptionist and admin cannot withdraw** (`42501`) | PASS (3) |
| Doctor A can; it is marked withdrawn with the time and the reason | PASS (4) |
| **The issue time and the items are preserved** | PASS (2) |
| It cannot be withdrawn twice (`PV024`) | PASS |
| **A corrected prescription can then be written, and the original is untouched** | PASS (2) |
| The patient still sees it, marked withdrawn | PASS |
| **A prescription naming a wrong patient, practitioner or appointment is impossible** (`23503`) | PASS (3) |
| **A patient with a prescription cannot be deleted** (`23503`) | PASS |
| Patient, receptionist and admin cannot search medicines (`42501`) | PASS (3) |
| Doctor A is offered what they prescribed before, and only a name and a form | PASS (2) |
| **Doctor B is offered none of doctor A's** | PASS |
| An empty term, a wildcard and a suffix all return nothing; the limit is clamped | PASS (4) |
| Patient, receptionist and admin cannot create a plan (`42501`) | PASS (3) |
| A plan with no title cannot be activated (`PV033`); a `medication` section is refused | PASS (2) |
| **A patient cannot see a DRAFT plan; they see the ACTIVE one and its instructions** | PASS (3) |
| **An active plan cannot be edited, even by the service role** (`PV031`) | PASS (2) |
| **A receptionist, an administrator and doctor B see no plan** | PASS (3) |
| **A follow-up date booked no appointment** | PASS |
| A completed plan cannot be completed again; a revised plan can then be written | PASS (2) |
| Phase 12 regressions: receptionist, patient and doctor B still read no clinical record | PASS (3) |

**141 checks, 0 product failures.**

#### `phase_13.md` sections 89–94's checklist

| Attempt | Result | Where proved |
| --- | --- | --- |
| Unauthenticated → prescription | **DENIED** | Live (`anon` has no grant); route guards |
| Unauthorized doctor → prescription | **DENIED** | Live, both directions, `PV020` — indistinguishable from not-found |
| Receptionist → prescription | **DENIED** | Live. **No policy at all** |
| Admin → prescription | **DENIED** | Live. No policy at all |
| Authorized doctor → permitted prescription | **ALLOWED** | Live |
| Patient → own **issued** prescription | **ALLOWED** | Live |
| **Patient → own DRAFT prescription** | **DENIED** | Live — `status <> 'draft'` in the policy |
| Patient → another patient's prescription | **DENIED** | Live |
| Changed `prescriptionId` (IDOR) | **DENIED**, and indistinguishable from not-found | Live |
| Changed `patientId` | **No effect** — not a parameter of any write | Live, action tests, validation tests |
| Changed `practitionerId` / `doctorId` | **No effect** — no parameter, no schema field, no form field | Structural test, validation tests |
| Changed `appointmentId` | **No effect** — derived from the consultation | Structural test, live |
| Changed `clinicalRecordId` | Validated as a uuid, then resolved by the caller's own practitioner (`PV025`) | Live |
| Changed `status` | **No parameter anywhere.** Each transition is its own function | Structural test, live |
| Client role spoofing | Rejected by `strict()`, never read from the form; the database re-checks | Validation tests, live |
| Double-click Issue | **PREVENTED** — a conflict, never a second prescription | Live |
| Concurrent Issue | **SAFE** — exactly one succeeds | Live |
| Network retry | **SAFE** — idempotent create; repeat issue is a conflict | Live |
| Historical prescription | **UNCHANGED** after a replacement is written | Live |

#### Automated — 2,784 tests, up from 2,405

| File | Count | Covers |
| --- | --- | --- |
| `src/features/prescriptions/status.test.ts` | 20 | The lifecycle, editability, withdrawability, patient visibility and the item cap — all five parsed out of the migration and compared, cell by cell |
| `src/features/prescriptions/validation.test.ts` | 65 | Sixteen hostile fields one at a time on two schemas, a hostile key inside an item, the eleven limits read from the SQL, and clinical shorthand **accepted** rather than mangled |
| `src/features/prescriptions/errors.test.ts` | 10 | Every raised SQLSTATE recognised and none declared that is not raised; disjoint ranges; conflicts distinguished; nothing internal crossing the boundary |
| `src/features/prescriptions/format.test.ts` | 13 | Absent facts omitted, never placeholdered; one fixed order |
| `src/features/treatment-plans/status.test.ts` | 22 | The same mirror, plus no `medication` category and **no appointment written anywhere** |
| `src/features/treatment-plans/validation.test.ts` | 33 | Fifteen hostile fields; an invalid category; an unreal date; no status on a transition |
| `src/features/treatment-plans/errors.test.ts` | 11 | As above |
| `tests/integration/prescription-actions.test.ts` | 51 | Four roles writing nothing; exact RPC argument lists; eleven planted fields changing nothing; issuing carrying no content; conflicts with no version handed back; and **no clinical content in any log line** |
| `tests/integration/prescription-security.test.ts` | 55 | The database's guarantees, asserted against the migration text, plus the application layer's |
| `tests/components/prescriptions.test.tsx` | 40 | One form, no HTML `required`, issue refused while dirty, the review rendering the *saved* prescription, the autocomplete debouncing, nothing in storage or the URL, and axe |
| `tests/components/treatment-plans.test.tsx` | 27 | The same, plus grouped sections with empty ones omitted |
| `src/lib/logging/redact.test.ts` | +3 | The new clinical fragments, and that `prescriptionId` still logs while `emailId` still does not |

---

### 10. Concurrency / duplicate-protection results

```text
Duplicate prevention:      partial unique index + on conflict do nothing.
                           Verified live: two concurrent creates -> one row.
Concurrent issue:          the update matches only a draft row at the expected
                           revision. Verified live: two simultaneous issues,
                           exactly one succeeded, still one prescription.
Historical preservation:   verified live — withdraw, replace, original
                           untouched; and the service role refused an edit.
Appointment consistency:   composite foreign key. Verified live (23503) for a
                           wrong patient, practitioner and appointment.
Clinical-record consistency: the same composite key; the quadruple must exist
                           as a row in clinical_records.
```

---

### 11. Verification

Executed on 2026-09-19:

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 2,784 tests, 85 files** (was 2,405 / 74) |
| Production build | `npx next build` | **PASS** — all 30 public pages still static; the 8 new routes dynamic |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 174 files, 0 findings |
| Migration | `supabase db push` | **PASS** — applied to the linked project |
| Generated types | `supabase gen types typescript --linked`, compared | **PASS** — the live schema matches `src/types/database.ts` column for column |
| **Live database** | 141 checks, real per-role JWTs | **PASS — 141/141** |
| **Live browser** | — | **NOT RUN** — see section 14 |
| E2E | — | **NOT RUN** — no E2E tool is installed (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

---

### 12. Defects and false failures

#### Real defects, found by verification

**1. `setState` called synchronously inside an effect.** *(found by ESLint)*
The autocomplete cleared its suggestion state in the effect body when the
field emptied, which causes a cascading render on every keystroke that empties
the field and is what `react-hooks/set-state-in-effect` exists to catch.
Restructured so every state update happens in an event handler or a timer
callback: clearing moved into the change handler, and the loading flag moved
inside the debounce timer.

**2. Three stale notices that outlived what they stood in for.** The
consultation page, the doctor workspace, the patient summary, the account page
and the patient overview all still said prescriptions were being built. That
is the defect Phase 12's browser pass found three times over, and the
consequence is specific: a practitioner reading "prescriptions are not
available yet" writes them somewhere else, with the page that holds them one
click away. All five now name only what genuinely does not exist, and a
regression test asserts the doctor's summary no longer claims otherwise.

#### Five existing tests that failed, correctly

Every one was an assertion of a Phase 12 boundary this phase legitimately
crosses — the permission list's "no prescription permission exists", the
doctor's five capabilities, the "no prescription or treatment permission"
pattern, the scope notice, and the patient nav's three links. Each was updated
to describe the new boundary rather than relaxed, and two new assertions were
added in the process: that no clinical permission reaches a receptionist or an
administrator, and that a patient holds exactly two clinical *read*
permissions and no write.

#### Three harness bugs, recorded because a report listing only what passed is not evidence

* **The composite-foreign-key check got `23505` instead of `23503`.** It
  inserted against a consultation that already had a live prescription, so the
  **partial unique index** fired first — a correct refusal, but not the one
  under test. Re-asked against a fresh consultation: `23503` for a wrong
  patient, a wrong practitioner and a wrong appointment.
* **"A follow-up date books no appointment" asserted an absolute count.** The
  patient already had appointments from earlier phases' fixtures. The right
  question is whether the count *changed*; re-asked that way, it did not.
* **Two component-test selectors collided with the combobox's own live
  region.** The builder has two `role="status"` elements — the save state and
  the autocomplete's result count — and an unscoped query was asking "which
  status?". Scoped by accessible name.

#### And one thing that is not a defect

The Phase 13 fixture rows on the development project **cannot be removed**.
The issued and withdrawn prescriptions are protected by the items guard, which
refuses even a cascade — so `delete from prescriptions` fails. That is the
historical-integrity guarantee working exactly as designed, demonstrated on
the way out. The two extra accounts, the second practitioner and the second
patient record were removed.

---

### 13. Deferred

Intentionally not built:

* **The formal amendment workflow** (section 42). The enum value, the
  transition edge and the trigger that forbids editing instead of amending all
  exist; the surface does not. Until it arrives, correction is
  withdraw-then-replace, which preserves the original and is what the
  workflow will formalise.
* **A medicine catalog** (sections 9, 50). The clinic has supplied no verified
  one, and section 9 forbids inventing one. The item snapshot means a catalog
  can be added later without touching a single existing row.
* **Printing and PDF generation** (sections 41, 62, 77). The data model is
  shaped for it — one component already renders a prescription for three
  different readers — but the document subsystem is Phase 14's.
* **Notifications** (section 61). Nothing tells a patient a prescription was
  issued. Phase 15. The `issued_at` column and the `prescription.issued` log
  event are the clean event boundary section 61 asks for.
* **AI clinical decision support** (section 63). No model, no key, no call, no
  suggestion column, no confidence score. Phase 17. Asserted structurally.
* **Administrative clinical access** (section 37). The matrix marks it "Read,
  audited"; the audit subsystem does not exist.
* **A drug-interaction engine, a dosing rule, pharmacy integration,
  e-prescription regulatory integration** (section 103). None is implemented,
  and section 49 is explicit that the application must not try to become
  medically authoritative through arbitrary validation.
* **Deleting a prescription or a plan** (sections 99, 100). No function, no
  grant, no policy, no control.
* **A patient-facing clinical record.** Still not derived from
  `clinical_records`, which still has no patient policy. A prescription is a
  deliberately authorized projection with its own table; the notes are not.
* **Moving `ProfileSection`/`ProfileFieldList`/`ProfileField` to
  `components/shared/`.** Seven areas now depend on them, which more than
  earns the move; it belongs on its own change rather than inside this one.

---

### 14. Known issues

1. **No browser pass was run for this phase.** Phases 03–09, 11 and 12 each
   drove the production build through Chrome over the DevTools Protocol to
   measure computed contrast, horizontal overflow, focus order and keyboard
   operation, and several found defects nothing else could see — a 3.89:1
   contrast failure, 35px of overflow at 320px, two landmarks sharing one
   accessible name. That was not done here. The component suite's axe sweeps
   run in jsdom, which has no layout engine and therefore no computed
   colours, so **contrast, overflow at 320px and real focus behaviour on the
   eight new routes are unverified**. This is the same gap Phase 10 recorded,
   and it should be closed before the workspace is used. The builder is the
   densest form in the application — eleven fields per item card — which is
   exactly the layout most likely to overflow a narrow screen.
2. **The Phase 13 fixture rows cannot be removed from the development
   project.** See section 12. They are synthetic ("Ashwagandha churna",
   "Triphala") and attached to the seeded test patient.
3. **The browser's back button is not intercepted** by the unsaved-changes
   guard, inherited unchanged from Phase 12. Refresh, tab close and every
   in-app link are covered; blocking the back button needs a decoy history
   entry, which breaks the back button in its own right.
4. **`src/types/database.ts` is still hand-written**, deliberately.
   `npm run db:types` would overwrite it with generated output whose `Insert`
   and `Update` shapes are *permissive* — and the hand-written file types them
   `never`, which makes a client table write a compile error. The generated
   output was produced and compared column for column against the live schema;
   the only differences are that deliberate strictness and the omitted actor
   columns, neither of which the generator can know about.
5. **The dose is two text columns rather than a number and a unit.** Reasoned
   in section 2 and recorded here because it is the kind of decision somebody
   will want to revisit. If the clinic ever adopts a dosing convention, the
   columns can be tightened.
6. **The required field at issue is "at least one item", and nothing else.**
   Section 17 says not to make every field mandatory and section 49 forbids
   inventing clinical rules; the clinic has specified none. If it specifies
   some, they belong in `prescriptionIssueBlocker` and in a check constraint,
   in the same change.
7. **The phrasing lists are development content.** The forms, dose units,
   frequencies, timings and durations offered in the datalists are
   conventional rather than clinic-confirmed. They are suggestions on free-text
   fields, never required and never preselected, but a practitioner should
   confirm the vocabulary.
8. **The clinic has no verified practitioner**, and the development project's
   seeded one is named "Test Doctor". Unchanged since Phase 09.
9. **No audit of prescription *access*.** Every write is logged against an
   opaque actor id; a doctor or patient *reading* a prescription is not
   recorded. Phase 19.
10. **The four Phase 08 test accounts remain on the development project.**
    Shared, well-known credentials, including an administrator. **Delete them
    before this database takes real patient data** — and that now matters more
    again, because the database holds prescriptions.
11. **No E2E tool, no screen-reader pass, no Lighthouse run.** Unchanged since
    Phase 01/02.
12. **Still no CSP.** Unchanged since Phase 02.
13. **Legal pages still do not exist.** Required before the clinic handles
    real records through this website.

---

### 15. Acceptance criteria

#### Prescription

| Criterion | Result |
| --- | --- |
| Prescription model exists | PASS — `public.prescriptions`, applied and verified live |
| Prescription items are structured | PASS — eleven fields, section 52's list exactly |
| Linked to patient | PASS — FK plus the composite FK; derived, never a parameter |
| Linked to practitioner | PASS — the same |
| Linked to appointment / clinical record | PASS — both, and all four bound by one composite key |
| Draft state exists | PASS |
| Issued state exists | PASS |
| Invalid state transitions are rejected | PASS — the guard trigger; live (`PV021`, `PV024`) |
| Issued prescriptions cannot be silently overwritten | PASS — verified live **against the service role** |

#### Prescription builder

| Criterion | Result |
| --- | --- |
| Doctor can add items | PASS |
| Doctor can edit draft items | PASS |
| Doctor can remove draft items | PASS — and the builder never ends up with nothing to type into |
| Dosage can be represented clearly | PASS — amount and unit, rendered as "1 teaspoon" |
| Frequency can be represented clearly | PASS — free text with phrasing suggestions |
| Timing can be represented clearly | PASS |
| Duration can be represented clearly | PASS — including "Until follow-up" |
| Instructions can be recorded | PASS — per item and for the whole prescription |
| Multiple items are supported | PASS — up to 50, bounded in both places |
| Review step exists before issue | PASS — and it renders the **saved** prescription, with issuing refused while anything is unsaved |

#### Treatment plan

| Criterion | Result |
| --- | --- |
| Treatment plan model exists | PASS |
| Associated with clinical context | PASS — the same composite key |
| Appropriate structured categories exist | PASS — five, with no `medication` |
| Draft/active/completed lifecycle works | PASS — plus `cancelled`; verified live |
| Historical plan information is preserved | PASS — frozen on activation, verified live against the service role |

#### Security

| Criterion | Result |
| --- | --- |
| Doctor authorization is enforced | PASS — permission, then the database's role check, then RLS |
| Patient/practitioner/appointment relationships are validated | PASS — a composite foreign key; live `23503` three ways |
| RLS is implemented and tested | PASS — 141 live checks |
| Cross-patient access is denied | PASS — live |
| Unauthorized doctor access is denied | PASS — live, both directions |
| Receptionist access is denied | PASS — **no policy at all**; live |
| Client cannot spoof practitioner/patient IDs | PASS — there is no such parameter to spoof, anywhere |
| Client cannot directly issue prescriptions | PASS — no write grant, no write policy; live for all four roles |
| Draft prescriptions are not exposed to patients | PASS — `status <> 'draft'` in the policy; **live** |
| Clinical data is not leaked through logs/errors/analytics | PASS — asserted structurally and behaviourally; no analytics exists |

#### Integrity

| Criterion | Result |
| --- | --- |
| Duplicate prescription creation is prevented | PASS — one row from two parallel calls |
| Duplicate issue requests are safe | PASS — **two simultaneous issues, exactly one succeeded** |
| Historical prescriptions remain stable | PASS — live |
| Prescription/clinical-record relationships remain consistent | PASS — composite FK |
| Prescription/appointment relationships remain consistent | PASS — the same |
| Concurrent edits are handled safely | PASS — optimistic `version`; live |

#### UX

| Criterion | Result |
| --- | --- |
| Builder is integrated into the consultation workflow | PASS — reached from the consultation page, with the patient, appointment and doctor derived |
| Treatment-plan builder is usable | PASS |
| Review before issue exists | PASS |
| Save state is clear | PASS — five states, never claiming a save that did not happen |
| Loading/error/empty states exist | PASS — loading skeletons, four workspace states, a failed read distinguished from an empty one |
| Responsive design works | PASS by construction — cards below `md`, tables above, no fixed pixel widths. **Not pixel-verified**; see section 14 |
| Accessibility requirements are satisfied | PASS in jsdom — axe clean, a real label on every control, a real combobox with arrow-key navigation, dialogs that ask first. **Contrast and focus order not measured in a browser** |

#### AI safety

| Criterion | Result |
| --- | --- |
| No autonomous prescription generation exists | PASS — every clinical value is typed by the doctor |
| No AI-generated prescription is automatically issued | PASS — `issue_prescription` is the only path to `issued` and it is gated on a practitioner |
| Doctor remains final decision-maker | PASS — the suggestions offer *names this doctor has written before* and are never applied without a deliberate pick |
| AI is not implemented in Phase 13 | PASS — no model, no key, no call; asserted structurally |

#### Engineering

| Criterion | Result |
| --- | --- |
| Phase 08 authorization is reused | PASS — no second mechanism |
| Phase 09 appointment model is reused | PASS — and no appointment is written |
| Phase 12 clinical-record model is reused | PASS — as the anchor, with its gate and its policy pattern |
| No duplicate clinical data model exists | PASS |
| TypeScript remains strict | PASS — no `any` added |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

```text
Open Consultation -> Review Clinical Record -> Create Prescription
   -> Add Treatment Items -> Save Draft -> Review -> Issue
   -> View Historical Prescription
```

```text
Create Treatment Plan -> Save -> Activate -> Track Historical Plan
```

Every step is implemented and verified against the live database. The
boundaries hold, each verified live:

```text
Receptionist         ✕ prescriptions, plans, items   — no policy at all
Patient              ✕ a DRAFT prescription          — status <> 'draft'
Unauthorized doctor  ✕ a colleague's prescription    — PV020
Admin                ✕ prescriptions and plans       — no policy at all
AI                   ✕ autonomous prescribing        — no model, no call
```

---

### 16. Phase status

```text
Phase 13: COMPLETE
Ready for Phase 14: YES
```

Phase 14 has not been started.

Patient documents can be built directly on what exists. The pattern is
settled: a table of its own, a `security definer` write path with no identity
parameter, a relationship-scoped select policy per audience, an error mapper
with its own SQLSTATE range, and a structural test that reads the migration.
The permission arrives in `config/permissions.ts` in the same change as the
surface that uses it, which is the rule every phase since 08 has followed.

Two caveats to carry forward:

* **Phase 14 owns storage, and a storage object is not a database row.** Every
  guarantee in this phase rests on triggers and policies that a private bucket
  does not have. A generated prescription document must be an *export* of the
  authoritative row, never a second source of truth — and it must not become
  a way to read a prescription that the row's own policy would refuse.
* **The browser pass this phase skipped should be run before Phase 14 adds
  more surface to it.** The gap compounds.
