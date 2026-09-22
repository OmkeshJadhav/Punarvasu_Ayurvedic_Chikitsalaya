## PHASE 08 — Roles & Permissions

Status:
COMPLETED — verified against the live Supabase project and in a real browser

Completed On:
2026-09-18

Summary:
Built Punarvasu's authorization foundation on top of the Phase 06 identity and
the Phase 07 patient record: a dedicated `user_roles` assignment table that no
client can write to, an insert-only audit of every role change, a centralized
permission matrix, pure authorization decisions, server guards for routes and
for actions, resource-level ownership helpers, a safe forbidden experience,
authorization-aware navigation, and an admin-only, self-excluding, audited
role-assignment mechanism at `/admin/users`.

1,241 tests pass, up from 1,064. **62 live checks** against the real database
with real per-role JWTs cover every policy, grant, constraint and
`security definer` function. **57 live checks** drive a real Chrome through all
five actors — unauthenticated, patient, receptionist, doctor, admin — against
every protected route.

One real defect was found only by measuring the built application in a browser,
and it was invisible to the test suite, to ESLint and to review. It is
described in full below, because the class of it is worth remembering.

---

### Repository assessment before starting

Phase 06 left a working identity foundation and Phase 07 the patient record.
Reused rather than rebuilt: `getCurrentUser()` and `requireUser()`, the `(app)`
route group and its `force-dynamic` guard, `src/proxy.ts` and
`PROTECTED_PATH_PREFIXES`, the Supabase clients, `AppError`, the structured
logger, `parseInput` and the shared validation primitives, `Field`,
`NativeSelect`, `Button`, `Card`, `Alert`, `Badge`, the `Table` family,
`EmptyState`, `ErrorState`, `NavLink`, `SectionLoading` and the skeletons.

Four findings shaped the work:

* **`public.current_app_role()` already existed**, shipped unused by Phase 06
  with a comment saying it was "part of the identity foundation Phase 08 builds
  authorization on". It is now what policies use.
* **`PROTECTED_PATH_PREFIXES` already listed `/admin` and `/staff`**, and
  `robots.txt` already disallowed them. Phase 06 listed them ahead of the
  features precisely so this phase would inherit the early redirect.
* **Phase 07 recorded its own deferral explicitly**: the patient layout's
  docblock said a role check "would be authorization written before the model
  it belongs to", and `progress_phase_07.md` listed staff access as Phase 08's.
  Those are the two places this phase changes.
* **`getCurrentUser()` was the only function in the codebase that produced a
  role.** That is what made moving the role between tables a one-query change.

---

### 1. Files created and modified

#### Created

```text
supabase/migrations/20260919120000_roles_and_permissions.sql

src/config/permissions.ts                    the permission vocabulary + matrix
src/config/permissions.test.ts

src/lib/authorization/policy.ts              the decision, as pure functions
src/lib/authorization/policy.test.ts
src/lib/authorization/routes.ts              area rules, landing paths
src/lib/authorization/routes.test.ts
src/lib/authorization/guards.ts              server-side enforcement
src/lib/authorization/ownership.ts           resource-level authorization
src/lib/authorization/ownership.test.ts

src/features/admin/types.ts
src/features/admin/content.ts
src/features/admin/validation.ts
src/features/admin/validation.test.ts
src/features/admin/queries.ts
src/features/admin/actions.ts

src/components/admin/user-access-table.tsx
src/components/admin/role-assignment-form.tsx
src/components/layout/app-nav.tsx

src/app/(app)/forbidden/page.tsx
src/app/(app)/admin/layout.tsx
src/app/(app)/admin/page.tsx
src/app/(app)/admin/users/page.tsx
src/app/(app)/admin/users/loading.tsx

scripts/seed-dev-accounts.mjs

tests/integration/authorization-guards.test.ts
tests/integration/role-assignment.test.ts
tests/components/authorization.test.tsx
docs/progress/progress_phase_08.md
```

#### Modified

