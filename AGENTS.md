# AGENTS.md

## Punarvasu — AI Coding Agent Guidelines

This document defines how AI coding agents Claude must work on the **Punarvasu** project.

Punarvasu is a premium Ayurvedic clinic website and digital patient-care platform. The application must feel trustworthy, calm, modern, medically responsible, accessible, fast, secure, and production-ready.

Agents must treat this document and the documentation under `docs/` as the source of truth.

Start at `docs/PUNARVASU_MASTER_SPEC.md`, which maps every document and records
what is actually implemented. Phase specifications live in
`docs/implementation-plan/phase_NN.md`; progress is recorded in
`docs/progress/progress_phase_NN.md`.

---

# 1. Core Principle

Do not merely make the requested feature "work."

Every implementation must satisfy all of the following:

* Correct functionality
* Excellent UX
* Premium visual design
* Responsive behavior
* Accessibility
* Security
* Performance
* Maintainability
* Type safety
* Error handling
* Good developer experience
* Production readiness

Avoid quick hacks, unnecessary abstractions, duplicated logic, and temporary implementations presented as final solutions.

---

# 2. Source of Truth

Before making changes, inspect the relevant project documentation.

Priority order:

1. Current phase specification (`docs/implementation-plan/phase_NN.md`)
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md` and `docs/DATABASE.md`
4. `docs/SECURITY.md` and `docs/HEALTHCARE_AND_AI_SAFETY.md`
5. `AGENTS.md`
6. Existing implementation and established project conventions

`docs/SECURITY.md` and `docs/HEALTHCARE_AND_AI_SAFETY.md` are binding on
security, authorization, privacy, healthcare content and clinical AI use. On
those subjects they outrank every other document, including a phase
specification.

If documentation conflicts with existing code, follow the documented product/architecture requirements unless the phase explicitly requires migration or modification.

Never silently introduce architectural decisions that conflict with the documented architecture.

If a requirement is ambiguous, choose the safest, simplest, and most maintainable interpretation. Document significant assumptions.

---

# 3. Phase-Based Development

The project is developed incrementally through phases.

When implementing a phase:

1. Read the complete phase document.
2. Inspect the existing implementation.
3. Understand dependencies on previous phases.
4. Identify reusable components and services.
5. Implement only the scope required for the phase unless a small supporting change is necessary.
6. Do not break functionality from previous phases.
7. Run appropriate validation after implementation.
8. Fix all discovered issues.
9. Update documentation if the implementation changes an architectural decision.
10. Summarize what was implemented and what was validated.

Do not skip directly to future-phase functionality unless explicitly requested.

Avoid creating placeholder functionality merely to make a phase appear complete.

---

# 4. Before Editing Code

Always inspect the repository before modifying files.

At minimum, understand:

* Project structure
* Framework and runtime
* Package manager
* Existing routes
* Existing components
* Existing design system
* Database structure
* Authentication implementation
* API/service layer
* Environment configuration
* Testing setup
* Linting/formatting configuration
* Build configuration

Prefer extending existing patterns over creating parallel patterns.

Do not rewrite working parts of the application without a clear reason.

---

# 5. Technology Principles

Use the technologies already established by the project.

Do not introduce a new framework, library, database, state-management solution, UI library, or infrastructure component unless:

* It is required by the specification, or
* The existing solution cannot reasonably support the requirement.

Before adding a dependency, determine whether the functionality can be implemented cleanly with existing dependencies.

Keep dependencies minimal.

Use stable, well-maintained packages.

---

# 6. Code Quality

Write code that another developer can understand and maintain.

Prefer:

* Small focused functions
* Clear naming
* Strong typing
* Explicit data contracts
* Reusable components
* Predictable control flow
* Composition over duplication
* Early validation
* Centralized business logic
* Consistent error handling

Avoid:

* Huge components
* Deeply nested conditionals
* Magic numbers
* Magic strings
* Duplicate business logic
* Unnecessary abstractions
* Premature optimization
* Dead code
* Commented-out code
* `any` unless genuinely unavoidable
* Ignoring TypeScript errors
* Swallowing exceptions

Comments should explain **why**, not simply repeat what the code does.

---

# 7. TypeScript Rules

If the project uses TypeScript:

* Maintain strict type safety.
* Prefer interfaces/types that represent real domain concepts.
* Avoid `any`.
* Avoid unsafe type assertions.
* Validate external data before using it.
* Type API request and response contracts.
* Type database/service boundaries.
* Use discriminated unions where appropriate.
* Keep shared types in appropriate shared locations.

Never use TypeScript type assertions simply to silence an error.

If a type assertion is unavoidable, understand and document why it is safe.

---

# 8. React / Frontend Guidelines

Follow the existing framework conventions.

Components should have clear responsibilities.

Prefer:

* Server-side rendering where appropriate
* Server components where supported and useful
* Client components only when client-side behavior is required
* Reusable UI primitives
* Semantic HTML
* Accessible interactive elements
* Proper loading and error states
* URL-driven state where appropriate
* Form validation at both client and server boundaries

Avoid unnecessarily turning entire pages into client-side components.

Do not place business logic directly inside presentation components when it belongs in a service/domain layer.

---

# 9. UI/UX Direction

Punarvasu is a premium Ayurvedic healthcare brand.

The visual language should communicate:

* Trust
* Wellness
* Authenticity
* Calmness
* Nature
* Professional healthcare
* Premium quality
* Simplicity

The design must not look like a generic template, admin dashboard, or typical medical portal.

Prefer:

* Generous whitespace
* Strong visual hierarchy
* Elegant typography
* Restrained use of color
* Natural visual cues
* High-quality imagery
* Subtle motion
* Clear calls to action
* Consistent spacing
* Consistent component styling

Avoid:

* Excessive gradients
* Excessive animations
* Clutter
* Excessive shadows
* Too many colors
* Tiny typography
* Decorative elements that reduce usability
* Generic stock-template layouts

The interface should feel premium without becoming visually complicated.

---

# 10. Responsive Design

Every UI feature must work properly on:

* Mobile phones
* Tablets
* Laptops
* Large desktop screens

Do not treat mobile as an afterthought.

Check:

* Navigation
* Forms
* Tables
* Cards
* Dialogs
* Images
* Typography
* Buttons
* Spacing
* Touch targets
* Horizontal overflow

Avoid fixed widths that unnecessarily break smaller screens.

---

# 11. Accessibility

Accessibility is a first-class requirement.

Follow WCAG-oriented practices.

At minimum:

* Use semantic HTML.
* Provide labels for form fields.
* Provide meaningful alt text.
* Maintain sufficient color contrast.
* Ensure keyboard navigation.
* Provide visible focus states.
* Do not rely only on color to communicate meaning.
* Use accessible dialogs/modals.
* Use appropriate ARIA attributes when necessary.
* Ensure interactive elements have accessible names.
* Respect reduced-motion preferences where relevant.

Never sacrifice accessibility for visual appearance.

---

# 12. Forms and Validation

All important forms must have:

* Client-side validation for immediate feedback
* Server-side validation for security and correctness
* Clear field-level errors
* Useful success states
* Loading/submission states
* Protection against duplicate submissions
* Accessible labels and error messaging

Never trust client-side validation alone.

Validate and sanitize data at the server/API boundary.

---

# 13. Authentication and Authorization

Authentication and authorization must be treated as security-critical.

Never assume that hiding a UI element provides authorization.

Every protected server operation must independently verify:

* User authentication
* User identity
* User permissions/role
* Resource ownership where applicable

Follow the authentication architecture defined in `docs/ARCHITECTURE.md` and
the canonical role model and permission matrix in `docs/SECURITY.md` §6.

Never expose:

* Service-role credentials
* Private API keys
* Secrets
* Database credentials
* Internal tokens

to the browser.

Never hard-code secrets in source code.

---

# 14. Healthcare and Patient Data

Punarvasu deals with healthcare-related information.

Treat patient information as highly sensitive.

Examples include:

* Patient identity
* Contact details
* Medical history
* Symptoms
* Treatment information
* Prescriptions
* Consultation notes
* Reports
* Appointments
* Payments associated with care

Never expose patient information unnecessarily.

Use least-privilege access.

Do not log sensitive patient information.

Avoid putting sensitive healthcare information into:

* Browser console logs
* Server logs
* Analytics events
* Error messages
* URLs
* Query parameters
* Client-side storage

unless explicitly required and appropriately protected.

---

# 15. Ayurvedic Content Safety

The website may contain Ayurvedic health and wellness information.

Content must be presented responsibly.

Do not make unsupported claims such as:

* Guaranteed cures
* Guaranteed results
* "100% safe"
* "Works for everyone"
* Claims that a treatment definitely replaces necessary medical care

Avoid presenting general wellness information as individualized medical advice.

Where appropriate, encourage consultation with a qualified practitioner.

The application is a digital platform for an Ayurvedic clinic, not a substitute for professional diagnosis or emergency medical care.

---

# 16. Database Guidelines

Follow the schema and data model defined in `docs/DATABASE.md`.

Database design should prioritize:

* Data integrity
* Referential integrity
* Appropriate indexes
* Correct constraints
* Least-privilege access
* Clear relationships
* Auditability where required

Do not store derived data when it can safely be calculated unless there is a documented performance or architectural reason.

Use migrations for schema changes.

Never manually modify production database structures as part of normal development workflow.

---

# 17. API and Service Layer

API endpoints/services must:

* Validate inputs
* Authenticate requests where required
* Authorize access
* Return predictable responses
* Handle failures gracefully
* Avoid leaking internal implementation details
* Avoid leaking sensitive data
* Use appropriate HTTP semantics where applicable

Business rules should live in the appropriate service/domain layer rather than being duplicated across UI components and API handlers.

---

# 18. Error Handling

Errors must be handled intentionally.

Users should see helpful messages such as:

> "We couldn't complete your appointment request. Please try again."

They should not see raw:

* Stack traces
* Database errors
* Internal exception messages
* SQL errors
* Secret/configuration information

Developers should have enough structured information to diagnose failures without exposing sensitive data.

Always handle expected failure states.

---

# 19. Loading, Empty, and Error States

Every asynchronous feature should consider:

### Loading state

Clearly communicate that work is in progress.

### Empty state

Explain what the user can do when no data exists.

### Error state

Explain the problem and provide an actionable next step.

### Success state

Clearly confirm important actions.

Never leave users staring at a blank screen.

---

# 20. Security

Treat all external input as untrusted.

Protect against:

* SQL injection
* XSS
* CSRF where applicable
* Broken access control
* IDOR/resource enumeration
* Injection attacks
* Malicious file uploads
* Rate abuse
* Credential leakage
* Sensitive-data exposure

Do not construct SQL queries using raw user input.

Use parameterized queries or the project's safe database abstraction.

Validate uploaded files by type, size, and content where applicable.

---

# 21. Environment Variables

Use environment variables for configuration and secrets.

Never commit secrets.

Maintain an appropriate example environment file such as:

`.env.example`

The example file must contain variable names and safe placeholder values only.

Never expose server-only environment variables through client-side configuration.

---

# 22. Logging

Logs should be useful, structured, and safe.

Do not log:

* Passwords
* Authentication tokens
* Session secrets
* API keys
* Full patient records
* Sensitive medical information
* Payment credentials

Use meaningful contextual identifiers where appropriate without exposing sensitive information.

---

# 23. Performance

Performance is part of product quality.

Consider:

* Image optimization
* Lazy loading
* Code splitting
* Server rendering
* Caching
* Database indexes
* Efficient queries
* Avoiding unnecessary API calls
* Avoiding unnecessary re-renders
* Minimizing JavaScript shipped to the browser

Do not optimize blindly.

Prefer measurable improvements over premature optimization.

---

# 24. SEO

Public-facing clinic pages should be SEO-friendly.

Where appropriate, implement:

* Meaningful page titles
* Meta descriptions
* Semantic headings
* Canonical URLs
* Open Graph metadata
* Structured data/schema markup where appropriate
* Descriptive URLs
* Image alt text
* Sitemap
* Robots configuration

SEO implementation must not compromise accessibility or performance.

---

# 25. Images and Assets

Use high-quality, optimized assets.

For healthcare imagery:

* Prefer authentic and trustworthy visuals.
* Avoid misleading medical imagery.
* Avoid excessive decorative stock photography.
* Optimize image sizes.
* Provide appropriate alt text.
* Do not use copyrighted assets without appropriate rights.

If an image is not essential to understanding the page, decorative images should be treated appropriately for accessibility.

---

# 26. Animation and Motion

Motion should communicate hierarchy and feedback rather than exist purely for decoration.

Prefer:

* Subtle transitions
* Gentle page entrance
* Hover/focus feedback
* Meaningful state transitions

Avoid:

* Excessive animations
* Long animations
* Distracting effects
* Animations that interfere with navigation

Respect `prefers-reduced-motion`.

---

# 27. Testing

Every meaningful feature should be tested at the appropriate level.

Consider:

### Unit tests

For isolated business logic and utilities.

### Integration tests

For services, database interactions, authentication, and important workflows.

### End-to-end tests

For critical user journeys.

Important Punarvasu flows should eventually include scenarios such as:

* Authentication
* Appointment booking
* Patient onboarding
* Patient profile management
* Practitioner workflows
* Treatment-related workflows
* Payment workflows where applicable
* Admin workflows

Tests must verify both successful and failure paths.

---

# 28. Validation Before Completion

Before declaring a task complete, run the project's available checks.

At minimum, where applicable:

* Type checking
* Linting
* Formatting
* Unit tests
* Integration tests
* Build
* Relevant end-to-end tests

Do not claim a check passed unless it was actually run.

If a check cannot be run, explicitly state that.

---

# 29. Browser/UI Verification

For UI changes, do not rely only on code inspection.

Where browser tooling is available:

1. Start the application.
2. Open the relevant page.
3. Test the primary user flow.
4. Test responsive layouts.
5. Check console errors.
6. Check network/API failures where relevant.
7. Verify loading/error/success states.
8. Verify keyboard accessibility for important interactions.

Fix visual or functional regressions before finishing.

---

# 30. Git Discipline

Keep changes focused.

Do not:

* Modify unrelated files
* Reformat the entire project unnecessarily
* Delete working functionality
* Replace existing architecture without justification

Prefer small, coherent changes.

Do not commit generated files, secrets, local environment files, or build artifacts. I will do them myself.

---

# 31. Documentation

Update documentation when implementation changes:

* Architecture
* Data model
* API contracts
* Authentication behavior
* Environment variables
* Major workflows
* Deployment requirements
* Important design decisions

Do not allow documentation to describe behavior that no longer exists.

---

# 32. Reuse Existing Components

Before creating a new component, search for an existing component that provides similar functionality.

Reuse existing:

* Buttons
* Inputs
* Form controls
* Cards
* Dialogs
* Toasts
* Navigation
* Typography
* Layout primitives
* Icons
* Design tokens

If an existing component is insufficient, improve it when doing so benefits the broader system.

Avoid creating multiple components that solve essentially the same problem.

---

# 33. Design System Consistency

Do not introduce arbitrary styling values throughout the application.

Prefer the project's design tokens for:

* Colors
* Typography
* Spacing
* Border radius
* Shadows
* Breakpoints
* Transitions

New design tokens should be introduced only when they represent a meaningful reusable concept.

The entire application should feel like one cohesive product.

---

# 34. Mobile-First Thinking

When building responsive interfaces, consider the smallest practical screen first.

Then progressively enhance for:

* Tablet
* Laptop
* Desktop
* Large displays

Important actions must remain easy to reach with touch.

Avoid hover-only functionality.

---

# 35. Accessibility and UX Are Not Optional Polish

Do not defer accessibility, error handling, responsive design, or loading states as "future improvements" unless the phase explicitly scopes them out.

A feature is incomplete if it only works in the ideal scenario.

---

# 36. Avoid Overengineering

Do not build infrastructure that the current product does not need.

Examples of unnecessary complexity:

* Excessive abstraction layers
* Custom state-management frameworks when local state is enough
* Generic systems for one-off behavior
* Multiple dependencies for simple functionality
* Premature microservices
* Overly complex database structures

Choose the simplest architecture that satisfies current requirements while remaining extensible.

---

# 37. Do Not Hide Problems

If you encounter:

* A failing migration
* A broken dependency
* A contradictory requirement
* An architectural problem
* A security concern
* A test failure
* An environment issue

Do not silently work around it in a way that creates technical debt.

Investigate it, fix it if within scope, or clearly report it.

---

# 38. Agent Decision Framework

When deciding between multiple implementation approaches, prioritize:

1. Security
2. Correctness
3. Patient/data safety
4. User experience
5. Accessibility
6. Maintainability
7. Performance
8. Simplicity
9. Developer convenience

Never choose developer convenience at the expense of security or correctness.

---

# 39. Working With Existing Code

Before changing existing code:

* Understand why it exists.
* Identify dependencies.
* Check whether it is used elsewhere.
* Preserve backward compatibility where appropriate.
* Avoid breaking public APIs without a documented reason.

Do not assume code is unused merely because it appears unused in one location.

---

# 40. Dependency Changes

When adding a dependency:

1. Check whether the project already has an equivalent capability.
2. Prefer established, maintained packages.
3. Consider bundle/runtime impact.
4. Consider security implications.
5. Use the project's package manager.
6. Update lockfiles correctly.
7. Verify the build after installation.

Do not add dependencies merely to save a few lines of code.

---

# 41. API Keys and Secrets

If credentials or secrets are needed:

* Never invent real credentials.
* Never commit secrets.
* Never place secrets in frontend code.
* Use environment variables.
* Update `.env.example`.
* Clearly identify which variables are server-only.

If a feature cannot be safely implemented without credentials, create the appropriate configuration boundary rather than hard-coding values.

---

# 42. Data Privacy by Default

Collect and expose only the information required for a feature.

Prefer:

* Minimal data collection
* Minimal data exposure
* Least privilege
* Explicit authorization
* Safe defaults
* Clear retention considerations

Privacy should be considered during feature design, not after implementation.

---

# 43. AI Agent Behavior

AI agents must:

* Inspect before modifying.
* Reuse before creating.
* Validate before assuming.
* Test before declaring completion.
* Preserve existing functionality.
* Keep changes scoped.
* Explain meaningful architectural decisions.
* Never fabricate test results.
* Never fabricate implementation status.
* Never claim a feature works without validation.
* Never silently weaken security to make a feature work.

When unsure, inspect the repository and documentation before guessing.

---

# 44. Completion Checklist

Before reporting a task as complete, verify:

* [ ] Requirements were understood.
* [ ] Relevant documentation was reviewed.
* [ ] Existing implementation was inspected.
* [ ] Existing patterns/components were reused where appropriate.
* [ ] Feature works as intended.
* [ ] Error states are handled.
* [ ] Loading states are handled.
* [ ] Empty states are handled where relevant.
* [ ] Authentication/authorization is correct.
* [ ] Sensitive data is protected.
* [ ] Responsive behavior was considered.
* [ ] Accessibility was considered.
* [ ] SEO was considered for public pages.
* [ ] No secrets were introduced.
* [ ] No unnecessary dependencies were added.
* [ ] Type checking passes.
* [ ] Linting passes.
* [ ] Tests pass where applicable.
* [ ] Production build passes where applicable.
* [ ] Documentation was updated where necessary.
* [ ] No unrelated files were unnecessarily modified.

---

# 45. Final Response Format

After completing a task, provide a concise summary containing:

## Implemented

List the major changes.

## Files Changed

List important files that were created or modified.

## Validation

List the checks actually performed and their results.

Example:

* TypeScript: Passed
* ESLint: Passed
* Tests: Passed
* Production build: Passed
* Browser verification: Completed

## Notes

Mention:

* Important design decisions
* Assumptions
* Known limitations
* Anything that requires manual configuration

Never report a check as passed if it was not actually executed.

---

# 46. Golden Rule

**Build Punarvasu as a real production healthcare product, not as a demo application.**

Every feature should be:

> Beautiful enough to inspire trust, simple enough to use effortlessly, robust enough for production, secure enough for sensitive healthcare data, and maintainable enough for a team to evolve.

When in doubt, choose the solution that improves **trust, safety, usability, accessibility, and long-term maintainability**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
