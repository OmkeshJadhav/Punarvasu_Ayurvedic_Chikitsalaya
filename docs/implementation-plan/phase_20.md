# Phase 20 — Performance, SEO & Accessibility

## 1. Phase Objective

Optimize Punarvasu for production-quality:

* performance
* Core Web Vitals
* SEO
* accessibility
* responsive behavior
* loading experience
* rendering efficiency
* asset delivery
* crawlability
* semantic HTML
* keyboard and screen-reader usability

Phase 20 should make the existing product **fast, discoverable, usable, and accessible** without introducing major new functionality.

The objective is:

```text
Existing Punarvasu Product
        ↓
Performance Optimization
        ↓
SEO Optimization
        ↓
Accessibility Hardening
        ↓
Responsive QA
        ↓
Production Quality
```

---

# 2. Phase Boundary

Phase 20 consumes all previous functionality.

It focuses on improving:

```text
Phase 02 → Design system
Phase 03 → Public home
Phase 04 → Services
Phase 05 → About / Contact
Phase 06–18 → Application
Phase 19 → Security
```

Do not redesign the product architecture unless a performance/accessibility/SEO issue requires it.

Do not introduce new business features.

---

# 3. Primary Goals

The application should be:

### Fast

Fast initial render and interaction.

### Accessible

Usable by people with different abilities and assistive technologies.

### Search-friendly

Public content should be correctly discoverable by search engines.

### Responsive

Works correctly from small mobile screens to large desktop displays.

### Efficient

Avoid unnecessary JavaScript, requests, images, fonts, and hydration.

### Secure

Optimization must not weaken Phase 19 security.

---

# 4. Performance Philosophy

Do not optimize blindly.

Measure first.

The workflow should be:

```text
Measure
→ Identify bottleneck
→ Optimize
→ Measure again
→ Verify no regression
```

Do not introduce unnecessary complexity merely because a performance technique is fashionable.

---

# 5. Performance Targets

Establish measurable targets.

Aim for strong production performance, including:

```text
LCP ≤ 2.5s
INP ≤ 200ms
CLS ≤ 0.1
```

These should be evaluated using realistic production conditions.

Where exact Core Web Vitals cannot be guaranteed because of infrastructure/network conditions, document measured results and remaining factors.

---

# 6. Additional Performance Targets

Also monitor:

* Time to First Byte
* First Contentful Paint
* JavaScript execution
* hydration cost
* total page weight
* request count
* image weight
* font weight
* API latency

---

# 7. Public Website Performance

Prioritize:

* Home
* Services
* Service detail
* About
* Practitioners
* Contact

These pages are SEO-critical and should load quickly.

---

# 8. Authenticated Application Performance

Optimize:

* patient dashboard
* patient appointments
* patient documents
* doctor dashboard
* doctor consultation
* receptionist workspace
* analytics

Sensitive authenticated pages must remain properly authorized.

Do not sacrifice security for caching.

---

# 9. Server vs Client Components

Review all components.

Use Server Components by default where appropriate.

Use Client Components only when client-side behavior requires them.

Avoid making entire pages client components unnecessarily.

---

# 10. Client JavaScript

Reduce unnecessary client JavaScript.

Avoid:

```text id="e5wx9r"
"use client"
```

at high-level layouts unless required.

Prefer isolating interactivity into small client components.

---

# 11. Hydration

Minimize hydration work.

Avoid hydrating static content such as:

* headings
* paragraphs
* service descriptions
* static footer
* static contact information

unless required.

---

# 12. Zustand

Review Zustand usage.

Do not place:

* server data
* clinical records
* large lists
* documents
* sensitive patient data

into global client state unnecessarily.

Use server data fetching where appropriate.

---

# 13. Framer Motion

Audit Framer Motion usage.

Use it selectively.

Do not animate:

* every card
* every paragraph
* every route transition
* large expensive sections

without a clear UX benefit.

---

# 14. Reduced Motion

Respect:

```text id="0oz0id"
prefers-reduced-motion
```

for all non-essential animation.

---

# 15. Long Tasks

Identify JavaScript tasks that block interaction.

Avoid:

* large client computations
* unnecessary JSON processing
* expensive chart rendering
* unnecessary synchronous transformations

---

# 16. Images

Audit every image.

Use Next.js image optimization where appropriate.

Ensure:

* correct dimensions
* responsive sizing
* modern formats
* lazy loading where appropriate
* priority loading only where justified

---

# 17. Hero Image

The Home hero's primary visual is performance-critical.

Do not lazy-load the primary above-the-fold image if it is required for LCP.

Use appropriate:

```text id="5asj74"
priority
sizes
width
height
```

according to actual layout.

---

# 18. Image Dimensions

Every important image should reserve layout space.

Avoid:

```text id="31exgl"
image loads
→ layout shifts
```

---

# 19. Image Sizing

Do not serve a 3000px image to a 390px mobile screen.

Use responsive image sizes.

---

# 20. Image Format

Prefer efficient formats supported by the deployment architecture.

Use WebP/AVIF where appropriate.

---

# 21. Image Compression

Optimize source assets.

Do not trade away noticeable visual quality unnecessarily.

---

# 22. Lazy Loading

Lazy-load below-the-fold images when appropriate.

Do not lazy-load every image indiscriminately.

---

# 23. Image Accessibility

Every meaningful image needs appropriate alt text.

Decorative images should use appropriate decorative semantics.

---

# 24. Alt Text

Bad:

```text id="7epjcp"
alt="image"
```

Good:

```text id="kwm3fy"
alt="Ayurvedic therapy consultation room at Punarvasu"
```

Only describe what the image actually shows.

Do not invent details.

---

