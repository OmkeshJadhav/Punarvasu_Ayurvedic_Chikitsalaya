# Punarvasu — Security Standards & Guidelines

## 1. Purpose

This document defines the security requirements, principles, controls, and implementation standards for the Punarvasu Ayurvedic Clinic application.

Security must be treated as a **first-class product requirement**, not as a final-phase activity.

Every feature, API, database operation, authentication flow, administrative function, and third-party integration must follow the requirements defined in this document.

### Security priorities

The application must prioritize:

1. Patient privacy
2. Authentication and authorization
3. Protection of personal and health-related information
4. Secure API and database access
5. Protection against common web vulnerabilities
6. Secure administrative operations
7. Secure file handling
8. Auditability
9. Secure deployment and configuration
10. Safe error handling

---

# 2. Security Principles

All implementation must follow these principles.

### 2.1 Least privilege

Every user, service, API, database role, and integration must have only the permissions it actually requires.

Never grant broad permissions for convenience.

### 2.2 Defense in depth

Do not rely on a single security mechanism.

Important operations should be protected by multiple layers such as:

* Authentication
* Authorization
* Server-side validation
* Database policies
* Rate limiting
* Input sanitization
* Audit logging

### 2.3 Never trust the client

Anything received from the browser must be considered untrusted.

Never rely on:

* Hidden form fields
* Disabled buttons
* Client-side role checks
* Client-side validation
* Client-side user IDs
* Client-side pricing
* Client-side permissions

All security-sensitive validation must happen on the server.

### 2.4 Secure by default

New features must start with the most restrictive reasonable security configuration.

Access should be explicitly granted rather than implicitly allowed.

### 2.5 Fail securely

If authentication, authorization, validation, or an external security dependency fails, the application should deny the sensitive operation rather than silently allowing it.

---

# 3. Threat Model

The application should assume the following threats.

### External attackers

Attackers may attempt to:

* Guess passwords
* Abuse authentication endpoints
* Enumerate users
* Access another patient's records
* Manipulate API requests
* Inject malicious input
* Upload malicious files
* Exploit broken authorization
* Abuse appointment or contact forms
* Scrape public endpoints
* Perform denial-of-service attacks

### Authenticated malicious users

A legitimate user may attempt to:

* Access another user's data
* Modify records they do not own
* Escalate privileges
* Manipulate appointment information
* Access administrative endpoints
* Access private files
* Circumvent UI restrictions

### Compromised administrator

Assume an administrator account could potentially be compromised.

Administrative access must therefore be auditable and protected by strong authentication and authorization.

### Per-actor model (Phase 19)

`phase_19.md` sections 6-7. What each actor can attempt, and what stops it.

| Actor | Trusted with | Can attempt | Stopped by |
| --- | --- | --- | --- |
| **Anonymous** | Nothing. The public site reads no database at all | Probing routes, calling RPCs with the publishable key, manipulating parameters | No table grant and no function grant for `anon`; every policy is `to authenticated`; the proxy redirects, `requireUser()` enforces |
| **Patient** | Their own record, appointments, issued prescriptions, active plans, own documents, own notifications | Another patient's ids; staff routes; clinical records; role escalation | RLS scoped by `current_patient_id()`; reads that take no id at all; no write grant on any clinical table; no writable path to `user_roles` |
| **Receptionist** | Operational scheduling and demographics | Clinical records, prescriptions, plans, documents, analytics beyond scope, role management | **No policy at all** on any clinical table; no clinical permission; `42501` from every clinical function |
| **Doctor** | Their own diary, patients they are booked to see, records they authored | Another practitioner's patients or records; administrative operations; AI outside scope | Relationship-scoped policies; `assert_care_practitioner()`; no practitioner parameter exists anywhere to substitute |
| **Administrator** | Users, roles, operational and clinic analytics, exports | Clinical data | No clinical policy and no clinical permission. Administrative power and clinical access are separate, and role changes are audited and self-excluding |
| **Compromised browser** | Nothing | Forging role in storage or a cookie, editing payloads, replaying requests | Nothing client-side decides anything; every identity is server-derived; `HttpOnly` cookies; CSP; same-origin check |
| **External providers** | Only what section 43 lists | — | Credentials server-only; the AI context is de-identified; notification payloads carry no clinical content |

---

# 4. Data Classification

All application data must be classified according to sensitivity.

## Public

Examples:

* Clinic name
* Clinic address
* General Ayurvedic information
* Public services
* Public blog articles
* Public contact information

## Internal

Examples:

* Operational configuration
* Internal notes
* Non-sensitive analytics
* Application metadata

## Confidential

Examples:

* User email addresses
* Phone numbers
* Appointment information
* Staff information
* Internal administrative data

## Highly Confidential

Examples:

* Patient health information
* Medical history
* Consultation notes
* Prescriptions
* Uploaded medical documents
* Treatment information
* Sensitive personal information

Highly confidential data must receive the strongest protection.

---

# 5. Authentication

Authentication must be handled through the project's approved authentication provider.

For the Punarvasu application, authentication should preferably use **Supabase Auth** where Supabase is part of the approved architecture.

### Requirements

* Never implement custom password hashing unless explicitly required.
* Never store plaintext passwords.
* Never store passwords in application tables.
* Use secure authentication flows provided by the authentication provider.
* Use email verification where appropriate.
* Support secure password reset.
* Use secure session handling.
* Expire/revoke sessions appropriately.
* Never expose authentication tokens to logs.
* Never expose service-role credentials to the browser.

### Password requirements

If passwords are supported:

* Enforce a reasonable minimum password length.
* Do not impose unnecessarily restrictive composition rules.
* Allow password managers.
* Never block paste into password fields.
* Never expose passwords in logs or analytics.

### Session security

Sessions must:

* Be validated server-side for protected operations.
* Be invalidated when the user signs out.
* Not be trusted solely because a client-side state says the user is authenticated.
* Not expose access/refresh tokens unnecessarily.

### Implemented (Phase 06)

| Control | How |
| --- | --- |
| Password hashing | Supabase Auth (bcrypt). No credential is stored by this application. |
| Minimum password length | 10, enforced by the provider **and** by `features/auth/validation.ts`. The number is a single constant, and the sentence shown under the field is derived from it. |
| Maximum password length | 72, because bcrypt ignores bytes past that. A longer password is rejected rather than silently truncated. |
| Paste and password managers | Never blocked. Verified by test. |
| Session validation | `supabase.auth.getUser()`, which verifies the token with the Auth server. `getSession()` is used nowhere. |
| Session refresh | `src/proxy.ts`, which is the only place able to write refreshed cookies. |
| Sign-out | `signOut()` at the default `global` scope: every refresh token for the account is revoked, not just this browser's. |
| Password change | Revokes all other sessions (`scope: "others"`). |
| Account enumeration | Sign-in folds "no such account" into "incorrect credentials". Password reset and resend-verification return the same neutral confirmation whatever happens, including a provider outage. |
| Open redirect | `lib/auth/redirect.ts`. Every externally supplied destination is validated; the function returns a path, never a URL. 92 tests, plus live verification against the production build. |
| Host header injection | Email link origins come from `NEXT_PUBLIC_SITE_URL`, never from the request. See `lib/auth/callback-url.ts`. |
| CSRF | Server actions only. Next.js compares `Origin` to `Host` and rejects a mismatch. |
| Token exposure | No code, token hash or reset token reaches a response body, a redirect target, a log, or a page. Asserted by test. |
| Protected-content caching | `force-dynamic` on the authenticated layout, plus `private, no-store` from the proxy. |
| Rate limiting | Supabase's own. The application does not build a parallel mechanism; it disables submit for the duration of a request so a double-click does not spend an allowance. |

---

# 6. Authorization

Authentication answers:

> "Who is the user?"

Authorization answers:

> "What is this user allowed to do?"

Every protected operation must perform authorization checks.

## Roles

Punarvasu defines exactly four roles. This list is the **canonical role model**
for the project; `ARCHITECTURE.md`, `PRODUCT_SPEC.md` and `DATABASE.md` defer
to it.

| Role | Constant | Purpose |
| --- | --- | --- |
| Patient | `patient` | A person receiving care. Default role on self-registration. |
| Receptionist | `receptionist` | Front-desk operations: scheduling, check-in, patient contact details. **Operational, not clinical.** |
| Doctor | `doctor` | A practitioner delivering care and authoring clinical records. |
| Admin | `admin` | Clinic configuration, staff and content management. |

A user holds exactly one role. A staff member who is also a patient of the
clinic uses a separate patient account rather than a dual-purpose role — this
keeps every authorization decision unambiguous.

`SUPER_ADMIN` is **not** implemented. It is a plausible future need
(multi-branch operation, platform-level support access), and the model must not
prevent adding it, but introducing it now would add an authorization tier with
no current purpose. Deferred.

### Role rules

**Patients**

* Can access their own profile, appointments, prescriptions and documents.
* Can access the patient-facing portion of their own clinical information.
* Cannot access another patient's information under any circumstance.
* Cannot change their own role.

**Receptionists**

* Can manage appointments, schedules, check-in and check-out.
* Can access the patient contact and demographic information the front desk
  genuinely needs.
* **Cannot read clinical notes, assessments, treatment plans or
  prescriptions.** This is a hard boundary, not a UI preference.
* Do not receive administrative privileges.

**Doctors**

* Can access the clinical records of patients they are treating, scoped by
  treatment relationship rather than by role alone. **Implemented in Phase 12
  as the authoring-practitioner model**: a doctor reads and writes the clinical
  records whose `practitioner_id` is their own. Reading a patient's *identity*
  is scoped one notch wider — by an appointment relationship (Phase 11) —
  because the two are different disclosures.
* Can author clinical records, treatment plans and prescriptions.
* Cannot manage clinic configuration, staff or roles.

**Admins**

* Can manage practitioners, services, availability, content and users.
* Have controlled, audited access to patient data where operationally
  necessary — not unrestricted clinical browsing.
* Cannot silently alter or delete clinical history.
* Are always subject to audit logging, and use stronger authentication
  controls where available.

### Implemented (Phase 16) — analytics and reporting

| Control | How |
| --- | --- |
| Permission model | Four permissions. `analytics.read.operational` (admin, receptionist) covers appointment volume, outcomes, practitioner workload and patient growth; `analytics.read.clinic` (admin) adds notification delivery and clinical **activity** counts; `analytics.read.own_practice` (doctor) is a practitioner's own figures; `reports.export` (admin) is separate from every read, because §44 asks export to be the stronger capability — a dashboard is read at a clinic machine, a CSV is opened on a laptop and kept. |
| **The receptionist boundary stays clinical, not just clinically-shaped** | A count of prescriptions issued sits on the far side of §6's "operational, never clinical". An aggregate is not a prescription, but the line is kept bright rather than re-argued per figure: the front desk holds `analytics.read.operational` and not `analytics.read.clinic`, and the database's own gate draws it in the same place. |
| **There is no practitioner parameter on a practitioner's analytics** | §§8, 54, example 3. Not optional, not ignored — absent from the RPC signature, from the Zod schema and from the filter component. The scope is resolved from `auth.uid()` by `assert_care_practitioner()`, which also refuses a doctor account with no practitioner record. §101's "change the practitionerId" has nothing to change. |
| **There is no patient, clinic, organization, report or export id anywhere** | §§51, 59, 101. No `p_patient_id` parameter exists in the migration and no patient identifier appears in any return type, so an analytics endpoint cannot become an enumeration API. There is exactly one report, defined in `config/analytics.ts`, so there is no `reportId` to substitute. |
| **There is no raw-query surface** | §61. Every read is a purpose-built aggregate answering one question and returning counts. No column, table, sort, limit or `where` parameter exists, and the feature performs no table read at all — asserted structurally. |
| Privileged reporting functions authorize explicitly | §§55, 56. Twenty-five `security definer` functions: `search_path` pinned, inputs validated, callers authorized **in the body**, no dynamic SQL, execution granted narrowly. A view was rejected deliberately — it is evaluated with the *caller's* row-level security, so a view over `prescriptions` would return **zero rows** to a receptionist rather than being refused, and a wrong number that looks right is the worst failure an analytics system has. |
| **Grants are revoked by name, and the gate is in the body as well** | The lesson Phase 15 paid for. Every revoke names `anon`; every internal function's also names `authenticated`. Twelve internal aggregates and gates are granted to **nobody**, and the thirteen reachable functions each call their gate before they read. Restoring a grant by accident does not restore access. |
| Ranges are bounded in the database | §§26, 82, example 6. At most 366 days counting both ends, and not before a sanity floor — enforced by `analytics_assert_range()`, which every reachable function calls, so a request that never went through the form is still bounded. `PV060`/`PV061`/`PV062`. |
| Filter parameters cannot become SQL | §§57, 58. Every filter is a typed parameter of an RPC: two `date`s and a `uuid`. A SQL fragment in a date is a type error, verified live, and the table it named survived. |
| **Analytics owns no domain state** | §103. The migration contains no `create table`, no `insert`, no `update`, no `delete`, no trigger and no policy — asserted structurally. It is read-only with respect to Phases 07–15 as a property of the diff rather than as an intention. |
| Clinical data is not queried, not merely not shown | §§3, 88. No function selects a diagnosis, symptom, assessment, doctor's note, medicine, dose, plan title, document title, file name, storage path, checksum, notification title or body, cancellation reason, patient note or internal note. Asserted against the migration text. |
| Patient identifiers are minimised to nothing | §§35, 90, 104. There is no patient identifier in any return type. The only name that appears is a practitioner's **professional** display name, already printed on the diary every receptionist reads. |
| Export data minimisation | §45, example 4. The report is **aggregated** — a count per (clinic day, practitioner, appointment type, status) — rather than a row per appointment, so it identifies nobody and §90's separately-authorized identifier report does not arise. The five approved columns are a fixed contract the writer reads through; a column added to the RPC cannot start leaving the building. |
| Export delivery | §47. Authenticated `POST` only, returning an attachment with `private, no-store` and `nosniff`. **No public URL and no GET download URL** — a `GET` returns 405, verified live. No object storage is involved. |
| Export auditability | §48. Who, which report, when, and whether the scope was narrowed. Not what was in it, and **not to whom** it was narrowed: a practitioner id in an audit line is an identifier the record does not need. |
| CSV injection | A cell beginning `=`, `+`, `-`, `@`, a tab or a carriage return is a formula, and `=HYPERLINK(...)` is a phishing link that runs when somebody opens a file their own clinic sent them. Every value is guarded, not only the one field that is not a developer-authored constant. |
| **Nothing is cached across requests** | §§33, 34, example 5. No `unstable_cache`, no `revalidate`, no module-level memo — asserted by test. A cache that does not exist cannot leak a scope, and the aggregates are cheap enough that freshness costs nothing. If one is ever added it must be keyed on the authorized scope plus the range; that assertion is what forces it to be deliberate. |
| Delivery is not claimed | §41. Phase 15 records `sent` to mean the provider accepted the request and has no `delivered` status, so nothing here invents one. The derived figure is named **acceptance rate** and the panel carries the sentence saying what it is not. |
| Data quality | §97. Counts that cannot be true — a component exceeding the total, an `eligible` that is not the sum of its parts, a rate outside `[0, 1]` — are reported as unavailable and logged, never drawn. Utilisation cannot exceed 100% by construction, because booked time is intersected with available time in SQL. |
| Safe errors | `features/analytics/errors.ts`, SQLSTATE range `PV060`–`PV062`, disjoint from every earlier phase. No function, table, policy, constraint or SQL fragment can reach a screen. |
| Logging | The operation, an opaque user id and a failure category. Never a figure, a name, a period's contents or the provider's message; a successful dashboard read logs nothing at all. Asserted by an **allowlist** over every identifier in every `logger.*` call in the feature. |
| Private pages are not publicly cached | `private, no-store` from the proxy, `force-dynamic` on the authenticated shell, `noindex` on all three routes, and `robots.txt` already disallows `/admin`, `/receptionist` and `/doctor`. Verified live. |

