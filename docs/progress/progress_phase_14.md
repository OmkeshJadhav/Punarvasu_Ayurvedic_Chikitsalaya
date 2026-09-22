## PHASE 14 — Patient Documents & Secure Storage

Status:
COMPLETED — migration applied to the live Supabase project, verified against
it with real per-role JWTs, and driven end to end through a real browser

Completed On:
2026-09-19

Summary:
Built the first place Punarvasu holds a **file** belonging to a patient:
`public.patient_documents` with its own policies, a **private** storage
bucket with its own policy, server-side file validation that reads the bytes
rather than trusting a claim, the patient's own upload-and-view surface, the
practitioner's upload-from-a-consultation surface, secure preview, secure
download, and archiving that is a status change rather than a deletion.

**The bucket is private and no public URL exists or can be constructed.**
Every read is a short-lived signed URL minted after authorization, for a path
read off a row row-level security admitted. Every write is a `security
definer` function, and across all three of them there is **no `patientId`, no
`practitionerId`, no `uploadedBy` and no `status` parameter** — the storage
path is *recomputed inside the database* from the resolved patient, the
generated document id and the validated MIME type, and compared with what the
caller says it wrote.

**No client role can write `public.patient_documents`, and no client role can
write into the bucket.** A receptionist and an administrator have **no policy
at all** on either.

3,049 tests pass, up from 2,784. **209 live checks** were run against the real
project: 112 database and storage checks with real per-role JWTs, 71 browser
checks against the production build, and 26 end-to-end checks that drive the
actual upload form.

**Two pre-existing defects were found and fixed**, one of them a security
assertion that had been silently testing nothing since Phase 10. Both are
described below.

---

### Repository assessment before starting

Phases 06–13 left identity, the patient record, authorization, the
appointment engine, both staff workspaces, the clinical record, and
prescriptions and treatment plans. Reused rather than rebuilt:
`requireAreaAccess`/`requirePermission`/`assertPermission`,
`config/permissions.ts`, the three Supabase clients, `AppError`,
`createRouteHandler` and the API envelope, the structured logger, `uuidSchema`,
`assert_care_practitioner()`, `doctor_has_care_relationship()`,
`current_patient_id()`, `current_practitioner_id()`, `has_app_role()`,
`set_updated_at()`, `ClinicalContextHeader`, `ProfileSection`/
`ProfileFieldList`/`ProfileField`, the `Table` family, `Field`, `Input`,
`NativeSelect`, `Textarea`, `Dialog`, `Alert`, `Button`, `EmptyState`,
`ErrorState` and the Phase 09 clinic-date formatters.

Five findings shaped the work:

* **Phase 13 left two caveats and both were load-bearing.** "A storage object
  is not a database row — every guarantee rests on triggers and policies that
  a private bucket does not have", and "the browser pass this phase skipped
  should be run before Phase 14 adds more surface to it". Both were taken
  literally: the bucket got its own policy backed by the same predicate the
  table uses, and this phase ran the browser pass.
* **`public.appointments` and `public.clinical_records` had no unique
  constraint on `(id, patient_id)`**, so the composite foreign keys that make
  section 46's mismatch unrepresentable could not be declared. Two were added
  — trivially satisfied, adding no behaviour, exactly as Phase 12's
  `appointments_identity_key` and Phase 13's `clinical_records_identity_key`
  did before them.
* **The service-role key had never been used by a feature.** Phase 14 is the
  first, for object writes only, and the split is documented below.
* **`Field` sets the HTML `required` attribute from its prop.** That is the
  Phase 12 defect, and with a JavaScript submit handler it is worse: the
  browser refuses to fire the `submit` event at all, so pressing the button
  does visibly nothing. Guarded from the start here.
* **jsdom's `new FormData(form)` does not carry a file input's selection.**
  A form that relied on it could not be driven in the component suite, and a
  component the suite cannot drive is one it cannot catch a defect in. The
  upload form reads the file from the input instead — see *Decisions*.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260925120000_patient_documents.sql

src/config/documents.ts                      the allowlist, limits, bucket, TTL
src/config/documents.test.ts                 mirror check against the SQL

src/lib/documents/storage-path.ts            the object key and the download name
src/lib/documents/storage-path.test.ts
src/lib/documents/file-signature.ts          what a file actually is
src/lib/documents/file-signature.test.ts

src/features/documents/types.ts              the domain model
src/features/documents/status.ts             the lifecycle rules
src/features/documents/status.test.ts
src/features/documents/validation.ts         the trust boundary
src/features/documents/validation.test.ts
src/features/documents/errors.ts             SQLSTATE and rejection -> safe copy
src/features/documents/errors.test.ts
src/features/documents/content.ts            all document copy
src/features/documents/queries.ts            authorized, column-scoped reads
src/features/documents/storage.ts            the one module that names the bucket
src/features/documents/upload.ts             the upload workflow, end to end
src/features/documents/actions.ts            archive, and secure access

src/components/documents/document-list.tsx
src/components/documents/document-details.tsx
src/components/documents/document-status.tsx
src/components/documents/document-upload-form.tsx
src/components/documents/document-viewer.tsx
src/components/documents/document-archive-dialog.tsx

src/app/api/patient-documents/route.ts
src/app/(app)/patient/documents/page.tsx
src/app/(app)/patient/documents/loading.tsx
src/app/(app)/patient/documents/[id]/page.tsx
src/app/(app)/doctor/appointments/[id]/documents/page.tsx
src/app/(app)/doctor/patients/[id]/documents/page.tsx
src/app/(app)/doctor/patients/[id]/documents/[documentId]/page.tsx

tests/integration/document-actions.test.ts
tests/integration/document-security.test.ts
tests/integration/source-hygiene.test.ts
tests/components/documents.test.tsx
docs/progress/progress_phase_14.md
```

#### Modified

```text
src/config/permissions.ts              four document permissions: two patient,
                                       two doctor
src/config/permissions.test.ts         the speculative list, re-aimed
src/lib/authorization/policy.test.ts   the exhaustive matrix, extended
src/types/database.ts                  one table, three enums, four functions

src/app/(app)/doctor/appointments/[id]/consultation/page.tsx   a documents link
src/app/(app)/doctor/patients/[id]/page.tsx                    a documents section
src/app/(app)/patient/page.tsx                                 a stale notice
src/app/(app)/account/page.tsx                                 a stale notice

