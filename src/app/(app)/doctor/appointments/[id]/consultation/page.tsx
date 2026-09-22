import type { Metadata } from "next";
import Link from "next/link";

import { ClinicalRecordView } from "@/components/clinical/clinical-section";
import { ClinicalRecordStatusBadge } from "@/components/clinical/clinical-record-status";
import { ConsultationForm } from "@/components/clinical/consultation-form";
import { PatientClinicalHeader } from "@/components/clinical/patient-clinical-header";
import { StartConsultation } from "@/components/clinical/start-consultation";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CLINICAL_RECORD_VIEW_COPY,
  CONSULTATION_WORKSPACE_COPY,
} from "@/features/clinical/content";
import {
  getConsultationContext,
  getConsultationSubject,
} from "@/features/clinical/queries";
import {
  isClinicalRecordEditable,
  isConsultationEligible,
} from "@/features/clinical/status";
import { currentUserCan, requirePermission } from "@/lib/authorization/guards";

export const metadata: Metadata = {
  // Never the patient's name, the date or anything clinical. A page title
  // reaches browser history, the tab strip and a screen share, and a
  // consulting-room screen is read over shoulders.
  title: CONSULTATION_WORKSPACE_COPY.heading,
  // Section 77 and `docs/SECURITY.md` section 14. Also `private, no-store`
  // from the authenticated layout, and disallowed in robots.txt.
  robots: { index: false, follow: false },
};

/**
 * The consultation workspace — the clinical record, in the place Phase 11
 * left for it.
 *
 * ## What this page is
 *
 * `phase_12.md` sections 18, 27 and 52. The flow Phase 11 established —
 * `doctor dashboard -> appointment -> start consultation` — now ends in a
 * clinical record rather than a notice saying there is nowhere to write. The
 * route, the authorization and the patient context did not move; the record
 * was added to them, which is exactly what Phase 11's docblock said would
 * happen.
 *
 * ```text
 * Patient header       who is in front of you (sections 28-29)
 * Appointment context  which appointment this is (section 30)
 * Clinical record      the eight sections (sections 13, 27, 31)
 * Save / Complete      (sections 33, 35)
 * ```
 *
 * ## Four states, and each is a different page
 *
 * | state | what it means | what it shows |
 * | --- | --- | --- |
 * | `unavailable` | the read failed | an error and a retry |
 * | `not_found` | not this practitioner's, or no such appointment | the same answer for both (section 57) |
 * | `not_started` | no clinical record yet | the patient, the appointment, and a way to start |
 * | `found` | there is a record | the form, or the record if it is complete |
 *
 * Collapsing `not_started` into an empty form would mean a practitioner
 * typing a page of notes into something that had never been created, and
 * finding out when they pressed save.
 *
 * ## Authorization
 *
 * Four independent scopes, and this page adds none of them itself:
 *
 *   * `requirePermission("clinical_records.read")` — the route guard;
 *   * `appointments_select_own_practitioner` — the appointment;
 *   * `clinical_records_select_author` — the record;
 *   * `patients_select_doctor_care` — the patient's identity.
 *
 * A consultation on another practitioner's appointment is `not_found` before
 * any clinical query runs, and their clinical record would be `not_found`
 * again if it somehow got past the first.
 *
 * ## Server-rendered
 *
 * Section 78. Everything here is a server component except the form, the
 * start button and the navigation guard — the three things that genuinely
 * need the browser. No clinical content reaches a client component except the
 * record the practitioner is editing, and none reaches browser storage
 * (section 79).
 */
