import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Check,
  CircleDashed,
  CircleSlash,
  Clock,
  Info,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * A status badge.
 *
 * Every badge carries an icon as well as a colour, because status must never
 * be communicated by colour alone - for a colour-blind user, and for anyone
 * printing an appointment confirmation in black and white.
 *
 * Two ways to use it:
 *
 *   `<StatusBadge status="confirmed" />`  - a known domain status. Icon,
 *   colour and label all come from one table, so "Confirmed" looks and reads
 *   identically everywhere in the product.
 *
 *   `<Badge tone="info" icon={<Leaf />}>Seasonal</Badge>` - anything else.
 *
 * Badges are labels, not buttons. If it filters or removes something, it is a
 * button and should look like one.
 */
const badgeVariants = cva(
  cn(
    "inline-flex w-fit items-center gap-1.5 rounded-sm border px-2 py-0.5",
    "text-caption font-medium whitespace-nowrap",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
  ),
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-muted text-muted-foreground",
        primary: "border-primary/25 bg-accent text-accent-foreground",
        success: "border-success-border bg-success-surface text-success",
        warning: "border-warning-border bg-warning-surface text-warning",
        danger:
          "border-destructive-border bg-destructive-surface text-destructive",
        info: "border-info-border bg-info-surface text-info",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  /** Rendered before the label and hidden from assistive tech - the text says it. */
  readonly icon?: ReactNode;
}

export function Badge({
  className,
  tone,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {icon ? (
        <span aria-hidden="true" className="contents">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

/**
 * The statuses the product actually uses, each bound to one tone, one icon and
 * one label. Extend this table rather than styling a status inline, so a
 * status cannot mean two different things on two screens.
 */
const STATUS_PRESETS = {
  confirmed: { tone: "success", label: "Confirmed", Icon: Check },
  completed: { tone: "success", label: "Completed", Icon: Check },
  published: { tone: "success", label: "Published", Icon: Check },
  pending: { tone: "warning", label: "Pending", Icon: Clock },
  scheduled: { tone: "info", label: "Scheduled", Icon: Clock },
  rescheduled: { tone: "info", label: "Rescheduled", Icon: Info },
  cancelled: { tone: "danger", label: "Cancelled", Icon: CircleSlash },
  missed: { tone: "danger", label: "Missed", Icon: TriangleAlert },
  draft: { tone: "neutral", label: "Draft", Icon: CircleDashed },
} as const satisfies Record<
  string,
  {
    tone: NonNullable<VariantProps<typeof badgeVariants>["tone"]>;
    label: string;
    Icon: typeof Check;
  }
>;

export type BadgeStatus = keyof typeof STATUS_PRESETS;

export interface StatusBadgeProps extends Omit<
  ComponentProps<"span">,
  "children"
> {
  readonly status: BadgeStatus;
  /** Overrides the preset label. The tone and icon stay bound to the status. */
  readonly label?: string;
}

export function StatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const preset = STATUS_PRESETS[status];
  const { Icon } = preset;

  return (
    <Badge tone={preset.tone} icon={<Icon />} {...props}>
      {label ?? preset.label}
    </Badge>
  );
}

export { badgeVariants, STATUS_PRESETS };
