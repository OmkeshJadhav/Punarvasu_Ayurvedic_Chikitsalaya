"use client";

import { useEffect, useState } from "react";

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
import type { AppointmentStatus } from "@/features/appointments/types";
import { updateAppointmentStatusAction } from "@/features/reception/actions";
import { APPOINTMENT_ACTIONS_COPY } from "@/features/reception/content";
import {
  staffActionsFor,
  type StaffStatusAction,
} from "@/features/reception/status";
import { IDLE_RECEPTION_FORM_STATE } from "@/features/reception/types";
import { useActionState } from "react";

/**
 * The operational actions the front desk can take on an appointment.
 *
 * ## Which buttons appear
 *
 * `staffActionsFor(status)` composes two rules — is the transition legal, and
 * may this role set that status — and neither is restated here
 * (`phase_10.md` example 5). A terminal appointment renders a sentence instead
 * of a row of disabled buttons, because a disabled control tells somebody
 * nothing they can act on.
 *
 * **None of this is the security boundary.** The action re-checks the
 * permission, the database function re-checks the role and the status
 * allowlist, and the Phase 09 transition trigger refuses an illegal move
 * whatever any of them decided. A button rendered ten minutes ago is not
 * evidence: by the time it is clicked, another receptionist may have confirmed
 * the same appointment.
 *
 * ## Which actions ask first
 *
 * Cancelling and marking a no-show do; confirming and checking in do not
 * (`phase_10.md` sections 20 and 30, `docs/PRODUCT_SPEC.md` section 19). The
 * distinction is whether the front desk can put it back: a confirmed
 * appointment can still be cancelled, but a no-show is a record that somebody
 * did not attend and cancelling frees the slot for another patient. Asking
 * before every action is how people learn to dismiss dialogs without reading
 * them.
 *
 * ## Why there is no optimistic update
 *
 * `phase_10.md` section 44: never show a successful update before the server
 * confirms it. Two receptionists can act on the same appointment at the same
 * moment, and a status that flicked to "Confirmed" and back would be worse
 * than one that took a moment to arrive. The button carries `loading` for the
 * whole request, which also prevents a double submission (section 46).
 */
export function AppointmentStatusActions({
  appointmentId,
  status,
}: {
  readonly appointmentId: string;
  readonly status: AppointmentStatus;
}) {
  const actions = staffActionsFor(status);

  if (actions.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground measure">
        {APPOINTMENT_ACTIONS_COPY.noneAvailable}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {actions.map((action) => (
        <StatusAction
          key={action.status}
          appointmentId={appointmentId}
          action={action}
        />
      ))}
    </div>
  );
}

/**
 * One action's button, and its confirmation when it needs one.
 *
 * Each gets its own `useActionState`, so a failure is reported beside the
 * control that caused it rather than beside all of them.
 */
function StatusAction({
  appointmentId,
  action,
}: {
  readonly appointmentId: string;
  readonly action: StaffStatusAction;
}) {
  const [state, formAction, pending] = useActionState(
    updateAppointmentStatusAction,
    IDLE_RECEPTION_FORM_STATE,
  );
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  /**
   * Closes the dialog once the server has actually done it.
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
   * during render is not allowed.
   */
  useEffect(() => {
    if (state.status !== "success" || !state.message) return;
    toast({ tone: "success", title: state.message });
  }, [state, toast]);

  const hiddenFields = (
    <>
      {/*
        Safe to render: they say *which* appointment and *what to do*, never
        *whether the caller may*. The actor, the actor's role, the status
        allowlist and the transition matrix are all resolved server-side and
        again inside the database function.
      */}
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="status" value={action.status} />
    </>
  );

  if (!action.confirm) {
    return (
      <div className="flex flex-col gap-2">
        <form action={formAction}>
          {hiddenFields}
          <Button
            type="submit"
            variant={action.status === "confirmed" ? "primary" : "secondary"}
            loading={pending}
            loadingLabel={APPOINTMENT_ACTIONS_COPY.workingLabel}
          >
            {action.label}
          </Button>
        </form>
        {state.status === "error" && state.message ? (
          <Alert tone="danger" title={action.label}>
            {state.message}
          </Alert>
        ) : null}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={action.destructive ? "destructive" : "secondary"}>
          {action.label}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form action={formAction} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {APPOINTMENT_ACTIONS_COPY.confirmDialogTitle(action.label)}
            </DialogTitle>
            <DialogDescription>
              {action.status === "cancelled"
                ? APPOINTMENT_ACTIONS_COPY.cancelBody
                : APPOINTMENT_ACTIONS_COPY.noShowBody}
            </DialogDescription>
          </DialogHeader>

          {state.status === "error" && state.message ? (
            <Alert tone="danger" title={action.label}>
              {state.message}
            </Alert>
          ) : null}

          <Field
            name="reason"
            label={APPOINTMENT_ACTIONS_COPY.reasonLabel}
            description={APPOINTMENT_ACTIONS_COPY.reasonDescription}
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

          {hiddenFields}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {APPOINTMENT_ACTIONS_COPY.dismissLabel}
            </Button>
            <Button
              type="submit"
              variant={action.destructive ? "destructive" : "primary"}
              loading={pending}
              loadingLabel={APPOINTMENT_ACTIONS_COPY.workingLabel}
            >
              {action.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The single most likely next action, for a row in the schedule.
 *
 * `phase_10.md` section 10 asks for prominent but restrained quick actions and
 * warns against a row of buttons per item. So a schedule row offers exactly
 * one — confirm a request, or check in a confirmed patient — and everything
 * else is one tap away on the appointment itself.
 *
 * It renders nothing when there is no non-confirming action to offer, rather
 * than a disabled control.
 */
export function QuickStatusAction({
  appointmentId,
  status,
}: {
  readonly appointmentId: string;
  readonly status: AppointmentStatus;
}) {
  const action = staffActionsFor(status).find(
    (candidate) => !candidate.confirm,
  );
  if (!action) return null;

  return <StatusAction appointmentId={appointmentId} action={action} />;
}
