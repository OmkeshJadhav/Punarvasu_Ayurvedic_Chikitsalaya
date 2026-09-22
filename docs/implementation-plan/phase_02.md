# Phase 02 — Punarvasu Design System & UI Foundation

## Objective

Create the complete reusable visual and interaction foundation for Punarvasu.

The goal of this phase is to establish a distinctive, premium, calm and trustworthy design language that can be consistently used across:

* Public website
* Patient portal
* Receptionist workspace
* Doctor workspace
* Admin dashboard

This phase should create the reusable UI foundation.

Do NOT build the complete public website or application pages yet.

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

Then inspect:

* existing UI
* existing Tailwind configuration
* existing shadcn/ui components
* global CSS
* fonts
* layout
* existing theme configuration
* package dependencies

Do not replace working infrastructure unnecessarily.

---

# 2. Design Objective

Punarvasu should feel like:

> Premium Ayurvedic healthcare with modern digital craftsmanship.

The interface should communicate:

* Trust
* Calmness
* Natural healing
* Authenticity
* Warmth
* Professionalism
* Premium quality
* Simplicity

The design must feel appropriate for a healthcare environment while retaining subtle Ayurvedic character.

---

# 3. Design Personality

The visual personality should be:

### Calm

Use generous whitespace and restrained visual noise.

### Natural

Use earthy, botanical-inspired visual cues.

### Premium

Use typography, spacing, imagery and composition rather than excessive decorative effects.

### Human

Avoid making the product feel like a generic SaaS dashboard.

### Modern

Use contemporary layouts and interaction patterns.

### Trustworthy

Healthcare information must always remain easy to read and understand.

---

# 4. Avoid Generic AI-Generated UI

The application must NOT look like a generic AI-generated website.

Avoid:

* excessive gradients
* excessive glassmorphism
* random floating blobs
* excessive rounded cards
* excessive shadows
* excessive green
* huge decorative icons
* meaningless animations
* excessive use of emojis
* generic SaaS dashboard patterns
* overly dense layouts
* unnecessary badges everywhere

Do not add decorative elements merely because they look impressive in isolation.

Every visual element should serve a purpose.

---

# 5. Color System

Establish a complete semantic color system.

The palette should be inspired by:

* Botanical greens
* Earth
* Warm neutrals
* Cream
* Natural wood
* Subtle herbal tones

Do not use dozens of colors.

Create semantic tokens such as:

```text
background
foreground
card
card-foreground
primary
primary-foreground
secondary
secondary-foreground
muted
muted-foreground
accent
accent-foreground
border
input
ring
success
warning
destructive
```

Use CSS variables/design tokens.

Do not hardcode colors repeatedly throughout components.

---

# 6. Color Accessibility

Every important text/background combination must provide sufficient contrast.

Do not use:

```text
light green text
on
light cream background
```

merely because it matches the theme.

Healthcare interfaces require excellent readability.

Verify important combinations against WCAG AA expectations.

---

# 7. Typography

Establish the Punarvasu typography system.

Typography should balance:

* traditional warmth
* modern readability

Use a strong readable body font.

A complementary display font may be used for major headings if it improves the visual identity.

Do not use decorative fonts excessively.

---

# 8. Typography Scale

Define reusable typography levels.

For example:

```text
Display
Heading 1
Heading 2
Heading 3
Heading 4
Body large
Body
Body small
Caption
Label
Button
```

The exact values should be selected based on responsive design requirements.

Do not simply scale desktop typography down proportionally.

---

# 9. Typography Rules

### BAD

Large decorative headings that dominate mobile screens.

### GOOD

A clear hierarchy:

```text
Headline

Supporting message

Primary CTA
Secondary CTA
```

The user should understand the message quickly.

---

# 10. Spacing System

Establish a consistent spacing scale.

Avoid arbitrary values such as:

```text
17px
23px
31px
43px
```

unless genuinely required.

Prefer a predictable spacing system.

The spacing system should support:

* page sections
* cards
* forms
* dashboards
* tables
* dialogs
* navigation
* mobile layouts

---

# 11. Container System

Create consistent page containers.

Support:

* mobile
* tablet
* desktop
* large desktop

Avoid allowing content to become excessively wide on large screens.

Marketing pages and application dashboards may use different maximum widths where appropriate.

---

# 12. Border Radius

Establish a restrained radius system.

For example:

```text
small
medium
large
pill
```

Do not make every element extremely rounded.

The visual language should feel sophisticated rather than playful.

---

# 13. Shadows

Define a small shadow hierarchy.

Use shadows primarily for:

* elevated cards
* dialogs
* dropdowns
* floating elements

Avoid putting large shadows on every card.

### BAD

Every card has a heavy shadow.

### GOOD

Most cards use:

* border
* subtle background contrast

Only important elevated elements use shadows.

---

# 14. Borders

Establish consistent border tokens.

Borders should be:

* subtle
* accessible
* consistent

Avoid using borders as decorative noise.

---

# 15. Responsive Design

Define breakpoints and responsive conventions.

Design mobile-first.

The system must support:

```text
Mobile
Tablet
Desktop
Large desktop
```

Components should adapt naturally rather than simply shrinking.

---

# 16. Mobile Design Principles

Mobile is a first-class experience.

Important requirements:

* Comfortable touch targets
* Readable typography
* No horizontal overflow
* Appropriate spacing
* Easy navigation
* Clear CTAs
* Forms optimized for mobile
* Dialogs that work on small screens

Avoid desktop-style tables where cards or alternative layouts are more appropriate.

---

# 17. Interactive States

Every interactive component should support:

* Default
* Hover
* Focus
* Active
* Disabled
* Loading
* Error where applicable

Do not rely only on color changes.

Focus states must remain visible for keyboard users.

---

# 18. Button System

Create a reusable button system.

Support variants such as:

```text
Primary
Secondary
Outline
Ghost
Destructive
Link
```

Support appropriate sizes.

Buttons must have:

* clear labels
* accessible focus states
* disabled state
* loading state where applicable

---

# 19. Button UX

### BAD

```text
[Submit]
```

### GOOD

Use action-oriented labels:

```text
[Book Consultation]
[Save Changes]
[Confirm Appointment]
[View Treatment]
```

Users should understand what the action will do.

---

# 20. Form System

Create reusable form patterns.

Components should support:

* label
* input
* description
* validation error
* required indicator
* disabled state
* loading state

Example:

```text
Email address
[______________________]

We'll use this email for appointment communication.

Please enter a valid email address.
```

Errors should be understandable.

---

# 21. Form Accessibility

Every input must have a proper accessible label.

Do not rely solely on placeholders.

### BAD

```text
[Enter email]
```

### GOOD

```text
Email address
[Enter your email address]
```

The label remains visible.

---

# 22. Card System

Create a flexible card system.

Card styles should support:

* default
* interactive
* highlighted
* compact
* dashboard/stat
* profile
* content

Do not create a different custom card implementation for every feature.

---

# 23. Badge System

Create semantic badges.

Examples:

```text
Confirmed
Pending
Cancelled
Completed
Draft
Published
```

Badges must not rely only on color.

For example:

```text
✓ Confirmed
```

may be paired with color and text.

---

# 24. Dialog / Modal System

Create accessible dialogs.

Support:

* focus trapping
* keyboard Escape
* correct focus restoration
* mobile behavior
* accessible title/description

Dialogs should not become unnecessarily large forms.

---

# 25. Drawer / Bottom Sheet

For mobile workflows, establish a reusable drawer/bottom-sheet pattern where appropriate.

Useful future cases:

* filters
* appointment actions
* patient quick information
* mobile navigation

Do not force drawers into workflows where a normal page is better.

---

# 26. Tabs

Create accessible tabs.

Tabs should be used only when switching between related content.

### BAD

Using tabs simply because they look visually interesting.

### GOOD

```text
Patient

[Overview] [Appointments] [Documents]
```

Related content belongs together.

---

# 27. Accordion

Create an accessible accordion.

Use it for:

* FAQs
* expandable information
* optional details

Do not hide critical information behind accordions unnecessarily.

---

# 28. Table Foundation

Create a reusable table foundation for future admin/clinic workflows.

