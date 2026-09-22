import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ClinicalContextHeader } from "@/components/shared/clinical-context-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TreatmentPlanActions } from "@/components/treatment-plans/treatment-plan-actions";
import { TreatmentPlanBuilder } from "@/components/treatment-plans/treatment-plan-builder";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status";
import { TreatmentPlanSections } from "@/components/treatment-plans/treatment-plan-summary";
import { StartTreatmentPlan } from "@/components/treatment-plans/start-treatment-plan";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CONSULTATION_WORKSPACE_COPY } from "@/features/clinical/content";
import { formatDateOfBirth } from "@/features/patients/format";
import { TREATMENT_PLAN_BUILDER_COPY } from "@/features/treatment-plans/content";
import { getTreatmentPlanWorkspace } from "@/features/treatment-plans/queries";
import {
  isTreatmentPlanEditable,
  isTreatmentPlanCancellable,
} from "@/features/treatment-plans/status";
import type { TreatmentPlanSubject } from "@/features/treatment-plans/types";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * The treatment plan builder for one consultation.
 *
 * Beside the prescription and the consultation notes, and separate from both
 * (`phase_13.md` section 28): a plan says how to eat, live and be treated, and
 * must not restate the medicines.
 */
export const metadata: Metadata = {
  title: TREATMENT_PLAN_BUILDER_COPY.heading,
  robots: { index: false, follow: false },
};

export default async function TreatmentPlanPage({
  params,
}: PageProps<"/doctor/appointments/[id]/treatment-plan">) {
  await requirePermission("treatment_plans.read", "/doctor/appointments");

  const { id } = await params;
  const result = await getTreatmentPlanWorkspace(id);

  if (result.status === "unavailable") {
    return (
      <PlanShell appointmentId={id}>
        <ErrorState
          title={TREATMENT_PLAN_BUILDER_COPY.loadErrorTitle}
          description={TREATMENT_PLAN_BUILDER_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/doctor/appointments/${id}/treatment-plan`}>
                {TREATMENT_PLAN_BUILDER_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </PlanShell>
    );
  }

  if (result.status === "not_found") {
    return (
      <PlanShell appointmentId={id}>
        <EmptyState
          title={TREATMENT_PLAN_BUILDER_COPY.notFoundTitle}
          description={TREATMENT_PLAN_BUILDER_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/appointments">
                {TREATMENT_PLAN_BUILDER_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </PlanShell>
    );
  }

  if (result.status === "no_consultation") {
    return (
      <PlanShell appointmentId={id}>
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
      </PlanShell>
    );
  }

  if (result.status === "not_started") {
    return (
      <PlanShell appointmentId={id}>
        <div className="flex flex-col gap-10">
          <ContextHeader subject={result.subject} />
          <section aria-labelledby="plan-start" className="flex flex-col gap-4">
            <h2 id="plan-start" className="text-h3 text-heading font-normal">
              {TREATMENT_PLAN_BUILDER_COPY.startTitle}
            </h2>
            <p className="text-body text-muted-foreground measure">
              {TREATMENT_PLAN_BUILDER_COPY.startDescription}
            </p>
            <div>
              <StartTreatmentPlan clinicalRecordId={result.clinicalRecordId} />
            </div>
          </section>
        </div>
      </PlanShell>
    );
  }

  const { plan, subject } = result;
  const editable = isTreatmentPlanEditable(plan.status);

  return (
    <PlanShell appointmentId={id}>
      <div className="flex flex-col gap-10">
        <ContextHeader subject={subject} />

        <section aria-labelledby="plan-record" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="plan-record" className="text-h3 text-heading font-normal">
              {TREATMENT_PLAN_BUILDER_COPY.heading}
            </h2>
            <TreatmentPlanStatusBadge status={plan.status} />
          </div>

          <p className="text-body-sm text-muted-foreground measure">
            {TREATMENT_PLAN_BUILDER_COPY.introDescription}
          </p>

          {editable ? (
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
              {/*
                Only an **active** plan reaches here — the workspace asks for
                the consultation's live plan, and a completed or withdrawn one
                is not live. That is what frees the consultation for a revised
                plan (section 44), and it is why closing this one returns the
                page to its "start one" state.
              */}
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
        </section>
      </div>
    </PlanShell>
  );
}

function ContextHeader({
  subject,
}: {
  readonly subject: TreatmentPlanSubject;
}) {
  return (
    <ClinicalContextHeader
      heading={TREATMENT_PLAN_BUILDER_COPY.patientHeading}
      fullName={subject.fullName}
      preferredName={subject.preferredName}
      dateOfBirth={subject.dateOfBirth}
      appointmentHeading={TREATMENT_PLAN_BUILDER_COPY.appointmentHeading}
      appointmentStartsAt={subject.appointmentStartsAt}
      appointmentTypeName={subject.appointmentTypeName}
      hint={TREATMENT_PLAN_BUILDER_COPY.identityHint}
      labels={{
        dateOfBirth: TREATMENT_PLAN_BUILDER_COPY.dateOfBirthLabel,
        age: TREATMENT_PLAN_BUILDER_COPY.ageLabel,
        phone: TREATMENT_PLAN_BUILDER_COPY.phoneLabel,
        when: TREATMENT_PLAN_BUILDER_COPY.whenLabel,
        type: TREATMENT_PLAN_BUILDER_COPY.typeLabel,
      }}
    />
  );
}

function PlanShell({
  appointmentId,
  children,
}: {
  readonly appointmentId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Section aria-labelledby="plan-heading">
      <Container width="content">
        <Link
          href={`/doctor/appointments/${appointmentId}/consultation`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {TREATMENT_PLAN_BUILDER_COPY.backLabel}
        </Link>
        <h1 id="plan-heading" className="text-h2 text-heading mt-2 font-normal">
          {TREATMENT_PLAN_BUILDER_COPY.heading}
        </h1>
        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
