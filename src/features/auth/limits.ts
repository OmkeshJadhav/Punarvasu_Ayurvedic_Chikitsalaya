/**
 * Authentication field limits, and the one sentence derived from them.
 *
 * ## Why this is its own module (Phase 20)
 *
 * These four values used to live in `./validation`, beside the schemas that
 * enforce them. That is the natural place for them and it was costing the two
 * statically rendered authentication pages **391 KB of JavaScript**.
 *
 * The chain was not obvious, which is why it survived fourteen phases:
 *
 * ```text
 *   register-form.tsx        "use client"
 *     -> features/auth/content.ts        for AUTH_FIELDS and AUTH_PAGES
 *          -> features/auth/validation.ts   for PASSWORD_REQUIREMENT_TEXT
 *               -> zod
 * ```
 *
 * A client component asked for a sentence and two integers; a bundler has no
 * way to give it those without the module they were declared in, and that
 * module builds Zod schemas at import time. `/auth/register` and
 * `/auth/forgot-password` therefore shipped the whole of Zod - measured at
 * 391 KB raw, 58 KB brotli - to render a form whose only client-side use of it
 * was `maxLength` on three inputs.
 *
 * Nothing about the validation design changed. `./validation` imports these
 * and re-exports them, so every existing server-side and test import still
 * resolves, and the schemas are still the single definition of what a valid
 * password is. What changed is that the browser can now reach the numbers
 * without reaching the schema builder.
 *
 * **Keep this module free of imports.** Its entire value is that importing it
 * costs a client bundle nothing, and one import of a schema library, a
 * database type or a server utility would silently undo that. There is a test
 * asserting exactly this.
 */

/**
 * Minimum password length.
 *
 * **This must equal `auth.minimum_password_length` in the Supabase project.**
 * `supabase/config.toml` sets it to 10 for the local stack; the hosted project
 * must be configured to match (see `docs/progress/progress_phase_06.md`).
 *
 * `phase_06.md` section 10 is explicit that the requirement shown to a user
 * has to be the requirement the backend enforces. Naming it once and rendering
 * the copy from it is what makes that true rather than aspirational: if the
 * number changes, the sentence under the field changes with it.
 */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Maximum password length.
 *
 * Supabase hashes with bcrypt, which uses only the first 72 bytes. Accepting a
 * longer password would silently ignore everything past that, so a user who
 * chose a 90-character passphrase would be authenticated by a prefix of it.
 * Rejecting is honest; truncating is not.
 */
export const PASSWORD_MAX_LENGTH = 72;

export const FULL_NAME_MAX_LENGTH = 120;

/** Copy shown beside the password field. Derived, never retyped. */
export const PASSWORD_REQUIREMENT_TEXT = `At least ${PASSWORD_MIN_LENGTH} characters. Longer is stronger — a short phrase works well.`;
