# Punarvasu — Design System

> **Version:** 1.1
> **Project:** Punarvasu Ayurvedic Clinic
> **Status:** Active — implemented in Phase 02
> **Purpose:** Single source of truth for the visual language, UI components, interaction patterns, accessibility, responsive behavior, and frontend design decisions of Punarvasu.

---

## 0. Implementation Status (Phase 02)

This document is implemented. Where a value below differs from version 1.0, the
reason is recorded inline and marked **Changed in Phase 02**.

| Layer | Where it lives |
| --- | --- |
| Tokens (colour, type, spacing, radius, shadow, motion, z-index, containers) | `src/app/globals.css` |
| Tokens TypeScript needs to read | `src/config/design-tokens.ts` |
| Palette mirror + contrast verification | `src/lib/design/` |
| Motion language | `src/lib/motion/index.ts` |
| UI primitives | `src/components/ui/` |
| Layout and navigation | `src/components/layout/` |
| Brand treatment | `src/components/brand/` |
| Cross-feature state patterns | `src/components/shared/` |
| Navigation content | `src/config/navigation.ts` |
| Live review page | `/design-system` (non-production only) |

**Binding rule:** every foreground/background pair in the palette is asserted
against WCAG AA in `src/lib/design/contrast.test.ts`. A colour may not be
changed without that test passing. Three values in version 1.0 failed it and
were corrected; they are marked below.

---

## 1. Design Philosophy

Punarvasu should feel like a **premium, trustworthy, calm, authentic Ayurvedic healthcare brand**.

The interface must communicate:

* Trust
* Wellness
* Natural healing
* Clinical professionalism
* Authentic Ayurveda
* Warmth and compassion
* Premium quality
* Simplicity
* Serenity

The design must avoid looking like:

* A generic hospital website
* A generic wellness/spa website
* An overly traditional/ornamental Ayurveda website
* A template-based medical dashboard
* A flashy commercial healthcare website

### Core design principle

> **Ancient wisdom, presented through modern clinical excellence.**

The visual language should combine:

**Ayurvedic warmth + modern healthcare credibility + premium editorial aesthetics.**

---

# 2. Design Principles

## 2.1 Calm over clutter

Every screen should have sufficient whitespace.

Avoid:

* Dense layouts
* Excessive cards
* Too many borders
* Excessive badges
* Unnecessary animations
* Information overload

Prefer:

* Spacious layouts
* Clear hierarchy
* Short content blocks
* Strong typography
* Intentional grouping

---

## 2.2 Trust before decoration

Healthcare interfaces must prioritize clarity and credibility over visual decoration.

Important information such as:

* Doctor information
* Treatment information
* Appointment details
* Fees
* Contact information
* Patient instructions

must always be immediately understandable.

---

## 2.3 Natural visual language

Use visual cues inspired by Ayurveda and nature:

* Earth
* Leaves
* Herbs
* Wood
* Clay
* Natural fabrics
* Soft sunlight
* Botanical forms

However, use these subtly.

Do not turn the UI into a heavily decorative "Ayurveda theme".

---

## 2.4 Premium minimalism

Punarvasu should feel premium through:

* Typography
* Spacing
* Composition
* Photography
* Subtle color usage
* Consistency

not through:

* Gradients everywhere
* Excessive shadows
* Glassmorphism
* Excessive rounded cards
* Decorative icons
* Bright colors

---

# 3. Brand Personality

The interface should feel:

| Attribute   | Target      |
| ----------- | ----------- |
| Calm        | Very high   |
| Trustworthy | Very high   |
| Premium     | High        |
| Warm        | High        |
| Natural     | High        |
| Clinical    | Medium-high |
| Traditional | Medium      |
| Modern      | High        |
| Playful     | Low         |
| Loud        | Very low    |

---

# 4. Color System

Use a restrained, earthy palette.

Colors must be defined as design tokens rather than hardcoded throughout components.

## 4.1 Primary colors

```css
--punarvasu-primary-900: #16281F;
--punarvasu-primary-800: #1E3529;
--punarvasu-primary-700: #2A473A;
--punarvasu-primary-600: #355A49;
--punarvasu-primary-500: #467058;
--punarvasu-primary-400: #6D9280;
--punarvasu-primary-300: #A3BCAC;
--punarvasu-primary-200: #D3E0D6;
--punarvasu-primary-100: #E7EFE8;
--punarvasu-primary-50:  #F3F8F4;
```

Primary green represents:

* Ayurveda
* Nature
* Healing
* Stability
* Trust

> **Revised after Phase 03.** Version 1.0 ran from `#173C32` to `#F4F8F5`, a
> desaturated sage. Against a warm page those mid tones read as grey, and the
> product looked like a generic wellness template rather than an Ayurvedic
> clinic. The ramp is now a deeper, cleaner forest green anchored on `#2A473A`,
> which is also the inverted band and the footer.

---

## 4.2 Warm neutrals

Two ramps, not one. Text neutrals run red (sandalwood, cured wood); surface
neutrals run yellow (unbleached paper, raw silk). Collapsing them into a single
ramp is what produced the muddy mid tones of version 1.0.

### Text neutrals

```css
--punarvasu-neutral-900: #2F1D19;
--punarvasu-neutral-800: #3E2723;  /* --foreground */
--punarvasu-neutral-700: #5A423C;  /* --muted-foreground */
--punarvasu-neutral-600: #6F5650;
--punarvasu-neutral-500: #8A716A;
--punarvasu-neutral-400: #A89189;
--punarvasu-neutral-350: #8D746C;  /* --input, the only 3:1 boundary */
--punarvasu-neutral-300: #C9B6AE;
```

### Surface neutrals

```css
--punarvasu-sand-300: #DDCCA9;  /* --border-strong */
--punarvasu-sand-200: #ECE0C8;  /* --border */
--punarvasu-sand-100: #F4E7C8;  /* --secondary */
--punarvasu-sand-50:  #F9EFD6;  /* --muted */
--punarvasu-cream:    #FFF8E1;  /* --background */
```

### The three page surfaces

A long marketing page gets its horizontal banding from exactly three surfaces
and one inversion. A section that wants to separate itself from its neighbour
changes surface; it does not invent a colour.

| Surface           | Token          | Use                                    |
| ----------------- | -------------- | -------------------------------------- |
| Cream `#FFF8E1`   | `--background` | The page. The default band.            |
| Sand `#F9EFD6`    | `--muted`      | The alternate band, and quiet grouping. |
| White `#FFFFFF`   | `--card`       | Cards and raised surfaces only.         |
| Forest `#1E3529`  | `--brand-surface` | The inverted band and the footer.    |

Never use pure white as a page background. The page is warm; white is what
lifts off it.

> **Revised after Phase 03.** The page was `#FAF8F3` with green-grey neutrals.
> It is now cream with brown type, which is the palette of the brand reference
> and the reason the product now reads as apothecary rather than as portal.

---

## 4.3 Accent colors

Use accents sparingly.

### Ayurvedic gold

```css
--punarvasu-gold: #8A6519;         /* text-weight tone */
--punarvasu-gold-surface: #F6EEDA; /* tinted surface */
```

> **Changed in Phase 02.** Version 1.0 specified `#B58A4A`, which reaches only
> 3.0:1 on the page background — below AA for normal text. The darker tone
> holds the same hue at 5.0:1. Use the light tone as a surface, never as text.

Use for:

* Small decorative details
* Premium highlights
* Selected states
* Important visual accents

Do not use gold for large UI areas.

### Terracotta

```css
--punarvasu-terracotta: #8F4A34;
```

> **Changed in Phase 02.** `#A85F48` measured 3.5:1 on the page background.
> The implemented value reaches 6.2:1.

Use sparingly for:

* Secondary visual accents
* Ayurvedic illustrations
* Editorial elements

---

## 4.4 Scrim — text over photography

```css
--scrim: #241611;
--scrim-foreground: #FFFFFF;
```

A deep warm near-black, so a photograph darkens towards the brand's brown
rather than towards a video player.

Its opacity is not a taste decision. `MEDIA_FRAME_SCRIM_ALPHA` in
`src/config/design-tokens.ts` fixes two strengths — 70% and 55% — and
`contrast.test.ts` composites each over a **pure white** photograph and asserts
that white text still clears AA (normal text at 70%, large text at 55%).

That is what lets a hero carry a headline over an image nobody has reviewed. A
component may not invent a third opacity, and a section may not put normal-size
text on the soft scrim.

---

## 4.5 Editorial voice

A marketing section is always the same three parts, and each has its own token.

```css
--eyebrow: #8F4A34;  /* terracotta - the label above a heading */
--heading: #1E3529;  /* primary-800 - every h1-h5, card and dialog title */
--prose:   #2A473A;  /* primary-700 - the copy a visitor reads */
```

The green carries the writing; the brown sits above it as an accent.

These are **not** `--primary` and `--foreground` reused. Those two already have
jobs: `--primary` is the button fill, the link, the icon and the focus ring;
`--foreground` is every form label, table cell and menu item. Recolouring
either one to move an eyebrow turns buttons brown and helper text green. Naming
the editorial roles separately is what lets the palette change again without
touching functional UI.

### Editorial or functional

| Text                                            | Token               |
| ----------------------------------------------- | ------------------- |
| Any `h1`–`h5`, card title, dialog/sheet title    | `--heading`         |
| The label above a heading; a step numeral        | `--eyebrow`         |
| Section copy, card descriptions, FAQ answers     | `--prose`           |
| Form labels, table cells, menu items, input text | `--foreground`      |
| Field hints, captions, placeholders, legal lines | `--muted-foreground` |

