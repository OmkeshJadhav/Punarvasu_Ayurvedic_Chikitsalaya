## PHASE 06 — Authentication & Identity Foundation

Status:
COMPLETED — verified against the live Supabase project

Completed On:
2026-09-17

Summary:
Built Punarvasu's first authenticated experience on Supabase Auth:
registration, email verification and resend, sign-in, forgotten-password and
password reset, sign-out, session refresh, a single server-side current-user
abstraction, a protected route group, a safe-redirect module, auth-aware public
navigation, and the first database migration — `profiles`, the role enum, and
the triggers and policies that make a role something only the database can
grant.

Authorization was deliberately **not** built. Phase 06 answers "who is this
user"; Phase 08 answers "what may they do". The role is resolved and exposed
so that Phase 08 has something to build on, and nothing in this phase grants
access on the strength of it.

865 tests pass, up from 599. Live axe runs against the production build report
zero violations at 390px and 1280px on all five auth pages with real computed
contrast, and there is zero horizontal overflow at nine widths.

The migration has been applied to the live Supabase project and the whole flow
has been driven through the real forms against the real Auth server. That run
found one serious bug — **password recovery never reached the reset page** —
which is fixed and regression-tested. See *Live verification*.

**What remains unverified is the mail leg only:** Supabase's built-in sender is
exhausted and only delivers to organisation members, and the callback URL is
not yet in the project's redirect allow-list. Both are dashboard settings.

---

### Repository assessment before starting

Phases 01–05 left a complete public site and the infrastructure this phase
needed. Reused rather than rebuilt: `Field`, `Input`, `Button`, `Alert`,
`Card`, `Separator`, `Container`, `Section`, `Logo`, `SkipLink`, the token
system, `AppError`, `parseInput`, the shared validation primitives, the
structured logger with its redaction, `createRouteHandler`, the API envelope,
and the three separated Supabase clients.

Four findings shaped the work:

* **`src/lib/supabase/server.ts` already carried a comment** saying session
  refresh "happens in middleware, which is added with authentication; until
  then there is no session to refresh". Phase 01 recorded the same gap as a
  risk. This phase closes it.
* **`SiteHeader` already had an `accountSlot` prop**, unused since Phase 02 and
  documented as being for exactly this. Nothing in the header changed.
* **`supabase/migrations/` was empty.** This phase writes the first migration
  in the project.
* **In Next.js 16 the file convention is `proxy.ts`, not `middleware.ts`.**
  `node_modules/next/dist/docs/.../proxy.md` records the rename and marks the
  old name deprecated. Writing `middleware.ts` from memory would have produced
  a file the framework ignores — and an application whose sessions silently
  expire an hour into use.

---

