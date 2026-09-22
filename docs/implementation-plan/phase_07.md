# Phase 07 — Patient Profile & Onboarding

## Objective

Build the authenticated Patient Profile and onboarding experience for Punarvasu.

This phase takes the authenticated identity established in Phase 06 and creates the application's patient-facing profile layer.

The goal is to allow a patient to:

* complete their profile
* view their profile
* edit permitted personal information
* manage contact details
* provide basic demographic information
* manage emergency contact information where appropriate
* understand profile completeness
* maintain their personal information securely

This phase must establish a clean boundary between:

> Personal/profile information

and:

> Clinical/medical information.

Clinical history, consultation notes, diagnoses, prescriptions, treatment plans, and other medical records belong to later phases.

---

# 1. Core Principle

The patient profile is **not the medical record**.

Use this separation:

```text
Authentication
    │
    ▼
Supabase Auth User
    │
    ▼
Patient Profile
    │
    ├── Personal information
    ├── Contact information
    ├── Demographics
    └── Emergency contact
         
Clinical Records
    │
    ├── Medical history
    ├── Consultations
    ├── Diagnoses
    ├── Prescriptions
    └── Treatment plans
```

Do not mix these domains.

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
* `phases/phase_06.md`
* this file

Then inspect:

* Supabase schema
* existing migrations
* authentication implementation
* current-user helper
* protected-route infrastructure
* server/client boundaries
* form components
* validation utilities
* error handling
* loading states
* navigation
* existing dashboard/application shell

Do not create a second authentication mechanism.

---

# 3. Scope

Implement:

* patient profile data model
* patient profile creation/onboarding
* patient profile view
* patient profile edit
* profile completeness
* contact information management
* basic demographic information
* emergency contact where appropriate
* profile validation
* profile authorization
* secure server-side data access
* patient dashboard/profile navigation foundation
* responsive UI
* accessibility
* loading/error/empty states
* appropriate audit considerations
* database migrations
* RLS policies
* tests

---

# 4. Explicitly NOT Included

Do not implement:

* medical history
* diagnoses
* consultation records
* prescriptions
* treatment plans
* doctor notes
* clinical attachments
* appointment booking
* appointment calendar
* doctor dashboard
* receptionist dashboard
* admin management
* notifications
* analytics
* AI
* treatment recommendations
* payments

Those belong to later phases.

---

# 5. Patient Profile Route

Preferred route:

```text id="q7s8r1"
/patient/profile
```

If the application architecture uses a different authenticated-area convention, follow the established architecture.

---

# 6. Patient Onboarding

After first successful authentication, the application should be able to determine whether the patient has completed the minimum profile information required by the product.

Conceptually:

```text id="3trf8x"
Login
  ↓
Authenticated user
  ↓
Patient profile exists?
  ├── No → Profile onboarding
  └── Yes → Patient area
```

Do not automatically assume every authenticated user is a patient.

Role handling will be formalized further in Phase 08.

---

# 7. Profile Creation

The initial profile should collect only information necessary for the patient experience.

Potential fields:

### Required

* full name

### Optional

* preferred name
* phone
* date of birth
* gender/sex where genuinely required
* address
* city
* state
* postal code
* emergency contact name
* emergency contact phone
* preferred language

The exact fields should follow the product specification and privacy requirements.

Do not collect information merely because it might be useful someday.

---

# 8. Sensitive Information Boundary

Do NOT collect in the profile:

* diagnosis
* symptoms
* medications
* allergies
* detailed medical history
* previous treatments
* lab results
* prescriptions

unless explicitly required by the approved product architecture.

Those belong to secure clinical workflows.

---

# 9. Profile Model

Use a typed application profile model.

Conceptual example:

```ts id="2w8i4e"
type PatientProfile = {
  id: string;
  userId: string;
  fullName: string;
  preferredName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  preferredLanguage?: string;
  createdAt: string;
  updatedAt: string;
};
```

Adapt to the actual schema.

Do not blindly copy this model.

Avoid `any`.

---

# 10. Identity Relationship

The profile must be linked to the authenticated Supabase user.

Conceptually:

```text id="p0l1u8"
auth.users.id
      │
      ▼
patient_profiles.user_id
```

The relationship must be enforced appropriately at the database level.

Do not rely solely on frontend logic to associate a profile with a user.

---

# 11. User ID Security

Never accept a client-provided `userId` as the authority for profile ownership.

