import type { Metadata } from "next";
import Link from "next/link";
import { WithdrawPrescription } from "@/components/prescriptions/prescription-actions";
import { PrescriptionStatusBadge } from "@/components/prescriptions/prescription-status";
import {
  PrescriptionInstructions,
  PrescriptionItems,
} from "@/components/prescriptions/prescription-summary";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatClinicDateTime } from "@/features/appointments/time";
import {
  PRESCRIPTION_BUILDER_COPY,
  PRESCRIPTION_DETAIL_COPY,
} from "@/features/prescriptions/content";
import { getPrescriptionForDoctor } from "@/features/prescriptions/queries";
import {
  isPrescriptionCancellable,
  isPrescriptionEditable,
} from "@/features/prescriptions/status";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * One historical prescription (`phase_13.md` sections 38 and 40).
 *
 * Read-only by construction: there is no form on this page, and an issued
 * prescription cannot be edited through any path — the guard triggers refuse
 * a content change, and there is no update grant for any client role. The one
 * action a practitioner still has is to withdraw it, which preserves it.
 *
 * The record is also checked against the patient in the URL, so a
 * well-formed prescription id belonging to a different patient renders the
 * same "we couldn't find that" as one that does not exist.
 */
export const metadata: Metadata = {
  title: PRESCRIPTION_DETAIL_COPY.heading,
  robots: { index: false, follow: false },
};

export default async function DoctorPrescriptionPage({
  params,
}: PageProps<"/doctor/patients/[id]/prescriptions/[prescriptionId]">) {
  await requirePermission("prescriptions.read", "/doctor/patients");

  const { id: patientId, prescriptionId } = await params;
  const result = await getPrescriptionForDoctor(prescriptionId);

  if (result.status === "unavailable") {
    return (
      <DetailShell patientId={patientId}>
        <ErrorState
          title={PRESCRIPTION_DETAIL_COPY.loadErrorTitle}
          description={PRESCRIPTION_DETAIL_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link
                href={`/doctor/patients/${patientId}/prescriptions/${prescriptionId}`}
              >
                {PRESCRIPTION_DETAIL_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  if (
    result.status === "not_found" ||
    result.prescription.patientId !== patientId
  ) {
    return (
      <DetailShell patientId={patientId}>
        <EmptyState
          title={PRESCRIPTION_DETAIL_COPY.notFoundTitle}
          description={PRESCRIPTION_DETAIL_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/patients">
                {PRESCRIPTION_DETAIL_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  const { prescription } = result;
  const stillADraft = isPrescriptionEditable(prescription.status);

  return (
    <DetailShell patientId={patientId}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <PrescriptionStatusBadge status={prescription.status} />
        </div>

        {stillADraft ? (
          <>
            <Alert
              tone="warning"
              title={PRESCRIPTION_BUILDER_COPY.draftNotice.title}
            >
              {PRESCRIPTION_BUILDER_COPY.draftNotice.body}
            </Alert>
            <div>
              <Button asChild>
                <Link
                  href={`/doctor/appointments/${prescription.appointmentId}/prescription`}
                >
                  {PRESCRIPTION_DETAIL_COPY.continueDraftLabel}
                </Link>
              </Button>
            </div>
          </>
        ) : prescription.status === "cancelled" ? (
          <Alert
            tone="warning"
            title={PRESCRIPTION_BUILDER_COPY.cancelledNotice.title}
          >
            {PRESCRIPTION_BUILDER_COPY.cancelledNotice.body}
          </Alert>
        ) : (
          <Alert
            tone="success"
            title={PRESCRIPTION_BUILDER_COPY.issuedNotice.title}
          >
            {PRESCRIPTION_BUILDER_COPY.issuedNotice.body}
          </Alert>
        )}

        <ProfileSection
          id="prescription-meta"
          title={PRESCRIPTION_DETAIL_COPY.metaHeading}
        >
          <ProfileFieldList>
            <ProfileField
              label={PRESCRIPTION_DETAIL_COPY.startedOnLabel}
              value={formatClinicDateTime(prescription.createdAt)}
            />
            {prescription.issuedAt ? (
              <ProfileField
                label={PRESCRIPTION_DETAIL_COPY.issuedOnLabel}
                value={formatClinicDateTime(prescription.issuedAt)}
              />
            ) : null}
            {prescription.cancelledAt ? (
              <ProfileField
                label={PRESCRIPTION_DETAIL_COPY.withdrawnOnLabel}
                value={formatClinicDateTime(prescription.cancelledAt)}
              />
            ) : null}
            {prescription.cancellationReason.trim() ? (
              <ProfileField
                label={PRESCRIPTION_DETAIL_COPY.withdrawnReasonLabel}
                value={prescription.cancellationReason.trim()}
              />
            ) : null}
          </ProfileFieldList>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link
                href={`/doctor/appointments/${prescription.appointmentId}/consultation`}
              >
                {PRESCRIPTION_DETAIL_COPY.openConsultationLabel}
              </Link>
            </Button>
            {isPrescriptionCancellable(prescription.status) && !stillADraft ? (
              <WithdrawPrescription
                prescriptionId={prescription.id}
                version={prescription.version}
              />
            ) : null}
          </div>
        </ProfileSection>

        <section
          aria-labelledby="prescription-medicines"
          className="flex flex-col gap-5"
        >
          <h2
            id="prescription-medicines"
            className="text-h4 text-heading font-sans font-medium"
          >
            {PRESCRIPTION_DETAIL_COPY.medicinesHeading}
          </h2>
          <PrescriptionItems
            items={prescription.items}
            emptyMessage={PRESCRIPTION_BUILDER_COPY.emptyItemsDescription}
          />
          <PrescriptionInstructions
            heading={PRESCRIPTION_BUILDER_COPY.generalInstructionsLabel}
            instructions={prescription.generalInstructions}
          />
        </section>
      </div>
    </DetailShell>
  );
}

function DetailShell({
  patientId,
  children,
}: {
  readonly patientId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Section aria-labelledby="prescription-detail-heading">
      <Container width="content">
        <Link
          href={`/doctor/patients/${patientId}`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {PRESCRIPTION_DETAIL_COPY.backLabel}
        </Link>
        <h1
          id="prescription-detail-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {PRESCRIPTION_DETAIL_COPY.heading}
        </h1>
        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
