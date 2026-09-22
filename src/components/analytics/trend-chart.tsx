import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { CHART_COPY } from "@/features/analytics/content";
import { formatCount } from "@/features/analytics/metrics";
import type { TrendGranularity } from "@/config/analytics";

/**
 * A trend over time, as bars — and as a table.
 *
 * ## Why a bar chart, and why one series
 *
 * The data's job is change over time across a small number of buckets: at
 * most 31 days, 18 weeks or 13 months, because the granularity is derived
 * from the range rather than chosen (`config/analytics.ts`). Bars suit a
 * bounded, discrete sequence, they give every bucket its own target and its
 * own label, and — unlike a line with markers — they encode magnitude in a
 * length a reader can compare without reading an axis.
 *
 * **One series.** The completed / cancelled / no-show split is a *composition*
 * question, and it is answered precisely by the figures above the chart and
 * exactly by the table below it. Stacking three segments here would introduce
 * a categorical palette — three hues that must be separable under
 * colour-vision deficiency — to answer a question two other elements on the
 * page already answer better. `phase_16.md` section 68 is explicit that a
 * chart should be avoided where a number or a table communicates better.
 *
 * A single series needs no legend: the heading names it (section 66 is about
 * identity never being colour-alone, and with one series there is no identity
 * to confuse).
 *
 * ## Accessibility, which is most of this component
 *
 * Section 66 requires an accessible title, a useful summary, a tabular
 * alternative and meaning that does not depend on colour or on hover; section
 * 70 requires a tooltip to supplement a visible label rather than replace it.
 *
 * * The `<svg>` is `aria-hidden`. It is a *redundant* presentation of the
 *   table beneath it, and exposing both would make a screen reader read the
 *   same numbers twice.
 * * The **table is always rendered** and is a real `<table>` with a caption
 *   and column headers — not a hidden one, not behind a control. It is
 *   visually collapsed into a `<details>` on narrow screens only, and a
 *   `<details>` is reachable and operable from the keyboard either way.
 * * Every bar carries an SVG `<title>`, which browsers show on hover and
 *   which costs no JavaScript. It supplements the axis labels and the table;
 *   nothing is available only through it.
 * * A one-sentence summary above the chart states the range, the total and
 *   the busiest bucket, so the shape of the data is available to somebody who
 *   never sees the bars.
 * * Colour carries nothing. There is one hue; height carries the magnitude.
 *
 * ## No hover layer beyond the native title, and why
 *
 * A crosshair-and-tooltip layer would make this a client component, in a
 * workspace where every other panel is server-rendered, to provide a value
 * the table already provides exactly. On a clinic machine the table is also
 * the version that can be read aloud, copied, and printed. This is a
 * deliberate departure from a general charting default, taken because
 * sections 66 and 70 point the other way for this product.
 *
 * ## Marks
 *
 * Bars are anchored to the baseline with rounded data-ends, separated by a
 * 2px surface gap, on a recessive grid. Values are labelled selectively —
 * only the largest bucket, and only when there is room — because a number on
 * every bar is a table drawn badly.
 */

export interface TrendSeriesPoint {
  readonly bucketStart: string;
  readonly value: number;
}

export interface TrendTableColumn {
  readonly header: string;
  readonly values: readonly number[];
}

/** The chart's geometry, in user units. The SVG scales to its container. */
const VIEW = {
  width: 720,
  height: 220,
  top: 16,
  bottom: 34,
  left: 8,
  right: 8,
};
const BAR_GAP = 2;
const BAR_RADIUS = 4;