The boundary is real: editorial text is what a visitor *reads*, functional text
is what a user *operates*. Do not put form helper text in green.

`--heading` is applied in the base layer to `h1`–`h5`, so a heading added
tomorrow is the right colour without anyone remembering. An inverted surface
overrides it with its own foreground.

---

## 4.6 Inverted surfaces

Any region with a dark background — the brand band, the footer, copy over a
photograph — carries `data-surface="inverted"`.

It does one thing: re-points the focus ring from `--ring` (the primary green,
invisible on a dark surface) to `--brand-surface-foreground`. The rule lives
unlayered in `globals.css` so it outranks a component's own
`focus-visible:outline-ring`.

Do not solve this per component. A future inverted section will forget.

---

# 5. Semantic Colors

Semantic colors must be consistent across the entire application.

```css
--color-success: #397A55;
--color-success-bg: #EAF4ED;

--color-warning: #8A5410;
--color-warning-bg: #FFF4DE;

--color-error: #B44949;
--color-error-bg: #FCECEC;

--color-info: #3C6680;
--color-info-bg: #EAF2F7;
```

> **Changed in Phase 02.** Warning was `#A66A18`, which measures 4.2:1 on the
> page background — below AA. `#8A5410` reaches 5.9:1. Success, error and info
> passed unchanged.
>
> Each semantic colour is implemented as four tokens, not two: a text-weight
> tone, a foreground for use *on* that tone, a tinted surface, and a border.
> See `--success-*`, `--warning-*`, `--destructive-*` and `--info-*`.
>
> The semantic token is named `destructive`, not `error`, so that one token
> covers both a failure message and a destructive action button.

Never rely on color alone to communicate status.

Always combine semantic color with:

* Icon
* Text
* Appropriate ARIA labeling

---

# 6. Typography

Typography should feel **editorial, sophisticated, readable, and human**.

## 6.1 Font strategy

Use a high-quality serif font for major headings and a highly readable sans-serif for UI/body content.

### Display / headings

```text
Playfair Display
```

> **Revised after Phase 03.** Phase 02 implemented Cormorant Garamond, which
> this section lists as interchangeable with Playfair Display. Cormorant is a
> low-contrast face with a small x-height: at the weights this product uses it
> went pale against a warm page and the headings stopped holding the hierarchy
> they were sized to hold. Playfair's higher stroke contrast and larger
> x-height give the same editorial voice with the presence a display size is
> asking for.

### Body / UI

```text
Inter
```

Alternative:

```text
DM Sans
```

The final implementation should use the fonts defined by the project configuration and avoid introducing additional fonts without justification.

> **Implemented in Phase 02, serif revised after Phase 03.** Playfair Display
> (400/500/600) for headings and brand voice, Inter for all functional UI. Both are self-hosted through
> `next/font`, so there is no third-party request and no layout shift. Two
> families, no more. `h1`–`h4` default to the serif in `globals.css`; anything
> functional opts back in with `font-sans`.

---

# 7. Type Scale

Use a consistent responsive type scale.

| Token      | Desktop | Mobile |
| ---------- | ------: | -----: |
| Display XL |    64px |   42px |
| Display    |    56px |   38px |
| H1         |    48px |   34px |
| H2         |    40px |   30px |
| H3         |    32px |   26px |
| H4         |    24px |   22px |
| H5         |    20px |   19px |
| Body Large |    18px |   17px |
| Body       |    16px |   16px |
| Body Small |    14px |   14px |
| Caption    |    12px |   12px |

> **Implemented in Phase 02.** The scale is fluid rather than two fixed sets:
> each step is a `clamp()` interpolating between its mobile and desktop size
> across 375px–1280px. Utilities are `text-display-xl`, `text-display`,
> `text-h1`…`text-h5`, `text-body-lg`, `text-body`, `text-body-sm`,
> `text-caption` and `text-label`. There is no breakpoint override to forget,
> and no step is a proportionally shrunken desktop heading.

### Line heights

Headings:

```text
1.1 – 1.2
```

Body:

```text
1.5 – 1.7
```

Do not use extremely tight line heights for healthcare content.

---

# 8. Typography Rules

### Headings

Use serif typography for:

* Hero headings
* Major section headings
* Brand storytelling
* Editorial content

Use sans-serif for:

* Navigation
* Buttons
* Forms
* Labels
* Dashboard UI
* Tables
* System messages

### Body text

Body text must prioritize readability.

Recommended maximum content width:

```text
60–72 characters per line
```

Avoid long paragraphs spanning the entire viewport.

---

# 9. Spacing System

Use an 8px-based spacing system.

```text
4px
8px
12px
16px
24px
32px
40px
48px
64px
80px
96px
120px
```

Recommended token names:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 40px;
--space-8: 48px;
--space-9: 64px;
--space-10: 80px;
--space-11: 96px;
--space-12: 120px;
```

Use larger spacing between major sections.

> **Implemented in Phase 02.** Tailwind v4's spacing scale is already 4px-based
> and matches this table, so it was kept rather than replaced. Two utilities
> encode the rhythm that pages otherwise re-type: `section-y` (56 / 80 / 112px,
> responsive) and `gutter-x` (20 / 32 / 48px). `measure` caps a text column at
> 68 characters.

---

# 10. Layout System

Use a centered responsive container.

Recommended maximum widths:

```text
Small content: 720px
Standard content: 1120px
Wide content: 1280px
```

Desktop page padding:

```text
32px–48px
```

Tablet:

```text
24px–32px
```

Mobile:

```text
16px–20px
```

Never allow content to touch the viewport edge on mobile.

> **Implemented in Phase 02.** `<Container width="prose | content | wide | full">`
> maps to 720 / 1120 / 1280px and applies `gutter-x`. Marketing sections use
> `wide`; dashboards and standard pages use `content`; long-form copy uses
> `prose`.

---

# 11. Grid

Use a responsive grid.

Desktop:

```text
12 columns
```

Tablet:

```text
8 columns
```

Mobile:

```text
4 columns
```

Prefer flexible CSS Grid layouts rather than hardcoded widths.

Example:

```css
grid-template-columns: repeat(12, minmax(0, 1fr));
```

Cards and content sections should collapse gracefully at smaller breakpoints.

---

# 12. Responsive Breakpoints

Use these baseline breakpoints:

```text
Mobile: < 640px
Tablet: 640px–1023px
Desktop: 1024px–1279px
Large Desktop: ≥ 1280px
```

The design must be mobile-first.

Do not simply shrink the desktop layout.

Instead, reconsider:

* Information hierarchy
* Navigation
* Grid structure
* Button layout
* Image cropping
* Typography
* Content density

---

# 13. Border Radius

Punarvasu should use moderate, elegant rounding.

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```

Guidelines:

* Inputs: `10px`
* Buttons: `10px`
* Cards: `16px`
* Large feature cards: `20–24px`
* Pills: full radius

Avoid excessive "bubble UI".

---

# 14. Shadows

Shadows must be subtle.

```css
--shadow-sm:
  0 1px 3px rgba(25, 40, 32, 0.06);

--shadow-md:
  0 8px 24px rgba(25, 40, 32, 0.08);

--shadow-lg:
  0 20px 50px rgba(25, 40, 32, 0.10);
```

Prefer:

* Borders
* Background contrast
* Spacing

over heavy shadows.

---

# 15. Borders

Default borders should be subtle.

```css
--border: #E2E4DE;        /* dividers and card edges */
--border-strong: #C9CCC5; /* emphasis, secondary button edge */
--input: #83887E;         /* form control boundary */
```

Avoid dark, high-contrast borders unless required for accessibility or emphasis.

> **Changed in Phase 02.** A third token was added. A form control's boundary
> is information, and WCAG 1.4.11 requires 3:1 against the adjacent surface;
> `#C9CCC5` reaches only 1.6:1 on white. `--input` is therefore deliberately
> darker than `--border`, which stays subtle because a divider carries no
> information. This is the one place the design system chooses contrast over
> restraint, and it is not negotiable.

---

# 16. Buttons

Buttons must have clear hierarchy.

## Primary button

Use for the most important action.

Examples:

* Book Appointment
* Confirm Appointment
* Save
* Continue

Characteristics:

* Primary green background
* White text
* Medium weight
* 10px radius
* Minimum height: 44px

---

## Secondary button

Use for secondary actions.

Examples:

* Learn More
* View Treatments
* View Details

Use:

* Transparent or white background
* Green border/text

---

## Tertiary button

Use for low-emphasis actions.

Example:

```text
View all →
```

No container required.

---

## Destructive button

Use only for genuinely destructive actions.

Examples:

* Delete account
* Cancel permanently
* Remove patient data

Always provide confirmation for irreversible operations.

---

# 17. Button States

Every interactive button must support:

1. Default
2. Hover
3. Focus-visible
4. Active/pressed
5. Disabled
6. Loading

Loading buttons must:

* Disable repeated submission
* Preserve button dimensions
* Display a loading indicator
* Communicate state to assistive technology

Example:

```text
Confirm Appointment
        ↓
[ spinner ] Confirming...
```

---

# 18. Forms

Forms are especially important because appointment booking and patient workflows depend on them.

Form design must prioritize:

* Clarity
* Accessibility
* Low cognitive load
* Error prevention

