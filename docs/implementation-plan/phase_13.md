# Phase 13 — Prescription & Treatment Plans

## 1. Phase Objective

Build the secure, production-quality **Prescription & Treatment Plan** system for Punarvasu.

This phase extends the Phase 12 clinical consultation workflow by allowing an authorized doctor to create structured:

* prescriptions
* medicines/remedies
* dosage instructions
* frequency
* duration
* administration instructions
* treatment plans
* dietary/lifestyle recommendations where explicitly required
* follow-up recommendations

The system must clearly separate:

```text id="q1x9a3"
Clinical Record
        ↓
Doctor's Clinical Decision
        ↓
Prescription / Treatment Plan
```

The doctor remains the authoritative clinical decision-maker.

The system must NOT autonomously diagnose, prescribe, or make final treatment decisions.

AI functionality belongs to Phase 17.

---

# 2. Critical Architecture Boundary

Do not store prescriptions inside:

```text id="g3v4q7"
clinical_records.doctor_notes
```

and do not store treatment plans as arbitrary text attached to appointments.

Use dedicated domain models.

Recommended conceptual structure:

```text id="8t7j91"
Patient
   │
   ├── Appointment
   │       │
   │       └── Clinical Record
   │               │
   │               ├── Prescription
   │               │      └── Prescription Items
   │               │
   │               └── Treatment Plan
   │
   └── Historical Prescriptions / Plans
```

This separation is essential for future:

* patient viewing
* printing
* PDF generation
* notifications
* refill/follow-up workflows
* reporting
* auditing
* AI assistance

---

# 3. Relationship With Previous Phases

```text id="z0h3x2"
Phase 09
Appointment
      ↓
Phase 11
Doctor Workspace
      ↓
Phase 12
Clinical Record
      ↓
Phase 13
Prescription & Treatment Plan
```

Phase 13 must reuse:

* Phase 08 authorization
* Phase 09 appointment engine
* Phase 12 clinical records
* Phase 11 doctor workspace

Do not duplicate these systems.

---

# 4. Prescription Philosophy

A prescription represents a doctor's explicit clinical instruction.

The platform must never imply:

```text id="e4r1n6"
Medicine selected
→ therefore automatically recommended
```

Instead:

```text id="f8a1t4"
Doctor selects/enters treatment
→ reviews instructions
→ confirms prescription
→ system records doctor's decision
```

---

# 5. Doctor as Final Decision Maker

The doctor must remain the final authority.

Correct:

```text id="p4x7f2"
Clinical information
       ↓
Doctor assessment
       ↓
Doctor creates prescription
       ↓
Doctor reviews
       ↓
Doctor signs/confirms
```

Incorrect:

```text id="k1d9r4"
Patient data
       ↓
System decides medicine
       ↓
Prescription automatically issued
```

---

# 6. No Autonomous Prescribing

The system must NOT:

* automatically prescribe medicines
* automatically generate final treatment
* automatically select dosage
* automatically select frequency
* automatically finalize a prescription
* automatically send an unreviewed prescription to a patient

Any future AI assistance must produce suggestions only and require explicit doctor review.

---

# 7. Prescription Model

Conceptually:

```text id="r3u6p9"
prescriptions
--------------------------------
id
patient_id
practitioner_id
appointment_id
clinical_record_id
status
issued_at
created_at
updated_at
```

The exact schema should follow the existing architecture.

---

# 8. Prescription Items

A prescription may contain multiple items.

Conceptually:

```text id="x7c1v5"
prescription_items
--------------------------------
id
prescription_id
medicine_id / medicine_name
form
strength
dose
frequency
route
timing
duration
quantity
instructions
sequence
```

Only fields required by the actual clinic workflow should be implemented.

---

# 9. Medicine / Remedy Model

If the clinic maintains a structured medicine/remedy catalog, create a controlled model such as:

```text id="q6s2x8"
medicines
--------------------------------
id
name
generic_name
form
strength
active
```

However, do not invent a complete Ayurvedic medicine catalog.

If no verified catalog exists, allow a doctor to enter a medicine/remedy name while keeping the architecture ready for a future controlled catalog.

---

# 10. Ayurvedic Remedies

Punarvasu may use:

* Ayurvedic medicines
* herbal preparations
* formulations
* therapies
* dietary recommendations
* lifestyle recommendations

The data model should be flexible enough to represent these appropriately.

Do not assume that every recommendation is a pharmaceutical-style medicine.

---

# 11. Prescription Status

Recommended initial lifecycle:

```text id="8r1qk5"
draft
issued
cancelled
```

Potential future status:

```text id="y3s6m8"
amended
```

if formal amendment/versioning is introduced.

---

# 12. Prescription Lifecycle

