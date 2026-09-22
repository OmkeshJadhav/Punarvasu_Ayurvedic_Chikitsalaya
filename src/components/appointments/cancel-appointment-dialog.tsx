"use client";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { CANCELLATION_REASON_MAX_LENGTH } from "@/config/appointments";
import { cancelAppointmentAction } from "@/features/appointments/actions";
import { CANCEL_COPY } from "@/features/appointments/content";
import { IDLE_APPOINTMENT_FORM_STATE } from "@/features/appointments/types";

/**
 * Cancelling an appointment, with the confirmation it deserves.
 *
 * ## Why a dialog
 *
 * Cancelling is destructive and not obviously reversible from the patient's
 * point of view — the slot goes back to the clinic and may be taken.
 * `docs/PRODUCT_SPEC.md` section 19 and `docs/DESIGN_SYSTEM.md` section 31
 * both ask for an explicit confirmation for exactly this, and `phase_09.md`
 * section 27 names the wording.
 *
 * `Dialog` is the Phase 02 primitive, so focus is trapped, Escape closes,
 * focus returns to the trigger and the background is inert — none of which is
 * re-implemented here.
 *
 * ## The reason is optional, and says so
 *
 * `phase_09.md` section 27 asks that a reason be collected without requesting
 * unnecessary medical information. The label asks whether they would *like* to
 * say, the helper text says it is never required and asks them to keep it to
 * scheduling, and the field is bounded. A patient who cancels because they are
 * unwell should not feel obliged to type that into a booking system.
 *
 * ## What it does not do
 *
 * It does not delete anything. The action calls `cancel_appointment`, which
 * sets a status and records who and when; the appointment and its history
 * survive (`phase_09.md` example 6).
 */
export function CancelAppointmentDialog({
  appointmentId,
}: {
  readonly appointmentId: string;
}) {
  const [state, formAction, pending] = useActionState(
    cancelAppointmentAction,
    IDLE_APPOINTMENT_FORM_STATE,
  );
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  /**
   * Closes the dialog once the server has actually cancelled it.
   *
   * Adjusted during render — React's documented pattern for reacting to a
   * changed value — so the dialog is gone in the same frame as the result
   * rather than one frame later. Keyed on the state object's identity rather
   * than its status, because `useActionState` returns a new object per
   * submission, so a second attempt after an error is a separate event.
   */
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") setOpen(false);
  }

  /**
   * Announces it.
   *
   * This one *is* an effect, and correctly so: `toast` updates the toast
   * region, which is a different component, and updating another component
   * during render is not allowed. Announcing a completed action to something
   * outside this component is exactly what an effect is for.
   */
  useEffect(() => {
    if (state.status !== "success") return;

    toast({
      tone: "success",
      title: CANCEL_COPY.successTitle,
      description: CANCEL_COPY.successBody,
    });
  }, [state, toast]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">{CANCEL_COPY.triggerLabel}</Button>
      </DialogTrigger>

      <DialogContent>
        {/*
          The form lives inside the dialog and owns its own element. Exactly
          two fields, matching what the action reads: the appointment id and an
          optional reason. No status, no patient id, no timestamps.
        */}
        <form action={formAction} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{CANCEL_COPY.title}</DialogTitle>
            <DialogDescription>{CANCEL_COPY.body}</DialogDescription>
          </DialogHeader>

          {state.status === "error" && state.message ? (
            <Alert tone="danger" title="We couldn't cancel it">
              {state.message}
            </Alert>
          ) : null}

          <Field
            name="reason"
            label={CANCEL_COPY.reasonLabel}
            description={CANCEL_COPY.reasonDescription}
            error={state.fieldErrors?.["reason"]}
          >
            {(control) => (
              <Textarea
                rows={2}
                maxLength={CANCELLATION_REASON_MAX_LENGTH}
                {...control}
              />
            )}
          </Field>

          {/*
            Safe to render: it says *which* appointment, never *whether*. The
            database looks it up by this id **and** by the caller's own patient
            record in one statement, so somebody else's id is indistinguishable
            from one that does not exist (`phase_09.md` section 35).
          */}
          <input type="hidden" name="appointmentId" value={appointmentId} />

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {CANCEL_COPY.dismissLabel}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              loading={pending}
              loadingLabel={CANCEL_COPY.confirmingLabel}
            >
              {CANCEL_COPY.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
