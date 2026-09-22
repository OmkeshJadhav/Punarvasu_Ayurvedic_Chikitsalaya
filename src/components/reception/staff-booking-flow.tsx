"use client";

import { useActionState, useState } from "react";

import { DatePickerStrip } from "@/components/appointments/date-picker-strip";
import { TimeSlotPicker } from "@/components/appointments/time-slot-picker";
import {
  useAvailableSlots,
  type AvailableSlot,
} from "@/components/appointments/use-available-slots";
import { PatientSearch } from "@/components/reception/patient-search";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { PATIENT_NOTE_MAX_LENGTH } from "@/config/appointments";
import {
  clinicWallClockToInstant,
  formatClinicDate,
  formatClinicTimeRange,
  formatDuration,
} from "@/features/appointments/time";
import type { AppointmentType } from "@/features/appointments/types";
import { createAppointmentForPatientAction } from "@/features/reception/actions";
import { STAFF_BOOKING_COPY } from "@/features/reception/content";
import {
  IDLE_RECEPTION_FORM_STATE,
  type PatientSearchResult,
  type SchedulablePractitioner,
} from "@/features/reception/types";
import { cn } from "@/lib/utils/cn";

/**
 * Booking an appointment on a patient's behalf.
 *
 * ```text
 * Patient -> Consultation -> Practitioner -> Date -> Time -> Review -> Book
 * ```
 *
 * which is `phase_10.md` section 16's flow.
 *
 * ## It reuses the patient booking flow's parts rather than resembling them
 *
 * `DatePickerStrip`, `TimeSlotPicker` and `useAvailableSlots` are the same
 * components Phase 09 built, so the three states a slot list can be in are
 * identical in both flows and cannot drift. The availability endpoint is the
 * same one too — it resolves the minimum notice from the caller's role, so the
 * front desk sees the times it may book and a patient sees the times they may.
 *
 * That is the point of `phase_10.md` section 17: no scheduling logic is
 * written here. This component collects five values and posts them.
 *
 * ## One form, owned here, carrying exactly what the action reads
 *
 * `patientId`, `appointmentTypeId`, `practitionerId`, `startsAt`,
 * `patientNote`. There is no field for a status, a duration, an end time or a
 * created-by — those are derived in the database, and the reason a manipulated
 * request cannot set them is that nothing accepts them.
 *
 * `patientId` is the one identifier a staff write takes, because the
 * receptionist genuinely chooses the patient (`phase_10.md` section 18). It
 * says *which* patient, never *whether the caller may act on one*: the
 * caller's identity is `auth.uid()`, the caller's role is read from the
 * database, and the id must resolve to a real patient record or the write is
 * refused.
 *
 * ## What a conflict does
 *
 * If the slot is taken between choosing it and submitting — a patient booking
 * the same time from home is a real race, and the exclusion constraint is what
 * settles it — the flow returns to the time step and **refetches**, because
 * the list on screen is then known to be wrong.
 */
export interface StaffBookingFlowProps {
  readonly appointmentTypes: readonly AppointmentType[];
  readonly practitioners: readonly SchedulablePractitioner[];
  /** Bookable clinic dates per practitioner id, computed on the server. */
  readonly datesByPractitioner: Readonly<Record<string, readonly string[]>>;
  /**
   * The patient, when one was chosen before this screen — from their record,
   * say. Absent means the flow opens on its own patient search.
   */
  readonly patient?: PatientSearchResult | undefined;
}

type Step = "patient" | "type" | "practitioner" | "date" | "time" | "review";

const STEP_LABELS: readonly { readonly id: Step; readonly label: string }[] = [
  { id: "patient", label: "Patient" },
  { id: "type", label: "Consultation" },
  { id: "practitioner", label: "Practitioner" },
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "review", label: "Review" },
];

