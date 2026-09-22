import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { TreatmentPlanStatusBadge } from "@/components/treatment-plans/treatment-plan-status";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { formatDateOfBirth } from "@/features/patients/format";
import {
  PATIENT_TREATMENT_PLAN_COPY,
  TREATMENT_PLAN_AREA,
} from "@/features/treatment-plans/content";
import { listPatientTreatmentPlans } from "@/features/treatment-plans/queries";
import type { TreatmentPlanSummary } from "@/features/treatment-plans/types";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * The patient's own treatment plans.
 *
 * Only plans the practitioner has actually given them: a draft is invisible
 * at the database level, through `treatment_plans_select_patient`'s
 * `status <> 'draft'`. The query takes no patient id.
 */
export const metadata: Metadata = {
  title: TREATMENT_PLAN_AREA.patientList.title,
  robots: { index: false, follow: false },
};

export default async function PatientTreatmentPlansPage() {
  await requirePermission("treatment_plans.read.self", "/patient");

  const result = await listPatientTreatmentPlans();

  return (
    <Section aria-labelledby="patient-plans-heading">
      <Container width="content">
        <h1
          id="patient-plans-heading"
          className="text-h2 text-heading font-normal"
        >
          {PATIENT_TREATMENT_PLAN_COPY.heading}
        </h1>
        <p className="text-body text-muted-foreground measure mt-2">
          {PATIENT_TREATMENT_PLAN_COPY.description}
        </p>

        <div className="mt-8 flex flex-col gap-6">
          {result.status === "unavailable" ? (
            <ErrorState
              title={PATIENT_TREATMENT_PLAN_COPY.errorTitle}
              description={PATIENT_TREATMENT_PLAN_COPY.errorDescription}
              action={
                <Button asChild variant="secondary">
                  <Link href="/patient/treatment-plans">
                    {PATIENT_TREATMENT_PLAN_COPY.errorRetryLabel}
                  </Link>
                </Button>
              }
            />
          ) : result.plans.length === 0 ? (
            <EmptyState
              icon={<ClipboardList />}
              title={PATIENT_TREATMENT_PLAN_COPY.emptyTitle}
              description={PATIENT_TREATMENT_PLAN_COPY.emptyDescription}
            />
          ) : (
            <PlanList plans={result.plans} />
          )}

          <Alert
            tone="info"
            title={PATIENT_TREATMENT_PLAN_COPY.safetyNotice.title}
          >
            {PATIENT_TREATMENT_PLAN_COPY.safetyNotice.body}
          </Alert>
        </div>
      </Container>
    </Section>
  );
}

function PlanList({
  plans,
}: {
  readonly plans: readonly TreatmentPlanSummary[];
}) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {plans.map((plan) => (
          <li key={plan.id}>
            <article className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-h5 text-heading font-sans font-medium [overflow-wrap:anywhere]">
                    {plan.title.trim() || PATIENT_TREATMENT_PLAN_COPY.untitled}
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-1 wrap-break-word">
                    {plan.practitionerName ?? "—"}
                  </p>
                </div>
                <TreatmentPlanStatusBadge status={plan.status} />
              </div>
              <div>
                <OpenLink plan={plan} />
              </div>
            </article>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <TableScroller label={PATIENT_TREATMENT_PLAN_COPY.listCaption}>
          <Table>
            <TableCaption className="sr-only">
              {PATIENT_TREATMENT_PLAN_COPY.listCaption}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{PATIENT_TREATMENT_PLAN_COPY.planHeading}</TableHead>
                <TableHead>
                  {PATIENT_TREATMENT_PLAN_COPY.followUpHeading}
                </TableHead>
                <TableHead>
                  {PATIENT_TREATMENT_PLAN_COPY.statusHeading}
                </TableHead>
                <TableHead>
                  <span className="sr-only">
                    {PATIENT_TREATMENT_PLAN_COPY.viewLabel}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    {plan.title.trim() || PATIENT_TREATMENT_PLAN_COPY.untitled}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {plan.followUpOn
                      ? (formatDateOfBirth(plan.followUpOn) ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <TreatmentPlanStatusBadge status={plan.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <OpenLink plan={plan} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroller>
      </div>
    </>
  );
}

function OpenLink({ plan }: { readonly plan: TreatmentPlanSummary }) {
  return (
    <Link
      href={`/patient/treatment-plans/${plan.id}`}
      aria-label={`${PATIENT_TREATMENT_PLAN_COPY.viewLabel} — ${
        plan.title.trim() || PATIENT_TREATMENT_PLAN_COPY.untitled
      }`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {PATIENT_TREATMENT_PLAN_COPY.viewLabel}
    </Link>
  );
}
