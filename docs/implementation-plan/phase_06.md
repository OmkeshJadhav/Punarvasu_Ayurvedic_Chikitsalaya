# Phase 06 — Authentication & Identity Foundation

## Objective

Implement a secure, production-quality authentication and identity foundation for Punarvasu using the authentication architecture established in Phase 01.

This phase introduces the first authenticated application experience.

The primary goals are:

* allow users to create an account
* allow users to sign in securely
* maintain authenticated sessions
* allow users to sign out
* support email verification
* support password reset
* support OTP/magic-link authentication where appropriate
* protect authenticated routes
* establish a reliable authenticated-user context
* handle authentication errors safely
* prepare the application for role-based authorization in Phase 08

The implementation must prioritize:

* security
* predictable session behavior
* good UX
* accessibility
* type safety
* server/client separation
* secure redirect handling
* extensibility

---

# 1. Authentication Philosophy

Authentication answers:

> Who is this user?

Authorization answers:

> What is this user allowed to do?

Phase 06 focuses primarily on authentication.

Do not build the complete role/permission system in this phase.

That belongs primarily to:

```text
Phase 08 — Roles & Permissions
```

However, Phase 06 must expose enough identity information for Phase 08 to build authorization safely.

---

# 2. Read Before Implementation

Before coding, read:

* `agent.md`
* `docs/product-spec.md`
* `docs/architecture.md`
* `docs/security.md`
* `docs/qa-strategy.md`
* `docs/implementation-progress.md`
* `phases/phase_00.md`
* `phases/phase_01.md`
* `phases/phase_02.md`
* `phases/phase_03.md`
* `phases/phase_04.md`
* `phases/phase_05.md`
* this file

Then inspect:

* existing Supabase setup
* browser Supabase client
* server Supabase client
* middleware/proxy implementation
* environment validation
* route structure
* error handling
* UI form primitives
* notification/toast system
* loading states
* existing layouts

Do not replace existing infrastructure without understanding why it exists.

---

# 3. Authentication Provider

Use the authentication provider selected in the architecture, expected to be:

> Supabase Auth

Use the project's established Supabase integration.

Do not introduce another authentication provider unless the architecture explicitly requires it.

---

# 4. Authentication Methods

The primary authentication flow should support:

### Email + Password

```text
Registration
    ↓
Email verification
    ↓
Login
    ↓
Authenticated session
```

Additionally, support OTP/magic-link authentication if it is part of the approved product requirements.

The implementation should not create multiple confusing authentication paths.

---

# 5. Recommended Auth Routes

Use a clean structure such as:

```text
/auth
├── login
├── register
├── verify
├── forgot-password
├── reset-password
└── callback
```

The exact routing architecture may vary depending on the Next.js/Supabase implementation.

Do not create unnecessary routes.

---

# 6. Login Page

Recommended route:

```text
/auth/login
```

The login experience should include:

* email
* password
* show/hide password
* remember/session behavior if supported
* login button
* forgot password link
* registration link
* OTP/magic-link option if enabled

Example:

```text
Welcome back

Sign in to continue to Punarvasu.

Email
[____________________]

Password
[____________________] [Show]

[Sign In]

Forgot password?

────────────────────

New to Punarvasu?
[Create an Account]
```

Keep the page visually consistent with the Punarvasu design system.

---

# 7. Registration Page

Recommended route:

```text
/auth/register
```

The initial registration form should collect only information required for account creation.

Recommended:

* full name
* email
* password
* confirm password
* acceptance of required terms/privacy policy

Optional:

* phone number

Do not collect detailed medical information during account registration.

---

# 8. Registration Philosophy

Registration should be simple.

Do not ask for:

* symptoms
* diagnosis
* medications
* detailed medical history
* treatment history
* sensitive health information

unless there is a separately designed and justified secure workflow.

Those belong to patient onboarding/profile flows in later phases.

---

# 9. Password Requirements

Define password requirements clearly.

At minimum:

* minimum appropriate length
* confirmation
* rejection of obviously invalid passwords

Do not unnecessarily impose overly complicated composition rules unless required by the security policy.

Prefer modern password guidance emphasizing length and resistance to common passwords.

---

# 10. Password UI

Show password requirements near the password field.

Example:

```text
Password

At least 8 characters
```

The exact requirement must match the actual authentication configuration.

Do not display requirements that the backend does not enforce.

---

# 11. Password Visibility

Provide a show/hide control.

Requirements:

* accessible button
* meaningful accessible label
* does not submit the form
* works with keyboard

Example accessible labels:

```text
Show password
Hide password
```

---

# 12. Email Verification

After registration, users should be guided through email verification.

Example:

```text
Check your email

We've sent a verification link to
user@example.com.

Please verify your email to continue.

[Resend Email]
[Back to Sign In]
```

Do not imply that the account is fully ready for sensitive authenticated functionality before verification if the application requires verified email.

---

# 13. Email Verification UX

Support:

* verification success
* expired link
* already-used link
* invalid link
* resend verification
* return to login

Error messages should be understandable.

Do not expose internal Supabase errors.

---

# 14. Email Verification Redirect

The verification flow must redirect to a controlled application URL.

Never trust an arbitrary URL supplied through query parameters.

Use an allowlisted/default redirect strategy.

---

# 15. Auth Callback

Implement the Supabase auth callback flow required by the selected authentication architecture.

The callback must safely handle:

* authorization code exchange
* email verification
* password reset
* magic links/OTP if enabled

Do not expose authentication tokens unnecessarily.

---

# 16. Redirect Security

This is a critical requirement.

Do NOT blindly do:

```ts
redirect(searchParams.get("next"));
```

because this can create an open redirect vulnerability.

Instead:

* allow only known internal paths
* reject external origins
* provide a safe default
* normalize paths where appropriate

Example concept:

```text
/auth/login?next=/patient/dashboard
```

may be allowed.

But:

```text
/auth/login?next=https://malicious-site.example
```

must not be allowed.

---

# 17. Forgot Password

Recommended route:

```text
/auth/forgot-password
```

The page should contain:

```text
Forgot your password?

Enter your email and we'll send you
instructions to reset your password.

Email
[________________]

[Send Reset Link]

[Back to Sign In]
```

---

# 18. Forgot Password Privacy

Avoid revealing whether an email address belongs to a registered user.

Prefer a neutral response such as:

> If an account exists for this email address, reset instructions have been sent.

This reduces account enumeration risk.

---

# 19. Password Reset

Recommended route:

```text
/auth/reset-password
```

The user should be able to:

* enter a new password
* confirm password
* submit securely

Validate the authentication state/token before allowing the password update.

---

# 20. Reset Password States

Handle:

### Valid

```text
Create a new password
```

### Expired

```text
This password reset link has expired.

[Request a New Link]
```

### Invalid

```text
This password reset link is no longer valid.

[Request a New Link]
```

Do not expose raw provider errors.

---

# 21. OTP / Magic Link

If enabled by the product architecture, support a passwordless flow.

Potential UX:

```text
Sign in with email

Email
[________________]

[Send Sign-in Code]

We'll send a secure sign-in link/code
to your email.
```

Keep this separate enough that users understand which method they are using.

Do not implement OTP merely because it is technically available if it creates unnecessary UX complexity.

---

# 22. OTP Security

If OTP is implemented:

* never log OTP codes
* never store OTPs manually unless absolutely necessary
* rely on Supabase Auth for OTP lifecycle
* handle expiry
* handle retry limits
* handle invalid codes
* handle excessive attempts
* avoid account enumeration

---

# 23. Logout

Authenticated users must have a clear logout action.

Logout should:

* invalidate the session
* clear relevant client state
* redirect to a safe public route
* prevent access to protected pages using stale UI state

Recommended destination:

```text
/
```

or:

```text
/auth/login
```

depending on UX.

---

# 24. Session Management

The application must use Supabase's session management correctly.