src/features/patients/content.ts       a Documents nav item; overview copy
src/features/clinical/content.ts       the consultation's next steps and notice
src/features/doctor/content.ts         two stale notices
src/features/admin/content.ts          the doctor's account-page next step
tests/components/doctor.test.tsx       the notice assertions
tests/components/patient-profile.test.tsx   the nav count
tests/integration/reception-actions.test.ts  a corrupted assertion — see below

docs/ARCHITECTURE.md, docs/SECURITY.md, docs/DATABASE.md,
docs/QA_STRATEGY.md, docs/DESIGN_SYSTEM.md, docs/PUNARVASU_MASTER_SPEC.md
```

#### Dependencies

**None added.** No file-type library, no upload widget, no PDF viewer, no
virus scanner, no S3 client. Signature detection for six formats is forty
lines; a dependency would be more code in the path patient data flows down.

---

### 2. Database

`supabase/migrations/20260925120000_patient_documents.sql`, applied to the
linked project with `supabase db push` and verified against it.

```text
Tables:         1 added (public.patient_documents). 0 altered structurally.
Columns:        20
Enums:          3 added
Constraints:    2 added to existing tables (identity keys); 14 on the new one
Foreign keys:   4 from patient_documents, of which 2 are composite;
                every one on delete restrict
Indexes:        3 added, plus the primary key and the unique storage path
Triggers:       2 added
RLS policies:   2 added on the table (both SELECT), 1 on storage.objects
                (SELECT). 0 altered, 0 dropped.
Functions/RPCs: 3 callable + 1 gate + 2 access predicates + 2 path helpers
                + 1 trigger function. 0 replaced.
Grants:         column-scoped SELECT to authenticated; EXECUTE on the three
                write functions. No write grant anywhere. anon receives
                nothing.
```

#### The table

```text
id                           uuid pk
patient_id                   uuid not null      -- derived, never a parameter
uploaded_by                  uuid -> auth.users on delete set null  (ungranted)
uploaded_by_role             patient_document_uploader not null
uploaded_by_practitioner_id  uuid -> practitioners on delete restrict
document_type                patient_document_type not null
title                        text not null
description                  text
storage_path                 text not null      -- unique, recomputed, immutable
file_name                    text not null      -- metadata only, never a path
mime_type                    text not null      -- what the server detected
file_size                    bigint not null
checksum_sha256              text not null      -- ungranted
status                       patient_document_status not null default 'active'
appointment_id               uuid
clinical_record_id           uuid
archived_at / archived_by / archive_reason
created_at / updated_at
```

**There is deliberately no `prescription_id` and no `treatment_plan_id.`**
Section 102 says not to add unnecessary columns and neither has a workflow: a
Punarvasu prescription is an authoritative row, not a file, and Phase 13
recorded that a generated prescription document must be an *export* of that
row rather than a second source of truth. A scan of an outside prescription
is a document of type `previous_prescription` and references nothing. Adding
either column later is additive.

**There is no column for anything read out of a file** — no extracted text,
no OCR result, no classification, no confidence, no summary. Sections 90–92,
asserted structurally.

#### Enums

`patient_document_type` — `lab_report`, `diagnostic_report`, `medical_image`,
`previous_prescription`, `referral`, `previous_record`, `other`.
`previous_prescription` rather than `prescription` deliberately: a document of
that kind is a scan of somebody else's prescription, and confusing it with
`public.prescriptions` would be a genuine clinical-safety problem.

`patient_document_status` — `active`, `archived`. **No unreachable value.**
Unlike the appointment, clinical-record and prescription enums, there was no
reason to declare one, and an enum value nothing writes is a state somebody
has to reason about for ever.

`patient_document_uploader` — `patient`, `practitioner`. Its own enum rather
than `public.app_role`, so a value added to the role model later cannot
silently become a valid uploader.

#### Constraints worth naming

| Constraint | What it makes impossible |
| --- | --- |
| `patient_documents_appointment_consistency` | A **composite foreign key** on `(appointment_id, patient_id)` into `appointments`. A document for patient A attached to patient B's appointment is not something application code must prevent — the database cannot represent it. Verified live: `23503` |
| `patient_documents_clinical_record_consistency` | The same, into `clinical_records (id, patient_id)`. Verified live |
| `patient_documents_storage_path_unique` | One object belongs to exactly one document, so a corrected report can only ever be a **new** document |
| `patient_documents_storage_path_shape` | The path must equal `patients/{patient_id}/documents/{id}/document.{ext}` with a 3–4 character lower-case extension and no `..` segment. Belt and braces over the recomputation inside the functions: whatever route a row arrives by, its path is in the controlled namespace. **Verified live against the service role** |
| `patient_documents_mime_type_allowed` | The type allowlist, in the database — a third layer under the browser's check and the server's signature inspection |
| `patient_documents_file_size_range` | 1 byte to 10 MB, the same number the bucket and the configuration carry |
| `patient_documents_uploader_consistency` | A practitioner upload names a practitioner; a patient upload does not |
| `patient_documents_checksum_format` | A lower-case hex SHA-256 and nothing else |

**Every reference is `on delete restrict`.** A patient, an appointment or a
practitioner with a document cannot be deleted — verified live, both refused
with `23503`. That continues Phase 12's behaviour change and extends it.

#### Functions

| Function | Purpose |
| --- | --- |
| `patient_document_extension(text)` | The extension for an allowed MIME type, or `null`. Returning `null` is what turns an unsupported type into a refused *path* |
| `patient_document_storage_path(uuid, uuid, text)` | The canonical object key. `lib/documents/storage-path.ts` builds the identical string, and a test parses the SQL to prove it |
| `assert_document_patient()` | The patient gate. The counterpart to Phase 11's `assert_care_practitioner()`: it refuses, and it **returns the resolved patient id** |
| `can_read_patient_document(uuid)` | Who may read a document |
| `can_read_patient_document_object(text)` | **The storage policy predicate.** The same answer, keyed on an object name — resolved by lookup, never by parsing |
| `create_patient_document_as_patient(...)` | The patient's own upload. No patient parameter |
| `create_patient_document_as_practitioner(...)` | **One appointment id**; the patient and the consultation are read out of it |
| `archive_patient_document(uuid, text)` | A status change, resolved by the caller being the uploader |
| `patient_documents_guard_update()` | Identity, file, uploader and clinical associations immutable; one-way `active → archived` |

---

### 3. Storage

```text
Bucket:                patient-documents
Private/public:        private (public = false), enforced by
                       `on conflict do update set public = false`
