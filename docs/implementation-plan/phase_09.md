# Phase 09 — Appointment Engine

## 1. Phase Objective

Build the core appointment and scheduling engine for Punarvasu.

This phase establishes the backend, database, business rules, APIs/server actions, validation, availability logic, appointment lifecycle, conflict prevention, and patient-facing appointment experience required for future receptionist and doctor workflows.

The appointment engine must support:

* Appointment creation
* Availability
* Appointment date/time selection
* Appointment status lifecycle
* Rescheduling
* Cancellation
* Conflict prevention
* Role-aware access
* Patient ownership
* Doctor/staff scheduling foundations
* Appointment history
* Secure server-side validation
* Timezone-safe date/time handling
* Responsive and accessible UI

The system must be designed so that:

```text
Phase 09
Appointment Engine
       ↓
Phase 10
Receptionist Workspace
       ↓
Phase 11
Doctor Dashboard
       ↓
Future Clinical Workflow
```

---

# 2. Relationship With Previous Phases

## Phase 06 — Authentication

Provides:

```text
Who is authenticated?
```

---

## Phase 07 — Patient Profile

Provides:

```text
Who is the patient?
```

---

## Phase 08 — Roles & Permissions

Provides:

```text
What is this user allowed to do?
```

---

## Phase 09 — Appointment Engine

Provides:

```text
When can care happen?
Who is the appointment for?
With whom?
At what time?
What is its current state?
```

---

# 3. Core Appointment Model

An appointment conceptually represents:

```text
Patient
   +
Practitioner
   +
Date/Time
   +
Appointment Type
   +
Status
```

Example:

```text
Patient: Priya Sharma
Doctor: Dr. Example
Date: 18 September 2026
Time: 10:30 AM
Duration: 30 minutes
Type: Initial Consultation
Status: Confirmed
```

Do not hard-code these example values into the product.

---

# 4. Appointment Types

Establish a configurable appointment-type concept.

Examples may include:

```text
Initial Consultation
Follow-up Consultation
Ayurvedic Consultation
Therapy Consultation
```

The actual production list should come from verified clinic requirements.

Each appointment type may eventually define:

* Name
* Description
* Duration
* Active/inactive state
* Buffer time if required
* Whether online/in-person is supported
* Booking rules

Do not invent clinical services merely to populate the database.

---

# 5. Appointment Status Lifecycle

Establish a clear status model.

Recommended initial statuses:

```text
pending
confirmed
cancelled
completed
no_show
```

If the product requires it, an additional:

```text
rescheduled
```

state may be considered, but preferably rescheduling should be represented by updating the appointment while preserving history rather than creating meaningless terminal statuses.

---

# 6. Status Semantics

## Pending

Appointment request has been created but is not yet confirmed.

---

## Confirmed

The clinic has accepted/confirmed the appointment.

---

## Cancelled

Appointment will no longer occur.

Cancellation should preserve historical information.

Do not physically delete completed/previous appointments simply because they were cancelled.

---

## Completed

Appointment occurred successfully.

---

## No Show

Patient did not attend the appointment.

---

# 7. Status Transition Rules

Do not allow arbitrary status changes.

For example:

```text
pending
  → confirmed
  → cancelled
```

and:

```text
confirmed
  → completed
  → no_show
  → cancelled
```

The exact transition matrix should be centralized.

Invalid transitions must be rejected.

Example:

```text
completed → pending
```

must not be allowed through a normal appointment update operation.

---

# 8. Appointment Data Model

A conceptual appointment record:

```text
appointments
------------------------------------------------
id
patient_id
practitioner_id
appointment_type_id
start_at
end_at
status
reason
patient_note
internal_note
location_type
created_by
created_at
updated_at
cancelled_at
cancelled_by
cancellation_reason
```

The exact fields should be adapted to the existing architecture.

---

# 9. Patient Relationship

An appointment must be associated with a valid patient application identity.

Conceptually:

```text
appointments.patient_id
        ↓
patient_profiles.id
        ↓
patient_profiles.user_id
        ↓
auth.users.id
```

Do not store arbitrary patient identifiers supplied by the browser without authorization.

---

# 10. Practitioner Relationship

Appointments should reference a practitioner/staff identity rather than storing free-form doctor names.

Conceptually:

```text
appointments.practitioner_id
        ↓
practitioner/staff identity
        ↓
authenticated application user
```

The implementation should integrate cleanly with the practitioner architecture from previous public pages and Phase 08.

If the current repository does not yet have a proper staff/practitioner model, create only the minimum foundation required by appointments.

Do not build the complete doctor profile/dashboard in this phase.

---

# 11. Date/Time Representation

Time handling must be designed carefully.

Store appointment instants in a timezone-safe format, preferably:

```text
PostgreSQL timestamptz
```

Do not store an appointment's actual moment as:

```text
"10:30 AM"
```

or:

```text
"18/09/2026 10:30"
```

as the source of truth.

Display times in the appropriate clinic/user timezone.

The clinic timezone should be configurable rather than scattered throughout the codebase.

For the current clinic deployment, the timezone may be configured according to verified clinic requirements.

---

# 12. Timezone Safety

The system must correctly handle:

```text
User timezone
Clinic timezone
Database UTC representation
```

A recommended model:

```text
Browser / User
      ↓
Local date/time selection
      ↓
Convert using clinic scheduling timezone
      ↓
Store canonical instant
      ↓
Retrieve
      ↓
Display appropriately
```

Do not perform naive string manipulation such as:

```js
new Date("2026-09-18 10:30")
```

when timezone semantics are ambiguous.

Use an explicit, well-defined date/time strategy.

---

# 13. Availability Model

The engine needs a foundation for determining when appointments can be booked.

Conceptually:

```text
Practitioner
    ↓
Working Schedule
    ↓
Available Slots
    ↓
Existing Appointments
    ↓
Blocked Time
    ↓
Bookable Slots
```

Availability should account for:

* Working days
* Working hours
* Appointment duration
* Buffer time if applicable
* Existing appointments
* Clinic closures
* Practitioner unavailable periods
* Minimum booking notice
* Maximum booking horizon

---

# 14. Working Schedule

Establish a reusable schedule model.

Conceptually:

```text
practitioner_availability
--------------------------------
id
practitioner_id
day_of_week
start_time
end_time
active
```

The exact implementation may differ.

The model should support future requirements such as:

```text
Monday
09:00–13:00
14:00–18:00

Tuesday
09:00–13:00
```

Multiple intervals per day should be possible.

---

# 15. Exceptions / Blocked Time

Recurring availability is not enough.

Support a future-compatible mechanism for exceptions such as:

```text
Doctor unavailable
Clinic holiday
Personal leave
Special closure
Blocked appointment slot
```

Conceptually:

```text
schedule_exceptions
--------------------------------
id
practitioner_id
start_at
end_at
reason
```

Do not expose sensitive internal reasons to patients.

---

# 16. Booking Rules

The appointment engine should have explicit business rules.

Examples:

### Minimum notice

Do not allow booking too close to the appointment time.

Example:

```text
Current time: 10:00
Minimum notice: 2 hours
Earliest booking: 12:00
```

The actual value should be configurable.

---

### Booking horizon

Optionally prevent booking too far into the future.

Example:

```text
Maximum horizon: 90 days
```

Do not hard-code arbitrary business values without documenting them.

---

### Past appointments

Never allow a normal user to create an appointment in the past.

---

### Invalid duration

The requested duration must come from the trusted appointment type/configuration.

Do not trust:

```json
{
  "duration": 5000
}
```

sent by the browser.

---

# 17. Double Booking Prevention

This is a mandatory requirement.

Two concurrent requests must not be able to create overlapping appointments for the same practitioner.

Bad architecture:

```text
Request A
 → check slot free
 → slot free

Request B
 → check slot free
 → slot free

A → insert
B → insert
```

