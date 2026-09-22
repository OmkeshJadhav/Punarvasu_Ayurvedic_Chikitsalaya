import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * The shape of an analytics page, while it is being read.
 *
 * ## A structured skeleton, not the word "Loading"
 *
 * `phase_16.md` section 63 asks for skeletons and partial loading rather than
 * blocking the whole dashboard. Matching the real layout — heading, filter,
 * a row of figures, a chart, a table — means the content does not jump when
 * it arrives, which on a page somebody reloads with a new date range several
 * times in a row is worth more than it sounds.
 *
 * ## Why one component for three pages
 *
 * The three dashboards differ in how many panels they carry, not in their
 * shape, and a skeleton that is *roughly* right is the whole requirement. One
 * component also means the three cannot drift into three different loading
 * experiences, which is the usual outcome of copying a skeleton.
 *
 * The skeletons are `aria-hidden` inside `SectionLoading`, which announces the
 * label once, politely. A screen-reader user hears a sentence rather than a
 * list of empty boxes.
 */
export function AnalyticsLoading({
  label,
  panels = 3,
}: {
  readonly label: string;
  readonly panels?: number;
}) {
  return (
    <Section>
      <Container width="wide">
        <SectionLoading label={label}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={1} />
          </div>

          {/* The filter panel. */}
          <Skeleton
            aria-hidden="true"
            className="mt-8 h-40 w-full rounded-lg sm:h-32"
          />

          {/* The headline figures. */}
          <div
            aria-hidden="true"
            className="border-border mt-10 grid grid-cols-2 gap-6 border-y py-6 sm:grid-cols-4"
          >
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>

          {/* A chart, then the remaining panels. */}
          <Skeleton
            aria-hidden="true"
            className="mt-10 h-48 w-full rounded-lg"
          />

          <div aria-hidden="true" className="mt-10 flex flex-col gap-10">
            {Array.from({ length: Math.max(panels - 1, 0) }, (_, index) => (
              <div key={index} className="flex flex-col gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
