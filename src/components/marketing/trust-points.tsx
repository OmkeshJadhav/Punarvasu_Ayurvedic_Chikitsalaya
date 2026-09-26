import { Flower2, Leaf, Sprout } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Trust indicators under a hero's actions.
 *
 * Three qualitative statements, shared by the home and services heroes so the
 * two openings read as one family. Deliberately not a statistics bar: no
 * patient count, rating or success figure has been verified, and a fabricated
 * one on a healthcare site is the worst thing a page could contain
 * (`docs/implementation-plan/phase_03.md` sections 13-14).
 *
 * The icons are botanical and decorative - the bold line beside each already
 * says what it is - so they are hidden from assistive technology. They are
 * matched by position because each set is fixed, and a missing one falls back
 * to the leaf rather than to nothing.
 */
export interface TrustPoint {
  readonly title: string;
  readonly description: string;
}

const TRUST_ICONS = [Sprout, Leaf, Flower2] as const;

export function TrustPoints({
  points,
  className,
}: {
  readonly points: readonly TrustPoint[];
  readonly className?: string;
}) {
  return (
    <ul
      className={cn(
        "border-border mt-14 grid gap-6 border-t pt-8 sm:grid-cols-3 sm:gap-5",
        className,
      )}
    >
      {points.map((point, index) => {
        const Icon = TRUST_ICONS[index] ?? Leaf;
        return (
          <li key={point.title} className="flex items-start gap-3 sm:flex-col">
            <span
              aria-hidden="true"
              className="border-gold/30 bg-gold-surface text-gold flex size-10 shrink-0 items-center justify-center rounded-full border"
            >
              <Icon className="size-4.5" strokeWidth={1.5} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-label text-heading font-semibold">
                {point.title}
              </span>
              <span className="text-body-sm text-muted-foreground">
                {point.description}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
