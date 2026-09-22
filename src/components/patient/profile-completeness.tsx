import { Check } from "lucide-react";

import { PROFILE_COPY } from "@/features/patients/content";
import type { ProfileCompleteness } from "@/features/patients/completeness";

/**
 * How complete the patient's profile is, and what would complete it.
 *
 * A server component: the value is derived from the record on every render, so
 * there is nothing to keep in sync and nothing stored
 * (`phase_07.md` section 59).
 *
 * ## Accessibility
 *
 * The bar is a real `progressbar` with its value in `aria-valuenow`, and the
 * percentage is also printed as text beside the label — so the figure is
 * available whether or not the bar renders, and the state is never carried by
 * a coloured strip alone.
 *
 * ## Tone
 *
 * Each missing item is listed with the reason the clinic wants it, not as a
 * scolding. `phase_07.md` section 19 asks for exactly this restraint: the list
 * explains, it does not pressure, and nothing here is presented as an
 * obligation. Sensitive optional details are not counted at all — see
 * `features/patients/completeness.ts`.
 */
export function ProfileCompletenessPanel({
  completeness,
}: {
  readonly completeness: ProfileCompleteness;
}) {
  const { percentage, missing, complete } = completeness;

  return (
    <div className="border-border bg-card rounded-lg border p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-label text-foreground font-sans font-medium">
          {PROFILE_COPY.completenessLabel}
        </h2>
        <p className="text-h5 text-heading font-sans font-medium tabular-nums">
          {percentage}%
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={PROFILE_COPY.completenessLabel}
        className="bg-muted mt-3 h-2 w-full overflow-hidden rounded-full"
      >
        <div
          // Inline width because the value is data, not a design decision;
          // there is no token for "63%". The colour is a token.
          style={{ width: `${percentage}%` }}
          className="bg-primary h-full rounded-full motion-safe:transition-[width] motion-safe:duration-(--duration-normal) motion-safe:ease-(--ease-natural)"
        />
      </div>

      {complete ? (
        <p className="text-body-sm text-muted-foreground mt-4 flex items-start gap-2">
          <Check aria-hidden="true" className="text-success mt-0.5 size-4" />
          {PROFILE_COPY.completenessComplete}
        </p>
      ) : (
        <div className="mt-4">
          <p className="text-body-sm text-muted-foreground">
            {PROFILE_COPY.completenessPartial}
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {missing.map((item) => (
              <li key={item.id} className="text-body-sm">
                <span className="text-foreground font-medium">
                  {item.label}
                </span>
                <span className="text-muted-foreground block">
                  {item.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