Result:

```text
DOUBLE BOOKING ❌
```

Correct architecture must make conflict prevention atomic at the database/business-logic level.

Possible approaches:

* PostgreSQL exclusion constraints
* transactional locking
* carefully designed transactional RPC/function
* equivalent database-level mechanism

Prefer database enforcement rather than relying only on application-level checks.

---

# 18. Overlap Rule

For appointments:

```text
A = [startA, endA)
B = [startB, endB)
```

they overlap when:

```text
startA < endB
AND
endA > startB
```

Back-to-back appointments should normally be allowed:

```text
10:00–10:30
10:30–11:00
```

unless a configured buffer requires separation.

---

# 19. Database-Level Conflict Protection

The final design must prevent concurrent overlapping appointments for the same practitioner.

If PostgreSQL exclusion constraints are appropriate, consider:

```text
practitioner_id
+
tstzrange(start_at, end_at)
```

with:

```text
&&
```

for overlap detection.

Do not implement this blindly; verify compatibility with:

* cancellation
* appointment status
* rescheduling
* inactive appointments
* timezone handling

The database must remain the final source of truth.

---

# 20. Patient Booking

The patient should eventually be able to:

```text
Select appointment type
      ↓
Select practitioner if applicable
      ↓
Select date
      ↓
View available slots
      ↓
Select time
      ↓
Review appointment
      ↓
Confirm/request booking
```

The UX should not expose unavailable slots as selectable.

---

# 21. Booking Confirmation

Before final submission, show:

```text
Appointment type
Practitioner
Date
Time
Duration
Location / mode
```

The user should clearly understand what they are booking.

Do not display:

```text
Appointment confirmed
```

until the server/database operation has actually succeeded.

---

# 22. Appointment Creation

Appointment creation must be server-authorized.

Correct:

```text
Client
 ↓
Validate input
 ↓
Authenticate user
 ↓
Authorize booking operation
 ↓
Resolve trusted appointment type
 ↓
Resolve trusted practitioner
 ↓
Calculate/validate slot
 ↓
Check schedule
 ↓
Atomic conflict-safe insert
 ↓
Return appointment
```

Do not trust the client for:

* patient identity
* practitioner identity permissions
* appointment duration
* status
* creation timestamp
* internal notes
* approval state

---

# 23. Patient Identity

When a patient books for themselves:

```text
patient_id
```

should be derived from the authenticated user.

Do not allow:

```json
{
  "patientId": "someone-elses-id"
}
```

to determine the booking owner.

If a staff member creates an appointment for a patient, that operation must have an appropriate staff permission and explicit patient selection.

---

# 24. Appointment Notes

Separate patient-visible and internal information.

Potential fields:

```text
patient_note
internal_note
```

A patient must never be able to read:

```text
internal_note
```

through a generic appointment query.

Avoid collecting detailed medical information in the booking form.

The booking form should remain operational rather than becoming a clinical-history form.

---

# 25. Appointment List

Authenticated patients should be able to see their appointments.

Useful sections:

```text
Upcoming
Past
Cancelled
```

Each appointment should show:

* Date
* Time
* Practitioner
* Appointment type
* Status
* Location/mode
* Relevant actions

---

# 26. Appointment Detail

A patient appointment detail view should provide:

```text
Appointment information
Status
Date/time
Practitioner
Type
Location
Allowed actions
```

Actions may include:

```text
Cancel
Reschedule
```

only when permitted by business rules.

---

# 27. Cancellation

Cancellation must be explicit.

Before cancellation:

```text
Are you sure you want to cancel this appointment?
```

If a cancellation reason is required, collect it without requesting unnecessary medical information.

Do not physically delete the appointment.

Instead:

```text
status = cancelled
cancelled_at = ...
cancelled_by = ...
```

The exact audit model can evolve in Phase 19.

---

# 28. Cancellation Rules

Define configurable rules such as:

```text
Cancellation cutoff
```

Example:

```text
Cannot cancel within 2 hours of appointment.
```

If the clinic does not require a cutoff yet, document the decision rather than inventing one.

Staff may have broader cancellation capabilities than patients.

---

# 29. Rescheduling

Rescheduling should be treated as a controlled operation.

Conceptually:

```text
Existing appointment
      ↓
Validate current state
      ↓
Validate rescheduling permission
      ↓
Validate new slot
      ↓
Atomic conflict check
      ↓
Update appointment
```

Do not implement rescheduling as:

```text
cancel old
+
create new
```

unless the business model intentionally requires that behavior.

Preserve useful history where possible.

---

# 30. Concurrent Rescheduling

Two simultaneous operations must not result in:

```text
double booking
```

The same database-level conflict protection used for creation must apply to rescheduling.

---

# 31. Appointment History

Appointment history should be preserved.

At minimum, the data model must allow future audit/history capabilities.

Do not overwrite important information in a way that makes it impossible to understand:

```text
what happened
when
```

A full audit timeline belongs to later security/audit hardening if not already available.

---

# 32. Receptionist Compatibility

Phase 09 must expose a clean foundation for Phase 10.

Receptionists will eventually need to:

* view clinic appointments
* search/filter appointments
* create appointments for patients
* reschedule
* cancel
* confirm pending appointments
* manage operational scheduling

Phase 09 should implement the underlying authorization/business rules but should NOT build the full receptionist dashboard.

---

# 33. Doctor Compatibility

Phase 11 will eventually allow doctors to see:

* today's appointments
* upcoming appointments
* appointment details
* patient context

Phase 09 should ensure appointments have a proper practitioner relationship.

Do not build the doctor dashboard in this phase.

---

# 34. Role-Based Access

Use Phase 08 authorization infrastructure.

Conceptually:

### Patient

Allowed:

```text
create own appointment
read own appointments
cancel own appointment
reschedule own appointment
```

subject to business rules.

### Receptionist

Future operational permissions:

```text
read appointments
create appointments for patients
modify appointments
```

### Doctor

Future permissions:

```text
read assigned/permitted appointments
```

### Admin

Administrative appointment access as explicitly defined.

Do not grant broad access merely because a user is authenticated.

---

# 35. Resource-Level Security

An appointment ID must not be sufficient to gain access.

Bad:

```text
GET /api/appointments/123
```

and return appointment 123 simply because the user is authenticated.

Good:

```text
authenticate
→ authorize
→ verify patient ownership OR permitted staff relationship
→ query with RLS
→ return
```

---

# 36. RLS Requirements

Appointment RLS policies must enforce appropriate access.

Patients:

```text
own appointments only
```

Staff:

```text
explicitly authorized appointment access
```

Do not create:

```sql
USING (auth.uid() IS NOT NULL)
```

for sensitive appointment data.

Do not expose all appointment rows to every authenticated user.

---

# 37. Appointment Status Security

Patients must not be able to submit:

```json
{
  "status": "completed"
}
```

or:

```json
{
  "status": "confirmed"
}
```

and have the server blindly accept it.

Status transitions must be controlled by the server and role/business rules.

---

# 38. Trusted Appointment Type

The client may send:

```text
appointmentTypeId
```

but the server must resolve the actual configuration.

Do not trust client-provided:

```text
duration
price
buffer
```

if these values exist.

---

# 39. API / Server Action Design

Use the project's established server architecture.

Possible operations:

```text
getAvailableSlots()
createAppointment()
getMyAppointments()
getAppointment()
cancelAppointment()
rescheduleAppointment()
```

Future staff operations may include:

```text
getClinicAppointments()
confirmAppointment()
createAppointmentForPatient()
```

Do not implement APIs merely for symmetry.

Each operation must have:

* authentication
* authorization
* input validation
* business-rule validation
* safe errors
* appropriate data selection
* RLS/security enforcement

---

# 40. Validation

