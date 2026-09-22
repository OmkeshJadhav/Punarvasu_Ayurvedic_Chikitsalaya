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
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { PATIENT_NOTE_MAX_LENGTH } from "@/config/appointments";
import { bookAppointmentAction } from "@/features/appointments/actions";
import {
  BOOKING_COPY,
  BOOKING_STEPS,
  type BookingStepId,
} from "@/features/appointments/content";
import {
  clinicWallClockToInstant,
  formatClinicDate,
  formatClinicTimeRange,
  formatDuration,
} from "@/features/appointments/time";
import {
  IDLE_APPOINTMENT_FORM_STATE,
  type AppointmentType,
  type SchedulingPractitioner,
} from "@/features/appointments/types";
import { cn } from "@/lib/utils/cn";

/**
 * The patient booking flow.
 *
 * ```text
 * Consultation type -> Practitioner -> Date -> Time -> Review -> Request
 * ```
 *
 * which is `phase_09.md` section 43's recommended order.
 *
 * ## One form, owned here
 *
 * The whole flow is a single `<form>` posting to a server action, and this
 * component renders it. That is not a stylistic choice: Phase 07 shipped a
 * nested `<form>` that hydrated into an inner form with no action, so the
 * patient's details were submitted by **GET** and appeared in the URL. The
 * lesson is recorded in `progress_phase_07.md`, and the rule that came out of
 * it is that one component owns the form element and takes the action as a
 * prop or imports it directly. A test asserts there is exactly one form here.
 *
 * The four fields the form carries are exactly the four the action reads:
 * `appointmentTypeId`, `practitionerId`, `startsAt`, `patientNote`. There is
 * no field for a patient id, a duration, a status or an end time — those are
 * derived by the database, and the reason a manipulated request cannot set
 * them is that nothing accepts them, not that something strips them
 * (`phase_09.md` sections 22-23, 37-38).
 *
 * ## Why the type and practitioner are radio inputs
 *
 * They are a choice from a short list, so they are a real radio group inside a
 * `<fieldset>` with a `<legend>`. Arrow keys move between options, the group
 * is announced with its question, and the values post without any JavaScript
 * having to assemble them. The visual card is the label; the input is
 * `sr-only` but focusable, and the focus ring is drawn on the card through
 * `peer-focus-visible`.
 *
 * ## What a conflict does
 *
 * If the slot is taken between the patient choosing it and submitting — the
 * race `phase_09.md` section 42 describes — the server says so, and this
 * component returns to the time step and **refetches**, because the list it is
 * showing is now known to be wrong. Leaving a stale grid on screen with an
 * error above it would invite the patient to pick the same time again.
 */
export interface BookingFlowProps {
  readonly appointmentTypes: readonly AppointmentType[];
  readonly practitioners: readonly SchedulingPractitioner[];
  /** Bookable clinic dates per practitioner id, computed on the server. */
  readonly datesByPractitioner: Readonly<Record<string, readonly string[]>>;
  /** The clinic's verified address, for the review step. */
  readonly locationLines: readonly string[];
}

