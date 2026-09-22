## PHASE 04 — Services & Ayurvedic Treatments Experience

Status:
COMPLETED

Completed On:
2026-09-17

Summary:
Built the public services experience: `/services` and seven prerendered
treatment pages at `/services/[slug]`, backed by a typed catalogue feature
that a database or CMS can replace without touching a component. The
treatment pages are editorial articles with a sticky contents rail, a
process timeline, preparation and aftercare guidance, an always-present
safety section, related-treatment navigation and a consultation CTA.

Every word of treatment copy is development content that no practitioner has
approved, and the product says so — on the listing page and on every detail
page — rather than only in a source comment. A content-safety test suite
scans all visitor-facing strings for outcome claims, named conditions and
fabricated specifics, and fails the build on a hit.

444 tests pass. Live axe runs against the production build report zero
violations at 390px and 1280px on `/services`, both treatment page shapes,
the 404 and the Home page, with real computed contrast. Zero horizontal
overflow at nine viewport widths on all five pages.

One defect found and fixed during verification: the treatment-specific 404
returned HTTP 200. Details below.

---

### Repository assessment before starting

Phase 03 left a complete public shell and a Home page. What was reused rather
than rebuilt: `Container`, `Section`, `SectionHeader`, `Card`/`CardLink`,
`Button`, `Alert`, `Accordion`, `EmptyState`, `ErrorState`, `Reveal`,
`MediaFrame`, `SiteHeader`, `SiteFooter`, the token system, the motion
language, `serializeJsonLd` and the `metadataBase`/canonical setup.

Three things already in the repository shaped decisions:

* `config/images.ts` declares every photograph with real dimensions, alt text
  and a `placeholder: true` provenance flag. Phase 04 extended it rather than
  introducing a second image registry.
* `config/clinic.ts` holds no verified clinic facts, and every dependent
  block hides itself. Nothing in this phase changed that.
* `public/images/home-0.png`, `home-1.png` and `home-2.png` turned out to be
  **design reference mockups of a different clinic's website**, not
  photography. They are not used, and should not be: they contain another
  brand's name, fabricated practitioner details and invented testimonials.

---

### What was built

#### Routes

| Route | Rendering | Notes |
| --- | --- | --- |
| `/services` | Static | Catalogue, grouped by category |
| `/services/[slug]` | SSG, 7 pages | `generateStaticParams` + `dynamicParams = false` |
| `/services/[slug]/opengraph-image` | SSG, 7 images | Generated branded card per treatment |
| `/services/error.tsx` | — | Segment error boundary, inside the public shell |
| `/sitemap.xml` | Static | Extended: `/services` plus every treatment |

Slugs: `ayurvedic-consultation`, `panchakarma`, `abhyanga`, `shirodhara`,
`mukha-lepa`, `herbal-preparations`, `lifestyle-guidance`.

#### The services feature

```text
src/features/services/
├── types.ts                  content model
├── content.ts                the catalogue and page copy — the review surface
├── catalogue.ts              query layer, slug boundary, path helpers
├── catalogue.test.ts         integrity and slug safety
└── content-safety.test.ts    medical-claim and fabrication scanning
```

`catalogue.ts` is the seam a later phase replaces with database reads: the
signatures stay, the bodies change, no component moves.

#### Components

Created:

| Component | Purpose |
| --- | --- |
| `layout/breadcrumbs.tsx` | Semantic `nav` + `ol`, `aria-current` on the final crumb |
| `marketing/services-hero.tsx` | Inverted brand band, page `h1`, category jump rail |
| `marketing/treatment-catalogue.tsx` | Grouped category sections, empty state |
| `marketing/treatment-card.tsx` | One-link card; typographic variant when there is no photograph |
| `marketing/featured-treatments.tsx` | "Where most people begin" row |
| `marketing/personalization-note.tsx` | Why the page will not recommend a treatment |
| `marketing/treatment-hero.tsx` | Breadcrumb, name, Sanskrit term, summary, CTAs, photograph |
| `marketing/treatment-article.tsx` | Article body, sticky contents rail, safety section |
| `marketing/related-treatments.tsx` | Content navigation, explicitly not a recommendation |
| `marketing/content-review-notice.tsx` | The unreviewed-content banner |
| `marketing/process-steps.tsx` | One numbered sequence, three layouts |
| `marketing/faq-accordion.tsx` | The shared disclosure list |

