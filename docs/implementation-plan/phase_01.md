# Phase 01 — Technical Foundation & Core Infrastructure

## Objective

Implement the technical foundation of Punarvasu based on the architectural decisions established during Phase 00.

This phase converts the project architecture and engineering principles into a clean, working, production-oriented application foundation.

The objective is NOT to build business features such as appointments, clinical records, prescriptions or dashboards.

Instead, establish the infrastructure that all future phases can safely and consistently build upon.

---

# 1. Read First

Before implementation, read:

* `agent.md`
* `docs/product-spec.md`
* `docs/architecture.md`
* `docs/database.md`
* `docs/design-system.md`
* `docs/security.md`
* `docs/qa-strategy.md`
* `phases/phase_00.md`
* `docs/implementation-progress.md` if available

Then inspect the actual repository.

Do not assume that the repository is empty or that the documented architecture perfectly matches the current implementation.

If documentation and implementation disagree:

1. Identify the discrepancy.
2. Determine whether the code or documentation is authoritative based on the Phase 00 decisions.
3. Correct the appropriate side.
4. Document significant architectural changes.

---

# 2. Phase Scope

## Included

This phase includes:

* Project configuration
* Application architecture
* Environment configuration
* Supabase foundation
* Database connection patterns
* Server/client Supabase separation
* TypeScript configuration
* Error-handling foundation
* Logging foundation
* Validation foundation
* Utility foundation
* Route/layout foundation
* Testing foundation
* Security foundation
* Development tooling
* Basic health-check functionality
* Production build verification

## Explicitly NOT Included

Do not implement:

* Patient registration/login UI
* Appointment booking
* Appointment availability
* Doctor dashboard
* Receptionist dashboard
* Clinical records
* Prescriptions
* Patient documents
* Notifications
* Articles CMS
* Analytics dashboards
* AI functionality
* Payments
* Teleconsultation

These belong to later phases.

---

# 3. Core Principle

The foundation must make future development easier rather than introduce abstractions that are difficult to maintain.

Prefer:

```text
Simple
Typed
Explicit
Reusable
Testable
Secure
```

over:

```text
Over-engineered
Highly abstract
Difficult to understand
Prematurely optimized
```

Do not create abstractions merely because they might be useful someday.

---

# 4. Project Configuration

Review and establish:

* TypeScript
* ESLint
* Prettier
* Next.js configuration
* Tailwind CSS
* package scripts
* environment configuration
* Git configuration
* testing configuration

Preserve existing configurations when they are already correct.

Do not replace working tooling unnecessarily.

---

# 5. Package Management

Inspect existing dependencies.

Remove dependencies only if they are clearly unnecessary and safe to remove.

Do not introduce a library for functionality that can be implemented simply using existing project capabilities.

Every newly introduced dependency should have a clear reason.

Avoid dependency duplication.

---

# 6. Environment Configuration

Create or update:

```text
.env.example
```

Document required environment variables.

Organize variables logically.

For example:

```text
Application
Database
Supabase
Authentication
Email
Storage
AI
External integrations
```

Only include variable names and safe placeholder values.

Never include real secrets.

---

# 7. Environment Validation

Create a typed environment configuration mechanism.

The application should detect missing required environment variables early.

Avoid scattering:

```ts
process.env.SOMETHING
```

throughout the codebase.

Prefer a centralized configuration approach.

For example:

```text
src/config/env.ts
```

The exact implementation should follow the project's architecture.

---

# 8. Public vs Server Secrets

Clearly separate:

### Public configuration

Values intentionally exposed to the browser.

### Server-only configuration

Secrets that must never reach the client.

Examples:

* Supabase service role key
* API secrets
* Email provider secrets
* AI provider secrets
* private integration credentials

Never import server-only configuration into client components.

---

# 9. Supabase Foundation

Establish the project's Supabase integration.

The implementation should clearly distinguish between:

### Browser client

Used only for operations that are safe and intended for browser execution.

### Server client

Used for server-side authenticated operations.

### Admin/service-role client

If required later, it must be server-only.

Never expose the service-role key to the browser.

---

# 10. Supabase Client Architecture

Centralize Supabase client creation.

Avoid creating ad-hoc Supabase clients throughout components.

Expected architecture may resemble:

```text
src/lib/supabase/
    browser.ts
    server.ts
    admin.ts
```

Only create `admin.ts` if the project actually needs a service-role client.

Use the project's chosen Next.js/Supabase authentication architecture.

---