# 25. Decorative Imagery

Decorative background textures should not create unnecessary screen-reader noise.

---

# 26. Fonts

Audit font loading.

Avoid loading large numbers of font weights.

---

# 27. Font Strategy

Use only required:

* font families
* weights
* styles

---

# 28. Font Loading

Prevent invisible text where practical.

Avoid layout shifts caused by late font loading.

---

# 29. Typography

Ensure the design system's typography remains consistent across:

* public pages
* patient portal
* receptionist
* doctor dashboard

---

# 30. Third-Party Fonts

Review external font dependencies.

Prefer privacy-conscious loading and local assets where practical.

---

# 31. CSS

Audit generated CSS size.

Remove:

* unused custom styles
* duplicate rules
* unnecessary animations
* redundant utilities

Do not aggressively optimize Tailwind in ways that make maintenance worse.

---

# 32. Tailwind

Verify Tailwind v4 configuration produces only necessary CSS.

---

# 33. JavaScript Dependencies

Audit bundle size.

Identify large dependencies.

Potential areas:

* charts
* date libraries
* icon libraries
* AI SDKs
* rich text editors
* PDF viewers

---

# 34. Server-Only Dependencies

Ensure server-only libraries do not accidentally enter client bundles.

Examples:

* Supabase admin client
* Gemini SDK
* database libraries
* server-only utilities

---

# 35. Bundle Analysis

Use an appropriate bundle analyzer.

Identify:

* large chunks
* duplicated dependencies
* unexpected client dependencies
* server code accidentally bundled client-side

---

# 36. Dynamic Imports

Use dynamic imports when justified for:

* heavy charts
* large editors
* complex viewers
* rarely used interactive tools

Do not dynamically import everything.

---

# 37. Analytics Bundle

Ensure analytics scripts are:

* minimal
* privacy-conscious
* loaded appropriately
* not blocking critical rendering

---

# 38. Third-Party Scripts

Audit every third-party script.

For each:

```text
What?
Why?
Where?
When loaded?
What data receives?
Performance impact?
```

---

# 39. Remove Unnecessary Third Parties

If a third-party script is not necessary, remove it.

---

# 40. Public Page Rendering

Public informational pages should generally use server rendering/static generation where appropriate.

---

# 41. Static Content

Content such as:

* service descriptions
* about information
* clinic information

should not require unnecessary client-side rendering.

---

# 42. Dynamic Content

Use dynamic rendering only where data actually changes.

---

# 43. Caching

Review caching strategy carefully.

Public pages may be cached where appropriate.

Sensitive authenticated pages must remain protected.

---

# 44. Cache Safety

Never optimize performance by globally caching:

* patient data
* clinical records
* prescriptions
* treatment plans
* documents
* notifications
* doctor-specific data

---

# 45. API Requests

Audit duplicate API requests.

Example:

```text id="5fcvhi"
Dashboard
→ same patient query 4 times
```

should be avoided where practical.

---

# 46. Request Waterfalls

Identify:

```text id="c4x9bi"
Request A
  ↓
Request B
    ↓
Request C
```

where independent requests could execute concurrently.

---

# 47. Parallel Fetching

Where appropriate:

```text id="1w9zj0"
Promise.all(...)
```

or framework-native parallel loading can reduce latency.

Do not parallelize requests that have dependencies.

---

# 48. N+1 Queries

Audit server/database access.

Avoid:

```text id="f99e5g"
fetch 100 appointments
→ query practitioner for each
```

Use efficient joins/queries.

---

# 49. Database Performance

Review indexes used by major queries.

Important areas:

* appointments
* patient profiles
* clinical records
* prescriptions
* treatment plans
* documents
* notifications
* analytics

---

# 50. Query Bounds

Every list should have sensible limits.

Never load unbounded records.

---

# 51. Pagination

Verify pagination for large collections.

At minimum:

* appointment history
* documents
* notifications
* clinical history where applicable
* analytics/export datasets

---

# 52. Search Performance

Search must:

* be bounded
* be indexed appropriately
* avoid full-table scans where possible
* enforce authorization

---

# 53. Analytics Performance

Phase 16 analytics should use database aggregation.

Do not fetch huge datasets into Node.js just to calculate totals.

---

# 54. Analytics Date Ranges

Keep analytics ranges bounded.

Prevent requests for unreasonable/unlimited historical ranges unless explicitly supported.

---

# 55. Dashboard Performance

Patient/receptionist/doctor dashboards should load useful information quickly.

Avoid blocking the entire dashboard on a slow secondary section.

---

# 56. Progressive Loading

Where appropriate:

```text id="4ff8t8"
Primary content
→ secondary content
→ optional content
```

---

# 57. Loading UX

Every asynchronous page should provide meaningful loading states.

Avoid layout jumps between loading and loaded states.

---

# 58. Skeleton Stability

Skeleton dimensions should approximate actual content dimensions.

---

# 59. Error UX

Errors must remain:

* clear
* safe
* actionable

Do not expose implementation details.

---

# 60. SEO Objective

Optimize the public website for search engines while preserving privacy.

SEO applies primarily to:

```text id="e9k8e8"
/ 
/services
/services/[slug]
/about
/practitioners
/practitioners/[slug]
/contact
```

---

# 61. Authenticated SEO

Authenticated pages should not be indexed.

Examples:

```text id="9odm2q"
/patient/*
/doctor/*
/receptionist/*
/admin/*
```

Use appropriate `noindex` handling.

---

# 62. Metadata

Every public page should have appropriate:

* title
* description
* canonical URL
* Open Graph
* Twitter/X metadata where appropriate

---

# 63. Unique Titles

Do not use:

```text id="1qz8gt"
Punarvasu
```