Support:

* headers
* sorting foundation
* row hover
* responsive strategy
* empty state
* loading state

Do not implement advanced data-table functionality unless required.

---

# 29. Loading System

Create reusable loading patterns.

Support:

* Skeleton
* Spinner
* Button loading
* Page loading
* Section loading

### BAD

```text
Loading...
```

### GOOD

Use skeletons matching the eventual content structure.

---

# 30. Empty State System

Create reusable empty-state patterns.

Structure:

```text
Icon/illustration
Title
Explanation
Primary action
Optional secondary action
```

Example:

```text
No upcoming appointments

You don't have an appointment scheduled yet.

[Book a Consultation]
```

---

# 31. Error State System

Create reusable error states.

Structure:

```text
Meaningful heading
Explanation
Recovery action
```

Example:

```text
Something went wrong

We couldn't load your appointments.

[Try Again]
```

Never expose raw server errors to users.

---

# 32. Toast / Notification System

Create a consistent toast system.

Support:

* success
* error
* warning
* informational

Toasts should not contain important information that disappears before the user can understand it.

---

# 33. Tooltip System

Use tooltips only for supplementary information.

Do not hide essential instructions inside tooltips.

Ensure keyboard accessibility.

---

# 34. Navigation Foundation

Create the reusable navigation architecture.

The final public navigation will later contain items such as:

```text
Home
About
Treatments
Practitioners
Articles
Contact
```

and a primary CTA:

```text
Book Consultation
```

Authenticated experiences will have different navigation.

Do not implement the final navigation content in this phase.

Establish the reusable structure.

---

# 35. Header

Create a reusable header foundation supporting:

* desktop
* mobile
* logo
* navigation
* CTA
* authenticated state
* mobile menu

Do not create the final homepage header design yet.

---

# 36. Footer

Create a reusable footer foundation supporting:

* navigation
* contact
* clinic information
* legal links
* social links

Content can remain placeholder/config-driven until the public website phases.

---

# 37. Logo / Brand Treatment

If an official Punarvasu logo exists in the repository, use it.

If no official logo exists:

* do not invent a complex final logo
* create a clean text/brand treatment placeholder
* keep it replaceable

Do not fabricate official branding.

---

# 38. Iconography

Use one consistent icon system.

Avoid mixing:

* multiple icon libraries
* random SVG styles
* emoji
* unrelated icon aesthetics

Icons should support understanding rather than decoration.

---

# 39. Imagery Guidelines

Document image usage principles.

Preferred imagery:

* authentic
* natural
* warm
* human
* high-quality
* culturally appropriate
* clinically appropriate

Avoid stereotypical or misleading Ayurveda imagery.

Avoid excessive use of stock images.

---

# 40. Ayurvedic Visual Language

Use subtle references such as:

* botanical textures
* natural materials
* organic shapes
* restrained earthy tones
* elegant Indian-inspired visual details

Avoid:

* excessive mandalas
* excessive Sanskrit decoration
* cliché leaves everywhere
* overly ornate patterns

The interface should feel modern first and Ayurvedic second.

---

# 41. Motion System

Establish a motion language using Framer Motion where appropriate.

Motion categories:

### Micro interaction

Very short.

Examples:

* button feedback
* hover
* focus
* toggle

### Content entrance

Subtle section/card appearance.

### Navigation

Page/menu transitions.

### Feedback

Success/error transitions.

---

# 42. Motion Rules

### BAD

Everything animates.

### GOOD

Animation communicates:

* hierarchy
* state
* continuity
* feedback

Avoid animation in workflows where it slows down doctors/receptionists.

---

# 43. Reduced Motion

Respect:

```text
prefers-reduced-motion
```

When reduced motion is enabled:

* remove unnecessary movement
* reduce transitions
* preserve usability

---

# 44. Accessibility

The design system should target WCAG AA principles.

Verify:

* contrast
* keyboard navigation
* focus states
* labels
* semantic HTML
* screen-reader support
* touch target sizing
* reduced motion
* accessible dialogs
* accessible dynamic feedback

---

# 45. Theme Strategy

