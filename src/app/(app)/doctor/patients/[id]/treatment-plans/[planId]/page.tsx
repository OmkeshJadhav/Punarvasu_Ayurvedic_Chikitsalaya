import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import {
  ProfileField,
  ProfileFieldList,
  ProfileSection,
} from "@/components/patient/profile-section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TreatmentPlanActions } from "@/components/treatment-plans/treatment-plan-actions";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status";
import { TreatmentPlanSections } from "@/components/treatment-plans/treatment-plan-summary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatClinicDateTime } from "@/features/appointments/time";
import { formatDateOfBirth } from "@/features/patients/format";
import {
  TREATMENT_PLAN_BUILDER_COPY,
  TREATMENT_PLAN_DETAIL_COPY,
} from "@/features/treatment-plans/content";
import { getTreatmentPlanForDoctor } from "@/features/treatment-plans/queries";
import {
  isTreatmentPlanCancellable,
  isTreatmentPlanEditable,
} from "@/features/treatment-plans/status";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * One historical treatment plan.
 *
 * Read-only by construction, and checked against the patient in the URL — a
 * well-formed plan id belonging to a different patient renders the same "we
 * couldn't find that" as one that does not exist.
 */
export const metadata: Metadata = {
  title: TREATMENT_PLAN_DETAIL_COPY.heading,
  robots: { index: false, follow: false },
};

export default async function DoctorTreatmentPlanPage({
  params,
}: PageProps<"/doctor/patients/[id]/treatment-plans/[planId]">) {
  await requirePermission("treatment_plans.read", "/doctor/patients");

  const { id: patientId, planId } = await params;
  const result = await getTreatmentPlanForDoctor(planId);

  if (result.status === "unavailable") {
    return (
      <DetailShell patientId={patientId}>
        <ErrorState
          title={TREATMENT_PLAN_DETAIL_COPY.loadErrorTitle}
          description={TREATMENT_PLAN_DETAIL_COPY.loadErrorDescription}
          action={
            <Button asChild variant="secondary">
              <Link
                href={`/doctor/patients/${patientId}/treatment-plans/${planId}`}
              >
                {TREATMENT_PLAN_DETAIL_COPY.loadErrorRetryLabel}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  if (result.status === "not_found" || result.plan.patientId !== patientId) {
    return (
      <DetailShell patientId={patientId}>
        <EmptyState
          title={TREATMENT_PLAN_DETAIL_COPY.notFoundTitle}
          description={TREATMENT_PLAN_DETAIL_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/doctor/patients">
                {TREATMENT_PLAN_DETAIL_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  const { plan } = result;
  const stillADraft = isTreatmentPlanEditable(plan.status);

  return (
    <DetailShell patientId={patientId}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <TreatmentPlanStatusBadge status={plan.status} />
        </div>

        {stillADraft ? (
          <>
            <Alert
              tone="warning"
              title={TREATMENT_PLAN_BUILDER_COPY.draftNotice.title}
            >
              {TREATMENT_PLAN_BUILDER_COPY.draftNotice.body}
            </Alert>
            <div>
              <Button asChild>
                <Link
                  href={`/doctor/appointments/${plan.appointmentId}/treatment-plan`}
                >
                  {TREATMENT_PLAN_DETAIL_COPY.continueDraftLabel}
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <Alert
            tone={plan.status === "cancelled" ? "warning" : "success"}
            title={
              plan.status === "cancelled"
                ? TREATMENT_PLAN_BUILDER_COPY.cancelledNotice.title
                : plan.status === "completed"
                  ? TREATMENT_PLAN_BUILDER_COPY.completedNotice.title
                  : TREATMENT_PLAN_BUILDER_COPY.activeNotice.title
            }
          >
            {plan.status === "cancelled"
              ? TREATMENT_PLAN_BUILDER_COPY.cancelledNotice.body
              : plan.status === "completed"
                ? TREATMENT_PLAN_BUILDER_COPY.completedNotice.body
                : TREATMENT_PLAN_BUILDER_COPY.activeNotice.body}
          </Alert>
        )}

        <h2 className="text-h3 text-heading font-normal wrap-break-word">
          {plan.title.trim() || TREATMENT_PLAN_DETAIL_COPY.untitled}
        </h2>

        {plan.summary.trim() ? (
          <p className="text-body text-foreground measure font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
            {plan.summary.trim()}
          </p>
        ) : null}

        <ProfileSection
          id="plan-meta"
          title={TREATMENT_PLAN_DETAIL_COPY.metaHeading}
        >
          <ProfileFieldList>
            <ProfileField
              label={TREATMENT_PLAN_DETAIL_COPY.startedOnLabel}
              value={formatClinicDateTime(plan.createdAt)}
            />
            {plan.activatedAt ? (
              <ProfileField
                label={TREATMENT_PLAN_DETAIL_COPY.givenOnLabel}
                value={formatClinicDateTime(plan.activatedAt)}
              />
            ) : null}
            {plan.completedAt ? (
              <ProfileField
                label={TREATMENT_PLAN_DETAIL_COPY.completedOnLabel}
                value={formatClinicDateTime(plan.completedAt)}
              />
            ) : null}
            {plan.cancelledAt ? (
              <ProfileField
                label={TREATMENT_PLAN_DETAIL_COPY.withdrawnOnLabel}
                value={formatClinicDateTime(plan.cancelledAt)}
              />
            ) : null}
            {plan.startDate ? (
              <ProfileField
                label={TREATMENT_PLAN_DETAIL_COPY.startsLabel}
                value={formatDateOfBirth(plan.startDate)}
              />
            ) : null}
            {plan.followUpOn ? (
              <ProfileField
                label={TREATMENT_PLAN_DETAIL_COPY.followUpOnLabel}
                value={formatDateOfBirth(plan.followUpOn)}
              />
            ) : null}
          </ProfileFieldList>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link
                href={`/doctor/appointments/${plan.appointmentId}/consultation`}
              >
                {TREATMENT_PLAN_DETAIL_COPY.openConsultationLabel}
              </Link>
            </Button>
          </div>

          {isTreatmentPlanCancellable(plan.status) && !stillADraft ? (
            <div className="mt-3">
              <TreatmentPlanActions planId={plan.id} version={plan.version} />
            </div>
          ) : null}
        </ProfileSection>

        <section
          aria-labelledby="plan-instructions"
          className="flex flex-col gap-5"
        >
          <h2
            id="plan-instructions"
            className="text-h4 text-heading font-sans font-medium"
          >
            {TREATMENT_PLAN_DETAIL_COPY.instructionsHeading}
          </h2>
          <TreatmentPlanSections
            items={plan.items}
            emptyMessage={TREATMENT_PLAN_BUILDER_COPY.emptyItemsDescription}
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
    <Section aria-labelledby="plan-detail-heading">
      <Container width="content">
        <Link
          href={`/doctor/patients/${patientId}`}
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {TREATMENT_PLAN_DETAIL_COPY.backLabel}
        </Link>
        <h1
          id="plan-detail-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {TREATMENT_PLAN_DETAIL_COPY.heading}
        </h1>
        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
