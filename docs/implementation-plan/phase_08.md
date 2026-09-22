# Phase 08 — Roles & Permissions

## 1. Phase Objective

Establish the secure authorization and role-management foundation for Punarvasu.

Phase 06 established **authentication**:

> Who is this user?

Phase 07 established the **patient profile**:

> What is this patient's application identity?

Phase 08 establishes **authorization**:

> What is this authenticated user allowed to see and do?

The authorization architecture must be secure enough to support the future:

* Patient portal
* Receptionist workspace
* Doctor dashboard
* Admin capabilities
* Appointments
* Clinical records
* Prescriptions
* Patient documents
* Notifications
* Analytics
* AI-assisted clinical workflows

The system must never rely on client-side checks as the security boundary.

The fundamental architecture is:

```text
Supabase Auth
      ↓
Authenticated User
      ↓
Application Identity
      ↓
Assigned Role(s)
      ↓
Permission Policy
      ↓
Server-Side Authorization
      ↓
Database RLS
```

---

# 2. Relationship With Previous Phases

## Phase 06 — Authentication

Authentication answers:

```text
Is this person authenticated?
Who is the authenticated user?
```

Examples:

```text
user.id
user.email
session
```

Authentication does NOT determine what the user is allowed to do.

---

## Phase 07 — Patient Profile

Patient profile answers:

```text
What is this patient's application information?
```

Examples:

```text
full name
phone
date of birth
address
emergency contact
```

---

## Phase 08 — Authorization

Authorization answers:

```text
Is this user a patient?
Is this user a receptionist?
Is this user a doctor?
Is this user an administrator?

Can this user perform this action?
Can this user access this resource?
```

---

## Future Clinical Data

Clinical phases will answer:

```text
What happened medically during care?
```

Examples:

```text
consultation
diagnosis
clinical notes
prescription
treatment plan
documents
```

These must remain separate from role/profile data.

---

# 3. Roles

The initial application roles are:

```text
patient
receptionist
doctor
admin
```

## Patient

Typical future capabilities:

* Manage own profile
* View own appointments
* Request/book appointments
* View own consultation information where appropriate
* View own prescriptions
* View own documents
* View permitted notifications

A patient must never automatically receive staff permissions.

---

## Receptionist

Typical future capabilities:

* Manage appointment operations
* Search permitted patient information
* Manage patient onboarding
* Handle scheduling workflows
* Manage clinic operational tasks

Receptionists must NOT automatically have:

* Doctor privileges
* Clinical authoring privileges
* Admin privileges

---

## Doctor

Typical future capabilities:

* View assigned/permitted patient information
* Conduct consultations
* Create clinical records
* Create prescriptions
* Create treatment plans
* Review patient history
* Access doctor-specific analytics

Doctor permissions must be limited to legitimate clinical workflows.

---

## Admin

Typical capabilities:

* Manage users/roles
* Manage operational configuration
* Access administrative reporting
* Manage staff access
* Perform approved administrative operations

Admin access must be treated as highly privileged.

---

# 4. Role Assignment Philosophy

Users must never be allowed to choose privileged roles during public registration.

For example:

```text
Registration:

Name
Email
Password
Role: Doctor ❌
```

is forbidden.

Public registration should not allow:

```text
patient
doctor
receptionist
admin
```

selection.

A newly registered normal user should receive the appropriate default application role according to the product's onboarding policy.

Staff roles must be assigned through a trusted mechanism.

Examples:

* secure admin workflow
* server-only operation
* controlled migration/bootstrap
* future staff invitation workflow

Do NOT implement a public "Become Admin" or "Become Doctor" mechanism.

---

# 5. Source of Truth

Do not use:

```text
localStorage.role
```

or:

```text
sessionStorage.role
```

or:

```text
user.email === "doctor@example.com"
```

as authorization.

Do not treat arbitrary client-supplied metadata as authoritative.