export function StaffBookingFlow({
  appointmentTypes,
  practitioners,
  datesByPractitioner,
  patient: initialPatient,
}: StaffBookingFlowProps) {
  const [state, formAction, pending] = useActionState(
    createAppointmentForPatientAction,
    IDLE_RECEPTION_FORM_STATE,
  );

  const [patient, setPatient] = useState<PatientSearchResult | null>(
    initialPatient ?? null,
  );
  const [step, setStep] = useState<Step>(initialPatient ? "type" : "patient");
  const [typeId, setTypeId] = useState<string | null>(
    appointmentTypes.length === 1 ? (appointmentTypes[0]?.id ?? null) : null,
  );
  const [practitionerId, setPractitionerId] = useState<string | null>(
    practitioners.length === 1 ? (practitioners[0]?.id ?? null) : null,
  );
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);

  const {
    status: slotsStatus,
    slots,
    reload,
  } = useAvailableSlots({
    practitionerId,
    appointmentTypeId: typeId,
    date,
  });

  const selectedType = appointmentTypes.find((type) => type.id === typeId);
  const selectedPractitioner = practitioners.find(
    (candidate) => candidate.id === practitionerId,
  );

  /*
   * A rejected booking returns to the time step with a fresh list, because the
   * most common failure is that somebody took the slot first.
   *
   * Adjusted during render rather than in an effect — React's documented
   * "adjusting state when a prop changes" pattern. An effect would paint one
   * frame with the stale selection still chosen, and would be the cascading
   * render `react-hooks/set-state-in-effect` exists to prevent. The comparison
   * is on the state object's identity, because `useActionState` returns a new
   * object per submission, so two consecutive conflicts are two events.
   */
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "error" && patient) {
      setSlot(null);
      setStep("time");
      reload();
    }
  }

  const availableDates = practitionerId
    ? (datesByPractitioner[practitionerId] ?? [])
    : [];

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <BookingProgress current={step} />

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="We couldn't book that appointment">
          {state.message}
        </Alert>
      ) : null}

      {/* Step 1 — the patient */}
      {step === "patient" || !patient ? (
        <section
          aria-labelledby="staff-booking-patient-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="staff-booking-patient-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {STAFF_BOOKING_COPY.patientHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure">
            {STAFF_BOOKING_COPY.patientDescription}
          </p>

          <PatientSearch
            autoFocus
            onSelect={(chosen) => {
              setPatient(chosen);
              // A different patient invalidates the time, because the patient
              // overlap constraint is per patient — a slot free for one may
              // clash for another.
              setSlot(null);
              setStep(typeId ? "practitioner" : "type");
            }}
          />
        </section>
      ) : (
        <>
          <SummaryRow
            label={STAFF_BOOKING_COPY.patientChosenLabel}
            value={patient.fullName}
            changeLabel={STAFF_BOOKING_COPY.changePatientLabel}
            onChange={() => setStep("patient")}
          />
          {/*
            Rendered only once a patient is chosen, and only ever one input per
            value — the search above is not a form control, so the form never
            carries two.
          */}
          <input type="hidden" name="patientId" value={patient.id} />
        </>
      )}

      {/* Step 2 — consultation type */}
      {patient && step === "type" ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-h4 text-heading font-sans font-medium">
            {STAFF_BOOKING_COPY.typeHeading}
          </legend>
          <p className="text-body-sm text-muted-foreground measure">
            {STAFF_BOOKING_COPY.typeDescription}
          </p>

          <div className="flex flex-col gap-3">
            {appointmentTypes.map((type) => (
              <ChoiceOption
                key={type.id}
                name="appointmentTypeId"
                value={type.id}
                checked={typeId === type.id}
                onChoose={() => {
                  setTypeId(type.id);
                  setSlot(null);
                  setStep(practitionerId ? "date" : "practitioner");
                }}
                title={type.name}
                description={type.description}
                meta={formatDuration(type.durationMinutes)}
              />
            ))}
          </div>
        </fieldset>
      ) : patient && typeId ? (
        <>
          <SummaryRow
            label="Consultation"
            value={
              selectedType
                ? `${selectedType.name} · ${formatDuration(selectedType.durationMinutes)}`
                : "—"
            }
            onChange={() => setStep("type")}
          />
          <input type="hidden" name="appointmentTypeId" value={typeId} />
        </>
      ) : null}

      {/* Step 3 — practitioner */}
      {patient && step === "practitioner" ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-h4 text-heading font-sans font-medium">
            {STAFF_BOOKING_COPY.practitionerHeading}
          </legend>
          <p className="text-body-sm text-muted-foreground measure">
            {STAFF_BOOKING_COPY.practitionerDescription}
          </p>

          <div className="flex flex-col gap-3">
            {practitioners.map((practitioner) => (
              <ChoiceOption
                key={practitioner.id}
                name="practitionerId"
                value={practitioner.id}
                checked={practitionerId === practitioner.id}
                onChoose={() => {
                  setPractitionerId(practitioner.id);
                  setDate(null);
                  setSlot(null);
                  setStep("date");
                }}
                title={practitioner.displayName}
                description={null}
                meta={null}
              />
            ))}
          </div>
        </fieldset>
      ) : patient && practitionerId ? (
        <>
          <SummaryRow
            label="Practitioner"
            value={selectedPractitioner?.displayName ?? "—"}
            onChange={() => setStep("practitioner")}
          />
          <input type="hidden" name="practitionerId" value={practitionerId} />
        </>
      ) : null}

      {/* Step 4 — date */}
      {patient && step === "date" ? (
        <section
          aria-labelledby="staff-booking-date-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="staff-booking-date-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {STAFF_BOOKING_COPY.dateHeading}
          </h2>

          {availableDates.length === 0 ? (
            <Alert tone="info" title={STAFF_BOOKING_COPY.noDatesTitle}>
              {STAFF_BOOKING_COPY.noDatesDescription}
            </Alert>
          ) : (
            <DatePickerStrip
              dates={availableDates}
              selected={date}
              onSelect={(next) => {
                setDate(next);
                setSlot(null);
                setStep("time");
              }}
              label={STAFF_BOOKING_COPY.dateHeading}
            />
          )}
        </section>
      ) : patient && date && (step === "time" || step === "review") ? (
        <SummaryRow
          label="Date"
          value={formatClinicDate(
            clinicWallClockToInstant(date, 12 * 60) ?? new Date(),
          )}
          onChange={() => setStep("date")}
        />
      ) : null}

      {/* Step 5 — time */}
      {patient && step === "time" ? (
        <section
          aria-labelledby="staff-booking-time-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="staff-booking-time-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {STAFF_BOOKING_COPY.timeHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure">
            {STAFF_BOOKING_COPY.timeDescription}
          </p>

          <TimeSlotPicker
            status={slotsStatus}
            slots={slots}
            selected={slot?.startsAt ?? null}
            onSelect={(next) => {
              setSlot(next);
              setStep("review");
            }}
            onRetry={reload}
            label={STAFF_BOOKING_COPY.timeHeading}
          />
        </section>
      ) : patient && slot && step === "review" ? (
        <SummaryRow
          label="Time"
          value={formatClinicTimeRange(
            new Date(slot.startsAt),
            new Date(slot.endsAt),
          )}
          onChange={() => setStep("time")}
        />
      ) : null}

      {/* Step 6 — review and book */}
      {patient && step === "review" && slot ? (
        <section
          aria-labelledby="staff-booking-review-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="staff-booking-review-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {STAFF_BOOKING_COPY.reviewHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure">
            {STAFF_BOOKING_COPY.reviewDescription}
          </p>

          <Field
            name="patientNote"
            label={STAFF_BOOKING_COPY.noteLabel}
            description={STAFF_BOOKING_COPY.noteDescription}
            error={state.fieldErrors?.["patientNote"]}
          >
            {(control) => (
              <Textarea
                rows={3}
                maxLength={PATIENT_NOTE_MAX_LENGTH}
                {...control}
              />
            )}
          </Field>

          {/*
            The only value assembled by JavaScript, and it is an absolute
            instant chosen from the server's own list — not a local date and
            time this component composed. The server re-validates it against
            the clinic timezone regardless.
          */}
          <input type="hidden" name="startsAt" value={slot.startsAt} />

          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
            <Button
              type="submit"
              size="lg"
              loading={pending}
              loadingLabel={STAFF_BOOKING_COPY.submittingLabel}
            >
              {STAFF_BOOKING_COPY.submitLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setStep("time")}
            >
              {STAFF_BOOKING_COPY.backLabel}
            </Button>
          </div>
        </section>
      ) : null}
    </form>
  );
}

