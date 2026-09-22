## PHASE 20 — Performance, SEO & Accessibility

Status:
COMPLETED — measured in a real browser against a production build, with the
security regression re-run

Completed On:
2026-09-22

Summary:
An optimization phase, not a feature phase. Measure, find the real bottleneck,
fix it, measure again — and refuse to claim an improvement the numbers do not
support.

Four findings carried the work, and every one came from a measurement rather
than from reading the code:

```text
12.70 MB of source images  ->  1.34 MB        three photographs were PNG
 188.7 KB of fonts a page  ->  105.4 KB       four characters cost 83.3 KB
 391 KB of Zod on two      ->  0 KB           a client asked for two integers
   static auth pages
 an unindexable preview    ->  environment-aware robots + noindex
   deployment was not
   actually prevented
```

Three smaller ones followed: `/services` — the site's main entry point for
search traffic — was the only public page shipping without an `og:image`; the
sitemap advertised a home URL that disagreed with the page's own canonical;
and the patient appointment list read a patient's entire history with no
bound.

**No product behaviour changed.** No new feature, no new route a visitor can
reach, no schema change, no migration, no dependency added or removed, and no
authorization path touched. One visual change was made deliberately and is
documented in section 4.

4,473 tests pass, up from 4,401. **484 live checks** against a production
build in a real browser: 131 SEO, 84 public accessibility and responsive, 241
authenticated across four roles, and 28 keyboard, motion and zoom. The Phase
19 security suite passes unchanged at 193/193.

**Five of my own measurements were wrong before they were right**, four of
them harness bugs and one an environment artifact that nearly made me ship the
opposite of the correct decision. Each is recorded in section 11, because a
report that lists only the checks that passed is not evidence.

---

### Repository assessment before starting

Phases 01–19 left a product in unusually good condition for this phase, and it
is worth saying what was *already* true, because it is what made the remaining
findings visible:

* **No Zustand, no Framer Motion, no chart library, no date library, no PDF
  viewer, no third-party script.** Sections 12, 13, 33, 135, 136 and 137 all
  ask about dependencies this project has repeatedly declined to add. The
  analytics chart is inline SVG (Phase 16), the timezone layer is `Intl`
  (Phase 09), and document previews are a plain `<iframe>` (Phase 14).
* **69 client components, all leaf-level.** No layout carries `"use client"`.
* **CLS was already 0 on every public page**, because Phase 03's `MediaFrame`
  reserves an aspect ratio for every photograph and both fonts are self-hosted
  through `next/font` with metric-matched fallbacks.
* **No N+1 query anywhere.** `resolveAppointments` deduplicates ids and issues
  two `.in()` queries in a `Promise.all` regardless of list length; nine route
  segments and ten query modules already fetch in parallel.
* **`lucide-react` is imported by name** at all 67 sites, 44 distinct icons.

So the work was not "make it fast" but "find what is actually slow". Four
things were.

---

### 1. Performance: what was measured, and how

`phase_20.md` section 4 asks for measure → identify → optimize → measure →
verify. Section 255 asks for the methodology to be repeatable. Both matter
here more than usual, because **the host this was measured on is not a quiet
machine**: 1.1 GB free of 15.7 GB, with the developer's own editor, browser
and tooling running. Under a 4x CPU throttle that produced a **2,600 ms spread
between samples of the same page**, and it briefly convinced me of a
conclusion that was the opposite of the truth (section 11, defect 1).

Two profiles are therefore used, and reported separately:

```text
A. Slow 4G network only     1.6 Mbps / 150ms RTT, no CPU throttle
                            Stable here: 24-136ms spread across 5 samples.
                            Used for the headline Core Web Vitals.

B. Slow 4G + 4x CPU         Lighthouse's mobile profile.
   + mobile emulation       Unstable here: up to 700ms spread. Used only to
                            compare against the Phase 20 baseline, which was
                            taken the same way.
```

**Deterministic byte measurements are what the improvement claims rest on.**
They are machine-independent, and they are the numbers in section 2.

#### Core Web Vitals — final, profile A, median of 5 samples

```text
page                     LCP      CLS     FCP     LCP element
/                     1308ms      0    1288ms    hero.jpg (AVIF, 640w)
/services             1168ms      0    1168ms    standfirst paragraph
/services/shirodhara  1156ms      0    1148ms    hero.jpg (AVIF, 640w)
/about                1148ms      0    1124ms    about-hero.jpg (AVIF, 640w)
/practitioners        1036ms      0    1036ms    standfirst paragraph
/contact              1000ms      0    1000ms    standfirst paragraph

targets: LCP <= 2500ms, CLS <= 0.1        every page inside both
```

TTFB on the public pages is 5–15 ms locally; they are statically prerendered
and the proxy's `getUser()` short-circuits without a session cookie, so an
anonymous visitor pays no auth round trip. That was verified rather than
assumed — it was the first hypothesis measured, and it was wrong.

#### INP

Reported honestly, because one interaction misses the target:

```text
surface                          4x CPU throttle    unthrottled
mobile menu open (Radix Sheet)        272ms            48ms
services FAQ disclosure               120ms            48ms
treatment page contents rail           88ms            32ms
contact FAQ disclosure                 16ms             0ms

target: INP <= 200ms
```

**The mobile menu's first open exceeds 200 ms under a 4x CPU throttle.** It
opens a Radix Dialog, which creates a portal, traps focus, locks scroll and
marks siblings inert — real work, done once. It is 48 ms unthrottled and 40 ms
on the second open. It is recorded as a remaining risk rather than rounded
down.

Getting to that number took three wrong readings: see section 11, defects 4
and 5. In particular, **Chrome's mobile device emulation inflates interaction
latency by ~600 ms under CPU throttling on this host** — the same Contact FAQ
measured 808 ms with emulation on and 184 ms with it off, at the same width,
same throttle, same page.

#### Baseline versus final, profile B

Like-for-like with the Phase 20 baseline, medians of 5:

```text
page                    baseline    final     delta
/                         2584ms   1640ms    -944ms
/services                 1656ms   1568ms     -88ms
/services/shirodhara      1992ms   1992ms        0
/about                    1936ms   2180ms    +244ms
/practitioners            1448ms   1508ms     +60ms
/contact                  1760ms   1696ms     -64ms
```

**Only the home page's improvement is outside the noise.** Sample spreads on
this profile reach 688 ms, so a per-page delta under ~300 ms means nothing
here, in either direction — including the ones that look like regressions. The
baseline figures were single samples, which makes them weaker still. This
table is published because sections 235 and 236 ask for it, with the caveat
that makes it readable rather than misleading.

---

### 2. What actually got smaller

Every number here is deterministic and was measured before and after.

#### Images: 12.70 MB -> 1.34 MB (-89%)

```text
about-hero.png  1413 KB  ->  about-hero.jpg   159 KB    photograph, no alpha
doctor1.png     1304 KB  ->  doctor1.jpg      100 KB    photograph, no alpha
doctor2.png     1287 KB  ->  doctor2.jpg      119 KB    photograph, no alpha
logo.png        1320 KB  ->  logo.png         116 KB    512x524, alpha kept
hero.jpg         709 KB  ->                   174 KB
spotlight.jpg    786 KB  ->                   214 KB
skincare.jpg     775 KB  ->                   177 KB
stress.jpg       721 KB  ->                   170 KB
arthritis.jpg    661 KB  ->                   144 KB
home-0/1/2.png  4001 KB  ->  deleted
```

Three of them were **photographs stored as alpha-free PNG**. Re-encoded at
JPEG q85 with 4:4:4 chroma, measured at **PSNR 38–42 dB** — the range where a
difference is not visible, rather than merely acceptable (section 21).

The logo needed different treatment and the options were measured rather than
guessed. Its alpha is real: 25.2% of pixels fully transparent, 1.4% partial
(the antialiased edge of the circular badge), so JPEG was never available.
Palette quantisation reached 121 KB but at a mean absolute error of 19.4/255
with a peak of 212 — visible banding on the one verified brand asset in the
repository — so it was rejected in favour of truecolor at 512x524.

512px is deliberate, not arbitrary: the lockup renders the badge at 40–48px so
even a 3x display needs 144px, but `lib/seo/structured-data.ts` publishes this
file's URL as the clinic's `logo` and `image`, which crawlers fetch **raw**,
bypassing the optimizer entirely. Its pixel size is a structured-data
requirement and its byte size is a real cost to them.

`home-0.png`, `home-1.png` and `home-2.png` were deleted. Nothing referenced
them: `progress_phase_04.md` recorded that they were design mockups of a
**different clinic's website**, carrying another brand's name, fabricated
practitioner details and invented testimonials, and should be removed rather
than left where someone might treat them as assets. 4.0 MB of the reduction is
them.

#### Fonts: 188.7 KB -> 105.4 KB on every services page

The single most surprising finding, and the one nothing but a byte-level
resource listing would have shown.

A treatment page downloaded **four** font files, not the two that are
preloaded:

```text
Inter latin-ext       83.3 KB      <- pulled by four characters
Inter latin           47.3 KB
Playfair latin        37.6 KB
Playfair latin-ext    20.5 KB
```

The four characters are `ā`, `Ś`, `ṅ` and `ṣ` — the entire set of non-Basic-
Latin text in the product, appearing only in `Abhyaṅga`, `Śirodhārā`,
`Auṣadha` and `Dinacaryā`. They sit in the `latin-ext` unicode-range, and
`marketing/treatment-card.tsx` rendered them in the **sans**, which obliged the
browser to fetch Inter's latin-ext face on `/services` and every treatment
page.

`subsets: ["latin"]` in the root layout cannot prevent this, and it is worth
recording why, because it looks like it should: `subsets` governs which faces
are **preloaded**, not which are emitted. Next.js emits `@font-face` rules for
every subset Google offers — cyrillic, greek, vietnamese and the rest — and
the browser decides what to download from `unicode-range` and the text it
actually meets. Eleven files exist; four were fetched.

