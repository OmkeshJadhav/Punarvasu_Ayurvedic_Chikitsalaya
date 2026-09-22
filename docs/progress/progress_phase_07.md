## PHASE 07 — Patient Profile & Onboarding

Status:
COMPLETED — verified against the live Supabase project and in a real browser

Completed On:
2026-09-18

Summary:
Built the patient's own record on top of the Phase 06 identity: the `patients`
table with its policies, a typed domain model, validation that runs on both
sides of the trust boundary, a query layer that cannot be handed a user id, one
server action for create and update, and the patient area at `/patient` and
`/patient/profile` — onboarding, view, edit, and a completeness indicator that
is calculated rather than stored.

The profile is **demographic and administrative information, not the medical
record**. No column, field, schema key or form control exists for a diagnosis,
a symptom, a medication, an allergy, a history or a note, and the schema
rejects a request that carries one rather than silently dropping it.

1,064 tests pass, up from 865. 43 live checks against the real database cover
every policy, grant, constraint and trigger, including cross-user access. 58
live browser checks drive the real forms end to end.

**Two real defects were found only by driving the built application in a
browser, and neither was visible to the test suite, to ESLint or to review.**
One of them put a patient's name, date of birth, phone number and address into
the URL. Both are fixed and regression-tested; both are described in full
below, because the class of each is worth remembering.

---

### Repository assessment before starting

Phase 06 left a working identity foundation. Reused rather than rebuilt:
`requireUser()` and `getCurrentUser()`, the `(app)` route group and its
`force-dynamic` guard, `src/proxy.ts` and `PROTECTED_PATH_PREFIXES` (which
already listed `/patient`), the Supabase server client, `AppError`, the
structured logger with its redaction, the shared validation primitives,
`Field`, `Input`, `Button`, `Alert`, `Card`, `Dialog`, `Toast`, `Container`,
`Section`, `NavLink`, `EmptyState`, `ErrorState` and the loading skeletons.

Four findings shaped the work:

* **`docs/DATABASE.md` §4.2 already names this entity `patients`**, keyed to
  `profiles.id` through a nullable `profile_id`, and every later table in that
  document references `patient_id`. `phase_07.md` §56 offers `patient_profiles`
  as *a possible name* and defers to an established architecture. One was
  established, so the table is `patients` — naming it otherwise would mean a
  rename, or two vocabularies, the moment appointments land.
* **`PROTECTED_PATH_PREFIXES` already contained `/patient`**, and `robots.txt`
  already disallowed it. Phase 06 listed both ahead of the feature precisely so
  this phase would inherit protection rather than have to remember it. Nothing
  in either file needed changing.
* **`SiteHeader`'s `accountSlot` and the `(app)` shell were ready**; the patient
  area needed a navigation bar and nothing else from the chrome.
* **`Toaster` was built in Phase 02 but mounted nowhere** outside the
  design-system gallery. It is now mounted in the `(app)` layout.

---

### Routes

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/patient` | Dynamic | Patient area overview: completeness, a way into the profile, an honest statement of what is not built |
| `/patient/profile` | Dynamic | Onboarding, view and edit |
| `/patient/profile` (loading) | — | Structured skeleton in the shape of the page |

Both sit inside the existing `(app)` route group, so they inherit
`requireUser()`, `force-dynamic` and `robots: noindex`. `/account` gained a
card linking into the patient area — a link, not a redirect, because
`phase_07.md` §6 is explicit that not every authenticated user should be
assumed to be a patient, and sending a doctor's first sign-in to a patient
onboarding form would be that assumption made silently.

No route takes a parameter, and no page reads anything from the query string.

---

### Files added

```text
supabase/migrations/20260918120000_patient_profile.sql
src/features/patients/{types,validation,completeness,queries,actions,content,format}.ts
src/features/patients/{validation,completeness,format}.test.ts
src/components/patient/{profile-section,profile-summary,profile-form,profile-editor,
                        profile-completeness,patient-nav}.tsx
