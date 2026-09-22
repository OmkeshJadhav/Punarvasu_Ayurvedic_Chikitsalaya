## PHASE 03 — Premium Public Home Experience

Status:
COMPLETED

Completed On:
2026-09-17

Summary:
Built the public website shell and the Punarvasu Home page: a route group with
a marketing header and footer, ten narrative sections composed from the Phase
02 design system, typed marketing content separated from presentation, Home
page metadata with a generated Open Graph card, `MedicalClinic` structured
data built only from verified facts, a sitemap and robots policy, and a
temporary truthful destination for the primary CTA. 321 tests pass. The live
page has zero axe violations at 390px and 1280px with real computed contrast,
and zero horizontal overflow at nine viewport widths.

Three defects inherited from Phase 02 were found and fixed — one of them had
been silently disabling the entire type scale.

> **Revised on 2026-09-17, after completion.** The palette, the serif and the
> hero were rebuilt on client feedback that the original UI read cold and
> template-like. Everything below describes what the phase *shipped*; the
> **Post-completion UI revision** section at the end of this document records
> what changed afterwards, which measurements were re-run against the new UI,
> and which statements below it supersedes. Decisions 7 and 8 no longer hold.

---

### Repository assessment before starting

Phase 02 left a complete design system and an explicitly placeholder homepage.
What existed and was reused rather than rebuilt: `Container`, `Section`,
`SectionHeader`, `Card`/`CardLink`, `Button`, `Badge`, `Accordion`,
`EmptyState`, `Reveal`, `SiteHeader`, `SiteFooter`, `MobileNav`, `NavLink`,
`Logo`, the token system and the motion language. No marketing component
existed; no public page existed beyond a placeholder `/`.

`public/images/` held nine assets that Phase 02 never saw: the clinic's real
logo, and eight photographs. Five of the photographs were JPEGs with a `.png`
extension — renamed to `.jpg`, because `/public` sets `Content-Type` from the
file extension and serving a JPEG as `image/png` is a mislabelled response
rather than a cosmetic problem.

---

### Implemented

**Public shell**

* `src/app/(public)/layout.tsx` — a route group so the marketing chrome wraps
  public pages only. The root layout stays responsible for `<html>`, `<body>`,
  fonts and tokens; the portal and staff workspaces get their own groups.
* `<main id="main-content">` lives in the layout, not in each page, so the
  header's skip link can never point at a target a page forgot to render.
* Header, mobile menu, footer are all Phase 02 components, driven by config.

**Home page** — `src/app/(public)/page.tsx`, ten sections in narrative order:

| Section | Component | Notes |
| --- | --- | --- |
| Hero + trust strip | `marketing/hero.tsx` | Owns the page's single `<h1>`; the one `priority` image |
| What is Punarvasu | `intro-section.tsx` | Image left from `lg`, alternating against the hero |
| Our approach | `approach-section.tsx` | Typography and a rule, not cards |
| Consultation areas | `service-preview.tsx` | Data-driven; empty list renders an empty state |
| Why Punarvasu | `why-punarvasu.tsx` | Four differentiators on the muted band |
| Your journey | `patient-journey.tsx` | Vertical timeline on mobile, horizontal from `lg` |
| Ayurvedic philosophy | `philosophy-section.tsx` | The page's one inverted brand band |
| Practitioners | `practitioner-preview.tsx` | Renders the unpublished state; invents nobody |
| FAQ | `faq-section.tsx` | The only client component on the page |
| Visit us | `location-section.tsx` | Renders `null` — no verified clinic details |
| Final CTA | `final-cta.tsx` | One action, calm |

**Shared marketing primitive**

* `marketing/media-frame.tsx` — every photograph goes through it, so the
  aspect ratio (and therefore the reserved space, and therefore CLS), the
  `object-position` crop, and a **required** `sizes` prop are handled once.

**Content architecture**

* `src/config/marketing-content.ts` — all Home page copy, typed, reviewable by
  a clinician without reading React, and the seam a CMS replaces later.
* `src/config/clinic.ts` — the single source of clinic facts. Every field
  optional, every field currently absent.
* `src/config/images.ts` — every image declared once with real intrinsic
  dimensions, alt text, crop position and a `placeholder` flag.
* `src/config/navigation.ts` — rewritten for the anchor strategy below.

**SEO**

* Home metadata: title (`absolute`, to escape the root `%s | Punarvasu`
  template), description, canonical, Open Graph, Twitter `summary_large_image`.
* `src/app/(public)/opengraph-image.tsx` — a 1200×630 brand card generated with
  `next/og`, which ships with Next.js. The photographs are square placeholders
  that crop badly to 1.91:1.
