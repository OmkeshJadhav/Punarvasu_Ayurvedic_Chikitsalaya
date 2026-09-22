# Phase 10 — Receptionist Workspace

## 1. Phase Objective

Build the production-quality **Receptionist Workspace** for Punarvasu.

The receptionist is the clinic's primary operational user. Their interface should make everyday clinic coordination fast, clear, reliable, and low-friction.

The workspace should allow an authorized receptionist to manage operational workflows such as:

* Today's appointments
* Upcoming appointments
* Appointment confirmation
* Appointment creation for patients
* Rescheduling
* Cancellation
* Patient lookup
* Patient onboarding assistance
* Appointment status management
* Schedule visibility
* Operational search/filtering
* Appointment details
* Basic patient profile information required for operations

The receptionist must **not** automatically receive access to:

* Doctor-only clinical records
* Doctor notes
* Diagnosis
* Prescription authoring
* Treatment plans
* Sensitive clinical documents
* AI clinical analysis
* Administrative user/role management

The architecture should remain compatible with:

```text
Phase 08 — Authorization
        ↓
Phase 09 — Appointment Engine
        ↓
Phase 10 — Receptionist Workspace
        ↓
Phase 11 — Doctor Dashboard
```

---

# 2. Product Philosophy

The receptionist workspace is an **operations console**, not a generic analytics dashboard.

The primary question should be:

> "What does the receptionist need to do right now?"

The interface should prioritize:

```text
TODAY
  ↓
Appointments
  ↓
Patient lookup
  ↓
Operational actions
  ↓
Exceptions requiring attention
```

Avoid filling the screen with meaningless:

* KPI cards
* charts
* decorative gradients
* excessive tables
* unnecessary widgets

The workspace should feel:

* fast
* calm
* professional
* trustworthy
* information-dense without being cluttered
* optimized for repeated daily use

---

# 3. Receptionist Role

Use the Phase 08 authorization system.

The receptionist should have a dedicated application role:

```text
receptionist
```

Do not implement receptionist access through:

```text
email address
localStorage
client state
hard-coded user IDs
```

All sensitive operations must be authorized server-side.

---

# 4. Receptionist Access Boundary

The receptionist should generally be able to perform operational actions.

Examples:

```text
Appointments
  View
  Create
  Confirm
  Reschedule
  Cancel
  Update operational status

Patients
  Search
  View permitted profile information
  Assist with basic onboarding/profile completion
```

The receptionist should NOT automatically receive:

```text
Clinical records
Doctor notes
Diagnosis
Prescriptions
Treatment plans
AI analysis
Administrative role management
```

If a future requirement needs receptionist access to a specific field, that permission must be explicitly introduced.

---

# 5. Route Architecture

Introduce a receptionist application area.

Preferred structure:

```text
/receptionist
/receptionist/appointments
/receptionist/patients
```

Potential future routes:

```text
/receptionist/appointments/[id]
/receptionist/patients/[id]
```

The exact routing should follow the existing project architecture.

Every route must require:

```text
authenticated
+
receptionist permission/role
```

Do not rely on the existence of the route itself as protection.

---

# 6. Receptionist Home

The primary receptionist landing page should answer:

> "What needs my attention today?"

Recommended structure:

```text
Header
  ↓
Today at a glance
  ↓
Today's appointments
  ↓
Pending actions
  ↓
Quick patient search
  ↓
Operational shortcuts
```

Possible information:

* Today's appointment count
* Pending confirmations
* Upcoming appointment
* Current time / clinic day context
* Cancelled appointments requiring attention
* No-show/completion status where appropriate

Do not invent numbers.

All counts must come from real data.

---

# 7. Today's Appointments

This is the primary workspace.

Show appointments ordered chronologically.

Useful columns/information:

```text
Time
Patient
Appointment Type
Practitioner
Status
Actions
```

Depending on screen size, additional information can be shown.

Example:

```text
10:00 AM
Priya Sharma
Initial Consultation
Dr. Example
Confirmed
```

---

# 8. Appointment Status Visualization

Use the Punarvasu design system.

Statuses should be visually distinguishable:

```text
Pending
Confirmed
Completed
Cancelled
No Show
```

Do not rely only on color.

Use:

* text
* accessible badges
* icons where useful
* semantic status labels

---

# 9. Current Appointment

The receptionist should be able to quickly identify the appointment currently in progress or nearest to the current time.

For example:

```text
NOW
10:30 AM
Rahul Patil
Dr. Example
Confirmed
```

Do not create a fake real-time indicator if actual current-time logic is unavailable.

---

# 10. Quick Actions

The receptionist should have prominent but restrained actions such as:

```text
New Appointment
Find Patient
Today's Schedule
```

Do not create dozens of action buttons.

Primary actions should be visually clear.

---

# 11. Patient Search

Patient search is a critical receptionist workflow.

The receptionist should be able to search using appropriate permitted identifiers, such as:

* Patient name
* Phone number
* Email where appropriate
* Other approved non-sensitive identifier

Do not make detailed clinical information searchable.

---

# 12. Patient Search UX

Recommended:

```text
Search patients...
```

As the receptionist types:

```text
Matching Patients
────────────────────────
Priya Sharma
98xxxxxx12

Rahul Patil
97xxxxxx45
```

The search should be:

* fast
* debounced where appropriate
* paginated/limited
* secure
* privacy-conscious

Do not load every patient into the browser.

---

# 13. Patient Search Security

Patient search is sensitive.

Requirements:

* receptionist authentication required
* receptionist permission required
* server-side query
* RLS/authorization
* bounded result size
* no unrestricted export
* no unnecessary clinical fields

Do not allow:

```text
/api/patients?all=true
```

to return the entire patient database.

---

# 14. Patient Profile Access

The receptionist may need basic patient information for operational work.

Examples:

```text
Name
Preferred name
Phone
Email where appropriate
Date of birth where operationally necessary
Address where operationally necessary
Emergency contact where justified
```

Do not expose:

```text
Clinical diagnosis
Doctor notes
Prescription
Treatment plan
Clinical documents
AI analysis
```

unless a future explicit permission authorizes a particular field.

---

# 15. Patient Profile Modal / Drawer

For fast operational workflows, consider a modal or drawer for basic patient details.

Example:

```text
Patient
Priya Sharma

Phone
98xxxxxx12

Date of Birth
...

Upcoming Appointments
...

[Book Appointment]
[View Profile]
```

Do not turn the receptionist view into a clinical chart.

---

# 16. Create Appointment for Patient

The receptionist should be able to create an appointment for a patient.

Flow:

```text
Find Patient
      ↓
Select Patient
      ↓
Appointment Type
      ↓
Practitioner
      ↓
Date
      ↓
Available Time
      ↓
Review
      ↓
Create
```

Reuse the Phase 09 appointment engine.

Do not duplicate scheduling logic.

---

# 17. Appointment Creation Architecture

The UI should call the same trusted appointment service/business logic used by the patient flow.

Correct:

```text
Receptionist UI
      ↓
Server authorization
      ↓
Appointment service
      ↓
Availability validation
      ↓
Conflict prevention
      ↓
Database
```

Do NOT create:

```text
Receptionist UI
      ↓
Direct database insert
```

---

# 18. Receptionist Booking Identity

Unlike patient self-booking, the receptionist may explicitly select a patient.

However:

```text
selectedPatientId
```

must still be validated server-side.

The receptionist's permission must be checked.

The server must verify that the target patient exists and that the receptionist is authorized to create an appointment for them.

---

# 19. Appointment Confirmation

Receptionists should be able to confirm pending appointments if the Phase 08 permission model allows it.

Example:

```text
Pending
   ↓
Confirm
   ↓
Confirmed
```

The status transition must be performed server-side.

The client must never be able to directly set:

```text
status = confirmed
```

without authorization.

---

# 20. Cancellation

Receptionists should be able to cancel appointments according to clinic rules.

Before cancellation:

```text
Cancel appointment?

This will remove it from the active schedule.
```

If a cancellation reason is required, capture an operational reason.

Do not require unnecessary medical information.

Preserve the appointment record.

