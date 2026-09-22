# Phase 15 — Notifications & Communication

## 1. Phase Objective

Build a secure, reliable, extensible **Notifications & Communication** system for Punarvasu.

The system should provide patients and authorized clinic staff with appropriate notifications for important operational events such as:

* appointment confirmation
* appointment changes
* appointment cancellation
* appointment reminders
* consultation completion
* prescription issuance
* treatment-plan updates where appropriate
* patient onboarding/account events
* operational clinic communications where required

The system must support appropriate channels such as:

```text
In-app
Email
SMS / WhatsApp — only if explicitly configured and approved
```

Do not implement every communication channel merely because the architecture supports them.

Start with the channels actually available and required.

---

# 2. Core Principle

Notifications are a **communication layer**, not the source of truth.

Correct:

```text
Appointment Engine
        ↓
Authoritative appointment state
        ↓
Domain Event
        ↓
Notification System
        ↓
Email / In-app / SMS
```

Incorrect:

```text
Notification
    ↓
changes appointment
```

Notifications must never determine:

* appointment status
* prescription status
* clinical record status
* patient identity
* authorization
* treatment decisions

---

# 3. Architecture Boundary

Phase 15 consumes events from:

```text
Phase 06
Authentication
      ↓
Phase 07
Patient Profile
      ↓
Phase 09
Appointments
      ↓
Phase 10
Receptionist Workspace
      ↓
Phase 11
Doctor Workspace
      ↓
Phase 12
Clinical Records
      ↓
Phase 13
Prescriptions / Treatment Plans
      ↓
Phase 14
Documents
      ↓
Phase 15
Notifications
```

Future:

```text
Phase 16
Analytics
```

may consume notification metrics.

```text
Phase 17
AI
```

must not be allowed to send autonomous clinical recommendations through the notification system.

---

# 4. Notification Architecture

Use an event-driven architecture.

Conceptually:

```text
Domain Action
     ↓
Domain Event
     ↓
Notification Event Handler
     ↓
Notification Preference Check
     ↓
Template
     ↓
Channel Adapter
     ↓
Delivery
     ↓
Delivery Status
```

---

# 5. Domain Events

Examples:

```text
appointment.created
appointment.confirmed
appointment.rescheduled
appointment.cancelled
appointment.completed

prescription.issued

treatment_plan.created
treatment_plan.updated

patient.account.created
patient.email_verified
```

Only implement events that correspond to actual implemented domain actions.

Do not invent fake events.

---

# 6. Event Source of Truth

Events must be emitted after the underlying domain operation succeeds.

Bad:

```text
User clicks Confirm Appointment
→ send "Appointment Confirmed"
→ database update fails
```

Good:

```text
Confirm Appointment
→ validate
→ authorize
→ update appointment
→ successful authoritative state
→ emit event
→ send notification
```

---

# 7. Transactional Consistency

Where practical, domain state and event creation should be coordinated.

For critical workflows:

```text
Appointment update
+
Notification event
```

should not leave the system believing an action occurred when it did not.

Use an outbox/event-record pattern if appropriate to the existing architecture.

---

# 8. Outbox Pattern

For reliable delivery, consider:

```text
notification_events
```

or:

```text
outbox_events
```

Conceptually:

```text
Domain transaction
      ↓
Create outbox event
      ↓
Worker/processor
      ↓
Notification
      ↓
Delivery provider
```

This prevents a successful appointment update from being lost merely because an email provider was temporarily unavailable.

---

# 9. Notification Record

Conceptually:

```text
notifications
--------------------------------
id
recipient_user_id
type
title
body / rendered_content
channel
status
priority
related_resource_type
related_resource_id
scheduled_for
sent_at
read_at
created_at
updated_at
```

Exact fields should follow the existing architecture.

---

# 10. Delivery Record

For external channels, consider separating notification intent from delivery attempt.

Conceptually:

```text
notification_deliveries
--------------------------------
id
notification_id
channel
provider
status
attempt_count
provider_message_id
last_attempt_at
delivered_at
failed_at
error_code
created_at
updated_at
```

Do not store unnecessary provider payloads.

---

# 11. Notification vs Delivery

Keep these concepts separate.

### Notification

```text
Patient should know:
"Your appointment is confirmed."
```

### Delivery

```text
Email
→ provider
→ accepted
→ delivered
```

A notification can exist even if one delivery channel fails.

---

# 12. Channels

Initial architecture should support:

```text
in_app
email
sms
whatsapp
```

but only enable channels that are actually configured.

Do not create fake integrations.

---

# 13. Email

If email is configured:

* use the approved provider
* keep provider logic behind an adapter
* centralize configuration
* handle failures safely
* do not expose API keys
* do not send sensitive clinical information unnecessarily

