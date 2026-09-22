import { StatusBadge, type BadgeStatus } from "@/components/ui/badge";
import { CLINICAL_STATUS_LABELS } from "@/features/clinical/content";
import type { ClinicalRecordStatus } from "@/features/clinical/types";

/**
 * A clinical record's state, as a badge.
 *
 * A translation table and nothing more, in the shape
 * `AppointmentStatusBadge` established: `StatusBadge` owns the tone-plus-icon
 * pairing so a status is never communicated by colour alone
 * (`docs/DESIGN_SYSTEM.md` section 5), and this owns the vocabulary.
 *
 * ## The one that matters
 *
 * `draft` is the design system's neutral `draft` preset rather than a warning
 * tone. An unfinished consultation is an ordinary state — a practitioner
 * saves a draft on purpose and comes back to it — and colouring it as a
 * problem would make the normal case look like an error. What carries the
 * urgency is the *save status* on the form, which is where a practitioner is
 * actually at risk of losing something.
 *
 * `amended` is unreachable in Phase 12 and is still mapped, so a row carrying
 * it renders rather than falling through to an undefined preset the day the
 * amendment workflow arrives.
 */
const STATUS_PRESENTATION: Readonly<Record<ClinicalRecordStatus, BadgeStatus>> =
  {
    draft: "draft",
    completed: "completed",
    amended: "rescheduled",
  };

export function ClinicalRecordStatusBadge({
  status,
}: {
  readonly status: ClinicalRecordStatus;
}) {
  return (
    <StatusBadge
      status={STATUS_PRESENTATION[status]}
      label={CLINICAL_STATUS_LABELS[status]}
    />
  );
}
