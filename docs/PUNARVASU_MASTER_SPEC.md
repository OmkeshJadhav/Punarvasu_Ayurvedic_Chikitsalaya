# Punarvasu — Master Specification

**Start here.** This document orients a new developer or AI agent: what
Punarvasu is, what exists today, where every decision is written down, and what
the rules are that cannot be traded away.

It is an index and a status record. It does not duplicate the detail held in
the documents it points to.

---

## 1. What Punarvasu Is

Punarvasu is a premium Ayurvedic clinic website and digital patient-care
platform.

It has two halves:

* A **public clinic presence** — treatments, philosophy, practitioners,
  articles, contact and appointment booking — which must be fast, accessible,
  SEO-friendly and trustworthy on a phone.
* An **authenticated care platform** used by patients, receptionists, doctors
  and administrators, handling appointments, clinical records, prescriptions,
  treatment plans and medical documents.

The second half makes this healthcare software. It processes sensitive patient
data, and it is held to the standards in `SECURITY.md` and
`HEALTHCARE_AND_AI_SAFETY.md` rather than those of a typical marketing site.

Punarvasu is not a substitute for professional diagnosis or emergency medical
care, and must never present itself as one.

---

## 2. Current Status

**Phase 20 (Performance, SEO & Accessibility) — complete.**

An optimization phase: no new feature, route, schema, migration, dependency or
authorization path. Four measured findings were fixed — 12.70 MB of source
images became 1.34 MB; four Sanskrit characters were costing 83.3 KB of font
on every services page; two static auth pages were shipping 384 KB of Zod to
render three `maxLength` attributes; and nothing prevented a preview
deployment competing with production in search results. Three smaller ones
followed: `/services` had no Open Graph image, the sitemap's home URL
disagreed with the page's own canonical, and the patient appointment list was
unbounded.

Core Web Vitals on the six public pages: **LCP 1000–1308 ms, CLS 0** under
Slow 4G. **484 live checks** against a production build — 131 SEO, 84 public
accessibility and responsive, 241 authenticated across four roles, 28
keyboard/motion/zoom. The Phase 19 security suite passes unchanged at 193/193.
One target is missed and reported rather than rounded down: INP on the mobile
menu is 272 ms under a 4× CPU throttle (48 ms unthrottled).

**`APP_ENV=production` is now launch-critical.** Indexing is gated on it, so a
production deployment that does not set it will tell search engines not to
index the clinic's site. See `docs/progress/progress_phase_20.md` section 6.

**Phase 19 (Security & Privacy Hardening) — complete**, with two verification
steps outstanding: the migration has not been applied to the live database, and
no signed-in page has been loaded under the strict Content-Security-Policy. See
`docs/progress/progress_phase_19.md` section 18. Phase 20 confirmed the first
of these is still open — every authorization denial logs
`security.audit_write_failed`, failing gracefully as designed, but the audit
trail is not being written.

Phase 19 was an audit and remediation phase, not a feature phase. Eight
findings, all fixed: no CSP (High), an ungated `security definer` function
reachable by any client (Medium), `anon` holding EXECUTE on ~60 functions
through a Supabase default grant (Medium), session cookies readable by
JavaScript (Medium), no CSRF defence on route handlers beyond SameSite
(Medium), three surfaces unbounded in rate (Medium), no queryable audit of
privileged access (Medium), and no HSTS (Low). The security risk register,
data inventory, provider inventory, rotation procedure and incident-response
process live in `docs/SECURITY.md` sections 42-46.

**Two open launch blockers**, both raised earlier and neither closed here: the
AI provider's retention and training-use terms are unreviewed, and four seeded
accounts still hold shared well-known credentials including an administrator.

**Phase 18 (Advanced Patient Experience) — complete.**

The core public marketing site was finished in Phase 05. Phase 06 added the
first authenticated experience: registration, email verification, sign-in,
password recovery, sessions and protected routes. Phase 07 adds the patient's
own record — onboarding, viewing, editing and profile completeness — under
`/patient`, together with the `patients` table and its policies.

The profile is **demographic and administrative information, not the medical
record**. Diagnoses, symptoms, medications, allergies, history, consultation
notes, prescriptions and treatment plans belong to later clinical phases, and
no column exists for them.

