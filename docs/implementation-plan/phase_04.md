# Phase 04 — Services & Ayurvedic Treatments Experience

## Objective

Build the public-facing Services / Treatments experience for Punarvasu.

The goal is to help visitors:

* understand the Ayurvedic services offered by Punarvasu
* discover treatments relevant to their interests
* understand the philosophy and purpose behind each service
* learn what they can expect
* identify the appropriate next step
* ultimately move toward booking a consultation

The experience must feel educational, trustworthy, premium, and clinically responsible.

It should not feel like an e-commerce catalog or a generic card grid.

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
* this file

Then inspect:

* existing public layout
* Home page
* existing marketing components
* design tokens
* typography
* navigation
* routing conventions
* image handling
* metadata implementation
* any existing treatment/service data

Reuse existing infrastructure wherever possible.

---

# 2. Scope

Implement:

* Services/Treatments listing page
* Treatment discovery experience
* Treatment categories
* Treatment cards
* Treatment detail page architecture
* Treatment detail pages
* treatment-related CTA flow
* related treatments
* treatment FAQ where appropriate
* responsive design
* SEO metadata
* structured data where appropriate
* accessibility
* loading/error/empty states where relevant

The implementation should be structured so that future database/CMS-backed treatment data can replace the initial static/config-driven content without requiring a complete UI rewrite.

---

# 3. Explicitly NOT Included

Do not implement:

* appointment booking engine
* appointment availability
* patient authentication
* patient portal
* treatment purchase/payment
* online prescription
* clinical diagnosis
* doctor dashboard
* receptionist dashboard
* treatment recommendation AI
* AI diagnosis
* medical decision-making
* patient-specific treatment plans

A visitor can be encouraged to book a consultation, but the actual appointment engine belongs to a later phase.

---

# 4. Product Philosophy

The treatment experience should communicate:

> Ayurveda is personalized. A treatment that is appropriate for one person may not be appropriate for another.

Therefore, treatment pages must educate without implying:

> "You have condition X, therefore you should receive treatment Y."

Avoid turning the website into a self-diagnosis tool.

---

# 5. Primary User Journey

The intended journey is:

```text
Home
  ↓
Services
  ↓
Discover Treatment
  ↓
Treatment Detail
  ↓
Understand Approach
  ↓
Book a Consultation
```

The user should always understand what the next step is.

---

# 6. Services Route

Use a clean public route.

Preferred:

```text
/services
```

If the existing architecture has already established a different convention, follow the existing convention consistently.

---

# 7. Treatment Detail Route

Use a stable SEO-friendly route.

Preferred:

```text
/services/[slug]
```

Example:

```text
/services/shirodhara
/services/abhyanga
```

Only create slugs for actual services.

---

# 8. Services Page — Purpose

The Services page should answer:

1. What does Punarvasu offer?
2. How are the services organized?
3. Which treatment/service might interest me?
4. What should I know before choosing?
5. What should I do next?

The page should not attempt to provide every possible piece of information.

---

# 9. Services Page Structure

Recommended structure:

```text
Header
  ↓
Services Hero
  ↓
Introduction
  ↓
Treatment Categories
  ↓
Featured Treatments
  ↓
All Services
  ↓
How Treatment Selection Works
  ↓
Important Consideration / Personalization
  ↓
FAQ
  ↓
CTA
  ↓
Footer
```

Adjust the structure if the actual content suggests a better narrative.

---

# 10. Services Hero

The hero should clearly communicate the purpose of the page.

Potential direction:

> Explore a more personalized approach to Ayurvedic care.

Supporting text should explain that Punarvasu offers a range of Ayurvedic therapies/services and that treatment suitability depends on individual consultation.

Primary CTA:

```text
Book a Consultation
```

The hero should not make exaggerated health claims.

---

# 11. Services Hero Visual

Use imagery consistent with the visual identity established in Phase 03.

Potential imagery:

* treatment environment
* practitioner interaction
* natural materials
* authentic Ayurvedic setting
* carefully composed treatment imagery

Avoid:

* cliché stock photos
* excessive leaves
* generic medicine imagery
* overly staged spa photography
* unrelated wellness imagery

---

# 12. Treatment Categories

If the actual Punarvasu service catalog supports categories, establish a category system.

Possible conceptual categories:

```text
Consultations
Therapeutic Treatments
Body Therapies
Mind & Relaxation
Wellness Support
```

