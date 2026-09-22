import type { Metadata } from "next";
import Link from "next/link";
import { PrescriptionStatusBadge } from "@/components/prescriptions/prescription-status";
import {
  PrescriptionInstructions,
  PrescriptionItems,
} from "@/components/prescriptions/prescription-summary";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatClinicDate } from "@/features/appointments/time";
import {
  PATIENT_PRESCRIPTION_COPY,
  PRESCRIPTION_AREA,
} from "@/features/prescriptions/content";
import {
  getPatientPrescription,
  getPractitionerDisplayName,
} from "@/features/prescriptions/queries";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * A patient's own prescription, in full (`phase_13.md` sections 35 and 75).
 *
 * ## What it shows
 *
 * What was prescribed, who prescribed it and when — and the safety sentences
 * a healthcare product owes somebody reading this alone at home.
 *
 * ## What it does not show
 *
 * No doctor's note, no assessment, no diagnosis, no clinical reasoning, no
 * consultation, and no internal identifier. Those are not filtered out here:
 * the query fetches the prescription, and the clinical record they live on has
 * **no policy at all** for a patient, so there is nothing to filter.
 *
 * ## A draft never reaches this page
 *
 * `prescriptions_select_patient` carries `status <> 'draft'`, and the query
 * adds the same filter. A draft prescription id typed into the address bar
 * renders the same "we couldn't find that" as one that does not exist.
 */
export const metadata: Metadata = {
  // Never a medicine name and never the practitioner's: a page title reaches
  // browser history and the tab strip.
  title: PRESCRIPTION_AREA.patientDetail.title,
  robots: { index: false, follow: false },
};

export default async function PatientPrescriptionPage({
  params,
}: PageProps<"/patient/prescriptions/[id]">) {
  await requirePermission("prescriptions.read.self", "/patient");

  const { id } = await params;
  const result = await getPatientPrescription(id);

  if (result.status === "unavailable") {
    return (
      <DetailShell>
        <ErrorState
          title={PATIENT_PRESCRIPTION_COPY.errorTitle}
          description={PATIENT_PRESCRIPTION_COPY.errorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/patient/prescriptions/${id}`}>
                {PATIENT_PRESCRIPTION_COPY.errorRetryLabel}
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
          title={PATIENT_PRESCRIPTION_COPY.notFoundTitle}
          description={PATIENT_PRESCRIPTION_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/patient/prescriptions">
                {PATIENT_PRESCRIPTION_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  const { prescription } = result;
  const practitionerName = await getPractitionerDisplayName(
    prescription.practitionerId,
  );
  const withdrawn = prescription.status === "cancelled";

  return (
    <DetailShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <PrescriptionStatusBadge status={prescription.status} />
        </div>

        {/*
          A withdrawn prescription is still shown, and shown as withdrawn.
          Hiding it would leave somebody following a paper copy with no way to
          find out it had been stopped — which is the more dangerous of the two
          outcomes by a distance.
        */}
        {withdrawn ? (
          <Alert
            tone="warning"
            title={PATIENT_PRESCRIPTION_COPY.withdrawnNotice.title}
          >
            {PATIENT_PRESCRIPTION_COPY.withdrawnNotice.body}
          </Alert>
        ) : null}

        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {prescription.issuedAt ? (
            <div className="min-w-0">
              <dt className="text-caption text-muted-foreground font-sans">
                {PATIENT_PRESCRIPTION_COPY.issuedOnLabel}
              </dt>
              <dd className="text-body text-foreground font-sans font-medium">
                <time dateTime={prescription.issuedAt.toISOString()}>
                  {formatClinicDate(prescription.issuedAt)}
                </time>
              </dd>
            </div>
          ) : null}
          {practitionerName ? (
            <div className="min-w-0">
              <dt className="text-caption text-muted-foreground font-sans">
                {PATIENT_PRESCRIPTION_COPY.issuedByLabel}
              </dt>
              <dd className="text-body text-foreground font-sans font-medium wrap-break-word">
                {practitionerName}
              </dd>
            </div>
          ) : null}
        </dl>

        {withdrawn && prescription.cancellationReason.trim() ? (
          <div>
            <h2 className="text-h5 text-heading font-sans font-medium">
              {PATIENT_PRESCRIPTION_COPY.withdrawnReasonLabel}
            </h2>
            <p className="text-body text-foreground measure mt-2 font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
              {prescription.cancellationReason.trim()}
            </p>
          </div>
        ) : null}

        <section
          aria-labelledby="patient-prescription-medicines"
          className="flex flex-col gap-5"
        >
          <h2
            id="patient-prescription-medicines"
            className="text-h4 text-heading font-sans font-medium"
          >
            {PATIENT_PRESCRIPTION_COPY.medicinesHeading}
          </h2>
          <PrescriptionItems
            items={prescription.items}
            emptyMessage={PATIENT_PRESCRIPTION_COPY.emptyDescription}
          />
        </section>

        <PrescriptionInstructions
          heading={PATIENT_PRESCRIPTION_COPY.instructionsHeading}
          instructions={prescription.generalInstructions}
        />

        <Alert tone="info" title={PATIENT_PRESCRIPTION_COPY.safetyNotice.title}>
          {PATIENT_PRESCRIPTION_COPY.safetyNotice.body}
        </Alert>
      </div>
    </DetailShell>
  );
}

function DetailShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <Section aria-labelledby="patient-prescription-heading">
      <Container width="content">
        <Link
          href="/patient/prescriptions"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {PATIENT_PRESCRIPTION_COPY.backLabel}
        </Link>
        <h1
          id="patient-prescription-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {PATIENT_PRESCRIPTION_COPY.detailHeading}
        </h1>
        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