Recommended flow:

```text id="u8w3j2"
Draft
  ↓
Doctor Review
  ↓
Issued
```

An issued prescription should not be silently overwritten.

If correction is required, future amendment/versioning rules should preserve history.

---

# 13. Draft Prescription

Doctors may create a prescription while completing a consultation.

Example:

```text id="7x9r4c"
Clinical Record
      ↓
Add prescription
      ↓
Add medicine
      ↓
Save Draft
      ↓
Review
      ↓
Issue
```

Draft prescriptions should not be presented to patients as final prescriptions.

---

# 14. Issued Prescription

An issued prescription represents the doctor's finalized clinical instruction.

The system should capture:

* issuing practitioner
* issue timestamp
* patient
* associated consultation
* prescription items
* instructions
* status

---

# 15. Prescription Finalization

Issuing a prescription should be a deliberate operation.

Example:

```text id="p7d2f9"
[Issue Prescription]
```

Before finalization:

```text id="u5m8k3"
Issue this prescription?

Please verify medicines, dosage, frequency and duration.
```

The exact wording should be appropriate to the clinic workflow.

---

# 16. Final Review

Before issuing, provide a review summary:

```text id="k3v8y1"
Prescription

1. Medicine A
   Dose: ...
   Frequency: ...
   Duration: ...

2. Medicine B
   Dose: ...
   Frequency: ...
   Duration: ...

Instructions:
...
```

The doctor must explicitly confirm.

---

# 17. Required Prescription Fields

The final required fields must be based on clinic requirements.

Potential fields:

```text id="w4n2m8"
medicine/remedy
form
strength
dose
frequency
route
timing
duration
quantity
instructions
```

Do not make every field mandatory if certain Ayurvedic remedies do not require them.

---

# 18. Dosage Representation

Dosage must be structured enough for clarity.

Avoid relying only on:

```text id="p5g1v4"
"Take medicine as instructed"
```

when structured dosage is possible.

Potential model:

```text id="v9x2s1"
dose_amount
dose_unit
frequency
timing
duration_value
duration_unit
```

The exact model should support actual clinic requirements.

---

# 19. Frequency

Frequency may need to support:

```text id="a6c8m4"
Once daily
Twice daily
Three times daily
Morning
Evening
Before meals
After meals
At bedtime
As directed
```

Do not hard-code only pharmaceutical conventions if Ayurvedic treatment workflows require additional flexibility.

---

# 20. Timing

Timing instructions should be explicit where needed.

Examples:

```text id="t5j8x2"
Before breakfast
After lunch
Before meals
After meals
At bedtime
Morning and evening
```

Avoid ambiguous abbreviations where possible.

---

# 21. Duration

Support clear durations.

Examples:

```text id="d8v3q1"
5 days
2 weeks
1 month
Until follow-up
As directed
```

Do not make assumptions about treatment duration.

The doctor supplies the final instruction.

---

# 22. Quantity

If quantity is applicable:

```text id="z5c7r3"
quantity
quantity_unit
```

Examples:

```text id="p6g4y2"
10 tablets
100 ml
1 bottle
```

Only display/use quantity where meaningful.

---

# 23. Administration Route

If applicable:

```text id="r8f2w6"
oral
topical
nasal
other
```

The exact set should be controlled by the clinic's requirements.

Do not assume every Ayurvedic remedy has a standard pharmaceutical route.

---

# 24. Prescription Instructions

Allow free-text instructions for information that structured fields cannot capture.

Examples:

```text id="x5n8q4"
Take with warm water.
Use as directed by the practitioner.
Follow dietary instructions discussed during consultation.
```

Avoid using instructions as a substitute for all structured data.

---

# 25. Treatment Plan

A treatment plan is broader than a prescription.

It may include:

```text id="j8v4x2"
Diet
Lifestyle
Therapy
Exercise
Rest
Daily routine
Follow-up
Other practitioner instructions
```

The exact categories should be configurable.

---

# 26. Treatment Plan Model

Conceptually:

```text id="k6t9p3"
treatment_plans
--------------------------------
id
patient_id
practitioner_id
appointment_id
clinical_record_id
title
summary
status
start_date
target_follow_up_date
created_at
updated_at
```

The exact model should follow actual requirements.

---

# 27. Treatment Plan Items

A structured plan may contain items:

```text id="b3w8n6"
treatment_plan_items
--------------------------------
id
treatment_plan_id
category
title
instructions
frequency
duration
sequence
```

Categories could include:

```text id="r5q2k7"
diet
lifestyle
therapy
exercise
medication
follow_up
other
```

Only implement categories that are genuinely required.

---

# 28. Treatment Plan vs Prescription

Keep the concepts separate.

### Prescription

