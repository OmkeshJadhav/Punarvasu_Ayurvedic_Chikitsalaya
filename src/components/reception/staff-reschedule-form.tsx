"use client";

import { useActionState, useState } from "react";

import { DatePickerStrip } from "@/components/appointments/date-picker-strip";
import { TimeSlotPicker } from "@/components/appointments/time-slot-picker";
import {
  useAvailableSlots,
  type AvailableSlot,
} from "@/components/appointments/use-available-slots";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  clinicWallClockToInstant,
  formatClinicDate,
  formatClinicDateTime,
  formatClinicTimeRange,
} from "@/features/appointments/time";
import { rescheduleAppointmentForPatientAction } from "@/features/reception/actions";
import { APPOINTMENT_ACTIONS_COPY } from "@/features/reception/content";
import { IDLE_RECEPTION_FORM_STATE } from "@/features/reception/types";

/**
 * Moving an appointment on a patient's behalf.
 *
 * ## It reuses the pickers rather than resembling them
 *
 * `DatePickerStrip`, `TimeSlotPicker` and `useAvailableSlots` are Phase 09's,
 * shared by four flows now — patient booking, patient rescheduling, staff
 * booking and this. Choosing a time is the same task every time, and four
 * implementations would drift: one would grow the loading state the others
 * lack.
 *
 * ## What the server does that this does not
 *
 * Everything that matters. `reschedule_appointment_as_staff` re-derives the
 * duration from the stored appointment type — so a reschedule cannot lengthen
 * an appointment — re-runs every booking rule through the one shared
 * validator, and relies on the same exclusion constraint, which makes a
 * reschedule exactly as safe under concurrency as a booking
 * (`phase_10.md` section 21).
 *
 * The appointment's own current slot is not excluded from the busy list, so
 * its existing time is not offered back. That is correct rather than a
 * limitation: choosing the time it already has is not a reschedule.
 *
 * ## The status is preserved
 *
 * Unlike the patient path, a confirmed appointment moved by the front desk
 * stays confirmed — the clinic is the one moving it, so sending its own change
 * back to itself for approval would be ceremony, and would make a confirmed
 * patient's appointment look unconfirmed to them.
 */
export interface StaffRescheduleFormProps {
  readonly appointmentId: string;
  readonly practitionerId: string;
  readonly appointmentTypeId: string;
  readonly currentStartsAt: string;
  readonly currentEndsAt: string;
  /** Bookable clinic dates for this practitioner, computed on the server. */
  readonly dates: readonly string[];
}

export function StaffRescheduleForm({
  appointmentId,
  practitionerId,
  appointmentTypeId,
  currentStartsAt,
  currentEndsAt,
  dates,
}: StaffRescheduleFormProps) {
  const [state, formAction, pending] = useActionState(
    rescheduleAppointmentForPatientAction,
    IDLE_RECEPTION_FORM_STATE,
  );

  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);

  const { status, slots, reload } = useAvailableSlots({
    practitionerId,
    appointmentTypeId,
    date,
  });

  /*
   * A rejected move — usually because somebody took the slot first — clears
   * the choice and refetches, so the receptionist is not looking at a list
   * that is known to be wrong. Adjusted during render rather than in an
   * effect, for the reason set out at length in the booking flow.
   */
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "error") {
      setSlot(null);
      reload();
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <p className="text-body-sm text-muted-foreground">
        {APPOINTMENT_ACTIONS_COPY.currentTimeLabel}{" "}
        <strong className="text-foreground font-medium">
          <time dateTime={currentStartsAt}>
            {formatClinicDateTime(new Date(currentStartsAt))}
          </time>
        </strong>{" "}
        (
        {formatClinicTimeRange(
          new Date(currentStartsAt),
          new Date(currentEndsAt),
        )}
        )
      </p>

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="We couldn't move that appointment">
          {state.message}
        </Alert>
      ) : null}

      <section
        aria-labelledby="staff-reschedule-date-heading"
        className="flex flex-col gap-4"
      >
        <h3
          id="staff-reschedule-date-heading"
          className="text-h5 text-heading font-sans font-medium"
        >
          Which day?
        </h3>
        <DatePickerStrip
          dates={dates}
          selected={date}
          onSelect={(next) => {
            setDate(next);
            setSlot(null);
          }}
          label="Which day?"
        />
      </section>

      {date ? (
        <section
          aria-labelledby="staff-reschedule-time-heading"
          className="flex flex-col gap-4"
        >
          <h3
            id="staff-reschedule-time-heading"
            className="text-h5 text-heading font-sans font-medium"
          >
            Which time?
          </h3>
          <p className="text-body-sm text-muted-foreground">
            {formatClinicDate(
              clinicWallClockToInstant(date, 12 * 60) ?? new Date(),
            )}
          </p>

          <TimeSlotPicker
            status={status}
            slots={slots}
            selected={slot?.startsAt ?? null}
            onSelect={setSlot}
            onRetry={reload}
            label="Which time?"
          />
        </section>
      ) : null}

      <input type="hidden" name="appointmentId" value={appointmentId} />
      {slot ? (
        <input type="hidden" name="startsAt" value={slot.startsAt} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Button
          type="submit"
          // Disabled until there is something to submit. Not a security
          // control — the action and the database both refuse a missing or
          // malformed time — just a way of not inviting a pointless round trip.
          disabled={!slot}
          loading={pending}
          loadingLabel={APPOINTMENT_ACTIONS_COPY.rescheduleSubmittingLabel}
        >
          {APPOINTMENT_ACTIONS_COPY.rescheduleSubmitLabel}
        </Button>
      </div>
    </form>
  );
}
