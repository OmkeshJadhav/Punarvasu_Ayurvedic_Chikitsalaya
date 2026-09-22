## PHASE 02 — Design System & UI Foundation

Status:
COMPLETED

Completed On:
2026-09-17

Summary:
Built Punarvasu's reusable visual and interaction foundation: a semantic token
system verified against WCAG AA by test, a fluid typography scale, responsive
spacing and container primitives, seventeen UI primitives, layout/navigation
and brand foundations, loading/empty/error state patterns, and a CSS-only
motion language. No product page was built. 232 tests pass, including 20
axe sweeps and 37 contrast assertions.

---

### Repository assessment before starting

The phase specification says to reuse an existing shadcn/ui setup. **There was
none.** No `components.json`, no `components/ui/`, no `class-variance-authority`,
no Radix, no icon library, no Tailwind config beyond `@tailwindcss/postcss`.

What did exist, and was preserved:

* Tailwind v4.3.3 via `@tailwindcss/postcss`, no config file (CSS-first).
* `src/app/globals.css` with four neutral placeholder tokens, explicitly
  labelled by Phase 01 as "replaced in Phase 02".
* `src/components/shared/status-message.tsx` — the one existing component.
* `loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`.
* Inter via `next/font`, root layout metadata, Vitest in a Node environment.

`ARCHITECTURE.md` §4 already reserved `src/components/ui/` for "shadcn/ui lives
here", so the intent was documented even though nothing was installed.

**Decision:** follow shadcn/ui's *method* — components copied into the
repository, built on Radix primitives with CVA variants — rather than running
its CLI. The CLI would have installed a `components.json`, a `lib/utils.ts` and
a default neutral theme that we would immediately have had to rewrite, and its
generated components are written for a different palette and a different set of
accessibility assumptions. Every component here is written against
`docs/DESIGN_SYSTEM.md` directly. This is the documented architecture, reached
without a tool that would have fought it.

---

### Design system implemented

**Colour.** Three layers in `src/app/globals.css`: a raw palette, semantic
tokens naming a *role*, and a `@theme inline` block mapping those into
Tailwind's namespaces. Components reference roles only — no component names a
green. Full token set: `background`, `foreground`, `card`, `popover`, `muted`,
`secondary`, `accent`, `primary` (+ hover/active), `border`, `border-strong`,
`input`, `ring`, and four-part `success` / `warning` / `destructive` / `info`
(tone, foreground, surface, border), plus `gold` and `terracotta` accents.

> **Superseded on 2026-09-17.** The *structure* below is unchanged — three
> layers, roles not colours, eleven fluid type steps. The values are not: the
> palette moved from a pale off-white page with green-grey neutrals to warm
> cream with brown type and a deeper forest green, and the serif moved from
> Cormorant Garamond to Playfair Display. `--scrim` and `--brand-surface`'s
> sand accent were added at the same time. `docs/DESIGN_SYSTEM.md` §4 and §6
> carry the current values and the reasoning; this file records what Phase 02
> shipped.

**Typography.** Cormorant Garamond for headings and brand voice, Inter for all
functional UI. Both self-hosted through `next/font`. Eleven fluid steps
(`text-display-xl` … `text-caption`, `text-label`), each a `clamp()`
interpolating between its mobile and desktop size across 375–1280px — so no
step is a proportionally shrunken desktop heading and there is no breakpoint
override to forget.

**Spacing and layout.** Tailwind v4's 4px scale already matched
`DESIGN_SYSTEM.md` §9 and was kept rather than replaced. Two custom utilities
encode the rhythm pages would otherwise retype: `section-y` (56/80/112px) and
`gutter-x` (20/32/48px), plus `measure` (68ch). `Container` gives four widths:
`prose` 720, `content` 1120, `wide` 1280, `full`.

**Radius, shadow, borders.** `sm` 6 / `md` 10 / `lg` 16 / `xl` 24 / full.
Three shadows, reserved for genuinely elevated surfaces; most cards use a
border and a surface change.

**Motion.** Four categories — micro 150ms, surface 240ms, entrance 420ms — one
easing curve, and everything rises from the same direction, once. Implemented
entirely in CSS (see *Dependencies* for why no animation library).

**Z-index.** Six semantic layers, referenced as `z-(--z-modal)`.

**Theme.** Light only, and `color-scheme: light` is explicit. Phase 01's
placeholder `prefers-color-scheme: dark` block was removed — see *Decisions*.

---

### Components created

`src/components/ui/` (17 primitives)

