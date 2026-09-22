import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentList } from "@/components/appointments/appointment-list";
import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import {
  APPOINTMENT_COPY,
  APPOINTMENTS_AREA,
} from "@/features/appointments/content";
import {
  getMyAppointments,
  groupAppointments,
} from "@/features/appointments/queries";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  title: APPOINTMENTS_AREA.list.title,
  robots: { index: false, follow: false },
};

/**
 * The patient's own appointments.
 *
 * ## Three layers of protection, none of them this page's markup
 *
 *   1. `src/proxy.ts` redirects a request with no session at all.
 *   2. `(app)/layout.tsx` calls `requireUser()`, and
 *      `(app)/patient/layout.tsx` calls `requireAreaAccess`.
 *   3. `requirePermission("appointments.read.self")` here, because reading
 *      appointments is a capability of its own and the area guard is about the
 *      area.
 *
 * And beneath all three, row-level security restricts `appointments` to the
 * caller's own patient record, so the query below returns their appointments
 * or none — never somebody else's, whatever the application does
 * (`phase_09.md` sections 35-36).
 *
 * ## Why a failed read gets its own screen
 *
 * `getMyAppointments` distinguishes "none" from "could not read", and so does
 * this page. Telling a patient they have no appointments when the database was
 * briefly unreachable would invite them to book a second one — the same
 * mistake Phase 07 avoided for the profile.
 */
export default async function PatientAppointmentsPage() {
  await requirePermission("appointments.read.self", "/patient/appointments");

  const result = await getMyAppointments();

  return (
    <Section aria-labelledby="appointments-heading">
      <Container width="content">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            as="h1"
            titleId="appointments-heading"
            title={APPOINTMENTS_AREA.list.heading}
            description={APPOINTMENTS_AREA.list.description}
          />
          <div className="shrink-0">
            <Button asChild>
              <Link href="/patient/appointments/book">
                {APPOINTMENT_COPY.bookLabel}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-10">
          {result.status === "unavailable" ? (
            <ErrorState
              title={APPOINTMENT_COPY.loadErrorTitle}
              description={APPOINTMENT_COPY.loadErrorDescription}
              action={
                <Button asChild variant="secondary">
                  {/*
                    The read happens during server rendering, so re-requesting
                    the page *is* the retry. A link needs no client component
                    and no state.
                  */}
                  <Link href="/patient/appointments">
                    {APPOINTMENT_COPY.loadErrorRetryLabel}
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              <AppointmentList
                groups={groupAppointments(result.appointments)}
              />
              {result.truncated ? (
                // Phase 20. The query is bounded, so a patient with a long
                // history is shown a subset — and told, rather than left to
                // conclude their older visits have been deleted.
                <p className="text-body-sm text-muted-foreground measure mt-8">
                  {APPOINTMENTS_AREA.list.truncatedNotice}
                </p>
              ) : null}
            </>
          )}
        </div>
      </Container>
    </Section>
  );
}
