import Link from "next/link";

import {
  WaitingNotice,
  WorkspaceSection,
} from "@/components/doctor/workspace/workspace-section";
import { WithdrawPrescription } from "@/components/prescriptions/prescription-actions";
import { PrescriptionBuilder } from "@/components/prescriptions/prescription-builder";
import { PrescriptionStatusBadge } from "@/components/prescriptions/prescription-status";
import {
  PrescriptionInstructions,
  PrescriptionItems,
} from "@/components/prescriptions/prescription-summary";
import { StartPrescription } from "@/components/prescriptions/start-prescription";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DOCTOR_WORKSPACE_COPY } from "@/features/doctor/content";
import {
  WORKSPACE_SECTIONS,
  appointmentWorkspaceHref,
} from "@/features/doctor/workspace";
import { PRESCRIPTION_BUILDER_COPY } from "@/features/prescriptions/content";
import { getPrescriptionWorkspace } from "@/features/prescriptions/queries";
import {
  isPrescriptionCancellable,
  isPrescriptionEditable,
} from "@/features/prescriptions/status";

const TITLE = DOCTOR_WORKSPACE_COPY.sections.prescription;

/**
 * The prescription for this appointment — formerly its own page at
 * `/prescription`.
 *
 * It resolves in three steps, each seeing only what the caller may: the
 * appointment, the consultation, then the consultation's *live*
 * prescription. A withdrawn one is not live, which is what frees the
 * consultation for a corrected prescription and why withdrawing returns this
 * section to its "start one" state.
 *
 * The caller renders this only when `prescriptions.read` is held, and
 * `getPrescriptionWorkspace` asserts it again.
 */
export async function PrescriptionSection({
  appointmentId,
}: {
  readonly appointmentId: string;
}) {
  const result = await getPrescriptionWorkspace(appointmentId);
  const id = WORKSPACE_SECTIONS.prescription;

  if (result.status === "unavailable") {
    return (
      <WorkspaceSection id={id} title={TITLE}>
        <ErrorState
          title={PRESCRIPTION_BUILDER_COPY.loadErrorTitle}
          description={PRESCRIPTION_BUILDER_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link
                href={appointmentWorkspaceHref(appointmentId, "prescription")}
              >
                {PRESCRIPTION_BUILDER_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </WorkspaceSection>
    );
  }

  if (result.status === "not_found") {
    return (
      <WorkspaceSection id={id} title={TITLE}>
        <EmptyState
          title={PRESCRIPTION_BUILDER_COPY.notFoundTitle}
          description={PRESCRIPTION_BUILDER_COPY.notFoundDescription}
        />
      </WorkspaceSection>
    );
  }

  if (result.status === "no_consultation") {
    return (
      <WorkspaceSection id={id} title={TITLE}>
        <WaitingNotice
          action={
            <Button asChild variant="secondary">
              <a href={`#${WORKSPACE_SECTIONS.consultation}`}>
                {DOCTOR_WORKSPACE_COPY.goToNotesLabel}
              </a>
            </Button>
          }
        >
          {DOCTOR_WORKSPACE_COPY.prescriptionWaiting}
        </WaitingNotice>
      </WorkspaceSection>
    );
  }

  if (result.status === "not_started") {
    return (
      <WorkspaceSection id={id} title={TITLE}>
        <div className="flex flex-col items-start gap-4">
          <p className="text-body text-muted-foreground measure">
            {PRESCRIPTION_BUILDER_COPY.startDescription}
          </p>
          <StartPrescription clinicalRecordId={result.clinicalRecordId} />
        </div>
      </WorkspaceSection>
    );
  }

  const { prescription } = result;

  return (
    <WorkspaceSection
      id={id}
      title={TITLE}
      status={<PrescriptionStatusBadge status={prescription.status} />}
      description={PRESCRIPTION_BUILDER_COPY.introDescription}
    >
      {isPrescriptionEditable(prescription.status) ? (
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
            An issued prescription is rendered as prose, never as a form with
            disabled inputs: it is finished permanently, by design
            (`phase_13.md` sections 42 and 74).
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
    </WorkspaceSection>
  );
}
