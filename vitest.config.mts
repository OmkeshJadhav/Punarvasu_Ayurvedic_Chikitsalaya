import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Two projects rather than one environment: server logic runs in Node,
    // where it belongs, and only component tests pay for a DOM.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "tests/unit/**/*.test.ts",
            "tests/integration/**/*.test.ts",
            // Phase 19. `phase_19.md` section 168 asks for a dedicated
            // security suite. It is a separate directory rather than more
            // files in `integration/` so that "do the security tests pass?"
            // is one command — `npx vitest run tests/security` — which is
            // what makes it usable as a release gate rather than a search
            // through a hundred and thirty files.
            "tests/security/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", "tests/components/**/*.test.tsx"],
          setupFiles: ["./tests/support/setup-dom.ts"],
          /**
           * Raised from the 5s default for this project only.
           *
           * A whole-page axe sweep - the home page, the services page, an
           * assembled patient or admin screen - walks several thousand nodes
           * in jsdom and legitimately takes seconds. At 5s those tests passed
           * in isolation and failed intermittently in a full run, because
           * Vitest's workers contend for CPU: a real timing dependency on how
           * many other files happen to be running.
           *
           * `docs/QA_STRATEGY.md` section 35 forbids retrying a flaky test
           * without understanding it. The cause here is a timeout set for unit
           * tests being applied to a whole-page accessibility audit, so the
           * timeout is what changes. No assertion is weakened, nothing is
           * retried, and a genuine hang still fails - it just takes longer to
           * say so. The node project keeps the strict default.
           */
          testTimeout: 30_000,
        },
      },
    ],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/support/server-only.ts", import.meta.url),
      ),
    },
  },
});
