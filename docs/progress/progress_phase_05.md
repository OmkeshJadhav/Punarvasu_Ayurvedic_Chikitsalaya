## PHASE 05 — About, Clinic & Contact Experience

Status:
COMPLETED

Completed On:
2026-09-17

Summary:
Finished the core public website. `/about`, `/practitioners`,
`/practitioners/[slug]` and `/contact` now exist, the header points at four
real routes instead of in-page anchors, and the clinic's **verified address
and phone number** are published for the first time — in the footer, on the
contact page, on the home page's location section and in `MedicalClinic`
structured data.

Two things this phase deliberately did **not** do, and says so to the visitor
rather than only in a source comment: it names no practitioner, because none
has been confirmed; and it renders no enquiry form, because there is nowhere
for a message to go.

599 tests pass, up from 445. Live axe runs against the production build report
zero violations at 390px and 1280px on all five public pages with real
computed contrast, and there is zero horizontal overflow at nine viewport
widths on every one of them.

Three real defects were found by that live verification and fixed. Two
apparent failures turned out to be bugs in the verification harness, not in
the product; both are recorded below rather than quietly dropped.

---

### Repository assessment before starting

Phases 02–04 left a complete design system, a public shell and the services
experience. Reused rather than rebuilt: `Container`, `Section`,
`SectionHeader`, `Card`/`CardLink`, `Button`, `Alert`, `Badge`, `Field`,
`Input`, `Textarea`, `Breadcrumbs`, `EmptyState`, `Reveal`, `MediaFrame`,
`ProcessSteps`, `FaqAccordion`, `FinalCtaSection`, `SiteHeader`,
`SiteFooter`, the token system, the motion language, `serializeJsonLd` and the
`metadataBase`/canonical setup.

Three findings shaped the work:

* `config/clinic.ts` existed and was empty by design, with every dependent
  block hiding itself. That is exactly the seam the verified address and phone
  needed, so publishing them was a data change plus display formatting.
* `config/marketing-content.ts` held a **second** practitioner model
  (`PractitionerPreview`, `PRACTITIONER_PREVIEWS`) that only the home page
  used. Building `/practitioners` on top of it would have left two models of
  one domain concept — the duplication `AGENTS.md` §32 forbids — so the home
  page was migrated onto the new feature and the old model deleted.
* `public/images/` still contains no photograph of the clinic's own rooms.

---

### Routes

| Route | Rendering | Notes |
| --- | --- | --- |
| `/about` | Static | Nine sections; the page's single inversion is the Devanagari name band |
| `/about/opengraph-image` | Static | Generated brand card |
| `/practitioners` | Static | Roster, unpublished-state notice, method, CTA |
| `/practitioners/[slug]` | SSG, **0 pages** | `generateStaticParams` + `dynamicParams = false`. Every slug is a real 404 while nobody is published — see *The practitioner detail route* |
| `/practitioners/opengraph-image` | Static | Generated brand card |
| `/contact` | Static | Channels, location and map, enquiry, FAQ, CTA |
| `/contact/opengraph-image` | Static | Generated brand card |
| `/sitemap.xml` | Static | Extended with the three new pages; practitioner profiles appear only when published |