The authoritative application role must be stored in a server-controlled database structure and enforced by the backend/database.

---

# 6. Recommended Role Data Model

Prefer a dedicated role-assignment structure rather than embedding authorization directly into arbitrary UI state.

Conceptually:

```text
user_roles
------------------------------
id
user_id
role
created_at
updated_at
```

Where:

```text
role ∈ {
  patient,
  receptionist,
  doctor,
  admin
}
```

Recommended constraints:

```text
user_id → auth.users.id
```

and:

```text
UNIQUE(user_id, role)
```

This allows the architecture to support multiple roles later without requiring a database redesign.

For example, future policy could support:

```text
doctor + admin
```

without changing the underlying model.

If the existing project architecture has a well-justified alternative, preserve it only if it provides equivalent security and extensibility.

---

# 7. Role Assignment Rules

The database must prevent invalid roles.

For example:

```text
doctor
Doctor
DOCTOR
superadmin
root
```

must not become uncontrolled role values.

Use a database enum or equivalent constrained representation.

The exact implementation should follow the existing Supabase/PostgreSQL architecture.

---

# 8. Default Patient Role

The normal public registration flow should result in the expected patient/application identity according to the product's onboarding rules.

However:

```text
Authentication user ≠ automatically privileged staff member
```

Do not infer staff privileges from:

* email domain
* email address
* display name
* profile fields
* client-side values

---

# 9. Privileged Role Assignment

Doctor, receptionist, and admin roles must require a trusted operation.

For this phase, it is acceptable to establish the infrastructure for secure assignment without building a complete staff-management UI.

Possible secure mechanisms:

```text
Admin-only server operation
        ↓
Validate acting user's admin permission
        ↓
Validate target user
        ↓
Validate requested role
        ↓
Update user_roles
```

The client must never be able to directly insert:

```text
user_id = another_user
role = admin
```

without server/database authorization.

---

# 10. Authorization Layers

Authorization should exist at multiple layers.

## Layer 1 — UI

UI should hide or disable actions the user cannot use.

Example:

```text
Patient
  └── My Appointments
  └── My Profile
```

A patient should not see:

```text
Admin → Manage Staff
```

However, UI hiding is NOT security.

---

## Layer 2 — Route Authorization

Protected routes should verify the user's role.

Conceptually:

```ts
requireUser()
requireRole("doctor")
requirePermission("clinical_records.write")
```

Unauthorized users should receive an appropriate forbidden response/page.

---

## Layer 3 — Server Authorization

Every sensitive server action/API must verify authorization independently.

Example:

```text
Client
  ↓
Server Action
  ↓
Authenticated User
  ↓
Authorization Check
  ↓
Validated Input
  ↓
Data Access
```

Never trust:

```text
role
userId
permissions
```

sent by the browser.

---

## Layer 4 — Database RLS

Supabase/PostgreSQL RLS is the final database-level enforcement layer.

Even if a developer accidentally exposes a server route incorrectly, RLS should prevent unauthorized rows from being accessed whenever practical.

---

# 11. Route Protection

Establish a reusable route authorization foundation.

Potential protected route groups:

```text
/patient/*
/receptionist/*
/doctor/*
/admin/*
```

The exact routing should match the existing application structure.

Examples:

```text
/patient/profile
```

requires:

```text
authenticated + patient permission
```

Future:

```text
/doctor/dashboard
```

should require:

```text
authenticated + doctor permission
```

Future:

```text
/admin/*
```

should require:

```text
authenticated + admin permission
```

Do not build the future dashboards in this phase.

---

# 12. Forbidden Experience

Create a consistent forbidden state/page such as:

```text
/forbidden
```

or an equivalent route/error experience.

The page should communicate:

> You don't have permission to access this page.

It should provide a useful action such as:

```text
Go to My Account
Return Home
```

Do not expose internal authorization details.

Avoid messages such as:

```text
Required role: admin
Your role: patient
Policy ID: xyz
```

