# Phase 03 — Premium Public Home Experience

## Objective

Build the production-quality public-facing foundation of Punarvasu, centered around an exceptional Home page.

This is the first phase where the Punarvasu brand should become visually tangible.

The Home page should communicate within a few seconds:

* What Punarvasu is
* What makes its Ayurvedic approach different
* Why a visitor should trust the clinic
* What they can do next

The primary conversion goal is:

> Encourage an interested visitor to book a consultation.

The experience should feel like a premium healthcare/wellness brand rather than a generic clinic template.

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
* this file

Then inspect:

* existing routes
* existing layout
* existing UI components
* design tokens
* typography
* navigation components
* image handling
* metadata implementation

Do not recreate components already established in Phase 02.

---

# 2. Scope

## Included

Implement:

* Public website shell
* Public header
* Public navigation
* Mobile navigation
* Public footer
* Home page
* Responsive behavior
* Home page metadata
* SEO foundation for the Home page
* Accessibility
* Loading/error handling where relevant
* Subtle motion
* CTA architecture

## Explicitly NOT Included

Do not implement:

* Treatment listing/detail pages
* Practitioner listing/detail pages
* About page
* Contact page
* Appointment booking engine
* Patient authentication
* Patient dashboard
* Doctor dashboard
* Receptionist dashboard
* Clinical records
* Prescriptions
* Documents
* Notifications
* Analytics
* AI

Those belong to later phases.

The Home page may contain links/CTAs to future functionality, but do not implement the underlying feature prematurely.

---

# 3. Primary User

The primary user is a person visiting Punarvasu for the first time.

They may be:

* Searching for Ayurvedic care
* Looking for a specific treatment
* Looking for an Ayurvedic practitioner
* Considering a consultation
* Researching whether Punarvasu is trustworthy
* Returning to the clinic website

The visitor may know very little about Punarvasu.

The page must therefore communicate clearly without requiring prior knowledge.

---

# 4. Primary Conversion

The primary CTA is:

> Book a Consultation

Secondary actions may include:

* Explore Treatments
* Meet Our Practitioners
* Learn About Ayurveda
* Contact the Clinic

Do not create fake destinations.

If a destination does not exist yet, link to the appropriate future route only if the project architecture supports it, or use a temporary safe placeholder approach documented for the phase.

---

# 5. Overall Page Structure

The Home page should have a strong narrative.

Recommended structure:

```text
Header
   ↓
Hero
   ↓
Trust / Credibility
   ↓
What Punarvasu Is
   ↓
Our Approach
   ↓
Featured Services
   ↓
Why Punarvasu
   ↓
Patient Journey
   ↓
Ayurvedic Philosophy
   ↓
Practitioner Preview
   ↓
Testimonials
   ↓
FAQ
   ↓
Location / Visit Us
   ↓
Final CTA
   ↓
Footer
```

The exact number and ordering of sections may be adjusted based on actual content and visual hierarchy.

Do not blindly implement every section if it makes the page repetitive.

---

# 6. Header

Create the public website header.

Desktop should support:

```text
Punarvasu logo/brand
Home
About
Treatments
Practitioners
Articles
Contact

[Book a Consultation]
```

The final navigation may evolve in future phases.

The structure should therefore be configurable.

---

# 7. Header Behavior

The header should support:

* transparent/hero state where appropriate
* normal background state
* sticky behavior if it improves UX
* mobile navigation
* accessible menu
* keyboard navigation

Do not make the header excessively animated.

If the header changes appearance while scrolling, the transition should be subtle.

---

# 8. Mobile Navigation

Mobile navigation should be a first-class experience.

Requirements:

* large enough touch targets
* clear hierarchy
* accessible menu button
* accessible close action
* keyboard support
* Escape support where appropriate
* focus management
* body scroll handling

Do not simply squeeze desktop navigation into mobile.

---

# 9. Hero Section

The hero is the most important section.

It must immediately communicate:

* Ayurveda
* personalized care
* Punarvasu
* trust
* invitation to begin

Potential messaging direction:

> Ancient wisdom. Personalized care. A healthier way forward.

This is a direction, not mandatory final copy.

Use copy that is warm and confident without making unsupported medical claims.

---

# 10. Hero Layout

The hero should contain:

* strong headline
* supporting description
* primary CTA
* optional secondary CTA
* compelling visual
* optional trust indicators

The visual should support the message rather than compete with it.

---

# 11. Hero Imagery

Use high-quality imagery that feels:

* authentic
* warm
* natural
* human
* premium
* culturally appropriate

Avoid generic "green leaf + bottle" stock imagery.

Avoid images that imply medical procedures or outcomes not actually offered by the clinic.

If actual Punarvasu imagery is unavailable:

* use a clearly replaceable image asset
* keep image references centralized
* document that production photography should replace placeholders

Do not claim placeholder imagery is actual clinic photography.

---

# 12. Hero CTA

Primary:

```text
Book a Consultation
```

Secondary:

```text
Explore Our Approach
```

CTA hierarchy should be obvious.

The primary CTA should be visually stronger.

---

# 13. Trust Section

Immediately after the hero, establish credibility.

Possible themes:

* Personalized care
* Experienced practitioners
* Authentic Ayurvedic approach
* Patient-centered experience
* Thoughtful follow-up

Only use claims that are actually supported by clinic information.

Never invent numbers such as:

> 10,000+ patients

or:

> 98% success rate

unless real verified data is provided.

---

# 14. Trust Indicators

Trust indicators should feel elegant rather than like a sales banner.

### BAD

```text
★★★★★
10,000+
100%
#1
Best Clinic
```

when these claims are unsupported.

### GOOD

Use factual, qualitative statements:

```text
Personalized care
Authentic Ayurvedic approach
Experienced practitioners
Patient-first experience
```

provided these accurately represent Punarvasu.

---

# 15. "What Is Punarvasu?" Section

Introduce the clinic.

Answer:

* What is Punarvasu?
* What does the clinic believe?
* How does it approach care?
* What can a patient expect?

Keep this concise.

Do not turn the Home page into a long About page.

Provide a link to the future About page.

---

# 16. Storytelling

The page should have a narrative rather than a collection of cards.

A possible story:

```text
The problem
      ↓
A different approach
      ↓
Personalized Ayurvedic care
      ↓
The Punarvasu journey
      ↓
Invitation to begin
```

Each section should naturally lead into the next.

---

# 17. Our Approach

Explain the Punarvasu philosophy.

Potential themes:

* understanding the individual
* personalized consultation
* holistic perspective
* lifestyle context
* ongoing care
* traditional Ayurvedic principles

Avoid claiming that Ayurveda universally replaces conventional medical treatment.

Avoid unsupported medical claims.

---

# 18. Featured Services

Provide a preview of services/treatments.

At this stage, service data may be static/config-driven if the services database is not yet implemented.

Do not create the full treatment-management system in this phase.

Each preview should contain:

* Name
* Short description
* Visual
* CTA

Example:

```text
Ayurvedic Consultation

Understand your individual health needs
through a personalized Ayurvedic consultation.

[Learn More]
```

Use only approved/factual descriptions.

---

# 19. Service Card Design

### BAD

```text
🌿 Treatment
Lorem ipsum...
[Click]
```

### GOOD

A carefully composed card with:

* strong title
* concise description
* meaningful imagery
* subtle interaction
* clear action

Do not use unnecessary icons merely to fill space.

---

# 20. Why Punarvasu

Create a strong differentiation section.

Potential themes:

```text
Personalized
Every person's journey is different.

Holistic
We consider more than isolated symptoms.

Thoughtful
Care is built around understanding.

Continuous
Follow-up is part of the journey.
```

These statements must remain consistent with actual clinic philosophy.

---

# 21. Patient Journey

Create a visually memorable patient journey.

Suggested flow:

```text
01
Discover

02
Consult

03
Understand

04
Personalize

05
Care

06
Follow Up
```

The exact labels can be changed.

The purpose is to reduce uncertainty about what happens after clicking "Book a Consultation."

---

# 22. Patient Journey UX

The journey should not look like a generic numbered list.

Use:

* visual progression
* subtle motion
* clear hierarchy
* responsive layout

On mobile, the journey may become a vertical timeline.

---

# 23. Ayurvedic Philosophy

Introduce Ayurveda without overwhelming visitors.

Potential topics:

* balance
* individuality
* daily habits
* food/lifestyle
* preventive wellbeing
* holistic care

Do not provide detailed medical advice on the homepage.

Provide a route to educational content in later phases.

---

# 24. Practitioner Preview

Introduce the practitioners.

Each preview may contain:

* Photo
* Name
* Qualification
* Specialization
* Short introduction

Do not fabricate practitioner data.

If actual practitioner information is unavailable, use clearly marked development placeholders.

The component should be data-driven so Phase 04 can connect it to real data.

---