Storage path strategy: patients/{patientId}/documents/{documentId}/document.{ext}
Allowed types:         application/pdf, image/jpeg, image/png, image/webp,
                       image/heic, image/heif
Maximum size:          10 MB (10,485,760 bytes)
Storage policies:      one SELECT for `authenticated`, predicated on
                       `can_read_patient_document_object(name)`.
                       No insert, update or delete policy for any client
                       role. No policy at all for `anon`.
Signed URL lifetime:   300 seconds
```

#### The path, and why it cannot be influenced

Sections 8, 9, 43, 58 and 61, and example 4. The original filename is **not
an argument** to the path builder, so `../../another-patient.pdf` has nothing
to influence; the extension comes from the MIME type the *server* determined
by reading the file's first bytes; and both ids are uuids resolved
server-side. The path carries two opaque uuids and a generated filename —
no name, no date of birth, no diagnosis, no date.

The path is then **recomputed inside the database** and compared with what the
caller says it wrote. A mismatch is `PV041`, and the object is removed.
Verified live for a path naming another patient, a traversal path, an
absolute path, a path naming the bucket, and a hand-written path.

#### Why two Supabase clients, and which does what

```text
write   the service-role client, after the server has authorized
read    the caller's OWN client, under the storage select policy
```

**Writes.** There is no insert policy on the bucket for any client role, so
nothing a browser holds can put an object into it — which is the point: a
client that could write could choose its own path. The key is generated by
the server from a patient id it resolved and a document id it minted, after
it has read the bytes and confirmed what they are. Section 59 permits the
service-role key exactly here, and this is the first feature in the project
to use it.

**Reads.** Minted with the *caller's own* client, so
`patient_documents_objects_select` decides. Using the service role would have
bypassed every policy and thrown away the layer section 57 asks for.
A structural test asserts the admin client appears in `storage.ts`'s write
paths only, and nowhere else in the feature at all.

#### Preview

Only the four formats a browser renders inertly (section 29). An image goes
in an `<img>`; a PDF goes in an `<iframe sandbox="allow-scripts
allow-same-origin" referrerpolicy="no-referrer">`. The frame's origin is the
storage service's, not the application's, so `allow-same-origin` grants the
document its own *foreign* origin rather than ours — it cannot read the page,
its cookies or its session — and `allow-scripts` is what lets a browser's PDF
viewer run. Top-level navigation, forms and popups are all withheld.
**No third-party viewer is used** (section 70).

HEIC and HEIF are accepted for upload — it is what an iPhone produces, and
excluding it would be the most common upload failure a clinic in India would
see — and are deliberately **not** previewable. No browser renders them, and
an empty frame is worse than an honest "download it to open it".

---

### 4. File validation

Section 11's three checks, all three of which must pass, in the order that
makes the cheapest one decisive first:

```text
the bytes           what the file actually is   (the one the uploader
                                                 does not control)
the extension       must be one this type may carry
the declared type   must be one this type may be sent as
```

The **detected** type is what is stored, what becomes the object's
`Content-Type`, and what decides the path's extension. The declared one is
never written anywhere, even when it agrees.

Signatures: `%PDF-`, the eight-byte PNG signature, JPEG's SOI plus first
marker, `RIFF`…`WEBP`, and ISO-BMFF `ftyp` with a HEIF **brand** — which is
what tells a HEIC still apart from an MP4, a QuickTime file or an AVIF, all
of which share the same first eight bytes.

**`image/svg+xml` is not on the allowlist and must never be.** An SVG is a
document that can carry script; rendering one from a patient's upload would
be a same-origin XSS on a healthcare portal. HTML, XML, archives and
executables are absent for the same family of reasons, and the allowlist is
closed.

Size is bounded **twice**: against `file.size` before a byte is read, so a
200 MB request is refused without being buffered, and against the bytes
themselves in case the declared size lied. Then again by the check constraint
and again by the bucket.

#### What this is not

Section 85, stated rather than implied away. This reads the first bytes of a
file and answers one question: *is this a container of the type it claims to
be?* It does **not** answer whether the contents are safe. A genuine PDF can
carry an embedded script and a genuine JPEG can be crafted to exploit a
decoder. **There is no malware scanner in this deployment**, and the upload
form says so to the patient rather than implying a guarantee the product does
not have (section 40).

What makes that acceptable is that nothing in Punarvasu executes, interprets
or server-side renders an uploaded file (section 41). It is stored, and it is
handed back to whoever is entitled to it.

---

### 5. The workflows

#### Uploading

```text
1  authenticate          the route handler
2  authorize             which of the two upload permissions the caller has
3  validate metadata     a strict schema; an unexpected key is refused
4  bound the size        from file.size, before a byte is read
5  read the bytes        bounded by step 4
6  validate the file     signature, extension and declared type must agree
7  resolve the patient   from the session, or from the appointment
8  generate the id       server-side, and the path with it
9  checksum              SHA-256 over the bytes as they will be stored
10 upload                service role, upsert: false
11 write the metadata    security definer, which recomputes the path
12 compensate            remove the object if step 11 failed
```

**Why the object is written before the row.** Section 14 names both orphan
risks. Row-first leaves a document in a patient's list that cannot be
opened — a silent, permanent defect visible to the patient. Object-first
leaves, in the failure case, an unreferenced object in a private bucket that
**no policy can reach**, because the storage predicate resolves an object key
to a row that does not exist; step 12 then removes it. The worse failure mode
is avoided and the better one is compensated. Verified live and in the
integration suite: a failed metadata write is followed by exactly one
`remove` of exactly the path that was written.

**Retries.** A fresh document id per request means a retry after a *network*
failure creates a second document rather than a silent duplicate — the honest
outcome, because the client cannot know whether the first attempt landed. A
retry that reached the database is idempotent: both create functions are
`on conflict (id) do nothing` and read back the existing row, and only if it
is genuinely the caller's.

**Large files.** Section 52 prefers streaming; this buffers, deliberately,
because section 85 and attack 9 require the server to *see* the bytes, and a
10 MB bound makes buffering safe. Recorded as a trade-off rather than glossed
over.

#### Uploading from a consultation (section 47)

