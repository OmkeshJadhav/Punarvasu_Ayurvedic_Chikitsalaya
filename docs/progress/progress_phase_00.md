## PHASE 00 — Project Discovery & Engineering Constitution

Status:
COMPLETED

Completed On:
2026-09-17

Summary:
Inspected the existing repository, established the engineering foundation for
all future phases, and resolved conflicts between the pre-existing
documentation and the actual repository state. No application features were
implemented.

---

### Repository assessment

The repository was **not** empty, but contained no application:

* Next.js 16.3.4 (App Router), React 19.2.8, TypeScript 5 with `strict: true`
* Tailwind CSS v4 via `@tailwindcss/postcss`
* npm, `package-lock.json` committed
* ESLint 9 flat config (`eslint-config-next`) — passing
* `app/layout.tsx` and `app/page.tsx` — unmodified create-next-app scaffold
* Substantial pre-existing documentation: `ARCHITECTURE.md`, `PRODUCT_SPEC.md`,
  `DESIGN_SYSTEM.md`, `SECURITY.md`, `QA_STRATEGY.md` (~148 KB total)

Absent: Supabase, database schema, migrations, authentication, API/service
layer, components, design tokens, tests, CI, `.env.example`, and any data
architecture document.

Working functionality preserved: the scaffold builds and serves. No
application code was modified in this phase.

---

### Implemented

* Created the missing data architecture document covering entities, ownership,
  RLS, clinical-record and prescription history semantics, private file
  storage, appointment concurrency and migration rules.
* Created the healthcare content and clinical AI safety policy — this was
  entirely absent; existing docs covered only AI *coding agents*, not AI
  operating on patient data.
* Established the canonical four-role model and preliminary permission matrix,
  resolving a three-way conflict between existing documents.
* Recorded the true repository state in `ARCHITECTURE.md` §1.1 so architectural
  intent is not mistaken for implemented behaviour.
* Decided the folder structure (`src/`) and documented the target tree,
  boundaries and feature-module conventions.
* Created `.env.example` with placeholders only, classifying every variable as
  public or server-only.
* Created the master specification as the documentation entry point.
* Fixed cross-document references that pointed at non-existent file paths.

---

### Files Added

* `.env.example`
* `docs/DATABASE.md`
* `docs/HEALTHCARE_AND_AI_SAFETY.md`
* `docs/PUNARVASU_MASTER_SPEC.md` (was an empty file)
* `docs/progress/progress_phase_00.md` (this file, was empty)

### Files Modified

* `AGENTS.md` — corrected source-of-truth paths; added security/safety
  precedence rule
* `docs/ARCHITECTURE.md` — added §1.1 current repository state; replaced the
  conflicting role list; replaced the folder structure with a decided target
  tree and boundary rules; pointed §8 at `DATABASE.md`
* `docs/SECURITY.md` — replaced §6 Roles with the canonical four-role model,
  role rules, permission matrix and the seven authorization questions
* `docs/PRODUCT_SPEC.md` — real product description (§1.2); real target users
  and product-area dependency map (§5, §5A); rewrote §39 documentation
  hierarchy with a precedence order
* `README.md` — replaced create-next-app boilerplate with project orientation
* `package.json` — added `typecheck` script (referenced by existing docs but
  missing)
* `.gitignore` — `.env*` was excluding `.env.example`; added a negation so the
  example file can be committed

---

### Architectural decisions

1. **Preserve the existing stack.** Next.js App Router, TypeScript strict,
   Tailwind v4 and npm match the intended direction; no reason to change.
2. **Adopt `src/`** and re-map `@/*` to `./src/*`. Cheap now (two scaffold
   files), expensive later. Phase 01 performs the migration.
3. **Four roles: `patient`, `receptionist`, `doctor`, `admin`.** One role per
   user. `SUPER_ADMIN` deferred — plausible future need, no current purpose.
4. **`SECURITY.md` §6 is the single canonical role definition.** Other
   documents link rather than restate.
5. **Receptionist is operational, never clinical** — a hard boundary in both
   RLS and server checks.
6. **Doctor clinical access is scoped by treatment relationship**, not by role
   alone.
7. **Appointment non-overlap is a database invariant**, expressed as a
   PostgreSQL exclusion constraint. Application-level check-then-insert is
   explicitly insufficient.
8. **Clinical records are append-only**; finalized visits are amended, never
   edited. Issued prescriptions are immutable and superseded by new ones.
9. **Documentation naming stays UPPERCASE** (`DATABASE.md`, not
   `database.md`), matching the five pre-existing documents, rather than the
   lowercase names in the phase spec. Renaming five files on a
   case-insensitive filesystem tracked by a case-sensitive VCS creates more
   risk than the naming inconsistency it removes.
10. **Dependencies are added by the phase that needs them**, not in advance.

---

### Database Changes

None. No schema, no migrations, no database code — consistent with Phase 00
§30. `docs/DATABASE.md` is a planning document; Phase 02 introduces the first
migrations.

---

### Security Changes

No executable security code (there is none to secure yet). Documented and
established:

* Canonical role model, permission matrix, and the seven authorization
  questions every feature must answer