### Routes

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/auth/login` | Dynamic | Sign in. Reads `next`. |
| `/auth/register` | Static | Create an account. |
| `/auth/verify` | Dynamic | "Check your email", plus resend. Reads the pending-email cookie. |
| `/auth/forgot-password` | Static | Request reset instructions. |
| `/auth/reset-password` | Dynamic | Choose a new password. Gated on a verified session. |
| `/auth/callback` | Dynamic (route handler) | The single entry point for every emailed link. |
| `/account` | Dynamic | The authenticated landing. |
| `/api/auth/session-status` | Dynamic | One boolean, for the header's account control. |

Every `/auth/*` page carries `robots: { index: false, follow: false }`,
inherited from the auth layout so a page added later is excluded by default.
`/auth/`, `/account`, `/patient/`, `/staff/` and `/admin/` are disallowed in
`robots.txt`. Neither is an access control; both exist so a sign-in form does
not become a search result.

**All thirty public pages remain static.** That was a constraint, not an
accident — see *The account control* below.

---

### Authentication methods

**Email and password only.**

`phase_06.md` section 21 permits OTP/magic-link "if enabled by the product
architecture" and warns against implementing it merely because it is
technically available. Nothing in `PRODUCT_SPEC.md` or `ARCHITECTURE.md`
requires passwordless sign-in, and a second path would mean two things to
explain to a patient, two sets of failure states, and two flows to keep secure
for no requirement anybody has stated. Not implemented.

The callback route is nevertheless written so that adding it later is a change
to one `switch`: it already handles both the PKCE `code` shape and the
`token_hash` + `type` shape, because which one Supabase sends depends on the
project's email templates and a project can be reconfigured after this ships.

---

### Files added

```text
src/proxy.ts
src/lib/auth/{paths,redirect,current-user,callback-url}.ts
src/lib/auth/redirect.test.ts
src/features/auth/{actions,content,errors,types,validation,pending-email}.ts
src/features/auth/{errors,validation}.test.ts
src/components/auth/{account-nav,auth-form-message,auth-page-heading,
    forgot-password-form,login-form,password-field,register-form,
    resend-verification-form,reset-password-form,sign-out-button,
    submit-button}.tsx
src/app/auth/layout.tsx
src/app/auth/{login,register,verify,forgot-password,reset-password}/page.tsx
src/app/auth/callback/route.ts
src/app/(app)/layout.tsx
src/app/(app)/account/page.tsx
src/app/api/auth/session-status/route.ts
supabase/migrations/20260917120000_auth_identity_foundation.sql
tests/integration/{auth-callback,auth-session,auth-proxy}.test.ts
tests/components/auth.test.tsx
docs/progress/progress_phase_06.md
```

### Files modified

```text
src/types/database.ts            profiles, app_role, current_app_role
src/app/(public)/layout.tsx      accountSlot={<AccountNav />}
src/app/robots.ts                /auth/, /account, /patient/, /staff/, /admin/
supabase/config.toml             callback redirect URL; otp_expiry 3600 -> 900
docs/ARCHITECTURE.md             section 1.1 state, section 5.2 implementation
docs/SECURITY.md                 section 5 implemented controls
docs/QA_STRATEGY.md              authentication coverage table
docs/DESIGN_SYSTEM.md            components/auth/ component index
docs/PUNARVASU_MASTER_SPEC.md    status, routes, phase table
```

### Dependencies

**None added.** Supabase Auth arrives through `@supabase/supabase-js` and
`@supabase/ssr`, both present since Phase 01. No form library, no auth library,
no rate limiter, no CAPTCHA.

---

### Database

The first migration in the project:
`supabase/migrations/20260917120000_auth_identity_foundation.sql`.

| Object | Purpose |
| --- | --- |
| `public.app_role` | The canonical four-role enum from `SECURITY.md` section 6. A database enum, not text validated in application code. |
| `public.profiles` | One row per authenticated user. Holds the role, plus `full_name` and `phone`. **No clinical column exists.** |
| `handle_new_user()` | Creates the profile when Supabase Auth creates a user. |
| `profiles_guard_role()` | Raises if a non-privileged caller changes `role`. |
| `set_updated_at()` | Ordinary timestamp maintenance. |
| `current_app_role()` | `security definer`, `stable`. For Phase 08's policies. |
| RLS | Enabled, deny by default, per-operation policies. |

Four decisions worth stating:

1. **The role is hard-coded to `patient` in the trigger.** It is *not* read
   from `raw_user_meta_data`, which the client supplies at sign-up. Reading it
   there would let a registration form ask for the admin role and be given it.
   Staff accounts are created by an administrator in Phase 08.

2. **Role immutability is enforced three times over.** `DATABASE.md` section
   4.1 requires more than an RLS `USING` clause, and rightly: a `USING` clause
   decides *which rows* may be updated, not *which columns*, so a patient
   passing the check on their own row could set `role = 'admin'` in the same
   statement. So: the `UPDATE` grant is column-scoped to `full_name` and
   `phone`; the guard trigger raises on any role change by a non-privileged
   caller; and the generated `Update` type omits `role`, making it a compile
   error as well.

10. **`anon` is granted nothing at all.** A signed-out request has no business
   reading any profile, and expressing that only through RLS would be one
   policy edit away from a leak.

4. **No staff or admin read policy.** That belongs with the permission matrix
   and the audit trail that make it accountable — Phase 08.

`src/types/database.ts` was updated **by hand** to match, because no project is
linked and `npm run db:types` cannot run. The file says so and says to
regenerate. Treat any difference between generated output and the hand-written
version as a defect in the hand-written one.

---

### Session architecture

```text
Browser cookie  ──►  src/proxy.ts          getUser() verifies upstream;
                                            writes refreshed cookies
                          │                 (the only place that can)
                          ▼
                  Server component / action / route handler
                          │
                          ▼
                  getCurrentUser()          getUser() again, memoised per
                          │                 render pass with React cache
                          ▼
                  profiles.role             read from the database, under RLS
                          │
                          ▼
                  CurrentUser { id, email, emailVerified, role, displayName }
```

**`getUser()`, never `getSession()`.** `getSession()` decodes the session
cookie without verifying it; on the server that means trusting a request
header. `getUser()` sends the access token to the Auth server, which verifies
its signature. Everything downstream rests on that, so the round trip is the
price of the guarantee rather than an inefficiency to remove.

**Why the proxy is not optional.** Supabase access tokens are short-lived, and
a server component cannot write cookies — so nothing else in the App Router can
persist a refreshed token. Without `src/proxy.ts` a signed-in patient is
quietly signed out an hour into using the site. Phase 01 recorded this gap;
this phase closes it. The proxy runs on all pages, not only protected ones,
because a session refreshed only while browsing the portal expires while
someone reads the treatments page.

**Sign-out revokes globally.** `signOut()` at Supabase's default `global`
scope: every refresh token for the account, not just this browser's. It is the
security-favouring choice (`AGENTS.md` section 38 ranks security above
convenience) and it makes the back-button guarantee unconditional — after
signing out, no stored session anywhere can be refreshed back into access,
whatever a cached page shows.

**A password change revokes other sessions** (`scope: "others"`). If the reset
happened because someone else knew the old password, leaving their session
alive would make the reset pointless.

**The role is `AppRole | null`, and `null` is never defaulted to `patient`.**
It means "identity known, role not resolvable" — a missing row, or an unapplied
migration. Defaulting would be an authorization decision taken on a guess.
Phase 08 reads `null` as "no permissions", which fails closed.

---

### Protected-route architecture

Three layers, in the order they run:

| Layer | What it does | Is it the boundary? |
| --- | --- | --- |
| `src/proxy.ts` | Redirects an unauthenticated request away from a protected prefix, before the route renders. Sets `private, no-store`. | **No.** Optimistic only. |
| `src/app/(app)/layout.tsx` | `await requireUser()` before any child renders. | **Yes.** |
| Postgres RLS | A query returns only rows the caller may see. | **Yes**, and the last word. |

The proxy contains no role check and no database query, deliberately: it runs
on prefetches too, so a query there would be a query per hovered link, and an
authorization decision taken that far from the data is one taken without it.
Next.js's own guidance says the same.

**It fails open, and that is safe** *because* it is not the boundary. If
Supabase is unconfigured or unreachable the proxy lets the request through
rather than locking the site; `requireUser()` then treats an unresolvable
session as no session and redirects. The failure mode is a signed-out user
reaching a page that immediately sends them to sign in — never a signed-out
user reaching protected content. Asserted by test.

`PROTECTED_PATH_PREFIXES` lists `/account`, `/patient`, `/dashboard`,
`/portal`, `/staff` and `/admin` — several of which have no routes yet. Listing
them ahead of the features means a later phase inherits protection instead of
having to remember it.

---

### Redirect security

`src/lib/auth/redirect.ts`. `redirect(searchParams.get("next"))` appears
nowhere in this codebase.

`safeRedirectPath()` accepts a destination only if it parses as an absolute
path on this origin, and **re-serialises it from its parsed parts**. Both
halves matter: parsing rejects the hostile shapes, and re-serialising means
anything the parser normalised away cannot survive into the response. The
function returns a *path*, never a URL — there is no input to it that can
produce a different origin.

Rejected: absolute URLs, protocol-relative (`//host`) and backslash (`/\host`)
forms, non-path schemes, encoded variants (`/%2f%2fhost`), control characters,
traversal, anything under `/auth` or `/api`, non-strings, and anything over 512
characters. A repeated `next` parameter is discarded entirely rather than
having its first value taken, because two copies is a smuggling attempt rather
than something a person does.

Traversal is **refused rather than resolved**, which is stricter than necessary
and deliberate: `new URL()` turns `/../etc/passwd` into `/etc/passwd`, which is
still same-origin and therefore not an open redirect — but it is a different
destination from the one requested, arrived at silently, and no legitimate link
this application produces contains a `..` segment.

Validation happens at **both** ends. The login page validates before rendering
a hidden field, so a hostile value never reaches the HTML; the server action
validates again before redirecting, because a form post does not require our
page to have rendered it.

Email link origins come from `NEXT_PUBLIC_SITE_URL`, never from the request's
`Host` header (`lib/auth/callback-url.ts`). Reading the origin off the request
is the obvious way to make links work across localhost, previews and
production, and it is host header injection: an attacker who sends
`Host: attacker.example` with someone else's address makes the clinic's own
mail server send that person a genuine-looking reset link pointing at the
attacker's domain.

---

### The account control, and why the public site is still static

`phase_06.md` section 38 asks the public navigation to reflect authenticated
state. Reading the session in the public layout would do that — and would make
all thirty statically prerendered public pages render per request, undoing a
deliberate result of Phases 03–05.

So `AccountNav` is a small client component that asks
`/api/auth/session-status` once after hydration. The endpoint answers
`{ authenticated: boolean }` and nothing else: no id, no email, no name, no
role, no token. There is nothing in it to leak and nothing worth forging,
because nothing is authorized on the strength of it — it chooses which of two
links the header draws.

It shows "Sign in" or "My account". Never a name, never an email, never a
patient identifier (`phase_06.md` section 39): the public header is read over
someone's shoulder in a waiting room.

Someone who flips the value in a debugger gets a link labelled "My account"
that leads to a route which redirects them to sign in. The worst outcome
available is a misleading link on their own screen.

---

### Account enumeration

| Flow | Behaviour |
| --- | --- |
| Sign-in | "The email or password is incorrect" whether the account is missing or the password is wrong. Asserted by test. |
| Forgotten password | The same neutral confirmation **always** — including when the mail provider fails. The real outcome is in the server log. |
| Resend verification | Likewise neutral. |
| Expired / used / invalid link | One message. They are the same instruction to the user, and distinguishing them is an oracle about a token the caller may not hold. |
| Registration | **The one exception**, and it is conditional. |

The registration exception is worth being precise about. Supabase's
enumeration-safe default, with email confirmation enabled, is to return an
obfuscated success for an address that already exists — and that is the
recommended project configuration. A project *can* be configured to return
`user_already_exists` instead; when it does, `describeAuthFailure` maps it to a
message that confirms nothing beyond "try signing in, or reset your password"
and points at recovery rather than at the account. Which path a deployment
takes is a Supabase setting, not a code path chosen here.

---

### Error handling

One mapper, `features/auth/errors.ts`, and every authentication failure in the
application goes through it. A provider message is never shown:
`AuthApiError: Invalid login credentials` is the provider's words; *"The email
or password is incorrect. Please check your details and try again."* is ours.
The provider error travels in `AppError.cause`, which the logger records and no
response serialises.

`describeAuthFailure` also returns a `logEvent` — a stable, low-cardinality
category such as `auth.invalid_credentials`. Asserted to contain no provider
text and no email address: an authentication log that records who tried to sign
in is a list of the clinic's patients.

Network failure is recognised separately and gets copy naming the user's
connection as something they can check, and nothing about our infrastructure.

---

### What is never logged

Passwords, OTPs, reset tokens, verification tokens, access tokens, refresh
tokens, and email addresses. The structured logger redacts by key name as a
safety net, but these actions do not hand it those values in the first place.

Asserted: the callback test plants a secret code and a provider message
containing a token fragment, and checks that neither reaches the log, the
redirect target, or the response body.

The just-registered address is carried to the "check your email" page in a
short-lived `httpOnly` cookie rather than a query parameter — a URL is written
to every proxy's access log, kept in browser history on what may be a shared
computer, and sent as a `Referer`.

---

### Accessibility

**Live, against the production build**, via the Chrome DevTools Protocol with
`axe-core` injected into the real page — the only way to measure computed
colour contrast. Nothing was added to `package.json`; same technique as Phases
03–05.

| Page | 390px | 1280px |
| --- | --- | --- |
| `/auth/login` | **0 violations** | **0** |
| `/auth/register` | **0** | **0** |
| `/auth/forgot-password` | **0** | **0** |
| `/auth/verify` | **0** | **0** |
| `/auth/reset-password` | **0** | **0** |

Also measured live: exactly one `<h1>` and no skipped level on every page;
every interactive target at least 24px at 390px; a visible 3px focus outline;
focus order matching visual order; zero running animations under
`prefers-reduced-motion: reduce`.

The password toggle was driven in a real browser: it reveals the password,
relabels itself from "Show password" to "Hide password", reports
`aria-pressed`, re-hides, and **does not submit the form** (verified by
listening for a `submit` event).

In component tests: axe over the password field in its error state, the form
message, the heading, and an assembled card with the `region` rule enabled;
plus explicit keyboard assertions (Tab reaches the toggle, Enter and Space
operate it), error association (`aria-invalid`, `aria-describedby`,
`role="alert"`), and that two password fields on one page do not collide ids.

**Not done:** no manual screen-reader pass (NVDA/VoiceOver). Unchanged since
Phase 02.

---

### Responsive

Horizontal overflow measured at **320, 375, 390, 430, 768, 1024, 1280, 1440 and
1920px** on all five auth pages plus `/`, `/services` and `/account`: **none at
any width on any page.**

The auth card is a single centred column capped at `max-w-lg`, so there is no
multi-column layout to break. Every submit button is `block` on mobile and
sized `lg` (52px). The password toggle is 44×44px and sits inside the input's
padding, so a long password never runs underneath it.

---

### Defects found and fixed during verification

**1. Landmark violations on every auth page.** *(real, found by live axe)* The
brand mark and the footnote in the auth layout were bare `<div>`s outside any
landmark, so a screen-reader user navigating by landmark would never reach
them. axe reported `region` on all five pages at both widths. They are now
`<header>` and `<footer>`. Re-measured: 0 violations.

**2. Undersized cross-flow links.** *(real, found by live measurement)*
"Create an account" on the login page and "Sign in" on the register page
measured 17px tall at 390px. WCAG 2.2 SC 2.5.8 exempts a link inside a
sentence, so this was technically conformant and still a poor target for the
single most likely next action on the page. The prompt now sits on its own line
and the link is `min-h-11`. Re-measured: all targets ≥24px.

**3. A Next.js control-flow signal was being swallowed.** *(real, found in the
build log)* The first production build logged
`auth.current_user_unavailable` while prerendering `/auth/reset-password`. That
was not an outage: it was the dynamic-usage signal Next.js throws when
`cookies()` is read during prerendering, which is *how a route gets marked
dynamic* — being caught by the blanket `try/catch` around the session read and
reported as a provider failure. Swallowing it is the kind of thing that later
lets a protected route prerender as though nobody were signed in.
`rethrowFrameworkSignal()` now re-throws anything whose `digest` identifies a
framework signal, and the two pages that read per-request state declare
`dynamic = "force-dynamic"` so prerendering is not attempted at all. Covered by
three regression tests. The build log is now clean.

**4. Two implementation defects caught by the redirect tests before shipping.**
A legitimate `/patient/my%20records` was rejected, because the decoded-value
check treated a percent-encoded space as a control character; and traversal was
being silently resolved by `new URL()` rather than refused. Both fixed, and the
second produced the stricter policy described above.

**5. The toolchain's formatter corrupts unicode escapes in a character class.**
*(real, and worth recording)* `prettier --write` rewrote
the regex character class covering U+0000-U+0020 and U+007F-U+009F in `redirect.ts` into the literal bytes those
escapes denote — putting a raw NUL into the source of the security check. It is
invisible in review, breaks `grep`, and is one encoding mishap from matching
nothing. Replaced with an explicit code-point scan; the same happened in the
test fixtures, which now build control characters with `String.fromCharCode`.
A repository-wide scan for stray control bytes is clean.

**Two apparent failures that were harness bugs, not product bugs** — recorded
because a report listing only the checks that passed is not evidence:

* An open-redirect probe reported the hostile value "in the HTML" for five
  inputs. It was in Next.js's RSC flight payload, which carries the route's own
  URL — the URL the browser already has, read by nothing. There was no hidden
  `next` field, no `href` and no `action` carrying it, and no `Location` header
  ever resolved off-origin. The probe's substring heuristic was replaced with
  assertions on those three properties.
* A backslash case appeared to be accepted. The shell had collapsed `\\` in the
  probe script, so it was sending a plain, harmless path. Re-run with
  `String.fromCharCode(0x5c)`: correctly rejected.

A third round of confusing results was a **stale `next start`** still serving
the previous build after fixes 1 and 2 had landed. Worth recording: the fixes
were correct and the measurement said otherwise for one run.

---

### Live verification against the Supabase project — 2026-09-17

The project was configured after the phase was first written, so everything
the original draft listed as NOT VERIFIED has now been run for real. **That
supersedes the "no Supabase project is configured" limitation stated at the
top of this document.**

The migration was applied with `supabase db push` against the live database,
and the whole flow was driven through the real forms in a real browser against
the real Auth server.

#### The bug this found

**Password recovery never reached the reset page.** `safeRedirectPath` rejects
every `/auth/*` destination — a rule added to stop sign-in loops — and
`buildAuthCallbackUrl(RESET_PASSWORD_PATH)` therefore silently dropped the
`next` parameter. A user who clicked "reset my password" was signed in and
landed on `/account`, with no way to set a new password. The flow *looked*
like it worked: the email sent, the link resolved, a session was created, no
error appeared anywhere.

Unit tests did not catch it because they asserted the behaviour rather than the
outcome — `auth-callback.test.ts` literally contained a comment explaining that
`/auth/reset-password` "is rejected as a destination by the redirect
validator". The test encoded the defect.

Fixed with `ALLOWED_AUTH_DESTINATIONS`, an exact-match allow-list containing
exactly one path. It is checked on the parsed pathname by equality, so
`/auth/reset-passwordX`, `/auth/reset-password/login` and
`/auth/reset-password/../login` are all still rejected. Eight new unit tests
plus a callback integration test guard it.

**Also fixed:** an already-signed-in user opening an expired reset link got the
password form with no explanation, because the page ignored
`?status=link-invalid` whenever a session existed. It now says the link had
expired while still letting them change their own password.

#### What was verified, live

41 checks, all passing, against `db.<project>.supabase.co`:

| Area | Verified |
| --- | --- |
| Migration | Applied with `supabase db push`. `profiles`, `app_role`, both triggers, `current_app_role()` and the RLS policies all exist. |
| Profile trigger | Creating an auth user creates exactly one profile row, `role = 'patient'`, `full_name` copied from metadata. |
| Enum | `role = 'superadmin'` rejected by the database. |
| Columns | `profiles` has exactly `id, role, full_name, phone, created_at, updated_at` — no clinical column. |
| `anon` | Cannot read or insert a profile (401 at the grant, before RLS). |
| Unverified sign-in | Refused, with our copy, not the provider's. |
| Verification | A **real** one-time token from `generate_link`, exchanged by our own callback route: lands on `/account`, shows the address, reports it verified, confirms upstream. |
| Session | Survives reload; header switches to "My account"; a signed-in user is redirected away from `/auth/login` and `/auth/register`. |
| **Privilege escalation** | A patient holding their own valid JWT **cannot** set `role = 'admin'` — 403 at the column grant. The role is still `patient` afterwards. |
| Horizontal access | That patient reads their own row and gets `[]` for every other row. |
| Self-service | They **can** update their own `full_name` (204). |
| Sign-out | Lands on `/`; protected routes deny afterwards; the back button does not restore protected content. |
| Protected routes | `/patient/profile` redirects with `next` preserved; signing in returns the user there. |
| Recovery | Real recovery token → reset page → password changed → **old password rejected (400), new password accepted (200)**. |
| Replay | A consumed recovery token grants nothing and is called out. A forged token is rejected. |
| Enumeration | A wrong password and an unknown account produce byte-identical messages. |

Test data was synthetic and the account was deleted afterwards; the profile row
cascade-deleted with it, which also verifies the foreign key.

#### Still not verified

* **Delivery of a real email.** Supabase's built-in sender is exhausted
  (`over_email_send_rate_limit`) and only delivers to organisation members, so
  no verification or reset email has actually arrived in an inbox. Every token
  above was issued by `generate_link` — genuine tokens, genuine callback, but
  the mail leg is untested. A real provider must be configured; see below.
* **The emailed link's own redirect.** `http://localhost:3000/auth/callback`
  is **not** in the project's redirect allow-list, so Supabase currently
  rewrites every emailed link back to the Site URL. Confirmed by probe: a
  `generate_link` asking for `/auth/callback` comes back pointing at
  `http://localhost:3000`. **This must be fixed in the dashboard**, and until
  it is, the links in real emails will not work even though the callback route
  itself does.
* **Token refresh at expiry.** The proxy's refresh path ran on every request
  in this flow, but no access token was held long enough to expire.
* **Multiple tabs**, and a **manual screen-reader pass**.


### Authentication email — EmailJS via the Send Email hook

Added after the phase was first written, at the project owner's direction.

#### Why a hook at all

Supabase's built-in sender is limited to a couple of messages an hour and only
delivers to members of the Supabase organisation — confirmed here by probe
(`over_email_send_rate_limit`, and `email_address_not_authorized` for an
outside address). It cannot reach a patient, so a provider is mandatory.

Supabase Auth email can be moved to another provider two ways: **Custom SMTP**,
or a **Send Email hook** (an Edge Function Supabase calls instead of sending).
EmailJS is an HTTP API with no SMTP endpoint, so the hook is the only route to
it.

#### Trade-offs, raised before building and accepted

Custom SMTP with a transactional provider was recommended and declined. The
costs of the chosen route are properties of the decision, not defects to fix
later, and they are recorded so nobody has to rediscover them:

* EmailJS relays through a connected personal mailbox, so deliverability,
  daily volume and the visible sender are that mailbox's — a personal Gmail
  address rather than the clinic's own domain, with no SPF or DKIM alignment
  for `punarvasu`.
* The free tier is 200 messages a month.
* The message wrapper lives in EmailJS's dashboard, outside this repository and
  outside code review. **Mitigated** by keeping the wording *about the security
  link* in `lib.ts` and passing it in as template parameters, so at least the
  sentences a patient reads about a one-time link are versioned.
* Patient email addresses and live one-time links transit a third party
  (`docs/SECURITY.md` section 23).

#### What was built

```text
supabase/functions/send-auth-email/lib.ts     pure logic - signature, link, payload
supabase/functions/send-auth-email/index.ts   the Deno handler
tests/integration/auth-email-hook.test.ts     31 tests
```

The split exists so the part that has to be right is testable in the project's
own suite rather than only on deploy. `lib.ts` uses nothing Deno-specific and
runs under Node in the test; `index.ts` holds the runtime concerns and is
excluded from `tsc` and ESLint (it is Deno code, typechecked by the Supabase
CLI on deploy).

#### Security properties

| Property | How |
| --- | --- |
| **The endpoint is authenticated** | Standard Webhooks signature, verified before any field of the payload is read. The function runs with `verify_jwt = false` because Supabase signs rather than sending a JWT, so this check *is* the authentication. Without it the URL is an open relay sending from the clinic's address with any link an attacker chooses. |
| Constant-time comparison | `timingSafeEqual`, length-checked first so a truncated signature cannot throw. |
| Replay bounded | 5-minute timestamp window, in both directions. |
| Key rotation | Several space-separated signatures accepted; any one matching passes. |
| **No token logged** | `token_hash` is a bearer credential. It goes into the outbound link and nowhere else. The provider's error text is discarded entirely, because it can echo the request back. |
| No address logged | The log records the action category and nothing more. |
| **Link origin is configuration** | Built from `APP_URL`. `redirect_to` from the payload contributes only a path, and only when same-origin — a poisoned value cannot aim a clinic-branded email at another host. |
| Refuses unknown actions | An action with no reviewed wording is rejected rather than improvised, so unreviewed words never reach a patient. |
| Minimal payload to the third party | Recipient address and the link. No name, phone, role or identifier; the numeric OTP is not sent either, since the flow is link-based. |

The link points straight at this application's `/auth/callback` carrying
`token_hash` and `type` — one hop instead of two, and exactly the path proven
end to end against the live Auth server.

#### Verified end to end — 2026-09-18

Registration through the real form now delivers a real email. The chain is:
form → server action → Supabase Auth → Send Email hook → Edge Function →
EmailJS → inbox, and every leg has been exercised against the live project.

| Verified | How |
| --- | --- |
| The function rejects an unsigned request | 401, live |
| It rejects a forged signature | 401, live |
| It accepts a genuine Supabase signature | 200, signed with the project's real hook secret |
| EmailJS accepts the payload | 200 OK |
| **Registration through the form succeeds** | lands on `/auth/verify`; the built-in sender would have refused the address, so the hook was used |
| The profile trigger still fires | role `patient`, name copied |
| The callback URL is allow-listed | `redirect_to` echoed back unchanged |
| An email arrives | confirmed by the recipient |

#### Four defects found by doing it for real

Every one of these passed 900+ unit tests first. They are recorded because the
*class* of each is worth remembering, not because the fixes are interesting.

**1. `Buffer` is not a global in Deno.** `lib.ts` used `Buffer` without
importing it. Under Node — where the tests run — it is a global, so the suite
was green while every real invocation threw
`ReferenceError: Buffer is not defined` inside signature verification, before
reaching the provider. A behaviour test in one runtime cannot prove
correctness in another. `tests/integration/auth-email-hook.test.ts` now reads
the source and asserts that anything Node-global is explicitly imported,
because that is the only thing that could have caught it.

**2. The hook secret is `v1,whsec_<base64>`, not `v1,<base64>`.**
`parseHookSecrets` stripped `v1,` but not `whsec_`. The damage was done by
`Buffer.from(value, "base64")` being *lenient*: it skips characters outside
the alphabet rather than failing, so `whsec_...` decoded to a key that was
wrong but perfectly well-formed, and every genuine call was rejected with 401
for no visible reason. The base64 is now validated strictly — a validation
that silently repairs its input is worse than one that refuses it. The tests
had the same wrong format, so they agreed with the code and both were wrong.

**3. `APP_URL` without a scheme threw uncaught.** `new URL()` throws on
anything it cannot parse, and the throw escaped the handler as a bare
`Internal Server Error` naming nothing. There is now a `parseOrigin` that
returns `null` instead of throwing, a catch-all around the whole handler, and
a rule that only `http:`/`https:` are accepted — that value becomes the origin
of a link in a patient's inbox.

**4. The EmailJS template read `{{email}}`, not `{{to_email}}`.** EmailJS
answers `422 The recipients address is empty` and does not say which name it
wanted. The function now sends the address under both names: which one a
template uses is the author's choice, the template lives outside this
repository, and supplying both removes the class of failure for the same
address to the same third party.

A fifth problem was in the diagnosis rather than the code: the probe asserted
`status !== 401` and called that "signature accepted", so a 500 printed PASS
while verification was actually throwing. That bad assertion sent the
investigation down two wrong paths (a stale deployment, twice). A check that
cannot fail for the reason you care about is worse than no check.

#### Operability, added while debugging

* A provider failure logs the status **and** the provider's message with
  anything URL-shaped or token-shaped stripped and the length bounded.
  Discarding it entirely was too strict to operate — it could not tell a
  disabled API from a wrong template id. Logging it raw would be worse: a link
  in a log is a credential in a log.
* A misconfiguration logs the *name* of the missing or malformed setting,
  never its value.
* Anything unexpected logs `send-auth-email.unhandled` with the error's name
  and message, and returns a proper JSON 500. Supabase treats a non-2xx as
  "not sent", so a failure has to be recorded here or it is recorded nowhere.

#### Remaining trade-offs of this provider

Unchanged, and still true now that it works:

* Mail relays through a personal Gmail, so deliverability and daily volume are
  that mailbox's, and the visible sender is a personal address rather than the
  clinic's domain — no SPF or DKIM alignment for `punarvasu`.
* 200 messages a month on the free tier.
* The template wrapper is not in version control.
* Patient addresses and live one-time links transit a third party.

Before the clinic handles real patients, Custom SMTP on the clinic's own
domain remains the better answer. Nothing about this hook has to change to
make that switch — it is a dashboard setting and this function is simply
disabled.

---

### Supabase configuration required

Before this phase works anywhere, the project must be configured:

**Environment** (no new variables were introduced):

```text
NEXT_PUBLIC_SUPABASE_URL        the project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   the anon/publishable key
NEXT_PUBLIC_SITE_URL            the canonical origin — set per deployment
```

`NEXT_PUBLIC_SITE_URL` is load-bearing: every link in an authentication email
is built from it, deliberately and never from the request's `Host` header. On
a preview deployment it must be set to that deployment's own origin.

**Auth settings** (Supabase dashboard, or `supabase/config.toml` locally):

| Setting | Value | Why |
| --- | --- | --- |
| Site URL | the production origin | Supabase's own redirect allow-list |
| Redirect URLs | `<origin>/auth/callback` for production, each preview origin, and `http://localhost:3000/auth/callback` | Supabase matches exactly; an unlisted host fails closed |
| Confirm email | **enabled** | The registration flow assumes it |
| Minimum password length | **10** | Must equal `PASSWORD_MIN_LENGTH`; the sentence under the field is derived from that constant |
| Secure password change | enabled | |
| Email OTP expiry | 900s | Lowered from the 1-hour default — a link in an inbox is a bearer credential |
| Leaked password protection | enable if available | The in-repo word list is deliberately tiny |

**Database:** apply `supabase/migrations/20260917120000_auth_identity_foundation.sql`
(`npm run db:push`), then regenerate types (`npm run db:types`).

**Email:** authentication email goes through whatever provider the Supabase
project has configured. Supabase's built-in sender is heavily rate-limited and
is not suitable for production; an SMTP provider must be configured before
launch. The application assumes no particular provider.

---

### Acceptance criteria

#### Registration

| Criterion | Result |
| --- | --- |
| Registration page exists | PASS |
| Required fields are validated | PASS — client and server, one schema |
| Password confirmation works | PASS — error attached to the confirm field |
| User can submit valid registration | PASS *(code path; not run against a live Auth server)* |
| Email verification flow is supported | PASS — `emailRedirectTo` to the callback; verify page |
| Verification instructions are clear | PASS — names the address when known, says what to do when not |
| Sensitive medical information is not collected | PASS — no field exists, unknown keys are discarded, asserted by test |

#### Login

| Criterion | Result |
| --- | --- |
| Login page exists | PASS |
| Email/password login works | PASS *(code path; not run against a live Auth server)* |
| Password visibility toggle works | PASS — verified in a real browser |
| Invalid credentials are handled safely | PASS — one message, no enumeration |
| Loading state works | PASS — `aria-busy`, disabled for the whole request |
| Authenticated redirect works | PASS — validated destination, tested |

#### Email verification

| Criterion | Result |
| --- | --- |
| Verification callback works | PASS — both link shapes, 20 tests |
| Valid verification works | PASS *(code path)* |
| Invalid/expired verification is handled | PASS — verified live; one message, no provider text |
| Resend flow works where supported | PASS — neutral response, submit disabled during request |
| Redirect is safe | PASS — verified live against hostile `next` values |

#### Password reset

| Criterion | Result |
| --- | --- |
| Forgot-password page exists | PASS |
| Neutral response prevents enumeration | PASS — same response on success, absence and provider failure |
| Reset flow works | PASS *(code path)* |
| Expired/invalid links are handled | PASS — the page's no-session state, verified live |
| New password validation works | PASS |

#### Session

| Criterion | Result |
| --- | --- |
| Session survives browser refresh | **NOT VERIFIED** — needs a live project. Implemented and unit-tested. |
| Server can identify authenticated user | PASS — `getCurrentUser()`, 21 tests |
| Logout works | PASS *(code path)*; revokes globally |
| Logout prevents protected access | PASS — server-side gate verified live; global revocation makes it unconditional |
| Session refresh works | **NOT VERIFIED** — implemented in the proxy, tested against a mocked client |

#### Protected routes

| Criterion | Result |
| --- | --- |
| Unauthenticated users cannot access protected routes | PASS — verified live on five prefixes |
| Authenticated users can access protected routes | PASS *(code path; proxy and layout tested)* |
| Redirect preserves safe internal destination | PASS — verified live |
| External redirect destinations are rejected | PASS — 92 unit cases + 11 live |

#### Security

| Criterion | Result |
| --- | --- |
| No secrets exposed | PASS — bundle scan clean, 151 files |
| No service-role key in client | PASS — `server-only`, scan clean |
| No passwords logged | PASS — never passed to the logger; never echoed into form state |
| No tokens logged | PASS — asserted by test |
| No OTPs logged | PASS — OTP not implemented; the token-hash path is asserted |
| Client state is not treated as authorization | PASS — the only client auth state is one boolean that gates a label |
| Protected content is not publicly cached | PASS — `force-dynamic` + `private, no-store`, verified live |
| Auth errors are safely mapped | PASS — one mapper, asserted against provider text |

#### UX

| Criterion | Result |
| --- | --- |
| Auth pages match the design system | PASS — tokens only; no new colour, radius or shadow |
| Forms are responsive | PASS — measured at 9 widths |
| Mobile experience works | PASS — 320/375/390/430px measured |
| Error states are understandable | PASS — plain language, no provider text |
| Loading states are clear | PASS |

#### Accessibility

| Criterion | Result |
| --- | --- |
| Labels are associated with fields | PASS — structural, via `Field` |
| Keyboard navigation works | PASS — verified in a real browser |
| Focus states are visible | PASS — 3px outline, measured |
| Errors are accessible | PASS — `role="alert"`, `aria-describedby`, `aria-invalid` |
| Password toggle is accessible | PASS — named, `aria-pressed`, 44px, Enter and Space |
| Screen-reader status updates work | PARTIAL — roles are correct and asserted; **no manual screen-reader pass** |
| Contrast is acceptable | PASS — live axe, real computed colour, 0 violations |

#### SEO

| Criterion | Result |
| --- | --- |
| Auth pages excluded from indexing | PASS — `noindex` in served HTML + `robots.txt` |
| No sensitive information in metadata | PASS — titles are generic; no address in any URL |

---

### Known issues

1. **Only `http://localhost:3000/auth/callback` is allow-listed.** The
   production origin's callback has to be added to Supabase's Redirect URLs
   before deploying, and `APP_URL` on the Edge Function updated to match, or
   emailed links will point at localhost.
2. **Authentication email depends on a personal Gmail relay.** It works and is
   verified end to end, but see the trade-offs above: deliverability, the
   200/month ceiling and the sender identity all argue for Custom SMTP on the
   clinic's own domain before real patients use it.
3. **`src/types/database.ts` is hand-written.** The migration is now applied,
   so `npm run db:types` can and should regenerate it.
4. **No E2E tool.** Deferred since Phase 01. The live CDP checks cover
   accessibility, overflow, keyboard and redirect safety, but not a scripted
   journey through a real sign-up.
5. **No manual screen-reader pass.** Unchanged since Phase 02.
6. **The weak-password list is tiny** — thirteen entries plus a
   repeated-character check. It is not a breached-password service. Enable
   Supabase's leaked-password protection.
7. **No terms or privacy pages**, so registration shows a plain statement of
   what is collected instead of a consent checkbox. A tick box agreeing to an
   unpublished document would be a worse artefact than none. Both are required
   before the clinic handles records through this website.
8. **Still no CSP.** Unchanged since Phase 02, and now slightly larger in
   scope: the policy needs to cover the auth routes and `frame-src` for the
   contact page's map.
9. **Rate limiting is entirely Supabase's.** That is the right layer
   (`phase_06.md` sections 48–49), but it means the application has no
   defence if the provider's limits are relaxed.
10. **`/account` is a foundation, not a dashboard.** It shows the email address
   and verification state, and says in words that the rest is still being
   built. Intended, not a gap.

---

### Deferred work

* **Phase 08 — roles and permissions.** The role is resolved and exposed;
  nothing authorizes on it. `current_app_role()` ships for those policies.
* Applying the migration, regenerating types, and testing the RLS policies
  against a real database with each actor.
* E2E tooling and a scripted journey: register → verify → sign in → protected
  route → sign out.
* Audit logging of authentication events. `phase_06.md` section 77 defers the
  system to Phase 19; the events worth recording are account creation, sign-in,
  sign-out, password reset, email change and suspicious activity, and the log
  events emitted here are already named for it.
* Content-Security-Policy.
* A manual screen-reader pass and a Lighthouse run.
* OTP / magic link, if a product requirement ever appears. The callback already
  handles the token shape it would use.
* CAPTCHA/Turnstile — deliberately not added (`phase_06.md` section 50). No
  abuse has been observed, and it would be the first third-party script on the
  site.
* Legal pages, and the consent checkbox that arrives with them.
* The patient profile (Phase 07) and everything that hangs off it.

Phase 07 has not been started.