Phase 08 adds authorization. Four roles live in `public.user_roles`, which is
the only place a role is stored and which no client can write to. A permission
matrix in `src/config/permissions.ts` maps roles to capabilities; server guards
in `src/lib/authorization/` enforce them; and row-level security enforces them
again in the database. Role assignment is an admin-only, self-excluding,
audited database function, reachable through `/admin/users`.

Phase 09 adds the appointment engine. A patient can request, view, reschedule
and cancel a consultation under `/patient/appointments`. Availability is
computed from the practitioner's working week, existing appointments, blocked
periods, minimum notice and a booking horizon; the result is a **snapshot and
authorizes nothing**. Every write goes through a `security definer` database
function that derives the patient from the session, the duration from the
appointment type and the status from the transition rules — and overlap is
prevented by a PostgreSQL exclusion constraint, because two concurrent
application-level checks both pass.

An appointment a patient requests is created `requested`, and the product says
so. Confirming, checking in and marking a no-show are staff actions.

Phase 10 adds the front desk. Under `/receptionist` a receptionist sees today's
work, browses the clinic diary a day at a time, searches for a patient,
registers a walk-in, books on a patient's behalf, and confirms, checks in,
reschedules or cancels an appointment.

**It writes no scheduling logic.** The Phase 09 engine is reused entire — one
slot validator, one conflict guarantee, one transition matrix, one history
table and one availability endpoint serve both the patient and the front desk.
The single change to a Phase 09 function turns two *self-service* rules into
parameters, so the desk can book a practitioner who does not take online
bookings and can book for today, without a second validator existing to drift.

A receptionist is an **operational** role, and the boundary is structural
rather than a UI preference: `public.patients` has no clinical column, the
staff note has no column grant for any client role, and a blocked period's
reason has no policy for anybody. A receptionist cannot mark an appointment
completed, cannot assign a role, and cannot attach a patient record to an
account — the function that creates one has no owner parameter.

Phase 11 adds the clinical workspace. Under `/doctor` a practitioner sees
their own day, steps through it, filters everything booked with them, opens an
appointment, searches the patients they are booked to see, reads a patient's
context and appointment history, and confirms, starts, completes or records a
non-attendance.

**It writes no scheduling logic either.** The Phase 09 engine is reused
entire, and the two pure helpers Phase 10 had written inside the reception
feature moved down into `features/appointments/schedule.ts` rather than being
copied — so both staff workspaces now share one answer to "who is with them
now" and "what has already happened".

**A doctor's access to a patient is a relationship, not a role.** The policy is
an appointment between that patient and the caller's *own* practitioner record,
decided by `public.doctor_has_care_relationship()` behind an RLS policy. A
doctor with no appointment with somebody reads nothing about them, cannot find
them by searching, and cannot act on their appointments; two doctors at the
same clinic are isolated from each other, verified live in both directions.
That is `SECURITY.md` §6's treatment-relationship scoping, enforced for the
first time.

The doctor's status allowlist is the **complement** of the front desk's, not a
relaxation of it: `in_consultation` and `completed` are exactly the two
Phase 10 refused the desk because they describe the consulting room, and
cancelling and rescheduling stay at the desk, where somebody can tell the
patient. There is no permission, no action and no RPC for either.

**Start Consultation** moves an appointment from `checked_in` to
`in_consultation` and opens a workspace carrying the patient's context.

Phase 12 filled that page in. `public.clinical_records` is the first genuinely
clinical data in the product, and it is **its own table referencing the
appointment** — not a column on it. A practitioner starts a consultation,
writes up eight sections, saves drafts as often as they like, and completes it;
completing the record completes the appointment in the same transaction, and a
completed record is immutable in the database rather than merely uneditable in
the UI.

A doctor reads the records **they authored** and nobody else's. A receptionist,
a patient and an administrator have **no policy on the table at all** — which
is stronger than a predicate that evaluates to false, because a predicate can
be weakened by an edit. Concurrency is an optimistic `version` column
incremented by a trigger, so a stale write is refused rather than overwriting
newer clinical documentation.