---

# 14. SMS / WhatsApp

Do not assume SMS or WhatsApp is available.

If implemented:

* use an approved provider
* respect patient consent/preferences
* keep provider credentials server-side
* implement rate limiting
* handle provider failure
* avoid sensitive clinical information

If not configured, create an extensible channel interface without pretending delivery works.

---

# 15. In-App Notifications

Provide a notification center for authenticated users where appropriate.

Example:

```text
Notifications

Appointment confirmed
Tomorrow, 10:00 AM

Prescription issued
Today, 4:30 PM

Appointment rescheduled
Yesterday
```

---

# 16. Notification Read State

Support:

```text
unread
read
```

where required.

The server must determine ownership.

A user must not be able to mark another user's notification as read.

---

# 17. Mark as Read

Provide:

```text
Mark as read
Mark all as read
```

if useful.

Operations must be authorization-protected.

---

# 18. Notification Deep Links

Notifications may link to relevant application resources.

Example:

```text
Appointment confirmed
→ /patient/appointments/{id}
```

or:

```text
Prescription issued
→ /patient/prescriptions/{id}
```

The destination must independently enforce authorization.

A notification link is never an authorization mechanism.

---

# 19. Safe Redirects

Do not accept arbitrary URLs from notification payloads.

Bad:

```text
notification.url = userProvidedUrl
```

Good:

```text
notification
→ known application route
→ authorization
```

---

# 20. Notification Preferences

Patients should be able to control appropriate communication preferences.

Potential settings:

```text
Appointment reminders
Appointment changes
Prescription notifications
General clinic communications
Email
SMS
WhatsApp
```

Only expose preferences for channels that actually exist.

---

# 21. Preference Model

Conceptually:

```text
notification_preferences
--------------------------------
user_id
notification_type
channel
enabled
updated_at
```

or an equivalent normalized design.

Avoid storing a giant JSON blob if relational queries are required.

---

# 22. Mandatory vs Optional Notifications

Some operational notifications may be mandatory.

For example:

```text
Appointment cancellation
```

may be necessary for patient safety/operations.

Other communication may be optional:

```text
General clinic announcements
```

The preference system must distinguish these appropriately.

Do not allow users to disable required transactional communications unless product/legal requirements permit it.

---

# 23. Consent

For marketing/promotional communication:

```text
consent
+
preference
```

must be considered.

Do not treat:

```text
logged in
```

as consent for promotional messaging.

---

# 24. No Marketing by Default

This phase focuses primarily on transactional healthcare communication.

Do not build promotional campaigns or marketing automation.

---

# 25. Appointment Confirmation

When an appointment becomes confirmed:

```text
appointment.confirmed
        ↓
patient notification
```

Potential message:

```text
Your appointment with Dr. [Name] is confirmed for [date/time].
```

Use actual authoritative data.

Never invent:

* doctor name
* time
* location
* appointment type

---

# 26. Appointment Rescheduling

When an appointment is rescheduled:

```text
appointment.rescheduled
        ↓
patient notification
```

Clearly communicate the new date/time.

Do not expose internal scheduling information.

---

# 27. Appointment Cancellation

When cancelled:

```text
appointment.cancelled
        ↓
patient notification
```

Keep the message concise.

Do not expose internal cancellation notes.

---

# 28. Appointment Reminder

Implement reminder scheduling only if required.

Potential reminders:

```text
24 hours before
2 hours before
```

The exact schedule should be configurable.

Do not hard-code clinic-specific timing.

---

# 29. Reminder Scheduling

A reminder should be based on the authoritative appointment time.

If the appointment is:

```text
cancelled
rescheduled
```

the old reminder must not incorrectly fire.

---

# 30. Rescheduling Reminder

Example:

```text
Original appointment
→ reminder scheduled

Appointment rescheduled
→ old reminder invalidated
→ new reminder scheduled
```

Do not send a reminder for the old time.

---

# 31. Time Zones

Appointment notifications must use the clinic/patient timezone rules established in Phase 09.

Do not perform ad-hoc timezone conversion in each notification template.

---

# 32. Date Formatting

Use localized, human-readable dates.

Example:

```text
Saturday, 19 September at 10:30 AM
```

The exact format should follow Punarvasu UX conventions.

Do not display raw UTC timestamps.

---

# 33. Prescription Issued Notification

When a prescription is issued:

```text
prescription.issued
        ↓
patient notification
```

Potential message:

```text
Your prescription from your recent consultation is now available in your Punarvasu account.
```

Do not put the complete prescription into email/SMS by default.

---

# 34. Treatment Plan Notification

If appropriate:

```text
treatment_plan.updated
```

can notify the patient.

Avoid sending the entire treatment plan in SMS.

Prefer:

```text
Your treatment plan has been updated.
Sign in to Punarvasu to review it.
```

---

# 35. Document Notifications

If a document workflow requires notification, it may emit an event.

Example:

```text
document.available
```

However, do not send sensitive document content through email/SMS.

---

# 36. Clinical Privacy in Notifications

Notifications are inherently less private than the authenticated application.

Therefore:

### Avoid:

```text
Your diabetes report shows high glucose.
```

### Prefer:

```text
A new document is available in your Punarvasu account.
```

---

# 37. Email Privacy

Avoid putting unnecessary clinical information in:

* subject lines
* preview text
* email body
* notification title

Prefer minimal content plus a secure application link.

---

# 38. SMS Privacy

SMS should be even more minimal.

Bad:

```text
Your Ayurvedic diagnosis is...
```

Good:

```text
You have a new update from Punarvasu. Sign in to view it.
```

---

# 39. WhatsApp Privacy

If WhatsApp is used, apply the same privacy principle.

Do not send detailed medical information through message previews.

---

# 40. Notification Templates

Use centralized templates.

Conceptually:

```text
notification-templates/
    appointment-confirmed
    appointment-rescheduled
    appointment-cancelled
    appointment-reminder
    prescription-issued
```

Do not construct message strings across random UI components.

---

# 41. Template Variables

Use typed variables.

Example:

```ts
AppointmentConfirmedTemplateData {
  patientName?: string
  practitionerName: string
  startAt: Date
  appointmentId: string
}
```

Do not allow arbitrary untyped objects.

---

# 42. Template Security

Never allow patients or browser clients to submit:

```text
subject
body
recipient
```

for transactional notifications.

The server determines these values.

---

# 43. HTML Email Security

If HTML emails are used:

* generate trusted templates
* escape user-generated values
* never inject arbitrary HTML
* avoid unsafe template interpolation

---

# 44. Notification Provider Abstraction

Use a provider interface.

Conceptually:

```ts
interface NotificationChannel {
  send(message: NotificationMessage): Promise<DeliveryResult>
}
```

Then:

```text
EmailProvider
SmsProvider
WhatsAppProvider
```

can be implemented independently.

---

# 45. Provider Failures

External providers fail.

Handle:

```text
timeout
rate limit
authentication error
temporary provider outage
invalid recipient
```

without breaking the underlying domain operation.

---

# 46. Retry Strategy

Retry transient failures.

Do not retry permanent failures indefinitely.

Potential:

```text
attempt 1
→ fail

attempt 2
→ fail

attempt 3
→ fail

dead-letter / failed
```

The exact strategy should be configurable.

---

# 47. Idempotency

A notification event must not produce duplicate messages because of:

* worker retry
* browser refresh
* repeated API request
* webhook retry
* process restart

Use an idempotency key/event ID where appropriate.

---

# 48. Duplicate Reminder Prevention

A reminder should be uniquely associated with:

```text
appointment
+
reminder type
+
scheduled occurrence
```

so the same reminder is not sent twice.

---

# 49. Notification Status

Potential:

```text
pending
processing
sent
delivered
failed
cancelled
```

Only implement states meaningful to the configured providers.

---

# 50. Delivery Semantics

Understand the distinction:

```text
sent
```

means provider accepted it.

```text
delivered
```

means provider confirmed delivery.

Do not claim delivery if the provider only accepted the request.

---

# 51. Provider Webhooks

If the provider supports delivery webhooks, verify:

* webhook authenticity
* event signature
* idempotency
* event ownership
* safe processing

Do not trust arbitrary webhook payloads.

---

# 52. Webhook Security

Verify provider signatures where supported.

Do not accept:

```text
POST /webhooks/email
{
  "status": "delivered"
}
```

without authentication/signature verification.

---

# 53. Webhook Replay

Webhook processing must be idempotent.

Repeated provider events must not corrupt notification status.

---

# 54. Notification Center Security

A user may only retrieve:

```text
notifications.recipient_user_id = authenticated_user
```

Never trust:

```text
userId
```

from the browser.

---

# 55. Notification Enumeration

This must fail:

```text
GET /notifications/{anotherUserNotificationId}
```

through IDOR.

---

# 56. Staff Notifications

Doctors/receptionists may need operational notifications.

Examples:

```text
New appointment request
Appointment changed
Patient completed onboarding
```

Only implement useful workflows.

Do not flood staff with every database event.

---

# 57. Doctor Notifications

Potential:

```text
Upcoming appointment
Appointment rescheduled
Patient submitted document
```

Clinical document notifications must not reveal unnecessary sensitive information.

