import Link from "next/link";
import { UserRound } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section, SectionHeader } from "@/components/layout/section";
import { Emphasis } from "@/components/marketing/emphasis";
import { MediaFrame } from "@/components/marketing/media-frame";
import { TextLink } from "@/components/marketing/text-link";
import { Reveal } from "@/components/shared/reveal";
import { HOME_SECTIONS } from "@/config/marketing-content";
import { PRACTITIONERS_PATH, practitionerPath } from "@/config/navigation";
import { PRACTITIONERS_PAGE } from "@/features/practitioners/content";
import { isPublished, type Practitioner } from "@/features/practitioners/types";
import { cn } from "@/lib/utils/cn";

/**
 * The home page's practitioner preview.
 *
 * ## Why this reads from the practitioners feature
 *
 * The home page reads the same roster as `/practitioners`, through the same
 * directory, so publishing a practitioner updates both pages at once and
 * there is one model of the domain concept (`AGENTS.md` section 32).
 *
 * ## Composition
 *
 * An editorial spread rather than a card grid: the heading, a sentence and a
 * link on the left, and the portraits on the right as tall photographs with
 * the name set beneath each - the way a printed prospectus introduces its
 * faculty. The second portrait sits lower than the first, so the pair reads
 * as two people rather than as two tiles. The `/practitioners` page keeps the
 * denser `PractitionerGrid`, which carries biographies this preview omits.
 *
 * ## What it can and cannot show
 *
 * Whatever the roster holds, and nothing more. No practitioner has been
 * confirmed for publication, so each portrait carries the explicit "Profile
 * to be published" state and the neutral heading "Practitioner profile"
 * rather than a name - never a `Dr. [name]` template, which a visitor reads as
 * a real, oddly formatted person. A placeholder photograph is labelled as one
 * on the image itself, not only in its alt text
 * (`features/practitioners/types.ts`).
 *
 * The section hides itself when the roster is empty: an empty band with a
 * heading over it is worse than one fewer section.
 */
export interface PractitionerPreviewSectionProps {
  readonly practitioners: readonly Practitioner[];
}

export function PractitionerPreviewSection({
  practitioners,
}: PractitionerPreviewSectionProps) {
  if (practitioners.length === 0) {
    return null;
  }

  return (
    <Section
      id={HOME_SECTIONS.practitioners}
      aria-labelledby="practitioners-title"
      className="anchor-offset bg-background"
    >
      <Container width="wide">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-4 lg:pt-4">
            <SectionHeader
              titleId="practitioners-title"
              eyebrow={PRACTITIONERS_PAGE.hero.eyebrow}
              title={
                <Emphasis
                  text={PRACTITIONERS_PAGE.hero.title}
                  phrase="sit with"
                  className="text-primary"
                />
              }
              description={PRACTITIONERS_PAGE.hero.description}
            />
            <TextLink href={PRACTITIONERS_PATH} className="mt-6">
              Meet our practitioners
            </TextLink>
          </Reveal>

          <ul className="grid gap-12 sm:grid-cols-2 sm:gap-8 lg:col-span-7 lg:col-start-6">
            {practitioners.map((practitioner, index) => (
              <Reveal key={practitioner.slug} asChild delay={index * 100}>
                <li className={cn(index % 2 === 1 && "sm:mt-20")}>
                  <PractitionerPortrait practitioner={practitioner} />
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}

/**
 * One portrait and the lines beneath it.
 *
 * A published profile is a link to its page, stretched over the whole block
 * with the same pseudo-element technique as `CardLink`, so the photograph is
 * clickable but the accessible name is only the practitioner's name. A
 * placeholder profile links nowhere: there is no page behind it.
 *
 * `qualifications` renders as its own line rather than inside a longer
 * sentence, so it reads as a credential and can be matched exactly.
 */
function PractitionerPortrait({
  practitioner,
}: {
  readonly practitioner: Practitioner;
}) {
  const published = isPublished(practitioner);
  const image = practitioner.image;

  return (
    <article className="group focus-within:outline-ring relative rounded-lg focus-within:outline-2 focus-within:outline-offset-4">
      <div className="bg-secondary relative overflow-hidden rounded-lg">
        {image ? (
          <MediaFrame
            image={image}
            aspect="portrait"
            radius="none"
            sizes="(min-width: 1280px) 22rem, (min-width: 640px) 45vw, 100vw"
            imageClassName="motion-safe:ease-natural motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground flex aspect-4/5 items-center justify-center">
            <UserRound aria-hidden="true" className="size-16" strokeWidth={1} />
          </div>
        )}

        {!image || image.placeholder ? (
          <span className="text-caption bg-card/90 text-muted-foreground absolute bottom-4 left-4 rounded-sm px-2.5 py-1 font-medium tracking-[0.14em] uppercase backdrop-blur-sm">
            {image ? "Placeholder portrait" : "Portrait to follow"}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-1.5">
        {published ? (
          <>
            <h3 className="text-h4 text-heading font-normal">
              <Link
                href={practitionerPath(practitioner.slug)}
                className="link-underline group-hover:link-underline-active after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              >
                {practitioner.name}
              </Link>
            </h3>
            {practitioner.qualifications &&
            practitioner.qualifications.length > 0 ? (
              <p className="text-label text-eyebrow font-medium">
                {practitioner.qualifications.join(", ")}
              </p>
            ) : null}
            {practitioner.specialties && practitioner.specialties.length > 0 ? (
              <p className="text-body-sm text-prose">
                {practitioner.specialties.join(" · ")}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-caption text-eyebrow font-medium tracking-[0.14em] uppercase">
              Profile to be published
            </p>
            <h3 className="text-h4 text-heading font-normal">
              Practitioner profile
            </h3>
            <p className="text-body-sm text-muted-foreground">
              Name, qualifications and registration details will appear here
              once the clinic has confirmed them.
            </p>
          </>
        )}
      </div>
    </article>
  );
}