### BAD

```text id="xj5v67"
/patient/profile?userId=another-user
```

and then querying that ID.

### GOOD

```text id="bqj3v9"
Authenticated Supabase session
          ↓
Trusted user ID
          ↓
Profile belonging to that user
```

---

# 12. Profile Ownership

A patient must only be able to:

* view their own profile
* update their own profile

They must not be able to:

* view another patient's profile
* modify another patient's profile
* enumerate patient profiles

This must be enforced at the database/RLS layer, not only in React.

---

# 13. RLS

Enable appropriate Row Level Security for patient profile data.

Conceptually:

```text id="y5qg3p"
Patient
   ↓
SELECT own profile
   ↓
UPDATE own profile
```

and:

```text id="9yn6j3"
Patient A
   X
Patient B's profile
```

must fail.

Do not implement broad public read access.

---

# 14. Insert Policy

Profile creation should ensure that:

```text id="p5p0lo"
profile.user_id
==
authenticated user ID
```

Do not allow a client to create a profile belonging to another user.

---

# 15. Update Policy

Profile update must ensure:

```text id="e9a3r4"
auth.uid()
==
profile.user_id
```

Use the database's authorization mechanisms.

---

# 16. Delete Policy

Do not automatically implement patient profile deletion unless explicitly required.

Healthcare-related data can have retention/legal implications.

If deletion is not part of the product requirements:

* do not expose a Delete Account button
* document that account/data deletion requires a later privacy workflow

---

# 17. Profile Page Structure

Recommended:

```text id="0zj8v3"
Patient Area
   ↓
Profile
   ├── Personal Information
   ├── Contact Information
   ├── Address
   ├── Emergency Contact
   └── Account Information
```

Keep the UI calm and easy to scan.

Do not make it look like a giant enterprise form.

---

# 18. Profile Header

Example:

```text id="k1m4q0"
My Profile

Keep your personal information
up to date for a smoother Punarvasu experience.

Profile completeness
████████░░ 80%
```

The actual design should follow Phase 02.

---

# 19. Profile Completeness

Provide a useful completeness indicator if the product benefits from it.

Example:

```text id="j5m2ka"
Profile completeness
80%

Add your phone number
```

Do not pressure users to provide unnecessary information.

Completeness should be based on genuinely useful fields.

---

# 20. Completeness Rules

Define completeness centrally.

For example:

```text id="x8qk6a"
Required:
- full name

Recommended:
- phone
- date of birth
- address
```

The exact rules should come from the product requirements.

Do not mark sensitive optional information as mandatory simply to reach 100%.

---

# 21. Personal Information Section

Possible fields:

```text id="o0x2af"
Full name
Preferred name
Date of birth
Gender/sex where required
Preferred language
```

Use appropriate labels.

---

# 22. Contact Information Section

Possible fields:

```text id="4o3h2k"
Email
Phone
```

Email should generally be treated as authentication identity rather than freely editable profile text.

---

# 23. Email Changes

Do not implement unrestricted email changes through a normal profile update.

If email change is supported:

* use Supabase Auth's email-change mechanism
* require appropriate confirmation
* clearly communicate the process

If not required in this phase, keep email read-only.

---

# 24. Phone Number

If phone is collected:

* validate format
* normalize where appropriate
* clearly indicate whether it is required
* do not assume it is verified

Do not display a "Verified" badge unless verification actually exists.

---

# 25. Address

If address is collected, use structured fields:

```text id="y0r8kd"
Address Line 1
Address Line 2
City
State
Postal Code
```

Do not use one giant free-text field if structured address information will be needed later.

---

# 26. Indian Address Considerations

The primary clinic audience may be in India.

Support appropriate Indian address formats without unnecessarily restricting international users.

Do not hardcode:

```text id="z1q6t8"
State = Maharashtra
```

or assume every patient is from one city.

---

# 27. Date of Birth

If collected:

* use a valid date input strategy
* validate realistic dates
* prevent future dates
* handle timezone carefully
* avoid calculating age incorrectly around timezone boundaries

Store dates in an appropriate date representation.

Do not store DOB as a display-formatted string if database date semantics are required.

---

# 28. Age

Do not store age as a permanent profile field if it can be derived from date of birth.

Avoid:

```text id="3s1p4x"
age: 34
```

because it becomes stale.

Derive age when needed.

---

# 29. Gender/Sex