The practitioner arrives from the appointment they are working in, and the
patient, the appointment and the consultation come with them. The form has
**no patient field and no practitioner field**; the one identifier it posts is
the appointment, and the database re-resolves it by the caller's own
practitioner record before reading a patient out of it. Verified live: doctor
B cannot upload against doctor A's appointment (`PV045`).

#### Secure access

```text
authenticate      getCurrentUser(), verified against the Auth server
authorize         the read permission the caller actually holds
resolve           under row-level security, so a document that is not theirs
                  is simply absent
verify state      a preview is refused for a type a browser must not render,
                  and for an archived document
sign              only now, and only the path that came off that row
```

Section 31's "never generate a signed URL before authorization" is
**structural** here rather than remembered: the path is not an input.

It is a **server action rather than `GET /api/documents/:id/access`**. Section
60 describes an endpoint and every step it lists happens; what the action adds
is that the document id never reaches a URL, and therefore never reaches
browser history on a shared machine, a proxy access log or the next
`Referer` — the same reasoning Phases 10, 11 and 13 applied to search.

#### Archiving

Section 34. A status change, never a delete: the row, the file, the reason
and the whole history survive, and the document stays downloadable — because
withdrawing a report from the working record is not the same as destroying
the evidence, and somebody following a paper copy needs to be able to read
what it said *and* see that it was withdrawn.

**Only the uploader may archive.** That is the clean reading of section 34's
two rules at once: a patient cannot withdraw a document their clinician put
on their record, and a clinician cannot quietly remove one the patient
supplied. Verified live in both directions.

---

### 6. The access model, decided and documented

```text
patient        their own documents, at any status, and they may upload one
               for themselves
doctor         the documents of the patients they are booked to see — the
               care-relationship model of Phase 11 — and they may upload one
               from one of their own appointments
receptionist   nothing. No policy at all on the table, and none on the bucket
admin          nothing. No policy at all
anon           no grant at all, and no policy at all
```

#### Why a doctor's document scope is *wider* than their clinical-record scope

Phases 12 and 13 chose the **authoring-practitioner** model: a doctor reads
the clinical records and prescriptions *they wrote*. That is right for a
conclusion somebody else reached.

A document is a different kind of thing. A lab report is evidence the patient
obtained and brought to the clinic so that whoever is treating them can read
it; scoping it to whichever practitioner happened to be present when it was
uploaded would mean the patient uploading the same report again for the next
doctor. `phase_14.md` section 21 asks for exactly the simple policy
implemented here, and section 18's requirement is the one that matters: a
doctor must not reach a patient they have no care relationship with, and they
cannot — verified live in both directions with two practitioners.

**This is a product decision the clinic should confirm**, and widening or
narrowing it is a change to one policy predicate.

#### Why the receptionist gets nothing, including "upload only"

`docs/SECURITY.md` section 6's matrix marks patient documents "Upload only"
for a receptionist. That describes an operational workflow nobody has
designed: there is no front-desk document surface, no narrowly scoped
permission for it, and no audit trail. Section 19 is explicit that a
receptionist must not be given document access merely for holding the role.
Granting it now would grant it through a UI nobody has designed.

#### Why the administrator gets nothing

Section 20, and the same audit argument as every clinical permission since
Phase 12. The matrix says "Controlled, audited"; the audit subsystem does not
exist, so granting the read now would grant it unaudited.

---

### 7. Permissions

Four added to `config/permissions.ts`:

| Permission | Role | Covers |
| --- | --- | --- |
| `documents.read.self` | patient | Their own documents, at any status |
| `documents.write.self` | **patient** | Upload one for themselves, archive one they uploaded |
| `documents.read.care` | doctor | The documents of patients they are booked to see |
| `documents.write.care` | doctor | Upload from one of their own appointments, archive one they uploaded |

`documents.write.self` is the **first write permission a patient has ever
held over anything clinical-adjacent**, which is why `permissions.test.ts`
now writes the patient's whole list out rather than counting it.

No new `PROTECTED_AREAS` entry was needed: `/doctor` and `/patient` already
exist and already guard every new route.

---