Modified:

| File | Change |
| --- | --- |
| `marketing/patient-journey.tsx` | Now composes `ProcessSteps` (`row`); composition unchanged |
| `marketing/faq-section.tsx` | Now composes `FaqAccordion`; **became a server component** |
| `marketing/final-cta.tsx` | Copy and a secondary action are now props, defaulting to the Home page's |
| `marketing/service-preview.tsx` | Gained an "Explore all treatments" link to `/services` |
| `config/navigation.ts` | `SERVICES_PATH`, `treatmentPath()`; "Consultations" anchor → "Treatments" route |
| `config/images.ts` | `TREATMENT_IMAGES` |
| `lib/seo/structured-data.ts` | `buildBreadcrumbJsonLd` |
| `app/sitemap.ts` | Generates treatment entries from the catalogue |
| `app/not-found.tsx` | Gained a "View our services" action |

Two extractions removed duplication rather than adding abstraction:
`ProcessSteps` replaced what was about to be three hand-rolled timelines, and
`FaqAccordion` replaced what was about to be three copies of the same
accordion — and in doing so turned the Home page's FAQ section back into a
server component.

---

### Design decisions

**1. The services hero is typographic, not photographic.** Repeating the Home
page's full-bleed photograph would make the two pages read as the same page,
and no photograph in the repository depicts "the range of care a clinic
offers". The deep-green brand band is this page's single inversion, which
leaves the warm surfaces below it for the treatment photography.

**2. No search and no category filter.** The specification makes both
conditional (§13, §35, §37) and this catalogue does not justify either: seven
treatments in three groups are all on the page at once. A filter would hide
six of them behind a control, add a client island and hidden state, and ask
the visitor to make a decision before reading anything. Instead the catalogue
is grouped into labelled sections with a jump rail in the hero — zero client
JavaScript, everything visible. `catalogue.ts` records the threshold at which
that trade reverses: roughly a dozen entries, or a category too large to scan
in one eyeful.

**3. Related treatments are content navigation.** The heading is "Explore
related Ayurvedic therapies" and the standfirst says the list exists because
those treatments sit near this one in the catalogue, not because they have
been suggested for anyone. The relationship is a static curated list topped up
from the same category; nothing about the visitor is involved, because nothing
about the visitor is known.

**4. The card action is "Explore treatment", not "Book now".** A booking CTA
on a therapy nobody has assessed is the pressure this site exists to avoid.
The consultation CTA appears in the treatment hero and again at the foot of
the page, where the visitor has actually read something.

**5. A treatment with no photograph gets a typographic card.** Six
photographs honestly depict six therapies. The Ayurvedic Consultation has
none, so it renders as a sand-surfaced type tile at the same grid height
rather than borrowing an unrelated image. `Treatment.image` is optional for
that reason, and both the card and the detail hero handle its absence.

**6. The contents rail is `position: sticky` and nothing else.** Highlighting
the section in view needs a scroll observer, which would mean wrapping the
whole article in a client component — a nicety, not a capability. The rail is
hidden below `lg`, where it would be a duplicate navigation aid above the
content it lists.

**7. No sticky mobile CTA.** §54 permits one; it also warns against adding
one because it is fashionable. The hero CTA and the closing CTA bracket the
page, and a persistent bar would cover content on a 320px screen and add
client JavaScript for it.

---

### Medical content: what is safe, what is not

**Nothing in this phase is clinically verified.** Punarvasu has supplied no
service list, no descriptions, no durations, no fees and no contraindications.

The line drawn, and enforced:

| Statement | Status |
| --- | --- |
| What a classical Ayurvedic therapy *is*, and what physically happens during it | Educational; written |
| Whether Punarvasu offers it | A fact about the clinic; **unverified, and labelled as such in the UI** |
| What it will do for the reader | A medical claim; **never made** |

Controls:

* Every treatment carries `reviewStatus: "pending-clinical-review"`, a
  required field rather than an optional flag.
* `ContentReviewNotice` renders on the listing page and on every unreviewed
  detail page, in plain language, to the visitor. It disappears per treatment
  as a practitioner signs the copy off, so nobody has to remember to remove
  it.
* All treatment copy lives in one file, `features/services/content.ts`, so a
  clinician can review the medical content without reading React.
* The content model **has no** `price`, `duration`, `availability` or
  `rating` field. A field that exists gets filled; a runtime test asserts the
  objects agree with the type.
* Traditional descriptions are rendered under a heading that names them as
  traditional, followed by an explicit line in the page saying the section is
  not a summary of clinical research.
* Precautions always render. Where the clinic has supplied none, the page
  shows the general "discuss your history with your practitioner" guidance
  instead of an invented contraindication list.
* The emergency note appears on every treatment page and on `/services`, in
  the open, never inside an accordion.
* No testimonial, statistic, rating, patient count or practitioner credential
  appears anywhere.

`content-safety.test.ts` scans every visitor-facing string — treatment copy,
page copy, FAQ answers, notices — against three families of patterns:
outcome and efficacy claims, named medical conditions, and fabricated
specifics (prices, durations, session counts, ratings, clinician names,
availability). It caught two sentences during development, both of which were
rewritten rather than exempted:

* `"Is Panchakarma suitable for everyone?"` → `"Can anyone have Panchakarma?"`
* `"Classical Ayurveda treats the preparation…"` → `"…regards the
  preparation…"`

**Requires clinic review before launch:** the entire service list, all seven
treatment descriptions, the preparation and aftercare guidance, the
precautions, the FAQ answers on `/services`, and `GENERAL_PRECAUTION_NOTE`.

---

### The 404 defect, found and fixed

The first implementation had `/services/[slug]/not-found.tsx` — a
treatment-specific 404 inside the public shell, with the header, the footer
and links to the catalogue — and left `dynamicParams` at its default.

Measured against a production build, `/services/does-not-exist` returned
**HTTP 200** with an essentially empty document: `notFound()` threw after the
streaming shell had flushed, so the status could no longer be changed and the
content arrived only in the flight payload. The tailored page rendered, but no
crawler would ever see it, and the status told every one of them the page
existed. A soft 404 on a clinic's catalogue is worse than a plain one.

Resolution: `dynamicParams = false`, which returns a real **404** with the
application-wide not-found page, served statically — verified. The tailored
page was deleted rather than left as unreachable code, and the global 404
gained a "View our services" action. The reasoning and both measurements are
recorded in the route's docblock so nobody reverses it by intuition.

Cost, recorded as a known issue: the application-wide 404 sits above the
`(public)` route group and therefore renders without the site header and
footer. This is the Phase 03 limitation, now reached by one more path.

---

### Content placeholders and review items

| Item | State |
| --- | --- |
| Service list (7 treatments) | **Development content.** Not confirmed as the clinic's range |
| All treatment descriptions | **Development content.** Pending clinical review |
| Preparation / aftercare guidance | **Development content.** General, not clinic-specific |
| Precautions | Only general safety statements. No clinic-supplied contraindications |
| `/services` FAQ answers | Written to stay true whatever the clinic's policies turn out to be |
| Treatment photographs | All placeholders (`placeholder: true` in `config/images.ts`). Not Punarvasu's rooms, therapists or patients |
| Durations, fees, packages | **Absent by design.** Not modelled, not displayed |
| Practitioner information | Unchanged from Phase 03: none |
| Clinic contact details | Unchanged from Phase 03: none |

---

### SEO

| Item | State |
| --- | --- |
| `/services` metadata | Title, description, canonical `/services`, Open Graph, Twitter card |
| Treatment metadata | Generated from the catalogue in `generateMetadata`; the summary doubles as the description so the two cannot drift |
| Canonical | Per treatment, e.g. `/services/shirodhara`. A case-variant URL resolves to the prerendered page and its canonical points at the lowercase path, so it is not a duplicate document |
| Open Graph images | One generated 1200×630 branded card per treatment, prerendered. Not the treatment photograph: the source files are square placeholders that crop badly and are not the clinic's own photography |
| Sitemap | `/`, `/services`, and every treatment, generated from the catalogue |
| Robots | Unchanged; the new routes are indexable |
| Structured data | `BreadcrumbList` on every treatment page, nothing else |