```text
button.tsx      input.tsx       textarea.tsx    select.tsx      field.tsx
card.tsx        badge.tsx       alert.tsx       dialog.tsx      sheet.tsx
tabs.tsx        accordion.tsx   tooltip.tsx     toast.tsx       table.tsx
skeleton.tsx    spinner.tsx     separator.tsx
```

`src/components/layout/`

```text
container.tsx   section.tsx     site-header.tsx  site-footer.tsx
nav-link.tsx    mobile-nav.tsx
```

`src/components/brand/logo.tsx` — placeholder wordmark and mark.

`src/components/shared/`

```text
empty-state.tsx   error-state.tsx   loading-state.tsx   reveal.tsx
status-message.tsx  (modified: restyled, now owns <main> and the <h1>)
```

Documented per component in `docs/DESIGN_SYSTEM.md` §62 (purpose, variants,
accessibility notes, and whether it is a client component). Each file carries
the authoritative documentation in its header comment.

**Server/client split — 19 of the 30 component files are server components.**
Buttons, inputs, textareas, cards, badges, alerts, tables, skeletons, spinners,
separators, containers, sections, the brand logo, the site header and the site
footer ship no JavaScript. The 11 client components are exactly the ones that
need browser behaviour: `Select`, `Field`, `Dialog`, `Sheet`, `Tabs`,
`Accordion`, `Tooltip`, `Toast`, `NavLink`, `MobileNav`, `Reveal`.

`SiteHeader` in particular stays a server component: the two parts that need
the client (current-path detection and the mobile menu) are pushed down into
`NavLink` and `MobileNav`.

---

### Files Added

```text
src/app/design-system/page.tsx
src/app/design-system/interactive-gallery.tsx
src/components/brand/logo.tsx
src/components/layout/{container,section,site-header,site-footer,nav-link,mobile-nav}.tsx
src/components/shared/{empty-state,error-state,loading-state,reveal}.tsx
src/components/ui/{accordion,alert,badge,button,card,dialog,field,input,select,
                   separator,sheet,skeleton,spinner,table,tabs,textarea,toast,tooltip}.tsx
src/config/design-tokens.ts
src/config/navigation.ts
src/lib/design/{contrast.ts,palette.ts,contrast.test.ts}
src/lib/motion/index.ts
src/lib/utils/cn.ts
tests/support/{setup-dom.ts,axe.ts}
tests/components/{button,dialog,field,disclosure,feedback,navigation,
                  surfaces,page-shell}.test.tsx
docs/progress/progress_phase_02.md
```

### Files Modified

```text
src/app/globals.css          replaced placeholder tokens with the design system
src/app/layout.tsx           second font family, brand theme colour
src/app/page.tsx             restyled placeholder (still a placeholder)
src/app/loading.tsx          uses PageLoading
src/app/error.tsx            uses StatusMessage + Button
src/app/not-found.tsx        uses StatusMessage + Button
src/app/global-error.tsx     inline colours aligned to the brand palette
src/components/shared/status-message.tsx   restyled; owns <main> and <h1>
vitest.config.mts            two projects: node + jsdom components
package.json                 dependencies
docs/DESIGN_SYSTEM.md        §0 status, corrected colours, §62 component
                             reference, §63 brand status, decisions recorded
docs/ARCHITECTURE.md         §1.1 state, §4 structure, UI boundaries
docs/QA_STRATEGY.md          §1.1 component and accessibility tooling
docs/PUNARVASU_MASTER_SPEC.md  status and phase tables
```

No file was deleted.

---

### Dependencies

**Added — runtime**

| Package | Why | Alternative rejected |
| --- | --- | --- |
| `radix-ui` | One package covering Dialog, Sheet, Tabs, Accordion, Tooltip, Select, Label, Separator, Toast and Slot. Focus trapping, focus restoration, roving focus and type-ahead are the parts nobody should hand-roll. | Writing them by hand. Every one of these is a well-known source of accessibility defects. |
| `class-variance-authority` | Type-safe component variants | Hand-written class maps that drift from their types |
| `clsx` + `tailwind-merge` | Conditional classes; a caller's override wins over a component default deterministically | Depending on stylesheet order |
| `lucide-react` | The one icon system, per `DESIGN_SYSTEM.md` §38 | Mixing libraries or inline SVGs |

**Added — dev**

`@testing-library/react`, `@testing-library/user-event`,
`@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react` — component
testing, which the phase requires. `axe-core` — accessibility automation, which
`QA_STRATEGY.md` §1.1 had explicitly deferred to this phase.

