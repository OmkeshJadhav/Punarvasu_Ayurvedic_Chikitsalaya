import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MEDIA_FRAME_SCRIM_ALPHA } from "@/config/design-tokens";

import {
  AA,
  compositeOver,
  contrastRatio,
  parseHex,
  relativeLuminance,
  type Rgb,
} from "./contrast";
import { PALETTE } from "./palette";

describe("contrastRatio", () => {
  it("reports 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("reports 1:1 for a colour against itself", () => {
    expect(contrastRatio("#28604d", "#28604d")).toBeCloseTo(1, 5);
  });

  it("is order independent", () => {
    expect(contrastRatio("#28604d", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#28604d"),
      10,
    );
  });

  it("rejects a malformed colour instead of guessing", () => {
    expect(() => parseHex("green")).toThrow(/#rrggbb/);
    expect(() => parseHex("#abc")).toThrow(/#rrggbb/);
  });

  it("uses the low-end linear segment of the sRGB transfer function", () => {
    // Channels at or below 0.04045 are divided by 12.92, not raised to 2.4.
    // #0a0a0a is 10/255 = 0.0392, inside that segment.
    expect(relativeLuminance("#0a0a0a")).toBeCloseTo(10 / 255 / 12.92, 10);
  });
});

/**
 * Body text and other normal-size copy. 4.5:1 is the floor; several pairs sit
 * far above it, which is intentional for a healthcare interface.
 */
describe("text contrast meets WCAG AA (4.5:1)", () => {
  const pairs: ReadonlyArray<readonly [string, string, string]> = [
    ["foreground on background", PALETTE.foreground, PALETTE.background],
    ["foreground on card", PALETTE.cardForeground, PALETTE.card],
    ["foreground on muted", PALETTE.foreground, PALETTE.muted],
    ["foreground on secondary", PALETTE.foreground, PALETTE.secondary],
    [
      "muted-foreground on background",
      PALETTE.mutedForeground,
      PALETTE.background,
    ],
    ["muted-foreground on card", PALETTE.mutedForeground, PALETTE.card],
    ["muted-foreground on muted", PALETTE.mutedForeground, PALETTE.muted],
    [
      "secondary-foreground on secondary",
      PALETTE.secondaryForeground,
      PALETTE.secondary,
    ],
    ["accent-foreground on accent", PALETTE.accentForeground, PALETTE.accent],
    ["primary on background", PALETTE.primary, PALETTE.background],
    ["primary on card", PALETTE.primary, PALETTE.card],
    [
      "primary-foreground on primary",
      PALETTE.primaryForeground,
      PALETTE.primary,
    ],
    [
      "primary-foreground on primary hover",
      PALETTE.primaryForeground,
      PALETTE.primaryHover,
    ],
    [
      "primary-foreground on primary active",
      PALETTE.primaryForeground,
      PALETTE.primaryActive,
    ],
    ["success on background", PALETTE.success, PALETTE.background],
    ["success on its surface", PALETTE.success, PALETTE.successSurface],
    [
      "success-foreground on success",
      PALETTE.successForeground,
      PALETTE.success,
    ],
    ["warning on background", PALETTE.warning, PALETTE.background],
    ["warning on its surface", PALETTE.warning, PALETTE.warningSurface],
    [
      "warning-foreground on warning",
      PALETTE.warningForeground,
      PALETTE.warning,
    ],
    ["destructive on background", PALETTE.destructive, PALETTE.background],
    ["destructive on card", PALETTE.destructive, PALETTE.card],
    [
      "destructive on its surface",
      PALETTE.destructive,
      PALETTE.destructiveSurface,
    ],
    [
      "destructive-foreground on destructive",
      PALETTE.destructiveForeground,
      PALETTE.destructive,
    ],
    ["info on background", PALETTE.info, PALETTE.background],
    ["info on its surface", PALETTE.info, PALETTE.infoSurface],
    ["info-foreground on info", PALETTE.infoForeground, PALETTE.info],
    [
      "brand-surface-foreground on the brand band",
      PALETTE.brandSurfaceForeground,
      PALETTE.brandSurface,
    ],
    [
      "brand-surface-muted on the brand band",
      PALETTE.brandSurfaceMuted,
      PALETTE.brandSurface,
    ],
    [
      "brand-surface-accent on the brand band",
      PALETTE.brandSurfaceAccent,
      PALETTE.brandSurface,
    ],
    // The editorial trio has to hold on every surface a section can sit on,
    // because a section chooses its band independently of its copy.
    ...(
      [
        ["heading", PALETTE.heading],
        ["prose", PALETTE.prose],
        ["eyebrow", PALETTE.eyebrow],
      ] as const
    ).flatMap(([role, tone]) =>
      (
        [
          ["background", PALETTE.background],
          ["muted", PALETTE.muted],
          ["secondary", PALETTE.secondary],
          ["card", PALETTE.card],
          ["accent", PALETTE.accent],
        ] as const
      ).map(
        ([surface, value]) => [`${role} on ${surface}`, tone, value] as const,
      ),
    ),
    ["gold on background", PALETTE.gold, PALETTE.background],
    ["gold on card", PALETTE.gold, PALETTE.card],
    ["gold on its surface", PALETTE.gold, PALETTE.goldSurface],
    // The About page's sage band carries editorial copy only. Gold measured
    // below 4.5:1 on it, so gold never sits on sage.
    ["heading on sage", PALETTE.heading, PALETTE.sage],
    ["prose on sage", PALETTE.prose, PALETTE.sage],
    ["eyebrow on sage", PALETTE.eyebrow, PALETTE.sage],
    // The home page's approach numerals sit on the muted band.
    ["gold on muted", PALETTE.gold, PALETTE.muted],
    // The `inverse` button: the one filled action on a dark band.
    [
      "heading on the inverse button",
      PALETTE.heading,
      PALETTE.brandSurfaceAccent,
    ],
    ["terracotta on background", PALETTE.terracotta, PALETTE.background],
    ["terracotta on card", PALETTE.terracotta, PALETTE.card],
    // `--primary` is the eyebrow and link colour, so it has to hold on every
    // band the page alternates between, not only on the default surface.
    ["primary on muted", PALETTE.primary, PALETTE.muted],
    ["primary on secondary", PALETTE.primary, PALETTE.secondary],
    ["scrim-foreground on the scrim", PALETTE.scrimForeground, PALETTE.scrim],
  ];

  it.each(pairs)("%s", (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
      AA.normalText,
    );
  });
});

/**
 * SC 1.4.11: the boundary of an input, and the focus ring, carry information.
 * A decorative divider does not, so `--border` is exempt by design.
 */
describe("non-text contrast meets WCAG AA (3:1)", () => {
  const pairs: ReadonlyArray<readonly [string, string, string | Rgb]> = [
    ["input border on card", PALETTE.input, PALETTE.card],
    ["input border on background", PALETTE.input, PALETTE.background],
    ["input border on muted", PALETTE.input, PALETTE.muted],
    ["input border on secondary", PALETTE.input, PALETTE.secondary],
    ["focus ring on background", PALETTE.ring, PALETTE.background],
    ["focus ring on card", PALETTE.ring, PALETTE.card],
    ["focus ring on muted", PALETTE.ring, PALETTE.muted],
    ["focus ring on accent", PALETTE.ring, PALETTE.accent],
    ["focus ring on secondary", PALETTE.ring, PALETTE.secondary],
    // Phase 16. A bar in a chart is a non-text graphical object that carries
    // the information the chart exists to convey, so it has to be
    // perceivable against every surface a chart can be placed on - and
    // against the track behind it, which is the pair a proportion bar
    // actually depends on.
    ["chart series on card", PALETTE.chartSeries, PALETTE.card],
    ["chart series on background", PALETTE.chartSeries, PALETTE.background],
    ["chart series on muted", PALETTE.chartSeries, PALETTE.muted],
    ["chart series on its own track", PALETTE.chartSeries, PALETTE.chartTrack],
    // On an inverted surface the ring becomes the brand foreground. See the
    // `[data-surface="inverted"]` rule in `globals.css`.
    [
      "inverted focus ring on the brand band",
      PALETTE.brandSurfaceForeground,
      PALETTE.brandSurface,
    ],
    [
      "inverted focus ring over a strongly scrimmed photograph",
      PALETTE.brandSurfaceForeground,
      // The lightest a photograph under the strong scrim can be.
      compositeOver(PALETTE.scrim, "#ffffff", MEDIA_FRAME_SCRIM_ALPHA.strong),
    ],
  ];

  it.each(pairs)("%s", (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
      AA.nonText,
    );
  });
});

