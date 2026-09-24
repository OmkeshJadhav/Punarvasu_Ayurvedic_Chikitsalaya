import {
  Hourglass,
  Leaf,
  RefreshCcw,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { Emphasis } from "@/components/marketing/emphasis";
import { Reveal } from "@/components/shared/reveal";
import { HOME_SECTIONS, WHY_CONTENT } from "@/config/marketing-content";

/**
 * "Why Punarvasu" — the differentiation section.
 *
 * Distinct from the trust points in the hero, which are three short labels a
 * visitor reads in two seconds. This is four fuller statements, read by
 * someone who has scrolled and is now deciding. The trust points state *what*;
 * this states *what that means in practice*.
 *
 * Four quiet cards in a row from `lg`, each led by a line icon in a ring. It
 * follows the dark philosophy band, so it is centred and airy - the page
 * exhales after its densest section. The cards carry a hairline border and no
 * resting shadow; they lift a little on hover to show they are one set, but
 * they are not links and do not pretend to be.
 *
 * Every claim here is about the clinic's process, not about outcomes. There is
 * nothing to quantify and nothing that would become a medical claim if quoted
 * alone (`AGENTS.md` section 15).
 */
type WhyTitle = (typeof WHY_CONTENT.points)[number]["title"];

/** Decorative: each card's heading already names the idea. */
const WHY_ICONS = {
  Personal: UserRound,
  Holistic: Leaf,
  Unhurried: Hourglass,
  Continuous: RefreshCcw,
} as const satisfies Record<WhyTitle, LucideIcon>;

export function WhyPunarvasuSection() {
  return (
    <Section
      id={HOME_SECTIONS.why}
      aria-labelledby="why-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <Reveal className="flex flex-col items-center">
          <BotanicalMotif variant="ornament" className="text-gold mb-5" />
          <SectionHeader
            titleId="why-title"
            align="center"
            eyebrow={WHY_CONTENT.eyebrow}
            title={
              <Emphasis
                text={WHY_CONTENT.title}
                phrase={WHY_CONTENT.titleEmphasis}
                className="text-primary"
              />
            }
            description={WHY_CONTENT.description}
          />
        </Reveal>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-6">
          {WHY_CONTENT.points.map((point, index) => {
            const Icon = WHY_ICONS[point.title];
            return (
              <Reveal key={point.title} asChild delay={index * 80}>
                <li className="border-border bg-card ease-natural hover:border-border-strong flex flex-col items-center rounded-xl border px-6 py-10 text-center transition-[border-color,box-shadow,transform] duration-(--duration-normal) hover:shadow-md motion-safe:hover:-translate-y-1">
                  <span
                    aria-hidden="true"
                    className="border-gold/30 bg-gold-surface text-gold flex size-14 items-center justify-center rounded-full border"
                  >
                    <Icon className="size-6" strokeWidth={1.25} />
                  </span>
                  <h3 className="text-h4 text-heading mt-6 font-normal">
                    {point.title}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="bg-gold/40 mt-4 h-px w-8"
                  />
                  <p className="text-body-sm text-prose mt-4">
                    {point.description}
                  </p>
                </li>
              </Reveal>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
