# Phase 12 — Clinical Records & Consultation Management

## 1. Phase Objective

Build the secure, structured, production-quality **Clinical Records and Consultation Management** system for Punarvasu.

This phase introduces the first true clinical/medical data into the platform.

The system must allow an authorized doctor to conduct and document a consultation while ensuring that sensitive clinical information is:

* private
* correctly associated with the patient
* correctly associated with the practitioner
* protected by authorization
* protected by Supabase/PostgreSQL RLS
* validated server-side
* auditable in a future-compatible manner
* separated from appointments, prescriptions, documents, and AI

The core workflow becomes:

```text
Doctor
  ↓
Appointment
  ↓
Start Consultation
  ↓
Clinical Record
  ↓
Save / Update
  ↓
Complete Consultation
```

The resulting clinical record will become the foundation for:

```text
Phase 13 → Prescription & Treatment Plans
Phase 14 → Patient Documents
Phase 17 → AI Clinical Decision Support
```

---

# 2. Critical Data Boundary

The following distinction must remain explicit throughout implementation.

## Appointment

An appointment represents:

```text
When care is scheduled
Who is expected
With which practitioner
What type of appointment
What operational status
```

Examples:

```text
Date
Time
Practitioner
Appointment type
Status
```

---

## Clinical Record

A clinical record represents:

```text
What happened during care
What the patient reported
What the practitioner observed
What was assessed
What was decided clinically
```

Examples:

```text
Chief complaint
History
Symptoms
Clinical observations
Assessment
Diagnosis/clinical impression
Doctor notes
Follow-up plan
```

Clinical records must NOT be stored inside the appointment table merely because the appointment initiated the consultation.

---

# 3. Relationship With Previous Phases

```text id="8qv7h8"
Phase 06
Authentication
      ↓
Phase 07
Patient Profile
      ↓
Phase 08
Authorization
      ↓
Phase 09
Appointment Engine
      ↓
Phase 10
Receptionist Workspace
      ↓
Phase 11
Doctor Workspace
      ↓
Phase 12
Clinical Records
```

Phase 12 depends heavily on:

* authenticated identity
* patient profile
* role/permission architecture
* appointment relationships
* doctor/practitioner identity

Do not bypass any of these layers.

---

# 4. Clinical Data Sensitivity

Clinical records are highly sensitive.

Treat them as a significantly higher-risk data category than:

* public website content
* appointment availability
* general contact information

Clinical records must never be:

* publicly accessible
* included in public SEO
* exposed in URLs unnecessarily
* stored in localStorage
* included in analytics events
* returned unnecessarily by generic APIs
* exposed to unauthorized staff
* exposed through client-side role spoofing

---

# 5. Clinical Record Ownership

A clinical record must be associated with:

```text id="n2zv8v"
Patient
+
Practitioner
+
Consultation / Appointment
```

Conceptually:

```text
clinical_records
--------------------------------
id
patient_id
practitioner_id
appointment_id
created_at
updated_at
```

The exact schema may evolve.

---

# 6. Appointment Relationship

A consultation should normally originate from an appointment.

Conceptually:

```text id="6c6a6j"
Appointment
      ↓
Consultation
      ↓
Clinical Record
```

This provides context and prevents orphaned clinical encounters.

The database should enforce appropriate relationships.

---

# 7. One Consultation Per Appointment

Unless the business requirements explicitly say otherwise, an appointment should correspond to at most one primary consultation record.

Prefer a database constraint such as:

```text id="w25d8o"
UNIQUE(appointment_id)
```

where appropriate.

This prevents accidental duplication caused by:

* double-clicks
* repeated requests
* browser retries
* concurrent requests

---

# 8. Patient Association

The clinical record must reference the canonical patient profile.

Do not duplicate:

```text id="z6a7iq"
patient name
phone
date of birth
```

inside the clinical record as the source of truth.

The record should reference:

```text id="hj8r1c"
patient_id
```

and retrieve profile information through the appropriate relationship.

---

# 9. Practitioner Association

The record must reference the canonical practitioner identity.

Do not store:

```text id="1t8j8d"
doctor_name = "Dr. Example"
```

as the authoritative practitioner identity.

Use the application's practitioner/staff model established by previous phases.

---

# 10. Clinical Record Structure

The clinical record should be structured rather than being one giant text field.

A possible conceptual structure:

```text id="g0p3xv"
Clinical Record
├── Encounter information
├── Chief complaint
├── History / patient-reported information
├── Symptoms
├── Clinical observations
├── Assessment / clinical impression
├── Diagnosis where appropriate
├── Doctor notes
├── Follow-up plan
└── Consultation status
```

The exact clinical fields should be based on actual clinic requirements.

Do not invent a medically authoritative template merely to populate the UI.

---

# 11. Ayurvedic Clinical Context

