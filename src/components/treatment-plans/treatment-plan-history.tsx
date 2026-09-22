import Link from "next/link";
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
import { TREATMENT_PLAN_HISTORY_COPY } from "@/features/treatment-plans/content";
import type { TreatmentPlanSummary } from "@/features/treatment-plans/types";
import { TreatmentPlanStatusBadge } from "./treatment-plan-status";

/**
 * The practitioner's treatment plan list for one patient.
 *
 * A title, a status, a follow-up date and a way in — no instruction text, and
 * the query behind it does not fetch any. Cards below `md` and a real table
 * above; the caption names the ordering so it cannot equal the heading above
 * it.
 *
 * `formatDateOfBirth` is reused for the follow-up date because it is the
 * project's timezone-safe ISO-calendar-date formatter: a plan's follow-up day
 * is a day, not an instant, and rendering it through a `Date` would move it
 * across a timezone boundary.
 */
export function TreatmentPlanHistory({
  plans,
  patientId,
}: {
  readonly plans: readonly TreatmentPlanSummary[];
  readonly patientId: string;
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
                    {plan.title.trim() || TREATMENT_PLAN_HISTORY_COPY.untitled}
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    {TREATMENT_PLAN_HISTORY_COPY.itemCount(plan.itemCount)}
                  </p>
                </div>
                <TreatmentPlanStatusBadge status={plan.status} />
              </div>
              <div>
                <OpenLink plan={plan} patientId={patientId} />
              </div>
            </article>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <TableScroller label={TREATMENT_PLAN_HISTORY_COPY.caption}>
          <Table>
            <TableCaption className="sr-only">
              {TREATMENT_PLAN_HISTORY_COPY.caption}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {TREATMENT_PLAN_HISTORY_COPY.titleHeading}
                </TableHead>
                <TableHead>
                  {TREATMENT_PLAN_HISTORY_COPY.followUpHeading}
                </TableHead>
                <TableHead>
                  {TREATMENT_PLAN_HISTORY_COPY.statusHeading}
                </TableHead>
                <TableHead>
                  <span className="sr-only">
                    {TREATMENT_PLAN_HISTORY_COPY.actionsHeading}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    {plan.title.trim() || TREATMENT_PLAN_HISTORY_COPY.untitled}
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
                      <OpenLink plan={plan} patientId={patientId} />
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

function OpenLink({
  plan,
  patientId,
}: {
  readonly plan: TreatmentPlanSummary;
  readonly patientId: string;
}) {
  return (
    <Link
      href={`/doctor/patients/${patientId}/treatment-plans/${plan.id}`}
      aria-label={`${TREATMENT_PLAN_HISTORY_COPY.viewLabel} — ${
        plan.title.trim() || TREATMENT_PLAN_HISTORY_COPY.untitled
      }`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {TREATMENT_PLAN_HISTORY_COPY.viewLabel}
    </Link>
  );
}
