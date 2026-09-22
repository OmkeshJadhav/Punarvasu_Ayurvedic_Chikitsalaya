# Punarvasu

A premium Ayurvedic clinic website and digital patient-care platform.

Punarvasu combines a public clinic presence — treatments, philosophy,
practitioners, articles, contact and appointment booking — with an
authenticated platform used by patients, receptionists, doctors and
administrators.

It is healthcare software. It handles patient identity, appointments, clinical
records, prescriptions and medical documents, and is built to the security and
privacy standards that implies.

> **Project status: Phase 01 complete — technical foundation.**
> Supabase clients, typed configuration, error handling, logging, validation,
> testing and the migration workflow are in place. There is still no
> authentication, no database schema and no patient-facing feature. See
> [`docs/PUNARVASU_MASTER_SPEC.md`](docs/PUNARVASU_MASTER_SPEC.md) for the
> current inventory.

---

## Getting started

Requires Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Open <http://localhost:3000>.

`.env.local` is git-ignored and must never be committed. `.env.example`
contains placeholder values only.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |
| `npm run format` / `format:check` | Prettier |
| `npm run security:scan-bundle` | Fail if a server-only secret reached the browser bundle (run after `build`) |
| `npm run db:migration -- <name>` | Create a migration |
| `npm run db:push` | Apply migrations to the linked project |
| `npm run db:types` | Regenerate `src/types/database.ts` |

Database workflow details are in [`supabase/README.md`](supabase/README.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Supabase (auth, PostgreSQL, storage) · Zod · Vitest

Application code lives in `src/`, with `@/*` mapped to `./src/*`.

---

## Documentation

Start with **[`docs/PUNARVASU_MASTER_SPEC.md`](docs/PUNARVASU_MASTER_SPEC.md)**,
which indexes everything below and records what is actually built.

| Document | Covers |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | How to work in this repository |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | Product areas, users, requirements |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design and folder structure |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Data model, RLS, clinical history |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model, roles, permissions |
| [`docs/HEALTHCARE_AND_AI_SAFETY.md`](docs/HEALTHCARE_AND_AI_SAFETY.md) | Health content and clinical AI rules |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Visual language and components |
| [`docs/QA_STRATEGY.md`](docs/QA_STRATEGY.md) | Testing strategy and quality gates |

Work proceeds in phases. Specifications live in
[`docs/implementation-plan/`](docs/implementation-plan/); outcomes are recorded
in [`docs/progress/`](docs/progress/).

## Contributing rules that are not optional

* Authorization is enforced on the server and in the database, never by hiding
  UI.
* Secrets never enter source control; the Supabase service-role key never
  reaches the browser.
* Patient data stays out of URLs, logs and analytics.
* Clinical records are append-only; issued prescriptions are immutable.
* Never fabricate clinical or clinic information — not even as sample data.

The full set is in `docs/PUNARVASU_MASTER_SPEC.md` §5.