Use the project's existing validation strategy.

Validate:

* appointment type
* practitioner
* date
* time
* start/end relationship
* appointment duration
* allowed status transition
* cancellation/rescheduling eligibility
* patient ownership
* availability
* booking horizon
* minimum notice

Reject malformed input before database operations.

---

# 41. Error Handling

Use user-friendly errors.

Bad:

```text
duplicate key value violates exclusion constraint
```

Good:

```text
That time slot is no longer available. Please choose another time.
```

This is particularly important for concurrent booking.

Other examples:

```text
This appointment cannot be cancelled now.
```

```text
This appointment can no longer be rescheduled.
```

```text
Please choose an available time.
```

Never expose database internals to users.

---

# 42. Availability Race Condition

Availability shown to the patient is only a snapshot.

Example:

```text
10:30 AM
AVAILABLE
```

User waits 2 minutes.

Another patient books it.

Original patient submits.

The server must respond:

```text
That time slot is no longer available.
```

The system must NOT trust the earlier availability response.

---

# 43. Booking UI

Build a premium Punarvasu appointment experience.

Recommended flow:

```text
Appointment Type
      ↓
Practitioner
      ↓
Date
      ↓
Available Times
      ↓
Review
      ↓
Confirm
```

Use the existing Punarvasu design system.

Avoid a generic SaaS calendar.

The experience should feel:

* calm
* trustworthy
* simple
* premium
* healthcare appropriate

---

# 44. Calendar UX

The booking calendar should:

* clearly distinguish available/unavailable dates
* disable past dates
* handle mobile well
* support keyboard navigation
* communicate loading state
* avoid overwhelming users with unnecessary information

For mobile, time slots may be presented as a clean list/grid rather than forcing a desktop calendar layout.

---

# 45. Loading States

Availability retrieval must have a proper loading state.

Example:

```text
Selecting 18 September...

Loading available times
```

Do not leave a blank page.

---

# 46. Empty Availability

If no slots exist:

```text
No appointments are available on this date.
```

Offer useful alternatives such as:

```text
Choose another date
```

Do not fabricate availability.

---

# 47. Error State

If availability cannot be loaded:

```text
We couldn't load available times right now.
Please try again.
```

Do not expose:

```text
PostgreSQL timeout
RPC error
Supabase error
```

to patients.

---

# 48. Appointment Confirmation UI

After successful creation:

```text
Appointment requested
```

or:

```text
Appointment confirmed
```

depending on the actual status.

Show:

* date
* time
* practitioner
* appointment type
* location/mode
* status
* next useful action

Do not claim confirmation if the status is still `pending`.

---

# 49. Appointment History UI

The patient appointment area should support:

```text
Upcoming
Past
Cancelled
```

with appropriate empty states.

Example:

```text
You don't have any upcoming appointments.
```

Use a clear CTA where appropriate.

---

# 50. Public vs Authenticated Booking

Do not implement anonymous appointment booking in this phase unless explicitly required.

The preferred model is:

```text
Public website
    ↓
Book a Consultation
    ↓
Authentication
    ↓
Patient profile
    ↓
Appointment booking
```

This preserves identity and ownership.

---

# 51. Patient Profile Dependency

If appointment booking requires a patient profile:

```text
Authenticated user
       ↓
Patient profile exists?
       ↓
No → onboarding/profile completion
Yes → booking
```

Do not duplicate profile information into appointments unnecessarily.

---

# 52. Data Minimization

Appointment creation should not request:

* detailed diagnosis
* complete medical history
* medication list
* lab results
* clinical notes

Those belong to clinical workflows.

A short optional booking note may be permitted if justified.

---

# 53. Notification Boundary

Appointment creation should be designed so Phase 15 can later trigger:

```text
booking confirmation
appointment reminder
cancellation notification
reschedule notification
```

Do not build the full notification system in this phase.

If event hooks are useful, establish a clean internal event boundary.

---

# 54. Analytics Boundary

