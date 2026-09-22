# Phase 00 — Project Discovery & Engineering Constitution

## Objective

Establish the architectural, product, design, security, data, and development foundations for the Punarvasu project before implementing application features.

This phase is primarily a **discovery, documentation, and planning phase**.

The goal is to ensure that future phases can be implemented consistently by Codex, Claude, or another developer without repeatedly making architectural decisions from scratch.

Phase 00 should result in a clear and reliable engineering contract for the entire project.

---

# 1. Punarvasu Product Context

Punarvasu is intended to be a premium Ayurvedic clinic platform.

The long-term product consists of multiple interconnected experiences:

### Public Website

* Home
* About
* Clinic
* Ayurvedic philosophy
* Treatments/services
* Practitioners
* Articles
* FAQ
* Contact
* Appointment booking

### Patient Experience

* Registration/login
* Patient profile
* Appointment booking
* Appointment history
* Appointment rescheduling/cancellation
* Clinical information visible to the patient
* Prescriptions
* Treatment plans
* Documents
* Notifications
* Patient journey
* Follow-up information

### Receptionist Experience

* Appointment management
* Patient search
* Daily schedule
* Check-in/check-out workflow
* Operational patient information
* Appointment status management

### Doctor Experience

* Doctor dashboard
* Today's appointments
* Patient timeline
* Consultation/visit records
* Clinical notes
* Ayurvedic assessment information where applicable
* Treatment plans
* Prescriptions
* Follow-ups
* Patient documents
* Clinical decision-support assistance

### Administration

* Clinic management
* Practitioner management
* Services/treatments
* Appointment configuration
* Availability
* Content management
* Users/roles
* Notifications
* Operational analytics
* Audit logs
* Settings

### Future-ready capabilities

The architecture should not prevent future implementation of:

* Teleconsultation
* Online payments
* Treatment packages
* Memberships
* Multiple clinic branches
* Digital consent
* Waitlists
* Family/dependent accounts
* WhatsApp communication
* Advanced reporting
* AI-assisted workflows

Do not implement these future features in Phase 00.

---

# 2. Technology Baseline

The project is expected to use the following technology direction:

* Next.js
* TypeScript
* Tailwind CSS v4
* shadcn/ui
* Supabase
* Framer Motion
* Zustand where client-side state is genuinely required

Before making architectural decisions, inspect the current repository.

If the repository already contains technology choices, preserve them unless there is a strong technical reason to change them.

Do not replace existing technologies merely because another approach is preferred.

---

# 3. Repository Discovery

Inspect the complete repository before making changes.

Understand:

* Current directory structure
* Existing application routes
* Existing components
* Existing utilities
* Existing database code
* Supabase configuration
* Existing migrations
* Authentication setup
* Existing environment variables
* Existing testing setup
* Existing linting/formatting
* Existing dependencies
* Existing design implementation

Do not assume that the repository is empty.

---

# 4. Existing Code Assessment

Identify:

### Working functionality

Document what already works.

### Incomplete functionality

Document partially implemented functionality.

### Technical debt

Identify:

* duplicated code
* inconsistent patterns
* unsafe patterns
* architectural problems
* hardcoded values
* missing validation
* missing error handling

### Risk areas

Identify areas that may create future problems.

Examples:

* authentication
* authorization
* Supabase access
* database schema
* patient data
* file storage
* appointment concurrency
* client/server boundaries

Do not perform a large refactor in this phase unless absolutely necessary.

---

# 5. Product Architecture

Create:

`docs/product-spec.md`

Document the major product areas.

At minimum:

```text
Public Website
        ↓
Authentication
        ↓
Patient Portal
        ↓
Appointments
        ↓
Receptionist Workspace
        ↓
Doctor Workspace
        ↓
Clinical Records
        ↓
Prescriptions / Treatment Plans
        ↓
Documents
        ↓
Notifications
        ↓
Analytics
        ↓
AI Decision Support
```

Document dependencies between these areas.

---

# 6. User Roles

Define the initial role model.

Expected roles:

* PATIENT
* RECEPTIONIST
* DOCTOR
* ADMIN

A future SUPER_ADMIN role may be considered, but should not be implemented unless required by the existing architecture.

Document what each role is intended to do.

Do not assume that frontend visibility equals authorization.

Authorization must eventually exist at the server/database layer.

---

# 7. Permission Philosophy

Document the principle of least privilege.