The fix is in section 4, because it is also a design decision.

#### JavaScript: Zod off the two static auth pages

```text
/auth/register          1025.7 KB  ->  641.8 KB    -383.9 KB  (-37.4%)
/auth/forgot-password   1022.0 KB  ->  638.1 KB    -383.9 KB  (-37.6%)
```

The chain was four links long and none of them looked wrong in isolation:

```text
register-form.tsx        "use client"
  -> features/auth/content.ts        for AUTH_FIELDS and AUTH_PAGES
       -> features/auth/validation.ts   for PASSWORD_REQUIREMENT_TEXT
            -> zod
```

A client component asked for a sentence and two integers. A bundler cannot
supply those without the module they were declared in, and that module builds
Zod schemas at import time. `src/features/auth/limits.ts` now holds the four
constants and **imports nothing at all**; `validation.ts` imports and
re-exports them, so every server-side and test import still resolves and the
schemas remain the single definition of what a valid password is.

Only `contact-form.tsx` genuinely calls a Zod schema in the browser, and it is
imported by nothing — Phase 05 built it and deliberately does not render it,
so it was never in a bundle.

The same constants-from-a-schema-module pattern exists in six other features,
all reaching **dynamically rendered, authenticated, staff-facing** pages with
warm caches, and two of them import real functions rather than constants.
Those are recorded as deferred in section 13 with the reasoning, rather than
refactored on the strength of a measurement that was only taken on the two
static pages.

#### Page transfer, measured end to end

`/services/shirodhara` at 390px, every resource:

```text
before   468.3 KB    29 resources
after    369.7 KB    29 resources        -98.6 KB  (-21%)
```

#### AVIF

```text
hero.jpg at 640w     AVIF  22,260 bytes
                     WebP  37,728 bytes     AVIF 41% smaller
                     JPEG  48,806 bytes     the fallback
```

---

### 3. Rendering, caching and the server/client boundary

**Nothing changed here, and that is the finding.** Sections 9, 10, 11, 40, 41,
42 and 171 were audited and the existing architecture already satisfies them:

* No layout or page is a client component. All 69 `"use client"` modules are
  leaf-level interactive components.
* All 30 public marketing pages and both static auth pages still prerender;
  the build output is unchanged in rendering mode for every route.
* Authenticated pages remain `force-dynamic` with `private, no-store` from the
  proxy — verified live on 12 pages across four roles.
* No `unstable_cache`, no `revalidate`, no module-level memo on any
  authenticated read. Phase 16 asserted this for analytics; it holds
  everywhere.

Sections 43, 44 and 143 forbid globally caching authenticated data. Nothing in
this phase introduced a cache. The one caching change is
`next.config.ts`'s image configuration, which affects `public/images` only.

---

### 4. The one visual change

`marketing/treatment-card.tsx` renders a treatment's Sanskrit name in the
**serif** rather than the sans.

This is a design change made in an optimization phase, so it needs a better
justification than 83.3 KB — and it has one. `marketing/treatment-hero.tsx`
already set **the same datum** in the serif. The same Sanskrit name was
rendering in two different families depending on which surface you met it on,
and `docs/DESIGN_SYSTEM.md` section 8 assigns brand and editorial content to
the serif while reserving the sans for functional UI — navigation, forms,
labels, tables. A treatment's Sanskrit name is the former.

So the card was the inconsistent one, and correcting it happens to remove the
most expensive character set on the public site.

Verified visually at 1280px on both surfaces: the card's eyebrow now reads as
a tracked uppercase serif in terracotta above a serif title, the hero's italic
serif is unchanged, and the diacritics render correctly from Playfair's
latin-ext face. Contrast is unaffected — the colour token did not change — and
axe reports 0 violations on `/services` and all seven treatment pages at both
390px and 1280px.

---

### 5. Database and API

Audited against sections 45–55 and 160–166. One real finding.

**`getMyAppointments` had no bound.** It read a patient's entire appointment
history to render one page — the unbounded read sections 50 and 51 forbid, and
the same shape Phase 18 removed from the dashboard when it replaced
`getMyAppointments().upcoming[0]` with `getNextAppointment`. The cost grows
with every visit, so it degrades fastest for exactly the long-standing
patients the portal most needs to serve well, and it is invisible in
development where the seeded patient has a handful of rows.

Now bounded at 100, ordered `starts_at` descending so the bound falls on the
oldest history and **every upcoming appointment is always present**. The query
asks for one row over the bound, so "is there more?" is answered rather than
guessed, and the page says so when it bites rather than letting a patient
conclude their older visits were deleted. That follows the pattern Phases 11
and 12 established for the practitioner's patient search and clinical history:
bounded with a visible notice, not a pagination control on a list nobody reads
to the end.

Everything else was already correct:

```text
N+1 queries          none. resolveAppointments deduplicates ids and issues
                     two .in() queries in a Promise.all, regardless of length.
                     No query appears inside a loop anywhere in src/features.
Request waterfalls   nine route segments and ten query modules already use
                     Promise.all for independent reads.
Analytics            aggregated in PostgreSQL, bounded at 366 days, granularity
                     derived rather than requested (Phase 16). No feature
                     module performs a table read to count rows.
Indexes              Phase 16 added seven and reused four; Phase 20 adds none,
                     because it introduced no new query shape.
Pagination           notifications use a cursor; documents, prescriptions,
                     plans, clinical history and both searches are bounded.
```

No migration was written. Phase 20 changed no schema, no policy and no grant.

---

### 6. SEO

131 live checks against a production build, all passing. Three real gaps were
found and closed.

#### Environment-aware indexing — the significant one

Sections 180 and 182 require that a preview or staging deployment must not
compete with production in search results. **Nothing prevented it.**
`app/robots.ts` returned `allow: "/"` unconditionally and the root layout
declared `robots: { index: true }`, so any deployment that got a public URL
served the same content, as indexable as production.

`lib/seo/indexing.ts` now gates both on `APP_ENV`, which has carried a
`preview` value since Phase 01 for exactly this. Verified in both directions:

```text
APP_ENV=production   robots.txt allows, pages are "index, follow"
APP_ENV=preview      robots.txt is "Disallow: /", every page "noindex, nofollow"
```

Both, not one: `robots.txt` asks a crawler not to *fetch* a URL, and does not
remove one it already knows. `noindex` on the page is what actually excludes
it.

**`NODE_ENV` cannot answer this question** — Next.js sets it to `production`
for a preview build too. `lib/security/cookies.ts` reads `NODE_ENV` for a
different question and is right to.

The failure mode is stated rather than hidden, in the module, in
`.env.example` and here: `appEnv` defaults to `development`, so **a production
deployment that does not set `APP_ENV=production` will tell search engines not
to index it.** That is the deliberate direction to fail in — a wrongly indexed
preview pollutes results for everyone and is discovered late, while a wrongly
excluded production site is caught by the first look at `/robots.txt` — but it
is a deployment step that must not be missed.

#### `/services` had no Open Graph image

The one public page shipping without one, and the page that can least afford
it: the sitemap gives it priority 0.9 and describes it as the main entry point
for search traffic. Every sibling — `/`, `/about`, `/practitioners`,
`/contact` and all seven treatment pages — already had a card, so a shared
link to the services index previewed as a bare title. Added, using the page's
own hero wording, with no claim about outcome, price or availability.

#### The sitemap disagreed with the home page's canonical

The home page declares `alternates: { canonical: "/" }`, which Next resolves
against `metadataBase` to the bare origin with **no trailing slash**. The
sitemap emitted `${origin}/`. The two forms serve identical content, but a
sitemap advertising one URL while the page names another as canonical is the
duplicate-URL disagreement sections 178 and 223 ask to be checked for. The
sitemap now matches.

#### What the audit verified

```text
metadata        7 public routes: unique title, 50-300 char description,
                canonical on the production origin, full Open Graph, Twitter
                card, indexable. Every title and description unique.
private routes  10 checked. Each either redirects to /auth/login before any
                HTML exists, or renders with noindex. The redirect destination
                is itself noindex.
robots.txt      disallows /patient/, /doctor, /receptionist, /admin, /auth/,
                /api/, /notifications; advertises the production sitemap.
sitemap         12 URLs, all production-origin, no duplicates, no private
                route. Every one fetched: 200, indexable, self-canonical.
structured data MedicalClinic on / and /contact, BreadcrumbList on four
                pages. All parse. None carries aggregateRating, review,
                price or ratingValue.
internal links  14 distinct, none broken, none redirecting.
404             real HTTP 404, Punarvasu branding, offers navigation, noindex.
```

Structured data remains factual and minimal. No `Person` is published,
because no practitioner is verified; no `FAQPage` or `MedicalTherapy`, because
the treatment copy is still awaiting clinical review — the reasoning Phases 04
and 05 recorded is unchanged and still correct.

---

### 7. Accessibility

**84 public checks and 241 authenticated checks, all passing**, with axe run
against real rendered pages so colour contrast is measured from computed
values rather than inferred.

```text
public       12 pages   axe @390 and @1280: 0 violations
                        one <h1>, no skipped heading level, content in <main>
                        every effective touch target >= 24px at 390px
authenticated 23 pages  same, across patient / doctor / receptionist / admin
regression    /, /services, /contact re-swept after every change
```

The `region` and `landmark-unique` rules were enabled — the two that caught
real defects in Phases 06 and 11.

Keyboard-only, in a real browser:

```text
Home -> Services -> Service detail -> Contact       operated entirely by keyboard
skip link           first Tab stop, visible, 2px solid outline
treatment card      reachable by Tab; the card paints the focus ring for its
                    stretched link
FAQ disclosure      Enter opens, the panel really contains the answer (184
                    chars), Enter closes
mobile menu         focus enters, stays trapped across 12 Tab presses, Escape
                    closes, focus returns to the trigger
patient workflow    dashboard, appointments, prescriptions, documents, profile:
                    Tab enters the page, focused control has a visible indicator
```

