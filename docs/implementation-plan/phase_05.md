# Phase 05 — About, Clinic & Contact Experience

## Objective

Build the remaining core public-facing pages for Punarvasu:

* About Punarvasu
* Our Practitioners / Doctors
* Contact
* Clinic / Visit Us experience

The purpose of this phase is to establish deeper trust after a visitor has discovered Punarvasu and explored its services.

The visitor should be able to answer:

* Who is Punarvasu?
* Who will care for me?
* What does Punarvasu believe in?
* What is the clinic environment like?
* Where is the clinic?
* How can I contact the clinic?
* What should I do next?

The final experience should feel:

* authentic
* calm
* premium
* human
* trustworthy
* professional
* distinctly Ayurvedic

It should not feel like a generic healthcare template.

---

# 1. Read Before Implementation

Before coding, read:

* `agent.md`
* `docs/product-spec.md`
* `docs/architecture.md`
* `docs/design-system.md`
* `docs/security.md`
* `docs/qa-strategy.md`
* `docs/implementation-progress.md`
* `phases/phase_00.md`
* `phases/phase_01.md`
* `phases/phase_02.md`
* `phases/phase_03.md`
* `phases/phase_04.md`
* this file

Then inspect:

* current public header
* public footer
* Home page
* Services page
* treatment detail pages
* existing marketing components
* image handling
* route conventions
* metadata implementation
* existing contact information
* any existing practitioner data

Reuse established components and patterns.

Do not create a second public-site architecture.

---

# 2. Scope

Implement:

* About page
* Punarvasu story
* Philosophy section
* Approach to care
* Practitioner/doctor listing
* Practitioner profile/detail architecture where appropriate
* Clinic experience section
* Contact page
* Clinic location section
* Contact information
* Map integration foundation
* Directions CTA
* Contact CTAs
* Opening hours where verified
* FAQ where useful
* SEO metadata
* accessibility
* responsive design
* graceful loading/error states where relevant

---

# 3. Explicitly NOT Included

Do not implement:

* authentication
* patient registration
* appointment booking engine
* appointment calendar
* doctor dashboard
* receptionist dashboard
* clinical records
* prescriptions
* patient document upload
* notifications
* analytics
* AI
* payments
* online consultation/telemedicine

Contact forms may be implemented only as a UI/data-capture foundation if appropriate.

Do not build a full messaging/CRM system.

---

# 4. Public Website Architecture

At the end of this phase, the public website should conceptually contain:

```text
/
├── /about
├── /services
│   └── /services/[slug]
├── /practitioners
├── /contact
└── future public routes
```

Follow the routing conventions already established.

---

# 5. Primary User Journey

The public journey should now support:

```text
Home
  ↓
Services
  ↓
About / Practitioners
  ↓
Contact / Clinic
  ↓
Book a Consultation
```

The user should never feel trapped on a page.

---

# 6. About Page

Preferred route:

```text
/about
```

The About page should explain the identity of Punarvasu.

It should answer:

> Why does Punarvasu exist?

and:

> What kind of care can a patient expect?

---

# 7. About Page Structure

Recommended:

```text
Header
  ↓
About Hero
  ↓
Punarvasu Story
  ↓
Our Philosophy
  ↓
Our Approach to Care
  ↓
What Makes Punarvasu Different
  ↓
Clinic Experience
  ↓
Practitioner Preview
  ↓
FAQ
  ↓
CTA
  ↓
Footer
```

Do not implement every section if the available content does not justify it.

---

# 8. About Hero

The hero should establish the emotional identity of the clinic.

Possible direction:

> A thoughtful approach to Ayurveda, rooted in tradition and centered on the individual.

This is an example, not mandatory final copy.

The hero should include:

* strong headline
* supporting copy
* meaningful visual
* optional CTA

---

# 9. Punarvasu Story

Tell the clinic's actual story.

Potential questions:

* Why was Punarvasu founded?
* What does the name represent?
* What inspired the clinic?
* What problem in healthcare does Punarvasu want to address?
* What experience should patients have?

Only use verified information.

Do not invent a founder story.

---

# 10. Punarvasu Name

If the meaning of "Punarvasu" is explained:

* ensure the explanation is accurate
* avoid presenting uncertain etymology as fact
* keep the explanation relevant to the clinic

Do not create elaborate mythology simply for visual storytelling.

---

# 11. Philosophy

The philosophy section should explain the principles behind Punarvasu.

Potential themes:

* individuality
* balance
* prevention
* lifestyle
* holistic care
* traditional Ayurvedic principles
* practitioner-patient relationship

Use the clinic's actual philosophy when available.

---

# 12. Philosophy Visual Design

Avoid turning the section into:

```text
🌿
Balance

🌱
Nature

🪷
Healing
```

Instead use sophisticated typography, imagery, whitespace, and restrained visual motifs.

The design should feel premium rather than decorative.

---

# 13. Approach to Care

Explain how Punarvasu approaches a patient's journey.

Potential flow:

```text
Listen
  ↓
Understand
  ↓
Assess
  ↓
Personalize
  ↓
Guide
  ↓
Follow Up
```

This should complement the Patient Journey created in Phase 03.

Do not duplicate the exact same section unless there is a clear UX reason.

---

# 14. Personalization

Clearly communicate that treatment decisions depend on the individual.

Possible messaging:

> Ayurvedic care begins with understanding the individual rather than applying the same approach to everyone.

Avoid implying that personalized care guarantees better outcomes.

---

# 15. What Makes Punarvasu Different

If the clinic has genuine differentiators, communicate them.

Possible examples:

* practitioner-led care
* individualized consultation
* traditional Ayurvedic principles
* thoughtful follow-up
* patient education
* calm clinical environment

Only use differentiators supported by actual clinic practice.

---

# 16. Practitioner Page

Preferred route:

```text
/practitioners
```

This page should introduce the people behind Punarvasu.

Trust is a primary goal.

Visitors should be able to understand:

* who the practitioners are
* their qualifications
* areas of expertise
* professional background
* approach to care

---

# 17. Practitioner Listing

Recommended card:

```text
Photo

Name

Qualification

Specialization

Short introduction

[View Profile]
```

Example structure:

```text
Dr. [Verified Name]

BAMS / Verified Qualification

Ayurvedic consultation
and personalized care

[View Profile]
```

Do not invent qualifications.

---

# 18. Practitioner Information

Only display verified information.

Potential fields:

```ts
type Practitioner = {
  slug: string;
  name: string;
  designation?: string;
  qualifications?: string[];
  specialties?: string[];
  shortBio?: string;
  biography?: string;
  image?: string;
  experience?: string;
  languages?: string[];
};
```

Adapt the model to the actual project.

Do not use `any`.

---

# 19. Practitioner Detail

If practitioner detail pages are implemented, preferred route:

```text
/practitioners/[slug]
```

The page should contain:

* name
* professional title
* photograph
* qualifications
* areas of focus
* biography
* approach to care
* languages where relevant
* CTA

---

# 20. Practitioner Detail Example

Conceptual layout:

```text
┌────────────────────────────────────────────┐
│                                            │
│  Practitioner photo    Dr. Name            │
│                        Qualification       │
│                        Areas of focus      │
│                        [Book Consultation] │
│                                            │
└────────────────────────────────────────────┘

About the Practitioner
────────────────────────────────────────────

Areas of Focus
────────────────────────────────────────────

Approach to Care
────────────────────────────────────────────

[Book a Consultation]
```

The actual design should be more refined than a simple two-column card.

---

# 21. Practitioner Content Safety

Do not use exaggerated claims such as:

> World's leading Ayurvedic doctor.

or:

> Guaranteed to heal chronic conditions.

Avoid unsupported rankings and outcomes.

---

# 22. Practitioner Search/Filtering

Do not add search/filter functionality unless the number of practitioners justifies it.

For a small clinic:

```text
2–6 practitioners
```

a simple curated presentation is usually better.

Do not create complexity for the sake of features.

---

# 23. Clinic Experience

Create a section showing what visiting Punarvasu feels like.

Possible content:

* reception
* consultation room
* treatment environment
* cleanliness
* calm atmosphere
* patient privacy

Only show claims supported by actual clinic standards.

---

# 24. Clinic Photography

If actual clinic images are available:

Use them.

If not:

* use clearly marked placeholders
* centralize image references
* document replacement requirements

Never imply stock imagery is the actual Punarvasu clinic.

---

# 25. Photography Direction

Future Punarvasu photography should ideally communicate:

* warmth
* natural materials
* real practitioners
* real patients only with permission
* authentic treatment environment
* clean and professional spaces
* Indian cultural context without clichés

Avoid excessive staging.

---

# 26. Contact Page

Preferred route:

```text
/contact
```

The Contact page should make contacting the clinic extremely easy.

It should provide:

* address
* phone
* email
* hours
* map
* directions
* contact options
* consultation CTA