---

# 58. Receptionist Notifications

Potential:

```text
Appointment request
Cancellation
Reschedule
```

Do not notify receptionists about:

* diagnosis
* prescriptions
* doctor notes
* clinical assessments

unless explicitly authorized.

---

# 59. Notification Priority

Potential priorities:

```text
low
normal
high
```

Use sparingly.

Do not label everything urgent.

---

# 60. Quiet Hours

If patient preferences include quiet hours, design carefully.

Transactional healthcare notifications may need different rules from optional communications.

Do not silently delay critical operational messages.

---

# 61. Notification Frequency

Avoid notification spam.

Example:

```text
Appointment rescheduled
+
appointment reminder
```

should not produce unnecessary duplicate messages when one event supersedes another.

---

# 62. Batching

Batching may be useful for low-priority in-app notifications.

Do not batch time-sensitive appointment changes.

---

# 63. Unread Count

If the UI displays:

```text
Notifications (3)
```

the count must come from authorized server state.

Avoid maintaining it as an untrusted client-only number.

---

# 64. Real-Time Notifications

If realtime is implemented:

* use authorized channels
* do not broadcast clinical content
* do not rely on realtime for security
* database/RLS remains authoritative

Realtime should improve UX, not define permissions.

---

# 65. Email Queue

Do not send external email directly inside critical user-facing database mutation code if it makes the operation unreliable.

Prefer:

```text
Domain operation
→ event/outbox
→ worker
→ email provider
```

---

# 66. Notification Worker

If the application architecture supports background processing, use it for:

* retries
* scheduled reminders
* email/SMS delivery
* failed delivery recovery

The implementation should follow the deployment environment's capabilities.

---

# 67. Scheduled Reminders

A scheduled reminder should contain enough information to safely execute later.

Avoid relying on stale client state.

At execution time:

```text
load appointment
→ verify still valid
→ verify reminder not already sent
→ send
```

---

# 68. Cancelled Appointment Reminder

Before sending:

```text
appointment.status === confirmed
```

or the appropriate valid state.

If cancelled:

```text
do not send reminder
```

---

# 69. Completed Appointment Reminder

Do not send future reminders for completed/no-show appointments.

---

# 70. Rescheduled Appointment Reminder

Verify the reminder belongs to the current appointment schedule.

Old scheduled jobs must become ineffective.

---

# 71. Notification Preferences at Send Time

Where appropriate, evaluate preferences close to delivery time.

Do not assume preferences never change after event creation.

Mandatory transactional notifications may follow different rules.

---

# 72. Email Address

Use the authoritative authenticated identity/email.

Do not accept arbitrary recipient email addresses from the client for transactional patient notifications.

---

# 73. Phone Number

Use the verified/appropriate patient phone number.

Do not allow a browser request to redirect a notification to an arbitrary phone number.

---

# 74. Contact Verification

If SMS/WhatsApp is used, consider whether the phone number must be verified before sending sensitive operational communication.

Follow the project's identity requirements.

---

# 75. Unverified Contacts

Do not send sensitive notifications to an unverified contact channel unless the product explicitly permits it.

---

# 76. Provider Credentials

Store credentials in environment/server secrets.

Never expose:

```text
EMAIL_API_KEY
SMS_API_KEY
WHATSAPP_TOKEN
```

to client code.

---

# 77. Secrets in Logs

Never log provider credentials.

Also avoid logging full notification bodies when they contain personal data.

---

# 78. Logging

Safe example:

```ts
logger.info({
  event: "notification_queued",
  notificationId,
  type: "appointment_confirmed",
  channel: "email",
});
```

Avoid:

```ts
logger.info({
  patientName,
  phone,
  email,
  body,
});
```

unless specifically justified and protected.

---

# 79. Error Messages

User-facing:

```text
We couldn't send the notification right now.
```

Internal logs can contain appropriate technical diagnostics without exposing secrets or clinical data.

---

# 80. Notification Data Minimization

Store only the minimum required content.

Prefer:

```text
notification_type
resource_id
template_data_reference
```

over permanently duplicating sensitive clinical information.

Where rendered content must be persisted, carefully control retention.

---

# 81. Clinical Content

Do not put:

* diagnosis
* detailed symptoms
* doctor notes
* laboratory values
* clinical reasoning

into generic notification records unless explicitly required.

---

# 82. Prescription Content

Do not include full prescription details in:

```text
SMS
email subject
push preview
```

Prefer secure deep links.

---

# 83. Document Content

Do not attach sensitive documents to transactional emails by default.

Prefer:

```text
A new document is available.
→ Secure Punarvasu account
```

---

# 84. Notification Links

Use application-relative paths where possible:

```text
/patient/appointments/{id}
/patient/prescriptions/{id}
/patient/documents/{id}
```

The destination must still authorize the user.

---

# 85. Expired Links

Notification links should not create permanent access to resources.

A notification link may identify a resource, but the application must re-authenticate/authorize on access.

---

# 86. Unauthenticated User

If a user clicks a notification link while logged out:

```text
Login
→ safe internal redirect
→ authorized resource
```

Reuse Phase 06 safe redirect logic.

Never create an open redirect.

---

# 87. Notification Center UI

Use the Punarvasu design system.

Recommended:

```text
Notification Bell
        ↓
Notification Panel
        ↓
All / Unread
        ↓
Notification item
```

Keep it clean and useful.

---

# 88. Notification Item

Show:

* concise title
* short message
* relative/absolute date
* read/unread state
* optional navigation target

Do not expose unnecessary clinical information.

---

# 89. Empty State

Example:

```text
You're all caught up.
No new notifications.
```

---

# 90. Accessibility

Notification UI must support:

* keyboard navigation
* screen readers
* accessible notification count
* focus management
* semantic buttons/links
* reduced motion

Do not rely on color alone for unread state.

---

# 91. Notification Toasts

Transient toast notifications may be used for immediate actions:

```text
Appointment confirmed
```

But a toast must not replace durable notification history when the event is important.

---

# 92. Motion

Use subtle motion consistent with Phase 02.

Respect:

```text
prefers-reduced-motion
```

Do not animate every notification.

---

# 93. Responsive Design

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

Notification center must work on mobile.

---

# 94. Performance

Avoid:

```text
load every notification ever
```

Use:

* pagination
* cursor-based loading where appropriate
* bounded queries
* unread count query
* lazy loading

---

# 95. Database Indexes

Potential indexes:

```text
recipient_user_id
created_at
read_at
status
scheduled_for
notification_type
```

Choose based on actual queries.

---

# 96. Retention

Do not automatically delete notifications without a defined retention policy.

Notification retention may differ from clinical data retention.

Define a reasonable product policy or defer automated deletion.

---

# 97. Notification Preferences Security

A user may modify only their own preferences.

Do not allow:

```json
{
  "userId": "another-user"
}
```

to modify another user's settings.

---

# 98. Staff Preference Security

Staff may have notification preferences too.

They must be scoped to the authenticated staff account.

---

# 99. Template Versioning

Where practical, identify template versions.

If a notification is historically stored, later template changes should not unexpectedly rewrite historical content.

---

# 100. Localization

Design templates so localization can be introduced later.

Do not hard-code language-specific text throughout business logic.

Initial language may remain English unless other languages are explicitly required.

---

# 101. India-Specific Communication

Do not assume SMS/WhatsApp delivery is universally available.

Provider capabilities, consent, sender configuration, templates, and regional requirements must be verified before production use.

Keep the architecture provider-agnostic.

---

# 102. Time-Sensitive Notifications

Appointment reminders are time-sensitive.

Build them so:

```text
current authoritative appointment
+
current timezone
+
current status
```

are checked before delivery.

---

# 103. Notification Failure Must Not Break Core Operations

Bad:

```text
Appointment confirmation
→ email provider fails
→ appointment transaction rolls back
```

Good:

```text
Appointment confirmation
→ appointment successfully saved
→ notification queued
→ provider failure handled independently
```

---

# 104. Retry Safety

A retry must not create duplicate external messages.

Use idempotency where provider/API supports it.

---

# 105. Dead-Letter / Failed Notifications

Persist permanently failed notifications where useful.

Provide enough information for operations without storing unnecessary sensitive content.

---

# 106. Admin/Operations View

Do not build a large notification administration dashboard unless required.

A minimal operational view may eventually expose:

```text
pending
failed
delivered
```

without exposing unnecessary clinical content.

---

# 107. Provider Webhook Events

If implemented:

```text
provider
→ webhook
→ verify signature
→ resolve delivery
→ update status
```

Do not allow the browser to update delivery status.

---

# 108. Rate Limiting

Apply rate limits to:

* notification-triggering endpoints
* resend operations
* OTP-related notifications if applicable
* public contact notifications
* webhook endpoints where appropriate

Do not allow a user to intentionally spam another person's email/phone.

---

# 109. Notification Abuse

This must NOT work:

```text
POST /notifications/send
{
  "to": "victim@example.com",
  "body": "..."
}
```

unless the server operation is an authorized internal workflow.

There should be no arbitrary notification-sending endpoint exposed to ordinary users.

---

# 110. Contact Information Protection

Do not allow the browser to select:

```text
recipientEmail
recipientPhone
```