---

# 21. Rescheduling

Receptionists should be able to reschedule an appointment.

Flow:

```text
Existing Appointment
      ↓
Reschedule
      ↓
Select New Date
      ↓
Select Available Time
      ↓
Review
      ↓
Confirm
```

The appointment engine must revalidate availability.

Do not assume a displayed slot remains available.

---

# 22. Appointment Detail

The receptionist appointment detail page/modal should show operational information.

Example:

```text
Appointment

10:30 AM
18 September 2026

Patient
Priya Sharma

Practitioner
Dr. Example

Type
Initial Consultation

Status
Confirmed
```

Actions:

```text
Reschedule
Cancel
Confirm
```

Only show actions permitted by the appointment's current state and receptionist permissions.

---

# 23. Appointment Filters

Receptionists should be able to filter appointments by useful operational attributes.

Potential filters:

```text
Date
Practitioner
Status
Appointment Type
```

Avoid unnecessary filter complexity.

---

# 24. Search Appointments

Provide appointment search where useful.

Potential search:

```text
Patient name
Phone
Appointment identifier
```

Search should be:

* server-side
* bounded
* authorized
* indexed where appropriate

---

# 25. Date Navigation

Receptionists should be able to navigate:

```text
Today
Tomorrow
Specific date
```

Potentially:

```text
Previous day
Next day
```

Do not require a large complicated calendar if a simple schedule view is more efficient.

---

# 26. Schedule Views

The workspace may provide:

```text
Day
Week
```

views if they materially improve operational workflows.

Do not build a complex drag-and-drop calendar unless genuinely required.

The initial default should prioritize the daily schedule.

---

# 27. Practitioner Filtering

The receptionist should be able to filter the schedule by practitioner.

Example:

```text
All practitioners
Dr. A
Dr. B
```

Only active/valid practitioners should appear.

Do not expose inactive/internal staff unnecessarily.

---

# 28. Appointment Timeline

A timeline-style day view may work well:

```text
09:00 ─────────
09:30 ─────────
10:00  Priya
10:30  Rahul
11:00 ─────────
```

The design must remain readable on mobile.

Do not sacrifice usability for visual novelty.

---

# 29. Operational Status Actions

Depending on clinic workflow, receptionists may need to mark:

```text
Confirmed
Completed
No Show
Cancelled
```

However, status permissions must follow the Phase 08 policy and Phase 09 transition rules.

Do not give the receptionist unrestricted status editing.

---

# 30. No-Show Handling

If supported by the workflow:

```text
Confirmed
    ↓
No Show
```

The receptionist should have a clear action.

Use confirmation where the change has operational significance.

---

# 31. Completion Handling

Whether receptionists can mark an appointment as completed should be an explicit business decision.

If not explicitly authorized:

```text
Completed
```

should remain a doctor/workflow responsibility.

Do not infer permissions merely because the receptionist can manage appointments.

---

# 32. Patient Onboarding Assistance

A receptionist may need to help create/complete a patient profile.

Possible flow:

```text
New Patient
      ↓
Basic identity information
      ↓
Contact information
      ↓
Create/associate patient
      ↓
Book appointment
```

Do not collect detailed clinical information here.

---

# 33. Duplicate Patient Prevention

When creating/searching patients, prevent obvious duplicate identities where practical.

Examples:

```text
Same phone
Same email
Similar name + date of birth
```

Do not automatically merge patients based only on fuzzy similarity.

If a possible duplicate is detected:

```text
A patient with similar details already exists.
Please verify before creating another profile.
```

The receptionist should explicitly choose the existing patient or continue only when appropriate.

---

# 34. Patient Creation Security

Receptionist-created patient profiles must:

* be server-authorized
* validate input
* enforce unique constraints where appropriate
* avoid arbitrary `user_id` assignment
* avoid privilege escalation
* avoid creating admin/doctor accounts through patient onboarding

Do not let the receptionist assign staff roles.

---

# 35. Patient Identity vs Auth Account

Keep the distinction:

```text
auth.users
    ↓
application identity
    ↓
patient profile
```

A receptionist creating a patient record must not bypass the established identity architecture.