Every input must have a visible label.

Do not rely exclusively on placeholders.

---

## Input height

Recommended:

```text
44px–52px
```

Inputs should have:

* Clear border
* Comfortable horizontal padding
* Visible focus state
* Clear error state
* Appropriate autocomplete attributes

---

# 19. Form Validation

Validation should be:

* Specific
* Human-readable
* Close to the relevant field
* Non-judgmental

Bad:

```text
Invalid input.
```

Good:

```text
Please enter a valid mobile number.
```

Do not clear valid user-entered data when validation fails.

---

# 20. Focus States

Every keyboard-accessible interactive element must have a visible focus state.

Example:

```css
outline: 3px solid rgba(75, 134, 109, 0.30);
outline-offset: 2px;
```

Never remove browser focus indicators without replacing them with an equally visible alternative.

---

# 21. Navigation

The primary navigation should feel:

* Minimal
* Calm
* Premium
* Easy to scan

Typical hierarchy:

```text
Logo
About
Treatments
Doctors
Ayurveda
Resources
Contact

[Book Appointment]
```

The primary CTA should remain visually prominent.

---

# 22. Header

Desktop header:

* Generous horizontal padding
* Logo at left
* Navigation centered/right
* Primary CTA on right

Mobile header:

* Logo
* Menu trigger
* Appointment CTA where space permits

The mobile menu should:

* Be easy to close
* Trap focus appropriately
* Support Escape key
* Prevent inaccessible background interaction

---

# 23. Hero Sections

Hero sections should immediately communicate:

1. What Punarvasu is
2. What makes it different
3. What action the visitor should take

Recommended structure:

```text
Eyebrow
↓
Large headline
↓
Supporting description
↓
Primary CTA + Secondary CTA
↓
Supporting visual
```

Avoid excessively tall heroes that push important information below the fold.

---

# 24. Cards

Cards should be used to group related information.

Good use cases:

* Treatments
* Doctors
* Testimonials
* Services
* Articles
* Appointment summaries

Cards should have:

* Clear heading
* Appropriate spacing
* Consistent padding
* Optional image/icon
* Clear interaction affordance

Avoid putting every piece of content inside a card.

---

# 25. Treatment Cards

Treatment cards should communicate:

* Treatment name
* Short description
* Key benefit
* Optional duration
* CTA

Example hierarchy:

```text
[Image]

Panchakarma
Traditional Ayurvedic detoxification...

Learn about treatment →
```

The card should not make medical claims that are unsupported or guaranteed.

---

# 26. Doctor Cards

Doctor cards should prioritize trust.

Recommended content:

* Professional photograph
* Name
* Qualification
* Specialization
* Experience
* Short introduction
* View profile CTA

Avoid excessive achievement badges.

---

# 27. Appointment UX

Appointment booking is a critical conversion flow.

The experience should feel:

* Simple
* Safe
* Predictable
* Reassuring

Recommended flow:

```text
Choose Doctor
      ↓
Choose Treatment
      ↓
Choose Date
      ↓
Choose Time
      ↓
Patient Details
      ↓
Review
      ↓
Confirmation
```

Show progress clearly.

Example:

```text
1 Doctor → 2 Treatment → 3 Date & Time → 4 Details → 5 Confirm
```

---

# 28. Date and Time Selection

Appointment slots must be visually distinguishable:

### Available

Normal emphasis.

### Selected

Strong primary visual treatment.

### Unavailable

Disabled and visually muted.

### Past

Not selectable.

Never communicate availability through color alone.

---

# 29. Confirmation Screens

After booking, provide a strong confirmation state.

Include:

* Success indicator
* Appointment date
* Time
* Doctor
* Treatment
* Location/online mode
* Patient name
* Reference/booking number
* Next steps

Example:

```text
Your appointment is confirmed.

Tuesday, 24 September
10:30 AM

Dr. ______
Ayurvedic Consultation

Booking ID: PNV-12345
```

Provide obvious next actions:

```text
Add to Calendar
View Appointment
Contact Clinic
```

---

# 30. Notifications and Toasts

Notifications should be:

* Concise
* Action-oriented
* Non-disruptive

Examples:

```text
Appointment confirmed successfully.
```

```text
Your profile has been updated.
```

Errors should explain what happened and what the user can do next.

---

# 31. Modal Dialogs

Use modals only when the user's attention is genuinely required.

Good use cases:

* Confirmation
* Destructive actions
* Important decisions
* Focused forms

Avoid using modals for ordinary navigation.

Modals must:

* Trap focus
* Support Escape
* Have accessible labels
* Restore focus when closed
* Prevent accidental background interaction

---

# 32. Tables

Tables should be used for genuinely tabular information.

Examples:

* Appointment history
* Payment history
* Patient records
* Admin reports

On mobile:

* Allow horizontal scrolling where appropriate
* Or transform rows into structured cards

Do not squeeze desktop tables into unreadable mobile layouts.

---

# 33. Dashboard Design

Authenticated dashboards should be more functional than marketing pages.

Prioritize:

* Information density
* Clear hierarchy
* Quick actions
* Status visibility
* Consistent navigation

Recommended dashboard structure:

```text
Sidebar / Navigation

Main content
├── Page heading
├── Summary
├── Primary actions
├── Important information
└── Secondary details
```

Marketing aesthetics should not compromise usability.

---

# 34. Empty States

Empty states should explain:

1. What is empty
2. Why it may be empty
3. What the user can do

Bad:

```text
No data.
```

Good:

```text
No upcoming appointments

You don't have any upcoming appointments yet.

[Book an Appointment]
```

---

# 35. Loading States

Avoid showing blank screens while data loads.

Use:

* Skeleton loaders
* Progress indicators
* Button loading states

Skeletons should roughly match the final content layout to minimize layout shift.

---

# 36. Error States

Errors should be calm and actionable.

Example:

```text
We couldn't load your appointments.

Please check your connection and try again.

[Try Again]
```

Never expose:

* Stack traces
* Database errors
* Internal IDs
* API details
* Sensitive technical information

to normal users.

---

# 37. Images

Photography is a major part of Punarvasu's premium visual identity.

Preferred imagery:

* Natural light
* Warm tones
* Authentic environments
* Ayurvedic herbs
* Therapies
* Clinic interiors
* Practitioners
* Patients in appropriate non-invasive contexts
* Nature

Avoid:

* Generic stock hospital photography
* Overly staged medical imagery
* Unrealistic before/after imagery
* Fear-based healthcare imagery

All important images require meaningful alt text.

Decorative images should use empty alt attributes.

---

# 38. Iconography

Use one consistent icon family throughout the application.

Recommended:

```text
Lucide
```

Icons should generally be:

* Simple
* Rounded
* Minimal
* Consistent in stroke width

Do not mix multiple icon libraries without a clear reason.

Icons should support text rather than replace essential text.

> **Implemented in Phase 02.** `lucide-react` is the only icon library, and it
> is the only one that may be added. Icons are `aria-hidden` by default; an
> icon-only control takes its accessible name from `aria-label`, which
> `Button`'s type signature makes mandatory for `size="icon"`.

---

# 39. Illustration Style

Illustrations should use:

* Organic shapes
* Botanical motifs
* Fine lines
* Earth-inspired forms
* Minimal visual complexity

Avoid overly cartoonish illustrations.

---

# 40. Decorative Elements

Use subtle decorative motifs such as:

* Leaf silhouettes
* Botanical line drawings
* Organic curves
* Fine dividers
* Soft textures

Decorative elements must never interfere with:

* Readability
* Navigation
* Accessibility
* Interaction
* Performance

---

# 41. Animation

Animation should communicate meaning rather than provide constant visual movement.

Use animation for:

* Page transitions
* Hover feedback
* Expanding sections
* Modal transitions
* Loading
* Success states
* Navigation

Recommended duration:

```text
Fast: 120–180ms
Normal: 200–300ms
Slow: 400–600ms
```

Use natural easing.

Avoid:

* Excessive parallax
* Constant floating animations
* Large bouncing elements
* Distracting entrance animations

> **Decided in Phase 02 — no animation library.** The phase specification
> suggested Framer Motion. It was not added, because nothing in the foundation
> needs a JavaScript animation engine:
>
> * Micro-interactions are CSS transitions.
> * Overlay open/close is CSS keyframes driven by the `data-state` attributes
>   Radix already publishes.
> * The accordion's height animation uses the
>   `--radix-accordion-content-height` variable Radix measures for us.
> * Content entrance is a CSS keyframe; a ~40-line `<Reveal>` component
>   (`components/shared/reveal.tsx`) decides *when* it starts, using an
>   IntersectionObserver.
>
> That keeps the animation runtime out of the client bundle on a platform where
> doctors and receptionists work all day. A later phase with a genuine need —
> shared-element transitions, gesture-driven dragging — should add the library
> deliberately rather than inherit it as a default.
>
> The implemented durations are `--duration-fast: 150ms`,
> `--duration-normal: 240ms`, `--duration-slow: 420ms`, with one easing curve,
> `--ease-natural`. The four categories and their class presets live in
> `src/lib/motion/index.ts`. Everything rises from the same direction, once.

---

# 42. Reduced Motion

Respect:

```css
prefers-reduced-motion: reduce
```

When enabled:

* Disable non-essential animations
* Reduce transition durations
* Avoid large movement
* Preserve essential state transitions

---

# 43. Accessibility

Target:

```text
WCAG 2.2 AA
```