export function TrendChart({
  points,
  granularity,
  valueHeader,
  labelFor,
  summaryLabel,
  caption,
  extraColumns = [],
}: {
  readonly points: readonly TrendSeriesPoint[];
  readonly granularity: TrendGranularity;
  /** The column heading for the plotted value, e.g. "Appointments". */
  readonly valueHeader: string;
  /** Formats a bucket start into the label a reader sees. */
  readonly labelFor: (
    bucketStart: string,
    granularity: TrendGranularity,
  ) => string;
  /** How the summary sentence names the plotted thing, e.g. "appointments". */
  readonly summaryLabel: string;
  readonly caption: string;
  /** Extra numeric columns for the table only. Never plotted. */
  readonly extraColumns?: readonly TrendTableColumn[];
}) {
  if (points.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground font-sans">
        {CHART_COPY.emptyDescription}
      </p>
    );
  }

  const total = points.reduce((sum, point) => sum + point.value, 0);
  const peak = points.reduce(
    (best, point) => (point.value > best.value ? point : best),
    points[0] as TrendSeriesPoint,
  );

  // A flat-zero period would divide by zero and, worse, would draw full-height
  // bars for nothing at all. A floor of 1 makes every bar render at zero
  // height, which is the honest picture.
  const scaleMax = Math.max(peak.value, 1);

  const plotHeight = VIEW.height - VIEW.top - VIEW.bottom;
  const plotWidth = VIEW.width - VIEW.left - VIEW.right;
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.max(slotWidth - BAR_GAP, 1);
  const baseline = VIEW.top + plotHeight;

  // Only the first, last and busiest buckets get an axis label. Thirty-one
  // dates along a phone-width axis is an unreadable smear; three anchors tell
  // a reader what they are looking at, and the table has every one.
  const anchorIndexes = new Set<number>([
    0,
    points.length - 1,
    points.indexOf(peak),
  ]);

  const summary = `${formatCount(total)} ${summaryLabel} between ${labelFor(
    points[0]?.bucketStart ?? "",
    granularity,
  )} and ${labelFor(
    points[points.length - 1]?.bucketStart ?? "",
    granularity,
  )}. Busiest: ${labelFor(peak.bucketStart, granularity)}, ${formatCount(
    peak.value,
  )}.`;

  return (
    <figure className="m-0">
      {/*
        The summary is the chart's accessible description and is visible to
        everybody, so it is a real paragraph rather than an `aria-label` only a
        screen reader would reach.
      */}
      <figcaption className="text-body-sm text-muted-foreground measure mb-4 font-sans">
        {summary}
      </figcaption>

      <svg
        aria-hidden="true"
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        preserveAspectRatio="none"
        role="presentation"
        className="h-48 w-full sm:h-56"
      >
        {/* A recessive baseline. No horizontal gridlines: with a labelled
            peak and an exact table, they would be decoration. */}
        <line
          x1={VIEW.left}
          y1={baseline + 0.5}
          x2={VIEW.width - VIEW.right}
          y2={baseline + 0.5}
          stroke="var(--border-strong)"
          strokeWidth={1}
        />

        {points.map((point, index) => {
          const height = (point.value / scaleMax) * plotHeight;
          const x = VIEW.left + index * slotWidth + BAR_GAP / 2;
          const y = baseline - height;
          const label = labelFor(point.bucketStart, granularity);

          return (
            <g key={point.bucketStart}>
              {/* A zero bucket still draws a 2px stub, so "nothing happened
                  here" is visible as a bucket rather than as a gap the eye
                  closes up (section 96). */}
              <rect
                x={x}
                y={point.value === 0 ? baseline - 2 : y}
                width={barWidth}
                height={point.value === 0 ? 2 : Math.max(height, 2)}
                rx={BAR_RADIUS}
                fill={
                  point.value === 0
                    ? "var(--chart-track)"
                    : "var(--chart-series)"
                }
              >
                {/* Native, zero-JavaScript hover text. Supplements the axis
                    and the table; nothing is only here. */}
                <title>{`${label}: ${formatCount(point.value)}`}</title>
              </rect>

              {anchorIndexes.has(index) ? (
                <text
                  x={x + barWidth / 2}
                  y={VIEW.height - 12}
                  textAnchor="middle"
                  fill="var(--muted-foreground)"
                  className="text-[13px]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {label}
                </text>
              ) : null}

              {/* One direct label, on the peak only. */}
              {index === points.indexOf(peak) && point.value > 0 ? (
                <text
                  x={x + barWidth / 2}
                  y={Math.max(y - 6, 12)}
                  textAnchor="middle"
                  fill="var(--foreground)"
                  className="text-[13px]"
                  style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
                >
                  {formatCount(point.value)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/*
        The exact figures. `<details>` rather than a button: it needs no
        JavaScript, it is keyboard operable and announced as a disclosure, and
        it is open on wider screens where there is room for the table beside
        the chart.
      */}
      <details className="group mt-4" open>
        <summary className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 cursor-pointer items-center font-sans font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
          {CHART_COPY.tableToggleLabel}
        </summary>

        <div className="mt-3">
          <TableScroller label={caption}>
            <Table>
              <TableCaption>{caption}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{CHART_COPY.periodHeader}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {valueHeader}
                  </TableHead>
                  {extraColumns.map((column) => (
                    <TableHead
                      key={column.header}
                      scope="col"
                      className="text-right"
                    >
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point, index) => (
                  <TableRow key={point.bucketStart}>
                    <TableCell>
                      {labelFor(point.bucketStart, granularity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCount(point.value)}
                    </TableCell>
                    {extraColumns.map((column) => (
                      <TableCell
                        key={column.header}
                        className="text-right tabular-nums"
                      >
                        {formatCount(column.values[index] ?? 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroller>
        </div>
      </details>
    </figure>
  );
}
