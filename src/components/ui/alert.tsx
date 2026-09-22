import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, Info, TriangleAlert, Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * An inline message attached to a region of the page.
 *
 * Use for information that must stay put: a validation summary, a medical
 * disclaimer, a notice that a clinic is closed. For transient confirmation of
 * an action, use a toast instead.
 *
 * Each tone has an icon as well as a colour. `danger` and `warning` render as
 * `role="alert"` so they are announced when they appear mid-interaction;
 * `info` and `success` are `role="status"` and wait for a pause.
 */
const alertVariants = cva(
  "flex w-full items-start gap-3 rounded-md border p-4",
  {
    variants: {
      tone: {
        info: "border-info-border bg-info-surface text-foreground",
        success: "border-success-border bg-success-surface text-foreground",
        warning: "border-warning-border bg-warning-surface text-foreground",
        danger:
          "border-destructive-border bg-destructive-surface text-foreground",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

const TONE_ICONS = {
  info: { Icon: Info, className: "text-info" },
  success: { Icon: Check, className: "text-success" },
  warning: { Icon: TriangleAlert, className: "text-warning" },
  danger: { Icon: CircleAlert, className: "text-destructive" },
} as const;

export interface AlertProps
  extends
    Omit<ComponentProps<"div">, "title">,
    VariantProps<typeof alertVariants> {
  readonly title?: ReactNode;
}

export function Alert({
  className,
  tone = "info",
  title,
  children,
  ...props
}: AlertProps) {
  const { Icon, className: iconClassName } = TONE_ICONS[tone ?? "info"];
  const isUrgent = tone === "danger" || tone === "warning";

  return (
    <div
      role={isUrgent ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-5 shrink-0", iconClassName)}
      />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? (
          <p className="text-label text-foreground font-medium">{title}</p>
        ) : null}
        {children ? (
          <div className="text-body-sm text-muted-foreground">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

export { alertVariants };