* `src/lib/seo/structured-data.ts` — `MedicalClinic` JSON-LD that **omits** any
  property the clinic has not supplied, and never constructs `aggregateRating`,
  `review`, `priceRange` or `openingHours` at all.
* `src/app/sitemap.ts`, `src/app/robots.ts`.

**Brand**

* `components/brand/logo.tsx` now uses the clinic's real artwork. Phase 02's
  abstract placeholder mark is gone; no caller changed.

---

### Files Added

```text
src/app/(public)/layout.tsx
src/app/(public)/page.tsx
src/app/(public)/opengraph-image.tsx
src/app/(public)/appointments/new/page.tsx
src/app/robots.ts
src/app/sitemap.ts
src/components/marketing/{approach-section,faq-section,final-cta,hero,
    intro-section,location-section,media-frame,patient-journey,
    philosophy-section,practitioner-preview,service-preview,
    why-punarvasu}.tsx
src/config/{clinic,images,marketing-content}.ts
src/lib/seo/structured-data.ts
src/lib/seo/structured-data.test.ts
src/lib/utils/cn.test.ts
tests/components/home-page.test.tsx
tests/components/marketing.test.tsx
docs/progress/progress_phase_03.md
```

### Files Modified

```text
src/app/globals.css            --brand-surface token family; anchor-offset utility
src/lib/utils/cn.ts            declares the type scale to tailwind-merge (see Defects)
src/lib/design/palette.ts      brand-surface mirror entries
src/lib/design/contrast.test.ts  3 new AA assertions for the brand band
src/config/navigation.ts       anchor-based public nav; empty legal items; rationale
src/components/brand/logo.tsx  real artwork; showSubline prop; 44px target
src/components/layout/site-header.tsx   skip-link padding under the focus variant
src/components/layout/site-footer.tsx   footer logo drops the subline
src/components/ui/accordion.tsx         trigger opts back into font-sans
src/components/shared/reveal.tsx        asChild, so a staggered list stays a list
tests/components/navigation.test.tsx    decoupled from placeholder nav content
docs/PUNARVASU_MASTER_SPEC.md  status, routes, phase table
docs/DESIGN_SYSTEM.md          §63 brand status resolved; §64 Phase 03 additions
```

### Files Renamed

```text
public/images/{arthritis,hero,skincare,spotlight,stress}.png -> .jpg
```

(They were JPEG files carrying a `.png` extension.)

### Dependencies

**None added.** `next/og` ships with Next.js. No animation library, no
carousel, no CMS, no icon library beyond the `lucide-react` already present.

---

### Defects found and fixed

Three were pre-existing Phase 02 defects, surfaced by putting the design system
under real content for the first time. All were caught by verification, not by
reading the code.

**1. `tailwind-merge` was deleting the entire type scale.** *(serious)*

`cn("text-h2", "text-foreground")` returned `"text-foreground"`.
`tailwind-merge` resolves each class into exactly one conflict group by
matching Tailwind's default scale; `text-h2` matched nothing, so it was filed
as a text *colour* and the colour beside it won. Every heading rendered through
`SectionHeader`, `CardTitle` or `CardDescription` — which is nearly all of
them — was falling back to inherited 16px body text. The fluid type scale Phase
02 built and documented was not reaching the screen.

Fixed in `src/lib/utils/cn.ts` by declaring the `--text-*` steps as a
`font-size` class group. `src/lib/utils/cn.test.ts` asserts every step survives
beside a colour, that the steps still conflict with each other, and that the
list has not drifted from `globals.css`.

This was invisible in code review and invisible in jsdom. It was found by
screenshotting the built page and noticing a section heading was smaller than
the paragraph under it.

**2. FAQ questions rendered in serif body text.** The base layer gives every
heading the brand serif, and a Radix accordion trigger lives inside a real
heading element. `AccordionTrigger` now sets `font-sans`: a disclosure control
is functional UI, not brand voice.

**3. The focused skip link had no padding.** `not-sr-only` resets `padding` to
0 and beat the unprefixed `px-4 py-2` at equal specificity, so the revealed
link was a green box with the text against its edges. The padding now sits
under the `focus` variant. Measured before and after: 137×20 → 169×36.

Two defects introduced during this phase and fixed before completion:

**4. Approach numerals failed contrast at 2.05:1.** `text-primary/45` on the
muted surface. Found by running axe against the live page, which jsdom cannot
do. Replaced with the same small tracked numeral the patient journey uses, so
the page also now numbers things one way.

