-- ---------------------------------------------------------------------------
-- Phase 14 - Patient Documents & Secure Storage
--
-- The first phase in which Punarvasu holds a *file* belonging to a patient.
-- Everything before this was rows; a storage object is a different kind of
-- thing, and none of the guarantees the earlier phases rest on - a policy, a
-- check constraint, a guard trigger - applies to it automatically.
--
-- So this migration establishes both halves and keeps them in agreement:
--
--     public.patient_documents     the metadata, and the authorization
--     the patient-documents bucket the bytes, private, never public
--
-- ## The boundary this migration exists to hold
--
-- `phase_14.md` sections 7, 23 and 24. The database is the source of truth
-- for *who may see what*; storage holds the file and nothing else. A storage
-- object is reachable only through a row that row-level security let the
-- caller read, the bucket is private, and there is no permanent public URL
-- anywhere - nor any way to construct one.
--
-- Clinic marketing assets, practitioner photographs and public website
-- imagery do **not** live here. They are files in `public/`, served by the
-- web server, and this bucket exists solely for patient documents.
--
-- ## What is reused
--
-- Everything underneath, unaltered. `public.assert_care_practitioner()`
-- (Phase 11), `public.doctor_has_care_relationship()` (Phase 11),
-- `public.current_patient_id()` (Phase 09), `public.has_app_role()`
-- (Phase 08) and `public.set_updated_at()` (Phase 06) are all called and none
-- is replaced. **This migration replaces no existing function, drops no
-- policy, alters no existing column and adds no document column to an
-- existing table.**
--
-- Two things are added to existing tables, and each only ever refuses more:
-- a unique constraint on `appointments (id, patient_id)` and one on
-- `clinical_records (id, patient_id)`, so that the composite foreign keys
-- below can be declared. Both are trivially satisfied - `id` is the primary
-- key of each - and neither adds behaviour, exactly as Phase 12's
-- `appointments_identity_key` and Phase 13's `clinical_records_identity_key`
-- did before them.
--
-- ## The access policy this migration implements
--
-- `phase_14.md` sections 16-21, and `docs/SECURITY.md` section 6's matrix row
-- ("Patient documents | Own | Upload only | Treated patients | Controlled,
-- audited").
--
--     patient        their **own** documents, at any status, and they may
--                    upload one for themselves
--     doctor         the documents of the patients they are **booked to
--                    see** - the care-relationship model of Phase 11 - and
--                    they may upload one from one of their own appointments
--     receptionist   nothing. No policy at all on the table, and none on the
--                    bucket. The matrix's "Upload only" describes an
--                    operational workflow nobody has designed, and which
--                    would need its own narrowly scoped permission and its
--                    own surface (section 19)
--     admin          nothing. No policy at all. The matrix says "Controlled,
--                    audited" and the audit subsystem does not exist, so
--                    granting the read now would grant it unaudited
--                    (section 20)
--     anon           no grant at all on the table, and no policy at all on
--                    the bucket, so it never reaches row-level security
--
-- ### Why a doctor's document scope is *wider* than their clinical-record
-- ### scope, deliberately
--
-- Phase 12 and Phase 13 chose the **authoring-practitioner** model: a doctor
-- reads the clinical records and prescriptions *they wrote*, and not a
-- colleague's. That is right for a conclusion somebody else reached.
--
-- A document is a different kind of thing. A lab report is evidence the
-- patient obtained and brought to the clinic so that whoever is treating them
-- can read it; scoping it to whichever practitioner happened to be present
-- when it was uploaded would mean the patient uploading the same report again
-- for the next doctor. `phase_14.md` section 21 asks for exactly the simple
-- policy implemented here - "Authorized doctor -> documents for authorized
-- patients" - and section 18's requirement is the one that matters: a doctor
-- must not reach a patient they have no care relationship with, and they
-- cannot.
--
-- ## What a request may say, and what it may not
--
-- Every write is a `security definer` function whose argument list is the
-- allowlist. Across all three of them there is **no `patientId`, no
-- `practitionerId`, no `doctorId`, no `uploadedBy` and no `status`
-- parameter.**
--
--   * the patient's own upload derives the patient from
--     `public.current_patient_id()`;
--   * the practitioner's upload takes **one appointment id**, resolves it by
--     that id *and* by the caller's own practitioner record in one statement,
--     and reads the patient and the consultation out of the appointment
--     (section 47);
--   * the storage path is **recomputed inside the database** from the
--     resolved patient id, the document id and the validated MIME type, and
--     compared with what the caller says it wrote. A path is therefore never
--     parsed and never trusted - it is derived and checked (sections 8, 58
--     and 61).
--
-- ## Historical integrity
--
-- `phase_14.md` sections 34-37.
--
--   * there is **no delete function, no delete grant and no delete policy**,
--     and every reference to a patient, an appointment or a clinical record
--     is `on delete restrict`. A clinical document cannot be destroyed;
--   * `storage_path` is unique and immutable, so a corrected report is a
--     **new document**, never an overwrite of an existing object
--     (section 37);
--   * removal is `archive`, a status change that preserves the metadata, the
--     object and the reason, and which only the uploader may perform;
--   * `patient_documents_guard_update()` refuses a change to the patient, the
--     uploader, the storage path, the file, the clinical associations or the
--     creation time, whatever wrote it.
--
-- ## No interpretation of any kind
--
-- Nothing in this migration reads the contents of a file. There is no OCR, no
-- extraction, no classification, no summary, no recommendation and no column
-- for one (sections 90-92). The database stores what the file *is* - a name,
-- a type, a size and a checksum - and never what it *says*.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

-- Section 22. Categories a patient or a practitioner would recognise, and no
-- more. `previous_prescription` rather than `prescription` deliberately: a
-- document of this kind is a *scan of somebody else's prescription* that the
-- patient brought in, and it must never be confused with
-- `public.prescriptions`, which is what a Punarvasu practitioner issued and
-- which has its own table, its own lifecycle and its own immutability.
--
-- This is a classification the **uploader chooses**, never one the
-- application infers from the file - section 125 rules out unverified medical
-- document classification, and inferring a category from a filename would be
-- exactly that.
create type public.patient_document_type as enum (
  'lab_report',
  'diagnostic_report',
  'medical_image',
  'previous_prescription',
  'referral',
  'previous_record',
  'other'
);

comment on type public.patient_document_type is
  'What kind of document this is, as chosen by whoever uploaded it. Never '
  'inferred from the file, its name or its contents.';

-- Section 88. Two states, because two are what the workflow needs. A document
-- is either part of the patient''s working record or it has been withdrawn
-- from it, and in both cases the file and its metadata remain.
create type public.patient_document_status as enum (
  'active',
  'archived'
);

comment on type public.patient_document_status is
  'A document is never deleted. Archiving withdraws it from the working '
  'record while preserving the metadata, the object and the reason.';

-- Who put the document there. Its own enum rather than `public.app_role`,
-- because only two of the four roles can ever upload and because a value
-- added to the role model later must not silently become a valid uploader.
create type public.patient_document_uploader as enum (
  'patient',
  'practitioner'
);

comment on type public.patient_document_uploader is
  'Which side of the consultation supplied the document. Deliberately not '
  'public.app_role: a new role must not become an uploader by accident.';


-- ---------------------------------------------------------------------------
-- 2. Identity keys on the tables a document may reference
--
-- Exactly Phase 12's `appointments_identity_key` and Phase 13's
-- `clinical_records_identity_key`, narrowed to the pair this phase needs.
-- They exist so that `patient_documents` can declare **composite** foreign
-- keys, which makes sections 45-46 and example 7's mismatch - a document for
-- patient A attached to patient B's consultation - something the database
-- cannot represent rather than something application code must remember to
-- prevent.
-- ---------------------------------------------------------------------------

alter table public.appointments
  add constraint appointments_patient_identity_key
  unique (id, patient_id);

comment on constraint appointments_patient_identity_key on public.appointments is
  'Exists so that public.patient_documents can declare a composite foreign '
  'key to (id, patient_id). Trivially true - id is the primary key - and '
  'adds no behaviour of its own.';

alter table public.clinical_records
  add constraint clinical_records_patient_identity_key
  unique (id, patient_id);

comment on constraint clinical_records_patient_identity_key on public.clinical_records is
  'Exists so that public.patient_documents can declare a composite foreign '
  'key to (id, patient_id). Trivially true and adds no behaviour of its own.';


-- ---------------------------------------------------------------------------
-- 3. The document metadata table
-- ---------------------------------------------------------------------------

create table public.patient_documents (
  id uuid primary key default gen_random_uuid(),

  -- Whose document this is. Derived from the session for a patient upload and
  -- from the appointment for a practitioner upload; never a parameter of
  -- anything (sections 17 and 86, example 2).
  patient_id uuid not null,

  -- Who supplied it. Nullable so the document survives an account being
  -- removed - the report is what matters, not who happened to upload it - and
  -- **absent from the select grant** below, so no client reads it through a
  -- query. `uploaded_by_role` is granted, because "you uploaded this" and
  -- "your practitioner uploaded this" is a distinction the reader genuinely
  -- needs.
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_by_role public.patient_document_uploader not null,

  -- The practitioner, when a practitioner uploaded it. Nullable, and
  -- constrained against `uploaded_by_role` below so the two cannot disagree.
  uploaded_by_practitioner_id uuid,

  document_type public.patient_document_type not null,

  -- Section 117. A human-readable title the uploader writes. Required,
  -- because a list of files all called "document" helps nobody.
  title text not null,

  -- Section 78. Optional, and the form that captures it says explicitly not
  -- to describe symptoms here. It is metadata about a file, not a place to
  -- write a medical history.
  description text,

  -- **The object key, generated by the server and verified by the database.**
  -- Sections 8, 9, 43 and 58. The shape is
  --
  --     patients/{patientId}/documents/{documentId}/document.{ext}
  --
  -- which carries no name, no date of birth, no diagnosis and no original
  -- filename. It is recomputed by `public.patient_document_storage_path()`
  -- inside every create function and compared with what the caller says it
  -- wrote, so a path is derived and checked rather than parsed and trusted.
  --
  -- Unique, so one object belongs to exactly one document and a corrected
  -- report can only ever be a *new* document (section 37).
  storage_path text not null,

  -- Section 9. The original filename, kept as metadata because it is often
  -- how the patient recognises the file - and never used to build a path.
  file_name text not null,

  -- Section 11. The type the **server** determined, after checking the
  -- declared type, the extension and the file's own signature. Not what the
  -- browser claimed.
  mime_type text not null,
  file_size bigint not null,

  -- Section 39. A SHA-256 of the bytes as stored. Useful for integrity
  -- checking and for recognising an identical re-upload; deliberately not
  -- shown to a patient, and not used to deduplicate anything automatically
  -- (section 38).
  checksum_sha256 text not null,

  status public.patient_document_status not null default 'active',

  -- Sections 45-47. Optional clinical context, constrained to the same
  -- patient by the composite foreign keys below, so example 7's mismatch
  -- cannot be stored.
  --
  -- There is deliberately **no `prescription_id` and no `treatment_plan_id`.**
  -- Section 102 says not to add unnecessary columns, and neither has a
  -- workflow: a Punarvasu prescription is an authoritative row, not a file,
  -- and Phase 13 recorded that a generated prescription document must be an
  -- *export* of that row rather than a second source of truth. A scan of an
  -- outside prescription is a document of type `previous_prescription` and
  -- references nothing. Adding either column later is additive.
  appointment_id uuid,
  clinical_record_id uuid,

  archived_at timestamptz,
  archived_by uuid references auth.users (id) on delete set null,
  archive_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ---- Integrity ---------------------------------------------------------

  constraint patient_documents_patient_fkey
    foreign key (patient_id) references public.patients (id)
    on delete restrict,

  constraint patient_documents_practitioner_fkey
    foreign key (uploaded_by_practitioner_id)
    references public.practitioners (id)
    on delete restrict,

  -- **The consistency guarantee** (sections 45-46, 87 and example 7). The
  -- pair must exist as a row in `appointments`, so a document for patient A
  -- cannot be attached to patient B's appointment. Declarative, always
  -- enforced, impossible for application code to route around.
  constraint patient_documents_appointment_consistency
    foreign key (appointment_id, patient_id)
    references public.appointments (id, patient_id)
    on update cascade
    on delete restrict,

  constraint patient_documents_clinical_record_consistency
    foreign key (clinical_record_id, patient_id)
    references public.clinical_records (id, patient_id)
    on update cascade
    on delete restrict,

  constraint patient_documents_storage_path_unique unique (storage_path),

  -- A practitioner upload names a practitioner; a patient upload does not.
  constraint patient_documents_uploader_consistency check (
    (uploaded_by_role = 'practitioner') = (uploaded_by_practitioner_id is not null)
  ),

  constraint patient_documents_archive_consistency check (
    (status = 'archived') = (archived_at is not null)
  ),

  -- **The type allowlist, in the database** (section 10). A third layer under
  -- the browser's check and the server's signature inspection, and the one
  -- that holds against any writer. `src/config/documents.ts` mirrors it and a
  -- test reads this constraint to prove the two agree.
  constraint patient_documents_mime_type_allowed check (
    mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    )
  ),

  -- **The size limit, in the database** (section 12). The bucket carries the
  -- same number, and so does the application configuration; all three are
  -- asserted to agree.
  constraint patient_documents_file_size_range check (
    file_size between 1 and 10485760
  ),

  constraint patient_documents_title_length check (
    char_length(btrim(title)) between 1 and 160
  ),
  constraint patient_documents_description_length check (
    description is null or char_length(btrim(description)) between 1 and 500
  ),
  constraint patient_documents_file_name_length check (
    char_length(btrim(file_name)) between 1 and 255
  ),
  constraint patient_documents_archive_reason_length check (
    archive_reason is null or char_length(btrim(archive_reason)) between 1 and 300
  ),

  -- A lower-case hex SHA-256 and nothing else.
  constraint patient_documents_checksum_format check (
    checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),

  -- Belt and braces on top of the recomputation inside the create functions:
  -- whatever route a row arrives by, its path is in the controlled namespace
  -- and names this document and this patient. A `..` segment cannot satisfy
  -- it, and neither can a leading slash, an absolute path or a bucket name
  -- (section 61).
  constraint patient_documents_storage_path_shape check (
    storage_path = 'patients/' || patient_id::text
                || '/documents/' || id::text
                || '/document.' || split_part(storage_path, '.', 2)
    and split_part(storage_path, '.', 2) ~ '^[a-z0-9]{3,4}$'
    and storage_path !~ '\.\.'
  )
);

