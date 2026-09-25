"use client";

import { ArrowUpRight, UserRound } from "lucide-react";

import { MediaFrame } from "@/components/marketing/media-frame";
import { PractitionerProfileDialog } from "@/components/marketing/practitioner-profile-dialog";
import { isPublished, type Practitioner } from "@/features/practitioners/types";
import { cn } from "@/lib/utils/cn";

/**
 * One portrait and the lines beneath it.
 *
 * A published profile opens the full profile in `PractitionerProfileDialog`.
 * The trigger is one button, stretched over the whole block with the same
 * pseudo-element technique as `CardLink`, so the photograph is clickable
 * but there is a single, clearly named control per practitioner. A
 * placeholder profile opens nothing: there is nothing behind it.
 *
 * `summary` adds the one-paragraph introduction and experience - the About
 * page's fuller card - where the home page shows only the credentials.
 *
 * `qualifications` renders as its own line rather than inside a longer
 * sentence, so it reads as a credential and can be matched exactly.
 */
export interface PractitionerPortraitProps {
  readonly practitioner: Practitioner;
  /**
   * `rounded` is the home page's print-style portrait. `arch` sets the photo
   * in the arched niche the About page uses for its own imagery.
   */
  readonly shape?: "rounded" | "arch";
  readonly headingLevel?: "h2" | "h3";
  /** The rendered width, as `MediaFrame` requires. */
  readonly sizes?: string;
  /** Adds the short biography and experience beneath the credentials. */
  readonly summary?: boolean;
}

export function PractitionerPortrait({
  practitioner,
  shape = "rounded",
  headingLevel: Heading = "h3",
  sizes = "(min-width: 1280px) 22rem, (min-width: 640px) 45vw, 100vw",
  summary = false,
}: PractitionerPortraitProps) {
  const published = isPublished(practitioner);
  const image = practitioner.image;

  return (
    <article className="group focus-within:outline-ring relative rounded-lg focus-within:outline-2 focus-within:outline-offset-4">
      <div
        className={cn(
          "bg-secondary relative overflow-hidden",
          shape === "arch" ? "rounded-t-full rounded-b-lg" : "rounded-lg",
        )}
      >
        {image ? (
          <MediaFrame
            image={image}
            aspect="portrait"
            radius="none"
            sizes={sizes}
            imageClassName="motion-safe:ease-natural motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground flex aspect-4/5 items-center justify-center">
            <UserRound aria-hidden="true" className="size-16" strokeWidth={1} />
          </div>
        )}

        {/* An unconfirmed profile still says so on the image itself. */}
        {!published && (!image || image.placeholder) ? (
          <span className="text-caption bg-card/90 text-muted-foreground absolute bottom-4 left-4 rounded-sm px-2.5 py-1 font-medium tracking-[0.14em] uppercase backdrop-blur-sm">
            {image ? "Placeholder portrait" : "Portrait to follow"}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-1.5">
        {published ? (
          <>
            <Heading className="text-h4 text-heading font-normal">
              <span className="link-underline group-hover:link-underline-active">
                {practitioner.name}
              </span>
            </Heading>
            {practitioner.designation ? (
              <p className="text-body-sm text-prose">
                {practitioner.designation}
              </p>
            ) : null}
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
            {summary && practitioner.experience ? (
              <p className="text-body-sm text-muted-foreground">
                {practitioner.experience}
              </p>
            ) : null}
            {summary && practitioner.shortBio ? (
              <p className="text-body-sm text-prose measure mt-2">
                {practitioner.shortBio}
              </p>
            ) : null}

            <PractitionerProfileDialog practitioner={practitioner}>
              <button
                type="button"
                className="text-label text-primary mt-3 inline-flex w-fit cursor-pointer items-center gap-1.5 font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              >
                View full profile
                <span className="sr-only">: {practitioner.name}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="ease-natural size-4 transition-transform duration-(--duration-normal) group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>
            </PractitionerProfileDialog>
          </>
        ) : (
          <>
            <p className="text-caption text-eyebrow font-medium tracking-[0.14em] uppercase">
              Profile to be published
            </p>
            <Heading className="text-h4 text-heading font-normal">
              Practitioner profile
            </Heading>
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
