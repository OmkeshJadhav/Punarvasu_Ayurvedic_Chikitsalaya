# Punarvasu — Data Architecture

> Status: **Planning document (Phase 00).**
> No schema has been implemented yet. The repository contains no migrations,
> no Supabase configuration and no database code. This document defines the
> intended data model so that Phase 02 and later phases implement it
> consistently rather than inventing it per feature.
>
> Companion documents: `ARCHITECTURE.md` (system design), `SECURITY.md`
> (roles, RLS, secrets), `HEALTHCARE_AND_AI_SAFETY.md` (clinical constraints).

---

## 1. Database Direction

| Decision | Value | Rationale |
| --- | --- | --- |
| Engine | PostgreSQL (via Supabase) | Relational integrity, constraints, transactions and Row Level Security in one system. |
| Access | Supabase client, server-side | Keeps authorization enforceable at the database layer rather than only in application code. |
| Identity | Supabase Auth (`auth.users`) | Avoids hand-rolling credential storage. |
| Schema changes | SQL migration files, committed to the repository | Reproducible across environments; no manual production edits. |
| Authorization | Row Level Security on every table holding user or clinical data | Defence in depth: a bug in an API route must not become a data breach. |

Nothing in this table has been implemented yet. Phase 01 establishes the
Supabase client boundary; Phase 02 introduces the first migrations.

---

## 2. Modelling Principles

1. **Normalize first.** Denormalize only with a written performance reason.
2. **Clinical data is append-only in spirit.** History is never silently
   overwritten (§7, §8).
3. **Every row has an owner.** Ownership is explicit and expressible in an RLS
   policy (§5).
4. **Constrain in the database, not only in TypeScript.** Foreign keys, unique
   constraints, check constraints and exclusion constraints are the last line
   of defence and the only one that survives a buggy caller.
5. **Deny by default.** A table with RLS enabled and no policy returns nothing.
   That is the correct starting state; policies are added deliberately.
6. **Enumerations are database enums or check-constrained text**, never free
   strings validated in application code alone.
7. **Timestamps are `timestamptz`.** The clinic operates in a single timezone
   today, but appointment logic must not assume that forever.
8. **Soft-delete operational records; never hard-delete clinical records.**

---

## 3. Entity Overview

```text
auth.users  (Supabase-managed identity)
    |
    +-- user_roles                   the authoritative role assignment
    +-- role_assignment_events       insert-only audit of every role change
    +-- profiles                     one row per user: display and contact
            |
            +-- patients             patient demographic record
            |       |
            |       +-- appointments
            |       +-- clinical_records        (Phase 12)
            |       |       +-- treatment_plans
            |       |       +-- prescriptions -- prescription_items
            |       +-- documents
            |       +-- notifications
            |
            +-- practitioners        doctor / therapist record
                    +-- availability
                    +-- practitioner_leave
                    +-- appointments

services            treatments and consultations offered by the clinic
clinic_hours        regular working hours
clinic_holidays     dates the clinic is closed
articles            public content
audit_logs          who did what to which sensitive record
clinic_settings     single-row operational configuration
```

---

## 4. Entity Reference

For each entity: purpose, key relationships, owner, sensitive fields, and the
access pattern that should drive its indexes.

### 4.1 `profiles`

> **Implemented in Phase 06**, and **amended in Phase 08**: the `role` column
> was moved to `user_roles` and dropped from this table. `profiles` now holds
> display and contact information only.

* **Purpose** — One row per authenticated user. Display and contact fields.
* **Relationships** — `id` is both primary key and foreign key to
  `auth.users.id`.
* **Owner** — The user, for read and limited self-update (`full_name`,
  `phone`, by column-level grant).
* **Sensitive** — `full_name`, `phone`.
* **Access pattern** — The primary key index is sufficient.

### 4.1a `user_roles`

> **Implemented in Phase 08** —
> `supabase/migrations/20260919120000_roles_and_permissions.sql`, applied to
> the live project and verified against it with real per-role JWTs.

* **Purpose** — The authoritative role assignment. The basis of all
  authorization.
* **Relationships** — `user_id` references `auth.users.id` (`on delete
  cascade`); `assigned_by` references `auth.users.id` (`on delete set null`).
* **Constraints** — `unique (user_id, role)`, plus a unique index on `user_id`
  alone that holds the one-role-per-user rule of `SECURITY.md` §6. Dropping
  that single index is the entire change needed to permit multiple roles.
* **Owner** — Nobody, for writes. `authenticated` holds `select` and nothing
  else; there is no insert, update or delete grant and no such policy.
* **Access pattern** — Read on essentially every authenticated request, by
  primary-key-adjacent lookup on `user_id`. The unique index serves it.
