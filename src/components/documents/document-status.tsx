import { StatusBadge, type BadgeStatus } from "@/components/ui/badge";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
} from "@/features/documents/content";
import type { DocumentStatus, DocumentType } from "@/features/documents/types";

/**
 * A document's status, as icon plus word.
 *
 * Never colour alone (`docs/DESIGN_SYSTEM.md` section 5 and WCAG 1.4.1):
 * each status maps onto one of the design system's presets, which binds a
 * tone *and* an icon *and* a default label together, and the label is
 * overridden only where the clinic's word differs from the preset's.
 *
 * `active` reads as "Available" rather than "Active", because a patient
 * looking at their own record is asking whether they can open it, not what
 * state a row is in.
 */
const STATUS_PRESENTATION: Readonly<Record<DocumentStatus, BadgeStatus>> = {
  active: "confirmed",
  archived: "draft",
};

export function DocumentStatusBadge({
  status,
}: {
  readonly status: DocumentStatus;
}) {
  return (
    <StatusBadge
      status={STATUS_PRESENTATION[status]}
      label={DOCUMENT_STATUS_LABELS[status]}
    />
  );
}

/**
 * The document's category, as plain text.
 *
 * Deliberately **not** a badge. A list row already carries one badge for the
 * status, and a second coloured pill beside it would turn a calm list into a
 * dashboard — `docs/DESIGN_SYSTEM.md` section 2.1, and `phase_14.md` section
 * 71's "avoid a generic SaaS file-manager appearance".
 */
export function DocumentTypeLabel({ type }: { readonly type: DocumentType }) {
  return <>{DOCUMENT_TYPE_LABELS[type]}</>;
}