### 8. Routes

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/patient/documents` | Dynamic | The patient's own list, and the upload form |
| `/patient/documents/[id]` | Dynamic | Detail, preview, download, archive |
| `/doctor/appointments/[id]/documents` | Dynamic | The consultation's documents, and the upload that inherits its context |
| `/doctor/patients/[id]/documents` | Dynamic | Everything on one patient's record |
| `/doctor/patients/[id]/documents/[documentId]` | Dynamic | Detail, preview, download |
| `POST /api/patient-documents` | Dynamic | The multipart upload |

All are `noindex`, `private, no-store` (inherited from the `(app)` layout and
the proxy) and disallowed in `robots.txt` — each verified in a browser.
**All 30 public pages remain static**; the build output confirms it.

---

### 9. Security and adversarial results

#### Live database and storage — 112 checks, real per-role JWTs

Run against the linked project by signing in as each account with the anon
key, so every check went through real row-level security and real storage
policies. The service-role client was used only to build and remove the
fixture and to read back what a check wrote — except where the service role
*is* the subject. Synthetic data only; everything created was removed, and the
run ends by confirming zero documents and zero objects remain.

| Area | Result |
| --- | --- |
| The bucket exists, is **private**, and carries the size limit and the type allowlist | PASS (4) |
| `anon` reads no document, cannot create one, cannot archive one | PASS (3) |
| A patient's own upload is recorded; the patient, the actor and the role are derived | PASS (6) |
| The stored path is the canonical one; the checksum is stored; no clinical context is invented | PASS (3) |
| **A repeat returns the same document and creates no second row** | PASS (2) |
| **A path for another patient, a traversal path, an absolute path, a path naming the bucket and a hand-written path are all refused** (`PV041`) | PASS (5) |
| An unsupported type is refused (`PV041`) | PASS |
| **Patient B sees no document at all, cannot read A's by id, and cannot find it by its storage path** | PASS (3) |
| **Patient B cannot sign patient A's object — path guessing** | PASS |
| **Patient B cannot download it directly** | PASS |
| Patient B cannot archive it (`PV040`) | PASS |
| Patient A can sign their own object, and the URL serves the bytes as `application/pdf` | PASS (3) |
| **There is no public URL, and an anonymous direct request is refused** | PASS (2) |
| **A doctor treating the patient reads and signs it; a doctor with no care relationship does neither** | PASS (4) |
| A doctor cannot archive a document the patient uploaded (`PV040`) | PASS |
| The practitioner's upload derives the patient, the practitioner, the appointment and the consultation from the appointment | PASS (5) |
| **Another practitioner cannot upload against that appointment** (`PV045`) | PASS |
| A practitioner cannot store it under another patient's path (`PV041`) | PASS |
| **A doctor cannot use the patient's upload path, and a patient cannot use the practitioner's** (`42501`) | PASS (2) |
| **A receptionist and an administrator read nothing, sign nothing, upload nothing and archive nothing** | PASS (12) |
| **No role — patient, receptionist, doctor, admin — can insert, update or delete a document** | PASS (12) |
| **A document cannot be attached to another patient's appointment or consultation** (`23503`) | PASS (2) |
| **Even the service role cannot store an uncontrolled path, an unsupported type or an oversized file** (`23514`) | PASS (3) |
| A second document cannot claim an existing object | PASS |
| **A document cannot be moved to another patient, object, file, type, size, uploader or consultation — even by the service role** (`PV042`) | PASS (7) |
| The uploader archives it; the moment, the actor and the reason are recorded; the file is untouched and the object still exists | PASS (6) |
| It cannot be archived twice (`PV040`), edited (`PV044`) or un-archived | PASS (3) |
| The patient still sees it, marked archived, and can still download it | PASS (2) |
| **A patient or an appointment with a document cannot be deleted** (`23503`) | PASS (2) |
| **An expired signed URL is refused, and a forged token is refused** | PASS (3) |
| Phase 10–13 regressions: receptionist reads no clinical record or prescription; a patient reads their own appointments and no other patient | PASS (4) |

**112 passed, 0 failed.**

#### Live browser — 71 checks, real Chrome, production build

| Area | Result |
| --- | --- |
| An anonymous visitor is sent to sign in from every document route | PASS (3) |
| A receptionist and an administrator are refused, and the refusal discloses no document | PASS (8) |
| The patient's list renders the document, its size, the upload form and a real file input | PASS (5) |
| **No storage path and no patient id is rendered anywhere** | PASS (2) |
| **axe with real computed contrast** on the list at 1280px and 390px | PASS — 0 violations |
| One `h1`, no skipped heading level, no target under 24px, on both patient pages | PASS (6) |
| The detail renders no path and no checksum, and **no signed URL exists before anybody asks** | PASS (4) |
| axe on the detail, and again with the preview open | PASS — 0 violations |
| The preview frame is sandboxed, sends no referrer, is named, and carries a signed URL | PASS (5) |
| **No signed URL, no title and no path reaches `localStorage` or `sessionStorage`; no document id reaches a query string** | PASS (4) |
| `private, no-store`, `noindex`, and `robots.txt` disallows both areas | PASS (4) |
| **No horizontal overflow at 320/375/390/430/768/1024/1280/1440/1920** on three document routes | PASS (3) |
| No animation runs under `prefers-reduced-motion` | PASS |
| A treating doctor sees the patient's documents and is told the scope, and that Punarvasu does not interpret one | PASS (3) |
| axe on both doctor document routes | PASS — 0 violations |
| The doctor's detail offers **no archive control for somebody else's upload** | PASS |
| **An unknown document id renders the not-found state and discloses nothing**, for both audiences | PASS (4) |
| Regression: `/`, `/services`, `/contact` axe-clean | PASS (3) |

**71 passed, 0 failed.**

#### End to end, through the real upload form — 26 checks

The sequence section 126 asks for, automated:

| Area | Result |
| --- | --- |
| A patient uploads a real PDF through the actual form | PASS |
| **The server determined the type from the bytes**, recorded the real size and a checksum | PASS (3) |
| The original filename is metadata only; **the path is the generated one** | PASS (2) |
| The object is really in the bucket | PASS |
| List → detail → **preview with a signed URL** → the URL serves the uploaded bytes → download offered → **still there after a reload** | PASS (6) |
| **An executable named `.pdf` and declared `application/pdf` is refused, and no row is created** | PASS (3) |
| **An SVG is refused, and nothing is stored** | PASS (2) |
| Nothing sensitive is left in browser storage or the URL | PASS (4) |

**26 passed, 0 failed.**

#### `phase_14.md` section 123's ten attacks

| Attack | Result | Where proved |
| --- | --- | --- |
| 1 — Patient IDOR | **DENIED**, and indistinguishable from not-found | Live DB, and in a browser |
| 2 — Storage path guessing | **DENIED** by the storage policy itself | Live: patient B, doctor B, receptionist and admin all refused a signed URL and a direct download for a known path |
| 3 — Fake patient id | **No effect** — not a parameter of anything | Live, validation tests, action tests |
| 4 — Fake practitioner id | **No effect** — not a parameter; and doctor B is refused doctor A's appointment (`PV045`) | Live |
| 5 — Fake clinical record id | **No effect** — not a parameter; the consultation is read out of the appointment | Structural test, live |
| 6 — Public URL | **DENIED** — the bucket is private; the public URL 400s and an anonymous direct request is refused | Live |
| 7 — Malicious file (`.exe`, `.html`, `.svg`, `.sh`) | **REJECTED** on the signature | Unit tests (every one), and live through the real form for an executable and an SVG |
| 8 — Path traversal | **REJECTED** — the filename is not an input to the path, and a traversal path is `PV041` and then `23514` | Unit tests, live |
| 9 — MIME spoofing | **REJECTED** — the bytes decide | Unit tests, and end to end in a browser |
| 10 — Unauthorized signed URL | **DENIED** before storage is touched | Action tests, live for four roles |

#### Automated — 3,049 tests, up from 2,784

| File | Count | Covers |
| --- | --- | --- |
| `src/config/documents.test.ts` | 17 | The allowlist, the size limit and the field limits **against the migration and against the bucket**, all three; that nothing executable is on the list; that only the inert formats are previewable |
| `src/lib/documents/storage-path.test.ts` | 17 | That the filename is not an input; that the TypeScript builder and the SQL builder agree, parsed out of the migration; hostile ids refused; no traversal, absolute path or bucket name; and a download name that cannot mean something to a shell or a header |
| `src/lib/documents/file-signature.test.ts` | 21 | Every allowed format recognised; executables, scripts, archives, SVG, HTML and XML refused; **a video or an AVIF sharing the HEIF container refused**; the detected type returned rather than the declared one; and all three of section 11's checks required |
| `src/features/documents/status.test.ts` | 16 | The lifecycle, the enums and the archive rule **against the migration**; no delete anywhere; `on delete restrict` everywhere; nothing read out of a file |
| `src/features/documents/validation.test.ts` | 22 | Twenty-three hostile fields one at a time on three schemas — **rejected rather than dropped**; that the module's own source names none of them; that no property of the bytes is validated here; and that the field lists and the schemas cannot drift |
| `src/features/documents/errors.test.ts` | 13 | Every raised SQLSTATE recognised and none declared that is not raised; a disjoint code range; that no table, policy, bucket, path or SQL can reach a screen; and that all three type failures read alike to a caller while staying distinct in the log |
| `tests/integration/document-actions.test.ts` | 37 | Roles writing nothing; the exact RPC argument lists; twelve planted fields changing nothing; the **compensation path**; a signed URL minted only after resolution; and **no log line carrying a title, filename, description, reason, path or URL** |
| `tests/integration/document-security.test.ts` | 55 | The database's and the bucket's guarantees, asserted against the migration, plus the application layer's — including that the service role is used for writes only |
| `tests/components/documents.test.tsx` | 43 | One form carrying exactly its endpoint's fields; **no HTML `required`**; progress that never claims success at 100%; a sandboxed preview; archiving that asks first; markup rendered as text; nothing in browser storage |
| `tests/integration/source-hygiene.test.ts` | 2 | No invisible control characters in any source file — see below |

---

### 10. Privacy

```text
Caching:        `force-dynamic` on the authenticated shell, `private,
                no-store` from the proxy, `noindex` on every route, and
                `robots.txt` disallows both areas. The upload reply is
                `private, no-store` explicitly. Stored objects are written
                with `cacheControl: "0"`. **No `next/image`** on a document
                preview — it would proxy a patient's file through the image
                optimizer and cache it on a shared CDN. All verified in a
                browser.