for every page.

Use meaningful titles.

Example:

```text id="akz66s"
Ayurvedic Treatments & Services | Punarvasu
```

---

# 64. Meta Descriptions

Descriptions should be:

* accurate
* human-readable
* useful
* not keyword-stuffed

---

# 65. Canonical URLs

Define canonical URLs for public pages.

Prevent duplicate URL variants where practical.

---

# 66. Dynamic Service Metadata

Service detail pages should generate metadata from the actual service content.

Do not generate metadata from arbitrary user input without validation.

---

# 67. Practitioner Metadata

Only include verified practitioner information.

Never fabricate qualifications.

---

# 68. Open Graph Images

Provide appropriate OG imagery.

Optimize image size.

Do not include patient/private information.

---

# 69. Structured Data

Use structured data only where factual.

Potential schemas:

```text id="c4r6yn"
Organization
LocalBusiness
MedicalClinic
Physician
Service
BreadcrumbList
FAQPage
```

Use only schema types appropriate to the actual content and Google's current guidance.

---

# 70. Medical Structured Data

Do not use structured data to make unsupported medical claims.

---

# 71. Practitioner Structured Data

Only publish:

* real names
* verified qualifications
* verified specialties

---

# 72. Service Structured Data

Only use:

* actual service names
* actual descriptions
* actual clinic information

Do not invent:

* price
* rating
* review count
* availability

---

# 73. FAQ Structured Data

Only mark FAQs that are actually visible and factual.

---

# 74. Breadcrumbs

Use breadcrumbs where they improve navigation and SEO.

Especially:

```text id="k4l0ca"
Services
→ Treatment
```

---

# 75. Sitemap

Implement/update:

```text id="h4y1xj"
/sitemap.xml
```

Include only public indexable URLs.

---

# 76. Sitemap Exclusions

Do not include:

```text id="t5zql0"
/patient/*
/doctor/*
/receptionist/*
/admin/*
/auth/*
```

or other private routes.

---

# 77. Robots

Implement/update:

```text id="4tq8m8"
/robots.txt
```

Prevent crawling of private application areas.

---

# 78. Robots Is Not Security

Remember:

```text id="j4qz6v"
robots.txt
≠
authorization
```

Private routes must remain protected server-side.

---

# 79. Indexing Control

Verify:

* private routes noindex
* public pages indexable
* no accidental `noindex` on public pages

---

# 80. Search Preview

Manually inspect major public pages in search/social preview tools where available.

---

# 81. URL Quality

Use clean URLs:

```text id="4a0y7m"
/services/shirodhara
```

Avoid:

```text id="m7xq9k"
/services?id=123&type=7
```

where a semantic slug is appropriate.

---

# 82. Slugs

Validate service/practitioner slugs.

Avoid duplicate/conflicting slugs.

---

# 83. 404 Handling

Unknown public routes should return a polished 404.

The 404 page should:

* explain
* offer navigation
* maintain Punarvasu branding

---

# 84. Redirects

Audit redirects.

Avoid redirect chains.

Avoid open redirects.

---

# 85. Trailing Slash

Use a consistent URL strategy.

---

# 86. Localization Readiness

Do not implement full localization unless required.

However, avoid hardcoding assumptions into architecture that make future localization unnecessarily difficult.

---

# 87. Indian Address / Locale

Public clinic information should use correct formatting and actual verified data.

Do not invent address details.

---

# 88. Date / Time

Authenticated appointment information should use the clinic's configured timezone and appropriate localized formatting.

---

# 89. Accessibility Objective

Target WCAG 2.2 AA principles where practical.

Accessibility is not a final checkbox; it should be verified across the application.

---

# 90. Semantic HTML

Use:

```text id="wyqbsp"
header
nav
main
section
article
aside
footer
button
a
form
label
```

appropriately.

---

# 91. Buttons vs Links

Bad:

```html id="qv0my5"
<div onClick={...}>Book</div>
```

Good:

```html id="0c2i4h"
<button>Book a Consultation</button>
```

or:

```html id="7a3b2c"
<a href="/contact">Contact</a>
```

depending on behavior.

---

# 92. Heading Hierarchy

Maintain logical heading order:

```text id="6rye2s"
h1
 ├─ h2
 │   └─ h3
 └─ h2
```

Avoid headings chosen only for visual size.

---

# 93. One Primary H1

Public pages should generally have one clear primary H1.

---

# 94. Accessible Navigation

Navigation must be:

* keyboard accessible
* correctly labeled
* focusable
* understandable

---

# 95. Mobile Menu

Verify:

* focus enters menu appropriately
* Escape closes menu
* focus does not get lost
* screen readers understand open/closed state

---

# 96. Dialogs

Dialogs must:

* trap focus appropriately
* have accessible name
* close correctly
* return focus appropriately

---

# 97. Drawers

Mobile drawers/bottom sheets must follow appropriate focus/accessibility behavior.

---

# 98. Forms

Every input must have a meaningful label.

Avoid placeholder-only labels.

---

# 99. Form Errors

Errors should:

* identify the field
* be programmatically associated
* be understandable
* preserve user input where appropriate

---

# 100. Required Fields

Required fields must be communicated accessibly.

---

# 101. Autocomplete

Use appropriate autocomplete attributes for:

* name
* email
* phone
* address
* postal code

---

# 102. Input Types

Use appropriate types:

```text id="44t6aa"
email
tel
date
password
```

---

# 103. Focus States

Every interactive control needs a visible focus indicator.

Do not remove outlines without a replacement.

---

# 104. Keyboard Navigation

Everything interactive must be usable without a mouse.

Test:

```text id="1t2k7c"
Tab
Shift+Tab
Enter
Space
Arrow keys
Escape
```

where applicable.

---

# 105. Keyboard Traps

Ensure no modal/menu creates an unintended keyboard trap.

---

# 106. Color Contrast

Verify WCAG-compliant contrast for:

* body text
* buttons
* links
* labels
* placeholders where required
* status indicators

---

# 107. Color Independence

Never communicate meaning using color alone.

Bad:

```text id="0p7wzv"
red = cancelled
```

without text/icon/accessible label.

---

# 108. Status Badges

Use both visual and textual semantics.

Example:

```text id="4k0t5w"
● Confirmed
```

with accessible text.

---

# 109. Images

Verify meaningful images have appropriate alt text.

---

# 110. Decorative Icons

Decorative icons should not be announced unnecessarily.

---

# 111. Icon Buttons

Every icon-only button needs an accessible label.

Bad:

```text id="m8u3x4"
<button><SearchIcon /></button>
```

Good:

```text id="5wz7kq"
<button aria-label="Search patients">
```

---

# 112. Tooltips

Do not use tooltips as the only way to understand a critical action.

---

# 113. Tables

Tables must have:

* meaningful headers
* correct scope where appropriate
* responsive strategy
* accessible labels

---

# 114. Mobile Tables

Do not simply shrink dense tables until unreadable.

Use:

* horizontal scrolling
* responsive cards
* simplified layouts

where appropriate.

---

# 115. Charts

Analytics charts must have accessible alternatives.

Provide:

```text id="x7q4m8"
chart
+
summary/table
```

where appropriate.

---

# 116. Chart Color

Do not rely solely on color to distinguish series.

---

# 117. Screen Reader Testing

Test major workflows with at least one screen reader where practical.

Examples:

* VoiceOver
* NVDA
* TalkBack

Use the development environment available.

---

# 118. ARIA

Use native HTML first.

Add ARIA only where needed.

Do not add excessive ARIA.

---

# 119. Live Regions

Use accessible announcements for:

* form submission result
* async completion
* important notification updates
* validation errors

where appropriate.

---

# 120. Motion Accessibility

Verify:

```text id="j9y3u8"
prefers-reduced-motion
```

disables/reduces non-essential movement.

---

# 121. Touch Targets

Interactive controls should have comfortable touch targets.

Avoid tiny icon buttons.

---

# 122. Mobile Zoom

Do not prevent browser zoom.

Avoid:

```text id="q8m4x7"
user-scalable=no
```

---

# 123. Text Scaling

Ensure layouts remain usable when text is enlarged.

---

# 124. Responsive Layout

Test:

```text id="x4m8q2"
320
375
390
430
768
1024
1280
1440
1920+
```

---

# 125. Landscape

Check mobile landscape where practical.

---

# 126. Large Screens

Avoid overly stretched content.

Use appropriate max-width containers.

---

# 127. Small Screens

Ensure:

* no horizontal overflow
* no clipped text
* no inaccessible buttons
* no broken dialogs

---

# 128. Accessibility of Authentication

Test:

* login
* registration
* verification
* forgot password
* reset password

with keyboard and screen reader.

---

# 129. Accessibility of Patient Portal

Test:

* dashboard
* appointments
* prescriptions
* treatment plans
* documents
* notifications
* profile

---

# 130. Accessibility of Receptionist

Test:

* patient search
* appointment operations
* schedule

---

# 131. Accessibility of Doctor Workspace

Test:

* dashboard
* appointment context
* clinical consultation
* prescription builder
* treatment plan
* AI support

---

# 132. Accessibility of Public Website

Test:

* Home
* Services
* service details
* About
* Practitioners
* Contact

---

# 133. Accessibility of AI

Phase 17 AI interface must support:

* keyboard
* screen readers
* loading announcements
* error announcements
* result navigation
* reduced motion

---

# 134. Performance of AI

AI provider calls should not block the entire application.

Lazy-load heavy AI UI if appropriate.

---

# 135. PDF / Document Viewer

If a PDF/document viewer exists, assess bundle size.

Consider dynamic loading if appropriate.

Do not weaken document authorization for performance.

---

# 136. Analytics Charts

Heavy chart libraries should not unnecessarily load on every application page.

Use route/component-level loading where justified.

---

# 137. Date Libraries

Review date/time dependencies.

Avoid shipping large libraries to the browser unnecessarily.

---

# 138. Icon Libraries

Avoid importing entire icon packages when only a small subset is needed.

Use the existing project conventions.

---

# 139. Supabase Client Bundle

Ensure server-only Supabase functionality is not included in client bundles.

---

# 140. Gemini Bundle

Ensure Gemini SDK/provider code never enters the client bundle.

---

# 141. Environment Variables

Verify only intended `NEXT_PUBLIC_*` variables reach client bundles.

---

# 142. Performance Security Boundary

Do not:

```text id="g4m8x2"
make clinical API public
```

just to improve performance.

---

# 143. Caching Security Boundary

Do not:

```text id="x7q3m8"
globally cache authenticated patient pages
```

for performance.

---

# 144. SEO Security Boundary

Do not expose sensitive content merely to improve indexing.

---

# 145. Accessibility Security Boundary

Do not hide security-critical content using inaccessible visual tricks.

---

# 146. Lighthouse

Run Lighthouse or equivalent audits for key public pages.

Test:

* Performance
* Accessibility
* Best Practices
* SEO

---

# 147. Lighthouse Caveat

Do not optimize solely for a Lighthouse score.

A high synthetic score does not guarantee real-world performance.

---

# 148. Real Device Testing

Where possible, test on:

* low/mid-range Android
* modern desktop
* mobile browser
* tablet

