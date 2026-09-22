# Phase 18 — Advanced Patient Experience

## 1. Phase Objective

Build the complete, polished, secure, and production-quality **Punarvasu Patient Experience**.

Phase 18 transforms the patient-facing authenticated area from a collection of individual features into a coherent healthcare journey.

The patient should be able to:

```text
Sign In
   ↓
Patient Home
   ↓
Understand what needs attention
   ↓
Manage Appointments
   ↓
View Relevant Care Information
   ↓
Access Prescriptions / Treatment Plans
   ↓
Manage Documents
   ↓
Read Notifications
   ↓
Manage Profile
   ↓
Continue Care
```

The experience should feel:

* calm
* premium
* trustworthy
* personal
* simple
* clinically responsible
* mobile-first
* accessible
* privacy-conscious

It must not feel like a generic SaaS dashboard.

---

# 2. Core Product Principle

The patient portal is a **care companion**, not a medical decision engine.

The patient should be able to:

* understand upcoming appointments
* manage appointment actions they are authorized to perform
* view appropriate finalized care information
* access issued prescriptions where permitted
* view treatment plans where permitted
* upload/access their authorized documents
* read notifications
* manage their profile
* understand next steps

The patient must NOT be given unrestricted access to internal clinical operations.

---

# 3. Phase Boundary

Phase 18 consumes functionality from:

```text
Phase 06 → Authentication
Phase 07 → Patient Profile
Phase 08 → Authorization
Phase 09 → Appointments
Phase 14 → Documents
Phase 15 → Notifications
Phase 16 → Analytics
Phase 17 → AI
```

Phase 18 primarily improves the **patient-facing experience and orchestration** of those capabilities.

Do not rebuild these domain systems.

---

# 4. Explicit Clinical Boundary

Patient-facing clinical information must be carefully scoped.

The patient may see information explicitly intended for patient consumption.

The patient must NOT automatically see:

* internal doctor notes
* internal clinical reasoning
* AI prompts
* AI internal reasoning
* AI-generated private suggestions
* internal receptionist notes
* internal staff comments
* private audit information
* internal analytics
* provider metadata
* security metadata

---

# 5. Patient Dashboard

Create a polished patient home/dashboard.

Preferred route:

```text
/patient
```

The dashboard should prioritize:

1. next appointment
2. pending patient actions
3. recent/important notifications
4. care information available to the patient
5. quick actions

Avoid overwhelming KPI cards.

---

# 6. Dashboard Example

Conceptually:

```text
Good morning, [Patient Name]

Your next visit
────────────────────────
Dr. [Name]
[Date] · [Time]
[Appointment Type]

[View Appointment]

What needs your attention?
────────────────────────
• Complete your profile
• Upload requested document
• Confirm appointment

Your care
────────────────────────
Prescription
Treatment Plan

Recent updates
────────────────────────
...
```

Actual content must use real data.

---

# 7. No Fabricated Personalization

Do not invent:

* doctor names
* appointment details
* treatment status
* health progress
* clinical outcomes
* recommendations

If information does not exist, show an appropriate empty state.

---

# 8. First-Time Patient Experience

After authentication:

```text
Authenticated User
→ profile exists?
→ patient area
```

If profile is incomplete:

```text
Patient Dashboard
→ Profile completion prompt
```

Do not force unnecessary medical information.

---

# 9. Patient Navigation

Provide a clear authenticated navigation system.

Potential:

```text
Home
Appointments
Prescriptions
Treatment Plans
Documents
Notifications
Profile
```

Only show sections supported by actual permissions/data.

---

# 10. Mobile Navigation

Patient usage is expected to be heavily mobile.

Provide an appropriate mobile navigation pattern.

Possible:

```text
Home
Appointments
Care
Documents
More
```

Do not overcrowd the bottom navigation.

---

# 11. Desktop Navigation

Desktop can use:

* sidebar
* top navigation
* contextual navigation

Use the existing Punarvasu design system.

Do not create a generic admin-style sidebar.

---

# 12. Patient Appointment Experience

Integrate Phase 09 appointment functionality into a coherent patient workflow.

Patient should be able to:

* view upcoming appointments
* view past appointments
* view appointment details
* cancel if permitted
* reschedule if permitted
* book if Phase 09 supports patient booking
* understand appointment status