Only collect this information if there is a clear product or clinical requirement.

If collected:

* use an appropriate field definition
* avoid unnecessary assumptions
* make the purpose clear where useful

Do not collect sensitive demographic information simply because it is common in forms.

---

# 30. Emergency Contact

If implemented, collect:

* name
* relationship if required
* phone

Keep this separate from the patient's own contact details.

Do not imply that an emergency contact is monitored by Punarvasu.

---

# 31. Emergency Contact Disclaimer

The application should make it clear that:

> Emergency contact information is stored for patient-related administrative purposes and is not an emergency response service.

The exact wording should be reviewed for production.

---

# 32. Profile Editing

Profile editing should support:

```text id="9u8r7w"
View
  ↓
Edit
  ↓
Validate
  ↓
Save
  ↓
Success
```

Do not make every field permanently editable.

---

# 33. Edit UX

Use clear actions:

```text id="3q7p9f"
[Edit Profile]
```

then:

```text id="7l2s8v"
[Cancel] [Save Changes]
```

Avoid ambiguous actions such as:

```text id="w2p8e6"
[Submit]
```

---

# 34. Unsaved Changes

If the form is dirty and the user attempts to leave:

Consider warning them about unsaved changes.

Do not create an intrusive confirmation dialog for every navigation.

Use the browser/framework capabilities appropriately.

---

# 35. Save Behavior

During save:

```text id="7y8n3d"
[Saving...]
```

Prevent duplicate submissions.

After success:

```text id="n4r5e6"
Your profile has been updated.
```

Do not reset unrelated application state.

---

# 36. Optimistic Updates

Do not use optimistic updates for sensitive profile information unless there is a strong UX reason and rollback is reliable.

Prefer:

```text id="5m1q9r"
Submit
  ↓
Server validates
  ↓
Database update
  ↓
Refresh trusted state
```

for simplicity and correctness.

---

# 37. Validation

Validate profile fields on:

* client
* server

Client validation is for UX.

Server validation is authoritative.

---

# 38. Validation Rules

Examples:

### Name

* required
* reasonable length
* no uncontrolled HTML

### Email

* valid format
* authentication identity should be handled through Supabase Auth

### Phone

* reasonable length
* appropriate format

### Date of birth

* valid date
* not future
* reasonable bounds

### Postal code

* appropriate format based on supported geography

Adapt these rules to the actual product requirements.

---

# 39. Input Sanitization

Do not render profile fields as HTML.

If a user enters:

```text id="c9j3w1"
<script>alert('x')</script>
```

it must be treated as text.

Never use unsafe HTML rendering for profile data.

---

# 40. Profile Display

When showing profile information:

Use readable sections:

```text id="r7c2v9"
Personal Information
────────────────────
Full name       ...
Date of birth   ...
Language        ...

Contact
────────────────────
Email           ...
Phone           ...

Address
────────────────────
...
```

Avoid an unstructured dump of database fields.

---

# 41. Sensitive Data Display

Do not unnecessarily display:

* internal user IDs
* Supabase UUIDs
* database IDs
* internal metadata
* authentication tokens
* internal timestamps

---

# 42. Account Information

If useful, show:

```text id="z2m8k1"
Email
Account created
```

But only show information useful to the patient.

Do not expose internal identifiers.

---

# 43. Patient ID

If a patient identifier is introduced by the architecture:

* generate it server-side
* ensure uniqueness
* do not allow users to edit it
* do not expose internal database IDs

If patient IDs are not required yet, do not create them prematurely.

---

# 44. Profile Picture

Do not implement profile picture upload unless explicitly required.

If implemented:

* use secure storage
* validate file type/size
* avoid executable content
* use private/public bucket architecture appropriately

Patient document/file storage belongs primarily to Phase 14.

---

# 45. Profile API / Server Actions

Use the architecture established in Phase 01.

Conceptually:

```text id="s1v6a4"
UI
 ↓
Server Action / Route Handler
 ↓
Validation
 ↓
Authenticated user
 ↓
Data layer
 ↓
Supabase
```

Do not query Supabase directly from arbitrary UI components.

---

# 46. Data Access

Centralize patient-profile operations.

Potential:

```text id="d9w3x7"
getPatientProfile()
createPatientProfile()
updatePatientProfile()
```

Use the project's established naming conventions.

---

# 47. `getPatientProfile`

Must always scope the query to the authenticated user.