### Implemented (Phase 17) — clinical AI decision support

`docs/HEALTHCARE_AND_AI_SAFETY.md` §§5–9 are binding here and outrank the phase
specification. Two of its rules shaped the design: AI is **disabled by
default** (§9), and an entry recording that AI processed a given patient's
record is **mandatory** (§8) even though the phase specification makes
persistence optional.

| Control | How |
| --- | --- |
| Permission model | One permission, `clinical_ai.use`, held by the **doctor role alone**. A receptionist, a patient and an administrator hold nothing — and an administrator additionally has no practitioner record, so there is no patient a model could be asked about. Separate from `clinical_records.*`, so clinical AI can be withdrawn by deleting one line without touching a practitioner's ability to document a consultation. |
| **The feature writes nothing** | §§76, 111–115. There is no action that applies, accepts, saves or issues a result, and no RPC that mutates a clinical row. A structural test asserts the feature writes none of nine clinical tables, calls none of fourteen clinical mutation RPCs, and calls only the three Phase 17 functions. That — not the safety layer — is what makes autonomous prescribing, diagnosis, record completion and patient messaging impossible. |
| **There is no patient or practitioner parameter** | §§7, 8, 99, example 4. Absent from the Zod schema, from the RPC signature and from the form. The practitioner is resolved by `assert_care_practitioner()` from `auth.uid()`; the patient is read out of the appointment inside the database. |
| **The client cannot choose a model, a prompt or a temperature** | §§92, 93. None is a request parameter. The model comes from server-only configuration, the prompts from a frozen in-source registry with no setter, no environment read and no query — so there is no code path by which a browser supplies, overrides or appends to one. |
| IDOR protection is structural | §§8, 141. An appointment id is a filter, never an authorization input: `start_ai_assistance_session` resolves it by id **and** by the caller's own practitioner record in one statement, and raises `PV070` for both "no such appointment" and "not yours". An appointment id cannot be an oracle for another practitioner's diary. |
| Authorization before minimization | Every context read runs under the Phase 11–14 policies — `appointments_select_own_practitioner`, `patients_select_doctor_care`, `clinical_records_select_author`, `prescriptions_select_author`, `patient_documents_select_doctor_care`. Cross-patient and cross-doctor leakage are prevented by the database; the context builder cannot see what the database will not return. |
| Data minimization is checkable by reading one type | §§10, 60, 61. `ClinicalAIContext` is the complete list of fields any patient's data can be sent as. Age in years and gender are sent because they change what is clinically relevant; **name, preferred name, date of birth, phone, address, email and every identifier are not**, nor is any storage path, URL or credential. A test asserts no uuid, no URL and no path appears in a serialized context. |
| Document contents never leave | §§58, 59. Phase 14 stores no extracted text and no OCR was added, so a document contributes its **title** and date. The serialized context says so explicitly, because a model told a "Blood panel" exists will otherwise describe what it contains. |
| **The injection fence is structural, not instructional** | §§34–36, 94. The context is wrapped in a delimited block the system prompt names as data, and any occurrence of the delimiter **inside clinical text** is neutralised — so a patient note or a document title cannot close the block early and write outside it. That is the one injection that works regardless of how firmly a prompt is worded, and it is closed by code. |
| Provider output is untrusted input | §§37–39. Bounded before parsing, JSON extracted by brace-counting, validated by a `strict()` schema with four keys and explicit bounds, sanitized of control characters, zero-width characters and **bidirectional overrides**, then checked by the clinical safety layer. Rejected, never repaired: a repaired clinical response is text nobody wrote and nobody reviewed. HTML is kept as literal characters rather than stripped, because the defence is that every string is a React text node. |
| **There is no confidence field to populate** | §§30, 31. The schema has no key for it, so a model returning one is refused rather than having it silently dropped. |
| The safety layer's limits are stated, not implied | §§69–71. Nine reject rules and two flag rules over the response text. The module says plainly that a text check is coarse and that what holds the boundary is the absence of a write path. Live verification found it refusing a **correct** restatement of a recorded prescription; the rules are now split so a directive verb is always refused and a bare dose only where the model is generating rather than reporting. Recorded in `docs/progress/progress_phase_17.md` §12. |
| Prompts and responses are never logged or stored | §§27, 28, 90, 162, and `HEALTHCARE_AND_AI_SAFETY.md` §8. No column exists for either. Logs carry the event, an opaque user id, the task, the prompt version, a failure code and a latency — asserted by an **allowlist** over every identifier in every `logger.*` call in the feature. The provider's error text is **discarded rather than filtered**, because a provider error body can quote a clinical prompt back. |
| The audit records access, not content | `HEALTHCARE_AND_AI_SAFETY.md` §8. `ai_assistance_sessions` records who asked, about which patient, when, for which task, with which prompt version and model, how long it took and how it ended. It is written **before** the provider is called, so a call that timed out or was refused is still recorded, and it is immutable — even the service role cannot rewrite it, verified live. |
| Cost and abuse control is in the database | §§53, 104. 40 requests per practitioner and 12 per patient in a rolling hour, counted as rows and consumed **before** the provider is reached — so a flood of concurrent requests is bounded and a restart does not refill the bucket. The in-memory limiter is deliberately not used: it is one instance and is cleared by a restart, which is inadequate for bounding money spent externally. |
| Failure never blocks care | §§49, 50, 101, example 10. Every path returns an outcome object, none throws past its caller, and the copy always says the consultation is unaffected. Verified live against the real provider through a 503, a 429 and a safety rejection. An audit row that cannot be closed does not fail the request either. |
| The feature flag is availability, never authorization | §161, and `HEALTHCARE_AND_AI_SAFETY.md` §9. Only the exact string `"true"` enables it; anything else means off. Switching it on gives nobody AI — the permission, the practitioner record and the appointment scope all still apply. A deployment with a flag and no key, or a key and no flag, gets no AI rather than a feature that fails on every request. |
| Analytics receives operational metrics only | §§105–108. Counts, statuses, latency and token totals by task, administrator-gated, with **no practitioner dimension in the return type** — so a per-doctor acceptance rate cannot be computed from it at all. No prompt, no response, no patient. |
| Private pages are not publicly cached | `private, no-store`, `force-dynamic`, `noindex`, and `robots.txt` already disallows `/doctor`. Verified live, with a result rendered. Nothing reaches `localStorage`, `sessionStorage` or the URL — also measured. |

**Outstanding and blocking:** `HEALTHCARE_AND_AI_SAFETY.md` §8 requires the
provider's data-retention and training-use terms to be reviewed and documented
before any patient data is sent, and §62 forbids claiming compliance without
verification. **That review has not been done.** Until it is,
`CLINICAL_AI_ENABLED` must stay off for any deployment holding real patient
data.

---

### Implemented (Phase 15) — notifications and communication

| Control | How |
| --- | --- |
| Permission model | Two permissions added — `notifications.read.self` and `notifications.write.self` — and they are the **only ones in the matrix held by every role**. A notification is a message addressed to one account: not clinical data, and not somebody else's data. Neither confers any ability to *send*. |
| **There is no recipient parameter anywhere** | `create_notification` does not take one: it resolves the account from the **audience** and the resource the notification is about — `patients.profile_id` for a patient, `practitioners.profile_id` for a practitioner. `notification_audience` has two values and neither names anybody. There is no `recipientUserId`, no `recipientEmail`, no `recipientPhone` and no `to` in any function signature, any schema or any form in the feature — §110 and example 9 satisfied structurally rather than by filtering. Asserted by a scan over every function's parameter list in the migrations. |
| **A staff notification names no patient** | §§36, 37, 57. A practitioner may know who is on their own list; a lock screen may not be told. The practitioner template's input type carries the consultation type and the start instant and **no patient field at all**, and it is a separate type from the patient's — so passing one to the other is a compile error, not something review must catch. Asserted over every rendered practitioner message. |
| **There is no arbitrary sending surface** | §109. Three server actions exist: mark one read, mark all read, change one preference. `create_notification`, `enqueue_notification_delivery` and every claim function are granted to `service_role` **alone**, so no signed-in person of any role can cause a message to reach anybody — including themselves. |
| **The link is derived, never accepted** | §19. `create_notification` builds the deep link from the audience, the resource type and the id through `public.notification_link_path()`; there is no link parameter. A practitioner is pointed at `/doctor/appointments/<id>` and never into `/patient`, and at nothing at all for a prescription or plan they wrote — the function returns `null` and the creator raises `PV056` rather than storing an empty path. A check constraint refuses anything that is not an application-relative path under a known area, with no scheme, no protocol-relative form and no traversal — the same refusal Phase 06's `safeRedirectPath` makes. |
| **A notification link authorizes nothing** | §§18, 85, and example 8. It identifies a resource; the destination re-authenticates and re-authorizes on arrival, behind `requireUser()` and row-level security that predate this phase. Patient A following patient B's link reaches the same not-found state as patient A guessing an id. |
| Notification isolation | `recipient_user_id = (select auth.uid())` **and** `status = 'active'`. The second half is what makes a **scheduled reminder invisible to the patient it is for** — a predicate on the row rather than a filter a query could forget, the same arrangement Phase 13 used for `status <> 'draft'`. |
| Preference isolation | `user_id = (select auth.uid())`, and `set_notification_preference` takes **no user id** — §97's `{"userId": "another-user"}` has nowhere to arrive, and §98's staff accounts are scoped by exactly the same mechanism as a patient's. Which categories a person is *shown* follows their audience, which is presentation: the policy is what decides what they can read. |
| Client cannot write any notification table | **No insert, update or delete grant and no such policy, for any client role.** Read state and preferences change through definer functions scoped by `auth.uid()` in the statement itself, so somebody else's id affects no rows — indistinguishable from an id that does not exist (§55). |
| **The queues are unreachable from any client** | `notification_outbox` and `notification_deliveries` have row-level security enabled and **no policy at all**, and everything is revoked from `anon`, `authenticated` **and `service_role`**. §107's "do not allow the browser to update delivery status" is satisfied by there being nowhere to update it from. |
| **Notifications own no domain state** | §2. The migration performs no insert, update or delete against `appointments`, `prescriptions`, `treatment_plans`, `clinical_records`, `patients`, `patient_documents`, `user_roles`, `profiles` or `practitioners`, adds no column to any of them, and replaces no function from an earlier phase. Asserted structurally. |
| **A provider outage cannot affect a domain write** | §§65, 103, and example 6. The outbox row is written by an `after` trigger **inside the domain transaction**, so no provider is reachable from inside it; the processor runs afterwards through `after()`, once the response has been sent. `scheduleNotificationDispatch()` cannot throw in either direction — a full test run found that `after()` throws outside a request scope, which would have turned a committed booking into an error. |
| Idempotency | Three layers. The outbox key is unique, so a repeated trigger writes no second event; `create_notification` is idempotent on the notification key; `enqueue_notification_delivery` is unique per (notification, channel). Duplicate *logical* notifications are impossible. External email is **at-least-once** and bounded, stated honestly: no configured provider offers request idempotency. |
| Reminder correctness | The authoritative appointment is read **twice** — when the set is planned, and again when a reminder falls due, where it must still be confirmed, still in the future and still start at the instant the reminder was computed from. A cancelled, rescheduled, completed or no-show appointment therefore cannot produce a reminder, even if the processor never saw the change. |
| **A draft prescription produces no notification** | Checked twice: the trigger fires only on the transition into `issued`, and the processor re-reads the authoritative row before rendering anything (§123). |
| Clinical data in notifications | **There is no column for any of it.** No diagnosis, symptom, assessment, medicine, dose, item, plan title, document title, doctor's note, cancellation reason or patient note — so none can be stored, let alone sent. The context functions that feed the templates return the same minimum, which makes it structural rather than a convention the next template must remember. §§36, 80–83, 128. |
| Email subject privacy | §37 and example 4. An appointment subject carries the operational fact; a **clinical** subject is the neutral "New update from Punarvasu", because the *existence* of a prescription is itself information about somebody's health. Asserted over every template. |
| Clinical data in logs | A log line carries the operation, an opaque event or delivery id, the event type and a short machine code — §78's own safe example. **Never** a title, body, address, link, practitioner name or appointment time. The provider's response body is read only far enough to tell an invalid recipient from a rejection, then discarded: it can echo the request back, which here means an address and a live link. Asserted over every `logger.*` call in the feature. |
| Contact verification | §75. `claim_notification_deliveries` skips a delivery whose account has no **confirmed** email address, recorded as `skipped/unverified_contact` rather than retried. The address is read from `auth.users` for one send and is never copied into this schema — no notification table has an email, phone or address column. |
| Preferences at delivery time | §71. Evaluated at claim time, not captured at creation, so a preference changed after the event still applies. A disabled channel is `skipped/preference_disabled`. |
| Mandatory transactional communication | §22. The in-app channel of `appointment_updates` and `clinical_updates` cannot be switched off — refused in the database and rendered disabled with the reason in the open. Email is optional for every category. Reminders are optional entirely. |
| No marketing, and nothing to consent to | §§23, 24. There is no promotional category, no campaign and no way to create one without a migration; the preferences page says so rather than leaving a patient to infer it. Signing in has never been treated as consent for anything. |
| Provider credentials | `NOTIFICATIONS_EMAILJS_*` in `config/env.server.ts`, which imports `server-only` — a client component reaching for one is a build error. All four or none: three of four yields **no email channel**, not one that fails on every send. Never logged at any level. |
| Worker endpoint | `POST /api/notifications/process`, authenticated by `NOTIFICATIONS_WORKER_SECRET` compared with `timingSafeEqual`, length-checked first. **When the secret is unset it refuses every request** — an endpoint that drains a queue and sends email must never default to open because a variable is missing. It discloses counts only, and a refusal discloses nothing, not even whether the secret is configured. |
| Rate limiting | §108. A fixed-window in-memory limiter on the worker endpoint, bounding the cost of guessing the secret and of a scheduler misconfigured into a loop. Described honestly as a per-instance guard rail, not a distributed quota. The thing §108 most cares about — spamming somebody else's address — is prevented structurally: no endpoint takes a recipient. |
| Retry bounds | §46. Four attempts over ~20 minutes for a transient failure, then the dead letter. A **permanent** failure (invalid recipient, provider rejection, auth failure) is not retried at all, whatever the attempt count says. |
| **No SMS and no WhatsApp** | §14. Not as an enum value, not as an adapter, not as a stub. No provider is configured, and §101 requires capability, consent, sender registration and template approval to be settled first. Adding one is an adapter, one line in `resolveChannels()`, and two migrations. |
| **No webhooks** | No configured provider supports delivery webhooks (EmailJS does not), so none is implemented — §51 is conditional. `notification_deliveries.provider_message_id` exists for the one that would resolve against it, and there is deliberately **no `delivered` status**: nothing can set it, and a status nothing can set is one somebody will one day read as true. |
| Private pages are not publicly cached | `private, no-store` from the proxy, `force-dynamic` on the authenticated shell, `noindex` on every route, and `robots.txt` disallows `/notifications`. The worker's reply is `private, no-store` explicitly. |
| Safe errors | `features/notifications/errors.ts`, SQLSTATE range `PV050`–`PV055`, disjoint from every earlier phase. No table, policy, queue or SQL can reach a screen or a log. Provider classification is a **separate** function whose output is a machine code for a column, never a sentence for a person. |