Every feature should answer:

1. Who can view this?
2. Who can create it?
3. Who can update it?
4. Who can delete/deactivate it?
5. Who can approve it?
6. Who can access it through an API?
7. Who can access associated files?

Create a preliminary permission matrix.

Example:

| Capability               |  Patient | Receptionist |        Doctor |      Admin |
| ------------------------ | -------: | -----------: | ------------: | ---------: |
| Own profile              |      Yes |           No |            No | Controlled |
| Own appointments         |      Yes |  Operational |           Yes |        Yes |
| Patient clinical records |  Limited |           No |    Authorized | Controlled |
| Prescriptions            | View own |           No | Create/manage | Controlled |
| Practitioner management  |       No |           No |            No |        Yes |
| Service management       |       No |           No |            No |        Yes |
| Clinic settings          |       No |           No |            No |        Yes |

This is a planning document.

Detailed permissions will be refined in later phases.

---

# 8. Security Philosophy

Punarvasu may process sensitive patient and clinical information.

Security must therefore be designed from the beginning.

Document these principles:

### Server-side authorization

Never rely only on frontend checks.

### Database-level protection

Use Supabase Row Level Security where appropriate.

### Least privilege

Users should receive only the permissions required for their role.

### Data minimization

Do not collect or expose information unnecessarily.

### Private files

Patient documents must not be stored in publicly accessible buckets.

### Auditability

Sensitive clinical operations should eventually be auditable.

### No sensitive logs

Never log:

* passwords
* authentication tokens
* private credentials
* unnecessary patient information
* sensitive clinical information

---

# 9. Healthcare Safety Philosophy

Punarvasu is healthcare-related software.

The platform must not fabricate clinical information.

Never invent:

* doctor credentials
* qualifications
* certifications
* awards
* patient testimonials
* success rates
* clinical outcomes
* medical claims

Where actual clinic information is unavailable, use clearly marked placeholders.

---

# 10. AI Safety Principles

AI will eventually be used as an assistant.

Document the following as non-negotiable:

AI must NOT independently:

* diagnose patients
* prescribe medicines
* modify final clinical records
* approve treatment plans
* send autonomous medical advice
* make final clinical decisions

AI may eventually assist practitioners with:

* summarizing patient history
* summarizing previous visits
* identifying potentially relevant information
* generating draft notes
* suggesting questions for review
* producing patient-friendly explanations

A qualified practitioner must remain responsible for final clinical decisions.

AI-generated information must be clearly identified.

AI interactions involving sensitive clinical information must be designed with data minimization and auditability.

---

# 11. Data Architecture Planning

Create:

`docs/database.md`

Do not necessarily implement every table yet.

Document the expected major entities.

Potential entities:

```text
users
profiles
patients
practitioners
services
appointments
availability
clinic_hours
clinic_holidays
leave
clinical_visits
clinical_notes
assessments
treatment_plans
prescriptions
prescription_items
documents
notifications
articles
audit_logs
clinic_settings
```

For each major entity document:

* Purpose
* Important relationships
* Ownership
* Sensitive fields
* Expected access patterns

Do not over-design the schema.

Prefer a normalized relational model with clear relationships.

---

# 12. Data Ownership

Document ownership rules.

For example:

A patient owns their profile and patient-facing information.

A practitioner creates clinical records according to authorization.

Appointments belong to patients and practitioners.

Clinical records should not be editable by arbitrary users.

Historical clinical information should generally be preserved rather than silently overwritten.

---

# 13. Appointment Architecture Planning

Appointment booking is a critical domain.

Document that the future appointment system must support:

* practitioner availability
* clinic working hours
* breaks
* holidays
* practitioner leave
* appointment duration
* buffer time
* existing appointments
* cancellation
* rescheduling
* status transitions
* concurrency protection

Most importantly:

> Availability shown in the UI is not authoritative.

The server/database must revalidate availability when a booking is created.

Concurrent requests must not result in duplicate bookings for the same slot.

---

# 14. Clinical Record Philosophy

Clinical information should be modeled as historical records rather than a single mutable blob wherever appropriate.

For example:

```text
Patient
   ↓
Visit 1
   ↓
Visit 2
   ↓
Visit 3
```

Do not design the system around overwriting a patient's entire history.

Important clinical changes should remain traceable.

---

# 15. Prescription Philosophy

Prescriptions should be treated as historical clinical artifacts.

