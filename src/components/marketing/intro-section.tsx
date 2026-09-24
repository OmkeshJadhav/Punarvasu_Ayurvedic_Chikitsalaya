import { Quote } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TextLink } from "@/components/marketing/text-link";
import { Reveal } from "@/components/shared/reveal";
import { HOME_IMAGES } from "@/config/images";
import { HOME_SECTIONS, INTRO_CONTENT } from "@/config/marketing-content";

/**
 * "What is Punarvasu?"
 *
 * The narrative hinge: the hero says what the clinic promises, this says what
 * it actually is. Kept to two paragraphs - the home page introduces, the About
 * page explains.
 *
 * The photograph is portrait and on the left, against the hero's arch on the
 * right: the page swings from side to side rather than stacking the same
 * composition twice. A card carrying one sentence from the copy overlaps its
 * corner - a pull quote, not new content, and marked up as one.
 *
 * The columns are deliberately unequal (6 and 5 of 12, with a gutter column
 * between) so the text sits in a reading measure rather than stretching to
 * match the image.
 */
export function IntroSection() {
  return (
    <Section
      id={HOME_SECTIONS.intro}
      aria-labelledby="intro-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
          <Reveal className="relative lg:col-span-6">
            <MediaFrame
              image={HOME_IMAGES.intro}
              aspect="portrait"
              radius="xl"
              className="max-h-160 w-full"
              sizes="(min-width: 1280px) 38rem, (min-width: 1024px) 48vw, 100vw"
            />

            <blockquote className="border-border bg-card absolute -right-2 -bottom-10 max-w-72 rounded-lg border p-6 shadow-md sm:right-6 lg:-right-10">
              <Quote
                aria-hidden="true"
                className="text-gold size-5"
                strokeWidth={1.5}
              />
              <p className="text-h5 text-heading mt-3 font-serif italic">
                {INTRO_CONTENT.pullQuote}
              </p>
            </blockquote>
          </Reveal>

          <Reveal delay={80} className="lg:col-span-5 lg:col-start-8">
            <p className="text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {INTRO_CONTENT.eyebrow}
            </p>

            <h2
              id="intro-title"
              className="text-display text-heading mt-5 font-normal"
            >
              <Emphasis
                text={INTRO_CONTENT.title}
                phrase={INTRO_CONTENT.titleEmphasis}
                className="text-primary"
              />
            </h2>

            <div className="measure mt-7 flex flex-col gap-5">
              {INTRO_CONTENT.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-body-lg text-prose">
                  {paragraph}
                </p>
              ))}
            </div>

            <TextLink href={INTRO_CONTENT.readMore.href} className="mt-8">
              {INTRO_CONTENT.readMore.label}
            </TextLink>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
