import { StatusBadge, type BadgeStatus } from "@/components/ui/badge";
import { PRESCRIPTION_STATUS_LABELS } from "@/features/prescriptions/content";
import type { PrescriptionStatus } from "@/features/prescriptions/types";

/**
 * A prescription's status, as icon plus word.
 *
 * Never colour alone (`docs/DESIGN_SYSTEM.md` and WCAG 1.4.1): each status
 * maps onto one of the design system's presets, which binds a tone *and* an
 * icon *and* a default label together, and the label is overridden only to
 * say "Withdrawn" where the preset says "Cancelled" — the word a practitioner
 * and a patient both use about a prescription.
 */
const STATUS_PRESENTATION: Readonly<Record<PrescriptionStatus, BadgeStatus>> = {
  draft: "draft",
  issued: "confirmed",
  cancelled: "cancelled",
  amended: "rescheduled",
};

export function PrescriptionStatusBadge({
  status,
}: {
  readonly status: PrescriptionStatus;
}) {
  return (
    <StatusBadge
      status={STATUS_PRESENTATION[status]}
      label={PRESCRIPTION_STATUS_LABELS[status]}
    />
  );
}