src/components/patient/use-unsaved-changes-warning.ts
src/components/ui/native-select.tsx
src/app/(app)/patient/layout.tsx
src/app/(app)/patient/page.tsx
src/app/(app)/patient/profile/page.tsx
src/app/(app)/patient/profile/loading.tsx
tests/integration/patient-profile.test.ts
tests/components/patient-profile.test.tsx
docs/progress/progress_phase_07.md
```

### Files modified

```text
src/types/database.ts              patients Row/Insert/Update, mirroring the grants
src/app/(app)/layout.tsx           mounts <Toaster>
src/app/(app)/account/page.tsx     a card linking into the patient area
src/config/navigation.ts           NavItem.match
src/components/layout/nav-link.tsx isCurrentPath takes a match mode
tests/components/navigation.test.tsx  regression for exact matching
docs/ARCHITECTURE.md               §1.1 state, §5.3 patient module implementation
docs/DATABASE.md                   §4.2 marked implemented
docs/DESIGN_SYSTEM.md              NativeSelect, components/patient/ index
docs/QA_STRATEGY.md                Phase 07 coverage
docs/PUNARVASU_MASTER_SPEC.md      status, areas, phase placeholders
```

### Dependencies

**None added.** No form library, no date picker, no state manager, no
validation library beyond the Zod already present.

---

### Database

`supabase/migrations/20260918120000_patient_profile.sql`, applied to the live
project with `supabase db push`.

#### Schema

`public.patients` — 18 columns, verified against the live database:

```text
id                              uuid, pk, default gen_random_uuid()
profile_id                      uuid, nullable, -> public.profiles(id) on delete cascade
full_name                       text, NOT NULL          <- the only required field
preferred_name                  text
phone                           text
date_of_birth                   date                    <- a date, not a string
gender                          text, check-constrained
address_line1                   text
address_line2                   text
city                            text
state                           text
postal_code                     text
emergency_contact_name          text
emergency_contact_relationship  text
emergency_contact_phone         text
preferred_language              text
created_at                      timestamptz, default now()
updated_at                      timestamptz, default now()
```

**There is no clinical column, and none may be added.** Verified live: an
update naming `diagnosis`, `symptoms`, `medications`, `allergies`,
`medical_history`, `prescription` or `notes` is rejected by the database
because the column does not exist.

There is no `age` column — age is derived, because a stored one is wrong
within a year. There is no `profile_completion` column — completeness is
calculated, because a stored percentage is wrong the moment the rules change.

#### Why `profile_id` is nullable

`DATABASE.md` §4.2 is explicit: a patient may exist before a login does,
because a receptionist registers a walk-in, and the link is claimed later.
Nothing in this phase creates an unlinked row — there is no staff surface yet —
but the column is shaped for it now so that the phase which adds one is not a
migration of live patient data.

Uniqueness is therefore a **partial** unique index
(`patients_profile_id_key on (profile_id) where profile_id is not null`), which
holds "at most one patient record per user" while leaving many unlinked
walk-in records possible. It is the only index: it enforces the constraint and
serves the only query this phase makes. Staff search indexes belong to the
phase that builds staff search.

#### Constraints

Length bounds on every text column; `gender` restricted to `female`, `male`,
`other`, `undisclosed`; `date_of_birth >= 1900-01-01`.

"Not in the future" could not be a check constraint — PostgreSQL requires check
expressions to be immutable and `current_date` is not — so it is a
`before insert or update` trigger instead. Verified live: tomorrow's date is
refused by the database, not merely by the form.

#### Triggers

| Trigger | Purpose |
| --- | --- |
| `patients_set_updated_at` | Reuses `public.set_updated_at()` from Phase 06. The timestamp is the database's; a client cannot supply one. Verified live: it moved on update, and a client-supplied value was refused |
| `patients_guard_ownership` | Raises if `id` or `profile_id` changes on update for a non-privileged caller. The second layer behind the column-scoped grant |
| `patients_validate_date_of_birth` | Refuses a future date of birth |

#### RLS

Enabled with no permissive default. Policies are per operation, never
`for all`.

| Operation | Policy | Behaviour |
| --- | --- | --- |
| `SELECT` | `patients_select_own` | `profile_id is not null and profile_id = auth.uid()`. The owner, their own row, nothing else |
| `INSERT` | `patients_insert_own` | Same predicate as `with check`. A client cannot create a record belonging to anybody else, or an unowned one |
| `UPDATE` | `patients_update_own` | Same predicate in **both** `using` and `with check` — without the latter a row could pass on the way in and be written pointing elsewhere |
| `DELETE` | **none** | Nobody. Healthcare records carry retention and legal implications that have not been settled (`phase_07.md` §16, `DATABASE.md` §13). An account removed through Supabase Auth still cascades |

Receptionist, doctor and admin access are deliberately absent
(`phase_07.md` §§91–92). They belong with the permission matrix and the audit
trail that make them accountable — Phase 08.

#### Grants

`anon` receives nothing at all: a signed-out request has no business reading
any patient record, and expressing that through RLS alone would be one policy
edit away from a leak.

`insert` and `update` are granted **column by column**. The effect of the
`update` list is that `id`, `profile_id`, `created_at` and `updated_at` are
unreachable for an ordinary caller — the field allowlist of `phase_07.md`
§§49–50 expressed in the database rather than only in application code.

---

### Profile model

```ts
interface PatientProfile {
  readonly fullName: string;              // the only always-present field
  readonly preferredName: string | null;
  readonly phone: string | null;          // ten digits, normalised
  readonly dateOfBirth: string | null;    // ISO YYYY-MM-DD, a calendar date
  readonly gender: PatientGender | null;  // female | male | other | undisclosed
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly emergencyContactName: string | null;
  readonly emergencyContactRelationship: string | null;
  readonly emergencyContactPhone: string | null;
  readonly preferredLanguage: string | null;
  readonly createdAt: string;             // the only timestamp that reaches the UI
}
```

`id`, `profile_id` and `updated_at` are **not** in the model. They are internal
identifiers and operational metadata, and two of them are things a patient
should never be shown (`phase_07.md` §41).

A read returns a discriminated result rather than `PatientProfile | null`:

```ts
type PatientProfileResult =
  | { status: "found"; profile: PatientProfile }
  | { status: "absent" }
  | { status: "unavailable" };