**Deliberately NOT added**

| Not added | Why |
| --- | --- |
| **Framer Motion** (suggested by the phase spec §41) | Nothing in the foundation needs a JavaScript animation engine. Micro-interactions are CSS transitions; overlays animate from the `data-state` attributes Radix already publishes; the accordion's height animation uses `--radix-accordion-content-height`; content entrance is a CSS keyframe started by a ~40-line `<Reveal>` using IntersectionObserver. Adding an animation runtime to every client bundle, on a platform doctors and receptionists use all day, to do what CSS already does, is not a trade worth making. A later phase with a real need should add it deliberately. **Recorded in `DESIGN_SYSTEM.md` §41.** |
| `vaul` (drawer) | A drawer *is* a modal surface. `Sheet` is built on Radix Dialog, which already provides focus trapping, Escape, focus restoration and an inert background. A second dependency would have bought drag-to-dismiss, which is not a requirement and is hard to make accessible. |
| `sonner` (toasts) | Radix Toast is already in the `radix-ui` package and gives the F8 hotkey, live-region roles, pause-on-hover and swipe-to-dismiss. |
| `tw-animate-css` | Six keyframes written directly in `globals.css`. |
| shadcn/ui CLI | See *Repository assessment*. |
| Playwright / any E2E tool | Out of scope; `QA_STRATEGY.md` defers it to the first real user journey. Consequence recorded under *Known issues*. |

Nothing was removed.

---

### Accessibility

**Automated.** `axe-core` runs inside the component tests — 20 sweeps, each
over a container holding several components at once: buttons in every variant,
dialogs, sheets, fields in their error state, tabs, accordions, badges, alerts,
loading regions, empty and error states, toasts, cards, selects, tables, the
header (closed and with the mobile menu open), the footer, and a fully
assembled page with the `region` and landmark rules switched on. Zero
violations.

Contrast rules are disabled *inside axe* because jsdom has no layout engine and
therefore no computed colours. Contrast is verified against the real token
values instead.

**Contrast — 37 pairs asserted in `src/lib/design/contrast.test.ts`** (75 cases
in the file overall). Thirty text pairs against WCAG AA 4.5:1 and seven
form-control boundaries and focus rings against SC 1.4.11's 3:1, plus 33 checks
that every hex in the palette mirror still appears in `globals.css` — so the
test cannot silently stop testing the real thing — and 5 unit tests of the
ratio maths itself against known values.

**This caught three real defects in `DESIGN_SYSTEM.md` v1.0:**

| Token | Was | Measured | Now | Now measures |
| --- | --- | --- | --- | --- |
| warning | `#A66A18` | 4.21:1 | `#8A5410` | 5.89:1 |
| accent gold | `#B58A4A` | 3.03:1 | `#8A6519` | 5.01:1 |
| terracotta | `#A85F48` | 3.53:1 | `#8F4A34` | 6.19:1 |

A fourth was caught during implementation: the input border started at
`#8D9288` and failed at 2.79:1 against the muted surface. It is now `#83887E`
(3.18:1). `--input` is deliberately darker than `--border` — a control boundary
is information, a divider is not.

**Keyboard — asserted, not assumed.** Buttons activate on Enter and Space and
are reachable by Tab. Dialogs and sheets open from the keyboard, move focus in,
trap it across eight Tab cycles, close on Escape and restore focus to the
trigger. Tabs move on arrows/Home/End with one Tab stop for the whole list.
Accordions expand and collapse on Enter. Selects open on Enter, move on arrows,
select on Enter and close on Escape without selecting. Tooltips open on
**focus**, not only hover, and close on Escape. The skip link is the first
focusable element and targets a `<main>` that exists. An overflowing table's
scroll region is focusable, so it is reachable at all.

**Structural.** One `<h1>` per page and no skipped heading level (asserted).
`banner` / `main` / `contentinfo` landmarks. Unique ids across an assembled
page. `aria-current="page"` plus an underline for the current nav item. Every
status carries an icon as well as a colour. Errors are `role="alert"`;
non-urgent messages are `role="status"` so they wait for a pause. Every
interactive element is at least 44×44px. `prefers-reduced-motion` collapses
every animation while leaving state changes intact.

**Not done:** no manual screen-reader pass (NVDA/VoiceOver), and no browser
accessibility-tree inspection. axe plus explicit keyboard assertions is a real
but partial substitute.

---

### Responsive

**Verified by rule inspection against the compiled stylesheet**, served from a
running dev server:

* `gutter-x` → 20px, 32px at ≥40rem, 48px at ≥64rem.
* `section-y` → 56px, 80px at ≥48rem, 112px at ≥64rem.
* `text-h1` → `clamp(2.125rem, 1.53rem + 2.54vw, 3rem)`; the whole scale is
  fluid, so 320px and 1440px are interpolated points, not untested edges.
* Motion is emitted only inside `@media (prefers-reduced-motion: no-preference)`.

**Static overflow audit — zero fixed pixel widths in any component** (`w-[…]`,
`min-w-[…]`, `h-[…]`), the usual cause of horizontal scroll on a phone. The
only fixed value anywhere is `max-h-[85dvh]` on the mobile dialog and sheet,
which is a cap, not a width.

Mobile-first behaviour built in: dialogs dock to the bottom and scroll
internally below `sm`; the sheet is the drawer pattern; dialog and sheet footers
stack with the primary action reachable by thumb; the tab list scrolls
horizontally instead of wrapping into a shifting second row; the table scroller
is focusable; the footer grid collapses 4→2→1; navigation collapses into a
`Sheet` below `lg` while the CTA stays visible from `sm`; a `block` button
re-enables text wrapping, which is the one place a long label meets a 320px
viewport.

**Not done, and not claimed:** no pixel-level rendering at 320/375/390/768/
1024/1280/1440px. No browser driver is installed and the phase's own tooling
decisions keep E2E out of scope. What is above is CSS-rule verification and a
static audit — strong evidence, not a substitute for looking. `/design-system`
exists precisely so a human can do that pass in one place.

---

### Testing

Actually executed on 2026-09-17:

| Check | Command | Result |
| --- | --- | --- |
| All tests | `npx vitest run` | **PASS — 232 tests, 14 files** |
| — node project | unit + integration + contrast | PASS — 105 tests |
| — components project | jsdom | PASS — 127 tests |
| — of which axe sweeps | `axe-core` | PASS — 20 sweeps, 0 violations |
| — of which contrast | `contrast.test.ts` | PASS — 75 cases (37 contrast pairs, 33 mirror checks, 5 unit) |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| Formatting | `npx prettier --check .` | **PASS** |
| Production build | `npx next build` | **PASS** — 4 routes, compiled in 10.7s |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 37 files, 0 findings |
| Dev server | `next dev` | `/` 200, `/api/health` 200, `/design-system` 200, unknown path 404 |
| Production server | `next start` | `/` 200, `/api/health` 200, unknown path 404; `/design-system` serves the not-found page with `noindex` and none of the gallery content |
| Build output inspection | `grep` over `.next` | Gallery content absent from the prerendered HTML and from every client bundle |
| E2E | — | **NOT RUN** — no tool; out of scope |
| Screen reader | — | **NOT RUN** |

**Defects the tests caught during implementation** (all fixed, all re-verified):

1. `contrast.test.ts` failed the input border at 2.79:1 on the muted surface —
   the hand calculation had been done against white. Darkened.
2. `Button asChild` crashed: `Slot` received two children (spinner + label).
   Fixed with `Slot.Slottable`; a projected element now keeps its own content.
3. ESLint `react-hooks/set-state-in-effect` flagged two real anti-patterns.
   `MobileNav` now adjusts state during render (the React-documented pattern),
   so the menu is never painted open over the new page. `Reveal` dropped its
   `setState` branch entirely — the animation is progressive enhancement and
   content is visible whether or not the observer ever runs.
4. A `Dialog` assertion on `aria-modal` failed. Radix marks siblings inert
   instead, which is stronger; the test now asserts the real guarantee.
5. jsdom lacked `ResizeObserver` and pointer-capture APIs. Stubbed in
   `setup-dom.ts`, with a comment saying why each one is there.

Manual verification against `next dev`: skip link, `main` landmark, `nav`
landmark, brand link name, `aria-current`, `role="alert"`, `aria-invalid` and
`aria-describedby` all present in the server-rendered HTML. Compiled CSS
confirmed to contain the fluid type scale, responsive utilities, semantic
colours and reduced-motion gating. The only error in the dev log is Phase 01's
known Supabase configuration warning — this environment has no Supabase
project, which is expected and pre-existing.

---

### Acceptance criteria

**Design system**

