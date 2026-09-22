## PHASE 16 — Analytics & Reporting

Status:
COMPLETED — migration applied to the live Supabase project, verified against
it with real per-role JWTs, and driven through the production build over HTTP

Completed On:
2026-09-19

Summary:
Built Punarvasu's analytics layer: a read-only reporting interface over the
authoritative domain rows Phases 07-15 write, three role-scoped dashboards, a
centralized metric definition consumed by the dashboard and the export alike,
bounded timezone-correct date filtering, an accessible chart with a real table
beside it, and one server-generated CSV report.

**No table, no column, no enum, no trigger and no policy was added.** Analytics
is not a second source of truth (`phase_16.md` sections 5, 30 and 103): every
number is derived at read time from rows the domain already owns, so there is
nothing here that can fall out of step with an appointment — because there is
nothing here that stores one. The migration's diff contains `create function`
and `create index` and nothing else, asserted by test.

**No client role can call an internal analytics function, and `anon` can call
none of them at all.** Every reachable function authorizes in its **body**
before it reads, and every revoke names `anon` and `authenticated` explicitly
— the defect Phase 15 shipped and had to fix in two follow-up migrations.

**A practitioner's own analytics take no practitioner argument.** Not optional,
not ignored — absent, from the RPC signature, from the Zod schema and from the
filter component. `phase_16.md` section 101's "change the practitionerId" has
nothing to change and section 102's "Doctor A → Doctor B metrics" has no
request that expresses it.

3,799 tests pass, up from 3,388. **155 live checks** against the real database
with real per-role JWTs, covering the whole authorization matrix, the range
bounds, the returned shapes, the date boundaries and representative query
performance. **101 HTTP checks** against the production build, covering all
five actors across three routes and the CSV export end to end.

**Two real defects were found by verification rather than by review**, one of
them by a test I had just written against my own design. Both are described in
full below, along with three harness bugs and one class of tool-induced
corruption that this phase reintroduced and cleaned up.

---

### Repository assessment before starting

Phases 06-15 left identity, the patient record, authorization, the appointment
engine, both staff workspaces, clinical records, prescriptions, treatment
plans, documents and notifications. Reused rather than rebuilt:
`requirePermission`/`assertPermission`, `config/permissions.ts`,
`PROTECTED_AREAS`, the Supabase server client, `AppError`,
`createRouteHandler`, the structured logger, `uuidSchema`,
`public.clinic_timezone()`, `public.has_app_role()`,
`public.assert_care_practitioner()`, Phase 09's `features/appointments/time.ts`
and its `holdsSlot` predicate, Phase 09's availability and blocked-period
model, Phase 15's delivery states, `Field`, `Input`, `NativeSelect`, `Button`,
`Alert`, the `Table` family, `ErrorState`, `SectionLoading`, `Skeleton`,
`NavLink`, `Container` and `Section`.

Five findings shaped the work:

* **Phase 15 left a caveat that turned out to be the whole grant design**:
  `revoke ... from public` does not remove Supabase's default named grants, so
  a `security definer` function relying on its grant alone is exposed. Every
  revoke in this migration names `anon` (and `authenticated` for the internal
  helpers), and every reachable function carries its gate in the body.
* **Phase 15 also recorded that its notification metrics are operational, not
  clinical** — "how many prescription notifications were sent" is a count of
  messages, not of prescriptions. They are reported in separate panels for
  that reason.
* **A view would have been the wrong tool, and silently so.** A view is
  evaluated with the *caller's* row-level security, and the callers of clinic
  analytics are a receptionist and an administrator — neither of whom has any
  policy on `prescriptions`, `clinical_records` or `notification_deliveries`.
  A view over those tables would not be refused; it would return **zero rows**,
  and the dashboard would report that the clinic issued no prescriptions this
  month. A wrong number that looks right is the worst failure an analytics
  system has, so every aggregate is a gated `security definer` function.
* **`PROTECTED_AREAS` needed no new entry.** The three dashboards live under
  `/admin`, `/receptionist` and `/doctor`, so each inherits its area guard and
  adds its own per-page permission — the pattern every phase since 08 has used.
* **Every step of the Punarvasu green ramp fails a categorical chroma floor.**
  The brand is a deliberately restrained forest green, so a chart mark needed
  a design-system token rather than a one-off colour. See *Design system*.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260927120000_analytics_reporting.sql

src/config/analytics.ts                      bounds, presets, granularity, the
                                             export contract (a mirror)
src/config/analytics.test.ts

src/features/analytics/types.ts              the domain model
src/features/analytics/metrics.ts            THE metric definitions
src/features/analytics/metrics.test.ts
src/features/analytics/ranges.ts             clinic-timezone periods
src/features/analytics/ranges.test.ts
src/features/analytics/validation.ts         the trust boundary
src/features/analytics/validation.test.ts
src/features/analytics/errors.ts             SQLSTATE -> safe copy
src/features/analytics/errors.test.ts
src/features/analytics/format.ts             display formatting
src/features/analytics/content.ts            every word the dashboards say
src/features/analytics/queries.ts            authorized aggregate reads
src/features/analytics/export.ts             the CSV writer
src/features/analytics/export.test.ts
src/features/analytics/href.ts               shared route helpers

src/components/analytics/analytics-panel.tsx       the four panel states
src/components/analytics/analytics-table.tsx       accessible tables
src/components/analytics/analytics-loading.tsx     the skeleton
src/components/analytics/analytics-freshness.tsx   when, and refresh
src/components/analytics/metric-card.tsx           the figures
src/components/analytics/metric-definitions.tsx    how each is calculated
src/components/analytics/trend-chart.tsx           bars, and a real table
src/components/analytics/date-range-filter.tsx     the period
src/components/analytics/export-form.tsx           the download
src/components/analytics/appointment-panels.tsx    shared by three dashboards
src/components/analytics/clinic-panels.tsx         patients, notifications,
                                                   clinical activity

src/app/(app)/admin/analytics/{page,loading}.tsx
src/app/(app)/receptionist/analytics/{page,loading}.tsx
src/app/(app)/doctor/analytics/{page,loading}.tsx
src/app/api/reports/appointments/route.ts

tests/integration/analytics-queries.test.ts
tests/integration/analytics-security.test.ts
tests/components/analytics.test.tsx
docs/progress/progress_phase_16.md
```

#### Modified

```text
src/config/permissions.ts            four permissions
src/config/permissions.test.ts       the role lists, and why `analytics.read`
                                     stays on the speculative list