```text
src/lib/auth/current-user.ts       role read from user_roles, not profiles
src/lib/auth/paths.ts              /forbidden added to the protected prefixes
src/types/database.ts              profiles.role removed; user_roles,
                                   role_assignment_events and the three new
                                   functions added
src/app/(app)/layout.tsx           role-aware navigation; the reasoning for
                                   holding no role check itself
src/app/(app)/account/page.tsx     shows the role; role-appropriate next step
src/app/(app)/patient/layout.tsx   requireAreaAccess(PROTECTED_AREAS.patient)
src/features/patients/actions.ts   profile.write.self checked in the action
src/components/ui/table.tsx        TableScroller is `relative` — see defect 1
src/app/robots.ts                  /admin and /forbidden added
vitest.config.mts                  component-project timeout — see below
tests/integration/auth-session.test.ts   asserts the role comes from user_roles
tests/components/surfaces.test.tsx       TableScroller regression test

docs/ARCHITECTURE.md               §1.1 state; §7 authorization implementation
docs/SECURITY.md                   §6 implemented controls; matrix rows marked
docs/DATABASE.md                   §3 diagram; §4.1, §4.1a, §4.1b; §4.2 note;
                                   §6.2 role resolution
docs/QA_STRATEGY.md                Phase 08 coverage, and what it does not prove
docs/DESIGN_SYSTEM.md              components/admin/, AppNav, TableScroller note
docs/PUNARVASU_MASTER_SPEC.md      status, routes, phase table
```

#### Dependencies

**None added.**

---

### 2. Database

`supabase/migrations/20260919120000_roles_and_permissions.sql`, applied to the
live project with `supabase db push` and verified against it.

#### Tables

**`public.user_roles`** — the authoritative role assignment.

```text
id           uuid, pk, default gen_random_uuid()
user_id      uuid not null -> auth.users(id) on delete cascade
role         public.app_role not null
assigned_by  uuid -> auth.users(id) on delete set null
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()
```

**`public.role_assignment_events`** — insert-only audit.

```text
id              uuid, pk
actor_id        uuid -> auth.users(id) on delete set null
target_user_id  uuid not null       <- deliberately NOT a foreign key
previous_role   public.app_role
new_role        public.app_role not null
created_at      timestamptz not null default now()
```

`target_user_id` is not a foreign key on purpose: the history of a role change
has to outlive the account it was made against, and a cascade would delete the
evidence along with the user.

#### Enum

`public.app_role` — unchanged from Phase 06. `patient`, `receptionist`,
`doctor`, `admin`. Verified live that `'superadmin'` is rejected.

#### Constraints and indexes

| Object | Purpose |
| --- | --- |
| `user_roles_user_role_key` — `unique (user_id, role)` | The constraint `phase_08.md` §6 asks for. Redundant *today*; operative the day multi-role is permitted |
| `user_roles_single_role_per_user` — unique index on `(user_id)` | `docs/SECURITY.md` §6's one-role rule. **Dropping this single index is the entire change needed to support multiple roles** |
| `role_assignment_events_target_idx` — `(target_user_id, created_at desc)` | The only way the audit is read |
| FK `user_roles.user_id -> auth.users(id)` cascade | A role cannot outlive its identity |
| FK `user_roles.assigned_by -> auth.users(id)` set null | Removing an administrator does not delete the roles they granted |

#### Triggers

| Trigger | Purpose |
| --- | --- |
| `user_roles_set_updated_at` | Reuses `public.set_updated_at()` from Phase 06 |
| `on_auth_user_created` (rewritten) | Now writes `user_roles` as well as `profiles`. The role is still the literal `'patient'`, **never** read from `raw_user_meta_data` |

`profiles_guard_role` and its function were **dropped**. Their job is now done
by the absence of any writable path to `user_roles` at all, which is a stronger
guarantee than a trigger fired on an update somebody was permitted to attempt.

#### Functions

| Function | Security | What it does |
| --- | --- | --- |
| `current_app_role()` | definer, stable | The caller's role. Rewritten to read `user_roles`. Takes no argument, so it cannot be asked about anyone else |
| `has_app_role(target)` | definer, stable | The predicate RLS policies use, so no policy queries `user_roles` directly and none recurses |
| `assign_user_role(target, role)` | definer | The only way to assign a role. Four refusals, in order: no session; caller is not an admin; **caller is the target, including an admin**; unknown target. Then upserts and writes the audit row |
| `list_managed_users()` | definer, stable | The admin access list. Raises unless the caller is an admin. Returns id, email, name, role, verification state and creation date — and no patient information |

`list_managed_users()` exists so the service-role key is **not** needed to read
email addresses out of `auth.users`. The authorization check sits in the
database next to the data rather than in whichever caller remembered it, which
is what `phase_08.md` §21 asks for.

#### RLS policies

Enabled on both new tables with no permissive default, per operation, never
`for all`. There is no `using (true)` anywhere.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `user_roles` | own row (`user_roles_select_own`); all rows for an admin (`user_roles_select_admin`) | **nobody** | **nobody** | **nobody** |
| `role_assignment_events` | admins only | **nobody** | **nobody** | **nobody** |