* **Critical rule** — A role must **not** be self-assignable. Enforced by the
  absence of any writable path, and by `public.assign_user_role()`, which
  authorizes the caller as an admin, refuses a self-targeted change including
  by an admin, validates the target and writes an audit row. Role changes are
  audited (§10).

### 4.1b `role_assignment_events`

> **Implemented in Phase 08.**

* **Purpose** — Insert-only record of every role change: actor, target,
  previous role, new role, timestamp.
* **Relationships** — `actor_id` references `auth.users.id` (`on delete set
  null`). `target_user_id` is deliberately **not** a foreign key: the history
  of a role change has to outlive the account it was made against, and a
  cascade would delete the evidence with the user.
* **Owner** — Admins, for read. Written only by `assign_user_role()` running as
  definer; no client holds insert, update or delete.
* **Sensitive** — Identifiers only. No patient information.

### 4.2 `patients`

> **Implemented in Phase 07** —
> `supabase/migrations/20260918120000_patient_profile.sql`, applied to the live
> project and verified against it. Columns, constraints, indexes, triggers,
> policies and grants are recorded in
> `docs/progress/progress_phase_07.md`. **Amended in Phase 08**: the three
> self-service policies additionally require the patient role, so a staff
> member cannot create a patient record for themselves. Ownership is unchanged
> — each policy still requires `profile_id = auth.uid()` in `using` and in
> `with check`. Receptionist and practitioner access to patient records remains
> deliberately absent: it depends on the appointment model and the treatment
> relationship, neither of which exists yet.

* **Purpose** — Demographic and administrative patient record.
* **Relationships** — `profile_id` references `profiles.id`. A patient may
  exist before a login does (a walk-in registered by a receptionist), so the
  link is nullable and claimed later.
* **Owner** — The patient; clinic staff hold scoped operational access.
* **Sensitive** — Name, date of birth, gender, phone, email, address,
  emergency contact. All of it.
* **Access pattern** — Staff search by name or phone; patient self-lookup by
  `profile_id`. Index `profile_id`, plus a normalized or trigram index
  supporting staff search.

### 4.3 `practitioners`

* **Purpose** — Professional record for doctors and therapists.
* **Relationships** — `profile_id` references `profiles.id`.
* **Owner** — Admin manages; the practitioner may update a limited subset.
* **Sensitive** — Mostly public-facing (name, specialization, biography).
  Registration and licence numbers are internal.
* **Access pattern** — Public read of active, published practitioners for the
  website; staff read for scheduling.
* **Safety rule** — Credentials, qualifications and registration numbers come
  from real clinic records. They are never generated, guessed or filled with
  plausible-looking sample values. See `HEALTHCARE_AND_AI_SAFETY.md` §2.

### 4.4 `services`

* **Purpose** — Consultations and treatments the clinic offers, including
  default duration and buffer, which the appointment engine depends on.
* **Owner** — Admin.
* **Sensitive** — None. Public content.
* **Access pattern** — Public read of active services; admin write.

### 4.5 `appointments`

**Implemented in Phase 09** —
`supabase/migrations/20260920120000_appointment_engine.sql`.

* **Purpose** — A booked slot linking a patient, a practitioner and an
  appointment type.
* **Relationships** — `patient_id`, `practitioner_id`, `appointment_type_id`.
  The service catalogue is unreviewed public content; the *scheduling* concept
  is `appointment_types`, which carries the trusted duration and buffer.
* **Owner** — Jointly the patient and the practitioner; receptionists will hold
  operational rights from Phase 10.
* **Sensitive** — The existence of an appointment is itself health
  information. `internal_note` is staff-only and is **not in the column-level
  select grant**, so no client can read it through any query.
* **Access pattern** — "Today's schedule for practitioner X" and "my upcoming
  appointments". Indexed `(practitioner_id, starts_at)` and
  `(patient_id, starts_at desc)`.
* **Integrity** — See §11. Overlap prevention is in the database: two
  exclusion constraints over `btree_gist`, one per practitioner and one per
  patient, both excluding only `cancelled`.
* **Write path** — No client role holds insert, update or delete. Every write
  goes through `book_appointment`, `cancel_appointment` or
  `reschedule_appointment`, each `security definer`, each deriving the patient
  from `auth.uid()`, the duration from the appointment type and the status
  from the transition rules.
* **History** — `appointment_events` is an insert-only record of created,
  status-changed and rescheduled, written only by those functions.

### 4.6 `practitioner_availability`, `schedule_exceptions`

