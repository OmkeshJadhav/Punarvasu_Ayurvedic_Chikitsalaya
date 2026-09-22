import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { SCHEDULE_COPY } from "@/features/reception/content";

/**
 * The front desk home page's loading state.
 *
 * A structured skeleton in roughly the shape of the page — heading, the four
 * counts, then rows — rather than the word "Loading" across the screen
 * (`phase_10.md` section 46). Matching the layout means the content does not
 * jump when it arrives, which on a screen somebody reads dozens of times a day
 * is worth more than it sounds.
 *
 * The skeletons are `aria-hidden` inside `SectionLoading`, which announces the
 * label once, politely. A screen-reader user hears a sentence, not a list of
 * empty boxes.
 */
export default function ReceptionScheduleLoading() {
  return (
    <Section>
      <Container width="wide">
        <SectionLoading label={SCHEDULE_COPY.loadingLabel}>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3 max-w-sm" />
            <SkeletonText lines={1} />
          </div>

          <div
            aria-hidden="true"
            className="border-border mt-8 grid grid-cols-2 gap-6 border-y py-5 sm:grid-cols-4"
          >
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))}
          </div>

          <div aria-hidden="true" className="mt-10 flex flex-col gap-3">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </SectionLoading>
      </Container>
    </Section>
  );
}