"Nobody" means literally that: no policy *and* no grant, so a write is refused
at the privilege check before RLS is consulted.

**Phase 07's `patients` policies were amended, not replaced.** Each of the
three self-service policies gained `and public.has_app_role('patient')`
alongside the ownership predicate it already had. Ownership is untouched —
`profile_id = auth.uid()` still appears in `using` and in `with check` exactly
as before. The change only ever denies more, which closes a real hole: until
this phase, a doctor could create a patient record for themselves by posting
directly to the profile server action, and the database would have allowed it.

#### Grants

```text
revoke all on public.user_roles             from anon, authenticated;
revoke all on public.role_assignment_events from anon, authenticated;
grant select on public.user_roles             to authenticated;
grant select on public.role_assignment_events to authenticated;
```

`anon` receives nothing on either table. There is no `grant insert`,
`grant update` or `grant delete` on `user_roles` for any client role.

#### The data migration

`profiles.role` was **moved**, not duplicated: every existing row was copied
into `user_roles` first, then the guard trigger and the column were dropped.
Two sources of truth would have been worse than either one.

---

### 3. Role and permission architecture

```text
Supabase Auth  ──  getUser(), verified upstream
      │
Application identity  ──  getCurrentUser(), the ONLY producer of a role
      │
public.user_roles  ──  the role, read from the database under RLS
      │
config/permissions.ts  ──  role -> permissions, the whole policy in one table
      │
lib/authorization/policy.ts  ──  can(role, permission), pure and exhaustive
      │
lib/authorization/guards.ts  ──  enforcement on a trusted server path
      │
Postgres RLS  ──  the last word
```

#### The four permissions

Only what current functionality needs (`phase_08.md` §13):

| Permission | What it protects |
| --- | --- |
| `profile.read.self` | Reading your own patient record |
| `profile.write.self` | Creating or updating your own patient record |
| `users.read` | Listing the clinic's accounts and their roles |
| `roles.manage` | Assigning a role to another user |

`appointments.manage`, `patients.search`, `clinical_records.*`,
`prescriptions.*`, `documents.*` and `analytics.read` are **not** declared. A
permission that protects nothing gets granted casually and is then inherited by
the feature it was invented for; each arrives with the feature it guards, and a
test asserts none of them has crept in.

#### The matrix

| | patient | receptionist | doctor | admin |
| --- | --- | --- | --- | --- |
| `profile.read.self` | ✓ | — | — | — |
| `profile.write.self` | ✓ | — | — | — |
| `users.read` | — | — | — | ✓ |
| `roles.manage` | — | — | — | ✓ |

**Receptionist and doctor hold nothing yet, and that is correct.** Their
workspaces do not exist. `docs/SECURITY.md` §2.4 asks for new capability to
start from the most restrictive reasonable configuration and be granted
explicitly; a speculative permission now would grant access to nothing while
looking like a decision somebody made. A test asserts both lists are empty, so
adding to either is a deliberate change to a test that says why.

**No staff role holds the self-profile permissions**, including admin.
`docs/SECURITY.md` §6: a staff member who is also a patient of the clinic uses
a separate patient account, which keeps every authorization decision
unambiguous.

**There is no hierarchy.** An admin is not also a doctor, and a doctor does not
inherit a receptionist's permissions. Asserted explicitly, because a check that
assumed one would silently grant clinical access to clinic administrators.

---

### 4. Server authorization helpers

`src/lib/authorization/`, four modules with one job each.

**`policy.ts`** — the decision, as pure functions. `can`, `canAll`, `canAny`,
`hasRole`, `hasAnyRole`, `permissionsForRole`. No session, no database, no
request, so the matrix can be tested exhaustively.

**`routes.ts`** — `PROTECTED_AREAS`, `requiredPermissionForPath`,
`areasForRole`, `landingPathForRole`. One table read by the guard, by the
navigation and by the tests that assert the two agree.

**`guards.ts`** — server-only enforcement, in two shapes:

| Guard | For | On failure |
| --- | --- | --- |
| `requireAreaAccess(area)` | an area's layout | redirect to `/forbidden` |
| `requirePermission(p)` / `requireRole(r)` / `requireAnyRole(rs)` | a page or layout | redirect to `/forbidden` |
| `assertPermission(p)` / `assertRole(r)` | a server action or route handler | throw a `forbidden` `AppError` |
| `currentUserCan(p)` | deciding whether to render a control | nothing — presentation only |

A page should navigate, because a person is looking at it. An action should
throw, because its caller is code that has to turn the failure into a safe
response.