Verified against a production server: `/about`, `/practitioners`, `/contact`
all **200**; `/practitioners/does-not-exist`, `/practitioners/ABOUT`,
`/practitioners/%2e%2e%2f%2e%2e%2fetc` and `/practitioners/practitioner-profile-1`
(a placeholder's own slug) all **404**.

---

### Files added

```text
src/features/about/content.ts
src/features/contact/content.ts
src/features/contact/schema.ts
src/features/contact/schema.test.ts
src/features/practitioners/types.ts
src/features/practitioners/content.ts
src/features/practitioners/directory.ts
src/features/practitioners/directory.test.ts
src/features/practitioners/content-safety.test.ts
src/app/(public)/about/{page,opengraph-image}.tsx
src/app/(public)/practitioners/{page,opengraph-image}.tsx
src/app/(public)/practitioners/[slug]/page.tsx
src/app/(public)/contact/{page,opengraph-image}.tsx
src/components/marketing/page-hero.tsx
src/components/marketing/prose-section.tsx
src/components/marketing/statement-list.tsx
src/components/marketing/brand-name-section.tsx
src/components/marketing/practitioner-card.tsx
src/components/marketing/practitioner-grid.tsx
src/components/marketing/practitioner-profile.tsx
src/components/marketing/contact-channels.tsx
src/components/marketing/clinic-location.tsx
src/components/marketing/map-embed.tsx
src/components/marketing/contact-enquiry.tsx
src/components/marketing/contact-form.tsx
src/lib/seo/og-card.tsx
tests/components/about-page.test.tsx
tests/components/practitioners.test.tsx
tests/components/contact-page.test.tsx
docs/progress/progress_phase_05.md
```

### Files modified

```text
src/config/clinic.ts                 verified address + phone; mapUrl, mapEmbedUrl,
                                     directionsUrl; addressLines(), formatPhone()
src/config/navigation.ts             ABOUT/PRACTITIONERS/CONTACT paths,
                                     practitionerPath(); header now four routes;
                                     footer groups rewired; FUTURE_PUBLIC_ROUTES empty
src/config/images.ts                 ABOUT_IMAGES
src/config/marketing-content.ts      practitioner model removed (moved to the feature);
                                     intro "read more" now points at /about
src/app/(public)/layout.tsx          footer contact links: formatted phone, real
                                     touch target, focus ring
src/app/(public)/page.tsx            reads the practitioner directory
src/app/sitemap.ts                   /about, /practitioners, /contact, published profiles
src/components/marketing/practitioner-preview.tsx   rebuilt on the feature + shared card
src/components/marketing/why-punarvasu.tsx          composes StatementList
src/components/marketing/intro-section.tsx          links to /about
src/components/marketing/location-section.tsx       44px targets on tel:/mailto:
src/components/layout/breadcrumbs.tsx               24px minimum target (WCAG 2.2 SC 2.5.8)
tests/components/home-page.test.tsx  nav, link allow-list and JSON-LD assertions updated
tests/components/marketing.test.tsx  practitioner fixtures moved to the feature's types
docs/PUNARVASU_MASTER_SPEC.md        status, routes, clinic and practitioner content
docs/ARCHITECTURE.md                 §1.1 route inventory
docs/DESIGN_SYSTEM.md                §63 clinic-facts status; marketing component index
```

### Dependencies

**None added.** `next/og` ships with Next.js. No map SDK, no form library, no
validation library beyond the Zod already present, no E2E tool.

---

### Clinic data — what is verified and what is not

| Fact | Status | Where it appears |
| --- | --- | --- |
| Postal address | **Verified** (supplied by the clinic) | Contact page, footer, home page location section, About page, `MedicalClinic` JSON-LD |
| Phone number | **Verified** | Contact page (`tel:`), footer, home page, hero action, JSON-LD `telephone` |
| Google Maps embed | **Verified** (the clinic's own listing) | Contact page, rendered with the page and lazily fetched |
| Directions / "Open in Google Maps" links | Derived from the verified address | Contact page |
| Email address | **Not supplied** | Absent. The contact page says so and offers the phone |
| Opening hours | **Not supplied** | Absent. The contact page and the FAQ both say so and say to call |
| Social profiles | **Not supplied** | Absent; the footer renders no social row |

One formatting change was made to supplied data: a space was inserted in
`"Samruddhi 7Apartment"` → `"Samruddhi 7 Apartment"`. That is a typography
correction rather than a change of fact, and it is flagged in `clinic.ts` and
under *Known issues* for the clinic to confirm.

`formatPhone()` groups the number for reading (`+91 75070 43414`); every
`tel:` link uses the stored E.164 value, so a dialler never parses spacing.

---

### Practitioner data

**Nobody has been verified, so nobody is named.** This is the phase's most
important decision and it is enforced in three places rather than one:

1. **The type.** `Practitioner` is a discriminated union. A
   `pending-verification` entry has **no descriptive fields at all** — not
   optional ones, absent ones. There is nothing to fill in by accident.
2. **The runtime.** `content-safety.test.ts` asserts that no shipped entry is
   `published` and that no unverified object carries a `name`, `designation`,
   `qualifications`, `specialties`, `biography`, `approach`, `experience` or
   `languages` key. A future data source cannot spread one in without failing
   the build.
3. **The product.** `/practitioners` renders a notice, in plain language,
   saying the clinic has not confirmed its practitioners' names,
   qualifications and registration details, that the photographs are
   placeholders, and that a phone call will answer the question. A visitor is
   told the truth instead of being shown stock portraits with invented
   credentials under them.

Model (`features/practitioners/types.ts`): `slug`, `status`, and for a
published practitioner `name`, `designation?`, `qualifications?`,
`specialties?`, `shortBio?`, `biography?`, `approach?`, `experience?`,
`languages?`, `image?`. There is deliberately no `rating`, `patientCount`,
`awards` or `availability` field — a field that exists gets filled.
`experience` is free text so the only way to state it is to quote the clinic.

`directory.ts` is the query seam a database replaces: the slug boundary
normalises, pattern-checks, length-bounds and then looks up in a map built
from the **published** subset. Publishing a practitioner is a data change; the
card, the profile page, `generateStaticParams` and the sitemap all follow.

#### The practitioner detail route

`/practitioners/[slug]` is implemented in full and renders nothing today,
which is the correct behaviour rather than an omission.

`getPractitionerSlugs()` returns published slugs only, so with nobody
published `generateStaticParams` returns no paths and `dynamicParams = false`
makes every URL a real 404 — including a placeholder's own slug, which is
guessable from the listing page's markup. A profile page for someone whose
name and qualifications nobody has verified would have nothing true on it, and
a page reading "name to be confirmed" adds a URL, a sitemap entry and an
indexable document without adding a fact.

`PractitionerProfile` and its metadata are covered by tests against a
synthetic fixture, so the code is proven rather than merely compiled. The
`dynamicParams = false` choice reuses the measurement Phase 04 recorded: with
the default, `notFound()` throws after the streaming shell has flushed and the
response is HTTP 200 with an empty document — a soft 404 that tells every
crawler the person exists.

---

### Contact form

| Aspect | State |
| --- | --- |
| UI | **Built** — `components/marketing/contact-form.tsx` |
| Validation | **Built** — `features/contact/schema.ts`, Zod, written to run on both sides of the trust boundary |
| States | idle / submitting / success / error, all four implemented and tested |
| Rendered on `/contact` | **No** |
| Server endpoint | **Not built** |

**Why no form is rendered.** Punarvasu has no message-delivery channel: no
email provider is configured, no enquiries table exists, and no retention or
access policy has been agreed for storing what people write about their health
(`phase_05.md` §43, `SECURITY.md` §33). That left three options — a form that
silently discards messages, a form that always fails, or the channel that
actually works. The first is a lie, the second invites someone to write out
their question and then throws it away, and `phase_05.md` §40 forbids fake
submission success. So `/contact` renders the direct-contact panel and says
plainly that online messages are not connected yet.

`phase_05.md` §40 is being followed rather than bent: *"implement the UI and
validation foundation and document the backend integration required later."*
`CONTACT_FORM_DELIVERY` in `features/contact/content.ts` is the switch, and
the enabling change replaces one `Alert` with `<ContactForm onSubmit={...} />`.

**What the foundation already guarantees**, all asserted by tests:

* No field for symptoms, medical history, medications, diagnosis, reports,
  date of birth or file uploads — and unknown keys are stripped by the schema,
  so a public form cannot become an accidental medical record.
* Every field length-bounded; a 5 MB message is rejected rather than accepted.
* A honeypot (`company`), hidden from sight and from assistive technology and
  removed from the tab order. No CAPTCHA, per §42.
* Phone optional and normalised; email trimmed and lower-cased.
* Specific, non-judgemental messages — never "Invalid input".
* `Field` binds the label, `aria-describedby`, `aria-invalid` and a
  `role="alert"` error to every control.
* The submit button carries `loading` for the whole submission, which sets
  `aria-busy` and disables it; the form's own handler also guards a re-entrant
  submit, asserted by dispatching a second `submit` event directly.
* Success **replaces** the form, so a confirmation cannot be followed by an
  accidental second send.
* The failure path shows fixed safe copy plus the phone; a test throws
  `Error("relation contact_enquiries does not exist")` and asserts the words
  `contact_enquiries` and `relation` never reach the document.
* A prominent warning not to include health information — it is not a secure
  channel.

**Required before enabling:** a delivery adapter (email provider or an
enquiries table with RLS), a server route parsing the body through this same
schema via `parseInput`, rate limiting, a retention policy, and a decision on
who may read submissions.

---

### The map

The map **renders with the page**, lazily fetched. `loading="lazy"` keeps it
from competing with the content above it: it sits low on a phone and in the
right column from `lg`, so the browser requests it as it comes into view
rather than during the initial load.

This reverses a decision made earlier in the phase. The first implementation
gated the frame behind a "Show the map" button, on the reasoning in
`phase_05.md` §33 — an embedded map is a third-party request with cookies
attached, imposed on everyone who opened the page, and most visitors want the
address and the number. That reasoning is still true, and it was overridden
deliberately: seeing where a clinic is, without an extra tap, is worth more to
someone planning a visit. The disclosure that the frame is Google's remains as
a caption beneath it.

The accessible alternative required by §34 is unchanged and is not an
afterthought: the full address is text directly beneath the map, again in the
contact details above it and again in the footer; "Get directions" opens the
visitor's own maps app; "Open in Google Maps" sits beside it. All of that
works if the frame never loads. The frame carries a `title` (how a screen
reader names an iframe), `loading="lazy"` and
`referrerpolicy="strict-origin-when-cross-origin"`.

Removing the button also removed the component's state, so `MapEmbed` is now
a **server component** and the contact page ships no page-specific JavaScript
beyond the FAQ disclosure.

Verified against the production build: exactly one iframe in the served HTML,
with the correct `src`, `title` and `loading`; the address still present as
text; and axe clean at 390px and 1280px with the frame rendered.

### SEO

| Item | State |
| --- | --- |
| Titles | Unique per page: "About Punarvasu", "Our Practitioners", "Contact & Visit" |
| Meta descriptions | Unique per page, no keyword stuffing |
| Canonical | `/about`, `/practitioners`, `/contact`, and `/practitioners/[slug]` per profile |
| Open Graph | type, siteName, title, description, url, locale, generated image — all three pages |
| Twitter | `summary_large_image` on all three |
| OG images | One generated 1200×630 brand card per page, prerendered. Composed by the new shared `lib/seo/og-card.tsx`, which replaced what was becoming five near-identical `ImageResponse` trees |
| Sitemap | `/about`, `/practitioners`, `/contact` added; profiles generated from the **published** directory, so an unpublished profile that 404s is never listed |
| Structured data | `MedicalClinic` on `/contact` with the verified address and telephone — matching the visible page, as §52 requires. `BreadcrumbList` on all three pages |

**What structured data deliberately omits.** No `openingHours`, no
`aggregateRating`, no `review`, no `priceRange`, no `email`, and no `Person`
for a practitioner. A search engine republishes what it finds with the
clinic's name attached; `Person` exists to carry a name, a job title and
credentials, which is precisely what has not been verified. It becomes
appropriate in the same change that publishes a practitioner.

All verified against the production build's served HTML.

---

### Accessibility

**Live, against the production build**, via the Chrome DevTools Protocol with
`axe-core` injected into the real page — the only way to measure computed
colour contrast. Nothing was added to `package.json`.

| Page | 390px | 1280px |
| --- | --- | --- |
| `/about` | **0 violations** | **0 violations** |
| `/practitioners` | **0** | **0** |
| `/contact` | **0** | **0** |
| `/` (regression) | **0** | **0** |
| `/services` (regression) | **0** | **0** |

Also measured live:

* **Heading outline** — exactly one `<h1>` and no skipped level on any page
  (`/about` 28 headings, `/contact` 15, `/practitioners` 9).
* **Touch targets at 390px** — everything meets WCAG 2.2 SC 2.5.8 (24px).
  The only element between 24 and 44px is the breadcrumb "Home" link at
  exactly 24px, which is a text link in a trail rather than a pointer target.
* **Keyboard** — a contact FAQ question opens on Enter and its panel really
  contains the answer; the skip link is the first focusable element and
  becomes visibly 169×36 when focused.
* **Anchor offset** — `/about#approach` lands with the heading at 254px and
  the sticky header ending at 81px, so nothing is hidden behind the bar.
* **Reduced motion** — with `prefers-reduced-motion: reduce` emulated, zero
  elements have a running animation and `scroll-behavior` is `auto`.
* **Images** — nothing upscaled at 390px or 1280px after scrolling the page.

In component tests: axe sweeps over each page (with the `region` and landmark
rules enabled), the practitioner card in both states, the empty grid, the
profile, the contact form in its initial and error states, and `MapEmbed`
with no map configured. Every section landmark is named; every image has an `alt`; the
breadcrumb's final crumb carries `aria-current="page"`; the Devanagari name
carries `lang="sa"`.

**Not run:** a manual screen-reader pass (NVDA/VoiceOver). Unchanged since
Phase 02.

**One tooling limit, stated rather than hidden:** axe cannot traverse into an
iframe under jsdom — it posts a message into the frame's document, which jsdom
does not implement across frames. `tests/support/axe.ts` therefore sets
`iframes: false`, with the reason recorded there. The accessibility property
that belongs to this codebase rather than to Google's page — the frame's
accessible name — is asserted directly, and the whole contact page is swept by
axe in a real browser, where frames do work.

---

### Responsive

Horizontal overflow measured at **320, 375, 390, 430, 768, 1024, 1280, 1440
and 1920px** on `/about`, `/practitioners`, `/contact`, `/` and `/services`:
**none at any width on any page**.

Screenshots were captured and reviewed at 1280px (all three new pages) and
390px (`/about`, `/contact`).

Layout behaviour:

* `PageHero`: copy and the primary action come before the photograph on a
  phone; the photograph moves alongside from `lg` with the reading order
  unchanged.
* Practitioner cards: a 3:2 crop above the text on a phone — a 4:5 portrait
  across a full-width phone is most of the screen before any words — becoming
  a full-height column beside the text from `sm`.
* Contact channels: a single column on a phone with "Call the clinic" as a
  full-width primary action, two columns from `sm`.
* The map panel keeps a 4:3 aspect on a phone and 16:10 from `sm`, so the
  space is reserved either way.
* Editorial sections are heading-left / prose-right from `lg` and stack below
  it, which keeps the paragraphs at a real measure on a wide screen.

---

### Security

| Check | Result |
| --- | --- |
| Slug handling | Normalised, pattern-checked, length-bounded, then looked up in a map of **published** practitioners. Nothing from the URL is interpolated anywhere |
| Traversal / injection | `../../etc/passwd`, `one/../two`, `<script>`, a SQL-shaped string, a 5,000-character slug, an empty segment and percent-encoded traversal all resolve to `undefined`; `/practitioners/%2e%2e%2f%2e%2e%2fetc` returns 404 against the production server |
| Unpublished-record enumeration | A placeholder's slug is printed in the listing page's markup and still 404s — asserted by test and measured against the server |
| Third-party frame | One, user-initiated, with `referrerpolicy="strict-origin-when-cross-origin"` and no `allow` list. The visitor is told before it loads |
| Secrets in the client bundle | `npm run security:scan-bundle` — clean, 133 files |
| `dangerouslySetInnerHTML` | Only for JSON-LD, with developer-authored data through `serializeJsonLd`, which escapes `<` |
| Patient data | None is collected, stored or transmitted by this phase |
| Input validation | The contact schema is bounded and strips unknown keys; it is not wired to any endpoint, so there is no server trust boundary to defend yet |
| Security headers | Phase 01's baseline confirmed present on `/contact` |
| New dependencies | None |

**Documented for the phase that adds contact submission:** the client schema is
feedback only. The route must parse the body through the same schema via
`parseInput`, rate-limit, reject the honeypot server-side, and return the
standard sanitized envelope.

---

### Tests

599 passing, up from 445. New:

| File | Count | Covers |
| --- | --- | --- |
| `features/practitioners/directory.test.ts` | 23 | Roster integrity, published/routable correspondence, unpublished slugs unreachable, preview ordering, and the slug boundary against hostile input |
| `features/practitioners/content-safety.test.ts` | 28 | Outcome claims, named conditions, fabricated specifics and response-time promises across the About, Practitioners and Contact copy; nobody named; no descriptive field on an unverified entry; unverified facts stated as unverified |
| `features/contact/schema.test.ts` | 17 | Valid and invalid enquiries, normalisation, bounds, the honeypot, and that no health field exists or survives |
| `tests/components/about-page.test.tsx` | 22 | Page structure, anchors and their offsets, the footer's deep link, link allow-list, the review notice, the name explanation, the commitments, no stock clinic interior, breadcrumb JSON-LD, axe — plus `ProseSection` and `StatementList` |
| `tests/components/practitioners.test.tsx` | 27 | Nobody named, the notice, placeholder alt text, no profile link while none exists, no `Person` JSON-LD, and the card/grid/profile in both states against a synthetic fixture |
| `tests/components/contact-page.test.tsx` | 37 | `tel:` targets, the address, the honest absences, directions, the map and its accessible alternative, no form, keyboard FAQ, JSON-LD matching the page — plus `MapEmbed` and all four `ContactForm` states |

Modified: `home-page.test.tsx` (navigation is now routes; the link allow-list
gained the new pages; the JSON-LD assertion now requires the address and
telephone to match `config/clinic.ts` and still forbids hours, ratings,
reviews, prices and email) and `marketing.test.tsx` (practitioner fixtures
moved onto the feature's types).

```text
TypeScript:            PASS
ESLint:                PASS (--max-warnings=0)
Prettier:              PASS
Unit + integration:    PASS (599)
Component + axe:       PASS (included above)
Live axe:              PASS — 0 violations, 5 pages x 2 widths, real contrast
Live overflow:         PASS — none at 9 widths x 5 pages
Live keyboard:         PASS — map, FAQ, skip link, anchor offset
Production build:      PASS — 30 static pages
Client bundle scan:    PASS — 133 files, 0 findings
Route status codes:    PASS — measured against `next start`
E2E:                   NOT RUN — no E2E tool is installed (deferred since Phase 01)
Screen reader:         NOT RUN
Lighthouse:            NOT RUN — not installed
```

---

### Defects found and fixed

**1. Touch targets below the WCAG 2.2 AA minimum.** *(real, found by live
measurement)* Three elements measured under 24px at 390px: the breadcrumb
"Home" link (22px), the footer's phone link (17px) and the contact page's
inline phone link (21px). The last two only appeared because this phase
published a phone number for the first time — the footer contact block had
never rendered before. `Breadcrumbs` now carries `min-h-6` (the 24px AA bar
for a text link in a trail); the phone and email links carry `min-h-11`, since
a phone number on a phone is the most tapped thing on the page. The fix in
`location-section.tsx` also repairs the home page, which had the same latent
problem.

**2. "Send a message" over "not connected yet".** *(real, found by reviewing a
screenshot)* The enquiry section's eyebrow contradicted its own heading. It
now has its own eyebrow, "Getting in touch".

**3. Two duplicate models of one concept.** *(real, found by inspection)* The
home page had its own `PractitionerPreview` type and placeholder array. Both
are gone; the home page reads the same roster through the same directory and
renders the same cards, so publishing a practitioner updates both pages at
once.

**Two apparent failures that were harness bugs, not product bugs** — recorded
because a report that only lists the checks that passed is not evidence:

* The map and the FAQ "did not respond to Enter". `Input.dispatchKeyEvent`
  with `type: "keyDown"` alone never fires a button's default action; the
  sequence has to be `rawKeyDown` + `char` + `keyUp`. A programmatic `click()`
  proved the components were hydrated and working before the harness was
  corrected.
* The FAQ selector picked `button[aria-expanded]` index 0, which at 1280px is
  the mobile-menu trigger — present in the DOM, `display: none`, and therefore
  unfocusable. Scoped by label instead.

A third round of failures was a **stale `next start`** still serving the
previous build after the touch-target fix. Worth recording: the fix had landed
and the measurement said otherwise.

---

### Design decisions

**1. `PageHero` is one component for three pages.** `/about`,
`/practitioners` and `/contact` all open the same way, and three hand-written
heroes drift apart within a phase. Cross-page consistency is a stated
requirement (§49), not a nicety.

**2. These pages open on the warm surface, not the brand band.** `/services`
spends its single inversion on its hero, which is right for a catalogue.
Doing it on every page turns the accent into wallpaper. `/about` spends its
one inversion on the Devanagari name band instead; `/practitioners` and
`/contact` have none.

**3. The name section is the About page's ornament.** The clinic's own name in
its own script, set large on the brand band. That is the opposite of a generic
botanical motif, and it is why the page needs no decorative glyphs — the thing
§12 explicitly warns against.

**4. Differentiators are stated as refusals.** "Four things we will not do"
rather than four adjectives. Every line is a rule this website already
visibly follows, which is why it can be published without clinical sign-off:
they are statements about conduct, not about outcomes. It is also the section
that most clearly is not a template.

**5. "Our approach to care" lives on About, not on Practitioners.** The site
was on its way to four numbered sequences. The practitioner's method inside
the room belongs on the page about how the clinic practises (§13); the
practitioners page gets prose instead, and the two link to each other.

**6. No clinic interior photography, and the page says so.** No file in this
repository shows Punarvasu's own consulting or treatment rooms, and §24
forbids implying that stock imagery is the clinic. The About page states in
words that the photographs have not been published yet. A test asserts that
any alt text describing a clinic interior also declares itself a placeholder.

**7. No search or filter on the practitioners page.** §22 is explicit that a
small roster is better served by a curated presentation. Nothing is hidden
behind a control, and no client island exists to drive one.

**8. An unconfirmed detail is shown as unconfirmed, not omitted.** Opening
hours and email render a short sentence saying the clinic has not confirmed
them. "What time do they open?" is a question the visitor arrived with;
silence leaves them hunting, whereas an honest answer plus the phone number
resolves it.

**9. `StatementList` replaced a shape the site made four times.** The home
page's differentiators were the fourth copy of it, so `why-punarvasu.tsx` was
refactored onto it rather than left as a fifth.

**10. `lib/seo/og-card.tsx` replaced what was becoming five `ImageResponse`
trees.** Same composition, words as data.

---

### Content review required before launch

Everything below is development content written for review. None of it is
signed off, and the product says so where a visitor could mistake it for the
clinic's own words.

| Item | Where |
| --- | --- |
| The About page's story, purpose and beliefs | `features/about/content.ts` — `ABOUT_REVIEW_NOTICE` renders on the page |
| The four commitments | Same. They describe conduct this site already follows, but the clinic should confirm it holds to them |
| The etymology of "Punarvasu" | Same. Sanskrit roots and the nakshatra reference; the clinic's own reason for the name is **not** stated because it was not supplied |
| The consultation method (six steps) | Same |
| Practitioner page copy | `features/practitioners/content.ts` |
| Contact FAQ answers | `features/contact/content.ts` — written to stay true whatever the clinic's policies turn out to be |
| Building-name spelling | `config/clinic.ts` — "Samruddhi 7 Apartment" |
| All photography | `config/images.ts` — every file except the logo is a placeholder; rights position not established |

---

### Acceptance criteria

#### About

| Criterion | Result |
| --- | --- |
| `/about` exists | PASS |
| About hero implemented | PASS — `PageHero` with a photograph and two actions |
| Punarvasu story implemented | PASS — "Why Punarvasu exists", plus the name section. **No founder story**, because none was supplied, and the page says so |
| Philosophy implemented | PASS — "What we believe" plus four principles |
| Approach to care implemented | PASS — six steps, distinct from the home page's journey and linked to it |
| Differentiators implemented where verified | PASS — four commitments, each a rule the site follows |
| Clinic experience implemented where assets exist | PASS — implemented as text; **no clinic photography exists**, so none is shown and the page says why |
| Practitioner preview implemented | PASS — reads the same roster as `/practitioners` |
| CTA implemented | PASS |

#### Practitioners

| Criterion | Result |
| --- | --- |
| `/practitioners` exists | PASS |
| Practitioner listing works | PASS |
| Practitioner cards are accessible | PASS — one stretched link when published, no link when not; heading in both states; axe clean |
| Practitioner data is typed | PASS — a discriminated union, no `any` |
| Practitioner detail pages exist if appropriate | PASS — route, metadata and profile implemented and tested; **0 pages built**, because no practitioner is published |
| Invalid practitioner slug produces 404 | PASS — measured against the production server, including a placeholder's own slug and encoded traversal |
| No fabricated qualifications or claims | PASS — enforced by the type, by tests and by the visible notice |
| Consultation CTA exists | PASS |

#### Contact

| Criterion | Result |
| --- | --- |
| `/contact` exists | PASS |
| Contact information is displayed | PASS |
| Phone link works | PASS — `tel:+917507043414`, verified in the served HTML |
| Email link works | NOT APPLICABLE — no email address has been supplied; the page says so |
| Address is displayed | PASS — in an `<address>`, over two lines, in the footer too |
| Directions work where configured | PASS — opens a maps app in a new tab |
| Map/location experience exists | PASS — the map renders with the page, lazily fetched |
| Accessible map alternative exists | PASS — address as text beneath the map and in the contact details and footer, plus directions and "Open in Google Maps"; all of it works if the frame never loads |
| Opening hours displayed only when verified | PASS — not verified, so not displayed; the absence is stated |
| Contact form exists if appropriate | PARTIAL, by decision — the UI and validation foundation exist and are tested; the form is **not rendered** because there is no delivery channel. See *Contact form* |
| Form validation works | PASS — 17 schema tests and the component's own |
| Error/success states are safe | PASS — fixed copy; a test asserts a thrown SQL-shaped message never reaches the document |

#### Navigation

| Criterion | Result |
| --- | --- |
| Public navigation is consistent across all pages | PASS — four routes, no anchors left in the header |
| Footer is consistent | PASS — now carries the verified address and phone |
| Mobile navigation works | PASS — unchanged from Phase 02/03, re-verified by axe on every page |

#### SEO

| Criterion | Result |
| --- | --- |
| About metadata exists | PASS |
| Practitioner metadata exists | PASS |
| Practitioner detail metadata is dynamic | PASS — generated from the directory, built only from confirmed fields |
| Contact metadata exists | PASS |
| Canonical strategy is correct | PASS — verified in the served HTML |
| Structured data is factual | PASS — `MedicalClinic` matches the visible page; no hours, rating, review, price or `Person` |

#### Accessibility

| Criterion | Result |
| --- | --- |
| Keyboard navigation works | PASS — verified in a real browser |
| Forms are properly labeled | PASS — `Field` makes it structural |
| Error messages are accessible | PASS — `role="alert"`, `aria-describedby`, `aria-invalid` |
| Heading hierarchy is correct | PASS — measured live, no skipped level |
| Images have appropriate alt text | PASS |
| Focus states are visible | PASS — including the skip link, measured |
| Reduced motion is supported | PASS — verified with emulation |
| Map has an accessible alternative | PASS |

#### Responsive

320 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920: **PASS at every
width, no horizontal overflow**, measured on all five public pages.

#### Security

| Criterion | Result |
| --- | --- |
| No secrets exposed | PASS — bundle scan clean |
| No private data exposed | PASS — this phase handles none |
| Contact input is safely handled | PASS — bounded, unknown keys stripped, no health field |
| Server-side validation exists where backend submission exists | NOT APPLICABLE — no backend submission exists; the requirement is recorded for the phase that adds one |
| Raw internal errors are not exposed | PASS — asserted by test |

---

### Known issues

1. **No practitioner is published**, so `/practitioners/[slug]` builds zero
   pages and the practitioners page names nobody. Intended, and stated on the
   page — but it must not ship to production this way.
2. **The contact form is not rendered.** The foundation is complete; a
   delivery channel, a server route, rate limiting and a retention policy are
   required before it can be switched on.
3. **All About, Practitioners and Contact copy is unreviewed**, and the About
   page says so. The clinic's founding story has not been supplied and none
   was written.
4. **No email address or opening hours.** Both are marked as unconfirmed on
   the page rather than guessed.
5. **"Samruddhi 7 Apartment"** — a space was inserted into the supplied
   string. Confirm the building name with the clinic.
6. **No clinic photography.** Every image on the site except the logo is a
   placeholder, and the rights position of the current files has not been
   established.
7. **The 404 page has no site chrome.** Inherited from Phase 03, and now
   reached by a mistyped practitioner URL as well. The fix is a not-found
   boundary inside the `(public)` route group.
8. **Legal pages still do not exist** — privacy policy, terms and a medical
   disclaimer page are required before a healthcare platform launches. The
   disclaimer text is published in the footer; the pages are not.
9. **Still no CSP.** Unchanged since Phase 02, and now slightly more
   involved: the contact page loads a Google Maps frame, so the policy needs a
   `frame-src` entry for it.
10. **Favicon is still the Next.js default.**
11. **No E2E tool, no screen-reader pass, no Lighthouse run.** Unchanged.
12. **Supabase remains unproven against a live project.** Untouched here.

---

### Deferred work

* Publishing real practitioners — a data change in
  `features/practitioners/content.ts`, plus `Person` structured data in the
  same commit.
* The contact submission backend: delivery adapter, server route using the
  existing schema, rate limiting, retention policy, access control.
* Database-backed clinic settings replacing `config/clinic.ts`, and a
  database-backed practitioner directory replacing `directory.ts`'s bodies.
  The row-level-security requirement is recorded in both modules.
* Legal pages and the footer links to them.
* Content-Security-Policy, including `frame-src` for the map.
* A not-found boundary inside the `(public)` route group.
* E2E tooling, visual regression, a manual screen-reader pass, Lighthouse.
* Favicon and further brand artwork.
* The booking engine. `/appointments/new` remains the truthful interstitial.

Phase 06 has not been started.