Specific therapeutic instruction:

```text id="w2p7d4"
Medicine
Dose
Frequency
Duration
```

### Treatment Plan

Broader care plan:

```text id="n8k3y5"
Diet
Lifestyle
Therapy
Medicine
Follow-up
```

A treatment plan may reference a prescription but should not duplicate it.

---

# 29. Clinical Record Relationship

Prescription and treatment plan should reference the clinical context.

Conceptually:

```text id="e4y7u1"
Clinical Record
    │
    ├── Prescription
    │       └── Prescription Items
    │
    └── Treatment Plan
            └── Treatment Plan Items
```

Do not make the prescription independent of the clinical context unless the product explicitly requires standalone prescriptions.

---

# 30. Patient Relationship

Use canonical patient identity.

Do not duplicate:

```text id="c6q9p2"
patient name
phone
DOB
```

inside every prescription item.

Reference the patient.

---

# 31. Practitioner Relationship

Prescription and treatment plan must reference the practitioner who issued/created them.

Do not trust:

```text id="m4k8s1"
doctorId
```

from the browser.

Derive practitioner identity from the authenticated doctor.

---

# 32. Appointment Relationship

Where the prescription originates from a consultation, link it to the appointment.

This provides traceability:

```text id="u7n2m9"
Appointment
  ↓
Clinical Record
  ↓
Prescription
```

---

# 33. Prescription Ownership

A doctor must only create prescriptions for patients/appointments they are authorized to treat.

The browser must not be able to change:

```text id="e8k5r2"
patient_id
practitioner_id
appointment_id
```

to bypass authorization.

---

# 34. Patient Access

If patient prescription viewing is implemented in this phase, it must be deliberate and safe.

Patients may reasonably need to see an issued prescription.

However:

```text id="v5q8s3"
draft prescription
```

must not automatically become visible to patients.

Only an appropriately issued/final prescription should be patient-visible.

---

# 35. Patient Prescription View

A patient-facing prescription could display:

```text id="a2m6q8"
Prescription
Issued by Dr. ...
Date

Medicine / Remedy
Dose
Frequency
Timing
Duration
Instructions
```

Avoid exposing:

* internal doctor notes
* clinical reasoning
* hidden metadata
* internal identifiers

---

# 36. Receptionist Access

Receptionists should not automatically access prescriptions.

If the clinic needs operational access to whether a prescription was issued, that should be represented by a minimal authorized status rather than exposing full clinical instructions.

---

# 37. Admin Access

Admin does not automatically imply clinical prescription access.

Any administrative access to clinical prescriptions must be explicitly authorized and audited.

---

# 38. Prescription History

Doctors should be able to view authorized prescription history.

Example:

```text id="x8m4n2"
18 Sep 2026
Prescription
Issued

02 Aug 2026
Prescription
Issued
```

The history should support opening the appropriate prescription detail.

---

# 39. Patient Prescription History

If implemented:

```text id="p3q7w9"
Issued
18 Sep 2026
Dr. A

Issued
02 Aug 2026
Dr. B
```

Only issued prescriptions should appear by default.

---

# 40. Prescription Detail

Prescription detail should show:

* patient
* practitioner
* issue date
* associated consultation where appropriate
* items
* dosage
* frequency
* timing
* duration
* instructions
* status

---

# 41. Printing / PDF Boundary

If the clinic needs printable prescriptions, design the data model so a future print/PDF layer can consume it.

Do not build a complex PDF generation subsystem unless required in this phase.

If printing is implemented, the output must reflect the authoritative issued prescription.

---

# 42. Prescription Amendments

Do not silently edit an issued prescription.

Bad:

```text id="8z6k2p"
Issued prescription
→ modify medicine directly
```

Good:

```text id="m4v8s2"
Issued prescription
→ preserve original
→ future amendment/version
→ new authoritative state
```

If amendment functionality is not yet implemented, restrict editing of issued prescriptions.

---

# 43. Cancellation

If a prescription needs to be invalidated:

```text id="p9f3x7"
status = cancelled
```

rather than deleting it.

Preserve the historical record.

---

# 44. Treatment Plan Updates

Treatment plans may need ongoing modification.

A safe model should distinguish:

```text id="g6n2r4"
existing plan
```

from:

```text id="k8w3y1"
new plan/update
```

Avoid silently changing historical treatment instructions.

---

# 45. Plan Status

Possible:

```text id="h4v9s2"
draft
active
completed
cancelled
```

Only implement states actually required.

---

# 46. Follow-Up

Treatment plans may specify follow-up:

```text id="u3q8m1"
Follow up after 2 weeks
```

or:

```text id="s6k2y7"
Follow-up date: 02 October 2026
```