Requirements:

* server-side session awareness
* browser session awareness where necessary
* session refresh according to Supabase's recommended Next.js architecture
* no manually copied auth tokens in local storage unless the provider explicitly requires it

Do not create a custom authentication/session system on top of Supabase.

---

# 25. Server Authentication

Server-side code must be able to determine the current authenticated user securely.

Conceptually:

```ts
const user = await getCurrentUser();
```

or equivalent.

The implementation should centralize this behavior.

Do not scatter authentication logic across dozens of server components.

---

# 26. Client Authentication

Client-side UI may need to react to auth state.

Examples:

* authenticated navigation
* logout button
* session-aware controls

However:

> Client-side authentication state must never be treated as the final security boundary.

Server-side authorization remains authoritative.

---

# 27. Auth Context

If a React auth provider/context is introduced, keep it lightweight.

It may expose:

* current user
* loading state
* authentication status

Avoid putting all application data into the auth context.

Do not use auth context as a replacement for server-side authorization.

---

# 28. Current User

The application should have a single reliable way to obtain:

```text
current authenticated user
```

Potential abstraction:

```ts
getCurrentUser()
```

or:

```ts
requireUser()
```

depending on the architecture.

---

# 29. `requireUser` Behavior

A protected server-side route may conceptually do:

```ts
const user = await requireUser();
```

If unauthenticated:

```text
redirect("/auth/login");
```

Do not allow protected data to render first and then redirect on the client.

---

# 30. Protected Routes

Establish a protected-route mechanism.

At minimum, create the foundation for routes such as:

```text
/patient/*
/dashboard/*
```

or the architecture chosen by the project.

The actual patient dashboard can be implemented later.

---

# 31. Protected Route Test

Unauthenticated access:

```text
/patient/profile
```

should result in:

```text
/auth/login
```

or the project's intended login route.

Authenticated access should proceed.

---

# 32. Middleware / Proxy

Use the existing Next.js middleware/proxy architecture where appropriate for session handling and lightweight route protection.

Do not put complex authorization rules entirely into middleware.

Database-backed authorization should remain server-side and centralized.

---

# 33. Authentication vs Authorization

The implementation must maintain this separation:

```text
Authentication
       ↓
Who are you?
       ↓
Supabase user

Authorization
       ↓
What can you access?
       ↓
Role / permissions / RLS
```

Phase 06 implements the first part.

Phase 08 will significantly expand the second.

---

# 34. User Profile Foundation

Do not build the full patient profile in Phase 06.

However, the architecture should allow the authenticated Supabase user to later map to an application profile.

Conceptually:

```text
auth.users
    ↓
application profile
    ↓
patient / receptionist / doctor / admin
```

The exact database design should follow the architecture established in Phase 00.

---

# 35. Do Not Trust Client Metadata for Identity

Never use client-provided values such as:

```text
userId
role
email
```

as the authoritative identity.

Identity must come from the authenticated Supabase session.

---

# 36. User ID

When querying user-specific data later:

Use the authenticated user's trusted ID.

Do not accept arbitrary:

```text
?userId=...
```

as the source of authorization.

---

# 37. Role Preparation

If role information exists in the architecture, expose it through a secure server-side mechanism.

Do not allow:

```text
localStorage.role = "admin"
```

to determine authorization.

Do not implement client-side role switching.

---

# 38. Auth-Aware Navigation

Update the public navigation to support authenticated state.

Unauthenticated:

```text
[Sign In] [Book a Consultation]
```

Authenticated:

```text
[My Account]
[Sign Out]
```

The exact navigation should be consistent with the product architecture.

---

# 39. Navigation Behavior

Authenticated navigation must not reveal sensitive information.

Do not display:

```text
Welcome, John
Patient ID: P-12345
Diagnosis: ...
```

in the public header.

Keep sensitive information inside protected experiences.

---

# 40. Authenticated Landing

After login, redirect the user to the correct safe destination.

For example:

```text
Normal login
    ↓
Authenticated landing page

Login initiated from protected page
    ↓
Return to original internal page
```

Use the safe redirect mechanism established earlier.

Do not redirect users to arbitrary external URLs.

---

# 41. Unauthenticated Behavior

When a user tries to access protected functionality:

```text
Protected route
       ↓
Not authenticated
       ↓
Login
       ↓
Successful authentication
       ↓
Original safe destination
```

Avoid losing the user's intended destination unnecessarily.

---

# 42. Already Authenticated Behavior

If an authenticated user visits:

```text
/auth/login
/auth/register
```

consider redirecting them to their authenticated landing page.

Do not create confusing duplicate login states.

---

# 43. Form UX

All authentication forms must use the form/validation components established in Phase 02.

Support:

* labels
* validation
* errors
* loading state
* disabled submit during request
* accessible status messages

---

# 44. Authentication Errors

Never display raw provider/database errors.

### BAD

```text
AuthApiError: invalid login credentials
```

### GOOD

```text
The email or password is incorrect.
Please check your details and try again.
```

Use neutral messages where revealing more information could aid enumeration.

---

# 45. Error Mapping

Create a centralized approach for mapping authentication errors to safe user-facing messages.

Conceptually:

```text
Supabase error
      ↓
Error mapper
      ↓
Safe UI message
```

Do not duplicate error-string logic across every form.

---

# 46. Login Error

Avoid unnecessarily revealing whether an account exists.

Preferred:

> The email or password is incorrect.

Avoid:

> No account exists with this email.

unless there is a deliberate product/security reason.

---

# 47. Registration Error

Handle:

* invalid email
* weak password
* existing account
* rate limit
* network failure
* provider failure

The UX should be helpful without unnecessarily exposing account existence.

---

# 48. Rate Limiting / Abuse

Authentication endpoints are abuse-sensitive.

Use Supabase's built-in protections where available.

Do not implement an unnecessary custom rate-limiting system if Supabase already handles the relevant protection.

Document:

* provider-side limits
* application-side controls
* future requirements

---

# 49. Brute Force Considerations

Do not build a custom mechanism that accidentally weakens Supabase's authentication protections.

The application should:

* avoid repeated uncontrolled requests
* disable submit during active request
* handle rate-limit responses gracefully
* not reveal sensitive account information

---

# 50. CAPTCHA

Do not automatically add CAPTCHA.

Only introduce CAPTCHA/Turnstile if:

* abuse requires it
* the architecture approves it
* UX impact is justified

Document the decision.

---

# 51. Email Provider

Authentication emails depend on Supabase's configured email provider.

The application should not assume a particular provider unless already configured.

Document any setup requirements.

---

# 52. Redirect URLs

Document required Supabase redirect URLs for:

* local development
* preview deployments
* production

Do not hardcode localhost URLs into production logic.

---

# 53. Environment Variables

Use the environment architecture from Phase 01.

Never expose:

* Supabase service-role key
* private server credentials
* email provider secrets

Public Supabase configuration may be exposed only according to the established Supabase architecture.

---

# 54. Authentication Secrets

Never:

* commit secrets
* print secrets in logs
* expose secrets in client bundles
* return secrets through API responses

---

# 55. Session Cookie Security

Follow the Supabase/Next.js recommended session architecture.

Verify:

* secure cookie behavior in production
* appropriate same-site behavior
* HTTPS assumptions
* session refresh behavior
* no unnecessary token exposure

Do not manually implement insecure cookie handling.

---

# 56. CSRF Considerations

Follow the framework/provider's recommended authentication flow.

For any custom state-changing server action or endpoint:

* validate the request
* use appropriate framework protections
* do not trust arbitrary origins
* avoid unnecessary custom authentication endpoints

---

# 57. Password Reset Security

Password reset links must:

* expire
* be validated by Supabase
* not expose reset tokens unnecessarily
* not be logged

Never include reset tokens in application analytics.

---

# 58. Auth Callback Security

The callback route must:

* validate authentication state
* safely exchange codes
* use allowed redirects
* avoid token leakage
* handle invalid/expired codes gracefully

---

# 59. Loading States

Authentication forms must provide clear loading states.

Example:

```text
[Signing in...]
```

The user should not be able to accidentally submit the same request repeatedly.

---

# 60. Network Failure

If authentication fails due to connectivity:

```text
We couldn't reach the authentication service.
Please check your connection and try again.
```

Do not expose infrastructure details.

---

# 61. Accessibility

Authentication must be fully accessible.

Requirements:

* proper labels
* keyboard navigation
* visible focus
* logical tab order
* accessible error messages
* accessible password visibility control
* sufficient contrast
* screen-reader-friendly status updates

---

# 62. Form Error Accessibility

Errors should be associated with the relevant field.

Example:

```text
Email

Please enter a valid email address.
```

The user should not have to visually search for the error.

---

# 63. Mobile Authentication

Test authentication on:

```text
320px
375px
390px
430px
```

Forms should:

* fit without horizontal scrolling
* use comfortable touch targets
* keep submit actions visible
* avoid unnecessary visual clutter
* work correctly with mobile keyboards

---

# 64. Desktop Authentication

Authentication pages should feel like part of Punarvasu.

Avoid:

```text
Generic SaaS login template
```

Instead use:

* Punarvasu branding
* calm typography
* restrained imagery
* clear hierarchy
* generous whitespace

---

# 65. Auth Page Layout

A possible layout:

```text
┌──────────────────────────────────────────────┐
│                                              │
│   Punarvasu          Authentication Card     │
│                                              │
│   Calm brand        Welcome back             │
│   visual            Sign in to continue      │
│                                              │
│                     Email                    │
│                     Password                 │
│                     [Sign In]                │
│                                              │
│                     Forgot password?         │
│                                              │
└──────────────────────────────────────────────┘
```

Do not copy this literally.

The actual design should follow the Phase 02 system.

---

# 66. Auth Layout

Create a reusable authentication layout if multiple auth pages share the same structure.

Potential:

```text
src/app/auth/layout.tsx
```

Do not duplicate:

* logo
* background
* card structure
* legal links

across every auth page.

---

# 67. Legal Links

Registration should link to:

* Privacy Policy
* Terms

if these routes exist.

The links must be accessible.

Do not require users to agree to policies that do not exist.

---

# 68. Account Creation Confirmation

After registration, show a clear next step.

Example:

```text
Account created

Check your email to verify your account.

[Back to Sign In]
```

Do not automatically assume the email is verified.

---

# 69. Resend Verification

Provide a resend mechanism where supported.

Requirements:

* prevent uncontrolled repeated requests
* handle rate limits
* show success/failure feedback
* do not expose sensitive account existence information unnecessarily

---

# 70. Session Expiration

If an authenticated session expires:

The user should receive a graceful authentication prompt rather than an unexplained error.

Potential:

```text
Your session has expired.
Please sign in again.
```

If returning to a protected route, preserve the safe internal destination where appropriate.

---

# 71. Multiple Tabs

The auth experience should behave reasonably when users:

* sign in in one tab
* sign out in another
* reset their password elsewhere

Use Supabase's supported session/auth state mechanisms.

Do not create an independent custom session state that becomes stale.

---

# 72. Browser Refresh

Verify:

```text
Login
 ↓
Refresh
 ↓
Still authenticated
```

where the session remains valid.

Also verify:

```text
Logout
 ↓
Refresh protected route
 ↓
Unauthenticated
```

---

# 73. Back Button

Test:

```text
Login
 ↓
Authenticated page
 ↓
Logout
 ↓
Back
```

The user must not regain access to protected content simply through browser history.

Sensitive protected pages should be protected at the server level.

---

# 74. Caching Security

Protected content must not be accidentally cached as publicly accessible content.

Review:

* server rendering
* route caching
* static generation
* browser caching where relevant

Do not statically generate user-specific pages.

---