Because Punarvasu is an Ayurvedic platform, the clinical model should be flexible enough to represent Ayurvedic consultation information where required.

Potential future fields could include:

```text id="z9sk3x"
Prakriti
Vikriti
Agni
Ahara / dietary observations
Lifestyle observations
Ayurvedic assessment
```

However:

**Do not automatically implement every Ayurvedic concept as a structured clinical field without confirmed product/doctor requirements.**

The data model should avoid forcing practitioners into an overly rigid template.

---

# 12. Clinical Template Philosophy

The system should balance:

```text id="f4h20j"
Structure
+
Clinical flexibility
```

Structured fields improve:

* consistency
* future reporting
* validation
* search
* AI input quality
* interoperability

Free-text fields provide:

* clinical flexibility
* nuanced practitioner notes
* information not captured by predefined fields

Use both appropriately.

---

# 13. Recommended Initial Clinical Fields

The initial implementation may include fields such as:

```text id="z4x9g1"
chief_complaint
history_of_presenting_concern
symptoms
clinical_observations
assessment
diagnosis_or_clinical_impression
doctor_notes
follow_up_notes
```

The exact naming should follow the project's coding conventions.

Do not introduce unnecessary medical fields without a documented requirement.

---

# 14. Clinical Record Status

Use an explicit lifecycle.

Recommended:

```text id="5b3c9y"
draft
completed
```

Potential future states:

```text id="g7t4x9"
amended
```

if the system later supports formal amendments.

Avoid excessive status complexity at this stage.

---

# 15. Draft Clinical Records

Doctors may need to save a consultation before completing it.

Therefore:

```text id="7d6v4m"
draft
```

must be supported.

Example:

```text
Doctor starts consultation
      ↓
Enters chief complaint
      ↓
Saves draft
      ↓
Returns later
      ↓
Continues
      ↓
Completes
```

---

# 16. Completed Clinical Records

A completed record indicates that the consultation documentation has been completed according to the application's workflow.

Once completed, normal editing should be restricted.

Do not allow unrestricted silent overwriting of completed medical records.

---

# 17. Amendments

A future clinical system may need formal amendments.

For example:

```text id="5m6c91"
Original record
      ↓
Amendment
      ↓
Reason
      ↓
Actor
      ↓
Timestamp
```

Full amendment/audit infrastructure can be implemented in Phase 19 if not already present.

Phase 12 must not architect the system in a way that makes future amendment history impossible.

---

# 18. Clinical Record Creation

A doctor should be able to start a clinical record from an eligible appointment.

Flow:

```text id="5z8s8b"
Doctor Dashboard
      ↓
Today's Appointment
      ↓
Open Appointment
      ↓
Start Consultation
      ↓
Clinical Record
```

Before creation, verify:

* authenticated user
* doctor permission
* practitioner identity
* appointment exists
* appointment belongs to/permits this doctor
* patient exists
* appointment is eligible for consultation
* no duplicate consultation already exists

---

# 19. Server-Side Authorization

Every clinical operation must independently authorize the current doctor.

Example:

```text id="7y4j8s"
createClinicalRecord(appointmentId)
```

must perform:

```text
Authenticate
      ↓
Require doctor permission
      ↓
Resolve practitioner identity
      ↓
Load appointment
      ↓
Verify doctor → appointment relationship
      ↓
Verify patient relationship
      ↓
Create record
      ↓
RLS
```

Never trust the client to tell the server:

```text
"This appointment belongs to me."
```

---

# 20. Clinical Record Access

A doctor should only be able to access clinical records they are authorized to access.

Depending on the clinic's policy, access may be:

### Practitioner-scoped

Doctor sees records they authored or are assigned to.

### Care-team scoped

Doctor sees records belonging to patients within their permitted care relationship.

### Clinic-wide clinical access

All authorized doctors can view clinic clinical records.

The actual policy must be explicitly documented and implemented.

Do not assume the broadest access because it is easier.

---

# 21. Patient Access

Patient access to clinical records must be explicitly designed.

Do not automatically expose every clinical field to patients merely because the patient owns the underlying profile.

Some clinical records may contain:

* practitioner-only notes
* internal clinical reasoning
* sensitive information
* information not intended for direct patient display

If patient access is required, create a deliberate patient-facing projection/view rather than exposing the doctor-facing clinical record wholesale.

---

# 22. Receptionist Access

Receptionists must NOT automatically receive access to clinical records.

For example:

```text id="q8quk5"
Receptionist
→ Appointment information
→ Basic operational patient information

Receptionist
✕ Clinical assessment
✕ Diagnosis
✕ Doctor notes
✕ Clinical history
```

Do not weaken this boundary for convenience.

---

# 23. Admin Access

Admin role does not automatically mean unrestricted clinical access.

Administrative capabilities and clinical access are separate concepts.

If administrators require clinical access later, that should be explicitly authorized and audited.