```

Collapsing the last two into `null` is how a database outage ends up telling a
patient their details were never saved, and inviting them to create a second
record.

---

### Data access architecture

```text
Page (server component)
   |
   +-- requireUser()              redirects before anything renders
   |
   +-- getPatientProfile()        takes NO user id
          |
          +-- getCurrentUser()    verified with the Auth server, not a cookie
          +-- .eq("profile_id", user.id)
          +-- RLS                 the owner's row, or nothing
```

`getPatientProfile()` takes no argument and there is no overload that does.
That is the point: an identifier that cannot be passed cannot be substituted,
so the class of bug where a caller forwards `searchParams.userId` into a query
does not exist here. Asserted by test.

Writes go through one server action, `savePatientProfileAction`, which does
create and update — because from the patient's side there is one operation, and
because deciding between them on the client would mean trusting the client
about state it cannot know.

**The field allowlist exists in three independent places**, and a request has
to get past all three:

1. The form is read field by field from a fixed list, so an unexpected key is
   never read at all.
2. The schema is `strict()`, so an unexpected key is rejected rather than
   dropped — a rejected request is visible in a log; a dropped field is how a
   clinical column arrives by accident.
3. The record mapper builds its object key by key; nothing is spread from the
   request. And the database's column-scoped grants refuse the rest anyway.

#### Idempotency

Two requests can race: a double-submitted onboarding form, a network retry, or
a patient who refreshes and submits again (`phase_07.md` §53). The action
updates first; if nothing matched it inserts. It does **not** check first and
then insert, because that is exactly the race — both requests pass the check.
The partial unique index is the guarantee; a `23505` is caught and retried as
an update, so the patient's values are saved rather than lost to an error they
did nothing to cause. Covered by test.

---

### Profile UX

**Onboarding.** With no record, `/patient/profile` opens straight into the form
under "Complete your Punarvasu profile" — no empty state to click through
before the thing the patient came to do. Only the name is required, and the
page says so. `/patient` shows an `EmptyState` with the same invitation.

**View.** Four sections — personal, contact, address, emergency contact — plus
an account section showing the email address, whether it is verified, and
"Patient since September 2026". Nothing else: no row id, no user id, no role,
no `updated_at`.

**Edit.** "Edit profile" opens the same four groups as a form, so moving
between reading and editing does not mean re-learning the layout. Actions are
"Cancel" and "Save changes" — never an ambiguous "Submit".

**Unsaved changes.** Cancel asks before discarding, but only when something has
actually changed — a confirmation on every Cancel trains people to dismiss it.
A `beforeunload` guard covers a reload or a closed tab, and is registered only
while the form is dirty so it does not disqualify the page from the
back-forward cache the rest of the time. **In-app navigation is not guarded**;
see *Known issues*.

**Completeness.** Four items: name, phone, address, emergency contact. Each is
shown with the reason the clinic wants it, and if that reason cannot be written
honestly the field does not belong in the list. **Date of birth, gender,
preferred name and preferred language are deliberately not counted** — all are
legitimate to collect and none is something a patient should be nudged towards
by a bar that sits at 80% until they give it (`phase_07.md` §§19–20). The
consequence is intended and asserted by test: a patient can reach 100% with a
half-empty form. The bar measures "can the clinic look after you", not "has
every box been ticked".

**States.** Loading is a structured skeleton in the shape of the page, not the
word "Loading". A failed read gets its own screen with a retry that is a link
to the same page — the read happens during server rendering, so re-requesting
*is* the retry, and it needs no client component. A save failure keeps the
patient's values on the form. Success is a toast, because by then the form it
would have sat above has gone.

**Email.** Shown, not edited. It is the account identity, and changing it means
proving control of the new address through Supabase Auth's own flow
(`phase_07.md` §§22–23). A disabled input would look like a field that might
become editable; a value with an explanation is honest about what it is.

**Emergency contact.** Always accompanied by the disclaimer that Punarvasu does
not monitor it and it is not an emergency service — shown whether or not a
contact has been entered, because somebody who has already entered one is
exactly the person who might otherwise rely on it.

---

### Validation

One schema, run by the browser for feedback and by the server for authority.

| Field | Rule |
| --- | --- |
| Full name | Required, trimmed, 1–120 characters |
| Preferred name | Optional, ≤60 |
| Phone | Optional. Indian mobile, tolerant of spaces and `+91` as typed, **stored as ten digits** so one number is one value |
| Date of birth | Optional. Must be a date that exists (30 February is refused), ≥ 1900-01-01, not in the future |
| Gender | Optional, one of four listed values |
| Address | Optional, each part bounded |
| Postal code | Optional, 3–12 characters, letters and digits with one space or hyphen between groups — an Indian PIN code and an international code both pass |
| Emergency contact | Name and phone are required **together**; the message is attached to whichever half is missing |
| Preferred language | Optional, ≤60 |

Two details worth stating:

* **Dates are compared as ISO strings, never as `Date` objects.**
  `new Date("2026-09-18")` is midnight *UTC*, so comparing it against a local
  `new Date()` puts the boundary hours away from local midnight — the timezone
  mistake §27 warns about, and one that would be invisible to anyone developing
  in India. ISO calendar dates sort lexicographically, so a string comparison is
  both simpler and correct. The same reasoning keeps `Intl.DateTimeFormat` out
  of the display formatter.
* **An empty optional field becomes `undefined`, then `null`** — not an empty
  string, and not an omitted key. Omitting it would leave the old value in
  place, so a patient who deleted their address would find it still there.
  Verified live: clearing a field writes `null`.

---

### Security checks

| Control | How | Verified |
| --- | --- | --- |
| Ownership on read | Query takes no user id; scoped to the verified session; RLS as well | Live: B cannot read A's record by `profile_id` or by row id |
| Ownership on write | `profile_id` from the session only; insert policy, column grant and guard trigger | Live: A cannot create a record for B, cannot re-point their own at B |
| Client-supplied `userId` | Never read. The form is read from a fixed field list, and the schema is `strict()` | Test: a form carrying `profileId`, `userId`, `id` and `role` saves correctly and none reaches the write |
| Protected fields | `id`, `profile_id`, `role`, `created_at`, `updated_at` | Live: each refused. Test: each rejected by the schema |
| Role escalation | No role field anywhere in the patient feature | Live regression: A cannot set `role = 'admin'`; role stays `patient` |
| Server-side validation | Same schema as the browser, via the action | Live: an invalid phone and a future date of birth are both refused server-side |
| Internal errors | `AppError` vocabulary; fixed safe copy | Test and live: a `relation … does not exist` error produces "We couldn't save your changes" and no database text on the page |
| Logging | Operation category plus an opaque user id | Test: the name, phone, date of birth and address never appear in a log line |
| Patient data in URLs | Nothing is read from or written to the query string | Live: after saving, the URL is exactly `/patient/profile`. **This is the check that caught the GET-form defect** |
| Caching | `force-dynamic` on the layout, `private, no-store` from the proxy | Live: the response carries both |
| Indexing | `noindex, nofollow` in metadata on the layout and both pages; `/patient/` in `robots.txt` | Live: the meta tag is served; `robots.txt` disallows |
| Browser storage | Nothing is written to `localStorage` or `sessionStorage` | No code does |
| XSS | Values render as text; no `dangerouslySetInnerHTML` in the patient area | Test and live: a `<script>` name is displayed, no element created |
| SQL injection | Parameterised by the Supabase client | Live: a `'; drop table patients; --` name round-trips unchanged and the table still exists |
| Unauthenticated access | `requireUser()` in the layout, RLS at the database, proxy for the early redirect | Live: `/patient` and `/patient/profile` both redirect with the destination preserved |
| Post-sign-out access | Global token revocation from Phase 06 | Live: the profile is unreachable after signing out |
| Secrets | Client bundle scan | Clean, 155 files |