Do not duplicate appointment business logic.

---

# 13. Appointment Status

Clearly communicate statuses:

```text
Pending
Confirmed
Cancelled
Completed
No-show
```

Use the existing domain status model.

---

# 14. Appointment Detail

Display appropriate:

* practitioner
* appointment type
* date
* time
* location
* status
* patient-visible instructions
* relevant preparation information if actually configured

Do not expose internal notes.

---

# 15. Appointment Actions

Actions must respect Phase 09 business rules.

For example:

```text
Cancel
Reschedule
```

must use the existing appointment engine.

Do not implement client-only cancellation/rescheduling.

---

# 16. Appointment Safety

The server must derive the authenticated patient identity.

Never trust:

```text
patientId
```

from the browser.

---

# 17. Appointment History

Provide a useful history.

Avoid presenting it as a medical history.

It is:

```text
Appointment history
```

not:

```text
Clinical history
```

---

# 18. Upcoming Appointment Empty State

Example:

```text
No upcoming appointments

When you're ready, you can schedule your next consultation.

[Book a Consultation]
```

Only show booking if actually enabled.

---

# 19. No Appointment Data

If no history exists:

```text
Your appointment history will appear here after your visits.
```

---

# 20. Patient Care Hub

Create a coherent place for patient-accessible care information.

Potential route:

```text
/patient/care
```

or an equivalent architecture.

It may contain:

```text
Prescriptions
Treatment Plans
Care-related documents
```

Use the project's existing architecture rather than creating unnecessary routes.

---

# 21. Prescription Experience

Integrate Phase 13 issued prescriptions into the patient portal.

Patients should only see prescriptions explicitly marked patient-visible/issued according to the domain policy.

---

# 22. Prescription Visibility

Never expose:

```text
draft prescription
cancelled internal draft
doctor-only notes
AI suggestions
internal metadata
```

unless explicitly required.

---

# 23. Prescription Display

Provide a readable presentation of:

* medicine name
* form
* strength
* dose
* frequency
* route
* timing
* duration
* instructions
* issued date

Only display fields that are actually populated.

---

# 24. Prescription History

Allow patients to distinguish:

```text
Current / active
Past
Cancelled
```

according to the actual Phase 13 status model.

Do not infer medical meaning beyond the stored status.

---

# 25. Prescription Safety

Do not create patient-side controls to:

* edit prescriptions
* change dosage
* change medicine
* issue prescriptions
* cancel clinician-issued prescriptions

---

# 26. Prescription Clarification

If a patient needs clarification, provide an appropriate communication/contact pathway if one exists.

Do not add an ad-hoc medical chatbot.

---

# 27. Treatment Plan Experience

Integrate Phase 13 treatment plans where patient visibility is explicitly enabled.

Patients may see:

* title
* summary
* start date
* follow-up
* patient-visible items
* lifestyle/diet guidance
* therapy information

Only expose fields intended for patients.

---

# 28. Treatment Plan Safety

Patient must not be able to:

* edit clinician-authored treatment plans
* activate plans
* change clinical instructions
* modify treatment status

unless a separate approved workflow exists.

---

# 29. Treatment Plan Presentation

Prefer a clear timeline/checklist style when appropriate.

Example:

```text
Your Care Plan

Started
↓
Current guidance
↓
Upcoming follow-up
```

Do not turn clinical plans into gamified wellness dashboards.

---

# 30. Documents

Integrate Phase 14 securely.

Patient should be able to:

* see authorized documents
* upload documents where permitted
* view safe previews
* download authorized files
* understand document type/status

---

# 31. Document Security

Never expose:

```text
storage_path
bucket name
service role
permanent public URL
```

---

# 32. Signed URLs

If downloading or previewing a private document:

```text
Authenticated Patient
→ Authorization
→ short-lived signed URL
→ file
```

The patient must never receive an unrestricted permanent storage URL.

---

# 33. Document Listing

Show useful metadata:

```text
Document title
Type
Date
Status
```

Do not expose internal storage identifiers.

---

# 34. Document Upload

If patient uploads are supported:

```text
Select file
→ validate
→ upload
→ confirmation
```

Reuse Phase 14 validation and storage architecture.

Do not implement a second upload system.

---

# 35. Upload Guidance

Clearly communicate:

* accepted file types
* size limits
* upload status
* failure state

Do not encourage patients to upload unnecessary sensitive information.

---

# 36. Document Preview

Only preview safe formats.

Never render arbitrary HTML or unsafe content.

---

# 37. Document Empty State

Example:

```text
No documents yet

Documents shared with or uploaded to your Punarvasu account will appear here.
```

---

# 38. Notifications

Integrate Phase 15.

Patient should have:

```text
Notification center
Unread count
Read/unread state
Relevant deep links
```

---

# 39. Notification Privacy

Patient notifications must not expose unnecessary sensitive medical information.

Avoid:

```text
"Your diagnosis of X has been confirmed..."
```

in push/email/SMS.

Prefer:

```text
"You have a new update regarding your care."
```

where appropriate.

---

# 40. Notification Deep Links

Notification links must still pass normal authorization.

Never allow:

```text
notification → unauthorized patient record
```

---

# 41. Notification Empty State

Example:

```text
You're all caught up.
```

---

# 42. Notification Preferences

If Phase 15 supports preferences, expose patient-appropriate controls.

Possible:

```text
Email
SMS
WhatsApp
```

depending on configured channels.

Do not allow users to disable legally/operationally mandatory notifications if the system defines them as mandatory.

---

# 43. Profile

Integrate Phase 07.

Patient can:

* view profile
* edit permitted fields
* see profile completeness
* update contact information

Do not duplicate profile logic.

---

# 44. Profile Completion

Calculate completeness from actual fields.

Do not store a manually editable percentage.

---

# 45. Identity

Email authentication identity should remain managed by Supabase Auth.

Do not create a second editable email identity system.

---

# 46. Account Settings

Where appropriate, provide:

* account/security settings
* sign out
* password/session actions
* communication preferences

Do not expose internal role management.

---

# 47. Security

Patient must only access their own:

* profile
* appointments
* documents
* prescriptions
* treatment plans
* notifications

where patient visibility is explicitly enabled.

---

# 48. Cross-Patient Isolation

Attempt:

```text
Patient A
→ Patient B appointment
```

Expected:

```text
DENIED
```

Same for:

* prescriptions
* treatment plans
* documents
* notifications
* profile

---

# 49. IDOR Protection

Never trust route IDs.

Bad:

```text
/patient/prescriptions/123
```

→ fetch by ID only.

Good:

```text
authenticated patient
→ resource ID
→ ownership/visibility check
→ resource
```

---

# 50. RLS

Continue using Supabase RLS.

UI restrictions are not security.

---

# 51. Server Authorization

Server-side authorization must remain authoritative.

---

# 52. Cache Safety

Do not publicly cache patient pages.

Be careful with:

* browser cache
* Next.js caching
* static rendering
* CDN caching

for sensitive patient data.

---

# 53. Sensitive Data in URLs

Do not put:

* clinical details
* prescription content
* medical notes
* sensitive identifiers

into URLs.

Opaque resource IDs may be acceptable when authorization is still enforced.

---

# 54. Sensitive Browser Storage

Do not store clinical information in:

```text
localStorage
sessionStorage
```

unless there is a specifically justified and secure use case.

---

# 55. Patient Analytics

Do not expose Phase 16 internal clinic analytics.

A patient should not see:

```text
clinic utilization
doctor workload
patient counts
cancellation rates
```

---

# 56. Personal Statistics

If useful, patient-specific operational statistics may be shown.

Examples:

```text
Upcoming appointments
Completed visits
```

But do not invent health outcomes or clinical scores.

---

# 57. AI Boundary

Phase 17 AI is doctor-facing.

Do not expose internal clinical AI output to patients.

Do not create a patient AI chatbot in Phase 18.

---

# 58. Patient Education

If static educational content already exists, it may be linked appropriately.

Do not dynamically generate medical advice using AI.

---

# 59. Medical Disclaimer

Where medical information is presented, use appropriate contextual language.

Do not overwhelm the portal with disclaimers.

The portal should not imply:

```text
Punarvasu portal = emergency service
```

---

# 60. Emergency Handling

Patient portal must clearly distinguish routine care from emergencies if emergency guidance is needed.

Do not build AI-based emergency triage.

---

# 61. Patient Journey

The portal should guide the patient naturally:

```text
Discover
→ Book
→ Prepare
→ Attend
→ Receive care information
→ Follow plan
→ Return for follow-up
```

---

# 62. Contextual Next Actions

Show relevant next actions.

Example:

```text
Appointment tomorrow
→ View details

Prescription issued
→ View prescription

Profile incomplete
→ Complete profile
```

Do not create fake urgency.

---

# 63. Action Prioritization

Prefer:

```text
What needs your attention?
```

over:

```text
12 KPIs
```

---

# 64. No Generic SaaS Dashboard

Avoid:

* excessive KPI cards
* meaningless percentages
* decorative charts
* generic "Welcome back" dashboards
* dense tables
* excessive sidebar navigation

---

# 65. Design Language

Reuse Phase 02.

The patient experience should feel:

```text
Premium
Calm
Natural
Warm
Human
Trustworthy
```

---

# 66. Ayurvedic Visual Language

Use subtle:

* natural textures
* organic shapes
* warm imagery
* botanical details
* refined Indian-inspired visual cues

Avoid:

* excessive leaves
* cliché Ayurveda graphics
* mandala overload
* Sanskrit text as decoration
* fake spiritual imagery

---

# 67. Motion

Use Framer Motion only where it improves:

* transitions
* hierarchy
* feedback
* perceived continuity

Respect:

```text
prefers-reduced-motion
```

---

# 68. Loading States

Every major patient data surface should have an intentional loading state.

Avoid blank screens.

---

# 69. Skeletons

Use skeletons where content shape is predictable.

Do not animate excessively.

---

# 70. Error States

Example:

```text
We couldn't load your appointments.

Please try again.

[Try Again]
```

Do not expose:

```text
Supabase/Postgres/internal stack trace
```

---

# 71. Empty States

Every list should have a useful empty state.

Examples:

```text
No upcoming appointments
No prescriptions yet
No treatment plans yet
No documents yet
No notifications
```

---

# 72. Offline / Network Failure

Handle temporary network failure gracefully.

Do not show stale clinical information as current without making its state clear.

---

# 73. Unsaved Changes

If profile/document forms have unsaved changes:

* warn appropriately
* avoid accidental loss

---

# 74. Form Validation

Use server-side validation.

Client validation improves UX but is not the security boundary.

---

# 75. Patient Forms

Forms should:

* use appropriate input types
* have labels
* show errors clearly
* preserve accessible focus
* support mobile keyboards

---

# 76. Accessibility

Target WCAG AA principles.

Verify:

* keyboard navigation
* focus states
* screen-reader labels
* dialogs
* forms
* tables/lists
* status announcements
* color contrast
* reduced motion

---

# 77. Responsive Design

Test at minimum:

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

---

# 78. Mobile Priority

On mobile, prioritize:

```text
Next appointment
Important action
Notifications
Care information
```

---

# 79. Tablet

Ensure doctor/patient-related patient portal surfaces remain usable on tablets.

---

# 80. Desktop

Use whitespace and clear hierarchy.

Do not simply stretch mobile cards across the entire screen.

---

# 81. Performance

Patient portal should be fast.

Avoid loading:

* all appointments
* all documents
* all notifications
* all prescriptions

on the initial page.

Use bounded queries.

---

# 82. Data Fetching

Fetch only what each page needs.

Do not create a giant:

```text
getEverythingForPatient()
```

endpoint.

---

# 83. Parallel Data Loading

Where appropriate, independent dashboard sections may load concurrently.

Avoid sequential request waterfalls.

---

# 84. Pagination

Use pagination for:

* appointment history
* documents
* notifications
* prescriptions where history becomes large

---

# 85. Search

Search should only be added where useful.

Do not add unnecessary search functionality to a small patient portal.

---

# 86. Deep Links

Support useful links such as:

```text
notification
→ appointment
prescription
document
```

but every destination must independently authorize the patient.

---

# 87. Back Navigation

Ensure browser back navigation behaves naturally.

Do not rely on client-only state for authorization.

---

# 88. Session Expiration

If the session expires:

```text
→ safely return to login
→ preserve safe non-sensitive navigation context where appropriate
```

Never preserve sensitive data in URLs.

---

# 89. Logout

Logout must use the existing Supabase Auth flow.

Do not merely clear local UI state.

---

# 90. Multiple Tabs