Do not accept arbitrary user IDs from the client.

---

# 48. `updatePatientProfile`

Must:

1. authenticate the request
2. validate input
3. determine trusted user identity
4. update only permitted fields
5. return safe data
6. handle errors safely

---

# 49. Field Allowlist

Do not blindly update every field supplied by the client.

### BAD

```ts id="h7k4n1"
update(profileFromRequest)
```

### GOOD

```text id="k9q2w4"
Validated allowed fields
       ↓
Server-side update
```

This prevents accidental or malicious modification of protected fields.

---

# 50. Protected Fields

The client must not be able to modify:

* `user_id`
* profile ID
* created timestamp
* role
* authorization fields
* internal audit fields

unless the architecture explicitly allows it.

---

# 51. Role Fields

Do not put editable role fields in the patient profile.

Never allow:

```text id="m4p8z2"
role = "admin"
```

from the patient UI.

Role management belongs to Phase 08.

---

# 52. RLS + Server Checks

Use defense in depth:

```text id="k3r7s2"
Authentication
      ↓
Server-side identity
      ↓
Server validation
      ↓
RLS
      ↓
Data
```

Do not rely on only one layer.

---

# 53. Profile Creation Race Conditions

Handle cases where:

* two requests attempt profile creation
* user refreshes onboarding
* network retry occurs

Use database constraints and idempotent behavior where appropriate.

There should be at most one patient profile associated with a user.

---

# 54. Database Constraints

Where appropriate, enforce:

* unique `user_id`
* not-null required fields
* valid relationships
* timestamps

Do not rely only on TypeScript types.

---

# 55. Database Migration

Create the required migration using the project's migration conventions.

The migration should include:

* profile table
* indexes where justified
* foreign key to authenticated user if appropriate
* unique constraint
* RLS
* policies

Do not modify unrelated tables.

---

# 56. Profile Table Naming

Follow the schema naming conventions established in Phase 00.

A possible name:

```text id="c1d7f3"
patient_profiles
```

Use the actual architecture if a different name was established.

---

# 57. Timestamps

Track:

```text id="w7k4v1"
created_at
updated_at
```

Prefer database-managed timestamps where appropriate.

Do not trust client-supplied timestamps.

---

# 58. Updated Timestamp

When profile data changes:

```text id="y6p2r9"
updated_at
```

should reflect the actual update.

Do not allow the client to set arbitrary timestamps.

---

# 59. Profile Completeness Calculation

Prefer calculating completeness from known rules rather than storing a mutable percentage.

### BAD

```text id="d5h8q2"
profile_completion = 82
```

### GOOD

```text id="q3w7m1"
Required/recommended fields
        ↓
calculate completeness
```

This prevents stale percentages.

---

# 60. Patient Dashboard Foundation

A lightweight patient area shell may be introduced.

Potential navigation:

```text id="z4k8m2"
My Account
├── Overview
├── Profile
└── future features
```

Do not implement the full patient dashboard yet.

---

# 61. Patient Area Layout

The authenticated patient area should feel different from the public marketing site while retaining Punarvasu branding.

Possible:

```text id="h8s2n5"
Punarvasu
────────────────────────────────
Patient Area

Overview | Profile

                         Account
────────────────────────────────
```

Use the Phase 02 design system.

---

# 62. Desktop Patient Navigation

Use a clear navigation structure.

Do not expose future sections as non-functional links unless the architecture explicitly supports placeholders.

---

# 63. Mobile Patient Navigation

Mobile navigation should:

* be easy to open
* have clear active state
* provide logout
* remain accessible
* not overwhelm the screen

---

# 64. Profile Loading State

While loading:

Use a structured skeleton.

Avoid:

```text id="u4r7m9"
Loading...
```

across the whole screen.

---

# 65. Profile Empty State

If no profile exists:

```text id="e2v6q1"
Complete your Punarvasu profile

Add a few details to make your
experience smoother.

[Complete Profile]
```

---

# 66. Profile Error State

If profile retrieval fails:

```text id="n8c3p5"
We couldn't load your profile.

Please try again.

[Try Again]
```

Do not expose database/provider errors.

---

# 67. Save Error

If saving fails:

```text id="m7q2x8"
We couldn't save your changes.
Please try again.
```

Preserve the user's entered values where practical.

---

# 68. Success Feedback

Use the established toast/notification pattern.

Example:

> Profile updated successfully.

Do not use excessive animation or intrusive modal dialogs.

---

# 69. Accessibility

Profile forms must support:

* labels
* keyboard navigation
* focus states
* field descriptions
* error associations
* screen-reader-friendly status messages
* appropriate input types
* accessible buttons

---

# 70. Date Input Accessibility

Ensure date-of-birth input is usable with:

* keyboard
* screen readers
* mobile devices

Do not depend exclusively on a custom date-picker widget if native input provides better accessibility.

---

# 71. Error Accessibility

Validation errors should be:

* visible
* associated with fields
* understandable
* announced appropriately where necessary

---

# 72. Responsive Design

Test:

```text id="s9w2k4"
320px
375px
390px
430px
768px
1024px
1280px
1440px
1920px+
```

---

# 73. Mobile Form Layout

On mobile:

* one-column layout
* comfortable spacing
* appropriate input height
* clear section headings
* sticky/fixed action bars only if useful

Avoid cramped multi-column forms.

---

# 74. Desktop Form Layout

Use grouping to reduce cognitive load.

Example:

```text id="c8m2n6"
Personal Information

[Full Name]        [Preferred Name]
[Date of Birth]    [Gender]

Contact Information

[Email]            [Phone]

Address

[Address Line 1]
[Address Line 2]
[City] [State] [Postal Code]
```

Only include fields actually required.

---

# 75. Privacy UX

Explain why information may be requested where useful.

For example:

> Your phone number helps the clinic contact you regarding your appointments.

Only say this if the product actually uses the phone number for that purpose.

---

# 76. Data Minimization

The principle for Phase 07:

> Collect the minimum personal information needed to provide the intended patient experience.

Do not create a huge "patient registration form" containing every imaginable field.

---

# 77. No Clinical Data

The following should NOT appear in the Phase 07 profile form:

```text id="n3k8p2"
Symptoms
Diagnosis
Current medications
Allergies
Medical history
Previous treatments
Lab reports
Prescription
```

These belong to clinical workflows.

---

# 78. Audit Considerations

Profile changes may eventually need auditability.

Document important events such as:

* profile created
* profile updated
* sensitive contact information changed

The complete audit system will be strengthened in Phase 19.

Do not build an unnecessarily complex audit platform in this phase.

---

# 79. Logging

Never log:

* complete patient profile
* phone number unnecessarily
* address unnecessarily
* date of birth unnecessarily
* authentication tokens

Log only what is needed for debugging/operations.

---

# 80. Error Logging

Technical details may be logged securely on the server.

User-facing responses must remain generic.

### BAD

```text id="7q1m8x"
PostgrestError: duplicate key value violates unique constraint...
```

### GOOD

```text id="m2k8p4"
We couldn't create your profile.
Please try again.
```

---

# 81. Caching

Patient-specific profile pages must not be publicly cached.

Be careful with:

* Next.js caching
* server component caching
* client query caching

User-specific data must always be associated with the correct authenticated session.

---

# 82. Browser Storage

Do not store sensitive profile information unnecessarily in:

```text id="z5p9k2"
localStorage
sessionStorage
```

Use server/session-backed data architecture.

---

# 83. URL Security

Do not put profile information into URLs.

Avoid:

```text id="q3x8m7"
/patient/profile?name=John&dob=...
```

URLs may be logged or shared.

---

# 84. Authorization Preparation

Phase 07 should make the later role system easy to introduce.

The architecture should support:

```text id="n7q3k5"
Authenticated User
      ↓
Application Profile
      ↓
Role
      ↓
Patient-specific permissions
```

Do not hardcode the patient role into authorization logic everywhere.

---

# 85. Few-Shot Quality Examples

## Example 1 — Profile vs medical history

### BAD

```text id="h3k9m2"
Patient Profile

Name
Phone
Diagnosis
Medications
Allergies
Symptoms
Previous treatments
```

### GOOD

```text id="r8q2m6"
Patient Profile

Personal Information
Contact Information
Address
Emergency Contact
```

Clinical information belongs in the clinical-record workflow.

---

## Example 2 — Ownership

### BAD

```text id="q7m4x1"
/patient/profile?userId=abc
```

and use `abc` directly.

### GOOD

```text id="k2n8p5"
Authenticated session
      ↓
auth.uid()
      ↓
patient_profiles.user_id
```

---

## Example 3 — Role

### BAD