If a patient does not yet have an authentication account, the implementation should follow the product's approved onboarding model rather than inventing credentials.

Do not create passwords on behalf of patients.

---

# 36. Privacy

Receptionist screens contain sensitive personal information.

Requirements:

* no public caching
* no SEO indexing
* no sensitive data in URLs unnecessarily
* no sensitive information in browser localStorage
* minimal data returned from APIs
* secure server-side queries
* safe error messages

---

# 37. Data Access Minimization

Do not use:

```text
SELECT *
```

for receptionist patient/appointment queries if it returns unnecessary sensitive information.

Select only fields required by the workflow.

---

# 38. Server-Side Authorization

Every receptionist operation must independently authorize the current user.

Example:

```text
GET appointments
→ require receptionist permission

CREATE appointment
→ require appointment.create/manage permission

CANCEL appointment
→ require appointment.cancel/manage permission

SEARCH patients
→ require patient.search permission
```

Do not assume that because the user reached `/receptionist`, every server operation is permitted.

---

# 39. RLS

RLS must remain the database security boundary.

Receptionist access should be explicitly defined.

Avoid broad policies such as:

```sql
auth.uid() IS NOT NULL
```

for sensitive tables.

The exact RLS implementation should follow the Phase 08 authorization architecture.

---

# 40. Cross-Role Isolation

Verify:

```text
Patient → receptionist workspace = DENIED
Doctor → receptionist-only operations = DENIED where appropriate
Receptionist → clinical authoring = DENIED
Receptionist → admin role management = DENIED
```

Do not accidentally give receptionists broader access simply because they need operational patient data.

---

# 41. Doctor Information

The receptionist needs enough practitioner information to schedule appointments.

This may include:

```text
Name
Verified professional display information
Availability
Appointment types
```

Do not expose private staff information unnecessarily.

---

# 42. Dashboard Metrics

Keep receptionist metrics operational.

Useful examples:

```text
Today's appointments
Pending confirmations
Upcoming appointments
Cancelled today
No-shows today
```

Avoid:

```text
Revenue
Clinical outcomes
Diagnosis statistics
Patient health analytics
```

unless later explicitly authorized.

---

# 43. Real-Time Updates

The workspace may benefit from near-real-time appointment updates.

Examples:

```text
Another receptionist confirms appointment
Appointment gets cancelled
New appointment appears
```

If Supabase realtime is used, ensure:

* subscriptions are authorized
* data is scoped
* unnecessary sensitive data is not broadcast
* subscriptions are cleaned up
* realtime is not used as the security boundary

If realtime adds unnecessary complexity at this stage, polling/revalidation is acceptable.

---

# 44. Optimistic Updates

Use optimistic UI only where safe.

For example:

```text
Mark confirmed
```

can optimistically update the UI only if rollback is implemented correctly.

For critical scheduling operations, prefer server-confirmed state.

Never show a successful booking/update before the server confirms it.

---

# 45. Error Handling

Examples:

### Conflict

```text
This appointment slot is no longer available.
Please choose another time.
```

### Unauthorized

```text
You don't have permission to perform this action.
```

### Patient not found

```text
We couldn't find a patient matching those details.
```

### Server error

```text
Something went wrong while updating the appointment.
Please try again.
```

Never expose:

* SQL errors
* Supabase internals
* stack traces
* policy names
* service-role errors

---

# 46. Loading States

Use:

* table skeletons
* appointment skeletons
* search loading indicators
* button pending states
* modal loading states

Do not allow double submission.

Example:

```text
Confirming...
```

instead of:

```text
Confirm
Confirm
Confirm
```

---

# 47. Empty States

Examples:

```text
No appointments today.
```

```text
No patients found.
```

```text
No appointments match these filters.
```

Provide useful next actions.

---

# 48. Mobile Experience

Receptionists may use tablets or smaller screens.

The workspace must work well at:

```text
320px
375px
390px
430px
768px
1024px
1280px+
```

On smaller screens:

* convert dense tables to cards/lists
* keep primary actions accessible
* use drawers/bottom sheets where appropriate
* avoid horizontal scrolling where possible