Minimum requirements:

* Keyboard navigation
* Visible focus indicators
* Semantic HTML
* Accessible labels
* Screen-reader support
* Sufficient color contrast
* Proper heading hierarchy
* Accessible form validation
* Accessible modals
* Accessible menus
* Reduced-motion support

Never communicate essential information using color alone.

---

# 44. Touch Targets

Interactive elements should have a minimum effective touch target of approximately:

```text
44 × 44px
```

This applies particularly to:

* Mobile navigation
* Icon buttons
* Calendar controls
* Form controls
* Close buttons

---

# 45. Content Hierarchy

Every screen should answer:

```text
What is this page?
What is important?
What can I do here?
What should I do next?
```

The most important action should have the strongest visual hierarchy.

---

# 46. CTA Hierarchy

Do not place multiple competing primary CTAs together.

Recommended:

```text
Primary:
Book Appointment

Secondary:
Explore Treatments
```

Avoid:

```text
Book Appointment
Contact Us
Learn More
View Doctors
Explore Ayurveda
Get Started
```

all receiving equal visual emphasis.

---

# 47. Healthcare Content Rules

Punarvasu is an Ayurvedic healthcare platform.

UI and content must avoid presenting unsupported medical claims as facts.

Avoid phrases such as:

```text
Guaranteed cure
100% effective
Permanent cure
No side effects
Works for everyone
```

Prefer evidence-aware and responsible wording.

Example:

```text
Ayurvedic approaches may help support overall wellbeing and are personalized according to individual needs.
```

Medical disclaimers should be visible where appropriate without overwhelming the interface.

---

# 48. Privacy-Sensitive UI

Patient information is sensitive.

Never unnecessarily expose:

* Medical information
* Phone numbers
* Email addresses
* Appointment details
* Personal identifiers

Use appropriate masking where required.

Example:

```text
+91 •••••• 4821
```

---

# 49. Mobile-First Rules

On mobile:

* Prioritize primary actions
* Reduce decorative content
* Stack complex layouts
* Keep forms simple
* Use full-width CTAs where appropriate
* Preserve readable typography
* Avoid horizontal overflow
* Keep navigation accessible

Never simply scale down the desktop UI.

---

# 50. Desktop Rules

On desktop:

* Use whitespace intentionally
* Avoid excessively wide text blocks
* Use asymmetric layouts where appropriate
* Allow photography to create visual breathing room
* Maintain a clear reading path

Large screens should feel spacious, not empty.

---

# 51. Z-Index Strategy

Avoid arbitrary z-index values.

Use semantic layers:

```text
Base
Content
Sticky elements
Dropdown
Overlay
Modal
Toast
```

Example:

```css
--z-content: 10;
--z-sticky: 20;   /* site header */
--z-dropdown: 30; /* select, popover, tooltip */
--z-overlay: 40;  /* dialog and sheet scrim */
--z-modal: 50;    /* dialog and sheet panels */
--z-toast: 60;
```

Reference them with Tailwind's variable syntax — `z-(--z-modal)` — never as a
bare number. `--z-base` is omitted: the default stacking context already is
`0`, and a token for it invites `z-0` where no stacking is needed at all.

---

# 52. Component Consistency

Every reusable component must follow the design system.

Do not create one-off versions of:

* Buttons
* Inputs
* Cards
* Badges
* Modals
* Alerts
* Navigation elements

If a new variation is genuinely required, extend the design system rather than creating an isolated component.

---

# 53. Component Variants

Components should use explicit variants.

Example:

```text
Button
├── primary
├── secondary
├── tertiary
└── destructive
```

Avoid boolean-prop explosions such as:

```text
isGreen
isBig
isRounded
isOutlined
isDark
isSpecial
```

Prefer intentional variants.

---

# 54. Design Tokens

All reusable visual values should be represented through tokens.

At minimum define tokens for:

```text
Colors
Typography
Spacing
Border radius
Shadows
Breakpoints
Z-index
Transitions
Container widths
```

Avoid scattering raw values throughout the codebase.

---

# 55. Dark Mode

Dark mode should not be introduced unless explicitly required by the product specification.

If implemented later, it must be treated as a complete semantic color system rather than simply inverting colors.

Healthcare readability and accessibility take priority.

> **Decided in Phase 02.** Not implemented, and the `prefers-color-scheme: dark`
> block that Phase 01 left in `globals.css` as a neutral placeholder was
> removed. It defined four inverted values and no component was built against
> it; carrying it forward would have meant shipping a half-theme that no
> contrast test covered. `color-scheme: light` is set explicitly, so form
> controls and scrollbars stay light even on a device set to dark.
>
> Because every colour is a semantic token, adding dark mode later is a matter
> of redefining those tokens under a selector and extending the contrast test —
> not of revisiting components.

---

# 56. Print Styles

Important healthcare information should remain printable.

Where relevant, support print-friendly versions of:

* Appointment confirmations
* Receipts
* Treatment instructions
* Reports

Hide purely interactive navigation and decorative elements during printing.

---

# 57. Performance-Aware Design

Visual quality must not compromise performance.

Optimize:

* Image sizes
* Image formats
* Lazy loading
* Font loading
* Animation complexity
* Large background assets

Avoid unnecessarily loading large decorative assets above the fold.

---

# 58. Design Quality Checklist

Before considering a screen complete, verify:

### Visual

* [ ] Correct color tokens
* [ ] Correct typography
* [ ] Consistent spacing
* [ ] Consistent radius
* [ ] Appropriate shadows
* [ ] Clear visual hierarchy
* [ ] No unnecessary decoration

### UX

* [ ] Primary action is obvious
* [ ] User knows what to do next
* [ ] Empty states exist
* [ ] Loading states exist
* [ ] Error states exist
* [ ] Success states exist

### Responsive

* [ ] Mobile layout tested
* [ ] Tablet layout tested
* [ ] Desktop layout tested
* [ ] No horizontal overflow
* [ ] Touch targets are adequate

### Accessibility

* [ ] Keyboard navigation works
* [ ] Focus states are visible
* [ ] Labels are accessible
* [ ] Contrast is sufficient
* [ ] Semantic HTML is used
* [ ] Screen reader experience is reasonable
* [ ] Reduced motion is supported

### Healthcare

* [ ] No unsupported medical claims
* [ ] Sensitive information is protected
* [ ] Important medical information is clear
* [ ] Privacy is respected

---

# 59. Golden Rule

When making any new UI decision, prioritize in this order:

```text
1. Accessibility
2. Usability
3. Information hierarchy
4. Consistency
5. Brand identity
6. Visual polish
7. Decoration
```

Never sacrifice accessibility or usability for visual aesthetics.

---

# 60. Implementation Rule for AI Coding Agents

Codex, Claude, and other coding agents working on Punarvasu must treat this document as the **visual source of truth**.

Before implementing a new screen or component:

1. Check whether an existing design-system component can be reused.
2. Reuse existing design tokens.
3. Follow established spacing and typography.
4. Follow responsive rules.
5. Follow accessibility requirements.
6. Avoid introducing a new visual pattern unnecessarily.
7. If a new pattern is genuinely required, implement it consistently and document the new pattern.
8. Do not replace the established visual language with generic UI-library defaults.

### Important

Do not blindly follow existing implementation if it conflicts with this design system.

When there is a conflict:

```text
Product requirements
        ↓
Accessibility
        ↓
Design System
        ↓
Existing implementation
```

The design system should evolve deliberately, not through accidental one-off styling.

---

# 61. Definition of Done — UI

A UI feature is considered complete only when:

* It matches the Punarvasu visual language.
* It uses design tokens.
* It works on mobile, tablet, and desktop.
* It supports keyboard interaction.
* It has visible focus states.
* It has loading, error, empty, and success states where applicable.
* It uses accessible semantic markup.
* It does not introduce unnecessary visual patterns.
* It does not contain unsupported healthcare claims.
* It has been checked for visual consistency with existing Punarvasu screens.

---

# 62. Component Reference (Phase 02)

Every component's own file carries the authoritative documentation: purpose,
variants, usage example and accessibility notes. This table is the index.

**Before building anything, check this table.** Creating a second button,
card or dialog is the failure mode this phase exists to prevent.

## `src/components/ui/` — primitives

