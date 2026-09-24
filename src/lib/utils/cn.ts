import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The project's fluid type scale, as declared by `--text-*` in `globals.css`.
 *
 * `tailwind-merge` has to be told about these explicitly. It resolves each
 * class to exactly one conflict group by matching against Tailwind's *default*
 * scale, and `text-h2` matches none of it - so it was being filed under
 * `text-color` alongside `text-foreground`, and the later colour silently
 * deleted the size:
 *
 *   cn("text-h2", "text-foreground")  ->  "text-foreground"
 *
 * The effect was invisible in review and obvious on screen: every heading
 * rendered through `SectionHeader`, `CardTitle` or `CardDescription` fell back
 * to the inherited 16px body size, because each of those composes a size and a
 * colour in one `cn()` call. Adding a step here is the whole fix; nothing else
 * has to change.
 *
 * Keep this list in step with the `--text-*` keys in `globals.css`.
 * `src/lib/utils/cn.test.ts` fails if a step goes missing.
 */
export const TYPE_SCALE_STEPS = [
  "display-2xl",
  "display-xl",
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "body-lg",
  "body",
  "body-sm",
  "caption",
  "label",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_SCALE_STEPS] }],
    },
  },
});

/**
 * Merges class names, letting a caller's utility win over a component's
 * default for the same CSS property.
 *
 * Without the merge step, `<Button className="px-8">` would emit both `px-4`
 * and `px-8` and the winner would depend on stylesheet order rather than on
 * intent.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