---

# 49. Accessibility

Ensure:

* keyboard navigation
* semantic controls
* visible focus
* accessible dialogs
* accessible date/time controls
* screen-reader labels
* sufficient contrast
* status communicated beyond color
* confirmation dialogs correctly labelled
* focus restoration after modal close

---

# 50. Performance

The receptionist workspace should feel fast even with a large patient/appointment database.

Requirements:

* server-side pagination
* bounded queries
* appropriate indexes
* debounced search
* avoid fetching unnecessary columns
* avoid loading entire patient database
* avoid loading months of appointments unnecessarily

---

# 51. Pagination

Appointment and patient search results should be bounded.

Do not load:

```text
10,000 patients
```

into the browser.

Use:

```text
page
limit
cursor
```

or another appropriate pagination strategy.

---

# 52. Search Indexing

Based on actual queries, consider indexes for:

```text
patient name
phone
email
appointment date
practitioner
status
```

Do not add expensive indexes blindly.

---

# 53. Audit Considerations

Operationally important actions should be designed for future auditability.

Examples:

```text
Appointment created by receptionist
Appointment cancelled by receptionist
Appointment rescheduled by receptionist
Appointment status changed
Patient profile created/updated
```

At minimum, preserve:

```text
created_by
updated_by
timestamps
```

where appropriate.

Full audit infrastructure belongs to Phase 19 if not already established.

---

# 54. Notifications Boundary

Phase 10 should not implement the complete notification system.

However, actions should be structured so Phase 15 can later trigger:

```text
Appointment confirmed
Appointment cancelled
Appointment rescheduled
Patient created
```

Do not send duplicate notifications from multiple UI components.

---

# 55. Analytics Boundary

Do not build a full analytics dashboard.

The data model should support future reporting.

Potential future metrics:

```text
appointments/day
cancellation rate
no-show rate
practitioner utilization
booking lead time
```

---

# 56. Design Requirements

Use the Punarvasu design system from Phase 02.

The workspace should feel like:

> A premium healthcare operations workspace.

Avoid:

* generic SaaS templates
* excessive rounded cards
* huge colorful KPI tiles
* unnecessary gradients
* excessive shadows
* decorative illustrations
* emoji
* cluttered dashboards

The visual hierarchy should emphasize operational clarity.

---

# 57. Recommended Layout

Desktop:

```text
┌────────────────────────────────────────────────────────────┐
│ Punarvasu     Search        Notifications     Profile      │
├──────────────┬─────────────────────────────────────────────┤
│              │                                             │
│ Dashboard    │ Today                                       │
│ Appointments │                                             │
│ Patients     │ 12 Appointments     3 Pending               │
│              │                                             │
│              │ Today's Schedule                            │
│              │                                             │
│              │ 09:00  Patient A    Confirmed               │
│              │ 09:30  Patient B    Pending                │
│              │ 10:00  Patient C    Confirmed               │
│              │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

This is a conceptual example only.

Do not reproduce it literally if the existing design system suggests a better composition.

---

# 58. Few-Shot Examples

## Example 1 — Authorization

### Bad

```ts
if (pathname.startsWith("/receptionist")) {
  return true;
}
```

### Good

```text
Route access
→ authenticated user
→ receptionist permission
→ allow/deny

Sensitive server operation
→ authenticate
→ authorize operation
→ validate input
→ execute
→ RLS
```

---

## Example 2 — Patient Search

### Bad

```text
Load all patients
→ filter in browser
```

### Good

```text
Search term
→ debounced request
→ server authorization
→ bounded database query
→ minimal fields
→ paginated results
```

---

## Example 3 — Appointment Creation

### Bad

```text
Receptionist form
→ direct Supabase insert
```

### Good

```text
Receptionist
→ authorized server action
→ validate patient
→ validate appointment type
→ validate practitioner
→ calculate/validate slot
→ conflict-safe appointment service
→ database/RLS
```

---

## Example 4 — Clinical Data

### Bad

```text
Receptionist Patient Page

