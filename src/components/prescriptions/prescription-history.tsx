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
import {
  formatClinicDate,
  formatClinicDateShort,
} from "@/features/appointments/time";
import { PRESCRIPTION_HISTORY_COPY } from "@/features/prescriptions/content";
import type { PrescriptionSummary } from "@/features/prescriptions/types";
import { PrescriptionStatusBadge } from "./prescription-status";

/**
 * The practitioner's prescription list for one patient (section 38).
 *
 * **No clinical content.** A date, a count, a status and a way in — and the
 * query behind it does not fetch a medicine name either. A list is read at a
 * glance, often with somebody else in the room, and the count is enough to
 * decide whether to open it.
 *
 * Cards below `md` and a real table above, for the reason every list in this
 * project has: eleven columns of prescribing detail do not fit across a
 * phone, and a horizontally scrolling table is not a thing anybody wants to
 * read a prescription through.
 *
 * The caption names the ordering as well as the contents, so it cannot equal
 * the heading above it — the `landmark-unique` collision Phase 11 found with
 * a real browser and jsdom could not see.
 */
export function PrescriptionHistory({
  prescriptions,
  patientId,
}: {
  readonly prescriptions: readonly PrescriptionSummary[];
  readonly patientId: string;
}) {
  return (
    <>
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
                  <p className="text-body-sm text-muted-foreground mt-1">
                    {PRESCRIPTION_HISTORY_COPY.itemCount(
                      prescription.itemCount,
                    )}
                  </p>
                </div>
                <PrescriptionStatusBadge status={prescription.status} />
              </div>
              <div>
                <OpenLink prescription={prescription} patientId={patientId} />
              </div>
            </article>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <TableScroller label={PRESCRIPTION_HISTORY_COPY.caption}>
          <Table>
            <TableCaption className="sr-only">
              {PRESCRIPTION_HISTORY_COPY.caption}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{PRESCRIPTION_HISTORY_COPY.dateHeading}</TableHead>
                <TableHead>{PRESCRIPTION_HISTORY_COPY.itemsHeading}</TableHead>
                <TableHead>{PRESCRIPTION_HISTORY_COPY.statusHeading}</TableHead>
                <TableHead>
                  <span className="sr-only">
                    {PRESCRIPTION_HISTORY_COPY.actionsHeading}
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
                  <TableCell>
                    {PRESCRIPTION_HISTORY_COPY.itemCount(
                      prescription.itemCount,
                    )}
                  </TableCell>
                  <TableCell>
                    <PrescriptionStatusBadge status={prescription.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <OpenLink
                        prescription={prescription}
                        patientId={patientId}
                      />
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

/** When it was issued, or when it was started if it never was. */
function whenOf(prescription: PrescriptionSummary): Date {
  return prescription.issuedAt ?? prescription.createdAt;
}

function OpenLink({
  prescription,
  patientId,
}: {
  readonly prescription: PrescriptionSummary;
  readonly patientId: string;
}) {
  return (
    <Link
      href={`/doctor/patients/${patientId}/prescriptions/${prescription.id}`}
      aria-label={`${PRESCRIPTION_HISTORY_COPY.viewLabel} — ${formatClinicDate(
        whenOf(prescription),
      )}`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {PRESCRIPTION_HISTORY_COPY.viewLabel}
    </Link>
  );
}