Only show information that is verified.

---

# 27. Contact Page Structure

Recommended:

```text
Header
  ↓
Contact Hero
  ↓
Contact Information
  ↓
Location / Map
  ↓
Opening Hours
  ↓
Contact Form
  ↓
Directions
  ↓
FAQ
  ↓
Consultation CTA
  ↓
Footer
```

---

# 28. Contact Hero

Keep it simple.

Example direction:

> We'd be happy to help you begin your Punarvasu journey.

Supporting text:

> Reach out to our clinic for questions, directions, or information about consultations.

Do not promise immediate responses unless the clinic actually provides them.

---

# 29. Contact Information

Use clearly separated contact methods:

```text
Phone
[Verified phone]

Email
[Verified email]

Visit Us
[Verified address]

Hours
[Verified hours]
```

Phone numbers should use:

```text
tel:
```

links.

Email should use:

```text
mailto:
```

where appropriate.

---

# 30. Contact Information Architecture

Do not duplicate contact information in multiple hardcoded components.

Prefer a central configuration:

```ts
clinicContact
```

or equivalent.

Future phases may move this data into a database-backed clinic settings system.

---

# 31. Address

Display the complete verified address.

Where appropriate, provide:

```text
[Get Directions]
```

The directions link should use the correct mapping destination.

Do not invent coordinates.

---

# 32. Map

Provide a map experience where appropriate.

Potential approaches:

* Google Maps embed
* OpenStreetMap
* external map link
* map provider integration

Use the approach that fits the project and privacy/performance requirements.

---

# 33. Map Performance

Do not automatically load a heavy interactive map immediately.

Consider:

* static map preview
* lazy loading
* external directions link
* user-initiated map loading

The map must not unnecessarily harm page performance.

---

# 34. Map Accessibility

Provide an accessible alternative.

Example:

```text
[Open Location in Maps]
```

Do not require a user to visually interpret the map to obtain the address.

---

# 35. Opening Hours

Only display verified hours.

Example:

```text
Monday – Saturday
10:00 AM – 7:00 PM
```

must not be invented.

If hours are unknown:

* omit them
* or display a clear placeholder in development

---

# 36. Contact Form

A contact form may be implemented if appropriate.

Potential fields:

* Name
* Email
* Phone
* Message

Keep it minimal.

Do not ask for detailed medical history in a public contact form.

---

# 37. Sensitive Information Warning

Do not encourage users to submit sensitive health information through a generic contact form.

For example, avoid:

> Tell us about your medical condition and medications.

Instead:

> Please avoid sharing sensitive medical information in this form. A practitioner can discuss your health history during a consultation.

Final wording should be reviewed for the clinic's privacy policy.

---

# 38. Contact Form Validation

Validate:

* required fields
* email
* phone where collected
* reasonable message length

Use the validation infrastructure established in Phase 01.

---

# 39. Contact Form Security

Protect against:

* spam
* excessive submissions
* malicious input
* HTML injection
* oversized payloads

If a backend submission endpoint is introduced:

* validate on the server
* rate-limit where appropriate
* never trust client validation
* do not expose internal errors

---

# 40. Contact Form Backend

Do not build a complex CRM.

If email/contact submission infrastructure is not yet available:

Implement the UI and validation foundation and document the backend integration required later.

Do not create fake submission success.

---

# 41. Contact Form States

Support:

### Initial

```text
Name
Email
Phone
Message

[Send Message]
```

### Submitting

```text
Sending...
```

### Success

```text
Thank you. Your message has been received.
```

### Error

```text
We couldn't send your message right now.
Please try again or contact the clinic directly.
```

Do not expose raw server errors.

---

# 42. Spam Protection

If a real submission endpoint is implemented, consider:

* rate limiting
* honeypot
* CAPTCHA/Turnstile where justified

Do not add intrusive CAPTCHA solely because it is common.

---

# 43. Contact Form Privacy

Do not store unnecessary personal information.

If submissions are persisted:

* define retention
* restrict access
* document data ownership
* protect with appropriate authorization

This is particularly important because this is a healthcare-related website.

---

# 44. Practitioner CTA

Practitioner pages should have a clear path to consultation.

Example:

```text
Meet Dr. [Name]

[Book a Consultation]
```

The CTA should not imply that selecting a specific practitioner guarantees a specific treatment outcome.

---

# 45. Clinic CTA

The Contact page should support:

```text
Call the Clinic
Email the Clinic
Get Directions
Book a Consultation
```