# 75. Authentication Data

Do not put sensitive user information into:

* URLs
* page titles
* public metadata
* analytics events
* logs
* client-visible error messages

---

# 76. Logging

Authentication logs should be useful but safe.

Log events such as:

* authentication failure category
* callback failure
* unexpected provider failure

Do not log:

* passwords
* OTPs
* reset tokens
* access tokens
* refresh tokens

---

# 77. Auditability

Phase 06 does not need the full audit-log system.

However, document authentication events that should eventually be auditable, such as:

* account creation
* login
* logout
* password reset
* email change
* suspicious authentication activity

Phase 19 will harden audit/security architecture further.

---

# 78. Testing Strategy

Authentication requires both unit and integration/E2E testing.

Do not rely only on component tests.

---

# 79. Unit Tests

Test:

* email validation
* password validation
* password confirmation
* redirect validation
* safe redirect helper
* auth error mapping
* form state

---

# 80. Integration Tests

Where feasible, test:

* Supabase auth interaction
* session retrieval
* logout
* callback
* password reset flow

Use appropriate test environments.

Do not use production credentials.

---

# 81. E2E Tests

At minimum cover:

### Registration

```text
Open registration
↓
Enter valid details
↓
Submit
↓
Verification guidance appears
```

### Login

```text
Open login
↓
Enter credentials
↓
Submit
↓
Authenticated landing
```

### Logout

```text
Authenticated
↓
Logout
↓
Public/auth page
↓
Protected route blocked
```

### Forgot password

```text
Forgot password
↓
Enter email
↓
Submit
↓
Neutral confirmation
```

### Protected route

```text
Unauthenticated
↓
Protected route
↓
Redirect to login
```

---

# 82. Negative Tests

Test:

* invalid email
* invalid password
* mismatched password
* empty fields
* expired verification
* invalid verification
* expired reset link
* invalid reset link
* invalid callback
* malicious redirect
* repeated submission
* network failure

---

# 83. Open Redirect Test

Explicitly test:

```text
/auth/login?next=https://example.com
```

Expected:

```text
Do NOT redirect externally.
```

Test internal:

```text
/auth/login?next=/patient/profile
```

Expected:

```text
Safe internal redirect.
```

---

# 84. Authorization Boundary Test

Verify that client-side manipulation cannot turn:

```text
patient
```

into:

```text
admin
```

and gain access.

The detailed role/RLS implementation belongs to Phase 08/19, but Phase 06 must not introduce an insecure role mechanism.

---

# 85. Security Checklist

Verify:

* [ ] no secrets in client bundle
* [ ] no service-role key in browser
* [ ] no password logging
* [ ] no OTP logging
* [ ] no token logging
* [ ] safe redirects
* [ ] server-side authentication
* [ ] protected routes
* [ ] safe error messages
* [ ] session refresh works
* [ ] logout invalidates access
* [ ] protected pages are not publicly cached
* [ ] client auth state is not treated as authorization

---

# 86. Few-Shot Quality Examples

## Example 1 — Login error

### BAD

```text
User not found.
```

### GOOD

```text
The email or password is incorrect.
Please check your details and try again.
```

---

## Example 2 — Redirect

### BAD

```ts
redirect(searchParams.get("next")!)
```

### GOOD

```text
Validate that the destination is an
allowed internal path before redirecting.
```

---

## Example 3 — Authentication

### BAD

```text
Store userId in localStorage
and treat it as authenticated identity.
```

### GOOD

```text
Supabase session
      ↓
Trusted authenticated user
      ↓
Server-side identity
```

---

## Example 4 — Role

### BAD

```ts
if (localStorage.getItem("role") === "admin") {
  showAdmin();
}
```

### GOOD

```text
Authenticated user
       ↓
Server-side role lookup
       ↓
Authorization check
       ↓
Allowed resource
```

The full role system comes in Phase 08.

---

## Example 5 — Password reset

### BAD

```text
Email does not exist.
```

### GOOD

