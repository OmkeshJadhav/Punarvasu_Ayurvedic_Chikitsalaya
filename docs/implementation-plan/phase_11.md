# Phase 11 — Doctor Dashboard & Clinical Workspace

## 1. Phase Objective

Build the production-quality **Doctor Dashboard and Clinical Operations Workspace** for Punarvasu.

The doctor dashboard is the doctor's primary authenticated workspace for understanding the day's schedule, finding patients, reviewing appointment context, and entering the future clinical workflow.

This phase should establish:

* Doctor dashboard
* Today's schedule
* Upcoming appointments
* Appointment detail
* Doctor-specific appointment filtering
* Patient search/access within authorized scope
* Basic patient context
* Consultation workflow entry point
* Operational appointment actions where appropriate
* Doctor-specific navigation
* Role-based authorization
* Secure patient access boundaries
* Responsive and accessible doctor experience

This phase must prepare the application for:

```text
Phase 12 → Clinical Records
Phase 13 → Prescription & Treatment Plans
Phase 14 → Patient Documents
Phase 17 → AI Clinical Decision Support
```

However, those clinical capabilities must **not be implemented in Phase 11**.

---

# 2. Critical Scope Boundary

The most important distinction in this phase is:

```text
Phase 11
Doctor Workspace
       ↓
Phase 12
Clinical Records
       ↓
Phase 13
Prescriptions & Treatment Plans
       ↓
Phase 14
Documents
       ↓
Phase 17
AI Clinical Decision Support
```

Phase 11 establishes the **workspace and workflow shell**.

Phase 12 will establish the actual medical record.

Do NOT put clinical record functionality into arbitrary doctor dashboard components simply because the doctor needs it.

---

# 3. Product Philosophy

The doctor dashboard should answer:

> "What do I need to know and do for my patients today?"

The experience should prioritize:

```text
Today's Schedule
       ↓
Current / Next Patient
       ↓
Patient Context
       ↓
Consultation Entry
       ↓
Upcoming Work
```

The interface should feel:

* calm
* focused
* professional
* clinically appropriate
* information-rich without being overwhelming
* fast
* trustworthy

It should NOT feel like a generic SaaS analytics dashboard.

---

# 4. Doctor Role

Use the Phase 08 authorization architecture.

The doctor must have:

```text
role = doctor
```

or the equivalent trusted application role.

Never authorize doctor access using:

```text
email address
localStorage
sessionStorage
client state
hard-coded user ID
```

All sensitive operations must be authorized server-side.

---

# 5. Doctor Access Boundary

A doctor may eventually need access to:

* Their appointments
* Patients associated with their care
* Patient profile information
* Clinical records
* Prescriptions
* Treatment plans
* Patient documents
* Clinical analytics

However, this phase should implement only the access required for the doctor workspace.

Do not grant:

```text
doctor
→ admin
```

permissions.

Do not assume:

```text
doctor
→ every patient in the system
```

unless the product explicitly defines that policy.

Patient access should be based on a clearly documented authorization model.

---

# 6. Doctor Route Architecture

Introduce a protected doctor application area.

Preferred routes:

```text
/doctor
/doctor/appointments
/doctor/patients
```

Potential future routes:

```text
/doctor/appointments/[id]
/doctor/patients/[id]
/doctor/consultations/[id]
```

Only create future routes if required as workflow placeholders.

Every route must require:

```text
authenticated
+
doctor authorization
```

---

# 7. Doctor Dashboard

The primary doctor landing page should prioritize the current working day.

Recommended structure:

```text
Header
  ↓
Today's overview
  ↓
Current / Next appointment
  ↓
Today's schedule
  ↓
Upcoming appointments
  ↓
Relevant patient actions
```

Avoid excessive KPI cards.

Useful operational metrics may include:

```text
Today's appointments
Completed
Pending
Next appointment
```

Only display values derived from actual data.

Never fabricate:

* patient numbers
* consultation statistics
* success rates
* clinical outcomes
* revenue
* credentials

