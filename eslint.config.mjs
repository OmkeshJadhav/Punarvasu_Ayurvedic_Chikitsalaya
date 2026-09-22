import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno edge functions. `supabase/functions/*/index.ts` targets the Deno
    // runtime and is linted and typechecked by the Supabase CLI on deploy;
    // running the Next.js ruleset over it only produces false positives about
    // globals that genuinely exist there. The pure logic beside it (`lib.ts`)
    // is deliberately NOT ignored.
    "supabase/functions/**/index.ts",
  ]),
  {
    rules: {
      /*
       * A leading underscore means "required by a signature I do not control".
       *
       * Every server action in this codebase is called by `useActionState`,
       * which always passes `(previousState, formData)` — so an action that
       * needs only the form data still has to declare the first parameter,
       * and names it `_previousState`. Ten files already follow that
       * convention.
       *
       * The default `args: "after-used"` happens to permit it whenever a
       * *later* parameter is used, which is why only one call site has ever
       * warned: `markAllNotificationsReadAction` takes no form data at all,
       * so its unused parameter is also its last one. Encoding the convention
       * here makes it hold for that case and for the next one, rather than
       * depending on whether an action happens to need a second argument.
       *
       * `caughtErrors` is left at its default: an unused caught error is a
       * swallowed exception, which is a real finding and not a convention.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