depending on verified available channels.

---

# 46. FAQ

Potential questions:

* Where is Punarvasu located?
* What are the clinic hours?
* How do I contact the clinic?
* What happens during a consultation?
* Do I need an appointment?
* How should I prepare for my visit?

Only provide verified answers.

Do not invent clinic policies.

---

# 47. Public Navigation

Update the public navigation created in Phase 03 to include:

```text
Home
About
Services
Practitioners
Contact
```

Additional navigation items may exist if already established.

Do not make the navigation overcrowded.

---

# 48. Footer

Update the public footer with:

* About
* Services
* Practitioners
* Contact
* Privacy
* Terms
* Medical Disclaimer
* verified contact information
* verified social links

Do not invent social profiles.

---

# 49. Cross-Page Consistency

All public pages must share:

* header
* footer
* typography
* spacing
* CTA language
* buttons
* card system
* breadcrumbs
* responsive behavior
* motion language

Do not create page-specific visual systems.

---

# 50. SEO

Implement metadata for:

```text
/about
/practitioners
/practitioners/[slug]
/contact
```

Each page should have:

* unique title
* unique description
* appropriate canonical URL
* Open Graph metadata

Do not duplicate identical metadata across all pages.

---

# 51. Practitioner SEO

For practitioner pages, metadata should use verified information.

Example:

```text
Dr. [Name] | Ayurvedic Practitioner | Punarvasu
```

Do not include unsupported claims.

---

# 52. Local SEO

The Contact page should clearly communicate:

* clinic name
* verified address
* verified phone
* verified opening hours
* location

If structured data is used, it must match the visible page information.

---

# 53. Structured Data

Where appropriate, use factual structured data for:

* Organization
* LocalBusiness/appropriate healthcare organization type
* Person/Practitioner where appropriate

Do not add fake:

* ratings
* reviews
* prices
* opening hours
* credentials

---

# 54. Accessibility

All pages must meet the project's accessibility standards.

Verify:

* semantic HTML
* heading hierarchy
* keyboard navigation
* visible focus
* accessible navigation
* accessible forms
* accessible map alternatives
* accessible accordions
* meaningful image alt text
* contrast
* reduced motion

---

# 55. Responsive Design

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
1920px+
```

Particular attention should be given to:

* practitioner cards
* practitioner hero
* contact information
* map
* contact form
* footer
* navigation

---

# 56. Mobile Contact Experience

On mobile, contact actions should be highly usable.

For example:

```text
Call Clinic
Email
Get Directions
```

should have sufficient touch target sizes.

Do not make users hunt for the phone number.

---

# 57. Mobile Practitioner Experience

Practitioner information should remain readable.

Avoid tiny text beside large images.

Prefer:

```text
Photo
Name
Qualification
Specialties
Bio
CTA
```

with a clear vertical hierarchy.

---

# 58. Performance

Optimize:

* practitioner photos
* clinic photos
* map loading
* fonts
* JavaScript

Do not load a heavy map immediately if a static alternative is sufficient.

Do not turn static About pages into unnecessary client components.

---

# 59. Images

Use Next.js image optimization.

Every image should have:

* appropriate dimensions
* appropriate loading strategy
* meaningful alt text where informative
* decorative handling where appropriate

---

# 60. Motion

Continue the motion language established in Phase 02/03.

Good:

* subtle section entrance
* image reveal
* practitioner card hover
* mobile menu
* accordion

Avoid:

* dramatic page transitions
* excessive parallax
* constant movement

Respect reduced-motion preferences.

---

# 61. Content Architecture

Use typed configuration/content models where appropriate.

Potential conceptual structure:

```text
site.ts
clinic.ts
practitioners.ts
about.ts
```

Do not scatter the same:

* phone
* email
* address
* hours

through multiple components.

---

# 62. Practitioner Data

Keep practitioner data centralized and typed.

This prepares the application for later database integration.

Future architecture may evolve:

```text
Static typed content
        ↓
Database-backed practitioners
        ↓
Reception/admin management
```

Do not implement the admin management system in Phase 05.

---

# 63. Contact Data

Centralize clinic contact information.

Example concept:

```ts
const clinicContact = {
  name: "...",
  phone: "...",
  email: "...",
  address: "...",
  hours: [...]
};
```

Use the project's established configuration architecture.

---

# 64. Bad → Good — About Page

### BAD

```text
About Us

Our Mission
Our Vision
Our Values
Our Passion
Our Commitment
Our Excellence
```

Generic corporate copy.

### GOOD

Tell an authentic story:

```text
Why Punarvasu exists

