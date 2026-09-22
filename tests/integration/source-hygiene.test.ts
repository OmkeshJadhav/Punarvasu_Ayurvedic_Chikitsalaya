import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source files contain no invisible control characters.
 *
 * ## Why this exists
 *
 * Phase 06 recorded that `prettier --write` rewrites a unicode escape inside
 * a **regex character class** into the literal byte it denotes — putting a
 * raw NUL into the source of a security check, invisible in a diff and
 * invisible in review. That was fixed at the time by rewriting the check.
 *
 * Phase 14 found the same corruption twice more, and neither had been
 * noticed:
 *
 *   * `tests/integration/reception-actions.test.ts` asserted that a
 *     receptionist's refusal message names no role, with
 *     `not.toMatch(/\brole\b/i)`. Both word boundaries had become backspace
 *     bytes, so the pattern was looking for a literal `<BS>role<BS>` and
 *     **matched nothing** — the assertion had been passing for four phases
 *     without testing anything;
 *   * `src/config/permissions.test.ts` had the same thing inside
 *     `/medication|\bai\b|.../`, so the `ai` alternative never matched
 *     either.
 *
 * Both are the kind of defect that only a scan finds: the tests were green,
 * the lint was clean, and the source *looked* right in an editor that
 * renders a backspace as nothing.
 *
 * ## The rule
 *
 * No C0 or C1 control character in any source file, other than tab, carriage
 * return and newline. A pattern that genuinely needs one builds it from a
 * string — `new RegExp("\\bfoo\\b")` — where the backslash is escaped in the
 * source and the formatter leaves it alone.
 */

const ROOTS = ["src", "tests", "scripts", "supabase"] as const;
const EXTENSIONS = /\.(ts|tsx|mts|mjs|js|jsx|sql|css|json)$/;
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

function sourceFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (SKIP.has(entry)) continue;

    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (EXTENSIONS.test(entry)) {
      found.push(path);
    }
  }

  return found;
}

/** Tab, newline and carriage return are the three that belong in a file. */
function isForbiddenControl(codePoint: number): boolean {
  if (codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d) {
    return false;
  }
  return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);
}

describe("source hygiene", () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root));

  it("finds the files it is meant to be scanning", () => {
    // A scan that silently matches nothing is worse than no scan. This is
    // the guard against the guard.
    expect(files.length).toBeGreaterThan(100);
  });

  it("contains no invisible control characters", () => {
    const offences: string[] = [];

    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      const lines = contents.split("\n");

      lines.forEach((line, index) => {
        for (const character of line) {
          const codePoint = character.codePointAt(0) ?? 0;
          if (isForbiddenControl(codePoint)) {
            offences.push(
              `${file}:${index + 1} contains U+${codePoint
                .toString(16)
                .toUpperCase()
                .padStart(4, "0")}`,
            );
            return;
          }
        }
      });
    }

    expect(offences).toEqual([]);
  });
});
