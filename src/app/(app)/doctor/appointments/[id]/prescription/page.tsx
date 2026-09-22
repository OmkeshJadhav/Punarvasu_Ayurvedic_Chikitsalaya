import type { Metadata } from "next";
import Link from "next/link";
import { WithdrawPrescription } from "@/components/prescriptions/prescription-actions";
import { PrescriptionBuilder } from "@/components/prescriptions/prescription-builder";
import { PrescriptionStatusBadge } from "@/components/prescriptions/prescription-status";
import {
  PrescriptionInstructions,
  PrescriptionItems,
} from "@/components/prescriptions/prescription-summary";
import { StartPrescription } from "@/components/prescriptions/start-prescription";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ClinicalContextHeader } from "@/components/shared/clinical-context-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CONSULTATION_WORKSPACE_COPY } from "@/features/clinical/content";
import { PRESCRIPTION_BUILDER_COPY } from "@/features/prescriptions/content";
import { getPrescriptionWorkspace } from "@/features/prescriptions/queries";
import {
  isPrescriptionCancellable,
  isPrescriptionEditable,
} from "@/features/prescriptions/status";
import type { PrescriptionSubject } from "@/features/prescriptions/types";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * The prescription builder for one consultation.
 *
 * It sits on the appointment, beside the consultation notes, because that is
 * where a practitioner already is when they decide what to prescribe
 * (`phase_13.md` section 64 — do not open unrelated pages during a
 * consultation). The patient, the appointment and the practitioner are all
 * derived from the consultation; nothing here asks the doctor to re-enter
 * them and nothing here accepts them from a request (section 79).
 */
export const metadata: Metadata = {
  // Never the patient's name and never anything clinical: a page title reaches
  // browser history, the tab strip and a screen share, and a consulting-room
  // screen is read over shoulders.
  title: PRESCRIPTION_BUILDER_COPY.heading,
  robots: { index: false, follow: false },
};