Reduced motion: zero running animations and `scroll-behavior: auto` under
`prefers-reduced-motion: reduce`. Zoom is not blocked — the viewport carries
`width=device-width, initial-scale=1` with no `maximum-scale` or
`user-scalable=no`.

**Not done, and not claimed: no manual screen-reader pass.** Unchanged since
Phase 02. axe plus explicit keyboard, heading, landmark and focus assertions
is a real but partial substitute, and this phase does not close that gap.

No WCAG conformance claim is made. Section 258 forbids inferring one from
automated tooling, and the manual half is missing.

---

### 8. Responsive

Measured at every width section 124 lists, on 35 pages, with a **fresh layout
at each width** rather than a resize — Phase 09 recorded that resizing without
re-navigating produces a false positive on the contact page's map frame.

```text
320  375  390  430  768  1024  1280  1440  1920      no horizontal overflow
```

The nav element's own `scrollWidth` is checked as well as the document's,
because Phase 18 found a header that clipped its own contents while the page
reported no overflow — it absorbed the overflow by hiding content. That check
is kept.

Beyond the specified range, the site reflows cleanly down to **240px**. At
195px — a 390px phone at 200% zoom — there is 34px of overflow from a 209px
non-wrapping button in page content. That is below both section 124's 320px
floor and WCAG 1.4.10's 320 CSS px reflow bar, both of which pass, so it is
recorded as a measured limit rather than fixed by making button text wrap
everywhere.

---

### 9. Security regression

Sections 191, 192, 242 and 247. Performance work that quietly weakens
authorization is the failure this phase most needs to avoid.

```text
Phase 19 security suite          193/193 pass, unchanged
Full test suite                  4,473 pass across 138 files
Client bundle secret scan        clean, 182 files
npm audit                        0 vulnerabilities
No Supabase, Gemini or server
  configuration in any client
  chunk                          verified by grep over .next/static
```

Live, in a browser, signed in as each of the four roles:

```text
cross-role denial      22 route/role combinations, every one -> /forbidden,
                       and the refusal discloses no role, permission or policy
IDOR                   unknown appointment, prescription, treatment-plan and
                       document ids each render a not-found state and
                       disclose nothing
caching                12 authenticated pages: private, no-store
indexing               12 authenticated pages: noindex, nofollow
browser storage        nothing in localStorage or sessionStorage, for any role
URLs                   no query string or fragment carrying a resource id
```

Cross-*patient* denial (Patient A -> Patient B) is covered by the Phase 19
suite at the database level and was verified live with two patient accounts in
Phases 11–14. Phase 20 changed nothing in the authorization path — no policy,
no grant, no guard, no query scope — so those guarantees are unmodified rather
than re-asserted with a second seeded patient.

#### One control was added

`next.config.ts`'s `localPatterns` restricts the image optimizer to
`public/images/**` with no query string, and no `remotePatterns` are
configured. Two consequences, both verified live with a 400:

* **A patient document can never be optimized.** Phase 14 decided that
  document previews use a plain `<img>`/`<iframe>` and never `next/image`,
  because the optimizer would proxy a patient's file through a shared cache.
  Nothing enforced that but a comment. A signed storage URL is now refused.
* **The optimizer is not a general-purpose fetcher.** `/favicon.ico`, a remote
  URL and a quality outside the allowlist are all 400.

`qualities: [75]` closes a cache-amplification vector: without it, `?q=1`
through `?q=100` are 100 distinct cache entries per image per width, reachable
by anyone with the URL. `dangerouslyAllowSVG` stays `false` — Phase 14
excluded SVG from uploads because an SVG is a document that can carry script,
and enabling it here would reintroduce that one config line away from the
decision that excluded it.

---

### 10. Files changed

#### Created

```text
src/features/auth/limits.ts                   the four auth constants, no imports
src/lib/seo/indexing.ts                        environment-aware indexing
src/app/(public)/services/opengraph-image.tsx  the missing social card
tests/integration/asset-and-seo-invariants.test.ts   72 tests
docs/progress/progress_phase_20.md             this file
```

#### Modified

```text
next.config.ts                     image optimization + optimizer restrictions
src/app/layout.tsx                 robots directive gated on the environment
src/app/robots.ts                  non-production deployments disallow all
src/app/sitemap.ts                 home URL matches the page's canonical
src/config/images.ts               renamed sources, logo dimensions, provenance
src/components/marketing/treatment-card.tsx   Sanskrit name in the serif
src/components/auth/register-form.tsx         imports ./limits
src/components/auth/reset-password-form.tsx   imports ./limits
src/features/auth/content.ts                  imports ./limits
src/features/auth/validation.ts               imports and re-exports ./limits
src/features/appointments/queries.ts          getMyAppointments is bounded
src/features/appointments/types.ts            AppointmentsResult.truncated
src/features/appointments/content.ts          the truncation notice
src/app/(app)/patient/appointments/page.tsx   renders it
.env.example                                  APP_ENV now governs indexing
```