---

# 149. Network Testing

Test under realistic conditions:

```text id="3wmx04"
Fast 4G
Slow 4G
3G / throttled
High latency
```

---

# 150. CPU Testing

Test with CPU throttling where practical.

---

# 151. Core Web Vitals

Measure public pages under realistic conditions.

Document:

```text id="1a6ezn"
LCP
INP
CLS
```

---

# 152. LCP Optimization

Identify actual LCP element.

Common causes:

* hero image
* font
* server latency
* render-blocking CSS
* client rendering

Optimize the actual bottleneck.

---

# 153. CLS Optimization

Audit layout shifts from:

* images
* fonts
* banners
* dynamic content
* navigation
* async widgets

---

# 154. INP Optimization

Audit slow interactions:

* menus
* dialogs
* forms
* filters
* charts
* dashboard interactions

---

# 155. TTFB

If TTFB is poor:

* inspect server latency
* database queries
* external API calls
* deployment region
* rendering strategy

Do not solve TTFB problems by making sensitive pages public/static.

---

# 156. Public Content Caching

Where safe, cache static/public content.

---

# 157. ISR / Revalidation

Use framework revalidation where appropriate for public content that changes occasionally.

---

# 158. Dynamic Service Content

If services are configuration/content-driven, establish appropriate revalidation rather than forcing every request to be fully dynamic.

---

# 159. Authenticated Content

Do not statically generate user-specific pages.

---

# 160. Database Query Optimization

Use appropriate indexes.

Inspect expensive queries using the database tooling available.

---

# 161. Analytics Query Optimization

Review large-range analytics queries.

Use:

* indexes
* aggregation
* materialized views where justified

Do not introduce materialized views merely for theoretical optimization.

---

# 162. Appointment Query Optimization

Ensure schedule queries use appropriate indexes for:

* practitioner
* date range
* status

---

# 163. Notification Query Optimization

Use indexes for:

* recipient
* read/unread
* created_at

---

# 164. Document Query Optimization

Use indexes for:

* patient
* created_at
* document type

where appropriate.

---

# 165. Clinical Query Optimization

Use appropriate patient/practitioner/appointment indexes.

Do not optimize by weakening authorization filters.

---

# 166. Pagination Strategy

Use consistent pagination patterns.

Avoid loading thousands of rows and slicing in JavaScript.

---

# 167. Infinite Scroll

Use only where it improves UX.

Do not use infinite scroll for every list.

---

# 168. Prefetching

Use framework/client prefetching where beneficial.

Do not prefetch sensitive data unnecessarily.

---

# 169. Link Prefetching

Review navigation prefetch behavior for authenticated routes.

Do not cause unnecessary sensitive requests.

---

# 170. API Payload Size

Reduce unnecessary fields.

Example:

```text id="w6c0x5"
Dashboard
→ only next appointment
```

not:

```text id="2v6s4b"
Dashboard
→ all historical appointments + clinical records
```

---

# 171. Server Serialization

Avoid serializing large objects into client components.

---

# 172. Sensitive Data Serialization

Do not send:

* internal clinical notes
* AI prompts
* service credentials
* storage paths
* unrelated patient records

to the browser just because a component might need them.

---

# 173. SEO Content Quality

Review public pages for:

* duplicate content
* thin content
* missing descriptions
* inaccurate content
* fabricated claims
* keyword stuffing

---

# 174. Medical SEO Safety

Do not optimize by making unsupported medical claims.

Avoid:

```text id="n1l5m7"
Best treatment for X
Guaranteed cure
100% effective
```

unless factually supported, and generally avoid such claims.

---

# 175. Service Content

Ensure service pages are:

* educational
* accurate
* readable
* useful

---

# 176. Internal Linking

Add meaningful internal links:

```text id="e4x8m2"
Home
→ Services
→ Service detail
→ About
→ Contact
```

Do not create artificial keyword links.

---

# 177. Breadcrumb SEO

Use breadcrumbs where appropriate.

---

# 178. Canonicalization

Check:

* duplicate slugs
* query parameter variants
* trailing slash behavior
* host variants
* HTTP/HTTPS redirects

---

# 179. Domain Canonical

Use the production domain once known.

Do not hardcode temporary Vercel/preview URLs into canonical metadata.

---

# 180. Environment-Aware SEO

Development/staging environments should not accidentally compete with production in search engines.

Use appropriate indexing controls.

---

# 181. Sitemap Environment

Production sitemap must contain production URLs.

---

# 182. Robots Environment

Ensure preview/staging environments do not accidentally become publicly indexed.

---

# 183. Social Preview

Verify:

* OG image
* title
* description
* URL

for major public pages.

---

# 184. Favicon / Manifest

Verify:

* favicon
* app icons
* manifest if implemented

---

# 185. PWA

Do not turn Punarvasu into a PWA unless already required.

Do not introduce service workers solely for performance.

---

# 186. Service Workers

If one exists, audit caching carefully because service workers can create severe stale-data/privacy problems.

---

# 187. Browser Cache

Verify sensitive data isn't incorrectly persisted through browser caching.

Coordinate with Phase 19.

---

# 188. Accessibility Testing Tools

Use automated tooling such as:

* axe
* Lighthouse
* eslint accessibility tooling

where compatible.

Automated tools are not sufficient by themselves.

---

# 189. Automated Accessibility Tests

Add tests for:

* labels
* button names
* headings
* landmarks
* common ARIA violations

---

# 190. Manual Accessibility Testing

Manually test critical workflows.

---

# 191. Regression Testing

Performance/SEO/accessibility changes must not break:

* auth
* appointments
* clinical records
* prescriptions
* documents
* notifications
* AI
* authorization