**`ownership.ts`** — `isResourceOwner`, `assertResourceOwner`, `assertNotSelf`.
The case role checks cannot reach: Patient A and Patient B both hold
`role = patient`, so only ownership separates them.

#### Three rules recorded for later phases

1. **The owner id comes from the record, never from the request.** A caller
   that passes `formData.get("ownerId")` has authorized nothing.
2. **This is never the only layer.** RLS is what actually denies.
3. **Prefer making the question unaskable.** The strongest version is not a
   check at all: `features/patients/queries.ts` takes no user id and has no
   overload that does, so there is no argument to substitute.

`assertResourceOwner` has **no call site yet**, by design. `assertNotSelf` is
used by the role-assignment action; `assertResourceOwner` is the primitive
Phase 09 consumes the moment a record is addressed by its own id, and Phase
07's query layer expresses the same rule structurally today. It is fully
tested rather than merely declared.

---

### 5. Route protection

| Route | Requires | Guarded in |
| --- | --- | --- |
| `/account` | a session | `(app)/layout.tsx` |
| `/forbidden` | a session | `(app)/layout.tsx` |
| `/patient`, `/patient/profile` | `profile.read.self` | `(app)/patient/layout.tsx` |
| `/admin`, `/admin/users` | `roles.manage` | `(app)/admin/layout.tsx` |

Guards sit in **layouts**, so a page added beneath one inherits protection
instead of having to remember it — and they take the *area* rather than a bare
permission string, so what is enforced is literally the entry in `routes.ts`
that the navigation reads.

**`src/proxy.ts` was not changed**, deliberately. It still performs no role
check and no database query: it runs on prefetches, so a lookup there would be
a lookup per hovered link, and `phase_08.md` §§24 and 31 both argue against it.
It redirects a request with no session at all, which is why an unauthenticated
visitor to `/admin` gets a real 307 to sign-in.

**The forbidden experience.** `/forbidden` lives inside the authenticated
shell, so a refused person keeps the header, the navigation for the areas they
*can* use, and sign-out. It says what happened and offers two ways back. It
says **nothing** about the privilege model — not the role held, not the role
required, not the permission, not the policy. Asserted by test and verified in
a real browser against the rendered body.

**Authorization-aware navigation.** `AppNav` lists the areas the signed-in role
can enter, reading the same table the guards read. A receptionist and a doctor
get **nothing** — no link is invented for a workspace that does not exist
(`phase_08.md` §23) — and the account page tells them so in words.

**Role assignment.** `/admin/users` lists every account and its role, with a
per-row role control. The administrator's own row carries a sentence explaining
why it has none.

---

### 6. Security tests and their results

#### Automated — 1,241 tests, up from 1,064

| File | Count | Covers |
| --- | --- | --- |
| `src/config/permissions.test.ts` | 15 | The policy table against `SECURITY.md` §6: four roles, no speculative permission, only patient holding the self-profile permissions, only admin holding user and role management, no role a superset of every other |
| `src/lib/authorization/policy.test.ts` | 26 | The exhaustive matrix — every role against every permission, written out rather than derived from the table it checks. An unresolvable role holds nothing; a role outside the model holds nothing; no hierarchy |
| `src/lib/authorization/routes.test.ts` | 21 | Every area's permission exists; every permission-gated area is also authentication-gated; `/administration` and `/patients` cannot inherit a rule; a link is offered exactly when the guard would admit |
| `src/lib/authorization/ownership.test.ts` | 12 | A → B's resource denied; an unowned resource belongs to nobody; exact id comparison (no trimming, case folding or prefix match); a refusal revealing neither the resource nor its owner; the self-targeting rule |
| `src/features/admin/validation.test.ts` | 26 | `superadmin`, `root`, `Doctor`, `ADMIN`; non-UUID, SQL-shaped, script-shaped and traversal-shaped targets; an unexpected key rejected; and that the schema carries no field that could confer authority |
| `tests/integration/authorization-guards.test.ts` | 24 | All five actors against every guard; an unauthenticated visitor sent to sign in rather than to a refusal; fail-closed on `null`; a refusal logging the user id and permission but neither address nor name |
| `tests/integration/role-assignment.test.ts` | 30 | Every attack in `phase_08.md` §§25, 33 and 40 against the real action |
| `tests/components/authorization.test.tsx` | 19 | The forbidden page discloses nothing; navigation offers exactly the enterable areas; the admin's own row explains itself; a name containing markup renders as text; axe |

#### Live database — 62 checks, real per-role JWTs

Run against the live Supabase project by signing in as each seeded account with
the anon key, so every check went through real RLS with a real `auth.uid()`.

