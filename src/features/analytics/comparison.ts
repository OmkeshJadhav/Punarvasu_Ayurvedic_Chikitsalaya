/**
 * "vs. previous period", decided once.
 *
 * The headline cards compare each figure with the same figure over the
 * period immediately before (`previousRange()`), and every decision about
 * how that comparison is phrased lives here rather than in a component:
 * whether there is one at all, which way it went, whether that way is good,
 * and in what unit it is stated.
 *
 * ## When there is no comparison
 *
 * Either read failed, the earlier period is outside the reporting window, the
 * earlier count was zero (no percentage of nothing), or a rate had no
 * denominator on one side. Each is `null`, and the card says there is nothing
 * to compare rather than drawing a flat arrow — "no change" is a claim.
 */

import { formatChange, pointChange, relativeChange } from "./metrics";
import type { AnalyticsResult, Rate } from "./types";

export type ChangeDirection = "up" | "down" | "flat";
export type ChangeTone = "positive" | "negative" | "neutral";

export interface PeriodComparison {
  readonly direction: ChangeDirection;
  /** Unsigned and formatted, e.g. "12.5%" or "2.0 pts". */
  readonly magnitude: string;
  /** Whether the movement is good news. Never conveyed by colour alone. */
  readonly tone: ChangeTone;
}

/** Below this the change rounds to 0.0 at one decimal place, so it is flat. */
const FLAT_THRESHOLD = 0.0005;

function directionOf(change: number, flatBelow: number): ChangeDirection {
  if (Math.abs(change) < flatBelow) return "flat";
  return change > 0 ? "up" : "down";
}

function toneOf(
  direction: ChangeDirection,
  lowerIsBetter: boolean,
): ChangeTone {
  if (direction === "flat") return "neutral";
  const improved = direction === (lowerIsBetter ? "down" : "up");
  return improved ? "positive" : "negative";
}

/** A count against the same count for the previous period. */
export function compareCounts(
  current: number,
  previous: number,
  { lowerIsBetter = false }: { readonly lowerIsBetter?: boolean } = {},
): PeriodComparison | null {
  const change = relativeChange(current, previous);
  if (change === null) return null;

  const direction = directionOf(change, FLAT_THRESHOLD);
  return {
    direction,
    magnitude: formatChange(change, "percent"),
    tone: toneOf(direction, lowerIsBetter),
  };
}

/** A rate against the same rate for the previous period, in points. */
export function compareRates(
  current: Rate,
  previous: Rate,
  { lowerIsBetter = false }: { readonly lowerIsBetter?: boolean } = {},
): PeriodComparison | null {
  const change = pointChange(current, previous);
  if (change === null) return null;

  // Points are already ×100, so the flat threshold scales with them.
  const direction = directionOf(change, FLAT_THRESHOLD * 100);
  return {
    direction,
    magnitude: formatChange(change, "points"),
    tone: toneOf(direction, lowerIsBetter),
  };
}

/**
 * Both sides of a comparison, or nothing.
 *
 * A comparison is only as good as the weaker of its two reads, so a failed or
 * refused read on either side means no comparison — never one side compared
 * with zero.
 */
export function readyPair<T>(
  current: AnalyticsResult<T>,
  previous: AnalyticsResult<T> | null,
): readonly [T, T] | null {
  if (current.status !== "ready") return null;
  if (!previous || previous.status !== "ready") return null;
  return [current.data, previous.data];
}
