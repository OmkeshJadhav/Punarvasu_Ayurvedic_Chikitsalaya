import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APPOINTMENT_REPORT } from "@/config/analytics";
import { EXPORT_COPY } from "@/features/analytics/content";
import { formatRangeLabel } from "@/features/analytics/format";
import type { AnalyticsRange } from "@/features/analytics/types";

export const APPOINTMENT_REPORT_ENDPOINT = "/api/reports/appointments";

/**
 * Downloading the appointment operations report.
 *
 * ## A POST, and a server component
 *
 * `phase_16.md` section 47 forbids a public download URL, and section 114
 * requires server-side generation. Both are satisfied by the route this form
 * posts to, which authenticates, checks `reports.export`, and is refused
 * again by the database — there is no object storage involved and no URL that
 * works without a session.
 *
 * It is a **POST** rather than a link for a reason beyond that: a `GET`
 * download URL is prefetchable, bookmarkable and shareable, and a report of
 * clinic operations that somebody can paste into a chat is a worse artefact
 * than one that requires a deliberate action. It is also a real `<form>` with
 * no event handler, so the download works before hydration and without
 * JavaScript at all.
 *
 * ## The period travels with the request
 *
 * Section 45 and example 4: the export covers the period and practitioner the
 * reader is looking at, not "everything". The two dates are hidden inputs
 * carrying the *resolved* range — the same values the figures above were read
 * with — so the file and the screen agree (section 94). The route revalidates
 * them and the database bounds them again.
 *
 * ## The columns are stated before the download
 *
 * Section 92 asks for a report's export fields to be documented.
 * `APPOINTMENT_REPORT.columns` is the contract the CSV writer reads, and
 * printing it here means an administrator knows what is in the file before
 * they create it — which matters most for what is *not* in it.
 */
export function AppointmentReportExport({
  range,
  practitionerId,
}: {
  readonly range: AnalyticsRange;
  readonly practitionerId: string | undefined;
}) {
  return (
    <form
      method="post"
      action={APPOINTMENT_REPORT_ENDPOINT}
      className="border-border flex flex-col gap-4 rounded-lg border p-4"
    >
      <p className="text-body-sm text-prose measure font-sans">
        {EXPORT_COPY.description}
      </p>

      <input type="hidden" name="from" value={range.from} />
      <input type="hidden" name="to" value={range.to} />
      {practitionerId ? (
        <input type="hidden" name="practitionerId" value={practitionerId} />
      ) : null}

      <div>
        <p className="text-caption text-muted-foreground font-sans tracking-wide uppercase">
          {EXPORT_COPY.columnsLabel}
        </p>
        <p className="text-body-sm text-foreground mt-1 font-sans">
          {APPOINTMENT_REPORT.columns
            .map((column) => column.header)
            .join(" · ")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" variant="secondary">
          <Download aria-hidden="true" className="size-4" />
          {EXPORT_COPY.submitLabel}
        </Button>
        <span className="text-caption text-muted-foreground font-sans">
          {formatRangeLabel(range.from, range.to)}
          {". "}
          {EXPORT_COPY.auditNote}
        </span>
      </div>
    </form>
  );
}