src/lib/authorization/policy.test.ts the exhaustive matrix, extended
src/types/database.ts                thirteen functions (the public ones only)

src/app/globals.css                  --chart-series, --chart-track
src/lib/design/palette.ts            the two new tokens, mirrored
src/lib/design/contrast.test.ts      four new SC 1.4.11 assertions

src/features/reception/content.ts    an Analytics nav item
src/features/doctor/content.ts       a My practice nav item
src/app/(app)/admin/layout.tsx       an Analytics nav item

eslint.config.mjs                    the `^_` convention, encoded — see
                                     Defects, item 3
```

#### Dependencies

**None added.** No charting library, no date library, no CSV library, no
spreadsheet or PDF generator. The chart is inline SVG, the dates go through
Phase 09's `Intl`-based timezone layer, and the CSV writer is forty lines.

---

### 2. Database

`supabase/migrations/20260927120000_analytics_reporting.sql`, applied to the
linked project with `supabase db push` (PostgreSQL 17) and verified against it.

```text
Tables:            0 added, 0 altered, 0 dropped
Columns:           0 added
Enums:             0 added
Triggers:          0 added
RLS policies:      0 added, 0 altered, 0 dropped
Existing functions replaced: 0
Column grants widened:       0

Functions:         25 added — 13 public, 12 internal
Indexes:           7 added
Grants:            13 EXECUTE to `authenticated`; nothing to `anon`;
                   nothing at all for the 12 internal functions
```

#### The public interface

| Function | Gate | Answers |
| --- | --- | --- |
| `analytics_clinic_appointment_summary` | operational | counts by status, plus the rate denominator |
| `analytics_clinic_appointment_trend` | operational | counts per trend bucket |
| `analytics_clinic_practitioner_workload` | operational | volume and time, per practitioner |
| `analytics_clinic_patient_summary` | operational | new, returning, active, registered |
| `analytics_clinic_patient_growth` | operational | new patients per bucket |
| `analytics_notification_delivery_summary` | clinic (admin) | send attempts by channel and provider |
| `analytics_notification_summary` | clinic (admin) | in-app notifications by kind |
| `analytics_clinical_activity_summary` | clinic (admin) | four counts of clinical acts |
| `analytics_document_type_summary` | clinic (admin) | uploads by kind |
| `analytics_practice_appointment_summary` | care practitioner | the caller's own counts |
| `analytics_practice_appointment_trend` | care practitioner | the caller's own trend |
| `analytics_practice_utilization` | care practitioner | the caller's own time |
| `analytics_appointment_report` | report exporter (admin) | the export's aggregated rows |

#### The internal layer

Twelve functions with **no grant to any client role**: the four range helpers,
the granularity deriver, the multirange duration helper, the three aggregate
workers, and the three gates. They are called only from the wrappers above,
which run as the definer.

Splitting them out is what stops the doctor's own-practice functions being a
second implementation of the clinic ones — section 93's "do not duplicate
calculations in SQL, API, frontend and export code", applied inside SQL first.

#### Utilization, and why it was implementable

Section 17 permits utilization only where the scheduling model provides
authoritative data, and Phase 09's does:

```text
available = the practitioner's recurring working intervals on each clinic day
            in the period, merged so an overlapping roster entry is not counted
            twice, minus every blocked period that overlaps them — their own
            leave and clinic-wide closures alike

