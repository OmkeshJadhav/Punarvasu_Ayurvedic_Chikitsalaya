"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createPrescriptionAction } from "@/features/prescriptions/actions";
import { PRESCRIPTION_BUILDER_COPY } from "@/features/prescriptions/content";
import { IDLE_PRESCRIPTION_FORM_STATE } from "@/features/prescriptions/types";

/**
 * Opens a draft prescription for a consultation.
 *
 * The one hidden field says *which consultation*, never *whether the caller
 * may*: the practitioner is resolved from `auth.uid()` inside the database,
 * the consultation is resolved by id **and** by that practitioner, and the
 * patient and the appointment written onto the prescription are read out of
 * the consultation row. There is no patient id or doctor id here to
 * manipulate, and nowhere for one to arrive.
 *
 * The button is disabled for the duration of the request so a double-click
 * does not send two — but that is a courtesy. What actually prevents a second
 * prescription is the partial unique index in the database, and the function
 * reads back whichever request won rather than failing the loser
 * (section 73).
 */
export function StartPrescription({
  clinicalRecordId,
}: {
  readonly clinicalRecordId: string;
}) {
  const [state, formAction, pending] = useActionState(
    createPrescriptionAction,
    IDLE_PRESCRIPTION_FORM_STATE,
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction}>
        <input type="hidden" name="clinicalRecordId" value={clinicalRecordId} />
        <Button
          type="submit"
          loading={pending}
          loadingLabel={PRESCRIPTION_BUILDER_COPY.startingLabel}
        >
          {PRESCRIPTION_BUILDER_COPY.startLabel}
        </Button>
      </form>

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title={PRESCRIPTION_BUILDER_COPY.startLabel}>
          {state.message}
        </Alert>
      ) : null}
    </div>
  );
}
