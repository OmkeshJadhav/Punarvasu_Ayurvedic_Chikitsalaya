## PHASE 18 — Advanced Patient Experience

Status:
COMPLETED — driven through a real browser against the production build and the
live Supabase project

Completed On:
2026-09-22

Summary:
Turned the patient area from a collection of individual features into one
coherent experience: a real dashboard at `/patient` that leads with the next
appointment and answers "what needs your attention?", a purpose-built bounded
query behind each panel, per-area loading and error boundaries, and the
navigation and copy corrections the earlier phases left behind.

**No domain system was rebuilt.** Phase 18 added no table, no migration, no
RLS policy, no permission and no dependency. Every appointment rule is Phase
09's, every prescription and plan is Phase 13's, every document is Phase 14's,
every notification is Phase 15's, the profile is Phase 07's and the
authorization is Phase 08's. What this phase wrote is the composition, and two
small queries that ask the database the question the page actually asks.

**Three real defects were found, and two of them were pre-existing.** One was
the dashboard reading a patient's entire appointment history to display a
single row. Two were found only by the browser pass — a broken heading outline
in Phase 15's notification centre, and a header that clipped its own
navigation and squeezed the notification bell to half its touch target on
every phone since Phase 08.

4,208 tests pass, up from 4,079. **53 live browser checks** against the
production build cover the patient journey, axe with real computed contrast at
390px and 1280px, horizontal overflow at nine widths, cross-patient IDOR on
four resource types, role isolation in both directions, and what does and does
not reach the page, the URL and browser storage.

---

### Repository assessment before starting

Phases 06–17 left the whole product. Reused rather than rebuilt:
`requireUser`, `requireAreaAccess`, `requirePermission`, `assertPermission`,
`config/permissions.ts`, `getPatientProfile`, `evaluateCompleteness`,
`getAppointment`, `groupAppointments`, `listPatientPrescriptions`,
`listPatientTreatmentPlans`, `listPatientDocuments`, `listNotifications`,
`getUnreadNotificationCount`, `AppointmentStatusBadge`, `NotificationItem`,
`Card`, `Button`, `EmptyState`, `ErrorState`, `SectionLoading`, `Skeleton`,
`NavLink`, `Container`, `Section` and the Phase 09 clinic-timezone formatters.

Five findings shaped the work:

* **The patient area was already six routes deep and its front door was a
  Phase 07 stub.** `/patient` showed a completeness bar, one appointment card
  and a paragraph saying Punarvasu "does not send reminders or notifications
  yet" — untrue since Phase 15, and the third phase running in which a stale
  placeholder outlived the thing it stood in for (Phases 12, 13 and 14 each
  recorded the same class of defect).
* **`getMyAppointments()` is unbounded**, and the dashboard called it to pick
  one row. See *The performance defect*.
* **Every permission a patient needs already existed.** Phases 07–15 declared
  each one alongside the surface it guards, so Phase 18 needed none — which is
  the clearest sign the rule those phases followed was the right one.
* **`/notifications` is a shared route outside `/patient`**, deliberately
  (Phase 15). That decided the navigation question; see *Navigation*.
* **`PatientDocument.storagePath` is on the domain type**, carrying a comment
  claiming no page passes it to a client component. Claims like that are worth
  a test rather than a comment; there is now one.

---

### 1. Files created and modified

#### Created

```text
src/features/patients/attention.ts          what genuinely needs attention
src/features/patients/attention.test.ts

src/components/patient/dashboard-panel.tsx  one section, one shape
src/components/patient/next-visit-card.tsx
src/components/patient/attention-panel.tsx
src/components/patient/care-summary.tsx
src/components/patient/recent-updates.tsx

src/app/(app)/patient/loading.tsx
src/app/(app)/patient/error.tsx

tests/components/patient-dashboard.test.tsx
tests/integration/patient-experience.test.ts
tests/integration/patient-dashboard-queries.test.ts
docs/progress/progress_phase_18.md
```

#### Modified

