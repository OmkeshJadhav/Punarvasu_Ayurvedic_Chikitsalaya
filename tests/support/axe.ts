import axe, { type AxeResults, type RunOptions } from "axe-core";
import { expect } from "vitest";

/**
 * Automated accessibility checking for component tests.
 *
 * axe-core catches a real but limited class of defects: missing accessible
 * names, broken ARIA references, invalid roles, controls with no label,
 * duplicate ids. It cannot judge focus order, keyboard operability or whether
 * a message makes sense - those are asserted explicitly in the component tests
 * alongside this.
 *
 * Colour-contrast rules are disabled here, and not because they are
 * inconvenient: jsdom has no layout or cascade, so axe sees no computed
 * colours and would either report nothing or report nonsense. Contrast is
 * verified against the real token values in
 * `src/lib/design/contrast.test.ts`.
 *
 * Frame traversal is disabled for the same kind of reason. axe reaches into
 * an `<iframe>`'s own document by posting a message to it, and jsdom does not
 * implement that across frames - it throws "Respondable target must be a
 * frame in the current window" the moment a page containing one is swept. The
 * contact page's map is the only such frame, its own accessible name is
 * asserted directly in `tests/components/contact-page.test.tsx`, and the
 * whole page is swept by axe in a real browser where frames do work.
 */
const DISABLED_RULES: RunOptions = {
  // jsdom cannot post a message into a frame. See above.
  iframes: false,
  rules: {
    // No rendering engine, so no colours to measure. Covered by contrast.test.ts.
    "color-contrast": { enabled: false },
    // A component fragment legitimately has no landmark or <h1>; those are
    // page-level concerns, asserted where pages are assembled.
    region: { enabled: false },
  },
};

export async function runAxe(
  container: Element,
  options: RunOptions = {},
): Promise<AxeResults> {
  return axe.run(container, {
    ...DISABLED_RULES,
    ...options,
    rules: { ...DISABLED_RULES.rules, ...options.rules },
  });
}

/**
 * Asserts a container has no axe violations, naming each one when it fails -
 * a bare "expected 2 to be 0" tells a future developer nothing.
 */
export async function expectNoAxeViolations(
  container: Element,
  options?: RunOptions,
): Promise<void> {
  const results = await runAxe(container, options);

  const summary = results.violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => node.target.join(" "))
        .join(", ");
      return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help} [${targets}]`;
    })
    .join("\n");

  expect(summary, summary || undefined).toBe("");
}
