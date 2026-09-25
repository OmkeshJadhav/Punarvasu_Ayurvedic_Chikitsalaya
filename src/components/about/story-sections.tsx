import {
  Handshake,
  RefreshCcw,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { BotanicalMotif } from "@/components/marketing/botanical-motif";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TextLink } from "@/components/marketing/text-link";
import { Reveal } from "@/components/shared/reveal";
import { HOME_IMAGES } from "@/config/images";
import { HOME_SECTIONS } from "@/config/marketing-content";
import { homeSectionHref } from "@/config/navigation";
import { ABOUT_PAGE, ABOUT_SECTIONS } from "@/features/about/content";

/**
 * The About page's story, in three chapters: why the clinic exists, what it
 * believes, and what a practitioner does with the time.
 *
 * Each chapter is set differently on purpose - an inset sage panel, a deep
 * green band with the page's one large interior photograph, and an open
 * linen spread with a numbered sequence - so the page reads as chapters
 * rather than as one heading-and-paragraphs block repeated. The copy is
 * unchanged from `features/about/content.ts`; only its setting is new.
 */

/** A section eyebrow with its chapter number, e.g. "02 · Why Punarvasu exists". */
function Eyebrow({
  number,
  children,
  tone = "default",
}: {
  readonly number: string;
  readonly children: string;
  readonly tone?: "default" | "inverted";
}) {
  return (
    <p
      className={
        tone === "inverted"
          ? "text-caption text-brand-surface-accent inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase"
          : "text-caption text-eyebrow inline-flex items-center gap-3 font-sans font-medium tracking-[0.18em] uppercase"
      }
    >
      <span aria-hidden="true" className="h-px w-8 bg-current" />
      {number} · {children}
    </p>
  );
}

/**
 * "Our story" - the clinic's own account, supplied by Punarvasu.
 *
 * An inset panel on the sage surface, not a full-width band: set inside the
 * page's margins it reads as a pause - a card held up to the reader - and it
 * is the page's one cool surface among the warm ones. The heading takes the
 * full width; the three paragraphs sit side by side beneath it as columns.
 */