---

### Implemented (Phase 14) — patient documents and secure storage

| Control | How |
| --- | --- |
| Permission model | Four permissions added. Two — `documents.read.self`, `documents.write.self` — to the **patient role alone**, which is the first *write* permission a patient has ever held over anything clinical-adjacent. Two — `documents.read.care`, `documents.write.care` — to the **doctor role alone**. **None to a receptionist and none to an administrator**, which narrows §6's matrix row deliberately; the reasoning is in that row. |
| **The bucket is private** | `patient-documents` is created with `public = false`, and the insert carries `on conflict (id) do update set public = false` so a later migration cannot quietly make it public. **Verified live**: the bucket reports private, the public URL endpoint refuses, and an anonymous direct request for a known object is refused. |
| **Storage has its own policy** | `storage.objects` carries **one** policy for this bucket: a select for `authenticated`, predicated on `public.can_read_patient_document_object(name)`, which resolves the object key to its row and asks exactly what the table asks. Row-level security and storage are two layers, not one — §2.2. Verified live: patient B, an untreating doctor, a receptionist and an administrator are each refused a signed URL **and** a direct download for a path they know. |
| **No client role writes the bucket** | No insert, update or delete policy on `storage.objects` for any client role. A client that could write could choose its own path, which is the whole attack. Object writes use the **service-role client**, server-side, after authorization — the first and only feature in the product to use that key, and §17's permitted case. |
| **Signed URLs use the caller's own client** | Deliberately *not* the service role. Minting a URL with it would bypass the storage policy and throw away the layer above. Asserted structurally: the admin client appears in the write path of `features/documents/storage.ts` and nowhere else in the feature. |
| **Authorization before signing** | Structural rather than remembered: the storage path is **not an input** to the access action. It is read off a row row-level security already admitted, so there is no branch in which a URL is minted for a path a caller supplied. |
| **Signed URLs are short-lived** | 300 seconds, in `src/config/documents.ts`. The preview closes itself before the URL lapses rather than showing a broken frame. Verified live: an expired URL is refused, and a forged token is refused. |
| **The path is generated, then recomputed** | `patients/{patientId}/documents/{documentId}/document.{ext}`. The original filename is **not an argument** to the builder, so `../../another-patient.pdf` has nothing to influence, and the extension comes from the type the *server* detected. The database rebuilds the string and raises `PV041` if it differs, and `patient_documents_storage_path_shape` refuses an uncontrolled path a second time — **including against the service-role client** (`23514`). Verified live for a path naming another patient, a traversal path, an absolute path, a path naming the bucket, and a hand-written path. |
| **The path carries no clinical information** | Two opaque uuids and a generated filename. No name, no date of birth, no diagnosis, no type, no date. |
| **What a file is, is decided by its bytes** | Three checks must all agree: the signature bytes, the extension, and the declared type. The **detected** type is what is stored, what becomes the object's `Content-Type` and what decides the extension; the declared one is never written anywhere. A closed six-type allowlist — PDF, JPEG, PNG, WebP, HEIC, HEIF — held in the configuration, in a check constraint and on the bucket, all three asserted to agree. **Verified end to end in a browser**: an executable named `.pdf` and declared `application/pdf` is refused and no row is created. |
| **SVG is excluded permanently** | An SVG is a document that can carry script; rendering one from a patient's upload would be a same-origin XSS on a healthcare portal — §19. HTML, XML, archives and executables are absent for the same family of reasons, and the allowlist is closed rather than a denylist. Verified end to end: an SVG upload is refused and nothing is stored. |
| Size limits | 10 MB, bounded **twice** before the bytes are stored — against the declared size before a byte is read, so an oversized request is refused without being buffered, and against the bytes themselves in case the declaration lied — then again by a check constraint and again by the bucket. |
| **Uploaded content is never executed or rendered by us** | Nothing in Punarvasu opens a document except to read its first 32 bytes. A preview is an `<img>`, or an `<iframe sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer">` whose origin is the storage service's and not the application's — so `allow-same-origin` grants the document its own *foreign* origin rather than ours. Top-level navigation, forms and popups are withheld. No third-party viewer. |
| **Patient isolation** | `patient_id = public.current_patient_id()`. Verified live: patient B sees no document at all, cannot read A's by id, cannot find it by its storage path, cannot sign A's object, cannot download it directly, and cannot archive it. Not-found and not-yours are the same answer. |
| **The doctor's access policy** | `public.doctor_has_care_relationship(patient_id)` — deliberately **wider** than Phase 12/13's authoring model, because a lab report is evidence the patient brought in for whoever is treating them rather than a conclusion one practitioner reached. §6's hard boundary still holds and is what is enforced: a doctor with no care relationship reads nothing and signs nothing. Verified live in both directions with two practitioners. **A product decision the clinic should confirm.** |
| **Receptionist isolation** | **No policy on the table and no policy on the bucket**, which is stronger than a predicate that evaluates to false. This narrows the matrix row below, which said "Upload only": that describes an operational workflow nobody has designed — no surface, no narrowly scoped permission, no audit trail — and granting it now would grant it through a UI that does not exist. Verified live and in a browser. |
| **Admin isolation** | No policy either. Administrative capability does not imply clinical document access, and the matrix says "audited" — the subsystem that word refers to does not exist, so granting the read now would grant it unaudited. |
| Client cannot write the table | **No insert, update or delete grant and no such policy, for any client role.** Verified live for all four roles across all three operations. Every write is a `security definer` function. |
| Identity is derived, never accepted | **There is no `patientId`, `practitionerId`, `uploadedBy`, `storagePath`, `mimeType` or `status` parameter on any of the three write functions**, and none in any schema in the feature. The practitioner's upload takes **one** identifier — an appointment — and re-resolves it by the caller's own practitioner record before reading a patient out of it. Asserted structurally, and verified live: doctor B cannot upload against doctor A's appointment (`PV045`), a doctor cannot use the patient's upload function and a patient cannot use the practitioner's (`42501`). |
| Relationship consistency | **Composite foreign keys** on `(appointment_id, patient_id)` into `appointments` and `(clinical_record_id, patient_id)` into `clinical_records`. A document for patient A attached to patient B's appointment is not something application code must prevent — the database cannot represent it. Verified live (`23503`) in both directions. |
| Historical integrity | `upsert: false` on the object write, a **unique** and **immutable** storage path, and `patient_documents_guard_update()` refusing a change to the patient, the object, the file, the type, the size, the uploader or the clinical associations. **Verified live against the service-role client**, which bypasses row-level security and is still refused (`PV042`). Because the path encodes the document's own id, a second row **cannot** name an existing object at all. |
| Deletion | There is none. No delete function, no delete grant, no delete policy, and `on delete restrict` on every reference — so a patient, an appointment or a practitioner with a document cannot be deleted either (verified live). Withdrawal is `active → archived`, one-way, by the uploader only, with the object untouched and the document still downloadable. There is **no retention policy, therefore no automatic deletion**. |
| Clinical data in logs | **No document content and no clinical metadata, ever** — no title, filename, description, archive reason, storage path, signed URL or checksum. A log line carries the operation, the actor's opaque id and the document's opaque id. A *rejected* file logs the reason category and **not the filename**, because a filename is something the patient chose and may contain their own name. Asserted by a parenthesis-matching scan over every `logger.*` call in the feature, and behaviourally in the action tests. |
| Nothing sensitive in a URL | Access is a **server action**, not `GET /api/documents/:id/access`, so a document id never reaches a URL — and therefore never reaches browser history on a shared machine, a proxy log or the next `Referer`. The upload endpoint takes no id at all. Measured in a real browser: after opening a preview the address bar carries no query string. |
| Nothing sensitive in browser storage | The signed URL lives in component state while the preview is open and is discarded when it closes, expires or unmounts. **Measured in a real browser, twice**: no URL, title or path in `localStorage` or `sessionStorage`. |
| Private pages are not publicly cached | `private, no-store` from the proxy, `noindex` on every route, `robots.txt` disallows both areas, the upload reply is `private, no-store` explicitly, and stored objects are written with `cacheControl: "0"`. **No `next/image` on a document preview** — it would proxy a patient's file through the image optimizer and cache it on a shared CDN. All verified in a browser. |
| Actor columns | `uploaded_by`, `archived_by` and `checksum_sha256` are **not in the select grant**, so no client reads them through any query. A column privilege belongs to a database role, and a patient and a doctor are both `authenticated`. |
| Safe errors | `features/documents/errors.ts`, SQLSTATE range `PV040`–`PV047`, disjoint from every earlier phase. No bucket name, table name, policy name, storage path or SQL can reach a screen or a log, and every message says explicitly what happened to the file. All three type failures read alike to a caller while staying distinct in the log. |
| **No interpretation of content** | No OCR, no extraction, no classification, no summarisation, no column holding anything derived from a file, and no dependency that could do any of it. Asserted structurally. Phase 17 owns clinical decision support. |
| **No malware scanning** | None is available in this deployment. The limitation is **stated on the upload form** rather than implied away — see §18 below. |

---

### Implemented (Phase 13) — prescriptions and treatment plans

