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
import { CLINICAL_HISTORY_COPY } from "@/features/clinical/content";
import type { ClinicalHistoryEntry } from "@/features/clinical/types";

import { ClinicalRecordStatusBadge } from "./clinical-record-status";

/**
 * A patient's clinical history, as this practitioner can see it.
 *
 * ## No clinical content in the list
 *
 * Four columns — when, what kind of consultation, whether the notes are
 * finished, and a way in. **No chief complaint, no assessment, no diagnosis.**
 *
 * That is section 26 applied within the doctor's own screens: a list is read
 * at a glance, often with somebody else in the room, and a chief complaint in
 * a scrollable table is clinical content on screen that nobody chose to open.
 * The query does not fetch it either, so this is a property of the data that
 * arrives rather than a filter at render time.
 *
 * ## Two layouts, one data set
 *
 * Cards below `md`, a real table from `md` up — the convention Phases 10 and
 * 11 established (`docs/DESIGN_SYSTEM.md` section 32). Not one table squeezed.
 *
 * ## Why the caption names the ordering
 *
 * `TableScroller` is a labelled `region` landmark, and so is the `<section>`
 * whose heading sits above it. Two landmarks of the same role with the same
 * accessible name is an axe `landmark-unique` violation — found by Phase 11's
 * browser pass on five pages. Saying "…, most recent first" makes the names
 * distinct *and* tells a screen-reader user something the sighted reader gets
 * from the column order for free.
 */
export function ClinicalHistory({
  entries,
  patientId,
}: {
  readonly entries: readonly ClinicalHistoryEntry[];
  readonly patientId: string;
}) {
  return (
    <>
      {/* Mobile and small tablet */}
      <ul className="flex flex-col gap-3 md:hidden">
        {entries.map((entry) => (
          <li key={entry.id}>
            <article className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-h5 text-heading font-sans font-medium">
                    <time dateTime={entry.occurredAt.toISOString()}>
                      {formatClinicDate(entry.occurredAt)}
                    </time>
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-1 wrap-break-word">
                    {entry.appointmentTypeName}
                  </p>
                </div>
                <ClinicalRecordStatusBadge status={entry.status} />
              </div>

              <div>
                <OpenLink entry={entry} patientId={patientId} />
              </div>
            </article>
          </li>
        ))}
      </ul>

      {/* Desktop */}
      <div className="hidden md:block">
        <TableScroller label={CLINICAL_HISTORY_COPY.caption}>
          <Table>
            <TableCaption className="sr-only">
              {CLINICAL_HISTORY_COPY.caption}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{CLINICAL_HISTORY_COPY.dateHeading}</TableHead>
                <TableHead>{CLINICAL_HISTORY_COPY.typeHeading}</TableHead>
                <TableHead>{CLINICAL_HISTORY_COPY.statusHeading}</TableHead>
                <TableHead>
                  <span className="sr-only">
                    {CLINICAL_HISTORY_COPY.actionsHeading}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={entry.occurredAt.toISOString()}>
                      {formatClinicDateShort(entry.occurredAt)}
                    </time>
                  </TableCell>
                  <TableCell>{entry.appointmentTypeName}</TableCell>
                  <TableCell>
                    <ClinicalRecordStatusBadge status={entry.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <OpenLink entry={entry} patientId={patientId} />
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

/**
 * The way into one record.
 *
 * The accessible name comes from `aria-label` rather than from a visually
 * hidden span, because "Open" is identical on every row and a screen-reader
 * user tabbing the list would hear it repeated with nothing to tell them
 * apart. It names the **date**, not the patient — the patient is already the
 * page — and never anything clinical.
 *
 * `aria-label` rather than an `sr-only` span for the reason Phase 09
 * recorded: accessible-name computation trims each text node before
 * concatenating, which produced "Openfor Tuesday…".
 */
function OpenLink({
  entry,
  patientId,
}: {
  readonly entry: ClinicalHistoryEntry;
  readonly patientId: string;
}) {
  return (
    <Link
      href={`/doctor/patients/${patientId}/records/${entry.id}`}
      aria-label={`${CLINICAL_HISTORY_COPY.viewLabel} — ${formatClinicDate(entry.occurredAt)}`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {CLINICAL_HISTORY_COPY.viewLabel}
    </Link>
  );
}