| Area | Result |
| --- | --- |
| Schema: `profiles.role` gone, `user_roles` and `role_assignment_events` present with the expected columns | PASS |
| Each of the four roles resolves through `current_app_role()` | PASS |
| `anon` can read none of `user_roles`, `role_assignment_events`, `patients`, `profiles` | PASS |
| A patient sees exactly one role row — their own | PASS |
| A patient cannot read the admin's role row by id | PASS |
| A doctor cannot read a patient's role row | PASS |
| An admin can read every role row | PASS |
| **No role — patient, receptionist, doctor or admin — can INSERT into `user_roles`** | PASS |
| **No role can UPDATE `user_roles`**, including an admin on their own row | PASS |
| A patient cannot DELETE their role row | PASS |
| **Patient, receptionist and doctor each cannot promote themselves to admin** | PASS (42501) |
| A patient cannot change another user's role | PASS (42501) |
| **A receptionist cannot reach admin functionality** | PASS (42501) |
| **A doctor cannot perform an admin-only operation** | PASS (42501) |
| `anon` cannot assign a role | PASS |
| **An admin cannot change their OWN role** | PASS (42501) |
| An admin cannot assign a role to an unknown user | PASS (P0002) |
| `'superadmin'` is rejected by the enum | PASS |
| An admin can assign a role to somebody else, and it takes effect | PASS |
| Still exactly one role row for that user afterwards | PASS |
| **An audit row records actor, target, previous role and new role** | PASS |
| A patient cannot read the audit trail | PASS |
| **Nobody can edit or delete the audit trail** | PASS |
| An admin can call `list_managed_users()`; patient, receptionist, doctor and anon cannot | PASS (42501) |
| The account list carries the email and role, and no patient information | PASS |
| A patient can create, read and update their own patient record | PASS |
| **A receptionist, doctor and admin each cannot create a patient record for themselves** | PASS |
| A receptionist, doctor and admin each see zero patient records | PASS |
| **A doctor cannot read a patient's record by `profile_id` (IDOR)** | PASS |
| **A doctor cannot read a patient's record by row id (IDOR)** | PASS |
| A patient cannot re-point their record at another user | PASS |
| Nobody can delete a patient record | PASS |
| A patient can still update their own profile name (Phase 07 preserved) | PASS |
| A patient cannot read the admin's profile | PASS |

**62 passed, 0 failed.**

#### Live browser — 57 checks, real Chrome over the DevTools Protocol

Signed in through the **real sign-in form** as each seeded account against the
production build.

| | `/patient` | `/patient/profile` | `/admin` | `/admin/users` |
| --- | --- | --- | --- | --- |
| unauthenticated | → sign in | → sign in | → sign in | → sign in |
| patient | ✓ | ✓ | → `/forbidden` | → `/forbidden` |
| receptionist | → `/forbidden` | → `/forbidden` | → `/forbidden` | → `/forbidden` |
| doctor | → `/forbidden` | → `/forbidden` | → `/forbidden` | → `/forbidden` |
| admin | → `/forbidden` | → `/forbidden` | ✓ | ✓ |

Every cell as expected. Also verified live:

* **Browser storage grants nothing.** With `localStorage.role = "admin"`,
  `sessionStorage.role = "admin"` and `role`/`app_role`/`isAdmin` cookies set,
  a patient still lands on `/forbidden` at `/admin/users`.
* After a refusal, no account list is visible to a patient, receptionist or
  doctor.
* The forbidden page names no role, no permission and no identifier, and is
  `noindex`.
* Protected responses carry `private, no-store`.
* `robots.txt` disallows `/patient/`, `/admin`, `/forbidden` and `/account`.
* An admin's account page shows their role and links to administration, not to
  the patient area. A doctor's shows their role and offers **no** workspace
  link.
* **Zero axe violations, with real computed colour**, on `/forbidden`,
  `/admin`, `/admin/users` and `/account` at both 390px and 1280px.
* **Zero horizontal overflow** at 320, 375, 390, 430, 768, 1024, 1280, 1440 and
  1920px on `/forbidden` and `/admin/users`.
* Exactly one `<h1>`, no skipped heading level, every visible target ≥24px.

**57 passed, 0 failed.**

#### The adversarial checklist from `phase_08.md` §40