| Control | How |
| --- | --- |
| Permission model | Six permissions added. Four — `prescriptions.read`, `prescriptions.write`, `treatment_plans.read`, `treatment_plans.write` — to the **doctor role alone**. Two — `prescriptions.read.self`, `treatment_plans.read.self` — to the **patient role alone**, which is §6's matrix rows "Prescriptions: View own" and "Treatment plans: patient-facing parts of own" built for the first time. Documents remain undeclared; they arrive with Phase 14. |
| **The doctor's access policy** | The **authoring-practitioner model**, unchanged from Phase 12: a doctor reads and writes the prescriptions and plans whose `practitioner_id` is their own practitioner record. Decided by `prescriptions_select_author` and `treatment_plans_select_author`, and by nothing in application code. Verified live in both directions with two doctors. |
| **The patient's access policy, and the draft rule** | `patient_id = current_patient_id()` **and `status <> 'draft'`**. The second half is the one that matters and it is in the *policy*, not in a query: a draft prescription is invisible to the patient it was written for at the database level, so a query added later cannot forget it. The items policies say the same through a `security definer` predicate. Verified live: the patient sees the issued prescription and its items, and sees nothing at all while it is a draft. |
| **Receptionist isolation** | **No policy on any of the four tables**, which is stronger than a predicate that evaluates to false. §6's hard boundary, and `phase_13.md` section 36 and example 7. Verified live for prescriptions, items, plans and plan items. |
| **Admin isolation** | No policy either. `phase_13.md` section 37: administrative capability does not imply clinical prescription access, and any administrative access must be *audited* — the subsystem that word refers to does not exist, so granting the read now would grant it unaudited. |
| Client cannot write | **No insert, update or delete grant on any of the four tables for any client role, and no such policy.** Verified live for all four roles across insert, update and delete. Every write is a `security definer` function. |
| Practitioner identity | Derived inside the database by `public.assert_care_practitioner()` — Phase 11's gate, reused unchanged. **There is no `doctorId`, `practitionerId`, `patientId`, `appointmentId` or `status` parameter on any of the ten functions**, and none in any schema in either feature. Asserted structurally and verified live. |
| Ownership | Every write resolves the row by id **and** by the caller's own practitioner id in one statement, so another practitioner's prescription is indistinguishable from one that does not exist (`PV020`). |
| Relationship consistency | A **composite foreign key** on `(clinical_record_id, appointment_id, patient_id, practitioner_id)` into `public.clinical_records`. A prescription naming a different patient than its consultation does is not something application code must prevent — the database cannot represent it. Verified live (`23503`) for a wrong patient, a wrong practitioner and a wrong appointment. |
| Duplicate prescriptions | A **partial** unique index on `clinical_record_id where status <> 'cancelled'`, plus `on conflict ... do nothing` in the creating function. A double-click, a retry, a refresh and two genuinely concurrent requests all resolve to one prescription. Verified live with parallel calls. |
| **Duplicate issue** | `issue_prescription` matches only a `draft` row at the expected revision, so a second request — concurrent or not — reaches no row and is reported as a conflict. **Verified live: two simultaneous issues, exactly one succeeded, and still exactly one prescription.** |
| **Stale writes** | An optimistic `version` column, incremented by trigger so no function can forget, and applied in the `where` clause of the update itself so two concurrent saves cannot both write. A stale write is refused (`PV022`) and **nothing is overwritten**. Verified live, including two concurrent saves at one revision. |
| **Issued prescriptions** | Immutable in the database: `prescriptions_guard_update()` refuses a content change on a non-draft row and `prescription_items_guard_write()` refuses any item write beneath one. **Verified live against the service-role client**, which bypasses row-level security entirely and is still refused. |
| **Active treatment plans** | The same, from activation rather than completion: an active plan is what the patient was actually told to do, and rewriting it would rewrite what they were told. Verified live, including against the service role. |
| Deletion | No delete function, no delete grant, no delete policy, no control. Every reference to a patient, practitioner, appointment or clinical record is `on delete restrict`, and the items guard refuses even a cascade — so an issued prescription **cannot be deleted at all**, by anybody. Verified live. |
| Amendment | Withdraw, then write a new one. The partial unique index frees the consultation while the withdrawn row — its items, its issue time and its reason — stays for ever. Verified live end to end. |
| Medicine suggestions | `public.search_prescribed_medicines()`: doctor-only, restricted to the caller's **own prescribing history** in the `from` clause, refuses an empty term, clamps its own limit, escapes `%` and `_`, matches a **prefix only**, and returns two columns — a name and a form. No patient, no date, no dose. The term is a parameter rather than part of a filter expression, and it is never logged. |
| Search term privacy | A POST to a server action, not a `GET` with `?q=`. What a doctor is typing into a medicine field is clinical content, and a URL reaches browser history on a shared consulting-room machine, proxy logs and the next `Referer`. |
| Clinical data in logs | **No clinical content, ever** — no medicine, dose, frequency, timing, instruction, withdrawal reason, plan title or follow-up date. A log line carries the operation, the actor's opaque id and the prescription's opaque id, which is `phase_13.md` section 83's "good" example exactly. Asserted structurally and behaviourally, and `lib/logging/redact.ts` gained the matching key fragments as a safety net. |
| Actor columns | `created_by`, `issued_by`, `cancelled_by`, `activated_by` and `completed_by` are **not in the select grant**, so no client reads them through any query. A column privilege belongs to a database role and a patient and a doctor are both `authenticated`, so a column readable by one is readable by the other. Verified live. |
| Safe errors | `features/prescriptions/errors.ts` and `features/treatment-plans/errors.ts`, with disjoint SQLSTATE ranges. No policy error, RLS failure, SQL statement, constraint name, table name or connection string can reach a screen or a log, and every message says explicitly what happened to the work. |
| Service-role key | Unused by both features. Asserted structurally. |

---

### Implemented (Phase 12) — clinical records

| Control | How |
| --- | --- |
| Permission model | Two permissions added — `clinical_records.read`, `clinical_records.write` — granted to the **doctor role alone**, in the same change as the table they protect. Prescriptions, treatment plans and documents remain undeclared; they arrive with Phases 13 and 14. |
| **The clinical access policy** | The **authoring-practitioner model**: a doctor may read and write a clinical record when its `practitioner_id` is their own practitioner record. Decided by `clinical_records_select_author` and by nothing in application code. It is one notch narrower than §6's "scoped by treatment relationship": being booked to see somebody lets a practitioner read *who they are*; it does not let them read *what a colleague concluded* about them. Verified live in both directions with two doctors. |
| **Receptionist isolation** | **No policy on `public.clinical_records` at all**, which is stronger than a predicate that evaluates to false — a predicate can be weakened by an edit. §6's hard boundary, verified live and in a browser. |
| **Patient isolation** | No policy either. A doctor-facing clinical record is not a patient-facing one; a patient-visible representation would be a deliberately authorized projection with its own query, policy and type, and Phase 12 does not build one. |
| **Admin isolation** | No policy. Administrative capability and clinical access are separate concepts, and §6's matrix marks clinical notes "Read, audited" — the audit subsystem that word refers to does not exist, so granting the read now would grant it unaudited. |
| Client cannot write a clinical record | **No insert, update or delete grant on `public.clinical_records` for any client role, and no such policy.** Verified live for all four roles. Every write is a `security definer` function. |
| Practitioner identity | Derived inside the database by `public.assert_care_practitioner()` — Phase 11's gate, reused unchanged. **There is no `doctorId`, `practitionerId`, `patientId` or `status` parameter on any function or in any schema in this feature**, and no such field on the consultation form. Asserted structurally and verified live. |
| The record's ownership | Every write resolves the record by id **and** by the caller's own practitioner id in one statement, so another practitioner's record is indistinguishable from one that does not exist (`PV018`). |
| Relationship consistency | A **composite foreign key** on `(appointment_id, patient_id, practitioner_id)` into `public.appointments`. A record naming a different patient than its appointment is not something application code must prevent — the database cannot represent it. Verified live (`23503`). |
| Duplicate consultations | A unique index on `appointment_id`, plus `on conflict do nothing` in the creating function. A double-click, a retry, a refresh and two genuinely concurrent requests all resolve to one record. Verified live with parallel calls. |
| **Stale clinical writes** | An optimistic `version` column, incremented by trigger so no function can forget, and applied in the `where` clause of the update itself so two concurrent saves cannot both write. A stale write is refused (`PV015`) and **nothing is overwritten**. Verified live, including two concurrent saves at one version. |
| **Completed records** | Immutable in the database: `clinical_records_guard_update()` refuses an update that changes any of the eight clinical fields on a non-draft row, and the identity columns are immutable too. Verified live (`PV016`). |
| Deletion | No delete function, no delete grant, no delete policy, no control. Every foreign key is `on delete restrict`, so deleting a patient, practitioner or appointment with a clinical record **fails loudly** rather than destroying history. Verified live. |
| Clinical data in logs | **No clinical content, ever** — not a field value, not a length, not which sections were filled in. The log carries the operation, the actor's opaque id and the record's opaque id. Asserted structurally and behaviourally. |
| Clinical data in the browser | Nothing in `localStorage`, `sessionStorage` or `IndexedDB`, and nothing in a URL. Asserted in jsdom and **measured in a real browser**. |
| Safe errors | `features/clinical/errors.ts`. No policy error, RLS failure, SQL statement, constraint name, table name or connection string can reach a screen or a log. Every failure message says explicitly that the changes were not saved. |
| Caching | Dynamic routes inside the `force-dynamic` authenticated shell, served `private, no-store`, `noindex`, and disallowed in `robots.txt`. Verified in a browser. |
| Service-role key | Unused by this feature. Asserted structurally. |

---

### Implemented (Phase 11) — the doctor workspace

| Control | How |
| --- | --- |
| Permission model | Three permissions added — `appointments.read.own_schedule`, `appointments.manage.own_schedule`, `patients.read.care` — granted to the **doctor role alone**. None is clinic-wide: the receptionist's three stay at the desk, and no clinical permission is declared because no clinical table exists. |
| **The patient-access policy** | The **appointment-linked model**, which is what `docs/SECURITY.md` §6's "scoped by treatment relationship rather than by role alone" means here: a doctor may read a patient when an appointment exists between that patient and the doctor's **own** practitioner record. Decided by `public.doctor_has_care_relationship()`, behind `patients_select_doctor_care`. A doctor with no appointment with a patient reads nothing about them, cannot find them by searching, and cannot act on their appointments. |
| Cross-doctor isolation | Verified live in both directions. Doctor A cannot read, search or act on doctor B's patients or appointments, and vice versa. The status function resolves the appointment by id **and** by the caller's own practitioner id in one statement, so another practitioner's appointment is indistinguishable from one that does not exist. |
| Doctor identity | Derived inside the database by `public.assert_care_practitioner()`, which reads `auth.uid()`, refuses a non-doctor, refuses a doctor with no practitioner record, and **returns the practitioner id**. There is no `doctorId` or `practitionerId` parameter on any function or in any schema in this feature. |
| A doctor account not on the roster | Holding the doctor role is not the same as being a practitioner. An account with no `practitioners` row resolves to `null`, is refused by the gate, and reads no patient — verified live. It does not fall through to "everybody". |
| Client cannot write an appointment | **Unchanged and still absolute.** No insert, update or delete grant on `public.appointments` for any client role, and no such policy. Every doctor write is a `security definer` function call. |
| Status | A **role allowlist** of `confirmed, in_consultation, completed, no_show` — the complement of the front desk's. `cancelled` and `checked_in` are refused for this role, the Phase 09 transition trigger holds independently, and the schema refuses the value at the trust boundary. Three layers, all verified live. |
| No rescheduling, no cancelling | Not a hidden control: there is no server action, no RPC and no permission. Both change a patient's plans and need somebody to tell them, so they stay at the front desk where the actor is recorded. |
| Patient search | `public.search_care_patients()`: doctor-only, restricted to the caller's own care scope in the `from` clause, refuses a term under two characters, clamps its own limit, escapes `%` and `_`, and returns six columns — no address, no emergency contact, no account identifier. The term is a parameter rather than part of a filter expression, and it is never logged. |
| Search term privacy | A POST to a server action, not a `GET` with `?q=`. A search term is somebody's name, and a URL reaches browser history on a shared consulting-room machine, proxy logs and the next `Referer`. Verified in a browser that the term never reaches the URL. |
| Data minimisation | The doctor's patient query names a **narrower** column list than the front desk's: no `address_line1`, `address_line2` or `postal_code`. No Phase 11 workflow needs a doorstep. |
| Clinical boundary | Nothing to filter: `public.patients` has no clinical column and Phase 07's migration forbids adding one; `internal_note` has no column grant for any client role; `schedule_exceptions` still has RLS and **no policy at all**, verified live for a doctor too. |
| Row-level security | Two added policies, each naming the doctor role through `has_app_role()` **and** scoping by relationship. No `using (true)` anywhere, no policy dropped, no existing predicate altered. |
| Safe errors | The Phase 09 mapper, unchanged. Phase 11 introduces no new SQLSTATE — it raises `PV008`, `PV009` and `insufficient_privilege`, which already meant what it needs them to mean. No constraint name, table name or provider text reaches a user or a log. |
| Service-role key | Unused by this feature. Asserted structurally. |

---

### Implemented (Phase 10) — the receptionist workspace

| Control | How |
| --- | --- |
| Permission model | Three permissions added — `appointments.manage.any`, `patients.read.operational`, `patients.write.operational` — granted to the **receptionist role alone**. The doctor still holds nothing; the admin does not hold these, because the administrative scheduling surface the matrix's "Controlled" implies does not exist and would need its own audit trail. |
| Client cannot write an appointment | **Unchanged and still absolute.** No insert, update or delete grant on `public.appointments` for any client role, and no such policy. Verified live for all four roles. Every receptionist write is a `security definer` function call. |
| Staff authorization | `public.assert_appointment_manager()`, called first by all six staff functions. Reads `auth.uid()` and `public.user_roles`, takes no argument, raises rather than returning a boolean a caller could ignore. |
| The patient id on a staff write | The one identifier a staff write accepts, because the receptionist chooses the patient. It is *data*: validated against `public.patients` before anything is written (`PV014`), while the caller's identity and role come from the database. The same argument Phase 08 made for `targetUserId`. |
| Status | Still set by the function, never accepted. A **role allowlist** refuses `completed` and `in_consultation` for the front desk, a mirrored `case` produces a message a person can act on, and the Phase 09 transition trigger is what actually holds. Three layers, all verified live. |
| Duration, end, blocked-until | Still derived from the appointment type. Not parameters of any staff function. |
| Self-service rules | `assert_bookable_slot` gained `p_require_online_booking` and `p_min_notice_minutes`, so the front desk can book a practitioner who does not take online bookings and can book for today — without a second validator. The calling *function* passes them; no request reaches them. Every rule that is a property of the diary still binds both. |
| Patient search | `public.search_patients()`: receptionist-only, refuses a term under two characters, clamps its own limit, escapes `%` and `_`, and returns seven operational columns — no address, no emergency contact, no account identifier. The term is a parameter rather than part of a filter expression, and it is never logged. |
| Search term privacy | The search is a POST to a server action, not a `GET` with `?q=`. A search term at a front desk is somebody's name, and a URL reaches browser history on a shared machine, proxy logs and the next `Referer`. |
| Patient creation | `public.create_patient_record()` has **no owner parameter**, creates no account and no credential, and always writes `profile_id = null`. Verified live that passing an owner is an error. |
| Clinical boundary | Nothing to filter: `public.patients` has no clinical column and Phase 07's migration forbids adding one; `internal_note` has no column grant for any client role, so making it readable by a receptionist would make it readable by every patient. `schedule_exceptions` still has RLS and **no policy at all**. |
| Row-level security | Three added policies, each naming the receptionist role through `has_app_role()`. No `using (true)` anywhere, no policy dropped, no existing ownership predicate altered. |
| Concurrent booking | The same exclusion constraint. A receptionist at the desk and a patient booking from home race through one index; verified live with two parallel calls, one refused with `23P01`. |
| Safe errors | The Phase 09 mapper, with one code added (`PV014`). No constraint name, table name or provider text reaches a user or a log. |
| Service-role key | Unused by this feature. Asserted structurally. |