# 11. Server / Client Boundaries

Establish clear boundaries between:

```text
Server Components
Client Components
Server Actions
Route Handlers
Database access
Browser Supabase client
```

Do not make components client components unnecessarily.

Avoid:

```tsx
"use client";
```

at high-level layout/page boundaries unless genuinely required.

Prefer server rendering where possible.

---

# 12. Folder Architecture

Implement the folder architecture documented in `docs/architecture.md`.

A possible structure:

```text
src/
├── app/
├── components/
├── features/
├── lib/
├── config/
├── hooks/
├── stores/
├── types/
└── utils/
```

The exact structure should follow Phase 00 decisions.

Do not blindly copy this example.

---

# 13. Feature Architecture

Establish conventions for future domain features.

Example:

```text
src/features/
├── auth/
├── patients/
├── practitioners/
├── appointments/
├── clinical-records/
├── prescriptions/
├── documents/
├── notifications/
├── articles/
└── analytics/
```

Do not implement these features yet.

Only establish the architecture if needed.

Future features should be able to contain:

```text
components/
queries.ts
mutations.ts
validation.ts
types.ts
constants.ts
```

Use only files that are genuinely required.

---

# 14. Shared Components Foundation

Do not build the full design system yet.

That belongs to Phase 02.

However, establish the base location and conventions for shared UI components.

For example:

```text
src/components/
```

Provide only minimal infrastructure-level components if required by the existing application.

Do not prematurely create dozens of UI components.

---

# 15. Global Application Layout

Establish the basic application shell.

At minimum:

* root layout
* metadata foundation
* global CSS entry
* page container strategy
* basic body configuration

The application should have a stable shell upon which Phase 02 can build.

Do not attempt to complete the final Punarvasu homepage.

---

# 16. Error Handling Architecture

Create a consistent error-handling strategy.

Errors should have two levels:

### User-facing

Clear, safe messages.

Example:

```text
Something went wrong.
Please try again.
```

### Developer-facing

Useful diagnostic information through secure logging.

Never expose:

* database credentials
* stack traces to normal users
* internal SQL
* secrets
* authentication tokens
* sensitive patient information

---

# 17. Application Error Boundaries

Establish appropriate Next.js error handling.

Support:

* global errors
* route-level errors where appropriate
* not-found pages
* loading boundaries

The exact structure should follow the Next.js version already used by the project.

---

# 18. API Error Convention

If the application uses route handlers/server APIs, establish a consistent response/error convention.

Avoid every endpoint returning a different error shape.

A future API should be able to communicate:

```text
Validation error
Unauthorized
Forbidden
Not found
Conflict
Rate limited
Internal error
```

without exposing implementation details.

---

# 19. Validation Foundation

Establish a consistent validation strategy.

Use the project's chosen validation library if already selected.

Validation should occur at trust boundaries.

Examples:

```text
Browser form
      ↓
Server validation
      ↓
Business logic
      ↓
Database
```

Never rely solely on browser validation.

---

# 20. Type Safety

TypeScript should be configured for strong type safety.

Avoid unnecessary:

```ts
any
```

Do not silence errors with:

```ts
// @ts-ignore
```

unless there is a documented and justified reason.

Prefer explicit types.

---

# 21. Database Type Generation

If using Supabase-generated database types, establish the process for generating/updating them.

The workflow should be documented.

For example:

```text
Database schema
      ↓
Supabase type generation
      ↓
TypeScript
```

Do not manually maintain a duplicate representation of the entire database if generated types can be used.

---

# 22. Database Migration Strategy

Establish reproducible database migrations.

Rules:

* Schema changes must be represented as migrations.
* Do not rely on undocumented manual SQL changes.
* Migration names should be meaningful.
* Destructive changes require careful consideration.
* Production migrations must be reproducible.

Do not create the complete Punarvasu database schema in this phase.

Only establish the migration workflow and minimum foundation required.

---

# 23. Database Access Rules

Future database access should follow these principles:

* Server-side authorization
* RLS
* Least privilege
* Typed queries
* Minimal data retrieval
* No unnecessary `select("*")`

### BAD

```ts
.select("*")
```

when only two fields are required.

### GOOD

```ts
.select("id, name, status")
```

Retrieve only what is needed.

---

# 24. Security Foundation

Establish baseline security practices.

Review:

* security headers where appropriate
* secure cookies
* environment protection
* server/client boundaries
* Supabase key usage
* request validation
* error sanitization
* authorization architecture
* RLS strategy