Logs:           the operation, the actor's opaque id and the document's
                opaque id. **Never** a title, a filename, a description, an
                archive reason, a storage path, a signed URL or a checksum.
                A rejected file logs the *reason category* and not the name
                — a filename is something the patient chose and may contain
                their own name. Asserted by a parenthesis-matching scan over
                every `logger.*` call in the feature, and behaviourally in
                the action tests.

Analytics:      none exists in the product, and this phase adds none
                (section 65).

URLs:           nothing. Access is a server action, so a document id never
                reaches a URL; the upload endpoint takes no id at all; and
                the storage path appears in no page, no link and no log.
                Measured in a browser: after opening a preview the address
                bar carries no query string.

Browser storage: nothing. The signed URL lives in component state for as
                long as the preview is open and is discarded when it closes,
                when it expires, or when the page unmounts. Asserted in
                jsdom and **measured in a real browser**, twice.
```

---

### 11. Defects found and fixed

#### Pre-existing, and found by this phase

**1. A Phase 10 security assertion had been testing nothing for four phases.**
*(real, found by a control-byte scan)*

`tests/integration/reception-actions.test.ts` asserted that a receptionist's
refusal message names no role:

```ts
expect(result.message).not.toMatch(/\brole\b/i);
```

Both word boundaries were **literal backspace bytes** in the file — the
formatter corruption Phase 06 recorded in `lib/auth/redirect.ts`, which had
happened again and gone unnoticed. The pattern was looking for
`<BS>role<BS>`, matched nothing, and therefore passed unconditionally.

It is invisible in a diff, invisible in review, and invisible to lint. It is
now built from a string — `new RegExp("\\brole\\b", "i")` — where the
backslash is escaped in the source and the formatter leaves it alone. The
repaired assertion passes, so the property it was meant to test was true all
along; what was broken was the test.

**2. The same corruption in Phase 13's permission test.** `/medication|\bai\b|…/`
had the same two bytes, so the `ai` alternative never matched either. Replaced
with a segment comparison, which needs no escape at all.

**3. A guard against the class.** `tests/integration/source-hygiene.test.ts`
now scans every source file for C0 and C1 control characters. It caught a
third instance immediately — in a comment *this phase* had just written,
where the editing tool decoded a unicode escape for NUL in the prose into four
real NUL bytes. The test includes a guard against itself: it asserts it is
scanning more than a hundred files, because a scan that silently matches
nothing is worse than no scan.

#### Introduced and fixed during the phase

**4. The upload form could not be driven in the component suite.** jsdom's
`new FormData(form)` does not carry a file input's selection — it appends a
zero-byte `File` with no name — so every submit failed validation with "that
file is empty" and eight tests could not exercise the flow at all.

The form now reads the file from the input ref and sets it on the `FormData`.
That is not a workaround: it makes "no file chosen" a state the component can
describe precisely rather than infer from a zero-byte entry, and a component
the suite cannot drive is one the suite cannot catch a defect in — which is
the whole lesson of Phase 12.

**5. An always-true predicate.** `canDownloadDocument()` returned `true`
unconditionally. Deleted, and replaced with a comment saying why there is no
such predicate: a question that always has one answer is one somebody will
later answer differently by accident.

#### Two harness bugs, recorded because a report listing only what passed is not evidence

* **Three integrity checks in the live harness reported `23514` where
  `23503` and `23505` were expected.** The harness built each row's storage
  path from a *different* random uuid than the row's own id, so the shape
  constraint fired before the composite foreign key and before the unique
  index. The database was right three times out of three; the harness now
  builds the path from the row it is inserting. In the process it recorded a
  stronger property than the one it set out to test: because the path encodes
  the document's own id, a second row **cannot** name an existing object at
  all, and the unique index sits beneath that as a second guarantee.
* **A component test timed out at 640 seconds** for a synchronous assertion.
  Two Vitest instances were running concurrently — one backgrounded, one in
  the foreground. Re-run alone it passes in 4 seconds. No assertion was
  changed; `docs/QA_STRATEGY.md` section 35 forbids papering over a flake,
  and this one had a cause outside the product.

---

### 12. Verification

Executed on 2026-09-19:

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 3,049 tests, 95 files** (was 2,784 / 85) |
| Production build | `npx next build` | **PASS** — no warnings; all 30 public pages still static; the 5 new document routes dynamic |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 176 files, 0 findings |
| Migration | `supabase db push` | **PASS** — applied to the linked project, storage policy included |
| **Live database and storage** | 112 checks, real per-role JWTs | **PASS — 112/112** |
| **Live browser** | 71 checks, real Chrome, production build | **PASS — 71/71** |
| **End-to-end upload** | 26 checks through the real form | **PASS — 26/26** |
| Live axe, real computed colour | 8 sweeps at 390px and 1280px, plus 3 public regressions | **PASS** — 0 violations |
| Live overflow | 9 widths × 3 document routes, fresh layout each | **PASS** — none |
| E2E | — | **NOT RUN** — no maintained E2E tool is installed (deferred since Phase 01); the live checks above are a script written for this phase |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

The temporary verification harnesses were removed after the run, and the
project was left with zero document rows and zero storage objects —
confirmed by a final query.

---

### 13. Acceptance criteria

#### Storage

| Criterion | Result |
| --- | --- |
| Patient documents use a private storage bucket | PASS — `public = false`, verified live |
| Public document URLs are not used | PASS — no public URL is stored, rendered or constructible; the public URL endpoint refuses, verified live |
| Storage paths are generated securely | PASS — server-generated and **recomputed by the database**, then compared |
| Original filenames cannot control storage paths | PASS — the filename is not an argument to the builder; verified live for five hostile paths |
| File type validation exists | PASS — declared type, extension **and signature**, all three required |
| File size limits exist | PASS — in the configuration, the check constraint and the bucket, all three asserted to agree |
| Dangerous file types are rejected/handled safely | PASS — closed allowlist; SVG, HTML, XML, archives and executables refused on the bytes, verified end to end in a browser |

#### Database

| Criterion | Result |
| --- | --- |
| `patient_documents` exists | PASS |
| Patient relationship exists | PASS — FK, `on delete restrict`, derived never accepted |
| Uploader relationship exists | PASS — the account and, for a practitioner, the practitioner record |
| Appropriate clinical relationships exist | PASS — appointment and clinical record, each a **composite** foreign key binding it to the same patient |
| Appropriate indexes exist | PASS — three, for the three queries this phase makes |
| Appropriate foreign keys exist | PASS — four, all `on delete restrict` |
| RLS is enabled | PASS |
| RLS policies are tested | PASS — 112 live checks, plus 55 structural |

#### Patient

| Criterion | Result |
| --- | --- |
| Patient can view own authorized documents | PASS — live and in a browser |
| Patient can upload permitted documents | PASS — end to end through the real form |
| Patient cannot access another patient's documents | PASS — by id, by list, by storage path, and by direct object request |
| Patient cannot spoof patient ownership | PASS — there is no patient parameter; verified live |
| Upload errors are safe | PASS — no bucket, table, policy or path in any message; asserted and verified |
| Mobile upload works | PASS — a native file input, driven at 390px in a real browser; the picker accepts both MIME types and extensions, and HEIC is on the allowlist |

#### Doctor

| Criterion | Result |
| --- | --- |
| Authorized doctor can access permitted patient documents | PASS — live and in a browser |
| Unauthorized doctor cannot access them | PASS — no row, and no signed URL |
| Doctor can upload if permitted by product policy | PASS — from their own appointment |
| Doctor identity is derived from authentication | PASS — `assert_care_practitioner()`; no practitioner parameter anywhere |
| Patient/care relationship is verified | PASS — in the policy and again inside every write function |

#### Receptionist/Admin

| Criterion | Result |
| --- | --- |
| Receptionist does not automatically receive clinical document access | PASS — **no policy at all**, verified live and in a browser |
| Admin does not automatically receive clinical document access | PASS — no policy at all |
| Any exceptional permission is explicit | PASS — there is none; the four permissions go to the patient and the doctor only |

#### Secure Access

| Criterion | Result |
| --- | --- |
| Signed URLs or equivalent secure access are used | PASS |
| Authorization happens before URL generation | PASS — structurally: the path is read off an authorized row |
| URLs are short-lived | PASS — 300 seconds, and the UI closes a preview before it lapses |
| Storage policies prevent direct unauthorized access | PASS — **verified live**: four roles refused a known path |
| Expired access behaves correctly where supported | PASS — verified live with a one-second URL, and a forged token refused |

#### Integrity

| Criterion | Result |
| --- | --- |
| Document relationships are validated | PASS — composite foreign keys |
| Patient/clinical-record mismatch is rejected | PASS — `23503`, live |
| Appointment/document mismatch is rejected | PASS — `23503`, live |
| Duplicate/retry behavior is safe | PASS — idempotent create; a network retry produces a second document rather than a silent duplicate, which is the honest outcome |
| Upload failures do not leave uncontrolled orphan state | PASS — the object is removed when the metadata write fails, and an unreferenced object is unreachable by any policy in the meantime |
| Historical clinical documents are not silently overwritten | PASS — `upsert: false`, a unique immutable path, a guard trigger, and no delete path at all |

#### Privacy

| Criterion | Result |
| --- | --- |
| No clinical document content in URLs | PASS — measured in a browser |
| No clinical document content in logs | PASS — asserted structurally and behaviourally |
| No sensitive document data in analytics | PASS — no analytics exists |
| Private pages are not publicly cached | PASS — measured in a browser |
| No sensitive documents in localStorage/sessionStorage | PASS — measured in a browser, twice |
| Unauthorized resource enumeration is prevented | PASS — not-found and not-yours are the same answer, verified live and in a browser |

#### UX

| Criterion | Result |
| --- | --- |
| Upload progress exists | PASS — a real `progressbar` with `aria-valuenow`, and a polite live region that announces the phase rather than every percentage point |
| Loading states exist | PASS — a structured skeleton in the shape of the page |
| Error states exist | PASS — a failed read distinguished from an empty one; a refused file named precisely; a refused upload saying the file was not saved |
| Empty states exist | PASS — for the patient and for the practitioner, each saying what to do next |
| Preview works for supported safe types | PASS — verified end to end |
| Download works securely | PASS — a signed URL with a safe `Content-Disposition` filename |
| Accessibility requirements are satisfied | PASS — **0 axe violations with real computed contrast** on every document route at 390px and 1280px; one `h1`; no skipped level; targets ≥24px; a real label on every control; a sandboxed, named preview frame |
| Responsive design is verified | PASS — **measured at 320/375/390/430/768/1024/1280/1440/1920** on three routes, no overflow |

#### AI Boundary

| Criterion | Result |
| --- | --- |
| No OCR interpretation is implemented | PASS — no column, no call, no dependency; asserted structurally |
| No AI diagnosis is implemented | PASS |
| No AI treatment recommendation is implemented | PASS |
| Documents are stored only | PASS — nothing in the feature opens a file except to read its first bytes and answer what container it is |
| Any future AI workflow remains doctor-reviewed | PASS — none exists; Phase 17 owns it |

#### Engineering

| Criterion | Result |
| --- | --- |
| Phase 08 authorization is reused | PASS — no second mechanism |
| Phase 07 patient model is reused | PASS — `public.patients`, unchanged |
| Phase 09 appointment model is reused | PASS — and no appointment is written |
| Phase 12 clinical records are reused | PASS — as an optional association, bound by a composite key |
| Phase 13 prescriptions/treatment plans are reused where relevant | PASS — deliberately *not* referenced; the reasoning is in the migration |
| No duplicate authorization model exists | PASS |
| TypeScript remains strict | PASS — no `any` added |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

```text
Patient -> My Documents -> Upload -> Private Storage -> Document Metadata
Doctor  -> Authorized Patient -> Documents -> Secure View / Download
```

Both were driven end to end in a real browser against the production build.
The bypasses section 124 lists are each closed and each verified live:

```text
URL manipulation            -> DENIED (5 actors, 3 routes, in a browser)
document IDs                -> DENIED, indistinguishable from not-found
patient IDs                 -> not a parameter of anything
storage paths               -> recomputed and compared; refused by the bucket
signed URLs                 -> minted only after authorization; expiry verified
client-side role tampering  -> nothing client-side decides anything
direct Storage access       -> DENIED for anon and for every authenticated role
```

And the separations hold:

```text
Public assets      != patient documents   (separate bucket; public/ is files)
Document storage   != clinical interpretation  (nothing reads a file)
```

---

### 14. Deferred

Intentionally not built:

* **Malware scanning** (section 40). No scanner is available in this
  deployment. The limitation is **stated on the upload form** rather than
  implied away, and the design accommodates one: a scan would fit between the
  object write and the metadata write, or as a status the metadata carries.
* **OCR, extraction, classification, summarisation and any AI
  interpretation** (sections 90–92, 125). No column, no call, no dependency.
  Phase 17.
* **Versioning** (section 89). A corrected report is a new document, which is
  what section 37 asks for. Document ids are opaque and the storage path
  encodes one, so a version chain can be added later without touching an
  existing row.
* **Retention and automatic deletion** (section 36). There is no retention
  policy, so there is no automatic deletion — and no deletion at all.
* **A full audit subsystem** (sections 63–64). Every write is logged against
  an opaque actor id and every *access grant* is logged; the operations are
  shaped so Phase 19 can capture upload, view, download and archive without
  changing them.
* **A receptionist document surface** and the narrowly scoped permission it
  would need (section 19).
* **Administrative document access** (section 20) — it needs the audit
  subsystem first.
* **Thumbnails** (section 116), **EXIF stripping** (section 42 — stripping
  metadata modifies clinical evidence, which section 42 also warns against,
  so it needs a product decision), **metadata editing** (section 118) and
  **association editing** (section 119). The guard trigger already refuses
  all of the last two, so the day one is built it starts from a refusal
  rather than from a gap.
* **Notifications** (Phase 15) and **analytics** (Phase 16).
* **Moving `ProfileSection`/`ProfileFieldList`/`ProfileField` to
  `components/shared/`.** Eight areas now depend on them; it belongs on its
  own change rather than inside this one.

---

### 15. Known issues

1. **No malware scanning.** See above. The product says so; it should be
   added before the clinic accepts documents from the public at scale.
2. **The doctor's document scope is the care relationship, not authorship.**
   A practitioner sees documents another practitioner uploaded for a patient
   they both treat. That is the model `phase_14.md` section 21 asks for and
   the reasoning is recorded in section 6 above — but it is a product
   decision the clinic should confirm, and it is deliberately wider than the
   clinical-record and prescription scopes.
3. **Uploads are buffered in memory, not streamed.** Bounded at 10 MB, and
   the reason is that the signature check requires the server to see the
   bytes. A larger limit would need a different approach.
4. **No audit of document *access*.** A signed URL being minted is logged
   against an opaque actor and document id, which is more than Phases 12 and
   13 record for a read — but there is no queryable audit trail. Phase 19.
5. **`src/types/database.ts` is still hand-written**, deliberately.
   `npm run db:types` would overwrite it with generated output whose `Insert`
   and `Update` shapes are permissive; the hand-written file types them
   `never`, which makes a client table write a compile error. Every table and
   function it declares was exercised live.
6. **The four Phase 08 test accounts remain on the development project.**
   Shared, well-known credentials, including an administrator. **Delete them
   before this database takes real patient data** — and that matters more
   again now, because the database and the bucket can hold patient documents.
7. **No E2E tool, no manual screen-reader pass, no Lighthouse run.**
   Unchanged since Phase 01/02. The 209 live checks are a script written for
   this phase, not a maintained suite.
8. **Still no CSP.** Unchanged since Phase 02, and now slightly larger in
   scope: a policy needs `frame-src` for the storage origin as well as for
   the contact page's map.
9. **Legal pages still do not exist.** Required before the clinic handles
   real records through this website, and now unambiguously so.
10. **The clinic has no verified practitioner**, and the development
    project's seeded one is named "Test Doctor". Unchanged since Phase 09.

---

### 16. Phase status

```text
Phase 14: COMPLETE
Ready for Phase 15: YES
```

Phase 15 has not been started.

Notifications can be built directly on what exists. The events worth
notifying about are already named in the structured log and already have a
clean boundary: `prescriptions.issued_at`, `treatment_plans.activated_at`,
`appointment_events`, and now `patient_documents.created_at`. Every one is a
row a notification service can observe without any feature knowing it exists.

Two caveats to carry forward:

* **A notification is the first thing Punarvasu sends that reaches a lock
  screen.** `docs/PRODUCT_SPEC.md` section 5A already says notification
  payloads must be minimal; a document notification must not name the
  document, because a title is something a patient wrote about their own
  health.
* **The source-hygiene guard added in this phase should be kept.** It found
  two live instances of a corruption that had survived four phases of review,
  and both were in security assertions.
