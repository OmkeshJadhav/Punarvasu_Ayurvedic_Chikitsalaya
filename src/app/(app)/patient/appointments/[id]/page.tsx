import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentHistory } from "@/components/appointments/appointment-history";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { AppointmentSummary } from "@/components/appointments/appointment-summary";
import { CancelAppointmentDialog } from "@/components/appointments/cancel-appointment-dialog";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BOOKING_RULES } from "@/config/appointments";
import { CLINIC_CONTACT, addressLines } from "@/config/clinic";
import {
  APPOINTMENT_COPY,
  APPOINTMENTS_AREA,
  CONFIRMATION_COPY,
  RESCHEDULE_COPY,
} from "@/features/appointments/content";
import {
  getAppointment,
  getAppointmentHistory,
} from "@/features/appointments/queries";
import {
  canPatientCancel,
  canPatientReschedule,
} from "@/features/appointments/status";
import { requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the date, the practitioner or the patient's name. A page title
  // reaches browser history, the tab strip and a screen share
  // (`phase_09.md` section 55).
  title: APPOINTMENTS_AREA.detail.title,
  robots: { index: false, follow: false },
};

/**
 * One appointment, and what can still be done about it.
 *
 * ## The id in the URL is a filter, not a key to the door
 *
 * `getAppointment` runs through row-level security, which restricts the table
 * to the caller's own patient record. An id belonging to another patient
 * returns nothing and renders the same "we couldn't find that" as an id that
 * never existed — an appointment id must not be an oracle for whether somebody
 * else's appointment exists (`phase_09.md` section 35).
 *
 * ## This page is also the booking confirmation
 *
 * `phase_09.md` section 48 asks the confirmation to show the date, time,
 * practitioner, type, location and **actual status**, and section 21 forbids
 * claiming "confirmed" while the status is `requested`. Rather than a separate
 * confirmation screen rendering what the form thought it did, the booking
 * action redirects here with `?requested=1` and the page renders the row. What
 * is confirmed is therefore whatever the database says, always.
 *
 * ## Why the actions are computed server-side too
 *
 * `canPatientCancel` and `canPatientReschedule` decide whether the controls
 * appear. Hiding a control is a usability decision and never a security one
 * (`docs/SECURITY.md` section 6): both database functions re-derive the same
 * rules, so a patient who submits a cancellation for an appointment that has
 * since started is refused with `PV010` whatever this page rendered.
 */
export default async function AppointmentDetailPage({
  params,
  searchParams,
}: PageProps<"/patient/appointments/[id]">) {
  await requirePermission("appointments.read.self", "/patient/appointments");

  const { id } = await params;
  const query = await searchParams;
  const result = await getAppointment(id);

  if (result.status === "unavailable") {
    return (
      <DetailShell>
        <ErrorState
          title={APPOINTMENT_COPY.loadErrorTitle}
          description={APPOINTMENT_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/patient/appointments/${id}`}>
                {APPOINTMENT_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <DetailShell>
        <EmptyState
          title={APPOINTMENT_COPY.notFoundTitle}
          description={APPOINTMENT_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/patient/appointments">
                {APPOINTMENT_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  const { appointment } = result;
  const now = new Date();
  const events = await getAppointmentHistory(appointment.id);

  const justRequested = query["requested"] === "1";
  const justMoved = query["moved"] === "1";

  const showCancel = canPatientCancel({
    status: appointment.status,
    startsAt: appointment.startsAt,
    now,
    cancellationCutoffMinutes: BOOKING_RULES.cancellationCutoffMinutes,
  });

  const showReschedule = canPatientReschedule({
    status: appointment.status,
    startsAt: appointment.startsAt,
    now,
  });

  return (
    <DetailShell>
      <div className="flex flex-col gap-8">
        {justRequested ? (
          <Alert tone="success" title={CONFIRMATION_COPY.title}>
            {CONFIRMATION_COPY.body}
          </Alert>
        ) : null}

        {justMoved ? (
          <Alert tone="success" title={RESCHEDULE_COPY.successTitle}>
            {RESCHEDULE_COPY.successBody}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <AppointmentStatusBadge status={appointment.status} />
          <p className="text-body-sm text-muted-foreground measure">
            {appointment.status === "requested"
              ? APPOINTMENT_COPY.requestedExplainer
              : appointment.status === "confirmed"
                ? APPOINTMENT_COPY.confirmedExplainer
                : null}
          </p>
        </div>

        <AppointmentSummary
          appointment={appointment}
          locationLines={addressLines(CLINIC_CONTACT.address)}
        />

        {justRequested ? (
          <section
            aria-labelledby="next-steps-heading"
            className="border-border bg-muted/50 rounded-lg border p-5 sm:p-6"
          >
            <h2
              id="next-steps-heading"
              className="text-h5 text-heading font-sans font-medium"
            >
              {CONFIRMATION_COPY.nextStepsHeading}
            </h2>
            <ul className="text-body-sm text-muted-foreground measure mt-3 flex list-disc flex-col gap-2 pl-5">
              {CONFIRMATION_COPY.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {showCancel || showReschedule ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            {showReschedule ? (
              <Button asChild variant="secondary">
                <Link
                  href={`/patient/appointments/${appointment.id}/reschedule`}
                >
                  {RESCHEDULE_COPY.triggerLabel}
                </Link>
              </Button>
            ) : null}
            {showCancel ? (
              <CancelAppointmentDialog appointmentId={appointment.id} />
            ) : null}
          </div>
        ) : null}

        <AppointmentHistory events={events} />
      </div>
    </DetailShell>
  );
}

/**
 * The page frame, shared by all four outcomes.
 *
 * It owns the `<h1>` so every state has exactly one, including the two that
 * render an error rather than an appointment. The heading is deliberately
 * generic — "Appointment details", never the date or the practitioner — for
 * the same reason the metadata title is.
 */
function DetailShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <Section aria-labelledby="appointment-detail-heading">
      <Container width="content">
        <Link
          href="/patient/appointments"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {APPOINTMENTS_AREA.list.heading}
        </Link>

        <h1
          id="appointment-detail-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {APPOINTMENT_COPY.detailsLabel}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