export default async function PrescriptionPage({
  params,
}: PageProps<"/doctor/appointments/[id]/prescription">) {
  await requirePermission("prescriptions.read", "/doctor/appointments");

  const { id } = await params;
  const result = await getPrescriptionWorkspace(id);

  if (result.status === "unavailable") {
    return (
      <PrescriptionShell appointmentId={id}>
        <ErrorState
          title={PRESCRIPTION_BUILDER_COPY.loadErrorTitle}
          description={PRESCRIPTION_BUILDER_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/doctor/appointments/${id}/prescription`}>
                {PRESCRIPTION_BUILDER_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </PrescriptionShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <PrescriptionShell appointmentId={id}>
        <EmptyState
          title={PRESCRIPTION_BUILDER_COPY.notFoundTitle}
          description={PRESCRIPTION_BUILDER_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/appointments">
                {PRESCRIPTION_BUILDER_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </PrescriptionShell>
    );
  }

  // A prescription hangs off a consultation, so there is nothing to attach one
  // to until the consultation has been opened. Two different empty states,
  // because the practitioner's next action differs.
  if (result.status === "no_consultation") {
    return (
      <PrescriptionShell appointmentId={id}>
        <div className="flex flex-col gap-10">
          <ContextHeader subject={result.subject} />
          <EmptyState
            title={CONSULTATION_WORKSPACE_COPY.notStartedTitle}
            description={CONSULTATION_WORKSPACE_COPY.startDescription}
            action={
              <Button asChild>
                <Link href={`/doctor/appointments/${id}/consultation`}>
                  {CONSULTATION_WORKSPACE_COPY.startLabel}
                </Link>
              </Button>
            }
          />
        </div>
      </PrescriptionShell>
    );
  }

  if (result.status === "not_started") {
    return (
      <PrescriptionShell appointmentId={id}>
        <div className="flex flex-col gap-10">
          <ContextHeader subject={result.subject} />
          <section
            aria-labelledby="prescription-start"
            className="flex flex-col gap-4"
          >
            <h2
              id="prescription-start"
              className="text-h3 text-heading font-normal"
            >
              {PRESCRIPTION_BUILDER_COPY.startTitle}
            </h2>
            <p className="text-body text-muted-foreground measure">
              {PRESCRIPTION_BUILDER_COPY.startDescription}
            </p>
            <div>
              <StartPrescription clinicalRecordId={result.clinicalRecordId} />
            </div>
          </section>
        </div>
      </PrescriptionShell>
    );
  }

  const { prescription, subject } = result;
  const editable = isPrescriptionEditable(prescription.status);

  return (
    <PrescriptionShell appointmentId={id}>
      <div className="flex flex-col gap-10">
        <ContextHeader subject={subject} />

        <section
          aria-labelledby="prescription-record"
          className="flex flex-col gap-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="prescription-record"
              className="text-h3 text-heading font-normal"
            >
              {PRESCRIPTION_BUILDER_COPY.heading}
            </h2>
            <PrescriptionStatusBadge status={prescription.status} />
          </div>

          <p className="text-body-sm text-muted-foreground measure">
            {PRESCRIPTION_BUILDER_COPY.introDescription}
          </p>

          {editable ? (
            <>
              <Alert
                tone="info"
                title={PRESCRIPTION_BUILDER_COPY.draftNotice.title}
              >
                {PRESCRIPTION_BUILDER_COPY.draftNotice.body}
              </Alert>
              <PrescriptionBuilder prescription={prescription} />
            </>
          ) : (
            <>
              {/*
                An issued prescription is rendered as prose, never as a form
                with disabled inputs. A disabled control says "not right now";
                an issued prescription is finished permanently, by design
                (sections 42 and 74). The notice says why, which beats a
                greyed-out field that explains nothing.
              */}
              {/*
                Only an issued prescription reaches here: the workspace query
                asks for the consultation's *live* prescription, and a
                withdrawn one is not live — which is exactly what frees the
                consultation for a corrected prescription, and why withdrawing
                returns this page to its "start one" state.
              */}
              <Alert
                tone="success"
                title={PRESCRIPTION_BUILDER_COPY.issuedNotice.title}
              >
                {PRESCRIPTION_BUILDER_COPY.issuedNotice.body}
              </Alert>

              <PrescriptionItems
                items={prescription.items}
                emptyMessage={PRESCRIPTION_BUILDER_COPY.emptyItemsDescription}
              />

              <PrescriptionInstructions
                heading={PRESCRIPTION_BUILDER_COPY.generalInstructionsLabel}
                instructions={prescription.generalInstructions}
              />

              {isPrescriptionCancellable(prescription.status) ? (
                <div className="flex flex-wrap gap-3">
                  <WithdrawPrescription
                    prescriptionId={prescription.id}
                    version={prescription.version}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </PrescriptionShell>
  );
}

function ContextHeader({ subject }: { readonly subject: PrescriptionSubject }) {
  return (
    <ClinicalContextHeader
      heading={PRESCRIPTION_BUILDER_COPY.patientHeading}
      fullName={subject.fullName}
      preferredName={subject.preferredName}
      dateOfBirth={subject.dateOfBirth}
      phone={subject.phone}
      appointmentHeading={PRESCRIPTION_BUILDER_COPY.appointmentHeading}
      appointmentStartsAt={subject.appointmentStartsAt}
      appointmentTypeName={subject.appointmentTypeName}
      practitionerName={subject.practitionerName}
      practitionerLabel={PRESCRIPTION_BUILDER_COPY.practitionerLabel}
      hint={PRESCRIPTION_BUILDER_COPY.identityHint}
      labels={{
        dateOfBirth: PRESCRIPTION_BUILDER_COPY.dateOfBirthLabel,
        age: PRESCRIPTION_BUILDER_COPY.ageLabel,
        phone: PRESCRIPTION_BUILDER_COPY.phoneLabel,
        when: PRESCRIPTION_BUILDER_COPY.whenLabel,
        type: PRESCRIPTION_BUILDER_COPY.typeLabel,
      }}
    />
  );
}

function PrescriptionShell({
  appointmentId,
  children,
}: {
  readonly appointmentId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Section aria-labelledby="prescription-heading">
      <Container width="content">
        <Link
          href={`/doctor/appointments/${appointmentId}/consultation`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {PRESCRIPTION_BUILDER_COPY.backLabel}
        </Link>
        <h1
          id="prescription-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {PRESCRIPTION_BUILDER_COPY.heading}
        </h1>
        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