Test behavior when the patient:

* logs out in one tab
* updates profile in another
* receives new notifications

Avoid inconsistent authorization assumptions.

---

# 91. Concurrent Updates

If profile/document actions race:

* server remains authoritative
* database constraints remain authoritative
* stale writes should be handled safely

---

# 92. Patient Data Consistency

Do not duplicate:

```text
patient name
patient email
appointment status
prescription status
document status
```

in multiple independent stores.

Use domain sources of truth.

---

# 93. Patient Dashboard Composition

Dashboard can compose data from:

```text
Profile
Appointments
Notifications
Prescriptions
Treatment Plans
Documents
```

but must not create competing sources of truth.

---

# 94. Dashboard Performance

Use small, purpose-specific queries.

For example:

```text
next appointment
unread notification count
recent care item
profile completeness
```

rather than loading all patient history.

---

# 95. Security Headers

Continue the application's security posture from earlier phases.

Do not weaken security to make the portal easier to implement.

---

# 96. Privacy

Patient-facing pages must not leak data through:

* page source
* logs
* analytics
* URLs
* error messages
* metadata
* client-side serialized props

where avoidable.

---

# 97. SEO

Authenticated patient pages should generally not be indexed.

Use appropriate:

```text
noindex
```

and prevent sensitive pages from becoming publicly discoverable.

---

# 98. Metadata

Do not expose sensitive patient information in:

```text
<title>
<meta description>
Open Graph
```

---

# 99. Browser Title

Use generic titles such as:

```text
Appointments | Punarvasu
```

not:

```text
Appointment with Dr. X for [medical condition]
```

---

# 100. Notification Privacy

Do not place detailed clinical information in:

* browser notification previews
* page titles
* URLs
* email subjects

unless explicitly justified.

---

# 101. Email/SMS/WhatsApp

Patient portal should consume Phase 15 notifications.

Do not implement another communication provider here.

---

# 102. Patient Contact Path

If a patient needs help, provide the existing clinic contact/communication path.

Do not create an unofficial clinical support channel.

---

# 103. Booking CTA

Where appointment booking is enabled:

```text
Book a Consultation
```

should remain the primary action.

Use the Phase 09 engine.

---

# 104. Rescheduling

Patient rescheduling must use Phase 09 availability and conflict rules.

Do not create separate slot logic.

---

# 105. Cancellation

Patient cancellation must:

* verify ownership
* respect cancellation rules
* update authoritative appointment state
* allow Phase 15 notification flow to respond

Do not send notifications directly from UI code.

---

# 106. Appointment Completion

Do not allow patients to mark appointments completed.

That remains an authorized staff/doctor operation.

---

# 107. Clinical Data Visibility Policy

Document exactly what patients can see.

For example:

```text
Patient-visible:
- issued prescriptions
- patient-visible treatment plans
- patient-visible documents

Not patient-visible:
- doctor private notes
- internal assessment drafts
- AI suggestions
- internal staff notes
```

Use actual product requirements where they differ.

---

# 108. Prescription Visibility Policy

Patient access should be based on explicit status/visibility.

Never assume:

```text
prescription exists
→ patient can see it
```

---

# 109. Treatment Plan Visibility Policy

Likewise:

```text
treatment plan exists
→ not automatically patient-visible
```

---

# 110. Document Visibility Policy

Documents must retain their Phase 14 authorization rules.

Do not broaden access merely because the request originates from `/patient`.

---

# 111. Notification Authorization

Patient can only access notifications where:

```text
notification.recipient_user_id
==
authenticated user.id
```

or equivalent policy.

---

# 112. Patient Security Boundary

The patient UI must never expose staff functionality through hidden routes.

Security must be enforced server-side.

---

# 113. Hidden UI Is Not Security

Bad:

```text
Hide "Doctor Dashboard" button
```

Good:

```text
Doctor route
→ server authorization
→ DENIED
```

---

# 114. Role Switching

Do not allow patients to choose:

```text
doctor
receptionist
admin
```

from the UI.

---

# 115. Patient Impersonation

Do not build patient impersonation.

If support/admin impersonation is ever required, it belongs to a separately governed admin/security feature.

---

# 116. Auditability

Sensitive patient actions may be audited according to the security architecture.

Potential events:

```text
document upload
document download
appointment cancellation
profile update
```

Do not log sensitive content unnecessarily.

---

# 117. Patient Data Export

Do not automatically build a full data-export system unless explicitly required.

If an export is needed later, implement it as a dedicated privacy workflow.

---

# 118. Account Deletion

Do not implement destructive account deletion casually.

Healthcare data retention and legal requirements must be defined first.

---

# 119. Destructive Actions

Use confirmation for:

* appointment cancellation
* potentially destructive document operations

Clearly explain consequences.

---

# 120. Confirmation Dialogs

Avoid unnecessary confirmation dialogs.

Use them when an action is consequential.

---

# 121. Toasts

Use concise feedback:

```text
Appointment cancelled
Profile updated
Document uploaded
```

Do not place critical information only in transient toasts.

---

# 122. Accessibility of Toasts

Use appropriate ARIA live-region behavior.

---

# 123. Security of Client State

Zustand may be used for UI state.

Do not use it as the source of truth for:

* roles
* permissions
* clinical records
* authorization
* patient ownership

---

# 124. Sensitive Zustand State

Avoid persisting sensitive clinical data to Zustand/localStorage.

---

# 125. URL State

Safe filters such as:

```text
?status=upcoming
```

may be used.

Do not put clinical content in query parameters.

---

# 126. Patient Portal Architecture

Prefer:

```text
src/app/patient/
src/components/patient/
src/server/patient/
```

where appropriate.

Reuse existing server/domain layers.

---

# 127. Patient-Specific Server Queries

Examples:

```text
getPatientDashboard()
getPatientUpcomingAppointments()
getPatientVisiblePrescriptions()
getPatientVisibleTreatmentPlans()
getPatientDocuments()
getPatientNotifications()
```

Use only where the existing architecture benefits from them.

---

# 128. No Giant Patient Query

Avoid a single oversized server query returning every patient resource.

---

# 129. Error Boundaries

Provide appropriate page/section-level error handling.

A document-loading failure should not necessarily destroy the entire patient dashboard.

---

# 130. Suspense / Streaming

Use where it materially improves perceived performance.

Do not introduce complexity without benefit.

---

# 131. Caching

Any caching of patient data must be carefully scoped to the authenticated user.

Never use globally shared caches for sensitive patient responses.

---

# 132. Authorization Before Cache

Authorization must occur before serving cached patient data.

---

# 133. Security Testing

Mandatory tests:

### Patient isolation

```text
Patient A → Patient B resources = DENIED
```

### Resource types

Test:

* appointments
* prescriptions
* treatment plans
* documents
* notifications
* profile

### Role isolation

```text
Patient → doctor routes = DENIED
Patient → receptionist routes = DENIED
```

---

# 134. IDOR Testing

Modify every resource ID in URLs/API requests.

Expected:

```text
DENIED
```

for resources belonging to another patient.

---

# 135. Client Spoofing

Attempt to send:

```json
{
  "patientId": "another-user"
}
```

The server must ignore/reject unauthorized identity.

---

# 136. Document Security Testing

Verify:

```text
Patient A
→ Patient B storage path
→ DENIED
```

and signed URLs cannot be generated for unauthorized documents.

---

# 137. Prescription Security Testing

Verify patients cannot:

* access another patient's prescription
* modify prescription
* issue prescription
* change status

---

# 138. Treatment Plan Security Testing

Verify patients cannot:

* access another patient's plan
* modify clinician-authored plan
* activate/deactivate plan
* change clinical instructions

unless an explicitly approved workflow exists.

---

# 139. Notification Security Testing

Verify:

```text
Patient A
→ Patient B notification ID
→ DENIED
```

---

# 140. Appointment Security Testing

Verify:

```text
Patient A
→ Patient B appointment
→ DENIED
```

and:

```text
Patient A
→ modify practitioner
→ DENIED
```

---

# 141. Profile Security Testing

Verify:

```text
Patient A
→ Patient B profile
→ DENIED
```

---

# 142. Privacy Testing

Inspect rendered pages/network payloads for unnecessary:

* clinical notes
* internal IDs
* storage paths
* provider metadata
* staff-only information

---

# 143. Sensitive Data in HTML

Verify patient pages do not serialize unrelated sensitive records into HTML.

---

# 144. Sensitive Data in Errors