export function PurposeSection() {
  const { purpose } = ABOUT_PAGE;

  return (
    <Section
      id={ABOUT_SECTIONS.purpose}
      aria-labelledby="about-purpose-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <Reveal className="bg-sage rounded-xl px-6 py-14 sm:px-12 lg:px-20 lg:py-24">
          <Eyebrow number="02">{purpose.eyebrow}</Eyebrow>
          <h2
            id="about-purpose-title"
            className="text-display text-heading mt-6 max-w-4xl font-normal"
          >
            <Emphasis
              text={purpose.title}
              phrase={purpose.titleEmphasis}
              className="text-primary"
            />
          </h2>

          <div className="mt-12 grid gap-8 md:grid-cols-3 lg:mt-16 lg:gap-12">
            {purpose.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-body text-prose">
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/**
 * "What we believe" - the philosophy, on the deep green band.
 *
 * The page's large interior photograph sits here, tall, beside the text: this
 * is the chapter about attention, and the image is of attention being paid.
 * It uncovers from its lower edge as it scrolls in (`effect="unveil"`).
 *
 * The four principles follow as a two-by-two list, each led by a line icon
 * in a hairline ring. The icons are decorative - each principle's heading
 * names it - and are matched by title, so reordering the copy cannot give a
 * principle the wrong mark.
 */
type PrincipleTitle = (typeof ABOUT_PAGE.beliefs.principles)[number]["title"];

const PRINCIPLE_ICONS = {
  "The person before the complaint": UserRound,
  "Nothing before an assessment": Search,
  "Alongside, not instead": Handshake,
  "Correction over prescription": RefreshCcw,
} as const satisfies Record<PrincipleTitle, LucideIcon>;

export function BeliefsSection() {
  const { beliefs } = ABOUT_PAGE;

  return (
    <Section
      id={ABOUT_SECTIONS.beliefs}
      aria-labelledby="about-beliefs-title"
      // See `[data-surface="inverted"]` in `globals.css`.
      data-surface="inverted"
      className="anchor-offset bg-brand-surface text-brand-surface-foreground relative isolate overflow-hidden"
    >
      <BotanicalMotif className="text-brand-surface-border/50 pointer-events-none absolute -top-6 -right-6 -z-10 h-112 w-44 -rotate-12" />

      <Container width="wide">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <Reveal effect="unveil" className="lg:col-span-5">
            <MediaFrame
              image={HOME_IMAGES.hero}
              aspect="portrait"
              radius="xl"
              className="mx-auto max-w-md lg:max-w-none"
              sizes="(min-width: 1280px) 30rem, (min-width: 1024px) 40vw, 28rem"
            />
          </Reveal>

          <div className="lg:col-span-6 lg:col-start-7 lg:self-center">
            <Reveal>
              <Eyebrow number="03" tone="inverted">
                {beliefs.eyebrow}
              </Eyebrow>
              <h2
                id="about-beliefs-title"
                className="text-display text-brand-surface-foreground mt-6 font-normal"
              >
                <Emphasis
                  text={beliefs.title}
                  phrase={beliefs.titleEmphasis}
                  className="text-brand-surface-accent"
                />
              </h2>
              <div className="measure mt-8 flex flex-col gap-5">
                {beliefs.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-body-lg text-brand-surface-muted"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        <ul className="border-brand-surface-border mt-16 grid gap-x-10 gap-y-10 border-t pt-12 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {beliefs.principles.map((principle, index) => {
            const Icon = PRINCIPLE_ICONS[principle.title];
            return (
              <Reveal key={principle.title} asChild delay={index * 80}>
                <li className="flex flex-col">
                  <span
                    aria-hidden="true"
                    className="border-brand-surface-border text-brand-surface-accent flex size-12 items-center justify-center rounded-full border"
                  >
                    <Icon className="size-5" strokeWidth={1.25} />
                  </span>
                  <h3 className="text-h5 text-brand-surface-foreground mt-5 font-normal">
                    {principle.title}
                  </h3>
                  <p className="text-body-sm text-brand-surface-muted mt-2">
                    {principle.description}
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

/**
 * "Our approach to care" - the practitioner's method, as a numbered journey.
 *
 * Six steps across one row from `lg`, joined by a hairline that runs through
 * their numbered rings; a vertical sequence below that. The ring fills on
 * hover, so the row answers the pointer step by step without any step
 * looking like a button.
 *
 * `#approach` is also the footer's deep link ("Our approach"), which the
 * About page's tests hold to. The link out goes to the home page's journey:
 * the visitor's itinerary, which this deliberately does not repeat
 * (`phase_05.md` section 13).
 */
export function ApproachJourneySection() {
  const { approach } = ABOUT_PAGE;

  return (
    <Section
      id={ABOUT_SECTIONS.approach}
      aria-labelledby="about-approach-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-7">
            <Eyebrow number="04">{approach.eyebrow}</Eyebrow>
            <h2
              id="about-approach-title"
              className="text-display text-heading mt-6 font-normal"
            >
              <Emphasis
                text={approach.title}
                phrase={approach.titleEmphasis}
                className="text-primary"
              />
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pb-2">
            <p className="text-body-lg text-prose">{approach.description}</p>
            <TextLink
              href={homeSectionHref(HOME_SECTIONS.journey)}
              className="mt-4"
            >
              {approach.journeyLinkLabel}
            </TextLink>
          </div>
        </Reveal>

        <ol className="relative mt-16 grid gap-10 lg:mt-20 lg:grid-cols-6 lg:gap-6">
          {/* The thread through the rings: vertical on a phone, across from `lg`. */}
          <span
            aria-hidden="true"
            className="bg-border-strong absolute top-6 bottom-6 left-6 w-px lg:top-6 lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-auto"
          />

          {approach.steps.map((step, index) => (
            <Reveal key={step.title} asChild delay={index * 70}>
              <li className="group relative grid grid-cols-[3rem_1fr] gap-x-5 lg:block">
                <span
                  aria-hidden="true"
                  className="border-border-strong bg-background text-gold ease-natural group-hover:bg-primary group-hover:text-primary-foreground relative flex size-12 items-center justify-center rounded-full border font-serif italic transition-colors duration-(--duration-normal) group-hover:border-transparent"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="lg:mt-7">
                  <h3 className="text-h4 text-heading font-normal">
                    {step.title}
                  </h3>
                  <p className="text-body-sm text-prose mt-2">
                    {step.description}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