---

# 13. Permission Architecture

Avoid building an unnecessarily complicated enterprise policy engine in this phase.

However, establish a clean permission abstraction so future features do not hard-code role checks everywhere.

Conceptual permissions:

```text
profile.read.self
profile.write.self

appointments.read.self
appointments.manage

patients.search
patients.read

clinical_records.read
clinical_records.write

prescriptions.read
prescriptions.write

documents.read
documents.write

analytics.read

users.manage
roles.manage
```

These permissions are illustrative.

Only implement permissions required by currently existing functionality.

Future permissions can be introduced as new phases add functionality.

---

# 14. Role → Permission Mapping

Establish a centralized policy model.

Conceptually:

```text
patient
  → profile.read.self
  → profile.write.self

receptionist
  → appointments.manage
  → patients.search

doctor
  → patients.read
  → clinical_records.read
  → clinical_records.write

admin
  → users.manage
  → roles.manage
  → analytics.read
```

Do not assume this exact mapping is final.

The implementation must make future changes straightforward.

---

# 15. Authorization Helpers

Create reusable server-side authorization helpers.

Possible API:

```ts
requireUser()
```

```ts
requireRole("doctor")
```

```ts
requireAnyRole(["doctor", "admin"])
```

```ts
requirePermission("clinical_records.write")
```

```ts
hasRole(userId, role)
```

```ts
can(user, permission)
```

The exact names may differ based on the existing architecture.

Important:

Authorization helpers must run on trusted/server execution paths.

They must never be the only security mechanism for database access.

---

# 16. Resource-Level Authorization

Role-level authorization alone is insufficient.

For example:

```text
Patient A
Patient B
```

Both have:

```text
role = patient
```

Patient A must not be able to access:

```text
Patient B's profile
```

Therefore authorization must distinguish:

```text
Can this role perform this action?
```

from:

```text
Can this user perform this action on this specific resource?
```

This becomes especially important for:

* Patient profiles
* Appointments
* Clinical records
* Prescriptions
* Documents

RLS and ownership checks must enforce resource-level access.

---

# 17. Patient Ownership

Preserve the Phase 07 ownership model.

A patient should only access their own patient profile.

Conceptually:

```sql
auth.uid() = user_id
```

Do not weaken existing RLS policies while introducing role logic.

---

# 18. Staff Access

Do not grant broad access merely because a user is authenticated.

Do not implement:

```text
authenticated → all patient data
```

Instead:

```text
authenticated
    ↓
role
    ↓
permission
    ↓
resource-level policy
```

Future clinical phases will define more detailed doctor/receptionist access.

---

# 19. RLS Design

Review and update relevant Supabase RLS policies.

Policies should ensure:

### Patient

Can access:

```text
own permitted records
```

Cannot access:

```text
other patients' records
staff-only resources
admin resources
```

### Receptionist

Can access only explicitly permitted operational resources.

### Doctor

Can access only explicitly permitted clinical resources.

### Admin

Can access explicitly authorized administrative resources.

Do not create a blanket:

```sql
USING (true)
```

policy for sensitive tables.

---

# 20. Avoid Recursive RLS Problems

If RLS policies query role tables, carefully design helper functions/policies to avoid:

* recursive policy evaluation
* permission deadlocks
* unexpected privilege escalation
* expensive repeated role queries

If a PostgreSQL helper function is used for authorization, it must be carefully scoped and must not become an unrestricted privilege bypass.

Document the chosen approach.

---

# 21. Service Role Safety

The Supabase service-role key bypasses normal RLS protections.

Therefore:

```text
service role
```

must only be used in trusted server-side code when genuinely required.

Never:

```text
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
```

Never expose the service-role key to:

* browser bundles
* client components
* public APIs
* logs
* error messages

Prefer normal authenticated Supabase access with RLS whenever possible.

---

# 22. Role Management UI

Do not build a complete staff-management application in this phase unless the existing project requires it.

