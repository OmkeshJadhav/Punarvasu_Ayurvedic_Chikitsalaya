# Phase 21 — Production Launch & Handover

## 1. Phase Objective

Deploy Punarvasu to production and establish a stable, secure, observable, maintainable production environment.

Phase 21 is the final phase of the implementation roadmap.

The objective is to move from:

```text
Development
    ↓
Tested Application
    ↓
Production Infrastructure
    ↓
Production Deployment
    ↓
Smoke Testing
    ↓
Monitoring
    ↓
Handover
```

The final result should be a production-ready Punarvasu system that the clinic/client can operate safely.

---

# 2. Phase Boundary

Phase 21 consumes:

* all application functionality from Phases 00–18
* security hardening from Phase 19
* performance/SEO/accessibility work from Phase 20

Phase 21 focuses on:

* production infrastructure
* deployment
* environment configuration
* database migration
* storage configuration
* authentication configuration
* domain configuration
* monitoring
* backups
* production verification
* rollback readiness
* operational documentation
* final handover

Do not introduce new product functionality.

---

# 3. Production Architecture

Document the final deployed architecture.

Example:

```text
                    Internet
                       │
                       ▼
                 Production Domain
                       │
                       ▼
                  Next.js App
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Supabase      Storage       External
      Database      Private       Providers
                     Files
          │
    ┌─────┼──────────────┐
    ▼     ▼              ▼
   Auth   RLS        Application Data

External Providers:
- Email
- SMS/WhatsApp if configured
- AI provider
- Maps/other approved services
```

Use the actual production architecture rather than this example.

---

# 4. Infrastructure Ownership

Document who owns:

* domain
* DNS
* Vercel/deployment account
* Supabase project
* email provider
* SMS/WhatsApp provider
* AI provider
* monitoring
* repository
* billing accounts

Do not leave production infrastructure dependent on one developer's personal account.

---

# 5. Account Ownership

Production accounts should be owned by the client/business or an agreed organization account.

Developer access should be granted explicitly and using least privilege.

---

# 6. Domain

Configure the client's production domain.

Verify:

* DNS
* HTTPS
* canonical domain
* redirects
* www/non-www strategy
* production environment variables

Do not assume a temporary Vercel URL is the final domain.

---

# 7. DNS

Document required DNS records.

Typical records may include:

```text
A
AAAA
CNAME
TXT
MX
```

depending on hosting/email requirements.

Only configure records actually required by the chosen providers.

---

# 8. HTTPS

Verify:

```text
https://production-domain
```

works correctly.

Verify HTTP redirects to HTTPS where appropriate.

---

# 9. TLS

Verify certificate validity.

Check:

* expiration
* hostname
* certificate chain

---

# 10. HSTS

If enabled during Phase 19/20, verify it is appropriate for the final production domain.

---

# 11. Deployment Platform

Configure the production deployment platform.

If using Vercel, verify:

* production project
* Git integration
* production branch
* build command
* install command
* output configuration
* environment variables
* domain

Do not assume Vercel; use the actual selected platform.

---

# 12. Production Branch

Define the production branch.

Example:

```text
main
```

Only verified code should reach production.

---

# 13. Deployment Strategy

Document:

```text
Pull Request
    ↓
CI checks
    ↓
Review
    ↓
Merge
    ↓
Production deployment
```

Adapt to the actual repository workflow.

---

# 14. Environment Separation

Maintain clear separation between:

```text
Development
Staging/Preview
Production
```

where applicable.

---

# 15. Production Environment Variables

Configure production environment variables securely.

Typical categories:

```text
NEXT_PUBLIC_APP_URL
Supabase URL
Supabase publishable/anon key
Supabase service-role key
AI provider key
Email provider key
SMS/WhatsApp credentials
Webhook secrets
Other provider secrets
```

Only include variables actually used by the application.

---

# 16. Public vs Private Environment Variables

Only variables explicitly safe for the browser may use:

```text
NEXT_PUBLIC_*
```

Never expose:

* service-role keys
* AI keys
* email provider secrets
* webhook secrets
* database credentials

---

# 17. Secret Verification

Before production deployment:

* scan repository
* inspect environment configuration
* inspect client bundles
* verify secret values are not hardcoded

---

# 18. Secret Rotation

If development credentials have been exposed or shared during implementation, rotate them before production.

---

# 19. Production Supabase

Use the intended production Supabase project.

Do not accidentally connect production deployment to a developer's local/test project.

---

# 20. Supabase Configuration

Verify:

* project URL
* API keys
* Auth settings
* redirect URLs
* email configuration
* Storage buckets
* Storage policies
* RLS
* database functions
* production extensions where applicable

---

# 21. Database Migration Strategy

Production schema must be created through version-controlled migrations.

Do not manually modify production tables without recording the resulting schema change.

---

# 22. Migration Order

Verify migrations can run from a clean database in the correct order.

---

# 23. Migration Rehearsal

Where practical:

```text
Clean database
→ run all migrations
→ seed safe reference data
→ verify application
```

---

# 24. Production Migration

Before running production migrations:

* backup if supported
* verify migration files
* verify target project
* review destructive operations
* understand rollback/recovery strategy

---

# 25. Destructive Migrations

Never blindly run destructive migrations.

Review:

* DROP TABLE
* DROP COLUMN
* data transformations
* constraint changes
* enum changes

---

# 26. Database Backup

Verify production backup capability.

Document:

* backup mechanism
* frequency
* retention
* restoration process
* owner

---

# 27. Restore Test

Where feasible, perform or document a restoration test.

A backup that has never been restored should not be treated as fully validated.

---

# 28. Reference Data

Seed only necessary non-sensitive reference data.

Examples:

* appointment types
* system configuration
* approved practitioner records
* service catalog

Use real production values only when verified by the client.

---

# 29. No Real Patient Seed Data

Never seed production with fake patient data that could be confused with real patients.

Never use development patient records in production.

---

# 30. Admin Bootstrap

Establish the first authorized admin using a secure server-side/bootstrap process.

Never create production admin access through a public registration role selector.

---

# 31. Staff Accounts

Create staff accounts through the approved onboarding process.

Verify:

* doctor
* receptionist
* admin

roles and scopes.

---

# 32. Role Verification

Test production role boundaries:

```text
Patient
Receptionist
Doctor
Admin
```

---

# 33. Doctor Scope

Verify every production doctor has the intended practitioner relationship/scope.

Do not assume all doctors can access every patient.

---

# 34. Receptionist Scope

Verify receptionist access is operational and does not automatically expose clinical data.

---

# 35. Admin Scope

Verify admin access matches the intended administrative policy.

Do not accidentally grant unrestricted clinical access merely because someone is an admin.

---

# 36. Authentication Configuration

Verify production Auth settings.

Check:

* site URL
* redirect URLs
* email verification
* password reset
* OTP/magic link if enabled
* email templates
* session configuration

---

# 37. Authentication URLs

Remove obsolete development URLs from production Auth configuration where appropriate.

---

# 38. Email Provider

Verify the production email provider.

Check:

* API credentials
* verified sending domain
* sender identity
* DNS records
* SPF
* DKIM
* DMARC where appropriate
* bounce handling

---

# 39. Email Testing

Send test emails for:

* account verification
* password reset
* appointment confirmation
* appointment reschedule
* appointment cancellation
* reminders
* prescription notification if implemented

Do not include unnecessary clinical information.

---

# 40. Email Deliverability

Verify:

* sender address
* subject
* formatting
* links
* mobile rendering
* spam likelihood

---

# 41. SMS / WhatsApp

If configured, verify:

* credentials
* sender identity
* templates
* webhook configuration
* delivery states
* opt-in/communication policy where applicable

Do not activate providers that are not actually configured and approved.

---

# 42. Notification Reliability

Verify:

```text
Domain action
→ notification event
→ delivery
```

works without making the domain transaction dependent on provider availability.

---

# 43. Webhook Configuration

Verify production webhook URLs and secrets.

Test:

* valid signature
* invalid signature
* duplicate webhook
* malformed payload

---

# 44. AI Provider

If AI is enabled in production:

Verify:

* production API key
* model configuration
* rate limits
* usage limits
* timeout
* provider privacy configuration
* error handling

---

# 45. AI Production Safety

Verify the AI remains:

```text
Doctor-facing
Decision-support only
Non-autonomous
```

It must not independently:

* diagnose
* prescribe
* issue prescriptions
* modify clinical records
* send clinical communication

---

# 46. AI Cost Controls

Configure appropriate:

* request limits
* usage monitoring
* budget controls
* model limits

where supported.

---

# 47. Storage Production

Verify production patient document storage.

Confirm:

```text
private bucket
+
RLS
+
Storage policies
+
authorization
+
signed URLs
```

---

# 48. Storage Migration

If existing files need migration, use a controlled migration process.

Never expose private files publicly during migration.

---

# 49. Storage Verification

Test:

```text
Patient A → own document = ALLOWED
Patient A → Patient B document = DENIED
Doctor → authorized document = ALLOWED
Unauthorized receptionist → clinical document = DENIED
```