comment on table public.patient_documents is
  'Metadata and authorization for a patient document. Highly confidential '
  '(docs/SECURITY.md section 4). Readable by the patient it belongs to and by '
  'a practitioner with a care relationship to them. No receptionist and no '
  'administrator has any policy on this table. Every write is a security '
  'definer function - there is no insert, update or delete grant for any '
  'client role. The file itself lives in the private patient-documents bucket '
  'and is reachable only through a short-lived signed URL minted after '
  'authorization.';

comment on column public.patient_documents.storage_path is
  'The object key, generated by the server and recomputed inside the database '
  'before it is stored. Never parsed from a request, never derived from the '
  'original filename, and never a URL.';

comment on column public.patient_documents.mime_type is
  'The type the server determined by inspecting the file signature, not the '
  'type the browser declared.';

comment on column public.patient_documents.checksum_sha256 is
  'Integrity only. Not shown to patients and not used to deduplicate '
  'automatically (phase_14.md sections 38-39).';

-- Section 103. The queries this phase actually makes, and no others.
create index patient_documents_patient_idx
  on public.patient_documents (patient_id, created_at desc);

create index patient_documents_appointment_idx
  on public.patient_documents (appointment_id)
  where appointment_id is not null;

create index patient_documents_clinical_record_idx
  on public.patient_documents (clinical_record_id)
  where clinical_record_id is not null;