The primary Punarvasu experience should be light and natural.

If the project already supports dark mode or requires it:

* preserve it
* ensure all components work correctly
* maintain contrast
* do not simply invert colors

Do not add dark mode merely for novelty.

---

# 46. Component Architecture

Organize reusable UI components cleanly.

Potential structure:

```text
src/components/ui/
    button.tsx
    input.tsx
    textarea.tsx
    select.tsx
    card.tsx
    badge.tsx
    dialog.tsx
    drawer.tsx
    tabs.tsx
    accordion.tsx
    tooltip.tsx
    skeleton.tsx
    toast.tsx
```

Use existing shadcn/ui conventions where appropriate.

---

# 47. Component API Philosophy

Components should have clear, predictable APIs.

### BAD

A component with 20 boolean props:

```tsx
<Card
  rounded
  shadow
  green
  compact
  big
  ...
/>
```

### GOOD

Use composable variants and sensible defaults.

Keep component APIs understandable.

---

# 48. Avoid Premature Abstraction

Do not create a universal component for every possible future scenario.

Build reusable primitives where there is genuine reuse.

Prefer:

```text
Simple reusable primitive
```

over:

```text
Massively configurable "everything component"
```

---

# 49. Component Documentation

Document important reusable components.

At minimum document:

* purpose
* variants
* usage
* accessibility considerations

A component should be understandable to a future developer without reading its entire implementation.

---

# 50. Design Tokens

All reusable visual values should come from the design system where appropriate.

Avoid repeatedly writing:

```css
background: #123456;
border-radius: 17px;
padding: 23px;
```

throughout the application.

Use semantic tokens.

---

# 51. Bad → Good Examples

## Example 1 — Color

### BAD

Every component independently chooses a green.

```text
#527A45
#5C8B50
#48733F
#638F58
```

### GOOD

Use semantic tokens:

```text
primary
primary-foreground
muted
accent
```

The actual palette is controlled centrally.

---

## Example 2 — Cards

### BAD

Every page creates its own card CSS.

### GOOD

Reuse the shared card primitive and compose it.

---

## Example 3 — Buttons

### BAD

```text
Book
Submit
Click Here
More
```

### GOOD

```text
Book a Consultation
Save Changes
View Treatment
View Appointment
```

---

## Example 4 — Error states

### BAD

```text
Error 500
```

### GOOD

```text
Something went wrong

We couldn't load this information.

[Try Again]
```

---

## Example 5 — Animation

### BAD

Every card slides in from different directions.

### GOOD

Use subtle, consistent entrance animation.

---

## Example 6 — Responsive design

### BAD

Desktop UI:

```text
Doctor | Date | Status | Patient | Actions
```

shrunk until it becomes unreadable on mobile.

### GOOD

Transform into a mobile-friendly card/list representation.

---

## Example 7 — Accessibility

### BAD

```tsx
<div onClick={handleClick}>
  Book Appointment
</div>
```

### GOOD

Use the correct interactive element:

```tsx
<button type="button">
  Book Appointment
</button>
```

or an accessible link when navigation is intended.

---

# 52. Expected Files

The exact paths should follow the existing project.

Potential files:

```text
src/
├── components/
│   └── ui/
├── styles/
│   └── globals.css
├── config/
│   └── design-tokens.ts
└── lib/
    └── motion/

docs/
└── design-system.md
```

Do not create unnecessary files.

---

# 53. Existing shadcn/ui Components

If shadcn/ui is already configured:

* customize it to match Punarvasu
* reuse it
* avoid replacing it unnecessarily

If components are missing:

Add only the components required by the design system.

Do not install the entire shadcn/ui catalog without need.

---

# 54. Testing Requirements

Create appropriate tests for reusable components.

At minimum test important interaction primitives.

Examples:

### Button

* renders
* disabled state
* loading state
* keyboard interaction

### Dialog

* opens
* closes
* Escape works
* focus behavior works

### Form controls

* labels exist
* validation errors are associated
* keyboard navigation works

---

# 55. Accessibility Testing

Run available accessibility checks.

Test:

* keyboard navigation
* focus visibility
* contrast
* semantic HTML
* form labels
* dialogs
* dynamic messages

