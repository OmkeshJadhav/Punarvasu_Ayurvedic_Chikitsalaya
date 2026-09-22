import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status";
import { TreatmentPlanSections } from "@/components/treatment-plans/treatment-plan-summary";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatClinicDate } from "@/features/appointments/time";
import { formatDateOfBirth } from "@/features/patients/format";
import {
  PATIENT_TREATMENT_PLAN_COPY,
  TREATMENT_PLAN_AREA,
} from "@/features/treatment-plans/content";
import {
  getPatientTreatmentPlan,
  getPlanPractitionerDisplayName,
} from "@/features/treatment-plans/queries";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * A patient's own treatment plan, in full.
 *
 * Grouped by section — Diet, Lifestyle, Therapy, Follow-up, Other — because
 * that is how somebody at home finds the part they need.
 *
 * The follow-up date is explicitly **not an appointment**, and the page says
 * so: `phase_13.md` section 47 forbids a plan booking anything, and a patient
 * who believed a date on this page was a booking would miss their visit.
 */
export const metadata: Metadata = {
  title: TREATMENT_PLAN_AREA.patientDetail.title,
  robots: { index: false, follow: false },
};

export default async function PatientTreatmentPlanPage({
  params,
}: PageProps<"/patient/treatment-plans/[id]">) {
  await requirePermission("treatment_plans.read.self", "/patient");

  const { id } = await params;
  const result = await getPatientTreatmentPlan(id);

  if (result.status === "unavailable") {
    return (
      <DetailShell>
        <ErrorState
          title={PATIENT_TREATMENT_PLAN_COPY.errorTitle}
          description={PATIENT_TREATMENT_PLAN_COPY.errorDescription}
          action={
            <Button asChild variant="secondary">
              <Link href={`/patient/treatment-plans/${id}`}>
                {PATIENT_TREATMENT_PLAN_COPY.errorRetryLabel}
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
          title={PATIENT_TREATMENT_PLAN_COPY.notFoundTitle}
          description={PATIENT_TREATMENT_PLAN_COPY.notFoundDescription}
          action={
            <Button asChild>
              <Link href="/patient/treatment-plans">
                {PATIENT_TREATMENT_PLAN_COPY.notFoundAction}
              </Link>
            </Button>
          }
        />
      </DetailShell>
    );
  }

  const { plan } = result;
  const practitionerName = await getPlanPractitionerDisplayName(
    plan.practitionerId,
  );

  return (
    <DetailShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <TreatmentPlanStatusBadge status={plan.status} />
        </div>

        {plan.status === "cancelled" ? (
          <Alert
            tone="warning"
            title={PATIENT_TREATMENT_PLAN_COPY.withdrawnNotice.title}
          >
            {PATIENT_TREATMENT_PLAN_COPY.withdrawnNotice.body}
          </Alert>
        ) : plan.status === "completed" ? (
          <Alert
            tone="info"
            title={PATIENT_TREATMENT_PLAN_COPY.completedNotice.title}
          >
            {PATIENT_TREATMENT_PLAN_COPY.completedNotice.body}
          </Alert>
        ) : null}

        <h2 className="text-h3 text-heading font-normal wrap-break-word">
          {plan.title.trim() || PATIENT_TREATMENT_PLAN_COPY.untitled}
        </h2>

        {plan.summary.trim() ? (
          <p className="text-body text-foreground measure font-sans [overflow-wrap:anywhere] whitespace-pre-wrap">
            {plan.summary.trim()}
          </p>
        ) : null}

        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {plan.activatedAt ? (
            <Fact
              label={PATIENT_TREATMENT_PLAN_COPY.givenOnLabel}
              value={formatClinicDate(plan.activatedAt)}
            />
          ) : null}
          {practitionerName ? (
            <Fact
              label={PATIENT_TREATMENT_PLAN_COPY.givenByLabel}
              value={practitionerName}
            />
          ) : null}
          {plan.startDate ? (
            <Fact
              label={PATIENT_TREATMENT_PLAN_COPY.startsLabel}
              value={formatDateOfBirth(plan.startDate)}
            />
          ) : null}
          {plan.followUpOn ? (
            <Fact
              label={PATIENT_TREATMENT_PLAN_COPY.followUpOnLabel}
              value={formatDateOfBirth(plan.followUpOn)}
            />
          ) : null}
        </dl>

        {plan.followUpOn ? (
          <p className="text-body-sm text-muted-foreground measure">
            {PATIENT_TREATMENT_PLAN_COPY.followUpHint}
          </p>
        ) : null}

        <TreatmentPlanSections
          items={plan.items}
          emptyMessage={PATIENT_TREATMENT_PLAN_COPY.emptyDescription}
        />

        <Alert
          tone="info"
          title={PATIENT_TREATMENT_PLAN_COPY.safetyNotice.title}
        >
          {PATIENT_TREATMENT_PLAN_COPY.safetyNotice.body}
        </Alert>
      </div>
    </DetailShell>
  );
}

function Fact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  if (!value) return null;

  return (
    <div className="min-w-0">
      <dt className="text-caption text-muted-foreground font-sans">{label}</dt>
      <dd className="text-body text-foreground font-sans font-medium wrap-break-word">
        {value}
      </dd>
    </div>
  );
}

function DetailShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <Section aria-labelledby="patient-plan-heading">
      <Container width="content">
        <Link
          href="/patient/treatment-plans"
          className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {PATIENT_TREATMENT_PLAN_COPY.backLabel}
        </Link>
        <h1
          id="patient-plan-heading"
          className="text-h2 text-heading mt-2 font-normal"
        >
          {PATIENT_TREATMENT_PLAN_COPY.detailHeading}
        </h1>
        <div className="mt-8">{children}</div>
      </Container>
    </Section>
  );
}
