import { StatusBadge, type BadgeStatus } from "@/components/ui/badge";
import { TREATMENT_PLAN_STATUS_LABELS } from "@/features/treatment-plans/content";
import type { TreatmentPlanStatus } from "@/features/treatment-plans/types";

/**
 * A treatment plan's status, as icon plus word — never colour alone.
 *
 * `active` maps onto the `confirmed` preset rather than a preset of its own:
 * the design system binds a tone, an icon and a default label to each status,
 * and adding a tenth preset for a word only this feature uses would be a
 * token invented for one screen.
 */
const STATUS_PRESENTATION: Readonly<Record<TreatmentPlanStatus, BadgeStatus>> =
  {
    draft: "draft",
    active: "confirmed",
    completed: "completed",
    cancelled: "cancelled",
  };

export function TreatmentPlanStatusBadge({
  status,
}: {
  readonly status: TreatmentPlanStatus;
}) {
  return (
    <StatusBadge
      status={STATUS_PRESENTATION[status]}
      label={TREATMENT_PLAN_STATUS_LABELS[status]}
    />
  );
}