**Why no `MedicalTherapy` or `FAQPage`.** Those types exist to carry
`indication`, `contraindication` and `expectedPrognosis` — exactly the
assertions with no verified source here — and a search engine republishes what
it finds with the clinic's name on it. `FAQPage` lifts answers straight into
results, and these answers are development content. Both are withheld until
the copy is reviewed; the reasoning is in `buildBreadcrumbJsonLd`'s docblock.

Verified against the production build: title, description, canonical, all
`og:*` and `twitter:*` tags, and the breadcrumb JSON-LD payload.

---

### Accessibility

**Live, against the production build**, via the Chrome DevTools Protocol with
`axe-core` injected into the real page (no dependency added — the Phase 03
approach):

| Page | 390px | 1280px |
| --- | --- | --- |
| `/services` | **0 violations** | **0 violations** |
| `/services/shirodhara` (with photograph) | **0** | **0** |
| `/services/ayurvedic-consultation` (no photograph) | **0** | **0** |
| `/services/does-not-exist` (404) | **0** | **0** |
| `/` (regression) | **0** | **0** |

Colour contrast is included, with real computed values.

Also verified live:

* **Heading outline** — no skipped level on any page.
  `/services` is `1 2 3 3 3 …`, treatment pages `1 2 2 2 3 …`.
* **Keyboard walk** — 40 tab stops on `/services`, every one reachable, none
  under 24px tall, focus order matching visual order.
* **Focus visibility** — the ten card links that report no outline of their
  own are the `CardLink` stretched links, by design: the ring belongs to the
  card. Confirmed the card paints `solid 2px rgb(42,71,58)` while its link is
  focused.
* **Inverted band** — a focus ring on the hero's jump rail resolves to
  `rgb(255,255,255)`, i.e. `data-surface="inverted"` is re-pointing it away
  from the invisible primary green.

In component tests: `axe` sweeps over the services page, the treatment card
(both variants), the breadcrumbs, the treatment hero and the treatment
article; keyboard open/close of an FAQ answer; every section landmark named;
unique ids; every image with an accessible name.

Semantics worth naming: breadcrumbs are `nav` + `ol` with `aria-current` on
the final crumb; each category is a labelled `<section>` so the jump rail
lands somewhere named; the contents rail is `nav aria-label="On this page"`;
cards are `<li>`s in a `<ul>` so the count is announced; the Sanskrit term
carries `lang="sa-Latn"`; the "Explore treatment" affordance is `aria-hidden`
so each card is announced once.

---

### Responsive

Horizontal overflow measured at **320, 375, 390, 430, 768, 1024, 1280, 1440
and 1920px** on `/services`, both treatment page shapes, the 404 and the Home
page: **none at any width on any page**.

Layout behaviour:

* Catalogue grid: 1 column → 2 at `sm` → 3 at `lg`.
* Treatment hero: single column with the CTA above the photograph on mobile,
  two columns from `lg`.
* Treatment article: single column below `lg`, contents rail beside it above.
* Process steps: vertical timeline on mobile, horizontal row from `lg` for
  the Home journey, a two-column grid for "how treatment is chosen".
* Category heading and its description stack on mobile, sit on one baseline
  from `sm`.

---

### Security

| Check | Result |
| --- | --- |
| Slug handling | Normalised, pattern-checked, length-bounded, then looked up in a `Map` built from the catalogue. Nothing from the URL is interpolated anywhere |
| Traversal / injection | `../../etc/passwd`, `shirodhara/../panchakarma`, `<script>`, a SQL-shaped string, a 5,000-character slug and an empty segment all return `undefined`; covered by tests, and `/services/%2e%2e%2f%2e%2e%2fetc` returns 404 against the production server |
| Record enumeration | There is no query layer to reach past. The only reachable records are the seven public catalogue entries |
| Secrets in the client bundle | `npm run security:scan-bundle` — clean, 109 files scanned |
| `dangerouslySetInnerHTML` | One use, for JSON-LD, with developer-authored data through `serializeJsonLd`, which escapes `<` |
| New dependencies | None |
| Third-party scripts | None |
| Patient data | None is handled by this phase |

