/**
 * Punarvasu motion language.
 *
 * Four categories, and nothing outside them:
 *
 *   micro       - 150ms. Hover, focus, press, toggle. Feedback that the
 *                 interface received an action.
 *   entrance    - 420ms. A section or card arriving. Used once per element,
 *                 never on scroll-back.
 *   surface     - 240ms. Dialogs, sheets, popovers, accordions opening.
 *   feedback    - 240ms. A toast or a status change appearing.
 *
 * Everything here is CSS. There is deliberately no animation library: the
 * foundation needs transitions and short keyframes, both of which the platform
 * does better than JavaScript and without shipping a runtime. Radix exposes
 * `data-state` attributes, so open/close motion is expressible in CSS too.
 * `docs/DESIGN_SYSTEM.md` section 41 records this decision.
 *
 * Reduced motion is handled globally in `globals.css`: durations collapse to
 * ~0 and nothing here needs to branch. Transforms still resolve to their end
 * state, so no element is left mid-animation.
 */

/**
 * Hover, focus and press feedback for an interactive surface.
 *
 * Restricted to `colors` and `transform` so a browser never animates layout.
 */
export const MOTION_MICRO =
  "transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-fast) ease-natural";

/** A section or card arriving on the page. Pairs with `<Reveal />`. */
export const MOTION_ENTRANCE = "motion-safe:animate-rise-in";

/** An overlay surface - dialog, sheet, popover, accordion panel. */
export const MOTION_SURFACE =
  "transition-[opacity,transform] duration-(--duration-normal) ease-natural";

/**
 * The press affordance shared by buttons and interactive cards.
 *
 * A 1px settle rather than a scale: scaling text on press looks cheap and
 * blurs sub-pixel glyph rendering.
 */
export const MOTION_PRESS = "active:translate-y-px";
