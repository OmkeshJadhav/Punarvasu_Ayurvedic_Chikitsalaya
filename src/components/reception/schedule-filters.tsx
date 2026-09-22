"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { APPOINTMENT_STATUSES } from "@/features/appointments/status";
import { appointmentStatusLabel } from "@/components/appointments/appointment-status-badge";
import { addDaysToIsoDate } from "@/features/appointments/time";
import { SCHEDULE_COPY } from "@/features/reception/content";
import type { SchedulablePractitioner } from "@/features/reception/types";

/**
 * Narrowing the day's schedule.
 *
 * ## A plain `GET` form
 *
 * These filters are not sensitive: a date, a practitioner id and a status.
 * Putting them in the URL is the right call — it makes the view shareable
 * between two people at the desk, bookmarkable, and correct under the back
 * button, all of which a client-side filter would have to reimplement badly.
 *
 * It contrasts deliberately with the patient search, which is a POST: *that*
 * carries somebody's name, and a name in a URL reaches browser history on a
 * shared machine and every proxy's access log. The distinction is what is
 * being put there, not which is more convenient.
 *
 * ## No JavaScript, despite the directive
 *
 * `"use client"` is here because `Field` is a client component taking a render
 * prop, and a function cannot cross the server/client boundary — rendering
 * this from a server component throws "Functions are not valid as a child of
 * Client Components" at request time. The alternative was to re-hand-wire the
 * label, `aria-describedby` and `aria-invalid` that `Field` exists to
 * guarantee, which is the kind of duplication that eventually ships a field
 * with no label.
 *
 * The directive buys interactivity this component then declines to use. There
 * is no `onChange` router push and no event handler of any kind: submitting a
 * form is something the browser has always done, so the whole control works
 * before hydration and keeps working without it — which on a front-desk
 * machine on a poor connection is the difference between a slow page and a
 * broken one.
 *
 * ## Filters narrow; they never widen
 *
 * A receptionist can already see the whole clinic diary, so none of these
 * unlocks anything. They are validated server-side all the same — an
 * unrecognised status or a malformed date is rejected rather than interpreted
 * (`scheduleFilterSchema`).
 */
export function ScheduleFilters({
  date,
  practitionerId,
  status,
  practitioners,
  basePath,
}: {
  readonly date: string;
  readonly practitionerId: string | undefined;
  readonly status: string | undefined;
  readonly practitioners: readonly SchedulablePractitioner[];
  readonly basePath: string;
}) {
  const previousDay = addDaysToIsoDate(date, -1);
  const nextDay = addDaysToIsoDate(date, 1);

  /** Keeps the practitioner and status filters when only the day changes. */
  const dayHref = (target: string) => {
    const params = new URLSearchParams({ date: target });
    if (practitionerId) params.set("practitionerId", practitionerId);
    if (status) params.set("status", status);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/*
        Day stepping is links rather than form buttons, because moving to
        tomorrow is a navigation and should behave like one: middle-clickable,
        in history, and working without JavaScript (`phase_10.md` section 25).
      */}
      <nav
        aria-label="Change day"
        className="flex flex-wrap items-center gap-2"
      >
        <Button asChild variant="secondary">
          <Link href={dayHref(previousDay)}>
            ← {SCHEDULE_COPY.previousDayLabel}
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={basePath}>{SCHEDULE_COPY.todayLabel}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={dayHref(nextDay)}>{SCHEDULE_COPY.nextDayLabel} →</Link>
        </Button>
      </nav>

      <form
        method="get"
        action={basePath}
        aria-label={SCHEDULE_COPY.filtersLabel}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
      >
        <Field name="date" label={SCHEDULE_COPY.dateLabel}>
          {(control) => (
            // A native date input: keyboard operable, announced correctly, and
            // on a tablet it opens the platform's own picker. A custom
            // calendar would be a client component that fails a keyboard test.
            <Input type="date" defaultValue={date} {...control} />
          )}
        </Field>

        <Field name="practitionerId" label={SCHEDULE_COPY.practitionerLabel}>
          {(control) => (
            <NativeSelect defaultValue={practitionerId ?? ""} {...control}>
              <option value="">{SCHEDULE_COPY.practitionerAll}</option>
              {practitioners.map((practitioner) => (
                <option key={practitioner.id} value={practitioner.id}>
                  {practitioner.displayName}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field name="status" label={SCHEDULE_COPY.statusLabel}>
          {(control) => (
            <NativeSelect defaultValue={status ?? ""} {...control}>
              <option value="">{SCHEDULE_COPY.statusAll}</option>
              {APPOINTMENT_STATUSES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {/*
                    The product's own vocabulary, from the one translation
                    table — so a status reads "Requested" here and on the badge
                    beside it, never "Pending" in one place and "Requested" in
                    the other.
                  */}
                  {appointmentStatusLabel(candidate)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <div className="flex gap-2 lg:mb-1">
          <Button type="submit">{SCHEDULE_COPY.applyLabel}</Button>
          {practitionerId || status ? (
            <Button asChild variant="ghost">
              <Link href={`${basePath}?date=${date}`}>
                {SCHEDULE_COPY.resetLabel}
              </Link>
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