Do not automatically create an appointment from this field unless explicitly required.

Phase 09 remains the appointment engine.

---

# 47. No Automatic Appointment Creation

A treatment plan must not automatically create:

```text id="d4f7p2"
appointment
```

just because a follow-up date is entered.

If future automation is required, it should be implemented through the appointment and notification systems.

---

# 48. Prescription Validation

Validate server-side:

* medicine/remedy
* dosage
* frequency
* duration
* quantity
* instructions
* prescription state
* patient relationship
* practitioner relationship
* appointment/clinical record relationship

---

# 49. Clinical Validation Philosophy

Do not attempt to make the application medically authoritative through arbitrary validation.

For example, do not hard-code:

```text id="k5q9m3"
"dosage must be 500mg"
```

unless the clinic's verified medicine catalog and business rules explicitly require it.

The system should validate:

```text id="f2w6n8"
data integrity
format
required fields
authorization
```

rather than pretending to replace a clinician's judgment.

---

# 50. Medicine Catalog

If a structured catalog is introduced:

* only verified medicines/remedies
* clear active/inactive state
* avoid deleting referenced medicines
* preserve historical names
* do not silently change historical prescription meaning

Prefer:

```text id="t8x4r2"
inactive
```

over deleting a medicine referenced by an issued prescription.

---

# 51. Historical Integrity

An issued prescription should remain historically understandable even if the medicine catalog changes later.

For example:

```text id="y3k8q6"
Medicine ID
+
Snapshot/display name
```

may be appropriate.

Do not make historical prescriptions depend entirely on a mutable current catalog entry.

---

# 52. Prescription Item Snapshot

When a prescription is issued, preserve the clinically relevant values that were actually issued:

```text id="p7w2n5"
medicine/remedy name
form
strength
dose
frequency
timing
duration
quantity
instructions
```

Later changes to a medicine catalog must not rewrite historical prescriptions.

---

# 53. Treatment Plan Snapshot

Where historical integrity requires it, preserve issued plan content.

Do not dynamically rewrite a patient's historical treatment plan merely because a master configuration changed.

---

# 54. Security Architecture

Every prescription/treatment-plan operation must follow:

```text id="m2k8q4"
Authenticate
→ Authorize
→ Verify doctor/patient/care relationship
→ Validate
→ Apply state/business rules
→ Database operation
→ RLS
```

---

# 55. RLS

Prescription and treatment-plan tables must have explicit RLS policies.

Example:

```text id="b8x5q2"
Authorized doctor
→ permitted prescription = ALLOWED

Unauthorized doctor
→ prescription = DENIED

Receptionist
→ full prescription = DENIED

Patient
→ issued patient-visible prescription = ALLOWED
```

Only implement patient access if explicitly required.

---

# 56. Prescription IDOR

This must not work:

```text id="g4n8s2"
GET /prescriptions/another-patient-id
```

just because the user is authenticated.

The server and database must enforce access.

---

# 57. Treatment Plan IDOR

Similarly:

```text id="v2q6m9"
GET /treatment-plans/123
```

must verify authorization.

---

# 58. Client Payload Manipulation

Do not trust:

```json id="f6k3q8"
{
  "patientId": "patient-b",
  "practitionerId": "doctor-b",
  "clinicalRecordId": "record-b"
}
```

The server must derive/verify all sensitive relationships.

---

# 59. Prescription Status Manipulation

This must NOT work:

```json id="m8x2q7"
{
  "status": "issued"
}
```

from an unauthorized client.

The server controls status transitions.

---

# 60. Patient Visibility

This must NOT happen:

```text id="j5q8w3"
Doctor saves draft
→ patient immediately sees it
```

Correct:

```text id="r7m4n2"
Doctor saves draft
→ private draft

Doctor issues
→ patient-visible if policy permits
```

---

# 61. Prescription Notifications Boundary

Do not implement notifications here.

Phase 15 may later send:

```text id="k8w2p6"
Prescription issued
```

The prescription system should expose a clean event boundary for this.

Do not put notification logic inside UI components.

---

# 62. Document Boundary

Do not implement PDF/file storage as the primary prescription storage mechanism.

The database remains the source of truth.

Phase 14 can later handle generated documents.

---

# 63. AI Boundary

Do not implement AI prescription generation.

The future AI flow is:

```text id="c4m8y2"
Clinical Record
      ↓
AI Assistance
      ↓
Suggestion
      ↓
Doctor Review
      ↓
Doctor Decision
      ↓
Prescription
```

Never:

```text id="n7x2k5"
AI
 ↓
Automatic prescription
```

---

# 64. Doctor UX

The prescription experience should be integrated naturally into the consultation workflow.

Recommended:

```text id="r5y8m3"
Clinical Record
      ↓
Prescription
      ↓
Treatment Plan
      ↓
Review
      ↓
Issue
```

Avoid opening unrelated pages unnecessarily during a consultation.

---

# 65. Prescription Builder

A doctor should be able to:

```
Add medicine/remedy
      ↓
Enter dosage
      ↓
Enter frequency
      ↓
Enter timing
      ↓
Enter duration
      ↓
Enter instructions
      ↓
Add another item
```

Use repeatable form sections.

If a medicine/remedy is previously prescribed by the doctor to any patient, then that medicine/therapy should appear as suggestion. For example if doctor is prescribing 'Ashvagandha' then when doctor types A all Medicines starting with 'A' should appear in suggestion, when doctor type 'As' then all medicines starting with 'As' should appear in suggestion and so on. So, use autocomplete with debouncing

---

# 66. Reordering Items

Allow doctors to reorder prescription items if order has meaning.

Otherwise, maintain a deterministic order.

Do not rely on arbitrary database row order.

---

# 67. Removing Draft Items

Doctors should be able to remove draft prescription items.

Issued items must not simply disappear from history.

---

# 68. Treatment Plan Builder

Provide structured sections such as:

```
Diet
Lifestyle
Therapy
Follow-up
Other Instructions
```

Only include verified categories.

---

# 69. Draft Saving

Prescription and treatment plans should support draft saving where needed.

Use the same reliability principles as Phase 12:

```
Saving...
Saved
Unsaved changes
Save failed
```

Never falsely display saved state.

---

# 70. Completion / Issue Validation

Before issuing:

1. Verify doctor authorization.
2. Verify clinical record/appointment.
3. Verify patient relationship.
4. Validate prescription items.
5. Validate required fields.
6. Verify state.
7. Persist atomically.
8. Return authoritative state.

---

# 71. Transactional Issue

Where issuing involves multiple changes:

```
Prescription
+
Prescription Items
+
Treatment Plan
+
Clinical/appointment completion state
```

use transaction semantics when the business workflow requires atomicity.

Do not leave:

```
Prescription = issued
Prescription items = incomplete
```

because one database operation failed.

---

# 72. Concurrent Editing

Handle:

```
Doctor A edits
Doctor B edits
```

or repeated requests safely.

At minimum use:

```
updated_at
```

and consider optimistic concurrency/versioning.

---

# 73. Duplicate Submission

Double-clicking:

```text id="k7x4m9"
Issue Prescription
```

must not create duplicate prescriptions.

Use appropriate:

* database constraints
* idempotency
* state validation
* transaction logic

---

# 74. Prescription History Integrity

Historical prescriptions must remain stable.

If the doctor later creates a new prescription:

```text id="s8q3m1"
Prescription A
Issued

Prescription B
Issued later
```

do not overwrite A.

---

# 75. Patient-Facing Safety

Patient-facing prescriptions should include a clear distinction between:

```text id="b2n6x9"
Prescription
```

and:

```text id="m5r8q3"
general educational information
```

Do not add unsupported medical claims.

---

# 76. Prescription Display

Use a clean, highly readable format.

Example:

```text id="q7m2k4"
Prescription
18 September 2026

Dr. Example

1. Medicine / Remedy
   Dose: ...
   Frequency: ...
   Duration: ...
   Instructions: ...

2. Medicine / Remedy
   ...
```

Avoid dense spreadsheet-like presentation.

---

# 77. Print-Friendly Design

If a print view is implemented, it should:

* use readable typography
* include practitioner information
* include patient information appropriate for the prescription
* include issue date
* include prescription items
* avoid exposing internal IDs
* remain faithful to the authoritative record

---

# 78. Prescription Metadata

Where appropriate, preserve:

```text id="f4n8x2"
created_at
updated_at
issued_at
practitioner_id
patient_id
appointment_id
clinical_record_id
```

Do not expose all metadata to the patient.

---

# 79. Clinical Record Integration

From the clinical consultation:

```text id="r6x3m9"
Clinical Record
  ↓
Prescription section
  ↓
Treatment Plan section
```

The doctor should not have to manually re-enter:

```text id="y7q2p8"
patient
appointment
doctor
```

These should be derived from the consultation context.

---

# 80. Patient Context

The prescription builder should clearly display:

```text id="m8k4q2"
Patient
Appointment
Doctor
Consultation date
```

to reduce the risk of documenting the wrong patient.

---

# 81. Wrong-Patient Prevention

The clinical screen should make patient identity prominent.

Before issuing a prescription, the doctor should be able to verify:

```text id="x2n7m5"
Patient name
Date of birth / age
Appointment
```

Avoid relying on only a hidden identifier.

---

# 82. Sensitive Information in URLs