| Question | Answer | Where proved |
| --- | --- | --- |
| Can a patient become admin? | **No** | Live DB (no grant, no policy, `assign_user_role` 42501), integration tests, browser |
| Can a patient access another patient? | **No** | Live DB by `profile_id` and by row id; `ownership.test.ts` |
| Can a receptionist access admin? | **No** | Live DB, guards, browser |
| Can a doctor perform an admin-only operation? | **No** | Live DB, guards, browser |
| Can a client modify a role? | **No** | No grant and no policy on `user_roles`; verified live for all four roles |
| Can URL manipulation bypass authorization? | **No** | Browser, all five actors against every protected route |
| Can request-body manipulation bypass authorization? | **No** | `role-assignment.test.ts`: injected `userId`, `actorRole`, `isAdmin`, `permission`; forged targets; invalid roles |
| Can browser-storage modification bypass authorization? | **No** | Browser, with localStorage, sessionStorage and cookies all set to `admin` |

---

### 7. Defects found and fixed

**1. Horizontal overflow on `/admin/users` at 320px.** *(real, found only in a
browser)*

35px of page overflow. The cause was not the table: `TableScroller` was
containing a 526px table correctly. It was a single `sr-only` label on a role
control, sitting 354px into that table.

An absolutely positioned element is clipped by an ancestor's `overflow` only
when that ancestor is its *containing block*, which means the ancestor has to be
positioned. `TableScroller` was not, so the label resolved against the initial
containing block, escaped the scroller entirely, and set the width of the whole
document.

Fixed with one class — `relative` on `TableScroller` — which repairs every
table in the application, present and future. Re-measured: `scrollWidth` 320 =
`clientWidth` 320. The regression test asserts the class rather than the pixels,
because jsdom has no layout engine; the comment says so, and says where the
pixel result was measured.

**2. `permissionsForRole` threw on a role outside the model.** *(found by its
own test)*

`PERMISSIONS_BY_ROLE[role]` returned `undefined` for a value the type system
says cannot exist, and `.includes` then threw — **inside an authorization
check**. TypeScript and the database enum both say it cannot happen, but the
value travels through a network client and a hand-maintained generated type to
get there, and an exception in a guard is a worse outcome than a denial. It now
falls back to an empty list, so an unknown role holds nothing.

**3. A claim in my own docblock did not match the code.** *(found by its own
test)*

`actions.ts` said `strict()` rejects an unexpected form field. It does not: the
named-field read runs first, so an extra field on the form is never read at all.
Both the comment and the test now describe the real behaviour, and
`validation.test.ts` covers the case `strict()` genuinely protects — an object
assembled in code rather than posted from the form.

**4. Whole-page axe sweeps timed out under load.** *(real flakiness)*

Four tests passed in isolation and failed intermittently in a full run: a
whole-page axe sweep walks several thousand nodes in jsdom and legitimately
takes seconds, and the new test file pushed them past the 5s default while
workers contended. `docs/QA_STRATEGY.md` §35 forbids retrying a flaky test
without understanding it, so the timeout — which was set for unit tests and
being applied to an accessibility audit — is what changed, for the components
project only. No assertion was weakened and nothing is retried.

**One probe bug, recorded because a report listing only what passed is not
evidence:** the live verification's `upsert` on `patients` failed with "no
unique or exclusion constraint matching the ON CONFLICT specification". That is
correct behaviour — the unique index is *partial*, so `ON CONFLICT` cannot
infer it — and the application never used `upsert` there. The probe was
rewritten to do update-then-insert, exactly as the real action does.

**And the stale-server trap again**, recorded in Phases 06 and 07 and hit here
too: the overflow fix measured as broken for one run because `next start` was
still serving the previous build. `pkill` does not stop it on Windows;
`Get-NetTCPConnection -LocalPort 3311` plus `Stop-Process` does.

---

### 8. Test accounts

Four accounts were created on the live project so every role can be exercised,
using `scripts/seed-dev-accounts.mjs`:

```text
patient@punarvasu.com        patient
receptionist@punarvasu.com   receptionist
doctor@punarvasu.com         doctor
admin@punarvasu.com          admin

password: Abcde@12345   (all four)
```

All four are email-confirmed, so testing does not depend on mail delivery.

**These are shared, well-known credentials, including for an administrator.**
The script refuses to run when `APP_ENV=production`, and the password is in the
file in plain sight rather than pretending to be a secret. If this project's
database ever takes real patient data, **delete these four accounts.** Recorded
under *Known issues*.

The script uses the service-role key for the two operations that genuinely
cannot be done as a user: creating a pre-confirmed account, and writing
`user_roles` directly — which the application cannot do at all, and which is
the chicken-and-egg of the first administrator. That is the "controlled
migration/bootstrap" mechanism `phase_08.md` §4 permits. Every *ordinary* role
change goes through `assign_user_role()` with an acting admin and an audit row.

---

### 9. Verification