The primary objective is authorization infrastructure.

A minimal development/admin mechanism may be provided if necessary to test role assignment.

If such an interface is implemented:

* it must be protected
* only authorized admins can use it
* role values must be constrained
* target users must be validated
* actions must be server-authorized
* privilege escalation must be prevented

---

# 23. Role-Aware Navigation

Introduce authorization-aware navigation where useful.

Example:

### Patient

```text
Home
Services
Appointments
My Profile
```

### Doctor

```text
Dashboard
Patients
Appointments
Clinical Records
```

### Receptionist

```text
Dashboard
Appointments
Patients
```

### Admin

```text
Dashboard
Users
Settings
Reports
```

Only include destinations that actually exist.

Do not create fake links to future phases.

---

# 24. Middleware / Server Guard Philosophy

If middleware is used, it should provide early routing protection and a good UX.

However:

```text
Middleware ≠ complete authorization
```

Sensitive operations must still perform server-side authorization.

Correct:

```text
Middleware
  ↓
Route protection

Server action/API
  ↓
Authorization

Database
  ↓
RLS
```

---

# 25. Security Requirements

This phase has a particularly high security bar.

Prevent:

### Privilege escalation

A patient must not become:

```text
admin
doctor
receptionist
```

through browser manipulation.

---

### IDOR

A patient must not access another patient's resources by changing:

```text
/user/123
/user/456
```

or request payload IDs.

---

### Client role spoofing

This must never work:

```js
localStorage.setItem("role", "admin")
```

followed by gaining admin functionality.

---

### Email-based authorization

This must never be used:

```ts
if (user.email === "doctor@punarvasu.com") {
   // doctor access
}
```

---

### Request body role injection

This must never be trusted:

```json
{
  "userId": "victim",
  "role": "admin"
}
```

unless a trusted authorization layer independently verifies the acting user and operation.

---

# 26. Sensitive Error Handling

Do not expose internal authorization details.

Bad:

```text
Postgres policy "admin_manage_users" failed
```

Good:

```text
You don't have permission to perform this action.
```

Server logs may contain useful diagnostic context, but never:

* passwords
* access tokens
* refresh tokens
* service-role keys
* OTPs
* sensitive patient information unnecessarily

---

# 27. Audit Considerations

Role changes are security-sensitive.

At minimum, document that future production auditing should capture:

```text
actor
target user
previous role
new role
timestamp
result
```

If the current architecture already contains an appropriate audit mechanism, integrate role changes with it.

Do not build a large audit subsystem unless required by the existing project scope.

Full security/privacy audit hardening belongs to Phase 19.

---

# 28. UI/UX Requirements

Authorization experiences should still feel like Punarvasu.

Do not create generic:

```text
403 Forbidden
```

screens with no context.

Use the existing Punarvasu design system.

The experience should be:

* calm
* clear
* professional
* accessible
* reassuring
* concise

Unauthorized users should understand what happened without being exposed to internal implementation details.

---

# 29. Accessibility

Authorization UI must support:

* keyboard navigation
* visible focus
* semantic buttons/links
* screen-reader-friendly labels
* sufficient contrast
* meaningful error messages
* responsive layouts

Do not rely solely on:

```text
color
icons
```

to communicate permission state.

---

# 30. Responsive Requirements

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

Role-aware navigation and forbidden states must work correctly on mobile.

---

# 31. Performance Requirements

Avoid unnecessary client-side authorization state.

Prefer:

```text
server-side identity
server-side authorization
RLS
```

over downloading all permissions to the browser.

Do not make the entire application a client component merely to determine the user's role.

---

# 32. SEO / Privacy

Private role-specific routes must not be indexed.

Ensure:

```text
/patient/*
/doctor/*
/receptionist/*
/admin/*
```

are treated as private application surfaces.

Do not expose:

* patient names
* roles
* internal IDs
* staff information
* private data

through public metadata.

---

