import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * One panel of the clinic dashboard.
 *
 * ## Depth from spacing first
 *
 * A 1px border, the card surface against the cream page and the faintest
 * shadow — the redesign's rule is that hierarchy comes from type and space
 * before it comes from elevation. The hover lift is the only motion, and it
 * is a shadow change rather than a transform so nothing on the page moves
 * while somebody is reading a number.
 *
 * ## It is a landmark-free `<section>` with a real heading
 *
 * Each card is `aria-labelledby` its own `<h2>`, so the dashboard's outline
 * reads as the list of questions it answers, and a screen-reader user can
 * jump between panels by heading exactly as a sighted user scans cards.
 */
export function DashboardCard({
  titleId,
  title,
  description,
  action,
  children,
  className,
}: {
  readonly titleId: string;
  readonly title: string;
  readonly description?: string;
  /** Top-right content: a total, a link. Never the only route to anything. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "border-border bg-card flex min-w-0 flex-col rounded-lg border p-5 shadow-sm sm:p-6",
        MOTION_MICRO,
        "hover:shadow-md",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-h5 text-heading font-serif">
            {title}
          </h2>
          {description ? (
            <p className="text-body-sm text-muted-foreground measure mt-1 font-sans">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className="mt-5 flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/** The quiet "See all →" link a card header carries. */
export function DashboardCardLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-body-sm text-primary inline-flex min-h-11 items-center gap-1.5 rounded-sm font-sans font-medium",
        MOTION_MICRO,
        "hover:text-primary-hover underline-offset-4 hover:underline",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        "[&_svg]:transition-transform [&_svg]:duration-(--duration-fast) hover:[&_svg]:translate-x-0.5",
      )}
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

/**
 * A small circle with a person's initials.
 *
 * Decorative (`aria-hidden`): the name beside it is always printed. Used for
 * practitioners in the workload panels and for patients in the clinic
 * registers — never as the only place a name appears.
 */
export function InitialsAvatar({ name }: { readonly name: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-accent text-accent-foreground border-primary/15 inline-flex size-9 shrink-0 items-center justify-center rounded-full border font-sans text-[0.8125rem] font-semibold tracking-wide"
    >
      {initialsOf(name)}
    </span>
  );
}

/** "Dr. Meera Sharma" → "MS". Honorifics are dropped; they are not a name. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/^(dr|vd|vaidya|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);

  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";

  return `${first}${last}`.toUpperCase() || "·";
}