```text
If an account exists for this email address,
reset instructions have been sent.
```

---

## Example 6 — Password storage

### BAD

```text
Save password in profiles table.
```

### GOOD

```text
Supabase Auth manages credentials.

Application profile stores
non-authentication profile information.
```

---

## Example 7 — Client security

### BAD

```text
Hide the admin page using React
and assume that protects it.
```

### GOOD

```text
Server-side authentication/authorization
protects the resource.

Client UI only reflects the result.
```

---

# 87. Expected Files

Actual paths must follow the existing architecture.

Potential structure:

```text
src/
├── app/
│   └── auth/
│       ├── layout.tsx
│       ├── login/
│       │   └── page.tsx
│       ├── register/
│       │   └── page.tsx
│       ├── forgot-password/
│       │   └── page.tsx
│       ├── reset-password/
│       │   └── page.tsx
│       ├── verify/
│       │   └── page.tsx
│       └── callback/
│           └── route.ts
│
├── components/
│   └── auth/
│       ├── login-form.tsx
│       ├── register-form.tsx
│       ├── password-field.tsx
│       ├── forgot-password-form.tsx
│       └── ...
│
├── features/
│   └── auth/
│       ├── actions/
│       ├── queries/
│       ├── validation/
│       ├── errors/
│       └── types/
│
└── lib/
    └── auth/
        ├── current-user.ts
        ├── require-user.ts
        └── redirect.ts
```

These are examples.

Do not blindly create every file.

Follow the actual project architecture.

---

# 88. Database Scope

Do not introduce unnecessary application tables during this phase.

If Phase 00 architecture already defines a profile table or identity mapping, implement only what is required for authentication integration.

Patient-specific profile fields belong to Phase 07.

---

# 89. Supabase Auth Configuration

Document any configuration required in Supabase:

* Site URL
* redirect URLs
* email confirmation settings
* password reset redirect
* OTP settings if enabled

Do not commit provider secrets.

---

# 90. Local Development

Authentication should work correctly in local development.

Document:

```text
localhost URL
Supabase redirect URL
email verification flow
password reset flow
```

Avoid hardcoding local URLs into production code.

---

# 91. Preview Deployment

If the project uses preview deployments:

Ensure the authentication architecture does not assume only:

```text
http://localhost:3000
```

Redirect configuration should support the approved preview strategy.

---

# 92. Production Readiness

Before considering Phase 06 complete, verify:

* production URL strategy
* HTTPS assumptions
* email redirects
* session behavior
* logout
* password reset
* verification
* error handling

---

# 93. Performance

Authentication pages should be lightweight.

Avoid:

* unnecessary large images
* unnecessary client dependencies
* loading the complete application dashboard
* excessive animation

The auth experience should load quickly.

---

# 94. Motion

Use Phase 02 motion sparingly.

Good:

* subtle form appearance
* verification state transition
* password field interaction

Avoid:

* dramatic animations
* animated backgrounds
* excessive page transitions

Respect reduced motion.

---

# 95. SEO

Authentication pages generally should not be indexed.

Configure appropriate metadata/indexing behavior.

Conceptually:

```text
/auth/login
/auth/register
/auth/forgot-password
/auth/reset-password
```

should not become search-engine landing pages.

Follow the project's SEO architecture.

---

# 96. Robots / Indexing

Ensure private/authentication flows are not unnecessarily indexed.

Do not rely solely on `robots.txt` for access control.

Authentication is a security mechanism, not an SEO mechanism.

---

# 97. Acceptance Criteria

## Registration

* [ ] Registration page exists.
* [ ] Required fields are validated.
* [ ] Password confirmation works.
* [ ] User can submit valid registration.
* [ ] Email verification flow is supported.
* [ ] Verification instructions are clear.
* [ ] Sensitive medical information is not collected.

## Login

* [ ] Login page exists.
* [ ] Email/password login works.
* [ ] Password visibility toggle works.
* [ ] Invalid credentials are handled safely.
* [ ] Loading state works.
* [ ] Authenticated redirect works.

