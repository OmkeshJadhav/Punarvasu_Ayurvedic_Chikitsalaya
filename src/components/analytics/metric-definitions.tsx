import { AnalyticsTable } from "@/components/analytics/analytics-table";
import { DEFINITIONS_COPY } from "@/features/analytics/content";
import {
  METRIC_DEFINITIONS,
  type MetricDefinition,
} from "@/features/analytics/metrics";

/**
 * What every figure on the page means.
 *
 * `phase_16.md` sections 92 and 93 ask for each report and each metric to be
 * documented — name, calculation, what it counts — and say plainly that this
 * is what prevents ambiguous reporting. A definitions table in a wiki nobody
 * opens does not prevent it; one on the page beneath the figures does.
 *
 * It renders the same `METRIC_DEFINITIONS` array the dashboard, the API and
 * the export all compute from, so a definition cannot drift from the number
 * it describes: changing how completion rate is calculated means editing the
 * module that both calculates it and supplies this text.
 *
 * Collapsed by default, because it is reference material rather than the
 * thing a person came for — and a real `<details>`, so it is announced as a
 * disclosure and operable from the keyboard without any JavaScript.
 */
export function MetricDefinitions({
  keys,
}: {
  /** Which metrics this page actually shows. Defaults to all of them. */
  readonly keys?: readonly string[];
}) {
  const definitions: readonly MetricDefinition[] = keys
    ? METRIC_DEFINITIONS.filter((definition) => keys.includes(definition.key))
    : METRIC_DEFINITIONS;

  if (definitions.length === 0) return null;

  return (
    <details className="border-border rounded-lg border p-4">
      <summary className="text-label text-heading focus-visible:outline-ring min-h-11 cursor-pointer font-sans font-medium focus-visible:outline-2 focus-visible:outline-offset-2">
        {DEFINITIONS_COPY.heading}
      </summary>

      <p className="text-body-sm text-muted-foreground measure mt-2 font-sans">
        {DEFINITIONS_COPY.description}
      </p>

      <div className="mt-4">
        <AnalyticsTable<MetricDefinition>
          caption={DEFINITIONS_COPY.heading}
          rows={definitions}
          rowKey={(definition) => definition.key}
          columns={[
            {
              header: DEFINITIONS_COPY.metricHeader,
              cell: (definition) => definition.label,
            },
            {
              header: DEFINITIONS_COPY.formulaHeader,
              cell: (definition) => definition.formula,
            },
            {
              header: DEFINITIONS_COPY.datesHeader,
              cell: (definition) => definition.dateSemantics,
            },
          ]}
        />
      </div>
    </details>
  );
}