---

# 8. Current Appointment

If an appointment is currently active or approaching, make it easy to identify.

Example:

```text
NEXT

10:30 AM
Priya Sharma

Initial Consultation
Today
```

The UI may provide:

```text
Open Patient
Start Consultation
View Appointment
```

only where the corresponding functionality exists.

Do not create a fake consultation workflow in this phase.

---

# 9. Today's Schedule

Today's schedule should be the primary doctor workflow.

Display:

```text
Time
Patient
Appointment Type
Status
Action
```

Example:

```text
09:30
Priya Sharma
Initial Consultation
Completed

10:00
Rahul Patil
Follow-up
Confirmed

10:30
Anita Joshi
Consultation
Pending
```

The actual data must come from the appointment engine.

---

# 10. Reuse Phase 09

Do not duplicate appointment logic.

The doctor workspace must consume the Phase 09 appointment engine.

Correct:

```text
Doctor UI
    ↓
Authorization
    ↓
Appointment service
    ↓
Database/RLS
```

Do NOT create a separate doctor-specific appointment implementation.

---

# 11. Doctor Appointment Scope

The doctor should see appointments according to the Phase 08/09 authorization model.

A common default is:

```text
doctor
→ appointments assigned to that practitioner
```

If clinic policy intentionally allows doctors to see a broader schedule, document that policy explicitly.

Do not assume that being a doctor grants access to every appointment.

---

# 12. Appointment Filtering

Provide useful filters:

```text
Today
Upcoming
Past
Status
Appointment Type
```

Potential practitioner filtering is unnecessary if the doctor can only see their own appointments.

Do not introduce filters that have no meaningful operational purpose.

---

# 13. Appointment Detail

Doctor appointment detail may show:

```text
Patient
Appointment Type
Date
Time
Status
Location / Mode
Booking note if permitted
```

Do not expose receptionist-only internal information unless explicitly authorized.

Do not expose clinical data through appointment fields.

---

# 14. Patient Context

A doctor needs patient context before beginning a consultation.

The initial workspace may provide:

```text
Patient name
Preferred name
Date of birth
Contact information where appropriate
Appointment information
```

Only expose information necessary for the workflow.

Clinical information belongs to Phase 12.

---

# 15. Patient Search

Provide doctor patient search where required.

Search should be:

* authorized
* server-side
* bounded
* paginated
* privacy-conscious

Do not load all patients into the browser.

---

# 16. Patient Search Scope

A critical security decision must be documented.

Possible models:

### Assigned-care model

Doctor can search only patients who have an appropriate relationship with the doctor.

### Clinic-wide model

Doctor can search clinic patients.

### Appointment-linked model

Doctor can access patients who have an appointment with them.

The implementation must follow the product's actual policy.

Do not accidentally implement unrestricted clinic-wide access simply because it is technically easier.

---

# 17. Patient Profile Access

Doctor access to the Phase 07 patient profile should be explicitly authorized.

Example permitted information:

```text
Name
Date of Birth
Contact information
Address
Emergency contact
```

Only fields necessary for clinical/operational care should be returned.

Do not expose unnecessary application metadata.

---

# 18. Clinical Data Boundary

Phase 11 must not implement:

```text
Diagnosis
Symptoms
Medical history
Allergies
Medications
Lab results
Doctor notes
Clinical assessment
Prescription
Treatment plan
```

These belong to later clinical phases.

If the dashboard needs a placeholder:

```text
Clinical Record
Available in consultation workspace
```

do not fabricate clinical content.

---

# 19. Consultation Entry Point

The doctor dashboard should provide a clear entry point into the future consultation workflow.

For example:

```text
Start Consultation
```

or:

```text
Open Consultation
```

If Phase 12 is not yet implemented, this should not pretend to save clinical records.

A temporary controlled placeholder may be used only if necessary.

---

# 20. Consultation Workflow Boundary

The future workflow is:

```text
Doctor Dashboard
      ↓
Patient
      ↓
Consultation
      ↓
Clinical Record
      ↓
Prescription / Treatment Plan
```

Phase 11 only establishes:

```text
Doctor Dashboard
      ↓
Patient
      ↓
Consultation Entry
```

Phase 12 implements the actual clinical record.

---

# 21. Appointment Status Actions

Doctor status permissions must follow Phase 08/09 rules.

Possible doctor actions:

```text
Confirm
Complete
No Show
```

depending on the agreed workflow.

Do not provide unrestricted status editing.

For example:

```text
completed → pending
```

must remain prohibited.

---

# 22. Starting a Consultation

If the appointment is eligible for consultation:

```text
Confirmed appointment
       ↓
Start Consultation
```

The system should verify:

* authenticated doctor
* doctor authorization
* appointment exists
* doctor is authorized for appointment
* appointment is in an eligible state
* patient exists

Do not trust the appointment ID alone.

---

# 23. Patient Ownership / Care Relationship

A doctor should not gain access to a patient simply by guessing:

```text
patientId
```

or:

```text
appointmentId
```

Every access must establish the relationship between:

```text
Doctor
+
Patient
+
Appointment / Care Context
```

according to the product's authorization policy.

---

# 24. IDOR Protection

This is mandatory.

Bad:

```text
GET /doctor/patients/123
```

returns patient 123 to any authenticated doctor.

Good:

```text
Authenticate
→ require doctor permission
→ verify doctor-patient relationship
→ query permitted resource
→ RLS
```

---

# 25. Doctor vs Receptionist Boundary

The doctor and receptionist have different responsibilities.

Receptionist:

```text
Operational scheduling
Patient onboarding
Appointment management
```

Doctor:

```text
Clinical care workflow
Patient care context
Consultation
```

Do not copy the receptionist interface into the doctor workspace.

---

# 26. Doctor vs Admin Boundary

Doctor must NOT automatically access:

```text
User management
Role assignment
System configuration
Security settings
```

unless explicitly authorized by a future policy.

---

# 27. Dashboard Layout

A recommended conceptual layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Punarvasu       Search             Notifications    Profile  │
├───────────────┬──────────────────────────────────────────────┤
│               │                                              │
│ Dashboard     │ Good morning, Doctor                         │
│ Appointments  │                                              │
│ Patients      │ Today's Schedule                             │
│               │                                              │
│               │ ┌──────────────────────────────────────────┐ │
│               │ │ 09:30  Patient A  Completed               │ │
│               │ │ 10:00  Patient B  Confirmed               │ │
│               │ │ 10:30  Patient C  Pending                │ │
│               │ └──────────────────────────────────────────┘ │
│               │                                              │
│               │ Next Patient                                 │
│               │ Patient C • 10:30 AM                          │
│               │ [Open Patient] [Start Consultation]          │
│               │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

This is conceptual only.

Use the actual Punarvasu design system rather than reproducing this literally.

---

# 28. Current-Day Focus

The default dashboard should open to:

```text
Today
```

rather than a generic analytics overview.

Doctors should reach their most important work immediately.

---

# 29. Upcoming Appointments

Provide an upcoming view where useful.

Example:

```text
Tomorrow
09:30 — Patient A
11:00 — Patient B

Friday
10:30 — Patient C
```

Keep it operational.

---

# 30. Search

Global doctor search should be carefully scoped.

Potential search categories:

```text
Patients
Appointments
```

Do not search:

```text
Clinical notes
Diagnosis
Prescription
```

until those systems are implemented and their security model is defined.

---

# 31. Patient Summary

A patient summary should provide enough context to begin care without becoming the clinical record.

Example:

```text
Priya Sharma

Date of Birth
12 March 1985

Phone
98xxxxxx12

Upcoming Appointment
Today · 10:30 AM

[Open Patient]
[Start Consultation]
```

No fabricated health information.

---

# 32. Recent Appointment Context

