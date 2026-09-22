import type { Metadata } from "next";
import Link from "next/link";
import { Pill } from "lucide-react";
import { PrescriptionStatusBadge } from "@/components/prescriptions/prescription-status";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
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
import {
  formatClinicDate,
  formatClinicDateShort,
} from "@/features/appointments/time";
import {
  PATIENT_PRESCRIPTION_COPY,
  PRESCRIPTION_AREA,
} from "@/features/prescriptions/content";
import { listPatientPrescriptions } from "@/features/prescriptions/queries";
import type { PrescriptionSummary } from "@/features/prescriptions/types";
import { requirePermission } from "@/lib/authorization/guards";

/**
 * The patient's own prescriptions (`phase_13.md` sections 34, 35 and 39).
 *
 * ## Only what the doctor has issued
 *
 * A draft is invisible here, and not because this query filters it out. The
 * rule lives in `prescriptions_select_patient` as `status <> 'draft'`, so a
 * draft is invisible to this patient at the *database* level — a query added
 * later cannot forget it, and neither can a page. The `.neq` in the query
 * layer is defence in depth on top of that.
 *
 * ## No patient id anywhere
 *
 * `listPatientPrescriptions()` takes none, so there is none to substitute —
 * the same structural choice Phase 07 made for the patient profile.
 *
 * ## The list carries nothing clinical
 *
 * A date, who wrote it, how many items and its status. Not a medicine name,
 * and the query does not fetch one. A list is glanced at; the detail page is
 * where somebody sits down to read.
 */
export const metadata: Metadata = {
  title: PRESCRIPTION_AREA.patientList.title,
  robots: { index: false, follow: false },
};

export default async function PatientPrescriptionsPage() {
  await requirePermission("prescriptions.read.self", "/patient");

  const result = await listPatientPrescriptions();

  return (
    <Section aria-labelledby="patient-prescriptions-heading">
      <Container width="content">
        <h1
          id="patient-prescriptions-heading"
          className="text-h2 text-heading font-normal"
        >
          {PATIENT_PRESCRIPTION_COPY.heading}
        </h1>
        <p className="text-body text-muted-foreground measure mt-2">
          {PATIENT_PRESCRIPTION_COPY.description}
        </p>

        <div className="mt-8 flex flex-col gap-6">
          {result.status === "unavailable" ? (
            <ErrorState
              title={PATIENT_PRESCRIPTION_COPY.errorTitle}
              description={PATIENT_PRESCRIPTION_COPY.errorDescription}
              action={
                <Button asChild variant="secondary">
                  <Link href="/patient/prescriptions">
                    {PATIENT_PRESCRIPTION_COPY.errorRetryLabel}
                  </Link>
                </Button>
              }
            />
          ) : result.prescriptions.length === 0 ? (
            <EmptyState
              icon={<Pill />}
              title={PATIENT_PRESCRIPTION_COPY.emptyTitle}
              description={PATIENT_PRESCRIPTION_COPY.emptyDescription}
            />
          ) : (
            <PrescriptionList prescriptions={result.prescriptions} />
          )}

          <Alert
            tone="info"
            title={PATIENT_PRESCRIPTION_COPY.safetyNotice.title}
          >
            {PATIENT_PRESCRIPTION_COPY.safetyNotice.body}
          </Alert>
        </div>
      </Container>
    </Section>
  );
}

function PrescriptionList({
  prescriptions,
}: {
  readonly prescriptions: readonly PrescriptionSummary[];
}) {
  return (
    <>
      {/* Cards on a phone, a real table from `md`. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {prescriptions.map((prescription) => (
          <li key={prescription.id}>
            <article className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-h5 text-heading font-sans font-medium">
                    <time dateTime={whenOf(prescription).toISOString()}>
                      {formatClinicDate(whenOf(prescription))}
                    </time>
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-1 wrap-break-word">
                    {prescription.practitionerName ?? "—"}
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    {PATIENT_PRESCRIPTION_COPY.itemCount(
                      prescription.itemCount,
                    )}
                  </p>
                </div>
                <PrescriptionStatusBadge status={prescription.status} />
              </div>
              <div>
                <OpenLink prescription={prescription} />
              </div>
            </article>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <TableScroller label={PATIENT_PRESCRIPTION_COPY.listCaption}>
          <Table>
            <TableCaption className="sr-only">
              {PATIENT_PRESCRIPTION_COPY.listCaption}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{PATIENT_PRESCRIPTION_COPY.dateHeading}</TableHead>
                <TableHead>
                  {PATIENT_PRESCRIPTION_COPY.practitionerHeading}
                </TableHead>
                <TableHead>{PATIENT_PRESCRIPTION_COPY.itemsHeading}</TableHead>
                <TableHead>{PATIENT_PRESCRIPTION_COPY.statusHeading}</TableHead>
                <TableHead>
                  <span className="sr-only">
                    {PATIENT_PRESCRIPTION_COPY.viewLabel}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.map((prescription) => (
                <TableRow key={prescription.id}>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={whenOf(prescription).toISOString()}>
                      {formatClinicDateShort(whenOf(prescription))}
                    </time>
                  </TableCell>
                  <TableCell>{prescription.practitionerName ?? "—"}</TableCell>
                  <TableCell>
                    {PATIENT_PRESCRIPTION_COPY.itemCount(
                      prescription.itemCount,
                    )}
                  </TableCell>
                  <TableCell>
                    <PrescriptionStatusBadge status={prescription.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <OpenLink prescription={prescription} />
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

function whenOf(prescription: PrescriptionSummary): Date {
  return prescription.issuedAt ?? prescription.createdAt;
}

function OpenLink({
  prescription,
}: {
  readonly prescription: PrescriptionSummary;
}) {
  return (
    <Link
      href={`/patient/prescriptions/${prescription.id}`}
      aria-label={`${PATIENT_PRESCRIPTION_COPY.viewLabel} — ${formatClinicDate(
        whenOf(prescription),
      )}`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {PATIENT_PRESCRIPTION_COPY.viewLabel}
    </Link>
  );
}
