import type { ReactNode } from "react";

import { metricDefinition } from "@/features/analytics/metrics";

/**
 * A small set of meaningful figures.
 *
 * ## Deliberately not twenty KPI cards
 *
 * `phase_16.md` sections 11 and 116 both warn against the wall of tiles, and
 * `docs/DESIGN_SYSTEM.md` section 33 asks a dashboard to be functional
 * without becoming decorative. So this is a description list in plain type on
 * the page's own surface — no card per figure, no border per figure, no icon,
 * no sparkline, no percentage-change badge invented from a comparison nobody
 * asked for.
 *
 * It is the same shape the front desk's day overview uses, for the same
 * reason: a row of figures should read as a sentence about the period rather
 * than as a control panel.
 *
 * ## The definition travels with the figure
 *
 * Section 92 says documenting a report is what prevents ambiguous reporting,
 * and that is only true if the definition reaches the person reading the
 * number. Each figure may carry its metric key; the formula is then rendered
 * beneath it as ordinary text — not a hover tooltip, because section 70 says
 * a tooltip supplements a visible label rather than replacing it, and a
 * definition nobody can see on a phone is a definition nobody has.
 *
 * ## Zero is a number; missing is not
 *
 * A `value` of `"—"` with a `note` saying why is how a rate with no
 * denominator renders. Section 64 and example 7: `0%` would be a claim about
 * a period that concluded nothing.
 */
export interface MetricFigure {
  readonly label: string;
  /** Already formatted. The metric layer decides the rounding, not this. */
  readonly value: string;
  /** The metric key in `METRIC_DEFINITIONS`, when one applies. */
  readonly definitionKey?: string;
  /** A short clarification shown under the figure. */
  readonly note?: string;
  /** Draws attention without relying on colour alone — weight as well. */
  readonly emphasise?: boolean;
}

export function MetricList({
  figures,
  headingId,
  columns = 4,
  showDefinitions = false,
}: {
  readonly figures: readonly MetricFigure[];
  readonly headingId?: string;
  readonly columns?: 3 | 4;
  /** Whether to print each figure's formula beneath it. */
  readonly showDefinitions?: boolean;
}) {
  return (
    <dl
      aria-labelledby={headingId}
      className={[
        "border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6",
        columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4",
      ].join(" ")}
    >
      {figures.map((figure) => {
        const definition = figure.definitionKey
          ? metricDefinition(figure.definitionKey)
          : undefined;

        return (
          <div key={figure.label} className="min-w-0">
            <dt className="text-caption text-muted-foreground font-sans tracking-wide uppercase">
              {figure.label}
            </dt>
            <dd className="min-w-0">
              <span
                className={[
                  "text-h3 block font-sans break-words",
                  figure.emphasise
                    ? "text-primary font-semibold"
                    : "text-heading font-normal",
                ].join(" ")}
              >
                {figure.value}
              </span>
              {figure.note ? (
                <span className="text-caption text-muted-foreground mt-1 block font-sans">
                  {figure.note}
                </span>
              ) : null}
              {showDefinitions && definition ? (
                <span className="text-caption text-muted-foreground mt-1 block font-sans">
                  {definition.formula}
                </span>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * A short explanatory line beneath a group of figures.
 *
 * Its own component so that the denominator note, the utilisation note and
 * the acceptance-rate note are typeset identically — they are the same kind
 * of statement, and the acceptance-rate one in particular is the sentence
 * that stops a figure being misread.
 */
export function MetricNote({ children }: { readonly children: ReactNode }) {
  return (
    <p className="text-body-sm text-muted-foreground measure mt-4 font-sans">
      {children}
    </p>
  );
}