# 25. Testimonials

Testimonials can create trust but must be handled carefully.

Do not fabricate patient testimonials.

If real testimonials are unavailable:

Option A:

Use clearly marked development placeholder content.

Option B:

Omit the section until verified testimonials are available.

Do NOT create fake names and quotes and present them as real patients.

---

# 26. Testimonial UX

If implemented, support:

* quote
* patient name only when permitted
* optional context
* subtle carousel or grid

Do not create an auto-advancing carousel if it harms accessibility or readability.

---

# 27. FAQ

Create a concise FAQ section.

Potential questions:

* What happens during a consultation?
* How do I book an appointment?
* What should I bring?
* How long does a consultation take?
* Can I schedule a follow-up?
* Where is the clinic located?

Use only answers supported by actual clinic policies.

Do not invent appointment durations or clinic rules.

---

# 28. FAQ Component

Use the Phase 02 accessible accordion.

Requirements:

* keyboard accessible
* clear open/close state
* proper semantics
* smooth but restrained animation

Do not hide critical medical/legal information inside FAQ.

---

# 29. Location / Visit Us

Provide a concise clinic-location section.

Potential content:

* Address
* Opening hours
* Phone
* Email
* Map
* Directions CTA

Only use verified clinic information.

If information is unavailable, use clearly marked placeholders.

---

# 30. Final CTA

End with a strong but calm CTA.

Potential direction:

> Begin your journey toward a more balanced approach to wellbeing.

CTA:

```text
Book a Consultation
```

Avoid aggressive sales language.

---

# 31. Footer

The footer should contain:

### Clinic

* Punarvasu
* short description

### Navigation

* Home
* About
* Treatments
* Practitioners
* Articles
* Contact

### Contact

* Phone
* Email
* Address

### Legal

* Privacy Policy
* Terms
* Medical Disclaimer

### Social

Only include verified social accounts.

Do not invent URLs.

---

# 32. Footer Architecture

Keep footer content configuration-driven.

Avoid hardcoding the same clinic contact information across multiple components.

Future phases should be able to replace configuration with database-backed clinic settings.

---

# 33. Content Architecture

Do not scatter content throughout JSX unnecessarily.

Where practical, structure repeated/static content in typed configuration.

For example:

```ts id="6ps2o6"
const featuredServices = [...]
```

This should make future CMS/database integration easier.

Do not over-engineer the content layer.

---

# 34. SEO

Implement Home page metadata.

Include:

* title
* description
* canonical URL where applicable
* Open Graph metadata
* social metadata

Do not use keyword stuffing.

---

# 35. SEO Content

The page should naturally communicate relevant concepts such as:

* Ayurveda
* Ayurvedic consultation
* Punarvasu
* holistic wellbeing
* clinic location

Do not repeat keywords unnaturally.

---

# 36. Structured Data

If appropriate for the available verified information, prepare the Home page for structured data.

Potential future schema:

* Organization
* LocalBusiness/healthcare-related schema where appropriate

Only include factual information.

Do not fabricate:

* ratings
* reviews
* prices
* opening hours
* addresses

---

# 37. Accessibility

The entire Home page must be accessible.

Verify:

* semantic HTML
* one logical H1
* correct heading hierarchy
* keyboard navigation
* visible focus
* image alt text
* meaningful link labels
* accessible navigation
* accessible accordion
* accessible mobile menu
* sufficient contrast
* reduced motion

Do not use visual styling as a substitute for semantic structure.

---

# 38. Images

Use Next.js image optimization where appropriate.

Images should:

* have meaningful alt text when informative
* use empty alt for purely decorative imagery
* have correct dimensions
* avoid layout shift
* use appropriate loading strategy

Do not lazy-load the primary hero image if doing so harms LCP.

---

# 39. Performance

The Home page should be optimized for fast initial loading.

Pay particular attention to:

* Largest Contentful Paint
* image sizes
* font loading
* unnecessary JavaScript
* client components
* animation libraries

Do not make the entire Home page a client component.

---

# 40. Motion

Use the motion system from Phase 02.

Recommended motion:

* subtle hero entrance
* section reveal
* service card hover
* patient journey progression
* mobile menu transition

Avoid:

* large parallax effects
* excessive movement
* infinite animations
* distracting text animation

---

# 41. Scroll Behavior

If sticky navigation or section navigation is used:

* ensure anchor targets account for header height
* support keyboard users
* do not hijack normal scrolling
* do not create excessive scroll-jacking effects

---