Do not silently overwrite previously issued prescriptions.

Future implementations should support version/history semantics.

---

# 16. File Storage Architecture

Patient documents may contain sensitive information.

Document the expected storage strategy:

```text
Client
  ↓
Authentication
  ↓
Authorization
  ↓
Upload validation
  ↓
Private storage bucket
  ↓
Controlled access
  ↓
Short-lived signed URL
```

Never design sensitive patient files as permanently public URLs.

---

# 17. Design Philosophy

Create:

`docs/design-system.md`

Document the intended visual direction.

Punarvasu should feel:

* Premium
* Calm
* Natural
* Trustworthy
* Warm
* Modern
* Professional

The visual identity should subtly communicate Ayurveda without becoming stereotypical or overly decorative.

Avoid:

* excessive green
* generic hospital UI
* excessive gradients
* excessive glassmorphism
* excessive animations
* clutter
* template-like layouts
* generic stock-dashboard appearance

---

# 18. UX Philosophy

The product should optimize for clarity rather than feature density.

Every important workflow should have:

* loading state
* success state
* error state
* empty state
* validation state

Users should always understand:

* what happened
* what is happening
* what they can do next

---

# 19. Responsive Design Philosophy

Mobile is a first-class experience.

Do not simply shrink the desktop interface.

Pay particular attention to:

* appointment booking
* forms
* date/time selection
* patient dashboard
* navigation
* doctor workflows
* touch targets

Avoid horizontal scrolling unless absolutely necessary.

---

# 20. Accessibility Philosophy

Target WCAG AA principles.

Future implementation should support:

* keyboard navigation
* visible focus
* semantic HTML
* accessible forms
* screen-reader labels
* accessible dialogs
* sufficient contrast
* reduced motion
* accessible error messages

Accessibility should be considered during implementation rather than as a final patch.

---

# 21. Animation Philosophy

Use Framer Motion only where it improves the experience.

Good use cases:

* page transitions
* hero entrance
* subtle section reveals
* modal transitions
* progressive UI feedback

Avoid animations that:

* slow users down
* distract from clinical workflows
* make forms harder to use
* create accessibility problems

Respect reduced-motion preferences.

---

# 22. Architecture Decisions

Create:

`docs/architecture.md`

Document:

* application architecture
* server/client boundaries
* feature organization
* data access patterns
* authentication approach
* authorization approach
* Supabase usage
* state management
* error handling
* validation
* logging
* testing architecture

The goal is not to produce theoretical documentation.

Document decisions that future developers can actually follow.

---

# 23. Folder Structure

Define a recommended folder structure based on the actual repository.

Prefer domain/feature-oriented organization.

Example:

```text
src/
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── patients/
│   ├── practitioners/
│   ├── appointments/
│   ├── clinical-records/
│   ├── prescriptions/
│   ├── documents/
│   ├── notifications/
│   ├── articles/
│   └── analytics/
├── lib/
├── hooks/
├── stores/
├── types/
├── utils/
└── config/
```

Do not blindly apply this structure if the existing repository has a better established architecture.

---

# 24. Environment Configuration

Create/update:

`.env.example`

Document environment variables without exposing secrets.

Potential categories:

```text
Application
Database
Supabase
Authentication
Email
Storage
AI
Analytics
External integrations
```

Do not place actual credentials in documentation.

---

# 25. Testing Strategy

Create:

`docs/qa-strategy.md`

Document:

### Unit tests

Business logic and utilities.

### Integration tests

Database and server behavior.

### E2E tests

Critical user workflows.

### Security tests

Authorization, RLS and data isolation.

### Accessibility tests

Keyboard and automated accessibility checks.

### Performance tests

Public website and important workflows.

---

# 26. Security Test Philosophy

Every protected feature should eventually have negative tests.

Examples:

```text
Patient A → Patient B data
        → DENY

Patient → Admin endpoint
        → DENY

Receptionist → Clinical notes
        → DENY

Unauthorized user → Private document
        → DENY
```

Do not only test successful scenarios.

---

# 27. Bad → Good Engineering Examples

These examples define the expected quality bar.

## Example 1 — Authorization

### BAD

```ts
if (user.role === "admin") {
  showAdminPage();
}
```

This only controls the UI.

### GOOD

```text
Frontend authorization
        +
Server authorization
        +
Database/RLS protection
```

---

## Example 2 — Sensitive documents

### BAD