| Component | Purpose | Variants / options | Accessibility notes | Client? |
| --- | --- | --- | --- | --- |
| `Button` | All actions | `primary`, `secondary`, `outline`, `ghost`, `link`, `destructive`; `sm`/`md`/`lg`/`icon`; `block`, `loading`, `asChild` | Real `<button>`; `type="button"` by default; `size="icon"` requires `aria-label` at the type level; `loading` sets `aria-busy` and disables | No |
| `Input` | Single-line text | — | 44px min height, 16px text (no iOS zoom); `aria-invalid` styling | No |
| `Textarea` | Multi-line text | — | Shares `Input`'s styling; grows with content | No |
| `Select` | Single choice from a short list, in an interactive surface | — | Radix: arrows, Home/End, type-ahead, Escape; posts a hidden native `<select>` | Yes |
| `NativeSelect` | Single choice **inside a form a patient fills in** | — | A real `<select>`: can carry an empty "not specified" option (Radix reserves the empty string), posts without JavaScript, opens the platform picker on a phone | No |
| `Field` | Labelled form field | `required`, `disabled`, `error`, `description`, `hideLabel` | Owns all ids; binds label, `aria-describedby`, `aria-invalid`, `aria-required`; error is `role="alert"`; never references an element it did not render | Yes |
| `Card` | Grouping related content | `default`, `interactive`, `highlighted`, `elevated`, `muted`; padding `none`/`compact`/`default`/`spacious` | Interactive cards use `CardLink` (a real link with a stretched hit area), never `onClick` on a div | No |
| `Badge` / `StatusBadge` | Status and labels | tones `neutral`/`primary`/`success`/`warning`/`danger`/`info`; statuses from one table | Always icon + text, never colour alone | No |
| `Alert` | Persistent inline message | `info`, `success`, `warning`, `danger` | Urgent tones are `role="alert"`, others `role="status"` | No |
| `Dialog` | Modal confirmation, short focused form | `hideCloseButton` | Radix: focus trap, Escape, focus restoration, inert background. `DialogTitle` is mandatory | Yes |
| `Sheet` | Drawer / bottom sheet / side panel | `side="bottom" \| "right"` | Same guarantees as `Dialog`; built on it rather than a second library | Yes |
| `Tabs` | Switching between related views | — | Roving focus, arrows/Home/End; active tab has weight + underline, not only colour | Yes |
| `Accordion` | FAQs and optional detail | `headingLevel` | Trigger inside a real heading; `aria-expanded`/`aria-controls` | Yes |
| `Tooltip` | Supplementary hints only | — | Opens on focus as well as hover; Escape closes; trigger must be focusable | Yes |
| `Toast` / `Toaster` | Transient confirmation | tones `success`/`error`/`warning`/`info`, optional action | Errors do not auto-dismiss and use `role="alert"`; others are `role="status"` | Yes |
| `Skeleton` / `SkeletonText` | Loading placeholder | `lines` | `aria-hidden`; the surrounding region announces | No |
| `Spinner` | Indeterminate progress | `label` | Decorative unless labelled | No |
| `Table` family | Tabular data | `TableScroller`, `TableSortButton` | `<caption>`, `scope="col"`, focusable scroll region, sort state as text. `TableScroller` is `relative` — **Phase 08**: without it, absolutely positioned content inside a wide table (an `sr-only` label, a marker) resolves against the initial containing block, escapes the scroller and widens the whole document. Measured: 35px of page overflow at 320px | No |
| `Separator` | Divider | orientation, `decorative` | Decorative by default | No |

## `src/components/layout/` and `src/components/brand/`

| Component | Purpose | Notes |
| --- | --- | --- |
| `Container` | Page width + gutter | `prose` / `content` / `wide` / `full` |
| `Section` / `SectionHeader` | Page section + its heading block | `Section` is a real `<section>`; give it `aria-labelledby` |
| `SiteHeader` | Header foundation | Server component; skip link, `banner`, `nav aria-label="Main"`, one CTA, `accountSlot` for authenticated state |
| `MobileNav` | Mobile menu | A `Sheet`; closes on route change |
| `NavLink` | Nav link with current-page state | `aria-current="page"` + underline. `match: "exact"` is required for an index link in a nav that also lists its children |
| `SiteFooter` | Footer foundation | Every block optional; contact and social render only when supplied |
| `Logo` / `BrandMark` | Brand treatment | **Placeholder** — see section 63 |

## `src/components/marketing/` — shared marketing composition (Phase 03-05)

| Component | Purpose | Notes |
| --- | --- | --- |
| `MediaFrame` | Every photograph on the site | Fixed aspect (so no layout shift), anchored crop, **required** `sizes`, verified scrim strengths |
| `PageHero` | The opening band of a secondary public page | Breadcrumb, eyebrow, `h1`, description, actions, optional photograph. Used by `/about`, `/practitioners`, `/contact`; keeps them from drifting apart |
| `ProseSection` | Heading block beside a column of prose | Three page surfaces, optional onward link, optional children beneath the prose |
| `StatementList` | A list of short titled statements | `grid` / `stack`. One implementation of a shape the site makes four times — a brand rule, never a decorative glyph |
| `ProcessSteps` | A numbered sequence | `timeline` / `row` / `grid` |
| `FaqAccordion` | The shared disclosure list | The only client component most pages carry |
| `PractitionerCard` / `PractitionerGrid` | A practitioner in a grid | Can only render what the roster holds; an unverified entry has no name to print and gets no link |
| `ContactChannels` / `ClinicLocation` / `MapEmbed` | The contact experience | `MapEmbed` renders the map with the page (lazily fetched) and carries the address in text beneath it, so the location never depends on the frame |
| `ContactForm` | The enquiry form foundation | Built and tested; **not rendered**, because there is no delivery channel (`features/contact/content.ts`) |

## `src/components/auth/` — authentication UI (Phase 06)

| Component | Purpose | Notes |
| --- | --- | --- |
| `PasswordField` | Password input with a visibility toggle | Built on `Field`, so it inherits the label, `aria-describedby`, `aria-invalid` and `role="alert"` wiring. The toggle is a real `type="button"`, 44x44px, names the *action* rather than the state, and sets `aria-pressed`. Paste is never blocked. |
| `LoginForm` / `RegisterForm` / `ForgotPasswordForm` / `ResetPasswordForm` / `ResendVerificationForm` | The five auth forms | `useActionState` against a server action, so the password never enters client JavaScript. Submit carries `loading` for the whole request. |
| `AuthFormMessage` | The form-level result | One component for all five, so a failure looks and is announced the same way everywhere. `danger` is `role="alert"`, `success` is `role="status"`. |
| `AuthPageHeading` | The `h1` block opening an auth page | Exactly one `h1` per auth page, without each page remembering. |
| `SignOutButton` | Sign out | A form posting to a server action, never a link: a `GET` that changes state can be triggered from another site. |
| `SubmitButton` | Submit with its form's pending state | `useFormStatus`, so a server component can render a plain form and still get a real loading state. |
| `AccountNav` | The account control in the public header | Shows "Sign in" or "My account" and nothing else — no name, no email, no identifiers. Asks `/api/auth/session-status` after hydration so the public pages stay static. **Never an authorization boundary.** |

## `src/components/patient/` — patient area (Phase 07, dashboard Phase 18)

| Component | Purpose | Notes |
| --- | --- | --- |
| `ProfileSection` / `ProfileFieldList` / `ProfileField` | One titled group of profile information, and its label/value pairs | A real `<dl>`. Values render as text — nothing in the patient area uses `dangerouslySetInnerHTML`. An absent value reads "Not provided" rather than leaving a blank that looks like a rendering failure. Carries `min-w-0` and `overflow-wrap: anywhere`, because a long unbreakable email address otherwise sets the min-content width of a flex item and overflows a 320px screen — measured, not theoretical |
| `ProfileSummary` | The profile, read-only | Same four groups as the form, so moving between viewing and editing does not mean re-learning the layout |
| `ProfileForm` | The profile form | **Owns the `<form>` element and takes the action as a prop.** A caller must not wrap it in another form: nested forms are invalid HTML, and after hydration the inner one owns the inputs and submits by GET — which put a patient's name, date of birth and address in the URL. Asserted by test |
| `ProfileEditor` | Switches between the summary and the form | The only client island on the page; the summary it shows is server-rendered and passed in as a prop |
| `ProfileCompletenessPanel` | How complete the profile is, and what would complete it | A real `progressbar` with the percentage also printed as text. Lists each missing item with the reason the clinic wants it — it explains, it does not pressure |
| `PatientNav` | Navigation within the patient area | Composes `NavLink`. "Overview" uses `match: "exact"`, or it and "Profile" would both report `aria-current="page"`. Six items, all `/patient/*`: Notifications is deliberately absent, because `/notifications` is outside this area and a tab that makes its own bar disappear reads as a bug — the reasoning is in `features/patients/content.ts` |
| `DashboardPanel` | One section of the dashboard | **Phase 18.** A real `<section>` named by its own heading, and the level is **always `h2`** rather than a prop — the page owns the single `h1`, so a prop is a thing a caller can get wrong. Defining the shape once is what stops five hand-written sections drifting apart within a phase |
| `NextVisitCard` | The next appointment, or why there isn't one | **Phase 18.** The page's only emphasised surface, and its only primary button above the fold. Renders `found`, `not_found` and `unavailable` as three different things: a failed read must never read as "you have no appointment", which would invite a second booking. A failure here renders inside the panel and says the rest of the page is still current |
| `AttentionPanel` | "What needs your attention?" | **Phase 18.** Items come from `features/patients/attention.ts`, a pure function of stored values — nothing is invented and there is no fake urgency. `action` and `info` are told apart by **icon and wording**, never by tint alone; the `info` tone exists so an unconfirmed appointment can say *there is nothing for you to do*, because in Punarvasu's model the clinic confirms, not the patient. An empty list is a real state with its own calm sentence |
| `CareSummary` | Prescriptions, treatment plans and documents, as three tiles | **Phase 18.** A **date and a way in**, never contents — not a medicine, not a dose, not a plan's title, which a clinician wrote about one patient. The panel states in words that consultation notes stay with the clinic, because an absence nobody explains reads as something missing. Each tile distinguishes "nothing yet" from "could not read" |
| `RecentUpdates` | The newest three notifications | **Phase 18.** Read-only on purpose: no mark-as-read and no cursor, because a second place to manage notifications would be a second thing to keep correct. Unread is the word "Unread", matching the notification centre exactly |

## `src/components/appointments/` - appointment UI (Phase 09)