---

# 192. Security Regression

Do not change:

* caching
* rendering
* server/client boundaries
* route behavior

in ways that weaken Phase 19 security.

---

# 193. Error Pages

Optimize and polish:

* 404
* 500/error
* loading

pages.

---

# 194. Loading Page SEO

Loading UI should not contain misleading SEO content.

---

# 195. Public 404 SEO

404 responses should correctly communicate not found status.

---

# 196. Redirect Status

Use correct redirect semantics.

Avoid redirect loops.

---

# 197. Accessibility of Error Pages

Error pages must still be navigable and understandable.

---

# 198. Accessibility of Loading States

Where dynamic status is important, expose appropriate semantic loading information.

---

# 199. Accessibility of Empty States

Empty states must explain:

* what is empty
* why it may be empty
* what action can be taken

where appropriate.

---

# 200. Color Theme

Ensure design-system colors remain accessible after optimization.

---

# 201. Dark Mode

If dark mode exists, test contrast and component states in both themes.

If dark mode is not part of the product, do not introduce it solely during this phase.

---

# 202. Focus Restoration

Test navigation and dialogs for correct focus restoration.

---

# 203. Route Transitions

If route transitions exist, verify they do not delay content unnecessarily.

---

# 204. Motion Performance

Avoid expensive animations involving large layout recalculations.

Prefer transform/opacity-based animation where appropriate.

---

# 205. Scroll Performance

Avoid unnecessary scroll listeners and expensive scroll-linked effects.

---

# 206. Sticky Elements

Verify sticky navigation does not:

* block content
* create accessibility issues
* cause layout shifts

---

# 207. Mobile Viewport

Verify correct mobile viewport configuration.

---

# 208. Horizontal Overflow

Search for accidental horizontal scrolling.

---

# 209. Touch Interaction

Verify:

* buttons
* menus
* calendars
* dialogs
* forms

work reliably on touch devices.

---

# 210. Date Picker Accessibility

Appointment date/time controls must be keyboard and screen-reader usable.

---

# 211. Calendar Performance

Do not render excessive calendar data unnecessarily.

---

# 212. Doctor Dashboard

Optimize dashboard queries and rendering without exposing additional clinical information.

---

# 213. Receptionist Workspace

Optimize patient search and today's schedule.

Search remains server-side and authorized.

---

# 214. Patient Dashboard

Prioritize:

```text id="z2w1cd"
next appointment
important action
recent notification
```

for fast first useful render.

---

# 215. Clinical Consultation

Do not block clinical record editing on:

* analytics
* AI
* secondary requests

---

# 216. AI Loading

AI requests should be isolated from the primary clinical workflow.

---

# 217. Document Viewer

Heavy document previews should not load until needed.

Authorization must happen before access.

---

# 218. Notifications

Load only the number of notifications required initially.

Use pagination/incremental loading.

---

# 219. Analytics

Charts can be deferred below primary summary metrics.

---

# 220. SEO / Accessibility of Public Images

Verify image alt text and metadata.

---

# 221. SEO Content Duplication

Avoid repeating identical paragraphs across every service page.

---

# 222. Metadata Validation

Create tests/utilities where practical to verify every public route has:

* title
* description
* canonical

---

# 223. Sitemap Validation

Verify every sitemap URL:

* is public
* returns 200
* is indexable
* is canonical

---

# 224. Robots Validation

Verify private routes remain excluded.

---

# 225. Structured Data Validation

Validate JSON-LD syntax and factual consistency.

---

# 226. SEO Link Validation

Check internal links for:

* 404s
* incorrect routes
* redirect chains

---

# 227. Broken Link Audit

Run a public-site link check.

---

# 228. Image Audit

Find:

* missing alt
* oversized files
* missing dimensions
* broken paths
* unnecessary duplicates

---

# 229. Accessibility Audit

Find:

* missing labels
* missing button names
* contrast issues
* heading hierarchy issues
* keyboard traps
* inaccessible dialogs
* invalid ARIA

---

# 230. Performance Audit

Find:

* large bundles
* slow requests
* waterfalls
* oversized images
* excessive client components
* expensive third-party scripts

---

# 231. Production Build

Run:

```text id="8r5i6q"
npm run build
```

or the project's equivalent.

Inspect build output.

---

# 232. Bundle Regression

Compare before/after bundle size where tooling permits.

Document major changes.

---

# 233. Lighthouse Baseline

Capture baseline scores before optimization.

---

# 234. Lighthouse Final

Capture final scores.

Do not optimize only for score; document actual bottlenecks and improvements.

---

# 235. Core Web Vitals Baseline

Record baseline:

```text id="c8x1hm"
LCP
INP
CLS
```

---

# 236. Core Web Vitals Final

Record final results and remaining known limitations.

---

# 237. Accessibility Baseline

Record major accessibility findings before changes.

---

# 238. Accessibility Final

Document resolved and remaining issues.

---

# 239. SEO Baseline

Record:

* metadata coverage
* sitemap
* robots
* structured data
* broken links

---

# 240. SEO Final

Verify production configuration.

---

# 241. Production Domain

If the final domain is not yet configured, ensure all SEO architecture is environment-aware and ready to receive the production domain in Phase 21.

---

# 242. Security Compatibility

Re-run relevant Phase 19 tests after performance/caching/rendering changes.

---

# 243. Acceptance Criteria

Phase 20 is complete only when:

## Performance