according to the final access policy.

---

# 50. Production Security Headers

Verify the final production response headers.

Check:

* CSP
* HSTS
* X-Content-Type-Options
* Referrer-Policy
* Permissions-Policy
* frame protections
* CORS

---

# 51. Production Security Regression

Re-run critical Phase 19 security tests against production or a production-equivalent environment.

---

# 52. Performance Verification

Re-run Phase 20 production checks.

Measure:

* LCP
* INP
* CLS
* TTFB
* page weight

for key public pages.

---

# 53. SEO Production Verification

Verify the final domain.

Check:

* sitemap
* robots
* canonical URLs
* metadata
* Open Graph
* structured data
* indexability

---

# 54. Staging/Preview Indexing

Ensure preview/staging environments do not unintentionally compete with production in search results.

---

# 55. Sitemap

Verify:

```text
https://production-domain/sitemap.xml
```

contains only intended public URLs.

---

# 56. Robots

Verify:

```text
https://production-domain/robots.txt
```

has appropriate production behavior.

---

# 57. Search Console

Where the client owns the property, configure the production domain in the appropriate search-engine webmaster tooling.

Ownership should remain with the client/business.

---

# 58. Analytics

If analytics is configured, verify:

* correct production property
* no development traffic
* no clinical data
* no sensitive URLs
* no accidental patient information

---

# 59. Error Monitoring

Configure production error monitoring if selected.

Verify:

* errors are captured
* PII is scrubbed
* alerts work
* source maps are handled securely
* access is restricted

---

# 60. Application Monitoring

Monitor:

* application errors
* API failures
* database errors
* notification failures
* AI failures
* storage failures

---

# 61. Health Check

Verify a production health endpoint such as:

```text
/api/health
```

returns only safe operational information.

Do not expose:

* secrets
* database credentials
* internal configuration
* sensitive patient data

---

# 62. Health Check Dependencies

Decide what the health endpoint should check.

Avoid making a simple health check depend on every third-party provider unless that is intentionally designed.

---

# 63. Uptime Monitoring

Configure uptime monitoring if part of the deployment plan.

Monitor the public application and important health endpoint.

---

# 64. Alerting

Define alerts for meaningful failures.

Examples:

* production unavailable
* repeated 5xx errors
* database connectivity issues
* notification failures
* abnormal AI failure rate

Avoid alert noise.

---

# 65. Logs

Verify production logging is:

* structured
* privacy-safe
* useful
* appropriately retained

---

# 66. No Sensitive Logs

Final production review must confirm logs do not contain:

* passwords
* tokens
* OTPs
* API keys
* clinical records
* document contents
* full AI prompts
* full AI responses

---

# 67. Audit Logging

Verify important security/clinical events remain auditable according to the product's policy.

---

# 68. Rate Limits

Verify production rate limits for:

* login
* registration
* password reset
* OTP
* public forms
* appointments
* document uploads
* AI
* exports
* notification operations

---

# 69. Abuse Testing

Perform controlled production-safe tests.

Do not run destructive stress tests against production.

---

# 70. Load Testing

If load testing is required, run it against staging or an isolated environment.

Do not perform aggressive load testing against live clinic infrastructure without explicit approval.

---

# 71. Database Performance

Review production database metrics after deployment.

Check for:

* slow queries
* connection saturation
* unexpected load
* expensive analytics queries

---

# 72. Storage Performance

Check document upload/download behavior with realistic files.

---

# 73. Notification Performance

Verify notification workers/queues if implemented.

Check:

* queue backlog
* retry behavior
* provider failures

---

# 74. AI Performance

Check:

* latency
* timeouts
* provider errors
* request volume
* token/cost usage

---

# 75. Error Boundaries

Verify production:

* error page
* 404 page
* loading states
* API error handling

---

# 76. User-Facing Errors

Production errors must remain safe and human-readable.

---

# 77. Browser Compatibility

Perform final checks on major supported browsers.

At minimum, where practical:

* Chrome
* Safari
* Firefox
* Edge

---

# 78. Mobile Verification

Verify Android and iOS mobile browsers where available.

---

# 79. Responsive Verification

Reconfirm critical screens at:

```text
320
375
390
430
768
1024
1280
1440
1920+
```

---

# 80. Accessibility Smoke Test

Perform final keyboard and screen-reader smoke tests.

---

# 81. Critical User Journeys

Verify the complete patient journey:

```text
Public Website
→ Registration/Login
→ Profile
→ Appointment
→ Appointment Status
→ Consultation/Clinical Outcome
→ Prescription/Treatment Plan
→ Documents
→ Notifications
```

Only test steps actually enabled by the final product.

---

# 82. Receptionist Journey

Verify:

```text
Login
→ Today's Schedule
→ Search Patient
→ Create Appointment
→ Confirm
→ Reschedule/Cancel
```

---

# 83. Doctor Journey

Verify:

```text
Login
→ Doctor Dashboard
→ Today's Appointment
→ Patient Context
→ Consultation
→ Clinical Record
→ Prescription/Treatment Plan
→ Optional AI Decision Support
→ Complete Consultation
```

---

# 84. Admin Journey

Verify:

* authorized administrative operations
* analytics
* role management
* configuration where implemented

---

# 85. Appointment End-to-End

Test:

```text
Available Slot
→ Booking
→ Confirmation
→ Reminder
→ Consultation
→ Completion
```

according to implemented notification behavior.

---

# 86. Cancellation End-to-End

Test:

```text
Appointment
→ Cancel
→ Notification
→ Old reminder invalidated
```

where implemented.

---

# 87. Rescheduling End-to-End

Test:

```text
Appointment
→ Reschedule
→ New slot
→ Notification
→ Old reminder invalidated
```

---

# 88. Prescription End-to-End

Test:

```text
Clinical Record
→ Draft Prescription
→ Review
→ Issue
→ Patient-visible issued prescription
→ Notification
```

where patient visibility/notification is implemented.

---

# 89. Document End-to-End

Test:

```text
Upload
→ Validation
→ Private Storage
→ Metadata
→ Authorized View/Download
```

---

# 90. AI End-to-End

Test:

```text
Authorized Doctor
→ Select permitted clinical context
→ Generate suggestion
→ Review
→ Accept/Edit/Reject
```

Verify AI never becomes authoritative clinical data automatically.

---

# 91. Offline Behavior

Document expected behavior when network connectivity is lost.

Do not claim clinical offline support unless implemented.

---

# 92. Transaction Safety

Verify critical workflows remain atomic where required:

* appointment creation
* prescription issue
* document metadata/storage flow
* notification event creation

---

# 93. Concurrent Use

Test realistic simultaneous use:

```text
Receptionist
+
Doctor
+
Patient
```

without conflicting state.

---

# 94. Timezone

Verify production appointment behavior using the clinic's configured timezone.

Test:

* slot generation
* booking
* reminders
* date boundaries
* analytics

---

# 95. Daylight Saving

If relevant to the clinic/provider timezone, verify timezone handling.

Do not assume DST behavior for all timezones.

---

# 96. Date Boundaries

Verify:

```text
00:00
23:59
month end
month start
year end
```

for appointments and analytics.

---

# 97. Production Data Integrity

After migration/deployment verify:

* foreign keys
* unique constraints
* indexes
* RLS
* storage policies
* functions
* reference data

---

# 98. Database Schema Verification

Compare deployed production schema against version-controlled migration state.

---

# 99. Migration Tracking

Ensure migration history is consistent and reproducible.

---

# 100. Rollback Strategy

Document what happens if a deployment fails.

Possible:

```text
Bad deployment
→ stop rollout
→ rollback application
→ restore previous version
```

---

# 101. Database Rollback

Do not assume database migrations are automatically reversible.

For destructive migrations, document recovery strategy before deployment.

---

# 102. Backward Compatibility

Where application and database deployments are separate, ensure temporary compatibility between versions where necessary.

---

# 103. Deployment Rollback Test

Where platform capabilities permit, test or document rollback procedure.

---

# 104. Feature Flags

If feature flags exist, verify production defaults.

Do not leave development-only features enabled.

---

# 105. Debug Features

Disable:

* debug endpoints
* test routes
* mock providers
* fake AI responses
* test authentication
* development bypasses

---

# 106. Test Accounts

Production test accounts must be clearly identified and controlled.

Prefer removing them after verification.

---

# 107. Development Endpoints

Search for accidental routes such as:

```text
/debug
/test
/dev
/mock
seed
```

Remove or protect them.

---

# 108. Seed Endpoints

Never expose public production seed endpoints.

---

# 109. Admin Bootstrap Endpoints

Any bootstrap mechanism must be:

* authenticated
* restricted
* temporary if possible
* removed/disabled after use

---

# 110. Production Configuration Review

Perform final review of:

* environment variables
* feature flags
* URLs
* provider credentials
* database connections
* Auth configuration

---

# 111. Domain Configuration Review

Verify:

```text
production domain
API URL
Supabase Auth URL
email links
notification links
canonical URL
Open Graph URL
```

all point to production.

---

# 112. Link Audit

Run a final broken-link check.

---

# 113. Email Link Audit

Verify email links do not point to:

* localhost
* preview deployments
* development domains

---

# 114. Notification Link Audit

Verify notification deep links point to the correct production application and still enforce authorization.

---

# 115. SEO URL Audit

Verify canonical URLs and sitemap use the final production domain.

---

# 116. Environment Leakage

Search final production output for:

```text
localhost
127.0.0.1
preview URL
development Supabase project
test provider
```

where they should not exist.

---

# 117. Production Build

Perform a clean production build.

Do not deploy from a dirty/uncommitted workspace.

---

# 118. Clean Installation

Verify the project can install dependencies from the lockfile in a clean environment.

---

# 119. Reproducibility

Verify:

```text
clone repository
→ install dependencies
→ configure environment
→ migrate
→ build
```

works according to project documentation.

---

# 120. CI/CD

If CI/CD exists, ensure production checks run before deployment.

At minimum consider:

```text
typecheck
lint
tests
build
```

Security checks should remain integrated where configured.

---

# 121. Pull Request Protection

If repository settings permit, require appropriate checks before merging production code.

---

# 122. Branch Protection

Protect the production branch according to the client's workflow.

---

# 123. Deployment Approval

Where appropriate, require human approval for production deployments.

---

# 124. Monitoring During Launch

For the first production launch:

```text
Deploy
→ Monitor
→ Smoke test
→ Observe logs
→ Observe errors
→ Observe performance
```

---

# 125. Launch Window

Choose a deployment window appropriate to clinic operations.

Avoid disruptive deployments during critical clinic activity where possible.

---

# 126. Rollback Trigger

Define conditions for rollback.

Examples:

* application unavailable
* authentication broken
* appointment creation broken
* cross-user data exposure
* critical database errors
* document access failure

---

# 127. Critical Security Incident

If a production deployment introduces a critical privacy/security vulnerability:

```text
Stop
→ Contain
→ Disable affected functionality if possible
→ Revoke/rotate credentials if necessary
→ Roll back
→ Investigate
```

---

# 128. Launch Checklist

Before declaring launch complete:

```text
Domain
HTTPS
DNS
Production environment
Supabase
Database migrations
RLS
Storage
Auth
Email
Notifications
AI
Security headers
Monitoring
Backups
SEO
Performance
Accessibility
Smoke tests
Rollback
```

---

# 129. Final Security Checklist

Reconfirm:

* [ ] no service-role key in client
* [ ] no AI key in client
* [ ] no provider secret in source
* [ ] RLS enabled
* [ ] private storage
* [ ] authorization enforced
* [ ] IDOR tests pass
* [ ] role escalation blocked
* [ ] sensitive logs scrubbed
* [ ] authenticated routes not indexed
* [ ] sensitive pages not globally cached

---

# 130. Final Privacy Checklist

Confirm:

* [ ] patient data minimized
* [ ] clinical data access scoped
* [ ] external providers documented
* [ ] analytics does not leak clinical data
* [ ] logs do not contain clinical data
* [ ] AI data flow documented
* [ ] notification content minimized
* [ ] document access protected
* [ ] retention policy documented

---

# 131. Final Accessibility Checklist

Confirm:

* [ ] keyboard navigation
* [ ] visible focus
* [ ] labels
* [ ] accessible dialogs
* [ ] semantic headings
* [ ] contrast
* [ ] alt text
* [ ] reduced motion
* [ ] responsive layouts
* [ ] mobile usability

---

# 132. Final Performance Checklist

Confirm:

* [ ] public pages measured
* [ ] Core Web Vitals evaluated
* [ ] images optimized
* [ ] fonts optimized
* [ ] client JS minimized
* [ ] bundle reviewed
* [ ] database queries reviewed
* [ ] caching reviewed
* [ ] no sensitive caching
* [ ] production performance acceptable

---

# 133. Final SEO Checklist

Confirm:

* [ ] production domain canonical
* [ ] titles
* [ ] descriptions
* [ ] sitemap
* [ ] robots
* [ ] Open Graph
* [ ] structured data
* [ ] internal links
* [ ] public pages indexable
* [ ] private pages noindex/protected
* [ ] no preview URLs indexed

---

# 134. Client Handover

Prepare a handover package.

Include:

```text
Architecture
Deployment
Environment variables
Database migrations
Supabase
Domain/DNS
Email
Notifications
AI
Storage
Monitoring
Backups
Security
Operations
Troubleshooting
```

