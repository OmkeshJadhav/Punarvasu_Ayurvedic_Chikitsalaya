"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { BOOKING_COPY } from "@/features/appointments/content";
import {
  clinicWallClockToInstant,
  formatClinicDate,
  formatClinicDateShort,
} from "@/features/appointments/time";
import { cn } from "@/lib/utils/cn";

/**
 * Choosing a day.
 *
 * ## Why a strip of days and not a calendar
 *
 * `phase_09.md` section 44 asks that available and unavailable dates be
 * clearly distinguished, that past dates be unselectable, that it work on a
 * phone and from a keyboard, and that it not overwhelm. A month grid satisfies
 * the first two by greying out most of itself, and satisfies the last two
 * only with a custom roving-focus widget — the kind of component that looks
 * finished and fails a keyboard test.
 *
 * This shows only days the practitioner actually works, as real buttons, in
 * order. Past days and non-working days are absent rather than disabled, so
 * there is nothing to grey out and nothing misleading to tab through. Section
 * 44's own concession — that a list is acceptable on mobile — is taken as the
 * better answer on every screen.
 *
 * The consequence, stated plainly: a patient cannot jump to a month. They can
 * extend the strip, a fortnight at a time, up to the booking horizon. For a
 * clinic booking weeks rather than seasons ahead that is the right trade, and
 * when it stops being right the replacement is a calendar built deliberately,
 * not this widened.
 *
 * ## Accessibility
 *
 * A `<ul>` of `<button>`s, so the count is announced and Tab reaches each one.
 * Selection is `aria-pressed` plus a filled treatment, never colour alone.
 * Each button's accessible name is the full date — "Tuesday 22 September
 * 2026" — while the visible label stays short enough to fit six across a
 * phone.
 */
export interface DatePickerStripProps {
  /** Clinic calendar dates, already filtered to working days in horizon. */
  readonly dates: readonly string[];
  readonly selected: string | null;
  readonly onSelect: (date: string) => void;
  readonly label: string;
}

/** How many dates are revealed at a time. */
const PAGE_SIZE = 14;

export function DatePickerStrip({
  dates,
  selected,
  onSelect,
  label,
}: DatePickerStripProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (dates.length === 0) {
    return (
      <Alert tone="info" title={BOOKING_COPY.slotsEmptyTitle}>
        {BOOKING_COPY.slotsEmptyDescription}
      </Alert>
    );
  }

  const shown = dates.slice(0, visible);

  return (
    <div className="flex flex-col gap-4">
      <ul
        aria-label={label}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {shown.map((date) => {
          const isSelected = date === selected;
          // Midday rather than midnight: the label only needs the calendar
          // day, and midday is the furthest a date can be from a timezone
          // boundary, so no display rounding can shift it.
          const instant = clinicWallClockToInstant(date, 12 * 60);

          return (
            <li key={date}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(date)}
                className={cn(
                  "focus-visible:outline-ring flex min-h-12 w-full items-center justify-center rounded-md border px-3 text-center font-sans transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground font-medium"
                    : "border-border-strong bg-card text-foreground hover:border-primary hover:bg-accent",
                )}
              >
                <span aria-hidden="true">
                  {instant ? formatClinicDateShort(instant) : date}
                </span>
                <span className="sr-only">
                  {instant ? formatClinicDate(instant) : date}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {visible < dates.length ? (
        <div>
          <Button
            variant="ghost"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
          >
            Show more dates
          </Button>
        </div>
      ) : null}
    </div>
  );
}