---

### Implemented (Phase 09) — appointments

| Control | How |
| --- | --- |
| Permission model | Two permissions added, `appointments.read.self` and `appointments.write.self`, granted to the patient role alone. Staff appointment capabilities are still absent because the receptionist and doctor workspaces do not exist; they arrive with the surfaces they protect. |
| Client cannot write an appointment | **No insert, update or delete grant on `public.appointments` for any client role, and no such policy.** Every write is a `security definer` function call. |
| Patient identity | Derived inside the database from `auth.uid()` through `current_patient_id()`, which takes no argument. There is no `patientId` parameter on any write function to substitute. |
| Duration and buffer | Read from `appointment_types` inside the function. A client sends an id; it cannot send a length. |
| Status | Set by the function, never accepted as a parameter. Transitions are constrained by `appointments_guard_transition()`. |
| Timestamps | `starts_at` is the one instant a client supplies, and it must carry an explicit timezone offset; `ends_at`, `blocked_until`, `created_at`, `updated_at` and `cancelled_at` are all computed or defaulted by the database. |
| Internal notes | `internal_note` is **not in the column-level select grant** to `authenticated`, so no client can read it through any query, `select *` included. |
| Cross-patient access | RLS restricts `appointments` to `patient_id = current_patient_id()` **and** the patient role. The write functions resolve the appointment by id *and* by the caller's own patient record in one statement, so somebody else's id is indistinguishable from one that does not exist. |
| Doctor access | One narrow policy: a doctor's own diary, scoped by the practitioner *relationship* (`practitioners.profile_id = auth.uid()`), never by the doctor role alone. |
| Blocked-period reasons | `schedule_exceptions` has RLS enabled and **no policy at all**. Availability reads it through a definer function returning interval boundaries only. |
| Concurrent booking | A PostgreSQL exclusion constraint over `(practitioner_id, tstzrange(starts_at, blocked_until))`, excluding cancelled. At most one of two concurrent requests can succeed, regardless of how the application is written. |
| Abuse bound | A configurable cap on concurrent upcoming appointments per patient, enforced inside `book_appointment`. |
| Availability endpoint | Authenticated, permission-checked, input-validated, window-bounded, `private, no-store`. Discloses interval boundaries and nothing else. |
| Safe errors | Application-defined SQLSTATEs mapped to fixed copy in `features/appointments/errors.ts`. No constraint name, table name or provider text reaches a user or a log. |
| Service-role key | Unused by this feature. The elevated operations are `security definer` functions with their own checks. |

### Implemented (Phase 08)

| Control | How |
| --- | --- |
| Source of truth | `public.user_roles`, keyed to `auth.users(id)`, `role` a database enum. `unique (user_id, role)`, plus a unique index on `user_id` alone that enforces the one-role rule below. `profiles.role` was moved here and dropped. |
| One role per user | The `user_roles_single_role_per_user` index. Dropping that one index is the whole change needed to permit multiple roles later. |
| Role resolution | `getCurrentUser()` in the application; `public.current_app_role()` and `public.has_app_role()` for policies. All three answer only about the verified caller. |
| Client cannot write a role | **No grant and no policy.** `authenticated` holds `select` on `user_roles` and nothing else, so an insert, update or delete is refused at the privilege check before RLS is consulted. Verified live for all four roles. |
| Role assignment | `public.assign_user_role()`, `security definer`. Refuses no session, a non-admin caller, a self-targeted change **including by an admin**, and an unknown target. Repeated in `features/admin/actions.ts` so the refusal reaches the user as a sentence. |
| Audit | `public.role_assignment_events` — actor, target, previous role, new role, timestamp. Insert-only: written by the definer function, readable by admins, and no grant to update or delete it. |
| Permission model | `config/permissions.ts` — four permissions, for the four things the application can currently do. Nothing speculative is declared. |
| Server enforcement | `lib/authorization/guards.ts`. Route guards redirect to `/forbidden`; action guards throw a `forbidden` `AppError`. |
| Fail closed | An unresolvable role is `null` and holds nothing. Never defaulted to `patient`. |
| Patient records | Phase 07's ownership policies are preserved and narrowed by role: self-service on `public.patients` now also requires the patient role, so a doctor cannot create one for themselves by posting to the profile action. |
| Refusal disclosure | `/forbidden` names no role, no required role, no permission and no policy. Asserted by test and verified in a browser. |
| Service-role key | Unused by this feature. The two operations that need elevated access are `security definer` functions with their own checks, so the key that bypasses every policy stays out of the request path. |

### Permission matrix

Planning-level for the cells no phase has built yet. The rows marked
**(implemented)** are enforced today by `config/permissions.ts`, the guards in
`lib/authorization/`, and RLS.

| Capability | Patient | Receptionist | Doctor | Admin |
| --- | --- | --- | --- | --- |
| Own patient record **(implemented)** | Read/update | No | No | No |
| Operational patient record **(implemented)** | — | Read/create | No | No |
| Any appointment **(implemented)** | No | View, create, confirm, check in, no-show, reschedule, cancel | No | No |
| Own schedule **(implemented)** | — | — | View; confirm, start, complete, no-show | No |
| Patients in own care scope **(implemented)** | — | — | Read and search, scoped by appointment relationship | No |
| Own appointments **(implemented)** | Read, book, cancel, reschedule | No | No | No |
| Users and roles **(implemented)** | No | No | No | Yes, audited |
| Own profile | Read/update | — | — | Controlled |
| Other users' profiles | No | Contact details only | Treated patients **(implemented)** | Yes, audited |
| Book an appointment | Own | On behalf of any patient **(implemented)** | — | Yes |
| View appointments | Own | All **(implemented)** | Own schedule **(implemented)** | All |
| Cancel/reschedule | Own, within policy | Any **(implemented)** | Own | Any |
| Check-in / check-out | No | Check-in **(implemented)** | No | Yes |
| Clinical notes & assessments **(implemented)** | No patient-facing view exists yet | **No** | Create/manage, scoped to records they authored | **No** — needs an audit trail first |
| Treatment plans **(implemented)** | Read own **active** plans | **No** | Create/manage, scoped to plans they wrote | **No** — needs an audit trail first |
| Prescriptions **(implemented)** | View own **issued** | **No** | Create/issue/withdraw, scoped to ones they wrote | **No** — needs an audit trail first |
| Patient documents **(implemented)** | Read own and **upload own** | **No** — narrowed from "Upload only"; there is no front-desk document surface, no narrowly scoped permission and no audit trail | Read, and upload from own appointment, scoped by **care relationship** | **No** — needs an audit trail first |
| Own notifications **(implemented)** | Read own, mark read, set own preferences | Same — their own | Same — their own, **and a doctor is the only staff role that receives any**: changes to their own diary, naming no patient | Same — their own |
| Send a notification **(implemented)** | **No** | **No** | **No** | **No** — nobody. `create_notification` is granted to `service_role` alone and takes no recipient |
| Clinical AI support **(implemented, Phase 17)** | **No** | **No** | **Yes** — scoped to their own appointments and their own patients | **No** — and an administrator has no practitioner record for a model to be asked about |
| AI writing a clinical record, prescription or plan **(implemented)** | **No** | **No** | **No** | **No** — nobody. There is no action, no RPC and no write path from an AI result to any clinical row |
| Practitioner management | No | No | Own profile subset | Yes |
| Service management | No | No | No | Yes |
| Availability & clinic hours | No | View | Own, request leave | Yes |
| Content / articles | Read published | No | No | Yes |
| Users and roles | No | No | No | Yes, audited |
| Clinic settings | No | No | No | Yes |
| Audit logs | No | No | No | Yes |

### Questions every feature must answer

Before a feature is considered designed, it answers all seven:

1. Who can view this?
2. Who can create it?
3. Who can update it?
4. Who can delete or deactivate it?
5. Who can approve it, where approval applies?
6. Who can reach it through the API directly?
7. Who can access the files associated with it?

An unanswered question here is an unimplemented authorization check.

### Critical rules

Never determine authorization using only a role stored in the browser, held in
client state, or supplied in a request body or header. The role is read from
the database, keyed on the authenticated user.

Authorization is enforced **server-side and, for user or clinical data, at the
database level through RLS**. Hiding a button is a usability decision, never a
security control.

Role assignment and role changes are performed by an admin through an audited
operation. No user can change their own role — including an admin acting on
their own account.

**Implemented and verified live (Phase 08).** A staff member who is also a
patient of the clinic uses a separate patient account, which is why no staff
role carries `profile.read.self` or `profile.write.self`.

---

# 7. Database Security

The database must follow a **deny-by-default** approach.

If Supabase/PostgreSQL is used, Row Level Security (RLS) must be enabled on all tables containing user-specific or sensitive information.

### RLS requirements

Policies must explicitly define:

* Who can `SELECT`
* Who can `INSERT`
* Who can `UPDATE`
* Who can `DELETE`

Example principle:

```text
Patient A must never be able to query Patient B's records,
even if Patient A manually modifies the API request.
```

### Database rules

* Never expose database credentials to the frontend.
* Never use a privileged database/service-role key in browser code.
* Use foreign keys and constraints.
* Use appropriate database types.
* Use transactions for multi-step critical operations.
* Validate ownership before modifying records.
* Avoid unnecessary sensitive columns.
* Never store authentication secrets in ordinary application tables.

---

# 8. API Security

All API endpoints must be designed assuming that attackers can directly call them.

### Every protected endpoint must verify:

1. Authentication
2. Authorization
3. Input validity
4. Resource ownership
5. Business rules

### API requirements

* Validate request bodies.
* Validate query parameters.
* Validate route parameters.
* Validate uploaded files.
* Reject unexpected input where practical.
* Use appropriate HTTP status codes.
* Do not expose internal implementation details.
* Apply rate limiting to abuse-prone endpoints.
* Avoid unnecessarily verbose responses.

### Example

Do not implement:

```text
PATCH /api/patients/:id
```

with the assumption that the frontend only shows the current user's ID.

The server must independently verify that the authenticated user is allowed to modify that patient record.

---

# 9. Input Validation

All external input is untrusted.

Validate:

* Names
* Email addresses
* Phone numbers
* Dates
* Appointment information
* Search queries
* IDs
* URLs
* File metadata
* Rich text
* Form submissions

Validation must happen server-side.

Client-side validation may be used for better UX but must never be treated as a security control.

Use schema validation consistently, preferably with the project's approved validation library.

---

# 10. Injection Prevention

The application must protect against:

* SQL injection
* XSS
* Command injection
* HTML injection
* LDAP injection where applicable
* Template injection
* Header injection

### SQL

Never construct SQL using unsafe string concatenation.

Use:

* Parameterized queries
* ORM/query-builder parameterization
* Database functions with safe parameters

### XSS

Never render untrusted HTML directly.

User-generated content must be sanitized before being rendered as HTML.

Avoid unsafe patterns such as:

```javascript
dangerouslySetInnerHTML
```

unless there is a documented reason and the content has been properly sanitized.

---

# 11. CSRF Protection

All state-changing operations must be protected against CSRF where the authentication architecture makes CSRF relevant.

Particular attention must be given to:

* POST
* PUT
* PATCH
* DELETE

Do not assume that a request is safe merely because it originated from the application's UI.

### Implemented (Phase 19)

Two layers, because they cover different things.

**Server Actions** are protected by Next.js itself: it compares the `Origin`
header with the host and refuses a mismatch. Almost every mutation in this
product is a server action, so almost every mutation was already covered.

**Route handlers get no such protection**, and two of the three `POST`
endpoints accept `multipart/form-data` — one of the content types a cross-site
form can send with no CORS preflight, carrying the victim's cookies. Until
Phase 19 the only thing standing there was `SameSite=Lax`, which is a property
of the browser rather than a control this application holds.

`createRouteHandler` now performs a same-origin check on every unsafe method,
so a route added later inherits it rather than having to remember it. The
check prefers `Sec-Fetch-Site` — a forbidden header name, which script cannot
set — and falls back to comparing `Origin` against the forwarded host.
`same-site` is refused alongside `cross-site`: a compromised sibling subdomain
is exactly the position a cookie-carrying forgery is launched from.

A request with **no** browser evidence at all is allowed through, deliberately.
A browser always sends `Origin` on a `POST`, including the cross-site form post
that is the attack, so "no `Origin` and no fetch metadata" is not a browser in
the situation being defended against — it is `curl`, a scheduler or a probe,
and those authenticate some other way.

---

# 12. Rate Limiting & Abuse Prevention

Rate limiting should be implemented for endpoints that are susceptible to abuse.

At minimum consider rate limiting:

* Login attempts
* Password reset requests
* OTP/email verification requests
* Contact forms
* Appointment creation
* Appointment cancellation
* Public search
* File uploads
* Administrative APIs

Rate limits should balance security and legitimate patient usage.

Repeated failures should not reveal whether an account exists.

### Implemented — where each limit lives