A doctor may need to know that the patient has previous visits.

Phase 11 may show minimal appointment history:

```text
Previous Visits
18 Aug 2026 — Follow-up — Completed
02 Aug 2026 — Initial Consultation — Completed
```

Do not display clinical notes from these visits.

That belongs to Phase 12.

---

# 33. Patient History Boundary

Distinguish:

```text
Appointment History
```

from:

```text
Clinical History
```

Appointment history:

```text
date
type
status
practitioner
```

Clinical history:

```text
diagnosis
symptoms
assessment
notes
prescription
```

Only the first belongs in Phase 11.

---

# 34. Doctor Notifications

Do not build the notification system.

The dashboard may have a notification placeholder if required by the existing shell, but Phase 15 will implement the real notification infrastructure.

---

# 35. Real-Time Updates

If Supabase realtime is used, it may update:

```text
appointment status
new appointment
cancellation
reschedule
```

However:

* subscriptions must be authorized
* patient data must be scoped
* realtime is not a security boundary
* cleanup must be handled correctly

If realtime is unnecessary, use server revalidation.

---

# 36. Performance

The dashboard should load quickly.

Requirements:

* server-render where appropriate
* bounded appointment queries
* indexed date/practitioner queries
* minimal patient payloads
* avoid fetching clinical data unnecessarily
* avoid loading all patients
* avoid unnecessary client-side state

---

# 37. Responsive Design

Test:

```text
320px
375px
390px
430px
768px
1024px
1280px
1440px+
```

Doctors may use:

* desktop
* laptop
* tablet

The experience must work well across all three.

---

# 38. Mobile Doctor Experience

On mobile/tablet:

* schedule becomes a clean list
* patient summary can use a drawer
* actions remain reachable
* clinical entry points remain clear
* navigation should not consume excessive space

Do not shrink a desktop table until it becomes unusable.

---

# 39. Accessibility

Ensure:

* keyboard navigation
* visible focus
* semantic buttons/links
* accessible dialogs/drawers
* accessible status labels
* screen-reader-friendly appointment information
* sufficient contrast
* touch-friendly controls

Do not communicate appointment status using color alone.

---

# 40. Loading States

Examples:

```text
Loading today's schedule...
```

```text
Loading patient...
```

```text
Opening consultation...
```

Buttons must prevent accidental duplicate operations.

---

# 41. Empty States

Examples:

```text
No appointments scheduled for today.
```

```text
No upcoming appointments.
```

```text
No patients found.
```

Provide useful next actions where appropriate.

---

# 42. Error States

Examples:

```text
We couldn't load today's appointments.
Please try again.
```

```text
You don't have permission to view this patient.
```

```text
This appointment is no longer available.
```

Never expose database or authorization implementation details.

---

# 43. Security

The doctor workspace handles sensitive patient information.

Never:

* expose data publicly
* cache private pages publicly
* put clinical data in URLs
* put patient data in localStorage
* trust client-supplied doctor IDs
* trust client-supplied patient IDs
* trust client-supplied permissions

---

# 44. Data Minimization

Only return fields required for the doctor workflow.

Avoid:

```text
SELECT *
```

for patient/appointment data.

Explicitly select the required fields.

This becomes even more important once clinical records exist.

---

# 45. RLS

Use Phase 08 authorization and Supabase RLS.

The database must enforce the doctor access policy.

Examples:

```text
Doctor A
→ permitted patient
= ALLOWED
```

```text
Doctor A
→ unauthorized patient
= DENIED
```

Do not rely solely on:

```text
if (role === "doctor")
```

in application code.

---

# 46. Server Authorization

Every sensitive operation should independently verify:

```text
Authenticated user
+
Doctor role/permission
+
Resource relationship
```

For example:

```text
getPatientForDoctor(patientId)
```

must verify that the doctor is allowed to access that patient.

---

# 47. Appointment Authorization

Doctor appointment queries should be scoped.

For example:

```text
doctor_id = authenticated user's practitioner identity
```