---

# 24. Clinical Record RLS

RLS is mandatory.

Do not rely only on:

```text id="6m4f5x"
requireRole("doctor")
```

in server code.

Database policies must also prevent unauthorized access.

---

# 25. RLS Example

Conceptually:

```text id="r9o8ra"
Doctor A
→ permitted clinical record
= ALLOWED

Doctor A
→ unauthorized clinical record
= DENIED

Receptionist
→ clinical record
= DENIED

Patient
→ doctor-only clinical record
= DENIED
```

If a future patient-facing projection is implemented, its RLS must be separately designed.

---

# 26. Clinical Data Querying

Do not expose:

```text id="3d2gtr"
SELECT *
```

for clinical records.

Explicitly select required fields.

Separate:

```text id="m8u5g4"
doctor clinical view
```

from:

```text id="q4zqjo"
patient-safe view
```

where appropriate.

---

# 27. Consultation Screen

The consultation screen should provide a focused clinical workspace.

Recommended structure:

```text id="3k1w4v"
Patient Header
      ↓
Appointment Context
      ↓
Clinical Record
  ├─ Chief Complaint
  ├─ History
  ├─ Symptoms
  ├─ Observations
  ├─ Assessment
  ├─ Diagnosis / Clinical Impression
  └─ Notes
      ↓
Save Draft / Complete Consultation
```

Use progressive disclosure where appropriate.

Do not overwhelm the doctor with a giant form.

---

# 28. Patient Header

The clinical screen should clearly identify the patient.

Display only appropriate information:

```text id="8n4p9d"
Patient Name
Date of Birth / Age
Appointment Type
Appointment Date
Practitioner
```

Be careful with age.

If age is displayed, derive it from date of birth rather than storing mutable age.

---

# 29. Patient Identity Confirmation

Because clinical data is highly sensitive, provide clear patient identity context.

The doctor should be able to verify:

```text id="j8i0om"
"This is the correct patient."
```

Avoid relying only on a tiny name label.

---

# 30. Appointment Context

Show:

```text id="h7r9hf"
Appointment date
Appointment type
Practitioner
Status
```

Do not duplicate the entire appointment object into the clinical record.

---

# 31. Clinical Form

Use appropriate controls:

* textareas for narrative notes
* structured fields for discrete information
* checkboxes/selects only when medically/product justified
* date controls where required
* clear section headings

Avoid excessive dropdowns.

Clinical documentation should be efficient.

---

# 32. Autosave

Autosave is useful for clinical workflows but introduces complexity.

If implemented:

* save drafts only
* clearly indicate save status
* debounce writes
* prevent race conditions
* handle offline/network failure carefully
* never silently overwrite newer content
* never claim data was saved when it wasn't

A reliable explicit:

```text
Save Draft
```

is preferable to a fragile autosave system.

---

# 33. Save Draft

The doctor should receive clear feedback:

```text id="z6x5xy"
Saving...
Saved just now
```

or:

```text id="l9x1od"
Unable to save.
Your changes have not been saved.
```

Never display:

```text id="0ov3w2"
Saved
```

if the server operation failed.

---

# 34. Concurrent Editing

The system should consider whether two doctors/users can edit the same clinical record.

At minimum:

* prevent accidental overwrite
* track `updated_at`
* use optimistic concurrency/versioning if practical
* return conflict when stale data is submitted

Example:

```text id="5m6a0f"
This clinical record was updated elsewhere.
Reload before saving your changes.
```

Do not silently overwrite newer clinical information.

---

# 35. Completion

Completing a consultation should be deliberate.

Example:

```text id="f7zz5k"
[Complete Consultation]
```

Before completion:

```text
Complete this consultation?

After completion, editing may be restricted.
```

The exact edit policy must be documented.

---

# 36. Validation

Validate clinical input server-side.

Examples:

* text length limits
* required fields where clinically/product-required
* valid dates
* safe character handling
* maximum payload size

Do not impose arbitrary medical restrictions.

Validation should protect data quality and system stability.

---

# 37. Required vs Optional Clinical Fields

Do not make every field mandatory.

A clinical record should define explicit required fields based on actual workflow.

For example:

```text
Chief complaint → potentially required
Assessment → potentially required before completion
Doctor notes → potentially optional
```

The final requirements must come from clinic workflow.

---

# 38. Draft Validation vs Completion Validation

Drafts may permit incomplete data.

Example:

```text id="s4v9se"
Draft:
Chief complaint = filled
Assessment = empty
```

This may be valid.

Completion may require:

```text id="g4f5tr"
Chief complaint
Assessment
```

if those fields are defined as required.

This distinction should be implemented explicitly.

---

# 39. Clinical History

Doctors will eventually need historical records.

Phase 12 should provide a secure clinical history view.

Potential structure:

```text id="v3a2ip"
Clinical History

18 Sep 2026
Initial Consultation
Dr. A
Completed

02 Aug 2026
Follow-up
Dr. A
Completed
```

The detail view may show clinical content only when authorized.

---

# 40. Clinical Record Timeline

A timeline can make historical care easier to understand.

Example:

```text id="8bq3v9"
18 Sep
Consultation
      ↓
02 Aug
Follow-up
      ↓
10 Jul
Initial Consultation
```

Keep the design clinically readable rather than decorative.

---

# 41. Search Clinical Records

Do not implement unrestricted clinical full-text search unless necessary.

If search is required, ensure:

* strict authorization
* bounded queries
* minimal results
* no cross-patient leakage
* no public indexing

Clinical search should be treated as a high-sensitivity operation.

---

# 42. Clinical Notes Privacy

Do not put clinical notes into:

* URL query parameters
* analytics events
* browser logs
* error telemetry
* notification payloads unnecessarily

For example, never send:

```text id="h4k6pq"
analytics.track("consultation_saved", {
  notes: clinicalNotes
});
```

---

# 43. Logging

Application logs must not contain complete clinical records.

Bad:

```text id="w6u3qk"
console.log("Clinical record:", record);
```

Good:

```text id="2s5d3h"
logger.info({
  event: "clinical_record_saved",
  recordId,
  actorId
});
```

Even identifiers should be logged only where operationally necessary.

---

# 44. Error Handling

Never expose:

```text id="j4e5f1"
Postgres policy error
RLS failure
SQL statement
stack trace
```

to the doctor.

Use:

```text id="0i6l8f"
We couldn't save the clinical record.
Please try again.
```

while retaining useful diagnostic information securely in server logs.

---

# 45. Data Retention

Do not implement automatic deletion of clinical records.

Clinical data retention requirements are domain-sensitive and should be explicitly defined.

Avoid adding:

```text id="c0q31f"
Delete clinical record
```

unless the product and legal requirements explicitly require it.

---

# 46. Hard Delete

Do not physically delete completed clinical records through normal UI actions.

If deletion is ever required, it should be governed by a dedicated policy and audit mechanism.

---

# 47. Clinical Record Versioning

A full versioning system is not mandatory if deferred to Phase 19.

However, the schema should retain:

```text id="6w93lq"
created_at
updated_at
```

and avoid designs that make future amendment history impossible.

---

# 48. Prescription Boundary

Clinical records may eventually lead to:

```text id="5sfj8m"
Prescription
Treatment Plan
```

But those belong to Phase 13.

Do not embed prescription information into:

```text id="o8r0x4"
clinical_records.doctor_notes
```

as a substitute for the prescription model.

---

# 49. Document Boundary

Do not store:

```text id="f0gh8a"
lab reports
images
PDFs
prescription scans
```

inside clinical record text.

Phase 14 owns secure document storage.

Clinical records may reference future documents by controlled relationship.

---

# 50. AI Boundary

Do not implement AI-generated:

* diagnosis
* clinical assessment
* treatment recommendations
* summaries
* prescriptions

in Phase 12.

Phase 17 will provide AI decision support with:

```text id="m6w8b4"
Doctor
+
Clinical Data
+
AI Assistance
+
Doctor Review
```

The AI must never become the final clinical decision maker.

---

# 51. Receptionist Workspace Integration

Phase 10 should remain operational.

Do not expose clinical records in the receptionist workspace merely because both workflows reference the same patient.

---

# 52. Doctor Dashboard Integration

Phase 11 should link into Phase 12.

Expected flow:

```text id="0g6t7u"
Doctor Dashboard
      ↓
Appointment
      ↓
Start Consultation
      ↓
Clinical Record
```

Do not duplicate doctor navigation or patient context unnecessarily.

---

# 53. Patient Portal Integration

A future patient experience may show selected clinical information.

Do not expose doctor clinical records to patients by default.

Phase 12 should establish the internal clinical model first.

---

# 54. Security Architecture

Every clinical operation must use:

```text id="7g4r2j"
Authentication
+
Authorization
+
Resource relationship
+
Server validation
+
RLS
```

No single layer should be treated as sufficient.

---

# 55. Authorization Flow

Example:

```text id="5klx50"
Doctor Browser
      ↓
Server Action / Route
      ↓
Authenticated User
      ↓
Require Doctor Permission
      ↓
Resolve Practitioner
      ↓
Validate Appointment / Patient Relationship
      ↓
Validate Clinical Input
      ↓
Database Operation
      ↓
RLS
```

---

# 56. Prevent Client-Side Clinical Access Bypass

This must NOT work:

```text id="a5p0j3"
Change patientId in request
→ retrieve another patient's clinical record
```

Nor:

```text id="9a9ozw"
Change doctorId
→ become another doctor
```

Nor:

```text id="7n2r5c"
Set role=doctor in request
→ gain clinical access
```