Name
Phone
Diagnosis
Prescription
Doctor Notes
Treatment Plan
```

### Good

```text
Receptionist Patient Page

Name
Phone
Operational appointment information

Clinical data
→ not exposed unless an explicit future permission requires it
```

---

## Example 5 — Status

### Bad

```text
Status dropdown:
Pending
Confirmed
Completed
Cancelled
No Show
```

with every value always selectable.

### Good

```text
Current status
→ determine valid transitions
→ show only permitted actions
→ server validates transition
→ database updates
```

---

## Example 6 — Search Results

### Bad

```text
Search "Priya"
→ return every patient field
```

### Good

```text
Search "Priya"
→ return minimum operational fields
→ receptionist selects patient
→ detailed permitted profile loaded only when required
```

---

## Example 7 — Duplicate Patient

### Bad

```text
Receptionist enters patient
→ always create new patient
```

### Good

```text
Receptionist enters identifying information
→ search possible matches
→ show possible duplicate
→ receptionist verifies
→ use existing patient OR intentionally create new record
```

---

## Example 8 — Booking Race

### Bad

```text
Slot displayed as available
→ receptionist assumes it remains available
→ appointment inserted
```

### Good

```text
Slot displayed as available
→ receptionist submits
→ Phase 09 appointment service revalidates
→ database conflict protection
→ success OR slot unavailable
```

---

# 59. Expected Architectural Areas

Adapt to the repository:

```text
src/
  app/
    receptionist/
      page.tsx
      appointments/
      patients/

  components/
    receptionist/
      receptionist-shell.tsx
      today-overview.tsx
      appointment-list.tsx
      appointment-actions.tsx
      patient-search.tsx
      patient-summary.tsx

  server/
    receptionist/
      queries.ts
      mutations.ts

  lib/
    receptionist/

supabase/
  migrations/
```

Do not blindly create these exact directories.

Follow the established project architecture.

---

# 60. Database Changes

Prefer reusing Phase 09 models.

Only introduce new database structures when genuinely necessary.

Potential additions:

```text
created_by
updated_by
operational audit metadata
```

if compatible with the existing design.

Do not duplicate:

```text
appointments
patients
practitioners
```

just for the receptionist UI.

---

# 61. Authorization Matrix

Establish and document a clear matrix.

Example:

| Operation                      |       Patient | Receptionist |     Doctor |         Admin |
| ------------------------------ | ------------: | -----------: | ---------: | ------------: |
| View own appointments          |           Yes |            — |          — |             — |
| Search patients                |            No |          Yes | Controlled |    Controlled |
| Create appointment for self    |           Yes |            — |          — |             — |
| Create appointment for patient |            No |          Yes | Controlled |    Controlled |
| Confirm appointment            |            No |          Yes | Controlled |    Controlled |
| Cancel appointment             |           Own |          Yes | Controlled |    Controlled |
| Reschedule appointment         |           Own |          Yes | Controlled |    Controlled |
| View clinical records          | Own/permitted |           No |        Yes | Explicit only |
| Write clinical records         |            No |           No |        Yes | Explicit only |
| Manage roles                   |            No |           No |         No |           Yes |

This table is illustrative and must be reconciled with Phase 08 and actual product requirements.

---

# 62. Security Testing

Mandatory tests include:

### Route security

```text
Unauthenticated → /receptionist = DENIED
Patient → /receptionist = DENIED
Doctor → receptionist-only operation = DENIED where appropriate
Receptionist → /receptionist = ALLOWED
Admin → permitted administrative access = ALLOWED
```

---

### Patient data

```text
Receptionist → permitted patient profile = ALLOWED
Receptionist → unauthorized clinical record = DENIED
Receptionist → arbitrary patient ID without permission = DENIED
```

---

### Appointment operations

```text
Receptionist → valid appointment action = ALLOWED
Receptionist → invalid status transition = DENIED
Receptionist → manipulated patientId = DENIED
Receptionist → manipulated practitionerId = DENIED
Receptionist → manipulated duration = DENIED
```

---

### Privilege escalation

Verify receptionist cannot:

```text
assign admin role
assign doctor role
modify permissions
access service-role functionality
```

---

# 63. Acceptance Criteria

Phase 10 is complete only when:

### Workspace

* [ ] Receptionist has a dedicated protected workspace.
* [ ] Dashboard prioritizes today's operational work.
* [ ] Today's appointments are visible.
* [ ] Appointment statuses are clear.
* [ ] Quick actions are available.
* [ ] Workspace is responsive.

### Appointments

* [ ] Receptionist can view authorized appointments.
* [ ] Receptionist can create appointments for patients where permitted.
* [ ] Confirmation works through the Phase 09 engine.
* [ ] Cancellation works through the Phase 09 engine.
* [ ] Rescheduling works through the Phase 09 engine.
* [ ] Invalid status transitions are prevented.
* [ ] Double booking remains impossible.

### Patients

* [ ] Patient search works securely.
* [ ] Search is server-side and bounded.
* [ ] Basic permitted patient information is accessible.
* [ ] Clinical information is not exposed.
* [ ] Patient onboarding assistance follows the approved identity architecture.
* [ ] Duplicate-patient handling is considered.

### Authorization

* [ ] Receptionist routes are protected.
* [ ] Server operations are independently authorized.
* [ ] RLS protects sensitive data.
* [ ] Cross-role access tests pass.
* [ ] Privilege escalation tests pass.

### UX

* [ ] Loading states exist.
* [ ] Empty states exist.
* [ ] Error states exist.
* [ ] Confirmation dialogs exist for destructive operations.
* [ ] Mobile/tablet layouts work.
* [ ] Accessibility requirements are met.
* [ ] Punarvasu visual language is maintained.

### Engineering

* [ ] Phase 09 appointment logic is reused.
* [ ] No duplicate scheduling logic exists.
* [ ] No unnecessary client-side data fetching.
* [ ] TypeScript remains strict.
* [ ] Lint passes.
* [ ] Typecheck passes.
* [ ] Tests pass.
* [ ] Production build passes.

---

# 64. Definition of Done

Phase 10 is done when an authorized receptionist can efficiently operate the clinic's daily appointment workflow:

```text
Login
  ↓