Never include actual secrets in documentation.

---

# 135. Environment Documentation

Document variable names and purpose.

Do not document actual secret values.

---

# 136. Deployment Documentation

Explain:

```text
How to deploy
How to rollback
How to run migrations
How to verify deployment
How to inspect logs
```

---

# 137. Database Documentation

Document:

* migration process
* backup strategy
* restore strategy
* important schema areas

---

# 138. Supabase Documentation

Document:

* project ownership
* Auth configuration
* Storage buckets
* RLS
* production configuration

Do not expose credentials.

---

# 139. Provider Documentation

Document setup for:

* email
* SMS/WhatsApp
* AI
* monitoring

---

# 140. Domain Documentation

Document:

* registrar
* DNS provider
* required records
* renewal ownership

Do not store account passwords.

---

# 141. Incident Response Documentation

Provide basic steps for:

* site outage
* database failure
* credential compromise
* storage exposure
* authorization vulnerability
* provider outage

---

# 142. Credential Rotation Documentation

Explain how to rotate each production secret.

---

# 143. Backup Documentation

Document:

* where backups exist
* retention
* who can restore
* restoration procedure

---

# 144. Support Documentation

Document common operational problems:

```text
Login failure
Email not arriving
Appointment unavailable
Document upload failure
AI unavailable
Notification delayed
```

---

# 145. Monitoring Documentation

Document:

* dashboard locations
* alert destinations
* important metrics
* who receives alerts

---

# 146. Client Training

If part of the agreed scope, provide basic training for:

* receptionist
* doctor
* admin

Focus on actual workflows.

---

# 147. Security Training

Staff should understand:

* account sharing is prohibited
* passwords must remain private
* patient information is sensitive
* suspicious activity should be reported
* documents should be accessed only for legitimate purposes

Do not present technical security controls as a substitute for organizational policy.

---

# 148. Account Sharing

Do not create shared accounts for:

```text
doctor
receptionist
admin
```

where individual accounts are supported.

---

# 149. MFA

Where supported and appropriate, enable MFA for privileged accounts.

---

# 150. Admin MFA

Strongly recommend MFA for admin accounts.

---

# 151. Staff Offboarding

Document:

```text
staff leaves
→ disable account
→ remove role
→ revoke access
→ review active sessions
```

according to provider capabilities.

---

# 152. Ownership Handover

Transfer production ownership to the client/business where agreed.

---

# 153. Repository Handover

Ensure the client has appropriate repository ownership/access.

---

# 154. Domain Handover

Ensure the client owns the domain account.

---

# 155. Cloud Handover

Ensure the client has access to:

* hosting
* Supabase
* provider dashboards
* monitoring

---

# 156. Billing Handover

Confirm production billing is attached to the correct client/business account.

---

# 157. Subscription Review

Check production service plans and limits.

Review:

* hosting
* database
* storage
* email
* AI
* SMS/WhatsApp
* monitoring

---

# 158. Cost Monitoring

Document expected recurring costs.

Do not guarantee costs because usage can change.

---

# 159. Usage Limits

Document important limits:

* database
* storage
* bandwidth
* email
* AI
* notification providers

---

# 160. Cost Alerts

Configure provider budget/usage alerts where supported.

---

# 161. Production Readiness

Before final launch declaration, confirm:

```text
Security
+
Reliability
+
Performance
+
Accessibility
+
SEO
+
Operations
+
Ownership
```

are addressed.

---

# 162. No Compliance Claims

Do not claim formal:

* HIPAA compliance
* GDPR compliance
* DPDP Act compliance
* medical-device certification
* regulatory certification

unless independently verified and legally assessed.

Technical hardening does not itself constitute legal compliance.

---

# 163. Real Patient Data

Before the clinic begins entering real patient information:

* confirm production security controls
* confirm privacy documentation
* confirm access policies
* confirm backup/recovery
* confirm staff access
* confirm applicable legal/regulatory requirements

---

# 164. Launch Approval

The final production launch should have an explicit owner/approver.

Example:

```text
Client/Product Owner
        ↓
Launch Approval
        ↓
Production
```

---

# 165. Smoke Test Definition

A production smoke test should verify:

```text
Public page loads
Auth works
Patient login works
Receptionist login works
Doctor login works
Appointment workflow works
Clinical workflow works
Prescription workflow works
Document workflow works
Notifications work
AI decision support works if enabled
Analytics access works
Logout works
```

Only test functionality actually enabled in production.

---

# 166. Smoke Test Security

