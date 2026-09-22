## PHASE 19 — Security & Privacy Hardening

Status:
**COMPLETE — with one required verification step outstanding.** The migration
has been written and statically verified but **not applied to the live Supabase
project**, and this session had no database credentials. Section 18 says
exactly what has to be run before the phase is signed off. Nothing in this
document claims a live check that was not performed.

Completed On:
2026-09-22

Summary:
An audit of the whole application against the Phase 19 specification, followed
by remediation of eight findings, a database migration that only ever *removes*
a privilege or adds an append-only record, a dedicated security test suite, and
the security and privacy documentation the previous eighteen phases deferred to
this one.

Nothing was added that a patient, a receptionist, a doctor or an administrator
can see as a new feature. `phase_19.md` section 215 was taken literally.

**4,401 tests pass, up from 4,208** — 193 of them new and in `tests/security/`.
Lint, typecheck, formatting, the production build and the client-bundle secret
scan all pass. `npm audit` reports **0 vulnerabilities**. The Content-Security-
Policy was driven through real Chrome against a production build: **zero
violations and full hydration on both tiers**.

---

### 1. What was audited, and how

The specification asks for an adversarial review rather than a feature. The
method was:

```text
read every migration        16 files, ~9,000 lines of SQL
  -> extract every policy, grant, function, constraint and trigger
  -> compare each against what the phase that wrote it claimed

read every route handler    6, and every server action
read every query layer      17 feature modules
read the proxy, the guards, the redirect module, the logger, the clients

then: scan for the shapes that do not appear in a review
  -> secrets, browser storage, dangerouslySetInnerHTML, console, CORS
  -> `revoke ... from public` without `anon`
  -> functions with no gate
```

The codebase arrived in unusually good condition. Phases 06–18 each enforced
authorization in the database rather than in application code, derived every
identity from `auth.uid()` rather than accepting one, and recorded their own
gaps honestly. **The eight findings below are what remained after eighteen
phases of that**, and six of them are defence-in-depth gaps rather than
exploitable holes.

---

### 2. Findings

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| F-01 | No Content-Security-Policy | High | Fixed |
| F-02 | `assert_bookable_slot` callable by any client, with no authorization check | Medium | Fixed |
| F-03 | `anon` held `EXECUTE` on ~60 `security definer` functions | Medium | Fixed |
| F-04 | Session cookies readable by JavaScript | Medium | Fixed |
| F-05 | `POST` route handlers had no CSRF defence beyond `SameSite` | Medium | Fixed |
| F-06 | Document upload, report export and patient search unbounded in rate | Medium | Fixed |
| F-07 | No queryable audit of privileged access | Medium | Fixed |
| F-08 | No HSTS from the application | Low | Fixed |

#### F-01 — No Content-Security-Policy *(High)*