```text
src/app/(app)/patient/page.tsx           the dashboard, rewritten
src/app/(app)/layout.tsx                 the header's two-row fix
src/components/layout/app-nav.tsx        accepts placement from its caller
src/components/notifications/notification-list.tsx   the h2 that was missing

src/features/appointments/queries.ts     getNextAppointment
src/features/notifications/queries.ts    listRecentNotifications
src/features/notifications/types.ts      NotificationListResult
src/features/notifications/content.ts    the list heading
src/config/notifications.ts              two bounds
src/features/patients/content.ts         dashboard copy; the nav decision
src/features/patients/completeness.ts    shortLabel

tests/components/notifications.test.tsx  heading-order regression
tests/components/authorization.test.tsx  AppNav placement regression
```

#### Dependencies

**None added.** In particular, no animation library — see *Motion*.

---

### 2. The dashboard

`phase_18.md` section 5's order, top to bottom, and nothing else:

```text
Welcome back, <name>

Your next visit          one appointment, the page's only emphasised surface
What needs your          derived from stored values; empty when nothing does
  attention?
Your care                prescriptions · treatment plans · documents
Recent updates           the newest three, read-only
Quick actions            one primary action, two quiet ones
─────────────────────────
emergency note · contact the clinic
```

Section 64 lists what it must not be — KPI cards, decorative charts, dense
tables, a generic "welcome back" shell — and the constraint that keeps it
honest is section 7: **nothing on the page is invented**. Every figure and
every sentence comes from a row the database returned, and where there is no
row the panel says so. There is no health score, no streak, no progress bar
over a treatment, and no percentage that is not the profile completeness Phase
07 already calculated from real fields.

#### "What needs your attention?"

The panel the phase is really about, and the only genuinely new *logic*. It is
a pure function — `features/patients/attention.ts` — taking already-fetched
values and returning a list, so every rule is tested one at a time and none
depends on when the test runs.

Three rules, each grounded in a stored value:

| Item | Fires when | Tone |
| --- | --- | --- |
| Your appointment request is with the clinic | the next appointment's status is `requested` | information |
| You have *n* unread updates | the authorized unread count is above zero | action |
| Profile details are missing | Phase 07's completeness says so | action |

The first is the one worth explaining. In Punarvasu's model the **clinic**
confirms a request, not the patient (Phase 09) — so an item telling a patient
to "confirm your appointment" would be an instruction to press a button that
does not exist. It is phrased as information and says, in words, that there is
nothing for them to do. Section 62's own example suggests otherwise; the
product's actual rules win.

Ordered by time-sensitivity, not by how easy each is to satisfy: a missing
postal code must never push an unconfirmed appointment down the page. When the
list is empty the panel says so calmly rather than manufacturing a task —
which is the whole point of the feature, and is asserted by test.

#### The clinical boundary, stated on the page

"Your care" carries one sentence: *your consultation notes stay with the
clinic — these are the parts written for you to keep.* An absence nobody
explains reads as something missing, and a patient wondering where their notes
are deserves an answer rather than a gap.

Nothing is filtered to achieve that. `clinical_records` has **no patient
policy at all** (Phase 12), the AI session table has none (Phase 17), and
`internal_note` has no column grant for anybody (Phase 09) — so there is no
row and no column for this surface to have to be careful about.

The tiles show a **date and a way in**, never contents: not a medicine, not a
dose, not even a treatment plan's title, which a clinician wrote about one
patient. A dashboard is read at a glance and over shoulders; the detail is one
deliberate tap away. That is section 39's minimisation applied to a screen,
and it is why the queries behind the tiles ask for one row each.

---

### 3. The performance defect

The old overview called `getMyAppointments()` — **every appointment the
patient has ever had**, unbounded, with no `limit` — grouped them in
JavaScript, and rendered `upcoming[0]`.

That is precisely what sections 81, 94 and 128 forbid, and the shape of the
cost is the part worth recording: it grows with every visit, so it degrades
fastest for the long-standing patients the clinic most wants the portal to
serve well. It was invisible in development, where the seeded patient has a
handful of appointments.

`getNextAppointment(now)` replaces it and asks the database the question the
page is actually asking:

```sql
select <named columns> from appointments
where status <> 'cancelled' and ends_at >= now
order by starts_at asc limit 1
```