These are examples only.

Do not invent categories that do not correspond to the actual clinic offering.

---

# 13. Category UX

Categories should help visitors scan the catalog.

Possible UI:

```text
[All]
[Consultations]
[Therapies]
[Wellness]
```

The category system must remain useful on mobile.

If there are too few services for categories to provide value, do not force a category navigation system.

---

# 14. Treatment Card

Every treatment card should communicate enough information to encourage exploration.

Recommended structure:

```text
Image

Category

Treatment name

Short description

[Explore Treatment]
```

Optional:

* duration
* consultation requirement
* suitable context

Only include factual information.

---

# 15. Treatment Card Design

### BAD

```text
🌿 Shirodhara

Very good treatment for stress,
headache, insomnia and many diseases.

[Book Now]
```

Problems:

* unsupported claims
* generic description
* no context
* premature booking CTA

### GOOD

```text
Shirodhara

A traditional Ayurvedic therapy involving
a gentle, continuous flow of warm oil or
other suitable liquid over the forehead.

[Explore Treatment]
```

The exact description must be medically/content reviewed before production.

---

# 16. Treatment Content Rules

Treatment content must distinguish between:

### Educational statements

Allowed when accurate:

> Shirodhara is a traditional Ayurvedic therapy involving a continuous flow of liquid over the forehead.

### Patient-specific claims

Avoid:

> Shirodhara will cure your insomnia.

### Absolute claims

Avoid:

> This treatment permanently eliminates stress.

### Unsupported superiority claims

Avoid:

> The most powerful Ayurvedic treatment.

---

# 17. Medical Content Responsibility

The public website is informational.

Treatment content should not:

* diagnose visitors
* prescribe treatment
* guarantee outcomes
* tell a visitor that a treatment is definitely appropriate
* replace professional medical consultation

Use language such as:

> Suitability is assessed individually during consultation.

where appropriate.

---

# 18. Treatment Detail Page

Each treatment should have its own rich detail page.

The page should answer:

* What is this treatment?
* What is its traditional Ayurvedic purpose?
* What happens during the treatment?
* What can a visitor expect?
* Who may benefit from considering it?
* Are there important precautions?
* What should the visitor do next?

---

# 19. Treatment Detail Structure

Recommended:

```text
Breadcrumb
  ↓
Treatment Hero
  ↓
Overview
  ↓
What to Expect
  ↓
Traditional Ayurvedic Context
  ↓
Potential Uses / Context
  ↓
How It Works / Treatment Process
  ↓
Preparation
  ↓
Aftercare
  ↓
Precautions
  ↓
FAQ
  ↓
Related Treatments
  ↓
Consultation CTA
```

Not every treatment needs every section.

The page should adapt to available verified information.

---

# 20. Treatment Hero

Treatment hero should contain:

* treatment name
* category
* concise description
* primary visual
* CTA
* optional breadcrumb

Example:

```text
Shirodhara

A traditional Ayurvedic therapy
designed as part of a personalized
Ayurvedic care approach.

[Book a Consultation]
```

Avoid presenting the treatment as universally appropriate.

---

# 21. Breadcrumbs

Use accessible breadcrumbs where they improve navigation.

Example:

```text
Home / Services / Shirodhara
```

Breadcrumbs should use semantic navigation.

---

# 22. Treatment Overview

Give a concise explanation.

Avoid large blocks of text.

Use:

* short paragraphs
* informative headings
* lists where appropriate
* visual hierarchy

---

# 23. What to Expect

This is an important trust-building section.

Explain the experience in plain language.

Example:

```text
01
Consultation

Your practitioner understands
your individual needs.

02
Preparation

The treatment environment
is prepared appropriately.

03
Therapy

The selected Ayurvedic therapy
is carried out by the practitioner.

04
Follow-up

Your next steps are discussed
based on your individual response.
```

Do not promise a specific process if the clinic process differs.

---

# 24. Treatment Process

Where appropriate, provide a visual timeline:

```text
Preparation
    ↓
Treatment
    ↓
Rest / Completion
    ↓
Practitioner Guidance
```

On mobile this should become a vertical flow.

---

# 25. Potential Uses

If treatment information includes traditional indications or common contexts, present them carefully.

Use wording such as:

> Traditionally used as part of Ayurvedic care for...

rather than:

> Treats...

unless a medically reviewed content policy explicitly permits stronger wording.