| Surface | Limit | Where |
| --- | --- | --- |
| Login, registration, reset, email | Supabase Auth's own | Provider |
| Clinical AI | 40/hour per practitioner, 12/hour per patient | Database quota, consumed before the provider is called (Phase 17) |
| Appointment creation | 5 concurrent live appointments per patient | Database (Phase 09) — an abuse bound, not a clinical rule |
| Notification worker | fixed window, behind a shared secret | `POST /api/notifications/process` (Phase 15) |
| **Document upload** | **20/hour per account** | **Phase 19** |
| **Report export** | **10/hour per account** | **Phase 19** |
| **Patient search** | **120/5 min per account** | **Phase 19** |
| Contact form | not applicable | The form is not rendered; no endpoint exists |

The three added in Phase 19 were found unbounded by the section 12 audit and
are each expensive on a different axis: an upload costs 10 MB of memory and a
storage object, an export runs a year-wide aggregate and produces a file of
clinic operations, and a search reads patient records — so repeating it is the
cheapest way to enumerate them.

**They are guard rails on one server instance**, not distributed quotas: two
instances keep two counters and a restart clears them.
`src/lib/rate-limit/fixed-window.ts` is explicit about the difference, and it
is repeated here because a limit described as more than it is becomes the
reason nobody adds the real one.

They are keyed on the **authenticated account**, never an IP: every one of the
three requires a session, an account is attributable and un-rotatable, and a
clinic behind one NAT shares an address. Each is checked *after* authorization,
so a caller who was never going to be allowed the operation cannot exhaust a
real user's allowance.

The numbers are bounds on abuse rather than clinical rules — nobody has given
this project operational figures — and are recorded as provisional in
`src/config/security.ts`.

---

# 13. User Enumeration Prevention

Authentication-related responses must avoid unnecessarily revealing whether a specific user exists.

For example, password-reset requests should preferably use a generic response such as:

```text
If an account exists for this email address, further instructions will be sent.
```

Do not expose sensitive account existence information through:

* Error messages
* HTTP status differences
* Timing differences where practical
* Public APIs

---

# 14. Sensitive Data Protection

Patient and health-related information must be handled as highly confidential.

### Requirements

* Collect only information necessary for the application's purpose.
* Do not expose patient information in URLs.
* Do not place sensitive information in query strings.
* Do not expose sensitive data in browser logs.
* Do not expose sensitive data through analytics tools unnecessarily.
* Do not include sensitive data in error messages.
* Do not include health information in notification previews unless explicitly
  required. **Implemented in Phase 15**: there is no column for any of it, the
  template inputs cannot reach it, and a clinical email carries a neutral
  subject line.
* Avoid storing sensitive data in localStorage.
* Use secure transport for all communication.

---

# 15. Logging & Audit Trails

Security-relevant events must be logged appropriately.

Examples:

* Successful login
* Failed login attempts
* Logout
* Password changes
* Password reset
* Role changes
* Administrative actions
* Patient record access where appropriate
* Patient record modifications
* Appointment modifications
* File uploads/deletions
* Security-sensitive configuration changes

### Logs must never contain:

* Passwords
* Access tokens
* Refresh tokens
* API keys
* Service-role keys
* Full authentication cookies
* Sensitive medical information unless explicitly required and appropriately protected

Audit records should contain enough information to investigate an event without unnecessarily storing sensitive content.

### Implemented (Phase 19) — the security audit trail

Phases 12, 13, 14, 15, 16 and 17 each withheld a capability with the same
sentence: granting it would grant it *unaudited*. `public.security_audit_events`
is what that sentence was waiting for.

**What it records.** Who reached what, when, and whether they were allowed to:
an actor, the actor's role *at the time of the access*, an action, a resource
type, an opaque resource id, whose data it was, an outcome, and a correlation
id. That is the whole table.

**What it cannot record.** There is no column for a diagnosis, a symptom, an
assessment, a note, a medicine, a dose, a title, a filename, a storage path, a
reason or a search term — so a reader learns that a practitioner opened a
patient's record at 14:32 and does not learn what it said. That is what lets
the trail be kept longer than the records it describes, read by whoever
investigates an incident, and shipped to an operations tool.

**Which accesses.** Privileged ones — somebody reaching data that is not their
own:

| Action | Recorded when |
| --- | --- |
| `clinical_record.read` | a practitioner opens a clinical record |
| `prescription.read` | a practitioner opens a prescription |
| `patient_record.read` | staff open a patient's demographic record |
| `document.access_granted` | a signed URL is minted for a document |
| `report.exported` | an administrator generates the operations report |
| `authorization.denied` | any guard refuses a request |

A patient reading their own prescription is deliberately **not** recorded. It
is not privileged access, it happens constantly, and recording it would bury
the entries that matter — which is how an audit trail becomes something nobody
reads.

**Integrity.** Append-only against everybody, including the service-role
client: no update or delete policy, no write grant, and a trigger that raises
on both. An audit record an administrator can quietly edit is not one.

**Who may read it.** Administrators, through one gated function. Not patients,
not receptionists, not doctors — a practitioner seeing who else opened a record
is a different product decision with a different privacy analysis, and it is
not made here.

**It never fails the operation it records.** The write is fire-and-forget on
both sides. A practitioner must not be unable to open a record mid-consultation
because an insert timed out, and the structured log records the same operations
independently.

---

# 16. Error Handling

Production errors must be safe and user-friendly.

Never expose:

* Stack traces
* Database queries
* Database connection details
* Environment variables
* API keys
* Internal file paths
* Framework internals
* Authentication tokens

Bad:

```text
PostgreSQL error: relation patients_prod_xyz does not exist
```

Better:

```text
Something went wrong. Please try again later.
```

Detailed technical errors should be available only in protected server-side logs.

**Implemented (Phase 01).** `AppError` carries a user-safe message and keeps the
real failure in `cause`, which is logged and never serialized. Any unrecognized
throw becomes a generic internal error, so a database or driver message cannot
reach a user. Route handlers return the envelope in `ARCHITECTURE.md` section
10; error pages show only the Next.js `digest`. Covered by tests that assert a
simulated SQL failure leaks no table name, query or patient email.

---

# 17. Secrets Management

Secrets must never be committed to source control.

Examples:

* Supabase service-role keys
* Database passwords
* Email provider API keys
* OAuth secrets
* Encryption keys
* Webhook signing secrets
* Third-party API credentials

### Environment variables

Use environment variables for secrets.

Public environment variables must contain only values that are explicitly safe for browser exposure.

For example:

```text
NEXT_PUBLIC_*
```

must never contain:

* Database passwords
* Service-role keys
* Private API keys
* Encryption secrets

### Git protection

Before committing code:

* Check for secrets.
* Review `.env` files.
* Ensure secrets are included in `.gitignore`.
* Use secret-scanning tools where available.

If a secret is accidentally committed, consider it compromised and rotate it immediately.

### Implemented controls (Phase 01)

* Server-only configuration lives in `src/config/env.server.ts`, which imports
  `server-only`. A client component that imports it fails the build; this was
  verified by deliberately introducing such an import and observing the build
  fail.
* The Supabase service-role key is reachable only through
  `requireSupabaseServiceRoleKey()`, called only by `lib/supabase/admin.ts`.
* `npm run security:scan-bundle` scans the browser-downloadable build output
  (`.next/static`, plus prerendered HTML and flight payloads) for both the
  *names* of server-only variables and the *values* of the ones configured in
  the current environment. It exits non-zero on a hit and never prints a value.
  Run it after `npm run build`; it belongs in CI as a required gate.
* `.gitignore` excludes every `.env*` file except `.env.example`.

---

# 18. File Upload Security

If patients or staff can upload documents/images, uploads must be treated as untrusted.

### Requirements

* Validate file size.
* Validate file type.
* Validate file extension.
* Do not trust the MIME type supplied by the browser.
* Generate safe server-side filenames.
* Prevent executable file uploads.
* Store private files in private storage.
* Do not expose private files through publicly guessable URLs.
* Use signed/temporary URLs where appropriate.
* Restrict who can download files.
* Scan files for malware when appropriate.
* Prevent path traversal.

Never use an uploaded filename directly as a filesystem path.

### Implemented (Phase 14) — patient documents

Every requirement above is met except the last but one, and that exception is
stated rather than glossed over.

| Requirement | How |
| --- | --- |
| Validate file size | Twice before storage — against the declared size before a byte is read, and against the bytes — then a check constraint and the bucket's own limit. 10 MB |
| Validate file type | A closed six-type allowlist, in the configuration, in a check constraint and on the bucket, asserted to agree |
| Validate file extension | Required to be one the detected type may carry |
| Do not trust the browser's MIME type | The **signature bytes** decide. The declared type must merely not disagree, and is never stored |
| Generate safe server-side filenames | `patients/{patientId}/documents/{documentId}/document.{ext}`. The original filename is **not an input** |
| Prevent executable uploads | Refused on the signature. Verified end to end in a browser |
| Store private files privately | `public = false`, enforced on conflict |
| No publicly guessable URLs | There is no public URL. Path guessing fails at the storage policy, verified live for four roles |
| Signed/temporary URLs | 300 seconds, minted after authorization for a path read off an authorized row |
| Restrict who can download | The same predicate the table uses, evaluated again by `storage.objects` |
| **Scan for malware** | **Not implemented.** No scanner is available in this deployment. The upload form says so to the patient rather than implying a guarantee the product does not have. What makes it acceptable is that nothing in Punarvasu executes, interprets or server-side renders an uploaded file — it is stored, and handed back to whoever is entitled to it. A scan would fit between the object write and the metadata write |
| Prevent path traversal | The filename is not an input to a path; a traversal path raises `PV041` and is then refused again by a check constraint |

A signature check answers one question — *is this a container of the type it
claims to be?* — and not whether the contents are safe. A genuine PDF can
carry an embedded script and a genuine JPEG can be crafted to exploit a
decoder. That distinction is written into
`src/lib/documents/file-signature.ts` so nobody later mistakes it for
antivirus.

---

# 19. Image Security

Uploaded images must be treated as untrusted input.

Where applicable:

* Validate actual file format.
* Limit dimensions.
* Limit file size.
* Strip unnecessary metadata.
* Prevent malicious SVG uploads unless SVG handling is explicitly secured.
* Avoid rendering untrusted SVG content directly.

**Phase 14:** `image/svg+xml` is **not on the allowlist and must never be**,
and an SVG is refused on its bytes rather than on its name — verified end to
end in a browser. Format is validated by signature. Size is limited. HEIC and
HEIF are accepted for upload, because it is what an iPhone produces and
excluding it would be the most common upload failure a clinic in India would
see, and are deliberately **not** previewable, because no browser renders them
and an empty frame is worse than an honest "download it to open it".
Dimensions are not limited and metadata is **not** stripped: stripping EXIF
modifies clinical evidence, which cuts against this document's own rule that
clinical history is never silently altered, so it needs a product decision
rather than a default.

**Phase 20 — the image optimizer is not a general-purpose fetcher.**
`next.config.ts` restricts `next/image` to `localPatterns: [{ pathname:
"/images/**", search: "" }]` and configures **no `remotePatterns`**. Two
consequences, both verified live with a `400`:

* **A patient document can never be optimized.** Phase 14 decided that
  document previews use a plain `<img>`/`<iframe>` and never `next/image`,
  because the optimizer would proxy a patient's file through a shared cache
  and store a derivative of it. Until Phase 20 nothing enforced that but a
  comment in the component. A signed storage URL is a remote URL, and a remote
  URL is now refused.
* **Query strings are refused outright.** `search: ""` is the stricter of the
  two options the Next.js documentation describes; omitting it allows any
  query parameter, which is the case that documentation explicitly warns can
  let an unintended URL through.

`qualities: [75]` is an availability control rather than a disclosure one:
without it, `?q=1` through `?q=100` are a hundred distinct cache entries per
image per width, all reachable by anyone holding the URL. `dangerouslyAllowSVG`
is explicitly `false`, so the decision above — that an SVG is a document which
can carry script — cannot be undone by one config line somewhere else.

---

# 20. Security Headers

Production responses should use appropriate security headers.

