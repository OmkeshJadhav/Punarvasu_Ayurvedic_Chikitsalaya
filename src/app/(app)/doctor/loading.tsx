import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionLoading } from "@/components/shared/loading-state";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DOCTOR_SCHEDULE_COPY } from "@/features/doctor/content";

/**
 * The clinical workspace's loading state.
 *
 * A structured skeleton in roughly the shape of the page — heading, the four
 * counts, the two panels, then rows — rather than the word "Loading" across
 * the screen (`phase_11.md` section 40). Matching the layout means the
 * content does not jump when it arrives, which on a screen somebody reads
 * between patients is worth more than it sounds.
 *
 * The skeletons are `aria-hidden` inside `SectionLoading`, which announces
 * the label once, politely. A screen-reader user hears a sentence, not a list
 * of empty boxes.
 */
export default function DoctorHomeLoading() {
  return (
    <Section>
      <Container width="wide">
        <SectionLoading label={DOCTOR_SCHEDULE_COPY.loadingLabel}>
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

          <div aria-hidden="true" className="mt-8 grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-36 w-full rounded-lg" />
            <Skeleton className="h-36 w-full rounded-lg" />
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