# 33. Few-Shot Examples

## Example 1 — Client Role

### Bad

```ts
const role = localStorage.getItem("role");

if (role === "admin") {
  showAdminPanel();
}
```

### Good

```text
UI uses server-derived authorization state.

Sensitive operation:
Client
 → Server
 → authenticate user
 → authorize role/permission
 → database
 → RLS
```

---

## Example 2 — Email Check

### Bad

```ts
if (user.email === "doctor@punarvasu.com") {
  return true;
}
```

### Good

```ts
await requirePermission("clinical_records.write");
```

with the permission ultimately backed by trusted role data and database enforcement.

---

## Example 3 — Role Injection

### Bad

```ts
await createUser({
  ...formData,
  role: formData.role
});
```

### Good

```text
Public registration
 → create normal user/application identity
 → assign permitted default role

Staff role
 → trusted server/admin operation
 → validate target
 → validate role
 → authorize actor
 → update role
```

---

## Example 4 — Patient ID

### Bad

```ts
getPatientProfile(searchParams.get("patientId"));
```

without checking ownership/authorization.

### Good

```text
Authenticated user
 → authorization check
 → ownership/resource policy
 → permitted patient record
```

with RLS enforcing the database boundary.

---

## Example 5 — UI Security

### Bad

```text
Hide the Admin button
→ Assume patient cannot access admin functionality
```

### Good

```text
Hide Admin button
+
Protect Admin route
+
Authorize server action
+
Enforce database RLS
```

---

## Example 6 — Forbidden State

### Bad

```text
403
You are role=patient and need role=admin.
```

### Good

```text
You don't have permission to access this page.

Return to your account
```

---

# 34. Expected Architectural Areas

Adapt names to the existing repository, but the implementation should establish appropriate equivalents for:

```text
src/
  lib/
    auth/
    authorization/
    supabase/

  server/
    auth/
    authorization/

  config/
    permissions/
    roles/

  components/
    auth/
    authorization/

  app/
    forbidden/
```

Potential database migration:

```text
supabase/migrations/
  ..._create_user_roles.sql
```

Potential tests:

```text
authorization tests
RLS tests
route protection tests
privilege escalation tests
```

Do not blindly create every directory listed above if the existing project architecture uses a better structure.

Consistency with Phase 01 is more important than following a literal folder list.

---

# 35. Testing Requirements

At minimum, test:

## Authentication

* unauthenticated user cannot access protected routes
* authenticated user can access permitted routes

## Patient

* patient can access own permitted area
* patient cannot access another patient's resources
* patient cannot access doctor-only routes
* patient cannot access receptionist-only routes
* patient cannot access admin routes

## Receptionist

* receptionist can access permitted operational functionality
* receptionist cannot access admin-only functionality
* receptionist cannot perform doctor-only clinical operations unless explicitly permitted

## Doctor

* doctor can access permitted clinical functionality
* doctor cannot automatically perform admin-only operations

## Admin

* admin can access explicitly permitted administration

## Role Assignment

* normal users cannot assign themselves staff roles
* patient cannot assign another user a role
* non-admin cannot promote a user to admin
* invalid roles are rejected
* duplicate role assignment is prevented

## Security

Test attempts to manipulate:

```text
userId
role
permission
resourceId
```

from the client.

All such attempts must be rejected when unauthorized.

---

# 36. Cross-User RLS Test

This test is mandatory.

Create:

```text
User A
User B
```

Both should have valid application identities.

Verify:

```text
User A → own permitted data → ALLOWED
User A → User B's protected data → DENIED
```

Do not consider a UI-level failure sufficient.

The database/RLS boundary must enforce the restriction.

---

# 37. Acceptance Criteria

Phase 08 is complete only when:

### Role Model

* [ ] Roles are explicitly defined.
* [ ] Role values are constrained.
* [ ] Role assignment has a trusted source of truth.
* [ ] Duplicate role assignment is prevented.
* [ ] Role assignment cannot be controlled by public registration.

