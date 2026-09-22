"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createTreatmentPlanAction } from "@/features/treatment-plans/actions";
import { TREATMENT_PLAN_BUILDER_COPY } from "@/features/treatment-plans/content";
import { IDLE_TREATMENT_PLAN_FORM_STATE } from "@/features/treatment-plans/types";

/**
 * Opens a draft treatment plan for a consultation.
 *
 * The one hidden field says *which consultation*. The practitioner, the
 * patient and the appointment are all derived from it inside the database
 * after `assert_care_practitioner()` has resolved the caller's own
 * practitioner record — so there is no identity here to manipulate.
 *
 * Idempotent at the database level: a double-click, a retry and two
 * concurrent requests all resolve to one plan.
 */
export function StartTreatmentPlan({
  clinicalRecordId,
}: {
  readonly clinicalRecordId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createTreatmentPlanAction,
    IDLE_TREATMENT_PLAN_FORM_STATE,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction}>
        <input type="hidden" name="clinicalRecordId" value={clinicalRecordId} />
        <Button
          type="submit"
          loading={pending}
          loadingLabel={TREATMENT_PLAN_BUILDER_COPY.startingLabel}
        >
          {TREATMENT_PLAN_BUILDER_COPY.startLabel}
        </Button>
      </form>

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title={TREATMENT_PLAN_BUILDER_COPY.startLabel}>
          {state.message}
        </Alert>
      ) : null}
    </div>
  );
}