# 42. Responsive Layout

The page must work at:

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

These are representative checkpoints.

---

# 43. Mobile Experience

On mobile:

* Hero should remain compelling.
* CTA should remain easy to access.
* Navigation should be simple.
* Cards should not become excessively tall.
* Text should remain readable.
* Images should not dominate the screen.
* Patient journey should become vertical.
* FAQ should be easy to operate.

Do not simply stack the desktop design without redesigning spacing and hierarchy.

---

# 44. Tablet Experience

Avoid awkward two-column layouts where one column becomes too narrow.

Use responsive breakpoints intentionally.

---

# 45. Large Screens

Do not allow the content to stretch endlessly.

Maintain:

* readable line lengths
* balanced whitespace
* strong visual composition

Large screens should feel spacious, not empty.

---

# 46. Loading State

If any Home page data is dynamically fetched, provide appropriate loading behavior.

Do not display:

```text
Loading...
```

for the entire page unnecessarily.

Prefer stable server-rendered content and skeletons only where needed.

---

# 47. Error State

If a dynamic section fails:

Do not break the entire homepage.

For example:

```text
Featured services unavailable
```

should not prevent:

* hero
* clinic introduction
* navigation
* footer

from rendering.

Use graceful degradation where appropriate.

---

# 48. Empty State

If a dynamic section has no content:

Do not show an awkward empty card grid.

Either:

* hide the optional section
* show a meaningful empty state
* provide fallback content where appropriate

depending on the section.

---

# 49. Bad → Good Examples

## Example 1 — Hero

### BAD

```text
Welcome to Punarvasu

We are the best Ayurvedic clinic.

[Book Now]
```

### GOOD

```text
Ancient wisdom.
Personalized care.

An Ayurvedic approach designed around
your individual journey.

[Book a Consultation]
[Explore Our Approach]
```

The final copy should be based on verified Punarvasu positioning.

---

## Example 2 — Homepage sections

### BAD

```text
Hero
↓
10 cards
↓
10 more cards
↓
10 statistics
↓
Testimonials
↓
FAQ
```

### GOOD

Use narrative:

```text
Introduce
↓
Build trust
↓
Explain approach
↓
Show services
↓
Explain journey
↓
Build confidence
↓
CTA
```

---

## Example 3 — Trust

### BAD

```text
50,000+ Patients
99.9% Success
#1 Ayurveda Clinic
```

when unsupported.

### GOOD

```text
Personalized care
Authentic Ayurvedic principles
Thoughtful patient experience
```

when accurate.

---

## Example 4 — CTA

### BAD

```text
[Click Here]
```

### GOOD

```text
[Book a Consultation]
```

---

## Example 5 — Mobile

### BAD

Desktop hero simply stacked vertically.

### GOOD

Mobile composition is intentionally redesigned:

```text
Headline
Supporting copy
CTA
Visual
Trust indicators
```

with appropriate spacing.

---

## Example 6 — Animation

### BAD

Every section slides in dramatically.

### GOOD

Use subtle entrance motion that preserves reading flow.

---

## Example 7 — Images

### BAD

Use huge unoptimized images directly.

### GOOD

Use optimized responsive images with explicit dimensions and appropriate loading strategy.

---

# 50. Security

This phase is primarily public-facing.

Nevertheless:

* Do not expose environment secrets.
* Do not expose Supabase service-role credentials.
* Do not expose private database information.
* Do not render unsanitized HTML from untrusted sources.
* Do not add unnecessary third-party scripts.
* Do not expose internal API responses in page source.

---

# 51. Expected Files

Actual files should follow the existing architecture.

Potential changes:

```text
src/
├── app/
│   └── page.tsx
│
├── components/
│   ├── layout/
│   └── marketing/
│
├── features/
│   └── marketing/
│
└── config/
    └── site.ts

public/
└── images/
    └── ...

docs/
└── design-system.md
```

These are examples.

Do not create unnecessary abstractions.

---

# 52. Component Architecture

Potential reusable marketing components:

```text id="7xjdyv"
Hero
TrustSection
IntroSection
ApproachSection
ServicePreview
WhyPunarvasu
PatientJourney
PhilosophySection
PractitionerPreview
Testimonials
FAQ
LocationSection
FinalCTA
```

Only create a component when it represents a meaningful reusable section.

Do not split every paragraph into a separate component.

---

# 53. Data Architecture

Static marketing content should be separated from presentation where practical.

For example:

```text id="m6uj45"
marketing-content.ts
```