---

# 57. IDOR Testing

Mandatory tests:

```text id="k8y2ur"
Doctor A
→ Record A = ALLOWED

Doctor A
→ Record B without authorization = DENIED

Receptionist
→ Record A = DENIED

Patient
→ Doctor-only record = DENIED
```

If patient-facing access is intentionally implemented, test only the approved patient-visible projection.

---

# 58. Cross-Patient Testing

Create:

```text id="5r9m0n"
Patient A
Patient B
```

and verify:

```text id="3k8qye"
Doctor with access to Patient A
→ Patient A clinical record = ALLOWED

Doctor
→ Patient B clinical record = DENIED
```

according to the defined care relationship.

---

# 59. Cross-Doctor Testing

Create:

```text id="t0f6m2"
Doctor A
Doctor B
```

and verify according to the chosen access policy.

If practitioner-scoped:

```text
Doctor A → Doctor A records = ALLOWED
Doctor A → Doctor B restricted records = DENIED
```

If clinic-wide clinical access is intentionally chosen, document and test that instead.

---

# 60. Clinical Data Exposure Testing

Verify clinical data does NOT appear in:

* public pages
* patient search results intended only for operations
* receptionist screens
* analytics payloads
* browser storage
* URL parameters
* server logs unnecessarily
* error messages

---

# 61. Database Constraints

Use constraints where they protect data integrity.

Examples:

```text id="7m6y6q"
patient_id NOT NULL
practitioner_id NOT NULL
appointment_id NOT NULL
status NOT NULL
```

and:

```text id="v0n0m5"
UNIQUE(appointment_id)
```

where one consultation per appointment is required.

---

# 62. Foreign Keys

Clinical records should have proper foreign keys to:

```text id="8o6j79"
patient_profiles
practitioners
appointments
```

Use appropriate delete behavior.

Avoid cascading deletion that could unintentionally destroy clinical history.

---

# 63. Indexes

Consider indexes on:

```text id="d7dd1j"
patient_id
practitioner_id
appointment_id
created_at
status
```

Use actual query patterns to finalize indexes.

Do not add unnecessary indexes.

---

# 64. Patient Clinical History Query

A common query:

```text id="0yb0sg"
patient
→ authorized clinical records
→ ordered newest first
```

must be efficient and securely scoped.

Do not query all clinical records and filter in JavaScript.

---

# 65. Doctor Clinical History Query

For a doctor:

```text id="d7v7cl"
doctor
→ authorized patient
→ clinical history
```

must enforce authorization before returning data.

---

# 66. Clinical Form UX

The consultation screen should avoid the feeling of filling out a generic enterprise form.

Use:

* clear section hierarchy
* logical grouping
* generous but efficient spacing
* readable typography
* persistent patient identity context
* clear save state
* unobtrusive status indicators

The doctor should be able to focus on the consultation.

---

# 67. Unsaved Changes

If the doctor has unsaved changes and attempts to leave:

```text id="v3ndu5"
You have unsaved changes.

Leave without saving?
```

Provide:

```text id="m8h6x1"
Stay
Save & Leave
Leave Without Saving
```

where technically appropriate.

Do not rely solely on browser unload behavior.

---

# 68. Navigation Safety

Avoid accidental navigation away from a clinical record.

Especially protect against:

* back button
* sidebar navigation
* appointment switching
* browser refresh

when unsaved changes exist.

---

# 69. Save Feedback

Use clear status:

```text id="l4g2cz"
Saved
Saving...
Unsaved changes
Save failed
```

Do not use vague toast messages that disappear before the doctor can understand whether clinical information was actually persisted.

---

# 70. Clinical Completion

When completing the consultation:

1. Validate required fields.
2. Confirm doctor authorization.
3. Verify record state.
4. Save final changes.
5. Transition status.
6. Return authoritative server state.

Do not allow:

```text id="b2i9y5"
UI says Completed
```

while the database remains draft.

---

# 71. Transactional Operations

Where multiple changes occur together, use appropriate transaction semantics.

Example:

```text id="h3p4t8"
Save clinical record
+
Complete consultation
+
Update appointment status
```

If the business workflow requires these to succeed together, perform them atomically.

Do not leave the database in an inconsistent state.

---

# 72. Appointment Status Integration

The consultation workflow may interact with appointment status.

For example:

```text id="b8m4j7"
confirmed
    ↓
consultation
    ↓
completed
```

The exact status transition must follow Phase 09 rules.

Do not create a second appointment status system inside clinical records.

---

# 73. Clinical Record vs Appointment Completion

Be explicit about the relationship.

Possible model:

```text id="b4w4tj"
Clinical Record = completed
        +
Appointment = completed
```

The transition logic must be defined so the two cannot accidentally disagree.

If they can legitimately differ, document why.

---

# 74. Clinical Record API