Three details:

* `ends_at` rather than `starts_at`, matching `groupAppointments` exactly — a
  consultation already under way is still the patient's next appointment, and
  dropping it from the dashboard while they sit in the room would be strange.
* `status <> 'cancelled'` rather than a list of live statuses, for the same
  reason Phase 09's exclusion constraint is written that way: a status added
  later cannot accidentally start counting as cancelled.
* It is served by `appointments_patient_idx (patient_id, starts_at desc)`,
  already present since Phase 09. No index was added.

`getMyAppointments` is unchanged and still serves the appointments list, which
genuinely does need the whole set to group it.

`listRecentNotifications(limit)` is the same idea for the updates panel:
`listNotifications` always asks for a page **plus one** so it can answer "is
there more?", and a dashboard has no "more" to offer. Asking for twenty-one
rows to render three is the thing section 94 is about. Both new queries clamp
their own bound inside the query, not only at the call site.

**Six bounded queries, in parallel.** The dashboard runs them in one
`Promise.all` (section 83, no waterfall), and there is deliberately no
`getPatientDashboard()` aggregate — section 128, and section 82's named
anti-pattern, which a structural test asserts by name.

---

### 4. Navigation

**The patient tab bar is unchanged at six items**, all of them `/patient/*`.
`phase_18.md` section 9 lists Notifications as a seventh, and it was
considered and rejected with the reasoning recorded in
`features/patients/content.ts`:

> The notification centre lives at `/notifications` — a shared Phase 15 route,
> outside `/patient`, because every role has notifications and a
> patient-specific copy would be a second surface to secure for no capability.
> Putting it in this bar would therefore mean a tab that, when pressed, takes
> the patient to a page where the bar no longer exists. A navigation whose
> tabs disappear reads as a bug, and it is the one thing a section nav must
> not do.

Notifications reach the patient three other ways instead, all already present:
the **bell** in the header with an unread count on every authenticated page,
the **Recent updates** panel where section 5 asks for them, and an **attention
item** when anything is unread. Section 9's own qualifier — "only show
sections supported by actual permissions/data" — and section 10's warning
against overcrowding both point the same way.

**Mobile.** Section 10 asks for an appropriate mobile pattern and warns
against an overcrowded bottom bar. The pattern here is: the global header
(brand, bell, sign out), the section tab bar, and **the dashboard as the
hub** — every destination is also a large thumb-reachable card or button on
`/patient`, which is what section 78 asks to be prioritised. No bottom
navigation was added; it would have needed a "More" menu, a client component
and a focus trap to reach the same six places the page already offers.

---

### 5. Motion — a deliberate departure, stated rather than buried