```text id="w4m8q2"
Patient edits:
Role: admin
```

### GOOD

```text id="p6x2n9"
Role is controlled by the
authorization system, not the profile form.
```

---

## Example 4 — Profile completion

### BAD

```text id="e7k2m4"
Store:
profile_completion = 73
```

### GOOD

```text id="x3p8q1"
Calculate completeness from
defined required/recommended fields.
```

---

## Example 5 — Profile error

### BAD

```text id="m4q8s2"
PostgREST error 23505
```

### GOOD

```text id="n7p3x9"
We couldn't save your profile.
Please try again.
```

---

## Example 6 — Data minimization

### BAD

```text id="y2m6q8"
100-field patient registration form.
```

### GOOD

```text id="r4x8p2"
Collect only information required
for the intended patient experience.
```

---

## Example 7 — Email

### BAD

Make email an ordinary editable profile field.

### GOOD

Treat authentication email as an auth identity and use the Supabase Auth email-change process if email changes are eventually supported.

---

# 86. Expected Files

Actual paths must follow the architecture established in previous phases.

Potential structure:

```text id="s7m3q9"
src/
├── app/
│   └── patient/
│       ├── layout.tsx
│       ├── page.tsx
│       └── profile/
│           └── page.tsx
│
├── components/
│   └── patient/
│       ├── patient-shell.tsx
│       ├── profile-form.tsx
│       ├── profile-section.tsx
│       ├── profile-summary.tsx
│       └── profile-completeness.tsx
│
├── features/
│   └── patient/
│       ├── profile/
│       │   ├── actions/
│       │   ├── queries/
│       │   ├── validation/
│       │   ├── types/
│       │   └── ...
│       └── ...
│
└── lib/
    └── ...
    
supabase/
└── migrations/
    └── ...
```

These are examples.

Do not blindly create every file.

Follow the established architecture.

---

# 87. Database Expected Structure

A possible conceptual table:

```text id="d4n7x2"
patient_profiles
────────────────────────────
id
user_id
full_name
preferred_name
phone
date_of_birth
gender
address_line_1
address_line_2
city
state
postal_code
emergency_contact_name
emergency_contact_phone
preferred_language
created_at
updated_at
```

Adapt to actual requirements.

Do not add fields simply because they appear in this example.

---

# 88. Indexes

Add indexes only where justified.

At minimum, uniqueness/lookup by authenticated user should be efficient.

Avoid premature indexing.

---

# 89. Migration Safety

Do not modify or drop existing production-relevant structures unnecessarily.

If the database already contains a profile table:

* inspect it first
* reuse it if appropriate
* create a migration only for required changes

---

# 90. API Security

If route handlers/server actions are used:

* authenticate
* validate input
* use trusted identity
* enforce ownership
* return safe response objects
* handle errors safely

---

# 91. No Admin Override Yet

Do not implement:

```text id="k2p8m4"
Admin can edit every patient profile
```

in Phase 07.

Admin/receptionist access belongs to the role/permission architecture in Phase 08 and subsequent staff phases.

---

# 92. No Doctor Access Yet

Do not allow doctors to browse patient profiles simply because they are authenticated.

Doctor access will be defined through:

* roles
* permissions
* clinical relationships
* RLS
* later clinical workflows

---

# 93. Patient Profile Privacy

A patient's profile should be private by default.

Do not create public profile URLs.

Do not include patient information in public SEO metadata.

---

# 94. SEO

Patient profile pages must not be indexed.

Configure appropriate metadata/indexing behavior.

Do not expose patient information through:

* title
* description
* Open Graph
* structured data

---

# 95. Performance

Patient profile pages should be lightweight.

Avoid:

* large background images
* unnecessary animations
* excessive client-side libraries

The primary goal is fast and reliable profile editing.

---

# 96. Motion

Use subtle motion only:

* section transitions
* save state
* profile completeness
* navigation

Respect reduced motion.

---

# 97. Acceptance Criteria

## Profile

* [ ] Authenticated patient can access profile.
* [ ] Unauthenticated user cannot access profile.
* [ ] Profile can be created.
* [ ] Profile can be viewed.
* [ ] Profile can be edited.
* [ ] Profile updates persist.
* [ ] Profile data is associated with the authenticated user.
* [ ] User cannot modify another user's profile.

## Data