Avoid:

```text id="j4p8q6"
/doctor/prescriptions?patientName=Priya&diagnosis=...
```

Use opaque resource identifiers where needed.

Never put clinical content into URLs.

---

# 83. Logging

Do not log complete prescriptions.

Bad:

```ts id="m9q3x7"
logger.info({ prescription });
```

Good:

```ts id="v6n2k8"
logger.info({
  event: "prescription_issued",
  prescriptionId,
  actorId
});
```

Do not log:

* medicine instructions unnecessarily
* diagnosis
* clinical notes
* patient clinical information

---

# 84. Error Handling

Bad:

```text id="x7k2m9"
insert violates foreign key prescription_items_prescription_id_fkey
```

Good:

```text id="q4m8n2"
We couldn't save the prescription.
Please review the information and try again.
```

---

# 85. Accessibility

Prescription builder must support:

* keyboard navigation
* accessible labels
* repeatable form controls
* error association
* screen readers
* visible focus
* accessible dialogs
* accessible status indicators

Do not rely only on color.

---

# 86. Responsive Design

Test:

```text id="k3m7x9"
320px
375px
390px
430px
768px
1024px
1280px
1440px+
```

Prescription forms should be usable on tablets.

---

# 87. Mobile Prescription Builder

On smaller screens:

* stack fields appropriately
* avoid excessively wide tables
* use repeatable cards/sections
* keep primary save/issue action accessible
* prevent accidental submission

---

# 88. Performance

Prescription workflows should:

* fetch only required patient/clinical context
* avoid loading unnecessary clinical history
* avoid fetching entire medicine catalogs
* use bounded searches for medicines if a catalog exists
* avoid unnecessary client-side data

---

# 89. Security Testing

Mandatory tests:

### Authentication

```text id="p8m4x2"
Unauthenticated → prescription = DENIED
```

### Authorization

```text id="k6x2m9"
Authorized doctor → permitted prescription = ALLOWED
Unauthorized doctor → prescription = DENIED
Receptionist → prescription = DENIED
```

### Patient access

```text id="q9m3x7"
Patient → own issued prescription = ALLOWED if enabled
Patient → another patient's prescription = DENIED
Patient → draft prescription = DENIED
```

### IDOR

```text id="x4k8m2"
Change prescriptionId
→ unauthorized prescription remains inaccessible
```

---

# 90. Privilege Escalation Tests

Attempt:

```text id="m7q3x8"
change practitionerId
change patientId
change appointmentId
change clinicalRecordId
change status
```

All unauthorized changes must fail.

---

# 91. Historical Integrity Tests

Verify:

```text id="p2x7m4"
Issued Prescription A
      ↓
Create Prescription B
      ↓
Prescription A remains unchanged
```

Also test medicine catalog changes if a catalog exists.

---

# 92. Duplicate Issue Tests

Test:

```text id="n8k3q5"
double-click Issue
concurrent Issue requests
network retry
browser refresh
```

Expected:

```text id="v5m2x7"
one authoritative prescription
```

not duplicates.

---

# 93. RLS Tests

Directly test database policies.

Example:

```text id="q8x4m6"
Doctor A → permitted prescription = ALLOW
Doctor A → unauthorized prescription = DENY
Receptionist → prescription = DENY
Patient → own issued prescription = ALLOW if enabled
Patient → another patient's prescription = DENY
```

---

# 94. Data Integrity Tests

Test:

```text id="m3x8q7"
Prescription references valid clinical record
Prescription references correct patient
Prescription references correct practitioner
Prescription references correct appointment
```

Invalid combinations must be rejected.

---

# 95. Few-Shot Examples

## Example 1 — Prescription Storage

### Bad

```text id="p4m8x2"
clinical_records.doctor_notes = "
Medicine A twice daily for 5 days
Medicine B once daily
"
```

### Good

```text id="q7x3m9"
clinical_records
        ↓
prescriptions
        ↓
prescription_items
```

Structured, queryable, and historically stable.

---

## Example 2 — Doctor Identity

### Bad

```json id="m8q2x6"
{
  "doctorId": "doctor-b"
}
```

Trusting the client.

### Good

```text id="v4x9m2"
Authenticated user
→ resolve practitioner identity
→ authorize
→ create prescription
```

---

## Example 3 — Prescription Issue

### Bad

```text id="k6m3q8"
Click Issue
→ UI changes status to Issued
```

### Good

```text id="x2p7m4"
Issue request
→ authorize
→ validate
→ verify clinical context
→ transaction
→ database state = issued
→ UI reflects server state
```

---

## Example 4 — Draft Visibility

### Bad

```text id="q8m4x1"
Doctor saves draft
→ patient can immediately view it
```

