# Punarvasu — QA Strategy

## 1. Purpose

This document defines the quality assurance strategy for **Punarvasu**, the Ayurvedic clinic web application.

The objective is to ensure that every release is:

* Functionally correct
* Secure and privacy-conscious
* Accessible
* Responsive across devices
* Visually consistent with the Punarvasu design system
* Reliable under real-world usage
* SEO-friendly
* Fast and performant
* Safe for patient-facing workflows
* Maintainable and regression-resistant

QA is not a final-stage activity. Quality must be built into every phase of development.

---

## 1.1 Test Tooling and Layout (implemented in Phase 01)

| Concern | Tool | State |
| --- | --- | --- |
| Unit and integration tests | Vitest (`vitest.config.mts`) | Implemented |
| Component tests | Vitest + Testing Library + jsdom | Implemented (Phase 02) |
| Type checking | `next typegen && tsc --noEmit` | Implemented |
| Linting | ESLint 9 flat config | Implemented |
| Formatting | Prettier (`--check` in CI) | Implemented |
| Client secret scan | `scripts/scan-client-bundle.mjs` | Implemented |
| E2E | Not chosen | Deferred to the first real user journey |
| Accessibility automation | `axe-core`, run inside component tests | Implemented (Phase 02) |
| Colour contrast | Asserted against the palette in `src/lib/design/contrast.test.ts` | Implemented (Phase 02) |
| Visual regression | Not chosen | Deferred |

Vitest runs two projects, so server logic is not charged for a DOM:

```text
node        src/**/*.test.ts, tests/unit/, tests/integration/   (environment: node)
components  src/**/*.test.tsx, tests/components/                (environment: jsdom)
```

```text
src/**/*.test.ts        unit tests, next to the code they cover
tests/components/       UI primitives: behaviour, keyboard, accessibility
tests/integration/      route handlers, server behaviour, database interaction
tests/support/          shared helpers and stubs
                        - setup-dom.ts  jsdom environment and browser API stubs
                        - axe.ts        expectNoAxeViolations()
```

### What the accessibility checks do and do not cover

`axe-core` catches missing accessible names, broken ARIA references, invalid
roles, unlabelled controls and duplicate ids. It cannot judge focus order,
keyboard operability, or whether a message is comprehensible — those are
asserted explicitly in the same test files (Escape closes, focus is trapped,
focus returns to the trigger, arrow keys move between tabs).

Contrast rules are disabled inside axe because jsdom has no layout engine and
therefore no computed colours; contrast is verified against the real token
values in `src/lib/design/contrast.test.ts` instead. A colour cannot be
changed without that test passing.

Commands:

```bash
npm test                 # vitest run
npm run test:watch
npm run typecheck        # generates route types first, then tsc --noEmit
npm run lint
npm run format:check
npm run build
npm run security:scan-bundle   # after a build
```

Vitest runs in a Node environment and resolves `@/*` the same way the
application does. `server-only` is aliased to a stub (`tests/support/`) so that
server modules can be unit-tested; the real boundary is still enforced by
`next build`, which is where it matters.

Tests use clearly synthetic data only - `patient@example.test`, `9999999999`.
Real patient information must never appear in a test, a fixture or a seed file.

---

# 2. Quality Principles

All implementation and review work must follow these principles.

### 2.1 Quality by Design

Every feature must be designed with:

* Validation
* Error handling
* Accessibility
* Security
* Loading states
* Empty states
* Success states
* Failure states
* Responsive behavior
* Edge cases

from the beginning.

### 2.2 Patient Safety First

The application must never create the impression that automated content is a substitute for professional medical advice.

Patient-facing content must:

* Avoid unsupported medical claims
* Avoid guaranteed treatment outcomes
* Clearly distinguish educational information from medical advice
* Encourage professional consultation when appropriate
* Handle sensitive health information carefully

### 2.3 No Broken User Journeys

A feature is not considered complete merely because its happy path works.

QA must verify:

```text
Happy path
    ↓
Validation
    ↓
Invalid input
    ↓
Network failure
    ↓
Server failure
    ↓
Authentication failure
    ↓
Permission failure
    ↓
Refresh / navigation
    ↓
Mobile behavior
```

### 2.4 Progressive Enhancement

Core functionality should remain usable even when:

* JavaScript is delayed
* Network connectivity is poor
* Images fail
* Third-party services fail
* Browser APIs are unavailable

---

# 3. Definition of Done

A feature is considered **Done** only when all applicable criteria below are satisfied.

## Functional

* [ ] Acceptance criteria are implemented
* [ ] Happy path works
* [ ] Validation works
* [ ] Error scenarios are handled
* [ ] Empty states are handled
* [ ] Loading states are handled
* [ ] Duplicate actions are prevented where necessary
* [ ] Refresh/reload behavior is correct
* [ ] Browser back/forward behavior is correct
* [ ] Authorization rules are enforced

## UI/UX

* [ ] Matches the design system
* [ ] Responsive on mobile, tablet and desktop
* [ ] Touch targets are usable
* [ ] Typography is consistent
* [ ] Spacing is consistent
* [ ] Focus states are visible
* [ ] Hover states exist where appropriate
* [ ] Disabled states are clear
* [ ] Success/error feedback is clear
* [ ] No layout shifts or overlapping content

## Accessibility

* [ ] Keyboard accessible
* [ ] Semantic HTML used
* [ ] Form controls have labels
* [ ] Images have appropriate alt text
* [ ] Color is not the only method of communicating information
* [ ] Focus order is logical
* [ ] Dialogs/modals are accessible
* [ ] Screen-reader behavior is reasonable
* [ ] WCAG AA requirements are met where applicable

## Security

* [ ] User input is validated
* [ ] Server-side validation exists for security-sensitive operations
* [ ] Authorization is enforced server-side
* [ ] Sensitive data is not exposed to the client unnecessarily
* [ ] Secrets are never committed
* [ ] Error messages do not expose sensitive implementation details
* [ ] Authentication/session behavior has been tested
* [ ] Rate limiting/abuse protection exists where required

## Performance

* [ ] Images are optimized
* [ ] Unnecessary JavaScript is avoided
* [ ] Heavy components are lazy-loaded where appropriate
* [ ] No obvious N+1 requests
* [ ] API calls are reasonably efficient
* [ ] Core pages load quickly on mobile networks
* [ ] No unnecessary re-rendering

## Testing

* [ ] Unit tests added where appropriate
* [ ] Integration tests added for important workflows
* [ ] End-to-end tests added for critical journeys
* [ ] Existing tests pass
* [ ] Lint passes
* [ ] Type checking passes
* [ ] Build succeeds

---

# 4. Testing Pyramid

Testing should follow a balanced testing pyramid.

```text
                 ┌─────────────────┐
                 │   E2E Tests     │
                 │ Critical flows  │
                 └────────┬────────┘
                          │
                ┌─────────┴─────────┐
                │ Integration Tests │
                │ APIs + DB + Auth  │
                └─────────┬─────────┘
                          │
             ┌────────────┴────────────┐
             │       Unit Tests        │
             │ Functions + Components  │
             └─────────────────────────┘
```

## Unit Tests

Use for:

* Utility functions
* Validation functions
* Business rules
* Data transformations
* Calculations
* Formatting utilities
* State-management logic
* Individual reusable components

Unit tests should be fast and deterministic.

## Integration Tests

Use for:

* API routes
* Authentication flows
* Database interactions
* Form submission
* Server actions
* Authorization logic
* Important component interactions

## End-to-End Tests

Use E2E tests for critical user journeys rather than attempting to test every UI detail.

Priority flows should include:

1. Visitor opens website
2. Visitor browses services
3. Visitor views treatment/service details
4. Visitor submits appointment/consultation request
5. User registers
6. User logs in
7. User logs out
8. User accesses protected pages
9. Unauthorized user is denied access
10. Admin accesses administrative functionality
11. Admin manages appointment/request data

---

# 5. Risk-Based Testing

Not every feature requires the same testing depth.

## Critical

Highest testing priority:

* Authentication
* Authorization
* Patient-related information
* Appointment booking
* Contact/consultation forms
* Admin functionality
* Data creation/update/deletion
* Payment functionality, if introduced
* Email/SMS notifications
* Security-sensitive APIs

Required:

* Unit tests
* Integration tests
* E2E tests
* Security review
* Manual exploratory testing

## High

Examples:

* Service browsing
* Doctor/practitioner information
* User profile
* Appointment history
* Search/filtering
* Notifications

Required:

* Unit/integration tests
* E2E coverage where appropriate
* Responsive testing
* Accessibility testing

## Medium

Examples:

* Blog/article browsing
* FAQs
* Testimonials
* Informational pages

Required:

* Component/unit tests where useful
* Smoke E2E tests
* Accessibility and responsive testing

## Low

Examples:

* Decorative animations
* Non-critical visual enhancements

Required:

* Visual/manual verification
* Regression testing

---

# 6. Functional QA

Every feature should be tested against the following categories.

### Positive Tests

Verify valid inputs and expected behavior.

### Negative Tests

Verify invalid inputs are rejected safely.

Examples:

* Empty required fields
* Invalid email
* Invalid phone number
* Invalid date
* Invalid identifier
* Excessively long text
* Unsupported characters where applicable

### Boundary Tests

Test:

* Minimum values
* Maximum values
* Exact limits
* One below minimum
* One above maximum

### State Tests

Test:

* Initial state
* Loading
* Success
* Error
* Empty
* Disabled
* Partial data
* Expired session

### Persistence Tests

Verify behavior after:

* Page refresh
* Browser restart
* Logout/login
* Network reconnect
* Navigation away and back

---

# 7. Authentication QA

Authentication must be treated as a security-critical workflow.

Test:

* Registration
* Login
* Logout
* Invalid credentials
* Missing credentials
* Email verification
* Password reset
* Expired reset link
* Expired verification link
* Session expiration
* Refresh with active session
* Refresh after session expiration
* Protected-route access
* Unauthorized access
* Multiple sessions
* Account deletion, if implemented

Verify that protected information is never accessible merely by manipulating URLs or client-side state.

---

# 8. Authorization QA

Authorization must be tested independently from authentication.

Example roles may include:

```text
Public
  ↓
Authenticated User
  ↓
Staff
  ↓
Administrator
```

For every protected resource, test:

| Actor            | Expected                            |
| ---------------- | ----------------------------------- |
| Anonymous user   | Denied when authentication required |
| Normal user      | Access only permitted resources     |
| Staff            | Access staff resources              |
| Admin            | Access administrative resources     |
| Modified request | Still denied without permission     |

Never rely solely on frontend route guards.

Authorization must be enforced on the server/API/database layer.

---

# 9. Appointment / Consultation QA

Appointment-related functionality requires comprehensive testing.

Test:

### Booking

* Valid booking
* Missing required fields
* Invalid contact information
* Invalid date
* Past date
* Unavailable slot
* Double booking
* Concurrent booking attempts
* Rapid repeated submission
* Network interruption
* Server error

### Confirmation

Verify:

* Booking is persisted correctly
* Correct user/request is associated
* Correct date/time is stored
* Confirmation feedback is shown
* Notification is triggered when configured
* Sensitive information is not exposed unnecessarily

### Modification/Cancellation

Test:

* Valid cancellation
* Invalid cancellation
* Unauthorized cancellation
* Already-cancelled appointment
* Expired appointment
* Concurrent updates

---

# 10. Form QA

Every form must be tested for:

* Required fields
* Optional fields
* Correct validation
* Inline validation
* Server validation
* Error messages
* Keyboard navigation
* Autofill behavior
* Paste behavior
* Long input
* Special characters
* Double submission
* Loading state
* Success state
* Failure state

Forms must never rely exclusively on browser-side validation.

---

# 11. API QA

API endpoints should be tested for:

* Correct HTTP methods
* Correct status codes
* Request validation
* Response schema
* Authentication
* Authorization
* Rate limiting where appropriate
* Malformed requests
* Missing fields
* Unexpected fields
* Large payloads
* Duplicate requests
* Database failures
* Timeout behavior
* Internal errors

Expected error responses should be predictable and safe.

Internal stack traces, SQL errors, credentials, tokens, or sensitive infrastructure information must never be returned to users.

---

# 12. Database QA

Verify:

* Schema constraints
* Required fields
* Foreign keys
* Unique constraints
* Correct relationships
* Cascading behavior
* Transaction behavior
* Rollbacks
* Duplicate prevention
* Concurrent writes
* Migration correctness

Destructive operations must be tested carefully.

Database migrations must be reproducible and safe.

---

# 13. Security QA

Security testing must include:

### Input Security

Test protection against:

* SQL injection
* XSS
* HTML injection
* Command injection where applicable
* Malicious URLs
* Oversized payloads

### Authentication Security

Test:

* Session handling
* Token expiration
* Invalid tokens
* Session fixation risks
* Password reset behavior
* Email verification behavior

### Authorization Security

Attempt:

* Horizontal privilege escalation
* Vertical privilege escalation
* Direct API access
* Direct URL access
* ID manipulation

Example:

```text
User A requests User B's resource
        ↓
Server authorization check
        ↓
Request rejected
```

### Secrets

Verify:

* No secrets in source code
* No secrets in client bundles
* No secrets in logs
* No credentials in error messages
* `.env` files are properly excluded from version control

---

# 14. Privacy QA

Because the application may handle health-related and appointment information, privacy must be treated as a first-class concern.

Verify:

* Only necessary information is collected
* Sensitive information is not unnecessarily displayed
* Users can access only their own information
* Admin/staff access follows defined permissions
* Logs do not contain sensitive patient information
* URLs do not expose sensitive information
* Browser storage does not unnecessarily contain sensitive information
* Error tracking does not capture sensitive form values

Avoid sending unnecessary health information to analytics or third-party services.

---

# 15. Accessibility QA

Target **WCAG 2.2 AA** where reasonably applicable.

Test:

* Keyboard-only navigation
* Tab order
* Focus visibility
* Focus trapping in dialogs
* Screen readers
* Form labels
* Error announcements
* Button names
* Link names
* Heading hierarchy
* Landmark structure
* Color contrast
* Reduced motion
* Zoom up to 200%
* Small-screen accessibility

Interactive elements must have meaningful accessible names.

Do not use:

```text
<div onClick={...}>
```

when a semantic:

```text
<button>
```

or:

```text
<a>
```

is appropriate.

---

# 16. Responsive QA

Minimum viewport categories:

| Category      | Example      |
| ------------- | ------------ |
| Small mobile  | ~320–375px   |
| Large mobile  | ~390–430px   |
| Tablet        | ~768px       |
| Laptop        | ~1024–1440px |
| Large desktop | ~1600px+     |

Test:

* Navigation
* Header
* Footer
* Forms
* Cards
* Tables
* Dialogs
* Images
* Typography
* Buttons
* Appointment workflows
* Admin interfaces

Check for:

* Horizontal scrolling
* Text clipping
* Overlapping elements
* Broken grids
* Unusable touch targets
* Fixed-position elements covering content

---

# 17. Cross-Browser QA

Primary browser coverage:

* Chrome
* Safari
* Firefox
* Edge

Priority should be given to current stable versions.

Mobile coverage should include:

* Android Chrome
* iOS Safari

Browser-specific behavior must not be assumed to be identical.

---

# 18. Visual QA

Visual QA must follow the Punarvasu design system.

Check:

* Typography
* Color tokens
* Spacing
* Border radius
* Shadows
* Icons
* Buttons
* Forms
* Cards
* Navigation
* Responsive breakpoints
* Empty states
* Error states
* Loading states

Avoid one-off styling when an existing design-system component/token can be reused.

---

# 19. Visual Regression Testing

Critical pages should have visual regression coverage where practical.

Suggested pages:

* Home
* Services
* Service details
* Appointment/consultation flow
* Login
* Registration
* User dashboard
* Admin dashboard

Visual snapshots should be reviewed after intentional UI changes.

Do not blindly approve snapshot changes.

---

# 20. Performance QA

Performance should be tested on:

* Desktop
* Mid-range mobile
* Slow network
* Fast network

Monitor:

* Largest Contentful Paint (LCP)
* Interaction to Next Paint (INP)
* Cumulative Layout Shift (CLS)
* Total page weight
* JavaScript bundle size
* Image size
* API latency

General goals:

```text
Fast first meaningful render
Minimal layout shift
Responsive interactions
Optimized images
Minimal unnecessary JavaScript
Efficient API requests
```

Performance regressions should block releases when they materially affect user experience.

---

# 21. SEO QA

For public-facing pages verify:

* Unique page title
* Meta description where appropriate
* Canonical URL
* Correct heading hierarchy
* Semantic HTML
* Descriptive URLs
* Open Graph metadata
* Twitter/X metadata where applicable
* Sitemap
* Robots configuration
* Structured data where appropriate
* No accidental `noindex`
* Correct 404 behavior

Healthcare-related content must prioritize accuracy and trustworthiness over aggressive SEO tactics.

---

# 22. Error Handling QA

Every asynchronous operation should have appropriate:

```text
Loading
Success
Empty
Error
Retry
```

states where applicable.

Errors should be:

* Human-readable
* Actionable
* Non-technical
* Non-sensitive

Bad:

```text
PostgrestError: duplicate key violates constraint...
```

Better:

```text
We couldn't complete your request right now.
Please try again.
```

Detailed technical information should remain available to developers through appropriate server-side logging.

---

# 23. Network Failure QA

Simulate:

* Offline mode
* Slow network
* Request timeout
* Connection interruption
* Server unavailable
* Partial API failure
* Third-party service failure

The application should fail gracefully.

A failed analytics or non-critical third-party request should not break core patient workflows.

---

# 24. Notification QA

If email/SMS/WhatsApp notifications are implemented, test:

* Correct recipient
* Correct template
* Correct appointment details
* Duplicate notification prevention
* Failed delivery
* Provider timeout
* Invalid recipient
* Retry behavior
* Notification status

Sensitive information should not be unnecessarily included in notifications.

---

# 25. Third-Party Integration QA

For every external integration:

1. Test successful response.
2. Test timeout.
3. Test invalid response.
4. Test authentication failure.
5. Test rate limiting.
6. Test service outage.
7. Test malformed data.
8. Verify graceful fallback.

External dependencies must not become single points of failure for critical user journeys whenever avoidable.

---

# 26. Automated Quality Gates

Every pull request should run, where applicable:

```bash
lint
typecheck
unit tests
integration tests
build
```

Critical changes should additionally run:

```text
E2E tests
security checks
visual regression tests
```

A pull request should not be considered merge-ready when required quality gates fail.

---

# 27. CI/CD QA Pipeline

Recommended pipeline:

```text
Developer Commit
       ↓
Formatting / Lint
       ↓
Type Checking
       ↓
Unit Tests
       ↓
Integration Tests
       ↓
Build
       ↓
Security Checks
       ↓
E2E Tests
       ↓
Preview Deployment
       ↓
Smoke Tests
       ↓
Production
       ↓
Post-deployment Verification
```

Failures must clearly identify the failing stage.

---

# 28. Smoke Testing

After every deployment, verify critical functionality.

### Public

* [ ] Homepage loads
* [ ] Navigation works
* [ ] Services load
* [ ] Contact information is correct
* [ ] Important public pages load

### Authentication

* [ ] Login works
* [ ] Logout works
* [ ] Protected route behavior works

### Appointment

* [ ] Appointment/consultation flow opens
* [ ] Form submission works
* [ ] Confirmation works

### Backend

* [ ] Database connectivity works
* [ ] Critical APIs respond
* [ ] No unexpected server errors

---

# 29. Regression Testing

Before release, verify that changes have not broken existing functionality.

Regression priority:

### P0

* Authentication
* Authorization
* Appointment booking
* Patient data protection
* Admin access

### P1

* User dashboard
* Service browsing
* Forms
* Notifications

### P2

* Informational content
* Secondary UI functionality
* Non-critical animations

---

# 29A. Security Test Layout (Phase 01 foundation)

Authorization tests become possible once authentication exists (Phase 03). The
foundation is in place now so that negative tests are routine rather than an
afterthought:

* Integration tests call route handlers directly, so a test can construct a
  request as any role - including none - and assert the response.
* `AppError` categories make the expected outcome explicit: a test asserts
  `403 forbidden`, not "some error".
