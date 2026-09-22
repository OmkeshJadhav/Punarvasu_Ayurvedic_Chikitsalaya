import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { cn, TYPE_SCALE_STEPS } from "./cn";

/**
 * `cn` is three lines of glue, and a defect in it is invisible in review and
 * visible on every page - the custom type scale was being deleted by the
 * colour class sitting next to it, so headings rendered at body size across
 * the whole design system.
 */
describe("cn", () => {
  it("keeps a type-scale class alongside a text colour", () => {
    // The exact composition used by SectionHeader, CardTitle and
    // CardDescription. Before the font-size group was declared, the size was
    // silently dropped here.
    const result = cn("text-h2", "text-foreground font-normal");

    expect(result).toContain("text-h2");
    expect(result).toContain("text-foreground");
  });

  it.each([...TYPE_SCALE_STEPS])(
    "keeps text-%s when a colour is applied with it",
    (step) => {
      expect(cn(`text-${step}`, "text-muted-foreground")).toContain(
        `text-${step}`,
      );
    },
  );

  it("still lets one type-scale class override another", () => {
    // They are now a real conflict group, so the later one must win.
    expect(cn("text-body", "text-h3")).toBe("text-h3");
  });

  it("still lets one text colour override another", () => {
    expect(cn("text-foreground", "text-primary")).toBe("text-primary");
  });

  it("still resolves ordinary Tailwind conflicts", () => {
    expect(cn("px-4", "px-8")).toBe("px-8");
    expect(cn("rounded-md", "rounded-lg")).toBe("rounded-lg");
  });

  it("drops falsy values rather than emitting them", () => {
    expect(cn("px-4", false, undefined, null, "py-2")).toBe("px-4 py-2");
  });
});

/**
 * The list in `cn.ts` is a mirror of the `--text-*` keys in the stylesheet,
 * and a mirror is only useful while it matches.
 */
describe("type scale mirrors globals.css", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
    "utf8",
  );

  it.each([...TYPE_SCALE_STEPS])("--text-%s is declared", (step) => {
    expect(css).toContain(`--text-${step}:`);
  });

  it("declares no type-scale step that cn does not know about", () => {
    const declared = [...css.matchAll(/--text-([a-z0-9-]+):/g)]
      .map((match) => match[1] as string)
      // `--text-h2--line-height` and friends are modifiers on a step, not
      // steps of their own.
      .filter((name) => !name.includes("--"));

    expect([...new Set(declared)].sort()).toEqual([...TYPE_SCALE_STEPS].sort());
  });
});
