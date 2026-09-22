import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APPOINTMENT_COPY } from "@/features/appointments/content";
import {
  formatClinicDate,
  formatClinicTimeRange,
} from "@/features/appointments/time";
import type { AppointmentResult } from "@/features/appointments/types";
import { isImminent } from "@/features/patients/attention";
import { PATIENT_DASHBOARD } from "@/features/patients/content";

import { DashboardPanel } from "./dashboard-panel";

/**
 * The patient's next appointment — the most important thing on the page.
 *
 * ## Why it is first and largest
 *
 * `phase_18.md` sections 5 and 78 both put it at the top, and it is the
 * question a patient opens the portal to answer. So it gets the page's one
 * emphasised surface, a date set at heading size, and the only primary button
 * above the fold.
 *
 * ## The three states are three different things
 *
 * `found`, `not_found` and `unavailable` are rendered separately, and the
 * third is the one that matters: telling a patient they have no appointment
 * because the database was briefly unreachable would invite them to book a
 * second one. That distinction has been carried by every patient surface since
 * Phase 07, and section 72 asks for it again — stale or missing clinical
 * information must not be presented as current.
 *
 * A failed read here does **not** take down the rest of the dashboard
 * (section 129). It renders its own quiet notice and says so.
 *
 * ## What it does not show
 *
 * No internal note — a patient holds no column grant on `internal_note`, so
 * there is nothing to filter (Phase 09). No practitioner credentials, because
 * the clinic has verified none. No preparation instructions, because none is
 * configured: section 14 asks for them "if actually configured", and
 * inventing "arrive 15 minutes early" would be a clinic policy nobody has
 * stated.
 */
export function NextVisitCard({
  result,
  now,
}: {
  readonly result: AppointmentResult;
  readonly now: Date;
}) {
  const copy = PATIENT_DASHBOARD.nextVisit;

  if (result.status === "unavailable") {
    return (
      <DashboardPanel heading={copy.heading} headingId="next-visit-heading">
        <Card variant="muted">
          <CardContent className="flex flex-col gap-1">
            <p className="text-body text-heading font-sans font-medium">
              {copy.errorTitle}
            </p>
            <p className="text-body-sm text-muted-foreground measure">
              {copy.errorBody}
            </p>
          </CardContent>
        </Card>
      </DashboardPanel>
    );
  }

  if (result.status === "not_found") {
    return (
      <DashboardPanel heading={copy.heading} headingId="next-visit-heading">
        <EmptyState
          icon={<CalendarDays />}
          title={copy.emptyTitle}
          description={copy.emptyBody}
          action={
            <Button asChild>
              <Link href="/patient/appointments/book">
                {APPOINTMENT_COPY.bookLabel}
              </Link>
            </Button>
          }
        />
      </DashboardPanel>
    );
  }

  const appointment = result.appointment;
  const soon = isImminent(appointment.startsAt, now);

  return (
    <DashboardPanel heading={copy.heading} headingId="next-visit-heading">
      <Card variant="highlighted" padding="spacious">
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              {/*
                The date as the headline, because "when" is what the patient
                came for. `time` carries the machine-readable instant so an
                assistive technology and a browser's own date handling both get
                the real value rather than the formatted string.
              */}
              <p className="text-h4 text-heading font-sans font-medium">
                <time dateTime={appointment.startsAt.toISOString()}>
                  {formatClinicDate(appointment.startsAt)}
                </time>
              </p>
              <p className="text-body-lg text-prose">
                {formatClinicTimeRange(
                  appointment.startsAt,
                  appointment.endsAt,
                )}
              </p>
              <p className="text-body-sm text-muted-foreground mt-1">
                {appointment.typeName} with {appointment.practitionerName}
              </p>
            </div>

            <div className="flex shrink-0">
              <AppointmentStatusBadge status={appointment.status} />
            </div>
          </div>

          {soon ? (
            <p className="text-body-sm text-prose">{copy.imminentNote}</p>
          ) : null}

          <div>
            <Button asChild>
              <Link href={`/patient/appointments/${appointment.id}`}>
                {copy.viewLabel}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardPanel>
  );
}