Receptionist Workspace
  ↓
See today's schedule
  ↓
Find patient
  ↓
Create / confirm / reschedule / cancel appointment
  ↓
Return to schedule
```

while:

```text
Receptionist
     ✕
Clinical authoring

Receptionist
     ✕
Admin role management

Receptionist
     ✕
Unauthorized patient data
```

The workspace must be secure, responsive, accessible, and ready to support the future doctor workflow.

---

# 65. Explicitly Out of Scope

Do NOT implement:

* Doctor dashboard
* Doctor clinical workspace
* Clinical records
* Diagnosis
* Prescription
* Treatment plans
* AI clinical analysis
* Patient medical history
* Clinical document management
* Notification system
* Analytics dashboard
* Payment processing
* Telemedicine
* Full admin console
* Advanced compliance/audit subsystem

Those belong to later phases.

---

# 66. Final Verification

Run:

```text
lint
typecheck
tests
production build
```

Then manually verify:

```text
Receptionist login
        ↓
Receptionist workspace
        ↓
Today's appointments
        ↓
Patient search
        ↓
Create appointment
        ↓
Confirm appointment
        ↓
Reschedule appointment
        ↓
Cancel appointment
```

Also verify:

```text
Patient → receptionist route = DENIED
Receptionist → clinical record = DENIED
Receptionist → admin functionality = DENIED
Cross-patient unauthorized access = DENIED
Invalid status transition = DENIED
Double booking = PREVENTED
```

---

# 67. Completion Report

At the end of the phase, report:

## Implemented

* Receptionist workspace
* Today's schedule
* Appointment management
* Patient search
* Patient operational profile access
* Appointment creation
* Confirmation
* Cancellation
* Rescheduling
* Role-aware navigation
* Security/RLS
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
Route protection:
Authorization:
RLS:
Cross-role tests:
Cross-patient tests:
Privilege escalation tests:
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
Phase 10: COMPLETE
Ready for Phase 11: YES/NO
```

Do not begin Phase 11 during this phase.