Force errors and verify no:

* SQL errors
* Supabase errors
* stack traces
* storage paths
* provider details

are exposed.

---

# 145. Accessibility Tests

Test:

* keyboard-only
* screen reader semantics
* focus order
* form errors
* dialogs
* navigation
* contrast
* reduced motion

---

# 146. Responsive Tests

Test:

```text
320px
375px
390px
430px
768px
1024px
1280px
1440px
1920px
```

---

# 147. Performance Tests

Check:

* initial dashboard request count
* request waterfalls
* oversized payloads
* unnecessary client JavaScript
* image optimization
* slow document pages
* notification pagination

---

# 148. Bad → Good Examples

## Dashboard

### Bad

```text
12 KPI cards
3 charts
5 tables
```

### Good

```text
Next appointment
→ Important actions
→ Recent updates
→ Care information
```

---

## Patient Authorization

### Bad

```ts
const patientId = searchParams.patientId;
```

### Good

```text
authenticated user
→ server resolves patient identity
→ authorized resource
```

---

## Prescription

### Bad

```text
Prescription exists
→ display it
```

### Good

```text
Prescription exists
→ patient visibility/status check
→ display only permitted fields
```

---

## Document

### Bad

```text
<a href={storagePath}>
```

### Good

```text
authorized request
→ short-lived signed URL
→ secure file
```

---

## Clinical AI

### Bad

```text
AI result
→ patient portal
```

### Good

```text
Doctor-facing AI
→ doctor decision
→ patient-visible finalized information
```

---

## Dashboard Loading

### Bad

```text
Blank white screen for 3 seconds
```

### Good

```text
Intentional skeleton
→ progressive content
```

---

## Error

### Bad

```text
Error: relation patient_documents does not exist
```

### Good

```text
We couldn't load your documents.
Please try again.
```

---

# 149. Expected File Areas

Adapt to the existing repository.

Potential:

```text
src/app/patient/
  page.tsx
  appointments/
  prescriptions/
  treatment-plans/
  documents/
  notifications/
  profile/

src/components/patient/
  patient-shell.tsx
  patient-nav.tsx
  patient-dashboard.tsx
  next-appointment.tsx
  patient-action-list.tsx
  patient-care-summary.tsx
  patient-empty-state.tsx

src/server/patient/
  dashboard.ts
  appointments.ts
  prescriptions.ts
  treatment-plans.ts
  documents.ts
  notifications.ts
```

Do not create duplicate domain services if existing Phase 09–15 services already provide the required functionality.

---

# 150. Data Architecture

The patient portal must consume existing domain sources:

```text
Appointments → Phase 09
Prescriptions → Phase 13
Treatment Plans → Phase 13
Documents → Phase 14
Notifications → Phase 15
Profile → Phase 07
Authorization → Phase 08
```

Do not introduce competing patient data models.

---

# 151. Acceptance Criteria

Phase 18 is complete only when:

## Patient Home

* [ ] `/patient` exists.
* [ ] Dashboard is useful and calm.
* [ ] Next appointment is prioritized.
* [ ] Important patient actions are surfaced.
* [ ] Empty states exist.
* [ ] Loading states exist.
* [ ] Error states exist.

## Navigation

* [ ] Desktop navigation works.
* [ ] Mobile navigation works.
* [ ] Only appropriate patient routes are exposed.
* [ ] Navigation remains accessible.

## Appointments

* [ ] Upcoming appointments work.
* [ ] Appointment details work.
* [ ] Appointment history works.
* [ ] Authorized cancel/reschedule actions work.
* [ ] Phase 09 business rules are reused.
* [ ] Patient identity is server-derived.

## Prescriptions

* [ ] Patient-visible prescriptions can be viewed.
* [ ] Only authorized/finalized data is exposed.
* [ ] Draft/internal prescription data is hidden.
* [ ] Patients cannot modify prescriptions.

## Treatment Plans

* [ ] Patient-visible plans can be viewed.
* [ ] Only patient-safe fields are exposed.
* [ ] Patients cannot modify clinician-authored plans.

## Documents

* [ ] Patient documents can be listed.
* [ ] Authorized uploads work if enabled.
* [ ] Secure preview/download works.
* [ ] Private storage remains private.
* [ ] Signed URLs are short-lived and authorization-gated.