Potential operations:

```text id="q9z9as"
getClinicalRecord()
createClinicalRecord()
updateClinicalRecord()
saveClinicalDraft()
completeClinicalRecord()
getPatientClinicalHistory()
```

Only implement operations required by the current workflow.

---

# 75. Server Actions / Routes

Follow the existing architecture.

Every endpoint must:

* authenticate
* authorize
* validate
* apply business rules
* use safe data access
* enforce RLS
* return safe errors

---

# 76. API Response Minimization

Do not return:

```text id="0w5u6z"
entire patient object
entire appointment object
entire clinical history
```

from every clinical operation.

Return only what the UI needs.

---

# 77. Caching

Clinical records must not be publicly cached.

Be careful with:

* Next.js caching
* browser cache
* fetch caching
* route caching
* CDN caching

Private clinical routes should be treated as dynamic/private.

---

# 78. Next.js Server/Client Boundary

Prefer server components and server-side data fetching where appropriate.

Client components should exist only where interactivity requires them.

Do not make the entire clinical application client-rendered merely to manage form state.

---

# 79. Browser Storage

Never store clinical records in:

```text id="d6qk3n"
localStorage
sessionStorage
IndexedDB
```

unless a future explicitly designed offline clinical workflow requires it with a comprehensive security model.

That is out of scope for Phase 12.

---

# 80. Telemetry

Do not send clinical content to:

* product analytics
* performance telemetry
* error tracking metadata
* third-party monitoring payloads

without explicit privacy/security justification.

---

# 81. Accessibility

Clinical forms must support:

* keyboard navigation
* semantic labels
* accessible validation
* visible focus
* proper heading hierarchy
* screen-reader compatibility
* sufficient contrast
* error association
* accessible dialogs

Long clinical forms should provide clear section navigation.

---

# 82. Responsive Design

Test at:

```text id="v5y2c0"
320px
375px
390px
430px
768px
1024px
1280px
1440px+
```

The clinical form should remain usable on tablets and laptops.

Avoid requiring horizontal scrolling for core clinical fields.

---

# 83. Mobile Clinical UX

If doctors use tablets:

* fields should have appropriate touch targets
* textareas should be comfortable to use
* patient context should remain visible
* save state should remain obvious
* navigation should not hide critical actions

Do not compress everything into tiny controls.

---

# 84. Performance

Clinical records may become large.

Design queries to:

* fetch only required data
* paginate history where appropriate
* avoid loading all historical records initially
* avoid repeated patient queries
* use indexes
* avoid unnecessary client re-renders

---

# 85. Security Tests

Mandatory:

### Authentication

```text
Unauthenticated → clinical record = DENIED
```

### Authorization

```text
Patient → doctor clinical record = DENIED
Receptionist → clinical record = DENIED
Unauthorized doctor → record = DENIED
Authorized doctor → record = ALLOWED
```

### IDOR

```text
Change recordId → unauthorized record remains inaccessible
```

### Ownership

```text
Change patientId → unauthorized patient remains inaccessible
```

### Practitioner spoofing

```text
Change doctorId → cannot impersonate another practitioner
```

### Payload manipulation

```text
Change status
Change patient
Change practitioner
Change appointment
```

must all be server-validated.

---

# 86. RLS Tests

Test database access directly.

At minimum:

```text id="z0y7i6"
Doctor A → authorized record = ALLOWED
Doctor A → unauthorized record = DENIED
Receptionist → clinical record = DENIED
Patient → doctor-only record = DENIED
```

If patient-visible projections are introduced, test those separately.

---

# 87. Concurrency Tests

Test:

```text id="f0x2f5"
Two requests creating consultation for same appointment
```

Expected:

```text
At most one clinical record succeeds.
```

Also test:

```text
Two updates to same record
```

and ensure stale data does not silently overwrite newer clinical information.

---

# 88. Security Regression

Verify Phase 07 and Phase 10 continue to work.

Clinical records must not accidentally weaken:

* patient profile RLS
* appointment RLS
* receptionist boundaries
* doctor authorization

---

# 89. Few-Shot Examples

## Example 1 — Clinical Data in Appointment

### Bad

```text
appointments
-------------------------
patient_id
doctor_id
diagnosis
doctor_notes
prescription
```

### Good

```text
appointments
-------------------------
patient_id
practitioner_id
appointment_type
start_at
end_at
status

clinical_records
-------------------------
patient_id
practitioner_id
appointment_id
assessment
notes
...
```

---

## Example 2 — Authorization

### Bad

```ts
if (user.role === "doctor") {
  return getClinicalRecord(recordId);
}
```

### Good

```text
Authenticate
→ Require clinical-record permission
→ Resolve practitioner
→ Verify patient/appointment relationship
→ Query permitted record
→ RLS
```

---

## Example 3 — Doctor ID

### Bad