| Component | Purpose | Notes |
| --- | --- | --- |
| `BookingFlow` | The whole booking journey: type, practitioner, date, time, review | **Owns the single `<form>`**, and carries exactly the four fields the action reads - there is no field for a patient id, a duration, a status or an end time. Type and practitioner are real radio groups inside a `<fieldset>`; the card is the label and the `sr-only` input keeps arrow-key operation and a focus ring via `peer-focus-visible`. A rejected booking returns to the time step and refetches, because the list on screen is then known to be wrong |
| `DatePickerStrip` | Choosing a day | A list of buttons, not a calendar. Only working days inside the horizon are offered, so past and unavailable days are **absent** rather than greyed out - there is nothing misleading to tab through. Accessible name is the full date; the visible label fits across a phone |
| `TimeSlotPicker` | Choosing a time, and the three states that are not that | Buttons in a labelled `<ul>`; selection is `aria-pressed` **plus** a fill **plus** a check mark. Loading is an announced skeleton grid, empty says what to do next, error offers a retry - none is a blank area |
| `useAvailableSlots` | Loading times for a practitioner on a day | Shared by booking and rescheduling, so the three states cannot diverge. Status is *derived* from whether the result in hand answers the question being asked, which makes "yesterday's times under today's heading" unrepresentable rather than merely avoided |
| `AppointmentCard` / `AppointmentList` | An appointment in a list, and the three groups | Cancelled is its own group. Only *upcoming* renders an empty state, because it is the one a patient arrives to act on. The card's link takes its accessible name from `aria-label` - an `sr-only` span produced "View detailsfor Tuesday...", because accessible-name computation trims each text node before concatenating |
| `AppointmentStatusBadge` | A status, as a badge | A translation table onto `StatusBadge`, so the design system keeps owning the tone-plus-icon pairing and this owns Punarvasu's vocabulary. `requested` reads **Requested**, never "Pending" and never anything implying the clinic has agreed |
| `AppointmentSummary` | The detail view | Reuses `ProfileSection`/`ProfileFieldList`/`ProfileField` - they are a titled group and a real `<dl>` despite the name, and a second pair would be the duplication section 32 forbids. Shows a short quotable reference, and no internal identifier |
| `AppointmentHistory` | What has happened to an appointment | Renders nothing for a single event, because "Requested on Tuesday" under "Requested on Tuesday" is not history |
| `CancelAppointmentDialog` | Cancelling, with confirmation | A `Dialog`, so focus trap, Escape and focus restoration are inherited. The reason is optional and says so, and asks the patient to keep it to scheduling |
| `RescheduleForm` | Moving an appointment | Reuses the two pickers and the hook rather than resembling them |

## `src/components/reception/` — the front desk (Phase 10)

This is the one surface where `docs/PRODUCT_SPEC.md` section 5.3 says
efficiency outranks whitespace. It is still the same design system — no new
colour, radius, shadow or spacing value — but the density is higher, the copy
is shorter, and nothing is decorative.

| Component | Purpose | Notes |
| --- | --- | --- |
| `ReceptionNav` | Navigation within the workspace | Composes `NavLink`, like the patient and admin navs. "Today" needs `match: "exact"`, or it and "Schedule" both report `aria-current="page"` |
| `DayOverviewSummary` | How much work today holds | Four counts as a real `<dl>` on the page's own surface. **No cards, no icons, no chart** — `phase_10.md` sections 2 and 56 rule out KPI tiles explicitly. The one figure that is a queue is emphasised only when it has something in it, so "nothing to do" does not look like an alert |
| `ScheduleList` | The day's appointments | **Cards below `md`, a real table from `md` up** — two layouts over one data set, not one squeezed (`docs/DESIGN_SYSTEM.md` section 32). The card layout carries a `tel:` link, because on the device it is for, ringing the patient is the action. The row's link takes its accessible name from `aria-label`, since "Open" is identical on every row |
| `ScheduleFilters` | Narrowing the day | A plain `GET` form and day-stepping **links** — no JavaScript, shareable, bookmarkable, correct under the back button. Deliberately the opposite call from `PatientSearch`; the distinction is what is being put in the URL |
| `AppointmentStatusActions` | Confirm, check in, no-show, cancel | Which buttons appear composes three rules and restates none of them. Confirm and check-in act immediately; no-show and cancel open a `Dialog` first — asking before *every* action is how people learn to dismiss dialogs. A terminal appointment gets a sentence, never a row of disabled buttons |
| `QuickStatusAction` | The one likeliest next action, on a schedule row | `phase_10.md` section 10: prominent but restrained. Renders nothing when there is no non-confirming action |
| `PatientSearch` | Finding a patient | The only client island in the workspace, and a **POST** — a search term is somebody's name, and a URL reaches browser history on a shared front-desk machine. Renders all four states: nothing searched yet, term too short, no matches, failed. Two modes: results link to a record, or hand the patient back to a booking flow |
| `PatientRecord` | The operational record | Reuses `ProfileSection`/`ProfileFieldList`/`ProfileField`. Carries a notice saying the front desk sees operational information only — so a new receptionist learns where the boundary is rather than reading the absence as a loading failure |
| `NewPatientForm` | Registering a walk-in | Owns the single `<form>`. Only a name is required. No field for an account, a credential, a role or anything clinical, and it says both out loud. The duplicate warning's "register anyway" is a submit button carrying its own `name`/`value`, so the acknowledgement needs no state to keep in sync |
| `StaffBookingFlow` | Booking on a patient's behalf | Patient → type → practitioner → date → time → review. Reuses `DatePickerStrip`, `TimeSlotPicker` and `useAvailableSlots` unchanged, so the three states a slot list can be in are identical to the patient flow |
| `StaffRescheduleForm` | Moving an appointment | The same three again. Four flows now share them, which is the point |

## `src/components/doctor/` — the clinical workspace (Phase 11)

Quieter than the front desk. A practitioner is about to give somebody their
attention and the interface should not compete for it (`phase_11.md` section
3) — so the same design system, the same density discipline, but no colour
where a word will do and nothing that reads as an analytics dashboard.

| Component | Purpose | Notes |
| --- | --- | --- |
| `DoctorNav` | Navigation within the workspace | Composes `NavLink`, like the patient, reception and admin navs. "Today" needs `match: "exact"`, or it and "Appointments" both report `aria-current="page"` |
| `DoctorDaySummaryPanel` | How much of the day is left | Four counts as a real `<dl>` on the page's own surface. **No cards, no icons, no chart** — `phase_11.md` sections 3 and 7 rule out KPI tiles. A separate component from the front desk's rather than a shared one, because the *figures* differ: a receptionist counts check-ins, a practitioner counts who is still to be seen |
| `DoctorSchedule` | The practitioner's appointments | **Cards below `md`, a real table from `md` up** — two layouts over one data set, not one squeezed. No practitioner column: every row is theirs. Shows the patient's age, **derived** from the date of birth and never stored. The row's link takes its accessible name from `aria-label`, since "Open" is identical on every row |
| `NextPatientPanel` | Who is with them now, and who is next | A panel, not a card: two cards above a table is clutter. "Now" is a real comparison against stored instants at render time, never a fake live indicator. Links into the consultation when one is under way, and offers to start one when it is not |
| `DoctorAppointmentFilters` | Narrowing the diary | A plain `GET` form — no JavaScript, shareable, correct under the back button. Deliberately the opposite call from `CarePatientSearch`; the distinction is what is being put in the URL. **No practitioner filter**: a control with one option is worse than none |
| `DoctorAppointmentActions` / `PrimaryDoctorAction` / `CompleteConsultationAction` | Confirm, start, complete, no-show | Which buttons appear composes three rules and restates none. Terminal actions ask first and reversible ones do not, because `completed` and `no_show` cannot be put back. Cancelling and rescheduling are **absent**, and a sentence says they happen at the front desk — rather than a disabled control |
| `CarePatientSearch` | Finding a patient in the care scope | The only client island in the workspace, and a **POST** — a search term is somebody's name, and a URL reaches history on a shared consulting-room machine. Renders all four states, and says on the page why the list is shorter than the clinic's |
| `CarePatientSummary` | The patient's context before a consultation | Reuses `ProfileSection`/`ProfileFieldList`/`ProfileField`. Carries a notice naming where clinical records **will** live, so a practitioner does not read the absence as a loading failure. `compact` drops it for the consultation page, which carries its own |

## `src/components/clinical/` — the consultation workspace (Phase 12)


The first surface in the product that holds clinical content. Quieter still
than the rest of the doctor workspace: a practitioner writing up a consultation
is composing prose about a person, and `phase_12.md` section 66 asks that the
screen not feel like a generic enterprise form.

Same design system, same tokens, no new colour, radius, shadow or spacing
value. What changes is the density: narrative fields get room, sections get
headings, and nothing decorative competes with the text being written.