for transactional notifications.

The server resolves recipients from authoritative user/contact data.

---

# 111. Few-Shot Examples

## Example 1 — Appointment Confirmation

### Bad

```text
User clicks Confirm
→ immediately send email
→ database update later
```

### Good

```text
Authorize
→ update appointment
→ transaction succeeds
→ event/outbox
→ notification worker
→ email
```

---

## Example 2 — Notification Authorization

### Bad

```ts
if (user.isLoggedIn) {
  return notifications;
}
```

### Good

```text
Authenticated user
→ query notifications where recipient_user_id = auth.uid()
```

plus RLS.

---

## Example 3 — Prescription Notification

### Bad

```text
SMS:
"Your prescription is:
Medicine A 500mg twice daily..."
```

### Good

```text
SMS:
"A new prescription is available in your Punarvasu account."
```

---

## Example 4 — Clinical Privacy

### Bad

```text
Email subject:
"Your diabetes treatment results are ready"
```

### Good

```text
Email subject:
"New update from Punarvasu"
```

---

## Example 5 — Reminder After Reschedule

### Bad

```text
Appointment rescheduled
→ old reminder still fires
→ new reminder also fires
```

### Good

```text
Reschedule
→ invalidate old reminder
→ schedule new reminder
```

---

## Example 6 — Provider Failure

### Bad

```text
Email provider timeout
→ appointment creation fails
```

### Good

```text
Appointment created
→ notification queued
→ email retries independently
```

---

## Example 7 — Duplicate Delivery

### Bad

```text
Worker retries
→ same email sent 3 times
```

### Good

```text
Event ID / idempotency key
→ repeated processing
→ one authoritative delivery
```

---

## Example 8 — Notification Link

### Bad

```text
Notification
→ direct public document URL
```

### Good

```text
Notification
→ /patient/documents/{id}
→ authentication
→ authorization
→ secure document access
```

---

## Example 9 — Recipient

### Bad

```json
{
  "recipientEmail": "someone@example.com"
}
```

### Good

```text
Domain event
→ resolve patient
→ resolve verified contact
→ send
```

---

## Example 10 — Webhook

### Bad

```text
POST /webhook
→ trust "delivered": true
```

### Good

```text
Webhook
→ verify provider signature
→ validate event
→ idempotently update delivery
```

---

# 112. Expected Architectural Areas

Adapt to the existing repository.

Potential structure:

```text
src/
  app/
    patient/
      notifications/
        page.tsx
    api/
      notifications/
      webhooks/

  components/
    notifications/
      notification-center.tsx
      notification-item.tsx
      notification-bell.tsx
      notification-preferences.tsx

  server/
    notifications/
      events.ts
      queries.ts
      mutations.ts
      authorization.ts
      preferences.ts
      templates.ts
      delivery.ts
      scheduling.ts

  lib/
    notifications/
      types.ts
      channels/
        email.ts
        sms.ts
        whatsapp.ts
      idempotency.ts

supabase/
  migrations/
    ...notifications...
```

Do not blindly create this structure.

Follow existing project conventions.

---

# 113. Database Models

Potential:

```text
notifications
notification_deliveries
notification_preferences
notification_events / outbox_events
```

Only create the models actually needed.

---

# 114. Event Types

Use a typed event model.

Example:

```ts
type DomainEvent =
  | AppointmentConfirmedEvent
  | AppointmentRescheduledEvent
  | AppointmentCancelledEvent
  | AppointmentReminderEvent
  | PrescriptionIssuedEvent;
```

Do not use arbitrary strings throughout the codebase.

---

# 115. Event Payloads

Event payloads should contain identifiers and minimum necessary data.

Prefer:

```ts
{
  eventId,
  appointmentId,
  patientId
}
```

and load authoritative data when processing.

Avoid embedding complete clinical records into events.

---

# 116. Event Validation

A notification processor must not blindly trust event payloads.

Verify referenced resources still exist and are in the expected state.

---

# 117. Stale Events

A delayed event may arrive after the underlying resource changes.

Example:

```text
appointment.confirmed event
→ appointment later cancelled
→ worker processes old event
```

The system should apply appropriate business rules before sending.

---

# 118. Event Ordering

Where ordering matters:

```text
confirmed
→ rescheduled
→ cancelled
```

should not result in:

```text
cancelled
→ confirmed
```

being communicated incorrectly.

Use timestamps/versions/state checks where appropriate.

---

# 119. Event Idempotency

Each event should have a unique identifier.

Processing the same event twice should be safe.

---

# 120. Notification Idempotency

A notification generated from an event should have a stable idempotency key.

Example concept:

```text
appointment:{id}:confirmed
```

or an equivalent stable event identifier.

