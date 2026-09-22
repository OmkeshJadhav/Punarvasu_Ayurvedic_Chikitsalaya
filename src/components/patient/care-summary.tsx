import Link from "next/link";
import { FileText, Leaf, Pill } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { formatClinicDateShort } from "@/features/appointments/time";
import { PATIENT_DASHBOARD } from "@/features/patients/content";
import type { PrescriptionListResult } from "@/features/prescriptions/types";
import type { TreatmentPlanListResult } from "@/features/treatment-plans/types";

/**
 * "Your care" — the three things the practitioner has shared with the patient.
 *
 * ## The clinical boundary, stated on the page
 *
 * `phase_18.md` sections 4 and 107. What a patient sees here is the set of
 * things written *for them*: an issued prescription, an activated treatment
 * plan, a document on their record. What they do not see is the consultation
 * note, the assessment, the diagnosis, the clinician's reasoning or anything
 * an AI produced — and none of that is filtered out here, because none of it
 * is reachable: `clinical_records` has **no patient policy at all**, so there
 * is no row for this component to have to be careful about.
 *
 * The panel says so in a sentence rather than leaving the patient to wonder
 * why their notes are not here. An absence nobody explains reads as something
 * missing.
 *
 * ## Why this shows a count and a date, not the contents
 *
 * A dashboard is read at a glance and over shoulders. "Issued 12 Sep" and a
 * way in is everything a patient needs to decide whether to open it; the
 * medicine names live on the prescription, behind one more deliberate tap.
 * That is section 39's minimisation applied to a screen rather than to a
 * message, and it is why the queries behind this ask for one row each.
 *
 * ## Three states per tile
 *
 * Something, nothing, or unreadable — and the third is distinguished, because
 * "no prescriptions yet" is a clinically meaningful claim and must not be made
 * on the strength of a failed query (section 72).
 */
export function CareSummary({
  prescriptions,
  treatmentPlans,
}: {
  readonly prescriptions: PrescriptionListResult;
  readonly treatmentPlans: TreatmentPlanListResult;
}) {
  const copy = PATIENT_DASHBOARD.care;

  const latestPrescription =
    prescriptions.status === "found" ? prescriptions.prescriptions[0] : null;
  const latestPlan =
    treatmentPlans.status === "found" ? treatmentPlans.plans[0] : null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <CareTile
        icon={<Pill />}
        label={copy.prescriptionsLabel}
        href="/patient/prescriptions"
        detail={
          prescriptions.status === "unavailable"
            ? { kind: "error", text: copy.errorBody }
            : latestPrescription
              ? {
                  kind: "value",
                  text: latestPrescription.issuedAt
                    ? copy.issuedOn(
                        formatClinicDateShort(latestPrescription.issuedAt),
                      )
                    : copy.prescriptionsEmpty,
                }
              : { kind: "empty", text: copy.prescriptionsEmpty }
        }
      />

      <CareTile
        icon={<Leaf />}
        label={copy.treatmentPlansLabel}
        href="/patient/treatment-plans"
        detail={
          treatmentPlans.status === "unavailable"
            ? { kind: "error", text: copy.errorBody }
            : latestPlan
              ? {
                  kind: "value",
                  text: latestPlan.activatedAt
                    ? copy.startedOn(
                        formatClinicDateShort(latestPlan.activatedAt),
                      )
                    : copy.treatmentPlansEmpty,
                }
              : { kind: "empty", text: copy.treatmentPlansEmpty }
        }
      />

      {/*
        Documents is a destination rather than a summary. Counting them would
        mean a third query for a number nobody acts on; what a patient wants
        from this tile is the way in — most often to upload a report they have
        just been handed.
      */}
      <CareTile
        icon={<FileText />}
        label={copy.documentsLabel}
        href="/patient/documents"
        detail={{ kind: "empty", text: copy.documentsDescription }}
      />
    </ul>
  );
}

function CareTile({
  icon,
  label,
  href,
  detail,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly href: string;
  readonly detail: {
    readonly kind: "value" | "empty" | "error";
    readonly text: string;
  };
}) {
  return (
    <li>
      <Card asChild variant="interactive">
        <article className="h-full">
          <CardContent className="flex items-start gap-3">
            <span
              aria-hidden
              className="text-primary bg-accent mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4"
            >
              {icon}
            </span>

            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-body text-heading font-sans font-medium">
                <Link
                  href={href}
                  className="after:absolute after:inset-0 focus-visible:outline-none"
                >
                  {label}
                </Link>
              </h3>
              <p
                className={
                  detail.kind === "value"
                    ? "text-body-sm text-prose"
                    : "text-body-sm text-muted-foreground"
                }
              >
                {detail.text}
              </p>
            </div>
          </CardContent>
        </article>
      </Card>
    </li>
  );
}