| Component | Purpose | Notes |
| --- | --- | --- |
| `ConsultationForm` | The clinical record, edited | **Owns the single `<form>`** and carries exactly ten fields — eight clinical, a record id and a version — and nothing that would be a claim about identity. Two submitters, not two forms: the completion one is a hidden `<button formAction>` *inside* the form, because `DialogContent` renders in a portal and a button in the dialog is not a descendant. The eight textareas are marked required for **completion** and are deliberately **not** HTML-`required`, or the browser's own validation refuses to save an incomplete draft — measured, not theoretical |
| `ClinicalFormSection` | One titled group of fields | A real `<fieldset>` with a `<legend>`, so the group's name is part of each field's context rather than a visual heading a screen reader passes over. Three groups in the order a consultation runs |
| `SaveStatus` | Whether the notes are in the database | A persistent `role="status"` region, **not a toast** — section 69 rules out a message that disappears before the practitioner can read it. Five states, each with an icon and a word as well as a tone. "Saved" carries a **time**, because "Saved" alone is indistinguishable from "Saved half an hour ago" |
| `UnsavedChangesGuard` | Stops somebody walking away from unsaved notes | Two mechanisms, because section 67 says not to rely solely on browser unload: `beforeunload` for refresh and tab close, and a **capture-phase document click listener** for in-app navigation, so a link added to this page later is covered without anybody remembering. Three answers, with the safe one primary. The browser back button is not covered — recorded, not pretended |
| `ClinicalRecordView` | A completed record, read | Prose, **not a form with disabled inputs**. A disabled control says "not right now"; a completed clinical record is finished permanently. An unwritten section reads "Not recorded" rather than vanishing, because on a clinical record a missing heading and an empty one must not look alike |
| `PatientClinicalHeader` | Who is in front of you | Sections 28-29: writing an assessment onto the wrong record is a patient-safety failure, so the name is a heading, not a label. Date of birth, **derived** age, gender and phone — the four things that tell two people with the same name apart. No address, no emergency contact |
| `ClinicalHistory` | Consultations this practitioner documented | **No clinical content in the list** — when, what kind, whether it is finished, and a way in. The query does not fetch the notes either. Cards below `md`, a real table from `md` up |
| `ClinicalRecordStatusBadge` | Draft, completed or amended | A translation table onto `StatusBadge`, so the design system keeps owning the tone-plus-icon pairing. `draft` is the **neutral** preset, not a warning: an unfinished consultation is an ordinary state a practitioner chose |
| `StartConsultation` | Opens the record for an appointment | Carries exactly an appointment id. Disabled for the duration of the request — the first of three layers against a double-click, the other two being `on conflict do nothing` and a unique index |

### Two rules this workspace added to the system

**A field marked required for a *workflow step* must not be HTML-`required`.**
`Field`'s `required` prop sets the attribute, which is right for every form
before this one. On a form with a draft state it silently disables saving:
the browser refuses to submit while the field is empty, which is precisely the
state the draft exists to hold. Mark it with `required` for the label and the
`aria-required`, then set `required={false}` on the control after the spread.

**A save state is a region, not a toast.** Anywhere a person can lose work by
closing a laptop, the answer to "is this saved?" has to be on screen
continuously and has to carry a time. A toast answers once and leaves, and the
question gets asked again every few minutes.

### One rule this workspace added to the system

**A table's `<caption>` must not repeat the heading above it.**
`TableScroller` is a labelled `region` landmark and so is a `<section>` with
an `aria-labelledby`; two regions with one accessible name is an axe
`landmark-unique` violation. Every caption in this workspace names the
*ordering* as well as the contents — "Previous appointments with you, most
recent first" — which makes the names distinct and tells a screen-reader user
something the sighted reader gets from the column order for free.

Found by Phase 11's browser pass, on three Phase 11 pages and two Phase 10
ones. Guarded by a copy-level assertion in `tests/components/doctor.test.tsx`,
because jsdom renders these components in isolation and never sees the
collision.


## `src/components/prescriptions/` — prescribing (Phase 13)

| Component | Purpose | Client? |
| --- | --- | --- |
| `PrescriptionBuilder` | The repeatable item builder, the save state, the review and the issue and withdraw dialogs. One `<form>` carrying four fields; the items travel as one JSON array | yes |
| `MedicineNameField` | A WAI-ARIA combobox offering names this practitioner has prescribed before, debounced at 220ms, with stale replies discarded. Not a catalog and never preselected | yes |
| `PrescriptionItems` / `PrescriptionInstructions` | A prescription rendered to be read — a numbered list of headings with the facts beneath each, not a table. Used by the doctor's review, the doctor's detail page and the patient's copy, so all three cannot disagree | no |
| `PrescriptionHistory` | The practitioner's list for one patient. Cards below `md`, a table above. No clinical content | no |
| `PrescriptionStatusBadge` | Icon plus word, never colour alone. `cancelled` reads as *Withdrawn* | no |
| `WithdrawPrescription` | The one action left on an issued prescription. Asks first; the reason field says the patient will see it | yes |
| `StartPrescription` | Opens a draft against a consultation. One hidden field: which consultation | yes |

## `src/components/treatment-plans/` — care planning (Phase 13)

| Component | Purpose | Client? |
| --- | --- | --- |
| `TreatmentPlanBuilder` | Title, summary, dates and instructions by section, with the same save state and review discipline | yes |
| `TreatmentPlanSections` | A plan rendered grouped by section, with empty sections omitted | no |
| `TreatmentPlanHistory` | The practitioner's list for one patient | no |
| `TreatmentPlanStatusBadge` | Icon plus word | no |
| `TreatmentPlanActions` | Complete or withdraw an active plan. Both ask first; neither edits | yes |
| `StartTreatmentPlan` | Opens a draft against a consultation | yes |

## Shared clinical primitives (Phase 13)

| Component | Purpose | Client? |
| --- | --- | --- |
| `SaveState` | The save indicator, extracted from `components/clinical/` so three clinical surfaces make one promise: the words say what the *server* did, not what the button was pressed. The words are a prop | yes |
| `UnsavedChangesGuard` | The navigation guard, extracted for the same reason. Covers refresh, tab close and every in-app link; the browser's back button within the application is still not covered | yes |
| `ClinicalContextHeader` | Who this is for and which visit it belongs to, with a **derived** age. Shown above both builders so documenting the wrong patient takes effort | no |

## `src/components/analytics/` — analytics (Phase 16)

Calm, and deliberately not a SaaS dashboard. A small set of meaningful figures
in plain type on the page's own surface — no card per figure, no icon, no
percentage-change badge invented from a comparison nobody asked for — then a
trend, then the breakdowns as tables. `phase_16.md` sections 11 and 116 warn
against the wall of tiles; the front desk's day overview established the shape
in Phase 10 and this follows it.

**One data colour.** `--chart-series` is its own semantic token rather than
`--primary`, because a page of bars painted in the button fill reads as a row
of controls somebody could press. It carries four SC 1.4.11 assertions in
`contrast.test.ts` — a bar is a non-text graphical object that conveys the
information the chart exists to convey. A second series would be the point at
which a categorical ramp is designed and validated as a set, rather than a
second green chosen because it was next in the ramp.

| Component | Purpose | Client? |
| --- | --- | --- |
| `AnalyticsPanel` | The four states every panel can be in: ready, empty, unavailable, refused. A refused panel renders **nothing** — the reader was never offered that report, and naming it discloses it | No |
| `MetricList` / `MetricNote` | A row of figures as a description list, so each is announced with its label. `MetricNote` typesets the sentence that keeps a figure from being misread | No |
| `TrendChart` | Bars, one series, **and a real table always rendered beside them**. The SVG is `aria-hidden` (it is a redundant presentation of the table); a visible summary states the total, the period and the peak; every bar carries a native `<title>`; a zero bucket draws a visible stub rather than a gap | No |
| `AnalyticsTable` / `ProportionCell` | Captioned, `scope="col"`, named focusable scroller, tabular figures. `ProportionCell` prints the number beside the bar, so removing all colour loses nothing | No |
| `DateRangeFilter` | A plain `GET` form — a period is not sensitive, so the URL makes the view shareable and correct under the back button. Declines the interactivity its directive buys: no handler, so it works before hydration | Yes (for `Field`) |
| `AnalyticsFreshness` | When the figures were read, and a link to read them again. States a real query time, because nothing is cached | No |
| `MetricDefinitions` | How every figure on the page is calculated, as a `<details>`. Section 92's "prevents ambiguous reporting" only holds if the definition reaches the reader | No |
| `AppointmentReportExport` | A `POST` form to the export route, naming the file's columns before it is created | No |
| `AnalyticsLoading` | The page's shape while it is being read | No |
| `AppointmentSummaryPanel`, `AppointmentTrendPanel`, `PractitionerWorkloadPanel`, `UtilizationSummary` | The panels the three dashboards share, so the number an administrator quotes and the number a receptionist quotes are produced by one piece of code | No |
| `PatientGrowthPanel`, `NotificationPanel`, `ClinicalActivityPanel` | The clinic-wide panels, each carrying the sentence that stops its figures being misread | No |

## `src/components/notifications/` — the notification centre (Phase 15)

Quiet. A notification is an interruption already, so the surface that holds
them does not add a second one: no red dot with no number, no toast that
duplicates a durable record, no animation on arrival.

