/**
 * Design tokens that code needs to read.
 *
 * The visual source of truth is `src/app/globals.css`. This module exists only
 * for the values that TypeScript genuinely has to know about - breakpoints a
 * hook compares against, durations a timer waits for, contrast pairs a test
 * asserts. Duplicating the whole palette here would create two sources of
 * truth and guarantee they drift.
 *
 * Nothing here should be used for styling. Style with Tailwind utilities,
 * which already resolve to the same tokens.
 */

/**
 * Breakpoints, in pixels, matching `docs/DESIGN_SYSTEM.md` section 12 and
 * Tailwind's defaults. `sm` is the mobile/tablet boundary, `lg` the
 * tablet/desktop boundary.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Motion durations in milliseconds, mirroring `--duration-*`.
 *
 * Use these only where JavaScript must stay in step with CSS - for example
 * unmounting a node after its exit transition. Visual transitions themselves
 * belong in CSS.
 */
export const DURATION = {
  fast: 150,
  normal: 240,
  slow: 420,
} as const;

/**
 * How long a toast stays on screen before dismissing itself.
 *
 * Long enough to read a sentence without hurrying. Errors are not
 * auto-dismissed at all - see `components/ui/toast.tsx`.
 */
export const TOAST_DURATION_MS = 6000;

/**
 * Opacity of the `--scrim` wash that `MediaFrame` paints between a photograph
 * and any text laid over it.
 *
 * These are numbers rather than Tailwind classes because the contrast test
 * composites them against the lightest photograph possible and asserts the
 * result still carries text. A component may not invent a third value: the
 * whole point is that a caller can drop a headline onto an unseen image and
 * know it stays readable.
 *
 *   strong - text sits directly on the image. Clears AA for normal text.
 *   soft   - a caption or a label sits on the image, at large-text size, or
 *            the wash is purely for depth. Clears AA for large text.
 */
export const MEDIA_FRAME_SCRIM_ALPHA = {
  strong: 0.7,
  soft: 0.55,
} as const;

/**
 * The minimum interactive target, in pixels (WCAG 2.2 AA target size and
 * `docs/DESIGN_SYSTEM.md` section 44). Components express this in Tailwind as
 * `min-h-11 min-w-11`; the constant exists so tests can assert it.
 */
export const MIN_TOUCH_TARGET_PX = 44;
