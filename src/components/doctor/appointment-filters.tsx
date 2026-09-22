"use client";

import Link from "next/link";

import { appointmentStatusLabel } from "@/components/appointments/appointment-status-badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { APPOINTMENT_STATUSES } from "@/features/appointments/status";
import type { AppointmentType } from "@/features/appointments/types";
import { DOCTOR_SCHEDULE_COPY } from "@/features/doctor/content";
import {
  DOCTOR_APPOINTMENT_RANGES,
  type DoctorAppointmentRange,
} from "@/features/doctor/validation";

/**
 * Narrowing the practitioner's own appointments.
 *
 * ## A plain `GET` form
 *
 * These filters are not sensitive: a range, a status and a consultation type.
 * Putting them in the URL is the right call — it makes the view bookmarkable
 * and correct under the back button, both of which a client-side filter would
 * have to reimplement badly.
 *
 * It contrasts deliberately with the patient search, which is a POST: *that*
 * carries somebody's name, and a name in a URL reaches browser history on a
 * shared machine and every proxy's access log. The distinction is what is
 * being put there, not which is more convenient.
 *
 * ## No practitioner filter
 *
 * `phase_11.md` section 12 says so in as many words: practitioner filtering
 * is unnecessary when the doctor can only see their own appointments. A
 * control offering a choice with one option is worse than no control.
 *
 * ## No JavaScript, despite the directive
 *
 * `"use client"` is here because `Field` is a client component taking a
 * render prop, and a function cannot cross the server/client boundary —
 * rendering this from a server component throws "Functions are not valid as a
 * child of Client Components" at request time. That is the defect Phase 10
 * shipped and found in a browser; `tests/components/field.test.tsx` now
 * asserts that every module importing `Field` declares the directive.
 *
 * The directive buys interactivity this component then declines to use. There
 * is no `onChange` router push and no event handler of any kind: submitting a
 * form is something the browser has always done, so the whole control works
 * before hydration and keeps working without it.
 *
 * ## Filters narrow; they never widen
 *
 * Row-level security decides which appointments exist for this caller before
 * any of this is applied, so no value of these can reach a row that was not
 * already readable. They are validated server-side all the same — an
 * unrecognised status or a malformed id is rejected rather than interpreted
 * (`doctorAppointmentFilterSchema`).
 */
export function DoctorAppointmentFilters({
  range,
  status,
  appointmentTypeId,
  appointmentTypes,
  basePath,
}: {
  readonly range: DoctorAppointmentRange;
  readonly status: string | undefined;
  readonly appointmentTypeId: string | undefined;
  readonly appointmentTypes: readonly AppointmentType[];
  readonly basePath: string;
}) {
  const RANGE_LABELS: Readonly<Record<DoctorAppointmentRange, string>> = {
    today: DOCTOR_SCHEDULE_COPY.rangeToday,
    upcoming: DOCTOR_SCHEDULE_COPY.rangeUpcoming,
    past: DOCTOR_SCHEDULE_COPY.rangePast,
  };

  const isFiltered = Boolean(status || appointmentTypeId);

  return (
    <form
      method="get"
      action={basePath}
      aria-label={DOCTOR_SCHEDULE_COPY.filtersLabel}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
    >
      <Field name="range" label={DOCTOR_SCHEDULE_COPY.rangeLabel}>
        {(control) => (
          <NativeSelect defaultValue={range} {...control}>
            {DOCTOR_APPOINTMENT_RANGES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {RANGE_LABELS[candidate]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field name="status" label={DOCTOR_SCHEDULE_COPY.statusLabel}>
        {(control) => (
          <NativeSelect defaultValue={status ?? ""} {...control}>
            <option value="">{DOCTOR_SCHEDULE_COPY.statusAll}</option>
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

      <Field name="appointmentTypeId" label={DOCTOR_SCHEDULE_COPY.typeLabel}>
        {(control) => (
          <NativeSelect defaultValue={appointmentTypeId ?? ""} {...control}>
            <option value="">{DOCTOR_SCHEDULE_COPY.typeAll}</option>
            {appointmentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <div className="flex gap-2 lg:mb-1">
        <Button type="submit">{DOCTOR_SCHEDULE_COPY.applyLabel}</Button>
        {isFiltered ? (
          <Button asChild variant="ghost">
            <Link href={`${basePath}?range=${range}`}>
              {DOCTOR_SCHEDULE_COPY.resetLabel}
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
