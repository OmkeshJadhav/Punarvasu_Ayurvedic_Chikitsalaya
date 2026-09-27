import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { Sparkline } from "@/components/analytics/dashboard/sparkline";
import { DASHBOARD_COPY } from "@/features/analytics/content";
import type { PeriodComparison } from "@/features/analytics/comparison";
import { MOTION_MICRO } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";

/**
 * The four headline figures.
 *
 * ## Four, and only four
 *
 * The earlier dashboard deliberately had no tiles, citing `phase_16.md`
 * sections 11 and 116 on the wall of KPI cards. The redesign keeps the spirit
 * of that by keeping the count small: four questions an administrator asks
 * first — how busy, how much concluded well, how many new people, how many
 * fell through — and everything else stays in the panels below, where it
 * carries its definition.
 *
 * ## What a card says, in reading order
 *
 * Icon (decorative), label, the figure, then one line of comparison. The
 * comparison's direction is carried by the arrow's shape as well as its
 * colour, and by a word ("Up", "Down") for a screen reader, so nothing
 * depends on telling green from red (section 66). The period it is compared
 * with is always spelled out.
 *
 * It is a `<dl>` of `<div>`s, so a screen reader announces each label with
 * its value rather than a grid of loose numbers.
 */

export function KpiGrid({
  labelledBy,
  children,
}: {
  readonly labelledBy: string;
  readonly children: ReactNode;
}) {
  return (
    <dl
      aria-labelledby={labelledBy}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {children}
    </dl>
  );
}

/**
 * A card's tint. Each is a brand surface paired with the mark drawn on it, so
 * the four cards are told apart at a glance without a new colour entering the
 * palette. `clay` is reserved for the exception figure — cancellations — in
 * line with red and orange being kept for what needs attention.
 */
export type KpiTone = "forest" | "sky" | "clay" | "gold";

const TONE_STYLES: Readonly<
  Record<
    KpiTone,
    { readonly surface: string; readonly icon: string; readonly mark: string }
  >
> = {
  forest: {
    surface: "from-accent/70",
    icon: "bg-accent text-primary",
    mark: "text-chart-1",
  },
  sky: {
    surface: "from-info-surface/80",
    icon: "bg-info-surface text-info",
    mark: "text-info",
  },
  clay: {
    surface: "from-destructive-surface/60",
    icon: "bg-destructive-surface text-terracotta",
    mark: "text-terracotta",
  },
  gold: {
    surface: "from-gold-surface/80",
    icon: "bg-gold-surface text-gold",
    mark: "text-gold",
  },
};

export interface KpiCardProps {
  readonly label: string;
  readonly tone?: KpiTone;
  /** Already formatted. `"—"` when the read failed or there is no basis. */
  readonly value: string;
  readonly icon: ReactNode;
  /** `null` when there is no honest comparison to make. */
  readonly comparison: PeriodComparison | null;
  /** "vs. previous 30 days". */
  readonly comparisonBasis: string;
  /** Shown instead of the comparison when the figure itself is unavailable. */
  readonly note?: string;
  /** The figure per trend bucket, for the sparkline. Decorative. */
  readonly trend?: readonly number[];
}

export function KpiCard({
  label,
  tone = "forest",
  value,
  icon,
  comparison,
  comparisonBasis,
  note,
  trend,
}: KpiCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "border-border/60 bg-card flex min-w-0 flex-col rounded-lg border bg-linear-to-br to-transparent to-70% p-5 shadow-sm sm:p-6",
        styles.surface,
        MOTION_MICRO,
        "hover:shadow-md",
      )}
    >
      <dt className="text-label text-foreground flex items-center gap-3 font-sans font-medium">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-md [&_svg]:size-5",
            styles.icon,
          )}
        >
          {icon}
        </span>
        {label}
      </dt>

      <dd className="mt-5 flex min-w-0 flex-col gap-3">
        <span className="flex min-w-0 items-end justify-between gap-3">
          <span className="text-heading block font-serif text-[2.5rem] leading-none font-medium tracking-tight tabular-nums">
            {value}
          </span>
          {trend ? (
            <Sparkline values={trend} className={cn("shrink-0", styles.mark)} />
          ) : null}
        </span>
        <span className="block">
          {note ? (
            <span className="text-caption text-muted-foreground font-sans">
              {note}
            </span>
          ) : (
            <ComparisonLine comparison={comparison} basis={comparisonBasis} />
          )}
        </span>
      </dd>
    </div>
  );
}

const DIRECTION_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
} as const;

const DIRECTION_WORD = {
  up: DASHBOARD_COPY.increase,
  down: DASHBOARD_COPY.decrease,
  flat: DASHBOARD_COPY.unchanged,
} as const;

const TONE_CLASS = {
  positive: "text-success",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
} as const;

/** "↗ Up 12.5% vs. previous 30 days", or why there is no comparison. */
export function ComparisonLine({
  comparison,
  basis,
}: {
  readonly comparison: PeriodComparison | null;
  readonly basis: string;
}) {
  if (!comparison) {
    return (
      <span className="text-caption text-muted-foreground font-sans">
        {DASHBOARD_COPY.noComparison}
      </span>
    );
  }

  const Icon = DIRECTION_ICON[comparison.direction];

  return (
    <span className="text-caption flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-sans">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-semibold",
          TONE_CLASS[comparison.tone],
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {comparison.direction === "flat" ? (
          DIRECTION_WORD.flat
        ) : (
          <>
            <span className="sr-only">
              {DIRECTION_WORD[comparison.direction]}{" "}
            </span>
            {comparison.magnitude}
          </>
        )}
      </span>
      <span className="text-muted-foreground">{basis}</span>
    </span>
  );
}
