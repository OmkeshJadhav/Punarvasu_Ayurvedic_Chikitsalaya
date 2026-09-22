import Link from "next/link";
import { ArrowRight, CircleDashed } from "lucide-react";

import { MediaFrame } from "@/components/marketing/media-frame";
import { Badge } from "@/components/ui/badge";
import { Card, CardLink } from "@/components/ui/card";
import { practitionerPath } from "@/config/navigation";
import type { Practitioner } from "@/features/practitioners/types";
import { isPublished } from "@/features/practitioners/types";
import { cn } from "@/lib/utils/cn";

/**
 * A practitioner in a grid.
 *
 * ## The rule this component enforces
 *
 * It can only render what the roster gives it, and the roster's type does not
 * let an unverified entry carry a name, a qualification or a specialisation
 * (`features/practitioners/types.ts`). So the unpublished state is not a
 * matter of remembering to check a flag - there is simply nothing to print,
 * and the card says so.
 *
 * A published card is a single link to the profile, through `CardLink`'s
 * stretched pseudo-element: one focusable element, a real accessible name,
 * working middle-click, and the focus ring around the card. An unpublished
 * card is not a link at all, because there is no page to go to and a "View
 * profile" action leading to a 404 is worse than no action.
 *
 * ## Layout
 *
 * A 3:2 crop above the text on a phone - a 4:5 portrait across a full-width
 * phone is most of the screen before any words - becoming a full-height
 * column beside the text from `sm`. `object-top` keeps a head in frame
 * through both crops.
 *
 * A server component.
 */
export interface PractitionerCardProps {
  readonly practitioner: Practitioner;
  /** Matches the rendered frame width at each breakpoint. See `MediaFrame`. */
  readonly imageSizes?: string;
  /** The outline level this card's title occupies. */
  readonly headingLevel?: "h3" | "h4";
  readonly className?: string;
}

const DEFAULT_IMAGE_SIZES =
  // Beside the text the frame is taller than it is wide, so this overstates
  // the width to stop a height-driven crop upscaling the source. See the
  // worked examples in `MediaFrame`.
  "(min-width: 1024px) 20rem, (min-width: 640px) 28vw, 100vw";

export function PractitionerCard({
  practitioner,
  imageSizes = DEFAULT_IMAGE_SIZES,
  headingLevel: Heading = "h3",
  className,
}: PractitionerCardProps) {
  const published = isPublished(practitioner);

  return (
    <Card
      variant={published ? "interactive" : "default"}
      padding="none"
      className={cn("group w-full overflow-hidden", className)}
    >
      <div className="grid gap-0 sm:grid-cols-5">
        {practitioner.image ? (
          <MediaFrame
            image={practitioner.image}
            aspect="landscape"
            radius="none"
            sizes={imageSizes}
            className="sm:col-span-2 sm:aspect-auto sm:h-full"
          />
        ) : null}

        <div
          className={cn(
            "flex flex-col gap-2 p-5 sm:p-6",
            practitioner.image ? "sm:col-span-3" : "sm:col-span-5",
          )}
        >
          {published ? (
            <>
              <Heading className="text-h5 text-heading font-serif font-medium">
                <CardLink asChild>
                  <Link href={practitionerPath(practitioner.slug)}>
                    {practitioner.name}
                  </Link>
                </CardLink>
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

              {practitioner.specialties &&
              practitioner.specialties.length > 0 ? (
                <p className="text-body-sm text-prose">
                  {practitioner.specialties.join(" · ")}
                </p>
              ) : null}

              {practitioner.shortBio ? (
                <p className="text-body-sm text-prose mt-1 flex-1">
                  {practitioner.shortBio}
                </p>
              ) : null}

              {/*
                Decorative: the card's accessible name already comes from the
                title link, and announcing "View profile" a second time would
                make every card read twice.
              */}
              <span
                aria-hidden="true"
                className="text-label text-primary ease-natural mt-2 inline-flex items-center gap-2 font-medium transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
              >
                View profile
                <ArrowRight className="size-4" />
              </span>
            </>
          ) : (
            <>
              <Badge tone="neutral" icon={<CircleDashed />}>
                Profile to be published
              </Badge>
              {/*
                A heading is still required: the list must have a consistent
                outline whether or not a profile is filled in, and a card with
                no heading is unreachable by heading navigation.
              */}
              <Heading className="text-h5 text-heading mt-1 font-serif font-medium">
                Practitioner profile
              </Heading>
              <p className="text-body-sm text-prose">
                This profile will carry the practitioner&rsquo;s name,
                qualifications and registration details once the clinic has
                confirmed them. The photograph is a placeholder.
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
