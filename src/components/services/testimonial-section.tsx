import { Moon, Sun, Wheat } from "lucide-react";

import { MediaFrame } from "@/components/marketing/media-frame";
import { Reveal } from "@/components/shared/reveal";
import { SERVICES_PAGE_IMAGES } from "@/config/images";
import { SERVICES_PAGE } from "@/features/services/content";
import type { DisplayTestimonial } from "@/features/testimonials/content";

import { TestimonialCarousel } from "./testimonial-carousel";

/**
 * The page's human moment: a wide photograph beside a patient's own words.
 *
 * ## What the photograph is not
 *
 * It is not the person quoted. It is decorative (`alt=""`) and uncaptioned,
 * so nothing - visual or spoken - ties a stranger's face to a real patient's
 * words (`config/images.ts`, `SERVICES_PAGE_IMAGES`).
 *
 * ## Topics, not outcomes
 *
 * Under the quote sit the everyday subjects people raise at a consultation.
 * They are deliberately nouns ("Sleep"), never results ("Better sleep"): next
 * to a testimonial a result reads as the clinic's promise
 * (`docs/HEALTHCARE_AND_AI_SAFETY.md` section 2).
 *
 * Renders nothing when there is no testimonial to show. A server component
 * around the one client island that moves between quotes.
 */
const TOPIC_ICONS = [Moon, Wheat, Sun] as const;

export interface TestimonialSectionProps {
  readonly testimonials: readonly DisplayTestimonial[];
}

export function TestimonialSection({ testimonials }: TestimonialSectionProps) {
  if (testimonials.length === 0) {
    return null;
  }

  const copy = SERVICES_PAGE.testimonials;

  return (
    <section
      aria-labelledby="testimonials-title"
      className="bg-muted grid lg:grid-cols-12"
    >
      <div className="relative aspect-3/2 lg:col-span-5 lg:aspect-auto">
        <MediaFrame
          image={SERVICES_PAGE_IMAGES.testimonial}
          aspect="fill"
          radius="none"
          sizes="(min-width: 1024px) 42vw, 100vw"
        />
        {/* Melts the photograph into the sand band on wide screens. */}
        <div
          aria-hidden="true"
          className="from-muted absolute inset-y-0 right-0 hidden w-1/3 bg-linear-to-l to-transparent lg:block"
        />
      </div>

      <div className="gutter-x section-y flex flex-col justify-center lg:col-span-7 lg:pr-[max(3rem,calc((100vw-80rem)/2+3rem))] lg:pl-16">
        <Reveal>
          <h2
            id="testimonials-title"
            className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.22em] uppercase"
          >
            <span aria-hidden="true" className="h-px w-8 bg-current" />
            {copy.eyebrow}
            <span className="sr-only">: {copy.title}</span>
          </h2>

          <div className="mt-8">
            <TestimonialCarousel
              testimonials={testimonials}
              label={copy.title}
            />
          </div>

          <div className="border-border-strong mt-12 border-t pt-8">
            <p className="text-caption text-muted-foreground font-sans font-medium tracking-[0.14em] uppercase">
              {copy.topicsLabel}
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-10 gap-y-5">
              {copy.topics.map((topic, index) => {
                const Icon = TOPIC_ICONS[index] ?? Sun;
                return (
                  <li
                    key={topic}
                    className="text-body text-heading inline-flex items-center gap-3 font-serif"
                  >
                    <span
                      aria-hidden="true"
                      className="border-gold/30 bg-gold-surface text-gold flex size-10 items-center justify-center rounded-full border"
                    >
                      <Icon className="size-4.5" strokeWidth={1.25} />
                    </span>
                    {topic}
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