## Email Verification

* [ ] Verification callback works.
* [ ] Valid verification works.
* [ ] Invalid/expired verification is handled.
* [ ] Resend flow works where supported.
* [ ] Redirect is safe.

## Password Reset

* [ ] Forgot-password page exists.
* [ ] Neutral response prevents unnecessary account enumeration.
* [ ] Reset flow works.
* [ ] Expired/invalid links are handled.
* [ ] New password validation works.

## Session

* [ ] Session survives browser refresh where valid.
* [ ] Server can identify authenticated user.
* [ ] Logout works.
* [ ] Logout prevents protected access.
* [ ] Session refresh works according to provider architecture.

## Protected Routes

* [ ] Unauthenticated users cannot access protected routes.
* [ ] Authenticated users can access intended protected foundation routes.
* [ ] Redirect preserves safe internal destination where appropriate.
* [ ] External redirect destinations are rejected.

## Security

* [ ] No secrets exposed.
* [ ] No service-role key in client.
* [ ] No passwords logged.
* [ ] No tokens logged.
* [ ] No OTPs logged.
* [ ] Client state is not treated as authorization.
* [ ] Protected content is not publicly cached.
* [ ] Auth errors are safely mapped.

## UX

* [ ] Auth pages match Punarvasu design system.
* [ ] Forms are responsive.
* [ ] Mobile experience works.
* [ ] Error states are understandable.
* [ ] Loading states are clear.

## Accessibility

* [ ] Labels are associated with fields.
* [ ] Keyboard navigation works.
* [ ] Focus states are visible.
* [ ] Errors are accessible.
* [ ] Password toggle is accessible.
* [ ] Screen-reader status updates work where appropriate.
* [ ] Contrast is acceptable.

## SEO

* [ ] Auth pages are appropriately excluded from indexing.
* [ ] No sensitive information appears in metadata.

---

# 98. Definition of Done

Phase 06 is complete when Punarvasu has a secure and polished authentication foundation that later phases can safely depend on.

A user should be able to:

```text
Register
   ↓
Verify email
   ↓
Login
   ↓
Maintain session
   ↓
Access protected area
   ↓
Logout
```

and:

```text
Forgot password
   ↓
Receive reset instructions
   ↓
Reset password
   ↓
Login again
```

The implementation must:

* use Supabase Auth
* follow the Phase 01 Supabase architecture
* maintain server/client boundaries
* have safe redirect handling
* provide protected-route infrastructure
* have accessible forms
* provide good error/loading states
* avoid account enumeration where practical
* avoid collecting sensitive health information
* avoid exposing authentication secrets/tokens
* be responsive
* be performant
* be testable
* pass linting
* pass type checking
* pass tests
* pass production build

---

# 99. Verification Commands

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Additionally perform:

* registration flow test
* email verification test
* login test
* logout test
* password reset test
* protected route test
* safe redirect test
* session refresh test
* browser back-button test
* mobile responsive test
* accessibility test

Do not report PASS without actually verifying.

---

# 100. Final Implementation Report

After implementation report:

## Summary

What was implemented?

## Authentication

List supported authentication methods.

## Routes

List all authentication routes.

## Session

Explain session handling.

## Protected Routes

Explain the protection mechanism.

## Redirect Security

Explain safe redirect handling.

## Supabase

List required Supabase configuration.

## Security

Report:

* secret handling
* token handling
* error handling
* session handling
* redirect validation

## Accessibility

Report checks performed.

## Responsive

Report tested viewport sizes.

## Tests

Report:

```text
TypeScript: PASS/FAIL
ESLint: PASS/FAIL
Unit: PASS/FAIL
Integration: PASS/FAIL
E2E: PASS/FAIL
Accessibility: PASS/FAIL
Build: PASS/FAIL
```

## Acceptance Criteria

Report every criterion.

## Known Issues

List actual issues.

## Deferred Work

Explicitly list items deferred to later phases.

Do not proceed to Phase 07.