Executed on 2026-09-18:

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 1,241 tests, 48 files** (was 1,064) |
| Production build | `npx next build` | **PASS** — 35 pages; all 30 public pages still static |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 156 files, 0 findings |
| Migration | `supabase db push` | **PASS** — applied to the live project |
| Live database | 62 checks, real per-role JWTs | **PASS — 62/62** |
| Live browser | 57 checks, real Chrome, all five actors | **PASS — 57/57** |
| Live axe, real computed colour | 4 pages × 2 widths | **PASS** — 0 violations |
| Live overflow | 2 pages × 9 widths | **PASS** — none |
| E2E | — | **NOT RUN** — no E2E tool is installed (deferred since Phase 01) |
| Screen reader | — | **NOT RUN** |
| Lighthouse | — | **NOT RUN** |

The public site, authentication and the patient profile were all re-run as
part of the suite and the browser sweep; nothing from Phases 01–07 regressed.

---

### 10. Acceptance criteria

#### Role model

| Criterion | Result |
| --- | --- |
| Roles are explicitly defined | PASS — `public.app_role`, four values, `config/permissions.ts` |
| Role values are constrained | PASS — a database enum; `'superadmin'` rejected live |
| Role assignment has a trusted source of truth | PASS — `public.user_roles`, no client-writable path |
| Duplicate role assignment is prevented | PASS — `unique (user_id, role)` and a unique index on `user_id`; verified live that a second assignment leaves exactly one row |
| Role assignment cannot be controlled by public registration | PASS — the trigger writes the literal `'patient'`, never `raw_user_meta_data` |

#### Authorization

| Criterion | Result |
| --- | --- |
| Authentication and authorization are clearly separated | PASS — `lib/auth/` answers who; `lib/authorization/` answers what they may do; the `(app)` layout holds no role check |
| Reusable server-side authorization helpers exist | PASS — `guards.ts`, in two shapes for two call sites |
| Role/permission checks are centralized | PASS — `config/permissions.ts` is the only place a role and a capability are named together |
| Resource-level authorization is supported | PASS — `ownership.ts`, fully tested; `assertNotSelf` in use today |
| Client-side state is never the security boundary | PASS — verified live with localStorage, sessionStorage and cookies set to `admin` |

#### Routing

| Criterion | Result |
| --- | --- |
| Protected routes have authorization foundations | PASS — layout guards taking the area from one table |
| Role-specific route access is enforced | PASS — the full 5 × 4 matrix verified in a real browser |
| Unauthorized users receive a safe forbidden experience | PASS — `/forbidden`, disclosing nothing, axe-clean at both widths |
| No future feature routes are fabricated | PASS — two areas, both built. No `/doctor`, no `/receptionist`, no link to either |

#### Database

| Criterion | Result |
| --- | --- |
| Role storage is implemented securely | PASS — no grant and no policy for any client write |
| Appropriate foreign keys/constraints exist | PASS — two FKs, a unique constraint, a unique index, an enum |
| RLS policies are implemented/reviewed | PASS — per operation, no `using (true)`, verified live |
| Existing Phase 07 ownership policies continue to work | PASS — amended, not replaced; the ownership predicate is unchanged and a patient's own flow was re-verified live |
| Cross-user access is denied at the database boundary | PASS — by `profile_id` and by row id, with real JWTs |

#### Security

| Criterion | Result |
| --- | --- |
| No localStorage/sessionStorage role authorization | PASS — nothing reads either; verified live that setting them grants nothing |
| No email-based privileged authorization | PASS — no address participates in any check. The one function that returns addresses does so after checking the role |
| No client-controlled role assignment | PASS — verified live for all four roles |
| No service-role key exposure | PASS — bundle scan clean; the feature never touches the admin client |
| No sensitive authorization information leaked | PASS — asserted by test and verified against the rendered page |
| Privilege escalation tests pass | PASS — 62 live + the integration suite |
| IDOR/cross-user tests pass | PASS |

#### UX

| Criterion | Result |
| --- | --- |
| Navigation responds to authorization state | PASS — `AppNav`, from the same table the guards read |
| Forbidden experience uses the design system | PASS — tokens only; no new colour, radius or shadow |
| Mobile layouts work | PASS — nine widths measured, both new pages |
| Accessibility requirements are satisfied | PASS — live axe with real computed colour, 0 violations; one `h1`; no skipped level; targets ≥24px |

#### Engineering

