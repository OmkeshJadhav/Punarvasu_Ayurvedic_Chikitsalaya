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
import { useToast } from "@/components/ui/toast";
import type { AppointmentStatus } from "@/features/appointments/types";
import { updateDoctorAppointmentStatusAction } from "@/features/doctor/actions";
import { DOCTOR_ACTIONS_COPY } from "@/features/doctor/content";
import {
  doctorActionsFor,
  type DoctorStatusAction,
} from "@/features/doctor/status";
import { IDLE_DOCTOR_FORM_STATE } from "@/features/doctor/types";

/**
 * The actions a practitioner can take on one of their own appointments.
 *
 * ## Which buttons appear
 *
 * `doctorActionsFor(status)` composes three rules — is the transition legal,
 * may this role set that status, and may it act from this status — and none
 * is restated here (`phase_11.md` example 7). A terminal appointment renders
 * a sentence instead of a row of disabled buttons, because a disabled control
 * tells somebody nothing they can act on.
 *
 * **None of this is the security boundary.** The action re-checks the
 * permission, `update_appointment_status_as_doctor` re-checks the role,
 * resolves the appointment by the caller's own practitioner id and re-checks
 * the allowlist, and the Phase 09 transition trigger refuses an illegal move
 * whatever any of them decided. A button rendered ten minutes ago is not
 * evidence: by then the front desk may have checked the patient in, or
 * cancelled.
 *
 * ## What is deliberately not here
 *
 * Cancelling and rescheduling. Both change a patient's plans and need
 * somebody to tell them, which is the front desk's work — so the workspace
 * says that in a sentence rather than offering a control that would be
 * refused (`phase_11.md` section 21).
 *
 * ## Which actions ask first
 *
 * Completing and recording a non-attendance do; confirming and starting a
 * consultation do not. The distinction is whether it can be put back:
 * `completed` and `no_show` are terminal, and nothing in the product can move
 * an appointment out of either. Asking before every action is how people
 * learn to dismiss dialogs without reading them.
 *
 * ## Why there is no optimistic update
 *
 * Never show a successful update before the server confirms it. The
 * practitioner and the front desk can act on the same appointment at the same
 * moment, and a status that flicked and came back would be worse than one
 * that took a moment to arrive. The button carries `loading` for the whole
 * request, which also prevents a double submission
 * (`phase_11.md` section 40).
 */
export function DoctorAppointmentActions({
  appointmentId,
  status,
}: {
  readonly appointmentId: string;
  readonly status: AppointmentStatus;
}) {
  const actions = doctorActionsFor(status);

  if (actions.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground measure">
        {DOCTOR_ACTIONS_COPY.noneAvailable}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {actions.map((action) => (
          <StatusAction
            key={action.status}
            appointmentId={appointmentId}
            action={action}
          />
        ))}
      </div>
      <p className="text-body-sm text-muted-foreground measure">
        {DOCTOR_ACTIONS_COPY.deskOnly}
      </p>
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
  variant,
}: {
  readonly appointmentId: string;
  readonly action: DoctorStatusAction;
  readonly variant?: "primary" | "secondary";
}) {
  const [state, formAction, pending] = useActionState(
    updateDoctorAppointmentStatusAction,
    IDLE_DOCTOR_FORM_STATE,
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

  const buttonVariant =
    variant ??
    (action.status === "in_consultation" || action.status === "completed"
      ? "primary"
      : "secondary");

  const hiddenFields = (
    <>
      {/*
        Safe to render: they say *which* appointment and *what to do*, never
        *whether the caller may*. The practitioner identity, the role, the
        status allowlist, the ownership of the appointment and the transition
        matrix are all resolved server-side and again inside the database
        function.
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
            variant={buttonVariant}
            loading={pending}
            loadingLabel={DOCTOR_ACTIONS_COPY.workingLabel}
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
        <Button variant={buttonVariant}>{action.label}</Button>
      </DialogTrigger>

      <DialogContent>
        <form action={formAction} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {DOCTOR_ACTIONS_COPY.confirmDialogTitle(action.label)}
            </DialogTitle>
            <DialogDescription>{action.confirmBody}</DialogDescription>
          </DialogHeader>

          {state.status === "error" && state.message ? (
            <Alert tone="danger" title={action.label}>
              {state.message}
            </Alert>
          ) : null}

          {hiddenFields}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {DOCTOR_ACTIONS_COPY.dismissLabel}
            </Button>
            <Button
              type="submit"
              loading={pending}
              loadingLabel={DOCTOR_ACTIONS_COPY.workingLabel}
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
 * `phase_11.md` section 9 gives a schedule row one action column, and section
 * 3 asks the workspace not to become cluttered. So a row offers exactly one
 * button — confirm a request, start a consultation with a checked-in patient
 * — and everything else is one tap away on the appointment itself.
 *
 * It offers only actions that do not need confirming, so a dialog never opens
 * from a list row; and it renders nothing when there is no such action,
 * rather than a disabled control.
 */
export function PrimaryDoctorAction({
  appointmentId,
  status,
}: {
  readonly appointmentId: string;
  readonly status: AppointmentStatus;
}) {
  const action = doctorActionsFor(status).find(
    (candidate) => !candidate.confirm,
  );
  if (!action) return null;

  return <StatusAction appointmentId={appointmentId} action={action} />;
}

/**
 * The completion action on its own, for the consultation page.
 *
 * Rendered separately from the full action row because on that page it is the
 * one thing the practitioner is there to do at the end, and it should not sit
 * in a line of alternatives.
 */
export function CompleteConsultationAction({
  appointmentId,
}: {
  readonly appointmentId: string;
}) {
  const action = doctorActionsFor("in_consultation").find(
    (candidate) => candidate.status === "completed",
  );
  if (!action) return null;

  return (
    <StatusAction
      appointmentId={appointmentId}
      action={action}
      variant="primary"
    />
  );
}
