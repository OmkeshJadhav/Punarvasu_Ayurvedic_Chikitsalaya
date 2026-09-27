import { describe, expect, it } from "vitest";

import { compareCounts, compareRates, readyPair } from "./comparison";
import { formatChange, pointChange, relativeChange } from "./metrics";
import { previousRange, resolveRange } from "./ranges";
import type { AnalyticsRange } from "./types";

function range(from: string, to: string): AnalyticsRange {
  const resolved = resolveRange(from, to);
  if (resolved.status !== "ok") throw new Error("test range is invalid");
  return resolved.range;
}

describe("previousRange", () => {
  it("is the same number of days, ending the day before", () => {
    const earlier = previousRange(range("2026-09-01", "2026-09-30"));
    expect(earlier?.from).toBe("2026-08-02");
    expect(earlier?.to).toBe("2026-08-31");
    expect(earlier?.spanDays).toBe(30);
  });

  it("compares a month-to-date with the same number of days, not a whole month", () => {
    // The 9th: nine days against the nine before, never against all of August.
    const earlier = previousRange(range("2026-09-01", "2026-09-09"));
    expect(earlier?.from).toBe("2026-08-23");
    expect(earlier?.to).toBe("2026-08-31");
  });

  it("crosses a year boundary", () => {
    const earlier = previousRange(range("2026-01-01", "2026-01-07"));
    expect(earlier?.from).toBe("2025-12-25");
    expect(earlier?.to).toBe("2025-12-31");
  });

  it("gives one day for a single day", () => {
    const earlier = previousRange(range("2026-03-01", "2026-03-01"));
    expect(earlier?.from).toBe("2026-02-28");
    expect(earlier?.to).toBe("2026-02-28");
  });

  it("is null rather than clipped when it would start before the reporting floor", () => {
    expect(previousRange(range("2020-01-01", "2020-01-31"))).toBeNull();
  });
});

describe("relativeChange and pointChange", () => {
  it("is the change as a share of the earlier figure", () => {
    expect(relativeChange(112, 100)).toBeCloseTo(0.12);
    expect(relativeChange(90, 100)).toBeCloseTo(-0.1);
  });

  it("has no percentage of nothing", () => {
    expect(relativeChange(5, 0)).toBeNull();
    expect(relativeChange(0, 0)).toBeNull();
  });

  it("reports a rate's movement in points, and nothing without a basis", () => {
    expect(pointChange(0.06, 0.04)).toBeCloseTo(2);
    expect(pointChange(null, 0.04)).toBeNull();
    expect(pointChange(0.04, null)).toBeNull();
  });

  it("formats unsigned, at the product's one decimal place", () => {
    expect(formatChange(-0.125, "percent")).toBe("12.5%");
    expect(formatChange(2, "points")).toBe("2.0 pts");
  });
});

describe("compareCounts", () => {
  it("calls a rise good by default", () => {
    expect(compareCounts(120, 100)).toEqual({
      direction: "up",
      magnitude: "20.0%",
      tone: "positive",
    });
  });

  it("calls a fall bad by default", () => {
    expect(compareCounts(80, 100)?.tone).toBe("negative");
  });

  it("inverts the tone when lower is better", () => {
    expect(compareCounts(80, 100, { lowerIsBetter: true })?.tone).toBe(
      "positive",
    );
  });

  it("is flat, and neutral, when nothing moved", () => {
    expect(compareCounts(100, 100)).toMatchObject({
      direction: "flat",
      tone: "neutral",
    });
  });

  it("makes no comparison against an empty earlier period", () => {
    expect(compareCounts(10, 0)).toBeNull();
  });
});

describe("compareRates", () => {
  it("states a cancellation rate's rise as points, and as bad news", () => {
    expect(compareRates(0.08, 0.05, { lowerIsBetter: true })).toEqual({
      direction: "up",
      magnitude: "3.0 pts",
      tone: "negative",
    });
  });

  it("makes no comparison when either side had nothing concluded", () => {
    expect(compareRates(null, 0.05)).toBeNull();
  });
});

describe("readyPair", () => {
  const ready = { status: "ready", data: 1 } as const;
  const unavailable = { status: "unavailable" } as const;

  it("pairs two ready reads", () => {
    expect(readyPair(ready, { status: "ready", data: 2 })).toEqual([1, 2]);
  });

  it("refuses a comparison when either read failed or is missing", () => {
    expect(readyPair(ready, unavailable)).toBeNull();
    expect(readyPair(unavailable, ready)).toBeNull();
    expect(readyPair(ready, null)).toBeNull();
  });
});