**5. An invalid `<dl>` in `LocationSection`.** `<dt>`/`<dd>` were two `<div>`s
deep instead of one, which breaks the definition-list role. Caught by axe in
the component tests; restructured so the icon is placed by the grid.

---

### Decisions

1. **The public navigation points at in-page anchors, not routes.** The Home
   page is the only public route; `/about`, `/treatments` and the rest belong
   to later phases. Linking the header to five pages that 404 would put five
   dead ends on the site's most valuable page. `FUTURE_PUBLIC_ROUTES` in
   `config/navigation.ts` records the destination each item takes when its page
   exists, so the swap is mechanical. Anchor targets carry `anchor-offset` so a
   jump never lands behind the sticky header (verified: heading top 166px,
   header bottom 65px).

2. **`/appointments/new` serves a short "booking is not open yet" page.** The
   primary CTA appears five times on the Home page and is the point of the
   phase. The three options were a 404, no CTA, or the truth. This is the
   truth: no form, no date picker, no data handling, `noindex`, on the
   permanent booking URL so the real flow replaces one file and every existing
   link keeps working.

3. **Testimonials are not built.** `phase_03.md` §25 offers "clearly marked
   placeholder" or "omit". No verified testimonial exists, and a fabricated
   patient quote on a healthcare site is the worst content this page could
   carry. Omitted.

4. **Practitioner cards render an explicit unpublished state.** A clinician's
   name, qualification and registration are facts a patient decides on.
   `PractitionerPreview` has every descriptive field optional; with no name it
   renders a "Profile to be published" badge, a heading, and a sentence saying
   what will appear there. The photographs' alt text identifies them as
   placeholders. Phase 04 passes real records and nothing in the component
   changes.

5. **`LocationSection` renders `null`.** No address, phone, email or opening
   hours has been supplied. An address is the one piece of content a visitor
   physically acts on. Hiding the section is `phase_03.md` §48's documented
   path; filling in `config/clinic.ts` is the entire change needed to publish
   it, and the footer's contact block and the JSON-LD read from the same
   module.

6. **Footer legal links are empty, and the medical disclaimer is not.** A
   privacy policy, terms and a disclaimer page are all required before launch,
   but none exists, and three 404s in a healthcare footer are worse than none.
   The disclaimer itself is not deferred — it is rendered as text in the footer
   and again in the philosophy section, in the open.

7. **No scroll-reactive header.** Phase 02's header is already sticky and
   translucent with a backdrop blur. A transparent-over-hero state needs scroll
   state, which would make the header a client component, and `phase_03.md` §7
   warns against an excessively animated header. The hero is not a full-bleed
   background, so there is nothing for it to be transparent over.

   > **Partly superseded by the revision.** The hero *is* now a full-bleed
   > background. The conclusion stands — the header is still not
   > scroll-reactive and still not a client component — but the reason changed,
   > so the bar's translucency was raised from 80% to 90% instead.

8. **One inverted band, not two.** The philosophy section is the page's single
   dark section, marking the shift from "what we do" to "what we believe". The
   final CTA sits on the accent tint instead; a second inversion would make it
   a pattern rather than an accent.

   > **Superseded by the revision.** There are now three dark regions — the
   > hero, the philosophy band and the footer — and they bookend the page
   > rather than punctuating it once. The final CTA moved from the accent tint
   > to the sand band.

9. **JSON-LD uses `dangerouslySetInnerHTML`.** Phase 02 recorded that the
   codebase contained none. This is the one, and it is required: React escapes
   text children inside `<script>`, which corrupts JSON. `serializeJsonLd`
   escapes `<` so no value can close the tag, and the payload is
   developer-authored configuration. The escape is in place now because the
   contact fields become clinic-editable settings later.

10. **`sizes` overstates the width for height-driven crops.** A square source
    cropped by `object-cover` into a 4:5 frame is limited by height, so a
    `sizes` describing only the width makes the browser choose a file it then
    upscales. The hero and practitioner frames declare width × 1.25, with the
    reason in a comment. Verified: no image on the page is upscaled at 390px or
    1280px.

---

### Content — what is real and what is not

**Verified and used**

* The clinic logo (`public/images/logo.png`) — the only verified brand asset.
* The names on that artwork: "Punarvasu", "पुनर्वसु", "Ayurvedic Chikitsalaya".

**Placeholder — must be replaced before launch**