| Criterion | Result |
| --- | --- |
| TypeScript remains strict | PASS |
| No unnecessary `any` | PASS — none added |
| No unnecessary client components | PASS — one, `RoleAssignmentForm`, which needs `useActionState` |
| Existing functionality remains intact | PASS — full suite and browser sweep |
| Lint / Typecheck / Tests / Build | PASS / PASS / PASS / PASS |

#### Definition of done

The trusted model is in place end to end:

```text
Authenticated User -> Application Role -> Permission
                   -> Server Authorization -> Database RLS
```

A malicious user cannot gain privileges by modifying browser state, the request
payload, the URL, a user id, a role or a permission — each verified against the
live system rather than argued. Phase 07's patient profile continues to work
securely, re-verified live. The authorization architecture does not need
redesigning for Phase 09.

---

### 11. Known issues

1. **The four test accounts use shared, well-known credentials**, including
   `admin@punarvasu.com`. They exist so every role can be exercised. **Delete
   them before this database takes real patient data.**
2. **An authorization refusal is a client-side redirect, not a 3xx.** A direct
   `fetch` of `/admin` as a patient returns 200 with a streamed loading shell;
   the redirect to `/forbidden` travels in the RSC flight payload, and a real
   browser follows it — verified for all five actors. **No protected data is in
   that response** (checked: the body contains no account, no email address and
   no admin content). Making it a real 3xx would mean resolving the role in
   `src/proxy.ts`, which runs on every prefetch, and `phase_08.md` §§24 and 31
   argue against exactly that. The affected routes are `noindex` and disallowed
   in `robots.txt`, so unlike Phase 04's soft-404 there is no SEO consequence.
   Recorded as a deliberate trade rather than a gap.
3. **`assertResourceOwner` has no call site.** By design: it is the primitive
   Phase 09 consumes the moment a record is addressed by its own id, and Phase
   07's query layer expresses the same rule structurally. It is fully tested.
4. **`src/types/database.ts` is still hand-written.** `npm run db:types`
   requires a linked project and Docker, neither available here. The shape was
   verified against the live database column by column through PostgREST.
   Regenerate when possible and treat any difference as a defect in the
   hand-written file.
5. **Receptionist and doctor have no workspace**, so signing in as either shows
   the account page and an honest sentence. Intended; their permissions arrive
   with the surfaces they protect.
6. **No staff or admin access to patient records.** A receptionist cannot look
   up a patient and a doctor cannot read one. Both depend on the appointment
   model and the treatment relationship, which do not exist; granting role-wide
   access now would be the blanket policy `phase_08.md` §§18–19 forbid.
7. **Audit is a single table, not an audit subsystem.** It covers role changes
   only, which is what `docs/SECURITY.md` §6 requires and what §27 of the phase
   permits. Authentication events, patient-record access and administrative
   actions generally belong to Phase 19; their log event names already exist.
8. **No re-authentication for high-risk actions.** `docs/SECURITY.md` §27
   suggests considering it for role changes. Not implemented; the self-exclusion
   rule plus the audit trail is the control in place today.
9. **Still no CSP.** Unchanged since Phase 02.
10. **No E2E tool, no screen-reader pass, no Lighthouse run.** Unchanged. The
    live browser checks are a script written for this phase, not a maintained
    suite.
11. **Legal pages still do not exist.** Required before the clinic handles real
    records through this website.

---

### 12. Deferred work

* Receptionist and doctor permissions, with the workspaces that need them.
* Staff and practitioner access to patient records, scoped by treatment
  relationship, with the appointment model.
* Re-authentication for high-risk administrative actions.
* The broader audit subsystem (Phase 19); role changes are already recorded.
* A staff invitation workflow. Today an account registers itself as a patient
  and an administrator promotes it, which is sufficient and auditable.
* `SUPER_ADMIN`, if multi-branch operation ever requires it. The model does not
  prevent it.
* Multiple roles per user: drop `user_roles_single_role_per_user`, revisit
  `resolveRole()` (which already carries the `limit(1)` that makes that safe),
  and decide how permissions combine.
* E2E tooling, a manual screen-reader pass, Lighthouse.
* Content-Security-Policy.
* Regenerating `src/types/database.ts` from the live project.

---

### 13. Phase status

```text
Phase 08: COMPLETE
Ready for Phase 09: YES
```

Phase 09 has not been started. Its specification is a zero-byte placeholder and
must be written before implementation.

The appointment engine can be built directly on what exists: `requireAreaAccess`
for a new area, a permission added to `config/permissions.ts` in the same change
as the surface it protects, `assertPermission` in each server action,
`assertResourceOwner` for a record addressed by its own id, and an RLS policy
using `public.has_app_role()`. None of that requires the authorization
architecture to change.