#### Assets

```text
public/images/about-hero.png -> about-hero.jpg     1413 KB -> 159 KB
public/images/doctor1.png    -> doctor1.jpg        1304 KB -> 100 KB
public/images/doctor2.png    -> doctor2.jpg        1287 KB -> 119 KB
public/images/logo.png          resized 512x524    1320 KB -> 116 KB
public/images/{hero,spotlight,skincare,stress,arthritis}.jpg   re-encoded
public/images/home-{0,1,2}.png  deleted            4001 KB -> 0
```

#### Dependencies

**None added, none removed.** The image work used `sharp`, which is already
present as a Next.js dependency for the optimizer, through a one-off script
rather than a committed tool.

---

### 11. Defects and false readings

Three real defects, all found by measurement. Five wrong readings of my own
instruments, recorded because a report that lists only what passed is not
evidence.

#### Real

**1. `/services` shipped without an `og:image`.** Found by auditing every
public route's metadata rather than spot-checking. Section 6.

**2. The sitemap's home URL disagreed with the page's canonical.** Found by
fetching every sitemap URL and comparing it against that page's own
`<link rel="canonical">`. Section 6.

**3. `getMyAppointments` was unbounded.** Found by reading the query layer for
`.limit()` coverage across all twelve feature modules. Section 5.

#### Wrong readings

**1. "AVIF is 780 ms slower." It is not, and I nearly shipped WebP because of
it.** The first A/B put AVIF 780 ms behind on LCP. Two things were wrong: the
AVIF image cache was cold, so the server was encoding on the critical path of
the very requests being timed; and the host was under memory pressure, giving
a 2,600 ms spread between samples of the same page. Re-run with warm caches,
network-only throttling and seven samples a page, AVIF was 152 ms **faster** on
a treatment page and tied on the home page — while transferring 41% fewer
bytes. The corrected comparison is in `next.config.ts` beside the decision.

This is the one that mattered: the wrong reading pointed at the opposite
action, and only re-measuring under controlled conditions found it.

**2. "The hero fetches a 3840px image on a 390px screen."** It does not. My
harness read `element.getAttribute('src')`, which is the fallback attribute
Next.js emits for browsers without `srcset`. `currentSrc` shows the browser
correctly selecting the 640w derivative. The harness was wrong; the
application was right.

**3. "Auth pages have only one landmark."** They have three. `goto` waited a
fixed 900 ms, and the dynamically rendered auth routes stream — at 900 ms only
the `<main>` shell had flushed. `goto` now waits for `readyState` complete
*and* for the DOM to stop changing.

**4. "An unknown appointment id crashes into the error boundary."** It renders
a proper not-found state. I had rebuilt `.next` underneath a running
`next start` while testing the preview robots behaviour, so the server was
serving a manifest whose chunk names no longer existed — a `ChunkLoadError`,
not application logic. **This is the stale-server trap six previous phases
recorded, and I walked into it anyway.** On a clean build all four resource
types handle an unknown id gracefully.

**5. "INP is 1,176 ms."** Three layers of artifact, peeled off one at a time.
Clicking during hydration accounted for some; renderer warmup accounted for
more (the *same* Contact FAQ measured 880 ms run first and 88 ms run third,
decreasing monotonically with run order); and **Chrome's mobile device
emulation accounted for ~600 ms** — the same page at the same width under the
same throttle measured 808 ms with emulation on and 184 ms with it off. The
honest figure is 272 ms worst case, and it is reported as missing the target.

Two more, smaller: a cross-role denial check read `location.pathname` before
the client-side redirect had settled, reporting a denial that had in fact
worked (Phase 08 documented that refusals travel in the RSC flight payload,
not as a 3xx); and each role reused a browser profile, so the second sign-in
found no form because the first role's cookie sent `/auth/login` straight to
`/account`.

---

### 12. Verification