This makes future CMS/database integration easier.

Do not introduce a CMS in this phase.

---

# 54. Testing

Implement appropriate tests.

### Component tests

Test important interactive components:

* mobile menu
* FAQ
* CTA
* navigation

### Accessibility

Test:

* keyboard navigation
* menu
* accordion
* links
* focus states

### E2E

Verify:

```text id="hmbvqt"
Open Home
↓
Navigate sections
↓
Open mobile menu
↓
Open FAQ
↓
Click primary CTA
```

If the appointment route is not implemented yet, verify that the CTA target follows the documented temporary/future-route strategy.

---

# 55. SEO Testing

Verify:

* page title
* meta description
* canonical configuration
* Open Graph metadata
* correct H1
* semantic headings
* image alt text

---

# 56. Performance Testing

Run an appropriate Lighthouse/PageSpeed-style audit if available.

Pay particular attention to:

* LCP
* CLS
* INP
* image optimization
* unused JavaScript

Do not optimize blindly based solely on a numerical score.

---

# 57. Acceptance Criteria

## Public shell

* [ ] Header exists.
* [ ] Footer exists.
* [ ] Desktop navigation works.
* [ ] Mobile navigation works.
* [ ] Navigation is accessible.
* [ ] CTA architecture is established.

## Home page

* [ ] Hero implemented.
* [ ] Trust section implemented.
* [ ] Punarvasu introduction implemented.
* [ ] Approach section implemented.
* [ ] Featured services section implemented.
* [ ] Why Punarvasu section implemented.
* [ ] Patient journey implemented.
* [ ] Ayurveda philosophy section implemented.
* [ ] Practitioner preview implemented where data exists.
* [ ] Testimonials implemented only with verified or clearly marked placeholder content.
* [ ] FAQ implemented.
* [ ] Location section implemented where information is available.
* [ ] Final CTA implemented.
* [ ] Footer implemented.

## Design

* [ ] Phase 02 design tokens are used.
* [ ] Typography is consistent.
* [ ] Spacing is consistent.
* [ ] Visual hierarchy is clear.
* [ ] No generic template appearance.
* [ ] No excessive decoration.
* [ ] Motion is restrained and purposeful.

## Responsive

* [ ] 320px works.
* [ ] 375px works.
* [ ] 390px works.
* [ ] 430px works.
* [ ] Tablet works.
* [ ] Desktop works.
* [ ] Large screens work.
* [ ] No unintended horizontal overflow.

## Accessibility

* [ ] Semantic HTML.
* [ ] One logical H1.
* [ ] Heading hierarchy is correct.
* [ ] Keyboard navigation works.
* [ ] Mobile menu is accessible.
* [ ] FAQ is accessible.
* [ ] Focus states are visible.
* [ ] Images have appropriate alt text.
* [ ] Contrast is acceptable.
* [ ] Reduced motion is respected.

## SEO

* [ ] Metadata implemented.
* [ ] Open Graph metadata implemented.
* [ ] Canonical strategy implemented where appropriate.
* [ ] Semantic headings implemented.

## Performance

* [ ] Images optimized.
* [ ] Hero image strategy optimized.
* [ ] No unnecessary client rendering.
* [ ] No obvious layout shift.
* [ ] No unnecessary third-party scripts.

---

# 58. Definition of Done

Phase 03 is complete when the Punarvasu Home page is genuinely production-quality.

It should not feel like:

* a wireframe
* a template
* a collection of cards
* an AI-generated landing page
* a generic Ayurvedic website

It should feel like a cohesive premium healthcare brand.

The implementation must:

* use the Phase 02 design system
* work across devices
* be accessible
* load efficiently
* use verified content
* handle dynamic failures gracefully
* have meaningful CTAs
* have appropriate SEO
* preserve the existing architecture
* pass tests
* pass type checking
* pass linting
* pass production build

---

# 59. Verification

Run the actual project commands.

At minimum:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Also perform responsive and accessibility checks.

Do not report PASS without verification.

---

# 60. Final Report

After implementation report:

## Summary

What was implemented?

## UI

List major sections and reusable components.

## Files

List created/modified files.

## Content

Identify any placeholders.

## SEO

Report metadata and structured-data work.

## Accessibility

Report checks performed.

## Responsive

Report tested viewport sizes.

## Performance

Report major findings.

## Tests

Report actual:

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

List real issues only.

## Deferred Work

List functionality intentionally left for later phases.

Do not proceed to Phase 04.