What inspired the clinic

How we think about Ayurvedic care

What a patient can expect

Meet the people behind that approach
```

---

# 65. Bad → Good — Practitioner

### BAD

```text
Dr. John Doe

Best Ayurvedic Doctor
20+ years
100% patient satisfaction
```

if unsupported.

### GOOD

```text
Dr. [Verified Name]

[Verified qualification]

Areas of focus:
[Verified specialties]

[Concise verified biography]

[View Profile]
```

---

# 66. Bad → Good — Contact

### BAD

```text
Contact Us

Name
Email
Medical Problem
Full Medical History
Medications
Symptoms

[Submit]
```

### GOOD

```text
Get in Touch

Have a question about Punarvasu?
We're here to help.

Name
Email
Phone
Message

Please avoid sharing sensitive medical
information through this form.

[Send Message]

Or contact the clinic directly:
[Call] [Email] [Directions]
```

---

# 67. Bad → Good — Map

### BAD

A full interactive map loads immediately and dominates the page.

### GOOD

```text
Visit Punarvasu

[Address]

[Map Preview]

[Open in Maps]
```

Load the heavier map experience only when useful.

---

# 68. Bad → Good — Clinic Imagery

### BAD

Use random stock images and present them as the clinic.

### GOOD

Use:

* verified clinic photography
* clearly marked placeholders
* consistent image direction

---

# 69. Bad → Good — Contact Form Errors

### BAD

```text
Error: PrismaClientKnownRequestError...
```

### GOOD

```text
We couldn't send your message right now.
Please try again or contact the clinic directly.
```

Log technical details securely on the server.

---

# 70. Security

This phase must follow the security architecture from Phase 01.

Never:

* expose service-role credentials
* expose private patient information
* expose internal database errors
* trust client-side validation alone
* store unnecessary health information
* render unsanitized user input

If contact submissions are persisted, ensure proper server-side authorization and data protection.

---

# 71. Privacy

Because Punarvasu is healthcare-related, contact interactions should follow privacy-by-design principles.

Avoid collecting sensitive health information unless there is a clear, secure, justified workflow.

The public contact form should not become an accidental medical-record system.

---

# 72. Testing

## About

Test:

* route
* navigation
* responsive behavior
* metadata

## Practitioners

Test:

* listing
* valid detail page
* invalid slug
* practitioner navigation
* CTA
* metadata

## Contact

Test:

* form validation
* successful state if backend exists
* error state
* invalid input
* keyboard accessibility
* contact links
* map/directions link

---

# 73. Accessibility Testing

Verify:

* keyboard-only navigation
* focus management
* labels
* error announcements
* form semantics
* heading hierarchy
* image alt text
* map alternative
* contrast
* reduced motion

---

# 74. Security Testing

If a contact submission endpoint exists, test:

* invalid input
* oversized input
* malicious HTML/script input
* rate limiting where implemented
* server-side validation
* safe error handling

Verify that no private information is returned to the client.

---

# 75. Performance Testing

Check:

* image sizes
* page loading
* map loading
* JavaScript bundle
* client/server boundaries
* layout stability

---

# 76. Expected Files

Actual paths should follow the existing project architecture.

Potential structure:

```text
src/
├── app/
│   ├── about/
│   │   └── page.tsx
│   │
│   ├── practitioners/
│   │   ├── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   │
│   └── contact/
│       └── page.tsx
│
├── components/
│   └── marketing/
│       ├── practitioner-card.tsx
│       ├── practitioner-grid.tsx
│       ├── practitioner-hero.tsx
│       ├── clinic-location.tsx
│       ├── contact-form.tsx
│       ├── map-preview.tsx
│       └── ...
│
├── features/
│   ├── practitioners/
│   └── contact/
│
└── config/
    ├── clinic.ts
    └── practitioners.ts
