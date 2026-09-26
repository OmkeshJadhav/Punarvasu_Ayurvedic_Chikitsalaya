import { Info } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Reveal } from "@/components/shared/reveal";
import { SERVICES_PAGE_IMAGES } from "@/config/images";
import {
  EMERGENCY_NOTE,
  MEDICAL_DISCLAIMER,
  SERVICES_FAQ_ITEMS,
  SERVICES_PAGE,
  SERVICES_SECTIONS,
} from "@/features/services/content";

/**
 * "Before you choose": the heading and a still life on the left, the
 * questions in a quiet panel on the right, a frond behind them.
 *
 * The still life is shot on a flat linen ground and blended into the page
 * with a brightness lift, `mix-blend-multiply` and a soft mask, as in
 * `OngoingSupport`. It is
 * decorative (`config/images.ts`).
 *
 * The medical disclaimer and the emergency guidance are rendered in the open
 * under the panel, not inside an accordion answer: a collapsed panel is not
 * "visible where appropriate" (`docs/HEALTHCARE_AND_AI_SAFETY.md` sections
 * 3.2-3.3).
 *
 * A server component around the accordion's client island.
 */
export function ServicesFaq() {
  const { faq } = SERVICES_PAGE;

  return (
    <Section
      id={SERVICES_SECTIONS.faq}
      aria-labelledby="services-faq-title"
      className="anchor-offset bg-background border-border relative isolate overflow-hidden border-t"
    >
      <BotanicalMotif
        variant="frond"
        className="text-primary/15 pointer-events-none absolute -top-16 -right-20 -z-10 hidden h-120 w-68 scale-x-[-1] rotate-[-36deg] md:block"
      />

      <Container width="wide">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
                <span aria-hidden="true" className="h-px w-8 bg-current" />
                {faq.eyebrow}
              </p>
              <h2
                id="services-faq-title"
                className="text-display text-heading mt-5 font-normal"
              >
                {faq.title}
              </h2>
              <p className="text-body-lg text-prose mt-6 max-w-md">
                {faq.description}
              </p>
            </Reveal>

            {/* The blend and mask sit on the outermost wrapper; see
                `OngoingSupport` for why. */}
            <Reveal className="mt-8 max-w-md mask-[radial-gradient(ellipse_at_center,black_42%,transparent_70%)] mix-blend-multiply">
              <MediaFrame
                image={SERVICES_PAGE_IMAGES.herbBowlWide}
                aspect="wide"
                radius="none"
                sizes="(min-width: 1024px) 28rem, 90vw"
                className="aspect-1100/377 bg-transparent"
                imageClassName="brightness-[1.06]"
              />
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <FaqAccordion
              items={SERVICES_FAQ_ITEMS}
              headingLevel="h3"
              appearance="panel"
            />

            <div className="mt-8 flex items-start gap-3">
              <Info
                aria-hidden="true"
                className="text-gold mt-0.5 size-4 shrink-0"
                strokeWidth={1.5}
              />
              <div className="flex flex-col gap-2">
                <p className="text-caption text-muted-foreground">
                  {MEDICAL_DISCLAIMER}
                </p>
                <p className="text-caption text-muted-foreground">
                  {EMERGENCY_NOTE}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
