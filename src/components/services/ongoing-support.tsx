import { CalendarCheck, Salad, Sunrise } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TextLink } from "@/components/marketing/text-link";
import { Reveal } from "@/components/shared/reveal";
import { SERVICES_PAGE_IMAGES } from "@/config/images";
import { treatmentPath } from "@/config/navigation";
import {
  ONGOING_SUPPORT_SLUG,
  SERVICES_PAGE,
  SERVICES_SECTIONS,
} from "@/features/services/content";

/**
 * What continues after the first visit.
 *
 * A statement and a link on the left, three stacked points in the middle, and
 * a still life of a mortar and herbs settling onto the section's lower edge,
 * with a frond above it - artwork in place of another row of cards. The
 * points are divided by hairlines: they describe one continuing relationship,
 * not three things to buy.
 *
 * The still life is shot on a flat linen ground. `mix-blend-multiply` drops
 * that ground into the page's own ivory and a radial mask softens the frame's
 * edge, so it reads as an object on the page rather than a photograph in a
 * box. It is decorative (`config/images.ts`).
 *
 * A server component.
 */
const POINT_ICONS = [Sunrise, Salad, CalendarCheck] as const;

export function OngoingSupport() {
  const { ongoing } = SERVICES_PAGE;

  return (
    <Section
      id={SERVICES_SECTIONS.ongoing}
      aria-labelledby="ongoing-title"
      className="anchor-offset bg-background relative isolate overflow-hidden"
    >
      <BotanicalMotif
        variant="frond"
        className="text-primary/20 pointer-events-none absolute -top-10 -right-16 -z-10 hidden h-112 w-62 scale-x-[-1] rotate-[-32deg] md:block"
      />

      <Container width="wide">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-5">
            <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {ongoing.eyebrow}
            </p>
            <h2
              id="ongoing-title"
              className="text-display-xl text-heading mt-6 max-w-[13ch] font-normal"
            >
              <Emphasis
                text={ongoing.title}
                phrase={ongoing.titleEmphasis}
                className="text-primary"
              />
            </h2>
            <p className="text-body-lg text-prose mt-7 max-w-lg">
              {ongoing.description}
            </p>
            <TextLink
              href={treatmentPath(ONGOING_SUPPORT_SLUG)}
              className="mt-8"
            >
              {ongoing.actionLabel}
            </TextLink>
          </Reveal>

          <ul className="flex flex-col self-center lg:col-span-4">
            {ongoing.points.map((point, index) => {
              const Icon = POINT_ICONS[index] ?? Sunrise;
              return (
                <Reveal key={point.title} asChild delay={index * 90}>
                  <li className="border-border flex gap-5 border-t py-7 last:border-b">
                    <span
                      aria-hidden="true"
                      className="border-gold/30 bg-gold-surface text-gold flex size-12 shrink-0 items-center justify-center rounded-full border"
                    >
                      <Icon className="size-5" strokeWidth={1.25} />
                    </span>
                    <div>
                      <h3 className="text-h5 text-heading font-serif font-normal">
                        {point.title}
                      </h3>
                      <p className="text-body-sm text-prose mt-1.5">
                        {point.description}
                      </p>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ul>

          {/* Below `lg`, a centred still life under the points. From `lg`
              it is anchored to the section's lower-right corner, outside the
              grid, and sized against the viewport so it never reaches the
              points column. The blend and the mask sit on this outermost
              wrapper because each of them - and the reveal's transform -
              isolates its element: a blend set on the image inside would
              only mix with transparency. The brightness lift takes the
              photograph's linen ground to white, which the multiply then
              turns into exactly the page's ivory. */}
          <Reveal className="mx-auto w-full max-w-sm mask-[radial-gradient(ellipse_at_center,black_42%,transparent_70%)] mix-blend-multiply lg:absolute lg:-right-6 lg:bottom-0 lg:w-[min(30rem,30vw)] lg:max-w-none">
            <MediaFrame
              image={SERVICES_PAGE_IMAGES.herbBowl}
              aspect="landscape"
              radius="none"
              sizes="(min-width: 1024px) 30vw, 24rem"
              className="bg-transparent"
              imageClassName="brightness-[1.06]"
            />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