```

These are examples.

Do not blindly create every file.

Follow the established architecture.

---

# 77. Placeholder Content

If verified Punarvasu information is unavailable:

Use explicit development placeholders.

For example:

```text
[VERIFY CLINIC ADDRESS]
[VERIFY CLINIC PHONE]
[VERIFY PRACTITIONER QUALIFICATION]
[REPLACE WITH VERIFIED CLINIC PHOTOGRAPH]
```

Do not silently invent information.

Before production launch, all placeholders must be resolved.

---

# 78. Content Review

The following should receive clinic review before production:

* About story
* philosophy claims
* practitioner biographies
* qualifications
* specialties
* clinic policies
* opening hours
* contact information
* treatment-related claims
* medical disclaimer language

---

# 79. Acceptance Criteria

## About

* [ ] `/about` exists.
* [ ] About hero implemented.
* [ ] Punarvasu story implemented.
* [ ] Philosophy implemented.
* [ ] Approach to care implemented.
* [ ] Differentiators implemented where verified.
* [ ] Clinic experience implemented where assets exist.
* [ ] Practitioner preview implemented.
* [ ] CTA implemented.

## Practitioners

* [ ] `/practitioners` exists.
* [ ] Practitioner listing works.
* [ ] Practitioner cards are accessible.
* [ ] Practitioner data is typed.
* [ ] Practitioner detail pages exist if appropriate.
* [ ] Invalid practitioner slug produces 404.
* [ ] No fabricated qualifications or claims.
* [ ] Consultation CTA exists.

## Contact

* [ ] `/contact` exists.
* [ ] Contact information is displayed.
* [ ] Phone link works.
* [ ] Email link works.
* [ ] Address is displayed.
* [ ] Directions work where configured.
* [ ] Map/location experience exists.
* [ ] Accessible map alternative exists.
* [ ] Opening hours are displayed only when verified.
* [ ] Contact form exists if appropriate.
* [ ] Form validation works.
* [ ] Error/success states are safe.

## Navigation

* [ ] Public navigation is consistent across all pages.
* [ ] Footer is consistent.
* [ ] Mobile navigation works.

## SEO

* [ ] About metadata exists.
* [ ] Practitioner metadata exists.
* [ ] Practitioner detail metadata is dynamic.
* [ ] Contact metadata exists.
* [ ] Canonical strategy is correct.
* [ ] Structured data is factual.

## Accessibility

* [ ] Keyboard navigation works.
* [ ] Forms are properly labeled.
* [ ] Error messages are accessible.
* [ ] Heading hierarchy is correct.
* [ ] Images have appropriate alt text.
* [ ] Focus states are visible.
* [ ] Reduced motion is supported.
* [ ] Map has an accessible alternative.

## Responsive

* [ ] 320px works.
* [ ] 375px works.
* [ ] 390px works.
* [ ] 430px works.
* [ ] Tablet works.
* [ ] Desktop works.
* [ ] Large desktop works.
* [ ] No horizontal overflow.

## Security

* [ ] No secrets exposed.
* [ ] No private data exposed.
* [ ] Contact input is safely handled.
* [ ] Server-side validation exists where backend submission exists.
* [ ] Raw internal errors are not exposed.

---

# 80. Definition of Done

Phase 05 is complete when Punarvasu has a cohesive and trustworthy public website covering:

```text
Home
Services
Treatment Details
About
Practitioners
Contact
```

A visitor should be able to move naturally from:

```text
Discover Punarvasu
       ↓
Understand the clinic
       ↓
Explore treatments
       ↓
Meet practitioners
       ↓
Find the clinic
       ↓
Contact / Book
```

The implementation must:

* reuse the Phase 02 design system
* reuse the Phase 03 public shell
* reuse Phase 04 service patterns
* feel cohesive across all public pages
* use verified content
* avoid fabricated medical claims
* protect sensitive information
* be accessible
* be responsive
* be performant
* have proper SEO
* pass type checking
* pass linting
* pass tests
* pass production build

---

# 81. Verification Commands

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Also verify:

* all routes
* invalid slugs
* navigation
* contact links
* contact form
* keyboard navigation
* responsive layouts
* metadata
* image loading
* map behavior

Do not report PASS without actually verifying.

---

# 82. Final Implementation Report

After implementation report:

## Summary

What was implemented?

## Routes

List all new/modified routes.

## Components

List created/modified components.

## Practitioner Data

Report data model and content status.

## Clinic Data

Report contact/location configuration.

## Contact Form

Report:

* UI
* validation
* backend status
* security controls

## SEO

Report metadata and structured data.

## Accessibility

Report checks.

## Responsive

Report tested viewport sizes.

## Security

Report checks performed.

## Tests

Report:

```text
TypeScript: PASS/FAIL
ESLint: PASS/FAIL
Unit: PASS/FAIL
E2E: PASS/FAIL
Accessibility: PASS/FAIL
Build: PASS/FAIL
```

## Acceptance Criteria

Report every criterion.

## Known Issues

List actual issues.

## Deferred Work

List functionality intentionally deferred.

Do not proceed to Phase 06.
