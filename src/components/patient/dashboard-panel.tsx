import type { ReactNode } from "react";

/**
 * One section of the patient dashboard.
 *
 * ## Why this exists rather than five hand-written `<section>`s
 *
 * Five sections written by hand drift apart within a phase: one gets a heading
 * level wrong, one forgets `aria-labelledby`, one spaces its heading
 * differently. This defines the shape once — a real `<section>`, a real
 * heading, a named landmark — so the dashboard has one rhythm and an added
 * panel inherits it (`AGENTS.md` section 32).
 *
 * ## The heading level is `h2`, always
 *
 * The page owns the single `h1`. Every panel is a sibling beneath it, so every
 * panel heading is an `h2` and the outline has no gaps — which is what a
 * screen-reader user navigating by heading actually relies on. It is not a
 * prop, because a prop is a thing a caller can get wrong.
 *
 * ## The optional action
 *
 * A "view all" link sits on the heading row rather than at the foot of the
 * list, so it is in the same place on every panel and is reachable without
 * scrolling past the content. It wraps beneath the heading on a narrow screen
 * instead of squeezing the title.
 */
export function DashboardPanel({
  heading,
  headingId,
  description,
  action,
  children,
}: {
  readonly heading: string;
  readonly headingId: string;
  readonly description?: string;
  /** Usually a quiet link onward. Optional. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id={headingId}
            className="text-h5 text-heading font-sans font-medium"
          >
            {heading}
          </h2>
          {description ? (
            <p className="text-body-sm text-muted-foreground measure">
              {description}
            </p>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {children}
    </section>
  );
}