| Component | Purpose | Client? |
| --- | --- | --- |
| `NotificationBell` | The unread count in the authenticated header. A **server component**, so the number is authorized server state rather than something the browser keeps — and so the header still ships no JavaScript. A link to a page rather than a panel: a panel is a focus trap and a second place notifications are rendered, whereas a link works before hydration, opens in a new tab and is easy to hit on a phone. The count is in the link's accessible name, so a screen reader and a colour-blind reader get what a coloured dot would have given only to somebody who can see it | no |
| `NotificationList` | The list, as cards at every width — a notification is a short message, not a row of fields. Two empty states, because "you're all caught up" is right for an empty inbox and wrong for an empty *unread* filter, where the answer is "switch to All" | no |
| `NotificationItem` | Title, message, absolute time, read state, and a way in. **Unread is the word "Unread"**, not a tint. A real `<a>` to the resource *and* a separate mark-as-read button, so middle-click and a screen reader's link list keep working; each button's accessible name carries the notification's title, because twelve identical "Mark as read" buttons is a list nobody can navigate | no |
| `NotificationFilters` | All / Unread, as two links. The filter lives in the URL so the view survives the back button — unlike the patient search of Phases 10 and 11, which is a POST precisely because a search term is somebody's name and "unread" is not | no |
| `MarkAllNotificationsReadForm` | A form carrying **no fields at all**, and a confirmation that says "you had no unread notifications" when that is what happened | yes |
| `NotificationPreferencesForm` | One form per control rather than one save button, so one failure is attributable to one setting. A mandatory or unconfigured channel renders **disabled with the reason beside it**, because a disabled control with no explanation reads as a bug | yes |

Two rules this area adds:

* **Unread is never colour alone.** WCAG 1.4.1, and `phase_15.md` section 90.
  The badge is a word, the bell's count is in its accessible name, and the
  tint is decoration on top of both.
* **A preference that cannot take effect is not offered.** Email is disabled
  and says why when no provider is configured. Offering a control that
  silently does nothing is how a patient concludes the clinic lost their
  messages.

## `src/components/documents/` — patient documents (Phase 14)

Calm and clinical, not a file manager. A patient's lab report is not a photo
in an album, so there are no thumbnails, no grid, no drag-target the size of
the page and no upload widget borrowed from a productivity app.

| Component | Purpose | Client? |
| --- | --- | --- |
| `DocumentUploadForm` | The upload. A native `<input type="file">` rather than a custom drop zone, because on a phone — which is where a patient photographs a report — the native picker is the one that reaches the camera. Posts to `/api/patient-documents` through `XMLHttpRequest`, which is the only browser API that reports **byte** progress; the progress bar is a real `progressbar` with `aria-valuenow`, and a polite live region announces the *phase* rather than every percentage point. **No HTML `required`** — with a JavaScript submit handler the browser refuses to fire `submit` at all, so the button would do visibly nothing. The file is read from the input's own `files` list rather than from `new FormData(form)`, which makes "no file chosen" a state the component can name, and which is also what makes the form drivable in jsdom | yes |
| `DocumentList` | Cards below `md`, a table from `md`. Title, type, date and size — **no storage path, no checksum, no patient id**, verified in a browser. Each document is named once even though both layouts are in the DOM | no |
| `DocumentDetails` | What this document is, who added it, when, and which visit it belongs to. Built on `ProfileSection`/`ProfileFieldList` so it reads like the rest of the patient's record | no |
| `DocumentViewer` | Preview and download. An image goes in an `<img>`; a PDF goes in an `<iframe sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer">` whose origin is the storage service's, not the application's. **Never `next/image`** — that would proxy a patient's file through the image optimizer and cache it on a shared CDN. The signed URL is requested only when somebody asks, lives in component state, and the viewer closes itself before the URL lapses rather than showing a broken frame | yes |
| `ArchiveDocumentDialog` | Withdrawing a document from the working record. Asks first, takes a reason, and says plainly that the document is kept and stays downloadable — because "Delete" would be a promise the product deliberately does not keep | yes |
| `DocumentStatusBadge` / `DocumentTypeLabel` | Icon plus word, never colour alone. An archived document reads as *Archived* and still offers its download | no |

Three rules this area adds:

* **A preview is inert or it is absent.** Only the four formats a browser
  renders without executing anything are previewable. HEIC and HEIF are
  accepted for upload — it is what an iPhone produces — and are deliberately
  not previewable, because no browser renders them and an empty frame is
  worse than an honest "download it to open it".
* **The product does not claim a safety it does not have.** The upload form
  says there is no malware scanning, in the patient's own words, rather than
  implying a guarantee by saying nothing.
* **Nothing identifying is rendered.** No storage path, no checksum, no
  internal id, and no document id in a URL — access is a server action, so a
  title never reaches browser history on a shared machine.

## `src/components/admin/` - access management (Phase 08)

| Component | Purpose | Notes |
| --- | --- | --- |
| `UserAccessTable` | Every account and the role it holds | A server component built on the `Table` family. The signed-in administrator's own row carries a sentence explaining why it has no control, rather than a disabled control with no reason — the rule is enforced in the action and again in the database. Shows a name, an address, a role and verification state, and **no patient information**. Verification is a `Badge` with an icon as well as a colour |
| `RoleAssignmentForm` | The role control on one row | The only client component in the area. The hidden `targetUserId` is safe to render because it says *what* to change, never *whether*: the actor, the actor's role and the self-targeting rule are all resolved server-side and again inside `assign_user_role()`. The `<select>` is labelled after the person, so a screen-reader user hears whose access they are about to change |

## `src/components/layout/app-nav.tsx` — authorization-aware navigation

| Component | Purpose | Notes |
| --- | --- | --- |
| `AppNav` | The areas the signed-in role can enter | A server component; takes the role as a prop so it resolves nothing itself. Reads the same table the guards read, so a link cannot be offered for an area the guard will refuse — and an area cannot acquire a link while nobody remembers to guard it. Renders **nothing** for a role with no area, rather than a link to a workspace that does not exist |

## `src/components/shared/` — state patterns

| Component | Purpose |
| --- | --- |
| `SectionLoading` / `CardListLoading` / `PageLoading` | Announced loading regions; skeletons first, spinner only when the shape is unknown |
| `EmptyState` | What is empty, why, what to do next |
| `ErrorState` | Region-level failure: heading, plain explanation, recovery action, opaque reference |
| `StatusMessage` | Page-level status; owns `<main>` and the `<h1>` |
| `Reveal` | One-time content entrance |

---

# 63. Brand Treatment Status

**Resolved in Phase 03.** The clinic's own artwork (`public/images/logo.png`,
a circular badge carrying the wordmark, the Devanagari form and "Ayurvedic
Chikitsalaya") is now used by `components/brand/logo.tsx`. Phase 02's abstract
placeholder mark has been removed; `Logo`'s markup, sizing and link behaviour
are unchanged, which is exactly what the placeholder was built to allow.

At header size the text inside the badge is not legible, so the lockup pairs
the badge with the wordmark set in the brand serif. The badge is therefore
decorative (`alt=""`) and the accessible name comes from the link's
`aria-label`. `showSubline={false}` drops the "Ayurvedic Chikitsalaya" line in
narrow columns such as the footer, where it would otherwise wrap mid-phrase.

**The favicon is still the Next.js default** and should be generated from the
badge.

**Updated in Phase 05.** `config/clinic.ts` is still the single source for
address, phone, email, opening hours and social profiles, and every field is
still optional. The clinic supplied its **postal address** and **phone
number**, so those are now published — in the footer, on the contact page, on
the home page's `LocationSection` and in the `MedicalClinic` JSON-LD. **Email,
opening hours and social profiles remain unverified** and are therefore still
absent; `ContactChannels` renders a short sentence saying a detail has not
been confirmed rather than omitting the row, because "what time do they open?"
is a question the visitor arrived with.

`config/images.ts` records which photographs are placeholders — still all of
them except the logo. No photograph of the clinic's own rooms exists, so the
About page says so in words instead of showing a stock interior.

---

## 64. Phase 03 Additions

**`--brand-surface` token family.** A deep-green inverted band for marketing
pages: `--brand-surface`, `-foreground`, `-muted`, `-border`, `-accent`. Added
because "an inverted section" is a reusable structural idea — without a token
for it every page reaches for an arbitrary green and the inversions drift.
Every foreground pair is asserted against WCAG AA in `contrast.test.ts` (white
9.97:1, muted 7.29:1, gold accent 8.71:1). `--brand-surface-border` is a
decorative divider and carries the same exemption from the 3:1 non-text rule
that `--border` does. Use it at most once per page; two inversions make it a
pattern rather than an accent.

**`anchor-offset` utility.** `scroll-margin-block-start` clearing the sticky
header (80px, 112px from `lg`). Every element that a navigation anchor targets
must carry it, or the jump lands with the heading hidden behind the bar.

**`cn()` now declares the type scale to `tailwind-merge`.** This fixed a silent
defect present since Phase 02: `tailwind-merge` resolves each class to one
conflict group by matching Tailwind's *default* scale, so `text-h2` matched
none of it, was filed under `text-color`, and was **deleted** by the
`text-foreground` sitting beside it in the same `cn()` call. Every heading
rendered through `SectionHeader`, `CardTitle` or `CardDescription` was falling
back to inherited body size. `src/lib/utils/cn.ts` now declares the
`--text-*` steps as a `font-size` group, and `cn.test.ts` fails if a step is
added to `globals.css` without being declared there.

**`AccordionTrigger` opts back into `font-sans`.** The trigger lives inside a
real heading element, and the base layer gives every heading the brand serif —
so FAQ questions were rendering as light serif body text. A disclosure control
is functional UI, not brand voice.

---

## Final Design Direction

Punarvasu should ultimately feel like:

> **A modern Ayurvedic institution with the serenity of nature, the credibility of a premium healthcare practice, and the refinement of a contemporary wellness brand.**

The design should be **quietly premium rather than loudly luxurious**.

Every element should feel intentional.
Every interaction should feel reassuring.
Every screen should feel calm, trustworthy, and effortless.