* [ ] Public pages have been measured.
* [ ] Core Web Vitals have been evaluated.
* [ ] LCP has been optimized.
* [ ] INP has been optimized.
* [ ] CLS has been optimized.
* [ ] Image delivery is optimized.
* [ ] Fonts are optimized.
* [ ] Client JavaScript is minimized.
* [ ] Large dependencies are reviewed.
* [ ] Server/client boundaries are reviewed.
* [ ] Major request waterfalls are addressed.
* [ ] N+1 queries are addressed.
* [ ] Large lists are paginated.
* [ ] Analytics queries are bounded.
* [ ] Authenticated data is not globally cached.

## SEO

* [ ] Public pages have unique titles.
* [ ] Public pages have useful descriptions.
* [ ] Canonical URLs exist.
* [ ] Open Graph metadata exists where appropriate.
* [ ] Sitemap exists and contains only public indexable pages.
* [ ] Robots configuration exists.
* [ ] Private routes are not indexable.
* [ ] Structured data is valid and factual.
* [ ] Internal links are healthy.
* [ ] No important public pages return unintended 404s.
* [ ] No staging/preview environment competes with production indexing.

## Accessibility

* [ ] Semantic HTML is used.
* [ ] Heading hierarchy is correct.
* [ ] Keyboard navigation works.
* [ ] Focus states are visible.
* [ ] Dialogs are accessible.
* [ ] Forms are accessible.
* [ ] Form errors are associated with fields.
* [ ] Icon-only buttons have accessible names.
* [ ] Contrast is acceptable.
* [ ] Color is not the sole communication mechanism.
* [ ] Images have appropriate alt behavior.
* [ ] Tables are accessible.
* [ ] Charts have accessible alternatives.
* [ ] Reduced motion is respected.
* [ ] Touch targets are usable.
* [ ] Browser zoom remains functional.

## Responsive

* [ ] 320px works.
* [ ] 375px works.
* [ ] 390px works.
* [ ] 430px works.
* [ ] 768px works.
* [ ] 1024px works.
* [ ] 1280px works.
* [ ] 1440px works.
* [ ] 1920px+ works.
* [ ] No unintended horizontal overflow.
* [ ] Mobile navigation works.
* [ ] Forms work on mobile.
* [ ] Tables/lists remain usable.

## Privacy/Security

* [ ] Performance changes did not weaken authorization.
* [ ] Sensitive pages are not globally cached.
* [ ] Private routes are not indexed.
* [ ] Clinical data is not serialized unnecessarily.
* [ ] Server-only dependencies remain server-only.
* [ ] AI credentials remain server-only.
* [ ] Service-role credentials remain server-only.
* [ ] Signed document URLs remain authorization-gated.

## Engineering

* [ ] Typecheck passes.
* [ ] Lint passes.
* [ ] Tests pass.
* [ ] Accessibility tests pass.
* [ ] Production build passes.
* [ ] Bundle analysis reviewed.
* [ ] Dependency audit remains acceptable.
* [ ] Phase 19 security regression tests pass.

---

# 244. Mandatory Performance Verification

Measure at least:

```text id="q6z4ob"
Home
Services
Service Detail
About
Practitioners
Contact
Patient Dashboard
Doctor Dashboard
Receptionist Dashboard
```

For public pages, record:

```text id="6y9jvw"
LCP
INP
CLS
TTFB
```

where tooling supports them.

---

# 245. Mandatory SEO Verification

Verify:

```text id="f8h3ru"
/
 /services
 /services/[slug]
 /about
 /practitioners
 /practitioners/[slug]
 /contact
```

have correct:

* title
* description
* canonical
* indexability
* structured data where appropriate

---

# 246. Mandatory Accessibility Verification

Test the critical workflow:

```text id="j2z1pt"
Home
→ Services
→ Service Detail
→ Contact
```

and:

```text id="v4n0rp"
Login
→ Patient Dashboard
→ Appointment
→ Prescription
→ Documents
→ Profile
```

using keyboard-only navigation.

---

# 247. Mandatory Security Regression

After caching/rendering optimizations, verify:

```text id="z7x4m8"
Patient A → Patient B = DENIED
```

for:

* appointment
* prescription
* treatment plan
* document
* notification
* profile

Also verify:

```text id="b4q8x3"
Patient → staff routes = DENIED
```

---

# 248. Bad → Good Examples

## Client Rendering

### Bad

```text id="m8x4q7"
Entire Home page
→ "use client"
→ everything hydrated
```

### Good

```text id="q7m3x8"
Server-rendered page
→ small interactive client components
```

---

## Images

### Bad

```text id="x8m4q2"
5MB hero JPEG
```

### Good

```text id="m7x3q8"
Optimized responsive image
→ correct dimensions
→ appropriate priority
→ modern format
```

---

## Dashboard

### Bad

```text id="q4m8x2"
Patient dashboard
→ fetch all appointments
→ fetch all documents
→ fetch all prescriptions
→ fetch all notifications
→ send everything to browser
```

### Good

```text id="x7m3q8"
Dashboard
→ next appointment
→ important actions
→ small notification summary
→ targeted care summary
```

---

## SEO

### Bad

```text id="m8x4q2"
Every page:
<title>Punarvasu</title>
```

### Good

```text id="q7m3x8"
Service page:
<title>Shirodhara | Ayurvedic Treatment | Punarvasu</title>
```

---

## Accessibility

### Bad

```html id="x3m8q7"
<div onClick={book}>Book</div>
```

### Good

```html id="m7x4q2"
<button onClick={book}>Book a Consultation</button>
```

---

## Icon Button

### Bad

```text id="q8m3x7"
icon only
```

### Good

```text id="x7m4q8"
icon
+
accessible label
```

---

## Contrast

### Bad

```text id="m8x3q7"
Very light text on cream background.
```

### Good

```text id="q7m4x2"
Readable contrast while preserving the Punarvasu visual palette.
```

---

## SEO Privacy