Phase 13 added prescribing and care planning. `public.prescriptions` and
`public.treatment_plans` are their own tables with their own items, never
text in a clinical note. A doctor drafts, reviews and then deliberately
**issues** a prescription or **activates** a plan; from that moment it is
immutable in the database, and correction is withdraw-then-replace rather than
an edit. **A draft is invisible to the patient at the database level** —
`status <> 'draft'` lives in the policy, not in a query somebody could
forget. A patient reads their own issued prescriptions and active plans under
`/patient/prescriptions` and `/patient/treatment-plans`. There is no
medicine catalog: the autocomplete offers only what this practitioner has
prescribed before, so no future catalog can rewrite an old prescription.

Phase 14 added patient documents. `public.patient_documents` holds the
metadata and a **private** storage bucket holds the bytes. A patient uploads
their own lab report, scan or previous prescription under
`/patient/documents`; a doctor uploads one from a consultation they are
running; both then read it through a **300-second signed URL** minted after
authorization, for a path read off a row row-level security already admitted.

**No public document URL exists or can be constructed.** The storage path is
generated by the server — `patients/{patientId}/documents/{documentId}/document.{ext}`
— and then **recomputed inside the database** and compared, so the original
filename never influences it and a path nobody generated is refused twice.
What a file *is* is decided by its signature bytes rather than by what the
browser called it, against a closed six-type allowlist that deliberately
excludes SVG. Nothing in Punarvasu executes, interprets or renders an uploaded
file: there is no OCR, no extraction and no AI, and the product says so.
**A receptionist and an administrator have no policy on the table or on the
bucket at all.** A document is archived, never deleted.

Phase 15 added notifications. A domain change writes a
`public.notification_outbox` row through an `after` trigger **inside the same
transaction**, and a worker turns that row into a `public.notifications` row
and, where a channel is configured, a delivery attempt — so a provider outage
can never affect a booking, and no write path can forget to emit. Appointment
confirmations, reschedules, cancellations and reminders, and prescription and
treatment-plan notifications, all reach the patient at `/notifications`.

**Nothing takes a recipient or a link**: both are derived from the resource
inside the database, so there is no `recipientEmail` or `recipientUserId` to
substitute anywhere in the system, and no endpoint by which one person can
cause a message to reach another. A notification carries a title, a short body
and a link, and there is **no column** for a diagnosis, a medicine, a dose, a
note or a plan title — the privacy rule is structural rather than remembered.

**In-app notifications work. Email does not**: the adapter exists and no
provider is configured, so the channel is disabled and the preferences page
says so rather than offering a control with no effect. There is no SMS and no
WhatsApp anywhere — not an enum value, not a stub. **Reminders and delivery
retries require a scheduler** to call `POST /api/notifications/process`;
without one the machinery is correct and idle, and that is recorded rather
than glossed over.

**No practitioner is configured for online booking**, because Punarvasu has
confirmed no practitioner's name or working hours. The migration seeds none;
`scripts/seed-dev-practitioner.mjs` populates a development database from an
account that exists, and the booking page says plainly when there is nobody to
book.

Phase 18 made the patient area one experience rather than six features. The
dashboard at `/patient` leads with the next appointment, then answers "what
needs your attention?" from stored values only — an unconfirmed request, unread
updates, missing profile details — and says so calmly when nothing does. It
**added no table, no migration, no policy, no permission and no dependency**:
every rule it applies belongs to the phase that built it.

Two things it did add are small purpose-built reads. The old overview called
`getMyAppointments()` — every appointment a patient had ever had — to display
one row; `getNextAppointment()` now asks the database for that row, and
`listRecentNotifications()` asks for three rather than a page plus one. The
dashboard runs six bounded queries concurrently and there is deliberately no
`getPatientDashboard()` aggregate.

Its browser pass found two defects that had been shipping for several phases:
the notification centre's heading outline skipped a level (Phase 15, which
recorded skipping the pass as its own first known issue), and the
authenticated header clipped its own navigation and squeezed the notification
bell to 20px on every screen below about 430px (Phase 08). The second had
survived four earlier passes because the nav absorbed the overflow by hiding
its content, while every pass measured the *document*. Both are fixed and
regression-tested.

The palette, the display serif and the hero were rebuilt after the phase closed,
on client feedback. `DESIGN_SYSTEM.md` §4 and §6 hold the current values;
`docs/progress/progress_phase_03.md` records what changed and what was
re-verified.