**Documented for the phase that makes this database-backed:** the guarantee
above comes from the map lookup, not from the framework. A database query must
filter to published, public treatments server-side under row-level security,
rather than selecting by slug alone. Recorded in `catalogue.ts`.

---

### Tests

444 passing, up from 353. New:

| File | Count | Covers |
| --- | --- | --- |
| `features/services/catalogue.test.ts` | 23 | Slug shape and uniqueness, category integrity, image alt text, related-slug resolution, grouping, featured subset, and the slug boundary against hostile input |
| `features/services/content-safety.test.ts` | 23 | Outcome claims, named conditions, fabricated specifics, banned fields, review status |
| `tests/components/services.test.tsx` | 37 | Services page structure, jump-rail targets, anchor offsets, card links, empty state, breadcrumbs, treatment hero (both variants), article section omission, safety copy, related treatments, keyboard FAQ, axe |

Modified: `tests/components/home-page.test.tsx` — the "every nav item has an
anchor target" assertion now scopes itself to anchor items, since "Treatments"
became a real route, and the internal-link allow-list gained `/services`.

```text
TypeScript:            PASS
ESLint:                PASS
Prettier:              PASS
Unit + integration:    PASS (444)
Component + axe:       PASS (included above)
Live axe:              PASS — 0 violations, 5 pages × 2 widths, real contrast
Live overflow:         PASS — none at 9 widths × 5 pages
Production build:      PASS — 24 static pages
Client bundle scan:    PASS
E2E:                   NOT RUN — no E2E tool is installed (deferred since Phase 01)
```

---

### Performance

* `/services` and all seven treatment pages are prerendered static HTML. No
  data fetching at request time, so there is nothing that can fail there.
* Client JavaScript on `/services` is the shell (`NavLink`, `MobileNav`,
  `Reveal`) plus one `FaqAccordion`. The catalogue, the cards, the category
  sections, the featured row and the personalization panel are all server
  components.
* Images: every `<img>` carries a correct `sizes`, a generated `srcset` and
  fixed frame dimensions from `MediaFrame`, so there is no layout shift.
  Below-the-fold treatment photographs are lazy; the treatment hero image
  carries `priority` and emits a `<link rel="preload" as="image">` —
  confirmed in the served HTML.
* `/services` has no priority image, correctly: its LCP element is the
  typographic hero.
* No animation library, no new dependency, no third-party script.

Not measured: Lighthouse/field Core Web Vitals. No throttled-network audit was
run.

---

### Acceptance criteria

#### Services listing

| Criterion | Result |
| --- | --- |
| `/services` exists | PASS |
| Uses the Punarvasu public shell | PASS — the Phase 03 `(public)` layout, header and footer; no second header |
| Hero implemented | PASS |
| Treatments displayed | PASS — seven, grouped into three categories |
| Cards have meaningful hierarchy | PASS — Sanskrit eyebrow, serif title, summary, action |
| Cards navigate to valid detail pages | PASS — asserted for every treatment |
| Categories implemented where useful | PASS — three groups with descriptions, plus a jump rail |
| Search implemented only if justified | PASS — deliberately not implemented; threshold recorded |
| Empty states handled | PASS — catalogue empty state, tested |
| No unsupported content presented as fact | PASS — review notice plus the content-safety suite |

#### Treatment detail

| Criterion | Result |
| --- | --- |
| `/services/[slug]` exists | PASS — seven prerendered pages |
| Valid treatments render correctly | PASS |
| Invalid slugs produce a proper 404 | PASS — verified 404 against the production server; see the defect note |
| Breadcrumbs work | PASS — semantic, `aria-current`, plus `BreadcrumbList` JSON-LD |
| Treatment hero exists | PASS |
| Overview exists | PASS — required by the model |
| What-to-expect where applicable | PASS — present on all seven |
| Treatment process where applicable | PASS — the same timeline |
| Preparation / aftercare / precautions handled | PASS — preparation and aftercare omit when absent; precautions always render, with a general fallback |
| Related treatments work | PASS — every treatment has at least one, asserted |
| Consultation CTA exists | PASS — hero and page foot |
| No patient-specific recommendations | PASS — enforced by copy, by the personalization section and by the safety suite |

