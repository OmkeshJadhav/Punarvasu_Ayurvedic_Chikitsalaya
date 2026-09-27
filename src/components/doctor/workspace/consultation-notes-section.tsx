import Link from "next/link";

import { ClinicalRecordView } from "@/components/clinical/clinical-section";
import { ClinicalRecordStatusBadge } from "@/components/clinical/clinical-record-status";
import { ConsultationForm } from "@/components/clinical/consultation-form";
import { StartConsultation } from "@/components/clinical/start-consultation";
import {
  WaitingNotice,
  WorkspaceSection,
} from "@/components/doctor/workspace/workspace-section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isTerminalStatus } from "@/features/appointments/status";
import type { AppointmentStatus } from "@/features/appointments/types";
import {
  CLINICAL_RECORD_VIEW_COPY,
  CONSULTATION_WORKSPACE_COPY,
} from "@/features/clinical/content";
import { getConsultationContext } from "@/features/clinical/queries";
import {
  isClinicalRecordEditable,
  isConsultationEligible,
} from "@/features/clinical/status";
import { DOCTOR_WORKSPACE_COPY } from "@/features/doctor/content";
import {
  WORKSPACE_SECTIONS,
  appointmentWorkspaceHref,
} from "@/features/doctor/workspace";

const TITLE = DOCTOR_WORKSPACE_COPY.sections.consultation;

/**
 * The clinical record for this appointment — formerly its own page at
 * `/consultation`.
 *
 * ## Four states, each said differently
 *
 * | state | what it shows |
 * | --- | --- |
 * | `unavailable` | an error and a retry |
 * | `not_found` | the Phase 12 "not yours, or no such" answer (section 57) |
 * | `not_started` | a start button if the patient is checked in; otherwise why not |
 * | `found` | the form, or the finished record if it is complete |
 *
 * Collapsing `not_started` into an empty form would mean a practitioner typing
 * notes into a record that had never been created and finding out on save.
 *
 * ## Authorization
 *
 * The caller renders this only when `clinical_records.read` is held, and
 * `getConsultationContext` asserts it again. Row-level security restricts the
 * appointment to the caller's diary and the record to its author, so no id
 * reaches a record the practitioner could not already read.
 */
export async function ConsultationNotesSection({
  appointmentId,
  appointmentStatus,
}: {
  readonly appointmentId: string;
  readonly appointmentStatus: AppointmentStatus;
}) {
  const result = await getConsultationContext(appointmentId);
  const id = WORKSPACE_SECTIONS.consultation;

  if (result.status === "unavailable") {
    return (
      <WorkspaceSection id={id} title={TITLE}>
        <ErrorState
          title={CONSULTATION_WORKSPACE_COPY.loadErrorTitle}
          description={CONSULTATION_WORKSPACE_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link
                href={appointmentWorkspaceHref(appointmentId, "consultation")}
              >
                {CONSULTATION_WORKSPACE_COPY.loadErrorRetryLabel}
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
          title={CONSULTATION_WORKSPACE_COPY.notFoundTitle}
          description={CONSULTATION_WORKSPACE_COPY.notFoundDescription}
        />
      </WorkspaceSection>
    );
  }

  if (result.status === "not_started") {
    return (
      <WorkspaceSection id={id} title={TITLE}>
        {isConsultationEligible(appointmentStatus) ? (
          <div className="flex flex-col items-start gap-4">
            <p className="text-body text-muted-foreground measure">
              {CONSULTATION_WORKSPACE_COPY.startDescription}
            </p>
            <StartConsultation appointmentId={appointmentId} />
          </div>
        ) : (
          <WaitingNotice>
            {isTerminalStatus(appointmentStatus)
              ? DOCTOR_WORKSPACE_COPY.notesNoneRecorded
              : DOCTOR_WORKSPACE_COPY.notesNotReady}
          </WaitingNotice>
        )}
      </WorkspaceSection>
    );
  }

  const { record } = result.context;

  return (
    <WorkspaceSection
      id={id}
      title={TITLE}
      status={<ClinicalRecordStatusBadge status={record.status} />}
    >
      {isClinicalRecordEditable(record.status) ? (
        <ConsultationForm record={record} />
      ) : (
        <>
          {/*
            A completed record is rendered as prose rather than as a form with
            disabled inputs. A disabled control says "not right now"; a
            completed clinical record is finished permanently, by design
            (`phase_12.md` section 16, example 5).
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

      {/*
        What reaches the patient and what does not, said beside the notes —
        the place a practitioner looks before deciding whether to phone.
      */}
      <Alert tone="info" title={CONSULTATION_WORKSPACE_COPY.scopeNotice.title}>
        {CONSULTATION_WORKSPACE_COPY.scopeNotice.body}
      </Alert>
    </WorkspaceSection>
  );
}