---

### Accessibility

**Live, against the production build**, with `axe-core` injected into the real
page through the Chrome DevTools Protocol — the only way to measure computed
colour contrast. Nothing was added to `package.json`; the same technique as
Phases 03–06.

| Surface | Result |
| --- | --- |
| Onboarding form @1280 | **0 violations** |
| Onboarding form showing errors @1280 | **0** |
| Profile view @1280 | **0** |
| Discard-changes dialog @1280 | **0** |
| Profile form @390 | **0** |
| Patient overview @1280 | **0** |

Also measured live: exactly one `<h1>` and no skipped heading level; every
visible target ≥24px at 390px; a visible focus indicator on the focused
control; Tab moving from the name field to the next in visual order; zero
running animations under `prefers-reduced-motion`; and `aria-current="page"` on
exactly one patient-nav item.

Public-site regression at 390px and 1280px — `/`, `/services`, `/about`,
`/practitioners`, `/contact`, `/auth/login` — **0 axe violations and no
overflow on any of them**, with at most one nav item marked current.

In component tests: axe over the summary, the form, the form in its error
state, the completeness panel and the patient nav. Plus explicit assertions
that every control has a real label, that a field error sets `aria-invalid` and
is referenced by `aria-describedby` and carries `role="alert"`, that the
progress bar exposes `aria-valuenow` *and* prints the percentage as text, and
that the gender select can be returned to "not specified".

