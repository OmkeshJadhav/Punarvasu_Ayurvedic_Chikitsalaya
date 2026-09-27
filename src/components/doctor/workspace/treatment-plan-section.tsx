import Link from "next/link";

import {
  WaitingNotice,
  WorkspaceSection,
} from "@/components/doctor/workspace/workspace-section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { StartTreatmentPlan } from "@/components/treatment-plans/start-treatment-plan";
import { TreatmentPlanActions } from "@/components/treatment-plans/treatment-plan-actions";
import { TreatmentPlanBuilder } from "@/components/treatment-plans/treatment-plan-builder";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status";
import { TreatmentPlanSections } from "@/components/treatment-plans/treatment-plan-summary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DOCTOR_WORKSPACE_COPY } from "@/features/doctor/content";
import {
  WORKSPACE_SECTIONS,
  appointmentWorkspaceHref,
} from "@/features/doctor/workspace";
import { formatDateOfBirth } from "@/features/patients/format";
import { TREATMENT_PLAN_BUILDER_COPY } from "@/features/treatment-plans/content";
import { getTreatmentPlanWorkspace } from "@/features/treatment-plans/queries";
import {
  isTreatmentPlanCancellable,
  isTreatmentPlanEditable,
} from "@/features/treatment-plans/status";

const TITLE = DOCTOR_WORKSPACE_COPY.sections.treatmentPlan;

/**
 * The treatment plan for this appointment — formerly its own page at
 * `/treatment-plan`.
 *
 * Only a *live* plan is shown: a completed or withdrawn one is not live, which
 * is what frees the consultation for a revised plan (`phase_13.md` section
 * 44) and why closing this one returns the section to its "start one" state.
 *
 * The caller renders this only when `treatment_plans.read` is held, and
 * `getTreatmentPlanWorkspace` asserts it again.
 */
export async function TreatmentPlanSection({
  appointmentId,
}: {
  readonly appointmentId: string;
}) {
  const result = await getTreatmentPlanWorkspace(appointmentId);
  const id = WORKSPACE_SECTIONS.treatmentPlan;

  if (result.status === "unavailable") {
    return (
      <WorkspaceSection id={id} title={TITLE}>
        <ErrorState
          title={TREATMENT_PLAN_BUILDER_COPY.loadErrorTitle}
          description={TREATMENT_PLAN_BUILDER_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link
                href={appointmentWorkspaceHref(appointmentId, "treatmentPlan")}
              >
                {TREATMENT_PLAN_BUILDER_COPY.loadErrorRetryLabel}
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
          title={TREATMENT_PLAN_BUILDER_COPY.notFoundTitle}
          description={TREATMENT_PLAN_BUILDER_COPY.notFoundDescription}
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
          {DOCTOR_WORKSPACE_COPY.treatmentPlanWaiting}
        </WaitingNotice>
      </WorkspaceSection>
    );
  }

  if (result.status === "not_started") {
    return (
      <WorkspaceSection id={id} title={TITLE}>
        <div className="flex flex-col items-start gap-4">
          <p className="text-body text-muted-foreground measure">
            {TREATMENT_PLAN_BUILDER_COPY.startDescription}
          </p>
          <StartTreatmentPlan clinicalRecordId={result.clinicalRecordId} />
        </div>
      </WorkspaceSection>
    );
  }

  const { plan } = result;

  return (
    <WorkspaceSection
      id={id}
      title={TITLE}
      status={<TreatmentPlanStatusBadge status={plan.status} />}
      description={TREATMENT_PLAN_BUILDER_COPY.introDescription}
    >
      {isTreatmentPlanEditable(plan.status) ? (
        <>
          <Alert
            tone="info"
            title={TREATMENT_PLAN_BUILDER_COPY.draftNotice.title}
          >
            {TREATMENT_PLAN_BUILDER_COPY.draftNotice.body}
          </Alert>
          <TreatmentPlanBuilder plan={plan} />
        </>
      ) : (
        <>
          <Alert
            tone="success"
            title={TREATMENT_PLAN_BUILDER_COPY.activeNotice.title}
          >
            {TREATMENT_PLAN_BUILDER_COPY.activeNotice.body}
          </Alert>

          {plan.title.trim() ? (
            <p className="text-h4 text-heading font-sans font-medium wrap-break-word">
              {plan.title.trim()}
            </p>
          ) : null}

          {plan.summary.trim() ? (
            <p className="text-body text-foreground measure font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
              {plan.summary.trim()}
            </p>
          ) : null}

          {plan.followUpOn ? (
            <p className="text-body-sm text-muted-foreground">
              {TREATMENT_PLAN_BUILDER_COPY.followUpLabel}:{" "}
              {formatDateOfBirth(plan.followUpOn)}
            </p>
          ) : null}

          <TreatmentPlanSections
            items={plan.items}
            emptyMessage={TREATMENT_PLAN_BUILDER_COPY.emptyItemsDescription}
          />

          {isTreatmentPlanCancellable(plan.status) ? (
            <TreatmentPlanActions planId={plan.id} version={plan.version} />
          ) : null}
        </>
      )}
    </WorkspaceSection>
  );
}
