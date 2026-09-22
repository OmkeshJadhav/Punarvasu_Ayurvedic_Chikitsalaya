"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelTreatmentPlanAction,
  completeTreatmentPlanAction,
} from "@/features/treatment-plans/actions";
import { TREATMENT_PLAN_BUILDER_COPY } from "@/features/treatment-plans/content";
import { IDLE_TREATMENT_PLAN_FORM_STATE } from "@/features/treatment-plans/types";

/**
 * What a practitioner can still do to an **active** plan (sections 44-45).
 *
 * Not edit it — an active plan is what the patient was told to do, and
 * rewriting it would rewrite what they were told. Only close it: mark it
 * complete when the course is finished, or withdraw it when it should no
 * longer be followed. Either one frees the consultation for a new plan and
 * leaves this one intact.
 *
 * Both ask first: both change what a patient believes they should be doing.
 */
export function TreatmentPlanActions({
  planId,
  version,
}: {
  readonly planId: string;
  readonly version: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <PlanTransition
        planId={planId}
        version={version}
        action="complete"
        trigger={TREATMENT_PLAN_BUILDER_COPY.completeLabel}
        title={TREATMENT_PLAN_BUILDER_COPY.completeDialogTitle}
        body={TREATMENT_PLAN_BUILDER_COPY.completeDialogBody}
        confirm={TREATMENT_PLAN_BUILDER_COPY.completeDialogConfirm}
        dismiss={TREATMENT_PLAN_BUILDER_COPY.completeDialogDismiss}
        pendingLabel={TREATMENT_PLAN_BUILDER_COPY.completingLabel}
      />
      <PlanTransition
        planId={planId}
        version={version}
        action="cancel"
        trigger={TREATMENT_PLAN_BUILDER_COPY.cancelLabel}
        title={TREATMENT_PLAN_BUILDER_COPY.cancelDialogTitle}
        body={TREATMENT_PLAN_BUILDER_COPY.cancelDialogBody}
        confirm={TREATMENT_PLAN_BUILDER_COPY.cancelDialogConfirm}
        dismiss={TREATMENT_PLAN_BUILDER_COPY.cancelDialogDismiss}
        pendingLabel={TREATMENT_PLAN_BUILDER_COPY.cancellingLabel}
        destructive
      />
    </div>
  );
}

function PlanTransition({
  planId,
  version,
  action,
  trigger,
  title,
  body,
  confirm,
  dismiss,
  pendingLabel,
  destructive = false,
}: {
  readonly planId: string;
  readonly version: number;
  readonly action: "complete" | "cancel";
  readonly trigger: string;
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly dismiss: string;
  readonly pendingLabel: string;
  readonly destructive?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    action === "complete"
      ? completeTreatmentPlanAction
      : cancelTreatmentPlanAction,
    IDLE_TREATMENT_PLAN_FORM_STATE,
  );

  const settled = state.status === "completed" || state.status === "cancelled";

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (settled) setOpen(false);
  }

  useEffect(() => {
    if (!settled) return;
    router.refresh();
  }, [settled, router]);

  return (
    <>
      <Button
        type="button"
        variant={destructive ? "ghost" : "secondary"}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>

      {state.status === "conflict" && state.message ? (
        <Alert tone="warning" title={TREATMENT_PLAN_BUILDER_COPY.statusFailed}>
          {state.message}
        </Alert>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="treatmentPlanId" value={planId} />
            <input type="hidden" name="expectedVersion" value={version} />

            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{body}</DialogDescription>
            </DialogHeader>

            {state.status === "error" && state.message ? (
              <Alert
                tone="danger"
                title={TREATMENT_PLAN_BUILDER_COPY.statusFailed}
              >
                {state.message}
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                {dismiss}
              </Button>
              <Button
                type="submit"
                variant={destructive ? "destructive" : "primary"}
                loading={pending}
                loadingLabel={pendingLabel}
                disabled={pending}
              >
                {confirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