### Bad

```text id="x8m4q7"
Patient-specific page
→ indexed by Google
```

### Good

```text id="m7x3q8"
Patient page
→ authenticated
→ noindex
→ protected
```

---

## Performance Security

### Bad

```text id="q4m8x2"
Make patient API public
→ faster caching
```

### Good

```text id="x7m3q8"
Keep authorization
→ optimize query
→ optimize payload
→ safely cache only where appropriate
```

---

## Accessibility

### Bad

```text id="m8x4q7"
Red badge
```

### Good

```text id="q7m3x8"
Cancelled
```

with color as supporting visual information.

---

# 249. Expected Architectural Areas

Adapt to the existing repository.

Potential:

```text id="x8m3q7"
src/
  app/
    sitemap.ts
    robots.ts
    layout.tsx
    ...
  components/
  lib/
  config/
```

Potential supporting files:

```text id="q7m4x2"
lighthouse configuration
bundle analyzer configuration
accessibility test utilities
SEO utilities
metadata helpers
```

Do not add tools solely for appearance.

---

# 250. SEO Utility

If repeated metadata patterns exist, centralize them.

Potential:

```ts id="m8x3q7"
createPageMetadata()
```

Use actual architecture conventions.

---

# 251. Structured Data Utility

If JSON-LD is used repeatedly, centralize safe generation.

Validate generated data.

---

# 252. Sitemap Utility

Generate sitemap from actual public routes/data.

Do not include private resources.

---

# 253. Robots Utility

Generate environment-aware robots behavior.

---

# 254. Accessibility Testing Infrastructure

Use the existing testing framework.

Add automated accessibility tests where practical.

---

# 255. Performance Testing Infrastructure

Document repeatable performance testing methodology.

---

# 256. SEO Testing Infrastructure

Add route/metadata tests where useful.

---

# 257. No False Performance Claims

Do not report:

```text id="x7m3q8"
100/100 performance
```

unless actually measured.

Even then, a score is not a guarantee of real-world performance.

---

# 258. No False Accessibility Claims

Do not claim full WCAG compliance solely from automated tests.

---

# 259. No False SEO Claims

Do not claim guaranteed Google ranking.

---

# 260. Production Readiness

The output of Phase 20 should be:

```text id="m8x4q2"
Fast
Accessible
Search-friendly
Responsive
Measured
Documented
```

and ready for final deployment preparation in Phase 21.

---

# 261. Explicitly Out of Scope

Do NOT implement:

* new product features
* new clinical workflows
* new AI features
* patient-facing AI
* new appointment functionality
* new prescription functionality
* new treatment-plan functionality
* payments
* telemedicine
* CRM
* new analytics features
* major redesign
* full internationalization
* PWA unless already required
* offline clinical data storage
* speculative microservices
* unrelated refactoring

Performance/SEO/accessibility fixes to existing features are in scope.

---

# 262. Definition of Done

Phase 20 is complete when:

```text id="q7m3x8"
Punarvasu
→ has measured performance
→ has optimized critical bottlenecks
→ has strong Core Web Vitals targets/results
→ has complete public SEO foundations
→ protects private routes from indexing
→ passes critical accessibility checks
→ works responsively
→ preserves Phase 19 security
```

and the application is ready to enter:

```text id="x8m4q2"
Phase 21 — Production Launch
```

---

# 263. Final Verification

Run:

```text id="m7x3q8"
lint
typecheck
unit tests
integration tests
accessibility tests
security regression tests
production build
bundle analysis
dependency audit
```

Run performance/SEO checks:

```text id="q8m4x2"
Lighthouse
Core Web Vitals evaluation
sitemap validation
robots validation
structured-data validation
broken-link check
image audit
```

Manually test:

```text id="x7m3q8"
mobile
tablet
desktop
keyboard-only
screen reader where practical
slow network
slow CPU
```

---

# 264. Completion Report

At completion, report:

## Performance

```text id="m8x4q2"
Baseline:
Final:
LCP:
INP:
CLS:
TTFB:
Bundle changes:
Largest bottlenecks fixed:
Remaining bottlenecks:
```

## Images / Fonts

```text id="q7m3x8"
Image optimization:
Hero optimization:
Font strategy:
Largest assets:
```

## Rendering

```text id="x8m4q2"
Server/client boundary:
Client component reductions:
Dynamic imports:
Caching:
```

## Database/API

```text id="m7x3q8"
N+1 issues:
Indexes:
Query optimizations:
Pagination:
Request waterfalls:
```

## SEO

```text id="q4m8x2"
Metadata:
Canonical:
Sitemap:
Robots:
Structured data:
Open Graph:
Internal links:
Broken links:
```

## Accessibility

```text id="x7m3q8"
Keyboard:
Screen reader:
Forms:
Dialogs:
Navigation:
Contrast:
Focus:
Motion:
Charts/tables:
```

## Responsive

```text id="m8x4q2"
320:
375:
390:
430:
768:
1024:
1280:
1440:
1920+:
```

## Security Regression

```text id="q7m3x8"
RLS:
IDOR:
Patient isolation:
Private caching:
Noindex:
Client bundle secrets:
```

## Verification

```text id="x8m4q2"
Lint:
Typecheck:
Tests:
Accessibility:
Security:
Build:
Lighthouse:
Bundle analysis:
Dependency audit:
```

## Remaining Risks

List remaining:

```text
Critical
High
Medium
Low
```

performance/accessibility/SEO/security issues.

## Deferred

List intentionally deferred work.

## Phase Status

```text id="m7x3q8"
Phase 20: COMPLETE
Ready for Phase 21: YES/NO
```

Do not begin Phase 21 during this phase.