Do not build appointment analytics yet.

However, retain clean timestamps/status information so Phase 16 can calculate:

* bookings
* cancellations
* completion rate
* no-shows
* utilization
* practitioner workload

---

# 55. Security Considerations

Sensitive appointment data must never be:

* publicly accessible
* embedded in public pages
* exposed in SEO metadata
* cached publicly
* stored in URL query parameters unnecessarily
* written to localStorage
* returned in excessive API payloads

---

# 56. Performance

Availability queries can become expensive.

Design for efficient queries using:

* appropriate indexes
* bounded date ranges
* practitioner/date filtering
* status filtering
* efficient conflict queries

Do not query the entire appointment table to determine a single day's availability.

---

# 57. Recommended Indexes

Depending on the final schema, consider indexes around:

```text
patient_id
practitioner_id + start_at
status + start_at
appointment_type_id
```

Use actual query patterns to determine the final indexes.

Do not add indexes without considering write cost and actual query needs.

---

# 58. Caching

Availability is time-sensitive.

Avoid aggressive public caching of:

```text
available appointment slots
```

If caching is introduced later, it must account for rapid invalidation/staleness.

Never cache private appointment data publicly.

---

# 59. Accessibility

The booking experience must support:

* keyboard navigation
* screen readers
* visible focus
* semantic date controls
* accessible time-slot buttons
* meaningful labels
* accessible validation messages
* sufficient contrast
* mobile touch targets

Do not communicate availability using color alone.

---

# 60. Responsive Requirements

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

The complete booking flow must remain usable on mobile.

---

# 61. Few-Shot Examples

## Example 1 — Double Booking

### Bad

```text
Client checks slot
→ available
→ inserts appointment
```

### Good

```text
Client requests booking
→ server validates
→ database atomically prevents overlap
→ success OR slot-unavailable
```

---

## Example 2 — Patient ID

### Bad

```json
{
  "patientId": "another-patient"
}
```

Trusting this value from the patient browser.

### Good

```text
Authenticated user
→ resolve own patient profile
→ create appointment for that patient
```

---

## Example 3 — Appointment Status

### Bad

```json
{
  "status": "completed"
}
```

Client sends desired status and server saves it.

### Good

```text
Client requests allowed operation
→ server determines valid transition
→ authorization check
→ update status
```

---

## Example 4 — Duration

### Bad

```json
{
  "duration": 15
}
```

Trusting the client.

### Good

```text
Client → appointmentTypeId
Server → trusted appointment type configuration
Server → trusted duration
```

---

## Example 5 — Availability

### Bad

```text
UI showed 10:30 AM available
→ therefore booking must succeed
```

### Good

```text
UI showed 10:30 AM available
→ user submits later
→ server revalidates
→ database prevents conflict
→ booking succeeds or returns slot unavailable
```

---

## Example 6 — Cancellation

### Bad

```text
DELETE /appointments/123
```

### Good

```text
Appointment
→ validate cancellation permission
→ validate cancellation rules
→ status = cancelled
→ preserve historical record
```

---

## Example 7 — Timezone

### Bad

```text
Store:
"18/09/2026 10:30 AM"
```

### Good

```text
Explicit clinic scheduling timezone
→ canonical timestamp
→ timezone-safe database storage
→ localized display
```

---

## Example 8 — Error Message

### Bad

```text
duplicate key value violates appointments_practitioner_time_exclusion
```

### Good

```text
That time slot is no longer available.
Please choose another time.
```

---

# 62. Expected Files / Architectural Areas

Adapt these to the existing repository:

```text
src/
  app/
    patient/
      appointments/
        page.tsx
        [id]/
          page.tsx
        book/
          page.tsx

  components/
    appointments/
      appointment-booking.tsx
      appointment-calendar.tsx
      appointment-time-slots.tsx
      appointment-summary.tsx
      appointment-card.tsx
      appointment-status.tsx

  lib/
    appointments/
      availability.ts
      validation.ts
      status.ts
      conflicts.ts

  server/
    appointments/
      queries.ts
      mutations.ts
      authorization.ts

  config/
    appointments/

supabase/
  migrations/
    ...appointments...
```