or the equivalent approved care relationship.

Never accept:

```text
doctorId
```

from the browser as proof of identity.

---

# 48. Practitioner Identity

Ensure the system can reliably map:

```text
auth.users.id
        ↓
application identity
        ↓
doctor/practitioner identity
```

The doctor workspace should not depend on manually typed doctor names.

---

# 49. Staff / Practitioner Model

If Phase 05 introduced practitioner profiles and Phase 09 introduced practitioner scheduling, reuse them.

Do not create:

```text
doctor_profiles
practitioners
staff
```

as three competing sources of truth.

There should be a clearly documented relationship between:

```text
User
Role
Practitioner
```

---

# 50. Authorization Example

A doctor request:

```text
Open patient 123
```

should follow:

```text
Doctor browser
      ↓
Server
      ↓
Authenticated user
      ↓
Doctor permission
      ↓
Resolve practitioner identity
      ↓
Verify patient access relationship
      ↓
Query database
      ↓
RLS
      ↓
Patient data
```

---

# 51. Consultation Placeholder

If Phase 12 is not implemented yet, a consultation CTA can be represented as:

```text
Start Consultation
```

but should either:

1. route to the Phase 12 implementation once available, or
2. show a clearly marked controlled placeholder during development.

Never create fake clinical-record persistence just to make the button appear functional.

---

# 52. No AI in Phase 11

Do NOT implement:

* Gemini
* diagnosis suggestions
* Ayurvedic recommendations
* symptom analysis
* prescription generation
* AI summaries
* AI clinical reasoning

AI belongs to Phase 17 and must follow the project's clinical-safety rules.

---

# 53. No Prescription in Phase 11

Do NOT implement:

```text
Medicine
Dosage
Frequency
Duration
Prescription
```

The doctor workspace may contain a future navigation placeholder only if required, but no prescription functionality.

Phase 13 owns this.

---

# 54. No Clinical Record in Phase 11

Do NOT implement:

```text
Chief complaint
History of present illness
Assessment
Diagnosis
Clinical notes
Vitals
Treatment notes
```

Phase 12 owns these.

---

# 55. Few-Shot Examples

## Example 1 — Doctor Access

### Bad

```ts
if (user.role === "doctor") {
  return getPatient(patientId);
}
```

### Good

```text
Authenticate
→ require doctor permission
→ resolve doctor identity
→ verify doctor-patient/care relationship
→ query permitted data
→ RLS
```

---

## Example 2 — Doctor ID

### Bad

```json
{
  "doctorId": "doctor-123",
  "patientId": "patient-456"
}
```

and trusting both values.

### Good

```text
doctorId
→ derived from authenticated user

patientId
→ validated against authorized care relationship
```

---

## Example 3 — Clinical Data

### Bad

```text
Doctor Dashboard

Patient
Diagnosis
Prescription
Treatment Plan
AI Recommendation
```

all implemented in the dashboard.

### Good

```text
Doctor Dashboard

Patient
Appointment
Basic context

→ Start Consultation
→ Phase 12 owns clinical records
→ Phase 13 owns prescriptions
→ Phase 17 owns AI assistance
```

---

## Example 4 — Appointment History

### Bad

```text
Previous Visit
→ display entire doctor note
```

### Good

```text
Previous Visit
18 Aug 2026
Follow-up
Completed
```

Clinical content remains inside the clinical-record system.

---

## Example 5 — Patient Search

### Bad

```text
Fetch all patients
→ filter in browser
```

### Good

```text
Search term
→ authorized server query
→ bounded results
→ minimum required fields
→ RLS
```

---

## Example 6 — Dashboard Metrics

### Bad

```text
Patients treated: 1,284
Success rate: 94%
```

without real verified data.

### Good

```text
Today's appointments: 8
Completed: 3
Upcoming: 5
```

calculated from actual appointment data.

---

## Example 7 — Status

### Bad

```text
Doctor can select any appointment status
```

### Good

