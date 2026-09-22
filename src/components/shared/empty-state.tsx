import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * An empty state.
 *
 * Answers three questions in order: what is empty, why it might be, and what
 * the user can do next.
 *
 * ```tsx
 * <EmptyState
 *   icon={<CalendarDays />}
 *   title="No upcoming appointments"
 *   description="You don't have an appointment scheduled yet."
 *   action={<Button asChild><Link href="/book">Book a Consultation</Link></Button>}
 * />
 * ```
 *
 * "No data." is not an empty state. Neither is a shrug illustration with no
 * way forward.
 *
 * The icon is decorative and modestly sized - an oversized graphic where a
 * patient expected their appointments is decoration in place of an answer.
 */
export interface EmptyStateProps extends Omit<ComponentProps<"div">, "title"> {
  /** A small Lucide icon. Decorative; the title carries the meaning. */
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description: string;
  /** The primary way forward. Almost always worth providing. */
  readonly action?: ReactNode;
  /** A lesser alternative, such as "Contact the clinic". */
  readonly secondaryAction?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-muted/50 flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="text-primary bg-accent flex size-11 items-center justify-center rounded-full [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}

      <p className="text-h5 text-heading font-medium">{title}</p>
      <p className="text-body-sm text-muted-foreground measure">
        {description}
      </p>

      {action || secondaryAction ? (
        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
