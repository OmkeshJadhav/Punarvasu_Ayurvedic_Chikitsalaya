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
import { CHART_COPY, DASHBOARD_COPY } from "@/features/analytics/content";
import { formatCount } from "@/features/analytics/metrics";
import { cn } from "@/lib/utils/cn";

/**
 * A trend over time, as stacked bars — with a legend, a hover readout and the
 * exact table.
 *
 * ## Built from HTML boxes, not an SVG
 *
 * The dashboard's charts are server-rendered like every other panel, so they
 * cost no JavaScript. Drawing the bars as flex boxes rather than SVG shapes
 * buys three things a stretched `viewBox` cannot: gaps and corner radii that
 * stay the same number of pixels at any width, axis text that is real text at
 * the real type scale, and a hover readout that is ordinary CSS
 * (`group-hover`) rather than a client component tracking the pointer.
 *
 * ## Accessibility is the same contract as `TrendChart`
 *
 * `phase_16.md` sections 66 and 70. The plot is `aria-hidden` because it is a
 * redundant presentation; the legend is real text; a one-sentence summary
 * states the range, the total and the busiest bucket; and the exact figures
 * are always one keyboard-operable `<details>` away as a captioned `<table>`.
 * The hover readout supplements all of that — nothing is only there, which
 * is why it may be hover-only.
 *
 * Series identity never rests on colour alone: segments stack in the fixed
 * legend order, bottom first, with a surface gap between them, and the
 * readout and the table name every value.
 */

export interface ChartSeries {
  readonly key: string;
  readonly label: string;
  /** A `bg-*` utility bound to a chart token, e.g. `bg-chart-1`. */
  readonly swatchClass: string;
}

export interface ChartBucket {
  readonly key: string;
  /** The axis and readout label, already formatted. */
  readonly label: string;
  /** One value per series, in series order. */
  readonly values: readonly number[];
}

/** Gridline steps, as multiples of a power of ten. Fine enough that the
 * tallest bar fills most of the plot, coarse enough to read as round. */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

/** Four gridline intervals whose top is a round number at or above `max`. */
export function niceScale(max: number, intervals = 4): number {
  if (!Number.isFinite(max) || max <= 0) return intervals;

  const raw = max / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    NICE_STEPS.map((nice) => nice * magnitude).find(
      // Counts are whole numbers, so a gridline at 1.5 would label nothing
      // real.
      (candidate) => candidate >= raw && Number.isInteger(candidate),
    ) ?? 10 * magnitude;

  return Math.max(step, 1) * intervals;
}

const GRID_INTERVALS = 4;

function gapClass(count: number): string {
  if (count <= 8) return "gap-3 sm:gap-6";
  if (count <= 16) return "gap-1.5 sm:gap-3";
  return "gap-0.5 sm:gap-1.5";
}

/**
 * Which buckets get an axis label. Fewer on a phone, where thirty-one dates
 * would be an unreadable smear; the table has every one.
 */
function labelVisibility(index: number, count: number): string | null {
  const narrowStep = Math.max(Math.ceil(count / 4), 1);
  const wideStep = Math.max(Math.ceil(count / 7), 1);
  const narrow = index % narrowStep === 0;
  const wide = index % wideStep === 0;

  // Each width shows only its own set, so the two never collide.
  if (narrow && wide) return "block";
  if (narrow) return "block sm:hidden";
  if (wide) return "hidden sm:block";
  return null;
}