Do not hard-code this exact format if another convention exists.

---

# 121. Reminder Idempotency

Use:

```text
appointmentId
+
reminderType
+
appointmentVersion/scheduledTime
```

or an equivalent mechanism.

---

# 122. Appointment State Source

Before sending appointment notifications, read the authoritative appointment state.

Do not rely solely on stale event payload.

---

# 123. Prescription State Source

Before sending:

```text
prescription.issued
```

verify the prescription is actually issued.

Do not notify based only on a UI event.

---

# 124. Document State Source

If document notifications are introduced, verify that the document is actually available.

---

# 125. Notification Security Tests

Mandatory:

### Notification isolation

```text
User A → User A notifications = ALLOW
User A → User B notifications = DENY
```

### Preferences

```text
User A → User A preferences = ALLOW
User A → User B preferences = DENY
```

### Staff isolation

```text
Doctor A → Doctor B private notifications = DENY
```

---

# 126. Notification Trigger Tests

Test:

```text
appointment confirmed
appointment rescheduled
appointment cancelled
appointment reminder
prescription issued
```

Each should create the expected notification exactly once.

---

# 127. Failure Tests

Test:

```text
provider timeout
provider 500
provider rate limit
invalid recipient
worker restart
network retry
duplicate event
duplicate webhook
```

The underlying domain state must remain correct.

---

# 128. Privacy Tests

Verify:

```text
diagnosis not in email subject
clinical notes not in SMS
prescription details not in generic push preview
document contents not in notification body
clinical data not in logs
```

---

# 129. Security Tests for Recipients

Attempt to manipulate:

```text
recipientUserId
recipientEmail
recipientPhone
channel
template
body
```

from the browser.

The server must ignore/reject unauthorized values.

---

# 130. Webhook Security Tests

Test:

```text
unsigned webhook
invalid signature
malformed payload
duplicate webhook
unknown delivery ID
replayed webhook
```

---

# 131. Reminder Tests

Test:

```text
confirmed appointment → reminder sent
cancelled appointment → reminder NOT sent
rescheduled appointment → old reminder NOT sent
rescheduled appointment → new reminder sent
completed appointment → reminder NOT sent
duplicate worker execution → one reminder
```

---

# 132. Notification Preference Tests

Test:

```text
email enabled → email eligible
email disabled → optional email suppressed
mandatory notification → follows mandatory policy
```

---

# 133. Access Link Tests

Test:

```text
logged-out user
→ login
→ safe redirect
→ authorized resource
```

and:

```text
user
→ notification link for another patient's resource
→ DENIED
```

---

# 134. Rate Limit Tests

Test repeated:

```text
resend
notification-triggering action
webhook requests
```

Ensure the system cannot be abused for notification spam.

---

# 135. Accessibility Tests

Verify:

* keyboard notification center
* screen-reader labels
* unread indicators
* focus management
* toast accessibility
* reduced motion

---

# 136. Performance Tests

Verify:

* notification list is paginated
* unread count is efficient
* no full notification table is downloaded
* worker does not repeatedly query unbounded data
* reminder queries are indexed

---

# 137. Acceptance Criteria

Phase 15 is complete only when:

## Architecture

* [ ] Notification system is event-driven.
* [ ] Notifications do not own domain state.
* [ ] Domain events are typed.
* [ ] Event processing is idempotent.
* [ ] Provider integrations are abstracted.
* [ ] Notification delivery is decoupled from critical domain mutations.

## In-App

* [ ] Authenticated users can view their notifications.
* [ ] Users cannot view another user's notifications.
* [ ] Read/unread state works.
* [ ] Notification center is responsive.
* [ ] Notification links are authorization-safe.

## Appointments

* [ ] Confirmation notification works.
* [ ] Reschedule notification works.
* [ ] Cancellation notification works.
* [ ] Reminder workflow works if enabled.
* [ ] Cancelled appointments do not trigger old reminders.
* [ ] Rescheduled appointments invalidate old reminders.

## Prescriptions

* [ ] Issued prescription can generate notification.
* [ ] Draft prescription does not generate a final-prescription notification.
* [ ] Notification does not expose full prescription details unnecessarily.

## Treatment Plans/Documents

* [ ] Notifications can be extended to these resources where required.
* [ ] Sensitive content is not unnecessarily sent through external channels.

## Preferences

* [ ] User preferences are scoped to the authenticated user.
* [ ] Optional notifications respect preferences.
* [ ] Mandatory transactional communications follow defined policy.

## External Delivery

* [ ] Email adapter works if configured.
* [ ] SMS/WhatsApp only exists if actually configured.
* [ ] Provider credentials remain server-side.
* [ ] Provider failures are handled.
* [ ] Retry strategy exists for transient failures.
* [ ] Duplicate delivery is prevented.

