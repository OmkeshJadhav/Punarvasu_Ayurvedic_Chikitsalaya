import { StatusBadge, type BadgeStatus } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/features/appointments/types";

/**
 * An appointment's status, as a badge.
 *
 * ## Why this mapping exists rather than passing a status straight to `Badge`
 *
 * `StatusBadge` already owns the tone-plus-icon pairing, so a status is never
 * communicated by colour alone (`docs/DESIGN_SYSTEM.md` section 5). What it
 * does not know is Punarvasu's appointment vocabulary — it has a generic
 * `pending` preset, and this product needs the word **Requested**, because
 * "pending" does not tell a patient whether the clinic has agreed to anything.
 *
 * So this is a translation table and nothing more: seven statuses to the
 * design system's presets, in one place, so two screens cannot label the same
 * status differently.
 *
 * ## The one that matters
 *
 * `requested` is deliberately a *warning* tone rather than a neutral or
 * success one. An appointment the clinic has not confirmed is something the
 * patient still has an open question about, and the badge should read that
 * way. `phase_09.md` sections 21 and 48 forbid presenting it as confirmed.
 */
const STATUS_PRESENTATION: Readonly<
  Record<
    AppointmentStatus,
    { readonly status: BadgeStatus; readonly label: string }
  >
> = {
  requested: { status: "pending", label: "Requested" },
  confirmed: { status: "confirmed", label: "Confirmed" },
  checked_in: { status: "scheduled", label: "Checked in" },
  in_consultation: { status: "scheduled", label: "In consultation" },
  completed: { status: "completed", label: "Completed" },
  cancelled: { status: "cancelled", label: "Cancelled" },
  no_show: { status: "missed", label: "Missed" },
};

export function AppointmentStatusBadge({
  status,
}: {
  readonly status: AppointmentStatus;
}) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <StatusBadge status={presentation.status} label={presentation.label} />
  );
}

/** The word this product uses for a status, for prose rather than a badge. */
export function appointmentStatusLabel(status: AppointmentStatus): string {
  return STATUS_PRESENTATION[status].label;
}