---

# 26. Evidence and Claims

Do not imply that traditional Ayurvedic descriptions automatically represent established clinical evidence.

Where relevant, differentiate:

* traditional Ayurvedic context
* modern evidence
* clinic experience

Do not invent scientific studies or citations.

---

# 27. Preparation

If applicable, provide:

* what to wear
* what to bring
* food/drink guidance
* arrival expectations
* relevant instructions

Only provide verified clinic instructions.

---

# 28. Aftercare

If applicable, explain what visitors can generally expect after the treatment.

Do not provide personalized medical advice.

Avoid claims such as:

> You will definitely feel better immediately.

---

# 29. Precautions

This section is important.

Where verified information exists, provide:

* relevant contraindications
* when consultation is especially important
* situations where treatment may need modification

If there is insufficient verified information, do not invent a contraindication list.

Instead, use an appropriate message such as:

> Please discuss your health history, medications, pregnancy status, and other relevant concerns with your practitioner before treatment.

This wording must be reviewed for the clinic's final content policy.

---

# 30. Treatment Duration

If duration is displayed, it must be based on verified clinic information.

Never invent:

```text
Duration: 60 minutes
```

just because that is typical elsewhere.

If duration is variable:

```text
Duration varies based on the individual treatment plan.
```

---

# 31. Pricing

Do not implement treatment pricing unless verified pricing has been provided.

Do not fabricate:

* prices
* discounts
* packages
* offers
* membership plans

If pricing is not available, do not create fake price fields.

---

# 32. Availability

Do not display:

```text
Available Today
Only 2 Slots Left
```

unless this is connected to a real availability system.

The appointment engine will be implemented later.

---

# 33. Related Treatments

At the bottom of a treatment detail page, show relevant related services.

Example:

```text
You may also explore

Abhyanga
Shirodhara
Panchakarma
```

Recommendations must be based on category/content relationships, not an AI medical recommendation.

---

# 34. Important Distinction

Related treatments are:

> Content navigation.

They are NOT:

> Medical recommendations.

Do not phrase them as:

> "Because you viewed Shirodhara, you should get Abhyanga."

Prefer:

> "Explore related Ayurvedic therapies."

---

# 35. Treatment Search

If the number of treatments is large enough, provide search.

Search should support:

* treatment name
* category
* relevant tags

Do not implement complex AI-powered medical search.

---

# 36. Search UX

Example:

```text
Search treatments...

[All] [Consultation] [Therapy]
```

Results should be immediate and easy to scan.

On mobile, search controls should remain usable.

---

# 37. Filtering

If useful, allow filtering by category.

Do not introduce filters simply because the UI supports them.

The goal is to reduce cognitive load.

---

# 38. Empty Search State

If no treatment matches:

```text
No treatments found.

Try a different search term or explore all services.
```

Provide a clear recovery action.

---

# 39. Services Empty State

If the service data source returns no services:

Do not display an empty grid.

Show a meaningful state or graceful fallback.

The rest of the public website must remain functional.

---

# 40. Dynamic vs Static Content

For Phase 04, services may initially be:

* typed configuration
* local content
* static data module

depending on the architecture established in Phase 00/01.

The design must not assume that content will remain static forever.

---

# 41. Content Model

Create a typed service model if one does not already exist.

Conceptually:

```ts
type Treatment = {
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  image?: string;
  content?: {
    overview?: string;
    whatToExpect?: string[];
    preparation?: string[];
    aftercare?: string[];
    precautions?: string[];
    faqs?: FAQ[];
  };
  relatedSlugs?: string[];
};
```

Adapt this to the actual project architecture.

Do not blindly copy this model.

Avoid `any`.

---

# 42. Slug Requirements

Slugs should be:

* lowercase
* URL-safe
* stable
* unique

Example:

```text
shirodhara
abhyanga
```

Do not generate slugs from arbitrary user input without proper normalization.

---

# 43. SEO

Every service detail page should have meaningful metadata.

Example concept:

```text
Title:
Shirodhara | Punarvasu

Description:
Learn about Shirodhara at Punarvasu, including
what to expect and how treatment suitability is
assessed through personalized Ayurvedic care.
```

Metadata must reflect actual content.

Do not keyword stuff.

---

# 44. Dynamic Metadata

Treatment pages should generate metadata from the treatment data model.

Do not duplicate metadata manually across every page.

---

