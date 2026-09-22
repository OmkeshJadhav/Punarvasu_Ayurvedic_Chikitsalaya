/**
 * WCAG relative luminance and contrast ratio.
 *
 * Implements the formulae in WCAG 2.2 (Understanding SC 1.4.3). Used by
 * `contrast.test.ts` to hold the Punarvasu palette to AA, so a colour cannot be
 * adjusted for taste and silently drop below the readability floor that a
 * healthcare interface depends on.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

/** Parses `#rrggbb`. Throws on anything else rather than guessing. */
export function parseHex(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match?.[1]) {
    throw new Error(`Expected a #rrggbb colour, received "${hex}"`);
  }
  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

/** Converts one 0-255 sRGB channel to its linear-light value. */
function toLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/** Relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(color: Rgb | string): number {
  const { r, g, b } = typeof color === "string" ? parseHex(color) : color;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Contrast ratio between two colours, from 1:1 to 21:1. */
export function contrastRatio(
  foreground: Rgb | string,
  background: Rgb | string,
): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Composites a translucent colour over an opaque one, the way a browser paints
 * an overlay.
 *
 * Needed because a scrim over a photograph has no single background colour to
 * measure against. The only thing that can be *guaranteed* is the worst case:
 * composite the scrim over the lightest pixel a photograph could contain and
 * check the text against that. Alpha blending happens in gamma-encoded sRGB,
 * which is what the compositor does, so the blend is done on the raw channels
 * and only then converted to linear light by `relativeLuminance`.
 *
 * @param alpha Opacity of the overlay, 0 to 1.
 */
export function compositeOver(
  overlay: Rgb | string,
  base: Rgb | string,
  alpha: number,
): Rgb {
  if (!(alpha >= 0 && alpha <= 1)) {
    throw new Error(`Expected an alpha between 0 and 1, received ${alpha}`);
  }
  const over = typeof overlay === "string" ? parseHex(overlay) : overlay;
  const under = typeof base === "string" ? parseHex(base) : base;
  const blend = (a: number, b: number) =>
    Math.round(a * alpha + b * (1 - alpha));
  return {
    r: blend(over.r, under.r),
    g: blend(over.g, under.g),
    b: blend(over.b, under.b),
  };
}

/**
 * WCAG AA thresholds.
 *
 * `largeText` applies at 18.66px bold or 24px regular and above; `nonText`
 * covers UI component boundaries and meaningful graphics (SC 1.4.11).
 */
export const AA = {
  normalText: 4.5,
  largeText: 3,
  nonText: 3,
} as const;