Fix issues introduced during this phase.

---

# 56. Responsive Testing

Test representative components at:

```text
320px
375px
390px
768px
1024px
1280px
1440px+
```

The exact test widths may vary, but verify both small and large screens.

Check for:

* overflow
* clipping
* unreadable text
* broken grids
* inaccessible controls

---

# 57. Performance Requirements

The design system should not introduce unnecessary client-side JavaScript.

Avoid making all UI components client components.

Use CSS for simple visual effects when possible.

Use Framer Motion only where interaction actually benefits.

---

# 58. Security Requirements

This phase should not introduce sensitive data handling.

Nevertheless verify:

* no secrets added
* no unsafe HTML rendering
* no untrusted content injected directly
* no unnecessary third-party scripts
* no sensitive information in demo content

---

# 59. Acceptance Criteria

Phase 02 is complete only when:

### Design system

* [ ] Punarvasu color system established.
* [ ] Typography system established.
* [ ] Spacing system established.
* [ ] Radius system established.
* [ ] Shadow system established.
* [ ] Container system established.
* [ ] Responsive conventions established.
* [ ] Motion conventions established.

### Components

* [ ] Button system implemented.
* [ ] Form controls implemented.
* [ ] Card system implemented.
* [ ] Badge system implemented.
* [ ] Dialog implemented.
* [ ] Drawer/bottom sheet foundation implemented where appropriate.
* [ ] Tabs implemented.
* [ ] Accordion implemented.
* [ ] Tooltip implemented.
* [ ] Skeleton implemented.
* [ ] Toast/notification foundation implemented.
* [ ] Loading state implemented.
* [ ] Empty state implemented.
* [ ] Error state implemented.
* [ ] Navigation/header foundation implemented.
* [ ] Footer foundation implemented.

### Accessibility

* [ ] Keyboard navigation works.
* [ ] Focus states are visible.
* [ ] Form controls have accessible labels.
* [ ] Dialogs are accessible.
* [ ] Contrast is acceptable.
* [ ] Reduced motion is supported.
* [ ] Interactive controls use semantic elements.

### Responsive

* [ ] Mobile works.
* [ ] Tablet works.
* [ ] Desktop works.
* [ ] Large screens work.
* [ ] No unintended horizontal overflow exists.

### Engineering

* [ ] Existing architecture preserved.
* [ ] Components are reusable.
* [ ] No unnecessary dependencies added.
* [ ] No unnecessary client components created.
* [ ] TypeScript passes.
* [ ] ESLint passes.
* [ ] Tests pass.
* [ ] Production build succeeds.

---

# 60. Definition of Done

Phase 02 is complete when the Punarvasu UI foundation is strong enough that future phases can build pages without repeatedly inventing:

* colors
* typography
* spacing
* buttons
* forms
* cards
* dialogs
* loading states
* error states
* empty states
* responsive behavior
* motion patterns

The design system must feel cohesive.

A developer implementing Phase 03 should be able to construct the homepage almost entirely by composing the established primitives and design tokens.

Do not consider the phase complete simply because the components compile.

They must also:

* look coherent
* behave correctly
* be accessible
* work responsively
* have appropriate interaction states
* pass tests
* follow Punarvasu's visual language

---

# 61. Verification

Run the project's actual verification commands.

At minimum:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If these scripts do not exist, follow the project's configured tooling.

Do not claim PASS without actually verifying.

---

# 62. Phase Completion Report

After implementation, report:

## Design system

What was established?

## Components

List reusable components created or modified.

## Files

List files created/modified.

## Dependencies

List dependencies added/removed and why.

## Accessibility

Report accessibility checks performed.

## Responsive testing

Report screen sizes tested.

## Tests

Report actual results:

```text
TypeScript: PASS/FAIL
ESLint: PASS/FAIL
Unit tests: PASS/FAIL
Accessibility: PASS/FAIL
Build: PASS/FAIL
```

## Acceptance criteria

Report every criterion.

## Risks

List any discovered issues.

## Deferred work

List anything intentionally left for future phases.

Do not proceed to Phase 03.