* RLS as mandatory and deny-by-default; service-role key constraints
* Private storage with short-lived signed URLs for patient documents
* Environment variable classification (public vs server-only) in
  `.env.example`
* Audit logging scope; insert-only `audit_logs`
* Clinical AI constraints and structural human review

Fixed: `.gitignore` excluded `.env.example`, which would have blocked the
documented configuration boundary from ever being committed.

---

### Risks discovered

| Risk | Severity | Disposition |
| --- | --- | --- |
| `phase_02.md`–`phase_20.md` are zero-byte | High for planning | Flagged. Scope beyond Phase 01 is unspecified. |
| Pre-existing docs described roles three different ways | High | Resolved — canonical model in `SECURITY.md` §6. |
| Pre-existing docs described a `src/` tree that does not exist | Medium | Resolved — real state recorded, migration assigned to Phase 01. |
| `.gitignore` excluded `.env.example` | Medium | Fixed. |
| `docs/PROMPT.md` references `agent.md`, `phases/`, `IMPLEMENTATION_PLAN.md`, `PROGRESS.md` — none exist | Low | Left unmodified; it is an author-maintained prompt file being actively edited. Flagged for the author. |
| Scaffold debt: `Create Next App` metadata, template page, placeholder CSS tokens, `font-family: Arial` contradicting `next/font` | Low | Deliberately not fixed in a documentation phase. Assigned to Phase 01. |
| No test framework | Medium | Phase 01 scope. |
| Appointment double-booking | High (future) | Mitigation specified: database exclusion constraint. |

---

### Deferred decisions

* Exact column definitions, types and nullability for every table
* Whether Ayurvedic assessment data is structured columns or validated JSONB
* Soft-delete mechanism (status column vs `deleted_at`)
* Patient data retention and deletion policy (has legal inputs)
* Multi-branch tenancy — must not be prevented, is not implemented
* Patient search strategy (full-text vs trigram)
* Validation library, test runner and E2E tool selection (Phase 01)
* Whether Zustand is needed at all
* Concrete design tokens — `DESIGN_SYSTEM.md` defines direction; Phase 01
  implements
* `SUPER_ADMIN` role

---

### Testing

* `npm run typecheck` — PASS (exit 0, no errors)
* `npm run lint` — PASS (exit 0, no warnings)
* `npm run build` — PASS (exit 0; 4 static pages generated, Next.js 16.3.4)
* Secret scan — PASS (no credential patterns in any tracked or new file; no
  `.env` file other than `.env.example`; all example values are placeholders)

Not run, and not applicable in this phase:

* Unit / integration / E2E tests — no test framework exists yet (Phase 01)
* Browser verification — no UI was changed; the application is still the
  unmodified scaffold

---

### Manual Verification

Not applicable. This phase changed documentation and configuration only; no UI
was added or modified, so desktop/mobile/loading/error/empty state
verification has nothing to exercise. The production build was run and passed.

---

### Acceptance criteria

| Criterion | Status | Where |
| --- | --- | --- |
| Existing repository inspected | Met | `ARCHITECTURE.md` §1.1 |
| Existing technology choices documented | Met | `ARCHITECTURE.md` §1.1 |
| Product architecture documented | Met | `PRODUCT_SPEC.md` §5A |
| User roles documented | Met | `SECURITY.md` §6 |
| Preliminary permission model exists | Met | `SECURITY.md` §6 |
| Security principles documented | Met | `SECURITY.md` |
| Healthcare safety principles documented | Met | `HEALTHCARE_AND_AI_SAFETY.md` §1–§4 |
| AI safety principles documented | Met | `HEALTHCARE_AND_AI_SAFETY.md` §5–§11 |
| Database architecture documented | Met | `DATABASE.md` |
| Appointment architecture documented | Met | `DATABASE.md` §11 |
| Clinical record philosophy documented | Met | `DATABASE.md` §7 |
| Prescription history philosophy documented | Met | `DATABASE.md` §8 |
| File-storage security strategy documented | Met | `DATABASE.md` §9 |
| Design philosophy documented | Met | `DESIGN_SYSTEM.md` (pre-existing) |
| UX principles documented | Met | `PRODUCT_SPEC.md` §13–§19 |
| Accessibility principles documented | Met | `DESIGN_SYSTEM.md` §43, `QA_STRATEGY.md` §15 |
| Testing strategy documented | Met | `QA_STRATEGY.md` |
| Expected folder structure documented | Met | `ARCHITECTURE.md` §4 |
| Environment configuration documented | Met | `.env.example` |
| No secrets exposed | Met | Scan clean |
| No unnecessary feature implementation started | Met | No application code changed |

---

### Known Issues

* `phase_02.md` through `phase_20.md` are empty. Scope beyond Phase 01 is
  undefined and must be written before it can be implemented.
* `docs/PROMPT.md` contains stale file paths (left for the author to correct).
* Scaffold branding and placeholder styling remain; scheduled for Phase 01.

---

### Next Phase

PHASE 01 — Technical Foundation & Core Infrastructure

First tasks, in order: migrate to `src/` and re-map `@/*`; install and
configure Supabase with separated server/browser/service-role clients; build
the typed environment config module; replace the scaffold layout, page and
CSS tokens; establish error handling, logging, validation and the testing
foundation.