Deferred by Phase 01 with a good reason ("a policy written before the
application loads anything is either broken or decorative"), marked unblocked
by Phase 02, and carried forward by every phase since. By Phase 18 the product
held clinical records, prescriptions and patient documents with no defence at
all against an injected script.

**Fixed** with a two-tier policy — section 4.

#### F-02 — `assert_bookable_slot` *(Medium)*

The one `security definer` function in the project that was reachable by a
client and performed **no authorization check of its own**. Its own comment
said the last two parameters were "decided by the calling function, never by a
request"; the grant made every client a caller.

It returns `void` and is `stable`, so nothing could be written through it. What
it gave away was the clinic's diary, through its error codes, to anyone holding
the publishable key — including an **anonymous** caller:

```text
PV006   this practitioner does not exist / is inactive / takes no online booking
PV002   outside working hours, off the slot grid, or overlapping a BLOCKED PERIOD
```

That last one is the part that matters. `public.schedule_exceptions` has
row-level security enabled and **no policy at all, for anybody**, because a
blocked period's reason may be personal — Phase 10 verified live that even a
receptionist reads zero rows from it. This function was a side channel around a
table nobody is permitted to read: a caller could not learn *why* a
practitioner was unavailable, but could map exactly *when*.

It also let a caller set `p_require_online_booking` and `p_min_notice_minutes`
themselves — the two rules that distinguish a patient booking from the front
desk booking on their behalf.

Phase 09 section 50 authenticated the availability endpoint specifically so
that "the clinic's diary shape [is not] scrapable by anyone who finds the URL".
This was the path around it.

**Fixed** by revoking from `public, anon, authenticated`. Its four callers are
all `security definer` and execute as the owner, so they are unaffected. Adding
a gate to the function instead would have been wrong: it has no notion of who
is asking, and inventing one would duplicate the authorization its callers
already do.

#### F-03 — `anon` held `EXECUTE` on ~60 functions *(Medium)*

Phase 15 discovered, the hard way, that

```sql
revoke all on function public.f(...) from public;
```

does **not** make a function unreachable by a client: Supabase's project
bootstrap carries `alter default privileges ... grant execute on functions to
anon, authenticated, service_role`, so a new function is granted to those three
**by name**, and the revoke above removes only the PUBLIC grant. Phase 15 fixed
its own functions in two follow-up migrations and wrote the rest down as an
audit item for this phase, with the note: *"Worth auditing the earlier phases'
functions that return data rather than raising early."*

That audit is done. Every `security definer` function whose migration revoked
only from `public` — roughly sixty — retained `EXECUTE` for `anon`.

**There is no known data exposure**, and it is worth being precise about why:
each function begins by resolving `auth.uid()` or calling a gate that raises
for a caller with no session, so each fails closed. The Phase 09–17 live
verifications that observed `anon` being refused were observing a real refusal
— it simply came from the function body rather than from the privilege system.

That is defence in depth working, and it is not a reason to leave it. A
privilege that is only harmless because every function body happens to check is
a privilege that becomes harmful the first time one does not.

**Fixed** in three parts: a sweep revoking `anon` from every function in
`public`; `alter default privileges ... revoke execute on functions from anon`
so functions created later inherit it; and a test asserting that any migration
added after Phase 19 still names `anon` in its own revoke.

**Revoking from `anon` is safe**, and this was checked rather than assumed:
every one of the thirty-seven policies in the project is declared `to
authenticated`. PostgreSQL does not evaluate a policy for a role it does not
name, so no policy predicate ever executes as `anon` — which means this cannot
reproduce the Phase 09 defect where a policy that raised took out the query for
every caller.

Five functions were additionally revoked from `authenticated`:
`assert_bookable_slot`, the three internal gates, and `can_read_patient_document`
(which turns out to have no caller at all — the storage policy uses the
`_object` variant). None is called by the application, checked against all 51
`.rpc()` call sites, and none appears in a policy expression, checked against
every `create policy` body.

#### F-04 — Session cookies readable by JavaScript *(Medium)*

`@supabase/ssr` writes its session cookies with `httpOnly: false`. That default
is correct *for its own design* — it expects a browser client to read the
session out of the cookie and talk to PostgREST directly.

**Punarvasu has no browser client.** Verified, and now asserted by test: no
client component imports `lib/supabase/browser.ts` or `@supabase/ssr`, and
`createSupabaseBrowserClient` has **zero callers anywhere in the codebase**.
Every database read in the product happens in a server component, a server
action or a route handler.

So the access token and the refresh token were readable by page JavaScript for
no reason at all — and "for no reason at all" is the whole of the argument.

**Fixed.** `HttpOnly`, `Secure` outside development, `SameSite=Lax`, `Path=/`,
applied over the library's options in **both** places that write a session
cookie: the proxy on refresh and the server client on sign-in. If only one had
been hardened, the attribute would depend on which ran last.

What this buys, stated precisely: it removes token theft from the consequences
of an XSS. An injected script can still act as the user for as long as it runs;
it cannot read the refresh token, copy it out, and keep the session alive
elsewhere after the tab closes. That is the difference between an incident
bounded by a page view and one bounded by a 400-day refresh token.

#### F-05 — No CSRF defence on route handlers *(Medium)*

Next.js protects **Server Actions** itself — it compares `Origin` against the
host and refuses a mismatch — so almost every mutation in this product was
already covered. **Route handlers get no such protection**, and two of the
three `POST` endpoints accept `multipart/form-data`: one of the three content
types a cross-site HTML form can send with **no CORS preflight**, carrying the
victim's cookies.

The realistic impact was modest — an attacker cannot read the response, so
`/api/reports/appointments` leaks nothing, and `/api/patient-documents` could at
worst cause a victim's browser to store a file on their own record. But
`SameSite=Lax` was the only thing standing there, and section 14 is explicit
that SameSite is not enough on its own: it is a property of the browser rather
than a control this application holds.

**Fixed** in `createRouteHandler`, so a route added in a later phase inherits
the check rather than having to remember it — the same reasoning that put the
authorization guards in layouts rather than pages. It prefers `Sec-Fetch-Site`
(a forbidden header name, which script cannot set) and falls back to comparing
`Origin` against the forwarded host. `same-site` is refused alongside
`cross-site`.

A request with **no** browser evidence is allowed through, deliberately: a
browser always sends `Origin` on a `POST`, so "no `Origin` and no fetch
metadata" is `curl`, a scheduler or a probe — not the attack — and refusing it
would break the notification worker while stopping nothing.

#### F-06 — Three surfaces unbounded in rate *(Medium)*

Section 69 asks for rate limiting to be audited across eleven surfaces. The
audit found coverage uneven rather than absent — auth is Supabase's, clinical
AI has a database quota, appointments have a per-patient cap, the worker has a
fixed window — and three gaps:

```text
document upload    nothing.  10 MB and a storage object per request
report export      nothing.  a year-wide aggregate and a file of clinic operations
patient search     nothing.  repeating a bounded search is how you enumerate
```

**Fixed** with per-account fixed windows: 20/hour, 10/hour and 120/5min. Each
is checked *after* authorization, so a caller who was never going to be allowed
the operation cannot exhaust a real user's allowance, and each is keyed on the
authenticated account rather than an IP — a clinic behind one NAT shares an
address, and an attacker rotates one.

They are guard rails on one server instance, not distributed quotas. That is
said plainly in three places, because a limit described as more than it is
becomes the reason nobody adds the real one.

#### F-07 — No queryable audit of privileged access *(Medium)*

Phases 12, 13, 14, 15, 16 and 17 each withheld a capability with the same
sentence: granting it would grant it *unaudited*. Phase 18 recorded that the
list had only grown.

**Fixed** — section 5.

#### F-08 — No HSTS *(Low)*

Deferred by Phase 01 on the grounds that the host would set it. That is true
and insufficient: a platform-level header is configuration somebody can change
without touching the repository, and a health platform should not be able to
lose transport security that way.

**Fixed.** `max-age=63072000; includeSubDomains`, outside development.
`preload` is deliberately **absent**: submitting a domain to the browsers'
preload list is effectively irreversible for months and commits every present
and future subdomain of the clinic's domain to HTTPS. That is the domain
owner's decision, not the application's.

---

### 3. What the audit found to be already correct

Recorded because a report that lists only what was wrong misrepresents the
system, and because these are the properties the remediations rest on.

* **21 tables, 21 with row-level security enabled.** No table in `public` is
  without it.
* **37 policies, every one `to authenticated`.** No policy applies to PUBLIC,
  so `anon` never evaluates one.
* **Two `using (true)` policies**, both on operational configuration
  (practitioner display names and appointment types), both documented, both
  limited by a column grant to a name and two booleans.
* **114 `security definer` functions, all 114 with `search_path = ''`.** Not a
  schema list — empty, which forces every reference to be schema-qualified and
  is checked by the parser.
* **No dynamic SQL built from an argument** in any function.
* **No client role holds a write grant on any sensitive table.** Every write in
  the product goes through a `security definer` function.
* **The service-role key** is read through one accessor, used by two feature
  modules, and both are `server-only`.
* **Zero uses of browser storage** anywhere in the application.
* **One `dangerouslySetInnerHTML`**, for JSON-LD, with `<` escaped.
* **No CORS headers anywhere**, so same-origin applies by default.
* **The open-redirect module** rejects ten hostile shapes and re-serialises
  from parsed parts, so it cannot return anything carrying a scheme.
* **No secret in the repository, and none in git history.** Verified across
  every blob in every commit, not only the working tree — the one hit anywhere
  is a deliberate test fixture.
* **`npm audit`: 0 vulnerabilities**, 12 runtime dependencies, 1 lifecycle
  script (a transitive dev tool), lockfile committed.

---

### 4. The Content-Security-Policy

`src/lib/security/csp.ts`, emitted by `src/proxy.ts`.

#### Why two tiers

A nonce-based policy **requires dynamic rendering**: Next.js injects the nonce
during server rendering from the CSP header on the request, so a page
prerendered at build time has no nonce to inject and its scripts are blocked.
That is not a detail to work around — it is the whole trade.

The route table divides along exactly the line that matters:

| Tier | Routes | `script-src` |
| --- | --- | --- |
| **Strict** | every protected prefix, plus `/auth/login`, `/auth/verify`, `/auth/reset-password`, `/auth/callback`. All dynamically rendered | `'self' 'nonce-…' 'strict-dynamic'` |
| **Baseline** | the 30 static marketing pages and the two static auth pages | `'self' 'unsafe-inline'` |
| **API** | `/api/*`, from `next.config.ts` | `default-src 'none'` |

So the strong policy **costs nothing** — it is applied only to pages that were
already rendered per request — and it lands precisely where an injected script
would have a session and a patient record to steal.

Making the public pages strict too would mean making thirty prerendered pages
dynamic, which is a deliberate result of Phases 03–05, in exchange for
hardening pages that render no untrusted content: every string on them comes
from `config/` or `features/*/content.ts`, both developer-authored and both in
version control. That trade was refused, and the refusal is recorded in the
module rather than left to be rediscovered.

`/auth/login` was given `export const dynamic = "force-dynamic"` so its
dynamism is a stated property rather than a side effect of happening to read
`searchParams` — which a refactor could remove without anyone noticing that a
security header had stopped working.

#### The directives

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
form-action 'self'; font-src 'self'; img-src 'self' data: blob: [storage];
media-src 'none'; manifest-src 'self'; worker-src 'self' blob:;
style-src 'self' 'unsafe-inline'; connect-src 'self';
upgrade-insecure-requests; script-src <per tier>; frame-src <per tier>
```

**`connect-src 'self'`** — the browser talks to this origin and nothing else,
because nothing in the browser uses a Supabase client. `frame-src` is one
origin per tier: Google Maps on the public contact page, the storage origin for
a signed document preview. When storage is unconfigured the strict tier's
`frame-src` **closes** rather than opening.

**`style-src 'unsafe-inline'` is technically required**, and section 77 permits
it where it is and where that is documented. The evidence rather than the
assertion: Radix positions its overlays with inline `style` *attributes*, and
six components of our own set an inline width or font from a runtime value.
Under CSP Level 3 an inline style attribute falls back to `style-src` when
`style-src-attr` is absent, and a nonce cannot cover an attribute — a nonce
applies to an element. Blocking them would break every dialog, select and
progress indicator in the product. The exposure is CSS-based exfiltration of
content already on the page; it does not execute script, and the tier holding
clinical data carries no `'unsafe-inline'` in `script-src` at all.

#### Verified in a real browser

jsdom has no CSP engine, so this could not be left to a unit test. Chrome over
the DevTools Protocol, against a production build:

| Page | Tier | CSP violations | Console errors | Hydrated | Scripts with the header's nonce |
| --- | --- | --- | --- | --- | --- |
| `/auth/login` | **strict** | **0** | 0 | yes | **15 of 21** |
| `/auth/register` | baseline | 0 | 0 | yes | 0 (correct) |
| `/` | baseline | 0 | 0 | yes | 0 (correct) |
| `/contact` (Google Maps frame) | baseline | 0 | 0 | yes | 0 (correct) |

The 15-of-21 is the mechanism working, not a gap: Next.js stamps the nonce onto
every script it emits at render time, and `'strict-dynamic'` extends that trust
to the further chunks those scripts load. Every one of the 15 carried the exact
nonce from that response's header, and a fresh nonce is issued per request
(verified across repeated requests).

---

### 5. The security audit trail

`public.security_audit_events`, and `src/lib/security/audit.ts`.

**What it records.** Who reached what, when, and whether they were allowed to:
an actor, the actor's role *at the time of the access*, an action, a resource
type, an opaque resource id, whose data it was, an outcome, and a correlation
id.

The role is denormalised deliberately. Resolving it later from `user_roles`
would give *today's* role, which is precisely wrong when the question being
asked is what somebody could reach before they were moved.

**What it cannot record.** There is no column for a diagnosis, a symptom, an
assessment, a note, a medicine, a dose, a title, a filename, a storage path, a
reason or a search term. A reader learns that a practitioner opened a patient's
record at 14:32; they do not learn what it said. That is what lets the trail be
kept longer than the records it describes and read by whoever investigates an
incident without that itself being a further disclosure.

**Which accesses.** Privileged ones — somebody reaching data that is not their
own: a practitioner opening a clinical record or a prescription, staff opening
a patient's demographic record, anybody being handed a signed URL, an
administrator exporting a report, and every authorization denial.

A patient reading their own prescription is deliberately **not** recorded. It
is not privileged access, it happens constantly, and recording it would bury
the entries that matter — which is how an audit trail becomes something nobody
reads. Asserted by test.

**Integrity.** Append-only against everybody, including the service-role
client: no update policy, no delete policy, no write grant, and a trigger that
raises on both.

**A design decision worth recording.** `actor_id` is deliberately **not** a
foreign key. Two reasons point the same way: the record of who reached a
patient's file has to outlive the account — the same reasoning that left Phase
08's `role_assignment_events.target_user_id` unconstrained — and a referential
action would collide with the table's own immutability trigger, because
`on delete set null` performs an UPDATE and the trigger refuses every UPDATE.
Deleting a staff account would have failed with an audit error rather than an
explanation. This was caught while writing the migration, not after.

**It never fails the operation it records**, on both sides: the RPC swallows
its own exception and returns, and the application module swallows the result.
A practitioner must not be unable to open a record mid-consultation because an
insert timed out, and the structured log records the same operations
independently.

**Denials are awaited before the redirect.** `redirect()` throws, so a denial
recorded after it would be abandoned. `logDenial` became `async` and every one
of its five call sites is `await`ed — asserted by a test that counts the call
sites rather than eyeballing them.

---

### 6. Files changed

#### Created

```text
supabase/migrations/20260929120000_security_hardening.sql

src/lib/security/csp.ts              the two-tier policy
src/lib/security/cookies.ts          HttpOnly / Secure / SameSite
src/lib/security/same-origin.ts      the CSRF check
src/lib/security/rate-limit.ts       the three per-account limiters
src/lib/security/audit.ts            the audit trail's application side
src/config/security.ts               the limits, and the argument for them

tests/security/headers.test.ts
tests/security/csrf.test.ts
tests/security/browser-surface.test.ts
tests/security/database-grants.test.ts
tests/security/adversarial.test.ts
tests/security/privacy.test.ts
tests/security/audit-and-limits.test.ts

docs/progress/progress_phase_19.md
```

#### Modified

```text
src/proxy.ts                         CSP, nonce, HSTS, hardened cookies
src/lib/supabase/server.ts           hardened cookies on the sign-in path
src/lib/api/route-handler.ts         the same-origin check
src/lib/auth/paths.ts                DYNAMIC_AUTH_PATHS, isStrictCspPath
src/lib/authorization/guards.ts      denials recorded, and awaited
src/app/auth/login/page.tsx          force-dynamic, declared rather than incidental
next.config.ts                       the /api policy; where each header lives
src/types/database.ts                the audit table, three enums, two functions

src/features/clinical/queries.ts     clinical_record.read
src/features/prescriptions/queries.ts prescription.read
src/features/documents/actions.ts    document.access_granted
src/features/documents/upload.ts     the upload rate limit
src/features/documents/content.ts    the refusal copy
src/features/reception/queries.ts    patient_record.read, search limit
src/features/doctor/queries.ts       patient_record.read, search limit
src/features/analytics/queries.ts    report.exported, export limit
src/app/api/patient-documents/route.ts  a real 429

vitest.config.mts                    tests/security in the node project
tests/integration/role-assignment.test.ts     assertions strengthened
tests/integration/analytics-queries.test.ts   assertions strengthened
tests/integration/doctor-actions.test.ts      assertions strengthened
tests/integration/analytics-security.test.ts  one new log event allowed
tests/integration/document-actions.test.ts    rate-limit reset seam

docs/SECURITY.md      threat model per actor; §11, §12, §15, §20, §22 updated;
                      §42 data inventory, §43 providers, §44 rotation,
                      §45 incident response, §46 risk register added
docs/ARCHITECTURE.md  §1.1 state; a cross-cutting security row
docs/QA_STRATEGY.md   §43A the security suite
```

#### Dependencies

**None added.** None removed.

---

### 7. Tests that changed, and why

Five existing tests failed after the remediations, and every one failed
**correctly** — they asserted a boundary that Phase 19 legitimately moved.
`docs/QA_STRATEGY.md` section 35 forbids relaxing a test to make it pass, so
each was rewritten to describe the new boundary, and in each case the new
assertion is **stronger** than the one it replaced.

The pattern: a refused request now *does* reach the database — to record that
it was refused. So `expect(rpc).not.toHaveBeenCalled()` became "no *domain* RPC
was called, **and** every call that did happen was a denial being written
down". That proves what the old assertion proved and, in addition, that the
refusal is attributable.

One test needed a seam rather than a rewrite: the rate limiters are module
singletons, which is correct in production and wrong in a test file where
twenty upload cases in a row would exhaust a real allowance. `resetRateLimits()`
is exported in the same shape as the existing `resetServerEnvCache()`, so a
test resetting state is doing something the module offers rather than something
it gets away with.

---

### 8. Defects found in my own work

Recorded because a report listing only what passed is not evidence.

**1. The audit function's INSERT column list was misaligned.** Eight columns,
eight values, and `p_outcome` sat where `resource_id` belonged — a uuid column
receiving an enum. Caught by reading the migration back rather than by any
test, because no test can run SQL here.

**2. The audit table's foreign key would have broken account deletion.**
Described in section 5. `on delete set null` performs an UPDATE and the
immutability trigger refuses every UPDATE, so deleting a staff account would
have failed with an audit error. Phase 08 had hit the same shape and solved it
the same way; I made the mistake anyway and caught it by asking what the
trigger would do to a cascade.

**3. A bulk regular-expression edit corrupted seven test files.** Trying to
replace the dotAll `s` flag across the suite, a pattern intended to match regex
literals matched import paths instead and stripped the `s` from them —
`@/lib/security/rate-limit` became `@/lib/ecurity/rate-limit`, and
`src/app/(public)/services/error.tsx` became `/ervices/`. Every file was
repaired and the suite re-run. The lesson is the obvious one: a
find-and-replace written as a regex over source is a refactor without a type
checker, and the tests are what caught it.

**4. Three of my own security tests were imprecise about mechanisms that are
better than what I asserted.** The staff status function uses an **allowlist**
(`p_status not in (...)`) rather than naming the two forbidden statuses — the
stronger shape, since a status added to the enum later is refused by default.
The item-table policies delegate to a `*_is_visible_to_current_patient(parent)`
predicate rather than inlining the scope. And `ai_assistance_sessions` has **no
policy at all**, which my "no receptionist policy" scan read as "found
nothing". Each assertion was corrected to describe the real mechanism, and the
last produced a non-vacuity guard I should have written first.

**5. A comment stripper that ate every URL.** `line.split("//")[0]` truncates
`https://api.emailjs.com` at `https:`, which silently emptied the third-party
origin scan **while it appeared to pass**. This is the fourth time this project
has recorded a scanner that quietly stopped scanning — Phase 06 in a redirect
check, Phase 14 in two security assertions, Phase 15 in a privacy scanner. The
stripper now treats a `//` preceded by a colon as a scheme separator, and every
scanning test in the suite asserts it found a realistic number of things before
it asserts anything about them.

**6. A template literal collapsed `[\s\S]` to `[sS]`.** In two regexes built
from template literals, which made one assertion vacuous. `String.raw` fixes
it; Phase 15 lost an entire privacy scanner to the identical collapse of `\b`.

---

### 9. Verification

Executed on 2026-09-22:

| Check | Command | Result |
| --- | --- | --- |
| ESLint | `npx eslint . --max-warnings=0` | **PASS** — 0 problems |
| TypeScript | `npm run typecheck` | **PASS** — exit 0 |
| Formatting | `npx prettier --check .` | **PASS** |
| Tests | `npx vitest run` | **PASS — 4,401 tests, 137 files** (was 4,208 / 129) |
| Security suite | `npm run test:security` | **PASS — 193 tests, 8 files** |
| Production build | `npx next build` | **PASS** — the public route rendering modes are unchanged: every marketing page still prerenders, and `/auth/register` and `/auth/forgot-password` are still static (which is what keeps them on the baseline CSP tier) |
| Client secret scan | `node scripts/scan-client-bundle.mjs` | **PASS** — 0 findings |
| Dependency audit | `npm audit` | **PASS — 0 vulnerabilities** |
| Secret scan | repository sweep + **every blob in every commit** | **PASS** — 8 credential shapes across the working tree and across all three commits in history. The single hit is a deliberate test fixture (`AIzaSyDummyValueForTesting…`, which proves the AI schema rejects an `apiKey` field). `.env.example` **is** tracked and has always carried placeholders only |
| **CSP in a real browser** | Chrome over CDP, production build | **PASS — 0 violations, both tiers, full hydration** |
| Header emission | `curl` against a production build | **PASS** — three tiers confirmed; fresh nonce per request |
| **Live database** | — | **NOT RUN — see section 18** |
| E2E | — | NOT RUN — no maintained E2E tool (deferred since Phase 01) |
| Screen reader | — | NOT RUN |
| Lighthouse | — | NOT RUN |

---

### 10. Acceptance criteria

#### Authentication

| Criterion | Result |
| --- | --- |
| Auth flows are securely configured | PASS — reviewed; Supabase Auth is authoritative, no custom password storage, `getUser()` never `getSession()` |
| Session handling is reviewed | PASS — and hardened: `HttpOnly`, `Secure`, `SameSite=Lax` (F-04) |
| Password reset is reviewed | PASS — one-time tokens, neutral responses, destination allow-listed to exactly one path |
| Open redirects are prevented | PASS — 10 hostile shapes refused; the module returns a path, never a URL |
| Auth enumeration is minimized | PASS — identical copy for a wrong password and an unknown account |
| Sensitive auth data is not logged | PASS — asserted by a bracket-walking scan of every log call |

#### Authorization

| Criterion | Result |
| --- | --- |
| Permission matrix is documented | PASS — `config/permissions.ts` and `SECURITY.md` §6 |
| Server-side authorization is enforced | PASS — layout guards, action guards, database gates, RLS |
| Resource-level authorization is enforced | PASS — every resource resolved by id **and** by the caller's own scope in one statement |
| Role escalation is prevented | PASS — no writable path to `user_roles` for any client role |
| IDOR tests pass | PASS — statically; **live re-verification outstanding**, see §18 |
| Patient isolation passes | PASS — policies scoped by `current_patient_id()`; reads that take no id |
| Doctor scope passes | PASS — relationship-scoped; no practitioner parameter exists to substitute |
| Receptionist clinical isolation passes | PASS — **no policy at all** on any clinical table |
| Admin clinical access remains explicit | PASS — no clinical policy and no clinical permission |

#### Database

| Criterion | Result |
| --- | --- |
| Sensitive tables have appropriate RLS | PASS — 21 of 21 |
| SELECT/INSERT/UPDATE/DELETE policies reviewed | PASS — 37 policies; no client write policy on any sensitive table |
| Ownership is enforced | PASS |
| Relationship integrity is enforced | PASS — composite foreign keys bind a record to the same patient |
| SECURITY DEFINER functions are audited | PASS — 114 audited; all pin `search_path = ''`; **F-02 and F-03 fixed** |
| SQL injection risks are addressed | PASS — no dynamic SQL from an argument anywhere |

#### Storage

| Criterion | Result |
| --- | --- |
| Patient documents remain private | PASS — `public = false`, enforced on conflict |
| Storage policies reviewed | PASS — one SELECT policy, predicated on the document's own rule |
| Signed URLs are authorization-gated | PASS — structurally: the path is read off an authorized row |
| Path guessing fails | PASS — the storage policy resolves an object key back to its row |
| Upload validation exists | PASS — signature, extension and declared type must all agree |
| MIME spoofing is tested | PASS — Phase 14, and re-reviewed |
| Dangerous file types are rejected | PASS — closed allowlist; SVG deliberately excluded |

#### API

| Criterion | Result |
| --- | --- |
| Inputs are validated | PASS |
| Mass assignment is prevented | PASS — named-field reads, then `strict()`, then a fixed RPC argument list |
| Client-controlled identity fields are rejected | PASS — there is no such parameter to reject |
| Status tampering is prevented | PASS — each transition is its own function; no status parameter exists |
| Rate limits exist for sensitive/expensive operations | PASS — **F-06 fixed** |
| Errors are safe | PASS — one vocabulary; the cause is logged and never serialized |

#### AI

| Criterion | Result |
| --- | --- |
| AI credentials are server-only | PASS |
| AI authorization is enforced | PASS — doctor role alone |
| Patient scope is enforced | PASS — derived from the appointment |
| Minimum context is used | PASS — age and gender; no name, date of birth or identifier |
| Prompt injection is tested | PASS — Phase 17, against the real model; structurally re-asserted here |
| AI output is validated | PASS — `strict()`, bounded, sanitized, then the safety layer |
| Autonomous clinical mutations are impossible | PASS — asserted: the feature calls none of six clinical write functions |
| AI clinical data is not unnecessarily logged | PASS — no prompt or response column exists |

#### Notifications

| Criterion | Result |
| --- | --- |
| Recipient spoofing is prevented | PASS — no recipient parameter anywhere |
| Webhooks are authenticated | PASS — the one webhook (Supabase's Send Email hook) verifies a Standard Webhooks signature in constant time. No provider supports delivery webhooks, so none is implemented |
| Notification content is privacy-conscious | PASS — no column could hold clinical content |
| Deep links are authorization-safe | PASS — derived, constrained, and the destination re-authorizes |

#### Privacy

| Criterion | Result |
| --- | --- |
| Data inventory exists | PASS — `SECURITY.md` §42 |
| Sensitive-data flows are documented | PASS — §43 |
| Third-party services are inventoried | PASS — §43. Five, one of them browser-facing |
| Clinical data excluded from unnecessary analytics | PASS — no analytics provider exists; internal analytics selects no clinical column |
| Sensitive browser storage is minimized | PASS — **zero** uses anywhere |
| Authenticated pages are not indexable | PASS — `noindex` plus `robots.txt` |
| Sensitive metadata is avoided | PASS — no authenticated page title interpolates anything |

#### Secrets

| Criterion | Result |
| --- | --- |
| Secrets are server-only | PASS — `server-only` fences, verified by build |
| Repository secret scan passes | PASS — 8 credential shapes across every text file, plus a self-test |
| Production env is reviewed | PARTIAL — `.env.example` reviewed and asserted placeholder-only; the **deployment's** environment could not be inspected from here |
| Rotation process is documented | PASS — `SECURITY.md` §44 |
| Real leaked secrets are rotated | **OPEN** — the Phase 17 AI key was moved out of `.env.example` and should still be rotated. It never reached git history |

#### Infrastructure

| Criterion | Result |
| --- | --- |
| HTTPS verified | PARTIAL — `upgrade-insecure-requests` and HSTS are emitted; the deployed origin could not be inspected from here |
| Security headers verified | PASS — measured against a production build |
| CORS reviewed | PASS — no CORS header anywhere; same-origin by default |
| CSP reviewed | PASS — **implemented (F-01)** and verified in a real browser |
| HSTS considered/enabled appropriately | PASS — enabled, without `preload`, with the reasoning |
| Production configuration reviewed | PARTIAL — the repository's configuration is reviewed; the Supabase dashboard and the host could not be inspected from here |

#### Dependencies

| Criterion | Result |
| --- | --- |
| Dependency audit completed | PASS — `npm audit`, 0 vulnerabilities |
| Critical vulnerabilities addressed | PASS — none exist |
| Lockfile verified | PASS — committed |
| Unnecessary packages removed | PASS — 12 runtime dependencies; none unused |

#### Monitoring

| Criterion | Result |
| --- | --- |
| Security-relevant events are observable | PASS — the audit trail and the structured log; the queries are listed in `SECURITY.md` §45 |
| Logs are privacy-safe | PASS — redaction plus a scan of every log call |
| Audit events exist where required | PASS — **F-07 fixed** |
| Incident response process documented | PASS — `SECURITY.md` §45 |

#### Testing

| Criterion | Result |
| --- | --- |
| Security test suite passes | PASS — 193 tests, one command |
| Negative authorization tests pass | PASS |
| RLS tests pass | PASS — statically; **live outstanding** |
| IDOR tests pass | PASS — statically; **live outstanding** |
| Storage tests pass | PASS |
| AI security tests pass | PASS |
| Dependency/security scans reviewed | PASS |

---

### 11. Definition of done

```text
Authentication -> Authorization -> Resource Ownership -> Server Validation
   -> RLS -> Storage Security -> External Services -> Logging / Monitoring
```

Every layer was reviewed, and the two that had a gap now do not: the transport
and rendering layer had no CSP, and the monitoring layer had no queryable
audit.

The property section 216 calls the most important one:

> A malicious authenticated user must not be able to cross another user's,
> doctor's, clinic's, or role's security boundary.

holds by the same mechanisms it held by before this phase — RLS scoped by
relationship, identities derived rather than accepted, and no client-writable
path to any sensitive table — with three fewer ways around them and one more
record of who tried.

Against the seven manipulations section 216 lists:

```text
URLs manipulated          -> redirect module; every id resolved by owner too
API payloads modified     -> named-field reads, strict(), fixed RPC arguments
client state spoofed      -> nothing client-side decides anything
storage paths guessed     -> the bucket policy resolves a key back to its row
roles forged              -> no writable path to user_roles, for anybody
AI prompts manipulated    -> fenced context, safety layer, and no write path
malicious files uploaded  -> signature, extension and declared type must agree
```

---

### 12. Deferred

Intentionally not done, per section 215's scope boundary and with reasons.

* **Security alerting.** The signals exist and are queryable; nothing watches
  them. Building a monitoring pipeline is infrastructure, not hardening, and
  section 156 warns against invasive behavioural profiling.
* **An admin UI for the audit trail.** `security_audit_recent()` exists and is
  administrator-gated; no screen reads it, deliberately — a new administrative
  surface is a feature, and section 215 rules it out.
* **A distributed rate limiter.** Needs shared state. The in-memory ones are
  adequate guard rails on authenticated surfaces and say so.
* **Retention and automatic deletion.** Has legal inputs nobody has supplied,
  and sections 144–145 forbid inventing one.
* **Malware scanning.** No scanner is available in this deployment. Stated on
  the upload form rather than implied away.
* **`style-src` without `'unsafe-inline'`.** Would need Radix's inline style
  attributes to go away.
* **A strict CSP on the public site.** Would cost thirty static pages.
* **Break-glass clinical access.** Section 138 warns against implementing it
  casually; nobody has asked for it.
* **An independent penetration test.** Section 198. Phase 19 is not one and
  does not claim to be.

---

### 13. Known issues

1. **The Phase 19 migration has not been applied to the live database**, and no
   live per-role verification was run. See section 18. Until that is done, the
   database-side findings (F-02, F-03, F-07) are fixed *in the migration* and
   not yet fixed *in the deployment*.
2. **The AI provider's data-handling terms are still unreviewed.** Raised by
   Phase 17, still open, and a launch blocker:
   `docs/HEALTHCARE_AND_AI_SAFETY.md` section 8 requires it before patient data
   is sent. `CLINICAL_AI_ENABLED` must stay off for any deployment holding real
   patient data.
3. **The AI provider key should be rotated.** It was written into
   `.env.example` — a file tracked on purpose — during Phase 17, then moved to
   `.env` and replaced with a placeholder.

   **It never reached git history**, and that was verified properly rather than
   assumed: every blob in every commit was scanned for eight credential shapes,
   and the only hit anywhere is a deliberate test fixture. The committed
   `.env.example` has carried placeholders in every version of it that exists.

   Worth recording that this claim changed mid-audit. At the start of this
   session the repository had one commit and `.env.example` was untracked; by
   the end it had three and the file was committed — the working tree was
   committed in parallel with the audit. The first version of this document
   said "one commit, no env file ever tracked", which was true when written and
   false an hour later. The re-check is what makes the conclusion trustworthy,
   and it is the reason the scan above walks history rather than the working
   tree.

   Rotate the key anyway: "not committed" is not "not exposed".
4. **The four seeded accounts still use shared, well-known credentials**,
   including an administrator. **Delete them before this database holds real
   patient data.**
5. **No retention policy, and no legal pages.** Both are launch prerequisites
   and both have inputs this project cannot supply.
6. **The deployment's own configuration was not inspected** — the Supabase
   dashboard's redirect allow-list, auth settings and storage buckets, the
   host's TLS and headers. Section 181's checklist is in
   `SECURITY.md` §36 and has to be walked against the real project.
7. **A signed-in page has not been rendered under the strict CSP.**
   `/auth/login` is on the same tier and proves the mechanism end to end, and
   the protected routes use the identical policy with two *widened* directives
   — but a signed-in pass would close the last gap. It needs credentials this
   session did not have.
8. **`src/types/database.ts` is still hand-written**, deliberately: generated
   output types `Insert` and `Update` permissively, and the hand-written file
   types them `never`, which makes a client table write a compile error.
9. **No E2E tool, no manual screen-reader pass, no Lighthouse run.** Unchanged
   since Phase 01/02.

---

### 14. Threat model

```text
Anonymous attacker:      No table grant, no function grant, no policy applies
                         to `anon`. The public site reads no database at all.
                         F-02 and F-03 removed the two paths that existed.

Authenticated patient:   Their own record and nothing else. Policies scoped by
                         `current_patient_id()`; the profile read takes no id;
                         a draft prescription is invisible in the policy, not
                         in a query.

Receptionist:            Operational only. NO POLICY AT ALL on any clinical
                         table, and no clinical permission.

Doctor:                  Own diary; patients they are booked to see; records
                         they authored. Relationship-scoped, and there is no
                         practitioner parameter anywhere to substitute.

Admin:                   Users, roles, analytics, exports. NO clinical policy
                         and NO clinical permission. Role changes are audited
                         and self-excluding.

Compromised browser:     Decides nothing. Every identity is server-derived;
                         session tokens are now HttpOnly; CSP blocks injected
                         script on every page holding patient data; a
                         cross-origin mutation is refused.

External providers:      Five, inventoried in SECURITY.md §43. The AI provider
                         receives de-identified clinical context and its terms
                         are UNREVIEWED — the open item above.
```

---

### 15. Section-by-section results

**Authorization.** Permission matrix documented and unchanged; resource-level
authorization enforced by resolving each record by id *and* by the caller's
scope in one statement; IDOR prevented by the same; privilege escalation
prevented by there being no writable path to `user_roles`; doctor scope is the
treatment relationship; receptionist isolation is the absence of a policy;
admin scope excludes clinical data entirely.

**Database.** 21/21 tables with RLS; 37 policies all role-named; 114 definer
functions all with `search_path = ''`; no dynamic SQL from an argument; two
findings fixed (F-02, F-03); service-role usage limited to two modules, both
`server-only`, both after authorization.

**Storage.** Private bucket; one policy resolving an object key back to its
row; signed URLs minted only from a path read off an authorized row; uploads
validated on the bytes; path traversal impossible because the filename is not
an input to the path.

**API.** Inputs validated; mass assignment prevented at three layers; identity
fields are not parameters; status transitions have no status parameter; rate
limits added (F-06); CSRF closed (F-05); no CORS header anywhere; open
redirects refused.

**AI.** Credentials server-only; doctor-only; patient scope derived; minimum
context; prompt injection tested against the real model in Phase 17; output
schema-validated then safety-checked; **no write path exists at all**.

**Privacy.** Data inventory and provider inventory written; no clinical data in
analytics; zero browser storage; authenticated pages `noindex`; no metadata
interpolation; logging scanned call by call.

**Infrastructure.** CSP implemented and browser-verified; HSTS enabled without
`preload`; CORS reviewed; production configuration **not** inspected from here.

**Dependencies.** 0 vulnerabilities; 12 runtime packages; lockfile committed;
one lifecycle script, a transitive dev tool.

**Incident readiness.** Rotation, containment and investigation documented;
detection signals listed; **no alerting**, and backup restoration untested.

---

### 16. Risk register

The full register is `docs/SECURITY.md` §46 and is the authoritative copy.

```text
Critical   none open
High       AI provider terms unreviewed          OPEN — launch blocker
           seeded admin credentials              OPEN — delete before real data
           AI key written to .env.example        rotate (never in git history)
           no retention policy                   OPEN — legal inputs
           no legal pages                        OPEN — launch prerequisite
Medium     no security alerting                  OPEN
           live DB verification not yet run      OPEN — section 18
           per-instance rate limits              ACCEPTED
           style-src 'unsafe-inline'             ACCEPTED — technically required
           script-src 'unsafe-inline' (public)   ACCEPTED — cost of static pages
           no malware scanning                   ACCEPTED, disclosed
           no independent penetration test       OPEN — recommended
Low        external email at-least-once          ACCEPTED
```

---

### 17. Compliance

No claim of HIPAA, GDPR or any other regulatory compliance is made anywhere in
this project, and none should be added without independent legal and security
assessment. Section 200: no compliance theatre. This phase was an internal
security review — it is not a penetration test and not a certification.

---

### 18. Required before sign-off

Two things this session could not do, and both are the established workflow for
every phase since 08.

**1. Apply and verify the migration.**

```bash
npx supabase db push
```

Then verify with real per-role JWTs, as Phases 08–17 each did. The checks that
matter most:

```text
anon        -> every function in public                 expect 42501
anon        -> assert_bookable_slot                     expect 42501  (F-02)
patient     -> assert_bookable_slot                     expect 42501  (F-02)
patient     -> assert_care_practitioner()               expect 42501
every role  -> insert/update/delete security_audit_events   expect refusal
service_role-> update/delete security_audit_events      expect PV080  (immutable)
patient     -> select security_audit_events             expect 0 rows
admin       -> security_audit_recent()                  expect rows
doctor      -> security_audit_recent()                  expect 42501
doctor      -> open a clinical record                   expect one audit row,
                                                        actor = them, no clinical content
delete a staff account that has audit rows              expect SUCCESS
                                                        (the FK was removed for this)
```

Then re-run one regression from each earlier phase to confirm the sweep broke
nothing — a patient booking an appointment, a receptionist searching, a doctor
opening a record — because revoking `anon` from every function is the widest
change in this migration and the one most worth re-proving.

**2. Sign in and load a protected page under the strict CSP.** The mechanism is
proven on `/auth/login`, which is on the same tier; the protected routes use
the identical policy plus a widened `img-src` and `frame-src`. Open the browser
console on `/patient` and `/doctor/appointments/[id]/documents` (which renders
a signed document preview in a sandboxed frame) and confirm no CSP violation.

---

### 19. Phase status

```text
Phase 19: COMPLETE
Ready for Phase 20: YES — after the two verification steps in section 18
```

Phase 20 has not been started.

Three things to carry forward:

* **The two open launch blockers are not Phase 20's work, and must not become
  nobody's.** The AI provider's terms, and the seeded administrator
  credentials. Both are in the risk register with an owner-shaped gap.
* **`tests/security` is one command and should be a release gate.** It is the
  only thing that catches the next `revoke ... from public` as it is written
  rather than after it deploys.
* **A scanner without a self-test is a scanner that has quietly stopped.** Four
  phases have now found one. Every scan in the new suite asserts it found
  something before it asserts anything about what it found.