Executed on 2026-09-22:

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 4,473 tests, 138 files** (was 4,401 / 137) |
| Security suite | `npm run test:security` | **PASS — 193/193**, unchanged |
| Production build | `npx next build` | **PASS** — no warnings; 30 public pages still static |
| Client secret scan | `npm run security:scan-bundle` | **PASS** — 182 files, 0 findings |
| Dependency audit | `npm audit` | **PASS — 0 vulnerabilities** |
| Bundle analysis | per-route first-load JS from prerendered HTML | **REVIEWED** — section 2 |
| **Live SEO audit** | 131 checks, production build | **PASS — 131/131** |
| **Live accessibility, public** | 84 checks, 12 pages, axe with real contrast | **PASS — 84/84** |
| **Live accessibility, authenticated** | 241 checks, 23 pages, 4 roles | **PASS — 241/241** |
| **Live keyboard / motion / zoom** | 29 checks | **PASS — 28/29** (the 195px case, section 8) |
| **Core Web Vitals** | 6 pages, 5 samples, two profiles | **MEASURED** — section 1 |
| **Responsive** | 9 widths x 35 pages, fresh layout each | **PASS** — no overflow |
| Lighthouse | — | **NOT RUN** — not installed. CWV measured directly instead |
| E2E | — | **NOT RUN** — no maintained E2E tool (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Real devices | — | **NOT RUN** — emulation only |

The 484 live checks are scripts written for this phase, not a maintained
suite.

---

### 13. Acceptance criteria

#### Performance

| Criterion | Result |
| --- | --- |
| Public pages have been measured | PASS — 6 pages, two profiles, 5 samples each |
| Core Web Vitals have been evaluated | PASS — section 1 |
| LCP has been optimized | PASS — 1000-1308ms, all inside 2.5s; the hero is preloaded, AVIF, and 41% smaller |
| INP has been optimized | **PARTIAL** — 16-120ms on three surfaces; the mobile menu is 272ms under 4x CPU throttle, 48ms unthrottled. Reported as a remaining risk |
| CLS has been optimized | PASS — 0 on every page, already true and preserved |
| Image delivery is optimized | PASS — AVIF/WebP, correct `sizes`, 89% smaller sources |
| Fonts are optimized | PASS — 83.3 KB removed from every services page |
| Client JavaScript is minimized | PASS — 384 KB off two static pages; no layout is a client component |
| Large dependencies are reviewed | PASS — there are none; section "Repository assessment" |
| Server/client boundaries are reviewed | PASS — unchanged, and correct |
| Major request waterfalls are addressed | PASS — already parallel; nothing new found |
| N+1 queries are addressed | PASS — none exist; `resolveAppointments` batches |
| Large lists are paginated | PASS — appointment history bounded; everything else already was |
| Analytics queries are bounded | PASS — Phase 16, unchanged and re-verified |
| Authenticated data is not globally cached | PASS — verified live on 12 pages |

#### SEO

| Criterion | Result |
| --- | --- |
| Public pages have unique titles | PASS — asserted, all 7 |
| Public pages have useful descriptions | PASS — unique, 50-300 chars |
| Canonical URLs exist | PASS — production origin, no preview host |
| Open Graph metadata exists | PASS — **and `/services`'s missing card was added** |
| Sitemap contains only public indexable pages | PASS — 12 URLs, each fetched and confirmed |
| Robots configuration exists | PASS — and is now environment-aware |
| Private routes are not indexable | PASS — 10 checked, plus 12 authenticated pages live |
| Structured data is valid and factual | PASS — parses; no rating, review or price |
| Internal links are healthy | PASS — 14 distinct, none broken or redirecting |
| No important public page returns an unintended 404 | PASS |
| No staging environment competes with production | PASS — **the gap this phase closed** |

#### Accessibility

| Criterion | Result |
| --- | --- |
| Semantic HTML | PASS |
| Heading hierarchy is correct | PASS — one `h1`, no skipped level, 35 pages |
| Keyboard navigation works | PASS — both critical workflows, operated entirely by keyboard |
| Focus states are visible | PASS — including the stretched-link card ring |
| Dialogs are accessible | PASS — focus trap, Escape, restoration |
| Forms are accessible | PASS — axe clean; Phase 06/07 assertions unchanged |
| Form errors are associated with fields | PASS — unchanged, covered by the component suite |
| Icon-only buttons have accessible names | PASS — `Button` requires it at the type level |
| Contrast is acceptable | PASS — axe with real computed colour, 0 violations |
| Colour is not the sole mechanism | PASS — unchanged |
| Images have appropriate alt behaviour | PASS — every registry entry asserted |
| Tables are accessible | PASS — unchanged |
| Charts have accessible alternatives | PASS — Phase 16's table beside the SVG, unchanged |
| Reduced motion is respected | PASS — 0 running animations, measured |
| Touch targets are usable | PASS — every effective target >= 24px at 390px |
| Browser zoom remains functional | PASS — not blocked; reflows to 240px |

#### Responsive

320 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920: **PASS at every
width on 35 pages**, no horizontal overflow, measured with a fresh layout at
each width. Mobile navigation, forms and lists all verified.

#### Privacy / Security

| Criterion | Result |
| --- | --- |
| Performance changes did not weaken authorization | PASS — no policy, grant, guard or query scope touched; 193/193 security suite; 22 live cross-role denials |
| Sensitive pages are not globally cached | PASS — measured live |
| Private routes are not indexed | PASS — measured live |
| Clinical data is not serialized unnecessarily | PASS — no change; the appointment bound reduces what is read |
| Server-only dependencies remain server-only | PASS — bundle scan clean |
| AI credentials remain server-only | PASS |
| Service-role credentials remain server-only | PASS |
| Signed document URLs remain authorization-gated | PASS — **and `localPatterns` now makes optimizing one impossible** |

#### Engineering

| Criterion | Result |
| --- | --- |
| Typecheck passes | PASS |
| Lint passes | PASS |
| Tests pass | PASS — 4,473 |
| Accessibility tests pass | PASS — component suite plus 325 live checks |
| Production build passes | PASS |
| Bundle analysis reviewed | PASS |
| Dependency audit remains acceptable | PASS — 0 vulnerabilities |
| Phase 19 security regression tests pass | PASS — 193/193 |

---

### 14. Deferred

Intentionally not done, per section 261's scope boundary.

* **The remaining constants-from-a-schema-module imports.** Six features do
  what auth did, but every one reaches a dynamically rendered, authenticated,
  staff-facing page with a warm cache, and two import real functions rather
  than constants. The measured win was on two *static, public,
  conversion-critical* pages. Doing the rest is a six-feature refactor on the
  strength of a measurement not taken there.
* **The mobile menu's 272 ms interaction.** Reducing it means changing what
  Radix's Dialog does on mount — a design-system change with real regression
  risk, for a metric measured on a host that inflates it.
* **A manual screen-reader pass.** Unchanged since Phase 02 and the largest
  remaining accessibility gap.
* **Lighthouse.** Not installed. Core Web Vitals were measured directly
  instead, which section 147 prefers to optimizing for a score.
* **Real-device and true slow-network testing.** Emulated only.
* **`minimumCacheTTL`.** Left at the default. Raising it would reduce
  re-optimization, but these filenames are not content-hashed, so a longer TTL
  means a changed image can serve stale. The precondition for raising it is
  hashed filenames.
* **Site chrome on the 404 page.** Inherited from Phase 03 and still open. It
  satisfies section 83 — it explains, offers navigation, carries branding,
  returns a real 404 and passes axe — and the same component renders
  authenticated `notFound()` states, so putting the marketing header on it
  would leak marketing chrome into a clinical surface.
* **Reflow below 240px**, and **a PWA, service workers or offline storage**
  (sections 185, 186), and **full internationalization** (section 86).

---

### 15. Known issues

1. **INP on the mobile menu is 272 ms under a 4x CPU throttle**, against a
   200 ms target. 48 ms unthrottled, 40 ms on the second open. It is one
   interaction, on a host that demonstrably inflates the measurement, and it
   is the only one of the three Core Web Vitals not comfortably inside target.
2. **The Core Web Vitals figures come from a contended host.** Under network-
   only throttling they are stable (24–136 ms spread) and are the ones
   reported. Under CPU throttling the same page varies by up to 700 ms, so the
   baseline-versus-final table in section 1 is only readable for the home
   page. These are indicative of a production deployment, not authoritative
   for one.
3. **`APP_ENV` must be set to `production` on the production deployment**, or
   the clinic's site will tell search engines not to index it. Documented in
   `.env.example`, in `lib/seo/indexing.ts` and here. Check `/robots.txt`
   after the first deploy.
4. **No manual screen-reader pass, no Lighthouse run, no real-device
   testing.** No WCAG conformance is claimed.
5. **34 px of horizontal overflow at a 195 px layout** (200% zoom on a 390 px
   phone), from a non-wrapping button. Below both the specified 320 px floor
   and WCAG 1.4.10's reflow bar, both of which pass.
6. **All photography is still placeholder** and its rights position is still
   unestablished. Phase 20 made the files smaller; it did not make them the
   clinic's. Two practitioner portraits still carry an AI-generation
   watermark.
7. **Phase 19's migration is still not applied to the live database.** Its
   own section 18 records this. The consequence is visible in the server log
   as `security.audit_write_failed` on every authorization denial — failing
   gracefully, exactly as Phase 19 designed, but the audit trail is not being
   written.
8. **Phase 17's AI provider review is still open** and is still a launch
   blocker. Not this phase's work, recorded so it does not become nobody's.
9. **The four seeded test accounts remain**, with shared credentials including
   an administrator. Delete them before this database holds real patient data.
10. **No E2E tool.** The 484 live checks are scripts written for this phase.

---

### 16. Phase status

```text
Phase 20: COMPLETE
Ready for Phase 21: YES
```

Phase 21 has not been started.

Three things to carry forward:

* **`APP_ENV=production` is now a launch-critical setting**, not just an
  observability label. It belongs at the top of Phase 21's deployment
  checklist, with a verification step that fetches `/robots.txt` from the
  deployed origin and confirms it allows crawling.
* **The production domain is the last SEO input.** Everything is
  environment-aware and reads `NEXT_PUBLIC_SITE_URL`: canonicals, Open Graph
  URLs, the sitemap and the JSON-LD logo. Section 241 asked for exactly this
  readiness, and it is met — but no canonical has ever been served from the
  real domain, so it should be verified once after the first production
  deploy.
* **Measure on a quiet machine, and measure the element rather than the
  document.** This phase produced five wrong readings from a loaded host and
  from instruments that looked reasonable. The deterministic byte measurements
  never lied; the timing ones did, repeatedly, and once pointed at the
  opposite decision.