## Webhooks

* [ ] Provider signatures are verified where supported.
* [ ] Webhooks are idempotent.
* [ ] Replayed events do not corrupt delivery state.

## Privacy

* [ ] Clinical details are minimized.
* [ ] No diagnosis in generic notification previews.
* [ ] No prescription details in SMS by default.
* [ ] No document content in notifications by default.
* [ ] Sensitive data is not logged.
* [ ] Notification links do not bypass authorization.

## Security

* [ ] Notification IDOR tests pass.
* [ ] Preference IDOR tests pass.
* [ ] Recipient manipulation is blocked.
* [ ] Arbitrary notification sending is blocked.
* [ ] Provider credentials are protected.
* [ ] RLS is enabled and tested.

## Engineering

* [ ] Existing authorization is reused.
* [ ] Existing appointment system is reused.
* [ ] Existing prescription system is reused.
* [ ] Existing patient identity is reused.
* [ ] TypeScript remains strict.
* [ ] Lint passes.
* [ ] Typecheck passes.
* [ ] Tests pass.
* [ ] Production build passes.

---

# 138. Definition of Done

Phase 15 is done when Punarvasu can reliably communicate important operational events:

```text
Appointment
    ↓
confirmed
    ↓
notification event
    ↓
patient notification
```

and:

```text
Prescription
    ↓
issued
    ↓
notification event
    ↓
patient notified
```

while maintaining:

```text
Domain State
     ≠
Notification State
     ≠
Delivery State
```

and:

```text
Patient A
    ✕
Patient B notifications

Patient A
    ✕
Patient B notification links

Unauthorized user
    ✕
Notification resource

Browser
    ✕
Arbitrary recipient

Notification
    ✕
Clinical decision
```

The system must remain reliable when external communication providers fail.

---

# 139. Explicitly Out of Scope

Do NOT implement:

* marketing automation
* promotional campaigns
* AI-generated clinical notifications
* autonomous medical advice
* autonomous treatment recommendations
* pharmacy messaging
* telemedicine messaging
* full chat/messaging platform
* doctor-patient real-time chat
* bulk marketing campaigns
* complex CRM
* analytics dashboards
* advanced campaign segmentation

Phase 16 owns Analytics & Reporting.

Phase 17 owns AI Clinical Decision Support.

---

# 140. Final Verification

Run:

```text
lint
typecheck
tests
production build
```

Then manually verify:

```text
Appointment
→ Confirm
→ Notification created
→ In-app notification appears
→ Email sent if configured
```

Verify:

```text
Appointment
→ Reschedule
→ Old reminder invalidated
→ New reminder scheduled
```

Verify:

```text
Appointment
→ Cancel
→ Pending reminder does not send
```

Verify:

```text
Prescription
→ Draft
→ no patient final notification

Prescription
→ Issue
→ patient notification
```

Verify:

```text
Patient A
→ cannot access Patient B notifications
→ cannot follow Patient B notification link
```

Verify provider failure:

```text
Appointment confirmed
→ email provider unavailable
→ appointment remains confirmed
→ notification remains retryable/failed
```

Verify duplicate processing:

```text
Same event processed twice
→ one logical notification
→ no duplicate external message
```

---

# 141. Completion Report

At completion, report:

## Implemented

* Event system
* Notification model
* In-app notification center
* Notification preferences
* Appointment notifications
* Prescription notifications
* Reminder system
* Email provider
* Other configured channels
* Retry mechanism
* Idempotency
* Webhook handling

## Database

Report:

```text
Tables:
Enums:
Foreign keys:
Indexes:
Constraints:
RLS policies:
```

## Event Architecture

Report:

```text
Events:
Outbox/event mechanism:
Idempotency strategy:
Worker/processor:
Retry strategy:
```

## Channels

Report:

```text
In-app:
Email:
SMS:
WhatsApp:
Provider:
```

Clearly state which channels are actually functional.

## Security

Report:

```text
Notification isolation:
Preference isolation:
Recipient protection:
IDOR:
Webhook security:
Rate limiting:
Secret protection:
```

## Privacy

Report:

```text
Clinical-data minimization:
Email privacy:
SMS privacy:
Logging:
Caching:
Notification links:
```

## Verification

```text
Lint:
Typecheck:
Tests:
Build:
```

## Deferred

List intentionally deferred:

* marketing
* advanced messaging
* additional channels
* campaign system
* advanced notification analytics
* other future work

## Phase Status

```text
Phase 15: COMPLETE
Ready for Phase 16: YES/NO
```

Do not begin Phase 16 during this phase.