**Framer Motion was not added.** The task brief asked for it to be used
selectively; `phase_18.md` section 67 makes it conditional ("only where it
improves…"); and `docs/DESIGN_SYSTEM.md` section 41 records Phase 02's
deliberate decision not to carry an animation runtime, with the reasoning that
micro-interactions are CSS transitions, overlays animate from Radix's
`data-state`, and content entrance is a CSS keyframe started by a ~40-line
`<Reveal>`.

`AGENTS.md` section 5 says not to introduce a library unless the existing
solution cannot support the requirement, and `DESIGN_SYSTEM.md` section 60
puts the design system above existing implementation and above a phase
suggestion. Nothing on this dashboard needs a JavaScript animation engine: it
is a static server-rendered page of cards.

The trade it would have been is the reason, not the rule: the patient portal
is the surface most likely to be opened on a low-end phone on mobile data, and
adding an animation runtime to every client bundle to duplicate existing CSS
is the wrong way round. Reduced motion is respected by the global rule, and
**verified in the browser**: zero running animations on `/patient` under
`prefers-reduced-motion: reduce`.

If a later phase has a genuine need — a shared-element transition, gesture
dragging — it should add the library deliberately, which is what
`DESIGN_SYSTEM.md` section 41 already says.

---

### 6. Loading, empty and error states

| State | Where |
| --- | --- |
| Loading | `(app)/patient/loading.tsx` — a structured skeleton in the shape of the real page: greeting, a large next-visit card, an attention list, three care tiles, two updates. `SectionLoading` announces one polite sentence and hides the boxes from assistive technology |
| Error (area) | `(app)/patient/error.tsx` — **new**. The application's root boundary sits above the `(app)` group, so a failure there took the header, the bell, the navigation and sign-out with it. This one is inside the area, so the shell survives and a patient whose prescriptions page failed can still reach their appointments |
| Error (panel) | Each panel renders its own quiet notice. Section 129: a document outage must not destroy the dashboard |
| Empty | Every panel, and each says what to do next |

**"Nothing" and "we could not read it" are different screens** everywhere on
this page — the distinction this project has carried since Phase 07, and
section 72's requirement that stale or missing clinical information is not
presented as current. Telling a patient they have no prescription because a
query failed is a clinically misleading claim; telling them they have no
appointment invites them to book a second one. Asserted by test for all four
panels, in both directions.

No error boundary or panel renders `error.message`. Next.js already replaces
it in production; this code does not render it in any environment, so a
development build cannot get into the habit of showing what production hides.
`digest` is the one thing that crosses — an opaque correlation id.

---

### 7. Defects found and fixed

All three were found by measurement. None was visible to 4,079 passing tests,
to ESLint, to the type checker or to review.

#### 1. The dashboard read the entire appointment history to show one row

*(real, found by reading the query layer before writing any code)*

Described in full in section 3 above. Fixed with `getNextAppointment`, and
guarded by a structural test asserting the dashboard never names
`getMyAppointments`, plus behavioural tests asserting the `limit(1)`, the
ordering and the filter.

#### 2. The notification centre's heading outline had a gap

*(real, pre-existing since Phase 15, found by the browser pass)*

`/notifications` rendered `h1` "Notifications" and then, on each notification,
`h3` — with no `h2` between them. axe reports it as `heading-order`; a
screen-reader user navigating by heading falls through a level.

The component suite could not have caught it: it renders the list on its own,
without the page heading above it, so the outline it produces is locally
valid. This is the third phase running in which the browser pass found
something nothing else could, after Phase 08's 35px overflow, Phase 09's
3.89:1 contrast failure and Phase 11's duplicate landmark — and Phase 15
recorded skipping the pass as its own first known issue.

Fixed with a real `h2` naming the active filter: "All notifications" /
"Unread notifications". Not a spacer — which view is showing was previously
carried only by a control's pressed state, so somebody arriving at the list by
heading had no way to know they were looking at a filtered subset. The fix
repairs the outline and answers that question in the same breath.

Guarded by a test on the heading **level**, not by an axe run, for the reason
the defect existed in the first place.

#### 3. The authenticated header clipped its own navigation on every phone

*(real, pre-existing since Phase 08, found by the browser pass)*

The brand, the area navigation, the notification bell and sign-out shared one
flex row. Below about 430px they did not fit. Measured at 320px:

```text
nav overflow          90px   (the nav was 90px wider than its box)
"Patient area"        clipped mid-word — rendered as "Patient ar"
notification bell     20px wide — less than half its 44px touch target
page overflow         0
```

That last line is why four earlier browser passes missed it. The nav carries
`overflow-x-auto`, so it absorbed the overflow by **hiding its own content**
rather than widening the document — and every previous pass measured
`scrollWidth - clientWidth` on the page.

Fixed in the layout, not the component: the header wraps to two rows below
`sm`, giving the navigation its own full-width row. Wrapping rather than
hiding, because an area link is a signed-in person's only route back to their
own workspace from a page outside it — `hidden sm:block` would have cost a
doctor on `/notifications` their way back. Each control is still rendered
exactly once, so the unread count is still one query per request.

Re-measured after the fix: `navOverflow=0` and the bell at a full 44px at 320,
360, 390, 430, 640 and 768px.

`AppNav` gained a `className` so the layout decides placement, and a
regression test asserts that contract — the class, not the pixels, because
jsdom has no layout engine, with the measured result recorded in the test's
comment (the technique Phase 08 established for `TableScroller`).

#### Stale copy, again

The overview told patients Punarvasu "does not send reminders or notifications
yet" — false since Phase 15. Removed with the page. This is the fourth phase
to find a placeholder that outlived what it stood in for; the consequence here
was mild, but Phase 13's version of it would have sent a practitioner to write
prescriptions somewhere else with the page one click away.

#### Four harness bugs, recorded because a report listing only what passed is not evidence

The first browser run reported **four failures**. One was real (the heading
order). Three were the harness being wrong:

* **"six targets under 24px."** Five were stretched links — a short inline
  `<a>` whose real hit area is the card its `::after` covers, measured at
  111–123px. Phase 04 recorded the same exemption for `CardLink`. The sixth,
  "Contact Punarvasu", is a link inside a sentence, which WCAG 2.2 SC 2.5.8
  exempts explicitly. The check now measures the **effective** hit area and
  honours the inline exception.
* **"a foreign document id discloses something."** The page says "Document
  unavailable"; the pattern looked for "couldn't find|not found". The four
  surfaces word their denial differently, and what matters is that each denies
  and leaks nothing — not that they share a sentence.
* **"the refusal names a role or permission."** The forbidden page says "You
  don't have permission to view this page", which names no permission. The
  pattern flagged the generic word. What Phase 08 promised is that the refusal
  discloses nothing about the *privilege model*, and the check now asserts
  that instead — a check that forces plain English to be reworded is checking
  the wrong thing.

A fifth, in a structural test: a scan for clinical column names flagged the
profile form's own helper text, *"Ayurvedic assessment takes age into
account"*. Scanning raw prose would pressure a future author to delete an
explanation in order to pass, which is how a scan gets deleted instead. It now
matches the name as a **code identifier** — quoted, a property access, or an
object key. Phase 16 recorded the same lesson.

---

### 8. Security and privacy

Phase 18 added no table, no policy, no permission and no RPC, so the model is
Phases 07–15's unchanged. What this phase is responsible for is not widening
it, and that is what was verified.

#### Live browser — 53 checks, production build, real Supabase

| Area | Result |
| --- | --- |
| Patient reaches the dashboard and all five of their own routes | PASS (6) |
| **Patient is refused `/doctor`, `/doctor/patients`, `/receptionist`, `/receptionist/schedule`, `/admin`, `/admin/users`** | PASS (6) |
| The refusal names no role and no specific privilege | PASS |
| **Receptionist, doctor and administrator are each refused `/patient`** | PASS (3) |
| Signed out, `/patient`, `/patient/prescriptions` and `/notifications` all go to sign-in with the destination preserved | PASS (3) |
| **IDOR: a foreign appointment, prescription, treatment plan and document id each deny and disclose nothing** | PASS (4) |
| No storage path, signed URL or `token=` in the HTML | PASS |
| No `internal_note` in the HTML | PASS |
| No clinical content on the dashboard | PASS |
| Nothing in `localStorage` or `sessionStorage`; no query string | PASS (3) |
| `private, no-store` and `noindex` | PASS (2) |
| **axe with real computed contrast** — `/patient` at 1280 and 390, `/patient/prescriptions`, `/notifications` | PASS — 0 violations |
| **No horizontal overflow** at 320/375/390/430/768/1024/1280/1440/1920 on `/patient`, and at four widths on appointments and profile | PASS (3) |
| One `h1`, no skipped heading level, six named regions, no target under 24px | PASS (4) |
| No animation under `prefers-reduced-motion` | PASS |
| Public regression: `/`, `/services`, `/contact` axe-clean | PASS (3) |

**53 passed, 0 failed.**

#### Structural — `tests/integration/patient-experience.test.ts`, 44 assertions

The guarantees that are *absences*, proved by there being nothing to call:

* **No patient page reads `patientId`, `patient_id`, `userId`, `user_id`,
  `profileId` or `profile_id` from a request.** Six assertions across every
  route. Sections 16, 49 and 135, and section 148's "bad → good" example: the
  strongest version of the rule is an argument list with nothing to
  substitute, which is the shape Phase 07 established.
* **No patient surface reads `clinical_records`, `ai_assistance_sessions`,
  `schedule_exceptions`, either notification queue, `role_assignment_events`
  or `user_roles`**, and none names `internal_note`, `doctor_notes`,
  `diagnosis_or_clinical_impression`, `clinical_observations`,
  `chief_complaint`, `assessment` or `history_of_presenting_concern` as a
  column.
* **No patient surface imports `features/clinical`, `features/clinical-ai`,
  `lib/ai` or `components/clinical-ai`.** Section 57, and Phase 17's caveat
  that this is the phase where somebody would be tempted.
* **No patient surface names `storage_path`, `storagePath` or the bucket, calls
  `getPublicUrl`, or imports the service-role client.** Sections 31, 32.
* **Nothing writes `localStorage` or `sessionStorage`**, and no patient
  component compares a role to a staff value. Sections 54, 123, 124.
* **Every patient nav item is a `/patient/*` route**, and the patient role
  holds none of fifteen staff or clinical-authoring permissions, asserted
  against the policy table.
* The patient's four write permissions are asserted as an **exact set**, so a
  permission added to the role has to be acknowledged in a test that says why
  each one is there.
* Every patient page declares `noindex`, and no page title interpolates a name
  or a clinical word.

---

### 9. Verification

Executed on 2026-09-22:

```text
Lint:       PASS — npx eslint . --max-warnings=0, 0 problems
Typecheck:  PASS — npm run typecheck, exit 0
Formatting: PASS — npx prettier --check .
Tests:      PASS — 4,208 tests, 129 files (was 4,079 / 125)
Build:      PASS — npx next build, compiled with no warnings
```

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 4,208 / 129 files** |
| Production build | `npx next build` | **PASS** — no warnings; all public pages still static; the patient routes dynamic |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 181 files, 0 findings |
| **Live browser** | 53 checks, real Chrome, production build, live Supabase | **PASS — 53/53** |
| Live axe, real computed colour | 4 authenticated sweeps + 3 public regressions | **PASS** — 0 violations |
| Live overflow | 9 widths on `/patient`, 4 on two more routes | **PASS** — none |
| Header geometry | 6 widths, before and after the fix | **PASS** — `navOverflow=0`, bell 44px |
| Visual review | screenshots at 1280 and 320, read end to end | **PASS** |
| Migration | — | **NONE** — this phase adds no schema change |
| E2E | — | **NOT RUN** — no maintained E2E tool (deferred since Phase 01); the live checks are a script written for this phase |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

#### New tests — 129 added

| File | Count | Covers |
| --- | --- | --- |
| `src/features/patients/attention.test.ts` | 27 | Every attention rule one at a time, with an injected clock; ordering by time-sensitivity; that an empty account produces an empty list; that no item links outside the patient's own routes, previews a notification, or carries clinical content; and the imminence boundary in both directions |
| `tests/components/patient-dashboard.test.tsx` | 37 | All four panels in all three states; "nothing" distinguished from "could not read"; no medicine, dose or plan title in a summary; no identifier rendered; unread as a word; markup rendered as text; no management control on the dashboard's notification panel; every panel a named `h2` region; axe |
| `tests/integration/patient-experience.test.ts` | 44 | The structural guarantees in section 8 above |
| `tests/integration/patient-dashboard-queries.test.ts` | 18 | The two new queries exercised against a stubbed PostgREST builder: the `limit(1)`, the ascending order, the cancelled filter, `ends_at` rather than `starts_at`, named columns, clamping at both ends, and `unavailable` never collapsing into `not_found` |
| `tests/components/notifications.test.tsx` | +2 | The heading-order regression |
| `tests/components/authorization.test.tsx` | +1 | The `AppNav` placement contract |

---

### 10. Acceptance criteria

#### Patient Home

| Criterion | Result |
| --- | --- |
| `/patient` exists | PASS |
| Dashboard is useful and calm | PASS — five panels, one emphasised surface, no KPI cards, no charts; reviewed as screenshots at 1280 and 320 |
| Next appointment is prioritized | PASS — first panel, largest type, the only primary button above the fold |
| Important patient actions are surfaced | PASS — derived from stored values, ordered by time-sensitivity |
| Empty states exist | PASS — every panel, each saying what to do next |
| Loading states exist | PASS — a structured skeleton in the page's own shape |
| Error states exist | PASS — per panel, plus a new area-level boundary |

#### Navigation

| Criterion | Result |
| --- | --- |
| Desktop navigation works | PASS — measured |
| Mobile navigation works | PASS — **and a pre-existing clipping defect was found and fixed**; re-measured at six widths |
| Only appropriate patient routes are exposed | PASS — asserted: every nav item is `/patient/*` |
| Navigation remains accessible | PASS — axe clean; `aria-current`; nothing clipped at 320px |

#### Appointments

| Criterion | Result |
| --- | --- |
| Upcoming appointments work | PASS |
| Appointment details work | PASS |
| Appointment history works | PASS |
| Authorized cancel/reschedule actions work | PASS — Phase 09's actions, untouched |
| Phase 09 business rules are reused | PASS — no scheduling logic was written; the one new query is a read |
| Patient identity is server-derived | PASS — no query takes an id; asserted across every route |

#### Prescriptions / Treatment Plans

| Criterion | Result |
| --- | --- |
| Patient-visible prescriptions and plans can be viewed | PASS |
| Only authorized/finalized data is exposed | PASS — `status <> 'draft'` lives in the RLS policy (Phase 13), not in a query |
| Draft/internal data is hidden | PASS |
| Patients cannot modify either | PASS — there is no `prescriptions.write.self` or `treatment_plans.write.self` in the vocabulary at all; asserted as an exact set |

#### Documents

| Criterion | Result |
| --- | --- |
| Documents can be listed; uploads work; preview/download work | PASS — Phase 14, unchanged |
| Private storage remains private | PASS — no patient surface names the path or the bucket or calls `getPublicUrl`; verified in the HTML |
| Signed URLs are short-lived and authorization-gated | PASS — Phase 14's server action, unchanged |

#### Notifications

| Criterion | Result |
| --- | --- |
| Notification center works | PASS — **and its heading outline was repaired** |
| Read/unread state works | PASS |
| Deep links are authorization-safe | PASS — the destination re-authorizes; verified by IDOR |
| Privacy-sensitive content is minimized | PASS — structurally: no column exists for a medicine, a diagnosis or a document title |

#### Profile

| Criterion | Result |
| --- | --- |
| Profile is accessible and editable | PASS — Phase 07, unchanged |
| Completeness is calculated correctly | PASS — still derived, never stored; one display field added |
| Auth identity remains separate | PASS — no second editable email identity |

#### Security

| Criterion | Result |
| --- | --- |
| Cross-patient access is denied | PASS — four resource types, live |
| IDOR attempts are denied | PASS — and indistinguishable from not-found |
| Patient cannot access staff routes | PASS — six routes, live |
| Patient cannot spoof patient identity | PASS — there is no parameter to spoof; asserted structurally |
| RLS remains enforced | PASS — no policy was added, altered or dropped |
| No clinical data in public caches | PASS — `private, no-store`, `noindex`, measured |
| No sensitive data stored client-side | PASS — measured in a real browser |

#### Clinical Safety

| Criterion | Result |
| --- | --- |
| Internal doctor notes remain protected | PASS — no policy, no grant, no import |
| Internal AI output remains protected | PASS |
| AI does not become patient-facing | PASS — no AI import, component or route on any patient surface; asserted |
| Patient-visible information is explicitly scoped | PASS — and stated to the patient in words |

#### UX / SEO / Engineering

| Criterion | Result |
| --- | --- |
| Punarvasu design system is reused | PASS — tokens only; no new colour, radius, shadow or spacing value; no new component primitive |
| Experience is not generic SaaS | PASS — reviewed visually at two widths |
| Responsive design works | PASS — nine widths, measured |
| Accessibility works | PASS — 0 axe violations with real computed contrast |
| Motion respects reduced-motion | PASS — measured; and no animation runtime was added |
| Authenticated pages are not indexable | PASS |
| No sensitive information in metadata or URLs | PASS — the title is generic, the greeting is on-page only |
| TypeScript / Lint / Tests / Build | PASS / PASS / PASS / PASS |
| No duplicate domain logic is introduced | PASS — no migration, no permission, no second engine; asserted |

#### Definition of done

```text
Login → Patient Home → see upcoming appointment → open appointment
     → review care information → view prescription → view treatment plan
     → view document → read notification → update profile → return
```

Every step was driven in a real browser against the production build. And the
boundary holds against each of the five things section 152 names — URL,
resource id, request payload, client state and browser storage — each verified
live rather than argued.

---

### 11. Deferred

Intentionally not built:

* **A `/patient/care` hub route** (section 20). Prescriptions, treatment plans
  and documents already have their own pages, and section 20 says to use the
  existing architecture rather than create unnecessary routes. The dashboard's
  "Your care" panel is the hub, without a third page that only links to two.
* **A bottom navigation bar** (section 10). Reasoned in section 4 above.
* **Patient-facing search** (section 85), which the specification says to add
  only where useful. A patient has a handful of prescriptions and documents.
* **Personal statistics** (section 56) beyond what the panels already show. A
  "visits completed" count is available and nobody asked for it; inventing a
  figure to fill a panel is what section 64 is about.
* **Notification preferences beyond Phase 15's**. Email is still unconfigured
  and the preferences page says so honestly.
* **Data export and account deletion** (sections 117, 118) — both need a
  retention policy that does not exist.
* **Patient-facing AI of any kind** (sections 57, 153). Structurally out of
  reach: the permission is doctor-only and every AI function gates on
  `assert_care_practitioner()`.
* **Framer Motion.** Section 5 above.
* **Moving `ProfileSection`/`ProfileFieldList`/`ProfileField` to
  `components/shared/`.** Eight areas depend on them; still its own change.

---

### 12. Known issues

1. **No E2E tool, no manual screen-reader pass, no Lighthouse run.** Unchanged
   since Phase 01/02. The 53 live checks are a script written for this phase,
   not a maintained suite. The screen-reader gap is the one that matters most
   here: axe plus explicit heading, landmark and keyboard assertions is a real
   but partial substitute, and this phase's own heading-order defect is an
   example of something a screen-reader user would have noticed immediately.
2. **The clipping defect existed for ten phases.** It shipped in Phase 08 and
   survived four browser passes because the nav absorbed the overflow by
   hiding its own content, while every pass measured page overflow. Worth
   carrying forward as a technique: **measure the element, not only the
   document.**
3. **The dashboard's data is a development clinic's.** The seeded practitioner
   is still "Test Doctor" and the consultation types, durations, minimum
   notice and booking horizon remain provisional from Phase 09. The dashboard
   is correct; the clinic behind it is not real yet.
4. **`src/types/database.ts` is still hand-written**, deliberately.
5. **The four Phase 08 test accounts remain on the development project.**
   Shared, well-known credentials, including an administrator. **Delete them
   before this database takes real patient data.**
6. **Still no CSP.** Unchanged since Phase 02.
7. **Legal pages still do not exist.** Required before the clinic handles real
   records through this website.
8. **Phase 17's provider review is still open**, and is still a launch
   blocker: `docs/HEALTHCARE_AND_AI_SAFETY.md` section 8 requires the AI
   provider's retention and training-use terms to be reviewed before patient
   data is sent. Not this phase's work, and recorded here so it does not
   become nobody's.

---

### 13. Phase status

```text
Phase 18: COMPLETE
Ready for Phase 19: YES
```

Phase 19 has not been started.

Three things to carry forward:

* **The audit subsystem is now overdue.** Phases 12, 13, 14, 15, 16 and 17
  each deferred something specific to it — administrative clinical access,
  prescription access logging, document access, patient-record access — and
  each recorded the same reason: the capability would otherwise be granted
  unaudited. Phase 18 adds nothing to that list but makes it longer-standing.
* **Measure the element, not only the document.** Known issue 2.
* **A placeholder outlives the thing it stood in for.** Four phases running
  have now found one. A notice saying a feature is unavailable should be
  deleted in the change that builds it, and it is worth a test when the notice
  is load-bearing.