Do not implement feature-specific permissions yet.

---

# 25. Logging

Create a structured logging approach.

Logs should support:

* development debugging
* production diagnostics
* error tracking

Never log:

* passwords
* access tokens
* service-role keys
* full sensitive patient records
* unnecessary personal information

Logs should contain useful context such as:

```text
timestamp
severity
event
request/context ID
error category
```

where appropriate.

---

# 26. Request / Correlation ID

If appropriate for the application architecture, establish a request/correlation ID mechanism.

This will later help trace:

```text
Patient request
 ↓
Server action
 ↓
Database operation
 ↓
Notification
```

Do not over-engineer this if the project is still small.

---

# 27. Health Check

Create a minimal health-check mechanism.

For example:

```text
/api/health
```

It should indicate whether the application is operational.

Do not expose sensitive infrastructure details.

### BAD

```json
{
  "databaseHost": "...",
  "supabaseKey": "...",
  "environment": "production"
}
```

### GOOD

```json
{
  "status": "ok"
}
```

Keep the response minimal.

---

# 28. Testing Infrastructure

Establish the testing framework required by the project.

Support the ability to write:

### Unit tests

For:

* utilities
* validation
* business logic

### Integration tests

For:

* server logic
* database interactions

### E2E tests

For future critical workflows.

Do not write large feature test suites yet.

---

# 29. Test Utilities

Create reusable test utilities where appropriate.

Examples:

```text
test fixtures
test factories
mock helpers
authentication helpers
database test helpers
```

Do not create test abstractions before there is a genuine repeated need.

---

# 30. Security Testing Foundation

Establish the ability to test authorization later.

Document how tests will verify:

```text
Unauthenticated
Patient
Receptionist
Doctor
Admin
```

against protected resources.

The goal is to make negative authorization tests a normal part of development.

---

# 31. Git & Development Hygiene

Ensure:

* `.gitignore` is correct.
* Environment files containing secrets are ignored.
* Build output is ignored.
* IDE-specific files are handled appropriately.
* Temporary files are not committed.

Review the repository for accidentally committed secrets.

---

# 32. Basic Documentation

Update architecture documentation if implementation decisions changed.

At minimum:

```text
docs/architecture.md
docs/security.md
docs/qa-strategy.md
```

should accurately reflect the implemented foundation.

Do not allow documentation to describe architecture that the code does not actually use.

---

# 33. Bad → Good Examples

## Example 1 — Environment Variables

### BAD

```ts
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

inside a client component.

### GOOD

```text
Client component
      ↓
Browser-safe Supabase client

Server
      ↓
Server Supabase client

Admin operation
      ↓
Server-only admin client
```

---

## Example 2 — Database Access

### BAD

Database query directly inside every UI component.

### GOOD

```text
UI
 ↓
Feature query/action
 ↓
Server/data layer
 ↓
Supabase
```

Keep responsibilities clear.

---

## Example 3 — Error Handling

### BAD

```ts
catch (error) {
  return error.message;
}
```

This can leak internal information.

### GOOD

```text
Internal error
      ↓
Secure log

User
      ↓
Safe generic message
```

---

## Example 4 — Type Safety

### BAD

```ts
const result: any = await fetchSomething();
```

### GOOD

```ts
const result: PatientSummary = await fetchSomething();
```

Use meaningful types.

---

## Example 5 — Client Components

### BAD

Make the entire application client-rendered simply because one interactive component needs state.

### GOOD

Keep the page/server component on the server and isolate interactivity into a small client component.

---

## Example 6 — Configuration

### BAD

```ts
const API_URL = "https://production-api.example.com";
```

### GOOD

```text
Environment configuration
        ↓
Typed config
        ↓
Application
```

---

# 34. UI Expectations

Phase 01 is not a visual-design phase.

The UI only needs to provide a clean technical shell.

It should include:

* basic layout
* readable error pages
* loading boundaries
* not-found page
* health-check route
* basic metadata

Do not spend significant time on:

* homepage visual design
* animations
* treatment cards
* marketing sections
* dashboard styling

Those belong to Phase 02 and later phases.

---

# 35. Expected Files

Actual paths should follow the existing architecture.

Potential files include:

```text
src/
├── app/
│   ├── layout.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   └── api/
│       └── health/
│
├── config/
│   └── env.ts
│
├── lib/
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   └── admin.ts        # only if required
│   ├── errors/
│   └── logger/
│
├── types/
└── utils/

.env.example
.gitignore