# 45. Open Graph

Treatment pages should support:

* title
* description
* image
* URL

where appropriate.

Use stable, optimized images.

---

# 46. Structured Data

If appropriate, prepare structured data for public service/treatment content.

Do not misuse medical structured data.

Do not add:

* fake ratings
* fake reviews
* fake prices
* unsupported medical claims

---

# 47. Accessibility

The Services experience must support:

* keyboard navigation
* semantic headings
* accessible cards/links
* visible focus
* accessible filters
* accessible search
* accessible breadcrumbs
* meaningful image alt text
* sufficient contrast
* reduced motion

Cards should preferably be links rather than clickable `div`s.

---

# 48. Card Interaction

### BAD

```tsx
<div onClick={openTreatment}>
```

### GOOD

```tsx
<Link href={`/services/${treatment.slug}`}>
```

Use semantic navigation.

---

# 49. Responsive Design

Test at:

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

---

# 50. Mobile Services Grid

Do not blindly preserve a desktop grid.

For example:

Desktop:

```text
┌────────┐ ┌────────┐ ┌────────┐
│        │ │        │ │        │
│ Service│ │ Service│ │ Service│
└────────┘ └────────┘ └────────┘
```

Mobile may become:

```text
┌─────────────────────┐
│      Service        │
└─────────────────────┘

┌─────────────────────┐
│      Service        │
└─────────────────────┘
```

with carefully adjusted imagery and spacing.

---

# 51. Desktop Detail Page

Use a premium editorial layout.

Potential structure:

```text
┌─────────────────────────────────────────┐
│ Breadcrumb                              │
│                                         │
│ Treatment title       Treatment image   │
│ Description                              │
│ CTA                                     │
└─────────────────────────────────────────┘

Overview
──────────────────────────────────────────

What to Expect
──────────────────────────────────────────

Treatment Process
──────────────────────────────────────────

Precautions
──────────────────────────────────────────

Related Treatments
──────────────────────────────────────────
```

Avoid making the page feel like a medical database.

---

# 52. Mobile Detail Page

Prioritize:

1. Treatment name
2. Description
3. Image
4. CTA
5. Key information
6. Detailed sections

The primary CTA should remain easy to discover.

---

# 53. CTA Strategy

Use:

```text
Book a Consultation
```

as the primary conversion CTA.

Secondary:

```text
Explore Other Treatments
```

or:

```text
Contact Punarvasu
```

Do not use:

```text
Buy Now
Order Now
Get Treatment Now
```

unless a future product/payment model explicitly requires it.

---

# 54. Sticky CTA

A mobile sticky consultation CTA may be considered if it improves conversion.

If implemented:

* don't obscure content
* respect safe areas
* don't interfere with browser UI
* make it dismissible if appropriate
* ensure accessibility

Do not automatically add sticky CTAs merely because they are fashionable.

---

# 55. Navigation

Services pages should integrate naturally with the public header/footer created in Phase 03.

Do not create a second header.

---

# 56. Visual Language

Follow Phase 02 and Phase 03.

The Services experience should use:

* earthy natural palette
* sophisticated typography
* generous whitespace
* restrained borders
* authentic imagery
* subtle organic visual elements
* purposeful motion

Avoid:

* excessive rounded cards
* excessive shadows
* gradients everywhere
* glassmorphism
* floating blobs
* excessive green
* decorative leaves everywhere
* emoji icons
* generic SaaS layouts

---

# 57. Imagery System

Treatment imagery should feel consistent.

If multiple treatment images are used:

* maintain similar visual quality
* maintain coherent composition
* avoid random stock-photo styles
* use responsive image optimization

Keep image references centralized.

---

# 58. Motion

Use the Phase 02 motion primitives.

Good uses:

* treatment card hover
* image reveal
* section entrance
* filter transitions
* accordion transitions

Avoid:

* aggressive page transitions
* unnecessary parallax
* auto-scrolling treatment carousels
* excessive animation

Respect:

```css
prefers-reduced-motion
```

---

# 59. Error Handling

A missing treatment should result in a proper 404 experience.

For example:

```text
/services/does-not-exist
```

should not render an empty treatment page.

Use the Next.js routing/error architecture established in Phase 01.

---

# 60. Invalid Content

If a treatment has incomplete optional content:

Do not render empty headings.

BAD:

```text
Preparation

[blank]
```

GOOD:

Omit the section until content exists.

---

# 61. Security

Although this is public content:

* never expose private Supabase credentials
* never use service-role keys in client code
* do not expose private patient data
* do not render arbitrary unsanitized HTML
* do not trust URL parameters
* validate/normalize treatment slugs
* avoid unnecessary third-party scripts

---

# 62. Security Test

Verify that:

```text
/service/[slug]
```

cannot be used to access arbitrary database records outside the intended public treatment dataset.

If database-backed content is not yet implemented, document the future authorization/data-access requirements rather than prematurely implementing a broad query layer.

---

# 63. Performance

Optimize:

* treatment images
* fonts
* JavaScript
* client components
* animations

Prefer server rendering for static/public content.

Do not turn the entire Services page into a client component merely to support filtering.

Where possible, use:

* server-rendered content
* lightweight client components only for interactive filtering/search

---

# 64. Caching

If content is static/config-driven, leverage the framework's natural static rendering.

If future database-backed content is introduced, establish a documented caching/revalidation strategy.

Do not add unnecessary caching complexity now.

---

# 65. Testing

Test:

### Services page

* renders
* navigation works
* categories work where implemented
* search works where implemented
* empty search works
* treatment cards navigate correctly

### Detail page

* valid slug renders
* invalid slug produces proper 404
* related treatments work
* CTA works
* metadata is generated

### Accessibility

* keyboard navigation
* focus states
* semantic headings
* search/filter accessibility
* breadcrumb accessibility

### Responsive

Verify representative viewport sizes.

---

# 66. Few-Shot Quality Examples

## Example 1 — Service listing

### BAD

```text
Services

┌─────┐ ┌─────┐ ┌─────┐
│ 🌿  │ │ 🌿  │ │ 🌿  │
│Care │ │Care │ │Care │
└─────┘ └─────┘ └─────┘
```

Generic cards with no meaningful hierarchy.

### GOOD

```text
Explore Ayurvedic Care

Discover therapies and services offered
through the Punarvasu approach.

Featured
────────────────────────────────

Shirodhara
A traditional Ayurvedic therapy...

[Explore Treatment]

Abhyanga
A traditional Ayurvedic massage therapy...

[Explore Treatment]
```

---

## Example 2 — Treatment claims

### BAD

> Shirodhara cures anxiety, insomnia, headaches and stress.

### GOOD

> Shirodhara is a traditional Ayurvedic therapy. Its suitability and role in care are considered individually by the practitioner.

---

## Example 3 — Treatment recommendation

### BAD

> Do you have stress? You need Shirodhara.

### GOOD

> If you are exploring Ayurvedic approaches for wellbeing concerns, a consultation can help determine what may be appropriate for your individual needs.

---

## Example 4 — Related treatments

### BAD

> Recommended for you: Abhyanga.

### GOOD

> Explore related Ayurvedic therapies.

---

## Example 5 — Missing information

### BAD

```text
Duration: 60 minutes
Price: ₹2,000
```

when the clinic has not supplied this information.

### GOOD

Omit unsupported fields.

---

## Example 6 — Empty state

### BAD

```text
No data.
```

### GOOD

```text
No treatments found.

Try another search term or explore all services.

[View All Services]
```

---

## Example 7 — Card interaction

### BAD

```tsx
<div onClick={...}>
```

### GOOD

```tsx
<Link href={`/services/${slug}`}>
```

---

# 67. Expected Files

Actual paths must follow the architecture established in previous phases.

Potential structure:

```text
src/
├── app/
│   └── services/
│       ├── page.tsx
│       └── [slug]/
│           └── page.tsx
│
├── components/
│   └── marketing/
│       ├── service-card.tsx
│       ├── service-grid.tsx
│       ├── service-category-filter.tsx
│       ├── treatment-hero.tsx
│       ├── treatment-process.tsx
│       ├── related-treatments.tsx
│       └── ...
│
├── features/
│   └── services/
│       ├── data/
│       ├── types/
│       └── ...
│
└── config/
    └── ...
```

These are examples.

Do not create files merely to match this structure.

Follow the actual project architecture.

---

# 68. Content Source

If real Punarvasu treatment information has not yet been provided:

Create clearly identifiable development content.

For example:

```text
TODO: Replace with verified Punarvasu treatment description.
```

Do not make placeholder content look like verified medical guidance.

Keep placeholder content easy to locate and replace.