| Criterion | Status | Evidence |
| --- | --- | --- |
| Colour system established | PASS | `globals.css`; 75 contrast assertions |
| Typography system established | PASS | Two families; 11 fluid steps |
| Spacing system established | PASS | 4px scale + `section-y`, `gutter-x`, `measure` |
| Radius system established | PASS | `sm`/`md`/`lg`/`xl`/full |
| Shadow system established | PASS | Three levels, used sparingly |
| Container system established | PASS | `Container`, four widths |
| Responsive conventions established | PASS | Fluid type; mobile-first utilities |
| Motion conventions established | PASS | `src/lib/motion/`; four categories |

**Components**

| Criterion | Status |
| --- | --- |
| Button system | PASS — 6 variants, 4 sizes, loading, `asChild`, 17 tests |
| Form controls | PASS — `Field`, `Input`, `Textarea`, `Select`, 14 tests |
| Card system | PASS — 5 variants, 4 paddings, accessible interactive card |
| Badge system | PASS — 6 tones, 9 statuses, always icon + text |
| Dialog | PASS — 12 tests incl. focus trap and restoration |
| Drawer / bottom sheet | PASS — `Sheet`, `bottom` and `right` |
| Tabs | PASS — roving focus asserted |
| Accordion | PASS — configurable heading level |
| Tooltip | PASS — opens on focus, closes on Escape |
| Skeleton | PASS — `Skeleton`, `SkeletonText` |
| Toast foundation | PASS — errors do not auto-dismiss |
| Loading state | PASS — section / card-list / page |
| Empty state | PASS |
| Error state | PASS — `ErrorState` + `StatusMessage` |
| Navigation / header foundation | PASS — server component; skip link; mobile menu |
| Footer foundation | PASS — every block optional and config-driven |

**Accessibility**

| Criterion | Status |
| --- | --- |
| Keyboard navigation works | PASS — asserted per component |
| Focus states are visible | PASS — one global `:focus-visible` treatment |
| Form controls have accessible labels | PASS — `Field` makes it structural |
| Dialogs are accessible | PASS |
| Contrast is acceptable | PASS — AA, by test; 3 spec colours corrected |
| Reduced motion is supported | PASS |
| Interactive controls use semantic elements | PASS — no click handler on a div |

**Responsive**

| Criterion | Status | Note |
| --- | --- | --- |
| Mobile works | PASS (rules + audit) | Not pixel-verified |
| Tablet works | PASS (rules + audit) | Not pixel-verified |
| Desktop works | PASS (rules + audit) | Not pixel-verified |
| Large screens work | PASS | Capped by `Container` |
| No unintended horizontal overflow | PASS (static audit) | Zero fixed pixel widths |

**Engineering**

| Criterion | Status |
| --- | --- |
| Existing architecture preserved | PASS — nothing from Phase 00/01 changed or removed |
| Components are reusable | PASS — one primitive per problem |
| No unnecessary dependencies | PASS — four runtime packages; five candidates declined with reasons |
| No unnecessary client components | PASS — 19 of 30 component files are server components |
| TypeScript passes | PASS |
| ESLint passes | PASS |
| Tests pass | PASS — 232 |
| Production build succeeds | PASS |

---

### Decisions

1. **shadcn/ui method, not its CLI.** The CLI would have installed a default
   theme and generated components we would have rewritten immediately. The
   convention (copy-in components, Radix + CVA, `cn()`) is followed exactly,
   and `ARCHITECTURE.md` §4's reservation of `components/ui/` is honoured.
2. **No animation library.** Fully reasoned above and recorded in
   `DESIGN_SYSTEM.md` §41. This is a deliberate departure from the phase
   specification's suggestion, not an omission.
3. **Dark mode removed, not preserved.** The phase spec says to preserve dark
   mode "if the project already supports it". It did not: Phase 01 left four
   inverted placeholder values explicitly labelled for replacement, and no
   component was built against them. `DESIGN_SYSTEM.md` §55 says not to add
   dark mode without a product requirement. Carrying it forward would have
   shipped a half-theme no contrast test covered. `color-scheme: light` is now
   explicit. Because every colour is a semantic token, adding it later means
   redefining tokens under a selector, not revisiting components.
4. **`--input` is darker than `--border`.** WCAG 1.4.11 requires 3:1 for a
   control boundary; the documented `#C9CCC5` gave 1.6:1. This is the one place
   the system chooses contrast over restraint.
5. **`Field` takes description and error as props, not child slots.** A slot
   API cannot know during server rendering whether a description exists, so
   `aria-describedby` would point at an element that may never be rendered —
   an axe violation and a confusing screen-reader experience. Asserted by test.
6. **Interactive cards use a stretched link, never a click handler.** One
   focusable element, a real accessible name, working middle-click, and the
   focus ring around the card via `focus-within`.
