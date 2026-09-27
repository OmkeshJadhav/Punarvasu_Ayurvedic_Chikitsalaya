"use client";

import {
  useActionState,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { DatePickerStrip } from "@/components/appointments/date-picker-strip";
import { TimeSlotPicker } from "@/components/appointments/time-slot-picker";
import {
  useAvailableSlots,
  type AvailableSlot,
} from "@/components/appointments/use-available-slots";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { PATIENT_NOTE_MAX_LENGTH } from "@/config/appointments";
import { bookAppointmentAction } from "@/features/appointments/actions";
import { BOOKING_COPY } from "@/features/appointments/content";
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
 * The patient booking form.
 *
 * ```text
 * Consultation type -> Practitioner -> Date -> Time -> Note and request
 * ```
 *
 * `phase_09.md` section 43's recommended order, laid out as one page rather
 * than a wizard. Every section is visible from the start, so the patient can
 * see the whole of what is being asked and change any answer in place; a
 * section that depends on an earlier choice (days on the practitioner, times
 * on the type and day) says what it is waiting for instead of hiding. Missing
 * choices are marked only after an attempt to send, and focus moves to the
 * first of them.
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
 * component clears the chosen time and **refetches**, because the list it is
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

/** The choices a request cannot be sent without, in the order they appear. */
const BOOKING_CHOICES = ["type", "practitioner", "date", "time"] as const;
type BookingChoice = (typeof BOOKING_CHOICES)[number];

function sectionId(choice: BookingChoice): string {
  return `booking-${choice}`;
}

const REQUIRED_MESSAGES: Readonly<Record<BookingChoice, string>> = {
  type: BOOKING_COPY.typeRequired,
  practitioner: BOOKING_COPY.practitionerRequired,
  date: BOOKING_COPY.dateRequired,
  time: BOOKING_COPY.timeRequired,
};

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

  const [typeId, setTypeId] = useState<string | null>(
    appointmentTypes.length === 1 ? (appointmentTypes[0]?.id ?? null) : null,
  );
  const [practitionerId, setPractitionerId] = useState<string | null>(
    practitioners.length === 1 ? (practitioners[0]?.id ?? null) : null,
  );
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  /**
   * Whether the patient has tried to send an incomplete request. Missing
   * choices are only marked after that — flagging four empty sections on
   * arrival would greet the patient with errors they have not made.
   */
  const [attempted, setAttempted] = useState(false);

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
   * A failed booking clears the chosen time and refetches the list, because
   * the most common failure is that somebody took the slot first
   * (`phase_09.md` section 42) and the times on screen are now known to be
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
      reload();
    }
  }

  function chooseType(nextTypeId: string) {
    setTypeId(nextTypeId);
    // A different consultation length means different slots, so the chosen
    // time is no longer a valid choice. The day still is.
    setSlot(null);
  }

  function choosePractitioner(nextPractitionerId: string) {
    setPractitionerId(nextPractitionerId);
    // Another practitioner works other days, so both the day and the time go.
    setDate(null);
    setSlot(null);
  }

  function chooseDate(nextDate: string) {
    setDate(nextDate);
    setSlot(null);
  }

  const chosen: Readonly<Record<BookingChoice, boolean>> = {
    type: typeId !== null,
    practitioner: practitionerId !== null,
    date: date !== null,
    time: slot !== null,
  };
  const missing = BOOKING_CHOICES.filter((choice) => !chosen[choice]);

  function errorFor(choice: BookingChoice): string | undefined {
    return attempted && missing.includes(choice)
      ? REQUIRED_MESSAGES[choice]
      : undefined;
  }

  /**
   * Stops an incomplete request before it reaches the server, and takes the
   * patient to the first thing still missing.
   *
   * The server validates regardless — this exists so a patient at the bottom
   * of a long page is not left wondering why nothing happened.
   * `preventDefault` on the submit event also stops React's form action.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const [firstMissing] = missing;
    if (!firstMissing) return;

    event.preventDefault();
    setAttempted(true);
    const section = event.currentTarget.querySelector<HTMLElement>(
      `#${sectionId(firstMissing)}`,
    );
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const availableDates = practitionerId
    ? (datesByPractitioner[practitionerId] ?? [])
    : [];

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-10"
    >
      {/* 1 — consultation type */}
      <BookingFieldset
        id={sectionId("type")}
        number={1}
        heading={BOOKING_COPY.typeHeading}
        description={BOOKING_COPY.typeDescription}
        error={errorFor("type")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
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
      </BookingFieldset>

      {/* 2 — practitioner */}
      <BookingFieldset
        id={sectionId("practitioner")}
        number={2}
        heading={BOOKING_COPY.practitionerHeading}
        description={BOOKING_COPY.practitionerDescription}
        error={errorFor("practitioner")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
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
      </BookingFieldset>

      {/* 3 — date */}
      <BookingSection
        id={sectionId("date")}
        number={3}
        heading={BOOKING_COPY.dateHeading}
        description={BOOKING_COPY.dateDescription}
        error={errorFor("date")}
      >
        {practitionerId ? (
          <DatePickerStrip
            dates={availableDates}
            selected={date}
            onSelect={chooseDate}
            label={BOOKING_COPY.dateHeading}
          />
        ) : (
          <WaitingHint>{BOOKING_COPY.dateWaitingForPractitioner}</WaitingHint>
        )}
      </BookingSection>

      {/* 4 — time */}
      <BookingSection
        id={sectionId("time")}
        number={4}
        heading={BOOKING_COPY.timeHeading}
        description={BOOKING_COPY.timeDescription}
        error={errorFor("time")}
      >
        {!typeId ? (
          <WaitingHint>{BOOKING_COPY.timeWaitingForType}</WaitingHint>
        ) : !date ? (
          <WaitingHint>{BOOKING_COPY.timeWaitingForDate}</WaitingHint>
        ) : (
          <TimeSlotPicker
            status={slotsStatus}
            slots={slots}
            selected={slot?.startsAt ?? null}
            onSelect={setSlot}
            onRetry={reload}
            label={BOOKING_COPY.timeHeading}
          />
        )}
      </BookingSection>

      {/* 5 — note, where, and send */}
      <BookingSection
        id="booking-review"
        number={5}
        heading={BOOKING_COPY.reviewHeading}
        description={BOOKING_COPY.reviewDescription}
      >
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

        {selectedType && selectedPractitioner && date && slot ? (
          <Card variant="muted">
            <CardContent>
              <h3 className="text-label text-foreground font-sans font-medium">
                {BOOKING_COPY.summaryLabel}
              </h3>
              <dl className="text-body-sm mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Consultation</dt>
                <dd className="text-foreground wrap-break-word">
                  {selectedType.name} ·{" "}
                  {formatDuration(selectedType.durationMinutes)}
                </dd>
                <dt className="text-muted-foreground">With</dt>
                <dd className="text-foreground wrap-break-word">
                  {selectedPractitioner.displayName}
                </dd>
                <dt className="text-muted-foreground">When</dt>
                <dd className="text-foreground wrap-break-word">
                  {formatClinicDate(
                    clinicWallClockToInstant(date, 12 * 60) ?? new Date(),
                  )}
                  ,{" "}
                  {formatClinicTimeRange(
                    new Date(slot.startsAt),
                    new Date(slot.endsAt),
                  )}
                </dd>
                {locationLines.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">Where</dt>
                    <dd className="text-foreground">
                      <address className="not-italic">
                        {locationLines.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </address>
                    </dd>
                  </>
                ) : null}
              </dl>
            </CardContent>
          </Card>
        ) : null}

        {/*
          The only value assembled by JavaScript, and it is an absolute instant
          chosen from the server's own list — not a local date and time this
          component composed. The server re-validates it against the clinic
          timezone regardless.
        */}
        {slot ? (
          <input type="hidden" name="startsAt" value={slot.startsAt} />
        ) : null}

        {/*
          The server's answer sits beside the button that asked for it. On a
          single long page an alert at the top would be off-screen at the
          moment it appears.
        */}
        {state.status === "error" && state.message ? (
          <Alert tone="danger" title="We couldn't request that appointment">
            {state.message}
          </Alert>
        ) : null}

        {attempted && missing.length > 0 ? (
          <FieldError>{BOOKING_COPY.incompleteSummary}</FieldError>
        ) : null}

        <div>
          <Button
            type="submit"
            size="lg"
            loading={pending}
            loadingLabel={BOOKING_COPY.submittingLabel}
            className="w-full sm:w-auto"
          >
            {BOOKING_COPY.submitLabel}
          </Button>
        </div>
      </BookingSection>
    </form>
  );
}

