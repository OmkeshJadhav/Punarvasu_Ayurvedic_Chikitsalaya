import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Reveal } from "@/components/shared/reveal";
import { HOME_IMAGES } from "@/config/images";
import { HOME_SECTIONS, INTRO_CONTENT } from "@/config/marketing-content";

/**
 * "What is Punarvasu?"
 *
 * The narrative hinge: the hero says what the clinic promises, this says what
 * it actually is. Kept to two paragraphs - the home page introduces, the About
 * page (a later phase) explains.
 *
 * Layout alternates against the hero: image on the *left* from `lg`, copy on
 * the right. That alternation is the main thing stopping a long marketing page
 * reading as one column of stacked cards.
 *
 * The "read our story" action points at `/about`, which Phase 05 built. It
 * used to scroll to this page's own philosophy section, because a link that
 * 404s is worse than one that scrolls.
 */
export function IntroSection() {
  return (
    <Section
      id={HOME_SECTIONS.intro}
      aria-labelledby="intro-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className="lg:order-2">
            <p className="text-caption text-eyebrow font-sans font-medium tracking-[0.18em] uppercase">
              {INTRO_CONTENT.eyebrow}
            </p>

            <h2
              id="intro-title"
              className="text-h2 text-heading mt-4 font-normal"
            >
              {INTRO_CONTENT.title}
            </h2>

            <div className="measure mt-6 flex flex-col gap-4">
              {INTRO_CONTENT.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-body-lg text-prose">
                  {paragraph}
                </p>
              ))}
            </div>

            <Link
              href={INTRO_CONTENT.readMore.href}
              className="text-label text-primary ease-natural hover:text-primary-hover focus-visible:outline-ring mt-7 inline-flex min-h-11 items-center gap-2 rounded-sm font-medium transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {INTRO_CONTENT.readMore.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Reveal>

          <Reveal className="lg:order-1">
            <MediaFrame
              image={HOME_IMAGES.intro}
              aspect="wide"
              radius="xl"
              sizes="(min-width: 1280px) 37rem, (min-width: 1024px) 45vw, 100vw"
            />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
