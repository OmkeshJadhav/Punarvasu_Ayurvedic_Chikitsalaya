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
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cancelPrescriptionAction } from "@/features/prescriptions/actions";
import { PRESCRIPTION_BUILDER_COPY } from "@/features/prescriptions/content";
import { IDLE_PRESCRIPTION_FORM_STATE } from "@/features/prescriptions/types";
import { CANCELLATION_REASON_LIMIT } from "@/features/prescriptions/validation";

/**
 * Withdrawing an issued prescription (`phase_13.md` sections 42-43).
 *
 * The only action available on a prescription that is no longer a draft, and
 * it is a **status change, never a delete**: the row, its items and its issue
 * time survive, the patient is shown that it is withdrawn, and the
 * consultation becomes free for a corrected prescription. That is the
 * amendment path section 42 describes, reachable without a formal versioning
 * subsystem and without ever rewriting what was issued.
 *
 * It asks first, because it changes what a patient has been told to take. The
 * reason is optional and the field says the patient will see it.
 */
export function WithdrawPrescription({
  prescriptionId,
  version,
}: {
  readonly prescriptionId: string;
  readonly version: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    cancelPrescriptionAction,
    IDLE_PRESCRIPTION_FORM_STATE,
  );

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "cancelled") setOpen(false);
  }

  useEffect(() => {
    if (state.status !== "cancelled") return;
    router.refresh();
  }, [state.status, router]);

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        {PRESCRIPTION_BUILDER_COPY.cancelLabel}
      </Button>

      {state.status === "conflict" && state.message ? (
        <Alert tone="warning" title={PRESCRIPTION_BUILDER_COPY.statusFailed}>
          {state.message}
        </Alert>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="prescriptionId" value={prescriptionId} />
            <input type="hidden" name="expectedVersion" value={version} />

            <DialogHeader>
              <DialogTitle>
                {PRESCRIPTION_BUILDER_COPY.cancelDialogTitle}
              </DialogTitle>
              <DialogDescription>
                {PRESCRIPTION_BUILDER_COPY.cancelDialogBody}
              </DialogDescription>
            </DialogHeader>

            <Field
              name="reason"
              label={PRESCRIPTION_BUILDER_COPY.cancelReasonLabel}
              description={PRESCRIPTION_BUILDER_COPY.cancelReasonDescription}
              disabled={pending}
            >
              {(control) => (
                <Textarea
                  {...control}
                  rows={3}
                  maxLength={CANCELLATION_REASON_LIMIT}
                  autoComplete="off"
                  data-1p-ignore
                />
              )}
            </Field>

            {state.status === "error" && state.message ? (
              <Alert
                tone="danger"
                title={PRESCRIPTION_BUILDER_COPY.statusFailed}
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
                {PRESCRIPTION_BUILDER_COPY.cancelDialogDismiss}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                loading={pending}
                loadingLabel={PRESCRIPTION_BUILDER_COPY.cancellingLabel}
                disabled={pending}
              >
                {PRESCRIPTION_BUILDER_COPY.cancelDialogConfirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