## Notifications

* [ ] Notification center works.
* [ ] Read/unread state works.
* [ ] Deep links are authorization-safe.
* [ ] Privacy-sensitive notification content is minimized.

## Profile

* [ ] Patient profile is accessible.
* [ ] Profile editing works.
* [ ] Completeness is calculated correctly.
* [ ] Auth identity remains separate.

## Security

* [ ] Cross-patient access is denied.
* [ ] IDOR attempts are denied.
* [ ] Patient cannot access staff routes.
* [ ] Patient cannot spoof patient identity.
* [ ] RLS remains enforced.
* [ ] No clinical data is placed in public caches.
* [ ] No sensitive data is unnecessarily stored client-side.

## Clinical Safety

* [ ] Internal doctor notes remain protected.
* [ ] Internal AI output remains protected.
* [ ] AI does not become patient-facing.
* [ ] Patient-visible information is explicitly scoped.

## UX

* [ ] Punarvasu design system is reused.
* [ ] Experience is not generic SaaS.
* [ ] Responsive design works.
* [ ] Accessibility works.
* [ ] Motion respects reduced-motion preferences.

## SEO / Privacy

* [ ] Authenticated patient pages are not indexable.
* [ ] Sensitive information is absent from metadata.
* [ ] Sensitive information is absent from URLs.

## Engineering

* [ ] TypeScript passes.
* [ ] Lint passes.
* [ ] Tests pass.
* [ ] Production build passes.
* [ ] No duplicate domain logic is introduced.

---

# 152. Definition of Done

A patient should be able to complete a realistic journey:

```text
Login
 ↓
Patient Home
 ↓
See upcoming appointment
 ↓
Open appointment
 ↓
Review care information
 ↓
View issued prescription if available
 ↓
View treatment plan if available
 ↓
Upload/view authorized document
 ↓
Read notification
 ↓
Update profile
 ↓
Return to dashboard
```

All actions must use the existing domain and authorization systems.

A patient must never be able to escape their security boundary by changing:

* URL
* resource ID
* request payload
* client state
* browser storage

---

# 153. Explicitly Out of Scope

Do NOT implement:

* patient-facing medical AI
* AI chatbot
* AI diagnosis
* AI treatment recommendation
* autonomous medical advice
* new appointment engine
* new prescription engine
* new treatment-plan engine
* new document storage architecture
* new notification provider
* internal staff analytics
* admin analytics
* practitioner dashboard
* receptionist workspace
* doctor clinical workspace
* payments
* telemedicine
* insurance processing
* full CRM
* account impersonation
* unrestricted data export
* destructive account deletion without a defined retention policy

---

# 154. Final Verification

Run:

```text
lint
typecheck
tests
production build
```

Then manually verify:

```text
Patient
→ Login
→ Patient Dashboard
→ Appointment
→ Prescription
→ Treatment Plan
→ Documents
→ Notifications
→ Profile
```

Verify another patient's IDs cannot be used to access any resource.

Verify:

```text
Patient
→ Doctor route
→ DENIED
```

Verify:

```text
Patient
→ Internal clinical information
→ DENIED
```

Verify:

```text
Patient
→ Internal AI output
→ DENIED
```

Verify that private documents never become public URLs.

---

# 155. Completion Report

At completion, report:

## Patient Experience

```text
Dashboard:
Navigation:
Mobile UX:
Appointment UX:
Care UX:
```

## Integrations

```text
Appointments:
Prescriptions:
Treatment Plans:
Documents:
Notifications:
Profile:
```

## Security

```text
Patient isolation:
IDOR:
RLS:
Signed URLs:
Sensitive browser data:
Cache policy:
```

## Clinical Privacy

```text
Patient-visible clinical fields:
Doctor-only fields:
AI visibility:
Internal notes:
```

## Accessibility

```text
Keyboard:
Screen reader:
Contrast:
Focus:
Reduced motion:
Responsive:
```

## Performance

```text
Initial dashboard:
Request count:
Pagination:
Payload optimization:
```

## Verification

```text
Lint:
Typecheck:
Tests:
Build:
```

## Deferred

List anything intentionally deferred.

## Phase Status

```text
Phase 18: COMPLETE
Ready for Phase 19: YES/NO
```

Do not begin Phase 19 during this phase.