The exact structure must follow the architecture established in Phase 01 and subsequent phases.

Do not create unnecessary duplication.

---

# 63. Database Objects

Depending on the final architecture, establish appropriate equivalents for:

```text
appointments
appointment_types
practitioner_availability
schedule_exceptions
```

Not every table must be implemented if the existing architecture already provides the equivalent.

Ensure:

* foreign keys
* constraints
* indexes
* timestamps
* appropriate status constraints
* RLS
* ownership/access policies

are properly designed.

---

# 64. Appointment Type Management

Do not build a full admin CRUD interface for appointment types.

For this phase, appointment types can be:

* migration/configuration seeded
* server-controlled
* read-only to patients

Future admin management can be introduced later.

Do not fabricate production clinical offerings.

---

# 65. Availability Management

Do not build the complete receptionist/doctor scheduling management interface.

Establish the underlying scheduling model and seed/configure only verified development data where necessary.

Phase 10/11 can expose operational management later.

---

# 66. Tests

The test suite must cover at minimum:

## Creation

* authenticated patient can create valid appointment
* unauthenticated user cannot create appointment
* patient cannot create appointment for another patient
* invalid appointment type is rejected
* invalid practitioner is rejected
* past appointment is rejected
* invalid date/time is rejected

## Availability

* working hours produce expected slots
* unavailable periods are excluded
* existing appointments are excluded
* blocked periods are excluded
* past times are excluded
* minimum notice is respected if enabled
* booking horizon is respected if enabled

## Conflicts

Mandatory:

```text
Two concurrent requests for the same slot
→ at most one succeeds
```

Also test:

```text
overlapping appointments
back-to-back appointments
different practitioners
cancelled appointments
rescheduled appointments
```

---

# 67. Status Tests

Test valid transitions:

```text
pending → confirmed
pending → cancelled

confirmed → completed
confirmed → cancelled
confirmed → no_show
```

Reject invalid transitions such as:

```text
completed → pending
cancelled → completed
no_show → pending
```

unless a specific documented business rule allows them.

---

# 68. Authorization Tests

Test:

```text
patient → own appointment = ALLOW
patient → another patient's appointment = DENY

patient → staff appointment management = DENY

receptionist → permitted operational action = ALLOW
receptionist → doctor-only clinical action = DENY

doctor → permitted appointment view = ALLOW
doctor → admin-only operation = DENY

admin → explicitly permitted appointment administration = ALLOW
```

The exact permission matrix must follow Phase 08.

---

# 69. RLS Tests

Verify directly against the database security boundary.

At minimum:

```text
User A
  → User A appointment = allowed

User A
  → User B appointment = denied
```

Also test staff access according to the final policy.

Do not rely only on UI tests.

---

# 70. Security Adversarial Tests

Attempt to manipulate:

```text
patientId
practitionerId
appointmentId
appointmentTypeId
status
startAt
endAt
duration
```

from the browser/request.

Verify the server derives or validates all security-sensitive values.

Attempt:

```text
duplicate booking
concurrent booking
unauthorized cancellation
unauthorized rescheduling
cross-user appointment access
```

All unauthorized operations must fail.

---

# 71. Acceptance Criteria

Phase 09 is complete only when:

### Appointment Model

* [ ] Appointment database model exists.
* [ ] Patient relationship is secure.
* [ ] Practitioner relationship is secure.
* [ ] Appointment type is trusted/configured.
* [ ] Status values are constrained.
* [ ] Timestamps are timezone-safe.

### Availability

* [ ] Practitioner schedule model exists.
* [ ] Working hours are respected.
* [ ] Existing appointments are excluded.
* [ ] Blocked/unavailable periods are respected.
* [ ] Past slots are unavailable.
* [ ] Booking rules are enforced.

