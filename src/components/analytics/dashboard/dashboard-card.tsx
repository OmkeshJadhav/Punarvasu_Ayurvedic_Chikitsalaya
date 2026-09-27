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
 * A hairline border at low contrast, the white card against the cream page
 * and the faintest shadow — tonal separation rather than outlines. The rule
 * is that hierarchy comes from type and space before it comes from
 * elevation. The hover lift is the only motion, and it
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
  icon,
  action,
  children,
  className,
}: {
  readonly titleId: string;
  readonly title: string;
  readonly description?: string;
  /** A leading icon in a soft tile. Decorative: the title names the card. */
  readonly icon?: ReactNode;
  /** Top-right content: a total, a link. Never the only route to anything. */
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "border-border/60 bg-card flex min-w-0 scroll-mt-6 flex-col rounded-lg border p-5 shadow-sm sm:p-6",
        MOTION_MICRO,
        "hover:shadow-md",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3.5">
          {icon ? <CardIcon>{icon}</CardIcon> : null}
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
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className="mt-6 flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/** The quiet "See all →" link a card header carries. */
export function DashboardCardLink({
  href,
  children,
  block = false,
}: {
  readonly href: string;
  readonly children: ReactNode;
  /** A full-width soft button closing a card, rather than an inline link. */
  readonly block?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-body-sm text-primary inline-flex min-h-11 items-center gap-1.5 rounded-sm font-sans font-medium",
        MOTION_MICRO,
        block
          ? "bg-muted/70 text-heading hover:bg-accent w-full justify-center rounded-md"
          : "hover:text-primary-hover underline-offset-4 hover:underline",
        "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        "[&_svg]:transition-transform [&_svg]:duration-(--duration-fast) hover:[&_svg]:translate-x-0.5",
      )}
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

/** The soft square tile a card title or a figure leads with. */
export function CardIcon({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-md [&_svg]:size-5",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A small circle with a person's initials.
 *
 * Decorative (`aria-hidden`): the name beside it is always printed. Used for
 * practitioners in the workload panels and for patients in the clinic
 * registers — never as the only place a name appears.
 */
export function InitialsAvatar({
  name,
  className,
}: {
  readonly name: string;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-accent text-accent-foreground border-primary/15 inline-flex size-9 shrink-0 items-center justify-center rounded-full border font-sans text-[0.8125rem] font-semibold tracking-wide",
        className,
      )}
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