| Item | Where | Note |
| --- | --- | --- |
| Every photograph except the logo | `src/config/images.ts` | Stock/generated. Marked `placeholder: true`. Rights position not established. Two carry an AI-generation watermark. |
| Practitioner names, qualifications, registration, specialisations | `PRACTITIONER_PREVIEWS` | **Absent, not invented.** Cards show the unpublished state. |
| Service names and descriptions | `FEATURED_SERVICES` | Written to describe *areas people consult about*, never outcomes. **Requires clinical review.** |
| FAQ answers | `FAQ_ITEMS` | Written to be true regardless of clinic-specific policy. Questions whose only useful answer is a fact we lack (duration, fee, location, hours) are absent rather than guessed. **Requires clinic confirmation.** |
| Address, phone, email, opening hours, directions, social profiles | `src/config/clinic.ts` | All absent. Footer contact block and `LocationSection` hide themselves. |
| Favicon | `src/app/favicon.ico` | Still the Next.js default; should be generated from the badge. |

**Deliberately not present anywhere:** patient counts, success rates, ratings,
reviews, star bars, "#1", "best", "guaranteed", "cure", "100% safe", treatment
durations, prices, and any claim that Ayurvedic care replaces treatment
prescribed by another doctor. A test (`marketing content safety`) asserts the
numeric and superlative patterns stay out of the shipped copy.

---

### SEO

| Item | State | Verified how |
| --- | --- | --- |
| Title | `Punarvasu — Ayurvedic Clinic` | Served HTML. Uses `absolute` to avoid double-suffixing. |
| Meta description | Present, 157 chars, no keyword stuffing | Served HTML |
| Canonical | `<link rel="canonical">` emitted, resolved from `metadataBase` | Served HTML |
| Open Graph | type, title, description, url, site_name, locale, image (+type/width/height/alt) | Served HTML |
| Twitter | `summary_large_image` + title, description, image, alt | Served HTML |
| OG image | Generated 1200×630 brand card, 50 KB PNG | Fetched and viewed |
| Structured data | `MedicalClinic`, verified fields only | Parsed from the page; asserted in tests |
| Semantic headings | One `<h1>`, no skipped level across 35 headings | Asserted in tests + served HTML |
| Sitemap | `/sitemap.xml`, lists only indexable routes | Fetched |
| Robots | `/robots.txt`, disallows `/api/`, `/appointments/`, `/portal/`, `/dashboard/`, `/design-system` | Fetched |
| Booking interstitial | `noindex, follow` | Served HTML |
| Image alt text | Every image has alt; the decorative logo has `alt=""` | Asserted in tests + served HTML |

Note: canonical and sitemap URLs currently resolve to `http://localhost:3000`
because `NEXT_PUBLIC_SITE_URL` is unset in this environment. That is Phase 01's
documented default and the startup check flags it for a production instance.

---

### Accessibility

**Automated, against the live rendered page** — this is new. Phase 02 could
only run axe in jsdom, which has no layout and therefore no computed colours.
Using the Chrome DevTools Protocol (no dependency added — Node 22's built-in
WebSocket against the system Chrome), axe-core was injected into the real page:

| Page | Width | Violations |
| --- | --- | --- |
| `/` | 1280px | **0** |
| `/` | 390px | **0** |
| `/appointments/new` | 390px | **0** |

Colour contrast is included in those runs, with real computed values. It is
what caught the approach numerals at 2.05:1.

**Component-level:** 321 tests including axe sweeps over the hero, service
grid, practitioner cards, FAQ (open and closed), location section, and the
fully assembled page with the `region` and landmark rules enabled.

**Keyboard — verified in a real browser, not only jsdom:**

* Mobile menu: opens from a labelled trigger, focus moves inside, focus stays
  trapped across 10 Tab presses, Escape closes it, focus returns to the
  trigger.
* FAQ: Enter opens (panel measured at 118px, real content), Space collapses,
  ArrowDown moves between triggers, only one panel open at a time.
* Skip link is the first focusable element and becomes genuinely visible when
  focused (169×36, white on primary green at 12,12).
* Anchor jump to `#faq` leaves the heading clear of the sticky header
  (heading top 166px vs header bottom 65px).

**Structure:** one `<h1>`; 35 headings with no skipped level; `banner`/`main`/
`contentinfo` landmarks; every `<section>` named via `aria-labelledby`; unique
ids; lists that are real lists (`<ol>`/`<ul>`), which is why `Reveal` gained
`asChild` rather than wrapping `<li>`s in a `<div>`.

**Touch targets at 390px:** every link and button is ≥44px high, or is a
stretched card link whose real activation area is the card (434–456px,
measured). The only sub-44px element is the skip link, which is a keyboard
affordance and never a pointer target.

**Reduced motion:** with `prefers-reduced-motion: reduce` emulated, `Reveal`'s
`animation-name` computes to `none`, content is fully visible and opaque, and
`scroll-behavior` is `auto`.