docs/
├── architecture.md
├── security.md
└── qa-strategy.md
```

These are examples.

Do not create unnecessary files simply to match this list.

---

# 36. Database Changes

Phase 01 should avoid implementing the full domain schema.

Only create database changes required for infrastructure.

If the project requires an initial migration, document it clearly.

Do not create placeholder business tables merely because future phases will need them.

Future phases should introduce their domain-specific migrations.

---

# 37. Security Tests

At minimum verify:

### Secret exposure

Search the client bundle/source for server-only secrets.

Expected:

```text
Service role key → NOT exposed
Private API secrets → NOT exposed
```

### Environment safety

Verify:

```text
.env.local → ignored
.env → ignored where appropriate
.env.example → contains no secrets
```

### Supabase

Verify:

```text
Browser → browser-safe client
Server → server client
Admin → server-only
```

### Error leakage

Trigger an internal error.

Verify the client does not receive:

* SQL
* stack traces
* secrets
* internal infrastructure details

---

# 38. Acceptance Criteria

Phase 01 is complete only when:

### Project

* [ ] Application starts successfully.
* [ ] Development environment works.
* [ ] Production build succeeds.
* [ ] TypeScript passes.
* [ ] ESLint passes.
* [ ] Formatting is consistent.

### Architecture

* [ ] Folder architecture follows documented conventions.
* [ ] Server/client boundaries are clear.
* [ ] Feature architecture is established.
* [ ] Shared infrastructure locations are established.

### Environment

* [ ] `.env.example` exists.
* [ ] Required variables are documented.
* [ ] Environment validation exists.
* [ ] Secrets are not committed.
* [ ] Server-only variables cannot be imported into client code.

### Supabase

* [ ] Supabase integration works.
* [ ] Browser/server clients are separated.
* [ ] Admin client is server-only if implemented.
* [ ] Database access conventions are documented.
* [ ] Migration workflow is established.

### Error Handling

* [ ] Global error handling exists.
* [ ] Not-found handling exists.
* [ ] Loading boundaries exist.
* [ ] User-facing errors are safe.
* [ ] Developer-facing logging exists.

### Testing

* [ ] Testing framework is configured.
* [ ] At least one representative test passes.
* [ ] Test structure is documented.
* [ ] Security testing strategy is established.

### Health

* [ ] Health-check endpoint exists if appropriate.
* [ ] Health-check response does not expose sensitive information.

### Documentation

* [ ] Architecture documentation matches implementation.
* [ ] Security documentation matches implementation.
* [ ] QA documentation matches implementation.
* [ ] Implementation progress is updated.

---

# 39. Definition of Done

Phase 01 is complete when the project has a stable, secure and maintainable technical foundation.

Specifically:

* The application runs.
* The production build succeeds.
* TypeScript passes.
* Linting passes.
* Testing infrastructure works.
* Supabase integration is cleanly established.
* Environment variables are safely managed.
* Server/client boundaries are understood.
* Error handling is consistent.
* Logging is established.
* Database migration workflow is established.
* Security principles from Phase 00 are reflected in the implementation.
* Documentation accurately describes the actual architecture.
* No business feature from future phases has been prematurely implemented.
* No known critical security issue remains from this phase.

---

# 40. Verification Commands

Use the actual scripts defined by the project.

At minimum, attempt:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If a script does not exist, do not fabricate a successful result.

Instead:

1. Identify the missing script.
2. Determine whether it should be added in this phase.
3. Add it if appropriate.
4. Run it.
5. Report the result.

---

# 41. Phase Completion Report

After implementation provide:

## Summary

What foundation was implemented?

## Repository Changes

Files created and modified.

## Architecture

Important architectural decisions implemented.

## Supabase

How browser/server/admin access is separated.

## Environment

Environment variables added.

## Database

Migrations or database-related changes.

## Security

Security measures implemented and tested.

## Testing

Report:

* Unit: PASS/FAIL/NOT APPLICABLE
* Integration: PASS/FAIL/NOT APPLICABLE
* E2E: PASS/FAIL/NOT APPLICABLE
* TypeScript: PASS/FAIL
* ESLint: PASS/FAIL
* Build: PASS/FAIL

## Acceptance Criteria

Report every criterion as:

```text
PASS
FAIL
NOT APPLICABLE
```

Do not claim PASS without verification.

## Risks

List any technical risks discovered.

## Deferred Work

List functionality intentionally left for later phases.

Do not proceed to Phase 02.
