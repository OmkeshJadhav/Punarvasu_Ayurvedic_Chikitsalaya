/**
 * Test stub for the `server-only` marker package.
 *
 * `server-only` throws when it is resolved outside a React Server Component
 * bundle, which is exactly the protection we want in the application and
 * exactly what stops a unit test from importing a server module. The stub is
 * mapped in `vitest.config.ts` and changes nothing about the real build: the
 * boundary is still enforced by `next build`.
 */
export {};
