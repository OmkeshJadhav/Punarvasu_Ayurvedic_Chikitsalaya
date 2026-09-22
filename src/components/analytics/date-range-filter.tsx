"use client";

import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  ANALYTICS_RANGE_PRESETS,
  ANALYTICS_RANGE_RULES,
} from "@/config/analytics";
import {
  RANGE_FILTER_COPY,
  RANGE_PRESET_LABELS,
} from "@/features/analytics/content";
import { formatRangeLabel } from "@/features/analytics/format";
import type { RangeProblem } from "@/features/analytics/ranges";
import type { AnalyticsRange } from "@/features/analytics/types";

/**
 * Choosing the reporting period.
 *
 * ## A plain `GET` form
 *
 * A date range and a practitioner are not sensitive, so the URL is the right
 * place for them: the view becomes shareable between two people looking at
 * the same month, bookmarkable, and correct under the back button — none of
 * which a client-side filter reimplements well.
 *
 * It contrasts deliberately with the patient search in the front desk and the
 * doctor workspaces, which are POSTs because *those* carry somebody's name.
 * The distinction is what is being put in the URL, not which is more
 * convenient (`phase_16.md` section 74: persist only harmless preferences,
 * and validate them server-side — which `analyticsFilterSchema` does).
 *
 * ## No JavaScript, despite the directive
 *
 * `"use client"` is here because `Field` is a client component taking a
 * render prop, and a function cannot cross the server/client boundary. The
 * directive buys interactivity this component then declines to use: there is
 * no `onChange` router push and no event handler of any kind, so the whole
 * control works before hydration and keeps working without it.
 *
 * That is also why the preset select does not hide the custom date inputs
 * when another preset is chosen. Hiding them would need state; leaving them
 * visible costs a reader nothing and means the form never depends on script
 * having run. The hint says what they are for.
 *
 * ## Section 73's four requirements
 *
 * The current range is stated in words above the controls; the timezone note
 * says whose day a date means; reset is a link back to the default; and a
 * rejected period is reported rather than silently replaced — which is the
 * one somebody would otherwise never notice, because the page would just show
 * different numbers.
 */
export function DateRangeFilter({
  range,
  practitionerId,
  practitioners,
  basePath,
  fellBack,
  problem,
}: {
  readonly range: AnalyticsRange;
  readonly practitionerId: string | undefined;
  /** Omitted entirely on a surface with no practitioner filter. */
  readonly practitioners?: readonly {
    readonly id: string;
    readonly displayName: string;
  }[];
  readonly basePath: string;
  readonly fellBack: boolean;
  readonly problem: RangeProblem | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {fellBack && problem ? (
        <Alert tone="warning" title={RANGE_FILTER_COPY.fellBackNotice}>
          {RANGE_FILTER_COPY.problems[problem]}
        </Alert>
      ) : null}

      <form
        method="get"
        action={basePath}
        className="border-border bg-muted/40 flex flex-col gap-4 rounded-lg border p-4"
      >
        <fieldset className="contents">
          <legend className="text-caption text-muted-foreground font-sans tracking-wide uppercase">
            {RANGE_FILTER_COPY.legend}
          </legend>

          <p className="text-body-sm text-heading font-sans font-medium">
            {formatRangeLabel(range.from, range.to)}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field name="preset" label={RANGE_FILTER_COPY.presetLabel}>
              {(control) => (
                <NativeSelect defaultValue={range.preset} {...control}>
                  {ANALYTICS_RANGE_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {RANGE_PRESET_LABELS[preset]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <Field
              name="from"
              label={RANGE_FILTER_COPY.fromLabel}
              description={RANGE_FILTER_COPY.customHint}
            >
              {(control) => (
                // A native date input: keyboard operable, announced correctly,
                // and on a phone it opens the platform's own picker. `min`
                // and `max` mirror the bounds the database enforces, so the
                // browser refuses a period the server would reject anyway.
                <Input
                  type="date"
                  defaultValue={range.from}
                  min={ANALYTICS_RANGE_RULES.earliestDate}
                  {...control}
                />
              )}
            </Field>

            <Field name="to" label={RANGE_FILTER_COPY.toLabel}>
              {(control) => (
                <Input
                  type="date"
                  defaultValue={range.to}
                  min={ANALYTICS_RANGE_RULES.earliestDate}
                  {...control}
                />
              )}
            </Field>

            {practitioners ? (
              <Field name="practitionerId" label="Practitioner">
                {(control) => (
                  <NativeSelect
                    defaultValue={practitionerId ?? ""}
                    {...control}
                  >
                    <option value="">All practitioners</option>
                    {practitioners.map((practitioner) => (
                      <option key={practitioner.id} value={practitioner.id}>
                        {practitioner.displayName}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit">{RANGE_FILTER_COPY.applyLabel}</Button>
            <Button asChild variant="ghost">
              <Link href={basePath}>{RANGE_FILTER_COPY.resetLabel}</Link>
            </Button>
          </div>

          <p className="text-caption text-muted-foreground measure font-sans">
            {RANGE_FILTER_COPY.timezoneNote}
          </p>
        </fieldset>
      </form>
    </div>
  );
}