export default async function ConsultationPage({
  params,
}: PageProps<"/doctor/appointments/[id]/consultation">) {
  await requirePermission("clinical_records.read", "/doctor/appointments");

  const { id } = await params;
  const result = await getConsultationContext(id);

  if (result.status === "unavailable") {
    return (
      <ConsultationShell appointmentId={id}>
        <ErrorState
          title={CONSULTATION_WORKSPACE_COPY.loadErrorTitle}
          description={CONSULTATION_WORKSPACE_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/doctor/appointments/${id}/consultation`}>
                {CONSULTATION_WORKSPACE_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </ConsultationShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <ConsultationShell appointmentId={id}>
        <EmptyState
          title={CONSULTATION_WORKSPACE_COPY.notFoundTitle}
          description={CONSULTATION_WORKSPACE_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/appointments">
                {CONSULTATION_WORKSPACE_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </ConsultationShell>
    );
  }

  if (result.status === "not_started") {
    return <NotStarted appointmentId={id} />;
  }

  const { record, patient, appointment } = result.context;
  const editable = isClinicalRecordEditable(record.status);
  const aiAvailable = await currentUserCan("clinical_ai.use");

  return (
    <ConsultationShell appointmentId={appointment.id}>
      <div className="flex flex-col gap-10">
        <PatientClinicalHeader patient={patient} appointment={appointment} />

        <section
          aria-labelledby="consultation-record"
          className="flex flex-col gap-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="consultation-record"
              className="text-h3 text-heading font-normal"
            >
              {CONSULTATION_WORKSPACE_COPY.recordHeading}
            </h2>
            <ClinicalRecordStatusBadge status={record.status} />
          </div>

          {editable ? (
            <ConsultationForm record={record} />
          ) : (
            <>
              {/*
                A completed record is rendered as prose rather than as a form
                with disabled inputs. A disabled control says "not right now";
                a completed clinical record is finished permanently, by design
                (section 16, example 5). The notice says why, which beats a
                greyed-out button that explains nothing.
              */}
              <Alert
                tone="success"
                title={CLINICAL_RECORD_VIEW_COPY.completedNotice.title}
              >
                {CLINICAL_RECORD_VIEW_COPY.completedNotice.body}
              </Alert>
              <ClinicalRecordView content={record} />
            </>
          )}
        </section>

        {/*
          Phase 13. The prescription and the treatment plan are their own
          documents with their own lifecycles and their own patient
          visibility, so they are separate pages — but reached from here,
          because this is where the practitioner already is when they decide
          what to prescribe (`phase_13.md` section 64).
        */}
        <section
          aria-labelledby="consultation-next-steps"
          className="flex flex-col gap-4"
        >
          <h2
            id="consultation-next-steps"
            className="text-h3 text-heading font-normal"
          >
            {CONSULTATION_WORKSPACE_COPY.nextStepsHeading}
          </h2>
          <p className="text-body-sm text-muted-foreground measure">
            {CONSULTATION_WORKSPACE_COPY.nextStepsDescription}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild>
              <Link
                href={`/doctor/appointments/${appointment.id}/prescription`}
              >
                {CONSULTATION_WORKSPACE_COPY.prescriptionLinkLabel}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link
                href={`/doctor/appointments/${appointment.id}/treatment-plan`}
              >
                {CONSULTATION_WORKSPACE_COPY.treatmentPlanLinkLabel}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/doctor/appointments/${appointment.id}/documents`}>
                {CONSULTATION_WORKSPACE_COPY.documentsLinkLabel}
              </Link>
            </Button>
            {/*
              Phase 17. Rendered only when the practitioner actually holds the
              permission — a link to a route the guard would refuse is a dead
              end, and `currentUserCan` exists for exactly this presentation
              decision. It is not the security boundary: the route guards
              itself, every database function re-checks the role, and the
              context builder reads nothing row-level security would not
              return (`phase_08.md` section 10, layer 1).

              A `ghost` button rather than a `secondary` one, so the three
              things this consultation produces stay visually ahead of the aid
              that produces nothing (`phase_17.md` section 135).
            */}
            {aiAvailable ? (
              <Button asChild variant="ghost">
                <Link href={`/doctor/appointments/${appointment.id}/ai`}>
                  {CONSULTATION_WORKSPACE_COPY.aiSupportLinkLabel}
                </Link>
              </Button>
            ) : null}
          </div>
        </section>

        {/*
          The Phase 14 boundary, said where a practitioner will look for the
          missing thing — the same convention every phase of this project has
          followed.
        */}
        <Alert
          tone="info"
          title={CONSULTATION_WORKSPACE_COPY.scopeNotice.title}
        >
          {CONSULTATION_WORKSPACE_COPY.scopeNotice.body}
        </Alert>
      </div>
    </ConsultationShell>
  );
}

/**
 * The appointment has no clinical record yet.
 *
 * Two sub-cases, and they need different things said:
 *
 *   * the patient has been checked in, so a consultation can begin — show who
 *     they are, and offer to start;
 *   * the appointment is not ready (still requested, cancelled, already
 *     completed) — say so, and send the practitioner back to the appointment,
 *     because whatever needs doing is done there.
 *
 * The decision is `isConsultationEligible`, which mirrors the eligibility
 * check inside `start_consultation` and is asserted against it by reading the
 * migration. It accepts `in_consultation` as well as `checked_in`, because
 * Phase 11's status action can move an appointment into consultation without
 * creating a record — and a practitioner who took that path must not find a
 * page telling them the consultation has not been started with no way to
 * start it.
 *
 * The database re-derives the same eligibility, so a stale page offering the
 * button reaches a refusal rather than a wrong state.
 */
async function NotStarted({
  appointmentId,
}: {
  readonly appointmentId: string;
}) {
  const subject = await getConsultationSubject(appointmentId);

  if (subject.status !== "found") {
    return (
      <ConsultationShell appointmentId={appointmentId}>
        {subject.status === "unavailable" ? (
          <ErrorState
            title={CONSULTATION_WORKSPACE_COPY.loadErrorTitle}
            description={CONSULTATION_WORKSPACE_COPY.loadErrorDescription}
            action={
              <Button asChild variant="secondary">
                <Link
                  href={`/doctor/appointments/${appointmentId}/consultation`}
                >
                  {CONSULTATION_WORKSPACE_COPY.loadErrorRetryLabel}
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={CONSULTATION_WORKSPACE_COPY.notFoundTitle}
            description={CONSULTATION_WORKSPACE_COPY.notFoundDescription}
            action={
              <Button asChild>
                <Link href="/doctor/appointments">
                  {CONSULTATION_WORKSPACE_COPY.notFoundAction}
                </Link>
              </Button>
            }
          />
        )}
      </ConsultationShell>
    );
  }

  const { appointment, patient } = subject;
  const ready = isConsultationEligible(appointment.status);

  return (
    <ConsultationShell appointmentId={appointment.id}>
      <div className="flex flex-col gap-10">
        <PatientClinicalHeader patient={patient} appointment={appointment} />

        {ready ? (
          <section
            aria-labelledby="consultation-start"
            className="flex flex-col gap-4"
          >
            <h2
              id="consultation-start"
              className="text-h3 text-heading font-normal"
            >
              {CONSULTATION_WORKSPACE_COPY.startTitle}
            </h2>
            <p className="text-body text-muted-foreground measure">
              {CONSULTATION_WORKSPACE_COPY.startDescription}
            </p>
            <div>
              <StartConsultation appointmentId={appointment.id} />
            </div>
          </section>
        ) : (
          <EmptyState
            title={CONSULTATION_WORKSPACE_COPY.notStartedTitle}
            description={CONSULTATION_WORKSPACE_COPY.notStartedDescription}
            action={
              <Button asChild>
                <Link href={`/doctor/appointments/${appointment.id}`}>
                  {CONSULTATION_WORKSPACE_COPY.notStartedAction}
                </Link>
              </Button>
            }
          />
        )}
      </div>
    </ConsultationShell>
  );
}

/**
 * The page frame, shared by every outcome.
 *
 * It owns the single `<h1>`, which is the generic word "Consultation" and
 * never the patient's name: a heading is read over a shoulder, and a page
 * title reaches browser history and a screen share. The patient's name is an
 * `<h2>` inside the header block, where a practitioner looks for it.
 */
function ConsultationShell({
  appointmentId,
  children,
}: {
  readonly appointmentId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Section aria-labelledby="consultation-heading">
      <Container width="content">
        <Link
          href={`/doctor/appointments/${appointmentId}`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {CONSULTATION_WORKSPACE_COPY.backLabel}
        </Link>

        <h1
          id="consultation-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {CONSULTATION_WORKSPACE_COPY.heading}
        </h1>

        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