**Not done:** no manual screen-reader pass (NVDA/VoiceOver).

---

### Responsive

Measured in a real browser at every width the phase lists, plus 1920px:

| Width | 320 | 375 | 390 | 430 | 768 | 1024 | 1280 | 1440 | 1920 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Horizontal overflow | none | none | none | none | none | none | none | none | none |

`scrollWidth === clientWidth` at every one, and an element-by-element sweep
found nothing extending past the viewport. A static audit confirms zero fixed
pixel widths in any new component.

Mobile is composed, not stacked: headline → supporting copy → full-width CTAs →
photograph → trust strip, so what the page is and how to start are above the
fold at 320px. The patient journey is a vertical timeline below `lg` and a
horizontal progression above it. Practitioner photographs crop to 3:2 on a
phone — at 4:5 they were ~470px of face before any text — and become a
full-height column only once they sit beside the text.

Screenshots were taken and inspected at 320, 390, 768, 1280 and 1440, and the
full page was reviewed end to end at 1280.

---

### Performance

* **Static.** All nine routes prerender; the Home page fetches nothing, so
  there is no request-time failure mode and no loading skeleton for content
  that is already in the HTML.
* **Client JavaScript on the Home page: one component.** `FaqSection` needs
  disclosure state; `Reveal`, `NavLink` and `MobileNav` are leaf-level client
  components from Phase 02. Every one of the ten sections is otherwise a server
  component, and the header stays a server component.
* **LCP.** The hero photograph is the only image with `priority`; Next emits a
  `<link rel="preload" as="image">` with the full srcSet, confirmed in the
  served HTML. Everything else lazy-loads.
* **CLS.** Every image sits in a `MediaFrame` that owns an aspect ratio, so the
  space is reserved before the file arrives. Both fonts are self-hosted through
  `next/font`.
* **Image sizing.** Measured at 390px and 1280px after scrolling the whole
  page: no image is served below its rendered size, and `sizes` is declared per
  frame against the real layout.
* **No third-party scripts, no embedded map, no analytics.**

Not run: a Lighthouse/PageSpeed audit. No such tool is installed and the phase
warns against optimising to a score; the above are direct measurements.

---

### Security

* No secrets introduced; `.env.example` unchanged; client bundle scan clean
  (54 files, 0 findings).
* One `dangerouslySetInnerHTML`, for JSON-LD, with `<` escaped — see Decisions.
  It is the only one in the codebase.
* No third-party script, stylesheet, font or iframe at runtime.
* No user input is rendered; all content is developer-authored configuration.
* External links carry `rel="noreferrer noopener"` and announce that they open
  in a new tab.
* `/appointments/new` handles no data at all.
* Phase 01's security headers, error sanitisation and logging untouched.
* Still no CSP — unchanged from Phase 02, and still actionable.

---

### Testing

Actually executed on 2026-09-17, from a clean tree:

| Check | Command | Result |
| --- | --- | --- |
| All tests | `npx vitest run` | **PASS — 321 tests, 18 files** (was 232 / 14) |
| — component + a11y | jsdom project | PASS |
| — contrast | `contrast.test.ts` | PASS — 3 new brand-band pairs |
| — `cn` regression | `cn.test.ts` | PASS — 30 cases |
| — structured data | `structured-data.test.ts` | PASS |
| TypeScript | `npm run typecheck` | **PASS** |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| Formatting | `npx prettier --check .` | **PASS** |
| Production build | `npx next build` | **PASS** — 9 routes, all static except `/api/health` |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 54 files, 0 findings |
| Live axe (real contrast) | CDP + axe-core, 390px & 1280px | **PASS** — 0 violations |
| Live keyboard | CDP | **PASS** — menu, FAQ, skip link, anchors |
| Live overflow | CDP, 9 widths | **PASS** — none |
| Live image sizing | CDP | **PASS** — nothing upscaled |
| Route status codes | `next start` | `/` 200, `/appointments/new` 200, `/sitemap.xml` 200, `/robots.txt` 200, unknown 404 |
| E2E | — | **NOT RUN** — no E2E tool; unchanged from Phase 02 |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** — not installed |

The browser verification used the system Chrome over the DevTools Protocol
with Node 22's built-in WebSocket. Nothing was added to `package.json`.

---

### Acceptance criteria

**Public shell**

| Criterion | Status |
| --- | --- |
| Header exists | PASS |
| Footer exists | PASS |
| Desktop navigation works | PASS — anchors, verified to resolve to real ids |
| Mobile navigation works | PASS — verified in a real browser |
| Navigation is accessible | PASS — focus trap, Escape, restoration, axe |
| CTA architecture is established | PASS — one primary action, one destination |