### Booking

* [ ] Authenticated patient can book.
* [ ] Patient identity is derived securely.
* [ ] Client cannot assign another patient.
* [ ] Client cannot control trusted duration/status.
* [ ] Booking is server-authorized.
* [ ] Booking conflicts are atomically prevented.

### Rescheduling/Cancellation

* [ ] Cancellation is authorization-controlled.
* [ ] Cancellation preserves appointment history.
* [ ] Rescheduling is authorization-controlled.
* [ ] Rescheduling revalidates availability.
* [ ] Invalid status transitions are rejected.

### Security

* [ ] RLS is enabled/configured appropriately.
* [ ] Cross-patient access is denied.
* [ ] IDOR attempts fail.
* [ ] Privilege escalation attempts fail.
* [ ] Sensitive data is not publicly exposed.
* [ ] Service-role credentials are never exposed.

### UX

* [ ] Booking flow is complete.
* [ ] Appointment list exists for patients.
* [ ] Appointment detail exists.
* [ ] Loading states exist.
* [ ] Empty states exist.
* [ ] Error states exist.
* [ ] Confirmation state reflects actual server status.
* [ ] Cancellation/rescheduling UX is safe.
* [ ] Mobile experience is polished.
* [ ] Accessibility requirements are met.

### Engineering

* [ ] Existing design system is reused.
* [ ] Existing authentication/authorization architecture is reused.
* [ ] No unnecessary client-side security logic.
* [ ] TypeScript remains strict.
* [ ] Lint passes.
* [ ] Typecheck passes.
* [ ] Tests pass.
* [ ] Production build passes.

---

# 72. Definition of Done

Phase 09 is done when Punarvasu has a secure, reliable appointment engine capable of:

```text
Determine availability
       ↓
Allow authorized booking
       ↓
Prevent conflicts
       ↓
Track appointment status
       ↓
Allow permitted cancellation
       ↓
Allow permitted rescheduling
       ↓
Preserve appointment history
```

The system must remain safe under concurrent requests and malicious client input.

The appointment engine must be ready to serve as the backend foundation for:

```text
Phase 10 — Receptionist Workspace
Phase 11 — Doctor Dashboard
```

---

# 73. Explicitly Out of Scope

Do NOT implement:

* Full receptionist dashboard
* Full doctor dashboard
* Clinical consultation records
* Diagnosis
* Prescription
* Treatment plans
* Patient documents
* Notification delivery
* SMS/email reminder system
* Analytics dashboards
* AI clinical assistance
* Payment processing
* Telemedicine
* Full staff scheduling administration UI
* Full audit/compliance subsystem

Those belong to later phases.

---

# 74. Final Verification

Run the project's actual verification commands, including:

```text
lint
typecheck
tests
production build
```

Then manually verify:

```text
Patient:
  Book
  View
  Cancel
  Reschedule

Unauthorized:
  Cross-patient access
  Invalid status changes
  Manipulated patient ID
  Manipulated practitioner ID
  Manipulated duration
  Double booking

Scheduling:
  Available slot
  Unavailable slot
  Existing appointment
  Blocked period
  Past time
  Concurrent booking
```

All must behave according to the documented rules.

---

# 75. Completion Report

At completion, report:

## Implemented

* Appointment schema
* Appointment types
* Practitioner scheduling foundation
* Availability engine
* Booking flow
* Appointment list/detail
* Cancellation
* Rescheduling
* Status lifecycle
* Conflict prevention
* RLS
* Authorization
* Tests

## Database

Report:

```text
Tables:
Enums:
Constraints:
Indexes:
RLS policies:
Functions/RPCs:
```

## Security Verification

Report:

```text
Cross-user access:
Privilege escalation:
IDOR:
Concurrent booking:
Client field manipulation:
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

List intentionally deferred functionality.

## Phase Status

```text
Phase 09: COMPLETE
Ready for Phase 10: YES/NO
```

Do not begin Phase 10 during this phase.