Consider implementing:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
X-Frame-Options
```

Where applicable, configure a strong Content Security Policy rather than relying on permissive defaults.

Do not blindly copy a CSP from another application. It must be compatible with the actual application architecture and third-party resources.

### Implemented (Phase 01)

`next.config.ts` sets these on every response:

| Header | Value | Why |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | A document served as a guessed type is an XSS vector |
| `X-Frame-Options` | `DENY` | Clickjacking a booking or clinical action is a real attack |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | A full URL may identify a patient resource |
| `Permissions-Policy` | camera, microphone, geolocation, payment denied | Nothing needs them yet |
| `X-DNS-Prefetch-Control` | `off` | Avoids leaking navigation intent |

`X-Powered-By` is disabled.

### Implemented (Phase 19) — Content-Security-Policy and HSTS

Both of the headers Phase 01 deferred now exist. They are set in
`src/proxy.ts` rather than in `next.config.ts`, because a `headers()` entry is
a constant and these two have to be computed per request: the CSP carries a
per-request nonce, and HSTS must never be sent over the plain-HTTP dev server.

**Two CSP tiers.** A nonce can only be applied to a route Next.js renders on
demand — Next injects it during server rendering, so a prerendered page has no
render pass in which to receive one. The route table divides along exactly that
line:

| Tier | Routes | `script-src` |
| --- | --- | --- |
| **Strict** | every protected prefix, plus the three auth pages that handle a credential. All dynamically rendered; all patient and clinical data lives here | `'self' 'nonce-…' 'strict-dynamic'` |
| **Baseline** | the statically prerendered marketing site and the two static auth pages, which render no user-controlled content at all | `'self' 'unsafe-inline'` |
| **API** | `/api/*`, set in `next.config.ts` because the proxy's matcher excludes it | `default-src 'none'` |

Shared by both page tiers: `default-src 'self'`, `base-uri 'self'`,
`object-src 'none'`, `form-action 'self'`, `frame-ancestors 'none'`,
`connect-src 'self'`, `font-src 'self'`, `media-src 'none'`,
`upgrade-insecure-requests`.

**`connect-src 'self'` is correct because nothing in the browser talks to the
database.** No client component imports `lib/supabase/browser.ts` or
`@supabase/ssr`; every read in the product happens in a server component, a
server action or a route handler. `tests/security/browser-surface.test.ts`
asserts it, and both the CSP and the `HttpOnly` cookie decision below depend
on it staying true.

**`style-src` carries `'unsafe-inline'` on both tiers, and that is required
rather than convenient.** Radix positions its overlays with inline `style`
attributes, and six components set an inline width or font from a runtime
value. Under CSP Level 3 an inline style *attribute* falls back to `style-src`
when `style-src-attr` is absent, and a nonce cannot cover an attribute. The
exposure is CSS-based exfiltration of content already on the page; it does not
execute script, and the tier holding clinical data carries no
`'unsafe-inline'` in `script-src` at all.

**Strict-Transport-Security**: `max-age=63072000; includeSubDomains`, outside
development. `preload` is deliberately absent — submitting a domain to the
browsers' preload list is effectively irreversible for months and commits
every present and future subdomain, which is the domain owner's decision
rather than the application's. Sent by the application as well as by the host,
so transport security cannot be lost by a platform configuration change.

Verified in real Chrome against a production build: **zero CSP violations and
full hydration on both tiers.** See `docs/progress/progress_phase_19.md`.

---

# 21. HTTPS

Production traffic must use HTTPS.

Requirements:

* Never transmit credentials over HTTP.
* Redirect HTTP to HTTPS where applicable.
* Use secure cookies.
* Enable HSTS after confirming production HTTPS configuration.
* Avoid mixed content.

Local development may use HTTP where necessary, but production must not.

---

# 22. Cookies

If cookies are used for authentication or sessions:

* Use `Secure` in production.
* Use appropriate `HttpOnly` settings.
* Configure `SameSite` appropriately.
* Keep cookie scope as narrow as practical.
* Avoid storing sensitive information directly in cookies.
* Never store passwords in cookies.

### Implemented (Phase 19)

`@supabase/ssr` writes its session cookies with `httpOnly: false`. That default
is right *for its own design* — it expects a browser client to read the session
out of the cookie — and wrong here, because Punarvasu has no browser client at
all. The access and refresh tokens were readable by page JavaScript for no
reason.

`src/lib/security/cookies.ts` applies four attributes over whatever the library
asks for, in both places that write a session cookie (the proxy on refresh, the
server client on sign-in):

| Attribute | Value | Why |
| --- | --- | --- |
| `HttpOnly` | always | Removes token theft from the consequences of an XSS. An injected script can still act as the user while it runs; it cannot copy the refresh token out and keep the session alive elsewhere |
| `Secure` | outside development | Dropped locally, where the dev server is HTTP and the browser would silently discard the session |
| `SameSite` | `Lax` | Not `Strict`: that would suppress the session on the first request after following a link from an appointment reminder, landing the patient signed out on a page that had just told them otherwise. `Lax` already stops the cross-site POST |
| `Path` | `/` | The session has to be readable by the public pages as well as the portal |

They are applied *last*, so a future library default cannot weaken them.

---

# 23. Third-Party Integrations

Every external service must be treated as a potential security boundary.

Before integrating a service, evaluate:

* What data is sent?
* Why is it required?
* Where is the data stored?
* What authentication mechanism is used?
* What permissions are granted?
* Can access be revoked?
* Is sensitive patient information being shared?

Only send the minimum required data.

Do not send patient medical information to analytics, marketing, or other third-party services unless explicitly required, legally appropriate, and approved.

---

# 24. Email Security

Emails may contain sensitive information.

Do not include sensitive medical information in email unless explicitly required and appropriately protected.

Prefer messages such as:

```text
Your appointment information is available in your secure Punarvasu account.
```

rather than including detailed medical information.

Email links should:

* Use HTTPS.
* Expire where appropriate.
* Be single-use for sensitive operations.
* Never contain reusable credentials.

---

# 25. Appointment Security

Appointment-related functionality must enforce authorization.

Users must not be able to:

* View another patient's appointments.
* Modify another patient's appointment.
* Cancel another patient's appointment.
* Change ownership by manipulating request payloads.

Server-side business rules must validate:

* Appointment ownership
* Valid appointment status
* Valid date/time
* Clinic availability
* Cancellation rules
* Rescheduling rules

Prevent double-booking through appropriate database constraints/transactions rather than relying only on frontend checks.

**Implemented (Phase 09).** Every item above is enforced server-side and again
in the database. Overlap prevention is a PostgreSQL exclusion constraint, not
an application check: `docs/DATABASE.md` §11 is explicit that
check-then-insert is insufficient because two concurrent requests both pass
the check.

---

# 26. Patient Record Security

Patient records require the highest level of application protection.

**Implemented (Phase 12).** The sequence below is enforced literally for every
clinical operation, and no layer is treated as sufficient on its own: the route
guard, then the permission, then `assert_care_practitioner()` inside the
database, then the record resolved by id *and* by the caller's own practitioner
record, then row-level security. Deleting any one of the first four still
leaves an unauthorized caller with nothing.

Access should follow:

```text
Authenticated user
        ↓
Role verification
        ↓
Resource authorization
        ↓
Ownership/access policy
        ↓
Database RLS
        ↓
Data returned
```

Never rely solely on the UI to hide records.

---

# 27. Administrative Security

Admin functionality must be isolated from normal user functionality.

Administrative APIs must:

* Require authentication.
* Require explicit admin authorization.
* Validate every request server-side.
* Be audited.
* Avoid exposing unnecessary patient data.
* Use stronger security controls where practical.

High-risk actions should consider requiring re-authentication or additional verification.

Examples:

* Changing user roles
* Deleting patient records
* Exporting patient data
* Changing security configuration
* Managing staff accounts

---

# 28. Account Recovery

Account recovery must be designed as carefully as login.

Requirements:

* Use secure, short-lived reset tokens.
* Make reset tokens single-use.
* Never reveal passwords.
* Invalidate previous recovery tokens when appropriate.
* Avoid account enumeration.
* Notify users about security-sensitive account changes.

---

# 29. Dependency Security

Dependencies must be kept reasonably up to date.

Before adding a dependency:

* Confirm that it is necessary.
* Prefer reputable, actively maintained packages.
* Avoid unnecessary dependencies.
* Review known vulnerabilities.
* Prefer established packages over obscure alternatives.

Run dependency/security checks regularly.

Examples:

```bash
npm audit
```

and the project's configured dependency scanning tools.

Do not blindly upgrade dependencies in production without testing.

---

# 30. Frontend Security

The frontend must never be considered a trusted security boundary.

Do not place secrets in:

* JavaScript bundles
* Client-side environment variables
* HTML
* Local storage
* Public configuration

Avoid exposing:

* Internal API endpoints unnecessarily
* Database schema details
* Administrative implementation details
* Sensitive user information

UI authorization checks are useful for UX but must always be backed by server-side authorization.

---

# 31. Security of Local Storage

Avoid storing sensitive information in:

```text
localStorage
sessionStorage
IndexedDB
```

unless there is a documented security reason.

Never store:

* Passwords
* Service keys
* Long-lived sensitive tokens
* Medical information unnecessarily

---

# 32. Data Deletion

Data deletion must be deliberate and secure.

Before deleting important records, consider:

* Authorization
* Audit requirements
* Referential integrity
* Legal/operational retention requirements
* Backup implications

Soft deletion may be preferred for certain administrative records where appropriate.

Deletion operations must never allow one user to delete another user's data.

---

# 33. Privacy by Design

The application should follow data-minimization principles.

For every piece of personal information, ask:

1. Do we need it?
2. Why do we need it?
3. Who needs access?
4. How long should it be retained?
5. Where is it stored?
6. Is it being shared with another service?

Do not collect personal or medical information merely because it might be useful later.

---

# 34. Security Testing

Security must be tested throughout development.

### Minimum testing areas

Test for:

* Broken authentication
* Broken authorization
* IDOR/BOLA vulnerabilities
* SQL injection
* XSS
* CSRF
* Rate-limit bypass
* User enumeration
* File upload vulnerabilities
* Privilege escalation
* Session handling issues
* API abuse
* Sensitive information leakage

### Authorization test examples

Test that:

```text
Patient A → Patient A data     = ALLOWED
Patient A → Patient B data     = DENIED
Patient A → Admin API          = DENIED
Staff → permitted records      = ALLOWED
Staff → restricted admin data  = DENIED
Admin → authorized operations  = ALLOWED
```

---

# 35. Security Acceptance Criteria

A feature must not be considered complete if:

* Unauthorized users can access its API.
* Ownership is enforced only in the frontend.
* Sensitive information appears in logs.
* Secrets are exposed to the client.
* Database RLS is missing where required.
* User input is trusted without validation.
* Private files are publicly accessible.
* Errors expose internal implementation details.
* Security-sensitive actions lack authorization checks.

---

# 36. Production Security Checklist

Before production deployment, verify:

### Environment (Phase 20)

* [ ] **`APP_ENV` is set to `production`.** Two things depend on it, and both
      fail quietly in opposite directions. Search indexing is gated on it
      (`src/lib/seo/indexing.ts`), so a production deployment without it
      serves `Disallow: /` and `noindex` on every page — the clinic's site
      becomes invisible to search. A *preview* deployment without it does the
      reverse and competes with production. `scripts/seed-dev-accounts.mjs`
      also refuses to run when it is `production`.
* [ ] **Fetch `/robots.txt` from the deployed origin** and confirm it allows
      crawling and advertises the production sitemap. This is the one check
      that catches the above in seconds.
* [ ] `NEXT_PUBLIC_SITE_URL` is the production origin. Every canonical, Open
      Graph URL, sitemap entry and the JSON-LD logo URL is built from it, and
      a preview host left in place publishes preview URLs as canonical.

### Authentication

* [ ] Authentication provider is configured securely.
* [ ] Email verification is configured where required.
* [ ] Password reset works securely.
* [ ] Sessions are handled securely.
* [ ] Logout invalidates the appropriate session.

### Authorization

* [ ] Roles are enforced server-side.
* [ ] Every protected API checks authorization.
* [ ] Resource ownership is verified.
* [ ] Admin endpoints are protected.
* [ ] Database authorization policies are enabled.

### Database

* [ ] RLS is enabled on sensitive tables.
* [ ] RLS policies have been tested.
* [ ] Service-role credentials are never exposed client-side.
* [ ] Database credentials are stored securely.
* [ ] Sensitive columns are minimized.

### API

* [ ] Input validation is implemented.
* [ ] Rate limiting is configured for sensitive endpoints.
* [ ] Error responses are safe.
* [ ] API responses do not leak unnecessary information.

### Secrets

* [ ] No secrets are committed to Git.
* [ ] Production secrets are stored securely.
* [ ] Public environment variables contain only public values.
* [ ] Secret rotation procedures are known.

### Files

* [x] Upload size limits exist. *(Phase 14 — 10 MB, in four places)*
* [x] File types are validated. *(Phase 14 — by signature, not by name)*
* [x] Private files are stored privately. *(Phase 14 — `public = false`)*
* [x] Access to private files is authorized. *(Phase 14 — row-level security
  and a storage policy asking the same question)*
* [x] Signed URLs expire appropriately. *(Phase 14 — 300 seconds; expiry and a
  forged token both verified live)*
* [ ] Uploaded files are scanned for malware. *(Phase 14 — **not
  implemented**; see §18)*

### Web security

* [ ] HTTPS is enabled.
* [ ] Security headers are configured.
* [ ] Cookies use appropriate security attributes.
* [ ] CSP is reviewed.
* [ ] XSS protections are in place.

### Monitoring

* [ ] Security-relevant events are auditable.
* [ ] Sensitive information is excluded from logs.
* [ ] Production errors do not expose internals.
* [ ] Dependency/security monitoring is enabled.

---

# 37. Secure Development Workflow

Every implementation phase must follow this sequence:

```text
Requirement
    ↓
Threat consideration
    ↓
Data classification
    ↓
Authentication requirement
    ↓
Authorization requirement
    ↓
Input validation
    ↓
Database/API security
    ↓
Implementation
    ↓
Security testing
    ↓
Code review
    ↓
Deployment
```

Security must not be postponed until the final phase.

---

# 38. Definition of Done — Security

A feature is security-complete only when:

```text
✓ Authentication is correct
✓ Authorization is correct
✓ Ownership is enforced
✓ Inputs are validated
✓ Sensitive data is protected
✓ Database policies are enforced
✓ APIs are protected
✓ Errors are safe
✓ Logs contain no secrets
✓ Rate limiting is considered
✓ Security tests pass
✓ No known high-severity vulnerability remains
```

---

# 39. Rules for AI Coding Agents

Codex, Claude, or any other coding agent working on Punarvasu must follow these rules.

### Never

* Disable security checks to make tests pass.
* Expose service-role keys.
* Commit `.env` secrets.
* Trust client-provided roles.
* Trust client-provided user IDs for authorization.
* Disable RLS merely to simplify development.
* Return sensitive patient information unnecessarily.
* Log authentication tokens.
* Add `dangerouslySetInnerHTML` without justification and sanitization.
* Make private storage buckets public as a workaround.
* Bypass authorization because a feature is "internal".
* Suppress security-related errors without understanding them.

### Always

* Inspect existing authentication and authorization before modifying protected functionality.
* Follow existing security utilities and patterns.
* Add server-side validation.
* Add authorization checks.
* Consider database/RLS implications.
* Add security tests for new protected functionality.
* Minimize sensitive data exposure.
* Document intentional security exceptions.
* Prefer secure defaults.

---

# 40. Security Change Protocol

Any change involving the following requires an explicit security review:

* Authentication
* Authorization
* Roles
* Patient records
* Database RLS
* File storage
* Session management
* Environment variables
* API keys
* External integrations
* Personal information
* Health information
* Data deletion/export
* Administrative functionality

The implementation agent should identify the security impact before making such changes.

---

# 42. Data Inventory  *(Phase 19)*

Every category of data the application holds, and what happens to it.
`phase_19.md` sections 146-147.

| Data | Sensitivity | Source | Storage | Who can reach it | Leaves the building? |
| --- | --- | --- | --- | --- | --- |
| Email address, password | Confidential | The person | Supabase Auth (`auth.users`) | Supabase Auth; the application reads the address for one send | To the email provider, per message |
| Role assignment | Confidential | An administrator | `user_roles` | Own row; administrators | No |
| Role-change history | Confidential | The system | `role_assignment_events` | Administrators | No |
| Patient profile: name, phone, date of birth, gender, address, emergency contact | Confidential | Patient or front desk | `patients` | The patient; receptionists; doctors within their care scope | No |
| Appointments | Confidential | Patient or front desk | `appointments`, `appointment_events` | The patient; the practitioner; receptionists | Date and time only, in a notification |
| Clinical records | **Highly confidential** | The practitioner | `clinical_records` | **The authoring practitioner only** | No |
| Prescriptions and items | **Highly confidential** | The practitioner | `prescriptions`, `prescription_items` | The authoring practitioner; the patient, once issued | No. A notification says one exists and names no medicine |
| Treatment plans and items | **Highly confidential** | The practitioner | `treatment_plans`, `treatment_plan_items` | The authoring practitioner; the patient, once active | No |
| Patient documents — the file | **Highly confidential** | Patient or practitioner | Private Supabase Storage bucket | The patient; doctors within their care scope. Only through a 300-second signed URL minted after authorization | No |
| Patient documents — metadata | **Highly confidential** | The server | `patient_documents` | As above | No |
| Notifications | Confidential | The system | `notifications`, `notification_deliveries` | The recipient | Subject, heading and a link, to the email provider — never clinical content, and never a patient's name in a message addressed to staff |
| AI context | **Highly confidential** | Clinical records | **Transient. Never stored** | The requesting practitioner | **Yes — to the AI provider.** De-identified: age and gender, no name, no date of birth, no contact detail, no identifier |
| AI session metadata | Internal | The system | `ai_assistance_sessions` | Administrators, aggregated | No. No prompt or response column exists |
| Security audit trail | Confidential | The system | `security_audit_events` | Administrators | No. No clinical column exists |
| Application logs | Internal | The system | Host log stream | Operators | Wherever the host ships logs. Redacted by key name; callers log identifiers, not content |
| Analytics | Internal | Domain rows, at read time | **Nothing is stored** | Per the permission matrix | No |

**Retention: there is none.** No table in this product has an automatic
deletion policy, and that is a stated position rather than an oversight —
`phase_19.md` sections 144-145 forbid deleting healthcare records without a
defined policy, and defining one has legal inputs nobody has supplied. The
consequences, so they are not discovered later:

* Nothing is ever deleted automatically, anywhere.
* Clinical records, prescriptions, treatment plans and documents have **no
  delete path at all** — no function, no grant, no policy, and `on delete
  restrict` on every reference. Deleting a patient who has any of them is
  refused by the database.
* The audit trail and the role-change history deliberately outlive the
  accounts they describe.

A retention policy is a launch prerequisite, not a Phase 19 deliverable.

---

# 43. External Providers  *(Phase 19)*

`phase_19.md` sections 100-101, 149-150. Everything that receives data from
this application.

| Provider | Purpose | What it receives | Credentials | Webhooks |
| --- | --- | --- | --- | --- |
| **Supabase** | Auth, PostgreSQL, Storage | Everything. It is the database | Anon key (public, safe only because RLS is deny-by-default); service-role key, server-only, used by three modules | Send Email hook, signature-verified |
| **EmailJS** — auth | Verification and reset email | Recipient address; a one-time link | Edge Function secrets | None |
| **EmailJS** — notifications | Appointment and prescription email | Recipient address; a neutral subject and a link. **No clinical content** | Server-only. Not configured in this deployment | None supported |
| **Google Gemini** | Clinical AI decision support | De-identified clinical context. **See the warning below** | Server-only | None |
| **Google Maps** | The clinic's location on the public contact page | The visitor's IP and user agent, on the public page only. **Never a patient address** | None | None |

**No analytics provider, no error-monitoring provider, no marketing tool, no
payment provider, no chat widget.** `NEXT_PUBLIC_MONITORING_DSN` and
`NEXT_PUBLIC_ANALYTICS_SITE_ID` exist as configuration boundaries and are
unset; nothing reads them. Adding one is a change to this table first.

> **Open item, and a launch blocker.** The AI provider's data-retention and
> training-use terms have **not** been reviewed.
> `docs/HEALTHCARE_AND_AI_SAFETY.md` section 8 is binding: "a provider that
> trains on submitted data is not acceptable for clinical content." Until that
> review is done and recorded here, `CLINICAL_AI_ENABLED` must stay off in any
> deployment holding real patient data. Raised by Phase 17; still open.

### Data flow

```text
Browser --HTTPS--> Next.js (server components, actions, route handlers)
                        |
                        +--> Supabase PostgreSQL      every read under RLS
                        +--> Supabase Storage         private; signed URLs only
                        +--> EmailJS                  address + neutral copy
                        +--> Gemini                   de-identified context
```

The browser reaches **only** this origin — `connect-src 'self'` — plus the
Google Maps frame on the public contact page. It never talks to the database.

---

# 44. Secret Rotation  *(Phase 19)*

`phase_19.md` sections 112 and 159. Every secret, and how to replace it.

| Secret | Where it lives | How to rotate | Blast radius while compromised |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Deployment env | Supabase dashboard → API → roll; update the deployment; redeploy | **Total.** Bypasses every RLS policy. Rotate first, always |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Deployment env, and the browser bundle | Roll in the dashboard; rebuild and redeploy | Low on its own — it is public by design, and RLS is what protects the data |
| `AI_PROVIDER_API_KEY` | Deployment env | Provider console → revoke → issue → update → redeploy | Billing, and the ability to send prompts as the clinic |
| `NOTIFICATIONS_EMAILJS_PRIVATE_KEY` | Deployment env | EmailJS dashboard → regenerate → update → redeploy | Ability to send mail as the clinic |
| `SEND_EMAIL_HOOK_SECRET` | Supabase Edge Function secret | Supabase → Auth → Hooks → regenerate; `supabase secrets set`. Several comma-separated values are accepted, so add the new one, let Supabase switch over, then remove the old — no downtime | An open mail relay sending from the clinic's address with any link |
| `NOTIFICATIONS_WORKER_SECRET` | Deployment env and the scheduler | Generate 32 random bytes; update both | Ability to drain the queue and trigger sends |
| `DATABASE_URL` / `DIRECT_URL` | Deployment env, tooling | Supabase → Database → reset password; update everywhere | **Total**, and it bypasses PostgREST as well |

**Rotate whenever** a value has been in a file intended for commit, pasted into
a chat or a ticket, present on a machine that may be compromised, or held by
somebody who has left. "Not committed yet" is not "not exposed".

---

# 45. Incident Response  *(Phase 19)*

`phase_19.md` sections 158-160. A technical containment process, not a legal
one — no breach-notification obligation is asserted here, and none should be
without professional review.

```text
Detect -> Contain -> Investigate -> Rotate -> Remediate -> Notify -> Review
```

**1. Detect.** The signals that exist today:

| Signal | Where |
| --- | --- |
| Repeated authorization failures | `security_audit_events` where `outcome = 'denied'`, indexed for exactly this query |
| Who reached one patient's data | `security_audit_events` by `subject_patient_id` |
| Cross-origin mutation attempts | `security.cross_origin_request_blocked` in the log |
| Rate limits biting | `*_rate_limited` events in the log |
| Failed sign-ins | `auth.*` log events |
| AI usage spikes | `ai_assistance_sessions`, and the administrator aggregate |
| Webhook signature failures | The Edge Function's log |

There is **no alerting**: nothing watches these and nothing pages anybody. That
is the honest state, and it is recorded under deferred work rather than implied
away.

**2. Contain.** In order of speed:

* Suspected service-role key compromise → roll the key first, then
  investigate. Everything else is downstream of it.
* Suspected account compromise → change the role to remove access
  (`assign_user_role`); Supabase Auth can revoke the session globally.
* Suspected AI provider issue → set `CLINICAL_AI_ENABLED=false`. Nothing else
  in the consultation changes.
* Suspected notification abuse → unset `NOTIFICATIONS_WORKER_SECRET`; the
  endpoint then refuses every request rather than defaulting to open.

**3. Investigate.** The audit trail says who reached what and when. The
structured log says what operations ran, against opaque ids. Neither contains
clinical content, so both can be read by whoever is investigating without that
itself being a further disclosure.

**4. Rotate.** Section 44. Rotate everything the incident could plausibly have
touched, not only what it is known to have touched.

**5. Remediate.** Fix the defect. `phase_19.md` section 213: every fixed
critical or high finding gets a regression test where practical.

**6. Notify.** Whether a notification obligation exists is a legal question for
the clinic and its advisers. This document does not answer it and must not be
read as answering it.

**7. Review.** Update the risk register in section 46.

### Backup and recovery

Supabase's managed backups are the only backup in place; their retention and
restoration have **not** been tested by this project. Section 162's warning
applies and is worth stating plainly: **restoring a database restores the RLS
policies that were in place when the backup was taken.** A restore that
predates a security fix silently re-opens it, so any restore must be followed
by re-applying every migration and re-running `tests/security`.

---

# 46. Security Risk Register  *(Phase 19)*

`phase_19.md` sections 201-205. Findings from the Phase 19 audit and the risks
that remain. Severity: Critical / High / Medium / Low / Informational.

### Fixed in Phase 19

| Risk | Severity | Status | Mitigation |
| --- | --- | --- | --- |
| No Content-Security-Policy | High | **Fixed** | Two-tier CSP; nonce and `strict-dynamic` on every route holding patient data |
| `assert_bookable_slot` callable by any client with no authorization check — a diary oracle around `schedule_exceptions`, a table nobody may read | Medium | **Fixed** | Revoked from `public, anon, authenticated`. Its four callers are `security definer` and unaffected |
| `anon` held `EXECUTE` on ~60 `security definer` functions through Supabase's default grant | Medium | **Fixed** | Swept every function in `public`; `alter default privileges` so new ones inherit it; a test asserts future migrations name `anon` |
| Session cookies readable by JavaScript | Medium | **Fixed** | `HttpOnly`, applied by both cookie writers. No browser client exists to need them readable |
| `POST` route handlers had no CSRF defence beyond `SameSite` | Medium | **Fixed** | Same-origin check in `createRouteHandler`, so a route added later inherits it |
| Document upload, report export and patient search unbounded in rate | Medium | **Fixed** | Per-account fixed windows, checked after authorization |
| No queryable audit of privileged access | Medium | **Fixed** | `security_audit_events`, append-only, no clinical columns |
| No HSTS from the application | Low | **Fixed** | Two years, `includeSubDomains`, no `preload` |

### Open

| Risk | Severity | Status | Disposition |
| --- | --- | --- | --- |
| AI provider's retention and training-use terms unreviewed | **High** | **Open** | **Launch blocker.** `CLINICAL_AI_ENABLED` must stay off for real patient data until reviewed and recorded in section 43 |
| Shared well-known credentials for four seeded accounts, including an administrator | **High** | **Open** | Delete before the database holds real patient data. `scripts/seed-dev-accounts.mjs` refuses to run when `APP_ENV=production` |
| AI provider key was written into `.env.example`, a file tracked on purpose | **High** | Partly fixed | Value replaced with a placeholder and moved to `.env`; **the key should still be rotated.** It never reached git history — verified by scanning every blob in every commit for eight credential shapes; the only hit anywhere is a deliberate test fixture |
| No retention or deletion policy for any clinical data | High | **Open** | Has legal inputs. Nothing is deleted automatically; deleting a patient with clinical data is refused |
| No legal pages — privacy policy, terms, medical disclaimer | High | **Open** | Required before the clinic handles real records. A privacy policy would have to describe the AI provider flow |
| No security alerting | Medium | **Open** | The signals exist and are queryable; nothing watches them |
| Rate limits are per-instance, in memory | Medium | **Accepted** | Adequate as guard rails on authenticated surfaces. A distributed quota needs shared state |
| `style-src 'unsafe-inline'` on both CSP tiers | Medium | **Accepted** | Technically required — Radix and six components use inline style *attributes*, which a nonce cannot cover. It does not execute script |
| `script-src 'unsafe-inline'` on the public tier | Medium | **Accepted** | The documented cost of static rendering. Those routes render no user-controlled content |
| Live database verification of the Phase 19 migration not yet run | Medium | **Open** | The migration has not been applied. Required before sign-off — see `docs/progress/progress_phase_19.md` |
| No malware scanning of uploads | Medium | **Accepted, disclosed** | Stated on the upload form. Nothing executes, interprets or server-side renders an uploaded file |
| External email is at-least-once | Low | **Accepted** | No configured provider offers request idempotency. Duplicate *logical* notifications remain impossible |
| No independent penetration test | Medium | **Open** | Section 198: recommended before significant real patient data. Phase 19 is not one |

### What this phase is not

`phase_19.md` sections 198-200. This was an internal security review. It is
**not** a penetration test, **not** a regulatory certification, and no claim of
HIPAA, GDPR or any other compliance is made or implied anywhere in this
project. An independent assessment is recommended before the platform handles
significant real patient data.

---

# 47. Guiding Principle

> **If a user can manipulate it, assume it can be manipulated maliciously.**

The Punarvasu application must remain secure even when an attacker:

* Modifies frontend requests
* Calls APIs directly
* Changes IDs
* Changes roles in the browser
* Bypasses UI restrictions
* Sends malformed input
* Replays requests
* Uploads malicious files
* Attempts to enumerate users
* Obtains a legitimate low-privilege account

Security controls must therefore be enforced at the **server, API, database, and infrastructure layers**, not merely through the user interface.