### Good

```text id="p3x7m9"
Draft
→ private

Issued
→ patient-visible according to policy
```

---

## Example 5 — Historical Prescription

### Bad

```text id="n4m8q2"
Medicine catalog changes
→ old prescription automatically changes
```

### Good

```text id="x7p3m5"
Issued prescription preserves its historical clinically relevant values.
```

---

## Example 6 — AI

### Bad

```text id="m2x8q4"
AI
→ generates prescription
→ automatically issues it
```

### Good

```text id="q5m7x2"
AI suggestion
→ Doctor reviews
→ Doctor edits/rejects/accepts
→ Doctor explicitly issues prescription
```

---

## Example 7 — Receptionist

### Bad

```text id="p8x3m6"
Receptionist opens patient
→ full prescription details displayed
```

### Good

```text id="x4m7q2"
Receptionist
→ operational patient information
→ no full clinical prescription access
```

---

## Example 8 — Treatment Plan

### Bad

```text id="k7m2x9"
Treatment plan = one giant unstructured text blob
```

### Good

```text id="q3x8m4"
Treatment Plan
├── Diet
├── Lifestyle
├── Therapy
├── Follow-up
└── Other Instructions
```

with flexible notes where needed.

---

# 96. Expected Architectural Areas

Adapt to the existing repository:

```text id="m7x4q2"
src/
  app/
    doctor/
      consultations/
        [appointmentId]/
          prescription/
          treatment-plan/

  components/
    prescriptions/
      prescription-builder.tsx
      prescription-item.tsx
      prescription-summary.tsx
      prescription-status.tsx

    treatment-plans/
      treatment-plan-builder.tsx
      treatment-plan-item.tsx

  server/
    prescriptions/
      queries.ts
      mutations.ts
      authorization.ts
      validation.ts

    treatment-plans/
      queries.ts
      mutations.ts
      authorization.ts
      validation.ts

  lib/
    prescriptions/
    treatment-plans/

supabase/
  migrations/
    ...prescriptions...
```

Do not blindly create this structure.

Follow the existing project architecture.

---

# 97. Database Objects

Potential models:

```text id="q8m3x7"
prescriptions
prescription_items
treatment_plans
treatment_plan_items
```

Optional:

```text id="m4x7q2"
medicines
```

only if a verified catalog is required.

---

# 98. Constraints

Use database constraints for:

* valid foreign keys
* status values
* required relationships
* valid ordering
* duplicate prevention
* appropriate uniqueness

Avoid cascading deletion that could destroy clinical history.

---

# 99. Prescription Deletion

Do not provide normal hard-delete for issued prescriptions.

Draft deletion may be permitted only if explicitly required.

Prefer:

```text id="x7m2q8"
cancel
```

for finalized prescriptions where appropriate.

---

# 100. Treatment Plan Deletion

Do not physically delete historical active/completed treatment plans without a defined policy.

Use status transitions where appropriate.

---

# 101. Acceptance Criteria

Phase 13 is complete only when:

## Prescription

* [ ] Prescription model exists.
* [ ] Prescription items are structured.
* [ ] Prescription is linked to patient.
* [ ] Prescription is linked to practitioner.
* [ ] Prescription is linked to appointment/clinical record where appropriate.
* [ ] Draft state exists.
* [ ] Issued state exists.
* [ ] Invalid state transitions are rejected.
* [ ] Issued prescriptions cannot be silently overwritten.

## Prescription Builder

* [ ] Doctor can add prescription items.
* [ ] Doctor can edit draft items.
* [ ] Doctor can remove draft items.
* [ ] Dosage can be represented clearly.
* [ ] Frequency can be represented clearly.
* [ ] Timing can be represented clearly.
* [ ] Duration can be represented clearly.
* [ ] Instructions can be recorded.
* [ ] Multiple items are supported.
* [ ] Review step exists before issue.

## Treatment Plan

* [ ] Treatment plan model exists.
* [ ] Treatment plan can be associated with clinical context.
* [ ] Appropriate structured categories exist.
* [ ] Draft/active/completed lifecycle works where required.
* [ ] Historical plan information is preserved.

## Security

* [ ] Doctor authorization is enforced.
* [ ] Patient/practitioner/appointment relationships are validated.
* [ ] RLS is implemented and tested.
* [ ] Cross-patient access is denied.
* [ ] Unauthorized doctor access is denied.
* [ ] Receptionist access is denied unless explicitly authorized.
* [ ] Client cannot spoof practitioner/patient IDs.
* [ ] Client cannot directly issue prescriptions.
* [ ] Draft prescriptions are not exposed to patients.
* [ ] Clinical data is not leaked through logs/errors/analytics.

## Integrity