export function StackedBarChart({
  series,
  buckets,
  caption,
  summaryNoun,
  periodHeader = CHART_COPY.periodHeader,
  legendNote,
}: {
  readonly series: readonly ChartSeries[];
  readonly buckets: readonly ChartBucket[];
  /** Names the table, e.g. "Appointments by day". */
  readonly caption: string;
  /** How the summary names the plotted thing, e.g. "appointments". */
  readonly summaryNoun: string;
  readonly periodHeader?: string;
  /** A sentence under the legend, when a series needs defining. */
  readonly legendNote?: string;
}) {
  if (buckets.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground font-sans">
        {CHART_COPY.emptyDescription}
      </p>
    );
  }

  const totals = buckets.map((bucket) =>
    bucket.values.reduce((sum, value) => sum + value, 0),
  );
  const seriesTotals = series.map((_, seriesIndex) =>
    buckets.reduce((sum, bucket) => sum + (bucket.values[seriesIndex] ?? 0), 0),
  );
  const grandTotal = totals.reduce((sum, value) => sum + value, 0);
  const peakIndex = totals.reduce(
    (best, value, index) => (value > (totals[best] ?? 0) ? index : best),
    0,
  );
  const top = niceScale(Math.max(...totals), GRID_INTERVALS);
  const multiSeries = series.length > 1;

  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const peak = buckets[peakIndex];
  const summary = `${formatCount(grandTotal)} ${summaryNoun} between ${
    first?.label ?? ""
  } and ${last?.label ?? ""}.${
    peak && grandTotal > 0
      ? ` Busiest: ${peak.label}, ${formatCount(totals[peakIndex] ?? 0)}.`
      : ""
  }`;

  return (
    <figure className="m-0 flex flex-col gap-5">
      {multiSeries ? (
        <div className="flex flex-col gap-2">
          <ul
            aria-label={DASHBOARD_COPY.legendLabel}
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            {series.map((item, index) => (
              <li
                key={item.key}
                className="text-body-sm text-muted-foreground flex items-center gap-2 font-sans"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    item.swatchClass,
                  )}
                />
                {item.label}
                <span className="text-foreground font-medium tabular-nums">
                  {formatCount(seriesTotals[index] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          {legendNote ? (
            <p className="text-caption text-muted-foreground font-sans">
              {legendNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <div aria-hidden="true" className="flex gap-3">
        {/* The value axis: four quiet labels, no line. */}
        <div className="relative h-52 w-8 shrink-0 sm:h-60">
          {Array.from({ length: GRID_INTERVALS + 1 }, (_, step) => (
            <span
              key={step}
              className="text-caption text-muted-foreground absolute right-0 translate-y-1/2 font-sans leading-none tabular-nums"
              style={{ bottom: `${(step / GRID_INTERVALS) * 100}%` }}
            >
              {formatCount((top / GRID_INTERVALS) * step)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-52 sm:h-60">
            {/* Recessive gridlines; the baseline alone is solid. */}
            {Array.from({ length: GRID_INTERVALS + 1 }, (_, step) => (
              <span
                key={step}
                className={cn(
                  "absolute inset-x-0 border-t",
                  step === 0
                    ? "border-border-strong"
                    : "border-border border-dashed",
                )}
                style={{ bottom: `${(step / GRID_INTERVALS) * 100}%` }}
              />
            ))}

            <div
              className={cn(
                "absolute inset-0 flex items-end",
                gapClass(buckets.length),
              )}
            >
              {buckets.map((bucket, index) => {
                const total = totals[index] ?? 0;
                const height = (total / top) * 100;
                const align =
                  index < buckets.length * 0.25
                    ? "left-0"
                    : index >= buckets.length * 0.75
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2";

                return (
                  <div
                    key={bucket.key}
                    className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                  >
                    {/* The hovered bucket's band. */}
                    <span className="group-hover:bg-muted/80 ease-natural absolute -inset-x-0.5 inset-y-0 rounded-sm transition-colors duration-(--duration-fast)" />

                    {total === 0 ? (
                      <span className="bg-chart-track relative h-0.5 w-full max-w-10 rounded-full" />
                    ) : (
                      <span
                        className="relative flex w-full max-w-10 flex-col-reverse gap-0.5"
                        style={{ height: `${height}%` }}
                      >
                        {bucket.values.map((value, seriesIndex) =>
                          value > 0 ? (
                            <span
                              key={series[seriesIndex]?.key ?? seriesIndex}
                              className={cn(
                                "min-h-0.5 rounded-[3px]",
                                series[seriesIndex]?.swatchClass,
                              )}
                              style={{ flexGrow: value, flexBasis: 0 }}
                            />
                          ) : null,
                        )}
                      </span>
                    )}

                    {/* The readout. Supplementary: the table has it all. */}
                    <span
                      className={cn(
                        "border-border bg-popover text-popover-foreground pointer-events-none absolute z-(--z-dropdown) w-max min-w-36 rounded-md border px-3 py-2 font-sans shadow-md",
                        "ease-natural translate-y-1 opacity-0 transition-[opacity,translate] duration-(--duration-fast) group-hover:translate-y-0 group-hover:opacity-100",
                        align,
                      )}
                      style={{ bottom: `calc(${height}% + 0.75rem)` }}
                    >
                      <span className="text-caption text-heading block font-semibold">
                        {bucket.label}
                      </span>
                      <span className="mt-1.5 flex flex-col gap-1">
                        {series.map((item, seriesIndex) => (
                          <span
                            key={item.key}
                            className="text-caption flex items-center justify-between gap-4"
                          >
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "size-2 rounded-full",
                                  item.swatchClass,
                                )}
                              />
                              {item.label}
                            </span>
                            <span className="text-foreground font-medium tabular-nums">
                              {formatCount(bucket.values[seriesIndex] ?? 0)}
                            </span>
                          </span>
                        ))}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={cn("mt-2 flex h-5", gapClass(buckets.length))}>
            {buckets.map((bucket, index) => {
              const visibility = labelVisibility(index, buckets.length);
              const position =
                index === 0
                  ? "left-0"
                  : index === buckets.length - 1
                    ? "right-0"
                    : "left-1/2 -translate-x-1/2";

              return (
                <span key={bucket.key} className="relative min-w-0 flex-1">
                  {visibility ? (
                    <span
                      className={cn(
                        "text-caption text-muted-foreground absolute top-0 font-sans whitespace-nowrap",
                        visibility,
                        position,
                      )}
                    >
                      {bucket.label}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="text-caption text-muted-foreground font-sans">
        {summary}
      </figcaption>

      <details className="group/table -mt-2">
        <summary className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm font-sans font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
          {CHART_COPY.tableToggleLabel}
        </summary>

        <div className="mt-2">
          <TableScroller label={caption}>
            <Table>
              <TableCaption>{caption}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{periodHeader}</TableHead>
                  {series.map((item) => (
                    <TableHead
                      key={item.key}
                      scope="col"
                      className="text-right"
                    >
                      {item.label}
                    </TableHead>
                  ))}
                  {multiSeries ? (
                    <TableHead scope="col" className="text-right">
                      {DASHBOARD_COPY.overviewTotal}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map((bucket, index) => (
                  <TableRow key={bucket.key}>
                    <TableCell>{bucket.label}</TableCell>
                    {series.map((item, seriesIndex) => (
                      <TableCell
                        key={item.key}
                        className="text-right tabular-nums"
                      >
                        {formatCount(bucket.values[seriesIndex] ?? 0)}
                      </TableCell>
                    ))}
                    {multiSeries ? (
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCount(totals[index] ?? 0)}
                      </TableCell>
                    ) : null}
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
