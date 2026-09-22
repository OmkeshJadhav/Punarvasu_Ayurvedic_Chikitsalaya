import { Users } from "lucide-react";
import type { ReactNode } from "react";

import { PractitionerCard } from "@/components/marketing/practitioner-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { PRACTITIONERS_PAGE } from "@/features/practitioners/content";
import type { Practitioner } from "@/features/practitioners/types";
import { cn } from "@/lib/utils/cn";

/**
 * The practitioner roster as a grid.
 *
 * Two columns from `sm` and no more. A clinic's roster is small by nature and
 * a three-across row would shrink each portrait to a thumbnail and each
 * biography to a caption - the readability problem
 * `docs/implementation-plan/phase_05.md` section 57 names specifically.
 *
 * There is no search and no filter, deliberately: with a handful of
 * practitioners, narrowing costs the visitor more than it saves, and a filter
 * would hide people behind a control and add a client island to do it
 * (`phase_05.md` section 22).
 *
 * A real `<ul>`, so a screen reader announces how many profiles there are.
 * An empty roster renders an empty state that says what is missing and what
 * to do instead, rather than a blank band.
 *
 * A server component apart from the shared reveal.
 */
export interface PractitionerGridProps {
  readonly practitioners: readonly Practitioner[];
  readonly headingLevel?: "h3" | "h4";
  /** Rendered inside the empty state, typically a way to reach the clinic. */
  readonly emptyAction?: ReactNode;
  readonly className?: string;
}

export function PractitionerGrid({
  practitioners,
  headingLevel = "h3",
  emptyAction,
  className,
}: PractitionerGridProps) {
  if (practitioners.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title={PRACTITIONERS_PAGE.emptyState.title}
        description={PRACTITIONERS_PAGE.emptyState.description}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <ul className={cn("grid gap-6 sm:grid-cols-2 lg:gap-8", className)}>
      {practitioners.map((practitioner, index) => (
        <Reveal key={practitioner.slug} asChild delay={index * 80}>
          <li className="flex">
            <PractitionerCard
              practitioner={practitioner}
              headingLevel={headingLevel}
            />
          </li>
        </Reveal>
      ))}
    </ul>
  );
}
