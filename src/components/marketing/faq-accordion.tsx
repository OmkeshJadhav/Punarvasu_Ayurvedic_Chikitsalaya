"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils/cn";

/**
 * A list of questions and answers.
 *
 * Extracted in Phase 04, when the services page and every treatment page
 * needed the same disclosure list that the home page already had. It is the
 * smallest client component the job allows: a disclosure needs state, so this
 * file is `"use client"` while the sections that wrap it stay server
 * components.
 *
 * Built on the Phase 02 accordion, so `aria-expanded`, `aria-controls`, the
 * real heading wrapper, arrow-key movement and the reduced-motion-aware
 * height animation all come from there.
 *
 * `type="single"` with `collapsible`: one answer at a time keeps the page
 * from jumping around, and every item can be closed again. Nothing is open by
 * default — an arbitrarily pre-opened first item pushes the rest off screen
 * on a phone.
 *
 * `headingLevel` must match the surrounding outline. It is a prop rather than
 * a fixed `h3` because the same list sits under an `<h2>` on the services
 * page and under an `<h3>` inside a treatment article.
 *
 * Nothing medical or legal belongs in here. The medical disclaimer and the
 * emergency guidance are rendered in the open, not behind a disclosure
 * (`docs/implementation-plan/phase_04.md` section 60, `docs/DESIGN_SYSTEM.md`
 * section 47).
 */
export interface FaqEntry {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface FaqAccordionProps {
  readonly items: readonly FaqEntry[];
  readonly headingLevel?: "h2" | "h3" | "h4";
  /**
   * `editorial` sets each question in the serif at heading size with a
   * plus/minus marker, for a list that is a section's main content rather
   * than a block inside an article.
   *
   * `panel` sets the list inside a quiet linen panel - sans questions with a
   * plus/minus, hairlines between rows and none around the ends - for a list
   * that sits beside a section's heading as its companion.
   */
  readonly appearance?: "default" | "editorial" | "panel";
  readonly className?: string;
}

export function FaqAccordion({
  items,
  headingLevel = "h3",
  appearance = "default",
  className,
}: FaqAccordionProps) {
  const editorial = appearance === "editorial";
  const panel = appearance === "panel";

  if (items.length === 0) {
    return null;
  }

  return (
    <Accordion
      type="single"
      collapsible
      className={cn(
        panel
          ? "border-border bg-card/70 rounded-xl border px-6 sm:px-8 [&>*:last-child]:border-b-0"
          : "border-t",
        editorial ? "border-border-strong" : "border-border",
        className,
      )}
    >
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger
            headingLevel={headingLevel}
            indicator={editorial || panel ? "plus" : "chevron"}
            className={
              editorial
                ? "text-h5 py-6 font-serif font-normal"
                : panel
                  ? "text-body text-heading py-5 font-medium"
                  : undefined
            }
          >
            {item.question}
          </AccordionTrigger>
          <AccordionContent
            className={
              editorial
                ? "text-body-sm -mt-1 pb-6"
                : panel
                  ? "text-body-sm -mt-1 pb-5"
                  : undefined
            }
          >
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