export function BookingFlow({
  appointmentTypes,
  practitioners,
  datesByPractitioner,
  locationLines,
}: BookingFlowProps) {
  const [state, formAction, pending] = useActionState(
    bookAppointmentAction,
    IDLE_APPOINTMENT_FORM_STATE,
  );

  const [step, setStep] = useState<BookingStepId>("type");
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

  /**
   * A failed booking sends the patient back to the time step with a fresh
   * list, because the most common failure is that somebody took the slot
   * first (`phase_09.md` section 42) and the grid on screen is now known to be
   * wrong.
   *
   * ## Why this is adjusted during render rather than in an effect
   *
   * This is React's documented "adjusting state when a prop changes" pattern:
   * compare the incoming value with the one already handled, and update during
   * render. React discards the in-progress output and re-renders immediately,
   * so the patient never sees a frame with the stale selection still chosen.
   *
   * An effect would run *after* that frame was painted, which is both a
   * visible flicker and the cascading render `react-hooks/set-state-in-effect`
   * exists to prevent. Phase 02 made the same correction in `MobileNav`.
   *
   * The comparison is on the state object's identity rather than its status,
   * because `useActionState` returns a new object for every submission — two
   * consecutive conflicts are two events, and the second must reset the list
   * again.
   */
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "error") {
      setSlot(null);
      setStep("time");
      reload();
    }
  }

  function chooseType(nextTypeId: string) {
    setTypeId(nextTypeId);
    // A different consultation length means different slots, so everything
    // downstream is no longer a valid choice.
    setSlot(null);
    setStep(practitionerId ? "date" : "practitioner");
  }

  function choosePractitioner(nextPractitionerId: string) {
    setPractitionerId(nextPractitionerId);
    setDate(null);
    setSlot(null);
    setStep("date");
  }

  function chooseDate(nextDate: string) {
    setDate(nextDate);
    setSlot(null);
    setStep("time");
  }

  function chooseSlot(nextSlot: AvailableSlot) {
    setSlot(nextSlot);
    setStep("review");
  }

  const availableDates = practitionerId
    ? (datesByPractitioner[practitionerId] ?? [])
    : [];

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <BookingProgress current={step} />

      {state.status === "error" && state.message ? (
        <Alert tone="danger" title="We couldn't request that appointment">
          {state.message}
        </Alert>
      ) : null}

      {/* Step 1 — consultation type */}
      {step === "type" ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-h4 text-heading font-sans font-medium">
            {BOOKING_COPY.typeHeading}
          </legend>
          <p className="text-body-sm text-muted-foreground measure">
            {BOOKING_COPY.typeDescription}
          </p>

          <div className="flex flex-col gap-3">
            {appointmentTypes.map((type) => (
              <ChoiceOption
                key={type.id}
                name="appointmentTypeId"
                value={type.id}
                checked={typeId === type.id}
                onChoose={() => chooseType(type.id)}
                title={type.name}
                description={type.description}
                meta={formatDuration(type.durationMinutes)}
              />
            ))}
          </div>
        </fieldset>
      ) : (
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
          {/*
            The radio group is unmounted once the step is collapsed, so the
            chosen value has to keep a field in the form or it would not be
            submitted at all. One input is rendered at a time — the radio while
            choosing, this while reviewing — so the form never carries two.
          */}
          <input type="hidden" name="appointmentTypeId" value={typeId ?? ""} />
        </>
      )}

      {/* Step 2 — practitioner */}
      {step === "practitioner" ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-h4 text-heading font-sans font-medium">
            {BOOKING_COPY.practitionerHeading}
          </legend>
          <p className="text-body-sm text-muted-foreground measure">
            {BOOKING_COPY.practitionerDescription}
          </p>

          <div className="flex flex-col gap-3">
            {practitioners.map((practitioner) => (
              <ChoiceOption
                key={practitioner.id}
                name="practitionerId"
                value={practitioner.id}
                checked={practitionerId === practitioner.id}
                onChoose={() => choosePractitioner(practitioner.id)}
                title={practitioner.displayName}
                description={null}
                meta={null}
              />
            ))}
          </div>
        </fieldset>
      ) : step === "type" ? null : (
        <>
          <SummaryRow
            label="Practitioner"
            value={selectedPractitioner?.displayName ?? "—"}
            onChange={() => setStep("practitioner")}
          />
          <input
            type="hidden"
            name="practitionerId"
            value={practitionerId ?? ""}
          />
        </>
      )}

      {/* Step 3 — date */}
      {step === "date" ? (
        <section
          aria-labelledby="booking-date-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="booking-date-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {BOOKING_COPY.dateHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure">
            {BOOKING_COPY.dateDescription}
          </p>

          <DatePickerStrip
            dates={availableDates}
            selected={date}
            onSelect={chooseDate}
            label={BOOKING_COPY.dateHeading}
          />
        </section>
      ) : step === "time" || step === "review" ? (
        <SummaryRow
          label="Date"
          value={
            date
              ? formatClinicDate(
                  clinicWallClockToInstant(date, 12 * 60) ?? new Date(),
                )
              : "—"
          }
          onChange={() => setStep("date")}
        />
      ) : null}

      {/* Step 4 — time */}
      {step === "time" ? (
        <section
          aria-labelledby="booking-time-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="booking-time-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {BOOKING_COPY.timeHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure">
            {BOOKING_COPY.timeDescription}
          </p>

          <TimeSlotPicker
            status={slotsStatus}
            slots={slots}
            selected={slot?.startsAt ?? null}
            onSelect={chooseSlot}
            onRetry={reload}
            label={BOOKING_COPY.timeHeading}
          />
        </section>
      ) : step === "review" ? (
        <SummaryRow
          label="Time"
          value={
            slot
              ? formatClinicTimeRange(
                  new Date(slot.startsAt),
                  new Date(slot.endsAt),
                )
              : "—"
          }
          onChange={() => setStep("time")}
        />
      ) : null}

      {/* Step 5 — review and confirm */}
      {step === "review" && slot ? (
        <section
          aria-labelledby="booking-review-heading"
          className="flex flex-col gap-4"
        >
          <h2
            id="booking-review-heading"
            className="text-h4 text-heading font-sans font-medium"
          >
            {BOOKING_COPY.reviewHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure">
            {BOOKING_COPY.reviewDescription}
          </p>

          {locationLines.length > 0 ? (
            <Card variant="muted">
              <CardContent>
                <h3 className="text-label text-foreground font-sans font-medium">
                  Where
                </h3>
                <address className="text-body-sm text-muted-foreground mt-1 not-italic">
                  {locationLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </CardContent>
            </Card>
          ) : null}

          <Field
            name="patientNote"
            label={BOOKING_COPY.noteLabel}
            description={BOOKING_COPY.noteDescription}
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
              loadingLabel={BOOKING_COPY.submittingLabel}
            >
              {BOOKING_COPY.submitLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => setStep("time")}
            >
              {BOOKING_COPY.backLabel}
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
 * colour change (`docs/DESIGN_SYSTEM.md` section 43).
 */
function BookingProgress({ current }: { readonly current: BookingStepId }) {
  const currentIndex = BOOKING_STEPS.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Booking progress">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {BOOKING_STEPS.map((step, index) => {
          const isCurrent = step.id === current;
          const isDone = index < currentIndex;

          return (
            <li key={step.id} className="flex items-center gap-2">
              {/*
                A step that is neither current nor done used to be
                `text-muted-foreground/70`. Live axe measured that at 3.89:1 on
                the cream page — below AA, and invisible to
                `lib/design/contrast.test.ts`, which verifies the palette's
                *tokens* and knows nothing about an opacity modifier applied to
                one. An opacity derivative is a new colour that nothing checked.

                So all three states use verified tokens, and they are told
                apart by more than colour anyway: the current step by weight and
                `aria-current`, a completed one by a check mark.
              */}
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
              {index < BOOKING_STEPS.length - 1 ? (
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
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: () => void;
}) {
  return (
    <div className="border-border flex items-center justify-between gap-4 rounded-md border px-4 py-3">
      <div className="min-w-0">
        <p className="text-caption text-muted-foreground font-sans">{label}</p>
        <p className="text-body text-foreground wrap-break-word">{value}</p>
      </div>
      <Button type="button" variant="ghost" onClick={onChange}>
        {BOOKING_COPY.changeLabel}
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