* The response envelope is uniform, so a negative assertion ("no table name, no
  SQL, no email address in the body") is a single check that works on every
  endpoint. `tests/integration/health-route.test.ts` already does this for an
  internal failure.

Every protected resource added from Phase 03 onwards carries tests for each
actor:

```text
Unauthenticated -> protected resource        DENY
Patient A       -> Patient B's data          DENY
Patient         -> admin endpoint            DENY
Receptionist    -> clinical notes            DENY
Doctor          -> patient they do not treat DENY
Admin           -> audited administrative action  ALLOW, audited
```

A feature whose tests only cover the happy path is not finished.

### Authentication coverage (Phase 06)

| File | Covers |
| --- | --- |
| `src/lib/auth/redirect.test.ts` | Open redirect. 92 cases: absolute URLs, protocol-relative and backslash forms, schemes, encodings, control characters, traversal, bounds, parameter smuggling. |
| `src/features/auth/validation.test.ts` | Password bounds and screening, email normalisation, confirmation matching, and that registration has no field for clinical information and discards one if sent. |
| `src/features/auth/errors.test.ts` | That no provider text reaches a user, that enumeration-sensitive outcomes share one message, and that the log event carries no address. |
| `tests/integration/auth-callback.test.ts` | Both link shapes, failure routing, and that no code or token reaches a response or a log. |
| `tests/integration/auth-session.test.ts` | Identity from a verified call, role from the database, failing closed, and `requireUser()` redirecting before it returns. |
| `tests/integration/auth-proxy.test.ts` | Protected-path gating, the already-signed-in redirect, cache headers, and that an unresolvable session never admits. |
| `tests/components/auth.test.tsx` | Password toggle behaviour and accessibility, error association, form-state helpers, axe. |

### Patient profile coverage (Phase 07)

| File | Covers |
| --- | --- |
| `src/features/patients/validation.test.ts` | The profile/clinical boundary (a submission carrying a clinical field is rejected, not silently stripped), protected fields, required and optional handling, phone normalisation, date-of-birth bounds and non-existent dates, postal codes including international ones, emergency-contact pairing, and hostile input. |
| `src/features/patients/completeness.test.ts` | Which fields count, and — as an explicit assertion — which deliberately do not, so a later change cannot quietly turn the indicator into a nudge for sensitive optional data. |
| `src/features/patients/format.test.ts` | Timezone-safe date rendering, age derivation across a birthday, address line assembly. |
| `tests/integration/patient-profile.test.ts` | That a query is scoped to the session and takes no user id, that a write never accepts ownership, a role or a timestamp from the request, that a cleared field becomes null, that a concurrent create is recovered, and that no database text reaches the patient or the patient's details reach the log. |
| `tests/components/patient-profile.test.tsx` | Labels, error association, markup rendered as text, the single-form invariant, the min-content overflow fix, keyboard operability, and axe. |

### Authorization coverage (Phase 08)

| File | Covers |
| --- | --- |
| `src/config/permissions.test.ts` | That the policy *table* says what `SECURITY.md` §6 says: four roles, no speculative permission, only the patient role holding the self-profile permissions, only the admin role holding user and role management, and no role being a superset of every other. |
| `src/lib/authorization/policy.test.ts` | The exhaustive matrix — every role against every permission, written out rather than derived from the table it is checking. Plus: an unresolvable role holds nothing, a role outside the model holds nothing, and there is no hierarchy. |
| `src/lib/authorization/routes.test.ts` | That every area's permission exists, that every permission-gated area is also authentication-gated, that a look-alike path (`/administration`, `/patients`) cannot inherit a rule, and that a link is offered exactly when the guard would admit. |
| `src/lib/authorization/ownership.test.ts` | Patient A against Patient B's resource, an unowned resource belonging to nobody, exact id comparison (no trimming, no case folding, no prefix match), a refusal that reveals neither the resource nor its owner, and the self-targeting rule. |
| `src/features/admin/validation.test.ts` | `superadmin`, `root`, `Doctor`, `ADMIN`; non-UUID, SQL-shaped, script-shaped and traversal-shaped targets; an unexpected key rejected rather than dropped; and that the schema carries no field that could confer authority. |
| `tests/integration/authorization-guards.test.ts` | All five actors against the guards: route guards redirecting to `/forbidden`, action guards throwing a 403, an unauthenticated visitor sent to sign in rather than to a refusal, fail-closed on an unresolvable role, and a refusal logging the user id and permission but neither the address nor the name. |
| `tests/integration/role-assignment.test.ts` | Every attack in `phase_08.md` §§25, 33 and 40 against the real action: self-promotion, a receptionist and a doctor reaching admin functionality, request-body role injection, an admin promoting themselves, a forged target, an invalid role, and the database's own refusals mapped to copy carrying no schema. Plus that the write goes through the authorized function rather than a table write. |
| `tests/components/authorization.test.tsx` | That the forbidden page names no role, no required role, no permission and no identifier; that navigation offers exactly the areas a role can enter and invents none; that the administrator's own row explains itself; and axe. |

### Appointment engine coverage (Phase 09)

| File | Covers |
| --- | --- |
| `src/config/appointments.test.ts` | That the application's copy of the booking rules and the clinic timezone **agrees with the migration**, by reading the SQL. Two copies of a rule is a divergence waiting to happen, and the failure it prevents is a UI that confidently offers something the database will refuse. |
| `src/features/appointments/time.test.ts` | The clinic-wall-clock/instant conversion in both directions, round-tripped; that a late-evening appointment keeps the clinic's calendar day; that a weekday is derived from the clinic day rather than the UTC one; and - because India observes no daylight saving and a test that only used `Asia/Kolkata` would prove nothing - the same conversions against a zone that does. |
| `src/features/appointments/availability.test.ts` | Every rule `phase_09.md` section 66 lists, one at a time: working hours, split days, existing appointments, blocked periods, past times, minimum notice, booking horizon, buffer separation, back-to-back legality, and the defensive cases. `now` is injected, so no test depends on when it runs. |
| `src/features/appointments/status.test.ts` | The transition matrix exhaustively, terminal states, and that the TypeScript matrix **agrees with the database trigger**, parsed out of the migration. |
| `src/features/appointments/validation.test.ts` | That a naive local time is refused; and, one hostile key at a time, that `patientId`, `status`, `duration`, `endsAt`, `internalNote`, `createdBy` and `role` are **rejected** rather than stripped. |
| `src/features/appointments/errors.test.ts` | That every SQLSTATE the migration raises is recognised, that none is declared which it does not raise, and that no constraint name, table name, connection string or provider message can reach a patient or a log. |
| `tests/integration/appointment-actions.test.ts` | The three server actions against a recording stub: the exact RPC argument list, a manipulated form changing nothing, every non-patient role writing nothing, a slot conflict becoming recoverable copy, and a log carrying the operation and an opaque user id and nothing else. |
| `tests/integration/appointment-availability-route.test.ts` | The one endpoint a browser calls: authentication, permission, input validation, window bounding, cache headers, and that a failed read stays distinguishable from an empty diary. |
| `tests/integration/appointment-security.test.ts` | The **database's** guarantees, asserted against the migration text: RLS on every table, no blanket policy, no insert/update/delete grant, `internal_note` absent from the column grant, both exclusion constraints, pinned `search_path` on every definer function, and no column anywhere for a clinical field or an unverified credential. |
| `tests/components/appointments.test.tsx` | That a status is never colour alone and `requested` reads as *Requested*; that the booking flow renders **exactly one** form carrying exactly four fields; that slots and dates are real buttons in real lists, keyboard-operable, with `aria-pressed`; loading, empty and error all rendered; the cancellation dialog asking first; and axe. |

### Receptionist workspace coverage (Phase 10)

| File | Covers |
| --- | --- |
| `src/features/reception/validation.test.ts` | Every hostile field one at a time — `profileId`, `userId`, `role`, `email`, `password`, `status`, `duration`, `endsAt`, and eight clinical names — **rejected rather than stripped**; that no schema has a field whose *name* suggests clinical content or authority; a naive local time refused; a landline accepted and a script tag refused; and that the search schema has no field for a result count. |
| `src/features/reception/status.test.ts` | The 7x7 staff matrix written out rather than derived; that `completed` is unreachable from every state; and that **both** role rules agree with the migration, parsed out of the SQL — the assignable statuses and the statuses the front desk may act *from*. The second exists because this test found the TypeScript and the SQL disagreeing about `in_consultation -> cancelled`. |
| `tests/integration/reception-actions.test.ts` | Four roles writing nothing; a refusal naming no role and no permission; the exact RPC argument list; a planted status, duration, owner or role changing nothing; a slot conflict becoming recoverable copy; the duplicate warning writing nothing and then proceeding once acknowledged; and that no log carries a name, a phone number, an address, a date of birth, a cancellation reason or a search term. |
| `tests/integration/reception-security.test.ts` | The **database's** guarantees, asserted against the migration text: every new policy naming the role, no blanket policy, no write policy or grant anywhere, `internal_note` ungranted, pinned `search_path` on every definer function, every staff function authorizing before it reads or writes, the search bounds and wildcard escaping, the absent owner parameter, and that the reception feature never writes through a table client or touches the service-role client. |
| `tests/components/reception.test.tsx` | Nothing clinical rendered anywhere; the status actions composing both rules so `completed` is never offered and a terminal appointment gets a sentence rather than disabled buttons; destructive actions asking first and additive ones not; exactly one `<form>` per form carrying exactly its action's fields; all four search states and nothing listed before a search; the two schedule layouts; the term never reaching a URL; and axe. |

### Doctor workspace coverage (Phase 11)

| File | Covers |
| --- | --- |
| `src/features/doctor/status.test.ts` | The 7x7 practitioner matrix written out rather than derived; that `cancelled` and `checked_in` are unreachable from every state; that the allowlist is the **complement** of the front desk's rather than a subset; and that the TypeScript agrees with the migration on **every cell**, by parsing the SQL `case` into a from→to map. Stronger than Phase 10's mirror, which compared only the two lists. |
| `src/features/doctor/validation.test.ts` | Every hostile field one at a time — `doctorId`, `practitionerId`, `userId`, `profileId`, `role`, `permission`, `isAdmin` and twelve clinical names — **rejected rather than stripped**; that the module's source names none of them at all; that the status schema has no field for a reason, a patient, a time or a duration; that the search schema has no field for a result count or a scope; and that the filter schema has no practitioner field. |
| `tests/integration/doctor-actions.test.ts` | Four roles writing nothing and reading nothing; a refusal naming no role and no permission; the exact RPC argument list; nine planted fields changing nothing; a well-formed id for another doctor's appointment passed through unchanged so the *database* decides; a database failure becoming copy that carries no database text; and that no log carries a search term, a patient name, a phone number or a date of birth. |
| `tests/integration/doctor-security.test.ts` | The **database's** guarantees, asserted against the migration text: both new policies naming the role **and** scoping by relationship, no blanket policy, no write policy or grant anywhere, no new table grant at all, no dropped policy, pinned `search_path` on every definer function, the gate called before anything is read or written, the gate internal and ungranted, the search's bounds, escaping and column list, and that the migration adds no table, enum, constraint, trigger or clinical word. Plus the application layer: no table write, no service-role client, a permission check on every exported read, no practitioner id ever sent, and no `select *`. |
| `tests/components/doctor.test.tsx` | Nothing clinical rendered anywhere and the two places a practitioner would look for it saying so; no cancel or reschedule control from any status; "Start consultation" offered only for a checked-in patient; terminal appointments getting a sentence rather than disabled buttons; terminal actions asking first and reversible ones not; exactly one `<form>` carrying exactly two fields; all four search states; the term never reaching a URL; the two schedule layouts; the summary rendering only numbers it was given, with no chart and no icon; the caption/heading landmark guard; keyboard operation; and axe. |

### Clinical record coverage (Phase 12)

| File | Covers |
| --- | --- |
| `src/features/clinical/status.test.ts` | The lifecycle, editability and the completion requirements — and that **all four agree with the migration**, by parsing the enum, the guard trigger's transition branches, the check constraint and the eligibility list out of the SQL. Plus that the immutability clause names **every one** of the eight clinical columns, because a column missing from that list is one a completed record could still be edited through. |
| `src/features/clinical/validation.test.ts` | Nineteen hostile fields one at a time — `doctorId`, `practitionerId`, `patientId`, `appointmentId`, `status`, `completedAt`, `createdBy`, `role`, `permission`, `version`, `prescription`, `treatmentPlan`, `documentId` and more — **rejected rather than stripped**; that the module's own source names none of them; that the form's field list is exactly the schema's keys (a field in one and not the other is a section a practitioner types into and never sees again); that the length bounds equal the check constraints', read from the migration; and that clinical prose — angle brackets in a measurement, a slash in dosing shorthand, a percent sign, an apostrophe — is **accepted** rather than mangled. |
| `src/features/clinical/errors.test.ts` | That every SQLSTATE the migration raises is recognised and none is declared which it does not raise; that a stale write is its own outcome rather than a retryable error; that **every** message says explicitly that the changes were not saved; and that no policy error, RLS failure, SQL statement, constraint name, table name or connection string can reach a screen or a log. |
| `tests/integration/clinical-actions.test.ts` | Four roles writing nothing; a refusal naming no role and no permission; the exact RPC argument lists; **fifteen planted fields changing nothing**; a well-formed record id for another practitioner's consultation passed through unchanged so the *database* decides; a stale write becoming a conflict **with no version handed back**; completion validating before it calls; and that no log line carries clinical content, a patient's name or a phone number. |
| `tests/integration/clinical-security.test.ts` | The **database's** guarantees, asserted against the migration text: exactly one policy, scoped by relationship as well as by role, no blanket policy, no write policy or grant anywhere, every function calling the gate before it reads or writes, pinned `search_path`, no practitioner/doctor/patient/status parameter on anything, the composite foreign key, the unique constraint per appointment, `on delete restrict` on every reference, the version increment in a trigger, the optimistic lock in the update statement itself, the completion constraints, the draft-notes trigger — and that **no clinical column is added to `appointments`**, no existing function is replaced and no policy is dropped. Plus the application layer: no table write, no service-role client, a permission check on every exported read, no `select *`, nothing in browser storage, and **no clinical field name in any log call**. |
| `tests/components/clinical.test.tsx` | One `<form>` carrying exactly ten fields and no field that would be a claim about identity; a textarea per clinical field with a real label inside a real `<fieldset>`; **no HTML `required`, so an incomplete draft can be saved**; the five save states, and that "Saved" is never shown when the server refused; the form refusing to save again after a conflict; completion asking first and staying refused until both required fields are written; a completed record rendered as prose with no editable control; markup in a note rendered as text; the patient's identity prominent with a **derived** age and no address; a history list with no clinical content in it at all; nothing reaching browser storage or the URL; keyboard operation; error association; and axe. |

### Patient document coverage (Phase 14)

| File | Covers |
| --- | --- |
| `src/config/documents.test.ts` | That the allowlist, the size limit and the field limits **agree with the migration and with the bucket**, all three, by parsing the SQL — because this is the first rule the product holds in *four* places (the configuration, a check constraint, the bucket, and the browser's file picker) and three of them are invisible from the fourth. Plus that nothing executable, scriptable or markup-shaped is on the list, that `image/svg+xml` is absent, and that only the formats a browser renders inertly are marked previewable. |
| `src/lib/documents/storage-path.test.ts` | That the original filename is **not an input** to the path — the assertion is on the function's arity, so a later "helpful" parameter fails the build; that the TypeScript builder and `public.patient_document_storage_path()` produce the identical string, parsed out of the migration; that a non-uuid, a traversal segment, an absolute path and the bucket's own name are each refused; and that a download filename built from a hostile title cannot mean something to a shell, a header parser or a filesystem — while two different titles still produce two different names, because illegal characters are *replaced* rather than dropped. |
| `src/lib/documents/file-signature.test.ts` | Every allowed format recognised from its real signature bytes; executables, shell scripts, archives, SVG, HTML and XML refused; **a video and an AVIF sharing the HEIF container refused**, which is the check a naive `ftyp` test would miss; that the **detected** type is returned rather than the declared one even when they agree; that all three of section 11's checks are required rather than any one being sufficient; and the size bound applied to the bytes as well as to the declaration. |
| `src/features/documents/status.test.ts` | The lifecycle, the three enums and the archive rule — and that **all four agree with the migration**, by parsing the enums, the guard trigger's branches and the archive function out of the SQL. Plus that there is no delete anywhere, that every reference is `on delete restrict`, and that **no column holds anything read out of a file** — no OCR, no extraction, no classification, no summary — which is the assertion that fails on the day somebody adds one meaning well. |
| `src/features/documents/validation.test.ts` | Twenty-three hostile fields one at a time across three schemas — `patientId`, `practitionerId`, `uploadedBy`, `storagePath`, `documentId`, `clinicalRecordId`, `mimeType`, `fileSize`, `checksum`, `status`, `role` and more — **rejected rather than stripped**; that the module's own source names none of them at all; that **no property of the bytes is validated here**, because a client's claim about a file is not evidence and validating it would look like it was; and that the form's field list and the schema's keys cannot drift apart. |
| `src/features/documents/errors.test.ts` | That every SQLSTATE the migration raises is recognised and none is declared which it does not raise; that the `PV040`–`PV047` range is disjoint from every earlier phase; that no bucket name, table name, policy name, storage path or SQL fragment can reach a screen or a log; that every message says explicitly what happened to the *file*; and that all three file-type failures read alike to a caller while staying distinct in the log, so a rejection message is not itself a probe. |
| `tests/integration/document-actions.test.ts` | Four roles writing nothing and reading nothing; a refusal naming no role, no permission and no policy; the exact RPC argument lists; **twelve planted fields changing nothing**; that a signed URL is minted **only after** the document resolves under the caller's own client, and never for a path a caller supplied; the **compensation path** — a failed metadata write followed by exactly one `remove` of exactly the path that was written; and that no log line carries a title, a filename, a description, an archive reason, a storage path, a signed URL or a checksum. |
| `tests/integration/document-security.test.ts` | The **database's and the bucket's** guarantees, asserted against the migration text: exactly two policies on the table and one on `storage.objects`, all three `select`, every one scoped by a relationship as well as by a role, no blanket policy, no write policy or grant anywhere, **no policy at all for a receptionist or an administrator**, the bucket created private and kept private on conflict, the storage predicate resolving a key by lookup rather than by parsing, every write function calling its gate before it reads or writes, pinned `search_path`, **no patient/practitioner/uploader/path/type/status parameter on anything**, the path recomputed and compared, the shape constraint, the two composite foreign keys, the unique storage path, `on delete restrict` on every reference, the guard trigger's immutability list naming every column that must not move — and that the service-role client appears in the **write** path of `storage.ts` and nowhere else in the feature. |
| `tests/components/documents.test.tsx` | One `<form>` carrying exactly the fields its endpoint reads and no field that would be a claim about identity; **no HTML `required`** — which with a JavaScript submit handler is worse than the Phase 12 defect, because the browser refuses to fire `submit` at all and the button does visibly nothing; progress that never claims success at 100%, because the bytes arriving is not the server accepting them; a preview that is sandboxed, sends no referrer and is never `next/image`; archiving that asks first; markup in a title rendered as text; a list that renders in two layouts and still names each document once; and that nothing reaches `localStorage` or `sessionStorage`. |
| `tests/integration/source-hygiene.test.ts` | That no source file in `src`, `tests`, `scripts` or `supabase` contains a C0 or C1 control character other than tab, carriage return and newline — plus a guard against itself, asserting it is scanning more than a hundred files. See below. |

### Clinical AI coverage (Phase 17)

| File | Covers |
| --- | --- |
| `src/config/clinical-ai.test.ts` | That the task list is exactly the database's `ai_assistance_task` enum and the quota is exactly `ai_assistance_limits()`, both parsed out of the SQL — because a task the panel offers and the database refuses, or a limit the panel shows and the database does not enforce, is the divergence this prevents. Plus: no free-text or open-ended task, no task whose label mentions a diagnosis or a prescription, no section named for a confidence or a score, and — asserted against the migration text — that it adds no table, column, enum, trigger or policy to any Phase 06–16 object, replaces no function, revokes every function from `anon` **by name**, gates every reachable function in its **body**, pins `search_path` everywhere, and takes no patient, practitioner, model, prompt or temperature parameter. |
| `src/lib/ai/schemas.test.ts` | Section 144's matrix against the response contract: invalid JSON, an array, prose with no JSON, an empty object, an oversized summary, too many items, an over-long item, and nine **unexpected fields one at a time** — `diagnosis`, `confidence`, `prescription`, `treatmentPlan`, `probability`, `severity`, `sources`, `patientId`, `apply` — each **rejected rather than stripped**. Plus that fenced and prose-wrapped JSON still parse, that a brace inside a clinical note does not close the object, that control characters, zero-width characters and **bidirectional overrides** are removed while paragraph breaks survive, and that HTML is kept as literal characters rather than stripped, because the defence is that every string is a React text node. |
| `src/features/clinical-ai/safety.test.ts` | Every boundary in sections 142 and 170 as a constructed response with an asserted verdict — prescribing, diagnosis, false confidence, prompt disclosure, credentials, cure claims, fabricated citations, patient-directed advice and reassuring triage. Plus the cases that must **not** be refused: a consideration phrased as a prompt for judgment, "warrants prompt assessment", and the honest hallucination phrasings ("no glucose value is available in the supplied information"), because a layer that refused those would make the model's honest behaviour indistinguishable from its dishonest behaviour. And the restate-versus-originate distinction that live verification forced — see below. |
| `src/features/clinical-ai/prompts.test.ts` | That the system prompt still **contains the thirteen rules** section 94 requires, each as a phrase a reader would look for, so a refactor that shortens it and quietly drops "never prescribe" fails. Plus distinct versions in the shape the database's check constraint accepts (read from the SQL), no task instruction asking for a diagnosis or a treatment, the considerations task carrying section 19's wording rules restated, and that no prompt is reachable from a request — the module reads no environment variable, performs no query and exports no mutable binding. |
| `src/features/clinical-ai/validation.test.ts` | Twenty hostile fields one at a time — `patientId`, `practitionerId`, `doctorId`, `clinicalRecordId`, `userId`, `role`, `permission`, `model`, `provider`, `temperature`, `maxTokens`, `systemPrompt`, `prompt`, `instructions`, `promptVersion`, `apiKey`, `sessionId`, `status` and more — **rejected rather than stripped**; that the schema's own key list names nothing resembling a prompt, a model or an identity; that the two allowlists (the named-field read and the schema) cannot drift; and that a well-formed appointment id for somebody else's diary **passes the schema**, because the schema knows nothing about ownership and the database is what refuses it. |
| `src/features/clinical-ai/context-builder.test.ts` | What leaves the building, asserted on the serialized text: no name, phone, address, date of birth, uuid, URL, storage path or credential; a document sent as a title with the context saying its contents were **not** provided; an absent section omitted rather than placeholdered; and truncation **announced**, because a model working from a shortened record that has not been told so will report the missing part as a fact about the patient. Plus the injection fence — one marker at each edge, and a marker injected into a chief complaint or a **document title** neutralised rather than allowed to close the block. Structurally: no read selects an identifier or a path, none uses `select *`, every ordered read is bounded, none touches the admin client, and none writes. |
| `tests/integration/clinical-ai-security.test.ts` | The structural absences the phase rests on. That the feature writes **none of nine clinical tables** and calls **none of fourteen clinical mutation RPCs**; that it calls only the three Phase 17 functions; that it exports exactly one action and no `apply`, `accept`, `save`, `issue` or `complete`; that it revalidates no path; that the key is read only through the server-only config module and placed in a header rather than a URL; that no component imports a provider module; that every `logger.*` call names only operational keys, matched by **walking brackets** rather than with a regex; and that nothing writes browser storage or a query string. |
| `tests/integration/clinical-ai-service.test.ts` | The whole pipeline against the deterministic mock: the audit written **before** the provider call, the claim carrying no patient or practitioner id, six provider failures degrading safely with copy that says the consultation is unaffected, malformed and unsafe responses refused, a safety rejection recorded as `rejected` rather than `failed` and not echoed back, the flag off sending nothing at all, the quota refusing before anything leaves, and an audit write failure **not** failing the request. |
| `tests/components/clinical-ai.test.tsx` | Disclosure visible and plain rather than a tooltip; both labels attached to the output; staleness warned above the result rather than instead of it; warnings ordered first; **no apply, accept, save or issue control**, exactly one button and it is Copy; the clipboard payload carrying its own labels, because a paste outlives the screen that explained it; script and markdown rendered as literal text; nothing in browser storage; and axe. |

### What the Phase 17 suite does not prove, and what found the rest

The unit and integration suites prove the **application** behaves correctly
against a provider that returns what the test says. They cannot prove that a
model obeys a prompt, and they are not written as though they could — section
127's rule, applied: assert structural and safety properties, never model
wording.

Three things therefore needed something else:

* **The live database**, for the guarantees that are the database's. 52 checks
  with real per-role JWTs.
* **A real browser**, for computed contrast, overflow at real widths and
  rendered landmarks. 58 checks, which found a duplicate-landmark defect — two
  `region` landmarks sharing one accessible name — that the component suite
  structurally could not see, because it renders the panel alone and the
  collision only exists once a page puts one inside a named region. That is the
  third phase running in which the browser pass found something nothing else
  could.
* **The real model**, for the prompt-injection and hallucination behaviour, and
  for one thing nothing else would have found: the safety layer **refusing a
  correct response**. Given a record containing an issued prescription, the
  model produced a faithful restatement, and two rules fired on it — neither
  catching a prescription being *originated*, both catching one being
  *reported*. Clinical AI would have refused the summary of every prescribed
  patient while passing every test, because the synthetic fixtures never
  contained a restatement. The rules are now split by whether the model is
  generating or reporting, and six tests encode the distinction using the
  model's own text verbatim. Recorded in `docs/progress/progress_phase_17.md`
  §12.


### Analytics coverage (Phase 16)

| File | Covers |
| --- | --- |
| `src/config/analytics.test.ts` | That the range bound, the sanity floor and **both** trend-granularity thresholds agree with `analytics_range_rules()`, parsed out of the SQL — because the database is what actually refuses a two-year report and what actually buckets a trend. Plus that every preset resolves to a period the database accepts, that the thresholds bound how many points a chart can be asked to draw, and that the export's five columns are exactly the RPC's own `returns table` and name no patient. |
| `src/features/analytics/metrics.test.ts` | `phase_16.md` section 98's own fixture — 10 appointments, 6 completed, 2 cancelled, 1 no-show, 1 pending — with **every metric and every denominator verified by hand**: six of *nine*, not six of ten. That the three rates sum to exactly 1. **Zero versus missing in both directions**: a rate with no denominator is `null` and renders words, while nine concluded and none cancelled genuinely is 0.0%. The data-quality guard rejecting counts that cannot be true. That the denominator in the SQL is the same three statuses, read from the migration. And that no metric formula makes a clinical claim. |
| `src/features/analytics/ranges.test.ts` | The date-boundary suite section 99 asks for. Midnight in the clinic's zone versus UTC's — the instant where `toISOString().slice(0, 10)` reports *yesterday* for five and a half hours of every clinic day. Month and year boundaries, Monday weeks matching `date_trunc('week')`, February in a leap year, both ends inclusive, the bound at exactly 366 days, and that every preset and every fallback resolves to something the database accepts. `now` is injected throughout, so nothing here behaves differently in a different month. |
| `src/features/analytics/validation.test.ts` | Twenty-two hostile fields one at a time across three schemas — `patientId`, `clinicId`, `organizationId`, `reportId`, `exportId`, `role`, `permission`, `table`, `columns`, `select`, `where`, `orderBy`, `limit` and more — **rejected rather than stripped**; that the module's own code (comments excluded) names none of them; that the practice schema has **no practitioner field at all**; and **which of the three layers actually stops a posted form field** — the named-field read drops it before `strict()` ever sees it, which is the claim Phase 08's docblock got wrong and Phase 16's live pass caught again. |
| `src/features/analytics/errors.test.ts` | That every SQLSTATE the migration raises is recognised and none is declared which it does not raise; that `PV060`-`PV062` is disjoint from every earlier phase; that a refusal is reported as a refusal rather than a failure; and that no function, table, policy, constraint, SQLSTATE or SQL fragment can reach a reader. |
| `src/features/analytics/export.test.ts` | Formula-prefix neutralisation for all six characters a spreadsheet reads as an expression, including `=HYPERLINK(...)`; RFC 4180 quoting and escaping; the UTF-8 BOM; and that a row carrying a smuggled `patientName` or `diagnosis` produces **the same five fields**, because the writer reads through the column contract rather than over the row's keys. |
| `tests/integration/analytics-queries.test.ts` | Every role against every read, including an administrator refused a *practitioner's* own analytics; the exact RPC argument lists; **no practitioner id sent on any practice read**; a failed panel not blocking the other five; a database refusal reported as `forbidden` rather than as an error; implausible counts refused and logged; the export audited with who, what and scope but **not** with whom or what was in it; and an **allowlist** over every identifier in every log call, scanned with a bracket counter rather than a regex. |
| `tests/integration/analytics-security.test.ts` | The **database's** guarantees, against the migration text: no table, column, enum, trigger, policy or replaced function — only `create function` and `create index`. Every reachable function gated in its **body**, authorizing before it reads, and bounding its own range. Every internal function revoked from `public, anon, authenticated` and granted to **nobody**. `search_path` pinned, no dynamic SQL, no patient/clinic/report/column/sort parameter, no clinical column selected, no delivery claimed, and every `select *` confined to an internal aggregate. Plus the application layer: no table write, no table read, no service-role client, a permission check on every exported read, and **nothing cached across requests**. |
| `tests/components/analytics.test.tsx` | That a chart is never the only way to read a figure — hidden SVG, an always-present table, a visible summary sentence, native titles that supplement rather than replace, one hue and height carrying the magnitude, and a zero bucket drawn as a bucket. Zero versus missing in four places. The four panel states, including a **refused** panel rendering nothing at all. Nothing clinical or identifying. The acceptance caveat. One form per form carrying exactly the fields its endpoint reads. Markup in a practitioner's name rendered as text. And axe. |

### What the Phase 16 suite does not prove

The two halves are deliberately separate and neither substitutes for the
other. `analytics-queries.test.ts` uses a recording stub, so it proves the
**application** never asks for anything the database would have to refuse and
never passes on something a request supplied.
`analytics-security.test.ts` reads the SQL, so it proves the migration *says*
the right thing.

Only a live run proves the database *does* the right thing, and Phase 15 is
why that distinction is written down here: its structural test asserted that
the migration said `grant execute ... to service_role`, which it did, while
every authenticated user could still call the processor. Phase 16's 155 live
checks with real per-role JWTs, and its 101 HTTP checks against the production
build, are recorded in `docs/progress/progress_phase_16.md`.

### Notification coverage (Phase 15)

| File | Covers |
| --- | --- |
| `src/config/notifications.test.ts` | That the reminder schedule and the mandatory-category rule **agree with the migration**, by parsing `notification_reminder_offsets()` and `notification_category_is_mandatory()` out of the SQL — because the database is what actually plans a reminder and what actually refuses to switch a channel off, and a UI that offered something the system will refuse is the failure this prevents. Plus that the channel list is exactly the database enum, that **no `sms` or `whatsapp` value exists anywhere**, that no promotional category exists, and that every batch, page and retry is bounded. |
| `src/features/notifications/links.test.ts` | That the TypeScript link builder and `public.notification_link_path()` produce the identical string, branch by branch, parsed from the migration; that every path is application-relative with no scheme, no protocol-relative form, no traversal and no `@`; that a produced path satisfies the column's own check constraint, using **the constraint's regex read from the SQL**; and that the module never reads a request or a header, because a link's origin is configuration and never a `Host` header. |
| `src/features/notifications/templates.test.ts` | The privacy suite section 128 asks for, applied where it can hold. Every event rendered and scanned for 26 clinical words; a prescription message that says one exists and never what is in it; a cancellation with no reason and no "because"; dates in the clinic's timezone rather than UTC; every message inside the columns it is stored in; and that a **clinical email subject is the neutral one** while an appointment subject may carry the operational fact. The scanner has its own three tests — see below. |
| `src/features/notifications/errors.test.ts` | That every SQLSTATE the migration raises is recognised and none is declared which it does not raise; that `PV050`–`PV055` is disjoint from every earlier phase; that no relation, policy, table or SQLSTATE can reach a screen; that a rate limit and a 5xx are **retried** while an auth failure, a rejection and an invalid recipient are **not**; and that no provider message survives into an error code. |
| `src/features/notifications/retry.test.ts` | That a transient failure backs off further each time, that nothing is retried past the cap, that a **permanent** failure is never retried whatever the attempt count says, that the whole schedule is bounded in wall-clock time, and that the function takes `now` rather than reading a clock. |
| `src/features/notifications/validation.test.ts` | Twenty-one hostile fields one at a time across two schemas — `recipientUserId`, `recipientEmail`, `recipientPhone`, `to`, `subject`, `body`, `title`, `template`, `linkPath`, `url`, `status`, `provider`, `deliveryStatus`, `role` and more — **rejected rather than stripped**; that the module's own source names none of them; that **no schema for creating or sending a notification exists at all**; and that a channel or category outside the model is refused rather than forwarded. |
| `src/features/notifications/dispatch.test.ts` | That `scheduleNotificationDispatch()` **cannot throw**, in either direction — see below. |
| `tests/integration/notification-processor.test.ts` | The heart of the phase. A stale event skipped rather than sent; a **superseded** event skipped, so two reschedules processed out of order cannot announce the older one; a **draft** prescription producing no notification even when an event exists; reminders planned from the authoritative appointment and cancelled when it is; one notification from two passes over the same event; a transient provider failure retried and a permanent one not; the cap ending retries; no delivery row created when no channel is configured; and that **no address, title, body, link, practitioner name or time reaches a log line**. |
| `tests/integration/notification-actions.test.ts` | Four roles; an unauthenticated caller writing nothing; a refusal naming no role and no permission; the exact RPC argument lists; **fifteen planted fields changing nothing**; somebody else's notification id passed through unchanged so the *database* decides; "mark all read" carrying **no fields at all**; and that a database message never reaches the person. |
| `tests/integration/notification-security.test.ts` | The **database's** guarantees, asserted against the migration text: two select policies and **no policy at all** on either queue, both scoped to `auth.uid()`, the notifications policy carrying `status = 'active'`, no blanket policy, no write policy or grant anywhere, the queues revoked from `service_role` too, the processor's functions granted to `service_role` **and refused to `authenticated`**, **no recipient or link parameter on anything**, `for update skip locked` on every claim, every claim bounded, the three unique keys, the link-path constraint, `channel <> 'in_app'` on the delivery table, **no email/phone/address column on any table**, no clinical column on `notifications`, pinned `search_path` everywhere — and that the migration writes to **no domain table**, adds no column to one and replaces no function. Plus the application layer: no table write, the service-role client confined to the processor, a permission check on every exported read, no `select *`, **no log call naming content**, exactly three exported actions, one route handler and no SMS or WhatsApp adapter. |
| `tests/components/notifications.test.tsx` | Unread announced as a word rather than a colour; a real `<a>` to the resource alongside a separate mark-as-read control; each control's accessible name carrying its notification's title; markup in a title rendered as text; every form carrying exactly the fields its action reads and **no user id in any of them**; a mandatory or unconfigured channel disabled **with the reason beside it**; no HTML `required`; two distinct empty states; pagination as a link that keeps the filter; nothing reaching browser storage; and axe. |

### Why the Phase 15 scanner has its own tests

`templates.test.ts` scans every rendered message for clinical words. The first
version built the word boundary with a plain template literal:

```ts
new RegExp(`\b${word}\b`, "i")   //  \b is a BACKSPACE here, not a boundary
```

It compiled, it ran, it matched nothing, and **every privacy assertion in the
file passed vacuously**. It was caught only because one assertion had been
failing for an unrelated reason a minute earlier and then stopped failing when
nothing about the templates had changed.

This is the same defect class Phase 06 found in `lib/auth/redirect.ts` and
Phase 14 found in two security assertions, arriving by a third route — not a
formatter rewriting an escape, but a template literal consuming one. The fix
is `String.raw`, and the guard is three tests that assert the scanner **finds a
word it is meant to find**, ignores substrings, and matches across whitespace.

A scanner without a self-test is a scanner that silently stops scanning. The
same reasoning as `source-hygiene.test.ts` asserting it read more than a
hundred files.

### The defect the Phase 15 suite found in the product

`scheduleNotificationDispatch()` is the one line a domain action adds. The
first version called `after()` directly — and `after()` **throws when there is
no request scope**. A full test run turned 40 existing appointment, doctor,
prescription and treatment-plan action tests red at once.

That would have been a production defect of exactly the kind this phase exists
to prevent: the throw lands *synchronously inside the domain action*, after the
database write has committed, and turns a confirmed appointment into an error
message on the receptionist's screen. `phase_15.md` section 103 and example 6
forbid precisely that, and it would have arrived through the line that was
supposed to prevent it.

The fix guards the scheduling call as well as the callback, and
`dispatch.test.ts` now asserts both directions. It is recorded here because the
lesson is general: **a "fire and forget" call is still a call, and it can still
throw.**

### Why Phase 14 added a repo-wide control-character scan

Phase 06 recorded that `prettier --write` rewrites a unicode escape inside a
**regex character class** into the literal byte it denotes, putting a raw NUL
into the source of a security check where it is invisible in a diff and
invisible in review. That was fixed at the time by rewriting the check.

Phase 14 found the same corruption twice more, and **neither had been
noticed**:

* `tests/integration/reception-actions.test.ts` asserted that a
  receptionist's refusal names no role, with `not.toMatch(/\brole\b/i)`.
  Both word boundaries had become **backspace bytes**, so the pattern was
  looking for a literal `<BS>role<BS>`, matched nothing, and had therefore
  been **passing unconditionally since Phase 10**;
* `src/config/permissions.test.ts` had the same thing inside
  `/medication|\bai\b|.../`, so the `ai` alternative never matched either.

Both were repaired, and both properties turned out to be true all along —
what was broken was the test, which is exactly the failure mode Rule 3 is
about. The scan now runs on every `vitest` invocation, and it caught a third
instance immediately, in a comment written during this phase. A pattern that
genuinely needs an escape builds it from a string —
`new RegExp("\\bfoo\\b")` — where the backslash is escaped in the source and
the formatter leaves it alone.

**The lesson generalises beyond this repository: an assertion that matches
nothing passes for the wrong reason.** The same phase found a log assertion
spying on `console.debug` while the logger wrote through `console.log`, and a
set of planted-field assertions that expected a rejection the code could never
produce because `readForm` reads a fixed field list and never sees an extra
key. All three were green. None was testing anything.

### Why the Phase 14 tests read SQL too

The same reason every security test since Phase 09 does, and one that is new:
this is the first phase whose guarantees live in **two systems** rather than
one. A row is governed by a policy on `public.patient_documents`; the bytes
are governed by a policy on `storage.objects`. A storage object is not a
database row — it has no trigger, no check constraint and no foreign key — so
the only thing tying the two together is that both policies ask the same
question, and the only way to assert that is to read the SQL.

The **storage path** is the other case, and it is deliberately written twice:
in TypeScript, because the server must know the path before the row exists in
order to upload the object, and in SQL, because the database must be able to
recompute it in order to *refuse* one it would not have generated. Two copies
of a rule is a divergence waiting to happen, so the mirror test parses the
migration and compares them character for character.

### What the Phase 14 tests deliberately do *not* prove

The same split as every phase since 07. The integration tests stub Supabase,
so they prove the **application** layer refuses. The other half was run for
real and is recorded in `docs/progress/progress_phase_14.md` — **209 live
checks, 0 failures**:

* **112 live database and storage checks** against the linked project with
  real per-role JWTs: two patients, two practitioners, a receptionist and an
  administrator; direct object requests for a known path; a signed URL that
  expires and a token that is forged; the service-role client refused an
  uncontrolled path, an unsupported type, an oversized file and every kind of
  edit; and the full upload → read → sign → download → archive lifecycle.
* **71 live browser checks** against the production build, including axe with
  real computed contrast on every document route at 390px and 1280px, and
  overflow at nine widths. This is the browser pass Phase 13 skipped and
  recorded as owing.
* **26 end-to-end checks** driving the **actual upload form** in Chrome: a
  real PDF uploaded, previewed, downloaded and still present after a reload;
  an executable named `.pdf` refused; an SVG refused.

What remains unproven is unchanged from every earlier phase, and one item is
specific to this one:

* **There is no malware scanning**, so nothing proves an uploaded file is
  *safe* — only that it is a container of the type it claims to be. The
  product says so on the upload form rather than implying otherwise.
* No E2E tool, no manual screen-reader pass, no Lighthouse run. The 209 live
  checks are a script written for this phase and then deleted, not a
  maintained suite.

### Prescription and treatment plan coverage (Phase 13)

| File | Covers |
| --- | --- |
| `src/features/prescriptions/status.test.ts` | The lifecycle, editability, withdrawability, patient visibility and the item cap — and that **all five agree with the migration**, by parsing the enum, the guard trigger's transition branches, the policy predicate and the cap out of the SQL. Plus that `amended` is declared and set by nothing, which is the assertion that fails on the day the amendment workflow arrives. |
| `src/features/prescriptions/validation.test.ts` | Sixteen hostile fields one at a time — `patientId`, `practitionerId`, `doctorId`, `appointmentId`, `clinicalRecordId`, `status`, `issuedAt`, `role`, `permission`, `version` and more — **rejected rather than stripped**, on the save schema and again on the issue schema; a hostile key *inside an item* rejected too; that the module's own source names none of them; that the eleven field limits equal the check constraints', read from the migration; that the limits cover exactly the item fields with none missing and none extra; and that clinical shorthand — `1/2`, `5%`, `1-2 times daily`, an apostrophe, an angle bracket — is **accepted** rather than mangled. |
| `src/features/prescriptions/errors.test.ts` | That every SQLSTATE the migration raises is recognised and none is declared which it does not raise; that the prescription and treatment plan code ranges are disjoint, so neither feature imports the other's internals; that a stale write and an issued prescription are **conflicts** rather than retryable errors; that every message says explicitly what happened to the work; and that no constraint name, table name, SQL fragment or provider text can reach a screen or a log. |
| `src/features/prescriptions/format.test.ts` | That an absent dose, quantity or duration is **omitted** rather than rendered as a placeholder — because "Dose: —" invites somebody to wonder whether it was forgotten — and that the facts beneath a medicine appear in one fixed order, so two prescriptions read the same way. |
| `src/features/treatment-plans/status.test.ts` | The same mirror, plus: that the category enum has **no `medication` value** in either TypeScript or SQL, that an active plan can never go back to a draft, that activation requires a title (mirrored by a check constraint), and that **nothing in the migration writes to `public.appointments`** — section 47's "a follow-up date books nothing", asserted structurally because it is exactly the convenience somebody adds later meaning well. |
| `src/features/treatment-plans/validation.test.ts` | Fifteen hostile fields; a category the database does not have; a date that is not a real calendar day; and that the transition schema carries an id and a revision and **no status**, because activating, completing and withdrawing are three actions calling three functions. |
| `tests/integration/prescription-actions.test.ts` | Four roles writing nothing across nine actions; a refusal naming no role and no permission; the exact RPC argument lists; **eleven planted fields changing nothing**, on the save path and again on the issue path; that issuing sends an id and a revision and no clinical content at all; a stale write becoming a conflict **with no version handed back**; a well-formed id for another practitioner's prescription passed through unchanged so the *database* decides; that an empty date becomes a null rather than an epoch; that the patient's own list is revalidated **only once a prescription is issued**; and that no log line carries a medicine, a dose, a frequency, an instruction, a withdrawal reason, a plan title, a follow-up date or a search term. |
| `tests/integration/prescription-security.test.ts` | The **database's** guarantees, asserted against the migration text: exactly eight policies and all of them `select`, every one scoped by a relationship as well as by a role, `status <> 'draft'` in the patient policies *and* in the definer predicates, no blanket policy, no write policy or grant anywhere, no policy at all for a receptionist or an administrator, every actor column absent from the select grant, every function calling the gate before it reads or writes, pinned `search_path`, no patient/practitioner/doctor/appointment/status parameter on anything, the two composite foreign keys, the two partial unique indexes, `on delete restrict` on every reference, the version increment in a trigger, the optimistic lock in the update statement itself, the item guards, the search's bounds, escaping, prefix-only matching and column list — and that **no prescription column is added to `clinical_records` or `appointments`**, no appointment is ever written, no document or AI column exists, no existing function is replaced and no policy is dropped. Plus the application layer: no table write, no service-role client, a permission check on every exported read, no `select *`, no patient id on anything a patient calls, nothing in browser storage, and **no clinical field read off the validated request into any log call**. |
| `tests/components/prescriptions.test.tsx` | One `<form>` carrying exactly the four fields its action reads and no field that would be a claim about identity; **no HTML `required`, so an incomplete draft can be saved** — the Phase 12 defect, guarded here from the start; add, remove and reorder, with an accessible name that says *which medicine* is moving; the five save states, and that "Saved" is never shown when the server refused; the form refusing to save again after a conflict; **issuing refused while there are unsaved changes**, and the review rendering the *saved* prescription rather than the unsaved edits; issuing asking first and then sending only an id and a revision; the autocomplete debouncing to one query for three keystrokes, discarding a stale reply, and being a real combobox rather than a datalist; an issued prescription rendered as prose with no editable control; markup in a medicine name rendered as text; a list carrying no clinical content; nothing in browser storage or the URL; `autocomplete="off"` on every clinical field; a real label on every control; and axe. |
| `tests/components/treatment-plans.test.tsx` | The same contract, plus: the section select offering five options and **no Medication**; the follow-up field saying it books nothing; a plan grouped by section with empty sections **omitted** rather than rendered as bare headings; an active plan offering no way to edit it; and axe. |

### Why the Phase 13 tests read SQL too

The same reason the clinical ones do, and one more: the two properties this
phase rests on most are both *database* properties, and both exist in two
places on purpose.

The **lifecycles** are in `features/*/status.ts` so the workspace can decide
what to render, and in the guard triggers so the database refuses
independently. The **patient-visibility rule** is in `status.ts` so a page can
say "the patient cannot see this yet", and in
`prescriptions_select_patient` so no query can forget it. A divergence in the
first produces a button the product offers and the database refuses; a
divergence in the second would be a draft prescription reaching a patient.

Both mirror tests parse the migration rather than restating it.

### What the Phase 13 tests deliberately do *not* prove

The same split as every phase since 07. The integration tests stub the
database, so they prove the **application** layer refuses. The other half was
run for real and is recorded in `docs/progress/progress_phase_13.md`:

* **141 live database checks** against the linked project with real per-role
  JWTs, including two doctors, two patients, two genuinely concurrent
  prescription creations, two genuinely concurrent saves at one revision,
  **two genuinely concurrent issues**, the full draft → issued → withdrawn →
  replaced lifecycle, and the service-role client being refused an edit to an
  issued prescription.

**A browser pass was not run for this phase.** Phases 03–09, 11 and 12 each
drove the production build through Chrome and several found defects nothing
else could see — a 3.89:1 contrast failure, 35px of horizontal overflow, two
landmarks sharing one name. The component suite's axe sweeps run in jsdom,
which has no layout engine and therefore no computed colours, so **contrast,
overflow and focus behaviour on the eight new routes are unverified**. That is
the same gap Phase 10 recorded, and it should be closed before the workspace
is used.

### Why the clinical tests read SQL too

The same reason `appointment-security.test.ts` and `doctor-security.test.ts`
do, and one more that is specific to this phase: the three properties a
clinical record depends on most are all *database* properties, and all three
exist in two places on purpose.

The **lifecycle** is in `features/clinical/status.ts` so the UI can decide what
to render, and in `clinical_records_guard_update()` so the database refuses
independently. The **completion requirements** are in `status.ts` so the form
can name the missing field, and in a check constraint so they hold against any
writer. The **eligibility** rule is in `status.ts` so the start button is
offered correctly, and in `start_consultation` so a stale page reaches a
refusal.

Two copies of a rule is a divergence waiting to happen, and each of these
produces a concrete, user-visible failure: a "Complete consultation" button the
workspace offers and the database refuses, or a "Start consultation" button on
a page that cannot start one. All three mirror tests parse the migration rather
than restating it — a test that restated the SQL would agree with a wrong
migration.

### What the Phase 12 tests deliberately do *not* prove

The same split as every phase since 07. The integration tests stub the
database, so they prove the **application** layer refuses. The other two halves
were run for real and are recorded in `docs/progress/progress_phase_12.md`:

* **75 live database checks** against the linked project with real per-role
  JWTs, including two doctors, two patients, two genuinely concurrent
  consultation starts, two genuinely concurrent saves at one version, and the
  full `checked_in → in_consultation → completed` lifecycle across both the
  appointment and the record.
* **102 live browser checks** driving the production build through Chrome: axe
  with real computed contrast on every clinical route at 390px and 1280px,
  horizontal overflow at nine widths, the five-actor route matrix, and a
  measurement that no clinical content reaches `localStorage`,
  `sessionStorage` or a URL.

**One defect was found by the component suite that nothing else could see**, and
it would have broken the core workflow: `Field` sets the HTML `required`
attribute, so the browser's own constraint validation silently refused to
submit "Save draft" while either required-for-completion field was empty —
which is exactly the state a draft exists to hold. The test measured zero
submissions *and* no `submit` event, which is what made it chaseable.

**Five component tests were flaky and were fixed rather than retried.** A server
action resolves asynchronously and `userEvent.click` only awaits the click, so
asserting immediately afterwards races the result under a loaded worker. They
now `waitFor` the state they are about; §35 forbids papering over a flake, and
no assertion was weakened.

### Why the doctor tests assert a caption differs from a heading

Because a real browser found the defect and jsdom could not. `TableScroller`
is a labelled `region` landmark, and so is the `<section>` whose heading sits
above it; when the two say the same thing the page has two regions with one
accessible name, which is an axe `landmark-unique` violation. It existed on
three Phase 11 pages **and on two Phase 10 pages**, where it had shipped
because that phase ran no browser pass.

The component suite could not catch it: it renders a schedule on its own, and
the collision only exists once a page puts one inside a section. So the
regression guard is on the copy — a caption may never equal the heading it
sits under — which is a cheap assertion for a defect that costs a real
browser to see.

### Why the reception tests read SQL too

The same reason `appointment-security.test.ts` does, and one more: Phase 10
puts the *same rule* in two places on purpose — a role allowlist in TypeScript
so the UI can decide what to render, and the same allowlist in PL/pgSQL so the
database refuses independently. Two copies of a rule is a divergence waiting to
happen, and the failure it produces is specific and user-visible: a button the
front desk is offered and the database then refuses.

Both mirror tests parse the migration rather than restating it. One of them
found exactly that divergence before the code shipped —
`in_consultation -> cancelled` was legal by transition and permitted by role,
so the UI would have offered "Cancel appointment" for a patient sitting in the
consulting room. The fix was a third rule, not a relaxed assertion.

### What the Phase 11 tests deliberately do *not* prove

The same split as every phase since 07. The integration tests stub the
database, so they prove the **application** layer refuses. The other two
halves were run for real and are recorded in
`docs/progress/progress_phase_11.md`:

* **71 live database checks** against the linked project with real per-role
  JWTs, including two doctors and two patients for cross-doctor isolation, a
  doctor account with no practitioner record, and the full
  `checked_in → in_consultation → completed` lifecycle.
* **133 live browser checks** driving the production build through Chrome:
  axe with real computed contrast on every route at 390px and 1280px,
  horizontal overflow at nine widths, the five-actor route matrix, the
  consultation journey end to end, and the search term never reaching a URL.

Two harness bugs were recorded rather than dropped, and the **stale-server
trap** of Phases 06-08 struck again: `next start` survives `kill()` on
Windows, so a correct fix measured as broken for one run because port 3411
was still serving the previous build. The harness now uses a fresh port per
run.

### What the Phase 10 tests deliberately do *not* prove

The integration tests stub the database, so they prove the **application**
layer refuses. The other half — that the database refuses independently — was
verified against the live project with real per-role JWTs: **106 checks**
covering every policy, grant and `security definer` function, including two
genuinely concurrent bookings for the same slot.
`docs/progress/progress_phase_10.md` records each one.

**A third half is missing, and it is the one previous phases found defects
with.** Phases 03-09 each drove the production build through a real browser and
each time found something the suite could not: a deleted type scale, a 3.89:1
contrast failure, 35px of horizontal overflow, a form submitting by GET. No
browser pass was run for Phase 10, so contrast, overflow and focus behaviour on
the eight new routes are **unverified**. The component suite's axe sweeps run
in jsdom, which has no layout engine and therefore no computed colours.

The **first live verification run reported four failures and every one was the
harness**, not the product: it assumed working hours the seeded practitioner
does not keep, and assumed a practitioner who does not accept online booking
when that one does. The database was right four times out of four. The rewritten
harness reads the real configuration and *throws* when it asks for a time
outside the working interval, so it now fails loudly rather than blaming the
system under test.

### Why `appointment-security.test.ts` reads SQL

The properties Phase 09 depends on most are properties of the *database*, and
a stubbed Supabase client will answer whatever it is told to. Running real
PostgreSQL in this suite would mean a database in CI, which section 1.1 has
avoided since Phase 01. So that file asserts the migration **says** what the
design requires - a structural check, not a behavioural one, which catches the
failure that actually happens: a policy or a grant weakened in a later edit.

The behavioural half has to be run against a live project. The file says so,
and `docs/progress/progress_phase_09.md` records exactly which checks are
outstanding. **Both halves are needed**, and neither substitutes for the other.

### What the Phase 08 tests deliberately do *not* prove

The integration tests stub the database, so they prove the **application**
layer refuses. The other half — that the database refuses independently — was
verified against the live project with real per-role JWTs, not asserted in the
suite, because doing it in Vitest would mean a live database in CI. Both halves
are needed: 62 live checks covering every policy, grant, constraint and
`security definer` function, and 57 checks driving a real Chrome through each
role. `docs/progress/progress_phase_08.md` records each one.

**One defect in this phase was found only by measuring the built application in
a real browser**, and it was invisible to 1,241 tests, to ESLint and to review:
`/admin/users` overflowed a 320px viewport by 35px, because an `sr-only` label
inside a horizontally scrolling table escaped the scroller's clipping — an
absolutely positioned element is clipped by an ancestor's `overflow` only when
that ancestor is its containing block. The fix is one class on `TableScroller`
and it repairs every table in the application. There is now a regression test,
but it asserts the class, because jsdom has no layout engine; the pixel result
can only be measured in a browser.

The **stale-server trap** recorded in Phases 06 and 07 caught this phase too: a
correct fix measured as broken because `next start` was still serving the
previous build. On Windows `pkill` does not stop it —
`Get-NetTCPConnection -LocalPort <port>` and `Stop-Process` do.

**Two defects in this phase were found only by driving the built application in
a real browser**, and neither was visible to the 1,064-test suite, to ESLint or
to review: a nested `<form>` that made the profile submit by GET with the
patient's details in the query string, and a long email address that set the
min-content width of a flex item and overflowed a 320px screen. Both now have
regression tests, but the lesson is the one `AGENTS.md` section 29 already
states — for UI, code inspection is not verification.

Control characters in a test fixture are built with `String.fromCharCode`
rather than written as escapes. The formatter rewrites a unicode escape inside
a string literal into the literal byte it denotes, which puts an invisible NUL
into the file; a security test that cannot be read in a diff is not much of a
test.

---

# 30. Exploratory Testing

Automated tests cannot discover every usability issue.

Before important releases, perform exploratory testing using realistic personas.

### Visitor

```text
Open website
→ Explore services
→ Find clinic information
→ Decide to book consultation
→ Submit request
```

### Returning User

```text
Login
→ View dashboard
→ View appointment
→ Update information
→ Logout
```

### Administrator

```text
Login
→ Review appointments
→ Inspect details
→ Update status
→ Manage records
→ Logout
```

Look for unexpected behavior rather than simply following predetermined test cases.

---

# 31. Test Data Strategy

Use separate datasets/environments for:

```text
Development
Testing
Staging
Production
```

Never use real patient information in development or automated tests.

Test fixtures should contain clearly synthetic data.

Example:

```text
Name: Test Patient
Email: test.patient@example.test
Phone: 9999999999
```

Production data must never be copied into local development environments without an approved privacy process.

---

# 32. Environment QA

Verify configuration independently in:

* Local
* CI
* Preview
* Staging
* Production

Important environment variables must be validated at startup.

Missing configuration should produce a clear server-side error rather than silently causing incorrect behavior.

Never expose private environment variables to the browser.

---

# 33. Test Naming Convention

Tests should describe behavior rather than implementation.

Prefer:

```text
should prevent an unauthenticated user from accessing the dashboard
```

over:

```text
should call redirectToLogin()
```

Prefer:

```text
should reject an appointment scheduled in the past
```

over:

```text
should call validateDate()
```

Tests should remain useful even when implementation details change.

---

# 34. Test Isolation

Tests must be:

* Deterministic
* Repeatable
* Independent
* Isolated

Avoid tests that depend on:

* Execution order
* Local machine state
* Existing database records
* Current date/time without mocking
* External services without controlled mocks
* Another test having run first

---

# 35. Flaky Test Policy

A flaky test must not simply be ignored.

When a flaky test is detected:

1. Identify the cause.
2. Reproduce it.
3. Fix the underlying issue.
4. If temporarily quarantined, document the reason.
5. Assign ownership.
6. Remove the quarantine as soon as possible.

Repeatedly retrying failed tests without understanding the cause is not an acceptable quality strategy.

---

# 36. Bug Severity

Use the following severity model.

### P0 — Critical

Examples:

* Patient data exposure
* Authentication bypass
* Authorization bypass
* Production outage
* Corrupted critical data

Action:

**Immediate investigation and release block.**

### P1 — High

Examples:

* Appointment booking completely broken
* Major workflow unavailable
* Significant security vulnerability
* Major mobile usability issue

Action:

**Fix before release unless explicitly approved.**

### P2 — Medium

Examples:

* Non-critical feature malfunction
* Minor workflow issue
* Significant visual defect

Action:

**Fix in current or next release depending on impact.**

### P3 — Low

Examples:

* Cosmetic issue
* Minor copy problem
* Non-critical UI inconsistency

Action:

**Prioritize based on backlog and impact.**

---

# 37. Bug Report Requirements

Every bug should contain:

```text
Title
Environment
Browser/device
Steps to reproduce
Expected result
Actual result
Severity
Screenshots/video where useful
Console/server errors where relevant
Reproduction frequency
```

Example:

```text
Title:
Appointment form submits twice on rapid double-click

Environment:
Production / Android Chrome

Steps:
1. Open appointment form
2. Fill valid information
3. Double-tap Submit rapidly

Expected:
Only one appointment is created.

Actual:
Two appointment records are created.

Severity:
P1
```

---

# 38. Release Checklist

Before production release:

## Code

* [ ] Code reviewed
* [ ] No debugging code
* [ ] No temporary credentials
* [ ] No commented-out experimental code
* [ ] No accidental console logging of sensitive data

## Testing

* [ ] Unit tests pass
* [ ] Integration tests pass
* [ ] E2E tests pass
* [ ] Build succeeds
* [ ] Smoke tests pass
* [ ] Regression checks completed

## Security

* [ ] Authentication verified
* [ ] Authorization verified
* [ ] Sensitive data reviewed
* [ ] Environment variables reviewed
* [ ] Dependency vulnerabilities reviewed

## UI

* [ ] Mobile tested
* [ ] Desktop tested
* [ ] Accessibility checked
* [ ] Visual regression checked where applicable

## Performance

* [ ] No significant bundle regression
* [ ] Images optimized
* [ ] Core pages checked
* [ ] API performance acceptable

## Production

* [ ] Database migrations reviewed
* [ ] Deployment successful
* [ ] Critical flows smoke-tested
* [ ] Monitoring/logging operational
* [ ] Rollback plan available

---

# 39. Post-Deployment QA

After production deployment:

1. Verify application availability.
2. Run smoke tests.
3. Verify authentication.
4. Verify appointment/consultation workflow.
5. Verify critical APIs.
6. Check server logs.
7. Check error monitoring.
8. Check notification delivery where applicable.
9. Monitor for unusual error rates.

High-risk releases should receive additional monitoring immediately after deployment.

---

# 40. Rollback Strategy

Every production release must have a rollback strategy.

Rollback may involve:

* Application version rollback
* Configuration rollback
* Database migration rollback where safely possible
* Feature flag disablement

Database migrations must be designed carefully because application rollback may not automatically mean database rollback is safe.

Prefer backward-compatible database changes for production deployments.

---

# 41. Feature Flags

Large or risky features should use feature flags where appropriate.

Feature flags allow:

```text
Deploy code
     ↓
Keep feature disabled
     ↓
Enable for internal users
     ↓
Validate
     ↓
Gradually enable
     ↓
Monitor
     ↓
Fully release
```

Feature flags must have:

* Clear ownership
* Defined purpose
* Safe default
* Removal plan

Do not allow obsolete feature flags to accumulate indefinitely.

---

# 42. Accessibility Automation

Automated accessibility checks should be incorporated into CI where practical.

Automated tools can identify issues such as:

* Missing labels
* Invalid ARIA
* Contrast problems
* Missing document structure
* Invalid semantics

However, automated accessibility testing does not replace manual keyboard and screen-reader testing.

---

# 43. Security Testing Cadence

Security testing should occur:

### Every PR

* Dependency checks
* Static analysis where configured
* Secret detection

### Every significant feature

* Authorization review
* Input validation review
* Sensitive-data review

### Before major release

* Security regression testing
* Authentication/authorization review
* Dependency review

### Periodically

* Dependency updates
* Security audit
* Access review
* Logging/privacy review

---

# 43B. Asset, Bundle and Indexing Invariants  *(Phase 20)*

`tests/integration/asset-and-seo-invariants.test.ts`, **72 tests**. Each one
locks in a defect that was found by *measurement* rather than by review, and
each would be silent if it came back.

| Group | Covers |
| --- | --- |
| Image registry | Every declared image exists; its **declared dimensions are the real ones**, because `width`/`height` are what reserve layout space and a wrong pair is a layout shift that only appears on a slow connection; no source file over 400 KB; the whole set under 2 MB; and that the three design mockups of a *different clinic's* website stay deleted — a content-safety property, not a weight one |
| Client bundles | `features/auth/limits.ts` **imports nothing at all**, which is the whole of its value; `features/auth/content.ts` does not reach the schema module; and no auth client component imports `features/auth/validation`. Together these are what keep 384 KB of Zod off the two statically rendered auth pages |
| Image optimizer | AVIF with a WebP fallback; `localPatterns` restricted to `/images/**` with no query string and **no `remotePatterns`**, which is what makes Phase 14's "a patient document never passes through the optimizer" structural; exactly one permitted quality; SVG optimization off; and that there are exactly two `next/image` consumers, named |
| Indexing | `robots.ts` and the root layout are gated on the **same** helper so they cannot drift into disagreeing; and that the helper reads `APP_ENV` rather than `NODE_ENV`, which cannot tell a preview build from a production one |
| Social and canonical | Every public segment has an `opengraph-image`; the sitemap lists the home page in the form its canonical actually uses; and treatment and practitioner entries are generated rather than listed by hand |

These follow the same two rules as the security suite below: **a scan that
matches nothing must fail** (every group carries a non-vacuity assertion), and
**a scan must not match a file's own documentation** (comments are stripped
before matching, so a module that explains why it avoids a pattern does not
fail for naming it).

---

# 43A. The Security Test Suite  *(Phase 19)*

`phase_19.md` sections 168-171 ask for a dedicated security suite. It lives in
`tests/security/` rather than as more files in `tests/integration/`, so that

```text
npx vitest run tests/security
```

is one command — which is what makes it usable as a release gate instead of a
search through a hundred and thirty-seven files.

**193 tests across eight files.**

| File | Covers |
| --- | --- |
| `headers.test.ts` | Both CSP tiers directive by directive; that the strict tier refuses inline script and the baseline one does not pretend otherwise; which routes get which tier, including that the two *static* auth pages stay on the baseline (a nonce would break them); nonce uniqueness and entropy; and that no directive is emitted twice, since a browser honours the first and ignores the rest |
| `csrf.test.ts` | The same-origin check against fetch metadata, `Origin`, a forwarded host, and a malformed URL; that `same-site` is refused alongside `cross-site`; that a missing `Origin` is allowed and *why*; and structurally, that the check runs in the wrapper before the handler so a new route inherits it |
| `browser-surface.test.ts` | That **no client component imports a Supabase client** and the browser client has no callers at all — the claim `connect-src 'self'` and `HttpOnly` cookies both rest on; that every secret module is `server-only`; that the service-role client is created in exactly two features; that `NEXT_PUBLIC_` exposes exactly five known-public values; that nothing writes browser storage anywhere; and the four cookie attributes, applied by both writers |
| `database-grants.test.ts` | The migrations' own privileges: every `security definer` function pins `search_path = ''`; none builds dynamic SQL from an argument; the Phase 19 sweep and the default-privilege revoke both exist; **a migration added after Phase 19 must name `anon` in its own revoke**; RLS is enabled on every table; every policy names a role rather than PUBLIC; no client role holds a write grant on any sensitive table; and the audit table's shape, immutability and admin-only read |
| `adversarial.test.ts` | The mandatory matrix of sections 207-211, asserted as *mechanisms*: patient-facing policies scoped by the caller's own record, a draft invisible in the policy rather than in a query, **no receptionist policy on any clinical table**, care policies scoped by relationship, no writable path to `user_roles`, the new-user role as a literal, ten hostile redirect shapes, no status parameter on any transition, and that the AI feature calls none of six clinical write functions |
| `privacy.test.ts` | Log redaction including the identifier allow-list; a **bracket-walking** scan of every log call for twenty-five clinical or identifying field names; that no log stringifies an object or passes `error.message` as a field; that `console` is used in exactly four places and writes only a digest; that every dynamic route segment is an opaque id or a published slug; that search is a POST; the external-origin inventory; and that no authenticated page title interpolates anything |
| `secrets.test.ts` | Eight credential shapes — JWT, Google API key, OAuth token, OpenAI key, Supabase key, webhook secret, AWS key, private-key block — across every text file in the repository, plus a **self-test that plants a credential and checks it is detected**. The one exemption is narrow and written as a reviewable rule rather than a list of blessed paths: a value must *say* it is fake, on its own line. Also: `.env.example` carries a placeholder for every value, is tracked on purpose, documents which variables are server-only, and keeps clinical AI off by default |
| `audit-and-limits.test.ts` | What the audit trail is told and what it cannot be told; that it has no actor parameter; that it never fails the operation it records; which accesses are instrumented; that every denial is *awaited* before the redirect that would abandon it; and the three rate limits, their independence per surface and per account, and that each is checked after authorization |

### Two rules these tests follow

**A scan that matches nothing must fail.** Phase 14 found a security assertion
that had been passing vacuously for four phases because a formatter had eaten
two word boundaries. Every scanning test here asserts it found a realistic
number of files, functions or call sites first, and the secret scanner carries
a self-test that plants a credential and checks it is detected.

**A scan must not read the documentation.** Phase 16 recorded three tests that
failed because a module *explained* which clinical fields it deliberately does
not use. Every scan strips comments first — and the comment stripper itself is
not naive, because `line.split("//")[0]` truncates every URL at `https:`, which
silently emptied the external-origin scan while it appeared to pass.

### What the suite cannot do

It is **static**. It reads source and migration text, and it proves that what
is written is right. It cannot prove the live database matches what the
migrations say — that needs the migration applied and real per-role JWTs, which
is a separate and required verification recorded per phase in
`docs/progress/`. The two are complements: a live probe catches a mistake after
it has been deployed, and this catches it as it is being written.

---

# 44. QA for AI or Automated Features

If AI-assisted functionality is introduced, it must be tested separately.

Verify:

* Prompt/input validation
* Output validation
* Hallucination handling
* Unsafe medical advice prevention
* Sensitive-data handling
* Abuse prevention
* Rate limiting
* Failure fallback
* Clear disclosure when users interact with AI
* Human escalation path where appropriate

AI-generated medical information must never be presented as a definitive diagnosis or guaranteed treatment recommendation.

---

# 45. Production Monitoring

Quality continues after deployment.

Monitor:

* HTTP error rate
* API failures
* Authentication failures
* Appointment submission failures
* Database errors
* Notification failures
* Performance metrics
* JavaScript errors
* Availability

Alerts should prioritize issues affecting critical patient workflows.

---

# 46. QA Metrics

Track meaningful quality indicators.

Suggested metrics:

```text
Test pass rate
Critical workflow success rate
Production error rate
Regression defect count
Escaped defect count
Mean time to detect
Mean time to resolve
E2E reliability
Accessibility issue count
Performance regression count
```

Metrics should improve decision-making rather than become vanity numbers.

---

# 47. Acceptance Criteria Template

Every feature should define acceptance criteria in a structure similar to:

```text
Feature:
Appointment Booking

Given:
A valid authenticated user

When:
The user submits a valid appointment request

Then:
The request is validated
AND
The appointment is persisted
AND
The user receives confirmation
AND
The UI displays the successful result
AND
Duplicate submission is prevented
```

Also define failure scenarios:

```text
Given:
The requested slot is unavailable

When:
The user submits the appointment

Then:
The request is rejected
AND
No duplicate appointment is created
AND
The user receives a clear explanation
AND
The user can select another slot
```

---

# 48. QA Workflow for New Features

Use this workflow for every significant feature:

```text
Requirements
    ↓
Acceptance Criteria
    ↓
Risk Assessment
    ↓
Test Scenarios
    ↓
Implementation
    ↓
Unit Tests
    ↓
Integration Tests
    ↓
E2E Tests
    ↓
Accessibility Check
    ↓
Security Check
    ↓
Responsive/Visual QA
    ↓
Performance Check
    ↓
Code Review
    ↓
CI Quality Gates
    ↓
Staging Verification
    ↓
Production Smoke Test
```

---

# 49. AI Coding Agent QA Rules

Codex, Claude, and other coding agents working on Punarvasu must follow these rules.

### Rule 1 — Never assume a feature works because the code compiles.

Compilation is not functional verification.

### Rule 2 — Test changed behavior.

Every meaningful behavioral change should include appropriate tests.

### Rule 3 — Do not weaken tests to make them pass.

Never:

* Remove meaningful assertions
* Skip failing tests without justification
* Increase timeouts unnecessarily
* Mock away the functionality being tested

### Rule 4 — Preserve existing behavior.

Before modifying an existing feature:

1. Understand existing behavior.
2. Identify dependencies.
3. Check existing tests.
4. Implement the smallest safe change.
5. Run regression tests.

### Rule 5 — Fix root causes.

Do not hide errors with:

```text
try/catch → ignore
```

or:

```text
eslint-disable
```

unless there is a documented and justified reason.

### Rule 6 — Never bypass security checks.

Agents must not disable:

* Authentication
* Authorization
* Validation
* CSRF protections where applicable
* Rate limiting
* Security middleware
* Database security policies

simply to make development easier.

### Rule 7 — Never use real patient data.

All agent-created test data must be synthetic.

### Rule 8 — Report uncertainty.

If an agent cannot verify a behavior, it must clearly state:

```text
NOT VERIFIED
```

rather than claiming the feature works.

---

# 50. Minimum Testing Matrix

For critical user-facing workflows, target:

| Test Type         |                  Required |
| ----------------- | ------------------------: |
| Unit              |                       Yes |
| Integration       |                       Yes |
| E2E               |                       Yes |
| Accessibility     |                       Yes |
| Responsive        |                       Yes |
| Security          |                       Yes |
| Performance       |          Where applicable |
| Visual regression |          Where applicable |
| Exploratory       | Yes before major releases |

---

# 51. Final Quality Gate

A release should be considered production-ready only when:

```text
Functional correctness
        +
Security
        +
Accessibility
        +
Responsive UX
        +
Performance
        +
Reliability
        +
Regression safety
        +
Production verification
        =
Release Ready
```

The goal is not maximum test count.

The goal is **high confidence that Punarvasu works correctly, safely, accessibly, and reliably for real users.**

---

# 52. Non-Negotiable QA Rules

The following rules are mandatory:

1. Never ship known critical security vulnerabilities.
2. Never expose patient-sensitive information through logs, URLs, client bundles, or unauthorized APIs.
3. Never rely solely on client-side validation.
4. Never rely solely on frontend authorization.
5. Never use production patient data for testing.
6. Never disable security controls to simplify development.
7. Never ignore failing critical tests.
8. Never approve visual regression changes blindly.
9. Never claim a feature is verified without actually testing it.
10. Never sacrifice patient safety or privacy for convenience.
11. Every critical workflow must have automated regression coverage.
12. Every production deployment must have a smoke-test plan.
13. Every significant feature must define its failure states.
14. Every security-sensitive change must receive explicit security review.
15. Quality is a continuous responsibility throughout the entire development lifecycle.
