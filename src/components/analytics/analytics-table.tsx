import type { ReactNode } from "react";

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

/**
 * An accessible data table for exact values.
 *
 * `phase_16.md` section 69: for exact values, provide a table — it is often
 * more useful than a chart alone. Every breakdown in this feature that is not
 * a trend is a table for that reason, including the practitioner workload
 * that a general dashboard would draw as a bar race.
 *
 * ## What this wrapper guarantees
 *
 * * A real `<caption>`, so the table has a name a screen reader announces
 *   before its contents. Section 66's "accessible titles".
 * * `scope="col"` on every header, which `TableHead` sets.
 * * A focusable `TableScroller`, so an overflowing table is reachable by
 *   keyboard at all — and one that is `relative`, which is the Phase 08 fix
 *   that keeps an `sr-only` label inside a wide table from widening the whole
 *   document.
 * * Numeric columns right-aligned and tabular, so a column of figures lines
 *   up on its digits and can be scanned.
 *
 * Writing those four things once is the point. The alternative is four tables
 * across three pages, one of which eventually ships without a caption.
 */

export interface AnalyticsColumn<Row> {
  readonly header: string;
  /** Numeric columns align right and use tabular figures. */
  readonly numeric?: boolean;
  readonly cell: (row: Row) => ReactNode;
}

export function AnalyticsTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  footnote,
}: {
  readonly caption: string;
  readonly columns: readonly AnalyticsColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row, index: number) => string;
  readonly footnote?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <TableScroller label={caption}>
        <Table>
          <TableCaption>{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.header}
                  scope="col"
                  className={column.numeric ? "text-right" : undefined}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={rowKey(row, index)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.header}
                    className={
                      column.numeric ? "text-right tabular-nums" : undefined
                    }
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableScroller>

      {footnote ? (
        <p className="text-body-sm text-muted-foreground measure font-sans">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A proportion, drawn as a bar and printed as a number.
 *
 * Used for utilisation in the workload table. The bar is `aria-hidden`
 * because the figure beside it says the same thing exactly — section 66's
 * "non-color-dependent meaning" taken literally: remove all colour from this
 * cell and it still reads.
 *
 * A `null` rate renders the caller's words rather than an empty bar, because
 * "no working hours in this period" and "0% utilised" are different facts
 * (section 96).
 */
export function ProportionCell({
  value,
  label,
  fallback,
}: {
  readonly value: number | null;
  /** The already-formatted percentage, e.g. "67.4%". */
  readonly label: string;
  /** Shown instead when there is nothing to take a proportion of. */
  readonly fallback: string;
}) {
  if (value === null) {
    return <span className="text-muted-foreground font-sans">{fallback}</span>;
  }

  return (
    <span className="flex items-center justify-end gap-2">
      <span
        aria-hidden="true"
        className="bg-chart-track hidden h-2 w-16 shrink-0 overflow-hidden rounded-full sm:block"
      >
        <span
          className="bg-chart-series block h-full rounded-full"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