### Authorization

* [ ] Authentication and authorization are clearly separated.
* [ ] Reusable server-side authorization helpers exist.
* [ ] Role/permission checks are centralized.
* [ ] Resource-level authorization is supported.
* [ ] Client-side state is never the security boundary.

### Routing

* [ ] Protected application routes have authorization foundations.
* [ ] Role-specific route access is enforced.
* [ ] Unauthorized users receive a safe forbidden experience.
* [ ] No future feature routes are fabricated.

### Database

* [ ] Role storage is implemented securely.
* [ ] Appropriate foreign keys/constraints exist.
* [ ] RLS policies are implemented/reviewed.
* [ ] Existing Phase 07 ownership policies continue to work.
* [ ] Cross-user access is denied at the database boundary.

### Security

* [ ] No localStorage/sessionStorage role authorization.
* [ ] No email-based privileged authorization.
* [ ] No client-controlled role assignment.
* [ ] No service-role key exposure.
* [ ] No sensitive authorization information leaked to users.
* [ ] Privilege escalation tests pass.
* [ ] IDOR/cross-user tests pass.

### UX

* [ ] Navigation can respond to authorization state.
* [ ] Forbidden experience uses the Punarvasu design system.
* [ ] Mobile layouts work.
* [ ] Accessibility requirements are satisfied.

### Engineering

* [ ] TypeScript remains strict.
* [ ] No unnecessary `any`.
* [ ] No unnecessary client components.
* [ ] Existing functionality remains intact.
* [ ] Lint passes.
* [ ] Typecheck passes.
* [ ] Tests pass.
* [ ] Production build passes.

---

# 38. Definition of Done

Phase 08 is done when Punarvasu has a production-quality authorization foundation where:

```text
Authenticated User
       ↓
Application Role
       ↓
Permission
       ↓
Server Authorization
       ↓
Database RLS
```

is the trusted security model.

A malicious user must not be able to gain privileges simply by modifying:

```text
browser state
request payload
URL
user ID
role
permission
```

The patient profile functionality from Phase 07 must continue working securely.

The codebase must be ready for:

```text
Phase 09 — Appointment Engine
```

without requiring a redesign of the authorization architecture.

---

# 39. Explicitly Out of Scope

Do NOT implement:

* Appointment booking/calendar
* Appointment CRUD
* Doctor dashboard
* Receptionist dashboard
* Clinical records
* Prescriptions
* Treatment plans
* Patient documents
* Notifications
* Analytics
* AI
* Payments
* Telemedicine
* Full staff-management product
* Full audit/compliance subsystem

Those belong to later phases.

---

# 40. Final Verification

Before declaring the phase complete, verify:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Use the project's actual scripts if names differ.

Also manually verify:

```text
Unauthenticated
Patient
Receptionist
Doctor
Admin
```

against representative protected routes and operations.

Then perform adversarial tests:

```text
Can patient become admin?
Can patient access another patient?
Can receptionist access admin?
Can doctor perform admin-only operation?
Can client modify role?
Can URL manipulation bypass authorization?
Can request-body manipulation bypass authorization?
Can browser storage modification bypass authorization?
```

All unauthorized attempts must fail.

---

# 41. Completion Report

At the end of the phase, report:

### Implemented

* Role model
* Permission model
* Authorization helpers
* Route guards
* RLS changes
* Forbidden experience
* Role-aware navigation
* Tests

### Database

* migrations
* tables
* enums
* indexes
* constraints
* policies

### Security Verification

* privilege escalation results
* IDOR/cross-user results
* RLS results
* service-role exposure verification

### Verification

```text
Lint:
Typecheck:
Tests:
Build:
```

### Deferred

List anything intentionally deferred to later phases.

### Phase Status

```text
Phase 08: COMPLETE
Ready for Phase 09: YES/NO
```

Do not begin Phase 09 during this phase.