**Implemented in Phase 09**, and as two tables rather than four. A recurring
working week is one concept (`practitioner_availability`); leave, a clinic
holiday, a closure and a manually blocked slot are all the same concept to the
availability engine — an interval nobody may be booked into — so they are one
table (`schedule_exceptions`) with a nullable `practitioner_id`, where null
means clinic-wide.

`schedule_exceptions.reason` may be personal, so the table has **no select
policy for any client role**. Availability reads it through
`get_practitioner_busy_intervals()`, which returns interval boundaries and
nothing else.

* **Purpose** — The inputs that, combined with existing appointments,
  determine whether a slot is bookable.
* **Owner** — Admin; practitioners may request leave.
* **Sensitive** — A leave reason may be personal; keep it optional and
  staff-visible only.
* **Access pattern** — Read-heavy, queried as a date range during slot
  generation. Index by practitioner and date range.

### 4.7 `clinical_records` — **implemented (Phase 12)**

* **Purpose** — What happened during one consultation. The spine of patient
  history.
* **Relationships** — `appointment_id`, `patient_id`, `practitioner_id`, all
  `not null`, plus a **composite foreign key** on the three of them into
  `appointments (id, patient_id, practitioner_id)`. That is what makes the
  invalid state impossible rather than merely prevented: a record cannot name
  patient B against an appointment between patient A and practitioner A.
* **Owner** — The authoring practitioner. Readable by them and by nobody else
  (`clinical_records_select_author`). No receptionist, patient or
  administrator has any policy on this table.
* **Sensitive** — Entirely.
* **Access pattern** — "All records for patient X that I wrote, newest first."
  Index `(patient_id, created_at desc)`. Also `(practitioner_id, created_at
  desc)`, and a partial index on drafts.
* **Lifecycle** — `draft` then `completed`, with `amended` declared and
  unreachable. A completed record is **immutable**: the guard trigger refuses
  an update that changes any clinical field on a non-draft row, so corrections
  are an amendment rather than an edit (§7).
* **Concurrency** — An optimistic `version` column, incremented by trigger and
  applied in the `where` clause of every update, so a stale write is refused
  rather than overwriting newer documentation.
* **Deletion** — None. No function, no grant, no policy. Every foreign key is
  `on delete restrict`, so deleting a patient, practitioner or appointment
  that has a clinical record fails loudly.

#### Three deliberate divergences from the model this document planned

This section previously described `clinical_visits` plus `clinical_notes` and
`assessments` as separate tables, with an optional `appointment_id` and a
`finalized` status. `phase_12.md` §91 specified a single flat record and the
phase specification outranks this document on its own subject
(`PRODUCT_SPEC.md` §39), so what shipped is:

1. **One table, not three.** The eight clinical fields are columns rather than
   child rows. No current query fetches a section without its record, so three
   tables would be two joins and two more policies for no behaviour —
   `AGENTS.md` §36. A future structured Ayurvedic assessment with its own
   cardinality is still free to become its own table referencing this one.
2. **`appointment_id` is required.** §§6–7 make a consultation originate from
   an appointment, and the composite foreign key above — the only declarative
   way to enforce §93's consistency rule — needs it. The walk-in case is not
   lost: Phase 10's front desk books an appointment for a walk-in, so a patient
   with no appointment is not a state the product can reach.
3. **`completed`, not `finalized`.** `phase_12.md` §14's vocabulary, so one
   word is used in the schema, the application and the UI.

### 4.8 `clinical_notes`, `assessments` — **not built**

Folded into `clinical_records` above. Ayurvedic assessment information is
recorded in the narrative fields: `phase_12.md` §11 permits prakriti, vikriti
and agni as *potential* structured fields and then says explicitly not to
implement every Ayurvedic concept as a column without confirmed doctor
requirements. The clinic has confirmed none.

### 4.9 `treatment_plans`

* **Purpose** — The plan of care arising from a visit.
* **Owner** — Authoring practitioner; the patient may read the patient-facing
  portion.
* **Sensitive** — Entirely.
* **Note** — Distinguish practitioner-internal reasoning from the
  patient-facing explanation. Not every clinical note is appropriate to show a
  patient unmediated.

### 4.10 `prescriptions`, `prescription_items` — **implemented (Phase 13)**

* **Purpose** — A prescription issued at a visit, and its line items
  (medicine, dosage, timing, duration, vehicle/anupana, instructions).
* **Owner** — Issuing practitioner.
* **Sensitive** — Entirely.
* **Access pattern** — Patient views their own history; practitioner views a
  patient's prescription timeline.
* **Integrity** — Issued prescriptions are immutable. See §8.

### 4.11 `documents`

* **Purpose** — Metadata for uploaded files (lab reports, scans, referrals).
  The **file itself lives in private storage, never in the database.**
