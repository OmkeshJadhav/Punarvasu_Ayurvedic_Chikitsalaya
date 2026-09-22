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
import { rescheduleAppointmentAction } from "@/features/appointments/actions";
import { BOOKING_COPY, RESCHEDULE_COPY } from "@/features/appointments/content";
import {
  clinicWallClockToInstant,
  formatClinicDate,
  formatClinicDateTime,
  formatClinicTimeRange,
} from "@/features/appointments/time";
import { IDLE_APPOINTMENT_FORM_STATE } from "@/features/appointments/types";

/**
 * Moving an existing appointment to a new time.
 *
 * ## Why it reuses the booking pickers rather than resembling them
 *
 * Choosing a time is the same task whether it is the first time or the second,
 * and two implementations of it would drift — one would grow the loading state
 * the other lacks. `DatePickerStrip`, `TimeSlotPicker` and `useAvailableSlots`
 * are shared, so the three states a slot list can be in are identical in both
 * flows.
 *
 * ## What the server does that this does not
 *
 * Everything that matters. `reschedule_appointment` re-derives the duration
 * from the stored appointment type — so a patient cannot lengthen their own
 * appointment by rescheduling — re-runs every booking rule, and relies on the
 * same exclusion constraint, which makes a reschedule exactly as safe under
 * concurrency as a booking (`phase_09.md` section 30).
 *
 * The appointment's own current slot is not excluded from the busy list, so
 * its existing time is not offered back. That is correct rather than a
 * limitation: choosing the time it already has is not a reschedule.
 */
export interface RescheduleFormProps {
  readonly appointmentId: string;
  readonly practitionerId: string;
  readonly appointmentTypeId: string;
  readonly currentStartsAt: string;
  readonly currentEndsAt: string;
  /** Bookable clinic dates for this practitioner, computed on the server. */
  readonly dates: readonly string[];
}

export function RescheduleForm({
  appointmentId,
  practitionerId,
  appointmentTypeId,
  currentStartsAt,
  currentEndsAt,
  dates,
}: RescheduleFormProps) {
  const [state, formAction, pending] = useActionState(
    rescheduleAppointmentAction,
    IDLE_APPOINTMENT_FORM_STATE,
  );

  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);

  const { status, slots, reload } = useAvailableSlots({
    practitionerId,
    appointmentTypeId,
    date,
  });

  // A rejected move — usually because somebody took the slot first — clears
  // the choice and refetches, so the patient is not looking at a list that is
  // known to be wrong (`phase_09.md` section 42).
  //
  // Adjusted during render rather than in an effect, for the reason set out at
  // length in `booking-flow.tsx`: an effect would paint one frame with the
  // stale selection still chosen, and would be the cascading render
  // `react-hooks/set-state-in-effect` exists to prevent.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "error") {
      setSlot(null);
      reload();
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <p className="text-body-sm text-muted-foreground">
        {RESCHEDULE_COPY.currentTimeLabel}{" "}
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
        aria-labelledby="reschedule-date-heading"
        className="flex flex-col gap-4"
      >
        <h2
          id="reschedule-date-heading"
          className="text-h4 text-heading font-sans font-medium"
        >
          {BOOKING_COPY.dateHeading}
        </h2>
        <DatePickerStrip
          dates={dates}
          selected={date}
          onSelect={(next) => {
            setDate(next);
            setSlot(null);
          }}
          label={BOOKING_COPY.dateHeading}
        />
      </section>

      {date ? (
        <section
          aria-labelledby="reschedule-time-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="reschedule-time-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {BOOKING_COPY.timeHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground">
            {formatClinicDate(
              clinicWallClockToInstant(date, 12 * 60) ?? new Date(),
            )}
            {" · "}
            {BOOKING_COPY.timeDescription}
          </p>

          <TimeSlotPicker
            status={status}
            slots={slots}
            selected={slot?.startsAt ?? null}
            onSelect={setSlot}
            onRetry={reload}
            label={BOOKING_COPY.timeHeading}
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
          size="lg"
          // Disabled until there is something to submit. Not a security
          // control — the action and the database both refuse a missing or
          // malformed time — just a way of not inviting a pointless round trip.
          disabled={!slot}
          loading={pending}
          loadingLabel={RESCHEDULE_COPY.submittingLabel}
        >
          {RESCHEDULE_COPY.submitLabel}
        </Button>
      </div>
    </form>
  );
}