```json
{
  "doctorId": "doctor-b",
  "recordId": "record-123"
}
```

Trusting `doctorId`.

### Good

```text
doctorId
→ derived from authenticated user
```

---

## Example 4 — Patient ID

### Bad

```json
{
  "patientId": "patient-b",
  "recordId": "record-a"
}
```

and trusting the relationship.

### Good

```text
recordId
→ load record
→ verify authorized doctor relationship
→ use canonical patient association
```

---

## Example 5 — Completed Record

### Bad

```text
Completed
→ doctor can silently overwrite anything
```

### Good

```text
Completed
→ normal editing restricted
→ future amendment workflow can preserve history
```

---

## Example 6 — Draft

### Bad

```text
Save
→ require every clinical field
```

### Good

```text
Draft
→ allow incomplete documentation

Complete
→ validate required fields
→ save
→ transition state
```

---

## Example 7 — Clinical Logs

### Bad

```ts
logger.info({
  clinicalRecord
});
```

### Good

```ts
logger.info({
  event: "clinical_record_saved",
  recordId,
  actorId
});
```

without unnecessary clinical content.

---

## Example 8 — Patient Access

### Bad

```text
Patient owns profile
→ therefore return entire clinical record
```

### Good

```text
Doctor clinical record
≠
Patient-facing clinical view
```

If patient access is introduced, explicitly define and authorize the patient-visible representation.

---

## Example 9 — Completion

### Bad

```text
User clicks Complete
→ UI changes status
→ database update happens later
```

### Good

```text
Complete request
→ authorize
→ validate
→ persist
→ receive authoritative state
→ UI reflects actual state
```

---

# 90. Expected Architectural Areas

Adapt to the existing repository:

```text
src/
  app/
    doctor/
      consultations/
        [appointmentId]/
          page.tsx

  components/
    clinical/
      consultation-form.tsx
      clinical-section.tsx
      clinical-record-status.tsx
      patient-clinical-header.tsx
      save-status.tsx
      clinical-history.tsx

  server/
    clinical/
      queries.ts
      mutations.ts
      authorization.ts
      validation.ts

  lib/
    clinical/

supabase/
  migrations/
    ...clinical_records...
```

Do not blindly create these exact directories.

Follow the architecture established in Phase 01.

---

# 91. Database Model

A conceptual model:

```text
clinical_records
--------------------------------
id
appointment_id
patient_id
practitioner_id

status

chief_complaint
history_of_presenting_concern
symptoms
clinical_observations
assessment
diagnosis_or_clinical_impression
doctor_notes
follow_up_notes

created_at
updated_at
```

This is a conceptual starting point, not a mandatory exact schema.

The final model should reflect verified product/doctor requirements.

---

# 92. Data Integrity

The database should prevent inconsistent relationships.

For example, where practical:

```text
clinical_record.appointment_id
```

must correspond to:

```text
clinical_record.patient_id
clinical_record.practitioner_id
```

rather than allowing arbitrary combinations.

Do not rely entirely on application code to maintain these relationships.

---

# 93. Appointment/Patient Consistency

Avoid this invalid state:

```text
Appointment
Patient A
Doctor A

Clinical Record
Appointment above
Patient B
Doctor C
```

The database/business layer must prevent inconsistent associations.

---

# 94. Migration Safety

Clinical database migrations must:

* be reversible where practical
* avoid destructive operations
* include constraints
* include RLS
* be tested against existing data
* preserve Phase 09/10/11 functionality

Do not modify production-like clinical tables without careful migration planning.

---

# 95. Seed Data

If development seed data is required:

* clearly mark it as synthetic
* do not use real patient information
* do not use realistic-looking sensitive data without labeling
* never commit real clinical information

---

# 96. Test Data

Automated tests should use synthetic patients and synthetic clinical content.

Never commit real patient records into:

```text
tests/
fixtures/
seeds/
```

---

# 97. Privacy-Safe Development

Do not copy real clinical notes into:

* source code
* test snapshots
* screenshots
* documentation
* Git commits
* issue descriptions

Use synthetic examples.

---

# 98. Acceptance Criteria

Phase 12 is complete only when:

## Clinical Model

* [ ] Clinical record schema exists.
* [ ] Patient relationship is enforced.
* [ ] Practitioner relationship is enforced.
* [ ] Appointment relationship is enforced.
* [ ] Record status is constrained.
* [ ] Duplicate consultation creation is prevented.

## Consultation

* [ ] Doctor can start a consultation from an eligible appointment.
* [ ] Doctor can create a draft clinical record.
* [ ] Doctor can update a draft.
* [ ] Doctor can complete a record.
* [ ] Completion validation works.
* [ ] Invalid status transitions are rejected.

## Clinical History

* [ ] Authorized doctor can view permitted clinical history.
* [ ] Clinical history is securely scoped.
* [ ] Unauthorized records cannot be accessed.
* [ ] History is efficiently queried.