#### Design

| Criterion | Result |
| --- | --- |
| Phase 02 design system used | PASS — tokens only; no new colour, radius or shadow |
| Phase 03 public shell reused | PASS |
| Visual hierarchy is strong | PASS |
| Premium and editorial | PASS — grouped index, contents rail, restrained type, one inversion |
| No generic template appearance | PASS |
| No excessive decoration | PASS — one icon per safety block, no gradients, no blobs |

#### Responsive

320 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920: **PASS at every
width**, no horizontal overflow, measured.

#### Accessibility

| Criterion | Result |
| --- | --- |
| Semantic HTML | PASS |
| Correct heading hierarchy | PASS — measured live, no skipped level |
| Keyboard navigation | PASS — 40-stop tab walk, FAQ operable from the keyboard |
| Visible focus states | PASS — including the card ring and the inverted band |
| Accessible search/filter controls | NOT APPLICABLE — neither implemented |
| Accessible breadcrumbs | PASS |
| Meaningful alt text | PASS — asserted per image |
| Reduced motion supported | PASS — inherited; all motion is `motion-safe:` or the global rule |
| Adequate contrast | PASS — live axe with real computed colours |

#### SEO

| Criterion | Result |
| --- | --- |
| Services page metadata | PASS |
| Treatment pages have dynamic metadata | PASS — generated from the catalogue |
| Open Graph implemented | PASS — including a generated card per treatment |
| Canonical strategy correct | PASS |
| Structured data only where appropriate and factual | PASS — `BreadcrumbList` only, with the omissions reasoned |

#### Performance

| Criterion | Result |
| --- | --- |
| Images optimized | PASS — `sizes`, `srcset`, fixed frames, lazy below the fold, preload for the hero |
| Server-rendered where practical | PASS — every new section except the FAQ disclosure |
| Client JavaScript minimized | PASS — no filter island; the FAQ is the only new client component |
| No unnecessary dependencies | PASS — none added |
| No obvious layout shift | PASS — every image sits in a fixed-aspect frame |

---

### Known issues

1. **The 404 page has no site chrome.** Inherited from Phase 03 and now
   reached by a mistyped treatment URL as well. The fix is a not-found
   boundary inside the `(public)` route group; it belongs to a phase that
   revisits the 404 for the whole site.
2. **All treatment content is unreviewed**, and the product says so on every
   page. This is the intended state, not a defect — but it must not ship to
   production unreviewed.
3. **All treatment photography is placeholder.** None of it is Punarvasu's
   own, and the rights position of the current files has not been
   established.
4. **`public/images/home-0.png`, `home-1.png`, `home-2.png`** are design
   mockups of another clinic's website containing a different brand name,
   fabricated practitioner details and invented testimonials. Unused, and
   they should be deleted rather than left where someone might treat them as
   assets.
5. **No E2E coverage.** No E2E tool is installed; deferred since Phase 01.
   The live CDP checks cover accessibility, overflow and keyboard, but not a
   scripted user journey.
6. **No Lighthouse or throttled-network audit** was run.

---

### Deferred work

* Search and category filtering, when the catalogue passes roughly a dozen
  treatments. `catalogue.ts` records where the query API goes.
* Database or CMS-backed treatments, replacing `catalogue.ts`'s bodies. The
  row-level-security requirement is recorded there.
* `MedicalTherapy` and `FAQPage` structured data, in the change that marks
  content `verified`.
* Verified durations, fees and contraindications, each added as a model field
  in the same change that adds the data.
* A mobile sticky consultation CTA, if conversion data ever argues for one.
* Active-section highlighting in the contents rail, if it proves worth a
  client component.
* Practitioner pages, the About page and the contact page — later phases.
* The booking engine. `/appointments/new` remains the truthful interstitial.

Phase 05 has not been started.