---

# 69. Content Review Boundary

Before production launch, treatment content should be reviewed by an appropriately qualified person from the clinic.

Development implementation must therefore make content review easy.

Avoid burying medical claims across unrelated JSX files.

---

# 70. No Fake Testimonials or Statistics

Do not introduce:

* fake patient testimonials
* fake patient counts
* fake success rates
* fake ratings
* fake treatment outcomes
* fake practitioner credentials

---

# 71. No AI Recommendations

Do not implement:

```text
Tell us your symptoms → Recommended treatment
```

in Phase 04.

That would cross into medical decision support.

If AI is introduced later, it must follow the safety architecture established in Phase 00 and Phase 17.

---

# 72. Acceptance Criteria

## Services Listing

* [ ] `/services` exists.
* [ ] Services page uses the Punarvasu public shell.
* [ ] Hero is implemented.
* [ ] Treatments/services are displayed.
* [ ] Cards have meaningful hierarchy.
* [ ] Cards navigate to valid detail pages.
* [ ] Categories are implemented where useful.
* [ ] Search is implemented only if justified by catalog size.
* [ ] Empty states are handled.
* [ ] No unsupported content is presented as fact.

## Treatment Detail

* [ ] `/services/[slug]` exists.
* [ ] Valid treatments render correctly.
* [ ] Invalid slugs produce a proper 404.
* [ ] Breadcrumbs work where implemented.
* [ ] Treatment hero exists.
* [ ] Overview exists.
* [ ] What-to-expect content exists where applicable.
* [ ] Treatment process exists where applicable.
* [ ] Preparation/aftercare/precautions are handled appropriately.
* [ ] Related treatments work.
* [ ] Consultation CTA exists.
* [ ] No patient-specific medical recommendations are made.

## Design

* [ ] Phase 02 design system is used.
* [ ] Phase 03 public shell is reused.
* [ ] Visual hierarchy is strong.
* [ ] Treatment pages feel premium and editorial.
* [ ] No generic template appearance.
* [ ] No excessive decorative elements.

## Responsive

* [ ] 320px works.
* [ ] 375px works.
* [ ] 390px works.
* [ ] 430px works.
* [ ] Tablet works.
* [ ] Desktop works.
* [ ] Large desktop works.
* [ ] No horizontal overflow.

## Accessibility

* [ ] Semantic HTML.
* [ ] Correct heading hierarchy.
* [ ] Keyboard navigation.
* [ ] Visible focus states.
* [ ] Accessible search/filter controls.
* [ ] Accessible breadcrumbs.
* [ ] Meaningful alt text.
* [ ] Reduced motion supported.
* [ ] Adequate contrast.

## SEO

* [ ] Services page metadata exists.
* [ ] Treatment pages have dynamic metadata.
* [ ] Open Graph metadata is implemented where appropriate.
* [ ] Canonical strategy is correct.
* [ ] Structured data is used only where appropriate and factual.

## Performance

* [ ] Images optimized.
* [ ] Public content is server-rendered where practical.
* [ ] Client JavaScript is minimized.
* [ ] No unnecessary dependencies.
* [ ] No obvious layout shift.

---

# 73. Definition of Done

Phase 04 is complete when visitors can confidently explore Punarvasu's services and understand the role of each treatment without being pushed into unsupported medical conclusions.

The implementation must:

* build upon Phase 02 design system
* build upon Phase 03 public shell
* provide a polished Services page
* provide rich treatment detail pages
* be responsive
* be accessible
* be SEO-friendly
* be performant
* use safe medical language
* avoid fabricated claims
* support future content/database integration
* pass type checking
* pass linting
* pass tests
* pass production build

---

# 74. Verification Commands

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Also perform:

* responsive inspection
* keyboard navigation
* accessibility verification
* invalid slug test
* metadata inspection
* image/performance inspection

Do not report PASS without actually verifying.

---

# 75. Final Implementation Report

After implementation, provide:

## Summary

What was implemented?

## Routes

List:

```text
/services
/services/[slug]
```

and any additional routes.

## Components

List created/modified components.

## Content

Identify:

* verified content
* development placeholders
* content requiring clinic review

## SEO

Report:

* metadata
* dynamic metadata
* Open Graph
* structured data

## Accessibility

Report checks performed.

## Responsive

Report viewport testing.

## Security

Report security checks.

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

Do not proceed to Phase 05.