7. **`/design-system` cannot render in production.** `NODE_ENV` is already
   "production" during `next build`, so the route prerenders as the not-found
   body. A production instance therefore cannot render the gallery whatever its
   runtime environment says.

   Verified in the build output: `.next/server/app/design-system.html` contains
   the not-found page, and no client bundle under `.next/static` contains any
   gallery content. The gallery's *compiled module* does exist in a server SSR
   chunk — it is code that is never executed, not content that is served.

   The response status is 200, not 404: `notFound()` yields 200 for a streamed
   response by documented Next.js design, and Next injects
   `<meta name="robots" content="noindex">` on top of the `noindex` declared on
   the route. So it is a soft 404 that serves nothing and is not indexed.
   Confirmed against a real `next start`.
8. **No clinic facts invented.** Navigation is placeholder and config-driven;
   the footer renders contact details, hours and social links only when passed
   them. The logo is an obvious placeholder, built to be replaced without
   touching a caller (`DESIGN_SYSTEM.md` §63).
9. **Vitest split into two projects.** Server logic keeps a Node environment;
   only component tests pay for jsdom.

---

### Security

This phase introduced no data handling, no network calls and no new
configuration. Verified:

* No secrets added; `.env.example` unchanged.
* No `dangerouslySetInnerHTML` anywhere. (`grep` clean.)
* No third-party script or stylesheet at runtime — both fonts are self-hosted
  by `next/font`.
* No untrusted content rendered; all demo copy is literal and written here.
* No patient data, real contact details or plausible-looking clinical content
  in any example. Demo references (`PNV-10241`) are obviously synthetic.
* External links carry `rel="noreferrer noopener"`.
* Client bundle scan clean after the build (37 files).
* Phase 01's security headers, error sanitisation and logging are untouched.

The still-absent CSP (deferred by Phase 01 pending "the design/analytics phase")
is now **actionable and should be written**: the application's script, style and
font origins are settled by this phase. See *Known issues*.

---

### Known issues

* **No CSP.** Phase 01 deferred it to the phase that settles what the app
  loads. That is now known: self-hosted fonts, no third-party scripts, inline
  styles only from Next.js. Nothing blocks writing one; it was not in this
  phase's scope, and it should not be deferred again silently.
* **No pixel-level responsive verification.** No browser driver is installed.
  Verified by CSS-rule inspection and a static overflow audit instead.
* **No manual screen-reader pass.** axe plus explicit keyboard assertions cover
  a real but partial slice.
* **Favicon is still the Next.js icon.** Unchanged from Phase 01 —
  deliberately, since no real brand artwork exists to replace it with.
* **`/design-system` is a soft 404 in production, not a hard one** (200 status,
  not-found body, `noindex`, no content). This is Next.js's documented handling
  of `notFound()` in a streamed response, not a gap in the gating. A hard 404
  would need a rewrite in `next.config.ts`; judged not worth complicating a
  security-focused file for an internal page.
* **`Badge` uses `whitespace-nowrap`.** Correct for the nine defined statuses;
  a very long custom label in a narrow card could overflow. Keep badge labels
  short.
* **Placeholder navigation references routes that do not exist** (`/about`,
  `/treatments`, …). Intentional: the header and footer take items as props so
  a phase can pass only what it has built.
* **Supabase remains unproven against a live project.** Unchanged from Phase 01
  and untouched here.

---

### Deferred work

* Content-Security-Policy (now unblocked — see above).
* E2E tooling and visual-regression testing.
* Manual screen-reader and pixel-level responsive passes.
* Real logo, brand artwork, favicon, photography.
* Real clinic contact details, opening hours, social profiles.
* Real navigation content and the routes it points at.
* Any component a future workflow genuinely needs: checkbox, radio group,
  switch, date picker, calendar, pagination, command palette, avatar,
  dropdown menu. None was built speculatively.
* Advanced data-table behaviour (sorting logic, pagination, selection). The
  foundation and a sort-button primitive exist; the behaviour belongs to the
  workflow that needs it.
* Dark mode, if a product requirement ever appears.

---

### Next Phase

PHASE 03 — not started. Its specification is an empty file and must be written
before implementation.

A developer building the homepage should be able to compose it entirely from
`Container`, `Section`, `SectionHeader`, `Card`, `Button`, `Badge`,
`SiteHeader`, `SiteFooter` and the design tokens, without inventing a colour,
a font size, a spacing value or an interaction pattern. `/design-system` shows
the full inventory in one page.