* **Relationships** — `patient_id`, optional `visit_id`, `uploaded_by`.
* **Sensitive** — Entirely, including the filename, which frequently reveals
  the diagnosis.
* **Access pattern** — Listed per patient and per visit.
* **Integrity** — Stores the storage object path, MIME type, byte size and a
  checksum. Access is described in §9.

### 4.12 `notifications` — **implemented (Phase 15)**

Four tables, not one:

```text
notification_outbox        one row per domain event, written by an `after`
                           trigger INSIDE the domain transaction
notifications              one thing a patient should know
notification_deliveries    one EXTERNAL delivery attempt
notification_preferences   one row per (user, category, channel)
```

* **Purpose** — Communication. Never a source of truth: the migration
  performs no insert, update or delete against any domain table, adds no
  column to one, and replaces no function from an earlier phase.
* **Owner** — The recipient account, resolved **inside the database** from
  the resource the notification is about. There is no recipient parameter on
  any function, in any schema, or on any form.
* **Sensitive** — Notification bodies must be minimal, and here that is
  structural rather than a rule to remember: there is **no column** for a
  diagnosis, a symptom, an assessment, a medicine, a dose, an item, a plan
  title, a document title, a doctor's note, a cancellation reason or a patient
  note, and the context functions that feed the templates return none of them
  either. A clinical email carries the neutral subject "New update from
  Punarvasu", because the *existence* of a prescription is itself information
  about somebody's health.
* **No contact details are stored.** A recipient's address is read from
  `auth.users` for one send and never copied into this schema — no table here
  has an email, phone or address column.
* **Access** — One select policy per readable table, scoped to `auth.uid()`.
  The notifications policy also carries `status = 'active'`, which is what
  makes a **scheduled reminder invisible to the patient it is for** until its
  time comes. `notification_outbox` and `notification_deliveries` have row-level
  security enabled and **no policy at all**, and are revoked from `anon`,
  `authenticated` and `service_role` alike: the processor reaches them only
  through definer functions.
* **Idempotency** — A unique `dedupe_key` on the outbox and on the
  notification, and a unique `(notification_id, channel)` on the delivery. A
  repeated trigger, a worker retry, a browser refresh and a process restart all
  resolve to one logical notification.
* **Reminders** — Planned from the authoritative appointment and re-checked
  against it when they fall due, so a cancelled, moved, completed or
  not-attended appointment cannot produce one. Section 11's status model is
  what decides; nothing here duplicates it.
* **Retention** — None is defined, therefore nothing is deleted
  automatically. A notification cascades away with the account it belongs to,
  which is deliberate: it is a message, not a clinical record.

### 4.13 `articles`

* **Purpose** — Public educational content.
* **Owner** — Admin or content manager.
* **Sensitive** — None, but subject to the content rules in
  `HEALTHCARE_AND_AI_SAFETY.md` §2.

### 4.14 `audit_logs`

* **Purpose** — Append-only record of sensitive access and mutation.
* **Sensitive** — Contains references to sensitive records. Readable by admins
  only.
* **Integrity** — Insert-only. No `UPDATE` or `DELETE` policy exists for any
  role. See §10.

### 4.15 `clinic_settings`

* **Purpose** — Operational configuration (booking window, cancellation
  cutoff, default buffers). Configuration, not secrets — secrets stay in
  environment variables.
* **Owner** — Admin.

---

## 5. Data Ownership Rules

| Data | Owned by | Created by | Editable by | Visible to |
| --- | --- | --- | --- | --- |
| Profile | The user | Registration | The user, except `role` | The user, admin |
| Patient record | The patient | Patient or receptionist | Patient (own demographics), receptionist | Patient, receptionist, treating doctor, admin |
| Appointment | Patient and practitioner | Patient or receptionist | Patient (cancel/reschedule within policy), receptionist, practitioner | Patient (own), receptionist, practitioner (own), admin |
| Clinical visit | The patient's history | Attending practitioner | Author, while `draft` only | Patient (patient-facing parts), treating practitioner, admin (controlled) |
| Clinical notes, assessments | The patient's history | Attending practitioner | Author, while `draft` only | Treating practitioner; **not receptionists** |
| Prescription | The patient's history | Issuing practitioner | Nobody after issue | Patient (own), treating practitioner |
| Document | The patient | Patient or staff | Metadata only | Patient (own), treating practitioner, uploading staff |
| Audit log | The clinic | The system | Nobody | Admin |

Three rules follow from this table and apply everywhere:

1. **A receptionist is an operational role, not a clinical one.** Receptionists
   need enough to run the front desk — who is coming, when, contact details,
   check-in status. They do not need clinical notes, assessments or
   prescriptions, and must not be able to read them.

   **Implemented in Phase 10**, and structurally rather than by filtering:
   `public.patients` has no clinical column and section 4.2 forbids adding one;
   `appointments.internal_note` has no column grant for *any* client role, so
   granting it to a receptionist would grant it to every patient;
   `schedule_exceptions` has row-level security and no policy at all. The
   receptionist's three select policies each name the role through
   `has_app_role()`, and no write policy or write grant was added anywhere —
   every front-desk write is a `security definer` function.
2. **A practitioner's clinical access is scoped by treatment relationship**,
   not by the bare fact of holding the doctor role. "Any doctor can read any
   patient" is not acceptable.
3. **Admin is an operational superuser, not an invisible one.** Administrative
   access to clinical records is possible where genuinely required, restricted,
   and always audited.

---

## 6. Row Level Security

### 6.1 Baseline

Every table holding user-specific, operational or clinical data has RLS
**enabled** with **no permissive default**. A table without a matching policy
returns zero rows. Public content tables (`services`, `articles`,
`practitioners`) receive an explicit, narrow public-read policy limited to
active and published rows.

### 6.2 Role resolution

Policies resolve the caller's role from the database — from `user_roles`, keyed
on `auth.uid()` — never from a client-supplied value, a request header, or a
token claim the client can influence. A helper function marked
`security definer` and `stable` keeps policies readable and avoids recursive
policy evaluation on `user_roles` itself.

**Implemented (Phase 08):** `public.current_app_role()` returns the caller's
role, and `public.has_app_role(role)` is the predicate policies use. Neither
takes a user id, so neither can be asked about another user and neither can be
turned into a privilege-bypass primitive by being handed a different argument.

### 6.3 Policy shape

Policies are written per operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`),
never as a single blanket `FOR ALL`. Writing them separately forces the
question "who may delete this?" to be answered deliberately — and for clinical
records the answer is usually "nobody".

### 6.4 The service-role key

The service-role key bypasses RLS entirely. It is used only where an operation
genuinely cannot be expressed as an authenticated user's action — scheduled
jobs, webhook handlers, administrative migrations. Every such use is:

* confined to server-only code that no client component imports,
* preceded by its own explicit authorization check,
* audited.

Reaching for the service-role key to work around an RLS policy that is
"getting in the way" is a defect, not a solution.

### 6.5 RLS is not a substitute for server-side authorization

RLS is the second layer. API routes and server actions still authenticate the
request, verify the role and validate resource ownership before acting.
Relying on RLS alone produces confusing failures and leaves business rules
unenforced; relying on application checks alone means one missed check is a
breach.

---

## 7. Clinical Record Philosophy

Patient history is a sequence of events, not a mutable document.

```text
Patient
  +-- Visit 1  (finalized, immutable)
  +-- Visit 2  (finalized, immutable)
  +-- Visit 3  (draft, editable by author)