/**
 * The step indicator.
 *
 * An ordered list, because the steps are ordered, with `aria-current="step"`
 * on the one in progress. Completed steps carry a check mark as well as a
 * weight change, so progress is never signalled by colour alone — and every
 * state uses a verified palette token rather than an opacity derivative, which
 * is the defect Phase 09 found here and fixed.
 */
function BookingProgress({ current }: { readonly current: Step }) {
  const currentIndex = STEP_LABELS.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Booking progress">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {STEP_LABELS.map((step, index) => {
          const isCurrent = step.id === current;
          const isDone = index < currentIndex;

          return (
            <li key={step.id} className="flex items-center gap-2">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "text-caption font-sans",
                  isCurrent
                    ? "text-primary font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {isDone ? (
                  <span aria-hidden="true" className="mr-1">
                    ✓
                  </span>
                ) : null}
                {index + 1}. {step.label}
                {isDone ? <span className="sr-only"> (completed)</span> : null}
              </span>
              {index < STEP_LABELS.length - 1 ? (
                <span aria-hidden="true" className="text-border-strong">
                  ·
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A choice already made, with a way back to it. */
function SummaryRow({
  label,
  value,
  changeLabel = "Change",
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly changeLabel?: string;
  readonly onChange: () => void;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-md border px-4 py-3">
      <div className="min-w-0">
        <p className="text-caption text-muted-foreground font-sans">{label}</p>
        <p className="text-body text-foreground wrap-break-word">{value}</p>
      </div>
      <Button type="button" variant="ghost" onClick={onChange}>
        {changeLabel}
        <span className="sr-only"> {label.toLowerCase()}</span>
      </Button>
    </div>
  );
}

/**
 * One option in a radio group, presented as a card.
 *
 * The `<input>` is the control — `sr-only` rather than `hidden`, so it stays
 * focusable and operable with arrow keys — and the card is its label. The
 * focus ring is drawn on the card through `peer-focus-visible`, so keyboard
 * focus is visible even though the input itself is not.
 */
function ChoiceOption({
  name,
  value,
  checked,
  onChoose,
  title,
  description,
  meta,
}: {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChoose: () => void;
  readonly title: string;
  readonly description: string | null;
  readonly meta: string | null;
}) {
  return (
    <label className="block cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChoose}
        className="peer sr-only"
      />
      <span
        className={cn(
          "peer-focus-visible:outline-ring block rounded-lg border p-4 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
          checked
            ? "border-primary bg-accent"
            : "border-border-strong bg-card hover:border-primary",
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="text-body text-foreground font-sans font-medium">
            {title}
          </span>
          {meta ? (
            <span className="text-caption text-muted-foreground shrink-0 font-sans">
              {meta}
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="text-body-sm text-muted-foreground mt-1 block">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
