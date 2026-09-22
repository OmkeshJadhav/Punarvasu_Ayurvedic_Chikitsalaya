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
  readonly className?: string;
}

export function FaqAccordion({
  items,
  headingLevel = "h3",
  className,
}: FaqAccordionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Accordion
      type="single"
      collapsible
      className={cn("border-border border-t", className)}
    >
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger headingLevel={headingLevel}>
            {item.question}
          </AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