interface BookingSectionProps {
  /** Also where an incomplete submit moves focus. */
  readonly id: string;
  readonly number: number;
  readonly heading: string;
  readonly description: string;
  /** Present only once the patient has tried to send without this choice. */
  readonly error?: string | undefined;
  readonly children: ReactNode;
}

/**
 * The numbered title every section shares.
 *
 * The number is decoration — the sections are already in document order — so
 * it is hidden from assistive technology and the accessible name is the
 * question alone.
 */
function SectionTitle({
  number,
  heading,
}: {
  readonly number: number;
  readonly heading: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="border-border-strong text-caption text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full border font-sans"
      >
        {number}
      </span>
      <span>{heading}</span>
    </>
  );
}

/**
 * A radio-group section: a real `<fieldset>` with a `<legend>`, so the group
 * is announced with its question and arrow keys move between options.
 *
 * `tabIndex={-1}` lets an incomplete submit move focus here without adding a
 * tab stop.
 */
function BookingFieldset({
  id,
  number,
  heading,
  description,
  error,
  children,
}: BookingSectionProps) {
  const errorId = `${id}-error`;

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-describedby={error ? errorId : undefined}
      className="flex min-w-0 scroll-mt-24 flex-col gap-4 focus:outline-none"
    >
      <legend className="text-h4 text-heading mb-4 flex items-center gap-3 font-sans font-medium">
        <SectionTitle number={number} heading={heading} />
      </legend>
      <p className="text-body-sm text-muted-foreground measure">
        {description}
      </p>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {children}
    </fieldset>
  );
}

/** A section that is not a radio group, labelled by its heading. */
function BookingSection({
  id,
  number,
  heading,
  description,
  error,
  children,
}: BookingSectionProps) {
  const headingId = `${id}-heading`;
  const errorId = `${id}-error`;

  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={headingId}
      aria-describedby={error ? errorId : undefined}
      className="flex scroll-mt-24 flex-col gap-4 focus:outline-none"
    >
      <h2
        id={headingId}
        className="text-h4 text-heading flex items-center gap-3 font-sans font-medium"
      >
        <SectionTitle number={number} heading={heading} />
      </h2>
      <p className="text-body-sm text-muted-foreground measure">
        {description}
      </p>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {children}
    </section>
  );
}

/** What a section will show once an earlier choice is made. */
function WaitingHint({ children }: { readonly children: ReactNode }) {
  return (
    <p className="border-border text-body-sm text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center">
      {children}
    </p>
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