```text
Current status
→ determine allowed transition
→ authorize doctor
→ server validates
→ update
```

---

## Example 8 — Consultation Button

### Bad

```text
Start Consultation
→ save fake consultation data in appointments table
```

### Good

```text
Start Consultation
→ authorized workflow entry
→ Phase 12 clinical-record creation
```

---

# 56. Expected Architectural Areas

Adapt to the existing repository:

```text
src/
  app/
    doctor/
      page.tsx
      appointments/
      patients/

  components/
    doctor/
      doctor-shell.tsx
      today-overview.tsx
      doctor-schedule.tsx
      appointment-card.tsx
      patient-summary.tsx
      patient-search.tsx

  server/
    doctor/
      queries.ts
      mutations.ts
      authorization.ts

  lib/
    doctor/

supabase/
  migrations/
```

Do not blindly create this exact structure.

Preserve the architecture established in Phase 01.

---

# 57. Database Changes

Prefer reusing:

```text
appointments
patient_profiles
practitioners
user_roles
```

and other existing models.

Only add database structures when necessary.

Do not duplicate appointment or patient data solely for the doctor UI.

---

# 58. Authorization Matrix

Example:

| Operation                         | Patient | Receptionist |          Doctor |         Admin |
| --------------------------------- | ------: | -----------: | --------------: | ------------: |
| View own appointments             |     Yes |            — |               — |             — |
| View assigned doctor appointments |      No |  Operational |             Yes |    Controlled |
| Search patients                   |      No |          Yes |      Controlled |    Controlled |
| View permitted patient profile    |     Own |  Operational |      Care scope |    Controlled |
| View appointment history          |     Own |  Operational |      Care scope |    Controlled |
| Start consultation                |      No |           No |             Yes | Explicit only |
| Write clinical record             |      No |           No | Future Phase 12 | Explicit only |
| Manage roles                      |      No |           No |              No |           Yes |

This matrix is illustrative and must follow the final Phase 08 policy.

---

# 59. Testing

## Authentication

* unauthenticated user cannot access doctor routes
* authenticated patient cannot access doctor routes

## Authorization

* receptionist cannot access doctor workspace
* doctor can access permitted doctor routes
* doctor cannot access admin-only functionality
* doctor cannot access unauthorized patients

## Appointment

* doctor sees only permitted appointments
* doctor can open permitted appointment
* doctor cannot access another doctor's restricted appointment if policy forbids it
* invalid status transitions are rejected

## Patient

* authorized doctor can view permitted patient
* unauthorized doctor cannot view patient
* cross-patient IDOR fails

## Security

Test manipulation of:

```text
doctorId
patientId
appointmentId
role
permission
```

All unauthorized attempts must fail.

---

# 60. Cross-Doctor Isolation

Where the policy requires practitioner-specific access, create:

```text
Doctor A
Doctor B
Patient A
Patient B
```

Verify:

```text
Doctor A → Patient/appointment assigned to A = ALLOWED
Doctor A → restricted Patient/appointment assigned to B = DENIED
```

If the product intentionally uses clinic-wide doctor access, document that decision and test against that policy instead.

---

# 61. Performance Tests

Verify that:

* today's schedule is efficiently queried
* doctor appointment queries use appropriate indexes
* patient search is bounded
* no full-table patient query occurs
* unnecessary clinical data is not fetched

---

# 62. Acceptance Criteria

Phase 11 is complete only when:

### Doctor Workspace

* [ ] Doctor has a dedicated protected workspace.
* [ ] Today's schedule is visible.
* [ ] Current/next appointment is easy to identify.
* [ ] Upcoming appointments are available.
* [ ] Appointment statuses are clear.
* [ ] Useful appointment filters exist.
* [ ] Workspace is responsive.

### Patient Access

* [ ] Doctor can search authorized patients.
* [ ] Patient search is server-side and bounded.
* [ ] Basic patient context is available.
* [ ] Patient access follows documented care/authorization policy.
* [ ] Cross-patient IDOR is prevented.