/**
 * Text over a photograph.
 *
 * `MediaFrame`'s strong scrim exists so a headline can sit on an image without
 * anyone checking the image first. That promise is only kept if the scrim
 * carries white text over the *lightest* photograph possible, so the worst
 * case - pure white - is what is asserted here.
 *
 * `MEDIA_FRAME_SCRIM_ALPHA` is what the component actually applies. Lowering it for
 * a prettier hero is exactly the change this test exists to catch.
 */
describe("the media scrim carries text over any photograph", () => {
  const WHITEST_POSSIBLE_PHOTOGRAPH = "#ffffff";

  it("clears AA for normal text at the strong scrim's opacity", () => {
    const composited = compositeOver(
      PALETTE.scrim,
      WHITEST_POSSIBLE_PHOTOGRAPH,
      MEDIA_FRAME_SCRIM_ALPHA.strong,
    );
    expect(
      contrastRatio(PALETTE.scrimForeground, composited),
    ).toBeGreaterThanOrEqual(AA.normalText);
  });

  it("clears AA for large text at the soft scrim's opacity", () => {
    const composited = compositeOver(
      PALETTE.scrim,
      WHITEST_POSSIBLE_PHOTOGRAPH,
      MEDIA_FRAME_SCRIM_ALPHA.soft,
    );
    expect(
      contrastRatio(PALETTE.scrimForeground, composited),
    ).toBeGreaterThanOrEqual(AA.largeText);
  });

  it("composites in gamma-encoded sRGB, as a compositor does", () => {
    // A fully opaque overlay is the overlay; a fully transparent one is the
    // base. Anything in between is a straight per-channel mix.
    expect(compositeOver("#000000", "#ffffff", 1)).toEqual({
      r: 0,
      g: 0,
      b: 0,
    });
    expect(compositeOver("#000000", "#ffffff", 0)).toEqual({
      r: 255,
      g: 255,
      b: 255,
    });
    expect(compositeOver("#000000", "#ffffff", 0.5)).toEqual({
      r: 128,
      g: 128,
      b: 128,
    });
    expect(() => compositeOver("#000000", "#ffffff", 1.5)).toThrow(/alpha/);
  });
});

/**
 * The palette mirror is only trustworthy while it matches the stylesheet.
 * Every hex in `palette.ts` must appear in `globals.css`.
 */
describe("palette mirrors globals.css", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
    "utf8",
  ).toLowerCase();

  it.each(Object.entries(PALETTE))(
    "%s (%s) is declared in the stylesheet",
    (_token, hex) => {
      expect(css).toContain(hex);
    },
  );
});