```

* A visit is editable while it is a `draft`, by its author.
* Finalizing is explicit and one-way.
* A finalized visit is corrected by recording an **amendment** that references
  the original, preserving both, with author and timestamp.
* The schema must never be shaped so that a later consultation overwrites an
  earlier one.

The reason is not merely technical tidiness: a clinical record that silently
loses its own history cannot be relied on for care, and cannot answer the
question "what did the practitioner actually know at the time?"

---

## 8. Prescription Philosophy

**Implemented in Phase 13**, and every clause below now holds in the schema
rather than in intention. `supabase/migrations/20260924120000_prescriptions_and_treatment_plans.sql`
is where each one lives:

* immutability is `prescriptions_guard_update()` and
  `prescription_items_guard_write()`, which refuse a content change on a
  non-draft row and any item write beneath one — **verified live against the
  service-role client, which bypasses row-level security and is still
  refused**;
* "a change produces a new prescription" is `cancel_prescription` plus the
  partial unique index `prescriptions_one_live_per_record`, which frees the
  consultation for a replacement while the withdrawn row stays for ever;
* "not deleted" is literal: no delete function, no delete grant, no delete
  policy, `on delete restrict` on every reference, and an items guard that
  refuses even a cascade;
* "historically understandable" is the item snapshot — the medicine or remedy
  name as the doctor wrote it, with its form, strength, dose, frequency,
  timing, duration, quantity and instructions. **There is no medicine catalog
  and no `medicine_id`**, so no future catalog can rewrite an old
  prescription.

A prescription is a clinical artifact, not a form field.

* An issued prescription is **immutable**.
* A change produces a **new prescription** that supersedes the previous one
  through an explicit link.
* A withdrawn prescription is marked `cancelled` with a reason. It is not
  deleted.
* The patient's prescription history therefore reads as a complete, ordered
  record of what was issued, when, by whom, and what replaced it.

---

## 9. File Storage

Patient documents are never stored in a public bucket and never served from a
permanent public URL.

**Implemented in Phase 14**, and every line of the flow below is now a
mechanism rather than an intention.
`supabase/migrations/20260925120000_patient_documents.sql` and
`src/features/documents/` are where each one lives:

* the bucket `patient-documents` is created with `public = false`, and the
  insert carries `on conflict (id) do update set public = false` so a later
  migration cannot quietly make it public. **Verified live**: the bucket
  reports private, the public URL endpoint refuses, and an anonymous direct
  request for a known object is refused;
* "policy governed" is literal. `storage.objects` carries **one** policy for
  this bucket — a select for `authenticated`, predicated on
  `public.can_read_patient_document_object(name)`, which resolves the object
  key to its row and asks the same question the table asks. There is **no
  insert, update or delete policy for any client role**, so nothing a browser
  holds can put an object into the bucket or take one out of it;
* "generate a server-side object path" is
  `patients/{patientId}/documents/{documentId}/document.{ext}`, built by the
  server and then **recomputed inside the database** by
  `patient_document_storage_path()` and compared. A path the application
  would not have generated raises `PV041`, and the check constraint
  `patient_documents_storage_path_shape` refuses it a second time —
  **including against the service-role client**;
* "sniffed content type" is three checks that must all agree: the file's
  signature bytes, its extension and its declared type. The **detected** type
  is what is stored, and it is what decides the path's extension. The
  allowlist is closed and six types long, held in the configuration, in a
  check constraint and on the bucket, all three asserted to agree.
  `image/svg+xml` is excluded deliberately and permanently — an SVG is a
  document that can carry script;
* "re-verify authorization for THIS user and THIS document" is structural
  rather than remembered: a signed URL is minted for a path read off a row
  row-level security already admitted, using **the caller's own client**, so
  the storage policy decides a second time. The path is not an input.

One divergence from the plan below: the signed-URL lifetime is
`SIGNED_URL_TTL_SECONDS` in `src/config/documents.ts` (300 seconds) rather
than an environment variable. It is a safety bound, not a deployment knob, and
a bound an operator can raise per environment is one that will be raised.

```text
Client
  |  authenticated request
Server: verify identity, role and ownership
  |
