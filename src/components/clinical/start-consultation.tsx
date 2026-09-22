"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startConsultationAction } from "@/features/clinical/actions";
import { CONSULTATION_WORKSPACE_COPY } from "@/features/clinical/content";
import { IDLE_CLINICAL_FORM_STATE } from "@/features/clinical/types";

/**
 * Opens the clinical record for an appointment.
 *
 * ## What pressing this actually does
 *
 * One call to `start_consultation`, which creates the draft record — deriving
 * the patient and the practitioner from the appointment — and moves the
 * appointment `checked_in -> in_consultation` in the same transaction
 * (sections 18 and 71). It is the seam Phase 11 left: the route, the
 * authorization and the patient context already existed, and this is the
 * thing that now persists.
 *
 * ## Why a double-click is harmless
 *
 * Three layers, and only the first is in the browser.
 *
 * `loading` disables the button for the whole request, so an impatient second
 * click has nothing to press. If one gets through anyway — a retry, a
 * refresh, two devices — `start_consultation` inserts
 * `on conflict (appointment_id) do nothing` and reads back the record that
 * exists, so the second caller gets the first caller's record rather than an
 * error. And beneath both, `clinical_records_one_per_appointment` is a unique
 * index, which is what makes two *genuinely concurrent* requests resolve to
 * one row under the database's own concurrency control (section 87).
 *
 * An application-level "does one already exist?" check would be passed by
 * both of two concurrent requests, which is the same reason Phase 09 put
 * double-booking prevention in an exclusion constraint.
 *
 * ## No optimistic state
 *
 * The page it is on is server-rendered from the record, and the action
 * revalidates it. Nothing here claims a consultation has started before the
 * database says one has (example 9).
 */
export function StartConsultation({
  appointmentId,
}: {
  readonly appointmentId: string;
}) {
  const [state, formAction, pending] = useActionState(
    startConsultationAction,
    IDLE_CLINICAL_FORM_STATE,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction}>
        {/*
          Safe to render: it says *which* appointment, never *whether the
          caller may*. The practitioner is resolved from `auth.uid()` inside
          the database, the appointment is resolved by id *and* by that
          practitioner, and the patient written onto the record is read out of
          the appointment row — so there is no patient id or doctor id here to
          manipulate, and nowhere for one to arrive.
        */}
        <input type="hidden" name="appointmentId" value={appointmentId} />

        <Button
          type="submit"
          loading={pending}
          loadingLabel={CONSULTATION_WORKSPACE_COPY.startingLabel}
        >
          {CONSULTATION_WORKSPACE_COPY.startLabel}
        </Button>
      </form>

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title={CONSULTATION_WORKSPACE_COPY.startLabel}>
          {state.message}
        </Alert>
      ) : null}
    </div>
  );
}