Two deliberate choices:

* **A native `<input type="date">`, not a custom picker.** Keyboard operable,
  announced correctly, and on a phone it opens the platform's own calendar —
  which is what §70 asks for.
* **A native `<select>` for gender.** Added to the design system as
  `NativeSelect` rather than reusing the Radix `Select`, because only a native
  select can carry an empty "not specified" option — Radix reserves the empty
  string, so a value chosen there could not be unchosen. Nothing about gender
  may be a one-way door.

**Not done:** no manual screen-reader pass (NVDA/VoiceOver). Unchanged since
Phase 02.

---

### Responsive

Horizontal overflow measured in a real browser at **320, 375, 390, 430, 768,
1024, 1280, 1440 and 1920px**, in both view and edit mode: **none at any
width**.

Layout: one column on a phone, two from `sm` for paired fields, with address
line 1, address line 2 and preferred language spanning both. Section
label/value pairs stack on a phone and become a `11rem / 1fr` grid from `sm`.
Form actions stack with Save first on a phone — under the thumb — and sit
right-aligned in the conventional order from `sm`.

---

### Defects found and fixed

Both were found by driving the built application in a real browser. Neither was
visible to the test suite, to ESLint, to the type checker or to review.

**1. The profile form submitted by GET, putting the patient's details in the
URL.** *(serious)*

After saving, the address bar read:

```text
/patient/profile?fullName=Test+Patient&dateOfBirth=1990-04-07&phone=9999999999
  &addressLine1=1+Example+Road&city=Pune&emergencyContactPhone=...
```

— a patient's name, date of birth, phone number, address and emergency contact
in a URL, which reaches browser history, proxy access logs and `Referer`
headers. That is precisely what `phase_07.md` §83 forbids. Nothing was saved
either, so the validation and persistence checks failed alongside it.

The cause: `ProfileEditor` rendered `<form action={formAction}>` around
`ProfileForm`, which rendered a second `<form>` inside it. Nested forms are
invalid HTML — the server-rendered markup parsed as one form, but on hydration
React created the inner element through DOM APIs, which permit it, and the
inputs then belonged to the inner form. An inner form with no `action`
submits by GET to the current URL.

Fixed by making `ProfileForm` own the single `<form>` and take the action as a
required prop. `tests/components/patient-profile.test.tsx` now asserts there is
exactly one form, that it contains the fields, and that the browser GET default
has been replaced; the test helper no longer wraps the component in a form, so
a test cannot recreate the shape that broke.

**2. A long email address caused horizontal overflow at 320px.** *(real)*

`scrollWidth` was 356 in a 320px viewport. The profile sections are laid out in
a flex column, and a flex item's `min-width` defaults to `auto` — it will not
shrink below its content's min-content width. One unbreakable token, an email
address, therefore widened the whole section. `overflow-wrap: break-word`
(Tailwind's `break-words`) does **not** help: it breaks the text visually but
still reports the whole address as the element's minimum.

Fixed with `min-w-0` on the section and the field list, and
`overflow-wrap: anywhere` on the value — which does reduce min-content width.
Regression-tested at the mechanism level in jsdom (which has no layout engine)
and at the pixel level in the browser.

**Three probe bugs, recorded because a report listing only the checks that
passed is not evidence:**

* The probe clicked `document.querySelector('button[type="submit"]')`, which on
  a patient page is the header's **Sign out** form — it comes first in document
  order. Every "failure" in that run was the probe signing itself out. The
  clicks are now scoped to the form holding the fields.
* A "no database text on the page" assertion matched `/relation/i`, which is in
  the form's own "Relationship to you" label. Narrowed to the database sense of
  the word.
* A touch-target sweep flagged the skip link at 1px tall. It is `sr-only` until
  focused, and is a keyboard affordance rather than a pointer target — the same
  exemption Phase 03 recorded. Excluded.

And once, as in Phase 06: a **stale `next start`** kept the port and served the
previous build after a fix had landed, so a correct fix measured as broken for
one run. `pkill` does not kill it on Windows.

---

### Tests

1,064 passing, up from 865.

| File | Count | Covers |
| --- | --- | --- |
| `src/features/patients/validation.test.ts` | 54 | The profile/clinical boundary, protected fields, required and optional handling, phone normalisation, date-of-birth rules, postal codes, emergency-contact pairing, hostile input |
| `src/features/patients/completeness.test.ts` | 12 | Which fields count and — explicitly — which do not |
| `src/features/patients/format.test.ts` | 17 | Timezone-safe dates, age across a birthday, address assembly |
| `tests/integration/patient-profile.test.ts` | 22 | Session-scoped queries, ownership, protected fields, clearing, the create race, safe errors, safe logs, revalidation |
| `tests/components/patient-profile.test.tsx` | 34 | Labels, error association, text rendering, the single-form invariant, the overflow fix, keyboard, axe |
| `tests/components/navigation.test.tsx` | +2 | `isCurrentPath` exact matching |

```text
TypeScript:              PASS
ESLint (--max-warnings=0): PASS
Prettier:                PASS
Unit + integration:      PASS (1,064 across 40 files)
Component + axe:         PASS (included above)
Live database / RLS:     PASS — 43 checks against the real project
Live browser journey:    PASS — 58 checks against the production build
Public-site regression:  PASS — 30 checks, 6 pages x 2 widths
Production build:        PASS — 35 static pages, /patient and /patient/profile dynamic
Client bundle scan:      PASS — 155 files, 0 findings
E2E:                     NOT RUN — no E2E tool is installed (deferred since Phase 01)
Screen reader:           NOT RUN
Lighthouse:              NOT RUN
```

#### Live database verification — 43 checks

Applied with `supabase db push`, then exercised through real user JWTs with two
synthetic accounts, both deleted afterwards. Test data was synthetic
throughout.

Covered: the Phase 06 profile trigger still fires; `anon` can neither read nor
insert; A cannot create a record owned by B or an unowned one; A can create
their own; a second profile is refused by the unique index; A reads exactly
their own row; **B sees nothing, and cannot fetch A's record by `profile_id` or
by row id**; A can update their own; **B's update of A's row affects nothing
and A's data is unchanged**; A cannot re-point the record, set either
timestamp, or change the row id; the role-escalation regression still holds;
**nobody can delete**; a future date of birth, a pre-1900 date, an unlisted
gender, an oversized name, a whitespace-only name and a too-short postal code
are all refused; **no clinical column exists**; script- and SQL-shaped input
round-trips as text and the table survives; deleting an account cascades the
patient record away.

#### Live browser verification — 58 checks

The full journey against the production build and the real Auth server:
unauthenticated redirect with the destination preserved → sign in through the
real form → onboarding → server-side rejection of an invalid phone and a future
date of birth, with values preserved → create → confirmation → persistence
confirmed by reading the database → reload → cache headers → edit → Cancel
clean → Cancel dirty, with the discard dialog → save an edit → clear a field to
null → keyboard → nine viewport widths → axe at 390 and 1280 → heading
structure → reduced motion → sign out → the profile unreachable afterwards.

---

### Acceptance criteria

#### Profile

| Criterion | Result |
| --- | --- |
| Authenticated patient can access profile | PASS — live |
| Unauthenticated user cannot | PASS — live, both routes, destination preserved |
| Profile can be created | PASS — live, through the real form |
| Profile can be viewed | PASS — live |
| Profile can be edited | PASS — live |
| Profile updates persist | PASS — live, confirmed by reading the database |
| Data is associated with the authenticated user | PASS — `profile_id` from the session only |
| User cannot modify another user's profile | PASS — live, B's update of A's row affects nothing |

#### Data

| Criterion | Result |
| --- | --- |
| Data model is typed | PASS — no `any`; a discriminated result for the read |
| Required fields defined | PASS — `full_name`, in the type and `NOT NULL` in the database |
| Validation exists | PASS |
| Server-side validation exists | PASS — the same schema, verified live |
| Database constraints exist | PASS — 13 check constraints, a partial unique index, a foreign key, two validating triggers |
| `user_id` cannot be changed by the client | PASS — type, grant and trigger; verified live |
| Internal fields cannot be modified | PASS — `id`, `created_at`, `updated_at`; verified live |

#### Security

| Criterion | Result |
| --- | --- |
| RLS enabled | PASS |
| Own-profile SELECT works | PASS — live |
| Own-profile UPDATE works | PASS — live |
| Own-profile INSERT works | PASS — live |
| Cross-user access fails | PASS — live, by `profile_id` and by row id |
| No sensitive data exposed publicly | PASS — `anon` has no grant at all |
| No sensitive data logged | PASS — asserted by test |
| No profile data in URLs | PASS — live. **This criterion failed first and is why the GET defect was found** |
| Patient pages not publicly cached | PASS — live, `private, no-store` |

#### UX

| Criterion | Result |
| --- | --- |
| Patient shell implemented | PASS — `/patient` layout with navigation |
| Profile sections clear | PASS — four groups, same in view and edit |
| Edit mode clear | PASS |
| Save/cancel actions clear | PASS — never "Submit" |
| Loading state exists | PASS — structured skeleton |
| Error state exists | PASS — read failure and save failure are separate screens |
| Success feedback exists | PASS — toast, live-verified |
| Empty/onboarding state exists | PASS |
| Profile completeness works | PASS |

#### Validation

| Criterion | Result |
| --- | --- |
| Name validation | PASS |
| Phone validation | PASS — and normalised |
| DOB validation | PASS — format, real date, bounds, not future |
| Address validation | PASS — bounded; postal code format |
| Emergency contact validation | PASS — name and phone required together |
| Malicious input safely handled | PASS — stored as text, rendered as text, table intact |

#### Accessibility

| Criterion | Result |
| --- | --- |
| All fields have labels | PASS — structural, via `Field` |
| Keyboard navigation works | PASS — verified in a real browser |
| Focus states visible | PASS — measured |
| Errors accessible | PASS — `role="alert"`, `aria-describedby`, `aria-invalid` |
| Buttons semantic | PASS — no click handler on a div |
| Status messages accessible | PARTIAL — roles are correct and asserted, and the toast was verified live; **no manual screen-reader pass** |
| Mobile form usable | PASS — 320–430px measured |

#### Responsive

320 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920: **PASS at every width,
no horizontal overflow**, measured in both view and edit mode.

#### Architecture

| Criterion | Result |
| --- | --- |
| Uses Phase 06 authentication | PASS — `requireUser()`, `getCurrentUser()`, the `(app)` group; no second mechanism |
| Uses established server/client boundaries | PASS — `server-only` on the query layer; one client island on the page |
| Uses centralized data access | PASS — `features/patients/queries.ts` and `actions.ts` |
| Does not duplicate auth logic | PASS |
| Does not implement role authorization prematurely | PASS — no role check anywhere in this phase |

#### SEO

| Criterion | Result |
| --- | --- |
| Patient pages not indexable | PASS — `noindex` served, `robots.txt` disallows |
| No patient information in public metadata | PASS — the title is "Your profile", never a name |

---

### Known issues

1. **In-app navigation does not warn about unsaved changes.** `beforeunload`
   covers a reload, a closed tab and a link out of the application; the App
   Router has no supported way to intercept a client-side navigation, and the
   ways to fake one patch history or the router. Cancel asks before discarding
   and the patient nav is two links, so the exposure is small — but clicking
   "Overview" with an unsaved edit loses it silently. `phase_07.md` §34 asks
   for the browser capability and warns against an intrusive dialog on every
   navigation, so this is the documented trade rather than an oversight.
2. **`src/types/database.ts` is still hand-written.** `npm run db:types` and
   `supabase db dump` both require Docker, which is not available in this
   environment. The hand-written shape was verified column by column against
   the live database through PostgREST's schema description and matches
   exactly. Regenerate when Docker is available and treat any difference as a
   defect in the hand-written file.
3. **No staff or admin access to patient records**, by design. A receptionist
   cannot look up a patient and a doctor cannot read one. That is Phase 08's,
   with the permission matrix and the audit trail.
4. **No audit log of profile changes.** `phase_07.md` §78 asks for the events
   to be documented rather than for an audit platform to be built; the log
   events (`patient.profile_created`, `patient.profile_updated`) are named for
   the system Phase 19 introduces.
5. **No account or profile deletion**, by design (§16). The retention and
   deletion policy has legal inputs and has not been decided; there is no
   `DELETE` policy and no UI.
6. **Gender is collected.** It is optional, self-described, offers "Prefer not
   to say", is never inferred and is never required, and `DATABASE.md` §4.2
   names it as part of this record. It should still be confirmed with the
   clinic that it is used in assessment, since the field description says so.
7. **The "why we ask" copy needs clinic review**, like all patient-facing copy
   in this project. Each sentence is written to be true of what the product
   actually does today, but a practitioner should confirm the date-of-birth and
   gender rationales.
8. **Still no CSP.** Unchanged since Phase 02.
9. **No E2E tool, no screen-reader pass, no Lighthouse run.** Unchanged. The
   live browser checks cover accessibility, overflow, keyboard and the whole
   journey, but they are a script written for this phase rather than a
   maintained suite.
10. **Legal pages still do not exist.** Required before the clinic handles real
    records through this website.

---

### Deferred work

* Roles and permissions, and with them staff and practitioner access to patient
  records (Phase 08).
* Audit logging of profile creation and changes (Phase 19); the events are
  already named.
* Account and data deletion, once the retention policy exists.
* Profile photographs — deliberately not built (§44); patient documents are
  Phase 14.
* A patient identifier, if the architecture ever needs one (§43). It does not
  yet, so none was created.
* Appointments, clinical records, prescriptions, documents, notifications.
* An E2E tool, a manual screen-reader pass, Lighthouse.
* Content-Security-Policy.
* Regenerating `src/types/database.ts` from the live project.

Phase 08 has not been started.
