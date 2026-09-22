import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { AttentionItem } from "@/features/patients/attention";
import { PATIENT_DASHBOARD } from "@/features/patients/content";

/**
 * "What needs your attention?"
 *
 * ## The panel the phase is really about
 *
 * `phase_18.md` sections 62-64 ask for this shape instead of a wall of
 * figures, and the whole value of it is that a patient can trust it: if this
 * says nothing needs doing, nothing needs doing. So the list is derived from
 * real stored values by `features/patients/attention.ts`, and when it is empty
 * the panel says so rather than manufacturing a task to fill the space.
 *
 * ## Two tones, and neither is colour alone
 *
 * An `action` item is something the patient can do. An `info` item is
 * something they should know and need not act on — an appointment the clinic
 * has not confirmed yet is the case that matters, because a patient who thinks
 * they are supposed to confirm it will go looking for a button that does not
 * exist.
 *
 * They are told apart by their **icon and their wording**, not by their tint.
 * The tint is decoration on top (WCAG 1.4.1, `DESIGN_SYSTEM.md` section 5).
 *
 * ## Why each item is a list item with a link, not a whole clickable card
 *
 * One focusable element per item, a real accessible name, working middle-click
 * and "open in new tab" — the reasoning `Card`'s own docblock records for
 * `CardLink`. The arrow is `aria-hidden` so the item is announced once.
 */
export function AttentionPanel({
  items,
}: {
  readonly items: readonly AttentionItem[];
}) {
  const copy = PATIENT_DASHBOARD.attention;

  if (items.length === 0) {
    return (
      <Card variant="muted">
        <CardContent className="flex items-start gap-3">
          <span
            aria-hidden
            className="text-success bg-success-surface mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4"
          >
            <Check />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-body text-heading font-sans font-medium">
              {copy.emptyTitle}
            </p>
            <p className="text-body-sm text-muted-foreground measure">
              {copy.emptyBody}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <Card variant="interactive" padding="compact">
            <CardContent className="flex items-start gap-3">
              {item.tone === "info" ? (
                <span
                  aria-hidden
                  className="text-info bg-info-surface mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4"
                >
                  <Info />
                </span>
              ) : (
                <span
                  aria-hidden
                  className="text-primary bg-accent mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4"
                >
                  <ArrowRight />
                </span>
              )}

              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-body text-heading font-sans font-medium">
                  {/*
                    The stretched link. One focusable element for the item, and
                    the focus ring lands on the card via `focus-within`.
                  */}
                  <Link
                    href={item.href}
                    className="after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {item.title}
                  </Link>
                </p>
                <p className="text-body-sm text-muted-foreground measure">
                  {item.description}
                </p>
                <p className="text-body-sm text-primary mt-1 font-sans font-medium">
                  {item.actionLabel}
                  <span aria-hidden> &rarr;</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