```text
Upload
 ↓
Public storage
 ↓
Permanent public URL
```

### GOOD

```text
Upload
 ↓
Validate
 ↓
Private storage
 ↓
Authorization
 ↓
Short-lived signed URL
```

---

## Example 3 — Appointment booking

### BAD

```text
Check availability
 ↓
Insert appointment
```

### GOOD

```text
Check availability
 ↓
Server revalidation
 ↓
Database constraint/transaction
 ↓
Create appointment
```

---

## Example 4 — Clinical history

### BAD

```text
Patient record
 ↓
Overwrite every consultation
```

### GOOD

```text
Patient
 ↓
Visit 1
 ↓
Visit 2
 ↓
Visit 3
```

Historical information remains traceable.

---

## Example 5 — Loading state

### BAD

```text
Loading...
```

### GOOD

Use a contextual skeleton that resembles the final UI.

---

## Example 6 — Error handling

### BAD

```text
500 Internal Server Error
```

### GOOD

```text
Something went wrong.

We couldn't complete this action.
Please try again.

[Try Again]
```

The user should receive a helpful message while technical details remain in secure logs.

---

# 28. Documentation Standards

Documentation should be:

* concise
* actionable
* current
* implementation-oriented

Do not create documentation simply to increase the number of files.

Whenever an architectural decision changes, update the relevant documentation.

---

# 29. Expected Files

Phase 00 should primarily create/update documentation.

Expected files:

```text
agent.md

docs/
├── product-spec.md
├── architecture.md
├── database.md
├── design-system.md
├── security.md
└── qa-strategy.md

phases/
└── phase_00.md

.env.example
```

Do not create large amounts of application code unless required to establish the project foundation.

---

# 30. Expected Database Changes

Prefer NO production database schema changes in Phase 00 unless the repository already requires an initial migration/foundation.

If database changes are necessary:

* use migrations
* document them
* do not use unreproducible manual changes

---

# 31. Security Verification

Before completing Phase 00 verify:

* No secrets were committed.
* No service-role credentials are exposed to client-side code.
* `.env.example` contains placeholders only.
* Existing authentication secrets are not documented.
* Sensitive patient information is not included in sample data.
* No public storage design is proposed for sensitive documents.
* Role/permission assumptions are documented.
* AI safety principles are documented.

---

# 32. Acceptance Criteria

Phase 00 is complete only when:

* [ ] Existing repository has been inspected.
* [ ] Existing technology choices are documented.
* [ ] Product architecture is documented.
* [ ] User roles are documented.
* [ ] Preliminary permission model exists.
* [ ] Security principles are documented.
* [ ] Healthcare safety principles are documented.
* [ ] AI safety principles are documented.
* [ ] Database architecture is documented.
* [ ] Appointment architecture is documented.
* [ ] Clinical record philosophy is documented.
* [ ] Prescription history philosophy is documented.
* [ ] File-storage security strategy is documented.
* [ ] Design philosophy is documented.
* [ ] UX principles are documented.
* [ ] Accessibility principles are documented.
* [ ] Testing strategy is documented.
* [ ] Expected folder structure is documented.
* [ ] Environment configuration is documented.
* [ ] No secrets are exposed.
* [ ] No unnecessary feature implementation has been started.

---

# 33. Definition of Done

Phase 00 is NOT complete because documentation files exist.

It is complete when a new developer can read:

```text
agent.md
+
docs/*
+
phases/phase_00.md
```

and understand:

* What Punarvasu is.
* What the major product areas are.
* Who the users are.
* How the application should be architected.
* How security should work.
* How sensitive information should be handled.
* How AI should be constrained.
* What the design language should be.
* How future features should be structured.
* What quality standards the project must maintain.

The documentation must be internally consistent.

---

# 34. Phase Completion Report

At the end of the phase, report:

### Repository assessment

What already existed?

### Architectural decisions

What decisions were made?

### Documentation created

List all files created/updated.

### Technical risks

List important risks discovered.

### Security risks

List security concerns discovered.

### Database considerations

List important schema decisions.

### Deferred decisions

Clearly identify decisions intentionally postponed to later phases.

### Verification

Report:

* TypeScript: PASS/NOT APPLICABLE
* ESLint: PASS/NOT APPLICABLE
* Tests: PASS/NOT APPLICABLE
* Build: PASS/NOT APPLICABLE

Do not claim something was tested if it was not actually tested.