## Security

* [ ] Clinical data is protected by server authorization.
* [ ] RLS is enabled and tested.
* [ ] Cross-patient access is denied.
* [ ] Unauthorized doctor access is denied according to policy.
* [ ] Receptionist clinical access is denied.
* [ ] Client-controlled IDs cannot bypass authorization.
* [ ] Practitioner spoofing fails.
* [ ] Clinical data is not placed in browser storage.
* [ ] Clinical data is not leaked through logs/errors/analytics.
* [ ] Private routes are not publicly cacheable/indexable.

## Data Integrity

* [ ] Appointment/patient/practitioner relationships are consistent.
* [ ] Clinical records cannot be accidentally orphaned.
* [ ] Completed records are not silently overwritten.
* [ ] Concurrent creation is handled.
* [ ] Stale updates are handled appropriately.

## UX

* [ ] Consultation form is clear and clinically usable.
* [ ] Patient identity is visible.
* [ ] Appointment context is visible.
* [ ] Save status is clear.
* [ ] Unsaved changes are handled.
* [ ] Loading/error/empty states exist.
* [ ] Responsive design works.
* [ ] Accessibility requirements are met.

## Architecture

* [ ] Phase 08 authorization is reused.
* [ ] Phase 09 appointment engine is reused.
* [ ] Phase 11 doctor workspace integrates cleanly.
* [ ] No prescription logic exists.
* [ ] No document storage exists.
* [ ] No AI clinical logic exists.

## Engineering

* [ ] TypeScript remains strict.
* [ ] No unnecessary `any`.
* [ ] No unnecessary client components.
* [ ] Lint passes.
* [ ] Typecheck passes.
* [ ] Tests pass.
* [ ] Production build passes.

---

# 99. Definition of Done

Phase 12 is done when an authorized doctor can securely perform:

```text
Doctor Dashboard
      ↓
Appointment
      ↓
Start Consultation
      ↓
Create Clinical Record
      ↓
Save Draft
      ↓
Continue Editing
      ↓
Complete Consultation
      ↓
View Clinical History
```

while:

```text
Receptionist
    ✕
Clinical Records

Unauthorized Doctor
    ✕
Unauthorized Patient Records

Patient
    ✕
Doctor-only Clinical Record
```

The clinical data must be protected at both:

```text
Application Authorization
+
Database RLS
```

The system must be ready for:

```text
Phase 13 — Prescription & Treatment Plans
```

without redesigning the clinical record foundation.

---

# 100. Explicitly Out of Scope

Do NOT implement:

* Prescription generation
* Prescription management
* Medication database
* Treatment plans
* Clinical documents
* File uploads
* Lab report storage
* Notifications
* Analytics
* AI/Gemini
* AI diagnosis
* AI treatment recommendations
* AI prescription generation
* Payments
* Telemedicine
* Full compliance/audit subsystem
* Automatic deletion of clinical records

---

# 101. Final Verification

Run:

```text
lint
typecheck
tests
production build
```

Then manually verify:

```text
Doctor Login
    ↓
Doctor Dashboard
    ↓
Today's Appointment
    ↓
Start Consultation
    ↓
Enter Clinical Data
    ↓
Save Draft
    ↓
Reload
    ↓
Continue
    ↓
Complete Consultation
    ↓
View Clinical History
```

Verify security:

```text
Patient → clinical record = DENIED
Receptionist → clinical record = DENIED
Unauthorized doctor → record = DENIED
Authorized doctor → permitted record = ALLOWED
Changed patientId = DENIED
Changed doctorId = DENIED
Changed appointmentId = DENIED
Duplicate consultation = PREVENTED
Concurrent creation = SAFE
Stale update = SAFE
```

---

# 102. Completion Report

At completion, report:

## Implemented

* Clinical record model
* Consultation workflow
* Draft state
* Completion state
* Clinical history
* Doctor authorization
* RLS
* Security controls
* Clinical form
* Save-state handling
* Tests

## Database

Report:

```text
Tables:
Enums:
Constraints:
Indexes:
Foreign keys:
RLS policies:
Functions/RPCs:
```

## Security

Report:

```text
Authentication:
Authorization:
Cross-patient isolation:
Cross-doctor isolation:
Receptionist isolation:
IDOR:
RLS:
Clinical data leakage checks:
```

## Data Integrity

Report:

```text
Duplicate consultation prevention:
Appointment consistency:
Patient consistency:
Practitioner consistency:
Concurrent writes:
Stale update handling:
```

## Verification

```text
Lint:
Typecheck:
Tests:
Build:
```

## Deferred

List intentionally deferred clinical functionality.

## Phase Status

```text
Phase 12: COMPLETE
Ready for Phase 13: YES/NO
```

Do not begin Phase 13 during this phase.