### Appointment

* [ ] Doctor appointment views reuse Phase 09.
* [ ] Appointment detail works.
* [ ] Permitted status actions work.
* [ ] Invalid transitions are rejected.
* [ ] Doctor identity is derived securely.
* [ ] Unauthorized appointments cannot be accessed.

### Clinical Boundary

* [ ] No clinical record persistence is implemented.
* [ ] No diagnosis functionality is implemented.
* [ ] No prescription functionality is implemented.
* [ ] No treatment-plan functionality is implemented.
* [ ] No AI clinical functionality is implemented.
* [ ] Consultation entry point is correctly separated from Phase 12.

### Security

* [ ] Doctor routes are protected.
* [ ] Server authorization is enforced.
* [ ] RLS protects patient/appointment access.
* [ ] Client-controlled IDs cannot bypass authorization.
* [ ] Doctor cannot gain admin privileges.
* [ ] Sensitive data is not stored in browser storage.
* [ ] Private pages are not publicly cacheable/indexable.

### UX

* [ ] Punarvasu design system is reused.
* [ ] Loading states exist.
* [ ] Empty states exist.
* [ ] Error states exist.
* [ ] Responsive layouts work.
* [ ] Accessibility requirements are met.

### Engineering

* [ ] No duplicate appointment logic exists.
* [ ] Existing Phase 08/09 architecture is reused.
* [ ] TypeScript remains strict.
* [ ] Lint passes.
* [ ] Typecheck passes.
* [ ] Tests pass.
* [ ] Production build passes.

---

# 63. Definition of Done

Phase 11 is complete when an authorized doctor can:

```text
Login
  ↓
Open Doctor Workspace
  ↓
See today's appointments
  ↓
Identify next patient
  ↓
Open authorized patient context
  ↓
Review appointment history
  ↓
Enter the future consultation workflow
```

while remaining unable to access:

```text
Unauthorized patients
Admin functionality
Unauthorized appointments
```

and without clinical records, prescriptions, or AI being incorrectly implemented inside the dashboard.

The resulting workspace must be ready for:

```text
Phase 12 — Clinical Records
```

---

# 64. Explicitly Out of Scope

Do NOT implement:

* Clinical records
* Diagnosis
* Symptoms/history
* Clinical notes
* Vitals
* Prescription
* Treatment plans
* Patient clinical documents
* AI clinical decision support
* Notifications
* Analytics
* Payments
* Telemedicine
* Admin console
* Advanced audit/compliance system

---

# 65. Final Verification

Run the project's actual:

```text
lint
typecheck
tests
production build
```

Then manually verify:

```text
Doctor login
    ↓
Doctor workspace
    ↓
Today's schedule
    ↓
Next appointment
    ↓
Patient search
    ↓
Patient summary
    ↓
Appointment detail
    ↓
Consultation entry point
```

Then perform adversarial checks:

```text
Patient → doctor route = DENIED
Receptionist → doctor-only route = DENIED
Doctor → admin route = DENIED
Doctor → unauthorized patient = DENIED
Manipulated patientId = DENIED
Manipulated doctorId = DENIED
Manipulated appointmentId = DENIED
Invalid appointment status transition = DENIED
```

---

# 66. Completion Report

At completion, report:

## Implemented

* Doctor workspace
* Today's schedule
* Upcoming appointments
* Appointment details
* Patient search
* Patient summary
* Doctor authorization
* Consultation entry point
* Responsive/accessibility work
* Tests

## Database

Report:

```text
Tables changed:
Migrations:
Indexes:
Constraints:
RLS policies:
Functions/RPCs:
```

## Security

Report:

```text
Doctor route protection:
Patient access:
Appointment access:
Cross-doctor isolation:
IDOR tests:
Privilege escalation tests:
RLS:
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
Phase 11: COMPLETE
Ready for Phase 12: YES/NO
```

Do not begin Phase 12 during this phase.