Validate: size, extension, sniffed content type; reject executables;
          generate a server-side object path (never the client's filename)
  |
Private storage bucket  (no public access, policy governed)
  |  download requested
Server: re-verify authorization for THIS user and THIS document
  |
Short-lived signed URL  (minutes, not days)
```

Notes:

* The database row stores the object path; the bucket stores the bytes. The
  service layer keeps the two consistent.
* The uploaded filename is stored as a display label only; it never becomes a
  filesystem or object path.
* Signed URL lifetime is 300 seconds. A URL that lives for days is a public
  link with extra steps.
* **Nothing reads the contents of a document.** There is no OCR, no
  extraction, no classification, and no column holding anything derived from
  a file. Phase 17 owns clinical decision support.
* There is **no malware scanning** in this deployment, and the upload form
  says so rather than implying a guarantee the product does not have. What
  makes that acceptable is that nothing in Punarvasu executes, interprets or
  server-side renders an uploaded file — it is stored, and handed back to
  whoever is entitled to it.
* A document is **archived, never deleted**: `active` to `archived` is
  one-way, only the uploader may do it, the object is untouched, and the
  document stays downloadable. There is no delete function, no delete grant
  and no delete policy, and every reference is `on delete restrict`.

---

## 10. Auditability

Audit logging covers sensitive operations rather than everything. At minimum:

* Access to another user's clinical record.
* Creation, finalization and amendment of clinical records.
* Issuing and cancelling prescriptions.
* Document upload and download.
* Role changes and permission changes.
* Administrative access to patient data.

Each entry records actor, action, target record identity, timestamp and
request correlation ID. It records **references, not contents** — an audit log
must never become a second, less-protected copy of the clinical record.

`audit_logs` is insert-only for every role. No policy grants `UPDATE` or
`DELETE`.

---

## 11. Appointment Integrity

Appointment booking is the highest-risk consistency problem in the product,
because two patients can want the same slot at the same moment.

**Availability shown in the UI is never authoritative.** It is a hint computed
from a snapshot; by the time the user clicks, it may be stale.

Required booking sequence:

```text
UI shows candidate slots            (hint only)
  |
Server recomputes availability from:
    clinic_hours, clinic_holidays, practitioner availability,
    practitioner_leave, service duration, buffer time,
    existing appointments, booking window and cutoff rules
  |
Transactional insert protected by a database-level constraint
  |
Constraint violation -> slot was taken -> clear, recoverable error
```

The database-level guarantee is the part that actually prevents double
booking. A PostgreSQL exclusion constraint over practitioner and time range
(`btree_gist` on `practitioner_id` plus a `tstzrange`, excluding cancelled
appointments) expresses "this practitioner cannot have two overlapping active
appointments" as an invariant the database enforces regardless of how many
requests arrive simultaneously.

Application-level "check, then insert" is **not** sufficient. Two concurrent
requests both pass the check.

**Implemented in Phase 09 exactly as specified above.** The constraint is

```sql
exclude using gist (
  practitioner_id with =,
  tstzrange(starts_at, blocked_until, '[)') with &&
) where (status <> 'cancelled')
```

`blocked_until` is `ends_at` plus the appointment type's buffer as configured
at booking time, so buffer separation is an invariant rather than an
application check. A second constraint applies the same rule per patient. The
half-open range is what keeps back-to-back appointments legal.

Status transitions are constrained rather than free-form:

```text
requested -> confirmed -> checked_in -> in_consultation -> completed
     |           |             |
 cancelled   cancelled     no_show
```

Illegal transitions are rejected by the service layer and, where practical, by
a check constraint or trigger.

**Implemented in Phase 09** by `appointments_guard_transition()`, a `before
update` trigger, plus `no_show` from the phase specification.
`src/features/appointments/status.ts` holds the same matrix for the
application, and `status.test.ts` asserts the two agree by reading the
migration.

### Who may take which transition (Phase 10)

The matrix says which transitions are *legal*. It does not say who may take
one, and those are separate questions that have to compose rather than merge.

Phase 10 adds the second half for the front desk, in two parts, both in
`update_appointment_status_as_staff` and both mirrored in
`src/features/reception/status.ts`:

* **Which statuses a receptionist may set:** `confirmed`, `checked_in`,
  `no_show`, `cancelled`. Not `completed` and not `in_consultation` — those
  describe what happened in the consulting room.
* **Which statuses a receptionist may act *from*:** `requested`, `confirmed`,
  `checked_in`. Not `in_consultation`, because although
  `in_consultation -> cancelled` is legal *and* `cancelled` is a status the
  desk may set, the patient is in the room with the practitioner and it is not
  the desk's call.

The second rule exists because composing only the first two produced exactly
that wrong answer, and the mirror test caught the TypeScript and the SQL
disagreeing about it before it shipped.

The trigger still holds regardless. A staff function cannot talk its way past
it, and no client can update the table at all.

### One validator, two callers (Phase 10)

`assert_bookable_slot` gained `p_require_online_booking` and
`p_min_notice_minutes`. Both were fixed rules inside it, and both are rules
about *self-service booking* rather than about whether a time is schedulable:
a practitioner who does not accept online booking is bookable at the desk, and
the front desk books people in for today.

Parameterising beat writing a second validator for staff, which would have been
duplicated scheduling logic and would have drifted the first time a rule
changed. The calling **function** passes them; no request reaches them. Every
rule that is a property of the diary — working hours, the grid, the horizon,
blocked periods, not-in-the-past — still binds both callers.

---

## 11a. Reporting (implemented, Phase 16)

Analytics reads this schema and adds nothing to it. Phase 16's migration
creates **no table, no column, no enum, no trigger and no policy** — only
functions and indexes — so there is no reporting copy of a domain row that can
fall out of step with the row itself.

**Why the read interface is `security definer` functions rather than views.**
A view is evaluated with the *caller's* row-level security, and the readers of
clinic analytics are a receptionist and an administrator — neither of whom has
any policy on `prescriptions`, `clinical_records` or
`notification_deliveries`. A view over those tables would not be refused; it
would return **zero rows**, and the dashboard would report that the clinic
issued no prescriptions this month. A wrong number that looks right is the
worst failure an analytics system has, so each aggregate authorizes explicitly
and then reads with the definer's privileges.

**Why no materialized view.** One clinic, bounded ranges, indexed columns; a
year of appointments aggregates in less time than the network round trip.
A materialized view would cost a refresh strategy, a staleness label on every
figure, and a class of bug where the dashboard and the export disagree.

**Date semantics.** Every reporting period is a pair of clinic calendar dates
denoting the half-open instant range
`[from 00:00 clinic-local, (to + 1 day) 00:00 clinic-local)`, in
`public.clinic_timezone()`. An appointment belongs to the clinic day its
`starts_at` falls on. Bounded at 366 days in the database, so a request that
skipped the form is still bounded.

**Indexes added for reporting only**: `patients_created_at_idx`,
`prescriptions_issued_at_idx`, `treatment_plans_activated_at_idx`,
`clinical_records_completed_at_idx`, `patient_documents_created_at_idx`,
`notifications_created_at_idx`, `notification_deliveries_created_at_idx`.
Each is named after the column an aggregate range-scans; the appointment and
availability indexes from Phases 09 and 10 are reused rather than duplicated.


---

## 11b. Clinical AI assistance (implemented, Phase 17)

`public.ai_assistance_sessions` is an **operational audit and a quota**. It is
not a clinical table, and nothing in the application reads it back into a
consultation.

**Why it exists at all.** `docs/HEALTHCARE_AND_AI_SAFETY.md` §8 requires an
entry recording that AI processed a given patient's record, and treats prompts
and responses involving patient data as subject to the same audit rules as any
other clinical access. The phase specification makes persistence optional; the
binding document does not. So the row records **that** a model was asked, and
nothing about what it said.

**What it has no column for**, and may never acquire one for: a prompt, a
response, a summary, a consideration, a warning, a missing-information entry, a
confidence score, a diagnosis, or clinical text of any kind. A test asserts the
table declaration contains none of them.

```text
id, practitioner_id, patient_id, appointment_id, clinical_record_id,
task, prompt_version, provider, model, status, failure_code,
latency_ms, input_tokens, output_tokens, context_fingerprint,
created_by, created_at, completed_at
```

**Derived, never supplied.** The practitioner comes from
`assert_care_practitioner()` and the patient is read out of the appointment.
`start_ai_assistance_session` has no patient, practitioner, model, prompt or
temperature parameter, and a **composite foreign key** to
`(appointments.id, patient_id, practitioner_id)` means a row naming this
patient against that practitioner's appointment is not something application
code has to prevent — the database cannot represent it.

**The quota is rows in a window.** 40 per practitioner and 12 per patient in a
rolling hour, consumed **before** the provider is called. In-memory rate
limiting was rejected deliberately: `src/lib/rate-limit/fixed-window.ts` is one
server instance and is cleared by a restart, which is adequate for an endpoint
behind a shared secret and inadequate for bounding money spent with an external
provider.

**Written before the call, not after.** An audit written after a successful
response would miss precisely the cases worth auditing — the call that timed
out, the one that was refused, the one that crashed the process. The row is
inserted `pending` and closed afterwards, so the database's record is "this was
attempted", which is the true statement.

**Immutable.** `ai_assistance_sessions_guard_update()` refuses any change to
identity, task, model, prompt version, fingerprint or creation, and refuses any
update to a row that has left `pending`. Verified live **against the service
role**: an audit entry that even the service role cannot rewrite is a stronger
guarantee than one protected by a policy.

**Row-level security is enabled with no policy at all**, for any role,
including the doctor who created the row. No workflow reads the table directly;
the definer functions are the whole interface, and Phase 16's aggregate reads
it as the definer. An absent policy is stronger than a predicate that evaluates
to false, because a predicate can be weakened by an edit.

**`context_fingerprint`** is a truncated SHA-256 over versions, statuses and
counts — never clinical text, so nothing clinical is recoverable from it. It
exists so a result generated against revision 1 cannot silently look current
against revision 2.

**Deletion.** Every reference is `on delete restrict`, so a patient,
practitioner or appointment with an AI session cannot be deleted — continuing
the behaviour Phase 12 introduced. No retention policy exists for this table;
the rows carry no clinical content.

---

## 12. Migrations

* Every schema change is a committed SQL migration file.
* Migrations are forward-only and ordered; each is applied exactly once.
* Migrations are reviewed with the same care as application code — a migration
  that drops a clinical column destroys patient history.
* Production schema is never modified by hand.
* RLS policies are part of the migration that creates the table, not a
  follow-up task. A table must not exist in any environment without its
  policies.

---

## 13. Not Decided in Phase 00

Deferred deliberately, to be settled when the implementing phase has real
requirements:

* Exact column lists, types and nullability for every table.
* Whether Ayurvedic assessment data is modelled as structured columns or a
  validated JSONB document.
* Soft-delete mechanism (status column versus `deleted_at`) — to be chosen
  once and applied consistently.
* Retention and deletion policy for patient data, which has legal as well as
  technical inputs.
* Multi-branch (multi-clinic) tenancy. The model must not *prevent* it; it
  does not implement it.
* Full-text and fuzzy search strategy for patient lookup.
* Whether `audit_logs` lives in the application schema or a separate schema
  with tighter grants.
