/**
 * The resolved Punarvasu palette, as hex.
 *
 * This is a *mirror* of the semantic tokens in `src/app/globals.css`, kept for
 * one purpose: automated contrast verification. A CSS custom property is not
 * readable from a Node test, so the pairs that must clear WCAG AA are listed
 * here and asserted in `contrast.test.ts`.
 *
 * If a token changes in `globals.css`, change it here too - the test is the
 * thing that notices. `palette.test.ts` checks the two files agree.
 */

export const PALETTE = {
  background: "#faf6ee",
  foreground: "#3e2723",

  card: "#ffffff",
  cardForeground: "#3e2723",

  muted: "#f3ece0",
  /** The cool alternate band. See `--surface-sage` in `globals.css`. */
  sage: "#e7eae0",
  mutedForeground: "#5a423c",

  secondary: "#ede3d0",
  secondaryForeground: "#3e2723",

  accent: "#e7efe8",
  accentForeground: "#1e3529",

  primary: "#2a473a",
  primaryForeground: "#ffffff",
  primaryHover: "#1e3529",
  primaryActive: "#16281f",

  /**
   * The editorial voice: eyebrow, heading, prose. See the block comment on
   * `--heading` in `globals.css` for why these are not `--primary` and
   * `--foreground`.
   */
  heading: "#1e3529",
  prose: "#2a473a",
  eyebrow: "#8f4a34",

  /**
   * The analytics data mark, and the unfilled remainder behind it. See
   * `--chart-series` in `globals.css` for why a data mark is not `--primary`.
   */
  chartSeries: "#355a49",
  chartTrack: "#ede3d0",

  border: "#e6dccb",
  borderStrong: "#d6c7ad",
  input: "#8d746c",
  ring: "#2a473a",

  success: "#397a55",
  successForeground: "#ffffff",
  successSurface: "#eaf4ed",

  warning: "#8a5410",
  warningForeground: "#ffffff",
  warningSurface: "#fff4de",

  destructive: "#b44949",
  destructiveForeground: "#ffffff",
  destructiveSurface: "#fcecec",

  info: "#3c6680",
  infoForeground: "#ffffff",
  infoSurface: "#eaf2f7",

  /**
   * The wash behind text laid over a photograph. See `--scrim` in
   * `globals.css` for why its opacity floor is 70%.
   */
  scrim: "#241611",
  scrimForeground: "#ffffff",

  /** The inverted marketing band. See `--brand-surface` in `globals.css`. */
  brandSurface: "#1e3529",
  brandSurfaceForeground: "#ffffff",
  brandSurfaceMuted: "#d3e0d6",
  brandSurfaceBorder: "#467058",
  brandSurfaceAccent: "#ede3d0",

  gold: "#8a6519",
  goldSurface: "#f6eeda",
  terracotta: "#8f4a34",
} as const;

export type PaletteToken = keyof typeof PALETTE;