-- ---------------------------------------------------------------------------
-- 4. The storage path, computed in one place
--
-- Sections 8, 9, 43 and 58. The namespace is controlled, the filename is
-- generated, and the extension comes from the **validated** MIME type rather
-- than from whatever the uploader called the file.
-- `src/lib/documents/storage-path.ts` builds the identical string in
-- TypeScript so that the server can upload before the row exists, and a test
-- asserts the two agree.
-- ---------------------------------------------------------------------------

create function public.patient_document_extension(p_mime_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_mime_type
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    when 'image/heic' then 'heic'
    when 'image/heif' then 'heif'
  end;
$$;

comment on function public.patient_document_extension(text) is
  'The file extension for an allowed MIME type, or null for a type that is '
  'not allowed. Returning null is what makes an unsupported type fail the '
  'path check rather than produce a path with no extension.';

create function public.patient_document_storage_path(
  p_patient_id uuid,
  p_document_id uuid,
  p_mime_type text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when public.patient_document_extension(p_mime_type) is null then null
    else 'patients/' || p_patient_id::text
      || '/documents/' || p_document_id::text
      || '/document.' || public.patient_document_extension(p_mime_type)
  end;
$$;

comment on function public.patient_document_storage_path(uuid, uuid, text) is
  'The canonical object key for a document. The original filename never '
  'contributes to it, so a filename such as ../../secret.pdf cannot '
  'influence where anything is written.';


-- ---------------------------------------------------------------------------
-- 5. The patient gate
--
-- The counterpart to Phase 11's `assert_care_practitioner()`: it refuses, and
-- it **returns the resolved identity**, so every function below derives the
-- patient rather than accepting one. There is no patient id parameter
-- anywhere in this migration for a request to substitute.
-- ---------------------------------------------------------------------------

create function public.assert_document_patient()
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  patient uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.has_app_role('patient') then
    raise exception 'This operation is available to patients only.'
      using errcode = 'insufficient_privilege';
  end if;

  patient := public.current_patient_id();

  if patient is null then
    -- Holding the patient role is not the same as having a patient record:
    -- somebody who has registered but not completed their profile has none.
    -- Its own code, because the remedy is specific and the person can act on
    -- it.
    raise exception 'No patient record for this account.'
      using errcode = 'PV046';
  end if;

  return patient;
end;
$$;

comment on function public.assert_document_patient() is
  'Refuses a caller who is not a patient with a patient record, and returns '
  'that patient id. The counterpart to assert_care_practitioner(): an '
  'authorization gate that resolves an identity rather than accepting one.';


-- ---------------------------------------------------------------------------
-- 6. Timestamps and the update guard
-- ---------------------------------------------------------------------------

create trigger patient_documents_set_updated_at
  before update on public.patient_documents
  for each row
  execute function public.set_updated_at();

-- Sections 37, 118 and 119. Everything that identifies the document, the
-- patient, the file or the clinical context is immutable, whatever wrote it.
-- The only permitted change is the one-way archive transition.
create function public.patient_documents_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.patient_id <> old.patient_id
     or new.id <> old.id
     or new.storage_path <> old.storage_path
     or new.file_name <> old.file_name
     or new.mime_type <> old.mime_type
     or new.file_size <> old.file_size
     or new.checksum_sha256 <> old.checksum_sha256
     or new.uploaded_by_role <> old.uploaded_by_role
     or new.uploaded_by is distinct from old.uploaded_by
     or new.uploaded_by_practitioner_id is distinct from old.uploaded_by_practitioner_id
     or new.created_at <> old.created_at then
    raise exception 'A document''s identity, file and uploader cannot be changed.'
      using errcode = 'PV042';
  end if;

  -- Section 119. Reassigning a document to a different consultation is a
  -- security-sensitive act that would need both relationships re-authorized;
  -- nothing in this phase does it, so nothing may.
  if new.appointment_id is distinct from old.appointment_id
     or new.clinical_record_id is distinct from old.clinical_record_id then
    raise exception 'A document cannot be moved to another consultation.'
      using errcode = 'PV042';
  end if;

  if new.status <> old.status and not (
    old.status = 'active' and new.status = 'archived'
  ) then
    raise exception 'A document cannot change from % to %.',
      old.status, new.status
      using errcode = 'PV044';
  end if;

  -- An archived document stays archived, and its metadata stays what it was.
  if old.status = 'archived'
     and (new.archive_reason is distinct from old.archive_reason
          or new.archived_at is distinct from old.archived_at
          or new.document_type <> old.document_type
          or new.title <> old.title
          or new.description is distinct from old.description) then
    raise exception 'An archived document cannot be edited.'
      using errcode = 'PV044';
  end if;

  return new;
end;
$$;

comment on function public.patient_documents_guard_update() is
  'Holds the immutability of a document''s identity, file, uploader and '
  'clinical associations, and the one-way active -> archived transition. A '
  'corrected report is a new document, never an edit of an old one.';

create trigger patient_documents_guard_update
  before update on public.patient_documents
  for each row
  execute function public.patient_documents_guard_update();


-- ---------------------------------------------------------------------------
-- 7. The access predicates
--
-- Two functions saying the same thing about two different keys - a document
-- id, and a storage object key - so that "who may see this document" has
-- exactly one answer and the table and the bucket cannot drift apart.
--
-- `security definer` for the reason Phase 09's second migration exists: a
-- policy expression is evaluated with the *calling* role's privileges, and
-- because policies are OR-ed, PostgreSQL evaluates all of them - so one
-- policy that raises takes out the query for every caller, including the one
-- whose own policy would have admitted them.
-- ---------------------------------------------------------------------------

create function public.can_read_patient_document(p_document_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.patient_documents d
    where d.id = p_document_id
      and (
        (
          public.has_app_role('patient')
          and d.patient_id = public.current_patient_id()
        )
        or (
          public.has_app_role('doctor')
          and public.doctor_has_care_relationship(d.patient_id)
        )
      )
  );
$$;

comment on function public.can_read_patient_document(uuid) is
  'Whether the calling user may read this document: the patient it belongs '
  'to, or a practitioner with a care relationship to that patient. A '
  'receptionist and an administrator never satisfy it.';

-- **The storage half of the same answer** (sections 57, 58 and 106). Takes an
-- object key and resolves it to a document row, so an authenticated user who
-- guesses or constructs a path reaches an object only if they could have read
-- the row that names it. The path is *looked up*, never parsed.
create function public.can_read_patient_document_object(p_object_name text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.patient_documents d
    where d.storage_path = p_object_name
      and (
        (
          public.has_app_role('patient')
          and d.patient_id = public.current_patient_id()
        )
        or (
          public.has_app_role('doctor')
          and public.doctor_has_care_relationship(d.patient_id)
        )
      )
  );
$$;

comment on function public.can_read_patient_document_object(text) is
  'The storage policy predicate. Resolves an object key to its document row '
  'and applies the same rule as can_read_patient_document, so guessing a path '
  'gains nothing: an object with no row, or a row the caller could not read, '
  'is unreachable.';


-- ---------------------------------------------------------------------------
-- 8. Row-level security
-- ---------------------------------------------------------------------------

alter table public.patient_documents enable row level security;

-- The patient the document belongs to, at any status. An archived document
-- stays visible to them, marked archived: a patient who was told to disregard
-- a report needs to be able to see that it was withdrawn, and hiding it would
-- leave somebody following a paper copy with no way to find out.
create policy patient_documents_select_own
  on public.patient_documents
  for select
  to authenticated
  using (
    public.has_app_role('patient')
    and patient_id = public.current_patient_id()
  );

-- A practitioner with a care relationship to the patient. Scoped by the
-- relationship as well as by the role: holding the doctor role reaches
-- nothing on its own (section 55 and example 3).
create policy patient_documents_select_doctor_care
  on public.patient_documents
  for select
  to authenticated
  using (
    public.has_app_role('doctor')
    and public.doctor_has_care_relationship(patient_id)
  );

-- There is no insert, update or delete policy, for any role, and no grant
-- either - so such a write is refused at the privilege check before row-level
-- security is even consulted. A receptionist and an administrator have **no
-- policy at all**, which is a stronger statement than a predicate that
-- evaluates to false: a predicate can be weakened by an edit, an absent
-- policy cannot.


-- ---------------------------------------------------------------------------
-- 9. Grants
--
-- `anon` receives nothing.
--
-- The select grant is **column-scoped**, and the columns left out are
-- `uploaded_by` and `archived_by`. Column privileges belong to a database
-- role, and a patient and a doctor are both `authenticated`, so a column
-- readable by one is readable by the other - the trap Phase 10 recorded about
-- `internal_note`. Nothing on a screen needs an actor's account id; they are
-- an audit trail for the subsystem Phase 19 builds (sections 63-64).
-- ---------------------------------------------------------------------------

revoke all on public.patient_documents from anon, authenticated;
grant select (
  id,
  patient_id,
  uploaded_by_role,
  uploaded_by_practitioner_id,
  document_type,
  title,
  description,
  storage_path,
  file_name,
  mime_type,
  file_size,
  status,
  appointment_id,
  clinical_record_id,
  archived_at,
  archive_reason,
  created_at,
  updated_at
) on public.patient_documents to authenticated;


-- ---------------------------------------------------------------------------
-- 10. The private bucket
--
-- Sections 5, 23 and 24, and example 1. `public = false`, so there is no
-- permanent public URL and none can be constructed; the only way to the bytes
-- is a short-lived signed URL minted by the server after authorization.
--
-- The bucket carries the size limit and the type allowlist as well, which is
-- a third independent layer under the application's validation and the
-- table's check constraints. All three numbers are asserted to agree by
-- `src/config/documents.test.ts`.
--
-- `on conflict do update` rather than `do nothing`: if the bucket already
-- exists, this migration must still be the thing that decides it is private.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-documents',
  'patient-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- 11. Storage policies
--
-- Sections 57, 96 and 106, and the acceptance criterion "storage policies
-- prevent direct unauthorized access".
--
-- **One policy, and it is a select.** An authenticated user may read an
-- object in this bucket only when it resolves to a document row they could
-- have read - so an authenticated patient who guesses another patient's path
-- is refused by storage itself, not merely by the application.
--
-- There is deliberately **no insert, update or delete policy**, for any
-- client role. Every object is written by the server after it has
-- authenticated the caller, authorized them against the patient, validated
-- the file's signature and **generated** the path. A client that could write
-- into this bucket could choose its own path, which is precisely what
-- sections 8 and 61 forbid.
--
-- `anon` has no policy of any kind, so an anonymous request for a known
-- object key is refused.
-- ---------------------------------------------------------------------------

create policy patient_documents_objects_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'patient-documents'
    and public.can_read_patient_document_object(name)
  );


-- ---------------------------------------------------------------------------
-- 12. A patient uploading their own document
--
-- Section 48. The patient is derived from the session; the storage path is
-- recomputed and compared. The argument list carries no identity at all
-- beyond the document id the server generated.
-- ---------------------------------------------------------------------------

create function public.create_patient_document_as_patient(
  p_document_id uuid,
  p_document_type public.patient_document_type,
  p_title text,
  p_description text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_checksum text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  patient uuid;
  expected_path text;
  new_id uuid;
begin
  patient := public.assert_document_patient();

  expected_path := public.patient_document_storage_path(
    patient, p_document_id, p_mime_type
  );

  -- An unsupported type has no extension and therefore no canonical path, so
  -- this one check covers both "that is not a path we would have generated"
  -- and "that is not a type we accept".
  if expected_path is null or expected_path is distinct from p_storage_path then
    raise exception 'The document could not be stored.'
      using errcode = 'PV041';
  end if;

  insert into public.patient_documents (
    id, patient_id, uploaded_by, uploaded_by_role,
    document_type, title, description,
    storage_path, file_name, mime_type, file_size, checksum_sha256
  )
  values (
    p_document_id, patient, actor, 'patient',
    p_document_type,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    expected_path,
    btrim(p_file_name),
    p_mime_type,
    p_file_size,
    lower(btrim(p_checksum))
  )
  on conflict (id) do nothing
  returning id into new_id;

  if new_id is null then
    -- A retry of a request that already succeeded (section 51). Return the
    -- existing row rather than failing - but only if it is genuinely this
    -- patient's, otherwise a guessed id would become an oracle.
    select d.id into new_id
    from public.patient_documents d
    where d.id = p_document_id
      and d.patient_id = patient;

    if new_id is null then
      raise exception 'The document could not be stored.'
        using errcode = 'PV047';
    end if;
  end if;

  return new_id;
end;
$$;

comment on function public.create_patient_document_as_patient(uuid, public.patient_document_type, text, text, text, text, text, bigint, text) is
  'Records a document the signed-in patient uploaded for themselves. The '
  'patient is derived from the session - there is no patient parameter - and '
  'the storage path is recomputed and compared rather than trusted. '
  'Idempotent on the document id, so a retry does not create a second row.';


-- ---------------------------------------------------------------------------
-- 13. A practitioner uploading from a consultation
--
-- Section 47: the patient, the appointment and the clinical context are
-- **inherited from the consultation**, not typed by the doctor and not taken
-- from the request. The one identifier the caller supplies is the appointment
-- they are working in, and it is resolved by id *and* by the caller's own
-- practitioner record in one statement - so another practitioner's
-- appointment is indistinguishable from one that does not exist (section 18
-- and example 3).
-- ---------------------------------------------------------------------------

create function public.create_patient_document_as_practitioner(
  p_appointment_id uuid,
  p_document_id uuid,
  p_document_type public.patient_document_type,
  p_title text,
  p_description text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_checksum text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  practitioner uuid;
  appointment_patient uuid;
  record_id uuid;
  expected_path text;
  new_id uuid;
begin
  practitioner := public.assert_care_practitioner();

  select a.patient_id into appointment_patient
  from public.appointments a
  where a.id = p_appointment_id
    and a.practitioner_id = practitioner;

  if appointment_patient is null then
    raise exception 'Appointment not found.'
      using errcode = 'PV045';
  end if;

  -- The consultation, when one has been opened. Optional: a practitioner may
  -- legitimately attach a report to an appointment before starting the notes,
  -- and refusing that would invent a requirement nobody has asked for.
  -- Resolved by the caller's own practitioner record as well, so it can only
  -- ever be their own consultation.
  select cr.id into record_id
  from public.clinical_records cr
  where cr.appointment_id = p_appointment_id
    and cr.practitioner_id = practitioner;

  expected_path := public.patient_document_storage_path(
    appointment_patient, p_document_id, p_mime_type
  );

  if expected_path is null or expected_path is distinct from p_storage_path then
    raise exception 'The document could not be stored.'
      using errcode = 'PV041';
  end if;

  insert into public.patient_documents (
    id, patient_id, uploaded_by, uploaded_by_role, uploaded_by_practitioner_id,
    document_type, title, description,
    storage_path, file_name, mime_type, file_size, checksum_sha256,
    appointment_id, clinical_record_id
  )
  values (
    p_document_id, appointment_patient, actor, 'practitioner', practitioner,
    p_document_type,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    expected_path,
    btrim(p_file_name),
    p_mime_type,
    p_file_size,
    lower(btrim(p_checksum)),
    p_appointment_id,
    record_id
  )
  on conflict (id) do nothing
  returning id into new_id;

  if new_id is null then
    select d.id into new_id
    from public.patient_documents d
    where d.id = p_document_id
      and d.uploaded_by_practitioner_id = practitioner;

    if new_id is null then
      raise exception 'The document could not be stored.'
        using errcode = 'PV047';
    end if;
  end if;

  return new_id;
end;
$$;

comment on function public.create_patient_document_as_practitioner(uuid, uuid, public.patient_document_type, text, text, text, text, text, bigint, text) is
  'Records a document a practitioner uploaded from one of their own '
  'appointments. The patient and the clinical context are read out of the '
  'appointment, which is resolved by the caller''s own practitioner record - '
  'there is no patient, practitioner or clinical record parameter.';


-- ---------------------------------------------------------------------------
-- 14. Archiving
--
-- Section 34. Never a delete: the row, the file, the reason and the whole
-- history survive, and the storage object is untouched.
--
-- **Only the uploader may archive.** That is the clean reading of section 34's
-- two rules at once - a patient cannot withdraw a document their clinician
-- put on their record, and a clinician cannot quietly remove a report the
-- patient supplied. Anything wider needs a product decision and an audit
-- trail.
-- ---------------------------------------------------------------------------

create function public.archive_patient_document(
  p_document_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  updated uuid;
begin
  if actor is null then
    raise exception 'Authentication required.'
      using errcode = 'insufficient_privilege';
  end if;

  if not (public.has_app_role('patient') or public.has_app_role('doctor')) then
    raise exception 'This operation is not available to this account.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Resolved by id **and** by the caller being the uploader, in one
  -- statement, so somebody else's document is indistinguishable from one that
  -- does not exist (section 76).
  update public.patient_documents d
  set status = 'archived',
      archived_at = now(),
      archived_by = actor,
      archive_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where d.id = p_document_id
    and d.uploaded_by = actor
    and d.status = 'active'
  returning d.id into updated;

  if updated is null then
    raise exception 'That document could not be archived.'
      using errcode = 'PV040';
  end if;
end;
$$;

comment on function public.archive_patient_document(uuid, text) is
  'Withdraws a document from the working record. A status change, never a '
  'delete: the metadata, the reason and the storage object all survive. Only '
  'the account that uploaded the document may archive it.';


-- ---------------------------------------------------------------------------
-- 15. Function grants
--
-- Every write function is revoked from `public` and granted to
-- `authenticated` only; each one then refuses an unauthorized caller inside
-- the database before it reads or writes anything. The gate and the two
-- access predicates are **not** granted to any client role - they exist for
-- row-level security and the storage policy, and are not an API a caller
-- could use to probe which documents exist.
-- ---------------------------------------------------------------------------

revoke all on function public.create_patient_document_as_patient(uuid, public.patient_document_type, text, text, text, text, text, bigint, text) from public;
grant execute on function public.create_patient_document_as_patient(uuid, public.patient_document_type, text, text, text, text, text, bigint, text) to authenticated;

revoke all on function public.create_patient_document_as_practitioner(uuid, uuid, public.patient_document_type, text, text, text, text, text, bigint, text) from public;
grant execute on function public.create_patient_document_as_practitioner(uuid, uuid, public.patient_document_type, text, text, text, text, text, bigint, text) to authenticated;

revoke all on function public.archive_patient_document(uuid, text) from public;
grant execute on function public.archive_patient_document(uuid, text) to authenticated;

revoke all on function public.assert_document_patient() from public;
revoke all on function public.can_read_patient_document(uuid) from public;
revoke all on function public.can_read_patient_document_object(text) from public;
revoke all on function public.patient_document_extension(text) from public;
revoke all on function public.patient_document_storage_path(uuid, uuid, text) from public;
