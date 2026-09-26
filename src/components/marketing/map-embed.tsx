import { CONTACT_PAGE } from "@/features/contact/content";
import { cn } from "@/lib/utils/cn";

/**
 * The clinic's location on a map.
 *
 * ## Loading
 *
 * The frame renders with the page. `loading="lazy"` keeps it from competing
 * with the content above it — the map sits low on a phone and in the right
 * column from `lg`, so the browser fetches it as it comes into view rather
 * than during the initial load.
 *
 * An earlier revision gated the frame behind a "Show the map" button, on the
 * grounds that an embedded map is a third-party request with cookies attached
 * and most visitors only want the address. That was reversed deliberately:
 * seeing where a clinic is, without an extra tap, is worth more to someone
 * planning a visit. `mapPrivacyNote` still discloses what the frame does.
 *
 * ## Accessibility
 *
 * The map is never the only way to get the location
 * (`docs/implementation-plan/phase_05.md` section 34). The full address is
 * text on this page and in the footer, and the directions and "Open in Google
 * Maps" actions beside it work whether or not the frame ever loads. Nobody
 * has to interpret a map image to find the clinic.
 *
 * The frame carries a `title`, which is how a screen reader names an iframe,
 * and it is the only accessibility property here that belongs to this
 * codebase rather than to the provider's page.
 *
 * A server component. It holds no state and ships no JavaScript.
 */
export interface MapEmbedProps {
  /** The provider's embed URL. Absent means no map is configured. */
  readonly embedUrl?: string;
  /** Shown beneath the frame; text, so the location survives a failed load. */
  readonly addressLines: readonly string[];
}

export function MapEmbed({ embedUrl, addressLines }: MapEmbedProps) {
  const { location } = CONTACT_PAGE;

  if (!embedUrl) {
    return (
      <div className="border-border bg-muted text-body-sm text-muted-foreground rounded-xl border border-dashed p-6">
        {location.mapUnavailable}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-muted overflow-hidden rounded-xl border">
        <MapFrame
          embedUrl={embedUrl}
          className="aspect-[4/3] sm:aspect-[16/10]"
        />
      </div>

      {/*
        The address in text, beneath the frame. This is what makes the map an
        enhancement rather than the only route to the location: it works with
        images off, with the frame blocked, and for a screen reader.
      */}
      <address className="text-body-sm text-prose not-italic">
        {addressLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
    </div>
  );
}

/**
 * The bare map frame, without the address or the privacy note.
 *
 * For a composition that prints both itself - the home page's location card
 * shows the address in its details list and the note beneath it. Whoever
 * renders this is responsible for keeping `mapPrivacyNote` on the page.
 */
export function MapFrame({
  embedUrl,
  className,
}: {
  readonly embedUrl: string;
  readonly className?: string;
}) {
  return (
    <iframe
      src={embedUrl}
      title={CONTACT_PAGE.location.mapTitle}
      loading="lazy"
      // Sends only the origin to the map provider, never the full URL of
      // the page the visitor is on.
      referrerPolicy="strict-origin-when-cross-origin"
      // No `allow` list: the map needs no camera, microphone or geolocation
      // to show a fixed address, and the site-wide Permissions-Policy denies
      // them anyway.
      className={cn("block w-full border-0", className)}
    />
  );
}
