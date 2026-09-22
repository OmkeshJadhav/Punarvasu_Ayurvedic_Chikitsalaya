import Link from "next/link";
import {
  DocumentStatusBadge,
  DocumentTypeLabel,
} from "@/components/documents/document-status";
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
import { formatFileSize } from "@/config/documents";
import {
  formatClinicDate,
  formatClinicDateShort,
} from "@/features/appointments/time";
import { PATIENT_DOCUMENT_COPY } from "@/features/documents/content";
import type { PatientDocument } from "@/features/documents/types";

/**
 * A list of documents: cards on a phone, a real table from `md`.
 *
 * Two layouts over one data set rather than one squeezed into a scroller —
 * `docs/DESIGN_SYSTEM.md` section 32, and the shape the schedule and the
 * prescription list already use, so a reader who has seen one has seen all
 * three.
 *
 * ## What a row carries, and what it does not
 *
 * A title, a type, a date, a size and a status. **No preview, no thumbnail
 * and no signed URL** — section 115: opening a 20 MB file to render a list
 * is exactly the thing not to do, and a URL minted for a row nobody clicks
 * is a credential issued for nothing. Access is requested when somebody
 * chooses to open a document, and not before.
 *
 * It also carries nothing about the *contents*. The application does not
 * read a file, so there is nothing it could honestly say (sections 90-92).
 *
 * ## The link is the only interactive element
 *
 * One focusable control per row, with an accessible name that says which
 * document it opens — "Open — Blood test, 12 September 2026" rather than
 * eleven links all called "Open".
 */
export function DocumentList({
  documents,
  hrefFor,
  caption,
}: {
  readonly documents: readonly PatientDocument[];
  readonly hrefFor: (document: PatientDocument) => string;
  readonly caption: string;
}) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {documents.map((document) => (
          <li key={document.id}>
            <article className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-h5 text-heading font-sans font-medium wrap-break-word">
                    {document.title}
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    <DocumentTypeLabel type={document.documentType} />
                  </p>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    <time dateTime={document.createdAt.toISOString()}>
                      {formatClinicDate(document.createdAt)}
                    </time>
                    {" · "}
                    {formatFileSize(document.fileSize)}
                  </p>
                </div>
                <DocumentStatusBadge status={document.status} />
              </div>
              <div>
                <OpenLink document={document} href={hrefFor(document)} />
              </div>
            </article>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <TableScroller label={caption}>
          <Table>
            <TableCaption className="sr-only">{caption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>{PATIENT_DOCUMENT_COPY.titleHeading}</TableHead>
                <TableHead>{PATIENT_DOCUMENT_COPY.typeHeading}</TableHead>
                <TableHead>{PATIENT_DOCUMENT_COPY.dateHeading}</TableHead>
                <TableHead>{PATIENT_DOCUMENT_COPY.sizeHeading}</TableHead>
                <TableHead>{PATIENT_DOCUMENT_COPY.statusHeading}</TableHead>
                <TableHead>
                  <span className="sr-only">
                    {PATIENT_DOCUMENT_COPY.viewLabel}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="wrap-break-word">
                    {document.title}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <DocumentTypeLabel type={document.documentType} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={document.createdAt.toISOString()}>
                      {formatClinicDateShort(document.createdAt)}
                    </time>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatFileSize(document.fileSize)}
                  </TableCell>
                  <TableCell>
                    <DocumentStatusBadge status={document.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <OpenLink document={document} href={hrefFor(document)} />
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
  document,
  href,
}: {
  readonly document: PatientDocument;
  readonly href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${PATIENT_DOCUMENT_COPY.viewLabel} — ${document.title}, ${formatClinicDate(
        document.createdAt,
      )}`}
      className="text-body-sm text-primary focus-visible:outline-ring inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {PATIENT_DOCUMENT_COPY.viewLabel}
    </Link>
  );
}
