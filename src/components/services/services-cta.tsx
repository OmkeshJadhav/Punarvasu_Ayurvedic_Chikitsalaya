import Link from "next/link";
import { Compass, MessageCircle, Sprout } from "lucide-react";

import { PhotoCta } from "@/components/marketing/photo-cta";
import { Button } from "@/components/ui/button";
import { SERVICES_PAGE_IMAGES } from "@/config/images";
import { CONTACT_PATH } from "@/config/navigation";
import { CONTACT_SECTIONS } from "@/features/contact/content";
import { SERVICES_PAGE } from "@/features/services/content";

/**
 * The services page's closing invitation: the shared compact photographic
 * band (`PhotoCta`, which documents the layout and the legibility guarantee),
 * with a call-back action and three reassurances about what a first
 * conversation is like.
 *
 * A server component.
 */
const REASSURANCE_ICONS = [Sprout, MessageCircle, Compass] as const;

export function ServicesCta() {
  const { cta } = SERVICES_PAGE;

  return (
    <PhotoCta
      titleId="services-cta-title"
      image={SERVICES_PAGE_IMAGES.cta}
      eyebrow={cta.eyebrow}
      title={cta.title}
      titleEmphasis={cta.titleEmphasis}
      description={cta.description}
      secondaryAction={
        <Button asChild size="lg" variant="outline-inverse">
          <Link href={`${CONTACT_PATH}#${CONTACT_SECTIONS.enquiry}`}>
            {cta.secondaryLabel}
          </Link>
        </Button>
      }
      footer={
        <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8">
          {cta.reassurances.map((item, index) => {
            const Icon = REASSURANCE_ICONS[index] ?? Sprout;
            return (
              <li
                key={item}
                className="text-body-sm inline-flex items-center gap-3"
              >
                <Icon
                  aria-hidden="true"
                  className="size-4.5 shrink-0"
                  strokeWidth={1.25}
                />
                {item}
              </li>
            );
          })}
        </ul>
      }
    />
  );
}