* [ ] Data model is typed.
* [ ] Required fields are defined.
* [ ] Validation exists.
* [ ] Server-side validation exists.
* [ ] Database constraints exist where appropriate.
* [ ] `user_id` cannot be changed by the client.
* [ ] Internal fields cannot be modified by the client.

## Security

* [ ] RLS enabled.
* [ ] Own-profile SELECT policy works.
* [ ] Own-profile UPDATE policy works.
* [ ] Own-profile INSERT policy works.
* [ ] Cross-user access fails.
* [ ] No sensitive profile data is exposed publicly.
* [ ] No sensitive profile data is unnecessarily logged.
* [ ] No profile data is placed in URLs.
* [ ] Patient pages are not publicly cached.

## UX

* [ ] Patient shell is implemented.
* [ ] Profile sections are clear.
* [ ] Edit mode is clear.
* [ ] Save/cancel actions are clear.
* [ ] Loading state exists.
* [ ] Error state exists.
* [ ] Success feedback exists.
* [ ] Empty/onboarding state exists where necessary.
* [ ] Profile completeness works if implemented.

## Validation

* [ ] Name validation.
* [ ] Phone validation where collected.
* [ ] DOB validation where collected.
* [ ] Address validation where collected.
* [ ] Emergency contact validation where collected.
* [ ] Malicious input is safely handled.

## Accessibility

* [ ] All fields have labels.
* [ ] Keyboard navigation works.
* [ ] Focus states are visible.
* [ ] Errors are accessible.
* [ ] Buttons are semantic.
* [ ] Status messages are accessible.
* [ ] Mobile form is usable.

## Responsive

* [ ] 320px works.
* [ ] 375px works.
* [ ] 390px works.
* [ ] 430px works.
* [ ] Tablet works.
* [ ] Desktop works.
* [ ] Large desktop works.
* [ ] No horizontal overflow.

## Architecture

* [ ] Uses Phase 06 authentication.
* [ ] Uses established server/client boundaries.
* [ ] Uses centralized data access.
* [ ] Does not duplicate auth logic.
* [ ] Does not implement role authorization prematurely.

## SEO

* [ ] Patient pages are not indexable.
* [ ] No patient information appears in public metadata.

---

# 98. Definition of Done

Phase 07 is complete when an authenticated patient can securely establish and maintain their personal Punarvasu profile.

The final experience should support:

```text id="m8q3x7"
Register/Login
      ↓
Patient Area
      ↓
Complete Profile
      ↓
View Profile
      ↓
Edit Profile
      ↓
Save Changes
```

The implementation must:

* use Phase 06 authentication
* securely associate profiles with authenticated users
* enforce ownership using RLS
* validate data server-side
* minimize collected data
* separate profile data from clinical data
* provide excellent UX
* be accessible
* be responsive
* be performant
* be privacy-conscious
* pass tests
* pass type checking
* pass linting
* pass production build

---

# 99. Verification Commands

Run:

```bash id="r6k1m4"
npm run lint
npm run typecheck
npm test
npm run build
```

Additionally verify:

* authenticated profile access
* unauthenticated redirect
* profile creation
* profile editing
* browser refresh
* logout
* cross-user access attempt
* RLS policies
* invalid input
* malicious input
* mobile forms
* accessibility
* caching behavior

Do not report PASS without actually verifying.

---

# 100. Final Implementation Report

After implementation report:

## Summary

What was implemented?

## Routes

List all new routes.

## Database

Report:

* table(s)
* columns
* constraints
* indexes
* migration

## RLS

Report:

* SELECT
* INSERT
* UPDATE
* DELETE

policies and their intended behavior.

## Profile Model

Report the final typed model.

## UX

Report:

* onboarding
* profile view
* edit flow
* completeness
* loading/error/success states

## Security

Report:

* ownership enforcement
* input validation
* sensitive data handling
* caching
* logging

## Accessibility

Report checks.

## Responsive

Report viewport testing.

## Tests

Report:

```text id="h2q7m9"
TypeScript: PASS/FAIL
ESLint: PASS/FAIL
Unit: PASS/FAIL
Integration: PASS/FAIL
E2E: PASS/FAIL
RLS/Security: PASS/FAIL
Accessibility: PASS/FAIL
Build: PASS/FAIL
```

## Acceptance Criteria

Report every criterion.

## Known Issues

List actual issues.

## Deferred Work

List functionality intentionally deferred.

Do not proceed to Phase 08.