**Home page**

| Criterion | Status |
| --- | --- |
| Hero implemented | PASS |
| Trust section implemented | PASS — qualitative only |
| Punarvasu introduction implemented | PASS |
| Approach section implemented | PASS |
| Featured services section implemented | PASS |
| Why Punarvasu section implemented | PASS |
| Patient journey implemented | PASS |
| Ayurveda philosophy section implemented | PASS |
| Practitioner preview implemented where data exists | PASS — component data-driven; no data, so the unpublished state renders and is tested with real fixtures |
| Testimonials only with verified or marked placeholder content | PASS — omitted (§25 option B) |
| FAQ implemented | PASS |
| Location section implemented where information is available | PASS — implemented and tested; renders `null` because no information is available |
| Final CTA implemented | PASS |
| Footer implemented | PASS |

**Design**

| Criterion | Status |
| --- | --- |
| Phase 02 design tokens used | PASS — zero hardcoded colours or pixel widths in new components |
| Typography is consistent | PASS — *and now actually applied*; see Defect 1 |
| Spacing is consistent | PASS — `section-y`, `gutter-x`, `Container` |
| Visual hierarchy is clear | PASS |
| No generic template appearance | PASS — layout rhythm varies per section; reviewed as screenshots |
| No excessive decoration | PASS — one inverted band, no icon grid, no gradients beyond one hero wash |
| Motion is restrained and purposeful | PASS — one entrance effect, one hover, no hero animation |

**Responsive**

| Criterion | Status |
| --- | --- |
| 320 / 375 / 390 / 430px work | PASS — measured |
| Tablet works | PASS — 768px measured |
| Desktop works | PASS — 1024 / 1280px measured |
| Large screens work | PASS — 1440 / 1920px, capped by `Container` |
| No unintended horizontal overflow | PASS — measured at 9 widths |

**Accessibility**

| Criterion | Status |
| --- | --- |
| Semantic HTML | PASS |
| One logical H1 | PASS |
| Heading hierarchy correct | PASS — asserted |
| Keyboard navigation works | PASS — real browser |
| Mobile menu accessible | PASS |
| FAQ accessible | PASS |
| Focus states visible | PASS — skip link measured; global `:focus-visible` |
| Images have appropriate alt text | PASS |
| Contrast acceptable | PASS — live axe, 0 violations |
| Reduced motion respected | PASS — verified with emulation |

**SEO**

| Criterion | Status |
| --- | --- |
| Metadata implemented | PASS |
| Open Graph metadata implemented | PASS — including a generated image |
| Canonical strategy implemented | PASS |
| Semantic headings implemented | PASS |

**Performance**

| Criterion | Status |
| --- | --- |
| Images optimized | PASS — `next/image`, per-frame `sizes`, nothing upscaled |
| Hero image strategy optimized | PASS — `priority` + preload confirmed |
| No unnecessary client rendering | PASS — one client section on the page |
| No obvious layout shift | PASS — every frame reserves its aspect ratio |
| No unnecessary third-party scripts | PASS — none at all |

---

### Known issues

* **All photography is placeholder**, and its rights position has not been
  established. Two practitioner portraits carry a visible AI-generation
  watermark. These must be replaced with real clinic photography before launch.
* **Service descriptions and FAQ answers need clinical sign-off.** They are
  written to avoid any medical claim, but they describe a real clinic's
  practice and a practitioner should confirm them.
* **No clinic contact details**, so the footer contact block, the "Visit us"
  section and the `address`/`telephone` JSON-LD properties are all absent.
* **Legal pages do not exist** — privacy policy, terms and a medical
  disclaimer page are required before a healthcare platform launches. The
  disclaimer text is published; the pages are not.
* **Favicon is still the Next.js default.** The badge artwork now exists to
  generate one from.
* **The 404 page has no site chrome.** It renders the Phase 01/02
  `StatusMessage` screen, because the root `not-found.tsx` sits outside the
  `(public)` group. Functional and accessible, but a visitor who mistypes a URL
  loses the header.
* **Still no CSP.** Unchanged from Phase 02, and now even more clearly
  actionable: the site loads no third-party script, style, font or frame.
* **No E2E tool and no screen-reader pass.** Unchanged from Phase 02.
* **Supabase remains unproven against a live project.** Untouched by this
  phase.

---

### Deferred work

* The booking engine; `/appointments/new` is a static interstitial on the
  permanent URL.