| Area | State |
| --- | --- |
| Next.js 16 App Router, React 19, TypeScript strict | Application shell in `src/` |
| Tailwind CSS v4 | Punarvasu design tokens implemented in `src/app/globals.css` |
| Design system | Implemented: tokens, typography, primitives, layout, navigation, state patterns (`DESIGN_SYSTEM.md` §62). Phase 03 added the `--brand-surface` band tokens and the `anchor-offset` utility; the 2026-09-17 revision repalletted to warm cream/brown/forest green and added `--scrim`, the `--heading`/`--prose`/`--eyebrow` editorial trio, the `hero-band` utility and `data-surface="inverted"` |
| Public site | Home page, services catalogue, seven treatment pages, About, Practitioners and Contact, public header/footer shell, marketing section components (`src/components/marketing/`), content in typed config (`src/config/marketing-content.ts`) and in the `services`, `practitioners`, `about` and `contact` features |
| Treatment content | **None clinically reviewed.** Every treatment in `src/features/services/content.ts` is `pending-clinical-review`, and the listing and detail pages say so to the visitor |
| Clinic facts | **Address and phone verified (Phase 05)** and published, including in `MedicalClinic` JSON-LD. **Email, opening hours and social profiles are still unverified**, so none is published and the contact page says which are missing. `src/config/clinic.ts` is the only source |
| Practitioner content | **Nobody verified.** `src/features/practitioners/content.ts` holds two `pending-verification` placeholders; the type forbids an unverified entry carrying a name or a credential, and no profile page exists for one |
| Routes | Public: `/`, `/about`, `/practitioners`, `/practitioners/[slug]` (no page today — see practitioner content), `/contact`, `/services`, `/services/[slug]` (seven prerendered treatment pages), `/appointments/new` (a `noindex` page routing a visitor into sign-in and booking). Authentication: `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/callback` — all `noindex` and disallowed in `robots.txt`. Authenticated: `/account`, `/forbidden`, `/patient`, `/patient/profile`, `/patient/appointments`, `/patient/appointments/book`, `/patient/appointments/[id]`, `/patient/appointments/[id]/reschedule`, `/receptionist` (+ `schedule`, `schedule/new`, `schedule/[id]`, `schedule/[id]/reschedule`, `patients`, `patients/new`, `patients/[id]`), `/doctor` (+ `appointments`, `appointments/[id]`, `appointments/[id]/consultation`, `appointments/[id]/prescription`, `appointments/[id]/treatment-plan`, `appointments/[id]/documents`, `patients`, `patients/[id]`, `patients/[id]/records/[recordId]`, `patients/[id]/prescriptions/[prescriptionId]`, `patients/[id]/treatment-plans/[planId]`, `patients/[id]/documents`, `patients/[id]/documents/[documentId]`), `/patient/prescriptions` (+ `[id]`), `/patient/treatment-plans` (+ `[id]`), `/patient/documents` (+ `[id]`), `/admin`, `/admin/users`. Plus `/api/health`, `/api/auth/session-status`, `/api/appointments/availability`, `/api/patient-documents` (the multipart upload), `/sitemap.xml`, `/robots.txt`, a generated `opengraph-image` per public page and per treatment, `/design-system` (non-production only), error/loading/not-found boundaries |
| Supabase | Installed; browser, server and service-role clients separated |
| Database / migrations | Workflow established (Supabase CLI). **Phase 06:** `app_role` enum, `profiles`, profile-creation trigger, `current_app_role()`, RLS. **Phase 07:** `patients`, partial unique index, ownership-guard and date-of-birth triggers, per-operation RLS, column-scoped grants. **Phase 08:** `user_roles` (the role moved out of `profiles` and dropped from it), `role_assignment_events`, `has_app_role()`, `assign_user_role()`, `list_managed_users()`, and the `patients` policies narrowed by role. **Phase 09:** `appointment_status` and `appointment_event_type` enums, `practitioners`, `appointment_types`, `practitioner_availability`, `schedule_exceptions`, `appointments`, `appointment_events`, two `btree_gist` exclusion constraints, a status-transition trigger, and the booking/cancellation/rescheduling/availability/rules functions. **Phase 10:** three receptionist select policies, `pg_trgm`, four indexes, six `security definer` staff functions, and `assert_bookable_slot` parameterised so one validator serves both booking paths. **Phase 11:** `doctor_has_care_relationship()`, `doctor_owns_appointment()`, `assert_care_practitioner()`, `search_care_patients()`, `update_appointment_status_as_doctor()`, two relationship-scoped select policies and one index — no table, enum, constraint or trigger added, and no policy dropped. **Phase 12:** `clinical_record_status` enum, the `clinical_records` table, a composite foreign key into `appointments (id, patient_id, practitioner_id)`, a unique constraint per appointment, 13 constraints, 3 indexes, 3 triggers, one authorship-scoped select policy and three `security definer` consultation functions — no clinical column added to `appointments`, no existing function replaced and no policy dropped. **Phase 13:** `prescription_status`, `treatment_plan_status` and `treatment_plan_category` enums, the `prescriptions`, `prescription_items`, `treatment_plans` and `treatment_plan_items` tables, two composite foreign keys into `clinical_records (id, appointment_id, patient_id, practitioner_id)`, two partial unique indexes giving at most one live prescription and one live plan per consultation, four guard triggers, eight select policies (two of them a patient's) and ten `security definer` functions — no prescription column added to `clinical_records` or `appointments`, no existing function replaced and no policy dropped. **Phase 14:** `patient_document_type`, `patient_document_status` and `patient_document_uploader` enums, the `patient_documents` table, two composite foreign keys binding an attached appointment and clinical record to the *same* patient, a unique immutable `storage_path` with a shape constraint that recomputes it, 14 constraints, 3 indexes, 2 triggers, two select policies, **one policy on `storage.objects`**, three `security definer` write functions none of which takes a patient id, a practitioner id or an uploader, and the **private** `patient-documents` bucket — no client role can write the table or the bucket, no receptionist or administrator has a policy on either, no existing function replaced and no policy dropped. **Phase 15:** seven notification enums, the `notification_outbox`, `notifications`, `notification_deliveries` and `notification_preferences` tables, three `after` triggers that write the outbox **inside the domain transaction**, two select policies scoped to `auth.uid()`, no policy at all on either queue, and nineteen functions — no recipient parameter and no link parameter anywhere. A live run then found that `revoke ... from public` does not remove Supabase's default *named* grants, so two follow-up migrations revoke every processor function by name and gate its body. **All thirteen migrations are applied to the live project and verified against it with real per-role JWTs — 62 checks in Phase 08, 79 in Phase 09, 106 in Phase 10, 71 in Phase 11, 75 in Phase 12, 141 in Phase 13, 209 in Phase 14 and 146 in Phase 15.** |
| Authentication | **Implemented (Phase 06).** Supabase Auth, email + password. `lib/auth/` for identity, session and safe redirects; `features/auth/` for schemas, actions and error mapping; `src/proxy.ts` for session refresh; `(app)` route group guarded by `requireUser()`. Verified against the live project |
| Patient profile | **Implemented (Phase 07).** `/patient/profile`: onboarding, view, edit, completeness. Demographic and administrative data only — clinical records belong to later phases. **Phase 08** gates the area on the patient role |
| Patient experience | **Implemented (Phase 18).** The dashboard at `/patient` — next visit, "what needs your attention?", care summary, recent updates, quick actions — plus `loading.tsx` and an area-level `error.tsx` so one panel's failure does not take the shell with it. `features/patients/attention.ts` derives the attention list as a pure function of stored values; nothing is invented, and an empty list is a real state. **No table, migration, policy, permission or dependency was added**, and no animation library (`DESIGN_SYSTEM.md` §41). Six bounded queries in parallel, never an aggregate. Verified with 53 real-browser checks: axe with computed contrast at 390 and 1280, overflow at nine widths, cross-patient IDOR on four resource types, and role isolation in both directions |
| Appointments | **Implemented (Phase 09).** `/patient/appointments`, `/patient/appointments/book`, `/patient/appointments/[id]` and `.../reschedule`. `features/appointments/` holds the timezone layer, the availability engine, the status matrix, validation, queries and three server actions. No client role can write the table: every write is a `security definer` function, and overlap is a database invariant |
| Doctor workspace | **Implemented (Phase 11).** `/doctor`, `/doctor/appointments` (+ `[id]`, `[id]/consultation`) and `/doctor/patients` (+ `[id]`). `features/doctor/` holds the domain model, the practitioner action rules, validation, queries and two server actions. Patient access is scoped by **care relationship**, enforced in RLS. No clinical record, no prescription, no AI: the consultation entry point changes an appointment status Phase 09 already declared and persists nothing. Verified with 71 live database checks and 133 real-browser checks |
| Clinical records | **Implemented (Phase 12).** `public.clinical_records`, the consultation workspace at `/doctor/appointments/[id]/consultation`, the clinical history on the patient page, and `/doctor/patients/[id]/records/[recordId]`. `features/clinical/` holds the domain model, the lifecycle and completion rules, validation, the error mapper, queries and three server actions. **A clinical record is its own table, never a column on an appointment.** Access is scoped by **authorship**; no receptionist, patient or administrator has any policy on the table. Draft and completed states, database-enforced completion validation, optimistic concurrency, and a completed record made immutable by trigger. No prescription, no document, no AI. Verified with 75 live database checks and 102 real-browser checks |
| Prescriptions | **Implemented (Phase 13).** `public.prescriptions` and `public.prescription_items`, the builder at `/doctor/appointments/[id]/prescription`, the history on the patient page, `/doctor/patients/[id]/prescriptions/[prescriptionId]`, and the patient's own `/patient/prescriptions`. Draft and issued states, a deliberate review before a deliberate issue, withdrawal that preserves everything, a debounced medicine autocomplete drawn from the practitioner's own prescribing history, and an issued prescription made immutable by trigger. **A draft is invisible to the patient at the database level.** No catalog, no document, no notification, no AI. Verified with 141 live database checks |
| Treatment plans | **Implemented (Phase 13).** `public.treatment_plans` and `public.treatment_plan_items`, the builder at `/doctor/appointments/[id]/treatment-plan`, and the patient's own `/patient/treatment-plans`. Five structured categories — diet, lifestyle, therapy, follow-up, other — kept deliberately separate from prescriptions, with content frozen on activation. A follow-up date books nothing |
| Patient documents | **Implemented (Phase 14).** `public.patient_documents` plus a **private** `patient-documents` bucket. The patient's own `/patient/documents` (+ `[id]`), the practitioner's `/doctor/appointments/[id]/documents` and `/doctor/patients/[id]/documents` (+ `[documentId]`), and `POST /api/patient-documents`. Server-side validation by **signature bytes** against a closed six-type allowlist; a server-generated storage path the database recomputes and compares; 300-second signed URLs minted only after authorization, using the caller's own client so the storage policy decides a second time; a sandboxed preview for the four inert formats; archive rather than delete, by the uploader only. A doctor's scope is the **care relationship**; a receptionist and an administrator have no policy at all. No OCR, no interpretation, no AI, and **no malware scanning** — the upload form says so. Verified with 112 live database and storage checks, 71 real-browser checks and 26 end-to-end upload checks |
| Receptionist workspace | **Implemented (Phase 10).** `/receptionist`, `/receptionist/schedule` (+ `new`, `[id]`, `[id]/reschedule`) and `/receptionist/patients` (+ `new`, `[id]`). `features/reception/` holds the operational model, the staff action rules, validation, queries and five server actions. Operational only: no clinical column, no staff note, no blocked-period reason, no role management |
| Authorization | **Implemented (Phase 08).** `config/permissions.ts` holds the matrix; `lib/authorization/` holds the decision, the area rules, the server guards and resource ownership; `/forbidden` is the refusal experience; `/admin/users` is the audited role-assignment mechanism. Verified with 62 live database checks and 57 real-browser checks across all five actors |
| Configuration | Typed and validated; server secrets fenced with `server-only` |
| Error handling / logging / validation | Implemented (`src/lib/`) |
| Tests | Vitest (node + jsdom projects); **3,382** unit, integration, component and accessibility tests passing across 107 files. No E2E tool. Phase 14 added a repo-wide scan for invisible control characters, which found **two security assertions that had been silently matching nothing** — one since Phase 10 |
| Accessibility | `axe-core` in component tests **and against the live rendered page** (0 violations at 390px and 1280px, real computed contrast — re-run across every doctor and receptionist route in Phase 11, which is how a `landmark-unique` defect shipped in Phase 10 was found and fixed, and across every document route in Phase 14 — which also closed the browser pass Phase 13 skipped); palette asserted against WCAG AA, including text composited over the photographic scrim |
| ESLint 9 flat config, Prettier | Working, clean |
| Security headers | Baseline set; no CSP yet |
| `.env.example` | Placeholders only, classified public vs server-only |

`ARCHITECTURE.md` §1.1 holds the detailed inventory. The create-next-app
scaffold debt recorded in Phase 00 has been cleared, except the placeholder
favicon. The clinic's real logo artwork landed in Phase 03 and is used by
`components/brand/logo.tsx`; the favicon still needs to be generated from it.

Every photograph on the site other than the logo is a stock/generated
placeholder, declared as such in `src/config/images.ts`. The clinic's postal
address and phone number were supplied in Phase 05 and are published. No
practitioner name, qualification, email address, opening hours, testimonial or
statistic has been verified, so none is published — and the pages a visitor
would look on say so rather than leaving a gap.

**Read this before trusting any other document:** most of what the
documentation describes is *intended*, not *built*. Statements of architecture
are decisions to implement, not descriptions of existing behaviour. Verify
against the repository before assuming something exists.

---

## 3. Document Map

| Document | Read it for |
| --- | --- |
| `../AGENTS.md` | How to work in this repository. Quality bar, conventions, workflow. |
| `PRODUCT_SPEC.md` | What the product does, who it serves, product areas and their dependencies. |
| `ARCHITECTURE.md` | System design, current repo state, folder structure, boundaries, data flow. |
| `DATABASE.md` | Entities, ownership, RLS, clinical history, prescriptions, storage, appointment concurrency. |
| `SECURITY.md` | Threat model, **canonical role model and permission matrix** (§6), secrets, controls. |
| `HEALTHCARE_AND_AI_SAFETY.md` | What the platform may claim about health; what AI may and may not do. |
| `DESIGN_SYSTEM.md` | Visual language, tokens, components, motion, accessibility. |
| `QA_STRATEGY.md` | Test levels, quality gates, security and accessibility testing. |
| `implementation-plan/phase_NN.md` | Scope and acceptance criteria for each phase. |
| `progress/progress_phase_NN.md` | What was actually built and verified. |

Precedence when documents disagree is defined in `PRODUCT_SPEC.md` §39.

---

## 4. The Roles

Four roles, defined canonically in `SECURITY.md` §6:

| Role | Scope |
| --- | --- |
| `patient` | Own profile, appointments, prescriptions, documents. |
| `receptionist` | Scheduling, check-in, contact details. **Operational, never clinical.** |
| `doctor` | Clinical records for patients they treat. |
| `admin` | Clinic configuration, staff, content, users. Audited. |

`SUPER_ADMIN` is deliberately not implemented.

---

## 5. Non-Negotiables

These hold in every phase. A feature that violates one of them is not
finished, however well it works.

**Security**

1. Authorization is enforced server-side. Hiding UI is not a security control.
2. Row Level Security is enabled on every table holding user or clinical data,
   deny-by-default.
3. The service-role key never reaches the browser and is never used to work
   around a policy.
4. Patient documents live in private storage, reachable only through
   short-lived signed URLs after an authorization check.
5. No secrets in source control. `.env.example` carries placeholders only.

**Patient data**

6. Clinical history is append-only. Finalized records are amended, never
   overwritten. Issued prescriptions are immutable.
7. Receptionists cannot read clinical notes, assessments, treatment plans or
   prescriptions.
8. Patient data never appears in URLs, logs, analytics or error messages.
9. Sensitive operations are audited.

**Healthcare and AI**

10. Never fabricate credentials, testimonials, outcomes or clinic facts — not
    even as sample data.
11. No guaranteed-cure or "100% safe" claims.
12. AI assists; a qualified practitioner decides. AI never diagnoses,
    prescribes, or writes final clinical records without explicit review.
13. AI-generated content is labelled wherever a human reads it.

**Correctness**

14. Appointment availability shown in the UI is a hint. The server revalidates
    and the database enforces non-overlap.
15. Validate at every trust boundary, client *and* server.

**Quality**

16. Every async feature handles loading, empty, error and success states.
17. Accessibility (WCAG AA direction) and responsive behaviour are
    requirements, not polish.
18. Type checking and linting pass before a phase is reported complete.

---

## 6. Working Through a Phase

1. Read `implementation-plan/phase_NN.md` completely.
2. Read the documents it depends on.
3. **Inspect the repository.** Do not assume it matches the documentation.
4. Confirm prerequisite phases actually landed — check
   `progress/progress_phase_NN.md`, not just the code.
5. Implement only that phase's scope.
6. Run `npm run typecheck`, `npm run lint`, and `npm run build` where
   applicable. Never report a check as passing unless it ran.
7. Update the affected documentation when a decision changes.
8. Record outcomes in `progress/progress_phase_NN.md`, including what was not
   done.

Available commands:

```bash
npm run dev         # development server
npm run build       # production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run format:check
npm run security:scan-bundle   # after a build
```

The full command list, including the database workflow, is in `../README.md`.

---

## 7. Phase Sequence

Phase specifications live in `implementation-plan/`.

| Phase | Focus | Spec status |
| --- | --- | --- |
| 00 | Discovery and engineering constitution | Written — **implemented** |
| 01 | Technical foundation: Supabase, typed config, error handling, logging, validation, folder structure, testing setup | Written — **implemented** |
| 02 | Design system and UI foundation: tokens, typography, primitives, layout, navigation, state patterns, motion, accessibility | Written — **implemented** |
| 03 | Premium public home experience: public shell, Home page, marketing components, SEO, structured data | Written — **implemented** |
| 04 | Services and treatments: catalogue, treatment pages, related treatments, medical-content safety rules | Written — **implemented** |
| 05 | About, clinic and contact experience | Written — **implemented** |
| 06 | Authentication and identity foundation: registration, verification, sign-in, recovery, sessions, protected routes | Written — **implemented** |
| 07 | Patient profile and onboarding: the `patients` record, validation, completeness, the patient area | Written — **implemented** |
| 08 | Roles and permissions: the role model, the permission matrix, server guards, route protection, RLS, the forbidden experience, audited role assignment | Written — **implemented** |
| 09 | Appointment engine: the schema, availability, booking, cancellation, rescheduling, the status lifecycle, database-level conflict prevention | Written — **implemented** |
| 10 | Receptionist workspace: the clinic diary, staff booking, check-in, patient search, walk-in registration | Written — **implemented** |
| 11 | Doctor dashboard and clinical workspace: the practitioner's own diary, care-scoped patient access, the consultation entry point | Written — **implemented** |
| 12 | Clinical records and consultation management: the clinical record model, draft and completion, clinical history, RLS, concurrency and integrity | Written — **implemented** |
| 13 | Prescriptions and treatment plans: the two instruments, draft and issue, immutability, patient visibility | Written — **implemented** |
| 14 | Patient documents and secure storage: the private bucket, signature-based validation, signed access, archiving | Written — **implemented** |
| 15 | Notifications and communication: the transactional outbox, typed domain events, the notification centre, reminders, preferences, the provider abstraction | Written — **implemented** |
| 17-21 | AI decision support and beyond | Written — **not started** |
| 16 | Analytics and reporting: the gated read interface, the centralized metric definitions, three role-scoped dashboards, the accessible chart, the CSV report | Written — **implemented** |
| 17 | AI clinical decision support: four explicit doctor-facing tasks, a versioned prompt registry, the server-side context builder, the provider abstraction with a Gemini adapter and a deterministic mock, schema validation and the clinical safety layer, a database-backed quota and audit | Written — **implemented** |

Phases 18 onward are unspecified. Anyone planning a phase whose specification
is a zero-byte placeholder must write it first rather than inferring it from
this document.

**Clinical AI is doctor-facing only, and disabled by default.** It assists; a
practitioner decides. Nothing in the feature writes a clinical record, a
prescription, a treatment plan, an appointment or a notification — there is no
action and no write path, which is what makes the boundary hold rather than a
policy anybody has to remember. Before it is enabled for a deployment holding
real patient data, `docs/HEALTHCARE_AND_AI_SAFETY.md` §8 requires the
provider's data-retention and training-use terms to be reviewed and documented;
**that review has not been done.**

Do not skip ahead. Later phases assume earlier ones landed correctly.