Smoke testing must include at least one negative authorization check.

Example:

```text
Patient
→ another patient's resource
→ DENIED
```

---

# 167. Smoke Test Data

Use designated test accounts/resources.

Do not use real patient information for launch verification unless explicitly required and appropriately controlled.

---

# 168. Production Observation

After launch, observe:

* error rate
* login failures
* API latency
* database load
* storage errors
* notification delivery
* AI usage
* user reports

---

# 169. Hypercare

If agreed with the client, define an initial post-launch support period.

Document:

* duration
* support channel
* severity levels
* response expectations

---

# 170. Post-Launch Review

After the initial launch period, review:

* incidents
* user feedback
* performance
* security events
* provider issues
* operational friction

Do not automatically add new features during Phase 21 unless explicitly approved.

---

# 171. Known Limitations

Document known limitations honestly.

Examples:

```text
AI unavailable if provider is down
Email may be delayed
Malware scanning not implemented
Advanced reporting deferred
```

Only list limitations that actually exist.

---

# 172. Deferred Work

Maintain a post-launch backlog separately from the completed roadmap.

---

# 173. Final Documentation

Ensure the repository contains up-to-date:

```text
agent.md
architecture.md
design-system.md
security.md
qa-strategy.md
docs/implementation-progress.md
```

plus deployment/operations documentation as appropriate.

---

# 174. Final Repository Audit

Before handover:

* remove temporary files
* remove debug code
* remove test credentials
* remove unused scripts
* remove accidental secrets
* remove obsolete documentation
* verify migrations
* verify lockfile

---

# 175. Git Status

Production release should come from a clean, reviewed repository state.

---

# 176. Version / Release

Create an appropriate production release/version/tag according to the project's workflow.

Example:

```text
v1.0.0
```

Use the project's actual versioning convention.

---

# 177. Release Notes

Create concise release notes containing:

* major capabilities
* important security improvements
* known limitations
* operational notes

Do not include sensitive implementation details.

---

# 178. Final QA

Run:

```text
lint
typecheck
unit tests
integration tests
security tests
accessibility tests
production build
```

---

# 179. Final Production Verification

Run:

```text
domain verification
HTTPS verification
health check
smoke tests
security regression
performance check
SEO check
notification check
storage check
AI check
```

where each capability is enabled.

---

# 180. Acceptance Criteria

Phase 21 is complete only when:

## Deployment

* [ ] Production deployment succeeds.
* [ ] Production domain works.
* [ ] HTTPS works.
* [ ] Production build succeeds.
* [ ] Production environment variables are configured.
* [ ] No development URLs remain where inappropriate.

## Database

* [ ] Production Supabase project is correct.
* [ ] All migrations are applied.
* [ ] Schema matches repository migrations.
* [ ] RLS is enabled and verified.
* [ ] Database backups are configured/documented.
* [ ] Restore strategy is documented.

## Authentication

* [ ] Production Auth configuration is correct.
* [ ] Redirect URLs are correct.
* [ ] Login works.
* [ ] Registration works.
* [ ] Verification works if enabled.
* [ ] Password reset works.
* [ ] Logout works.
* [ ] Privileged accounts are secured.

## Authorization

* [ ] Patient access works.
* [ ] Receptionist access works.
* [ ] Doctor access works.
* [ ] Admin access works.
* [ ] Cross-user access is denied.
* [ ] Cross-doctor access is correctly scoped.
* [ ] Receptionist clinical isolation works.
* [ ] Admin scope matches policy.

## Storage

* [ ] Production document bucket is private.
* [ ] Storage policies are correct.
* [ ] Upload works.
* [ ] Authorized download works.
* [ ] Unauthorized access fails.
* [ ] Signed URLs are authorization-gated.

## Notifications

* [ ] Email works.
* [ ] SMS/WhatsApp works if enabled.
* [ ] Appointment notifications work.
* [ ] Reminder behavior works.
* [ ] Webhooks work.
* [ ] Invalid webhooks are rejected.

## AI

* [ ] AI provider configuration is correct.
* [ ] Credentials remain server-only.
* [ ] Authorized doctor access works.
* [ ] Unauthorized AI access fails.
* [ ] AI remains decision-support only.
* [ ] Provider failure does not break core clinical workflows.

## Security

* [ ] Phase 19 critical security checks pass.
* [ ] Security headers verified.
* [ ] No secrets exposed.
* [ ] No sensitive logging.
* [ ] Rate limits verified.
* [ ] Private pages not globally cached.
* [ ] Private pages not indexable.

## Performance

