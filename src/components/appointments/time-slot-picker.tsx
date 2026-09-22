"use client";

import { CalendarX } from "lucide-react";

import {
  type AvailableSlot,
  type SlotsStatus,
} from "@/components/appointments/use-available-slots";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BOOKING_COPY } from "@/features/appointments/content";
import { formatClinicTime } from "@/features/appointments/time";
import { cn } from "@/lib/utils/cn";

/**
 * The times a patient can choose from, and the three states that are not that.
 *
 * ## Every state is rendered, deliberately
 *
 * `phase_09.md` sections 45-47 name all three and they are all here: a
 * skeleton grid while loading, an empty state that says what to do next, and
 * an error state with a retry. None of them is a blank area
 * (`docs/PRODUCT_SPEC.md` section 13).
 *
 * The empty state matters most. "No times available on this day" is a true and
 * actionable answer; fabricating availability to avoid an empty grid is what
 * section 46 forbids.
 *
 * ## Why these are real buttons in a real list
 *
 * A slot is a choice, so it is a `<button>` inside a `<ul>`: the list is
 * announced with its length, Tab reaches every option, Enter and Space
 * activate, and the focus ring is the one the rest of the application uses.
 * A grid of divs with click handlers would look identical and be unusable
 * from a keyboard (`docs/QA_STRATEGY.md` section 15).
 *
 * Selection is `aria-pressed` plus a filled treatment plus a check mark, so it
 * is never signalled by colour alone (`docs/DESIGN_SYSTEM.md` sections 28 and
 * 43). Each button is at least 44px high.
 *
 * ## Unavailable times are absent, not disabled
 *
 * Section 20 asks that unavailable slots not be selectable. They are not
 * rendered at all: a disabled grid of greyed-out times tells a patient nothing
 * they can act on, and on a busy day it would bury the three times that are
 * free among forty that are not.
 */
export interface TimeSlotPickerProps {
  readonly status: SlotsStatus;
  readonly slots: readonly AvailableSlot[];
  /** The currently chosen slot's ISO start, or null. */
  readonly selected: string | null;
  readonly onSelect: (slot: AvailableSlot) => void;
  readonly onRetry: () => void;
  /** Names the group for assistive technology, e.g. "Times on Tuesday 22 September". */
  readonly label: string;
}

export function TimeSlotPicker({
  status,
  slots,
  selected,
  onSelect,
  onRetry,
  label,
}: TimeSlotPickerProps) {
  if (status === "loading" || status === "idle") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col gap-3"
      >
        {/* Announced for screen readers; the skeletons below are decorative. */}
        <span className="sr-only">{BOOKING_COPY.slotsLoadingLabel}</span>
        <div
          aria-hidden="true"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-12 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        title={BOOKING_COPY.slotsErrorTitle}
        description={BOOKING_COPY.slotsErrorDescription}
        action={
          <Button variant="secondary" onClick={onRetry}>
            {BOOKING_COPY.slotsRetryLabel}
          </Button>
        }
      />
    );
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX />}
        title={BOOKING_COPY.slotsEmptyTitle}
        description={BOOKING_COPY.slotsEmptyDescription}
      />
    );
  }

  return (
    <ul
      aria-label={label}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {slots.map((slot) => {
        const isSelected = slot.startsAt === selected;
        const time = formatClinicTime(new Date(slot.startsAt));

        return (
          <li key={slot.startsAt}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(slot)}
              className={cn(
                "focus-visible:outline-ring flex min-h-12 w-full items-center justify-center gap-1.5 rounded-md border px-3 text-center font-sans transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground font-medium"
                  : "border-border-strong bg-card text-foreground hover:border-primary hover:bg-accent",
              )}
            >
              {/*
                A check mark as well as the fill, so the selected time is not
                identified by colour alone. `aria-pressed` carries the same
                information to assistive technology.
              */}
              {isSelected ? (
                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                >
                  <path d="M6.2 11.5 2.9 8.2l1.1-1.1 2.2 2.2 5.8-5.8 1.1 1.1z" />
                </svg>
              ) : null}
              <time dateTime={slot.startsAt}>{time}</time>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
