# Punarvasu — System Architecture

## 1. Overview

Punarvasu is a modern digital platform for an Ayurvedic clinic. The system provides patients with an aesthetically refined and trustworthy experience for discovering Ayurvedic treatments, learning about the clinic and doctors, booking appointments, managing their profile, and receiving appointment-related communication.

The architecture is designed around the following principles:

* **Patient-first experience**
* **Security and privacy by default**
* **Separation of concerns**
* **Maintainability and extensibility**
* **Mobile-first responsive design**
* **Server-side validation for all critical operations**
* **Reusable UI and business components**
* **Strong accessibility**
* **SEO-friendly public content**
* **Reliable appointment and notification workflows**
* **Production-ready error handling and observability**

The application should be designed so that additional clinic locations, doctors, treatments, appointment types, payment providers, and patient features can be introduced without requiring a major architectural rewrite.

## 1.1 Current Repository State (as of Phase 20)

This section records what the repository **actually contains**, so that
architectural intent is never mistaken for implemented behaviour. Update it as
phases land.

| Area | State |
| --- | --- |
| Framework | Next.js 16.3.4, App Router, React 19.2.8 |
| Language | TypeScript 5, `strict: true`, `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` |
| Package manager | npm (`package-lock.json` committed) |
| Source root | `src/`, with `@/*` mapped to `./src/*` |
| Routes | Public site: `/`, `/about`, `/practitioners`, `/practitioners/[slug]`, `/contact`, `/services`, `/services/[slug]`, `/appointments/new`. Authentication: `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/callback`. Authenticated: `/account`, `/forbidden`, `/patient`, `/patient/profile`, `/patient/appointments`, `/patient/appointments/book`, `/patient/appointments/[id]`, `/patient/appointments/[id]/reschedule`, `/admin`, `/admin/users`, `/receptionist`, `/receptionist/schedule`, `/receptionist/schedule/new`, `/receptionist/schedule/[id]`, `/receptionist/schedule/[id]/reschedule`, `/receptionist/patients`, `/receptionist/patients/new`, `/receptionist/patients/[id]`, `/doctor`, `/doctor/appointments`, `/doctor/appointments/[id]`, `/doctor/appointments/[id]/consultation`, `/doctor/patients`, `/doctor/patients/[id]`, `/doctor/patients/[id]/records/[recordId]`, `/doctor/appointments/[id]/prescription`, `/doctor/appointments/[id]/treatment-plan`, `/doctor/patients/[id]/prescriptions/[prescriptionId]`, `/doctor/patients/[id]/treatment-plans/[planId]`, `/patient/prescriptions`, `/patient/prescriptions/[id]`, `/patient/treatment-plans`, `/patient/treatment-plans/[id]`, `/patient/documents`, `/patient/documents/[id]`, `/doctor/appointments/[id]/documents`, `/doctor/patients/[id]/documents`, `/doctor/patients/[id]/documents/[documentId]`, `/notifications`, `/notifications/preferences`, `/admin/analytics`, `/receptionist/analytics`, `/doctor/analytics`. Plus `/api/health`, `/api/auth/session-status`, `/api/appointments/availability`, `/api/patient-documents` (the multipart upload — the only write in the product that is a route handler rather than a server action, because only `XMLHttpRequest.upload` reports byte progress), `/api/notifications/process` (the notification worker — a shared-secret endpoint a scheduler calls; reminders and delivery retries do not fire without one), `/sitemap.xml`, `/robots.txt`, generated Open Graph images, `/design-system` (non-production only), and error, loading and not-found boundaries |
| Components | Design-system primitives in `components/ui/`, layout and navigation in `components/layout/`, brand in `components/brand/`, marketing composition in `components/marketing/`, authentication UI in `components/auth/`, patient-area UI in `components/patient/`, appointment UI in `components/appointments/`, access-management UI in `components/admin/`, front-desk UI in `components/reception/`, clinical-workspace UI in `components/doctor/`, clinical authoring in `components/clinical/`, prescribing in `components/prescriptions/`, care planning in `components/treatment-plans/`, patient documents in `components/documents/`, the notification centre in `components/notifications/`, analytics in `components/analytics/`, state patterns in `components/shared/` |
| Design system | **Implemented (Phase 02).** Tokens in `src/app/globals.css`; components per `docs/DESIGN_SYSTEM.md` section 62. Radix primitives + CVA + Tailwind v4, no component library |
| Supabase | Installed and configured: browser, server and service-role clients in `lib/supabase/` |
| Database | Migration workflow established (`supabase/`, Supabase CLI). **Fourteen migrations. Phase 06:** `app_role` enum, `profiles` table, profile-creation trigger, `current_app_role()`, RLS. **Phase 07:** `patients` table, partial unique index on `profile_id`, ownership-guard and date-of-birth triggers, per-operation RLS, column-scoped grants. **Phase 08:** `user_roles` (the role moved out of `profiles`), `role_assignment_events` audit trail, `has_app_role()`, `assign_user_role()`, `list_managed_users()`, and the `patients` policies narrowed by role. **Phase 09:** `appointment_status` and `appointment_event_type` enums, `practitioners`, `appointment_types`, `practitioner_availability`, `schedule_exceptions`, `appointments`, `appointment_events`, two exclusion constraints over `btree_gist`, a status-transition trigger, and the `security definer` booking, cancellation, rescheduling, availability and rules functions. **Phase 10:** three receptionist select policies, `pg_trgm` and four indexes, and the six `security definer` staff functions; `assert_bookable_slot` gained two parameters so one validator serves both booking paths. **Phase 11:** `doctor_has_care_relationship()`, `doctor_owns_appointment()`, `assert_care_practitioner()`, `search_care_patients()`, `update_appointment_status_as_doctor()`, two relationship-scoped select policies and one index — **no table, enum, constraint or trigger added, and no policy dropped**. **Phase 12:** `clinical_record_status` enum, the `clinical_records` table with a **composite foreign key** to `(appointments.id, patient_id, practitioner_id)`, a unique constraint per appointment, 13 constraints, 3 indexes, 3 triggers, one relationship-scoped select policy and the three `security definer` consultation functions — **no clinical column added to `appointments`, no existing function replaced and no policy dropped**. **Phase 13:** `prescription_status`, `treatment_plan_status` and `treatment_plan_category` enums, the `prescriptions`, `prescription_items`, `treatment_plans` and `treatment_plan_items` tables, two **composite foreign keys** to `(clinical_records.id, appointment_id, patient_id, practitioner_id)`, two **partial** unique indexes giving at most one live prescription and one live plan per consultation, four guard triggers, eight relationship-scoped select policies (two of them a **patient's**), and ten `security definer` functions — **no prescription column added to `clinical_records` or `appointments`, no existing function replaced and no policy dropped**. **Phase 14:** `patient_document_type`, `patient_document_status` and `patient_document_uploader` enums, the `patient_documents` table, two **composite foreign keys** binding an attached appointment and clinical record to the *same* patient, a unique immutable `storage_path`, a check constraint that recomputes the path's shape, a guard trigger, **two** select policies, **one policy on `storage.objects`**, and three `security definer` write functions none of which takes a patient id, a practitioner id or an uploader — plus the **private** `patient-documents` bucket. **No client role can write the table, and no client role can write the bucket; a receptionist and an administrator have no policy on either.** **Phase 15:** `notification_event_type`, `notification_subject_type`, `notification_category`, `notification_channel`, `notification_status`, `notification_outbox_status` and `notification_delivery_status` enums, the `notification_outbox`, `notifications`, `notification_deliveries` and `notification_preferences` tables, **three `after` triggers on `appointments`, `prescriptions` and `treatment_plans` that write the outbox inside the domain transaction**, two select policies scoped to `auth.uid()`, **no policy at all on either queue**, and nineteen functions of which nine are granted to `service_role` alone — **no recipient parameter and no link parameter anywhere, no column added to any domain table, no existing function replaced and no policy dropped**. A live run then found that `revoke ... from public` does **not** remove Supabase's default *named* grants to `anon` and `authenticated`, so two follow-up migrations revoke every processor function by name and add `assert_notification_worker()` to its body — the hole, and the lesson, are recorded in `docs/progress/progress_phase_15.md`. **Phase 16:** no table, no column, no enum, no trigger and no policy — **twenty-five `security definer` functions and seven indexes, and nothing else**. Thirteen functions are the gated read interface (one gate per audience: operational for admin and receptionist, clinic-wide for admin, `assert_care_practitioner()` for a practitioner's own practice, and a separate gate for report export); twelve are internal aggregates and gates that **no client role may execute at all**. Every revoke names `anon` explicitly and every internal one also names `authenticated`, because Phase 15 established that `revoke ... from public` does not remove Supabase's default named grants — and every reachable function carries its gate in its **body** as well. There is no patient, clinic, organization, report, column or sort parameter anywhere, and the practitioner-scoped functions take no practitioner id. Utilisation is computed from Phase 09's roster and blocked periods with PostgreSQL multiranges, so booked time is clamped to available time and cannot exceed 100%. **Phase 17:** `ai_assistance_task` and `ai_assistance_status` enums, the `ai_assistance_sessions` table — an **operational audit and a quota**, with **no prompt column, no response column and no clinical column of any kind** — a **composite foreign key** to `(appointments.id, patient_id, practitioner_id)`, an immutability trigger, three indexes, **row-level security enabled with no policy at all for any role**, and six functions. `start_ai_assistance_session` consumes quota and writes the audit entry **before** the provider is called, and derives the patient from the appointment; there is no patient, practitioner, model, prompt or temperature parameter anywhere. `analytics_ai_assistance_summary` is administrator-gated and carries **no practitioner dimension**, so a per-doctor acceptance rate cannot be computed from it. **No table, column, enum, trigger, policy or function belonging to Phases 06–16 was altered, dropped or replaced.** **Phase 19:** no table altered, no policy dropped, no existing function replaced. It **removes privileges** and adds one append-only record: every function in `public` is revoked from `anon`, `alter default privileges` makes that the default for functions created later, `assert_bookable_slot` and the four internal gates are revoked from `authenticated` as well, and `security_audit_events` records who reached what — append-only against the service role too, with no clinical column. **Sixteen migrations. Fifteen are applied to the live project and verified against it with real per-role JWTs — 62 checks in Phase 08, 79 in Phase 09, 106 in Phase 10, 71 in Phase 11, 75 in Phase 12, 141 in Phase 13, 209 in Phase 14, 146 in Phase 15, 155 in Phase 16 and 52 in Phase 17. The Phase 19 migration has NOT yet been applied and must be verified live before the phase is signed off.** |
| Authentication | **Implemented (Phase 06).** Supabase Auth, email + password. Server actions for every mutation; `lib/auth/` for identity, session and safe redirects; `src/proxy.ts` for session refresh and optimistic gating; `(app)` route group protected by `requireUser()` |
| Authorization | **Implemented (Phase 08).** Four roles from `public.user_roles`; the permission matrix in `config/permissions.ts`; pure decisions in `lib/authorization/policy.ts`; server guards in `lib/authorization/guards.ts`; area rules in `lib/authorization/routes.ts`; resource ownership in `lib/authorization/ownership.ts`. Role assignment is an admin-only, audited database function |
| Patient profile | **Implemented (Phase 07).** `features/patients/` holds the model, validation, completeness rules, the query layer and the save action; `components/patient/` holds the UI. Demographic and administrative data only — no clinical column exists |
| Appointments | **Implemented (Phase 09).** `features/appointments/` holds the timezone layer, the availability engine, the status matrix, validation, the query layer and three server actions; `components/appointments/` holds the booking flow, the slot and date pickers, the list, the detail summary and the cancellation dialog. Every write goes through a `security definer` database function; overlap is prevented by a PostgreSQL exclusion constraint, not by application code |
| Doctor workspace | **Implemented (Phase 11).** `features/doctor/` holds the domain model, the doctor status rules, validation, the query layer and two server actions; `components/doctor/` holds the day summary, the schedule, the next-patient panels, the filters, the status actions, care-scoped patient search and the patient summary. Patient access is scoped by **care relationship** — an appointment between that patient and the caller's own practitioner record — decided by `public.doctor_has_care_relationship()` behind an RLS policy, never by the doctor role alone. It writes no scheduling logic; `features/appointments/` is the shared domain layer |
| Clinical records | **Implemented (Phase 12).** `features/clinical/` holds the domain model, the lifecycle and completion rules, validation, the error mapper, the query layer and three server actions; `components/clinical/` holds the consultation form, the record view, the history, the patient header, the save state and the unsaved-changes guard. **A clinical record is its own table, never a column on an appointment.** Access is scoped by **authorship** — `practitioner_id = current_practitioner_id()` behind `clinical_records_select_author` — so a receptionist, a patient and an administrator have no policy on the table at all. Every write is a `security definer` function; concurrency is an optimistic `version` column incremented by trigger |
| Prescriptions | **Implemented (Phase 13).** `features/prescriptions/` holds the domain model, the lifecycle rules, validation, the error mapper, the display formatters, the query layer and five server actions; `components/prescriptions/` holds the builder, the debounced medicine autocomplete, the review, the read-only rendering, the history and the withdrawal dialog. **A prescription is its own table with its own items, never text in a clinical note.** A doctor reads what they authored; a patient reads their own **and only once it is issued**, which is `status <> 'draft'` in the policy rather than a filter a query could forget. Issuing sends an id and a revision and no content, so it cannot change what is issued; an issued prescription is immutable by trigger, and correction is withdraw-then-replace |
| Treatment plans | **Implemented (Phase 13).** `features/treatment-plans/` and `components/treatment-plans/`, in the same shape and kept deliberately separate from prescriptions: five structured categories, no `medication` section, and content frozen on **activation** because an active plan is what the patient was actually told to do. A follow-up date books nothing — nothing in the feature writes to `public.appointments` |
| Patient documents | **Implemented (Phase 14).** `features/documents/` holds the domain model, the lifecycle rules, validation, the error mapper, the query layer, the storage adapter, the upload workflow and two server actions; `lib/documents/` holds the object-key builder and the file-signature reader; `components/documents/` holds the upload form, the list, the detail, the sandboxed preview and the archive dialog. **The bucket is private and no public URL exists or can be constructed**: every read is a 300-second signed URL minted, after authorization, for a path read off a row row-level security already admitted. The original filename is never an input to a path, and what a file *is* is decided by its signature bytes rather than by what the browser called it. A document is archived, never deleted |
| Analytics | **Implemented (Phase 16).** `features/analytics/` holds the domain model, **the centralized metric definitions**, the clinic-timezone range resolver, the trust boundary, the error mapper, the display formatters, the authorized read layer and the CSV writer; `components/analytics/` holds the panels, the accessible chart, the tables, the date filter and the export form. **It adds no table, no column and no enum**: every figure is derived at read time from rows the domain already owns, so nothing here can fall out of step with an appointment. Aggregation happens in PostgreSQL throughout — the feature performs no table read at all — and **nothing is cached across requests**, so freshness is absolute and no cache can leak a scope. Three dashboards: clinic-wide for an administrator, operational for the front desk, and a practitioner's **own practice only**, whose scope is resolved from `auth.uid()` and has no parameter to manipulate |
| Clinical AI | **Implemented (Phase 17).** `features/clinical-ai/` holds the domain model, the **versioned prompt registry**, the server-side **context builder**, the **clinical safety layer**, the trust boundary, the error mapper, the authorized reads and the orchestration; `lib/ai/` holds the provider abstraction, the Gemini adapter, a deterministic mock and the response contract; `components/clinical-ai/` holds the panel, the result and the disclosures. **Doctor-facing only** (`clinical_ai.use`, the doctor role alone), reached from the consultation at `/doctor/appointments/[id]/ai`. **Nothing in the feature writes anything**: no action applies, accepts or saves a result, and a structural test asserts it writes none of nine clinical tables and calls none of fourteen clinical mutation RPCs. A request carries an appointment id, a task, three booleans and up to five document ids — there is no patient, practitioner, model, prompt or temperature parameter. Disabled by default; an unconfigured deployment says so and the consultation is untouched |
| Notifications | **Implemented (Phase 15).** `features/notifications/` holds the domain model, the templates, the link builder, the retry policy, the error and provider-failure mappers, the query layer, three server actions, the processor and the dispatch seam; `lib/notifications/` holds the channel abstraction and the EmailJS adapter; `components/notifications/` holds the bell, the list, the filters and the preference grid. **The event is a row a database trigger writes inside the domain transaction, not a call the application makes** — so a provider outage cannot affect a booking, and no write path can forget to emit. Nothing takes a recipient or a link: both are derived from the resource inside `create_notification`. In-app works today; **email exists as an adapter and is not configured, so the channel is disabled and says so**; there is no SMS and no WhatsApp anywhere |
| File storage | **Implemented (Phase 14).** One bucket, `patient-documents`, `public = false`, 10 MB, a closed six-type allowlist, one select policy predicated on the same question the table asks, and **no insert, update or delete policy for any client role**. Object writes use the service-role client — the first and only feature to use it — after the server has authorized; signed URLs use **the caller's own client**, so the storage policy is an independent layer rather than a bypassed one |
| Receptionist workspace | **Implemented (Phase 10).** `features/reception/` holds the operational model, the staff action rules, validation, the query layer and five server actions; `components/reception/` holds the schedule, the filters, the status actions, patient search, the patient record, walk-in registration and the staff booking flow. **It writes no scheduling logic**: `features/appointments/` is the shared domain layer both workspaces sit on (`docs/PRODUCT_SPEC.md` section 5A), so one validator, one conflict guarantee, one transition matrix and one availability endpoint serve both |
| Security (cross-cutting) | **Implemented (Phase 19).** `lib/security/` holds the five pieces that are nobody's feature and everybody's concern: the **two-tier Content-Security-Policy** (a nonce and `strict-dynamic` on every dynamically rendered route, which is exactly the set holding patient data; `unsafe-inline` only on the static marketing pages, which render no user-controlled content), the **session-cookie hardening** that makes the Supabase tokens `HttpOnly` — possible because no client component uses a Supabase client, asserted by test — the **same-origin check** applied by `createRouteHandler` to every unsafe method, so a route added later inherits CSRF protection rather than remembering it, the **per-account rate limits** on the three surfaces Phase 19 found unbounded, and the **security audit trail**. The CSP and HSTS are emitted by `src/proxy.ts` because both have to be computed per request; the fixed headers stay in `next.config.ts`, where they also cover `/api`. `tests/security/` is 193 tests and one command |
| Performance, SEO and accessibility (cross-cutting) | **Audited and optimized (Phase 20).** No new route, schema, migration, dependency or authorization path. Four measured findings were fixed: source images went from 12.70 MB to 1.34 MB (three photographs were stored as alpha-free PNG; 4.0 MB was a different clinic's unused design mockups); Inter's 83.3 KB `latin-ext` face left every services page once `marketing/treatment-card.tsx` rendered its Sanskrit name in the serif, matching the treatment hero that always did; Zod left the two static auth pages (−384 KB each) once `features/auth/limits.ts` gave a client component a way to reach four constants without the module that builds schemas; and `lib/seo/indexing.ts` made indexing environment-aware, which is what stops a preview deployment competing with production. `next.config.ts` now carries the image configuration — AVIF with a WebP fallback (41% smaller), one permitted quality, and `localPatterns` restricting the optimizer to `public/images/**`, which makes Phase 14's "a patient document never passes through the optimizer" structural rather than conventional. Core Web Vitals on the six public pages: LCP 1000–1308 ms, CLS 0. The one target missed is INP on the mobile menu (272 ms under a 4× CPU throttle, 48 ms unthrottled) |
| API / service layer | Route-handler convention, typed response envelope, correlation ids |
| Configuration | Typed modules in `src/config/`; server secrets fenced with `server-only` |
| Error handling | `AppError` category model, safe user messages, Next.js boundaries |
| Logging | Structured JSON logger with redaction (`lib/logging/`) |
| Validation | Zod, with shared primitives and a trust-boundary parser (`lib/validation/`) |
| State management | None (Zustand not installed) |
| Animation | None (Framer Motion not installed) |
| shadcn/ui | Not installed |
| Testing | Vitest; 3,382 unit, integration and component tests passing. No E2E tool yet |
| Linting | ESLint 9 flat config, `eslint-config-next` (core-web-vitals + typescript) |
| Formatting | Prettier, with the Tailwind class-sorting plugin; Markdown excluded |
| Environment config | `.env.example` plus typed, validated configuration; startup check in `instrumentation.ts` |
| Security headers | Baseline headers in `next.config.ts`; no CSP yet |
| CI | None |

**Implication:** the infrastructure above is real. Everything else this
document describes - appointments, clinical records, notifications, AI - is a
*decision*, not a fact.

### Technology decisions carried forward

The scaffold's choices are preserved rather than replaced: Next.js App Router,
TypeScript strict mode, Tailwind v4 and npm all match the intended direction
in `implementation-plan/phase_00.md` §2, so there is no reason to change them.

Added in Phase 01, each because the foundation needed it:

* `@supabase/supabase-js` and `@supabase/ssr` — auth, database, storage
* `zod` — schema validation at trust boundaries, and typed configuration
* `server-only` — makes a client import of server configuration a build error
* `vitest` — test runner, sharing the project's TypeScript and path aliases
* `prettier` (with `prettier-plugin-tailwindcss`) — consistent formatting and
  deterministic Tailwind class order
* `supabase` (CLI, dev dependency) — pinned migration and type-generation tool

Still to be added, in the phase that first needs them:

* An E2E tool for critical journeys — deferred until there is a journey worth
  driving through a browser (authentication, Phase 03 onwards)
* shadcn/ui primitives — copied into the repository, not a runtime dependency
* Framer Motion — only once motion is actually designed
* Zustand — only if a real client-state need appears; server state and URL
  state cover most cases and should be preferred

Adding a dependency earlier than the phase that needs it is not preparation, it
is unmeasured risk.

### Scaffold debt — cleared in Phase 01

The create-next-app leftovers recorded in Phase 00 are gone: the layout now
carries Punarvasu metadata and a single font family, the template page is
replaced by a placeholder that says what the site is, `globals.css` holds
neutral foundation tokens with a reduced-motion rule, and the Next.js and
Vercel marketing SVGs are deleted.

One item remains: `src/app/favicon.ico` is still the Next.js icon. It is
replaced with the clinic's own mark in Phase 02, alongside the rest of the
visual identity.

---

# 2. Architectural Style

Punarvasu follows a **modular full-stack web application architecture**.

At a high level:

```text
┌──────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│                                                              │
│  Responsive Web UI                                           │
│  ├── Public Website                                          │
│  ├── Patient Portal                                          │
│  └── Admin Portal                                            │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│                                                              │
│  Authentication                                              │
│  Authorization                                               │
│  Appointment Management                                      │
│  Patient Management                                          │
│  Treatment Management                                        │
│  Doctor Management                                           │
│  Content Management                                          │
│  Notification Management                                     │
│  Admin Operations                                            │
│  Validation & Business Rules                                 │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         DATA LAYER                           │
│                                                              │
│  PostgreSQL                                                  │
│  ├── Users / Profiles                                        │
│  ├── Doctors                                                 │
│  ├── Treatments                                              │
│  ├── Appointments                                             │
│  ├── Availability                                             │
│  ├── Notifications                                            │
│  └── Administrative data                                      │
└─────────────────────────────┬────────────────────────────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
        Email Service     File Storage     Analytics/
        / Notifications                    Monitoring
```

The architecture should favor a **modular monolith** initially rather than prematurely introducing microservices.

This keeps deployment and development simple while maintaining clear module boundaries that can later be extracted into independent services if scale requires it.

---

# 3. Technology Responsibilities

The exact technology versions should be pinned in the project configuration and upgraded deliberately.

Recommended responsibilities:

| Layer          | Responsibility                                     |
| -------------- | -------------------------------------------------- |
| Frontend       | Rendering UI, navigation, client interactions      |
| Application    | Business logic, orchestration and request handling |
| API            | Controlled communication between UI and backend    |
| Authentication | Identity, sessions and access control              |
| Database       | Persistent relational data                         |
| Storage        | Images and other uploaded assets                   |
| Email          | Transactional notifications                        |
| Validation     | Input and domain validation                        |
| Logging        | Application and security events                    |
| Monitoring     | Errors, performance and availability               |

The architecture must avoid coupling business logic directly to UI components.

---

# 4. Application Structure

The codebase should use clear boundaries between presentation, application logic, domain logic and infrastructure.

**Current state (Phase 01):** the migration to `src/` is done. `@/*` maps to
`./src/*`, and the following exists:

```text
src/
├── app/
│   ├── api/health/route.ts   liveness endpoint
│   ├── layout.tsx            root layout, metadata, fonts
│   ├── page.tsx              placeholder homepage (Phase 02 replaces it)
│   ├── loading.tsx           route loading boundary
│   ├── error.tsx             route error boundary
│   ├── global-error.tsx      root error boundary
│   ├── not-found.tsx         404 page
│   └── globals.css           foundation tokens (Phase 02 replaces them)
│
├── components/
│   ├── ui/                   design-system primitives (Phase 02)
│   ├── layout/               container, section, header, footer, navigation
│   ├── brand/                logo and brand mark (placeholder)
│   └── shared/               status-message, empty/error/loading states, reveal
│
├── config/
│   ├── env.public.ts         browser-safe configuration
│   ├── env.server.ts         server-only configuration (`server-only`)
│   └── env-issues.ts         shared, value-free issue formatting
│
├── lib/
│   ├── api/                  request-id.ts, response.ts, route-handler.ts
│   ├── design/               palette mirror + WCAG contrast verification
│   ├── errors/               app-error.ts, configuration-error.ts, normalize.ts
│   ├── logging/              logger.ts, redact.ts
│   ├── motion/               the motion language (class presets, no library)
│   ├── supabase/             browser.ts, server.ts, admin.ts
│   ├── utils/                cn.ts
│   └── validation/           parse.ts, schemas.ts
│
├── types/database.ts         generated Supabase types
└── instrumentation.ts        startup configuration check
```

`features/` and `hooks/` do not exist yet. Directories are created by the phase
that needs them, not pre-created empty.

`src/config/` also holds `design-tokens.ts` (the token values TypeScript must
read) and `navigation.ts` (navigation structure, with placeholder content that
the public-website phases replace).

Target structure as features arrive:

```text
src/
├── app/                      route tree only: pages, layouts, route handlers
│   ├── (public)/             marketing site — no auth required
│   ├── (auth)/               sign in, sign up, recovery
│   ├── (patient)/            patient portal
│   ├── (staff)/              receptionist and doctor workspaces
│   ├── (admin)/              clinic administration
│   └── api/                  route handlers
│
├── components/
│   ├── ui/                   design-system primitives (shadcn/ui lives here)
│   ├── layout/               shells, headers, navigation
│   └── shared/               cross-feature composites
│
├── features/                 one directory per domain
│   ├── auth/
│   ├── patients/
│   ├── practitioners/
│   ├── appointments/
│   ├── clinical-records/
│   ├── prescriptions/
│   ├── documents/
│   ├── notifications/
│   ├── articles/
│   └── analytics/
│
├── lib/                      infrastructure adapters
│   ├── supabase/             server and browser clients, kept separate
│   ├── auth/                 session and role resolution
│   ├── validation/           shared schemas
│   ├── storage/
│   ├── email/
│   ├── logging/
│   └── utils/
│
├── config/                   typed environment and app configuration
├── types/                    shared and generated database types
└── hooks/
```

A feature directory contains only the files it genuinely needs, drawn from:

```text
components/     queries.ts     mutations.ts
validation.ts   types.ts       constants.ts
```

Rules that matter more than the exact tree:

* `app/` holds routing and composition. Business logic lives in `features/`
  and `lib/`, never in a page component.
* A feature may depend on `lib/`, `components/` and `types/`. A feature must
  not import from another feature's internals — extract a shared module
  instead.
* `lib/supabase/` keeps the server client and the browser client in separate
  files. The server-only client must never be reachable from a client
  component; the service-role client is separate again and used per
  `DATABASE.md` §6.4.
* Directories are created when a phase needs them, not pre-created empty.

The directory layout may evolve. The boundaries must not.

### Boundaries enforced in code (Phase 01)

* `src/config/env.server.ts` and every server-only module in `lib/` import
  `server-only`. Importing one from a client component fails the build - this
  is verified, not assumed.
* Configuration is read through `src/config/`, never through `process.env`
  scattered across features.
* Route handlers are wrapped by `lib/api/route-handler.ts`, which supplies the
  correlation id, logs failures and returns the sanitized response envelope
  from `lib/api/response.ts`.
* Anything crossing a trust boundary is parsed by `lib/validation/parse.ts`
  before business logic sees it.

### UI boundaries (Phase 02)

* `components/ui/` holds primitives only. A primitive knows nothing about a
  domain: no appointment, patient or treatment types reach it.
* Presentation uses design tokens. A component may not hardcode a colour,
  radius, shadow or font size.
* `"use client"` is pushed to the leaf that needs it. Buttons, inputs, cards,
  badges, tables, containers, the site header and the site footer are server
  components; only the components that genuinely need browser behaviour
  (overlays, tabs, accordion, tooltip, toast, form fields, current-path
  detection) are client components.

---

# 5. Major Functional Modules

## 5.1 Public Website

The public website is accessible without authentication.

Responsibilities:

* Home page
* About Punarvasu
* Ayurvedic philosophy
* Treatments and therapies
* Doctors
* Clinic information
* Contact information
* Frequently asked questions
* Appointment entry points
* Testimonials where applicable
* Educational content
* SEO metadata

Public content should be optimized for:

* Search engines
* Performance
* Accessibility
* Mobile devices
* Fast first load
* Social sharing

---

## 5.2 Authentication Module

The authentication module is responsible for:

* User registration
* Login
* Logout
* Email verification
* Password reset
* Session management
* Protected routes
* Role-based access
* Authentication state

Authentication must be delegated to a secure, established authentication provider rather than implementing password storage and cryptography manually.

The application must never store plaintext passwords.

### Implementation (Phase 06)

Supabase Auth, email and password. The application stores no credential of any
kind; `public.profiles` holds the role and display fields only.

| Concern | Where |
| --- | --- |
| Identity resolution | `lib/auth/current-user.ts` - `getCurrentUser()`, `requireUser()` |
| Route constants | `lib/auth/paths.ts` - every auth path named once |
| Safe redirects | `lib/auth/redirect.ts` - `safeRedirectPath()` |
| Email link origins | `lib/auth/callback-url.ts` - configuration only, never the Host header |
| Mutations | `features/auth/actions.ts` - server actions, CSRF-checked by the framework |
| Validation | `features/auth/validation.ts` - one schema per form, both sides of the boundary |
| Error mapping | `features/auth/errors.ts` - provider failure to safe copy, in one place |
| Session refresh + optimistic gating | `src/proxy.ts` |
| Protected shell | `src/app/(app)/layout.tsx` |

Three rules that constrain every later phase:

* **Identity comes from `supabase.auth.getUser()`, never `getSession()`.** The
  latter decodes the session cookie without verifying it, which on the server
  means trusting a request header.
* **The role comes from the database**, keyed on the verified user id - never
  from user metadata, a token claim or client state.
* **The proxy is not the security boundary.** It redirects early for the user's
  benefit; `requireUser()` and row-level security are what actually deny.

---

## 5.3 Patient Module

The patient module manages authenticated patient functionality.

Responsibilities:

* Patient profile
* Personal information
* Appointment history
* Upcoming appointments
* Appointment cancellation/rescheduling where permitted
* Notification preferences
* Account settings

Patient data must only be accessible to the authenticated patient and authorized administrators.

### Implementation (Phase 07)

The patient profile is built. Everything else in the list above belongs to
later phases.

| Concern | Where |
| --- | --- |
| Domain model | `features/patients/types.ts` |
| Validation, both sides of the boundary | `features/patients/validation.ts` |
| Completeness rules | `features/patients/completeness.ts` — calculated, never stored |
| Reads | `features/patients/queries.ts` — `getPatientProfile()` takes **no user id** |
| Writes | `features/patients/actions.ts` — one server action for create and update |
| Display formatting | `features/patients/format.ts` |
| Copy | `features/patients/content.ts` |
| UI | `components/patient/` |
| Schema and policies | `supabase/migrations/20260918120000_patient_profile.sql` |

Three rules this phase adds, and later phases inherit:

* **The profile is not the medical record.** `public.patients` holds
  demographic and administrative data. It has no column for a diagnosis, a
  symptom, a medication, an allergy, a history or a note, and none may be
  added to it — clinical records are separate tables referencing
  `patients.id`.
* **A query is scoped by the session, not by an argument.** The read function
  takes no user id, so there is none to substitute. Ownership is enforced
  again by row-level security.
* **A write's field allowlist exists in three places**: the schema is
  `strict()`, the record mapper builds its object key by key, and the database
  grants `update` column by column. `profile_id`, `id`, `role` and both
  timestamps are unreachable from a request.

---

## 5.4 Appointment Module

Appointments are a core domain entity.

Responsibilities:

* Appointment creation
* Appointment availability
* Doctor availability
* Treatment/service selection
* Date and time selection
* Appointment confirmation
* Cancellation
* Rescheduling
* Appointment status
* Appointment history
* Notifications
* Administrative management

Possible appointment states:

```text
REQUESTED
    │
    ▼
CONFIRMED
    │
    ├──────────────► CANCELLED
    │
    ▼
COMPLETED

REQUESTED ─────────► REJECTED
CONFIRMED ─────────► NO_SHOW
```

Appointment state transitions must be controlled by business rules and must not be freely editable from the client.

---

# 6. Appointment Consistency

Appointment creation must be protected against race conditions.

The system must not assume that a slot remains available simply because the UI previously displayed it as available.

The backend must re-check availability during appointment creation.

Conceptually:

```text
Patient selects slot
        │
        ▼
Client sends appointment request
        │
        ▼
Server validates request
        │
        ▼
Server checks availability
        │
        ▼
Database transaction
        │
        ├── Slot available → Create appointment
        │
        └── Slot unavailable → Reject request
```

Database constraints and transactions should be used wherever necessary to prevent duplicate bookings.

---

# 7. Authorization Architecture

Authentication answers:

> "Who is this user?"

Authorization answers:

> "What is this user allowed to do?"

These concerns must remain separate.

Punarvasu defines exactly four roles:

```text
patient
receptionist
doctor
admin
```

`SECURITY.md` §6 is the canonical definition of the role model and holds the
permission matrix. This document does not restate it.

`SUPER_ADMIN` is deliberately **not** implemented — see `SECURITY.md` §6.

### Implementation (Phase 14) — patient documents and secure storage

The eighth permission-gated capability, the first time a **patient** holds a
*write* permission over anything clinical-adjacent, and the first time the
product stores a **file**.

| Concern | Where |
| --- | --- |
| The four permissions | `config/permissions.ts` — `documents.read.self` and `documents.write.self` to the patient, `documents.read.care` and `documents.write.care` to the doctor. **None to a receptionist or an administrator** |
| The lifecycle | `features/documents/status.ts`, mirrored by `patient_documents_guard_update()` and asserted against it |
| What a file *is* | `lib/documents/file-signature.ts` — the signature bytes, the extension and the declared type must all agree, and the **detected** type is what is stored |
| The object key | `lib/documents/storage-path.ts` and `public.patient_document_storage_path()` — the same string, built twice, compared by the database, and asserted identical by a test that parses the migration |
| Server enforcement | the area layout, then `requirePermission` per page and in the route handler, then `can()` per action |
| Database enforcement | `public.assert_document_patient()` for the patient's path and `public.assert_care_practitioner()` — Phase 11's gate, reused unchanged — for the practitioner's |
| The patient's access policy | `patient_id = public.current_patient_id()` |
| The doctor's access policy | `public.doctor_has_care_relationship(patient_id)` — deliberately **wider** than Phase 12/13's authoring model; the reasoning is below |
| Storage enforcement | one policy on `storage.objects`, predicated on `public.can_read_patient_document_object(name)`, which resolves the key to its row |
| Row-level security | **two** select policies on the table and **one** on the bucket; **no write policy and no write grant anywhere**; no policy at all for a receptionist or an administrator, and none for `anon` |

Five rules this phase adds, and later phases inherit:

* **A storage path is generated, never accepted, and then recomputed.** The
  original filename is not an argument to the builder, so
  `../../another-patient.pdf` has nothing to influence; the extension comes
  from the type the *server* determined by reading the bytes; and the database
  rebuilds the string and raises `PV041` if it differs. A check constraint
  refuses an uncontrolled path a second time — **including against the
  service-role client**, verified live.
* **The service-role client writes objects; the caller's own client signs
  them.** This is the first feature to use the service-role key at all. It
  writes because there is deliberately no insert policy on the bucket — a
  client that could write could choose its own path. It does **not** read,
  because using it to mint a signed URL would bypass the storage policy and
  throw away the layer that makes path guessing fail.
* **Authorization before signing is structural, not remembered.** The path is
  not an input to the access action: it is read off a row row-level security
  admitted. There is no branch in which a URL is minted for a path a caller
  supplied.
* **The object is written before the row, and the failure is compensated.**
  The other ordering leaves a document in the patient's list that cannot be
  opened — silent, permanent and visible to them. This ordering leaves, on
  failure, an unreferenced object that **no policy can reach**, because the
  storage predicate resolves a key to a row that does not exist; the workflow
  then removes it.
* **A doctor's *document* scope is the care relationship, not authorship.**
  Phases 12 and 13 scope a clinical record and a prescription to the
  practitioner who wrote them, which is right for a conclusion somebody
  reached. A lab report is evidence the patient obtained and brought in so
  that whoever is treating them can read it; scoping it to whoever happened to
  be present at upload would mean the patient uploading it again for the next
  doctor. `phase_14.md` section 21 asks for exactly this, and section 18's
  requirement — no reach beyond a care relationship — still holds and is
  verified live in both directions. **It is a product decision the clinic
  should confirm**, and it is one policy predicate.

### Implementation (Phase 13) — prescriptions and treatment plans

The sixth and seventh permission-gated capabilities, and the first time a
**patient** holds a clinical permission at all.

| Concern | Where |
| --- | --- |
| The six permissions | `config/permissions.ts` — four to the doctor, and `prescriptions.read.self` and `treatment_plans.read.self` to the patient |
| The two lifecycles | `features/prescriptions/status.ts` and `features/treatment-plans/status.ts`, each mirrored by a guard trigger and asserted against it |
| Server enforcement | the area layout, then `requirePermission` per page, then `can()` per action |
| Database enforcement | `public.assert_care_practitioner()` — Phase 11's gate, reused unchanged — called first by every one of the ten functions |
| The doctor's access policy | `practitioner_id = public.current_practitioner_id()`, the authoring-practitioner model unchanged from Phase 12 |
| The patient's access policy | `patient_id = public.current_patient_id() and status <> 'draft'` |
| Row-level security | **eight** select policies; **no write policy and no write grant**; no policy at all for a receptionist or an administrator |

Four rules this phase adds, and later phases inherit:

* **A clinical instruction is its own table, and a clinical note is not a
  place to put one.** `phase_13.md` section 2 and example 1 draw the line;
  this is the migration that keeps it in the schema. `clinical_records` gained
  no prescription column, and a structural test fails the build if one
  appears.
* **"The patient cannot see a draft" is a predicate on the row, not a filter
  in a query.** `status <> 'draft'` lives in `prescriptions_select_patient`
  and in the definer predicate the items policy uses, so a query added later
  cannot forget it. The `.neq` in the query layer is defence in depth on top
  of that, not the control.
* **The act of finalizing carries no content.** `issue_prescription` and
  `activate_treatment_plan` take an id and a revision and nothing else, so
  what is issued is exactly what the doctor reviewed — and the workspace
  refuses to issue while anything is unsaved, because otherwise the review
  would be showing something that is not going to be issued.
* **Correction is withdraw-then-replace, and the partial unique index is what
  makes it possible.** At most one *live* prescription per consultation, so
  cancelling frees the slot while the cancelled row stays for ever. That is
  `phase_13.md` section 42's amendment path reached without a versioning
  subsystem, and it is why an issued prescription cannot be deleted even by
  the service role: the items guard refuses the cascade.

### Implementation (Phase 12) — clinical records

The fifth permission-gated capability, and the first that authorizes access to
*clinical* data rather than to operational data about a person.

| Concern | Where |
| --- | --- |
| The two clinical permissions | `config/permissions.ts`, granted to the doctor role alone |
| The record's lifecycle and completion rules | `features/clinical/status.ts`, mirrored by the migration and asserted against it |
| Server enforcement | the area layout, then `requirePermission` per page, then `can()` per action |
| Database enforcement | `public.assert_care_practitioner()` — Phase 11's gate, reused unchanged — called first by every clinical function |
| The access policy | `practitioner_id = public.current_practitioner_id()`, behind `clinical_records_select_author` |
| Row-level security | **one** select policy; **no write policy and no write grant**; no policy at all for a receptionist, a patient or an administrator |

Four rules this phase adds, and later phases inherit:

* **A clinical record is its own table, and an appointment is not a place to
  put one.** `docs/PRODUCT_SPEC.md` section 5A already ordered the two areas;
  this is the phase that keeps them apart in the schema. `public.appointments`
  gained no clinical column, and a structural test fails the build if one
  appears.
* **Consistency between related records is a constraint, not a check.** The
  record's `(appointment_id, patient_id, practitioner_id)` triple is a
  **composite foreign key** into `appointments`, so a record naming a different
  patient than its appointment does is not something the application must
  remember to prevent — it is something the database cannot represent.
* **Concurrency on a medical record is optimistic, and the token is
  maintained by the database.** A `version` column, incremented by a trigger so
  no function can forget, and applied in the `where` clause of the update
  itself so two concurrent saves cannot both write. A stale write is refused
  and reported as a **conflict**, which is neither success nor a retryable
  error.
* **A completed record is immutable in the database, not in the UI.**
  `clinical_records_guard_update()` refuses an update that changes any clinical
  field on a non-draft row. Hiding the edit control is a usability decision;
  this is what makes "completed records are not silently overwritten" true.

### Implementation (Phase 11) — the clinical workspace

The fourth permission-gated area, and the first whose access to *other
people's* data is scoped by a relationship rather than by a role.

| Concern | Where |
| --- | --- |
| The three clinical-workspace permissions | `config/permissions.ts`, granted to the doctor role alone |
| The area rule | `lib/authorization/routes.ts` — `PROTECTED_AREAS.doctor` |
| Which actions a status allows a practitioner | `features/doctor/status.ts` |
| Server enforcement | the area layout, then `requirePermission` per page, then `can()` per action |
| Database enforcement | `public.assert_care_practitioner()`, called first by every doctor function |
| The care relationship | `public.doctor_has_care_relationship()`, behind `patients_select_doctor_care` |
| Row-level security | two relationship-scoped `select` policies; **no write policy and no write grant** |

Three rules this phase adds, and later phases inherit:

* **A doctor's access to a patient is a relationship, not a role.** The policy
  is `has_app_role('doctor') and doctor_has_care_relationship(id)`, and the
  second half is the one that matters: a doctor with no appointment with a
  patient reads nothing about them, and two doctors at the same clinic are
  isolated from each other's patients. `docs/SECURITY.md` §6 required this and
  Phase 09 built the relationship; this is the phase that enforces it on
  patient data.
* **An authorization gate may resolve an identity, and that is better than
  accepting one.** `assert_care_practitioner()` refuses and *returns the
  practitioner id*, so every function below it derives the practitioner from
  `auth.uid()`. There is no `practitionerId` parameter anywhere in the feature
  to substitute — the strongest form of `phase_11.md` example 2.
* **Two roles acting on one lifecycle get two allowlists, not one relaxed
  one.** The front desk sets `confirmed, checked_in, no_show, cancelled`; a
  practitioner sets `confirmed, in_consultation, completed, no_show`. They are
  complements: the two Phase 10 refused the desk because they describe the
  consulting room are exactly the two this phase grants, and cancelling stays
  where somebody can tell the patient.

### Implementation (Phase 10) — the front desk

The third permission-gated area, and the first one that acts on **other
people's** data.

| Concern | Where |
| --- | --- |
| The three front-desk permissions | `config/permissions.ts`, granted to the receptionist role alone |
| The area rule | `lib/authorization/routes.ts` — `PROTECTED_AREAS.receptionist` |
| Which operational actions a status allows | `features/reception/status.ts` |
| Server enforcement | the area layout, then `requirePermission` per page, then `can()` per action |
| Database enforcement | `public.assert_appointment_manager()`, called first by every staff function |
| Row-level security | three role-named `select` policies; **no write policy and no write grant** |

Three rules this phase adds, and later phases inherit:

* **A workspace depends on a domain layer, not on a sibling.**
  `features/reception` imports `features/appointments` because appointments sit
  beneath both staff workspaces and the logic belongs in one place
  (`docs/PRODUCT_SPEC.md` section 5A). That is a dependency on a shared domain,
  not the peer-to-peer coupling section 4 forbids — and the alternative was a
  second scheduling engine.
* **A rule that differs by actor becomes a parameter, never a second copy.**
  `assert_bookable_slot` takes `p_require_online_booking` and
  `p_min_notice_minutes` so that self-service rules can be switched off for the
  front desk without duplicating the validator. The calling *function* decides;
  no request reaches those arguments.
* **An identifier a staff member genuinely chooses is an input, and is
  validated as data.** `create_appointment_for_patient` takes a patient id
  because the receptionist picks the patient — and resolves it against
  `public.patients` before writing anything. It says *which*; `auth.uid()` and
  the role say *whether*.

---

### Implementation (Phase 08)

| Concern | Where |
| --- | --- |
| Permission vocabulary and the role → permission matrix | `config/permissions.ts` |
| The decision, as pure functions | `lib/authorization/policy.ts` — `can()`, `hasRole()`, `permissionsForRole()` |
| Which area needs which permission, and where each role belongs | `lib/authorization/routes.ts` — `PROTECTED_AREAS`, `areasForRole()`, `landingPathForRole()` |
| Enforcement on a server path | `lib/authorization/guards.ts` — `requireAreaAccess()`, `requirePermission()`, `requireRole()`, `assertPermission()` |
| Resource-level ownership | `lib/authorization/ownership.ts` — `isResourceOwner()`, `assertResourceOwner()`, `assertNotSelf()` |
| Role assignment | `features/admin/` and `public.assign_user_role()` |
| The refusal experience | `/forbidden` |

Four rules this phase adds, and later phases inherit:

* **Check a permission, not a role.** `config/permissions.ts` is the only place
  a role and a capability are named together, so moving a capability between
  roles is an edit to one table rather than a search for a string.
* **The role comes from `public.user_roles`, read by `getCurrentUser()`** and
  by nothing else. `profiles.role` no longer exists.
* **An unresolvable role holds no permissions.** `AppRole | null`, never
  defaulted to `patient`, so a missing row or an unreachable database denies.
* **An area's guard and its navigation read the same table.** A link cannot be
  offered for an area the guard will refuse, and — the failure that matters —
  an area cannot acquire a link while nobody remembers to guard it.

Two boundaries follow from the role model and constrain the architecture:

* A receptionist is an **operational** role and must not be able to read
  clinical notes, assessments, treatment plans or prescriptions.
* A doctor's clinical access is scoped by **treatment relationship**, not by
  the bare fact of holding the doctor role.

Authorization must be enforced on the server.

UI-level hiding of buttons or pages is **not** a security mechanism.

For every protected operation:

```text
Request
  ↓
Authenticate
  ↓
Identify user
  ↓
Check role / ownership
  ↓
Validate input
  ↓
Execute operation
```

---

# 8. Data Architecture

PostgreSQL should be used as the primary relational database, provided through
Supabase.

> **`DATABASE.md` is the canonical data-architecture document.** It holds the
> entity reference, ownership rules, RLS approach, clinical-record and
> prescription history semantics, file-storage flow, appointment concurrency
> guarantees and migration rules. The summary below is orientation only; where
> the two differ, `DATABASE.md` is correct.

Core entities include:

```text
User
PatientProfile
Doctor
Treatment
Appointment
Availability
Clinic
Notification
Content
AuditLog
```

Potential relationships:

```text
User
 │
 └── PatientProfile
        │
        └── Appointment
              ├── Doctor
              └── Treatment

Doctor
 └── Availability

Appointment
 └── Notification

Admin actions
 └── AuditLog
```

Database design should prioritize:

* Referential integrity
* Appropriate indexes
* Unique constraints
* Foreign-key constraints
* Transactional consistency
* Soft deletion where appropriate
* Auditability for sensitive administrative operations

---

# 9. Database Principles

The application layer must not rely solely on application-level validation for data integrity.

Important invariants should also be enforced by the database.

Examples:

* Required fields
* Unique email addresses where applicable
* Valid foreign-key relationships
* Valid appointment relationships
* Prevention of duplicate records
* Consistent status values

Use migrations for every schema change.

Never manually modify production schema without a corresponding migration.

---

# 10. API Architecture

APIs should be organized around business capabilities rather than arbitrary database operations.

Example:

```text
/api/auth/*
/api/appointments/*
/api/patients/*
/api/doctors/*
/api/treatments/*
/api/admin/*
/api/notifications/*
```

API handlers should remain thin.

Recommended flow:

```text
API Route
   ↓
Authentication
   ↓
Authorization
   ↓
Request Validation
   ↓
Application Service
   ↓
Domain Rules
   ↓
Repository / Database
   ↓
Response
```

Business logic should not be duplicated across multiple API endpoints.

### Response convention (implemented in Phase 01)

Every route handler answers in one shape, so clients need one parser:

```jsonc
{ "ok": true, "data": { /* endpoint payload */ } }

{
  "ok": false,
  "error": { "code": "validation", "message": "...", "fieldErrors": { } },
  "requestId": "..."
}
```

`code` is one of `validation`, `unauthorized`, `forbidden`, `not_found`,
`conflict`, `rate_limited`, `internal`, each mapped to its HTTP status in
`lib/errors/app-error.ts`. `message` is always safe to display; internal
detail stays in the server log, correlated by `requestId`, which is also
returned in the `x-request-id` header.

---

# 11. Validation Architecture

Validation occurs at multiple levels.

## Client-side validation

Used for:

* Immediate user feedback
* Form usability
* Basic format checking

## Server-side validation

Required for:

* Security
* Data integrity
* Business rules

## Database validation

Used for:

* Structural integrity
* Uniqueness
* Relationships
* Critical constraints

The client must never be trusted.

---

# 12. Error Handling

Errors should be handled consistently.

The application should distinguish between:

### User errors

Examples:

* Invalid form input
* Slot no longer available
* Unauthorized operation

These should return clear, user-friendly messages.

### System errors

Examples:

* Database failure
* External service failure
* Unexpected application exception

These should:

* Be logged
* Return a safe generic response
* Avoid exposing internal implementation details

Never expose:

* Stack traces
* Database queries
* Internal paths
* Secrets
* Authentication internals

to end users.

### Implementation (Phase 01)

`AppError` (`lib/errors/app-error.ts`) is the single error vocabulary. Its
`message` is user-facing copy; the underlying failure travels in `cause`, which
is logged and never serialized. `toAppError` converts any unknown throw into a
generic internal error, so a database message cannot become a user message by
accident. In the UI, `app/error.tsx` and `app/global-error.tsx` show a safe
message and surface only the Next.js `digest`, which correlates to the server
log without describing the failure.

---

# 13. Notification Architecture

Notifications should be treated as a separate application capability.

Potential notification events:

```text
Appointment Requested
Appointment Confirmed
Appointment Cancelled
Appointment Rescheduled
Appointment Reminder
Email Verification
Password Reset
```

Conceptual flow:

```text
Business Event
      │
      ▼
Notification Service
      │
      ├── Email
      ├── In-app notification
      └── Future channels
```

Notification delivery should not unnecessarily block the primary user operation.

For example, confirming an appointment should not fail solely because an email provider is temporarily unavailable.

Where appropriate, notification processing should be asynchronous and retryable.

### Implementation (Phase 15)

Implemented, and the shape above is right in one respect and wrong in another:
the business event does **not** reach a notification service through a
function call. It reaches it through a row.

```text
Domain transaction
      │  an `after` trigger, inside the same transaction
      ▼
public.notification_outbox
      │  a worker: `after()` after a server action, or a scheduler
      ▼
authoritative state re-read  ──► skipped, if the world has moved on
      │
      ▼
template  ──►  public.notifications        (in-app: this row IS the delivery)
      │
      ▼
public.notification_deliveries  ──►  channel adapter  ──►  provider
```

| Concern | Where |
| --- | --- |
| The two permissions | `config/permissions.ts` — `notifications.read.self` and `notifications.write.self`, the first entries held by **every** role |
| Event emission | Three `after` triggers, on `appointments`, `prescriptions` and `treatment_plans`. **No application code emits anything** |
| The outbox | `public.notification_outbox`, claimed with `for update skip locked` and leased, so a crashed worker's work returns |
| Recipient resolution | `public.notification_recipient_for_resource()` — takes a **resource**, never a person |
| Authoritative context | `notification_appointment_context()`, `notification_prescription_context()`, `notification_treatment_plan_context()` — the whole of what a template may know |
| Templates | `features/notifications/templates.ts`, typed per event, versioned |
| The worker | `features/notifications/processor.ts`, service-role, never throws |
| Prompt drain | `features/notifications/dispatch.ts` — `after()`, guarded in both directions |
| Reliable drain | `POST /api/notifications/process`, shared secret, rate-limited |
| Provider abstraction | `lib/notifications/channel.ts`; `lib/notifications/providers/emailjs.ts` |
| The notification centre | `/notifications`, `/notifications/preferences`, `components/notifications/` |
| Row-level security | Two select policies scoped to `auth.uid()`; **no policy at all** on either queue; no write policy or grant anywhere |

Six rules this phase adds, and later phases inherit:

* **The event is a row written inside the domain transaction, not a call.** A
  confirmed appointment that produced no event is not a state the database can
  be in, and an event for an appointment that was never confirmed is not
  either. Nothing in the application layer has to remember to emit anything,
  every write path is covered including ones added later, and no provider is
  reachable from inside the transaction that could fail it — which is what
  section 13's "confirming an appointment should not fail solely because an
  email provider is unavailable" actually requires.

* **A queued event is a claim about the past, so the present is re-read.** The
  processor loads the resource's current state before rendering anything: a
  confirmation whose appointment has since been cancelled is *skipped*, and an
  appointment event whose encoded start instant no longer matches has been
  superseded by a later reschedule and is skipped too. An event carries
  identifiers and a timestamp; it never carries a record.

* **There is no recipient parameter and no link parameter, anywhere.**
  `create_notification` resolves the account from the resource and derives the
  deep link from the resource type and id. The strongest form of "never trust a
  client-supplied recipient" is having nothing to supply, and it is the same
  reasoning Phase 12 and Phase 13 applied to `patientId` and
  `practitionerId`.

* **A reminder is recomputed from the authoritative appointment, twice.** Once
  when the appointment changes — the planner cancels every scheduled reminder
  the appointment no longer justifies — and again when one falls due, where it
  must still be confirmed, still in the future, and still start at the instant
  the reminder was computed from. "The old reminder must not fire" is therefore
  not something anybody has to remember; the row is gone, and if it somehow is
  not, the release refuses it.

* **A channel that cannot deliver does not exist.** `resolveChannels()` returns
  only adapters whose credentials are present, so an unconfigured deployment
  creates no delivery rows and accumulates no queue that will never drain — and
  the preferences screen says email is not switched on rather than offering a
  control with no effect. There is no `sms` and no `whatsapp` anywhere: not an
  enum value, not an adapter, not a stub.

* **In-app delivery is the notification row.** `notification_deliveries`
  records **external** attempts only, and a check constraint says so. "The
  notification exists but the email failed" is representable; "the email
  succeeded but there is no notification" is not.


---

# 14. File and Media Architecture

Images and other media should not be stored directly inside the relational database.

Use object/file storage for:

* Doctor photographs
* Treatment images
* Clinic images
* Educational media
* Other approved assets

The database should store metadata and references to those files.

Uploaded files must be:

* Validated
* Size-limited
* Type-checked
* Access-controlled where necessary
* Optimized for web delivery

---

# 15. Security Architecture

Security is a cross-cutting concern.

Minimum requirements:

* HTTPS in production
* Secure authentication
* Secure session handling
* Server-side authorization
* Input validation
* Output escaping
* CSRF protection where applicable
* Rate limiting for sensitive endpoints
* Secure HTTP headers
* Protection against injection attacks
* Protection against XSS
* Protection against unauthorized data access
* Secrets stored only in environment/secret management systems
* No secrets committed to source control

Sensitive configuration must never be exposed through client-side environment variables.

Only explicitly public configuration may be exposed to the browser.

---

# 16. Patient Data Privacy

Patient information should be treated as sensitive data.

The system should follow data-minimization principles:

> Collect only information required for the intended functionality.

Access to patient information must follow least-privilege principles.

Administrative access to sensitive patient information should be auditable.

The application should avoid logging:

* Passwords
* Authentication tokens
* Session secrets
* Sensitive patient information
* Payment secrets
* API keys

Privacy-related requirements should be reviewed against applicable Indian laws and regulations before production launch.

---

# 17. Audit Logging

Important administrative and security-sensitive actions should be recorded.

Examples:

```text
Admin login
Patient record access
Appointment status changes
Appointment cancellation
Doctor changes
Treatment changes
Content changes
Role changes
```

Audit records should contain enough information to answer:

* Who performed the action?
* What action was performed?
* Which entity was affected?
* When did it happen?
* What was the outcome?

Audit logs should be protected from ordinary users.

---

# 18. Frontend Architecture

The frontend should follow a component-based architecture.

Components should be divided into:

### UI primitives

Examples:

* Button
* Input
* Select
* Dialog
* Card
* Badge
* Tabs

### Composite components

Examples:

* AppointmentCard
* DoctorCard
* TreatmentCard
* AppointmentForm

### Feature components

Examples:

* BookingFlow
* PatientDashboard
* AppointmentManagement
* DoctorManagement

### Layout components

Examples:

* Header
* Footer
* Sidebar
* DashboardLayout

Reusable components should be preferred over duplicated markup.

---

# 19. State Management

Use the simplest state-management approach appropriate for each use case.

### Local state

Use for:

* Form fields
* Modal visibility
* Temporary UI state

### Server state

Use for:

* Appointments
* Doctors
* Treatments
* Patient data

Server state should have appropriate:

* Loading states
* Error states
* Cache behavior
* Refetch behavior

Avoid introducing a global state store unless there is a clear architectural need.

---

# 20. Design System Architecture

The UI should use a consistent design system.

Centralize:

* Typography
* Spacing
* Colors
* Borders
* Radius
* Shadows
* Motion
* Breakpoints
* Component variants

The visual language should communicate:

* Trust
* Calmness
* Wellness
* Authenticity
* Premium quality
* Ayurvedic heritage
* Modern healthcare professionalism

Avoid excessive decorative elements that reduce usability or performance.

---

# 21. Responsive Architecture

The application must be designed mobile-first.

Supported experiences should include:

```text
Mobile
Tablet
Laptop
Desktop
Large desktop
```

Critical workflows such as appointment booking must remain easy to complete on smaller screens.

Touch targets should be appropriately sized.

Navigation should adapt naturally between mobile and desktop.

---

# 22. Accessibility

Accessibility is a first-class architectural requirement.

The application should target WCAG 2.2 AA where practical.

Requirements include:

* Semantic HTML
* Keyboard navigation
* Visible focus states
* Proper labels
* Accessible form errors
* Sufficient contrast
* Screen-reader support
* Reduced-motion support
* Meaningful heading hierarchy
* Accessible dialogs and menus

Accessibility must be considered during component development rather than added at the end.

---

# 23. SEO Architecture

Public-facing pages should be SEO-friendly.

Requirements include:

* Semantic HTML
* Unique page titles
* Meta descriptions
* Canonical URLs
* Open Graph metadata
* Structured data where appropriate
* Sitemap
* Robots configuration
* Clean URLs
* Optimized images
* Fast page rendering

Healthcare-related content should prioritize accuracy and trustworthiness.

---

# 24. Performance Architecture

Performance should be considered from the beginning.

Key principles:

* Minimize unnecessary JavaScript
* Optimize images
* Lazy-load non-critical media
* Cache appropriate resources
* Avoid unnecessary database queries
* Paginate large datasets
* Add database indexes based on actual query patterns
* Avoid waterfall API requests
* Prefer server rendering/static generation for suitable public content

Performance should be measured rather than assumed.

---

# 25. Caching Strategy

Caching should be applied selectively.

Suitable candidates may include:

* Public treatment information
* Public doctor information
* Static clinic content
* Frequently accessed configuration

Avoid caching sensitive patient-specific information without a clear invalidation strategy.

Appointment availability should be treated carefully because stale availability can result in incorrect booking experiences.

---

# 26. Observability

Production systems should provide visibility into:

```text
Errors
Performance
API failures
Database failures
Authentication failures
Notification failures
Appointment failures
```

Logging should use structured logs.

Example conceptual log:

```json
{
  "event": "appointment_created",
  "appointmentId": "...",
  "userId": "...",
  "timestamp": "..."
}
```

Logs must not contain sensitive secrets or unnecessary patient information.

### Implementation (Phase 01)

`lib/logging/logger.ts` writes one JSON object per event, with `timestamp`,
`level`, `event` and any context supplied. `logger.child({ requestId })` stamps
a correlation id onto every record for a request. The logger is server-only.

`lib/logging/redact.ts` replaces values whose key looks sensitive - credentials,
tokens, contact details, clinical fields - and bounds string length, array
width and object depth, so one careless call cannot dump a record into a log.
Callers are still expected to log identifiers rather than content; redaction is
the safety net, not the policy.

---

# 27. Configuration Management

Configuration should be environment-specific.

Typical environments:

```text
Development
Testing
Staging
Production
```

Configuration values should be supplied through environment variables or a secure secret-management mechanism.

Example categories:

```text
Database configuration
Authentication configuration
Email provider configuration
Storage configuration
Application URL
Feature flags
Observability configuration
```

Never commit production secrets to Git.

Provide a safe `.env.example` containing variable names but no real secrets.

### Implementation (Phase 01)

Two modules, one boundary:

* `src/config/env.public.ts` - browser-safe values. `NEXT_PUBLIC_*` is read
  through literal property access so Next.js can inline it.
* `src/config/env.server.ts` - server-only values, fenced with `server-only`.
  The Supabase service-role key is reachable only through
  `requireSupabaseServiceRoleKey()`, used by the admin client alone.

Configuration is validated per consumer rather than all at once, so a page that
needs only the site URL does not fail because an unrelated capability is
unconfigured. `src/instrumentation.ts` runs a full check when the server boots
and logs every missing or malformed variable by name - never by value - so a
misconfigured deployment is loud in the logs rather than silent until a patient
hits the failing path.

Variables that no code reads yet stay documented in `.env.example` only. The
phase that first uses one adds it to the typed configuration.

---

# 28. Deployment Architecture

The application should support a straightforward deployment pipeline.

Conceptually:

```text
Developer
   │
   ▼
Git Repository
   │
   ▼
CI / Validation
   │
   ├── Lint
   ├── Type Check
   ├── Unit Tests
   ├── Integration Tests
   └── Build
   │
   ▼
Deployment
   │
   ├── Application
   ├── Database
   ├── Storage
   └── External Services
```

Production deployments should be repeatable and automated where possible.

---

# 29. Testing Architecture

**Implemented (Phase 01):** Vitest, configured in `vitest.config.mts`, sharing
the project's `@/*` alias. Unit tests sit next to the code as
`*.test.ts`; integration tests live in `tests/integration/`; shared helpers in
`tests/support/`. `npm test` runs them all. No E2E tool is installed yet - it
arrives with the first journey worth driving through a browser.

Testing should exist at multiple levels.

## Unit tests

Test:

* Business rules
* Utility functions
* Validation
* Domain logic

## Integration tests

Test:

* Database interactions
* API behavior
* Authentication/authorization
* Appointment workflows
* Notification integration

## End-to-end tests

Test critical user journeys:

```text
Register
  ↓
Verify email
  ↓
Login
  ↓
Browse treatment
  ↓
Book appointment
  ↓
View appointment
  ↓
Cancel/reschedule
```

Admin workflows should also have end-to-end coverage for critical operations.

---

# 30. Domain Events

Where useful, important business events should be represented explicitly.

Examples:

```text
AppointmentCreated
AppointmentConfirmed
AppointmentCancelled
AppointmentRescheduled
AppointmentCompleted
UserRegistered
EmailVerified
```

Events can be consumed by capabilities such as:

* Notifications
* Audit logging
* Analytics
* Future integrations

This reduces coupling between core business operations and secondary effects.

---

# 31. Extensibility

The architecture should make the following future capabilities possible without major redesign:

* Multiple clinic locations
* Multiple doctors
* Multiple treatment categories
* Online consultation
* Payments
* Coupons
* Treatment packages
* Patient medical history
* Prescriptions
* Follow-up scheduling
* WhatsApp notifications
* SMS notifications
* Digital invoices
* Reviews
* Loyalty programs
* Educational content/CMS
* Analytics dashboard

These capabilities should not be implemented prematurely unless required by the current product phase.

---

# 32. Third-Party Integrations

External services must be isolated behind application-level adapters.

For example:

```text
Application
    │
    ▼
EmailService
    │
    ▼
Resend / Other Provider
```

The rest of the application should depend on `EmailService`, not directly on a specific provider.

This allows providers to be replaced without changing business logic.

The same principle applies to:

* Storage
* Payments
* SMS
* WhatsApp
* Analytics
* Authentication

---

# 33. Dependency Direction

Dependencies should generally flow inward toward business capabilities.

Preferred:

```text
UI
 ↓
Application Services
 ↓
Domain / Business Rules
 ↓
Infrastructure
```

Avoid:

```text
Database
 ↓
UI
```

or:

```text
UI Component
 ↓
Direct database access
```

UI components should not contain database queries or sensitive business rules.

---

# 34. Separation of Concerns

Each layer should have one primary responsibility.

### Presentation

Responsible for:

* Rendering
* User interaction
* Display state

### Application

Responsible for:

* Use-case orchestration
* Authorization checks
* Workflow coordination

### Domain

Responsible for:

* Business rules
* State transitions
* Domain invariants

### Infrastructure

Responsible for:

* Database
* Email
* Storage
* External APIs

This separation makes the system easier to test and evolve.

---

# 35. Data Flow Example — Appointment Booking

```text
Patient
   │
   ▼
Appointment UI
   │
   ▼
Booking API
   │
   ├── Authenticate user
   │
   ├── Validate input
   │
   ├── Validate treatment
   │
   ├── Validate doctor
   │
   ├── Check availability
   │
   ├── Begin transaction
   │
   ├── Create appointment
   │
   └── Commit transaction
   │
   ▼
Appointment Created
   │
   ├── Audit event
   │
   └── Notification event
             │
             ▼
        Email / Other channel
```

The booking response should be based on the authoritative database result rather than the state previously shown by the client.

---

# 36. Data Flow Example — Patient Dashboard

```text
Patient
   │
   ▼
Dashboard
   │
   ▼
Authenticated Request
   │
   ▼
Authorization
   │
   ▼
Patient Service
   │
   ├── Patient Profile
   ├── Upcoming Appointments
   └── Appointment History
   │
   ▼
Database
   │
   ▼
Sanitized Response
   │
   ▼
Dashboard UI
```

Only data required by the dashboard should be returned.

Avoid exposing unnecessary database fields.

---

# 37. Admin Architecture

The admin portal should be logically separated from the public/patient experience.

Admin capabilities may include:

* Dashboard
* Appointment management
* Patient management
* Doctor management
* Treatment management
* Availability management
* Content management
* Notification management
* Audit logs
* System configuration

Every admin operation must perform server-side authorization.

High-risk actions should require additional confirmation and, where appropriate, elevated authorization.

---

# 38. Security Boundaries

The following boundaries must be treated explicitly:

```text
Browser
   │
   │ Untrusted
   ▼
Application
   │
   │ Trusted after validation/authentication
   ▼
Database / Services
```

Anything originating from the browser must be considered untrusted.

This includes:

* IDs
* Roles
* Prices
* Appointment status
* Availability
* User profile information
* Permissions

The server must independently determine authoritative values.

---

# 39. Architectural Rules

The following rules are mandatory unless a documented architectural decision overrides them.

1. Never trust client-provided authorization information.
2. Never store plaintext passwords.
3. Never expose secrets to the client.
4. Never place database access directly inside UI components.
5. Validate all externally supplied data.
6. Enforce important invariants at the database level where possible.
7. Use transactions for multi-step operations requiring atomicity.
8. Protect patient data using least privilege.
9. Do not log secrets or sensitive patient information.
10. Keep third-party integrations behind adapters/services.
11. Reuse shared UI components.
12. Avoid premature microservices.
13. Use database migrations for schema changes.
14. Test critical patient and appointment workflows.
15. Treat appointment availability as authoritative only after server-side verification.
16. Prefer accessible and semantic UI patterns.
17. Optimize public pages for SEO and performance.
18. Keep business logic independent from presentation.
19. Make failure states explicit in the UI.
20. Document significant architectural changes.

---

# 40. Architecture Decision Records

Significant architectural decisions should be documented using Architecture Decision Records (ADRs).

Recommended structure:

```text
docs/
└── adr/
    ├── 0001-architecture-style.md
    ├── 0002-authentication.md
    ├── 0003-database.md
    └── 0004-notification-architecture.md
```

Each ADR should contain:

```text
# Decision

## Context

## Options Considered

## Decision

## Consequences
```

This prevents important architectural decisions from being lost as the project evolves.

---

# 41. Phase-Based Architecture Evolution

Punarvasu will be implemented incrementally.

Each implementation phase must:

1. Understand the existing architecture.
2. Preserve previously established boundaries.
3. Avoid unnecessary rewrites.
4. Add only the capabilities required for the phase.
5. Update architecture documentation when architectural decisions change.
6. Add or update tests for affected functionality.
7. Verify that existing functionality continues to work.
8. Avoid introducing duplicate implementations.

A phase must not casually change technology, database architecture, authentication architecture, or major design patterns established by earlier phases.

If a major architectural change becomes necessary, document the reason before implementing it.

---

# 42. Definition of Architectural Completion

The architecture is considered healthy when:

* Modules have clear responsibilities.
* Business logic is not duplicated.
* Sensitive data is protected.
* Authorization is enforced server-side.
* Database integrity is maintained.
* Appointment operations are transactionally safe.
* External integrations are replaceable.
* Critical workflows are tested.
* Public pages are performant and SEO-friendly.
* UI components are reusable and accessible.
* Errors are observable without exposing sensitive information.
* New features can be added without significant architectural restructuring.

---

# 43. Guiding Principle

The architecture should remain **simple enough to understand, strict enough to protect patient data, modular enough to evolve, and polished enough to support a premium healthcare experience.**

Punarvasu should not optimize for architectural complexity.

It should optimize for:

> **Reliability + Security + Maintainability + Patient Experience + Long-Term Extensibility**