* [ ] Phase 20 performance checks pass.
* [ ] Core Web Vitals evaluated.
* [ ] Public pages perform acceptably.
* [ ] No major performance regression introduced by deployment.

## SEO

* [ ] Sitemap works.
* [ ] Robots works.
* [ ] Canonical URLs use production domain.
* [ ] Public metadata is correct.
* [ ] Private routes are not indexable.
* [ ] Structured data is valid where used.

## Accessibility

* [ ] Critical workflows are keyboard accessible.
* [ ] Focus behavior works.
* [ ] Forms are accessible.
* [ ] Major responsive layouts work.
* [ ] Accessibility regressions are absent.

## Operations

* [ ] Monitoring configured.
* [ ] Alerts configured.
* [ ] Health check works.
* [ ] Logs are accessible and privacy-safe.
* [ ] Incident response documented.
* [ ] Rollback documented.
* [ ] Backup/recovery documented.

## Ownership

* [ ] Client has production access.
* [ ] Domain ownership is established.
* [ ] Hosting ownership is established.
* [ ] Supabase ownership is established.
* [ ] Provider ownership/access is established.
* [ ] Repository access is established.
* [ ] Billing ownership is established.

## Handover

* [ ] Deployment documentation delivered.
* [ ] Operations documentation delivered.
* [ ] Security documentation delivered.
* [ ] Environment variable documentation delivered without secrets.
* [ ] Release notes delivered.
* [ ] Known limitations documented.
* [ ] Post-launch backlog documented.

---

# 181. Definition of Done

Phase 21 is complete when:

```text
Code
 ↓
Production Build
 ↓
Production Infrastructure
 ↓
Database
 ↓
Authentication
 ↓
Authorization
 ↓
Storage
 ↓
Notifications
 ↓
AI
 ↓
Security
 ↓
Performance
 ↓
SEO
 ↓
Accessibility
 ↓
Monitoring
 ↓
Backup/Recovery
 ↓
Smoke Testing
 ↓
Client Handover
```

have all been verified.

The application must be usable by the clinic without requiring the original developer to manually operate the system.

---

# 182. Final Release Gate

The release must not proceed if there is a known:

* critical security vulnerability
* cross-patient data exposure
* privilege escalation
* public patient document exposure
* production secret exposure
* broken authentication
* broken core appointment workflow
* broken clinical record integrity
* destructive database migration without recovery plan

---

# 183. Launch Decision

Use:

```text
GO
```

only when all critical release gates pass.

Use:

```text
NO-GO
```

when a critical issue remains unresolved.

---

# 184. Final Completion Report

At completion provide:

## Production

```text
Production URL:
Hosting:
Database:
Storage:
```

## Domain

```text
Domain:
DNS:
HTTPS:
Canonical:
```

## Deployment

```text
Production branch:
Build:
Deployment method:
Release/version:
```

## Database

```text
Migration status:
RLS status:
Backup:
Restore strategy:
```

## Authentication

```text
Auth:
Verification:
Password reset:
MFA:
```

## Roles

```text
Patient:
Receptionist:
Doctor:
Admin:
```

## Storage

```text
Private bucket:
Policies:
Signed URLs:
Upload:
Download:
```

## Notifications

```text
Email:
SMS/WhatsApp:
Webhooks:
Reminders:
```

## AI

```text
Provider:
Model:
Production status:
Safety verification:
Usage/cost controls:
```

## Security

```text
Phase 19 regression:
Secret scan:
Headers:
Rate limits:
IDOR:
RLS:
```

## Performance

```text
LCP:
INP:
CLS:
TTFB:
Major optimizations:
```

## SEO

```text
Sitemap:
Robots:
Canonical:
Metadata:
Structured data:
```

## Accessibility

```text
Keyboard:
Screen reader:
Responsive:
Automated audit:
Known limitations:
```

## Monitoring

```text
Error monitoring:
Uptime:
Alerts:
Logs:
```

## Backup / Recovery

```text
Backup:
Retention:
Restore:
Rollback:
```

## Handover

```text
Repository:
Domain:
Hosting:
Supabase:
Providers:
Billing:
Documentation:
Training:
```

## Known Issues

List all remaining issues by:

```text
Critical
High
Medium
Low
```

## Deferred Work

List post-launch work.

## Launch Decision

```text
GO / NO-GO
```

## Phase Status

```text
Phase 21: COMPLETE
Project implementation roadmap: COMPLETE
Production launch: SUCCESSFUL / NOT YET SUCCESSFUL
```

Do not begin another implementation phase after Phase 21.