* [ ] Duplicate prescription creation is prevented.
* [ ] Duplicate issue requests are safe.
* [ ] Historical prescriptions remain stable.
* [ ] Prescription/clinical-record relationships remain consistent.
* [ ] Prescription/appointment relationships remain consistent.
* [ ] Concurrent edits are handled safely.

## UX

* [ ] Prescription builder is integrated into consultation workflow.
* [ ] Treatment-plan builder is usable.
* [ ] Review before issue exists.
* [ ] Save state is clear.
* [ ] Loading/error/empty states exist.
* [ ] Responsive design works.
* [ ] Accessibility requirements are satisfied.

## AI Safety

* [ ] No autonomous prescription generation exists.
* [ ] No AI-generated prescription is automatically issued.
* [ ] Doctor remains final decision-maker.
* [ ] AI is not implemented in Phase 13.

## Engineering

* [ ] Phase 08 authorization is reused.
* [ ] Phase 09 appointment model is reused.
* [ ] Phase 12 clinical-record model is reused.
* [ ] No duplicate clinical data model exists.
* [ ] TypeScript remains strict.
* [ ] Lint passes.
* [ ] Typecheck passes.
* [ ] Tests pass.
* [ ] Production build passes.

---

# 102. Definition of Done

Phase 13 is done when an authorized doctor can:

```text id="m8q3x7"
Open Consultation
      ↓
Review Clinical Record
      ↓
Create Prescription
      ↓
Add Treatment Items
      ↓
Save Draft
      ↓
Review
      ↓
Issue
      ↓
View Historical Prescription
```

and, where required:

```text id="x4m7q2"
Create Treatment Plan
      ↓
Save
      ↓
Activate
      ↓
Track Historical Plan
```

while:

```text id="q7x2m8"
Receptionist
    ✕
Unauthorized prescription access

Patient
    ✕
Draft prescription

Unauthorized Doctor
    ✕
Clinical prescription

AI
    ✕
Autonomous prescription
```

The doctor remains the final clinical decision-maker.

The system must be ready for:

```text id="m3x8q7"
Phase 14 — Patient Documents & Secure Storage
```

and later:

```text id="q8m4x2"
Phase 15 — Notifications
Phase 17 — AI Clinical Decision Support
```

---

# 103. Explicitly Out of Scope

Do NOT implement:

* AI prescription generation
* AI diagnosis
* AI treatment recommendation
* Automatic prescribing
* Medicine recommendation engine
* Drug interaction engine unless explicitly required and clinically validated
* Pharmacy integration
* E-prescription regulatory integration
* Clinical document storage
* PDF document management subsystem
* Notifications
* Analytics
* Payments
* Telemedicine
* Full audit/compliance subsystem

---

# 104. Final Verification

Run:

```text id="x7m3q8"
lint
typecheck
tests
production build
```

Then manually verify:

```text id="m4q8x2"
Doctor
  ↓
Consultation
  ↓
Prescription
  ↓
Add multiple items
  ↓
Save Draft
  ↓
Reload
  ↓
Continue
  ↓
Review
  ↓
Issue
  ↓
View History
```

Verify:

```text id="q8m3x7"
Draft → patient = DENIED
Issued → patient = ALLOWED if patient access is enabled

Receptionist → prescription = DENIED
Unauthorized doctor → prescription = DENIED

Changed patientId = DENIED
Changed practitionerId = DENIED
Changed appointmentId = DENIED
Changed status = DENIED

Double issue = ONE authoritative prescription
Historical prescription = unchanged
```

---

# 105. Completion Report

At completion, report:

## Implemented

* Prescription model
* Prescription items
* Prescription builder
* Draft/issued lifecycle
* Treatment plan model
* Treatment plan builder
* Doctor integration
* Patient visibility if implemented
* Security/RLS
* Tests

## Database

Report:

```text id="p7m4x8"
Tables:
Enums:
Constraints:
Foreign keys:
Indexes:
RLS policies:
Functions/RPCs:
```

## Security

Report:

```text id="x2q8m5"
Authorization:
RLS:
Cross-patient isolation:
Cross-doctor isolation:
Receptionist isolation:
IDOR:
Privilege escalation:
Draft visibility:
```

## Integrity

Report:

```text id="m8x3q7"
Duplicate prevention:
Concurrent issue:
Historical preservation:
Appointment consistency:
Clinical-record consistency:
```

## Verification

```text id="q4m7x2"
Lint:
Typecheck:
Tests:
Build:
```

## Deferred

List intentionally deferred prescription/clinical functionality.

## Phase Status

```text id="v8m3q5"
Phase 13: COMPLETE
Ready for Phase 14: YES/NO
```

Do not begin Phase 14 during this phase.