booked    = the part of those remaining windows covered by an appointment that
            holds a slot (every status except `cancelled`, which is exactly
            `holdsSlot()` and exactly the exclusion constraint's predicate)

utilization = booked / available, and null when available is zero
```

Computed with PostgreSQL multiranges: `range_agg` merges, `-` subtracts the
blocked time, `*` intersects the booked time with what remains. Two properties
follow by construction rather than by checking, both of which section 97 asks
for — **utilization cannot exceed 100%**, because booked time is clamped to
available time, and neither figure can be negative, because both are sums of
multirange durations. Verified live.

#### Indexes

Seven, each named after the column an aggregate range-scans:
`patients_created_at_idx`, `prescriptions_issued_at_idx`,
`treatment_plans_activated_at_idx`, `clinical_records_completed_at_idx`,
`patient_documents_created_at_idx`, `notifications_created_at_idx`,
`notification_deliveries_created_at_idx`.

Reused rather than duplicated: `appointments_starts_at_idx` (Phase 10),
`appointments_practitioner_idx` (Phase 09),
`practitioner_availability_lookup_idx` and `schedule_exceptions_window_idx`
(Phase 09). `appointments.status` deliberately gets no index: every query
filters by range first and aggregates statuses within it, so a status index
would be scanned past rather than used.

#### No materialized view

Section 31 permits one only when justified and warns against adding one for
architectural appearance. Punarvasu is one clinic; the heaviest query here
scans a year of appointments through an index and groups them, and measured
live it is indistinguishable from the network round trip. A materialized view
would buy nothing measurable and would cost a refresh strategy, a staleness
label on every figure, and a class of bug where the dashboard and the export
disagree because one read the view and the other did not.

---

### 3. Metric definitions

Every one lives in `src/features/analytics/metrics.ts` and is rendered on the
page beneath the figures, because section 92's "this prevents ambiguous
reporting" is only true if the definition reaches the person reading the
number.

The **counts** are computed in PostgreSQL. This module turns them into the
derived figures — the three rates and utilization — which is arithmetic on
already-aggregated numbers rather than a second aggregation, and doing it once
here is what makes the dashboard and the export agree by construction
(section 94, example 10).

```text
Metric:        Appointments
Formula:       count of appointments scheduled in the period, any status
Date semantics: by the clinic day `starts_at` falls on; [from 00:00, to+1 00:00)
Timezone:      public.clinic_timezone() — Asia/Kolkata
Scope:         clinic, or one practitioner when filtered
```

```text
Metric:        Completed / Cancelled / No-shows
Formula:       count where status = 'completed' / 'cancelled' / 'no_show'
Date semantics: by the clinic day the appointment was scheduled for — not the
               day it was cancelled
Timezone:      clinic
Scope:         clinic, or one practitioner when filtered
```

```text
Metric:        Concluded  (the denominator of every rate)
Formula:       completed + cancelled + no_show
Date semantics: as above
Timezone:      clinic
Scope:         as above
```

Section 14 asks for the denominator to be explicit and warns against casually
mixing statuses. This is the mix that is not casual: an appointment still
`requested`, `confirmed`, `checked_in` or `in_consultation` has not happened
yet, and counting it would make March's cancellation rate fall every time
somebody books an appointment in April. **The three rates therefore sum to
exactly 1 whenever the denominator is non-zero**, which the tests assert.

```text
Metric:        Completion rate / Cancellation rate / No-show rate
Formula:       completed / concluded, cancelled / concluded, no_show / concluded
Date semantics: over the concluded appointments in the period
Timezone:      clinic
Scope:         as above
Zero vs missing: null when concluded = 0, rendered as "No concluded
               appointments" and never as 0.0%
```

```text
Metric:        Utilisation
Formula:       booked minutes / available minutes, clamped in SQL so it cannot
               exceed 1; null when available = 0
Date semantics: working hours taken per clinic day in the period
Timezone:      clinic
Scope:         one practitioner; clinic-wide reports it per practitioner
```

```text
Metric:        New patients
Formula:       public.patients rows created in the period — a patient record,
               by either route Phase 07 and Phase 10 allow
Date semantics: by the clinic day created_at falls on
Timezone:      clinic
Scope:         clinic
```

Section 22 forbids assuming an account is a clinical patient. This counts the
**patient record**, not `auth.users`, and the page says so in words.

```text
Metric:        Returning patients
Formula:       distinct patients with a completed appointment in the period who
               also have a completed appointment before the period started
Date semantics: by the clinic day each appointment starts on
Timezone:      clinic
Scope:         clinic
```

```text
Metric:        Active patients
Formula:       distinct patients with at least one non-cancelled appointment
               in the period
Date semantics: by the clinic day the appointment starts on
Timezone:      clinic
Scope:         clinic
```

```text
Metric:        Registered patients
Formula:       count of patient records existing at the end of the period
Date semantics: point in time, as at the end of the last clinic day — so a
               report about March reads the same in April
Timezone:      clinic
Scope:         clinic
```

```text
Metric:        Acceptance rate  (NOT a delivery rate)
Formula:       sent / (sent + failed); pending excluded, because it has not
               been attempted
Date semantics: by when the send was attempted
Timezone:      clinic
Scope:         clinic, per channel and provider
```

Section 41 forbids calling an accepted send a delivery, and Phase 15's schema
agrees: there is no `delivered` status because no configured provider reports
one. The panel carries the sentence saying so, and a test asserts the metric's
own definition contains the words "not a delivery rate".

```text
Metric:        Prescriptions issued / plans activated / consultations
               documented / documents uploaded
Formula:       counts, by issued_at / activated_at / completed_at / created_at
Date semantics: the moment the act happened; a draft counts nowhere
Timezone:      clinic
Scope:         clinic; administrator only
```

---

### 4. Date and timezone

Every period is a pair of **clinic calendar dates**, both inclusive, denoting

```text
[ from 00:00 clinic-local , (to + 1 day) 00:00 clinic-local )
```

Start inclusive, end inclusive *as a day*, and no instant in two buckets or in
none. The timezone is Phase 09's `public.clinic_timezone()`; nothing in this
phase does timezone arithmetic of its own, and `features/analytics/ranges.ts`
goes through Phase 09's `Intl`-based converter throughout.

Section 25 names `new Date().toISOString().slice(0, 10)` as the thing not to
do, and it is worth being precise about why: at 00:30 on 1 October in Satara
it is still 19:00 on 30 September in UTC, so a server computing "today" that
way would report yesterday for the first five and a half hours of **every**
clinic day. Several assertions in `ranges.test.ts` are exactly that instant.

**Granularity is derived, not requested** (section 27): up to 31 days daily,
up to 122 weekly, otherwise monthly. There is no granularity parameter
anywhere in the feature, so there is one fewer input to validate and the
number of points a chart can be asked for is bounded by construction — at most
31 daily, 18 weekly, 13 monthly. The thresholds are mirrored between the SQL
and `config/analytics.ts` and asserted against each other at every boundary.

**Bounds** (sections 24, 26, 82, example 6): at most 366 days, counting both
ends, and not before a sanity floor. Enforced in the database, so a request
that never went through the form is still bounded; and in the application, so
a form can say what is wrong before a request is made. Raised as `PV060`
(reversed), `PV061` (too long) and `PV062` (before the floor).

---

### 5. Authorization

Four permissions added to `config/permissions.ts`:

| Permission | Roles | Covers |
| --- | --- | --- |
| `analytics.read.operational` | admin, receptionist | appointment volume and outcomes, the trend, practitioner workload, patient growth |
| `analytics.read.clinic` | admin | the above, plus notification delivery and clinical activity |
| `analytics.read.own_practice` | doctor | the caller's own practice only |
| `reports.export` | admin | generate and download the one report |

```text
Admin:              full clinic analytics, and the only role that may export
Receptionist:       operational scheduling analytics and patient growth
Doctor:             their own practice, resolved from auth.uid()
Patient:            nothing. No gate in the migration admits one
Practitioner scope: resolved by assert_care_practitioner(); no parameter exists
Export permission:  separate from every read permission (section 44)
```

The **receptionist deliberately does not hold `analytics.read.clinic`**.
Notification delivery is a systems concern rather than a scheduling one, and a
count of prescriptions issued sits on the far side of `docs/SECURITY.md`
section 6's "operational, never clinical" boundary. An aggregate is not a
prescription — but that line is worth keeping bright rather than re-argued per
figure, and the database's own gate draws it in the same place.

The **administrator deliberately does not hold `analytics.read.own_practice`**.
It resolves to whoever the caller's practitioner record is, and an admin has
none; granting it would be granting a permission that reaches nothing.

```text
src/proxy.ts                      optimistic redirect, no role check, no query
  v
(app)/layout.tsx                  requireUser()
  v
(app)/{admin,receptionist,doctor}/layout.tsx   requireAreaAccess(...)
  v
page                              requirePermission(...)
  v
features/analytics/queries.ts     assertPermission(...)
  v
database gate                     auth.uid() + has_app_role(...)
  v
definer function reads            with the definer's privileges, after the gate
```

Six layers; delete any one and an unauthorized caller still gets nothing.

---

### 6. Reports and exports

One report, defined once in `config/analytics.ts` and nowhere else:

```text
Name          Appointment operations
Purpose       What the clinic scheduled, and how it turned out
Audience      Administrator
Data source   public.appointments, joined to the practitioner and the type
Filters       clinic date range (bounded), optional practitioner
Calculation   a count per (clinic day, practitioner, type, status)
Permissions   reports.export in the application; assert_report_exporter() in
              the database
Export fields Date, Practitioner, Appointment type, Status, Appointments
Format        CSV
Delivery      POST /api/reports/appointments, authenticated, attachment,
              private no-store. No public URL, no object storage, no GET
```

It is **aggregated rather than a row per appointment**, which is the
difference between section 35's two examples. A row per appointment would
carry a date, a time and a practitioner for one identifiable person's visit,
and a spreadsheet of those leaves the clinic on a laptop. A count per day,
practitioner, type and status answers every operational question an
administrator actually asks and identifies nobody — so section 90's "if a
report genuinely needs patient identifiers it must be separately authorized"
does not arise. That report does not exist.

**CSV injection is guarded.** A cell beginning `=`, `+`, `-`, `@`, a tab or a
carriage return is a formula to a spreadsheet, and `=HYPERLINK(...)` is a
phishing link that runs when somebody opens a file their own clinic sent them.
One field in the report is not a developer-authored constant — the
practitioner's display name — so every value is prefixed rather than the one
that looks risky today.

**The export is audited** (section 48): who, which report, when, and whether
the scope was narrowed. Not what was in it, and not to whom it was narrowed —
a practitioner id in an audit line is an identifier the record does not need.

Only CSV. Section 85: implement only the formats actually required, and do not
build a reporting engine.

---

### 7. Privacy

```text
Clinical data excluded:      No function selects diagnosis,
                             chief_complaint, history_of_presenting_concern,
                             symptoms, clinical_observations, assessment,
                             doctor_notes, follow_up_notes, a medicine name, a
                             dose, item instructions, a plan title, a document
                             title, a file name, a storage path, a checksum, a
                             notification title, a notification body, a
                             cancellation reason, a patient note or an internal
                             note. Asserted against the migration text.

Patient identifiers minimized: There is **no patient identifier in any return
                             type**, and no `p_patient_id` parameter anywhere
                             in the migration — so section 59's enumeration API
                             cannot be built from these parts. The only name
                             that appears is a practitioner's professional
                             display name, which is already on the diary.

Logging:                     An operation, an opaque user id and a failure
                             category. Never a figure, a name, a period's
                             contents or the provider's message. Asserted by an
                             **allowlist** over every identifier in every
                             `logger.*` call in the feature, scanned with a
                             bracket counter rather than a regex. A successful
                             dashboard read logs nothing at all.

Caching:                     **Nothing is cached across requests.** No
                             `unstable_cache`, no `revalidate`, no module-level
                             memo — asserted by test. Sections 33-34 permit
                             short-lived caching and then spend two sections on
                             keying it safely; a cache that does not exist
                             cannot leak a scope, freshness is then absolute,
                             and the queries are cheap. If one is ever added it
                             must be keyed on the authorized scope plus the
                             range, and that assertion is what forces it to be
                             a deliberate change.

Export protection:           Authenticated POST only, `reports.export` checked
                             in the application and `assert_report_exporter()`
                             in the database, five approved columns read
                             through a fixed contract, bounded period, safe
                             filename, `private, no-store`, `nosniff`, and no
                             GET download URL at all (405, verified live).
```

Every authenticated analytics page is `noindex`, `private, no-store`, and
`/admin`, `/receptionist` and `/doctor` are already disallowed in
`robots.txt` — all verified live.

---

### 8. Performance

```text
Representative query performance (live, ap-northeast-1 from India):

  1-week    summary 209 ms · trend 199 ms · workload 183 ms · patients 207 ms
  3-month   summary 211 ms · trend 202 ms · workload 214 ms · patients 207 ms
  1-year    summary 203 ms · trend 199 ms · workload 206 ms · patients 207 ms

N+1 issues:  None. Five RPCs serve the six-panel clinic dashboard and three
             serve the practitioner's, asserted by counting the calls. The
             workload report — the one that invites "list practitioners, then
             query appointments for each" — is a single grouped scan joined to
             one utilization pass.

Indexes:     Seven added, each named after the column an aggregate range-scans;
             four existing ones reused. No index added that no query here uses,
             asserted by test.

Caching:     None. See Privacy above for the reasoning.
```

The figures are flat across a 52× difference in period length, which is the
result worth reading: the queries themselves are negligible against the
round trip, so the bounded ranges and the indexes are doing their job. That
also means these numbers are a **latency floor rather than a query
measurement** — see *Known issues*.

Aggregation happens in PostgreSQL throughout. Nothing in this feature fetches
rows and counts them; the largest payload any read receives is one row per
practitioner or one row per trend bucket, both bounded by construction. A
structural test asserts the feature contains no `.from(` table read at all.

---

### 9. Design system

One new token family, added properly rather than as a one-off colour.

`--chart-series: #355A49` (`--punarvasu-primary-600`) and
`--chart-track: #F4E7C8`. A data mark is its own role and deliberately not
`--primary`: that token is the button fill, the link, the icon and the focus
ring, and a page of bars painted in it reads as a row of controls somebody
could press. One step lighter separates them without leaving the brand ramp.

Both are mirrored in `src/lib/design/palette.ts` and carry **four new SC
1.4.11 assertions** in `contrast.test.ts` — series on card, on background, on
muted, and on its own track — because a bar is a non-text graphical object
that conveys the information the chart exists to convey.

There is exactly **one** series colour, because every chart in the product
plots one series. A second would be the point at which a categorical ramp is
designed deliberately, chosen for colour-vision separation and validated as a
set, rather than a second green picked because it was next in the list.

The chart form was chosen by running the palette validator rather than by
eye: every step of the Punarvasu green ramp fails a categorical chroma floor,
because the brand is a restrained earthy green. That check is scoped to
categorical palettes — with one series there is nothing to distinguish it from
— but it correctly flagged `--primary` itself as too dark to read as data,
which is how the lighter step was chosen.

---

### 10. The chart, and its accessibility

Sections 66, 68 and 70. A bar chart, one series, and a **real table always
rendered beside it**.

* The `<svg>` is `aria-hidden`: it is a redundant presentation of the table
  beneath it, and exposing both would read the same numbers twice.
* The table is a real `<table>` with a caption, column headers and a named,
  focusable scroll region. Not hidden, not behind a control that has to be
  found first — inside a native `<details>`, open by default.
* A **visible one-sentence summary** states the total, the period and the
  busiest bucket, so the shape of the data is available to somebody who never
  sees the bars.
* Every bar carries an SVG `<title>`, which browsers show on hover and which
  costs no JavaScript. It supplements the axis and the table; nothing is
  available only through it.
* Colour carries nothing. One hue; height carries the magnitude. An empty
  bucket draws a visible stub in the track colour rather than a gap the eye
  closes up.
* Axis labels are selective — first, last and peak — because thirty-one dates
  along a phone-width axis is an unreadable smear and the table has every one.
  One direct value label, on the peak.

**One series, deliberately.** The completed / cancelled / no-show split is a
composition question, answered precisely by the figures above the chart and
exactly by the table below it. Stacking three segments would introduce a
categorical palette — three hues that must be separable under colour-vision
deficiency — to answer a question two other elements already answer better.

**No crosshair-and-tooltip layer**, which is a deliberate departure from a
general charting default. It would make this a client component, in a
workspace where every other panel is server-rendered, to provide a value the
table already provides exactly — and sections 66 and 70 both point the other
way for this product.

---

### 11. Defects found and fixed

Both real defects were found by verification. Neither was visible to the type
checker, to ESLint, or to review.

**1. The "records begin here" date floor made a preset permanently unusable.**
*(found by a test I had just written against my own design)*

`analytics_range_rules()` originally set `earliest_date` to `2026-01-01`, on
the reasoning that no domain row predates the first migration. But
"last 12 months" from September 2026 reaches back to September 2025, so the
preset refused itself — and would have gone on doing so for a year after
launch.

The floor was doing the wrong job. `max_range_days` is what actually bounds
the scan: a period is at most a year however early it starts. The floor is a
*sanity* floor underneath it and nothing more, and it is now `2020-01-01`,
with both the migration and the config saying which of the two is load-bearing.

The lesson worth keeping: a bound chosen for tidiness rather than for a
threat becomes a feature nobody can use.

**2. A docblock overstated which layer was doing the work.**
*(found by the live HTTP pass)*

`src/app/api/reports/appointments/route.ts` claimed that a form field carrying
`columns`, `patientId` or a report id is "**rejected** by `strict()` rather
than dropped". It is not. The handler copies three named fields out of the
body and ignores the rest, so an extra input is never *read* — dropped at the
first layer, and `strict()` never sees it. A `POST` with `columns=diagnosis`
returns 200 and has no effect whatever.

The behaviour is correct and was always intended; the comment was wrong. That
matters because **Phase 08 shipped this exact inaccurate claim** and had to
correct it, and a comment that overstates a control is how somebody later
removes the control that is actually doing the work. The docblock now names
all three layers and says which protects what, and `validation.test.ts`
asserts the real behaviour of each.

**3. A pre-existing lint failure from Phase 15, blocking the gate.**

`npx eslint . --max-warnings=0` failed on
`markAllNotificationsReadAction`'s unused `_previousState`. Ten other server
actions use the same name and do not warn, because ESLint's default
`args: "after-used"` permits an unused parameter whenever a *later* one is
used — and that action is the only one taking no form data, so its unused
parameter is also its last.

Phase 15's progress document records `npx eslint . --max-warnings=0` as
passing. It does not, at least not now. The convention the codebase already
relies on is now encoded in `eslint.config.mjs` as `argsIgnorePattern: "^_"`,
with `caughtErrors` left at its default because an unused caught error is a
swallowed exception rather than a convention.

#### Tool-induced corruption, reintroduced and cleaned up

Patching files through Python's text mode rewrote fifteen source files from
LF to CRLF, which silently broke a mirror test: a regex anchored on `)\n` no
longer matched, so an assertion about the export contract **passed
vacuously**. That is the same failure class Phase 06 recorded (a formatter
rewriting unicode escapes into raw control bytes), Phase 14 recorded twice
(two security assertions matching nothing for four phases), and Phase 15
recorded once (a template literal consuming `\b`).

All fifteen files were normalised back to LF, and the mirror tests now
normalise line endings before matching, with a comment saying why. The
repository's remaining CRLF files are author-written Markdown, unchanged.

#### Six harness bugs, recorded because a report listing only what passed is not evidence

* **A clinical-word scan flagged the site footer.** The footer carries the
  medical disclaimer `AGENTS.md` section 15 requires — "not a substitute for
  professional **diagnosis**, treatment or emergency care" — so a body-wide
  scan flagged the very sentence that keeps the product responsible. Phase 12
  recorded this identically. The scan now reads `<main>`.
* **A filter-echo check flagged Next.js's RSC flight payload**, which carries
  the route's own URL — the URL the browser already has, read by nothing. The
  hostile value reaches no rendered element. Phase 06's harness reported the
  same thing as an open redirect.
* **Three source scans flagged the modules' own documentation.**
  `validation.ts` explains why it has no `patientId`; the migration header
  lists every clinical column to say it uses none. Scanning the raw text made
  each file fail for documenting itself, which would pressure a future author
  to delete the explanation rather than the field. All such scans now strip
  comments.
* **`p_role` matched inside `has_app_role`.** A substring scan reported the
  authorization check as an authorization hole. Word-boundary matched now.
* **A log-call scan captured surrounding code.** A regex stopping at the first
  `)` captures a fragment and one stopping at the last captures the rest of
  the file; the scan now walks brackets, and the deny-list was replaced with
  an **allowlist** of every identifier a log call may name.
* **Three component assertions were over-broad** — `getByText` where two
  elements legitimately matched. Scoped rather than relaxed.

---

### 12. Verification

Executed on 2026-09-19:

```text
Lint:       PASS — npx eslint . --max-warnings=0, 0 problems
Typecheck:  PASS — npm run typecheck, exit 0
Tests:      PASS — 3,799 tests, 116 files (was 3,388 / 107)
Build:      PASS — npx next build, compiled with no warnings
```

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 3,799 / 116 files** |
| Production build | `npx next build` | **PASS** — all 30 public pages still static; the 3 analytics routes and the export route dynamic |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 179 files, 0 findings |
| Contrast (SC 1.4.11) | `contrast.test.ts` | **PASS** — 121 assertions, 4 new |
| Migration | `supabase db push` | **PASS** — applied to the linked project, PostgreSQL 17 |
| **Live database** | 155 checks, real per-role JWTs | **PASS — 155/155** |
| **Live HTTP** | 101 checks, production build, 5 actors | **PASS — 101/101** |
| Component axe (jsdom) | included in the suite | **PASS** — 0 violations |
| **Live browser (rendered, measured)** | — | **NOT RUN** — see *Known issues* |
| E2E | — | **NOT RUN** — no maintained E2E tool (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

#### Live database — 155 checks, real per-role JWTs

Signed in as each seeded account with the anon key, so every check went
through the real function gates with a real `auth.uid()`. No service-role key
was used.

| Area | Result |
| --- | --- |
| **`anon` cannot call any of the 13 public functions** | PASS (13) |
| **A patient cannot call any of the 13** | PASS (13) |
| A receptionist can call the 5 operational functions | PASS (5) |
| **A receptionist cannot call the 4 clinic-only, the 3 practice or the export** | PASS (8) |
| A doctor can call their own 3 | PASS (3) |
| **A doctor cannot call the 5 operational, the 4 clinic-only or the export** | PASS (10) |
| An administrator can call the 5 operational, the 4 clinic-only and the export | PASS (10) |
| **An administrator cannot call a practitioner's own analytics** | PASS |
| **No role — anon, patient, receptionist, doctor, admin — can call any of the 12 internal functions** | PASS (60) |
| A reversed period is refused (`PV060`) | PASS |
| A period over a year is refused (`PV061`) | PASS |
| A period before the floor is refused (`PV062`) | PASS |
| A period of exactly a year is accepted | PASS |
| **A SQL fragment in a date parameter is refused, and the appointments table survives** | PASS (2) |
| A malformed practitioner id is refused | PASS |
| The summary returns exactly nine counts, and `eligible` is the sum of its three parts | PASS (3) |
| **The workload report carries no patient identifier** | PASS |
| **Utilisation cannot exceed 100%, and neither figure is negative** | PASS (2) |
| **The delivery summary declares no `delivered` count** | PASS |
| **The export returns exactly the five approved columns and no patient identifier** | PASS (2) |
| A 30-day period yields 30 daily buckets, first and last inclusive | PASS (3) |
| A year yields 12 monthly buckets; three months yields weekly | PASS (2) |
| Every aggregate succeeds over 1 week, 3 months and 1 year | PASS (12) |
| Regressions: a receptionist reads no clinical record; a patient reads their own appointments and exactly their own record | PASS (3) |

#### Live HTTP — 101 checks, production build

| Area | Result |
| --- | --- |
| An anonymous visitor is redirected to sign-in from all three routes | PASS (6) |
| **The full 4 × 3 actor/route grid behaves as the permission matrix says** | PASS |
| **No route hit an error boundary for any actor** — the Phase 10 render-crash check | PASS (12) |
| Each refusal names no role, no permission and no policy | PASS |
| The dashboard shows no diagnosis, clinical column, storage path, signed URL or email address | PASS (7) |
| The dashboard is `private, no-store` and `noindex` | PASS (2) |
| The period, the denominator note and the clinical privacy note are on the page | PASS |
| A too-long period is **reported**, not silently replaced | PASS |
| An unexpected filter does not break the page and reaches no rendered element | PASS (2) |
| **A patient, a receptionist and a doctor cannot export** (403) | PASS (3) |
| An anonymous export request is refused | PASS |
| **An administrator's export returns a CSV attachment** with the five approved headers, the right filename, `no-store`, and no patient identifier | PASS (6) |
| An over-long or malformed export period is refused (400) | PASS (2) |
| An export naming extra columns ignores them, and the file still carries exactly five headers | PASS (2) |
| **There is no GET download URL** (405) | PASS |
| Regressions: `/`, `/services`, `/contact`, `/receptionist`, `/doctor` all render with no error boundary | PASS (10) |
| The analytics link is offered exactly where the guard admits | PASS (2) |
| `robots.txt` disallows all three areas | PASS (3) |

The export produced a real six-line CSV from live data.

#### Automated — 3,799 tests, up from 3,388

| File | Count | Covers |
| --- | --- | --- |
| `src/config/analytics.test.ts` | 15 | The bounds, the floor and both granularity thresholds **against the migration**; every preset inside the bounds; the export contract against the RPC's own `returns table`; and that no export column names a patient |
| `src/features/analytics/metrics.test.ts` | 41 | Section 98's fixture — 10 appointments, 6 completed, 2 cancelled, 1 no-show, 1 pending — with every metric and denominator verified by hand; six of **nine**, not six of ten; the three rates summing to 1; zero versus missing in both directions; the data-quality guard; and that no formula makes a clinical claim |
| `src/features/analytics/ranges.test.ts` | 41 | Midnight in the clinic's zone versus UTC's; month and year boundaries; Monday weeks; February in a leap year; both ends inclusive; the bound exactly at 366; and that every preset and every fallback resolves to a period the database accepts |
| `src/features/analytics/validation.test.ts` | 26 | Twenty-two hostile fields one at a time on three schemas, **rejected rather than dropped**; no practitioner field on the practice schema; no format, column list or report id on the export; and which of the three layers actually stops a posted form field |
| `src/features/analytics/errors.test.ts` | 12 | Every raised SQLSTATE recognised and none declared that is not raised; a disjoint range; and that no function, table, policy, SQLSTATE or SQL fragment reaches a reader |
| `src/features/analytics/export.test.ts` | 15 | Formula-prefix neutralisation for all six characters; RFC 4180 quoting; the BOM; and that a row carrying a smuggled `patientName` or `diagnosis` produces the same five fields |
| `tests/integration/analytics-queries.test.ts` | 38 | Every role against every read; the exact RPC argument lists; **no practitioner id on the practice reads**; a failed panel not blocking the others; implausible counts refused; and an **allowlist** over every identifier in every log call |
| `tests/integration/analytics-security.test.ts` | 147 | The database's guarantees against the migration: no table, policy, trigger or replaced function; every reachable function gated in its body and bounding its range; every internal function revoked from `public, anon, authenticated` and granted to nobody; `search_path` pinned; no dynamic SQL; no patient, clinic, column or sort parameter; no clinical column selected; and the application layer's own no-table-write, no-service-role, no-cache properties |
| `tests/components/analytics.test.tsx` | 54 | The chart's table alternative, hidden SVG, visible summary and native titles; zero versus missing in four places; the four panel states; nothing clinical or identifying; the acceptance caveat; one form per form carrying exactly its own fields; markup rendered as text; and axe |
| `src/lib/design/contrast.test.ts` | +4 | The chart tokens against SC 1.4.11's 3:1 on every surface they can sit on |

---

### 13. Acceptance criteria

#### Analytics

| Criterion | Result |
| --- | --- |
| Authorized analytics dashboard exists | PASS — three, one per audience |
| Role-based analytics access works | PASS — the full grid verified live, twice |
| Practitioner scope is enforced | PASS — **no practitioner parameter exists**; resolved from `auth.uid()` |
| Appointment metrics work | PASS — live |
| Appointment trends work | PASS — live, with correct bucket counts at three granularities |
| Cancellation metrics work | PASS |
| No-show metrics work | PASS |
| Completion metrics work | PASS |
| Patient growth metrics work where defined | PASS — three definitions, each written down before implementation |
| Notification delivery metrics work where applicable | PASS — Phase 15's own states, with no `delivered` invented |
| Prescription/treatment aggregate metrics exist only where justified | PASS — four counts, administrator only, with the privacy note on the page |

#### Metrics

| Criterion | Result |
| --- | --- |
| Metric definitions are centralized | PASS — `features/analytics/metrics.ts`, rendered on the page |
| Dashboard and report calculations are consistent | PASS — one metric layer; the export reads the same authorized interface |
| Zero vs missing data is handled correctly | PASS — `null` rates render words, never 0%; asserted in both directions |
| Date boundaries are correct | PASS — 41 boundary tests, plus live bucket counts |
| Timezone is correct | PASS — Phase 09's `clinic_timezone()` throughout; no ISO slicing anywhere |
| Date ranges are bounded | PASS — in the database and in the application; three codes |
| Aggregations happen server/database side | PASS — no table read in the feature at all, asserted |

#### Authorization

| Criterion | Result |
| --- | --- |
| Admin access is correct | PASS — live |
| Receptionist scope is correct | PASS — operational only; refused the clinic-only four, the practice three and the export |
| Doctor scope is correct | PASS — their own three only |
| Patient cannot access internal analytics | PASS — refused all 13 public and all 12 internal functions, live |
| IDOR tests pass | PASS — there is no practitioner, patient, clinic, report or export id to substitute |
| Clinic/practitioner scope cannot be manipulated | PASS — no such parameter exists; a malformed practitioner filter is refused |

#### Privacy

| Criterion | Result |
| --- | --- |
| General analytics do not expose clinical notes | PASS — no such column is selected anywhere |
| Diagnoses are not unnecessarily queried | PASS — `diagnosis_or_clinical_impression` appears in no query |
| Prescription details are not unnecessarily exposed | PASS — a count of prescriptions, never a medicine or a dose |
| Document contents are not exposed | PASS — a count and a kind; no title, path or file name |
| Patient identifiers are minimized | PASS — there is none in any return type |
| Sensitive data is not logged | PASS — asserted by an allowlist over every log call |
| Analytics responses contain only required fields | PASS — verified live against the real shapes |

#### Reports

| Criterion | Result |
| --- | --- |
| Required reports exist | PASS — one, defined once |
| Export permissions are enforced | PASS — separate permission; three roles refused live (403) |
| Exports contain only approved fields | PASS — a fixed column contract; verified live |
| Exports are securely generated | PASS — server-side, authenticated, `no-store`, `nosniff` |
| No public export URLs exist | PASS — POST only; a GET returns 405, verified live |

#### Performance

| Criterion | Result |
| --- | --- |
| Analytics queries are bounded | PASS — 366 days maximum, enforced in the database |
| No major N+1 queries exist | PASS — five RPCs for six panels; asserted by counting |
| Appropriate indexes exist | PASS — seven added, four reused, none speculative |
| Large datasets are aggregated server-side | PASS — the feature performs no table read |
| Dashboard load is acceptable | PASS — ~200 ms per aggregate, flat from one week to one year |

#### UX

| Criterion | Result |
| --- | --- |
| Dashboard is responsive | PASS by construction — cards below `md`, tables above, no fixed pixel widths. **Not pixel-verified**; see *Known issues* |
| Charts are accessible | PASS — hidden SVG, always-present table, visible summary, no colour-only meaning, no hover-only value; axe clean in jsdom |
| Tables are readable | PASS — caption, `scope="col"`, named focusable scroller, tabular figures |
| Loading states exist | PASS — three structured skeletons |
| Empty states exist | PASS — and distinguished from failures everywhere |
| Error states exist | PASS — a failed panel offers a retry; a refused one renders nothing |
| Date filtering works | PASS — live, including the rejected-period notice |
| Punarvasu design system is used | PASS — tokens only; one new token family, added properly and contrast-verified |

#### Engineering

| Criterion | Result |
| --- | --- |
| Phase 08 authorization is reused | PASS — no second mechanism; four permissions in the one table |
| Phase 09 appointment definitions are reused | PASS — the timezone layer, `holdsSlot`, the availability and blocked-period model, `clinic_timezone()` |
| Phase 15 notification delivery states are reused | PASS — read as they are; no `delivered` invented |
| No duplicate domain state is introduced | PASS — no table, no column, no enum |
| TypeScript remains strict | PASS — no `any` added |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

Authorized staff can now answer, without exposing clinical information:

```text
How many appointments did we have this month?       the summary panel
How many were completed / cancelled / no-shows?     the same, with counts
How is appointment volume trending?                 the trend, bucketed
How is practitioner workload trending?              the workload table
How many new patients joined?                       the patient panel
How are notifications being delivered?              the sending panel, honestly
```

And the separations hold, each verified live:

```text
Operational Analytics  ≠  Clinical Record    — no clinical column is selected
                       ≠  Patient Document   — a count and a kind, nothing more
                       ≠  Notification Content — no title, no body, no recipient

Patient        ✕ internal analytics     — refused all 25 functions
Receptionist   ✕ clinical activity      — refused; no policy, no gate
Doctor         ✕ another's or the clinic's — no parameter exists
Admin          ✕ a practitioner's own   — resolves to nobody
anon           ✕ everything             — no grant at all
```

Analytics is read-only with respect to the domain — a property of the diff,
not an intention: the migration contains no `insert`, no `update`, no
`delete`, no table, no trigger and no policy.

---

### 14. Deferred

Intentionally not built, per section 125:

* **Clinical outcome, diagnosis and disease-prevalence analytics.** No column,
  no query, no surface. The dashboard says so to the reader.
* **Medicine effectiveness and prescribing-pattern analysis.** Section 37: a
  count of prescriptions issued, never a medicine-level pattern.
* **Automated clinical quality scoring and practitioner clinical ranking.**
  Section 20. The workload table has no clinical column to rank by.
* **AI-generated insights and predictive analytics.** Phase 17 owns AI
  clinical decision support. No model, no key, no call.
* **Patient risk scoring and automated diagnosis.** Neither exists.
* **Marketing campaign analytics.** There is no marketing anything in this
  product, and Phase 15 made adding one a migration.
* **Financial and accounting analytics.** Nothing in the product records a
  price: Phase 09 deliberately gave `appointment_types` no price column.
* **A full BI or data-warehouse layer, and any arbitrary-SQL reporting
  interface.** Section 61. There is no generic query endpoint and no parameter
  that could become one.
* **Materialized views.** Section 31; reasoned above, and the wrappers are
  where one would go behind an unchanged signature.
* **A patient-facing personal statistics page** (section 49). The patient
  portal already shows their own appointments, prescriptions, treatment plans
  and documents; a statistics page would be a new product surface rather than
  analytics, and nobody has asked for one.
* **Filter persistence** (section 74). The period is already in the URL, which
  makes a view shareable and bookmarkable without storing anything.
* **XLSX and PDF export.** Section 85: only the formats actually required.
* **A second chart series and a categorical ramp.** When one is needed, the
  ramp gets designed and validated deliberately.
* **Moving `ProfileSection`/`ProfileFieldList`/`ProfileField` to
  `components/shared/`.** Eight areas depend on them; still its own change.

---

### 15. Known issues

1. **No *measured* browser verification was run for this phase.** The 101 HTTP
   checks prove every route renders, authorizes and returns what it should —
   which is the check that catches a server render crash, and it is more than
   Phases 10, 13 and 15 did. But the component suite's axe sweeps run in
   jsdom, which has no layout engine and therefore no computed colours, so
   **horizontal overflow at 320px and real focus order on the three new routes
   are unverified**. Phase 08 found a 35px overflow, Phase 09 a 3.89:1
   contrast failure and Phase 11 a duplicate landmark that nothing but a real
   browser could see.

   The chart and the workload table are the two layouts most likely to
   overflow a narrow screen, and both should have that check before the
   dashboards are relied on. Contrast itself *is* covered — the new tokens
   carry four SC 1.4.11 assertions against the real hex values.

2. **The performance figures are a latency floor, not a query measurement.**
   Every aggregate returned in about 200 ms from India to `ap-northeast-1`,
   flat across a 52× difference in period length, which says the queries are
   negligible against the round trip — on **this** database, which holds a
   handful of appointments. Section 123 asks for realistic clinic data
   volume, and this project does not have any. The queries are bounded and
   indexed by construction; they have not been measured against a year of a
   busy clinic.

3. **`analytics.read.clinic` and `reports.export` are the same role check
   today.** Two gates, two permissions, one predicate — deliberately, so that
   changing who may export is one function body rather than a widening of who
   may read. It is worth knowing that the separation is currently structural
   rather than behavioural.

4. **The receptionist/administrator split is a product decision the clinic
   should confirm.** The front desk sees appointment and patient-growth
   figures and not notification delivery or clinical activity. The reasoning
   is recorded in the migration and in `config/permissions.ts`; moving a
   capability is an edit to one gate and one list.

5. **No audit of analytics *reads*.** The export is audited (who, what, when,
   scope). A dashboard being viewed is not recorded, and a successful read
   logs nothing at all — deliberately, because a log line per panel would bury
   the failures. If administrative *access* to aggregate figures ever needs an
   audit trail, that belongs with Phase 19.

6. **The dashboards show a development clinic's data.** The seeded
   practitioner is still named "Test Doctor", and the consultation types,
   durations and booking rules remain provisional from Phase 09. The figures
   are correct; the clinic behind them is not real yet.

7. **`src/types/database.ts` is still hand-written**, deliberately.
   `npm run db:types` would overwrite it with generated output whose `Insert`
   and `Update` shapes are permissive; the hand-written file types them
   `never`, which makes a client table write a compile error. Only the
   **public** analytics functions are declared — the internal twelve are
   omitted on purpose, so calling one from the application does not
   type-check either.

8. **The four Phase 08 test accounts remain on the development project.**
   Shared, well-known credentials, including an administrator. **Delete them
   before this database takes real patient data.**

9. **No E2E tool, no manual screen-reader pass, no Lighthouse run.** Unchanged
   since Phase 01/02. The 256 live checks are a script written for this phase,
   not a maintained suite.

10. **Still no CSP.** Unchanged since Phase 02.

11. **Legal pages still do not exist.** Required before the clinic handles
    real records through this website.

---

### 16. Phase status

```text
Phase 16: COMPLETE
Ready for Phase 17: YES
```

Phase 17 has not been started.

AI clinical decision support can be built without changing anything here.
Analytics deliberately shares nothing with it: this phase reads **operational
aggregates** and never a clinical field, while Phase 17 reads the clinical
record itself and is constrained by `docs/HEALTHCARE_AND_AI_SAFETY.md`. The
two should not be joined — a dashboard figure derived from a model's output
would be a clinical claim wearing an operational number's clothes.

Three things to carry forward:

* **The grant pattern is now settled and asserted.** A new `security definer`
  function must revoke from `public, anon` by name, grant only what it means
  to, and carry its gate in the body. `analytics-security.test.ts` asserts all
  three for this phase's 25 functions and is the template for Phase 17's.
* **`assert_care_practitioner()` is the gate Phase 17 will want**, and the
  no-practitioner-parameter shape is the pattern that has held since Phase 11.
* **The browser pass this phase did not run should be run before Phase 17 adds
  more surface to it.** Phase 13 recorded the same thing, Phase 14 closed it,
  Phase 15 reopened it. It compounds.
