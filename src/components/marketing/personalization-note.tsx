import Link from "next/link";
import { Leaf } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { PRIMARY_CTA } from "@/config/navigation";
import {
  EMERGENCY_NOTE,
  MEDICAL_DISCLAIMER,
  SERVICES_PAGE,
} from "@/features/services/content";

/**
 * Why the services page will not tell anyone what to have.
 *
 * ## Why this is a section and not a footnote
 *
 * It is the most important thing on the page. A catalogue of therapies
 * invites a visitor to self-select one, and the single clearest way to stop
 * a website becoming a self-diagnosis tool is to say plainly that it is not
 * one and explain why (`docs/implementation-plan/phase_04.md` sections 4,
 * 17 and 25).
 *
 * The medical disclaimer and the emergency guidance are rendered here in the
 * open rather than tucked into the FAQ accordion, per
 * `docs/HEALTHCARE_AND_AI_SAFETY.md` sections 3.2 and 3.3.
 *
 * Visually it is the page's quiet centre: the sand surface, a single column
 * at reading measure, no cards. It ends with the action it argues for.
 *
 * A server component.
 */
export interface PersonalizationNoteProps {
  readonly id: string;
}

export function PersonalizationNote({ id }: PersonalizationNoteProps) {
  const { personalization } = SERVICES_PAGE;

  return (
    <Section
      id={id}
      aria-labelledby="personalization-title"
      className="anchor-offset bg-muted border-border border-y"
    >
      <Container width="prose">
        <span
          aria-hidden="true"
          className="text-primary bg-accent flex size-12 items-center justify-center rounded-full [&_svg]:size-5"
        >
          <Leaf />
        </span>

        <h2
          id="personalization-title"
          className="text-h2 text-heading mt-6 font-normal"
        >
          {personalization.title}
        </h2>

        <div className="mt-6 flex flex-col gap-4">
          {personalization.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-body-lg text-prose">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="border-border-strong mt-8 flex flex-col gap-3 border-t pt-6">
          <p className="text-body-sm text-muted-foreground">
            {MEDICAL_DISCLAIMER}
          </p>
          <p className="text-body-sm text-muted-foreground">{EMERGENCY_NOTE}</p>
        </div>

        <div className="mt-8">
          <Button asChild size="lg">
            <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