* `/about`, `/treatments`, `/practitioners`, `/articles`, `/contact` — and the
  swap of the header's anchors for those routes, recorded in
  `FUTURE_PUBLIC_ROUTES`.
* Legal pages, and the footer links to them.
* Real practitioner records (the component is ready for them), real service
  data, verified testimonials.
* Database-backed clinic settings replacing `config/clinic.ts`.
* Content-Security-Policy.
* E2E tooling, visual regression, manual screen-reader pass, Lighthouse.
* Favicon and any further brand artwork.

---

### Post-completion UI revision — 2026-09-17

Requested after the phase closed: the colour scheme and UI were rejected as
cold and template-like, with
[`punarvasu-one.vercel.app`](https://punarvasu-one.vercel.app) and three
mockups in `public/images/home-{0,1,2}.png` given as the direction. Delivered in
two passes.

#### Pass 1 — palette, type and page composition

**Colour.** The page moved from a pale off-white with green-grey neutrals to
warm cream with brown type and a deeper forest green. The three-layer token
architecture is unchanged; only values moved, plus two new token families.

| Token | Was | Now |
| --- | --- | --- |
| `--background` | `#FAF8F3` | `#FFF8E1` cream |
| `--foreground` | `#252822` green-grey | `#3E2723` brown |
| `--muted` | `#F2F0E9` | `#F9EFD6` sand |
| `--secondary` | `#F0EBDF` | `#F4E7C8` sand |
| `--border` / `--border-strong` | `#E2E4DE` / `#C9CCC5` | `#ECE0C8` / `#DDCCA9` |
| `--input` | `#83887E` | `#8D746C` |
| `--primary` (+hover/active) | `#28604D` | `#2A473A` |
| `--brand-surface` | `#1F4A3D` | `#1E3529` |

The raw ramps split in two: `--punarvasu-neutral-*` for text (warm brown) and a
new `--punarvasu-sand-*` for surfaces (warm yellow). They warm in different
directions, and mixing them into one ramp is what produced the muddy mid tones.

**New token families**

* `--scrim` / `--scrim-foreground` — the wash between a photograph and text laid
  over it. Two fixed opacities in `MEDIA_FRAME_SCRIM_ALPHA` (70% and 55%), each
  composited over a pure-white photograph in `contrast.test.ts` and asserted to
  still carry text. That is what lets the hero take an unreviewed image.
* `data-surface="inverted"` — one unlayered rule re-pointing the focus ring from
  `--ring` (primary green, invisible on a dark surface) to the brand foreground.
  Applied to the hero, the philosophy band and the footer.

**Typography.** Cormorant Garamond → Playfair Display, which
`DESIGN_SYSTEM.md` §6.1 already listed as interchangeable. Cormorant is
low-contrast with a small x-height and went pale against a warm page.

**Composition**

* `hero.tsx` — rebuilt as a full-bleed photograph with the copy laid over it,
  replacing the text-column-beside-a-rounded-image split. New `hero-band`
  utility for the height; trust strip now sits on cream with rules between
  items.
* `media-frame.tsx` — `scrim` went from `boolean` to `"none" | "soft" |
  "strong"`, and gained a `fill` aspect for a band whose height comes from the
  content over it.
* `site-footer.tsx` — inverted onto the brand band, so a long warm page has a
  definite end.
* `final-cta.tsx` — accent tint → sand band, so it does not use the colour
  every hovered control on the page uses.
* Service and practitioner grid headings centred; header translucency 80% → 90%.

#### Pass 2 — editorial voice

Follow-up request: swap the eyebrow colour with the heading and paragraph
colours — brown eyebrows, green headings and prose.

This could not be a value swap. `--primary` is also the button fill, every link,
icon and the focus ring; `--foreground` is every form label, table cell and menu
item. Exchanging the two would have turned buttons brown and helper text green.
Three editorial tokens were added instead:

```css
--eyebrow: #8F4A34;  /* terracotta, the existing brown accent */
--heading: #1E3529;  /* primary-800 */
--prose:   #2A473A;  /* primary-700 */
```

`--heading` is applied in the base layer to `h1`–`h5`, so a heading added later
is correct without anyone remembering; inverted surfaces override it with their
own foreground. Terracotta was chosen over the brown text neutral because an
eyebrow is an accent — the text neutral would have made it recede below the
paragraph it introduces.

The editorial/functional boundary is now documented as a table in
`DESIGN_SYSTEM.md` §4.5 and is deliberate: **form hints, table cells, captions,
placeholders and input text stay brown.** Editorial text is what a visitor
reads; functional text is what a user operates.

#### Files changed by the revision

```text
src/app/globals.css                     palette values; --scrim, --heading/--prose/
                                        --eyebrow; hero-band utility; base heading
                                        colour; [data-surface="inverted"] rule
src/app/layout.tsx                      Playfair Display; themeColor
src/app/global-error.tsx                inline fallback colours
src/app/design-system/page.tsx          6 new swatches; serif name
src/config/design-tokens.ts             MEDIA_FRAME_SCRIM_ALPHA
src/lib/design/palette.ts               mirror: all values + 5 new tokens
src/lib/design/contrast.ts              compositeOver() for scrim verification
src/lib/design/contrast.test.ts         +32 assertions (see Verification below)
src/components/marketing/hero.tsx       full-bleed band, copy on the photograph
src/components/marketing/media-frame.tsx  scrim strengths; fill aspect
src/components/layout/site-footer.tsx   inverted onto the brand band
src/components/layout/site-header.tsx   translucency 80% -> 90%
src/components/layout/section.tsx       eyebrow/heading/prose tokens
src/components/marketing/{approach-section,final-cta,intro-section,
    patient-journey,philosophy-section,practitioner-preview,service-preview,
    why-punarvasu}.tsx                  editorial tokens; centred grid headings
src/components/ui/{accordion,card,dialog,sheet}.tsx        heading/prose tokens
src/components/shared/{empty-state,error-state,status-message}.tsx  heading token
src/app/(public)/appointments/new/page.tsx                 heading/prose tokens
docs/DESIGN_SYSTEM.md                   §4 rewritten; §4.4 scrim, §4.5 editorial
                                        voice, §4.6 inverted surfaces; §6.1 serif
docs/progress/progress_phase_02.md      supersession note on its palette section
```

No dependency was added, and no component's public API changed except
`MediaFrame`'s `scrim` prop, which had no other caller.

#### Verification of the revision

Re-run on 2026-09-17 against the rebuilt UI. The live browser checks used the
same technique as the phase itself — system Chrome over the DevTools Protocol
with Node 22's built-in WebSocket, nothing added to `package.json`.

| Check | Result |
| --- | --- |
| All tests | **PASS — 353 tests, 18 files** (was 321) |
| Contrast, token pairs | **PASS** — 32 new assertions: 15 editorial (3 roles × 5 surfaces), 15 palette/scrim/inverted-ring, 2 `compositeOver` unit |
| TypeScript | **PASS** |
| ESLint | **PASS** |
| Formatting | **PASS** |
| Production build | **PASS** — 9 routes, unchanged |
| **Live axe, real computed colour** | **PASS — 0 violations**: `/` at 390px and 1280px, `/appointments/new` at 390px, `/design-system` at 1280px |
| **Live horizontal overflow** | **PASS — none** at 320/375/390/430/768/1024/1280/1440/1920px |
| Hero band geometry | **PASS** — band 541–681px, copy never clipped; at 320px the headline wraps to three lines and the band grows past its 480px minimum |
| Hero touch targets | **PASS** — both actions 52px high at every width |
| Hero image sizing | **PASS** — nothing upscaled; `<link rel="preload" as="image">` for `hero.jpg` still emitted |
| Inverted headings | **PASS** — hero `text-scrim-foreground`, philosophy/footer `text-brand-surface-*` all survive the new base heading colour |
| Screen reader | **NOT RUN** — unchanged |
| Lighthouse | **NOT RUN** — unchanged |

The live axe runs are what make the palette claim credible: every colour on the
page changed, and contrast was re-measured on the rendered page rather than
inferred from the token table.

#### Superseded by this revision

* **Decisions 7 and 8** — annotated in place above.
* **Responsive**, "Mobile is composed, not stacked: headline → supporting copy →
  full-width CTAs → photograph → trust strip". The photograph is now *behind*
  the copy rather than after it; the order is headline → copy → CTAs → trust
  strip, and the overflow sweep above replaces the one in that section.
* **Design acceptance**, "no gradients beyond one hero wash" — the hero wash is
  now a scrim plus one directional gradient, both verified for contrast.
* **Accessibility** and **Testing** — the axe, overflow and test-count figures
  in those sections were measured against the pre-revision UI. The table above
  supersedes them.

#### Carried forward unchanged

Every item under **Known issues** and **Deferred work** still stands: all
photography is placeholder, service copy and FAQ answers need clinical
sign-off, there are no clinic contact details, no legal pages, no CSP, no E2E
tool and no screen-reader pass. The revision was visual; it added no content,
no claim and no data handling.

---

### Next Phase

PHASE 04 — not started. Its specification is an empty file and must be written
before implementation.
