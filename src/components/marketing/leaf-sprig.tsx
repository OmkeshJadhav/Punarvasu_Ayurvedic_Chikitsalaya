import { MediaFrame } from "@/components/marketing/media-frame";
import { LEAF_SPRIG_IMAGE } from "@/config/images";
import { cn } from "@/lib/utils/cn";

/**
 * The painted branch: the botanical accent of the contact and services pages.
 *
 * It succeeds `BotanicalMotif`'s line-art sprig and frond there. A cut-out
 * with a real alpha channel, so it is framed at its own aspect, uncropped, on
 * a transparent ground. The caller places, sizes (by width), rotates and fades
 * it - the source branch runs from its stem at the lower right up to the
 * leaves at the upper left, and `scale-x-[-1]` mirrors it for a left edge.
 *
 * Always decorative. Rendered through `MediaFrame` so the site's images keep
 * one `next/image` path.
 */
export function LeafSprig({
  sizes,
  className,
}: {
  /** The rendered width, as for `MediaFrame`. */
  readonly sizes: string;
  readonly className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none", className)}>
      <MediaFrame
        image={LEAF_SPRIG_IMAGE}
        radius="none"
        sizes={sizes}
        className="aspect-640/533 bg-transparent"
        imageClassName="object-contain"
      />
    </div>
  );
}
