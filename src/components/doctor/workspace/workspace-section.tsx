import type { ReactNode } from "react";

import { SkeletonText } from "@/components/ui/skeleton";
import { DOCTOR_WORKSPACE_COPY } from "@/features/doctor/content";

/**
 * One section of the appointment workspace.
 *
 * A named `region`: the heading labels it, so a screen-reader user can move
 * between notes, prescription and plan by landmark. Every section title is
 * distinct, which keeps axe's `landmark-unique` satisfied — the defect Phase
 * 11 found on three doctor pages.
 *
 * The scroll margin clears the sticky jump bar (about 61px), so a jump link
 * lands with the heading visible rather than under it.
 */
export function WorkspaceSection({
  id,
  title,
  status,
  description,
  children,
}: {
  readonly id: string;
  readonly title: string;
  /** A status badge, shown beside the heading. */
  readonly status?: ReactNode;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="border-border flex scroll-mt-20 flex-col gap-6 border-t pt-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-h3 text-heading font-normal">
          {title}
        </h2>
        {status}
      </div>

      {description ? (
        <p className="text-body-sm text-muted-foreground measure -mt-2">
          {description}
        </p>
      ) : null}

      {children}
    </section>
  );
}

/**
 * What a section shows while its data streams in.
 *
 * Rendered with the same id and heading as the loaded section, so a jump link
 * followed before the data arrives still lands in the right place.
 */
export function WorkspaceSectionFallback({
  id,
  title,
}: {
  readonly id: string;
  readonly title: string;
}) {
  return (
    <WorkspaceSection id={id} title={title}>
      <div role="status" aria-busy="true">
        <span className="sr-only">
          {DOCTOR_WORKSPACE_COPY.sectionLoadingLabel(title)}
        </span>
        <SkeletonText lines={4} aria-hidden="true" />
      </div>
    </WorkspaceSection>
  );
}

/**
 * A section that cannot be used until an earlier step is done.
 *
 * A sentence and a way to the missing step, rather than an empty-state
 * illustration: the practitioner is mid-consultation, and the fix is usually
 * one section up.
 */
export function WaitingNotice({
  children,
  action,
}: {
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <div className="border-border flex flex-col items-start gap-3 rounded-lg border border-dashed px-5 py-6">
      <p className="text-body-sm text-muted-foreground measure">{children}</p>
      {action}
    </div>
  );
}
